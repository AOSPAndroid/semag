// A render-only sample of the previous 120 Hz tick. Combat state stays discrete:
// only positions are blended, never health, actions, collisions or events.
const CONTEXT = ['phase', 'round', 'wave', 'stageId'];
const IDENTITY = ['id', 'characterId', 'selected', 'stocks', 'downed'];

export function capturePlanarPose(state) {
  if (!state?.fighters) return null;
  return {
    phase: state.phase, round: state.round, wave: state.wave, stageId: state.stageId, tick: state.tick,
    fighters: state.fighters.map(fighter => ({
      id: fighter.id, characterId: fighter.characterId, selected: fighter.selected,
      stocks: fighter.stocks, downed: fighter.downed,
      x: fighter.x, y: fighter.y, alive: fighter.hp == null || fighter.hp > 0,
      respawning: (fighter.respawnTicks || 0) > 0,
    })),
  };
}

export function presentPlanarFighter(state, previous, index, fraction, { adjacentTick = true } = {}) {
  const fighter = state.fighters[index], before = previous?.fighters[index];
  if (!before || state.phase !== 'fight' || CONTEXT.some(key => state[key] !== previous[key])
      || IDENTITY.some(key => fighter[key] !== before[key])
      || (fighter.hp == null || fighter.hp > 0) !== before.alive
      || ((fighter.respawnTicks || 0) > 0) !== before.respawning
      || state.tick < previous.tick
      || (adjacentTick && previous.tick !== state.tick - 1)
      || !Number.isFinite(before.x + before.y + fighter.x + fighter.y)
      || Math.hypot(fighter.x - before.x, fighter.y - before.y) > 64) return { ...fighter };
  const alpha = Number.isFinite(fraction) ? Math.max(0, Math.min(1, fraction)) : 1;
  return { ...fighter, x: before.x + (fighter.x - before.x) * alpha, y: before.y + (fighter.y - before.y) * alpha };
}

/** Network buffering delays transforms alone; damage, deaths and actions stay current. */
export function presentNetworkPlanarFighter(state, before, after, index, targetTime, { maxDistance = 64 } = {}) {
  const distanceLimit = Number.isFinite(maxDistance) ? Math.max(0, Math.min(128, maxDistance)) : 64;
  const fighter = state.fighters[index], older = before?.state, newer = after?.state;
  if (!fighter || !older?.fighters[index] || !newer?.fighters[index]
      || state.phase !== 'fight' || !Number.isFinite(before.time + after.time) || after.time < before.time
      || older.tick > newer.tick || newer.tick > state.tick
      || CONTEXT.some(key => state[key] !== older[key] || state[key] !== newer[key])) return fighter ? { ...fighter } : fighter;
  const compatible = sample => {
    const candidate = sample.fighters[index];
    return IDENTITY.every(key => fighter[key] === candidate[key])
      && (fighter.hp == null || fighter.hp > 0) === (candidate.hp == null || candidate.hp > 0)
      && ((fighter.respawnTicks || 0) > 0) === ((candidate.respawnTicks || 0) > 0)
      && Number.isFinite(fighter.x + fighter.y + candidate.x + candidate.y)
      && Math.hypot(fighter.x - candidate.x, fighter.y - candidate.y) <= distanceLimit;
  };
  if (!compatible(older) || !compatible(newer) || !Number.isFinite(targetTime)) return { ...fighter };
  const alpha = Math.max(0, Math.min(1, (targetTime - before.time) / Math.max(1, after.time - before.time)));
  const pose = presentPlanarFighter(newer, before.pose || capturePlanarPose(older), index, alpha, { adjacentTick: false });
  return { ...fighter, x: pose.x, y: pose.y };
}
