/** Lockdown: a top-down team brawl over three control points (after Spiral Knights).
 * Deterministic 120 Hz simulation shared by the server and offline practice.
 * Up to 4v4; empty seats are filled by bots. Teams score every five seconds by
 * the points they hold; first to 500 (or the leader at the time limit) wins. */
import { MAPS, MAP_IDS, TILE, isWall, wallAt } from './lockdown-maps.js';
import { WEAPONS, WEAPON_IDS, DEFAULT_LOADOUTS, STATUS, STATUS_IDS, GUARD, BLADE } from './lockdown-weapons.js';

export { MAPS, MAP_IDS, TILE, WEAPONS, WEAPON_IDS, DEFAULT_LOADOUTS, STATUS, STATUS_IDS, GUARD, BLADE };
export const TICK_RATE = 120;
const DT = 1 / TICK_RATE;
export const TEAM_SIZE = 4;
export const CAPACITY = TEAM_SIZE * 2;
export const INPUT_KEYS = Object.freeze(['up', 'down', 'left', 'right', 'attack', 'guard', 'ability', 'ability2', 'slot1', 'slot2', 'slot3', 'swap']);
export const emptyInput = (aim = 0) => ({ ...Object.fromEntries(INPUT_KEYS.map(key => [key, false])), aim });

export const RULES = Object.freeze({
  countdownTicks: 3 * TICK_RATE, timeLimitTicks: 10 * 60 * TICK_RATE, scoreToWin: 500,
  scoreIntervalTicks: 5 * TICK_RATE, scoreTable: Object.freeze([0, 5, 8, 9]),
  pointRadius: 72, captureTicks: 5 * TICK_RATE,
  respawnBaseTicks: 5 * TICK_RATE, respawnPerMinuteTicks: TICK_RATE, respawnMaxTicks: 12 * TICK_RATE,
  spawnShieldTicks: 2 * TICK_RATE, radius: 15, eventLimit: 160,
  // Standing in your own base heals you, and is where you change class and weapons mid-match.
  baseHealPerSecond: 25,
  // Every knockout drops a heart that heals whoever grabs it first.
  heart: Object.freeze({ heal: 30, ttlTicks: 15 * TICK_RATE, radius: 24 }),
  // Personal score comes from the zones: taking a point, or knocking an enemy point back to neutral.
  captureScore: 30, neutralizeScore: 15,
});

/** Every knight carries a shield (see GUARD); each class adds a signature ability on top. */
export const CLASSES = Object.freeze({
  striker: Object.freeze({ id: 'striker', name: 'Striker', hp: 100, speed: 210, bladeDamage: 1.25, bladeSpeed: 1.2, ability: 'Boost', ability2: null, description: 'The sword specialist: swords hit 25% harder and swing 20% faster. Boost dodges a short distance untouchable, then runs fast for three seconds to close in.' }),
  guardian: Object.freeze({ id: 'guardian', name: 'Guardian', hp: 130, speed: 180, ability: 'Bubble', ability2: 'Heal Pulse', description: 'Holds the line. Raises a dome that soaks damage for allies inside, and pulses healing to nearby teammates.' }),
  recon: Object.freeze({ id: 'recon', name: 'Recon', hp: 90, speed: 195, ability: 'Cloak', ability2: null, description: 'Strikes from nowhere. Cloak turns you invisible; the first hit out of it marks the target to take extra damage.' }),
});
export const ABILITIES = Object.freeze({
  dash: { ticks: 3 * TICK_RATE, cooldown: 8 * TICK_RATE, speed: 1.5, dodgeTicks: 12, dodgeDistance: 150, evadeTicks: 22 },
  bubble: { ticks: 4 * TICK_RATE, cooldown: 14 * TICK_RATE, radius: 88, hp: 120 },
  heal: { cooldown: 16 * TICK_RATE, radius: 150, amount: 30 },
  cloak: { ticks: 4 * TICK_RATE, cooldown: 12 * TICK_RATE, markTicks: 5 * TICK_RATE, markBonus: .3, revealRange: 64 },
});

const CLASS_IDS = Object.keys(CLASSES);

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const wrapAngle = angle => Math.atan2(Math.sin(angle), Math.cos(angle));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function random(state) {
  // xorshift32 kept in state so bot choices replay exactly.
  let x = state.seed | 0 || 0x9e3779b9; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; state.seed = x >>> 0;
  return state.seed / 4294967296;
}
function emit(state, type, data = {}) {
  state.events.push({ id: ++state.eventId, tick: state.tick, type, ...data });
  if (state.events.length > RULES.eventLimit) state.events.splice(0, state.events.length - RULES.eventLimit);
}

function newPlayer(id) {
  const team = id < TEAM_SIZE ? 0 : 1, cls = CLASS_IDS[id % CLASS_IDS.length];
  return {
    id, team, name: `Bot ${id + 1}`, human: false, connected: false, bot: true, cls, weapons: [...DEFAULT_LOADOUTS[cls]], slot: 0,
    x: 0, y: 0, vx: 0, vy: 0, aim: team === 0 ? 0 : Math.PI, hp: CLASSES[cls].hp, maxHp: CLASSES[cls].hp, alive: false,
    respawnTicks: 0, shieldTicks: 0, stunTicks: 0, pushX: 0, pushY: 0,
    action: 'idle', actionTicks: 0, actionTotal: 0, comboStep: 0, comboWindow: 0, hitIds: [], chargeTicks: 0, charging: false,
    clips: {}, reloadTicks: {}, sinceShot: {}, fireCooldown: 0, burst: null, hitStop: 0, bufferAttack: false,
    swingAim: 0, swingDir: 1, swingReach: 0, swingArc: 0, swingStartup: 0, swingActive: 0, swingRecovery: 0, swingDamage: 0, chargeMoveTicks: 0,
    dodgeTicks: 0, dodgeX: 0, dodgeY: 0, evadeTicks: 0,
    guarding: false, guardRaise: 0, guardHp: GUARD.max, guardBroken: false, guardDelay: 0,
    status: Object.fromEntries(STATUS_IDS.map(key => [key, 0])), statusOwner: {}, freezeImmune: 0, catalysts: 0, catalystTicks: 0,
    dashTicks: 0, bubbleTicks: 0, bubbleHp: 0, cloakTicks: 0, markTicks: 0, markReady: false, abilityCooldown: 0, ability2Cooldown: 0,
    kills: 0, deaths: 0, captures: 0, damage: 0, score: 0, previousInput: emptyInput(team === 0 ? 0 : Math.PI),
  };
}

export function createState({ mapId = 'gate', seed = 1 } = {}) {
  if (!Object.hasOwn(MAPS, mapId)) throw new RangeError('Unknown Lockdown map.');
  const map = MAPS[mapId];
  return {
    gameId: 'lockdown', mapId, mapName: map.name, tick: 0, phase: 'lobby', phaseTicks: 0, seed: seed >>> 0 || 1,
    scores: [0, 0], winner: null, timeLeftTicks: RULES.timeLimitTicks, scoreTimer: RULES.scoreIntervalTicks,
    points: map.points.map(point => ({ id: point.id, x: point.x, y: point.y, progress: 0, owner: null })),
    players: Array.from({ length: CAPACITY }, (_, id) => newPlayer(id)),
    projectiles: [], bombs: [], clouds: [], pickups: [], events: [], eventId: 0, nextId: 1,
  };
}

/** True while a knight stands on their own team's base (spawn) tiles. */
export function inBase(state, player) {
  const map = MAPS[state.mapId];
  return map.grid[Math.floor(player.y / TILE)]?.[Math.floor(player.x / TILE)] === (player.team === 0 ? '1' : '2');
}

/** Lobby choices: team, class and three distinct weapons. During a match, class and
 * weapons can change only while you are in your base (or waiting to respawn). */
export function setPlayerSetup(state, id, { team, cls, weapons, name } = {}) {
  const player = state.players[id];
  if (!player) return { ok: false, error: 'Unknown player.' };
  const inMatch = state.phase === 'countdown' || state.phase === 'fight';
  if (inMatch && team !== undefined && team !== player.team) return { ok: false, error: 'Change teams in the lobby.' };
  if (inMatch && (cls !== undefined || weapons !== undefined) && player.alive && !inBase(state, player)) return { ok: false, error: 'Return to your base to change class or weapons.' };
  if (cls !== undefined && !Object.hasOwn(CLASSES, cls)) return { ok: false, error: 'Choose Striker, Guardian or Recon.' };
  if (weapons !== undefined && (!Array.isArray(weapons) || weapons.length !== 3 || weapons.some(weapon => !Object.hasOwn(WEAPONS, weapon)) || new Set(weapons).size !== 3)) return { ok: false, error: 'Choose three different weapons.' };
  if (team !== undefined && ![0, 1].includes(team)) return { ok: false, error: 'Choose a team.' };
  if (team !== undefined && team !== player.team && state.players.filter(other => other.human && other.team === team).length >= TEAM_SIZE) return { ok: false, error: 'That team is full.' };
  if (team !== undefined) player.team = team;
  if (inMatch && player.alive) {
    // Swapping in base keeps your health fraction and drops any action in progress.
    const fraction = player.hp / player.maxHp;
    if (cls !== undefined && cls !== player.cls) {
      player.cls = cls; player.maxHp = CLASSES[cls].hp; player.hp = Math.max(1, fraction * player.maxHp);
      player.dashTicks = player.bubbleTicks = player.cloakTicks = 0; player.markReady = false;
    }
    if (weapons !== undefined) {
      player.weapons = [...weapons];
      player.clips = Object.fromEntries(weapons.filter(weaponId => WEAPONS[weaponId].family === 'gun').map(weaponId => [weaponId, WEAPONS[weaponId].clip]));
      player.reloadTicks = {}; player.sinceShot = {};
    }
    Object.assign(player, { slot: 0, action: 'idle', actionTicks: 0, charging: false, chargeTicks: 0, comboStep: 0, burst: null, bufferAttack: false });
    emit(state, 'loadoutChange', { playerId: player.id, cls: player.cls, weapons: [...player.weapons] });
  } else {
    if (cls !== undefined) { player.cls = cls; player.maxHp = player.hp = CLASSES[cls].hp; }
    if (weapons !== undefined) player.weapons = [...weapons];
  }
  if (typeof name === 'string') player.name = name.slice(0, 24);
  return { ok: true };
}

export function setConnected(state, id, connected, name) {
  const player = state.players[id]; if (!player) return;
  const joining = connected === true && !player.human;
  player.connected = connected === true; player.human = player.connected; player.bot = !player.human;
  if (player.human && typeof name === 'string') player.name = name.slice(0, 24);
  // A person never lands on a team that already has four people.
  if (joining && state.players.filter(other => other !== player && other.human && other.team === player.team).length >= TEAM_SIZE) player.team = 1 - player.team;
  if (!player.human) player.name = `Bot ${id + 1}`;
}

/** Humans keep their seats; every other seat becomes a bot, balanced to four per team. */
export function startMatch(state, participantIds = []) {
  const humans = new Set(participantIds);
  for (const player of state.players) { player.human = humans.has(player.id); player.bot = !player.human; player.connected = player.human || player.connected && player.human; }
  for (const team of [0, 1]) {
    let count = state.players.filter(player => player.team === team).length;
    for (const bot of state.players.filter(player => player.bot)) {
      if (count <= TEAM_SIZE) break;
      if (bot.team === team) { bot.team = 1 - team; count--; }
    }
  }
  Object.assign(state, { phase: 'countdown', phaseTicks: RULES.countdownTicks, scores: [0, 0], winner: null, timeLeftTicks: RULES.timeLimitTicks, scoreTimer: RULES.scoreIntervalTicks, projectiles: [], bombs: [], clouds: [], pickups: [] });
  for (const point of state.points) { point.progress = 0; point.owner = null; }
  for (const player of state.players) {
    if (player.bot) { player.cls = CLASS_IDS[Math.floor(random(state) * CLASS_IDS.length)]; player.weapons = [...DEFAULT_LOADOUTS[player.cls]]; }
    Object.assign(player, { kills: 0, deaths: 0, captures: 0, damage: 0, score: 0 });
    spawn(state, player);
  }
  emit(state, 'matchStart', { mapId: state.mapId });
  return state;
}

export function resetLobby(state) {
  const keep = state.players.map(player => ({ team: player.team, cls: player.cls, weapons: player.weapons, name: player.name, human: player.human, connected: player.connected }));
  const fresh = createState({ mapId: state.mapId, seed: state.seed });
  Object.assign(state, fresh, { tick: state.tick, eventId: state.eventId });
  state.players.forEach((player, id) => Object.assign(player, keep[id], { bot: !keep[id].human, maxHp: CLASSES[keep[id].cls].hp, hp: CLASSES[keep[id].cls].hp }));
  return state;
}

export function selectMap(state, mapId) {
  if (!Object.hasOwn(MAPS, mapId)) return { ok: false, error: 'Unknown Lockdown map.' };
  if (state.phase !== 'lobby') return { ok: false, error: 'Change the map in the lobby.' };
  const map = MAPS[mapId];
  Object.assign(state, { mapId, mapName: map.name, points: map.points.map(point => ({ id: point.id, x: point.x, y: point.y, progress: 0, owner: null })) });
  return { ok: true };
}

function respawnDelay(state) {
  const minutes = Math.floor((RULES.timeLimitTicks - state.timeLeftTicks) / (60 * TICK_RATE));
  return Math.min(RULES.respawnMaxTicks, RULES.respawnBaseTicks + minutes * RULES.respawnPerMinuteTicks);
}
function spawn(state, player) {
  const map = MAPS[state.mapId], tiles = map.spawns[player.team];
  let spot = tiles[0];
  for (let tries = 0; tries < 12; tries++) {
    const candidate = tiles[Math.floor(random(state) * tiles.length)];
    if (!state.players.some(other => other !== player && other.alive && dist(other, candidate) < RULES.radius * 2.2)) { spot = candidate; break; }
  }
  const cls = CLASSES[player.cls];
  Object.assign(player, {
    x: spot.x, y: spot.y, vx: 0, vy: 0, alive: true, hp: cls.hp, maxHp: cls.hp, respawnTicks: 0, shieldTicks: RULES.spawnShieldTicks,
    stunTicks: 0, pushX: 0, pushY: 0, action: 'idle', actionTicks: 0, actionTotal: 0, comboStep: 0, comboWindow: 0, hitIds: [], chargeTicks: 0, charging: false,
    dashTicks: 0, bubbleTicks: 0, bubbleHp: 0, cloakTicks: 0, markTicks: 0, markReady: false, slot: 0, fireCooldown: 0,
    aim: player.team === 0 ? 0 : Math.PI, burst: null, hitStop: 0, bufferAttack: false, dodgeTicks: 0, evadeTicks: 0, guarding: false, guardRaise: 0, guardBroken: false, guardDelay: 0,
    guardHp: player.cls === 'guardian' ? GUARD.guardianMax : GUARD.max, freezeImmune: 0, catalysts: 0, catalystTicks: 0,
    status: Object.fromEntries(STATUS_IDS.map(key => [key, 0])), statusOwner: {},
  });
  player.clips = Object.fromEntries(player.weapons.filter(id => WEAPONS[id].family === 'gun').map(id => [id, WEAPONS[id].clip]));
  player.reloadTicks = {}; player.sinceShot = {};
}

// ---------- physics ----------
function collides(map, x, y, radius) {
  const minCol = Math.floor((x - radius) / TILE), maxCol = Math.floor((x + radius) / TILE), minRow = Math.floor((y - radius) / TILE), maxRow = Math.floor((y + radius) / TILE);
  for (let row = minRow; row <= maxRow; row++) for (let col = minCol; col <= maxCol; col++) {
    if (!isWall(map, col, row)) continue;
    const nx = clamp(x, col * TILE, (col + 1) * TILE), ny = clamp(y, row * TILE, (row + 1) * TILE);
    if ((x - nx) ** 2 + (y - ny) ** 2 < radius * radius) return true;
  }
  return false;
}
function moveBody(map, body, dx, dy) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 6));
  for (let step = 0; step < steps; step++) {
    if (!collides(map, body.x + dx / steps, body.y, RULES.radius)) body.x += dx / steps; else body.vx = 0;
    if (!collides(map, body.x, body.y + dy / steps, RULES.radius)) body.y += dy / steps; else body.vy = 0;
  }
}
/** Tile ray: true when the straight line between two points crosses no wall. */
export function lineOfSight(map, a, b) {
  const length = dist(a, b), steps = Math.ceil(length / (TILE / 3));
  for (let step = 1; step < steps; step++) if (wallAt(map, a.x + (b.x - a.x) * step / steps, a.y + (b.y - a.y) * step / steps)) return false;
  return true;
}

// ---------- damage, shields and statuses ----------
function inAlliedBubble(state, target) {
  return state.players.find(guard => guard.alive && guard.team === target.team && guard.bubbleTicks > 0 && dist(guard, target) <= ABILITIES.bubble.radius) || null;
}
const guardMax = player => player.cls === 'guardian' ? GUARD.guardianMax : GUARD.max;
const BLADE_KINDS = new Set(['blade', 'lunge', 'spin', 'slam', 'burst']);
/** Class sword bonuses (the Striker's): damage multiplier and swing speed. */
const bladePower = player => CLASSES[player.cls].bladeDamage || 1;
const bladeSpeed = player => CLASSES[player.cls].bladeSpeed || 1;
/** True while a committed action is only recovering, which a shield or a dodge may cancel. */
function inRecovery(player) {
  if (player.actionTicks === 0) return false;
  const elapsed = player.actionTotal - player.actionTicks;
  if (player.action === 'swing') return elapsed >= player.swingStartup + player.swingActive;
  return elapsed >= (player.chargeMoveTicks || 0);
}
/** The animation cancel: drop the rest of the recovery. A cancelled cut still advances the combo. */
function cancelRecovery(state, player, by) {
  if (player.action === 'swing') { const weapon = currentWeapon(player); player.comboStep = (player.comboStep + 1) % weapon.combo.length; player.comboWindow = BLADE.comboWindow; }
  player.action = 'idle'; player.actionTicks = 0; player.bufferAttack = false;
  emit(state, 'cancel', { playerId: player.id, by });
}
const guardUp = player => player.guarding && player.guardRaise >= GUARD.raiseTicks;
const canHeal = player => !(player.status.poison > 0);
function heal(player, amount) {
  if (!canHeal(player)) return 0;
  const gained = Math.min(amount, player.maxHp - player.hp); player.hp += gained; return gained;
}
/** Apply a status unless the shield is up; freeze leaves a short immunity behind. */
function applyStatus(state, target, id, ownerId, chance = 1) {
  if (!id || !target.alive || guardUp(target) || random(state) >= chance) return false;
  if (id === 'freeze' && target.freezeImmune > 0) return false;
  target.status[id] = STATUS[id].ticks; target.statusOwner[id] = ownerId;
  if (id === 'freeze') { target.charging = false; target.chargeTicks = 0; target.guarding = false; target.action = 'idle'; target.actionTicks = 0; }
  emit(state, 'status', { playerId: target.id, status: id, x: target.x, y: target.y });
  return true;
}
function knockOut(state, attacker, target) {
  target.alive = false; target.hp = 0; target.deaths++; target.respawnTicks = respawnDelay(state);
  target.bubbleTicks = target.cloakTicks = target.dashTicks = 0; target.guarding = false; target.catalysts = 0;
  for (const id of STATUS_IDS) target.status[id] = 0;
  state.pickups.push({ id: state.nextId++, kind: 'heart', x: target.x, y: target.y, ttl: RULES.heart.ttlTicks });
  emit(state, 'heartDrop', { x: target.x, y: target.y });
  if (attacker && attacker.team !== target.team) attacker.kills++;
  emit(state, 'kill', { playerId: attacker?.id ?? null, targetId: target.id, x: target.x, y: target.y, respawnTicks: target.respawnTicks });
}
/** Every hit goes through here: spawn protection, domes, shields, poison, marks, statuses, knockback. */
function damage(state, attacker, target, amount, { push = 0, angle = 0, stun = 10, kind = 'hit', source = null, status = null, chance = 1, hitStop = 0 } = {}) {
  if (!target.alive || target.team === attacker?.team || target.shieldTicks > 0) return false;
  // A Striker mid-dodge is untouchable.
  if (target.evadeTicks > 0) { emit(state, 'evade', { playerId: target.id, x: target.x, y: target.y }); return false; }
  // A Guardian dome soaks hits that come from outside it.
  const dome = inAlliedBubble(state, target), origin = source || attacker;
  if (dome && origin && dist(dome, origin) > ABILITIES.bubble.radius) {
    dome.bubbleHp -= amount;
    emit(state, 'bubbleHit', { playerId: dome.id, x: target.x, y: target.y, hp: Math.max(0, dome.bubbleHp) });
    if (dome.bubbleHp <= 0) { dome.bubbleTicks = 0; emit(state, 'bubblePop', { playerId: dome.id, x: dome.x, y: dome.y }); }
    return false;
  }
  // A raised shield takes the hit (bombs hit it harder) and only a little knockback gets through.
  if (guardUp(target)) {
    // Swords chew through shields; bombs hit them hardest.
    target.guardHp -= amount * (kind === 'bomb' ? GUARD.bombScale : BLADE_KINDS.has(kind) ? GUARD.bladeScale : 1); target.guardDelay = GUARD.regenDelay;
    target.pushX = Math.cos(angle) * push * GUARD.knockback; target.pushY = Math.sin(angle) * push * GUARD.knockback;
    if (attacker && hitStop) attacker.hitStop = Math.max(attacker.hitStop, hitStop);
    emit(state, 'block', { playerId: target.id, attackerId: attacker?.id ?? null, x: target.x, y: target.y, hp: Math.max(0, target.guardHp) });
    if (target.guardHp <= 0) {
      Object.assign(target, { guardHp: 0, guarding: false, guardRaise: 0, guardBroken: true, stunTicks: GUARD.breakStun });
      emit(state, 'guardBreak', { playerId: target.id, x: target.x, y: target.y });
    }
    return false;
  }
  let total = amount * (attacker?.status.poison > 0 ? STATUS.poison.damageScale : 1) * (target.markTicks > 0 ? 1 + ABILITIES.cloak.markBonus : 1);
  if (attacker && attacker.markReady && attacker.cls === 'recon') { target.markTicks = ABILITIES.cloak.markTicks; attacker.markReady = false; emit(state, 'mark', { playerId: attacker.id, targetId: target.id, x: target.x, y: target.y }); }
  total = Math.max(1, Math.round(total));
  target.hp -= total; target.stunTicks = Math.max(target.stunTicks, stun);
  target.pushX = Math.cos(angle) * push; target.pushY = Math.sin(angle) * push;
  if (target.status.freeze > 0) { target.status.freeze = 0; target.freezeImmune = STATUS.freeze.immuneTicks; emit(state, 'thaw', { playerId: target.id }); }
  if (target.cloakTicks > 0) { target.cloakTicks = 0; emit(state, 'uncloak', { playerId: target.id }); }
  if (target.charging) { target.charging = false; target.chargeTicks = 0; }
  if (hitStop) { target.hitStop = Math.max(target.hitStop, hitStop); if (attacker) attacker.hitStop = Math.max(attacker.hitStop, hitStop); }
  if (attacker) attacker.damage += total;
  emit(state, 'damage', { playerId: attacker?.id ?? null, targetId: target.id, amount: total, kind, x: target.x, y: target.y, hp: Math.max(0, target.hp) });
  if (target.hp <= 0) { knockOut(state, attacker, target); return true; }
  if (status) applyStatus(state, target, status, attacker?.id ?? null, chance);
  return true;
}
function breakCloak(state, player) {
  if (player.cloakTicks > 0) { player.cloakTicks = 0; player.markReady = true; emit(state, 'uncloak', { playerId: player.id }); }
}
function tickStatus(state, player) {
  const status = player.status;
  player.freezeImmune = Math.max(0, player.freezeImmune - 1);
  for (const id of STATUS_IDS) {
    if (!(status[id] > 0)) continue;
    const owner = state.players[player.statusOwner[id]] || null, elapsed = STATUS[id].ticks - status[id];
    if (id === 'burn' && elapsed > 0 && elapsed % STATUS.burn.every === 0) damage(state, owner, player, STATUS.burn.damage, { stun: 0, kind: 'burn' });
    if (id === 'shock' && elapsed > 0 && elapsed % STATUS.shock.every === 0) damage(state, owner, player, STATUS.shock.damage, { stun: STATUS.shock.stun, kind: 'shock' });
    if (!player.alive) return;
    if (--status[id] === 0) { if (id === 'freeze') player.freezeImmune = STATUS.freeze.immuneTicks; emit(state, 'statusEnd', { playerId: player.id, status: id }); }
  }
}
function tickGuard(state, player, input) {
  const max = guardMax(player);
  if (player.guardBroken && player.guardHp >= max * GUARD.recover) player.guardBroken = false;
  // Shield cancel: raising the shield cuts a sword's recovery short.
  if (input.guard && !player.guarding && !player.guardBroken && inRecovery(player)) cancelRecovery(state, player, 'guard');
  const wants = input.guard && !player.guardBroken && player.stunTicks === 0 && !(player.status.freeze > 0) && player.actionTicks === 0;
  if (wants && !player.guarding) { player.guarding = true; player.guardRaise = 0; player.charging = false; player.chargeTicks = 0; player.bufferAttack = false; }
  if (!wants) player.guarding = false;
  if (player.guarding) { player.guardRaise++; player.guardDelay = GUARD.regenDelay; }
  else if (player.guardDelay > 0) player.guardDelay--;
  else player.guardHp = Math.min(max, player.guardHp + GUARD.regenPerSecond / TICK_RATE);
}

// ---------- weapons ----------
function currentWeapon(player) { return WEAPONS[player.weapons[player.slot]]; }
const targetsOf = (state, player) => state.players.filter(target => target.alive && target.team !== player.team);
/** Blade contact: anyone in reach whose bearing lies inside [from, to] of the swept arc (plus their body width). */
function bladeContacts(state, player, reach, from, to, amount, options) {
  const map = MAPS[state.mapId], low = Math.min(from, to), high = Math.max(from, to);
  for (const target of targetsOf(state, player)) {
    if (player.hitIds.includes(target.id)) continue;
    const d = dist(player, target); if (d > reach + RULES.radius) continue;
    const pad = Math.atan2(RULES.radius, Math.max(1, d)), bearing = player.swingAim + wrapAngle(Math.atan2(target.y - player.y, target.x - player.x) - player.swingAim);
    if (high - low < Math.PI * 2 - 1e-6 && (bearing < low - pad || bearing > high + pad)) continue;
    if (!lineOfSight(map, player, target)) continue;
    player.hitIds.push(target.id);
    damage(state, player, target, amount, { angle: Math.atan2(target.y - player.y, target.x - player.x), ...options });
  }
}
function radialHit(state, owner, team, center, radius, amount, options = {}) {
  const map = MAPS[state.mapId];
  for (const target of state.players) {
    if (!target.alive || target.team === team || dist(target, center) > radius + RULES.radius || !lineOfSight(map, center, target)) continue;
    damage(state, owner, target, amount, { angle: Math.atan2(target.y - center.y, target.x - center.x), source: center, ...options });
  }
}
function spawnShot(state, player, weapon, spec, angle) {
  const speed = spec.speed, size = spec.size || 5;
  state.projectiles.push({
    id: state.nextId++, ownerId: player.id, team: player.team, weapon: weapon.id, kind: spec.kind || weapon.kind || 'bullet',
    x: player.x + Math.cos(angle) * (RULES.radius + 4), y: player.y + Math.sin(angle) * (RULES.radius + 4),
    vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, size, grow: (spec.grow || 0) / Math.max(1, Math.ceil(spec.range / speed * TICK_RATE)),
    damage: spec.damage, push: spec.push ?? 0, ttl: Math.ceil(spec.range / speed * TICK_RATE), pierce: !!spec.pierce, bounces: spec.bounces || 0,
    status: spec.status || null, chance: spec.chance ?? 1, radius: spec.radius || 0, carry: spec.kind === 'wave', hitIds: [],
    perCharge: spec.perCharge || 0, pushPerCharge: spec.pushPerCharge || 0,
  });
}
function fireVolley(state, player, weapon, spec, count = 1, spread = spec.spread ?? weapon.spread ?? 0, charged = false) {
  for (let i = 0; i < count; i++) {
    const offset = count > 1 ? (i / (count - 1) - .5) * spread : (random(state) - .5) * spread * 2;
    spawnShot(state, player, weapon, spec, player.aim + offset);
  }
  emit(state, 'shot', { playerId: player.id, weapon: weapon.id, charged, x: player.x, y: player.y, angle: player.aim });
}
function plantBomb(state, player, weapon) {
  state.bombs.push({ id: state.nextId++, ownerId: player.id, team: player.team, weapon: weapon.id, x: player.x, y: player.y, fuse: weapon.fuse, total: weapon.fuse, phase: 'fuse', pullTicks: 0 });
  emit(state, 'bombPlant', { playerId: player.id, weapon: weapon.id, x: player.x, y: player.y });
}
function explode(state, bomb) {
  const weapon = WEAPONS[bomb.weapon], owner = state.players[bomb.ownerId];
  emit(state, 'explosion', { playerId: bomb.ownerId, weapon: bomb.weapon, x: bomb.x, y: bomb.y, radius: weapon.cloud ? weapon.cloud.radius : weapon.radius });
  if (weapon.cloud) { state.clouds.push({ id: state.nextId++, ownerId: bomb.ownerId, team: bomb.team, weapon: weapon.id, x: bomb.x, y: bomb.y, radius: weapon.cloud.radius, ticks: weapon.cloud.ticks, total: weapon.cloud.ticks, status: weapon.cloud.status }); return; }
  if (weapon.radius) radialHit(state, owner, bomb.team, bomb, weapon.radius, weapon.damage, { push: weapon.push, stun: weapon.stun ?? 20, kind: 'bomb' });
  if (weapon.shards) {
    const shards = weapon.shards;
    for (let i = 0; i < shards.count; i++) {
      const angle = i / shards.count * Math.PI * 2;
      state.projectiles.push({ id: state.nextId++, ownerId: bomb.ownerId, team: bomb.team, weapon: bomb.weapon, kind: 'shard', x: bomb.x, y: bomb.y, vx: Math.cos(angle) * shards.speed, vy: Math.sin(angle) * shards.speed,
        size: shards.size, grow: 0, damage: shards.damage, push: shards.push, ttl: Math.ceil(shards.range / shards.speed * TICK_RATE), pierce: false, bounces: 0, status: null, chance: 1, radius: 0, carry: false, hitIds: [], perCharge: 0, pushPerCharge: 0 });
    }
  }
}

/** Start a blade combo step: lock the swing direction, alternate sides, step forward. */
function startSwing(state, player, weapon) {
  const move = weapon.combo[player.comboStep];
  breakCloak(state, player);
  const speed = bladeSpeed(player), startup = Math.max(2, Math.round(move.startup / speed)), active = Math.max(2, Math.round(move.active / speed)), recovery = Math.max(2, Math.round(move.recovery / speed));
  Object.assign(player, { action: 'swing', actionTotal: startup + active + recovery, actionTicks: startup + active + recovery, hitIds: [], bufferAttack: false,
    swingAim: player.aim, swingDir: player.comboStep % 2 ? -1 : 1, swingReach: move.reach, swingArc: move.arc,
    swingStartup: startup, swingActive: active, swingRecovery: recovery, swingDamage: move.damage * bladePower(player) });
  emit(state, 'swing', { playerId: player.id, weapon: weapon.id, step: player.comboStep, x: player.x, y: player.y, angle: player.aim, dir: player.swingDir, arc: move.arc, reach: move.reach, startup, active });
}
function startCharge(state, player, weapon) {
  const charge = weapon.charge;
  breakCloak(state, player); player.hitIds = []; player.swingAim = player.aim; player.bufferAttack = false;
  emit(state, 'chargeRelease', { playerId: player.id, weapon: weapon.id, kind: weapon.family === 'bomb' ? 'bomb' : charge.kind, x: player.x, y: player.y, angle: player.aim });
  if (weapon.family === 'bomb') { plantBomb(state, player, weapon); return; }
  if (weapon.family === 'gun') {
    if (charge.kind === 'stream') player.burst = { weapon: weapon.id, remaining: charge.count, timer: 0 };
    else if (charge.kind === 'split') fireVolley(state, player, weapon, charge, charge.count, charge.spread, true);
    else fireVolley(state, player, weapon, charge, 1, 0, true);
    player.clips[weapon.id] = weapon.clip; player.reloadTicks[weapon.id] = 0; player.fireCooldown = weapon.interval * 2; player.sinceShot[weapon.id] = 0;
    return;
  }
  const kind = charge.kind;
  if (kind === 'thorns') { fireVolley(state, player, weapon, { ...charge, kind: 'thorn', damage: charge.damage * bladePower(player) }, charge.count, charge.spread, true); Object.assign(player, { action: 'cast', actionTicks: charge.recovery, actionTotal: charge.recovery }); return; }
  if (kind === 'wave') { spawnShot(state, player, weapon, { ...charge, damage: charge.damage * bladePower(player) }, player.aim); emit(state, 'shot', { playerId: player.id, weapon: weapon.id, charged: true, x: player.x, y: player.y, angle: player.aim }); Object.assign(player, { action: 'cast', actionTicks: charge.recovery, actionTotal: charge.recovery }); return; }
  const ticks = kind === 'spin' ? charge.turns * charge.ticksPerTurn : charge.ticks;
  Object.assign(player, { action: kind, actionTicks: ticks + charge.recovery, actionTotal: ticks + charge.recovery, chargeMoveTicks: ticks });
}
/** One tick of a committed action. Returns nothing; ends the action when its timer runs out. */
function tickAction(state, player, weapon) {
  const map = MAPS[state.mapId], elapsed = player.actionTotal - player.actionTicks;
  if (player.action === 'swing') {
    const move = weapon.combo[player.comboStep], startup = player.swingStartup, active = player.swingActive;
    if (elapsed < startup) moveBody(map, player, Math.cos(player.swingAim) * move.lunge / startup, Math.sin(player.swingAim) * move.lunge / startup);
    else if (elapsed < startup + active) {
      // The blade sweeps from one side of the arc to the other across the active ticks.
      const start = player.swingAim - player.swingDir * move.arc / 2, progress = (elapsed - startup + 1) / active;
      bladeContacts(state, player, move.reach, start, start + player.swingDir * move.arc * progress, player.swingDamage, { push: move.push, stun: move.stun, kind: 'blade', hitStop: BLADE.hitStop });
    } else if (player.bufferAttack && player.comboStep < weapon.combo.length - 1 && elapsed >= startup + active + Math.ceil(player.swingRecovery * BLADE.comboCancel)) {
      // Combo cancel: a queued press cuts the recovery short and goes straight into the next cut.
      player.comboStep++; player.action = 'idle'; player.actionTicks = 0; startSwing(state, player, weapon);
      return;
    }
  } else if (player.action === 'lunge' || player.action === 'lungeBurst') {
    const charge = weapon.charge;
    if (elapsed < player.chargeMoveTicks) {
      moveBody(map, player, Math.cos(player.swingAim) * charge.distance / charge.ticks, Math.sin(player.swingAim) * charge.distance / charge.ticks);
      bladeContacts(state, player, charge.reach, player.swingAim - charge.arc / 2, player.swingAim + charge.arc / 2, charge.damage * bladePower(player), { push: charge.push, stun: charge.stun, kind: 'lunge', hitStop: 3 });
    }
    if (elapsed === player.chargeMoveTicks - 1 && charge.burst) {
      const center = { x: player.x + Math.cos(player.swingAim) * 24, y: player.y + Math.sin(player.swingAim) * 24 };
      emit(state, 'explosion', { playerId: player.id, weapon: weapon.id, x: center.x, y: center.y, radius: charge.burst.radius, burst: true });
      radialHit(state, player, player.team, center, charge.burst.radius, charge.burst.damage * bladePower(player), { push: charge.burst.push, stun: 18, kind: 'burst', status: charge.burst.status, chance: charge.burst.chance });
    }
  } else if (player.action === 'slam') {
    const charge = weapon.charge;
    if (elapsed < player.chargeMoveTicks - 8) moveBody(map, player, Math.cos(player.swingAim) * charge.distance / (player.chargeMoveTicks - 8), Math.sin(player.swingAim) * charge.distance / (player.chargeMoveTicks - 8));
    if (elapsed === player.chargeMoveTicks - 1) {
      const center = { x: player.x + Math.cos(player.swingAim) * charge.offset, y: player.y + Math.sin(player.swingAim) * charge.offset };
      emit(state, 'slam', { playerId: player.id, weapon: weapon.id, x: center.x, y: center.y, radius: charge.radius });
      radialHit(state, player, player.team, center, charge.radius, charge.damage * bladePower(player), { push: charge.push, stun: charge.stun, kind: 'slam', hitStop: 5 });
    }
  } else if (player.action === 'spin') {
    const charge = weapon.charge;
    if (elapsed < player.chargeMoveTicks) {
      const turn = Math.floor(elapsed / charge.ticksPerTurn), within = elapsed % charge.ticksPerTurn;
      if (within === 0) { player.hitIds = []; emit(state, 'spinTurn', { playerId: player.id, x: player.x, y: player.y, reach: charge.reach, turn }); }
      const from = player.swingAim + within / charge.ticksPerTurn * Math.PI * 2, to = player.swingAim + (within + 1) / charge.ticksPerTurn * Math.PI * 2;
      bladeContacts(state, player, charge.reach, from, to, charge.damage * bladePower(player), { push: charge.push, stun: charge.stun, kind: 'spin', hitStop: 2 });
    }
  }
  if (--player.actionTicks === 0) {
    const wasSwing = player.action === 'swing';
    player.action = 'idle';
    if (wasSwing) {
      player.comboStep = (player.comboStep + 1) % weapon.combo.length; player.comboWindow = BLADE.comboWindow;
      if (player.bufferAttack) startSwing(state, player, weapon); // a queued press chains straight into the next cut
    }
  }
}

function tickWeapon(state, player, input, previous) {
  const weapon = currentWeapon(player), pressed = input.attack && !previous.attack, released = !input.attack && previous.attack;
  player.fireCooldown = Math.max(0, player.fireCooldown - 1);
  // Guns reload on their own: after a short pause or when empty, even holstered.
  for (const id of Object.keys(player.clips)) {
    const gun = WEAPONS[id]; player.sinceShot[id] = (player.sinceShot[id] || 0) + 1;
    if (player.reloadTicks[id] > 0) { if (--player.reloadTicks[id] === 0) { player.clips[id] = gun.clip; emit(state, 'reloaded', { playerId: player.id, weapon: id }); } }
    else if (player.clips[id] < gun.clip && (player.clips[id] === 0 || player.sinceShot[id] >= gun.reloadDelay)) player.reloadTicks[id] = gun.reload;
  }
  if (player.burst) {
    const gun = WEAPONS[player.burst.weapon];
    if (player.burst.timer-- <= 0) { fireVolley(state, player, gun, gun.charge, 1, gun.charge.spread, true); player.burst.timer = gun.charge.every; if (--player.burst.remaining <= 0) player.burst = null; }
  }
  if (player.comboWindow > 0 && --player.comboWindow === 0) player.comboStep = 0;
  if (player.actionTicks > 0) {
    // Pressing during a swing (once the blade is out) queues the next cut.
    if (pressed && player.action === 'swing' && player.actionTotal - player.actionTicks >= player.swingStartup) player.bufferAttack = true;
    tickAction(state, player, weapon);
    return;
  }
  if (player.guarding || player.burst) return;
  // Holding the button charges; a full charge releases the special on let-go.
  if (input.attack && (player.charging || !pressed && weapon.family !== 'bomb')) { if (!player.charging) { player.charging = true; player.chargeTicks = 0; } player.chargeTicks++; }
  if (weapon.family === 'bomb' && pressed) { player.charging = true; player.chargeTicks = 0; }
  if (released && player.charging) {
    const full = player.chargeTicks >= weapon.chargeTicks;
    player.charging = false; player.chargeTicks = 0;
    if (full) startCharge(state, player, weapon);
    return;
  }
  if (!pressed || weapon.family === 'bomb') return;
  if (weapon.family === 'blade') { startSwing(state, player, weapon); return; }
  if (player.fireCooldown > 0) return;
  if (!(player.clips[weapon.id] > 0)) { if (!(player.reloadTicks[weapon.id] > 0)) player.reloadTicks[weapon.id] = weapon.reload; emit(state, 'dryFire', { playerId: player.id, weapon: weapon.id }); return; }
  breakCloak(state, player);
  player.clips[weapon.id]--; player.fireCooldown = weapon.interval; player.reloadTicks[weapon.id] = 0; player.sinceShot[weapon.id] = 0;
  fireVolley(state, player, weapon, weapon);
}

function tickAbilities(state, player, input, previous) {
  player.abilityCooldown = Math.max(0, player.abilityCooldown - 1); player.ability2Cooldown = Math.max(0, player.ability2Cooldown - 1);
  player.dashTicks = Math.max(0, player.dashTicks - 1); player.markTicks = Math.max(0, player.markTicks - 1);
  if (player.bubbleTicks > 0 && --player.bubbleTicks === 0) emit(state, 'bubbleEnd', { playerId: player.id });
  if (player.cloakTicks > 0 && --player.cloakTicks === 0) { player.markReady = true; emit(state, 'uncloak', { playerId: player.id }); }
  if (input.ability && !previous.ability && player.abilityCooldown === 0) {
    if (player.cls === 'striker' && (player.actionTicks === 0 || inRecovery(player))) {
      // Boost: a short untouchable dodge the way you are moving (or aiming), then three seconds of speed.
      if (inRecovery(player)) cancelRecovery(state, player, 'dodge');
      let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0), dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
      if (!dx && !dy) { dx = Math.cos(player.aim); dy = Math.sin(player.aim); }
      const length = Math.hypot(dx, dy);
      Object.assign(player, { dodgeX: dx / length, dodgeY: dy / length, dodgeTicks: ABILITIES.dash.dodgeTicks, evadeTicks: ABILITIES.dash.evadeTicks, dashTicks: ABILITIES.dash.ticks, abilityCooldown: ABILITIES.dash.cooldown, charging: false, chargeTicks: 0 });
      emit(state, 'dash', { playerId: player.id, x: player.x, y: player.y, angle: Math.atan2(player.dodgeY, player.dodgeX) });
    }
    if (player.cls === 'guardian') { player.bubbleTicks = ABILITIES.bubble.ticks; player.bubbleHp = ABILITIES.bubble.hp; player.abilityCooldown = ABILITIES.bubble.cooldown; emit(state, 'bubble', { playerId: player.id, x: player.x, y: player.y, radius: ABILITIES.bubble.radius }); }
    if (player.cls === 'recon') { player.cloakTicks = ABILITIES.cloak.ticks; player.abilityCooldown = ABILITIES.cloak.cooldown; player.markReady = false; emit(state, 'cloak', { playerId: player.id, x: player.x, y: player.y }); }
  }
  if (input.ability2 && !previous.ability2 && player.ability2Cooldown === 0 && player.cls === 'guardian') {
    player.ability2Cooldown = ABILITIES.heal.cooldown;
    const healed = [];
    for (const ally of state.players) if (ally.alive && ally.team === player.team && dist(ally, player) <= ABILITIES.heal.radius && heal(ally, ABILITIES.heal.amount) > 0) healed.push(ally.id);
    emit(state, 'heal', { playerId: player.id, x: player.x, y: player.y, radius: ABILITIES.heal.radius, healed });
  }
}

/** How fast a knight may walk right now, as a fraction of their class speed. */
function moveScale(player, weapon) {
  if (player.status.freeze > 0 || ['lunge', 'lungeBurst', 'slam'].includes(player.action)) return 0;
  if (player.stunTicks > 0) return .25;
  if (player.held > 0) return .15;
  if (player.action === 'swing') return .5;
  if (player.action === 'cast') return .3;
  if (player.action === 'spin') return weapon.charge.speed;
  if (player.guarding) return GUARD.speed;
  if (player.charging) return weapon.family === 'bomb' ? .55 : .7;
  if (player.fireCooldown > 0 && weapon.family === 'gun') return .45;
  return 1;
}

function tickPlayer(state, player, input) {
  if (player.alive && state.phase === 'fight' && player.hp < player.maxHp && inBase(state, player) && canHeal(player)) player.hp = Math.min(player.maxHp, player.hp + RULES.baseHealPerSecond / TICK_RATE);
  const previous = player.previousInput || emptyInput(), map = MAPS[state.mapId];
  if (!player.alive) {
    if (state.phase === 'fight' && --player.respawnTicks <= 0) { spawn(state, player); emit(state, 'respawn', { playerId: player.id, x: player.x, y: player.y }); }
    player.previousInput = input; return;
  }
  const frozen = player.status.freeze > 0;
  // Committed swings and lunges keep their direction; otherwise you face the pointer.
  if (!frozen) player.aim = wrapAngle(finite(input.aim, player.aim));
  player.shieldTicks = Math.max(0, player.shieldTicks - 1);
  if (state.phase !== 'fight') { player.previousInput = input; return; }
  tickStatus(state, player);
  if (!player.alive) { player.previousInput = input; return; }
  // Hit-stop: a few frozen ticks on contact give blades their weight.
  if (player.hitStop > 0) {
    // Presses during the pause still queue the next cut, so mashing never drops a hit.
    if (input.attack && !previous.attack && player.action === 'swing') player.bufferAttack = true;
    player.hitStop--; player.previousInput = input; return;
  }
  // Weapon slots: 1-3 or cycle. Switching cancels a charge, never a committed swing.
  const slot = input.slot1 && !previous.slot1 ? 0 : input.slot2 && !previous.slot2 ? 1 : input.slot3 && !previous.slot3 ? 2 : input.swap && !previous.swap ? (player.slot + 1) % 3 : player.slot;
  if (slot !== player.slot && player.actionTicks === 0 && !player.burst) { player.slot = slot; player.charging = false; player.chargeTicks = 0; player.comboStep = 0; player.bufferAttack = false; emit(state, 'swapWeapon', { playerId: player.id, weapon: player.weapons[slot] }); }
  if (player.stunTicks > 0) { player.stunTicks--; player.guarding = false; tickGuard(state, player, emptyInput()); }
  else if (!frozen) { tickGuard(state, player, input); tickAbilities(state, player, input, previous); tickWeapon(state, player, input, previous); }
  if (player.shieldTicks > 0 && (input.attack && !previous.attack)) player.shieldTicks = 0;
  if (player.catalystTicks > 0 && --player.catalystTicks === 0) player.catalysts = 0;
  if (player.held > 0) player.held--;
  if (player.evadeTicks > 0) player.evadeTicks--;
  if (player.dodgeTicks > 0) {
    player.dodgeTicks--;
    const speed = ABILITIES.dash.dodgeDistance / ABILITIES.dash.dodgeTicks;
    moveBody(map, player, player.dodgeX * speed, player.dodgeY * speed);
    player.vx = player.dodgeX * CLASSES[player.cls].speed; player.vy = player.dodgeY * CLASSES[player.cls].speed;
  }
  // Movement: steering eases toward the wanted velocity; actions, shields and charging slow you.
  const cls = CLASSES[player.cls], weapon = currentWeapon(player);
  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0), my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const length = Math.hypot(mx, my); if (length > 0) { mx /= length; my /= length; }
  const speed = cls.speed * moveScale(player, weapon) * (player.dashTicks > 0 ? ABILITIES.dash.speed : 1);
  const blend = 1 - Math.exp(-18 * DT);
  player.vx += (mx * speed - player.vx) * blend; player.vy += (my * speed - player.vy) * blend;
  moveBody(map, player, (player.vx + player.pushX) * DT, (player.vy + player.pushY) * DT);
  const decay = Math.exp(-9 * DT); player.pushX *= decay; player.pushY *= decay;
  if (Math.hypot(player.pushX, player.pushY) < 2) player.pushX = player.pushY = 0;
  player.previousInput = input;
}

function tickProjectiles(state) {
  const map = MAPS[state.mapId], survivors = [];
  for (const shot of state.projectiles) {
    let alive = true;
    const steps = Math.max(1, Math.ceil(Math.hypot(shot.vx, shot.vy) * DT / 6));
    shot.size += shot.grow;
    for (let step = 0; step < steps && alive; step++) {
      const nx = shot.x + shot.vx * DT / steps, ny = shot.y + shot.vy * DT / steps;
      if (wallAt(map, nx, ny)) {
        // Ricochets reflect off the face they struck; everything else stops at walls.
        if (shot.bounces > 0) {
          shot.bounces--; shot.hitIds = [];
          if (wallAt(map, nx, shot.y)) shot.vx = -shot.vx;
          if (wallAt(map, shot.x, ny)) shot.vy = -shot.vy;
          if (!wallAt(map, nx, shot.y) && !wallAt(map, shot.x, ny)) { shot.vx = -shot.vx; shot.vy = -shot.vy; }
          emit(state, 'ricochet', { x: shot.x, y: shot.y });
          continue;
        }
        if (shot.kind === 'explosive') explodeShot(state, shot);
        alive = false; break;
      }
      shot.x = nx; shot.y = ny;
      // Enemy domes stop rounds at their edge.
      const dome = state.players.find(guard => guard.alive && guard.team !== shot.team && guard.bubbleTicks > 0 && dist(guard, shot) <= ABILITIES.bubble.radius && dist(guard, { x: shot.x - shot.vx * DT, y: shot.y - shot.vy * DT }) > ABILITIES.bubble.radius - 2);
      if (dome) { dome.bubbleHp -= shot.damage; emit(state, 'bubbleHit', { playerId: dome.id, x: shot.x, y: shot.y, hp: Math.max(0, dome.bubbleHp) }); if (dome.bubbleHp <= 0) { dome.bubbleTicks = 0; emit(state, 'bubblePop', { playerId: dome.id, x: dome.x, y: dome.y }); } alive = false; break; }
      for (const target of state.players) {
        if (!target.alive || target.team === shot.team || dist(target, shot) > RULES.radius + shot.size) continue;
        // Shadow waves carry knights along with them.
        if (shot.carry && !guardUp(target)) moveBody(map, target, shot.vx * DT / steps * .8, shot.vy * DT / steps * .8);
        if (shot.hitIds.includes(target.id)) continue;
        shot.hitIds.push(target.id);
        const owner = state.players[shot.ownerId], blocked = guardUp(target);
        if (shot.kind === 'explosive') { explodeShot(state, shot); alive = false; break; }
        const landed = damage(state, owner, target, shot.damage, { push: shot.push, angle: Math.atan2(shot.vy, shot.vx), stun: 8, kind: shot.kind, source: shot, status: shot.status, chance: shot.chance });
        if (landed && shot.kind === 'catalyst') { target.catalysts = Math.min(3, (target.catalysts || 0) + 1); target.catalystTicks = 6 * TICK_RATE; emit(state, 'catalyst', { playerId: target.id, count: target.catalysts }); }
        if (shot.kind === 'detonator' && target.alive && target.catalysts > 0) {
          const count = target.catalysts; target.catalysts = 0;
          emit(state, 'detonate', { playerId: target.id, x: target.x, y: target.y, count });
          damage(state, owner, target, shot.perCharge * count, { push: shot.pushPerCharge * count, angle: Math.atan2(shot.vy, shot.vx), stun: 12 * count, kind: 'detonate' });
        }
        if (!shot.pierce || blocked) { alive = false; break; }
      }
    }
    if (alive && --shot.ttl > 0) survivors.push(shot);
  }
  state.projectiles = survivors;
}
function explodeShot(state, shot) {
  emit(state, 'explosion', { playerId: shot.ownerId, weapon: shot.weapon, x: shot.x, y: shot.y, radius: shot.radius });
  radialHit(state, state.players[shot.ownerId], shot.team, shot, shot.radius, shot.damage, { push: shot.push, stun: 16, kind: 'explosion' });
}
function tickBombs(state) {
  const map = MAPS[state.mapId], remaining = [];
  for (const bomb of state.bombs) {
    const weapon = WEAPONS[bomb.weapon];
    if (bomb.phase === 'pull') {
      // The vortex drags enemies to its centre and holds them there, then blasts them apart.
      for (const target of state.players) {
        if (!target.alive || target.team === bomb.team || guardUp(target)) continue;
        const d = dist(target, bomb); if (d > weapon.pull.radius || d < 3) continue;
        moveBody(map, target, (bomb.x - target.x) / d * Math.min(d, weapon.pull.speed * DT), (bomb.y - target.y) / d * Math.min(d, weapon.pull.speed * DT));
        target.held = 2; // caught knights can barely move until it blows
      }
      if (--bomb.pullTicks <= 0) explode(state, bomb); else remaining.push(bomb);
      continue;
    }
    if (--bomb.fuse > 0) { remaining.push(bomb); continue; }
    if (weapon.pull) { bomb.phase = 'pull'; bomb.pullTicks = weapon.pull.ticks; emit(state, 'vortex', { playerId: bomb.ownerId, x: bomb.x, y: bomb.y, radius: weapon.pull.radius }); remaining.push(bomb); continue; }
    explode(state, bomb);
  }
  state.bombs = remaining;
}
function tickClouds(state) {
  const remaining = [];
  for (const cloud of state.clouds) {
    for (const target of state.players) if (target.alive && target.team !== cloud.team && dist(target, cloud) <= cloud.radius + RULES.radius && !(target.status[cloud.status] > 0)) applyStatus(state, target, cloud.status, cloud.ownerId);
    if (--cloud.ticks > 0) remaining.push(cloud);
  }
  state.clouds = remaining;
}

function tickPickups(state) {
  const remaining = [];
  for (const heart of state.pickups) {
    // The nearest hurt knight in reach, of either team, takes it.
    const taker = state.players.filter(player => player.alive && player.hp < player.maxHp && canHeal(player) && dist(player, heart) <= RULES.heart.radius + RULES.radius)
      .sort((a, b) => dist(a, heart) - dist(b, heart))[0];
    if (taker) {
      const amount = Math.min(RULES.heart.heal, taker.maxHp - taker.hp); taker.hp += amount;
      emit(state, 'heartPickup', { playerId: taker.id, x: heart.x, y: heart.y, amount: Math.round(amount) });
    } else if (--heart.ttl > 0) remaining.push(heart);
  }
  state.pickups = remaining;
}

function tickPoints(state) {
  for (const point of state.points) {
    const counts = [0, 0];
    for (const player of state.players) if (player.alive && dist(player, point) <= RULES.pointRadius) counts[player.team]++;
    point.counts = counts;
    const net = counts[0] - counts[1];
    if (net === 0) continue;
    const before = point.progress, rate = 100 / RULES.captureTicks;
    point.progress = clamp(point.progress + net * rate, -100, 100);
    if (point.owner === 0 && point.progress <= 0 || point.owner === 1 && point.progress >= 0) {
      const team = 1 - point.owner;
      point.owner = null;
      for (const player of state.players) if (player.alive && player.team === team && dist(player, point) <= RULES.pointRadius) player.score += RULES.neutralizeScore;
      emit(state, 'pointNeutral', { pointId: point.id, team });
    }
    if (point.owner !== 0 && point.progress >= 100 && before < 100) captured(state, point, 0);
    if (point.owner !== 1 && point.progress <= -100 && before > -100) captured(state, point, 1);
  }
  if (--state.scoreTimer <= 0) {
    state.scoreTimer = RULES.scoreIntervalTicks;
    for (const team of [0, 1]) state.scores[team] += RULES.scoreTable[Math.min(3, state.points.filter(point => point.owner === team).length)] || 0;
    emit(state, 'scoreTick', { scores: [...state.scores] });
  }
}
function captured(state, point, team) {
  point.owner = team;
  for (const player of state.players) if (player.alive && player.team === team && dist(player, point) <= RULES.pointRadius) { player.captures++; player.score += RULES.captureScore; }
  emit(state, 'capture', { pointId: point.id, team, x: point.x, y: point.y });
}

export function step(state, rawInputs = []) {
  state.tick++;
  const inputs = state.players.map(player => {
    const raw = player.bot ? botInput(state, player) : rawInputs[player.id];
    const input = emptyInput(player.aim);
    for (const key of INPUT_KEYS) input[key] = raw?.[key] === true;
    input.aim = finite(raw?.aim, player.aim);
    return input;
  });
  if (state.phase === 'lobby' || state.phase === 'matchEnd') return state;
  if (state.phase === 'countdown') {
    for (const player of state.players) tickPlayer(state, player, inputs[player.id]);
    if (--state.phaseTicks <= 0) { state.phase = 'fight'; emit(state, 'fight'); }
    return state;
  }
  for (const player of state.players) tickPlayer(state, player, inputs[player.id]);
  tickProjectiles(state); tickBombs(state); tickClouds(state); tickPickups(state); tickPoints(state);
  state.timeLeftTicks = Math.max(0, state.timeLeftTicks - 1);
  const won = state.scores.findIndex(score => score >= RULES.scoreToWin);
  if (won >= 0 || state.timeLeftTicks === 0) {
    state.phase = 'matchEnd'; state.winner = won >= 0 ? won : state.scores[0] === state.scores[1] ? null : state.scores[0] > state.scores[1] ? 0 : 1;
    emit(state, 'matchEnd', { winner: state.winner, scores: [...state.scores] });
  }
  return state;
}

// ---------- bots ----------
const flowCache = new Map();
/** Breadth-first distance field from a world point over walkable tiles. */
function flowField(map, x, y) {
  const key = `${map.id}:${Math.floor(x / TILE)}:${Math.floor(y / TILE)}`;
  if (flowCache.has(key)) return flowCache.get(key);
  const field = new Int32Array(map.cols * map.rows).fill(-1), queue = [];
  const start = Math.floor(y / TILE) * map.cols + Math.floor(x / TILE);
  field[start] = 0; queue.push(start);
  for (let head = 0; head < queue.length; head++) {
    const index = queue[head], col = index % map.cols, row = (index - col) / map.cols;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const c = col + dc, r = row + dr, next = r * map.cols + c;
      if (isWall(map, c, r) || field[next] >= 0) continue;
      field[next] = field[index] + 1; queue.push(next);
    }
  }
  flowCache.set(key, field); return field;
}
function stepToward(map, player, goal) {
  if (lineOfSight(map, player, goal) && dist(player, goal) < TILE * 3) return Math.atan2(goal.y - player.y, goal.x - player.x);
  const field = flowField(map, goal.x, goal.y), col = Math.floor(player.x / TILE), row = Math.floor(player.y / TILE);
  let best = null, bestValue = Infinity;
  for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const c = col + dc, r = row + dr; if (isWall(map, c, r)) continue;
    if (dc && dr && (isWall(map, col + dc, row) || isWall(map, col, row + dr))) continue;
    const value = field[r * map.cols + c]; if (value >= 0 && value < bestValue) { bestValue = value; best = { x: (c + .5) * TILE, y: (r + .5) * TILE }; }
  }
  return best ? Math.atan2(best.y - player.y, best.x - player.x) : Math.atan2(goal.y - player.y, goal.x - player.x);
}
/** The closest of your team's base tiles (bases can be split into several blocks). */
function nearestBaseTile(map, bot) {
  return map.spawns[bot.team].reduce((best, tile) => dist(tile, bot) < dist(best, bot) ? tile : best);
}
function botInput(state, bot) {
  const input = emptyInput(bot.aim);
  if (!bot.alive || state.phase !== 'fight' && state.phase !== 'countdown') return input;
  const map = MAPS[state.mapId], brain = bot.brain ||= { goal: null, rethink: 0, strafe: 1, strafeTicks: 0, pulse: 0 };
  // Objective: take a point we don't hold (nearest by path), otherwise guard a contested one.
  if (--brain.rethink <= 0) {
    brain.rethink = 90 + Math.floor(random(state) * 60);
    const ranked = state.points.map(point => {
      const field = flowField(map, point.x, point.y), steps = field[Math.floor(bot.y / TILE) * map.cols + Math.floor(bot.x / TILE)];
      const contested = point.counts ? point.counts[1 - bot.team] : 0;
      const want = point.owner === bot.team ? (contested ? 1.2 : 4) : point.owner === null ? 1 : 1.5;
      return { point, score: (steps < 0 ? 999 : steps) * want - contested * 4 };
    }).sort((a, b) => a.score - b.score);
    brain.goal = ranked[Math.floor(random(state) * Math.min(2, ranked.length) * .6)].point;
  }
  const enemies = state.players.filter(other => other.alive && other.team !== bot.team && (other.cloakTicks === 0 || dist(other, bot) < ABILITIES.cloak.revealRange) && dist(other, bot) < 460 && lineOfSight(map, bot, other));
  const target = enemies.sort((a, b) => dist(a, bot) - dist(b, bot))[0];
  // Badly hurt: fall back to base to heal, or grab a nearby heart, unless someone is right on top of us.
  const health = bot.hp / bot.maxHp, pressed = target && dist(target, bot) < 160;
  if (health < .35) brain.retreat = true; else if (health >= .95 || !bot.alive) brain.retreat = false;
  const heart = health < .75 ? state.pickups.filter(pickup => dist(pickup, bot) < 260 && lineOfSight(map, bot, pickup)).sort((a, b) => dist(a, bot) - dist(b, bot))[0] : null;
  const detour = pressed ? null : brain.retreat && !inBase(state, bot) ? nearestBaseTile(map, bot) : heart ? heart : null;
  let moveAngle = null;
  if (target) {
    const d = dist(target, bot);
    bot.aim = Math.atan2(target.y - bot.y, target.x - bot.x) + (random(state) - .5) * .12;
    input.aim = bot.aim;
    // Choose a weapon for the range: blade close, gun mid, bomb when they crowd us or a point.
    const families = bot.weapons.map(id => WEAPONS[id].family);
    const crowded = state.players.filter(other => other.alive && other.team !== bot.team && dist(other, bot) < 130).length >= 2 || state.points.some(point => dist(point, bot) <= RULES.pointRadius && dist(point, target) <= RULES.pointRadius);
    if (!brain.style || brain.life !== bot.deaths) { brain.life = bot.deaths; brain.style = bot.cls === 'striker' || random(state) < .4 ? 'melee' : 'ranged'; }
    const want = d < (brain.style === 'melee' ? 170 : 90) ? 'blade' : crowded && d < 140 ? 'bomb' : 'gun';
    const slot = families.indexOf(want);
    if (slot >= 0 && slot !== bot.slot && bot.actionTicks === 0 && !bot.charging) input[`slot${slot + 1}`] = !bot.previousInput[`slot${slot + 1}`];
    const weapon = currentWeapon(bot);
    // Bombs always charge; blades and guns mostly tap, sometimes commit to a full charge.
    if (!bot.charging && brain.mode !== 'charge' && weapon.family !== 'bomb' && random(state) < .006) brain.mode = 'charge';
    if (weapon.family === 'bomb' || brain.mode === 'charge') {
      const full = bot.charging && bot.chargeTicks >= weapon.chargeTicks;
      input.attack = !full;
      if (full) brain.mode = 'tap';
    } else { brain.pulse = (brain.pulse + 1) % (weapon.family === 'blade' ? 14 : weapon.interval + 2); input.attack = brain.pulse < 2; }
    // Keep a fighting distance and strafe.
    if (--brain.strafeTicks <= 0) { brain.strafeTicks = 40 + Math.floor(random(state) * 60); brain.strafe = random(state) < .5 ? -1 : 1; }
    // Melee-minded bots keep closing in, shooting on the way; ranged ones hold their distance.
    const ideal = weapon.family === 'blade' || brain.style === 'melee' ? 45 : weapon.family === 'gun' ? 220 : 40;
    const toward = Math.atan2(target.y - bot.y, target.x - bot.x);
    moveAngle = d > ideal + 30 ? stepToward(map, bot, target) : d < ideal - 30 ? toward + Math.PI : toward + brain.strafe * Math.PI / 2;
    // Abilities.
    if (bot.cls === 'striker' && d > 140 && bot.abilityCooldown === 0) input.ability = !bot.previousInput.ability;
    if (bot.cls === 'recon' && d > 200 && bot.abilityCooldown === 0) input.ability = !bot.previousInput.ability;
    if (bot.cls === 'guardian') {
      const hurt = state.players.filter(ally => ally.alive && ally.team === bot.team && dist(ally, bot) < ABILITIES.heal.radius && ally.hp < ally.maxHp * .6).length;
      if (hurt && bot.ability2Cooldown === 0) input.ability2 = !bot.previousInput.ability2;
      if (bot.hp < bot.maxHp * .7 && bot.abilityCooldown === 0) input.ability = !bot.previousInput.ability;
    }
  } else if (brain.goal) {
    const d = dist(bot, brain.goal);
    if (d > RULES.pointRadius * .5) moveAngle = stepToward(map, bot, brain.goal);
    else if (--brain.strafeTicks <= 0) { brain.strafeTicks = 50; brain.strafe = random(state) * Math.PI * 2; }
    else moveAngle = d > 20 ? brain.strafe : null;
    if (moveAngle !== null) { bot.aim = moveAngle; input.aim = moveAngle; }
    if (bot.cls === 'striker' && d > 400 && bot.abilityCooldown === 0) input.ability = !bot.previousInput.ability;
  }
  // Shield up against shots on target, swings and full charges up close, and bombs about to blow.
  const threatened = state.projectiles.some(shot => {
    if (shot.team === bot.team) return false;
    const d = dist(shot, bot), speed = Math.hypot(shot.vx, shot.vy);
    return d < 150 && ((bot.x - shot.x) * shot.vx + (bot.y - shot.y) * shot.vy) / (speed * Math.max(1, d)) > .92;
  }) || state.players.some(enemy => enemy.alive && enemy.team !== bot.team && dist(enemy, bot) < 100 && (enemy.action !== 'idle' || enemy.charging && enemy.chargeTicks > WEAPONS[enemy.weapons[enemy.slot]].chargeTicks * .8))
    || state.bombs.some(bomb => bomb.team !== bot.team && bomb.fuse < 36 && dist(bomb, bot) < (WEAPONS[bomb.weapon].radius || 0) + 24);
  brain.guardTicks = Math.max(0, (brain.guardTicks || 0) - 1);
  if (threatened && !bot.guardBroken && bot.guardHp > guardMax(bot) * .3 && !bot.charging && brain.guardTicks === 0 && random(state) < .05) brain.guardTicks = 30 + Math.floor(random(state) * 40);
  // Strikers dodge through the threat instead of blocking it.
  if (threatened && bot.cls === 'striker' && bot.abilityCooldown === 0 && random(state) < .04) input.ability = !bot.previousInput.ability;
  else if (brain.guardTicks > 0) { input.guard = true; input.attack = false; }
  if (detour) { moveAngle = stepToward(map, bot, detour); if (!target) { bot.aim = moveAngle; input.aim = moveAngle; } }
  else if (brain.retreat && !pressed && inBase(state, bot)) moveAngle = null; // wait in base until healed
  if (moveAngle !== null) {
    const x = Math.cos(moveAngle), y = Math.sin(moveAngle);
    input.right = x > .38; input.left = x < -.38; input.down = y > .38; input.up = y < -.38;
    // Slide off wall corners: if the axis we want is blocked, line up with the middle of our row or column.
    const sx = input.right ? 1 : input.left ? -1 : 0, sy = input.down ? 1 : input.up ? -1 : 0;
    if (sx && !sy && collides(map, bot.x + sx * 4, bot.y, RULES.radius)) { const centre = (Math.floor(bot.y / TILE) + .5) * TILE - bot.y; input.down = centre > 2; input.up = centre < -2; }
    if (sy && !sx && collides(map, bot.x, bot.y + sy * 4, RULES.radius)) { const centre = (Math.floor(bot.x / TILE) + .5) * TILE - bot.x; input.right = centre > 2; input.left = centre < -2; }
  }
  return input;
}

export function getScoreboard(state) {
  return state.players.map(player => ({ id: player.id, name: player.name, team: player.team, cls: player.cls, human: player.human, score: player.score, kills: player.kills, deaths: player.deaths, captures: player.captures, damage: Math.round(player.damage) }))
    .sort((a, b) => a.team - b.team || b.score - a.score || b.kills - a.kills || b.damage - a.damage);
}
