import assert from 'node:assert/strict';
import test from 'node:test';
import { createState, startMatch, resetLobby, setConnected, selectLoadout, step, pauseMatch, resumeMatch, HORDE_RULES, TICK_RATE, MAPS, emptyInput } from '../public/voxel-horde-engine.js';
import { PLAYER_HEALTH, WORLD, predictLocalMovement } from '../public/voxel-engine.js';
import { navigationCanOccupy } from '../public/voxel-navigation.js';

function advance(state, ticks, inputs = []) {
  for (let tick = 0; tick < ticks; tick++) step(state, typeof inputs === 'function' ? inputs(state, tick) : inputs);
  return state;
}
function started(options = {}, ids = [0]) {
  const state = createState({ seed: 7193, ...options }); startMatch(state, ids); advance(state, state.phaseTicks);
  assert.equal(state.phase, 'fight'); return state;
}

test('Last Stand waits for explicit Start and accepts one to three fixed human seats', () => {
  for (const capacity of [1, 2, 3]) {
    const state = createState({ capacity }); assert.equal(state.phase, 'lobby'); assert.equal(state.players.length, capacity); assert.equal(state.players, state.fighters);
    const before = JSON.stringify(state); advance(state, 500, [{ up: true, fire: true }]); assert.equal(JSON.stringify(state), before);
    assert.equal(startMatch(state, Array.from({ length: capacity }, (_, id) => id)), state);
    assert.equal(state.phase, 'countdown'); assert.equal(state.phaseTicks, 3 * TICK_RATE);
    assert.equal(state.capacity, capacity); assert.equal(state.players.filter(player => player.alive).length, capacity);
    assert.ok(state.players.every((player, id) => player.id === id && player.team === 0 && player.hp === PLAYER_HEALTH));
  }
  for (const options of [{ capacity: 0 }, { capacity: 4 }, { capacity: 1.2 }, { mapId: '__proto__' }, { difficulty: '__proto__' }, { seed: NaN }, { seed: -1 }, { seed: 2 ** 32 }, { seed: 3.2 }]) assert.throws(() => createState(options), RangeError);
  for (const ids of [[], [3], [0, 0], [-1], [1.2], ['0']]) assert.throws(() => startMatch(createState(), ids), RangeError);
});

test('the same solo seats scale by active humans rather than reserved room capacity', () => {
  const solo = started({ capacity: 3 }), oneSeat = started({ capacity: 1 }), duo = started({}, [0, 2]), trio = started({}, [0, 1, 2]);
  assert.equal(solo.horde.pending, oneSeat.horde.pending);
  assert.ok(solo.horde.pending < duo.horde.pending && duo.horde.pending < trio.horde.pending);
  assert.deepEqual(duo.horde.participantIds, [0, 2]); assert.equal(duo.players[1].alive, false); assert.equal(duo.players[1].participating, false);
});

test('countdown fences held actions but permits a genuine new press after the bell', () => {
  const state = createState(); startMatch(state);
  const player = state.players[0], pose = [player.x, player.y, player.z];
  advance(state, state.phaseTicks, [{ up: true, fire: true, jump: true, grenade: true, heal: true }]);
  assert.equal(state.phase, 'fight'); assert.deepEqual([player.x, player.y, player.z], pose); assert.equal(state.horde.elapsedTicks, 0);
  step(state, [{ fire: true, jump: true, grenade: true, heal: true }]); assert.equal(player.shots, 0); assert.equal(player.y, 0); assert.equal(state.grenades.length, 0);
  step(state, []); step(state, [{ fire: true, jump: true }]); assert.equal(player.shots, 1); assert.ok(player.y > 0);
  const fresh = started(); step(fresh, [{ fire: true }]); assert.equal(fresh.players[0].shots, 1, 'first fresh post-bell press was discarded');
});

test('solo pause freezes all authoritative clocks and fences held actions on resume', () => {
  const state = started(), player = state.players[0]; advance(state, 150, [{ up: true }]);
  pauseMatch(state); assert.equal(state.phase, 'paused'); const paused = JSON.stringify(state);
  advance(state, 600, [{ fire: true, jump: true, grenade: true }]); assert.equal(JSON.stringify(state), paused);
  resumeMatch(state); const shots = player.shots; step(state, [{ fire: true, jump: true, grenade: true }]); assert.equal(player.shots, shots); assert.equal(state.grenades.length, 0);
  step(state); step(state, [{ jump: true }]); assert.ok(player.y > 0);
  const coop = started({}, [0, 1]); pauseMatch(coop); assert.equal(coop.phase, 'fight');
  const airborne = started(); step(airborne, [{ jump: true, up: true }]);
  const momentum = [airborne.players[0].vx, airborne.players[0].vy, airborne.players[0].vz];
  pauseMatch(airborne); advance(airborne, 400); resumeMatch(airborne);
  assert.deepEqual([airborne.players[0].vx, airborne.players[0].vy, airborne.players[0].vz], momentum, 'pause changed a live jump trajectory');
});

test('loadouts are real shared guns and locked once a wave is live', () => {
  const state = createState(); assert.equal(selectLoadout(state, 0, 'sniper').ok, true); assert.equal(state.players[0].ammo, 5);
  assert.equal(selectLoadout(state, 0, '__proto__').ok, false); assert.equal(selectLoadout(state, 3, 'carbine').ok, false);
  startMatch(state); assert.equal(state.players[0].weapon, 'sniper'); advance(state, state.phaseTicks);
  assert.equal(selectLoadout(state, 0, 'smg').ok, false);
});

test('monster rifts are telegraphed, spawn far away, and retain legal shared bodies', () => {
  const state = started(); step(state);
  assert.equal(state.spawnWarnings.length, 1); const warning = state.spawnWarnings[0], human = state.players[0];
  assert.equal(warning.ticksLeft, HORDE_RULES.spawnWarningTicks); assert.ok(Math.hypot(human.x - warning.x, human.z - warning.z) >= 8);
  assert.equal(state.players.filter(player => player.monster).length, 0);
  advance(state, HORDE_RULES.spawnWarningTicks - 1); assert.equal(state.players.filter(player => player.monster).length, 0);
  step(state); const monster = state.players.find(player => player.monster);
  assert.equal(monster.id, state.capacity); assert.equal(monster.team, 1); assert.equal(monster.monsterType, 'stalker'); assert.equal(monster.monsterState, 'emerging');
  assert.ok(navigationCanOccupy(MAPS[state.mapId], monster)); assert.equal(monster.radius, WORLD.radius);
  assert.ok(state.players.every((player, index) => player.id === index));
});

test('all authored maps have collision-safe, separated human starts and safe rifts', () => {
  for (const mapId of Object.keys(MAPS)) {
    const state = started({ mapId }, [0, 1, 2]);
    for (const player of state.players) assert.ok(navigationCanOccupy(MAPS[mapId], player), `${mapId}: illegal human spawn`);
    for (const a of state.players) for (const b of state.players) if (a.id !== b.id) assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= a.radius + b.radius);
    advance(state, 24); assert.equal(state.spawnWarnings.length, 1, `${mapId}: no safe spawn candidate`);
    const warning = state.spawnWarnings[0]; assert.ok(navigationCanOccupy(MAPS[mapId], warning));
    assert.ok(state.players.every(player => Math.hypot(player.x - warning.x, player.z - warning.z) >= 8));
  }
});

test('the seeded simulation produces reproducible rifts, movement and combat outcomes', () => {
  const first = started({ seed: 419 }), second = started({ seed: 419 });
  for (let tick = 0; tick < 800; tick++) {
    const inputs = [{ up: tick < 120, left: tick >= 300 && tick < 400, yaw: .4, pitch: -.03, fire: tick > 500 }];
    step(first, inputs); step(second, inputs);
  }
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  const other = started({ seed: 0xdecafbad });
  for (let tick = 0; tick < 800; tick++) step(other, [{ up: tick < 120, left: tick >= 300 && tick < 400, yaw: .4, pitch: -.03, fire: tick > 500 }]);
  assert.notDeepEqual(other.events.filter(event => event.type === 'monsterRift').map(({ x, z }) => [x, z]), first.events.filter(event => event.type === 'monsterRift').map(({ x, z }) => [x, z]));
});

test('wave movement uses the same swept jump, acceleration and ADS physics', () => {
  const state = started(), player = state.players[0], predicted = structuredClone(player);
  const raw = { ...emptyInput(player), up: true, right: true, jump: true, aim: true };
  predictLocalMovement(predicted, raw, MAPS[state.mapId]); step(state, [raw]);
  for (const key of ['x', 'y', 'z', 'vx', 'vy', 'vz', 'grounded', 'crouching']) assert.equal(player[key], predicted[key], key);
});

test('disconnects never leave invisible living human targets and lobby reset preserves seats', () => {
  const state = started({}, [0, 2]); setConnected(state, 2, false);
  assert.equal(state.players[2].alive, false); assert.deepEqual(state.horde.participantIds, [0]);
  setConnected(state, 2, true); assert.equal(state.players[2].alive, false); assert.equal(state.players[2].participating, false);
  setConnected(state, 0, false); step(state); assert.equal(state.phase, 'matchEnd'); assert.equal(state.horde.result, 'lost');
  const ended = JSON.stringify(state); advance(state, 400); assert.equal(JSON.stringify(state), ended);
  resetLobby(state); assert.equal(state.phase, 'lobby'); assert.equal(state.players.length, 3);
  assert.equal(state.players[0].connected, false); assert.equal(state.players[0].alive, false); assert.equal(state.players[2].connected, true); assert.equal(state.players[2].alive, true);
});

test('intermission permits real movement and E resupply while all combat commitments are disabled', () => {
  const state = started(), player = state.players[0];
  state.horde.pending = 0; state.horde.nextSpawnTick = Number.MAX_SAFE_INTEGER; step(state);
  assert.equal(state.phase, 'intermission'); const start = { x: player.x, z: player.z }, clock = state.horde.elapsedTicks;
  advance(state, 60, [{ up: true, fire: true, grenade: true, heal: true, swap: true, reload: true }]);
  assert.ok(Math.hypot(player.x - start.x, player.z - start.z) > 1.5); assert.equal(player.shots, 0); assert.equal(state.grenades.length, 0); assert.equal(player.slot, 'primary'); assert.equal(player.healTicks, 0);
  assert.equal(state.horde.elapsedTicks, clock);
  advance(state, 25); player.hp = 100;
  state.loot.push({ id: 100, type: 'potion', kind: 'heal', x: player.x + .5, y: player.y, z: player.z, amount: 1, expiresTick: state.tick + 1000 });
  step(state, [{ interact: true }]); assert.equal(player.hp, 100);assert.equal(player.potions,1); assert.equal(state.loot.some(loot => loot.id === 100), false);
  step(state, [{ jump: true, aim: true }]); assert.ok(player.y > 0); assert.equal(player.aiming, false); assert.equal(player.parryTicks, 0); assert.equal(player.meleeTicks, 0);
  advance(state, state.phaseTicks, [{ fire: true, jump: true }]); assert.equal(state.phase, 'fight'); assert.equal(state.horde.wave, 2);
  const shots = player.shots; step(state, [{ fire: true, jump: true }]); assert.equal(player.shots, shots, 'held respite trigger escaped its fence');
  step(state); step(state, [{ fire: true }]); assert.equal(player.shots, shots + 1);
});

test('a wave clear cancels an unfinished burst before safe intermission physics', () => {
  const state = createState(); selectLoadout(state, 0, 'burst'); startMatch(state); advance(state, state.phaseTicks);
  state.horde.pending = 0; state.horde.nextSpawnTick = Number.MAX_SAFE_INTEGER;
  step(state, [{ fire: true }]); assert.equal(state.phase, 'intermission'); assert.equal(state.players[0].shots, 1); assert.equal(state.players[0].burstRemaining, 0);
  advance(state, 100, [{ fire: true }]); assert.equal(state.players[0].shots, 1); assert.equal(state.events.filter(event => event.type === 'shot').length, 1);
});
