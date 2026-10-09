/** Practice opponents press the same controls as players at the shared 120 Hz.
 * Enemy observations are delayed; no controller reads the human's input, alters
 * a fighter, or bypasses movement, cover, recovery or resource rules.
 */
import { emptyInput as relicInput, ARENA, MOVES } from './topdown-engine.js';
import { emptyInput as vectorInput, WORLD as VECTOR_WORLD, WEAPON, DASH } from './vector-engine.js';
import { emptyInput as brawlInput, CHARACTERS } from './brawl-engine.js';

export const ARENA_BOT_DIFFICULTIES = Object.freeze({
  easy: Object.freeze({ reaction: 30, decision: 12, aimError: .115, lead: .5, defend: .46 }),
  normal: Object.freeze({ reaction: 22, decision: 9, aimError: .075, lead: .72, defend: .64 }),
  hard: Object.freeze({ reaction: 14, decision: 6, aimError: .043, lead: .86, defend: .78 }),
  expert: Object.freeze({ reaction: 10, decision: 5, aimError: .03, lead: .93, defend: .85 }),
});
const games = Object.freeze({ 'relic-duel': relicInput, 'vector-arena': vectorInput, 'oddstock-rumble': brawlInput });
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const unit = (x, y) => { const length = Math.hypot(x, y); return length > .0001 ? { x: x / length, y: y / length } : { x: 0, y: 0 }; };
const chance = (tick, id, salt = 0) => { const value = Math.sin((Math.floor(tick / 19) + id * 37 + salt * 13) * 12.9898) * 43758.5453; return value - Math.floor(value); };
const movement = (input, dx, dy, threshold = .28) => {
  const direction = unit(dx, dy);
  input.left = direction.x < -threshold; input.right = direction.x > threshold;
  input.up = direction.y < -threshold; input.down = direction.y > threshold;
};

function intersects(a, b, rect, padding = 0) {
  let low = 0, high = 1;
  for (const [origin, delta, min, max] of [[a.x, b.x - a.x, rect.x - padding, rect.x + rect.w + padding], [a.y, b.y - a.y, rect.y - padding, rect.y + rect.h + padding]]) {
    if (Math.abs(delta) < 1e-8) { if (origin < min || origin > max) return false; }
    else { let first = (min - origin) / delta, last = (max - origin) / delta; if (first > last) [first, last] = [last, first]; low = Math.max(low, first); high = Math.min(high, last); if (low > high) return false; }
  }
  return high >= 0 && low <= 1;
}
const clearLine = (a, b, covers, padding = 0) => !covers.some(rect => intersects(a, b, rect, padding));

/** A small visibility graph chooses a real route around all six cover layouts.
 * No grid, movement teleport or game-state changes are needed. */
function waypoint(from, target, covers, bounds, radius) {
  const goal = { x: clamp(target.x, bounds.minX + 3, bounds.maxX - 3), y: clamp(target.y, bounds.minY + 3, bounds.maxY - 3) };
  if (clearLine(from, goal, covers, radius + 2)) return goal;
  const margin = radius + 6;
  const inside = (point, rect) => point.x > rect.x - radius - 2 && point.x < rect.x + rect.w + radius + 2 && point.y > rect.y - radius - 2 && point.y < rect.y + rect.h + radius + 2;
  const nodes = [{ x: from.x, y: from.y }, goal];
  for (const rect of covers) for (const x of [rect.x - margin, rect.x + rect.w + margin]) for (const y of [rect.y - margin, rect.y + rect.h + margin]) {
    const point = { x, y };
    if (x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY && !covers.some(other => inside(point, other))) nodes.push(point);
  }
  const costs = nodes.map(() => Infinity), previous = nodes.map(() => -1), visited = new Set(); costs[0] = 0;
  for (let pass = 0; pass < nodes.length; pass++) {
    let best = -1;
    for (let index = 0; index < nodes.length; index++) if (!visited.has(index) && (best < 0 || costs[index] < costs[best])) best = index;
    if (best < 0 || !Number.isFinite(costs[best]) || best === 1) break;
    visited.add(best);
    for (let index = 1; index < nodes.length; index++) {
      if (visited.has(index) || index === best) continue;
      // A body already touching cover may leave its margin, but cannot cross
      // the actual pillar to reach a corner on the opposite side.
      const visible = covers.every(rect => !intersects(nodes[best], nodes[index], rect, best === 0 && inside(from, rect) ? Math.max(0, radius - 1) : radius + 2));
      if (!visible) continue;
      const cost = costs[best] + distance(nodes[best], nodes[index]);
      if (cost < costs[index]) { costs[index] = cost; previous[index] = best; }
    }
  }
  if (!Number.isFinite(costs[1])) {
    // Move out of a safety margin before asking for the next route.
    const nearest = nodes.slice(2).filter(point => clearLine(from, point, covers, Math.max(0, radius - 1))).sort((a, b) => distance(from, a) + distance(a, goal) - distance(from, b) - distance(b, goal));
    return nearest[0] || goal;
  }
  let next = 1;
  while (previous[next] > 0) next = previous[next];
  return nodes[next];
}

// Copy public poses only. Action buffers, previousInput, hidden combat choices,
// event journals and engine references never enter the observation history.
function observe(state, enemy) {
  return {
    tick: state.tick,
    enemy: { id: enemy.id, x: enemy.x, y: enemy.y, vx: enemy.vx || 0, vy: enemy.vy || 0, facing: enemy.facing, radius: enemy.radius,
      width: enemy.width, height: enemy.height, hp: enemy.hp, stocks: enemy.stocks, respawnTicks: enemy.respawnTicks,
      action: enemy.action, actionFrame: enemy.actionFrame, attackKind: enemy.attackKind, characterId: enemy.characterId,
      move: enemy.move ? { kind: enemy.move.kind, reach: enemy.move.reach, startup: enemy.move.startup, active: enemy.move.active, total: enemy.move.total, direction: enemy.move.direction } : null },
    projectiles: (state.projectiles || []).filter(p => p.owner === enemy.id).map(p => ({ x: p.x, y: p.y, vx: p.vx, vy: p.vy, radius: p.radius || 4 })),
  };
}

function incomingProjectile(self, projectiles, covers = []) {
  let nearest = null;
  for (const p of projectiles) {
    const speedSquared = p.vx * p.vx + p.vy * p.vy;
    if (speedSquared < .01) continue;
    const time = ((self.x - p.x) * p.vx + (self.y - p.y) * p.vy) / speedSquared;
    if (time < 0 || time > 22) continue;
    const end = { x: p.x + p.vx * time, y: p.y + p.vy * time };
    if (distance(self, end) > (self.radius || self.width / 2 || 16) + p.radius + 15 || !clearLine(p, end, covers, p.radius)) continue;
    if (!nearest || time < nearest.time) nearest = { ...p, time };
  }
  return nearest;
}

function relicDecision(state, self, seen, profile) {
  const input = relicInput(), target = seen.enemy, covers = state.obstacles || [], gap = distance(self, target);
  const direct = clearLine(self, target, covers, 4), available = self.stun === 0 && !['attack', 'roll', 'hit'].includes(self.action);
  const projectile = incomingProjectile(self, seen.projectiles, covers);
  const threateningSword = target.action === 'attack' && target.attackKind === 'sword' && target.actionFrame < MOVES.sword.startup + MOVES.sword.active && gap < MOVES.sword.reach + 34 && direct;
  const defending = available && (projectile || threateningSword) && chance(state.tick, self.id, 3) < profile.defend;
  if (defending && self.stamina > 20 && !self.guardBroken) {
    const danger = projectile || target;
    movement(input, danger.x - self.x, danger.y - self.y);
    input.block = true;
    if (projectile && self.stamina >= MOVES.roll.stamina + 12 && chance(state.tick, self.id, 9) < .34) {
      const side = self.id === 1 ? 1 : -1;
      movement(input, -projectile.vy * side, projectile.vx * side); input.block = false; input.roll = true;
    }
    return input;
  }
  const lowStamina = self.stamina < 24;
  const toward = unit(target.x - self.x, target.y - self.y);
  let goal = lowStamina ? { x: self.x - toward.x * 120, y: self.y - toward.y * 120 } : target;
  // Prefer close sword exchanges; a recovering or distant opponent gives an
  // occasional bow opening instead of standing still and spamming arrows.
  const bowOpening = direct && gap > 160 && gap < 480 && self.stamina >= MOVES.shoot.stamina + 26 && chance(state.tick, self.id, 5) < .34;
  if (available && bowOpening) {
    const travel = MOVES.shoot.startup + gap / MOVES.shoot.speed;
    movement(input, target.x + target.vx * travel * profile.lead - self.x, target.y + target.vy * travel * profile.lead - self.y);
    input.shoot = true; return input;
  }
  if (available && direct && gap < MOVES.sword.reach + (target.radius || 15) - 5 && self.stamina >= MOVES.sword.stamina + 4) {
    movement(input, target.x - self.x, target.y - self.y); input.attack = true; return input;
  }
  // Reposition around the pillars while conserving a roll for visible danger.
  const route = waypoint(self, goal, covers, ARENA, self.radius || ARENA.fighterRadius);
  movement(input, route.x - self.x, route.y - self.y);
  return input;
}

function vectorDecision(state, self, seen, profile) {
  const input = vectorInput(), target = seen.enemy, covers = state.obstacles || [], gap = distance(self, target);
  const direct = clearLine(self, target, covers, 5), reloading = self.reloadTicks > 0 || self.ammo === 0;
  const travel = gap / WEAPON.projectileSpeed;
  const leadX = target.x + clamp(target.vx * travel * profile.lead, -110, 110), leadY = target.y + clamp(target.vy * travel * profile.lead, -110, 110);
  const angle = Math.atan2(leadY - self.y, leadX - self.x) + Math.sin(state.tick * .019 + self.id * 7) * profile.aimError;
  input.aimX = Math.cos(angle); input.aimY = Math.sin(angle);
  const toward = unit(target.x - self.x, target.y - self.y), orbit = Math.sin(Math.floor(state.tick / 110) + self.id * 2) >= 0 ? 1 : -1;
  const projectile = incomingProjectile(self, seen.projectiles, covers);
  let dx, dy;
  if (projectile && self.dashTicks === 0 && self.stamina >= DASH.cost + 9 && !reloading && chance(state.tick, self.id, 4) < profile.defend) {
    dx = -projectile.vy * orbit; dy = projectile.vx * orbit; input.dash = true;
  } else if (!direct) {
    const route = waypoint(self, target, covers, VECTOR_WORLD, self.radius || 16); dx = route.x - self.x; dy = route.y - self.y;
  } else {
    const advance = reloading || gap < 215 ? -.8 : gap > 390 ? .85 : .12;
    dx = toward.x * advance - toward.y * orbit * .8; dy = toward.y * advance + toward.x * orbit * .8;
    const goal = { x: self.x + dx * 80, y: self.y + dy * 80 }, route = waypoint(self, goal, covers, VECTOR_WORLD, self.radius || 16);
    dx = route.x - self.x; dy = route.y - self.y;
  }
  // Avoid dashing into the boundary when a projectile arrives at the edge.
  if (self.x < VECTOR_WORLD.minX + 36 && dx < 0 || self.x > VECTOR_WORLD.maxX - 36 && dx > 0) dx = -dx;
  if (self.y < VECTOR_WORLD.minY + 36 && dy < 0 || self.y > VECTOR_WORLD.maxY - 36 && dy > 0) dy = -dy;
  movement(input, dx, dy);
  input.reload = self.reloadTicks === 0 && self.ammo < WEAPON.magazine && (self.ammo === 0 || !direct && self.ammo <= 2);
  input.fire = direct && !reloading && self.dashTicks === 0 && gap < 690 && clearLine(self, { x: leadX, y: leadY }, covers, 3);
  // Focus only on quieter long lanes; mobile opponents can still beat its aim.
  input.focus = input.fire && gap > 420 && Math.hypot(target.vx, target.vy) < 1.1 && chance(state.tick, self.id, 8) < .55;
  return input;
}

function brawlDecision(state, self, seen, profile) {
  const input = brawlInput(), target = seen.enemy, stats = CHARACTERS[self.characterId] || CHARACTERS.wrench;
  const main = state.platforms?.find(p => p.solid); if (!main) return input;
  const free = self.stun === 0 && self.shieldBreakTicks === 0 && !['attack', 'special', 'recovery', 'dodge'].includes(self.action);
  const minX = main.x + self.width / 2 + 30, maxX = main.x + main.w - self.width / 2 - 30;
  const predictedX = self.x + self.vx * 15;
  const offstage = self.x < main.x + 12 || self.x > main.x + main.w - 12 || self.y > main.y;
  let goalX = clamp(target.x, minX, maxX);
  if (offstage) goalX = clamp(self.x, minX + 40, maxX - 40);
  else if (predictedX < minX || predictedX > maxX) goalX = clamp(predictedX, minX + 50, maxX - 50);
  if (Math.abs(goalX - self.x) > 13) input.left = goalX < self.x, input.right = goalX > self.x;
  if (self.stun > 0) { input.up = offstage; return input; }
  // Recovery has priority over every combat choice. Double-jump while falling,
  // then use the comic's real up-special; neither resource is fabricated.
  if (offstage || !self.grounded && self.y > main.y - 90 && self.vy > 0) {
    if (free && self.vy > -2) {
      if (self.jumpsLeft > 0 || self.coyote > 0) input.jump = true;
      else if (!self.recoveryUsed) { input.up = true; input.special = true; }
    }
    return input;
  }
  const dx = target.x - self.x, dy = target.y - self.y, gap = Math.hypot(dx, dy);
  const projectile = incomingProjectile(self, seen.projectiles, state.platforms.filter(p => p.solid));
  const threatened = target.move && target.actionFrame < target.move.startup + target.move.active && gap < target.move.reach + self.width + 22;
  if (free && (projectile || threatened) && chance(state.tick, self.id, 6) < profile.defend) {
    if (self.grounded && self.shield > 24 && chance(state.tick, self.id, 10) > .23) { input.left = false; input.right = false; input.shield = true; }
    else if (self.dodgeCooldown === 0 && (self.grounded || !self.airDodgeUsed)) {
      // A grounded dodge goes toward stage center when near either ledge.
      const away = self.x < minX + 70 ? 1 : self.x > maxX - 70 ? -1 : Math.sign(self.x - target.x) || 1;
      input.left = away < 0; input.right = away > 0; input.dodge = true;
    }
    return input;
  }
  if (!free || target.respawnTicks > 0 || target.stocks === 0) return input;
  // Climb the visible perches to pursue high opponents, and preserve an air
  // jump until the apex. Jump+down uses the engine's real drop-through action.
  if (dy < -65 && (self.grounded || self.vy > -1 && self.jumpsLeft > 0) && Math.abs(dx) < 260) input.jump = true;
  else if (dy > 100 && self.grounded && state.platforms.find(p => p.id === self.onPlatform)?.drop) { input.jump = true; input.down = true; }
  const close = Math.abs(dx) < stats.attack.reach + target.width / 2 - 8 && Math.abs(dy) < 28 + target.height / 2;
  if (close) {
    if (Math.abs(dx) > 4) { input.left = dx < 0; input.right = dx > 0; }
    if (dy < -25) { input.up = true; input.down = false; }
    else if (dy > 28 && !self.grounded) input.down = true;
    const burst = !stats.projectile && gap < (self.characterId === 'moth' ? 85 : stats.attack.reach + 10) && chance(state.tick, self.id, 12) < .32;
    input.special = burst; input.attack = !burst;
  } else if (stats.projectile && Math.abs(dx) > 100 && Math.abs(dx) < 440 && Math.abs(dy) < 48 && chance(state.tick, self.id, 13) < .48) {
    input.left = dx < 0; input.right = dx > 0; input.special = true;
  }
  return input;
}

const decisions = Object.freeze({ 'relic-duel': relicDecision, 'vector-arena': vectorDecision, 'oddstock-rumble': brawlDecision });
const pulses = Object.freeze({ 'relic-duel': ['attack', 'shoot', 'roll'], 'vector-arena': ['dash', 'reload'], 'oddstock-rumble': ['attack', 'special', 'jump', 'dodge'] });

export function createArenaBotController(gameId, botId = 1, difficulty = 'hard') {
  if (!Object.hasOwn(games, gameId) || ![0, 1].includes(botId)) throw new TypeError('Choose a supported arena game and bot seat 0 or 1.');
  const profile = ARENA_BOT_DIFFICULTIES[difficulty] || ARENA_BOT_DIFFICULTIES.hard;
  const blank = games[gameId];
  let history = [], held = blank(), lastTick = null, nextDecision = 0, identity = null, cached = blank();
  function reset() { history = []; held = blank(); lastTick = null; nextDecision = 0; identity = null; cached = blank(); }
  function input(state) {
    const self = state?.fighters?.find(f => f.id === botId), enemy = state?.fighters?.find(f => f.id !== botId);
    if (!self || !enemy || state.phase !== 'fight' || !Number.isSafeInteger(state.tick) || self.hp <= 0 || self.stocks === 0 || self.respawnTicks > 0) { reset(); return blank(); }
    const key = `${state.round || 1}:${state.stageId || state.roomName || ''}:${self.characterId || ''}`;
    if (identity !== key || lastTick !== null && state.tick < lastTick) { reset(); identity = key; }
    if (lastTick === state.tick) return { ...cached };
    lastTick = state.tick;
    history.push(observe(state, enemy));
    const cutoff = state.tick - profile.reaction;
    while (history.length > 1 && history[1].tick <= cutoff) history.shift();
    // Bound memory even if a caller pauses without advancing the game tick.
    if (history.length > profile.reaction + 2) history.splice(0, history.length - profile.reaction - 2);
    const seen = history[0]?.tick <= cutoff ? history[0] : null;
    const next = { ...held };
    for (const action of pulses[gameId]) next[action] = false;
    if (seen && state.tick >= nextDecision) {
      Object.assign(next, decisions[gameId](state, self, seen, profile));
      nextDecision = state.tick + profile.decision;
      held = { ...next };
    }
    cached = next;
    return { ...cached };
  }
  return Object.freeze({ input, reset });
}

// The explicit controller is preferred for match ownership and reset. This
// convenience keeps memory private when an existing solo loop uses a function.
const controllers = new WeakMap();
export function arenaBotInput(gameId, state, botId = 1, difficulty = 'hard') {
  if (!state || typeof state !== 'object') return (games[gameId] || relicInput)();
  let seats = controllers.get(state);
  if (!seats) { seats = new Map(); controllers.set(state, seats); }
  const key = `${gameId}:${botId}:${difficulty}`;
  if (!seats.has(key)) seats.set(key, createArenaBotController(gameId, botId, difficulty));
  return seats.get(key).input(state);
}
