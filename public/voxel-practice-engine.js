/** Local drills use the shipped movement, weapons, damage and Royale rules at 120 Hz. */
import { MAPS as BREACH_MAPS, createState as createBreachState, createCombatPlayer, combatStep, emptyInput, eyeHeight, playerHeight, aimDirection, traceShot, emitCombatEvent, TICK_RATE, WORLD, findNearbyLoot, pickupCombatLoot, advanceInventoryLoot } from './voxel-engine.js';
import * as Royale from './voxel-royale-engine.js';
import { WEAPONS } from './voxel-weapons.js';

export { TICK_RATE, emptyInput };
export const PRACTICE_DIFFICULTIES = Object.freeze({
  rookie: Object.freeze({ reactionTicks: 72, turnSpeed: 3.2, aimError: .065, burstTicks: 18, restTicks: 78 }),
  regular: Object.freeze({ reactionTicks: 48, turnSpeed: 4.8, aimError: .032, burstTicks: 24, restTicks: 48 }),
  veteran: Object.freeze({ reactionTicks: 30, turnSpeed: 6.4, aimError: .016, burstTicks: 30, restTicks: 30 }),
});
const EPS = 1e-7, CELL = 1.25, MAX_DRILL_TICKS = 300 * TICK_RATE;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const wrap = angle => Math.atan2(Math.sin(angle), Math.cos(angle));
const navigation = new WeakMap();
const walkGeometry = new WeakMap();
const sessionMaps = new WeakMap();
function random(practice) {
  let value = practice.randomState >>> 0;
  value ^= value << 13; value ^= value >>> 17; value ^= value << 5;
  practice.randomState = value >>> 0;
  return practice.randomState / 0x100000000;
}
function normalize(options = {}) {
  const alias = { voxel: 'voxel', breach: 'voxel', 'voxel-breach': 'voxel', royale: 'voxel-royale', 'voxel-royale': 'voxel-royale' };
  const requestedGame = options.game ?? 'voxel', game = Object.hasOwn(alias, requestedGame) ? alias[requestedGame] : null;
  if (!game) throw new RangeError('Choose Breach or Royale practice.');
  const maps = game === 'voxel' ? BREACH_MAPS : Royale.MAPS;
  const mapId = options.mapId ?? (game === 'voxel' ? 'courtyard' : 'forest');
  const bots = options.bots ?? 3, mode = options.mode ?? 'combat', weapon = options.weapon ?? 'carbine', difficulty = options.difficulty ?? 'regular';
  if (!Object.hasOwn(maps, mapId)) throw new RangeError('Unknown practice map.');
  if (!Number.isInteger(bots) || bots < 1 || bots > 5) throw new RangeError('Practice supports 1–5 bots.');
  if (!['targets', 'combat'].includes(mode)) throw new RangeError('Choose moving targets or combat bots.');
  if (!Object.hasOwn(WEAPONS, weapon)) throw new RangeError('Unknown practice weapon.');
  if (!Object.hasOwn(PRACTICE_DIFFICULTIES, difficulty)) throw new RangeError('Unknown bot difficulty.');
  if (options.seed !== undefined && !Number.isInteger(options.seed)) throw new RangeError('Practice seed must be an integer.');
  return { game, mapId, bots, mode, weapon, difficulty, seed: options.seed === undefined ? (Date.now() ^ Math.floor(Math.random() * 0x100000000)) >>> 0 : options.seed >>> 0 };
}
function freeGround(arena, point, radius = WORLD.radius + .065) {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.z)) return false;
  const { minX, maxX, minZ, maxZ } = arena.bounds;
  if (point.x < minX + radius || point.x > maxX - radius || point.z < minZ + radius || point.z > maxZ - radius) return false;
  return !arena.colliders.some(box => {
    if (box.y >= WORLD.standHeight - EPS || box.y + box.h <= EPS) return false;
    const dx = point.x - clamp(point.x, box.x, box.x + box.w), dz = point.z - clamp(point.z, box.z, box.z + box.d);
    return dx * dx + dz * dz < radius * radius - EPS;
  });
}
function clearWalk(arena, from, to) {
  const dx = to.x - from.x, dz = to.z - from.z, distance = Math.hypot(dx, dz);
  if (!freeGround(arena, to, WORLD.radius)) return false;
  if (distance < EPS) return true;
  // Exact segment/rectangle distance keeps legal wall and round-corner contacts
  // traversable. Inflated AABBs would trap a bot standing at the real .32 m contact.
  if (!walkGeometry.has(arena)) walkGeometry.set(arena, arena.colliders.filter(box => box.y < WORLD.standHeight - EPS && box.y + box.h > EPS));
  const radius = WORLD.radius, radiusSquared = radius * radius, lengthSquared = dx * dx + dz * dz;
  for (const box of walkGeometry.get(arena)) {
    if (Math.max(from.x, to.x) + radius < box.x || Math.min(from.x, to.x) - radius > box.x + box.w || Math.max(from.z, to.z) + radius < box.z || Math.min(from.z, to.z) - radius > box.z + box.d) continue;
    for (const point of [from, to]) {
      const ox = point.x - clamp(point.x, box.x, box.x + box.w), oz = point.z - clamp(point.z, box.z, box.z + box.d);
      if (ox * ox + oz * oz < radiusSquared - EPS) return false;
    }
    let near = 0, far = 1;
    for (const [start, delta, low, high] of [[from.x, dx, box.x, box.x + box.w], [from.z, dz, box.z, box.z + box.d]]) {
      if (Math.abs(delta) < EPS) { if (start < low || start > high) { near = 2; break; } }
      else { let lo = (low - start) / delta, hi = (high - start) / delta; if (lo > hi) [lo, hi] = [hi, lo]; near = Math.max(near, lo); far = Math.min(far, hi); }
    }
    if (near <= far && near <= 1 && far >= 0) return false;
    for (const x of [box.x, box.x + box.w]) for (const z of [box.z, box.z + box.d]) {
      const t = clamp(((x - from.x) * dx + (z - from.z) * dz) / lengthSquared, 0, 1), ox = x - from.x - dx * t, oz = z - from.z - dz * t;
      if (ox * ox + oz * oz < radiusSquared - EPS) return false;
    }
  }
  return true;
}
function navigationFor(arena) {
  if (navigation.has(arena)) return navigation.get(arena);
  const columns = Math.ceil((arena.bounds.maxX - arena.bounds.minX) / CELL), rows = Math.ceil((arena.bounds.maxZ - arena.bounds.minZ) / CELL);
  const nodes = [], grid = new Int32Array(columns * rows).fill(-1);
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    const point = { x: arena.bounds.minX + (column + .5) * CELL, z: arena.bounds.minZ + (row + .5) * CELL };
    if (!freeGround(arena, point)) continue;
    grid[row * columns + column] = nodes.length; nodes.push({ ...point, column, row, neighbors: [] });
  }
  for (const node of nodes) for (const [dc, dr] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
    const column = node.column + dc, row = node.row + dr;
    if (column < 0 || column >= columns || row < 0 || row >= rows) continue;
    const id = grid[row * columns + column];
    if (id >= 0 && clearWalk(arena, node, nodes[id])) node.neighbors.push(id);
  }
  const components = new Int32Array(nodes.length).fill(-1), queue = new Int32Array(nodes.length);
  let component = 0;
  for (let id = 0; id < nodes.length; id++) {
    if (components[id] !== -1) continue;
    let head = 0, tail = 1; queue[0] = id; components[id] = component;
    while (head < tail) for (const neighbor of nodes[queue[head++]].neighbors) if (components[neighbor] === -1) { components[neighbor] = component; queue[tail++] = neighbor; }
    component++;
  }
  const result = { nodes, components }; navigation.set(arena, result); return result;
}
function nearestNode(nav, point, arena, requireWalk = false) {
  let nearest = -1, best = Infinity;
  for (let id = 0; id < nav.nodes.length; id++) {
    const node = nav.nodes[id], distance = (node.x - point.x) ** 2 + (node.z - point.z) ** 2;
    if (distance >= best || (requireWalk && !clearWalk(arena, point, node))) continue;
    nearest = id; best = distance;
  }
  return nearest;
}
function route(arena, from, to) {
  if (clearWalk(arena, from, to)) return [{ x: to.x, z: to.z }];
  const nav = navigationFor(arena), start = nearestNode(nav, from, arena, true), end = nearestNode(nav, to, arena);
  if (start < 0 || end < 0 || nav.components[start] !== nav.components[end]) return [];
  const parents = new Int32Array(nav.nodes.length).fill(-2), queue = new Int32Array(nav.nodes.length);
  let head = 0, tail = 1; queue[0] = start; parents[start] = -1;
  while (head < tail && parents[end] === -2) {
    const current = queue[head++];
    for (const neighbor of nav.nodes[current].neighbors) if (parents[neighbor] === -2) { parents[neighbor] = current; queue[tail++] = neighbor; }
  }
  if (parents[end] === -2) return [];
  const result = [];
  for (let current = end; current >= 0; current = parents[current]) result.push({ x: nav.nodes[current].x, z: nav.nodes[current].z });
  result.reverse();
  if (clearWalk(arena, result.at(-1), to)) result.push({ x: to.x, z: to.z });
  return result;
}
function spawnBreach(state, config) {
  const arena = state.map, localSpawn = arena.spawns[0][0];
  const players = Array.from({ length: config.bots + 1 }, (_, id) => ({ ...createCombatPlayer(id, 1, id ? 'carbine' : config.weapon), team: id ? 1 : 0, bot: id > 0 }));
  Object.assign(players[0], localSpawn, { y: localSpawn.y || 0 });
  const candidates = [...arena.spawns[1], ...navigationFor(arena).nodes.slice().sort((a, b) => (a.x - arena.spawns[1][0].x) ** 2 + (a.z - arena.spawns[1][0].z) ** 2 - ((b.x - arena.spawns[1][0].x) ** 2 + (b.z - arena.spawns[1][0].z) ** 2))];
  for (let id = 1; id < players.length; id++) {
    const spawn = candidates.find(point => freeGround(arena, point, WORLD.radius) && players.slice(0, id).every(player => Math.hypot(player.x - point.x, player.z - point.z) > 1.1));
    if (!spawn) throw new RangeError('This map does not have enough safe bot spawns.');
    Object.assign(players[id], { x: spawn.x, z: spawn.z, y: spawn.y || 0, yaw: Number.isFinite(spawn.yaw) ? spawn.yaw : Math.PI, previousInput: emptyInput(spawn) });
  }
  players[0].previousInput = emptyInput(players[0]);
  state.players = state.fighters = players; state.capacity = players.length; state.bomb = null; state.maxRounds = 1;
}
export function createPractice(options = {}) {
  const config = normalize(options), state = config.game === 'voxel' ? createBreachState({ mapId: config.mapId }) : Royale.createState({ mapId: config.mapId, capacity: config.bots + 1, seed: config.seed });
  state.map = (config.game === 'voxel' ? BREACH_MAPS : Royale.MAPS)[config.mapId];
  // Build static navigation while the setup screen is visible, before live play.
  navigationFor(state.map);
  state.practice = { config, seed: config.seed, randomState: config.seed || 0x9e3779b9, sessionId: 0, elapsedTicks: 0, brains: [], stats: { hits: 0, damageTaken: 0, lastEventId: 0, lastShotHitTick: -1 }, result: null, pausedPhase: null, inputFence: [] };
  if (config.game === 'voxel') spawnBreach(state, config);
  else {
    const spawn = state.map.spawnPoints[0];
    Object.assign(state.players[0], spawn, { alive: true, hp: state.players[0].maxHp });
  }
  state.phase = 'ready'; state.phaseTicks = 0; state.objective = 'Choose your drill, then press Start practice.';
  return state;
}
export function startPractice(state) {
  if (!state?.practice || !['ready', 'matchEnd'].includes(state.phase)) return state;
  const { config, sessionId } = state.practice, fresh = createPractice(config);
  Object.assign(state, fresh); state.practice.sessionId = sessionId + 1;
  state.practice.randomState = (config.seed ^ Math.imul(sessionId + 1, 0x9e3779b9)) >>> 0 || 0x85ebca6b;
  if (config.game === 'voxel-royale') Royale.startMatch(state, Array.from({ length: config.bots + 1 }, (_, id) => id));
  else { state.phase = 'countdown'; state.phaseTicks = TICK_RATE; state.roundTicks = MAX_DRILL_TICKS; }
  state.practice.brains = Array.from({ length: config.bots }, (_, index) => ({ id: index + 1, targetId: null, seenTick: -1, nextBurstTick: 0, burstUntil: 0, nextPlanTick: state.tick + state.phaseTicks + index * 6, nextSmoothTick: 0, nextAimTick: 0, aimYaw: 0, aimPitch: 0, path: [], goal: null, goalKind: 'patrol', lootId: null, lastX: state.players[index + 1].x, lastZ: state.players[index + 1].z, lastMotionTick: state.tick, escapeUntil: 0, blockedCount: 0 }));
  for (const player of state.players) player.bot = player.id > 0 && player.id <= config.bots;
  state.objective = config.game === 'voxel-royale' ? 'One life, one small knife. Scavenge supplies and outlast the bots.' : config.mode === 'targets' ? 'Clear the moving targets. Targets never shoot back.' : 'Clear the combat bots with the real weapons and movement rules.';
  sessionMaps.set(state, state.map); return state;
}
function neutralize(state) {
  for (const player of state.players) { player.previousInput = emptyInput(player); player.triggerBlocked = true; }
}
export function pausePractice(state) {
  if (!state?.practice || !['countdown', 'fight'].includes(state.phase)) return state;
  state.practice.pausedPhase = state.phase; state.phase = 'paused'; neutralize(state); return state;
}
export function resumePractice(state) {
  if (!state?.practice || state.phase !== 'paused') return state;
  state.phase = state.practice.pausedPhase || 'fight'; state.practice.pausedPhase = null;
  state.practice.inputFence = ['fire', 'jump', 'swap', 'grenade', 'heal', 'interact', 'reload', 'slot1', 'slot2', 'slot3', 'slot4', 'drop'];
  neutralize(state); return state;
}
function visibleEnemy(state, bot, enemy) {
  if (!enemy.alive || enemy.team === bot.team || enemy.id === bot.id) return false;
  const origin = { x: bot.x, y: bot.y + eyeHeight(bot), z: bot.z }, target = { x: enemy.x, y: enemy.y + playerHeight(enemy) * .58, z: enemy.z };
  const dx = target.x - origin.x, dy = target.y - origin.y, dz = target.z - origin.z, distance = Math.hypot(dx, dy, dz);
  if (distance > 46 || distance < EPS) return false;
  const hit = traceShot(state, bot.id, origin, { x: dx / distance, y: dy / distance, z: dz / distance }, distance + .3, state.map);
  return hit.playerId === enemy.id;
}
function patrolGoal(state, bot, brain) {
  const nodes = navigationFor(state.map).nodes, local = state.players[0];
  brain.path = [];
  if (!nodes.length) return null;
  for (let attempt = 0; attempt < 24; attempt++) {
    const point = nodes[Math.floor(random(state.practice) * nodes.length)], fromBot = Math.hypot(point.x - bot.x, point.z - bot.z), fromPlayer = Math.hypot(point.x - local.x, point.z - local.z);
    if (fromBot < 2 || fromBot > (brain.escapeUntil > state.tick ? 6 : 22) || (state.practice.config.game === 'voxel' && fromPlayer > 26)) continue;
    const path = route(state.map, bot, point);
    if (path.length) { brain.path = path; return { x: point.x, z: point.z }; }
  }
  return null;
}
function supplyGoal(state, bot, brain) {
  let kind = null;
  if (!bot.hasGun) kind = 'weapon';
  else if (!bot.ammo && !bot.reserve) kind = 'ammo';
  else if (bot.hp < 110 && !bot.potions) kind = 'heal';
  if (!kind) return null;
  const candidates = (state.loot || []).filter(item => item.kind === kind && Math.abs(item.y - bot.y) <= Royale.ROYALE.pickupHeight && (kind !== 'ammo' || !item.weapon || item.weapon === bot.weapon)).sort((a, b) => Math.hypot(a.x - bot.x, a.z - bot.z) - Math.hypot(b.x - bot.x, b.z - bot.z));
  for (const item of candidates.slice(0, 8)) {
    const path = route(state.map, bot, item), end = path.at(-1);
    if (!end || Math.hypot(end.x - item.x, end.z - item.z) > Royale.ROYALE.pickupRadius - .1) continue;
    brain.path = path; brain.lootId = item.id; return { x: item.x, z: item.z };
  }
  return null;
}
function plan(state, bot, brain, enemy, visible) {
  brain.nextPlanTick = state.tick + 90 + brain.id * 3; brain.nextSmoothTick = 0; brain.lootId = null;
  if (brain.escapeUntil > state.tick) { brain.goalKind = 'escape'; brain.goal = patrolGoal(state, bot, brain); return; }
  if (state.gameId === 'voxel-royale') {
    const storm = state.storm;
    if (storm?.active && Math.hypot(bot.x - storm.x, bot.z - storm.z) > Math.max(2, storm.radius - 3)) {
      brain.goalKind = 'storm'; brain.goal = { x: storm.x, z: storm.z }; brain.path = route(state.map, bot, brain.goal); return;
    }
    const supply = supplyGoal(state, bot, brain);
    if (supply) { brain.goalKind = 'loot'; brain.goal = supply; return; }
  }
  if (state.practice.config.mode === 'combat' && enemy && (!visible || bot.slot === 'sword')) {
    brain.goalKind = 'chase'; brain.goal = { x: enemy.x, z: enemy.z }; brain.path = route(state.map, bot, brain.goal); return;
  }
  if (visible && state.practice.config.mode === 'combat') {
    const dx = enemy.x - bot.x, dz = enemy.z - bot.z, distance = Math.hypot(dx, dz) || 1, sign = random(state.practice) < .5 ? -1 : 1;
    const point = { x: bot.x + (-dz / distance) * sign * 2.2, z: bot.z + (dx / distance) * sign * 2.2 };
    if (clearWalk(state.map, bot, point)) { brain.goalKind = 'strafe'; brain.goal = point; brain.path = [point]; return; }
  }
  brain.goalKind = 'patrol'; brain.goal = patrolGoal(state, bot, brain);
}
function steer(state, bot, brain, input) {
  const hadPath = brain.path.length > 0;
  const beforeWaypoints = brain.path.length;
  while (brain.path.length && Math.hypot(brain.path[0].x - bot.x, brain.path[0].z - bot.z) < .5) brain.path.shift();
  // Smooth a ground route only when the complete body has a clear corridor.
  if (brain.path.length > 1 && (state.tick >= brain.nextSmoothTick || brain.path.length !== beforeWaypoints)) {
    brain.nextSmoothTick = state.tick + 12;
    for (let index = brain.path.length - 1; index > 0; index--) if (clearWalk(state.map, bot, brain.path[index])) { brain.path.splice(0, index); break; }
  }
  const point = brain.path[0];
  if (!point) { if (hadPath) brain.nextPlanTick = Math.min(brain.nextPlanTick, state.tick + 1); return; }
  const dx = point.x - bot.x, dz = point.z - bot.z, distance = Math.hypot(dx, dz);
  if (distance < EPS) return;
  const forward = (Math.sin(input.yaw) * dx - Math.cos(input.yaw) * dz) / distance, right = (Math.cos(input.yaw) * dx + Math.sin(input.yaw) * dz) / distance;
  input.up = forward > .32; input.down = forward < -.32; input.right = right > .32; input.left = right < -.32;
  input.walk = brain.goalKind === 'strafe' || state.practice.config.mode === 'targets';
}
function botInput(state, bot, brain) {
  const input = emptyInput(bot), practice = state.practice, settings = PRACTICE_DIFFICULTIES[practice.config.difficulty];
  if (!bot.alive) return input;
  const enemies = state.players.filter(player => player.alive && player.id !== bot.id && player.team !== bot.team).sort((a, b) => Math.hypot(a.x - bot.x, a.z - bot.z) - Math.hypot(b.x - bot.x, b.z - bot.z));
  const visibleTarget = enemies.find(player => visibleEnemy(state, bot, player)), enemy = visibleTarget || enemies[0], visible = Boolean(visibleTarget);
  if (brain.targetId !== enemy?.id || !visible) { brain.targetId = enemy?.id ?? null; brain.seenTick = visible ? state.tick : -1; brain.burstUntil = 0; }
  else if (brain.seenTick < 0) brain.seenTick = state.tick;
  if (state.tick - brain.lastMotionTick >= 90) {
    if (brain.path.length && Math.hypot(bot.x - brain.lastX, bot.z - brain.lastZ) < .22) { brain.blockedCount++; brain.escapeUntil = state.tick + 150; brain.nextPlanTick = 0; brain.path = []; }
    brain.lastX = bot.x; brain.lastZ = bot.z; brain.lastMotionTick = state.tick;
  }
  if (state.tick >= brain.nextPlanTick || (brain.lootId !== null && !state.loot?.some(item => item.id === brain.lootId))) plan(state, bot, brain, enemy, visible);
  if (state.tick >= brain.nextAimTick) {
    brain.aimYaw = (random(practice) * 2 - 1) * settings.aimError; brain.aimPitch = (random(practice) * 2 - 1) * settings.aimError * .65; brain.nextAimTick = state.tick + 24;
  }
  const look = visible && enemy ? { x: enemy.x, z: enemy.z } : brain.path[0] || brain.goal;
  if (look) {
    const desiredYaw = Math.atan2(look.x - bot.x, -(look.z - bot.z)) + (visible ? brain.aimYaw : 0);
    input.yaw = wrap(bot.yaw + clamp(wrap(desiredYaw - bot.yaw), -settings.turnSpeed / TICK_RATE, settings.turnSpeed / TICK_RATE));
    const desiredPitch = visible ? Math.atan2(enemy.y + playerHeight(enemy) * .58 - bot.y - eyeHeight(bot), Math.hypot(enemy.x - bot.x, enemy.z - bot.z)) + brain.aimPitch : 0;
    input.pitch = bot.pitch + clamp(desiredPitch - bot.pitch, -settings.turnSpeed / TICK_RATE, settings.turnSpeed / TICK_RATE);
  }
  if (bot.healTicks) return input;
  if (practice.config.mode === 'combat' && bot.hp < 105 && bot.potions && !visible && bot.grounded && !bot.reloadTicks && !bot.meleeTicks) { input.heal = !bot.previousInput.heal; return input; }
  if (state.gameId === 'voxel-royale' && brain.goalKind === 'loot' && Royale.findNearbyLoot(state, bot.id)) { input.interact = !bot.previousInput.interact; return input; }
  steer(state, bot, brain, input);
  if (bot.slot === 'primary' && bot.ammo === 0 && bot.reserve > 0 && !bot.reloadTicks) { input.reload = !bot.previousInput.reload; return input; }
  if (practice.config.mode !== 'combat' || !enemy || !visible || brain.seenTick < 0 || state.tick - brain.seenTick < settings.reactionTicks || bot.reloadTicks) return input;
  const desiredYaw = Math.atan2(enemy.x - bot.x, -(enemy.z - bot.z)), distance = Math.hypot(enemy.x - bot.x, enemy.z - bot.z);
  if (Math.abs(wrap(input.yaw - desiredYaw)) > .16 || (bot.slot === 'sword' && distance > 1.6)) return input;
  if (state.tick >= brain.nextBurstTick && state.tick >= brain.burstUntil) { brain.burstUntil = state.tick + settings.burstTicks; brain.nextBurstTick = brain.burstUntil + settings.restTicks + Math.floor(random(practice) * 18); }
  const mode = WEAPONS[bot.weapon].mode;
  input.fire = state.tick < brain.burstUntil && (bot.slot === 'primary' && (!mode || mode === 'auto') ? true : !bot.previousInput.fire);
  input.aim = bot.slot === 'primary' && practice.config.difficulty !== 'rookie';
  // An ally may have stepped into the lane after the target was acquired.
  if (input.fire) {
    const origin = { x: bot.x, y: bot.y + eyeHeight(bot), z: bot.z }, hit = traceShot(state, bot.id, origin, aimDirection(input.yaw, input.pitch), Math.min(WEAPONS[bot.weapon].range, distance + 1), state.map);
    if (hit.playerId !== null && state.players[hit.playerId].team === bot.team) input.fire = false;
  }
  return input;
}
function recordStats(state) {
  const stats = state.practice.stats;
  for (const event of state.events) {
    if (event.id <= stats.lastEventId) continue;
    if (event.type === 'damage' && event.targetId === 0) stats.damageTaken += event.damage;
    if (event.playerId === 0 && event.damage > 0 && event.targetId !== null && state.players[event.targetId]?.team !== state.players[0].team) {
      if (event.type === 'shot' && event.tick !== stats.lastShotHitTick) { stats.hits++; stats.lastShotHitTick = event.tick; }
      else if (event.type === 'boltHit') stats.hits++;
    }
    stats.lastEventId = event.id;
  }
}
function finishPractice(state, result, reason) {
  state.practice.result = result;
  if (state.phase !== 'matchEnd') {
    state.phase = 'matchEnd'; state.phaseTicks = 0; state.roundReason = reason; state.winner = result === 'won' ? 0 : result === 'lost' ? 1 : null; state.roundWinner = state.winner;
    if (state.gameId === 'voxel-royale') state.winner = state.winnerId = state.roundWinner = null;
    emitCombatEvent(state, 'practiceEnd', { result, reason });
  }
  for (const player of state.players) Object.assign(player, { vx: 0, vy: 0, vz: 0, aiming: false, aimTicks: 0 });
  neutralize(state); state.objective = result === 'won' ? 'Drill cleared. Review your accuracy or start another run.' : result === 'lost' ? 'Your run is over. Change the drill or try again.' : 'Time limit reached. Review your results or try again.';
}
export function stepPractice(state, localInput = {}) {
  if (!state?.practice || !['countdown', 'fight'].includes(state.phase)) return state;
  if (sessionMaps.get(state) !== state.map) {
    sessionMaps.set(state, state.map);
    for (const brain of state.practice.brains) { brain.path = []; brain.goal = null; brain.nextSmoothTick = 0; brain.nextPlanTick = state.tick + (brain.id - 1) * 6; }
  }
  const inputs = state.players.map(player => emptyInput(player)); inputs[0] = { ...emptyInput(state.players[0]), ...localInput };
  state.practice.inputFence = state.practice.inputFence.filter(key => {
    if (localInput[key] !== true) return false;
    inputs[0][key] = false; return true;
  });
  if (state.phase === 'fight') for (const brain of state.practice.brains) inputs[brain.id] = botInput(state, state.players[brain.id], brain);
  if (state.gameId === 'voxel-royale') Royale.step(state, inputs);
  else {
    state.tick++;
    if (state.phase === 'countdown') {
      const player = state.players[0]; player.yaw = Number.isFinite(localInput.yaw) ? clamp(localInput.yaw, -Math.PI, Math.PI) : player.yaw; player.pitch = Number.isFinite(localInput.pitch) ? clamp(localInput.pitch, -1.35, 1.35) : player.pitch;
      player.previousInput = inputs[0];
      if (--state.phaseTicks <= 0) { state.phase = 'fight'; state.phaseTicks = 0; player.triggerBlocked = inputs[0].fire === true; emitCombatEvent(state, 'fight', { practice: true }); }
      return state;
    }
    const previous = state.players.map(player => ({ ...player.previousInput }));
    state.roundTicks = Math.max(0, state.roundTicks - 1); combatStep(state, inputs, state.map);
    for (const player of state.players) if (player.alive && inputs[player.id].interact && !previous[player.id].interact && !inputs[player.id].fire && !player.healTicks && !player.reloadTicks && !player.meleeTicks && !player.grenadeThrowTicks) { const loot = findNearbyLoot(state, player.id, state.map); if (loot) pickupCombatLoot(state, player, loot, inputs[player.id]); }
    advanceInventoryLoot(state, state.map);
  }
  if (state.phase === 'countdown') return state;
  // The countdown-to-fight transition has not simulated any active time yet.
  if (state.gameId === 'voxel-royale' && state.matchTicks === 0) return state;
  state.practice.elapsedTicks++; recordStats(state);
  if (!state.players[0].alive) finishPractice(state, 'lost', 'playerEliminated');
  else if (state.phase === 'matchEnd' || !state.players.some(player => player.bot && player.alive)) finishPractice(state, 'won', 'targetsCleared');
  else if (state.gameId !== 'voxel-royale' && state.roundTicks === 0) finishPractice(state, 'timeout', 'timeLimit');
  return state;
}
export function getPracticeStats(state) {
  if (!state?.practice) return null;
  const { practice } = state, player = state.players[0], botsRemaining = state.players.filter(peer => peer.bot && peer.alive).length;
  return Object.freeze({ seconds: practice.elapsedTicks / TICK_RATE, elapsedTicks: practice.elapsedTicks, kills: player.kills, shots: player.shots, hits: practice.stats.hits, accuracy: player.shots ? Math.min(100, practice.stats.hits / player.shots * 100) : 0, damageDealt: player.damageDealt, damageTaken: practice.stats.damageTaken, botsRemaining, result: practice.result, sessionId: practice.sessionId });
}
