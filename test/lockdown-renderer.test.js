import test from 'node:test';
import assert from 'node:assert/strict';
import { LockdownRenderer } from '../public/lockdown-renderer.js';
import { MAPS, RULES } from '../public/lockdown-engine.js';

function view() {
  const draws = [], stack = [], ctx = {
    globalAlpha: 1,
    save() { stack.push(this.globalAlpha); },
    restore() { this.globalAlpha = stack.pop(); },
    drawImage() { draws.push(this.globalAlpha); },
  };
  return { scene: new LockdownRenderer({ getContext: () => ctx }, null), ctx, draws };
}
const wall = { row: 2, canvas: {}, spans: [{ start: 1, end: 2 }] };
const courtyard = { cols: 3, rows: 4, twoFloors: false, grid: ['...', '...', '.#.', '...'], levels: ['000', '000', '000', '000'] };

test('foreground walls fade across the full roof footprint, so nearby knight feet remain visible', () => {
  const { scene, ctx, draws } = view();
  // The roof of this tall wall reaches two rows north of its front edge.
  scene.drawWallRow(ctx, wall, courtyard, [{ x: 72, y: 24 }]);
  assert.ok(draws.pop() < 1, 'the roof over the knight must become translucent');
  for (const player of [{ x: 200, y: 24 }, { x: 72, y: -24 }, { x: 72, y: 160 }]) {
    scene.drawWallRow(ctx, wall, courtyard, [player]);
    assert.equal(draws.pop(), 1, 'architecture outside the knight silhouette stays opaque');
  }
  assert.equal(ctx.globalAlpha, 1, 'wall fading must not tint later actors');
});

test('wall visibility accounts for the raised floor in the projected image', () => {
  const { scene, ctx, draws } = view();
  const raisedWall = { ...courtyard, twoFloors: true, levels: ['000', '000', '010', '000'] };
  scene.drawWallRow(ctx, wall, raisedWall, [{ x: 72, y: -24 }]);
  assert.ok(draws.pop() < 1, 'the taller roof must fade when it overlaps the knight');
  const raisedPlayer = { ...courtyard, twoFloors: true, levels: ['010', '000', '000', '000'] };
  scene.drawWallRow(ctx, wall, raisedPlayer, [{ x: 72, y: 0 }]);
  assert.equal(draws.pop(), 1, 'a knight above the roof does not fade the lower wall');
});

test('every arena has two healing alcoves, six hearts and clear capture courts without changing the map', () => {
  const { scene } = view(), before = JSON.stringify(MAPS);
  for (const map of Object.values(MAPS)) {
    const art = scene.mapDecorations(map);
    assert.equal(art.filter(a => a.key === 'base_alcove').length, 2, map.id);
    assert.equal(art.filter(a => a.key === 'base_heal_station').length, 6, map.id);
    for (const clump of art.filter(a => a.key.startsWith('prop_border_'))) {
      assert.ok(map.points.every(p => Math.hypot(p.x - clump.x, p.y - clump.y) >= RULES.pointRadius + 86), `${map.id}: border clump intrudes on a capture court`);
    }
  }
  assert.equal(JSON.stringify(MAPS), before);
});

test('health bars are drawn for allies but never for enemies', () => {
  const rects = [], noop = () => {};
  const ctx = { fillRect: (x, y, w) => rects.push(w), fillText: noop, beginPath: noop, arc: noop, fill: noop, stroke: noop };
  const scene = new LockdownRenderer({ getContext: () => ctx }, null);
  const knight = { x: 100, y: 100, team: 1, hp: 50, maxHp: 100, name: 'Bot', status: {} };
  scene.drawKnightOverlay(ctx, knight, 0, false, true);
  assert.ok(rects.includes(38), 'an ally shows a health bar');
  rects.length = 0;
  scene.drawKnightOverlay(ctx, knight, 0, false, false);
  assert.deepEqual(rects, [], 'an enemy shows no health bar');
});
