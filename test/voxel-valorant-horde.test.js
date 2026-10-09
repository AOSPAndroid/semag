import assert from 'node:assert/strict';
import test from 'node:test';
import * as Horde from '../public/voxel-horde-engine.js';
import { applyCombatDamage, cloneState, emptyInput } from '../public/voxel-engine.js';
import { WEAPONS } from '../public/voxel-weapons.js';

const arena = Object.freeze({
  id: 'arsenal-horde-arena',
  bounds: Object.freeze({ minX: -25, maxX: 25, minZ: -22, maxZ: 22 }),
  colliders: Object.freeze([]),
  spawns: Horde.MAPS.courtyard.spawns,
});
const MAX_TICKS = 12000;
const advance = (state, ticks, inputs = []) => {
  for (let tick = 0; tick < ticks; tick++) Horde.step(state, inputs);
};
const pose = (player, x, z, yaw = 0) => {
  Object.assign(player, { x, y: 0, z, yaw, pitch: 0, vx: 0, vy: 0, vz: 0, grounded: true });
  player.previousInput = emptyInput(player);
};

function active(seed = 73291) {
  const state = Horde.createState({ capacity: 1, seed });
  Horde.startMatch(state);
  advance(state, state.phaseTicks);
  assert.equal(state.phase, 'fight');
  state.map = arena;
  pose(state.players[0], 0, 0);
  state.players[0].hp = state.players[0].maxHp = 1e6;
  return state;
}

function riftFixture(type, seed, wave = 12) {
  const state = active(seed);
  state.horde.wave = wave;
  state.horde.pending = 1;
  state.horde.nextSpawnTick = Number.MAX_SAFE_INTEGER;
  state.spawnWarnings = [{ id: ++state.horde.spawnId, x: 0, y: 0, z: -12, ticksLeft: 1, monsterType: type }];
  Horde.step(state);
  const monster = state.players.find(player => player.monster && player.alive);
  assert.ok(monster, `${type}: a real rift must materialize a body`);
  const brain = state.horde.brains[monster.id];
  brain.targetId = 0;
  brain.nextPlanTick = Number.MAX_SAFE_INTEGER;
  brain.path = [];
  return { state, monster, human: state.players[0], brain };
}

// Discover loadouts through actual seeded rifts. No test overwrites a monster's
// inventory, weapon, trigger clock or authoritative firing routine.
const weaponFixtures = new Map();
function carrying(weapon) {
  if (!weaponFixtures.has(weapon)) {
    const type = Horde.monsterWeaponPool('gunner', 12).includes(weapon) ? 'gunner' : 'sniper';
    assert.ok(Horde.monsterWeaponPool(type, 12).includes(weapon), `${weapon}: must occur in a late-wave pool`);
    for (let index = 1; index <= 512 && !weaponFixtures.has(weapon); index++) {
      const seed = Math.imul(index, 0x9e3779b9) >>> 0;
      const fixture = riftFixture(type, seed);
      weaponFixtures.set(fixture.monster.weapon, fixture.state);
    }
    assert.ok(weaponFixtures.has(weapon), `${weapon}: seeded real rifts never supplied this loadout`);
  }
  const state = cloneState(weaponFixtures.get(weapon));
  const monster = state.players.find(player => player.monster && player.alive);
  return { state, monster, human: state.players[0], brain: state.horde.brains[monster.id] };
}

function completeWave(wave, seed) {
  const state = active(seed);
  state.phase = 'intermission';
  state.phaseTicks = 1;
  state.horde.wave = wave - 1;
  Horde.step(state);
  assert.equal(state.phase, 'fight');
  assert.equal(state.horde.wave, wave);
  const expected = 7 + wave * 3, seen = [], lives = new Set();
  let peakBodies = 0, peakLoot = 0;
  for (let tick = 0; tick < MAX_TICKS && state.phase === 'fight'; tick++) {
    Horde.step(state);
    const living = state.players.filter(player => player.monster && player.alive);
    peakBodies = Math.max(peakBodies, living.length);
    peakLoot = Math.max(peakLoot, state.loot.length);
    for (const monster of living) {
      const key = `${monster.id}:${monster.lifeId}`;
      assert.equal(lives.has(key), false, 'a recycled slot must get a new life identity');
      lives.add(key);
      seen.push({ type: monster.monsterType, weapon: monster.weapon, hasGun: monster.hasGun,
        inventory: monster.inventory.map(item => item?.weapon || null) });
      if (Horde.MONSTER_TYPES[monster.monsterType].gun) {
        assert.ok(Horde.monsterWeaponPool(monster.monsterType, wave).includes(monster.weapon));
        assert.equal(monster.inventory[0].weapon, monster.weapon);
        assert.equal(monster.ammo, WEAPONS[monster.weapon].magazine);
      }
      applyCombatDamage(state, [{ playerId: 0, targetId: monster.id, damage: monster.hp, attack: 'gun', weapon: 'carbine' }]);
    }
  }
  assert.equal(state.phase, 'intermission', `wave ${wave}: natural rifts must finish`);
  assert.equal(seen.length, expected);
  assert.equal(state.horde.totalKills, expected);
  assert.ok(peakBodies <= Horde.HORDE_RULES.maxMonsters);
  assert.ok(peakLoot <= 20);
  assert.ok(state.players.length <= state.capacity + Horde.HORDE_RULES.maxMonsters);
  return { seen, state };
}

test('late-wave weapon selection is reproducible, varied and limited to the authored role pool', () => {
  for (const type of ['gunner', 'sniper']) for (const wave of [4, 6, 7, 9, 12]) {
    const pool = Horde.monsterWeaponPool(type, wave), chosen = new Set();
    assert.ok(pool.length > 0);
    assert.equal(new Set(pool).size, pool.length, `${type}/${wave}: weighting cannot accidentally duplicate a gun`);
    assert.ok(pool.every(id => Object.hasOwn(WEAPONS, id)));
    for (let index = 0; index < 256; index++) {
      const seed = Math.imul(index + 1, 0x9e3779b9) >>> 0;
      const first = Horde.monsterWeaponFor(type, wave, seed);
      assert.equal(Horde.monsterWeaponFor(type, wave, seed), first);
      assert.ok(pool.includes(first));
      chosen.add(first);
    }
    assert.deepEqual([...chosen].sort(), [...pool].sort(), `${type}/${wave}: every supplied weapon is reachable`);
  }
});

test('armed role pools introduce the new sidearms, long guns and heavy weapons at their authored waves', () => {
  const expectedGunner = {
    4: ['pistol', 'classic', 'ghost', 'frenzy', 'bandit'],
    6: ['pistol', 'classic', 'ghost', 'frenzy', 'bandit', 'carbine', 'smg', 'sheriff', 'stinger', 'spectre', 'shorty', 'bucky'],
    9: ['pistol', 'classic', 'ghost', 'frenzy', 'bandit', 'carbine', 'smg', 'sheriff', 'stinger', 'spectre', 'shorty', 'bucky',
      'judge', 'bulldog', 'guardian', 'phantom', 'vandal', 'ares'],
    12: ['pistol', 'classic', 'ghost', 'frenzy', 'bandit', 'carbine', 'smg', 'sheriff', 'stinger', 'spectre', 'shorty', 'bucky',
      'judge', 'bulldog', 'guardian', 'phantom', 'vandal', 'ares', 'odin'],
  };
  const expectedSniper = { 7: ['marksman', 'marshal'], 9: ['marksman', 'marshal', 'outlaw', 'warden'],
    12: ['marksman', 'marshal', 'outlaw', 'warden', 'operator'] };
  for (const [wave, ids] of Object.entries(expectedGunner)) {
    assert.deepEqual([...Horde.monsterWeaponPool('gunner', Number(wave))].sort(), [...ids].sort());
    assert.deepEqual(Horde.monsterWeaponPool('gunner', Number(wave) + 1), Horde.monsterWeaponPool('gunner', Number(wave)));
  }
  for (const [wave, ids] of Object.entries(expectedSniper)) {
    assert.deepEqual([...Horde.monsterWeaponPool('sniper', Number(wave))].sort(), [...ids].sort());
    assert.deepEqual(Horde.monsterWeaponPool('sniper', Number(wave) + 1), Horde.monsterWeaponPool('sniper', Number(wave)));
  }
});

test('natural early waves keep their existing population, unarmed beasts and close-combat introductions', () => {
  for (const wave of [1, 2, 3]) {
    const { seen } = completeWave(wave, 73291);
    assert.ok(seen.some(monster => monster.type === 'hound'));
    assert.equal(seen.some(monster => ['gunner', 'sniper'].includes(monster.type)), false);
    assert.equal(seen.some(monster => monster.type === 'runner'), wave >= 2);
    assert.equal(seen.some(monster => monster.type === 'brute'), wave >= 3);
    for (const monster of seen.filter(monster => Horde.MONSTER_TYPES[monster.type].unarmed)) {
      assert.equal(monster.hasGun, false);
      assert.deepEqual(monster.inventory, [null, null, null, null]);
    }
  }
});

test('natural wave 4, 7 and 12 rifts carry deterministic later guns without changing wave sizes or drop bounds', () => {
  const allArmed = new Set();
  for (const wave of [4, 7, 12]) for (const seed of [73291, 0x73656d61]) {
    const first = completeWave(wave, seed), replay = completeWave(wave, seed);
    assert.deepEqual(replay.seen, first.seen, `wave ${wave}: seed replay must preserve composition and equipped guns`);
    assert.deepEqual(replay.state.loot, first.state.loot, `wave ${wave}: corpse supplies are deterministic too`);
    assert.ok(first.seen.some(monster => monster.type === 'gunner'));
    assert.equal(first.seen.some(monster => monster.type === 'sniper'), wave >= 7);
    for (const monster of first.seen.filter(monster => Horde.MONSTER_TYPES[monster.type].gun)) allArmed.add(monster.weapon);
  }
  assert.ok([...allArmed].some(id => WEAPONS[id].valorant), 'natural later waves must actually use the new arsenal');
  assert.ok(allArmed.size >= 5, `later waves need genuine loadout variety: ${[...allArmed]}`);
});

test('the first armed introductions retain the existing pistol, carbine and marksman teaching encounters', () => {
  for (const [type, wave, expected] of [['gunner', 4, 'pistol'], ['gunner', 6, 'carbine'], ['sniper', 7, 'marksman']]) {
    for (const seed of [73291, 0x73656d61]) {
      const { state, monster } = riftFixture(type, seed, wave);
      assert.equal(monster.weapon, expected);
      assert.equal(state.events.findLast(event => event.type === 'monsterSpawn').weapon, expected);
    }
  }
});

test('a naturally fighting mixed wave seven preserves every introduction across the bounded event history', () => {
  const state = active(75131), human = state.players[0];
  state.map = { ...arena, bounds: { minX: -24, maxX: 24, minZ: -24, maxZ: 24 } };
  pose(human, 0, 4);
  // Extra fixture health keeps the stationary observer alive while every
  // monster attacks normally; no enemies, damage or firing clocks are changed.
  human.hp = human.maxHp = 10000;
  state.phase = 'intermission';
  state.phaseTicks = 1;
  state.horde.wave = 6;
  Horde.step(state);
  assert.equal(state.horde.wave, 7);
  const rifts = [];
  for (let tick = 0; tick < 1500; tick++) {
    Horde.step(state);
    // Rift warning IDs also occupy the event ID field. Tick-based collection
    // observes genuine fresh events before the 256-entry history evicts them.
    for (const event of state.events) {
      if (event.type === 'monsterRift' && event.tick === state.tick) rifts.push(event.monsterType);
    }
    assert.equal(state.phase, 'fight');
    assert.ok(human.hp > 0);
    assert.ok(state.players.filter(player => player.monster && player.alive && player.monsterType === 'screecher').length <= 2);
    assert.ok(state.events.length <= 256);
  }
  assert.deepEqual(rifts.slice(0, 6), ['sniper', 'hound', 'leaper', 'screecher', 'gunner', 'brute']);
  assert.ok(human.hp < human.maxHp, 'the observation must include actual monster combat');
  assert.equal(state.horde.totalKills, 0);
});

function observeBursts(fixture, wanted = 3) {
  const { state, monster } = fixture;
  const profile = Horde.MONSTER_TYPES[monster.monsterType], bursts = [];
  let lastId = state.eventId, current = null, previousShots = monster.shots;
  for (let tick = 0; tick < 3600 && bursts.length <= wanted; tick++) {
    Horde.step(state);
    const fresh = state.events.filter(event => event.id > lastId);
    lastId = state.eventId;
    for (const event of fresh.filter(event => event.type === 'monsterAim' && event.playerId === monster.id)) {
      current = { tick: event.tick, duration: event.ticks, rounds: [], shots: [] };
      bursts.push(current);
    }
    const accepted = monster.shots - previousShots;
    previousShots = monster.shots;
    if (accepted) {
      assert.ok(current, `${monster.weapon}: actual shots require a preceding aim warning`);
      assert.ok(state.tick - current.tick >= profile.windup, `${monster.weapon}: a shot escaped before its windup`);
      current.rounds.push(...Array.from({ length: accepted }, () => state.tick));
    }
    const shots = fresh.filter(event => event.type === 'shot' && event.playerId === monster.id);
    if (shots.length) {
      assert.ok(current, `${monster.weapon}: shot reports require a warning`);
      current.shots.push(...shots);
    }
  }
  assert.ok(bursts.length > wanted, `${monster.weapon}: repeated telegraphs must actually resume`);
  return bursts.slice(0, wanted);
}

for (const weapon of ['classic', 'shorty', 'frenzy', 'ghost', 'sheriff', 'bandit', 'stinger', 'spectre', 'bucky', 'judge',
  'bulldog', 'guardian', 'phantom', 'vandal', 'warden', 'marshal', 'outlaw', 'operator', 'ares', 'odin']) {
  test(`a real ${weapon} monster fires finite, announced bursts with its genuine ammunition and fire mode`, () => {
    const fixture = carrying(weapon), { monster, human } = fixture;
    const profile = WEAPONS[weapon], magazine = monster.ammo, bursts = observeBursts(fixture);
    const accepted = bursts.reduce((sum, burst) => sum + burst.rounds.length, 0);
    assert.ok(accepted > 0, `${weapon}: telegraphs must lead to real rounds`);
    assert.equal(bursts[0].rounds.length, profile.mode === 'auto' && monster.monsterType !== 'sniper' ? 3 : 1,
      `${weapon}: a fresh magazine must produce the complete authored opening burst`);
    for (const burst of bursts) {
      assert.ok(burst.rounds.length > 0, `${weapon}: a readable cycle cannot silently fire nothing`);
      assert.ok(burst.rounds.length <= (profile.mode === 'auto' && monster.monsterType !== 'sniper' ? 3 : 1),
        `${weapon}: an enemy cannot dump a magazine per warning`);
      assert.equal(burst.duration, Horde.MONSTER_TYPES[monster.monsterType].windup);
      assert.ok(burst.shots.every(event => event.weapon === weapon && event.alternate !== true));
      assert.ok(burst.shots.every(event => event.fireMode !== 'volley' && !event.fireMode?.startsWith('airburst')));
      assert.equal(burst.shots.filter(event => event.pellet === 0).length, burst.rounds.length,
        `${weapon}: each accepted shell has one report group regardless of its pellet count`);
    }
    for (let index = 1; index < bursts.length; index++) {
      const monsterProfile = Horde.MONSTER_TYPES[monster.monsterType];
      assert.ok(bursts[index].rounds[0] - bursts[index - 1].rounds.at(-1) >= monsterProfile.rest + monsterProfile.windup,
        `${weapon}: the real last round must leave the authored rest and new windup before the next attack`);
    }
    assert.ok(human.hp < human.maxHp, `${weapon}: actual rounds must reach the real human target`);
    assert.ok(monster.ammo < magazine || monster.reloadTicks > 0 || monster.reserve < profile.reserve * 8,
      `${weapon}: AI fire consumes finite carried ammunition`);
    if (profile.adsSupported === false || profile.adsBurst) {
      assert.equal(monster.aimTicks, 0, `${weapon}: monster trigger control must not invent an alternate or longer committed ADS attack`);
      assert.ok(bursts.every(burst => burst.shots.every(event => event.fireMode !== 'burst')));
    }
  });
}

test('a naturally supplied wave-four Frenzy has a readable two-round cycle instead of the later three-round limit', () => {
  let fixture = null;
  for (let index = 1; index <= 128 && !fixture; index++) {
    const first = riftFixture('gunner', Math.imul(index, 0x9e3779b9) >>> 0, 4);
    assert.equal(first.monster.weapon, 'pistol');
    applyCombatDamage(first.state, [{ playerId: 0, targetId: first.monster.id, damage: first.monster.hp, attack: 'gun', weapon: 'carbine' }]);
    Horde.step(first.state);
    first.state.spawnWarnings.push({ id: ++first.state.horde.spawnId, x: 0, y: 0, z: -12, ticksLeft: 1, monsterType: 'gunner' });
    Horde.step(first.state);
    const monster = first.state.players.find(player => player.monster && player.alive);
    assert.ok(monster, 'the second real rift must introduce a new life');
    if (monster.weapon !== 'frenzy') continue;
    const brain = first.state.horde.brains[monster.id];
    brain.targetId = 0; brain.nextPlanTick = Number.MAX_SAFE_INTEGER; brain.path = [];
    fixture = { state: first.state, monster, human: first.state.players[0], brain };
  }
  assert.ok(fixture, 'the early armed pool must actually supply a Frenzy after its pistol introduction');
  const bursts = observeBursts(fixture);
  assert.ok(bursts.every(burst => burst.rounds.length === 2));
  assert.ok(fixture.human.hp < fixture.human.maxHp);
});

for (const weapon of ['classic', 'guardian', 'operator', 'odin']) {
  test(`a fired ${weapon} corpse drops and transfers its actual magazine, finite reserve and recovery through E`, () => {
    const type = Horde.monsterWeaponPool('gunner', 12).includes(weapon) ? 'gunner' : 'sniper';
    let corpse = null;
    for (let index = 1; index <= 512 && !corpse; index++) {
      const fixture = riftFixture(type, Math.imul(index, 0x9e3779b9) >>> 0);
      const { state, monster } = fixture;
      if (monster.weapon !== weapon) continue;
      for (let tick = 0; tick < 1200 && !monster.shots; tick++) Horde.step(state);
      assert.equal(monster.shots, 1, `${weapon}: the drop fixture must spend one genuine round`);
      const before = { ammo: monster.ammo, reserve: monster.reserve, shotCooldown: monster.shotCooldown };
      assert.equal(before.ammo, WEAPONS[weapon].magazine - 1);
      assert.ok(before.shotCooldown > 0);
      applyCombatDamage(state, [{ playerId: 0, targetId: monster.id, damage: monster.hp, attack: 'gun', weapon: 'carbine' }]);
      Horde.step(state);
      const loot = state.loot.find(drop => drop.kind === 'weapon');
      if (loot) corpse = { ...fixture, before, loot };
    }
    assert.ok(corpse, `${weapon}: seeded armed corpses must sometimes supply their carried gun`);
    const { state, human, monster, before, loot } = corpse;
    assert.equal(monster.alive, false);
    assert.equal(loot.weapon, weapon);
    assert.equal(loot.ammo, before.ammo, 'a death cannot refill the fired magazine');
    assert.equal(loot.reserve, Math.min(before.reserve, WEAPONS[weapon].reserve), 'loot exposes a finite ordinary reserve');
    assert.equal(loot.item.shotCooldown, before.shotCooldown, 'a death cannot reset the gun recovery');
    assert.equal(loot.item.reloadTicks + loot.item.burstRemaining + loot.item.spinTicks, 0, 'the dead shooter leaves no queued action');
    pose(human, loot.x, loot.z);
    assert.equal(Horde.findNearbyLoot(state, 0).id, loot.id);
    Horde.step(state, [{ interact: true }]);
    const carried = human.inventory.find(item => item?.kind === 'weapon' && item.weapon === weapon);
    assert.ok(carried, 'the actual interact edge must put the corpse gun into a free physical slot');
    assert.equal(carried.ammo, before.ammo);
    assert.equal(carried.reserve, loot.reserve);
    assert.equal(carried.shotCooldown, before.shotCooldown);
    assert.equal(state.loot.some(drop => drop.id === loot.id), false);
    assert.equal(state.events.filter(event => event.type === 'lootPickup' && event.lootId === loot.id).length, 1);
    advance(state, 120);
    assert.equal(state.horde.totalKills, 1, 'replaying a dead slot cannot produce another corpse or kill credit');
    assert.equal(state.loot.some(drop => drop.id === loot.id), false);
  });
}

test('newly armed corpses keep the scarce gun-drop chance and the twenty-item world cap', () => {
  let corpses = 0, gunDrops = 0;
  for (let index = 1; index <= 160; index++) {
    const { state, monster } = riftFixture('gunner', Math.imul(index, 0x9e3779b9) >>> 0);
    applyCombatDamage(state, [{ playerId: 0, targetId: monster.id, damage: monster.hp, attack: 'gun', weapon: 'carbine' }]);
    Horde.step(state);
    corpses++;
    gunDrops += state.loot.filter(drop => drop.kind === 'weapon').length;
    assert.ok(state.loot.length <= 20);
  }
  assert.ok(gunDrops >= corpses * .25 && gunDrops <= corpses * .45,
    `the established 35% gun-drop chance should stay scarce: ${gunDrops}/${corpses}`);
  const { state } = completeWave(12, 0x73656d61);
  assert.equal(Horde.HORDE_RULES.maxLoot, 20);
  assert.equal(state.loot.length, 20, 'a dense, genuinely killed wave must evict old drops instead of raising the world cap');
});
