/** Skyline Hook: deterministic fixed-step rooftop traversal. Coordinates are world pixels. */
export const WORLD = Object.freeze({ width: 960, height: 580 });
export const BODY = Object.freeze({ halfWidth: 8, halfHeight: 14 });
export const DIFFICULTIES = Object.freeze({
  standard: Object.freeze({ title: 'Standard · practice', lives: 40, time: 150, laserRate: .75, description: 'Forty batteries, generous stage clocks. The same twelve rooftops.' }),
  veteran: Object.freeze({ title: 'Veteran', lives: 12, time: 65, laserRate: 1, description: 'Twelve batteries for twelve stages. Clean swings and deliberate landings.' }),
  nightmare: Object.freeze({ title: 'Nightmare', lives: 5, time: 48, laserRate: 1.2, description: 'Five batteries. Faster security cycles. Every landing matters.' }),
});
export const DISTRICTS = Object.freeze([
  Object.freeze({ name: 'Copper Quarter', subtitle: 'Last light over the old rooftops', sky: '#1d253f', low: '#554051', glow: '#ffc575', accent: '#e8aa69', roof: '#795965' }),
  Object.freeze({ name: 'Rainline Heights', subtitle: 'Signal towers above the storm', sky: '#101f37', low: '#294858', glow: '#86d7dc', accent: '#7ed6d8', roof: '#426979' }),
  Object.freeze({ name: 'Aurora Spires', subtitle: 'The city ends where the stars begin', sky: '#16172f', low: '#393451', glow: '#ccaff6', accent: '#bdb2ff', roof: '#635779' }),
]);
const roof = (x, y, width) => ({ x, y, width, height: 580 - y, kind: 'roof' });
const ledge = (x, y, width, height = 20) => ({ x, y, width, height, kind: 'ledge' });
const spike = (x, y, count) => ({ x, y, count, width: count * 16, height: 14 });
const anchor = (x, y) => ({ x, y });
const gate = (x, top, bottom, period = 3.4, offset = 0) => ({ x, top, bottom, period, offset, warmup: .42, active: .88 });
// Each stage is authored, rather than generated. Roof edges, suspended ledges and
// anchor positions create distinct routes; no difficulty changes their geometry.
export const LEVELS = Object.freeze([
  { name: 'First delivery', district: 0, width: 1160, spawn: [70, 416], goal: [1080, 400], platforms: [roof(0, 430, 240), roof(410, 430, 250), roof(825, 400, 335)], anchors: [anchor(315, 195), anchor(744, 175)], spikes: [spike(520, 416, 3)], gates: [], relays: [[465, 396], [900, 366]], hint: 'Run, jump, then hold Hook toward a glowing anchor. Release to keep your momentum.' },
  { name: 'The long way up', district: 0, width: 1320, spawn: [70, 416], goal: [1240, 360], platforms: [roof(0, 430, 220), roof(445, 405, 205), roof(895, 360, 425)], anchors: [anchor(328, 160), anchor(769, 130)], spikes: [spike(1010, 346, 4)], gates: [], relays: [[495, 371], [1140, 326]], hint: 'Hold Jump for height. Release Hook near the far side of a swing; hold Up to reel in.' },
  { name: 'Chimney run', district: 0, width: 1380, spawn: [70, 416], goal: [1300, 400], platforms: [roof(0, 430, 225), roof(440, 410, 225), ledge(555, 327, 58, 83), roof(880, 400, 500)], anchors: [anchor(334, 155), anchor(775, 145)], spikes: [spike(975, 386, 4), spike(1140, 386, 3)], gates: [], relays: [[488, 376], [1230, 366]], hint: 'Jump over chimneys and spike tips. A held jump cannot repeat until you release it.' },
  { name: 'Copper crossing', district: 0, width: 1480, spawn: [70, 416], goal: [1400, 380], platforms: [roof(0, 430, 225), roof(500, 420, 190), roof(975, 380, 505)], anchors: [anchor(350, 150), anchor(825, 135)], spikes: [spike(1080, 366, 4)], gates: [gate(613, 285, 420, 3.5, .9)], relays: [[548, 386], [1280, 346]], hint: 'Amber bars warn before security beams turn red. Land, read the cycle, then cross.' },
  { name: 'Rain relay', district: 1, width: 1430, spawn: [70, 416], goal: [1350, 375], platforms: [roof(0, 430, 210), roof(460, 395, 205), roof(900, 375, 530)], anchors: [anchor(334, 145), anchor(790, 125)], spikes: [spike(1015, 361, 4)], gates: [gate(574, 285, 395, 3.4, .35)], relays: [[505, 361], [1230, 341]], hint: 'Rain is scenery; your grip stays reliable. An anchor behind a roof cannot catch your rope.' },
  { name: 'Between signals', district: 1, width: 1520, spawn: [70, 416], goal: [1440, 360], platforms: [roof(0, 430, 220), roof(500, 395, 180), roof(970, 360, 550)], anchors: [anchor(357, 130), anchor(825, 110)], spikes: [spike(1080, 346, 4), spike(1275, 346, 3)], gates: [gate(612, 275, 395, 3.1, .8)], relays: [[548, 361], [1360, 326]], hint: 'Carry speed through a release. A fresh Hook can catch the next visible anchor in midair.' },
  { name: 'The hanging garden', district: 1, width: 1820, spawn: [70, 416], goal: [1740, 350], platforms: [roof(0, 430, 210), ledge(475, 365, 175), ledge(930, 320, 150), roof(1390, 350, 430)], anchors: [anchor(345, 125), anchor(790, 95), anchor(1235, 70)], spikes: [spike(1500, 336, 4)], gates: [gate(1600, 215, 350, 3.2, .4)], relays: [[520, 331], [1680, 316]], hint: 'Three anchors, two suspended rest ledges. Chain the garden crossing without falling into the storm.' },
  { name: 'Storm transfer', district: 1, width: 1640, spawn: [70, 416], goal: [1560, 345], platforms: [roof(0, 430, 210), roof(505, 390, 175), roof(980, 345, 660)], anchors: [anchor(360, 125), anchor(828, 95)], spikes: [spike(1100, 331, 4), spike(1350, 331, 4)], gates: [gate(610, 265, 390, 3.3, .7), gate(1230, 210, 345, 3.6, 1.3)], relays: [[550, 356], [1480, 311]], hint: 'The clocks count only active play. Pause to read the route, then keep the delivery moving.' },
  { name: 'Above the cloudline', district: 2, width: 1590, spawn: [70, 416], goal: [1510, 350], platforms: [roof(0, 430, 200), ledge(500, 370, 165), roof(980, 350, 610)], anchors: [anchor(353, 120), anchor(825, 85)], spikes: [spike(1100, 336, 5)], gates: [gate(590, 240, 370, 3.15, .3)], relays: [[543, 336], [1380, 316]], hint: 'The tiny landing is safe; the open air is not. Brake with the opposite direction before touching down.' },
  { name: 'Glass needles', district: 2, width: 1730, spawn: [70, 416], goal: [1650, 325], platforms: [roof(0, 430, 205), ledge(445, 365, 120), ledge(645, 285, 130), roof(1100, 325, 630)], anchors: [anchor(330, 130), anchor(600, 90), anchor(930, 50)], spikes: [spike(1230, 311, 5), spike(1450, 311, 4)], gates: [gate(1380, 190, 325, 3.25, .5)], relays: [[690, 251], [1560, 291]], hint: 'Climb the staggered needles: land low, catch the upper anchor, then cross from the high shelf.' },
  { name: 'Last train skyward', district: 2, width: 1770, spawn: [70, 416], goal: [1690, 335], platforms: [roof(0, 430, 205), roof(500, 420, 250), ledge(580, 300, 140, 24), roof(1080, 335, 690)], anchors: [anchor(355, 150), anchor(640, 140), anchor(915, 65)], spikes: [spike(1200, 321, 5), spike(1440, 321, 5)], gates: [gate(690, 275, 420, 3.1, .55), gate(1325, 200, 335, 3.1, 1.1), gate(1560, 200, 335, 3.5, .4)], relays: [[540, 386], [1640, 301]], hint: 'Take the low passage or catch the station canopy to cross above its security beam. Collect the chip before choosing.' },
  { name: 'Aurora express', district: 2, width: 1830, spawn: [70, 416], goal: [1750, 310], platforms: [roof(0, 430, 195), ledge(540, 355, 155), roof(1050, 310, 780)], anchors: [anchor(375, 95), anchor(877, 55)], spikes: [spike(1175, 296, 5), spike(1435, 296, 5)], gates: [gate(625, 225, 355, 3.1, .7), gate(1325, 175, 310, 3.2, .8), gate(1590, 175, 310, 3.3, 1.4)], relays: [[580, 321], [1680, 276]], hint: 'One final delivery. Collect both signal chips, then touch the green receiver.' },
].map((level, index) => Object.freeze({ ...level, id: index + 1, platforms: Object.freeze(level.platforms.map(Object.freeze)), anchors: Object.freeze(level.anchors.map(Object.freeze)), spikes: Object.freeze(level.spikes.map(Object.freeze)), gates: Object.freeze(level.gates.map(Object.freeze)), relays: Object.freeze(level.relays.map(Object.freeze)), spawn: Object.freeze(level.spawn), goal: Object.freeze(level.goal) })));
export const TOTAL_LEVELS = LEVELS.length;
export const FIXED_STEP = 1 / 120;
export const PHYSICS = Object.freeze({ gravity: 1350, jump: 485, runSpeed: 290, swingSpeed: 620, groundAcceleration: 2100, airAcceleration: 920, hookRange: 385, coyote: .1, buffer: .12 });
const EPS = 1e-7;
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const events = (state, type, detail = {}) => { state.events.push({ id: ++state.eventId, type, x: state.player.x, y: state.player.y, ...detail }); if (state.events.length > 24) state.events.shift(); };
export function createState({ difficulty = 'veteran' } = {}) {
  if (!DIFFICULTIES[difficulty]) difficulty = 'veteran';
  const state = { difficulty, recordKey: `${difficulty}-campaign-v1`, phase: 'playing', level: 0, elapsed: 0, levelElapsed: 0, lives: DIFFICULTIES[difficulty].lives, deaths: 0, cleared: 0, relays: [], player: null, hook: null, hookHeld: false, jumpHeld: false, hookRetry: 0, jumpBuffer: 0, coyote: 0, events: [], eventId: 0, reason: '', levelTimes: [] };
  resetStage(state); return state;
}
function resetStage(state) {
  const level = LEVELS[state.level];
  state.player = { x: level.spawn[0], y: level.spawn[1], vx: 0, vy: 0, grounded: true, facing: 1 };
  state.phase = 'playing'; state.levelElapsed = 0; state.relays = level.relays.map(() => false);
  state.hook = null; state.hookHeld = false; state.jumpHeld = false; state.hookRetry = 0; state.jumpBuffer = 0; state.coyote = PHYSICS.coyote; state.reason = '';
}
export function togglePause(state) { if (state.phase === 'playing') state.phase = 'paused'; else if (state.phase === 'paused') state.phase = 'playing'; else return false; state.hookHeld = false; state.jumpHeld = false; state.jumpBuffer = 0; return true; }
export function retryStage(state) { if (state.phase !== 'dead' || state.lives <= 0) return false; resetStage(state); events(state, 'respawn'); return true; }
export function nextStage(state) { if (state.phase !== 'stage-clear') return false; if (state.level === LEVELS.length - 1) return false; state.level++; resetStage(state); events(state, 'stage'); return true; }
export function gatePhase(gate, elapsed, difficulty = 'veteran') {
  const rate = DIFFICULTIES[difficulty]?.laserRate || 1;
  const t = ((elapsed * rate + gate.offset) % gate.period + gate.period) % gate.period;
  return t < gate.warmup ? 'warning' : t < gate.warmup + gate.active ? 'active' : 'off';
}
// Translating a rectangle against a convex polygon: every separating axis shares
// one time interval. Unlike a bounding-box spike test, empty triangle corners stay safe.
export function sweepPolygon(x, y, dx, dy, halfWidth, halfHeight, polygon) {
  const axes = [[1, 0], [0, 1]];
  for (let i = 0; i < polygon.length; i++) { const a = polygon[i], b = polygon[(i + 1) % polygon.length]; axes.push([-(b[1] - a[1]), b[0] - a[0]]); }
  let enter = 0, exit = 1, normal = null;
  for (const [ax, ay] of axes) {
    const center = x * ax + y * ay, radius = halfWidth * Math.abs(ax) + halfHeight * Math.abs(ay);
    let lo = Infinity, hi = -Infinity;
    for (const [px, py] of polygon) { const dot = px * ax + py * ay; lo = Math.min(lo, dot); hi = Math.max(hi, dot); }
    const speed = dx * ax + dy * ay;
    if (Math.abs(speed) < EPS) { if (center + radius < lo - EPS || center - radius > hi + EPS) return null; continue; }
    let first = (lo - radius - center) / speed, last = (hi + radius - center) / speed;
    const sign = speed > 0 ? -1 : 1;
    if (first > last) [first, last] = [last, first];
    if (first > enter) { enter = first; const length = Math.hypot(ax, ay); normal = { x: ax / length * sign, y: ay / length * sign }; }
    exit = Math.min(exit, last); if (enter > exit + EPS) return null;
  }
  return exit >= -EPS && enter <= 1 + EPS ? { time: clamp(enter, 0, 1), normal } : null;
}
const polygonRect = r => [[r.x, r.y], [r.x + r.width, r.y], [r.x + r.width, r.y + r.height], [r.x, r.y + r.height]];
function rectSweep(x, y, dx, dy, rect, hw = BODY.halfWidth, hh = BODY.halfHeight) {
  // At a touching face, only inward movement collides; parallel movement and
  // retreat remain free. Corner ties are resolved by their actual entry time.
  const left = rect.x - hw, right = rect.x + rect.width + hw, top = rect.y - hh, bottom = rect.y + rect.height + hh;
  let enter = -Infinity, exit = Infinity, normal = null;
  for (const [origin, delta, low, high, axis] of [[x, dx, left, right, 'x'], [y, dy, top, bottom, 'y']]) {
    if (Math.abs(delta) < EPS) { if (origin <= low + EPS || origin >= high - EPS) return null; continue; }
    let a = (low - origin) / delta, b = (high - origin) / delta;
    const sign = delta > 0 ? -1 : 1;
    if (a > b) [a, b] = [b, a];
    if (a > enter) { enter = a; normal = axis === 'x' ? { x: sign, y: 0 } : { x: 0, y: sign }; }
    exit = Math.min(exit, b); if (enter > exit + EPS) return null;
  }
  if (enter < -EPS || enter > 1 + EPS || exit < 0 || !normal) return null;
  return { time: clamp(enter, 0, 1), normal };
}
function hazardHit(state, x, y, dx, dy, startElapsed = state.levelElapsed, duration = 0) {
  const level = LEVELS[state.level]; let first = null, reason = '';
  for (const strip of level.spikes) for (let i = 0; i < strip.count; i++) {
    const sx = strip.x + i * 16;
    const hit = sweepPolygon(x, y, dx, dy, BODY.halfWidth, BODY.halfHeight, [[sx + 1, strip.y + 14], [sx + 8, strip.y], [sx + 15, strip.y + 14]]);
    if (hit && (first === null || hit.time < first)) { first = hit.time; reason = 'Spike contact'; }
  }
  for (const beam of level.gates) {
    const rate = DIFFICULTIES[state.difficulty].laserRate;
    const cuts = [0, 1], phaseStart = startElapsed * rate + beam.offset;
    if (duration > 0) {
      const cycle = Math.floor(phaseStart / beam.period);
      for (let lap = cycle; lap <= cycle + 1; lap++) for (const boundary of [0, beam.warmup, beam.warmup + beam.active, beam.period]) {
        const fraction = (lap * beam.period + boundary - phaseStart) / (duration * rate);
        if (fraction > EPS && fraction < 1 - EPS) cuts.push(fraction);
      }
    }
    cuts.sort((a, b) => a - b);
    for (let index = 1; index < cuts.length; index++) {
      const from = cuts[index - 1], to = cuts[index];
      if (gatePhase(beam, startElapsed + duration * (from + to) / 2, state.difficulty) !== 'active') continue;
      const hit = sweepPolygon(x + dx * from, y + dy * from, dx * (to - from), dy * (to - from), BODY.halfWidth, BODY.halfHeight, polygonRect({ x: beam.x - 3, y: beam.top, width: 6, height: beam.bottom - beam.top }));
      const contact = hit ? from + (to - from) * hit.time : null;
      if (contact !== null && (first === null || contact < first)) { first = contact; reason = 'Security beam'; }
    }
  }
  return first === null ? null : { time: first, reason };
}
function die(state, reason) {
  state.hook = null; state.lives--; state.deaths++; state.reason = reason; state.phase = state.lives > 0 ? 'dead' : 'lost'; events(state, 'impact', { reason });
}
// The path is spent in contact order. A roof blocks a hazard behind it, while a
// visible spike before the landing wins the same frame. Three slides bound work.
function move(state, dx, dy, duration = 0) {
  const p = state.player, level = LEVELS[state.level]; let grounded = false, spent = 0;
  for (let slide = 0; slide < 3; slide++) {
    let solid = null;
    for (const rect of level.platforms) { const hit = rectSweep(p.x, p.y, dx, dy, rect); if (hit && (!solid || hit.time < solid.time)) solid = hit; }
    const hazard = hazardHit(state, p.x, p.y, dx, dy, state.levelElapsed - duration + spent, duration - spent);
    if (hazard && (!solid || hazard.time < solid.time - EPS)) { p.x += dx * hazard.time; p.y += dy * hazard.time; die(state, hazard.reason); return; }
    if (!solid) { p.x += dx; p.y += dy; break; }
    p.x += dx * solid.time; p.y += dy * solid.time;
    if (solid.normal.y < 0) grounded = true;
    const velocity = p.vx * solid.normal.x + p.vy * solid.normal.y;
    if (velocity < 0) { p.vx -= velocity * solid.normal.x; p.vy -= velocity * solid.normal.y; }
    spent += (duration - spent) * solid.time;
    dx *= 1 - solid.time; dy *= 1 - solid.time;
    const into = dx * solid.normal.x + dy * solid.normal.y;
    if (into < 0) { dx -= into * solid.normal.x; dy -= into * solid.normal.y; }
    if (Math.abs(dx) + Math.abs(dy) < EPS) break;
  }
  p.x = clamp(p.x, BODY.halfWidth, level.width - BODY.halfWidth);
  p.grounded = grounded;
}
export function anchorVisible(state, target) {
  const p = state.player;
  return !LEVELS[state.level].platforms.some(rect => { const hit = rectSweep(p.x, p.y, target.x - p.x, target.y - p.y, rect, 0, 0); return hit && hit.time > EPS && hit.time < 1 - EPS; });
}
export function targetAnchor(state, input = {}) {
  const p = state.player;
  let ax = Number.isFinite(input.aimX) ? input.aimX - p.x : p.facing * .58, ay = Number.isFinite(input.aimY) ? input.aimY - p.y : -.82;
  const magnitude = Math.hypot(ax, ay) || 1; ax /= magnitude; ay /= magnitude;
  let chosen = null, score = -Infinity;
  for (const [index, a] of LEVELS[state.level].anchors.entries()) {
    const dx = a.x - p.x, dy = a.y - p.y, distance = Math.hypot(dx, dy);
    if (distance > PHYSICS.hookRange || distance < 35 || !anchorVisible(state, a)) continue;
    const alignment = (dx * ax + dy * ay) / distance;
    if (alignment < .2) continue;
    const candidate = alignment * 3 - distance / PHYSICS.hookRange;
    if (candidate > score) { chosen = { index, x: a.x, y: a.y, distance }; score = candidate; }
  }
  return chosen;
}
function simulate(state, input, dt) {
  if (state.phase !== 'playing') return;
  const p = state.player;
  state.elapsed += dt; state.levelElapsed += dt; state.hookRetry = Math.max(0, state.hookRetry - dt);
  const direction = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (direction) p.facing = direction;
  const jump = Boolean(input.jump);
  if (jump && !state.jumpHeld) state.jumpBuffer = PHYSICS.buffer;
  else state.jumpBuffer = Math.max(0, state.jumpBuffer - dt);
  if (p.grounded) state.coyote = PHYSICS.coyote; else state.coyote = Math.max(0, state.coyote - dt);
  if (state.jumpBuffer > 0 && state.coyote > 0) { p.vy = -PHYSICS.jump; p.grounded = false; state.coyote = 0; state.jumpBuffer = 0; state.hook = null; events(state, 'jump'); }
  if (!jump && state.jumpHeld && p.vy < -190) p.vy = -190;
  state.jumpHeld = jump;
  const hookHeld = Boolean(input.hook);
  if (!hookHeld && state.hook) { events(state, 'release', { anchor: state.hook.index }); state.hook = null; }
  if (hookHeld && !state.hook && state.hookRetry === 0) {
    const target = targetAnchor(state, input); state.hookRetry = .12;
    if (target) { state.hook = { index: target.index, x: target.x, y: target.y, length: clamp(target.distance, 65, 365) }; events(state, 'attach', { anchor: target.index, targetX: target.x, targetY: target.y }); }
  }
  state.hookHeld = hookHeld;
  const acceleration = p.grounded ? PHYSICS.groundAcceleration : PHYSICS.airAcceleration;
  if (direction) { const cap = state.hook ? PHYSICS.swingSpeed : PHYSICS.runSpeed; if (Math.abs(p.vx) <= cap || Math.sign(p.vx) !== direction) p.vx = clamp(p.vx + direction * acceleration * dt, -cap, cap); }
  else if (p.grounded) p.vx *= Math.max(0, 1 - 13 * dt);
  p.vy = Math.min(900, p.vy + PHYSICS.gravity * dt);
  if (state.hook) {
    const rope = state.hook;
    rope.length = clamp(rope.length + ((input.down ? 1 : 0) - (input.up ? 1 : 0)) * 100 * dt, 65, 365);
    const dx = p.x - rope.x, dy = p.y - rope.y, length = Math.hypot(dx, dy);
    if (length > rope.length - 1 && length > 0) {
      const nx = dx / length, ny = dy / length, outward = p.vx * nx + p.vy * ny;
      if (outward > 0) { p.vx -= outward * nx; p.vy -= outward * ny; }
    }
  }
  move(state, p.vx * dt, p.vy * dt, dt);
  if (state.phase !== 'playing') return;
  if (state.hook && !anchorVisible(state, state.hook)) { state.hook = null; events(state, 'snap'); }
  if (state.hook) {
    const rope = state.hook, dx = p.x - rope.x, dy = p.y - rope.y, distance = Math.hypot(dx, dy);
    if (distance > rope.length + EPS) {
      const scale = (distance - rope.length) / distance;
      move(state, -dx * scale, -dy * scale);
      if (state.phase !== 'playing') return;
      const after = Math.hypot(p.x - rope.x, p.y - rope.y);
      if (after > rope.length + 1 || !anchorVisible(state, rope)) { state.hook = null; events(state, 'snap'); }
      else { const nx = (p.x - rope.x) / after, ny = (p.y - rope.y) / after, outward = p.vx * nx + p.vy * ny; if (outward > 0) { p.vx -= outward * nx; p.vy -= outward * ny; } }
    }
  }
  if (p.y > WORLD.height + BODY.halfHeight) { die(state, 'Missed landing'); return; }
  if (state.levelElapsed >= DIFFICULTIES[state.difficulty].time) { die(state, 'Delivery clock expired'); return; }
  const level = LEVELS[state.level];
  level.relays.forEach(([x, y], i) => { if (!state.relays[i] && Math.abs(p.x - x) < 24 && Math.abs(p.y - y) < 35) { state.relays[i] = true; events(state, 'relay', { relay: i, x, y }); } });
  const [gx, gy] = level.goal;
  if (state.relays.every(Boolean) && Math.abs(p.x - gx) < 30 && Math.abs(p.y - (gy - BODY.halfHeight)) < 36 && p.grounded) {
    state.hook = null; state.cleared++; state.levelTimes.push(state.levelElapsed); state.phase = state.level === TOTAL_LEVELS - 1 ? 'won' : 'stage-clear'; events(state, 'clear');
  }
}
/** Large caller deltas are subdivided, so a frame hitch cannot skip a hazard. */
export function step(state, input = {}, dt = FIXED_STEP) {
  if (!Number.isFinite(dt) || dt <= 0 || state.phase !== 'playing') return state;
  const time = Math.min(dt, .1), count = Math.ceil(time / FIXED_STEP), slice = time / count;
  for (let i = 0; i < count && state.phase === 'playing'; i++) simulate(state, input, slice);
  return state;
}
