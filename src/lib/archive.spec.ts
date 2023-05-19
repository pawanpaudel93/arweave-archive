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
  const archive = new Archive(jwk, 'http://localhost:1984', 'https://devnet.bundlr.network');
  const output: ArchiveReturnType = await archive.archiveUrl('https://github.com/pawanpaudel93');
  console.log(output);
  await arLocal.stop();
  t.assert(output.status === 'success');
});
