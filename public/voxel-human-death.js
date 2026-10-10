/** Human/bot death is a short visual confirmation, never a combat actor. */
export const HUMAN_DEATH_RULES = Object.freeze({ maxCorpses: 12, durationMs: 1080, collapseMs: 360, holdMs: 180, dissolveMs: 540, maxEventAgeTicks: 240 });
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const smooth = value => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); };
const livePhases = new Set(['fight', 'paused', 'intermission', 'roundEnd', 'matchEnd']);
const games = new Set(['voxel-breach', 'voxel-royale', 'voxel-horde', 'voxel-dojo']);
const validId = value => Number.isSafeInteger(value) && value >= 0;

export function humanDeathPose(death, ageMs = 0, { reducedMotion = false } = {}) {
  const age = Number.isFinite(ageMs) ? Math.max(0, ageMs) : HUMAN_DEATH_RULES.durationMs;
  const collapse = reducedMotion ? 1 : smooth((age - 30) / (HUMAN_DEATH_RULES.collapseMs - 30));
  return { visible: age < HUMAN_DEATH_RULES.durationMs, ageMs: age,
    progress: clamp(age / HUMAN_DEATH_RULES.durationMs, 0, 1), collapse,
    bend: Math.sin(collapse * Math.PI / 2), angle: reducedMotion ? 0 : collapse * 1.47,
    dissolve: smooth((age - HUMAN_DEATH_RULES.collapseMs - HUMAN_DEATH_RULES.holdMs) / HUMAN_DEATH_RULES.dissolveMs),
    darken: reducedMotion ? .15 : .15 * smooth(age / 110), reducedMotion };
}

/** No camera shake or horizontal drift: a restrained fall, above real ground. */
export function humanDeathCameraPose(death, { reducedMotion = false } = {}) {
  const fall = reducedMotion ? 0 : smooth(Math.max(0, death?.ageMs || 0) / 430);
  return { fall, lower: (death?.crouching ? .45 : 1.15) * fall, roll: .13 * fall, pitch: -.07 * fall };
}

/** Only accepted lethal descriptors create bodies; initial history is primed. */
export function createHumanDeathPresenter({ maxCorpses = HUMAN_DEATH_RULES.maxCorpses } = {}) {
  const capacity = clamp(Number.isSafeInteger(maxCorpses) ? maxCorpses : HUMAN_DEATH_RULES.maxCorpses, 1, HUMAN_DEATH_RULES.maxCorpses);
  const corpses = new Map(), seenLives = new Set();
  let context = null, cursor = 0, clock = 0, previousTime = null, wasPaused = false, acceptedKills = 0;
  function clear() { corpses.clear(); seenLives.clear(); cursor = 0; clock = 0; previousTime = null; wasPaused = false; acceptedKills = 0; }
  const present = (state, time, { paused = false } = {}) => {
    if (!Number.isFinite(time) || !games.has(state?.gameId)) { clear(); context = null; return []; }
    const nextContext = `${state.gameId}:${state.mapId}:${state.matchId ?? 0}:${state.round ?? 0}:${state.practice?.sessionId ?? state.horde?.sessionId ?? 0}`;
    const events = Array.isArray(state.events) ? state.events : [];
    const newestId = Math.max(validId(state.eventId) ? state.eventId : 0, ...events.map(event => validId(event?.id) ? event.id : 0));
    if (nextContext !== context || previousTime !== null && time < previousTime || newestId < cursor) {
      clear(); context = nextContext; previousTime = time; cursor = newestId;
      wasPaused = paused || state.phase === 'paused'; return [];
    }
    const held = paused || state.phase === 'paused';
    if (previousTime !== null && !held && !wasPaused) clock += Math.max(0, time - previousTime);
    previousTime = time; wasPaused = held;
    if (!livePhases.has(state.phase)) { corpses.clear(); seenLives.clear(); cursor = newestId; return []; }
    for (const [key, corpse] of corpses) if (clock - corpse.born >= HUMAN_DEATH_RULES.durationMs) corpses.delete(key);
    const before = cursor;
    for (const event of events) {
      if (!validId(event?.id) || event.id <= before) continue;
      cursor = Math.max(cursor, event.id);
      const info = event.humanDeath;
      if (event.type !== 'kill' || !validId(event.targetId) || !info || event.monsterType
        || !validId(info.lifeId) || !Number.isSafeInteger(info.deaths) || info.deaths < 1 || !validId(info.team)
        || typeof info.crouching !== 'boolean' || ![event.x, event.y, event.z, info.yaw, info.dx, info.dy, info.dz, event.tick, state.tick].every(Number.isFinite)
        || state.tick < event.tick || state.tick - event.tick > HUMAN_DEATH_RULES.maxEventAgeTicks) continue;
      const actor = state.players?.find(player => player.id === event.targetId);
      // A new life in the same seat cannot inherit, cancel or replace its old
      // body's pose. A contradictory same-life live actor is not a valid death.
      if ((actor?.lifeId || 0) === info.lifeId && actor?.deaths === info.deaths
        && (actor.alive !== false || actor.hp > 0 || actor.monsterType)) continue;
      const key = `${event.targetId}:${info.lifeId}:${info.deaths}`;
      if (seenLives.has(key)) continue;
      seenLives.add(key); while (seenLives.size > 256) seenLives.delete(seenLives.values().next().value);
      while (corpses.size >= capacity) corpses.delete(corpses.keys().next().value);
      corpses.set(key, Object.freeze({ key, targetId: event.targetId, lifeId: info.lifeId, deaths: info.deaths,
        team: info.team, crouching: info.crouching, x: event.x, y: event.y, z: event.z, yaw: info.yaw,
        dx: info.dx, dy: info.dy, dz: info.dz, eventId: event.id, born: clock }));
      acceptedKills++;
    }
    cursor = Math.max(cursor, newestId);
    return [...corpses.values()].map(death => Object.freeze({ ...death, ageMs: Math.max(0, clock - death.born) }));
  };
  present.reset = () => { clear(); context = null; };
  present.getStats = () => ({ activeCorpses: corpses.size, cursor, acceptedKills, clockMs: clock });
  return present;
}
