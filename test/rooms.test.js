import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { createServer } from '../server.js';
import { legalMoves } from '../public/checkers-engine.js';
import { Peer, flushPeer } from './ws-helper.js';

async function hub(t) {
  const app = createServer({ port: 0, host: '127.0.0.1', autoTick: false });
  await app.listen(0, '127.0.0.1');
  const origin = `http://127.0.0.1:${app.server.address().port}`;
  const peers = [];
  t.after(async () => {
    for (const peer of peers) peer.socket.terminate();
    await app.close();
  });
  return {
    app, origin,
    post(body) {
      return fetch(`${origin}/api/rooms`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    },
    async create(gameId, name) {
      const response = await this.post({ gameId, name });
      assert.equal(response.status, 201);
      const body = await response.json();
      assert.match(body.room.id, /^[A-Z0-9]{6}$/);
      assert.equal(body.room.gameId, gameId);
      return body.room;
    },
    async list() {
      const response = await fetch(`${origin}/api/rooms`);
      assert.equal(response.status, 200);
      return (await response.json()).rooms;
    },
    open(roomId) {
      const peer = new Peer(`${origin.replace('http:', 'ws:')}/ws?room=${encodeURIComponent(roomId)}`);
      peers.push(peer);
      return peer;
    },
    async join(roomId, name) {
      const peer = this.open(roomId);
      const welcome = await peer.connect();
      peer.send({ type: 'join', name });
      await peer.untilState(message => message.players[welcome.playerId]?.name === name);
      return { peer, welcome };
    },
  };
}

async function ready(first, second) {
  const after = first.messages.length;
  first.send({ type: 'ready', ready: true });
  second.send({ type: 'ready', ready: true });
  await first.untilState(message => message.state.phase === 'countdown', { after });
}

test('hub creates and lists every game type with unique room codes and correct welcomes', async t => {
  const game = await hub(t);
  const ids = new Set();
  for (const gameId of ['afterimage', 'checkers', 'relic-duel', 'dungeon-run', 'crazy-eights', 'twenty-one', 'memory', 'vector-arena']) {
    const room = await game.create(gameId, `${gameId} room`);
    assert.equal(room.name, `${gameId} room`);
    ids.add(room.id);
    const { welcome } = await game.join(room.id, `${gameId} player`);
    assert.equal(welcome.playerId, 0);
    assert.equal(welcome.roomId, room.id);
    assert.equal(welcome.gameId, gameId);
    assert.equal(welcome.tickRate, 120);
  }
  assert.equal(ids.size, 8);
  const listed = await game.list();
  assert.equal(listed.length, 8);
  assert.deepEqual(new Set(listed.map(room => room.id)), ids);
  assert.ok(listed.every(room => room.players[0]?.connected && room.phase === 'lobby'));
  assert.ok(listed.every(room => Number.isFinite(room.createdAt)));
});

test('room creation rejects invalid games, invalid JSON, and oversized bodies', async t => {
  const game = await hub(t);
  for (const body of [{ gameId: 'missing-game' }, { gameId: 'checkers', name: 123 }, {}, [], null]) {
    assert.equal((await game.post(body)).status, 400);
  }
  const invalidJson = await fetch(`${game.origin}/api/rooms`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' });
  assert.equal(invalidJson.status, 400);
  const oversized = await fetch(`${game.origin}/api/rooms`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameId: 'checkers', name: 'x'.repeat(5000) }) });
  assert.equal(oversized.status, 413);
});

test('room creation rate limit bounds repeated valid requests', async t => {
  const game = await hub(t);
  for (let count = 0; count < 20; count++) assert.equal((await game.post({ gameId: 'checkers' })).status, 201);
  const limited = await game.post({ gameId: 'checkers' });
  assert.equal(limited.status, 429);
  assert.equal((await game.list()).length, 20);
});

test('room names are bounded and room codes can be entered in lowercase', async t => {
  const game = await hub(t);
  const room = await game.create('checkers', `  Mina\n${'x'.repeat(80)}  `);
  assert.equal(room.name.length, 48);
  assert.equal(/[\u0000-\u001f\u007f]/.test(room.name), false);
  assert.equal(room.name.trim(), room.name);
  const { welcome } = await game.join(room.id.toLowerCase(), 'Mina');
  assert.equal(welcome.roomId, room.id);
  assert.equal(welcome.playerId, 0);
});

test('two full rooms have independent readiness, combat, inputs, and disconnect cleanup', async t => {
  const game = await hub(t);
  const roomA = await game.create('afterimage', 'Room A');
  const roomB = await game.create('afterimage', 'Room B');
  const { peer: a0 } = await game.join(roomA.id, 'A0');
  const { peer: a1 } = await game.join(roomA.id, 'A1');
  const { peer: b0 } = await game.join(roomB.id, 'B0');
  const { peer: b1 } = await game.join(roomB.id, 'B1');
  const a = game.app.rooms.get(roomA.id);
  const b = game.app.rooms.get(roomB.id);
  await ready(a0, a1);
  assert.equal(a.state.phase, 'countdown');
  assert.equal(b.state.phase, 'lobby');
  assert.equal(b.players.some(player => player.ready), false);
  a.state.phaseTicks = 1;
  game.app.tick();
  assert.equal(a.state.phase, 'fight');
  const initialB = b.state.fighters[0].x;
  a0.send({ type: 'input', seq: 0, buttons: { right: true } });
  await flushPeer(a0);
  game.app.tick();
  assert.equal(a.acks[0], 0);
  assert.equal(b.acks[0], -1);
  assert.ok(a.state.fighters[0].x > 390);
  assert.equal(b.state.fighters[0].x, initialB);
  assert.ok(b0.messages.filter(message => message.type === 'state').every(message => message.roomId === roomB.id));

  await ready(b0, b1);
  b.state.phaseTicks = 1;
  game.app.tick();
  b.state.fighters[0].hp = 77;
  const after = a0.messages.length;
  a1.socket.close();
  await a0.untilState(message => message.state.phase === 'lobby' && !message.players[1], { after });
  assert.equal(a.players[0].ready, false);
  assert.equal(b.state.phase, 'fight');
  assert.equal(b.state.fighters[0].hp, 77);
  assert.equal(b.players.every(player => player.connected), true);
});

test('full-room rejection is local to that room and unknown room codes are rejected', async t => {
  const game = await hub(t);
  const room = await game.create('checkers');
  await game.join(room.id, 'A');
  await game.join(room.id, 'B');
  const extra = game.open(room.id);
  const [fullCode] = await once(extra.socket, 'close');
  assert.equal(fullCode, 4403);
  const invalid = game.open('MISSING');
  const [invalidCode] = await once(invalid.socket, 'close');
  assert.equal(invalidCode, 4404);
  const other = await game.create('relic-duel');
  assert.equal((await game.join(other.id, 'C')).welcome.playerId, 0);
});

test('Checkers moves are authoritative, turn-bound, and cannot use action-game input', async t => {
  const game = await hub(t);
  const room = await game.create('checkers');
  const { peer: first } = await game.join(room.id, 'A');
  const { peer: second } = await game.join(room.id, 'B');
  await ready(first, second);
  const match = game.app.rooms.get(room.id);
  match.state.phaseTicks = 1;
  game.app.tick();
  const move = legalMoves(match.state, 0)[0];
  assert.ok(move);
  const boardBefore = JSON.stringify(match.state.board);
  let after = second.messages.length;
  second.send({ type: 'move', from: move.from, to: move.to });
  await second.waitFor(message => message.type === 'error', { after });
  assert.equal(JSON.stringify(match.state.board), boardBefore);
  after = first.messages.length;
  first.send({ type: 'input', seq: 0, buttons: { left: true } });
  await first.waitFor(message => message.type === 'error', { after });
  assert.equal(match.acks[0], -1);
  after = first.messages.length;
  first.send({ type: 'move', from: move.from, to: move.to });
  const moved = await first.untilState(message => !message.state.board[move.from] && message.state.board[move.to]?.owner === 0, { after });
  assert.equal(moved.state.turn, 1);
  assert.notEqual(JSON.stringify(match.state.board), boardBefore);
});

test('game adapters reject wrong control vocabularies and invalid move message shapes', async t => {
  const game = await hub(t);
  for (const [gameId, message] of [
    ['afterimage', { type: 'input', seq: 0, buttons: { shoot: true } }],
    ['relic-duel', { type: 'input', seq: 0, buttons: { jump: true } }],
    ['dungeon-run', { type: 'input', seq: 0, buttons: { heavy: true } }],
    ['checkers', { type: 'move', from: 2.5, to: 9 }],
    ['checkers', { type: 'move', from: -1, to: 64 }],
  ]) {
    const room = await game.create(gameId);
    const { peer } = await game.join(room.id, 'A');
    const after = peer.messages.length;
    peer.send(message);
    await peer.waitFor(packet => packet.type === 'error', { after });
    assert.equal(game.app.rooms.get(room.id).state.phase, 'lobby');
    assert.equal(game.app.rooms.get(room.id).acks[0], -1);
  }
});

test('unused rooms stop being listed after a minute and expire after ten minutes', async t => {
  const game = await hub(t);
  const info = await game.create('checkers');
  const room = game.app.rooms.get(info.id);
  const now = Date.now();
  room.createdAt = now - 60_001;
  room.emptySince = room.createdAt;
  assert.equal((await game.list()).some(item => item.id === info.id), false);
  game.app.reapRooms(now);
  assert.equal(game.app.rooms.has(info.id), true);
  room.createdAt = now - 600_001;
  room.emptySince = room.createdAt;
  game.app.reapRooms(now);
  assert.equal(game.app.rooms.has(info.id), false);
});

test('a disconnected empty room expires after a minute while active rooms survive', async t => {
  const game = await hub(t);
  const emptyInfo = await game.create('checkers');
  const activeInfo = await game.create('dungeon-run');
  const { peer } = await game.join(emptyInfo.id, 'Leaving');
  await game.join(activeInfo.id, 'Staying');
  const closed = once(peer.socket, 'close');
  peer.socket.close();
  await closed;
  // A following request runs after the close callback that releases the room.
  await game.list();
  const emptyRoom = game.app.rooms.get(emptyInfo.id);
  assert.ok(Number.isFinite(emptyRoom.emptySince));
  const activeRoom = game.app.rooms.get(activeInfo.id);
  activeRoom.createdAt = emptyRoom.emptySince - 700_000;
  game.app.reapRooms(emptyRoom.emptySince + 60_001);
  assert.equal(game.app.rooms.has(emptyInfo.id), false);
  assert.equal(game.app.rooms.has(activeInfo.id), true);
});

test('the hub has a hard total-room bound', async t => {
  const game = await hub(t);
  for (let count = 0; count < 100; count++) game.app.createRoom('checkers', `Room ${count}`);
  const response = await game.post({ gameId: 'checkers' });
  assert.equal(response.status, 503);
  assert.equal((await game.list()).length, 100);
});
