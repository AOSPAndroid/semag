import assert from 'node:assert/strict';
import test from 'node:test';
import { ADS, combatStep, createCombatPlayer, createState, emptyInput, KNIFE, MELEE, WEAPONS } from '../public/voxel-engine.js';
import { weaponDamage } from '../public/voxel-weapons.js';
import { enableLagCompensation, setShotViewTick } from '../public/voxel-lag-compensation.js';
import { selectInventorySlot } from '../public/voxel-inventory.js';

const arena = { id: 'lag-combat-test', bounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 }, colliders: [] };
function combatState(weapon = 'carbine', target = {}) {
  const state = createState();
  Object.assign(state, { mapId: arena.id, map: arena, phase: 'fight', tick: 100, events: [], eventId: 0 });
  state.players = [createCombatPlayer(0, 1, weapon), { ...createCombatPlayer(1), z: -4, ...target }];
  state.fighters = state.players;
  return state;
}
const input = changes => ({ ...emptyInput(), ...changes });
function pair(initial) {
  const browser = structuredClone(initial), server = structuredClone(initial);
  enableLagCompensation(server);
  return { browser, server };
}
function runPair(states, buttons, metadata = false, compare = true, map = arena) {
  for (const state of [states.browser, states.server]) state.tick++;
  if (metadata) setShotViewTick(states.server, 0, states.server.tick - 6);
  combatStep(states.browser, buttons, map);
  combatStep(states.server, buttons, map);
  if (compare) assert.deepEqual(states.server, states.browser, `actual combat differs at tick ${states.server.tick}`);
}

for (const weapon of Object.values(WEAPONS)) test(`${weapon.id}: unenabled practice and enabled server without metadata execute identical real combat`, () => {
  const initial = combatState(weapon.id, { hp: 2000, maxHp: 2000 }), states = pair(initial);
  const perPress = ['semi', 'pump', 'bolt', 'burst'].includes(weapon.mode);
  for (let tick = 0; tick < weapon.reloadTicks + 125; tick++) {
    const fire = tick >= 30 && tick < 120 && (!perPress || (tick - 30) % (weapon.cooldown + 3) === 0);
    runPair(states, [input({ aim: true, fire, reload: tick === 120 }), input()]);
  }
  const events = states.browser.events;
  assert.ok(events.some(event => event.type === (weapon.projectile ? 'boltLaunch' : 'shot')), 'fixture actually fired this weapon');
  assert.ok(events.some(event => event.type === 'damage'), 'fixture executed real authoritative damage');
  if (weapon.projectile) assert.ok(events.some(event => event.type === 'boltHit'), 'crossbow used a swept flying projectile');
  assert.ok(events.some(event => event.type === 'reloadComplete'), 'fixture completed the real reload timer');
  assert.ok(states.browser.players[0].reserve < initial.players[0].reserve, 'reload spent authoritative reserve ammunition');
  assert.equal(states.browser.players[0].ammo, weapon.magazine);
});

for (const metadata of [false, true]) test(`real grenade, heal and moving-target sword combat retain full state/event parity ${metadata ? 'with valid rewind metadata' : 'without metadata'}`, () => {
  const initial = combatState();
  initial.players[0].inventory[0].weapon = 'sword';
  initial.players[0].hp = 70;
  const states = pair(initial);
  for (let tick = 0; tick < 460; tick++) {
    if (tick === 280) for (const state of [states.browser, states.server]) {
      const grenade = state.grenades[0];
      assert.ok(grenade, 'real thrown grenade is still flying before detonation');
      Object.assign(state.players[1], { x: grenade.x, z: grenade.z, vx: 0, vz: 0 });
    }
    if (tick === 310) for (const state of [states.browser, states.server]) Object.assign(state.players[1], { x: 0, z: -1.25, vx: 0, vz: 0 });
    runPair(states, [input({ grenade: tick === 0, heal: tick === 35, swap: tick === 310, fire: tick === 311 }), input({ right: tick >= 310 && tick < 330 })], metadata);
  }
  for (const type of ['grenadeThrow', 'grenadeBounce', 'grenadeExplosion', 'healStart', 'healComplete', 'swap', 'meleeStart', 'meleeHit']) {
    assert.ok(states.browser.events.some(event => event.type === type), `fixture executed ${type}`);
  }
  assert.ok(states.browser.events.some(event => event.type === 'damage' && event.attack === 'grenade'));
  assert.ok(states.browser.events.some(event => event.type === 'damage' && event.attack === 'sword'));
  assert.equal(states.browser.players[0].hp, 130);
  assert.equal(states.browser.players[0].potions, 0);
  assert.equal(states.browser.players[0].grenades, 0);
});

test('valid rewind metadata never turns a crossbow into hitscan or moves its real collision targets', () => {
  const states = pair(combatState('crossbow', { x: -1, z: -1.2 })), poses = new Map();
  for (let tick = 0; tick < 30; tick++) {
    runPair(states, [input({ aim: true }), input({ right: true })], true);
    poses.set(states.browser.tick, { x: states.browser.players[1].x, z: states.browser.players[1].z });
  }
  const viewTick = states.browser.tick + 1 - 6, viewed = poses.get(viewTick);
  const yaw = Math.atan2(viewed.x, -viewed.z);
  for (let tick = 0; tick < 40; tick++) runPair(states, [input({ aim: true, yaw, fire: tick === 0 }), input({ right: true })], true);
  assert.ok(states.server.events.some(event => event.type === 'boltLaunch'));
  assert.equal(states.server.players[0].shots, 1);
  assert.equal(states.server.players[0].ammo, 0);
  assert.equal(states.server.players[1].hp, 200, 'a flying bolt aimed at the older head misses the moving current head');
  assert.equal(states.server.events.some(event => event.type === 'damage'), false);
});

for (const [weapon, profile] of [['sword', MELEE], ['knife', KNIFE]]) test(`valid rewind metadata preserves real ${weapon} startup, movement, reach and damage`, () => {
  const initial = combatState('carbine', { z: -.8 });
  initial.players[0].inventory[0].weapon = weapon;
  selectInventorySlot(initial.players[0], 0);
  const states = pair(initial);
  for (let tick = 0; tick < 80; tick++) runPair(states, [input({ fire: tick === 6 }), input({ right: tick > 6 && tick < 24 })], true);
  assert.ok(states.server.events.some(event => event.type === 'meleeStart' && event.weapon === weapon));
  const damage = states.server.events.filter(event => event.type === 'damage' && event.attack === weapon);
  assert.equal(damage.length, 1);
  assert.equal(damage[0].damage, profile.damage);
  assert.equal(states.server.players[0].ammo, WEAPONS.carbine.magazine, 'melee never spends gun ammunition');
});

function preparedHitscan({ ammo = 2, reloadTicks = 0 } = {}) {
  const initial = combatState('carbine', { x: -1, z: -10 });
  initial.players[0].ammo = ammo;
  const states = pair(initial), poses = new Map();
  for (let tick = 0; tick < 30; tick++) {
    runPair(states, [input({ aim: true }), input({ right: true })]);
    poses.set(states.browser.tick, { x: states.browser.players[1].x, z: states.browser.players[1].z });
  }
  for (const state of [states.browser, states.server]) state.players[0].reloadTicks = reloadTicks;
  const viewTick = states.browser.tick + 1 - 6, viewed = poses.get(viewTick);
  return { states, yaw: Math.atan2(viewed.x, -viewed.z) };
}

test('actual compensated hitscan changes contact only, spending current ammo and catalog damage with normal cooldown and reload gates', () => {
  const { states, yaw } = preparedHitscan();
  runPair(states, [input({ aim: true, yaw, fire: true }), input({ right: true })], true, false);
  assert.equal(states.browser.players[1].hp, 200, 'the moving current head is outside the older displayed aim line');
  const shot = states.server.events.find(event => event.type === 'shot');
  assert.equal(shot.hitKind, 'head');
  const distance = Math.hypot(shot.hitX - shot.x, shot.hitY - shot.y, shot.hitZ - shot.z);
  assert.equal(shot.damage, weaponDamage(WEAPONS.carbine, 'head', distance));
  assert.equal(states.server.players[1].hp, 200 - shot.damage);
  for (const state of [states.browser, states.server]) {
    assert.equal(state.players[0].ammo, 1);
    assert.equal(state.players[0].shots, 1);
    assert.equal(state.players[0].reserve, WEAPONS.carbine.reserve);
    assert.equal(state.players[0].shotCooldown, WEAPONS.carbine.cooldown);
    assert.equal(state.players[0].aimTicks, ADS.ticks);
  }
  runPair(states, [input({ aim: true, yaw, fire: true }), input({ right: true })], true, false);
  assert.equal(states.server.players[0].shots, 1, 'held fire still obeys the actual weapon cooldown');
  runPair(states, [input({ yaw, reload: true }), input({ right: true })], true, false);
  assert.equal(states.server.players[0].reloadTicks, WEAPONS.carbine.reloadTicks);
  runPair(states, [input({ yaw, fire: true }), input({ right: true })], true, false);
  assert.equal(states.server.players[0].shots, 1, 'valid rewind metadata cannot fire during a reload');
  assert.equal(states.server.players[0].ammo, 1);
});

for (const [label, preparation] of [['empty magazine', { ammo: 0 }], ['active reload', { ammo: 2, reloadTicks: 20 }]]) test(`compensated hitscan cannot bypass an ${label}`, () => {
  const { states, yaw } = preparedHitscan(preparation);
  runPair(states, [input({ aim: true, yaw, fire: true }), input({ right: true })], true);
  assert.equal(states.server.players[0].shots, 0);
  assert.equal(states.server.players[0].ammo, preparation.ammo);
  assert.equal(states.server.players[1].hp, 200);
  assert.equal(states.server.events.some(event => event.type === 'shot'), false);
});

test('actual compensated hitscan still spends a shot when current static cover blocks the old target pose', () => {
  const { states, yaw } = preparedHitscan();
  const covered = { ...arena, colliders: [{ id: 'current-cover', x: -1, y: 0, z: -5, w: 2, h: 3, d: .5 }] };
  runPair(states, [input({ aim: true, yaw, fire: true }), input({ right: true })], true, true, covered);
  const shot = states.server.events.find(event => event.type === 'shot');
  assert.equal(shot.hitKind, 'wall');
  assert.equal(shot.colliderId, 'current-cover');
  assert.equal(shot.damage, 0);
  assert.equal(states.server.players[0].ammo, 1);
  assert.equal(states.server.players[1].hp, 200);
});
