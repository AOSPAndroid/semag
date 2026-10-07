/** Starfall Squadron: deterministic, fixed-step bullet-hell campaign. */
export const ARENA = Object.freeze({ width: 480, height: 600 });
export const HITBOX = 3;
export const LIMITS = Object.freeze({ enemies: 9, hostileShots: 420, friendlyShots: 110, warnings: 16, events: 30 });
export const DIFFICULTIES = Object.freeze({
  standard: Object.freeze({ title: 'Standard', hull: 5, bombs: 3, speed: 0.82, density: 0.82, hp: 0.84, waveTime: 24 }),
  veteran: Object.freeze({ title: 'Veteran', hull: 3, bombs: 2, speed: 1, density: 1, hp: 1, waveTime: 28 }),
  nightmare: Object.freeze({ title: 'Nightmare', hull: 2, bombs: 2, speed: 1.18, density: 1.2, hp: 1.18, waveTime: 30 }),
});
export const STAGES = Object.freeze([
  { name: 'Breakwater', region: 'ORBITAL COAST', regionId: 0, guardian: 'Harbor Wasp', bossType: 'wasp', palette: ['#091a2c', '#173b4a', '#5adaca'] },
  { name: 'Night Anchorage', region: 'ORBITAL COAST', regionId: 0, guardian: 'Tide Engine', bossType: 'tide', palette: ['#0d1d32', '#234453', '#72d9d0'] },
  { name: 'Scrap Meridian', region: 'RUST HALO', regionId: 1, guardian: 'Cinder Manta', bossType: 'manta', palette: ['#221521', '#4c2d30', '#f39c69'] },
  { name: 'Foundry Reach', region: 'RUST HALO', regionId: 1, guardian: 'Kiln Monarch', bossType: 'kiln', palette: ['#231823', '#563731', '#f4b971'] },
  { name: 'Prism Passage', region: 'GLASS CITADEL', regionId: 2, guardian: 'Mirror Seraph', bossType: 'seraph', palette: ['#19132f', '#3b2f5d', '#b9a4f1'] },
  { name: 'The Last Beacon', region: 'GLASS CITADEL', regionId: 2, guardian: 'Crown of Ash', bossType: 'crown', palette: ['#181428', '#453254', '#f3b0d4'] },
].map(Object.freeze));
export const UPGRADES = Object.freeze({
  lance: Object.freeze({ title: 'Needle reactor', label: 'FOCUSED DAMAGE', detail: 'Focused lance damage +25%. Precision wins guardian fights.', cap: 3 }),
  wings: Object.freeze({ title: 'Wing batteries', label: 'WIDE FIRE', detail: 'Add a pair of angled guns. Sweep escorts; keep focus for a straight lance.', cap: 2 }),
  cadence: Object.freeze({ title: 'Pulse coupler', label: 'FIRE RATE', detail: 'All guns fire 15% faster. More pressure without changing your movement.', cap: 3 }),
  thrusters: Object.freeze({ title: 'Vector fins', label: 'HANDLING', detail: 'Free-flight speed +12%; focus speed +8%. Reach the next gap sooner.', cap: 2 }),
  patch: Object.freeze({ title: 'Field repair', label: 'ONE REPAIR', detail: 'Restore one hull point. Available once in the whole campaign.', cap: 1 }),
  bomb: Object.freeze({ title: 'Nova cartridge', label: 'ONE BOMB', detail: 'Carry one extra bomb. Clears shots, deals damage and buys one second.', cap: 2 }),
  graze: Object.freeze({ title: 'Risk lens', label: 'SCORE BUILD', detail: 'Grazing earns 50% more points and holds your chain one second longer.', cap: 2 }),
});
const TAU = Math.PI * 2;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const finite = (n, fallback = 0) => typeof n === 'number' && Number.isFinite(n) ? n : fallback;
const angularDistance = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const tier = state => DIFFICULTIES[state.difficulty];

function random(state) {
  state.rng = (Math.imul(state.rng, 1664525) + 1013904223) >>> 0;
  return state.rng / 4294967296;
}
function emit(state, type, x, y, extra = {}) {
  state.eventId += 1;
  state.events.push({ id: state.eventId, type, x, y, ...extra });
  if (state.events.length > LIMITS.events) state.events.shift();
}

/** Earliest contact of two circles following linear paths, including tangency. */
export function sweptCircle(ax0, ay0, ax1, ay1, bx0, by0, bx1, by1, radius) {
  const x = ax0 - bx0; const y = ay0 - by0;
  const vx = ax1 - ax0 - (bx1 - bx0); const vy = ay1 - ay0 - (by1 - by0);
  const c = x * x + y * y - radius * radius;
  if (c <= 1e-9) return 0;
  const a = vx * vx + vy * vy;
  if (a < 1e-12) return null;
  const b = 2 * (x * vx + y * vy);
  const discriminant = b * b - 4 * a * c;
  if (discriminant < -1e-9) return null;
  const t = (-b - Math.sqrt(Math.max(0, discriminant))) / (2 * a);
  return t >= -1e-9 && t <= 1 + 1e-9 ? clamp(t, 0, 1) : null;
}

/** Patterns have explicit angular gaps; the view draws the same stored directions. */
export function patternDirections(kind, aim, { stage = 1, phase = 1, density = 1, spin = 0 } = {}) {
  if (kind === 'aim') {
    const count = stage >= 3 ? 5 : 3;
    return Array.from({ length: count }, (_, i) => aim + (i - (count - 1) / 2) * .17);
  }
  if (kind === 'fan') {
    const count = Math.round((7 + stage) * density);
    return Array.from({ length: count }, (_, i) => Math.PI / 2 - .94 + i * 1.88 / Math.max(1, count - 1) + spin);
  }
  if (kind === 'cross') {
    const count = Math.round((14 + phase * 2) * density);
    return Array.from({ length: count }, (_, i) => i * TAU / count + spin)
      .filter(angle => angularDistance(angle, aim) > .26);
  }
  const count = Math.round((18 + stage * 2 + phase * 2) * density);
  return Array.from({ length: count }, (_, i) => i * TAU / count + spin)
    .filter(angle => angularDistance(angle, aim) > .34);
}

export function createState({ difficulty = 'veteran', seed = 1729 } = {}) {
  difficulty = Object.hasOwn(DIFFICULTIES, difficulty) ? difficulty : 'veteran';
  const numericSeed = typeof seed === 'string' ? [...seed].reduce((n, c) => Math.imul(n ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261) : finite(seed, 1729) >>> 0;
  const settings = DIFFICULTIES[difficulty];
  return {
    gameId: 'starfall-squadron', difficulty, seed: numericSeed, rng: numericSeed,
    phase: 'playing', resumePhase: null, result: null, stage: 1, stagesCleared: 0,
    time: 0, stageTime: 0, spawnTimer: .65, spawnIndex: 0, guardianSpawned: false,
    score: 0, kills: 0, grazes: 0, chain: 0, chainTime: 0, bestChain: 0, bombHeld: false,
    player: { x: 240, y: 502, radius: HITBOX, hull: settings.hull, maxHull: settings.hull, bombs: settings.bombs, invulnerable: 1.2, fireTimer: 0, focus: false },
    build: Object.fromEntries(Object.keys(UPGRADES).map(id => [id, 0])),
    enemies: [], hostileShots: [], friendlyShots: [], warnings: [], upgradeChoices: [],
    events: [], eventId: 0, nextId: 1,
  };
}

function spawnEscort(state) {
  // Reserve one actor slot for the stage guardian; every array has a hard cap.
  if (state.enemies.length >= LIMITS.enemies - 1) return;
  const index = state.spawnIndex++;
  const type = ['skiff', 'drone', 'weaver', 'drone', 'skiff', 'weaver'][(index + state.stage) % 6];
  const x = 48 + random(state) * 384;
  const hp = Math.round((type === 'weaver' ? 31 : type === 'skiff' ? 23 : 17) * tier(state).hp * (1 + .06 * state.stage));
  state.enemies.push({ id: state.nextId++, type, x, y: -28, baseX: x, age: 0,
    radius: type === 'weaver' ? 18 : 13, hp, maxHp: hp, fireTimer: 1.8 + random(state) * .45, pattern: 0,
    speed: 48 + state.stage * 3, swing: (random(state) < .5 ? -1 : 1) * (type === 'weaver' ? 38 : 18), phase: 1 });
}
function spawnGuardian(state) {
  state.guardianSpawned = true;
  const hp = Math.round((480 + state.stage * 95 + (state.stage === 6 ? 390 : 0)) * tier(state).hp);
  state.enemies.push({ id: state.nextId++, type: STAGES[state.stage - 1].bossType, boss: true,
    x: 240, y: -55, baseX: 240, age: 0, radius: state.stage === 6 ? 36 : 31,
    hp, maxHp: hp, fireTimer: 2, pattern: 0, phase: 1, speed: 0, swing: 0 });
  emit(state, 'guardian', 240, 105, { name: STAGES[state.stage - 1].guardian });
}
function warning(state, enemy) {
  if (state.warnings.length >= LIMITS.warnings) return;
  const phase = enemy.phase || 1;
  const aim = Math.atan2(state.player.y - enemy.y, state.player.x - enemy.x);
  const pattern = enemy.pattern++;
  let kind;
  if (!enemy.boss) kind = enemy.type === 'drone' ? 'aim' : enemy.type === 'skiff' ? 'fan' : pattern % 2 ? 'aim' : 'fan';
  else if (state.stage === 6) kind = ['ring', 'aim', 'fan', 'cross'][(pattern + phase - 1) % 4];
  else kind = ['aim', 'fan', state.stage >= 3 ? 'cross' : 'ring'][pattern % 3];
  const spin = kind === 'fan' ? Math.sin(pattern * 1.7) * .18 : pattern * .24;
  const directions = patternDirections(kind, aim, { stage: state.stage, phase, density: tier(state).density, spin });
  const tell = enemy.boss ? .72 : .52;
  state.warnings.push({ id: state.nextId++, sourceId: enemy.id, x: enemy.x, y: enemy.y,
    kind, aim, spin, directions, remaining: tell, duration: tell,
    speed: (enemy.boss ? 142 + state.stage * 8 + phase * 9 : 134 + state.stage * 8) * tier(state).speed,
    radius: kind === 'cross' ? 4 : 4.5, boss: Boolean(enemy.boss) });
}
function shot(state, warning, angle) {
  if (state.hostileShots.length >= LIMITS.hostileShots) return;
  const radius = warning.radius;
  state.hostileShots.push({ id: state.nextId++, x: warning.x + Math.cos(angle) * 10, y: warning.y + Math.sin(angle) * 10,
    vx: Math.cos(angle) * warning.speed, vy: Math.sin(angle) * warning.speed, radius, age: 0,
    kind: warning.kind, grazed: false });
}
function firePlayer(state, focused) {
  const player = state.player;
  const damage = focused ? 4 * (1 + state.build.lance * .25) : 1.8;
  const add = (dx, vx, value) => {
    if (state.friendlyShots.length < LIMITS.friendlyShots) state.friendlyShots.push({ id: state.nextId++,
      x: player.x + dx, y: player.y - 16, vx, vy: -650, radius: 2.5, damage: value, focus: focused });
  };
  if (focused) add(0, 0, damage);
  else {
    add(-7, 0, damage); add(7, 0, damage);
    for (let wing = 1; wing <= state.build.wings; wing += 1) {
      add(-11 - wing * 3, -75 * wing, 1.2); add(11 + wing * 3, 75 * wing, 1.2);
    }
  }
  player.fireTimer += .11 / (1 + state.build.cadence * .15);
}
function hurtPlayer(state, x, y, remainingFrame = 0) {
  const player = state.player;
  if (player.invulnerable > 0 || state.phase !== 'playing') return;
  player.hull -= 1; player.invulnerable = Math.max(0, 1.6 - remainingFrame);
  state.chain = 0; state.chainTime = 0;
  emit(state, 'hit', x, y);
  if (player.hull <= 0) { player.hull = 0; state.phase = 'lost'; state.result = 'destroyed'; state.warnings = []; }
}
function killEnemy(state, enemy) {
  if (enemy.dead) return;
  enemy.dead = true; state.kills += 1;
  state.score += enemy.boss ? 2000 + state.stage * 500 : enemy.type === 'weaver' ? 180 : 120;
  emit(state, 'destroy', enemy.x, enemy.y, { boss: Boolean(enemy.boss) });
  state.warnings = state.warnings.filter(item => item.sourceId !== enemy.id);
}
function useBomb(state) {
  if (state.player.bombs <= 0) return false;
  state.player.bombs -= 1;
  state.player.invulnerable = Math.max(state.player.invulnerable, 1);
  state.hostileShots = []; state.warnings = [];
  for (const enemy of state.enemies) {
    enemy.hp -= enemy.boss ? 150 : 100;
    if (enemy.hp <= 0) killEnemy(state, enemy);
  }
  emit(state, 'bomb', state.player.x, state.player.y);
  return true;
}
function finishStage(state) {
  state.stagesCleared = state.stage;
  state.score += 1200 + state.player.hull * 200;
  state.hostileShots = []; state.friendlyShots = []; state.warnings = []; state.enemies = [];
  state.chainTime = 0; state.chain = 0;
  if (state.stage === STAGES.length) {
    state.phase = 'won'; state.result = 'campaign';
    state.score += state.player.hull * 1000 + state.player.bombs * 500;
    emit(state, 'victory', state.player.x, state.player.y);
    return;
  }
  state.phase = 'upgrade';
  // Fixed themed offers prevent save-scumming and make all six-stage builds viable.
  const priorities = [
    ['lance', 'wings', 'patch'], ['cadence', 'thrusters', 'bomb'], ['lance', 'graze', 'patch'],
    ['wings', 'cadence', 'bomb'], ['lance', 'thrusters', 'patch'],
  ][state.stage - 1];
  const available = id => state.build[id] < UPGRADES[id].cap && (id !== 'patch' || state.player.hull < state.player.maxHull);
  const choices = priorities.filter(available);
  for (const id of Object.keys(UPGRADES)) if (choices.length < 3 && available(id) && !choices.includes(id)) choices.push(id);
  state.upgradeChoices = choices.slice(0, 3);
  emit(state, 'clear', state.player.x, state.player.y, { stage: state.stage });
}

/** Inputs use normalized moveX/moveY or strict boolean directions. Bomb is edge-triggered. */
export function step(state, inputs = {}, dt = 1 / 120) {
  if (state.phase !== 'playing') return state;
  dt = typeof dt === 'number' && Number.isFinite(dt) && dt > 0 ? Math.min(dt, 1 / 30) : 0;
  if (!dt) return state;
  const player = state.player;
  let protectionUntil = player.invulnerable;
  const oldPlayer = { x: player.x, y: player.y };
  const enemyOld = new Map(state.enemies.map(enemy => [enemy.id, { x: enemy.x, y: enemy.y }]));
  const hostileIds = new Set(state.hostileShots.map(item => item.id));
  const friendlyIds = new Set(state.friendlyShots.map(item => item.id));
  state.time += dt; state.stageTime += dt;
  player.invulnerable = Math.max(0, player.invulnerable - dt);
  player.focus = inputs.focus === true;
  let mx = finite(inputs.moveX, (inputs.right === true ? 1 : 0) - (inputs.left === true ? 1 : 0));
  let my = finite(inputs.moveY, (inputs.down === true ? 1 : 0) - (inputs.up === true ? 1 : 0));
  const length = Math.hypot(mx, my);
  if (length > 1) { mx /= length; my /= length; }
  const speed = player.focus ? 105 * (1 + state.build.thrusters * .08) : 245 * (1 + state.build.thrusters * .12);
  player.x = clamp(player.x + mx * speed * dt, 14, ARENA.width - 14);
  player.y = clamp(player.y + my * speed * dt, 38, ARENA.height - 22);
  const bomb = inputs.bomb === true;
  if (bomb && !state.bombHeld && useBomb(state)) protectionUntil = Math.max(protectionUntil, 1);
  state.bombHeld = bomb;
  player.fireTimer -= dt;
  if (inputs.fire === true && player.fireTimer <= 0) firePlayer(state, player.focus);
  else if (player.fireTimer < 0) player.fireTimer = 0;
  state.chainTime = Math.max(0, state.chainTime - dt);
  if (state.chainTime === 0) state.chain = 0;

  state.spawnTimer -= dt;
  if (!state.guardianSpawned && state.stageTime < tier(state).waveTime - 3 && state.spawnTimer <= 0) {
    spawnEscort(state);
    state.spawnTimer += Math.max(1.05, 1.85 - state.stage * .09) / tier(state).density;
  }
  if (!state.guardianSpawned && state.stageTime >= tier(state).waveTime) spawnGuardian(state);

  for (const enemy of state.enemies) {
    if (enemy.dead) continue;
    enemy.age += dt;
    if (enemy.boss) {
      enemy.y = Math.min(102, enemy.y + 78 * dt);
      if (enemy.age > 2) enemy.x = 240 + Math.sin((enemy.age - 2) * (state.stage === 6 ? .53 : .63)) * (state.stage === 6 ? 135 : 145);
      const nextPhase = state.stage === 6 ? enemy.hp / enemy.maxHp > .67 ? 1 : enemy.hp / enemy.maxHp > .34 ? 2 : 3 : enemy.hp / enemy.maxHp > .5 ? 1 : 2;
      if (nextPhase !== enemy.phase) {
        enemy.phase = nextPhase;
        // Phase transitions announce the new pattern without erasing surviving shots.
        emit(state, 'phase', enemy.x, enemy.y, { phase: enemy.phase });
        enemy.fireTimer = Math.max(enemy.fireTimer, .75);
      }
    } else {
      enemy.y += enemy.speed * dt;
      enemy.x = clamp(enemy.baseX + Math.sin(enemy.age * 1.45) * enemy.swing, 24, ARENA.width - 24);
    }
    if (enemy.y > -8 && enemy.y < ARENA.height - 80) {
      enemy.fireTimer -= dt;
      if (enemy.fireTimer <= 0) {
        warning(state, enemy);
        const pressure = enemy.boss ? Math.min(.28, Math.max(0, enemy.age - 45) / 120) : 0;
        enemy.fireTimer += (enemy.boss ? Math.max(1, 1.85 - state.stage * .06 - (enemy.phase - 1) * .16 - pressure) : 2.6) / tier(state).density;
      }
    }
  }

  // A telegraph follows its source until the shot is born; its locked aim never tracks the pilot.
  for (const item of state.warnings) {
    const source = state.enemies.find(enemy => enemy.id === item.sourceId && !enemy.dead);
    if (!source) { item.remaining = -1; continue; }
    item.x = source.x; item.y = source.y; item.remaining -= dt;
    if (item.remaining <= 0) {
      for (const angle of item.directions) shot(state, item, angle);
      emit(state, 'volley', item.x, item.y, { kind: item.kind });
    }
  }
  state.warnings = state.warnings.filter(item => item.remaining > 0);

  // Existing shots share actor motion. New shots test only final positions: no retrospective hits.
  const contacts = [];
  for (const bullet of state.hostileShots) {
    const oldX = bullet.x; const oldY = bullet.y;
    const existing = hostileIds.has(bullet.id);
    if (existing) { bullet.x += bullet.vx * dt; bullet.y += bullet.vy * dt; bullet.age += dt; }
    const px = existing ? oldPlayer.x : player.x; const py = existing ? oldPlayer.y : player.y;
    const hit = sweptCircle(oldX, oldY, bullet.x, bullet.y, px, py, player.x, player.y, HITBOX + bullet.radius);
    if (hit !== null) contacts.push({ type: 'hostile', t: existing ? hit : 1, bullet, x: oldX + (bullet.x - oldX) * hit, y: oldY + (bullet.y - oldY) * hit });
    else if (!bullet.grazed) {
      const graze = sweptCircle(oldX, oldY, bullet.x, bullet.y, px, py, player.x, player.y, 19 + bullet.radius);
      if (graze !== null) contacts.push({ type: 'graze', t: existing ? graze : 1, bullet });
    }
  }
  // Enemy ramming uses the same tiny pilot core; the decorative wings cannot cause damage.
  for (const enemy of state.enemies) {
    if (enemy.dead) continue;
    const old = enemyOld.get(enemy.id);
    const contact = sweptCircle(old ? oldPlayer.x : player.x, old ? oldPlayer.y : player.y, player.x, player.y,
      old?.x ?? enemy.x, old?.y ?? enemy.y, enemy.x, enemy.y, HITBOX + enemy.radius);
    if (contact !== null) contacts.push({ type: 'ram', t: old ? contact : 1, enemy,
      x: oldPlayer.x + (player.x - oldPlayer.x) * contact, y: oldPlayer.y + (player.y - oldPlayer.y) * contact });
  }

  for (const bullet of state.friendlyShots) {
    const oldX = bullet.x; const oldY = bullet.y;
    const existing = friendlyIds.has(bullet.id);
    if (existing) { bullet.x += bullet.vx * dt; bullet.y += bullet.vy * dt; }
    for (const enemy of state.enemies) {
      if (enemy.dead) continue;
      const old = existing ? enemyOld.get(enemy.id) || enemy : enemy;
      const contact = sweptCircle(oldX, oldY, bullet.x, bullet.y, old.x, old.y, enemy.x, enemy.y, bullet.radius + enemy.radius);
      if (contact !== null) contacts.push({ type: 'friendly', t: existing ? contact : 1, enemy, bullet,
        x: oldX + (bullet.x - oldX) * contact, y: oldY + (bullet.y - oldY) * contact });
    }
  }
  // Shared ordering prevents a destroyed escort ramming the pilot later in the same frame.
  const rank = { friendly: 0, hostile: 1, ram: 2, graze: 3 };
  contacts.sort((a, b) => a.t - b.t || rank[a.type] - rank[b.type]
    || (a.bullet?.id ?? a.enemy.id) - (b.bullet?.id ?? b.enemy.id) || (a.enemy?.id ?? 0) - (b.enemy?.id ?? 0));
  for (const contact of contacts) {
    if (state.phase !== 'playing') break;
    if (contact.bullet?.dead || contact.enemy?.dead) continue;
    const protectedAtContact = protectionUntil > contact.t * dt + 1e-10;
    if (contact.type === 'friendly') {
      contact.bullet.dead = true; contact.enemy.hp -= contact.bullet.damage;
      emit(state, 'spark', contact.x, contact.y);
      if (contact.enemy.hp <= 0) killEnemy(state, contact.enemy);
    } else if (contact.type === 'hostile' || contact.type === 'ram') {
      if (contact.bullet) contact.bullet.dead = true;
      if (!protectedAtContact) {
        // The final timer can already be zero even though protection covered an earlier contact.
        player.invulnerable = 0;
        hurtPlayer(state, contact.x, contact.y, (1 - contact.t) * dt);
        protectionUntil = contact.t * dt + 1.6;
      }
    } else if (!protectedAtContact) {
      contact.bullet.grazed = true; state.grazes += 1; state.chain += 1;
      state.bestChain = Math.max(state.bestChain, state.chain); state.chainTime = 3 + state.build.graze;
      state.score += Math.round(10 * (1 + state.build.graze * .5) * Math.min(5, 1 + Math.floor(state.chain / 8)));
      emit(state, 'graze', player.x, player.y);
    }
  }
  const bossDead = state.enemies.some(enemy => enemy.boss && enemy.dead);
  state.enemies = state.enemies.filter(enemy => !enemy.dead && enemy.y < ARENA.height + 36);
  state.hostileShots = state.hostileShots.filter(bullet => !bullet.dead && bullet.age < 9 && bullet.x > -28 && bullet.x < ARENA.width + 28 && bullet.y > -28 && bullet.y < ARENA.height + 28);
  state.friendlyShots = state.friendlyShots.filter(bullet => !bullet.dead && bullet.x > -16 && bullet.x < ARENA.width + 16 && bullet.y > -32);
  if (bossDead && state.phase === 'playing') finishStage(state);
  return state;
}

export function togglePause(state) {
  if (state.phase === 'paused') { state.phase = state.resumePhase || 'playing'; state.resumePhase = null; return true; }
  if (state.phase !== 'playing' && state.phase !== 'upgrade') return false;
  state.resumePhase = state.phase; state.phase = 'paused'; state.bombHeld = false;
  return true;
}

export function chooseUpgrade(state, id) {
  if (state.phase !== 'upgrade' || !state.upgradeChoices.includes(id) || !Object.hasOwn(UPGRADES, id)) return { ok: false };
  if (state.build[id] >= UPGRADES[id].cap) return { ok: false };
  state.build[id] += 1;
  if (id === 'patch') state.player.hull = Math.min(state.player.maxHull, state.player.hull + 1);
  if (id === 'bomb') state.player.bombs += 1;
  state.stage += 1; state.stageTime = 0; state.spawnTimer = .65; state.spawnIndex = 0; state.guardianSpawned = false;
  state.upgradeChoices = []; state.phase = 'playing'; state.bombHeld = false;
  state.player.x = 240; state.player.y = 502; state.player.invulnerable = 1.2; state.player.fireTimer = 0;
  emit(state, 'depart', state.player.x, state.player.y, { stage: state.stage });
  return { ok: true };
}

export function recordKey(state) { return `${state.difficulty}-campaign-v1`; }
