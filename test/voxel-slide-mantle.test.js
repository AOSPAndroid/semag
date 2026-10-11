import assert from 'node:assert/strict';
import test from 'node:test';
import { MANTLE, SLIDE, WORLD, createCombatPlayer, combatStep, emptyInput, findMantleTarget, predictLocalMovement } from '../public/voxel-engine.js';

const open = { id: 'move-open', bounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 }, colliders: [], sites: [] };
// A 1.4 m crate two metres ahead (the player faces -z), too high to jump onto.
const crate = height => ({ id: `crate-${height}`, bounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 }, sites: [],
  colliders: [{ id: 'crate', x: -1, y: 0, z: -4, w: 2, h: height, d: 2, material: 'wood' }] });
const fixture = (arena, weapon = 'vandal') => {
  const players = [createCombatPlayer(0, 1, weapon)];
  return { gameId: 'move-fixture', phase: 'fight', tick: 0, map: arena, mapId: arena.id, players, fighters: players, grenades: [], grenadeId: 0, bolts: [], boltId: 0, events: [], eventId: 0, loot: [], lootId: 0 };
};
const step = (state, controls = {}) => { state.tick++; combatStep(state, [{ ...emptyInput(state.players[0]), ...controls }], state.map); };
const sprintUp = state => { for (let tick = 0; tick < 60; tick++) step(state, { up: true, sprint: true }); };

test('a crouch press at full sprint slides faster than sprinting, low, then fades to a crouch walk', () => {
  const state = fixture(open), player = state.players[0];
  sprintUp(state);
  const sprintSpeed = Math.hypot(player.vx, player.vz);
  assert.ok(player.sprinting);
  step(state, { up: true, sprint: true, crouch: true });
  assert.equal(player.slideTicks, SLIDE.ticks - 1);
  assert.ok(player.crouching, 'sliding keeps the low profile');
  assert.ok(Math.hypot(player.vx, player.vz) > sprintSpeed, 'the slide starts with a boost');
  let ticks = 1;
  while (player.slideTicks > 0 && ticks < 200) { step(state, { crouch: true }); ticks++; }
  assert.equal(ticks, SLIDE.ticks);
  assert.ok(Math.abs(Math.hypot(player.vx, player.vz) - SLIDE.endSpeed) < .2, 'the slide fades to crouch speed');
  assert.ok(player.slideCooldown > 0);
});

test('a slide holds its heading, costs stamina and cannot be chained without a cooldown', () => {
  const state = fixture(open), player = state.players[0];
  sprintUp(state);
  const stamina = player.stamina;
  step(state, { up: true, sprint: true, crouch: true });
  assert.ok(player.stamina <= stamina - SLIDE.stamina + 1e-9);
  for (let tick = 0; tick < 10; tick++) step(state, { crouch: true, right: true, yaw: 1 });
  assert.ok(Math.abs(player.vx) < 1e-9, 'steering keys cannot bend a slide');
  for (let tick = 0; tick < 3; tick++) step(state, {});
  assert.equal(player.slideTicks, 0, 'releasing crouch ends the slide');
  sprintUp(state); sprintUp(state);
  // The cooldown has passed by now; an immediate retry after a fresh slide fails.
  step(state, { up: true, sprint: true, crouch: true }); assert.ok(player.slideTicks > 0);
  step(state, { up: true, sprint: true }); step(state, { up: true, sprint: true, crouch: true });
  assert.equal(player.slideTicks, 0, 'no slide during the cooldown');
});

test('a crouch while walking is an ordinary crouch, not a slide', () => {
  const state = fixture(open), player = state.players[0];
  for (let tick = 0; tick < 60; tick++) step(state, { up: true });
  step(state, { up: true, crouch: true });
  assert.equal(player.slideTicks, 0);
  assert.ok(Math.hypot(player.vx, player.vz) < 5.5);
});

test('jumping out of a slide stands and jumps without keeping the slide boost in the air', () => {
  const state = fixture(open), player = state.players[0];
  sprintUp(state);
  step(state, { up: true, sprint: true, crouch: true });
  step(state, { crouch: true });
  step(state, { crouch: true, jump: true });
  assert.equal(player.slideTicks, 0);
  assert.ok(player.vy > 0, 'the jump fires');
  assert.ok(Math.hypot(player.vx, player.vz) <= 5.6, 'airborne speed returns to normal movement');
});

test('jumping into chest-high cover climbs onto it with the gun lowered', () => {
  const state = fixture(crate(1.4)), player = state.players[0];
  for (let tick = 0; tick < 120 && player.z > -1.67; tick++) step(state, { up: true });
  assert.ok(findMantleTarget(player, state.map), 'the crate is within reach');
  step(state, { up: true, jump: true, fire: true });
  assert.ok(player.mantleTicks > 0);
  let ticks = 1, shots = 0;
  while (player.mantleTicks > 0 && ticks < 100) { step(state, { up: true, fire: !(ticks % 2) }); shots = player.shots; ticks++; }
  assert.equal(ticks, MANTLE.ticks);
  assert.equal(shots, 0, 'no rounds leave the gun during the climb');
  assert.ok(Math.abs(player.y - 1.4) < 1e-9, 'standing on the crate');
  assert.ok(player.z < -2, 'stepped onto the top');
  step(state); assert.ok(player.grounded);
});

test('low crates are jumped as before and walls too tall or without a top cannot be climbed', () => {
  for (const height of [.6, 2.4]) {
    const state = fixture(crate(height)), player = state.players[0];
    for (let tick = 0; tick < 120 && player.z > -1.67; tick++) step(state, { up: true });
    step(state, { up: true, jump: true });
    assert.equal(player.mantleTicks, 0, `${height} m: no climb`);
  }
  // A ceiling over the crate leaves no room to stand.
  const roofed = crate(1.4); roofed.colliders.push({ id: 'roof', x: -1, y: 2.6, z: -4, w: 2, h: .3, d: 2, material: 'wood' });
  const state = fixture(roofed), player = state.players[0];
  for (let tick = 0; tick < 120 && player.z > -1.67; tick++) step(state, { up: true });
  assert.equal(findMantleTarget(player, roofed), null);
});

test('a climb needs forward input and a face toward the ledge', () => {
  const state = fixture(crate(1.4)), player = state.players[0];
  for (let tick = 0; tick < 120 && player.z > -1.67; tick++) step(state, { up: true });
  step(state, { jump: true });
  assert.equal(player.mantleTicks, 0, 'jumping in place does not climb');
  const turned = fixture(crate(1.4)), body = turned.players[0];
  for (let tick = 0; tick < 120 && body.z > -1.67; tick++) step(turned, { up: true });
  assert.equal(findMantleTarget({ ...body, yaw: Math.PI }, turned.map), null, 'facing away finds no ledge');
});

test('client prediction reproduces slides and climbs exactly', () => {
  for (const [arena, script] of [
    [open, tick => tick < 60 ? { up: true, sprint: true } : { up: tick === 60, sprint: tick === 60, crouch: true }],
    [crate(1.4), tick => ({ up: true, jump: tick === 75 })],
  ]) {
    const state = fixture(arena), authority = state.players[0], predicted = structuredClone(authority);
    let moved = false;
    for (let tick = 0; tick < 130; tick++) {
      step(state, script(tick)); moved ||= authority.slideTicks > 0 || authority.mantleTicks > 0;
      predictLocalMovement(predicted, { ...emptyInput(), ...script(tick) }, arena, 1);
      for (const field of ['x', 'y', 'z', 'slideTicks', 'mantleTicks', 'crouching']) assert.ok(Math.abs(Number(predicted[field]) - Number(authority[field])) < 1e-9, `${arena.id} ${field} @${tick}`);
    }
    assert.ok(moved, `${arena.id}: the script really slid or climbed`);
  }
});
