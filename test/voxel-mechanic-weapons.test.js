import assert from 'node:assert/strict';
import test from 'node:test';
import { WEAPONS, createCombatPlayer, combatStep, emptyInput, pickupCombatLoot, predictLocalMovement } from '../public/voxel-engine.js';
import { GADGET_IDS, WEAPON_IDS, weaponDamage } from '../public/voxel-weapons.js';
import * as Royale from '../public/voxel-royale-engine.js';

const open = { id: 'mechanic-open', bounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 }, colliders: [], sites: [] };
const fixture = (players, arena = open) => ({ gameId: 'mechanic-fixture', phase: 'fight', tick: 0, map: arena, mapId: arena.id, players, fighters: players, grenades: [], grenadeId: 0, bolts: [], boltId: 0, events: [], eventId: 0, loot: [], lootId: 0 });
const step = (state, controls = []) => { state.tick++; combatStep(state, state.players.map((player, index) => ({ ...emptyInput(player), ...(controls[index] || {}) })), state.map); };
const lane = (weapon, distance = 10, arena = open) => {
  const shooter = createCombatPlayer(0, 1, weapon), target = Object.assign(createCombatPlayer(1, 1, 'carbine'), { z: -distance, hp: 5000, maxHp: 5000 });
  return { state: fixture([shooter, target], arena), shooter, target };
};
const damage = state => state.events.filter(event => event.type === 'damage' && event.targetId === 1).reduce((total, event) => total + event.damage, 0);
const BODY = { pitch: Math.atan2(-.5, 10) };

test('the rail lance charges while held, fizzles if rushed and hits hardest at full charge', () => {
  const rushed = lane('railgun'); rushed.state.players[0].yaw = 0;
  for (let tick = 0; tick < 10; tick++) step(rushed.state, [{ fire: true, ...BODY }]);
  step(rushed.state, [BODY]);
  assert.ok(rushed.state.events.some(event => event.type === 'chargeFizzle'));
  assert.equal(rushed.shooter.ammo, WEAPONS.railgun.magazine, 'a fizzle keeps the round');
  const results = [];
  for (const ticks of [42, WEAPONS.railgun.chargeTicks]) {
    const { state, shooter } = lane('railgun');
    for (let tick = 0; tick < ticks; tick++) step(state, [{ fire: true, ...BODY }]);
    assert.equal(shooter.chargeTicks, ticks);
    step(state, [BODY]);
    assert.equal(shooter.ammo, WEAPONS.railgun.magazine - 1);
    results.push(damage(state));
  }
  // Full charge deals the catalogue body damage; half charge scales from the 35% floor.
  assert.equal(results[1], weaponDamage('railgun', 'body'));
  assert.equal(results[0], Math.round(weaponDamage('railgun', 'body') * (WEAPONS.railgun.chargeFloor + (1 - WEAPONS.railgun.chargeFloor) * .5)));
});

test('a full rail charge pierces wooden cover', () => {
  const wall = { ...open, colliders: [{ id: 'crate', x: -2, y: 0, z: -5, w: 4, h: 3, d: .3, material: 'wood' }] };
  const { state } = lane('railgun', 10, wall);
  for (let tick = 0; tick < WEAPONS.railgun.chargeTicks; tick++) step(state, [{ fire: true, ...BODY }]);
  step(state, [BODY]);
  assert.ok(damage(state) > 0, 'the round went through the crate');
  const carbine = lane('carbine', 10, wall);
  step(carbine.state, [{ fire: true, ...BODY }]);
  assert.equal(damage(carbine.state), 0, 'an ordinary rifle round stops in the crate');
});

test('the lever rifle builds rhythm on the beat and short-strokes when worked early', () => {
  const { state, shooter } = lane('leveraction');
  step(state, [{ fire: true, ...BODY }]);
  assert.equal(shooter.shots, 1); assert.equal(shooter.leverStacks, 0, 'a cold first shot has no rhythm');
  // Press just as the lever closes, three times in a row.
  for (let beat = 1; beat <= 3; beat++) {
    while (shooter.shotCooldown > 4) step(state, [BODY]);
    step(state, [{ fire: true, ...BODY }]);
    while (shooter.shots === beat) step(state, [BODY]);
    assert.equal(shooter.leverStacks, beat);
  }
  assert.equal(shooter.shotCooldown, WEAPONS.leveraction.cooldown - 3 * WEAPONS.leveraction.rhythmStepTicks, 'full rhythm shortens the cycle');
  // Too early: the action fumbles, the rhythm is lost and the cycle grows.
  step(state, [BODY]);
  const before = shooter.shotCooldown;
  step(state, [{ fire: true, ...BODY }]);
  assert.ok(state.events.some(event => event.type === 'leverFumble'));
  assert.equal(shooter.leverStacks, 0);
  assert.equal(shooter.shotCooldown, before - 1 + WEAPONS.leveraction.shortStrokeTicks);
});

test('thrown knives arc, land as pickups and return to the reserve', () => {
  const { state, shooter } = lane('throwingknife', 8);
  step(state, [{ fire: true, pitch: .05 }]);
  assert.equal(state.bolts.length, 1); assert.equal(state.bolts[0].weapon, 'throwingknife');
  for (let tick = 0; tick < 200 && state.bolts.length; tick++) step(state);
  const knife = state.loot.find(item => item.kind === 'ammo' && item.weapon === 'throwingknife');
  assert.ok(knife, 'the knife is lying where it stopped');
  for (let tick = 0; tick < 120; tick++) step(state);
  Object.assign(shooter, { x: knife.x, z: knife.z + .4 });
  const reserve = shooter.reserve;
  assert.ok(pickupCombatLoot(state, shooter, knife, { interact: true }));
  assert.equal(shooter.reserve, reserve + 1);
});

test('the grapple hook pulls you to a wall anchor and lets go on jump', () => {
  const wall = { ...open, colliders: [{ id: 'tower', x: -3, y: 0, z: -15, w: 6, h: 8, d: 2, material: 'stone' }] };
  const player = createCombatPlayer(0, 1, 'grapple'), state = fixture([player], wall);
  step(state, [{ fire: true, pitch: .25 }]);
  assert.ok(player.grappleTicks > 0, 'anchored to the tower');
  assert.ok(state.events.some(event => event.type === 'grappleFire' && event.hit));
  const startZ = player.z;
  for (let tick = 0; tick < 40; tick++) step(state, [{ pitch: .25 }]);
  assert.ok(player.z < startZ - 4 && player.y > .5, 'pulled toward and up the tower');
  step(state, [{ jump: true }]);
  assert.equal(player.grappleTicks, 0, 'jump releases the line');
  const miss = createCombatPlayer(0, 1, 'grapple'), empty = fixture([miss]);
  step(empty, [{ fire: true, pitch: .2 }]);
  assert.equal(miss.grappleTicks, 0); assert.equal(miss.ammo, WEAPONS.grapple.magazine, 'a miss keeps the charge');
});

test('client prediction follows an authoritative grapple pull exactly', () => {
  const wall = { ...open, colliders: [{ id: 'tower', x: -3, y: 0, z: -15, w: 6, h: 8, d: 2, material: 'stone' }] };
  const player = createCombatPlayer(0, 1, 'grapple'), state = fixture([player], wall);
  step(state, [{ fire: true, pitch: .25 }]);
  const predicted = structuredClone(player);
  for (let tick = 0; tick < 30; tick++) {
    step(state, [{ pitch: .25 }]);
    predictLocalMovement(predicted, { ...emptyInput(), pitch: .25 }, wall, 1);
    for (const field of ['x', 'y', 'z', 'grappleTicks']) assert.ok(Math.abs(predicted[field] - player[field]) < 1e-9, `${field} @${tick}`);
  }
});

test('the grapple is a loot-only gadget: never a loadout, always found in Royale', () => {
  assert.deepEqual(GADGET_IDS, ['grapple']);
  assert.equal(WEAPON_IDS.includes('grapple'), false);
  for (const id of ['railgun', 'leveraction', 'throwingknife']) assert.ok(WEAPON_IDS.includes(id), id);
  const state = Royale.createState({ capacity: 4, mapId: 'forest' });
  Royale.startMatch(state, [0, 1, 2, 3]);
  assert.ok(state.loot.some(item => item.kind === 'weapon' && item.weapon === 'grapple'));
});

test('no mode accepts the grapple as a starting loadout', async () => {
  const { createState, selectLoadout } = await import('../public/voxel-engine.js');
  const breach = createState({ teamSize: 1, mapId: 'courtyard' });
  assert.equal(selectLoadout(breach, 0, 'grapple').ok, false);
  assert.equal(selectLoadout(breach, 0, 'railgun').ok, true);
});
