import assert from 'node:assert/strict';
import test from 'node:test';
import { createItemEquipPresenter } from '../public/voxel-item-equip.js';

const axes = ['x', 'y', 'z', 'pitch', 'yaw', 'roll'];
const actor = (patch = {}) => ({ id: 0, lifeId: 1, deaths: 0, alive: true, slot: 'primary', weapon: 'carbine', meleeWeapon: 'knife', inventoryIndex: 1,
  inventory: [{ kind: 'melee', weapon: 'knife' }, { kind: 'weapon', weapon: 'carbine', ammo: 24 }, { kind: 'heal', amount: 2 }, { kind: 'grenade', amount: 2 }],
  ammo: 24, reserve: 72, potions: 2, grenades: 2, aimTicks: 0, reloadTicks: 0, shotCooldown: 0, recoil: 0, healTicks: 0, meleeTicks: 0, parryTicks: 0, grenadeThrowTicks: 0,
  previousInput: { fire: false, aim: false }, ...patch });
const knife = patch => actor({ slot: 'sword', inventoryIndex: 0, ...patch });
const near = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a - b) <= tolerance, `${a} versus ${b}`);
const neutral = pose => { assert.equal(pose.phase, 'ready'); assert.equal(pose.active, false); assert.equal(pose.suppressActions, false); for (const axis of axes) assert.equal(pose[axis], 0); };
const freeze = value => { if (value && typeof value === 'object' && !Object.isFrozen(value)) { for (const child of Object.values(value)) freeze(child); Object.freeze(value); } return value; };

test('initial binding uses the actual equipped item with no artificial start delay', () => {
  const present = createItemEquipPresenter(), player = actor();
  const pose = present(player, 1000, 'dojo');
  neutral(pose); assert.equal(pose.player, player); assert.equal(pose.visibleKind, 'primary'); assert.equal(pose.visibleWeapon, 'carbine'); assert.equal(pose.targetWeapon, 'carbine');
});

test('the old gun is stowed before a diagonal knife pull, with its old impulses suppressed', () => {
  const present = createItemEquipPresenter(), gun = actor({ aimTicks: 18, reloadTicks: 50, shotCooldown: 12, spinTicks: 9, pendingFireTicks: 3, recoil: .12, heat: .5,
    shotIndex: 4, meleeTicks: 15, parryTicks: 12, grenadeThrowTicks: 6, burstRemaining: 2 });
  const blade = knife(); present(gun, 0, 'dojo');
  const beginning = present(blade, 10, 'dojo');
  assert.equal(beginning.phase, 'holster'); assert.equal(beginning.progress, 0); assert.equal(beginning.player.weapon, 'carbine'); assert.equal(beginning.player.slot, 'primary');
  assert.equal(beginning.targetWeapon, 'knife'); assert.equal(beginning.active, true); assert.equal(beginning.suppressActions, true); assert.ok(Object.isFrozen(beginning.player));
  for (const timer of ['reloadTicks', 'shotCooldown', 'spinTicks', 'pendingFireTicks', 'recoil', 'heat', 'shotIndex', 'meleeTicks', 'parryTicks', 'grenadeThrowTicks', 'burstRemaining']) assert.equal(beginning.player[timer], 0, timer);
  assert.equal(beginning.player.aimTicks, 18, 'an outgoing aimed grip does not snap sideways before stowing');
  const middle = present(blade, 60, 'dojo');
  assert.equal(middle.player, beginning.player); assert.equal(middle.progress, .5); assert.ok(middle.y < -.4); assert.equal(middle.visibleWeapon, 'carbine');
  const draw = present(blade, 110, 'dojo');
  assert.equal(draw.phase, 'draw'); assert.equal(draw.progress, 0); assert.equal(draw.player, blade); assert.equal(draw.visibleWeapon, 'knife'); assert.ok(draw.x > .25 && draw.y < -.9 && draw.roll < -.7);
  const pull = present(blade, 215, 'dojo');
  assert.equal(pull.progress, .5); assert.ok(pull.x > 0 && pull.x < draw.x && pull.y > draw.y && pull.y < 0 && pull.roll > draw.roll);
  neutral(present(blade, 320, 'dojo'));
});

test('every equipment family has a recognizable bounded draw and long blades clear the viewport', () => {
  const cases = [
    [knife(), 210], [knife({ meleeWeapon: 'katana' }), 240], [knife({ meleeWeapon: 'tonfas' }), 220],
    [actor({ weapon: 'classic', inventoryIndex: 2 }), 195], [actor({ weapon: 'vandal', inventoryIndex: 2 }), 230],
    [actor({ weapon: 'odin', inventoryIndex: 2 }), 260], [actor({ weapon: 'dualpistols', inventoryIndex: 2 }), 225],
    [actor({ slot: 'potion', inventoryIndex: 2 }), 180], [actor({ slot: 'grenade', inventoryIndex: 3 }), 180], [actor({ slot: 'empty', inventoryIndex: 3 }), 160],
  ];
  const draws = [];
  for (const [target, duration] of cases) {
    const present = createItemEquipPresenter(); present(actor(), 0, 'range'); present(target, 10, 'range');
    const draw = present(target, 110, 'range');
    assert.equal(draw.phase, 'draw'); assert.ok(draw.y <= -.72); assert.ok(axes.every(axis => Number.isFinite(draw[axis])));
    if (target.slot === 'sword' && target.meleeWeapon !== 'knife') assert.ok(draw.y <= -1.8, 'long and dual blades change identity below the visible field');
    assert.equal(present(target, 110 + duration - 1, 'range').phase, 'draw'); neutral(present(target, 110 + duration, 'range'));
    draws.push(axes.map(axis => draw[axis]).join(','));
  }
  assert.equal(new Set(draws).size, cases.length, 'family offsets are distinct rather than one generic drop');
});

test('rapid holster taps replace only the target and retargeting a draw preserves its current pose', () => {
  const present = createItemEquipPresenter(), reference = createItemEquipPresenter(), gun = actor(), blade = knife(), heavy = actor({ weapon: 'odin', inventoryIndex: 2 }), grenade = actor({ slot: 'grenade', inventoryIndex: 3 });
  present(gun, 0, 'range'); reference(gun, 0, 'range');
  const old = present(blade, 10, 'range'); reference(heavy, 10, 'range');
  for (const time of [45, 80, 109]) {
    const pose = present(heavy, time, 'range');
    assert.equal(pose.phase, 'holster'); assert.equal(pose.player, old.player); assert.equal(pose.visibleWeapon, 'carbine'); assert.equal(pose.targetWeapon, 'odin');
  }
  assert.equal(present(heavy, 110, 'range').visibleWeapon, 'odin'); reference(heavy, 110, 'range');
  present(heavy, 131, 'range'); reference(heavy, 131, 'range');
  const uninterrupted = reference(heavy, 160, 'range'), retarget = present(grenade, 160, 'range');
  assert.equal(retarget.phase, 'holster'); assert.equal(retarget.visibleWeapon, 'odin'); assert.equal(retarget.targetKind, 'grenade'); assert.equal(retarget.targetWeapon, null);
  for (const axis of axes) near(retarget[axis], uninterrupted[axis]);
  assert.ok(Object.isFrozen(retarget.player)); assert.equal(present(grenade, 210, 'range').visibleWeapon, 'odin');
  const incoming = present(grenade, 260, 'range'); assert.equal(incoming.phase, 'draw'); assert.equal(incoming.visibleKind, 'grenade'); assert.equal(incoming.player, grenade);
  neutral(present(grenade, 440, 'range'));
});

test('a real action immediately displays the actual selected item in every phase and family', () => {
  const choices = [knife(), knife({ meleeWeapon: 'katana' }), actor({ weapon: 'vandal', inventoryIndex: 2 }), actor({ slot: 'potion', inventoryIndex: 2, healTicks: 12 }), actor({ slot: 'grenade', inventoryIndex: 3, grenadeThrowTicks: 20 })];
  for (const chosen of choices) for (const actionAt of [40, 140]) {
    const present = createItemEquipPresenter(); present(actor(), 0, 'combat'); present(chosen, 10, 'combat');
    present(chosen, actionAt - 1, 'combat');
    const pose = present(chosen, actionAt, 'combat', { actionActive: true });
    neutral(pose); assert.equal(pose.player, chosen); assert.equal(pose.visibleKind, chosen.healTicks ? 'potion' : chosen.slot);
    neutral(present(chosen, actionAt + 1, 'combat'));
  }
});

test('solo pause freezes the entire output and resume advances only subsequent elapsed time', () => {
  const present = createItemEquipPresenter(), blade = knife(); present(actor(), 0, 'solo'); present(blade, 10, 'solo');
  const moving = present(blade, 60, 'solo');
  assert.equal(present(blade, 80, 'solo', { paused: true }), moving);
  assert.equal(present(actor({ slot: 'grenade', inventoryIndex: 3 }), 5000, 'solo', { paused: true, actionActive: true }), moving, 'menu inputs cannot rewrite a paused visible item');
  const resumed = present(blade, 5050, 'solo');
  assert.equal(resumed.phase, moving.phase); assert.equal(resumed.progress, moving.progress); for (const axis of axes) assert.equal(resumed[axis], moving[axis]);
  assert.equal(present(blade, 5100, 'solo').phase, 'draw');
});

test('actor life, scene, clock and teardown transitions discard stale equipment histories', () => {
  const cases = [
    [knife({ id: 1 }), 45, 'range', {}], [knife({ lifeId: 2 }), 45, 'range', {}], [knife({ deaths: 1 }), 45, 'range', {}],
    [knife(), 45, 'next-map-round', {}], [knife(), -1, 'range', {}], [knife(), 1100, 'range', {}], [knife({ alive: false }), 45, 'range', {}],
    [knife(), 45, 'range', { reducedMotion: true }],
  ];
  for (const [next, time, context, options] of cases) {
    const present = createItemEquipPresenter(); present(actor(), 0, 'range'); present(knife(), 10, 'range'); assert.equal(present(knife(), 25, 'range').phase, 'holster');
    const pose = present(next, time, context, options); neutral(pose); assert.equal(pose.player, next);
  }
  const present = createItemEquipPresenter(); present(actor(), 0, 'range'); present(knife(), 10, 'range'); present.reset(); neutral(present(knife(), 20, 'range'));
  neutral(present(null, 21, 'range')); neutral(present(knife(), NaN, 'range')); neutral(present(actor(), 22, 'range'));
});

test('the same elapsed draw is identical at 30, 60, 120, 144 and 240 Hz', () => {
  let reference;
  for (const hz of [30, 60, 120, 144, 240]) {
    const present = createItemEquipPresenter(), gun = freeze(actor()), blade = freeze(knife()); present(gun, 0, 'range'); present(blade, 10, 'range');
    for (let time = 10 + 1000 / hz; time < 200 - 1e-8; time += 1000 / hz) present(blade, time, 'range');
    const pose = present(blade, 200, 'range'); assert.equal(pose.phase, 'draw'); near(pose.progress, 90 / 210);
    if (reference) for (const key of [...axes, 'progress']) near(pose[key], reference[key]); else reference = pose;
    neutral(present(blade, 320, 'range'));
  }
});

test('ammo, stack counts and unselected weapon fields cannot restart a draw but slot or model changes can', () => {
  for (const initial of [actor(), knife(), actor({ slot: 'potion', inventoryIndex: 2 }), actor({ slot: 'grenade', inventoryIndex: 3 })]) {
    const present = createItemEquipPresenter(); present(initial, 0, 'range');
    const changed = { ...initial, ammo: 2, reserve: 50, potions: 1, grenades: 1, inventory: initial.inventory.map(item => item ? { ...item, amount: 1 } : null),
      ...(initial.slot === 'sword' ? { weapon: 'odin' } : initial.slot === 'primary' ? { meleeWeapon: 'katana' } : { weapon: 'odin', meleeWeapon: 'katana' }) };
    neutral(present(changed, 20, 'range'));
    const shifted = { ...changed, inventoryIndex: (changed.inventoryIndex + 1) % 4 };
    assert.equal(present(shifted, 30, 'range').phase, 'holster');
  }
  for (const [initial, changed] of [[actor(), actor({ weapon: 'vandal' })], [knife(), knife({ meleeWeapon: 'katana' })]]) {
    const present = createItemEquipPresenter(); present(initial, 0, 'range'); assert.equal(present(changed, 20, 'range').phase, 'holster');
  }
});

test('the displayed healing potion has a stable identity and is stowed before the gun returns', () => {
  const present = createItemEquipPresenter(), gun = actor(), healing = actor({ healTicks: 24, healing: true });
  present(gun, 0, 'range');
  const start = present(healing, 10, 'range'); assert.equal(start.targetKind, 'potion'); assert.equal(start.targetWeapon, null); assert.equal(start.visibleWeapon, 'carbine');
  assert.equal(present(healing, 110, 'range').visibleKind, 'potion');
  const ongoing = present({ ...healing, healTicks: 8, potions: 1 }, 160, 'range'); assert.equal(ongoing.phase, 'draw'); near(ongoing.progress, 50 / 180);
  neutral(present({ ...healing, healTicks: 1 }, 290, 'range'));
  const returnToGun = present(gun, 300, 'range'); assert.equal(returnToGun.phase, 'holster'); assert.equal(returnToGun.visibleKind, 'potion'); assert.equal(returnToGun.player.slot, 'potion'); assert.equal(returnToGun.player.healTicks, 0); assert.equal(returnToGun.targetWeapon, 'carbine');
});

test('reduced motion keeps a fast vertical lower and raise, including full long-blade clearance', () => {
  for (const target of [knife(), knife({ meleeWeapon: 'katana' }), actor({ weapon: 'odin', inventoryIndex: 2 }), actor({ slot: 'potion', inventoryIndex: 2 })]) {
    const present = createItemEquipPresenter(), options = { reducedMotion: true }; present(actor(), 0, 'range', options); present(target, 10, 'range', options);
    const holster = present(target, 30, 'range', options); assert.equal(holster.phase, 'holster'); assert.equal(holster.progress, .5);
    const draw = present(target, 50, 'range', options); assert.equal(draw.phase, 'draw'); assert.equal(draw.progress, 0);
    for (const pose of [holster, draw, present(target, 90, 'range', options)]) for (const axis of ['x', 'z', 'pitch', 'yaw', 'roll']) assert.equal(pose[axis], 0);
    if (target.meleeWeapon === 'katana' && target.slot === 'sword') assert.ok(draw.y <= -1.8);
    neutral(present(target, 130, 'range', options));
  }
});

test('render-only histories never mutate the player, inventory, input or combat timing', () => {
  const present = createItemEquipPresenter(), gun = freeze(actor({ reloadTicks: 100, shotCooldown: 9, recoil: .07 })), blade = freeze(knife()), gunBefore = structuredClone(gun), bladeBefore = structuredClone(blade);
  present(gun, 0, 'range'); const outgoing = present(blade, 10, 'range');
  assert.notEqual(outgoing.player, gun); assert.equal(outgoing.player.inventory, gun.inventory, 'only one shallow visual snapshot is needed');
  for (let time = 20; time <= 330; time += 10) present(blade, time, 'range');
  assert.deepEqual(gun, gunBefore); assert.deepEqual(blade, bladeBefore);
  const action = present(gun, 340, 'range', { actionActive: true }); assert.equal(action.player, gun); assert.equal(action.player.reloadTicks, 100); assert.equal(action.player.recoil, .07);
});
