import assert from 'node:assert/strict';
import test from 'node:test';
import { LEAN, createCombatPlayer, combatStep, emptyInput, eyePosition, predictLocalMovement, traceShot } from '../public/voxel-engine.js';
import { controlForKey } from '../public/voxel-client.js';
import { controlForKey as royaleControlForKey } from '../public/voxel-royale-client.js';

const open = { id: 'lean-open', bounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 }, colliders: [], sites: [] };
// A wall to the player's right (+x) ending at z = -1: the player stands behind its corner.
const corner = { id: 'lean-corner', bounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 }, sites: [],
  colliders: [{ id: 'wall', x: .45, y: 0, z: -1, w: 3, h: 3, d: 6, material: 'stone' }] };
// A thin wall in front of the player whose edge ends just right of centre.
const edge = { id: 'lean-edge', bounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 }, sites: [],
  colliders: [{ id: 'cover', x: -5, y: 0, z: -1.5, w: 5.2, h: 3, d: .5, material: 'stone' }] };
const fixture = (arena, players = [createCombatPlayer(0, 1, 'vandal')]) => (
  { gameId: 'lean-fixture', phase: 'fight', tick: 0, map: arena, mapId: arena.id, players, fighters: players, grenades: [], grenadeId: 0, bolts: [], boltId: 0, events: [], eventId: 0, loot: [], lootId: 0 });
const step = (state, controls = [{}]) => { state.tick++; combatStep(state, state.players.map((player, index) => ({ ...emptyInput(player), ...(controls[index] || {}) })), state.map); };

test('holding a lean key eases the head sideways over a short ramp and back', () => {
  const state = fixture(open), player = state.players[0];
  step(state, [{ leanRight: true }]);
  assert.ok(player.lean > 0 && player.lean < 1, 'the lean ramps instead of snapping');
  for (let tick = 0; tick < LEAN.rampTicks; tick++) step(state, [{ leanRight: true }]);
  assert.equal(player.lean, 1);
  assert.ok(Math.abs(player.leanOffset - LEAN.offset) < 1e-9, 'open space allows the full lean');
  // yaw 0 faces -z, so the right-hand side is +x.
  const eye = eyePosition(player);
  assert.ok(Math.abs(eye.x - LEAN.offset) < 1e-9 && Math.abs(eye.z) < 1e-9);
  assert.ok(eye.y < player.y + 1.62, 'the head dips slightly as it leans');
  for (let tick = 0; tick < LEAN.rampTicks; tick++) step(state);
  assert.equal(player.lean, 0); assert.equal(player.leanOffset, 0);
  step(state, [{ leanLeft: true, yaw: Math.PI / 2 }]);
  for (let tick = 0; tick < LEAN.rampTicks; tick++) step(state, [{ leanLeft: true, yaw: Math.PI / 2 }]);
  // Facing +x, the left-hand side is -z.
  assert.ok(Math.abs(eyePosition(player).z + LEAN.offset) < 1e-9);
});

test('a wall stops the lean short so the head never enters cover', () => {
  const state = fixture(corner), player = state.players[0];
  Object.assign(player, { x: 0, z: 1 });
  for (let tick = 0; tick < 30; tick++) step(state, [{ leanRight: true }]);
  assert.equal(player.lean, 1);
  assert.ok(player.leanOffset < LEAN.offset - .15, `wall-limited lean ${player.leanOffset}`);
  assert.ok(eyePosition(player).x + .22 <= .45 + 1e-9, 'the head box stays outside the wall');
});

test('peeking past a wall edge lets your shot reach a target that standing straight cannot', () => {
  // The carbine stops at its first body contact, so the shot reports that target.
  const shooter = createCombatPlayer(0, 1, 'carbine'), target = createCombatPlayer(1, 1, 'carbine');
  Object.assign(target, { x: 1, z: -10, hp: 2000, maxHp: 2000 });
  const state = fixture(edge, [shooter, target]);
  const aim = eye => { const yaw = Math.atan2(target.x - eye.x, -(target.z - eye.z)), pitch = Math.atan2(target.y + 1.2 - eye.y, Math.hypot(target.x - eye.x, target.z - eye.z)); return { yaw, pitch, direction: { x: Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: -Math.cos(yaw) * Math.cos(pitch) } }; };
  const standing = eyePosition(shooter);
  assert.equal(traceShot(state, 0, standing, aim(standing).direction, 40).kind, 'wall', 'standing straight, the wall edge blocks the line');
  for (let tick = 0; tick < 30; tick++) step(state, [{ leanRight: true }]);
  const leaned = eyePosition(shooter), { yaw, pitch } = aim(leaned);
  for (let tick = 0; tick < 4; tick++) step(state, [{ leanRight: true, yaw, pitch }]);
  step(state, [{ leanRight: true, yaw, pitch, fire: true }]);
  const shot = state.events.find(event => event.type === 'shot');
  assert.equal(shot.targetId, 1, 'the leaned shot clears the edge');
  assert.ok(Math.abs(shot.x - eyePosition(shooter).x) < 1e-9, 'rounds leave from the real leaned eye');
});

test('a peeking head is exposed to return fire while the planted legs are not moved', () => {
  const peeker = createCombatPlayer(0, 1, 'vandal'), watcher = createCombatPlayer(1, 1, 'vandal');
  Object.assign(peeker, { x: 0, z: 0 }); Object.assign(watcher, { x: 6, z: 0 });
  const state = fixture(open, [peeker, watcher]);
  const aimAt = point => ({ x: point.x - 6, y: point.y - (watcher.y + 1.62), z: point.z });
  const shoot = point => { const d = aimAt(point), length = Math.hypot(d.x, d.y, d.z); return traceShot(state, 1, { x: 6, y: 1.62, z: 0 }, { x: d.x / length, y: d.y / length, z: d.z / length }, 20); };
  for (let tick = 0; tick < 30; tick++) step(state, [{ leanRight: true }]);
  const head = eyePosition(peeker);
  assert.equal(shoot({ ...head, y: head.y + .05 }).kind, 'head');
  assert.equal(shoot({ x: 0, y: .2, z: 0 }).kind, 'leg');
});

test('sprinting, jumping and holding a blade straighten the lean; leaning slows movement', () => {
  for (const controls of [{ sprint: true, up: true }, { jump: true }]) {
    const state = fixture(open), player = state.players[0];
    for (let tick = 0; tick < 20; tick++) step(state, [{ leanRight: true }]);
    for (let tick = 0; tick < 20; tick++) step(state, [{ leanRight: true, ...controls }]);
    assert.ok(player.lean < 1, JSON.stringify(controls));
  }
  const walking = fixture(open), leaning = fixture(open);
  for (let tick = 0; tick < 90; tick++) { step(walking, [{ up: true }]); step(leaning, [{ up: true, leanLeft: true }]); }
  assert.ok(Math.abs(leaning.players[0].z) < Math.abs(walking.players[0].z) * .9);
});

test('client prediction reproduces the authoritative lean and its wall limit', () => {
  const state = fixture(corner), authority = state.players[0];
  Object.assign(authority, { x: 0, z: 1 });
  const predicted = structuredClone(authority);
  for (let tick = 0; tick < 20; tick++) {
    step(state, [{ leanRight: true, up: tick > 10 }]);
    predictLocalMovement(predicted, { ...emptyInput(), leanRight: true, up: tick > 10 }, corner, 1);
    for (const field of ['lean', 'leanOffset', 'leanX', 'leanZ', 'x', 'z']) assert.ok(Math.abs(predicted[field] - authority[field]) < 1e-9, `${field} @${tick}`);
  }
});

test('Q and E lean; F interacts, H heals and G throws in every voxel client', () => {
  for (const control of [controlForKey, royaleControlForKey]) {
    const key = letter => control({ key: letter, code: `Key${letter.toUpperCase()}` }, 'wasd');
    assert.equal(key('q'), 'leanLeft'); assert.equal(key('e'), 'leanRight');
    assert.equal(key('f'), 'interact'); assert.equal(key('h'), 'heal'); assert.equal(key('g'), 'grenade');
  }
});
