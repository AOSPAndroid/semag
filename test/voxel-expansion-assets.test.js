import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { ADS, HEAL, createCombatPlayer, createState, combatStep, emptyInput, pickupCombatLoot } from '../public/voxel-engine.js';
import { WEAPONS } from '../public/voxel-weapons.js';
import { createExpansionMap } from '../public/voxel-expansion-maps.js';
import { createInventoryGun, selectInventorySlot } from '../public/voxel-inventory.js';
import { createWeaponShotPresenter } from '../public/voxel-first-person-motion.js';
import { weaponMeshes, lootMeshes, createLootPresenter, operativeMeshes, mapMeshes, VoxelRenderer } from '../public/voxel-renderer.js';

const newWeapons = ['revolver', 'pdw', 'autoshotgun', 'battlerifle'];
const digest = array => createHash('sha256').update(new Uint8Array(array.buffer, array.byteOffset, array.byteLength)).digest('hex');
const points = array => Array.from({ length: array.length / 10 }, (_, index) => [...array.slice(index * 10, index * 10 + 3)]);
const actor = patch => ({ ...createCombatPlayer(0), weapon: 'battlerifle', ammo: WEAPONS.battlerifle.magazine, ...patch });
function view(patch = {}, context = {}, map = null) {
  const renderer = { lastAim: null, swayX: 0, swayY: 0, localShot: null, ...context };
  const player = actor(patch), before = JSON.stringify(player);
  const mesh = VoxelRenderer.prototype._viewModel.call(renderer, player, 0, 0, 1000, false, map);
  assert.equal(JSON.stringify(player), before, 'cosmetic hands cannot alter inventory, weapon or action state');
  return { mesh, renderer };
}
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

test('four new held gun silhouettes and their actual reload geometry are distinct from the existing armory', () => {
  const signatures = new Set(Object.keys(WEAPONS).filter(id => !newWeapons.includes(id)).map(id => digest(weaponMeshes(id))));
  for (const weapon of newWeapons) {
    const idle = weaponMeshes(weapon), reload = weaponMeshes(weapon, {}, { reloadProgress: .4 });
    assert.ok(idle.every(Number.isFinite) && reload.every(Number.isFinite));
    assert.ok(!signatures.has(digest(idle)), `${weapon}: its own authored model`);
    signatures.add(digest(idle));
    assert.notEqual(digest(idle), digest(reload), `${weapon}: actual cylinder or magazine changes during reload`);
    assert.ok(idle.length / 10 < 2100 && reload.length / 10 < 2300, `${weapon}: detailed art retains original dynamic budget`);
  }
  const extent = id => -Math.min(...points(weaponMeshes(id)).map(point => point[2]));
  assert.ok(extent('revolver') < extent('pdw'));
  assert.ok(extent('pdw') < extent('autoshotgun'));
  assert.ok(extent('autoshotgun') < extent('battlerifle'));
});

test('flexible potion, grenade and empty slots show their own idle hands and suppress stale gun kick and ADS', () => {
  let samples = 0;
  const sampler = createWeaponShotPresenter();
  assert.equal(sampler.report({ id: 1, type: 'shot', playerId: 0, weapon: 'battlerifle', pellet: 0 }, 990), true);
  assert.ok(sampler.sample('battlerifle', 1000).kick > .5, 'the actual accepted gun impulse is still live when switching to a supply');
  const sample = sampler.sample;
  sampler.sample = (...args) => { samples++; return sample(...args); };
  const signatures = new Set();
  for (const slot of ['potion', 'grenade', 'empty']) {
    const idle = view({ slot }), stale = view({ slot, aimTicks: ADS.ticks }, { presentShots: sampler, localShot: { born: 990, weapon: 'battlerifle' } });
    assert.equal(digest(idle.mesh), digest(stale.mesh), `${slot}: no hidden gun optics or accepted-shot recoil on supplies/hands`);
    assert.equal(stale.renderer.shotMotion.kick, 0);
    assert.ok(idle.mesh.every(Number.isFinite));
    signatures.add(digest(idle.mesh));
  }
  assert.equal(samples, 0, 'non-gun inventory choices never sample gun shot animation');
  assert.equal(signatures.size, 3, 'bottle, fragment shell and two empty hands have different art');
  const idlePotion = view({ slot: 'potion' }).mesh;
  const drinking = view({ slot: 'potion', healTicks: HEAL.ticks / 2 }).mesh;
  assert.notEqual(digest(idlePotion), digest(drinking), 'an idle sealed bottle rises and tips only while drinking');
});

test('all held flexible items respect an actual thin wall before their first person anchor', () => {
  const map = { colliders: [{ id: 'thin-screen', x: -8, y: 0, z: -.325, w: 16, h: 4, d: .015 }] };
  for (const slot of ['potion', 'grenade', 'empty']) for (const patch of [{}, { healTicks: slot === 'potion' ? HEAL.ticks / 2 : 0 }, { grenadeThrowTicks: slot === 'grenade' ? 12 : 0 }]) {
    const { mesh } = view({ slot, ...patch }, {}, map);
    assert.ok(mesh.every(Number.isFinite));
    assert.ok(points(mesh).every(([, , z]) => z > -.31001), `${slot}: supply or bare hands cannot appear beyond the occluded anchor`);
  }
});

test('dropped guns and either blade remain readable miniature props inside the established loot budget', () => {
  const signatures = new Set();
  for (const weapon of [...newWeapons, 'knife', 'sword']) {
    const kind = ['knife', 'sword'].includes(weapon) ? 'melee' : 'weapon';
    const mesh = lootMeshes([{ id: 17, kind, weapon, x: 0, y: 1.2, z: 0 }]);
    assert.equal(mesh.count, 1, `${weapon}: a valid actual ground drop`);
    assert.ok(mesh.opaque.every(Number.isFinite) && mesh.contacts.every(Number.isFinite));
    assert.ok((mesh.opaque.length + mesh.contacts.length) / 10 <= 246, `${weapon}: complete pickup and marker keep original 128-item budget`);
    signatures.add(digest(mesh.opaque));
  }
  assert.equal(signatures.size, 6);
  assert.equal(lootMeshes([{ id: 1, kind: 'melee', weapon: 'carbine', x: 0, y: 0, z: 0 }]).count, 0, 'invalid blade drops do not draw a fallback rifle');
});

test('drop presentation preserves actual falling positions and rebuilds only when the item actually changes', () => {
  const present = createLootPresenter(), item = { id: 'dropped-knife', kind: 'melee', weapon: 'knife', x: 2, y: 3, z: 4 };
  const first = present([item], 0), firstBottom = Math.min(...points(first.contacts).map(point => point[1]));
  present([{ ...item }], 100);
  assert.equal(present.getStats().builds, 1);
  const fallen = present([{ ...item, y: .7 }], 100), fallenBottom = Math.min(...points(fallen.contacts).map(point => point[1]));
  assert.ok(Math.abs(firstBottom - fallenBottom - 2.3) < 1e-5, 'item marker follows authoritative gravity rather than remaining on its original shelf');
  assert.equal(present.getStats().builds, 2);
  present([], 120);
  assert.equal(present.getStats().cachedItems, 0, 'collected drops leave no retained assets');
});

test('teammates visibly equip supplied items and stop carrying a ghost gun after dropping the last slot', () => {
  const renderer = harness(), map = { id: 'inventory-art-open', theme: 'custom', colliders: [], sites: [], bounds: { minX: -8, maxX: 8, minZ: -8, maxZ: 8 } };
  const local = actor({ id: 0, x: 0, z: 3 }), other = actor({ id: 1, x: 0, z: 0, team: 1 });
  const state = { gameId: 'voxel-royale', map, phase: 'fight', round: 1, tick: 0, players: [local, other], events: [], loot: [] };
  const signatures = new Set(), counts = new Map();
  for (const slot of ['primary', 'sword', 'potion', 'grenade', 'empty']) {
    other.slot = slot;
    renderer.render(state, { localId: 0, time: 1000 });
    const mesh = renderer.frameMeshes.world.array;
    signatures.add(digest(mesh)); counts.set(slot, mesh.length / 10);
  }
  assert.equal(signatures.size, 5);
  assert.equal(counts.get('empty'), operativeMeshes(other, 1000, true).length / 10, 'empty remote slot has exactly the human body and no concealed fallback gun');
  assert.ok(counts.get('potion') < counts.get('primary') && counts.get('grenade') < counts.get('primary'));
  renderer.destroy();
});

test('an actual Breach inventory drop draws its finite bounded world prop and clears it after pickup in both tactical views', () => {
  const map = { id: 'tactical-drop-open', theme: 'custom', colliders: [], sites: [], bounds: { minX: -8, maxX: 8, minZ: -8, maxZ: 8 } };
  for (const gameId of ['voxel-breach', 'voxel-practice']) {
    const renderer = harness(), state = createState(), player = createCombatPlayer(0, 1, 'pdw');
    Object.assign(state, { gameId, map, phase: 'fight', players: [player], fighters: [player], tick: 1 });
    renderer.render(state, { localId: 0, time: 1000 });
    assert.equal(renderer.stats.lootItems, 0);
    combatStep(state, [{ ...emptyInput(), drop: true }], map);
    assert.equal(player.slot, 'empty');
    assert.equal(state.loot.length, 1);
    assert.equal(state.loot[0].weapon, 'pdw');
    const before = JSON.stringify(state);
    renderer.render(state, { localId: 0, time: 1016 });
    assert.equal(JSON.stringify(state), before, 'drawing a tactical drop does not change its authority state');
    assert.equal(renderer.stats.lootItems, 1, `${gameId}: actual dropped inventory is visible outside Royale/Horde`);
    assert.ok(renderer.frameMeshes.world.array.length > 0);
    assert.ok(renderer.frameMeshes.world.array.every(Number.isFinite));
    assert.ok(renderer.stats.dynamicVertices < 1000, 'one dropped compact weapon and its marker stay bounded');
    assert.equal(renderer.stats.spawnWarnings, 0);
    assert.equal(renderer.stats.stormVertices, 0);
    assert.equal(pickupCombatLoot(state, player, state.loot[0]), true);
    assert.equal(state.loot.length, 0);
    renderer.render(state, { localId: 0, time: 1032 });
    assert.equal(renderer.stats.lootItems, 0);
    assert.equal(renderer.stats.cachedLootItems, 0, 'collected tactical drop geometry and cache disappear');
    assert.equal(renderer.frameMeshes.world.array.length, 0, 'no invisible retained world gun after collection');
    renderer.destroy();
  }
});

test('switching between two physical copies of the same gun clears the previous inventory item shot kick', () => {
  const renderer = harness(), player = createCombatPlayer(0, 1, 'pdw');
  player.inventory[2] = createInventoryGun('pdw');
  const state = { gameId: 'voxel-breach', map: { id: 'duplicate-gun-open', theme: 'custom', colliders: [], sites: [], bounds: { minX: -8, maxX: 8, minZ: -8, maxZ: 8 } }, phase: 'fight', round: 1, tick: 1,
    players: [player], loot: [], events: [{ id: 31, tick: 1, type: 'shot', weapon: 'pdw', playerId: 0, x: 0, y: 1.62, z: 0, dx: 0, dy: 0, dz: -1, hitX: 0, hitY: 1.62, hitZ: -7, hitKind: 'none' }] };
  renderer.render(state, { localId: 0, time: 1000 });
  assert.ok(renderer.stats.firstPerson.shot.kick > 0, 'an actual accepted PDW event moves the first gun');
  assert.equal(selectInventorySlot(player, 2), true);
  assert.equal(player.weapon, 'pdw');
  assert.equal(player.slot, 'primary');
  renderer.render(state, { localId: 0, time: 1008 });
  assert.equal(renderer.stats.firstPerson.shot.kick, 0, 'the second PDW starts from its own settled pose');
  assert.equal(renderer.localShot, null);
  renderer.destroy();
});

test('snow, underground sewer and enclosed trading floor art retain all six real map budgets and solids', () => {
  const signatures = new Set();
  for (const mode of ['breach', 'royale']) for (const id of ['snow', 'sewers', 'trading']) {
    const map = createExpansionMap(id, mode), before = JSON.stringify(map), mesh = mapMeshes(map);
    assert.equal(JSON.stringify(map), before, `${mode}/${id}: artwork never adds authority colliders or changes traversable surfaces`);
    assert.ok(mesh.opaque.every(Number.isFinite) && mesh.shadows.every(Number.isFinite));
    assert.ok((mesh.opaque.length + mesh.shadows.length) / 10 < 100000, `${mode}/${id}: original static art budget`);
    assert.equal(mesh.opaque.length % 30, 0);
    const vertexKeys = new Set(points(mesh.opaque).map(point => point.map(value => value.toFixed(4)).join(':')));
    for (const collider of map.colliders) for (const x of [collider.x, collider.x + collider.w]) for (const y of [collider.y, collider.y + collider.h]) for (const z of [collider.z, collider.z + collider.d]) {
      assert.ok(vertexKeys.has([x, y, z].map(value => value.toFixed(4)).join(':')), `${mode}/${id}/${collider.id}: renders every corner of its actual solid`);
    }
    if (id !== 'snow') {
      const roof = map.colliders.find(collider => collider.overhead);
      assert.ok(roof, `${id}: genuinely enclosed by a real high ceiling`);
      let litUnderside = 0;
      for (let at = 0; at < mesh.opaque.length; at += 10) if (mesh.opaque[at + 4] === -1 && mesh.opaque[at + 1] > roof.y - .011 && mesh.opaque[at + 1] < roof.y && mesh.opaque[at + 6] > .7) litUnderside++;
      assert.ok(litUnderside > 0, `${id}: visible light panels face down into the usable interior`);
    }
    signatures.add(digest(mesh.opaque));
  }
  assert.equal(signatures.size, 6);
});
