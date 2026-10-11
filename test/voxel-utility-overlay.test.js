import assert from 'node:assert/strict';
import test from 'node:test';
import { createUtilityOverlay } from '../public/voxel-utility-overlay.js';

test('a paused menu clears a frozen flash or smoke effect and resuming restores the accepted exposure', () => {
  const host = { ownerDocument: { createElement: () => ({ style: {}, setAttribute() {} }) }, appendChild() {} };
  const overlay = createUtilityOverlay(host);
  for (const view of [{ flash: 1, smoke: 0 }, { flash: 0, smoke: .97 }]) {
    overlay.update(view);
    assert.ok(Number(overlay.element.style.opacity) > .9);
    overlay.update(view, { active: false });
    assert.equal(overlay.element.style.opacity, '0', 'menus remain readable while the simulation clock is paused');
    overlay.update(view);
    assert.ok(Number(overlay.element.style.opacity) > .9, 'resuming does not erase authority exposure');
    overlay.update(null);
    assert.equal(overlay.element.style.opacity, '0', 'releasing controls clears effects before a stopped renderer can redraw');
  }
});
