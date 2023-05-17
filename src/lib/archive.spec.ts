import ArLocal from 'arlocal';
import test from 'ava';
import dotenv from 'dotenv';

import { Archive, ArchiveReturnType } from './archive';

dotenv.config();

test('Archive', async (t) => {
  const arLocal = new ArLocal(1984, false);
  await arLocal.start();
  const archive = new Archive(process.env.JWK_PATH, 'http://localhost:1984', 'https://devnet.bundlr.network');
  const output: ArchiveReturnType = await archive.archiveUrl('https://github.com/pawanpaudel93');
  console.log(output);
  await arLocal.stop();
  t.assert(output.status === 'success');
});
