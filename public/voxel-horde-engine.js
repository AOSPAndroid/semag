/** Voxel Last Stand: deterministic, shared 120 Hz solo / three-player wave survival. */
import { createCombatPlayer, combatStep, emitCombatEvent, emptyInput, INPUT_KEYS, TICK_RATE, MAPS, WEAPONS, WORLD, PLAYER_HEALTH, eyeHeight, playerHeight, aimDirection, traceShot, pickupCombatLoot, addInventoryLoot, advanceInventoryLoot, resetSprint } from './voxel-engine.js';
import { navigationPoints, navigationPath, navigationCanOccupy, navigationVisible } from './voxel-navigation.js';
import { INVENTORY_ACTIONS, createInventoryGun, createInventoryMelee, ensureInventory, refreshInventory, storeInventoryGun, inventoryCanTake, setInventoryLoadout, setInventoryMeleeLoadout } from './voxel-inventory.js';
import { MELEE_WEAPONS, clearMeleeComboContinuation, resetMeleeDefense } from './voxel-melee.js';
import { monsterBodyProfile, monsterAttackHeight } from './voxel-monster-bodies.js';
import { MONSTER_SPECIAL_RULES, launchMonsterShard, markMonsterRune, cancelMonsterRunes, bomberDamage, advanceMonsterSpecials } from './voxel-monster-specials.js';
import { resolveActiveFire, weaponFireIntervalTicks } from './voxel-fire-modes.js';

export { emptyInput, INPUT_KEYS, TICK_RATE, MAPS, WEAPONS };
export const HORDE_RULES = Object.freeze({ maxMonsters: 20, maxLoot: 20, maxWarnings: 4, spawnWarningTicks: 90, emergenceTicks: 54, countdownTicks: 360, intermissionTicks: 960, reviveTicks: 360, reviveHealth: 75, pickupRange: 1.65, lootLifetimeTicks: 5400 });
export const HORDE_DIFFICULTIES = Object.freeze({ veteran: Object.freeze({ health: 1, spawn: 1, gunRest: 1, damage: 1 }), nightmare: Object.freeze({ health: 1.28, spawn: .78, gunRest: .8, damage: 1.18 }) });
// Only the first three waves grant a close-combat damage opening. Monsters keep
// their full health, movement and attack damage; later armed waves stay demanding.
export const HORDE_MELEE_RULES = Object.freeze({ damageScales: Object.freeze([1.6, 1.4, 1.2]), staggerRecoveryTicks: 84, comboStaggerMultiplier: 1.25, staggerTicks: Object.freeze({ knife: 18, sword: 28, katana: 32, axe: 44, tonfas: 16 }), supplyWeapons: Object.freeze(['tonfas', 'axe', 'sword', 'katana']) });
export const MONSTER_TYPES = Object.freeze({
  stalker: Object.freeze({ label: 'Ash Stalker', health: 90, damage: 28, reach: 1.5, windup: 48, recovery: 72, weapon: 'carbine', walk: true }),
  runner: Object.freeze({ label: 'Rift Runner', health: 65, damage: 18, reach: 1.15, windup: 30, recovery: 54, weapon: 'smg', walk: false }),
  brute: Object.freeze({ label: 'Iron Brute', health: 240, damage: 48, reach: 1.9, windup: 84, recovery: 108, weapon: 'lmg', walk: true }),
  gunner: Object.freeze({ label: 'Hollow Gunner', health: 110, gun: true, reaction: 84, windup: 72, rest: 120, weapon: 'pistol', walk: true }),
  sniper: Object.freeze({ label: 'Rift Marksman', health: 95, gun: true, reaction: 96, windup: 108, rest: 180, weapon: 'marksman', walk: true }),
  hound: Object.freeze({ label: 'Grave Hound', health: 45, damage: 12, reach: .95, windup: 24, recovery: 48, speed: 6.8, unarmed: true, walk: false }),
  leaper: Object.freeze({ label: 'Rift Leaper', health: 100, damage: 26, reach: 1.2, windup: 54, recovery: 78, speed: 5.5, lunge: true, lungeRange: 3.6, lungeTicks: 30, lungeSpeed: 9, unarmed: true, walk: false }),
  screecher: Object.freeze({ label: 'Ash Screecher', health: 105, damage: 16, reach: 1.3, windup: 42, recovery: 72, speed: 3.8, roar: true, roarWindup: 72, roarCooldown: 720, rallyRange: 8, rallyTicks: 180, unarmed: true, walk: false }),
  bomber: Object.freeze({ label: 'Cinder Bomber', health: 105, special: 'bomber', windup: 90, recovery: 180, reach: 3.2, speed: 5.8, unarmed: true, walk: false }),
  spitter: Object.freeze({ label: 'Shard Spitter', health: 125, special: 'spitter', windup: 78, reaction: 48, recovery: 180, reach: 22, speed: 3.6, unarmed: true, walk: false }),
  weaver: Object.freeze({ label: 'Rift Weaver', health: 150, special: 'weaver', windup: 108, reaction: 60, recovery: 240, reach: 24, speed: 3.1, unarmed: true, walk: false }),
});
export const HORDE_RALLY_RULES = Object.freeze({ speedMultiplier: 1.18, maxTicks: 180 });
const GUNNER_POOLS = Object.freeze([
  Object.freeze(['pistol', 'classic', 'ghost', 'frenzy', 'bandit']),
  Object.freeze(['pistol', 'classic', 'ghost', 'frenzy', 'bandit', 'carbine', 'smg', 'sheriff', 'stinger', 'spectre', 'shorty', 'bucky']),
  Object.freeze(['pistol', 'classic', 'ghost', 'frenzy', 'bandit', 'carbine', 'smg', 'sheriff', 'stinger', 'spectre', 'shorty', 'bucky', 'judge', 'bulldog', 'guardian', 'phantom', 'vandal', 'ares']),
  Object.freeze(['pistol', 'classic', 'ghost', 'frenzy', 'bandit', 'carbine', 'smg', 'sheriff', 'stinger', 'spectre', 'shorty', 'bucky', 'judge', 'bulldog', 'guardian', 'phantom', 'vandal', 'ares', 'odin']),
]);
const SNIPER_POOLS = Object.freeze([
  Object.freeze(['marksman', 'marshal']),
  Object.freeze(['marksman', 'marshal', 'outlaw', 'warden']),
  Object.freeze(['marksman', 'marshal', 'outlaw', 'warden', 'operator']),
]);
/** Armed creatures unlock larger pools; the first three waves retain claws and blades. */
export function monsterWeaponPool(type, wave) {
  if (type === 'gunner' && wave >= 4) return GUNNER_POOLS[wave >= 12 ? 3 : wave >= 9 ? 2 : wave >= 6 ? 1 : 0];
  if (type === 'sniper' && wave >= 7) return SNIPER_POOLS[wave >= 12 ? 2 : wave >= 9 ? 1 : 0];
  return Object.freeze([MONSTER_TYPES[type]?.weapon || 'carbine']);
}
/** Independent seed hashing leaves the wave, movement and corpse-supply RNG unchanged. */
export function monsterWeaponFor(type, wave, seed) {
  const pool = monsterWeaponPool(type, wave);
  let value = (seed >>> 0) ^ Math.imul(wave | 0, 0x9e3779b9) ^ (type === 'sniper' ? 0x85ebca6b : 0xc2b2ae35);
  value = Math.imul(value ^ value >>> 16, 0x21f0aaad);
  value = Math.imul(value ^ value >>> 15, 0x735a2d97);
  return pool[((value ^ value >>> 15) >>> 0) % pool.length];
}
const EPS = 1e-7, clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const ACTIONS = Object.freeze(['fire', 'aim', 'jump', 'reload', 'interact', 'swap', 'grenade', 'heal', 'sprint', ...INVENTORY_ACTIONS]);
const groundSpawns = new WeakMap();
const wrap = angle => Math.atan2(Math.sin(angle), Math.cos(angle));
const arenaFor = state => state.map || MAPS[state.mapId];
const settingsFor = state => HORDE_DIFFICULTIES[state.horde.config.difficulty];
const activeHumans = state => state.horde.participantIds.map(id => state.players[id]).filter(player => player?.connected && player.alive);
const humanSlot = (state, id) => Number.isInteger(id) && id >= 0 && id < state.capacity;
function spawnPointsFor(map, type = null) {
  let bodies = groundSpawns.get(map);
  if (!bodies) { bodies = new Map(); groundSpawns.set(map, bodies); }
  const key = type === 'hound' ? 'hound' : 'human'; let points = bodies.get(key);
  if (!points) { points = navigationPoints(map, key === 'hound' ? { monster: true, human: false, monsterType: 'hound' } : undefined).filter(point => point.y < .1); bodies.set(key, points); }
  return points;
}

function random(state) {
  let value = state.horde.randomState;
  value ^= value << 13; value ^= value >>> 17; value ^= value << 5;
  state.horde.randomState = value >>> 0;
  return (value >>> 0) / 4294967296;
}
function normalizedOptions({ capacity = 3, mapId = 'courtyard', seed = 0x73656d61, difficulty = 'veteran', melee = 'knife' } = {}) {
  if (![1, 2, 3].includes(capacity)) throw new RangeError('Last Stand supports one to three human seats.');
  if (!Object.hasOwn(MAPS, mapId)) throw new RangeError('Choose a Last Stand map.');
  if (!Object.hasOwn(HORDE_DIFFICULTIES, difficulty)) throw new RangeError('Choose Veteran or Nightmare difficulty.');
  if (typeof melee !== 'string' || !Object.hasOwn(MELEE_WEAPONS, melee)) throw new RangeError('Choose a close-combat weapon from the loadout list.');
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError('Choose a finite unsigned 32-bit seed.');
  return { capacity, mapId, seed, difficulty, melee: 'knife' };
}
function humanPlayer(state, id, old = null) {
  const player = createCombatPlayer(id, 1, old?.weapon || 'carbine'), spawn = arenaFor(state).spawns[0][id];
  Object.assign(player, spawn, { y: spawn.y || 0, team: 0, human: true, monster: false, connected: old?.connected ?? id === 0, participating: false, lifeId: (old?.lifeId || 0) + 1, revivesThisWave: 0, hordeMelee: 'knife' });
  setInventoryMeleeLoadout(player, player.hordeMelee);
  player.alive = player.connected; player.previousInput = emptyInput(player);
  if (old) for (const key of ['kills', 'deaths', 'damageDealt', 'shots']) player[key] = old[key];
  return player;
}
export function createState(options = {}) {
  const config = normalizedOptions(options);
  const state = { gameId: 'voxel-horde', capacity: config.capacity, teamSize: config.capacity, mapId: config.mapId, mapName: MAPS[config.mapId].name, tick: 0, matchId: 0, phase: 'lobby', phaseTicks: 0, round: 1, maxRounds: 0, roundTicks: 0, scores: [0, 0], winner: null, roundWinner: null, roundReason: null, players: [], fighters: [], bomb: null, grenades: [], grenadeId: 0, bolts: [], boltId: 0, events: [], eventId: 0, eventLimit: 256, loot: [], spawnWarnings: [], objective: 'Survive together. Ready up, then start the first wave.', horde: { projectiles: [], hazards: [], specialId: 0, config, seed: config.seed, randomState: config.seed || 0x9e3779b9, sessionId: 0, wave: 0, waveKills: 0, totalKills: 0, alive: 0, pending: 0, phaseTicks: 0, participantIds: [], elapsedTicks: 0, waveTicks: 0, wavesCleared: 0, revives: 0, result: null, brains: [], nextSpawnTick: 0, spawnId: 0, monsterLifeId: 0, lootId: 0, killsSinceHeal: 0, lastEventId: 0, pausedPhase: null, inputFences: Array.from({ length: config.capacity }, () => []), teamstats: { kills: 0, damage: 0, damageTaken: 0, revives: 0 } } };
  state.players = Array.from({ length: config.capacity }, (_, id) => humanPlayer(state, id)); state.fighters = state.players;
  // Navigation is prepared before the live countdown, so the first monster does
  // not trigger construction during a combat frame.
  spawnPointsFor(arenaFor(state));
  spawnPointsFor(arenaFor(state), 'hound');
  return state;
}
export function setConnected(state, id, connected) {
  if (!humanSlot(state, id)) return state;
  const player = state.players[id]; player.connected = connected === true;
  if (state.phase === 'lobby') player.alive = player.connected;
  else if (!player.connected) {
    player.alive = false; player.participating = false; player.hp = 0; player.vx = player.vy = player.vz = 0;
    player.hitStunTicks = player.hitStunReadyTicks = 0;
    resetSprint(player,{refill:false});
    resetMeleeDefense(player, { blockAim: true });
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
  if (player.hasGun && player.weapon === weapon) return { ok: true, changed: false };
  setInventoryLoadout(player, weapon);
  emitCombatEvent(state, 'loadout', { playerId: id, weapon });
  return { ok: true, changed: true };
}
export function validateMeleeChoice(state, id, melee) {
  if (!humanSlot(state, id)) return { ok: false, changed: false, error: 'Unknown survivor.' };
  if (typeof melee !== 'string' || !Object.hasOwn(MELEE_WEAPONS, melee)) return { ok: false, changed: false, error: 'Choose a close-combat weapon from the loadout list.' };
  if (!['lobby', 'countdown', 'intermission', 'matchEnd'].includes(state.phase)) return { ok: false, changed: false, error: 'Change weapons between waves.' };
  if (melee !== 'knife') return { ok: false, changed: false, error: 'Find close-combat weapons on defeated monsters.' };
  if (['countdown','intermission'].includes(state.phase) && (state.players[id].inventory[0]?.kind !== 'melee' || state.players[id].inventory[0]?.weapon !== 'knife')) return { ok: false, changed: false, error: 'Keep your collected equipment until the next run.' };
  return { ok: true, changed: false };
}
export function chooseMelee(state, id, melee) {
  const valid=validateMeleeChoice(state,id,melee);if(!valid.ok)return valid;
  // Legacy knife setup requests acknowledge the fixed starter without creating
  // another physical item or overwriting equipment collected during the run.
  return valid;
}
function neutralize(state, { stop = true } = {}) {
  for (const player of state.players) { clearMeleeComboContinuation(player); player.previousInput = emptyInput(player); player.triggerBlocked = true; player.sprinting = false; if (stop) player.vx = player.vy = player.vz = 0; player.aiming = false; player.aimTicks = 0; }
}
function prepareWave(state) {
  const horde = state.horde, count = Math.max(1, horde.participantIds.length);
  horde.projectiles = []; horde.hazards = [];
  horde.wave++; state.round = horde.wave; horde.waveKills = 0; horde.waveTicks = 0; horde.waveQueued = 0;
  horde.waveTypeCounts = {};
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
  const { wave, waveQueued = 0 } = state.horde;
  // Introduce each threat in a readable place within the wave. A seeded roll
  // fills the rest, so a new species cannot silently miss its debut for a run.
  const introductions = wave >= 8 ? ['weaver', 'sniper', 'hound', 'leaper', 'screecher', 'gunner', 'brute', 'bomber', 'spitter'] : wave >= 7 ? ['sniper', 'hound', 'leaper', 'screecher', 'gunner', 'brute', 'bomber', 'spitter']
    : wave >= 5 ? ['gunner', 'hound', 'leaper', 'screecher', 'brute', 'bomber', 'spitter']
      : wave >= 4 ? ['gunner', 'hound', 'leaper', 'brute', 'bomber']
        : wave === 3 ? ['brute', 'hound', 'leaper', 'bomber']
          : wave === 2 ? ['runner', 'hound'] : ['stalker', 'hound'];
  if (waveQueued < introductions.length) return introductions[waveQueued];
  const weights = [['stalker', wave === 1 ? .82 : .18], ['hound', wave === 1 ? .18 : .17]];
  if (wave >= 2) weights.push(['runner', .25]);
  if (wave >= 3) weights.push(['brute', .17], ['leaper', .12], ['bomber', .075]);
  if (wave >= 4) weights.push(['gunner', Math.min(.38, .15 + (wave - 4) * .035)]);
  if (wave >= 5) weights.push(['screecher', .075], ['spitter', .09]);
  if (wave >= 7) weights.push(['sniper', .14]);
  if (wave >= 8) weights.push(['weaver', .07]);
  const counts = state.horde.waveTypeCounts || {}, active = state.players.filter(player => player.monster && player.alive);
  const choices = weights.filter(([type]) => !(type === 'hound' && wave === 1 && (counts.hound || 0) >= 2)
    && !(['screecher', 'bomber', 'spitter', 'weaver'].includes(type) && active.filter(player => player.monsterType === type).length + state.spawnWarnings.filter(warning => warning.monsterType === type).length >= 2));
  let roll = random(state) * choices.reduce((sum, [, weight]) => sum + weight, 0);
  for (const [type, weight] of choices) { roll -= weight; if (roll < 0) return type; }
  return 'stalker';
}
function spawnPoint(state, type) {
  const humans = activeHumans(state), map = arenaFor(state), points = spawnPointsFor(map, type), warnings = state.spawnWarnings;
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
  return { id: player.id, lifeId: player.lifeId, targetId: null, path: [], nextPlanTick: state.tick + player.id % 12, nextSightTick: 0, visible: false, firstSeenTick: -1, attackTargetId: null, attackYaw: 0, attackPitch: 0, attackTicks: 0, attackReady: false, blastReady: false, recoverTicks: 0, staggerTicks: 0, staggerReadyTick: 0, gunTicks: 0, burstUntil: 0, burstStartShots: 0, burstShotLimit: 0, nextBurstTick: 0, lungeTicks: 0, lungeDamageReady: false, roarTicks: 0, nextRoarTick: state.tick + HORDE_RULES.emergenceTicks + 60, rallyUntilTick: 0, lastX: player.x, lastZ: player.z, lastMotionTick: state.tick, stuckTicks: 0, aimYaw: player.yaw, aimPitch: 0 };
}
function survivorMelee(state, attacker, target) {
  return humanSlot(state, attacker?.id) && attacker.human && attacker.connected && attacker.participating && target?.monster && target.team !== attacker.team;
}
function meleeDamageScale(state, attacker, target) {
  return survivorMelee(state, attacker, target) ? HORDE_MELEE_RULES.damageScales[state.horde.wave - 1] || 1 : 1;
}
function onMeleeHit(state, hit, attacker, target, profile) {
  if (!(hit.damage > 0) || !survivorMelee(state, attacker, target) || target.hp <= 0 || target.emergenceTicks > 0) return;
  const brain = state.horde.brains[target.id];
  if (!brain) return;
  const monster = MONSTER_TYPES[target.monsterType], staggerImmune = brain.recoverTicks > 0 || state.tick < brain.staggerReadyTick;
  // A blade can silence a support cast even inside ordinary stagger immunity.
  // Spending the full roar cooldown prevents this exception from refreshing
  // control over its ordinary claw attacks or extending another monster's buff.
  if (brain.roarTicks > 0) {
    brain.roarTicks = 0; target.roarTicks = 0; brain.nextRoarTick = Math.max(brain.nextRoarTick, state.tick + monster.roarCooldown);
    brain.recoverTicks = Math.max(brain.recoverTicks, 12); target.monsterState = 'recover'; target.vx *= .2; target.vz *= .2;
    emitCombatEvent(state, 'monsterRoar', { playerId: target.id, stage: 'interrupted', x: target.x, y: target.y, z: target.z });
  }
  if (staggerImmune) return;
  const wave = state.horde.wave, duration = HORDE_MELEE_RULES.staggerTicks[hit.weapon];
  if (!duration) return;
  const waveResistance = wave === 1 ? 1 : wave === 2 ? .9 : wave === 3 ? .7 : wave === 4 ? .45 : .35;
  const armorResistance = target.monsterType === 'brute' ? hit.weapon === 'axe' ? .8 : .45 : 1;
  // A completed chain earns a stronger brief flinch, but never bypasses an
  // enemy's shared immunity. Other survivors cannot repeatedly reset its cast.
  const finisher = profile?.comboFinisher === true;
  const comboResistance = finisher ? HORDE_MELEE_RULES.comboStaggerMultiplier : 1;
  const ticks = Math.max(6, Math.round(duration * comboResistance * waveResistance * armorResistance));
  const attackWindow = monster.gun ? monster.windup + Math.round(monster.rest * settingsFor(state).gunRest) + 24 : monster.windup + 24;
  brain.staggerTicks = ticks; brain.staggerReadyTick = state.tick + ticks + Math.max(HORDE_MELEE_RULES.staggerRecoveryTicks, attackWindow);
  // This contact cancels a readable commitment, not an impact already resolved
  // this tick. A follow-up hit during immunity still deals damage but cannot
  // cancel another windup; coordinated blades cannot stun-lock a brute.
  cancelMonsterRunes(state, target); brain.blastReady = false;
  brain.attackTicks = brain.gunTicks = brain.burstUntil = 0; brain.attackReady = false; brain.attackTargetId = null;
  brain.lungeTicks = 0; brain.lungeDamageReady = false; target.lungeTicks = 0;
  brain.recoverTicks = Math.max(brain.recoverTicks, 12); brain.nextBurstTick = Math.max(brain.nextBurstTick, state.tick + ticks + 12);
  target.attackTicks = target.aimWindupTicks = 0; target.aiming = false; target.aimTicks = 0; target.monsterState = 'stagger';
  // Slow the ordinary gait only. Shared combat applies its independent,
  // collision-swept blade impulse after this confirmed-contact hook.
  target.vx *= .2; target.vz *= .2;
  emitCombatEvent(state, 'monsterStagger', { playerId: attacker.id, attackerLifeId: attacker.lifeId || 0, targetId: target.id, targetLifeId: target.lifeId || 0, weapon: hit.weapon, comboStep: profile?.comboStep || 0, comboLength: profile?.comboLength || 0, comboFinisher: finisher, ticks, x: target.x, y: target.y, z: target.z });
}
function spawnMonster(state, warning) {
  const point = { x: warning.x, y: warning.y, z: warning.z }, map = arenaFor(state);
  const type = warning.monsterType, profile = MONSTER_TYPES[type], body = monsterBodyProfile({ monster: true, human: false, monsterType: type });
  if (!profile || !navigationCanOccupy(map, point, body ? { radius: body.radius, height: body.height } : undefined) || state.players.some(player => player.alive && Math.abs(player.y - point.y) < 1.8 && Math.hypot(player.x - point.x, player.z - point.z) < Math.max(1.05, player.radius + (body?.radius || WORLD.radius) + .05))) return false;
  let id = state.players.findIndex((player, index) => index >= state.capacity && !player.alive);
  if (id < 0) { if (state.players.length >= state.capacity + HORDE_RULES.maxMonsters) return false; id = state.players.length; }
  const horde = state.horde;
  if (horde.arsenalWave !== horde.wave) { horde.arsenalWave = horde.wave; horde.arsenalCounts = {}; }
  const ordinal = (horde.arsenalCounts[type] || 0) + 1;
  horde.arsenalCounts[type] = ordinal;
  // Keep the original introductory shooter readable, then vary later rifts.
  const introduction = ordinal === 1 && (type === 'gunner' && [4, 6].includes(horde.wave) || type === 'sniper' && horde.wave === 7);
  const seed = horde.seed ^ Math.imul(warning.id, 0x85ebca6b) ^ Math.imul(horde.sessionId, 0xc2b2ae35);
  const weapon = introduction ? type === 'gunner' && horde.wave >= 6 ? 'carbine' : profile.weapon : monsterWeaponFor(type, horde.wave, seed);
  const player = createCombatPlayer(id, 1, weapon), target = activeHumans(state)[0];
  const health = Math.round(profile.health * settingsFor(state).health * (1 + Math.min(2.8, (state.horde.wave - 1) * .12)));
  Object.assign(player, point, { yaw: target ? Math.atan2(target.x - point.x, -(target.z - point.z)) : 0, team: 1, monster: true, human: false, monsterType: type, lifeId: ++state.horde.monsterLifeId, hp: health, maxHp: health, potions: 0, grenades: 0, emergenceTicks: HORDE_RULES.emergenceTicks, monsterState: 'emerging', attackTicks: 0, attackDuration: profile.windup, aimWindupTicks: 0, reserve: WEAPONS[weapon].reserve * 8 });
  if (body) player.radius = body.radius;
  Object.assign(player, { lungeTicks: 0, lungeDuration: profile.lungeTicks || 0, lungeYaw: player.yaw, roarTicks: 0, roarDuration: profile.roarWindup || 0, monsterRallyTicks: 0 });
  player.inventory = [profile.unarmed ? null : createInventoryGun(weapon, player), null, null, null]; player.inventoryIndex = player.inventoryGunIndex = 0; refreshInventory(player);
  player.previousInput = emptyInput(player); state.players[id] = player; state.fighters = state.players;
  state.horde.brains[id] = newBrain(state, player);
  emitCombatEvent(state, 'monsterSpawn', { playerId: id, lifeId: player.lifeId, monsterType: type, weapon: profile.unarmed ? null : weapon, x: point.x, y: point.y, z: point.z });
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
  const type = monsterType(state), point = spawnPoint(state, type); if (!point) return;
  horde.pending--;
  horde.waveQueued++; horde.waveTypeCounts ||= {}; horde.waveTypeCounts[type] = (horde.waveTypeCounts[type] || 0) + 1;
  const warning = { id: ++horde.spawnId, ...point, monsterType: type, ticksLeft: HORDE_RULES.spawnWarningTicks, durationTicks: HORDE_RULES.spawnWarningTicks };
  state.spawnWarnings.push(warning); const { id: riftId, ...rift } = warning; emitCombatEvent(state, 'monsterRift', { ...rift, riftId });
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
function rallyRecipients(state, player, profile) {
  const origin = { x: player.x, y: player.y + eyeHeight(player), z: player.z };
  return state.players.filter(peer => peer.id !== player.id && peer.monster && peer.alive && peer.emergenceTicks <= 0
    && Math.hypot(peer.x - player.x, peer.y - player.y, peer.z - player.z) <= profile.rallyRange
    && navigationVisible(arenaFor(state), origin, { x: peer.x, y: peer.y + eyeHeight(peer), z: peer.z }));
}
function releaseRoar(state, player, brain, profile) {
  brain.nextRoarTick = state.tick + profile.roarCooldown; brain.recoverTicks = Math.max(brain.recoverTicks, 36);
  const targets = rallyRecipients(state, player, profile).filter(peer => (state.horde.brains[peer.id]?.rallyUntilTick || 0) <= state.tick);
  for (const peer of targets) {
    const allyBrain = state.horde.brains[peer.id];
    if (allyBrain) { allyBrain.rallyUntilTick = state.tick + Math.min(HORDE_RALLY_RULES.maxTicks, profile.rallyTicks); peer.monsterRallyTicks = Math.min(HORDE_RALLY_RULES.maxTicks, profile.rallyTicks); }
  }
  emitCombatEvent(state, 'monsterRoar', { playerId: player.id, stage: 'release', x: player.x, y: player.y, z: player.z });
  if (targets.length) emitCombatEvent(state, 'monsterRally', { playerId: player.id, targetIds: targets.map(peer => peer.id), ticks: profile.rallyTicks, radius: profile.rallyRange, x: player.x, y: player.y, z: player.z });
}
function lungeInput(state, player, brain, input, profile) {
  // Both direction and target were committed before the warning. Core movement
  // performs the same swept cover/body collisions used for human movement.
  input.yaw = brain.attackYaw; input.pitch = brain.attackPitch; input.up = true; input.walk = false;
  player.monsterState = 'leap'; player.lungeYaw = brain.attackYaw;
  player.lungeTicks = brain.lungeTicks; brain.lungeDamageReady = true;
  if (--brain.lungeTicks <= 0) brain.recoverTicks = profile.recovery;
  return input;
}
function specialMonsterInput(state, player, brain, input, profile, target, distance, desiredYaw) {
  if (brain.attackTicks > 0) {
    brain.attackTicks--; player.attackTicks = brain.attackTicks;
    player.monsterState = profile.special === 'bomber' ? 'bomberFuse' : profile.special === 'spitter' ? 'spitting' : 'weaving';
    if (!brain.attackTicks) {
      brain.recoverTicks = profile.recovery;
      if (profile.special === 'bomber') brain.blastReady = true;
      else if (profile.special === 'spitter') launchMonsterShard(state, player, brain.attackYaw, brain.attackPitch);
    }
    return input;
  }
  if (!brain.recoverTicks && brain.visible && distance <= profile.reach && Math.abs(wrap(player.yaw - desiredYaw)) < .3 && (profile.special === 'bomber' || state.tick - brain.firstSeenTick >= profile.reaction)) {
    if (profile.special === 'weaver' && !markMonsterRune(state, player, target, arenaFor(state))) return input;
    brain.attackTicks = profile.windup; brain.attackTargetId = target.id; brain.attackTargetLifeId = target.lifeId;
    brain.attackYaw = desiredYaw; brain.attackPitch = Math.atan2(target.y + playerHeight(target) * .5 - player.y - 1.1, distance);
    player.attackTicks = player.attackDuration = profile.windup;
    player.monsterState = profile.special === 'bomber' ? 'bomberFuse' : profile.special === 'spitter' ? 'spitting' : 'weaving';
    if (profile.special !== 'weaver') emitCombatEvent(state, profile.special === 'bomber' ? 'monsterFuse' : 'monsterSpit', { playerId: player.id, sourceId: player.id, sourceLifeId: player.lifeId, stage: 'windup', ticks: profile.windup, radius: profile.special === 'bomber' ? MONSTER_SPECIAL_RULES.blastRadius : undefined, x: player.x, y: player.y, z: player.z });
    return input;
  }
  if (profile.special !== 'bomber' && brain.visible && distance < 5) input.down = true;
  else steer(player, brain, input);
  return input;
}
function monsterInput(state, player, brain) {
  const input = emptyInput(player), profile = MONSTER_TYPES[player.monsterType];
  player.monsterRallyTicks = player.alive ? Math.max(0, Math.min(HORDE_RALLY_RULES.maxTicks, brain.rallyUntilTick - state.tick)) : 0;
  if (!player.alive) return input;
  if (player.emergenceTicks > 0) { player.emergenceTicks--; player.monsterState = 'emerging'; return input; }
  if (brain.staggerTicks > 0) { brain.staggerTicks--; player.monsterState = 'stagger'; return input; }
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
  const committed = brain.attackTicks > 0 || brain.gunTicks > 0 || brain.lungeTicks > 0 || brain.roarTicks > 0 || state.tick < brain.burstUntil;
  const yaw = committed ? brain.attackYaw : brain.visible ? desiredYaw : brain.path[0] ? Math.atan2(brain.path[0].x - player.x, -(brain.path[0].z - player.z)) : desiredYaw;
  const pitch = committed ? brain.attackPitch : desiredPitch;
  input.yaw = wrap(player.yaw + clamp(wrap(yaw - player.yaw), -5.2 / TICK_RATE, 5.2 / TICK_RATE));
  input.pitch = player.pitch + clamp(pitch - player.pitch, -4 / TICK_RATE, 4 / TICK_RATE);
  input.walk = profile.walk; player.monsterState = 'chase';
  player.lungeTicks = brain.lungeTicks; player.roarTicks = brain.roarTicks;
  if (brain.lungeTicks > 0) return lungeInput(state, player, brain, input, profile);
  if (brain.roarTicks > 0) {
    brain.roarTicks--; player.roarTicks = brain.roarTicks; player.monsterState = 'roar';
    if (!brain.roarTicks) { releaseRoar(state, player, brain, profile); player.monsterState = 'recover'; }
    return input;
  }
  if (brain.recoverTicks > 0) { brain.recoverTicks--; player.monsterState = 'recover'; if (brain.recoverTicks > 18) return input; }
  if (profile.special) return specialMonsterInput(state, player, brain, input, profile, target, distance, desiredYaw);
  if (profile.gun) {
    const weapon = WEAPONS[player.weapon];
    // Alternate-trigger sidearms use their left shot. ADS-burst rifles use hip
    // automatic fire so monster bursts remain bounded without cancelling a
    // player's committed three/four-round weapon mechanic.
    const aimed = weapon.adsSupported !== false && weapon.adsEnabled !== false && !weapon.alternateFire && !weapon.adsBurst;
    if (!player.ammo && !player.reloadTicks && player.reserve > 0) input.reload = !player.previousInput.reload;
    if (brain.gunTicks > 0) {
      brain.gunTicks--; player.monsterState = 'aiming'; player.aimWindupTicks = brain.gunTicks; input.aim = aimed;
      if (brain.gunTicks === 0) {
        const fire = resolveActiveFire(weapon, player, { ...input, aim: aimed });
        brain.burstStartShots = player.shots;
        brain.burstShotLimit = profile === MONSTER_TYPES.sniper ? 1 : fire.automatic ? state.horde.wave >= 6 ? 3 : 2 : fire.mode === 'burst' ? Math.min(3, fire.count) : 1;
        const interval = fire.mode === 'burst' ? fire.intervalTicks : weaponFireIntervalTicks(weapon, player, { ...input, aim: aimed });
        brain.burstUntil = state.tick + 2 + (brain.burstShotLimit - 1) * Math.ceil(interval) + (weapon.spinupTicks || 0);
        brain.nextBurstTick = brain.burstUntil + Math.round(profile.rest * settingsFor(state).gunRest);
      }
      return input;
    }
    if (brain.burstUntil && player.shots - brain.burstStartShots >= brain.burstShotLimit) {
      brain.burstUntil = 0;
      brain.nextBurstTick = Math.max(brain.nextBurstTick, state.tick + Math.round(profile.rest * settingsFor(state).gunRest));
    }
    if (state.tick < brain.burstUntil) {
      input.aim = aimed; player.monsterState = 'aiming';
      const hit = traceShot(state, player.id, { x: player.x, y: player.y + eyeHeight(player), z: player.z }, aimDirection(input.yaw, input.pitch), weapon.range, arenaFor(state));
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
    brain.attackTicks--; player.attackTicks = brain.attackTicks; player.monsterState = profile.lunge ? 'lungeWindup' : 'windup';
    if (!brain.attackTicks) {
      if (profile.lunge) {
        // A physical launch impulse gives the authored dash its full distance;
        // position is still advanced exclusively by the shared swept solver.
        player.vx = Math.sin(brain.attackYaw) * profile.lungeSpeed; player.vz = -Math.cos(brain.attackYaw) * profile.lungeSpeed;
        brain.lungeTicks = profile.lungeTicks; emitCombatEvent(state, 'monsterLunge', { playerId: player.id, targetId: brain.attackTargetId, ticks: profile.lungeTicks, yaw: brain.attackYaw, x: player.x, y: player.y, z: player.z }); return lungeInput(state, player, brain, input, profile);
      }
      brain.attackReady = true; brain.recoverTicks = profile.recovery;
    }
    return input;
  }
  if (profile.roar && !brain.recoverTicks && state.tick >= brain.nextRoarTick && brain.visible && distance <= 18 && rallyRecipients(state, player, profile).length) {
    brain.roarTicks = profile.roarWindup; brain.attackYaw = desiredYaw; brain.attackPitch = desiredPitch; brain.nextRoarTick = state.tick + profile.roarWindup + profile.roarCooldown;
    player.roarTicks = profile.roarWindup; player.monsterState = 'roar';
    emitCombatEvent(state, 'monsterRoar', { playerId: player.id, stage: 'windup', ticks: profile.roarWindup, x: player.x, y: player.y, z: player.z }); return input;
  }
  if (!brain.recoverTicks && brain.visible && distance <= (profile.lunge ? profile.lungeRange : profile.reach + target.radius) && Math.abs(target.y - player.y) < 1.25 && Math.abs(wrap(player.yaw - desiredYaw)) < .3) {
    const attackY = player.y + (monsterAttackHeight(player) ?? eyeHeight(player) * .76);
    brain.attackTicks = profile.windup; brain.attackTargetId = target.id; brain.attackYaw = desiredYaw; brain.attackPitch = Math.atan2(clamp(attackY, target.y + .18, target.y + playerHeight(target) - .16) - attackY, distance); player.attackTicks = profile.windup; player.monsterState = 'windup';
    if (profile.lunge) player.monsterState = 'lungeWindup';
    emitCombatEvent(state, profile.lunge ? 'monsterLungeWindup' : 'monsterWindup', { playerId: player.id, targetId: target.id, monsterType: player.monsterType, ticks: profile.windup, yaw: desiredYaw, x: player.x, y: player.y, z: player.z });
    return input;
  }
  steer(player, brain, input); return input;
}
function monsterDamage(state) {
  const hits = advanceMonsterSpecials(state, arenaFor(state), settingsFor(state).damage);
  for (const brain of state.horde.brains) {
    if (brain?.blastReady) { brain.blastReady = false; const source = state.players[brain.id]; if (source?.alive && source.monsterType === 'bomber') hits.push(...bomberDamage(state, source, arenaFor(state), settingsFor(state).damage)); }
    if (!brain?.attackReady && !brain?.lungeDamageReady) continue;
    const lunge = brain.lungeDamageReady; brain.lungeDamageReady = false;
    brain.attackReady = false;
    const player = state.players[brain.id], target = state.players[brain.attackTargetId], profile = MONSTER_TYPES[player?.monsterType];
    if (!player?.alive || !target?.alive || target.team === player.team || !target.connected || !target.participating || !profile || profile.gun) continue;
    const origin = { x: player.x, y: player.y + (monsterAttackHeight(player) ?? eyeHeight(player) * .76), z: player.z }, dx = target.x - origin.x, dz = target.z - origin.z, targetY = clamp(origin.y, target.y + .18, target.y + playerHeight(target) - .16), dy = targetY - origin.y, distance = Math.hypot(dx, dy, dz);
    const direction = aimDirection(brain.attackYaw, brain.attackPitch);
    let hit = false;
    if (distance > EPS && Math.hypot(Math.max(0, Math.hypot(dx, dz) - target.radius), dy) <= profile.reach && (dx * direction.x + dy * direction.y + dz * direction.z) / distance >= Math.cos(.65)) {
      const contact = traceShot(state, player.id, origin, { x: dx / distance, y: dy / distance, z: dz / distance }, distance + .01, arenaFor(state));
      hit = contact.playerId === target.id;
      if (hit) {
        hits.push({ playerId: player.id, targetId: target.id, damage: Math.round(profile.damage * settingsFor(state).damage), hitKind: 'body', headshot: false, attack: 'monster', weapon: player.monsterType, attackX: origin.x, attackY: origin.y, attackZ: origin.z, hitX: contact.x, hitY: contact.y, hitZ: contact.z });
        if (lunge) { brain.lungeTicks = 0; player.lungeTicks = 0; brain.recoverTicks = profile.recovery; player.monsterState = 'recover'; player.vx *= .15; player.vz *= .15; }
      }
    }
    if (!lunge || hit || brain.lungeTicks <= 0) emitCombatEvent(state, 'monsterAttack', { playerId: player.id, targetId: target.id, monsterType: player.monsterType, hit, x: player.x, y: player.y, z: player.z });
  }
  return hits;
}
function interactionClear(state, player, point) {
  const origin = { x: player.x, y: player.y + eyeHeight(player), z: player.z }, target = { x: point.x, y: point.y + .5, z: point.z };
  return navigationVisible(arenaFor(state), origin, target);
}
export function findNearbyLoot(state, id) {
  const player = state.players[id]; if (!humanSlot(state, id) || !player?.alive || !player.participating) return null;
  return state.loot.filter(drop => Math.hypot(drop.x - player.x, drop.z - player.z) <= HORDE_RULES.pickupRange && Math.abs(drop.y - player.y) < 1.5 && (drop.type === 'ammo' ? player.inventory.some(item => item?.kind === 'weapon' && item.reserve < WEAPONS[item.weapon].reserve * 2) : ['weapon', 'melee', 'heal', 'grenade'].includes(drop.kind) && inventoryCanTake(player,drop)) && interactionClear(state, player, drop)).sort((a, b) => Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z) || a.id - b.id)[0] || null;
}
export function findReviveTarget(state, id) {
  const player = state.players[id]; if (!humanSlot(state, id) || !player?.alive || !player.participating) return null;
  return state.horde.participantIds.map(peer => state.players[peer]).filter(peer => peer.id !== id && peer.connected && peer.participating && !peer.alive && peer.revivesThisWave < 1 && Math.hypot(peer.x - player.x, peer.z - player.z) <= 1.8 && Math.abs(peer.y - player.y) < 1.3 && interactionClear(state, player, peer)).sort((a, b) => a.id - b.id)[0] || null;
}
function pickup(state, player, drop) {
  if (drop.type !== 'ammo') return pickupCombatLoot(state, player, drop);
  {
    ensureInventory(player);
    for (const item of player.inventory) if (item?.kind === 'weapon') item.reserve = Math.min(WEAPONS[item.weapon].reserve * 2, item.reserve + Math.ceil(WEAPONS[item.weapon].magazine * 1.5));
    refreshInventory(player);
  }
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
    const quiet = player.grounded && Math.hypot(player.vx, player.vz) < .35 && !input.fire && !input.jump && !input.grenade && !input.heal && !input.swap && !INVENTORY_ACTIONS.some(key => input[key]) && !player.healTicks && !player.reloadTicks && !player.grenadeThrowTicks && player.lastHitTick !== state.tick;
    if (revive && quiet) {
      if (player.interaction !== `revive:${revive.id}`) { player.interaction = `revive:${revive.id}`; player.interactTicks = 0; }
      if (++player.interactTicks >= HORDE_RULES.reviveTicks) {
        const position = safeHumanPosition(state, revive, 1.8);
        if (!position) { player.interactTicks = HORDE_RULES.reviveTicks; continue; }
        const fresh = createCombatPlayer(revive.id, 1, revive.weapon);
        for (const key of ['x', 'y', 'z', 'yaw', 'pitch', 'kills', 'deaths', 'damageDealt', 'shots', 'connected', 'participating', 'lifeId', 'hordeMelee']) fresh[key] = revive[key];
        Object.assign(fresh, position, { team: 0, human: true, monster: false, hp: HORDE_RULES.reviveHealth, potions: 0, grenades: 0, revivesThisWave: revive.revivesThisWave + 1, lifeId: revive.lifeId + 1, triggerBlocked: true });
        fresh.inventory = revive.inventory.map(item => item ? { ...item } : null); fresh.inventoryIndex = revive.inventoryIndex; fresh.inventoryGunIndex = revive.inventoryGunIndex;
        // A revive preserves carried weapons but never replenishes utility charges.
        fresh.inventory = fresh.inventory.map(item => item?.kind === 'heal' || item?.kind === 'grenade' ? null : item);
        for (const item of fresh.inventory) if (item?.kind === 'weapon') item.reloadTicks = item.burstRemaining = item.spinTicks = 0;
        refreshInventory(fresh);
        fresh.previousInput = emptyInput(fresh); state.players[revive.id] = fresh;
        resetMeleeDefense(fresh, { blockAim: true });
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
function emitLootEvent(state, type, loot, extra = {}) {
  const { id: lootId, type: lootType, ...data } = loot;
  emitCombatEvent(state, type, { ...data, ...extra, lootId, lootType });
}
function dropLoot(state, event) {
  const horde = state.horde; horde.killsSinceHeal++;
  const monster = state.players[event.targetId];
  if (MONSTER_TYPES[monster?.monsterType]?.gun && random(state) < .35) {
    ensureInventory(monster); const item = createInventoryGun(monster.weapon, monster);
    // Corpses drop their real magazine/reserve and cooldown, never a fresh duplicate loadout.
    if (item) { item.reserve = Math.min(item.reserve, WEAPONS[item.weapon].reserve); item.reloadTicks = item.burstRemaining = item.spinTicks = 0; const weaponDrop = addInventoryLoot(state, monster, item); if (weaponDrop) emitLootEvent(state, 'hordeDrop', weaponDrop); }
  }
  const needsHeal = activeHumans(state).some(player => player.hp < 150), roll = random(state);
  let type = roll < (needsHeal ? .24 : .12) || horde.killsSinceHeal >= 5 ? 'potion' : roll < .72 ? 'ammo' : roll < .78 && !MONSTER_TYPES[monster?.monsterType]?.unarmed ? 'melee' : roll < .84 && MONSTER_TYPES[monster?.monsterType]?.gun ? 'grenade' : null;
  if (!type) return;
  if (type === 'melee') {
    const weapon = monster.monsterType === 'brute' ? 'axe' : monster.monsterType === 'runner' ? 'tonfas' : 'katana';
    const drop = addInventoryLoot(state, monster, createInventoryMelee(weapon));
    if (drop) emitLootEvent(state, 'hordeDrop', drop);
    return;
  }
  if (type === 'potion' || type === 'grenade') {
    const drop=addInventoryLoot(state,monster,{kind:type==='potion'?'heal':'grenade',amount:1});
    if(drop){drop.type=type;if(type==='potion')horde.killsSinceHeal=0;emitLootEvent(state, 'hordeDrop', drop);}
    return;
  }
  const drop = { id: ++horde.lootId, type, kind: 'ammo', x: event.x, y: event.y, z: event.z, amount: 1.5, spawnTick: state.tick, expiresTick: state.tick + HORDE_RULES.lootLifetimeTicks };
  if (state.loot.length >= HORDE_RULES.maxLoot) state.loot.splice(0, 1);
  state.loot.push(drop); emitLootEvent(state, 'hordeDrop', drop);
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
  state.horde.projectiles = []; state.horde.hazards = [];
  const horde = state.horde; horde.wavesCleared++; state.phase = 'intermission'; state.phaseTicks = HORDE_RULES.intermissionTicks; horde.phaseTicks = state.phaseTicks;
  state.grenades = []; state.bolts = []; state.spawnWarnings = [];
  for (const id of horde.participantIds) {
    const old = state.players[id];
    if (!old.alive) { const restored = humanPlayer(state, id, old), position = safeHumanPosition(state, restored); if (!position) continue; Object.assign(restored, position); restored.participating = true; restored.hp = 150; state.players[id] = restored; }
    else { old.hp = Math.min(old.maxHp, old.hp + 35); ensureInventory(old); old.reloadTicks = old.healTicks = old.meleeTicks = old.meleeCooldown = old.grenadeThrowTicks = old.burstRemaining = old.spinTicks = 0; old.healing = false; old.meleePhase = 'idle'; }
    const player = state.players[id]; player.knockbackX = player.knockbackZ = player.knockbackTicks = player.knockbackReadyTicks = player.hitStunTicks = player.hitStunReadyTicks = 0; player.meleeHitIds = []; player.meleeHitLives = []; player.meleeStartTick = 0; storeInventoryGun(player);
    resetSprint(player);
    resetMeleeDefense(player, { blockAim: true });
    for (const item of player.inventory) if (item?.kind === 'weapon') { const weapon = WEAPONS[item.weapon]; item.ammo = weapon.magazine; item.reserve = Math.min(weapon.reserve * 2, item.reserve + weapon.magazine * 2); item.reloadTicks = item.burstRemaining = item.spinTicks = 0; }
    refreshInventory(player); player.interaction = null; player.interactTicks = 0;
  }
  // Supplies are physical, optional pickups. A player who trades their blade
  // slot for another gun keeps that choice; never overwrite a living inventory.
  const supplier = activeHumans(state)[0];
  if (supplier) {
    const weapon = HORDE_MELEE_RULES.supplyWeapons[(horde.wave - 1) % HORDE_MELEE_RULES.supplyWeapons.length];
    const cache = addInventoryLoot(state, supplier, createInventoryMelee(weapon));
    if (cache) { cache.source = 'wave-clear'; emitLootEvent(state, 'hordeSupply', cache, { wave: horde.wave }); }
  }
  state.fighters = state.players; state.objective = 'Wave cleared. Regroup, collect the close-combat supply and choose your next loadout.';
  for (const id of horde.participantIds) horde.inputFences[id] = ACTIONS.filter(key => state.players[id].previousInput[key]);
  neutralize(state, { stop: false }); emitCombatEvent(state, 'hordeClear', { wave: horde.wave, seconds: horde.waveTicks / TICK_RATE });
}
function finish(state) {
  state.horde.projectiles = []; state.horde.hazards = [];
  state.phase = 'matchEnd'; state.phaseTicks = 0; state.horde.phaseTicks = 0; state.horde.result = 'lost'; state.winner = 1; state.roundWinner = 1; state.roundReason = 'The squad fell.';
  state.objective = 'The squad fell. Compare your waves survived, regroup and try another run.';
  for (const player of state.players) {player.knockbackX = player.knockbackZ = player.knockbackTicks = player.knockbackReadyTicks = player.hitStunTicks = player.hitStunReadyTicks = 0;resetSprint(player,{refill:false});resetMeleeDefense(player, { blockAim: true });}
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
      for (const key of ['fire', 'aim', 'grenade', 'heal', 'swap', 'reload']) input[key] = false;
      return input;
    });
    combatStep(state, inputs, arenaFor(state));
    humanInteractions(state, inputs, previous);
    advanceInventoryLoot(state, arenaFor(state));
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
  combatStep(state, inputs, arenaFor(state), { additionalDamage: monsterDamage, meleeDamageScale, onMeleeHit });
  recordCombat(state); humanInteractions(state, inputs, previous);
  advanceInventoryLoot(state, arenaFor(state));
  state.horde.alive = state.players.filter(player => player.monster && player.alive).length;
  if (!activeHumans(state).length) finish(state);
  else if (!state.horde.pending && !state.horde.alive && !state.spawnWarnings.length) beginIntermission(state);
  return state;
}
