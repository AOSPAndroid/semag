import assert from 'node:assert/strict';
import test from 'node:test';
import { createCombatPlayer, combatStep, emptyInput } from '../public/voxel-engine.js';
import { clearMeleeComboContinuation, heavyChargeTicks } from '../public/voxel-melee.js';
import { selectInventorySlot, setInventoryMeleeLoadout } from '../public/voxel-inventory.js';

const map = { id: 'import-blade-open', bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 }, colliders: [], sites: [] };
function fixture() {
  const players = [createCombatPlayer(0), createCombatPlayer(1)];
  for (const player of players) { setInventoryMeleeLoadout(player, 'sword'); selectInventorySlot(player, 0); }
  players[1].z = -1.7;
  return { gameId: 'import-blade', phase: 'fight', tick: 0, map, mapId: map.id, players, fighters: players, grenades: [], bolts: [], events: [], eventId: 0, loot: [] };
}
function step(state, fields = {}) { state.tick++; combatStep(state, state.players.map((p, id) => ({ ...emptyInput(p), pitch: -.15, ...(id === 0 ? fields : {}) })), map); }
function charge(state) { for (let tick = 0; tick <= heavyChargeTicks(state.players[0]); tick++) step(state, { fire: true }); }
const heavyStarts = state => state.events.filter(e => e.type === 'meleeStart' && e.heavy === true);

test('a physical trigger release still starts the charged heavy cut', () => {
  const state = fixture(); charge(state); step(state);
  assert.equal(heavyStarts(state).length, 1);
});

test('a controls cancellation cannot synthesize a heavy release from an armed blade', () => {
  const state = fixture(); charge(state); const player = state.players[0];
  assert.ok(player.heavyChargeTicks >= heavyChargeTicks(player));
  clearMeleeComboContinuation(player); step(state);
  assert.equal(heavyStarts(state).length, 0);
  assert.equal(player.heavyChargeTicks, 0);
});

test('interacting instead of firing cancels the armed heavy attack before release processing', () => {
  const state = fixture(); charge(state); step(state, { interact: true });
  assert.equal(heavyStarts(state).length, 0);
});

test('interaction also cancels an armed charge after the initial light cut missed', () => {
  const state = fixture(); state.players[1].z = -12; charge(state);
  for (let tick = 0; tick < 100 && state.players[0].meleeComboWindowTicks > 0; tick++) step(state, { fire: true });
  assert.equal(state.players[0].damageDealt, 0);
  assert.equal(state.players[0].meleeComboWindowTicks, 0);
  step(state, { interact: true });
  assert.equal(heavyStarts(state).length, 0);
});

test('clearing unaccepted charge preserves an already committed heavy cut and its recovery', () => {
  const state = fixture(); charge(state); step(state); const player = state.players[0];
  const accepted = { ticks: player.meleeTicks, cooldown: player.meleeCooldown, style: player.meleeStyle, stamina: player.stamina, inventory: structuredClone(player.inventory) };
  assert.equal(accepted.style, 'heavy'); assert.ok(accepted.ticks > 0);
  clearMeleeComboContinuation(player);
  assert.deepEqual({ ticks: player.meleeTicks, cooldown: player.meleeCooldown, style: player.meleeStyle, stamina: player.stamina, inventory: player.inventory }, accepted);
  step(state); assert.equal(heavyStarts(state).length, 1);
});
