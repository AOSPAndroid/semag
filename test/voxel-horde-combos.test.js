import assert from 'node:assert/strict';
import test from 'node:test';
import * as Horde from '../public/voxel-horde-engine.js';
import { emptyInput, KNOCKBACK } from '../public/voxel-engine.js';
import { MELEE_WEAPONS, meleeComboLength, meleeProfile } from '../public/voxel-melee.js';
import { selectInventorySlot, setInventoryMeleeLoadout } from '../public/voxel-inventory.js';

const arena = Object.freeze({ id: 'horde-combo-contact-qa', bounds: Object.freeze({ minX: -25, maxX: 25, minZ: -25, maxZ: 25 }), colliders: Object.freeze([]), spawns: Horde.MAPS.courtyard.spawns });
function advance(state, ticks, inputs = []) { for (let tick = 0; tick < ticks; tick++) Horde.step(state, inputs); }
function pose(player, x, z, yaw = 0) {
  Object.assign(player, { x, y: 0, z, yaw, pitch: 0, vx: 0, vy: 0, vz: 0, grounded: true }); player.previousInput = emptyInput(player); return player;
}
function fixture({ weapon = 'katana', wave = 8, targetType = 'stalker', capacity = 1, participants = [0], humanId = participants[0], warmTarget = true } = {}) {
  const state = Horde.createState({ capacity, seed: 73812 }); Horde.startMatch(state, participants); advance(state, state.phaseTicks);
  state.map = arena; state.horde.wave = wave; state.horde.pending = 1; state.horde.nextSpawnTick = Number.MAX_SAFE_INTEGER;
  for (const id of participants) pose(state.players[id], -12 + id * 3, 10);
  const monsters = [];
  for (const [index, monsterType] of (warmTarget ? ['brute', targetType] : [targetType]).entries()) {
    state.spawnWarnings = [{ id: index + 1, x: -8 + index * 4, y: 0, z: -10, ticksLeft: 1, monsterType }]; Horde.step(state);
    const monster = state.players.find(player => player.monster && !monsters.includes(player)); assert.ok(monster, 'a real rift creates each enemy'); monsters.push(monster);
  }
  for (const [index, monster] of monsters.entries()) {
    monster.emergenceTicks = 0; pose(monster, index * 8, index ? -8 : -1.3, Math.PI);
    const brain = state.horde.brains[monster.id]; brain.nextPlanTick = brain.nextSightTick = 0;
  }
  const human = pose(state.players[humanId], 0, 0); setInventoryMeleeLoadout(human, weapon); selectInventorySlot(human, 0); human.triggerBlocked = false;
  return { state, human, warm: warmTarget ? monsters[0] : null, monster: monsters.at(-1) };
}
function beginCut(setup, target = setup.monster) {
  const { state, human } = setup, inputs = []; const yaw = Math.atan2(target.x - human.x, -(target.z - human.z));
  inputs[human.id] = { fire: true, yaw, pitch: 0 }; Horde.step(state, inputs);
  assert.ok(human.meleeTicks > 0, 'a fresh real input starts the cut');
  return { profile: meleeProfile(human), index: human.meleeIndex };
}
function finishCut(setup) {
  let limit = 200;
  while ((setup.human.meleeTicks || setup.human.meleeCooldown) && --limit > 0) Horde.step(setup.state);
  assert.ok(limit > 0, 'the commitment expires on the simulation clock');
}
function warmChain(setup) {
  const length = meleeComboLength(setup.human);
  for (let step = 1; step < length; step++) {
    const cut = beginCut(setup, setup.warm); assert.equal(cut.profile.comboStep, step); finishCut(setup);
    assert.ok(setup.state.events.some(event => event.type === 'meleeHit' && event.playerId === setup.human.id && event.meleeIndex === cut.index && event.targetId === setup.warm.id), 'only a confirmed real hit advances the chain');
  }
  assert.ok(setup.warm.alive, 'the warm-up creature uses its real late-wave health');
}
function prepareFinisher(setup) {
  warmChain(setup); pose(setup.human, setup.monster.x, setup.monster.z + 1.3);
  const cut = beginCut(setup); assert.equal(cut.profile.comboStep, meleeComboLength(setup.human)); assert.equal(cut.profile.comboFinisher, true);
  return cut;
}
function awaitContact(setup, cut) {
  for (let tick = 0; tick < cut.profile.startupTicks + cut.profile.activeTicks + 3; tick++) {
    const hit = setup.state.events.find(event => event.type === 'meleeHit' && event.playerId === setup.human.id && event.targetId === setup.monster.id && event.meleeIndex === cut.index);
    if (hit) return hit;
    Horde.step(setup.state);
  }
  assert.fail('the final committed band must contact the real target');
}

for (const weapon of Object.keys(MELEE_WEAPONS)) {
  test(`${weapon}: a confirmed chain finisher gives a fresh late-wave enemy a bounded shove and flinch`, () => {
    const setup = fixture({ weapon }), { state, human, monster } = setup, cut = prepareFinisher(setup);
    const hit = awaitContact(setup, cut), brain = state.horde.brains[monster.id];
    const stagger = state.events.findLast(event => event.type === 'monsterStagger' && event.targetId === monster.id);
    const push = state.events.findLast(event => event.type === 'meleeKnockback' && event.targetId === monster.id);
    assert.ok(monster.alive, 'real late-wave health survives one finisher'); assert.equal(hit.comboFinisher, true);
    assert.equal(stagger.comboStep, cut.profile.comboStep); assert.equal(stagger.comboLength, cut.profile.comboLength); assert.equal(stagger.comboFinisher, true); assert.equal(stagger.targetLifeId, monster.lifeId); assert.equal(stagger.attackerLifeId, human.lifeId);
    assert.equal(stagger.ticks, Math.max(6, Math.round(Horde.HORDE_MELEE_RULES.staggerTicks[weapon] * Horde.HORDE_MELEE_RULES.comboStaggerMultiplier * .35)));
    assert.equal(brain.staggerTicks, stagger.ticks); assert.equal(brain.attackTicks, 0); assert.equal(monster.monsterState, 'stagger');
    assert.equal(push.speed, Math.min(KNOCKBACK.maxMonsterSpeed, cut.profile.pushSpeed)); assert.equal(push.comboFinisher, true);
    const impactZ = monster.z; advance(state, 8); assert.ok(monster.z < impactZ - .025, 'the authoritative impulse visibly displaces the enemy');
    advance(state, 180); assert.equal(monster.knockbackTicks, 0); assert.equal(brain.staggerTicks, 0);
    assert.ok(state.events.some(event => event.type === 'monsterAttack' && event.playerId === monster.id), 'the survivor resumes its authored attack after the short opening');
  });
}

test('a katana finisher remains collision-swept against real rear cover', () => {
  const setup = fixture(), { state, human, monster } = setup; warmChain(setup);
  pose(monster, 8, -8); pose(human, 8, -6.7);
  const wall = { id: 'finisher-rear-cover', x: 0, y: 0, z: -8.54, w: 18, h: 4, d: .12 }; state.map = { ...arena, colliders: [wall] };
  const cut = beginCut(setup); assert.equal(cut.profile.comboFinisher, true); awaitContact(setup, cut); let minZ = monster.z;
  for (let tick = 0; tick < 60; tick++) { Horde.step(state); minZ = Math.min(minZ, monster.z); assert.ok(monster.z - monster.radius >= wall.z + wall.d - 1e-6, 'neither blade impulse nor subsequent AI crosses the solid wall'); }
  assert.ok(minZ < -8.02, 'cover constrains a genuine visible shove');
});

test('a katana finisher cannot push its enemy through an allied living body', () => {
  const setup = fixture({ capacity: 3, participants: [0, 2], humanId: 2 }), { state, human, monster } = setup; warmChain(setup);
  pose(monster, 8, -8); pose(human, 8, -6.7); const ally = pose(state.players[0], 8, -8.9);
  const cut = beginCut(setup); assert.equal(cut.profile.comboFinisher, true); awaitContact(setup, cut);
  let maximumPush = 0;
  for (let tick = 0; tick < 40; tick++) {
    Horde.step(state); maximumPush = Math.max(maximumPush, -8 - monster.z);
    assert.ok(Math.hypot(monster.x - ally.x, monster.z - ally.z) >= monster.radius + ally.radius - 1e-5, 'swept push never tunnels through the allied body');
  }
  assert.ok(maximumPush > .025, 'the body constrains a visible impulse');
});

test('late brutes resist a confirmed katana finisher and repeated chain contacts cannot reset their attack window', () => {
  const fresh = fixture({ targetType: 'brute' }), cut = prepareFinisher(fresh); awaitContact(fresh, cut);
  const stagger = fresh.state.events.findLast(event => event.type === 'monsterStagger' && event.targetId === fresh.monster.id);
  const push = fresh.state.events.findLast(event => event.type === 'meleeKnockback' && event.targetId === fresh.monster.id);
  assert.equal(stagger.ticks, 6); assert.equal(push.speed, cut.profile.pushSpeed * .35);
  const setup = fixture({ targetType: 'brute', warmTarget: false }), { state, human, monster } = setup;
  for (let step = 1; step <= meleeComboLength(human); step++) { const contact = beginCut(setup); assert.equal(contact.profile.comboStep, step); finishCut(setup); }
  const contacts = state.events.filter(event => event.type === 'meleeHit' && event.targetId === monster.id);
  const staggers = state.events.filter(event => event.type === 'monsterStagger' && event.targetId === monster.id);
  assert.equal(contacts.length, 3); assert.equal(staggers.length, 1, 'a finisher does not bypass the first contact immunity');
  assert.ok(monster.alive); assert.ok(human.hp < human.maxHp, 'the real telegraphed brute attack can counter the chain');
});

test('sparse co-op chain damage, lethal contact and physical corpse drops retain the responsible survivor', () => {
  const setup = fixture({ weapon: 'knife', wave: 1, capacity: 3, participants: [0, 2], humanId: 2, warmTarget: false }); const { state, human, monster } = setup;
  state.horde.killsSinceHeal = 4;
  for (let step = 1; step <= 2; step++) { const cut = beginCut(setup); assert.equal(cut.profile.comboStep, step); finishCut(setup); }
  assert.equal(monster.alive, false); assert.equal(human.kills, 1); assert.equal(state.players[0].kills, 0); assert.equal(human.damageDealt, monster.maxHp); assert.equal(state.players[0].damageDealt, 0); assert.equal(state.horde.totalKills, 1);
  const hits = state.events.filter(event => event.type === 'meleeHit' && event.targetId === monster.id), deaths = state.events.filter(event => event.type === 'kill' && event.targetId === monster.id);
  assert.deepEqual(hits.map(event => event.comboStep), [1, 2]); assert.equal(deaths.length, 1); assert.equal(deaths[0].playerId, 2); assert.equal(deaths[0].targetLifeId, monster.lifeId);
  const drop = state.loot.find(item => item.kind === 'heal'), supply = state.events.findLast(event => event.type === 'hordeDrop');
  assert.ok(drop, 'the ordinary fifth-kill guarantee still creates a physical corpse heal'); assert.equal(supply.lootId, drop.id); assert.equal(supply.kind, 'heal'); assert.equal(state.horde.killsSinceHeal, 0);
});

test('solo pause keeps an accepted return cut but discards its next combo continuation', () => {
  const setup = fixture({ targetType: 'brute', warmTarget: false }), { state, human } = setup;
  const opening = beginCut(setup); assert.equal(opening.profile.comboStep, 1); finishCut(setup);
  const returning = beginCut(setup); assert.equal(returning.profile.comboStep, 2); awaitContact(setup, returning);
  assert.equal(human.meleeComboConfirmed, true); assert.ok(human.meleeTicks > 0);
  const accepted = { ticks: human.meleeTicks, index: human.meleeIndex, profile: meleeProfile(human) };
  Horde.pauseMatch(state); assert.equal(human.meleeComboConfirmed, false); assert.equal(human.meleeComboWindowTicks, 0); assert.equal(meleeProfile(human), accepted.profile);
  const frozen = JSON.stringify(state); advance(state, 1200); assert.equal(JSON.stringify(state), frozen);
  Horde.resumeMatch(state); assert.equal(human.meleeTicks, accepted.ticks); assert.equal(human.meleeIndex, accepted.index); assert.equal(meleeProfile(human), accepted.profile);
  finishCut(setup); const next = beginCut(setup); assert.equal(next.profile.comboStep, 1, 'a fresh deliberate cut starts a new chain after pause');
});
