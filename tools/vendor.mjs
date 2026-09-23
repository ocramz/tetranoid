// Re-fetch the third-party files committed under src/ and check them against
// pinned hashes. Only needed to re-create or upgrade them: `npm run vendor`.
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const GSTATIC = 'https://fonts.gstatic.com/s';
const FONTSOURCE = 'https://cdn.jsdelivr.net/npm/@fontsource';

// [destination under src/, pinned URL, sha256]
const FILES = [
  // three.js r128: the exact bytes the original page loaded from cdnjs
  // (cdnjs SRI sha512-dLxUelApnYxpLt6K2iomGngnHO83iUvZytA3YjDUCjT0HDOHKXnVYdf3hU4JjM8uEhxf9nD1/ey98U3t2vZ0qQ==)
  ['vendor/three.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
    '9274bbcec8d96168626c732b5d31c775aa8cfb7eaa0599bec0c175908a2c1ce2'],
  ['vendor/three.LICENSE', 'https://cdn.jsdelivr.net/npm/three@0.128.0/LICENSE',
    '7dddf7c5b8fd10ee654db8857d75d104b5557889aa5a91fc4ca545ea7c07062f'],

  // Latin subsets, the same files Google Fonts serves for the original <link> (see css/fonts.css)
  ['fonts/bungee-latin-400.woff2', `${GSTATIC}/bungee/v17/N0bU2SZBIuF2PU_0DXR1C9zfmQ.woff2`,
    '12967d744bb0811af26a8bed1f6734238ba9bbca6e2e70dfdc677fcffa882905'],
  ['fonts/saira-condensed-latin-400.woff2', `${GSTATIC}/sairacondensed/v12/EJROQgErUN8XuHNEtX81i9TmEkrvoutF2o-Srg.woff2`,
    '552edfd1e8b4fe0d7fb69bf5e2311125bbe2909000964085b85f90b06d23a194'],
  ['fonts/saira-condensed-latin-600.woff2', `${GSTATIC}/sairacondensed/v12/EJRLQgErUN8XuHNEtX81i9TmEkrnfc9Q962fhC61Hg.woff2`,
    '6cc20b70e1ec820999536bf962732d49bf5c28eae259df5706584841dcc21df4'],
  ['fonts/saira-condensed-latin-700.woff2', `${GSTATIC}/sairacondensed/v12/EJRLQgErUN8XuHNEtX81i9TmEkrnGc5Q962fhC61Hg.woff2`,
    '4773efcf48db56fc229704467304bdee1766640a21a67f9898de46720e05e76a'],
  ['fonts/bungee.OFL.txt', `${FONTSOURCE}/bungee@5.3.0/LICENSE`,
    '1256e1025d54b27c033b5a1335a5b99a64ea5e6cdfd5805829128baaf0a47804'],
  ['fonts/saira-condensed.OFL.txt', `${FONTSOURCE}/saira-condensed@5.3.0/LICENSE`,
    '0defe4807af026ba4e576d25f0ec6a40a6890e4ed749e953ac53b8af479d666b'],
];

for (const [dest, url, sha256] of FILES) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const got = createHash('sha256').update(bytes).digest('hex');
  if (got !== sha256) throw new Error(`${dest}: sha256 ${got} does not match the pinned ${sha256}`);
  await mkdir(dirname(join(SRC, dest)), { recursive: true });
  await writeFile(join(SRC, dest), bytes);
  console.log(`ok  src/${dest}`);
}
