import { WEAPONS, weaponDamage, weaponStats } from '../../../public/voxel-weapons.js';
import { MELEE_WEAPONS, MELEE_COMBO_WINDOW_TICKS, meleeComboLength, meleeProfile } from '../../../public/voxel-melee.js';

const GUN_CATEGORIES = Object.freeze([
  { id: 'all', label: 'All weapons' },
  { id: 'sidearm', label: 'Sidearms' },
  { id: 'smg', label: 'SMGs' },
  { id: 'shotgun', label: 'Shotguns' },
  { id: 'rifle', label: 'Rifles' },
  { id: 'sniper', label: 'Sniper rifles' },
  { id: 'heavy', label: 'Machine guns' },
  { id: 'special', label: 'Special' },
]);

const MELEE_CATEGORIES = Object.freeze([
  { id: 'all', label: 'All weapons' },
  { id: 'blades', label: 'Blades' },
  { id: 'impact', label: 'Impact' },
]);

// The originals predate the catalog's category field. This is presentation-only
// grouping; names, descriptions, damage and timings remain in the game catalog.
const LEGACY_CATEGORIES = Object.freeze({
  carbine: 'rifle',
  smg: 'smg',
  marksman: 'sniper',
  pistol: 'sidearm',
  shotgun: 'shotgun',
  burst: 'rifle',
  sniper: 'sniper',
  lmg: 'heavy',
  crossbow: 'special',
  revolver: 'sidearm',
  pdw: 'smg',
  autoshotgun: 'shotgun',
  battlerifle: 'rifle',
  dualpistols: 'sidearm',
  dualsmg: 'smg',
  slugshotgun: 'shotgun',
});

const categoryDefinitions = kind => kind === 'melee' ? MELEE_CATEGORIES : GUN_CATEGORIES;
const catalogFor = kind => kind === 'melee' ? MELEE_WEAPONS : WEAPONS;
const seconds = value => `${value.toFixed(2)} s`;
const number = value => String(Number(value.toFixed(2)));
const stat = (label, value, note = '') => ({ label, value: String(value), note });

/** Accept either a shared catalog object or its id. `all` is a UI filter only. */
export function weaponCategory(weaponOrId, kind = 'gun') {
  const catalog = catalogFor(kind);
  const weapon = typeof weaponOrId === 'string' ? Object.hasOwn(catalog, weaponOrId) ? catalog[weaponOrId] : null : weaponOrId;
  const id = weapon?.id ?? (typeof weaponOrId === 'string' ? weaponOrId : '');
  if (kind === 'melee') return ['axe', 'tonfas'].includes(id) ? 'impact' : 'blades';
  if (GUN_CATEGORIES.some(category => category.id !== 'all' && category.id === weapon?.category)) return weapon.category;
  return Object.hasOwn(LEGACY_CATEGORIES, id) ? LEGACY_CATEGORIES[id] : 'special';
}

function gunStats(weapon) {
  const stats = weaponStats(weapon);
  if (!stats) return [];
  const pellets = stats.pellets > 1;
  const damageNote = pellets
    ? `Body damage per pellet · ${stats.pellets} pellets per shell · close range`
    : 'Body hit · close range';
  const ammo = pellets ? 'shells' : weapon.projectile ? 'bolts' : 'rounds';
  const fireNote = weapon.projectile ? 'Includes reload between bolts'
    : stats.windupSeconds ? `${seconds(stats.windupSeconds)} wind-up`
    : stats.mode === 'burst' ? 'Includes burst recovery' : '';
  const reloadNote = Number.isFinite(stats.emptyReloadSeconds) && stats.emptyReloadSeconds !== stats.reloadSeconds
    ? `${seconds(stats.emptyReloadSeconds)} when empty` : '';
  return [
    stat('Damage', weaponDamage(weapon, 'body', 0), damageNote),
    stat('Magazine', weapon.magazine, `${ammo} · ${weapon.reserve} in reserve`),
    stat('Fire rate', stats.fireRateLabel, fireNote),
    stat('Reload', seconds(stats.reloadSeconds), reloadNote),
  ];
}

function meleeStats(weapon) {
  const comboLength = meleeComboLength(weapon.id);
  const finisher = meleeProfile({ meleeWeapon: weapon.id, meleeAction: 'primary', meleeComboWeapon: weapon.id, meleeComboStep: comboLength });
  return [
    stat('Damage', weapon.damage, 'Opening strike'),
    stat('Reach', `${number(weapon.reach)} m`, 'Primary strike'),
    stat('Wind-up', seconds(weapon.startupTicks / 120), 'Before the strike becomes active'),
    stat('Swing', seconds((weapon.startupTicks + weapon.activeTicks + weapon.recoveryTicks) / 120), 'Full swing and recovery'),
    stat('Combo', `${comboLength} hits`, `Confirm each hit · ${seconds(MELEE_COMBO_WINDOW_TICKS / 120)} after recovery to follow up`),
    stat('Finisher', finisher.damage, 'Last confirmed cut · stronger push and brief stagger; enemies can resist'),
  ];
}

/** Build only the choices offered by this native selector, in selector order. */
export function createArmoryEntries(select, kind = 'gun') {
  const catalog = catalogFor(kind);
  const seen = new Set();
  return Array.from(select?.options ?? []).flatMap(option => {
    const id = String(option.value ?? '');
    // Empty options are prompts, not equipment. A value identifies one choice.
    if (!id || seen.has(id)) return [];
    seen.add(id);
    const weapon = Object.hasOwn(catalog, id) ? catalog[id] : null;
    const name = weapon?.name || String(option.label || option.textContent || option.text || id).trim() || id;
    const category = weaponCategory(weapon ?? id, kind);
    const group = option.closest?.('optgroup') ?? (option.parentElement?.tagName === 'OPTGROUP' ? option.parentElement : null);
    return [{
      id,
      name,
      label: weapon?.label || name,
      category,
      categoryLabel: categoryDefinitions(kind).find(item => item.id === category)?.label || 'Special',
      description: weapon?.description || '',
      image: `art/armory/${kind === 'melee' ? 'melee_' : ''}${encodeURIComponent(id)}.webp`,
      disabled: Boolean(select.disabled || option.disabled || group?.disabled),
      weapon,
      stats: weapon ? kind === 'melee' ? meleeStats(weapon) : gunStats(weapon) : [],
    }];
  });
}

/** Include only useful categories for this selector, with unfiltered counts. */
export function categoriesFor(entries, kind = 'gun') {
  return categoryDefinitions(kind).flatMap(category => {
    const count = category.id === 'all' ? entries.length : entries.filter(entry => entry.category === category.id).length;
    return category.id === 'all' || count ? [{ ...category, count }] : [];
  });
}

/** Search visible metadata without changing native options or selection. */
export function filterArmoryEntries(entries, category = 'all', query = '') {
  const terms = String(query ?? '').trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return entries.filter(entry => {
    if (category && category !== 'all' && entry.category !== category) return false;
    const text = [entry.name, entry.label, entry.id, entry.categoryLabel, entry.description].join(' ').toLocaleLowerCase();
    return terms.every(term => text.includes(term));
  });
}
