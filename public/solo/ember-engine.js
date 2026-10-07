/** Ember Delve: a seeded, room-based action roguelike. */
export const ARENA = Object.freeze({ width: 960, height: 640 });
export const ACT_NAMES = Object.freeze(['The Coal Galleries', 'The Glass Burrows', 'The Crown Furnace']);
export const BOSSES = Object.freeze(['Ash Warden', 'Mirror Stag', 'Cinder Queen']);
export const DIFFICULTIES = Object.freeze({
  standard: Object.freeze({ title: 'Standard', description: 'A gentler descent. Familiar patrols and generous recovery.', extra: 0, speed: 1, lead: 0, mana: 100, manaRegen: 10, staminaRegen: 32, bladeCost: 10, boltCost: 12, heal: 1 }),
  veteran: Object.freeze({ title: 'Veteran', description: 'Guarded relics, mixed boss fights, limited kill recovery. Attacks briefly slow movement and delay stamina recovery. Change direction after tells; reserve a dodge.', extra: 2, speed: 1.55, lead: .58, mana: 75, manaRegen: 6, staminaRegen: 22, bladeCost: 14, boltCost: 16, heal: .6, healingBudget: 10, bladeMana: 6, summonLimit: 3 }),
  nightmare: Object.freeze({ title: 'Nightmare', description: 'Stronger relic guards, three-way boss pressure, scarce kill recovery. Commit to openings; attack spam spends your escape.', extra: 3, speed: 1.85, lead: .68, mana: 65, manaRegen: 5, staminaRegen: 20, bladeCost: 15, boltCost: 17, heal: .4, healingBudget: 6, bladeMana: 5, summonLimit: 4 }),
});
const profile = s => DIFFICULTIES[s.difficulty] || DIFFICULTIES.standard;
export const RELICS = Object.freeze({
  ember: { id: 'ember', title: 'Coalbrand', description: 'Sword strikes burn for 18 damage over time. Stacks add 10 burn damage.' },
  coil: { id: 'coil', title: 'Spark Coil', description: 'Bolts pierce one more foe and deal +12 damage to burning targets.' },
  duelist: { id: 'duelist', title: 'Duelist’s Seal', description: 'Dodging through an attack restores 20 mana and empowers your next sword strike.' },
  chalice: { id: 'chalice', title: 'Sanguine Cup', description: 'Every kill restores 3 health. Stacks add 2 health per kill.' },
  frost: { id: 'frost', title: 'Glassheart', description: 'Bolts slow enemies for 1.8 seconds. Slowed enemies take +10 sword damage.' },
  fleet: { id: 'fleet', title: 'Wayfarer Boots', description: 'Dodge costs 8 less stamina and movement gains 12 speed.' },
  vitality: { id: 'vitality', title: 'Living Cinder', description: 'Gain 20 maximum health and restore 30 health.' },
  focus: { id: 'focus', title: 'Deep Reservoir', description: 'Gain 20 maximum mana and 2 mana regeneration per second.' },
  blade: { id: 'blade', title: 'Honed Steel', description: 'Sword damage +8 and swing cooldown reduced by 0.02 seconds.' },
});
const layouts = [
  [{ x: 250, y: 155, width: 100, height: 110 }, { x: 610, y: 375, width: 100, height: 110 }],
  [{ x: 390, y: 110, width: 180, height: 100 }, { x: 390, y: 430, width: 180, height: 100 }],
  [{ x: 255, y: 270, width: 110, height: 100 }, { x: 595, y: 270, width: 110, height: 100 }],
  [{ x: 240, y: 145, width: 90, height: 85 }, { x: 630, y: 145, width: 90, height: 85 }, { x: 240, y: 410, width: 90, height: 85 }, { x: 630, y: 410, width: 90, height: 85 }],
];
const motions = new WeakMap();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const unit = (x, y, fx = 1, fy = 0) => { const l = Math.hypot(x, y); return l > .001 ? { x: x / l, y: y / l } : { x: fx, y: fy }; };
function rng(s) { let x = s.randomState; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; s.randomState = x >>> 0 || 1; return s.randomState / 4294967296; }
function event(s, type, extra = {}) { s.events.push({ id: ++s.eventId, type, time: s.elapsed, x: s.player.x, y: s.player.y, ...extra }); if (s.events.length > 40) s.events.shift(); }
function solid(s, x, y, r) { return s.room.obstacles.some(o => Math.hypot(x - clamp(x, o.x, o.x + o.width), y - clamp(y, o.y, o.y + o.height)) < r); }
/** Recover an embedded navigation goal or an old saved position first. */
function separateCover(s, body) {
  body.x = clamp(body.x, 42 + body.radius, ARENA.width - 42 - body.radius);
  body.y = clamp(body.y, 42 + body.radius, ARENA.height - 42 - body.radius);
  for (const rect of s.room.obstacles) {
    const cx = clamp(body.x, rect.x, rect.x + rect.width);
    const cy = clamp(body.y, rect.y, rect.y + rect.height);
    const ox = body.x - cx;
    const oy = body.y - cy;
    const gap = Math.hypot(ox, oy);
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

function stationary(body) {
  return [{ t0: 0, t1: 1, x0: body.x, y0: body.y, x1: body.x, y1: body.y }];
}

/** Sweep to the exact rounded cover edge, then spend the remainder sliding. */
function move(s, body, dx, dy, duration = 1) {
  separateCover(s, body);
  const path = [];
  let time = 0;
  for (let slide = 0; slide < 3 && time < duration; slide += 1) {
    let first = 1, normal = null;
    for (const rect of s.room.obstacles) {
      const hit = coverHit(body.x, body.y, dx, dy, rect, body.radius);
      if (hit === null || hit > first) continue;
      const x = body.x + dx * hit, y = body.y + dy * hit;
      const n = unit(x - clamp(x, rect.x, rect.x + rect.width), y - clamp(y, rect.y, rect.y + rect.height));
      // A body touching cover must still be able to retreat or slide along it.
      if (dx * n.x + dy * n.y >= -1e-8) continue;
      first = hit; normal = n;
    }
    for (const [origin, delta, limit, nx, ny] of [
      [body.x, dx, 42 + body.radius, 1, 0], [body.x, dx, ARENA.width - 42 - body.radius, -1, 0],
      [body.y, dy, 42 + body.radius, 0, 1], [body.y, dy, ARENA.height - 42 - body.radius, 0, -1],
    ]) {
      if (delta * (nx || ny) >= -1e-8) continue;
      const hit = (limit - origin) / delta;
      if (hit >= 0 && hit <= first) { first = hit; normal = { x: nx, y: ny }; }
    }
    const end = time + (duration - time) * first;
    const x = body.x + dx * first, y = body.y + dy * first;
    if (end > time) path.push({ t0: time, t1: end, x0: body.x, y0: body.y, x1: x, y1: y });
    body.x = x; body.y = y; time = end;
    if (!normal) break;
    dx *= 1 - first; dy *= 1 - first;
    const into = dx * normal.x + dy * normal.y;
    dx -= into * normal.x; dy -= into * normal.y;
    if (Math.hypot(dx, dy) < 1e-8) break;
  }
  if (time < 1) path.push({ t0: time, t1: 1, x0: body.x, y0: body.y, x1: body.x, y1: body.y });
  motions.set(body, path.length ? path : stationary(body));
}

function positionAt(segment, time) {
  const fraction = (time - segment.t0) / (segment.t1 - segment.t0);
  return { x: segment.x0 + (segment.x1 - segment.x0) * fraction,
    y: segment.y0 + (segment.y1 - segment.y0) * fraction };
}

// Solve two path segments in relative coordinates without per-target vectors.
function segmentHit(left, right, radius) {
  const start = Math.max(left.t0, right.t0), end = Math.min(left.t1, right.t1);
  if (end <= start) return null;
  const lf = (start - left.t0) / (left.t1 - left.t0), rf = (start - right.t0) / (right.t1 - right.t0);
  const lx = left.x1 - left.x0, ly = left.y1 - left.y0, rx = right.x1 - right.x0, ry = right.y1 - right.y0;
  const ox = left.x0 + lx * lf - right.x0 - rx * rf, oy = left.y0 + ly * lf - right.y0 - ry * rf;
  const dx = (lx / (left.t1 - left.t0) - rx / (right.t1 - right.t0)) * (end - start);
  const dy = (ly / (left.t1 - left.t0) - ry / (right.t1 - right.t0)) * (end - start);
  const c = ox * ox + oy * oy - radius * radius;
  if (c <= 0) return start;
  const a = dx * dx + dy * dy;
  if (a === 0) return null;
  const b = 2 * (ox * dx + oy * dy), discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const fraction = (-b - Math.sqrt(discriminant)) / (2 * a);
  return fraction >= 0 && fraction <= 1 ? start + (end - start) * fraction : null;
}

/** Relative motion is essential: a final-position graze can be a clean dodge. */
function pathHit(a, b, radius) {
  let first = null;
  for (const left of a) for (const right of b) {
    const hit = segmentHit(left, right, radius);
    if (hit !== null && (first === null || hit < first)) first = hit;
  }
  return first;
}

function movingHit(shotPath, body, radius, moving) {
  const path = moving && motions.get(body);
  if (!path) return circleHit(shotPath.x0, shotPath.y0, shotPath.x1 - shotPath.x0, shotPath.y1 - shotPath.y0, body, radius);
  let first = null;
  for (const segment of path) {
    const hit = segmentHit(shotPath, segment, body.radius + radius);
    if (hit !== null && (first === null || hit < first)) first = hit;
  }
  return first;
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


function lineClear(s, a, b, r = 0) {
  const dx = b.x - a.x, dy = b.y - a.y;
  return s.room.obstacles.every(o => {
    let enter = 0, leave = 1;
    for (const [origin, delta, low, high] of [[a.x, dx, o.x - r, o.x + o.width + r], [a.y, dy, o.y - r, o.y + o.height + r]]) {
      if (Math.abs(delta) < .00001) { if (origin < low || origin > high) return true; }
      else { const t1 = (low - origin) / delta, t2 = (high - origin) / delta; enter = Math.max(enter, Math.min(t1, t2)); leave = Math.min(leave, Math.max(t1, t2)); if (enter > leave) return true; }
    }
    return leave < 0 || enter > 1;
  });
}
function steer(s, b, target) {
  if (s.difficulty !== 'standard') {
    // A charge can leave a circle beside a pillar corner, inside the padded
    // visibility rectangle. Step out before pathfinding; otherwise every edge
    // rejects its own starting point and the guard can be parked indefinitely.
    const clearance = b.radius + 3;
    for (const o of s.room.obstacles) if (b.x > o.x - clearance && b.x < o.x + o.width + clearance && b.y > o.y - clearance && b.y < o.y + o.height + clearance) {
      const exits = [{ x: o.x - clearance, y: b.y }, { x: o.x + o.width + clearance, y: b.y }, { x: b.x, y: o.y - clearance }, { x: b.x, y: o.y + o.height + clearance }]
        .filter(point => !solid(s, point.x, point.y, b.radius)).sort((a, c) => dist(a, b) - dist(c, b));
      if (exits.length) return unit(exits[0].x - b.x, exits[0].y - b.y);
    }
  }
  target = { ...target };
  for (const o of s.room.obstacles) {
    const m = b.radius + 5;
    if (target.x > o.x - m && target.x < o.x + o.width + m && target.y > o.y - m && target.y < o.y + o.height + m) {
      const sides = [{ x: o.x - m, y: target.y }, { x: o.x + o.width + m, y: target.y }, { x: target.x, y: o.y - m }, { x: target.x, y: o.y + o.height + m }];
      target = sides.sort((a, c) => dist(a, target) - dist(c, target))[0];
    }
  }
  if (lineClear(s, b, target, b.radius + 2)) return unit(target.x - b.x, target.y - b.y);
  // Small visibility graph: every room uses rectangular, separated pillars.
  const margin = b.radius + 6;
  const nodes = [b, target, ...s.room.obstacles.flatMap(o => [
    { x: o.x - margin, y: o.y - margin }, { x: o.x + o.width + margin, y: o.y - margin },
    { x: o.x - margin, y: o.y + o.height + margin }, { x: o.x + o.width + margin, y: o.y + o.height + margin },
  ])];
  const costs = nodes.map(() => Infinity), parents = nodes.map(() => -1), visited = new Set(); costs[0] = 0;
  for (let n = 0; n < nodes.length; n++) {
    let k = -1; for (let i = 0; i < nodes.length; i++) if (!visited.has(i) && (k < 0 || costs[i] < costs[k])) k = i;
    if (k < 0 || !Number.isFinite(costs[k]) || k === 1) break;
    visited.add(k);
    for (let i = 1; i < nodes.length; i++) if (!visited.has(i) && lineClear(s, nodes[k], nodes[i], b.radius + 2)) {
      const c = costs[k] + dist(nodes[k], nodes[i]); if (c < costs[i]) { costs[i] = c; parents[i] = k; }
    }
  }
  let index = 1; if (parents[index] < 0) return { x: 0, y: 0 };
  while (parents[index] > 0) index = parents[index];
  return unit(nodes[index].x - b.x, nodes[index].y - b.y);
}
function spawn(s, type, point = null) {
  if (s.enemies.length >= 18) return;
  const boss = type === 'boss'; const radius = boss ? 26 : type === 'sentinel' ? 18 : 14;
  const spots = [{ x: 720, y: 315 }, { x: 650, y: 110 }, { x: 795, y: 500 }, { x: 510, y: 320 }, { x: 170, y: 500 }, { x: 790, y: 200 }];
  const p = point || spots[s.enemyId % spots.length];
  const hp = boss ? [290, 440, 620][s.act - 1] : ({ crawler: 42, archer: 48, charger: 64, sentinel: 88 }[type] + (s.act - 1) * 12) * (s.room.kind === 'elite' ? 1.28 : 1);
  const e = { id: ++s.enemyId, type, boss, ...p, radius, hp, maxHp: hp, phase: 'seek', timer: .45 + rng(s) * .4, pattern: 0, summons: 0, aimX: -1, aimY: 0, burn: 0, burnDps: 0, slow: 0, attackId: 0 };
  // Spawns need the same clearance as the navigation graph, not just their body.
  if (solid(s, e.x, e.y, radius + 6)) { e.x = 780; e.y = 320; }
  s.enemies.push(e);
}
function roomStart(s, kind) {
  s.phase = 'playing'; s.choices = []; s.projectiles = []; s.enemies = []; s.effects = []; s.roomHealing = 0;
  const layout = kind === 'boss' ? 3 : (s.act + s.depth + s.roomsCleared) % 3;
  s.room = { id: `${s.act}-${s.depth}-${kind}`, kind, title: kind === 'boss' ? BOSSES[s.act - 1] : `${['Ember', 'Crystal', 'Crown'][s.act - 1]} ${kind === 'elite' ? 'Crucible' : kind === 'treasure' ? 'Reliquary' : kind === 'camp' ? 'Sanctuary' : ['Gallery', 'Crossing', 'Vault'][layout]}`, obstacles: layouts[layout].map(o => ({ ...o })), exit: { x: 890, y: 320, radius: 42 }, shrine: { x: 570, y: 320, radius: 50 }, cleared: false, rewardTaken: false };
  s.player.x = 105; s.player.y = 320; s.player.velocityX = s.player.velocityY = 0; s.player.invulnerable = .6; s.player.dashTime = 0; s.player.attackTime = 0; s.player.castTime = 0; s.player.staminaDelay = 0; s.player.attackCooldown = 0; s.player.spellCooldown = 0;
  if (kind === 'boss') {
    spawn(s, 'boss');
    if (s.difficulty !== 'standard') {
      // Support starts in visible, separated positions and cannot attack on entry.
      for (const type of s.difficulty === 'nightmare' ? ['archer', 'crawler', 'sentinel'] : ['archer', 'crawler']) {
        spawn(s, type); s.enemies.at(-1).timer = 1.5;
      }
    }
  } else if (kind === 'treasure' && s.difficulty !== 'standard') {
    for (const type of s.difficulty === 'nightmare' ? ['sentinel', 'archer', 'charger'] : ['sentinel', 'archer']) spawn(s, type);
  }
  else if (kind === 'combat' || kind === 'elite') {
    const types = ['crawler', 'archer', 'charger', 'sentinel'];
    const count = (kind === 'elite' ? 5 + s.act : 3 + s.act) + profile(s).extra;
    for (let i = 0; i < count; i++) spawn(s, types[(i + s.act + s.depth) % 4]);
  }
  event(s, 'room', { act: s.act, depth: s.depth, kind });
}
export function createState({ seed = Date.now(), difficulty = 'standard' } = {}) {
  difficulty = Object.hasOwn(DIFFICULTIES, difficulty) ? difficulty : 'standard';
  const normalized = Number.isFinite(Number(seed)) ? Number(seed) >>> 0 : 1;
  const s = { gameId: 'ember-delve', difficulty, seed: normalized || 1, randomState: normalized || 1, phase: 'playing', pausedPhase: null, act: 1, depth: 1, roomsCleared: 0, kills: 0, score: 0, elapsed: 0, tick: 0, result: null, gold: 0, relics: {}, choices: [], routeHistory: [], enemies: [], enemyId: 0, projectiles: [], projectileId: 0, effects: [], events: [], eventId: 0, attackId: 0, pending: null,
    player: { x: 105, y: 320, radius: 12, hp: 140, maxHp: 140, mana: 100, maxMana: 100, manaRegen: 10, stamina: 100, maxStamina: 100, staminaRegen: 32, moveSpeed: 245, swordDamage: 30, spellDamage: 28, aimX: 1, aimY: 0, attackCooldown: 0, attackTime: 0, spellCooldown: 0, dodgeCooldown: 0, dashTime: 0, castTime: 0, staminaDelay: 0, bladeManaRemaining: 0, dashX: 1, dashY: 0, invulnerable: 0, damageCooldown: 0, empowered: 0, dashHeld: false, interactHeld: false } };
  const rules = profile(s); s.player.mana = s.player.maxMana = rules.mana; s.player.manaRegen = rules.manaRegen; s.player.staminaRegen = rules.staminaRegen;
  s.player.velocityX = s.player.velocityY = 0;
  roomStart(s, 'combat'); return s;
}
export function getRelicInfo(s, id) {
  const info = { ...RELICS[id] };
  if (s.difficulty !== 'standard') {
    if (id === 'chalice') info.description = `Kills restore ${s.difficulty === 'nightmare' ? 1 : 2} health; stacks add 1, capped at ${s.difficulty === 'nightmare' ? 4 : 5} per kill and ${profile(s).healingBudget} per room.`;
    if (id === 'fleet') info.description = 'Dodge costs 5 less stamina per rank, down to 26. Movement gains 12 speed per rank.';
    if (id === 'vitality') info.description = `Gain 20 maximum health and restore ${Math.round(30 * profile(s).heal)} health.`;
  }
  return info;
}
function choices(s, phase) {
  s.phase = phase;
  if (phase === 'reward') {
    const ids = Object.keys(RELICS); for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(rng(s) * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    s.choices = ids.slice(0, 3).map(id => getRelicInfo(s, id));
  } else if (phase === 'route') {
    s.choices = s.depth === 1 ? [
      { id: 'combat', title: 'The Long Gallery', description: 'A guarded room. Earn gold, a relic, and combat score.', risk: 'STANDARD', kind: 'combat' },
      { id: 'treasure', title: s.difficulty === 'standard' ? 'The Quiet Reliquary' : 'The Guarded Reliquary', description: s.difficulty === 'standard' ? 'A safe chest with one relic. Lower score, no combat gold.' : 'Defeat the relic guards, then open the chest. Fewer foes, no combat gold.', risk: s.difficulty === 'standard' ? 'SAFE' : 'GUARDED', kind: 'treasure' },
    ] : s.depth === 2 ? [
      { id: 'elite', title: 'The Crucible', description: 'More durable enemies. Double gold, better score, and a relic.', risk: 'HIGH RISK', kind: 'elite' },
      { id: 'camp', title: 'The Warm Sanctuary', description: 'Spend gold to heal, or meditate for maximum mana.', risk: 'RECOVERY', kind: 'camp' },
    ] : [{ id: 'boss', title: BOSSES[s.act - 1], description: `Defeat the keeper of ${ACT_NAMES[s.act - 1].toLowerCase()}.`, risk: 'ACT BOSS', kind: 'boss' }];
  } else s.choices = [{ id: 'rest', title: 'Mend your wounds', description: `Spend 20 gold to restore ${Math.round(55 * profile(s).heal)} health.`, cost: 20 }, { id: 'meditate', title: 'Read the old embers', description: 'Restore all mana and gain 10 maximum mana. Free.', cost: 0 }];
  event(s, phase);
}
function advance(s) {
  if (s.depth === 4) { s.act++; s.depth = 1; roomStart(s, 'combat'); }
  else choices(s, 'route');
}
export function chooseRoute(s, id) {
  if (s.phase !== 'route' || !s.choices.some(c => c.id === id)) return false;
  s.routeHistory.push({ act: s.act, depth: s.depth + 1, kind: id }); s.depth++; roomStart(s, id); return true;
}
export function chooseReward(s, id) {
  if (s.phase !== 'reward' || !s.choices.some(c => c.id === id)) return false;
  s.relics[id] = (s.relics[id] || 0) + 1; const p = s.player;
  if (id === 'vitality') { p.maxHp += 20; p.hp = Math.min(p.maxHp, p.hp + Math.round(30 * profile(s).heal)); }
  if (id === 'focus') { p.maxMana += 20; p.mana = Math.min(p.maxMana, p.mana + 30); p.manaRegen += 2; }
  if (id === 'blade') p.swordDamage += 8;
  if (id === 'fleet') p.moveSpeed += 12;
  event(s, 'relic', { relic: id }); s.choices = [];
  if (s.pending === 'advance') { s.pending = null; advance(s); }
  else { s.phase = 'playing'; s.room.cleared = true; s.room.rewardTaken = true; s.roomsCleared++; }
  return true;
}
export function chooseCamp(s, id) {
  if (s.phase !== 'camp' || !s.choices.some(c => c.id === id)) return false;
  if (id === 'rest') { if (s.gold < 20) return false; s.gold -= 20; s.player.hp = Math.min(s.player.maxHp, s.player.hp + Math.round(55 * profile(s).heal)); }
  else { s.player.maxMana += 10; s.player.mana = s.player.maxMana; }
  s.phase = 'playing'; s.room.cleared = true; s.room.rewardTaken = true; s.roomsCleared++; s.choices = []; event(s, 'camp', { choice: id }); return true;
}
export function togglePause(s) {
  if (['playing', 'route', 'reward', 'camp'].includes(s.phase)) { s.pausedPhase = s.phase; s.phase = 'paused'; return true; }
  if (s.phase === 'paused') { s.phase = s.pausedPhase || 'playing'; s.pausedPhase = null; return true; }
  return false;
}
function hurt(s, damage, attackId = 0, contact = null) {
  const p = s.player;
  if (s.phase !== 'playing') return;
  if (p.invulnerable > 0) {
    if (p.dashTime > 0 && s.relics.duelist && attackId !== s.lastParried) { s.lastParried = attackId; p.mana = Math.min(p.maxMana, p.mana + 20); p.empowered = 2; event(s, 'perfect'); }
    return;
  }
  if (p.damageCooldown > 0) return;
  p.hp = Math.max(0, p.hp - damage); p.damageCooldown = .65; event(s, 'hurt', { damage, ...contact });
  if (p.hp <= 0) { s.phase = 'lost'; s.result = 'The flame went out'; event(s, 'defeat'); }
}
function damageEnemy(s, e, damage, weapon, contact = null) {
  if (e.hp <= 0) return;
  if (e.type === 'sentinel' && weapon === 'sword' && e.phase !== 'recover') {
    const incoming = unit(s.player.x - e.x, s.player.y - e.y); if (incoming.x * e.aimX + incoming.y * e.aimY > .45) damage *= .35;
  }
  if (weapon === 'sword') {
    if (s.relics.ember) { e.burn = 3; e.burnDps = (18 + 10 * (s.relics.ember - 1)) / 3; }
    if (s.relics.frost && e.slow > 0) damage += 10 * s.relics.frost;
  }
  if (weapon === 'spell') {
    if (s.relics.coil && e.burn > 0) damage += 12 * s.relics.coil;
    if (s.relics.frost) e.slow = 1.8;
  }
  e.hp -= damage; event(s, 'hit', { x: e.x, y: e.y, damage: Math.round(damage), enemyId: e.id, ...contact });
  if (weapon === 'sword' && s.difficulty !== 'standard') {
    const restored = Math.min(s.player.bladeManaRemaining, e.type === 'sentinel' && damage < s.player.swordDamage ? 1 : 4);
    s.player.mana = Math.min(s.player.maxMana, s.player.mana + restored); s.player.bladeManaRemaining -= restored;
  }
}
function shot(s, owner, x, y, angle, speed, damage, extra = {}) {
  if (s.projectiles.length >= 160) return;
  s.projectiles.push({ id: ++s.projectileId, owner, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius: owner === 'player' ? 6 : 5, damage, life: 3, hits: [], pierce: owner === 'player' ? (s.relics.coil || 0) : 0, ...extra });
}
function fan(s, e, count, spread, speed = 190) {
  const a = Math.atan2(e.aimY, e.aimX); for (let i = 0; i < count; i++) shot(s, 'enemy', e.x, e.y, a + (i - (count - 1) / 2) * spread, speed, 18 + s.act * 2, { attackId: e.attackId });
}
function tell(s, e, duration, kind) {
  const rules = profile(s), p = s.player;
  // Aim is committed at the warning. Predictable kiting is intercepted, while
  // changing direction or dodging after the tell still defeats the attack.
  const travel = dist(e, p) / (kind === 'fan' ? s.difficulty === 'nightmare' ? 285 : 250 : 550);
  const lead = kind === 'fault' ? duration : kind === 'charge' || kind === 'fan' ? duration + Math.min(travel, rules.lead) : .2;
  const target = { x: clamp(p.x + (p.velocityX || 0) * lead, 64, 896), y: clamp(p.y + (p.velocityY || 0) * lead, 64, 576) };
  const a = unit((s.difficulty === 'standard' ? p.x : target.x) - e.x, (s.difficulty === 'standard' ? p.y : target.y) - e.y);
  e.aimX = a.x; e.aimY = a.y; e.phase = 'tell'; e.timer = duration; e.tellDuration = duration; e.tell = kind; e.attackId = ++s.attackId;
  e.fanCount = s.difficulty === 'standard' ? e.boss ? 7 : 3 : e.boss ? 9 : s.difficulty === 'nightmare' ? 7 : 5;
  if (e.boss && s.difficulty !== 'standard' && e.hp < e.maxHp / 2) e.fanCount += 2;
  e.fanSpread = e.boss ? .16 : .14; e.shotSpeed = s.difficulty === 'standard' ? 190 : s.difficulty === 'nightmare' ? 285 : 250;
  e.chargeSpeed = s.difficulty === 'standard' ? 450 : e.type === 'crawler' ? 570 : 550 + (s.difficulty === 'nightmare' ? 40 : 0);
  e.chargeDuration = e.boss ? .55 : e.type === 'crawler' ? .34 : .42;
  if (kind === 'fault') {
    const radius = s.difficulty === 'nightmare' ? 78 : 68;
    e.targets = [{ x: target.x, y: target.y, radius }];
    if (e.boss) for (const side of [-1, 1]) e.targets.push({ x: clamp(target.x + a.y * side * 112, 64, 896), y: clamp(target.y - a.x * side * 112, 64, 576), radius });
  } else if (kind === 'summon') e.targets = [{ x: 160, y: 150, radius: 36 }, { x: 800, y: 490, radius: 36 }];
  else e.targets = [];
  event(s, 'tell', { enemyId: e.id, x: e.x, y: e.y, kind });
}
function enemyStep(s, e, dt) {
  if (e.hp <= 0) return;
  e.burn = Math.max(0, e.burn - dt); if (e.burn > 0) e.hp -= e.burnDps * dt;
  // Damage-over-time deaths stop this actor before it can release a queued hit.
  if (e.hp <= 0) return;
  e.slow = Math.max(0, e.slow - dt); e.timer -= dt;
  const rules = profile(s), hard = s.difficulty !== 'standard', p = s.player, gap = dist(e, p);
  const speed = rules.speed * (e.slow > 0 ? .55 : 1) * (e.type === 'crawler' ? 105 : e.type === 'sentinel' ? 65 : 85);
  if (e.phase === 'tell') {
    if (e.timer > 0) return;
    if (e.tell === 'charge') { e.phase = 'charge'; e.timer = e.chargeDuration ?? (e.boss ? .55 : .42); }
    else if (e.tell === 'sweep') { if (gap < (e.boss ? 150 : 80)) hurt(s, e.boss ? 30 : 20, e.attackId); e.phase = 'recover'; e.timer = hard ? .6 : .8; }
    else if (e.tell === 'ring') {
      const count = s.act === 3 ? 16 : 12; const rotation = e.pattern * .22;
      for (let i = 0; i < count; i++) shot(s, 'enemy', e.x, e.y, i * Math.PI * 2 / count + rotation, (s.act === 3 ? 170 : 150) * (hard ? 1.3 : 1), 22, { attackId: e.attackId });
      e.phase = 'recover'; e.timer = hard ? .6 : .8;
    } else if (e.tell === 'fault') {
      for (const target of e.targets || []) if (s.effects.length < 24) s.effects.push({ ...target, kind: 'fault', life: .3, attackId: e.attackId });
      e.phase = 'recover'; e.timer = .9;
    } else if (e.tell === 'summon') {
      e.summons = (e.summons || 0) + 1;
      for (const [type, point] of [['crawler', { x: 160, y: 150 }], ['archer', { x: 800, y: 490 }]]) {
        const before = s.enemies.length; spawn(s, type, point);
        if (s.enemies.length > before) { s.enemies.at(-1).summoned = true; s.enemies.at(-1).timer = .8; }
      }
      e.phase = 'recover'; e.timer = 1;
    }
    else { fan(s, e, e.fanCount ?? (e.boss ? 7 : 3), e.fanSpread ?? (e.boss ? .16 : .14), e.shotSpeed ?? 190); e.phase = 'recover'; e.timer = hard ? .65 : e.boss ? .8 : 1; }
    return;
  }
  if (e.phase === 'charge') {
    move(s, e, e.aimX * (e.chargeSpeed ?? 450) * dt, e.aimY * (e.chargeSpeed ?? 450) * dt);
    const path = motions.get(p) || stationary(p);
    const contact = pathHit(motions.get(e) || stationary(e), path, e.radius + p.radius + 10);
    if (contact !== null) hurt(s, e.boss ? 30 : 24, e.attackId, positionAt(path.find(segment => contact >= segment.t0 && contact <= segment.t1), contact));
    if (e.timer <= 0) { e.phase = 'recover'; e.timer = hard ? .65 : .9; }
    return;
  }
  if (e.phase === 'recover') { if (e.timer <= 0) { e.phase = 'seek'; e.timer = hard ? e.boss && e.hp < e.maxHp / 2 ? .16 : .3 : e.boss ? .7 : .5; } return; }
  if (e.boss) {
    const toward = steer(s, e, p); if (gap > (hard ? 175 : 230)) move(s, e, toward.x * (hard ? 125 + s.act * 10 : 70) * dt, toward.y * (hard ? 125 + s.act * 10 : 70) * dt);
    if (e.timer <= 0) {
      e.pattern++;
      const patterns = hard ? s.act === 1 ? ['charge', 'fan', 'fault', 'ring', 'sweep'] : s.act === 2 ? ['fan', 'charge', 'fault', 'charge', 'ring'] : ['ring', 'fault', 'fan', 'summon', 'charge'] : s.act === 1 ? ['charge', 'ring', 'sweep'] : s.act === 2 ? ['fan', 'charge', 'charge', 'ring'] : ['ring', 'fan', 'summon', 'ring'];
      let kind = patterns[(e.pattern - 1) % patterns.length];
      // Finite summons keep a stalled guardian from becoming an endless farm.
      if (hard && kind === 'summon' && (e.summons || 0) >= rules.summonLimit) kind = 'fault';
      tell(s, e, kind === 'fault' || kind === 'summon' ? 1 : e.pattern % patterns.length === 0 ? .95 : .7, kind);
    }
    return;
  }
  const direction = steer(s, e, p); e.aimX = direction.x; e.aimY = direction.y;
  // Bound concurrent warnings so even dense elite encounters remain readable.
  const canTell = !hard || s.enemies.filter(other => other.phase === 'tell' || other.phase === 'charge').length < (s.difficulty === 'nightmare' ? 4 : 3);
  if (e.type === 'archer') {
    if (gap > 290 || !lineClear(s, e, p, 6)) move(s, e, direction.x * speed * dt, direction.y * speed * dt);
    else if (gap < 150) move(s, e, -direction.x * speed * dt, -direction.y * speed * dt);
    else if (hard) { const side = e.id % 2 ? 1 : -1; move(s, e, -direction.y * side * speed * .35 * dt, direction.x * side * speed * .35 * dt); }
    if (canTell && e.timer <= 0 && lineClear(s, e, p, 6)) tell(s, e, .7, 'fan');
  } else if (e.type === 'charger') {
    if (gap > 220 || !lineClear(s, e, p, hard ? e.radius : 0)) move(s, e, direction.x * speed * dt, direction.y * speed * dt);
    if (canTell && e.timer <= 0 && gap < (hard ? 460 : 330) && lineClear(s, e, p, hard ? e.radius : 0)) tell(s, e, .75, 'charge');
  } else {
    if (gap > 60) move(s, e, direction.x * speed * dt, direction.y * speed * dt);
    if (canTell && gap < 80 && e.timer <= 0) tell(s, e, e.type === 'sentinel' ? .85 : .42, 'sweep');
    else if (canTell && hard && e.timer <= 0 && e.type === 'crawler' && gap < 330 && lineClear(s, e, p, e.radius)) tell(s, e, .6, 'charge');
    else if (canTell && hard && e.timer <= 0 && e.type === 'sentinel' && gap < 540) tell(s, e, 1, 'fault');
  }
}
function interaction(s) {
  if (!s.room.cleared && s.room.kind === 'treasure' && s.enemies.length === 0 && dist(s.player, s.room.shrine) < 70) { s.pending = 'treasure'; choices(s, 'reward'); return; }
  if (!s.room.cleared && s.room.kind === 'camp' && dist(s.player, s.room.shrine) < 70) { choices(s, 'camp'); return; }
  if (!s.room.cleared || dist(s.player, s.room.exit) > 70) return;
  if (s.act === 3 && s.depth === 4) { s.phase = 'won'; s.result = 'The Crown Furnace is quiet'; s.score += 1500; event(s, 'victory'); return; }
  if (!s.room.rewardTaken && ['combat', 'elite', 'boss'].includes(s.room.kind)) { s.pending = 'advance'; choices(s, 'reward'); }
  else advance(s);
}
export function step(s, input = {}, dt = 1 / 120) {
  if (s.phase !== 'playing' || !Number.isFinite(dt) || dt <= 0) return;
  dt = Math.min(dt, 1 / 30); s.tick++; s.elapsed += dt;
  const p = s.player;
  const existing = new Set(s.projectiles);
  for (const body of [p, ...s.enemies]) motions.set(body, stationary(body));
  for (const key of ['attackCooldown', 'attackTime', 'castTime', 'staminaDelay', 'spellCooldown', 'dodgeCooldown', 'dashTime', 'invulnerable', 'damageCooldown', 'empowered']) p[key] = Math.max(0, p[key] - dt);
  p.mana = Math.min(p.maxMana, p.mana + p.manaRegen * dt);
  if (s.difficulty === 'standard' || p.staminaDelay <= 0) p.stamina = Math.min(p.maxStamina, p.stamina + p.staminaRegen * dt);
  const aim = unit(Number.isFinite(input.aimX) ? input.aimX : p.aimX, Number.isFinite(input.aimY) ? input.aimY : p.aimY, p.aimX, p.aimY); p.aimX = aim.x; p.aimY = aim.y;
  const rawX = Number.isFinite(input.moveX) ? clamp(input.moveX, -1, 1) : (input.right === true ? 1 : 0) - (input.left === true ? 1 : 0);
  const rawY = Number.isFinite(input.moveY) ? clamp(input.moveY, -1, 1) : (input.down === true ? 1 : 0) - (input.up === true ? 1 : 0);
  const movement = Math.hypot(rawX, rawY) > .05 ? unit(rawX, rawY) : { x: 0, y: 0 };
  const hard = s.difficulty !== 'standard';
  const dash = input.dash === true, dashCost = Math.max(hard ? 26 : 14, 34 - (s.relics.fleet || 0) * (hard ? 5 : 8));
  if (dash && !p.dashHeld && p.stamina >= dashCost && p.dodgeCooldown <= 0) { p.stamina -= dashCost; if (hard) p.staminaDelay = .6; p.dashTime = .18; p.invulnerable = .22; p.dodgeCooldown = .32; p.dashX = movement.x || movement.y ? movement.x : aim.x; p.dashY = movement.x || movement.y ? movement.y : aim.y; event(s, 'dash'); }
  p.dashHeld = dash;
  const oldX = p.x, oldY = p.y;
  if (p.dashTime > 0) move(s, p, p.dashX * 660 * dt, p.dashY * 660 * dt);
  else { const pace = hard && (p.attackTime > 0 || p.castTime > 0) ? .85 : 1; move(s, p, movement.x * p.moveSpeed * pace * dt, movement.y * p.moveSpeed * pace * dt); }
  // Dash velocity is deliberately excluded from the opponent's prediction.
  p.velocityX = p.dashTime > 0 ? 0 : (p.x - oldX) / dt; p.velocityY = p.dashTime > 0 ? 0 : (p.y - oldY) / dt;
  const rules = profile(s);
  if (input.melee === true && p.attackCooldown <= 0 && p.stamina >= rules.bladeCost && p.dashTime <= 0) {
    p.stamina -= rules.bladeCost; if (hard) { p.staminaDelay = .12; p.bladeManaRemaining = rules.bladeMana; } p.attackCooldown = Math.max(.18, .34 - (s.relics.blade || 0) * .02); p.attackTime = .15; event(s, 'swing');
    for (const e of s.enemies) { const toward = unit(e.x - p.x, e.y - p.y); if (dist(p, e) < 96 + e.radius && toward.x * aim.x + toward.y * aim.y > .38 && lineClear(s, p, e)) damageEnemy(s, e, p.swordDamage * (p.empowered > 0 ? 1.75 : 1), 'sword'); }
    p.empowered = 0;
  }
  if (input.spell === true && p.spellCooldown <= 0 && p.mana >= rules.boltCost && p.dashTime <= 0) {
    p.mana -= rules.boltCost; if (hard) p.castTime = .08; p.spellCooldown = .23; const muzzle = { x: p.x + aim.x * 22, y: p.y + aim.y * 22 };
    if (lineClear(s, p, muzzle, 6)) shot(s, 'player', muzzle.x, muzzle.y, Math.atan2(aim.y, aim.x), 580, p.spellDamage);
    event(s, 'cast');
  }
  for (const e of s.enemies) enemyStep(s, e, dt);
  for (const fx of s.effects) {
    if (fx.kind === 'fault' && dist(fx, p) < fx.radius + p.radius) hurt(s, 22 + s.act * 2, fx.attackId);
    fx.life -= dt;
  }
  s.effects = s.effects.filter(fx => fx.life > 0);
  for (const b of s.projectiles) {
    if (s.phase !== 'playing') break;
    b.life -= dt;
    if (b.life <= 0) continue;
    const x = b.x, y = b.y, dx = b.vx * dt, dy = b.vy * dt;
    const shotPath = { t0: 0, t1: 1, x0: x, y0: y, x1: x + dx, y1: y + dy };
    let blocker = null, first = 2;
    for (const o of s.room.obstacles) {
      const hit = coverHit(x, y, dx, dy, o, b.radius);
      if (hit !== null && hit < first) { first = hit; blocker = 'cover'; }
    }
    for (const [origin, delta, limit, direction] of [
      [x, dx, 42 + b.radius, 1], [x, dx, ARENA.width - 42 - b.radius, -1],
      [y, dy, 42 + b.radius, 1], [y, dy, ARENA.height - 42 - b.radius, -1],
    ]) {
      if (delta * direction >= 0) continue;
      const hit = (limit - origin) / delta;
      if (hit >= 0 && hit <= 1 && hit < first) { first = hit; blocker = 'wall'; }
    }
    const targets = b.owner === 'enemy' ? [p] : s.enemies.filter(e => e.hp > 0 && !b.hits.includes(e.id));
    const hits = targets.map(body => ({ body, time: movingHit(shotPath, body, b.radius, existing.has(b)) }))
      .filter(hit => hit.time !== null && hit.time < first).sort((a, c) => a.time - c.time);
    for (const hit of hits) {
      if (b.life <= 0 || s.phase !== 'playing') break;
      if (hit.body.hp <= 0) continue;
      b.x = x + dx * hit.time; b.y = y + dy * hit.time;
      const contact = { x: b.x, y: b.y };
      if (b.owner === 'enemy') { hurt(s, b.damage, b.attackId, contact); b.life = 0; }
      else {
        damageEnemy(s, hit.body, b.damage, 'spell', contact); b.hits.push(hit.body.id);
        if (b.hits.length > (b.pierce || 0)) b.life = 0;
      }
    }
    if (b.life <= 0) continue;
    if (blocker) {
      b.x = x + dx * first; b.y = y + dy * first; b.life = 0;
      event(s, 'impact', { x: b.x, y: b.y, owner: b.owner, kind: blocker });
    } else { b.x = x + dx; b.y = y + dy; }
  }
  s.projectiles = s.projectiles.filter(b => b.life > 0);
  const dead = s.enemies.filter(e => e.hp <= 0);
  for (const e of dead) {
    s.kills++; const gain = e.boss ? 500 * s.act : s.room.kind === 'elite' ? 100 : 55; s.score += hard && e.summoned ? 10 : gain;
    if (!hard || !e.summoned && s.room.kind !== 'treasure') s.gold += e.boss ? 40 : s.room.kind === 'elite' ? 8 : 4;
    if (s.relics.chalice && s.phase !== 'lost') {
      const amount = !hard ? 3 + 2 * (s.relics.chalice - 1) : Math.min(s.difficulty === 'nightmare' ? 4 : 5, (s.difficulty === 'nightmare' ? 1 : 2) + s.relics.chalice - 1);
      const restored = Math.min(p.maxHp - p.hp, amount, hard ? Math.max(0, rules.healingBudget - s.roomHealing) : Infinity);
      p.hp += restored; s.roomHealing += restored;
    }
    event(s, 'kill', { x: e.x, y: e.y, boss: e.boss });
  }
  s.enemies = s.enemies.filter(e => e.hp > 0);
  if (hard && s.room.kind === 'treasure' && dead.length && !s.enemies.length) { s.projectiles = []; s.effects = []; event(s, 'guards-clear'); }
  if (!s.room.cleared && ['combat', 'elite', 'boss'].includes(s.room.kind) && s.enemies.length === 0 && s.phase === 'playing') { s.room.cleared = true; s.roomsCleared++; s.score += 120 * s.act; s.projectiles = []; s.effects = []; event(s, 'clear'); }
  const interact = input.interact === true; if (interact && !p.interactHeld && s.phase === 'playing') interaction(s); p.interactHeld = interact;
}
