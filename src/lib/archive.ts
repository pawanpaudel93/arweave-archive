import { createHash, randomBytes } from 'node:crypto'
import fs, { promises as fsPromises } from 'node:fs'
import path from 'node:path'
import type { Buffer } from 'node:buffer'
import type { DataItem, Signer, Transaction } from 'arbundles'
import { ArweaveSigner, createData } from 'arbundles'
import Arweave from 'arweave'
import type { SignatureOptions } from 'arweave/node/lib/crypto/crypto-interface'
import type { JWKInterface } from 'arweave/node/lib/wallet'
import { HtmlScreenshotSaver } from 'save-html-screenshot'
import type { HtmlScreenshotSaverOptions, SaveResult } from 'save-html-screenshot'
import axios from 'axios'
import mime from 'mime-types'

import { getErrorMessage } from './utils'

export interface ArchiveResult {
  status: 'success' | 'error'
  message: string
  txID: string
  title: string
  timestamp: number
}

interface DispatchResult {
  id: string
  type: 'BASE' | 'BUNDLED'
}

interface Tag {
  name: string
  value: string
  key?: string
}

interface ArDataItemParams {
  data: Uint8Array | string
  tags?: Tag[]
  target?: string
  path?: string
  key?: string
}

interface ManifestPath {
  id: string
}

interface Manifest {
  manifest: string
  version: string
  index: {
    path: string
  }
  paths: Record<string, ManifestPath>
}

interface Archive {
  id: string
  url: string
  title: string
  webpage: string
  screenshot: string
  timestamp: number
}

interface ArchiverOptions {
  gatewayUrl?: string
  bundlerUrl?: string
  browserOptions?: HtmlScreenshotSaverOptions
}

export class ArweaveArchiver {
  private readonly manifestContentType = 'application/x.arweave-manifest+json'
  static readonly appName = 'Arweave-Archive'
  static readonly appVersion = '0.1.0'
  private gatewayUrl = 'https://arweave.net'
  private bundlerUrl = 'https://node2.bundlr.network'
  private walletAddress?: string
  private isDevelopment = false
  private jwk: JWKInterface
  private signer: Signer
  private arweave: Arweave
  private browserOptions?: HtmlScreenshotSaverOptions

  constructor(jwk: JWKInterface | string, options?: ArchiverOptions) {
    this.gatewayUrl = this.processUrl(options?.gatewayUrl ?? this.gatewayUrl)
    this.bundlerUrl = this.processUrl(options?.bundlerUrl ?? this.bundlerUrl)
    this.browserOptions = options?.browserOptions
    this.jwk = this.processJWK(jwk)
    this.signer = new ArweaveSigner(this.jwk)
    this.arweave = this.initArweave()
  }

  private async readFileAsBuffer(filePath: string): Promise<Buffer> {
    return await fsPromises.readFile(filePath)
  }

  private joinUrl(baseUrl: string, pathUrl: string): string {
    return new URL(pathUrl, baseUrl).toString()
  }

  private processUrl(url: string) {
    return new URL(url).toString()
  }

  private processJWK(jwk: JWKInterface | string) {
    if (typeof jwk === 'string') {
      if (fs.existsSync(jwk)) {
        // Read JWK from file path
        jwk = JSON.parse(fs.readFileSync(jwk, 'utf8'))
      }
      else {
        // Treat jwk as JWK data string
        jwk = JSON.parse(jwk)
      }
    }
    return jwk as JWKInterface
  }

  private initArweave() {
    let { host, port, protocol } = new URL(this.gatewayUrl)
    host = host.split(':')[0]
    protocol = protocol.replace(':', '')
    port = port || (protocol === 'https' ? '443' : '80')
    const arweave = Arweave.init({ host, port, protocol })
    this.isDevelopment = host === 'localhost' || host === '127.0.0.1'
    if (this.isDevelopment) {
      arweave.wallets.jwkToAddress(this.jwk).then((address) => {
        arweave.api.get(`/mint/${address}/100000000000000000000`)
      })
    }
    return arweave
  }

  private async toHash(data: Buffer): Promise<string> {
    // Calculate the SHA-256 hash of the data using the crypto module
    const hashBuffer = createHash('sha256').update(data).digest()

    // Convert the hash buffer to a hex string
    const hashHex = hashBuffer.toString('hex')

    return hashHex
  }

  private async getWalletAddress() {
    if (this.walletAddress)
      return this.walletAddress
    this.walletAddress = await this.arweave.wallets.jwkToAddress(this.jwk)
    return this.walletAddress
  }

  private async signTransaction(tx: Transaction, options?: SignatureOptions): Promise<Transaction> {
    const targetVerificationFailure = tx.quantity && +tx.quantity > 0 && tx.target
    if (targetVerificationFailure)
      throw new Error('The target is a transaction hash, not an account')

    const owner = this.jwk.n
    if (owner && tx.owner && tx.owner !== owner)
      throw new Error('Wrong owner')

    if (!tx.owner && owner)
      tx.setOwner(owner)

    await this.arweave.transactions.sign(tx, this.jwk, options)
    return tx
  }

  private async createDataItem(item: ArDataItemParams): Promise<DataItem> {
    const { data, tags, target } = item
    const anchor = randomBytes(32).toString('base64').slice(0, 32)
    const dataItem = createData(data, this.signer, { tags, target, anchor })
    await dataItem.sign(this.signer)
    return dataItem
  }

  private async manageUpload(tx: Transaction): Promise<number | undefined> {
    if (!tx.chunks?.chunks?.length) {
      await this.arweave.transactions.post(tx)
      return undefined
    }
    const uploader = await this.arweave.transactions.getUploader(tx)

    while (!uploader.isComplete) await uploader.uploadChunk()

    return uploader.lastResponseStatus
  }

  private async dispatch(tx: Transaction): Promise<DispatchResult> {
    let errorMessage: string
    if (!tx.quantity || (tx.quantity === '0' && !this.isDevelopment)) {
      try {
        const data = tx.get('data', { decode: true, string: false })
        const tags = tx.tags.map(tag => ({
          name: tag.get('name', { decode: true, string: true }),
          value: tag.get('value', { decode: true, string: true }),
        }))
        const target = tx.target
        const bundleTx = await this.createDataItem({ data, tags, target })
        const txUrl = this.joinUrl(this.bundlerUrl, 'tx')
        const res = await axios.post(txUrl, bundleTx.getRaw(), {
          headers: { 'Content-Type': 'application/octet-stream' },
          maxBodyLength: Infinity,
        })
        if (res.status >= 200 && res.status < 300) {
          const dispatchResult: DispatchResult = {
            id: bundleTx.id,
            type: 'BUNDLED',
          }
          return dispatchResult
        }
      }
      catch (error) {
        errorMessage = getErrorMessage(error)
      }
    }
    try {
      await this.signTransaction(tx)
      await this.manageUpload(tx)
      const dispatchResult: DispatchResult = {
        id: tx.id,
        type: 'BASE',
      }
      return dispatchResult
    }
    catch (error) {
      errorMessage = getErrorMessage(error)
    }
    throw new Error(errorMessage)
  }

  public archiveUrl = async (url: string): Promise<ArchiveResult> => {
    let tempDirectory = ''
    let result: SaveResult
    try {
      const manifest: Manifest = {
        manifest: 'arweave/paths',
        version: '0.1.0',
        index: {
          path: 'index.html',
        },
        paths: {},
      }

      const saver = new HtmlScreenshotSaver({ ...this.browserOptions, saveScreenshot: true })
      result = await saver.save(url)
      if (result.status === 'error')
        throw new Error(result.message)

      tempDirectory = result.webpage.replace('index.html', '')

      // Get a list of all files in the directory
      const files = await fsPromises.readdir(tempDirectory)

      const timestamp = Math.floor(Date.now() / 1000)

      // Loop through all files and read them as Uint8Array
      await Promise.all(
        files
          .filter(file => !file.includes('metadata.json'))
          .map(async (file) => {
            const filePath = path.join(tempDirectory, file)
            const isIndexFile = filePath.includes('index.html')
            const bufferData = await this.readFileAsBuffer(filePath)
            const hash = await this.toHash(bufferData)
            const data = new Uint8Array(bufferData)
            const transaction = await this.arweave.createTransaction({ data }, this.jwk)
            const mimeType = mime.lookup(filePath) || 'application/octet-stream'
            transaction.addTag('App-Name', ArweaveArchiver.appName)
            transaction.addTag('App-Version', ArweaveArchiver.appVersion)
            transaction.addTag('Content-Type', mimeType)
            transaction.addTag(isIndexFile ? 'page:title' : 'screenshot:title', result.title)
            transaction.addTag(isIndexFile ? 'page:url' : 'screenshot:url', url)
            transaction.addTag(isIndexFile ? 'page:timestamp' : 'screenshot:timestamp', String(timestamp))
            transaction.addTag('File-Hash', hash)
            const response = await this.dispatch(transaction)
            manifest.paths[isIndexFile ? 'index.html' : 'screenshot'] = {
              id: response.id,
            }
          }),
      )

      const data = new TextEncoder().encode(JSON.stringify(manifest))
      const manifestTransaction = await this.arweave.createTransaction({ data }, this.jwk)
      manifestTransaction.addTag('App-Name', ArweaveArchiver.appName)
      manifestTransaction.addTag('App-Version', ArweaveArchiver.appVersion)
      manifestTransaction.addTag('Content-Type', this.manifestContentType)
      manifestTransaction.addTag('Title', result.title)
      manifestTransaction.addTag('Type', 'archive')
      manifestTransaction.addTag('Url', url)
      manifestTransaction.addTag('Timestamp', String(timestamp))
      const response = await this.dispatch(manifestTransaction)

      await fsPromises.rm(tempDirectory, { recursive: true, force: true })
      return {
        status: 'success',
        message: 'Uploaded to Arweave!',
        txID: response.id,
        title: result.title,
        timestamp,
      }
    }
    catch (error) {
      if (tempDirectory)
        await fsPromises.rm(tempDirectory, { recursive: true, force: true })

      return {
        status: 'error',
        message: getErrorMessage(error),
        txID: '',
        title: '',
        timestamp: 0,
      }
    }
  }

  private query = async (walletAddress: string, first = 100, cursor?: string) => {
    const query = {
      query: `
            query {
                transactions(
                    first: ${first},
                    ${cursor ? `after: "${cursor}",` : ''}
                    owners: ["${walletAddress}"],
                    tags: [
                        { name: "App-Name", values: ["${ArweaveArchiver.appName}"] }
                        { name: "Content-Type", values: ["${this.manifestContentType}"] }
                        { name: "App-Version", values: ["${ArweaveArchiver.appVersion}"]}
                    ]
                ) {
                    pageInfo { 
                        hasNextPage
                    }
                    edges {
                        cursor
                        node {
                            id
                            tags {
                                name
                                value
                            }
                        }
                    }
                }
            }
        `,
    }
    const {
      data: {
        data: {
          transactions: {
            edges: archivedTransactions,
            pageInfo: { hasNextPage },
          },
        },
      },
    } = await this.arweave.api.post('graphql', query)
    cursor = archivedTransactions[archivedTransactions.length - 1]?.cursor
    return { archivedTransactions, cursor, hasNextPage }
  }

  public getAllArchives = async (walletAddress?: string): Promise<Archive[]> => {
    const address = walletAddress ?? (await this.getWalletAddress())
    const archives: Archive[] = []
    let hasNextPage = true
    let cursor = ''
    while (hasNextPage) {
      const result = await this.query(address, 100, cursor)
      hasNextPage = result.hasNextPage
      cursor = result.cursor ?? ''
      if (result.archivedTransactions.length > 0) {
        archives.push(
          ...result.archivedTransactions.map((transaction: { node: { tags: Tag[]; id: string } }) => {
            const { id, tags } = transaction.node
            return {
              id,
              url: tags[5]?.value ?? '',
              title: tags[3]?.value ?? '',
              webpage: this.joinUrl(this.gatewayUrl, id),
              screenshot: this.joinUrl(this.gatewayUrl, `${id}/screenshot`),
              timestamp: parseInt(tags[6]?.value ?? '0'),
            }
          }),
        )
      }
    }
    return archives
  }

  public getLatestArchive = async (walletAddress?: string): Promise<Archive | null> => {
    const address = walletAddress ?? (await this.getWalletAddress())

    const { archivedTransactions } = await this.query(address, 1)
    if (archivedTransactions.length > 0) {
      const { id, tags } = archivedTransactions[0].node
      return {
        id,
        url: tags[5]?.value ?? '',
        title: tags[3]?.value ?? '',
        webpage: this.joinUrl(this.gatewayUrl, id),
        screenshot: this.joinUrl(this.gatewayUrl, `${id}/screenshot`),
        timestamp: parseInt(tags[6]?.value ?? '0'),
      }
    }
    return null
  }
}
