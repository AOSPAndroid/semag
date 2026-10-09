/** Export the shipped browser games for static Sites hosting. */
import { cp, mkdir, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { resolve, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = process.argv[2];
if (!output || !isAbsolute(output) || resolve(output) === root || resolve(output).startsWith(root + '/public')) throw new Error('Pass an absolute, dedicated Sites project directory.');
const dist = resolve(output, 'dist');
const hostingPath = resolve(output, '.openai/hosting.json');
const hosting = JSON.parse(await readFile(hostingPath, 'utf8'));
if (!hosting.project_id || hosting.static?.directory !== 'dist') throw new Error('Register the Site and preserve its static dist manifest first.');
const archive = resolve(process.argv[3] || resolve(root, 'downloads/fireside-hub.zip'));
if (!(await stat(archive)).isFile()) throw new Error('Build the updated PC-host download before exporting Sites.');
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(resolve(root, 'public'), dist, { recursive: true });
const indexPath = resolve(dist, 'index.html');
const index = await readFile(indexPath, 'utf8');
if (!index.includes('<meta name="semag-hosting" content="pc">')) throw new Error('The hub is missing its explicit hosting mode.');
await writeFile(indexPath, index.replace('<meta name="semag-hosting" content="pc">', '<meta name="semag-hosting" content="sites">'));
await mkdir(resolve(dist, 'download'), { recursive: true });
await cp(archive, resolve(dist, 'download/fireside-hub.zip'));
const metadata = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const downloadSha256 = createHash('sha256').update(await readFile(archive)).digest('hex');
await writeFile(resolve(dist, 'build-info.json'), JSON.stringify({ version: metadata.version, hosting: 'browser-local', multiplayer: 'pc-host', pcDownloadSha256: downloadSha256 }, null, 2) + '\n');
console.log(JSON.stringify({ projectId: hosting.project_id, version: metadata.version, dist, pcDownloadSha256: downloadSha256 }));
