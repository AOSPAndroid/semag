/** Voxel Wilds: editable solo survival, with fixed 120 Hz physical authority. */
import { BLOCKS, WORLD_SIZE, WORLD_HEIGHT, createWorld, seedValue, randomValue, getWorldBlock, setWorldBlock, inBounds, surfaceHeight } from './voxel-survival-world.js';
export { BLOCKS, WORLD_SIZE, WORLD_HEIGHT };
export const TICK_RATE = 120, FIXED_STEP = 1 / TICK_RATE, SAVE_VERSION = 1;
export const DAY_SECONDS = 180, DAYLIGHT_SECONDS = 110, REACH = 5;
export const BODY = Object.freeze({ radius: .3, height: 1.8, eyeHeight: 1.62, gravity: 20, jumpSpeed: 7.2 });
export const ITEMS = Object.freeze(Object.fromEntries([
  ['wood-pick', 'Cedar pick', '#b89360', 1, 'tool', { miningSpeed: 1.1, tier: 0, damage: 9, durability: 110 }],
  ['stone-pick', 'Stone pick', '#a4b0b9', 1, 'tool', { miningSpeed: 2, tier: 1, damage: 12, durability: 200 }],
  ['iron-pick', 'Iron pick', '#c4d0d7', 1, 'tool', { miningSpeed: 3.2, tier: 2, damage: 18, durability: 350 }],
  ['sword', 'Iron sword', '#d0dbe1', 1, 'tool', { miningSpeed: .55, tier: 0, damage: 35, durability: 180 }],
  ['dirt', 'Earth', '#836044', 64, 'block', { block: 2 }], ['stone', 'Stone', '#85919b', 64, 'block', { block: 4 }],
  ['wood', 'Cedar', '#846647', 64, 'block', { block: 5 }], ['plank', 'Cedar planks', '#bc9660', 64, 'block', { block: 9 }],
  ['workbench', 'Workbench', '#99764e', 8, 'block', { block: 10 }], ['campfire', 'Campfire', '#dd9b57', 8, 'block', { block: 11 }],
  ['torch', 'Lantern', '#f0c06b', 16, 'block', { block: 12 }], ['berries', 'Wild berries', '#bd6883', 32, 'food', { hunger: 18, healing: 2 }],
  ['bandage', 'Field bandage', '#ebdfce', 8, 'healing', { healing: 30 }], ['fiber', 'Cedar fiber', '#849b68', 64, 'material', {}],
  ['coal', 'Coal', '#4c545d', 64, 'material', {}], ['iron-ore', 'Iron ore', '#a99584', 64, 'material', {}], ['iron', 'Iron ingot', '#c4d0d7', 64, 'material', {}],
].map(([id, name, color, stack, kind, extra]) => [id, Object.freeze({ id, name, color, stack, kind, ...extra })])));
export const RECIPES = Object.freeze(Object.fromEntries([
  ['planks', 'Cedar planks', { wood: 1 }, { id: 'plank', count: 4 }],
  ['workbench', 'Workbench', { plank: 4 }, { id: 'workbench', count: 1 }],
  ['wood-pick', 'Cedar pick', { wood: 3, plank: 2 }, { id: 'wood-pick', count: 1 }],
  ['stone-pick', 'Stone pick', { stone: 3, wood: 2 }, { id: 'stone-pick', count: 1 }, 'workbench'],
  ['campfire', 'Campfire', { stone: 5, wood: 2, coal: 1 }, { id: 'campfire', count: 1 }, 'workbench'],
  ['iron', 'Smelt iron', { 'iron-ore': 1, coal: 1 }, { id: 'iron', count: 1 }, 'campfire'],
  ['iron-pick', 'Iron pick', { iron: 3, wood: 2 }, { id: 'iron-pick', count: 1 }, 'workbench'],
  ['sword', 'Iron sword', { iron: 3, wood: 1 }, { id: 'sword', count: 1 }, 'workbench'],
  ['bandage', 'Field bandage', { fiber: 3 }, { id: 'bandage', count: 1 }],
  ['torch', 'Lanterns', { coal: 1, wood: 1 }, { id: 'torch', count: 2 }],
].map(([id, name, ingredients, output, station]) => [id, Object.freeze({ id, name, ingredients: Object.freeze(ingredients), output: Object.freeze(output), ...(station ? { station } : {}) })])));
const EPS = 1e-7, MAX_EVENTS = 32, MAX_ENEMIES = 12;
const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
const finite = value => typeof value === 'number' && Number.isFinite(value);
const emptyInput = () => ({ jump: false, place: false, use: false });
export const getBlock = (state, x, y, z) => getWorldBlock(state.world, x, y, z);
export const getSelectedItem = state => state.inventory[state.selectedSlot] || null;
function emit(state, type, extra = {}) {
  const { id: blockId, ...data } = extra;
  state.events.push({ ...data, ...(blockId !== undefined ? { blockId } : {}), id: ++state.eventId, time: state.time, type });
  if (state.events.length > MAX_EVENTS) state.events.splice(0, state.events.length - MAX_EVENTS);
}
function note(state, text) { state.message = text; state.messageUntil = state.time + 3; }
export function createState({ seed } = {}) {
  const value = seedValue(seed === undefined ? Math.floor(Math.random() * 4294967295) + 1 : seed), world = createWorld(value);
  return {
    version: SAVE_VERSION, gameId: 'voxel-wilds', seed: value, rng: (value ^ 0x9e3779b9) >>> 0 || 1,
    tick: 0, time: 30, elapsed: 0, day: 1, dayProgress: 30 / DAY_SECONDS, night: false, dusk: 0,
    phase: 'playing', paused: false, world,
    player: { x: 20.5, y: 4, z: 20.5, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, hp: 100, maxHp: 100, hunger: 100, grounded: true, radius: BODY.radius, height: BODY.height, eyeHeight: BODY.eyeHeight, jumpGrace: .075, attackCooldown: 0, swingTime: 0, hurtTime: 0, lastDamage: 0 },
    inventory: [{ id: 'wood-pick', count: 1, durability: ITEMS['wood-pick'].durability }, { id: 'berries', count: 4 }, { id: 'bandage', count: 1 }, null, null, null, null, null],
    selectedSlot: 0, target: null, mining: null, previousInput: emptyInput(), enemies: [], enemyId: 0,
    projectiles: [], projectileId: 0, regrowth: [], spawnTimer: 5, events: [], eventId: 0, message: 'Gather cedar. Build a workbench before dusk.', messageUntil: 36,
    objective: 'Prepare by day. Hold your shelter through the night.', stats: { mined: 0, built: 0, kills: 0, crafted: 0, nights: 0 },
  };
}
export function selectSlot(state, index) {
  if (!Number.isInteger(index) || index < 0 || index >= 8 || state.phase !== 'playing') return false;
  if (state.selectedSlot !== index) state.mining = null;
  state.selectedSlot = index; return true;
}
export function setPaused(state, paused) {
  state.paused = paused === true; state.previousInput = emptyInput(); state.mining = null;
  state.player.vx = state.player.vz = 0; return state;
}

/** Local broad phase: at most a few dozen cells per body, never a world scan. */
function cellOverlap(body, x, y, z) {
  return body.x + body.radius > x + EPS && body.x - body.radius < x + 1 - EPS && body.y + body.height > y + EPS && body.y < y + 1 - EPS && body.z + body.radius > z + EPS && body.z - body.radius < z + 1 - EPS;
}
export function canOccupy(state, x, y, z, radius = BODY.radius, height = BODY.height) {
  if (![x, y, z, radius, height].every(finite) || radius <= 0 || height <= 0 || x - radius < 0 || x + radius > state.world.width || z - radius < 0 || z + radius > state.world.depth || y < 0 || y + height > state.world.height) return false;
  const body = { x, y, z, radius, height };
  for (let cy = Math.floor(y + EPS); cy <= Math.floor(y + height - EPS); cy++) for (let cz = Math.floor(z - radius + EPS); cz <= Math.floor(z + radius - EPS); cz++) for (let cx = Math.floor(x - radius + EPS); cx <= Math.floor(x + radius - EPS); cx++) if (getBlock(state, cx, cy, cz) && cellOverlap(body, cx, cy, cz)) return false;
  return true;
}
function eachLivingPeer(state, body, visit) {
  if (body !== state.player && state.player.hp > 0) visit(state.player);
  for (const enemy of state.enemies) if (enemy !== body && enemy.hp > 0) visit(enemy);
}
function verticalOverlap(a, b) { return a.y + a.height > b.y + EPS && a.y < b.y + b.height - EPS; }
function peersClear(state, body, x, y, z) {
  const proposed = { x, y, z, radius: body.radius, height: body.height }; let clear = true;
  eachLivingPeer(state, body, peer => {
    const radii = proposed.radius + peer.radius;
    if (verticalOverlap(proposed, peer) && Math.hypot(x - peer.x, z - peer.z) < radii - EPS) clear = false;
  });
  return clear;
}
/** Presentation may sample only poses that clear both the grid and living foes. */
export function canPlayerOccupy(state, x, y, z) {
  return canOccupy(state, x, y, z) && peersClear(state, state.player, x, y, z);
}
function peerSweep(state, body, axis, amount) {
  let allowed = amount, blocked = false;
  eachLivingPeer(state, body, peer => {
    const radii = body.radius + peer.radius;
    if (axis === 'y') {
      if (Math.hypot(body.x - peer.x, body.z - peer.z) >= radii - EPS) return;
      if (allowed > 0 && body.y + body.height <= peer.y + EPS && body.y + body.height + allowed > peer.y) {
        allowed = Math.max(0, peer.y - body.height - body.y); blocked = true;
      } else if (allowed < 0 && body.y >= peer.y + peer.height - EPS && body.y + allowed < peer.y + peer.height) {
        allowed = Math.min(0, peer.y + peer.height - body.y); blocked = true;
      }
      return;
    }
    if (!verticalOverlap(body, peer)) return;
    const otherAxis = axis === 'x' ? 'z' : 'x', otherDistance = body[otherAxis] - peer[otherAxis];
    if (Math.abs(otherDistance) >= radii - EPS) return;
    const halfSpan = Math.sqrt(Math.max(0, radii * radii - otherDistance * otherDistance));
    const low = peer[axis] - halfSpan, high = peer[axis] + halfSpan, start = body[axis], end = start + allowed;
    if (allowed > 0 && start <= low + EPS && end > low) { allowed = Math.max(0, low - start); blocked = true; }
    else if (allowed < 0 && start >= high - EPS && end < high) { allowed = Math.min(0, high - start); blocked = true; }
    // Defensive recovery for a caller-supplied embedded body: permit leaving,
    // but never drive it further toward the peer's centre.
    else if (start > low + EPS && start < high - EPS && ((allowed > 0 && start < peer[axis]) || (allowed < 0 && start > peer[axis]))) { allowed = 0; blocked = true; }
  });
  return { amount: allowed, blocked };
}
function moveAxis(state, body, axis, amount) {
  if (!amount) return 0;
  const contact = peerSweep(state, body, axis, amount); amount = contact.amount;
  if (!amount) return contact.blocked ? 2 : 0;
  const count = Math.max(1, Math.ceil(Math.abs(amount) / .2)), increment = amount / count;
  let blocked = contact.blocked ? 2 : 0;
  for (let i = 0; i < count; i++) {
    const previous = body[axis]; body[axis] += increment;
    if (!canOccupy(state, body.x, body.y, body.z, body.radius, body.height)) {
      let lo = 0, hi = 1;
      // Find contact conservatively; axis-only sweep cannot cut corners.
      for (let n = 0; n < 12; n++) { const mid = (lo + hi) / 2; body[axis] = previous + increment * mid; if (canOccupy(state, body.x, body.y, body.z, body.radius, body.height)) lo = mid; else hi = mid; }
      body[axis] = previous + increment * lo; blocked |= 1; break;
    }
  }
  return blocked;
}
function onGround(state, body) { return !canOccupy(state, body.x, body.y - .002, body.z, body.radius, body.height) || !peersClear(state, body, body.x, body.y - .002, body.z); }
function hurtPlayer(state, damage, cause, ignoreGrace = false) {
  const p = state.player; if (state.phase !== 'playing' || (!ignoreGrace && p.hurtTime > 0)) return;
  p.hp = Math.max(0, p.hp - damage); p.hurtTime = .45; p.lastDamage = damage;
  emit(state, 'hurt', { x: p.x, y: p.y + 1, z: p.z, damage, cause });
  if (p.hp <= 0) { state.phase = 'dead'; state.mining = null; p.vx = p.vy = p.vz = 0; note(state, `The wilds claimed you: ${cause}.`); emit(state, 'death', { cause }); }
}
function movePlayer(state, input, dt) {
  const p = state.player;
  p.yaw = finite(input.yaw) ? Math.atan2(Math.sin(input.yaw), Math.cos(input.yaw)) : p.yaw;
  p.pitch = finite(input.pitch) ? clamp(input.pitch, -1.48, 1.48) : p.pitch;
  let forward = finite(input.forward) ? clamp(input.forward, -1, 1) : (input.up ? 1 : 0) - (input.down ? 1 : 0);
  let strafe = finite(input.strafe) ? clamp(input.strafe, -1, 1) : (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const length = Math.hypot(forward, strafe); if (length > 1) { forward /= length; strafe /= length; }
  const sprinting = input.sprint === true && p.hunger > 8 && length > .1, speed = sprinting ? 5.5 : 3.5;
  const targetX = (Math.sin(p.yaw) * forward + Math.cos(p.yaw) * strafe) * speed;
  const targetZ = (-Math.cos(p.yaw) * forward + Math.sin(p.yaw) * strafe) * speed;
  const response = 1 - Math.exp(-(p.grounded ? 20 : 7) * dt);
  p.vx += (targetX - p.vx) * response; p.vz += (targetZ - p.vz) * response;
  p.grounded = onGround(state, p); p.jumpGrace = p.grounded ? .075 : Math.max(0, p.jumpGrace - dt);
  if (input.jump && !state.previousInput.jump && p.jumpGrace > 0) { p.vy = BODY.jumpSpeed; p.grounded = false; p.jumpGrace = 0; p.hunger = Math.max(0, p.hunger - .3); }
  if (moveAxis(state, p, 'x', p.vx * dt)) p.vx = 0;
  if (moveAxis(state, p, 'z', p.vz * dt)) p.vz = 0;
  p.vy = Math.max(-24, p.vy - BODY.gravity * dt);
  const velocity = p.vy;
  if (moveAxis(state, p, 'y', p.vy * dt)) {
    p.vy = 0; p.grounded = velocity < 0;
    if (velocity < -10) hurtPlayer(state, Math.round((-velocity - 10) * 4), 'fall', true);
  } else p.grounded = false;
  p.hunger = Math.max(0, p.hunger - dt * (.13 + (state.night ? .07 : 0) + (sprinting ? .27 : 0)));
}

/** Exact grid DDA. The first solid face wins, including at negative directions. */
export function raycast(state, origin, direction, reach = REACH) {
  if (!origin || !direction || ![origin.x, origin.y, origin.z, direction.x, direction.y, direction.z, reach].every(finite) || reach < 0) return null;
  const length = Math.hypot(direction.x, direction.y, direction.z); if (length < 1e-10) return null;
  const dir = { x: direction.x / length, y: direction.y / length, z: direction.z / length };
  let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z), distance = 0, normal = { x: 0, y: 0, z: 0 };
  const sx = Math.sign(dir.x), sy = Math.sign(dir.y), sz = Math.sign(dir.z);
  const delta = { x: sx ? Math.abs(1 / dir.x) : Infinity, y: sy ? Math.abs(1 / dir.y) : Infinity, z: sz ? Math.abs(1 / dir.z) : Infinity };
  let tx = sx ? ((sx > 0 ? x + 1 : x) - origin.x) / dir.x : Infinity;
  let ty = sy ? ((sy > 0 ? y + 1 : y) - origin.y) / dir.y : Infinity;
  let tz = sz ? ((sz > 0 ? z + 1 : z) - origin.z) / dir.z : Infinity;
  const limit = Math.min(reach, 128);
  for (let i = 0; i < 400 && distance <= limit + EPS; i++) {
    const id = getBlock(state, x, y, z);
    if (id) return { x, y, z, id, distance, normal, point: { x: origin.x + dir.x * distance, y: origin.y + dir.y * distance, z: origin.z + dir.z * distance } };
    if (tx <= ty && tx <= tz) { distance = tx; tx += delta.x; x += sx; normal = { x: -sx, y: 0, z: 0 }; }
    else if (ty <= tz) { distance = ty; ty += delta.y; y += sy; normal = { x: 0, y: -sy, z: 0 }; }
    else { distance = tz; tz += delta.z; z += sz; normal = { x: 0, y: 0, z: -sz }; }
  }
  return null;
}
export function lookDirection(player) { const c = Math.cos(player.pitch); return { x: Math.sin(player.yaw) * c, y: Math.sin(player.pitch), z: -Math.cos(player.yaw) * c }; }
const eye = p => ({ x: p.x, y: p.y + p.eyeHeight, z: p.z });
function lineClear(state, a, b) { const direction = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z }, length = Math.hypot(direction.x, direction.y, direction.z); const hit = raycast(state, a, direction, length); return !hit || hit.distance >= length - .015; }

function copyInventory(inventory) { return inventory.map(slot => slot ? { ...slot } : null); }
export function inventoryCount(state, id) { return state.inventory.reduce((sum, slot) => sum + (slot?.id === id ? slot.count : 0), 0); }
function addTo(inventory, id, count, durability) {
  const item = ITEMS[id]; if (!item || !Number.isInteger(count) || count <= 0) return false;
  let left = count;
  if (item.stack > 1) for (const slot of inventory) if (slot?.id === id && slot.count < item.stack) { const n = Math.min(left, item.stack - slot.count); slot.count += n; left -= n; if (!left) return true; }
  for (let i = 0; i < inventory.length && left; i++) if (!inventory[i]) { const n = Math.min(left, item.stack); inventory[i] = { id, count: n, ...(item.durability ? { durability: durability ?? item.durability } : {}) }; left -= n; }
  return left === 0;
}
function removeFrom(inventory, id, count) {
  let left = count;
  for (let i = 0; i < inventory.length && left; i++) if (inventory[i]?.id === id) { const n = Math.min(left, inventory[i].count); inventory[i].count -= n; left -= n; if (!inventory[i].count) inventory[i] = null; }
  return left === 0;
}
function stationNear(state, station) {
  const id = station === 'workbench' ? 10 : 11, p = state.player;
  for (let y = Math.max(1, Math.floor(p.y - 3)); y <= Math.min(WORLD_HEIGHT - 1, Math.ceil(p.y + 3)); y++) for (let z = Math.max(0, Math.floor(p.z - 3)); z <= Math.min(WORLD_SIZE - 1, Math.ceil(p.z + 3)); z++) for (let x = Math.max(0, Math.floor(p.x - 3)); x <= Math.min(WORLD_SIZE - 1, Math.ceil(p.x + 3)); x++) {
    if (getBlock(state, x, y, z) !== id) continue;
    const b = { x: x + .5, y: y + .6, z: z + .5 }; if (Math.hypot(b.x - p.x, b.y - p.y - .8, b.z - p.z) <= 3.6 && lineClear(state, eye(p), b)) return true;
    // The station itself is the first solid contact: look toward its front face.
    const hit = raycast(state, eye(p), { x: b.x - p.x, y: b.y - p.y - p.eyeHeight, z: b.z - p.z }, 3.6);
    if (hit?.x === x && hit.y === y && hit.z === z) return true;
  }
  return false;
}
function craftPlan(state, recipeId) {
  const recipe = RECIPES[recipeId];
  if (!Object.hasOwn(RECIPES, recipeId)) return { ok: false, error: 'Unknown recipe.' };
  if (state.phase !== 'playing') return { ok: false, error: 'Start a new expedition first.' };
  if (recipe.station && !stationNear(state, recipe.station)) return { ok: false, error: `Place a ${recipe.station} nearby.` };
  for (const [id, count] of Object.entries(recipe.ingredients)) if (inventoryCount(state, id) < count) return { ok: false, error: `Need ${count} ${ITEMS[id].name.toLowerCase()}.` };
  const inventory = copyInventory(state.inventory);
  for (const [id, count] of Object.entries(recipe.ingredients)) removeFrom(inventory, id, count);
  if (!addTo(inventory, recipe.output.id, recipe.output.count)) return { ok: false, error: 'Inventory full. Make space first.' };
  return { ok: true, inventory, recipe };
}
export function canCraft(state, recipeId) { const plan = craftPlan(state, recipeId); return plan.ok ? { ok: true } : plan; }
export function craft(state, recipeId) {
  const plan = craftPlan(state, recipeId); if (!plan.ok) { note(state, plan.error); return { ok: false, error: plan.error }; }
  state.inventory = plan.inventory; state.stats.crafted++; state.mining = null;
  emit(state, 'crafted', { item: plan.recipe.output.id, count: plan.recipe.output.count }); note(state, `${plan.recipe.name} crafted.`); return { ok: true };
}
export function useSelected(state) {
  const slot = getSelectedItem(state), item = slot && ITEMS[slot.id];
  if (state.phase !== 'playing' || state.paused || !item || !['food', 'healing'].includes(item.kind)) return { ok: false, error: 'Select berries or a bandage.' };
  if (item.kind === 'food' && state.player.hunger >= 99 && state.player.hp >= 99) return { ok: false, error: 'Already nourished.' };
  if (item.kind === 'healing' && state.player.hp >= 99) return { ok: false, error: 'Health is full.' };
  state.player.hunger = Math.min(100, state.player.hunger + (item.hunger || 0)); state.player.hp = Math.min(100, state.player.hp + (item.healing || 0));
  const id = slot.id; slot.count--; if (!slot.count) state.inventory[state.selectedSlot] = null;
  emit(state, 'used', { item: id }); note(state, item.kind === 'food' ? 'Fed for the road ahead.' : 'Wounds dressed.'); return { ok: true };
}
/** An explicit inventory action makes every slot recoverable, even in menus. */
export function discardSelected(state, count = 1) {
  const slot = getSelectedItem(state);
  if (state.phase !== 'playing' || !slot || !Number.isInteger(count) || count < 1 || count > slot.count) return { ok: false, error: 'Select an item to discard.' };
  const id = slot.id; slot.count -= count; if (!slot.count) state.inventory[state.selectedSlot] = null;
  state.mining = null; emit(state, 'discarded', { item: id, count }); note(state, `${count} ${ITEMS[id].name.toLowerCase()} discarded.`); return { ok: true };
}
function placementFor(state, target) {
  const slot = getSelectedItem(state), item = slot && ITEMS[slot.id]; if (!target || !item?.block || !target.normal || Math.abs(target.normal.x) + Math.abs(target.normal.y) + Math.abs(target.normal.z) !== 1) return null;
  const x = target.x + target.normal.x, y = target.y + target.normal.y, z = target.z + target.normal.z;
  const result = { x, y, z, id: item.block, valid: false };
  if (!inBounds(state.world, x, y, z) || y === 0 || y >= WORLD_HEIGHT - 1) return { ...result, reason: 'Outside the buildable world.' };
  if (getBlock(state, x, y, z)) return { ...result, reason: 'That cell is occupied.' };
  if (cellOverlap(state.player, x, y, z) || state.enemies.some(e => cellOverlap(e, x, y, z))) return { ...result, reason: 'Leave room to move.' };
  if (!getBlock(state, target.x, target.y, target.z)) return { ...result, reason: 'A block needs a solid attachment.' };
  if (target.distance > REACH + EPS) return { ...result, reason: 'Too far away.' };
  return { ...result, valid: true };
}
export function getPlacement(state) { return placementFor(state, state.target); }
function placeSelected(state) {
  const placement = getPlacement(state);
  if (!placement?.valid) { note(state, placement?.reason || 'Select a block and aim at a solid face.'); return false; }
  const slot = getSelectedItem(state);
  setWorldBlock(state.world, placement.x, placement.y, placement.z, placement.id); slot.count--; if (!slot.count) state.inventory[state.selectedSlot] = null;
  state.stats.built++; state.mining = null; emit(state, 'placed', placement); return true;
}
function wearTool(state) {
  const slot = getSelectedItem(state); if (!slot || !ITEMS[slot.id].durability) return;
  slot.durability--; if (slot.durability <= 0) { const name = ITEMS[slot.id].name; state.inventory[state.selectedSlot] = null; note(state, `${name} broke. Craft another tool.`); emit(state, 'broken', { item: slot.id }); }
}
function mineTarget(state, dt) {
  const target = state.target; if (!target) { state.mining = null; return; }
  const block = BLOCKS[target.id], slot = getSelectedItem(state), item = slot && ITEMS[slot.id];
  if (!finite(block.hardness)) { state.mining = null; note(state, 'Bedrock cannot be mined.'); return; }
  if ((block.tier || 0) > (item?.tier || 0)) { state.mining = null; note(state, 'Iron needs a stone or iron pick.'); return; }
  const toolSpeed = item?.miningSpeed || .45, total = block.hardness / toolSpeed;
  if (!state.mining || state.mining.x !== target.x || state.mining.y !== target.y || state.mining.z !== target.z || state.mining.id !== target.id) state.mining = { x: target.x, y: target.y, z: target.z, id: target.id, progress: 0, total };
  state.mining.total = total; state.mining.progress += dt;
  if (state.mining.progress + EPS < total) return;
  const inventory = copyInventory(state.inventory);
  if (!addTo(inventory, block.item, block.count || 1)) { state.mining.progress = Math.min(total, state.mining.progress); note(state, 'Inventory full. Craft or build to make space.'); return; }
  // Commit only after the complete drop fits; a failed harvest changes no cell.
  state.inventory = inventory; setWorldBlock(state.world, target.x, target.y, target.z, 0); state.stats.mined++;
  if (target.id === 13) state.regrowth.push({ x: target.x, y: target.y, z: target.z, at: state.time + DAY_SECONDS * 2 });
  wearTool(state); state.player.hunger = Math.max(0, state.player.hunger - .18);
  emit(state, 'mined', { ...target, item: block.item, count: block.count || 1 }); state.mining = null;
}

function rayBody(origin, direction, body, reach) {
  let lo = 0, hi = reach;
  for (const axis of ['x', 'y', 'z']) {
    const a = axis === 'y' ? body.y : body[axis] - body.radius, b = axis === 'y' ? body.y + body.height : body[axis] + body.radius, d = direction[axis];
    if (Math.abs(d) < EPS) { if (origin[axis] < a || origin[axis] > b) return null; continue; }
    let near = (a - origin[axis]) / d, far = (b - origin[axis]) / d; if (near > far) [near, far] = [far, near];
    lo = Math.max(lo, near); hi = Math.min(hi, far); if (lo > hi) return null;
  }
  return lo;
}
function attackEnemy(state) {
  const p = state.player; if (p.attackCooldown > 0) return false;
  const origin = eye(p), direction = lookDirection(p), reach = getSelectedItem(state)?.id === 'sword' ? 3.1 : 2.65;
  let victim = null, distance = Math.min(reach, state.target?.distance ?? reach);
  for (const enemy of state.enemies) {
    const contact = rayBody(origin, direction, enemy, reach);
    if (contact !== null && contact < distance - EPS && enemy.hp > 0) { victim = enemy; distance = contact; }
  }
  if (!victim) return false;
  const item = ITEMS[getSelectedItem(state)?.id], damage = item?.damage || 5;
  p.attackCooldown = item?.id === 'sword' ? .42 : .55; p.swingTime = .22; victim.hp = Math.max(0, victim.hp - damage); victim.hitFlash = .2;
  victim.vx += direction.x * 3; victim.vz += direction.z * 3; wearTool(state); p.hunger = Math.max(0, p.hunger - .15);
  emit(state, 'hit', { x: victim.x, y: victim.y + .9, z: victim.z, damage, enemyId: victim.id });
  if (victim.hp <= 0) { state.stats.kills++; emit(state, 'kill', { enemyId: victim.id, x: victim.x, y: victim.y, z: victim.z }); }
  return true;
}
function spawnEnemy(state) {
  if (state.enemies.length >= MAX_ENEMIES) return;
  const p = state.player;
  for (let attempt = 0; attempt < 32; attempt++) {
    const angle = randomValue(state) * Math.PI * 2, distance = 12 + randomValue(state) * 9;
    const x = clamp(p.x + Math.cos(angle) * distance, 1.5, WORLD_SIZE - 1.5), z = clamp(p.z + Math.sin(angle) * distance, 1.5, WORLD_SIZE - 1.5);
    if (Math.hypot(x - p.x, z - p.z) < 10) continue;
    const type = state.day >= 3 && randomValue(state) < .3 ? 'wisp' : state.day >= 2 && randomValue(state) < .35 ? 'archer' : 'crawler';
    const radius = type === 'wisp' ? .28 : .32, height = type === 'wisp' ? .65 : 1.65;
    let y = surfaceHeight(state.world, Math.floor(x), Math.floor(z));
    if (type === 'wisp') y = Math.min(WORLD_HEIGHT - 2, y + 2);
    if (!canOccupy(state, x, y, z, radius, height) || !peersClear(state, { radius, height }, x, y, z)) continue;
    const maxHp = (type === 'wisp' ? 30 : type === 'archer' ? 46 : 42) + Math.min(40, (state.day - 1) * 6);
    state.enemies.push({ id: ++state.enemyId, type, x, y, z, vx: 0, vy: 0, vz: 0, yaw: angle, radius, height, hp: maxHp, maxHp, attackCooldown: 1, hitFlash: 0, grounded: false, stuckTime: 0, digTime: 0, digTarget: null, daylightTime: 0 });
    emit(state, 'spawn', { enemyId: state.enemyId, x, y, z }); return;
  }
}
function digObstacle(state, enemy, dt) {
  const p = state.player, direction = { x: p.x - enemy.x, y: p.y + .8 - enemy.y - .8, z: p.z - enemy.z };
  const hit = raycast(state, { x: enemy.x, y: enemy.y + .8, z: enemy.z }, direction, 1.5);
  // Raiders can dismantle shelter and natural cover, but never bedrock.
  if (!hit || [1, 7, 8].includes(hit.id)) { enemy.digTime = 0; enemy.digTarget = null; return; }
  const previous = enemy.digTarget;
  if (!previous || previous.x !== hit.x || previous.y !== hit.y || previous.z !== hit.z || previous.id !== hit.id) {
    enemy.digTime = 0; enemy.digTarget = { x: hit.x, y: hit.y, z: hit.z, id: hit.id };
  }
  const baseSeconds = hit.id === 4 ? 9 : hit.id === 5 ? 5.6 : hit.id === 9 ? 5.2 : hit.id === 6 ? 1.2 : hit.id === 2 || hit.id === 3 ? 3 : 4.5;
  const breakSeconds = Math.max(.9, baseSeconds / (1 + Math.min(8, state.day - 1) * .15));
  enemy.digTime += dt;
  if (enemy.digTime < breakSeconds) return;
  setWorldBlock(state.world, hit.x, hit.y, hit.z, 0); emit(state, 'breached', { x: hit.x, y: hit.y, z: hit.z, blockId: hit.id });
  enemy.digTime = 0; enemy.digTarget = null;
}
function enemiesStep(state, dt) {
  const p = state.player;
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) continue;
    enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt); enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
    if (!state.night) { enemy.daylightTime += dt; if (enemy.daylightTime > 8) { enemy.hp = 0; continue; } }
    const dx = p.x - enemy.x, dz = p.z - enemy.z, distance = Math.hypot(dx, dz), vertical = p.y - enemy.y;
    const speed = (enemy.type === 'wisp' ? 3.1 : enemy.type === 'archer' ? 2.1 : 2.45) + Math.min(1.4, (state.day - 1) * .12);
    const approach = enemy.type === 'archer' && distance < 7 && Math.abs(vertical) < 4 ? .15 : 1;
    const ux = distance > .01 ? dx / distance : 0, uz = distance > .01 ? dz / distance : 0;
    enemy.yaw = Math.atan2(ux, -uz); const response = 1 - Math.exp(-7 * dt);
    enemy.vx += (ux * speed * approach - enemy.vx) * response; enemy.vz += (uz * speed * approach - enemy.vz) * response;
    const blockedX = moveAxis(state, enemy, 'x', enemy.vx * dt), blockedZ = moveAxis(state, enemy, 'z', enemy.vz * dt);
    if (((blockedX | blockedZ) & 2) && !((blockedX | blockedZ) & 1) && distance > .9) {
      // A packed ring cannot shrink in unison. Alternate small side steps,
      // including a slight retreat, open a lane for the next creature rather
      // than turning neighbouring bodies into an invincible wall.
      const side = enemy.id % 2 ? 1 : -1, sidestep = speed * .8 * dt;
      moveAxis(state, enemy, 'x', (-uz * side - ux * .45) * sidestep);
      moveAxis(state, enemy, 'z', (ux * side - uz * .45) * sidestep);
    }
    enemy.grounded = onGround(state, enemy);
    if (enemy.type === 'wisp') {
      enemy.vy = clamp((p.y + 1.1 - enemy.y) * 2, -2.6, 2.6);
      if (moveAxis(state, enemy, 'y', enemy.vy * dt)) enemy.vy = 0;
    } else {
      // Hop onto a single ledge when there is standing room above it. A tall
      // wall keeps the creature grounded, so its breach targets do not swap
      // between rows on every futile jump.
      const canStepUp = canOccupy(state, enemy.x + ux * .5, enemy.y + 1.02, enemy.z + uz * .5, enemy.radius, enemy.height) && peersClear(state, enemy, enemy.x + ux * .5, enemy.y + 1.02, enemy.z + uz * .5);
      const blockedByWorld = ((blockedX | blockedZ) & 1) !== 0;
      if (enemy.grounded && ((blockedX || blockedZ) ? blockedByWorld && canStepUp : vertical > .6)) enemy.vy = 7.2;
      enemy.vy = Math.max(-20, enemy.vy - BODY.gravity * dt);
      if (moveAxis(state, enemy, 'y', enemy.vy * dt)) { enemy.grounded = enemy.vy < 0; enemy.vy = 0; }
    }
    if (((blockedX | blockedZ) & 1) || (vertical > 1.5 && distance < 2)) { enemy.stuckTime += dt; digObstacle(state, enemy, dt); }
    else { enemy.stuckTime = 0; enemy.digTime = Math.max(0, enemy.digTime - dt); if (enemy.digTime === 0) enemy.digTarget = null; }
    const from = { x: enemy.x, y: enemy.y + enemy.height * .8, z: enemy.z }, to = { x: p.x, y: p.y + 1, z: p.z };
    if (enemy.attackCooldown <= 0 && enemy.type === 'archer' && distance >= 2 && distance < 14 && lineClear(state, from, to) && state.projectiles.length < 24) {
      const length = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z), velocity = Math.min(16, 8 + state.day * .3);
      state.projectiles.push({ id: ++state.projectileId, x: from.x, y: from.y, z: from.z, vx: (to.x - from.x) / length * velocity, vy: (to.y - from.y) / length * velocity, vz: (to.z - from.z) / length * velocity, life: 3, damage: 14 + Math.min(10, state.day * 2) });
      enemy.attackCooldown = 2.4; emit(state, 'shot', { enemyId: enemy.id, ...from });
    } else if (enemy.attackCooldown <= 0 && Math.hypot(p.x - enemy.x, p.z - enemy.z) < .95 && Math.max(0, p.y - enemy.y - enemy.height, enemy.y - p.y - p.height) < .25 && lineClear(state, from, to)) {
      hurtPlayer(state, (enemy.type === 'wisp' ? 10 : 13) + Math.min(8, state.day), 'night creature'); enemy.attackCooldown = 1.25;
    }
  }
  state.enemies = state.enemies.filter(enemy => enemy.hp > 0);
  for (const projectile of state.projectiles) {
    projectile.life -= dt;
    const origin = { x: projectile.x, y: projectile.y, z: projectile.z }, velocity = { x: projectile.vx, y: projectile.vy, z: projectile.vz }, length = Math.hypot(velocity.x, velocity.y, velocity.z), travel = length * dt;
    const direction = { x: velocity.x / length, y: velocity.y / length, z: velocity.z / length }, wall = raycast(state, origin, direction, travel), body = rayBody(origin, direction, p, travel);
    if (wall || body !== null) { if (body !== null && (!wall || body < wall.distance)) hurtPlayer(state, projectile.damage, 'raider arrow'); projectile.life = 0; }
    else {
      projectile.x += projectile.vx * dt; projectile.y += projectile.vy * dt; projectile.z += projectile.vz * dt;
      if (projectile.x < 0 || projectile.x >= WORLD_SIZE || projectile.y < 0 || projectile.y >= WORLD_HEIGHT || projectile.z < 0 || projectile.z >= WORLD_SIZE) projectile.life = 0;
    }
  }
  state.projectiles = state.projectiles.filter(projectile => projectile.life > 0);
}
function campfireStep(state, dt) {
  if (state.player.hunger < 55 || state.player.hp >= 100 || state.player.hurtTime > 0 || state.tick % 120 !== 0) return;
  if (stationNear(state, 'campfire')) state.player.hp = Math.min(100, state.player.hp + 1.5);
}
function regrowthStep(state) {
  if (state.tick % TICK_RATE !== 0 || !state.regrowth.length) return;
  state.regrowth = state.regrowth.filter(shrub => {
    if (state.time < shrub.at || getBlock(state, shrub.x, shrub.y, shrub.z) || !getBlock(state, shrub.x, shrub.y - 1, shrub.z) || cellOverlap(state.player, shrub.x, shrub.y, shrub.z) || state.enemies.some(enemy => cellOverlap(enemy, shrub.x, shrub.y, shrub.z))) return true;
    setWorldBlock(state.world, shrub.x, shrub.y, shrub.z, 13); return false;
  });
}
function stepTick(state, rawInput, dt) {
  if (state.paused || state.phase !== 'playing') return state;
  if (!finite(dt) || dt <= 0 || dt > 1 / 30 + EPS) return state;
  const input = rawInput || {}; state.tick++; state.time += dt; state.elapsed += dt;
  const beforeNight = state.night, previousDay = state.day;
  state.day = Math.floor(state.time / DAY_SECONDS) + 1; state.dayProgress = (state.time % DAY_SECONDS) / DAY_SECONDS;
  state.night = state.time % DAY_SECONDS >= DAYLIGHT_SECONDS; state.dusk = clamp((state.time % DAY_SECONDS - 85) / 25, 0, 1);
  if (!beforeNight && state.night) { note(state, 'Nightfall. Raiders approach your shelter.'); emit(state, 'night', { day: state.day }); state.spawnTimer = .2; }
  if (previousDay !== state.day) { state.stats.nights++; note(state, 'Dawn. Recover and reinforce: the next night is harsher.'); emit(state, 'dawn', { day: state.day }); }
  const p = state.player; p.attackCooldown = Math.max(0, p.attackCooldown - dt); p.swingTime = Math.max(0, p.swingTime - dt); p.hurtTime = Math.max(0, p.hurtTime - dt);
  movePlayer(state, input, dt); if (state.phase !== 'playing') return state;
  state.target = raycast(state, eye(p), lookDirection(p));
  if (input.use && !state.previousInput.use) { const result = useSelected(state); if (!result.ok) note(state, result.error); }
  if (input.place && !state.previousInput.place) placeSelected(state);
  if (input.mine || input.attack) { const hitEnemy = attackEnemy(state); if (!hitEnemy && !p.attackCooldown && input.mine) mineTarget(state, dt); else state.mining = null; }
  else state.mining = null;
  if (state.night) { state.spawnTimer -= dt; if (state.spawnTimer <= 0) { spawnEnemy(state); state.spawnTimer = Math.max(2.7, 8 - (state.day - 1) * .8); } }
  enemiesStep(state, dt); campfireStep(state, dt); regrowthStep(state);
  if (p.hunger <= 0) { p.hp = Math.max(0, p.hp - 2 * dt); if (p.hp <= 0) hurtPlayer(state, 1, 'starvation', true); }
  if (state.time > state.messageUntil) state.message = '';
  state.previousInput = { jump: input.jump === true, place: input.place === true, use: input.use === true };
  return state;
}
/** Fixed ticks only. A caller may batch at most four whole ticks, never enlarge physics. */
export function step(state, rawInput = {}, dt = FIXED_STEP) {
  if (!finite(dt) || dt <= 0 || dt > FIXED_STEP * 4 + EPS) return state;
  const ticks = Math.round(dt / FIXED_STEP); if (ticks < 1 || Math.abs(dt - ticks * FIXED_STEP) > EPS) return state;
  for (let i = 0; i < ticks; i++) stepTick(state, rawInput, FIXED_STEP);
  return state;
}

export function snapshot(state) {
  return {
    version: SAVE_VERSION, gameId: 'voxel-wilds', seed: state.seed, rng: state.rng, tick: state.tick, time: state.time, elapsed: state.elapsed,
    phase: state.phase, player: { ...state.player }, inventory: copyInventory(state.inventory), selectedSlot: state.selectedSlot,
    blocks: Array.from(state.world.blocks), enemies: state.enemies.map(enemy => ({ ...enemy, ...(enemy.digTarget ? { digTarget: { ...enemy.digTarget } } : {}) })), enemyId: state.enemyId,
    projectiles: state.projectiles.map(projectile => ({ ...projectile })), projectileId: state.projectileId, regrowth: state.regrowth.map(shrub => ({ ...shrub })), spawnTimer: state.spawnTimer,
    stats: { ...state.stats },
  };
}
export function serialize(state) { return JSON.stringify(snapshot(state)); }
/** Reject malformed, out-of-bounds or embedded-body saves before committing. */
export function restore(source) {
  let data; try { data = typeof source === 'string' ? JSON.parse(source) : source; } catch { return null; }
  if (!data || typeof data !== 'object' || data.version !== SAVE_VERSION || data.gameId !== 'voxel-wilds' || !Number.isInteger(data.seed) || data.seed < 1 || data.seed > 4294967295 || !Number.isInteger(data.rng) || data.rng < 1 || data.rng > 4294967295 || !Number.isInteger(data.tick) || data.tick < 0 || data.tick > 1e9 || !finite(data.time) || data.time < 30 || data.time > 1e7 || !finite(data.elapsed) || data.elapsed < 0 || Math.abs(data.time - data.elapsed - 30) > .01 || !['playing', 'dead'].includes(data.phase)) return null;
  if (!Array.isArray(data.blocks) || data.blocks.length !== WORLD_SIZE * WORLD_SIZE * WORLD_HEIGHT || data.blocks.some(id => !Number.isInteger(id) || !Object.hasOwn(BLOCKS, id))) return null;
  for (let z = 0; z < WORLD_SIZE; z++) for (let x = 0; x < WORLD_SIZE; x++) if (data.blocks[x + WORLD_SIZE * z] !== 1) return null;
  for (let i = WORLD_SIZE * WORLD_SIZE; i < data.blocks.length; i++) if (data.blocks[i] === 1) return null;
  if (!Array.isArray(data.inventory) || data.inventory.length !== 8 || !Number.isInteger(data.selectedSlot) || data.selectedSlot < 0 || data.selectedSlot >= 8) return null;
  for (const slot of data.inventory) {
    if (slot === null) continue;
    if (!slot || typeof slot !== 'object' || !Object.hasOwn(ITEMS, slot.id) || !Number.isInteger(slot.count) || slot.count < 1 || slot.count > ITEMS[slot.id].stack) return null;
    const item = ITEMS[slot.id]; if (item.durability && (!Number.isInteger(slot.durability) || slot.durability < 1 || slot.durability > item.durability)) return null;
    if (!item.durability && slot.durability !== undefined) return null;
  }
  const p = data.player;
  if (!p || !['x', 'y', 'z', 'vx', 'vy', 'vz', 'yaw', 'pitch', 'hp', 'hunger', 'attackCooldown', 'swingTime', 'hurtTime', 'jumpGrace', 'lastDamage'].every(key => finite(p[key])) || p.hp < 0 || p.hp > 100 || p.hunger < 0 || p.hunger > 100 || (data.phase === 'playing' && p.hp <= 0) || (data.phase === 'dead' && p.hp !== 0) || Math.abs(p.vx) > 12 || Math.abs(p.vz) > 12 || p.vy < -24 || p.vy > 10 || Math.abs(p.yaw) > Math.PI + EPS || Math.abs(p.pitch) > 1.48 || p.attackCooldown < 0 || p.attackCooldown > 1 || p.swingTime < 0 || p.swingTime > .3 || p.hurtTime < 0 || p.hurtTime > .5 || p.jumpGrace < 0 || p.jumpGrace > .08 || p.lastDamage < 0 || p.lastDamage > 1000) return null;
  if (!Array.isArray(data.enemies) || data.enemies.length > MAX_ENEMIES || !Number.isInteger(data.enemyId) || data.enemyId < 0 || data.enemyId > 1e9 || !Array.isArray(data.projectiles) || data.projectiles.length > 24 || !Number.isInteger(data.projectileId) || data.projectileId < 0 || data.projectileId > 1e9 || !finite(data.spawnTimer) || data.spawnTimer < -1 || data.spawnTimer > 10) return null;
  const state = createState({ seed: data.seed }); state.world.blocks = Uint8Array.from(data.blocks); state.world.revision++;
  state.world.chunkRevisions.fill(state.world.revision);
  Object.assign(state, { rng: data.rng, tick: data.tick, time: data.time, elapsed: data.elapsed, phase: data.phase, inventory: copyInventory(data.inventory), selectedSlot: data.selectedSlot, enemyId: data.enemyId, projectileId: data.projectileId, spawnTimer: data.spawnTimer });
  Object.assign(state.player, p, { radius: BODY.radius, height: BODY.height, eyeHeight: BODY.eyeHeight, maxHp: 100, grounded: p.grounded === true });
  if (!canOccupy(state, p.x, p.y, p.z)) return null;
  const ids = new Set();
  for (const enemy of data.enemies) {
    if (!enemy || !['crawler', 'archer', 'wisp'].includes(enemy.type) || !Number.isInteger(enemy.id) || enemy.id < 1 || enemy.id > data.enemyId || ids.has(enemy.id) || !['x', 'y', 'z', 'vx', 'vy', 'vz', 'yaw', 'hp', 'maxHp', 'attackCooldown', 'hitFlash', 'stuckTime', 'digTime', 'daylightTime'].every(key => finite(enemy[key])) || enemy.hp <= 0 || enemy.hp > enemy.maxHp || enemy.maxHp < 30 || enemy.maxHp > 100 || Math.abs(enemy.vx) > 12 || Math.abs(enemy.vz) > 12 || Math.abs(enemy.vy) > 24 || Math.abs(enemy.yaw) > Math.PI + EPS || enemy.attackCooldown < 0 || enemy.attackCooldown > 3 || enemy.hitFlash < 0 || enemy.hitFlash > .3 || enemy.stuckTime < 0 || enemy.stuckTime > 1e7 || enemy.digTime < 0 || enemy.digTime > 10 || enemy.daylightTime < 0 || enemy.daylightTime > 9) return null;
    if (enemy.digTarget !== undefined && enemy.digTarget !== null && (!inBounds(state.world, enemy.digTarget.x, enemy.digTarget.y, enemy.digTarget.z) || !Number.isInteger(enemy.digTarget.id) || !Object.hasOwn(BLOCKS, enemy.digTarget.id) || [0, 1, 7, 8].includes(enemy.digTarget.id))) return null;
    const copy = { ...enemy, ...(enemy.digTarget ? { digTarget: { ...enemy.digTarget } } : {}), radius: enemy.type === 'wisp' ? .28 : .32, height: enemy.type === 'wisp' ? .65 : 1.65, grounded: enemy.grounded === true };
    if (!canOccupy(state, copy.x, copy.y, copy.z, copy.radius, copy.height)) return null;
    ids.add(copy.id); state.enemies.push(copy);
  }
  for (const body of [state.player, ...state.enemies]) if (body.hp > 0 && !peersClear(state, body, body.x, body.y, body.z)) return null;
  const projectileIds = new Set();
  for (const projectile of data.projectiles) {
    if (!projectile || !Number.isInteger(projectile.id) || projectile.id < 1 || projectile.id > data.projectileId || projectileIds.has(projectile.id) || !['x', 'y', 'z', 'vx', 'vy', 'vz', 'life', 'damage'].every(key => finite(projectile[key])) || projectile.x < 0 || projectile.x >= WORLD_SIZE || projectile.y < 0 || projectile.y >= WORLD_HEIGHT || projectile.z < 0 || projectile.z >= WORLD_SIZE || Math.hypot(projectile.vx, projectile.vy, projectile.vz) > 30 || Math.hypot(projectile.vx, projectile.vy, projectile.vz) < EPS || projectile.life <= 0 || projectile.life > 3 || projectile.damage < 1 || projectile.damage > 50) return null;
    projectileIds.add(projectile.id); state.projectiles.push({ ...projectile });
  }
  if (!Array.isArray(data.regrowth) || data.regrowth.length > 64) return null;
  const regrowthIds = new Set();
  for (const shrub of data.regrowth) {
    if (!shrub || !inBounds(state.world, shrub.x, shrub.y, shrub.z) || shrub.y < 1 || !finite(shrub.at) || shrub.at < 30 || shrub.at > state.time + DAY_SECONDS * 2 + 1) return null;
    const key = `${shrub.x},${shrub.y},${shrub.z}`; if (regrowthIds.has(key)) return null;
    regrowthIds.add(key); state.regrowth.push({ x: shrub.x, y: shrub.y, z: shrub.z, at: shrub.at });
  }
  if (!data.stats || !['mined', 'built', 'kills', 'crafted', 'nights'].every(key => Number.isInteger(data.stats[key]) && data.stats[key] >= 0 && data.stats[key] <= 1e9)) return null;
  state.stats = { ...data.stats }; state.day = Math.floor(state.time / DAY_SECONDS) + 1; state.dayProgress = (state.time % DAY_SECONDS) / DAY_SECONDS; state.night = state.time % DAY_SECONDS >= DAYLIGHT_SECONDS; state.dusk = clamp((state.time % DAY_SECONDS - 85) / 25, 0, 1);
  state.paused = false; state.target = raycast(state, eye(state.player), lookDirection(state.player)); state.message = 'Expedition restored. Stay alert.'; state.messageUntil = state.time + 3;
  return state;
}
