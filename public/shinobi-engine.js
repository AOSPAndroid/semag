/** Shinobi Showdown: deterministic 120 Hz duels with committed, reactive swordplay. */
export const TICK_RATE = 120;
export const WORLD = Object.freeze({ width: 960, height: 640, wall: 32, minX: 48, maxX: 912, minY: 48, maxY: 592, fighterRadius: 15, roundSeconds: 75 });
export const INPUT_KEYS = Object.freeze(['up', 'down', 'left', 'right', 'attack', 'heavy', 'throw', 'parry', 'dash', 'feint']);
const cover = (id, x, y, w, h) => Object.freeze({ id, x, y, w, h });
const stage = (id, name, description, covers, spawns) => Object.freeze({ id, name, description, covers: Object.freeze(covers), spawns: Object.freeze(spawns.map(Object.freeze)) });
export const STAGES = Object.freeze({
  rooftop: stage('rooftop', 'Moonlit Rooftops', 'Offset chimneys reward flanks. The open center belongs to precise sword spacing.', [cover('west-chimney', 270, 180, 80, 80), cover('east-chimney', 610, 380, 80, 80), cover('north-vent', 440, 110, 80, 42), cover('south-vent', 440, 488, 80, 42)], [{ x: 154, y: 320 }, { x: 806, y: 320 }]),
  garden: stage('garden', 'Lantern Garden', 'A central stone plinth divides the duel; use the broad outer paths to change your angle.', [cover('garden-plinth', 444, 258, 72, 124), cover('garden-north-west', 226, 154, 104, 48), cover('garden-north-east', 630, 154, 104, 48), cover('garden-south-west', 226, 438, 104, 48), cover('garden-south-east', 630, 438, 104, 48)], [{ x: 154, y: 320 }, { x: 806, y: 320 }]),
  shrine: stage('shrine', 'Winter Shrine', 'Twin columns interrupt long throws. Crossing the shrine opens a dangerous sword lane.', [cover('shrine-west', 280, 252, 56, 136), cover('shrine-east', 624, 252, 56, 136), cover('shrine-north', 414, 146, 132, 44), cover('shrine-south', 414, 450, 132, 44)], [{ x: 154, y: 420 }, { x: 806, y: 220 }]),
});
const STAGE_ORDER = Object.freeze(Object.keys(STAGES));
export const MOVES = Object.freeze({ light: Object.freeze({ startup: 8, active: 4, recovery: 19, range: 58, cone: .8, damage: 18, cost: 14 }), heavy: Object.freeze({ startup: 24, active: 6, recovery: 32, range: 76, cone: .62, damage: 32, cost: 26 }) });
export const MOVEMENT = Object.freeze({ speed: 3.15, startupSpeed: 1.1, activeSpeed: .4, recoverySpeed: 1.5, throwSpeed: 1.7, parrySpeed: .8, feintSpeed: 1.3 });
export const DASH = Object.freeze({ duration: 20, startup: 3, invulnerableEnd: 9, cost: 28, speed: 9.2, startupSpeed: 3.3, brakeStart: 15, brakeSpeed: 4.2 });
export const PARRY = Object.freeze({ duration: 28, startup: 2, activeEnd: 9, cost: 20, cone: .85, stun: 24, refund: 8, successDuration: 11, perfectEnd: 4, perfectCone: .55, perfectStun: 40, perfectRefund: 16, perfectReflectionSpeed: 1.2 });
export const KUNAI = Object.freeze({ startup: 11, recovery: 17, speed: 11.5, damage: 14, capacity: 3, recoverTicks: 240 });
export const INPUT_BUFFER = Object.freeze({ ticks: 10, priority: Object.freeze(['dash', 'parry', 'feint', 'heavy', 'attack', 'throw']) });
export const CHAIN = Object.freeze({ max: 3, startFrame: 16, endFrame: 26, dashCancelCost: DASH.cost + 8 });
export const FEINT = Object.freeze({ startFrame: 6, endFrame: 17, cost: 12, duration: 14 });
export const emptyInput = () => ({ ...Object.fromEntries(INPUT_KEYS.map(key => [key, false])), aimX: 1, aimY: 0 });
export const cloneState = state => JSON.parse(JSON.stringify(state));
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const EPS = 1e-8;
function fighter(id, wins = 0) {
  return { id, x: id ? 806 : 154, y: 320, vx: 0, vy: 0, radius: WORLD.fighterRadius, hp: 100, maxHp: 100, stamina: 100, wins, aimX: id ? -1 : 1, aimY: 0, facing: id ? Math.PI : 0, actionFacing: id ? Math.PI : 0, action: 'idle', actionFrame: 0, attackHits: [], comboStep: 0, hitConfirmed: false, hitTick: -1, inputBuffer: null, parrySuccess: false, dashFrame: 0, dashX: 1, dashY: 0, invulnerable: false, staminaDelay: 0, kunai: KUNAI.capacity, kunaiRecoveryTicks: 0, damageDealt: 0, parries: 0, perfectParries: 0, previousInput: { ...emptyInput(), aimX: id ? -1 : 1 } };
}
export function createState(options = {}) {
  const practice = options.mode === 'practice' ? {
    bots: clamp(Number.isFinite(options.bots) ? Math.floor(options.bots) : 1, 1, 4),
    difficulty: ['normal', 'hard', 'expert'].includes(options.difficulty) ? options.difficulty : 'hard',
    stageId: Object.hasOwn(STAGES, options.stageId || '') ? options.stageId : 'rooftop',
    seed: (Number.isFinite(options.seed) ? options.seed : 37193) >>> 0,
  } : null;
  const arena = STAGES[practice?.stageId || 'rooftop'];
  const state = { gameId: 'shinobi-showdown', tick: 0, phase: 'lobby', phaseTicks: 0, round: 1, maxRounds: 5, roundTicks: WORLD.roundSeconds * TICK_RATE, winner: null, stageId: arena.id, stageName: arena.name, fighters: practice ? Array.from({ length: practice.bots + 1 }, (_, id) => ({ ...fighter(id), team: id ? 1 : 0, bot: id > 0, name: id ? ['Kage', 'Kumo', 'Hayate', 'Oboro'][id - 1] : 'You' })) : [fighter(0), fighter(1)], obstacles: arena.covers.map(rect => ({ ...rect })), projectiles: [], projectileId: 0, events: [], eventId: 0, objective: 'First to two rounds. Confirm your cuts, bait a parry, and punish the opening.' };
  if (practice) { state.practice = practice; state.winnerTeam = null; positionFighters(state, arena); }
  return state;
}
export const opposingFighters = (a, b) => !!a && !!b && a.id !== b.id && (a.team ?? a.id) !== (b.team ?? b.id);
function positionFighters(state, arena) {
  for (const f of state.fighters) {
    const spawn = arena.spawns[f.id ? 1 : 0];
    Object.assign(f, state.practice && state.practice.bots > 1 && f.id ? { x: spawn.x, y: 110 + (f.id - 1) * 420 / (state.practice.bots - 1) } : spawn);
    const other = arena.spawns[f.id ? 0 : 1], angle = Math.atan2(other.y - f.y, other.x - f.x);
    f.facing = f.actionFacing = angle; f.aimX = Math.cos(angle); f.aimY = Math.sin(angle);
    f.previousInput.aimX = f.aimX; f.previousInput.aimY = f.aimY;
  }
}
function emit(state, type, data = {}) {
  state.events.push({ id: ++state.eventId, tick: state.tick, type, ...data });
  if (state.events.length > 48) state.events.splice(0, state.events.length - 48);
}
function prepareRound(state, countdown = TICK_RATE * 2) {
  const arena = STAGES[state.practice?.stageId || STAGE_ORDER[(state.round - 1) % STAGE_ORDER.length]];
  state.stageId = arena.id; state.stageName = arena.name; state.obstacles = arena.covers.map(rect => ({ ...rect }));
  state.fighters = state.fighters.map(f => ({ ...fighter(f.id, f.wins), ...(state.practice ? { team: f.team, bot: f.bot, name: f.name } : {}) }));
  positionFighters(state, arena);
  state.projectiles = []; state.phase = 'countdown'; state.phaseTicks = countdown; state.roundTicks = WORLD.roundSeconds * TICK_RATE; state.winner = null;
  state.objective = `${arena.name} · ${arena.description}`;
  if (state.practice) state.winnerTeam = null;
  emit(state, 'round', { round: state.round, stageId: arena.id, stageName: arena.name, x: 480, y: 320 });
}
export function startMatch(state) {
  const { tick, eventId } = state; Object.assign(state, createState(state.practice ? { mode: 'practice', ...state.practice } : {}), { tick, eventId }); prepareRound(state, TICK_RATE * 3); return state;
}
export function resetLobby(state) {
  const { tick, eventId } = state; Object.assign(state, createState(state.practice ? { mode: 'practice', ...state.practice } : {}), { tick, eventId }); return state;
}
/** First contact of a segment and circle; starting overlap is deliberate contact. */
function circleContact(ax, ay, bx, by, radius) {
  const dx = bx - ax, dy = by - ay, c = ax * ax + ay * ay - radius * radius;
  if (c <= EPS) return 0;
  const a = dx * dx + dy * dy; if (a < EPS) return null;
  const b = 2 * (ax * dx + ay * dy), disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= -EPS && t <= 1 + EPS ? clamp(t, 0, 1) : null;
}
/** Rounded rectangle contact: face strips and four circular corners, never a padded square. */
function rectContact(ax, ay, bx, by, rect, radius = 0) {
  const clip = (x, y, w, h) => {
    let lo = 0, hi = 1;
    for (const [origin, delta, min, max] of [[ax, bx - ax, x, x + w], [ay, by - ay, y, y + h]]) {
      if (Math.abs(delta) < EPS) { if (origin < min - EPS || origin > max + EPS) return null; }
      else { let a = (min - origin) / delta, b = (max - origin) / delta; if (a > b) [a, b] = [b, a]; lo = Math.max(lo, a); hi = Math.min(hi, b); if (lo > hi + EPS) return null; }
    }
    return hi < 0 || lo > 1 ? null : Math.max(0, lo);
  };
  if (!radius) return clip(rect.x, rect.y, rect.w, rect.h);
  if (clip(rect.x - radius, rect.y - radius, rect.w + radius * 2, rect.h + radius * 2) === null) return null;
  let first = null;
  const accept = t => { if (t !== null && (first === null || t < first)) first = t; };
  accept(clip(rect.x - radius, rect.y, rect.w + radius * 2, rect.h));
  accept(clip(rect.x, rect.y - radius, rect.w, rect.h + radius * 2));
  for (const x of [rect.x, rect.x + rect.w]) for (const y of [rect.y, rect.y + rect.h]) accept(circleContact(ax - x, ay - y, bx - x, by - y, radius));
  return first;
}
/** Shared static-cover queries for practice decisions, using actual swept geometry. */
export function clearPath(state, ax, ay, bx, by, radius = 0) {
  return [ax, ay, bx, by, radius].every(Number.isFinite) && radius >= 0 && !state.obstacles.some(rect => rectContact(ax, ay, bx, by, rect, radius) !== null);
}
const stationaryPath = f => [{ ax: f.x, ay: f.y, bx: f.x, by: f.y, t0: 0, t1: 1 }];
function pointAt(path, t) {
  const segment = path.find(p => t >= p.t0 - EPS && t <= p.t1 + EPS) || path.at(-1);
  const u = segment.t1 - segment.t0 > EPS ? clamp((t - segment.t0) / (segment.t1 - segment.t0), 0, 1) : 1;
  return { x: segment.ax + (segment.bx - segment.ax) * u, y: segment.ay + (segment.by - segment.ay) * u };
}
function moveFighter(state, f, dx, dy) {
  let x = f.x, y = f.y, time = 0, remaining = 1;
  const path = [];
  for (let count = 0; count < 3 && remaining > EPS; count++) {
    let first = 1, normal = null;
    const accept = (t, nx, ny) => { if (t !== null && t < first + EPS && dx * nx + dy * ny < -EPS) { first = t; normal = { x: nx, y: ny }; } };
    for (const rect of state.obstacles) {
      const t = rectContact(x, y, x + dx, y + dy, rect, f.radius);
      if (t === null) continue;
      const cx = x + dx * t, cy = y + dy * t, nx = cx - clamp(cx, rect.x, rect.x + rect.w), ny = cy - clamp(cy, rect.y, rect.y + rect.h), length = Math.hypot(nx, ny);
      if (length > EPS) accept(t, nx / length, ny / length);
    }
    if (dx < -EPS) accept((WORLD.minX - x) / dx, 1, 0);
    if (dx > EPS) accept((WORLD.maxX - x) / dx, -1, 0);
    if (dy < -EPS) accept((WORLD.minY - y) / dy, 0, 1);
    if (dy > EPS) accept((WORLD.maxY - y) / dy, 0, -1);
    first = clamp(first, 0, 1);
    const bx = x + dx * first, by = y + dy * first, next = time + remaining * first;
    if (next > time + EPS) path.push({ ax: x, ay: y, bx, by, t0: time, t1: next });
    x = bx; y = by; time = next; remaining *= 1 - first;
    if (!normal || remaining <= EPS) break;
    dx *= 1 - first; dy *= 1 - first;
    const inward = Math.min(0, dx * normal.x + dy * normal.y);
    dx -= inward * normal.x; dy -= inward * normal.y;
    if (Math.hypot(dx, dy) < EPS) break;
  }
  f.x = clamp(x, WORLD.minX, WORLD.maxX); f.y = clamp(y, WORLD.minY, WORLD.maxY);
  if (time < 1 - EPS || !path.length) path.push({ ax: f.x, ay: f.y, bx: f.x, by: f.y, t0: time, t1: 1 });
  return path;
}
function pathContact(a, b, radius, enteringOnly = false, from = 0) {
  let first = null;
  for (const ap of a) for (const bp of b) {
    const lo = Math.max(ap.t0, bp.t0, from), hi = Math.min(ap.t1, bp.t1);
    if (hi <= lo + EPS) continue;
    const aa = pointAt([ap], lo), ab = pointAt([ap], hi), ba = pointAt([bp], lo), bb = pointAt([bp], hi);
    const rx = aa.x - ba.x, ry = aa.y - ba.y, dx = ab.x - bb.x - rx, dy = ab.y - bb.y - ry;
    const t = circleContact(rx, ry, rx + dx, ry + dy, radius);
    // Body contacts constrain inward motion only. Tangent or separating motion
    // must remain free; projectiles still contact a body they start touching.
    if (t !== null && enteringOnly && (rx + dx * t) * dx + (ry + dy * t) * dy >= -EPS) continue;
    if (t !== null) { const at = lo + (hi - lo) * t; if (first === null || at < first) first = at; }
  }
  return first;
}
function stopAt(path, time) {
  const point = pointAt(path, time), kept = [];
  for (const p of path) {
    if (p.t0 >= time - EPS) break;
    const end = Math.min(time, p.t1), q = pointAt([p], end);
    kept.push({ ...p, bx: q.x, by: q.y, t1: end });
  }
  kept.push({ ax: point.x, ay: point.y, bx: point.x, by: point.y, t0: time, t1: 1 });
  return { path: kept, point };
}
function velocityAt(path, time) {
  const p = path.find(p => time >= p.t0 - EPS && time < p.t1 - EPS) || path.at(-1), duration = p.t1 - p.t0;
  return duration > EPS ? { x: (p.bx - p.ax) / duration, y: (p.by - p.ay) / duration } : { x: 0, y: 0 };
}
function contactResponse(state, f, point, velocity, dx, dy) {
  const normals = [];
  for (const rect of state.obstacles) {
    const nx = point.x - clamp(point.x, rect.x, rect.x + rect.w), ny = point.y - clamp(point.y, rect.y, rect.y + rect.h), length = Math.hypot(nx, ny);
    if (length > EPS && length <= f.radius + 1e-6) normals.push({ x: nx / length, y: ny / length });
  }
  if (point.x <= WORLD.minX + EPS) normals.push({ x: 1, y: 0 });
  if (point.x >= WORLD.maxX - EPS) normals.push({ x: -1, y: 0 });
  if (point.y <= WORLD.minY + EPS) normals.push({ x: 0, y: 1 });
  if (point.y >= WORLD.maxY - EPS) normals.push({ x: 0, y: -1 });
  for (let pass = 0; pass < 3; pass++) for (const n of normals) {
    // A fighter already moving away may reduce that outward velocity. A face
    // constrains the correction only while it is actually holding them still.
    if (velocity.x * n.x + velocity.y * n.y > EPS) continue;
    const inward = Math.min(0, dx * n.x + dy * n.y); dx -= inward * n.x; dy -= inward * n.y;
  }
  return { x: dx, y: dy };
}
function collideFighters(state, paths) {
  const live = state.fighters.filter(f => f.hp > 0);
  const nextContact = from => {
    let first = null;
    for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
      const a = live[i], b = live[j], time = pathContact(paths[a.id], paths[b.id], a.radius + b.radius, true, from);
      if (time !== null && (!first || time < first.time - EPS)) first = { a, b, time };
    }
    return first;
  };
  let from = 0;
  for (let iteration = 0; iteration < 6 * Math.max(1, live.length * (live.length - 1) / 2); iteration++) {
    const contact = nextContact(from); if (!contact) return;
    const { a, b, time } = contact, pair = [a, b];
    const pa = pointAt(paths[a.id], time), pb = pointAt(paths[b.id], time), length = Math.hypot(pb.x - pa.x, pb.y - pa.y);
    const nx = length > EPS ? (pb.x - pa.x) / length : 1, ny = length > EPS ? (pb.y - pa.y) / length : 0;
    // Resolve the motion that survived cover sweeps, never the blocked input
    // velocity. Only relative closing motion is constrained, so a fighter may
    // follow an escaping opponent without freezing either player's sidestep.
    const velocities = pair.map(f => velocityAt(paths[f.id], time)), [va, vb] = velocities;
    const na = va.x * nx + va.y * ny, nb = vb.x * nx + vb.y * ny, closing = Math.max(0, na - nb);
    const pushA = Math.max(0, na), pushB = Math.max(0, -nb);
    const speeds = velocities.map(v => Math.hypot(v.x, v.y));
    const responseA = contactResponse(state, a, pa, va, -nx, -ny), responseB = contactResponse(state, b, pb, vb, nx, ny);
    // A contact correction cannot point into a face already blocking movement.
    // Solve using the remaining response directions, avoiding a body/cover
    // projection loop that would otherwise cancel both tangential paths.
    const mobility = pushA * Math.max(0, -responseA.x * nx - responseA.y * ny) + pushB * Math.max(0, responseB.x * nx + responseB.y * ny);
    if (mobility > EPS) {
      const correction = closing / mobility;
      va.x += correction * pushA * responseA.x; va.y += correction * pushA * responseA.y;
      vb.x += correction * pushB * responseB.x; vb.y += correction * pushB * responseB.y;
    } else { va.x = va.y = vb.x = vb.y = 0; }
    for (const [id, velocity] of velocities.entries()) {
      const speed = Math.hypot(velocity.x, velocity.y);
      if (speed > speeds[id] + EPS) { velocity.x *= speeds[id] / speed; velocity.y *= speeds[id] / speed; }
    }
    for (const [index, f] of pair.entries()) {
      const result = stopAt(paths[f.id], time), velocity = velocities[index];
      // A stationary opponent receives no shove. Both moving fighters share
      // the constraint according to their own inward contribution.
      f.x = result.point.x; f.y = result.point.y;
      const tail = moveFighter(state, f, velocity.x * (1 - time), velocity.y * (1 - time));
      paths[f.id] = [...result.path.slice(0, -1), ...tail.map(p => ({ ...p, t0: time + p.t0 * (1 - time), t1: time + p.t1 * (1 - time) }))];
    }
    from = time;
  }
  // Crowding against multiple cover faces stays bounded and conservative.
  const contact = nextContact(from);
  if (contact) for (const f of live) {
    const result = stopAt(paths[f.id], contact.time); paths[f.id] = result.path; f.x = result.point.x; f.y = result.point.y;
  }
}
/** Project displayed fighters through the same swept cover/body contacts as play. */
export function sweepPresentationFighters(state, desiredFighters) {
  if (!Array.isArray(desiredFighters)) return [];
  const copies = desiredFighters.map(f => ({ ...f }));
  if (!Array.isArray(state?.fighters) || state.fighters.length !== copies.length || !Array.isArray(state.obstacles)) return copies;
  const bases = state.fighters, displayed = new Map(copies.map(f => [f.id, f]));
  if (bases.some(f => !displayed.has(f.id) || !Number.isFinite(f.x) || !Number.isFinite(f.y) || !Number.isFinite(f.radius) || f.radius <= 0)) return copies;
  const actors = bases.map(f => ({ ...f })), simulation = { ...state, fighters: actors };
  const paths = [];
  for (const f of actors) {
    const target = displayed.get(f.id), dx = target.x - f.x, dy = target.y - f.y;
    const valid = f.hp > 0 && Number.isFinite(dx) && Number.isFinite(dy) && Math.hypot(dx, dy) <= 128;
    paths[f.id] = moveFighter(simulation, f, valid ? dx : 0, valid ? dy : 0);
  }
  collideFighters(simulation, paths);
  for (const f of actors) { displayed.get(f.id).x = f.x; displayed.get(f.id).y = f.y; }
  return copies;
}
function readInput(f, raw) {
  const input = emptyInput(); for (const key of INPUT_KEYS) input[key] = raw?.[key] === true;
  const x = Number.isFinite(raw?.aimX) ? clamp(raw.aimX, -1, 1) : f.aimX, y = Number.isFinite(raw?.aimY) ? clamp(raw.aimY, -1, 1) : f.aimY;
  const length = Math.hypot(x, y); if (length > .0001) { f.aimX = x / length; f.aimY = y / length; }
  input.aimX = f.aimX; input.aimY = f.aimY; f.facing = Math.atan2(f.aimY, f.aimX); return input;
}
function beginAction(state, f, action, cost, comboStep = action === 'light' ? 1 : 0) {
  const intent = f.inputBuffer;
  const committedFacing = action === 'feint' ? f.actionFacing : intent ? Math.atan2(intent.aimY, intent.aimX) : f.facing;
  f.stamina -= cost; f.staminaDelay = 60; f.action = action; f.actionFrame = 0; f.actionFacing = committedFacing; f.attackHits = [];
  if (action === 'dash') { const directional = intent?.moveX || intent?.moveY; f.dashX = directional ? intent.moveX : intent?.aimX ?? f.aimX; f.dashY = directional ? intent.moveY : intent?.aimY ?? f.aimY; }
  f.comboStep = comboStep; f.hitConfirmed = false; f.hitTick = -1; f.parrySuccess = false; f.inputBuffer = null;
  emit(state, action === 'light' || action === 'heavy' ? 'attack' : action === 'parry' ? 'parryStart' : action, { fighter: f.id, action, comboStep, facing: f.actionFacing, x: f.x, y: f.y });
}
function busy(f) { return !['idle', 'run'].includes(f.action); }
export function getMove(f) { return MOVES[f?.action] || null; }
function duration(f) { const move = getMove(f); return move ? move.startup + move.active + move.recovery : f.action === 'throw' ? KUNAI.startup + 1 + KUNAI.recovery : f.action === 'parry' ? f.parrySuccess ? PARRY.successDuration : PARRY.duration : f.action === 'dash' ? DASH.duration : f.action === 'feint' ? FEINT.duration : f.action === 'stun' ? f.stunDuration || PARRY.stun : 0; }
/** Availability is shared by controls, practice opponents, and visible combat cues. */
export function getCombatOptions(f) {
  const alive = f?.hp > 0, frame = f?.actionFrame || 0;
  const confirmedRecovery = alive && f.action === 'light' && f.hitConfirmed === true && f.comboStep < CHAIN.max && frame >= CHAIN.startFrame && frame <= CHAIN.endFrame;
  const parryActive = alive && f.action === 'parry' && frame >= PARRY.startup && frame <= PARRY.activeEnd;
  return {
    canChain: Boolean(confirmedRecovery && f.stamina >= MOVES.light.cost),
    canDashCancel: Boolean(confirmedRecovery && f.stamina >= CHAIN.dashCancelCost),
    canFeint: Boolean(alive && f.action === 'heavy' && frame >= FEINT.startFrame && frame <= FEINT.endFrame && f.stamina >= FEINT.cost),
    parryActive: Boolean(parryActive),
    perfectParryActive: Boolean(parryActive && frame <= PARRY.perfectEnd),
    bufferedAction: f?.inputBuffer?.action || null,
  };
}
function bufferInput(state, f, input) {
  if (f.inputBuffer && --f.inputBuffer.ticks <= 0) f.inputBuffer = null;
  const pressed = INPUT_BUFFER.priority.find(key => input[key] && !f.previousInput[key]);
  if (pressed) {
    // A feint is an intentional early-heavy choice. It never becomes a queued
    // attack in neutral or after the blade has committed to its active sector.
    if (pressed !== 'feint' || f.action === 'heavy' && f.actionFrame <= FEINT.endFrame) {
      const dx = Number(input.right) - Number(input.left), dy = Number(input.down) - Number(input.up), length = Math.hypot(dx, dy);
      f.inputBuffer = { action: pressed, ticks: INPUT_BUFFER.ticks, pressedTick: state.tick, aimX: input.aimX, aimY: input.aimY, moveX: length ? dx / length : 0, moveY: length ? dy / length : 0 };
    }
  }
  if (f.inputBuffer?.action === 'feint' && (f.action !== 'heavy' || f.actionFrame > FEINT.endFrame)) f.inputBuffer = null;
}
function startBufferedAction(state, f, moving) {
  const choice = f.inputBuffer?.action, options = getCombatOptions(f);
  if (choice === 'feint' && options.canFeint) {
    beginAction(state, f, 'feint', FEINT.cost); return;
  }
  const confirmedPress = f.inputBuffer && f.inputBuffer.pressedTick >= f.hitTick;
  if (choice === 'attack' && options.canChain && confirmedPress) {
    const comboStep = f.comboStep + 1;
    beginAction(state, f, 'light', MOVES.light.cost, comboStep);
    emit(state, 'chain', { fighter: f.id, comboStep, facing: f.actionFacing, x: f.x, y: f.y }); return;
  }
  if (choice === 'dash' && options.canDashCancel && confirmedPress) {
    beginAction(state, f, 'dash', CHAIN.dashCancelCost);
    emit(state, 'dashCancel', { fighter: f.id, facing: f.actionFacing, x: f.x, y: f.y }); return;
  }
  if (busy(f)) return;
  if (choice === 'dash' && f.stamina >= DASH.cost) {
    beginAction(state, f, 'dash', DASH.cost);
  } else if (choice === 'parry' && f.stamina >= PARRY.cost) beginAction(state, f, 'parry', PARRY.cost);
  else if (choice === 'heavy' && f.stamina >= MOVES.heavy.cost) beginAction(state, f, 'heavy', MOVES.heavy.cost);
  else if (choice === 'attack' && f.stamina >= MOVES.light.cost) beginAction(state, f, 'light', MOVES.light.cost);
  else if (choice === 'throw' && f.kunai > 0 && f.stamina >= 6) { beginAction(state, f, 'throw', 6); f.kunai--; }
  else f.action = moving ? 'run' : 'idle';
}
function updateFighter(state, f, input) {
  f.invulnerable = false; if (f.staminaDelay > 0) f.staminaDelay--;
  if (busy(f)) { f.actionFrame++; if (f.actionFrame >= duration(f)) { f.action = 'idle'; f.actionFrame = 0; f.comboStep = 0; f.hitConfirmed = false; f.hitTick = -1; f.parrySuccess = false; } }
  const rawX = Number(input.right) - Number(input.left), rawY = Number(input.down) - Number(input.up), length = Math.hypot(rawX, rawY), nx = length ? rawX / length : 0, ny = length ? rawY / length : 0;
  bufferInput(state, f, input); startBufferedAction(state, f, length > 0);
  let speed = MOVEMENT.speed;
  if (getMove(f)) { const move = getMove(f); speed = f.actionFrame < move.startup ? MOVEMENT.startupSpeed : f.actionFrame < move.startup + move.active ? MOVEMENT.activeSpeed : MOVEMENT.recoverySpeed; }
  if (f.action === 'throw') speed = MOVEMENT.throwSpeed;
  if (f.action === 'parry') speed = MOVEMENT.parrySpeed;
  if (f.action === 'feint') speed = MOVEMENT.feintSpeed;
  if (f.action === 'stun') speed = 0;
  if (f.action === 'dash') {
    f.dashFrame = f.actionFrame; f.invulnerable = f.actionFrame >= DASH.startup && f.actionFrame <= DASH.invulnerableEnd;
    const dashSpeed = f.actionFrame < DASH.startup ? DASH.startupSpeed : f.actionFrame >= DASH.brakeStart ? DASH.brakeSpeed : DASH.speed;
    f.vx = f.dashX * dashSpeed; f.vy = f.dashY * dashSpeed;
  } else { f.vx = nx * speed; f.vy = ny * speed; }
  if (!busy(f) && f.staminaDelay === 0) f.stamina = Math.min(100, f.stamina + .30);
  // Recover one tool every two seconds, but only while free to move. Throw spam has a real opening cost.
  if (f.kunai < KUNAI.capacity && !busy(f)) { f.kunaiRecoveryTicks++; if (f.kunaiRecoveryTicks >= KUNAI.recoverTicks) { f.kunai++; f.kunaiRecoveryTicks = 0; emit(state, 'recovered', { fighter: f.id, x: f.x, y: f.y }); } }
  f.previousInput = input; return moveFighter(state, f, f.vx, f.vy);
}
function parryType(f, fromX, fromY) {
  if (!getCombatOptions(f).parryActive) return null;
  const dx = fromX - f.x, dy = fromY - f.y, length = Math.hypot(dx, dy);
  const alignment = length < EPS ? 1 : (dx * Math.cos(f.actionFacing) + dy * Math.sin(f.actionFacing)) / length;
  if (alignment < Math.cos(PARRY.cone)) return null;
  return f.actionFrame <= PARRY.perfectEnd && alignment >= Math.cos(PARRY.perfectCone) ? 'perfect' : 'normal';
}
function rewardParry(f, perfect) {
  f.parries++; if (perfect) f.perfectParries++;
  f.parrySuccess = true; f.stamina = Math.min(100, f.stamina + (perfect ? PARRY.perfectRefund : PARRY.refund));
}
function hurt(state, source, target, damage, x, y, type) {
  const taken = Math.min(target.hp, damage); target.hp -= taken; source.damageDealt += taken; target.inputBuffer = null;
  if (taken > 0 && (type === 'light' || type === 'heavy')) { source.hitConfirmed = true; source.hitTick = state.tick; }
  emit(state, 'hit', { fighter: source.id, target: target.id, damage: taken, x, y, attack: type, comboStep: type === 'light' ? source.comboStep : 0 });
}
function bladeContact(state, source, target, move) {
  const dx = target.x - source.x, dy = target.y - source.y, length = Math.hypot(dx, dy);
  if (length < EPS || length - target.radius > move.range) return null;
  const relative = angle => Math.atan2(Math.sin(angle - source.actionFacing), Math.cos(angle - source.actionFacing));
  const center = relative(Math.atan2(dy, dx)), spread = Math.asin(Math.min(1, target.radius / length));
  // Partition the blade's sector at body tangencies and cover silhouettes. A
  // finite radial edge, including its tip, must actually intersect the body.
  const cuts = [-move.cone, move.cone];
  const arcCos = (length * length + move.range * move.range - target.radius * target.radius) / (2 * length * move.range);
  const arcSpread = arcCos >= -1 && arcCos <= 1 ? Math.acos(arcCos) : null;
  const bodyCuts = [center - spread, center, center + spread];
  if (arcSpread !== null) bodyCuts.push(center - arcSpread, center + arcSpread);
  for (const angle of bodyCuts) if (angle >= -move.cone && angle <= move.cone) cuts.push(angle);
  for (const rect of state.obstacles) for (const x of [rect.x, rect.x + rect.w]) for (const y of [rect.y, rect.y + rect.h]) {
    const angle = relative(Math.atan2(y - source.y, x - source.x));
    if (angle >= -move.cone && angle <= move.cone) cuts.push(angle);
  }
  cuts.sort((a, b) => a - b);
  const angles = [...cuts];
  for (let i = 1; i < cuts.length; i++) {
    angles.push((cuts[i - 1] + cuts[i]) / 2);
    angles.push(clamp(center, cuts[i - 1], cuts[i]));
  }
  let first = null;
  for (const angle of angles) {
    const facing = source.actionFacing + angle, bx = source.x + Math.cos(facing) * move.range, by = source.y + Math.sin(facing) * move.range;
    const t = circleContact(source.x - target.x, source.y - target.y, bx - target.x, by - target.y, target.radius);
    if (t === null) continue;
    const x = source.x + (bx - source.x) * t, y = source.y + (by - source.y) * t;
    if (state.obstacles.some(rect => rectContact(source.x, source.y, x, y, rect) !== null)) continue;
    if (!first || t < first.t) first = { x, y, t };
  }
  return first;
}
function melee(state) {
  const contacts = [];
  for (const source of state.fighters) {
    const move = MOVES[source.action];
    if (!move || source.hp <= 0 || source.actionFrame < move.startup || source.actionFrame >= move.startup + move.active) continue;
    for (const target of state.fighters) {
      if (!opposingFighters(source, target) || target.hp <= 0 || source.attackHits.includes(target.id) || target.invulnerable) continue;
      const contact = bladeContact(state, source, target, move);
      if (contact) contacts.push({ source, target, move, ...contact, parried: parryType(target, source.x, source.y), action: source.action });
    }
  }
  // Evaluate both committed strikes before applying damage so equal-tick trades are symmetric.
  for (const hit of contacts) {
    const { source, target, move, x, y, parried, action } = hit; source.attackHits.push(target.id);
    if (parried) {
      const perfect = parried === 'perfect';
      source.action = 'stun'; source.actionFrame = 0; source.stunDuration = perfect ? PARRY.perfectStun : PARRY.stun; source.vx = source.vy = 0; source.inputBuffer = null; source.hitConfirmed = false; source.hitTick = -1; source.comboStep = 0;
      rewardParry(target, perfect);
      emit(state, 'parry', { fighter: target.id, target: source.id, perfect, x, y, facing: target.actionFacing });
    } else hurt(state, source, target, move.damage, x, y, action);
  }
}

function throwKunai(state, f) {
  const nx = Math.cos(f.actionFacing), ny = Math.sin(f.actionFacing), x = f.x + nx * (f.radius + 5), y = f.y + ny * (f.radius + 5);
  let first = null;
  for (const rect of state.obstacles) { const t = rectContact(f.x, f.y, x, y, rect, 3); if (t !== null && (first === null || t < first)) first = t; }
  emit(state, 'throw', { fighter: f.id, facing: f.actionFacing, x, y, release: true });
  if (first !== null) { emit(state, 'cover', { fighter: f.id, x: f.x + (x - f.x) * first, y: f.y + (y - f.y) * first }); return; }
  if (state.projectiles.length < 24) state.projectiles.push({ id: ++state.projectileId, owner: f.id, x, y, px: x, py: y, vx: nx * KUNAI.speed, vy: ny * KUNAI.speed, radius: 3, damage: KUNAI.damage, life: 100, bornTick: state.tick, reflections: 0 });
}
function projectiles(state, paths) {
  const kept = [];
  for (const shot of state.projectiles) {
    const ax = shot.x, ay = shot.y, bx = ax + shot.vx, by = ay + shot.vy;
    let first = null, target = null;
    for (const rect of state.obstacles) { const t = rectContact(ax, ay, bx, by, rect, shot.radius); if (t !== null && (first === null || t < first)) { first = t; target = null; } }
    const source = state.fighters.find(f => f.id === shot.owner);
    if (!source) continue;
    for (const opponent of state.fighters) if (opposingFighters(source, opponent) && opponent.hp > 0 && !opponent.invulnerable) {
      const body = shot.bornTick === state.tick ? [{ ax: opponent.x, ay: opponent.y, bx: opponent.x, by: opponent.y, t0: 0, t1: 1 }] : paths[opponent.id];
      const t = pathContact([{ ax, ay, bx, by, t0: 0, t1: 1 }], body, opponent.radius + shot.radius);
      if (t !== null && (first === null || t < first - EPS)) { first = t; target = opponent; }
    }
    shot.px = ax; shot.py = ay; shot.life--;
    if (first !== null) {
      const x = ax + (bx - ax) * first, y = ay + (by - ay) * first;
      if (!target) { emit(state, 'cover', { fighter: shot.owner, x, y }); continue; }
      const point = shot.bornTick === state.tick ? { x: target.x, y: target.y } : pointAt(paths[target.id], first);
      // Direction comes from the actual incoming contact, not the projectile's end position.
      const parried = shot.reflections < 2 && parryType({ ...target, x: point.x, y: point.y }, x - shot.vx, y - shot.vy);
      if (parried) {
        const perfect = parried === 'perfect', speed = perfect ? PARRY.perfectReflectionSpeed : 1;
        shot.owner = target.id; shot.vx *= -speed; shot.vy *= -speed; shot.x = x; shot.y = y; shot.bornTick = state.tick; shot.reflections++;
        rewardParry(target, perfect);
        emit(state, 'deflect', { fighter: target.id, perfect, x, y, facing: target.actionFacing }); kept.push(shot);
      } else hurt(state, source, target, shot.damage, x, y, 'kunai');
      continue;
    }
    shot.x = bx; shot.y = by;
    if (shot.life > 0 && bx >= WORLD.wall && bx <= WORLD.width - WORLD.wall && by >= WORLD.wall && by <= WORLD.height - WORLD.wall) kept.push(shot);
  }
  state.projectiles = kept;
}
function finishRound(state, winner, reason) {
  state.phase = 'roundEnd'; state.phaseTicks = TICK_RATE * 2; state.winner = winner;
  if (state.practice) state.winnerTeam = winner === null ? null : state.fighters[winner].team;
  if (winner !== null) for (const f of state.fighters) if (state.practice ? f.team === state.winnerTeam : f.id === winner) f.wins++;
  state.projectiles = [];
  for (const f of state.fighters) { f.vx = f.vy = 0; f.invulnerable = false; f.action = f.hp <= 0 ? 'dead' : 'idle'; f.actionFrame = 0; f.inputBuffer = null; f.hitConfirmed = false; f.hitTick = -1; f.comboStep = 0; f.parrySuccess = false; }
  emit(state, 'roundEnd', { winner, reason, x: 480, y: 320 });
}
export function step(state, inputs = []) {
  state.tick++;
  if (state.phase === 'lobby' || state.phase === 'matchEnd') return state;
  if (state.phase === 'countdown') {
    for (const f of state.fighters) { f.previousInput = readInput(f, inputs[f.id]); f.inputBuffer = null; }
    if (--state.phaseTicks <= 0) { state.phase = 'fight'; state.phaseTicks = 0; emit(state, 'fight', { round: state.round }); }
    return state;
  }
  if (state.phase === 'roundEnd') {
    if (--state.phaseTicks <= 0) {
      const winner = state.fighters.find(f => f.wins >= 2);
      if (winner || state.round >= state.maxRounds) {
        state.phase = 'matchEnd'; const [a, b] = state.fighters; state.winner = winner ? state.practice ? winner.team === 0 ? 0 : 1 : winner.id : a.wins === b.wins ? null : a.wins > b.wins ? 0 : 1;
        if (state.practice) state.winnerTeam = state.winner === null ? null : state.fighters[state.winner].team;
        emit(state, 'matchEnd', { winner: state.winner });
      } else { state.round++; prepareRound(state); }
    }
    return state;
  }
  const paths = state.fighters.map(f => {
    if (f.hp > 0) return updateFighter(state, f, readInput(f, inputs[f.id]));
    f.action = 'dead'; f.vx = f.vy = 0; f.inputBuffer = null; f.invulnerable = false; return stationaryPath(f);
  });
  collideFighters(state, paths);
  // Existing tools advance against the actual piecewise fighter path. New tools are born after movement.
  projectiles(state, paths); melee(state);
  for (const f of state.fighters) if (f.hp > 0 && f.action === 'throw' && f.actionFrame === KUNAI.startup) throwKunai(state, f);
  state.roundTicks--;
  if (state.practice) {
    const human = state.fighters[0], bots = state.fighters.slice(1), liveBots = bots.some(f => f.hp > 0);
    if (human.hp <= 0 || !liveBots) finishRound(state, human.hp <= 0 && !liveBots ? null : human.hp > 0 ? 0 : 1, 'knockout');
    else if (state.roundTicks <= 0) {
      const health = bots.reduce((sum, f) => sum + Math.max(0, f.hp) / f.maxHp, 0) / bots.length, humanHealth = human.hp / human.maxHp;
      finishRound(state, Math.abs(humanHealth - health) < EPS ? null : humanHealth > health ? 0 : 1, 'timeout');
    }
  } else {
    const [a, b] = state.fighters;
    if (a.hp <= 0 || b.hp <= 0) finishRound(state, a.hp <= 0 && b.hp <= 0 ? null : a.hp > 0 ? 0 : 1, 'knockout');
    else if (state.roundTicks <= 0) finishRound(state, a.hp === b.hp ? null : a.hp > b.hp ? 0 : 1, 'timeout');
  }
  return state;
}
