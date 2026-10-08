import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { MAPS } from '../public/voxel-maps.js';
import { WEAPONS } from '../public/voxel-weapons.js';
import { mapMeshes, surfaceBelow, particlePosition, VoxelRenderer } from '../public/voxel-renderer.js';

const pointVertices = array => {
  const result = [];
  for (let i = 0; i < array.length; i += 10) result.push([...array.slice(i, i + 3)]);
  return result;
};
const digest = array => createHash('sha256').update(new Uint8Array(array.buffer, array.byteOffset, array.byteLength)).digest('hex');
const viewModel = (weapon, patch = {}, context = {}) => VoxelRenderer.prototype._viewModel.call({ lastAim: null, swayX: 0, swayY: 0, localShot: null, ...context }, { weapon, ammo: WEAPONS[weapon].magazine, alive: true, team: 0, aimTicks: 0, ...patch }, 0, 0, 1000);

test('all authored vertical maps remain finite and fit the static geometry budget', () => {
  assert.equal(Object.keys(MAPS).length, 7);
  const signatures = new Set();
  for (const map of Object.values(MAPS)) {
    const meshes = mapMeshes(map);
    for (const array of Object.values(meshes)) {
      assert.ok(array instanceof Float32Array);
      assert.equal(array.length % 30, 0, `${map.id}: whole triangles`);
      assert.ok(array.every(Number.isFinite), `${map.id}: finite vertices`);
    }
    const vertices = (meshes.opaque.length + meshes.shadows.length) / 10;
    assert.ok(vertices > 0 && vertices <= 150000, `${map.id}: ${vertices} vertices`);
    signatures.add(digest(meshes.opaque));
  }
  assert.equal(signatures.size, 7, 'each map builds its own geometry and surface artwork');
});

test('empty and custom maps do not require hardcoded theme collider IDs', () => {
  for (const theme of ['courtyard', 'depot', 'canal', 'rooftops', 'foundry', 'bastion', 'custom']) {
    const map = { id: `fixture-${theme}`, theme, colliders: [], sites: [], bounds: { minX: -5, maxX: 5, minZ: -5, maxZ: 5 } };
    const meshes = mapMeshes(map);
    assert.ok(meshes.opaque.length > 0);
    assert.equal(meshes.shadows.length, 0);
    assert.ok(meshes.opaque.every(Number.isFinite), theme);
  }
});

test('contact shadows select the highest real surface beneath the foot or grenade', () => {
  const crate = { id: 'crate', x: -2, y: 0, z: -2, w: 4, h: .8, d: 4 };
  const deck = { id: 'deck', x: -2, y: 2.8, z: -2, w: 4, h: .4, d: 4 };
  const upper = { id: 'upper', x: -1, y: 4, z: -1, w: 2, h: .8, d: 2 };
  for (const colliders of [[crate, deck, upper], [upper, deck, crate]]) {
    assert.equal(surfaceBelow(colliders, 0, 0, 3.2), deck);
    assert.equal(surfaceBelow(colliders, 0, 0, 2), crate);
    assert.equal(surfaceBelow(colliders, 0, 0, 4.8), upper);
    assert.equal(surfaceBelow(colliders, 0, 0, 0), null);
    assert.equal(surfaceBelow(colliders, 8, 8, 10), null);
  }
});

test('elevated deck sun shadows account for elevation above the floor', () => {
  const collider = { id: 'deck', x: 0, y: 0, z: 0, w: 2, h: .4, d: 2, material: 'concrete' };
  const map = { id: 'shadow-fixture', theme: 'courtyard', colliders: [collider], sites: [] };
  const flat = mapMeshes(map).shadows;
  const raised = mapMeshes({ ...map, colliders: [{ ...collider, y: 3 }] }).shadows;
  const maxX = array => Math.max(...pointVertices(array).map(point => point[0]));
  const minZ = array => Math.min(...pointVertices(array).map(point => point[2]));
  assert.ok(Math.abs(maxX(raised) - maxX(flat) - .52 / .76 * 3) < 1e-5);
  assert.ok(Math.abs(minZ(raised) - minZ(flat) + .39 / .76 * 3) < 1e-5);
});

test('jump-route paint stays flat on real landing tops and within their bounds', () => {
  const collider = { id: 'landing', x: -1, y: 2.8, z: -1, w: 2, h: .4, d: 2, material: 'concrete' };
  const map = { id: 'route-fixture', theme: 'custom', colliders: [collider], sites: [], routes: [{ side: 'south', start: { x: 0, z: 3 }, steps: [{ colliderId: 'landing', x: 0, z: 0 }] }] };
  const withRoute = mapMeshes(map).opaque, plain = mapMeshes({ ...map, routes: [] }).opaque;
  const plainPoints = new Set(pointVertices(plain).map(point => point.join(',')));
  const addedPoints = pointVertices(withRoute).filter(point => !plainPoints.has(point.join(',')));
  assert.ok(addedPoints.length > 0);
  for (const [x, y, z] of addedPoints) {
    if (Math.abs(y - .016) < 1e-5) continue;
    assert.ok(Math.abs(y - 3.204) < 1e-5 || Math.abs(y - 3.216) < 1e-5, `paint height ${y}`);
    assert.ok(x >= collider.x && x <= collider.x + collider.w);
    assert.ok(z >= collider.z && z <= collider.z + collider.d);
  }
});

test('all nine weapon view models stay finite through aim, reload and throw poses', () => {
  assert.equal(Object.keys(WEAPONS).length, 9);
  const silhouettes = new Set();
  for (const weapon of Object.values(WEAPONS)) {
    silhouettes.add(digest(viewModel(weapon.id)));
    for (const patch of [{ aimTicks: 9 }, { aimTicks: 18 }, { reloadTicks: Math.floor(weapon.reloadTicks / 2) }, { grenadeThrowTicks: 12 }, { shotCooldown: weapon.cooldown, spinTicks: 24 }]) {
      const array = viewModel(weapon.id, patch);
      assert.ok(array.every(Number.isFinite), `${weapon.id}: ${JSON.stringify(patch)}`);
      assert.equal(array.length % 30, 0);
      assert.ok(array.length / 10 < 3000, `${weapon.id}: bounded view model`);
    }
  }
  assert.equal(silhouettes.size, 9);
  for (const scoped of ['marksman', 'sniper']) assert.ok(viewModel(scoped, { aimTicks: 18 }).length < viewModel(scoped).length, 'scope glass clears its actual aperture during ADS');
});

test('crossbow shows only a loaded bolt and never paints a gun muzzle flash', () => {
  const loaded = viewModel('crossbow'), empty = viewModel('crossbow', { ammo: 0 });
  assert.equal(loaded.length - empty.length, 144 * 10, 'shaft, tip and two fins disappear when spent');
  const fired = viewModel('crossbow', { ammo: 0 }, { localShot: { born: 990, weapon: 'crossbow' } });
  assert.equal(fired.length, empty.length, 'crossbow kick adds no muzzle-flash geometry');
  assert.notEqual(digest(viewModel('lmg', { spinTicks: 0 })), digest(viewModel('lmg', { spinTicks: WEAPONS.lmg.spinupTicks })), 'LMG charge LEDs reflect authoritative wind-up');
});

test('ballistic events produce impacts without an instantaneous shot tracer', () => {
  const renderer = { eventIds: new Set(), eventQueue: [], tracers: [], particles: [], localShot: null };
  VoxelRenderer.prototype._events.call(renderer, { phase: 'fight', tick: 21, events: [{ id: 1, type: 'boltLaunch', tick: 20, playerId: 0, weapon: 'crossbow', x: 0, y: 1.6, z: 0 }, { id: 2, type: 'boltHit', tick: 21, playerId: 0, hitKind: 'wall', x: 0, y: 1.6, z: -4, nx: 0, ny: 0, nz: 1 }] }, 1000, 0);
  assert.equal(renderer.tracers.length, 0);
  assert.equal(renderer.localShot.weapon, 'crossbow');
  assert.equal(renderer.particles.length, 4, 'a quiet bolt produces fewer fragments than a rifle');
  assert.ok(renderer.particles.every(particle => particle.cover));
});

const effectRenderer = () => ({ eventIds: new Set(), eventQueue: [], tracers: [], particles: [], localShot: null });
const processEffects = (renderer, events, time = 1000, map = MAPS.courtyard) => VoxelRenderer.prototype._events.call(renderer, { phase: 'fight', tick: 21, map, events: events.map(event => ({ tick: 21, ...event })) }, time, 0);
const shot = (weapon, patch = {}) => ({ id: 1, type: 'shot', weapon, playerId: 0, x: 0, y: 1.6, z: 4, dx: 0, dy: 0, dz: -1, hitX: 0, hitY: 1.6, hitZ: 0, hitKind: 'none', ...patch });

test('weapon tracers use distinct profiles and end at the authoritative contact', () => {
  const signatures = new Set();
  for (const weapon of Object.values(WEAPONS)) {
    const renderer = effectRenderer();
    processEffects(renderer, [shot(weapon.id)]);
    if (weapon.projectile) {
      assert.equal(renderer.tracers.length, 0, 'a malformed crossbow shot cannot paint a hitscan beam');
      continue;
    }
    const tracer = renderer.tracers[0];
    assert.deepEqual(tracer.end, [0, 1.6, 0], 'effect never extends beyond the server collision');
    assert.equal(tracer.color, weapon.effects.tracerColor);
    assert.equal(tracer.width, weapon.effects.tracerWidth);
    signatures.add([tracer.color, tracer.width, tracer.life].join(':'));
    processEffects(renderer, [shot(weapon.id)], 1001);
    assert.equal(renderer.tracers.length, 1, 'repeated snapshots do not repeat a report');
    processEffects(renderer, [], 1000 + weapon.effects.tracerTicks * 1000 / 120 + 1);
    assert.equal(renderer.tracers.length, 0, 'beam disappears after its weapon-specific duration');
  }
  assert.equal(signatures.size, 8);
});

test('each gun has a finite distinct firing model; switching weapons clears stale flashes', () => {
  const signatures = new Set();
  for (const weapon of Object.values(WEAPONS)) {
    const fired = viewModel(weapon.id, {}, { localShot: { born: 990, weapon: weapon.id } });
    assert.ok(fired.every(Number.isFinite));
    assert.ok(fired.length / 10 < 3000);
    signatures.add(digest(fired));
    const staleShot = viewModel(weapon.id, {}, { localShot: { born: 990, weapon: weapon.id === 'pistol' ? 'smg' : 'pistol' } });
    assert.equal(digest(staleShot), digest(viewModel(weapon.id)), `${weapon.id}: a previous weapon's flash cannot leak into the new model`);
    if (weapon.projectile) assert.equal(fired.length, viewModel(weapon.id).length);
    else assert.equal(fired.length - viewModel(weapon.id).length, 72 * 10, 'exactly one two-part flash per report');
  }
  assert.equal(signatures.size, 9);
  const smgLate = viewModel('smg', {}, { localShot: { born: 960, weapon: 'smg' } });
  const sniperLate = viewModel('sniper', {}, { localShot: { born: 960, weapon: 'sniper' } });
  assert.equal(smgLate.length, viewModel('smg').length, 'SMG flash is already gone');
  assert.ok(sniperLate.length > viewModel('sniper').length, 'the heavy sniper report is still visible');
});

test('shotgun pellet snapshots create one local kick rather than eight flashes', () => {
  const renderer = effectRenderer();
  const pellets = Array.from({ length: 8 }, (_, pellet) => shot('shotgun', { id: pellet + 1, pellet, pelletCount: 8 }));
  processEffects(renderer, [pellets[0]], 1000);
  processEffects(renderer, pellets.slice(1), 1010);
  assert.equal(renderer.localShot.born, 1000);
  assert.equal(renderer.tracers.length, 8, 'the individual collision rays remain visible');
});

test('metal, wood, stone and damage zones create distinct honest contact fragments', () => {
  const signatures = new Set();
  for (const material of ['wood', 'metal', 'stone']) {
    const collider = { id: 'surface', x: -1, y: 0, z: -1, w: 2, h: 3, d: 1, material };
    const renderer = effectRenderer();
    processEffects(renderer, [shot('carbine', { hitKind: 'wall', colliderId: 'surface' })], 1000, { colliders: [collider] });
    assert.ok(renderer.particles.length > 0);
    assert.ok(renderer.particles.every(particle => particle.cover && particle.material === material && particle.origin[2] > 0 && particle.vz > 0), 'fragments emit outward from the actual contacted front face');
    signatures.add(JSON.stringify(renderer.particles.map(({ color, size, life }) => ({ color, size, life }))));
  }
  assert.equal(signatures.size, 3);
  const colors = new Set();
  for (const hitKind of ['head', 'body', 'leg']) {
    const renderer = effectRenderer();
    processEffects(renderer, [shot('marksman', { hitKind, damage: 20 })]);
    assert.ok(renderer.particles.every(particle => particle.material === hitKind && particle.cover));
    colors.add(renderer.particles[0].color);
  }
  assert.equal(colors.size, 3, 'impact cues distinguish real head, body and leg contacts');
  const ally = effectRenderer();
  processEffects(ally, [shot('marksman', { hitKind: 'head', damage: 0 })]);
  assert.equal(ally.particles[0].material, 'cloth', 'an allied blocker does not produce the damaging head-hit cue');
});

test('impact fragments stop at walls and raised deck undersides and respect their radius', () => {
  const wall = { x: -.25, y: 0, z: -.25, w: .5, h: 4, d: .5 };
  const particle = { origin: [0, 1, 2], born: 1000, vx: 0, vy: 0, vz: -10, life: 1000, gravity: 0, cover: true, size: .02 };
  const wallPoint = particlePosition(particle, 1300, [wall]);
  assert.ok(wallPoint.point[2] > .25 + wallPoint.size / 2);
  const deck = { x: -2, y: 2.8, z: -2, w: 4, h: .4, d: 4 };
  const underside = particlePosition({ ...particle, origin: [0, 1, 0], vy: 10, vz: 0 }, 1300, [deck]);
  assert.ok(underside.point[1] < 2.8 - underside.size / 2);
  const limited = particlePosition({ ...particle, radius: .5 }, 1300, []);
  assert.ok(Math.hypot(...limited.point.map((value, i) => value - particle.origin[i])) <= .5 + 1e-6);
  assert.ok([...wallPoint.point, ...underside.point, ...limited.point].every(Number.isFinite));
});

test('a six-player sustained volley keeps effects within the existing performance budgets', () => {
  const renderer = effectRenderer();
  processEffects(renderer, Array.from({ length: 144 }, (_, id) => shot(id % 3 === 0 ? 'sniper' : 'lmg', { id, playerId: id % 6, hitKind: 'body', damage: 26 })));
  assert.equal(renderer.tracers.length, 14);
  assert.equal(renderer.particles.length, 84);
  for (const particle of renderer.particles) {
    assert.ok([particle.vx, particle.vy, particle.vz, particle.life, ...particle.origin].every(Number.isFinite));
    assert.ok(particlePosition(particle, 1120, MAPS.foundry.colliders).point.every(Number.isFinite));
  }
  processEffects(renderer, [], 2000);
  assert.equal(renderer.tracers.length, 0);
  assert.equal(renderer.particles.length, 0);
});
