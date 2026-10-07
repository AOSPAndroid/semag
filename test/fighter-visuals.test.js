import assert from 'node:assert/strict';
import test from 'node:test';
import { MOVES } from '../public/engine.js';
import { ArenaRenderer } from '../public/renderer.js';

test('Afterimage shows its forward blade and swing trail when damage first becomes active', () => {
  for (const action of ['light', 'heavy']) {
    const move = MOVES[action];
    const pose = ArenaRenderer.prototype.pose.call({ reducedMotion: { matches: true } },
      { id: 0, action, actionFrame: move.startup, y: 470 }, 0);
    const tip = pose.frontHand[0] + Math.cos(pose.sword) * pose.swordLength;
    assert.ok(tip >= move.reach - 12, `${action} blade should visibly reach the forward contact area`);
    assert.ok(pose.trail, `${action} should show its swept arc on the first damaging frame`);
  }
});
