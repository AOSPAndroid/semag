/** Bounded, deterministic Horde attacks. Every damaging contact uses real cover. */
import { aimDirection, eyeHeight, playerHeight, traceShot, emitCombatEvent, TICK_RATE } from './voxel-engine.js';
export const MONSTER_SPECIAL_RULES = Object.freeze({ maxProjectiles: 16, maxHazards: 4, shardSpeed: 7.5, shardTicks: 600, shardDamage: 30, blastRadius: 4, blastDamage: 84, runeRadius: 2.1, runeDamage: 44, runeTicks: 108, runeHeight: .85 });
const human = player => player?.human === true && player.monster !== true && player.connected && player.participating && player.alive;
const sourceFor = (state, attack, type) => { const source = state.players[attack.sourceId]; return source?.monster === true && source.human !== true && source.monsterType === type && source.lifeId === attack.sourceLifeId ? source : null; };
const emit = (state, type, attack, stage) => {
  const { id: specialId, ...data } = attack;
  return emitCombatEvent(state, type, { ...data, specialId, playerId: attack.sourceId, stage });
};
function visibleBody(state, source, target, origin, arena, contactHeight = target.y + playerHeight(target) * .5) {
  const point = { x: target.x, y: contactHeight, z: target.z }, dx = point.x - origin.x, dy = point.y - origin.y, dz = point.z - origin.z, distance = Math.hypot(dx, dy, dz);
  if (distance < 1e-6) return true;
  // A separate test per human prevents another monster becoming magical blast cover.
  const snapshot = { ...state, players: [source, target] };
  return traceShot(snapshot, source.id, origin, { x: dx / distance, y: dy / distance, z: dz / distance }, distance + .01, arena).playerId === target.id;
}
function hit(source, target, damage, weapon, origin) { return { playerId: source.id, targetId: target.id, targetLifeId: target.lifeId || 0, damage, hitKind: 'body', headshot: false, attack: 'monster-special', weapon, attackX: origin.x, attackY: origin.y, attackZ: origin.z, hitX: target.x, hitY: target.y + playerHeight(target) * .5, hitZ: target.z }; }
export function launchMonsterShard(state, source, yaw, pitch) {
  const pool = state.horde.projectiles;
  if (pool.length >= MONSTER_SPECIAL_RULES.maxProjectiles) return false;
  const direction = aimDirection(yaw, pitch), projectile = { id: ++state.horde.specialId, sourceId: source.id, sourceLifeId: source.lifeId, x: source.x, y: source.y + 1.1, z: source.z, dx: direction.x, dy: direction.y, dz: direction.z, ticksLeft: MONSTER_SPECIAL_RULES.shardTicks, lifeTicks: MONSTER_SPECIAL_RULES.shardTicks, spawnTick: state.tick };
  pool.push(projectile); emit(state, 'monsterSpit', projectile, 'release'); return true;
}
export function markMonsterRune(state, source, target, arena) {
  const pool = state.horde.hazards; if (pool.length >= MONSTER_SPECIAL_RULES.maxHazards) return false;
  let ground = 0;
  for (const box of arena.colliders) { const top = (box.y || 0) + box.h; if (target.x >= box.x && target.x <= box.x + box.w && target.z >= box.z && target.z <= box.z + box.d && top <= target.y + .15) ground = Math.max(ground, top); }
  const hazard = { id: ++state.horde.specialId, sourceId: source.id, sourceLifeId: source.lifeId, targetId: target.id, targetLifeId: target.lifeId, x: target.x, y: ground, z: target.z, radius: MONSTER_SPECIAL_RULES.runeRadius, ticksLeft: MONSTER_SPECIAL_RULES.runeTicks, lifeTicks: MONSTER_SPECIAL_RULES.runeTicks, spawnTick: state.tick };
  pool.push(hazard); emit(state, 'monsterMark', hazard, 'windup'); return true;
}
export function cancelMonsterRunes(state, source) {
  const pool = state.horde.hazards;
  for (let index = pool.length - 1; index >= 0; index--) if (pool[index].sourceId === source.id && pool[index].sourceLifeId === source.lifeId) { emit(state, 'monsterMark', pool[index], 'cancel'); pool.splice(index, 1); }
}
export function bomberDamage(state, source, arena, damageScale = 1) {
  const origin = { x: source.x, y: source.y + .8, z: source.z }, hits = [];
  emitCombatEvent(state, 'monsterBlast', { playerId: source.id, sourceLifeId: source.lifeId, x: source.x, y: source.y, z: source.z, radius: MONSTER_SPECIAL_RULES.blastRadius });
  for (const target of state.players) {
    if (!human(target)) continue;
    const distance = Math.hypot(target.x - source.x, target.y + playerHeight(target) * .5 - origin.y, target.z - source.z);
    if (distance <= MONSTER_SPECIAL_RULES.blastRadius && visibleBody(state, source, target, origin, arena)) hits.push(hit(source, target, Math.round(MONSTER_SPECIAL_RULES.blastDamage * damageScale * (1 - .65 * distance / MONSTER_SPECIAL_RULES.blastRadius)), 'bomber', origin));
  }
  hits.push(hit(source, source, source.hp, 'bomber', origin)); return hits;
}
export function advanceMonsterSpecials(state, arena, damageScale = 1) {
  const horde = state.horde, hits = [], pool = horde.projectiles;
  for (let index = pool.length - 1; index >= 0; index--) {
    const projectile = pool[index], source = sourceFor(state, projectile, 'spitter');
    if (!source || --projectile.ticksLeft <= 0) { pool.splice(index, 1); continue; }
    if (projectile.spawnTick === state.tick) continue;
    const origin = { x: projectile.x, y: projectile.y, z: projectile.z }, length = MONSTER_SPECIAL_RULES.shardSpeed / TICK_RATE;
    const contact = traceShot(state, source.id, origin, { x: projectile.dx, y: projectile.dy, z: projectile.dz }, length, arena);
    if (contact.playerId !== null || contact.kind === 'wall') {
      const target = contact.playerId === null ? null : state.players[contact.playerId];
      if (human(target)) hits.push(hit(source, target, Math.round(MONSTER_SPECIAL_RULES.shardDamage * damageScale), 'spitter', origin));
      emit(state, 'monsterShardImpact', { ...projectile, x: contact.x, y: contact.y, z: contact.z }, 'impact'); pool.splice(index, 1); continue;
    }
    projectile.x += projectile.dx * length; projectile.y += projectile.dy * length; projectile.z += projectile.dz * length;
    if (projectile.x < arena.bounds.minX || projectile.x > arena.bounds.maxX || projectile.z < arena.bounds.minZ || projectile.z > arena.bounds.maxZ || projectile.y < 0 || projectile.y > 30) pool.splice(index, 1);
  }
  const hazards = horde.hazards;
  for (let index = hazards.length - 1; index >= 0; index--) {
    const hazard = hazards[index], source = sourceFor(state, hazard, 'weaver'), target = state.players[hazard.targetId];
    if (!source?.alive || !human(target) || target.lifeId !== hazard.targetLifeId) { emit(state, 'monsterMark', hazard, 'cancel'); hazards.splice(index, 1); continue; }
    if (hazard.spawnTick === state.tick || --hazard.ticksLeft > 0) continue;
    const origin = { x: hazard.x, y: hazard.y + .25, z: hazard.z };
    for (const victim of state.players) {
      if (!human(victim) || victim.y >= hazard.y + MONSTER_SPECIAL_RULES.runeHeight || victim.y + playerHeight(victim) <= hazard.y || Math.hypot(victim.x - hazard.x, victim.z - hazard.z) > hazard.radius) continue;
      if (visibleBody(state, source, victim, origin, arena, Math.min(victim.y + .25, hazard.y + MONSTER_SPECIAL_RULES.runeHeight - .05))) hits.push(hit(source, victim, Math.round(MONSTER_SPECIAL_RULES.runeDamage * damageScale), 'weaver', origin));
    }
    emit(state, 'monsterMark', hazard, 'release'); hazards.splice(index, 1);
  }
  return hits;
}
