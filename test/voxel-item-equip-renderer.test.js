import assert from 'node:assert/strict';
import test from 'node:test';
import { createCombatPlayer, HEAL } from '../public/voxel-engine.js';
import { createInventoryGun, createInventoryMelee, initializeInventory, selectInventorySlot, refreshInventory, dropInventoryItem } from '../public/voxel-inventory.js';
import { createItemEquipPresenter } from '../public/voxel-item-equip.js';
import { VoxelRenderer } from '../public/voxel-renderer.js';
import { weaponReloadPose } from '../public/voxel-player-animation.js';

const fields = ['x', 'y', 'z', 'pitch', 'yaw', 'roll'];
const fixture = () => {
  const player = createCombatPlayer(0); initializeInventory(player, { potions: 2, grenades: 1 });
  return player;
};
const view = (player, equipMotion = null, extra = {}, map = null) => {
  const receiver = { lastAim: null, swayX: 0, swayY: 0, equipMotion, ...extra };
  return { mesh: VoxelRenderer.prototype._viewModel.call(receiver, player, 0, 0, 200, false, map), receiver };
};
const vertices = mesh => Array.from({ length: mesh.length / 10 }, (_, index) => [...mesh.slice(index * 10, index * 10 + 3)]);

test('switching retains the outgoing gun during holster and draws the real knife before settling', () => {
  const player = fixture(), present = createItemEquipPresenter(); present(player, 0, 'dojo');
  const oldMesh = view(player).mesh;
  selectInventorySlot(player, 0); const before = structuredClone(player);
  const start = present(player, 10, 'dojo');
  assert.equal(start.phase, 'holster'); assert.equal(start.visibleWeapon, 'carbine'); assert.equal(start.targetWeapon, 'knife');
  assert.deepEqual(view(player, start).mesh, oldMesh, 'the selected knife does not replace a still-visible gun');
  const lowered = present(player, 65, 'dojo');
  assert.equal(view(player, lowered).mesh.length, oldMesh.length); assert.notDeepEqual(view(player, lowered).mesh, oldMesh);
  const drawing = present(player, 155, 'dojo');
  assert.equal(drawing.phase, 'draw'); assert.equal(drawing.visibleWeapon, 'knife'); assert.ok(drawing.y < -.01 && Math.abs(drawing.roll) > .01);
  const knifeMesh = view(player).mesh;
  assert.equal(view(player, drawing).mesh.length, knifeMesh.length); assert.notDeepEqual(view(player, drawing).mesh, knifeMesh);
  const ready = present(player, 500, 'dojo');
  assert.equal(ready.phase, 'ready'); assert.deepEqual(view(player, ready).mesh, knifeMesh);
  assert.deepEqual(player, before, 'drawing cannot alter the selected slot, ammunition or accepted combat state');
});

test('every held model and its hands use the draw path, including paired items, supplies and empty hands', () => {
  const items = [createInventoryGun('operator'), createInventoryGun('dualpistols'), createInventoryGun('dualsmg'),
    ...['knife', 'sword', 'katana', 'axe', 'tonfas'].map(createInventoryMelee), { kind: 'heal', amount: 2 }, { kind: 'grenade', amount: 1 }, null];
  for (const item of items) {
    const player = fixture(), present = createItemEquipPresenter(); present(player, 0, 'dojo');
    player.inventory[2] = item || createInventoryMelee('knife'); selectInventorySlot(player, 2);
    if (!item) dropInventoryItem(player);
    refreshInventory(player);
    const before = structuredClone(player); present(player, 10, 'dojo');
    const drawing = present(player, 145, 'dojo'), rendered = view(player, drawing).mesh, idle = view(player).mesh;
    assert.equal(drawing.phase, 'draw', `${item?.weapon || item?.kind || 'empty'} draws`);
    assert.ok(rendered.length > 0 && rendered.length <= idle.length, 'draw uses the existing model and hand geometry budget');
    assert.notDeepEqual(rendered, idle); assert.ok([...rendered].every(Number.isFinite));
    assert.deepEqual(player, before);
  }
});

test('the outgoing gun cannot inherit the selected gun shot or reload mechanisms', () => {
  const player = fixture(), present = createItemEquipPresenter(); present(player, 0, 'dojo');
  player.inventory[2] = createInventoryGun('operator'); selectInventorySlot(player, 2);
  const motion = present(player, 10, 'dojo');
  const idle = view(motion.player, motion);
  const poisoned = view(player, motion, { cameraReload: { ...weaponReloadPose('operator', .5), authoritativeTicks: 100 },
    localShot: { weapon: 'carbine', born: 199 }, presentShots: { age: () => 1, sample: () => { throw new Error('stowing item must not sample incoming shot impulses'); } } });
  assert.deepEqual(poisoned.mesh, idle.mesh); assert.equal(poisoned.receiver.reloadMotion.active, false); assert.equal(poisoned.receiver.shotMotion.kick, 0);
});

test('accepted attacks take over the actual held model immediately without changing the draw input', () => {
  const player = fixture(), present = createItemEquipPresenter(); present(player, 0, 'dojo');
  selectInventorySlot(player, 2); present(player, 10, 'dojo');
  player.healTicks = HEAL.ticks - 3; const before = structuredClone(player);
  const motion = present(player, 45, 'dojo', { actionActive: true });
  assert.equal(motion.phase, 'ready'); assert.equal(motion.active, false); assert.equal(motion.player, player);
  assert.deepEqual(view(player, motion).mesh, view(player).mesh); assert.deepEqual(player, before);
});

test('drawn equipment stays before nearby solid cover rather than piercing a wall', () => {
  const map = { colliders: [{ id: 'thin-cover', x: -5, y: -4, z: -.325, w: 10, h: 8, d: .015 }] };
  for (const item of [createInventoryGun('operator'), createInventoryGun('dualpistols'), createInventoryMelee('knife'), createInventoryMelee('katana'), { kind: 'heal', amount: 1 }, { kind: 'grenade', amount: 1 }]) {
    const player = fixture(), present = createItemEquipPresenter(); present(player, 0, 'cover');
    player.inventory[2] = item; selectInventorySlot(player, 2); present(player, 10, 'cover');
    for (const age of [35, 65, 95, 125, 175, 235, 335]) {
      const motion = present(player, age, 'cover'), rendered = view(player, motion, {}, map).mesh;
      assert.ok(vertices(rendered).every(([, , z]) => z > -.31001), `${item.weapon || item.kind}: draw at ${age} stays before cover`);
    }
  }
});

test('reduced motion keeps item roots upright and settles to the unchanged mesh', () => {
  const player = fixture(), present = createItemEquipPresenter(); present(player, 0, 'dojo', { reducedMotion: true });
  selectInventorySlot(player, 0); present(player, 10, 'dojo', { reducedMotion: true });
  const drawing = present(player, 75, 'dojo', { reducedMotion: true });
  assert.equal(drawing.phase, 'draw'); for (const field of fields.filter(field => field !== 'y')) assert.equal(drawing[field], 0);
  assert.ok(drawing.y < 0); assert.ok([...view(player, drawing).mesh].every(Number.isFinite));
  assert.deepEqual(view(player, present(player, 200, 'dojo', { reducedMotion: true })).mesh, view(player).mesh);
});
