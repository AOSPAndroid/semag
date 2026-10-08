import test from 'node:test';
import assert from 'node:assert/strict';
import { createCombatPlayer, emptyInput, predictLocalMovement, WEAPONS } from '../public/voxel-engine.js';
import { interpolatedState as breachState } from '../public/voxel-client.js';
import { interpolatedState as royaleState } from '../public/voxel-royale-client.js';

const map = { id: 'received-corner', bounds: { minX: -30, maxX: 30, minZ: -30, maxZ: 30 }, colliders: [{ x: 0, y: 0, z: 0, w: 3, h: 4, d: 3 }] };
const held = { ...emptyInput({ yaw: 2.8 }), up: true };
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} versus ${b}`);
function recordedMovement() {
  const player = { ...createCombatPlayer(1), x: -.5, z: .6, yaw: 2.8, previousInput: { ...held } }, poses = [];
  for (let tick = 0; tick <= 80; tick++) { poses.push(structuredClone(player)); predictLocalMovement(player, held, map); }
  const samples = [];
  for (let tick = 0; tick <= 80; tick += 4) samples.push({ time: tick * 1000 / 120, state: { phase: 'fight', mapId: map.id, map, tick, round: 1, matchId: 1, players: [{ ...createCombatPlayer(0), x: -20, z: -20 }, poses[tick]], bolts: [] } });
  return { samples, poses };
}

for (const [name, interpolate] of [['Breach', breachState], ['Royale', royaleState]]) for (const hz of [60, 120, 144, 240]) {
  test(`${name} ${hz} Hz received corner movement follows verified swept ticks without snapshot speed bursts`, () => {
    const { samples, poses } = recordedMovement(), before = structuredClone(samples); let previous;
    for (let frame = 0; frame <= Math.floor(hz * .65); frame++) {
      const now = frame * 1000 / hz, player = interpolate(samples, now, 0, { predictMovement: predictLocalMovement }).players[1];
      if (previous) assert.ok(Math.hypot(player.x - previous.x, player.z - previous.z) <= WEAPONS.carbine.speed / hz + 1e-6, 'a received anchor never creates a movement speed burst');
      const nearestX = Math.max(0, Math.min(3, player.x)), nearestZ = Math.max(0, Math.min(3, player.z));
      assert.ok(Math.hypot(player.x - nearestX, player.z - nearestZ) >= player.radius - 1e-7, 'fractional trajectory remains outside cover');
      if (Math.abs(now * 120 / 1000 - Math.round(now * 120 / 1000)) < 1e-7) {
        const exact = poses[Math.round(now * 120 / 1000)]; near(player.x, exact.x); near(player.z, exact.z);
      }
      previous = player;
    }
    assert.deepEqual(samples, before, 'trajectory verification and display never change received snapshots');
  });
}

test('verified bracket paths cache bounded physics work and preserve newest combat values', () => {
  const { samples } = recordedMovement(); let ticks = 0;
  const predict = (...args) => { ticks += args[3]; return predictLocalMovement(...args); };
  const bracket = samples.slice(17, 19); bracket[1].state.players[1].hp = 41; bracket[1].state.players[1].ammo = 3;
  for (const ratio of [.1, .2, .4, .8]) {
    const view = breachState(bracket, bracket[0].time + (bracket[1].time - bracket[0].time) * ratio, 0, { predictMovement: predict }).players[1];
    assert.equal(view.hp, 41); assert.equal(view.ammo, 3);
  }
  assert.equal(ticks, 4, 'each verified received bracket replays at most its four real physics ticks once');
});

test('unchanged straight ground motion needs no extra endpoint verification physics', () => {
  const { samples } = recordedMovement(), bracket = samples.slice(12, 14); let ticks = 0;
  const predict = (...args) => { ticks += args[3]; return predictLocalMovement(...args); };
  for (const ratio of [.1, .4, .8]) breachState(bracket, bracket[0].time + (bracket[1].time - bracket[0].time) * ratio, 0, { predictMovement: predict });
  assert.equal(ticks, 0);
});

test('changed inputs, unverified endpoints and long brackets retain conservative cover sweeps', () => {
  const { samples } = recordedMovement();
  for (const kind of ['input', 'endpoint', 'long']) {
    const bracket = structuredClone(samples.slice(12, 14));
    if (kind === 'input') bracket[1].state.players[1].previousInput.up = false;
    if (kind === 'endpoint') bracket[1].state.players[1].x -= .2;
    if (kind === 'long') bracket[1].time = bracket[0].time + 100;
    let ticks = 0; const predict = (...args) => { ticks += args[3]; return predictLocalMovement(...args); };
    const view = breachState(bracket, (bracket[0].time + bracket[1].time) / 2, 0, { predictMovement: predict }).players[1];
    assert.ok(Number.isFinite(view.x) && Number.isFinite(view.z));
    const nearestX = Math.max(0, Math.min(3, view.x)), nearestZ = Math.max(0, Math.min(3, view.z));
    assert.ok(Math.hypot(view.x - nearestX, view.z - nearestZ) >= view.radius - 1e-7);
    assert.equal(ticks, kind === 'endpoint' ? 4 : 0, 'only short matching-input brackets attempt a bounded verification');
  }
});

test('changing a reused received endpoint invalidates its verified trajectory cache', () => {
  const { samples } = recordedMovement(), bracket = samples.slice(12, 14), time = (bracket[0].time + bracket[1].time) / 2;
  breachState(bracket, time, 0, { predictMovement: predictLocalMovement });
  bracket[1].state.players[1].x -= .2;
  const corrected = breachState(bracket, time, 0, { predictMovement: predictLocalMovement }).players[1];
  const conservative = breachState(bracket, time, 0).players[1];
  near(corrected.x, conservative.x); near(corrected.z, conservative.z);
});
