import assert from 'node:assert/strict';
import test from 'node:test';
import * as Horde from '../public/voxel-horde-engine.js';
import { applyCombatDamage, cloneState, emptyInput, playerHeight, WORLD } from '../public/voxel-engine.js';
import { monsterMovementSpeed, monsterMovementMultiplier } from '../public/voxel-monster-bodies.js';

const arena = Object.freeze({ id: 'monster-species-arena', bounds: Object.freeze({ minX: -25, maxX: 25, minZ: -22, maxZ: 22 }), colliders: Object.freeze([]), spawns: Horde.MAPS.courtyard.spawns });
function advance(state, ticks, inputs = []) { for (let tick = 0; tick < ticks; tick++) Horde.step(state, typeof inputs === 'function' ? inputs(state, tick) : inputs); }
function pose(player, x, z, yaw = 0) { Object.assign(player, { x, y: 0, z, yaw, pitch: 0, vx: 0, vy: 0, vz: 0, grounded: true }); player.previousInput = emptyInput(player); return player; }
function fixture({ wave = 1, seed = 12291, capacity = 1, participants = [0] } = {}) {
  const state = Horde.createState({ capacity, seed }); Horde.startMatch(state, participants); advance(state, state.phaseTicks);
  state.map = arena; state.horde.wave = wave; state.horde.pending = 1; state.horde.nextSpawnTick = Number.MAX_SAFE_INTEGER;
  pose(state.players[participants[0]], 0, 0);
  for (const id of participants.slice(1)) pose(state.players[id], 7, 2);
  return state;
}
function spawn(state, type, x = 0, z = -8) {
  state.spawnWarnings.push({ id: ++state.horde.spawnId, x, y: 0, z, ticksLeft: 1, monsterType: type });
  Horde.step(state); const player = state.players.findLast(peer => peer.monster && peer.monsterType === type && peer.emergenceTicks === Horde.HORDE_RULES.emergenceTicks - 1);
  assert.ok(player, `${type} must be materialized through a real rift`); player.emergenceTicks = 0;
  const brain = state.horde.brains[player.id]; brain.nextPlanTick = Number.MAX_SAFE_INTEGER; brain.path = [];
  return { player, brain };
}
function single(type, wave = 1, distance = 1.35) {
  const state = fixture({ wave }); const { player, brain } = spawn(state, type);
  pose(player, 0, -distance, Math.PI); brain.targetId = 0; brain.nextSightTick = 0;
  return { state, human: state.players[0], player, brain };
}
function roaring({ wall = false } = {}) {
  const state = fixture({ wave: 5 }); const ally = spawn(state, 'stalker', -8, -8), singer = spawn(state, 'screecher', 8, -8);
  pose(ally.player, -1.6, -4.5, Math.PI); pose(singer.player, 0, -4, Math.PI);
  ally.brain.visible = false; ally.brain.nextSightTick = Number.MAX_SAFE_INTEGER;
  singer.brain.nextRoarTick = state.tick; singer.brain.nextSightTick = 0;
  if (wall) state.map = { ...arena, colliders: [{ id: 'rally-cover', x: -.85, y: 0, z: -5.8, w: .12, h: 3, d: 2.5 }] };
  return { state, ally, singer };
}

test('new species have distinct finite roles while the five original combat profiles remain available', () => {
  assert.equal(Object.keys(Horde.MONSTER_TYPES).length, 11);
  const { hound, runner, leaper, screecher } = Horde.MONSTER_TYPES;
  assert.ok(hound.health < runner.health); assert.ok(hound.damage < runner.damage); assert.ok(hound.windup < runner.windup);
  assert.equal(hound.speed, 6.8); assert.equal(leaper.lungeTicks, 30); assert.equal(screecher.roarCooldown, 720);
  for (const type of ['hound', 'leaper', 'screecher']) {
    const profile = Horde.MONSTER_TYPES[type]; assert.equal(profile.unarmed, true); assert.equal(profile.gun, undefined); assert.equal(profile.weapon, undefined);
    assert.ok(Object.values(profile).filter(value => typeof value === 'number').every(value => Number.isFinite(value) && value > 0));
  }
});

test('real early-wave hounds have low quadruped bodies, no physical weapons and a weak committed bite', () => {
  const { state, human, player, brain } = single('hound', 1, 1.2);
  assert.equal(player.maxHp, 45); assert.equal(playerHeight(player), .8); assert.equal(player.radius, .5);
  assert.deepEqual(player.inventory, [null, null, null, null]); assert.equal(player.hasGun, false); assert.equal(player.ammo, 0); assert.equal(player.reserve, 0);
  Horde.step(state); assert.equal(brain.attackTicks, 24); advance(state, 24);
  assert.equal(human.maxHp - human.hp, 12); assert.equal(player.shots, 0);
  assert.equal(state.events.findLast(event => event.type === 'damage').weapon, 'hound');
  assert.ok(state.events.some(event => event.type === 'monsterWindup' && event.monsterType === 'hound' && event.ticks === 24));
});

test('hound movement is faster than runners and remains independent of the unused legacy gun tag', () => {
  const hound = single('hound', 2, 9), runner = single('runner', 2, 9);
  for (const actor of [hound, runner]) actor.brain.path = [{ x: 0, y: 0, z: 0 }];
  hound.player.weapon = 'lmg'; advance(hound.state, 60); advance(runner.state, 60);
  assert.ok(hound.player.z > runner.player.z + .25, 'the smaller hound must close the same distance sooner');
  assert.ok(Math.abs(Math.hypot(hound.player.vx, hound.player.vz) - 6.8) < 1e-8);
  assert.equal(hound.player.shots, 0); assert.deepEqual(hound.player.inventory, [null, null, null, null]);
});

test('hounds and other new creatures never generate guns or blades, while five-kill health resupply remains guaranteed', () => {
  for (const type of ['hound', 'leaper', 'screecher', 'bomber', 'spitter', 'weaver']) for (const seed of [1, 92, 9216, 12291]) {
    const state = fixture({ seed, wave: 5 }); const { player } = spawn(state, type);
    applyCombatDamage(state, [{ playerId: 0, targetId: player.id, damage: player.hp, attack: 'gun', weapon: 'pistol' }]); Horde.step(state);
    assert.ok(state.loot.every(drop => drop.kind !== 'weapon' && drop.kind !== 'melee'), `${type}:${seed}`);
    assert.equal(player.shots, 0);
  }
  const state = fixture(); const { player } = spawn(state, 'hound'); state.horde.killsSinceHeal = 4;
  applyCombatDamage(state, [{ playerId: 0, targetId: player.id, damage: player.hp, attack: 'gun', weapon: 'pistol' }]); Horde.step(state);
  assert.equal(state.loot.length, 1); assert.equal(state.loot[0].type, 'potion'); assert.equal(state.loot[0].amount, 1);
});

test('a leaper warns before a fixed-direction collision-aware lunge and can hit only once', () => {
  const { state, human, player, brain } = single('leaper', 3, 2.7);
  Horde.step(state); assert.equal(player.monsterState, 'lungeWindup'); assert.equal(brain.attackTicks, 54); assert.equal(human.hp, human.maxHp);
  advance(state, 53); assert.equal(player.monsterState, 'lungeWindup'); assert.equal(player.z, -2.7);
  advance(state, 1); assert.equal(player.monsterState, 'leap'); assert.equal(player.lungeTicks, 30);
  advance(state, 30); assert.equal(human.maxHp - human.hp, 26);
  assert.equal(state.events.filter(event => event.type === 'damage' && event.playerId === player.id).length, 1);
  assert.ok(brain.recoverTicks > 0); assert.equal(brain.lungeTicks, 0);
  assert.ok(player.z < -.64 + 1e-7, 'the lunge cannot overlap or pass through its target body');
});

test('sidestepping after a leaper commitment avoids its attack without changing its dash yaw', () => {
  const { state, human, player, brain } = single('leaper', 3, 2.7);
  Horde.step(state); const committedYaw = brain.attackYaw;
  advance(state, 84, [{ right: true, yaw: 0 }]);
  assert.equal(human.hp, human.maxHp); assert.equal(brain.attackYaw, committedYaw); assert.equal(player.lungeYaw, committedYaw);
  assert.ok(Math.abs(player.x) < 1e-6); assert.ok(human.x > 2.5);
  assert.equal(state.events.filter(event => event.type === 'monsterLunge').length, 1);
  assert.equal(state.events.findLast(event => event.type === 'monsterAttack' && event.monsterType === 'leaper').hit, false);
});

test('a naturally committed leaper threatens a stationary hero at its complete authored initiation range', () => {
  const { state, human, player, brain } = single('leaper', 3, Horde.MONSTER_TYPES.leaper.lungeRange);
  Horde.step(state); assert.equal(brain.attackTicks, 54); advance(state, 54);
  assert.ok(Math.abs(Math.hypot(player.vx, player.vz) - 9) < 1e-8, 'the launch is a real finite physical impulse');
  advance(state, 30); assert.equal(human.maxHp - human.hp, 26);
  assert.equal(state.events.filter(event => event.type === 'damage' && event.playerId === player.id).length, 1);
  assert.ok(player.z >= -Horde.MONSTER_TYPES.leaper.lungeRange && player.z <= -WORLD.radius * 2);
});

test('solid cover introduced after the warning stops the swept lunge and blocks its damage', () => {
  const { state, human, player, brain } = single('leaper', 3, 2.7);
  Horde.step(state); state.map = { ...arena, colliders: [{ id: 'lunge-cover', x: -4, y: 0, z: -1.2, w: 8, h: 3, d: .12 }] };
  advance(state, 84); assert.equal(human.hp, human.maxHp); assert.equal(brain.lungeTicks, 0);
  assert.ok(player.z <= -1.2 - WORLD.radius + 1e-7);
  assert.equal(state.events.findLast(event => event.type === 'monsterAttack' && event.monsterType === 'leaper').hit, false);
});

test('a screecher releases one short nearby rally after its full warning and buffs neither humans nor itself', () => {
  const { state, ally, singer } = roaring(); Horde.step(state);
  assert.equal(singer.player.monsterState, 'roar'); assert.equal(singer.brain.roarTicks, 72); assert.equal(ally.player.monsterRallyTicks, 0);
  advance(state, 71); assert.equal(ally.player.monsterRallyTicks, 0);
  Horde.step(state); const event = state.events.findLast(event => event.type === 'monsterRally');
  assert.deepEqual(event.targetIds, [ally.player.id]); assert.equal(event.ticks, 180);
  assert.equal(ally.player.monsterRallyTicks, 180); assert.equal(monsterMovementMultiplier(ally.player), 1.18);
  assert.equal(singer.player.monsterRallyTicks, 0); assert.equal(state.players[0].monsterRallyTicks, undefined);
  assert.equal(singer.brain.nextRoarTick, state.tick + 720);
  advance(state, 180); assert.equal(ally.player.monsterRallyTicks, 0); assert.equal(monsterMovementMultiplier(ally.player), 1);
  assert.equal(state.events.filter(event => event.type === 'monsterRally').length, 1);
});

test('roars respect cover and range at release, rather than caching eligible allies during the warning', () => {
  const blocked = roaring(); Horde.step(blocked.state);
  blocked.state.map = { ...arena, colliders: [{ id: 'rally-cover', x: -.85, y: 0, z: -5.8, w: .12, h: 3, d: 2.5 }] };
  advance(blocked.state, 72); assert.equal(blocked.ally.player.monsterRallyTicks, 0); assert.equal(blocked.state.events.filter(event => event.type === 'monsterRally').length, 0);
  const distant = roaring(); Horde.step(distant.state); pose(distant.ally.player, -12, -4);
  advance(distant.state, 72); assert.equal(distant.ally.player.monsterRallyTicks, 0);
  assert.equal(distant.state.events.filter(event => event.type === 'monsterRoar' && event.stage === 'release').length, 1);
});

test('multiple screechers cannot stack or refresh an already active rally', () => {
  const { state, ally, singer } = roaring(); Horde.step(state); advance(state, 72);
  const expiration = ally.brain.rallyUntilTick, second = spawn(state, 'screecher', 8, -8);
  pose(second.player, 2, -4, Math.PI); second.brain.nextRoarTick = state.tick; second.brain.nextSightTick = 0;
  singer.brain.nextRoarTick = Number.MAX_SAFE_INTEGER; Horde.step(state); assert.ok(second.brain.roarTicks > 0);
  advance(state, 72); assert.equal(ally.brain.rallyUntilTick, expiration);
  assert.equal(monsterMovementMultiplier(ally.player), 1.18); assert.ok(ally.player.monsterRallyTicks < 180);
});

test('a real blade impact cancels the rising roar, spends its cooldown and leaves no rally', () => {
  const { state, ally, singer } = roaring(); Horde.step(state); pose(state.players[0], 0, -2.6);
  Horde.step(state, [{ slot1: true, yaw: 0 }]); Horde.step(state); Horde.step(state, [{ fire: true, yaw: 0 }]); advance(state, 12);
  assert.ok(state.events.some(event => event.type === 'monsterStagger' && event.targetId === singer.player.id));
  assert.equal(singer.brain.roarTicks, 0); assert.equal(singer.player.roarTicks, 0);
  assert.ok(state.events.some(event => event.type === 'monsterRoar' && event.stage === 'interrupted'));
  assert.ok(singer.brain.nextRoarTick >= state.tick + 700);
  advance(state, 90); assert.equal(ally.player.monsterRallyTicks, 0); assert.equal(state.events.filter(event => event.type === 'monsterRally').length, 0);
});

test('an accepted blade can silence a roar during stagger immunity without resetting or extending that immunity', () => {
  const { state, ally, singer } = roaring(); Horde.step(state); pose(state.players[0], 0, -2.6);
  singer.brain.staggerReadyTick = state.tick + 300; const immunityEnds = singer.brain.staggerReadyTick;
  Horde.step(state, [{ slot1: true, yaw: 0 }]); Horde.step(state); Horde.step(state, [{ fire: true, yaw: 0 }]); advance(state, 12);
  assert.equal(singer.brain.roarTicks, 0); assert.equal(singer.brain.staggerReadyTick, immunityEnds);
  assert.equal(singer.brain.staggerTicks, 0); assert.equal(state.events.filter(event => event.type === 'monsterStagger').length, 0);
  assert.ok(state.events.some(event => event.type === 'monsterRoar' && event.stage === 'interrupted'));
  advance(state, 90); assert.equal(ally.player.monsterRallyTicks, 0);
});

test('wave composition guarantees new species introductions without flooding the first wave or changing its population', () => {
  for (const wave of [1, 2, 3, 4, 5, 7, 8]) {
    const state = fixture({ wave: wave - 1 }); state.horde.wave = wave - 1; state.phase = 'intermission'; state.phaseTicks = 1;
    Horde.step(state); const total = state.horde.pending; const types = [];
    for (let tick = 0; tick < 12000 && state.phase === 'fight'; tick++) {
      Horde.step(state);
      for (const player of state.players) if (player.monster && player.alive) { types.push(player.monsterType); applyCombatDamage(state, [{ playerId: 0, targetId: player.id, damage: player.hp, attack: 'gun', weapon: 'pistol' }]); }
    }
    assert.equal(state.phase, 'intermission'); assert.equal(types.length, total); assert.equal(total, 7 + wave * 3);
    assert.ok(types.includes('hound'), `wave ${wave}`); if (wave === 1) assert.ok(types.filter(type => type === 'hound').length <= 2);
    assert.equal(types.includes('leaper'), wave >= 3); assert.equal(types.includes('screecher'), wave >= 5); assert.equal(types.includes('sniper'), wave >= 7);
    assert.equal(types.includes('bomber'), wave >= 3); assert.equal(types.includes('spitter'), wave >= 5); assert.equal(types.includes('weaver'), wave >= 8);
  }
});

test('special commitments and rally timers freeze during solo pause and reproduce exactly for sparse co-op seats', () => {
  const paused = roaring(); Horde.step(paused.state); Horde.pauseMatch(paused.state); const frozen = JSON.stringify(paused.state);
  advance(paused.state, 500, [{ fire: true, right: true }]); assert.equal(JSON.stringify(paused.state), frozen);
  Horde.resumeMatch(paused.state); advance(paused.state, 72); assert.equal(paused.ally.player.monsterRallyTicks, 180);
  const first = fixture({ wave: 5, capacity: 3, participants: [0, 2] }); spawn(first, 'hound', -8, -8); spawn(first, 'leaper', 8, -8); spawn(first, 'screecher', 9, -12);
  const second = cloneState(first);
  for (let tick = 0; tick < 600; tick++) { const inputs = [{ right: tick < 60, yaw: 0 }, emptyInput(), { up: tick < 80, yaw: 0 }]; Horde.step(first, inputs); Horde.step(second, inputs); }
  assert.equal(JSON.stringify(first), JSON.stringify(second)); assert.deepEqual(first.horde.participantIds, [0, 2]);
  assert.ok(first.players.length <= first.capacity + Horde.HORDE_RULES.maxMonsters); assert.ok(first.events.length <= first.eventLimit);
});
