/** Voxel Last Stand: deterministic, shared 120 Hz solo / three-player wave survival. */
import { createCombatPlayer, combatStep, emitCombatEvent, emptyInput, INPUT_KEYS, TICK_RATE, MAPS, WEAPONS, WORLD, PLAYER_HEALTH, eyeHeight, playerHeight, aimDirection, traceShot } from './voxel-engine.js';
import { navigationPoints, navigationPath, navigationCanOccupy, navigationVisible } from './voxel-navigation.js';

export { emptyInput, INPUT_KEYS, TICK_RATE, MAPS, WEAPONS };
export const HORDE_RULES = Object.freeze({ maxMonsters: 20, maxLoot: 20, maxWarnings: 4, spawnWarningTicks: 90, emergenceTicks: 54, countdownTicks: 360, intermissionTicks: 960, reviveTicks: 360, reviveHealth: 75, pickupRange: 1.65, lootLifetimeTicks: 5400 });
export const HORDE_DIFFICULTIES = Object.freeze({ veteran: Object.freeze({ health: 1, spawn: 1, gunRest: 1, damage: 1 }), nightmare: Object.freeze({ health: 1.28, spawn: .78, gunRest: .8, damage: 1.18 }) });
export const MONSTER_TYPES = Object.freeze({
  stalker: Object.freeze({ label: 'Ash Stalker', health: 90, damage: 28, reach: 1.5, windup: 48, recovery: 72, weapon: 'carbine', walk: true }),
  runner: Object.freeze({ label: 'Rift Runner', health: 65, damage: 18, reach: 1.15, windup: 30, recovery: 54, weapon: 'smg', walk: false }),
  brute: Object.freeze({ label: 'Iron Brute', health: 240, damage: 48, reach: 1.9, windup: 84, recovery: 108, weapon: 'lmg', walk: true }),
  gunner: Object.freeze({ label: 'Hollow Gunner', health: 110, gun: true, reaction: 84, windup: 72, rest: 120, weapon: 'pistol', walk: true }),
  sniper: Object.freeze({ label: 'Rift Marksman', health: 95, gun: true, reaction: 96, windup: 108, rest: 180, weapon: 'marksman', walk: true }),
});
const EPS = 1e-7, clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const ACTIONS = Object.freeze(['fire', 'jump', 'reload', 'interact', 'swap', 'grenade', 'heal']);
const groundSpawns = new WeakMap();
const wrap = angle => Math.atan2(Math.sin(angle), Math.cos(angle));
const arenaFor = state => state.map || MAPS[state.mapId];
const settingsFor = state => HORDE_DIFFICULTIES[state.horde.config.difficulty];
const activeHumans = state => state.horde.participantIds.map(id => state.players[id]).filter(player => player?.connected && player.alive);
const humanSlot = (state, id) => Number.isInteger(id) && id >= 0 && id < state.capacity;
function spawnPointsFor(map) {
  let points = groundSpawns.get(map);
  if (!points) { points = navigationPoints(map).filter(point => point.y < .1); groundSpawns.set(map, points); }
  return points;
}

function random(state) {
  let value = state.horde.randomState;
  value ^= value << 13; value ^= value >>> 17; value ^= value << 5;
  state.horde.randomState = value >>> 0;
  return (value >>> 0) / 4294967296;
}
function normalizedOptions({ capacity = 3, mapId = 'courtyard', seed = 0x73656d61, difficulty = 'veteran' } = {}) {
  if (![1, 2, 3].includes(capacity)) throw new RangeError('Last Stand supports one to three human seats.');
  if (!Object.hasOwn(MAPS, mapId)) throw new RangeError('Choose a Last Stand map.');
  if (!Object.hasOwn(HORDE_DIFFICULTIES, difficulty)) throw new RangeError('Choose Veteran or Nightmare difficulty.');
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError('Choose a finite unsigned 32-bit seed.');
  return { capacity, mapId, seed, difficulty };
}
function humanPlayer(state, id, old = null) {
  const player = createCombatPlayer(id, 1, old?.weapon || 'carbine'), spawn = arenaFor(state).spawns[0][id];
  Object.assign(player, spawn, { y: spawn.y || 0, team: 0, human: true, monster: false, connected: old?.connected ?? id === 0, participating: false, lifeId: (old?.lifeId || 0) + 1, revivesThisWave: 0 });
  player.alive = player.connected; player.previousInput = emptyInput(player);
  if (old) for (const key of ['kills', 'deaths', 'damageDealt', 'shots']) player[key] = old[key];
  return player;
}
export function createState(options = {}) {
  const config = normalizedOptions(options);
  const state = { gameId: 'voxel-horde', capacity: config.capacity, teamSize: config.capacity, mapId: config.mapId, mapName: MAPS[config.mapId].name, tick: 0, matchId: 0, phase: 'lobby', phaseTicks: 0, round: 1, maxRounds: 0, roundTicks: 0, scores: [0, 0], winner: null, roundWinner: null, roundReason: null, players: [], fighters: [], bomb: null, grenades: [], grenadeId: 0, bolts: [], boltId: 0, events: [], eventId: 0, eventLimit: 256, loot: [], spawnWarnings: [], objective: 'Survive together. Ready up, then start the first wave.', horde: { config, seed: config.seed, randomState: config.seed || 0x9e3779b9, sessionId: 0, wave: 0, waveKills: 0, totalKills: 0, alive: 0, pending: 0, phaseTicks: 0, participantIds: [], elapsedTicks: 0, waveTicks: 0, wavesCleared: 0, revives: 0, result: null, brains: [], nextSpawnTick: 0, spawnId: 0, monsterLifeId: 0, lootId: 0, killsSinceHeal: 0, lastEventId: 0, pausedPhase: null, inputFences: Array.from({ length: config.capacity }, () => []), teamstats: { kills: 0, damage: 0, damageTaken: 0, revives: 0 } } };
  state.players = Array.from({ length: config.capacity }, (_, id) => humanPlayer(state, id)); state.fighters = state.players;
  // Navigation is prepared before the live countdown, so the first monster does
  // not trigger construction during a combat frame.
  spawnPointsFor(arenaFor(state));
  return state;
}
export function setConnected(state, id, connected) {
  if (!humanSlot(state, id)) return state;
  const player = state.players[id]; player.connected = connected === true;
  if (state.phase === 'lobby') player.alive = player.connected;
  else if (!player.connected) {
    player.alive = false; player.participating = false; player.hp = 0; player.vx = player.vy = player.vz = 0;
    state.horde.participantIds = state.horde.participantIds.filter(peer => peer !== id);
    state.horde.inputFences[id] = []; player.previousInput = emptyInput(player);
  }
  return state;
}
export function resetLobby(state) {
  const { tick, eventId, matchId } = state, old = state.players.slice(0, state.capacity), fresh = createState(state.horde.config);
  Object.assign(state, fresh, { tick, eventId, matchId }); state.horde.sessionId = matchId;
  state.players = old.map((player, id) => humanPlayer(state, id, player)); state.fighters = state.players;
  return state;
}
export function selectLoadout(state, id, weapon) {
  if (!humanSlot(state, id)) return { ok: false, changed: false, error: 'Unknown survivor.' };
  if (!Object.hasOwn(WEAPONS, weapon)) return { ok: false, changed: false, error: 'Choose a weapon from the loadout list.' };
  if (!['lobby', 'countdown', 'intermission', 'matchEnd'].includes(state.phase)) return { ok: false, changed: false, error: 'Change weapons between waves.' };
  const player = state.players[id];
  if (player.weapon === weapon) return { ok: true, changed: false };
  const catalog = WEAPONS[weapon];
  Object.assign(player, { weapon, slot: 'primary', ammo: catalog.magazine, reserve: catalog.reserve, reloadTicks: 0, shotCooldown: 0, burstRemaining: 0, spinTicks: 0, recoil: 0, heat: 0, shotIndex: 0, aiming: false, aimTicks: 0 });
  emitCombatEvent(state, 'loadout', { playerId: id, weapon });
  return { ok: true, changed: true };
}
function neutralize(state, { stop = true } = {}) {
  for (const player of state.players) { player.previousInput = emptyInput(player); player.triggerBlocked = true; if (stop) player.vx = player.vy = player.vz = 0; player.aiming = false; player.aimTicks = 0; }
}
function prepareWave(state) {
  const horde = state.horde, count = Math.max(1, horde.participantIds.length);
  horde.wave++; state.round = horde.wave; horde.waveKills = 0; horde.waveTicks = 0; horde.waveQueued = 0;
  horde.pending = 7 + horde.wave * 3 + (count - 1) * (4 + Math.floor(horde.wave * 1.5));
  horde.alive = 0; horde.nextSpawnTick = state.tick + 24;
  state.spawnWarnings = []; state.grenades = []; state.bolts = [];
  for (const player of state.players) if (player.monster) player.alive = false;
  horde.brains = [];
  for (const id of horde.participantIds) state.players[id].revivesThisWave = 0;
  state.objective = horde.wave >= 4 ? 'Armed monsters are joining the hunt. Watch their aim, keep moving and hold the line.' : 'Watch the rifts. Keep moving, cover your teammates and clear the wave.';
  emitCombatEvent(state, 'hordeWave', { wave: horde.wave, total: horde.pending, humans: count });
}
export function startMatch(state, participantIds = [0]) {
  if (!['lobby', 'matchEnd'].includes(state.phase)) return state;
  if (!Array.isArray(participantIds) || !participantIds.length || participantIds.length > state.capacity || new Set(participantIds).size !== participantIds.length || participantIds.some(id => !humanSlot(state, id))) throw new RangeError('Start with one to three distinct human seats.');
  const old = state.players.slice(0, state.capacity), { tick, eventId } = state, sessionId = state.horde.sessionId;
  Object.assign(state, createState(state.horde.config), { tick, eventId });
  state.horde.sessionId = sessionId + 1; state.matchId = state.horde.sessionId; state.horde.participantIds = participantIds.slice().sort((a, b) => a - b);
  state.horde.randomState = (state.horde.seed ^ Math.imul(sessionId + 1, 0x9e3779b9)) >>> 0 || 0x85ebca6b;
  state.players = old.map((player, id) => {
    const next = humanPlayer(state, id, player); next.connected = participantIds.includes(id) || player.connected; next.participating = participantIds.includes(id); next.alive = next.participating; next.hp = next.alive ? PLAYER_HEALTH : 0;
    next.kills = next.deaths = next.damageDealt = next.shots = 0; return next;
  }); state.fighters = state.players;
  prepareWave(state); state.phase = 'countdown'; state.phaseTicks = HORDE_RULES.countdownTicks; state.horde.phaseTicks = state.phaseTicks;
  neutralize(state); return state;
}
export function pauseMatch(state) {
  if (state.horde.participantIds.length !== 1 || !['countdown', 'fight', 'intermission'].includes(state.phase)) return state;
  state.horde.pausedPhase = state.phase; state.phase = 'paused'; neutralize(state, { stop: false }); return state;
}
export function resumeMatch(state) {
  if (state.phase !== 'paused') return state;
  state.phase = state.horde.pausedPhase || 'fight'; state.horde.pausedPhase = null;
  for (const id of state.horde.participantIds) state.horde.inputFences[id] = ACTIONS.slice();
  neutralize(state, { stop: false }); return state;
}
function lookInput(state, player, raw) {
  const input = emptyInput({ yaw: raw?.yaw ?? player.yaw, pitch: raw?.pitch ?? player.pitch });
  for (const key of INPUT_KEYS) input[key] = raw?.[key] === true;
  const fence = state.horde.inputFences[player.id];
  state.horde.inputFences[player.id] = fence.filter(key => input[key]);
  for (const key of state.horde.inputFences[player.id]) input[key] = false;
  return input;
}
function captureFence(state, inputs) {
  for (const id of state.horde.participantIds) {
    const player = state.players[id], raw = inputs[id];
    if (Number.isFinite(raw?.yaw)) player.yaw = clamp(raw.yaw, -Math.PI, Math.PI);
    if (Number.isFinite(raw?.pitch)) player.pitch = clamp(raw.pitch, -1.35, 1.35);
    state.horde.inputFences[id] = ACTIONS.filter(key => raw?.[key] === true);
    player.previousInput = emptyInput(player); player.triggerBlocked = true;
  }
}
function monsterType(state) {
  const wave = state.horde.wave, roll = random(state);
  if (wave >= 7 && roll < .14) return 'sniper';
  if (wave >= 4 && roll < Math.min(.38, .15 + (wave - 4) * .035)) return 'gunner';
  if (wave >= 3 && roll < .5) return 'brute';
  if (wave >= 2 && roll < .78) return 'runner';
  return 'stalker';
}
function spawnPoint(state) {
  const humans = activeHumans(state), map = arenaFor(state), points = spawnPointsFor(map), warnings = state.spawnWarnings;
  // The static graph already validated these ground surfaces. Only dynamic
  // humans, monsters and pending rifts need checking while choosing a warning;
  // the final materialized body is checked against physical cover again below.
  const candidates = points.filter(point => state.players.every(player => !player.alive || Math.abs(player.y - point.y) > 1.8 || Math.hypot(player.x - point.x, player.z - point.z) > 1.15) && warnings.every(warning => Math.hypot(warning.x - point.x, warning.z - point.z) > 1.5));
  if (!candidates.length || !humans.length) return null;
  const minimum = 8, safe = candidates.filter(point => humans.every(player => Math.hypot(player.x - point.x, player.z - point.z) >= minimum));
  if (!safe.length) return null;
  // Prefer the middle distance rather than perpetually sending every wave from
  // a remote corner. All living humans must get a readable 0.75 s rift warning.
  const pool = safe.filter(point => humans.some(player => Math.hypot(player.x - point.x, player.z - point.z) <= 20));
  const choices = pool.length ? pool : safe;
  return choices[Math.floor(random(state) * choices.length)];
}
function newBrain(state, player) {
  return { id: player.id, lifeId: player.lifeId, targetId: null, path: [], nextPlanTick: state.tick + player.id % 12, nextSightTick: 0, visible: false, firstSeenTick: -1, attackTargetId: null, attackYaw: 0, attackPitch: 0, attackTicks: 0, attackReady: false, recoverTicks: 0, gunTicks: 0, burstUntil: 0, nextBurstTick: 0, lastX: player.x, lastZ: player.z, lastMotionTick: state.tick, stuckTicks: 0, aimYaw: player.yaw, aimPitch: 0 };
}
function spawnMonster(state, warning) {
  const point = { x: warning.x, y: warning.y, z: warning.z }, map = arenaFor(state);
  if (!navigationCanOccupy(map, point) || state.players.some(player => player.alive && Math.abs(player.y - point.y) < 1.8 && Math.hypot(player.x - point.x, player.z - point.z) < 1.05)) return false;
  let id = state.players.findIndex((player, index) => index >= state.capacity && !player.alive);
  if (id < 0) { if (state.players.length >= state.capacity + HORDE_RULES.maxMonsters) return false; id = state.players.length; }
  const type = warning.monsterType, profile = MONSTER_TYPES[type], weapon = type === 'gunner' && state.horde.wave >= 6 ? 'carbine' : profile.weapon;
  const player = createCombatPlayer(id, 1, weapon), target = activeHumans(state)[0];
  const health = Math.round(profile.health * settingsFor(state).health * (1 + Math.min(2.8, (state.horde.wave - 1) * .12)));
  Object.assign(player, point, { yaw: target ? Math.atan2(target.x - point.x, -(target.z - point.z)) : 0, team: 1, monster: true, human: false, monsterType: type, lifeId: ++state.horde.monsterLifeId, hp: health, maxHp: health, potions: 0, grenades: 0, emergenceTicks: HORDE_RULES.emergenceTicks, monsterState: 'emerging', attackTicks: 0, attackDuration: profile.windup, aimWindupTicks: 0, reserve: WEAPONS[weapon].reserve * 8 });
  player.previousInput = emptyInput(player); state.players[id] = player; state.fighters = state.players;
  state.horde.brains[id] = newBrain(state, player);
  emitCombatEvent(state, 'monsterSpawn', { playerId: id, lifeId: player.lifeId, monsterType: type, x: point.x, y: point.y, z: point.z });
  return true;
}
function spawnTick(state) {
  const horde = state.horde, cap = Math.min(HORDE_RULES.maxMonsters, 6 + horde.wave * 2 + horde.participantIds.length * 2);
  for (let index = state.spawnWarnings.length - 1; index >= 0; index--) {
    const warning = state.spawnWarnings[index]; warning.ticksLeft--;
    if (warning.ticksLeft > 0) continue;
    if (spawnMonster(state, warning)) state.spawnWarnings.splice(index, 1);
    else if (warning.ticksLeft < -120) { horde.pending++; state.spawnWarnings.splice(index, 1); }
  }
  horde.alive = state.players.filter(player => player.monster && player.alive).length;
  if (!horde.pending || state.tick < horde.nextSpawnTick || horde.alive + state.spawnWarnings.length >= cap || state.spawnWarnings.length >= HORDE_RULES.maxWarnings) return;
  horde.nextSpawnTick = state.tick + Math.round(Math.max(24, 96 - horde.wave * 5 - horde.participantIds.length * 5) * settingsFor(state).spawn);
  const point = spawnPoint(state); if (!point) return;
  horde.pending--;
  const firstType = horde.wave >= 4 ? 'gunner' : horde.wave === 3 ? 'brute' : horde.wave === 2 ? 'runner' : 'stalker';
  const warning = { id: ++horde.spawnId, ...point, monsterType: horde.waveQueued++ === 0 ? firstType : monsterType(state), ticksLeft: HORDE_RULES.spawnWarningTicks, durationTicks: HORDE_RULES.spawnWarningTicks };
  state.spawnWarnings.push(warning); emitCombatEvent(state, 'monsterRift', { ...warning });
}
function targetVisible(state, player, target) {
  if (!target?.alive) return false;
  const origin = { x: player.x, y: player.y + eyeHeight(player), z: player.z }, dx = target.x - origin.x, dy = target.y + playerHeight(target) * .57 - origin.y, dz = target.z - origin.z, distance = Math.hypot(dx, dy, dz);
  if (distance < EPS) return true;
  return traceShot(state, player.id, origin, { x: dx / distance, y: dy / distance, z: dz / distance }, distance + .4, arenaFor(state)).playerId === target.id;
}
function steer(player, brain, input) {
  while (brain.path.length && Math.hypot(brain.path[0].x - player.x, brain.path[0].z - player.z) < .38 && Math.abs((brain.path[0].y || 0) - player.y) < .24) brain.path.shift();
  const point = brain.path[0]; if (!point) return;
  const dx = point.x - player.x, dz = point.z - player.z, distance = Math.hypot(dx, dz); if (distance < EPS) return;
  const forward = (Math.sin(input.yaw) * dx - Math.cos(input.yaw) * dz) / distance, right = (Math.cos(input.yaw) * dx + Math.sin(input.yaw) * dz) / distance;
  input.up = forward > .25; input.down = forward < -.25; input.right = right > .25; input.left = right < -.25;
  // Jump is an edge in the shared engine. Holding it through landing would make
  // the next crate unreachable, so release between the authored stair rises.
  input.jump = (point.jump || point.y > player.y + .3) && player.grounded && !player.previousInput.jump;
}
function monsterInput(state, player, brain) {
  const input = emptyInput(player), profile = MONSTER_TYPES[player.monsterType];
  if (!player.alive) return input;
  if (player.emergenceTicks > 0) { player.emergenceTicks--; player.monsterState = 'emerging'; return input; }
  const humans = activeHumans(state), target = humans.reduce((nearest, candidate) => !nearest || Math.hypot(candidate.x - player.x, candidate.z - player.z) < Math.hypot(nearest.x - player.x, nearest.z - player.z) ? candidate : nearest, null);
  if (!target) return input;
  if (brain.targetId !== target.id) { brain.targetId = target.id; brain.nextPlanTick = 0; brain.firstSeenTick = -1; brain.visible = false; }
  if (state.tick >= brain.nextSightTick) {
    brain.nextSightTick = state.tick + 6;
    brain.visible = targetVisible(state, player, target);
    if (!brain.visible) brain.firstSeenTick = -1;
    else if (brain.firstSeenTick < 0) brain.firstSeenTick = state.tick;
  }
  if (state.tick >= brain.nextPlanTick) {
    brain.nextPlanTick = state.tick + 90 + player.id % 12;
    brain.path = navigationPath(arenaFor(state), player, target);
  }
  if (state.tick - brain.lastMotionTick >= 120) {
    const moved = Math.hypot(player.x - brain.lastX, player.z - brain.lastZ);
    brain.stuckTicks = moved < .2 && brain.path.length ? brain.stuckTicks + 120 : 0;
    if (brain.stuckTicks) brain.nextPlanTick = 0;
    brain.lastX = player.x; brain.lastZ = player.z; brain.lastMotionTick = state.tick;
  }
  const dx = target.x - player.x, dz = target.z - player.z, distance = Math.hypot(dx, dz), desiredYaw = Math.atan2(dx, -dz), desiredPitch = Math.atan2(target.y + playerHeight(target) * .57 - player.y - eyeHeight(player), distance);
  const committed = brain.attackTicks > 0 || brain.gunTicks > 0 || state.tick < brain.burstUntil;
  const yaw = committed ? brain.attackYaw : brain.visible ? desiredYaw : brain.path[0] ? Math.atan2(brain.path[0].x - player.x, -(brain.path[0].z - player.z)) : desiredYaw;
  const pitch = committed ? brain.attackPitch : desiredPitch;
  input.yaw = wrap(player.yaw + clamp(wrap(yaw - player.yaw), -5.2 / TICK_RATE, 5.2 / TICK_RATE));
  input.pitch = player.pitch + clamp(pitch - player.pitch, -4 / TICK_RATE, 4 / TICK_RATE);
  input.walk = profile.walk; player.monsterState = 'chase';
  if (brain.recoverTicks > 0) { brain.recoverTicks--; player.monsterState = 'recover'; if (brain.recoverTicks > 18) return input; }
  if (profile.gun) {
    if (!player.ammo && !player.reloadTicks && player.reserve > 0) input.reload = !player.previousInput.reload;
    if (brain.gunTicks > 0) {
      brain.gunTicks--; player.monsterState = 'aiming'; player.aimWindupTicks = brain.gunTicks; input.aim = true;
      if (brain.gunTicks === 0) { brain.burstUntil = state.tick + (player.weapon === 'carbine' ? 29 : 2); brain.nextBurstTick = brain.burstUntil + Math.round(profile.rest * settingsFor(state).gunRest); }
      return input;
    }
    if (state.tick < brain.burstUntil) {
      input.aim = true; player.monsterState = 'aiming';
      const hit = traceShot(state, player.id, { x: player.x, y: player.y + eyeHeight(player), z: player.z }, aimDirection(input.yaw, input.pitch), WEAPONS[player.weapon].range, arenaFor(state));
      input.fire = hit.playerId === null || state.players[hit.playerId]?.team !== player.team;
      return input;
    }
    if (brain.visible && brain.firstSeenTick >= 0 && state.tick - brain.firstSeenTick >= profile.reaction && state.tick >= brain.nextBurstTick && !player.reloadTicks && Math.abs(wrap(player.yaw - desiredYaw)) < .25) {
      const error = .018 + Math.min(.035, distance * .0006);
      brain.attackYaw = desiredYaw + (random(state) * 2 - 1) * error; brain.attackPitch = desiredPitch + (random(state) * 2 - 1) * error;
      brain.gunTicks = profile.windup; player.aimWindupTicks = profile.windup; player.monsterState = 'aiming';
      emitCombatEvent(state, 'monsterAim', { playerId: player.id, targetId: target.id, ticks: profile.windup, yaw: brain.attackYaw, pitch: brain.attackPitch });
      return input;
    }
    if (brain.visible && distance < 9) { input.left = player.id % 2 === 0; input.right = !input.left; input.walk = true; }
    else steer(player, brain, input);
    return input;
  }
  if (brain.attackTicks > 0) {
    brain.attackTicks--; player.attackTicks = brain.attackTicks; player.monsterState = 'windup';
    if (!brain.attackTicks) { brain.attackReady = true; brain.recoverTicks = profile.recovery; }
    return input;
  }
  if (!brain.recoverTicks && brain.visible && distance <= profile.reach + target.radius && Math.abs(target.y - player.y) < 1.25 && Math.abs(wrap(player.yaw - desiredYaw)) < .3) {
    const attackY = player.y + eyeHeight(player) * .76;
    brain.attackTicks = profile.windup; brain.attackTargetId = target.id; brain.attackYaw = desiredYaw; brain.attackPitch = Math.atan2(clamp(attackY, target.y + .18, target.y + playerHeight(target) - .16) - attackY, distance); player.attackTicks = profile.windup; player.monsterState = 'windup';
    emitCombatEvent(state, 'monsterWindup', { playerId: player.id, targetId: target.id, monsterType: player.monsterType, ticks: profile.windup, yaw: desiredYaw });
    return input;
  }
  steer(player, brain, input); return input;
}
function monsterDamage(state) {
  const hits = [];
  for (const brain of state.horde.brains) {
    if (!brain?.attackReady) continue;
    brain.attackReady = false;
    const player = state.players[brain.id], target = state.players[brain.attackTargetId], profile = MONSTER_TYPES[player?.monsterType];
    if (!player?.alive || !target?.alive || target.team === player.team || !target.connected || !target.participating || !profile || profile.gun) continue;
    const origin = { x: player.x, y: player.y + eyeHeight(player) * .76, z: player.z }, dx = target.x - origin.x, dz = target.z - origin.z, targetY = clamp(origin.y, target.y + .18, target.y + playerHeight(target) - .16), dy = targetY - origin.y, distance = Math.hypot(dx, dy, dz);
    const direction = aimDirection(brain.attackYaw, brain.attackPitch);
    let hit = false;
    if (distance > EPS && Math.hypot(Math.max(0, Math.hypot(dx, dz) - target.radius), dy) <= profile.reach && (dx * direction.x + dy * direction.y + dz * direction.z) / distance >= Math.cos(.65)) {
      hit = traceShot(state, player.id, origin, { x: dx / distance, y: dy / distance, z: dz / distance }, distance + .01, arenaFor(state)).playerId === target.id;
      if (hit) hits.push({ playerId: player.id, targetId: target.id, damage: Math.round(profile.damage * settingsFor(state).damage), hitKind: 'body', headshot: false, attack: 'monster', weapon: player.monsterType });
    }
    emitCombatEvent(state, 'monsterAttack', { playerId: player.id, targetId: target.id, monsterType: player.monsterType, hit, x: player.x, y: player.y, z: player.z });
  }
  return hits;
}
function interactionClear(state, player, point) {
  const origin = { x: player.x, y: player.y + eyeHeight(player), z: player.z }, target = { x: point.x, y: point.y + .5, z: point.z };
  return navigationVisible(arenaFor(state), origin, target);
}
export function findNearbyLoot(state, id) {
  const player = state.players[id]; if (!humanSlot(state, id) || !player?.alive || !player.participating) return null;
  const weapon = WEAPONS[player.weapon];
  return state.loot.filter(drop => Math.hypot(drop.x - player.x, drop.z - player.z) <= HORDE_RULES.pickupRange && Math.abs(drop.y - player.y) < 1.5 && (drop.type === 'health' ? player.hp < player.maxHp : player.reserve < weapon.reserve * 2) && interactionClear(state, player, drop)).sort((a, b) => Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z) || a.id - b.id)[0] || null;
}
export function findReviveTarget(state, id) {
  const player = state.players[id]; if (!humanSlot(state, id) || !player?.alive || !player.participating) return null;
  return state.horde.participantIds.map(peer => state.players[peer]).filter(peer => peer.id !== id && peer.connected && peer.participating && !peer.alive && peer.revivesThisWave < 1 && Math.hypot(peer.x - player.x, peer.z - player.z) <= 1.8 && Math.abs(peer.y - player.y) < 1.3 && interactionClear(state, player, peer)).sort((a, b) => a.id - b.id)[0] || null;
}
function pickup(state, player, drop) {
  if (drop.type === 'health') player.hp = Math.min(player.maxHp, player.hp + drop.amount);
  else player.reserve = Math.min(WEAPONS[player.weapon].reserve * 2, player.reserve + Math.ceil(WEAPONS[player.weapon].magazine * 1.5));
  state.loot = state.loot.filter(item => item.id !== drop.id);
  emitCombatEvent(state, 'loot', { playerId: player.id, lootId: drop.id, kind: drop.kind, amount: drop.amount, x: drop.x, y: drop.y, z: drop.z });
}
function safeHumanPosition(state, preferred, radius = Infinity) {
  const map = arenaFor(state), candidates = [{ x: preferred.x, y: preferred.y || 0, z: preferred.z }, ...navigationPoints(map).filter(point => Math.abs(point.y - (preferred.y || 0)) < .2 && Math.hypot(point.x - preferred.x, point.z - preferred.z) < radius).sort((a, b) => Math.hypot(a.x - preferred.x, a.z - preferred.z) - Math.hypot(b.x - preferred.x, b.z - preferred.z))];
  return candidates.find(point => navigationCanOccupy(map, point) && state.players.every(peer => !peer.alive || point.y >= peer.y + playerHeight(peer) - EPS || point.y + WORLD.standHeight <= peer.y + EPS || Math.hypot(peer.x - point.x, peer.z - point.z) > peer.radius + WORLD.radius + .025) && (radius === Infinity || navigationVisible(map, { x: preferred.x, y: (preferred.y || 0) + .8, z: preferred.z }, { x: point.x, y: point.y + .8, z: point.z }))) || null;
}
function humanInteractions(state, inputs, previous) {
  for (const player of activeHumans(state)) {
    const input = inputs[player.id], revive = input.interact && findReviveTarget(state, player.id);
    const quiet = player.grounded && Math.hypot(player.vx, player.vz) < .35 && !input.fire && !input.jump && !input.grenade && !input.heal && !input.swap && !player.healTicks && !player.reloadTicks && !player.grenadeThrowTicks && player.lastHitTick !== state.tick;
    if (revive && quiet) {
      if (player.interaction !== `revive:${revive.id}`) { player.interaction = `revive:${revive.id}`; player.interactTicks = 0; }
      if (++player.interactTicks >= HORDE_RULES.reviveTicks) {
        const position = safeHumanPosition(state, revive, 1.8);
        if (!position) { player.interactTicks = HORDE_RULES.reviveTicks; continue; }
        const fresh = createCombatPlayer(revive.id, 1, revive.weapon);
        for (const key of ['x', 'y', 'z', 'yaw', 'pitch', 'kills', 'deaths', 'damageDealt', 'shots', 'connected', 'participating', 'lifeId']) fresh[key] = revive[key];
        Object.assign(fresh, position, { team: 0, human: true, monster: false, hp: HORDE_RULES.reviveHealth, potions: 0, grenades: 0, revivesThisWave: revive.revivesThisWave + 1, lifeId: revive.lifeId + 1, triggerBlocked: true });
        fresh.previousInput = emptyInput(fresh); state.players[revive.id] = fresh;
        state.horde.inputFences[revive.id] = ACTIONS.slice(); state.horde.revives++; state.horde.teamstats.revives++;
        player.interaction = null; player.interactTicks = 0;
        emitCombatEvent(state, 'hordeRevive', { playerId: player.id, targetId: fresh.id, hp: fresh.hp, x: fresh.x, y: fresh.y, z: fresh.z });
      }
    } else {
      player.interaction = null; player.interactTicks = 0;
      if (input.interact && !previous[player.id]?.interact) { const drop = findNearbyLoot(state, player.id); if (drop) pickup(state, player, drop); }
    }
  }
  state.fighters = state.players;
}
function dropLoot(state, event) {
  const horde = state.horde; horde.killsSinceHeal++;
  const needsHeal = activeHumans(state).some(player => player.hp < 150), roll = random(state);
  let type = roll < (needsHeal ? .36 : .19) || horde.killsSinceHeal >= 5 ? 'health' : roll < .72 ? 'ammo' : null;
  if (!type) return;
  if (type === 'health') horde.killsSinceHeal = 0;
  const drop = { id: ++horde.lootId, type, kind: type === 'health' ? 'heal' : 'ammo', x: event.x, y: event.y, z: event.z, amount: type === 'health' ? 45 : 1.5, spawnTick: state.tick, expiresTick: state.tick + HORDE_RULES.lootLifetimeTicks };
  if (state.loot.length >= HORDE_RULES.maxLoot) state.loot.splice(0, 1);
  state.loot.push(drop); emitCombatEvent(state, 'hordeDrop', { ...drop });
}
function recordCombat(state) {
  const horde = state.horde, fresh = state.events.filter(event => event.id > horde.lastEventId);
  // Capture the cursor before appending drops, so each existing combat kill is
  // counted exactly once even when slots are recycled later in the same wave.
  horde.lastEventId = state.eventId;
  for (const event of fresh) {
    if (event.type === 'kill' && state.players[event.targetId]?.monster) { horde.waveKills++; horde.totalKills++; horde.teamstats.kills++; dropLoot(state, event); }
    if (event.type === 'damage') {
      if (humanSlot(state, event.targetId)) horde.teamstats.damageTaken += event.damage;
      else if (humanSlot(state, event.playerId)) horde.teamstats.damage += event.damage;
    }
  }
}
function beginIntermission(state) {
  const horde = state.horde; horde.wavesCleared++; state.phase = 'intermission'; state.phaseTicks = HORDE_RULES.intermissionTicks; horde.phaseTicks = state.phaseTicks;
  state.grenades = []; state.bolts = []; state.spawnWarnings = [];
  for (const id of horde.participantIds) {
    const old = state.players[id], weapon = WEAPONS[old.weapon];
    if (!old.alive) { const restored = humanPlayer(state, id, old), position = safeHumanPosition(state, restored); if (!position) continue; Object.assign(restored, position); restored.participating = true; restored.hp = 150; state.players[id] = restored; }
    else { old.hp = Math.min(old.maxHp, old.hp + 35); if (old.healTicks) old.potions = Math.min(2, old.potions + 1); old.reloadTicks = old.healTicks = old.meleeTicks = old.meleeCooldown = old.grenadeThrowTicks = old.burstRemaining = old.spinTicks = 0; old.healing = false; old.meleePhase = 'idle'; }
    const player = state.players[id]; player.ammo = weapon.magazine; player.reserve = Math.min(weapon.reserve * 2, player.reserve + weapon.magazine * 2); player.grenades = Math.min(2, player.grenades + 1); player.potions = Math.min(2, player.potions + (horde.wave % 2 === 0 ? 1 : 0)); player.interaction = null; player.interactTicks = 0;
  }
  state.fighters = state.players; state.objective = 'Wave cleared. Catch your breath, regroup and choose your next loadout.';
  for (const id of horde.participantIds) horde.inputFences[id] = ACTIONS.filter(key => state.players[id].previousInput[key]);
  neutralize(state, { stop: false }); emitCombatEvent(state, 'hordeClear', { wave: horde.wave, seconds: horde.waveTicks / TICK_RATE });
}
function finish(state) {
  state.phase = 'matchEnd'; state.phaseTicks = 0; state.horde.phaseTicks = 0; state.horde.result = 'lost'; state.winner = 1; state.roundWinner = 1; state.roundReason = 'The squad fell.';
  state.objective = 'The squad fell. Compare your waves survived, regroup and try another run.';
  neutralize(state); emitCombatEvent(state, 'hordeEnd', { wave: state.horde.wave, wavesCleared: state.horde.wavesCleared, kills: state.horde.totalKills, elapsedTicks: state.horde.elapsedTicks });
}
export function step(state, rawInputs = []) {
  if (!state?.horde || !['countdown', 'fight', 'intermission'].includes(state.phase)) return state;
  state.tick++;
  if (!activeHumans(state).length) { finish(state); return state; }
  if (state.phase === 'intermission') {
    const previous = state.players.slice(0, state.capacity).map(player => ({ ...player.previousInput }));
    const inputs = state.players.map(player => {
      const input = !player.monster && player.participating && player.connected ? lookInput(state, player, rawInputs[player.id]) : emptyInput(player);
      for (const key of ['fire', 'grenade', 'heal', 'swap', 'reload']) input[key] = false;
      return input;
    });
    combatStep(state, inputs, arenaFor(state));
    humanInteractions(state, inputs, previous);
    state.loot = state.loot.filter(drop => drop.expiresTick > state.tick);
    if (--state.phaseTicks <= 0) {
      captureFence(state, rawInputs); prepareWave(state); state.phase = 'fight'; state.phaseTicks = 0;
      for (const id of state.horde.participantIds) state.players[id].triggerBlocked = false;
      emitCombatEvent(state, 'hordeFight', { wave: state.horde.wave });
    }
    state.horde.phaseTicks = state.phaseTicks; return state;
  }
  if (state.phase === 'countdown') {
    captureFence(state, rawInputs);
    if (--state.phaseTicks <= 0) {
      state.phase = 'fight'; state.phaseTicks = 0;
      for (const id of state.horde.participantIds) state.players[id].triggerBlocked = false;
      emitCombatEvent(state, 'hordeFight', { wave: state.horde.wave });
    }
    state.horde.phaseTicks = state.phaseTicks; return state;
  }
  state.horde.elapsedTicks++; state.horde.waveTicks++;
  state.loot = state.loot.filter(drop => drop.expiresTick > state.tick);
  spawnTick(state);
  const previous = state.players.slice(0, state.capacity).map(player => ({ ...player.previousInput }));
  const inputs = state.players.map(player => {
    if (!player.monster) return player.participating && player.connected ? lookInput(state, player, rawInputs[player.id]) : emptyInput(player);
    if (!player.alive) return emptyInput(player);
    const brain = state.horde.brains[player.id] ||= newBrain(state, player);
    return monsterInput(state, player, brain);
  });
  combatStep(state, inputs, arenaFor(state), { additionalDamage: monsterDamage });
  recordCombat(state); humanInteractions(state, inputs, previous);
  state.horde.alive = state.players.filter(player => player.monster && player.alive).length;
  if (!activeHumans(state).length) finish(state);
  else if (!state.horde.pending && !state.horde.alive && !state.spawnWarnings.length) beginIntermission(state);
  return state;
}
