import assert from 'node:assert/strict';
import test from 'node:test';
import { createDojoTrainingLedger } from '../public/voxel-practice-client.js';
import { createPractice, startPractice, stepPractice, pausePractice, resumePractice, getPracticeStats } from '../public/voxel-practice-engine.js';
import { eyeHeight, emptyInput } from '../public/voxel-engine.js';
import { MELEE_WEAPONS } from '../public/voxel-melee.js';

function begin() {
  const state = createPractice({ mode: 'dojo', weapon: 'vandal', bots: 5, seed: 1187 });
  startPractice(state);
  while (state.phase === 'countdown') stepPractice(state);
  return state;
}
function pose(player, x, z) {
  Object.assign(player, { x, y: 0, z, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, previousInput: emptyInput() });
}
function aim(player, target, kind) {
  const dx = target.x - player.x, dz = target.z - player.z;
  return { fire: true, yaw: Math.atan2(dx, -dz), pitch: Math.atan2(target.y + (kind === 'head' ? 1.67 : 1.02) - player.y - eyeHeight(player), Math.hypot(dx, dz)) - player.recoil };
}

test('a dojo report measures real gun and blade contacts without ending combat or inventing a winner', () => {
  const state = begin(), ledger = createDojoTrainingLedger(), player = state.players[0];
  const advance = input => { stepPractice(state, input); ledger.consume(state.events); };
  pose(player, -7, 8);
  advance(aim(player, state.players[1], 'body'));
  for (let tick = 0; tick < 120; tick++) advance({});
  advance(aim(player, state.players[1], 'head'));
  for (let tick = 0; tick < 120; tick++) advance({});
  pose(player, -3, 12); advance({ dojoBlade: 'katana', interact: true });
  pose(player, -7, -.95); advance({ fire: true, yaw: 0, pitch: 0 });
  for (let tick = 0; tick < MELEE_WEAPONS.katana.startupTicks + MELEE_WEAPONS.katana.activeTicks + 3; tick++) advance({});
  assert.ok(state.dojo.headContacts > 0, 'the real gun did not make a head contact');
  assert.ok(state.dojo.bodyContacts > 0, 'the real gun did not make a body contact');
  assert.ok(state.events.some(event => event.type === 'meleeHit' && event.playerId === 0));
  const snapshot = ledger.summarize(state);
  assert.equal(snapshot.result, 'trainingComplete');
  assert.equal(snapshot.strikes, 1); assert.equal(snapshot.landedStrikes, 1);
  assert.ok(snapshot.headDamage > 0); assert.ok(snapshot.bodyDamage > 0);
  assert.equal(snapshot.headContacts, state.dojo.headContacts); assert.equal(snapshot.bodyContacts, state.dojo.bodyContacts);
  assert.equal(snapshot.damageDealt, player.damageDealt);
  assert.equal(snapshot.kills, player.kills); assert.equal(snapshot.elapsedTicks, state.practice.elapsedTicks);
  assert.equal(state.phase, 'fight'); assert.equal(getPracticeStats(state).result, null); assert.equal(state.winner, null);
  pausePractice(state);
  const frozen = JSON.stringify(state);
  for (let tick = 0; tick < 360; tick++) advance({ fire: true, up: true });
  assert.equal(JSON.stringify(state), frozen); assert.deepEqual(ledger.summarize(state), snapshot);
  resumePractice(state); advance({}); advance({});
  assert.equal(state.phase, 'fight'); assert.equal(getPracticeStats(state).result, null);
  assert.ok(state.practice.elapsedTicks > snapshot.elapsedTicks); assert.equal(snapshot.elapsedTicks, snapshot.seconds * 120);
});

test('a repeated event batch and one slash through multiple targets count each committed strike once', () => {
  const ledger = createDojoTrainingLedger(), state = begin();
  const events = [
    { id: 1, type: 'meleeStart', playerId: 0, weapon: 'sword', meleeStartTick: 120, meleeIndex: 1 },
    { id: 2, type: 'meleeHit', playerId: 0, targetId: 1, damage: 50, weapon: 'sword', meleeStartTick: 120, meleeIndex: 1 },
    { id: 3, type: 'damage', playerId: 0, targetId: 1, damage: 50, hitKind: 'body' },
    { id: 4, type: 'meleeHit', playerId: 0, targetId: 2, damage: 50, weapon: 'sword', meleeStartTick: 120, meleeIndex: 1 },
    { id: 5, type: 'damage', playerId: 0, targetId: 2, damage: 50, hitKind: 'body' },
    { id: 6, type: 'meleeStart', playerId: 0, weapon: 'sword', meleeStartTick: 220, meleeIndex: 2 },
    { id: 7, type: 'damage', playerId: 1, targetId: 0, damage: 30, hitKind: 'head' },
  ];
  ledger.consume(events); ledger.consume(events);
  const report = ledger.summarize(state);
  assert.equal(report.strikes, 2); assert.equal(report.landedStrikes, 1);
  assert.equal(report.bodyDamage, 100); assert.equal(report.headDamage, 0);
  assert.equal(report.kills, 0); assert.equal(report.shots, 0); assert.equal(report.result, 'trainingComplete');
  ledger.reset(); ledger.consume([{ id: 1, type: 'damage', playerId: 0, targetId: 1, damage: 33, hitKind: 'head' }]);
  const fresh = ledger.summarize(state);
  assert.equal(fresh.strikes, 0); assert.equal(fresh.landedStrikes, 0); assert.equal(fresh.headDamage, 33); assert.equal(fresh.bodyDamage, 0);
});
