import assert from 'node:assert/strict';
import test from 'node:test';
import { ADS, PLAYER_HEALTH, combatStep, createCombatPlayer, emptyInput, eyeHeight, playerHeight } from '../public/voxel-engine.js';
import { WEAPONS, weaponDamage } from '../public/voxel-weapons.js';
import * as Horde from '../public/voxel-horde-engine.js';

const SHOTGUNS = ['shotgun', 'autoshotgun', 'slugshotgun', 'shorty', 'bucky', 'judge'];
const SCATTERGUNS = SHOTGUNS.filter(id => id !== 'slugshotgun');
const DISTANCES = [2, 4, 6, 10, 18];
const arena = Object.freeze({ id: 'shotgun-physical-arena', bounds: Object.freeze({ minX: -50, maxX: 50, minZ: -50, maxZ: 50 }), colliders: Object.freeze([]), spawns: Horde.MAPS.courtyard.spawns });
const wall = (distance, half = false) => ({ id: 'solid-shotgun-cover', material: 'concrete', x: -3, y: 0, z: distance / 2, w: half ? 3 : 6, h: 3, d: .2 });
const damageEvents = state => state.events.filter(event => event.type === 'damage');
const shotEvents = state => state.events.filter(event => event.type === 'shot');
const damageTo = (state, targetId) => damageEvents(state).filter(event => event.targetId === targetId).reduce((sum, event) => sum + event.damage, 0);
function pose(player, x, z, yaw = 0) {
  Object.assign(player, { x, y: 0, z, yaw, pitch: 0, vx: 0, vy: 0, vz: 0, grounded: true });
  player.previousInput = emptyInput(player); return player;
}
function aimAt(shooter, target, height = 1) {
  const dx = target.x - shooter.x, dz = target.z - shooter.z;
  return { yaw: Math.atan2(dx, -dz), pitch: Math.atan2(target.y + height - shooter.y - eyeHeight(shooter), Math.hypot(dx, dz)) - shooter.recoil };
}
function encounter(weapon, distance = 4, { hp = 10000, head = false, moving = false, covered = false, ads = false, index = 0 } = {}) {
  const shooter = pose(createCombatPlayer(0, 1, weapon), 0, distance), target = pose(createCombatPlayer(1), 0, 0, Math.PI);
  Object.assign(target, { hp, maxHp: hp, lifeId: 7 });
  Object.assign(shooter, { lifeId: 3, shotIndex: index, aimTicks: ads ? ADS.ticks : 0, vx: moving ? WEAPONS[weapon].speed : 0, ...aimAt(shooter, target, head ? 1.62 : 1) });
  const map = { ...arena, colliders: covered ? [wall(distance)] : [] };
  return { gameId: 'shotgun-role-fixture', phase: 'fight', tick: 0, map, mapId: map.id, players: [shooter, target], fighters: [shooter, target], grenades: [], grenadeId: 0, bolts: [], boltId: 0, events: [], eventId: 0, loot: [], lootId: 0 };
}
function tick(state, input = {}, count = 1) {
  for (let i = 0; i < count; i++) {
    state.tick++;
    combatStep(state, state.players.map(player => ({ ...emptyInput(player), ...(input[player.id] || {}) })), state.map);
  }
}
function shell(weapon, distance, options = {}) {
  const state = encounter(weapon, distance, options), shooter = state.players[0];
  tick(state, { 0: { fire: true, aim: options.ads === true && WEAPONS[weapon].adsSupported !== false, right: options.moving === true } });
  assert.equal(shooter.shots, 1); assert.equal(shooter.ammo, WEAPONS[weapon].magazine - 1);
  return state;
}

test('original pump, auto and precision slug have distinct viable roles against 200 HP', () => {
  for (const distance of [2, 4, 6]) {
    const pump = shell('shotgun', distance, { hp: PLAYER_HEALTH });
    assert.equal(pump.players[1].alive, false, `centered pump body shot at ${distance} m`);
    assert.equal(pump.players[0].damageDealt, PLAYER_HEALTH);
    assert.equal(pump.players[0].kills, 1);
  }
  const auto = shell('autoshotgun', 4, { hp: PLAYER_HEALTH });
  assert.equal(auto.players[1].alive, true); assert.equal(auto.players[1].hp, 74);
  tick(auto, { 0: { fire: true, ...aimAt(auto.players[0], auto.players[1]) } }, WEAPONS.autoshotgun.cooldown);
  assert.equal(auto.players[1].alive, false, 'the automatic close-range follow-up is useful');
  assert.equal(auto.players[0].shots, 2); assert.equal(auto.players[0].damageDealt, PLAYER_HEALTH);
  const slug = shell('slugshotgun', 4, { hp: PLAYER_HEALTH });
  assert.equal(slug.players[1].alive, true); assert.equal(slug.players[1].hp, 80);
  const precise = shell('slugshotgun', 10, { hp: PLAYER_HEALTH, head: true });
  assert.equal(precise.players[1].alive, false); assert.equal(damageEvents(precise)[0].headshot, true);
  const distant = shell('slugshotgun', 18, { hp: PLAYER_HEALTH, head: true });
  assert.equal(distant.players[1].alive, true, 'slug falloff keeps a distant headshot from a free kill');
});

for (const weapon of SHOTGUNS) test(`${weapon}: real shells reward close torso/head aim, lose reach, and keep movement penalties`, () => {
  const body = DISTANCES.map(distance => damageTo(shell(weapon, distance), 1));
  const head = DISTANCES.map(distance => damageTo(shell(weapon, distance, { head: true }), 1));
  const moving = DISTANCES.map(distance => damageTo(shell(weapon, distance, { moving: true }), 1));
  assert.ok(body.slice(0, 3).every(value => value > 0), 'the ordinary close torso is inside the real cone');
  assert.ok(head[0] > body[0] && head[1] > body[1], 'close deliberate head aim is rewarded');
  assert.ok(body[0] > body[4] && head[0] > head[4], 'far hits cannot retain close-range effectiveness');
  assert.ok(moving[0] > 0 && moving[1] > 0, 'moving through a tight room remains usable');
  assert.ok(moving[4] <= body[4], 'moving at range cannot make the gun more precise');
  assert.ok(body[4] < PLAYER_HEALTH / 2 || weapon === 'slugshotgun', 'scatter shells cannot snipe at 18 m');
  for (const distance of DISTANCES) {
    const blocked = shell(weapon, distance, { covered: true, moving: true, head: true });
    assert.equal(blocked.players[1].hp, 10000, `physical cover at ${distance} m`);
    assert.equal(damageEvents(blocked).length, 0);
    assert.ok(shotEvents(blocked).every(event => event.hitKind === 'wall'));
  }
});

for (const weapon of SCATTERGUNS) test(`${weapon}: actual pellets fill the cone, retain its edge under ADS, and replay deterministically`, () => {
  const hip = shell(weapon, 4), aimed = shell(weapon, 4, { ads: true });
  const own = hip.players[0], all = shotEvents(hip), centerPitch = own.pitch;
  assert.equal(all.length, WEAPONS[weapon].pellets);
  const angles = all.map(event => Math.hypot(Math.atan2(event.dx, -event.dz), Math.atan2(event.dy, Math.hypot(event.dx, event.dz)) - centerPitch));
  assert.ok(angles[0] < 1e-12, 'center pellet remains exactly on the cold aim');
  assert.ok(angles.slice(1).some(value => value < WEAPONS[weapon].pelletSpread * .55), 'there are real interior contacts instead of a hollow ring');
  assert.ok(angles.every(value => value <= WEAPONS[weapon].pelletSpread + 1e-12));
  assert.ok(angles.some(value => Math.abs(value - WEAPONS[weapon].pelletSpread) < 1e-12), 'the declared outer cone is retained');
  const vectors = state => shotEvents(state).map(({ dx, dy, dz }) => [dx, dy, dz]);
  assert.deepEqual(vectors(hip), vectors(aimed), 'supported ADS never tightens the cone; unsupported ADS retains hip fire');
  assert.deepEqual(hip, shell(weapon, 4), 'authority replays produce identical complete snapshots');
  const next = shell(weapon, 4, { index: 1 });
  assert.notDeepEqual(vectors(next).slice(1), vectors(hip).slice(1), 'later accepted shells rotate the fill pattern');
  assert.deepEqual(vectors(next)[0], vectors(hip)[0], 'rotation never drifts the centered cold pellet');
});

for (const weapon of SCATTERGUNS) test(`${weapon}: one real shell can contact two separated bodies while partial concrete cover shields only its side`, () => {
  function spreadEncounter(covered) {
    const state = encounter(weapon, 6), left = state.players[1], right = pose(createCombatPlayer(2), .38, 0, Math.PI);
    left.x = -.38; right.team = left.team; right.hp = right.maxHp = 10000; right.lifeId = 8;
    state.players.push(right); state.fighters = state.players;
    Object.assign(state.players[0], { yaw: 0, pitch: Math.atan2(1 - eyeHeight(state.players[0]), 6) });
    if (covered) state.map = { ...arena, colliders: [wall(6, true)] };
    tick(state, { 0: { fire: true } }); return state;
  }
  const open = spreadEncounter(false), covered = spreadEncounter(true);
  assert.ok(damageTo(open, 1) > 0 && damageTo(open, 2) > 0, 'different physical pellets can reach both real bodies');
  assert.equal(damageTo(covered, 1), 0, 'the covered body is shielded by concrete');
  assert.ok(damageTo(covered, 2) > 0, 'the exposed body still takes its own pellet contacts');
  assert.equal(shotEvents(open).length, WEAPONS[weapon].pellets);
  assert.equal(open.players[0].shots, 1); assert.equal(open.players[0].ammo, WEAPONS[weapon].magazine - 1);
  for (const event of damageEvents(open)) assert.ok(['body', 'leg', 'head'].includes(event.hitKind) && event.damage > 0);
});

test('slug stays one ray and missed pump/slug recovery cannot be bypassed by holding fire', () => {
  for (const weapon of ['shotgun', 'slugshotgun', 'bucky', 'shorty']) {
    const state = shell(weapon, 4), first = state.players[0].shots;
    tick(state, { 0: { fire: true } }, Math.ceil(WEAPONS[weapon].fireIntervalTicks || WEAPONS[weapon].cooldown) + 8);
    assert.equal(state.players[0].shots, first, `${weapon} needs a fresh press`);
    tick(state); tick(state, { 0: { fire: true, ...aimAt(state.players[0], state.players[1]) } });
    assert.equal(state.players[0].shots, first + 1);
    if (weapon === 'slugshotgun') assert.ok(shotEvents(state).every(event => event.pelletCount === 1));
  }
  const rifle = shell('carbine', 6), precision = shell('slugshotgun', 6);
  assert.equal(shotEvents(rifle).length, 1); assert.equal(shotEvents(precision).length, 1);
  assert.equal(damageTo(rifle, 1), weaponDamage('carbine', 'body', 6), 'single-ray rifle behavior remains unchanged');
});

test('all six shell reloads conserve physical ammunition and cannot fire during reload', () => {
  for (const weapon of SHOTGUNS) {
    const state = encounter(weapon), shooter = state.players[0]; shooter.ammo = 0; shooter.reserve = 2;
    tick(state, { 0: { reload: true } });
    tick(state, { 0: { fire: true } }, WEAPONS[weapon].reloadTicks - 1);
    assert.equal(shooter.shots, 0); assert.equal(shooter.ammo, 0); assert.equal(shooter.reserve, 2);
    tick(state);
    assert.equal(shooter.ammo, 2); assert.equal(shooter.reserve, 0);
    tick(state, { 0: { fire: true } }); assert.equal(shooter.shots, 1); assert.equal(shooter.ammo, 1);
  }
});

function hordeEncounter(weapon, type, distance, { wave = 1, head = false, moving = false, covered = false, diagnostic = false, fire = true } = {}) {
  const state = Horde.createState({ capacity: 1, seed: 73291 });
  Horde.selectLoadout(state, 0, weapon); Horde.startMatch(state);
  while (state.phase === 'countdown') Horde.step(state);
  state.map = arena; state.horde.wave = wave; state.horde.pending = 1; state.horde.nextSpawnTick = Number.MAX_SAFE_INTEGER;
  const human = pose(state.players[0], 0, 4);
  state.spawnWarnings = [{ id: 1, x: 0, y: 0, z: -8, ticksLeft: 1, monsterType: type }]; Horde.step(state);
  const monster = state.players.find(player => player.monster); assert.ok(monster, 'a real rift materializes the target');
  pose(monster, 0, 0, Math.PI); monster.emergenceTicks = 0;
  pose(human, 0, distance); human.triggerBlocked = false;
  if (diagnostic) monster.hp = monster.maxHp = 10000;
  const height = head ? eyeHeight(monster) : playerHeight(monster) * .55;
  Object.assign(human, { ...aimAt(human, monster, height), vx: moving ? WEAPONS[weapon].speed : 0 });
  // The real AI is recovering, so this fixture isolates cold-shell geometry
  // without replacing the production monster body, spawn, HP or damage path.
  Object.assign(state.horde.brains[monster.id], { recoverTicks: 10000, nextPlanTick: Number.MAX_SAFE_INTEGER, path: [], targetId: 0, nextSightTick: Number.MAX_SAFE_INTEGER, visible: false });
  if (covered) state.map = { ...arena, colliders: [wall(distance)] };
  state.events = [];
  if (fire) Horde.step(state, [{ fire: true, yaw: human.yaw, pitch: human.pitch, right: moving }]);
  return { state, human, monster };
}

test('the original trio can kill actual early-wave stalkers while a durable brute survives their body shells', () => {
  for (const weapon of ['shotgun', 'autoshotgun', 'slugshotgun']) {
    for (const wave of [1, 3]) {
      const { state, human, monster } = hordeEncounter(weapon, 'stalker', 4, { wave });
      assert.equal(monster.alive, false, `${weapon} early wave ${wave}`);
      assert.equal(human.kills, 1); assert.equal(state.horde.teamstats.damage, monster.maxHp);
      assert.equal(state.horde.totalKills, 1);
    }
    const { monster } = hordeEncounter(weapon, 'brute', 4, { wave: 3 });
    assert.equal(monster.alive, true, `${weapon} does not erase a real armored body in one shell`);
    assert.ok(monster.hp < monster.maxHp);
  }
});

test('actual Horde shells can contact two distinct monster lives while partial cover protects the covered monster', () => {
  for (const weapon of SCATTERGUNS) for (const covered of [false, true]) {
    const { state, human, monster: left } = hordeEncounter(weapon, 'stalker', 6, { diagnostic: true, fire: false });
    state.spawnWarnings = [{ id: 2, x: 0, y: 0, z: -8, ticksLeft: 1, monsterType: 'stalker' }]; Horde.step(state);
    const right = state.players.find(player => player.monster && player.id !== left.id);
    assert.ok(right && right.lifeId !== left.lifeId, 'a second real rift creates a distinct living monster');
    pose(left, -.38, 0, Math.PI); pose(right, .38, 0, Math.PI);
    Object.assign(right, { hp: 10000, maxHp: 10000, emergenceTicks: 0 });
    Object.assign(state.horde.brains[right.id], { recoverTicks: 10000, nextPlanTick: Number.MAX_SAFE_INTEGER, path: [], targetId: 0, nextSightTick: Number.MAX_SAFE_INTEGER, visible: false });
    human.yaw = 0; human.pitch = Math.atan2(1 - eyeHeight(human), 6); human.previousInput = emptyInput(human);
    if (covered) state.map = { ...arena, colliders: [wall(6, true)] };
    state.events = [];
    Horde.step(state, [{ fire: true, yaw: human.yaw, pitch: human.pitch }]);
    assert.ok(damageTo(state, right.id) > 0, `${weapon}: exposed monster receives its own pellets`);
    assert.equal(damageTo(state, left.id) > 0, !covered, `${weapon}: only concrete shields the left monster`);
    assert.equal(human.shots, 1); assert.equal(shotEvents(state).length, WEAPONS[weapon].pellets);
    assert.equal(state.horde.teamstats.damage, human.damageDealt);
    if (WEAPONS[weapon].valorant) for (const event of damageEvents(state)) assert.equal(event.targetLifeId, state.players[event.targetId].lifeId);
  }
});

for (const weapon of SHOTGUNS) test(`${weapon}: Horde humanoid/hound contacts use real silhouettes, moving aim, head damage and physical cover`, () => {
  for (const type of ['stalker', 'hound']) {
    for (const distance of DISTANCES) {
      for (const moving of [false, true]) {
        for (const head of [false, true]) {
          const { state, human, monster } = hordeEncounter(weapon, type, distance, { moving, head, diagnostic: true });
          const damage = damageTo(state, monster.id);
          assert.ok(Number.isFinite(damage) && damage >= 0);
          assert.ok(Math.abs(human.damageDealt - (10000 - monster.hp)) < 1e-9, 'confirmed fractional contacts equal actual HP removal');
          assert.equal(state.horde.teamstats.damage, human.damageDealt);
          assert.equal(human.shots, 1); assert.equal(human.ammo, WEAPONS[weapon].magazine - 1);
          assert.equal(monster.knockbackTicks, 0, 'gun contacts do not invent movement displacement or stagger');
          const precisionMiss = weapon === 'slugshotgun' && type === 'hound' && distance === 4 && moving && head;
          if (precisionMiss) assert.equal(damage, 0, 'running hip fire can miss a small dog head with a single slug');
          else if (distance <= 4) assert.ok(damage > 0, `${type} close ${head ? 'head' : 'body'} ${moving ? 'moving' : 'stationary'}`);
          const blocked = hordeEncounter(weapon, type, distance, { moving, head, covered: true, diagnostic: true });
          assert.equal(blocked.monster.hp, 10000);
          assert.equal(damageEvents(blocked.state).length, 0);
        }
      }
    }
  }
});
