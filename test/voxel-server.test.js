import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { createServer } from '../server.js';
import * as Voxel from '../public/voxel-engine.js';
import { getLagCompensationDiagnostics } from '../public/voxel-lag-compensation.js';
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

test('flagship maps and weapons round-trip through real team rooms without live loadout refills', async t => {
  const game = await host(t);
  for (const [index, mapId] of ['rooftops', 'foundry', 'bastion'].entries()) {
    const room = await game.make(index + 1, mapId), seats = await game.fill(room);
    for (let id = 0; id < seats.length; id++) {
      const weaponId = ['sniper', 'lmg', 'crossbow'][id % 3], { peer } = seats[id];
      const after = peer.messages.length;
      peer.send({ type: 'fps-loadout', weaponId });
      await peer.untilState(message => message.state.players[id].weapon === weaponId, { after });
      assert.equal(room.state.players[id].ammo, Voxel.WEAPONS[weaponId].magazine);
    }
    await readyEveryone(room, seats);
    advance(game.app, room, 'fight');
    const shooter = room.state.players[0], ammo = shooter.ammo;
    await inputFrames(game, room, seats[0], { fire: true, yaw: 1.5, pitch: 0 }, 1);
    assert.equal(shooter.ammo, ammo - 1);
    const after = seats[0].peer.messages.length;
    seats[0].peer.send({ type: 'fps-loadout', weaponId: 'crossbow' });
    await seats[0].peer.waitFor(message => message.type === 'error', { after });
    assert.equal(shooter.weapon, 'sniper'); assert.equal(shooter.ammo, ammo - 1);
    const listed = await (await fetch(`${game.origin}/api/rooms`)).json();
    assert.equal(listed.rooms.find(item => item.id === room.id).mapId, mapId);
    assert.equal(room.state.mapName, Voxel.MAPS[mapId].name);
    for (const { peer } of seats) peer.socket.terminate();
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  for (const path of ['/voxel-maps.js', '/voxel-weapons.js', '/voxel-projectiles.js']) {
    const response = await fetch(game.origin + path);
    assert.equal(response.status, 200); assert.match(response.headers.get('Content-Type'), /javascript/);
    assert.ok((await response.text()).length > 100);
  }
});

async function quickFight(t, weaponId = 'pistol') {
  const game = await host(t), room = await game.make(), seats = await game.fill(room);
  seats[0].peer.send({ type: 'fps-loadout', weaponId }); await flushPeer(seats[0].peer);
  await readyEveryone(room, seats); advance(game.app, room, 'fight');
  return { game, room, seats };
}

test('a released WS tap fires on the first post-bell tick while latest movement packets keep the newest acknowledgment', async t => {
  const { game, room, seats } = await quickFight(t), seat = seats[0], player = room.state.players[0];
  const ammo = player.ammo;
  seat.peer.send({ type: 'input', seq: 0, viewTick: room.state.tick - 1, buttons: { fire: true, up: true, yaw: .2, pitch: -.1 } });
  seat.peer.send({ type: 'input', seq: 1, viewTick: room.state.tick, buttons: { left: true, yaw: 1.2, pitch: .3 } });
  seat.peer.send({ type: 'input', seq: 2, buttons: { right: true, yaw: -.7, pitch: .4 } });
  await flushPeer(seat.peer);
  assert.equal(player.shots, 0); assert.equal(room.slots[0].queue.length, 1);
  game.app.tick();
  assert.equal(room.acks[0], 2); assert.equal(player.shots, 1); assert.equal(player.ammo, ammo - 1);
  assert.equal(room.slots[0].buttons.fire, true); assert.equal(room.slots[0].buttons.right, true); assert.equal(room.slots[0].buttons.up, false); assert.equal(room.slots[0].buttons.left, false);
  assert.equal(player.yaw, .2); assert.equal(player.pitch, -.1);
  const after = seat.peer.messages.length; game.app.broadcast(room);
  const snapshot = await seat.peer.untilState(message => message.acks[0] === 2, { after });
  assert.equal(snapshot.state.players[0].shots, 1);
  game.app.tick(); assert.equal(player.yaw, -.7); assert.equal(player.pitch, .4); assert.equal(room.slots[0].buttons.fire, false);
  for (let index = 0; index < Voxel.WEAPONS.pistol.cooldown + 2; index++) game.app.tick();
  assert.equal(player.shots, 1, 'latest release is retained after the one queued firing commitment');
});

test('two WS swap taps before a tick retain a release tick while continuous look stays current', async t => {
  const { game, room, seats } = await quickFight(t), peer = seats[0].peer, player = room.state.players[0];
  for (const [seq, buttons] of [[0, { swap: true, yaw: .1 }], [1, { yaw: .2 }], [2, { swap: true, yaw: .3 }], [3, { yaw: .4 }]]) peer.send({ type: 'input', seq, buttons });
  await flushPeer(peer);
  game.app.tick(); assert.equal(room.acks[0], 3); assert.equal(player.slot, 'sword'); assert.equal(player.yaw, .4);
  game.app.tick(); assert.equal(player.slot, 'sword'); assert.equal(room.slots[0].buttons.swap, false);
  game.app.tick(); assert.equal(player.slot, 'primary'); assert.equal(player.yaw, .4);
  assert.equal(room.state.events.filter(event => event.type === 'swap').length, 2);
});

test('WS cancelActions discards pending commitments, validates before acknowledgment and blocks held reentry', async t => {
  const { game, room, seats } = await quickFight(t), peer = seats[0].peer, player = room.state.players[0];
  peer.send({ type: 'input', seq: 0, buttons: { fire: true, jump: true, grenade: true, yaw: .2 } });
  await flushPeer(peer);
  for (const cancelActions of [1, 'true', null, {}]) {
    const after = peer.messages.length;
    peer.send({ type: 'input', seq: 1, buttons: {}, cancelActions });
    await peer.waitFor(message => message.type === 'error', { after });
    assert.equal(room.slots[0].lastAccepted, 0); assert.equal(room.acks[0], -1);
    assert.equal(room.slots[0].actionInputs.inspect().pending.length, 3, 'invalid metadata cannot cancel already accepted controls');
  }
  peer.send({ type: 'input', seq: 1, cancelActions: true, buttons: { fire: true, jump: true, yaw: .6 } }); await flushPeer(peer);
  for (let index = 0; index < 4; index++) game.app.tick();
  assert.equal(room.acks[0], 1); assert.equal(player.shots, 0); assert.equal(player.y, 0); assert.equal(player.grenades, 1); assert.equal(room.state.grenades.length, 0);
  assert.equal(room.slots[0].buttons.yaw, .6); assert.equal(room.slots[0].actionInputs.inspect().pending.length, 0);
  peer.send({ type: 'input', seq: 2, buttons: {} }); peer.send({ type: 'input', seq: 3, buttons: { fire: true } }); peer.send({ type: 'input', seq: 4, buttons: {} });
  await flushPeer(peer); game.app.tick(); assert.equal(room.acks[0], 4); assert.equal(player.shots, 1);
});

test('WS cancellation is rejected for games that use ordered commands', async t => {
  const game = await host(t), room = game.app.createRoom('afterimage', 'Ordered controls'), peer = game.socket(room);
  await peer.connect(); const after = peer.messages.length;
  peer.send({ type: 'input', seq: 0, buttons: {}, cancelActions: true });
  await peer.waitFor(message => message.type === 'error', { after });
  assert.equal(room.slots[0].lastAccepted, -1); assert.equal(room.slots[0].queue.length, 0);
});

for (const action of ['fire', 'jump', 'grenade']) {
  test(`WS cancellation removes an unconsumed ${action} touch commitment without a ghost action`, async t => {
    const { game, room, seats } = await quickFight(t), peer = seats[0].peer, player = room.state.players[0], ammo = player.ammo;
    peer.send({ type: 'input', seq: 0, buttons: { [action]: true, yaw: .2 } });
    peer.send({ type: 'input', seq: 1, buttons: { yaw: .6 }, cancelPress: { action, seq: 0 } });
    await flushPeer(peer);
    for (let index = 0; index < 4; index++) game.app.tick();
    assert.equal(room.acks[0], 1); assert.equal(player.yaw, .6);
    assert.equal(player.shots, 0); assert.equal(player.ammo, ammo);
    assert.equal(player.y, 0); assert.equal(player.grenades, 1); assert.equal(room.state.grenades.length, 0);
  });
}

test('canceling a queued touch jump preserves an independently held carbine firing stream', async t => {
  const { game, room, seats } = await quickFight(t, 'carbine'), peer = seats[0].peer, player = room.state.players[0], ammo = player.ammo;
  peer.send({ type: 'input', seq: 0, buttons: { fire: true, yaw: .2 } });
  peer.send({ type: 'input', seq: 1, buttons: { fire: true, jump: true, yaw: .2 } });
  peer.send({ type: 'input', seq: 2, buttons: { fire: true, yaw: .2 }, cancelPress: { action: 'jump', seq: 1 } });
  await flushPeer(peer);
  game.app.tick(); assert.equal(player.shots, 1); assert.equal(player.y, 0);
  for (let index = 0; index < Voxel.WEAPONS.carbine.cooldown + 1; index++) game.app.tick();
  assert.equal(room.acks[0], 2); assert.equal(player.shots, 2); assert.equal(player.ammo, ammo - 2);
  assert.equal(player.y, 0); assert.equal(room.slots[0].buttons.fire, true);
  peer.send({ type: 'input', seq: 3, buttons: {} }); await flushPeer(peer);
  for (let index = 0; index < Voxel.WEAPONS.carbine.cooldown + 1; index++) game.app.tick();
  assert.equal(player.shots, 2, 'the independent firing stream still responds to its real release');
});

test('canceling a newer touch press preserves an earlier normal released pistol tap and its aim', async t => {
  const { game, room, seats } = await quickFight(t), peer = seats[0].peer, player = room.state.players[0], ammo = player.ammo;
  peer.send({ type: 'input', seq: 0, buttons: { fire: true, yaw: .2, pitch: -.1 } });
  peer.send({ type: 'input', seq: 1, buttons: { yaw: .4 } });
  peer.send({ type: 'input', seq: 2, buttons: { fire: true, yaw: .8 } });
  peer.send({ type: 'input', seq: 3, buttons: { yaw: 1 }, cancelPress: { action: 'fire', seq: 2 } });
  await flushPeer(peer); game.app.tick();
  assert.equal(room.acks[0], 3); assert.equal(player.shots, 1); assert.equal(player.ammo, ammo - 1);
  assert.equal(player.yaw, .2); assert.equal(player.pitch, -.1);
  for (let index = 0; index < Voxel.WEAPONS.pistol.cooldown + 3; index++) game.app.tick();
  assert.equal(player.shots, 1, 'only the earlier valid tap reaches the weapon');
  assert.equal(player.yaw, 1); assert.equal(room.slots[0].buttons.fire, false);
});

test('canceling an unknown or already consumed sequence does not remove a newer valid shot', async t => {
  const { game, room, seats } = await quickFight(t), peer = seats[0].peer, player = room.state.players[0];
  peer.send({ type: 'input', seq: 0, buttons: { fire: true, yaw: .2 } }); await flushPeer(peer); game.app.tick();
  assert.equal(player.shots, 1);
  peer.send({ type: 'input', seq: 1, buttons: {} }); await flushPeer(peer);
  for (let index = 0; index < Voxel.WEAPONS.pistol.cooldown + 1; index++) game.app.tick();
  peer.send({ type: 'input', seq: 2, buttons: { fire: true, yaw: .5 } });
  peer.send({ type: 'input', seq: 3, buttons: {} });
  peer.send({ type: 'input', seq: 4, buttons: {}, cancelPress: { action: 'fire', seq: 1 } });
  peer.send({ type: 'input', seq: 5, buttons: {}, cancelPress: { action: 'fire', seq: 0 } });
  await flushPeer(peer); game.app.tick();
  assert.equal(room.acks[0], 5); assert.equal(player.shots, 2); assert.equal(player.yaw, .5);
  for (let index = 0; index < Voxel.WEAPONS.pistol.cooldown + 3; index++) game.app.tick();
  assert.equal(player.shots, 2);
});

test('malformed WS touch cancellation is rejected before acknowledgment or accepted-input mutation', async t => {
  const { game, room, seats } = await quickFight(t), peer = seats[0].peer, player = room.state.players[0];
  peer.send({ type: 'input', seq: 0, buttons: { jump: true, yaw: .2 } }); await flushPeer(peer);
  for (const cancelPress of [
    null, true, 'jump', [], {}, { action: 'jump' }, { seq: 0 },
    { action: 'up', seq: 0 }, { action: 'fire', seq: '0' },
    { action: 'jump', seq: -1 }, { action: 'jump', seq: .5 },
    { action: 'jump', seq: 1 }, { action: 'jump', seq: 2 },
    { action: 'jump', seq: 1_000_000_000 }, { action: 'jump', seq: Number.MAX_SAFE_INTEGER + 1 },
    { action: 'jump', seq: 0, extra: true },
  ]) {
    const after = peer.messages.length;
    peer.send({ type: 'input', seq: 1, buttons: { yaw: .8 }, cancelPress });
    await peer.waitFor(message => message.type === 'error', { after });
    assert.equal(room.slots[0].lastAccepted, 0); assert.equal(room.acks[0], -1);
    assert.equal(room.slots[0].actionInputs.inspect().pending.length, 1, 'a malformed cancellation cannot discard the accepted jump');
  }
  peer.send({ type: 'input', seq: 1, buttons: { yaw: .6 }, cancelPress: { action: 'jump', seq: 0 } });
  await flushPeer(peer); game.app.tick();
  assert.equal(room.acks[0], 1); assert.equal(player.y, 0); assert.equal(player.yaw, .6);
});

test('WS touch cancellation is rejected for non-FPS ordered controls before sequence acceptance', async t => {
  const game = await host(t), room = game.app.createRoom('afterimage', 'Ordered controls'), peer = game.socket(room);
  await peer.connect(); const after = peer.messages.length;
  peer.send({ type: 'input', seq: 1, buttons: {}, cancelPress: { action: 'jump', seq: 0 } });
  await peer.waitFor(message => message.type === 'error', { after });
  assert.equal(room.slots[0].lastAccepted, -1); assert.equal(room.acks[0], -1); assert.equal(room.slots[0].queue.length, 0);
});

test('a WS tap older than 120ms expires even when the newest release and movement are fresh', async t => {
  const { game, room, seats } = await quickFight(t), peer = seats[0].peer, player = room.state.players[0];
  peer.send({ type: 'input', seq: 0, buttons: { fire: true, yaw: .2 } });
  peer.send({ type: 'input', seq: 1, buttons: { yaw: .3 } }); await flushPeer(peer);
  await new Promise(resolve => setTimeout(resolve, 130));
  peer.send({ type: 'input', seq: 2, buttons: { right: true, yaw: .4 } }); await flushPeer(peer); game.app.tick();
  assert.equal(room.acks[0], 2); assert.equal(player.shots, 0); assert.equal(room.slots[0].buttons.right, true); assert.equal(player.yaw, .4);
  assert.equal(room.slots[0].actionInputs.inspect().pending.length, 0);
  peer.send({ type: 'input', seq: 3, buttons: { fire: true } }); peer.send({ type: 'input', seq: 4, buttons: {} });
  await flushPeer(peer); game.app.tick(); assert.equal(player.shots, 1);
});

test('pre-bell held actions remain blocked while a genuinely fresh action after release starts immediately', async t => {
  const game = await host(t), room = await game.make(), seats = await game.fill(room), peer = seats[0].peer;
  peer.send({ type: 'fps-loadout', weaponId: 'pistol' }); await flushPeer(peer);
  await readyEveryone(room, seats); advance(game.app, room, 'buy');
  peer.send({ type: 'input', seq: 0, buttons: { fire: true, jump: true, grenade: true, yaw: .2 } }); await flushPeer(peer);
  advance(game.app, room, 'fight'); game.app.tick();
  const player = room.state.players[0];
  assert.equal(player.shots, 0); assert.equal(player.y, 0); assert.equal(player.grenades, 1);
  peer.send({ type: 'input', seq: 1, buttons: {} }); peer.send({ type: 'input', seq: 2, buttons: { fire: true } }); peer.send({ type: 'input', seq: 3, buttons: {} });
  await flushPeer(peer); game.app.tick(); assert.equal(player.shots, 1); assert.equal(room.acks[0], 3);
});

test('disconnect clears every queued tap before an actual two-player ready restart', async t => {
  const { game, room, seats } = await quickFight(t), peer = seats[0].peer;
  peer.send({ type: 'input', seq: 0, buttons: { fire: true, grenade: true, jump: true } }); peer.send({ type: 'input', seq: 1, buttons: {} });
  await flushPeer(peer); assert.equal(room.slots[0].actionInputs.inspect().pending.length, 3);
  const after = peer.messages.length; seats[1].peer.socket.close();
  await peer.untilState(message => message.state.phase === 'lobby' && message.players[1] === null, { after });
  assert.equal(room.slots[0].actionInputs.inspect().pending.length, 0); assert.equal(room.slots[0].queue.length, 0);
  seats[1] = await game.peer(room, 'Replacement'); await readyEveryone(room, seats); advance(game.app, room, 'fight'); game.app.tick();
  assert.equal(room.state.players[0].shots, 0); assert.equal(room.state.players[0].grenades, 1); assert.equal(room.state.players[0].y, 0);
});

for (const metadata of ['valid', 'stale', 'future']) {
  test(`a released WS shot retains its own ${metadata} displayed view tick after newer look metadata arrives`, async t => {
    const { game, room, seats } = await quickFight(t, 'marksman'), [shooterSeat, targetSeat] = seats;
    const [shooter, target] = room.state.players;
    Object.assign(shooter, { x: -20, y: 0, z: 10, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, grounded: true });
    Object.assign(target, { x: -20, y: 0, z: 0, vx: 5.4, vy: 0, vz: 0, yaw: 0, pitch: 0, grounded: true });
    targetSeat.peer.send({ type: 'input', seq: 0, buttons: { right: true, yaw: 0, pitch: 0 } }); await flushPeer(targetSeat.peer);
    const poses = new Map(); let inputSequence = 0;
    // A live browser sends neutral inputs every 50 ms while standing still.
    // Keep this displayed-view test outside the separate inactivity fence.
    for (let index = 0; index < 24; index++) {
      if (index % 6 === 0) {
        shooterSeat.peer.send({ type: 'input', seq: inputSequence++, buttons: {} });
        await flushPeer(shooterSeat.peer);
      }
      game.app.tick(); poses.set(room.state.tick, { x: target.x, z: target.z });
    }
    const displayedTick = room.state.tick - 6, displayed = poses.get(displayedTick), yaw = Math.atan2(displayed.x - shooter.x, -(displayed.z - shooter.z));
    const currentRay = Voxel.traceShot(room.state, 0, { x: shooter.x, y: Voxel.eyeHeight(shooter), z: shooter.z }, { x: Math.sin(yaw), y: 0, z: -Math.cos(yaw) }, 120, Voxel.MAPS.courtyard);
    assert.equal(currentRay.playerId, null);
    const viewTick = metadata === 'valid' ? displayedTick : metadata === 'stale' ? room.state.tick - 19 : room.state.tick + 500;
    const hp = target.hp, x = target.x, ammo = shooter.ammo;
    assert.equal(room.slots[0].actionInputs.inspect().neutral, false, 'a healthy standing shooter is outside stale-input recovery');
    shooterSeat.peer.send({ type: 'input', seq: inputSequence++, viewTick, buttons: { fire: true, yaw, pitch: 0 } });
    shooterSeat.peer.send({ type: 'input', seq: inputSequence++, viewTick: room.state.tick, buttons: { yaw: 1.2, pitch: .2 } });
    await flushPeer(shooterSeat.peer); game.app.tick();
    assert.equal(room.acks[0], inputSequence - 1); assert.equal(shooter.shots, 1); assert.equal(shooter.ammo, ammo - 1); assert.ok(target.x > x, 'historical tracing never changes real movement');
    const shot = room.state.events.findLast(event => event.type === 'shot' && event.playerId === 0);
    if (metadata === 'valid') { assert.equal(shot.targetId, 1); assert.equal(shot.hitKind, 'head'); assert.equal(target.hp, hp - Voxel.WEAPONS.marksman.damage * Voxel.WEAPONS.marksman.headMultiplier); }
    else { assert.equal(shot.targetId, null); assert.equal(target.hp, hp); assert.equal(getLagCompensationDiagnostics(room.state).viewCount, 0); }
    shooterSeat.peer.send({ type: 'input', seq: inputSequence++, cancelActions: true, buttons: {} }); await flushPeer(shooterSeat.peer);
    room.slots[0].lastInputTime -= 351; game.app.tick();
    assert.equal(getLagCompensationDiagnostics(room.state).viewCount, 0); assert.equal(room.slots[0].actionInputs.inspect().pending.length, 0);
  });
}
