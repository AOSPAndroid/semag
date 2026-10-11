import assert from 'node:assert/strict';
import test from 'node:test';
import { MOVEMENT, createCombatPlayer, combatStep, emptyInput, predictLocalMovement } from '../public/voxel-engine.js';
import { crosshairPresentation } from '../public/voxel-crosshair.js';

const arena = { id: 'strafe-range', bounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 }, colliders: [], sites: [] };
const fixture = weapon => {
  const players = [createCombatPlayer(0, 1, weapon)];
  return { gameId: 'strafe-fixture', phase: 'fight', tick: 0, map: arena, mapId: arena.id, players, fighters: players, grenades: [], grenadeId: 0, bolts: [], boltId: 0, events: [], eventId: 0, loot: [], lootId: 0 };
};
const step = (state, controls = {}) => { state.tick++; combatStep(state, [{ ...emptyInput(state.players[0]), ...controls }], arena); };
const speed = player => Math.hypot(player.vx, player.vz);
const STEADY = .22;
const ticksToSteady = (weapon, controls) => {
  const state = fixture(weapon), player = state.players[0];
  for (let tick = 0; tick < 60; tick++) step(state, { right: true });
  assert.ok(speed(player) > 5, 'full strafe speed');
  let ticks = 0;
  while (speed(player) > STEADY && ticks < 60) { step(state, controls); ticks++; }
  return { ticks, state, player };
};

test('tapping the opposite key settles faster than releasing the keys', () => {
  for (const weapon of ['vandal', 'phantom', 'sheriff', 'carbine', 'classic', 'spectre', 'odin', 'operator']) {
    const coast = ticksToSteady(weapon, {}), counter = ticksToSteady(weapon, { left: true });
    assert.ok(counter.ticks <= coast.ticks * .6, `${weapon}: counter ${counter.ticks} vs coast ${coast.ticks} ticks`);
    assert.ok(counter.ticks <= 7, `${weapon}: a counter-strafe settles within about 60 ms`);
  }
});

test('a held counter key brakes to a full stop instead of overshooting into the other direction', () => {
  for (const weapon of ['vandal', 'classic', 'spectre']) {
    const state = fixture(weapon), player = state.players[0];
    for (let tick = 0; tick < 60; tick++) step(state, { right: true });
    const speeds = [];
    for (let tick = 0; tick < 12; tick++) { step(state, { left: true }); speeds.push(player.vx); }
    assert.ok(speeds.includes(0), `${weapon}: the brake reaches an exact stop`);
    assert.ok(speeds.slice(0, speeds.indexOf(0)).every(vx => vx > 0), `${weapon}: no reversal before the stop`);
  }
});

test('the brake only applies against momentum: holding the opposite key then accelerates normally', () => {
  const { state, player } = ticksToSteady('vandal', { left: true });
  const before = player.vx;
  step(state, { left: true });
  const gained = Math.abs(player.vx - before);
  assert.ok(gained < MOVEMENT.counterStrafeAccel / 120, 'reversal acceleration is the ordinary rate');
  assert.ok(gained > 0);
});

test('a shot fired on the settled tick is as accurate as one fired standing still', () => {
  const { state, player } = ticksToSteady('vandal', { left: true });
  const settled = crosshairPresentation(player).angularSpread;
  const still = crosshairPresentation(fixture('vandal').players[0]).angularSpread;
  assert.ok(Math.abs(settled - still) < 1e-9, `settled ${settled} vs still ${still}`);
  step(state, { fire: true });
  assert.equal(player.shots, 1);
});

test('client prediction applies the same counter-strafe brake as authority', () => {
  const state = fixture('vandal'), authority = state.players[0];
  for (let tick = 0; tick < 60; tick++) step(state, { right: true });
  const predicted = structuredClone(authority);
  for (let tick = 0; tick < 6; tick++) {
    step(state, { left: true });
    predictLocalMovement(predicted, { ...emptyInput(), left: true }, arena, 1);
    assert.ok(Math.abs(predicted.vx - authority.vx) < 1e-9, `tick ${tick}`);
    assert.ok(Math.abs(predicted.x - authority.x) < 1e-9);
  }
});
