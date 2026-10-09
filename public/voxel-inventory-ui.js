import { WEAPONS } from './voxel-weapons.js';
import { inventoryPickupHint } from './voxel-inventory.js';

const ICONS = Object.freeze({
  weapon: 'M2 5h22v4H12v3H8V9H2z M15 9v4h4V9 M21 3v2',
  melee: 'M5 13 17 2h7L8 16 M3 12l7 6 M2 17l3 3 4-4',
  heal: 'M10 2h8v3h-2v4l5 5v5H7v-5l5-5V5h-2z M11 15h6 M14 12v6',
  grenade: 'M11 5V2h7v3 M11 5l-4 5v7l4 4h8l4-4v-7l-5-5z M18 3h6v5 M9 12h12',
  empty: 'M8 11h12 M14 5v12',
});

/** A read-only four-slot view. Authoritative per-item ammunition stays intact. */
export function inventorySlots(player, weapons = WEAPONS) {
  return Array.from({ length: 4 }, (_, index) => {
    const item = player?.inventory?.[index] || null;
    const selected = !!item && player?.inventoryIndex === index;
    if (!item) return { index, key: index + 1, kind: 'empty', label: 'EMPTY', name: 'Empty slot', detail: 'FREE SLOT', selected: false, droppable: false };
    if (item.kind === 'weapon') {
      const weapon = weapons[item.weapon];
      return { index, key: index + 1, kind: 'weapon', label: weapon?.label || String(item.weapon || 'GUN').toUpperCase(), name: weapon?.name || 'Weapon', detail: `${item.ammo ?? 0} / ${item.reserve ?? 0}`, selected, droppable: true };
    }
    const amount = Math.max(0, Math.min(2, Math.floor(Number.isFinite(item.amount) ? item.amount : 0)));
    const blade = item.weapon === 'sword' ? 'Sword' : 'Knife';
    return { index, key: index + 1, kind: item.kind, label: item.kind === 'heal' ? 'POTION' : item.kind === 'grenade' ? 'FRAG' : blade.toUpperCase(), name: item.kind === 'heal' ? 'Healing potion' : item.kind === 'grenade' ? 'Frag grenade' : blade, detail: ['heal', 'grenade'].includes(item.kind) ? `×${amount} / 2` : 'MELEE', selected, droppable: true };
  });
}

/** Number keys address inventory only during play; physical AZERTY keys work. */
export function inventoryControlForKey(event) {
  const digit = /^(?:Digit|Numpad)([1-4])$/.exec(event.code || '')?.[1] || (/^[1-4]$/.test(event.key || '') ? event.key : null);
  return digit ? `slot${digit}` : (event.key || '').toLowerCase() === 'x' || event.code === 'KeyX' ? 'drop' : null;
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
    const label = item.weapon === 'knife' ? 'KNIFE' : 'SWORD';
    return { label, ariaLabel: `Switch to ${label.toLowerCase()}`, shortcut: `V ${label}` };
  }
  const carried = player.inventory.filter(Boolean);
  if (carried.length === 1 && carried[0].kind === 'melee') {
    const label = carried[0].weapon === 'knife' ? 'KNIFE' : 'SWORD';
    return { label, ariaLabel: `${label === 'KNIFE' ? 'Knife' : 'Sword'} equipped; no other carried item`, shortcut: '1–4 EQUIP' };
  }
  return { label: carried.length ? 'NEXT' : 'EMPTY', ariaLabel: carried.length ? 'Cycle carried items' : 'No carried items; E picks up loot', shortcut: '1–4 EQUIP' };
}

export function inventoryLootPresentation(loot, player) {
  if (!loot || !player?.alive) return null;
  if (loot.type === 'health') return { id: loot.id, name: 'Healing supply', kind: 'health', detail: `E TO RECOVER UP TO ${Math.min(Math.max(0, loot.amount || 0), Math.max(0, (player.maxHp || 200) - player.hp))} HP` };
  const weapon = loot.kind === 'weapon' ? WEAPONS[loot.weapon] : null;
  if (loot.kind === 'weapon' && !weapon || !['weapon', 'melee', 'heal', 'grenade', 'ammo'].includes(loot.kind)) return null;
  const name = weapon?.name || (loot.kind === 'melee' ? loot.weapon === 'sword' ? 'Sword' : 'Small knife' : loot.kind === 'heal' ? 'Healing potion' : loot.kind === 'grenade' ? 'Frag grenade' : 'Ammunition');
  const hint = inventoryPickupHint(player, loot);
  const detail = weapon ? ` · ${loot.ammo ?? loot.item?.ammo ?? weapon.magazine} / ${loot.reserve ?? loot.item?.reserve ?? weapon.reserve}` : loot.kind === 'ammo' ? ` · +${Math.max(0, loot.amount || 0)} RESERVE` : loot.kind === 'heal' ? ' · STACK TO 2 · F TO HEAL' : loot.kind === 'grenade' ? ' · STACK TO 2 · Q TO THROW' : '';
  return { id: loot.id, name, kind: loot.kind, detail: `${hint}${detail}` };
}

export function inventoryEventFeedback(event) {
  if (event?.type === 'inventoryFull') return 'INVENTORY FULL · SELECT A GUN TO REPLACE OR X TO DROP';
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
  const hint = document.createElement('span'); hint.className = 'inventory-hint'; hint.textContent = '1–4 EQUIP · X DROP'; host.append(hint);
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
        record.select.disabled = !enabled || slot.kind === 'empty'; record.path.setAttribute('d', ICONS[slot.kind] || ICONS.empty); record.name.textContent = slot.label; record.detail.textContent = slot.detail;
        record.drop.disabled = !enabled || !slot.droppable; record.drop.setAttribute('aria-label', `Drop ${slot.name} from slot ${slot.key}`); record.drop.title = `Drop ${slot.name} · X drops the selected item`;
      }
    },
    destroy() { host.removeEventListener('click', click); host.removeEventListener('pointerdown', pointer); host.removeEventListener('mousedown', pointer); host.replaceChildren(); },
  };
}
