/** Lockdown: a top-down team brawl over three control points (after Spiral Knights).
 * Deterministic 120 Hz simulation shared by the server and offline practice.
 * Up to 4v4; empty seats are filled by bots. Teams score every five seconds by
 * the points they hold; first to 500 (or the leader at the time limit) wins. */
import { MAPS, MAP_IDS, TILE, isWall, wallAt } from './lockdown-maps.js';

export { MAPS, MAP_IDS, TILE };
export const TICK_RATE = 120;
const DT = 1 / TICK_RATE;
export const TEAM_SIZE = 4;
export const CAPACITY = TEAM_SIZE * 2;
export const INPUT_KEYS = Object.freeze(['up', 'down', 'left', 'right', 'attack', 'ability', 'ability2', 'slot1', 'slot2', 'slot3', 'swap']);
export const emptyInput = (aim = 0) => ({ ...Object.fromEntries(INPUT_KEYS.map(key => [key, false])), aim });

export const RULES = Object.freeze({
  countdownTicks: 3 * TICK_RATE, timeLimitTicks: 10 * 60 * TICK_RATE, scoreToWin: 500,
  scoreIntervalTicks: 5 * TICK_RATE, scoreTable: Object.freeze([0, 5, 8, 9]),
  pointRadius: 72, captureTicks: 5 * TICK_RATE,
  respawnBaseTicks: 5 * TICK_RATE, respawnPerMinuteTicks: TICK_RATE, respawnMaxTicks: 12 * TICK_RATE,
  spawnShieldTicks: 2 * TICK_RATE, radius: 15, eventLimit: 160,
});

/** Classes swap Spiral Knights' shield for a signature ability. */
export const CLASSES = Object.freeze({
  striker: Object.freeze({ id: 'striker', name: 'Striker', hp: 100, speed: 205, ability: 'Dash', ability2: null, description: 'Fast and fierce. Dash gives three seconds of extra speed to take points and chase down runners.' }),
  guardian: Object.freeze({ id: 'guardian', name: 'Guardian', hp: 130, speed: 180, ability: 'Bubble', ability2: 'Heal Pulse', description: 'Holds the line. Raises a dome that soaks damage for allies inside, and pulses healing to nearby teammates.' }),
  recon: Object.freeze({ id: 'recon', name: 'Recon', hp: 90, speed: 195, ability: 'Cloak', ability2: null, description: 'Strikes from nowhere. Cloak turns you invisible; the first hit out of it marks the target to take extra damage.' }),
});
export const ABILITIES = Object.freeze({
  dash: { ticks: 3 * TICK_RATE, cooldown: 10 * TICK_RATE, speed: 1.55 },
  bubble: { ticks: 4 * TICK_RATE, cooldown: 14 * TICK_RATE, radius: 88, hp: 120 },
  heal: { cooldown: 16 * TICK_RATE, radius: 150, amount: 30 },
  cloak: { ticks: 4 * TICK_RATE, cooldown: 12 * TICK_RATE, markTicks: 5 * TICK_RATE, markBonus: .3, revealRange: 64 },
});

/** Three weapon families, each with a held charge attack. Names are original. */
export const WEAPONS = Object.freeze({
  brand: { id: 'brand', family: 'blade', name: 'Knight Brand', combo: [14, 14, 20], startup: 6, active: 6, recovery: 14, reach: 64, arc: 1.7, push: 160, chargeTicks: 108, charge: { kind: 'spin', damage: 26, reach: 76, push: 260 }, description: 'Balanced three-cut combo. Charge: a full spin slash.' },
  cleaver: { id: 'cleaver', family: 'blade', name: 'Troll Cleaver', combo: [24, 30], startup: 12, active: 8, recovery: 22, reach: 70, arc: 1.9, push: 280, chargeTicks: 132, charge: { kind: 'slam', damage: 34, reach: 92, push: 380 }, description: 'Slow, brutal two-hit chain. Charge: a ground slam around you.' },
  rapier: { id: 'rapier', family: 'blade', name: 'Needle Rapier', combo: [9, 9, 12], startup: 4, active: 4, recovery: 8, reach: 74, arc: .55, push: 90, chargeTicks: 96, charge: { kind: 'lunge', damage: 22, reach: 64, push: 200, distance: 170 }, description: 'Fast, narrow thrusts. Charge: a long lunge through the target.' },
  blaster: { id: 'blaster', family: 'gun', name: 'Pulse Blaster', clip: 3, damage: 12, speed: 760, interval: 18, reload: 54, spread: .03, pellets: 1, range: 620, push: 70, chargeTicks: 120, charge: { kind: 'pierce', damage: 28, speed: 900, push: 160 }, description: 'Reliable three-shot sidearm. Charge: a piercing bolt.' },
  autogun: { id: 'autogun', family: 'gun', name: 'Rattle Autogun', clip: 6, damage: 6, speed: 780, interval: 9, reload: 66, spread: .09, pellets: 1, range: 560, push: 30, chargeTicks: 120, charge: { kind: 'burst', damage: 7, speed: 800, push: 60, count: 8 }, description: 'Fast six-round spray. Charge: an eight-shot burst.' },
  scatter: { id: 'scatter', family: 'gun', name: 'Scattergun', clip: 2, damage: 6, speed: 640, interval: 28, reload: 66, spread: .45, pellets: 5, range: 300, push: 60, chargeTicks: 120, charge: { kind: 'wide', damage: 7, speed: 660, push: 140, count: 9 }, description: 'Short-range pellet blast. Charge: a wide nine-pellet fan.' },
  magnus: { id: 'magnus', family: 'gun', name: 'Magnus Hand-cannon', clip: 2, damage: 20, speed: 700, interval: 32, reload: 78, spread: .02, pellets: 1, range: 640, push: 240, chargeTicks: 132, charge: { kind: 'explosive', damage: 24, speed: 640, push: 280, radius: 72 }, description: 'Heavy two-shot cannon with big knockback. Charge: an exploding round.' },
  blast: { id: 'blast', family: 'bomb', name: 'Blast Bomb', chargeTicks: 144, fuse: 108, radius: 96, damage: 34, push: 320, description: 'Charge, release, run. A big blast after a short fuse.' },
  vortex: { id: 'vortex', family: 'bomb', name: 'Vortex Bomb', chargeTicks: 144, fuse: 144, radius: 140, damage: 16, push: 0, pull: 220, description: 'Drags every enemy in range toward its centre, then pops.' },
  shard: { id: 'shard', family: 'bomb', name: 'Shard Bomb', chargeTicks: 120, fuse: 84, radius: 40, damage: 12, push: 120, shards: 8, description: 'Bursts into eight flying shards that cut across the point.' },
});
export const WEAPON_IDS = Object.freeze(Object.keys(WEAPONS));
export const DEFAULT_LOADOUTS = Object.freeze({ striker: ['brand', 'blaster', 'blast'], guardian: ['cleaver', 'magnus', 'vortex'], recon: ['rapier', 'autogun', 'shard'] });
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
    action: 'idle', actionTicks: 0, actionTotal: 0, comboStep: 0, comboWindow: 0, hitIds: [], chargeTicks: 0, charging: false, lungeTicks: 0,
    clips: {}, reloadTicks: {}, fireCooldown: 0,
    dashTicks: 0, bubbleTicks: 0, bubbleHp: 0, cloakTicks: 0, markTicks: 0, markReady: false, abilityCooldown: 0, ability2Cooldown: 0,
    kills: 0, deaths: 0, captures: 0, damage: 0, previousInput: emptyInput(team === 0 ? 0 : Math.PI),
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
    projectiles: [], bombs: [], events: [], eventId: 0, nextId: 1,
  };
}

/** Lobby choices. Humans pick a team, class and three weapons (one per family is not required). */
export function setPlayerSetup(state, id, { team, cls, weapons, name } = {}) {
  const player = state.players[id];
  if (!player) return { ok: false, error: 'Unknown player.' };
  if (state.phase !== 'lobby' && state.phase !== 'matchEnd') return { ok: false, error: 'Change your setup in the lobby.' };
  if (cls !== undefined && !Object.hasOwn(CLASSES, cls)) return { ok: false, error: 'Choose Striker, Guardian or Recon.' };
  if (weapons !== undefined && (!Array.isArray(weapons) || weapons.length !== 3 || weapons.some(weapon => !Object.hasOwn(WEAPONS, weapon)) || new Set(weapons).size !== 3)) return { ok: false, error: 'Choose three different weapons.' };
  if (team !== undefined && ![0, 1].includes(team)) return { ok: false, error: 'Choose a team.' };
  if (team !== undefined && team !== player.team && state.players.filter(other => other.human && other.team === team).length >= TEAM_SIZE) return { ok: false, error: 'That team is full.' };
  if (team !== undefined) player.team = team;
  if (cls !== undefined) { player.cls = cls; player.maxHp = player.hp = CLASSES[cls].hp; }
  if (weapons !== undefined) player.weapons = [...weapons];
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
  Object.assign(state, { phase: 'countdown', phaseTicks: RULES.countdownTicks, scores: [0, 0], winner: null, timeLeftTicks: RULES.timeLimitTicks, scoreTimer: RULES.scoreIntervalTicks, projectiles: [], bombs: [] });
  for (const point of state.points) { point.progress = 0; point.owner = null; }
  for (const player of state.players) {
    if (player.bot) { player.cls = CLASS_IDS[Math.floor(random(state) * CLASS_IDS.length)]; player.weapons = [...DEFAULT_LOADOUTS[player.cls]]; }
    Object.assign(player, { kills: 0, deaths: 0, captures: 0, damage: 0 });
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
    stunTicks: 0, pushX: 0, pushY: 0, action: 'idle', actionTicks: 0, actionTotal: 0, comboStep: 0, comboWindow: 0, hitIds: [], chargeTicks: 0, charging: false, lungeTicks: 0,
    dashTicks: 0, bubbleTicks: 0, bubbleHp: 0, cloakTicks: 0, markTicks: 0, markReady: false, slot: 0, fireCooldown: 0,
    aim: player.team === 0 ? 0 : Math.PI,
  });
  player.clips = Object.fromEntries(player.weapons.filter(id => WEAPONS[id].family === 'gun').map(id => [id, WEAPONS[id].clip]));
  player.reloadTicks = {};
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

// ---------- damage ----------
function inAlliedBubble(state, target) {
  return state.players.find(guard => guard.alive && guard.team === target.team && guard.bubbleTicks > 0 && dist(guard, target) <= ABILITIES.bubble.radius) || null;
}
function damage(state, attacker, target, amount, { push = 0, angle = 0, stun = 10, kind = 'hit', source = null } = {}) {
  if (!target.alive || target.team === attacker?.team || target.shieldTicks > 0) return false;
  // A Guardian dome soaks hits that come from outside it.
  const dome = inAlliedBubble(state, target), origin = source || attacker;
  if (dome && origin && dist(dome, origin) > ABILITIES.bubble.radius) {
    dome.bubbleHp -= amount;
    emit(state, 'bubbleHit', { playerId: dome.id, x: target.x, y: target.y, hp: Math.max(0, dome.bubbleHp) });
    if (dome.bubbleHp <= 0) { dome.bubbleTicks = 0; emit(state, 'bubblePop', { playerId: dome.id, x: dome.x, y: dome.y }); }
    return false;
  }
  let total = amount * (target.markTicks > 0 ? 1 + ABILITIES.cloak.markBonus : 1);
  if (attacker && attacker.markReady && attacker.cls === 'recon') { target.markTicks = ABILITIES.cloak.markTicks; attacker.markReady = false; emit(state, 'mark', { playerId: attacker.id, targetId: target.id, x: target.x, y: target.y }); }
  total = Math.round(total);
  target.hp -= total; target.stunTicks = Math.max(target.stunTicks, stun);
  target.pushX = Math.cos(angle) * push; target.pushY = Math.sin(angle) * push;
  if (target.cloakTicks > 0) { target.cloakTicks = 0; emit(state, 'uncloak', { playerId: target.id }); }
  if (target.charging) { target.charging = false; target.chargeTicks = 0; }
  if (attacker) attacker.damage += total;
  emit(state, 'damage', { playerId: attacker?.id ?? null, targetId: target.id, amount: total, kind, x: target.x, y: target.y, hp: Math.max(0, target.hp) });
  if (target.hp <= 0) {
    target.alive = false; target.hp = 0; target.deaths++; target.respawnTicks = respawnDelay(state);
    target.bubbleTicks = target.cloakTicks = target.dashTicks = 0;
    if (attacker && attacker.team !== target.team) attacker.kills++;
    emit(state, 'kill', { playerId: attacker?.id ?? null, targetId: target.id, x: target.x, y: target.y, respawnTicks: target.respawnTicks });
  }
  return true;
}
function breakCloak(state, player) {
  if (player.cloakTicks > 0) { player.cloakTicks = 0; player.markReady = true; emit(state, 'uncloak', { playerId: player.id }); }
}

// ---------- weapons ----------
function currentWeapon(player) { return WEAPONS[player.weapons[player.slot]]; }

function bladeSweep(state, player, weapon, reach, arc, amount, push, kind) {
  for (const target of state.players) {
    if (!target.alive || target.team === player.team || player.hitIds.includes(target.id)) continue;
    const d = dist(player, target);
    if (d > reach + RULES.radius) continue;
    const angle = Math.atan2(target.y - player.y, target.x - player.x);
    if (arc < Math.PI * 2 && Math.abs(wrapAngle(angle - player.aim)) > arc / 2 + Math.atan2(RULES.radius, Math.max(1, d))) continue;
    if (!lineOfSight(MAPS[state.mapId], player, target)) continue;
    player.hitIds.push(target.id);
    damage(state, player, target, amount, { push, angle, stun: 14, kind });
  }
}
function fire(state, player, weapon, spec = weapon, count = weapon.pellets || 1, spread = weapon.spread || 0) {
  for (let i = 0; i < count; i++) {
    const offset = count > 1 ? (i / (count - 1) - .5) * spread * 2 : (random(state) - .5) * spread * 2;
    const angle = player.aim + offset;
    state.projectiles.push({
      id: state.nextId++, ownerId: player.id, team: player.team, weapon: weapon.id, kind: spec.kind || 'bullet',
      x: player.x + Math.cos(angle) * (RULES.radius + 4), y: player.y + Math.sin(angle) * (RULES.radius + 4),
      vx: Math.cos(angle) * (spec.speed || weapon.speed), vy: Math.sin(angle) * (spec.speed || weapon.speed),
      damage: spec.damage, push: spec.push ?? weapon.push, ttl: Math.ceil((weapon.range || 600) / (spec.speed || weapon.speed) * TICK_RATE), pierce: spec.kind === 'pierce', radius: spec.radius || 0, hitIds: [],
    });
  }
  emit(state, 'shot', { playerId: player.id, weapon: weapon.id, charged: spec !== weapon, x: player.x, y: player.y, angle: player.aim });
}
function plantBomb(state, player, weapon) {
  state.bombs.push({ id: state.nextId++, ownerId: player.id, team: player.team, weapon: weapon.id, x: player.x, y: player.y, fuse: weapon.fuse, total: weapon.fuse });
  emit(state, 'bombPlant', { playerId: player.id, weapon: weapon.id, x: player.x, y: player.y });
}
function explode(state, bomb) {
  const weapon = WEAPONS[bomb.weapon], owner = state.players[bomb.ownerId];
  emit(state, 'explosion', { playerId: bomb.ownerId, weapon: bomb.weapon, x: bomb.x, y: bomb.y, radius: weapon.radius });
  if (weapon.shards) {
    for (let i = 0; i < weapon.shards; i++) {
      const angle = i / weapon.shards * Math.PI * 2;
      state.projectiles.push({ id: state.nextId++, ownerId: bomb.ownerId, team: bomb.team, weapon: bomb.weapon, kind: 'shard', x: bomb.x, y: bomb.y, vx: Math.cos(angle) * 520, vy: Math.sin(angle) * 520, damage: weapon.damage, push: weapon.push, ttl: Math.ceil(.45 * TICK_RATE), pierce: false, radius: 0, hitIds: [] });
    }
    return;
  }
  for (const target of state.players) {
    if (!target.alive || target.team === bomb.team || dist(target, bomb) > weapon.radius + RULES.radius) continue;
    if (!lineOfSight(MAPS[state.mapId], bomb, target)) continue;
    damage(state, owner, target, weapon.damage, { push: weapon.push, angle: Math.atan2(target.y - bomb.y, target.x - bomb.x), stun: 20, kind: 'bomb', source: bomb });
  }
}
function chargeRelease(state, player, weapon) {
  const charge = weapon.charge;
  player.hitIds = [];
  if (weapon.family === 'blade') {
    if (charge.kind === 'lunge') { player.lungeTicks = 18; player.action = 'charge'; player.actionTicks = player.actionTotal = 24; }
    else { player.action = 'charge'; player.actionTicks = player.actionTotal = 26; bladeSweep(state, player, weapon, charge.reach, Math.PI * 2, charge.damage, charge.push, charge.kind); }
    emit(state, 'swing', { playerId: player.id, weapon: weapon.id, charged: true, kind: charge.kind, x: player.x, y: player.y, angle: player.aim });
  } else if (weapon.family === 'gun') {
    if (charge.kind === 'burst' || charge.kind === 'wide') fire(state, player, weapon, charge, charge.count, charge.kind === 'wide' ? .7 : .25);
    else fire(state, player, weapon, charge, 1, 0);
    player.clips[weapon.id] = weapon.clip; player.fireCooldown = weapon.interval * 2;
  } else plantBomb(state, player, weapon);
}

function tickWeapon(state, player, input, previous) {
  const weapon = currentWeapon(player), pressed = input.attack && !previous.attack, released = !input.attack && previous.attack;
  player.fireCooldown = Math.max(0, player.fireCooldown - 1);
  for (const id of Object.keys(player.reloadTicks)) if (player.reloadTicks[id] > 0 && --player.reloadTicks[id] === 0) player.clips[id] = WEAPONS[id].clip;
  if (player.comboWindow > 0 && --player.comboWindow === 0) player.comboStep = 0;
  if (player.actionTicks > 0) {
    player.actionTicks--;
    if (player.action === 'swing' && player.actionTicks === player.actionTotal - weapon.startup) {
      bladeSweep(state, player, weapon, weapon.reach, weapon.arc, weapon.combo[player.comboStep], weapon.push, 'blade');
    }
    if (player.lungeTicks > 0) {
      player.lungeTicks--;
      const speed = weapon.charge.distance / 18 * TICK_RATE;
      moveBody(MAPS[state.mapId], player, Math.cos(player.aim) * speed * DT, Math.sin(player.aim) * speed * DT);
      bladeSweep(state, player, weapon, weapon.charge.reach, 1.2, weapon.charge.damage, weapon.charge.push, 'lunge');
    }
    if (player.actionTicks === 0) {
      if (player.action === 'swing') { player.comboStep = (player.comboStep + 1) % weapon.combo.length; player.comboWindow = 30; }
      player.action = 'idle';
    }
    return;
  }
  // Holding the button charges; a full charge releases a special on let-go.
  if (input.attack && (player.charging || !pressed && weapon.family !== 'bomb')) { if (!player.charging) { player.charging = true; player.chargeTicks = 0; } player.chargeTicks++; }
  if (weapon.family === 'bomb' && pressed) { player.charging = true; player.chargeTicks = 0; }
  if (released && player.charging) {
    const full = player.chargeTicks >= weapon.chargeTicks;
    player.charging = false; player.chargeTicks = 0;
    if (full) { breakCloak(state, player); chargeRelease(state, player, weapon); }
    return;
  }
  if (!pressed || weapon.family === 'bomb') return;
  breakCloak(state, player);
  if (weapon.family === 'blade') {
    player.action = 'swing'; player.actionTotal = player.actionTicks = weapon.startup + weapon.active + weapon.recovery; player.hitIds = [];
    emit(state, 'swing', { playerId: player.id, weapon: weapon.id, step: player.comboStep, x: player.x, y: player.y, angle: player.aim });
  } else if (weapon.family === 'gun' && player.fireCooldown === 0) {
    if (!(player.clips[weapon.id] > 0)) { if (!(player.reloadTicks[weapon.id] > 0)) player.reloadTicks[weapon.id] = weapon.reload; return; }
    player.clips[weapon.id]--; player.fireCooldown = weapon.interval; player.reloadTicks[weapon.id] = 0;
    fire(state, player, weapon);
    if (player.clips[weapon.id] === 0) player.reloadTicks[weapon.id] = weapon.reload;
  }
}

function tickAbilities(state, player, input, previous) {
  player.abilityCooldown = Math.max(0, player.abilityCooldown - 1); player.ability2Cooldown = Math.max(0, player.ability2Cooldown - 1);
  player.dashTicks = Math.max(0, player.dashTicks - 1); player.markTicks = Math.max(0, player.markTicks - 1);
  if (player.bubbleTicks > 0 && --player.bubbleTicks === 0) emit(state, 'bubbleEnd', { playerId: player.id });
  if (player.cloakTicks > 0 && --player.cloakTicks === 0) { player.markReady = true; emit(state, 'uncloak', { playerId: player.id }); }
  if (input.ability && !previous.ability && player.abilityCooldown === 0) {
    if (player.cls === 'striker') { player.dashTicks = ABILITIES.dash.ticks; player.abilityCooldown = ABILITIES.dash.cooldown; emit(state, 'dash', { playerId: player.id, x: player.x, y: player.y }); }
    if (player.cls === 'guardian') { player.bubbleTicks = ABILITIES.bubble.ticks; player.bubbleHp = ABILITIES.bubble.hp; player.abilityCooldown = ABILITIES.bubble.cooldown; emit(state, 'bubble', { playerId: player.id, x: player.x, y: player.y, radius: ABILITIES.bubble.radius }); }
    if (player.cls === 'recon') { player.cloakTicks = ABILITIES.cloak.ticks; player.abilityCooldown = ABILITIES.cloak.cooldown; player.markReady = false; emit(state, 'cloak', { playerId: player.id, x: player.x, y: player.y }); }
  }
  if (input.ability2 && !previous.ability2 && player.ability2Cooldown === 0 && player.cls === 'guardian') {
    player.ability2Cooldown = ABILITIES.heal.cooldown;
    const healed = [];
    for (const ally of state.players) if (ally.alive && ally.team === player.team && dist(ally, player) <= ABILITIES.heal.radius) {
      const amount = Math.min(ABILITIES.heal.amount, ally.maxHp - ally.hp); ally.hp += amount; if (amount > 0) healed.push(ally.id);
    }
    emit(state, 'heal', { playerId: player.id, x: player.x, y: player.y, radius: ABILITIES.heal.radius, healed });
  }
}

function tickPlayer(state, player, input) {
  const previous = player.previousInput || emptyInput(), map = MAPS[state.mapId];
  if (!player.alive) {
    if (state.phase === 'fight' && --player.respawnTicks <= 0) { spawn(state, player); emit(state, 'respawn', { playerId: player.id, x: player.x, y: player.y }); }
    player.previousInput = input; return;
  }
  player.aim = wrapAngle(finite(input.aim, player.aim));
  player.shieldTicks = Math.max(0, player.shieldTicks - 1);
  if (state.phase !== 'fight') { player.previousInput = input; return; }
  // Weapon slots: 1-3 or cycle. Switching cancels a charge, never a committed swing.
  const slot = input.slot1 && !previous.slot1 ? 0 : input.slot2 && !previous.slot2 ? 1 : input.slot3 && !previous.slot3 ? 2 : input.swap && !previous.swap ? (player.slot + 1) % 3 : player.slot;
  if (slot !== player.slot && player.actionTicks === 0) { player.slot = slot; player.charging = false; player.chargeTicks = 0; player.comboStep = 0; emit(state, 'swapWeapon', { playerId: player.id, weapon: player.weapons[slot] }); }
  if (player.stunTicks > 0) player.stunTicks--;
  else { tickAbilities(state, player, input, previous); tickWeapon(state, player, input, previous); }
  if (player.shieldTicks > 0 && (input.attack && !previous.attack)) player.shieldTicks = 0;
  // Movement: steering eases toward the wanted velocity; actions and charging slow you.
  const cls = CLASSES[player.cls];
  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0), my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const length = Math.hypot(mx, my); if (length > 0) { mx /= length; my /= length; }
  const weapon = currentWeapon(player);
  const slow = player.stunTicks > 0 ? .25 : player.action !== 'idle' ? .45 : player.charging ? (weapon.family === 'bomb' ? .55 : .7) : 1;
  const speed = cls.speed * slow * (player.dashTicks > 0 ? ABILITIES.dash.speed : 1);
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
    const steps = Math.max(1, Math.ceil(Math.hypot(shot.vx, shot.vy) * DT / 8));
    for (let step = 0; step < steps && alive; step++) {
      shot.x += shot.vx * DT / steps; shot.y += shot.vy * DT / steps;
      if (wallAt(map, shot.x, shot.y)) { alive = false; break; }
      // Enemy domes stop rounds at their edge.
      const dome = state.players.find(guard => guard.alive && guard.team !== shot.team && guard.bubbleTicks > 0 && dist(guard, shot) <= ABILITIES.bubble.radius && dist(guard, { x: shot.x - shot.vx * DT, y: shot.y - shot.vy * DT }) > ABILITIES.bubble.radius - 2);
      if (dome) { dome.bubbleHp -= shot.damage; emit(state, 'bubbleHit', { playerId: dome.id, x: shot.x, y: shot.y, hp: Math.max(0, dome.bubbleHp) }); if (dome.bubbleHp <= 0) { dome.bubbleTicks = 0; emit(state, 'bubblePop', { playerId: dome.id, x: dome.x, y: dome.y }); } alive = false; break; }
      for (const target of state.players) {
        if (!target.alive || target.team === shot.team || shot.hitIds.includes(target.id) || dist(target, shot) > RULES.radius + 3) continue;
        shot.hitIds.push(target.id);
        const owner = state.players[shot.ownerId];
        if (shot.kind === 'explosive') { emit(state, 'explosion', { playerId: shot.ownerId, weapon: 'magnus', x: shot.x, y: shot.y, radius: shot.radius }); for (const victim of state.players) if (victim.alive && victim.team !== shot.team && dist(victim, shot) <= shot.radius + RULES.radius) damage(state, owner, victim, shot.damage, { push: shot.push, angle: Math.atan2(victim.y - shot.y, victim.x - shot.x), stun: 16, kind: 'explosion', source: shot }); alive = false; break; }
        damage(state, owner, target, shot.damage, { push: shot.push, angle: Math.atan2(shot.vy, shot.vx), stun: 8, kind: shot.kind, source: shot });
        if (!shot.pierce) { alive = false; break; }
      }
    }
    if (alive && --shot.ttl > 0) survivors.push(shot);
  }
  state.projectiles = survivors;
}
function tickBombs(state) {
  const remaining = [];
  for (const bomb of state.bombs) {
    const weapon = WEAPONS[bomb.weapon];
    if (weapon.pull) for (const target of state.players) {
      if (!target.alive || target.team === bomb.team) continue;
      const d = dist(target, bomb); if (d > weapon.radius || d < 4) continue;
      moveBody(MAPS[state.mapId], target, (bomb.x - target.x) / d * weapon.pull * DT, (bomb.y - target.y) / d * weapon.pull * DT);
    }
    if (--bomb.fuse <= 0) explode(state, bomb); else remaining.push(bomb);
  }
  state.bombs = remaining;
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
    if (point.owner === 0 && point.progress <= 0 || point.owner === 1 && point.progress >= 0) { point.owner = null; emit(state, 'pointNeutral', { pointId: point.id }); }
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
  for (const player of state.players) if (player.alive && player.team === team && dist(player, point) <= RULES.pointRadius) player.captures++;
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
  tickProjectiles(state); tickBombs(state); tickPoints(state);
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
  let moveAngle = null;
  if (target) {
    const d = dist(target, bot);
    bot.aim = Math.atan2(target.y - bot.y, target.x - bot.x) + (random(state) - .5) * .12;
    input.aim = bot.aim;
    // Choose a weapon for the range: blade close, gun mid, bomb when they crowd a point.
    const families = bot.weapons.map(id => WEAPONS[id].family);
    const onPoint = state.points.some(point => dist(point, bot) <= RULES.pointRadius && dist(point, target) <= RULES.pointRadius);
    const want = d < 90 ? 'blade' : onPoint && d < 110 ? 'bomb' : 'gun';
    const slot = families.indexOf(want);
    if (slot >= 0 && slot !== bot.slot && bot.actionTicks === 0 && !bot.charging) input[`slot${slot + 1}`] = !bot.previousInput[`slot${slot + 1}`];
    const weapon = currentWeapon(bot);
    if (weapon.family === 'bomb') input.attack = bot.charging ? bot.chargeTicks < weapon.chargeTicks + 2 : true;
    else { brain.pulse = (brain.pulse + 1) % (weapon.family === 'blade' ? 14 : weapon.interval + 2); input.attack = brain.pulse < 2; }
    // Keep a fighting distance and strafe.
    if (--brain.strafeTicks <= 0) { brain.strafeTicks = 40 + Math.floor(random(state) * 60); brain.strafe = random(state) < .5 ? -1 : 1; }
    const ideal = weapon.family === 'blade' ? 45 : weapon.family === 'gun' ? 220 : 40;
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
  if (moveAngle !== null) {
    const x = Math.cos(moveAngle), y = Math.sin(moveAngle);
    input.right = x > .38; input.left = x < -.38; input.down = y > .38; input.up = y < -.38;
  }
  return input;
}

export function getScoreboard(state) {
  return state.players.map(player => ({ id: player.id, name: player.name, team: player.team, cls: player.cls, human: player.human, kills: player.kills, deaths: player.deaths, captures: player.captures, damage: player.damage }))
    .sort((a, b) => a.team - b.team || b.captures - a.captures || b.kills - a.kills);
}
