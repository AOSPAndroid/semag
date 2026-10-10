import assert from 'node:assert/strict';
import test from 'node:test';
import { ADS, TICK_RATE, createCombatPlayer, combatStep, emptyInput } from '../public/voxel-engine.js';
import { combatPresentation } from '../public/voxel-presentation.js';
import { createWeaponShotPresenter } from '../public/voxel-first-person-motion.js';

// Open physical space isolates gun handling from damage, objectives and AI.
const arena = { id: 'recoil-range', bounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 }, colliders: [], sites: [] };
const fixture = weapon => {
  const players = [createCombatPlayer(0, 1, weapon)];
  return { gameId: 'recoil-fixture', phase: 'fight', tick: 0, map: arena, mapId: arena.id, players, fighters: players, grenades: [], grenadeId: 0, bolts: [], boltId: 0, events: [], eventId: 0, loot: [], lootId: 0 };
};
const advance = (state, ticks, controls = {}) => {
  for (let i = 0; i < ticks; i++) {
    state.tick++;
    combatStep(state, [{ ...emptyInput(state.players[0]), ...controls }], arena);
  }
};
const reports = state => state.events.filter(event => event.type === 'shot' && event.pellet === 0);
const rayPitch = event => Math.atan2(event.dy, Math.hypot(event.dx, event.dz));
const climb = state => rayPitch(reports(state).at(-1)) - rayPitch(reports(state)[0]);
const burst = (weapon, aim = false, count = 5) => {
  const state = fixture(weapon);
  if (aim) advance(state, ADS.ticks, { aim });
  for (let limit = 0; state.players[0].shots < count && limit < 600; limit++) advance(state, 1, { fire: true, aim });
  assert.equal(state.players[0].shots, count, `${weapon}: accepted physical rounds`);
  assert.equal(reports(state).length, count);
  return state;
};

test('a sustained Vandal burst climbs visibly more than a Phantom through the actual accepted shot rays', () => {
  const vandal = burst('vandal'), phantom = burst('phantom');
  assert.ok(climb(vandal) > .035, 'the fifth round should demand a meaningful downward aim correction');
  assert.ok(climb(vandal) > climb(phantom) * 1.5, 'the stronger rifle should retain distinct handling');
  for (const state of [vandal, phantom]) {
    assert.equal(state.players[0].pitch, 0, 'recoil offsets shots without rewriting the mouse angle');
    assert.equal(state.players[0].yaw, 0);
    assert.equal(state.players[0].ammo, state.players[0].inventory[state.players[0].inventoryGunIndex].ammo);
  }
});

test('settled sights reduce both the real impulse and sustained climb on the heavier automatic guns', () => {
  for (const weapon of ['vandal', 'odin', 'warden']) {
    const hipFirst = burst(weapon, false, 1), aimedFirst = burst(weapon, true, 1);
    assert.equal(aimedFirst.players[0].aimTicks, ADS.ticks);
    assert.ok(aimedFirst.players[0].recoil < hipFirst.players[0].recoil * .7, `${weapon}: sights should brace the accepted impulse`);
    assert.ok(aimedFirst.players[0].recoil > 0, `${weapon}: sights must not remove all recoil`);
    const hip = burst(weapon), aimed = burst(weapon, true);
    assert.ok(climb(aimed) > 0, `${weapon}: aimed follow-up rounds still climb`);
    assert.ok(climb(aimed) < climb(hip) * .8, `${weapon}: actual aimed rays should be easier to control`);
  }
});

test('releasing a long burst stops shots and smoothly recovers even a saturated heavy gun', () => {
  for (const weapon of ['vandal', 'odin']) {
    const state = burst(weapon, false, 14), player = state.players[0];
    const accepted = player.shots, ammo = player.ammo;
    assert.ok(player.recoil > .1 && player.recoil <= .13, `${weapon}: sustained kick stays bounded`);
    let previous = player.recoil;
    for (let tick = 0; tick < TICK_RATE * 5; tick++) {
      advance(state, 1);
      assert.ok(player.recoil <= previous && player.recoil >= 0, `${weapon}: release recovery is monotonic`);
      assert.ok(previous - player.recoil < .001, `${weapon}: recovery must not snap between physics ticks`);
      previous = player.recoil;
    }
    assert.equal(player.recoil, 0);
    assert.equal(player.heat, 0);
    assert.equal(player.shots, accepted, 'release cannot create deferred automatic rounds');
    assert.equal(player.ammo, ammo);
  }
});

test('stronger recoil preserves the settled opening ray after a full recovery', () => {
  for (const weapon of ['vandal', 'warden', 'operator', 'shotgun']) {
    const pristine = fixture(weapon), recovered = fixture(weapon);
    advance(pristine, ADS.ticks, { aim: true });
    advance(pristine, 1, { aim: true, fire: true });
    advance(recovered, ADS.ticks, { aim: true });
    advance(recovered, 1, { aim: true, fire: true });
    assert.ok(recovered.players[0].recoil > 0);
    advance(recovered, TICK_RATE * 4, { aim: true });
    assert.equal(recovered.players[0].recoil, 0);
    assert.equal(recovered.players[0].heat, 0);
    // Keep the same indexed scatter sample while testing the recovered gun's
    // authoritative opening ray. The fixture owns this deterministic seed.
    recovered.players[0].shotIndex = 0;
    advance(recovered, 1, { aim: true, fire: true });
    const opening = reports(pristine)[0], next = reports(recovered).at(-1);
    for (const field of ['dx', 'dy', 'dz']) assert.equal(next[field], opening[field], `${weapon}.${field}: no lingering accuracy penalty`);
  }
});

test('cosmetic recoil sampling at different refresh rates cannot mutate combat or alter the next shot', () => {
  const reference = burst('vandal');
  const source = structuredClone(reference), old = structuredClone(reference.players[0]);
  for (const hz of [60, 120, 144, 240]) {
    const state = structuredClone(source), player = state.players[0], presenter = createWeaponShotPresenter();
    const before = structuredClone(state);
    for (const report of reports(state)) presenter.report(report, report.tick / TICK_RATE * 1000);
    for (let frame = 0; frame <= hz; frame++) {
      const time = state.tick / TICK_RATE * 1000 + frame / hz * 1000;
      presenter.sample(player.weapon, time, 0);
      combatPresentation(player, old, 1, frame / hz * 1000);
    }
    assert.deepEqual(state, before, `${hz} Hz: presentation must preserve accepted recoil, timers, ammo and input history`);
    advance(state, 20, { fire: true });
    const expected = structuredClone(source);
    advance(expected, 20, { fire: true });
    assert.deepEqual(state, expected, `${hz} Hz: render frequency cannot change subsequent combat`);
  }
});
