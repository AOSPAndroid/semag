import assert from 'node:assert/strict';
import test from 'node:test';
import { applyCombatDamage, emptyInput } from '../public/voxel-engine.js';
import * as Practice from '../public/voxel-practice-engine.js';
import * as Royale from '../public/voxel-royale-engine.js';

const arena = { id: 'melee-lifecycle-fixture', bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 }, colliders: [], sites: [] };
const cleared = player => {
  assert.deepEqual([player.knockbackX, player.knockbackZ, player.knockbackTicks, player.knockbackReadyTicks], [0, 0, 0, 0]);
  assert.equal(player.meleeTicks, 0); assert.equal(player.meleePhase, 'idle');
  assert.deepEqual(player.meleeHitIds, []); assert.deepEqual(player.meleeHitLives, []); assert.equal(player.meleeStartTick, 0);
};

test('a timed-out practice drill clears a real accepted shove and blade commitment before freezing', () => {
  const state = Practice.createPractice({ bots: 1, mode: 'targets', seed: 537 }); Practice.startPractice(state);
  while (state.phase === 'countdown') Practice.stepPractice(state);
  state.map = arena; const [human, bot] = state.players;
  Object.assign(human, { x: 0, y: 0, z: 4 }); Object.assign(bot, { x: 0, y: 0, z: -4 });
  Practice.stepPractice(state, { slot1: true }); Practice.stepPractice(state);
  applyCombatDamage(state, [{ playerId: human.id, targetId: bot.id, damage: 1, attack: 'sword', weapon: 'sword' }]);
  assert.ok(bot.knockbackTicks > 0); state.roundTicks = 1;
  Practice.stepPractice(state, { fire: true }); assert.ok(state.events.some(event => event.type === 'meleeStart'));
  assert.equal(state.phase, 'matchEnd'); assert.equal(state.practice.result, 'timeout');
  for (const player of state.players) cleared(player);
  const finished = JSON.stringify(state); Practice.stepPractice(state, { up: true, fire: true }); assert.equal(JSON.stringify(state), finished);
  Practice.startPractice(state); for (const player of state.players) cleared(player);
});

test('the last Royale survivor loses every transient shove field and swing identity on round finish and rematch', () => {
  const state = Royale.createState({ seed: 921 }); Royale.startMatch(state, [0, 1, 2]);
  while (state.phase === 'countdown') Royale.step(state, state.players.map(emptyInput));
  state.map = arena; state.loot = [];
  for (const player of state.players) if (player.alive) Object.assign(player, { x: player.id * 4, y: 0, z: 0 });
  const inputs = state.players.map(emptyInput); inputs[0].fire = true; Royale.step(state, inputs);
  assert.ok(state.players[0].meleeTicks > 0);
  applyCombatDamage(state, [{ playerId: 1, targetId: 0, damage: 1, attack: 'knife', weapon: 'knife' }]);
  assert.ok(state.players[0].knockbackTicks > 0);
  applyCombatDamage(state, [1, 2].map(targetId => ({ playerId: 0, targetId, damage: 200, attack: 'gun', weapon: 'carbine' })));
  Royale.step(state, state.players.map(emptyInput)); assert.equal(state.phase, 'matchEnd'); assert.equal(state.winnerId, 0);
  for (const player of state.players) cleared(player);
  state.map = Royale.MAPS[state.mapId];
  Royale.startMatch(state, [0, 1, 2]); for (const player of state.players) cleared(player);
});
