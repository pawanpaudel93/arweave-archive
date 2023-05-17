import { createHash, randomBytes } from 'crypto';
import fs, { promises as fsPromises } from 'fs';
import path from 'path';

import { ArweaveSigner, createData, DataItem, Signer, Transaction } from 'arbundles';
import Arweave from 'arweave';
import { SignatureOptions } from 'arweave/node/lib/crypto/crypto-interface';
import type { JWKInterface } from 'arweave/node/lib/wallet';
import axios from 'axios';
import { findChrome } from 'find-chrome-bin';
import mime from 'mime-types';
import { execFile } from 'promisify-child-process';
import { directory } from 'tempy';

import { getErrorMessage } from './utils';

const SINGLEFILE_EXECUTABLE = './node_modules/single-file-cli/single-file';

export type ArchiveReturnType = {
  status: 'success' | 'error';
  message: string;
  txID: string;
  title: string;
  timestamp: number;
};

type DispatchReturnType = { id: string; type: 'BASE' | 'BUNDLED' };

type Tag = { name: string; value: string; key?: string };

type ArDataItemParams = {
  data: Uint8Array | string;
  tags?: Tag[];
  target?: string;
  path?: string;
  key?: string;
};

type ManifestPath = {
  id: string;
};

type Manifest = {
  manifest: string;
  version: string;
  index: {
    path: string;
  };
  paths: Record<string, ManifestPath>;
};

export class Archive {
  private manifestContentType = 'application/x.arweave-manifest+json';
  private appName = 'Arweave-Archive';
  private appVersion = '0.1.0';
  private gatewayUrl = 'https://arweave.net';
  private bundlerUrl = 'https://node2.bundlr.network';
  private isDevelopment = false;
  private jwk: JWKInterface;
  private signer: Signer;
  private arweave: Arweave;

  constructor(jwk: JWKInterface | string, gatewayUrl?: string, bundlerUrl?: string) {
    this.gatewayUrl = this.processUrl(gatewayUrl ?? this.gatewayUrl);
    this.bundlerUrl = this.processUrl(bundlerUrl ?? this.bundlerUrl);
    this.processJWK(jwk);
    this.initArweave();
  }

  private async readFileAsBuffer(filePath: string): Promise<Buffer> {
    return await fsPromises.readFile(filePath);
  }

  private joinUrl(baseUrl: string, pathUrl: string): string {
    return new URL(pathUrl, baseUrl).toString();
  }

  private processUrl(url: string) {
    return new URL(url).toString();
  }

  private processJWK(jwk: JWKInterface | string) {
    if (typeof jwk === 'string') {
      if (fs.existsSync(jwk)) {
        // Read JWK from file path
        this.jwk = JSON.parse(fs.readFileSync(jwk, 'utf8'));
      } else {
        // Treat jwk as JWK data string
        this.jwk = JSON.parse(jwk);
      }
    } else {
      // JWK is provided as data
      this.jwk = jwk;
    }
    this.signer = new ArweaveSigner(this.jwk);
  }

  private initArweave() {
    let { host, port, protocol } = new URL(this.gatewayUrl);
    host = host.split(':')[0];
    protocol = protocol.replace(':', '');
    port = port ? port : protocol === 'https' ? '443' : '80';
    this.arweave = Arweave.init({ host, port, protocol });
    this.isDevelopment = host === 'localhost' || host === '127.0.0.1';
    if (this.isDevelopment) {
      this.arweave.wallets.jwkToAddress(this.jwk).then((address) => {
        this.arweave.api.get(`/mint/${address}/100000000000000000000`);
      });
    }
  }

  private async toHash(data: Buffer): Promise<string> {
    // Calculate the SHA-256 hash of the data using the crypto module
    const hashBuffer = createHash('sha256').update(data).digest();

    // Convert the hash buffer to a hex string
    const hashHex = hashBuffer.toString('hex');

    return hashHex;
  }

  private async getChromeExecutablePath() {
    const { executablePath } = await findChrome({});
    return executablePath;
  }

  private async runBrowser({ browserArgs, browserExecutablePath, url, basePath, output }) {
    const command = [
      `--browser-executable-path=${browserExecutablePath}`,
      `--browser-args='${browserArgs}'`,
      url,
      `--output=${output}`,
      `--base-path=${basePath}`,
    ];
    await execFile(SINGLEFILE_EXECUTABLE, command);
  }

  private async signTransaction(tx: Transaction, options?: SignatureOptions): Promise<Transaction> {
    const targetVerificationFailure = tx.quantity && +tx.quantity > 0 && tx.target;
    if (targetVerificationFailure) {
      throw Error('The target is a transaction hash, not an account');
    }
    const owner = this.jwk.n;
    if (owner && tx.owner && tx.owner !== owner) {
      throw Error('Wrong owner');
    }
    if (!tx.owner && owner) {
      tx.setOwner(owner);
    }
    await this.arweave.transactions.sign(tx, this.jwk, options);
    return tx;
  }

  private async createDataItem(item: ArDataItemParams): Promise<DataItem> {
    const { data, tags, target } = item;
    const anchor = randomBytes(32).toString('base64').slice(0, 32);
    const dataItem = createData(data, this.signer, { tags, target, anchor });
    await dataItem.sign(this.signer);
    return dataItem;
  }

  private async manageUpload(tx: Transaction): Promise<number | undefined> {
    if (!tx.chunks?.chunks?.length) {
      await this.arweave.transactions.post(tx);
      return undefined;
    }
    const uploader = await this.arweave.transactions.getUploader(tx);

    while (!uploader.isComplete) {
      await uploader.uploadChunk();
    }

    return uploader.lastResponseStatus;
  }

  private async dispatch(tx: Transaction): Promise<DispatchReturnType> {
    let errorMessage: string;
    if (!tx.quantity || (tx.quantity === '0' && !this.isDevelopment)) {
      try {
        const data = tx.get('data', { decode: true, string: false });
        const tags = tx.tags.map((tag) => ({
          name: tag.get('name', { decode: true, string: true }),
          value: tag.get('value', { decode: true, string: true }),
        }));
        const target = tx.target;
        const bundleTx = await this.createDataItem({ data, tags, target });
        const txUrl = this.joinUrl(this.bundlerUrl, 'tx');
        const res = await axios.post(txUrl, bundleTx.getRaw(), {
          headers: { 'Content-Type': 'application/octet-stream' },
          maxBodyLength: Infinity,
        });
        if (res.status >= 200 && res.status < 300) {
          const dispatchResult: DispatchReturnType = {
            id: bundleTx.id,
            type: 'BUNDLED',
          };
          return dispatchResult;
        }
      } catch (error) {
        errorMessage = getErrorMessage(error);
      }
    }
    try {
      await this.signTransaction(tx);
      await this.manageUpload(tx);
      const dispatchResult: DispatchReturnType = {
        id: tx.id,
        type: 'BASE',
      };
      return dispatchResult;
    } catch (error) {
      errorMessage = getErrorMessage(error);
    }
    throw Error(errorMessage);
  }

  public archiveUrl = async (url: string): Promise<ArchiveReturnType> => {
    let tempDirectory: string;
    try {
      const manifest: Manifest = {
        manifest: 'arweave/paths',
        version: '0.1.0',
        index: {
          path: 'index.html',
        },
        paths: {},
      };
      tempDirectory = directory();

      try {
        await this.runBrowser({
          browserArgs: '["--no-sandbox", "--window-size=1920,1080", "--start-maximized"]',
          browserExecutablePath: await this.getChromeExecutablePath(),
          url,
          basePath: tempDirectory,
          output: path.resolve(tempDirectory, 'index.html'),
        });
      } catch (error) {
        await fsPromises.rm(tempDirectory, { recursive: true, force: true });
        return {
          status: 'error',
          message: error.toString(),
          txID: '',
          title: '',
          timestamp: 0,
        };
      }

      // Get a list of all files in the directory
      const files = await fsPromises.readdir(tempDirectory);

      const metadata: {
        title: string;
        url: string;
      } = JSON.parse((await this.readFileAsBuffer(path.join(tempDirectory, 'metadata.json'))).toString());
      const timestamp = Math.floor(Date.now() / 1000);

      // Loop through all files and read them as Uint8Array
      await Promise.all(
        files
          .filter((file) => !file.includes('metadata.json'))
          .map(async (file) => {
            const filePath = path.join(tempDirectory, file);
            const isIndexFile = filePath.includes('index.html');
            const bufferData = await this.readFileAsBuffer(filePath);
            const hash = await this.toHash(bufferData);
            const data = new Uint8Array(bufferData);
            const transaction = await this.arweave.createTransaction({ data }, this.jwk);
            const mimeType = mime.lookup(filePath) || 'application/octet-stream';
            transaction.addTag('App-Name', this.appName);
            transaction.addTag('App-Version', this.appVersion);
            transaction.addTag('Content-Type', mimeType);
            transaction.addTag(isIndexFile ? 'page:title' : 'screenshot:title', metadata.title);
            transaction.addTag(isIndexFile ? 'page:url' : 'screenshot:url', metadata.url);
            transaction.addTag(isIndexFile ? 'page:timestamp' : 'screenshot:timestamp', String(timestamp));
            transaction.addTag('File-Hash', hash);
            const response = await this.dispatch(transaction);
            manifest.paths[isIndexFile ? 'index.html' : 'screenshot'] = {
              id: response.id,
            };
          })
      );

      const data = new TextEncoder().encode(JSON.stringify(manifest));
      const manifestTransaction = await this.arweave.createTransaction({ data }, this.jwk);
      manifestTransaction.addTag('App-Name', this.appName);
      manifestTransaction.addTag('App-Version', this.appVersion);
      manifestTransaction.addTag('Content-Type', this.manifestContentType);
      manifestTransaction.addTag('Title', metadata.title);
      manifestTransaction.addTag('Type', 'archive');
      manifestTransaction.addTag('Url', metadata.url);
      manifestTransaction.addTag('Timestamp', String(timestamp));
      const response = await this.dispatch(manifestTransaction);

      await fsPromises.rm(tempDirectory, { recursive: true, force: true });
      return {
        status: 'success',
        message: `Uploaded to Arweave!`,
        txID: response.id,
        title: metadata.title,
        timestamp,
      };
    } catch (error) {
      if (tempDirectory) {
        await fsPromises.rm(tempDirectory, { recursive: true, force: true });
      }
      return {
        status: 'error',
        message: error.toString(),
        txID: '',
        title: '',
        timestamp: 0,
      };
    }
  };
}
