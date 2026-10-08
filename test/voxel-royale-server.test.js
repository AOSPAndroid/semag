import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { createServer } from '../server.js';
import * as Royale from '../public/voxel-royale-engine.js';
import { Peer, flushPeer } from './ws-helper.js';

async function host(t) {
  const app = createServer({ autoTick: false, creationLimit: 100 });
  await app.listen(0, '127.0.0.1');
  const origin = `http://127.0.0.1:${app.server.address().port}`, peers = [];
  t.after(async () => { for (const peer of peers) peer.socket.terminate(); await app.close(); });
  return { app, origin,
    post(body) {
      return fetch(`${origin}/api/rooms`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    },
    async make(capacity = 10, mapId = 'forest') {
      const response = await this.post({ gameId: 'voxel-royale', capacity, mapId });
      assert.equal(response.status, 201);
      const { room } = await response.json();
      return app.rooms.get(room.id);
    },
    socket(room, suffix = '') {
      const peer = new Peer(`${origin.replace('http:', 'ws:')}/ws?room=${room.id}${suffix}`);
      peers.push(peer); return peer;
    },
    async peer(room, name = 'Runner') {
      const peer = this.socket(room), welcome = await peer.connect();
      peer.send({ type: 'join', name });
      await peer.untilState(message => message.players[welcome.playerId]?.name === name);
      return { peer, welcome };
    },
  };
}

async function rejected(peer, data, expected) {
  const after = peer.messages.length; peer.send(data);
  const response = await peer.waitFor(message => message.type === 'error', { after });
  assert.match(response.message, expected);
  return response;
}

async function start(room, seat) {
  const after = seat.peer.messages.length;
  seat.peer.send({ type: 'start' });
  await seat.peer.untilState(message => message.state.phase === 'countdown', { after });
  assert.equal(room.state.phase, 'countdown');
}

function advance(app, room, phase, maximum = 1000) {
  let ticks = 0;
  while (room.state.phase !== phase && ticks++ < maximum) app.tick();
  assert.equal(room.state.phase, phase, `Expected ${phase} after at most ${maximum} ticks`);
}

async function disconnect(seat, survivor, predicate) {
  const after = survivor.peer.messages.length; seat.peer.socket.close();
  return survivor.peer.untilState(predicate, { after });
}

test('Royale defaults to ten seats and exposes its map and server-assigned host in room and socket metadata', async t => {
  const game = await host(t), response = await game.post({ gameId: 'voxel-royale' });
  assert.equal(response.status, 201);
  const { room: initial } = await response.json(), room = game.app.rooms.get(initial.id);
  assert.equal(initial.capacity, 10); assert.equal(initial.mapId, 'forest');
  assert.equal(initial.mapName, Royale.MAPS.forest.name); assert.equal(initial.hostId, null);
  for (const key of ['players', 'slots', 'acks']) assert.equal(room[key].length, 10);
  const seat = await game.peer(room, 'Host');
  assert.equal(seat.welcome.gameId, 'voxel-royale'); assert.equal(seat.welcome.capacity, 10);
  assert.equal(seat.welcome.mapId, 'forest'); assert.equal(seat.welcome.hostId, 0);
  assert.equal(seat.welcome.tickRate, 120); assert.equal(seat.welcome.sessionId, room.sessionId);
  const state = await seat.peer.untilState(message => message.hostId === 0);
  assert.equal(Object.hasOwn(state.state, 'map'), false, 'static geometry stays out of repeated snapshots');
  assert.equal(Object.hasOwn(state.state, 'fighters'), false, 'legacy alias stays out of repeated snapshots');
  const listed = await (await fetch(`${game.origin}/api/rooms`)).json();
  const summary = listed.rooms.find(candidate => candidate.id === room.id);
  assert.equal(summary.hostId, 0); assert.equal(summary.mapName, initial.mapName);
  assert.equal(summary.players[0].name, 'Host');
  const health = await (await fetch(`${game.origin}/health`)).json();
  assert.ok(health.games.includes('voxel-royale'));
});

test('Royale rejects malformed capacity, unavailable maps and team or client authority settings', async t => {
  const game = await host(t);
  for (const extra of [
    { capacity: 1 }, { capacity: 11 }, { capacity: 2.5 }, { capacity: '10' }, { capacity: null },
    { capacity: false }, { mapId: 'courtyard' }, { mapId: '__proto__' }, { mapId: null },
    { mapId: [] }, { teamSize: 1 }, { hostId: 0 }, { seed: 1 }, { settings: {} },
  ]) {
    const response = await game.post({ gameId: 'voxel-royale', ...extra });
    assert.equal(response.status, 400, JSON.stringify(extra));
    assert.equal(game.app.rooms.size, 0);
  }
  for (const capacity of [2, 10]) for (const mapId of ['forest', 'maze', 'desert']) {
    const room = await game.make(capacity, mapId);
    assert.equal(room.capacity, capacity); assert.equal(room.mapName, Royale.MAPS[mapId].name);
  }
  assert.throws(() => game.app.createRoom('voxel-royale', undefined, { capacity: 2, hostId: 0 }), /only a player capacity/);
  assert.throws(() => game.app.createRoom('voxel-royale', undefined, { capacity: 11 }), /2 to 10/);
});

test('Only the host can start with at least two players; ten-seat rooms can start with two without ready gates', async t => {
  const game = await host(t), room = await game.make(), hostSeat = await game.peer(room, 'Host');
  await rejected(hostSeat.peer, { type: 'start' }, /At least two/);
  assert.equal(room.state.phase, 'lobby');
  const other = await game.peer(room, 'Rival');
  await rejected(other.peer, { type: 'start' }, /Only the room host/);
  await rejected(hostSeat.peer, { type: 'start', hostId: 1 }, /no player, map, or inventory overrides/);
  for (const seat of [hostSeat, other]) seat.peer.send({ type: 'ready', ready: true });
  await flushPeer(other.peer);
  for (let tick = 0; tick < 400; tick++) game.app.tick();
  assert.equal(room.state.phase, 'lobby', 'readiness never auto-starts a Royale match');
  await start(room, hostSeat);
  assert.deepEqual(room.state.participantIds, [0, 1]);
  assert.equal(room.capacity, 10);
  assert.ok(room.state.players.slice(2).every(player => !player.alive), 'empty seats are never opponents');
  await rejected(other.peer, { type: 'ready', ready: false }, /only in the Voxel Royale lobby/);
  await rejected(hostSeat.peer, { type: 'start' }, /only from the lobby/);
  assert.equal(room.state.phase, 'countdown');
  advance(game.app, room, 'fight');
  assert.ok(room.players.every(player => !player || !player.ready));
});

test('Royale admits ten players, rejects an eleventh, and locks fresh joins in countdown and combat', async t => {
  const game = await host(t), room = await game.make(), seats = [];
  for (let id = 0; id < 10; id++) {
    const seat = await game.peer(room, `Runner ${id + 1}`); seats.push(seat);
    assert.equal(seat.welcome.playerId, id); assert.equal(seat.welcome.hostId, 0);
  }
  let overflow = game.socket(room), closed = await once(overflow.socket, 'close');
  assert.equal(closed[0], 4403);
  assert.match(overflow.messages.find(message => message.type === 'error').message, /10 players/);
  await start(room, seats[0]);
  assert.deepEqual(room.state.participantIds, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  overflow = game.socket(room, '&hostId=0&sessionToken=forged'); closed = await once(overflow.socket, 'close');
  assert.equal(closed[0], 4409); assert.equal(room.hostId, 0);
  assert.match(overflow.messages.find(message => message.type === 'error').message, /already started/);
  advance(game.app, room, 'fight');
  overflow = game.socket(room); closed = await once(overflow.socket, 'close');
  assert.equal(closed[0], 4409);
  assert.equal(room.players.filter(player => player?.connected).length, 10);
});

test('Combat disconnect eliminates only that runner, migrates the host and resolves the surviving winner', async t => {
  const game = await host(t), room = await game.make(), seats = [];
  for (let id = 0; id < 3; id++) seats.push(await game.peer(room, `Runner ${id}`));
  await start(room, seats[0]); advance(game.app, room, 'fight');
  seats[1].peer.send({ type: 'input', seq: 0, buttons: { up: true, yaw: .2 } });
  await flushPeer(seats[1].peer); game.app.tick();
  const survivor = room.state.players[1], position = [survivor.x, survivor.y, survivor.z];
  const update = await disconnect(seats[0], seats[1], message => message.hostId === 1 && message.players[0]?.connected === false);
  assert.equal(update.state.phase, 'fight'); assert.equal(room.state.players[0].alive, false);
  assert.equal(room.state.players[1].alive, true); assert.equal(room.state.players[2].alive, true);
  assert.deepEqual([survivor.x, survivor.y, survivor.z], position, 'disconnect never resets surviving positions');
  assert.equal(room.slots[1].buttons.up, true, 'surviving inputs are not cleared');
  assert.equal(room.players[0].name, 'Runner 0'); assert.equal(room.players[0].ready, false);
  assert.equal(room.acks[0], -1);
  assert.deepEqual(room.state.participantIds, [0, 1, 2], 'participants remain locked for the completed match');
  const listed = await (await fetch(`${game.origin}/api/rooms`)).json();
  assert.equal(listed.rooms.find(candidate => candidate.id === room.id).hostId, 1);
  await disconnect(seats[2], seats[1], message => message.state.phase === 'matchEnd');
  assert.equal(room.state.winnerId, 1); assert.equal(room.state.players[2].alive, false);
  assert.equal(room.hostId, 1);
});

test('Countdown disconnect preserves a viable match and grants a sole survivor a win', async t => {
  const game = await host(t), room = await game.make(), seats = [];
  for (let id = 0; id < 3; id++) seats.push(await game.peer(room));
  await start(room, seats[0]);
  await disconnect(seats[2], seats[0], message => message.players[2]?.connected === false);
  assert.equal(room.state.phase, 'countdown');
  await disconnect(seats[0], seats[1], message => message.state.phase === 'matchEnd');
  assert.equal(room.hostId, 1); assert.equal(room.state.winnerId, 1);
});

test('Only the migrated host opens the rematch lobby; fresh runners join only after that reset', async t => {
  const game = await host(t), room = await game.make(4, 'maze'), seats = [];
  for (let id = 0; id < 3; id++) seats.push(await game.peer(room, `Runner ${id}`));
  await start(room, seats[0]); advance(game.app, room, 'fight');
  await rejected(seats[0].peer, { type: 'rematch' }, /Finish the current match/);
  await disconnect(seats[0], seats[1], message => message.hostId === 1);
  await disconnect(seats[2], seats[1], message => message.state.phase === 'matchEnd');
  const late = game.socket(room), [code] = await once(late.socket, 'close');
  assert.equal(code, 4409);
  await rejected(seats[1].peer, { type: 'rematch', participantIds: [1] }, /no player, map, or inventory overrides/);
  const after = seats[1].peer.messages.length; seats[1].peer.send({ type: 'rematch' });
  await seats[1].peer.untilState(message => message.state.phase === 'lobby', { after });
  assert.equal(room.hostId, 1); assert.equal(room.players[0], null); assert.equal(room.players[2], null);
  assert.ok(room.players.every(player => !player || !player.ready));
  assert.equal(room.slots[1].queue.length, 0); assert.equal(room.slots[1].buttons.up, false);
  assert.equal(room.state.mapId, 'maze'); assert.equal(room.capacity, 4);
  const replacement = await game.peer(room, 'Replacement');
  assert.equal(replacement.welcome.playerId, 0); assert.equal(replacement.welcome.hostId, 1);
  await rejected(replacement.peer, { type: 'rematch' }, /Only the room host/);
  await rejected(replacement.peer, { type: 'start' }, /Only the room host/);
  await start(room, seats[1]);
  assert.deepEqual(room.state.participantIds, [0, 1]);
  assert.equal(room.state.players[0].alive, true, 'replacement gets a fresh life only in the new match');
});

test('Lobby host departure migrates to the lowest connected slot and an empty room returns safely to the lobby', async t => {
  const game = await host(t), room = await game.make(3), seats = [];
  for (let id = 0; id < 3; id++) seats.push(await game.peer(room));
  await disconnect(seats[0], seats[2], message => message.hostId === 1 && message.players[0] === null);
  const replacement = await game.peer(room);
  assert.equal(replacement.welcome.playerId, 0); assert.equal(replacement.welcome.hostId, 1);
  await start(room, seats[1]);
  await disconnect(seats[1], seats[2], message => message.hostId === 0);
  assert.equal(room.state.phase, 'countdown');
  await disconnect(seats[2], replacement, message => message.state.phase === 'matchEnd');
  const serverClosed = once(room.slots[0].ws, 'close');
  replacement.peer.socket.close(); await serverClosed;
  assert.equal(room.hostId, null); assert.equal(room.state.phase, 'lobby');
  assert.ok(room.players.every(player => player === null));
  assert.ok(room.emptySince > 0);
});

test('Royale shares validated latest FPS inputs without accepting loot, health or loadout authority', async t => {
  const game = await host(t), room = await game.make(), { peer } = await game.peer(room);
  await rejected(peer, { type: 'fps-loadout', weaponId: 'sniper' }, /Pick up weapons/);
  await rejected(peer, { type: 'fps-team', team: 0 }, /free-for-all/);
  for (const buttons of [
    { yaw: Math.PI + .01 }, { pitch: -1.36 }, { yaw: '0' }, { pitch: null },
    { fire: 1 }, { jump: 'yes' }, { hp: 999 }, { potions: 99 }, { weapon: 'sniper' },
    { ammo: 1000 }, { loot: 'sniper' }, { x: 10 }, { interact: 'yes' },
  ]) {
    await rejected(peer, { type: 'input', seq: 0, buttons }, /boolean controls, yaw/);
    assert.equal(room.slots[0].lastAccepted, -1);
  }
  for (const seq of [-1, 1.5, 601, 1_000_000_001]) {
    await rejected(peer, { type: 'input', seq, buttons: {} }, /sequence/);
    assert.equal(room.slots[0].lastAccepted, -1);
  }
  for (const [seq, buttons] of [[0, { up: true, yaw: -.5, pitch: .4 }], [1, { fire: true, yaw: 1.2 }], [2, { jump: true }]]) peer.send({ type: 'input', seq, buttons });
  await flushPeer(peer); assert.equal(room.slots[0].queue.length, 1); game.app.tick();
  assert.equal(room.acks[0], 2); assert.equal(room.slots[0].buttons.yaw, 1.2);
  assert.equal(room.slots[0].buttons.pitch, .4); assert.equal(room.slots[0].buttons.jump, true);
  assert.equal(room.slots[0].buttons.fire, false);
  peer.send({ type: 'input', seq: 3, buttons: { fire: true, heal: true, yaw: -.8, pitch: .2 } });
  await flushPeer(peer); room.slots[0].lastInputTime -= 351; game.app.tick();
  assert.equal(room.acks[0], 3); assert.equal(room.slots[0].queue.length, 0);
  assert.equal(room.slots[0].buttons.fire, false); assert.equal(room.slots[0].buttons.heal, false);
  assert.equal(room.slots[0].buttons.yaw, -.8); assert.equal(room.slots[0].buttons.pitch, .2);
});

test('Royale host starts and disconnect rules do not change Breach or legacy ready-to-play rooms', async t => {
  const game = await host(t), breach = game.app.createRoom('voxel-breach', 'Breach', { teamSize: 1, mapId: 'courtyard' });
  const seats = [await game.peer(breach), await game.peer(breach)];
  assert.equal(Object.hasOwn(breach, 'hostId'), false);
  await rejected(seats[0].peer, { type: 'start' }, /all players are ready/);
  assert.equal(breach.state.phase, 'lobby');
  for (const seat of seats) seat.peer.send({ type: 'ready', ready: true });
  await seats[0].peer.untilState(message => message.state.phase === 'countdown');
  await disconnect(seats[1], seats[0], message => message.state.phase === 'lobby' && message.players[1] === null);
  assert.equal(breach.players[0].ready, false);
  const duel = game.app.createRoom('afterimage');
  const duelSeats = [await game.peer(duel), await game.peer(duel)];
  await rejected(duelSeats[0].peer, { type: 'start' }, /all players are ready/);
  for (const seat of duelSeats) seat.peer.send({ type: 'ready', ready: true });
  await duelSeats[0].peer.untilState(message => message.state.phase === 'countdown');
  assert.equal(duel.capacity, 2); assert.equal(Object.hasOwn(duel, 'hostId'), false);
});
