/** Deterministic, server-owned frag grenades. Distances are metres; one step is 1/120s. */
export const GRENADE = Object.freeze({ radius: .12, fuseTicks: 288, blastRadius: 5.5, damage: 120, speed: 11.5, loft: 3.1, gravity: 18.4, restitution: .48, capacity: 6 });
export const MAX_GRENADES = 20;
const DT = 1 / 120, EPS = 1e-9, SKIN = 1e-7;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const finite = (n, fallback = 0) => Number.isFinite(n) ? n : fallback;
const axes = [['x', 'w'], ['y', 'h'], ['z', 'd']];
const noop = () => {};

/** Modes may expand the live budget without changing Breach's six-frag default. */
export function grenadeCapacity(state) {
  if (Number.isInteger(state.maxGrenades)) return clamp(state.maxGrenades, 0, MAX_GRENADES);
  return clamp(Math.floor(finite(state.capacity, state.players?.length ?? 2)), 0, GRENADE.capacity);
}

function boxNormal(point, box) {
  const nearest = { x: clamp(point.x, box.x, box.x + box.w), y: clamp(point.y, box.y, box.y + box.h), z: clamp(point.z, box.z, box.z + box.d) };
  const x = point.x - nearest.x, y = point.y - nearest.y, z = point.z - nearest.z, length = Math.hypot(x, y, z);
  if (length > EPS) return { nx: x / length, ny: y / length, nz: z / length };
  // Only invalid inside starts need this deterministic nearest-face fallback.
  const faces = [
    { depth: point.x - box.x, nx: -1, ny: 0, nz: 0 }, { depth: box.x + box.w - point.x, nx: 1, ny: 0, nz: 0 },
    { depth: point.y - box.y, nx: 0, ny: -1, nz: 0 }, { depth: box.y + box.h - point.y, nx: 0, ny: 1, nz: 0 },
    { depth: point.z - box.z, nx: 0, ny: 0, nz: -1 }, { depth: box.z + box.d - point.z, nx: 0, ny: 0, nz: 1 },
  ];
  return faces.reduce((best, face) => face.depth < best.depth ? face : best);
}

/**
 * Exact continuous sphere/AABB contact. Splitting at box faces makes squared
 * distance to the box a quadratic on each interval, including rounded edges
 * and corners. An expanded-box slab would falsely block those clearances.
 */
export function sweepSphereBox(origin, delta, box, radius = GRENADE.radius) {
  const cuts = [0, 1];
  for (const [axis, size] of axes) if (Math.abs(delta[axis]) > EPS) for (const face of [box[axis], box[axis] + box[size]]) {
    const t = (face - origin[axis]) / delta[axis]; if (t > 0 && t < 1) cuts.push(t);
  }
  cuts.sort((a, b) => a - b);
  for (let index = 0; index < cuts.length - 1; index++) {
    const lo = cuts[index], hi = cuts[index + 1]; if (hi - lo < EPS) continue;
    const middle = (lo + hi) / 2; let a = 0, b = 0, c = -radius * radius;
    for (const [axis, size] of axes) {
      const at = origin[axis] + delta[axis] * middle, min = box[axis], max = min + box[size];
      if (at >= min && at <= max) continue;
      const offset = origin[axis] - (at < min ? min : max), velocity = delta[axis];
      a += velocity * velocity; b += 2 * offset * velocity; c += offset * offset;
    }
    let t = null;
    const value = a * lo * lo + b * lo + c, derivative = 2 * a * lo + b;
    if (value < -EPS || (value <= EPS && derivative < -EPS)) t = lo;
    else if (a > EPS * EPS) {
      const discriminant = b * b - 4 * a * c;
      if (discriminant >= 0) {
        const root = (-b - Math.sqrt(discriminant)) / (2 * a);
        if (root >= lo - EPS && root <= hi + EPS && 2 * a * root + b < -EPS) t = clamp(root, lo, hi);
      }
    }
    if (t !== null) {
      const point = { x: origin.x + delta.x * t, y: origin.y + delta.y * t, z: origin.z + delta.z * t };
      return { t, ...boxNormal(point, box), colliderId: box.id ?? null };
    }
  }
  return null;
}

function firstContact(origin, delta, arena, radius) {
  let first = null;
  const accept = contact => { if (contact && contact.t >= -EPS && contact.t <= 1 + EPS && (!first || contact.t < first.t - EPS)) first = { ...contact, t: clamp(contact.t, 0, 1) }; };
  for (const box of arena.colliders) accept(sweepSphereBox(origin, delta, box, radius));
  const bound = (axis, face, normal, colliderId) => {
    const velocity = delta[axis]; if (velocity * normal >= -EPS) return;
    accept({ t: (face - origin[axis]) / velocity, nx: axis === 'x' ? normal : 0, ny: axis === 'y' ? normal : 0, nz: axis === 'z' ? normal : 0, colliderId });
  };
  bound('x', arena.bounds.minX + radius, 1, 'bounds-west'); bound('x', arena.bounds.maxX - radius, -1, 'bounds-east');
  bound('z', arena.bounds.minZ + radius, 1, 'bounds-north'); bound('z', arena.bounds.maxZ - radius, -1, 'bounds-south');
  bound('y', radius, 1, 'floor');
  return first;
}

function boundedPosition(grenade, arena) {
  grenade.x = clamp(grenade.x, arena.bounds.minX + grenade.radius, arena.bounds.maxX - grenade.radius);
  grenade.z = clamp(grenade.z, arena.bounds.minZ + grenade.radius, arena.bounds.maxZ - grenade.radius);
  grenade.y = Math.max(grenade.radius, grenade.y);
}

function eventData(grenade) {
  return { grenadeId: grenade.id, playerId: grenade.playerId, team: grenade.team, x: grenade.x, y: grenade.y, z: grenade.z, attack: 'grenade' };
}

/** Caller owns the input edge and live-round gate. Inventory changes only on a successful throw. */
export function throwGrenade(state, player, arena, emit = noop) {
  const active = Array.isArray(state.grenades) ? state.grenades : [], capacity = grenadeCapacity(state);
  if (!player?.alive || !Number.isInteger(player.grenades) || player.grenades <= 0 || active.length >= capacity) return null;
  const yaw = finite(player.yaw), pitch = clamp(finite(player.pitch), -1.35, 1.35), cosine = Math.cos(pitch);
  const direction = { x: Math.sin(yaw) * cosine, y: Math.sin(pitch), z: -Math.cos(yaw) * cosine };
  const origin = { x: finite(player.x), y: Math.max(0, finite(player.y)) + (player.crouching ? .98 : 1.62), z: finite(player.z) };
  const offset = { x: direction.x * .42, y: direction.y * .42, z: direction.z * .42 }, contact = firstContact(origin, offset, arena, GRENADE.radius);
  const distance = contact ? Math.max(0, contact.t - SKIN) : 1;
  const grenade = {
    id: Math.max(0, Math.floor(finite(state.grenadeId))) + 1, playerId: player.id, team: player.team,
    x: origin.x + offset.x * distance, y: origin.y + offset.y * distance, z: origin.z + offset.z * distance,
    vx: direction.x * GRENADE.speed + clamp(finite(player.vx), -8, 8) * .3,
    vy: direction.y * GRENADE.speed + GRENADE.loft + clamp(finite(player.vy), -8, 8) * .2,
    vz: direction.z * GRENADE.speed + clamp(finite(player.vz), -8, 8) * .3,
    radius: GRENADE.radius, fuseTicks: GRENADE.fuseTicks, bornTick: Math.max(0, Math.floor(finite(state.tick))), bounces: 0,
  };
  boundedPosition(grenade, arena); state.grenades = active; state.grenadeId = grenade.id; active.push(grenade); player.grenades--;
  emit('grenadeThrow', { ...eventData(grenade), vx: grenade.vx, vy: grenade.vy, vz: grenade.vz, radius: grenade.radius, fuseTicks: grenade.fuseTicks });
  return grenade;
}

function moveGrenade(grenade, arena, emit) {
  grenade.vy -= GRENADE.gravity * DT; let remaining = DT;
  for (let pass = 0; pass < 6 && remaining > EPS; pass++) {
    const delta = { x: grenade.vx * remaining, y: grenade.vy * remaining, z: grenade.vz * remaining };
    const contact = firstContact(grenade, delta, arena, grenade.radius), t = contact?.t ?? 1;
    grenade.x += delta.x * t; grenade.y += delta.y * t; grenade.z += delta.z * t;
    if (!contact) break;
    grenade.x += contact.nx * SKIN; grenade.y += contact.ny * SKIN; grenade.z += contact.nz * SKIN;
    const normalSpeed = grenade.vx * contact.nx + grenade.vy * contact.ny + grenade.vz * contact.nz;
    if (normalSpeed < -EPS) {
      const restitution = -normalSpeed < 1.35 ? 0 : GRENADE.restitution;
      const tangentFriction = contact.ny > .7 ? .8 : .94;
      const vx = grenade.vx - normalSpeed * contact.nx, vy = grenade.vy - normalSpeed * contact.ny, vz = grenade.vz - normalSpeed * contact.nz;
      grenade.vx = vx * tangentFriction - normalSpeed * restitution * contact.nx;
      grenade.vy = vy * tangentFriction - normalSpeed * restitution * contact.ny;
      grenade.vz = vz * tangentFriction - normalSpeed * restitution * contact.nz;
      if (-normalSpeed > 1.35 && grenade.bounces < 12) {
        grenade.bounces++;
        emit('grenadeBounce', { ...eventData(grenade), nx: contact.nx, ny: contact.ny, nz: contact.nz, speed: -normalSpeed, colliderId: contact.colliderId, fuseTicks: grenade.fuseTicks });
      }
      if (contact.ny > .7 && Math.abs(grenade.vy) < .1) {
        const speed = Math.hypot(grenade.vx, grenade.vz), fraction = speed > EPS ? Math.max(0, 1 - 3.5 * DT / speed) : 0;
        grenade.vx *= fraction; grenade.vz *= fraction;
      }
    }
    remaining *= 1 - t;
  }
  boundedPosition(grenade, arena);
}

function rayBox(origin, direction, box, distance) {
  let near = 0, far = distance;
  for (const [axis, size] of axes) {
    const speed = direction[axis], start = origin[axis], min = box[axis], max = min + box[size];
    if (Math.abs(speed) < EPS) { if (start < min - EPS || start > max + EPS) return null; }
    else {
      let lo = (min - start) / speed, hi = (max - start) / speed; if (lo > hi) [lo, hi] = [hi, lo];
      near = Math.max(near, lo); far = Math.min(far, hi); if (near > far + EPS) return null;
    }
  }
  return far < -EPS || near > distance + EPS ? null : Math.max(0, near);
}

function visible(origin, point, arena) {
  const x = point.x - origin.x, y = point.y - origin.y, z = point.z - origin.z, distance = Math.hypot(x, y, z);
  if (distance < EPS) return true;
  const direction = { x: x / distance, y: y / distance, z: z / distance };
  return !arena.colliders.some(box => { const contact = rayBox(origin, direction, box, distance); return contact !== null && contact < distance - EPS; });
}

/** Exact cover rays to chest, head, legs and shoulders; a hidden body is never damaged. */
export function grenadeBlastHits(state, grenade, arena) {
  const hits = [];
  for (const player of state.players ?? []) {
    if (!player.alive || (player.team === grenade.team && player.id !== grenade.playerId)) continue;
    const height = player.crouching ? 1.15 : 1.8, radius = finite(player.radius, .32);
    const horizontal = Math.hypot(player.x - grenade.x, player.z - grenade.z), distanceXz = Math.max(0, horizontal - radius);
    const distanceY = grenade.y < player.y ? player.y - grenade.y : grenade.y > player.y + height ? grenade.y - player.y - height : 0;
    const distance = Math.hypot(distanceXz, distanceY); if (distance >= GRENADE.blastRadius) continue;
    const sideX = horizontal > EPS ? -(player.z - grenade.z) / horizontal * radius * .8 : radius * .8;
    const sideZ = horizontal > EPS ? (player.x - grenade.x) / horizontal * radius * .8 : 0;
    const samples = [
      { x: player.x, y: player.y + height * .52, z: player.z },
      { x: player.x, y: player.y + height * .9, z: player.z },
      { x: player.x, y: player.y + height * .16, z: player.z },
      { x: player.x + sideX, y: player.y + height * .55, z: player.z + sideZ },
      { x: player.x - sideX, y: player.y + height * .55, z: player.z - sideZ },
    ];
    const exposed = samples.filter(point => visible(grenade, point, arena)).length; if (!exposed) continue;
    const falloff = Math.max(0, 1 - distance / GRENADE.blastRadius);
    const damage = Math.round(GRENADE.damage * falloff * (.3 + .7 * exposed / samples.length));
    if (damage > 0) hits.push({ playerId: grenade.playerId, targetId: player.id, damage, headshot: false, attack: 'grenade' });
  }
  return hits;
}

/** Fuse/physics are independent of the thrower's current life or position. */
export function advanceGrenades(state, arena, { emit = noop, queueDamage = noop } = {}) {
  if (!Array.isArray(state.grenades) || !state.grenades.length) return [];
  const capacity = grenadeCapacity(state), remaining = [], hits = [];
  for (const grenade of state.grenades.slice(0, capacity)) {
    // A corrupt snapshot must not poison the authoritative simulation.
    if (![grenade.x, grenade.y, grenade.z, grenade.vx, grenade.vy, grenade.vz, grenade.fuseTicks].every(Number.isFinite) || grenade.fuseTicks <= 0) continue;
    if (grenade.bornTick === state.tick) { remaining.push(grenade); continue; }
    grenade.radius = GRENADE.radius; grenade.fuseTicks = Math.min(GRENADE.fuseTicks, Math.floor(grenade.fuseTicks)) - 1;
    moveGrenade(grenade, arena, emit);
    if (grenade.fuseTicks <= 0) {
      const damage = grenadeBlastHits(state, grenade, arena); for (const hit of damage) { hits.push(hit); queueDamage(hit); }
      emit('grenadeExplosion', { ...eventData(grenade), radius: GRENADE.blastRadius, fuseTicks: 0 });
    } else remaining.push(grenade);
  }
  state.grenades = remaining; return hits;
}
