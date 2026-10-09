import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { createServer } from '../server.js';
import * as Horde from '../public/voxel-horde-engine.js';
import * as Voxel from '../public/voxel-engine.js';
import { getLagCompensationDiagnostics } from '../public/voxel-lag-compensation.js';
import { applyCombatDamage } from '../public/voxel-engine.js';
import { monsterBodyBoxes, monsterBodyProfile } from '../public/voxel-monster-bodies.js';
import { Peer, flushPeer } from './ws-helper.js';

async function host(t) {
  const app = createServer({ autoTick: false, creationLimit: 100 });
  await app.listen(0, '127.0.0.1');
  const origin = `http://127.0.0.1:${app.server.address().port}`, peers = [];
  t.after(async () => { for (const peer of peers) peer.socket.terminate(); await app.close(); });
  return { app, origin,
    post(body) { return fetch(`${origin}/api/rooms`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); },
    async make(mapId = 'courtyard', difficulty = 'veteran') {
      const response = await this.post({ gameId: 'voxel-horde', capacity: 3, mapId, difficulty });
      assert.equal(response.status, 201);
      return app.rooms.get((await response.json()).room.id);
    },
    socket(room) {
      const peer = new Peer(`${origin.replace('http:', 'ws:')}/ws?room=${room.id}`); peers.push(peer); return peer;
    },
    async peer(room, name = 'Survivor') {
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
}
async function ready(seats) {
  for (const seat of seats) { seat.peer.send({ type: 'ready', ready: true }); await flushPeer(seat.peer); }
}
async function start(room, seat) {
  const after = seat.peer.messages.length; seat.peer.send({ type: 'start' });
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
const participants = state => state.horde.participantIds;

for (const size of [1, 2, 3]) {
  test(`Last Stand starts with ${size} ready teammates only after explicit host Start`, async t => {
    const game = await host(t), room = await game.make(), seats = [];
    assert.equal(room.capacity, 3);
    for (const key of ['players', 'slots', 'acks']) assert.equal(room[key].length, 3);
    assert.ok(room.state.players.slice(0, 3).every(player => !player.connected && !player.alive));
    for (let id = 0; id < size; id++) seats.push(await game.peer(room, `Teammate ${id + 1}`));
    for (const seat of seats) {
      assert.equal(seat.welcome.capacity, 3); assert.equal(seat.welcome.hostId, 0);
      assert.equal(seat.welcome.tickRate, 120); assert.equal(seat.welcome.difficulty, 'veteran');
    }
    await rejected(seats[0].peer, { type: 'start' }, /Every connected teammate must be ready/);
    if (size > 1) await rejected(seats[1].peer, { type: 'start' }, /Only the room host/);
    await ready(seats);
    for (let tick = 0; tick < 400; tick++) game.app.tick();
    assert.equal(room.state.phase, 'lobby', 'readiness never automatically starts the run');
    await start(room, seats[0]);
    assert.deepEqual(participants(room.state), Array.from({ length: size }, (_, id) => id));
    advance(game.app, room, 'fight');
    assert.ok(room.state.players.slice(0, size).every(player => player.alive && player.team === 0));
    assert.ok(room.state.players.slice(size, 3).every(player => !player.alive));
    assert.ok(room.players.every(player => !player || !player.ready));
    await rejected(seats[0].peer, { type: 'start' }, /only from the lobby/);
  });
}

test('Last Stand REST and socket metadata retain strict map/difficulty settings and omit AI and static geometry', async t => {
  const game = await host(t);
  for (const extra of [
    { capacity: 1 }, { capacity: 2 }, { capacity: 4 }, { capacity: '3' }, { capacity: null },
    { mapId: '__proto__' }, { mapId: 'forest' }, { mapId: null }, { mapId: 0 },
    { difficulty: 'easy' }, { difficulty: '__proto__' }, { difficulty: null }, { difficulty: 1 },
    { seed: 1 }, { hostId: 0 }, { hp: 999 }, { teamSize: 1 }, { settings: {} }, { name: false },
  ]) {
    const response = await game.post({ gameId: 'voxel-horde', ...extra });
    assert.equal(response.status, 400, JSON.stringify(extra)); assert.equal(game.app.rooms.size, 0);
  }
  assert.throws(() => game.app.createRoom('voxel-horde', undefined, { capacity: 3, seed: 1 }), /only a map and difficulty/);
  for (const mapId of Object.keys(Horde.MAPS)) for (const difficulty of ['veteran', 'nightmare']) {
    const room = await game.make(mapId, difficulty);
    assert.equal(room.mapName, Horde.MAPS[mapId].name); assert.equal(room.difficulty, difficulty);
  }
  const room = await game.make('paris', 'nightmare'), seat = await game.peer(room, 'Host');
  const snapshot = await seat.peer.untilState(message => message.players[0]?.name === 'Host');
  assert.equal(seat.welcome.mapId, 'paris'); assert.equal(seat.welcome.mapName, Horde.MAPS.paris.name);
  assert.equal(seat.welcome.difficulty, 'nightmare'); assert.equal(seat.welcome.gameId, 'voxel-horde');
  for (const key of ['map', 'fighters']) assert.equal(Object.hasOwn(snapshot.state, key), false);
  assert.equal(Object.hasOwn(snapshot.state.horde, 'brains'), false);
  const listed = (await (await fetch(`${game.origin}/api/rooms`)).json()).rooms.find(candidate => candidate.id === room.id);
  assert.equal(listed.capacity, 3); assert.equal(listed.hostId, 0); assert.equal(listed.difficulty, 'nightmare');
  assert.ok((await (await fetch(`${game.origin}/health`)).json()).games.includes('voxel-horde'));
});

test('Last Stand caps rooms at three and locks all new joins until the host opens a rematch lobby', async t => {
  const game = await host(t), room = await game.make(), seats = [];
  for (let id = 0; id < 3; id++) seats.push(await game.peer(room));
  const overflow = game.socket(room), [full] = await once(overflow.socket, 'close'); assert.equal(full, 4403);
  await ready(seats); await start(room, seats[0]);
  let late = game.socket(room), [locked] = await once(late.socket, 'close'); assert.equal(locked, 4409);
  await disconnect(seats[2], seats[0], message => message.players[2]?.connected === false);
  late = game.socket(room); [locked] = await once(late.socket, 'close'); assert.equal(locked, 4409);
  advance(game.app, room, 'fight');
  assert.deepEqual(participants(room.state), [0, 1]);
  assert.equal(room.state.players[2].alive, false);
  assert.equal(room.state.phase, 'fight');
});

test('A sparse lobby keeps fixed human IDs and migrates host ownership with fresh readiness and inputs', async t => {
  const game = await host(t), room = await game.make(), seats = [];
  for (let id = 0; id < 3; id++) seats.push(await game.peer(room, `Player ${id}`));
  await ready(seats);
  seats[0].peer.send({ type: 'input', seq: 0, buttons: { fire: true, up: true, yaw: .6 } }); await flushPeer(seats[0].peer);
  await disconnect(seats[1], seats[0], message => message.players[1] === null);
  assert.equal(room.state.phase, 'lobby'); assert.ok(room.players.every(player => !player || !player.ready));
  assert.equal(room.slots[0].queue.length, 0); assert.equal(room.slots[0].buttons.fire, false);
  await ready([seats[0], seats[2]]); await start(room, seats[0]);
  assert.deepEqual(participants(room.state), [0, 2]);
  await disconnect(seats[0], seats[2], message => message.hostId === 2 && message.players[0]?.connected === false);
  assert.equal(room.state.phase, 'countdown'); assert.deepEqual(participants(room.state), [2]);
  advance(game.app, room, 'fight');
  assert.equal(room.state.players[0].alive, false); assert.equal(room.state.players[1].alive, false);
  assert.equal(room.state.players[2].alive, true); assert.equal(room.hostId, 2);
});

test('Unready cancels the initial co-op countdown without silently restarting', async t => {
  const game = await host(t), room = await game.make(), seats = [await game.peer(room), await game.peer(room)];
  await ready(seats); await start(room, seats[0]);
  const after = seats[0].peer.messages.length; seats[1].peer.send({ type: 'ready', ready: false });
  await seats[0].peer.untilState(message => message.state.phase === 'lobby', { after });
  assert.ok(room.players.every(player => !player || !player.ready));
  await ready(seats); for (let tick = 0; tick < 400; tick++) game.app.tick();
  assert.equal(room.state.phase, 'lobby'); await start(room, seats[0]);
  await rejected(seats[1].peer, { type: 'ready', ready: 'yes' }, /Ready must be/);
});

test('Combat disconnect removes only that participant and keeps survivors, aim and wave progress intact', async t => {
  const game = await host(t), room = await game.make(), seats = [await game.peer(room), await game.peer(room), await game.peer(room)];
  await ready(seats); await start(room, seats[0]); advance(game.app, room, 'fight');
  seats[1].peer.send({ type: 'input', seq: 0, buttons: { right: true, yaw: .3, pitch: .1 } }); await flushPeer(seats[1].peer); game.app.tick();
  const player = room.state.players[1], position = [player.x, player.y, player.z], wave = room.state.horde.wave;
  await disconnect(seats[0], seats[1], message => message.hostId === 1 && message.players[0]?.connected === false);
  assert.equal(room.state.phase, 'fight'); assert.equal(room.state.horde.wave, wave);
  assert.deepEqual([player.x, player.y, player.z], position);
  assert.equal(room.slots[1].buttons.right, true); assert.equal(room.slots[1].buttons.yaw, .3);
  assert.equal(room.state.players[0].alive, false); assert.equal(room.state.players[0].connected, false);
  assert.deepEqual(participants(room.state), [1, 2]);
  await disconnect(seats[2], seats[1], message => message.players[2]?.connected === false);
  assert.deepEqual(participants(room.state), [1]); assert.equal(room.state.phase, 'fight');
  for (let tick = 0; tick < 20; tick++) game.app.tick();
  assert.equal(room.state.players[0].alive, false); assert.equal(room.state.players[2].alive, false);
});

test('A real team wipe exposes a host-only rematch that resets readiness, inputs and disconnected seats', async t => {
  const game = await host(t), room = await game.make('depot', 'nightmare'), seats = [await game.peer(room), await game.peer(room), await game.peer(room)];
  seats[1].peer.send({ type: 'fps-loadout', weaponId: 'shotgun' }); await flushPeer(seats[1].peer);
  await ready(seats); await start(room, seats[0]); advance(game.app, room, 'fight');
  await rejected(seats[0].peer, { type: 'rematch' }, /Finish the current match/);
  await disconnect(seats[0], seats[1], message => message.hostId === 1);
  applyCombatDamage(room.state, [1, 2].map(targetId => ({ targetId, playerId: null, damage: room.state.players[targetId].maxHp + 1 })));
  game.app.tick(); assert.equal(room.state.phase, 'matchEnd'); game.app.broadcast(room);
  await rejected(seats[2].peer, { type: 'rematch' }, /Only the room host/);
  await rejected(seats[1].peer, { type: 'rematch', seed: 1 }, /no player, map, or inventory overrides/);
  const after = seats[1].peer.messages.length; seats[1].peer.send({ type: 'rematch' });
  await seats[1].peer.untilState(message => message.state.phase === 'lobby' && message.players[0] === null, { after });
  assert.equal(room.mapId, 'depot'); assert.equal(room.difficulty, 'nightmare'); assert.equal(room.hostId, 1);
  assert.equal(room.state.players[1].weapon, 'shotgun'); assert.ok(room.players.every(player => !player || !player.ready));
  assert.equal(room.slots[1].queue.length, 0); assert.equal(room.slots[1].buttons.fire, false);
  const replacement = await game.peer(room, 'Replacement'); assert.equal(replacement.welcome.playerId, 0); assert.equal(replacement.welcome.hostId, 1);
  await ready([replacement, seats[1], seats[2]]); await start(room, seats[1]);
  assert.deepEqual(participants(room.state), [0, 1, 2]);
});

test('Last Stand validates loadouts and controls, preserves short taps and cancels unconsumed actions', async t => {
  const game = await host(t), room = await game.make(), seat = await game.peer(room);
  for (const message of [
    { type: 'input', seq: 0, buttons: { hp: 900 } }, { type: 'input', seq: 0, buttons: { yaw: Math.PI + .01 } },
    { type: 'input', seq: 0, buttons: { fire: 1 } }, { type: 'input', seq: 0, buttons: {}, cancelActions: 1 },
    { type: 'input', seq: 0, buttons: {}, cancelPress: { action: 'fire', seq: 0 } },
    { type: 'fps-loadout', weaponId: '__proto__' }, { type: 'fps-loadout', weaponId: 'carbine', hp: 900 },
    { type: 'start', seed: 1 }, { type: 'fps-team', team: 1 },
  ]) await rejected(seat.peer, message, /valid|boolean|between|cancelled|available|overrides|only|Choose/);
  assert.equal(room.slots[0].lastAccepted, -1);
  seat.peer.send({ type: 'fps-loadout', weaponId: 'marksman' }); await flushPeer(seat.peer);
  assert.equal(room.state.players[0].weapon, 'marksman');
  await ready([seat]); await start(room, seat); advance(game.app, room, 'fight');
  const player = room.state.players[0], ammo = player.ammo, y = player.y;
  seat.peer.send({ type: 'input', seq: 0, buttons: { jump: true, yaw: .2 } });
  seat.peer.send({ type: 'input', seq: 1, buttons: { yaw: .2 } }); await flushPeer(seat.peer); game.app.tick();
  assert.ok(player.y > y); assert.equal(room.acks[0], 1); assert.equal(room.slots[0].buttons.jump, true);
  seat.peer.send({ type: 'input', seq: 2, buttons: { fire: true, yaw: .5, pitch: .1 } });
  seat.peer.send({ type: 'input', seq: 3, buttons: { yaw: 1.2, pitch: .3 } }); await flushPeer(seat.peer); game.app.tick();
  assert.equal(player.ammo, ammo - 1); assert.equal(player.shots, 1); assert.equal(room.slots[0].buttons.yaw, .5);
  game.app.tick(); assert.equal(room.slots[0].buttons.yaw, 1.2); assert.equal(room.slots[0].buttons.fire, false);
  seat.peer.send({ type: 'input', seq: 4, buttons: { grenade: true } });
  seat.peer.send({ type: 'input', seq: 5, buttons: {}, cancelPress: { action: 'grenade', seq: 4 } }); await flushPeer(seat.peer); game.app.tick();
  assert.equal(player.grenadeThrowTicks, 0); assert.equal(room.slots[0].buttons.grenade, false);
  seat.peer.send({ type: 'input', seq: 6, buttons: { up: true, fire: true, yaw: -.7 } }); await flushPeer(seat.peer);
  room.slots[0].lastInputTime -= 351; game.app.tick();
  assert.equal(room.slots[0].buttons.up, false); assert.equal(room.slots[0].buttons.fire, false); assert.equal(room.slots[0].buttons.yaw, -.7);
  assert.equal(room.acks[0], 6);
});

function aimAt(shooter, target, offset = 0) {
  const dx = target.x - shooter.x, dz = target.z - shooter.z, distance = Math.hypot(dx, dz);
  const origin = { x: shooter.x, y: shooter.y + Voxel.eyeHeight(shooter), z: shooter.z };
  const head = monsterBodyBoxes(target)?.find(box => box.kind === 'head');
  const localX = head ? head.x + head.w / 2 : 0, localZ = head ? head.z + head.d / 2 : 0;
  const c = Math.cos(target.yaw), s = Math.sin(target.yaw);
  const point = { x: target.x + c * localX - s * localZ - dz / distance * offset,
    y: target.y + (head ? head.y + head.h / 2 : Voxel.playerHeight(target) - .16),
    z: target.z + s * localX + c * localZ + dx / distance * offset };
  const length = Math.hypot(point.x - origin.x, point.y - origin.y, point.z - origin.z);
  const direction = { x: (point.x - origin.x) / length, y: (point.y - origin.y) / length, z: (point.z - origin.z) / length };
  return { origin, direction, yaw: Math.atan2(direction.x, -direction.z), pitch: Math.asin(direction.y) };
}
async function movingMonsterShot(t, compensate) {
  const game = await host(t), room = await game.make(), seat = await game.peer(room);
  seat.peer.send({ type: 'fps-loadout', weaponId: 'marksman' }); await flushPeer(seat.peer);
  await ready([seat]); await start(room, seat); advance(game.app, room, 'fight');
  const frames = new Map(); let candidate, inputSequence = 0;
  // Observe the actual deterministic swarm rather than replacing its AI or movement.
  for (let tick = 0; tick < 1800 && room.state.phase === 'fight' && !candidate; tick++) {
    // An active browser sends neutral control heartbeats even while standing
    // still. Keep the connection healthy and drain real snapshot traffic rather
    // than accidentally testing the separate >350 ms inactivity recovery fence.
    if (tick % 8 === 0) {
      seat.peer.send({ type: 'input', seq: inputSequence++, buttons: {} });
      await flushPeer(seat.peer);
    }
    game.app.tick();
    frames.set(room.state.tick, room.state.players.map(player => ({ ...player })));
    const frame = frames.get(room.state.tick - 6); if (!frame) continue;
    const historical = { ...room.state, players: room.state.players.map(player => {
      const old = frame[player.id];
      return old?.alive && old.lifeId === player.lifeId ? { ...player, x: old.x, y: old.y, z: old.z, ...(monsterBodyProfile(player) ? { yaw: old.yaw } : {}) } : player;
    }) };
    for (const target of room.state.players.filter(player => player.monster && player.alive && !player.emergenceTicks)) {
      const old = frame[target.id]; if (!old?.alive || old.lifeId !== target.lifeId) continue;
      // The new dog's forward head is narrower than the humanoid target. Scan
      // real points across the small head silhouette so this observer can find
      // an actual crossing without enlarging boxes or replacing natural AI.
      for (const offset of [0, ...Array.from({ length: 64 }, (_, index) => (index < 32 ? -1 : 1) * (index % 32 + 1) * .01)]) {
        const aim = aimAt(room.state.players[0], { ...target, x: old.x, y: old.y, z: old.z, ...(monsterBodyProfile(target) ? { yaw: old.yaw } : {}) }, offset);
        const historicalHit = Voxel.traceShot(historical, 0, aim.origin, aim.direction, 120);
        const currentHit = Voxel.traceShot(room.state, 0, aim.origin, aim.direction, 120);
        if (historicalHit.playerId === target.id && historicalHit.kind === 'head' && currentHit.playerId !== target.id) {
          candidate = { target, aim, viewTick: room.state.tick - 6 }; break;
        }
      }
      if (candidate) break;
    }
  }
  assert.ok(candidate, 'a genuine 50 ms delayed moving head must become visible across the courtyard');
  const { target, aim, viewTick } = candidate, hp = target.hp, ammo = room.state.players[0].ammo, position = [target.x, target.y, target.z];
  assert.equal(room.slots[0].actionInputs.inspect().neutral, false, 'a healthy standing client is outside stale-input recovery');
  const fireSequence = inputSequence++;
  seat.peer.send({ type: 'input', seq: fireSequence, buttons: { fire: true, yaw: aim.yaw, pitch: aim.pitch }, ...(compensate ? { viewTick } : {}) });
  await flushPeer(seat.peer); game.app.tick();
  const shot = room.state.events.findLast(event => event.type === 'shot' && event.playerId === 0);
  assert.equal(room.acks[0], fireSequence); assert.equal(room.state.players[0].ammo, ammo - 1);
  assert.ok(shot); assert.notDeepEqual([target.x, target.y, target.z], position, 'the target continues its actual AI movement during tracing');
  if (compensate) {
    assert.equal(shot.targetId, target.id); assert.equal(shot.hitKind, 'head'); assert.ok(target.hp < hp);
    assert.equal(getLagCompensationDiagnostics(room.state).viewCount, 1);
    room.slots[0].lastInputTime -= 351; game.app.tick();
    assert.equal(getLagCompensationDiagnostics(room.state).viewCount, 0);
  } else {
    assert.notEqual(shot.targetId, target.id); assert.equal(target.hp, hp);
  }
  game.app.broadcast(room);
  const snapshot = await seat.peer.untilState(message => message.state.tick === room.state.tick);
  assert.equal(Object.hasOwn(snapshot.state.horde, 'brains'), false);
  assert.equal(JSON.stringify(snapshot).includes('lagCompensation'), false);
}

test('Online Last Stand hits the actual monster head shown 50 ms earlier without rewinding current AI movement', async t => {
  await movingMonsterShot(t, true);
});
test('Last Stand clients without view metadata retain current-authority hitscan', async t => {
  await movingMonsterShot(t, false);
});

test('A recycled monster slot gets a fresh life and cannot inherit a killed monster historical hitbox', async t => {
  const game = await host(t), room = await game.make(), seat = await game.peer(room);
  seat.peer.send({ type: 'fps-loadout', weaponId: 'marksman' }); await flushPeer(seat.peer);
  await ready([seat]); await start(room, seat); advance(game.app, room, 'fight');
  let candidate, inputSequence = 0;
  for (let tick = 0; tick < 1600 && room.state.phase === 'fight' && !candidate; tick++) {
    if (tick % 8 === 0) {
      seat.peer.send({ type: 'input', seq: inputSequence++, buttons: {} });
      await flushPeer(seat.peer);
    }
    game.app.tick();
    const warnings = room.state.spawnWarnings.filter(warning => warning.ticksLeft >= 2 && warning.ticksLeft <= 10);
    if (!warnings.length) continue;
    for (const target of room.state.players.filter(player => player.monster && player.alive && !player.emergenceTicks)) {
      // The generation negative control must keep the same anatomy. Moving a
      // short new hound onto a dead humanoid's position cannot prove lifetime
      // isolation, because the old high head ray already misses the low body.
      if (!warnings.some(warning => warning.monsterType === target.monsterType)) continue;
      const aim = aimAt(room.state.players[0], target);
      if (Voxel.traceShot(room.state, 0, aim.origin, aim.direction, 120).playerId === target.id) { candidate = { target, aim, viewTick: room.state.tick }; break; }
    }
  }
  assert.ok(candidate, 'an actual visible monster and imminent spawn warning must overlap');
  const { target: old, aim, viewTick } = candidate, oldPosition = { x: old.x, y: old.y, z: old.z, ...(monsterBodyProfile(old) ? { yaw: old.yaw } : {}) };
  applyCombatDamage(room.state, [{ targetId: old.id, playerId: 0, damage: old.maxHp + 1 }]);
  assert.equal(old.alive, false);
  let ticks = 0;
  while (room.state.players[old.id] === old && ticks++ < 12) game.app.tick();
  const replacement = room.state.players[old.id];
  assert.notEqual(replacement, old); assert.ok(replacement.alive); assert.ok(replacement.lifeId > old.lifeId);
  assert.equal(replacement.monsterType, old.monsterType, 'the lifetime control compares identical anatomy across different lives');
  assert.ok(room.state.tick - viewTick < 18, 'the historical view is still within the accepted rewind window');
  assert.notEqual(Voxel.traceShot(room.state, 0, aim.origin, aim.direction, 120).playerId, replacement.id);
  const unsafeHistory = { ...room.state, players: room.state.players.map(player => player === replacement ? { ...player, ...oldPosition } : player) };
  assert.equal(Voxel.traceShot(unsafeHistory, 0, aim.origin, aim.direction, 120).playerId, replacement.id, 'reusing old transforms without the generation guard would invent a hit');
  const hp = replacement.hp;
  assert.equal(room.slots[0].actionInputs.inspect().neutral, false, 'the active lifetime test client is outside stale-input recovery');
  seat.peer.send({ type: 'input', seq: inputSequence++, viewTick, buttons: { fire: true, yaw: aim.yaw, pitch: aim.pitch } });
  await flushPeer(seat.peer); game.app.tick();
  const shot = room.state.events.findLast(event => event.type === 'shot' && event.playerId === 0);
  assert.ok(shot); assert.notEqual(shot.targetId, replacement.id); assert.equal(replacement.hp, hp);
});

test('Last Stand validates fractional view metadata without giving clients state authority', async t => {
  const game = await host(t), room = await game.make(), { peer } = await game.peer(room);
  for (const viewTick of [-1, '0', null, {}, [], true, Number.MAX_SAFE_INTEGER + 1]) {
    await rejected(peer, { type: 'input', seq: 0, viewTick, buttons: {} }, /View tick/);
    assert.equal(room.slots[0].lastAccepted, -1); assert.equal(room.acks[0], -1);
  }
  peer.send({ type: 'input', seq: 0, viewTick: .75, buttons: { yaw: .2 } }); await flushPeer(peer);
  assert.equal(room.slots[0].queue[0].viewTick, .75);
  game.app.tick(); assert.equal(room.acks[0], 0);
  assert.equal(Object.hasOwn(room.state, 'viewTick'), false);
});

test('Intermission disconnect migrates the host and the next wave never respawns an absent teammate', async t => {
  const game = await host(t), room = await game.make(), seats = [await game.peer(room), await game.peer(room)];
  await ready(seats); await start(room, seats[0]); advance(game.app, room, 'fight');
  for (let tick = 0; tick < 2400 && room.state.phase === 'fight'; tick++) {
    game.app.tick();
    const targets = room.state.players.filter(player => player.monster && player.alive);
    if (targets.length) applyCombatDamage(room.state, targets.map(player => ({ targetId: player.id, playerId: 0, damage: player.maxHp + 1 })));
  }
  assert.equal(room.state.phase, 'intermission'); assert.equal(room.state.horde.wavesCleared, 1);
  await disconnect(seats[0], seats[1], message => message.hostId === 1 && message.players[0]?.connected === false);
  const late = game.socket(room), [locked] = await once(late.socket, 'close'); assert.equal(locked, 4409);
  advance(game.app, room, 'fight', 1000);
  assert.deepEqual(participants(room.state), [1]); assert.equal(room.state.horde.wave, 2);
  assert.equal(room.state.players[0].alive, false); assert.equal(room.state.players[1].alive, true);
});

test('The last disconnect releases an active run into a clean lobby and a replacement gets fresh authority', async t => {
  const game = await host(t), room = await game.make(), seat = await game.peer(room);
  await ready([seat]); await start(room, seat); advance(game.app, room, 'fight');
  seat.peer.send({ type: 'input', seq: 0, buttons: { fire: true, up: true } }); await flushPeer(seat.peer);
  const closed = once(seat.peer.socket, 'close'); seat.peer.socket.close(); await closed;
  assert.equal(room.state.phase, 'lobby'); assert.equal(room.hostId, null);
  assert.ok(room.players.every(player => player === null)); assert.ok(room.slots.every(slot => slot === null));
  assert.ok(room.state.players.slice(0, 3).every(player => !player.alive && !player.connected));
  assert.deepEqual(participants(room.state), []); assert.equal(room.state.horde.wave, 0);
  const replacement = await game.peer(room, 'Next host'); assert.equal(replacement.welcome.playerId, 0); assert.equal(replacement.welcome.hostId, 0);
  assert.equal(room.slots[0].lastAccepted, -1); assert.equal(room.slots[0].buttons.fire, false); assert.equal(room.slots[0].queue.length, 0);
  await ready([replacement]); await start(room, replacement); advance(game.app, room, 'fight');
  assert.equal(room.state.players[0].shots, 0); assert.deepEqual(participants(room.state), [0]);
});
