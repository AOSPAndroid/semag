import assert from 'node:assert/strict';
import test from 'node:test';
import { createCombatPlayer, combatStep, emptyInput, cloneState, traceShot, traceWeaponShot, predictLocalMovement, WEAPON_PENETRATION } from '../public/voxel-engine.js';
import { WEAPONS, weaponDamage } from '../public/voxel-weapons.js';
import { resolveActiveFire, weaponReloadDuration, weaponFireIntervalTicks } from '../public/voxel-fire-modes.js';
import { enableLagCompensation, setShotViewTick } from '../public/voxel-lag-compensation.js';
import { pickupInventoryItem } from '../public/voxel-inventory.js';

const arena = { id: 'valorant-physical-fixture', bounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 }, colliders: [], sites: [] };
function encounter(weapon = 'classic', distance = 8) {
  const players = [createCombatPlayer(0, 1, weapon), createCombatPlayer(1)];
  Object.assign(players[0], { z: distance, yaw: 0, pitch: 0, lifeId: 3 });
  Object.assign(players[1], { hp: 10000, maxHp: 10000, lifeId: 7 });
  return { gameId: 'valorant-fixture', phase: 'fight', tick: 0, map: arena, mapId: arena.id, players, fighters: players, grenades: [], grenadeId: 0, bolts: [], boltId: 0, events: [], eventId: 0, loot: [], lootId: 0 };
}
function ticks(state, count = 1, input = {}) {
  for (let i = 0; i < count; i++) {
    state.tick++;
    combatStep(state, state.players.map(player => ({ ...emptyInput(player), ...(input[player.id] || {}) })), state.map);
  }
}
const shots = state => state.events.filter(event => event.type === 'shot');
const damage = state => state.events.filter(event => event.type === 'damage');
const wall = (material, thickness = .1, z = 4, id = material) => ({ id, material, x: -2, y: 0, z, w: 4, h: 3, d: thickness });
const ray = (state, weapon = state.players[0].weapon) => traceWeaponShot(state, 0, { x: 0, y: 1.62, z: 8 }, { x: 0, y: 0, z: -1 }, 100, state.map, weapon);

test('Classic RMB is one simultaneous three-round volley; held buttons never repeat it or add ADS', () => {
  const state = encounter('classic', 2);
  ticks(state, 120, { 0: { aim: true } });
  assert.equal(shots(state).length, 3); assert.deepEqual(shots(state).map(hit => hit.tick), [1, 1, 1]);
  assert.equal(state.players[0].ammo, 9); assert.equal(state.players[0].shots, 3);
  assert.equal(state.players[0].aimTicks, 0); assert.equal(state.players[0].aiming, false);
  assert.ok(shots(state).every(hit => hit.fireMode === 'volley' && hit.pelletCount === 1));
  const fire = resolveActiveFire('classic', state.players[0]);
  assert.equal(fire.ammoCost, 3); assert.equal(fire.pelletSpread, 0); assert.equal(fire.spread, WEAPONS.classic.alternateFire.spread);
  ticks(state); ticks(state, 1, { 0: { aim: true } });
  assert.equal(state.players[0].ammo, 6); assert.equal(shots(state).length, 6);
});

test('Classic primary/alternate fences, partial magazines and reload cannot create free rounds', () => {
  const simultaneous = encounter('classic');
  ticks(simultaneous, 70, { 0: { fire: true, aim: true } }); assert.equal(shots(simultaneous).length, 0);
  ticks(simultaneous, 30, { 0: { aim: true } }); assert.equal(shots(simultaneous).length, 0, 'releasing LMB is not a fresh RMB press');
  ticks(simultaneous); ticks(simultaneous, 1, { 0: { fire: true } }); assert.equal(shots(simultaneous).length, 1);
  ticks(simultaneous, 30, { 0: { fire: true } }); assert.equal(shots(simultaneous).length, 1);
  const partial = encounter('classic'); partial.players[0].ammo = 2;
  ticks(partial, 1, { 0: { aim: true } }); assert.equal(shots(partial).length, 2); assert.equal(partial.players[0].ammo, 0);
  ticks(partial); ticks(partial, 1, { 0: { reload: true, aim: true } }); ticks(partial, WEAPONS.classic.reloadTicks + 70, { 0: { aim: true } });
  assert.equal(shots(partial).length, 2); assert.equal(partial.players[0].ammo, 12);
});

test('held Classic RMB cannot become a knife attack or a deferred volley through swaps', () => {
  const state = encounter('classic', 1.2);
  ticks(state, 1, { 0: { aim: true } }); ticks(state, 1, { 0: { aim: true, swap: true } });
  ticks(state, 60, { 0: { aim: true } }); assert.equal(state.players[0].slot, 'sword');
  assert.equal(state.events.filter(hit => hit.type === 'meleeStart').length, 0);
  ticks(state, 1, { 0: { aim: true, swap: true } }); ticks(state, 70, { 0: { aim: true } });
  assert.equal(shots(state).length, 3); ticks(state); ticks(state, 1, { 0: { aim: true } }); assert.equal(shots(state).length, 6);
});

for (const id of ['stinger', 'bulldog']) test(`${id} ADS burst commits its rounds and recovery after releasing LMB/RMB`, () => {
  const state = encounter(id), profile = WEAPONS[id].adsBurst;
  ticks(state, 1, { 0: { fire: true, aim: true } });
  ticks(state, (profile.count - 1) * profile.intervalTicks);
  assert.deepEqual(shots(state).map(hit => hit.tick), Array.from({ length: profile.count }, (_, i) => 1 + i * profile.intervalTicks));
  assert.equal(state.players[0].ammo, WEAPONS[id].magazine - profile.count); assert.equal(state.players[0].burstRemaining, 0);
  const recoveryEnd = state.tick + Math.ceil(state.players[0].shotCooldown);
  ticks(state, Math.ceil(state.players[0].shotCooldown) - 1, { 0: { fire: true } }); assert.equal(shots(state).length, profile.count);
  ticks(state, 1, { 0: { fire: true } }); assert.equal(shots(state).at(-1).tick, recoveryEnd);
  assert.equal(shots(state).at(-1).fireMode, 'auto', 'hip mode resumes only after the committed recovery');
});

for (const id of ['stinger', 'bulldog']) test(`${id} held ADS repeats finite bursts at nominal launch-start cadence within one tick`, () => {
  const state = encounter(id), profile = WEAPONS[id].adsBurst;
  ticks(state, 600, { 0: { fire: true, aim: true } });
  const all = shots(state), period = (profile.count - 1) * profile.intervalTicks + profile.recoveryTicks;
  for (let i = 0; i < all.length; i += profile.count) assert.ok(Math.abs(all[i].tick - (1 + i / profile.count * period)) <= 1 + 1e-7);
  assert.equal(state.players[0].ammo, 0); assert.equal(all.length, WEAPONS[id].magazine);
});

test('reload and swap cancel an ADS burst without later ghost rounds', () => {
  for (const interrupt of [{ reload: true }, { swap: true }]) {
    const state = encounter('stinger');
    ticks(state, 1, { 0: { fire: true, aim: true } }); ticks(state, 1, { 0: interrupt }); ticks(state, 30);
    assert.equal(shots(state).length, 1); assert.equal(state.players[0].burstRemaining, 0);
  }
});

for (const id of ['ares', 'phantom', 'vandal', 'spectre']) test(`${id} fires immediately and keeps fractional nominal cadence without accumulating tick drift`, () => {
  for (const aim of [false, true]) {
    const state = encounter(id);
    ticks(state, 600, { 0: { fire: true, aim } });
    const all = shots(state), interval = weaponFireIntervalTicks(id, {}, { aim });
    assert.equal(all[0].tick, 1); assert.equal(all.length, WEAPONS[id].magazine);
    for (let i = 0; i < all.length; i++) assert.ok(Math.abs(all[i].tick - (1 + i * interval)) <= 1 + 1e-7, `${id}/${aim}/${i}: ${all[i].tick}`);
    assert.equal(state.players[0].ammo, 0);
  }
});

test('Odin accelerates sustained hip fire, resets on release and starts full ADS cadence immediately', () => {
  const hip = encounter('odin'); ticks(hip, 180, { 0: { fire: true } });
  const all = shots(hip), intervals = all.slice(1).map((hit, i) => hit.tick - all[i].tick);
  assert.equal(all[0].tick, 1); assert.equal(intervals[0], 10); assert.ok(intervals.slice(-5).every(value => value >= 7 && value <= 8));
  ticks(hip); assert.equal(hip.players[0].spinTicks, 0);
  const ads = encounter('odin'); ticks(ads, 240, { 0: { fire: true, aim: true } });
  for (let i = 0; i < shots(ads).length; i++) assert.ok(Math.abs(shots(ads)[i].tick - (1 + i * 120 / 15.6)) <= 1 + 1e-7);
});

test('Outlaw has two per-press shots, actual recovery and distinct tactical/empty reload durations', () => {
  for (const ammo of [0, 1]) {
    const state = encounter('outlaw'); state.players[0].ammo = ammo; state.players[0].reserve = 1;
    ticks(state, 1, { 0: { reload: true } }); const duration = weaponReloadDuration('outlaw', ammo);
    assert.equal(duration, ammo ? 276 : 456); assert.equal(state.events.find(hit => hit.type === 'reload').durationTicks, duration);
    ticks(state, duration - 1, { 0: { fire: true } }); assert.equal(state.players[0].ammo, ammo); assert.equal(shots(state).length, 0);
    ticks(state); assert.equal(state.players[0].ammo, ammo + 1); assert.equal(state.players[0].reserve, 0);
  }
  const pair = encounter('outlaw'); ticks(pair, 1, { 0: { fire: true, aim: true } }); ticks(pair, 43, { 0: { aim: true } });
  assert.equal(pair.players[0].recoil, 0, 'researched first-shot recovery settles before shot two');
  ticks(pair, 1, { 0: { fire: true, aim: true } }); ticks(pair, 80, { 0: { fire: true, aim: true } });
  assert.deepEqual(shots(pair).map(hit => hit.tick), [1, 45]); assert.equal(pair.players[0].ammo, 0);
});

test('Bucky uses one shell for its clear 7.5-metre airburst and measures damage from the original eye', () => {
  const state = encounter('bucky', 8.5); ticks(state, 1, { 0: { aim: true } });
  assert.equal(shots(state).length, 5); assert.equal(state.players[0].ammo, 4); assert.equal(state.players[0].shots, 1);
  assert.ok(shots(state).every(hit => hit.fireMode === 'airburst' && hit.burstOrigin));
  for (const shot of shots(state)) for (const contact of shot.contacts) {
    assert.ok(contact.distance > 8); assert.equal(contact.damage, weaponDamage('bucky', contact.kind, contact.distance));
  }
  const active = resolveActiveFire('bucky', state.players[0]); assert.equal(active.ammoCost, 1); assert.equal(active.spread, WEAPONS.bucky.hipSpread); assert.equal(active.pelletSpread, WEAPONS.bucky.alternateFire.spread);
});

test('Bucky pre-burst body, wall and map boundary contacts cannot spawn pellets behind cover', () => {
  const close = encounter('bucky', 3); ticks(close, 1, { 0: { aim: true } });
  assert.equal(shots(close).length, 1); assert.equal(shots(close)[0].fireMode, 'airburstSlug'); assert.equal(damage(close)[0].damage, 40);
  const blocked = encounter('bucky', 8.5); blocked.map = { ...arena, colliders: [wall('concrete', .05, 4)] };
  ticks(blocked, 1, { 0: { aim: true } }); assert.equal(shots(blocked).length, 1); assert.equal(shots(blocked)[0].hitKind, 'wall'); assert.equal(damage(blocked).length, 0);
  assert.equal(shots(blocked)[0].burstOrigin, undefined);
  const boundary = encounter('bucky', 3); boundary.players[1].x = 30; boundary.map = { ...arena, bounds: { minX: -5, maxX: 5, minZ: 0, maxZ: 5 } };
  ticks(boundary, 1, { 0: { aim: true } }); assert.equal(shots(boundary).length, 1); assert.equal(shots(boundary)[0].burstOrigin, undefined);
});

test('penetration tiers use real thickness and explicit materials while legacy LOS remains first-surface', () => {
  const state = encounter('classic'); state.map = { ...arena, colliders: [wall('wood', .12)] };
  const results = ['classic', 'ghost', 'sheriff'].map(id => ray(state, id));
  assert.ok(results.every(hit => hit.contacts.length === 1 && hit.penetrationCount === 1));
  assert.ok(results[0].contacts[0].damageMultiplier < results[1].contacts[0].damageMultiplier && results[1].contacts[0].damageMultiplier < results[2].contacts[0].damageMultiplier);
  const first = traceShot(state, 0, { x: 0, y: 1.62, z: 8 }, { x: 0, y: 0, z: -1 }, 100, state.map);
  assert.equal(first.kind, 'wall'); assert.equal(ray(state, 'carbine').kind, 'wall');
  state.map = { ...arena, colliders: [wall('metal', .3)] };
  assert.equal(ray(state, 'classic').contacts.length, 0); assert.equal(ray(state, 'ghost').contacts.length, 0); assert.equal(ray(state, 'sheriff').contacts.length, 1);
  for (const material of ['concrete', 'stone', 'mystery']) { state.map = { ...arena, colliders: [wall(material, .005)] }; assert.equal(ray(state, 'odin').contacts.length, 0); }
});

test('penetration respects layer budget, inside-cover blockers, friendly bodies and a maximum of two hostile actors', () => {
  const layered = encounter('odin'); layered.map = { ...arena, colliders: Array.from({ length: 5 }, (_, i) => wall('wood', .01, 1 + i, `layer-${i}`)) };
  const stopped = ray(layered); assert.equal(stopped.penetrationCount, 4); assert.equal(stopped.contacts.length, 0); assert.equal(stopped.impacts.length, 5);
  layered.map = { ...arena, colliders: [wall('glass', .1, 7.95)] }; assert.equal(ray(layered).contacts.length, 0);
  const actors = encounter('odin');
  for (const [id, z] of [[2, -1.5], [3, -3]]) { const target = createCombatPlayer(id); Object.assign(target, { z, lifeId: id + 7 }); actors.players.push(target); }
  const two = ray(actors); assert.deepEqual(two.contacts.map(hit => hit.playerId), [1, 2]); assert.equal(two.contacts[1].damageMultiplier, WEAPON_PENETRATION.actorRetention);
  actors.players[1].team = actors.players[0].team; const ally = ray(actors); assert.equal(ally.playerId, 1); assert.equal(ally.contacts.length, 0);
});

test('new penetrating shots preserve real fractional HP damage and current target life identity', () => {
  const state = encounter('sheriff'); state.map = { ...arena, colliders: [wall('glass', .1)] };
  ticks(state, 1, { 0: { fire: true } }); assert.equal(damage(state).length, 1);
  const hit = damage(state)[0]; assert.equal(hit.targetLifeId, 7); assert.equal(hit.attackerLifeId, 3); assert.equal(hit.penetrationCount, 1);
  assert.ok(hit.damage > 0 && hit.damage < weaponDamage('sheriff', 'head', 8)); assert.equal(state.players[1].hp, 10000 - hit.damage);
});

test('penetration callbacks stay inside the shared bounded lag-compensated historical view', () => {
  const state = encounter('sheriff'); state.map = { ...arena, colliders: [wall('glass', .1)] }; enableLagCompensation(state);
  ticks(state); state.players[1].x = 1.5; ticks(state, 11);
  assert.equal(setShotViewTick(state, 0, 1), true); ticks(state, 1, { 0: { fire: true } });
  assert.equal(damage(state).length, 1); assert.equal(damage(state)[0].targetLifeId, 7);
  assert.ok(Math.abs(damage(state)[0].hitX) < .22, 'hit uses the historical target pose and current physical wall');
});

test('six simultaneous 15-pellet Shorty volleys retain every accepted shot and damage within 256 events', () => {
  const players = Array.from({ length: 6 }, (_, id) => createCombatPlayer(id, 3, 'shorty'));
  for (const player of players) Object.assign(player, { x: (player.id % 3 - 1) * 4, z: player.team ? -.5 : .5, yaw: player.team ? Math.PI : 0, hp: 10000, maxHp: 10000 });
  const state = { ...encounter('shorty'), players, fighters: players };
  ticks(state, 1, Object.fromEntries(players.map(player => [player.id, { fire: true }])));
  assert.equal(shots(state).length, 90); assert.equal(damage(state).length, 90); assert.equal(state.eventLimit, 256); assert.ok(state.events.length <= 256);
  for (const player of players) assert.equal(player.ammo, 1);
});

test('movement-only prediction follows committed burst and reload sprint locks without mutating combat state', () => {
  for (const weapon of ['stinger', 'bulldog', 'outlaw']) {
    const state = encounter(weapon), original = state.players[0];
    original.hp = 150; original.ammo = weapon === 'outlaw' ? 0 : original.ammo;
    ticks(state, 1, { 0: weapon === 'outlaw' ? { reload: true } : { aim: true, fire: true } });
    const predicted = cloneState(original), unchanged = [predicted.hp, predicted.ammo, predicted.reserve, predicted.shots, predicted.reloadTicks, predicted.burstRemaining];
    for (let tick = 0; tick < (weapon === 'outlaw' ? 80 : 20); tick++) {
      const input = { ...emptyInput(predicted), up: true, sprint: true };
      predictLocalMovement(predicted, input, arena); ticks(state, 1, { 0: input });
      assert.ok(Math.abs(predicted.z - original.z) < 1e-8 && Math.abs(predicted.vz - original.vz) < 1e-8);
    }
    assert.deepEqual([predicted.hp, predicted.ammo, predicted.reserve, predicted.shots, predicted.reloadTicks, predicted.burstRemaining], unchanged);
  }
});

test('all twenty new guns retain exact movement prediction across firing, ADS, sprint and reload inputs', () => {
  const catalog = Object.values(WEAPONS).filter(weapon => weapon.valorant);
  assert.equal(catalog.length, 20);
  for (const weapon of catalog) {
    const state = encounter(weapon.id), own = state.players[0], predicted = cloneState(own), untouched = JSON.stringify(predicted.inventory);
    for (let tick = 0; tick < 100; tick++) {
      const controls = { ...emptyInput(predicted), up: true, sprint: tick > 65, aim: tick >= 5 && tick < 30, fire: !weapon.alternateFire && tick >= 5 && tick < 15, reload: tick === 40 };
      predictLocalMovement(predicted, controls, arena); ticks(state, 1, { 0: controls });
      assert.ok(Math.abs(predicted.z - own.z) < 1e-8 && Math.abs(predicted.vz - own.vz) < 1e-8, `${weapon.id} movement ${tick}`);
    }
    assert.equal(JSON.stringify(predicted.inventory), untouched); assert.equal(predicted.hp, 200); assert.equal(predicted.ammo, weapon.magazine);
  }
});

test('Classic and Bucky fresh RMB interrupt a real potion and prediction releases the same movement lock', () => {
  for (const weapon of ['classic', 'bucky']) {
    const state = encounter(weapon), own = state.players[0]; own.hp = 140;
    assert.equal(pickupInventoryItem(own, { kind: 'heal', amount: 1 }).ok, true);
    ticks(state, 1, { 0: { heal: true } }); assert.ok(own.healTicks > 0);
    const predicted = cloneState(own), controls = { ...emptyInput(own), aim: true, up: true };
    predictLocalMovement(predicted, controls, arena); ticks(state, 1, { 0: controls });
    assert.equal(own.healTicks, 0); assert.ok(shots(state).length > 0); assert.ok(Math.abs(predicted.vz - own.vz) < 1e-8);
    assert.equal(own.hp, 140); assert.equal(own.potions, 0);
  }
});

test('mixed new fire modes, penetration and inventory interruptions replay deterministic complete snapshots', () => {
  for (const weapon of ['classic', 'stinger', 'bulldog', 'odin', 'outlaw', 'bucky']) {
    const authority = encounter(weapon), browser = cloneState(authority);
    for (let tick = 0; tick < 360; tick++) {
      const input = { 0: { fire: weapon === 'classic' || weapon === 'bucky' ? tick % 71 === 0 : tick < 160, aim: tick < 120, reload: tick === 180, swap: tick === 210 || tick === 280, right: tick < 30 } };
      ticks(authority, 1, input); ticks(browser, 1, input); assert.deepEqual(browser, authority, `${weapon} ${tick}`);
    }
  }
});
