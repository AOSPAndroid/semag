/** Shadow Lantern: handcrafted stealth heists, fixed-step simulation in world pixels. */
export const WORLD = Object.freeze({ width: 960, height: 640 });
export const FIXED_STEP = 1 / 60;
export const PLAYER_RADIUS = 10;
export const GUARD_RADIUS = 11;
export const DIFFICULTIES = Object.freeze({
  standard: Object.freeze({ title: 'Standard · practice', health: 6, smoke: 4, kunai: 7, alarms: 18, time: 145, speed: .82, sight: .85, suspicion: .8, description: 'Learn all nine routes. Six wounds, eighteen alarms and longer mission clocks.' }),
  veteran: Object.freeze({ title: 'Veteran', health: 3, smoke: 2, kunai: 4, alarms: 8, time: 100, speed: 1, sight: 1, suspicion: 1, description: 'Three wounds and eight alarms for the whole heist. Tools and health carry forward.' }),
  nightmare: Object.freeze({ title: 'Nightmare', health: 2, smoke: 1, kunai: 3, alarms: 4, time: 82, speed: 1.12, sight: 1.15, suspicion: 1.24, description: 'Two wounds, four alarms. Wider patrol reach and very little spare time.' }),
});
export const DISTRICTS = Object.freeze([
  Object.freeze({ name: 'Lantern Garden', subtitle: 'Paper lights over the cedar paths', ground: '#253b34', dark: '#142b29', wall: '#72514b', trim: '#d7ae79', accent: '#edba76', sky: '#182a32' }),
  Object.freeze({ name: 'Rainroof Citadel', subtitle: 'A stolen archive above the rain', ground: '#293b4c', dark: '#182b3e', wall: '#5b6074', trim: '#b9c7ca', accent: '#8ed8d4', sky: '#13243a' }),
  Object.freeze({ name: 'Frost Keep', subtitle: 'The last lantern burns in the snow', ground: '#3b495d', dark: '#273146', wall: '#666780', trim: '#d1dce1', accent: '#c6b7f2', sky: '#1d2340' }),
]);
const wall = (x, y, w, h, kind = 'building') => ({ x, y, w, h, kind });
const shade = (x, y, w, h) => ({ x, y, w, h });
const patrol = (points, offset = 0, kind = 'sentinel') => ({ points, offset, kind });
const seal = (x, y) => ({ x, y });
const cache = (x, y, smoke = 0, kunai = 2) => ({ x, y, smoke, kunai });
const routes = [
  { name: 'Cedar gate', district: 0, hint: 'Take the shaded lower path. A guard sees forward; approach its back quietly and hold Interact.', walls: [wall(200, 190, 190, 120), wall(530, 350, 180, 125), wall(470, 120, 65, 160, 'screen')], shadows: [shade(65, 420, 210, 160), shade(375, 305, 110, 150), shade(720, 170, 150, 140)], guards: [patrol([[405, 205], [405, 430], [300, 430], [300, 350]]), patrol([[755, 155], [870, 155], [870, 460], [750, 460]], 1), patrol([[545, 300], [685, 300]], 1)], seals: [seal(430, 155), seal(795, 375)], caches: [cache(585, 505)], spawn: [100, 535], exit: [100, 535] },
  { name: 'Two paper bridges', district: 0, hint: 'The central lantern sweep closes a direct crossing. Throw a kunai into the far wall, then cross behind the investigating patrol.', walls: [wall(180, 170, 140, 255), wall(405, 255, 145, 105), wall(640, 180, 150, 270), wall(400, 460, 150, 60, 'screen')], shadows: [shade(70, 430, 235, 160), shade(335, 110, 230, 115), shade(810, 430, 95, 150)], guards: [patrol([[345, 185], [345, 470]]), patrol([[570, 425], [570, 140]], 1), patrol([[800, 490], [885, 490], [885, 170], [815, 170]], 2), patrol([[370, 390], [610, 390]], 1)], seals: [seal(470, 160), seal(845, 300)], caches: [cache(470, 560, 1, 0)], spawn: [100, 540], exit: [100, 540] },
  { name: 'The tea house ledger', district: 0, hint: 'A seal sits between two facing patrols. Smoke hides a channel, but the cloud is temporary and guards still hear your feet.', walls: [wall(180, 160, 190, 170), wall(180, 430, 190, 80), wall(495, 130, 140, 125), wall(495, 395, 140, 120), wall(740, 220, 105, 150)], shadows: [shade(60, 335, 130, 180), shade(380, 175, 100, 155), shade(660, 435, 220, 140)], guards: [patrol([[395, 150], [395, 500]]), patrol([[460, 330], [685, 330]], 1), patrol([[670, 180], [890, 180], [890, 440], [670, 440]], 2), patrol([[400, 550], [745, 550]], 1)], seals: [seal(555, 320), seal(875, 115)], caches: [cache(285, 370, 0, 2)], spawn: [100, 540], exit: [100, 540] },
  { name: 'Rain on the tiles', district: 1, hint: 'Tile seams are solid cover. Stay in their lee, watch the cone tips, then take the north archive before returning south.', walls: [wall(170, 160, 210, 105), wall(170, 380, 210, 105), wall(500, 240, 120, 190), wall(740, 135, 120, 155), wall(740, 400, 120, 115)], shadows: [shade(65, 450, 225, 130), shade(400, 110, 95, 155), shade(640, 280, 90, 170)], guards: [patrol([[405, 290], [405, 535]]), patrol([[530, 170], [685, 170], [685, 465], [530, 465]], 1), patrol([[880, 125], [880, 530]], 1), patrol([[655, 540], [860, 540]], 1), patrol([[110, 290], [330, 290]], 1)], seals: [seal(665, 115), seal(800, 350)], caches: [cache(450, 555, 1, 0)], spawn: [90, 550], exit: [90, 550] },
  { name: 'The bell tower', district: 1, hint: 'The tower divides four patrol routes. Break sight before a suspicion ring fills; a guard remembers the last place it saw you.', walls: [wall(170, 180, 150, 250), wall(435, 170, 130, 260), wall(680, 180, 145, 250), wall(355, 495, 260, 45, 'screen')], shadows: [shade(65, 435, 260, 150), shade(330, 105, 100, 230), shade(580, 325, 95, 150), shade(830, 160, 90, 270)], guards: [patrol([[350, 160], [350, 460]]), patrol([[605, 460], [605, 130]], 1), patrol([[865, 460], [865, 130]], 1), patrol([[160, 125], [780, 125]], 1), patrol([[680, 520], [890, 520]], 1)], seals: [seal(385, 390), seal(630, 200)], caches: [cache(765, 475, 0, 3)], spawn: [100, 550], exit: [100, 550] },
  { name: 'Archive under glass', district: 1, hint: 'Three seals require three different passages. The side alcoves hide you; the open archive floor does not.', walls: [wall(155, 180, 170, 135), wall(155, 420, 170, 100), wall(425, 140, 115, 180), wall(425, 430, 115, 110), wall(665, 205, 165, 220)], shadows: [shade(55, 310, 115, 185), shade(335, 150, 80, 170), shade(545, 435, 110, 140), shade(835, 130, 85, 140)], guards: [patrol([[355, 350], [355, 550]]), patrol([[575, 140], [625, 140], [625, 390], [575, 390]], 1), patrol([[850, 170], [895, 170], [895, 490], [850, 490]], 2), patrol([[390, 370], [630, 370]], 1), patrol([[650, 520], [880, 520]], 1)], seals: [seal(375, 115), seal(590, 485), seal(865, 320)], caches: [cache(235, 360, 1, 1)], spawn: [90, 550], exit: [90, 550] },
  { name: 'Snow at the outer wall', district: 2, hint: 'Snow carries footfalls further. Sneak beside the tall screens, draw the north patrol away, then work behind it.', walls: [wall(175, 175, 180, 180), wall(175, 455, 180, 60), wall(460, 210, 105, 220), wall(680, 140, 145, 160), wall(680, 410, 145, 110)], shadows: [shade(55, 340, 125, 210), shade(360, 120, 90, 180), shade(570, 430, 105, 130), shade(830, 300, 90, 175)], guards: [patrol([[390, 180], [390, 510]]), patrol([[590, 150], [640, 150], [640, 405], [590, 405]], 1), patrol([[850, 160], [900, 160], [900, 520], [850, 520]], 2), patrol([[420, 540], [810, 540]], 1), patrol([[90, 110], [410, 110]], 1)], seals: [seal(610, 475), seal(875, 350)], caches: [cache(255, 400, 0, 3)], spawn: [90, 550], exit: [90, 550] },
  { name: 'A blade behind the throne', district: 2, hint: 'Cross the open throne court using short shadow-to-shadow moves. Takedowns demand a quiet rear approach, never a frontal attack.', walls: [wall(150, 150, 180, 230), wall(420, 230, 145, 145), wall(665, 155, 170, 225), wall(340, 480, 285, 55, 'screen')], shadows: [shade(55, 385, 270, 195), shade(335, 120, 85, 150), shade(570, 360, 90, 110), shade(840, 380, 75, 170)], guards: [patrol([[360, 160], [360, 440]]), patrol([[600, 440], [600, 150]], 1), patrol([[865, 160], [865, 545]], 1), patrol([[155, 110], [790, 110]], 1), patrol([[400, 410], [630, 410]], 1), patrol([[675, 520], [875, 520]], 1)], seals: [seal(490, 150), seal(760, 435)], caches: [cache(90, 260, 1, 0)], spawn: [90, 550], exit: [90, 550] },
  { name: 'The shogun’s last lantern', district: 2, timeBonus: 25, hint: 'The final heist has three seals, six patrols and no free refill. Save a smoke cloud for the central channel, then extract with every scroll.', walls: [wall(150, 180, 180, 150), wall(150, 430, 180, 100), wall(425, 145, 115, 145), wall(425, 430, 115, 115), wall(655, 180, 175, 235)], shadows: [shade(55, 330, 115, 190), shade(335, 155, 80, 160), shade(545, 435, 100, 140), shade(835, 145, 85, 150)], guards: [patrol([[355, 345], [355, 555]]), patrol([[570, 135], [615, 135], [615, 400], [570, 400]], 1), patrol([[855, 160], [900, 160], [900, 515], [855, 515]], 2), patrol([[390, 350], [635, 350]], 1), patrol([[650, 520], [880, 520]], 1), patrol([[120, 110], [405, 110]], 1)], seals: [seal(375, 120), seal(585, 365), seal(875, 320)], caches: [], spawn: [90, 555], exit: [90, 555] },
];
export const LEVELS = Object.freeze(routes.map((level, i) => Object.freeze({ ...level, id: i + 1, walls: Object.freeze(level.walls.map(Object.freeze)), shadows: Object.freeze(level.shadows.map(Object.freeze)), guards: Object.freeze(level.guards.map(g => Object.freeze({ ...g, points: Object.freeze(g.points.map(Object.freeze)) }))), seals: Object.freeze(level.seals.map(Object.freeze)), caches: Object.freeze(level.caches.map(Object.freeze)), spawn: Object.freeze(level.spawn), exit: Object.freeze(level.exit) })));
export const TOTAL_LEVELS = LEVELS.length;
const EPS = 1e-8;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angleDelta = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const emit = (s, type, data = {}) => { s.events.push({ id: ++s.eventId, type, x: s.player.x, y: s.player.y, ...data }); if (s.events.length > 32) s.events.shift(); };
export function segmentRect(x, y, dx, dy, r) {
  let enter = 0, exit = 1;
  for (const [o, d, lo, hi] of [[x, dx, r.x, r.x + r.w], [y, dy, r.y, r.y + r.h]]) {
    if (Math.abs(d) < EPS) { if (o < lo || o > hi) return null; continue; }
    let a = (lo - o) / d, b = (hi - o) / d; if (a > b) [a, b] = [b, a]; enter = Math.max(enter, a); exit = Math.min(exit, b); if (enter > exit) return null;
  }
  return enter <= 1 && exit >= 0 ? clamp(enter, 0, 1) : null;
}
export function segmentCircle(x, y, dx, dy, cx, cy, radius) {
  const ox = x - cx, oy = y - cy, c = ox * ox + oy * oy - radius * radius;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy; if (a < EPS) return null;
  const b = 2 * (ox * dx + oy * dy), disc = b * b - 4 * a * c; if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / (2 * a); return t >= 0 && t <= 1 ? t : null;
}
/** Exact rounded rectangle contact; the empty square at a wall corner stays free. */
export function sweepCircleRect(x, y, dx, dy, radius, r) {
  let best = null;
  const offer = (t, nx, ny) => { if (t !== null && t >= -EPS && t <= 1 + EPS && dx * nx + dy * ny < -EPS && (!best || t < best.time)) best = { time: clamp(t, 0, 1), nx, ny }; };
  if (dx > EPS) { const t = (r.x - radius - x) / dx, cy = y + dy * t; if (cy >= r.y && cy <= r.y + r.h) offer(t, -1, 0); }
  if (dx < -EPS) { const t = (r.x + r.w + radius - x) / dx, cy = y + dy * t; if (cy >= r.y && cy <= r.y + r.h) offer(t, 1, 0); }
  if (dy > EPS) { const t = (r.y - radius - y) / dy, cx = x + dx * t; if (cx >= r.x && cx <= r.x + r.w) offer(t, 0, -1); }
  if (dy < -EPS) { const t = (r.y + r.h + radius - y) / dy, cx = x + dx * t; if (cx >= r.x && cx <= r.x + r.w) offer(t, 0, 1); }
  for (const [cx, cy, sx, sy] of [[r.x, r.y, -1, -1], [r.x + r.w, r.y, 1, -1], [r.x, r.y + r.h, -1, 1], [r.x + r.w, r.y + r.h, 1, 1]]) {
    const t = segmentCircle(x, y, dx, dy, cx, cy, radius); if (t === null) continue;
    const px = x + dx * t - cx, py = y + dy * t - cy; if (px * sx < -EPS || py * sy < -EPS) continue;
    const len = Math.hypot(px, py) || 1; offer(t, px / len, py / len);
  }
  return best;
}
export function moveBody(body, dx, dy, walls, radius = PLAYER_RADIUS, blockers = []) {
  for (let pass = 0; pass < 3; pass++) {
    let contact = null;
    for (const r of walls) { const hit = sweepCircleRect(body.x, body.y, dx, dy, radius, r); if (hit && (!contact || hit.time < contact.time)) contact = hit; }
    for (const other of blockers) {
      const time = segmentCircle(body.x, body.y, dx, dy, other.x, other.y, radius + other.radius);
      if (time === null) continue;
      const nx = body.x + dx * time - other.x, ny = body.y + dy * time - other.y, length = Math.hypot(nx, ny) || 1;
      const hit = { time, nx: nx / length, ny: ny / length };
      if (dx * hit.nx + dy * hit.ny < -EPS && (!contact || hit.time < contact.time)) contact = hit;
    }
    if (!contact) { body.x += dx; body.y += dy; break; }
    body.x += dx * contact.time; body.y += dy * contact.time;
    dx *= 1 - contact.time; dy *= 1 - contact.time;
    const into = dx * contact.nx + dy * contact.ny; if (into < 0) { dx -= into * contact.nx; dy -= into * contact.ny; }
    if (Math.hypot(dx, dy) < EPS) break;
  }
  body.x = clamp(body.x, radius + 38, WORLD.width - radius - 38); body.y = clamp(body.y, radius + 48, WORLD.height - radius - 38);
}
export function lineOfSight(level, a, b) {
  return !level.walls.some(r => { const t = segmentRect(a.x, a.y, b.x - a.x, b.y - a.y, r); return t !== null && t < 1 - EPS; });
}
export function rayEnd(level, x, y, angle, range) {
  const dx = Math.cos(angle) * range, dy = Math.sin(angle) * range; let time = 1;
  for (const r of level.walls) { const hit = segmentRect(x, y, dx, dy, r); if (hit !== null) time = Math.min(time, hit); }
  // The enclosing courtyard is a real limit, also shown as the border wall.
  const maxX = WORLD.width - 38, maxY = WORLD.height - 38;
  if (dx > 0) time = Math.min(time, (maxX - x) / dx); if (dx < 0) time = Math.min(time, (38 - x) / dx);
  if (dy > 0) time = Math.min(time, (maxY - y) / dy); if (dy < 0) time = Math.min(time, (48 - y) / dy);
  return { x: x + dx * time, y: y + dy * time };
}
export function inShadow(level, player) { return level.shadows.some(r => player.x >= r.x && player.x <= r.x + r.w && player.y >= r.y && player.y <= r.y + r.h); }
function smokeBlocks(s, a, b) { return s.clouds.some(c => c.life > 0 && segmentCircle(a.x, a.y, b.x - a.x, b.y - a.y, c.x, c.y, c.radius) !== null); }
export function guardSees(state, guard) {
  if (guard.mode === 'down') return false;
  const p = state.player, level = LEVELS[state.level], range = (guard.mode === 'alert' ? 250 : 195) * DIFFICULTIES[state.difficulty].sight;
  const d = distance(p, guard); if (d > range || Math.abs(angleDelta(Math.atan2(p.y - guard.y, p.x - guard.x), guard.facing)) > (guard.mode === 'alert' ? .85 : .58)) return false;
  if (!lineOfSight(level, guard, p) || smokeBlocks(state, guard, p)) return false;
  return true;
}
export function createState({ difficulty = 'veteran' } = {}) {
  if (!Object.hasOwn(DIFFICULTIES, difficulty)) difficulty = 'veteran'; const tier = DIFFICULTIES[difficulty];
  const state = { difficulty, recordKey: `shadow-v1-${difficulty}`, phase: 'playing', level: 0, elapsed: 0, levelElapsed: 0, cleared: 0, alarm: 0, smoke: tier.smoke, kunai: tier.kunai, score: 0, player: { x: 0, y: 0, hp: tier.health, facing: -Math.PI / 2, sneaking: false, moving: false, invulnerable: 0 }, guards: [], scrolls: [], caches: [], clouds: [], projectiles: [], noises: [], channel: null, events: [], eventId: 0, reason: '', smokeHeld: false, kunaiHeld: false, footstep: 0, noiseId: 0 };
  resetMission(state); return state;
}
function resetMission(s) {
  const level = LEVELS[s.level]; s.levelElapsed = 0; s.phase = 'playing'; s.reason = ''; s.scrolls = level.seals.map(() => false); s.caches = level.caches.map(() => false); s.channel = null; s.clouds = []; s.projectiles = []; s.noises = []; s.footstep = 0; s.smokeHeld = false; s.kunaiHeld = false;
  s.player.x = level.spawn[0]; s.player.y = level.spawn[1]; s.player.facing = -Math.PI / 2; s.player.invulnerable = 0; s.player.moving = false;
  s.guards = level.guards.map((route, i) => { const index = route.offset % route.points.length, start = route.points[index], target = route.points[(index + 1) % route.points.length]; return { id: i, x: start[0], y: start[1], facing: Math.atan2(target[1] - start[1], target[0] - start[0]), waypoint: (index + 1) % route.points.length, mode: 'patrol', suspicion: 0, lastSeen: null, searchTime: 0, noticedNoise: 0, investigateAge: 0, attack: 0, attackFacing: 0, attackHit: false, cooldown: 0, turnWait: .4 }; });
}
export function nextMission(s) { if (s.phase !== 'mission-clear' || s.level >= TOTAL_LEVELS - 1) return false; s.level++; resetMission(s); emit(s, 'mission'); return true; }
export function togglePause(s) { if (s.phase === 'playing') s.phase = 'paused'; else if (s.phase === 'paused') s.phase = 'playing'; else return false; s.smokeHeld = false; s.kunaiHeld = false; s.player.moving = false; s.channel = null; return true; }
function fail(s, reason) { s.phase = 'lost'; s.reason = reason; s.channel = null; emit(s, 'lost', { reason }); }
function noise(s, x, y, radius, type) { s.noises.push({ id: ++s.noiseId, x, y, radius, life: .35, type }); if (s.noises.length > 16) s.noises.shift(); emit(s, 'noise', { x, y, radius, kind: type }); }
function alarm(s, g) {
  g.mode = 'alert'; g.suspicion = 1; g.searchTime = 0; s.alarm++; emit(s, 'alarm', { x: g.x, y: g.y });
  if (s.alarm > DIFFICULTIES[s.difficulty].alarms) fail(s, 'The fortress locked down: alarm allowance exhausted.');
}
const navigation = new WeakMap();
const guardRoutes = new WeakMap();
function pathClear(level, a, b, radius = GUARD_RADIUS) {
  return !level.walls.some(r => sweepCircleRect(a.x, a.y, b.x - a.x, b.y - a.y, radius, r));
}
function navigationNodes(level) {
  if (navigation.has(level)) return navigation.get(level);
  const nodes = [];
  for (const r of level.walls) for (const [x, y] of [[r.x - 13, r.y - 13], [r.x + r.w + 13, r.y - 13], [r.x - 13, r.y + r.h + 13], [r.x + r.w + 13, r.y + r.h + 13]]) {
    if (x < 50 || x > 910 || y < 60 || y > 590) continue;
    if (level.walls.some(q => x >= q.x - 11 && x <= q.x + q.w + 11 && y >= q.y - 11 && y <= q.y + q.h + 11)) continue;
    nodes.push({ x, y });
  }
  const edges = nodes.map(() => []);
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) if (pathClear(level, nodes[i], nodes[j])) {
    const cost = distance(nodes[i], nodes[j]); edges[i].push({ index: j, cost }); edges[j].push({ index: i, cost });
  }
  const graph = { nodes, edges }; navigation.set(level, graph); return graph;
}
function guardDestination(level, g, target, dt) {
  if (pathClear(level, g, target)) return target;
  let route = guardRoutes.get(g);
  if (!route || distance(route.target, target) > 35 || route.life <= 0) {
    const graph = navigationNodes(level), count = graph.nodes.length, costs = Array(count).fill(Infinity), parent = Array(count).fill(-1), visited = Array(count).fill(false);
    for (let i = 0; i < count; i++) if (pathClear(level, g, graph.nodes[i])) costs[i] = distance(g, graph.nodes[i]);
    let end = -1, best = Infinity;
    for (let pass = 0; pass < count; pass++) {
      let node = -1; for (let i = 0; i < count; i++) if (!visited[i] && (node < 0 || costs[i] < costs[node])) node = i;
      if (node < 0 || !Number.isFinite(costs[node])) break; visited[node] = true;
      if (pathClear(level, graph.nodes[node], target) && costs[node] + distance(graph.nodes[node], target) < best) { end = node; best = costs[node] + distance(graph.nodes[node], target); }
      for (const edge of graph.edges[node]) if (costs[node] + edge.cost < costs[edge.index]) { costs[edge.index] = costs[node] + edge.cost; parent[edge.index] = node; }
    }
    const points = []; while (end >= 0) { points.unshift(graph.nodes[end]); end = parent[end]; } points.push({ ...target });
    route = { points, target: { ...target }, life: .6 }; guardRoutes.set(g, route);
  }
  route.life -= dt; while (route.points.length > 1 && distance(g, route.points[0]) < 7) route.points.shift();
  return route.points[0] || target;
}
function updateGuard(s, g, dt) {
  if (g.mode === 'down') return;
  if (s.channel?.type === 'guard' && s.channel.index === g.id && rearTakedownAvailable(s, g)) return;
  const level = LEVELS[s.level], p = s.player, tier = DIFFICULTIES[s.difficulty];
  g.cooldown = Math.max(0, g.cooldown - dt);
  const seen = guardSees(s, g);
  if (seen) {
    g.lastSeen = { x: p.x, y: p.y }; g.searchTime = 0;
    if (g.mode !== 'alert') {
      const shadow = inShadow(level, p), close = distance(p, g) < 52;
      const growth = close ? 1.7 : shadow && p.sneaking ? .16 : shadow ? .43 : p.sneaking ? .7 : 1.12;
      g.suspicion = Math.min(1, g.suspicion + dt * growth * tier.suspicion);
      if (g.suspicion >= 1) alarm(s, g);
    }
  } else {
    g.suspicion = Math.max(0, g.suspicion - dt * .55);
    if (g.mode === 'alert') { g.searchTime += dt; if (g.searchTime > 3.8) { g.mode = 'investigate'; g.searchTime = 0; g.investigateAge = 0; g.suspicion = .25; emit(s, 'lost-sight', { x: g.x, y: g.y }); } }
  }
  if (s.phase !== 'playing') return;
  if (g.mode !== 'alert') for (const n of s.noises) if (n.id > g.noticedNoise && distance(g, n) <= n.radius) { g.noticedNoise = n.id; g.mode = 'investigate'; g.lastSeen = { x: n.x, y: n.y }; g.searchTime = 0; g.investigateAge = 0; }
  if (g.mode === 'investigate') { g.investigateAge += dt; if (g.investigateAge > 6) { g.mode = 'patrol'; g.searchTime = 0; g.turnWait = .3; } }
  if (g.attack > 0) {
    const prior = g.attack; g.attack = Math.max(0, g.attack - dt);
    if (!g.attackHit && prior > .18 && g.attack <= .18) {
      g.attackHit = true;
      if (distance(p, g) <= 34 && Math.abs(angleDelta(Math.atan2(p.y - g.y, p.x - g.x), g.attackFacing)) < .8 && lineOfSight(level, g, p) && p.invulnerable === 0) {
        p.hp--; p.invulnerable = 1.2; s.score = Math.max(0, s.score - 250); emit(s, 'wound', { x: p.x, y: p.y }); if (p.hp <= 0) fail(s, 'The last wound ended the heist.');
      }
    }
    if (g.attack === 0) g.cooldown = .9; return;
  }
  let target, speed = 52 * tier.speed;
  if (g.mode === 'patrol') {
    if (g.turnWait > 0) { g.turnWait = Math.max(0, g.turnWait - dt); return; }
    const point = level.guards[g.id].points[g.waypoint]; target = { x: point[0], y: point[1] };
    if (distance(g, target) < 3) { g.waypoint = (g.waypoint + 1) % level.guards[g.id].points.length; g.turnWait = .5; return; }
  } else {
    target = g.lastSeen || { x: g.x, y: g.y }; speed = (g.mode === 'alert' ? 116 : 70) * tier.speed;
    if (g.mode === 'alert' && distance(p, g) < 43 && seen && g.cooldown === 0) { g.attack = .78; g.attackFacing = Math.atan2(p.y - g.y, p.x - g.x); g.facing = g.attackFacing; g.attackHit = false; emit(s, 'slash-warning', { x: g.x, y: g.y }); return; }
    if (distance(g, target) < 16) { g.searchTime += dt; g.facing += dt * .8; if (g.mode === 'investigate' && g.searchTime > 2) { g.mode = 'patrol'; g.turnWait = .3; } return; }
  }
  const destination = guardDestination(level, g, target, dt);
  const dx = destination.x - g.x, dy = destination.y - g.y, d = Math.hypot(dx, dy); if (d > 0) {
    const targetAngle = Math.atan2(dy, dx); g.facing += clamp(angleDelta(targetAngle, g.facing), -dt * 4, dt * 4);
    moveBody(g, dx / d * Math.min(d, speed * dt), dy / d * Math.min(d, speed * dt), level.walls, GUARD_RADIUS, [{ x: p.x, y: p.y, radius: PLAYER_RADIUS }]);
  }
}
export function rearTakedownAvailable(s, g) {
  const p = s.player;
  return g.mode !== 'down' && g.mode !== 'alert' && g.attack === 0 && distance(p, g) < 31 && Math.cos(angleDelta(Math.atan2(p.y - g.y, p.x - g.x), g.facing)) < -.35 && lineOfSight(LEVELS[s.level], p, g);
}
export function interactionTarget(s) {
  const p = s.player, level = LEVELS[s.level];
  for (const g of s.guards) if (rearTakedownAvailable(s, g)) return { type: 'guard', index: g.id, x: g.x, y: g.y, duration: .55, label: 'Quiet takedown' };
  for (let i = 0; i < level.seals.length; i++) if (!s.scrolls[i] && distance(p, level.seals[i]) < 26 && lineOfSight(level, p, level.seals[i])) return { type: 'seal', index: i, ...level.seals[i], duration: 1.1, label: 'Lift the seal' };
  for (let i = 0; i < level.caches.length; i++) if (!s.caches[i] && distance(p, level.caches[i]) < 27 && lineOfSight(level, p, level.caches[i])) return { type: 'cache', index: i, ...level.caches[i], duration: .65, label: 'Open tool cache' };
  const exit = { x: level.exit[0], y: level.exit[1] };
  if (s.scrolls.every(Boolean) && distance(p, exit) < 29) return { type: 'exit', index: 0, ...exit, duration: .75, label: 'Extract with scrolls' };
  return null;
}
function updateInteraction(s, input, dt) {
  const target = input.interact && !s.player.moving ? interactionTarget(s) : null;
  if (!target) { s.channel = null; return; }
  if (!s.channel || s.channel.type !== target.type || s.channel.index !== target.index) s.channel = { ...target, progress: 0 };
  s.channel.progress += dt;
  if (s.channel.progress < target.duration) return;
  s.channel = null;
  if (target.type === 'guard') { const g = s.guards[target.index]; g.mode = 'down'; g.suspicion = 0; g.attack = 0; s.score += 180; emit(s, 'takedown', { x: g.x, y: g.y }); }
  if (target.type === 'seal') { s.scrolls[target.index] = true; s.score += 1000; emit(s, 'seal', { x: target.x, y: target.y }); }
  if (target.type === 'cache') { const cache = LEVELS[s.level].caches[target.index]; s.caches[target.index] = true; s.smoke += cache.smoke; s.kunai += cache.kunai; emit(s, 'cache', { x: target.x, y: target.y }); }
  if (target.type === 'exit') { s.cleared++; const timeLeft = Math.max(0, missionDeadline(s) - s.levelElapsed); s.score += 400 + Math.floor(timeLeft * 5); s.phase = s.level === TOTAL_LEVELS - 1 ? 'won' : 'mission-clear'; emit(s, 'clear'); }
}
export function missionDeadline(s) { return DIFFICULTIES[s.difficulty].time + (LEVELS[s.level].timeBonus || 0); }
function simulate(s, input, dt) {
  if (s.phase !== 'playing') return;
  s.elapsed += dt; s.levelElapsed += dt; const level = LEVELS[s.level], p = s.player;
  if (s.levelElapsed >= missionDeadline(s)) { fail(s, 'Dawn reached the courtyard: mission clock expired.'); return; }
  p.invulnerable = Math.max(0, p.invulnerable - dt);
  let dx = Number(Boolean(input.right)) - Number(Boolean(input.left)), dy = Number(Boolean(input.down)) - Number(Boolean(input.up)); const amount = Math.hypot(dx, dy);
  p.sneaking = Boolean(input.sneak); p.moving = amount > 0;
  if (amount > 0) { dx /= amount; dy /= amount; p.facing = Math.atan2(dy, dx); const speed = p.sneaking ? 92 : 178; moveBody(p, dx * speed * dt, dy * speed * dt, level.walls, PLAYER_RADIUS, s.guards.filter(g => g.mode !== 'down').map(g => ({ x: g.x, y: g.y, radius: GUARD_RADIUS }))); }
  if (p.moving && !p.sneaking) { s.footstep -= dt; if (s.footstep <= 0) { s.footstep = .38; noise(s, p.x, p.y, level.district === 2 ? 112 : 82, 'footstep'); } } else s.footstep = 0;
  for (const c of s.clouds) c.life -= dt; s.clouds = s.clouds.filter(c => c.life > 0);
  for (const n of s.noises) n.life -= dt; s.noises = s.noises.filter(n => n.life > 0);
  const smoke = Boolean(input.smoke);
  if (smoke && !s.smokeHeld && s.smoke > 0) { s.smoke--; s.clouds.push({ x: p.x, y: p.y, radius: 78, life: 5 }); emit(s, 'smoke'); }
  s.smokeHeld = smoke;
  const kunai = Boolean(input.kunai);
  if (kunai && !s.kunaiHeld && s.kunai > 0) {
    s.kunai--; const angle = Number.isFinite(input.aimX) && Number.isFinite(input.aimY) ? Math.atan2(input.aimY - p.y, input.aimX - p.x) : p.facing;
    s.projectiles.push({ x: p.x, y: p.y, vx: Math.cos(angle) * 480, vy: Math.sin(angle) * 480, life: .7 }); emit(s, 'throw');
  }
  s.kunaiHeld = kunai;
  for (const shot of s.projectiles) {
    const sx = shot.vx * dt, sy = shot.vy * dt; let hit = null;
    for (const r of level.walls) { const contact = sweepCircleRect(shot.x, shot.y, sx, sy, 2, r); if (contact && (hit === null || contact.time < hit)) hit = contact.time; }
    shot.x += sx * (hit ?? 1); shot.y += sy * (hit ?? 1); shot.life -= dt;
    if (hit !== null || shot.life <= 0 || shot.x < 45 || shot.x > WORLD.width - 45 || shot.y < 55 || shot.y > WORLD.height - 45) { noise(s, shot.x, shot.y, 235, 'kunai'); shot.life = 0; }
  }
  s.projectiles = s.projectiles.filter(shot => shot.life > 0);
  for (const g of s.guards) { updateGuard(s, g, dt); if (s.phase !== 'playing') break; }
  if (s.phase === 'playing') updateInteraction(s, input, dt);
}
export function step(state, input = {}, duration = FIXED_STEP) {
  if (!Number.isFinite(duration) || duration <= 0 || state.phase !== 'playing') return state;
  let left = Math.min(duration, .25); while (left > EPS && state.phase === 'playing') { const dt = Math.min(FIXED_STEP, left); simulate(state, input, dt); left -= dt; }
  return state;
}
