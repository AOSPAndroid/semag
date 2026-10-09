import assert from 'node:assert/strict';
import test from 'node:test';
import * as Combat from '../public/voxel-engine.js';
import { KNIFE, KNIFE_SECONDARY, MELEE_WEAPONS, PARRY_PROFILES, meleeProfile, meleeSlashGeometry, meleeSlashOrigin, parryPhase, resetMeleeDefense } from '../public/voxel-melee.js';
import { setInventoryMeleeLoadout } from '../public/voxel-inventory.js';
import { createFpsInputQueue } from '../public/voxel-input-queue.js';
import { combatPresentation, createMovementPresenter, projectedMovement } from '../public/voxel-presentation.js';

const arena = { id: 'secondary-fixture', bounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 }, colliders: [] };
const wall = { id: 'shield', x: -2, y: 0, z: -.7, w: 4, h: 3, d: .08 };
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
const movement = ['x', 'y', 'z', 'vx', 'vy', 'vz', 'grounded', 'stamina', 'staminaRegenTicks', 'sprintExhausted', 'sprinting'];
function actor(id, fields = {}) { return { ...Combat.createCombatPlayer(id), hp: 500, maxHp: 500, lifeId: 1, ...fields }; }
function fixture({ weapon = 'knife', gameId = 'voxel-breach', target = { z: -2.3 }, map = arena } = {}) {
  const player = actor(0, { team: 0, x: 0, y: 0, z: 0, human: true, connected: true, participating: true });
  setInventoryMeleeLoadout(player, weapon, { equip: true });
  const enemy = actor(1, { team: 1, x: 0, y: 0, z: -10, ...target });
  const players = [player, enemy], state = { gameId, phase: 'fight', tick: 0, eventId: 0, events: [], players, fighters: players, map, grenades: [], bolts: [], loot: [] };
  return { state, player, enemy };
}
function step(state, commands = {}, count = 1, options = {}, map = state.map) {
  for (let frame = 0; frame < count; frame++) {
    state.tick++; const inputs = state.players.map(player => ({ ...Combat.emptyInput(player), ...commands[player.id] }));
    Combat.combatStep(state, inputs, map, options);
  }
}
function readyGuard(weapon = 'sword', target = { z: -1.2, monster: true, human: false, monsterType: 'stalker' }) {
  const setup = fixture({ weapon, target });
  step(setup.state, { 0: { aim: true } }); step(setup.state, {}, PARRY_PROFILES[weapon].startupTicks);
  assert.equal(parryPhase(setup.player).phase, 'active'); return setup;
}
function claw(state, source = 1, changes = {}) {
  const attacker = state.players[source], origin = meleeSlashOrigin(attacker), defender = state.players[0];
  return { playerId: source, targetId: 0, targetLifeId: defender.lifeId, damage: 20, attack: 'monster', weapon: attacker.monsterType, attackX: origin.x, attackY: origin.y, attackZ: origin.z, ...changes };
}

test('secondary catalog is immutable and knife geometry uses exactly the heavy profile without changing quick attacks', () => {
  assert.ok(Object.isFrozen(KNIFE_SECONDARY) && Object.isFrozen(PARRY_PROFILES));
  assert.deepEqual([KNIFE.startupTicks, KNIFE.activeTicks, KNIFE.recoveryTicks, KNIFE.damage, KNIFE.reach], [10, 8, 26, 28, 1.7]);
  assert.deepEqual([KNIFE_SECONDARY.startupTicks, KNIFE_SECONDARY.activeTicks, KNIFE_SECONDARY.recoveryTicks, KNIFE_SECONDARY.damage, KNIFE_SECONDARY.reach, KNIFE_SECONDARY.slashRadius, KNIFE_SECONDARY.pushSpeed], [20, 6, 54, 60, 2.15, .10, 3.2]);
  const actor = { x: 2, y: 3, z: 4, meleeWeapon: 'knife', meleeAction: 'secondary', meleeYaw: .8, meleePitch: -.3 };
  assert.equal(meleeProfile(actor), KNIFE_SECONDARY); assert.equal(meleeProfile('knife'), KNIFE);
  const path = meleeSlashGeometry(actor); assert.equal(path.kind, 'stab'); assert.equal(path.radius, .10);
  for (const sample of path.samples) near(Math.hypot(sample.outer.x - path.origin.x, sample.outer.y - path.origin.y, sample.outer.z - path.origin.z) + path.radius, 2.15);
});

for (const gameId of ['voxel-breach', 'voxel-horde', 'voxel-royale', 'voxel-practice']) test(`${gameId}: held RMB commits one stronger knife stab and one accepted physical impact`, () => {
  const { state, player, enemy } = fixture({ gameId });
  if (gameId === 'voxel-horde') Object.assign(enemy, { monster: true, human: false, monsterType: 'stalker' });
  step(state, { 0: { aim: true } }); assert.equal(player.meleeTicks, 80); assert.equal(player.meleeAction, 'secondary'); assert.equal(player.aiming, false);
  step(state, { 0: { aim: true } }, 20);
  assert.equal(enemy.hp, 440); assert.equal(player.meleeIndex, 1);
  const damage = state.events.filter(event => event.type === 'damage'); assert.equal(damage.length, 1); assert.equal(damage[0].meleeAction, 'secondary'); assert.equal(damage[0].damage, 60);
  const push = state.events.find(event => event.type === 'meleeKnockback'); near(push.speed, gameId === 'voxel-horde' ? 3.2 : 3.2 * .28);
  step(state, { 0: { aim: true } }, 100); assert.equal(player.meleeIndex, 1); assert.equal(enemy.hp, 440);
});

test('heavy knife has real windup, precise longer reach and committed yaw/pitch through recovery', () => {
  const { state, player, enemy } = fixture(); step(state, { 0: { aim: true, yaw: 0, pitch: 0 } });
  step(state, { 0: { yaw: 1.5, pitch: .7 } }, 19); assert.equal(enemy.hp, 500); assert.equal(player.meleePhase, 'startup');
  step(state, { 0: { yaw: 1.5, pitch: .7 } }); assert.equal(enemy.hp, 440); assert.equal(player.meleeYaw, 0); assert.equal(player.meleePitch, 0);
  const quick = fixture(); step(quick.state, { 0: { fire: true } }); step(quick.state, {}, 18); assert.equal(quick.enemy.hp, 500, 'this same flesh is outside the quick knife reach');
  const outside = fixture({ target: { z: -2.46 } }); step(outside.state, { 0: { aim: true } }); step(outside.state, {}, 26); assert.equal(outside.enemy.hp, 500);
  const side = fixture({ target: { x: .6, z: -1.3 } }); step(side.state, { 0: { aim: true } }); step(side.state, {}, 26); assert.equal(side.enemy.hp, 500, 'the heavy stab is not a damaging cone');
});

test('knife secondary retains real wall, ally, vertical and low hound flesh checks', () => {
  for (const kind of ['wall', 'ally', 'high']) {
    const setup = fixture({ map: kind === 'wall' ? { ...arena, colliders: [wall] } : arena, target: kind === 'high' ? { z: -1.4, y: 3 } : { z: -1.4 } });
    if (kind === 'ally') setup.state.players.push(actor(2, { team: 0, z: -.7 }));
    step(setup.state, { 0: { aim: true } }); step(setup.state, {}, 26); assert.equal(setup.enemy.hp, 500, kind);
  }
  for (const pitch of [0, -.5]) {
    const setup = fixture({ gameId: 'voxel-horde', target: { z: -1.4, yaw: Math.PI / 2, monster: true, human: false, monsterType: 'hound', radius: .5 } });
    step(setup.state, { 0: { aim: true, pitch } }); step(setup.state, {}, 26);
    assert.equal(setup.enemy.hp, pitch ? 440 : 500, 'a low hound needs a real downward flesh contact');
  }
});

test('all carried guard weapons commit their exact finite profile, pay once and cannot repeat under held RMB', () => {
  for (const [weapon, profile] of Object.entries(PARRY_PROFILES)) {
    assert.ok(Object.isFrozen(profile)); const { state, player } = fixture({ weapon });
    step(state, { 0: { aim: true } }); assert.equal(player.parryTicks, profile.startupTicks + profile.activeTicks + profile.recoveryTicks);
    assert.equal(player.parryCooldown, profile.cooldownTicks); assert.equal(player.meleeSecondaryCooldown, profile.cooldownTicks);
    assert.equal(player.stamina, 100 - profile.staminaCost); assert.equal(player.staminaRegenTicks, Combat.SPRINT.regenDelayTicks);
    step(state, { 0: { aim: true } }, 200); assert.equal(player.parryIndex, 1); assert.equal(player.parryTicks, 0);
    assert.equal(state.events.filter(event => event.type === 'parryStart').length, 1); assert.equal(player.meleeIndex, 0);
  }
});

test('a guard blocks only its exact active window, with vulnerable windup and recovery', () => {
  for (const age of [3, 4, 15, 16]) {
    const { state, player } = fixture({ weapon: 'sword', target: { z: -1.2, monster: true, human: false, monsterType: 'stalker' } });
    step(state, { 0: { aim: true } }); step(state, {}, age); Combat.applyCombatDamage(state, [claw(state)]);
    const active = age === 4 || age === 15; assert.equal(player.hp, active ? 500 : 480, `age ${age}`);
    assert.equal(state.events.filter(event => event.type === 'meleeParry').length, active ? 1 : 0);
  }
});

test('front guard direction is committed in three dimensions and rejects side, rear and high attacks', () => {
  for (const target of [{ z: -1.2 }, { z: 1.2 }, { x: 1.2, z: 0 }, { z: -1.2, y: 3 }]) {
    const setup = readyGuard('sword', { ...target, monster: true, human: false, monsterType: 'stalker' });
    step(setup.state, { 0: { yaw: Math.PI, pitch: 1 } }); Combat.applyCombatDamage(setup.state, [claw(setup.state)]);
    assert.equal(setup.player.parryYaw, 0); assert.equal(setup.player.parryPitch, 0);
    assert.equal(setup.player.hp, target.z === -1.2 && !target.y ? 500 : 480);
  }
});

test('bullets, bolts, grenades and environmental damage always penetrate a melee guard', () => {
  for (const attack of ['gun', 'bolt', 'grenade', 'storm', 'disconnect']) {
    const { state, player } = readyGuard(); Combat.applyCombatDamage(state, [claw(state, 1, { attack, weapon: attack === 'bolt' ? 'crossbow' : 'carbine' })]);
    assert.equal(player.hp, 480, attack); assert.equal(player.parryConsumed, false); assert.equal(state.events.some(event => event.type === 'meleeParry'), false);
  }
});

test('one guard consumes one nearest real melee contact independently of pending order, never repeated hits', () => {
  for (const reverse of [false, true]) {
    const { state, player } = readyGuard(); state.players.push(actor(2, { team: 1, z: -2, monster: true, human: false, monsterType: 'stalker' }));
    const hits = [claw(state, 1), claw(state, 2)]; Combat.applyCombatDamage(state, reverse ? hits.reverse() : hits);
    assert.equal(player.hp, 480); assert.equal(player.parryConsumed, true); assert.equal(player.parryTicks, 24);
    assert.equal(state.events.find(event => event.type === 'meleeParry').targetId, 1);
    Combat.applyCombatDamage(state, [claw(state)]); assert.equal(player.hp, 460); assert.equal(state.events.filter(event => event.type === 'meleeParry').length, 1);
  }
});

test('successful blade parry preserves original attacker recovery, suppresses accepted-hit feedback and never runs a damage hook', () => {
  const { state, player, enemy } = fixture({ target: { z: -1.2 } }); setInventoryMeleeLoadout(enemy, 'sword', { equip: true }); enemy.yaw = Math.PI;
  let hooks = 0; const options = { onMeleeHit: () => hooks++ };
  step(state, { 0: { aim: true } }, 1, options); step(state, {}, 15, options);
  step(state, { 1: { aim: true } }, 1, options); step(state, {}, 4, options);
  assert.equal(enemy.hp, 500); assert.equal(enemy.parryConsumed, true); assert.equal(player.meleeTicks, 54); assert.equal(player.meleePhase, 'recovery'); assert.equal(player.meleeCooldown, 60);
  assert.equal(hooks, 0); assert.equal(state.events.filter(event => event.type === 'meleeParry').length, 1);
  for (const type of ['damage', 'meleeHit', 'meleeKnockback']) assert.equal(state.events.some(event => event.type === type), false, type);
  step(state, {}, 80, options); assert.equal(enemy.hp, 500); assert.equal(player.meleeCooldown, 0);
});

test('guard cover checks use the exact explicit combat arena rather than a stale state map', () => {
  for (const staleWall of [false, true]) {
    const { state, player, enemy } = fixture({ target: { z: -1.2 } }); setInventoryMeleeLoadout(enemy, 'sword', { equip: true }); enemy.yaw = Math.PI;
    state.map = staleWall ? { ...arena, colliders: [wall] } : arena;
    step(state, { 0: { aim: true } }, 1, {}, arena); step(state, {}, 15, {}, arena); step(state, { 1: { aim: true } }, 1, {}, arena); step(state, {}, 4, {}, arena);
    assert.equal(enemy.hp, 500); assert.equal(state.events.filter(event => event.type === 'meleeParry').length, 1); assert.equal(player.meleePhase, 'recovery');
  }
  const blocked = readyGuard(); blocked.state.map = { ...arena, colliders: [wall] };
  Combat.applyCombatDamage(blocked.state, [claw(blocked.state)]); assert.equal(blocked.player.hp, 480); assert.equal(blocked.player.parryConsumed, false, 'a forged covered contact cannot create a successful defense');
});

test('dead, friendly, stale-life, bot and insufficient-stamina actors cannot invent guard success or commitment', () => {
  for (const variant of ['dead', 'friendly', 'stale']) {
    const { state, player, enemy } = readyGuard(); const hit = claw(state);
    if (variant === 'dead') player.alive = false;
    if (variant === 'friendly') enemy.team = player.team;
    if (variant === 'stale') hit.targetLifeId++;
    Combat.applyCombatDamage(state, [hit]); assert.equal(state.events.some(event => event.type === 'meleeParry'), false, variant);
  }
  for (const fields of [{ bot: true }, { monster: true, human: false, monsterType: 'stalker' }, { stamina: 11 }]) {
    const { state, player } = fixture({ weapon: 'sword' }); Object.assign(player, fields); step(state, { 0: { aim: true } }); assert.equal(player.parryTicks, 0); assert.equal(player.parryIndex, 0);
  }
});

test('guard commitment and complete expiry replay match real movement/stamina without changing published action or inventory state', () => {
  for (const weapon of ['knife', 'sword', 'axe', 'tonfas']) {
    const { state, player } = fixture({ weapon, target: { z: -40 } }), predicted = structuredClone(player);
    const published = JSON.stringify([predicted.hp, predicted.inventory, predicted.meleeTicks, predicted.meleeAction, predicted.parryTicks, predicted.parryCooldown, predicted.meleeSecondaryCooldown]);
    for (let frame = 0; frame < 110; frame++) {
      const buttons = { up: true, aim: frame === 0, sprint: frame > 0 };
      Combat.predictLocalMovement(predicted, buttons, arena); step(state, { 0: buttons });
      for (const field of movement) typeof player[field] === 'number' ? near(predicted[field], player[field]) : assert.equal(predicted[field], player[field], `${weapon}:${frame}:${field}`);
    }
    assert.equal(JSON.stringify([predicted.hp, predicted.inventory, predicted.meleeTicks, predicted.meleeAction, predicted.parryTicks, predicted.parryCooldown, predicted.meleeSecondaryCooldown]), published);
    assert.equal(predicted.sprinting, true);
  }
});

test('received guard corrections invalidate cached movement and display timers remain strictly cosmetic', () => {
  const { player } = fixture({ weapon: 'sword' }), buttons = { up: true, sprint: true }, peers = [], present = createMovementPresenter();
  player.vz = -MELEE_WEAPONS.sword.speed; const free = projectedMovement(player, buttons, arena, 25, Combat.predictLocalMovement, peers); assert.equal(free.sprinting, true);
  Object.assign(player, { parryTicks: 30, parryStartTick: 5 }); const source = structuredClone(player);
  const guarded = projectedMovement(player, buttons, arena, 25, Combat.predictLocalMovement, peers); assert.equal(guarded.sprinting, false);
  const half = present(player, buttons, arena, 1 / 240, Combat.predictLocalMovement, peers); assert.ok(half.z > free.z);
  const visual = combatPresentation(player, { ...player, parryTicks: 31 }, .5, 4); assert.ok(visual.parryTicks < 31 && visual.parryTicks > 0); assert.deepEqual(player, source);
  player.parryTicks = 0; assert.equal(projectedMovement(player, buttons, arena, 25, Combat.predictLocalMovement, peers).sprinting, true);
  assert.equal(combatPresentation(player, { ...player, parryTicks: 3 }, .5, 25).parryTicks, 0, 'presentation cannot resurrect an accepted completed guard');
});

test('canceling transient defense retains paid stamina and physical plus global recovery', () => {
  const { state, player } = fixture({ weapon: 'sword' }); step(state, { 0: { aim: true } }); const stamina = player.stamina;
  resetMeleeDefense(player, { blockAim: true }); assert.equal(player.parryTicks, 0); assert.equal(player.stamina, stamina); assert.equal(player.parryCooldown, 72); assert.equal(player.meleeSecondaryCooldown, 72);
  step(state, { 0: { aim: true } }, 75); assert.equal(player.parryIndex, 1, 'held RMB remains fenced after cooldown expires');
  step(state); step(state, { 0: { aim: true } }); assert.equal(player.parryIndex, 2);
});

test('a released RMB tap keeps committed aim, and cancellation removes only its owned unconsumed press', () => {
  const { state, player } = fixture(), queue = createFpsInputQueue();
  queue.observe({ aim: true, yaw: .3, pitch: -.2 }, 100, { sequence: 0 }); queue.observe({ yaw: 1, pitch: .6 }, 101, { sequence: 1 });
  const sampled = queue.sample(undefined, 102); assert.equal(sampled.buttons.aim, true); assert.equal(sampled.buttons.yaw, .3); assert.equal(sampled.buttons.pitch, -.2);
  step(state, { 0: sampled.buttons }); assert.equal(player.meleeAction, 'secondary'); assert.equal(player.meleeYaw, .3); assert.equal(player.meleePitch, -.2);
  queue.observe({ aim: true }, 103, { sequence: 2 }); queue.observe({}, 104, { sequence: 3 }); assert.equal(queue.cancel({ action: 'aim', seq: 2 }), true); assert.equal(queue.sample(undefined, 105).buttons.aim, undefined);
});

test('held gun ADS stays continuous through fire and utility journals without synthetic aim release', () => {
  const setup = fixture(); setup.player.inventoryIndex = 1; setup.player.slot = 'primary'; const queue = createFpsInputQueue();
  queue.observe({ aim: true, fire: true, yaw: .1 }, 100);
  for (let frame = 0; frame < 25; frame++) {
    if (frame === 2) queue.observe({ aim: true, fire: true, jump: true, yaw: .4 }, 102);
    if (frame === 3) queue.observe({ aim: true, fire: true, yaw: .5 }, 103);
    const sampled = queue.sample(undefined, 100 + frame); assert.equal(sampled.buttons.aim, true); assert.equal(sampled.buttons.fire, true); step(setup.state, { 0: sampled.buttons });
  }
  assert.equal(setup.player.aimTicks, Combat.ADS.ticks); assert.ok(setup.player.shots >= 2);
});

test('fresh held RMB delivered beside a queued jump keeps its press direction while later ADS look remains current', () => {
  const { state, player } = fixture(), queue = createFpsInputQueue();
  queue.observe({ jump: true, yaw: -.8 }, 100); queue.observe({ jump: true, aim: true, yaw: .3, pitch: -.2 }, 101);
  queue.observe({ jump: true, aim: true, yaw: 1.2, pitch: .7 }, 102);
  const sampled = queue.sample(undefined, 103); assert.equal(sampled.buttons.jump, true); assert.equal(sampled.buttons.aim, true); assert.equal(sampled.buttons.yaw, .3); assert.equal(sampled.buttons.pitch, -.2);
  step(state, { 0: sampled.buttons }); assert.equal(player.meleeYaw, .3); assert.equal(player.meleePitch, -.2);
  const continuing = queue.sample(undefined, 104); assert.equal(continuing.buttons.aim, true); assert.equal(continuing.buttons.yaw, 1.2); assert.equal(continuing.buttons.pitch, .7);
});

test('physical inventory commands supersede pending RMB and fence a held aim until genuine release', () => {
  for (const action of ['slot1', 'slot2', 'slot3', 'slot4', 'drop', 'swap']) {
    const queue = createFpsInputQueue(); queue.observe({ aim: true }, 100, { sequence: 0 }); queue.observe({ aim: true, [action]: true }, 101, { sequence: 1 });
    assert.equal(queue.inspect().pending.some(edge => edge.action === 'aim'), false); assert.equal(queue.sample(undefined, 102).buttons.aim, false);
    queue.observe({ aim: true }, 103); assert.equal(queue.sample(undefined, 104).buttons.aim, false);
    queue.observe({}, 105); queue.observe({ aim: true, yaw: .4 }, 106); const fresh = queue.sample(undefined, 107); assert.equal(fresh.buttons.aim, true); assert.equal(fresh.buttons.yaw, .4);
  }
});
