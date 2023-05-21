import ArLocal from 'arlocal';
import Arweave from 'arweave';
import test from 'ava';

import { Archive, ArchiveReturnType } from './archive';

test('Archive', async (t) => {
  const arLocal = new ArLocal(1984, false);
  const arweave = Arweave.init({
    host: 'localhost',
    port: '1984',
    protocol: 'http',
  });
  await arLocal.start();
  const jwk = await arweave.wallets.generate();
  t.assert(Archive.appName === 'Arweave-Archive');
  t.assert(Archive.appVersion === '0.1.0');
  const archive = new Archive(jwk, {
    gatewayUrl: 'http://localhost:1984',
    bundlerUrl: 'https://devnet.bundlr.network',
  });
  const output: ArchiveReturnType = await archive.archiveUrl('https://github.com/pawanpaudel93');
  await arweave.api.get(`/mine`);
  const archives = await archive.getAllArchives();
  t.assert(archives.length > 0);
  const latestArchive = await archive.getLatestArchive();
  t.assert(latestArchive && typeof latestArchive.id === 'string');
  await arLocal.stop();
  t.assert(output);
});
