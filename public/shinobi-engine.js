/** Shinobi Showdown: deterministic 120 Hz duels with committed swordplay. */
export const TICK_RATE = 120;
export const WORLD = Object.freeze({ width: 960, height: 640, wall: 32, minX: 48, maxX: 912, minY: 48, maxY: 592, fighterRadius: 15, roundSeconds: 75 });
export const INPUT_KEYS = Object.freeze(['up', 'down', 'left', 'right', 'attack', 'heavy', 'throw', 'parry', 'dash']);
const cover = (id, x, y, w, h) => Object.freeze({ id, x, y, w, h });
const stage = (id, name, description, covers, spawns) => Object.freeze({ id, name, description, covers: Object.freeze(covers), spawns: Object.freeze(spawns.map(Object.freeze)) });
export const STAGES = Object.freeze({
  rooftop: stage('rooftop', 'Moonlit Rooftops', 'Offset chimneys reward flanks. The open center belongs to precise sword spacing.', [cover('west-chimney', 270, 180, 80, 80), cover('east-chimney', 610, 380, 80, 80), cover('north-vent', 440, 110, 80, 42), cover('south-vent', 440, 488, 80, 42)], [{ x: 154, y: 320 }, { x: 806, y: 320 }]),
  garden: stage('garden', 'Lantern Garden', 'A central stone plinth divides the duel; use the broad outer paths to change your angle.', [cover('garden-plinth', 444, 258, 72, 124), cover('garden-north-west', 226, 154, 104, 48), cover('garden-north-east', 630, 154, 104, 48), cover('garden-south-west', 226, 438, 104, 48), cover('garden-south-east', 630, 438, 104, 48)], [{ x: 154, y: 320 }, { x: 806, y: 320 }]),
  shrine: stage('shrine', 'Winter Shrine', 'Twin columns interrupt long throws. Crossing the shrine opens a dangerous sword lane.', [cover('shrine-west', 280, 252, 56, 136), cover('shrine-east', 624, 252, 56, 136), cover('shrine-north', 414, 146, 132, 44), cover('shrine-south', 414, 450, 132, 44)], [{ x: 154, y: 420 }, { x: 806, y: 220 }]),
});
const STAGE_ORDER = Object.freeze(Object.keys(STAGES));
export const MOVES = Object.freeze({ light: Object.freeze({ startup: 10, active: 5, recovery: 23, range: 58, cone: .8, damage: 18, cost: 14 }), heavy: Object.freeze({ startup: 28, active: 7, recovery: 42, range: 76, cone: .62, damage: 32, cost: 26 }) });
export const DASH = Object.freeze({ duration: 23, startup: 3, invulnerableEnd: 12, cost: 30, speed: 8.5 });
export const PARRY = Object.freeze({ duration: 30, startup: 3, activeEnd: 13, cost: 20, cone: .95, stun: 40 });
export const KUNAI = Object.freeze({ startup: 14, recovery: 24, speed: 10, damage: 14, capacity: 3, recoverTicks: 240 });
export const emptyInput = () => ({ ...Object.fromEntries(INPUT_KEYS.map(key => [key, false])), aimX: 1, aimY: 0 });
export const cloneState = state => JSON.parse(JSON.stringify(state));
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const EPS = 1e-8;
function fighter(id, wins = 0) {
  return { id, x: id ? 806 : 154, y: 320, vx: 0, vy: 0, radius: WORLD.fighterRadius, hp: 100, maxHp: 100, stamina: 100, wins, aimX: id ? -1 : 1, aimY: 0, facing: id ? Math.PI : 0, actionFacing: id ? Math.PI : 0, action: 'idle', actionFrame: 0, attackHits: [], dashFrame: 0, dashX: 1, dashY: 0, invulnerable: false, staminaDelay: 0, kunai: KUNAI.capacity, kunaiRecoveryTicks: 0, damageDealt: 0, parries: 0, previousInput: { ...emptyInput(), aimX: id ? -1 : 1 } };
}
export function createState() {
  return { gameId: 'shinobi-showdown', tick: 0, phase: 'lobby', phaseTicks: 0, round: 1, maxRounds: 5, roundTicks: WORLD.roundSeconds * TICK_RATE, winner: null, stageId: 'rooftop', stageName: STAGES.rooftop.name, fighters: [fighter(0), fighter(1)], obstacles: STAGES.rooftop.covers.map(rect => ({ ...rect })), projectiles: [], projectileId: 0, events: [], eventId: 0, objective: 'First to two rounds. Commit your blade, read their parry, and conserve your dash.' };
}
function emit(state, type, data = {}) {
  state.events.push({ id: ++state.eventId, tick: state.tick, type, ...data });
  if (state.events.length > 48) state.events.splice(0, state.events.length - 48);
}
function prepareRound(state, countdown = TICK_RATE * 2) {
  const arena = STAGES[STAGE_ORDER[(state.round - 1) % STAGE_ORDER.length]];
  state.stageId = arena.id; state.stageName = arena.name; state.obstacles = arena.covers.map(rect => ({ ...rect }));
  state.fighters = state.fighters.map(f => fighter(f.id, f.wins));
  for (const f of state.fighters) {
    Object.assign(f, arena.spawns[f.id]);
    const other = arena.spawns[1 - f.id], angle = Math.atan2(other.y - f.y, other.x - f.x);
    f.facing = f.actionFacing = angle; f.aimX = Math.cos(angle); f.aimY = Math.sin(angle);
    f.previousInput.aimX = f.aimX; f.previousInput.aimY = f.aimY;
  }
  state.projectiles = []; state.phase = 'countdown'; state.phaseTicks = countdown; state.roundTicks = WORLD.roundSeconds * TICK_RATE; state.winner = null;
  state.objective = `${arena.name} · ${arena.description}`;
  emit(state, 'round', { round: state.round, stageId: arena.id, stageName: arena.name, x: 480, y: 320 });
}
export function startMatch(state) {
  const { tick, eventId } = state; Object.assign(state, createState(), { tick, eventId }); prepareRound(state, TICK_RATE * 3); return state;
}
export function resetLobby(state) {
  const { tick, eventId } = state; Object.assign(state, createState(), { tick, eventId }); return state;
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
function pathContact(a, b, radius) {
  let first = null;
  for (const ap of a) for (const bp of b) {
    const lo = Math.max(ap.t0, bp.t0), hi = Math.min(ap.t1, bp.t1);
    if (hi <= lo + EPS) continue;
    const aa = pointAt([ap], lo), ab = pointAt([ap], hi), ba = pointAt([bp], lo), bb = pointAt([bp], hi);
    const t = circleContact(aa.x - ba.x, aa.y - ba.y, ab.x - bb.x, ab.y - bb.y, radius);
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
function collideFighters(state, paths) {
  const [a, b] = state.fighters, time = pathContact(paths[0], paths[1], a.radius + b.radius);
  if (time === null) return;
  const pa = pointAt(paths[0], time), pb = pointAt(paths[1], time), endA = pointAt(paths[0], 1), endB = pointAt(paths[1], 1);
  // Bodies already touching can move away or slide along one another.
  if (time <= EPS && (endB.x - endA.x) * (pb.x - pa.x) + (endB.y - endA.y) * (pb.y - pa.y) >= (a.radius + b.radius) ** 2 - EPS) return;
  for (const f of state.fighters) { const result = stopAt(paths[f.id], time); paths[f.id] = result.path; f.x = result.point.x; f.y = result.point.y; }
}
function readInput(f, raw) {
  const input = emptyInput(); for (const key of INPUT_KEYS) input[key] = raw?.[key] === true;
  const x = Number.isFinite(raw?.aimX) ? clamp(raw.aimX, -1, 1) : f.aimX, y = Number.isFinite(raw?.aimY) ? clamp(raw.aimY, -1, 1) : f.aimY;
  const length = Math.hypot(x, y); if (length > .0001) { f.aimX = x / length; f.aimY = y / length; }
  input.aimX = f.aimX; input.aimY = f.aimY; f.facing = Math.atan2(f.aimY, f.aimX); return input;
}
function beginAction(state, f, action, cost) {
  f.stamina -= cost; f.staminaDelay = 60; f.action = action; f.actionFrame = 0; f.actionFacing = f.facing; f.attackHits = [];
  emit(state, action === 'light' || action === 'heavy' ? 'attack' : action === 'parry' ? 'parryStart' : action, { fighter: f.id, action, facing: f.actionFacing, x: f.x, y: f.y });
}
function busy(f) { return !['idle', 'run'].includes(f.action); }
function duration(f) { const move = MOVES[f.action]; return move ? move.startup + move.active + move.recovery : f.action === 'throw' ? KUNAI.startup + 1 + KUNAI.recovery : f.action === 'parry' ? PARRY.duration : f.action === 'dash' ? DASH.duration : f.action === 'stun' ? f.stunDuration || PARRY.stun : 0; }
function updateFighter(state, f, input) {
  f.invulnerable = false; if (f.staminaDelay > 0) f.staminaDelay--;
  if (busy(f)) { f.actionFrame++; if (f.actionFrame >= duration(f)) { f.action = 'idle'; f.actionFrame = 0; } }
  const rawX = Number(input.right) - Number(input.left), rawY = Number(input.down) - Number(input.up), length = Math.hypot(rawX, rawY), nx = length ? rawX / length : 0, ny = length ? rawY / length : 0;
  if (!busy(f)) {
    if (input.dash && !f.previousInput.dash && f.stamina >= DASH.cost) {
      beginAction(state, f, 'dash', DASH.cost); f.dashX = length ? nx : f.aimX; f.dashY = length ? ny : f.aimY;
    } else if (input.parry && !f.previousInput.parry && f.stamina >= PARRY.cost) beginAction(state, f, 'parry', PARRY.cost);
    else if (input.heavy && !f.previousInput.heavy && f.stamina >= MOVES.heavy.cost) beginAction(state, f, 'heavy', MOVES.heavy.cost);
    else if (input.attack && !f.previousInput.attack && f.stamina >= MOVES.light.cost) beginAction(state, f, 'light', MOVES.light.cost);
    else if (input.throw && !f.previousInput.throw && f.kunai > 0 && f.stamina >= 6) { beginAction(state, f, 'throw', 6); f.kunai--; }
    else f.action = length ? 'run' : 'idle';
  }
  let speed = 2.6;
  if (MOVES[f.action]) { const move = MOVES[f.action]; speed = f.actionFrame < move.startup ? .85 : f.actionFrame < move.startup + move.active ? .25 : 1.2; }
  if (f.action === 'throw') speed = 1.4;
  if (f.action === 'parry') speed = .75;
  if (f.action === 'stun') speed = 0;
  if (f.action === 'dash') {
    f.dashFrame = f.actionFrame; f.invulnerable = f.actionFrame >= DASH.startup && f.actionFrame <= DASH.invulnerableEnd;
    const dashSpeed = f.actionFrame < DASH.startup ? 3 : f.actionFrame >= 18 ? 3.8 : DASH.speed;
    f.vx = f.dashX * dashSpeed; f.vy = f.dashY * dashSpeed;
  } else { f.vx = nx * speed; f.vy = ny * speed; }
  if (!busy(f) && f.staminaDelay === 0) f.stamina = Math.min(100, f.stamina + .30);
  // Recover one tool every two seconds, but only while free to move. Throw spam has a real opening cost.
  if (f.kunai < KUNAI.capacity && !busy(f)) { f.kunaiRecoveryTicks++; if (f.kunaiRecoveryTicks >= KUNAI.recoverTicks) { f.kunai++; f.kunaiRecoveryTicks = 0; emit(state, 'recovered', { fighter: f.id, x: f.x, y: f.y }); } }
  f.previousInput = input; return moveFighter(state, f, f.vx, f.vy);
}
function parrying(f, fromX, fromY) {
  if (f.action !== 'parry' || f.actionFrame < PARRY.startup || f.actionFrame > PARRY.activeEnd) return false;
  const dx = fromX - f.x, dy = fromY - f.y, length = Math.hypot(dx, dy);
  return length < EPS || (dx * Math.cos(f.actionFacing) + dy * Math.sin(f.actionFacing)) / length >= Math.cos(PARRY.cone);
}
function hurt(state, source, target, damage, x, y, type) {
  const taken = Math.min(target.hp, damage); target.hp -= taken; source.damageDealt += taken;
  emit(state, 'hit', { fighter: source.id, target: target.id, damage: taken, x, y, attack: type });
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
    const move = MOVES[source.action], target = state.fighters[1 - source.id];
    if (!move || source.hp <= 0 || target.hp <= 0 || source.actionFrame < move.startup || source.actionFrame >= move.startup + move.active || source.attackHits.includes(target.id) || target.invulnerable) continue;
    const contact = bladeContact(state, source, target, move);
    if (!contact) continue;
    contacts.push({ source, target, move, ...contact, parried: parrying(target, source.x, source.y), action: source.action });
  }
  // Evaluate both committed strikes before applying damage so equal-tick trades are symmetric.
  for (const hit of contacts) {
    const { source, target, move, x, y, parried, action } = hit; source.attackHits.push(target.id);
    if (parried) {
      source.action = 'stun'; source.actionFrame = 0; source.stunDuration = PARRY.stun; source.vx = source.vy = 0; target.parries++; target.stamina = Math.min(100, target.stamina + 10);
      emit(state, 'parry', { fighter: target.id, target: source.id, x, y, facing: target.actionFacing });
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
    const opponent = state.fighters[1 - shot.owner];
    if (!opponent.invulnerable) {
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
      if (shot.reflections < 2 && parrying({ ...target, x: point.x, y: point.y }, x - shot.vx, y - shot.vy)) {
        shot.owner = target.id; shot.vx = -shot.vx; shot.vy = -shot.vy; shot.x = x; shot.y = y; shot.bornTick = state.tick; shot.reflections++;
        target.parries++; target.stamina = Math.min(100, target.stamina + 8);
        emit(state, 'deflect', { fighter: target.id, x, y, facing: target.actionFacing }); kept.push(shot);
      } else hurt(state, state.fighters[shot.owner], target, shot.damage, x, y, 'kunai');
      continue;
    }
    shot.x = bx; shot.y = by;
    if (shot.life > 0 && bx >= WORLD.wall && bx <= WORLD.width - WORLD.wall && by >= WORLD.wall && by <= WORLD.height - WORLD.wall) kept.push(shot);
  }
  state.projectiles = kept;
}
function finishRound(state, winner, reason) {
  state.phase = 'roundEnd'; state.phaseTicks = TICK_RATE * 2; state.winner = winner;
  if (winner !== null) state.fighters[winner].wins++;
  state.projectiles = [];
  for (const f of state.fighters) { f.vx = f.vy = 0; f.invulnerable = false; f.action = f.hp <= 0 ? 'dead' : 'idle'; f.actionFrame = 0; }
  emit(state, 'roundEnd', { winner, reason, x: 480, y: 320 });
}
export function step(state, inputs = []) {
  state.tick++;
  if (state.phase === 'lobby' || state.phase === 'matchEnd') return state;
  if (state.phase === 'countdown') {
    for (const f of state.fighters) f.previousInput = readInput(f, inputs[f.id]);
    if (--state.phaseTicks <= 0) { state.phase = 'fight'; state.phaseTicks = 0; emit(state, 'fight', { round: state.round }); }
    return state;
  }
  if (state.phase === 'roundEnd') {
    if (--state.phaseTicks <= 0) {
      const winner = state.fighters.find(f => f.wins >= 2);
      if (winner || state.round >= state.maxRounds) {
        state.phase = 'matchEnd'; const [a, b] = state.fighters; state.winner = winner?.id ?? (a.wins === b.wins ? null : a.wins > b.wins ? 0 : 1); emit(state, 'matchEnd', { winner: state.winner });
      } else { state.round++; prepareRound(state); }
    }
    return state;
  }
  const paths = state.fighters.map(f => updateFighter(state, f, readInput(f, inputs[f.id])));
  collideFighters(state, paths);
  // Existing tools advance against the actual piecewise fighter path. New tools are born after movement.
  projectiles(state, paths); melee(state);
  for (const f of state.fighters) if (f.hp > 0 && f.action === 'throw' && f.actionFrame === KUNAI.startup) throwKunai(state, f);
  state.roundTicks--;
  const [a, b] = state.fighters;
  if (a.hp <= 0 || b.hp <= 0) finishRound(state, a.hp <= 0 && b.hp <= 0 ? null : a.hp > 0 ? 0 : 1, 'knockout');
  else if (state.roundTicks <= 0) finishRound(state, a.hp === b.hp ? null : a.hp > b.hp ? 0 : 1, 'timeout');
  return state;
}
