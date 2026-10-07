import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { createServer } from '../server.js';
import * as Voxel from '../public/voxel-engine.js';
import { Peer, flushPeer } from './ws-helper.js';

async function host(t) {
  const app = createServer({ autoTick: false, creationLimit: 100 });
  await app.listen(0, '127.0.0.1');
  const origin = `http://127.0.0.1:${app.server.address().port}`, peers = [];
  t.after(async () => { for (const peer of peers) peer.socket.terminate(); await app.close(); });
  return { app, origin,
    async post(body) {
      return fetch(`${origin}/api/rooms`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    },
    async make(teamSize = 1, mapId = 'courtyard') {
      const response = await this.post({ gameId: 'voxel-breach', teamSize, mapId });
      assert.equal(response.status, 201);
      const { room } = await response.json();
      return app.rooms.get(room.id);
    },
    socket(room) {
      const peer = new Peer(`${origin.replace('http:', 'ws:')}/ws?room=${room.id}`);
      peers.push(peer); return peer;
    },
    async peer(room, name = 'Rook') {
      const peer = this.socket(room), welcome = await peer.connect();
      peer.send({ type: 'join', name });
      await peer.untilState(message => message.players[welcome.playerId]?.name === name);
      return { peer, welcome };
    },
    async fill(room) {
      const result = [];
      for (let id = 0; id < room.capacity; id++) result.push(await this.peer(room, `Player ${id + 1}`));
      return result;
    },
  };
}

async function readyEveryone(room, seats) {
  const after = seats[0].peer.messages.length;
  for (const { peer } of seats) peer.send({ type: 'ready', ready: true });
  await seats[0].peer.untilState(message => message.state.phase === 'countdown', { after });
  assert.ok(room.players.every(player => player.ready));
}

function advance(app, room, phase, maximum = 2_000) {
  let ticks = 0;
  while (room.state.phase !== phase && ticks++ < maximum) app.tick();
  assert.equal(room.state.phase, phase, `Expected ${phase} after at most ${maximum} ticks`);
}

async function inputFrames(game, room, seat, buttons, ticks) {
  seat.sequence = (seat.sequence ?? -1) + 1;
  seat.peer.send({ type: 'input', seq: seat.sequence, buttons });
  await flushPeer(seat.peer);
  for (let tick = 0; tick < ticks; tick++) game.app.tick();
}

async function walkRoute(game, room, seat, waypoints) {
  const id = seat.welcome.playerId;
  for (const [x, z, tolerance = .35] of waypoints) {
    let attempts = 0;
    while (Math.hypot(room.state.players[id].x - x, room.state.players[id].z - z) > tolerance && attempts++ < 100) {
      const player = room.state.players[id], distance = Math.hypot(x - player.x, z - player.z);
      await inputFrames(game, room, seat, { up: true, yaw: Math.atan2(x - player.x, -(z - player.z)), pitch: 0 }, Math.max(1, Math.min(48, Math.floor(distance / 5.4 * 120))));
    }
    assert.ok(attempts < 100, `Player ${id} could not reach ${x},${z}; was ${room.state.players[id].x},${room.state.players[id].z}`);
    await inputFrames(game, room, seat, {}, 20);
  }
}

for (const teamSize of [1, 2, 3]) {
  test(`Voxel ${teamSize}v${teamSize} admits exactly ${teamSize * 2} seats and requires every connected player ready`, async t => {
    const game = await host(t), room = await game.make(teamSize, ['courtyard', 'depot', 'canal'][teamSize - 1]);
    assert.equal(room.capacity, teamSize * 2);
    for (const key of ['players', 'slots', 'acks']) assert.equal(room[key].length, room.capacity);
    assert.equal(room.state.players.length, room.capacity);
    const seats = await game.fill(room);
    for (let id = 0; id < room.capacity; id++) {
      assert.equal(seats[id].welcome.playerId, id);
      assert.equal(seats[id].welcome.capacity, room.capacity);
      assert.equal(seats[id].welcome.teamSize, teamSize);
      assert.equal(seats[id].welcome.mapId, room.mapId);
      assert.equal(seats[id].welcome.mapName, Voxel.MAPS[room.mapId].name);
      assert.equal(room.players[id].team, id < teamSize ? 0 : 1);
      assert.equal(room.state.players[id].team, room.players[id].team);
    }
    for (let id = 0; id < seats.length - 1; id++) seats[id].peer.send({ type: 'ready', ready: true });
    await flushPeer(seats.at(-2).peer);
    for (let tick = 0; tick < 400; tick++) game.app.tick();
    assert.equal(room.state.phase, 'lobby');
    const overflow = game.socket(room), [code] = await once(overflow.socket, 'close');
    assert.equal(code, 4403);
    assert.equal(room.players.filter(Boolean).length, room.capacity);
    await readyEveryone(room, seats);
    for (let tick = 0; tick < 359; tick++) game.app.tick();
    assert.equal(room.state.phase, 'countdown');
    game.app.tick();
    assert.equal(room.state.phase, 'buy');
    assert.ok(room.players.every(player => !player.ready));
    advance(game.app, room, 'fight');
    const listed = await (await fetch(`${game.origin}/api/rooms`)).json();
    const summary = listed.rooms.find(item => item.id === room.id);
    assert.equal(summary.capacity, room.capacity);
    assert.equal(summary.teamSize, teamSize);
    assert.equal(summary.mapId, room.mapId);
    assert.equal(summary.players.length, room.capacity);
  });
}

test('Voxel validates explicit modes, maps and room fields without silently changing the requested match', async t => {
  const game = await host(t);
  for (const extra of [
    { teamSize: 0 }, { teamSize: 4 }, { teamSize: 1.5 }, { teamSize: '2' }, { teamSize: null },
    { mapId: 'missing' }, { mapId: '__proto__' }, { mapId: '' }, { mapId: null }, { mapId: 1 },
    { mode: '5v5' }, { capacity: 100 }, { teamSize: 2, name: false },
  ]) {
    const response = await game.post({ gameId: 'voxel-breach', ...extra });
    assert.equal(response.status, 400, JSON.stringify(extra));
    assert.equal(game.app.rooms.size, 0);
  }
  const defaults = await game.post({ gameId: 'voxel-breach' });
  assert.equal(defaults.status, 201);
  const { room } = await defaults.json();
  assert.equal(room.teamSize, 1); assert.equal(room.mapId, 'courtyard');
  for (const body of [{ gameId: 'afterimage', teamSize: 3 }, { gameId: 'checkers', mapId: 'canal' }]) {
    assert.equal((await game.post(body)).status, 400);
  }
});

test('Voxel rejects nonfinite angles, unknown controls and invalid sequences without acknowledging them', async t => {
  const game = await host(t), room = await game.make(), { peer } = await game.peer(room);
  for (const buttons of [
    { yaw: Math.PI + .001 }, { yaw: -Math.PI - .001 }, { pitch: 1.351 }, { pitch: -1.351 },
    { yaw: '0' }, { pitch: null }, { fire: 1 }, { jump: 'yes' }, { aim: 1 }, { swap: 'sword' }, { grenade: 2 }, { heal: 'yes' },
    { hp: 200 }, { aimX: 1 }, { weapon: 'marksman' }, { potions: 99 }, { grenades: 99 },
  ]) {
    const after = peer.messages.length;
    peer.send({ type: 'input', seq: 0, buttons });
    await peer.waitFor(message => message.type === 'error', { after });
    assert.equal(room.slots[0].lastAccepted, -1);
  }
  for (const raw of ['{"type":"input","seq":0,"buttons":{"yaw":1e999}}', '{"type":"input","seq":0,"buttons":{"__proto__":true}}']) {
    const after = peer.messages.length; peer.socket.send(raw);
    await peer.waitFor(message => message.type === 'error', { after });
    assert.equal(room.slots[0].lastAccepted, -1);
  }
  for (const seq of [-1, 1.5, 1_000_000_001, 601]) {
    const after = peer.messages.length; peer.send({ type: 'input', seq, buttons: {} });
    await peer.waitFor(message => message.type === 'error', { after });
    assert.equal(room.slots[0].lastAccepted, -1);
  }
  peer.send({ type: 'input', seq: 0, buttons: { yaw: Math.PI, pitch: -1.35, fire: false, jump: false } });
  await flushPeer(peer); game.app.tick();
  assert.equal(room.acks[0], 0);
  assert.equal(room.slots[0].buttons.yaw, Math.PI);
  assert.equal(room.slots[0].buttons.pitch, -1.35);
});

test('Voxel uses fresh aim commands immediately and neutralizes stale buttons while retaining aim', async t => {
  const game = await host(t), room = await game.make(), { peer } = await game.peer(room);
  const spawnYaw = room.state.players[0].yaw;
  game.app.tick(); assert.equal(room.slots[0].buttons.yaw, spawnYaw);
  for (const [seq, buttons] of [[0, { up: true, fire: true, yaw: -.8, pitch: .4 }], [1, { right: true, yaw: 1.2 }], [2, { left: true }]]) {
    peer.send({ type: 'input', seq, buttons });
  }
  await flushPeer(peer);
  assert.equal(room.slots[0].queue.length, 1);
  game.app.tick();
  assert.equal(room.acks[0], 2);
  assert.equal(room.slots[0].buttons.yaw, 1.2);
  assert.equal(room.slots[0].buttons.pitch, .4);
  assert.equal(room.slots[0].buttons.left, true);
  assert.equal(room.slots[0].buttons.fire, false);
  peer.send({ type: 'input', seq: 1, buttons: { fire: true, yaw: 0 } });
  await flushPeer(peer); game.app.tick();
  assert.equal(room.acks[0], 2); assert.equal(room.slots[0].buttons.yaw, 1.2);
  peer.send({ type: 'input', seq: 3, buttons: { fire: true, up: true, yaw: -2, pitch: .8 } });
  await flushPeer(peer);
  room.slots[0].lastInputTime -= 351;
  game.app.tick();
  assert.equal(room.acks[0], 3);
  assert.equal(room.slots[0].queue.length, 0);
  assert.equal(room.slots[0].buttons.fire, false); assert.equal(room.slots[0].buttons.up, false);
  assert.equal(room.slots[0].buttons.yaw, -2); assert.equal(room.slots[0].buttons.pitch, .8);
  peer.send({ type: 'input', seq: 4, buttons: { crouch: true } });
  await flushPeer(peer); game.app.tick();
  assert.equal(room.slots[0].buttons.yaw, -2); assert.equal(room.slots[0].buttons.crouch, true);
  room.slots[0].lastInputTime -= 351; game.app.tick();
  assert.equal(room.slots[0].buttons.crouch, false); assert.equal(room.slots[0].buttons.yaw, -2);
});

test('Voxel unready cancels a six-player countdown and disconnect/rejoin resets every ready flag and queued command', async t => {
  const game = await host(t), room = await game.make(3), seats = await game.fill(room);
  await readyEveryone(room, seats);
  let after = seats[0].peer.messages.length;
  seats[4].peer.send({ type: 'ready', ready: false });
  await seats[0].peer.untilState(message => message.state.phase === 'lobby', { after });
  assert.ok(room.players.every(player => !player.ready));
  await readyEveryone(room, seats); advance(game.app, room, 'fight');
  seats[0].peer.send({ type: 'input', seq: 0, buttons: { fire: true, up: true, yaw: .2 } });
  await flushPeer(seats[0].peer);
  after = seats[0].peer.messages.length; seats[2].peer.socket.close();
  await seats[0].peer.untilState(message => message.state.phase === 'lobby' && message.players[2] === null, { after });
  assert.equal(room.slots[0].queue.length, 0);
  assert.equal(room.slots[0].buttons.fire, false);
  assert.ok(room.players.every(player => player === null || !player.ready));
  assert.equal(room.acks[2], -1);
  assert.equal(room.state.capacity, 6);
  const replacement = await game.peer(room, 'Replacement');
  assert.equal(replacement.welcome.playerId, 2);
  assert.equal(room.players[2].team, 0);
  assert.equal(room.slots[2].lastAccepted, -1);
  seats[2] = replacement;
  assert.equal(new Set(room.slots.map(slot => slot.id)).size, 6);
  await readyEveryone(room, seats);
  assert.equal(room.state.round, 1);
});

test('Voxel requires all six players to accept a rematch and preserves the room mode and map', async t => {
  const game = await host(t), room = await game.make(3, 'depot'), seats = await game.fill(room);
  await readyEveryone(room, seats); advance(game.app, room, 'fight');
  room.state.phase = 'matchEnd';
  const after = seats[0].peer.messages.length;
  seats[0].peer.send({ type: 'rematch' });
  await seats[0].peer.untilState(message => message.state.phase === 'lobby' && message.players[0].ready, { after });
  for (let id = 1; id < 5; id++) seats[id].peer.send({ type: 'rematch' });
  await flushPeer(seats[4].peer);
  for (let tick = 0; tick < 400; tick++) game.app.tick();
  assert.equal(room.state.phase, 'lobby');
  assert.equal(room.players[5].ready, false);
  const finalAfter = seats[0].peer.messages.length;
  seats[5].peer.send({ type: 'rematch' });
  await seats[0].peer.untilState(message => message.state.phase === 'countdown', { after: finalAfter });
  assert.equal(room.state.capacity, 6);
  assert.equal(room.state.mapId, 'depot');
  assert.equal(room.state.round, 1);
});

test('Voxel arsenal controls release on stale input without accepting inventory or damage from the client', async t => {
  const game = await host(t), room = await game.make(), seat = await game.peer(room);
  await inputFrames(game, room, seat, { aim: true, swap: true, grenade: true, heal: true, yaw: .6, pitch: -.3 }, 1);
  for (const key of ['aim', 'swap', 'grenade', 'heal']) assert.equal(room.slots[0].buttons[key], true);
  room.slots[0].lastInputTime -= 351; game.app.tick();
  for (const key of ['aim', 'swap', 'grenade', 'heal']) assert.equal(room.slots[0].buttons[key], false);
  assert.equal(room.slots[0].buttons.yaw, .6); assert.equal(room.slots[0].buttons.pitch, -.3);
  assert.equal(room.state.players[0].slot, 'primary');
  assert.equal(room.state.players[0].grenades, 1); assert.equal(room.state.players[0].potions, 1);
  const hp = room.state.players[0].hp;
  for (const buttons of [{ hp: 999 }, { potions: 99 }, { damage: 999 }, { slot: 'sword' }, { grenades: 99 }]) {
    const after = seat.peer.messages.length;
    seat.peer.send({ type: 'input', seq: 2, buttons });
    await seat.peer.waitFor(message => message.type === 'error', { after });
    assert.equal(room.slots[0].lastAccepted, 0);
    assert.equal(room.state.players[0].hp, hp);
  }
});

test('Voxel new loadouts and finite utility actions are authoritative through real sockets', async t => {
  const game = await host(t), room = await game.make(2, 'depot'), seats = await game.fill(room);
  for (const [id, weaponId] of ['pistol', 'shotgun', 'burst', 'carbine'].entries()) {
    const after = seats[id].peer.messages.length;
    seats[id].peer.send({ type: 'fps-loadout', weaponId });
    await seats[id].peer.untilState(message => message.state.players[id].weapon === weaponId, { after });
  }
  await readyEveryone(room, seats); advance(game.app, room, 'fight');
  const actor = room.state.players[0];
  await inputFrames(game, room, seats[0], { aim: true }, Voxel.ADS.ticks);
  assert.equal(actor.aiming, true); assert.equal(actor.aimTicks, Voxel.ADS.ticks);
  await inputFrames(game, room, seats[0], { swap: true }, 40);
  assert.equal(actor.slot, 'sword'); assert.equal(actor.aiming, false);
  assert.equal(actor.weapon, 'pistol', 'the primary loadout remains available when drawing the sword');
  await inputFrames(game, room, seats[0], {}, 1);
  await inputFrames(game, room, seats[0], { swap: true }, 1); assert.equal(actor.slot, 'primary');
  await inputFrames(game, room, seats[0], { grenade: true }, 30);
  assert.equal(actor.grenades, 0); assert.equal(room.state.grenades.length, 1);
  await inputFrames(game, room, seats[0], { grenade: true }, 30);
  assert.equal(room.state.grenades.length, 1, 'a held throw cannot invent another grenade');
  assert.equal(actor.potions, 1);
  await inputFrames(game, room, seats[0], { heal: true }, 10);
  assert.equal(actor.potions, 1, 'full health does not waste the healing potion');
  room.state.phase = 'roundEnd'; room.state.phaseTicks = 1;
  game.app.tick();
  assert.equal(room.state.phase, 'countdown'); assert.equal(room.state.grenades.length, 0);
  for (const player of room.state.players) {
    assert.equal(player.slot, 'primary'); assert.equal(player.grenades, 1); assert.equal(player.potions, 1);
    assert.equal(player.healing, false); assert.equal(player.meleeTicks, 0);
  }
  assert.deepEqual(room.state.players.map(player => player.weapon), ['pistol', 'shotgun', 'burst', 'carbine']);
});

test('Voxel loadouts are selected authoritatively and cannot be changed during live combat', async t => {
  const game = await host(t), room = await game.make(), seats = await game.fill(room), peer = seats[0].peer;
  for (const data of [
    { type: 'fps-loadout', weaponId: 'rocket' }, { type: 'fps-loadout', weaponId: null },
    { type: 'fps-loadout', weaponId: 'smg', hp: 999 }, { type: 'fps-loadout' },
  ]) {
    const after = peer.messages.length; peer.send(data);
    await peer.waitFor(message => message.type === 'error', { after });
  }
  const before = structuredClone(room.state.players[1]);
  const after = peer.messages.length;
  peer.send({ type: 'fps-loadout', weaponId: 'marksman' });
  await peer.untilState(message => message.state.players[0].weapon === 'marksman', { after });
  assert.deepEqual(room.state.players[1], before);
  await readyEveryone(room, seats); advance(game.app, room, 'buy');
  let next = peer.messages.length;
  peer.send({ type: 'fps-loadout', weaponId: 'smg' });
  await peer.untilState(message => message.state.players[0].weapon === 'smg', { after: next });
  advance(game.app, room, 'fight'); next = peer.messages.length;
  peer.send({ type: 'fps-loadout', weaponId: 'marksman' });
  await peer.waitFor(message => message.type === 'error', { after: next });
  assert.equal(room.state.players[0].weapon, 'smg');
  const legacy = game.app.createRoom('afterimage'), { peer: other } = await game.peer(legacy);
  const oldAfter = other.messages.length; other.send({ type: 'fps-loadout', weaponId: 'smg' });
  await other.waitFor(message => message.type === 'error', { after: oldAfter });
  assert.equal(legacy.capacity, 2);
});

test('Voxel lobby team choices move only into free seats and keep connection, loadout and input identity consistent', async t => {
  const game = await host(t), room = await game.make(2), first = await game.peer(room, 'Rook'), peer = first.peer;
  assert.equal(first.welcome.playerId, 0);
  peer.send({ type: 'fps-loadout', weaponId: 'marksman' }); await flushPeer(peer);
  peer.send({ type: 'ready', ready: true }); await flushPeer(peer);
  peer.send({ type: 'input', seq: 0, buttons: { fire: true, yaw: .2 } }); await flushPeer(peer);
  const after = peer.messages.length;
  peer.send({ type: 'fps-team', team: 1 });
  const moved = await peer.waitFor(message => message.type === 'welcome', { after });
  assert.equal(moved.playerId, 2); assert.equal(moved.sessionId, first.welcome.sessionId);
  assert.equal(room.players[0], null); assert.equal(room.slots[0], null); assert.equal(room.acks[0], -1);
  assert.equal(room.players[2].name, 'Rook'); assert.equal(room.players[2].team, 1); assert.equal(room.players[2].ready, false);
  assert.equal(room.slots[2].id, 2); assert.equal(room.slots[2].lastAccepted, -1); assert.equal(room.slots[2].queue.length, 0);
  assert.equal(room.state.players[2].weapon, 'marksman'); assert.equal(room.state.players[0].weapon, 'carbine');
  peer.send({ type: 'input', seq: 0, buttons: { yaw: -.5, pitch: .3 } }); await flushPeer(peer); game.app.tick();
  assert.equal(room.acks[2], 0); assert.equal(room.slots[2].buttons.yaw, -.5);
  peer.send({ type: 'join', name: 'Changed Rook' }); await flushPeer(peer);
  assert.equal(room.players[2].name, 'Changed Rook');
  const joined = await game.peer(room, 'New Seat'); assert.equal(joined.welcome.playerId, 0);
  const closedAfter = joined.peer.messages.length; peer.socket.close();
  await joined.peer.untilState(message => message.players[2] === null, { after: closedAfter });
  assert.equal(room.players[0].name, 'New Seat'); assert.equal(room.slots[2], null); assert.equal(room.acks[2], -1);
});

test('Voxel rejects invalid, full and active-match team changes without disturbing other players', async t => {
  const game = await host(t), room = await game.make(), seats = await game.fill(room), peer = seats[0].peer;
  for (const data of [
    { type: 'fps-team', team: 2 }, { type: 'fps-team', team: '1' }, { type: 'fps-team', team: null },
    { type: 'fps-team', team: 1, playerId: 1 }, { type: 'fps-team', team: 1 },
  ]) {
    const after = peer.messages.length; peer.send(data);
    await peer.waitFor(message => message.type === 'error', { after });
    assert.equal(room.players[0].team, 0); assert.equal(room.players[1].team, 1);
  }
  const sameAfter = peer.messages.length; peer.send({ type: 'fps-team', team: 0 });
  await peer.untilState(message => message.players[0].team === 0, { after: sameAfter });
  await readyEveryone(room, seats);
  const after = peer.messages.length; peer.send({ type: 'fps-team', team: 0 });
  await peer.waitFor(message => message.type === 'error', { after });
  assert.equal(room.state.phase, 'countdown');
  const legacy = game.app.createRoom('afterimage'), { peer: other } = await game.peer(legacy);
  const oldAfter = other.messages.length; other.send({ type: 'fps-team', team: 1 });
  await other.waitFor(message => message.type === 'error', { after: oldAfter });
  assert.equal(legacy.players[0].name, 'Rook');
});

test('Voxel shares one authoritative state among six real clients and isolates empty and legacy rooms', async t => {
  const game = await host(t), room = await game.make(3, 'canal'), seats = await game.fill(room);
  const empty = await game.make(2), untouched = structuredClone(empty.state), legacyTick = game.app.state.tick;
  await readyEveryone(room, seats); advance(game.app, room, 'fight');
  const snapshotsFrom = seats.map(({ peer }) => peer.messages.length);
  for (let id = 0; id < seats.length; id++) {
    seats[id].peer.send({ type: 'input', seq: 0, buttons: { yaw: id * .1, pitch: id * .05, crouch: id % 2 === 0 } });
    await flushPeer(seats[id].peer);
  }
  for (let tick = 0; tick < 8; tick++) game.app.tick();
  game.app.broadcast(room);
  const snapshots = await Promise.all(seats.map(({ peer }, id) => peer.untilState(message => message.acks.every(seq => seq === 0), { after: snapshotsFrom[id] })));
  for (const snapshot of snapshots) {
    assert.equal(snapshot.capacity, 6); assert.equal(snapshot.players.length, 6);
    assert.equal(Object.hasOwn(snapshot.state, 'fighters'), false);
    assert.deepEqual(snapshot.state, snapshots[0].state);
    assert.deepEqual(snapshot.acks, snapshots[0].acks);
  }
  assert.deepEqual(empty.state, untouched);
  assert.equal(game.app.state.tick, legacyTick);
  assert.ok(snapshots[0].state.bomb);
  const health = await (await fetch(`${game.origin}/health`)).json();
  assert.ok(health.games.includes('voxel-breach'));
  assert.equal((await fetch(`${game.origin}/voxel-engine.js`)).status, 200);
});

test('six Voxel clients observe a normal-input plant, defuse and authoritative round score', async t => {
  const game = await host(t), room = await game.make(3, 'courtyard'), seats = await game.fill(room);
  await readyEveryone(room, seats); advance(game.app, room, 'fight');
  assert.equal(room.state.bomb.carrierId, 0);
  await walkRoute(game, room, seats[0], [[-18, 18], [-18, -12], [-13, -12]]);
  for (let tick = 0; tick < 4; tick++) await inputFrames(game, room, seats[0], { interact: true }, 120);
  assert.equal(room.state.bomb.status, 'planted'); assert.equal(room.state.bomb.siteId, 'A');
  const plantedAfter = seats.map(({ peer }) => peer.messages.length); game.app.broadcast(room);
  const planted = await Promise.all(seats.map(({ peer }, id) => peer.untilState(message => message.state.bomb.status === 'planted', { after: plantedAfter[id] })));
  for (const snapshot of planted) assert.deepEqual(snapshot.state.bomb, planted[0].state.bomb);
  await inputFrames(game, room, seats[0], {}, 1);
  await walkRoute(game, room, seats[3], [[3, -20], [-13, -20], [-13, -12, .9]]);
  for (let tick = 0; tick < 6; tick++) await inputFrames(game, room, seats[3], { interact: true }, 120);
  assert.equal(room.state.bomb.status, 'defused'); assert.equal(room.state.phase, 'roundEnd');
  assert.equal(room.state.roundReason, 'defuse'); assert.deepEqual(room.state.scores, [0, 1]);
  const defusedAfter = seats.map(({ peer }) => peer.messages.length); game.app.broadcast(room);
  const defused = await Promise.all(seats.map(({ peer }, id) => peer.untilState(message => message.state.roundReason === 'defuse', { after: defusedAfter[id] })));
  for (const snapshot of defused) assert.deepEqual(snapshot.state, defused[0].state);
  assert.ok(defused[0].state.events.some(event => event.type === 'plant'));
  assert.ok(defused[0].state.events.some(event => event.type === 'defuse'));
});
