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
export const BIOMES = Object.freeze([
  { id: 'garden', name: 'Garden Ruins', boss: 'Ruin Warden' },
  { id: 'crypt', name: 'Tide Crypt', boss: 'Tide Oracle' },
  { id: 'ember', name: 'Ember Sanctum', boss: 'Cinder Regent' },
]);
export const BOONS = Object.freeze({
  edge: { name: 'Honed Edge', detail: '+3 sword damage', color: '#dfbe70' },
  ward: { name: 'Living Ward', detail: '+12 maximum health; heal 18', color: '#8caf8c' },
  bow: { name: 'Starstring', detail: '+3 arrow damage; pierce one extra foe', color: '#91b6cc' },
  vigor: { name: 'Second Wind', detail: 'Faster stamina recovery; cheaper rolls', color: '#98c7b8' },
  leech: { name: 'Red Bloom', detail: 'Sword hits restore health', color: '#d79c99' },
  riposte: { name: 'Mirror Sigil', detail: 'Timed parries heal and strike back', color: '#c0afd6' },
});
const ROOM_NAMES = ['Moss Gate', 'Broken Colonnade', 'The Warden’s Court', 'Tidal Crossing', 'Oracle’s Archive', 'The Drowned Chapel', 'Ash Causeway', 'Cinder Gallery', 'The Last Hearth'];
function roomObstacles(wave) {
  const layouts = [
    [[285,186,54,76],[621,186,54,76],[285,378,54,76],[621,378,54,76]],
    [[216,218,118,40],[626,218,118,40],[370,410,220,36]],
    [[240,244,58,96],[662,244,58,96]],
    [[224,174,42,166],[694,300,42,170],[416,216,128,42]],
    [[236,220,88,54],[636,220,88,54],[236,410,88,54],[636,410,88,54]],
    [[250,258,106,38],[604,258,106,38]],
    [[200,228,146,42],[614,228,146,42],[436,410,88,58]],
    [[242,180,46,150],[672,180,46,150],[340,436,280,34]],
    [[232,238,64,112],[664,238,64,112]],
  ];
  return layouts[wave - 1].map(([x,y,w,h],index) => ({ id: `room${wave}-${index}`, type: 'pillar', x,y,w,h }));
}
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
    hp: 100, maxHp: 100, stamina: 100, guard: 100, wins, boons: {},
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
    wave: 0, maxWaves: 9, waveDelay: 0, elapsedTicks: 0,
    biome: { ...BIOMES[0], index: 0 }, roomName: mode === 'coop' ? ROOM_NAMES[0] : 'Moss Courtyard', roomBreak: false,
    shrineChoices: [], boonSelections: [null, null], hazards: [],
    objective: mode === 'coop' ? 'Nine rooms. Three guardians. Ready together to enter the ruins.' : 'First to win two rounds.',
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
  if(state.mode === 'duel') {
    const index=(state.round-1)%3;
    state.biome={...BIOMES[index],index};
    state.roomName=['Moss Courtyard','Tide Archive','Cinder Gallery'][index];
    state.obstacles=index===0?PILLARS.map(p=>({...p})):roomObstacles(index===1?5:7);
    state.objective=`${state.roomName} · First to win two rounds. Cover changes with each arena.`;
  }
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

function circleContact(ax, ay, bx, by, radius) {
  const dx = bx - ax, dy = by - ay;
  const c = ax * ax + ay * ay - radius * radius;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy;
  if (a < 1e-12) return null;
  const b = 2 * (ax * dx + ay * dy), discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const t = (-b - Math.sqrt(discriminant)) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}

function rectContact(a, b, rect, radius = 0) {
  const clip = (minX, minY, maxX, maxY) => {
    let low = 0, high = 1;
    for (const [origin, delta, min, max] of [[a.x, b.x - a.x, minX, maxX], [a.y, b.y - a.y, minY, maxY]]) {
      if (Math.abs(delta) < 1e-9) {
        if (origin < min || origin > max) return null;
      } else {
        let first = (min - origin) / delta, last = (max - origin) / delta;
        if (first > last) [first, last] = [last, first];
        low = Math.max(low, first); high = Math.min(high, last);
        if (low > high) return null;
      }
    }
    return low;
  };
  const right = rect.x + rect.w, bottom = rect.y + rect.h;
  const broad = clip(rect.x - radius, rect.y - radius, right + radius, bottom + radius);
  if (broad === null || radius <= 0) return broad;
  const contactX = a.x + (b.x - a.x) * broad, contactY = a.y + (b.y - a.y) * broad;
  if ((contactX >= rect.x && contactX <= right) || (contactY >= rect.y && contactY <= bottom)) return broad;
  // A circular arrow/orb has rounded corner contact, not a square invisible rim.
  let first = null;
  const accept = t => { if (t !== null && (first === null || t < first)) first = t; };
  accept(clip(rect.x - radius, rect.y, right + radius, bottom));
  accept(clip(rect.x, rect.y - radius, right, bottom + radius));
  for (const x of [rect.x, right]) for (const y of [rect.y, bottom]) {
    accept(circleContact(a.x - x, a.y - y, b.x - x, b.y - y, radius));
  }
  return first;
}

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
  const overlap = minimum - gap, amount = overlap / 2;
  const ax = a.x, ay = a.y;
  a.x -= nx * amount; a.y -= ny * amount;
  resolveWalls(state, a);
  // Transfer displacement blocked by a wall to the free body instead of
  // leaving a persistent overlap that lets an opponent stand inside it.
  const moved = clamp((ax - a.x) * nx + (ay - a.y) * ny, 0, overlap);
  b.x += nx * (overlap - moved); b.y += ny * (overlap - moved);
  resolveWalls(state, b);
  const remaining = minimum - distance(a, b);
  if (remaining > 1e-7) {
    a.x -= nx * remaining; a.y -= ny * remaining;
    resolveWalls(state, a);
  }
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
  const cost = MOVES.roll.stamina - (f.boons.vigor || 0) * 2;
  if (f.stamina < cost) return false;
  f.buffers.roll = 0;
  f.stamina -= cost; f.staminaDelay = 48;
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
    angle, facing: angle, radius, damage: damage + (kind === 'arrow' ? (owner.boons?.bow || 0) * 3 : 0),
    pierce: kind === 'arrow' ? (owner.boons?.bow || 0) : 0, hitTargets: [], life: kind === 'orb' ? 210 : 140, reflected: false, bornTick: state.tick,
  };
  let coverContact = null;
  for (const obstacle of state.obstacles) {
    const t = rectContact(owner, projectile, obstacle, radius);
    if (t !== null && (coverContact === null || t < coverContact)) coverContact = t;
  }
  if (coverContact !== null) {
    const x = owner.x + (projectile.x - owner.x) * coverContact;
    const y = owner.y + (projectile.y - owner.y) * coverContact;
    emit(state, 'shoot', { fighter: owner.id, x, y, angle, move: kind });
    emit(state, 'arrowStop', { x, y, move: kind, reason: 'cover' });
    return;
  }
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
  if (!f.staminaDelay && f.action !== 'attack' && f.action !== 'roll' && f.action !== 'block' && !f.stun) f.stamina = Math.min(100, f.stamina + 0.4 + (f.boons.vigor || 0) * 0.12);
  if (state.mode === 'coop' && f.action !== 'roll' && state.hazards.some(h => h.kind === 'tide' && distance(f,h) < h.radius)) { f.vx *= 0.64; f.vy *= 0.64; }
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
      if (state.mode === 'coop' && target.boons.riposte) damageEntity(state, source, target, target.boons.riposte * 6, { parryable: false, move: 'riposte' });
    }
    if (state.mode === 'coop') target.hp = Math.min(target.maxHp, target.hp + (target.boons.riposte || 0) * 4);
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
    const result = damageEntity(state, target, source, MOVES.sword.damage + (source.boons.edge || 0) * 3, { guardDamage: MOVES.sword.guardDamage });
    if (result === 'hit' || result === 'block') source.landed = true;
    if (result === 'hit' && state.mode === 'coop') source.hp = Math.min(source.maxHp, source.hp + (source.boons.leech || 0) * 1.5);
  }
}

function updateProjectiles(state, previousPositions) {
  const remaining = [];
  for (const projectile of state.projectiles) {
    projectile.life -= 1;
    const old = { x: projectile.x, y: projectile.y };
    projectile.x += projectile.vx; projectile.y += projectile.vy;
    if (projectile.life <= 0) {
      emit(state, 'arrowStop', { x: projectile.x, y: projectile.y, move: projectile.kind, reason: 'expired' });
      continue;
    }
    let stop = null, reason = 'cover';
    for (const obstacle of state.obstacles) {
      const t = rectContact(old, projectile, obstacle, projectile.radius);
      if (t !== null && (stop === null || t < stop)) stop = t;
    }
    for (const [origin, end, min, max] of [[old.x, projectile.x, 38, 922], [old.y, projectile.y, 54, 586]]) {
      const t = origin < min || origin > max ? 0 : end < min ? (min - origin) / (end - origin) : end > max ? (max - origin) / (end - origin) : null;
      if (t !== null && (stop === null || t < stop)) { stop = t; reason = 'wall'; }
    }
    const targets = state.mode === 'coop'
      ? projectile.team === 'heroes' ? state.enemies : state.fighters
      : state.fighters.filter(f => playerTeam(state, f.id) !== projectile.team);
    let consumed = false, parried = false;
    const contacts = [];
    for (const target of targets) {
      if (!alive(target) || target.invulnerable || (projectile.hitTargets || []).includes(target.id)) continue;
      const previous = projectile.bornTick === state.tick ? target : previousPositions.get(target.id) || target;
      const t = circleContact(old.x - previous.x, old.y - previous.y, projectile.x - target.x, projectile.y - target.y, target.radius + projectile.radius);
      // Cover wins ties; bodies in front of it still receive the earlier hit.
      if (t !== null && (stop === null || t < stop - 1e-8)) contacts.push({ target, t });
    }
    contacts.sort((a, b) => a.t - b.t || a.target.id - b.target.id);
    for (const { target } of contacts) {
      const source = { id: projectile.owner, x: target.x - projectile.vx * 2, y: target.y - projectile.vy * 2 };
      const result = damageEntity(state, target, source, projectile.damage, { guardDamage: projectile.kind === 'orb' ? 22 : 14, knockback: 2.5, hitstun: 18, move: projectile.kind, projectile: true });
      if (result === 'parry') {
        parried = true;
        const speed = Math.hypot(projectile.vx, projectile.vy);
        projectile.owner = target.id; projectile.team = playerTeam(state, target.id); projectile.reflected = true;
        projectile.angle = target.facing; projectile.facing = target.facing;
        projectile.vx = Math.cos(target.facing) * speed; projectile.vy = Math.sin(target.facing) * speed;
        projectile.x = target.x + Math.cos(target.facing) * (target.radius + projectile.radius + 4);
        projectile.y = target.y + Math.sin(target.facing) * (target.radius + projectile.radius + 4);
        projectile.damage = Math.min(24, projectile.damage + 4); projectile.life = 140;
      } else if (result !== 'evade') {
        (projectile.hitTargets ||= []).push(target.id);
        if (result === 'hit' && projectile.pierce > 0) projectile.pierce -= 1;
        else consumed = true;
      }
      if (consumed || result === 'parry') break;
    }
    if (!consumed && !parried && stop !== null) {
      emit(state, 'arrowStop', { x: old.x + projectile.vx * stop, y: old.y + projectile.vy * stop, move: projectile.kind, reason });
    } else if (!consumed) remaining.push(projectile);
  }
  state.projectiles = remaining;
}

const ENEMY_STATS = Object.freeze({
  slime: { radius: 18, hp: 40, speed: 1.04, windup: 48, active: 22, recovery: 58, reach: 36, damage: 10 },
  bat: { radius: 13, hp: 26, speed: 1.65, windup: 36, active: 18, recovery: 50, reach: 26, damage: 7 },
  knight: { radius: 20, hp: 70, speed: 0.93, windup: 55, active: 14, recovery: 65, reach: 75, damage: 16 },
  caster: { radius: 16, hp: 42, speed: 1.1, windup: 68, active: 12, recovery: 100, reach: 300, damage: 10 },
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
    ['boss', 'bat', 'bat'],
    ['slime', 'caster', 'bat', 'knight', 'caster'],
    ['knight', 'caster', 'caster', 'bat', 'bat', 'knight'],
    ['boss', 'caster', 'bat'],
    ['knight', 'caster', 'slime', 'bat', 'caster', 'bat'],
    ['caster', 'knight', 'knight', 'caster', 'bat', 'bat', 'slime'],
    ['boss', 'caster', 'knight'],
  ][wave - 1];
  const positions = [{ x: 170, y: 145 }, { x: 790, y: 145 }, { x: 480, y: 150 }, { x: 160, y: 450 }, { x: 800, y: 450 }, { x: 430, y: 270 }, { x: 530, y: 270 }];
  state.wave = wave; state.round = wave; state.waveDelay = 0;
  state.roomBreak = false; state.shrineChoices = []; state.boonSelections = [null, null];
  state.biome = { ...BIOMES[Math.floor((wave - 1) / 3)], index: Math.floor((wave - 1) / 3) };
  state.roomName = ROOM_NAMES[wave - 1]; state.obstacles = roomObstacles(wave);
  state.projectiles = []; state.hazards = [];
  state.enemies = roster.map((type, index) => makeEnemy(state, type, type === 'boss' ? 480 : positions[index].x, type === 'boss' ? 165 : positions[index].y));
  for (const enemy of state.enemies) {
    const bonus = state.biome.index * (enemy.type === 'boss' ? 55 : 8);
    enemy.hp += bonus; enemy.maxHp = enemy.hp; enemy.variant = state.biome.id;
    if (enemy.type === 'boss') enemy.name = state.biome.boss;
    resolveWalls(state, enemy);
  }
  state.fighters.forEach(f => resolveWalls(state,f));
  if (state.biome.id === 'crypt') state.hazards = [{kind:'tide',x:420,y:290,radius:56},{kind:'tide',x:560,y:420,radius:48}];
  if (state.biome.id === 'ember') state.hazards = [{kind:'fire',x:410,y:286,radius:42,offset:0},{kind:'fire',x:552,y:390,radius:42,offset:160}];
  state.objective = wave % 3 === 0 ? `${state.roomName} · Defeat the ${state.biome.boss}.` : `Room ${wave} of 9 · ${state.roomName}. Guard beside a fallen ally to revive.`;
  emit(state, 'wave', { wave, boss: wave % 3 === 0, x: 480, y: 240 });
}

function enterShrineRoom(state) {
  state.roomBreak = true; state.projectiles = []; state.hazards = [];
  state.boonSelections = [null, null]; state.waveDelay = 0;
  const ids = Object.keys(BOONS), offset = (state.wave - 1) % 2 * 3;
  state.shrineChoices = ids.slice(offset,offset+3).map((id,index) => ({id,...BOONS[id],x:320+index*160,y:340}));
  state.fighters.forEach(f => {
    f.hp = Math.min(f.maxHp,(f.downed ? 35 : f.hp)+22); f.downed=false; f.reviveProgress=0;
    f.stamina=100; f.guard=100; f.stun=0; f.guardBroken=0; f.action='idle'; f.actionFrame=0;
    f.buffers={attack:0,roll:0,shoot:0}; f.reviveShield=75;
  });
  state.objective = 'Room clear · Each hero: walk to a shrine and hold Guard to choose a boon.';
  emit(state,'waveClear',{wave:state.wave,x:480,y:320});
}
export function chooseBoon(state, fighterId, id) {
  const f = state.fighters[fighterId], option=state.shrineChoices.find(choice => choice.id===id);
  if (state.mode !== 'coop' || !state.roomBreak || !f || state.boonSelections[fighterId] || !option) return false;
  f.boons[id] = (f.boons[id] || 0)+1;
  if (id==='ward') { f.maxHp += 12; f.hp=Math.min(f.maxHp,f.hp+18); }
  state.boonSelections[fighterId]=id;
  emit(state,'boon',{fighter:fighterId,x:f.x,y:f.y,boon:id});
  if (state.boonSelections.every(Boolean)) { state.waveDelay=TICK_RATE*3; state.objective=`Boons chosen · Next: ${ROOM_NAMES[state.wave]}.`; }
  return true;
}
function updateShrines(state,inputs) {
  state.fighters.forEach((f,index) => {
    const peaceful={...inputs[index],attack:false,shoot:false};
    f.buffers.attack=0; f.buffers.shoot=0; updateFighter(state,f,peaceful);
    if (inputs[index].block && !state.boonSelections[index]) {
      const choice=state.shrineChoices.find(option => distance(f,option)<54);
      if (choice) chooseBoon(state,index,choice.id);
    }
  });
  separate(state,...state.fighters);
  if (state.waveDelay>0 && --state.waveDelay===0) spawnWave(state,state.wave+1);
}

function updateHazards(state) {
  for (const hazard of state.hazards) {
    if (hazard.kind !== 'fire') continue;
    const cycle=(state.elapsedTicks+hazard.offset)%360;
    hazard.active=cycle>=300; hazard.warning=cycle>=210 && cycle<300; hazard.progress=hazard.warning ? (cycle-210)/90 : 0;
    if (cycle === 300) { hazard.hitTargets=[]; emit(state,'slam',{x:hazard.x,y:hazard.y}); }
    if (!hazard.active) continue;
    for (const f of state.fighters) if (alive(f) && !(hazard.hitTargets || []).includes(f.id) && distance(f,hazard)<hazard.radius+f.radius) {
      const result=damageEntity(state,f,{id:-1,x:hazard.x,y:hazard.y},13,{parryable:false,move:'fire'});
      if (result !== 'evade') (hazard.hitTargets ||= []).push(f.id);
    }
  }
}

// A small visibility graph keeps ground enemies from sticking behind pillars.
function pathWaypoint(state, entity, goal) {
  // Leave a tiny tolerance at a wall contact. Inflating beyond the actor's
  // radius would put an already-touching actor inside the navigation obstacle,
  // making every exit segment appear blocked after knockback or separation.
  const padding = Math.max(0, entity.radius - 0.1);
  // A smaller hero may stand inside the larger enemy's inflated wall boundary.
  // Route to a reachable adjacent point, while retaining the real hero for
  // attack range and facing. Otherwise the graph has no edge to its goal.
  goal = { x: goal.x, y: goal.y };
  for (const rect of state.obstacles) {
    const margin = padding + 1;
    if (goal.x > rect.x-margin && goal.x < rect.x+rect.w+margin && goal.y > rect.y-margin && goal.y < rect.y+rect.h+margin) {
      const sides = [{x:rect.x-margin,y:goal.y},{x:rect.x+rect.w+margin,y:goal.y},
        {x:goal.x,y:rect.y-margin},{x:goal.x,y:rect.y+rect.h+margin}];
      goal = sides.sort((a,b)=>distance(a,goal)-distance(b,goal))[0];
    }
  }
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
  enemy.attackKind = enemy.type === 'caster' ? 'fan' : 'melee';
  if (enemy.type === 'boss') {
    const patterns = enemy.variant === 'crypt' ? ['fan', 'slam', 'burst']
      : enemy.variant === 'ember' ? ['charge', 'slam', 'crown'] : ['slam', 'melee', 'burst'];
    enemy.attackKind = patterns[(enemy.attackId - 1) % patterns.length];
  }
  // Derive the warning and hit geometry after the biome chooses its pattern.
  // A prior slam must never leave a radial warning on a later fan or charge.
  enemy.windupTicks = stats.windup; enemy.activeTicks = stats.active;
  enemy.reach = stats.reach; enemy.telegraphRadius = 0;
  enemy.telegraphLength = 0; enemy.telegraphHalfArc = enemy.type === 'knight' ? 1.25 : .95;
  if (enemy.attackKind === 'slam') {
    enemy.reach = 128; enemy.telegraphRadius = 128; enemy.windupTicks = 72;
  } else if (enemy.attackKind === 'charge') {
    enemy.reach = 64; enemy.windupTicks = 90; enemy.activeTicks = 38;
    enemy.telegraphLength = 5.4 * enemy.activeTicks + enemy.reach;
  } else if (enemy.attackKind === 'fan') {
    enemy.reach = 300; enemy.telegraphHalfArc = .4;
    enemy.windupTicks = enemy.type === 'boss' ? 90 : stats.windup;
  } else if (enemy.attackKind === 'crown') enemy.windupTicks = 90;
  else if (enemy.attackKind === 'burst') enemy.windupTicks = 84;
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
      if (enemy.attackKind === 'fan') for (let index=-2;index<=2;index++) spawnProjectile(state,enemy,enemy.attackFacing+index*0.2,{kind:'orb',damage:enemy.type==='boss'?13:9,speed:3.7,team:'enemies'});
      if (enemy.attackKind === 'crown') for (let index=0;index<12;index++) spawnProjectile(state,enemy,enemy.attackFacing+index*Math.PI/6,{kind:'orb',damage:15,speed:index%2?2.7:4.2,team:'enemies'});
    }
  } else if (enemy.action === 'attack') {
    const speed = enemy.attackKind === 'charge' ? 5.4 : enemy.type === 'slime' ? 3.1 : enemy.type === 'bat' ? 4.7 : enemy.type === 'knight' ? 1.1 : 0;
    enemy.vx = Math.cos(enemy.attackFacing) * speed; enemy.vy = Math.sin(enemy.attackFacing) * speed;
    if (enemy.actionFrame >= enemy.activeTicks) {
      enemy.action = 'recover'; enemy.actionFrame = 0; enemy.cooldown = stats.recovery;
    }
  } else if (enemy.action === 'recover') {
    enemy.vx *= 0.72; enemy.vy *= 0.72;
    if (enemy.actionFrame >= 20) { enemy.action = 'idle'; enemy.actionFrame = 0; }
  } else {
    const gap = distance(enemy, target);
    const engageDistance = enemy.type === 'caster' ? 310 : enemy.type === 'boss' ? enemy.variant==='garden'?144:300 : enemy.type === 'knight' ? 90 : enemy.type === 'bat' ? 118 : 98;
    if (!enemy.cooldown && gap < engageDistance && clearLine(state, enemy, target, 4)) beginEnemyAttack(state, enemy, target);
    else {
      if ((state.tick + enemy.id * 3) % 18 === 0 || distance(enemy, { x: enemy.navX, y: enemy.navY }) < 8) {
        const waypoint = pathWaypoint(state, enemy, target);
        enemy.navX = waypoint.x; enemy.navY = waypoint.y;
      }
      const navigation = angleTo(enemy, { x: enemy.navX, y: enemy.navY });
      enemy.facing = angleTo(enemy, target);
      const approach = gap > (enemy.type==='caster'?235:56) || enemy.type === 'boss' && gap > 102;
      const orbit = enemy.type === 'bat' && enemy.cooldown > 10 && gap < 110;
      const retreat=enemy.type==='caster' && gap<170 && clearLine(state,enemy,target,enemy.radius);
      enemy.vx = Math.cos(retreat?enemy.facing+Math.PI:navigation + (orbit ? Math.PI / 2 : 0)) * stats.speed * (approach || orbit || retreat ? 1 : 0.15);
      enemy.vy = Math.sin(retreat?enemy.facing+Math.PI:navigation + (orbit ? Math.PI / 2 : 0)) * stats.speed * (approach || orbit || retreat ? 1 : 0.15);
      enemy.action = 'run';
      enemy.guarded = enemy.type === 'knight' && !enemy.guardBroken && enemy.stamina > 0 && enemy.cooldown > 24;
    }
  }
  moveEntity(state, enemy);
}

function resolveEnemyAttacks(state) {
  for (const enemy of state.enemies) {
    if (!alive(enemy) || enemy.action !== 'attack' || ['burst','fan','crown'].includes(enemy.attackKind)) continue;
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
  state.objective = result === 'victory' ? 'Victory · All nine rooms and three guardians defeated. The last hearth is rekindled.' : 'Both adventurers have fallen. Ready up to try again.';
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
  if (state.mode === 'coop' && state.roomBreak) { updateShrines(state,inputs); return state; }
  if (state.mode === 'duel') state.roundTicks = Math.max(0, state.roundTicks - 1);
  const previousPositions = new Map([...state.fighters, ...state.enemies].map(entity => [entity.id, { x: entity.x, y: entity.y }]));
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
  updateProjectiles(state, previousPositions);
  if (state.mode === 'coop') updateHazards(state);

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
      else enterShrineRoom(state);
    }
  }
  return state;
}
