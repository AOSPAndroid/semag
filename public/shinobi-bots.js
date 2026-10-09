import { createState, startMatch, step, emptyInput, STAGES, WORLD, MOVES, PARRY, DASH, getCombatOptions, opposingFighters, clearPath } from './shinobi-engine.js';

export const DIFFICULTIES = Object.freeze({
  normal: Object.freeze({ reactionTicks: 28, decisionTicks: 10, aimError: .1, parryChance: .28, chainChance: .45, throwInterval: 150 }),
  hard: Object.freeze({ reactionTicks: 18, decisionTicks: 6, aimError: .055, parryChance: .48, chainChance: .75, throwInterval: 112 }),
  expert: Object.freeze({ reactionTicks: 12, decisionTicks: 4, aimError: .025, parryChance: .65, chainChance: .9, throwInterval: 88 }),
});

export function createPractice(options = {}) { return createState({ ...options, mode: 'practice' }); }
export function startPractice(state) { delete state.botState; return startMatch(state); }
export function stepPractice(state, humanInput = emptyInput()) {
  const inputs = botInputs(state); inputs[0] = humanInput; return step(state, inputs);
}

function random(brain) {
  let seed = brain.seed >>> 0; seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
  brain.seed = seed >>> 0; return brain.seed / 4294967296;
}
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const bounded = point => point.x >= WORLD.minX && point.x <= WORLD.maxX && point.y >= WORLD.minY && point.y <= WORLD.maxY;
function navigation(state) {
  const margin = WORLD.fighterRadius + 8, nodes = [];
  for (const rect of state.obstacles) for (const x of [rect.x - margin, rect.x + rect.w + margin]) for (const y of [rect.y - margin, rect.y + rect.h + margin]) {
    const point = { x, y }; if (bounded(point) && clearPath(state, x, y, x, y, WORLD.fighterRadius)) nodes.push(point);
  }
  const edges = nodes.map(() => []);
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const a = nodes[i], b = nodes[j];
    if (clearPath(state, a.x, a.y, b.x, b.y, WORLD.fighterRadius - .05)) { const cost = distance(a, b); edges[i].push({ index: j, cost }); edges[j].push({ index: i, cost }); }
  }
  return { nodes, edges };
}
/** A small cover visibility graph chooses real corridors, never teleportation. */
function waypoint(state, bot, goal, nav) {
  const radius = bot.radius - .05;
  if (clearPath(state, bot.x, bot.y, goal.x, goal.y, radius)) return goal;
  const costs = nav.nodes.map(() => Infinity), first = nav.nodes.map(() => -1), done = new Set();
  for (const [index, node] of nav.nodes.entries()) if (clearPath(state, bot.x, bot.y, node.x, node.y, radius)) { costs[index] = distance(bot, node); first[index] = index; }
  let best = null, bestCost = Infinity;
  for (let count = 0; count < nav.nodes.length; count++) {
    let current = -1;
    for (let index = 0; index < costs.length; index++) if (!done.has(index) && (current < 0 || costs[index] < costs[current])) current = index;
    if (current < 0 || !Number.isFinite(costs[current])) break;
    done.add(current); const node = nav.nodes[current];
    if (clearPath(state, node.x, node.y, goal.x, goal.y, radius)) {
      const cost = costs[current] + distance(node, goal); if (cost < bestCost) { bestCost = cost; best = nav.nodes[first[current]]; }
    }
    for (const edge of nav.edges[current]) if (costs[current] + edge.cost < costs[edge.index]) { costs[edge.index] = costs[current] + edge.cost; first[edge.index] = first[current]; }
  }
  return best || bot;
}
function movement(dx, dy) {
  const max = Math.max(Math.abs(dx), Math.abs(dy)), threshold = Math.max(4, max * .3);
  return { left: dx < -threshold, right: dx > threshold, up: dy < -threshold, down: dy > threshold };
}
function makeBrain(state, bot, skill) {
  const seed = ((state.practice.seed ^ Math.imul(bot.id + 1, 0x9e3779b9) ^ Math.imul(state.round, 0x85ebca6b)) >>> 0) || 1;
  const brain = { id: bot.id, seed, reactionTicks: skill.reactionTicks + bot.id % 4, nextThink: state.tick + skill.reactionTicks + bot.id % 4,
    lastSeen: { ...STAGES[state.stageId].spawns[0], tick: state.tick }, move: {}, aimX: bot.aimX, aimY: bot.aimY, nextThrow: state.tick + 55 + bot.id * 17, nextDash: state.tick + 70, retreatUntil: 0 };
  brain.side = random(brain) < .5 ? -1 : 1; return brain;
}
function observe(state) {
  return { tick: state.tick, fighters: state.fighters.map(f => ({ id: f.id, team: f.team, x: f.x, y: f.y, hp: f.hp, radius: f.radius, action: f.action, actionFrame: f.actionFrame, actionFacing: f.actionFacing })), projectiles: state.projectiles.map(p => ({ owner: p.owner, x: p.x, y: p.y, vx: p.vx, vy: p.vy })) };
}
function choose(state, bot, brain, seen, skill, nav) {
  const input = emptyInput(), enemies = seen.fighters.filter(f => f.hp > 0 && opposingFighters(bot, f));
  const visible = enemies.filter(f => clearPath(state, bot.x, bot.y, f.x, f.y)).sort((a, b) => distance(bot, a) - distance(bot, b));
  const target = visible[0] || null;
  if (target) brain.lastSeen = { x: target.x, y: target.y, tick: state.tick };
  else if (state.tick - brain.lastSeen.tick > 360 || distance(bot, brain.lastSeen) < 25 && state.tick - brain.lastSeen.tick > 90) {
    const patrol = nav.nodes.length ? nav.nodes : [{ x: 154, y: 140 }, { x: 806, y: 500 }, { x: 806, y: 140 }, { x: 154, y: 500 }];
    brain.searchIndex = ((brain.searchIndex ?? bot.id * 3) + 1) % patrol.length;
    brain.lastSeen = { ...patrol[brain.searchIndex], tick: state.tick };
  }
  const point = target || brain.lastSeen, dx = point.x - bot.x, dy = point.y - bot.y, range = Math.hypot(dx, dy), direction = Math.atan2(dy, dx);
  const error = (random(brain) * 2 - 1) * skill.aimError;
  brain.aimX = input.aimX = Math.cos(direction + error); brain.aimY = input.aimY = Math.sin(direction + error);
  const options = getCombatOptions(bot), free = ['idle', 'run'].includes(bot.action);
  if (bot.stamina < 24) brain.retreatUntil = state.tick + 100;
  let goal = point;
  if (target && range < 180) {
    const retreating = state.tick < brain.retreatUntil || target.action === 'parry', desired = retreating ? 145 : 49;
    const flank = (bot.id % 2 ? 1 : -1) * (bot.id > 1 ? .35 : .12);
    goal = { x: point.x - Math.cos(direction + flank) * desired, y: point.y - Math.sin(direction + flank) * desired };
  }
  goal = { x: Math.max(WORLD.minX + 4, Math.min(WORLD.maxX - 4, goal.x)), y: Math.max(WORLD.minY + 4, Math.min(WORLD.maxY - 4, goal.y)) };
  const next = waypoint(state, bot, goal, nav); let moveX = next.x - bot.x, moveY = next.y - bot.y;
  // Avoid stacking in the same approach lane while retaining real body contacts.
  for (const ally of state.fighters) if (ally.id !== bot.id && ally.hp > 0 && !opposingFighters(bot, ally) && distance(bot, ally) < 44) {
    moveX += (bot.x - ally.x) * .8; moveY += (bot.y - ally.y) * .8;
  }
  brain.move = movement(moveX, moveY); Object.assign(input, brain.move);
  if (!target) return input;
  if (options.canFeint && (target.action === 'parry' || random(brain) < .1)) input.feint = true;
  else if (options.canChain && state.tick >= bot.hitTick + Math.floor(brain.reactionTicks / 2) && random(brain) < skill.chainChance) input.attack = true;
  if (!free || input.attack || input.feint) return input;
  const delayedFrames = state.tick - seen.tick, move = MOVES[target.action];
  let danger = null;
  if (move && range < move.range + bot.radius + 22) {
    const facingDifference = Math.atan2(Math.sin(Math.atan2(bot.y - target.y, bot.x - target.x) - target.actionFacing), Math.cos(Math.atan2(bot.y - target.y, bot.x - target.x) - target.actionFacing));
    const untilImpact = move.startup - target.actionFrame - delayedFrames;
    if (Math.abs(facingDifference) < move.cone + .2 && untilImpact >= -2 && untilImpact <= 8) danger = { aimX: -Math.cos(direction), aimY: -Math.sin(direction), melee: true };
  }
  for (const shot of seen.projectiles) {
    const owner = seen.fighters.find(f => f.id === shot.owner); if (!opposingFighters(bot, owner)) continue;
    const speed = Math.hypot(shot.vx, shot.vy); if (!speed) continue;
    const rx = bot.x - shot.x, ry = bot.y - shot.y, approach = (rx * shot.vx + ry * shot.vy) / speed;
    const miss = Math.abs(rx * shot.vy - ry * shot.vx) / speed, untilImpact = approach / speed - delayedFrames;
    if (approach > 0 && miss < bot.radius + 8 && untilImpact >= 1 && untilImpact <= 12 && clearPath(state, shot.x, shot.y, bot.x, bot.y, 3)) danger = { aimX: -shot.vx / speed, aimY: -shot.vy / speed, melee: false };
  }
  if (danger && random(brain) < .85) {
    if (bot.stamina >= PARRY.cost && random(brain) < skill.parryChance) { input.parry = true; input.aimX = brain.aimX = danger.melee ? Math.cos(direction) : danger.aimX; input.aimY = brain.aimY = danger.melee ? Math.sin(direction) : danger.aimY; }
    else if (bot.stamina >= DASH.cost && state.tick >= brain.nextDash) { input.dash = true; Object.assign(input, movement(-dy * brain.side, dx * brain.side)); brain.nextDash = state.tick + 110; }
    return input;
  }
  if (state.tick >= brain.retreatUntil && target.action !== 'parry' && range <= MOVES.light.range + target.radius - 7 && bot.stamina >= MOVES.light.cost) {
    input.attack = true;
  } else if (state.tick >= brain.retreatUntil && range <= MOVES.heavy.range + target.radius - 5 && bot.stamina >= MOVES.heavy.cost && (target.action === 'stun' || ['light', 'heavy'].includes(target.action) && target.actionFrame >= (MOVES[target.action]?.startup || 0) + (MOVES[target.action]?.active || 0) || random(brain) < .18)) {
    input.heavy = true;
  } else if (range > 145 && range < 560 && bot.kunai > 0 && bot.stamina >= 6 && state.tick >= brain.nextThrow && clearPath(state, bot.x, bot.y, target.x, target.y, 3)) {
    input.throw = true; brain.nextThrow = state.tick + skill.throwInterval + Math.floor(random(brain) * 30);
  } else if (range > 130 && range < 230 && bot.stamina >= 70 && state.tick >= brain.nextDash && random(brain) < .14) {
    input.dash = true; brain.nextDash = state.tick + 200;
  }
  return input;
}

/** Delayed public poses become ordinary input edges; bots never write fighters. */
export function botInputs(state) {
  const inputs = state.fighters.map(f => ({ ...emptyInput(), aimX: f.aimX, aimY: f.aimY }));
  if (!state.practice || state.phase !== 'fight') return inputs;
  const skill = DIFFICULTIES[state.practice.difficulty];
  if (!state.botState || state.botState.round !== state.round || state.botState.stageId !== state.stageId) state.botState = {
    round: state.round, stageId: state.stageId, history: [], nav: navigation(state), brains: state.fighters.filter(f => f.bot).map(f => makeBrain(state, f, skill)),
  };
  const brains = state.botState;
  if (brains.history.at(-1)?.tick !== state.tick) brains.history.push(observe(state));
  if (brains.history.length > 36) brains.history.splice(0, brains.history.length - 36);
  for (const brain of brains.brains) {
    const bot = state.fighters.find(f => f.id === brain.id); if (!bot || bot.hp <= 0) continue;
    const seen = brains.history.findLast(frame => frame.tick <= state.tick - brain.reactionTicks);
    if (!seen) continue;
    if (state.tick >= brain.nextThink) { inputs[bot.id] = choose(state, bot, brain, seen, skill, brains.nav); brain.nextThink = state.tick + skill.decisionTicks; }
    else inputs[bot.id] = { ...inputs[bot.id], ...brain.move, aimX: brain.aimX, aimY: brain.aimY };
  }
  return inputs;
}
