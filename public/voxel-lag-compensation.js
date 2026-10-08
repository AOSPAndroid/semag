/** Server-only, bounded pose history for hitscan traces. Nothing enters snapshots. */
export const MAX_REWIND_TICKS = 18; // 150 ms at the shared 120 Hz simulation rate.
const MAX_TELEPORT_DISTANCE = 4;
const histories = new WeakMap();

export function isValidViewTick(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
}

const validPosition = player => Number.isFinite(player?.x) && Number.isFinite(player?.y) && Number.isFinite(player?.z);
const samePosition = (a, b) => a.x === b.x && a.y === b.y && a.z === b.z;
const movedTooFar = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) > MAX_TELEPORT_DISTANCE;
const contextFor = state => [state.gameId, state.phase, state.mapId, state.round, state.matchId, state.map];

function synchronizeContext(state, history) {
  const next = contextFor(state);
  if (!history.context || next.some((value, index) => value !== history.context[index])) {
    history.context = next;
    history.frames.length = 0;
    history.actors.clear();
    history.views.clear();
  }
}

/** Enable only on authoritative room states; browser prediction/practice remains unchanged. */
export function enableLagCompensation(state) {
  if (state && typeof state === 'object' && !histories.has(state)) {
    histories.set(state, { context: null, frames: [], actors: new Map(), views: new Map(), generation: 0 });
  }
  return state;
}

/** Set metadata when its input command is consumed, clearing it for older clients. */
export function setShotViewTick(state, playerId, viewTick) {
  const history = histories.get(state);
  if (!history) return false;
  synchronizeContext(state, history);
  if (!isValidViewTick(viewTick) || !Number.isSafeInteger(state.tick) || viewTick > state.tick || state.tick - viewTick > MAX_REWIND_TICKS || state.phase !== 'fight') {
    history.views.delete(playerId);
    return false;
  }
  history.views.set(playerId, viewTick);
  return true;
}

/** Capture actual tick positions after movement/body separation and before weapons. */
export function recordLagCompensation(state) {
  const history = histories.get(state);
  if (!history) return;
  synchronizeContext(state, history);
  if (state.phase !== 'fight' || !Number.isSafeInteger(state.tick) || state.tick < 0) return;
  const previousFrame = history.frames.at(-1);
  if (previousFrame && state.tick <= previousFrame.tick) {
    if (state.tick === previousFrame.tick) return;
    history.frames.length = 0;
    history.actors.clear();
    history.views.clear();
  }

  const poses = new Map();
  for (const player of state.players || []) {
    if (!validPosition(player)) continue;
    let actor = history.actors.get(player.id);
    if (!actor || actor.ref !== player || actor.team !== player.team || actor.alive !== player.alive || movedTooFar(actor, player)) {
      if (actor) history.views.delete(player.id);
      actor = { generation: ++history.generation };
    }
    Object.assign(actor, { ref: player, team: player.team, alive: player.alive, x: player.x, y: player.y, z: player.z });
    history.actors.set(player.id, actor);
    poses.set(player.id, { generation: actor.generation, alive: player.alive, x: player.x, y: player.y, z: player.z });
  }
  for (const id of history.actors.keys()) if (!poses.has(id)) {
    history.actors.delete(id);
    history.views.delete(id);
  }
  history.frames.push({ tick: state.tick, poses });
  while (history.frames.length && history.frames[0].tick < state.tick - MAX_REWIND_TICKS) history.frames.shift();
}

/** Trace current authority unless fresh metadata and compatible history cover the view tick. */
export function traceCompensatedShot(state, shooterId, origin, direction, maxDistance, arena, traceShot) {
  const history = histories.get(state);
  if (!history) return traceShot(state, shooterId, origin, direction, maxDistance, arena);
  const currentTrace = () => traceShot(state, shooterId, origin, direction, maxDistance, arena);
  synchronizeContext(state, history);
  const viewTick = history.views.get(shooterId), newest = history.frames.at(-1);
  if (state.phase !== 'fight' || !isValidViewTick(viewTick) || !Number.isSafeInteger(state.tick) || viewTick > state.tick || state.tick - viewTick > MAX_REWIND_TICKS || newest?.tick !== state.tick || viewTick < history.frames[0].tick) return currentTrace();

  const shooter = state.players.find(player => player.id === shooterId), shooterActor = history.actors.get(shooterId);
  if (!shooter?.alive || !shooterActor || shooterActor.ref !== shooter || shooterActor.team !== shooter.team || shooterActor.alive !== shooter.alive || !samePosition(shooterActor, shooter)) return currentTrace();
  let before = history.frames[0], after = newest;
  for (const frame of history.frames) {
    if (frame.tick <= viewTick) before = frame;
    if (frame.tick >= viewTick) { after = frame; break; }
  }
  const ratio = after.tick === before.tick ? 0 : (viewTick - before.tick) / (after.tick - before.tick);
  const players = state.players.map(player => {
    if (player.id === shooterId || !player.alive || !validPosition(player)) return player;
    const actor = history.actors.get(player.id), a = before.poses.get(player.id), b = after.poses.get(player.id);
    if (!actor || actor.ref !== player || actor.team !== player.team || actor.alive !== player.alive || !samePosition(actor, player) || !a?.alive || !b?.alive || a.generation !== actor.generation || b.generation !== actor.generation || movedTooFar(a, b)) return player;
    // Preserve newest membership, stance, team, health and combat fields. Only
    // positional transforms follow the same older timeline as the remote view.
    return { ...player, x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio, z: a.z + (b.z - a.z) * ratio };
  });
  return traceShot({ ...state, players, fighters: players }, shooterId, origin, direction, maxDistance, arena);
}

/** Copied diagnostics for tests; history poses and accepted metadata stay private. */
export function getLagCompensationDiagnostics(state) {
  const history = histories.get(state);
  return history ? { enabled: true, maxRewindTicks: MAX_REWIND_TICKS, frameCount: history.frames.length, oldestTick: history.frames[0]?.tick ?? null, newestTick: history.frames.at(-1)?.tick ?? null, viewCount: history.views.size } : { enabled: false };
}
