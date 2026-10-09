/** Public weapons lab: real actors, inventory, contacts and equipment commitments. */
import { createCombatPlayer, emptyInput, emitCombatEvent, eyeHeight, traceShot, applyCombatDamage, findNearbyLoot, TICK_RATE, WORLD } from './voxel-engine.js';
import { WEAPONS } from './voxel-weapons.js';
import { MELEE_WEAPONS, clearMeleeBuffer } from './voxel-melee.js';
import { initializeInventory, storeInventoryGun, refreshInventory, inventoryCanTake } from './voxel-inventory.js';
import { DOJO_MAP } from './voxel-dojo-map.js';

export const DOJO_ACTIONS = Object.freeze(['dojoReset', 'dojoMotion', 'dojoWound', 'dojoRecover']);
export const DOJO_RESPAWN_TICKS = TICK_RATE * 2;
const valid = (catalog, value) => typeof value === 'string' && Object.hasOwn(catalog, value);
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function initializeDojo(state, config) {
  state.gameId = 'voxel-dojo'; state.map = DOJO_MAP; state.mapId = DOJO_MAP.id; state.mapName = DOJO_MAP.name;
  state.dojo = { moving: config.targetMotion === 'moving', selection: { weapon: config.weapon, melee: config.melee }, respawnAt: {}, lastEventId: 0, lastHit: null, headContacts: 0, bodyContacts: 0, resetCount: 0, recoveringAt: 0, previousActions: {} };
  for (let id = 1; id < state.players.length; id++) {
    const player = state.players[id], spawn = DOJO_MAP.targetSpawns[id - 1];
    Object.assign(player, spawn, { y: spawn.y || 0, team: 1, trainingTarget: true, lifeId: 1 });
    initializeInventory(player, { knifeOnly: true }); player.previousInput = emptyInput(player);
  }
  refreshDojoStations(state);
}
function stationLoot(state, station, kind, weapon, offset = 0) {
  const pose = station.display || { x: station.x, y: .9, z: station.z + 1.3 };
  const item = { id: ++state.lootId, kind, dojoStation: station.id, x: pose.x + offset, y: pose.y, z: pose.z };
  if (weapon) item.weapon = weapon;
  if (kind === 'weapon') { item.ammo = WEAPONS[weapon].magazine; item.reserve = WEAPONS[weapon].reserve; }
  if (kind === 'heal' || kind === 'grenade') item.amount = 2;
  state.loot.push(item);
}
export function refreshDojoStations(state, input = {}) {
  if (!state.dojo) return;
  const selection = state.dojo.selection;
  if (valid(WEAPONS, input.dojoWeapon)) selection.weapon = input.dojoWeapon;
  if (valid(MELEE_WEAPONS, input.dojoBlade)) selection.melee = input.dojoBlade;
  state.loot = (state.loot || []).filter(item => !item.dojoStation || item.dojoStation !== 'gun' && item.dojoStation !== 'blade' || item.weapon === (item.dojoStation === 'gun' ? selection.weapon : selection.melee));
  for (const station of DOJO_MAP.stations) {
    const items = state.loot.filter(item => item.dojoStation === station.id);
    if (station.id === 'gun' && !items.length) stationLoot(state, station, 'weapon', selection.weapon);
    if (station.id === 'blade' && !items.length) stationLoot(state, station, 'melee', selection.melee);
    if (station.id === 'supplies') {
      if (!items.some(item => item.kind === 'heal')) stationLoot(state, station, 'heal', null, -.35);
      if (!items.some(item => item.kind === 'grenade')) stationLoot(state, station, 'grenade', null, .35);
    }
  }
  // Dropped experimental gear is temporary. Station sources remain bounded.
  const dropped = state.loot.filter(item => !item.dojoStation);
  if (dropped.length > 24) { const retain = new Set(dropped.slice(-24).map(item => item.id)); state.loot = state.loot.filter(item => item.dojoStation || retain.has(item.id)); }
}
export function findDojoStation(state, id = null) {
  const player = state.players[0];
  if (!state.dojo || !player.alive || state.phase !== 'fight') return null;
  return DOJO_MAP.stations.find(station => {
    if (id && station.id !== id || distance(player, station) > station.radius || Math.abs(player.y - station.y) > .4) return false;
    const origin = { x: player.x, y: player.y + eyeHeight(player), z: player.z }, target = { x: station.x, y: station.y + 1.05, z: station.z };
    const dx = target.x - origin.x, dy = target.y - origin.y, dz = target.z - origin.z, length = Math.hypot(dx, dy, dz);
    if (length < 1e-6) return true;
    const hit = traceShot(state, 0, origin, { x: dx / length, y: dy / length, z: dz / length }, length, state.map);
    return hit.colliderId === null && hit.playerId === null;
  }) || null;
}
/** A rack takes precedence over discarded test gear, with ordinary reach/cover. */
export function findDojoStationLoot(state) {
  const station = findDojoStation(state); if (!station || station.id === 'recovery') return null;
  const player = state.players[0];
  const items = (state.loot || []).filter(item => item.dojoStation === station.id && (station.id !== 'supplies' || inventoryCanTake(player, item) && (item.kind === 'heal' ? player.potions < 2 : player.grenades < 2)));
  return findNearbyLoot({ ...state, loot: items }, 0, state.map);
}
function freeTargetPose(state, id) {
  const spawn = DOJO_MAP.targetSpawns[id - 1], radius = WORLD.radius;
  for (const offset of [0, 1, -1, 2, -2]) {
    const point = { ...spawn, x: spawn.x + offset, y: spawn.y || 0 };
    if (state.players.some(peer => peer.alive && peer.id !== id && Math.abs(peer.y - point.y) < WORLD.standHeight && distance(peer, point) < radius + peer.radius + .1)) continue;
    if (state.map.colliders.some(box => box.y < WORLD.standHeight && box.y + box.h > 0 && (point.x - Math.max(box.x, Math.min(box.x + box.w, point.x))) ** 2 + (point.z - Math.max(box.z, Math.min(box.z + box.d, point.z))) ** 2 < radius ** 2)) continue;
    return point;
  }
  return null;
}
function respawnTarget(state, id) {
  const pose = freeTargetPose(state, id); if (!pose) return false;
  const old = state.players[id], player = createCombatPlayer(id, 1, 'carbine');
  initializeInventory(player, { knifeOnly: true });
  Object.assign(player, pose, { team: 1, bot: true, trainingTarget: true, lifeId: (old.lifeId || 0) + 1, deaths: old.deaths, triggerBlocked: true });
  player.previousInput = emptyInput(player); state.players[id] = player; state.fighters = state.players;
  delete state.dojo.respawnAt[id]; emitCombatEvent(state, 'dojoTargetReset', { targetId: id, targetLifeId: player.lifeId }); return true;
}
export function dojoTargetInput(state, target) {
  const input = emptyInput(target);
  if (!state.dojo?.moving || !target.alive) return input;
  const spawn = DOJO_MAP.targetSpawns[target.id - 1], phase = (state.tick + target.id * 96) % 480;
  const goal = spawn.x + (phase < 240 ? 1.4 : -1.4), dx = goal - target.x, dz = spawn.z - target.z;
  const yaw = target.yaw, length = Math.hypot(dx, dz);
  if (length > .12) {
    const forward = (Math.sin(yaw) * dx - Math.cos(yaw) * dz) / length, right = (Math.cos(yaw) * dx + Math.sin(yaw) * dz) / length;
    input.up = forward > .32; input.down = forward < -.32; input.right = right > .32; input.left = right < -.32; input.walk = true;
  }
  return input;
}
function replenishReserve(player) {
  storeInventoryGun(player);
  for (const item of player.inventory || []) if (item?.kind === 'weapon') item.reserve = Math.max(item.reserve, WEAPONS[item.weapon].reserve);
  refreshInventory(player);
}
export function processDojoActions(state, input, previous) {
  if (!state.dojo || state.phase !== 'fight') return;
  refreshDojoStations(state, input);
  if (input.dojoTools === true) clearMeleeBuffer(state.players[0]);
  const pressed = action => input[action] === true && (DOJO_ACTIONS.includes(action) ? state.dojo.previousActions[action] : previous[action]) !== true;
  if (pressed('dojoMotion')) { state.dojo.moving = !state.dojo.moving; emitCombatEvent(state, 'dojoMotion', { moving: state.dojo.moving }); }
  if (pressed('dojoReset') && !state.players[0].meleeTicks && !state.players[0].parryTicks && !state.players[0].grenadeThrowTicks && !input.fire) {
    for (let id = 1; id < state.players.length; id++) { state.dojo.respawnAt[id] = state.tick; if (!state.players[id].alive) respawnTarget(state, id); else {
      // A reset is a visible sandbox command. Never materialize a new body
      // inside the player; blocked pads wait until there is legal room.
      const pose = freeTargetPose(state, id); if (pose) respawnTarget(state, id);
    } }
    state.dojo.resetCount++; state.grenades = []; state.bolts = [];
  }
  const player = state.players[0], recovering = findDojoStation(state, 'recovery');
  const idle = player.alive && player.grounded && !player.meleeTicks && !player.parryTicks && !player.healTicks && !player.reloadTicks && !player.grenadeThrowTicks && !input.fire && !input.aim;
  if (recovering && idle && (pressed('dojoRecover') || pressed('interact'))) {
    player.hp = player.maxHp; player.stamina = 100; player.staminaRegenTicks = 0; player.sprintExhausted = false;
    emitCombatEvent(state, 'dojoRecovery', { playerId: 0, hp: player.hp });
  } else if (recovering && idle && pressed('dojoWound') && player.hp > 60) {
    applyCombatDamage(state, [{ playerId: null, targetId: 0, damage: 60, attack: 'training', weapon: null }]);
    emitCombatEvent(state, 'dojoHealingTest', { playerId: 0, hp: player.hp });
  }
  state.dojo.previousActions = Object.fromEntries(DOJO_ACTIONS.map(action => [action, input[action] === true]));
}
export function advanceDojo(state) {
  const dojo = state.dojo, player = state.players[0];
  for (const event of state.events) {
    if (event.id <= dojo.lastEventId) continue;
    if (event.type === 'damage' && event.playerId === 0 && event.targetId > 0 && event.damage > 0) {
      const target = state.players[event.targetId], kind = event.hitKind === 'head' ? 'head' : event.hitKind === 'leg' ? 'leg' : 'body';
      dojo.lastHit = { damage: event.damage, kind, weapon: event.weapon || event.attack, targetId: event.targetId, distance: Math.hypot(target.x - player.x, target.y - player.y, target.z - player.z), hp: event.hp, tick: event.tick };
      if (kind === 'head') dojo.headContacts++; else dojo.bodyContacts++;
    }
    dojo.lastEventId = event.id;
  }
  for (let id = 1; id < state.players.length; id++) {
    const target = state.players[id];
    if (!target.alive && !dojo.respawnAt[id]) dojo.respawnAt[id] = state.tick + DOJO_RESPAWN_TICKS;
    if (dojo.respawnAt[id] && state.tick >= dojo.respawnAt[id]) respawnTarget(state, id);
  }
  if (!player.alive) {
    if (!dojo.recoveringAt) dojo.recoveringAt = state.tick + DOJO_RESPAWN_TICKS;
    if (state.tick >= dojo.recoveringAt && !state.players.some(peer => peer.id > 0 && peer.alive && distance(peer, DOJO_MAP.playerSpawn) < .9)) {
      const fresh = createCombatPlayer(0, 1, dojo.selection.weapon);
      initializeInventory(fresh, { weapon: dojo.selection.weapon, melee: dojo.selection.melee });
      Object.assign(fresh, DOJO_MAP.playerSpawn, { lifeId: (player.lifeId || 0) + 1, kills: player.kills, shots: player.shots, damageDealt: player.damageDealt, deaths: player.deaths, triggerBlocked: true });
      state.players[0] = fresh; state.fighters = state.players; dojo.recoveringAt = 0;
      state.practice.inputFence = ['fire', 'aim', 'jump', 'interact', 'grenade', 'heal', 'swap', 'reload'];
      emitCombatEvent(state, 'dojoPlayerReset', { playerId: 0, hp: fresh.hp });
    }
  } else replenishReserve(player);
  refreshDojoStations(state);
}
