/** Network snapshots carry only recent events. Clients deduplicate events by
 * id, effects ignore anything older than a few ticks, and death poses read
 * kills for up to two seconds, so the full 160-256 event history is dead weight
 * that every snapshot re-sent: a sword brawl made each 30 Hz snapshot ~60 KB. */
export const SNAPSHOT_EVENT_TICKS = 60;
export const SNAPSHOT_LONG_EVENT_TICKS = 240;
const LONG_EVENTS = new Set(['kill', 'round', 'roundEnd', 'matchEnd', 'fight', 'buy', 'wave', 'waveStart', 'waveEnd']);

export function recentSnapshotEvents(state) {
  const events = Array.isArray(state?.events) ? state.events : [];
  if (!Number.isFinite(state?.tick)) return events;
  return events.filter(event => {
    const age = state.tick - (Number.isFinite(event?.tick) ? event.tick : state.tick);
    return age <= SNAPSHOT_EVENT_TICKS || LONG_EVENTS.has(event?.type) && age <= SNAPSHOT_LONG_EVENT_TICKS;
  });
}
