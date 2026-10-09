import test from 'node:test';
import assert from 'node:assert/strict';
import { createCombatPlayer, emptyInput, predictLocalMovement } from '../public/voxel-engine.js';
import { createMovementPresenter, projectedMovement } from '../public/voxel-presentation.js';

const arena = { bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 }, colliders: [] };
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test('a newly received melee shove invalidates the same actor cached sub-tick pose immediately', () => {
  const actor = createCombatPlayer(0), buttons = emptyInput(), peers = [];
  const present = createMovementPresenter(), original = structuredClone(actor);
  present(actor, buttons, arena, 1 / 240, predictLocalMovement, peers);
  assert.deepEqual(actor, original);
  Object.assign(actor, { knockbackX: 7, knockbackZ: -4, knockbackTicks: 36, knockbackReadyTicks: 18 });
  const received = structuredClone(actor), next = structuredClone(actor);
  predictLocalMovement(next, buttons, arena, 1, peers);
  const view = present(actor, buttons, arena, 1 / 240, predictLocalMovement, peers);
  assert.ok(view.x > actor.x && view.z < actor.z, 'the first display frame already follows the actual shove');
  near(view.x, (actor.x + next.x) / 2); near(view.z, (actor.z + next.z) / 2);
  assert.deepEqual(actor, received, 'presentation never decays authoritative impulse');
  actor.knockbackTicks = 0;
  const stopped = present(actor, buttons, arena, 1 / 240, predictLocalMovement, peers);
  near(stopped.x, actor.x); near(stopped.z, actor.z);
});

test('remote continuation carries decayed shove and rehit guard instead of restoring stale impulse', () => {
  const actor = { ...createCombatPlayer(0), knockbackX: 7, knockbackZ: -4, knockbackTicks: 36, knockbackReadyTicks: 18 };
  const buttons = emptyInput(), peers = [], received = structuredClone(actor);
  const expected = structuredClone(actor); predictLocalMovement(expected, buttons, arena, 3, peers);
  const view = projectedMovement(actor, buttons, arena, 25, predictLocalMovement, peers);
  for (const field of ['x', 'z', 'knockbackX', 'knockbackZ', 'knockbackTicks', 'knockbackReadyTicks']) near(view[field], expected[field]);
  assert.deepEqual(actor, received);
  actor.knockbackX = -7; actor.knockbackZ = 4;
  const changed = structuredClone(actor); predictLocalMovement(changed, buttons, arena, 3, peers);
  const updated = projectedMovement(actor, buttons, arena, 25, predictLocalMovement, peers);
  near(updated.x, changed.x); near(updated.z, changed.z);
  assert.ok(updated.x < actor.x && updated.z > actor.z, 'new impulse direction replaces the cached received path');
});
