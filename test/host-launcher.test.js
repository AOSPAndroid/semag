import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));

function deadline(promise, milliseconds = 5000) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Host process did not finish in time')), milliseconds);
  })]).finally(() => clearTimeout(timer));
}

function launch(t, port) {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), SEMAG_NO_ANIMATION: '1', FORCE_COLOR: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '', stderr = '';
  child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
  child.stdout.on('data', data => { stdout += data; });
  child.stderr.on('data', data => { stderr += data; });
  const exited = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal }));
  });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    try { await deadline(exited, 2000); }
    catch { child.kill('SIGKILL'); await deadline(exited, 2000); }
  });
  return { child, exited, output: () => ({ stdout, stderr }) };
}

test('a real redirected host shows actual ready links once, serves HTTP and exits cleanly on Ctrl+C', async t => {
  const host = launch(t, 0);
  const port = await deadline(new Promise((resolve, reject) => {
    const inspect = () => {
      const match = host.output().stdout.match(/http:\/\/localhost:(\d+)/);
      if (match) { host.child.stdout.off('data', inspect); resolve(Number(match[1])); }
    };
    host.child.stdout.on('data', inspect); inspect();
    host.exited.then(() => reject(new Error(`Host exited before ready: ${host.output().stderr}`)));
  }));
  assert.ok(port > 0, 'display uses the real dynamically bound port');
  const response = await fetch(`http://127.0.0.1:${port}/api/host-info`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).port, port);
  const ready = host.output().stdout;
  assert.ok(ready.includes(new URL(`http://${os.hostname()}:${port}`).origin));
  assert.match(ready, /semaG/);
  assert.match(ready, /Ctrl\+C/);
  assert.ok(!ready.includes('\x1b'), 'redirected logs contain no cursor or color escapes');
  await new Promise(resolve => setTimeout(resolve, 350));
  assert.equal(host.output().stdout, ready, 'headless hosts do not redraw or flood logs');
  host.child.kill('SIGINT');
  assert.deepEqual(await deadline(host.exited), { code: 0, signal: null });
  assert.equal(host.output().stderr, '');
  assert.ok(!host.output().stdout.includes('\x1b'));
  await assert.rejects(fetch(`http://127.0.0.1:${port}/health`), 'the actual listening socket closes');
});

test('a busy port reports the real startup error and exits without announcing an online host', async t => {
  const occupied = http.createServer();
  await new Promise(resolve => occupied.listen(0, '0.0.0.0', resolve));
  t.after(() => new Promise(resolve => occupied.close(resolve)));
  const host = launch(t, occupied.address().port);
  assert.deepEqual(await deadline(host.exited), { code: 1, signal: null });
  assert.match(host.output().stderr, /Cannot start game hub:.*EADDRINUSE/);
  assert.ok(!host.output().stdout.includes('http://localhost:'));
  assert.ok(!host.output().stdout.includes('ONLINE'));
  assert.ok(!host.output().stdout.includes('\x1b'));
});
