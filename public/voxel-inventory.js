/** Four physical inventory slots shared by every voxel FPS mode. */
import { WEAPONS } from './voxel-weapons.js';
import { MELEE_WEAPONS } from './voxel-melee.js';

export const INVENTORY_SIZE = 4;
export const ITEM_STACK_LIMIT = 2;
export const INVENTORY_ACTIONS = Object.freeze(['slot1', 'slot2', 'slot3', 'slot4', 'drop']);
const GUN_FIELDS = Object.freeze(['ammo', 'reserve', 'reloadTicks', 'shotCooldown', 'burstRemaining', 'spinTicks', 'recoil', 'heat', 'shotIndex', 'lastShotHand', 'pendingFireTicks']);
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const count = (value, maximum = 2) => Math.max(0, Math.min(maximum, Math.floor(finite(value))));
const copy = value => value ? { ...value } : null;

export function createInventoryGun(weapon = 'carbine', source = {}) {
  if (typeof weapon !== 'string' || !Object.hasOwn(WEAPONS, weapon)) return null;
  const catalog = WEAPONS[weapon], item = { kind: 'weapon', weapon };
  for (const field of GUN_FIELDS) item[field] = Math.max(0, finite(source[field]));
  item.ammo = count(source.ammo ?? catalog.magazine, catalog.magazine);
  item.reserve = count(source.reserve ?? catalog.reserve, catalog.reserve * 8);
  return item;
}
export function createInventoryMelee(weapon = 'knife', source = {}) {
  if (typeof weapon !== 'string' || !Object.hasOwn(MELEE_WEAPONS, weapon)) return null;
  return { kind: 'melee', weapon, meleeCooldown: Math.max(0, finite(source.meleeCooldown)), meleeIndex: Math.max(0, Math.floor(finite(source.meleeIndex))), meleeHand: source.meleeHand === 1 ? 1 : 0 };
}
export function itemFromLoot(loot) {
  if (!loot) return null;
  if (loot.kind === 'weapon') return createInventoryGun(loot.weapon, loot.item || loot);
  if (loot.kind === 'melee') return createInventoryMelee(loot.weapon, loot.item || loot);
  if (loot.kind === 'heal' || loot.kind === 'grenade') {
    const amount = count(loot.amount ?? loot.item?.amount ?? 1);
    return amount ? { kind: loot.kind, amount } : null;
  }
  return null;
}
export function selectedInventoryItem(player) { return player?.inventory?.[player.inventoryIndex] || null; }
export function inventoryTotal(player, kind) { return (player?.inventory || []).reduce((total, item) => total + (item?.kind === kind ? count(item.amount) : 0), 0); }
function applyGun(player, index) {
  const item = player.inventory[index];
  if (item?.kind !== 'weapon') return;
  player.inventoryGunIndex = index; player.weapon = item.weapon;
  for (const field of GUN_FIELDS) player[field] = item[field];
}
export function refreshInventory(player) {
  player.potions = inventoryTotal(player, 'heal'); player.grenades = inventoryTotal(player, 'grenade');
  player.hasGun = player.inventory.some(item => item?.kind === 'weapon');
  const item = selectedInventoryItem(player);
  player.slot = item?.kind === 'weapon' ? 'primary' : item?.kind === 'melee' ? 'sword' : item?.kind === 'heal' ? 'potion' : item?.kind === 'grenade' ? 'grenade' : 'empty';
  if (item?.kind === 'weapon') applyGun(player, player.inventoryIndex);
  else if (item?.kind === 'melee') { player.meleeWeapon = item.weapon; player.meleeCooldown = item.meleeCooldown || 0; player.meleeIndex = item.meleeIndex || 0; player.meleeHand = item.meleeHand || 0; }
  if (!player.hasGun) { player.inventoryGunIndex = -1; player.ammo = player.reserve = player.reloadTicks = player.burstRemaining = player.spinTicks = player.pendingFireTicks = 0; }
  else if (player.inventory[player.inventoryGunIndex]?.kind !== 'weapon') applyGun(player, player.inventory.findIndex(item => item?.kind === 'weapon'));
  player.inventoryPotions = player.potions; player.inventoryGrenades = player.grenades;
  return player;
}
export function initializeInventory(player, { weapon = player.weapon || 'carbine', knifeOnly = false, potions = 1, grenades = 1, melee = 'knife' } = {}) {
  melee = typeof melee === 'string' && Object.hasOwn(MELEE_WEAPONS, melee) ? melee : 'knife';
  player.inventory = [createInventoryMelee(melee), knifeOnly ? null : createInventoryGun(weapon), knifeOnly || !potions ? null : { kind: 'heal', amount: count(potions) }, knifeOnly || !grenades ? null : { kind: 'grenade', amount: count(grenades) }];
  player.inventoryIndex = knifeOnly ? 0 : 1; player.inventoryGunIndex = knifeOnly ? -1 : 1;
  player.meleeWeapon = melee;
  return refreshInventory(player);
}
/** Preserve compatibility with shared combat's active gun fields, never a second gun copy. */
export function storeInventoryGun(player) {
  const item = player.inventory?.[player.inventoryGunIndex];
  if (item?.kind === 'weapon') {
    if (typeof player.weapon === 'string' && Object.hasOwn(WEAPONS, player.weapon)) item.weapon = player.weapon;
    for (const field of GUN_FIELDS) item[field] = Math.max(0, finite(player[field]));
  }
  const held = selectedInventoryItem(player);
  if (held?.kind === 'melee') { held.weapon = typeof player.meleeWeapon === 'string' && Object.hasOwn(MELEE_WEAPONS, player.meleeWeapon) ? player.meleeWeapon : held.weapon; held.meleeCooldown = Math.max(0, finite(player.meleeCooldown)); held.meleeIndex = Math.max(0, Math.floor(finite(player.meleeIndex))); held.meleeHand = player.meleeHand === 1 ? 1 : 0; }
}
function adjustLegacyCount(player, kind, requested) {
  let amount = count(requested, INVENTORY_SIZE * ITEM_STACK_LIMIT), current = inventoryTotal(player, kind);
  if (amount < current) for (let index = player.inventory.length - 1; index >= 0 && current > amount; index--) {
    const item = player.inventory[index]; if (item?.kind !== kind) continue;
    const removed = Math.min(item.amount, current - amount); item.amount -= removed; current -= removed;
    if (!item.amount) player.inventory[index] = null;
  }
  else if (amount > current) {
    addInventoryStack(player, kind, amount - current);
  }
}
export function ensureInventory(player) {
  if (!Array.isArray(player.inventory) || player.inventory.length !== INVENTORY_SIZE) {
    initializeInventory(player, { knifeOnly: player.hasGun === false, potions: player.potions ?? 1, grenades: player.grenades ?? 1, melee: player.meleeWeapon || 'knife' });
    return player;
  }
  storeInventoryGun(player);
  if (player.potions !== player.inventoryPotions) adjustLegacyCount(player, 'heal', player.potions);
  if (player.grenades !== player.inventoryGrenades) adjustLegacyCount(player, 'grenade', player.grenades);
  const held = selectedInventoryItem(player);
  // Local engine helpers and old recordings still set the semantic slot directly.
  if (player.slot === 'sword' && held?.kind !== 'melee') { const index = player.inventory.findIndex(item => item?.kind === 'melee'); if (index >= 0) player.inventoryIndex = index; }
  else if (player.slot === 'primary' && held?.kind !== 'weapon') { const index = player.inventory.findIndex(item => item?.kind === 'weapon'); if (index >= 0) player.inventoryIndex = index; }
  return refreshInventory(player);
}
export function selectInventorySlot(player, index) {
  if (!Number.isInteger(index) || index < 0 || index >= INVENTORY_SIZE || !player.inventory[index]) return false;
  if (player.inventoryIndex === index) return false;
  storeInventoryGun(player);
  const old = selectedInventoryItem(player);
  if (old?.kind === 'weapon') { old.reloadTicks = 0; old.burstRemaining = 0; old.spinTicks = 0; old.pendingFireTicks = 0; }
  player.inventoryIndex = index;
  player.reloadTicks = player.burstRemaining = player.spinTicks = player.pendingFireTicks = 0;
  player.aiming = false; player.aimTicks = 0;
  refreshInventory(player);
  return true;
}
export function tickHolsteredInventory(player) {
  for (let index = 0; index < INVENTORY_SIZE; index++) {
    const item = player.inventory[index];
    if (item?.kind === 'weapon' && index !== player.inventoryGunIndex) { item.shotCooldown = Math.max(0, item.shotCooldown - 1); item.recoil = Math.max(0, item.recoil - .04 / 120); item.heat = Math.max(0, item.heat - 2.8 / 120); }
    if (item?.kind === 'melee') item.meleeCooldown = Math.max(0, finite(item.meleeCooldown) - 1);
  }
  const held = selectedInventoryItem(player), blade = held?.kind === 'melee' ? held : player.inventory.find(item => item?.kind === 'melee');
  player.meleeCooldown = blade?.meleeCooldown || 0;
}
export function addInventoryStack(player, kind, amount = 1) {
  let remaining = Math.max(0, Math.floor(finite(amount))), added = 0;
  for (let index = 0; index < INVENTORY_SIZE && remaining; index++) {
    const item = player.inventory[index]; if (item?.kind !== kind || item.amount >= ITEM_STACK_LIMIT) continue;
    const add = Math.min(remaining, ITEM_STACK_LIMIT - item.amount); item.amount += add; remaining -= add; added += add;
  }
  for (let index = 0; index < INVENTORY_SIZE && remaining; index++) if (!player.inventory[index]) { const add = Math.min(remaining, ITEM_STACK_LIMIT); player.inventory[index] = { kind, amount: add }; remaining -= add; added += add; }
  return added;
}
export function consumeInventoryStack(player, kind, amount = 1) {
  let remaining = amount;
  const order = [player.inventoryIndex, ...Array.from({ length: INVENTORY_SIZE }, (_, index) => index).filter(index => index !== player.inventoryIndex)];
  for (const index of order) {
    const item = player.inventory[index]; if (item?.kind !== kind || !remaining) continue;
    const used = Math.min(remaining, item.amount); item.amount -= used; remaining -= used;
    if (!item.amount) player.inventory[index] = null;
  }
  refreshInventory(player); return amount - remaining;
}
export function inventoryCanTake(player, loot, { replace = true } = {}) {
  if (loot?.kind === 'ammo') return (player.inventory || []).some(item => item?.kind === 'weapon' && (!loot.weapon || item.weapon === loot.weapon) && item.reserve < WEAPONS[item.weapon].reserve * 2 && finite(loot.amount) > 0);
  const item = itemFromLoot(loot); if (!item) return false;
  if (player.inventory.some(slot => !slot)) return true;
  if (item.kind === 'heal' || item.kind === 'grenade') return player.inventory.some(slot => slot?.kind === item.kind && slot.amount < ITEM_STACK_LIMIT);
  return replace && (item.kind === 'weapon' || item.kind === 'melee') && selectedInventoryItem(player)?.kind === item.kind;
}
export function inventoryPickupHint(player, loot) {
  if (!inventoryCanTake(player, loot)) return 'Inventory full · drop an item (X)';
  if (loot.kind === 'weapon' && player.inventory.every(Boolean)) return `Replace ${WEAPONS[selectedInventoryItem(player).weapon].name} · slot ${player.inventoryIndex + 1}`;
  if (loot.kind === 'melee' && player.inventory.every(Boolean)) return `Replace ${MELEE_WEAPONS[selectedInventoryItem(player).weapon].name} · slot ${player.inventoryIndex + 1}`;
  return 'Pick up';
}
export function pickupInventoryItem(player, loot, { replace = true, equip = true } = {}) {
  ensureInventory(player);
  if (!inventoryCanTake(player, loot, { replace })) return { ok: false, amount: 0, dropped: null };
  if (loot.kind === 'ammo') {
    let remaining = Math.max(0, Math.floor(finite(loot.amount))), added = 0;
    for (const item of player.inventory) if (item?.kind === 'weapon' && (!loot.weapon || loot.weapon === item.weapon)) { const amount = Math.min(remaining, WEAPONS[item.weapon].reserve * 2 - item.reserve); item.reserve += amount; remaining -= amount; added += amount; }
    if (selectedInventoryItem(player)?.kind === 'weapon') applyGun(player, player.inventoryIndex); else applyGun(player, player.inventoryGunIndex);
    refreshInventory(player); return { ok: added > 0, amount: added, dropped: null };
  }
  const item = itemFromLoot(loot);
  if (item.kind === 'heal' || item.kind === 'grenade') { const added = addInventoryStack(player, item.kind, Math.max(0, Math.floor(finite(loot.amount, item.amount)))); refreshInventory(player); return { ok: added > 0, amount: added, dropped: null }; }
  let index = player.inventory.findIndex(slot => !slot), dropped = null;
  if (index < 0) { index = player.inventoryIndex; dropped = copy(player.inventory[index]); if (dropped?.kind === 'weapon') dropped.pendingFireTicks = 0; }
  if (item.kind === 'weapon') item.pendingFireTicks = 0;
  storeInventoryGun(player); player.inventory[index] = item;
  if (equip) { player.inventoryIndex = index; player.aiming = false; player.aimTicks = 0; }
  refreshInventory(player); return { ok: true, amount: 1, dropped, index };
}
export function dropInventoryItem(player, index = player.inventoryIndex) {
  if (!Number.isInteger(index) || index < 0 || index >= INVENTORY_SIZE || !player.inventory[index]) return null;
  storeInventoryGun(player); const item = copy(player.inventory[index]);
  if (item.kind === 'weapon') item.reloadTicks = item.burstRemaining = item.spinTicks = item.pendingFireTicks = 0;
  player.inventory[index] = null;
  // Dropping the held item leaves empty hands; it never silently equips and fires another gun.
  refreshInventory(player); player.aiming = false; player.aimTicks = 0;
  return item;
}
export function lootFromInventoryItem(item) { return item ? { kind: item.kind, weapon: item.weapon, ...(item.kind === 'weapon' ? { ammo: item.ammo, reserve: item.reserve } : {}), ...(item.amount ? { amount: item.amount } : {}), item: copy(item) } : null; }
export function setInventoryLoadout(player, weapon) {
  const item = createInventoryGun(weapon); if (!item) return false;
  ensureInventory(player); storeInventoryGun(player);
  const target = 1; player.inventory[target] = item; player.inventoryIndex = target;
  player.aiming = false; player.aimTicks = 0; refreshInventory(player); return true;
}
/** Starting blades occupy physical slot one without consuming another gun slot. */
export function setInventoryMeleeLoadout(player, weapon, { equip = false } = {}) {
  const item = createInventoryMelee(weapon); if (!item) return false;
  ensureInventory(player); storeInventoryGun(player); player.inventory[0] = item;
  player.meleeWeapon = weapon; player.meleeCooldown = player.meleeIndex = player.meleeHand = player.meleeTicks = 0; player.meleePhase = 'idle'; player.meleeHitIds = [];
  if (equip) { player.inventoryIndex = 0; player.reloadTicks = player.burstRemaining = player.spinTicks = player.pendingFireTicks = 0; player.aiming = false; player.aimTicks = 0; }
  refreshInventory(player); return true;
}
