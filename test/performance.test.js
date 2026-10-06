import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile, writeFile, unlink, utimes } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import http from 'node:http';
import { gunzipSync, brotliDecompressSync } from 'node:zlib';
import test from 'node:test';
import { createServer } from '../server.js';
import { Peer, flushPeer } from './ws-helper.js';

async function host(t, options = {}) {
  const app = createServer({ autoTick: false, ...options });
  const address = await app.listen(0, '127.0.0.1');
  t.after(() => app.close());
  return { app, origin: `http://127.0.0.1:${address.port}` };
}

function request(url, headers = {}, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method, headers }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
      res.on('error', reject);
    });
    req.on('error', reject); req.end();
  });
}

async function peerFor(t, game, roomId) {
  const peer = new Peer(`${game.origin.replace('http:', 'ws:')}/ws?room=${roomId}`);
  t.after(() => peer.socket.terminate());
  await peer.connect();
  return peer;
}

test('compressed assets preserve bytes, negotiate encodings and support HEAD', async t => {
  const game = await host(t);
  const original = await readFile(new URL('../public/renderer.js', import.meta.url));
  for (const [encoding, decode] of [['br', brotliDecompressSync], ['gzip', gunzipSync]]) {
    const result = await request(`${game.origin}/renderer.js`, { 'Accept-Encoding': encoding });
    assert.equal(result.status, 200);
    assert.equal(result.headers['content-encoding'], encoding);
    assert.equal(result.headers.vary, 'Accept-Encoding');
    assert.equal(result.headers['cache-control'], 'no-cache');
    assert.equal(Number(result.headers['content-length']), result.body.length);
    assert.deepEqual(decode(result.body), original);
    assert.ok(result.body.length < original.length / 2);
    const head = await request(`${game.origin}/renderer.js`, { 'Accept-Encoding': encoding }, 'HEAD');
    assert.equal(head.body.length, 0);
    assert.equal(head.headers['content-length'], result.headers['content-length']);
    assert.equal(head.headers.etag, result.headers.etag);
  }
  for (const header of ['br;q=0,gzip;q=0', 'identity', 'br;q=0,*;q=0']) {
    const result = await request(`${game.origin}/renderer.js`, { 'Accept-Encoding': header });
    assert.equal(result.headers['content-encoding'], undefined);
    assert.deepEqual(result.body, original);
  }
  const preferred = await request(`${game.origin}/renderer.js`, { 'Accept-Encoding': 'br;q=0.2,gzip;q=0.8' });
  assert.equal(preferred.headers['content-encoding'], 'gzip');
});

test('cache validation sends no body and a changed local asset invalidates its compressed copy', async t => {
  const fixture = new URL(`../public/performance-${randomUUID()}.svg`, import.meta.url);
  const contents = color => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg">${`<path fill="${color}" d="M0 0h10v10H0z"/>`.repeat(100)}</svg>`);
  const first = contents('red'), next = contents('tan');
  await writeFile(fixture, first);
  t.after(() => unlink(fixture));
  const game = await host(t);
  const url = `${game.origin}/${fixture.pathname.split('/').at(-1)}`;
  const get = await request(url, { 'Accept-Encoding': 'gzip' });
  const notModified = await request(url, { 'Accept-Encoding': 'br', 'If-None-Match': `"unrelated", ${get.headers.etag}` });
  assert.equal(notModified.status, 304);
  assert.equal(notModified.body.length, 0);
  assert.equal(notModified.headers.etag, get.headers.etag);
  const strongEquivalent = await request(url, { 'If-None-Match': get.headers.etag.replace(/^W\//, '') });
  assert.equal(strongEquivalent.status, 304);
  assert.equal(strongEquivalent.body.length, 0);
  const date = await request(url, { 'If-Modified-Since': get.headers['last-modified'] });
  assert.equal(date.status, 304);
  const precedence = await request(url, { 'If-None-Match': '"different"', 'If-Modified-Since': get.headers['last-modified'] });
  assert.equal(precedence.status, 200);
  await writeFile(fixture, next);
  const modified = new Date(Date.now() + 2000);
  await utimes(fixture, modified, modified);
  const changed = await request(url, { 'Accept-Encoding': 'gzip', 'If-None-Match': get.headers.etag });
  assert.equal(changed.status, 200);
  assert.notEqual(changed.headers.etag, get.headers.etag);
  assert.deepEqual(gunzipSync(changed.body), next);
  assert.notDeepEqual(changed.body, get.body);
});

test('empty rooms do no simulation work while occupied rooms retain their 120 Hz clock', async t => {
  const game = await host(t);
  const empty = game.app.createRoom('dungeon-run');
  const occupied = game.app.createRoom('afterimage');
  const peer = await peerFor(t, game, occupied.id);
  for (let i = 0; i < 120; i++) game.app.tick();
  await flushPeer(peer);
  assert.equal(empty.state.tick, 0);
  assert.equal(game.app.state.tick, 0);
  assert.equal(occupied.state.tick, 120);
  const closed = once(peer.socket, 'close'); peer.socket.close(); await closed;
  const tick = occupied.state.tick;
  for (let i = 0; i < 120; i++) game.app.tick();
  assert.equal(occupied.state.tick, tick);
});

test('quiet lobbies use 10 Hz snapshots; countdown and combat retain 60 Hz and immediate readiness', async t => {
  const game = await host(t);
  const room = game.app.createRoom('afterimage');
  const first = await peerFor(t, game, room.id), second = await peerFor(t, game, room.id);
  await flushPeer(first);
  let after = first.messages.length;
  for (let i = 0; i < 120; i++) game.app.tick();
  await flushPeer(first);
  assert.equal(first.messages.slice(after).filter(packet => packet.type === 'state').length, 10);
  first.send({ type: 'ready', ready: true }); second.send({ type: 'ready', ready: true });
  await first.untilState(packet => packet.state.phase === 'countdown', { after });
  after = first.messages.length;
  for (let i = 0; i < 120; i++) game.app.tick();
  await flushPeer(first);
  assert.equal(first.messages.slice(after).filter(packet => packet.type === 'state').length, 60);
  after = first.messages.length;
  second.send({ type: 'ready', ready: false });
  await first.untilState(packet => packet.state.phase === 'lobby', { after });
  after = first.messages.length;
  first.send({ type: 'ready', ready: true }); second.send({ type: 'ready', ready: true });
  await first.untilState(packet => packet.state.phase === 'countdown', { after });
  room.state.phaseTicks = 1; game.app.tick();
  assert.equal(room.state.phase, 'fight');
  after = first.messages.length;
  for (let i = 0; i < 120; i++) game.app.tick();
  await flushPeer(first);
  assert.equal(first.messages.slice(after).filter(packet => packet.type === 'state').length, 60);
});

test('host timer sleeps with no peers and wakes correctly after a complete disconnect', async t => {
  const game = await host(t, { autoTick: true });
  await new Promise(resolve => setTimeout(resolve, 60));
  assert.equal(game.app.state.tick, 0);
  const room = game.app.createRoom('relic-duel');
  const first = await peerFor(t, game, room.id);
  await first.untilState(packet => packet.state.tick >= 12);
  const closed = once(first.socket, 'close'); first.socket.close(); await closed;
  const dormantTick = room.state.tick;
  await new Promise(resolve => setTimeout(resolve, 60));
  assert.equal(room.state.tick, dormantTick);
  const replacement = await peerFor(t, game, room.id);
  await replacement.untilState(packet => packet.state.tick > dormantTick);
  assert.equal(room.players[0].connected, true);
});
