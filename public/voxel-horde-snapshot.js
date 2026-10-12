import { recentSnapshotEvents } from './voxel-snapshot-events.js';
/** Last Stand's wire view preserves authority and every recent combat event. */
const SPATIAL_FIELDS = new Set(['x', 'y', 'z', 'dx', 'dy', 'dz', 'distance', 'attackX', 'attackY', 'attackZ', 'hitX', 'hitY', 'hitZ']);
const PRECISION = 100000;

function spatialEventView(value, field) {
  if (typeof value === 'number') {
    // Only presentation traces lose redundant float digits. Gameplay health,
    // damage, tick/life identities and live movement remain exact.
    return SPATIAL_FIELDS.has(field) && Number.isFinite(value) && Math.abs(value) < 1e8
      ? Math.round(value * PRECISION) / PRECISION : value;
  }
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    const items = value.map(item => spatialEventView(item));
    return items.some((item, index) => item !== value[index]) ? items : value;
  }
  let copy = null;
  for (const key of Object.keys(value)) {
    const next = spatialEventView(value[key], key);
    if (next !== value[key]) { copy ||= { ...value }; copy[key] = next; }
  }
  return copy || value;
}

export function snapshotHordeState(state) {
  return { ...state, map: undefined, fighters: undefined,
    events: recentSnapshotEvents(state).map(event => spatialEventView(event)),
    horde: { ...state.horde, brains: undefined } };
}
