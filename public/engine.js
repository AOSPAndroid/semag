/** Shared deterministic combat simulation. Time and distances use 120 Hz ticks. */
export const TICK_RATE = 120;
export const ARENA = Object.freeze({ width: 1200, height: 600, floor: 470, minX: 58, maxX: 1142, fighterWidth: 44, fighterHeight: 100, roundSeconds: 90 });
export const MOVES = Object.freeze({
  light: Object.freeze({ startup: 12, active: 8, recovery: 24, total: 44, reach: 108, damage: 9, stamina: 8, knockback: 4.6, hitstun: 32, blockstun: 15, guardDamage: 15 }),
  heavy: Object.freeze({ startup: 28, active: 11, recovery: 39, total: 78, reach: 160, damage: 20, stamina: 18, knockback: 8.5, hitstun: 52, blockstun: 28, guardDamage: 32 }),
  dash: Object.freeze({ total: 28, stamina: 23, speed: 10, invulnerableStart: 4, invulnerableEnd: 16 }),
});
export const INPUT_KEYS = Object.freeze(['left', 'right', 'jump', 'light', 'heavy', 'dash', 'block']);
export const emptyInput = () => Object.fromEntries(INPUT_KEYS.map(key => [key, false]));
export const cloneState = state => JSON.parse(JSON.stringify(state));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const isAttack = fighter => fighter.action === 'light' || fighter.action === 'heavy';
const onGround = fighter => fighter.y >= ARENA.floor - 0.01;

function fighter(id, wins = 0) {
  return {
    id, x: id === 0 ? 390 : 810, y: ARENA.floor, vx: 0, vy: 0,
    facing: id === 0 ? 1 : -1, hp: 100, stamina: 100, guard: 100,
    action: 'idle', actionFrame: 0, actionDuration: 0, stun: 0, combo: 0, wins,
    attackId: 0, hitTargets: [], landed: false, invulnerable: false,
    guardBroken: 0, blockTicks: 0, blockPressTick: -1000, staminaDelay: 0, comboTimer: 0,
    previousInput: emptyInput(), buffers: { jump: 0, light: 0, heavy: 0, dash: 0 },
    dashDirection: id === 0 ? 1 : -1,
  };
}

export function createState() {
  return {
    tick: 0, phase: 'lobby', phaseTicks: 0, round: 1,
    roundTicks: ARENA.roundSeconds * TICK_RATE, winner: null,
    fighters: [fighter(0), fighter(1)], events: [], eventId: 0,
    hitstop: 0, suddenDeath: false,
  };
}

function emit(state, type, data = {}) {
  state.events.push({ id: ++state.eventId, tick: state.tick, type, ...data });
  if (state.events.length > 48) state.events.splice(0, state.events.length - 48);
}

function prepareRound(state, countdown) {
  state.fighters = state.fighters.map(f => fighter(f.id, f.wins));
  state.phase = 'countdown';
  state.phaseTicks = countdown;
  state.roundTicks = ARENA.roundSeconds * TICK_RATE;
  state.winner = null;
  state.hitstop = 0;
  state.suddenDeath = false;
  emit(state, 'round', { round: state.round });
}

export function startMatch(state) {
  state.round = 1;
  state.fighters.forEach(f => { f.wins = 0; });
  prepareRound(state, TICK_RATE * 3);
  return state;
}

export function resetLobby(state) {
  const tick = state.tick;
  const eventId = state.eventId;
  Object.assign(state, createState(), { tick, eventId });
  return state;
}

function finishRound(state, winner, reason) {
  state.phase = 'roundEnd';
  state.phaseTicks = TICK_RATE * 2;
  state.winner = winner;
  if (winner !== null) state.fighters[winner].wins += 1;
  for (const f of state.fighters) {
    f.invulnerable = false;
    f.vx = 0;
    if (f.hp <= 0) { f.action = 'dead'; f.actionFrame = 0; }
  }
  emit(state, 'roundEnd', { winner, reason, x: 600, y: 250 });
}

function recordInputs(state, f, rawInput, allowBuffer) {
  const input = emptyInput();
  for (const key of INPUT_KEYS) input[key] = rawInput?.[key] === true;
  if (input.block && !f.previousInput.block) f.blockPressTick = state.tick;
  for (const key of Object.keys(f.buffers)) {
    if (f.buffers[key] > 0) f.buffers[key] -= 1;
    if (allowBuffer && input[key] && !f.previousInput[key]) f.buffers[key] = key === 'heavy' ? 12 : 9;
  }
  f.previousInput = input;
  return input;
}

function beginAttack(state, f, name) {
  const move = MOVES[name];
  if (f.stamina + 0.0001 < move.stamina) return false;
  f.action = name;
  f.actionFrame = 0;
  f.actionDuration = move.total;
  f.attackId += 1;
  f.hitTargets = [];
  f.landed = false;
  f.blockTicks = 0;
  f.invulnerable = false;
  f.stamina = Math.max(0, f.stamina - move.stamina);
  f.staminaDelay = 38;
  f.buffers[name] = 0;
  // The tiny forward step rewards committing to a good distance, without a teleport.
  f.vx = f.facing * (name === 'heavy' ? 1.8 : 1.1);
  emit(state, 'swing', { fighter: f.id, move: name, x: f.x, y: f.y - 60, facing: f.facing });
  return true;
}

function updateFighter(state, f, opponent, input) {
  f.invulnerable = false;
  if (f.guardBroken > 0) f.guardBroken -= 1;
  if (f.staminaDelay > 0) f.staminaDelay -= 1;
  if (f.comboTimer > 0) f.comboTimer -= 1;
  else f.combo = 0;
  const ground = onGround(f);
  const direction = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (!isAttack(f) && f.action !== 'dash' && f.stun <= 0 && Math.abs(opponent.x - f.x) > 1) {
    f.facing = opponent.x >= f.x ? 1 : -1;
  }
  if (f.stun > 0) {
    f.stun -= 1;
    f.actionFrame += 1;
    f.vx *= ground ? 0.91 : 0.97;
    if (f.stun === 0) {
      f.action = ground ? (input.block && f.guardBroken === 0 ? 'block' : 'idle') : 'jump';
      f.actionFrame = 0;
    }
  } else if (isAttack(f)) {
    f.actionFrame += 1;
    const canCancel = f.action === 'light' && f.landed && f.actionFrame >= 19 && f.actionFrame <= 35;
    if (canCancel && f.buffers.heavy > 0 && f.stamina >= MOVES.heavy.stamina) {
      beginAttack(state, f, 'heavy');
      emit(state, 'cancel', { fighter: f.id, x: f.x, y: f.y - 65 });
    } else if (f.actionFrame >= MOVES[f.action].total) {
      f.action = ground ? 'idle' : 'jump';
      f.actionFrame = 0;
      f.actionDuration = 0;
    }
    f.vx *= 0.84;
  } else if (f.action === 'dash') {
    f.actionFrame += 1;
    f.invulnerable = f.actionFrame >= MOVES.dash.invulnerableStart && f.actionFrame <= MOVES.dash.invulnerableEnd;
    f.vx = f.dashDirection * MOVES.dash.speed * (f.actionFrame > 20 ? 0.62 : 1);
    if (f.actionFrame >= MOVES.dash.total) {
      f.action = ground ? 'idle' : 'jump'; f.actionFrame = 0; f.vx *= 0.35;
    }
  } else {
    const blocking = input.block && ground && f.guardBroken === 0;
    if (blocking) {
      if (f.action !== 'block') { f.action = 'block'; f.actionFrame = 0; f.blockTicks = 0; }
      f.blockTicks += 1;
      f.actionFrame += 1;
      f.vx = direction * 1.05;
      f.buffers.light = 0;
      f.buffers.heavy = 0;
    } else {
      f.blockTicks = 0;
      f.action = ground ? (direction ? 'run' : 'idle') : 'jump';
      f.actionFrame += 1;
      f.vx += (direction * (ground ? 4 : 3.7) - f.vx) * (ground ? 0.34 : 0.12);
      if (f.buffers.jump > 0 && ground) {
        f.buffers.jump = 0;
        f.vy = -11.4;
        f.action = 'jump'; f.actionFrame = 0;
        emit(state, 'jump', { fighter: f.id, x: f.x, y: f.y });
      }
      if (f.buffers.dash > 0 && ground && f.stamina >= MOVES.dash.stamina) {
        f.buffers.dash = 0;
        f.dashDirection = direction || f.facing;
        f.stamina -= MOVES.dash.stamina;
        f.staminaDelay = 48;
        f.action = 'dash'; f.actionFrame = 0; f.actionDuration = MOVES.dash.total;
        f.vx = f.dashDirection * MOVES.dash.speed;
        emit(state, 'dash', { fighter: f.id, x: f.x, y: f.y, facing: f.dashDirection });
      } else if (f.buffers.heavy > 0) {
        beginAttack(state, f, 'heavy');
      } else if (f.buffers.light > 0) {
        beginAttack(state, f, 'light');
      }
    }
  }
  if (!f.staminaDelay && !isAttack(f) && f.action !== 'dash' && f.action !== 'block' && f.stun <= 0) {
    f.stamina = Math.min(100, f.stamina + 0.27);
  }
  // Guard and stamina share one resource, so every defensive choice has a cost.
  f.guard = f.stamina;
  f.x = clamp(f.x + f.vx, ARENA.minX, ARENA.maxX);
  if (!onGround(f) || f.vy < 0) {
    f.vy += 0.31;
    f.y += f.vy;
    if (f.y >= ARENA.floor) {
      f.y = ARENA.floor; f.vy = 0;
      emit(state, 'land', { fighter: f.id, x: f.x, y: f.y });
    }
  }
}

function separateFighters(a, b) {
  // Cross-ups are possible overhead, but grounded fighters cannot phase through.
  if (Math.abs(a.y - b.y) > 76) return;
  const distance = b.x - a.x;
  const overlap = ARENA.fighterWidth - Math.abs(distance);
  if (overlap <= 0) return;
  const sign = distance >= 0 ? 1 : -1;
  a.x = clamp(a.x - sign * overlap / 2, ARENA.minX, ARENA.maxX);
  b.x = clamp(b.x + sign * overlap / 2, ARENA.minX, ARENA.maxX);
  const remaining = ARENA.fighterWidth - Math.abs(b.x - a.x);
  if (remaining > 0) {
    if (a.x === ARENA.minX || a.x === ARENA.maxX) b.x = clamp(b.x + sign * remaining, ARENA.minX, ARENA.maxX);
    else a.x = clamp(a.x - sign * remaining, ARENA.minX, ARENA.maxX);
  }
}

/** Render-only contact projection. Grounded body order stays solid, while the
 * existing vertical-gap rule still permits airborne cross-ups. No velocity,
 * jump, hitstop, animation or other gameplay state is advanced here.
 */
export function sweepPresentationFighters(state, desiredFighters, { anchorId = null } = {}) {
  if (!Array.isArray(desiredFighters)) return [];
  const copies = desiredFighters.map(f => ({ ...f }));
  const bases = [0, 1].map(id => state?.fighters?.find(f => f.id === id));
  const displayed = [0, 1].map(id => copies.find(f => f.id === id));
  if (copies.length !== 2 || bases.some(f => !f || !Number.isFinite(f.x) || !Number.isFinite(f.y)) || displayed.some(f => !f)) return copies;
  const actors = bases.map(f => ({ ...f }));
  const offsets = actors.map(f => {
    const target = displayed[f.id], x = target.x - f.x, y = target.y - f.y;
    const continuous = state.phase === 'fight' && (target.hp > 0) === (f.hp > 0) && target.wins === f.wins;
    return continuous && Number.isFinite(x) && Number.isFinite(y) && Math.hypot(x, y) <= 128 ? { x, y } : { x: 0, y: 0 };
  });
  const steps = Math.max(1, Math.ceil(Math.max(...offsets.map(p => Math.hypot(p.x, p.y))) / (ARENA.fighterWidth / 4)));
  for (let step = 0; step < steps; step++) {
    const previous = actors.map(({ x, y }) => ({ x, y }));
    for (const f of actors) {
      f.x = clamp(f.x + offsets[f.id].x / steps, ARENA.minX, ARENA.maxX);
      f.y = Math.min(ARENA.floor, f.y + offsets[f.id].y / steps);
    }
    const anchor = actors.find(f => f.id === anchorId), point = anchor && { x: anchor.x, y: anchor.y };
    separateFighters(...actors);
    if (anchor) {
      const dx = anchor.x - point.x;
      anchor.x = point.x; anchor.y = point.y;
      const other = actors[1 - anchor.id];
      other.x = clamp(other.x - dx, ARENA.minX, ARENA.maxX);
    }
    if (Math.abs(actors[0].y - actors[1].y) <= 76 && Math.abs(actors[0].x - actors[1].x) < ARENA.fighterWidth - 1e-7) {
      for (const f of actors) Object.assign(f, previous[f.id]);
    }
  }
  for (const f of actors) { displayed[f.id].x = f.x; displayed[f.id].y = f.y; }
  return copies;
}

function attackConnects(attacker, defender) {
  if (!isAttack(attacker) || attacker.hitTargets.includes(defender.id) || defender.hp <= 0 || defender.invulnerable) return false;
  const move = MOVES[attacker.action];
  if (attacker.actionFrame < move.startup || attacker.actionFrame >= move.startup + move.active) return false;
  const horizontal = (defender.x - attacker.x) * attacker.facing;
  if (horizontal < -8 || horizontal > move.reach + ARENA.fighterWidth / 2) return false;
  const top = attacker.y - (attacker.action === 'heavy' ? 116 : 96);
  const bottom = attacker.y - (attacker.action === 'heavy' ? 8 : 25);
  return defender.y > top && defender.y - ARENA.fighterHeight < bottom;
}

function canBlock(defender, attacker) {
  return defender.action === 'block' && defender.guardBroken === 0 && onGround(defender) &&
    (attacker.x - defender.x) * defender.facing >= -8;
}

function resolveHit(state, attack) {
  const { attacker, defender, name, move, blocked, parried } = attack;
  attacker.hitTargets.push(defender.id);
  const x = defender.x - attacker.facing * 18;
  const y = Math.min(defender.y, attacker.y) - 60;
  if (parried) {
    attacker.action = 'hit'; attacker.actionFrame = 0;
    attacker.stun = 46; attacker.vx = -attacker.facing * 3.6;
    attacker.landed = false;
    defender.action = 'parry'; defender.actionFrame = 0; defender.stun = 5;
    defender.stamina = Math.min(100, defender.stamina + 12);
    defender.guard = defender.stamina;
    defender.buffers.light = defender.buffers.heavy = 0;
    state.hitstop = Math.max(state.hitstop, 7);
    emit(state, 'parry', { fighter: defender.id, target: attacker.id, x, y, move: name });
    return;
  }
  attacker.landed = true;
  if (blocked) {
    defender.stamina = Math.max(0, defender.stamina - move.guardDamage);
    defender.guard = defender.stamina;
    defender.staminaDelay = 70;
    defender.vx = attacker.facing * move.knockback * 0.42;
    if (defender.stamina <= 0) {
      defender.guardBroken = 135;
      defender.action = 'hit'; defender.actionFrame = 0; defender.stun = 92;
      state.hitstop = Math.max(state.hitstop, 9);
      emit(state, 'guardbreak', { fighter: attacker.id, target: defender.id, x, y });
    } else {
      defender.stun = move.blockstun;
      defender.actionFrame = 0;
      // Block stun is kept as a block so a held guard does not repeatedly parry.
      defender.blockTicks = Math.max(10, defender.blockTicks);
      state.hitstop = Math.max(state.hitstop, 3);
      emit(state, 'block', { fighter: attacker.id, target: defender.id, x, y, move: name });
    }
    return;
  }
  defender.hp = Math.max(0, defender.hp - move.damage);
  defender.action = defender.hp === 0 ? 'dead' : 'hit';
  defender.actionFrame = 0;
  defender.stun = move.hitstun;
  defender.vx = attacker.facing * move.knockback;
  defender.blockTicks = 0;
  defender.invulnerable = false;
  if (!onGround(defender)) defender.vy = Math.min(defender.vy, -3.2);
  attacker.combo = attacker.comboTimer > 0 ? attacker.combo + 1 : 1;
  attacker.comboTimer = move.hitstun + 50;
  state.hitstop = Math.max(state.hitstop, name === 'heavy' ? 7 : 4);
  emit(state, 'hit', { fighter: attacker.id, target: defender.id, damage: move.damage, combo: attacker.combo, move: name, facing: attacker.facing, x, y });
}

/** Mutates state by exactly one tick; does not use clock, randomness, or the network. */
export function step(state, rawInputs = [emptyInput(), emptyInput()]) {
  state.tick += 1;
  const inputs = state.fighters.map((f, index) => recordInputs(state, f, rawInputs[index], state.phase === 'fight'));
  if (state.phase === 'lobby' || state.phase === 'matchEnd') return state;
  if (state.phase === 'countdown') {
    state.phaseTicks = Math.max(0, state.phaseTicks - 1);
    if (state.phaseTicks === 0) {
      state.phase = 'fight';
      emit(state, 'fight', { round: state.round, x: 600, y: 270 });
    }
    return state;
  }
  if (state.phase === 'roundEnd') {
    state.phaseTicks = Math.max(0, state.phaseTicks - 1);
    state.fighters.forEach(f => { f.actionFrame += 1; });
    if (state.phaseTicks === 0) {
      const champion = state.fighters.find(f => f.wins >= 2);
      if (champion) {
        state.phase = 'matchEnd'; state.winner = champion.id;
        emit(state, 'matchEnd', { winner: champion.id, x: 600, y: 250 });
      } else {
        state.round += 1;
        prepareRound(state, TICK_RATE * 2);
      }
    }
    return state;
  }
  if (state.hitstop > 0) { state.hitstop -= 1; return state; }
  state.roundTicks = Math.max(0, state.roundTicks - 1);
  updateFighter(state, state.fighters[0], state.fighters[1], inputs[0]);
  updateFighter(state, state.fighters[1], state.fighters[0], inputs[1]);
  separateFighters(...state.fighters);
  // Capture contacts before resolving them: same-frame attacks can fairly trade.
  const contacts = [];
  for (const attacker of state.fighters) {
    const defender = state.fighters[1 - attacker.id];
    if (!attackConnects(attacker, defender)) continue;
    const blocked = canBlock(defender, attacker);
    const parried = blocked && state.tick - defender.blockPressTick < 9;
    contacts.push({ attacker, defender, name: attacker.action, move: MOVES[attacker.action], blocked, parried });
  }
  for (const contact of contacts) resolveHit(state, contact);
  const dead = state.fighters.filter(f => f.hp <= 0);
  if (dead.length) finishRound(state, dead.length === 2 ? null : 1 - dead[0].id, dead.length === 2 ? 'doubleKO' : 'knockout');
  else if (state.roundTicks === 0) {
    const difference = state.fighters[0].hp - state.fighters[1].hp;
    finishRound(state, difference === 0 ? null : difference > 0 ? 0 : 1, 'time');
  }
  return state;
}
