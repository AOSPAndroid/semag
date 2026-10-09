import assert from 'node:assert/strict';
import test from 'node:test';
import * as Horde from '../public/voxel-horde-engine.js';
import { applyCombatDamage, emptyInput, eyeHeight, playerHeight } from '../public/voxel-engine.js';
import { MELEE_WEAPONS } from '../public/voxel-melee.js';
import { createInventoryGun, createInventoryMelee, refreshInventory, selectInventorySlot } from '../public/voxel-inventory.js';

const arena = Object.freeze({ id: 'horde-close-combat-arena', bounds: Object.freeze({ minX: -25, maxX: 25, minZ: -22, maxZ: 22 }), colliders: Object.freeze([]), spawns: Horde.MAPS.courtyard.spawns });
function advance(state, ticks, inputs = []) { for (let tick = 0; tick < ticks; tick++) Horde.step(state, typeof inputs === 'function' ? inputs(state, tick) : inputs); }
function pose(player, x, z, yaw = 0) { Object.assign(player, { x, y: 0, z, yaw, pitch: 0, vx: 0, vy: 0, vz: 0, grounded: true }); player.previousInput = emptyInput(player); return player; }
function fixture({ melee = 'katana', wave = 1, monsterType = 'stalker', capacity = 1, participants = [0], seed = 73291 } = {}) {
  const state = Horde.createState({ capacity, melee, seed }); Horde.startMatch(state, participants); advance(state, state.phaseTicks);
  state.map = arena; state.horde.wave = wave; state.horde.pending = 1; state.horde.nextSpawnTick = Number.MAX_SAFE_INTEGER;
  const human = pose(state.players[participants[0]], 0, 4);
  state.spawnWarnings = [{ id: 1, x: 0, y: 0, z: -8, ticksLeft: 1, monsterType }]; Horde.step(state);
  const monster = state.players.find(player => player.monster); assert.ok(monster, 'a real rift must create the enemy');
  monster.emergenceTicks = 0; pose(monster, 0, -1.3, Math.PI); pose(human, 0, 0);
  const brain = state.horde.brains[monster.id]; brain.targetId = human.id; brain.nextPlanTick = Number.MAX_SAFE_INTEGER; brain.path = [];
  const inputs = []; inputs[human.id] = { slot1: true, yaw: 0 }; Horde.step(state, inputs); Horde.step(state);
  return { state, human, monster, brain };
}
function strike(state, human, ticks = null) {
  const inputs = []; inputs[human.id] = { fire: true, yaw: human.yaw, pitch: human.pitch };
  Horde.step(state, inputs);
  const blade = MELEE_WEAPONS[human.meleeWeapon]; advance(state, ticks ?? blade.startupTicks + blade.activeTicks + blade.recoveryTicks);
}
function aimAt(player, target) { return { fire: true, aim: true, yaw: Math.atan2(target.x - player.x, -(target.z - player.z)), pitch: Math.atan2(target.y + playerHeight(target) * .55 - player.y - eyeHeight(player), Math.hypot(target.x - player.x, target.z - player.z)) - player.recoil }; }

test('Last Stand validates the starting blade and preserves each survivor choice across start and lobby reset', () => {
  assert.equal(Horde.createState().horde.config.melee, 'katana');
  for (const melee of ['__proto__', null, 'carbine', '', 4, ['katana'], { toString: () => 'katana' }]) {
    assert.throws(() => Horde.createState({ melee }), RangeError); assert.equal(Horde.chooseMelee(Horde.createState(), 0, melee).ok, false);
  }
  for (const melee of Object.keys(MELEE_WEAPONS)) {
    const state = Horde.createState({ capacity: 3, melee });
    assert.equal(state.players[0].inventory[0].weapon, melee); assert.equal(state.players[0].inventory[1].weapon, 'carbine');
    assert.equal(Horde.chooseMelee(state, 2, 'axe').ok, true); assert.equal(Horde.chooseMelee(state, 2, 'axe').changed, false);
    assert.equal(Horde.chooseMelee(state, 3, 'axe').ok, false); assert.equal(Horde.chooseMelee(state, 0, '__proto__').ok, false);
    Horde.startMatch(state, [0, 2]); advance(state, state.phaseTicks);
    assert.equal(state.players[0].inventory[0].weapon, melee); assert.equal(state.players[2].inventory[0].weapon, 'axe');
    assert.equal(Horde.chooseMelee(state, 2, 'tonfas').ok, false, 'a live wave cannot replace an inventory slot from setup');
    Horde.resetLobby(state); assert.equal(state.players[0].inventory[0].weapon, melee); assert.equal(state.players[2].hordeMelee, 'axe');
  }
});

test('two real knife or katana strikes can dispatch an early stalker without spending ammunition or taking a free hit', () => {
  for (const melee of ['knife', 'katana']) {
    const { state, human, monster } = fixture({ melee }); const ammo = human.ammo;
    strike(state, human); assert.equal(monster.alive, true, melee);
    strike(state, human); assert.equal(monster.alive, false, melee);
    assert.equal(human.hp, human.maxHp, `${melee}: an early duel should reward interrupting the readable windup`);
    assert.equal(human.ammo, ammo); assert.equal(human.shots, 0); assert.equal(human.kills, 1);
    assert.equal(state.horde.totalKills, 1); assert.equal(state.events.filter(event => event.type === 'kill').length, 1);
  }
});

test('close damage bonuses diminish over the first three waves while late monster health keeps increasing', () => {
  const health = [], damage = [];
  for (const wave of [1, 2, 3, 4, 8]) {
    const { state, human, monster } = fixture({ melee: 'knife', wave });
    health.push(monster.maxHp); strike(state, human, MELEE_WEAPONS.knife.startupTicks);
    const hit = state.events.findLast(event => event.type === 'damage' && event.playerId === human.id);
    assert.ok(hit, `wave ${wave} must contact an actual enemy`); damage.push(hit.damage);
    assert.equal(hit.damage, Math.round(MELEE_WEAPONS.knife.damage * (Horde.HORDE_MELEE_RULES.damageScales[wave - 1] || 1)));
  }
  assert.deepEqual(damage, [45, 39, 34, 28, 28]); assert.ok(health.slice(1).every((value, index) => value > health[index]));
});

test('a confirmed blade contact interrupts a current monster windup and expires on the authoritative clock', () => {
  const { state, human, monster, brain } = fixture({ melee: 'knife' });
  assert.ok(brain.attackTicks > 0); strike(state, human, MELEE_WEAPONS.knife.startupTicks);
  const stagger = state.events.findLast(event => event.type === 'monsterStagger'); assert.equal(stagger.ticks, 18);
  assert.equal(monster.monsterState, 'stagger'); assert.equal(brain.attackTicks, 0); assert.equal(brain.attackReady, false);
  advance(state, stagger.ticks); assert.equal(brain.staggerTicks, 0); assert.equal(human.hp, human.maxHp);
  advance(state, 90); assert.ok(human.hp < human.maxHp, 'the interruption must leave a subsequent real attack opportunity');
});

test('rapid paired tonfas cannot permanently stagger a late armored brute', () => {
  const { state, human, monster, brain } = fixture({ melee: 'tonfas', wave: 8, monsterType: 'brute' });
  const startingHp = human.hp;
  for (let swing = 0; swing < 5; swing++) strike(state, human);
  assert.ok(monster.alive); assert.ok(human.hp < startingHp, 'an armored brute must land its full telegraphed swing through repeated fast strikes');
  const staggers = state.events.filter(event => event.type === 'monsterStagger'); assert.ok(staggers.length >= 1); assert.ok(staggers.length < 5);
  assert.ok(staggers.every(event => event.ticks === 6));
  assert.ok(brain.staggerReadyTick > staggers[0].tick, 'immunity must live on the shared simulation clock');
});

test('the committed axe rewards heavy close impact while brute armor resists a quicker katana stagger', () => {
  const axe = fixture({ melee: 'axe', wave: 3, monsterType: 'brute' }), katana = fixture({ melee: 'katana', wave: 3, monsterType: 'brute' });
  strike(axe.state, axe.human, MELEE_WEAPONS.axe.startupTicks); strike(katana.state, katana.human, MELEE_WEAPONS.katana.startupTicks);
  const heavyHit = axe.state.events.findLast(event => event.type === 'damage' && event.playerId === 0), quickHit = katana.state.events.findLast(event => event.type === 'damage' && event.playerId === 0);
  const heavyStagger = axe.state.events.findLast(event => event.type === 'monsterStagger'), quickStagger = katana.state.events.findLast(event => event.type === 'monsterStagger');
  assert.equal(heavyHit.damage, 106); assert.equal(quickHit.damage, 58); assert.equal(heavyStagger.ticks, 25); assert.equal(quickStagger.ticks, 10);
  assert.ok(MELEE_WEAPONS.axe.startupTicks > MELEE_WEAPONS.katana.startupTicks); assert.ok(MELEE_WEAPONS.axe.recoveryTicks > MELEE_WEAPONS.katana.recoveryTicks);
  assert.ok(axe.monster.alive && katana.monster.alive, 'an early armored brute must still survive either single blow');
});

test('walls and allied bodies block human blade damage and cannot create a stagger opening', () => {
  for (const obstacle of ['wall', 'ally']) {
    const { state, human, monster, brain } = fixture({ melee: 'katana', capacity: 3, participants: [0, 2] });
    pose(state.players[2], 7, 4);
    if (obstacle === 'wall') state.map = { ...arena, colliders: [{ id: 'blade-cover', x: -8, y: 0, z: -.7, w: 16, h: 4, d: .12 }] };
    else pose(state.players[2], 0, -.65);
    brain.visible = false; brain.nextSightTick = Number.MAX_SAFE_INTEGER; brain.attackTicks = 0;
    strike(state, human); assert.equal(monster.hp, monster.maxHp, obstacle);
    assert.equal(state.players[2].hp, state.players[2].maxHp, obstacle);
    assert.equal(state.events.filter(event => event.type === 'monsterStagger').length, 0, obstacle);
  }
});

test('gun damage never receives the blade bonus or cancels a monster windup', () => {
  const { state, human, monster, brain } = fixture({ wave: 1 });
  selectInventorySlot(human, 1); human.triggerBlocked = false; pose(monster, 0, -1.3, Math.PI);
  const windup = brain.attackTicks; Horde.step(state, [aimAt(human, monster)]);
  const hit = state.events.findLast(event => event.type === 'damage' && event.playerId === human.id);
  assert.ok(hit); assert.equal(hit.attack, 'gun'); assert.equal(hit.damage, Horde.WEAPONS.carbine.damage);
  assert.equal(brain.attackTicks, windup - 1); assert.equal(state.events.filter(event => event.type === 'monsterStagger').length, 0);
});

test('solo pause freezes a blade commitment and stagger, then fences a held trigger on resume', () => {
  const { state, human, brain } = fixture({ melee: 'knife' }); strike(state, human, MELEE_WEAPONS.knife.startupTicks);
  assert.ok(brain.staggerTicks > 0); Horde.pauseMatch(state); const frozen = JSON.stringify(state);
  advance(state, 600, [{ fire: true, up: true }]); assert.equal(JSON.stringify(state), frozen);
  Horde.resumeMatch(state); const starts = state.events.filter(event => event.type === 'meleeStart').length;
  advance(state, 50, [{ fire: true }]); assert.equal(state.events.filter(event => event.type === 'meleeStart').length, starts);
  Horde.step(state); Horde.step(state, [{ fire: true }]); assert.equal(state.events.filter(event => event.type === 'meleeStart').length, starts + 1);
});

test('wave-clear melee supplies are optional and never overwrite four deliberately carried guns', () => {
  const { state, human, monster } = fixture();
  human.inventory = ['pistol', 'carbine', 'smg', 'shotgun'].map(createInventoryGun); human.inventoryIndex = human.inventoryGunIndex = 0; refreshInventory(human);
  applyCombatDamage(state, [{ playerId: 0, targetId: monster.id, damage: monster.hp, attack: 'gun', weapon: 'pistol' }]); state.horde.pending = 0;
  Horde.step(state); assert.equal(state.phase, 'intermission');
  assert.deepEqual(human.inventory.map(item => item.weapon), ['pistol', 'carbine', 'smg', 'shotgun']);
  const cache = state.loot.find(drop => drop.source === 'wave-clear'); assert.ok(cache); assert.equal(cache.kind, 'melee'); assert.equal(cache.weapon, 'tonfas');
  Horde.step(state, [{ interact: true }]); assert.ok(state.loot.some(drop => drop.id === cache.id));
  Horde.step(state); Horde.step(state, [{ drop: true }]); assert.equal(human.inventory[0], null);
  // Keep the optional cache nearest to the acting human while the discarded gun
  // remains a separate physical item and can be reclaimed later.
  const gunDrop = state.loot.find(drop => drop.kind === 'weapon'); assert.ok(gunDrop); pose(human, .7, 0); gunDrop.x = -.8;
  Horde.step(state); Horde.step(state, [{ interact: true }]); assert.equal(human.inventory[0].weapon, 'tonfas');
  assert.ok(state.loot.some(drop => drop.id === gunDrop.id)); assert.equal(human.hordeMelee, 'katana');
});

test('rare physical monster melee drops can be collected into a freed slot and never replace a guaranteed heal', () => {
  for (const [monsterType, wave, weapon] of [['stalker', 1, 'katana'], ['runner', 2, 'tonfas'], ['brute', 3, 'axe']]) {
    const { state, human, monster } = fixture({ melee: 'axe', seed: 9216, wave, monsterType });
    for (let swing = 0; swing < 6 && monster.alive; swing++) strike(state, human);
    assert.equal(monster.alive, false); const loot = state.loot.find(drop => drop.kind === 'melee');
    assert.ok(loot, monsterType); assert.equal(loot.weapon, weapon); assert.equal(loot.item.kind, 'melee');
    Horde.step(state, [{ drop: true }]); assert.equal(human.inventory[0], null);
    pose(human, monster.x, monster.z); Horde.step(state); Horde.step(state, [{ interact: true }]);
    assert.equal(human.inventory[0].weapon, weapon); assert.ok(state.loot.every(drop => drop.id !== loot.id));
    assert.equal(state.horde.totalKills, 1);
  }
  const { state, human, monster } = fixture({ melee: 'axe', seed: 9216 }); state.horde.killsSinceHeal = 4;
  strike(state, human); assert.equal(monster.alive, false); assert.equal(state.loot.length, 1); assert.equal(state.loot[0].type, 'health');
});

test('revives preserve the selected starting-blade identity and the actual carried flexible inventory', () => {
  const { state, human, monster } = fixture({ melee: 'axe', capacity: 3, participants: [0, 2] });
  monster.emergenceTicks = 10000; const fallen = pose(state.players[2], 1, 0);
  fallen.inventory = [createInventoryGun('pistol'), createInventoryGun('carbine'), createInventoryMelee('tonfas'), { kind: 'heal', amount: 2 }]; fallen.inventoryIndex = 2; fallen.inventoryGunIndex = 1; refreshInventory(fallen);
  applyCombatDamage(state, [{ targetId: fallen.id, playerId: monster.id, damage: fallen.hp, attack: 'monster', weapon: 'stalker' }]);
  advance(state, Horde.HORDE_RULES.reviveTicks, [{ interact: true }]); const revived = state.players[2];
  assert.ok(revived.alive); assert.equal(revived.hordeMelee, 'axe'); assert.equal(revived.inventory[0].kind, 'weapon');
  assert.equal(revived.inventory[2].weapon, 'tonfas'); assert.equal(revived.inventory[3], null); assert.equal(revived.potions, 0); assert.equal(revived.inventoryIndex, 2);
  assert.equal(human.interactTicks, 0);
});

test('seeded sparse co-op close combat and melee supply rewards replay exactly', () => {
  const first = fixture({ melee: 'tonfas', capacity: 3, participants: [0, 2], seed: 291 }), second = fixture({ melee: 'tonfas', capacity: 3, participants: [0, 2], seed: 291 });
  pose(first.state.players[2], 4, 1); pose(second.state.players[2], 4, 1);
  for (let tick = 0; tick < 220; tick++) {
    const input = [{ fire: tick % 34 === 0, yaw: 0 }, emptyInput(), { right: tick < 30, yaw: 0 }];
    Horde.step(first.state, input); Horde.step(second.state, input);
  }
  assert.equal(JSON.stringify(first.state), JSON.stringify(second.state)); assert.equal(first.human.kills, 1);
  assert.deepEqual(first.state.horde.participantIds, [0, 2]); assert.ok(first.state.players.every((player, index) => player.id === index));
});
