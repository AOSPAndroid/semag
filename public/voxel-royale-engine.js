/** Voxel Royale: one-life scavenging rules around the shared Breach combat simulation. */
import { MAPS, MAP_IDS } from './voxel-royale-maps.js';
import { WEAPONS, WEAPON_IDS } from './voxel-weapons.js';
import { MELEE_IDS, resetMeleeDefense } from './voxel-melee.js';
import { TICK_RATE, INPUT_KEYS, emptyInput, WORLD, eyeHeight, rayBox, createCombatPlayer, combatStep, applyCombatDamage, emitCombatEvent, pickupCombatLoot, dropCombatInventory, resetSprint } from './voxel-engine.js';
import { initializeInventory, ensureInventory, inventoryCanTake } from './voxel-inventory.js';
export { MAPS, MAP_IDS, WEAPONS, INPUT_KEYS, emptyInput, TICK_RATE };

export const ROYALE = Object.freeze({ maxPlayers: 10, minPlayers: 2, countdownTicks: 3 * TICK_RATE, pickupRadius: 1.7, pickupHeight: 1.2, potionCapacity: 2, grenadeCapacity: 2, maxLoot: 128, eventLimit: 256 });
// Every contraction is announced before it moves. The last circle disappears
// after four minutes, so even perfectly overlapping final survivors resolve.
export const STORM_STAGES = Object.freeze([
  { wait: 30, shrink: 30, ratio: .72, damage: 2 },
  { wait: 20, shrink: 25, ratio: .46, damage: 4 },
  { wait: 15, shrink: 25, ratio: .26, damage: 7 },
  { wait: 15, shrink: 25, ratio: .12, damage: 11 },
  { wait: 10, shrink: 25, ratio: .035, damage: 17 },
  { wait: 5, shrink: 15, ratio: 0, damage: 25 },
].map(stage => Object.freeze(stage)));
const EPS = 1e-8;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const seedValue = seed => Number.isInteger(seed) ? seed >>> 0 : ((Date.now() ^ Math.floor(Math.random() * 0x100000000)) >>> 0);

function random(state) {
  let value = state.randomState >>> 0;
  value ^= value << 13; value ^= value >>> 17; value ^= value << 5;
  state.randomState = value >>> 0;
  return state.randomState / 0x100000000;
}
function shuffled(state, items) {
  const result = items.slice();
  for (let index = result.length - 1; index > 0; index--) {
    const swap = Math.floor(random(state) * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}
function inactivePlayer(id) {
  const player = { ...createCombatPlayer(id), team: id, alive: false, hp: 0, slot: 'sword', meleeWeapon: 'knife', hasGun: false, ammo: 0, reserve: 0, potions: 0, grenades: 0, participating: false, inventoryDropped: false };
  return initializeInventory(player, { knifeOnly: true });
}
function initialStorm(arena) {
  const center = arena.stormCenter || { x: (arena.bounds.minX + arena.bounds.maxX) / 2, z: (arena.bounds.minZ + arena.bounds.maxZ) / 2 };
  const radius = Math.max(...[arena.bounds.minX, arena.bounds.maxX].flatMap(x => [arena.bounds.minZ, arena.bounds.maxZ].map(z => Math.hypot(x - center.x, z - center.z)))) + WORLD.radius;
  return { x: center.x, z: center.z, radius, initialRadius: radius, stage: 0, mode: 'waiting', active: false, nextRadius: radius * STORM_STAGES[0].ratio, ticksUntilShrink: STORM_STAGES[0].wait * TICK_RATE, ticksUntilNext: (STORM_STAGES[0].wait + STORM_STAGES[0].shrink) * TICK_RATE, damagePerSecond: STORM_STAGES[0].damage };
}
export function createState({ mapId = 'forest', capacity = ROYALE.maxPlayers, seed } = {}) {
  if (!Object.hasOwn(MAPS, mapId)) throw new RangeError('Unknown Voxel Royale map.');
  if (!Number.isInteger(capacity) || capacity < ROYALE.minPlayers || capacity > ROYALE.maxPlayers) throw new RangeError('Voxel Royale capacity must be between 2 and 10.');
  const players = Array.from({ length: ROYALE.maxPlayers }, (_, id) => inactivePlayer(id)), initialSeed = seedValue(seed);
  return { gameId: 'voxel-royale', mapId, mapName: MAPS[mapId].name, map: MAPS[mapId], capacity, seed: initialSeed, randomState: initialSeed || 0x9e3779b9, matchId: 0, round: 0, tick: 0, matchTicks: 0, phase: 'lobby', phaseTicks: 0, roundTicks: 240 * TICK_RATE, participantIds: [], aliveCount: 0, winner: null, winnerId: null, roundWinner: null, roundReason: null, placements: [], players, fighters: players, loot: [], lootId: 0, grenades: [], grenadeId: 0, maxGrenades: ROYALE.maxPlayers * ROYALE.grenadeCapacity, bolts: [], boltId: 0, events: [], eventId: 0, eventLimit: ROYALE.eventLimit, storm: initialStorm(MAPS[mapId]), objective: 'The host can start with 2–10 players. Scavenge a weapon and be the last survivor.' };
}
/** Static geometry stays shared when copying gameplay state and never bloats a snapshot. */
export function cloneState(state) {
  const copy = JSON.parse(JSON.stringify({ ...state, map: undefined, fighters: undefined }));
  copy.map = state.map || MAPS[state.mapId]; copy.fighters = copy.players;
  return copy;
}
export function resetLobby(state) {
  const { tick, eventId, matchId, seed } = state;
  Object.assign(state, createState({ mapId: state.mapId, capacity: state.capacity, seed }), { tick, eventId, matchId, round: matchId });
  return state;
}
function safeSpawn(arena, point) {
  if (![point?.x, point?.y, point?.z].every(Number.isFinite) || point.y < 0) return false;
  const radius = WORLD.radius, { bounds } = arena;
  if (point.x < bounds.minX + radius || point.x > bounds.maxX - radius || point.z < bounds.minZ + radius || point.z > bounds.maxZ - radius) return false;
  return !arena.colliders.some(box => {
    if (point.y >= box.y + box.h - EPS || point.y + WORLD.standHeight <= box.y + EPS) return false;
    const dx = point.x - clamp(point.x, box.x, box.x + box.w), dz = point.z - clamp(point.z, box.z, box.z + box.d);
    return dx * dx + dz * dz < radius * radius - EPS;
  });
}
function addLoot(state, details) {
  if (state.loot.length >= ROYALE.maxLoot || ![details.x, details.y, details.z].every(Number.isFinite)) return null;
  const loot = { id: ++state.lootId, ...details, ...(Number.isInteger(details.droppedBy) ? { falling: true, vy: 0 } : {}) };
  state.loot.push(loot); return loot;
}
function seedLoot(state) {
  const points = shuffled(state, state.map.lootPoints).slice(0, ROYALE.maxLoot);
  const blades = shuffled(state, MELEE_IDS.filter(id => id !== 'knife'));
  let weapons = shuffled(state, WEAPON_IDS);
  // Scavenge a varied subset each round. Expanding the catalogue must never
  // consume the healing, ammunition, grenades or four non-knife blade caches.
  const gunBudget = Math.max(0, points.length - blades.length - 8);
  const gunCount = Math.min(gunBudget, Math.max(ROYALE.maxPlayers, Math.ceil(points.length * .44)));
  if (state.map.combatStyle === 'close') {
    const shotgunIds = WEAPON_IDS.filter(id => WEAPONS[id].category === 'shotgun'
      || id === 'shotgun' || id === 'autoshotgun' || id === 'slugshotgun');
    const closeGuns = shuffled(state, shotgunIds).slice(0, Math.min(2, gunCount));
    weapons = [...closeGuns, ...weapons.filter(id => !closeGuns.includes(id))];
  }
  const ammoWeapons = weapons.slice(0, Math.min(gunCount, weapons.length));
  for (let index = 0; index < points.length; index++) {
    const point = points[index], position = { x: point.x, y: point.y, z: point.z };
    // At least one gun per possible participant is present on shipped maps;
    // all catalogue entries remain reachable through the deterministic shuffle.
    if (index < gunCount) {
      const weapon = weapons[index % weapons.length], stats = WEAPONS[weapon];
      addLoot(state, { ...position, kind: 'weapon', weapon, ammo: stats.magazine, reserve: Math.min(stats.reserve, stats.magazine * 2) });
    } else if (index < gunCount + blades.length) {
      addLoot(state, { ...position, kind: 'melee', weapon: blades[index - gunCount] });
    } else {
      const tail = index - gunCount - blades.length, scheduled = ['heal', 'ammo', 'heal', 'grenade'][tail % 4];
      const kind = tail >= 8 && (point.kind === 'heal' || point.kind === 'ammo' || point.kind === 'grenade') ? point.kind : scheduled;
      if (kind === 'ammo') { const weapon = ammoWeapons[tail % ammoWeapons.length]; addLoot(state, { ...position, kind, weapon, amount: WEAPONS[weapon].magazine }); }
      else addLoot(state, { ...position, kind, amount: 1 });
    }
  }
}
export function startMatch(state, participantIds) {
  if (!Array.isArray(participantIds) || participantIds.length < ROYALE.minPlayers || participantIds.length > state.capacity || new Set(participantIds).size !== participantIds.length || participantIds.some(id => !Number.isInteger(id) || id < 0 || id >= ROYALE.maxPlayers)) throw new RangeError('A Royale match requires 2–10 unique connected player slots.');
  const spawnPoints = (state.map || MAPS[state.mapId]).spawnPoints.filter(point => safeSpawn(state.map || MAPS[state.mapId], point));
  if (spawnPoints.length < participantIds.length) throw new RangeError('This map does not have enough safe spawn points.');
  const { tick, eventId, seed } = state, matchId = state.matchId + 1;
  Object.assign(state, createState({ mapId: state.mapId, capacity: state.capacity, seed }), { tick, eventId, matchId, round: matchId, randomState: ((seed ^ Math.imul(matchId, 0x9e3779b9)) >>> 0) || 0x85ebca6b });
  state.participantIds = participantIds.slice().sort((a, b) => a - b);
  const spawns = shuffled(state, spawnPoints);
  for (let index = 0; index < state.participantIds.length; index++) {
    const id = state.participantIds[index], player = state.players[id], spawn = spawns[index];
    Object.assign(player, { ...spawn, yaw: finite(spawn.yaw), alive: true, hp: player.maxHp, participating: true });
    player.previousInput = emptyInput(player);
  }
  seedLoot(state); state.aliveCount = state.participantIds.length; state.phase = 'countdown'; state.phaseTicks = ROYALE.countdownTicks;
  state.objective = 'One life. Start with a small knife; search structures for weapons and supplies.';
  emitCombatEvent(state, 'matchStart', { matchId, participantIds: [...state.participantIds], mapId: state.mapId });
  return state;
}
function canTakeLoot(player, loot) {
  return loot.kind === 'ammo' ? inventoryCanTake(player, loot) : ['weapon', 'melee', 'heal', 'grenade'].includes(loot.kind);
}
/** Pure prompt/pickup predicate: no through-wall or vertically remote supplies. */
export function findNearbyLoot(state, playerId) {
  const player = state.players[playerId], arena = state.map || MAPS[state.mapId];
  if (!player?.alive || state.phase !== 'fight' || !arena) return null;
  const origin = { x: player.x, y: player.y + eyeHeight(player), z: player.z };
  let nearest = null, nearestDistance = ROYALE.pickupRadius + EPS;
  for (const loot of state.loot || []) {
    if (![loot.x, loot.y, loot.z].every(Number.isFinite) || !canTakeLoot(player, loot) || Math.abs(player.y - loot.y) > ROYALE.pickupHeight) continue;
    const horizontal = Math.hypot(player.x - loot.x, player.z - loot.z);
    if (horizontal > nearestDistance) continue;
    const dx = loot.x - origin.x, dy = loot.y + .3 - origin.y, dz = loot.z - origin.z, distance = Math.hypot(dx, dy, dz);
    const direction = distance > EPS ? { x: dx / distance, y: dy / distance, z: dz / distance } : { x: 0, y: 0, z: 0 };
    if (distance > EPS && arena.colliders.some(box => { const contact = rayBox(origin, direction, box, distance); return contact !== null && contact < distance - EPS; })) continue;
    if (!nearest || horizontal < nearestDistance - EPS || (Math.abs(horizontal - nearestDistance) <= EPS && loot.id < nearest.id)) { nearest = loot; nearestDistance = horizontal; }
  }
  return nearest;
}
function pickup(state, player, loot, input) {
  return pickupCombatLoot(state, player, loot, input);
}
function dropInventory(state, player) {
  if (player.inventoryDropped) return;
  player.inventoryDropped = true; dropCombatInventory(state, player);
}
function advanceDroppedLoot(state) {
  const arena = state.map || MAPS[state.mapId], radius = .12;
  for (const loot of state.loot) {
    if (!loot.falling) continue;
    const oldY = loot.y; loot.vy = finite(loot.vy) - WORLD.gravity / TICK_RATE;
    const nextY = oldY + loot.vy / TICK_RATE; let floor = 0;
    for (const box of arena.colliders) {
      const top = box.y + box.h;
      if (top > oldY + EPS || top < nextY - EPS) continue;
      const dx = loot.x - clamp(loot.x, box.x, box.x + box.w), dz = loot.z - clamp(loot.z, box.z, box.z + box.d);
      if (dx * dx + dz * dz < radius * radius) floor = Math.max(floor, top);
    }
    if (nextY <= floor) { loot.y = floor; loot.vy = 0; loot.falling = false; }
    else loot.y = nextY;
  }
}
function recordEliminations(state, previouslyAlive, reason) {
  const alive = state.participantIds.filter(id => state.players[id].alive).length;
  for (const id of previouslyAlive) {
    const player = state.players[id];
    if (player.alive || state.placements.some(entry => entry.playerId === id)) continue;
    dropInventory(state, player);
    state.placements.push({ playerId: id, place: Math.max(2, alive + 1), reason: reason || 'elimination' });
  }
  state.aliveCount = alive;
}
function finishMatch(state, winnerId, reason) {
  if (state.phase === 'matchEnd' || state.phase === 'lobby') return;
  state.phase = 'matchEnd'; state.phaseTicks = 0; state.winner = state.winnerId = state.roundWinner = winnerId; state.roundReason = reason;
  state.grenades = []; state.bolts = [];
  for (const player of state.players) {Object.assign(player, { vx: 0, vy: 0, vz: 0, knockbackX: 0, knockbackZ: 0, knockbackTicks: 0, knockbackReadyTicks: 0, hitStunTicks: 0, hitStunReadyTicks: 0, jumpBufferTicks: 0, reloadTicks: 0, burstRemaining: 0, spinTicks: 0, aiming: false, aimTicks: 0, healing: false, healTicks: 0, grenadeThrowTicks: 0, meleeTicks: 0, meleePhase: 'idle', meleeHitIds: [], meleeHitLives: [], meleeStartTick: 0, interaction: null, interactTicks: 0 });resetSprint(player,{refill:player.alive});resetMeleeDefense(player, { blockAim: true });}
  if (winnerId !== null) state.placements.push({ playerId: winnerId, place: 1, reason: 'survivor' });
  state.objective = winnerId === null ? 'No survivors. The host can start a new expedition.' : 'Last survivor standing. The host can start a new expedition.';
  emitCombatEvent(state, 'matchEnd', { winner: winnerId, winnerId, reason, placements: state.placements.map(entry => ({ ...entry })) });
}
function resolveMatch(state) {
  if (!['countdown', 'fight'].includes(state.phase)) return;
  const survivors = state.participantIds.filter(id => state.players[id].alive);
  state.aliveCount = survivors.length;
  if (survivors.length <= 1) finishMatch(state, survivors[0] ?? null, survivors.length ? 'lastSurvivor' : 'noSurvivors');
}
function advanceStorm(state) {
  const storm = state.storm, previousStage = storm.stage, previousMode = storm.mode;
  let elapsed = state.matchTicks, previousRadius = storm.initialRadius;
  for (let index = 0; index < STORM_STAGES.length; index++) {
    const stage = STORM_STAGES[index], waitTicks = stage.wait * TICK_RATE, shrinkTicks = stage.shrink * TICK_RATE, duration = waitTicks + shrinkTicks;
    if (elapsed < duration) {
      const shrinking = elapsed >= waitTicks, progress = shrinking ? (elapsed - waitTicks) / shrinkTicks : 0, nextRadius = storm.initialRadius * stage.ratio;
      Object.assign(storm, { stage: index, mode: shrinking ? 'shrinking' : 'waiting', radius: previousRadius + (nextRadius - previousRadius) * progress, nextRadius, ticksUntilShrink: Math.max(0, waitTicks - elapsed), ticksUntilNext: duration - elapsed, damagePerSecond: stage.damage, active: true });
      break;
    }
    elapsed -= duration; previousRadius = storm.initialRadius * stage.ratio;
    if (index === STORM_STAGES.length - 1) Object.assign(storm, { stage: STORM_STAGES.length, mode: 'final', radius: 0, nextRadius: 0, ticksUntilShrink: 0, ticksUntilNext: 0, damagePerSecond: stage.damage, active: true });
  }
  if (storm.stage !== previousStage || storm.mode !== previousMode) emitCombatEvent(state, 'stormStage', { ...storm });
  if (state.matchTicks % TICK_RATE !== 0) return [];
  // Combat evaluates this after physical movement, before applying its damage
  // batch or completing a potion. Crossing into safety on a pulse really saves.
  return snapshot => snapshot.participantIds.filter(id => snapshot.players[id].alive && (storm.mode === 'final' || Math.hypot(snapshot.players[id].x - storm.x, snapshot.players[id].z - storm.z) > storm.radius)).map(targetId => ({ playerId: null, targetId, damage: storm.damagePerSecond, hitKind: 'body', headshot: false, attack: 'storm', weapon: null }));
}
/** A disconnected participant loses their one life without granting anybody a kill. */
export function eliminateParticipant(state, playerId) {
  const player = state.players[playerId];
  if (!player?.alive || !player.participating || !['countdown', 'fight'].includes(state.phase)) return state;
  applyCombatDamage(state, [{ playerId: null, targetId: playerId, damage: player.hp, hitKind: 'body', headshot: false, attack: 'disconnect', weapon: null }]);
  recordEliminations(state, [playerId], 'disconnect'); resolveMatch(state); return state;
}
export function step(state, rawInputs = []) {
  state.tick++;
  if (state.phase === 'lobby' || state.phase === 'matchEnd') return state;
  if (state.phase === 'countdown') {
    for (const player of state.players) {
      const raw = rawInputs[player.id], input = { ...emptyInput(player), ...Object.fromEntries(INPUT_KEYS.map(key => [key, raw?.[key] === true])), yaw: clamp(finite(raw?.yaw, player.yaw), -Math.PI, Math.PI), pitch: clamp(finite(raw?.pitch, player.pitch), -1.35, 1.35) };
      player.yaw = input.yaw; player.pitch = input.pitch; player.previousInput = input;
    }
    if (--state.phaseTicks <= 0) {
      state.phase = 'fight'; state.phaseTicks = 0; state.storm.active = true;
      for (const player of state.players) player.triggerBlocked = player.previousInput.fire;
      state.objective = 'Scavenge supplies, stay inside the ring, and eliminate the other survivors.';
      emitCombatEvent(state, 'fight', { matchId: state.matchId });
    }
    resolveMatch(state); return state;
  }
  if (state.phase !== 'fight') return state;
  state.matchTicks++; state.roundTicks = Math.max(0, 240 * TICK_RATE - state.matchTicks);
  const previouslyAlive = state.participantIds.filter(id => state.players[id].alive);
  const inputs = state.players.map(player => { ensureInventory(player); return { ...(rawInputs[player.id] || {}), swap: player.hasGun && rawInputs[player.id]?.swap === true }; });
  for (const player of state.players) {
    const input = inputs[player.id];
    if (player.alive && input.interact === true && !player.previousInput.interact && !player.healTicks && !player.reloadTicks && !player.meleeTicks && !player.grenadeThrowTicks && input.fire !== true) {
      const loot = findNearbyLoot(state, player.id);
      if (loot) pickup(state, player, loot, input);
    }
  }
  const stormDamage = advanceStorm(state);
  combatStep(state, inputs, state.map || MAPS[state.mapId], { additionalDamage: stormDamage });
  recordEliminations(state, previouslyAlive); advanceDroppedLoot(state); resolveMatch(state);
  return state;
}
