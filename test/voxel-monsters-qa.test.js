import test from 'node:test';
import assert from 'node:assert/strict';
import * as Combat from '../public/voxel-engine.js';
import * as Horde from '../public/voxel-horde-engine.js';
import { MONSTER_BODIES, monsterBodyProfile, monsterMovementSpeed, monsterMovementMultiplier } from '../public/voxel-monster-bodies.js';
import { navigationCanOccupy, navigationPoints, navigationPath } from '../public/voxel-navigation.js';
import { enableLagCompensation, recordLagCompensation, setShotViewTick, traceCompensatedShot } from '../public/voxel-lag-compensation.js';
import { setInventoryMeleeLoadout } from '../public/voxel-inventory.js';
import { MELEE_WEAPONS } from '../public/voxel-melee.js';
import { createHitFeedback } from '../public/voxel-hit-feedback.js';

const arena = Object.freeze({ id: 'monster-independent-qa', bounds: Object.freeze({ minX: -24, maxX: 24, minZ: -24, maxZ: 24 }), colliders: Object.freeze([]), spawns: Horde.MAPS.courtyard.spawns });
const near = (actual, expected, tolerance = 1e-7) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} versus ${expected}`);
const live = state => state.players.filter(player => player.monster && player.alive);
function advance(state, count, input = []) { for (let i = 0; i < count; i++) Horde.step(state, typeof input === 'function' ? input(state, i) : input); }
function pose(player, patch) { Object.assign(player, { y: 0, vx: 0, vy: 0, vz: 0, grounded: true, pitch: 0, ...patch }); player.previousInput = Combat.emptyInput(player); }
function active({ wave = 1, map = arena, capacity = 1, seed = 75131 } = {}) {
  const state = Horde.createState({ capacity, seed }); Horde.startMatch(state, Array.from({ length: capacity }, (_, id) => id));
  while (state.phase === 'countdown') Horde.step(state);
  state.map = map; state.horde.wave = wave; state.horde.pending = 1; state.horde.nextSpawnTick = 1e9;
  state.players.slice(0, capacity).forEach((player, id) => { pose(player, { x: id * 3, z: 4, yaw: 0 }); player.hp = player.maxHp = 10000; });
  return state;
}
function spawn(state, type, point = { x: 0, y: 0, z: -8 }) {
  const before = new Set(live(state).map(player => player.id));
  state.spawnWarnings = [{ id: ++state.horde.spawnId, ...point, ticksLeft: 1, monsterType: type }]; Horde.step(state);
  const monster = live(state).find(player => !before.has(player.id)); assert.ok(monster, `real ${type} rift failed`);
  monster.emergenceTicks = 0;
  const brain = state.horde.brains[monster.id]; brain.targetId = 0; brain.nextPlanTick = 1e9; brain.path = []; brain.nextSightTick = 0;
  return { monster, brain };
}
function fixture(type, options = {}) { const state = active(options); return { state, human: state.players[0], ...spawn(state, type) }; }
function trace(state, height, x = 0, z = -1, yaw = 0) {
  const own = state.players[0], origin = { x, y: height, z: own.z }, direction = { x: Math.sin(yaw), y: 0, z: z * Math.cos(yaw) };
  return Combat.traceShot(state, own.id, origin, direction, 60, state.map);
}
function physical(map, player) {
  assert.ok(['x', 'y', 'z', 'vx', 'vy', 'vz', 'yaw', 'pitch', 'hp'].every(key => Number.isFinite(player[key])));
  assert.ok(player.x >= map.bounds.minX + player.radius - 1e-6 && player.x <= map.bounds.maxX - player.radius + 1e-6);
  assert.ok(player.z >= map.bounds.minZ + player.radius - 1e-6 && player.z <= map.bounds.maxZ - player.radius + 1e-6);
  for (const box of map.colliders) {
    if (player.y >= box.y + box.h - 1e-7 || player.y + Combat.playerHeight(player) <= box.y + 1e-7) continue;
    const dx = player.x - Math.max(box.x, Math.min(box.x + box.w, player.x)), dz = player.z - Math.max(box.z, Math.min(box.z + box.d, player.z));
    assert.ok(dx * dx + dz * dz >= player.radius ** 2 - 1e-6, `${map.id}/${player.monsterType} penetrates ${box.id}`);
  }
}

test('new species preserve the original roster and hounds are smaller, faster and weaker than a stalker', () => {
  assert.deepEqual(Object.keys(Horde.MONSTER_TYPES), ['stalker', 'runner', 'brute', 'gunner', 'sniper', 'hound', 'leaper', 'screecher', 'bomber', 'spitter', 'weaver']);
  const { state, monster } = fixture('hound');
  assert.equal(monster.hp, 45); assert.equal(Combat.playerHeight(monster), .8); assert.equal(Combat.eyeHeight(monster), .66); assert.equal(monster.radius, .5);
  assert.ok(Horde.MONSTER_TYPES.hound.health < Horde.MONSTER_TYPES.stalker.health && Horde.MONSTER_TYPES.hound.damage < Horde.MONSTER_TYPES.stalker.damage);
  assert.equal(monsterMovementSpeed(monster), 6.8); assert.equal(monster.hasGun, false); assert.equal(monster.shots, 0);
  assert.deepEqual(monster.inventory, [null, null, null, null]); assert.equal(monster.potions, 0); assert.equal(monster.grenades, 0);
  assert.equal(state.players[0].maxHp, 10000, 'the fixture health is explicit; the public starter remains unchanged');
  assert.equal(Horde.createState().players[0].hp, 200);
});

test('human actors and forged species fields cannot acquire low animal silhouettes, lunge speed or rallies', () => {
  for (const patch of [{ monsterType: 'hound' }, { monster: true, human: true, monsterType: 'hound' }, { monster: true, monsterType: ['hound'] }, { monster: true, monsterType: '__proto__' }]) {
    const player = { ...Combat.createCombatPlayer(0), ...patch, monsterRallyTicks: 180, monsterState: 'leap', lungeTicks: 30 };
    assert.equal(monsterBodyProfile(player), null); assert.equal(Combat.playerHeight(player), 1.8); assert.equal(monsterMovementSpeed(player), null); assert.equal(monsterMovementMultiplier(player), 1);
    player.crouching = true; assert.equal(Combat.playerHeight(player), 1.15); assert.equal(Combat.eyeHeight(player), .98);
  }
});

test('hound bullets contact real head, torso or legs and travel through empty air above and between its legs', () => {
  const { state, monster } = fixture('hound'); pose(monster, { x: 0, z: -3, yaw: 0 }); pose(state.players[0], { x: 0, z: 3 });
  assert.equal(trace(state, .68).kind, 'head'); assert.equal(trace(state, .40).kind, 'body');
  assert.equal(trace(state, .14, .13).kind, 'leg'); assert.equal(trace(state, .14, 0).kind, 'none', 'a low ray must pass between four physical legs');
  assert.equal(trace(state, 1.62).kind, 'none'); assert.equal(trace(state, .81).kind, 'none');
  for (const yaw of [Math.PI / 2, Math.PI, -Math.PI / 2, .47]) {
    monster.yaw = yaw;
    const c = Math.cos(yaw), s = Math.sin(yaw), origin = { x: monster.x - s * 3, y: .68, z: monster.z + c * 3 }, direction = { x: s, y: 0, z: -c };
    const hit = Combat.traceShot(state, 0, origin, direction, 10, arena);
    assert.equal(hit.kind, 'head', `headshot follows the dog's continuous facing ${yaw}`); assert.equal(hit.playerId, monster.id);
  }
});

test('a hound cannot become human-sized by crouching or accidentally block a standing human headshot', () => {
  const { state, monster } = fixture('hound'); pose(monster, { x: 0, z: 0, yaw: 0 }); monster.crouching = true;
  assert.equal(Combat.playerHeight(monster), .8); assert.equal(Combat.eyeHeight(monster), .66);
  const enemy = Combat.createCombatPlayer(7); pose(enemy, { x: 0, z: -5, yaw: 0 }); enemy.team = 1; state.players.push(enemy);
  pose(state.players[0], { x: 0, z: 5 }); assert.equal(trace(state, 1.62).playerId, enemy.id);
});

test('historical hound shots rewind real low oriented flesh while current solid cover still blocks them', () => {
  const { state, monster } = fixture('hound'); state.gameId = 'voxel-breach'; state.round = 1; state.matchId = 1;
  pose(state.players[0], { x: 0, z: 0 }); pose(monster, { x: 0, z: -6, yaw: 0 }); enableLagCompensation(state);
  for (let tick = 100; tick <= 120; tick++) { state.tick = tick; monster.x = (tick - 114) * .06; monster.yaw = (tick - 114) * .07; recordLagCompensation(state); }
  const origin = { x: 0, y: .68, z: 0 }, direction = { x: 0, y: 0, z: -1 }, before = structuredClone(state);
  assert.equal(setShotViewTick(state, 0, 114), true);
  const historical = traceCompensatedShot(state, 0, origin, direction, 60, arena, Combat.traceShot);
  assert.equal(historical.kind, 'head'); assert.equal(historical.playerId, monster.id); assert.deepEqual(state, before);
  const covered = { ...arena, colliders: [{ id: 'live-cover', x: -2, y: 0, z: -3, w: 4, h: 2, d: .1 }] };
  assert.equal(traceCompensatedShot(state, 0, origin, direction, 60, covered, Combat.traceShot).colliderId, 'live-cover');
});

test('hound navigation uses its low ceiling and wider real radius without changing human clearance', () => {
  const hound = { ...Combat.createCombatPlayer(8), monster: true, human: false, monsterType: 'hound', radius: .5, x: 0, y: 0, z: 0 };
  const human = { ...Combat.createCombatPlayer(0), x: 0, y: 0, z: 0 };
  const ceiling = { ...arena, id: 'low-qa-ceiling', colliders: [{ id: 'overhead', x: -2, y: .9, z: -2, w: 4, h: .6, d: 4 }] };
  assert.equal(navigationCanOccupy(ceiling, hound), true); assert.equal(navigationCanOccupy(ceiling, human), false);
  const narrow = { ...arena, id: 'narrow-qa-gap', colliders: [{ id: 'left', x: -5, y: 0, z: -3, w: 4.56, h: 2.4, d: 6 }, { id: 'right', x: .44, y: 0, z: -3, w: 4.56, h: 2.4, d: 6 }] };
  assert.equal(navigationCanOccupy(narrow, hound), false); assert.equal(navigationCanOccupy(narrow, human), true);
  const source = JSON.stringify(ceiling), points = navigationPoints(ceiling, hound); assert.ok(points.length > 0);
  const path = navigationPath(ceiling, { ...hound, z: 4 }, { ...human, z: -4 });
  assert.ok(path.length > 0 && path.every(point => navigationCanOccupy(ceiling, { ...hound, ...point })));
  assert.equal(JSON.stringify(ceiling), source, 'body graph preparation never changes authored maps');
});

test('a weak hound bite needs the complete committed windup and can be dodged by a genuine sidestep', () => {
  for (const dodge of [false, true]) {
    const { state, monster, human, brain } = fixture('hound'); pose(monster, { x: 0, z: -.95, yaw: Math.PI }); pose(human, { x: 0, z: 0 });
    Horde.step(state); assert.equal(brain.attackTicks, 24);
    advance(state, 23, dodge ? [{ right: true }] : []); assert.equal(human.hp, human.maxHp);
    Horde.step(state, dodge ? [{ right: true }] : []);
    const attack = state.events.findLast(event => event.type === 'monsterAttack' && event.playerId === monster.id); assert.ok(attack);
    assert.equal(attack.hit, !dodge); assert.equal(human.maxHp - human.hp, dodge ? 0 : 12);
    assert.equal(monster.shots, 0); assert.equal(monster.hasGun, false);
  }
});

test('early katana and knife can strike actual low flesh; gold hound headshots confirm genuine damage', () => {
  for (const blade of ['knife', 'katana']) {
    const { state, monster, human } = fixture('hound'); pose(monster, { x: 0, z: -1.1, yaw: Math.PI }); pose(human, { x: 0, z: 0, yaw: 0 });
    assert.ok(setInventoryMeleeLoadout(human, blade, { equip: true }));
    Horde.step(state, [{ fire: true, pitch: -.7 }]); advance(state, MELEE_WEAPONS[blade].startupTicks, [{ pitch: -.7 }]);
    const hit = state.events.findLast(event => event.type === 'damage' && event.playerId === human.id && event.targetId === monster.id);
    assert.ok(hit, `${blade}: a low living body is reachable by honest melee`);
    assert.equal(hit.damage, Math.min(45, Math.round(MELEE_WEAPONS[blade].damage * 1.6))); assert.equal(human.shots, 0);
    if (blade === 'katana') assert.equal(monster.alive, false);
  }
  const { state, monster, human } = fixture('hound'); pose(monster, { x: 0, z: -4, yaw: Math.PI }); pose(human, { x: 0, z: 0, yaw: 0 });
  Horde.step(state, [{ fire: true, pitch: Math.atan2(.68 - 1.62, 4) }]);
  const damage = state.events.find(event => event.type === 'damage' && event.targetId === monster.id && event.playerId === 0);
  assert.ok(damage?.headshot); assert.equal(monster.alive, false);
  const pulse = createHitFeedback().consume(state.events, human, state.players, { now: 0 }); assert.equal(pulse.kind, 'headshot'); assert.equal(pulse.color, '#ffd45a');
});

test('every hound loot roll remains nonweapon even after a genuine kill and reused monster slot', () => {
  const state = active(); const human = state.players[0]; pose(human, { x: 0, z: 0 });
  let previousLife = 0; const kinds = new Set();
  for (let seed = 1; seed <= 80; seed++) {
    const { monster } = spawn(state, 'hound'); assert.ok(monster.lifeId > previousLife); previousLife = monster.lifeId;
    pose(monster, { x: 0, z: -4, yaw: Math.PI }); state.horde.randomState = seed * 47731; state.loot = [];
    human.shotCooldown = 0; human.ammo = human.inventory[1].ammo = 30; human.triggerBlocked = false;
    Horde.step(state, [{ fire: true, pitch: Math.atan2(.68 - 1.62, 4) }]); Horde.step(state);
    assert.equal(monster.alive, false, `seed ${seed}: a real headshot kills the hound`);
    for (const drop of state.loot) { kinds.add(drop.kind); assert.ok(!['weapon', 'melee'].includes(drop.kind), `seed ${seed}: animals cannot carry or drop blades/guns`); }
    assert.equal(monster.hasGun, false); assert.deepEqual(monster.inventory, [null, null, null, null]);
    advance(state, 80); // A real quiet interval settles recoil and heat before the next life.
  }
  assert.ok(kinds.has('heal') && kinds.has('ammo'), 'hound health/ammo supplies still cover the real drop distribution');
});

test('leapers commit a readable direction, wait their full tell and deliver one damaging lunge', () => {
  const { state, human, monster, brain } = fixture('leaper', { wave: 3 }); pose(monster, { x: 0, z: -3.6, yaw: Math.PI }); pose(human, { x: 0, z: 0 });
  Horde.step(state); assert.equal(brain.attackTicks, 54); const start = state.tick;
  advance(state, 53); assert.equal(human.hp, human.maxHp); assert.equal(monster.lungeTicks, 0);
  advance(state, 31);
  const tell = state.events.find(event => event.type === 'monsterLungeWindup' && event.playerId === monster.id), dash = state.events.find(event => event.type === 'monsterLunge' && event.playerId === monster.id);
  assert.equal(tell.tick, start); assert.equal(dash.tick - tell.tick, 54);
  const hits = state.events.filter(event => event.type === 'damage' && event.playerId === monster.id && event.targetId === human.id);
  assert.equal(hits.length, 1); assert.equal(hits[0].damage, 26); assert.equal(human.maxHp - human.hp, 26); assert.ok(brain.recoverTicks > 0);
});

test('sidestepping the leaper leaves its dash on the old line rather than tracking the target', () => {
  const { state, human, monster, brain } = fixture('leaper', { wave: 3 }); pose(monster, { x: 0, z: -3.3, yaw: Math.PI }); pose(human, { x: 0, z: 0 });
  Horde.step(state); const committed = brain.attackYaw;
  advance(state, 85, [{ right: true, yaw: 0 }]);
  assert.ok(human.x > 2); near(monster.x, 0, .000001); near(brain.attackYaw, committed); assert.equal(human.hp, human.maxHp);
  assert.ok(monster.z > -3.3, 'the ability must perform real physical movement');
  assert.equal(state.events.filter(event => event.type === 'monsterLunge' && event.playerId === monster.id).length, 1);
});

test('leaper dashes collide with new cover and friendly living bodies without striking through them', () => {
  for (const cover of ['wall', 'ally']) {
    const { state, human, monster, brain } = fixture('leaper', { wave: 3 }); pose(monster, { x: 0, z: -3.3, yaw: Math.PI }); pose(human, { x: 0, z: 0 });
    Horde.step(state); assert.equal(brain.attackTicks, 54);
    if (cover === 'wall') state.map = { ...arena, colliders: [{ id: 'solid-dash-cover', x: -20, y: 0, z: -1.9, w: 40, h: 3, d: .1 }] };
    else { const { monster: ally } = spawn(state, 'hound', { x: 10, y: 0, z: -8 }); pose(ally, { x: 0, z: -1.7 }); ally.emergenceTicks = 10000; }
    advance(state, 85); assert.equal(human.hp, human.maxHp); assert.equal(state.events.some(event => event.type === 'damage' && event.playerId === monster.id), false);
    physical(state.map, monster);
    if (cover === 'wall') assert.ok(monster.z <= -1.9 - monster.radius + 1e-6);
    else assert.equal(live(state).find(player => player.monsterType === 'hound').hp, live(state).find(player => player.monsterType === 'hound').maxHp);
  }
});

function rallyFixture() {
  const state = active({ wave: 5 }); const { monster: screecher, brain } = spawn(state, 'screecher');
  const { monster: hound, brain: houndBrain } = spawn(state, 'hound', { x: 2, y: 0, z: -8 });
  brain.nextRoarTick = state.tick; brain.nextSightTick = 0; brain.path = []; houndBrain.path = [];
  return { state, screecher, brain, hound, houndBrain, human: state.players[0] };
}

test('screecher rally waits the visible tell, boosts nearby allies briefly and restores ordinary speed exactly', () => {
  const { state, screecher, brain, hound, houndBrain } = rallyFixture(); Horde.step(state);
  assert.equal(brain.roarTicks, 72); advance(state, 71); assert.equal(hound.monsterRallyTicks, 0);
  Horde.step(state); const rally = state.events.find(event => event.type === 'monsterRally' && event.playerId === screecher.id);
  assert.ok(rally); assert.deepEqual(rally.targetIds, [hound.id]); assert.equal(hound.monsterRallyTicks, 180); assert.equal(screecher.monsterRallyTicks, 0);
  near(monsterMovementMultiplier(hound), 1.18); const expiry = houndBrain.rallyUntilTick;
  advance(state, 179); assert.equal(hound.monsterRallyTicks, 1); near(monsterMovementMultiplier(hound), 1.18);
  Horde.step(state); assert.equal(state.tick, expiry); assert.equal(hound.monsterRallyTicks, 0); assert.equal(monsterMovementMultiplier(hound), 1);
  assert.ok(brain.nextRoarTick >= rally.tick + 720);
});

test('screecher rally needs true line of sight and eight-metre range at release', () => {
  for (const obstacle of ['wall', 'range']) {
    const { state, screecher, brain, hound } = rallyFixture(); Horde.step(state); assert.equal(brain.roarTicks, 72);
    if (obstacle === 'wall') state.map = { ...arena, colliders: [{ id: 'rally-cover', x: .8, y: 0, z: -20, w: .15, h: 4, d: 40 }] };
    else pose(hound, { x: 9, z: -8 });
    advance(state, 72); assert.ok(state.events.some(event => event.type === 'monsterRoar' && event.playerId === screecher.id && event.stage === 'release'));
    assert.equal(hound.monsterRallyTicks, 0); assert.equal(state.events.some(event => event.type === 'monsterRally' && event.targetIds.includes(hound.id)), false);
  }
});

test('two overlapping screechers cannot multiply or extend a currently active rally', () => {
  const { state, screecher, brain, hound, houndBrain } = rallyFixture(); const { monster: second, brain: secondBrain } = spawn(state, 'screecher', { x: -2, y: 0, z: -8 });
  brain.nextRoarTick = state.tick; secondBrain.nextRoarTick = state.tick + 30; brain.path = secondBrain.path = []; Horde.step(state); advance(state, 72);
  const firstExpiry = houndBrain.rallyUntilTick; assert.ok(firstExpiry > state.tick); advance(state, 31);
  assert.ok(state.events.some(event => event.type === 'monsterRoar' && event.playerId === second.id && event.stage === 'release'));
  assert.equal(houndBrain.rallyUntilTick, firstExpiry); near(monsterMovementMultiplier(hound), 1.18);
  assert.equal(state.events.filter(event => event.type === 'monsterRally' && event.targetIds.includes(hound.id)).length, 1);
  assert.notEqual(screecher.id, second.id);
});

test('an accepted living blade contact interrupts a screecher roar instead of granting its buff', () => {
  const { state, screecher, brain, hound, human } = rallyFixture(); Horde.step(state); assert.equal(brain.roarTicks, 72);
  pose(human, { x: 0, z: -6.6, yaw: 0 }); setInventoryMeleeLoadout(human, 'katana', { equip: true });
  Horde.step(state, [{ fire: true }]); advance(state, MELEE_WEAPONS.katana.startupTicks);
  assert.ok(screecher.alive); assert.equal(brain.roarTicks, 0); assert.ok(brain.staggerTicks > 0);
  assert.ok(state.events.some(event => event.type === 'monsterRoar' && event.playerId === screecher.id && event.stage === 'interrupted'));
  advance(state, 100); assert.equal(hound.monsterRallyTicks, 0); assert.equal(state.events.some(event => event.type === 'monsterRally'), false);
  assert.ok(brain.nextRoarTick > state.tick);
});

test('wave introductions retain stalker pressure, cap early hounds and unlock the two later abilities on schedule', () => {
  for (const wave of [1, 2, 3, 4, 5, 7]) {
    const state = active({ wave }); state.horde.pending = wave === 1 ? 10 : 14; state.horde.nextSpawnTick = state.tick; state.horde.waveQueued = 0; state.horde.waveTypeCounts = {};
    const introduced = [];
    for (let tick = 0; tick < 1500; tick++) {
      Horde.step(state);
      // Observe each real rift when emitted: the bounded event ring can evict
      // early introductions during a later wave's gun and pellet reports.
      introduced.push(...state.events.filter(event => event.type === 'monsterRift' && event.tick === state.tick).map(event => event.monsterType));
    }
    assert.ok(introduced.includes('hound'), `wave ${wave}: hounds are actually seeded in the wave`);
    assert.equal(introduced.includes('leaper'), wave >= 3); assert.equal(introduced.includes('screecher'), wave >= 5);
    assert.equal(introduced.includes('gunner'), wave >= 4); assert.equal(introduced.includes('sniper'), wave >= 7);
    if (wave === 1) { assert.equal(introduced[0], 'stalker'); assert.equal(introduced[1], 'hound'); assert.ok(introduced.filter(type => type === 'hound').length <= 2); assert.ok(introduced.filter(type => type === 'stalker').length >= 8); }
    assert.ok(live(state).filter(player => player.monsterType === 'screecher').length <= 2); assert.ok(state.players.length <= state.capacity + 20);
  }
});

test('each new species moves with finite physical clearance in every shipped arena', () => {
  for (const map of Object.values(Horde.MAPS)) for (const type of ['hound', 'leaper', 'screecher']) {
    const state = active({ wave: 5, map }); const human = state.players[0]; pose(human, { ...map.spawns[0][0], y: map.spawns[0][0].y || 0 });
    const body = { monster: true, human: false, monsterType: type };
    const point = navigationPoints(map, body).find(point => point.y < .1 && Math.hypot(point.x - human.x, point.z - human.z) > 8);
    assert.ok(point, `${map.id}/${type}: a genuine standable rift exists`);
    const { monster, brain } = spawn(state, type, point); brain.nextPlanTick = 0;
    const start = { x: monster.x, z: monster.z };
    for (let tick = 0; tick < 500; tick++) { Horde.step(state); physical(map, monster); }
    assert.ok(Math.hypot(monster.x - start.x, monster.z - start.z) > .1, `${map.id}/${type}: pathfinding must progress rather than leave a trapped body`);
  }
});

test('mixed co-op monsters remain deterministic, snapshot-bounded and completely frozen during solo pause', () => {
  const states = [0, 1].map(() => {
    const state = active({ wave: 7, capacity: 3, seed: 89171 });
    ['hound', 'leaper', 'screecher', 'stalker', 'runner', 'brute', 'gunner', 'sniper'].forEach((type, index) => spawn(state, type, { x: (index % 4) * 3 - 4.5, y: 0, z: -8 - Math.floor(index / 4) * 3 }));
    state.horde.nextSpawnTick = state.tick; state.horde.pending = 40; return state;
  });
  for (let tick = 0; tick < 1300; tick++) for (const state of states) {
    Horde.step(state, state.players.slice(0, 3).map((player, id) => ({ right: tick % 160 < 30 && id === 0, left: tick % 160 > 130 && id === 1, fire: tick % 48 === 0, yaw: 0, pitch: -.08, reload: player.ammo === 0 })));
    assert.ok(state.players.length <= 23 && state.events.length <= 256 && state.loot.length <= 20 && state.spawnWarnings.length <= 4);
  }
  assert.deepEqual(states[0], states[1]); assert.ok(live(states[0]).length <= 20);
  const solo = rallyFixture().state; Horde.step(solo); Horde.pauseMatch(solo); const before = structuredClone(solo);
  advance(solo, 300, [{ fire: true, right: true }]); assert.deepEqual(solo, before);
  Horde.resumeMatch(solo); assert.equal(solo.phase, 'fight'); Horde.step(solo, [{ fire: true }]); assert.equal(solo.players[0].shots, 0, 'pause fences never create a queued gunshot');
});
