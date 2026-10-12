import assert from 'node:assert/strict';
import test from 'node:test';
import * as Combat from '../public/voxel-engine.js';
import * as Horde from '../public/voxel-horde-engine.js';
import { setInventoryMeleeLoadout, selectInventorySlot } from '../public/voxel-inventory.js';

const arena = { id: 'review-open', bounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 }, colliders: [], sites: [] };
function actor(id, fields, blade) {
  const player = Object.assign(Combat.createCombatPlayer(id, 1, 'carbine'), { hp: 500, maxHp: 500, lifeId: 1 }, fields);
  if (blade) { setInventoryMeleeLoadout(player, blade); selectInventorySlot(player, 0); }
  return player;
}
function fixture(players) { return { gameId: 'review', phase: 'fight', tick: 0, map: arena, players, fighters: players, grenades: [], bolts: [], events: [], eventId: 0, loot: [] }; }
function tick(state, controls = []) {
  state.tick++;
  Combat.combatStep(state, state.players.map((p, i) => ({ ...Combat.emptyInput(p), yaw: p.yaw, pitch: -.1, ...controls[i] })), arena);
}
function sweepFixture() {
  return fixture([actor(0, { z: 0, yaw: 0, team: 0 }, 'sword'), actor(1, { z: -1.7, yaw: Math.PI, team: 1 }, 'sword'), actor(2, { x: 1, z: -2.2, yaw: Math.PI, team: 1 }, 'sword')]);
}
for (const defender of [1, 2]) test(`a parry from player ${defender} stops the entire sword swing, including its sweep`, () => {
  const state = sweepFixture(); tick(state, [{ fire: true }]);
  for (let i = 0; i < 30; i++) { const input = [{}, {}, {}]; input[defender] = { aim: i === 7 }; tick(state, input); }
  assert.ok(state.events.some(e => e.type === 'meleeParry' && e.playerId === defender));
  assert.equal(state.players[1].hp, 500); assert.equal(state.players[2].hp, 500);
  assert.equal(state.events.filter(e => e.type === 'damage').length, 0);
});

test('a held sword guard mitigates sweep damage while an unguarded bystander takes the full sweep', () => {
  function damage(guard) {
    const state = sweepFixture();
    for (let i = 0; i < 50; i++) tick(state, [{}, {}, { aim: guard }]);
    tick(state, [{ fire: true }, {}, { aim: guard }]);
    for (let i = 0; i < 25; i++) tick(state, [{}, {}, { aim: guard }]);
    const hit = state.events.find(e => e.type === 'damage' && e.targetId === 2);
    assert.equal(hit.attack, 'sweep'); return hit.damage;
  }
  assert.ok(damage(true) < damage(false));
});

test('an accepted enemy hit-stun cancels a punch before its contact without refunding its cooldown', () => {
  const state = fixture([actor(0, { z: 0, yaw: 0, team: 0 }), actor(1, { z: -1.1, yaw: Math.PI, team: 1 })]);
  tick(state, [{ punch: true }]);
  Combat.applyCombatDamage(state, [{ playerId: 1, targetId: 0, targetLifeId: 1, damage: 12, attack: 'punch', weapon: 'fist', punchIndex: 1, attackerLifeId: 1 }]);
  assert.ok(state.players[0].hitStunTicks > 0); assert.equal(state.players[0].punchTicks, 0);
  for (let i = 0; i < 8; i++) tick(state);
  assert.equal(state.players[1].hp, 500); assert.ok(state.players[0].punchCooldown > 0);
  assert.equal(state.events.filter(e => e.type === 'punchHit' && e.playerId === 0).length, 0);
});

test('Last Stand fences a punch held across countdown until release and a fresh press', () => {
  const state = Horde.createState({ capacity: 1, seed: 7193 }); Horde.startMatch(state, [0]);
  for (let i = 0, ticks = state.phaseTicks; i < ticks; i++) Horde.step(state, [{ punch: true }]);
  Horde.step(state, [{ punch: true }]); assert.equal(state.players[0].punchTicks, 0);
  Horde.step(state, [{}]); Horde.step(state, [{ punch: true }]);
  assert.equal(state.players[0].punchTicks, Combat.PUNCH.ticks);
});

test('repeated punches prevent a teammate revive, and an uninterrupted channel still succeeds', () => {
  const state = Horde.createState({ capacity: 3, seed: 73291 }); Horde.startMatch(state, [0, 2]);
  for (let i = 0, ticks = state.phaseTicks; i < ticks; i++) Horde.step(state);
  state.map = { ...arena, spawns: Horde.MAPS.courtyard.spawns };
  state.horde.pending = 1; state.horde.nextSpawnTick = 1e9;
  for (const p of state.players) if (p.monster) p.alive = false;
  Object.assign(state.players[0], { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, grounded: true });
  Object.assign(state.players[2], { x: 1, y: 0, z: 0, vx: 0, vy: 0, vz: 0, grounded: true });
  Combat.applyCombatDamage(state, [{ playerId: 3, targetId: 2, damage: state.players[2].hp, attack: 'monster', weapon: 'stalker' }]);
  for (let i = 0; i < Horde.HORDE_RULES.reviveTicks; i++) Horde.step(state, [{ interact: true, punch: i % 80 === 0 }]);
  assert.ok(state.events.some(e => e.type === 'punchStart')); assert.equal(state.players[2].alive, false); assert.equal(state.horde.revives, 0);
  for (let i = 0; i < Horde.HORDE_RULES.reviveTicks + Combat.PUNCH.ticks; i++) Horde.step(state, [{ interact: true }]);
  assert.equal(state.players[2].alive, true); assert.equal(state.horde.revives, 1);
});
