import test from 'node:test';
import assert from 'node:assert/strict';
import { mountVoxelLabelOverlay, VOXEL_LABEL_LIMIT } from '../public/voxel-label-overlay.js';

class Target {
  listeners = new Map();
  addEventListener(name, callback) { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name).add(callback); }
  removeEventListener(name, callback) { this.listeners.get(name)?.delete(callback); }
  dispatch(name) { for (const callback of this.listeners.get(name) || []) callback(); }
}
class Element extends Target {
  constructor(document, tagName) {
    super(); this.ownerDocument = document; this.tagName = tagName; this.children = []; this.dataset = {}; this.attributes = {}; this.hidden = false; this.style = {}; this.textContent = ''; this.parentElement = null;
  }
  get nextSibling() { return this.parentElement?.children[this.parentElement.children.indexOf(this) + 1] || null; }
  insertBefore(child, next) {
    this.ownerDocument.mutations++; child.remove(); child.parentElement = this;
    const index = this.children.indexOf(next); this.children.splice(index < 0 ? this.children.length : index, 0, child);
  }
  append(...children) { for (const child of children) this.insertBefore(child, null); }
  remove() { if (this.parentElement) { this.ownerDocument.mutations++; const siblings = this.parentElement.children; siblings.splice(siblings.indexOf(this), 1); this.parentElement = null; } }
  setAttribute(name, value) { this.attributes[name] = value; }
  getBoundingClientRect() { throw new Error('World marker painting must not read layout.'); }
  get clientWidth() { throw new Error('World marker painting must not read layout.'); }
  get clientHeight() { throw new Error('World marker painting must not read layout.'); }
  set innerHTML(_) { throw new Error('Player names must never parse HTML.'); }
}
function fixture() {
  const document = new Target(); document.hidden = false; document.mutations = 0; document.created = 0;
  document.createElement = tag => { document.created++; return new Element(document, tag); };
  const viewport = document.createElement('div'), canvas = document.createElement('canvas'), scope = document.createElement('div'), menu = document.createElement('div');
  viewport.append(canvas, scope, menu); const overlay = mountVoxelLabelOverlay(canvas), layer = viewport.children[1];
  return { document, viewport, canvas, scope, menu, overlay, layer };
}
const teammate = (id = 1, extra = {}) => ({ key: `ally:${id}:2`, id, lifeId: 2, kind: 'teammate', name: 'Éloïse', x: .5, y: .4, ...extra });
const monster = (id = 3, extra = {}) => ({ key: `monster:${id}:8`, id, lifeId: 8, kind: 'monster', hp: 45, maxHp: 45, x: .7, y: .55, ...extra });
const shown = layer => layer.hidden ? [] : layer.children.filter(node => !node.hidden);

test('world markers mount inside the exact viewport beneath existing scope and menu siblings', () => {
  const { viewport, canvas, scope, menu, overlay, layer } = fixture();
  assert.deepEqual(viewport.children, [canvas, layer, scope, menu]); assert.equal(layer.attributes['aria-hidden'], 'true');
  assert.equal(layer.hidden, true); assert.deepEqual(overlay.inspect(), { visible: [], poolSize: 0, destroyed: false });
  assert.throws(() => mountVoxelLabelOverlay(null), /mounted game canvas/);
});

test('French and HTML-looking player names remain literal safe text without clipping their stored identity', () => {
  const { layer, overlay } = fixture(), name = 'Éloïse ＆ François <img src=x onerror=alert(1)> 🥷';
  overlay.paint([teammate(1, { name })]);
  const node = shown(layer)[0]; assert.equal(node.children[0].textContent, name); assert.equal(node.children[0].hidden, false);
  assert.equal(node.children[1].hidden, true); assert.equal(node.dataset.voxelLabel, 'teammate');
  assert.equal(overlay.inspect().visible[0].name, name);
  overlay.paint([teammate(1, { name: '' })]); assert.equal(node.children[0].textContent, 'Player 2');
});

test('monster bars track actual per-species maximum health and accepted damage without numeric clutter', () => {
  const { layer, overlay } = fixture(); overlay.paint([monster(3, { hp: 12, maxHp: 45 })]);
  const node = shown(layer)[0], fill = node.children[1].children[0];
  assert.equal(fill.style.transform, `scaleX(${12 / 45})`); assert.equal(node.children[0].hidden, true); assert.equal(node.children[1].hidden, false);
  assert.equal(node.dataset.hp, '12'); assert.equal(node.dataset.maxHp, '45');
  overlay.paint([monster(3, { hp: 50, maxHp: 45 })]); assert.equal(fill.style.transform, 'scaleX(1)');
  overlay.paint([monster(3, { hp: 0 })]); assert.equal(shown(layer).length, 0); assert.equal(overlay.inspect().visible.length, 0);
});

test('a renderer-occluded or absent marker disappears immediately and cannot reappear from a cache', () => {
  const { layer, overlay } = fixture(); overlay.paint([teammate(), monster()]); const nodes = [...layer.children];
  overlay.paint([teammate()]); assert.equal(shown(layer).length, 1); assert.equal(nodes[1].hidden, true);
  overlay.paint([]); assert.equal(layer.hidden, true); assert.ok(nodes.every(node => node.hidden));
  overlay.paint([monster()]); assert.equal(shown(layer).length, 1); assert.equal(shown(layer)[0].dataset.voxelLabel, 'monster');
  assert.equal(overlay.inspect().poolSize, 2);
});

test('23 nodes support changing roster lifetimes and thousands of high-refresh frames without rebuilding DOM', () => {
  const { document, overlay, layer } = fixture();
  const initial = Array.from({ length: 23 }, (_, id) => monster(id)); overlay.paint(initial);
  const created = document.created, mutations = document.mutations, nodes = [...layer.children];
  for (let frame = 0; frame < 1200; frame++) {
    const labels = initial.map((label, id) => ({ ...label, key: `monster:${id}:${frame + 9}`, lifeId: frame + 9, hp: Math.max(1, 45 - frame % 45), x: .1 + .8 * id / 23, y: .3 + frame % 30 / 100 }));
    overlay.paint(labels);
  }
  assert.equal(document.created, created); assert.equal(document.mutations, mutations); assert.deepEqual(layer.children, nodes);
  assert.equal(overlay.inspect().poolSize, VOXEL_LABEL_LIMIT); assert.equal(overlay.inspect().visible.length, VOXEL_LABEL_LIMIT);
});

test('recycled actor slots reset life, kind, health and names while preserving the existing node', () => {
  const { overlay, layer } = fixture(); overlay.paint([monster()]); const node = shown(layer)[0];
  overlay.paint([teammate(3, { key: 'ally:3:9', lifeId: 9, name: 'Camille' })]);
  assert.equal(shown(layer)[0], node); assert.equal(node.dataset.lifeId, '9'); assert.equal(node.dataset.labelKey, 'ally:3:9');
  assert.equal(node.dataset.voxelLabel, 'teammate'); assert.equal(node.dataset.hp, undefined); assert.equal(node.children[0].textContent, 'Camille');
  overlay.paint([monster(3, { key: 'monster:3:10', lifeId: 10, hp: 100, maxHp: 200 })]);
  assert.equal(shown(layer)[0], node); assert.equal(node.children[1].children[0].style.transform, 'scaleX(0.5)'); assert.equal(node.children[0].hidden, true);
});

test('normalized camera positions update every display frame without reading DOM size or layout', () => {
  const { overlay, layer } = fixture(); overlay.paint([teammate(1, { x: .3125, y: .1875 })]); const node = shown(layer)[0];
  assert.equal(node.style.left, '31.25%'); assert.equal(node.style.top, '18.75%');
  overlay.paint([teammate(1, { x: .75, y: .375 })]); assert.equal(node.style.left, '75%'); assert.equal(node.style.top, '37.5%');
  assert.equal(overlay.inspect().poolSize, 1);
});

test('malformed markers, duplicate keys, dead bodies and out-of-viewport anchors cannot become labels', () => {
  const { overlay, layer } = fixture();
  const bad = [null, teammate(1, { key: '' }), teammate(1, { kind: 'enemy' }), teammate(1, { id: NaN }), teammate(1, { lifeId: -1 }),
    teammate(1, { x: Infinity }), teammate(1, { x: -.1 }), teammate(1, { y: 1.1 }), monster(3, { hp: NaN }), monster(3, { hp: -1 }), monster(3, { maxHp: 0 })];
  overlay.paint(bad); assert.equal(shown(layer).length, 0); assert.equal(overlay.inspect().poolSize, 0);
  overlay.paint([teammate(), teammate(1, { name: 'Duplicate' }), ...Array.from({ length: 30 }, (_, id) => monster(id + 5))]);
  assert.equal(shown(layer).length, VOXEL_LABEL_LIMIT); assert.equal(overlay.inspect().visible[0].name, 'Éloïse');
});

test('setup, dialogs, disconnected play, graphics loss and hidden documents clear labels immediately', () => {
  const { document, canvas, overlay, layer } = fixture();
  overlay.paint([monster()]); overlay.paint([monster()], { active: false }); assert.equal(shown(layer).length, 0);
  for (const event of ['webglcontextlost', 'voxel-renderer-error']) {
    overlay.paint([teammate(), monster()]); canvas.dispatch(event); assert.equal(shown(layer).length, 0); assert.equal(overlay.inspect().visible.length, 0);
  }
  overlay.paint([monster()]); document.hidden = true; document.dispatch('visibilitychange'); assert.equal(shown(layer).length, 0);
  document.hidden = false; document.dispatch('visibilitychange'); assert.equal(shown(layer).length, 0, 'visibility restoration cannot resurrect a stale marker');
});

test('inspect copies and deterministic cleanup cannot mutate or resurrect the marker state', () => {
  const { document, canvas, overlay, viewport, layer } = fixture(); overlay.paint([teammate(), monster()]);
  const copy = overlay.inspect(); copy.visible[0].name = 'Changed'; copy.visible.length = 0; copy.poolSize = 999;
  assert.equal(overlay.inspect().visible[0].name, 'Éloïse'); assert.equal(overlay.inspect().poolSize, 2);
  overlay.destroy(); overlay.destroy(); assert.equal(viewport.children.includes(layer), false); assert.deepEqual(overlay.inspect(), { visible: [], poolSize: 0, destroyed: true });
  assert.equal(canvas.listeners.get('webglcontextlost').size, 0); assert.equal(canvas.listeners.get('voxel-renderer-error').size, 0); assert.equal(document.listeners.get('visibilitychange').size, 0);
  overlay.paint([monster()]); assert.equal(viewport.children.includes(layer), false); assert.equal(overlay.inspect().visible.length, 0);
});
