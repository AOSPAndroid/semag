import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { createServer } from '../server.js';
import { Peer, flushPeer } from './ws-helper.js';
async function host(t) {
  const app = createServer({ autoTick: false }); await app.listen(0, '127.0.0.1');
  const origin = `http://127.0.0.1:${app.server.address().port}`, peers = [];
  t.after(async () => { for (const peer of peers) peer.socket.terminate(); await app.close(); });
  return { app, origin, async make(id = 'shinobi-showdown') {
    const response = await fetch(`${origin}/api/rooms`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameId: id }) });
    assert.equal(response.status, 201); const { room } = await response.json(); return app.rooms.get(room.id);
  }, async peer(room, name = 'Akari') {
    const peer = new Peer(`${origin.replace('http:', 'ws:')}/ws?room=${room.id}`); peers.push(peer); const welcome = await peer.connect();
    peer.send({ type: 'join', name }); await peer.untilState(m => m.players[welcome.playerId]?.name === name); return { peer, welcome };
  }, third(room) { const peer = new Peer(`${origin.replace('http:', 'ws:')}/ws?room=${room.id}`); peers.push(peer); return peer; } };
}
async function ready(a, b) { const after = a.messages.length; a.send({ type: 'ready', ready: true }); b.send({ type: 'ready', ready: true }); await a.untilState(m => m.state.phase === 'countdown', { after }); }
async function fight(game, room, a, b) { await ready(a, b); for (let tick = 0; tick < 360; tick++) game.app.tick(); assert.equal(room.state.phase, 'fight'); }

test('Shinobi is hostable and starts only after both live peers ready and the full countdown', async t => {
  const game = await host(t), room = await game.make();
  const health = await (await fetch(`${game.origin}/health`)).json(); assert.ok(health.games.includes('shinobi-showdown'));
  for (const path of ['/shinobi-engine.js', '/shinobi.css', '/play.html']) assert.equal((await fetch(game.origin + path)).status, 200);
  const { peer: a, welcome } = await game.peer(room), { peer: b, welcome: other } = await game.peer(room, 'Ren'); assert.equal(welcome.gameId, 'shinobi-showdown'); assert.equal(other.playerId, 1);
  a.send({ type: 'ready', ready: true }); await a.untilState(m => m.players[0].ready); for (let i = 0; i < 400; i++) game.app.tick(); assert.equal(room.state.phase, 'lobby');
  await ready(a, b); for (let i = 0; i < 359; i++) game.app.tick(); assert.equal(room.state.phase, 'countdown'); game.app.tick(); assert.equal(room.state.phase, 'fight'); assert.ok(room.players.every(p => !p.ready));
  a.send({ type: 'input', seq: 0, buttons: { right: true, attack: true, aimX: .6, aimY: .8 } }); await flushPeer(a); const x = room.state.fighters[0].x; game.app.tick();
  assert.equal(room.acks[0], 0); assert.ok(room.state.fighters[0].x > x); assert.equal(room.state.fighters[0].action, 'light'); assert.equal(room.state.fighters[0].stamina, 86); assert.equal(room.state.fighters[0].aimX, .6);
});
test('Shinobi validates finite numeric aim and game-specific booleans without consuming bad sequences', async t => {
  const game = await host(t), room = await game.make(), { peer } = await game.peer(room);
  for (const buttons of [{ aimX: 1.01 }, { aimY: -1.01 }, { aimX: '0' }, { aimY: null }, { attack: 1 }, { heavy: 'yes' }, { throw: null }, { fire: true }, { hp: 200 }, { parry: [] }]) {
    const after = peer.messages.length; peer.send({ type: 'input', seq: 0, buttons }); await peer.waitFor(m => m.type === 'error', { after }); assert.equal(room.slots[0].lastAccepted, -1);
  }
  for (const raw of ['{"type":"input","seq":0,"buttons":{"aimX":1e999}}', '{"type":"input","seq":0,"buttons":{"__proto__":true}}']) {
    const after = peer.messages.length; peer.socket.send(raw); await peer.waitFor(m => m.type === 'error', { after });
  }
  peer.send({ type: 'input', seq: 0, buttons: { aimX: -.6, aimY: .8, throw: false, parry: false } }); await flushPeer(peer); game.app.tick(); assert.equal(room.acks[0], 0); assert.equal(room.slots[0].buttons.aimX, -.6);
});
test('Shinobi input queues consume one independent frame each tick and reject replay or distant sequences', async t => {
  const game = await host(t), room = await game.make(), { peer: a } = await game.peer(room), { peer: b } = await game.peer(room, 'Ren'); await fight(game, room, a, b);
  for (const [seq, buttons] of [[0, { right: true, aimX: -.6, aimY: .8 }], [1, {}], [2, { left: true, aimX: 0, aimY: -1 }]]) a.send({ type: 'input', seq, buttons }); await flushPeer(a);
  assert.equal(room.acks[0], -1); for (let i = 0; i < 3; i++) { game.app.tick(); assert.equal(room.acks[0], i); }
  assert.equal(room.state.fighters[0].aimY, -1); a.send({ type: 'input', seq: 1, buttons: { attack: true } }); await flushPeer(a); game.app.tick(); assert.equal(room.state.fighters[0].action, 'run');
  const after = a.messages.length; a.send({ type: 'input', seq: 603, buttons: {} }); await a.waitFor(m => m.type === 'error' && /ahead/.test(m.message), { after }); assert.equal(room.slots[0].lastAccepted, 2);
});
test('cancel ready and midfight disconnect clear Shinobi resources, queued actions, and both ready flags', async t => {
  const game = await host(t), room = await game.make(), { peer: a } = await game.peer(room), { peer: b } = await game.peer(room, 'Ren'); await ready(a, b);
  let after = a.messages.length; a.send({ type: 'ready', ready: false }); await a.untilState(m => m.state.phase === 'lobby' && !m.players[0].ready, { after });
  await fight(game, room, a, b); room.state.fighters[0].hp = 35; room.state.fighters[0].kunai = 0; room.state.fighters[0].wins = 1;
  a.send({ type: 'input', seq: 0, buttons: { heavy: true } }); await flushPeer(a); after = a.messages.length; b.socket.close();
  await a.untilState(m => m.state.phase === 'lobby' && !m.players[1]?.connected, { after }); assert.equal(room.state.fighters[0].hp, 100); assert.equal(room.state.fighters[0].kunai, 3); assert.equal(room.state.fighters[0].wins, 0);
  assert.equal(room.slots[0].queue.length, 0); assert.equal(room.slots[0].buttons.heavy, false); assert.equal(room.players[0].ready, false);
  const replacement = await game.peer(room, 'Yuki'); assert.equal(replacement.welcome.playerId, 1);
});
test('finished Shinobi matches require both peers to accept a fully reset rematch', async t => {
  const game = await host(t), room = await game.make(), { peer: a } = await game.peer(room), { peer: b } = await game.peer(room, 'Ren'); await fight(game, room, a, b);
  room.state.phase = 'matchEnd'; room.state.winner = 0; room.state.fighters[0].wins = 2; room.state.fighters[0].kunai = 0;
  const after = a.messages.length; a.send({ type: 'rematch' }); await a.untilState(m => m.state.phase === 'lobby' && m.players[0].ready, { after });
  assert.equal(room.players[1].ready, false); assert.equal(room.state.fighters[0].wins, 0); assert.equal(room.state.fighters[0].kunai, 3); await ready(a, b); assert.equal(room.state.round, 1);
});
test('Shinobi rooms isolate combat, reject third players, and leave empty lobbies unticked', async t => {
  const game = await host(t), first = await game.make(), second = await game.make(), empty = await game.make();
  const { peer: a } = await game.peer(first), { peer: b } = await game.peer(first, 'Ren'); await fight(game, first, a, b);
  const before = structuredClone(second.state), emptyBefore = structuredClone(empty.state); a.send({ type: 'input', seq: 0, buttons: { throw: true } }); await flushPeer(a); for (let i = 0; i < 16; i++) game.app.tick();
  assert.equal(first.state.fighters[0].kunai, 2); assert.deepEqual(second.state, before); assert.deepEqual(empty.state, emptyBefore); assert.equal(game.app.state.tick, 0);
  const third = game.third(first); const [code] = await once(third.socket, 'close'); assert.equal(code, 4403); assert.equal(first.players.filter(Boolean).length, 2);
});
