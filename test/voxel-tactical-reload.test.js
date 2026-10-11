import assert from 'node:assert/strict';
import test from 'node:test';
import { WEAPONS, createCombatPlayer, combatStep, emptyInput } from '../public/voxel-engine.js';
import { EMPTY_RELOAD_MULTIPLIER, completeReload, weaponCanReload, weaponCapacity, weaponChambers, weaponReloadDuration } from '../public/voxel-fire-modes.js';

const arena = { id: 'reload-range', bounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 }, colliders: [], sites: [] };
const fixture = weapon => {
  const players = [createCombatPlayer(0, 1, weapon)];
  return { gameId: 'reload-fixture', phase: 'fight', tick: 0, map: arena, mapId: arena.id, players, fighters: players, grenades: [], grenadeId: 0, bolts: [], boltId: 0, events: [], eventId: 0, loot: [], lootId: 0 };
};
const step = (state, controls = {}) => { state.tick++; combatStep(state, [{ ...emptyInput(state.players[0]), ...controls }], arena); };
const fireRounds = (state, rounds) => {
  const player = state.players[0], target = player.shots + rounds;
  for (let limit = 0; player.shots < target && limit < 5000; limit++) step(state, { fire: !state.players[0].previousInput.fire });
  assert.equal(player.shots, target);
};
const reloadFully = state => {
  const player = state.players[0];
  step(state, { reload: true });
  const started = state.events.findLast(event => event.type === 'reload');
  let ticks = 1;
  while (player.reloadTicks > 0 && ticks < 2000) { step(state); ticks++; }
  return { ticks, started };
};

test('box-fed guns chamber a round; revolvers, pumps, bolts, crossbows and paired guns do not', () => {
  for (const id of ['vandal', 'phantom', 'carbine', 'smg', 'classic', 'ghost', 'spectre', 'odin', 'burst']) assert.equal(weaponChambers(WEAPONS[id]), true, id);
  for (const id of ['revolver', 'sheriff', 'shotgun', 'bucky', 'sniper', 'marshal', 'operator', 'crossbow', 'dualpistols', 'dualsmg', 'shorty']) assert.equal(weaponChambers(WEAPONS[id]), false, id);
});

test('a tactical reload is faster than an empty one and keeps the chambered round', () => {
  for (const weapon of ['vandal', 'carbine', 'classic']) {
    const tactical = fixture(weapon); fireRounds(tactical, 3);
    const tacticalReload = reloadFully(tactical);
    assert.equal(tactical.players[0].ammo, WEAPONS[weapon].magazine + 1, `${weapon}: 30+1`);
    assert.equal(tacticalReload.started.tactical, true);
    assert.equal(tacticalReload.started.durationTicks, WEAPONS[weapon].reloadTicks);

    const empty = fixture(weapon); fireRounds(empty, WEAPONS[weapon].magazine);
    assert.equal(empty.players[0].ammo, 0);
    const emptyReload = reloadFully(empty);
    assert.equal(empty.players[0].ammo, WEAPONS[weapon].magazine, `${weapon}: an empty gun loads one magazine`);
    assert.equal(emptyReload.started.tactical, false);
    assert.equal(emptyReload.started.durationTicks, Math.round(WEAPONS[weapon].reloadTicks * EMPTY_RELOAD_MULTIPLIER));
    assert.ok(emptyReload.ticks > tacticalReload.ticks);
  }
});

test('reserve accounting is exact and a full magazine cannot be topped up for its +1', () => {
  assert.deepEqual(completeReload('vandal', 10, 100), { ammo: 26, reserve: 84, loaded: 16 });
  assert.deepEqual(completeReload('vandal', 10, 5), { ammo: 15, reserve: 0, loaded: 5 });
  assert.deepEqual(completeReload('vandal', 0, 100), { ammo: 25, reserve: 75, loaded: 25 });
  assert.deepEqual(completeReload('sheriff', 2, 100), { ammo: 6, reserve: 96, loaded: 4 });
  assert.equal(weaponCapacity('vandal', 1), 26); assert.equal(weaponCapacity('vandal', 0), 25);
  assert.equal(weaponCanReload('vandal', 25, 50), false);
  assert.equal(weaponCanReload('vandal', 26, 50), false);
  assert.equal(weaponCanReload('vandal', 24, 50), true);
  const state = fixture('vandal');
  step(state, { reload: true });
  assert.equal(state.players[0].reloadTicks, 0, 'a full magazine does not reload');
});

test('guns that do not chamber keep one reload time and never exceed their magazine', () => {
  for (const weapon of ['sheriff', 'revolver', 'bucky']) {
    assert.equal(weaponReloadDuration(weapon, 0), WEAPONS[weapon].reloadTicks, weapon);
    const state = fixture(weapon); fireRounds(state, 1); reloadFully(state);
    assert.equal(state.players[0].ammo, WEAPONS[weapon].magazine, weapon);
  }
  assert.equal(weaponReloadDuration('outlaw', 0), WEAPONS.outlaw.emptyReloadTicks, 'researched empty timings are kept');
});

test('switching guns preserves the chambered extra round', () => {
  const state = fixture('vandal'), player = state.players[0];
  fireRounds(state, 2); reloadFully(state);
  assert.equal(player.ammo, 26);
  const gun = player.inventory[player.inventoryGunIndex];
  assert.equal(gun.ammo, 26);
});
