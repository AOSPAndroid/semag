/** Voxel Breach: shared, deterministic 120 Hz tactical first-person simulation. */
import { throwGrenade, advanceGrenades } from './voxel-ordnance.js';
export const TICK_RATE = 120;
// Keep every pellet contact from a six-player shotgun volley through the next
// network snapshot, including utility and damage feedback in the same interval.
export const EVENT_LIMIT = 128;
export const WORLD = Object.freeze({ radius: .32, standHeight: 1.8, crouchHeight: 1.15, eyeHeight: 1.62, crouchEyeHeight: .98, gravity: 18.4, jumpSpeed: 6.4, roundSeconds: 100, bombSeconds: 35, plantSeconds: 3, defuseSeconds: 5, buySeconds: 8, winsToMatch: 4 });
export const INPUT_KEYS = Object.freeze(['up', 'down', 'left', 'right', 'jump', 'crouch', 'walk', 'fire', 'reload', 'interact', 'aim', 'swap', 'grenade', 'heal']);
export const ADS = Object.freeze({ ticks: 18, speedMultiplier: .65, spreadMultiplier: .4, recoilMultiplier: .62, fovRatio: 54 / 70, scopedFovRatio: 40 / 70 });
export const MELEE = Object.freeze({ startupTicks: 18, activeTicks: 12, recoveryTicks: 42, damage: 55, reach: 2.15, arcRadians: .64, speed: 5.85 });
export const HEAL = Object.freeze({ ticks: 240, amount: 40, speedMultiplier: .3 });
export const WEAPONS = Object.freeze({
  carbine: Object.freeze({ id: 'carbine', name: 'Kestrel Carbine', label: 'CARBINE', magazine: 24, reserve: 72, damage: 28, headMultiplier: 3, cooldown: 12, reloadTicks: 252, speed: 5.4, range: 100, recoil: .0085, movingSpread: .043, airborneSpread: .105, bloom: .0028, color: '#83d0bd', description: 'Accurate opening shot; controlled bursts beat sustained recoil.' }),
  smg: Object.freeze({ id: 'smg', name: 'Swift SMG', label: 'SMG', magazine: 30, reserve: 90, damage: 20, headMultiplier: 2.5, cooldown: 9, reloadTicks: 216, speed: 5.9, range: 70, recoil: .0065, movingSpread: .026, airborneSpread: .082, bloom: .0022, color: '#ffc77a', description: 'Fast movement and close-range fire; damage falls beyond 20 metres.' }),
  marksman: Object.freeze({ id: 'marksman', name: 'Heron Marksman', label: 'MARKSMAN', magazine: 8, reserve: 24, damage: 58, headMultiplier: 2, cooldown: 54, reloadTicks: 300, speed: 4.85, range: 120, recoil: .019, movingSpread: .077, airborneSpread: .15, bloom: .001, color: '#bcb5ff', description: 'A precise headshot wins instantly. Movement demands discipline.' }),
  pistol: Object.freeze({ id: 'pistol', name: 'Finch Pistol', label: 'PISTOL', mode: 'semi', magazine: 12, reserve: 48, damage: 34, headMultiplier: 2.4, cooldown: 22, reloadTicks: 180, speed: 6, range: 85, recoil: .012, movingSpread: .029, airborneSpread: .095, bloom: .0022, color: '#a1d0f3', description: 'One shot per press. Quick movement rewards deliberate close-range aim.' }),
  shotgun: Object.freeze({ id: 'shotgun', name: 'Warden Shotgun', label: 'SHOTGUN', mode: 'pump', magazine: 6, reserve: 18, damage: 12, headMultiplier: 1.35, cooldown: 90, reloadTicks: 288, speed: 5.15, range: 36, recoil: .024, movingSpread: .035, airborneSpread: .09, bloom: .002, pellets: 8, pelletSpread: .055, color: '#eac394', description: 'Eight pellets per shell. Powerful up close; cover blocks each pellet.' }),
  burst: Object.freeze({ id: 'burst', name: 'Osprey Burst Rifle', label: 'BURST', mode: 'burst', magazine: 27, reserve: 81, damage: 23, headMultiplier: 2.8, cooldown: 42, burstCount: 3, burstInterval: 8, reloadTicks: 264, speed: 5.15, range: 105, recoil: .0095, movingSpread: .05, airborneSpread: .115, bloom: .0028, color: '#ecab91', description: 'Three shots per press. Release and re-aim during the burst recovery.' }),
});
const box = (id, x, y, z, w, h, d, color = '#647780', material = 'stone') => Object.freeze({ id, x, y, z, w, h, d, color, material });
const perimeter = (w = 50, d = 44, color = '#b8a993') => [box('wall-west', -w / 2 - 1, 0, -d / 2 - 1, 1, 4.2, d + 2, color), box('wall-east', w / 2, 0, -d / 2 - 1, 1, 4.2, d + 2, color), box('wall-north', -w / 2, 0, -d / 2 - 1, w, 4.2, 1, color), box('wall-south', -w / 2, 0, d / 2, w, 4.2, 1, color)];
const map = (id, name, description, colliders, sites, settings = {}) => Object.freeze({ id, name, description, bounds: Object.freeze({ minX: -25, maxX: 25, minZ: -22, maxZ: 22 }), colliders: Object.freeze([...perimeter(50, 44, settings.wallColor), ...colliders]), sites: Object.freeze(sites.map(Object.freeze)), spawns: Object.freeze([Object.freeze([{ x: -3, z: 18, yaw: 0 }, { x: 0, z: 18, yaw: 0 }, { x: 3, z: 18, yaw: 0 }].map(Object.freeze)), Object.freeze([{ x: 3, z: -18, yaw: Math.PI }, { x: 0, z: -18, yaw: Math.PI }, { x: -3, z: -18, yaw: Math.PI }].map(Object.freeze))]), floorColor: settings.floorColor || '#c8b99a', skyColor: settings.skyColor || '#c1d9e0', theme: settings.theme || 'courtyard' });
export const MAPS = Object.freeze({
  courtyard: map('courtyard', 'Sunset Courtyard', 'Two broad flanks and a broken central arch. Low site cover rewards measured peeks.', [
    box('central-north', -5, 0, -4, 10, 3.8, 2, '#b9a790'), box('central-west', -5, 0, -2, 2, 3.8, 8, '#bdab92'), box('central-east', 3, 0, -2, 2, 3.8, 8, '#bdab92'),
    box('west-arcade', -15, 0, 1, 8, 3.2, 2, '#9b8d7a'), box('east-arcade', 7, 0, 1, 8, 3.2, 2, '#9b8d7a'),
    box('west-site-crate', -16.4, 0, -10.4, 2.4, 1, 2.4, '#b07a48', 'wood'), box('west-site-column', -9.2, 0, -14.2, 1.6, 3.3, 1.6, '#bca88c'),
    box('east-site-crate', 14, 0, -10.4, 2.4, 1, 2.4, '#b07a48', 'wood'), box('east-site-column', 7.6, 0, -14.2, 1.6, 3.3, 1.6, '#bca88c'),
    box('south-cover', -1.2, 0, 11, 2.4, 1.2, 2.4, '#927c5c', 'wood'), box('north-cover', -1.2, 0, -14.6, 2.4, 1.1, 2.4, '#927c5c', 'wood'),
  ], [{ id: 'A', x: -13, z: -12, radius: 2.2 }, { id: 'B', x: 13, z: -12, radius: 2.2 }], { floorColor: '#c7b597', skyColor: '#edceb0', wallColor: '#b3a38b' }),
  depot: map('depot', 'Freight Depot', 'Container lanes, elevated pallet stacks and a dangerous open loading court.', [
    box('west-container', -16, 0, -3, 4, 3.2, 12, '#54868b', 'metal'), box('east-container', 12, 0, -9, 4, 3.2, 12, '#aa795d', 'metal'),
    box('mid-container', -3, 0, -6, 6, 3.2, 5, '#637b87', 'metal'), box('mid-pallet', -2, 0, 3.6, 4, .8, 3, '#a17c4b', 'wood'),
    box('west-loading-stack', -17, 0, -15, 3, 1.2, 2.5, '#b9915a', 'wood'), box('west-loading-column', -8, 0, -14, 1.5, 3.4, 1.5, '#7b8b92', 'metal'),
    box('east-loading-stack', 14, 0, -14, 3, 1.2, 2.5, '#b9915a', 'wood'), box('east-loading-column', 7, 0, -15, 1.5, 3.4, 1.5, '#7b8b92', 'metal'),
    box('south-pallet-west', -9, 0, 12, 3, .8, 2.2, '#ac8754', 'wood'), box('south-pallet-east', 6, 0, 12, 3, .8, 2.2, '#ac8754', 'wood'),
  ], [{ id: 'A', x: -12, z: -12, radius: 2.2 }, { id: 'B', x: 12, z: -12, radius: 2.2 }], { floorColor: '#687b83', skyColor: '#b9d5dc', wallColor: '#778b96', theme: 'depot' }),
  canal: map('canal', 'Canal Exchange', 'A divided market offers alternating long sights and tight bridge approaches.', [
    box('canal-mid-screen', -5, 0, -1, 10, 3.4, 2, '#9b8e7b'),
    box('canal-west-bank', -3.2, 0, -9, 1.2, 1.15, 18, '#728b96'), box('canal-east-bank', 2, 0, -9, 1.2, 1.15, 18, '#728b96'),
    box('canal-water-block', -2, -.5, -9, 4, .55, 18, '#5c9fab', 'water'),
    box('west-market', -16, 0, -2, 7, 3.2, 3, '#bda68a'), box('east-market', 9, 0, 4, 7, 3.2, 3, '#bda68a'),
    box('west-bridge-pillar', -7, 0, 5.5, 1.4, 3, 1.4, '#a29381'), box('east-bridge-pillar', 5.6, 0, -5.5, 1.4, 3, 1.4, '#a29381'),
    box('west-site-planter', -16.5, 0, -13.2, 2.5, .9, 2.5, '#94a076'), box('east-site-planter', 14, 0, -13.2, 2.5, .9, 2.5, '#94a076'),
    box('west-site-pillar', -9, 0, -15, 1.4, 3.4, 1.4, '#a99b86'), box('east-site-pillar', 7.6, 0, -15, 1.4, 3.4, 1.4, '#a99b86'),
    box('south-bollard', -1.2, 0, 13, 2.4, 1.05, 1.6, '#a29481'), box('north-bollard', -1.2, 0, -15, 2.4, 1.05, 1.6, '#a29481'),
  ], [{ id: 'A', x: -12, z: -12, radius: 2.2 }, { id: 'B', x: 12, z: -12, radius: 2.2 }], { floorColor: '#a8aaa0', skyColor: '#c5d7e3', wallColor: '#ab9f8d', theme: 'canal' }),
});
const EPS = 1e-8, DT = 1 / TICK_RATE;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const eyeHeight = player => player.crouching ? WORLD.crouchEyeHeight : WORLD.eyeHeight;
export const playerHeight = player => player.crouching ? WORLD.crouchHeight : WORLD.standHeight;
export const emptyInput = (aim = {}) => ({ ...Object.fromEntries(INPUT_KEYS.map(key => [key, false])), yaw: Number.isFinite(aim.yaw) ? clamp(aim.yaw, -Math.PI, Math.PI) : 0, pitch: Number.isFinite(aim.pitch) ? clamp(aim.pitch, -1.35, 1.35) : 0 });
export function cloneState(state) { const copy = JSON.parse(JSON.stringify(state)); if (copy.players) copy.fighters = copy.players; return copy; }
function newPlayer(id, teamSize, loadout = 'carbine') {
  const weapon = Object.hasOwn(WEAPONS, loadout) ? loadout : 'carbine', w = WEAPONS[weapon];
  return { id, team: Math.floor(id / teamSize), x: 0, y: 0, z: 0, yaw: 0, pitch: 0, vx: 0, vy: 0, vz: 0, radius: WORLD.radius, grounded: true, crouching: false, alive: true, hp: 100, maxHp: 100, weapon, slot: 'primary', ammo: w.magazine, reserve: w.reserve, reloadTicks: 0, shotCooldown: 0, burstRemaining: 0, recoil: 0, heat: 0, shotIndex: 0, shots: 0, kills: 0, deaths: 0, damageDealt: 0, lastHitTick: -1000, triggerBlocked: false, aiming: false, aimTicks: 0, meleeTicks: 0, meleeCooldown: 0, meleeYaw: 0, meleePitch: 0, meleePhase: 'idle', meleeHitIds: [], healing: false, healTicks: 0, healStartTick: -1, potions: 1, grenades: 1, grenadeThrowTicks: 0, interaction: null, interactTicks: 0, previousInput: emptyInput() };
}
function freshBomb() { return { status: 'carried', carrierId: 0, x: 0, y: 0, z: 0, vy: 0, siteId: null, plantPlayerId: null, plantTicks: 0, defusePlayerId: null, defuseTicks: 0, timerTicks: 0 }; }
export function createState({ teamSize = 1, mapId = 'courtyard' } = {}) {
  if (![1, 2, 3].includes(teamSize)) throw new RangeError('teamSize must be 1, 2 or 3.');
  if (!Object.hasOwn(MAPS, mapId)) throw new RangeError('Unknown Voxel Breach map.');
  const players = Array.from({ length: teamSize * 2 }, (_, id) => newPlayer(id, teamSize));
  const state = { gameId: 'voxel-breach', teamSize, capacity: teamSize * 2, mapId, mapName: MAPS[mapId].name, tick: 0, phase: 'lobby', phaseTicks: 0, round: 1, maxRounds: 7, roundTicks: WORLD.roundSeconds * TICK_RATE, scores: [0, 0], attackTeam: 0, winner: null, roundWinner: null, roundReason: null, players, fighters: players, bomb: freshBomb(), grenades: [], grenadeId: 0, events: [], eventId: 0, objective: 'Attackers plant at A or B. Defenders deny the plant or defuse. First to four rounds.' };
  spawnPlayers(state, false); return state;
}
function emit(state, type, data = {}) { state.events.push({ id: ++state.eventId, tick: state.tick, type, ...data }); if (state.events.length > EVENT_LIMIT) state.events.splice(0, state.events.length - EVENT_LIMIT); }
function spawnPlayers(state, preserveStats = true) {
  const arena = MAPS[state.mapId];
  state.players = state.players.map(old => {
    const f = newPlayer(old.id, state.teamSize, old.weapon), side = f.team === state.attackTeam ? 0 : 1, spawn = arena.spawns[side][f.id % state.teamSize];
    Object.assign(f, spawn); f.previousInput = emptyInput(spawn);
    if (preserveStats) for (const key of ['kills', 'deaths', 'damageDealt', 'shots']) f[key] = old[key];
    return f;
  });
  state.fighters = state.players;
  state.grenades = [];
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
  const tick = state.tick, eventId = state.eventId, loadouts = state.players.map(f => f.weapon);
  const fresh = createState({ teamSize: state.teamSize, mapId: state.mapId }); Object.assign(state, fresh, { tick, eventId });
  for (const f of state.players) f.weapon = loadouts[f.id] || 'carbine'; prepareRound(state, 3 * TICK_RATE); return state;
}
export function resetLobby(state) {
  const tick = state.tick, eventId = state.eventId, loadouts = state.players.map(f => f.weapon);
  Object.assign(state, createState({ teamSize: state.teamSize, mapId: state.mapId }), { tick, eventId });
  for (const f of state.players) { f.weapon = loadouts[f.id] || 'carbine'; const w = WEAPONS[f.weapon]; f.ammo = w.magazine; f.reserve = w.reserve; }
  return state;
}
export function selectLoadout(state, playerId, weaponId) {
  const f = state.players[playerId];
  if (!f || !Number.isInteger(playerId)) return { ok: false, changed: false, error: 'Unknown player.' };
  if (!Object.hasOwn(WEAPONS, weaponId)) return { ok: false, changed: false, error: 'Choose carbine, smg, marksman, pistol, shotgun or burst.' };
  if (!['lobby', 'countdown', 'buy', 'roundEnd'].includes(state.phase)) return { ok: false, changed: false, error: 'Weapons can be changed between rounds.' };
  if (f.weapon === weaponId) return { ok: true, changed: false };
  const w = WEAPONS[weaponId]; Object.assign(f, { weapon: weaponId, slot: 'primary', ammo: w.magazine, reserve: w.reserve, reloadTicks: 0, shotCooldown: 0, burstRemaining: 0, recoil: 0, heat: 0, shotIndex: 0, aiming: false, aimTicks: 0 });
  emit(state, 'loadout', { playerId, weapon: weaponId }); return { ok: true, changed: true };
}
export const setLoadout = selectLoadout;
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
  }
  f.x = clamp(x, arena.bounds.minX + f.radius, arena.bounds.maxX - f.radius); f.y = Math.max(0, y); f.z = clamp(z, arena.bounds.minZ + f.radius, arena.bounds.maxZ - f.radius);
}
function supportHeight(f, arena) {
  let height = 0;
  for (const rect of arena.colliders) if (rect.y + rect.h <= f.y + EPS && circleRectOverlap(f.x, f.z, f.radius, rect)) height = Math.max(height, rect.y + rect.h);
  return height;
}
function refreshGrounded(f, arena) { f.grounded = f.alive && f.vy <= EPS && Math.abs(f.y - supportHeight(f, arena)) <= EPS; }
function movementTick(f, input, arena, peers = [], headroomPeers = peers) {
  f.yaw = input.yaw; f.pitch = input.pitch;
  if (!f.alive) { f.vx = f.vy = f.vz = 0; return; }
  if (input.crouch) f.crouching = true;
  else if (!arena.colliders.some(rect => bodyOverlapsBox(f, rect, WORLD.standHeight)) && !headroomPeers.some(peer => bodyOverlapsPlayer(f, peer, WORLD.standHeight))) f.crouching = false;
  if (f.grounded && input.jump && !f.previousInput?.jump && !f.crouching) { f.vy = WORLD.jumpSpeed; f.grounded = false; }
  let strafe = Number(input.right) - Number(input.left), forward = Number(input.up) - Number(input.down); const length = Math.hypot(strafe, forward);
  if (length > 0) { strafe /= length; forward /= length; }
  const primarySpeed = f.slot === 'sword' ? MELEE.speed : WEAPONS[f.weapon].speed;
  const ads = input.aim && f.slot !== 'sword' && !f.reloadTicks && !f.healTicks && !f.grenadeThrowTicks;
  const speed = (f.crouching ? 2.35 : input.walk ? 2.8 : primarySpeed) * (f.healTicks ? HEAL.speedMultiplier : ads ? ADS.speedMultiplier : 1);
  const targetX = (Math.sin(f.yaw) * forward + Math.cos(f.yaw) * strafe) * speed, targetZ = (-Math.cos(f.yaw) * forward + Math.sin(f.yaw) * strafe) * speed;
  const accel = f.grounded ? (length ? 43 : 58) : 7;
  const velocityX = targetX - f.vx, velocityZ = targetZ - f.vz, velocityDelta = Math.hypot(velocityX, velocityZ), accelerationFraction = velocityDelta > EPS ? Math.min(1, accel * DT / velocityDelta) : 0;
  f.vx += velocityX * accelerationFraction; f.vz += velocityZ * accelerationFraction;
  f.vy -= WORLD.gravity * DT;
  bodyMove(f, f.vx * DT, f.vy * DT, f.vz * DT, arena, peers);
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
  for (let i = 0; i < count; i++) {
    if (player.alive && peers.length) separatePrediction(player, peers, arena);
    const input = readInput(player, raw); movementTick(player, input, arena, peers);
    if (player.alive && peers.length) separatePrediction(player, peers, arena);
    player.previousInput = input;
  }
  return player;
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
  const h = playerHeight(f);
  return [{ kind: 'head', x: f.x - .22, y: f.y + h - .32, z: f.z - .22, w: .44, h: .32, d: .44 }, { kind: 'body', x: f.x - .29, y: f.y, z: f.z - .29, w: .58, h: h - .32, d: .58 }];
}
/** Earliest real 3D contact, including allied bodies (which block but never take damage). */
export function traceShot(state, playerId, origin, direction, maxDistance = 120) {
  let result = { distance: maxDistance, kind: 'none', playerId: null, colliderId: null };
  for (const rect of MAPS[state.mapId].colliders) {
    const distance = rayBox(origin, direction, rect, maxDistance); if (distance !== null && distance <= result.distance + EPS) result = { distance, kind: 'wall', playerId: null, colliderId: rect.id };
  }
  if (direction.y < -EPS) { const distance = -origin.y / direction.y; if (distance >= 0 && distance <= result.distance + EPS) result = { distance, kind: 'wall', playerId: null, colliderId: 'floor' }; }
  for (const f of state.players) {
    if (f.id === playerId || !f.alive) continue;
    for (const rect of playerBoxes(f)) {
      const distance = rayBox(origin, direction, rect, maxDistance);
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
function clearMelee(f) { f.meleeTicks = 0; f.meleePhase = 'idle'; f.meleeHitIds = []; }
function tickActions(state, f, input, arena) {
  if (!f.alive) return;
  f.yaw = input.yaw; f.pitch = input.pitch;
  f.grenadeThrowTicks = Math.max(0, f.grenadeThrowTicks - 1);
  f.meleeCooldown = Math.max(0, f.meleeCooldown - 1);
  if (!input.fire) f.triggerBlocked = false;
  if (f.healTicks && (input.fire || input.swap || input.grenade || input.jump || input.interact || input.reload)) cancelHeal(state, f, 'action');
  if (input.swap && !f.previousInput.swap && !input.interact) {
    f.slot = f.slot === 'sword' ? 'primary' : 'sword';
    f.reloadTicks = 0; f.burstRemaining = 0; clearMelee(f); cancelHeal(state, f, 'swap');
    f.triggerBlocked = input.fire;
    emit(state, 'swap', { playerId: f.id, slot: f.slot });
  }
  if (input.grenade && !f.previousInput.grenade && !input.interact && !f.grenadeThrowTicks) {
    const grenade = throwGrenade(state, f, arena, (type, data) => emit(state, type, data));
    if (grenade) {
      f.reloadTicks = 0; f.burstRemaining = 0; clearMelee(f); cancelHeal(state, f, 'grenade');
      f.grenadeThrowTicks = 24; f.triggerBlocked = input.fire;
    }
  }
  if (input.heal && !f.previousInput.heal && f.potions > 0 && f.hp < f.maxHp && !f.healTicks && !f.meleeTicks && !f.grenadeThrowTicks && !input.fire && !input.jump && !input.swap && !input.grenade && !input.interact && !input.reload && f.grounded) {
    f.potions--; f.healTicks = HEAL.ticks; f.healStartTick = state.tick; f.healing = true; f.reloadTicks = 0; f.burstRemaining = 0;
    emit(state, 'healStart', { playerId: f.id, x: f.x, y: f.y + eyeHeight(f), z: f.z });
  }
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
function tickMelee(state, f, input, pendingDamage) {
  if (f.meleeTicks > 0) {
    f.meleeTicks--;
    f.meleePhase = f.meleeTicks > MELEE.activeTicks + MELEE.recoveryTicks ? 'startup' : f.meleeTicks > MELEE.recoveryTicks ? 'active' : f.meleeTicks > 0 ? 'recovery' : 'idle';
  } else if (input.fire && !f.previousInput.fire && !f.triggerBlocked && !f.meleeCooldown && !input.interact) {
    f.meleeTicks = MELEE.startupTicks + MELEE.activeTicks + MELEE.recoveryTicks; f.meleePhase = 'startup'; f.meleeHitIds = [];
    f.meleeCooldown = f.meleeTicks; f.meleeYaw = f.yaw; f.meleePitch = f.pitch;
    emit(state, 'meleeStart', { playerId: f.id, weapon: 'sword', x: f.x, y: f.y + eyeHeight(f), z: f.z, yaw: f.yaw });
  }
  if (f.meleePhase !== 'active') return;
  const origin = { x: f.x, y: f.y + eyeHeight(f) * .76, z: f.z }, forward = aimDirection(f.meleeYaw, f.meleePitch);
  for (const target of state.players) {
    if (!target.alive || target.id === f.id || target.team === f.team || f.meleeHitIds.includes(target.id)) continue;
    // Contact the closest point on the target's upright body, including crouched
    // or elevated targets. Visual sword length does not invent an extended hitbox.
    const dx = target.x - origin.x, dz = target.z - origin.z, horizontal = Math.hypot(dx, dz);
    const targetY = clamp(origin.y, target.y + .18, target.y + playerHeight(target) - .16), dy = targetY - origin.y;
    const contactDistance = Math.hypot(Math.max(0, horizontal - target.radius), dy);
    const centerDistance = Math.hypot(dx, dy, dz);
    if (contactDistance > MELEE.reach || centerDistance <= EPS) continue;
    const direction = { x: dx / centerDistance, y: dy / centerDistance, z: dz / centerDistance };
    if (direction.x * forward.x + direction.y * forward.y + direction.z * forward.z < Math.cos(MELEE.arcRadians)) continue;
    // The same nearest-body/world ray used by guns prevents wall and ally cleaves.
    const hit = traceShot(state, f.id, origin, direction, centerDistance + .01);
    if (hit.playerId !== target.id) continue;
    f.meleeHitIds.push(target.id);
    pendingDamage.push({ playerId: f.id, targetId: target.id, damage: MELEE.damage, headshot: false, attack: 'sword', weapon: 'sword' });
    emit(state, 'meleeHit', { playerId: f.id, targetId: target.id, weapon: 'sword', damage: MELEE.damage, x: hit.x, y: hit.y, z: hit.z });
  }
}
function fireRound(state, f, weapon, pendingDamage) {
  const speed = Math.hypot(f.vx, f.vz), motion = clamp((speed - .22) / weapon.speed, 0, 1), ads = f.aimTicks / ADS.ticks;
  const spread = (motion * weapon.movingSpread + (f.grounded ? 0 : weapon.airborneSpread) + Math.min(8, f.heat) * weapon.bloom) * (1 - ads * (1 - ADS.spreadMultiplier));
  // Fixed indexed spread and fixed pellet geometry replay independently of frames.
  const index = ++f.shotIndex, angle = index * 2.399963229728653, radius = spread * Math.sqrt(((index * 73) % 101 + 1) / 102);
  const horizontalRecoil = f.heat > .25 ? Math.sin(index * 1.73) * Math.min(.009, f.recoil * .24) : 0;
  const yaw = f.yaw + horizontalRecoil + Math.cos(angle) * radius, pitch = clamp(f.pitch + f.recoil + Math.sin(angle) * radius, -1.5, 1.5);
  const origin = { x: f.x, y: f.y + eyeHeight(f), z: f.z }, pelletCount = weapon.pellets || 1;
  f.ammo--; f.shots++; f.recoil = Math.min(.13, f.recoil + weapon.recoil * (1 - ads * (1 - ADS.recoilMultiplier))); f.heat = Math.min(12, f.heat + 1);
  for (let pellet = 0; pellet < pelletCount; pellet++) {
    // One centered pellet keeps close precise aim meaningful; the ring fixes the
    // shotgun's minimum cone, so ADS cannot turn it into an eight-hit sniper.
    const pelletAngle = (pellet - 1) * Math.PI * 2 / Math.max(1, pelletCount - 1), pelletRadius = pellet ? weapon.pelletSpread : 0;
    const direction = aimDirection(yaw + Math.cos(pelletAngle) * pelletRadius, clamp(pitch + Math.sin(pelletAngle) * pelletRadius, -1.5, 1.5));
    const hit = traceShot(state, f.id, origin, direction, weapon.range);
    let damage = 0;
    if (hit.playerId !== null && state.players[hit.playerId].team !== f.team) {
      const falloff = f.weapon === 'smg' ? clamp(1 - Math.max(0, hit.distance - 20) / 70, .65, 1) : f.weapon === 'shotgun' ? clamp(1 - Math.max(0, hit.distance - 8) / 24, .25, 1) : 1;
      damage = Math.round(weapon.damage * (hit.kind === 'head' ? weapon.headMultiplier : 1) * falloff);
      pendingDamage.push({ playerId: f.id, targetId: hit.playerId, damage, headshot: hit.kind === 'head', attack: 'gun', weapon: f.weapon });
    }
    emit(state, 'shot', { playerId: f.id, targetId: hit.playerId, weapon: f.weapon, pellet, pelletCount, x: origin.x, y: origin.y, z: origin.z, dx: direction.x, dy: direction.y, dz: direction.z, hitX: hit.x, hitY: hit.y, hitZ: hit.z, hitKind: hit.kind, colliderId: hit.colliderId, damage });
  }
}
function tickWeapon(state, f, input, pendingDamage) {
  if (!f.alive) return;
  const weapon = WEAPONS[f.weapon]; f.shotCooldown = Math.max(0, f.shotCooldown - 1); f.recoil = Math.max(0, f.recoil - .04 * DT); f.heat = Math.max(0, f.heat - 2.8 * DT);
  if (f.reloadTicks > 0) {
    f.reloadTicks--;
    if (f.reloadTicks === 0) { const loaded = Math.min(weapon.magazine - f.ammo, f.reserve); f.ammo += loaded; f.reserve -= loaded; emit(state, 'reloadComplete', { playerId: f.id, weapon: f.weapon }); }
  }
  if (f.healTicks || f.grenadeThrowTicks) return;
  if (f.slot === 'sword') { tickMelee(state, f, input, pendingDamage); return; }
  if (input.reload && !f.previousInput.reload && !f.reloadTicks && f.ammo < weapon.magazine && f.reserve > 0) { f.reloadTicks = weapon.reloadTicks; f.burstRemaining = 0; f.aiming = false; emit(state, 'reload', { playerId: f.id, weapon: f.weapon }); }
  if (input.interact) f.burstRemaining = 0;
  if (f.triggerBlocked || f.shotCooldown || f.reloadTicks || input.interact) return;
  if (!f.burstRemaining) {
    if (!input.fire || ((weapon.mode === 'semi' || weapon.mode === 'burst' || weapon.mode === 'pump') && f.previousInput.fire)) return;
    if (f.ammo <= 0) { if (!f.previousInput.fire) emit(state, 'dryFire', { playerId: f.id }); return; }
    if (weapon.mode === 'burst') f.burstRemaining = Math.min(weapon.burstCount, f.ammo);
  }
  fireRound(state, f, weapon, pendingDamage);
  if (weapon.mode === 'burst') { f.burstRemaining--; f.shotCooldown = f.burstRemaining ? weapon.burstInterval : weapon.cooldown; }
  else f.shotCooldown = weapon.cooldown;
}
function applyDamage(state, pending) {
  const lethalHits = new Map();
  for (const hit of pending) {
    const f = state.players[hit.targetId], attacker = state.players[hit.playerId];
    if (!f?.alive || f.hp <= 0 || !Number.isFinite(hit.damage) || hit.damage <= 0) continue;
    const damage = Math.min(f.hp, hit.damage); f.hp -= damage; f.lastHitTick = state.tick;
    cancelHeal(state, f, 'damage');
    if (attacker && attacker.id !== f.id && attacker.team !== f.team) attacker.damageDealt += damage;
    if (f.hp <= 0) lethalHits.set(f.id, hit);
    emit(state, 'damage', { ...hit, damage, hp: f.hp, x: f.x, y: f.y + eyeHeight(f), z: f.z });
  }
  for (const f of state.players) if (f.alive && f.hp <= 0) {
    f.alive = false; f.deaths++; f.vx = f.vy = f.vz = 0; f.reloadTicks = 0; f.burstRemaining = 0; f.aiming = false; f.aimTicks = 0; f.healing = false; f.healTicks = 0; f.grenadeThrowTicks = 0; clearMelee(f); f.interaction = null; f.interactTicks = 0;
    const killer = lethalHits.get(f.id), attacker = killer && state.players[killer.playerId];
    if (attacker && attacker.id !== f.id && attacker.team !== f.team) attacker.kills++;
    emit(state, 'kill', { playerId: killer?.playerId ?? null, targetId: f.id, headshot: killer?.headshot || false, attack: killer?.attack || 'gun', weapon: killer?.weapon ?? (killer?.attack === 'grenade' ? 'grenade' : null), x: f.x, y: f.y, z: f.z });
    if (state.bomb.status === 'carried' && state.bomb.carrierId === f.id) { Object.assign(state.bomb, { status: 'dropped', carrierId: null, x: f.x, y: f.y, z: f.z, plantPlayerId: null, plantTicks: 0 }); emit(state, 'bombDrop', { playerId: f.id, x: f.x, y: f.y, z: f.z }); }
  }
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
      const inwardA = Math.max(0, a.vx * nx + a.vz * nz), inwardB = Math.max(0, -b.vx * nx - b.vz * nz), closing = inwardA + inwardB;
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
      a.vx -= inwardA * nx; a.vz -= inwardA * nz; b.vx += inwardB * nx; b.vz += inwardB * nz;
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
  state.grenades = [];
  for (const f of state.players) { f.vx = f.vy = f.vz = 0; f.interaction = null; f.interactTicks = 0; f.reloadTicks = 0; f.burstRemaining = 0; f.aiming = false; f.aimTicks = 0; cancelHeal(state, f, 'round'); f.grenadeThrowTicks = 0; clearMelee(f); }
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
    for (const f of state.players) { f.yaw = inputs[f.id].yaw; f.pitch = inputs[f.id].pitch; f.previousInput = inputs[f.id]; }
    if (--state.phaseTicks <= 0) {
      if (state.phase === 'countdown') { state.phase = 'buy'; state.phaseTicks = WORLD.buySeconds * TICK_RATE; state.objective = 'Choose your weapon. Movement and shots unlock at the bell.'; emit(state, 'buy'); }
      else { state.phase = 'fight'; state.phaseTicks = 0; for (const f of state.players) f.triggerBlocked = inputs[f.id].fire; state.objective = 'Attackers: plant A or B. Defenders: deny the plant or defuse.'; emit(state, 'fight', { round: state.round }); }
    }
    return state;
  }
  if (state.phase !== 'fight') return state;
  state.roundTicks = Math.max(0, state.roundTicks - 1);
  if (state.bomb.status === 'planted') { state.bomb.timerTicks = Math.max(0, state.bomb.timerTicks - 1); if (!state.bomb.timerTicks) { resolveRound(state); return state; } }
  const arena = MAPS[state.mapId], pending = [];
  for (const f of state.players) tickActions(state, f, inputs[f.id], arena);
  for (const f of state.players) movementTick(f, inputs[f.id], arena, [], state.players);
  separatePlayers(state, arena);
  for (const f of state.players) tickWeapon(state, f, inputs[f.id], pending);
  advanceGrenades(state, arena, { emit: (type, data) => emit(state, type, data), queueDamage: hit => pending.push(hit) });
  applyDamage(state, pending);
  for (const f of state.players) tickHealing(state, f);
  updateBomb(state, inputs); resolveRound(state);
  for (const f of state.players) f.previousInput = inputs[f.id];
  return state;
}
