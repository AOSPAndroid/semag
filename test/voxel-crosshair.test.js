import assert from 'node:assert/strict';
import test from 'node:test';
import { ADS, aimDirection, createCombatPlayer } from '../public/voxel-engine.js';
import { WEAPONS, WEAPON_IDS, weaponAimFovRatio, weaponSpread } from '../public/voxel-weapons.js';
import { resolveActiveFire } from '../public/voxel-fire-modes.js';
import { CROSSHAIR_ROLES, CROSSHAIR_TIMING, crosshairAngularSpread, crosshairPresentation, createCrosshairPresenter, paintCrosshair } from '../public/voxel-crosshair.js';

const player = (weapon = 'carbine', patch = {}) => ({ ...createCombatPlayer(0, 1, weapon), alive: true, grounded: true, slot: 'primary', ...patch });
const viewport = { width: 1280, height: 720, rules: ADS };
const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: ${actual} vs ${expected}`);

test('reticle families distinguish pellet, slug, bolt, precision and all gun roles', () => {
  const examples = {
    sidearm: ['pistol', 'revolver', 'dualpistols', 'classic', 'ghost', 'sheriff'],
    precision: ['marksman', 'sniper', 'marshal', 'outlaw', 'operator'],
    smg: ['smg', 'pdw', 'dualsmg', 'stinger', 'spectre'],
    rifle: ['carbine', 'burst', 'battlerifle', 'bulldog', 'guardian', 'vandal', 'warden'],
    shotgun: ['shotgun', 'autoshotgun', 'shorty', 'bucky', 'judge'],
    slug: ['slugshotgun'], lmg: ['lmg', 'ares', 'odin'], bolt: ['crossbow'],
  };
  for (const [role, ids] of Object.entries(examples)) for (const id of ids) {
    const view = crosshairPresentation(player(id), viewport);
    assert.equal(view.role, role, id); assert.equal(view.visible, true, id);
    assert.equal(view.arm, CROSSHAIR_ROLES[role].arm);
    assert.equal(view.stroke, CROSSHAIR_ROLES[role].stroke);
  }
  assert.equal(crosshairPresentation(player('shotgun'), viewport).ballistic, 'pellets');
  assert.equal(crosshairPresentation(player('slugshotgun'), viewport).ballistic, 'slug');
  assert.equal(crosshairPresentation(player('crossbow'), viewport).ballistic, 'bolt');
  assert.equal(crosshairPresentation(player('vandal', { slot: 'sword', meleeWeapon: 'katana' }), viewport).ballistic, 'melee');
  assert.ok(CROSSHAIR_ROLES.lmg.arm > CROSSHAIR_ROLES.rifle.arm && CROSSHAIR_ROLES.lmg.stroke > CROSSHAIR_ROLES.rifle.stroke);
});

test('Classic volley and Bucky distant airburst advertise their real alternate ammunition mode', () => {
  const classic = player('classic', { previousInput: { aim: true }, aimTicks: 18 });
  const volley = crosshairPresentation(classic, viewport), single = crosshairPresentation(player('classic'), viewport);
  assert.equal(single.role, 'sidearm'); assert.equal(single.ballistic, 'hitscan');
  assert.equal(volley.role, 'shotgun'); assert.equal(volley.ballistic, 'volley');
  assert.equal(volley.alternate, true); assert.equal(volley.ads, 0); assert.equal(volley.effectiveFov, 70);
  assert.ok(volley.angularSpread > single.angularSpread && volley.targetGap > single.targetGap);
  const bucky = player('bucky', { previousInput: { aim: true } });
  const burst = crosshairPresentation(bucky, viewport);
  assert.equal(burst.ballistic, 'airburst'); assert.equal(burst.fireMode, 'airburst');
  assert.equal(burst.ads, 0); assert.equal(resolveActiveFire('bucky', bucky).burstDistance, 7.5);
  close(burst.angularSpread, WEAPONS.bucky.alternateFire.spread, 'fan opens at accepted pop distance');
});

test('every reticle uses the real immutable gun spread, velocity threshold, heat and grounded penalty', () => {
  for (const id of WEAPON_IDS) for (const aiming of [false, true]) {
    const gun = WEAPONS[id], source = player(id, { vx: gun.speed * .4 + .22, vz: 0, heat: 3, grounded: false, aimTicks: aiming ? 18 : 0 });
    const before = structuredClone(source), view = crosshairPresentation(source, viewport);
    const ads = aiming && gun.adsEnabled !== false && gun.adsSupported !== false ? 1 : 0;
    const expected = (gun.pelletSpread || 0) + weaponSpread(gun, { motion: .4, grounded: false, heat: 3, ads }, ADS);
    close(view.angularSpread, expected, id);
    assert.equal(view.motionState, 'airborne'); close(view.motion, .4, `${id} motion`);
    assert.deepEqual(source, before, `${id}: presentation does not alter combat`);
  }
  const stop = crosshairPresentation(player('carbine', { vx: .22 }), viewport);
  const move = crosshairPresentation(player('carbine', { vx: WEAPONS.carbine.speed }), viewport);
  const hot = crosshairPresentation(player('carbine', { heat: 8 }), viewport);
  assert.equal(stop.motion, 0); assert.equal(stop.motionState, 'steady');
  assert.ok(move.targetGap > stop.targetGap); assert.ok(hot.targetGap > stop.targetGap);
  assert.equal(crosshairAngularSpread(player('carbine', { slot: 'sword' }), ADS), 0);
});

test('CSS-pixel gap projects actual angular shot rays through the renderer vertical perspective', () => {
  const source = player('slugshotgun', { vx: 3, heat: 2 });
  const view = crosshairPresentation(source, viewport);
  const ray = aimDirection(0, view.angularSpread);
  // Project the engine's true vertical yaw/pitch offset instead of estimating
  // by a constant multiplier or borrowing the framebuffer resolution.
  const verticalNdc = ray.y / -ray.z / Math.tan(view.verticalFov / 2);
  close(view.spreadRadius, verticalNdc * viewport.height / 2, 'projected actual engine ray');
  const horizontal = aimDirection(view.angularSpread, 0);
  const horizontalNdc = horizontal.x / -horizontal.z / Math.tan(view.horizontalFov / 2);
  close(view.spreadRadius, horizontalNdc * viewport.width / 2, 'matching horizontal projection');
  const wide = crosshairPresentation(source, { ...viewport, width: 2560 });
  close(wide.spreadRadius, view.spreadRadius, 'ultrawide width cannot inflate cone');
  assert.ok(wide.horizontalFov > view.horizontalFov);
  const taller = crosshairPresentation(source, { ...viewport, height: 1440 });
  close(taller.spreadRadius, view.spreadRadius * 2, 'CSS viewport height controls scale');
});

test('linear ADS accuracy and smoothstep ADS camera FOV are each applied exactly once', () => {
  for (const id of ['carbine', 'vandal', 'operator']) for (const fraction of [.25, .5, .75, 1]) {
    const source = player(id, { aimTicks: ADS.ticks * fraction, vx: 1, heat: 2 });
    const view = crosshairPresentation(source, { ...viewport, fov: 83 });
    close(view.ads, fraction, `${id} raw spread progress`);
    const cameraProgress = fraction * fraction * (3 - 2 * fraction);
    close(view.cameraAds, cameraProgress, `${id} camera progress`);
    close(view.effectiveFov, 83 * (1 + (weaponAimFovRatio(id, ADS) - 1) * cameraProgress), `${id} zoom`);
    const motion = (1 - .22) / WEAPONS[id].speed;
    close(view.angularSpread, weaponSpread(id, { motion, grounded: true, heat: 2, ads: fraction }, ADS), `${id} ADS cone`);
  }
  assert.equal(crosshairPresentation(player('operator', { aimTicks: 13 }), viewport).scoped, false);
  assert.equal(crosshairPresentation(player('operator', { aimTicks: 14 }), viewport).scoped, true);
  assert.equal(crosshairPresentation(player('operator', { aimTicks: 18, reloadTicks: 10 }), viewport).scoped, false);
  assert.equal(crosshairPresentation(player('operator', { slot: 'sword', aimTicks: 18 }), viewport).ads, 0);
});

test('gap expands and settles smoothly without moving the exact aiming center', () => {
  const present = createCrosshairPresenter(), stop = player('vandal'), run = player('vandal', { vx: 6 });
  const base = present(stop, 0, 'arena', viewport), expanded = present(run, 10, 'arena', viewport);
  assert.ok(expanded.gap > base.gap && expanded.gap < expanded.targetGap);
  const full = present(run, 60, 'arena', viewport), settle = present(stop, 70, 'arena', viewport);
  assert.ok(full.gap > expanded.gap && settle.gap < full.gap && settle.gap > settle.targetGap);
  for (const source of [run, { ...run, x: 300, y: 50, yaw: 2, pitch: -1.2, recoil: .1, vz: -6 }]) {
    const view = present(source, 80, 'arena', viewport);
    assert.deepEqual(view.center, { x: 640, y: 360 });
  }
});

test('analytic smoothing gives the same elapsed-time result at 30, 60, 120 and 240 Hz', () => {
  const stop = player('vandal'), run = player('vandal', { vx: 6 });
  const samples = [30, 60, 120, 240].map(fps => {
    const present = createCrosshairPresenter(); present(stop, 0, 'room', viewport);
    let view;
    for (let frame = 1; frame <= fps * .3; frame++) view = present(run, frame * 1000 / fps, 'room', viewport);
    const expanded = view.gap;
    for (let frame = 1; frame <= fps * .3; frame++) view = present(stop, 300 + frame * 1000 / fps, 'room', viewport);
    return { expanded, settled: view.gap };
  });
  for (const sample of samples.slice(1)) {
    close(sample.expanded, samples[0].expanded, 'equal expansion');
    close(sample.settled, samples[0].settled, 'equal settling');
  }
});

test('clamped time, pauses, actor life, weapon, context, resize and inactive states cannot carry stale bloom', () => {
  const present = createCrosshairPresenter(), stop = player('vandal'), run = player('vandal', { vx: 6 });
  const base = present(stop, 0, 'room', viewport), skipped = present(run, 300, 'room', viewport);
  const expected = skipped.targetGap + (base.gap - skipped.targetGap) * Math.exp(-CROSSHAIR_TIMING.maxStep / CROSSHAIR_TIMING.expand);
  close(skipped.gap, expected, 'bounded elapsed time');
  const paused = present(stop, 310, 'room', { ...viewport, paused: true });
  close(paused.gap, skipped.gap, 'pause freezes gap');
  close(present(stop, 320, 'room', viewport).gap, base.targetGap, 'resume resets current cone');
  present(run, 330, 'room', viewport);
  for (const [source, time, context, options] of [
    [stop, 329, 'room', viewport], [run, 1000, 'room', viewport],
    [{ ...stop, lifeId: 3 }, 1001, 'room', viewport], [{ ...run, id: 5 }, 1002, 'room', viewport],
    [player('slugshotgun'), 1003, 'room', viewport], [run, 1004, 'new-room', viewport],
    [stop, 1005, 'new-room', { ...viewport, height: 600 }],
  ]) { const view = present(source, time, context, options); close(view.gap, view.targetGap, 'fresh identity'); }
  assert.equal(present(run, 1010, 'room', { ...viewport, active: false }).visible, false);
  const resumed = present(run, 1011, 'room', viewport); close(resumed.gap, resumed.targetGap, 'inactive resets');
  present(stop, 1012, 'room', viewport);
  const reduced = present(run, 1013, 'room', { ...viewport, reducedMotion: true }); close(reduced.gap, reduced.targetGap, 'reduced motion');
  present.reset(); const reset = present(stop, 1014, 'room', viewport); close(reset.gap, reset.targetGap, 'explicit reset');
});

test('missing, malformed, utility and dead inputs have finite, safely bounded geometry', () => {
  const malformed = [null, {}, player('__proto__'), player('constructor'), player('operator', { vx: Infinity, vz: NaN, heat: Infinity, aimTicks: NaN }),
    player('operator', { vx: 1e100, grounded: false, heat: 1e100, aimTicks: 1e100 })];
  for (const source of malformed) {
    const view = crosshairPresentation(source, { width: NaN, height: -1, fov: Infinity, rules: { ticks: NaN } });
    for (const key of ['angularSpread', 'spreadRadius', 'gap', 'arm', 'stroke', 'verticalFov', 'horizontalFov', 'focalLength']) assert.ok(Number.isFinite(view[key]), key);
    assert.ok(view.gap >= 0 && view.gap <= 120);
  }
  assert.equal(crosshairPresentation(null).visible, false);
  assert.equal(crosshairPresentation(player('vandal', { alive: false }), viewport).visible, false);
  for (const slot of ['potion', 'grenade', 'empty']) assert.equal(crosshairPresentation(player('vandal', { slot }), viewport).visible, false);
  assert.equal(crosshairPresentation(player('vandal', { healing: true }), viewport).visible, false);
  const airborne = crosshairPresentation(player('operator', { grounded: false, vx: 20, heat: 8 }), viewport);
  assert.equal(airborne.clipped, true); assert.ok(airborne.spreadRadius > airborne.gap);
  assert.equal(crosshairPresentation(player(), { fov: 1 }).baseFov, 55);
  assert.equal(crosshairPresentation(player(), { fov: 180 }).baseFov, 95);
});

function elementStub() {
  const attributes = new Map([['data-hit-kind', 'headshot'], ['data-hit-pulse', '1']]);
  const styles = new Map([['transform', 'translate(-50%, -50%)'], ['left', '50%'], ['top', '50%']]);
  const classes = new Set(['crosshair']); let writes = 0;
  return { hidden: false, attributes, styles, get writes() { return writes; },
    classList: { contains: name => classes.has(name), add: name => { classes.add(name); writes++; } },
    getAttribute: name => attributes.get(name), setAttribute: (name, value) => { attributes.set(name, value); writes++; },
    style: { getPropertyValue: name => styles.get(name), setProperty: (name, value) => { styles.set(name, value); writes++; } },
  };
}

test('shared DOM painter never shifts the center, preserves hit feedback and avoids identical writes', () => {
  const element = elementStub(), view = crosshairPresentation(player('slugshotgun', { vx: 3 }), viewport);
  paintCrosshair(element, view);
  assert.equal(element.hidden, false); assert.equal(element.attributes.get('data-reticle'), 'slug');
  assert.equal(element.attributes.get('data-ballistic'), 'slug'); assert.equal(element.attributes.get('data-motion'), 'moving');
  assert.equal(element.attributes.get('data-hit-kind'), 'headshot'); assert.equal(element.attributes.get('data-hit-pulse'), '1');
  assert.equal(element.styles.get('left'), '50%'); assert.equal(element.styles.get('top'), '50%');
  assert.equal(element.styles.get('transform'), 'translate(-50%, -50%)');
  const writes = element.writes; paintCrosshair(element, view); assert.equal(element.writes, writes);
  paintCrosshair(element, crosshairPresentation(player('operator', { aimTicks: 18 }), viewport));
  assert.equal(element.hidden, true); assert.equal(element.attributes.get('data-reticle'), '');
  assert.equal(element.styles.get('--reticle-gap'), '0.00px');
  paintCrosshair(element, null); assert.equal(element.hidden, true);
  paintCrosshair(null, view);
});
