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
