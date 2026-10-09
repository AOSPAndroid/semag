import { WEAPONS } from './voxel-weapons.js';
import { MELEE_WEAPONS } from './voxel-melee.js';
import { inventoryPickupHint } from './voxel-inventory.js';

const ICONS = Object.freeze({
  weapon: 'M2 5h22v4H12v3H8V9H2z M15 9v4h4V9 M21 3v2',
  melee: 'M5 13 17 2h7L8 16 M3 12l7 6 M2 17l3 3 4-4',
  knife: 'M6 14 18 3l5-1-1 5L10 17 M4 12l8 8 M3 18l3 3 4-4',
  sword: 'M5 14 19 2h4v4L9 18 M3 12l9 9 M2 18l3 3 4-4',
  katana: 'M6 17C14 12 20 7 24 2L23 8C20 12 15 16 9 19 M4 14l7 8 M2 20l3 2 4-4',
  axe: 'M6 21 17 3 M14 5l5-3 6 5-2 7-7-3 M7 18l3 2',
  tonfas: 'M4 5h3v17H4z M7 12h6v3H7 M17 2h3v17h-3z M11 9h6v3h-6',
  dualpistols: 'M1 3h11v4H7v5H4V7H1z M16 12h11v4h-5v6h-3v-6h-3z',
  dualsmg: 'M1 2h11v5H8v5H5V7H1z M10 7v3 M15 12h12v5h-5v5h-3v-5h-4z M25 17v3',
  heal: 'M10 2h8v3h-2v4l5 5v5H7v-5l5-5V5h-2z M11 15h6 M14 12v6',
  grenade: 'M11 5V2h7v3 M11 5l-4 5v7l4 4h8l4-4v-7l-5-5z M18 3h6v5 M9 12h12',
  empty: 'M8 11h12 M14 5v12',
});
const catalogItem = (catalog, id) => typeof id === 'string' && Object.hasOwn(catalog, id) ? catalog[id] : null;

// Original side silhouettes share the hotbar's 28 × 24 viewBox. Barrel, stock,
// magazine and optic shapes identify a carried gun even before its label fits.
const WEAPON_ICONS = Object.freeze({
  carbine: 'M2 10h5l2-2h11v2h6v2h-7v2h-4l1 6h-4l-2-6H7l-2 3H2z M10 8V6h3v2 M21 8v2',
  smg: 'M2 10h5V8h12v3h6v2h-7v2h-4v6h-3v-6H8l-2 2H2z M3 8v2 M16 6v2',
  marksman: 'M2 11h6l2-2h12v1h4v2h-9v3h-3l1 4h-4l-2-4H7l-2 2H2z M10 5h8v3h-8z M12 8v1 M17 8v1',
  pistol: 'M5 8h17v4H12l-1 8H6l2-8H5z M12 12v4h4l1-4 M19 6v2',
  shotgun: 'M2 11h6l2-2h14v3H12l-2 3H7l-2 3H2z M13 12h10v3H13 M9 15v4h3v-5 M24 9h2v3',
  burst: 'M2 10h6l2-2h10v2h6v2h-8v3h-3l2 5h-4l-2-5H7l-2 3H2z M9 8V5h7v3 M20 8v2',
  sniper: 'M2 12h5l3-2h13v1h3v2H16v3h-3l1 4h-3l-2-4H7l-3 2H2z M9 4h11v4H9z M13 8v2 M19 8v2 M21 14l2 4',
  lmg: 'M2 10h6V8h13v2h5v3h-7v2h-3v6h-7v-6H7l-2 3H2z M10 5h8v3 M20 13l3 7 M20 13l-2 7',
  crossbow: 'M2 12h8V9h9v3h7v2H15v3l-3 4H8l2-7H2z M19 4l4 8-4 8 M19 4v16 M8 7h7v2',
  revolver: 'M4 10h5V8h7v2h9v3H16v3H9l-1 5H4l2-7H4z M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6z M17 8v2',
  pdw: 'M2 11h5V8h12v2h7v4h-8v2h-3v5h-3v-5H8l-2 2H2z M8 6h8v2 M20 10v4',
  autoshotgun: 'M2 11h6l2-3h10v2h6v3h-9v2h-3v6h-4v-6H7l-2 3H2z M14 5h4v3 M19 13v4h4v-4',
  battlerifle: 'M2 10h6l2-2h10v2h6v2h-7v2h-3l-1 7h-5v-7H7l-3 4H2z M12 5h6v3 M21 8v2',
  dualpistols: ICONS.dualpistols,
  dualsmg: ICONS.dualsmg,
  slugshotgun: 'M2 12h6l3-3h12v1h3v3H13l-2 3H7l-3 3H2z M14 13h8v2h-8 M10 16v4h3v-5 M12 6h6v3',
  classic: 'M5 7h18v4H13l-2 9H6l2-9H5z M13 11v4h4l1-4 M18 5v2 M8 16h3',
  shorty: 'M3 12h5l3-3h13v6H12l-2 3H6l-3 2z M12 12h14 M12 9h14 M10 15v4h3v-4',
  frenzy: 'M5 7h17v5h-8v3h-3l1 7H7l1-10H5z M14 12v4h4v-4 M6 5h4v2 M18 7v5',
  ghost: 'M3 8h13v1h10v4H15l-2 7H8l2-8H3z M16 9v4 M15 13v3h3l1-3 M12 6v2',
  sheriff: 'M3 11h5l2-3h6v2h10v3H16l-1 3H9l-2 5H3l3-7z M12 9a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5z M21 8v2',
  bandit: 'M4 8h13l2 2h6v3H14l-2 8H7l1-8H4z M14 13v3h4l1-3 M8 6h5v2 M19 10v3',
  stinger: 'M2 10h6V8h10v2h6v3h-7v2h-3l1 6h-4l-1-6H7l-2 2H2z M3 7v3 M13 6h3v2',
  spectre: 'M2 11h5V9h11v1h8v4h-9v2h-3l1 5h-4l-1-5H7l-2 2H2z M18 10v4 M10 6h5v3',
  bucky: 'M2 12h6l2-3h14v3H13l-3 3H7l-3 4H2z M14 12h9v3h-9 M9 15v4h3v-4 M20 7v2',
  judge: 'M2 11h5l3-3h10v2h6v3h-8v2h-3H9l-2 1-2 2H2z M12 15a3 3 0 1 0 0 6a3 3 0 1 0 0-6z M16 5h3v3 M20 13v3h4v-3',
  bulldog: 'M2 10h15l2-2h3v2h4v3h-9v3h-3l1 5h-4l-1-5H2z M5 13v7h4v-7 M9 6h8v4',
  guardian: 'M2 12h5l3-3h12v1h4v2h-9v3h-3v6h-4l-1-6H7l-4 3H2z M9 7h4v2 M20 7v2 M15 12v3',
  phantom: 'M2 10h6l2-2h9v2h7v4h-8v2h-3v5h-4l-1-5H7l-2 2H2z M20 10v4 M12 6h5v2',
  vandal: 'M2 10h6l2-2h10v2h6v2h-8v3l-2 6h-5l2-6H8l-4 3H2z M10 6h4v2 M20 7v3 M14 15h3',
  warden: 'M2 10h6l2-1h11l2 2h3v2h-8v2l-2 6h-4l2-6H9l-2 3H2z M3 12h4v3H3z M10 4h9v4h-9z M13 8v1 M20 10v3',
  marshal: 'M2 13h5l4-3h12v1h3v2H16l-3 4H8l-4 3H2z M10 5h9v3h-9z M13 8v2 M19 8v2 M12 17v3',
  outlaw: 'M2 13h5l3-3h16v4H16l-3 4H8l-4 3H2z M16 12h10 M9 4h11v4H9z M13 8v2 M10 18v3',
  operator: 'M2 12h5l3-2h14v1h2v3H17v3h-4l1 4h-4l-2-4H5l-3 2z M9 3h12v5H9z M13 8v2 M20 15l3 6',
  ares: 'M2 11h6V8h12v2h6v3h-8v2h-3v6H9v-6H7l-3 4H2z M11 5h6v3 M20 13v6h3v-6 M10 16h4',
  odin: 'M2 11h6V7h12v3h6v4h-8v2h-3v5H8v-6H5l-3 3z M9 4h8v3 M10 16v4 M13 16v4 M21 14l3 7 M21 14l-2 7',
});

/** Read-only gun identity; unknown catalog extensions still receive a useful shape. */
export function weaponInventoryIconPath(id, weapon = catalogItem(WEAPONS, id)) {
  const exact = catalogItem(WEAPON_ICONS, id) || catalogItem(WEAPON_ICONS, weapon?.model);
  if (exact) return exact;
  const family = weapon?.family || weapon?.category, features = weapon?.modelFeatures;
  if (weapon?.dualWield) return family === 'pistol' || family === 'sidearm' ? WEAPON_ICONS.dualpistols : WEAPON_ICONS.dualsmg;
  if (features?.doubleBarrel) return family === 'sniper' ? WEAPON_ICONS.outlaw : WEAPON_ICONS.shorty;
  if (family === 'revolver') return WEAPON_ICONS.revolver;
  if (family === 'pistol' || family === 'sidearm') return features?.suppressed ? WEAPON_ICONS.ghost : WEAPON_ICONS.pistol;
  if (family === 'smg') return features?.suppressed ? WEAPON_ICONS.pdw : WEAPON_ICONS.smg;
  if (family === 'shotgun') return features?.drum ? WEAPON_ICONS.judge : WEAPON_ICONS.shotgun;
  if (family === 'sniper') return WEAPON_ICONS.sniper;
  if (family === 'lmg' || family === 'heavy') return features?.beltFed ? WEAPON_ICONS.odin : WEAPON_ICONS.lmg;
  if (family === 'rifle') return features?.scope ? WEAPON_ICONS.warden : features?.bullpup ? WEAPON_ICONS.bulldog : features?.suppressed ? WEAPON_ICONS.phantom : WEAPON_ICONS.carbine;
  return ICONS.weapon;
}

/** A read-only four-slot view. Authoritative per-item ammunition stays intact. */
export function inventorySlots(player, weapons = WEAPONS) {
  return Array.from({ length: 4 }, (_, index) => {
    const item = player?.inventory?.[index] || null;
    const selected = !!item && player?.inventoryIndex === index;
    if (!item) return { index, key: index + 1, kind: 'empty', label: 'EMPTY', name: 'Empty slot', detail: 'FREE SLOT', selected: false, droppable: false };
    if (item.kind === 'weapon') {
      const weapon = catalogItem(weapons, item.weapon);
      return { index, key: index + 1, kind: 'weapon', icon: item.weapon || 'weapon', label: weapon?.label || String(item.weapon || 'GUN').toUpperCase(), name: weapon?.name || 'Weapon', detail: `${item.ammo ?? 0} / ${item.reserve ?? 0}`, selected, droppable: true };
    }
    const amount = Math.max(0, Math.min(2, Math.floor(Number.isFinite(item.amount) ? item.amount : 0)));
    const blade = catalogItem(MELEE_WEAPONS, item.weapon);
    return { index, key: index + 1, kind: item.kind, icon: item.kind === 'melee' ? item.weapon : item.kind, label: item.kind === 'heal' ? 'POTION' : item.kind === 'grenade' ? 'FRAG' : blade?.label || 'BLADE', name: item.kind === 'heal' ? 'Healing potion' : item.kind === 'grenade' ? 'Frag grenade' : blade?.name || 'Close-combat weapon', detail: ['heal', 'grenade'].includes(item.kind) ? `×${amount} / 2` : 'MELEE', selected, droppable: true };
  });
}

/** Number keys address inventory only during play; physical AZERTY keys work. */
export function inventoryControlForKey(event) {
  const digit = /^(?:Digit|Numpad)([1-4])$/.exec(event.code || '')?.[1] || (/^[1-4]$/.test(event.key || '') ? event.key : null);
  return digit ? `slot${digit}` : (event.key || '').toLowerCase() === 'x' || event.code === 'KeyX' ? 'drop' : null;
}

/** Wheel intent stays separate from the accepted inventory and other inputs. */
export function createWeaponWheelController({ onReset = () => {} } = {}) {
  const interval = 24, threshold = 40;
  let signature = '', pendingIndex = null, queuedIndex = null, lastDispatchedIndex = null;
  let accumulatedDelta = 0, lastDispatchAt = -Infinity, lastIntentAt = -Infinity, requests = 0, dispatches = 0;
  function reset() {
    onReset();
    signature = ''; pendingIndex = queuedIndex = lastDispatchedIndex = null;
    accumulatedDelta = 0; lastDispatchAt = lastIntentAt = -Infinity;
  }
  function sync(player, now) {
    const next = JSON.stringify([player?.id, player?.lifeId, player?.deaths,
      Array.from({ length: 4 }, (_, index) => { const item = player?.inventory?.[index]; return item ? [item.kind, item.weapon || null] : null; })]);
    if (signature !== next || pendingIndex !== null && now - lastIntentAt > 750 && queuedIndex === null) { reset(); signature = next; }
  }
  function flush(player, now) {
    sync(player, now);
    if (queuedIndex === null || now - lastDispatchAt < interval) return null;
    const index = queuedIndex; queuedIndex = null; lastDispatchedIndex = index; lastDispatchAt = now; dispatches++;
    return `slot${index + 1}`;
  }
  return {
    consume(event, player, { now = 0, crouchHeld = false } = {}) {
      const dy = event?.deltaY, dx = event?.deltaX ?? 0;
      if (!player?.alive || !Array.isArray(player.inventory) || !Number.isFinite(now) || event?.defaultPrevented || event?.ctrlKey && !crouchHeld || event?.altKey || event?.metaKey || !Number.isFinite(dy) || !Number.isFinite(dx) || !dy || Math.abs(dx) > Math.abs(dy)) return { handled: false, action: null };
      sync(player, now);
      const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? threshold : 1;
      const delta = Math.max(-threshold, Math.min(threshold, dy * scale));
      if (Math.sign(delta) !== Math.sign(accumulatedDelta)) accumulatedDelta = 0;
      accumulatedDelta = Math.max(-threshold, Math.min(threshold, accumulatedDelta + delta));
      if (Math.abs(accumulatedDelta) < threshold) return { handled: true, action: null };
      const direction = Math.sign(accumulatedDelta); accumulatedDelta = 0;
      const slots = player.inventory.slice(0, 4).flatMap((item, index) => item?.kind === 'weapon' && catalogItem(WEAPONS, item.weapon) || item?.kind === 'melee' && catalogItem(MELEE_WEAPONS, item.weapon) ? [index] : []);
      const start = pendingIndex ?? (Number.isInteger(player.inventoryIndex) ? player.inventoryIndex : 0);
      let target = null;
      for (let offset = 1; offset <= 4; offset++) { const index = (start + direction * offset + 8) % 4; if (slots.includes(index)) { target = index; break; } }
      if (target === null || target === start) return { handled: true, action: null };
      pendingIndex = target; lastIntentAt = now; requests++;
      // A full wrap must still finish earlier dispatched intents, even when
      // the desired slot happens to match a stale accepted snapshot.
      queuedIndex = target === lastDispatchedIndex ? null : target;
      return { handled: true, action: flush(player, now) };
    },
    flush,
    reset,
    inspect: () => Object.freeze({ pendingIndex, queuedIndex, accumulatedDelta, requests, dispatches }),
  };
}

/** Only the owned, active canvas consumes wheel events; no timers or layout reads. */
export function mountWeaponWheel(canvas, { context, dispatch, cancelPending, now = () => performance.now() }) {
  const controller = createWeaponWheelController({ onReset: cancelPending }); let destroyed = false;
  function current() {
    const value = context();
    return value?.active && value.player?.alive && (value.pointerLocked || value.fallback && canvas.ownerDocument?.activeElement === canvas) ? value : null;
  }
  function send(action) { if (action && dispatch(action) === false) controller.reset(); }
  const wheel = event => {
    const value = current();
    if (destroyed || event.target !== canvas || !value) { controller.reset(); return; }
    const result = controller.consume(event, value.player, { now: now(), crouchHeld: !!value.crouchHeld });
    if (result.handled) event.preventDefault();
    send(result.action);
  };
  canvas.addEventListener('wheel', wheel, { passive: false });
  return {
    flush() { const value = !destroyed && current(); if (value) send(controller.flush(value.player, now())); else controller.reset(); },
    reset: controller.reset,
    inspect: controller.inspect,
    destroy() { if (destroyed) return; destroyed = true; controller.reset(); canvas.removeEventListener('wheel', wheel); },
  };
}

/** Consumables and empty hands must never display the last gun's ammunition. */
export function inventoryItemReadout(player) {
  if (!Array.isArray(player?.inventory) || player.healTicks > 0) return null;
  const item = player.inventory[player.inventoryIndex];
  if (item?.kind === 'weapon' || item?.kind === 'melee') return null;
  const kind = item?.kind;
  return { label: kind === 'heal' ? 'HEALING POTION' : kind === 'grenade' ? 'FRAG GRENADE' : 'EMPTY HANDS',
    ammo: item ? `×${item.amount}` : '—', reserve: '—', sword: false, healing: false, reloading: false, utility: true,
    status: kind === 'heal' ? player.hp >= player.maxHp ? 'FULL HEALTH · SAVE POTION' : 'LMB DRINK · F QUICK HEAL' : kind === 'grenade' ? 'LMB THROW · Q QUICK THROW' : '1–4 EQUIP · E PICK UP', progress: null };
}

/** Name the blade/gun actually targeted by V; old bare-player records stay legacy. */
export function inventorySwapPresentation(player) {
  if (!Array.isArray(player?.inventory)) return null;
  const desired = player.slot === 'sword' ? 'weapon' : 'melee';
  const item = player.inventory.find(item => item?.kind === desired);
  if (item?.kind === 'weapon') return { label: 'GUN', ariaLabel: 'Switch to carried gun', shortcut: 'V GUN' };
  if (item?.kind === 'melee') {
    const label = catalogItem(MELEE_WEAPONS, item.weapon)?.label || 'BLADE';
    return { label, ariaLabel: `Switch to ${label.toLowerCase()}`, shortcut: `V ${label}` };
  }
  const carried = player.inventory.filter(Boolean);
  if (carried.length === 1 && carried[0].kind === 'melee') {
    const blade = catalogItem(MELEE_WEAPONS, carried[0].weapon), label = blade?.label || 'BLADE';
    return { label, ariaLabel: `${blade?.name || 'Close-combat weapon'} equipped; no other carried item`, shortcut: '1–4 EQUIP' };
  }
  return { label: carried.length ? 'NEXT' : 'EMPTY', ariaLabel: carried.length ? 'Cycle carried items' : 'No carried items; E picks up loot', shortcut: '1–4 EQUIP' };
}

export function inventoryLootPresentation(loot, player) {
  if (!loot || !player?.alive) return null;
  if (loot.type === 'health') return { id: loot.id, name: 'Healing supply', kind: 'health', detail: `E TO RECOVER UP TO ${Math.min(Math.max(0, loot.amount || 0), Math.max(0, (player.maxHp || 200) - player.hp))} HP` };
  const weapon = loot.kind === 'weapon' ? catalogItem(WEAPONS, loot.weapon) : null;
  const blade = loot.kind === 'melee' ? catalogItem(MELEE_WEAPONS, loot.weapon) : null;
  if (loot.kind === 'weapon' && !weapon || loot.kind === 'melee' && !blade || !['weapon', 'melee', 'heal', 'grenade', 'ammo'].includes(loot.kind)) return null;
  const name = weapon?.name || blade?.name || (loot.kind === 'heal' ? 'Healing potion' : loot.kind === 'grenade' ? 'Frag grenade' : 'Ammunition');
  const hint = inventoryPickupHint(player, loot);
  const detail = weapon ? ` · ${loot.ammo ?? loot.item?.ammo ?? weapon.magazine} / ${loot.reserve ?? loot.item?.reserve ?? weapon.reserve}` : loot.kind === 'ammo' ? ` · +${Math.max(0, loot.amount || 0)} RESERVE` : loot.kind === 'heal' ? ' · STACK TO 2 · F TO HEAL' : loot.kind === 'grenade' ? ' · STACK TO 2 · Q TO THROW' : '';
  return { id: loot.id, name, kind: loot.kind, detail: `${hint}${detail}` };
}

export function inventoryEventFeedback(event) {
  if (event?.type === 'inventoryFull') return 'INVENTORY FULL · SELECT A GUN OR BLADE TO REPLACE OR X TO DROP';
  if (event?.type === 'inventoryEmpty') return 'EMPTY SLOT · E PICKS UP NEARBY ITEMS';
  if (event?.type === 'inventoryDrop') return 'ITEM DROPPED · E TO PICK IT UP';
  return null;
}

/** The compact hotbar owns only DOM and tap events, never game state. */
export function mountInventoryHotbar(host, onActions, { label = 'Four inventory slots' } = {}) {
  if (!host) return { update() {}, destroy() {} };
  host.classList.add('voxel-inventory'); host.setAttribute('role', 'group'); host.setAttribute('aria-label', label);
  const document = host.ownerDocument, records = [];
  for (let index = 0; index < 4; index++) {
    const card = document.createElement('div'); card.className = 'inventory-slot'; card.dataset.inventoryIndex = String(index);
    const select = document.createElement('button'); select.type = 'button'; select.className = 'inventory-select'; select.dataset.inventorySlot = String(index + 1);
    const key = document.createElement('kbd'); key.textContent = String(index + 1);
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); icon.setAttribute('viewBox', '0 0 28 24'); icon.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); icon.append(path);
    const name = document.createElement('b'), detail = document.createElement('small'); select.append(key, icon, name, detail);
    const drop = document.createElement('button'); drop.type = 'button'; drop.className = 'inventory-drop'; drop.dataset.inventoryDrop = String(index + 1); drop.textContent = '↓';
    card.append(select, drop); host.append(card); records.push({ card, select, path, name, detail, drop });
  }
  const hint = document.createElement('span'); hint.className = 'inventory-hint'; hint.textContent = '1–4 / WHEEL · X DROP'; host.append(hint);
  let signature = '', enabled = false;
  const click = event => {
    const drop = event.target.closest?.('[data-inventory-drop]'), select = event.target.closest?.('[data-inventory-slot]');
    if (!enabled || !drop && !select || !host.contains(drop || select)) return;
    event.preventDefault(); event.stopPropagation();
    const slot = Number((drop || select).dataset[drop ? 'inventoryDrop' : 'inventorySlot']);
    onActions(drop ? [`slot${slot}`, 'drop'] : [`slot${slot}`]);
  };
  const pointer = event => { if (event.target.closest?.('button')) event.stopPropagation(); };
  host.addEventListener('click', click); host.addEventListener('pointerdown', pointer); host.addEventListener('mousedown', pointer);
  return {
    update(player, { visible = true, interactive = true } = {}) {
      host.hidden = !visible; enabled = interactive && !!player?.alive;
      const slots = inventorySlots(player), next = JSON.stringify([enabled, slots]); if (signature === next) return; signature = next;
      for (const slot of slots) {
        const record = records[slot.index]; record.card.dataset.kind = slot.kind; record.card.classList.toggle('selected', slot.selected);
        record.select.setAttribute('aria-pressed', String(slot.selected)); record.select.setAttribute('aria-label', `Slot ${slot.key}: ${slot.name}. ${slot.detail}`); record.select.title = `${slot.key}: ${slot.name} · ${slot.detail}`;
        record.select.disabled = !enabled || slot.kind === 'empty'; record.path.setAttribute('d', slot.kind === 'weapon' ? weaponInventoryIconPath(slot.icon) : ICONS[slot.icon || slot.kind] || ICONS.empty); record.name.textContent = slot.label; record.detail.textContent = slot.detail;
        record.drop.disabled = !enabled || !slot.droppable; record.drop.setAttribute('aria-label', `Drop ${slot.name} from slot ${slot.key}`); record.drop.title = `Drop ${slot.name} · X drops the selected item`;
      }
    },
    destroy() { host.removeEventListener('click', click); host.removeEventListener('pointerdown', pointer); host.removeEventListener('mousedown', pointer); host.replaceChildren(); },
  };
}
