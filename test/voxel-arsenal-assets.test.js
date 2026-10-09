import assert from 'node:assert/strict';
import test from 'node:test';
import { ADS, createCombatPlayer } from '../public/voxel-engine.js';
import { WEAPONS } from '../public/voxel-weapons.js';
import { MELEE_WEAPONS } from '../public/voxel-melee.js';
import { createWeaponShotPresenter } from '../public/voxel-first-person-motion.js';
import { lootMeshes, meleeMeshes, meleeMotion, operativePose, weaponMeshes, VoxelRenderer } from '../public/voxel-renderer.js';

const points = mesh => Array.from({ length: mesh.length / 10 }, (_, i) => [...mesh.slice(i * 10, i * 10 + 3)]);
const sideMesh = (mesh, side) => {
  const output = [];
  for (let at = 0; at < mesh.length; at += 30) if ([0, 10, 20].every(offset => Math.sign(mesh[at + offset]) === side)) output.push(...mesh.slice(at, at + 30));
  return output;
};
const player = patch => ({ ...createCombatPlayer(0), ...patch });
const view = (actor, context = {}, map = null, time = 1000) => VoxelRenderer.prototype._viewModel.call({ lastAim: null, swayX: 0, swayY: 0, ...context }, actor, 0, 0, time, false, map);

test('paired guns and tonfas have two separated complete silhouettes; katana curve and axe head remain distinct', () => {
  for (const weapon of ['dualpistols', 'dualsmg']) {
    const mesh = weaponMeshes(weapon), vertices = points(mesh);
    assert.ok(vertices.some(([x, , z]) => x > .09 && z < -.4));
    assert.ok(vertices.some(([x, , z]) => x < -.09 && z < -.4));
    assert.ok(vertices.every(([x]) => Math.abs(x) > .09), `${weapon}: clear air between two independent firearms`);
    assert.ok(vertices.some(([x, y]) => x > .09 && y < -.16));
    assert.ok(vertices.some(([x, y]) => x < -.09 && y < -.16));
    assert.ok(mesh.length / 10 <= 1350, 'a pair is cheaper than the existing machine-gun model');
  }
  const katana = points(meleeMeshes({ meleeWeapon: 'katana' }));
  assert.ok(Math.min(...katana.map(([, , z]) => z)) < -1.38, 'recognizable long blade');
  assert.ok(katana.filter(([, , z]) => z < -1.2).every(([x]) => x > .025), 'the single edge curves toward its tip');
  const axe = points(meleeMeshes({ meleeWeapon: 'axe' }));
  assert.ok(axe.filter(([, , z]) => z < -.7).some(([x]) => x < -.30), 'wide bearded head');
  assert.ok(axe.filter(([, , z]) => z > -.3).every(([x]) => Math.abs(x) < .05), 'narrow haft and wrapped grip');
  const tonfas = points(meleeMeshes({ meleeWeapon: 'tonfas' }));
  for (const side of [-1, 1]) {
    assert.ok(tonfas.some(([x, , z]) => Math.sign(x) === side && z < -.7));
    assert.ok(tonfas.some(([x, y, z]) => Math.sign(x) === side && y < -.16 && z > -.08), 'each baton has its own perpendicular grip');
  }
});

test('only the accepted hand recoils and flashes, including after dropped or out-of-order reports', () => {
  for (const weapon of ['dualpistols', 'dualsmg']) for (const hand of [0, 1]) {
    const actor = player({ weapon, ammo: WEAPONS[weapon].magazine }), present = createWeaponShotPresenter();
    const idle = view(actor);
    // Accepted hand is authoritative even when its index disagrees with local
    // event order. Duplicate snapshots must not kick either weapon again.
    const shot = { id: 70, type: 'shot', weapon, playerId: 0, hand, shotIndex: 14, pellet: 0 };
    assert.equal(present.report(shot, 980), true);
    assert.equal(present.report(shot, 990), false);
    assert.equal(present.sample(weapon, 1000, 0, 1 - hand).kick, 0);
    assert.ok(present.sample(weapon, 1000, 0, hand).kick > .8);
    const fired = view(actor, { presentShots: present, localShot: { born: 980, weapon, hand } });
    const side = hand === 0 ? 1 : -1;
    assert.deepEqual(sideMesh(fired, -side), sideMesh(idle, -side), 'off hand stays completely still');
    assert.notDeepEqual(sideMesh(fired, side), sideMesh(idle, side));
    assert.equal(fired.length - idle.length, 72 * 10, 'exactly one muzzle flare, never a duplicate on the idle barrel');
    for (let at = 0; at < fired.length; at += 10) if (fired[at + 2] < -.74 && fired[at + 6] > .94 && fired[at + 7] > .70 && fired[at + 8] < .80) assert.equal(Math.sign(fired[at]), side, 'warm flash appears only on firing hand');
    assert.equal(present.getStats().acceptedShots, 1);
    const fallback = createWeaponShotPresenter();
    assert.equal(fallback.report({ id: 80, type: 'shot', weapon, shotIndex: 1 }, 980), true);
    assert.ok(fallback.sample(weapon, 1000, 0, 0).kick > .8, 'first accepted index is the right hand without optional event metadata');
    assert.equal(fallback.sample(weapon, 1000, 0, 1).kick, 0);
  }
});

test('every new blade and paired firearm respects real thin cover during ready, ADS, reload and committed cuts', () => {
  const wall = { colliders: [{ id: 'thin-cover', x: -5, y: 0, z: -.325, w: 10, h: 4, d: .015 }] };
  for (const weapon of ['dualpistols', 'dualsmg', 'slugshotgun']) for (const patch of [{}, { aimTicks: ADS.ticks }, { reloadTicks: WEAPONS[weapon].reloadTicks * .5 }]) {
    const mesh = view(player({ weapon, ...patch }), { localShot: { born: 990, weapon, hand: 1 } }, wall);
    assert.ok(mesh.every(Number.isFinite));
    assert.ok(points(mesh).every(([, , z]) => z > -.31001), `${weapon}: held item remains before actual cover`);
  }
  for (const meleeWeapon of ['katana', 'axe', 'tonfas']) {
    for (const limit of [-.27, 0, .04, .23, .67]) assert.ok(points(meleeMeshes({ meleeWeapon }, {}, { limit })).every(([, , z]) => z >= -limit - .000001));
    const profile = MELEE_WEAPONS[meleeWeapon];
    for (const hand of [0, 1]) for (const meleeYaw of [0, Math.PI / 2, -Math.PI / 2, Math.PI]) {
      const mesh = view(player({ slot: 'sword', meleeWeapon, meleeHand: hand, meleeTicks: profile.recoveryTicks + profile.activeTicks / 2, meleeYaw }), {}, wall);
      assert.ok(mesh.every(Number.isFinite));
      assert.ok(points(mesh).every(([, , z]) => z > -.31001), `${meleeWeapon}: committed direction ${meleeYaw} remains clipped`);
    }
  }
});

test('tonfa hands alternate real short committed cuts; all five profiles honor their startup, active and recovery phases', () => {
  for (const [meleeWeapon, profile] of Object.entries(MELEE_WEAPONS)) {
    const total = profile.startupTicks + profile.activeTicks + profile.recoveryTicks;
    for (const hand of [0, 1]) {
      assert.equal(meleeMotion({ meleeWeapon, meleeHand: hand, meleeTicks: total }).active, false);
      assert.equal(meleeMotion({ meleeWeapon, meleeHand: hand, meleeTicks: profile.activeTicks + profile.recoveryTicks }).active, true);
      assert.equal(meleeMotion({ meleeWeapon, meleeHand: hand, meleeTicks: profile.recoveryTicks }).active, false);
      assert.equal(meleeMotion({ meleeWeapon, meleeHand: hand, meleeTicks: 0 }).active, false);
    }
  }
  const profile = MELEE_WEAPONS.tonfas, meleeTicks = profile.activeTicks + profile.recoveryTicks;
  const right = meleeMotion({ meleeWeapon: 'tonfas', meleeHand: 0, meleeTicks });
  const left = meleeMotion({ meleeWeapon: 'tonfas', meleeHand: 1, meleeTicks });
  assert.equal(right.yaw, -left.yaw);
  assert.equal(right.pitch, left.pitch);
});

test('two visible world guns follow separate human hands and all new supplies fit the existing small prop cache', () => {
  for (const weapon of ['dualpistols', 'dualsmg']) for (const crouching of [false, true]) {
    const pose = operativePose(player({ weapon, crouching }));
    assert.ok(pose.arms[0].hand[0] < -.17 && pose.arms[1].hand[0] > .17, 'left arm holds its own gun instead of crossing to support the right');
    for (const arm of pose.arms) assert.ok(arm.hand[1] < (crouching ? .83 : 1.48) && arm.hand[1] > (crouching ? .5 : 1));
  }
  for (const [kind, ids] of [['weapon', ['dualpistols', 'dualsmg', 'slugshotgun']], ['melee', ['katana', 'axe', 'tonfas']]]) for (const weapon of ids) {
    const loot = lootMeshes([{ id: 1, kind, weapon, x: 0, y: 0, z: 0 }]);
    assert.equal(loot.count, 1);
    assert.ok(loot.opaque.every(Number.isFinite));
    assert.ok((loot.opaque.length + loot.contacts.length) / 10 <= 246, `${weapon}: does not grow maximum supply cost`);
    assert.ok(Math.max(...points(loot.opaque).map(([, y]) => y)) < .4, 'a pickup remains a small hovering prop');
  }
});

function harness() {
  const gl = new Proxy({}, { get(_, key) {
    if (key === 'getShaderParameter' || key === 'getProgramParameter') return () => true;
    if (key === 'getAttribLocation') return () => 0;
    if (key === 'getUniformLocation') return (_program, uniform) => uniform;
    if (typeof key === 'string' && key.startsWith('create')) return () => ({});
    return () => {};
  } });
  return new VoxelRenderer({ getContext: () => gl, getBoundingClientRect: () => ({ width: 960, height: 540 }), addEventListener() {}, removeEventListener() {} });
}

test('ten visible melee loadouts with all supply, blood, storm and grenade pools remain under the unchanged 72k limit', t => {
  const map = { id: 'arsenal-melee-budget', theme: 'forest', bounds: { minX: -40, maxX: 40, minZ: -40, maxZ: 40 }, colliders: [], sites: [] };
  const loot = Array.from({ length: 128 }, (_, id) => ({ id, kind: 'weapon', weapon: 'revolver', x: id % 16 - 8, y: 0, z: Math.floor(id / 16) - 4 }));
  const events = Array.from({ length: 150 }, (_, id) => ({ id: id * 2, type: 'shot', weapon: 'lmg', tick: 100, playerId: id % 10, targetId: 99, x: 0, y: 1.6, z: 4, dx: 0, dy: 0, dz: -1, hitX: 0, hitY: 1.6, hitZ: 0, hitKind: 'body', damage: 26 })).flatMap(event => [event, { ...event, id: event.id + 1, type: 'damage', attack: 'gun' }]);
  let peak = 0;
  for (const [meleeWeapon, profile] of Object.entries(MELEE_WEAPONS)) for (const hand of [0, 1]) for (const meleeTicks of [0, profile.startupTicks + profile.activeTicks + profile.recoveryTicks, profile.recoveryTicks + profile.activeTicks / 2, profile.recoveryTicks / 2]) {
    const renderer = harness();
    const players = Array.from({ length: 10 }, (_, id) => player({ id, team: id, x: id * 2 - 10, z: 2, slot: 'sword', meleeWeapon, meleeHand: hand, meleeTicks }));
    renderer.render({ gameId: 'voxel-royale', map, phase: 'fight', round: 1, tick: 100, players, loot, events, maxGrenades: 20, storm: { active: true, x: 0, z: 0, radius: 30 }, grenades: Array.from({ length: 20 }, (_, id) => ({ id, x: id % 10 * 2 - 10, y: .12, z: 20 + Math.floor(id / 10) * 3, radius: .12, fuseTicks: 180 })) }, { localId: 0, time: 1000 });
    assert.equal(renderer.stats.lootItems, 128);
    assert.equal(renderer.particles.length, 84);
    assert.equal(renderer.tracers.length, 14);
    assert.ok(renderer.stats.dynamicVertices < 71500, `${meleeWeapon}: ${renderer.stats.dynamicVertices}`);
    assert.ok(renderer.stats.drawCalls <= 7);
    peak = Math.max(peak, renderer.stats.dynamicVertices);
    renderer.destroy();
  }
  t.diagnostic(`Full-pool melee peak ${peak}; ${72000 - peak} spare vertices below the original limit.`);
});
