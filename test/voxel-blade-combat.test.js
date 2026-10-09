import assert from 'node:assert/strict';
import test from 'node:test';
import { applyCombatDamage, cloneState, combatStep, createCombatPlayer, emptyInput, predictLocalMovement } from '../public/voxel-engine.js';
import { KNIFE, KNIFE_SECONDARY, MELEE_WEAPONS, clearMeleeBuffer, meleeSlashGeometry } from '../public/voxel-melee.js';
import { createInventoryMelee, refreshInventory, setInventoryMeleeLoadout } from '../public/voxel-inventory.js';

const arena = { id: 'blade-combat-fixture', bounds: { minX: -30, maxX: 30, minZ: -30, maxZ: 30 }, colliders: [], sites: [] };
const total = weapon => MELEE_WEAPONS[weapon].startupTicks + MELEE_WEAPONS[weapon].activeTicks + MELEE_WEAPONS[weapon].recoveryTicks;
function actor(id, fields = {}) { return Object.assign(createCombatPlayer(id), { lifeId: 1, x: id ? 20 : 0, y: 0, z: 0, ...fields }); }
function fixture(weapon = 'sword', targets = [actor(1, { z: -1.3, x: 0 })], map = arena, gameId = 'voxel-breach') {
  const player = actor(0, { human: true }), players = [player];
  setInventoryMeleeLoadout(player, weapon, { equip: true });
  for (const enemy of targets) players[enemy.id] = enemy;
  for (let id = 0; id < players.length; id++) players[id] ||= actor(id, { alive: false });
  return { player, targets, state: { gameId, phase: 'fight', tick: 0, eventId: 0, events: [], players, fighters: players, map, grenades: [], bolts: [], loot: [] } };
}
function step(state, commands = {}, ticks = 1) {
  for (let index = 0; index < ticks; index++) { state.tick++; combatStep(state, state.players.map(player => ({ ...emptyInput(player), ...(typeof commands === 'function' ? commands(player, index) : commands[player.id]) })), state.map); }
}
function attack(state, weapon) { step(state, { 0: { fire: true } }); step(state, {}, total(weapon)); }
function queueLate(setup, remaining = 8) {
  step(setup.state, { 0: { fire: true } }); step(setup.state, {}, total(setup.player.meleeWeapon) - remaining);
  step(setup.state, { 0: { fire: true } }); assert.ok(setup.player.pendingMeleeTicks > 0); return setup;
}

for (const [weapon, cuts] of [['sword', 2], ['katana', 3], ['axe', 2], ['tonfas', 5]]) test(`${weapon} is a useful close threat against a real 200 HP player in ${cuts} clean cuts`, () => {
  const { state, player, targets: [enemy] } = fixture(weapon);
  for (let cut = 1; cut <= cuts; cut++) {
    attack(state, weapon); assert.equal(player.meleeIndex, cut);
    assert.equal(enemy.alive, cut < cuts, `cut ${cut}`);
  }
  assert.equal(enemy.hp, 0); assert.equal(player.kills, 1); assert.equal(player.damageDealt, 200);
  assert.equal(player.ammo, 24); assert.equal(player.shots, 0);
  assert.equal(state.events.filter(event => event.type === 'damage').length, cuts);
  assert.equal(state.events.filter(event => event.type === 'kill').length, 1);
});

test('sword and katana reach enemies beyond the old short slash without contacting flesh outside their real lengths', () => {
  for (const [weapon, reachable, outside] of [['sword', 2.55, 2.85], ['katana', 2.8, 3.1]]) {
    const close = fixture(weapon, [actor(1, { x: 0, z: -reachable })]); attack(close.state, weapon); assert.ok(close.targets[0].hp < 200, `${weapon}: legitimate longer cut`);
    const far = fixture(weapon, [actor(1, { x: 0, z: -outside })]); attack(far.state, weapon); assert.equal(far.targets[0].hp, 200, `${weapon}: range is physical`);
  }
});

test('fresh early clicks bridge the last recovery window exactly once even after release, while holding never chains', () => {
  for (const weapon of ['knife', 'sword', 'katana', 'axe', 'tonfas']) {
    const setup = queueLate(fixture(weapon, [actor(1, { x: 20, z: -20 })]));
    step(setup.state, {}, 7); assert.equal(setup.player.meleeIndex, 2, weapon); assert.equal(setup.player.pendingMeleeTicks, 0);
    const second = setup.state.events.filter(event => event.type === 'meleeStart').at(-1);
    assert.equal(second.tick, 1 + total(weapon), 'the queued cut starts as recovery ends');
    step(setup.state, { 0: { fire: true } }, total(weapon) * 4); assert.equal(setup.player.meleeIndex, 2, 'no automatic repeat');
    const held = fixture(weapon); step(held.state, { 0: { fire: true } }, total(weapon) * 4); assert.equal(held.player.meleeIndex, 1);
  }
});

test('fresh LMB keeps precedence over held or simultaneous RMB at idle without starting both actions', () => {
  for (const held of [false, true]) {
    const setup = fixture('katana');
    if (held) { step(setup.state, { 0: { aim: true } }, 100); assert.equal(setup.player.parryIndex, 1); }
    step(setup.state, { 0: { fire: true, aim: true } }); assert.equal(setup.player.meleeIndex, 1); assert.equal(setup.player.parryIndex, held ? 1 : 0);
    step(setup.state, { 0: { fire: true, aim: true } }, 100); assert.equal(setup.targets[0].hp, 125); assert.equal(setup.player.meleeIndex, 1);
    assert.equal(setup.player.pendingMeleeTicks, 0);
  }
});

test('RMB cancels a pending cut and an active guard still blocks fresh LMB', () => {
  const queued = queueLate(fixture('sword')); step(queued.state, { 0: { aim: true } }); assert.equal(queued.player.pendingMeleeTicks, 0);
  step(queued.state, { 0: { aim: true } }, 100); assert.equal(queued.player.meleeIndex, 1);
  const guard = fixture('sword'); step(guard.state, { 0: { aim: true } }); step(guard.state, { 0: { fire: true, aim: true } });
  assert.equal(guard.player.meleeIndex, 0); assert.ok(guard.player.parryTicks > 0); assert.equal(guard.player.pendingMeleeTicks, 0);
});

test('movement prediction shares fresh LMB and held RMB precedence without publishing a strike or spending guard stamina', () => {
  const setup = fixture('katana', [actor(1, { x: 20, z: -20 })]); step(setup.state, { 0: { aim: true } }, 100);
  const predicted = cloneState(setup.player), unchanged = [predicted.meleeIndex, predicted.parryIndex, predicted.stamina];
  for (let tick = 0; tick < 90; tick++) {
    const command = { ...emptyInput(setup.player), up: true, sprint: true, aim: true, fire: tick < 25 };
    predictLocalMovement(predicted, command, arena); step(setup.state, { 0: command });
    for (const field of ['z', 'vz', 'stamina']) assert.ok(Math.abs(predicted[field] - setup.player[field]) < 1e-8, `${field}: ${tick}`);
    assert.equal(predicted.sprinting, setup.player.sprinting);
  }
  assert.deepEqual([predicted.meleeIndex, predicted.parryIndex], unchanged.slice(0, 2)); assert.equal(setup.player.meleeIndex, 1); assert.equal(setup.player.parryIndex, 1);
});

test('startup and early recovery presses are discarded rather than banked for later attacks', () => {
  for (const elapsed of [2, 28]) {
    const setup = fixture('sword'); step(setup.state, { 0: { fire: true } }); step(setup.state, {}, elapsed);
    step(setup.state, { 0: { fire: true } }); assert.equal(setup.player.pendingMeleeTicks, 0);
    step(setup.state, {}, 120); assert.equal(setup.player.meleeIndex, 1);
  }
  const stab = fixture('knife'); step(stab.state, { 0: { aim: true } }); step(stab.state, {}, 72);
  step(stab.state, { 0: { fire: true } }); assert.equal(stab.player.pendingMeleeTicks, 0); step(stab.state, {}, 100); assert.equal(stab.player.meleeIndex, 1, 'heavy stab recovery cannot queue a primary');
});

for (const action of ['aim', 'interact', 'reload', 'heal', 'grenade', 'swap', 'drop', 'slot1', 'slot2', 'slot3', 'slot4']) test(`${action} cancels queued intent without later releasing a latent cut`, () => {
  const setup = queueLate(fixture('sword', [actor(1, { x: 20, z: -20 })]));
  step(setup.state, { 0: { [action]: true } }); assert.equal(setup.player.pendingMeleeTicks, 0);
  step(setup.state, {}, 120); assert.equal(setup.state.events.filter(event => event.type === 'meleeStart').length, 1);
});

test('queued attacks belong to the active item and are never transferred to another identical carried sword', () => {
  const setup = fixture('sword', [actor(1, { x: 20, z: -20 })]); setup.player.inventory[2] = createInventoryMelee('sword'); refreshInventory(setup.player); queueLate(setup);
  const oldItem = setup.player.inventory[0]; assert.equal(Object.hasOwn(oldItem, 'pendingMeleeTicks'), false);
  step(setup.state, { 0: { slot3: true } }); assert.equal(setup.player.inventoryIndex, 2); assert.equal(setup.player.pendingMeleeTicks, 0); assert.ok(oldItem.meleeCooldown > 0);
  step(setup.state, {}, 100); assert.equal(setup.state.events.filter(event => event.type === 'meleeStart').length, 1);
});

test('death, physical loot replacement and explicit pause clearing discard the queue while genuine item recovery survives', () => {
  for (const reason of ['death', 'replacement', 'pause']) {
    const setup = queueLate(fixture('katana'));
    const cooldown = setup.player.meleeCooldown;
    if (reason === 'death') { applyCombatDamage(setup.state, [{ playerId: 1, targetId: 0, damage: 200, attack: 'gun', weapon: 'carbine' }]); assert.equal(setup.player.alive, false); }
    else if (reason === 'replacement') setInventoryMeleeLoadout(setup.player, 'axe', { equip: true });
    else { clearMeleeBuffer(setup.player); assert.equal(setup.player.meleeCooldown, cooldown); }
    assert.equal(setup.player.pendingMeleeTicks, 0, reason); step(setup.state, {}, 120); assert.equal(setup.state.events.filter(event => event.type === 'meleeStart').length, 1);
  }
});

test('serializing a late queued press cannot duplicate or extend its one accepted followup', () => {
  const first = queueLate(fixture('sword', [actor(1, { x: 20, z: -20 })])).state, second = cloneState(first);
  step(first, {}, 200); step(second, {}, 200); assert.deepEqual(first, second);
  assert.equal(first.players[0].meleeIndex, 2); assert.equal(first.players[0].pendingMeleeTicks, 0);
});

test('movement-only prediction follows the queued action clock without publishing attacks, inventory or damage', () => {
  const setup = fixture('sword', [actor(1, { x: 20, z: -20 })]); step(setup.state, { 0: { fire: true } });
  const predicted = cloneState(setup.player), frozen = [predicted.hp, predicted.meleeTicks, predicted.meleeIndex, predicted.pendingMeleeTicks, structuredClone(predicted.inventory)];
  for (let tick = 1; tick <= 150; tick++) {
    const command = { ...emptyInput(setup.player), up: true, sprint: true, fire: tick === total('sword') - 8 };
    predictLocalMovement(predicted, command, arena); step(setup.state, { 0: command });
    for (const field of ['x', 'z', 'vx', 'vz', 'stamina', 'staminaRegenTicks']) assert.ok(Math.abs(predicted[field] - setup.player[field]) < 1e-8, `${field}: ${tick}`);
    assert.equal(predicted.sprinting, setup.player.sprinting, `sprint: ${tick}`);
  }
  assert.deepEqual([predicted.hp, predicted.meleeTicks, predicted.meleeIndex, predicted.pendingMeleeTicks, predicted.inventory], frozen);
  assert.equal(setup.player.meleeIndex, 2);
});

const aimVector = (yaw, pitch) => [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
const angle = (a, b) => Math.acos(Math.max(-1, Math.min(1, a.reduce((sum, value, index) => sum + value * b[index], 0))));
test('a sword or katana windup can follow a small aim correction in 3D but stays within twelve degrees and locks every active slice', () => {
  for (const weapon of ['sword', 'katana']) {
    const setup = fixture(weapon, [actor(1, { x: 20, z: -20 })]); step(setup.state, { 0: { fire: true, yaw: 3.1, pitch: .4 } });
    const original = aimVector(3.1, .4); let previous = original;
    for (let tick = 0; tick < MELEE_WEAPONS[weapon].startupTicks; tick++) {
      step(setup.state, { 0: { yaw: -2.8, pitch: .75 } }); const current = aimVector(setup.player.meleeYaw, setup.player.meleePitch);
      assert.ok(angle(original, current) <= Math.PI / 15 + 1e-8); assert.ok(angle(previous, current) <= Math.PI / 120 + 1e-8); previous = current;
    }
    assert.ok(angle(original, previous) > .1, 'the small input correction has physical effect');
    const committed = [setup.player.meleeYaw, setup.player.meleePitch]; step(setup.state, { 0: { yaw: 0, pitch: -1 } }, MELEE_WEAPONS[weapon].activeTicks);
    assert.deepEqual([setup.player.meleeYaw, setup.player.meleePitch], committed);
  }
  for (const weapon of ['knife', 'axe', 'tonfas']) {
    const setup = fixture(weapon); step(setup.state, { 0: { fire: true } }); step(setup.state, { 0: { yaw: .2, pitch: -.2 } }, MELEE_WEAPONS[weapon].startupTicks);
    assert.deepEqual([setup.player.meleeYaw, setup.player.meleePitch], [0, 0]);
  }
});

test('curved blade cuts still deal damage only as each real part of the narrow band reaches a target', () => {
  const left = actor(1, { x: -.9, z: -1.85, monster: true, human: false, monsterType: 'stalker' }), right = actor(2, { x: .9, z: -1.85, team: 1, monster: true, human: false, monsterType: 'stalker' });
  const setup = fixture('sword', [left, right], arena, 'voxel-horde'); step(setup.state, { 0: { fire: true } }); step(setup.state, {}, MELEE_WEAPONS.sword.startupTicks);
  assert.equal(left.hp, 100); assert.equal(right.hp, 200, 'the unswept right side has no instantaneous cone damage');
  step(setup.state, {}, MELEE_WEAPONS.sword.activeTicks); assert.equal(right.hp, 100); assert.equal(setup.state.events.filter(event => event.type === 'damage').length, 2);
});

test('a curved multi-monster sweep still respects cover, per-life dedupe and vertical separation', () => {
  for (const covered of [false, true]) {
    const near = actor(1, { x: 0, z: -1.1, monster: true, human: false, monsterType: 'stalker' }), far = actor(2, { x: 0, z: -2, team: 1, monster: true, human: false, monsterType: 'stalker' });
    const map = covered ? { ...arena, colliders: [{ id: 'full-barrier', x: -4, y: 0, z: -1.6, w: 8, h: 3, d: .06 }] } : arena;
    const setup = fixture('katana', [near, far], map, 'voxel-horde'); attack(setup.state, 'katana'); assert.equal(near.hp, 125); assert.equal(far.hp, covered ? 200 : 125);
    assert.equal(setup.state.events.filter(event => event.type === 'damage').length, covered ? 1 : 2);
  }
  const elevated = fixture('sword', [actor(1, { x: 0, z: -1.2, y: 3, monster: true, human: false, monsterType: 'stalker' })], arena, 'voxel-horde'); attack(elevated.state, 'sword'); assert.equal(elevated.targets[0].hp, 200);
});

test('an approaching sideways player can be cut while one who leaves real reach during windup escapes', () => {
  const crossing = fixture('katana', [actor(1, { x: -.3, z: -1.6 })]); step(crossing.state, { 0: { fire: true }, 1: { right: true } }); step(crossing.state, { 1: { right: true } }, 18); assert.equal(crossing.targets[0].hp, 125);
  const fleeing = fixture('sword', [actor(1, { x: 0, z: -2.6 })]); step(fleeing.state, { 0: { fire: true }, 1: { up: true } }); step(fleeing.state, { 1: { up: true } }, 24); assert.equal(fleeing.targets[0].hp, 200, 'no range extension or target snapping');
});

test('waist-crossing blades contact actual close low hounds while knives still require downward aim', () => {
  for (const weapon of ['sword', 'katana', 'axe']) for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const setup = fixture(weapon, [actor(1, { x: 0, z: -1.1, yaw, radius: .5, monster: true, human: false, monsterType: 'hound' })], arena, 'voxel-horde'); attack(setup.state, weapon);
    const hit = setup.state.events.find(event => event.type === 'damage'); assert.ok(hit && hit.hitY <= .8, `${weapon}:${yaw} must contact real dog flesh`);
  }
  const knife = fixture('knife', [actor(1, { x: 0, z: -1.1, radius: .5, monster: true, human: false, monsterType: 'hound' })], arena, 'voxel-horde'); attack(knife.state, 'knife'); assert.equal(knife.targets[0].hp, 200);
  assert.deepEqual([KNIFE.damage, KNIFE.reach, KNIFE.startupTicks, KNIFE_SECONDARY.damage, KNIFE_SECONDARY.reach], [28, 1.3, 10, 60, 1.75]);
  for (const weapon of ['sword', 'katana', 'axe']) {
    const geometry = meleeSlashGeometry({ meleeWeapon: weapon, meleeYaw: 0, meleePitch: 0 });
    for (const sample of geometry.samples) assert.ok(Math.hypot(sample.outer.x - geometry.origin.x, sample.outer.y - geometry.origin.y, sample.outer.z - geometry.origin.z) + geometry.radius <= MELEE_WEAPONS[weapon].reach + 1e-8);
  }
});
