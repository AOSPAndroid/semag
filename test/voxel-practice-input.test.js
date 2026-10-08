import assert from 'node:assert/strict';
import test from 'node:test';
import { createPracticeInputQueue } from '../public/voxel-practice-input.js';
import { createPractice, startPractice, stepPractice, pausePractice, resumePractice } from '../public/voxel-practice-engine.js';
import { applyCombatDamage } from '../public/voxel-engine.js';
import { WEAPONS } from '../public/voxel-weapons.js';

function fight(options = {}) {
  const state = createPractice({ bots: 1, mode: 'targets', seed: 65219, ...options });
  startPractice(state);
  while (state.phase === 'countdown') stepPractice(state);
  assert.equal(state.phase, 'fight');
  return state;
}
function shortPress(queue, action) { queue.press(action); queue.release(action); }
function tick(state, queue, held = {}) { const input = queue.sample(held); stepPractice(state, input); return input; }

test('a semi-auto press released before any frame waits for real physics and fires once', () => {
  const state = fight({ weapon: 'pistol' }), queue = createPracticeInputQueue(), player = state.players[0];
  const before = state.tick;
  shortPress(queue, 'fire');
  assert.equal(state.tick, before, 'input events must never advance simulation');
  assert.equal(player.shots, 0);
  tick(state, queue);
  assert.equal(player.shots, 1); assert.equal(player.ammo, WEAPONS.pistol.magazine - 1);
  for (let index = 0; index < WEAPONS.pistol.cooldown + 3; index++) tick(state, queue);
  assert.equal(player.shots, 1, 'one tap must not repeat after weapon recovery');
  shortPress(queue, 'fire'); tick(state, queue);
  assert.equal(player.shots, 2);
});

test('two rapid blade taps retain a release edge and both affect the real equipment', () => {
  const state = fight(), queue = createPracticeInputQueue(), player = state.players[0];
  shortPress(queue, 'swap'); shortPress(queue, 'swap');
  assert.equal(tick(state, queue).swap, true); assert.equal(player.slot, 'sword');
  assert.equal(tick(state, queue).swap, false); assert.equal(player.slot, 'sword');
  assert.equal(tick(state, queue).swap, true); assert.equal(player.slot, 'primary');
  tick(state, queue); assert.equal(player.slot, 'primary');
});

test('rapid utility taps trigger the actual reload, grenade and healing commitments', () => {
  const reload = fight(), reloadQueue = createPracticeInputQueue();
  shortPress(reloadQueue, 'fire'); tick(reload, reloadQueue); tick(reload, reloadQueue);
  shortPress(reloadQueue, 'reload'); tick(reload, reloadQueue);
  assert.ok(reload.players[0].reloadTicks > 0);
  const grenade = fight(), grenadeQueue = createPracticeInputQueue();
  shortPress(grenadeQueue, 'grenade'); tick(grenade, grenadeQueue);
  assert.equal(grenade.players[0].grenades, 0); assert.equal(grenade.grenades.length, 1);
  assert.ok(grenade.players[0].grenadeThrowTicks > 0);
  const heal = fight(), healQueue = createPracticeInputQueue();
  applyCombatDamage(heal, [{ playerId: 1, targetId: 0, damage: 75, weapon: 'carbine', attack: 'gun' }]);
  shortPress(healQueue, 'heal'); tick(heal, healQueue);
  assert.equal(heal.players[0].potions, 0); assert.ok(heal.players[0].healTicks > 0);
});

test('a rapid jump reaches real movement once while ordinary movement remains held', () => {
  const state = fight(), queue = createPracticeInputQueue(), player = state.players[0], start = { ...player };
  shortPress(queue, 'jump');
  for (let index = 0; index < 8; index++) tick(state, queue, { up: true, yaw: 0, pitch: .2 });
  assert.ok(player.y > 0); assert.ok(player.z < start.z);
  assert.equal(player.yaw, 0); assert.equal(player.pitch, .2);
  assert.equal(queue.inspect().jump, 0);
});

test('held auto fire and ADS stay continuous after the first queued press', () => {
  const state = fight(), queue = createPracticeInputQueue(), player = state.players[0];
  queue.press('fire');
  for (let index = 0; index < 36; index++) {
    const input = tick(state, queue, { fire: true, aim: true, up: true });
    assert.equal(input.fire, true); assert.equal(input.aim, true); assert.equal(input.up, true);
  }
  assert.ok(player.shots >= 3); assert.equal(player.aimTicks, 18);
});

test('reset cancels pending taps and held countdown actions require a genuine release', () => {
  const state = fight(), queue = createPracticeInputQueue();
  shortPress(queue, 'fire'); shortPress(queue, 'grenade');
  queue.reset({ held: { fire: true, jump: true } });
  assert.equal(queue.preview({ jump: true, up: true }).jump, false);
  assert.equal(queue.preview({ jump: true, up: true }).up, true);
  for (let index = 0; index < 3; index++) tick(state, queue, { fire: true, jump: true });
  assert.equal(state.players[0].shots, 0); assert.equal(state.players[0].grenades, 1); assert.equal(state.players[0].y, 0);
  queue.release('fire'); shortPress(queue, 'fire'); tick(state, queue);
  assert.equal(state.players[0].shots, 1); assert.equal(state.players[0].y, 0);
});

test('render previews neither consume queued presses nor project a blocked countdown jump', () => {
  const state = fight(), queue = createPracticeInputQueue();
  shortPress(queue, 'jump'); shortPress(queue, 'fire');
  const before = queue.inspect();
  for (const hz of [60, 120, 144, 240]) for (let index = 0; index < hz; index++) queue.preview({ up: true, yaw: .4 });
  assert.deepEqual(queue.inspect(), before); assert.equal(state.players[0].shots, 0);
  tick(state, queue); assert.equal(state.players[0].shots, 1); assert.ok(state.players[0].y > 0);
  queue.reset({ held: { jump: true } });
  assert.equal(queue.preview({ jump: true }).jump, false);
  queue.release('jump'); assert.equal(queue.preview({ jump: true }).jump, true);
});

test('pause cancels queued actions and resume primes the real engine fence before a fresh tap', () => {
  const state = fight(), queue = createPracticeInputQueue(), player = state.players[0];
  shortPress(queue, 'fire'); shortPress(queue, 'swap');
  pausePractice(state); queue.reset();
  const frozen = state.tick; tick(state, queue); assert.equal(state.tick, frozen);
  resumePractice(state); queue.reset({ neutral: true }); shortPress(queue, 'fire');
  tick(state, queue); assert.equal(player.shots, 0); assert.equal(player.slot, 'primary');
  tick(state, queue); assert.equal(player.shots, 1); assert.equal(player.slot, 'primary');
});

test('a short Royale interact tap acquires an authored weapon through the actual loot rule', () => {
  const state = fight({ game: 'voxel-royale', mapId: 'forest' }), queue = createPracticeInputQueue();
  const loot = state.loot.find(item => item.kind === 'weapon' && item.y === 0);
  assert.ok(loot); Object.assign(state.players[0], { x: loot.x, y: loot.y, z: loot.z });
  shortPress(queue, 'interact'); tick(state, queue);
  assert.equal(state.players[0].hasGun, true);
  assert.ok(state.events.some(event => event.type === 'lootPickup' && event.playerId === 0));
});
