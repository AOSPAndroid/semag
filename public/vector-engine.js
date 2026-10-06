/** Deterministic 120 Hz arena shooting, shared by the host and prediction client. */
export const TICK_RATE = 120;
export const WORLD = Object.freeze({ width: 960, height: 640, wall: 32, minX: 48, maxX: 912, minY: 48, maxY: 592, fighterRadius: 16, roundSeconds: 90 });
export const INPUT_KEYS = Object.freeze(['up', 'down', 'left', 'right', 'fire', 'dash', 'reload', 'focus']);
export const COVERS = Object.freeze([
  Object.freeze({ id: 'north-west', x: 248, y: 136, w: 88, h: 112 }),
  Object.freeze({ id: 'north-east', x: 624, y: 136, w: 88, h: 112 }),
  Object.freeze({ id: 'south-west', x: 248, y: 392, w: 88, h: 112 }),
  Object.freeze({ id: 'south-east', x: 624, y: 392, w: 88, h: 112 }),
  Object.freeze({ id: 'north-center', x: 424, y: 88, w: 112, h: 48 }),
  Object.freeze({ id: 'south-center', x: 424, y: 504, w: 112, h: 48 }),
]);
export const WEAPON = Object.freeze({ magazine: 6, damage: 18, shotTicks: 20, reloadTicks: 132, projectileSpeed: 8.8, focusSpeed: 10.2 });
export const DASH = Object.freeze({ duration: 28, cost: 28, speed: 9.3, invulnerableStart: 4, invulnerableEnd: 15 });
export const emptyInput = () => ({ ...Object.fromEntries(INPUT_KEYS.map(key => [key, false])), aimX: 1, aimY: 0 });
export const cloneState = state => JSON.parse(JSON.stringify(state));
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const RECOIL = Object.freeze([-.024, .012, .03, -.012, -.03, .024]);

function fighter(id, wins = 0) {
  return {
    id, x: id === 0 ? 154 : 806, y: 320, vx: 0, vy: 0, radius: WORLD.fighterRadius,
    hp: 100, maxHp: 100, stamina: 100, wins, aimX: id === 0 ? 1 : -1, aimY: 0,
    facing: id === 0 ? 0 : Math.PI, ammo: WEAPON.magazine, reloadTicks: 0, reloadDuration: WEAPON.reloadTicks,
    shotCooldown: 0, dashTicks: 0, dashFrame: 0, dashX: 1, dashY: 0,
    staminaDelay: 0, invulnerable: false, action: 'idle', actionFrame: 0,
    shotsFired: 0, previousInput: { ...emptyInput(), aimX: id === 0 ? 1 : -1 },
  };
}

export function createState() {
  return {
    gameId: 'vector-arena', tick: 0, phase: 'lobby', phaseTicks: 0, round: 1,
    roundTicks: WORLD.roundSeconds * TICK_RATE, winner: null,
    fighters: [fighter(0), fighter(1)], obstacles: COVERS.map(cover => ({ ...cover })),
    projectiles: [], events: [], eventId: 0, projectileId: 0,
    objective: 'First to win two rounds. Aim, strafe, and make every magazine count.',
  };
}

function emit(state, type, data = {}) {
  state.events.push({ id: ++state.eventId, tick: state.tick, type, ...data });
  if (state.events.length > 48) state.events.splice(0, state.events.length - 48);
}

function prepareRound(state, countdown = TICK_RATE * 2) {
  state.fighters = state.fighters.map(f => fighter(f.id, f.wins));
  state.projectiles = [];
  state.phase = 'countdown'; state.phaseTicks = countdown;
  state.roundTicks = WORLD.roundSeconds * TICK_RATE; state.winner = null;
  emit(state, 'round', { round: state.round, x: 480, y: 320 });
}

export function startMatch(state) {
  const tick = state.tick, eventId = state.eventId;
  Object.assign(state, createState(), { tick, eventId });
  prepareRound(state, TICK_RATE * 3);
  return state;
}

export function resetLobby(state) {
  const tick = state.tick, eventId = state.eventId;
  Object.assign(state, createState(), { tick, eventId });
  return state;
}

// First contact of a segment with an expanded rectangle, including the start point.
function rectContact(ax, ay, bx, by, rect, padding = 0) {
  let low = 0, high = 1;
  for (const [origin, delta, min, max] of [
    [ax, bx - ax, rect.x - padding, rect.x + rect.w + padding],
    [ay, by - ay, rect.y - padding, rect.y + rect.h + padding],
  ]) {
    if (Math.abs(delta) < 1e-9) {
      if (origin < min || origin > max) return null;
    } else {
      let first = (min - origin) / delta, last = (max - origin) / delta;
      if (first > last) [first, last] = [last, first];
      low = Math.max(low, first); high = Math.min(high, last);
      if (low > high) return null;
    }
  }
  return high < 0 || low > 1 ? null : low;
}

// Relative motion detects a fast bullet even when the target crosses its path.
function circleContact(ax, ay, bx, by, radius) {
  const dx = bx - ax, dy = by - ay;
  const c = ax * ax + ay * ay - radius * radius;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy;
  if (a < 1e-12) return null;
  const b = 2 * (ax * dx + ay * dy);
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const t = (-b - Math.sqrt(discriminant)) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}

function moveFighter(state, f, dx, dy) {
  let x = clamp(f.x + dx, WORLD.minX, WORLD.maxX);
  for (const cover of state.obstacles) {
    if (f.y <= cover.y - f.radius || f.y >= cover.y + cover.h + f.radius) continue;
    if (dx > 0 && f.x <= cover.x - f.radius && x > cover.x - f.radius) x = Math.min(x, cover.x - f.radius);
    if (dx < 0 && f.x >= cover.x + cover.w + f.radius && x < cover.x + cover.w + f.radius) x = Math.max(x, cover.x + cover.w + f.radius);
  }
  f.x = x;
  let y = clamp(f.y + dy, WORLD.minY, WORLD.maxY);
  for (const cover of state.obstacles) {
    if (f.x <= cover.x - f.radius || f.x >= cover.x + cover.w + f.radius) continue;
    if (dy > 0 && f.y <= cover.y - f.radius && y > cover.y - f.radius) y = Math.min(y, cover.y - f.radius);
    if (dy < 0 && f.y >= cover.y + cover.h + f.radius && y < cover.y + cover.h + f.radius) y = Math.max(y, cover.y + cover.h + f.radius);
  }
  f.y = y;
}

function separateFighters(state) {
  const [a, b] = state.fighters;
  const dx = b.x - a.x, dy = b.y - a.y;
  const length = Math.hypot(dx, dy), overlap = a.radius + b.radius - length;
  if (overlap <= 0) return;
  const nx = length > 1e-9 ? dx / length : 1, ny = length > 1e-9 ? dy / length : 0;
  const ax = a.x, ay = a.y;
  moveFighter(state, a, -nx * overlap / 2, -ny * overlap / 2);
  moveFighter(state, b, nx * (overlap - Math.hypot(a.x - ax, a.y - ay)), ny * (overlap - Math.hypot(a.x - ax, a.y - ay)));
  const remaining = a.radius + b.radius - Math.hypot(b.x - a.x, b.y - a.y);
  if (remaining > 1e-7) moveFighter(state, a, -nx * remaining, -ny * remaining);
}

function readInput(f, raw) {
  const input = emptyInput();
  for (const key of INPUT_KEYS) input[key] = raw?.[key] === true;
  const x = Number.isFinite(raw?.aimX) ? clamp(raw.aimX, -1, 1) : f.aimX;
  const y = Number.isFinite(raw?.aimY) ? clamp(raw.aimY, -1, 1) : f.aimY;
  const length = Math.hypot(x, y);
  if (length > .0001) { f.aimX = x / length; f.aimY = y / length; }
  input.aimX = f.aimX; input.aimY = f.aimY;
  f.facing = Math.atan2(f.aimY, f.aimX);
  return input;
}

function beginReload(state, f) {
  if (f.ammo === WEAPON.magazine || f.reloadTicks > 0 || f.dashTicks > 0) return;
  f.reloadTicks = WEAPON.reloadTicks;
  emit(state, 'reload', { fighter: f.id, x: f.x, y: f.y });
}

function fire(state, f, input) {
  f.ammo -= 1; f.shotCooldown = WEAPON.shotTicks;
  const recoil = input.focus ? 0 : RECOIL[f.shotsFired % RECOIL.length];
  f.shotsFired += 1;
  const angle = f.facing + recoil, nx = Math.cos(angle), ny = Math.sin(angle);
  const speed = input.focus ? WEAPON.focusSpeed : WEAPON.projectileSpeed;
  const x = f.x + nx * (f.radius + 5), y = f.y + ny * (f.radius + 5);
  emit(state, 'fire', { fighter: f.id, x, y, facing: angle, focus: input.focus });
  // A muzzle at the edge of cover must never produce a bullet on its far side.
  let nearest = null;
  for (const rect of state.obstacles) {
    const t = rectContact(f.x, f.y, x, y, rect, 3);
    if (t !== null && (nearest === null || t < nearest)) nearest = t;
  }
  if (nearest !== null) {
    emit(state, 'cover', { fighter: f.id, x: f.x + (x - f.x) * nearest, y: f.y + (y - f.y) * nearest });
    return;
  }
  if (state.projectiles.length >= 32) return;
  state.projectiles.push({ id: ++state.projectileId, owner: f.id, x, y, px: x, py: y, vx: nx * speed, vy: ny * speed, radius: 3, damage: WEAPON.damage, life: 100, bornTick: state.tick });
}

function updateFighter(state, f, input) {
  f.invulnerable = false;
  f.actionFrame += 1;
  if (f.shotCooldown > 0) f.shotCooldown -= 1;
  if (f.staminaDelay > 0) f.staminaDelay -= 1;
  if (f.reloadTicks > 0) {
    f.reloadTicks -= 1;
    if (f.reloadTicks === 0) { f.ammo = WEAPON.magazine; emit(state, 'reloaded', { fighter: f.id, x: f.x, y: f.y }); }
  }
  const rawX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const rawY = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const length = Math.hypot(rawX, rawY), nx = length ? rawX / length : 0, ny = length ? rawY / length : 0;
  if (input.dash && !f.previousInput.dash && f.dashTicks === 0 && f.stamina >= DASH.cost) {
    f.dashTicks = DASH.duration; f.dashFrame = 0;
    f.dashX = length ? nx : f.aimX; f.dashY = length ? ny : f.aimY;
    f.stamina -= DASH.cost; f.staminaDelay = 72;
    f.reloadTicks = 0;
    emit(state, 'dash', { fighter: f.id, x: f.x, y: f.y, facing: Math.atan2(f.dashY, f.dashX) });
  }
  if (f.dashTicks > 0) {
    f.action = 'dash';
    f.invulnerable = f.dashFrame >= DASH.invulnerableStart && f.dashFrame <= DASH.invulnerableEnd;
    const speed = f.dashFrame < DASH.invulnerableStart ? 3.3 : f.dashFrame >= 20 ? 4.2 : DASH.speed;
    f.vx = f.dashX * speed; f.vy = f.dashY * speed;
    f.dashFrame += 1; f.dashTicks -= 1;
  } else {
    const speed = input.focus ? 1.65 : input.fire ? 2.65 : 3.25;
    f.vx += (nx * speed - f.vx) * .42; f.vy += (ny * speed - f.vy) * .42;
    if ((input.reload && !f.previousInput.reload) || (f.ammo === 0 && f.shotCooldown === 0)) beginReload(state, f);
    if (input.fire && f.ammo > 0 && f.reloadTicks === 0 && f.shotCooldown === 0) fire(state, f, input);
    f.action = f.reloadTicks > 0 ? 'reload' : f.shotCooldown > WEAPON.shotTicks - 6 ? 'shoot' : input.focus ? 'focus' : length ? 'run' : 'idle';
  }
  if (f.staminaDelay === 0 && f.dashTicks === 0) f.stamina = Math.min(100, f.stamina + .25);
  moveFighter(state, f, f.vx, f.vy);
  f.previousInput = input;
}

function updateProjectiles(state, previousPositions) {
  const remaining = [];
  for (const bullet of state.projectiles) {
    const ax = bullet.x, ay = bullet.y, bx = ax + bullet.vx, by = ay + bullet.vy;
    let first = null, target = null;
    for (const cover of state.obstacles) {
      const t = rectContact(ax, ay, bx, by, cover, bullet.radius);
      if (t !== null && (first === null || t < first)) { first = t; target = null; }
    }
    const opponent = state.fighters[1 - bullet.owner];
    if (!opponent.invulnerable) {
      const old = bullet.bornTick === state.tick ? opponent : previousPositions[opponent.id];
      const t = circleContact(ax - old.x, ay - old.y, bx - opponent.x, by - opponent.y, opponent.radius + bullet.radius);
      if (t !== null && (first === null || t < first - 1e-8)) { first = t; target = opponent; }
    }
    bullet.px = ax; bullet.py = ay; bullet.life -= 1;
    if (first !== null) {
      const x = ax + (bx - ax) * first, y = ay + (by - ay) * first;
      if (target) {
        target.hp = Math.max(0, target.hp - bullet.damage);
        emit(state, 'hit', { fighter: bullet.owner, target: target.id, damage: bullet.damage, x, y });
      } else emit(state, 'cover', { fighter: bullet.owner, x, y });
      continue;
    }
    bullet.x = bx; bullet.y = by;
    if (bullet.life > 0 && bx >= WORLD.wall && bx <= WORLD.width - WORLD.wall && by >= WORLD.wall && by <= WORLD.height - WORLD.wall) remaining.push(bullet);
  }
  state.projectiles = remaining;
}

function finishRound(state, winner, reason) {
  state.phase = 'roundEnd'; state.phaseTicks = TICK_RATE * 2;
  state.winner = winner;
  if (winner !== null) state.fighters[winner].wins += 1;
  state.projectiles = [];
  for (const f of state.fighters) {
    f.vx = 0; f.vy = 0; f.invulnerable = false;
    f.dashTicks = 0; f.reloadTicks = 0;
    f.action = f.hp <= 0 ? 'dead' : 'idle';
  }
  emit(state, 'roundEnd', { winner, reason, x: 480, y: 320 });
}

export function step(state, inputs = []) {
  state.tick += 1;
  if (state.phase === 'lobby' || state.phase === 'matchEnd') return state;
  if (state.phase === 'countdown') {
    for (const f of state.fighters) f.previousInput = readInput(f, inputs[f.id]);
    state.phaseTicks -= 1;
    if (state.phaseTicks <= 0) { state.phase = 'fight'; state.phaseTicks = 0; emit(state, 'fight', { round: state.round }); }
    return state;
  }
  if (state.phase === 'roundEnd') {
    state.phaseTicks -= 1;
    if (state.phaseTicks <= 0) {
      const winner = state.fighters.find(f => f.wins >= 2);
      if (winner) { state.phase = 'matchEnd'; state.winner = winner.id; emit(state, 'matchEnd', { winner: winner.id }); }
      else { state.round += 1; prepareRound(state); }
    }
    return state;
  }
  const previousPositions = state.fighters.map(f => ({ x: f.x, y: f.y }));
  for (const f of state.fighters) updateFighter(state, f, readInput(f, inputs[f.id]));
  separateFighters(state);
  updateProjectiles(state, previousPositions);
  state.roundTicks -= 1;
  const [a, b] = state.fighters;
  if (a.hp <= 0 || b.hp <= 0) finishRound(state, a.hp <= 0 && b.hp <= 0 ? null : a.hp > 0 ? 0 : 1, 'knockout');
  else if (state.roundTicks <= 0) finishRound(state, a.hp === b.hp ? null : a.hp > b.hp ? 0 : 1, 'timeout');
  return state;
}
