import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { createServer } from '../server.js';
import { Peer, flushPeer as flush } from './ws-helper.js';

async function host(t) {
  const app = createServer({ autoTick: false });
  await app.listen(0, '127.0.0.1');
  const origin = `http://127.0.0.1:${app.server.address().port}`, peers = [];
  t.after(async () => {
    for (const peer of peers) peer.socket.terminate();
    await app.close();
  });
  return {
    app, origin,
    async make(gameId = 'vector-arena') {
      const response = await fetch(`${origin}/api/rooms`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameId }) });
      assert.equal(response.status, 201);
      const { room } = await response.json();
      return app.rooms.get(room.id);
    },
    async peer(room, name = 'Mina') {
      const peer = new Peer(`${origin.replace('http:', 'ws:')}/ws?room=${room.id}`);
      peers.push(peer);
      const welcome = await peer.connect();
      peer.send({ type: 'join', name });
      await peer.untilState(message => message.players[welcome.playerId]?.name === name);
      return { peer, welcome };
    },
    third(room) {
      const peer = new Peer(`${origin.replace('http:', 'ws:')}/ws?room=${room.id}`);
      peers.push(peer);
      return peer;
    },
  };
}

async function ready(first, second) {
  const after = first.messages.length;
  first.send({ type: 'ready', ready: true });
  second.send({ type: 'ready', ready: true });
  return first.untilState(message => message.state.phase === 'countdown', { after });
}

async function fighting(game, room, first, second) {
  await ready(first, second);
  room.state.phaseTicks = 1;
  game.app.tick();
  assert.equal(room.state.phase, 'fight');
}

test('Vector is a PC-hosted room, and both ready players start a authoritative match', async t => {
  const game = await host(t), room = await game.make();
  const health = await (await fetch(`${game.origin}/health`)).json();
  assert.ok(health.games.includes('vector-arena'));
  assert.equal(health.tickRate, 120);
  assert.equal((await fetch(`${game.origin}/vector-engine.js`)).status, 200);
  const { peer: first, welcome } = await game.peer(room);
  const { peer: second, welcome: other } = await game.peer(room, 'Rook');
  assert.equal(welcome.gameId, 'vector-arena');
  assert.equal(other.playerId, 1);
  first.send({ type: 'ready', ready: true });
  const waiting = await first.untilState(message => message.players[0].ready);
  assert.equal(waiting.state.phase, 'lobby');
  await fighting(game, room, first, second);
  assert.ok(room.players.every(player => !player.ready));
  first.send({ type: 'input', seq: 0, buttons: { right: true, fire: true, focus: true, aimX: .6, aimY: .8 } });
  await flush(first);
  const x = room.state.fighters[0].x;
  game.app.tick();
  assert.equal(room.acks[0], 0);
  assert.ok(room.state.fighters[0].x > x);
  assert.equal(room.state.fighters[0].ammo, 5);
  assert.equal(room.state.fighters[0].aimX, .6);
  assert.equal(room.state.fighters[0].aimY, .8);
});

test('queued numeric aim frames are sanitized independently and consumed once per tick', async t => {
  const game = await host(t), room = await game.make();
  const { peer: first } = await game.peer(room), { peer: second } = await game.peer(room, 'Rook');
  await fighting(game, room, first, second);
  first.send({ type: 'input', seq: 0, buttons: { right: true, aimX: -.6, aimY: .8 } });
  first.send({ type: 'input', seq: 1, buttons: {} });
  first.send({ type: 'input', seq: 2, buttons: { left: true, aimX: 0, aimY: -1 } });
  await flush(first);
  assert.equal(room.acks[0], -1);
  const expected = [[-.6, .8, true, false], [1, 0, false, false], [0, -1, false, true]];
  for (let i = 0; i < expected.length; i++) {
    game.app.tick();
    const f = room.state.fighters[0], [x, y, right, left] = expected[i];
    assert.equal(room.acks[0], i);
    assert.equal(f.aimX, x); assert.equal(f.aimY, y);
    assert.equal(f.previousInput.right, right); assert.equal(f.previousInput.left, left);
    assert.equal(f.previousInput.fire, false);
  }
  first.send({ type: 'input', seq: 1, buttons: { fire: true, aimX: 1, aimY: 0 } });
  await flush(first); game.app.tick();
  assert.equal(room.acks[0], 2);
  assert.equal(room.state.fighters[0].ammo, 6);
  assert.equal(room.state.fighters[0].aimY, -1);
});

test('Vector rejects unbounded, nonnumeric, unknown, and nonboolean input without advancing sequence', async t => {
  const game = await host(t), room = await game.make();
  const { peer } = await game.peer(room);
  const invalid = [
    { aimX: 1.01 }, { aimY: -1.01 }, { aimX: '0.5' }, { aimY: null }, { aimX: true },
    { left: 1 }, { fire: 'yes' }, { focus: null }, { aimZ: 0 }, { hp: 10000 }, { toString: 0 },
  ];
  for (const buttons of invalid) {
    const after = peer.messages.length;
    peer.send({ type: 'input', seq: 0, buttons });
    await peer.waitFor(message => message.type === 'error', { after });
    assert.equal(room.slots[0].lastAccepted, -1);
    assert.equal(room.slots[0].queue.length, 0);
  }
  for (const raw of [
    '{"type":"input","seq":0,"buttons":{"aimX":1e999}}',
    '{"type":"input","seq":0,"buttons":{"__proto__":0}}',
  ]) {
    const after = peer.messages.length;
    peer.socket.send(raw);
    await peer.waitFor(message => message.type === 'error', { after });
  }
  peer.send({ type: 'input', seq: 0, buttons: { aimX: -1, aimY: 1, focus: false } });
  await flush(peer); game.app.tick();
  assert.equal(room.acks[0], 0);
  assert.equal(room.slots[0].buttons.aimX, -1);
  assert.equal(room.state.fighters[0].hp, 100);
});

test('numeric aim remains forbidden for every earlier realtime game', async t => {
  const game = await host(t);
  for (const id of ['afterimage', 'relic-duel', 'dungeon-run']) {
    const room = await game.make(id), { peer } = await game.peer(room);
    const after = peer.messages.length;
    peer.send({ type: 'input', seq: 0, buttons: { aimX: .5, left: true } });
    const error = await peer.waitFor(message => message.type === 'error', { after });
    assert.match(error.message, /boolean/);
    assert.equal(room.slots[0].lastAccepted, -1);
    peer.send({ type: 'input', seq: 0, buttons: { left: true } });
    await flush(peer); game.app.tick();
    assert.equal(room.acks[0], 0);
  }
});

test('aim frames preserve bounded queue and sequence guards, including retry after draining', async t => {
  const game = await host(t), room = await game.make();
  const { peer } = await game.peer(room);
  let after = peer.messages.length;
  peer.send({ type: 'input', seq: 601, buttons: { aimX: 0, aimY: 1 } });
  await peer.waitFor(message => message.type === 'error' && /ahead/.test(message.message), { after });
  for (const seq of [-1, .5, 1_000_000_001]) {
    after = peer.messages.length;
    peer.send({ type: 'input', seq, buttons: { aimX: 1, aimY: 0 } });
    await peer.waitFor(message => message.type === 'error' && /sequence/.test(message.message), { after });
  }
  after = peer.messages.length;
  for (let seq = 0; seq <= 60; seq++) peer.send({ type: 'input', seq, buttons: { aimX: 0, aimY: 1 } });
  await flush(peer);
  await peer.waitFor(message => message.type === 'error' && /queue.*full/i.test(message.message), { after });
  assert.equal(room.slots[0].queue.length, 60);
  assert.equal(room.slots[0].lastAccepted, 59);
  for (let i = 0; i < 60; i++) game.app.tick();
  peer.send({ type: 'input', seq: 60, buttons: { aimX: -1, aimY: 0 } });
  await flush(peer); game.app.tick();
  assert.equal(room.acks[0], 60);
  assert.equal(room.slots[0].buttons.aimX, -1);
});

test('stale input releases held movement and fire after the disconnect grace window', async t => {
  const game = await host(t), room = await game.make();
  const { peer: first } = await game.peer(room), { peer: second } = await game.peer(room, 'Rook');
  await fighting(game, room, first, second);
  first.send({ type: 'input', seq: 0, buttons: { right: true, fire: true, aimX: 0, aimY: -1 } });
  await flush(first); game.app.tick();
  assert.equal(room.state.fighters[0].ammo, 5);
  await new Promise(resolve => setTimeout(resolve, 380));
  for (let i = 0; i < 50; i++) game.app.tick();
  assert.equal(room.state.fighters[0].previousInput.fire, false);
  assert.equal(room.state.fighters[0].previousInput.right, false);
  assert.equal(room.state.fighters[0].ammo, 5);
  assert.ok(Math.abs(room.state.fighters[0].vx) < 1e-6);
  assert.equal(room.acks[0], 0);
});

test('unready and midfight disconnect reset Vector resources and release the vacant slot', async t => {
  const game = await host(t), room = await game.make();
  const { peer: first } = await game.peer(room), { peer: second } = await game.peer(room, 'Rook');
  await ready(first, second);
  let after = first.messages.length;
  first.send({ type: 'ready', ready: false });
  await first.untilState(message => message.state.phase === 'lobby' && !message.players[0].ready, { after });
  assert.equal(room.state.fighters[0].ammo, 6);
  await fighting(game, room, first, second);
  room.state.fighters[0].hp = 42; room.state.fighters[0].ammo = 1; room.state.fighters[0].wins = 1;
  first.send({ type: 'input', seq: 0, buttons: { fire: true, aimX: 1, aimY: 0 } });
  await flush(first);
  after = first.messages.length;
  second.socket.close();
  await first.untilState(message => message.state.phase === 'lobby' && !message.players[1]?.connected, { after });
  assert.equal(room.state.fighters[0].hp, 100);
  assert.equal(room.state.fighters[0].ammo, 6);
  assert.equal(room.state.fighters[0].wins, 0);
  assert.equal(room.slots[0].queue.length, 0);
  assert.equal(room.slots[0].buttons.fire, false);
  assert.equal(room.players[0].ready, false);
  const replacement = await game.peer(room, 'Vale');
  assert.equal(replacement.welcome.playerId, 1);
});

test('separate Vector rooms isolate scores, aim, fire, readiness, and player slots', async t => {
  const game = await host(t), firstRoom = await game.make(), secondRoom = await game.make();
  const { peer: a } = await game.peer(firstRoom, 'A'), { peer: b } = await game.peer(firstRoom, 'B');
  const { peer: c } = await game.peer(secondRoom, 'C'), { peer: d } = await game.peer(secondRoom, 'D');
  await fighting(game, firstRoom, a, b);
  const secondBefore = structuredClone(secondRoom.state.fighters);
  a.send({ type: 'input', seq: 0, buttons: { fire: true, aimX: .6, aimY: -.8 } });
  await flush(a); game.app.tick();
  assert.equal(firstRoom.state.fighters[0].ammo, 5);
  assert.deepEqual(secondRoom.state.fighters, secondBefore);
  assert.equal(secondRoom.state.phase, 'lobby');
  assert.equal(secondRoom.acks[0], -1);
  assert.equal(game.app.state.phase, 'lobby');
  await fighting(game, secondRoom, c, d);
  secondRoom.state.fighters[1].hp = 18;
  secondRoom.state.projectiles.push({ id: 1, owner: 0, x: 780, y: 320, px: 780, py: 320, vx: 60, vy: 0, radius: 3, damage: 18, life: 10 });
  game.app.tick();
  assert.equal(secondRoom.state.fighters[0].wins, 1);
  assert.equal(firstRoom.state.fighters[0].wins, 0);
  assert.notEqual(firstRoom.sessionId, secondRoom.sessionId);
  const third = game.third(firstRoom);
  const [code] = await once(third.socket, 'close');
  assert.equal(code, 4403);
  assert.equal(firstRoom.players.filter(Boolean).length, 2);
});

test('finished Vector matches require both players to accept the rematch', async t => {
  const game = await host(t), room = await game.make();
  const { peer: first } = await game.peer(room), { peer: second } = await game.peer(room, 'Rook');
  await fighting(game, room, first, second);
  room.state.phase = 'matchEnd'; room.state.winner = 0; room.state.fighters[0].wins = 2;
  let after = first.messages.length;
  first.send({ type: 'rematch' });
  await first.untilState(message => message.state.phase === 'lobby' && message.players[0].ready, { after });
  assert.equal(room.players[1].ready, false);
  assert.equal(room.state.fighters[0].wins, 0);
  assert.equal(room.state.fighters[0].ammo, 6);
  after = first.messages.length;
  second.send({ type: 'rematch' });
  await first.untilState(message => message.state.phase === 'countdown', { after });
  assert.equal(room.state.round, 1);
});
