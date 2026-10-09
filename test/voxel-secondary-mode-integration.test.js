import assert from 'node:assert/strict';
import test from 'node:test';
import * as Combat from '../public/voxel-engine.js';
import * as Horde from '../public/voxel-horde-engine.js';
import * as Royale from '../public/voxel-royale-engine.js';
import * as Practice from '../public/voxel-practice-engine.js';
import * as Inventory from '../public/voxel-inventory.js';
import { KNIFE_SECONDARY, PARRY_PROFILES, meleeSlashOrigin, parryPhase } from '../public/voxel-melee.js';
import { monsterAttackHeight } from '../public/voxel-monster-bodies.js';

const arena = Object.freeze({ id: 'secondary-mode-arena', bounds: Object.freeze({ minX: -25, maxX: 25, minZ: -22, maxZ: 22 }), colliders: Object.freeze([]), spawns: Horde.MAPS.courtyard.spawns });
const advance = (step, state, count, input) => { for (let tick = 0; tick < count; tick++) step(state, input); };
function pose(player, x, z, yaw = 0) { Object.assign(player, { x, y: 0, z, yaw, pitch: 0, vx: 0, vy: 0, vz: 0, grounded: true }); player.previousInput = Combat.emptyInput(player); }
function collectBlade(state, player, weapon = 'katana', source) {
  const loot = Combat.addInventoryLoot(state, player, Inventory.createInventoryMelee(weapon, source));
  assert.ok(loot); assert.equal(Combat.pickupCombatLoot(state, player, loot), true);
  assert.equal(player.slot, 'sword'); return player.inventory[player.inventoryIndex];
}
function horde({ capacity = 1, type = 'stalker' } = {}) {
  const state = Horde.createState({ capacity, seed: 291 }); Horde.startMatch(state, Array.from({ length: capacity }, (_, id) => id));
  advance(Horde.step, state, state.phaseTicks); state.map = arena; state.horde.pending = 1; state.horde.nextSpawnTick = Number.MAX_SAFE_INTEGER;
  state.spawnWarnings = [{ id: 1, x: 0, y: 0, z: -8, ticksLeft: 1, monsterType: type }]; Horde.step(state);
  const monster = state.players.find(player => player.monster); assert.ok(monster); monster.emergenceTicks = 10000;
  for (let id = 0; id < capacity; id++) pose(state.players[id], id * 1.2, 0);
  pose(monster, 0, -1.3, Math.PI); return { state, player: state.players[0], monster, brain: state.horde.brains[monster.id] };
}
function practice() {
  const state = Practice.createPractice({ mode: 'targets', bots: 2, seed: 291 }); Practice.startPractice(state);
  advance(Practice.stepPractice, state, state.phaseTicks); state.map = arena; pose(state.players[0], 0, 0);
  pose(state.players[1], 20, -15); pose(state.players[2], -20, 15); return state;
}
function royale() {
  const state = Royale.createState({ capacity: 2, seed: 291 }); Royale.startMatch(state, [0, 1]);
  advance(Royale.step, state, state.phaseTicks); state.map = arena; state.loot = [];
  pose(state.players[0], 0, 0); pose(state.players[1], 20, -15); return state;
}
function readyBite(monster, brain, player) {
  monster.emergenceTicks = 0; brain.attackTicks = 1; brain.attackTargetId = player.id; brain.attackYaw = Math.PI; brain.attackPitch = 0;
  brain.nextPlanTick = brain.nextSightTick = Number.MAX_SAFE_INTEGER; brain.path = [];
}

test('each physical blade preserves independent guard recovery through switching, holstering, dropping and collecting', () => {
  const player = Combat.createCombatPlayer(0);
  const katana = Inventory.createInventoryMelee('katana', { parryCooldown: 30 }), axe = Inventory.createInventoryMelee('axe', { parryCooldown: 50 });
  assert.equal(Inventory.pickupInventoryItem(player, { kind: 'melee', weapon: 'katana', item: katana }).ok, true);
  assert.equal(Inventory.pickupInventoryItem(player, { kind: 'melee', weapon: 'axe', item: axe }).ok, true);
  assert.equal(player.parryCooldown, 50);
  Object.assign(player, { parryTicks: 12, parryYaw: .4, parryPitch: -.2, parryStartTick: 10, meleeSecondaryCooldown: 61 }); player.previousInput.aim = true;
  assert.equal(Inventory.selectInventorySlot(player, 2), true);
  assert.equal(player.parryTicks, 0); assert.equal(player.parryCooldown, 30); assert.equal(player.meleeSecondaryCooldown, 61); assert.equal(player.meleeAimBlocked, true);
  Inventory.tickHolsteredInventory(player); Inventory.storeInventoryGun(player);
  assert.deepEqual(player.inventory.slice(2).map(item => item.parryCooldown), [29, 49]);
  const dropped = Inventory.dropInventoryItem(player, 2); assert.equal(dropped.parryCooldown, 29);
  assert.equal(player.inventory[3].parryCooldown, 49);
  assert.equal(Inventory.pickupInventoryItem(player, { kind: 'melee', weapon: dropped.weapon, item: dropped }).ok, true);
  assert.equal(player.parryCooldown, 29); assert.equal(player.meleeSecondaryCooldown, 61);
  assert.equal(player.inventory[2].parryTicks, undefined, 'an item must not carry a live guard');
});

test('the knife secondary uses a single fresh RMB commitment in Horde, Breach practice and Royale', () => {
  const cases = [
    { name: 'Horde', state: horde().state, step: (state, input) => Horde.step(state, [input]) },
    { name: 'practice', state: practice(), step: Practice.stepPractice },
    { name: 'Royale', state: royale(), step: (state, input) => Royale.step(state, [input]) },
  ];
  for (const { name, state, step } of cases) {
    const player = state.players[0], total = KNIFE_SECONDARY.startupTicks + KNIFE_SECONDARY.activeTicks + KNIFE_SECONDARY.recoveryTicks;
    step(state, { slot1: true }); step(state, {}); step(state, { aim: true });
    assert.equal(player.meleeAction, 'secondary', name); assert.equal(player.meleeTicks, total, name); assert.equal(player.meleeCooldown, total, name);
    assert.equal(player.parryTicks, 0, name); assert.equal(player.stamina, 100, name); const index = player.meleeIndex;
    advance(step, state, total + 20, { aim: true }); assert.equal(player.meleeIndex, index, `${name}: holding RMB retriggered a stab`);
    step(state, {}); step(state, { aim: true }); assert.equal(player.meleeIndex, index + 1, name);
    assert.equal(player.potions + player.grenades, 0, name);
  }
});

test('Horde pause freezes an accepted guard and cooldown, and resume requires a real RMB release before another guard', () => {
  const { state, player } = horde(); collectBlade(state, player); Horde.step(state, [{}]); Horde.step(state, [{ aim: true }]);
  assert.ok(player.parryTicks > 0); assert.equal(player.stamina, 100 - PARRY_PROFILES.katana.staminaCost);
  Horde.pauseMatch(state); const frozen = JSON.stringify(state); advance(Horde.step, state, 90, [{ aim: true }]); assert.equal(JSON.stringify(state), frozen);
  const index = player.parryIndex; Horde.resumeMatch(state); advance(Horde.step, state, PARRY_PROFILES.katana.cooldownTicks + 10, [{ aim: true }]);
  assert.equal(player.parryTicks, 0); assert.equal(player.parryIndex, index); assert.equal(player.inventory[player.inventoryIndex].parryCooldown, 0);
  Horde.step(state, [{}]); Horde.step(state, [{ aim: true }]); assert.equal(player.parryIndex, index + 1);
});

test('the real knife thrust retains Horde damage scaling and armored-body impulse and stagger limits', () => {
  const { state, player, monster, brain } = horde({ type: 'brute' }); monster.emergenceTicks = 0;
  brain.attackTicks = Horde.MONSTER_TYPES.brute.windup; brain.attackTargetId = player.id; brain.attackYaw = Math.PI; brain.attackPitch = 0;
  brain.nextPlanTick = brain.nextSightTick = Number.MAX_SAFE_INTEGER; brain.path = [];
  Horde.step(state, [{ slot1: true }]); Horde.step(state, [{}]); Horde.step(state, [{ aim: true }]);
  advance(Horde.step, state, KNIFE_SECONDARY.startupTicks, [{}]);
  const damage = state.events.findLast(event => event.type === 'damage' && event.targetId === monster.id);
  assert.ok(damage); assert.equal(damage.meleeAction, 'secondary'); assert.equal(damage.damage, Math.round(KNIFE_SECONDARY.damage * Horde.HORDE_MELEE_RULES.damageScales[0]));
  const push = state.events.findLast(event => event.type === 'meleeKnockback' && event.targetId === monster.id), stagger = state.events.findLast(event => event.type === 'monsterStagger' && event.targetId === monster.id);
  assert.ok(push); assert.equal(push.speed, KNIFE_SECONDARY.pushSpeed * .35); assert.equal(monster.knockbackTicks, Combat.KNOCKBACK.monsterTicks);
  assert.ok(stagger); assert.equal(stagger.ticks, Math.max(6, Math.round(Horde.HORDE_MELEE_RULES.staggerTicks.knife * .45)));
  assert.equal(player.shots, 0); assert.equal(player.hp, player.maxHp); assert.ok(monster.alive);
});

test('a low hound bite meets the committed three-dimensional guard and consumes its normal attack once', () => {
  const control = horde({ type: 'hound' }); pose(control.monster, 0, -1.1, Math.PI); readyBite(control.monster, control.brain, control.player);
  Horde.step(control.state); assert.ok(control.player.hp < control.player.maxHp, 'the same real low bite must land without a guard');
  const bite = control.state.events.findLast(event => event.type === 'damage' && event.targetId === control.player.id);
  assert.equal(bite.attackY, monsterAttackHeight(control.monster)); assert.ok(bite.hitY < 1);
  const { state, player, monster, brain } = horde({ type: 'hound' }); pose(monster, 0, -1.1, Math.PI); collectBlade(state, player);
  const origin = { x: monster.x, y: monster.y + monsterAttackHeight(monster), z: monster.z }, pivot = meleeSlashOrigin(player);
  const aim = { aim: true, yaw: 0, pitch: Math.atan2(origin.y - pivot.y, Math.hypot(origin.x - pivot.x, origin.z - pivot.z)) };
  Horde.step(state, [{}]); Horde.step(state, [aim]); advance(Horde.step, state, PARRY_PROFILES.katana.startupTicks, [aim]);
  assert.equal(parryPhase(player).phase, 'active');
  readyBite(monster, brain, player);
  const hp = player.hp; Horde.step(state, [aim]);
  assert.equal(player.hp, hp); assert.equal(player.parryConsumed, true); assert.equal(brain.attackReady, false); assert.equal(brain.lungeDamageReady, false);
  assert.equal(brain.recoverTicks, Horde.MONSTER_TYPES.hound.recovery); assert.equal(brain.staggerTicks, 0); assert.equal(monster.knockbackTicks, 0);
  assert.equal(monster.parryIndex, 0); assert.equal(monster.parryTicks, 0); assert.ok(monster.inventory.every(item => item === null));
  assert.equal(state.events.filter(event => event.type === 'damage' && event.targetId === player.id).length, 0);
});

test('Horde intermission cancels transient defense, suppresses RMB and still permits a physical potion pickup', () => {
  const { state, player, monster } = horde(); collectBlade(state, player); Horde.step(state, [{}]); Horde.step(state, [{ aim: true }]);
  const index = player.parryIndex; state.horde.pending = 0;
  Combat.applyCombatDamage(state, [{ playerId: 0, targetId: monster.id, damage: monster.hp, attack: 'gun', weapon: 'carbine' }]); Horde.step(state, [{ aim: true }]);
  assert.equal(state.phase, 'intermission'); assert.equal(player.parryTicks, 0); assert.ok(player.meleeSecondaryCooldown > 0); assert.ok(player.inventory[player.inventoryIndex].parryCooldown > 0);
  state.loot = []; const potion = Combat.addInventoryLoot(state, player, { kind: 'heal', amount: 1 });
  Horde.step(state, [{ aim: true, interact: true }]); assert.equal(player.potions, 1); assert.equal(state.loot.some(item => item.id === potion.id), false);
  advance(Horde.step, state, PARRY_PROFILES.katana.cooldownTicks + 10, [{ aim: true }]);
  assert.equal(player.parryTicks, 0); assert.equal(player.meleeTicks, 0); assert.equal(player.parryIndex, index);
  state.phaseTicks = 1; Horde.step(state, [{ aim: true }]); assert.equal(state.phase, 'fight');
  advance(Horde.step, state, 10, [{ aim: true }]); assert.equal(player.parryIndex, index);
  Horde.step(state, [{}]); Horde.step(state, [{ aim: true }]); assert.equal(player.parryIndex, index + 1);
});

test('a genuine co-op death and revive clear live defense while retaining the carried blade recovery and held-input fence', () => {
  const { state, monster } = horde({ capacity: 2 }), survivor = state.players[0], victim = state.players[1]; collectBlade(state, victim);
  Horde.step(state, [{}, {}]); Horde.step(state, [{}, { aim: true }]); const cooldown = victim.inventory[victim.inventoryIndex].parryCooldown;
  Combat.applyCombatDamage(state, [{ playerId: monster.id, targetId: victim.id, damage: victim.hp, attack: 'gun', weapon: 'carbine' }]);
  assert.equal(victim.alive, false); assert.equal(victim.parryTicks, 0);
  advance(Horde.step, state, Horde.HORDE_RULES.reviveTicks, [{ interact: true }, { aim: true }]);
  const revived = state.players[1]; assert.equal(revived.alive, true); assert.equal(revived.hp, Horde.HORDE_RULES.reviveHealth); assert.equal(revived.parryTicks, 0);
  assert.equal(revived.inventory[revived.inventoryIndex].weapon, 'katana'); assert.equal(revived.inventory[revived.inventoryIndex].parryCooldown, cooldown);
  assert.equal(revived.potions + revived.grenades, 0); assert.ok(revived.lifeId > victim.lifeId); assert.equal(survivor.hp, survivor.maxHp);
  advance(Horde.step, state, cooldown + 10, [{}, { aim: true }]); assert.equal(revived.parryIndex, 0);
  Horde.step(state, [{}, {}]); Horde.step(state, [{}, { aim: true }]); assert.equal(revived.parryIndex, 1);
});

test('practice resume fences a held RMB and terminal cleanup cancels defense without refunding recovery', () => {
  const state = practice(), player = state.players[0]; collectBlade(state, player); Practice.stepPractice(state, {}); Practice.stepPractice(state, { aim: true });
  const index = player.parryIndex; Practice.pausePractice(state); const ticks = player.parryTicks, cooldown = player.parryCooldown;
  advance(Practice.stepPractice, state, 20, { aim: true }); assert.equal(player.parryTicks, ticks); assert.equal(player.parryCooldown, cooldown);
  Practice.resumePractice(state); advance(Practice.stepPractice, state, PARRY_PROFILES.katana.cooldownTicks + 10, { aim: true }); assert.equal(player.parryIndex, index);
  Practice.stepPractice(state, {}); Practice.stepPractice(state, { aim: true }); assert.equal(player.parryIndex, index + 1);
  state.roundTicks = 1; Practice.stepPractice(state, {});
  assert.equal(state.phase, 'matchEnd'); assert.equal(player.parryTicks, 0); assert.equal(player.meleeAction, 'primary'); assert.ok(player.meleeSecondaryCooldown > 0);
  assert.ok(player.inventory[player.inventoryIndex].parryCooldown > 0); assert.equal(player.meleeAimBlocked, true);
});

test('Royale winner cleanup cancels a live guard but preserves physical recovery and fresh rematches remain knife-only', () => {
  const state = royale(), player = state.players[0]; collectBlade(state, player); Royale.step(state, [{}]); Royale.step(state, [{ aim: true }]);
  const cooldown = player.parryCooldown; assert.ok(player.parryTicks > 0); Royale.eliminateParticipant(state, 1);
  assert.equal(state.phase, 'matchEnd'); assert.equal(player.parryTicks, 0); assert.equal(player.meleeAction, 'primary'); assert.equal(player.parryCooldown, cooldown); assert.equal(player.meleeSecondaryCooldown, cooldown);
  state.map = Royale.MAPS[state.mapId]; Royale.startMatch(state, [0, 1]); const fresh = state.players[0];
  assert.deepEqual(fresh.inventory.map(item => item?.weapon || null), ['knife', null, null, null]); assert.equal(fresh.parryCooldown + fresh.meleeSecondaryCooldown + fresh.parryTicks, 0);
  assert.equal(fresh.potions + fresh.grenades, 0);
});
