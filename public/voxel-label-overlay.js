/** World markers consume the renderer's visible, projected bodies only. */
export const VOXEL_LABEL_LIMIT = 23;

function labelPresentation(label) {
  if (!label || !['teammate', 'monster'].includes(label.kind) || typeof label.key !== 'string' || !label.key || label.key.length > 120 ||
      !Number.isInteger(label.id) || label.id < 0 || !Number.isInteger(label.lifeId) || label.lifeId < 0 ||
      !Number.isFinite(label.x) || !Number.isFinite(label.y) || label.x < 0 || label.x > 1 || label.y < 0 || label.y > 1) return null;
  if (label.kind === 'monster' && (!Number.isFinite(label.hp) || !Number.isFinite(label.maxHp) || label.hp <= 0 || label.maxHp <= 0)) return null;
  return { key: label.key, id: label.id, lifeId: label.lifeId, kind: label.kind, x: label.x, y: label.y,
    ...(label.kind === 'teammate' ? { name: typeof label.name === 'string' && label.name.trim() ? label.name : `Player ${label.id + 1}` } :
      { hp: label.hp, maxHp: label.maxHp }) };
}

/** The canvas fills its positioned parent; percentages avoid layout reads at refresh rate. */
export function mountVoxelLabelOverlay(canvas) {
  const document = canvas?.ownerDocument, parent = canvas?.parentElement;
  if (!document?.createElement || !parent) throw new TypeError('World labels need a mounted game canvas.');
  const layer = document.createElement('div');
  layer.className = 'voxel-world-labels'; layer.dataset.voxelLabelOverlay = ''; layer.setAttribute('aria-hidden', 'true'); layer.hidden = true;
  // Later scope, crosshair and menu siblings retain their normal paint order.
  parent.insertBefore(layer, canvas.nextSibling);
  const pool = [], entries = new Map(), listeners = [];
  let destroyed = false;
  const listen = (target, name, callback) => { target.addEventListener(name, callback); listeners.push(() => target.removeEventListener(name, callback)); };
  function makeNode() {
    const node = document.createElement('span'), name = document.createElement('span'), track = document.createElement('span'), fill = document.createElement('i');
    node.className = 'voxel-world-label'; name.className = 'voxel-world-name'; track.className = 'voxel-world-health'; fill.className = 'voxel-world-health-fill';
    node.hidden = true; track.append(fill); node.append(name, track); layer.append(node);
    const entry = { node, name, track, fill, key: '', label: null }; pool.push(entry); return entry;
  }
  function clear() {
    layer.hidden = true;
    for (const entry of entries.values()) { entry.node.hidden = true; entry.key = ''; entry.label = null; }
    entries.clear();
  }
  function paint(labels, { active = true } = {}) {
    if (destroyed) return;
    if (!active || !Array.isArray(labels)) { clear(); return; }
    const visible = [], wanted = new Set();
    for (const source of labels) {
      if (visible.length === VOXEL_LABEL_LIMIT) break;
      const label = labelPresentation(source);
      if (!label || wanted.has(label.key)) continue;
      visible.push(label); wanted.add(label.key);
    }
    if (!visible.length) { clear(); return; }
    // Release stale lifetimes before assigning free nodes, retaining every live key.
    for (const [key, entry] of entries) if (!wanted.has(key)) {
      entry.node.hidden = true; entry.key = ''; entry.label = null; entries.delete(key);
    }
    for (const label of visible) {
      let entry = entries.get(label.key);
      if (!entry) {
        entry = pool.find(candidate => !candidate.key) || makeNode();
        entry.key = label.key; entries.set(label.key, entry);
        entry.node.dataset.playerId = String(label.id); entry.node.dataset.lifeId = String(label.lifeId); entry.node.dataset.labelKey = label.key;
      }
      const before = entry.label;
      if (before?.kind !== label.kind) {
        entry.node.dataset.voxelLabel = label.kind; entry.name.hidden = label.kind !== 'teammate'; entry.track.hidden = label.kind !== 'monster';
      }
      if (label.kind === 'teammate') {
        if (entry.name.textContent !== label.name) entry.name.textContent = label.name;
        if (entry.node.dataset.hp != null) { delete entry.node.dataset.hp; delete entry.node.dataset.maxHp; }
      } else {
        const fraction = Math.max(0, Math.min(1, label.hp / label.maxHp));
        if (before?.hp !== label.hp || before?.maxHp !== label.maxHp) {
          entry.fill.style.transform = `scaleX(${fraction})`; entry.node.dataset.hp = String(label.hp); entry.node.dataset.maxHp = String(label.maxHp);
        }
      }
      if (before?.x !== label.x) entry.node.style.left = `${label.x * 100}%`;
      if (before?.y !== label.y) entry.node.style.top = `${label.y * 100}%`;
      entry.label = label; entry.node.hidden = false;
    }
    layer.hidden = false;
  }
  function destroy() {
    if (destroyed) return;
    clear(); destroyed = true; for (const remove of listeners) remove(); layer.remove(); pool.length = 0;
  }
  listen(canvas, 'webglcontextlost', clear); listen(canvas, 'voxel-renderer-error', clear);
  listen(document, 'visibilitychange', () => { if (document.hidden) clear(); });
  return Object.freeze({ paint, clear, destroy, inspect: () => ({ visible: [...entries.values()].map(entry => ({ ...entry.label })), poolSize: pool.length, destroyed }) });
}
