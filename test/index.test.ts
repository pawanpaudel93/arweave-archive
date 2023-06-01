import { describe, expect, it } from 'vitest'
import ArLocal from 'arlocal'
import Arweave from 'arweave'

import type { ArchiveReturnType } from '../src/lib/archive'
import { Archive } from '../src/lib/archive'

describe('should', () => {
  it('archive', async () => {
    const arLocal = new ArLocal(1984, false)
    const arweave = Arweave.init({
      host: 'localhost',
      port: 1984,
      protocol: 'http',
    })
    await arLocal.start()
    const jwk = await arweave.wallets.generate()
    expect(Archive.appName).toBe('Arweave-Archive')
    expect(Archive.appVersion).toBe('0.1.0')
    const archive = new Archive(jwk, {
      gatewayUrl: 'http://localhost:1984',
      bundlerUrl: 'https://devnet.bundlr.network',
    })
    const output: ArchiveReturnType = await archive.archiveUrl('https://github.com/pawanpaudel93')
    // eslint-disable-next-line no-console
    console.log(output)
    await arweave.api.get('/mine')
    const archives = await archive.getAllArchives()
    expect(archives.length > 0).toBe(true)
    const latestArchive = await archive.getLatestArchive()
    expect(latestArchive && typeof latestArchive.id === 'string').toBe(true)
    await arLocal.stop()
  }, 60000)
})
