import assert from 'node:assert/strict';
import test from 'node:test';
import { combatStep, createCombatPlayer, emptyInput, eyeHeight, playerHeight } from '../public/voxel-engine.js';
import { WEAPONS } from '../public/voxel-weapons.js';
import { createHitFeedback, HIT_FEEDBACK_COLORS } from '../public/voxel-hit-feedback.js';
import * as Royale from '../public/voxel-royale-engine.js';
import * as Practice from '../public/voxel-practice-engine.js';
import * as Horde from '../public/voxel-horde-engine.js';

const sniperIds = ['sniper', 'marshal', 'outlaw', 'operator'];
const arena = { id: 'sniper-headshot-fixture', bounds: { minX: -220, maxX: 220, minZ: -220, maxZ: 220 }, colliders: [], sites: [] };
const smallArena = { ...arena, bounds: { minX: -30, maxX: 30, minZ: -30, maxZ: 30 } };
function fixture(weapon, distance = 12, { crouch = false, shooterCrouch = false, colliders = [], ally = false } = {}) {
  const shooter = createCombatPlayer(0, 1, weapon), target = createCombatPlayer(1);
  Object.assign(shooter, { x: 0, y: 0, z: 0, lifeId: 1, crouching: shooterCrouch });
  Object.assign(target, { x: 0, y: 0, z: -distance, lifeId: 1, crouching: crouch });
  const players = [shooter, target];
  if (ally) players.push(Object.assign(createCombatPlayer(2), { team: 0, x: 0, y: 0, z: -distance / 2, crouching: crouch, lifeId: 1 }));
  const state = { gameId: 'voxel-breach', phase: 'fight', tick: 0, eventId: 0, events: [], players, fighters: players, map: { ...arena, colliders }, grenades: [], bolts: [], loot: [] };
  return { state, shooter, target };
}
function aimAt(shooter, target, { y = target.y + playerHeight(target) - .16, x = target.x, fire = false } = {}) {
  const dx = x - shooter.x, dz = target.z - shooter.z;
  return { aim: true, fire, crouch: shooter.crouching, yaw: Math.atan2(dx, -dz), pitch: Math.atan2(y - shooter.y - eyeHeight(shooter), Math.hypot(dx, dz)) - shooter.recoil };
}
function step(setup, command, count = 1) {
  for (let tick = 0; tick < count; tick++) {
    setup.state.tick++; combatStep(setup.state, setup.state.players.map(player => ({ ...emptyInput(player), crouch: player.crouching, ...(player.id === 0 ? command : {}) })), setup.state.map);
  }
}
function fire(setup, aim = {}) { step(setup, aimAt(setup.shooter, setup.target, aim), 30); step(setup, aimAt(setup.shooter, setup.target, { ...aim, fire: true })); }
const damageEvents = state => state.events.filter(event => event.type === 'damage');
const wall = (material = 'stone', d = .2) => ({ id: 'headshot-cover', material, x: -2, y: 0, z: -6, w: 4, h: 3, d });

for (const weapon of sniperIds) test(`${weapon}: one settled headshot kills a real full-health player across range and crouched silhouettes`, () => {
  for (const distance of [4, 40, WEAPONS[weapon].range - 1]) for (const stance of [{}, { crouch: true }, { crouch: true, shooterCrouch: true }]) {
    const setup = fixture(weapon, distance, stance); fire(setup);
    const [hit] = damageEvents(setup.state); assert.ok(hit, `${distance}/${JSON.stringify(stance)}: aim must reach actual head flesh`);
    assert.equal(hit.hitKind, 'head'); assert.equal(hit.headshot, true); assert.equal(hit.damage, 200); assert.equal(hit.hp, 0);
    assert.equal(setup.target.alive, false); assert.equal(setup.target.deaths, 1); assert.equal(setup.shooter.kills, 1); assert.equal(setup.shooter.damageDealt, 200);
    assert.equal(setup.shooter.shots, 1); assert.equal(setup.shooter.ammo, WEAPONS[weapon].magazine - 1);
    const [kill] = setup.state.events.filter(event => event.type === 'kill'); assert.equal(kill.weapon, weapon); assert.equal(kill.headshot, true);
  }
});

for (const weapon of sniperIds) test(`${weapon}: genuine body and leg hits remain survivable and holding fire never spends another round`, () => {
  for (const region of ['body', 'leg']) {
    const setup = fixture(weapon), expected = weapon === 'sniper' ? region === 'body' ? 100 : 70 : ({ marshal: { body: 101, leg: 85.85 }, outlaw: { body: 140, leg: 119 }, operator: { body: 150, leg: 120 } })[weapon][region];
    const aim = { y: region === 'body' ? 1 : .25 }; fire(setup, aim); const [hit] = damageEvents(setup.state);
    assert.equal(hit.hitKind, region); assert.equal(hit.headshot, false); assert.ok(setup.target.alive); assert.ok(Math.abs(setup.target.hp - (200 - expected)) < 1e-8);
    step(setup, aimAt(setup.shooter, setup.target, { ...aim, fire: true }), WEAPONS[weapon].cooldown * 2 + 20);
    assert.equal(setup.shooter.shots, 1); assert.equal(setup.shooter.ammo, WEAPONS[weapon].magazine - 1); assert.equal(damageEvents(setup.state).length, 1);
    const feedback = createHitFeedback().consume(setup.state.events, setup.shooter, setup.state.players, { now: 100, lifeKey: 1 });
    assert.equal(feedback.kind, 'body'); assert.equal(feedback.color, HIT_FEEDBACK_COLORS.body);
  }
});

for (const weapon of sniperIds) test(`${weapon}: hard cover and allied heads shield an enemy without damage or gold feedback`, () => {
  for (const blocked of [{ colliders: [wall()] }, { ally: true }]) {
    const setup = fixture(weapon, 12, blocked); fire(setup);
    assert.equal(setup.target.hp, 200); assert.equal(setup.target.alive, true); assert.equal(setup.shooter.kills, 0); assert.equal(damageEvents(setup.state).length, 0);
    assert.equal(setup.shooter.ammo, WEAPONS[weapon].magazine - 1, 'a blocked round is still spent');
    if (blocked.ally) assert.equal(setup.state.players[2].hp, 200);
    assert.equal(createHitFeedback().consume(setup.state.events, setup.shooter, setup.state.players, { now: 100, lifeKey: 1 }).visible, false);
  }
});

test('sniper critical damage preserves real penetration losses instead of bypassing cover', () => {
  for (const weapon of ['marshal', 'outlaw', 'operator']) {
    const setup = fixture(weapon, 12, { colliders: [wall('wood', .35)] }); fire(setup); const [hit] = damageEvents(setup.state);
    assert.equal(hit.hitKind, 'head'); assert.equal(hit.headshot, true); assert.equal(hit.penetrationCount, 1);
    assert.ok(hit.damage > 0 && hit.damage < 200); assert.ok(setup.target.hp > 0 && setup.target.hp < 200);
    assert.equal(setup.target.alive, true, 'cover attenuation still matters');
  }
});

test('the actual narrow head region distinguishes a head edge, near-head air and the torso below the jaw', () => {
  for (const weapon of sniperIds) {
    const edge = fixture(weapon, 10); fire(edge, { x: .18 }); assert.equal(damageEvents(edge.state)[0].hitKind, 'head'); assert.equal(edge.target.hp, 0);
    const air = fixture(weapon, 10); fire(air, { x: .26 }); assert.equal(damageEvents(air.state).length, 0); assert.equal(air.target.hp, 200);
    const torso = fixture(weapon, 10); fire(torso, { y: 1.45 }); assert.equal(damageEvents(torso.state)[0].hitKind, 'body'); assert.ok(torso.target.alive);
  }
});

test('a confirmed sniper head kill paints one gold pulse and repeated event snapshots cannot replay it', () => {
  const setup = fixture('sniper'); fire(setup); const reporter = createHitFeedback();
  const first = reporter.consume(setup.state.events, setup.shooter, setup.state.players, { now: 100, lifeKey: 1 }); assert.equal(first.visible, true); assert.equal(first.kind, 'headshot'); assert.equal(first.color, '#ffd45a');
  const duplicate = reporter.consume(setup.state.events, setup.shooter, setup.state.players, { now: 130, lifeKey: 1 }); assert.equal(duplicate.pulse, first.pulse); assert.equal(duplicate.at, first.at);
  assert.equal(reporter.present(setup.shooter, { now: 341, lifeKey: 1 }).visible, false);
  reporter.consume(setup.state.events, setup.shooter, setup.state.players, { now: 350, lifeKey: 1 }); assert.equal(reporter.present(setup.shooter, { now: 350, lifeKey: 1 }).visible, false);
});

test('semi-auto marksman and Guardian retain their precision-rifle damage rather than receiving sniper instant kills', () => {
  for (const [weapon, hp] of [['marksman', 84], ['guardian', 5]]) { const setup = fixture(weapon); fire(setup); assert.equal(damageEvents(setup.state)[0].hitKind, 'head'); assert.equal(setup.target.hp, hp); assert.equal(setup.target.alive, true); }
});

test('a genuinely looted Rook headshot ends an actual two-player Royale with one honest kill', () => {
  const state = Royale.createState({ capacity: 2, seed: 9521 }); Royale.startMatch(state, [0, 1]);
  while (state.phase === 'countdown') Royale.step(state);
  state.map = smallArena; state.loot = []; const [shooter, target] = state.players;
  Object.assign(shooter, { x: 0, y: 0, z: 0 }); Object.assign(target, { x: 0, y: 0, z: -12 });
  state.loot = [{ id: ++state.lootId, kind: 'weapon', weapon: 'sniper', ammo: 5, reserve: 15, x: 0, y: 0, z: 0 }]; Royale.step(state, [{ interact: true }, {}]);
  assert.equal(shooter.weapon, 'sniper'); assert.equal(shooter.slot, 'primary');
  for (let tick = 0; tick < 30; tick++) Royale.step(state, [aimAt(shooter, target), {}]); Royale.step(state, [aimAt(shooter, target, { fire: true }), {}]);
  assert.equal(state.phase, 'matchEnd'); assert.equal(state.winnerId, 0); assert.equal(target.hp, 0); assert.equal(shooter.kills, 1); assert.equal(shooter.damageDealt, 200); assert.equal(shooter.shots, 1);
  assert.equal(state.events.filter(event => event.type === 'kill' && event.headshot).length, 1);
});

test('an actual moving-target practice run records a one-shot head kill and one hit without inflating damage', () => {
  const state = Practice.createPractice({ bots: 1, mode: 'targets', weapon: 'sniper', seed: 6127 }); Practice.startPractice(state);
  while (state.phase === 'countdown') Practice.stepPractice(state);
  state.map = smallArena; const [shooter, target] = state.players; Object.assign(shooter, { x: 0, y: 0, z: 0 }); Object.assign(target, { x: 0, y: 0, z: -12 });
  for (let tick = 0; tick < 30; tick++) Practice.stepPractice(state, aimAt(shooter, target));
  const moved = { x: target.x, z: target.z }; assert.ok(Math.hypot(moved.x, moved.z + 12) > .01, 'the bot uses its real patrol');
  Practice.stepPractice(state, aimAt(shooter, target, { fire: true }));
  assert.equal(target.hp, 0); assert.equal(state.phase, 'matchEnd'); assert.equal(state.practice.result, 'won');
  const stats = Practice.getPracticeStats(state); assert.equal(stats.shots, 1); assert.equal(stats.hits, 1); assert.equal(stats.kills, 1); assert.equal(stats.damageDealt, 200);
});

test('a real early Last Stand stalker takes an honest sniper head kill through the shared combat engine', () => {
  // Keep a real lobby loadout and a genuine spawned monster.
  const fresh = Horde.createState({ capacity: 1, seed: 73291 }); Horde.selectLoadout(fresh, 0, 'sniper'); Horde.startMatch(fresh, [0]); while (fresh.phase === 'countdown') Horde.step(fresh);
  fresh.map = smallArena; fresh.horde.pending = 1; fresh.horde.nextSpawnTick = Number.MAX_SAFE_INTEGER;
  const human = fresh.players[0]; Object.assign(human, { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 });
  fresh.spawnWarnings = [{ id: 1, x: 0, y: 0, z: -8, ticksLeft: 1, monsterType: 'stalker' }]; Horde.step(fresh); const target = fresh.players.find(player => player.monster);
  assert.ok(target); const originalHp = target.hp;
  for (let tick = 0; tick < 30; tick++) Horde.step(fresh, [aimAt(human, target)]);
  Horde.step(fresh, [aimAt(human, target, { fire: true })]); const hit = damageEvents(fresh).find(event => event.playerId === 0);
  assert.ok(hit); assert.equal(hit.hitKind, 'head'); assert.equal(target.hp, 0); assert.equal(hit.damage, originalHp); assert.equal(human.kills, 1); assert.equal(fresh.horde.totalKills, 1);
});


function bruteEncounter(weapon) {
  const state = Horde.createState({ capacity: 1, seed: 8933 }); Horde.selectLoadout(state, 0, weapon); Horde.startMatch(state, [0]);
  while (state.phase === 'countdown') Horde.step(state);
  state.map = smallArena; state.horde.wave = 12; state.horde.pending = 1; state.horde.nextSpawnTick = Number.MAX_SAFE_INTEGER;
  const shooter = state.players[0]; Object.assign(shooter, { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 });
  state.spawnWarnings = [{ id: 1, x: 0, y: 0, z: -8, ticksLeft: 1, monsterType: 'brute' }]; Horde.step(state);
  const target = state.players.find(player => player.monster); assert.equal(target.monsterType, 'brute'); assert.ok(target.hp > 500, 'a genuinely scaled late-wave brute');
  for (let tick = 0; tick < 30; tick++) Horde.step(state, [aimAt(shooter, target)]);
  return { state, shooter, target };
}

for (const weapon of sniperIds) test(`${weapon}: a clean headshot kills an actual high-health late-wave brute with honest damage and corpse metadata`, () => {
  const { state, shooter, target } = bruteEncounter(weapon), hp = target.hp, life = target.lifeId;
  Horde.step(state, [aimAt(shooter, target, { fire: true })]); const hit = damageEvents(state).find(event => event.playerId === 0);
  assert.equal(hit.hitKind, 'head'); assert.equal(hit.headshot, true); assert.equal(hit.damage, hp); assert.equal(target.hp, 0); assert.equal(target.alive, false);
  assert.equal(shooter.damageDealt, hp); assert.equal(shooter.shots, 1); assert.equal(shooter.kills, 1); assert.equal(state.horde.totalKills, 1);
  const kill = state.events.find(event => event.type === 'kill'); assert.equal(kill.monsterType, 'brute'); assert.equal(kill.targetLifeId, life); assert.equal(kill.headshot, true);
});

test('late-wave brute body and leg contacts stay numeric damage rather than receiving sniper executions', () => {
  for (const weapon of sniperIds) for (const region of ['body', 'leg']) {
    const { state, shooter, target } = bruteEncounter(weapon), hp = target.hp;
    Horde.step(state, [aimAt(shooter, target, { fire: true, y: region === 'body' ? 1 : .25 })]);
    const hit = damageEvents(state).find(event => event.playerId === 0); assert.equal(hit.hitKind, region); assert.equal(hit.headshot, false);
    assert.ok(target.alive && target.hp > 0 && target.hp < hp); assert.ok(hit.damage < 200); assert.equal(shooter.kills, 0);
  }
});

test('penetrated sniper head contacts damage an actual late brute without executing through thin cover', () => {
  for (const weapon of ['marshal', 'outlaw', 'operator']) {
    const { state, shooter, target } = bruteEncounter(weapon), hp = target.hp;
    state.map = { ...smallArena, colliders: [wall('wood', .35)] }; Horde.step(state, [aimAt(shooter, target, { fire: true })]);
    const hit = damageEvents(state).find(event => event.playerId === 0); assert.equal(hit.hitKind, 'head'); assert.equal(hit.penetrationCount, 1);
    assert.ok(target.alive && target.hp > 0); assert.ok(hit.damage < hp); assert.equal(shooter.kills, 0);
  }
});

test('an earlier body attenuates sniper penetration so the brute behind it cannot receive a clean-head execution', () => {
  for (const weapon of ['marshal', 'outlaw', 'operator']) {
    const { state, shooter, target } = bruteEncounter(weapon), hp = target.hp;
    const front = Object.assign(createCombatPlayer(2), { team: 1, x: 0, y: 0, z: -4, lifeId: 2 }); state.players.push(front); state.fighters = state.players;
    Horde.step(state, [aimAt(shooter, target, { fire: true })]);
    const hit = damageEvents(state).find(event => event.targetId === target.id && event.playerId === 0); assert.ok(hit); assert.equal(hit.hitKind, 'head');
    assert.ok(target.alive && target.hp > 0); assert.ok(hit.damage < hp); assert.equal(shooter.kills, 1, 'the unattenuated front human is a separate legitimate head kill');
  }
});

test('a traced sniper execution cannot damage a different monster life replaced before the damage batch applies', () => {
  for (const weapon of sniperIds) {
    const setup = bruteEncounter(weapon), hp = setup.target.hp, oldLife = setup.target.lifeId;
    setup.state.tick++; combatStep(setup.state, setup.state.players.map(player => player.id === 0 ? { ...emptyInput(player), ...aimAt(setup.shooter, setup.target, { fire: true }) } : emptyInput(player)), setup.state.map, {
      additionalDamage() { setup.target.lifeId++; setup.target.hp = setup.target.maxHp; return []; },
    });
    assert.equal(setup.target.lifeId, oldLife + 1); assert.equal(setup.target.hp, hp); assert.equal(setup.target.alive, true); assert.equal(setup.shooter.kills, 0);
    assert.equal(damageEvents(setup.state).length, 0); assert.equal(setup.shooter.shots, 1, 'the accepted round is still spent');
  }
});
