/** Cached navigation for the shipped voxel body and authored, tested climb routes. */
import { WORLD, rayBox } from './voxel-engine.js';

const EPS = 1e-7, CELL = 1.25, MAX_NODES = 6000, MAX_RISE = 1.01, MAX_DROP = 4.2;
const caches = new WeakMap();
const collisionIndexes = new WeakMap();
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const footY = point => Number.isFinite(point?.y) ? point.y : 0;

function validMap(map) {
  return map && Array.isArray(map.colliders) && map.bounds
    && ['minX', 'maxX', 'minZ', 'maxZ'].every(key => Number.isFinite(map.bounds[key]))
    && map.bounds.minX < map.bounds.maxX && map.bounds.minZ < map.bounds.maxZ;
}

function nearbyColliders(map, minX, maxX, minZ, maxZ) {
  let index = collisionIndexes.get(map);
  if (!index) {
    const cell = Math.max(2.5, Math.sqrt((map.bounds.maxX - map.bounds.minX) * (map.bounds.maxZ - map.bounds.minZ) / MAX_NODES)), buckets = new Map();
    for (const box of map.colliders) {
      const left = Math.floor(Math.max(map.bounds.minX - WORLD.radius, box.x) / cell), right = Math.floor(Math.min(map.bounds.maxX + WORLD.radius, box.x + box.w) / cell);
      const top = Math.floor(Math.max(map.bounds.minZ - WORLD.radius, box.z) / cell), bottom = Math.floor(Math.min(map.bounds.maxZ + WORLD.radius, box.z + box.d) / cell);
      for (let z = top; z <= bottom; z++) for (let x = left; x <= right; x++) {
        const key = `${x}:${z}`; if (!buckets.has(key)) buckets.set(key, []); buckets.get(key).push(box);
      }
    }
    index = { cell, buckets }; collisionIndexes.set(map, index);
  }
  const boxes = new Set();
  for (let z = Math.floor(minZ / index.cell); z <= Math.floor(maxZ / index.cell); z++) for (let x = Math.floor(minX / index.cell); x <= Math.floor(maxX / index.cell); x++) for (const box of index.buckets.get(`${x}:${z}`) || []) boxes.add(box);
  return [...boxes];
}

/** Matches the engine's circular body and standing headroom, rather than inflated boxes. */
export function navigationCanOccupy(map, point, { radius = WORLD.radius, height = WORLD.standHeight } = {}) {
  if (!validMap(map) || !Number.isFinite(point?.x) || !Number.isFinite(point?.z) || (point?.y !== undefined && !Number.isFinite(point.y)) || !Number.isFinite(radius) || !Number.isFinite(height) || radius <= 0 || height <= 0) return false;
  const y = footY(point), { minX, maxX, minZ, maxZ } = map.bounds;
  if (y < -EPS || point.x < minX + radius - EPS || point.x > maxX - radius + EPS || point.z < minZ + radius - EPS || point.z > maxZ - radius + EPS) return false;
  return !map.colliders.some(box => {
    if (y >= box.y + box.h - EPS || y + height <= box.y + EPS) return false;
    const dx = point.x - clamp(point.x, box.x, box.x + box.w), dz = point.z - clamp(point.z, box.z, box.z + box.d);
    return dx * dx + dz * dz < radius * radius - EPS;
  });
}

function supported(map, point, spatial = false) {
  if (spatial) map = { bounds: map.bounds, colliders: nearbyColliders(map, point.x - WORLD.radius, point.x + WORLD.radius, point.z - WORLD.radius, point.z + WORLD.radius) };
  const y = footY(point);
  if (!navigationCanOccupy(map, point)) return false;
  if (Math.abs(y) <= EPS) return true;
  return map.colliders.some(box => Math.abs(box.y + box.h - y) <= EPS
    && point.x >= box.x + WORLD.radius - EPS && point.x <= box.x + box.w - WORLD.radius + EPS
    && point.z >= box.z + WORLD.radius - EPS && point.z <= box.z + box.d - WORLD.radius + EPS);
}

function contactSupported(map, point) {
  return map.colliders.some(box => {
    if (Math.abs(box.y + box.h - point.y) > EPS) return false;
    const dx = point.x - clamp(point.x, box.x, box.x + box.w), dz = point.z - clamp(point.z, box.z, box.z + box.d);
    return dx * dx + dz * dz < WORLD.radius ** 2 - EPS;
  });
}

function floorPoint(map, point) {
  if (point.y <= EPS || contactSupported(map, point)) return point;
  const boxes = nearbyColliders(map, point.x - WORLD.radius, point.x + WORLD.radius, point.z - WORLD.radius, point.z + WORLD.radius);
  const heights = [...new Set([0, ...boxes.map(box => box.y + box.h).filter(y => y <= point.y + EPS)])].sort((a, b) => b - a);
  for (const y of heights) {
    const candidate = { ...point, y };
    if (navigationCanOccupy(map, candidate) && (y <= EPS || contactSupported(map, candidate))) return candidate;
  }
  return point;
}

/** World-only visibility: callers can separately check living bodies with traceShot. */
export function navigationVisible(map, origin, target) {
  if (!validMap(map) || ![origin?.x, origin?.y, origin?.z, target?.x, target?.y, target?.z].every(Number.isFinite)) return false;
  const dx = target.x - origin.x, dy = target.y - origin.y, dz = target.z - origin.z, distance = Math.hypot(dx, dy, dz);
  if (distance < EPS) return true;
  const direction = { x: dx / distance, y: dy / distance, z: dz / distance };
  return !map.colliders.some(box => {
    const contact = rayBox(origin, direction, box, distance);
    return contact !== null && contact < distance - EPS;
  });
}

function clearWalk(map, from, to, trustedEndpoints = false) {
  if (Math.abs(footY(from) - footY(to)) > EPS || (!trustedEndpoints && (!navigationCanOccupy(map, from) || !navigationCanOccupy(map, to)))) return false;
  const dx = to.x - from.x, dz = to.z - from.z, lengthSquared = dx * dx + dz * dz, y = footY(from), radius = WORLD.radius;
  if (lengthSquared < EPS * EPS) return true;
  const boxes = nearbyColliders(map, Math.min(from.x, to.x) - radius, Math.max(from.x, to.x) + radius, Math.min(from.z, to.z) - radius, Math.max(from.z, to.z) + radius);
  for (const box of boxes) {
    if (y >= box.y + box.h - EPS || y + WORLD.standHeight <= box.y + EPS) continue;
    if (Math.max(from.x, to.x) + radius < box.x || Math.min(from.x, to.x) - radius > box.x + box.w || Math.max(from.z, to.z) + radius < box.z || Math.min(from.z, to.z) - radius > box.z + box.d) continue;
    let near = 0, far = 1;
    for (const [start, delta, low, high] of [[from.x, dx, box.x, box.x + box.w], [from.z, dz, box.z, box.z + box.d]]) {
      if (Math.abs(delta) < EPS) { if (start < low || start > high) { near = 2; break; } }
      else { let lo = (low - start) / delta, hi = (high - start) / delta; if (lo > hi) [lo, hi] = [hi, lo]; near = Math.max(near, lo); far = Math.min(far, hi); }
    }
    if (near <= far && near <= 1 && far >= 0) return false;
    for (const x of [box.x, box.x + box.w]) for (const z of [box.z, box.z + box.d]) {
      const t = clamp(((x - from.x) * dx + (z - from.z) * dz) / lengthSquared, 0, 1), ox = x - from.x - dx * t, oz = z - from.z - dz * t;
      if (ox * ox + oz * oz < radius * radius - EPS) return false;
    }
  }
  if (y > EPS) {
    const steps = Math.ceil(Math.sqrt(lengthSquared) / .18);
    const localMap = { bounds: map.bounds, colliders: boxes };
    for (let step = 0; step <= steps; step++) if (!contactSupported(localMap, { x: from.x + dx * step / steps, y, z: from.z + dz * step / steps })) return false;
  }
  return true;
}

function transition(map, from, to) {
  const rise = footY(to) - footY(from), distance = Math.hypot(to.x - from.x, to.z - from.z);
  if (Math.abs(rise) <= EPS) return clearWalk(map, from, to) ? { jump: false } : null;
  if (rise > MAX_RISE + EPS || rise < -MAX_DROP - EPS || distance > 2.6 || !supported(map, from) || !supported(map, to)) return null;
  // Graph construction uses bounded geometric clearance. Real movement through
  // every authored climb is verified separately; never run physics in AI planning.
  const radius = WORLD.radius;
  const corridor = { minX: Math.min(from.x, to.x), maxX: Math.max(from.x, to.x), minZ: Math.min(from.z, to.z), maxZ: Math.max(from.z, to.z) };
  const ceiling = Math.max(footY(from), footY(to)) + WORLD.jumpSpeed ** 2 / (2 * WORLD.gravity) + WORLD.standHeight;
  const localMap = { bounds: map.bounds, colliders: nearbyColliders(map, corridor.minX - radius, corridor.maxX + radius, corridor.minZ - radius, corridor.maxZ + radius).filter(box => box.y <= ceiling && box.y + box.h >= Math.min(footY(from), footY(to)) - EPS) };
  const duration = rise > EPS ? 0 : Math.sqrt(-2 * rise / WORLD.gravity);
  const apex = footY(from) + WORLD.jumpSpeed ** 2 / (2 * WORLD.gravity) - .025;
  for (let sample = 1; sample < 18; sample++) {
    const fraction = sample / 18, time = fraction * duration, point = { x: from.x + (to.x - from.x) * fraction, z: from.z + (to.z - from.z) * fraction };
    // A bot can press against a low ledge during the rise; testing an invented
    // constant horizontal speed would incorrectly reject .9–1 m crates. The
    // short, explicit jump links require clear headroom at the actual apex.
    if (rise > EPS) point.y = apex;
    else {
      // Descending feet stay on the old support until the disc leaves its edge.
      let support = footY(to);
      for (const box of localMap.colliders) if (box.y + box.h <= footY(from) + EPS) {
        const dx = point.x - clamp(point.x, box.x, box.x + box.w), dz = point.z - clamp(point.z, box.z, box.z + box.d);
        if (dx * dx + dz * dz < radius * radius + EPS) support = Math.max(support, box.y + box.h);
      }
      point.y = Math.max(support, footY(from) - .5 * WORLD.gravity * time * time);
    }
    if (!navigationCanOccupy(localMap, point)) return null;
  }
  if (rise > EPS) for (let sample = 1; sample <= 8; sample++) if (!navigationCanOccupy(localMap, { x: from.x, y: footY(from) + (apex - footY(from)) * sample / 8, z: from.z })) return null;
  return { jump: rise > EPS };
}

function navigationFor(map) {
  if (caches.has(map)) return caches.get(map);
  const radius = WORLD.radius;
  const width = map.bounds.maxX - map.bounds.minX, depth = map.bounds.maxZ - map.bounds.minZ;
  // Preserve a bounded build budget even for a caller-provided oversized arena.
  const cell = Math.max(CELL, Math.sqrt(width * depth / (MAX_NODES * .7)));
  const nodes = [], buckets = new Map(), coordinates = new Map(), edges = new Map(), verticalLinks = new Map();
  function add(point) {
    if (nodes.length >= MAX_NODES || !supported(map, point, true)) return -1;
    const key = `${point.x.toFixed(5)}:${footY(point).toFixed(5)}:${point.z.toFixed(5)}`;
    if (coordinates.has(key)) return coordinates.get(key);
    const node = Object.freeze({ x: point.x, y: footY(point), z: point.z });
    const id = nodes.length; nodes.push(node);
    coordinates.set(key, id);
    const bucket = `${Math.floor(point.x / CELL)}:${Math.floor(point.z / CELL)}`;
    if (!buckets.has(bucket)) buckets.set(bucket, []); buckets.get(bucket).push(id); return id;
  }
  function connect(from, to) {
    if (from < 0 || to < 0 || from === to) return;
    for (const [first, second] of [[from, to], [to, from]]) {
      const edge = transition(map, nodes[first], nodes[second]);
      if (!edge) continue;
      if (!verticalLinks.has(first)) verticalLinks.set(first, []);
      const a = nodes[first], b = nodes[second];
      verticalLinks.get(first).push({ id: second, jump: edge.jump, cost: Math.hypot(a.x - b.x, a.z - b.z) + Math.abs(a.y - b.y) * .4 + (edge.jump ? .6 : 0) });
    }
  }
  // Authored paths cover narrow, intentionally playable ledges before coarse samples.
  for (const route of map.routes || []) {
    let previous = add(route.start);
    for (const point of route.approach || []) add(point);
    for (const point of route.steps || []) {
      const support = map.colliders.find(box => box.id === point.colliderId);
      if (support) { const current = add({ ...point, y: support.y + support.h }); connect(previous, current); previous = current; }
    }
  }
  // A low crate remains reachable even when it is not part of an authored stair.
  // Four explicit entrances bound the number of jump checks independently of grid size.
  for (const box of map.colliders) {
    if (box.w < radius * 2 + .06 || box.d < radius * 2 + .06 || box.y + box.h > MAX_DROP) continue;
    const y = box.y + box.h, inset = radius + .03;
    for (const [inside, outside] of [
      [{ x: box.x + inset, z: box.z + box.d / 2 }, { x: box.x - .6, z: box.z + box.d / 2 }],
      [{ x: box.x + box.w - inset, z: box.z + box.d / 2 }, { x: box.x + box.w + .6, z: box.z + box.d / 2 }],
      [{ x: box.x + box.w / 2, z: box.z + inset }, { x: box.x + box.w / 2, z: box.z - .6 }],
      [{ x: box.x + box.w / 2, z: box.z + box.d - inset }, { x: box.x + box.w / 2, z: box.z + box.d + .6 }],
    ]) {
      let base = 0;
      for (const support of map.colliders) if (support.y + support.h < y - EPS && outside.x >= support.x + radius && outside.x <= support.x + support.w - radius && outside.z >= support.z + radius && outside.z <= support.z + support.d - radius) base = Math.max(base, support.y + support.h);
      if (y - base > MAX_RISE + EPS) continue;
      connect(add({ ...outside, y: base }), add({ ...inside, y }));
    }
  }
  for (const point of map.spawns?.flat() || map.spawnPoints || []) add(point);
  for (let z = map.bounds.minZ + cell / 2; z < map.bounds.maxZ; z += cell) for (let x = map.bounds.minX + cell / 2; x < map.bounds.maxX; x += cell) {
    add({ x, y: 0, z });
    const heights = new Set();
    for (const box of nearbyColliders(map, x - radius, x + radius, z - radius, z + radius)) if (box.y + box.h > EPS && x >= box.x + WORLD.radius - EPS && x <= box.x + box.w - WORLD.radius + EPS && z >= box.z + WORLD.radius - EPS && z <= box.z + box.d - WORLD.radius + EPS) heights.add(box.y + box.h);
    for (const y of heights) add({ x, y, z });
  }
  const result = { nodes: Object.freeze(nodes), buckets, edges, verticalLinks, cell }; caches.set(map, result); return result;
}

/** Immutable standable points are reusable for choosing separated, reachable spawns. */
export function navigationPoints(map) { return validMap(map) ? navigationFor(map).nodes : Object.freeze([]); }

function neighbors(map, nav, id) {
  if (nav.edges.has(id)) return nav.edges.get(id);
  const node = nav.nodes[id], column = Math.floor(node.x / CELL), row = Math.floor(node.z / CELL), result = [...(nav.verticalLinks.get(id) || [])];
  const reach = Math.ceil(Math.max(nav.cell * 1.45, 2.6) / CELL);
  for (let dz = -reach; dz <= reach; dz++) for (let dx = -reach; dx <= reach; dx++) for (const next of nav.buckets.get(`${column + dx}:${row + dz}`) || []) {
    if (next === id) continue;
    const target = nav.nodes[next], distance = Math.hypot(target.x - node.x, target.z - node.z);
    if (distance > Math.max(nav.cell * 1.45, 2.6) || Math.abs(target.y - node.y) > EPS) continue;
    const edge = clearWalk(map, node, target, true) ? { jump: false } : null;
    if (edge) result.push({ id: next, jump: edge.jump, cost: distance + Math.abs(target.y - node.y) * .4 + (edge.jump ? .6 : 0) });
  }
  nav.edges.set(id, result); return result;
}

function nearest(map, nav, point, toward) {
  let best = Infinity, selected = -1, connection = null;
  for (let id = 0; id < nav.nodes.length; id++) {
    const node = nav.nodes[id], distance = Math.hypot(node.x - point.x, node.z - point.z) + Math.abs(node.y - footY(point)) * 3;
    if (distance >= best || Math.abs(node.y - footY(point)) > .025) continue;
    const edge = toward ? transition(map, node, point) : transition(map, point, node);
    if (edge) { selected = id; best = distance; connection = edge; }
  }
  return { id: selected, connection };
}

class MinHeap {
  values = [];
  push(entry) {
    const entries = this.values; entries.push(entry); let index = entries.length - 1;
    while (index > 0) { const parent = (index - 1) >> 1; if (entries[parent].priority <= entry.priority) break; entries[index] = entries[parent]; index = parent; }
    entries[index] = entry;
  }
  pop() {
    const entries = this.values, result = entries[0], last = entries.pop();
    if (entries.length) {
      let index = 0;
      while (true) { const left = index * 2 + 1, right = left + 1; if (left >= entries.length) break; const child = right < entries.length && entries[right].priority < entries[left].priority ? right : left; if (entries[child].priority >= last.priority) break; entries[index] = entries[child]; index = child; }
      entries[index] = last;
    }
    return result;
  }
}

/** Fresh waypoints; a jump waypoint is consumed only after its landing height is reached. */
export function navigationPath(map, from, target) {
  if (!validMap(map) || !navigationCanOccupy(map, from) || !navigationCanOccupy(map, target)) return [];
  // A short human jump does not make the whole pursuing pack forget its route.
  const origin = floorPoint(map, { x: from.x, y: footY(from), z: from.z }), goal = floorPoint(map, { x: target.x, y: footY(target), z: target.z });
  // Vertical travel uses the prepared short entrances and authored platform
  // chains. An arbitrary long diagonal toward a high target is not a jump link.
  const direct = Math.abs(origin.y - goal.y) <= EPS ? transition(map, origin, goal) : null;
  if (direct) return [{ ...goal, jump: direct.jump }];
  const nav = navigationFor(map), start = nearest(map, nav, origin, false), end = nearest(map, nav, goal, true);
  if (start.id < 0 || end.id < 0) return [];
  const costs = new Float64Array(nav.nodes.length).fill(Infinity), parents = new Int32Array(nav.nodes.length).fill(-1), jumps = new Uint8Array(nav.nodes.length), closed = new Uint8Array(nav.nodes.length), heap = new MinHeap();
  costs[start.id] = 0; jumps[start.id] = Number(start.connection.jump); heap.push({ id: start.id, priority: 0 });
  while (heap.values.length) {
    const { id } = heap.pop(); if (closed[id]) continue; closed[id] = 1; if (id === end.id) break;
    for (const edge of neighbors(map, nav, id)) {
      const cost = costs[id] + edge.cost; if (cost >= costs[edge.id]) continue;
      costs[edge.id] = cost; parents[edge.id] = id; jumps[edge.id] = Number(edge.jump);
      const point = nav.nodes[edge.id], destination = nav.nodes[end.id];
      heap.push({ id: edge.id, priority: cost + Math.hypot(point.x - destination.x, point.z - destination.z) });
    }
  }
  if (!closed[end.id]) return [];
  const route = [];
  for (let id = end.id; id >= 0; id = parents[id]) route.push({ ...nav.nodes[id], jump: Boolean(jumps[id]) });
  route.reverse();
  if (Math.hypot(route.at(-1).x - goal.x, route.at(-1).z - goal.z) > EPS) route.push({ ...goal, jump: end.connection.jump });
  return route;
}
