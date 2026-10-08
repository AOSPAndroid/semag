/** Bounded, deterministic crossbow flight. The engine supplies its real 3D trace. */
export const MAX_BOLTS = 24;
const DT = 1 / 120, EPS = 1e-8, MAX_TTL = 240;
const noop = () => {};
const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function eventData(bolt) {
  return { boltId: bolt.id, playerId: bolt.playerId, team: bolt.team, weapon: bolt.weapon, attack: 'bolt', x: bolt.x, y: bolt.y, z: bolt.z, ageTicks: bolt.ageTicks };
}

/** Caller owns the live-round/fire gate, ammunition and recovery after success. */
export function launchBolt(state, player, weapon, origin, direction, { emit = noop } = {}) {
  const active = Array.isArray(state.bolts) ? state.bolts : [];
  if (!player?.alive || !Number.isInteger(player.id) || !Number.isInteger(player.team) || active.length >= MAX_BOLTS) return null;
  if (!origin || !direction || ![origin.x, origin.y, origin.z, direction.x, direction.y, direction.z].every(Number.isFinite) || origin.y < 0) return null;
  const length = Math.hypot(direction.x, direction.y, direction.z);
  if (length <= EPS) return null;
  const speed = clamp(finite(weapon?.projectileSpeed, 48), .01, 1000);
  const bolt = {
    id: Math.max(0, Math.floor(finite(state.boltId, 0))) + 1,
    playerId: player.id, team: player.team, weapon: weapon?.id || 'crossbow',
    x: origin.x, y: origin.y, z: origin.z,
    vx: direction.x / length * speed, vy: direction.y / length * speed, vz: direction.z / length * speed,
    gravity: clamp(finite(weapon?.projectileGravity, 9), 0, 100),
    damage: clamp(finite(weapon?.damage, 75), 0, 1000), headMultiplier: clamp(finite(weapon?.headMultiplier, 2), 0, 10),
    range: clamp(finite(weapon?.range, 100), .01, 1000), traveledDistance: 0,
    ttlTicks: clamp(Math.floor(finite(weapon?.projectileTicks, MAX_TTL)), 1, MAX_TTL), ageTicks: 0,
    bornTick: Math.max(0, Math.floor(finite(state.tick, 0))),
  };
  state.bolts = active; state.boltId = bolt.id; active.push(bolt);
  emit('boltLaunch', { ...eventData(bolt), vx: bolt.vx, vy: bolt.vy, vz: bolt.vz, ttlTicks: bolt.ttlTicks });
  return bolt;
}

function contactNormal(hit, point, direction, arena) {
  if ([hit.nx, hit.ny, hit.nz].every(Number.isFinite)) {
    const length = Math.hypot(hit.nx, hit.ny, hit.nz);
    if (length > EPS) return { nx: hit.nx / length, ny: hit.ny / length, nz: hit.nz / length };
  }
  if (hit.colliderId === 'floor') return { nx: 0, ny: 1, nz: 0 };
  const box = arena?.colliders?.find(rect => rect.id === hit.colliderId);
  if (box) {
    const faces = [
      { distance: Math.abs(point.x - box.x), nx: -1, ny: 0, nz: 0 },
      { distance: Math.abs(point.x - box.x - box.w), nx: 1, ny: 0, nz: 0 },
      { distance: Math.abs(point.y - box.y), nx: 0, ny: -1, nz: 0 },
      { distance: Math.abs(point.y - box.y - box.h), nx: 0, ny: 1, nz: 0 },
      { distance: Math.abs(point.z - box.z), nx: 0, ny: 0, nz: -1 },
      { distance: Math.abs(point.z - box.z - box.d), nx: 0, ny: 0, nz: 1 },
    ];
    const face = faces.reduce((nearest, next) => next.distance < nearest.distance ? next : nearest);
    return { nx: face.nx, ny: face.ny, nz: face.nz };
  }
  return { nx: -direction.x, ny: -direction.y, nz: -direction.z };
}

function validBolt(bolt) {
  return bolt && Number.isInteger(bolt.id) && Number.isInteger(bolt.playerId) && Number.isInteger(bolt.team)
    && [bolt.x, bolt.y, bolt.z, bolt.vx, bolt.vy, bolt.vz, bolt.gravity, bolt.damage, bolt.headMultiplier,
      bolt.ageTicks, bolt.ttlTicks, bolt.range, bolt.traveledDistance, bolt.bornTick].every(Number.isFinite)
    && bolt.y >= 0 && bolt.gravity >= 0 && bolt.damage >= 0 && bolt.headMultiplier >= 0
    && bolt.ageTicks >= 0 && bolt.ageTicks < Math.min(MAX_TTL, bolt.ttlTicks)
    && bolt.traveledDistance >= 0 && bolt.traveledDistance < bolt.range;
}

/**
 * Advance one authoritative tick with a swept chord of the ballistic arc.
 * Damage is queued, never applied here, so same-tick gun/bolt contacts can trade.
 * trace(state, shooterId, origin, unitDirection, distance) must return the first
 * wall/body/head contact. The floor is also checked when an adapter omits it.
 */
export function advanceBolts(state, { dt = DT, trace, arena = null, emit = noop, queueDamage = noop } = {}) {
  if (!Array.isArray(state.bolts) || !state.bolts.length) return [];
  if (typeof trace !== 'function') throw new TypeError('Crossbow flight requires the engine trace.');
  if (!Number.isFinite(dt) || dt <= 0) return [];
  dt = Math.min(dt, DT);
  const remaining = [], hits = [];
  for (const bolt of state.bolts.slice(0, MAX_BOLTS)) {
    if (!validBolt(bolt)) continue;
    if (bolt.bornTick === state.tick) { remaining.push(bolt); continue; }
    const delta = { x: bolt.vx * dt, y: bolt.vy * dt - .5 * bolt.gravity * dt * dt, z: bolt.vz * dt };
    const fullDistance = Math.hypot(delta.x, delta.y, delta.z);
    bolt.ageTicks++;
    if (fullDistance <= EPS) {
      bolt.vy -= bolt.gravity * dt;
      if (bolt.ageTicks < Math.min(MAX_TTL, bolt.ttlTicks)) remaining.push(bolt);
      continue;
    }
    const direction = { x: delta.x / fullDistance, y: delta.y / fullDistance, z: delta.z / fullDistance };
    const segmentDistance = Math.min(fullDistance, bolt.range - bolt.traveledDistance);
    const origin = { x: bolt.x, y: bolt.y, z: bolt.z };
    const traced = trace(state, bolt.playerId, origin, direction, segmentDistance);
    let hit = traced && traced.kind !== 'none' && Number.isFinite(traced.distance)
      && traced.distance >= -EPS && traced.distance <= segmentDistance + EPS ? traced : null;
    if (direction.y < -EPS) {
      const distance = -origin.y / direction.y;
      if (distance >= -EPS && distance <= segmentDistance + EPS && (!hit || distance <= hit.distance + EPS)) {
        hit = { distance: Math.max(0, distance), kind: 'wall', colliderId: 'floor', playerId: null };
      }
    }
    const distance = hit ? clamp(hit.distance, 0, segmentDistance) : segmentDistance;
    bolt.x += direction.x * distance; bolt.y += direction.y * distance; bolt.z += direction.z * distance;
    bolt.vy -= bolt.gravity * dt * distance / fullDistance;
    bolt.traveledDistance += distance;
    if (hit) {
      const target = state.players?.find(player => player.id === hit.playerId), headshot = hit.kind === 'head';
      const damage = target?.alive && target.team !== bolt.team && (headshot || hit.kind === 'body')
        ? Math.round(bolt.damage * (headshot ? bolt.headMultiplier : 1)) : 0;
      if (damage > 0) {
        const queued = { playerId: bolt.playerId, targetId: target.id, damage, headshot, attack: 'bolt', weapon: bolt.weapon };
        hits.push(queued); queueDamage(queued);
      }
      emit('boltHit', { ...eventData(bolt), targetId: target?.id ?? null, damage, headshot,
        hitKind: hit.kind, colliderId: hit.colliderId ?? null, traveledDistance: bolt.traveledDistance,
        ...contactNormal(hit, bolt, direction, arena) });
    } else if (bolt.ageTicks < Math.min(MAX_TTL, bolt.ttlTicks) && bolt.traveledDistance < bolt.range - EPS) remaining.push(bolt);
  }
  state.bolts = remaining; return hits;
}
