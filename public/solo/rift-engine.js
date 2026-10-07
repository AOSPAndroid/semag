/** Rift Survivor: fixed-step arena combat. All distances are arena pixels. */
export const ARENA = Object.freeze({ width: 1000, height: 680 });
export const TOTAL_WAVES = 20;
export const MAX_PROJECTILES = 240;
export const MAX_ENEMIES = 22;
export const SECTORS = Object.freeze([
  { id: 'containment', name: 'Containment', boss: 'The Warden', patterns: ['radial', 'fan'], floor: '#243c42', tile: '#2a4146', edge: '#6a947a', accent: '#79ad91' },
  { id: 'cryo-foundry', name: 'Cryo Foundry', boss: 'The Archivist', patterns: ['mines', 'double-ring'], floor: '#283d51', tile: '#30495e', edge: '#77a8c1', accent: '#a2d5d6' },
  { id: 'overgrowth', name: 'Overgrowth', boss: 'The Thorn Regent', patterns: ['cross', 'fan-mines'], floor: '#35443c', tile: '#3f5042', edge: '#a0aa68', accent: '#c0cf78' },
  { id: 'astral-core', name: 'Astral Core', boss: 'The Crown of Glass', patterns: ['rift-lanes', 'crown'], floor: '#3c3450', tile: '#483e5c', edge: '#b599c0', accent: '#deb6d5' },
].map(sector => Object.freeze({ ...sector, patterns: Object.freeze(sector.patterns) })));
export const DIFFICULTIES = Object.freeze({
  standard: Object.freeze({ title: 'Expedition', description: 'Twenty waves, four sectors, one evolving build.',
    enemySpeed: 1, projectileSpeed: 1, cadence: 1, lead: 0, damage: 1, score: 1,
    elites: 0, extras: Object.freeze([]), repair: 35, plating: 10, siphon: 1, healingBudget: null }),
  veteran: Object.freeze({ title: 'Veteran', description: 'Suppression marks, two-phase guardians, burst-fire heat control · +50% points.',
    enemySpeed: 1.18, projectileSpeed: 1.38, cadence: .72, lead: .8, damage: 1.2, score: 1.5,
    elites: 1, extras: Object.freeze(['ranged', 'weaver']), repair: 24, plating: 7, siphon: .55, healingBudget: 8, heldCooling: .6, heatUnlock: 28, staminaRegen: 22 }),
  nightmare: Object.freeze({ title: 'Nightmare', description: 'Overlapping suppression, faster guardian second phases, scarce recovery · double points.',
    enemySpeed: 1.32, projectileSpeed: 1.62, cadence: .55, lead: 1, damage: 1.35, score: 2,
    elites: 2, extras: Object.freeze(['ranged', 'brute', 'weaver', 'ranged', 'weaver']), repair: 16, plating: 5, siphon: .35, healingBudget: 5, heldCooling: .5, heatUnlock: 22, staminaRegen: 20 }),
});
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
  ricochet: Object.freeze({ id: 'ricochet', title: 'Mirror rounds', description: 'Shots bounce off cover and arena walls. Each rank adds one bounce, up to two.' }),
  chain: Object.freeze({ id: 'chain', title: 'Arc conductor', description: 'Hits arc to nearby enemies for 40% damage. More ranks extend the chain; frost slows the whole chain.' }),
  siphon: Object.freeze({ id: 'siphon', title: 'Blood circuit', description: 'Every kill restores 1 health, up to 3. Chain and dash kills also feed the circuit.' }),
  frost: Object.freeze({ id: 'frost', title: 'Cryo rounds', description: 'Hits slow enemies for 1.2 seconds. More ranks deepen the chill; arcs inherit this effect.' }),
  pulse: Object.freeze({ id: 'pulse', title: 'Phase shock', description: 'Dashing unleashes a 100-radius shockwave for 16 damage. Ranks add damage and range; frozen foes take 50% more.' }),
  focus: Object.freeze({ id: 'focus', title: 'Afterimage lens', description: 'Your first shot after each dash deals 35% more damage and costs half heat. Ranks improve that bonus.' }),
  scatter: Object.freeze({ id: 'scatter', title: 'Triad chamber', description: 'Every fourth shot adds two side rounds for 55% damage. More ranks trigger every third shot; arcs and frost work on side rounds.' }),
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
  const radius = boss ? 30 : type === 'brute' ? 22 : type === 'ranged' ? 15 : type === 'weaver' ? 13 : 14;
  const scaling = Math.min(12, state.wave);
  const hp = boss ? [440, 620, 850, 1100][state.sector]
    : type === 'brute' ? 90 + scaling * 4 : type === 'ranged' ? 44 + scaling * 2 : type === 'weaver' ? 36 + scaling * 2 : 38 + scaling * 2;
  state.enemies.push({ id: ++state.enemyId, type, ...spawnPoint(state, radius), radius,
    hp, maxHp: hp, boss, speed: (boss ? 48 : type === 'brute' ? 64 : type === 'ranged' ? 100 : type === 'weaver' ? 140 : 94 + state.wave * 2) * DIFFICULTIES[state.difficulty].enemySpeed,
    phase: 'seeking', timer: 0, attackTimer: boss ? 1.4 : .6 + random(state) * .8, volleyIndex: 0,
    aimX: 1, aimY: 0, pattern: 0, attackName: boss ? SECTORS[state.sector].patterns[0] : type,
    bossSector: state.sector, bossName: boss ? SECTORS[state.sector].boss : null,
    elite: false, affix: null, armor: 0, slowTime: 0, slowFactor: 1,
    strafe: random(state) < .5 ? -1 : 1 });
}

function makeElite(state, enemy) {
  if (enemy.elite || enemy.boss) return;
  enemy.elite = true;
  enemy.affix = ['swift', 'armored', 'volatile'][Math.floor(random(state) * 3)];
  if (enemy.affix === 'swift') enemy.speed *= 1.25;
  if (enemy.affix === 'armored') { enemy.armor = .2; enemy.hp *= 1.3; enemy.maxHp = enemy.hp; }
}

function startWave(state, wave) {
  state.phase = 'playing';
  state.wave = wave;
  state.sector = Math.floor((wave - 1) / 5);
  state.sectorName = SECTORS[state.sector].name;
  state.waveKills = 0;
  state.waveHealing = 0;
  state.upgradeChoices = [];
  state.projectiles = [];
  state.hazards = [];
  state.player.dashTime = 0;
  state.player.invulnerable = Math.max(state.player.invulnerable, .8);
  state.player.heat = 0;
  state.player.overheated = false;
  state.player.fireCooldown = 0;
  state.player.stamina = state.player.maxStamina;
  state.player.focusReady = false;
  state.player.vx = 0; state.player.vy = 0;
  const composition = [
    [4, 0, 0, 0], [5, 2, 0, 0], [5, 2, 1, 0], [5, 3, 2, 0], [3, 2, 1, 0],
    [5, 3, 2, 2], [5, 3, 2, 3], [5, 4, 2, 3], [5, 4, 3, 4], [3, 2, 2, 2],
    [4, 3, 3, 4], [4, 4, 3, 4], [4, 4, 4, 4], [4, 5, 4, 4], [3, 2, 2, 3],
    [3, 5, 4, 5], [4, 4, 4, 6], [4, 5, 4, 6], [4, 5, 5, 6], [3, 2, 2, 3],
  ][wave - 1];
  for (let index = 0; index < composition[0]; index += 1) spawnEnemy(state, 'chaser');
  for (let index = 0; index < composition[1]; index += 1) spawnEnemy(state, 'ranged');
  for (let index = 0; index < composition[2]; index += 1) spawnEnemy(state, 'brute');
  for (let index = 0; index < composition[3]; index += 1) spawnEnemy(state, 'weaver');
  if (wave % 5 === 0) spawnEnemy(state, 'boss');
  if (state.waveRisk) { spawnEnemy(state, 'weaver'); state.overcharges += 1; }
  for (const type of DIFFICULTIES[state.difficulty].extras) {
    if (state.enemies.length >= MAX_ENEMIES) break;
    spawnEnemy(state, type);
  }
  const normals = state.enemies.filter(enemy => !enemy.boss);
  const eliteCount = Math.min(normals.length, state.sector + DIFFICULTIES[state.difficulty].elites + (state.waveRisk ? 2 : 0));
  for (let index = 0; index < eliteCount; index += 1) makeElite(state, normals[Math.floor(index * normals.length / Math.max(1, eliteCount))]);
  event(state, 'wave', { wave, sector: state.sector, enemies: state.enemies.length, risk: state.waveRisk });
}

export function createState({ random: source = Math.random, difficulty = 'standard' } = {}) {
  if (typeof source !== 'function') throw new TypeError('random must be a function');
  if (!Object.hasOwn(DIFFICULTIES, difficulty)) throw new RangeError('Choose Expedition, Veteran or Nightmare difficulty.');
  const state = {
    gameId: 'rift-survivor', phase: 'playing', pausedPhase: null, wave: 1, wavesCleared: 0,
    waveKills: 0, waveHealing: 0, kills: 0, score: 0, elapsed: 0, tick: 0, result: null,
    difficulty, sector: 0, sectorName: SECTORS[0].name, waveRisk: false, overcharges: 0,
    player: { x: ARENA.width / 2, y: ARENA.height / 2, radius: 12, vx: 0, vy: 0,
      hp: 100, maxHp: 100, stamina: 100, maxStamina: 100, aimX: 1, aimY: 0,
      heat: 0, maxHeat: 100, overheated: false, fireCooldown: 0, dashTime: 0,
      dashX: 1, dashY: 0, invulnerable: 0, damageCooldown: 0,
      moveSpeed: 230, damage: 22, fireInterval: .115, heatPerShot: 11,
      cooling: 28, staminaRegen: 25, dashCost: 34, staminaDelay: 0, dashHeld: false,
      ricochet: 0, chain: 0, siphon: 0, frost: 0, pulse: 0, focus: 0, scatter: 0,
      focusReady: false, shotsFired: 0 },
    enemies: [], enemyId: 0, projectiles: [], projectileId: 0,
    events: [], eventId: 0, upgrades: {}, upgradeChoices: [],
    hazards: [], hazardId: 0,
  };
  if (difficulty !== 'standard') state.player.staminaRegen = DIFFICULTIES[difficulty].staminaRegen;
  sources.set(state, source);
  startWave(state, 1);
  return state;
}

function projectile(state, owner, x, y, aimX, aimY, speed, damage, radius = 4, origin = null) {
  if (state.projectiles.length >= MAX_PROJECTILES) return;
  if (owner === 'enemy') speed *= DIFFICULTIES[state.difficulty].projectileSpeed;
  let bounces = owner === 'player' ? state.player.ricochet : 0;
  if (origin) {
    const dx = x - origin.x; const dy = y - origin.y;
    let first = 2; let cover = null;
    for (const rect of OBSTACLES) {
      const hit = coverHit(origin.x, origin.y, dx, dy, rect, radius);
      if (hit !== null && hit < first) { first = hit; cover = rect; }
    }
    if (cover) {
      if (bounces <= 0) return;
      x = origin.x + dx * first; y = origin.y + dy * first;
      const normal = unit(x - clamp(x, cover.x, cover.x + cover.width), y - clamp(y, cover.y, cover.y + cover.height));
      const dot = aimX * normal.x + aimY * normal.y;
      aimX -= 2 * dot * normal.x; aimY -= 2 * dot * normal.y;
      x += normal.x * .2; y += normal.y * .2; bounces -= 1;
      event(state, 'bounce', { x, y });
    }
  }
  if (x < radius || x > ARENA.width - radius || y < radius || y > ARENA.height - radius) {
    x = clamp(origin?.x ?? x, radius, ARENA.width - radius);
    y = clamp(origin?.y ?? y, radius, ARENA.height - radius);
  }
  state.projectiles.push({ id: ++state.projectileId, owner, x, y,
    vx: aimX * speed, vy: aimY * speed, damage, radius, life: owner === 'player' ? 1.6 : 4.5,
    bounces });
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
  damage *= DIFFICULTIES[state.difficulty].damage * (state.waveRisk ? 1.15 : 1);
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
  const player = state.player;
  const profile = DIFFICULTIES[state.difficulty];
  // Predict only when committing to an attack. The visible line stays locked,
  // so reversing direction after the tell defeats leading fire.
  const moving = length(player.vx, player.vy);
  const velocityScale = moving > player.moveSpeed ? player.moveSpeed / moving : 1;
  const speed = enemy.type === 'weaver' ? 340 : enemy.type === 'ranged' ? 225 + state.wave * 4 : 255;
  const horizon = enemy.type === 'brute' ? duration * .3
    : ['ranged', 'weaver', 'boss'].includes(enemy.type) ? Math.min(1.2, duration + distance(player, enemy) / (speed * profile.projectileSpeed)) : 0;
  const aim = unit(clamp(player.x + player.vx * velocityScale * horizon * profile.lead, player.radius, ARENA.width - player.radius) - enemy.x,
    clamp(player.y + player.vy * velocityScale * horizon * profile.lead, player.radius, ARENA.height - player.radius) - enemy.y);
  enemy.aimX = aim.x;
  enemy.aimY = aim.y;
  enemy.targetX = clamp(player.x + player.vx * velocityScale * duration * profile.lead, player.radius, ARENA.width - player.radius);
  enemy.targetY = clamp(player.y + player.vy * velocityScale * duration * profile.lead, player.radius, ARENA.height - player.radius);
  enemy.phase = 'windup';
  if (enemy.boss) enemy.attackName = SECTORS[enemy.bossSector ?? state.sector].patterns[enemy.pattern % 2];
  enemy.timer = duration;
  event(state, 'tell', { x: enemy.x, y: enemy.y, enemyId: enemy.id, enemyType: enemy.type, pattern: enemy.pattern });
}

function addHazard(state, kind, x, y, options = {}) {
  if (state.hazards.length >= 32) return;
  state.hazards.push({ id: ++state.hazardId, kind, x: clamp(x, 24, ARENA.width - 24),
    y: clamp(y, 24, ARENA.height - 24), radius: 64, width: 48,
    warning: .9, life: .25, damage: 14, struck: false, ...options });
  event(state, 'hazard', { x, y, kind });
}

function scorePoints(state, points) {
  state.score += Math.round(points * DIFFICULTIES[state.difficulty].score * (state.waveRisk ? 1.35 : 1));
}

function damageEnemy(state, target, amount, chain = true) {
  if (target.hp <= 0) return;
  const damage = amount * (1 - (target.armor || 0));
  target.hp = Math.max(0, target.hp - damage);
  if (state.player.frost > 0) {
    target.slowTime = state.difficulty !== 'standard' && target.boss ? .8 : 1.2;
    target.slowFactor = Math.max(state.difficulty !== 'standard' && target.boss ? .8 : state.difficulty !== 'standard' && target.elite ? .65 : 0, 1 - .15 * state.player.frost);
  }
  event(state, 'hit', { x: target.x, y: target.y, enemyId: target.id, damage });
  if (target.hp === 0) {
    state.kills += 1; state.waveKills += 1;
    scorePoints(state, (target.boss ? 1500 : target.type === 'brute' ? 180 : target.type === 'ranged' ? 130 : target.type === 'weaver' ? 150 : 100) + (target.elite ? 100 : 0));
    if (state.player.siphon) {
      const profile = DIFFICULTIES[state.difficulty];
      const budget = profile.healingBudget === null ? Infinity : Math.max(0, profile.healingBudget - state.waveHealing);
      const restored = Math.min(state.player.maxHp - state.player.hp, state.player.siphon * profile.siphon, budget);
      state.player.hp += restored; state.waveHealing += restored;
    }
    if (target.affix === 'volatile') addHazard(state, 'blast', target.x, target.y, { radius: 72, damage: 12, warning: .85 });
    event(state, 'kill', { x: target.x, y: target.y, enemyId: target.id, enemyType: target.type, elite: target.elite });
  }
  if (chain && state.player.chain > 0) {
    const visited = new Set([target.id]);
    let previous = target;
    for (let index = 0; index < state.player.chain; index += 1) {
      const next = state.enemies.filter(enemy => enemy.hp > 0 && !visited.has(enemy.id) && distance(previous, enemy) < 130)
        .sort((a, b) => distance(previous, a) - distance(previous, b))[0];
      if (!next) break;
      visited.add(next.id);
      event(state, 'arc', { x: previous.x, y: previous.y, toX: next.x, toY: next.y });
      damageEnemy(state, next, amount * .4, false);
      previous = next;
    }
  }
}

function bossAttack(state, enemy) {
  const name = enemy.attackName;
  if (state.difficulty !== 'standard' && enemy.hp < enemy.maxHp / 2) {
    // A second phase denies the predicted escape route, with a fresh complete
    // floor warning. The marks never follow the player after being placed.
    const player = state.player, lead = state.difficulty === 'nightmare' ? .85 : .65;
    const speed = length(player.vx, player.vy), scale = speed > player.moveSpeed ? player.moveSpeed / speed : 1;
    addHazard(state, 'blast', player.x + player.vx * scale * lead, player.y + player.vy * scale * lead, { radius: 60, warning: 1, damage: 12 });
    if (state.difficulty === 'nightmare') addHazard(state, 'blast', player.x, player.y, { radius: 52, warning: 1.1, damage: 12 });
  }
  if (name === 'radial') fireFan(state, enemy, 12, Math.PI * 2 / 12, 210, 14);
  if (name === 'fan') fireFan(state, enemy, 5, .14, 280, 14);
  if (name === 'mines' || name === 'fan-mines') {
    const target = { x: state.player.x, y: state.player.y };
    addHazard(state, 'blast', target.x, target.y, { radius: 72 });
    if (name === 'mines') {
      addHazard(state, 'blast', target.x + 140, target.y - 90, { radius: 62 });
      addHazard(state, 'blast', target.x - 140, target.y + 90, { radius: 62 });
    } else fireFan(state, enemy, 7, .13, 260, 12);
  }
  if (name === 'double-ring') {
    fireFan(state, enemy, 10, Math.PI * 2 / 10, 215, 12);
    enemy.phase = 'burst'; enemy.timer = .32;
    return;
  }
  if (name === 'cross') {
    const initial = Math.atan2(enemy.aimY, enemy.aimX);
    for (let index = 0; index < 4; index += 1) {
      const angle = initial + Math.PI / 2 * index;
      const aim = { x: Math.cos(angle), y: Math.sin(angle) };
      const original = { x: enemy.aimX, y: enemy.aimY };
      enemy.aimX = aim.x; enemy.aimY = aim.y;
      fireFan(state, enemy, 3, .09, 255, 13);
      enemy.aimX = original.x; enemy.aimY = original.y;
    }
  }
  if (name === 'rift-lanes') {
    addHazard(state, 'vertical', state.player.x, state.player.y, { width: 52, warning: 1.0, damage: 18 });
    addHazard(state, 'horizontal', state.player.x, state.player.y, { width: 52, warning: 1.0, damage: 18 });
    fireFan(state, enemy, 5, .2, 230, 12);
  }
  if (name === 'crown') {
    const aim = Math.atan2(enemy.aimY, enemy.aimX);
    // The bright gap faces the locked aim: staying composed beats panic dashes.
    for (let index = 2; index < 17; index += 1) {
      const angle = aim + index * Math.PI * 2 / 18;
      projectile(state, 'enemy', enemy.x + Math.cos(angle) * 36, enemy.y + Math.sin(angle) * 36,
        Math.cos(angle), Math.sin(angle), 240, 15, 5, enemy);
    }
    addHazard(state, 'blast', state.player.x, state.player.y, { radius: 58, warning: 1.0, damage: 12 });
  }
  enemy.pattern += 1;
  enemy.phase = 'recover'; enemy.timer = .5; enemy.attackTimer = 1.45 * DIFFICULTIES[state.difficulty].cadence * (state.difficulty !== 'standard' && enemy.hp < enemy.maxHp / 2 ? .8 : 1);
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

/** Shared by combat and warnings, including the alternating higher-tier fan. */
export function enemyShotPattern(state, enemy) {
  const veteran = state.difficulty !== 'standard';
  const wide = state.difficulty === 'nightmare' || veteran && (enemy.volleyIndex || 0) % 2 === 1;
  return enemy.type === 'weaver' ? { count: wide ? 2 : 1, spread: wide ? .13 : 0, speed: 340, damage: 8 }
    : { count: wide ? 5 : 3, spread: wide ? .13 : .16, speed: 225 + state.wave * 4, damage: 10 };
}

function updateEnemies(state, dt) {
  const cadence = DIFFICULTIES[state.difficulty].cadence;
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0 || state.phase !== 'playing') continue;
    enemy.attackTimer = Math.max(0, enemy.attackTimer - dt);
    enemy.slowTime = Math.max(0, (enemy.slowTime || 0) - dt);
    const speed = enemy.speed * (enemy.slowTime > 0 ? enemy.slowFactor : 1);
    const gap = distance(enemy, state.player);
    const chase = unit(state.player.x - enemy.x, state.player.y - enemy.y);
    if (enemy.phase === 'windup') {
      enemy.timer -= dt;
      if (enemy.timer > 0) continue;
      if (enemy.type === 'chaser') {
        if (gap < 57) hurtPlayer(state, 12, 'melee');
        enemy.phase = 'recover'; enemy.timer = .42; enemy.attackTimer = .5 * cadence;
        event(state, 'swipe', { x: enemy.x, y: enemy.y, enemyId: enemy.id });
      } else if (enemy.type === 'brute') {
        enemy.phase = 'charge'; enemy.timer = .65;
        event(state, 'charge', { x: enemy.x, y: enemy.y, enemyId: enemy.id });
      } else if (enemy.type === 'ranged' || enemy.type === 'weaver') {
        const shot = enemyShotPattern(state, enemy);
        fireFan(state, enemy, shot.count, shot.spread, shot.speed, shot.damage);
        enemy.volleyIndex = (enemy.volleyIndex || 0) + 1;
        if (state.difficulty !== 'standard' && state.wave >= 4 && enemy.elite && (state.difficulty === 'nightmare' || enemy.volleyIndex % 2 === 0)) {
          addHazard(state, 'blast', enemy.targetX ?? state.player.x, enemy.targetY ?? state.player.y, { radius: 58, warning: .95, damage: 10 });
        }
        enemy.phase = 'recover'; enemy.timer = enemy.type === 'ranged' ? .35 : .2;
        enemy.attackTimer = (enemy.type === 'ranged' ? 2 : 1.4) * cadence;
        if (enemy.type === 'weaver') enemy.strafe *= -1;
      } else bossAttack(state, enemy);
    } else if (enemy.phase === 'burst') {
      enemy.timer -= dt;
      if (enemy.timer <= 0) {
        const angle = Math.atan2(enemy.aimY, enemy.aimX) + Math.PI / 10;
        const original = { x: enemy.aimX, y: enemy.aimY };
        enemy.aimX = Math.cos(angle); enemy.aimY = Math.sin(angle);
        fireFan(state, enemy, 10, Math.PI * 2 / 10, 240, 12);
        enemy.aimX = original.x; enemy.aimY = original.y;
        enemy.pattern += 1; enemy.phase = 'recover'; enemy.timer = .5; enemy.attackTimer = 1.5 * cadence * (state.difficulty !== 'standard' && enemy.hp < enemy.maxHp / 2 ? .8 : 1);
      }
    } else if (enemy.phase === 'charge') {
      const before = { x: enemy.x, y: enemy.y };
      const charge = chargeSpeed(state, enemy);
      moveBody(enemy, enemy.aimX * charge * dt, enemy.aimY * charge * dt);
      if (gap < enemy.radius + state.player.radius + 8) hurtPlayer(state, 18, 'charge');
      enemy.timer -= dt;
      if (enemy.timer <= 0 || distance(before, enemy) < charge * dt * .35) {
        enemy.phase = 'recover'; enemy.timer = .7; enemy.attackTimer = 1.2 * cadence;
      }
    } else if (enemy.phase === 'recover') {
      enemy.timer -= dt;
      if (enemy.timer <= 0) enemy.phase = 'seeking';
    } else if (enemy.type === 'chaser') {
      if (gap < 54 && enemy.attackTimer <= 0) beginTell(state, enemy, .32);
      else { const direction = pursuit(enemy, state.player, dt); moveBody(enemy, direction.x * speed * dt, direction.y * speed * dt); }
    } else if (enemy.type === 'brute') {
      if (gap < 390 && enemy.attackTimer <= 0) beginTell(state, enemy, .8);
      else { const direction = pursuit(enemy, state.player, dt); moveBody(enemy, direction.x * speed * dt, direction.y * speed * dt); }
    } else if (enemy.type === 'ranged') {
      const visible = lineClear(enemy, state.player, 5);
      if (enemy.attackTimer <= 0 && visible) beginTell(state, enemy, .6);
      else if (!visible) { const direction = pursuit(enemy, state.player, dt); moveBody(enemy, direction.x * speed * dt, direction.y * speed * dt); }
      else {
        const direction = gap > 320 ? 1 : gap < 220 ? -1 : 0;
        moveBody(enemy, chase.x * speed * dt * direction, chase.y * speed * dt * direction);
      }
    } else if (enemy.type === 'weaver') {
      const visible = lineClear(enemy, state.player, 5);
      if (visible && enemy.attackTimer <= 0) beginTell(state, enemy, .42);
      else if (!visible) { const direction = pursuit(enemy, state.player, dt); moveBody(enemy, direction.x * speed * dt, direction.y * speed * dt); }
      else {
        const approach = gap > 310 ? .7 : gap < 180 ? -.7 : 0;
        const direction = unit(chase.x * approach - chase.y * enemy.strafe, chase.y * approach + chase.x * enemy.strafe);
        moveBody(enemy, direction.x * speed * dt, direction.y * speed * dt);
      }
    } else {
      const visible = lineClear(enemy, state.player, 5);
      if (enemy.attackTimer <= 0 && visible) beginTell(state, enemy, .9);
      else if (gap > 250 || !visible) { const direction = pursuit(enemy, state.player, dt); moveBody(enemy, direction.x * speed * dt, direction.y * speed * dt); }
      if (gap < enemy.radius + state.player.radius + 2) hurtPlayer(state, 16, 'boss');
    }
  }
}

export function chargeSpeed(state, enemy) {
  return (350 + Math.min(state.wave, 12) * 4) * DIFFICULTIES[state.difficulty].enemySpeed
    * (enemy.affix === 'swift' ? 1.2 : 1) * (enemy.slowTime > 0 ? enemy.slowFactor : 1);
}

function updateHazards(state, dt) {
  state.hazards = state.hazards.filter(hazard => {
    if (hazard.warning > 0) { hazard.warning = Math.max(0, hazard.warning - dt); return true; }
    hazard.life -= dt;
    if (hazard.life <= 0) return false;
    const player = state.player;
    const touches = hazard.kind === 'vertical' ? Math.abs(player.x - hazard.x) < hazard.width / 2 + player.radius
      : hazard.kind === 'horizontal' ? Math.abs(player.y - hazard.y) < hazard.width / 2 + player.radius
        : distance(player, hazard) < hazard.radius + player.radius;
    if (touches && !hazard.struck) { hazard.struck = true; hurtPlayer(state, hazard.damage, 'floor-hazard'); }
    return true;
  });
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
    let hitCover = null;
    let normal = null;
    for (const rect of OBSTACLES) {
      const hit = coverHit(shot.x, shot.y, dx, dy, rect, shot.radius);
      if (hit !== null && hit < first) { first = hit; target = 'cover'; hitCover = rect; }
    }
    for (const [origin, delta, limit, nx, ny] of [
      [shot.x, dx, shot.radius, 1, 0], [shot.x, dx, ARENA.width - shot.radius, -1, 0],
      [shot.y, dy, shot.radius, 0, 1], [shot.y, dy, ARENA.height - shot.radius, 0, -1],
    ]) {
      if (delta * (nx || ny) >= 0) continue;
      const hit = (limit - origin) / delta;
      if (hit >= 0 && hit <= 1 && hit < first) { first = hit; target = 'wall'; normal = { x: nx, y: ny }; hitCover = null; }
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
      if ((target === 'cover' || target === 'wall') && shot.owner === 'player' && shot.bounces > 0) {
        const x = shot.x + dx * first;
        const y = shot.y + dy * first;
        if (hitCover) normal = unit(x - clamp(x, hitCover.x, hitCover.x + hitCover.width), y - clamp(y, hitCover.y, hitCover.y + hitCover.height));
        const dot = shot.vx * normal.x + shot.vy * normal.y;
        shot.vx -= 2 * dot * normal.x; shot.vy -= 2 * dot * normal.y;
        shot.x = x + normal.x * .2; shot.y = y + normal.y * .2;
        shot.bounces -= 1;
        remaining.push(shot);
        event(state, 'bounce', { x, y });
      } else if (target === 'player') hurtPlayer(state, shot.damage, 'projectile');
      else if (target !== 'cover' && target !== 'wall') damageEnemy(state, target, shot.damage);
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
            : id === 'plating' ? player.maxHp < 130
              : ['ricochet', 'scatter'].includes(id) ? player[id] < 2
                : ['chain', 'siphon', 'frost', 'pulse', 'focus'].includes(id) ? player[id] < 3 : false;
}

function clearWave(state) {
  state.wavesCleared = state.wave;
  scorePoints(state, state.wave * 300);
  state.projectiles = [];
  state.hazards = [];
  state.player.dashTime = 0;
  state.player.dashHeld = false;
  event(state, 'clear', { wave: state.wave });
  if (state.wave === TOTAL_WAVES) {
    state.phase = 'won'; state.result = 'rift-sealed';
    scorePoints(state, Math.round(state.player.hp) * 10);
    event(state, 'victory');
  } else {
    const choices = Object.keys(UPGRADES).filter(id => upgradeAvailable(state, id));
    // Twelve capped progression choices leave a broad build pool even late.
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
  const profile = DIFFICULTIES[state.difficulty];
  const cooling = player.cooling * (inputs.fire === true ? profile.heldCooling ?? 1 : 1);
  player.heat = Math.max(0, player.heat - cooling * dt);
  if (player.overheated && player.heat <= (profile.heatUnlock ?? 35)) player.overheated = false;
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
  const previousX = player.x; const previousY = player.y;
  if (dash && !player.dashHeld && player.dashTime <= 0 && player.stamina >= player.dashCost) {
    const direction = length(movement.x, movement.y) > .05
      ? unit(movement.x, movement.y) : { x: player.aimX, y: player.aimY };
    player.dashX = direction.x; player.dashY = direction.y;
    player.dashTime = .16; player.invulnerable = Math.max(player.invulnerable, .18);
    player.stamina -= player.dashCost; player.staminaDelay = .7;
    player.focusReady = player.focus > 0;
    event(state, 'dash');
    if (player.pulse > 0) {
      const radius = 100 + (player.pulse - 1) * 20;
      event(state, 'pulse', { radius });
      for (const enemy of state.enemies) if (distance(player, enemy) < radius + enemy.radius) {
        damageEnemy(state, enemy, (16 + (player.pulse - 1) * 8) * (enemy.slowTime > 0 ? 1.5 : 1), false);
      }
    }
  }
  player.dashHeld = dash;
  if (player.dashTime > 0) {
    const activeTime = Math.min(dt, player.dashTime);
    moveBody(player, player.dashX * 620 * activeTime, player.dashY * 620 * activeTime);
    player.dashTime = Math.max(0, player.dashTime - dt);
  } else moveBody(player, movement.x * player.moveSpeed * dt, movement.y * player.moveSpeed * dt);
  player.vx = (player.x - previousX) / dt; player.vy = (player.y - previousY) / dt;
  if (player.staminaDelay === 0) player.stamina = Math.min(player.maxStamina, player.stamina + player.staminaRegen * dt);
  if (inputs.fire === true && player.fireCooldown <= 0 && !player.overheated) {
    const focused = player.focusReady;
    const damage = player.damage * (focused ? 1 + .35 * player.focus : 1);
    projectile(state, 'player', player.x + player.aimX * (player.radius + 6),
      player.y + player.aimY * (player.radius + 6), player.aimX, player.aimY, 780, damage, 4, player);
    player.shotsFired += 1;
    if (player.scatter > 0 && player.shotsFired % (player.scatter > 1 ? 3 : 4) === 0) {
      const direction = Math.atan2(player.aimY, player.aimX);
      for (const offset of [-.22, .22]) {
        const x = Math.cos(direction + offset); const y = Math.sin(direction + offset);
        projectile(state, 'player', player.x + x * (player.radius + 6), player.y + y * (player.radius + 6), x, y, 780, damage * .55, 4, player);
      }
    }
    player.focusReady = false;
    player.fireCooldown = player.fireInterval;
    player.heat = Math.min(player.maxHeat, player.heat + player.heatPerShot * (focused ? .5 : 1));
    if (player.heat >= player.maxHeat) { player.overheated = true; event(state, 'overheat'); }
  }
  updateEnemies(state, dt);
  updateProjectiles(state, dt);
  if (state.phase === 'playing') updateHazards(state, dt);
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

export function chooseUpgrade(state, id, options = {}) {
  if (state.phase !== 'upgrade') return { ok: false, error: 'Choose an upgrade between waves.' };
  if (!state.upgradeChoices.includes(id) || !upgradeAvailable(state, id)) return { ok: false, error: 'Choose one of the offered upgrades.' };
  const player = state.player;
  if (id === 'repair') player.hp = Math.min(player.maxHp, player.hp + DIFFICULTIES[state.difficulty].repair);
  if (id === 'damage') player.damage = Math.min(46, player.damage + 6);
  if (id === 'cooling') { player.cooling = Math.min(52, player.cooling + 8); player.heatPerShot = Math.max(7, player.heatPerShot - 1); }
  if (id === 'mobility') player.moveSpeed = Math.min(310, player.moveSpeed + 20);
  if (id === 'battery') { player.maxStamina = Math.min(145, player.maxStamina + 15); player.staminaRegen = Math.min(37, player.staminaRegen + 4); }
  if (id === 'plating') { player.maxHp = Math.min(130, player.maxHp + 10); player.hp = Math.min(player.maxHp, player.hp + DIFFICULTIES[state.difficulty].plating); }
  if (['ricochet', 'scatter'].includes(id)) player[id] = Math.min(2, player[id] + 1);
  if (['chain', 'siphon', 'frost', 'pulse', 'focus'].includes(id)) player[id] = Math.min(3, player[id] + 1);
  state.upgrades[id] = (state.upgrades[id] || 0) + 1;
  event(state, 'upgrade', { upgrade: id });
  state.waveRisk = options?.risk === true;
  startWave(state, state.wave + 1);
  return { ok: true };
}
