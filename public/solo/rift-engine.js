/** Rift Survivor: fixed-step arena combat. All distances are arena pixels. */
export const ARENA = Object.freeze({ width: 1000, height: 680 });
export const TOTAL_WAVES = 10;
export const MAX_PROJECTILES = 180;
export const MAX_ENEMIES = 18;
export const OBSTACLES = Object.freeze([
  { x: 280, y: 200, width: 90, height: 70 },
  { x: 630, y: 200, width: 90, height: 70 },
  { x: 280, y: 410, width: 90, height: 70 },
  { x: 630, y: 410, width: 90, height: 70 },
].map(Object.freeze));
export const UPGRADES = Object.freeze({
  repair: Object.freeze({ id: 'repair', title: 'Field repair', description: 'Restore 35 health. Your scars carry between waves.' }),
  damage: Object.freeze({ id: 'damage', title: 'Heavy rounds', description: '+6 weapon damage, up to 46.' }),
  cooling: Object.freeze({ id: 'cooling', title: 'Heat sink', description: '+8 cooling per second and less heat per shot.' }),
  mobility: Object.freeze({ id: 'mobility', title: 'Light boots', description: '+20 movement speed, up to 310.' }),
  battery: Object.freeze({ id: 'battery', title: 'Dash capacitor', description: '+15 maximum stamina and faster recovery.' }),
  plating: Object.freeze({ id: 'plating', title: 'Reactive plating', description: '+10 maximum health and restore 10 health, up to 130.' }),
});

const sources = new WeakMap();
const coverGraphs = new Map();
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const length = (x, y) => Math.hypot(x, y);
const distance = (a, b) => length(a.x - b.x, a.y - b.y);
const unit = (x, y, fallbackX = 1, fallbackY = 0) => {
  const scale = Math.max(Math.abs(x), Math.abs(y));
  if (scale <= .00001) return { x: fallbackX, y: fallbackY };
  const magnitude = length(x / scale, y / scale);
  return { x: x / scale / magnitude, y: y / scale / magnitude };
};

function random(state) {
  const value = (sources.get(state) || Math.random)();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new RangeError('random must return a number from 0 up to, but not including, 1');
  return value;
}

function event(state, type, details = {}) {
  state.events.push({ id: ++state.eventId, type, time: state.elapsed,
    x: state.player.x, y: state.player.y, ...details });
  if (state.events.length > 32) state.events.splice(0, state.events.length - 32);
}

function overlapsCover(x, y, radius) {
  return OBSTACLES.some(rect => length(x - clamp(x, rect.x, rect.x + rect.width),
    y - clamp(y, rect.y, rect.y + rect.height)) < radius);
}

/** Circle against solid covers, with sliding rather than sticky stops. */
function moveBody(body, dx, dy) {
  body.x = clamp(body.x + dx, body.radius, ARENA.width - body.radius);
  body.y = clamp(body.y + dy, body.radius, ARENA.height - body.radius);
  for (const rect of OBSTACLES) {
    const cx = clamp(body.x, rect.x, rect.x + rect.width);
    const cy = clamp(body.y, rect.y, rect.y + rect.height);
    const ox = body.x - cx;
    const oy = body.y - cy;
    const gap = length(ox, oy);
    if (gap >= body.radius) continue;
    if (gap > .00001) {
      body.x = cx + ox / gap * body.radius;
      body.y = cy + oy / gap * body.radius;
    } else {
      const sides = [
        { gap: body.x - (rect.x - body.radius), x: rect.x - body.radius, y: body.y },
        { gap: rect.x + rect.width + body.radius - body.x, x: rect.x + rect.width + body.radius, y: body.y },
        { gap: body.y - (rect.y - body.radius), x: body.x, y: rect.y - body.radius },
        { gap: rect.y + rect.height + body.radius - body.y, x: body.x, y: rect.y + rect.height + body.radius },
      ].sort((a, b) => a.gap - b.gap);
      body.x = sides[0].x;
      body.y = sides[0].y;
    }
  }
}

function spawnPoint(state, radius) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const side = Math.floor(random(state) * 4);
    const fraction = .08 + random(state) * .84;
    const point = side === 0 ? { x: 42, y: ARENA.height * fraction }
      : side === 1 ? { x: ARENA.width - 42, y: ARENA.height * fraction }
        : side === 2 ? { x: ARENA.width * fraction, y: 42 }
          : { x: ARENA.width * fraction, y: ARENA.height - 42 };
    if (distance(point, state.player) > 220 && !overlapsCover(point.x, point.y, radius + 12)
      && state.enemies.every(enemy => distance(point, enemy) > radius + enemy.radius + 6)) return point;
  }
  // Degenerate random sources still have deterministic, safe spawn positions.
  const points = [];
  for (let x = 48; x < ARENA.width; x += 80) points.push({ x, y: 42 }, { x, y: ARENA.height - 42 });
  for (let y = 122; y < ARENA.height - 42; y += 80) points.push({ x: 42, y }, { x: ARENA.width - 42, y });
  return points.filter(point => distance(point, state.player) > 220
    && state.enemies.every(enemy => distance(point, enemy) > radius + enemy.radius + 6))[0]
    || points.sort((a, b) => distance(b, state.player) - distance(a, state.player))[0];
}

function spawnEnemy(state, type) {
  const boss = type === 'boss';
  const radius = boss ? 30 : type === 'brute' ? 22 : type === 'ranged' ? 15 : 14;
  const hp = boss ? (state.wave === 10 ? 800 : 440)
    : type === 'brute' ? 90 + state.wave * 4 : type === 'ranged' ? 44 + state.wave * 2 : 38 + state.wave * 2;
  state.enemies.push({ id: ++state.enemyId, type, ...spawnPoint(state, radius), radius,
    hp, maxHp: hp, boss, speed: boss ? 48 : type === 'brute' ? 64 : type === 'ranged' ? 100 : 94 + state.wave * 3,
    phase: 'seeking', timer: 0, attackTimer: boss ? 1.4 : .6 + random(state) * .8,
    aimX: 1, aimY: 0, pattern: 0 });
}

function startWave(state, wave) {
  state.phase = 'playing';
  state.wave = wave;
  state.waveKills = 0;
  state.upgradeChoices = [];
  state.projectiles = [];
  state.player.dashTime = 0;
  state.player.invulnerable = Math.max(state.player.invulnerable, .8);
  state.player.heat = 0;
  state.player.overheated = false;
  state.player.fireCooldown = 0;
  state.player.stamina = state.player.maxStamina;
  const composition = [
    [4, 0, 0], [5, 2, 0], [5, 2, 1], [5, 3, 2], [3, 2, 1],
    [6, 3, 2], [6, 4, 3], [7, 4, 3], [7, 5, 4], [4, 3, 2],
  ][wave - 1];
  for (let index = 0; index < composition[0]; index += 1) spawnEnemy(state, 'chaser');
  for (let index = 0; index < composition[1]; index += 1) spawnEnemy(state, 'ranged');
  for (let index = 0; index < composition[2]; index += 1) spawnEnemy(state, 'brute');
  if (wave === 5 || wave === 10) spawnEnemy(state, 'boss');
  event(state, 'wave', { wave, enemies: state.enemies.length });
}

export function createState({ random: source = Math.random } = {}) {
  if (typeof source !== 'function') throw new TypeError('random must be a function');
  const state = {
    gameId: 'rift-survivor', phase: 'playing', pausedPhase: null, wave: 1, wavesCleared: 0,
    waveKills: 0, kills: 0, score: 0, elapsed: 0, tick: 0, result: null,
    player: { x: ARENA.width / 2, y: ARENA.height / 2, radius: 12,
      hp: 100, maxHp: 100, stamina: 100, maxStamina: 100, aimX: 1, aimY: 0,
      heat: 0, maxHeat: 100, overheated: false, fireCooldown: 0, dashTime: 0,
      dashX: 1, dashY: 0, invulnerable: 0, damageCooldown: 0,
      moveSpeed: 230, damage: 22, fireInterval: .115, heatPerShot: 11,
      cooling: 28, staminaRegen: 25, dashCost: 34, staminaDelay: 0, dashHeld: false },
    enemies: [], enemyId: 0, projectiles: [], projectileId: 0,
    events: [], eventId: 0, upgrades: {}, upgradeChoices: [],
  };
  sources.set(state, source);
  startWave(state, 1);
  return state;
}

function projectile(state, owner, x, y, aimX, aimY, speed, damage, radius = 4, origin = null) {
  if (state.projectiles.length >= MAX_PROJECTILES) return;
  if (origin && OBSTACLES.some(rect => coverHit(origin.x, origin.y, x - origin.x, y - origin.y, rect, radius) !== null)) return;
  state.projectiles.push({ id: ++state.projectileId, owner, x, y,
    vx: aimX * speed, vy: aimY * speed, damage, radius, life: owner === 'player' ? 1.6 : 4.5 });
}

function fireFan(state, enemy, count, spread, speed, damage) {
  const angle = Math.atan2(enemy.aimY, enemy.aimX);
  for (let index = 0; index < count; index += 1) {
    const shotAngle = angle + (index - (count - 1) / 2) * spread;
    const x = Math.cos(shotAngle);
    const y = Math.sin(shotAngle);
    projectile(state, 'enemy', enemy.x + x * (enemy.radius + 6), enemy.y + y * (enemy.radius + 6), x, y, speed, damage, 5, enemy);
  }
  event(state, 'volley', { x: enemy.x, y: enemy.y, enemyId: enemy.id, pattern: enemy.pattern });
}

function hurtPlayer(state, damage, source) {
  const player = state.player;
  if (state.phase !== 'playing' || player.invulnerable > 0 || player.damageCooldown > 0) return false;
  player.hp = Math.max(0, player.hp - damage);
  player.damageCooldown = .55;
  event(state, 'hurt', { damage, source, hp: player.hp });
  if (player.hp === 0) {
    state.phase = 'lost';
    state.result = 'defeated';
    event(state, 'defeat');
  }
  return true;
}

function beginTell(state, enemy, duration) {
  const aim = unit(state.player.x - enemy.x, state.player.y - enemy.y);
  enemy.aimX = aim.x;
  enemy.aimY = aim.y;
  enemy.phase = 'windup';
  enemy.timer = duration;
  event(state, 'tell', { x: enemy.x, y: enemy.y, enemyId: enemy.id, enemyType: enemy.type, pattern: enemy.pattern });
}

function lineClear(from, to, radius = 0) {
  return OBSTACLES.every(rect => coverHit(from.x, from.y, to.x - from.x, to.y - from.y, rect, radius) === null);
}

/** A tiny static visibility graph keeps pursuit from sticking on cover. */
function coverGraph(radius) {
  if (coverGraphs.has(radius)) return coverGraphs.get(radius);
  const margin = radius + 3;
  const corners = OBSTACLES.flatMap(rect => [
    { x: rect.x - margin, y: rect.y - margin },
    { x: rect.x + rect.width + margin, y: rect.y - margin },
    { x: rect.x + rect.width + margin, y: rect.y + rect.height + margin },
    { x: rect.x - margin, y: rect.y + rect.height + margin },
  ]);
  const links = corners.map((corner, index) => corners.flatMap((other, target) =>
    index !== target && lineClear(corner, other, radius) ? [{ target: target + 2, cost: distance(corner, other) }] : []));
  const graph = { corners, links };
  coverGraphs.set(radius, graph);
  return graph;
}

function detour(from, to, radius) {
  const graph = coverGraph(radius);
  const nodes = [from, to, ...graph.corners];
  const links = [
    nodes.flatMap((other, index) => index > 0 && lineClear(from, other, radius) ? [{ target: index, cost: distance(from, other) }] : []),
    [],
    ...graph.links.map((neighbors, index) => [...neighbors,
      ...(lineClear(graph.corners[index], to, radius) ? [{ target: 1, cost: distance(graph.corners[index], to) }] : [])]),
  ];
  const costs = nodes.map(() => Infinity);
  const previous = nodes.map(() => -1);
  const visited = new Set();
  costs[0] = 0;
  for (let count = 0; count < nodes.length; count += 1) {
    let current = -1;
    for (let index = 0; index < nodes.length; index += 1) if (!visited.has(index)
      && (current < 0 || costs[index] < costs[current])) current = index;
    if (current < 0 || !Number.isFinite(costs[current])) break;
    if (current === 1) {
      const path = [];
      for (let index = 1; index !== 0; index = previous[index]) path.unshift({ x: nodes[index].x, y: nodes[index].y });
      return path;
    }
    visited.add(current);
    for (const link of links[current]) if (costs[current] + link.cost < costs[link.target]) {
      costs[link.target] = costs[current] + link.cost;
      previous[link.target] = current;
    }
  }
  return [{ x: to.x, y: to.y }];
}

function pursuit(enemy, target, dt) {
  const radius = enemy.radius - .25;
  // The smaller player can hug a wall closer than an enemy can. Route to a
  // reachable point beside that player instead of an impossible body position.
  const goal = { x: target.x, y: target.y, radius: enemy.radius + 3 };
  moveBody(goal, 0, 0);
  if (lineClear(enemy, goal, radius)) { enemy.navigation = null; return unit(goal.x - enemy.x, goal.y - enemy.y); }
  enemy.navigationTimer = Math.max(0, (enemy.navigationTimer || 0) - dt);
  if (!enemy.navigation || enemy.navigationTimer === 0) {
    enemy.navigation = detour(enemy, goal, radius);
    enemy.navigationTimer = .25;
  }
  while (enemy.navigation.length > 1 && distance(enemy, enemy.navigation[0]) < 9) enemy.navigation.shift();
  const waypoint = enemy.navigation[0];
  return unit(waypoint.x - enemy.x, waypoint.y - enemy.y);
}

function updateEnemies(state, dt) {
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0 || state.phase !== 'playing') continue;
    enemy.attackTimer = Math.max(0, enemy.attackTimer - dt);
    const gap = distance(enemy, state.player);
    const chase = unit(state.player.x - enemy.x, state.player.y - enemy.y);
    if (enemy.phase === 'windup') {
      enemy.timer -= dt;
      if (enemy.timer > 0) continue;
      if (enemy.type === 'chaser') {
        if (gap < 57) hurtPlayer(state, 12, 'melee');
        enemy.phase = 'recover'; enemy.timer = .42; enemy.attackTimer = .5;
        event(state, 'swipe', { x: enemy.x, y: enemy.y, enemyId: enemy.id });
      } else if (enemy.type === 'brute') {
        enemy.phase = 'charge'; enemy.timer = .65;
        event(state, 'charge', { x: enemy.x, y: enemy.y, enemyId: enemy.id });
      } else if (enemy.type === 'ranged') {
        fireFan(state, enemy, 3, .16, 225 + state.wave * 4, 10);
        enemy.phase = 'recover'; enemy.timer = .35; enemy.attackTimer = 2.0;
      } else {
        if (enemy.pattern % 2 === 0) fireFan(state, enemy, 12, Math.PI * 2 / 12, 195 + state.wave * 3, 14);
        else fireFan(state, enemy, 5, .14, 280, 14);
        enemy.pattern += 1;
        enemy.phase = 'recover'; enemy.timer = .5; enemy.attackTimer = 1.6;
      }
    } else if (enemy.phase === 'charge') {
      const before = { x: enemy.x, y: enemy.y };
      moveBody(enemy, enemy.aimX * (350 + state.wave * 4) * dt, enemy.aimY * (350 + state.wave * 4) * dt);
      if (gap < enemy.radius + state.player.radius + 8) hurtPlayer(state, 18, 'charge');
      enemy.timer -= dt;
      if (enemy.timer <= 0 || distance(before, enemy) < (350 + state.wave * 4) * dt * .35) {
        enemy.phase = 'recover'; enemy.timer = .7; enemy.attackTimer = 1.2;
      }
    } else if (enemy.phase === 'recover') {
      enemy.timer -= dt;
      if (enemy.timer <= 0) enemy.phase = 'seeking';
    } else if (enemy.type === 'chaser') {
      if (gap < 54 && enemy.attackTimer <= 0) beginTell(state, enemy, .32);
      else { const direction = pursuit(enemy, state.player, dt); moveBody(enemy, direction.x * enemy.speed * dt, direction.y * enemy.speed * dt); }
    } else if (enemy.type === 'brute') {
      if (gap < 390 && enemy.attackTimer <= 0) beginTell(state, enemy, .8);
      else { const direction = pursuit(enemy, state.player, dt); moveBody(enemy, direction.x * enemy.speed * dt, direction.y * enemy.speed * dt); }
    } else if (enemy.type === 'ranged') {
      const visible = lineClear(enemy, state.player, 5);
      if (enemy.attackTimer <= 0 && visible) beginTell(state, enemy, .6);
      else if (!visible) { const direction = pursuit(enemy, state.player, dt); moveBody(enemy, direction.x * enemy.speed * dt, direction.y * enemy.speed * dt); }
      else {
        const direction = gap > 320 ? 1 : gap < 220 ? -1 : 0;
        moveBody(enemy, chase.x * enemy.speed * dt * direction, chase.y * enemy.speed * dt * direction);
      }
    } else {
      const visible = lineClear(enemy, state.player, 5);
      if (enemy.attackTimer <= 0 && visible) beginTell(state, enemy, .9);
      else if (gap > 250 || !visible) { const direction = pursuit(enemy, state.player, dt); moveBody(enemy, direction.x * enemy.speed * dt, direction.y * enemy.speed * dt); }
      if (gap < enemy.radius + state.player.radius + 2) hurtPlayer(state, 16, 'boss');
    }
  }
}

function circleHit(x, y, dx, dy, circle, radius) {
  const ox = x - circle.x;
  const oy = y - circle.y;
  const r = circle.radius + radius;
  const c = ox * ox + oy * oy - r * r;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy;
  if (a === 0) return null;
  const b = 2 * (ox * dx + oy * dy);
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const t = (-b - Math.sqrt(discriminant)) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}

function rectHit(x, y, dx, dy, rect, radius) {
  let near = 0;
  let far = 1;
  for (const [origin, delta, low, high] of [
    [x, dx, rect.x - radius, rect.x + rect.width + radius],
    [y, dy, rect.y - radius, rect.y + rect.height + radius],
  ]) {
    if (Math.abs(delta) < .000001) { if (origin < low || origin > high) return null; }
    else {
      let a = (low - origin) / delta;
      let b = (high - origin) / delta;
      if (a > b) [a, b] = [b, a];
      near = Math.max(near, a); far = Math.min(far, b);
      if (near > far) return null;
    }
  }
  return near;
}

function coverHit(x, y, dx, dy, rect, radius) {
  if (!radius) return rectHit(x, y, dx, dy, rect, 0);
  const hits = [
    rectHit(x, y, dx, dy, { x: rect.x - radius, y: rect.y, width: rect.width + 2 * radius, height: rect.height }, 0),
    rectHit(x, y, dx, dy, { x: rect.x, y: rect.y - radius, width: rect.width, height: rect.height + 2 * radius }, 0),
    ...[[rect.x, rect.y], [rect.x + rect.width, rect.y], [rect.x + rect.width, rect.y + rect.height], [rect.x, rect.y + rect.height]]
      .map(([cx, cy]) => circleHit(x, y, dx, dy, { x: cx, y: cy, radius: 0 }, radius)),
  ].filter(hit => hit !== null);
  return hits.length ? Math.min(...hits) : null;
}

function updateProjectiles(state, dt) {
  const remaining = [];
  for (const shot of state.projectiles) {
    if (state.phase !== 'playing') break;
    shot.life -= dt;
    if (shot.life <= 0) continue;
    const dx = shot.vx * dt;
    const dy = shot.vy * dt;
    let first = 2;
    let target = null;
    for (const rect of OBSTACLES) {
      const hit = coverHit(shot.x, shot.y, dx, dy, rect, shot.radius);
      if (hit !== null && hit < first) { first = hit; target = 'cover'; }
    }
    if (shot.owner === 'player') {
      for (const enemy of state.enemies) {
        if (enemy.hp <= 0) continue;
        const hit = circleHit(shot.x, shot.y, dx, dy, enemy, shot.radius);
        if (hit !== null && hit < first) { first = hit; target = enemy; }
      }
    } else {
      const hit = circleHit(shot.x, shot.y, dx, dy, state.player, shot.radius);
      if (hit !== null && hit < first) { first = hit; target = 'player'; }
    }
    if (target) {
      if (target === 'player') hurtPlayer(state, shot.damage, 'projectile');
      else if (target !== 'cover') {
        target.hp = Math.max(0, target.hp - shot.damage);
        event(state, 'hit', { x: target.x, y: target.y, enemyId: target.id, damage: shot.damage });
        if (target.hp === 0) {
          state.kills += 1; state.waveKills += 1;
          state.score += target.boss ? 1500 : target.type === 'brute' ? 180 : target.type === 'ranged' ? 130 : 100;
          event(state, 'kill', { x: target.x, y: target.y, enemyId: target.id, enemyType: target.type });
        }
      }
      continue;
    }
    shot.x += dx; shot.y += dy;
    if (shot.x > -shot.radius && shot.x < ARENA.width + shot.radius
      && shot.y > -shot.radius && shot.y < ARENA.height + shot.radius) remaining.push(shot);
  }
  state.projectiles = remaining;
  state.enemies = state.enemies.filter(enemy => enemy.hp > 0);
}

function upgradeAvailable(state, id) {
  const player = state.player;
  return id === 'repair' ? player.hp < player.maxHp
    : id === 'damage' ? player.damage < 46
      : id === 'cooling' ? player.cooling < 52
        : id === 'mobility' ? player.moveSpeed < 310
          : id === 'battery' ? player.maxStamina < 145
            : id === 'plating' ? player.maxHp < 130 : false;
}

function clearWave(state) {
  state.wavesCleared = state.wave;
  state.score += state.wave * 300;
  state.projectiles = [];
  state.player.dashTime = 0;
  state.player.dashHeld = false;
  event(state, 'clear', { wave: state.wave });
  if (state.wave === TOTAL_WAVES) {
    state.phase = 'won'; state.result = 'rift-sealed';
    state.score += Math.round(state.player.hp) * 10;
    event(state, 'victory');
  } else {
    const choices = Object.keys(UPGRADES).filter(id => upgradeAvailable(state, id));
    // At most two of the five progression upgrades can cap before choice nine.
    for (let index = choices.length - 1; index > 0; index -= 1) {
      const target = Math.floor(random(state) * (index + 1));
      [choices[index], choices[target]] = [choices[target], choices[index]];
    }
    state.upgradeChoices = choices.slice(0, 3);
    state.phase = 'upgrade';
  }
}

/** Inputs require literal booleans; aim is a finite normalized vector. */
export function step(state, inputs = {}, dt = 1 / 120) {
  if (state.phase !== 'playing' || !Number.isFinite(dt) || dt <= 0) return false;
  inputs ??= {};
  dt = Math.min(dt, 1 / 30);
  state.elapsed += dt; state.tick += 1;
  const player = state.player;
  player.fireCooldown = Math.max(0, player.fireCooldown - dt);
  player.invulnerable = Math.max(0, player.invulnerable - dt);
  player.damageCooldown = Math.max(0, player.damageCooldown - dt);
  player.staminaDelay = Math.max(0, player.staminaDelay - dt);
  player.heat = Math.max(0, player.heat - player.cooling * dt);
  if (player.overheated && player.heat <= 35) player.overheated = false;
  if (Number.isFinite(inputs.aimX) && Number.isFinite(inputs.aimY)) {
    const aim = unit(inputs.aimX, inputs.aimY, player.aimX, player.aimY);
    player.aimX = aim.x; player.aimY = aim.y;
  }
  const mx = Number(inputs.right === true) - Number(inputs.left === true);
  const my = Number(inputs.down === true) - Number(inputs.up === true);
  let movement = unit(mx, my, 0, 0);
  if (Number.isFinite(inputs.moveX) && Number.isFinite(inputs.moveY)) {
    const magnitude = length(inputs.moveX, inputs.moveY);
    movement = magnitude > 1 ? unit(inputs.moveX, inputs.moveY)
      : { x: inputs.moveX, y: inputs.moveY };
  }
  const dash = inputs.dash === true;
  if (dash && !player.dashHeld && player.dashTime <= 0 && player.stamina >= player.dashCost) {
    const direction = length(movement.x, movement.y) > .05
      ? unit(movement.x, movement.y) : { x: player.aimX, y: player.aimY };
    player.dashX = direction.x; player.dashY = direction.y;
    player.dashTime = .16; player.invulnerable = Math.max(player.invulnerable, .18);
    player.stamina -= player.dashCost; player.staminaDelay = .7;
    event(state, 'dash');
  }
  player.dashHeld = dash;
  if (player.dashTime > 0) {
    const activeTime = Math.min(dt, player.dashTime);
    moveBody(player, player.dashX * 620 * activeTime, player.dashY * 620 * activeTime);
    player.dashTime = Math.max(0, player.dashTime - dt);
  } else moveBody(player, movement.x * player.moveSpeed * dt, movement.y * player.moveSpeed * dt);
  if (player.staminaDelay === 0) player.stamina = Math.min(player.maxStamina, player.stamina + player.staminaRegen * dt);
  if (inputs.fire === true && player.fireCooldown <= 0 && !player.overheated) {
    projectile(state, 'player', player.x + player.aimX * (player.radius + 6),
      player.y + player.aimY * (player.radius + 6), player.aimX, player.aimY, 780, player.damage, 4, player);
    player.fireCooldown = player.fireInterval;
    player.heat = Math.min(player.maxHeat, player.heat + player.heatPerShot);
    if (player.heat >= player.maxHeat) { player.overheated = true; event(state, 'overheat'); }
  }
  updateEnemies(state, dt);
  updateProjectiles(state, dt);
  if (state.phase === 'playing' && state.enemies.length === 0) clearWave(state);
  return true;
}

export function togglePause(state) {
  if (state.phase === 'playing' || state.phase === 'upgrade') {
    state.pausedPhase = state.phase; state.phase = 'paused'; state.player.dashHeld = false;
  } else if (state.phase === 'paused') {
    state.phase = state.pausedPhase || 'playing'; state.pausedPhase = null;
  } else return false;
  return true;
}

export function chooseUpgrade(state, id) {
  if (state.phase !== 'upgrade') return { ok: false, error: 'Choose an upgrade between waves.' };
  if (!state.upgradeChoices.includes(id) || !upgradeAvailable(state, id)) return { ok: false, error: 'Choose one of the offered upgrades.' };
  const player = state.player;
  if (id === 'repair') player.hp = Math.min(player.maxHp, player.hp + 35);
  if (id === 'damage') player.damage = Math.min(46, player.damage + 6);
  if (id === 'cooling') { player.cooling = Math.min(52, player.cooling + 8); player.heatPerShot = Math.max(7, player.heatPerShot - 1); }
  if (id === 'mobility') player.moveSpeed = Math.min(310, player.moveSpeed + 20);
  if (id === 'battery') { player.maxStamina = Math.min(145, player.maxStamina + 15); player.staminaRegen = Math.min(37, player.staminaRegen + 4); }
  if (id === 'plating') { player.maxHp = Math.min(130, player.maxHp + 10); player.hp = Math.min(player.maxHp, player.hp + 10); }
  state.upgrades[id] = (state.upgrades[id] || 0) + 1;
  event(state, 'upgrade', { upgrade: id });
  startWave(state, state.wave + 1);
  return { ok: true };
}
