import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const major = Number(process.versions.node.split('.')[0]);
if (major < 22) { console.error('Install Node.js 24 LTS before starting. Current: ' + process.version); process.exit(1); }
const win = process.platform === 'win32';
function npm(args) {
  return spawn(win ? 'npm.cmd' : 'npm', args, { cwd: root, stdio: 'inherit', shell: win });
}
function finished(child) {
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
  });
}
if (!fs.existsSync(path.join(root, 'node_modules/next/package.json'))) {
  console.log('Installing project dependencies from package-lock.json (internet required)...');
  try {
    if (await finished(npm(['ci'])) !== 0) {
      console.error('Installation failed. Read the error above; the server has not started.'); process.exit(1);
    }
  } catch (error) { console.error('Cannot start npm: ' + error.message); process.exit(1); }
}
function available(port) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once('error', () => resolve(false));
    s.listen(port, '127.0.0.1', () => s.close(() => resolve(true)));
  });
}
let port = 3000;
while (port <= 3010 && !await available(port)) port++;
if (port > 3010) { console.error('Ports 3000-3010 are in use. Close an existing dev server first.'); process.exit(1); }
const url = `http://127.0.0.1:${port}/admin/login`;
console.log(`\nOpen after the server reports Ready: ${url}`);
console.log('Demo account: admin@test.com / test1234');
console.log('Keep this terminal open. Stop with Ctrl+C.\n');
const child = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', String(port)], { cwd: root, stdio: 'inherit' });
child.once('error', (error) => { console.error(error.message); process.exitCode = 1; });
child.once('exit', (code) => { process.exitCode = code ?? 0; });
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
