import assert from 'node:assert/strict';
import test from 'node:test';
import { createCombatPlayer, createState, combatStep, emptyInput } from '../public/voxel-engine.js';
import { VALORANT_WEAPON_IDS, WEAPONS } from '../public/voxel-weapons.js';
import { aimFraction, aimLookMultiplier, secondaryActionPresentation, createReloadAudioPresenter } from '../public/voxel-fps-feedback.js';
import { createWeaponShotPresenter, weaponCyclePose, weaponShotPose } from '../public/voxel-first-person-motion.js';
import { createWeaponReloadPresenter, weaponReloadPose } from '../public/voxel-player-animation.js';
import { weaponReloadDuration } from '../public/voxel-fire-modes.js';

const arena = { id: 'presentation-range', bounds: { minX: -25, maxX: 25, minZ: -25, maxZ: 25 }, colliders: [], sites: [] };
function range(weapon) {
  const state = createState(); state.players = [createCombatPlayer(0, 1, weapon)]; state.fighters = state.players;
  state.phase = 'live'; state.map = arena; state.players[0].grounded = true;
  return state;
}
function advance(state, controls = {}) {
  state.tick++; combatStep(state, [{ ...emptyInput(state.players[0]), ...controls }], arena);
}

test('real right-click volleys and unsighted guns retain hip look while scoped weapons settle precisely', () => {
  for (const weapon of VALORANT_WEAPON_IDS) {
    const state = range(weapon), player = state.players[0];
    for (let tick = 0; tick < 20; tick++) advance(state, { aim: true });
    if (WEAPONS[weapon].adsSupported === false) {
      assert.equal(aimFraction(player), 0); assert.equal(aimLookMultiplier(player), 1);
      const view = secondaryActionPresentation(player);
      if (WEAPONS[weapon].alternateFire) {
        assert.equal(view.label, weapon === 'classic' ? 'BURST' : 'AIRBURST');
        assert.equal(state.events.filter(event => event.type === 'shot' && event.pellet === 0).length, weapon === 'classic' ? 3 : 1);
        assert.equal(view.state, 'release');
        const before = state.events.length; advance(state, { aim: true }); assert.equal(state.events.length, before, 'a held alternate must not repeat');
      } else assert.equal(view.kind, 'none');
    } else {
      assert.equal(aimFraction(player), 1); assert.ok(aimLookMultiplier(player) < .55);
      assert.equal(secondaryActionPresentation(player).label, 'AIM');
    }
    assert.equal(aimLookMultiplier({ ...player, reloadTicks: 1 }), 1);
  }
});

test('accepted shots animate every new gun once per round rather than once per pellet', () => {
  for (const weapon of VALORANT_WEAPON_IDS) {
    const state = range(weapon); advance(state, { fire: true });
    const presenter = createWeaponShotPresenter();
    for (const event of state.events) { presenter.report(event, 1000); presenter.report(event, 1000); }
    assert.equal(presenter.getStats().acceptedShots, 1, weapon);
    const pose = presenter.sample(weapon, 1020); assert.ok(pose.kick > 0, `${weapon} has accepted-shot motion`);
    assert.ok(Object.values(pose).every(Number.isFinite));
    assert.equal(presenter.sample(weapon, 1700).kick, 0);
  }
  const sustained = createWeaponShotPresenter();
  for (let shot = 0; shot < 200; shot++) sustained.report({ id: shot, type: 'shot', weapon: 'odin', pellet: 0, shotIndex: shot }, 1000 + shot);
  assert.equal(sustained.getStats().activeShots, 16); assert.ok(sustained.sample('odin', 1205).kick <= 1.7 + 1e-12);
  assert.ok(weaponShotPose('sheriff', 20).pitch > weaponShotPose('ghost', 20).pitch);
  assert.ok(weaponCyclePose('bucky', 230).pump > .8); assert.ok(weaponCyclePose('operator', 250).bolt > .8);
});

test('Outlaw empty and tactical reload animations and sound follow their real accepted duration', () => {
  for (const ammo of [0, 1]) {
    const state = range('outlaw'), player = state.players[0]; player.ammo = player.inventory[1].ammo = ammo;
    const duration = weaponReloadDuration('outlaw', ammo), presenter = createWeaponReloadPresenter();
    const calls = [], audio = createReloadAudioPresenter({ enabled: true, reloadAction(weapon, phase) { calls.push([weapon, phase]); return true; } });
    advance(state, { reload: true }); assert.equal(player.reloadTicks, duration); assert.equal(duration, ammo ? 276 : 456);
    for (let tick = 0; tick < duration; tick++) {
      const before = structuredClone(player);
      const pose = presenter(player, state.tick * 1000 / 120, 'run', { durationTicks: duration });
      audio.observe(player, { tick: state.tick, context: 'run' });
      assert.deepEqual(player, before, 'presentation cannot complete the reload');
      if (player.reloadTicks > 0) { assert.equal(pose.style, 'break'); assert.ok(Math.abs(pose.globalProgress - (1 - player.reloadTicks / duration)) < .04); }
      advance(state);
    }
    assert.equal(player.reloadTicks, 0); assert.equal(player.ammo, 2);
    assert.ok(calls.some(([, phase]) => phase === 'load')); assert.ok(calls.some(([, phase]) => phase === 'close'));
    assert.equal(new Set(calls.map(x => x.join(':'))).size, calls.length, 'each accepted stage sounds once');
  }
  assert.ok(weaponReloadPose('shorty', .4).breakOpen > .99);
  assert.equal(weaponReloadPose('sheriff', .4).style, 'cylinder');
  assert.equal(weaponReloadPose('odin', .4).style, 'belt');
  assert.equal(weaponReloadPose('bucky', .4).style, 'shell');
  assert.equal(weaponReloadPose('shorty', .4, { active: false }).breakOpen, 0);
});
