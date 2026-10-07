/** Oddstock Rumble: deterministic, server-authoritative 120 Hz platform combat. */
export const TICK_RATE = 120;
export const WORLD = Object.freeze({ width: 1200, height: 720, blastLeft: -150, blastRight: 1350, blastTop: -190, blastBottom: 890, roundSeconds: 240 });
export const INPUT_KEYS = Object.freeze(['left', 'right', 'up', 'down', 'jump', 'attack', 'special', 'shield', 'dodge']);
export const emptyInput = () => Object.fromEntries(INPUT_KEYS.map(key => [key, false]));
export const cloneState = state => JSON.parse(JSON.stringify(state));
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const character = (id, name, role, description, color, stats, moves) => Object.freeze({ id, name, role, description, color, ...stats, ...moves });
const attack = (damage, reach, startup, active, total, kb, scale) => Object.freeze({ damage, reach, startup, active, total, kb, scale });
export const CHARACTERS = Object.freeze({
  wrench: character('wrench', 'Captain Wrench', 'VERSATILE REPAIRMAN', 'An over-equipped handyman with a returning wrench and an alarming safety record.', '#e6a56e', { speed: 4.2, jump: 12.3, airJumps: 1, weight: 1.05, gravity: .48, recovery: 15, width: 36, height: 52 }, { attack: attack(10, 59, 9, 7, 32, 4.2, 8.5), specialName: 'Return to Sender', recoveryName: 'Corkscrew Repair', downName: 'Toolbox Drop', projectile: 'wrench' }),
  sprout: character('sprout', 'Sir Sprout', 'DRAMATIC DUELIST', 'A forest knight whose speeches are longer than his leafy sword.', '#98bf77', { speed: 4.6, jump: 13.2, airJumps: 1, weight: .95, gravity: .47, recovery: 15.8, width: 34, height: 56 }, { attack: attack(9, 79, 7, 7, 29, 3.7, 8), specialName: 'Leaf of Absence', recoveryName: 'Vine and Glory', downName: 'Root Rebuttal', projectile: 'leaf' }),
  moth: character('moth', 'Mochi Moth', 'FLOATY DISTURBANCE', 'A round, hungry moth who mistakes every arena lamp for dinner.', '#d9b3d8', { speed: 3.8, jump: 10.8, airJumps: 2, weight: .78, gravity: .35, recovery: 12, width: 40, height: 40 }, { attack: attack(8, 48, 6, 10, 28, 4.8, 8.2), specialName: 'Snack-Sized Gust', recoveryName: 'Emergency Flutter', downName: 'Crumb Dive', projectile: null }),
  parcel: character('parcel', 'Parcel-9', 'DELIVERY SPECIALIST', 'An underpaid space courier, delivering explosive parcels with impeccable paperwork.', '#95b8d9', { speed: 4.75, jump: 13, airJumps: 1, weight: .9, gravity: .48, recovery: 16.8, width: 34, height: 50 }, { attack: attack(8, 55, 6, 6, 26, 3.6, 7.8), specialName: 'Fragile Delivery', recoveryName: 'Express Jetpack', downName: 'Priority Landing', projectile: 'parcel' }),
  zap: character('zap', 'Zap Rat', 'QUICK LITTLE MENACE', 'A vain thunder rodent whose best hair day is everyone else’s electrical problem.', '#e4cb71', { speed: 5.25, jump: 12.2, airJumps: 1, weight: .83, gravity: .5, recovery: 16, width: 32, height: 44 }, { attack: attack(7, 46, 5, 6, 23, 3.6, 7.5), specialName: 'Static Complaint', recoveryName: 'Short Circuit', downName: 'Grounded Ego', projectile: 'spark' }),
  bulk: character('bulk', 'Don Bulk', 'RETIRED HEAVYWEIGHT', 'A gorilla pensioner with reading glasses, a cardigan, and a devastating right hook.', '#b79476', { speed: 3.25, jump: 11.8, airJumps: 1, weight: 1.35, gravity: .55, recovery: 14.2, width: 44, height: 60 }, { attack: attack(15, 69, 14, 8, 43, 5.4, 10.3), specialName: 'Pension Punch', recoveryName: 'Back in My Day', downName: 'Heavy Retirement', projectile: null }),
});
const platform = (id, x, y, w, h = 14, solid = false) => Object.freeze({ id, x, y, w, h, solid, drop: !solid });
export const STAGES = Object.freeze({
  rooftop: Object.freeze({ id: 'rooftop', name: 'Overtime Rooftop', description: 'A narrow rooftop with a high center perch and announced crosswinds.', platforms: Object.freeze([platform('main', 210, 580, 780, 30, true), platform('left', 260, 425, 200), platform('right', 740, 425, 200), platform('top', 500, 285, 200)]), hazards: Object.freeze([{ id: 'wind', type: 'wind', x: 180, y: 80, w: 840, h: 500, period: 840, warningStart: 540, activeStart: 600, activeEnd: 720, damage: 0 }]) }),
  garden: Object.freeze({ id: 'garden', name: 'Dramatic Gardens', description: 'A broad garden, uneven perches, and an overenthusiastic fountain.', platforms: Object.freeze([platform('main', 130, 570, 940, 30, true), platform('left', 230, 410, 210), platform('middle', 510, 335, 180), platform('right', 790, 390, 180)]), hazards: Object.freeze([{ id: 'fountain', type: 'fountain', x: 548, y: 385, w: 104, h: 185, period: 720, warningStart: 450, activeStart: 510, activeEnd: 560, damage: 7 }]) }),
  foundry: Object.freeze({ id: 'foundry', name: 'Warranty Foundry', description: 'Wide industrial platforms and two clearly marked steam vents.', platforms: Object.freeze([platform('main', 170, 570, 860, 30, true), platform('left', 210, 395, 250), platform('right', 740, 395, 250), platform('middle', 480, 470, 240)]), hazards: Object.freeze([{ id: 'steam-left', type: 'steam', x: 360, y: 365, w: 70, h: 205, period: 900, warningStart: 580, activeStart: 640, activeEnd: 720, damage: 11 }, { id: 'steam-right', type: 'steam', x: 770, y: 365, w: 70, h: 205, period: 900, warningStart: 160, activeStart: 220, activeEnd: 300, damage: 11 }]) }),
});

function fighter(id, characterId = null) {
  const stats = CHARACTERS[characterId] || CHARACTERS.wrench;
  return { id, characterId, selected: characterId !== null, x: id === 0 ? 380 : 820, y: 490,
    vx: 0, vy: 0, radius: 18, width: stats.width, height: stats.height, stocks: 3, damage: 0, wins: 0,
    facing: id === 0 ? 1 : -1, grounded: false, onPlatform: null, jumpsLeft: stats.airJumps,
    coyote: 0, jumpBuffer: 0, dropTicks: 0, recoveryUsed: false, airDodgeUsed: false,
    action: 'idle', actionFrame: 0, actionDuration: 0, move: null, attackId: 0, hitTargets: [],
    stun: 0, shield: 100, shieldTicks: 0, shieldBreakTicks: 0, dodgeCooldown: 0, dodgeX: 0, dodgeY: 0,
    invulnerable: false, invulnerableTicks: 0, respawnTicks: 0, previousInput: emptyInput(),
    attackBuffer: 0, specialBuffer: 0, hazardHits: {}, lastHitBy: null,
  };
}

export function createState() {
  return { gameId: 'oddstock-rumble', tick: 0, phase: 'lobby', phaseTicks: 0, round: 1,
    roundTicks: WORLD.roundSeconds * TICK_RATE, winner: null, result: null,
    stageId: 'rooftop', stageSelected: false, platforms: STAGES.rooftop.platforms.map(p => ({ ...p })),
    fighters: [fighter(0), fighter(1)], projectiles: [], hazards: [], events: [], eventId: 0, projectileId: 0,
    elapsedTicks: 0, objective: 'Three stocks. Damage builds knockback. Be the last comic standing.' };
}
function emit(state, type, data = {}) {
  state.events.push({ id: ++state.eventId, tick: state.tick, type, ...data });
  if (state.events.length > 64) state.events.splice(0, state.events.length - 64);
}
export const selectionComplete = state => state.stageSelected && state.fighters.every(f => f.selected && Object.hasOwn(CHARACTERS, f.characterId));
export function select(state, playerId, choice) {
  if (state.phase !== 'lobby') return { ok: false, error: 'Choose a comic and stage in the lobby.' };
  if (![0, 1].includes(playerId) || !choice || typeof choice !== 'object' || Array.isArray(choice)
    || Object.keys(choice).some(key => !['character', 'stage'].includes(key)) || !Object.keys(choice).length) return { ok: false, error: 'Choose a valid comic or stage.' };
  if (Object.hasOwn(choice, 'character') && (typeof choice.character !== 'string' || !Object.hasOwn(CHARACTERS, choice.character))) return { ok: false, error: 'Choose one of the six available comics.' };
  if (Object.hasOwn(choice, 'stage') && (playerId !== 0 || typeof choice.stage !== 'string' || !Object.hasOwn(STAGES, choice.stage))) return { ok: false, error: 'Player one chooses an available stage.' };
  let changed = false, stageChanged = false;
  if (choice.character !== undefined) {
    changed = state.fighters[playerId].characterId !== choice.character;
    state.fighters[playerId] = fighter(playerId, choice.character);
  }
  if (choice.stage !== undefined) {
    stageChanged = !state.stageSelected || state.stageId !== choice.stage;
    state.stageId = choice.stage; state.stageSelected = true;
    state.platforms = STAGES[choice.stage].platforms.map(p => ({ ...p }));
  }
  return { ok: true, changed: changed || stageChanged, stageChanged };
}
export function clearSelection(state, id) {
  state.fighters[id] = fighter(id);
  if (id === 0) state.stageSelected = false;
}
export function resetLobby(state) {
  const tick = state.tick, eventId = state.eventId;
  const stageId = state.stageId, stageSelected = state.stageSelected;
  const choices = state.fighters.map(f => f.characterId);
  Object.assign(state, createState(), { tick, eventId, stageId, stageSelected });
  state.platforms = STAGES[stageId].platforms.map(p => ({ ...p }));
  state.fighters = choices.map((id, i) => fighter(i, id));
  return state;
}
export function startMatch(state) {
  if (!selectionComplete(state)) return state;
  resetLobby(state);
  const main = state.platforms.find(p => p.solid);
  state.fighters.forEach((f, id) => { f.x = main.x + main.w * (id === 0 ? .25 : .75); f.y = main.y - f.height / 2; f.grounded = true; f.onPlatform = main.id; });
  state.phase = 'countdown'; state.phaseTicks = TICK_RATE * 3;
  emit(state, 'match', { stage: state.stageId });
  return state;
}

function input(f, raw) {
  const next = emptyInput();
  for (const key of INPUT_KEYS) next[key] = raw?.[key] === true;
  if (next.jump && !f.previousInput.jump) f.jumpBuffer = 8;
  if (next.attack && !f.previousInput.attack) f.attackBuffer = 8;
  if (next.special && !f.previousInput.special) f.specialBuffer = 8;
  return next;
}
function beginMove(state, f, controls, special) {
  const stats = CHARACTERS[f.characterId];
  const direction = controls.up && !controls.down ? 'up' : controls.down && !controls.up ? 'down' : controls.left || controls.right ? 'side' : 'neutral';
  if (special && direction === 'up') {
    if (f.recoveryUsed) return false;
    f.recoveryUsed = true; f.grounded = false; f.onPlatform = null;
    f.vy = -stats.recovery; f.vx = ((controls.right ? 1 : 0) - (controls.left ? 1 : 0)) * (f.characterId === 'parcel' ? 6.8 : f.characterId === 'zap' ? 7.5 : 3);
    f.move = { name: stats.recoveryName, kind: 'recovery', direction: 'up', startup: 3, active: 18, total: 36, damage: f.characterId === 'bulk' ? 14 : 8, reach: 45, kb: 4.4, scale: 7, angle: -Math.PI / 2 };
    f.action = 'recovery';
  } else {
    const basic = stats.attack;
    const down = special && direction === 'down';
    const kind = special ? down ? 'slam' : stats.projectile ? 'projectile' : 'burst' : 'melee';
    const airborne = !f.grounded;
    f.move = { name: special ? down ? stats.downName : stats.specialName : `${airborne ? 'Air ' : ''}${direction}`, kind, direction,
      startup: special ? down ? 13 : f.characterId === 'bulk' ? 25 : 14 : basic.startup,
      active: special ? 8 : basic.active, total: special ? f.characterId === 'bulk' ? 57 : 42 : basic.total,
      damage: special ? down ? basic.damage + 5 : f.characterId === 'bulk' ? 25 : f.characterId === 'moth' ? 9 : 12 : basic.damage + (direction === 'up' ? 1 : direction === 'down' && airborne ? 2 : 0),
      reach: special ? f.characterId === 'moth' ? 93 : basic.reach + 13 : basic.reach,
      kb: special ? basic.kb + 1.7 : basic.kb,
      scale: special ? basic.scale + 2 : basic.scale,
      angle: direction === 'up' ? -Math.PI / 2 : direction === 'down' && airborne ? Math.PI / 2 : -Math.PI / 7,
      airborne, fired: false,
    };
    f.action = special ? 'special' : 'attack';
    if (down && airborne) f.vy = 14;
  }
  f.actionFrame = 0; f.actionDuration = f.move.total; f.attackId += 1; f.hitTargets = [];
  f.attackBuffer = 0; f.specialBuffer = 0;
  emit(state, 'move', { fighter: f.id, name: f.move.name, kind: f.move.kind, x: f.x, y: f.y, facing: f.facing });
  return true;
}

function contact(ax, ay, bx, by, rect, padding = 0) {
  let low = 0, high = 1;
  for (const [origin, delta, min, max] of [[ax, bx - ax, rect.x - padding, rect.x + rect.w + padding], [ay, by - ay, rect.y - padding, rect.y + rect.h + padding]]) {
    if (Math.abs(delta) < 1e-9) { if (origin < min || origin > max) return null; }
    else { let a = (min - origin) / delta, b = (max - origin) / delta; if (a > b) [a, b] = [b, a]; low = Math.max(low, a); high = Math.min(high, b); if (low > high) return null; }
  }
  return high < 0 || low > 1 ? null : low;
}

function circleContact(ax, ay, bx, by, rect, radius) {
  // A circle expands a rectangle into rounded corners, not a larger square.
  // The two edge strips and four corner circles form that exact outline.
  let first = null;
  for (const strip of [
    { x: rect.x - radius, y: rect.y, w: rect.w + radius * 2, h: rect.h },
    { x: rect.x, y: rect.y - radius, w: rect.w, h: rect.h + radius * 2 },
  ]) {
    const t = contact(ax, ay, bx, by, strip);
    if (t !== null && (first === null || t < first)) first = t;
  }
  const dx = bx - ax, dy = by - ay, length = dx * dx + dy * dy;
  for (const x of [rect.x, rect.x + rect.w]) for (const y of [rect.y, rect.y + rect.h]) {
    const ox = ax - x, oy = ay - y, distance = ox * ox + oy * oy - radius * radius;
    if (distance <= 0) return 0;
    if (length < 1e-12) continue;
    const along = ox * dx + oy * dy, discriminant = along * along - length * distance;
    if (discriminant < 0) continue;
    const t = (-along - Math.sqrt(discriminant)) / length;
    if (t >= 0 && t <= 1 && (first === null || t < first)) first = t;
  }
  return first;
}

const body = f => ({ x: f.x - f.width / 2, y: f.y - f.height / 2, w: f.width, h: f.height });
function circleTouchesBody(x, y, radius, f) {
  return Math.hypot(x - clamp(x, f.x - f.width / 2, f.x + f.width / 2),
    y - clamp(y, f.y - f.height / 2, f.y + f.height / 2)) <= radius;
}

function blastReachesBody(state, x, y, radius, f) {
  if (!circleTouchesBody(x, y, radius, f)) return false;
  const rect = body(f), covers = state.platforms.filter(platform => platform.solid);
  const visible = (px, py) => Math.hypot(px - x, py - y) <= radius + 1e-8 &&
    !covers.some(platform => contact(x, y, px, py, platform) !== null);
  // Cover can hide the nearest point while leaving an arm or leg exposed.
  // Split each body edge where the blast circle or a cover corner's shadow
  // crosses it. Within each resulting interval visibility cannot change.
  for (const [vertical, fixed, min, max] of [
    [true, rect.x, rect.y, rect.y + rect.h], [true, rect.x + rect.w, rect.y, rect.y + rect.h],
    [false, rect.y, rect.x, rect.x + rect.w], [false, rect.y + rect.h, rect.x, rect.x + rect.w],
  ]) {
    const origin = vertical ? x : y, other = vertical ? y : x;
    const cuts = [min, max, clamp(other, min, max)];
    const add = value => { if (value >= min && value <= max) cuts.push(value); };
    const distance = Math.abs(fixed - origin);
    if (distance <= radius) {
      const span = Math.sqrt(radius * radius - distance * distance);
      add(other - span); add(other + span);
    }
    for (const platform of covers) for (const cx of [platform.x, platform.x + platform.w]) for (const cy of [platform.y, platform.y + platform.h]) {
      const direction = (vertical ? cx : cy) - origin;
      if (Math.abs(direction) < 1e-9) continue;
      const t = (fixed - origin) / direction;
      if (t >= 0) add(other + ((vertical ? cy : cx) - other) * t);
    }
    cuts.sort((a, b) => a - b);
    for (let index = 0; index < cuts.length; index++) {
      const point = cuts[index];
      if (visible(vertical ? fixed : point, vertical ? point : fixed)) return true;
      if (index === 0) continue;
      const midpoint = (cuts[index - 1] + point) / 2;
      if (visible(vertical ? fixed : midpoint, vertical ? midpoint : fixed)) return true;
    }
  }
  return false;
}

function platformContact(f, p, dx, dy) {
  const minX = p.x - f.width / 2, maxX = p.x + p.w + f.width / 2;
  const minY = p.y - f.height / 2, maxY = p.y + p.h + f.height / 2;
  if (!p.solid) {
    if (f.dropTicks > 0 || dy <= 0 || f.y > minY + 1e-8) return null;
    const t = Math.max(0, (minY - f.y) / dy), x = f.x + dx * t;
    return t <= 1 && x > minX && x < maxX ? { t, nx: 0, ny: -1 } : null;
  }
  let entry = -Infinity, exit = Infinity, nx = 0, ny = 0;
  for (const [origin, delta, min, max, axis] of [[f.x, dx, minX, maxX, 'x'], [f.y, dy, minY, maxY, 'y']]) {
    if (Math.abs(delta) < 1e-9) {
      // Sliding along an edge must not count as entering its interior.
      if (origin <= min || origin >= max) return null;
      continue;
    }
    let near = (min - origin) / delta, far = (max - origin) / delta;
    if (near > far) [near, far] = [far, near];
    if (near >= entry) { entry = near; nx = axis === 'x' ? -Math.sign(delta) : 0; ny = axis === 'y' ? -Math.sign(delta) : 0; }
    exit = Math.min(exit, far);
  }
  if (entry < -1e-8 || entry > 1 || entry > exit || exit <= 0) return null;
  return { t: Math.max(0, entry), nx, ny };
}

function physics(state, f, controls) {
  const stats = CHARACTERS[f.characterId];
  f.vy = Math.min(controls.down && !f.grounded && f.stun === 0 ? 19 : 13, f.vy + stats.gravity * (controls.down && f.vy > 0 && f.stun === 0 ? 2 : 1));
  let dx = f.vx, dy = f.vy;
  f.grounded = false; f.onPlatform = null;
  let ground = null;
  for (let pass = 0; pass < 4 && (Math.abs(dx) > 1e-9 || Math.abs(dy) > 1e-9); pass++) {
    let first = null;
    for (const p of state.platforms) {
      const collision = platformContact(f, p, dx, dy);
      if (collision && (!first || collision.t < first.t)) first = { ...collision, platform: p };
    }
    if (!first) { f.x += dx; f.y += dy; break; }
    f.x += dx * first.t; f.y += dy * first.t;
    dx *= 1 - first.t; dy *= 1 - first.t;
    if (first.nx) { dx = 0; f.vx = 0; }
    if (first.ny) { dy = 0; f.vy = 0; if (first.ny < 0) ground = first.platform; }
  }
  if (ground && f.x + f.width / 2 > ground.x && f.x - f.width / 2 < ground.x + ground.w) {
    f.grounded = true; f.onPlatform = ground.id;
  }
  if (f.grounded) { f.jumpsLeft = stats.airJumps; f.recoveryUsed = false; f.airDodgeUsed = false; f.coyote = 8; }
}

function updateFighter(state, f, controls) {
  const stats = CHARACTERS[f.characterId];
  if (f.stocks === 0) { f.action = 'dead'; f.previousInput = controls; return; }
  if (f.respawnTicks > 0) {
    f.jumpBuffer = 0; f.attackBuffer = 0; f.specialBuffer = 0;
    f.respawnTicks -= 1; f.action = 'respawn'; f.invulnerable = true;
    if (f.respawnTicks === 0) {
      const main = state.platforms.find(p => p.solid);
      f.x = main.x + main.w * (f.id === 0 ? .35 : .65); f.y = 150; f.vx = 0; f.vy = 0;
      f.invulnerableTicks = 180; f.action = 'jump'; f.jumpsLeft = stats.airJumps;
      f.recoveryUsed = false; f.airDodgeUsed = false;
      emit(state, 'respawn', { fighter: f.id, x: f.x, y: f.y });
    }
    f.previousInput = controls; return;
  }
  f.invulnerableTicks = Math.max(0, f.invulnerableTicks - 1);
  f.invulnerable = f.invulnerableTicks > 0;
  f.dodgeCooldown = Math.max(0, f.dodgeCooldown - 1);
  f.dropTicks = Math.max(0, f.dropTicks - 1);
  f.coyote = Math.max(0, f.coyote - 1);
  const direction = (controls.right ? 1 : 0) - (controls.left ? 1 : 0);
  const movingAction = ['attack', 'special', 'recovery'].includes(f.action);
  if (f.shieldBreakTicks > 0) {
    f.shieldBreakTicks -= 1; f.stun = Math.max(f.stun, 1);
    if (f.shieldBreakTicks === 0) f.shield = 30;
  }
  if (f.stun > 0) {
    f.stun -= 1; f.action = 'hit'; f.move = null;
    f.vx = clamp(f.vx * .985 + direction * .065, -25, 25);
    f.vy += ((controls.down ? 1 : 0) - (controls.up ? 1 : 0)) * .045;
  } else if (f.action === 'dodge') {
    f.actionFrame += 1;
    f.invulnerable ||= f.actionFrame >= 4 && f.actionFrame <= 16;
    f.vx = f.dodgeX * (f.actionFrame < 17 ? 6.4 : 2.2);
    if (!f.grounded) f.vy = f.dodgeY * 5.3;
    if (f.actionFrame >= 24) f.action = f.grounded ? 'idle' : 'jump';
  } else if (movingAction && f.move) {
    f.actionFrame += 1;
    f.vx += (direction * stats.speed * .42 - f.vx) * (f.grounded ? .16 : .055);
    if (f.actionFrame >= f.move.total) { f.action = f.grounded ? 'idle' : 'jump'; f.move = null; }
  } else {
    if (direction) f.facing = direction;
    const shielding = controls.shield && f.grounded && f.shield > 0;
    if (shielding) {
      f.shieldTicks = f.previousInput.shield ? f.shieldTicks + 1 : 1;
      f.action = 'shield'; f.shield = Math.max(0, f.shield - .24); f.vx *= .65;
      if (f.shield === 0) { f.shieldBreakTicks = 90; f.stun = 90; emit(state, 'shieldBreak', { fighter: f.id, x: f.x, y: f.y }); }
    } else {
      f.shieldTicks = 0;
      f.action = f.grounded ? direction ? 'run' : 'idle' : 'jump';
      f.vx += (direction * stats.speed - f.vx) * (f.grounded ? .23 : .11);
      if (f.jumpBuffer > 0) {
        const p = state.platforms.find(p => p.id === f.onPlatform);
        if (controls.down && f.grounded && p?.drop) { f.dropTicks = 18; f.y += 3; f.vy = 2; f.grounded = false; f.onPlatform = null; f.jumpBuffer = 0; }
        else if (f.grounded || f.coyote > 0 || f.jumpsLeft > 0) {
          if (!f.grounded && f.coyote === 0) f.jumpsLeft -= 1;
          f.vy = -stats.jump; f.grounded = false; f.onPlatform = null; f.coyote = 0; f.jumpBuffer = 0;
          emit(state, 'jump', { fighter: f.id, x: f.x, y: f.y, remaining: f.jumpsLeft });
        }
      }
      if (f.specialBuffer > 0) beginMove(state, f, controls, true);
      else if (f.attackBuffer > 0) beginMove(state, f, controls, false);
    }
    if (controls.dodge && !f.previousInput.dodge && f.dodgeCooldown === 0 && (f.grounded || !f.airDodgeUsed)) {
      const dy = (controls.down ? 1 : 0) - (controls.up ? 1 : 0), length = Math.hypot(direction, dy);
      f.dodgeX = length ? direction / length : f.grounded ? f.facing : 0; f.dodgeY = length ? dy / length : 0;
      f.airDodgeUsed ||= !f.grounded; f.action = 'dodge'; f.actionFrame = 0; f.move = null;
      f.dodgeCooldown = 65; f.vx = f.dodgeX * 3;
      emit(state, 'dodge', { fighter: f.id, x: f.x, y: f.y });
    }
  }
  if (f.action !== 'shield' && f.shieldBreakTicks === 0) f.shield = Math.min(100, f.shield + .16);
  if (f.invulnerableTicks > 0 && ['attack', 'special', 'recovery'].includes(f.action)) { f.invulnerableTicks = 0; f.invulnerable = false; }
  physics(state, f, controls);
  f.jumpBuffer = Math.max(0, f.jumpBuffer - 1); f.attackBuffer = Math.max(0, f.attackBuffer - 1); f.specialBuffer = Math.max(0, f.specialBuffer - 1);
  f.previousInput = controls;
}

function hitsMelee(state, a, b) {
  if (!a.move || a.move.kind === 'projectile' || a.hitTargets.includes(b.id) || b.stocks === 0 || b.respawnTicks > 0 || b.invulnerable) return false;
  const move = a.move;
  if (a.actionFrame < move.startup || a.actionFrame >= move.startup + move.active) return false;
  const dx = (b.x - a.x) * a.facing, dy = b.y - a.y, reach = move.reach;
  if (state.platforms.some(p => p.solid && contact(a.x, a.y, b.x, b.y, p) !== null)) return false;
  if (move.kind === 'burst' || move.kind === 'slam' || move.direction === 'neutral' && move.airborne) return circleTouchesBody(a.x, a.y, reach, b);
  if (move.direction === 'up') return Math.abs(dx) < reach * .65 + b.width / 2 && dy < 16 && dy > -reach - b.height / 2;
  if (move.direction === 'down' && move.airborne) return Math.abs(dx) < reach * .6 + b.width / 2 && dy > -10 && dy < reach + b.height / 2;
  return dx > -a.width / 2 && dx < reach + b.width / 2 && Math.abs(dy) < 28 + b.height / 2;
}

function hit(state, target, source, move, direction = 1) {
  if (target.stocks === 0 || target.respawnTicks > 0 || target.invulnerable) return false;
  if (target.action === 'shield' && target.grounded) {
    if (target.shieldTicks <= 5 && target.shieldTicks > 0) {
      target.shield = Math.min(100, target.shield + 7);
      if (source !== null) { const attacker = state.fighters[source]; attacker.stun = Math.max(attacker.stun, 25); attacker.move = null; }
      emit(state, 'parry', { fighter: target.id, target: source, x: target.x, y: target.y });
    } else {
      target.shield = Math.max(0, target.shield - move.damage * 1.8); target.stun = 5; target.vx = direction * 1.4;
      if (target.shield === 0) { target.shieldBreakTicks = 90; target.stun = 90; emit(state, 'shieldBreak', { fighter: target.id, x: target.x, y: target.y }); }
      else emit(state, 'block', { fighter: target.id, x: target.x, y: target.y });
    }
    return true;
  }
  target.damage = Math.min(999, target.damage + move.damage);
  const stats = CHARACTERS[target.characterId];
  const power = Math.min(26, (move.kb + target.damage * move.scale / 100) / stats.weight);
  const influence = ((target.previousInput.down ? 1 : 0) - (target.previousInput.up ? 1 : 0)) * .13;
  const angle = move.angle + influence;
  target.vx = Math.cos(angle) * power * direction; target.vy = Math.sin(angle) * power;
  target.stun = Math.min(95, Math.round(12 + power * 3)); target.grounded = false; target.onPlatform = null;
  target.action = 'hit'; target.move = null; target.lastHitBy = source;
  target.attackBuffer = 0; target.specialBuffer = 0;
  emit(state, 'hit', { fighter: source, target: target.id, damage: move.damage, percent: target.damage, x: target.x, y: target.y });
  return true;
}

function spawnProjectiles(state) {
  for (const f of state.fighters) {
    if (!f.move || f.move.kind !== 'projectile' || f.move.fired || f.actionFrame < f.move.startup) continue;
    f.move.fired = true;
    if (state.projectiles.length >= 32) continue;
    const kind = CHARACTERS[f.characterId].projectile;
    state.projectiles.push({ id: ++state.projectileId, owner: f.id, kind, x: f.x + f.facing * 30, y: f.y - 4, vx: f.facing * (kind === 'spark' ? 9.5 : kind === 'wrench' ? 6.8 : 5.6), vy: kind === 'parcel' ? -4 : 0,
      radius: kind === 'parcel' ? 11 : kind === 'wrench' ? 10 : 7, damage: kind === 'parcel' ? 18 : f.move.damage, life: kind === 'wrench' ? 120 : kind === 'parcel' ? 80 : 105, age: 0, hitTargets: [] });
    emit(state, 'projectile', { fighter: f.id, kind, x: f.x, y: f.y });
  }
}

function updateProjectiles(state, previousBodies, existingProjectileCount) {
  const remaining = [];
  for (let index = 0; index < state.projectiles.length; index++) {
    const p = state.projectiles[index];
    p.age += 1; p.life -= 1;
    if (p.kind === 'parcel') p.vy += .14;
    if (p.kind === 'wrench' && p.age > 45) {
      const owner = state.fighters[p.owner], length = Math.hypot(owner.x - p.x, owner.y - p.y) || 1;
      p.vx = (owner.x - p.x) / length * 7.8; p.vy = (owner.y - p.y) / length * 7.8;
      if (length < owner.width / 2 + p.radius && p.age > 55) continue;
    }
    const x = p.x + p.vx, y = p.y + p.vy;
    let first = null, target = null;
    for (const platform of state.platforms.filter(platform => platform.solid)) {
      const t = circleContact(p.x, p.y, x, y, platform, p.radius);
      if (t !== null && (first === null || t < first)) { first = t; target = null; }
    }
    const opponent = state.fighters[1 - p.owner];
    if (!p.hitTargets.includes(opponent.id) && opponent.stocks > 0 && !opponent.invulnerable && opponent.respawnTicks === 0) {
      // Existing shots and fighters move during the same tick. Newly spawned
      // shots begin after fighter movement, so only those use the final body.
      const previous = index < existingProjectileCount ? previousBodies[opponent.id] : body(opponent);
      const motionX = opponent.x - (previous.x + opponent.width / 2);
      const motionY = opponent.y - (previous.y + opponent.height / 2);
      const t = circleContact(p.x, p.y, x - motionX, y - motionY, previous, p.radius);
      if (t !== null && (first === null || t < first - 1e-8)) { first = t; target = opponent; }
    }
    p.x = first === null ? x : p.x + (x - p.x) * first; p.y = first === null ? y : p.y + (y - p.y) * first;
    if (p.kind === 'parcel' && (p.life === 0 || first !== null)) {
      for (const f of state.fighters) {
        if (f.id === p.owner || !blastReachesBody(state, p.x, p.y, 85, f)) continue;
        hit(state, f, p.owner, { damage: p.damage, kb: 5.5, scale: 10, angle: -Math.PI / 4 }, f.x >= p.x ? 1 : -1);
      }
      emit(state, 'explosion', { fighter: p.owner, x: p.x, y: p.y, radius: 85 }); continue;
    }
    if (target) { hit(state, target, p.owner, { damage: p.damage, kb: p.kind === 'wrench' ? 3.8 : 3.2, scale: 7.8, angle: -Math.PI / 8 }, p.vx >= 0 ? 1 : -1); p.hitTargets.push(target.id); }
    if (first !== null && (!target || p.kind !== 'wrench')) { emit(state, 'impact', { x: p.x, y: p.y }); continue; }
    if (p.life > 0 && p.x > WORLD.blastLeft && p.x < WORLD.blastRight && p.y > WORLD.blastTop && p.y < WORLD.blastBottom) remaining.push(p);
  }
  state.projectiles = remaining;
}

function updateHazards(state) {
  state.hazards = [];
  for (const spec of STAGES[state.stageId].hazards) {
    const cycle = state.elapsedTicks % spec.period;
    if (cycle < spec.warningStart || cycle >= spec.activeEnd) continue;
    const phase = cycle < spec.activeStart ? 'warning' : 'active';
    const direction = Math.floor(state.elapsedTicks / spec.period) % 2 ? -1 : 1;
    state.hazards.push({ ...spec, phase, direction, ticks: (phase === 'warning' ? spec.activeStart : spec.activeEnd) - cycle });
    if (phase !== 'active') continue;
    for (const f of state.fighters) {
      if (f.stocks === 0 || f.respawnTicks > 0 || f.x + f.width / 2 < spec.x || f.x - f.width / 2 > spec.x + spec.w || f.y + f.height / 2 < spec.y || f.y - f.height / 2 > spec.y + spec.h) continue;
      if (spec.type === 'wind') { if (!f.grounded) f.vx += direction * .12; continue; }
      const generation = Math.floor(state.elapsedTicks / spec.period);
      if (f.hazardHits[spec.id] === generation || f.invulnerable) continue;
      f.hazardHits[spec.id] = generation;
      hit(state, f, null, { damage: spec.damage, kb: spec.type === 'steam' ? 8.5 : 7.5, scale: 4, angle: -Math.PI / 2 });
    }
  }
}

function knockout(state, f) {
  if (f.stocks === 0 || f.respawnTicks > 0 || f.x >= WORLD.blastLeft && f.x <= WORLD.blastRight && f.y >= WORLD.blastTop && f.y <= WORLD.blastBottom) return;
  const x = f.x, y = f.y;
  f.stocks -= 1; f.damage = 0; f.vx = 0; f.vy = 0; f.stun = 0; f.shieldBreakTicks = 0; f.shield = 100;
  f.move = null; f.attackBuffer = 0; f.specialBuffer = 0; f.jumpBuffer = 0;
  f.respawnTicks = f.stocks > 0 ? 120 : 0; f.action = f.stocks > 0 ? 'respawn' : 'dead';
  f.invulnerable = f.stocks > 0; f.invulnerableTicks = 0;
  emit(state, 'stock', { fighter: f.id, by: f.lastHitBy, stocks: f.stocks, x, y });
}
function endMatch(state, winner, reason) {
  state.phase = 'matchEnd'; state.winner = winner; state.result = reason;
  if (winner !== null) state.fighters[winner].wins = 1;
  state.projectiles = []; state.hazards = [];
  for (const f of state.fighters) { f.vx = 0; f.vy = 0; f.move = null; }
  emit(state, 'matchEnd', { winner, reason });
}

export function step(state, inputs = []) {
  state.tick += 1;
  if (state.phase === 'lobby' || state.phase === 'matchEnd') return state;
  if (state.phase === 'countdown') {
    for (const f of state.fighters) { f.previousInput = emptyInput(); f.jumpBuffer = 0; f.attackBuffer = 0; f.specialBuffer = 0; }
    state.phaseTicks -= 1;
    if (state.phaseTicks <= 0) { state.phase = 'fight'; emit(state, 'fight'); }
    return state;
  }
  state.elapsedTicks += 1; state.roundTicks -= 1;
  const previousBodies = state.fighters.map(body), existingProjectileCount = state.projectiles.length;
  for (const f of state.fighters) updateFighter(state, f, input(f, inputs[f.id]));
  const attacks = [];
  for (const a of state.fighters) { const b = state.fighters[1 - a.id]; if (hitsMelee(state, a, b)) { a.hitTargets.push(b.id); attacks.push({ source: a.id, target: b.id, move: { ...a.move }, direction: a.facing }); } }
  for (const attack of attacks) hit(state, state.fighters[attack.target], attack.source, attack.move, attack.direction);
  spawnProjectiles(state); updateProjectiles(state, previousBodies, existingProjectileCount); updateHazards(state);
  for (const f of state.fighters) knockout(state, f);
  const [a, b] = state.fighters;
  if (a.stocks === 0 || b.stocks === 0) endMatch(state, a.stocks === 0 && b.stocks === 0 ? null : a.stocks > 0 ? 0 : 1, 'stocks');
  else if (state.roundTicks <= 0) endMatch(state, a.stocks === b.stocks ? a.damage === b.damage ? null : a.damage < b.damage ? 0 : 1 : a.stocks > b.stocks ? 0 : 1, 'time');
  return state;
}
