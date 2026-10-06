/** Shared, deterministic 120 Hz combat for Relic Duel and Dungeon Run. */
export const TICK_RATE = 120;
export const INPUT_KEYS = Object.freeze(['left', 'right', 'up', 'down', 'attack', 'roll', 'shoot', 'block']);
export const emptyInput = () => Object.fromEntries(INPUT_KEYS.map(key => [key, false]));
export const cloneState = state => JSON.parse(JSON.stringify(state));
export const ARENA = Object.freeze({ width: 960, height: 640, wall: 36, minX: 54, maxX: 906, minY: 70, maxY: 570, fighterRadius: 15, roundSeconds: 90 });
export const MOVES = Object.freeze({
  sword: Object.freeze({ startup: 9, active: 10, total: 38, reach: 72, damage: 13, stamina: 10, hitstun: 24, blockstun: 10, guardDamage: 18 }),
  shoot: Object.freeze({ startup: 10, total: 38, speed: 8.5, damage: 11, stamina: 14 }),
  roll: Object.freeze({ total: 30, speed: 6.8, invulnerableStart: 4, invulnerableEnd: 20, stamina: 26 }),
});
const PILLARS = Object.freeze([
  { id: 'p0', type: 'pillar', x: 285, y: 186, w: 54, h: 76 },
  { id: 'p1', type: 'pillar', x: 621, y: 186, w: 54, h: 76 },
  { id: 'p2', type: 'pillar', x: 285, y: 378, w: 54, h: 76 },
  { id: 'p3', type: 'pillar', x: 621, y: 378, w: 54, h: 76 },
]);
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const angleTo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
const angleDifference = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const playerTeam = (state, id) => state.mode === 'coop' ? 'heroes' : `p${id}`;
const alive = entity => entity.hp > 0 && !entity.downed;

function fighter(id, mode, wins = 0) {
  return {
    id, x: mode === 'coop' ? (id === 0 ? 420 : 540) : (id === 0 ? 230 : 730),
    y: mode === 'coop' ? 514 : 320, vx: 0, vy: 0, radius: ARENA.fighterRadius,
    facing: mode === 'coop' ? -Math.PI / 2 : id === 0 ? 0 : Math.PI,
    hp: 100, maxHp: 100, stamina: 100, guard: 100, wins,
    action: 'idle', actionFrame: 0, actionDuration: 0, attackKind: 'sword', attackFacing: 0,
    attackId: 0, hitTargets: [], landed: false, stun: 0, invulnerable: false,
    guardBroken: 0, blockPressTick: -1000, staminaDelay: 0,
    rollFacing: 0, downed: false, reviveProgress: 0, reviveShield: 0,
    previousInput: emptyInput(), buffers: { attack: 0, roll: 0, shoot: 0 },
  };
}

export function createState(mode = 'duel') {
  if (typeof mode === 'object') mode = mode?.mode;
  mode = mode === 'coop' ? 'coop' : 'duel';
  return {
    mode, tick: 0, phase: 'lobby', phaseTicks: 0, round: 1,
    roundTicks: ARENA.roundSeconds * TICK_RATE, winner: null, result: null,
    fighters: [fighter(0, mode), fighter(1, mode)], obstacles: PILLARS.map(p => ({ ...p })),
    enemies: [], projectiles: [], events: [], eventId: 0, projectileId: 0, enemyId: 100,
    wave: 0, maxWaves: 4, waveDelay: 0, elapsedTicks: 0,
    objective: mode === 'coop' ? 'Ready together. Clear the ruins and defeat the Warden.' : 'First to win two rounds.',
  };
}

function emit(state, type, data = {}) {
  state.events.push({ id: ++state.eventId, tick: state.tick, type, ...data });
  if (state.events.length > 64) state.events.splice(0, state.events.length - 64);
}

function prepareRound(state, countdown = TICK_RATE * 2) {
  state.fighters = state.fighters.map(f => fighter(f.id, state.mode, f.wins));
  state.projectiles = [];
  state.phase = 'countdown'; state.phaseTicks = countdown;
  state.roundTicks = ARENA.roundSeconds * TICK_RATE;
  state.winner = null;
  emit(state, 'round', { round: state.round, x: 480, y: 320 });
}

export function startMatch(state) {
  const next = createState(state.mode);
  const tick = state.tick, eventId = state.eventId;
  Object.assign(state, next, { tick, eventId });
  prepareRound(state, TICK_RATE * 3);
  return state;
}

export function resetLobby(state) {
  const tick = state.tick, eventId = state.eventId, mode = state.mode;
  Object.assign(state, createState(mode), { tick, eventId });
  return state;
}

// Segment/rectangle clipping is shared by arrow cover, sword cover and AI.
function intersectsRect(a, b, rect, padding = 0) {
  const minX = rect.x - padding, maxX = rect.x + rect.w + padding;
  const minY = rect.y - padding, maxY = rect.y + rect.h + padding;
  let low = 0, high = 1;
  for (const [origin, delta, min, max] of [[a.x, b.x - a.x, minX, maxX], [a.y, b.y - a.y, minY, maxY]]) {
    if (Math.abs(delta) < 0.000001) {
      if (origin < min || origin > max) return false;
    } else {
      let first = (min - origin) / delta, last = (max - origin) / delta;
      if (first > last) [first, last] = [last, first];
      low = Math.max(low, first); high = Math.min(high, last);
      if (low > high) return false;
    }
  }
  return high >= 0 && low <= 1;
}
const clearLine = (state, a, b, padding = 0) => !state.obstacles.some(rect => intersectsRect(a, b, rect, padding));

function resolveWalls(state, entity) {
  const radius = entity.radius ?? ARENA.fighterRadius;
  // Centers use fighter bounds; larger creatures keep the same outer wall line.
  entity.x = clamp(entity.x, ARENA.minX + radius - ARENA.fighterRadius, ARENA.maxX - radius + ARENA.fighterRadius);
  entity.y = clamp(entity.y, ARENA.minY + radius - ARENA.fighterRadius, ARENA.maxY - radius + ARENA.fighterRadius);
  for (const rect of state.obstacles) {
    const nearestX = clamp(entity.x, rect.x, rect.x + rect.w);
    const nearestY = clamp(entity.y, rect.y, rect.y + rect.h);
    const dx = entity.x - nearestX, dy = entity.y - nearestY;
    const length = Math.hypot(dx, dy);
    if (length >= radius) continue;
    if (length > 0.00001) {
      entity.x += dx / length * (radius - length);
      entity.y += dy / length * (radius - length);
    } else {
      const options = [
        { d: Math.abs(entity.x - rect.x), x: rect.x - radius, y: entity.y },
        { d: Math.abs(entity.x - rect.x - rect.w), x: rect.x + rect.w + radius, y: entity.y },
        { d: Math.abs(entity.y - rect.y), x: entity.x, y: rect.y - radius },
        { d: Math.abs(entity.y - rect.y - rect.h), x: entity.x, y: rect.y + rect.h + radius },
      ].sort((a, b) => a.d - b.d);
      entity.x = options[0].x; entity.y = options[0].y;
    }
  }
}

function moveEntity(state, entity) {
  entity.x += entity.vx;
  resolveWalls(state, entity);
  entity.y += entity.vy;
  resolveWalls(state, entity);
}

function separate(state, a, b) {
  if (!alive(a) || !alive(b) || a.action === 'roll' || b.action === 'roll') return;
  const dx = b.x - a.x, dy = b.y - a.y, gap = Math.hypot(dx, dy);
  const minimum = a.radius + b.radius;
  if (gap >= minimum) return;
  const nx = gap > 0.00001 ? dx / gap : a.id < b.id ? 1 : -1;
  const ny = gap > 0.00001 ? dy / gap : 0;
  const amount = (minimum - gap) / 2;
  a.x -= nx * amount; a.y -= ny * amount;
  b.x += nx * amount; b.y += ny * amount;
  resolveWalls(state, a); resolveWalls(state, b);
}

function recordInput(state, f, raw) {
  const input = emptyInput();
  for (const key of INPUT_KEYS) input[key] = raw?.[key] === true;
  if (input.block && !f.previousInput.block) f.blockPressTick = state.tick;
  for (const key of Object.keys(f.buffers)) {
    if (f.buffers[key] > 0) f.buffers[key] -= 1;
    if (state.phase === 'fight' && input[key] && !f.previousInput[key]) f.buffers[key] = 10;
  }
  f.previousInput = input;
  return input;
}

function beginRoll(state, f) {
  if (f.stamina < MOVES.roll.stamina) return false;
  f.buffers.roll = 0;
  f.stamina -= MOVES.roll.stamina; f.staminaDelay = 48;
  f.rollFacing = f.facing; f.action = 'roll'; f.actionFrame = 0; f.actionDuration = MOVES.roll.total;
  f.invulnerable = false;
  emit(state, 'roll', { fighter: f.id, x: f.x, y: f.y, angle: f.rollFacing });
  return true;
}

function beginAttack(state, f, kind) {
  const move = MOVES[kind];
  if (f.stamina < move.stamina) return false;
  f.buffers[kind === 'sword' ? 'attack' : 'shoot'] = 0;
  f.stamina -= move.stamina; f.staminaDelay = 38;
  f.action = 'attack'; f.attackKind = kind; f.actionFrame = 0; f.actionDuration = move.total;
  f.attackFacing = f.facing; f.attackId += 1; f.hitTargets = []; f.landed = false; f.shotFired = false;
  emit(state, kind === 'sword' ? 'swing' : 'draw', { fighter: f.id, x: f.x, y: f.y, angle: f.facing, move: kind });
  return true;
}

function spawnProjectile(state, owner, angle, { kind = 'arrow', damage = MOVES.shoot.damage, speed = MOVES.shoot.speed, team } = {}) {
  const radius = kind === 'orb' ? 7 : 5;
  const offset = owner.radius + radius + 3;
  const projectile = {
    id: ++state.projectileId, owner: owner.id,
    team: team ?? playerTeam(state, owner.id), kind,
    x: owner.x + Math.cos(angle) * offset, y: owner.y + Math.sin(angle) * offset,
    vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
    angle, facing: angle, radius, damage, life: kind === 'orb' ? 210 : 140, reflected: false,
  };
  state.projectiles.push(projectile);
  emit(state, 'shoot', { fighter: owner.id, x: projectile.x, y: projectile.y, angle, move: kind });
}

function updateFighter(state, f, input) {
  f.invulnerable = false;
  if (!alive(f)) { f.vx = 0; f.vy = 0; f.action = 'dead'; f.actionFrame += 1; return; }
  if (f.guardBroken > 0) f.guardBroken -= 1;
  if (f.staminaDelay > 0) f.staminaDelay -= 1;
  if (f.reviveShield > 0) { f.reviveShield -= 1; f.invulnerable = true; }
  let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const length = Math.hypot(dx, dy);
  if (length) { dx /= length; dy /= length; }
  if (length && f.stun <= 0 && f.action !== 'attack' && f.action !== 'roll') f.facing = Math.atan2(dy, dx);

  if (f.stun > 0) {
    f.stun -= 1; f.actionFrame += 1; f.vx *= 0.82; f.vy *= 0.82;
    if (f.stun === 0) { f.action = input.block && !f.guardBroken ? 'block' : 'idle'; f.actionFrame = 0; }
  } else if (f.action === 'roll') {
    f.actionFrame += 1;
    f.invulnerable ||= f.actionFrame >= MOVES.roll.invulnerableStart && f.actionFrame <= MOVES.roll.invulnerableEnd;
    const speed = MOVES.roll.speed * (f.actionFrame > 22 ? 0.5 : 1);
    f.vx = Math.cos(f.rollFacing) * speed; f.vy = Math.sin(f.rollFacing) * speed;
    if (f.actionFrame >= MOVES.roll.total) { f.action = 'idle'; f.actionFrame = 0; f.vx *= 0.2; f.vy *= 0.2; }
  } else if (f.action === 'attack') {
    f.actionFrame += 1;
    f.vx *= 0.79; f.vy *= 0.79;
    if (f.attackKind === 'shoot' && !f.shotFired && f.actionFrame >= MOVES.shoot.startup) {
      f.shotFired = true;
      spawnProjectile(state, f, f.attackFacing);
    }
    if (f.attackKind === 'sword' && f.landed && f.actionFrame >= 22 && f.buffers.roll > 0) {
      if (length) f.facing = Math.atan2(dy, dx);
      beginRoll(state, f);
    } else if (f.actionFrame >= MOVES[f.attackKind].total) { f.action = 'idle'; f.actionFrame = 0; }
  } else if (input.block && !f.guardBroken) {
    if (f.action !== 'block') { f.action = 'block'; f.actionFrame = 0; }
    f.actionFrame += 1;
    f.vx = dx * 0.85; f.vy = dy * 0.85;
    f.buffers.attack = 0; f.buffers.shoot = 0;
    if (f.buffers.roll > 0) beginRoll(state, f);
  } else {
    f.action = length ? 'run' : 'idle'; f.actionFrame += 1;
    f.vx += (dx * 2.65 - f.vx) * 0.42;
    f.vy += (dy * 2.65 - f.vy) * 0.42;
    if (f.buffers.roll > 0 && beginRoll(state, f)) {
      f.vx = Math.cos(f.rollFacing) * MOVES.roll.speed; f.vy = Math.sin(f.rollFacing) * MOVES.roll.speed;
    } else if (f.buffers.attack > 0) beginAttack(state, f, 'sword');
    else if (f.buffers.shoot > 0) beginAttack(state, f, 'shoot');
  }
  if (!f.staminaDelay && f.action !== 'attack' && f.action !== 'roll' && f.action !== 'block' && !f.stun) f.stamina = Math.min(100, f.stamina + 0.4);
  f.guard = f.stamina;
  moveEntity(state, f);
}

function damageEntity(state, target, source, damage, { guardDamage = 18, knockback = 3.4, hitstun = 24, move = 'sword', projectile = false, parryable = true } = {}) {
  if (!alive(target) || target.invulnerable) return 'evade';
  const angle = angleTo(target, source);
  const guarded = (target.action === 'block' && !target.guardBroken) || target.guarded;
  const blocked = guarded && Math.abs(angleDifference(angle, target.facing)) < 1.08;
  if (blocked && parryable && target.id < 2 && state.tick - target.blockPressTick < 7) {
    target.stamina = Math.min(100, target.stamina + 12); target.guard = target.stamina;
    if (!projectile && source.hp > 0) {
      source.stun = 38; source.action = 'hit'; source.actionFrame = 0;
      source.vx = Math.cos(angle) * 2.2; source.vy = Math.sin(angle) * 2.2;
    }
    emit(state, 'parry', { fighter: target.id, target: source.id, x: target.x, y: target.y, move, angle });
    return 'parry';
  }
  if (blocked) {
    target.stamina = Math.max(0, target.stamina - guardDamage); target.guard = target.stamina;
    target.staminaDelay = 65;
    if (target.stamina <= 0) {
      target.guardBroken = 115; target.guarded = false; target.action = 'hit'; target.stun = 70; target.actionFrame = 0;
      emit(state, 'guardbreak', { fighter: source.id, target: target.id, x: target.x, y: target.y, move });
    } else {
      if (target.id < 2) target.stun = 10;
      else { target.stun = 8; target.action = 'hit'; target.actionFrame = 0; }
      emit(state, 'block', { fighter: source.id, target: target.id, x: target.x, y: target.y, move });
    }
    const away = angle + Math.PI;
    target.vx = Math.cos(away) * knockback * 0.35; target.vy = Math.sin(away) * knockback * 0.35;
    return 'block';
  }
  const armored = target.type === 'boss';
  target.hp = Math.max(0, target.hp - damage);
  // The Warden resists ordinary stagger; a timed parry still staggers its sword.
  // Otherwise staggered arrows could trap it outside attack range indefinitely,
  // and two swords could prevent every windup from reaching its active frames.
  if (!armored || target.hp === 0) {
    target.stun = hitstun; target.action = target.hp === 0 ? 'dead' : 'hit'; target.actionFrame = 0;
  }
  target.guarded = false;
  const away = angle + Math.PI;
  if (!armored) { target.vx = Math.cos(away) * knockback; target.vy = Math.sin(away) * knockback; }
  emit(state, 'hit', { fighter: source.id, source: source.id, target: target.id, damage, x: target.x, y: target.y, move, angle: away });
  if (target.hp === 0) {
    target.stun = 0; target.vx = 0; target.vy = 0;
    if (target.id < 2 && state.mode === 'coop') {
      target.downed = true; target.reviveProgress = 0;
      emit(state, 'down', { fighter: target.id, x: target.x, y: target.y });
    } else if (target.id >= 100) emit(state, 'enemyDeath', { fighter: target.id, enemyType: target.type, x: target.x, y: target.y });
  }
  return 'hit';
}

function swordConnects(state, source, target, reach, facing, width = 1.17) {
  const gap = distance(source, target);
  return alive(target) && !target.invulnerable && gap <= reach + target.radius &&
    (gap < source.radius + target.radius || Math.abs(angleDifference(angleTo(source, target), facing)) <= width) &&
    clearLine(state, source, target, 2);
}

function resolveSwords(state) {
  // Capture simultaneous contacts before resolution so duel attacks can trade.
  const contacts = [];
  for (const f of state.fighters) {
    if (!alive(f) || f.action !== 'attack' || f.attackKind !== 'sword' || f.actionFrame < MOVES.sword.startup || f.actionFrame >= MOVES.sword.startup + MOVES.sword.active) continue;
    const targets = state.mode === 'coop' ? state.enemies : state.fighters.filter(other => other.id !== f.id);
    for (const target of targets) {
      if (f.hitTargets.includes(target.id) || !swordConnects(state, f, target, MOVES.sword.reach, f.attackFacing)) continue;
      contacts.push({ source: f, target });
    }
  }
  for (const { source, target } of contacts) {
    source.hitTargets.push(target.id);
    const result = damageEntity(state, target, source, MOVES.sword.damage, { guardDamage: MOVES.sword.guardDamage });
    if (result === 'hit' || result === 'block') source.landed = true;
  }
}

function projectileContact(a, b, target, radius) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared ? clamp(((target.x - a.x) * dx + (target.y - a.y) * dy) / lengthSquared, 0, 1) : 0;
  return Math.hypot(a.x + dx * t - target.x, a.y + dy * t - target.y) <= target.radius + radius;
}

function updateProjectiles(state) {
  const remaining = [];
  for (const projectile of state.projectiles) {
    projectile.life -= 1;
    const old = { x: projectile.x, y: projectile.y };
    projectile.x += projectile.vx; projectile.y += projectile.vy;
    if (projectile.life <= 0 || projectile.x < 38 || projectile.x > 922 || projectile.y < 54 || projectile.y > 586 || !clearLine(state, old, projectile, projectile.radius)) {
      emit(state, 'arrowStop', { x: projectile.x, y: projectile.y, move: projectile.kind });
      continue;
    }
    const targets = state.mode === 'coop'
      ? projectile.team === 'heroes' ? state.enemies : state.fighters
      : state.fighters.filter(f => playerTeam(state, f.id) !== projectile.team);
    let consumed = false;
    // Nearest contact wins when one segment touches more than one target.
    const contacts = targets.filter(target => alive(target) && !target.invulnerable && projectileContact(old, projectile, target, projectile.radius)).sort((a, b) => distance(old, a) - distance(old, b));
    for (const target of contacts) {
      const source = { id: projectile.owner, x: old.x - projectile.vx * 2, y: old.y - projectile.vy * 2 };
      const result = damageEntity(state, target, source, projectile.damage, { guardDamage: projectile.kind === 'orb' ? 22 : 14, knockback: 2.5, hitstun: 18, move: projectile.kind, projectile: true });
      if (result === 'parry') {
        const speed = Math.hypot(projectile.vx, projectile.vy);
        projectile.owner = target.id; projectile.team = playerTeam(state, target.id); projectile.reflected = true;
        projectile.angle = target.facing; projectile.facing = target.facing;
        projectile.vx = Math.cos(target.facing) * speed; projectile.vy = Math.sin(target.facing) * speed;
        projectile.x = target.x + Math.cos(target.facing) * (target.radius + projectile.radius + 4);
        projectile.y = target.y + Math.sin(target.facing) * (target.radius + projectile.radius + 4);
        projectile.damage = Math.min(24, projectile.damage + 4); projectile.life = 140;
      } else consumed = result !== 'evade';
      break;
    }
    if (!consumed) remaining.push(projectile);
  }
  state.projectiles = remaining;
}

const ENEMY_STATS = Object.freeze({
  slime: { radius: 18, hp: 40, speed: 1.04, windup: 48, active: 22, recovery: 58, reach: 36, damage: 10 },
  bat: { radius: 13, hp: 26, speed: 1.65, windup: 36, active: 18, recovery: 50, reach: 26, damage: 7 },
  knight: { radius: 20, hp: 70, speed: 0.93, windup: 55, active: 14, recovery: 65, reach: 75, damage: 16 },
  boss: { radius: 34, hp: 340, speed: 0.78, windup: 72, active: 18, recovery: 75, reach: 112, damage: 21 },
});

function makeEnemy(state, type, x, y) {
  const stats = ENEMY_STATS[type];
  return {
    id: state.enemyId++, type, x, y, vx: 0, vy: 0, radius: stats.radius,
    hp: stats.hp, maxHp: stats.hp, stamina: type === 'knight' ? 45 : 100, guard: 100,
    facing: Math.PI / 2, action: 'idle', actionFrame: 0, actionDuration: 0, stun: 0,
    invulnerable: false, guardBroken: 0, guarded: false, cooldown: 100 + state.enemyId % 41,
    attackId: 0, attackKind: 'melee', attackFacing: Math.PI / 2, hitTargets: [],
    windupTicks: stats.windup, activeTicks: stats.active, reach: stats.reach, damage: stats.damage,
    telegraphRadius: 0, targetId: 0, navX: x, navY: y,
  };
}

function spawnWave(state, wave) {
  const roster = [
    ['slime', 'slime', 'slime', 'bat', 'bat'],
    ['slime', 'slime', 'bat', 'bat', 'bat', 'knight'],
    ['knight', 'knight', 'slime', 'slime', 'bat', 'bat', 'bat'],
    ['boss', 'bat', 'bat'],
  ][wave - 1];
  const positions = [{ x: 170, y: 145 }, { x: 790, y: 145 }, { x: 480, y: 150 }, { x: 160, y: 450 }, { x: 800, y: 450 }, { x: 430, y: 270 }, { x: 530, y: 270 }];
  state.wave = wave; state.round = wave; state.waveDelay = 0;
  state.projectiles = [];
  state.enemies = roster.map((type, index) => makeEnemy(state, type, type === 'boss' ? 480 : positions[index].x, type === 'boss' ? 165 : positions[index].y));
  state.objective = wave === 4 ? 'Final room · Defeat the Ruin Warden.' : `Wave ${wave} of 4 · Clear the room. Guard beside a fallen ally to revive.`;
  emit(state, 'wave', { wave, boss: wave === 4, x: 480, y: 240 });
}

// A small visibility graph keeps ground enemies from sticking behind pillars.
function pathWaypoint(state, entity, goal) {
  // Leave a tiny tolerance at a wall contact. Inflating beyond the actor's
  // radius would put an already-touching actor inside the navigation obstacle,
  // making every exit segment appear blocked after knockback or separation.
  const padding = Math.max(0, entity.radius - 0.1);
  if (clearLine(state, entity, goal, padding)) return goal;
  const nodes = [{ x: entity.x, y: entity.y }, { x: goal.x, y: goal.y }];
  for (const rect of state.obstacles) {
    const margin = padding + 4;
    for (const x of [rect.x - margin, rect.x + rect.w + margin]) {
      for (const y of [rect.y - margin, rect.y + rect.h + margin]) nodes.push({ x, y });
    }
  }
  const costs = nodes.map(() => Infinity), previous = nodes.map(() => -1), done = new Set();
  costs[0] = 0;
  for (let count = 0; count < nodes.length; count++) {
    let current = -1;
    for (let index = 0; index < nodes.length; index++) if (!done.has(index) && (current < 0 || costs[index] < costs[current])) current = index;
    if (current < 0 || !Number.isFinite(costs[current])) break;
    if (current === 1) break;
    done.add(current);
    for (let next = 1; next < nodes.length; next++) {
      if (done.has(next) || !clearLine(state, nodes[current], nodes[next], padding)) continue;
      const cost = costs[current] + distance(nodes[current], nodes[next]);
      if (cost < costs[next]) { costs[next] = cost; previous[next] = current; }
    }
  }
  if (previous[1] < 0) return goal;
  let node = 1;
  while (previous[node] > 0) node = previous[node];
  return nodes[node];
}

function beginEnemyAttack(state, enemy, target) {
  const stats = ENEMY_STATS[enemy.type];
  enemy.action = 'windup'; enemy.actionFrame = 0; enemy.attackId += 1;
  enemy.attackFacing = angleTo(enemy, target); enemy.facing = enemy.attackFacing;
  enemy.targetId = target.id; enemy.hitTargets = []; enemy.vx = 0; enemy.vy = 0; enemy.guarded = false;
  enemy.attackKind = 'melee'; enemy.windupTicks = stats.windup; enemy.reach = stats.reach;
  enemy.telegraphRadius = 0;
  if (enemy.type === 'boss') {
    enemy.attackKind = enemy.attackId % 3 === 0 ? 'burst' : enemy.attackId % 3 === 1 ? 'slam' : 'melee';
    enemy.windupTicks = enemy.attackKind === 'burst' ? 84 : 72;
    enemy.telegraphRadius = enemy.attackKind === 'slam' ? 128 : 0;
    enemy.reach = enemy.attackKind === 'slam' ? 128 : stats.reach;
  }
  emit(state, 'telegraph', { fighter: enemy.id, x: enemy.x, y: enemy.y, angle: enemy.attackFacing, move: enemy.attackKind });
}

function updateEnemy(state, enemy) {
  enemy.guarded = false;
  if (!alive(enemy)) { enemy.action = 'dead'; enemy.actionFrame += 1; enemy.vx = 0; enemy.vy = 0; return; }
  const stats = ENEMY_STATS[enemy.type];
  if (enemy.guardBroken > 0) enemy.guardBroken -= 1;
  if (enemy.cooldown > 0) enemy.cooldown -= 1;
  enemy.stamina = Math.min(enemy.type === 'knight' ? 45 : 100, enemy.stamina + 0.06);
  if (enemy.stun > 0) {
    enemy.stun -= 1; enemy.actionFrame += 1; enemy.vx *= 0.85; enemy.vy *= 0.85;
    if (enemy.stun === 0) { enemy.action = 'recover'; enemy.actionFrame = 0; enemy.cooldown = Math.max(enemy.cooldown, 32); }
    moveEntity(state, enemy); return;
  }
  const targets = state.fighters.filter(alive).sort((a, b) => distance(enemy, a) - distance(enemy, b));
  const target = targets[0];
  if (!target) return;
  enemy.actionFrame += 1;
  if (enemy.action === 'windup') {
    enemy.vx = 0; enemy.vy = 0;
    // Aim locks after the first third of the warning, leaving a fair dodge window.
    if (enemy.actionFrame < Math.floor(enemy.windupTicks / 3)) {
      enemy.attackFacing = angleTo(enemy, target); enemy.facing = enemy.attackFacing;
    }
    if (enemy.actionFrame >= enemy.windupTicks) {
      enemy.action = 'attack'; enemy.actionFrame = 0;
      emit(state, 'swing', { fighter: enemy.id, x: enemy.x, y: enemy.y, angle: enemy.attackFacing, move: enemy.attackKind });
      if (enemy.attackKind === 'burst') {
        for (let index = 0; index < 8; index++) spawnProjectile(state, enemy, enemy.attackFacing + index * Math.PI / 4, { kind: 'orb', damage: 14, speed: 3.4, team: 'enemies' });
      }
    }
  } else if (enemy.action === 'attack') {
    const speed = enemy.type === 'slime' ? 3.1 : enemy.type === 'bat' ? 4.7 : enemy.type === 'knight' ? 1.1 : 0;
    enemy.vx = Math.cos(enemy.attackFacing) * speed; enemy.vy = Math.sin(enemy.attackFacing) * speed;
    if (enemy.actionFrame >= enemy.activeTicks) {
      enemy.action = 'recover'; enemy.actionFrame = 0; enemy.cooldown = stats.recovery;
    }
  } else if (enemy.action === 'recover') {
    enemy.vx *= 0.72; enemy.vy *= 0.72;
    if (enemy.actionFrame >= 20) { enemy.action = 'idle'; enemy.actionFrame = 0; }
  } else {
    const gap = distance(enemy, target);
    const engageDistance = enemy.type === 'boss' ? 144 : enemy.type === 'knight' ? 90 : enemy.type === 'bat' ? 118 : 98;
    if (!enemy.cooldown && gap < engageDistance && clearLine(state, enemy, target, 4)) beginEnemyAttack(state, enemy, target);
    else {
      if ((state.tick + enemy.id * 3) % 18 === 0 || distance(enemy, { x: enemy.navX, y: enemy.navY }) < 8) {
        const waypoint = pathWaypoint(state, enemy, target);
        enemy.navX = waypoint.x; enemy.navY = waypoint.y;
      }
      const navigation = angleTo(enemy, { x: enemy.navX, y: enemy.navY });
      enemy.facing = angleTo(enemy, target);
      const approach = gap > 56 || enemy.type === 'boss' && gap > 102;
      const orbit = enemy.type === 'bat' && enemy.cooldown > 10 && gap < 110;
      enemy.vx = Math.cos(navigation + (orbit ? Math.PI / 2 : 0)) * stats.speed * (approach || orbit ? 1 : 0.15);
      enemy.vy = Math.sin(navigation + (orbit ? Math.PI / 2 : 0)) * stats.speed * (approach || orbit ? 1 : 0.15);
      enemy.action = 'run';
      enemy.guarded = enemy.type === 'knight' && !enemy.guardBroken && enemy.stamina > 0 && enemy.cooldown > 24;
    }
  }
  moveEntity(state, enemy);
}

function resolveEnemyAttacks(state) {
  for (const enemy of state.enemies) {
    if (!alive(enemy) || enemy.action !== 'attack' || enemy.attackKind === 'burst') continue;
    for (const target of state.fighters) {
      if (enemy.hitTargets.includes(target.id) || !alive(target)) continue;
      const connects = enemy.attackKind === 'slam'
        ? distance(enemy, target) <= enemy.reach + target.radius && clearLine(state, enemy, target, 2)
        : swordConnects(state, enemy, target, enemy.reach, enemy.attackFacing, enemy.type === 'knight' ? 1.25 : 0.95);
      if (!connects) continue;
      const result = damageEntity(state, target, enemy, enemy.damage, { guardDamage: enemy.type === 'boss' ? 34 : enemy.type === 'knight' ? 27 : 18, knockback: 3.7, hitstun: 26, move: enemy.attackKind, parryable: enemy.attackKind !== 'slam' });
      if (result !== 'evade') enemy.hitTargets.push(target.id);
      if (result === 'parry') break;
    }
  }
}

function updateRevives(state, inputs) {
  for (const downed of state.fighters) {
    if (!downed.downed) continue;
    const ally = state.fighters[1 - downed.id];
    const helping = alive(ally) && ally.action === 'block' && inputs[ally.id].block && distance(ally, downed) <= 64 && clearLine(state, ally, downed, 2);
    downed.reviveProgress = helping ? Math.min(180, downed.reviveProgress + 1) : 0;
    if (downed.reviveProgress >= 180) {
      downed.hp = 45; downed.stamina = 70; downed.guard = 70;
      downed.downed = false; downed.reviveProgress = 0; downed.reviveShield = 100;
      downed.action = 'idle'; downed.actionFrame = 0; downed.stun = 0; downed.invulnerable = true;
      emit(state, 'revive', { fighter: downed.id, x: downed.x, y: downed.y });
    }
  }
}

function finishDuelRound(state, winner, reason) {
  state.winner = winner; state.phase = 'roundEnd'; state.phaseTicks = TICK_RATE * 2;
  if (winner !== null) state.fighters[winner].wins += 1;
  state.projectiles = [];
  state.fighters.forEach(f => { f.vx = 0; f.vy = 0; f.invulnerable = false; });
  emit(state, 'roundEnd', { winner, reason, x: 480, y: 320 });
}

function finishCoop(state, result) {
  state.result = result; state.winner = null; state.phase = 'matchEnd'; state.phaseTicks = 0;
  state.projectiles = [];
  if (result === 'victory') {
    // The Warden powers the final room; its defeat dismisses surviving adds.
    for (const enemy of state.enemies) {
      if (!alive(enemy)) continue;
      enemy.hp = 0; enemy.action = 'dead'; enemy.actionFrame = 0; enemy.vx = 0; enemy.vy = 0;
      emit(state, 'enemyDeath', { fighter: enemy.id, enemyType: enemy.type, x: enemy.x, y: enemy.y });
    }
  }
  state.objective = result === 'victory' ? 'Victory · The Warden has fallen. The ruins are safe.' : 'Both adventurers have fallen. Ready up to try again.';
  emit(state, 'matchEnd', { result, winner: null, x: 480, y: 320 });
}

/** Advances exactly one fixed tick. Inputs are sanitized and edge buffered. */
export function step(state, rawInputs = [emptyInput(), emptyInput()]) {
  state.tick += 1;
  const inputs = state.fighters.map((f, index) => recordInput(state, f, rawInputs[index]));
  if (state.phase === 'lobby' || state.phase === 'matchEnd') return state;
  if (state.phase === 'countdown') {
    state.phaseTicks = Math.max(0, state.phaseTicks - 1);
    if (!state.phaseTicks) {
      state.phase = 'fight';
      if (state.mode === 'coop') spawnWave(state, 1);
      emit(state, 'fight', { round: state.round, x: 480, y: 320 });
    }
    return state;
  }
  if (state.phase === 'roundEnd') {
    state.phaseTicks = Math.max(0, state.phaseTicks - 1);
    if (!state.phaseTicks) {
      const champion = state.fighters.find(f => f.wins >= 2);
      if (champion) {
        state.phase = 'matchEnd'; state.winner = champion.id;
        emit(state, 'matchEnd', { winner: champion.id, x: 480, y: 320 });
      } else { state.round += 1; prepareRound(state); }
    }
    return state;
  }

  state.elapsedTicks += 1;
  if (state.mode === 'duel') state.roundTicks = Math.max(0, state.roundTicks - 1);
  state.fighters.forEach((f, index) => updateFighter(state, f, inputs[index]));
  separate(state, ...state.fighters);
  if (state.mode === 'coop') {
    state.enemies.forEach(enemy => updateEnemy(state, enemy));
    for (const enemy of state.enemies) {
      for (const f of state.fighters) separate(state, enemy, f);
    }
    for (let i = 0; i < state.enemies.length; i++) for (let j = i + 1; j < state.enemies.length; j++) separate(state, state.enemies[i], state.enemies[j]);
  }
  resolveSwords(state);
  if (state.mode === 'coop') resolveEnemyAttacks(state);
  updateProjectiles(state);

  if (state.mode === 'duel') {
    const down = state.fighters.filter(f => !alive(f));
    if (down.length) finishDuelRound(state, down.length === 2 ? null : 1 - down[0].id, down.length === 2 ? 'doubleKO' : 'knockout');
    else if (!state.roundTicks) {
      const difference = state.fighters[0].hp - state.fighters[1].hp;
      finishDuelRound(state, difference === 0 ? null : difference > 0 ? 0 : 1, 'time');
    }
  } else {
    updateRevives(state, inputs);
    if (state.fighters.every(f => !alive(f))) finishCoop(state, 'defeat');
    else if (state.wave === state.maxWaves && state.enemies.some(enemy => enemy.type === 'boss' && !alive(enemy))) finishCoop(state, 'victory');
    else if (!state.enemies.some(alive)) {
      if (state.wave >= state.maxWaves) finishCoop(state, 'victory');
      else if (!state.waveDelay) {
        state.waveDelay = TICK_RATE * 3;
        state.projectiles = [];
        state.objective = 'Room clear · Catch your breath. Health restores for the next wave.';
        emit(state, 'waveClear', { wave: state.wave, x: 480, y: 320 });
      } else {
        state.waveDelay -= 1;
        if (!state.waveDelay) {
          state.fighters.forEach(f => {
            f.hp = Math.min(100, (f.downed ? 35 : f.hp) + 22);
            f.downed = false; f.reviveProgress = 0; f.stamina = 100; f.guard = 100;
            f.stun = 0; f.action = 'idle'; f.actionFrame = 0; f.guardBroken = 0;
            f.reviveShield = 75;
          });
          spawnWave(state, state.wave + 1);
        }
      }
    }
  }
  return state;
}
