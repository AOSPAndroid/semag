// A render-only sample of the previous 120 Hz tick. Combat state stays discrete:
// only positions are blended, never health, actions, collisions or events.
const CONTEXT = ['phase', 'round', 'wave', 'stageId'];
const IDENTITY = ['id', 'characterId', 'selected', 'stocks', 'downed'];
const PROJECTILE_IDENTITY = ['id', 'kind', 'owner', 'team', 'bornTick', 'reflections', 'reflected', 'returning'];
const ENEMY_IDENTITY = ['id', 'type', 'variant', 'downed'];
const sameWorld = (state, previous) => state?.phase === 'fight' && previous && CONTEXT.every(key => state[key] === previous[key]);
const alive = entity => entity.hp == null || entity.hp > 0;
const validPosition = entity => entity && Number.isFinite(entity.x) && Number.isFinite(entity.y);
const sameLife = (entity, before) => alive(entity) === before.alive && ((entity.respawnTicks || 0) > 0) === before.respawning;
const captureEntity = (entity, identity) => {
  const result = { x: entity.x, y: entity.y, alive: alive(entity), respawning: (entity.respawnTicks || 0) > 0 };
  for (const key of identity) result[key] = entity[key];
  return result;
};
const sameEntity = (entity, before, identity, limit = 64) => before && identity.every(key => entity[key] === before[key])
  && sameLife(entity, before) && validPosition(entity) && validPosition(before)
  && Math.hypot(entity.x - before.x, entity.y - before.y) <= limit;

export function capturePlanarPose(state) {
  if (!state?.fighters) return null;
  return {
    phase: state.phase, round: state.round, wave: state.wave, stageId: state.stageId, tick: state.tick,
    fighters: state.fighters.map(fighter => captureEntity(fighter, IDENTITY)),
    ...(state.projectiles && { projectiles: state.projectiles.map(entity => captureEntity(entity, PROJECTILE_IDENTITY)) }),
    ...(state.enemies && { enemies: state.enemies.map(entity => captureEntity(entity, ENEMY_IDENTITY)) }),
  };
}

/** Keep a real previous tick when a zero-error snapshot replaces prediction. */
export function retainAdjacentPlanarPose(state, ...candidates) {
  return candidates.find(previous => sameWorld(state, previous) && previous.tick === state.tick - 1) || null;
}

/** Reconcile the displayed pose, not the end of a discrete simulation tick. */
export function rebasePlanarCorrection(state, previous, index, oldPresented, nextPresented, correction = {}, { maxX = 45, maxY = 45 } = {}) {
  const fighter = state?.fighters?.[index], before = previous?.fighters?.[index];
  if (!sameWorld(state, previous) || !fighter || state.tick < previous.tick
      || !sameEntity(fighter, before, IDENTITY) || !validPosition(oldPresented) || !validPosition(nextPresented)) return { x: 0, y: 0 };
  const boundX = Number.isFinite(maxX) ? Math.max(0, Math.min(64, maxX)) : 45;
  const boundY = Number.isFinite(maxY) ? Math.max(0, Math.min(64, maxY)) : 45;
  const x = oldPresented.x + (Number.isFinite(correction.x) ? correction.x : 0) - nextPresented.x;
  const y = oldPresented.y + (Number.isFinite(correction.y) ? correction.y : 0) - nextPresented.y;
  return { x: Math.max(-boundX, Math.min(boundX, x)), y: Math.max(-boundY, Math.min(boundY, y)) };
}

/** Smooth existing moving objects for one tick; births, removals and combat stay current. */
export function presentPlanarEntities(state, previous, fraction) {
  const result = {};
  const compatibleWorld = sameWorld(state, previous) && previous.tick === state.tick - 1;
  const alpha = Number.isFinite(fraction) ? Math.max(0, Math.min(1, fraction)) : 1;
  for (const [name, identity] of [['projectiles', PROJECTILE_IDENTITY], ['enemies', ENEMY_IDENTITY]]) {
    if (!Array.isArray(state?.[name])) continue;
    const older = new Map();
    for (const entity of previous?.[name] || []) {
      if (entity.id != null) older.set(entity.id, older.has(entity.id) ? null : entity);
    }
    const identities = new Set(), duplicates = new Set();
    for (const entity of state[name]) { if (identities.has(entity.id)) duplicates.add(entity.id); identities.add(entity.id); }
    result[name] = state[name].map(entity => {
      const before = older.get(entity.id);
      if (!compatibleWorld || entity.id == null || duplicates.has(entity.id) || !alive(entity)
          || entity.life != null && entity.life <= 0 || !sameEntity(entity, before, identity)) return { ...entity };
      return { ...entity, x: before.x + (entity.x - before.x) * alpha, y: before.y + (entity.y - before.y) * alpha };
    });
  }
  return result;
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
