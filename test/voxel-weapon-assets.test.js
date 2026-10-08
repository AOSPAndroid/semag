import assert from 'node:assert/strict';
import test from 'node:test';
import { ADS, createCombatPlayer } from '../public/voxel-engine.js';
import { WEAPONS } from '../public/voxel-weapons.js';
import { weaponMeshes, lootMeshes, VoxelRenderer } from '../public/voxel-renderer.js';

const vertices = mesh => Array.from({ length: mesh.length / 10 }, (_, index) => [...mesh.slice(index * 10, index * 10 + 3)]);
const model = (weapon, patch = {}, map = null, context = {}) => VoxelRenderer.prototype._viewModel.call({ lastAim: null, swayX: 0, swayY: 0, localShot: null, ...context }, { ...createCombatPlayer(0), weapon, ammo: WEAPONS[weapon].magazine, ...patch }, 0, 0, 1000, false, map);

test('all authored gun surfaces, strings and accents respect positive and behind-anchor cut planes', () => {
  for (const weapon of Object.keys(WEAPONS)) for (const limit of [-.27, 0, .03, .2, .5]) {
    const mesh = weaponMeshes(weapon, {}, { limit });
    assert.ok(mesh.every(Number.isFinite));
    assert.equal(mesh.length % 30, 0);
    assert.ok(vertices(mesh).every(([, , z]) => z >= -limit - 1e-6), `${weapon}: no detail or string can recreate geometry across a cut plane`);
  }
});

// An actual camera ray through every triangle catches a solid optic lens,
// oversized cuff or decorative screw accidentally covering the crosshair.
function intersectsSight(mesh) {
  const points = vertices(mesh);
  for (let index = 0; index < points.length; index += 3) {
    const [a, b, c] = points.slice(index, index + 3);
    // The aligned front post intentionally ends exactly at the aim ray.
    // A surface entirely below that boundary leaves the sight picture clear.
    if (Math.max(a[1], b[1], c[1]) <= 1e-6) continue;
    const bx = b[0] - a[0], by = b[1] - a[1], cx = c[0] - a[0], cy = c[1] - a[1];
    const determinant = bx * cy - cx * by;
    if (Math.abs(determinant) < 1e-9) continue;
    const u = (-a[0] * cy + a[1] * cx) / determinant, v = (-bx * a[1] + by * a[0]) / determinant;
    if (u < -1e-6 || v < -1e-6 || u + v > 1 + 1e-6) continue;
    const z = a[2] + u * (b[2] - a[2]) + v * (c[2] - a[2]);
    if (z < -.03) return true;
  }
  return false;
}

test('the real aimed camera ray stays clear through all nine sights and shaped gloves', () => {
  const lens = [[-.1, -.1, -.4], [-.1, .1, -.4], [.1, .1, -.4], [-.1, -.1, -.4], [.1, .1, -.4], [.1, -.1, -.4]];
  assert.equal(intersectsSight(new Float32Array(lens.flatMap(point => [...point, 0, 0, 1, 1, 1, 1, 1]))), true, 'the ray on a solid lens diagonal must remain an obstruction');
  for (const weapon of Object.keys(WEAPONS)) {
    assert.equal(intersectsSight(model(weapon, { aimTicks: ADS.ticks })), false, `${weapon}: ready ADS sight aperture`);
  }
});

test('guns, muzzle flashes, knives and committed sword swings cannot reappear past a thin wall before their anchor', () => {
  const map = { colliders: [{ x: -8, y: 0, z: -.325, w: 16, h: 4, d: .015 }] };
  for (const weapon of Object.keys(WEAPONS)) for (const patch of [{}, { aimTicks: ADS.ticks }, { reloadTicks: Math.floor(WEAPONS[weapon].reloadTicks * .6) }, { grenadeThrowTicks: 12 }]) {
    const mesh = model(weapon, patch, map, { localShot: { born: 990, weapon } });
    assert.ok(mesh.every(Number.isFinite));
    assert.ok(vertices(mesh).every(([, , z]) => z > -.31001), `${weapon}: ${JSON.stringify(patch)} stays on the eye side of real .015m cover`);
  }
  for (const meleeWeapon of ['knife', 'sword']) for (const meleeYaw of [0, Math.PI / 2, -Math.PI / 2, Math.PI]) {
    const mesh = model('carbine', { slot: 'sword', meleeWeapon, meleeTicks: 10, meleeYaw }, map);
    assert.ok(vertices(mesh).every(([, , z]) => z > -.31001), `${meleeWeapon}: committed ${meleeYaw} cannot paint across an occluded anchor`);
  }
});

test('wide crossbow limbs and tall optics remain on the eye side of actual nearby side and overhead cover', () => {
  const side = { colliders: [{ x: .34, y: 0, z: -3, w: .015, h: 4, d: 6 }] };
  const crossbow = model('crossbow', {}, side);
  assert.ok(crossbow.length < model('crossbow').length);
  assert.ok(vertices(crossbow).every(([x]) => x < .34), 'a clear central barrel does not allow the wide limb through side cover');
  const ledge = { colliders: [{ x: -3, y: 1.68, z: -3, w: 6, h: .03, d: 6 }] };
  for (const weapon of ['marksman', 'sniper']) {
    const mesh = model(weapon, { aimTicks: ADS.ticks }, ledge);
    assert.ok(vertices(mesh).every(([, y]) => y + 1.62 < 1.68), `${weapon}: scope cannot protrude through a low real ledge`);
  }
});

function harness() {
  const gl = new Proxy({}, { get(_, name) {
    if (name === 'getShaderParameter' || name === 'getProgramParameter') return () => true;
    if (name === 'getAttribLocation') return () => 0;
    if (name === 'getUniformLocation') return (_program, uniform) => uniform;
    if (typeof name === 'string' && name.startsWith('create')) return () => ({});
    return () => {};
  } });
  return new VoxelRenderer({ getContext: () => gl, addEventListener() {}, removeEventListener() {}, getBoundingClientRect: () => ({ width: 960, height: 540 }) });
}

test('every unclipped ten-player loadout and animation fits the shared 72k budget with full supplies, frags, storm and effects', t => {
  const map = { id: 'weapon-budget-open', theme: 'forest', bounds: { minX: -40, maxX: 40, minZ: -40, maxZ: 40 }, colliders: [], sites: [] };
  const pickupKinds = [...Object.keys(WEAPONS).map(weapon => ({ kind: 'weapon', weapon })), ...['heal', 'ammo', 'grenade'].map(kind => ({ kind }))];
  let largest = null, largestCount = 0;
  for (const patch of pickupKinds) {
    const mesh = lootMeshes([{ id: 1, x: 0, y: 0, z: 0, ...patch }]);
    const count = (mesh.opaque.length + mesh.contacts.length) / 10;
    assert.ok(count <= 246, `${JSON.stringify(patch)}: small prop includes its entire contact marker`);
    if (count > largestCount) { largestCount = count; largest = patch; }
  }
  const loot = Array.from({ length: 128 }, (_, id) => ({ id, x: id % 16 - 8, y: 0, z: Math.floor(id / 16) - 4, ...largest }));
  const events = Array.from({ length: 150 }, (_, index) => ({ id: index * 2, tick: 100, type: 'shot', weapon: 'lmg', playerId: index % 10, targetId: 99, x: 0, y: 1.6, z: 4, dx: 0, dy: 0, dz: -1, hitX: 0, hitY: 1.6, hitZ: 0, hitKind: 'body', damage: 26 })).flatMap(event => [event, { ...event, id: event.id + 1, type: 'damage', attack: 'gun' }]);
  let peak = 0, peakPose = '';
  for (const weapon of Object.keys(WEAPONS)) for (const patch of [{}, { aimTicks: ADS.ticks }, { reloadTicks: Math.floor(WEAPONS[weapon].reloadTicks / 2) }, { grenadeThrowTicks: 12 }]) {
    const renderer = harness();
    const players = Array.from({ length: 10 }, (_, id) => ({ ...createCombatPlayer(id), id, team: id, weapon, ammo: WEAPONS[weapon].magazine, x: id * 2 - 10, z: 2, ...patch }));
    const localShot = { id: 302, tick: 100, type: 'shot', weapon, playerId: 0, x: 0, y: 1.62, z: 2, dx: 0, dy: 0, dz: -1, hitX: 0, hitY: 1.62, hitZ: -20, hitKind: 'none' };
    const state = { gameId: 'voxel-royale', map, phase: 'fight', round: 1, tick: 100, players, loot, events: [...events, localShot], maxGrenades: 20,
      storm: { active: true, x: 0, z: 0, radius: 30 }, grenades: Array.from({ length: 20 }, (_, id) => ({ id, x: id % 10 * 2 - 10, y: .12, z: 20 + Math.floor(id / 10) * 3, radius: .12, fuseTicks: 180 })) };
    assert.equal(renderer.render(state, { localId: 0, time: 1000 }), true);
    assert.equal(renderer.stats.lootItems, 128);
    assert.equal(renderer.particles.length, 84);
    assert.equal(renderer.tracers.length, 14);
    assert.ok(renderer.stats.dynamicVertices < 71500, `${weapon} ${JSON.stringify(patch)}: ${renderer.stats.dynamicVertices}, with at least 500 spare vertices`);
    if (renderer.stats.dynamicVertices > peak) { peak = renderer.stats.dynamicVertices; peakPose = `${weapon} ${JSON.stringify(patch)}`; }
    assert.ok(renderer.stats.drawCalls <= 7);
    renderer.destroy();
  }
  t.diagnostic(`Unclipped peak ${peak} dynamic vertices (${peakPose}); ${72000 - peak} spare vertices below the original limit.`);
});
