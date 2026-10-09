import { monsterTypeId } from './voxel-monster-bodies.js';

/** Presentation only: the dead actor and its loot remain owned by combat. */
// A confirmed kill can reach its first paint after a slow frame or a delayed
// snapshot. Context priming and life deduplication prevent history replay;
// allow two seconds for a new event without retaining old corpses indefinitely.
export const MONSTER_DEATH_RULES = Object.freeze({ maxCorpses: 20, durationMs: 1080, collapseMs: 360, holdMs: 180, dissolveMs: 540, maxEventAgeTicks: 240 });
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const smooth = value => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); };
const livePhases = new Set(['fight', 'paused', 'intermission', 'matchEnd']);
const validId = value => Number.isSafeInteger(value) && value >= 0;

/** A quick recoil, joint collapse, quiet hold, then a gradual voxel dissolve. */
export function monsterDeathPose(death, ageMs = 0) {
  const age = Number.isFinite(ageMs) ? Math.max(0, ageMs) : MONSTER_DEATH_RULES.durationMs;
  const collapse = smooth((age - 30) / (MONSTER_DEATH_RULES.collapseMs - 30));
  return { visible: age < MONSTER_DEATH_RULES.durationMs, ageMs: age,
    progress: clamp(age / MONSTER_DEATH_RULES.durationMs, 0, 1), collapse,
    bend: Math.sin(collapse * Math.PI / 2), angle: collapse * (death?.monsterType === 'hound' ? 1.49 : 1.47),
    dissolve: smooth((age - MONSTER_DEATH_RULES.collapseMs - MONSTER_DEATH_RULES.holdMs) / MONSTER_DEATH_RULES.dissolveMs),
    darken: .15 * smooth(age / 110) };
}

/** Only immutable, authoritative lethal events create corpses; despawns never do. */
export function createMonsterDeathPresenter({ maxCorpses = MONSTER_DEATH_RULES.maxCorpses } = {}) {
  const capacity = clamp(Number.isSafeInteger(maxCorpses) ? maxCorpses : MONSTER_DEATH_RULES.maxCorpses, 1, MONSTER_DEATH_RULES.maxCorpses);
  const corpses = new Map(), seenLives = new Set();
  let context = null, cursor = 0, clock = 0, previousTime = null, wasPaused = false, acceptedKills = 0;
  function clear() { corpses.clear(); seenLives.clear(); cursor = 0; clock = 0; previousTime = null; wasPaused = false; acceptedKills = 0; }
  const present = (state, time, { paused = false } = {}) => {
    if (!Number.isFinite(time) || state?.gameId !== 'voxel-horde') { clear(); context = null; return []; }
    const nextContext = `${state.mapId}:${state.matchId ?? 0}:${state.horde?.sessionId ?? 0}`;
    const events = Array.isArray(state.events) ? state.events : [];
    const newestId = Math.max(validId(state.eventId) ? state.eventId : 0, ...events.map(event => validId(event?.id) ? event.id : 0));
    const reset = nextContext !== context || previousTime !== null && time < previousTime || newestId < cursor;
    if (reset) {
      clear(); context = nextContext; previousTime = time; cursor = newestId;
      wasPaused = paused || state.phase === 'paused'; return [];
    }
    const held = paused || state.phase === 'paused';
    if (previousTime !== null && !held && !wasPaused) clock += Math.max(0, time - previousTime);
    previousTime = time; wasPaused = held;
    if (!livePhases.has(state.phase)) { corpses.clear(); seenLives.clear(); cursor = newestId; return []; }
    for (const [key, corpse] of corpses) if (clock - corpse.born >= MONSTER_DEATH_RULES.durationMs) corpses.delete(key);
    const before = cursor;
    for (const event of events) {
      if (!validId(event?.id) || event.id <= before) continue;
      cursor = Math.max(cursor, event.id);
      if (event.type !== 'kill' || !validId(event.targetId) || !Number.isSafeInteger(event.targetLifeId) || event.targetLifeId <= 0
        || !monsterTypeId({ monster: true, human: false, monsterType: event.monsterType })
        || ![event.x, event.y, event.z, event.yaw, event.tick, state.tick].every(Number.isFinite)
        || state.tick < event.tick || state.tick - event.tick > MONSTER_DEATH_RULES.maxEventAgeTicks) continue;
      const actor = state.players?.find(player => player.id === event.targetId);
      // A recycled seat may already contain a new life. The event's immutable
      // death descriptor still belongs to the old life, never the new occupant.
      if (actor?.lifeId === event.targetLifeId && (actor.alive !== false || actor.hp > 0 || monsterTypeId(actor) !== event.monsterType)) continue;
      const key = `${event.targetId}:${event.targetLifeId}`;
      if (seenLives.has(key)) continue;
      seenLives.add(key); while (seenLives.size > 256) seenLives.delete(seenLives.values().next().value);
      while (corpses.size >= capacity) corpses.delete(corpses.keys().next().value);
      const death = Object.freeze({ key, targetId: event.targetId, lifeId: event.targetLifeId, monsterType: event.monsterType,
        x: event.x, y: event.y, z: event.z, yaw: event.yaw,
        dx: Number.isFinite(event.dx) ? event.dx : 0, dy: Number.isFinite(event.dy) ? event.dy : 0, dz: Number.isFinite(event.dz) ? event.dz : 0,
        eventId: event.id, born: clock });
      corpses.set(key, death); acceptedKills++;
    }
    cursor = Math.max(cursor, newestId);
    return [...corpses.values()].map(death => Object.freeze({ ...death, ageMs: Math.max(0, clock - death.born) }));
  };
  present.reset = () => { clear(); context = null; };
  present.getStats = () => ({ activeCorpses: corpses.size, cursor, acceptedKills });
  return present;
}
