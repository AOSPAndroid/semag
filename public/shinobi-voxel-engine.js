/** Shinobi Showdown 3D: shared voxel physics, human sword rules and explicit ninja abilities. */
import * as Voxel from './voxel-engine.js';
import { initializeInventory } from './voxel-inventory.js';
import { meleeProfile, meleeSlashOrigin, parryPhase, parryFacesOrigin, resetMeleeCombo } from './voxel-melee.js';
import { navigationPath, navigationVisible } from './voxel-navigation.js';
import { MAPS, MAP_IDS } from './shinobi-voxel-maps.js';
export { MAPS, MAP_IDS };
export const TICK_RATE = Voxel.TICK_RATE;
export const RULES = Object.freeze({ health: 220, winsToMatch: 2, maxRounds: 7, roundTicks: 75 * TICK_RATE, initialCountdownTicks: 2 * TICK_RATE, countdownTicks: 180, roundEndTicks: 180, meleeReach: 3.35, comboLength: 3 });
export const DASH = Object.freeze({ ticks: 18, speed: 13.5, staminaCost: 26, cancelCost: 8, cooldownTicks: 84 });
export const KUNAI = Object.freeze({ capacity: 3, recoveryTicks: 240, cooldownTicks: 36, speed: 42, damage: 30, headMultiplier: 1.5, ticks: 120, maxProjectiles: 20 });
export const FEINT = Object.freeze({ staminaCost: 12, recoveryTicks: 14, cooldownTicks: 72 });
export const ABILITIES = Object.freeze({ dash: DASH, kunai: KUNAI, feint: FEINT, parry: Voxel.parryProfile('katana'), katana: Voxel.MELEE_WEAPONS.katana });
const MOVEMENT_KEYS = Object.freeze(['up', 'down', 'left', 'right', 'jump', 'crouch', 'walk', 'sprint', 'fire', 'aim']);
const ABILITY_KEYS = Object.freeze(['dash', 'kunai', 'feint']);
export const INPUT_KEYS = Object.freeze([...MOVEMENT_KEYS, ...ABILITY_KEYS]);
const DT = 1 / TICK_RATE, EPS = 1e-8;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const names = Object.freeze(['Kage', 'Kumo', 'Hayate', 'Oboro']);
const emit = Voxel.emitCombatEvent;
export const emptyInput = (aim = {}) => ({ ...Object.fromEntries(INPUT_KEYS.map(key => [key, false])), yaw: Number.isFinite(aim.yaw) ? clamp(aim.yaw, -Math.PI, Math.PI) : 0, pitch: Number.isFinite(aim.pitch) ? clamp(aim.pitch, -1.35, 1.35) : 0, ...(Number.isFinite(aim.moveYaw) ? { moveYaw: clamp(aim.moveYaw, -Math.PI, Math.PI) } : {}) });
export const cloneState = Voxel.cloneState;
/** Replay accepted physical dash travel on a player copy without combat, events or ability activation. */
export function predictLocalMovement(player, raw, mapIdOrMap = MAP_IDS[0], ticks = 1, peers = []) {
  const arena = typeof mapIdOrMap === 'string' ? MAPS[mapIdOrMap] || Voxel.MAPS[mapIdOrMap] : mapIdOrMap;
  if (!player || !arena) return player;
  const count = clamp(Math.floor(Number.isFinite(ticks) ? ticks : 1), 0, TICK_RATE / 4);
  for (let index = 0; index < count; index++) {
    const command = readInput(player, raw);
    if (player.dashTicks > 0) command.up = command.down = command.left = command.right = command.fire = command.aim = command.sprint = false;
    Voxel.predictLocalMovement(player, command, arena, 1, peers);
    advanceDash(player, arena, peers);
  }
  return player;
}
function readInput(player, raw) {
  const input = Object.fromEntries(INPUT_KEYS.map(key => [key, raw?.[key] === true]));
  input.yaw = Number.isFinite(raw?.yaw) ? clamp(raw.yaw, -Math.PI, Math.PI) : player.yaw;
  input.pitch = Number.isFinite(raw?.pitch) ? clamp(raw.pitch, -1.35, 1.35) : player.pitch;
  if (Number.isFinite(raw?.moveYaw)) input.moveYaw = clamp(raw.moveYaw, -Math.PI, Math.PI);
  return input;
}
function newPlayer(id, online, lifeId = 1) {
  const player = Voxel.createCombatPlayer(id);
  initializeInventory(player, { knifeOnly: true, melee: 'katana' });
  return Object.assign(player, { team: id ? 1 : 0, maxHp: RULES.health, hp: RULES.health, meleeLoadout: 'katana', lifeId, shinobiBot: !online && id > 0, name: id ? online ? 'Rival' : names[id - 1] : 'You', dashTicks: 0, dashCooldown: 0, dashX: 0, dashZ: 0, kunai: KUNAI.capacity, kunaiCooldown: 0, kunaiRecoveryTicks: 0, feintCooldown: 0, previousAbilityInput: Object.fromEntries(ABILITY_KEYS.map(key => [key, false])), damageTaken: 0, parries: 0, kunaiThrown: 0, kunaiHits: 0, dashes: 0, feints: 0 });
}
function spawnPlayers(state, preserveStats = true) {
  const old = state.players || [];
  state.players = old.map(player => {
    const fresh = newPlayer(player.id, state.online, (player.lifeId || 0) + 1), spawn = state.map.spawns[fresh.team][fresh.team ? (fresh.id - 1) % state.map.spawns[1].length : 0];
    Object.assign(fresh, spawn, { name: player.name }); fresh.previousInput = Voxel.emptyInput(spawn);
    if (preserveStats) for (const key of ['kills', 'deaths', 'damageDealt', 'shots', 'damageTaken', 'parries', 'kunaiThrown', 'kunaiHits', 'dashes', 'feints']) fresh[key] = player[key] || 0;
    return fresh;
  });
  state.fighters = state.players; state.kunai = []; state.grenades = []; state.bolts = []; state.loot = []; state.botBrain = [];
}
export function createState({ mapId = MAP_IDS[0], bots = 1, difficulty = 'hard', online = false, seed = 71423 } = {}) {
  if (!Object.hasOwn(MAPS, mapId)) throw new RangeError('Choose a Shinobi 3D arena.');
  const botCount = clamp(Number.isFinite(bots) ? Math.floor(bots) : 1, 1, 4), isOnline = online === true, map = MAPS[mapId];
  const players = Array.from({ length: isOnline ? 2 : botCount + 1 }, (_, id) => newPlayer(id, isOnline));
  const state = { gameId: 'shinobi-voxel', map, mapId, mapName: map.name, online: isOnline, bots: isOnline ? 0 : botCount, difficulty: ['normal', 'hard', 'expert'].includes(difficulty) ? difficulty : 'hard', seed: (Number.isFinite(seed) ? seed : 71423) >>> 0, teamSize: 1, capacity: isOnline ? 2 : 1, tick: 0, fightTicks: 0, matchId: 0, phase: 'lobby', phaseTicks: 0, round: 1, maxRounds: RULES.maxRounds, roundTicks: RULES.roundTicks, scores: [0, 0], winner: null, roundWinner: null, roundReason: null, players, fighters: players, kunai: [], kunaiId: 0, grenades: [], grenadeId: 0, bolts: [], boltId: 0, loot: [], events: [], eventId: 0, botBrain: [], objective: 'First to two rounds. Confirm three cuts, read the guard, and control the height.' };
  spawnPlayers(state, false); return state;
}
function prepareRound(state, ticks = RULES.countdownTicks) {
  spawnPlayers(state); state.phase = 'countdown'; state.phaseTicks = ticks; state.roundTicks = RULES.roundTicks; state.roundWinner = null; state.roundReason = null;
  emit(state, 'round', { round: state.round, mapId: state.mapId, mapName: state.mapName });
}
export function startMatch(state) {
  const { tick, eventId } = state, matchId = (state.matchId || 0) + 1, names = state.players.map(player => player.name);
  Object.assign(state, createState(state), { tick, eventId, matchId }); state.players.forEach((player, id) => { player.name = names[id] || player.name; }); prepareRound(state, RULES.initialCountdownTicks); return state;
}
export function resetLobby(state) {
  const { tick, eventId, matchId } = state, names = state.players.map(player => player.name);
  Object.assign(state, createState(state), { tick, eventId, matchId }); state.players.forEach((player, id) => { player.name = names[id] || player.name; }); return state;
}
export function pauseMatch(state) {
  if (state.online || !['countdown', 'fight', 'roundEnd'].includes(state.phase)) return false;
  state.resumePhase = state.phase; state.phase = 'paused'; neutralize(state); return true;
}
export function resumeMatch(state) {
  if (state.phase !== 'paused' || !['countdown', 'fight', 'roundEnd'].includes(state.resumePhase)) return false;
  state.phase = state.resumePhase; delete state.resumePhase; neutralize(state); return true;
}
function neutralize(state) {
  for (const player of state.players) {
    player.previousInput = Voxel.emptyInput(player); player.previousAbilityInput = Object.fromEntries(ABILITY_KEYS.map(key => [key, true]));
    player.pendingMeleeTicks = 0; player.triggerBlocked = player.meleeAimBlocked = true;
  }
}
function spendStamina(player, amount) { player.stamina = Math.max(0, player.stamina - amount); player.staminaRegenTicks = Voxel.SPRINT.regenDelayTicks; if (player.stamina <= EPS) player.sprintExhausted = true; }
function cancelCut(player) { player.meleeTicks = player.meleeCooldown = player.pendingMeleeTicks = 0; player.meleePhase = 'idle'; resetMeleeCombo(player); }
function abilityStep(state, player, input) {
  const pressed = key => input[key] && !player.previousAbilityInput[key];
  player.dashCooldown = Math.max(0, player.dashCooldown - 1); player.kunaiCooldown = Math.max(0, player.kunaiCooldown - 1); player.feintCooldown = Math.max(0, player.feintCooldown - 1);
  if (player.kunai < KUNAI.capacity && ++player.kunaiRecoveryTicks >= KUNAI.recoveryTicks) { player.kunai++; player.kunaiRecoveryTicks = 0; }
  if (player.kunai >= KUNAI.capacity) player.kunaiRecoveryTicks = 0;
  if (!player.alive) { player.dashTicks = 0; player.previousAbilityInput = Object.fromEntries(ABILITY_KEYS.map(key => [key, input[key]])); return; }
  const free = !player.hitStunTicks && !player.parryTicks && !player.dashTicks;
  const cut = meleeProfile(player), startup = player.meleeTicks > cut.activeTicks + cut.recoveryTicks, lateRecovery = player.meleeTicks > 0 && player.meleeTicks <= 10;
  if (free && pressed('dash') && player.grounded && !player.crouching && !player.dashCooldown && (!player.meleeTicks || startup || lateRecovery) && player.stamina >= DASH.staminaCost + (player.meleeTicks ? DASH.cancelCost : 0)) {
    const strafe = Number(input.right) - Number(input.left), forward = Number(input.up) - Number(input.down), length = Math.hypot(strafe, forward);
    const movementYaw = Number.isFinite(input.moveYaw) ? input.moveYaw : input.yaw;
    const dx = length ? (Math.sin(movementYaw) * forward + Math.cos(movementYaw) * strafe) / length : Math.sin(movementYaw), dz = length ? (-Math.cos(movementYaw) * forward + Math.sin(movementYaw) * strafe) / length : -Math.cos(movementYaw);
    spendStamina(player, DASH.staminaCost + (player.meleeTicks ? DASH.cancelCost : 0)); cancelCut(player);
    player.dashTicks = DASH.ticks; player.dashCooldown = DASH.cooldownTicks; player.dashX = dx; player.dashZ = dz; player.dashes++;
    emit(state, 'dashStart', { playerId: player.id, x: player.x, y: player.y, z: player.z, dx, dz, ticks: DASH.ticks });
  } else if (free && pressed('feint') && startup && !player.feintCooldown && player.stamina >= FEINT.staminaCost) {
    spendStamina(player, FEINT.staminaCost); cancelCut(player); player.meleeCooldown = FEINT.recoveryTicks; player.feintCooldown = FEINT.cooldownTicks; player.feints++;
    emit(state, 'feint', { playerId: player.id, x: player.x, y: player.y + Voxel.eyeHeight(player), z: player.z, ticks: FEINT.recoveryTicks });
  } else if (free && pressed('kunai') && !player.meleeTicks && !player.meleeCooldown && !player.kunaiCooldown && player.kunai > 0 && state.kunai.length < KUNAI.maxProjectiles) {
    const origin = meleeSlashOrigin(player), direction = Voxel.aimDirection(input.yaw, input.pitch);
    const projectile = { id: ++state.kunaiId, playerId: player.id, team: player.team, x: origin.x, y: origin.y, z: origin.z, dx: direction.x, dy: direction.y, dz: direction.z, ticks: KUNAI.ticks, bornTick: state.tick, reflected: false };
    state.kunai.push(projectile); player.kunai--; player.kunaiCooldown = player.meleeCooldown = KUNAI.cooldownTicks; player.kunaiThrown++;
    emit(state, 'kunaiThrow', { playerId: player.id, projectileId: projectile.id, x: origin.x, y: origin.y, z: origin.z, ...direction, dx: direction.x, dy: direction.y, dz: direction.z });
  }
  player.previousAbilityInput = Object.fromEntries(ABILITY_KEYS.map(key => [key, input[key]]));
  if (player.dashTicks) input.up = input.down = input.left = input.right = input.fire = input.aim = input.sprint = false;
}
function advanceDash(player, arena, peers) {
  if (!player.alive || !player.dashTicks) return;
  if (player.hitStunTicks) { player.dashTicks = 0; return; }
  const length = DASH.speed * DT, moved = Voxel.sweepPresentationOffset(player, { x: player.dashX * length, y: 0, z: player.dashZ * length }, arena, peers);
  const traveled = Math.hypot(moved.x - player.x, moved.z - player.z);
  player.x = moved.x; player.z = moved.z; player.dashTicks--;
  if (traveled < length * .25) player.dashTicks = 0;
}
function advanceAbilities(state) {
  const damage = [], remaining = [];
  for (const player of state.players) advanceDash(player, state.map, state.players.filter(peer => peer.id !== player.id));
  for (const projectile of state.kunai) {
    if (projectile.bornTick === state.tick) { remaining.push(projectile); continue; }
    const length = KUNAI.speed * DT, origin = { x: projectile.x, y: projectile.y, z: projectile.z }, direction = { x: projectile.dx, y: projectile.dy, z: projectile.dz };
    const hit = Voxel.traceShot(state, projectile.playerId, origin, direction, length, state.map);
    projectile.x = hit.x; projectile.y = hit.y; projectile.z = hit.z; projectile.ticks--;
    if (hit.kind !== 'none') {
      const target = state.players[hit.playerId];
      if (target?.alive && target.team !== projectile.team) {
        if (!projectile.reflected && !target.parryConsumed && parryPhase(target).phase === 'active' && parryFacesOrigin(target, origin)) {
          const oldOwner = projectile.playerId; projectile.playerId = target.id; projectile.team = target.team; projectile.reflected = true;
          const reflected = Voxel.aimDirection(target.parryYaw, target.parryPitch); projectile.dx = reflected.x; projectile.dy = reflected.y; projectile.dz = reflected.z;
          const spawn = meleeSlashOrigin(target); projectile.x = spawn.x; projectile.y = spawn.y; projectile.z = spawn.z;
          target.parryConsumed = true; target.parryTicks = Math.min(target.parryTicks, Voxel.parryProfile(target).recoveryTicks); target.parries++;
          emit(state, 'kunaiParry', { playerId: target.id, targetId: oldOwner, projectileId: projectile.id, x: hit.x, y: hit.y, z: hit.z }); remaining.push(projectile); continue;
        }
        damage.push({ playerId: projectile.playerId, targetId: target.id, targetLifeId: target.lifeId, damage: Math.round(KUNAI.damage * (hit.kind === 'head' ? KUNAI.headMultiplier : 1)), attack: 'kunai', weapon: 'kunai', hitKind: hit.kind === 'leg' ? 'leg' : hit.kind === 'head' ? 'head' : 'body', headshot: hit.kind === 'head', hitX: hit.x, hitY: hit.y, hitZ: hit.z, dx: projectile.dx, dy: projectile.dy, dz: projectile.dz });
        const owner = state.players[projectile.playerId]; if (owner) owner.kunaiHits++;
      }
      emit(state, 'kunaiImpact', { playerId: projectile.playerId, projectileId: projectile.id, targetId: target?.id ?? null, colliderId: hit.colliderId, kind: hit.kind, x: hit.x, y: hit.y, z: hit.z });
    } else if (projectile.ticks > 0 && projectile.y >= 0 && projectile.x >= state.map.bounds.minX && projectile.x <= state.map.bounds.maxX && projectile.z >= state.map.bounds.minZ && projectile.z <= state.map.bounds.maxZ) remaining.push(projectile);
  }
  state.kunai = remaining; return damage;
}
function finishRound(state, team, reason) {
  state.roundWinner = team; state.roundReason = reason; if (team !== null) state.scores[team]++;
  state.kunai = []; for (const player of state.players) { player.dashTicks = 0; player.sprinting = false; }
  emit(state, 'roundEnd', { winner: team, round: state.round, reason, scores: [...state.scores] });
  if (state.scores.some(score => score >= RULES.winsToMatch) || state.round >= RULES.maxRounds) {
    state.winner = state.scores[0] === state.scores[1] ? null : state.scores[0] > state.scores[1] ? 0 : 1; state.phase = 'matchEnd'; state.phaseTicks = 0;
    emit(state, 'matchEnd', { winner: state.winner, reason, scores: [...state.scores] });
  } else { state.phase = 'roundEnd'; state.phaseTicks = RULES.roundEndTicks; }
}
export function step(state, rawInputs = []) {
  if (!['countdown', 'fight', 'roundEnd'].includes(state.phase)) return state;
  state.tick++;
  if (state.phase === 'countdown' || state.phase === 'roundEnd') {
    if (--state.phaseTicks <= 0) {
      if (state.phase === 'roundEnd') { state.round++; prepareRound(state); }
      else { state.phase = 'fight'; state.phaseTicks = 0; neutralize(state); emit(state, 'fight', { round: state.round }); }
    }
    return state;
  }
  state.fightTicks++;
  const inputs = state.players.map(player => readInput(player, rawInputs[player.id]));
  for (const player of state.players) abilityStep(state, player, inputs[player.id]);
  const oldHp = state.players.map(player => player.hp), oldEvent = state.eventId;
  Voxel.combatStep(state, inputs, state.map, { additionalDamage: () => advanceAbilities(state) });
  for (const player of state.players) player.damageTaken += Math.max(0, oldHp[player.id] - player.hp);
  for (const event of state.events) if (event.id > oldEvent && event.type === 'meleeParry') state.players[event.playerId].parries++;
  state.roundTicks--;
  const teamsAlive = [0, 1].map(team => state.players.some(player => player.team === team && player.alive));
  if (!teamsAlive[0] || !teamsAlive[1]) finishRound(state, teamsAlive[0] === teamsAlive[1] ? null : teamsAlive[0] ? 0 : 1, 'elimination');
  else if (state.roundTicks <= 0) {
    const health = [0, 1].map(team => { const roster = state.players.filter(player => player.team === team); return roster.reduce((sum, player) => sum + player.hp / player.maxHp, 0) / roster.length; });
    finishRound(state, Math.abs(health[0] - health[1]) < EPS ? null : health[0] > health[1] ? 0 : 1, 'time');
  }
  return state;
}
const BOT_DIFFICULTY = Object.freeze({ normal: Object.freeze({ reactionTicks: 7, parryChance: .3, aimError: .1, throwInterval: 210, attackPause: 14 }), hard: Object.freeze({ reactionTicks: 5, parryChance: .65, aimError: .035, throwInterval: 150, attackPause: 6 }), expert: Object.freeze({ reactionTicks: 3, parryChance: .86, aimError: .012, throwInterval: 108, attackPause: 1 }) });
function randomAt(state, player, salt = 0) { let value = (state.seed ^ Math.imul(player.id + 1, 2654435761) ^ Math.imul(salt + 1, 1597334677)) >>> 0; value ^= value << 13; value ^= value >>> 17; value ^= value << 5; return (value >>> 0) / 4294967296; }
function moveToward(input, player, point) {
  const dx = point.x - player.x, dz = point.z - player.z, length = Math.hypot(dx, dz); if (length < .18) return;
  const forward = (dx * Math.sin(input.yaw) - dz * Math.cos(input.yaw)) / length, strafe = (dx * Math.cos(input.yaw) + dz * Math.sin(input.yaw)) / length;
  input.up = forward > .35; input.down = forward < -.35; input.right = strafe > .35; input.left = strafe < -.35;
}
/** Bot decisions share physical inputs and human cooldowns. No aim through cover or free equipment. */
export function botInputs(state) {
  const inputs = state.players.map(player => emptyInput(player));
  if (state.online || state.phase !== 'fight') return inputs;
  const target = state.players[0], config = BOT_DIFFICULTY[state.difficulty]; if (!target.alive) return inputs;
  for (const player of state.players) {
    if (!player.shinobiBot || !player.alive) continue;
    const input = inputs[player.id], brain = state.botBrain[player.id] ||= { path: [], planTick: -1000, targetX: target.x, targetZ: target.z, seenAttack: -1, attackSeenTick: 0, lastAttackTick: -1000, lastThrowTick: -1000 };
    const distance = Math.hypot(target.x - player.x, target.z - player.z), origin = meleeSlashOrigin(player), targetPoint = { x: target.x, y: target.y + Voxel.eyeHeight(target) * .72, z: target.z };
    const visible = navigationVisible(state.map, origin, targetPoint);
    const aimError = (randomAt(state, player, Math.floor(state.tick / 40)) - .5) * config.aimError;
    input.yaw = Math.atan2(target.x - player.x, -(target.z - player.z)) + aimError;
    input.pitch = clamp(Math.atan2(targetPoint.y - origin.y, distance), -1.25, 1.25);
    if (visible && Math.abs(target.y - player.y) < .4 && distance < 5) {
      if (distance > 2.65) moveToward(input, player, target);
      else if (distance < 1.65 && !player.meleeTicks) input.down = true;
      else if (!player.meleeTicks && !player.parryTicks) { input.left = (Math.floor(state.tick / 72) + player.id) % 2 === 0; input.right = !input.left; }
    } else {
      if (state.tick - brain.planTick >= 48 || Math.hypot(target.x - brain.targetX, target.z - brain.targetZ) > 2.5 || !brain.path.length) {
        brain.path = navigationPath(state.map, player, target).slice(0, 48); brain.planTick = state.tick; brain.targetX = target.x; brain.targetZ = target.z;
      }
      while (brain.path.length && Math.hypot(brain.path[0].x - player.x, brain.path[0].z - player.z) < .45 && Math.abs(brain.path[0].y - player.y) < .16) brain.path.shift();
      const point = brain.path[0];
      if (point) {
        input.yaw = Math.atan2(point.x - player.x, -(point.z - player.z)); input.pitch = 0; input.up = true; input.sprint = distance > 6 && player.stamina > 35;
        input.jump = point.jump && point.y > player.y + .14 && player.grounded && !player.previousInput.jump;
      }
    }
    if (!visible) continue;
    // A guard is a finite fresh commitment after a difficulty-specific reaction.
    if (target.meleeStartTick !== brain.seenAttack) { brain.seenAttack = target.meleeStartTick; brain.attackSeenTick = state.tick; }
    const threatening = distance < 3.5 && target.meleeTicks > 0 && target.meleePhase === 'startup';
    const guard = threatening && state.tick - brain.attackSeenTick >= config.reactionTicks && randomAt(state, player, target.meleeIndex + state.round * 23) < config.parryChance;
    if (guard && !player.meleeTicks && !player.meleeCooldown && !player.parryCooldown && player.stamina >= ABILITIES.parry.staminaCost) { input.aim = true; input.sprint = false; }
    else if (distance < 3.15 && Math.abs(target.y - player.y) < 1.3 && !player.parryTicks && !input.aim && !player.previousInput.fire && !player.meleeTicks && player.meleeCooldown <= 1 && state.tick - brain.lastAttackTick > config.attackPause) {
      if (parryPhase(target).phase !== 'active') { input.fire = true; input.sprint = false; brain.lastAttackTick = state.tick; }
    }
    const clearContact = Voxel.traceShot(state, player.id, origin, Voxel.aimDirection(input.yaw, input.pitch), distance + 1, state.map).playerId === target.id;
    if (distance > 4.5 && distance < 18 && clearContact && !player.meleeTicks && !player.parryTicks && state.tick - brain.lastThrowTick > config.throwInterval && player.kunai > 0) { input.kunai = true; input.sprint = false; brain.lastThrowTick = state.tick; }
    if (distance > 4.5 && distance < 8 && clearContact && player.stamina > 55 && !player.dashCooldown && !player.meleeTicks && !player.parryTicks && !input.kunai && randomAt(state, player, Math.floor(state.tick / 24)) > .65) { input.dash = true; input.up = true; input.sprint = false; }
  }
  return inputs;
}
