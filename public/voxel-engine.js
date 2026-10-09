/** Voxel Breach: shared, deterministic 120 Hz tactical first-person simulation. */
import { throwGrenade, advanceGrenades } from './voxel-ordnance.js';
import { MAPS } from './voxel-maps.js';
import { WEAPONS, weaponDamage, weaponSpread, weaponHand } from './voxel-weapons.js';
import { launchBolt, advanceBolts, MAX_BOLTS } from './voxel-projectiles.js';
import { MELEE, KNIFE, MELEE_WEAPONS, meleeProfile, meleeWeaponId, meleeHand, meleeSlashOrigin, meleeSlashPhase, meleeSlashGeometry, meleeSegmentBoxContact } from './voxel-melee.js';
import { recordLagCompensation, traceCompensatedShot } from './voxel-lag-compensation.js';
import { monsterBodyProfile, monsterBodyBoxes, monsterMovementSpeed, monsterMovementMultiplier } from './voxel-monster-bodies.js';
import { INVENTORY_ACTIONS, initializeInventory, ensureInventory, refreshInventory, selectedInventoryItem, selectInventorySlot, storeInventoryGun, tickHolsteredInventory, consumeInventoryStack, pickupInventoryItem, inventoryCanTake, dropInventoryItem, lootFromInventoryItem, setInventoryLoadout, setInventoryMeleeLoadout } from './voxel-inventory.js';
export { MAPS, WEAPONS };
export { MELEE, KNIFE, MELEE_WEAPONS, meleeProfile, meleeWeaponId };
export const TICK_RATE = 120;
// Keep every pellet contact from a six-player shotgun volley through the next
// network snapshot, including utility and damage feedback in the same interval.
export const EVENT_LIMIT = 160;
export const WORLD = Object.freeze({ radius: .32, standHeight: 1.8, crouchHeight: 1.15, eyeHeight: 1.62, crouchEyeHeight: .98, gravity: 18.4, jumpSpeed: 6.4, jumpBufferTicks: 10, roundSeconds: 100, bombSeconds: 35, plantSeconds: 3, defuseSeconds: 5, buySeconds: 8, winsToMatch: 4 });
export const INPUT_KEYS = Object.freeze(['up', 'down', 'left', 'right', 'jump', 'crouch', 'walk', 'fire', 'reload', 'interact', 'aim', 'swap', 'grenade', 'heal', ...INVENTORY_ACTIONS]);
export const ADS = Object.freeze({ ticks: 18, speedMultiplier: .65, spreadMultiplier: .4, recoilMultiplier: .62, fovRatio: 54 / 70, scopedFovRatio: 40 / 70 });
export const PLAYER_HEALTH = 200;
export const HEAL = Object.freeze({ ticks: 240, amount: 60, speedMultiplier: .3 });
export const KNOCKBACK = Object.freeze({ decay: 10, maxMonsterSpeed: 10, maxPlayerSpeed: 2.4, monsterTicks: 36, playerTicks: 24, monsterReadyTicks: 12, playerReadyTicks: 24 });
const EPS = 1e-8, DT = 1 / TICK_RATE;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const eyeHeight = player => monsterBodyProfile(player)?.eyeHeight ?? (player.crouching ? WORLD.crouchEyeHeight : WORLD.eyeHeight);
export const playerHeight = player => monsterBodyProfile(player)?.height ?? (player.crouching ? WORLD.crouchHeight : WORLD.standHeight);
export const emptyInput = (aim = {}) => ({ ...Object.fromEntries(INPUT_KEYS.map(key => [key, false])), yaw: Number.isFinite(aim.yaw) ? clamp(aim.yaw, -Math.PI, Math.PI) : 0, pitch: Number.isFinite(aim.pitch) ? clamp(aim.pitch, -1.35, 1.35) : 0 });
export function cloneState(state) { const copy = JSON.parse(JSON.stringify(state)); if (copy.players) copy.fighters = copy.players; return copy; }
export function createCombatPlayer(id, teamSize = 1, loadout = 'carbine') {
  const weapon = typeof loadout === 'string' && Object.hasOwn(WEAPONS, loadout) ? loadout : 'carbine', w = WEAPONS[weapon];
  const player = { id, team: Math.floor(id / teamSize), x: 0, y: 0, z: 0, yaw: 0, pitch: 0, vx: 0, vy: 0, vz: 0, knockbackX: 0, knockbackZ: 0, knockbackTicks: 0, knockbackReadyTicks: 0, radius: WORLD.radius, grounded: true, jumpBufferTicks: 0, crouching: false, alive: true, hp: PLAYER_HEALTH, maxHp: PLAYER_HEALTH, weapon, slot: 'primary', meleeWeapon: 'knife', meleeLoadout: 'knife', ammo: w.magazine, reserve: w.reserve, reloadTicks: 0, shotCooldown: 0, burstRemaining: 0, spinTicks: 0, recoil: 0, heat: 0, shotIndex: 0, lastShotHand: 0, pendingFireTicks: 0, shots: 0, kills: 0, deaths: 0, damageDealt: 0, lastHitTick: -1000, triggerBlocked: false, aiming: false, aimTicks: 0, meleeTicks: 0, meleeCooldown: 0, meleeIndex: 0, meleeHand: 0, meleeYaw: 0, meleePitch: 0, meleeStartTick: 0, meleePhase: 'idle', meleeHitIds: [], meleeHitLives: [], healing: false, healTicks: 0, healStartTick: -1, potions: 1, grenades: 1, grenadeThrowTicks: 0, interaction: null, interactTicks: 0, previousInput: emptyInput() };
  return initializeInventory(player, { weapon });
}
const newPlayer = createCombatPlayer;
function freshBomb() { return { status: 'carried', carrierId: 0, x: 0, y: 0, z: 0, vy: 0, siteId: null, plantPlayerId: null, plantTicks: 0, defusePlayerId: null, defuseTicks: 0, timerTicks: 0 }; }
export function createState({ teamSize = 1, mapId = 'courtyard' } = {}) {
  if (![1, 2, 3].includes(teamSize)) throw new RangeError('teamSize must be 1, 2 or 3.');
  if (!Object.hasOwn(MAPS, mapId)) throw new RangeError('Unknown Voxel Breach map.');
  const players = Array.from({ length: teamSize * 2 }, (_, id) => newPlayer(id, teamSize));
  const state = { gameId: 'voxel-breach', teamSize, capacity: teamSize * 2, mapId, mapName: MAPS[mapId].name, tick: 0, phase: 'lobby', phaseTicks: 0, round: 1, maxRounds: 7, roundTicks: WORLD.roundSeconds * TICK_RATE, scores: [0, 0], attackTeam: 0, winner: null, roundWinner: null, roundReason: null, players, fighters: players, bomb: freshBomb(), grenades: [], grenadeId: 0, bolts: [], boltId: 0, loot: [], lootId: 0, events: [], eventId: 0, objective: 'Attackers plant at A or B. Defenders deny the plant or defuse. First to four rounds.' };
  spawnPlayers(state, false); return state;
}
export function emitCombatEvent(state, type, data = {}) {
  const limit = Number.isInteger(state.eventLimit) ? clamp(state.eventLimit, EVENT_LIMIT, 256) : EVENT_LIMIT;
  state.events.push({ id: ++state.eventId, tick: state.tick, type, ...data });
  if (state.events.length > limit) state.events.splice(0, state.events.length - limit);
}
const emit = emitCombatEvent;
function spawnPlayers(state, preserveStats = true) {
  const arena = MAPS[state.mapId];
  state.players = state.players.map(old => {
    const f = newPlayer(old.id, state.teamSize, old.weapon), side = f.team === state.attackTeam ? 0 : 1, spawn = arena.spawns[side][f.id % state.teamSize];
    f.meleeLoadout = typeof old.meleeLoadout === 'string' && Object.hasOwn(MELEE_WEAPONS, old.meleeLoadout) ? old.meleeLoadout : 'knife'; setInventoryMeleeLoadout(f, f.meleeLoadout);
    Object.assign(f, spawn); f.previousInput = emptyInput(spawn);
    if (preserveStats) for (const key of ['kills', 'deaths', 'damageDealt', 'shots']) f[key] = old[key];
    return f;
  });
  state.fighters = state.players;
  state.grenades = []; state.bolts = []; state.boltId = 0; state.loot = [];
  state.bomb = freshBomb(); state.bomb.carrierId = state.players.find(f => f.team === state.attackTeam).id; const carrier = state.players[state.bomb.carrierId];
  Object.assign(state.bomb, { x: carrier.x, y: carrier.y, z: carrier.z });
}
function prepareRound(state, countdown = TICK_RATE * 2) {
  state.attackTeam = state.round <= 3 ? 0 : 1; spawnPlayers(state);
  state.phase = 'countdown'; state.phaseTicks = countdown; state.roundTicks = WORLD.roundSeconds * TICK_RATE; state.roundWinner = null; state.roundReason = null;
  state.objective = 'Choose a weapon. Attackers carry the charge to site A or B.';
  emit(state, 'round', { round: state.round, attackTeam: state.attackTeam, mapId: state.mapId });
}
export function startMatch(state) {
  const tick = state.tick, eventId = state.eventId, loadouts = state.players.map(f => f.weapon), blades = state.players.map(f => f.meleeLoadout || 'knife');
  const fresh = createState({ teamSize: state.teamSize, mapId: state.mapId }); Object.assign(state, fresh, { tick, eventId });
  for (const f of state.players) { f.weapon = loadouts[f.id] || 'carbine'; f.meleeLoadout = blades[f.id] || 'knife'; setInventoryMeleeLoadout(f, f.meleeLoadout); } prepareRound(state, 3 * TICK_RATE); return state;
}
export function resetLobby(state) {
  const tick = state.tick, eventId = state.eventId, loadouts = state.players.map(f => f.weapon), blades = state.players.map(f => f.meleeLoadout || 'knife');
  Object.assign(state, createState({ teamSize: state.teamSize, mapId: state.mapId }), { tick, eventId });
  for (const f of state.players) { setInventoryLoadout(f, loadouts[f.id] || 'carbine'); f.meleeLoadout = blades[f.id] || 'knife'; setInventoryMeleeLoadout(f, f.meleeLoadout); }
  return state;
}
export function selectLoadout(state, playerId, weaponId) {
  const f = state.players[playerId];
  if (!f || !Number.isInteger(playerId)) return { ok: false, changed: false, error: 'Unknown player.' };
  if (typeof weaponId !== 'string' || !Object.hasOwn(WEAPONS, weaponId)) return { ok: false, changed: false, error: 'Choose a weapon from the loadout list.' };
  if (!['lobby', 'countdown', 'buy', 'roundEnd'].includes(state.phase)) return { ok: false, changed: false, error: 'Weapons can be changed between rounds.' };
  if (f.hasGun && f.weapon === weaponId) return { ok: true, changed: false };
  setInventoryLoadout(f, weaponId);
  emit(state, 'loadout', { playerId, weapon: weaponId }); return { ok: true, changed: true };
}
export const setLoadout = selectLoadout;
export function selectMeleeLoadout(state, playerId, weaponId) {
  const f = state.players[playerId];
  if (!f || !Number.isInteger(playerId)) return { ok: false, changed: false, error: 'Unknown player.' };
  if (typeof weaponId !== 'string' || !Object.hasOwn(MELEE_WEAPONS, weaponId)) return { ok: false, changed: false, error: 'Choose a close-combat weapon from the loadout list.' };
  if (!['lobby', 'countdown', 'buy', 'roundEnd'].includes(state.phase)) return { ok: false, changed: false, error: 'Close-combat weapons can be changed between rounds.' };
  if (f.meleeLoadout === weaponId && f.inventory?.[0]?.kind === 'melee' && f.inventory[0].weapon === weaponId) return { ok: true, changed: false };
  f.meleeLoadout = weaponId; setInventoryMeleeLoadout(f, weaponId);
  emit(state, 'meleeLoadout', { playerId, weapon: weaponId }); return { ok: true, changed: true };
}
function readInput(player, raw) {
  const input = Object.fromEntries(INPUT_KEYS.map(key => [key, raw?.[key] === true]));
  input.yaw = Number.isFinite(raw?.yaw) ? clamp(raw.yaw, -Math.PI, Math.PI) : player.yaw;
  input.pitch = Number.isFinite(raw?.pitch) ? clamp(raw.pitch, -1.35, 1.35) : player.pitch;
  return input;
}
function circleRectOverlap(x, z, radius, rect) { const dx = x - clamp(x, rect.x, rect.x + rect.w), dz = z - clamp(z, rect.z, rect.z + rect.d); return dx * dx + dz * dz < radius * radius - EPS; }
/** Exact swept disc against a rectangle; corner contacts are circular, not padded squares. */
function sweepRect(x, z, dx, dz, rect, radius) {
  const contacts = [];
  const accept = (t, nx, nz) => { if (t >= -EPS && t <= 1 + EPS && dx * nx + dz * nz < -EPS) contacts.push({ t: clamp(t, 0, 1), nx, nz }); };
  if (dx > EPS) { const t = (rect.x - radius - x) / dx, at = z + dz * t; if (at >= rect.z - EPS && at <= rect.z + rect.d + EPS) accept(t, -1, 0); }
  if (dx < -EPS) { const t = (rect.x + rect.w + radius - x) / dx, at = z + dz * t; if (at >= rect.z - EPS && at <= rect.z + rect.d + EPS) accept(t, 1, 0); }
  if (dz > EPS) { const t = (rect.z - radius - z) / dz, at = x + dx * t; if (at >= rect.x - EPS && at <= rect.x + rect.w + EPS) accept(t, 0, -1); }
  if (dz < -EPS) { const t = (rect.z + rect.d + radius - z) / dz, at = x + dx * t; if (at >= rect.x - EPS && at <= rect.x + rect.w + EPS) accept(t, 0, 1); }
  const a = dx * dx + dz * dz;
  if (a > EPS * EPS) for (const cx of [rect.x, rect.x + rect.w]) for (const cz of [rect.z, rect.z + rect.d]) {
    const ox = x - cx, oz = z - cz, b = 2 * (ox * dx + oz * dz), c = ox * ox + oz * oz - radius * radius, disc = b * b - 4 * a * c;
    if (disc < 0) continue;
    const t = (-b - Math.sqrt(disc)) / (2 * a), px = x + dx * t, pz = z + dz * t;
    if ((cx === rect.x ? px <= cx + EPS : px >= cx - EPS) && (cz === rect.z ? pz <= cz + EPS : pz >= cz - EPS)) {
      const length = Math.hypot(px - cx, pz - cz); if (length > EPS) accept(t, (px - cx) / length, (pz - cz) / length);
    }
  }
  return contacts.sort((a, b) => a.t - b.t)[0] || null;
}
function bodyOverlapsBox(f, rect, height = playerHeight(f)) { return f.y < rect.y + rect.h - EPS && f.y + height > rect.y + EPS && circleRectOverlap(f.x, f.z, f.radius, rect); }
function bodyOverlapsPlayer(f, peer, height = playerHeight(f)) {
  return peer.alive && peer.id !== f.id && f.y < peer.y + playerHeight(peer) - EPS && f.y + height > peer.y + EPS && Math.hypot(f.x - peer.x, f.z - peer.z) < f.radius + peer.radius - EPS;
}
function sweepBody(x, y, z, dx, dy, dz, height, radius, rect) {
  let hit = null;
  const side = sweepRect(x, z, dx, dz, rect, radius);
  if (side) {
    const atY = y + dy * side.t;
    if (atY < rect.y + rect.h - EPS && atY + height > rect.y + EPS) hit = { ...side, ny: 0 };
  }
  const vertical = (t, ny) => {
    if (t < -EPS || t > 1 + EPS || (hit && t >= hit.t - EPS)) return;
    const px = x + dx * t, pz = z + dz * t, ox = px - clamp(px, rect.x, rect.x + rect.w), oz = pz - clamp(pz, rect.z, rect.z + rect.d), distanceSquared = ox * ox + oz * oz;
    // At a shared top/side edge, the first infinitesimal inward step is already
    // supported. Strict footprint overlap alone would lose both face contacts.
    if (distanceSquared < radius * radius - EPS || (distanceSquared <= radius * radius + EPS && ox * dx + oz * dz < -EPS)) hit = { t: clamp(t, 0, 1), nx: 0, ny, nz: 0 };
  };
  if (dy < -EPS) vertical((rect.y + rect.h - y) / dy, 1);
  if (dy > EPS) vertical((rect.y - height - y) / dy, -1);
  return hit;
}
/** A peer is a read-only upright cylinder. Dead bodies and separated vertical ranges never block. */
function sweepPlayer(x, y, z, dx, dy, dz, height, radius, peer) {
  const min = radius + peer.radius, ox = x - peer.x, oz = z - peer.z;
  const a = dx * dx + dz * dz, b = 2 * (ox * dx + oz * dz), c = ox * ox + oz * oz - min * min;
  let hit = null;
  if (a > EPS * EPS) {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const t = (-b - Math.sqrt(disc)) / (2 * a), atY = y + dy * t;
      if (t >= -EPS && t <= 1 + EPS && atY < peer.y + playerHeight(peer) - EPS && atY + height > peer.y + EPS) {
        const px = ox + dx * t, pz = oz + dz * t, length = Math.hypot(px, pz);
        if (length > EPS && dx * px + dz * pz < -EPS) hit = { t: clamp(t, 0, 1), nx: px / length, ny: 0, nz: pz / length };
      }
    }
  }
  return hit;
}
/** Sweep the whole motion together, so a falling foot contacts a crate top at its real arrival point. */
function bodyMove(f, dx, dy, dz, arena, peers = []) {
  const height = playerHeight(f); let x = f.x, y = f.y, z = f.z;
  for (let pass = 0; pass < 6 && Math.hypot(dx, dy, dz) > EPS; pass++) {
    let hit = null;
    for (const rect of arena.colliders) {
      const contact = sweepBody(x, y, z, dx, dy, dz, height, f.radius, rect);
      if (contact && (!hit || contact.t < hit.t - EPS)) hit = contact;
    }
    for (const peer of peers) {
      if (!peer.alive || peer.id === f.id) continue;
      const contact = sweepPlayer(x, y, z, dx, dy, dz, height, f.radius, peer);
      if (contact && (!hit || contact.t < hit.t - EPS)) hit = contact;
    }
    const bound = (t, nx, ny, nz) => { if (t >= -EPS && t <= 1 + EPS && (!hit || t < hit.t - EPS)) hit = { t: clamp(t, 0, 1), nx, ny, nz }; };
    if (dx < -EPS) bound((arena.bounds.minX + f.radius - x) / dx, 1, 0, 0);
    if (dx > EPS) bound((arena.bounds.maxX - f.radius - x) / dx, -1, 0, 0);
    if (dz < -EPS) bound((arena.bounds.minZ + f.radius - z) / dz, 0, 0, 1);
    if (dz > EPS) bound((arena.bounds.maxZ - f.radius - z) / dz, 0, 0, -1);
    if (dy < -EPS) bound(-y / dy, 0, 1, 0);
    const t = hit?.t ?? 1; x += dx * t; y += dy * t; z += dz * t;
    if (!hit) break;
    dx *= 1 - t; dy *= 1 - t; dz *= 1 - t;
    const inward = Math.min(0, dx * hit.nx + dy * hit.ny + dz * hit.nz); dx -= inward * hit.nx; dy -= inward * hit.ny; dz -= inward * hit.nz;
    const velocityInward = Math.min(0, f.vx * hit.nx + f.vy * hit.ny + f.vz * hit.nz); f.vx -= velocityInward * hit.nx; f.vy -= velocityInward * hit.ny; f.vz -= velocityInward * hit.nz;
    clipKnockback(f, hit.nx, hit.nz);
  }
  f.x = clamp(x, arena.bounds.minX + f.radius, arena.bounds.maxX - f.radius); f.y = Math.max(0, y); f.z = clamp(z, arena.bounds.minZ + f.radius, arena.bounds.maxZ - f.radius);
}
function supportHeight(f, arena) {
  let height = 0;
  for (const rect of arena.colliders) if (rect.y + rect.h <= f.y + EPS && circleRectOverlap(f.x, f.z, f.radius, rect)) height = Math.max(height, rect.y + rect.h);
  return height;
}
function refreshGrounded(f, arena) { f.grounded = f.alive && f.vy <= EPS && Math.abs(f.y - supportHeight(f, arena)) <= EPS; }
function clearKnockback(player) { player.knockbackX = player.knockbackZ = player.knockbackTicks = player.knockbackReadyTicks = 0; }
function clipKnockback(player, nx, nz) {
  const x = Number.isFinite(player.knockbackX) ? player.knockbackX : 0, z = Number.isFinite(player.knockbackZ) ? player.knockbackZ : 0, inward = Math.min(0, x * nx + z * nz);
  player.knockbackX = x - inward * nx; player.knockbackZ = z - inward * nz;
}
const pushedBody = player => player.alive && Number.isInteger(player.knockbackTicks) && player.knockbackTicks > 0 && player.knockbackTicks <= KNOCKBACK.monsterTicks && Math.hypot(player.knockbackX || 0, player.knockbackZ || 0) > EPS;
function impactMovementOrder(players) {
  const pushed = players.filter(pushedBody);
  if (pushed.length < 2) return players;
  const direction = pushed.reduce((total, player) => ({ x: total.x + player.knockbackX, z: total.z + player.knockbackZ }), { x: 0, z: 0 });
  // The leading displaced body sweeps first, then its followers can use the
  // space it actually vacated. A swarm's shove cannot depend on monster IDs.
  // Ordinary actors retain their original relative movement ordering.
  pushed.sort((a, b) => (b.x - a.x) * direction.x + (b.z - a.z) * direction.z || a.x - b.x || a.z - b.z || a.y - b.y || a.id - b.id);
  const identities = new Set(pushed.map(player => player.id)); let index = 0;
  return players.map(player => identities.has(player.id) ? pushed[index++] : player);
}
function movementTick(f, input, arena, peers = [], headroomPeers = peers) {
  f.yaw = input.yaw; f.pitch = input.pitch;
  if (!f.alive) { f.vx = f.vy = f.vz = 0; f.jumpBufferTicks = 0; clearKnockback(f); return; }
  const monsterBody = monsterBodyProfile(f);
  if (monsterBody) { f.radius = monsterBody.radius; f.crouching = false; }
  else if (input.crouch) f.crouching = true;
  else if (!arena.colliders.some(rect => bodyOverlapsBox(f, rect, WORLD.standHeight)) && !headroomPeers.some(peer => bodyOverlapsPlayer(f, peer, WORLD.standHeight))) f.crouching = false;
  // Queue only a fresh press. It may survive a short descent onto the next
  // platform, but holding jump never repeats and leaving a ledge grants no lift.
  if (input.jump && !f.previousInput?.jump) f.jumpBufferTicks = WORLD.jumpBufferTicks;
  if (f.grounded && f.jumpBufferTicks > 0 && !f.crouching) {
    f.vy = monsterBody?.jumpSpeed ?? WORLD.jumpSpeed; f.grounded = false; f.jumpBufferTicks = 0;
  } else f.jumpBufferTicks = Math.max(0, (f.jumpBufferTicks || 0) - 1);
  let strafe = Number(input.right) - Number(input.left), forward = Number(input.up) - Number(input.down); const length = Math.hypot(strafe, forward);
  if (length > 0) { strafe /= length; forward /= length; }
  const primarySpeed = monsterMovementSpeed(f) ?? (f.slot === 'sword' ? meleeProfile(f).speed : WEAPONS[f.weapon].speed);
  const ads = input.aim && f.slot === 'primary' && !f.reloadTicks && !f.healTicks && !f.grenadeThrowTicks;
  const speed = (f.crouching ? 2.35 : input.walk ? 2.8 : primarySpeed) * (f.healTicks ? HEAL.speedMultiplier : ads ? ADS.speedMultiplier : 1) * monsterMovementMultiplier(f);
  const targetX = (Math.sin(f.yaw) * forward + Math.cos(f.yaw) * strafe) * speed, targetZ = (-Math.cos(f.yaw) * forward + Math.sin(f.yaw) * strafe) * speed;
  const accel = f.grounded ? (length ? 43 : 58) : 7;
  const velocityX = targetX - f.vx, velocityZ = targetZ - f.vz, velocityDelta = Math.hypot(velocityX, velocityZ), accelerationFraction = velocityDelta > EPS ? Math.min(1, accel * DT / velocityDelta) : 0;
  f.vx += velocityX * accelerationFraction; f.vz += velocityZ * accelerationFraction;
  f.vy -= WORLD.gravity * DT;
  const pushed = Number.isInteger(f.knockbackTicks) && f.knockbackTicks > 0 && f.knockbackTicks <= KNOCKBACK.monsterTicks;
  if (!pushed) f.knockbackX = f.knockbackZ = f.knockbackTicks = 0;
  const cap = f.monster === true && f.human !== true ? KNOCKBACK.maxMonsterSpeed : KNOCKBACK.maxPlayerSpeed;
  let pushX = Number.isFinite(f.knockbackX) ? f.knockbackX : 0, pushZ = Number.isFinite(f.knockbackZ) ? f.knockbackZ : 0;
  const pushLength = Math.hypot(pushX, pushZ);
  if (pushLength > cap) { pushX *= cap / pushLength; pushZ *= cap / pushLength; }
  f.knockbackX = pushX; f.knockbackZ = pushZ;
  // Control acceleration acts only on ordinary movement. A blade impulse is
  // swept alongside it, including real peers, and cannot launch a target up.
  bodyMove(f, (f.vx + pushX) * DT, f.vy * DT, (f.vz + pushZ) * DT, arena, pushed ? headroomPeers : peers);
  if (pushed) {
    f.knockbackTicks--;
    if (f.knockbackTicks > 0) { const decay = Math.exp(-KNOCKBACK.decay * DT); f.knockbackX *= decay; f.knockbackZ *= decay; }
    else f.knockbackX = f.knockbackZ = 0;
  }
  f.knockbackReadyTicks = Number.isInteger(f.knockbackReadyTicks) && f.knockbackReadyTicks > 0 ? Math.max(0, Math.min(KNOCKBACK.playerReadyTicks, f.knockbackReadyTicks) - 1) : 0;
  refreshGrounded(f, arena);
}
function separatePrediction(player, peers, arena) {
  // Received peers can be older than the predicted local pose. Restore a legal
  // contact before sweeping, without moving the snapshot or pulling through cover.
  for (let pass = 0; pass < 12; pass++) {
    let overlapping = false;
    for (const peer of peers) {
      if (!bodyOverlapsPlayer(player, peer)) continue;
      overlapping = true;
      const dx = player.x - peer.x, dz = player.z - peer.z, distance = Math.hypot(dx, dz), minimum = player.radius + peer.radius;
      const fallback = player.id < peer.id ? -1 : 1;
      const nx = distance > EPS ? dx / distance : ((player.id + peer.id) % 2 ? fallback : 0), nz = distance > EPS ? dz / distance : (nx ? 0 : fallback), push = minimum - distance + EPS;
      bodyMove(player, nx * push, 0, nz * push, arena);
      const inward = Math.min(0, player.vx * nx + player.vz * nz); player.vx -= inward * nx; player.vz -= inward * nz;
      clipKnockback(player, nx, nz);
    }
    if (!overlapping) break;
  }
  refreshGrounded(player, arena);
}
/** Prediction mutates only the supplied player copy, never state, rounds, health or weapons. */
export function predictLocalMovement(player, raw, mapIdOrMap = 'courtyard', ticks = 1, peers = []) {
  const arena = typeof mapIdOrMap === 'string' ? MAPS[mapIdOrMap] : mapIdOrMap;
  if (!arena) return player;
  const count = clamp(Math.floor(Number.isFinite(ticks) ? ticks : 1), 0, TICK_RATE / 4);
  // A received co-moving crowd has the same independent impulse fields. Reuse
  // private peer copies across this replay so the leading body vacates space
  // just as it does in authority; no snapshot/health/inventory is changed.
  const movingPeers = pushedBody(player) && peers.some(peer => peer.id !== player.id && pushedBody(peer)) ? peers.filter(peer => peer.id !== player.id).map(peer => ({ ...peer })) : null;
  for (let i = 0; i < count; i++) {
    const contacts = movingPeers || peers;
    if (player.alive && contacts.length) separatePrediction(player, contacts, arena);
    const input = readInput(player, raw);
    if (movingPeers) {
      const group = [...movingPeers, player];
      for (const member of impactMovementOrder(group)) {
        const command = member === player ? input : readInput(member, member.previousInput || member);
        movementTick(member, command, arena, [], group);
        if (member !== player) member.previousInput = command;
      }
    } else movementTick(player, input, arena, peers);
    if (player.alive && contacts.length) separatePrediction(player, contacts, arena);
    player.previousInput = input;
  }
  return player;
}
/** A render correction uses the real body sweep without changing simulation state. */
export function sweepPresentationOffset(player, offset, mapIdOrMap = 'courtyard', peers = []) {
  if (!player) return player;
  const copy = { ...player };
  for (const axis of ['x', 'y', 'z']) if (!Number.isFinite(copy[axis])) copy[axis] = 0;
  const arena = typeof mapIdOrMap === 'string' ? MAPS[mapIdOrMap] : mapIdOrMap;
  const delta = ['x', 'y', 'z'].map(axis => offset?.[axis] ?? 0);
  if (!arena || !Array.isArray(arena.colliders) || !arena.bounds
      || !['minX', 'maxX', 'minZ', 'maxZ'].every(key => Number.isFinite(arena.bounds[key]))
      || !delta.every(Number.isFinite) || Math.hypot(...delta) > 10000
      || !Number.isFinite(copy.radius) || copy.radius <= 0) return copy;
  const body = { ...copy, vx: 0, vy: 0, vz: 0 };
  const contacts = Array.isArray(peers) ? peers.filter(peer => peer && ['x', 'y', 'z', 'radius'].every(key => Number.isFinite(peer[key])) && peer.radius > 0) : [];
  bodyMove(body, ...delta, arena, contacts);
  return { ...copy, x: body.x, y: body.y, z: body.z };
}
/** Resolve a displayed crowd on copies. A current local camera may anchor older remote poses. */
export function separatePresentationBodies(players, mapIdOrMap = 'courtyard', { anchorId, authoritativePlayers = [] } = {}) {
  if (!Array.isArray(players)) return [];
  const copies = players.map(player => ({ ...player }));
  const arena = typeof mapIdOrMap === 'string' ? MAPS[mapIdOrMap] : mapIdOrMap;
  if (!arena || !Array.isArray(arena.colliders) || !arena.bounds
      || !['minX', 'maxX', 'minZ', 'maxZ'].every(key => Number.isFinite(arena.bounds[key]))) return copies;
  const indexed = copies.map((source, index) => ({ source, index, body: { ...source,
    vx: Number.isFinite(source.vx) ? source.vx : 0, vy: Number.isFinite(source.vy) ? source.vy : 0, vz: Number.isFinite(source.vz) ? source.vz : 0 } }))
    .filter(({ body }) => ['x', 'y', 'z', 'radius'].every(key => Number.isFinite(body[key])) && body.radius > 0)
    .sort((a, b) => (Number.isFinite(a.body.id) ? a.body.id : a.index) - (Number.isFinite(b.body.id) ? b.body.id : b.index));
  const bodies = indexed.map(entry => entry.body);
  // Most frames have no body contact. Avoid support/cover scans in that case.
  let touching = false;
  for (let i = 0; i < bodies.length && !touching; i++) if (bodies[i].alive) {
    for (let j = i + 1; j < bodies.length; j++) if (bodyOverlapsPlayer(bodies[i], bodies[j])) { touching = true; break; }
  }
  if (!touching) return copies;
  const anchor = bodies.find(body => body.id === anchorId && body.alive);
  const latest = new Map((Array.isArray(authoritativePlayers) ? authoritativePlayers : []).map(body => [body?.id, body]));
  const legal = body => body && ['x', 'y', 'z', 'radius'].every(key => Number.isFinite(body[key])) && body.radius > 0
    && body.y >= -EPS && body.x >= arena.bounds.minX + body.radius - EPS && body.x <= arena.bounds.maxX - body.radius + EPS
    && body.z >= arena.bounds.minZ + body.radius - EPS && body.z <= arena.bounds.maxZ - body.radius + EPS
    && !arena.colliders.some(rect => bodyOverlapsBox(body, rect));
  // A protected camera must already be collision-tested against current bodies.
  // Without that complete, legal context, preserve the original crowd contract.
  const currentBodies = bodies.filter(body => body !== anchor && body.alive).map(body => latest.get(body.id));
  const canAnchor = anchor && legal(anchor) && bodies.every(body => body === anchor || !body.alive
    || legal(latest.get(body.id)) && latest.get(body.id).alive && latest.get(body.id).crouching === body.crouching && !bodyOverlapsPlayer(anchor, latest.get(body.id)))
    && currentBodies.every((body, index) => currentBodies.slice(index + 1).every(other => !bodyOverlapsPlayer(body, other)));
  if (!canAnchor) separatePlayers({ players: bodies }, arena);
  else {
    const remote = bodies.filter(body => body !== anchor);
    const contacts = () => {
      const pairs = [];
      for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
        if (bodies[i].alive && bodyOverlapsPlayer(bodies[i], bodies[j])) pairs.push([bodies[i], bodies[j]]);
      }
      return pairs;
    };
    // Same-time remote contacts keep the shared solver's movement weighting.
    // Only remote presentation yields to the already legal current camera.
    for (let pass = 0; pass < 16 && contacts().length; pass++) {
      separatePlayers({ players: remote }, arena);
      for (const body of remote) if (body.alive && bodyOverlapsPlayer(body, anchor)) separatePrediction(body, [anchor], arena);
    }
    // A stale body can be trapped between the camera and a wall. Restore its
    // newest legal pose instead of displacing the camera or crossing the wall.
    // Expand only through unresolved contact neighbours, leaving other views alone.
    const restored = new Set();
    for (let pass = 0; pass < bodies.length; pass++) {
      const pairs = contacts(); if (!pairs.length) break;
      const affected = new Set(pairs.flat().filter(body => body !== anchor && !restored.has(body.id)));
      if (!affected.size) break;
      for (const body of affected) {
        const current = latest.get(body.id);
        Object.assign(body, { x: current.x, y: current.y, z: current.z }); restored.add(body.id);
      }
    }
  }
  for (const { index, body } of indexed) Object.assign(copies[index], { x: body.x, y: body.y, z: body.z });
  return copies;
}
/** Slab ray/box intersection in metres. A ray starting inside cover contacts at zero. */
export function rayBox(origin, direction, rect, maxDistance = Infinity) {
  let near = 0, far = maxDistance;
  for (const [axis, size] of [['x', 'w'], ['y', 'h'], ['z', 'd']]) {
    const delta = direction[axis], start = origin[axis], min = rect[axis], max = min + rect[size];
    if (Math.abs(delta) < EPS) { if (start < min - EPS || start > max + EPS) return null; }
    else { let lo = (min - start) / delta, hi = (max - start) / delta; if (lo > hi) [lo, hi] = [hi, lo]; near = Math.max(near, lo); far = Math.min(far, hi); if (near > far + EPS) return null; }
  }
  return far < -EPS || near > maxDistance + EPS ? null : Math.max(0, near);
}
export function aimDirection(yaw, pitch) { const c = Math.cos(pitch); return { x: Math.sin(yaw) * c, y: Math.sin(pitch), z: -Math.cos(yaw) * c }; }
function playerBoxes(f) {
  const h = playerHeight(f), legHeight = f.crouching ? .3 : .55;
  // Split the original body silhouette without growing it. Head wins shared
  // faces, then torso; only contacts below the knee boundary count as legs.
  return [
    { kind: 'head', x: f.x - .22, y: f.y + h - .32, z: f.z - .22, w: .44, h: .32, d: .44 },
    { kind: 'body', x: f.x - .29, y: f.y + legHeight, z: f.z - .29, w: .58, h: h - .32 - legHeight, d: .58 },
    { kind: 'leg', x: f.x - .29, y: f.y, z: f.z - .29, w: .58, h: legHeight, d: .58 },
  ];
}
/** Earliest real 3D contact, including allied bodies (which block but never take damage). */
export function traceShot(state, playerId, origin, direction, maxDistance = 120, arena = state.map || MAPS[state.mapId]) {
  let result = { distance: maxDistance, kind: 'none', playerId: null, colliderId: null };
  for (const rect of arena.colliders) {
    const distance = rayBox(origin, direction, rect, maxDistance); if (distance !== null && distance <= result.distance + EPS) result = { distance, kind: 'wall', playerId: null, colliderId: rect.id };
  }
  if (direction.y < -EPS) { const distance = -origin.y / direction.y; if (distance >= 0 && distance <= result.distance + EPS) result = { distance, kind: 'wall', playerId: null, colliderId: 'floor' }; }
  for (const f of state.players) {
    if (f.id === playerId || !f.alive) continue;
    const monsterBoxes = monsterBodyBoxes(f);
    let rayOrigin = origin, rayDirection = direction;
    if (monsterBoxes) {
      const yaw = Number.isFinite(f.yaw) ? f.yaw : 0, c = Math.cos(yaw), s = Math.sin(yaw), dx = origin.x - f.x, dz = origin.z - f.z;
      rayOrigin = { x: c * dx + s * dz, y: origin.y - f.y, z: -s * dx + c * dz };
      rayDirection = { x: c * direction.x + s * direction.z, y: direction.y, z: -s * direction.x + c * direction.z };
    }
    for (const rect of monsterBoxes || playerBoxes(f)) {
      const distance = rayBox(rayOrigin, rayDirection, rect, maxDistance);
      if (distance !== null && distance < result.distance - EPS) result = { distance, kind: rect.kind, playerId: f.id, colliderId: null };
    }
  }
  return { ...result, x: origin.x + direction.x * result.distance, y: origin.y + direction.y * result.distance, z: origin.z + direction.z * result.distance };
}
function cancelHeal(state, f, reason) {
  if (!f.healTicks) return;
  f.healTicks = 0; f.healing = false;
  emit(state, 'healCancel', { playerId: f.id, reason });
}
function clearMelee(f) { f.meleeTicks = 0; f.meleePhase = 'idle'; f.meleeHitIds = []; f.meleeHitLives = []; f.meleeStartTick = 0; }
export function addInventoryLoot(state, player, item) {
  if (!item) return null;
  state.loot ||= [];
  const limit = state.horde ? 20 : 128;
  if (state.loot.length >= limit) state.loot.splice(0, 1);
  const id = state.horde ? ++state.horde.lootId : (state.lootId = (state.lootId || 0) + 1);
  const loot = { id, ...lootFromInventoryItem(item), x: player.x, y: player.y, z: player.z, droppedBy: player.id, falling: true, vy: 0, spawnTick: state.tick, expiresTick: state.tick + 5400 };
  state.loot.push(loot);
  emit(state, 'inventoryDrop', { playerId: player.id, lootId: id, kind: loot.kind, weapon: loot.weapon || null, amount: loot.amount || 1, x: loot.x, y: loot.y, z: loot.z });
  return loot;
}
export function dropCombatInventory(state, player) {
  ensureInventory(player);
  for (let index = 0; index < 4; index++) addInventoryLoot(state, player, dropInventoryItem(player, index));
}
export function findNearbyLoot(state, playerId, arena = state.map || MAPS[state.mapId]) {
  const player = state.players[playerId]; if (!player?.alive || !arena || !['fight', 'intermission'].includes(state.phase)) return null;
  const origin = { x: player.x, y: player.y + eyeHeight(player), z: player.z };
  let nearest = null, range = 1.7;
  for (const loot of state.loot || []) {
    if (!['weapon', 'melee', 'heal', 'grenade', 'ammo'].includes(loot.kind) || ![loot.x, loot.y, loot.z].every(Number.isFinite) || Math.abs(loot.y - player.y) > 1.2) continue;
    if (loot.kind === 'ammo' && !inventoryCanTake(player, loot)) continue;
    const horizontal = Math.hypot(loot.x - player.x, loot.z - player.z); if (horizontal > range + EPS) continue;
    const dx = loot.x - origin.x, dy = loot.y + .3 - origin.y, dz = loot.z - origin.z, distance = Math.hypot(dx, dy, dz), direction = distance > EPS ? { x: dx / distance, y: dy / distance, z: dz / distance } : { x: 0, y: 0, z: 0 };
    if (distance > EPS && arena.colliders.some(box => { const at = rayBox(origin, direction, box, distance); return at !== null && at < distance - EPS; })) continue;
    if (!nearest || horizontal < range - EPS || Math.abs(horizontal - range) < EPS && loot.id < nearest.id) { nearest = loot; range = horizontal; }
  }
  return nearest;
}
export function pickupCombatLoot(state, player, loot, input = {}) {
  const result = pickupInventoryItem(player, loot);
  if (!result.ok) { emit(state, 'inventoryFull', { playerId: player.id, lootId: loot.id }); return false; }
  if (result.dropped) addInventoryLoot(state, player, result.dropped);
  if (loot.kind === 'heal' || loot.kind === 'grenade' || loot.kind === 'ammo') loot.amount -= result.amount;
  if (!['heal', 'grenade', 'ammo'].includes(loot.kind) || loot.amount <= 0) state.loot = state.loot.filter(item => item.id !== loot.id);
  player.triggerBlocked = input.fire === true || player.triggerBlocked;
  clearMelee(player); cancelHeal(state, player, 'pickup');
  emit(state, 'lootPickup', { playerId: player.id, lootId: loot.id, kind: loot.kind, weapon: loot.weapon || null, amount: result.amount, inventoryIndex: result.index ?? player.inventoryIndex, x: loot.x, y: loot.y, z: loot.z });
  return true;
}
export function advanceInventoryLoot(state, arena = state.map || MAPS[state.mapId]) {
  for (const loot of state.loot || []) {
    if (!loot.falling) continue;
    const oldY = loot.y; loot.vy = (loot.vy || 0) - WORLD.gravity / TICK_RATE;
    const nextY = oldY + loot.vy / TICK_RATE; let floor = 0;
    for (const box of arena.colliders) { const top = box.y + box.h; if (top > oldY + EPS || top < nextY - EPS) continue; const dx = loot.x - clamp(loot.x, box.x, box.x + box.w), dz = loot.z - clamp(loot.z, box.z, box.z + box.d); if (dx * dx + dz * dz < .12 * .12) floor = Math.max(floor, top); }
    if (nextY <= floor) { loot.y = floor; loot.vy = 0; loot.falling = false; } else loot.y = nextY;
  }
}
function tickActions(state, f, input, arena) {
  if (!f.alive) return;
  ensureInventory(f);
  f.yaw = input.yaw; f.pitch = input.pitch;
  f.grenadeThrowTicks = Math.max(0, f.grenadeThrowTicks - 1);
  if (!input.fire) f.triggerBlocked = false;
  const selecting = INVENTORY_ACTIONS.some(key => input[key] && !f.previousInput[key]);
  const attackInterrupt = input.fire && (!f.previousInput.fire || f.slot === 'primary' || f.slot === 'sword');
  if (f.healTicks && (attackInterrupt || input.swap || input.grenade || input.jump || input.interact || input.reload || selecting)) cancelHeal(state, f, 'action');
  for (let index = 0; index < 4; index++) if (input[`slot${index + 1}`] && !f.previousInput[`slot${index + 1}`] && !input.interact) {
    const changed = selectInventorySlot(f, index);
    clearMelee(f); f.triggerBlocked = input.fire || f.triggerBlocked;
    emit(state, changed ? 'inventorySelect' : f.inventory[index] ? 'inventorySelect' : 'inventoryEmpty', { playerId: f.id, inventoryIndex: f.inventoryIndex, requestedIndex: index, slot: f.slot });
    break;
  }
  if (input.swap && !f.previousInput.swap && !input.interact) {
    const desired = f.slot === 'sword' ? 'weapon' : 'melee', index = f.inventory.findIndex(item => item?.kind === desired);
    if (index >= 0) selectInventorySlot(f, index);
    else { const next = [1, 2, 3, 4].map(offset => (f.inventoryIndex + offset) % 4).find(slot => f.inventory[slot]); if (Number.isInteger(next)) selectInventorySlot(f, next); }
    clearMelee(f); cancelHeal(state, f, 'swap');
    f.triggerBlocked = input.fire;
    emit(state, 'swap', { playerId: f.id, slot: f.slot });
  }
  if (input.drop && !f.previousInput.drop && !input.interact) {
    const item = dropInventoryItem(f); if (item) addInventoryLoot(state, f, item);
    clearMelee(f); cancelHeal(state, f, 'drop'); f.triggerBlocked = input.fire || f.triggerBlocked;
  }
  const held = selectedInventoryItem(f), useGrenade = input.grenade && !f.previousInput.grenade || held?.kind === 'grenade' && input.fire && !f.previousInput.fire && !f.triggerBlocked;
  if (useGrenade && !input.interact && !f.grenadeThrowTicks) {
    const grenade = throwGrenade(state, f, arena, (type, data) => emit(state, type, data));
    if (grenade) {
      // Ordnance validates the throw before the selected physical stack is spent.
      // Restore its aggregate decrement, then spend once from the held stack first.
      f.grenades++; storeInventoryGun(f); consumeInventoryStack(f, 'grenade');
      f.reloadTicks = 0; f.burstRemaining = 0; f.spinTicks = 0; clearMelee(f); cancelHeal(state, f, 'grenade');
      f.grenadeThrowTicks = 24; f.triggerBlocked = input.fire;
    }
  }
  const potionFire = held?.kind === 'heal' && input.fire && !f.previousInput.fire && !f.triggerBlocked;
  if ((input.heal && !f.previousInput.heal || potionFire) && f.potions > 0 && f.hp < f.maxHp && !f.healTicks && !f.meleeTicks && !f.grenadeThrowTicks && (!input.fire || potionFire) && !input.jump && !input.swap && !input.grenade && !input.interact && !input.reload && !selecting && f.grounded) {
    storeInventoryGun(f); consumeInventoryStack(f, 'heal'); f.healTicks = HEAL.ticks; f.healStartTick = state.tick; f.healing = true; f.reloadTicks = 0; f.burstRemaining = 0; f.spinTicks = 0;
    emit(state, 'healStart', { playerId: f.id, x: f.x, y: f.y + eyeHeight(f), z: f.z });
  }
  tickHolsteredInventory(f);
  const heldMelee = selectedInventoryItem(f); if (heldMelee?.kind === 'melee') f.meleeCooldown = heldMelee.meleeCooldown || 0;
  f.aiming = input.aim && f.slot === 'primary' && !f.reloadTicks && !f.healTicks && !f.grenadeThrowTicks && !input.interact;
  f.aimTicks = clamp(f.aimTicks + (f.aiming ? 1 : -2), 0, ADS.ticks);
}
function tickHealing(state, f) {
  if (!f.alive || !f.healTicks || f.healStartTick === state.tick) return;
  if (--f.healTicks === 0) {
    const amount = Math.min(HEAL.amount, f.maxHp - f.hp); f.hp += amount; f.healing = false;
    emit(state, 'healComplete', { playerId: f.id, amount, hp: f.hp, x: f.x, y: f.y + eyeHeight(f), z: f.z });
  }
}
function meleeBodyContacts(geometry, target) {
  const localBoxes = monsterBodyBoxes(target), boxes = localBoxes || playerBoxes(target), contacts = [];
  const yaw = Number.isFinite(target.yaw) ? target.yaw : 0, c = Math.cos(yaw), s = Math.sin(yaw);
  const local = point => {
    if (!localBoxes) return point;
    const dx = point.x - target.x, dz = point.z - target.z;
    return { x: c * dx + s * dz, y: point.y - target.y, z: -s * dx + c * dz };
  };
  const world = point => localBoxes ? { x: target.x + c * point.x - s * point.z, y: target.y + point.y, z: target.z + s * point.x + c * point.z } : point;
  for (const sample of geometry.samples) {
    const a = local(sample.inner), b = local(sample.outer);
    for (const box of boxes) {
      const contact = meleeSegmentBoxContact(a, b, box);
      if (contact && contact.distance <= geometry.radius + EPS) {
        const flesh = world(contact.flesh);
        contacts.push({ flesh, distance: Math.hypot(flesh.x - geometry.origin.x, flesh.y - geometry.origin.y, flesh.z - geometry.origin.z) });
      }
    }
  }
  return contacts.sort((a, b) => a.distance - b.distance);
}
function tickMelee(state, f, input, pendingDamage, arena, { meleeDamageScale } = {}) {
  const melee = meleeProfile(f), meleeWeapon = meleeWeaponId(f);
  if (f.meleeTicks > 0) {
    f.meleeTicks--;
    f.meleePhase = f.meleeTicks > melee.activeTicks + melee.recoveryTicks ? 'startup' : f.meleeTicks > melee.recoveryTicks ? 'active' : f.meleeTicks > 0 ? 'recovery' : 'idle';
  } else if (input.fire && !f.previousInput.fire && !f.triggerBlocked && !f.meleeCooldown && !input.interact) {
    f.meleeTicks = melee.startupTicks + melee.activeTicks + melee.recoveryTicks; f.meleePhase = 'startup'; f.meleeHitIds = []; f.meleeHitLives = [];
    f.meleeCooldown = f.meleeTicks; f.meleeYaw = f.yaw; f.meleePitch = f.pitch;
    f.meleeIndex = (f.meleeIndex || 0) + 1; f.meleeHand = meleeHand(f, f.meleeIndex);
    f.meleeStartTick = state.tick;
    emit(state, 'meleeStart', { playerId: f.id, weapon: meleeWeapon, hand: f.meleeHand, meleeIndex: f.meleeIndex, meleeStartTick: f.meleeStartTick, attackerLifeId: f.lifeId || 0, attackerDeaths: f.deaths || 0, x: f.x, y: f.y + eyeHeight(f), z: f.z, yaw: f.meleeYaw, pitch: f.meleePitch });
  }
  if (f.meleePhase !== 'active') return;
  const origin = meleeSlashOrigin(f), phase = meleeSlashPhase(f), geometry = meleeSlashGeometry(f, { from: phase.from, to: phase.to, origin });
  f.meleeHitLives ||= [];
  const swing = { meleeIndex: f.meleeIndex, meleeStartTick: f.meleeStartTick, attackerLifeId: f.lifeId || 0, attackerDeaths: f.deaths || 0 };
  for (const target of state.players) {
    const life = `${target.id}:${target.lifeId || 0}`;
    if (!target.alive || target.id === f.id || target.team === f.team || f.meleeHitLives.includes(life)) continue;
    const targetRadius = monsterBodyProfile(target)?.radius ?? target.radius;
    if (Math.hypot(target.x - origin.x, target.z - origin.z) > melee.reach + targetRadius + .04 || target.y > origin.y + melee.reach || target.y + playerHeight(target) < origin.y - melee.reach) continue;
    // In Last Stand a hostile monster cannot shield the rest of the swarm from
    // the same blade. Solid cover and allied bodies still shield every contact;
    // competitive humans keep their existing nearest-body blocking.
    const cleave = state.gameId === 'voxel-horde' && target.monster === true && target.human !== true;
    const snapshot = cleave ? { ...state, players: state.players.filter(peer => peer.id === target.id || peer.monster !== true || peer.human === true || peer.team === f.team) } : state;
    let hit = null, direction = null;
    for (const contact of meleeBodyContacts(geometry, target)) {
      if (contact.distance <= EPS || contact.distance > melee.reach + EPS) continue;
      const ray = { x: (contact.flesh.x - origin.x) / contact.distance, y: (contact.flesh.y - origin.y) / contact.distance, z: (contact.flesh.z - origin.z) / contact.distance };
      const traced = traceShot(snapshot, f.id, origin, ray, contact.distance + .0001, arena);
      if (traced.playerId === target.id) { hit = traced; direction = ray; break; }
    }
    if (!hit) continue;
    f.meleeHitIds.push(target.id);
    f.meleeHitLives.push(life);
    const scale = typeof meleeDamageScale === 'function' ? meleeDamageScale(state, f, target, melee) : meleeDamageScale ?? 1;
    const damage = Math.round(melee.damage * (Number.isFinite(scale) && scale >= 0 ? Math.min(scale, 8) : 1));
    pendingDamage.push({ ...swing, playerId: f.id, targetId: target.id, targetLifeId: target.lifeId || 0, damage, hitKind: 'body', headshot: false, attack: meleeWeapon, weapon: meleeWeapon, hand: f.meleeHand, hitX: hit.x, hitY: hit.y, hitZ: hit.z, dx: direction.x, dy: direction.y, dz: direction.z });
    emit(state, 'meleeHit', { ...swing, playerId: f.id, targetId: target.id, targetLifeId: target.lifeId || 0, weapon: meleeWeapon, hand: f.meleeHand, damage, x: hit.x, y: hit.y, z: hit.z });
  }
}
function fireRound(state, f, weapon, pendingDamage, arena) {
  if (weapon.projectile && state.bolts.length >= MAX_BOLTS) return false;
  const speed = Math.hypot(f.vx, f.vz), motion = clamp((speed - .22) / weapon.speed, 0, 1), ads = f.aimTicks / ADS.ticks;
  const spread = weaponSpread(weapon, { motion, grounded: f.grounded, heat: f.heat, ads }, ADS);
  // Fixed indexed spread and fixed pellet geometry replay independently of frames.
  const index = ++f.shotIndex, angle = index * 2.399963229728653, radius = spread * Math.sqrt(((index * 73) % 101 + 1) / 102);
  const horizontalRecoil = f.heat > .25 ? Math.sin(index * 1.73) * Math.min(.009, f.recoil * .24) : 0;
  const yaw = f.yaw + horizontalRecoil + Math.cos(angle) * radius, pitch = clamp(f.pitch + f.recoil + Math.sin(angle) * radius, -1.5, 1.5);
  const origin = { x: f.x, y: f.y + eyeHeight(f), z: f.z }, pelletCount = weapon.pellets || 1;
  if (weapon.projectile && !launchBolt(state, f, weapon, origin, aimDirection(yaw, pitch), { emit: (type, data) => emit(state, type, data) })) { f.shotIndex--; return false; }
  f.ammo--; f.shots++; f.recoil = Math.min(.13, f.recoil + weapon.recoil * (1 - ads * (1 - ADS.recoilMultiplier))); f.heat = Math.min(12, f.heat + 1);
  f.lastShotHand = weaponHand(weapon, index);
  if (weapon.projectile) return true;
  for (let pellet = 0; pellet < pelletCount; pellet++) {
    // One centered pellet keeps close precise aim meaningful; the ring fixes the
    // shotgun's minimum cone, so ADS cannot turn it into an eight-hit sniper.
    const pelletAngle = (pellet - 1) * Math.PI * 2 / Math.max(1, pelletCount - 1), pelletRadius = pellet ? weapon.pelletSpread : 0;
    const direction = aimDirection(yaw + Math.cos(pelletAngle) * pelletRadius, clamp(pitch + Math.sin(pelletAngle) * pelletRadius, -1.5, 1.5));
    const hit = traceCompensatedShot(state, f.id, origin, direction, weapon.range, arena, traceShot);
    let damage = 0;
    if (hit.playerId !== null && state.players[hit.playerId].team !== f.team) {
      damage = weaponDamage(weapon, hit.kind, hit.distance);
      pendingDamage.push({ playerId: f.id, targetId: hit.playerId, damage, hitKind: hit.kind, headshot: hit.kind === 'head', attack: 'gun', weapon: f.weapon, hitX: hit.x, hitY: hit.y, hitZ: hit.z, dx: direction.x, dy: direction.y, dz: direction.z });
    }
    emit(state, 'shot', { playerId: f.id, targetId: hit.playerId, weapon: f.weapon, hand: f.lastShotHand, pellet, pelletCount, x: origin.x, y: origin.y, z: origin.z, dx: direction.x, dy: direction.y, dz: direction.z, hitX: hit.x, hitY: hit.y, hitZ: hit.z, hitKind: hit.kind, colliderId: hit.colliderId, damage });
  }
  return true;
}
function tickWeapon(state, f, input, pendingDamage, arena, meleeOptions = {}) {
  if (!f.alive) return;
  const weapon = WEAPONS[f.weapon]; f.shotCooldown = Math.max(0, f.shotCooldown - 1); f.recoil = Math.max(0, f.recoil - .04 * DT); f.heat = Math.max(0, f.heat - 2.8 * DT);
  if (f.reloadTicks > 0) {
    f.reloadTicks--;
    if (f.reloadTicks === 0) { const loaded = Math.min(weapon.magazine - f.ammo, f.reserve); f.ammo += loaded; f.reserve -= loaded; emit(state, 'reloadComplete', { playerId: f.id, weapon: f.weapon }); }
  }
  if (f.healTicks || f.grenadeThrowTicks) { f.spinTicks = f.pendingFireTicks = 0; return; }
  if (f.slot === 'sword') { f.spinTicks = f.pendingFireTicks = 0; tickMelee(state, f, input, pendingDamage, arena, meleeOptions); return; }
  if (f.slot !== 'primary') { f.spinTicks = f.pendingFireTicks = 0; return; }
  if (input.reload && !f.previousInput.reload && !f.reloadTicks && f.ammo < weapon.magazine && f.reserve > 0) { f.reloadTicks = weapon.reloadTicks; f.burstRemaining = 0; f.spinTicks = f.pendingFireTicks = 0; f.aiming = false; emit(state, 'reload', { playerId: f.id, weapon: f.weapon }); }
  if (input.interact) { f.burstRemaining = 0; f.spinTicks = f.pendingFireTicks = 0; }
  // Paired pistols retain one recent fresh press across their short recovery.
  // Holding fire never queues another shot; reloads and hand changes discard it.
  f.pendingFireTicks = Math.max(0, (f.pendingFireTicks || 0) - 1);
  if (weapon.pressBufferTicks && input.fire && !f.previousInput.fire && !f.triggerBlocked && !f.reloadTicks && !input.interact && f.ammo > 0) f.pendingFireTicks = weapon.pressBufferTicks;
  if (f.triggerBlocked || f.reloadTicks) f.pendingFireTicks = 0;
  // Wind-up advances while the trigger is held, including between shots. Any
  // interrupted firing commitment requires a new full wind-up before spending ammo.
  if (!weapon.spinupTicks || !input.fire || f.triggerBlocked || f.reloadTicks || input.interact || f.ammo <= 0) f.spinTicks = 0;
  else f.spinTicks = Math.min(weapon.spinupTicks, f.spinTicks + 1);
  if (f.triggerBlocked || f.shotCooldown || f.reloadTicks || input.interact) return;
  if (!f.burstRemaining) {
    const bufferedPress = weapon.pressBufferTicks && f.pendingFireTicks > 0;
    if (!bufferedPress && (!input.fire || ((weapon.mode === 'semi' || weapon.mode === 'burst' || weapon.mode === 'pump' || weapon.mode === 'bolt') && f.previousInput.fire))) return;
    if (f.ammo <= 0) { if (!f.previousInput.fire) emit(state, 'dryFire', { playerId: f.id }); return; }
    if (weapon.spinupTicks && f.spinTicks < weapon.spinupTicks) return;
    if (weapon.mode === 'burst') f.burstRemaining = Math.min(weapon.burstCount, f.ammo);
  }
  if (!fireRound(state, f, weapon, pendingDamage, arena)) return;
  f.pendingFireTicks = 0;
  if (weapon.mode === 'burst') { f.burstRemaining--; f.shotCooldown = f.burstRemaining ? weapon.burstInterval : weapon.cooldown; }
  else f.shotCooldown = weapon.cooldown;
}
function applyMeleeKnockback(state, hit, attacker, target, profile) {
  if (target.hp <= 0 || target.knockbackReadyTicks > 0 || target.emergenceTicks > 0) return;
  const monster = target.monster === true && target.human !== true;
  const cap = monster ? KNOCKBACK.maxMonsterSpeed : KNOCKBACK.maxPlayerSpeed;
  const resistance = monster ? target.monsterType === 'brute' ? .35 : target.monsterType === 'screecher' ? .8 : 1 : .28;
  const speed = Math.min(cap, profile.pushSpeed * resistance), dx = target.x - attacker.x, dz = target.z - attacker.z, length = Math.hypot(dx, dz);
  const nx = length > EPS ? dx / length : Math.sin(attacker.meleeYaw || 0), nz = length > EPS ? dz / length : -Math.cos(attacker.meleeYaw || 0);
  // Replace a direction rather than add forces. Three simultaneous partners
  // cannot multiply launch speed or refresh this short impact guard.
  target.knockbackX = nx * speed; target.knockbackZ = nz * speed;
  target.knockbackTicks = monster ? KNOCKBACK.monsterTicks : KNOCKBACK.playerTicks;
  target.knockbackReadyTicks = monster ? KNOCKBACK.monsterReadyTicks : KNOCKBACK.playerReadyTicks;
  emit(state, 'meleeKnockback', { playerId: attacker.id, targetId: target.id, targetLifeId: target.lifeId || 0, weapon: profile.id, meleeIndex: hit.meleeIndex, meleeStartTick: hit.meleeStartTick, attackerLifeId: attacker.lifeId || 0, x: target.x, y: target.y, z: target.z, dx: nx, dz: nz, speed, ticks: target.knockbackTicks });
}
export function applyCombatDamage(state, pending, { onMeleeHit } = {}) {
  const lethalHits = new Map();
  for (const hit of pending) {
    const f = state.players[hit.targetId], attacker = state.players[hit.playerId];
    if (!f?.alive || f.hp <= 0 || !Number.isFinite(hit.damage) || hit.damage <= 0 || hit.targetLifeId !== undefined && hit.targetLifeId !== (f.lifeId || 0)) continue;
    const damage = Math.min(f.hp, hit.damage); f.hp -= damage; f.lastHitTick = state.tick;
    cancelHeal(state, f, 'damage');
    if (attacker && attacker.id !== f.id && attacker.team !== f.team) attacker.damageDealt += damage;
    if (f.hp <= 0) lethalHits.set(f.id, hit);
    emit(state, 'damage', { ...hit, damage, hp: f.hp, x: f.x, y: f.y + eyeHeight(f), z: f.z });
    if (typeof hit.attack === 'string' && Object.hasOwn(MELEE_WEAPONS, hit.attack) && attacker && attacker.id !== f.id && attacker.team !== f.team) {
      const profile = MELEE_WEAPONS[hit.attack];
      if (typeof onMeleeHit === 'function') onMeleeHit(state, { ...hit, damage }, attacker, f, profile);
      // Monster stagger modifies ordinary gait, never the independent shove.
      applyMeleeKnockback(state, hit, attacker, f, profile);
    }
  }
  for (const f of state.players) if (f.alive && f.hp <= 0) {
    f.alive = false; f.deaths++; f.vx = f.vy = f.vz = 0; clearKnockback(f); f.jumpBufferTicks = 0; f.reloadTicks = 0; f.burstRemaining = 0; f.spinTicks = f.pendingFireTicks = 0; f.aiming = false; f.aimTicks = 0; f.healing = false; f.healTicks = 0; f.grenadeThrowTicks = 0; clearMelee(f); f.interaction = null; f.interactTicks = 0;
    const killer = lethalHits.get(f.id), attacker = killer && state.players[killer.playerId];
    if (attacker && attacker.id !== f.id && attacker.team !== f.team) attacker.kills++;
    emit(state, 'kill', { playerId: killer?.playerId ?? null, targetId: f.id, hitKind: killer?.hitKind ?? 'body', headshot: killer?.headshot || false, attack: killer?.attack || 'gun', weapon: killer?.weapon ?? (killer?.attack === 'grenade' ? 'grenade' : null), x: f.x, y: f.y, z: f.z });
    if (state.gameId === 'voxel-breach') dropCombatInventory(state, f);
    if (state.bomb?.status === 'carried' && state.bomb.carrierId === f.id) { Object.assign(state.bomb, { status: 'dropped', carrierId: null, x: f.x, y: f.y, z: f.z, plantPlayerId: null, plantTicks: 0 }); emit(state, 'bombDrop', { playerId: f.id, x: f.x, y: f.y, z: f.z }); }
  }
}
/** Shared physical combat only. The caller owns time, lobby, objectives and match rules. */
export function combatStep(state, rawInputs = [], arena = state.map || MAPS[state.mapId], { additionalDamage = [], meleeDamageScale = 1, onMeleeHit } = {}) {
  if (!arena?.colliders || !arena?.bounds) throw new TypeError('Combat requires a physical arena.');
  const inputs = state.players.map(f => readInput(f, rawInputs[f.id])), pending = [], meleeOptions = { meleeDamageScale };
  for (const f of state.players) tickActions(state, f, inputs[f.id], arena);
  for (const f of impactMovementOrder(state.players)) movementTick(f, inputs[f.id], arena, [], state.players);
  separatePlayers(state, arena);
  recordLagCompensation(state);
  for (const f of state.players) tickWeapon(state, f, inputs[f.id], pending, arena, meleeOptions);
  advanceGrenades(state, arena, { emit: (type, data) => emit(state, type, data), queueDamage: hit => pending.push(hit) });
  // Traces use the same explicit arena as movement, including custom mode maps.
  advanceBolts(state, { trace: (snapshot, id, origin, direction, distance) => traceShot(snapshot, id, origin, direction, distance, arena), arena, emit: (type, data) => emit(state, type, data), queueDamage: hit => pending.push(hit) });
  // Lazy environmental contacts use the final physical pose for this tick,
  // while participating in the same death/heal ordering as weapon contacts.
  pending.push(...(typeof additionalDamage === 'function' ? additionalDamage(state) : additionalDamage));
  applyCombatDamage(state, pending, { onMeleeHit });
  for (const f of state.players) tickHealing(state, f);
  for (const f of state.players) { storeInventoryGun(f); refreshInventory(f); f.previousInput = inputs[f.id]; }
  return state;
}
function separatePlayers(state, arena) {
  // Only the closing movement yields at a contact. A stationary opponent cannot be
  // shoved through a doorway, and a wall-pinned queue resolves outward in one pass.
  for (let pass = 0; pass < 16; pass++) {
    let overlapping = false;
    for (let i = 0; i < state.players.length; i++) for (let j = i + 1; j < state.players.length; j++) {
      const a = state.players[i], b = state.players[j]; if (!a.alive || !b.alive || a.y >= b.y + playerHeight(b) - EPS || b.y >= a.y + playerHeight(a) - EPS) continue;
      const dx = b.x - a.x, dz = b.z - a.z, dist = Math.hypot(dx, dz), min = a.radius + b.radius; if (dist >= min - EPS) continue;
      overlapping = true;
      const nx = dist > EPS ? dx / dist : ((a.id + b.id) % 2 ? 1 : 0), nz = dist > EPS ? dz / dist : (nx ? 0 : 1);
      const inwardA = Math.max(0, (a.vx + (a.knockbackX || 0)) * nx + (a.vz + (a.knockbackZ || 0)) * nz), inwardB = Math.max(0, -(b.vx + (b.knockbackX || 0)) * nx - (b.vz + (b.knockbackZ || 0)) * nz), closing = inwardA + inwardB;
      // A falling body yields to the player underneath rather than pushing an idle
      // opponent sideways. Peer bodies provide neither ground nor jump height.
      const shareA = closing > EPS ? inwardA / closing : a.vy < -EPS && a.y > b.y + EPS ? 1 : b.vy < -EPS && b.y > a.y + EPS ? 0 : .5, push = min - dist + EPS;
      const ax = a.x, az = a.z, bx = b.x, bz = b.z;
      bodyMove(a, -nx * push * shareA, 0, -nz * push * shareA, arena); bodyMove(b, nx * push * (1 - shareA), 0, nz * push * (1 - shareA), arena);
      const after = Math.hypot(b.x - a.x, b.z - a.z), remaining = min - after;
      if (remaining > EPS && after > EPS) {
        const rx = (b.x - a.x) / after, rz = (b.z - a.z) / after;
        const fractionA = push * shareA > EPS ? Math.hypot(a.x - ax, a.z - az) / (push * shareA) : 1;
        const fractionB = push * (1 - shareA) > EPS ? Math.hypot(b.x - bx, b.z - bz) / (push * (1 - shareA)) : 1;
        // Transfer a blocked correction to the body that still has space. Compare
        // the fraction completed, because the moving body may own the whole push.
        if (fractionA < fractionB) bodyMove(b, rx * (remaining + EPS), 0, rz * (remaining + EPS), arena);
        else bodyMove(a, -rx * (remaining + EPS), 0, -rz * (remaining + EPS), arena);
      }
      const controlA = Math.max(0, a.vx * nx + a.vz * nz), controlB = Math.max(0, -b.vx * nx - b.vz * nz);
      a.vx -= controlA * nx; a.vz -= controlA * nz; b.vx += controlB * nx; b.vz += controlB * nz;
      clipKnockback(a, -nx, -nz); clipKnockback(b, nx, nz);
    }
    if (!overlapping) break;
  }
  for (const f of state.players) refreshGrounded(f, arena);
}
function interactionAllowed(f, input, tick) { return f.alive && f.grounded && Math.hypot(f.vx, f.vz) < .25 && !input.fire && !f.reloadTicks && !f.healTicks && !f.meleeTicks && !f.grenadeThrowTicks && f.lastHitTick !== tick; }
/** The visible charge must be reachable around solid cover; squad bodies are harmless. */
export function canInteractWithBomb(state, player) {
  const bomb = state.bomb, origin = { x: player.x, y: player.y + eyeHeight(player), z: player.z }, dx = bomb.x - origin.x, dy = bomb.y + .12 - origin.y, dz = bomb.z - origin.z, distance = Math.hypot(dx, dy, dz);
  if (distance <= EPS) return true;
  const direction = { x: dx / distance, y: dy / distance, z: dz / distance };
  return !MAPS[state.mapId].colliders.some(rect => { const contact = rayBox(origin, direction, rect, distance); return contact !== null && contact < distance - EPS; });
}
function updateBomb(state, inputs) {
  const bomb = state.bomb, arena = MAPS[state.mapId];
  for (const f of state.players) { f.interaction = null; f.interactTicks = 0; }
  if (bomb.status === 'dropped') {
    const oldY = bomb.y; bomb.vy -= WORLD.gravity * DT; let nextY = oldY + bomb.vy * DT, floor = 0;
    for (const rect of arena.colliders) { const top = rect.y + rect.h; if (top <= oldY + EPS && top >= nextY - EPS && circleRectOverlap(bomb.x, bomb.z, .15, rect)) floor = Math.max(floor, top); }
    if (nextY <= floor) { nextY = floor; bomb.vy = 0; } bomb.y = nextY;
    const carrier = state.players.find(f => f.alive && f.team === state.attackTeam && Math.hypot(f.x - bomb.x, f.z - bomb.z) <= 1.2 && Math.abs(f.y - bomb.y) < 1.2 && canInteractWithBomb(state, f));
    if (carrier) { bomb.status = 'carried'; bomb.carrierId = carrier.id; emit(state, 'bombPickup', { playerId: carrier.id }); }
  }
  if (bomb.status === 'carried') {
    const f = state.players[bomb.carrierId]; Object.assign(bomb, { x: f.x, y: f.y, z: f.z });
    const site = arena.sites.find(site => Math.hypot(f.x - site.x, f.z - site.z) <= site.radius), input = inputs[f.id];
    if (site && input.interact && interactionAllowed(f, input, state.tick) && f.y < .2) {
      if (bomb.plantPlayerId !== f.id || bomb.siteId !== site.id) bomb.plantTicks = 0;
      bomb.plantPlayerId = f.id; bomb.siteId = site.id; bomb.plantTicks++; f.interaction = 'plant'; f.interactTicks = bomb.plantTicks;
      if (bomb.plantTicks >= WORLD.plantSeconds * TICK_RATE) { Object.assign(bomb, { status: 'planted', carrierId: null, x: f.x, y: 0, z: f.z, timerTicks: WORLD.bombSeconds * TICK_RATE, plantPlayerId: null }); f.interaction = null; emit(state, 'plant', { playerId: f.id, siteId: site.id, x: bomb.x, y: bomb.y, z: bomb.z }); state.objective = 'Charge planted. Defenders hold Interact nearby for five seconds to defuse.'; }
    } else { bomb.plantPlayerId = null; bomb.plantTicks = 0; bomb.siteId = null; }
  } else if (bomb.status === 'planted') {
    const eligible = f => f.alive && f.team !== state.attackTeam && inputs[f.id].interact && interactionAllowed(f, inputs[f.id], state.tick) && Math.hypot(f.x - bomb.x, f.z - bomb.z) <= 1.6 && Math.abs(f.y - bomb.y) < .35 && canInteractWithBomb(state, f);
    let defuser = state.players.find(f => f.id === bomb.defusePlayerId && eligible(f));
    if (!defuser) defuser = state.players.find(eligible);
    if (defuser) {
      if (bomb.defusePlayerId !== defuser.id) bomb.defuseTicks = 0; bomb.defusePlayerId = defuser.id; bomb.defuseTicks++; defuser.interaction = 'defuse'; defuser.interactTicks = bomb.defuseTicks;
      if (bomb.defuseTicks >= WORLD.defuseSeconds * TICK_RATE) { bomb.status = 'defused'; emit(state, 'defuse', { playerId: defuser.id, x: bomb.x, y: bomb.y, z: bomb.z }); winRound(state, 1 - state.attackTeam, 'defuse'); }
    } else { bomb.defusePlayerId = null; bomb.defuseTicks = 0; }
  }
}
function winRound(state, team, reason) {
  if (state.phase !== 'fight') return;
  state.roundWinner = team; state.roundReason = reason; state.scores[team]++; state.phase = 'roundEnd'; state.phaseTicks = TICK_RATE * 4;
  state.objective = reason === 'defuse' ? 'Charge defused.' : reason === 'explosion' ? 'Charge detonated.' : reason === 'time' ? 'Time expired. Defenders held both sites.' : 'Opposing squad eliminated.';
  state.grenades = []; state.bolts = []; state.boltId = 0;
  for (const f of state.players) { f.vx = f.vy = f.vz = 0; clearKnockback(f); f.jumpBufferTicks = 0; f.interaction = null; f.interactTicks = 0; f.reloadTicks = 0; f.burstRemaining = 0; f.spinTicks = 0; f.aiming = false; f.aimTicks = 0; cancelHeal(state, f, 'round'); f.grenadeThrowTicks = 0; clearMelee(f); }
  emit(state, 'roundEnd', { winner: team, reason, round: state.round, scores: [...state.scores] });
  if (state.scores[team] >= WORLD.winsToMatch) { state.phase = 'matchEnd'; state.phaseTicks = 0; state.winner = team; state.objective = 'Match complete. Both squads must ready up for a rematch.'; emit(state, 'matchEnd', { winner: team, scores: [...state.scores] }); }
}
function resolveRound(state) {
  if (state.phase !== 'fight') return;
  const attackersAlive = state.players.some(f => f.alive && f.team === state.attackTeam), defendersAlive = state.players.some(f => f.alive && f.team !== state.attackTeam);
  if (state.bomb.status === 'planted') { if (!defendersAlive) return winRound(state, state.attackTeam, 'elimination'); if (state.bomb.timerTicks <= 0) { state.bomb.status = 'exploded'; emit(state, 'explosion', { x: state.bomb.x, y: state.bomb.y, z: state.bomb.z, siteId: state.bomb.siteId }); winRound(state, state.attackTeam, 'explosion'); } return; }
  if (!attackersAlive) return winRound(state, 1 - state.attackTeam, 'elimination');
  if (!defendersAlive) return winRound(state, state.attackTeam, 'elimination');
  if (state.roundTicks <= 0) winRound(state, 1 - state.attackTeam, 'time');
}
export function step(state, rawInputs = []) {
  state.tick++; const inputs = state.players.map(f => readInput(f, rawInputs[f.id]));
  if (state.phase === 'lobby' || state.phase === 'matchEnd') return state;
  if (state.phase === 'roundEnd') { if (--state.phaseTicks <= 0) { state.round++; prepareRound(state); } return state; }
  if (state.phase === 'countdown' || state.phase === 'buy') {
    for (const f of state.players) { f.yaw = inputs[f.id].yaw; f.pitch = inputs[f.id].pitch; f.previousInput = inputs[f.id]; f.jumpBufferTicks = 0; f.spinTicks = 0; }
    if (--state.phaseTicks <= 0) {
      if (state.phase === 'countdown') { state.phase = 'buy'; state.phaseTicks = WORLD.buySeconds * TICK_RATE; state.objective = 'Choose your weapon. Movement and shots unlock at the bell.'; emit(state, 'buy'); }
      else { state.phase = 'fight'; state.phaseTicks = 0; for (const f of state.players) f.triggerBlocked = inputs[f.id].fire; state.objective = 'Attackers: plant A or B. Defenders: deny the plant or defuse.'; emit(state, 'fight', { round: state.round }); }
    }
    return state;
  }
  if (state.phase !== 'fight') return state;
  state.roundTicks = Math.max(0, state.roundTicks - 1);
  if (state.bomb.status === 'planted') { state.bomb.timerTicks = Math.max(0, state.bomb.timerTicks - 1); if (!state.bomb.timerTicks) { resolveRound(state); return state; } }
  const previous = state.players.map(f => ({ ...f.previousInput }));
  combatStep(state, inputs, MAPS[state.mapId]);
  updateBomb(state, inputs); resolveRound(state);
  if (state.phase === 'fight') for (const f of state.players) if (f.alive && inputs[f.id].interact && !previous[f.id].interact && !f.interaction && !f.healTicks && !f.reloadTicks && !f.meleeTicks && !f.grenadeThrowTicks && !inputs[f.id].fire) { const loot = findNearbyLoot(state, f.id); if (loot) pickupCombatLoot(state, f, loot, inputs[f.id]); }
  advanceInventoryLoot(state);
  return state;
}
