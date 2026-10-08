/** Shared Voxel Breach loadouts. Distances are metres; durations are 120 Hz ticks. */
const freezeWeapon = weapon => Object.freeze({ adsFovRatio: 54 / 70, adsSightHeight: .152, ...weapon,
  ...(weapon.falloff ? { falloff: Object.freeze(weapon.falloff) } : {}) });

export const WEAPONS = Object.freeze({
  carbine: freezeWeapon({ id: 'carbine', name: 'Kestrel Carbine', label: 'CARBINE', magazine: 24, reserve: 72, damage: 28, headMultiplier: 3, cooldown: 12, reloadTicks: 252, speed: 5.4, range: 100, recoil: .0085, movingSpread: .043, airborneSpread: .105, bloom: .0028, color: '#83d0bd', description: 'Accurate opening shot; controlled bursts beat sustained recoil.' }),
  smg: freezeWeapon({ id: 'smg', name: 'Swift SMG', label: 'SMG', magazine: 30, reserve: 90, damage: 20, headMultiplier: 2.5, cooldown: 9, reloadTicks: 216, speed: 5.9, range: 70, recoil: .0065, movingSpread: .026, airborneSpread: .082, bloom: .0022, falloff: { start: 20, span: 70, minimum: .65 }, color: '#ffc77a', description: 'Fast movement and close-range fire; damage falls beyond 20 metres.' }),
  marksman: freezeWeapon({ id: 'marksman', name: 'Heron Marksman', label: 'MARKSMAN', magazine: 8, reserve: 24, damage: 58, headMultiplier: 2, cooldown: 54, reloadTicks: 300, speed: 4.85, range: 120, recoil: .019, movingSpread: .077, airborneSpread: .15, bloom: .001, scoped: true, adsFovRatio: 40 / 70, adsSightHeight: .175, color: '#bcb5ff', description: 'A precise headshot wins instantly. Movement demands discipline.' }),
  pistol: freezeWeapon({ id: 'pistol', name: 'Finch Pistol', label: 'PISTOL', mode: 'semi', magazine: 12, reserve: 48, damage: 34, headMultiplier: 2.4, cooldown: 22, reloadTicks: 180, speed: 6, range: 85, recoil: .012, movingSpread: .029, airborneSpread: .095, bloom: .0022, color: '#a1d0f3', description: 'One shot per press. Quick movement rewards deliberate close-range aim.' }),
  shotgun: freezeWeapon({ id: 'shotgun', name: 'Warden Shotgun', label: 'SHOTGUN', mode: 'pump', magazine: 6, reserve: 18, damage: 12, headMultiplier: 1.35, cooldown: 90, reloadTicks: 288, speed: 5.15, range: 36, recoil: .024, movingSpread: .035, airborneSpread: .09, bloom: .002, pellets: 8, pelletSpread: .055, falloff: { start: 8, span: 24, minimum: .25 }, color: '#eac394', description: 'Eight pellets per shell. Powerful up close; cover blocks each pellet.' }),
  burst: freezeWeapon({ id: 'burst', name: 'Osprey Burst Rifle', label: 'BURST', mode: 'burst', magazine: 27, reserve: 81, damage: 23, headMultiplier: 2.8, cooldown: 42, burstCount: 3, burstInterval: 8, reloadTicks: 264, speed: 5.15, range: 105, recoil: .0095, movingSpread: .05, airborneSpread: .115, bloom: .0028, color: '#ecab91', description: 'Three shots per press. Release and re-aim during the burst recovery.' }),
  sniper: freezeWeapon({ id: 'sniper', name: 'Rook Bolt Sniper', label: 'BOLT SNIPER', mode: 'bolt', magazine: 5, reserve: 15, damage: 100, headMultiplier: 1.5, cooldown: 150, reloadTicks: 360, speed: 4.35, range: 150, recoil: .035, movingSpread: .11, airborneSpread: .22, bloom: .004, hipSpread: .085, aimedSpread: .0015, scoped: true, adsFovRatio: 32 / 70, adsSightHeight: .175, color: '#d6a5d9', description: 'One deliberate shot per click. Settle into the scope; a missed shot leaves a long bolt-cycle opening.' }),
  lmg: freezeWeapon({ id: 'lmg', name: 'Bastion LMG', label: 'LMG', mode: 'auto', magazine: 48, reserve: 96, damage: 26, headMultiplier: 2.25, cooldown: 12, reloadTicks: 396, speed: 4.4, range: 100, recoil: .0115, movingSpread: .065, airborneSpread: .145, bloom: .0016, spinupTicks: 24, color: '#c7cc8c', description: 'Hold fire through a brief wind-up. A long belt holds a lane; heavy movement and reloads demand cover.' }),
  crossbow: freezeWeapon({ id: 'crossbow', name: 'Peregrine Crossbow', label: 'CROSSBOW', mode: 'bolt', magazine: 1, reserve: 12, damage: 75, headMultiplier: 2, cooldown: 90, reloadTicks: 198, speed: 5.7, range: 100, recoil: .004, movingSpread: .022, airborneSpread: .065, bloom: 0, projectile: true, projectileSpeed: 48, projectileGravity: 9, projectileTicks: 240, color: '#93d3da', description: 'Lead moving targets and aim above distant ones. One flying bolt, then a manual reload.' }),
});

/** Slot order is shared by keyboard shortcuts and both loadout selectors. */
export const WEAPON_IDS = Object.freeze(Object.keys(WEAPONS));

const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const resolveWeapon = weapon => typeof weapon === 'string' ? (Object.hasOwn(WEAPONS, weapon) ? WEAPONS[weapon] : null) : weapon;

/** Damage at a real contact, before HP clamping. Shotgun callers apply this per pellet. */
export function weaponDamage(weaponOrId, hitKind = 'body', distance = 0) {
  const weapon = resolveWeapon(weaponOrId);
  if (!weapon || !Number.isFinite(weapon.damage) || weapon.damage <= 0) return 0;
  const falloff = weapon.falloff;
  const multiplier = falloff ? clamp(1 - Math.max(0, finite(distance) - falloff.start) / falloff.span, falloff.minimum, 1) : 1;
  return Math.round(weapon.damage * (hitKind === 'head' ? finite(weapon.headMultiplier, 1) : 1) * multiplier);
}

/** Indexed shot geometry consumes this angular cone; there is no random client spread. */
export function weaponSpread(weaponOrId, { motion = 0, grounded = true, heat = 0, ads = 0 } = {}, rules = {}) {
  const weapon = resolveWeapon(weaponOrId);
  if (!weapon) return 0;
  const aim = clamp(finite(ads), 0, 1), moving = clamp(finite(motion), 0, 1), bloom = clamp(finite(heat), 0, 8);
  const multiplier = 1 - aim * (1 - clamp(finite(rules.spreadMultiplier, .4), 0, 1));
  const handling = (moving * weapon.movingSpread + (grounded ? 0 : weapon.airborneSpread) + bloom * weapon.bloom) * multiplier;
  // A bolt sniper only obtains its small opening cone after the ADS transition.
  const opening = finite(weapon.hipSpread) * (1 - aim) + finite(weapon.aimedSpread) * aim;
  return opening + handling;
}

/** Camera zoom and mouse sensitivity share the weapon's optic depth. */
export function weaponAimFovRatio(weaponOrId, rules = {}) {
  const weapon = resolveWeapon(weaponOrId);
  const standard = weapon?.scoped ? 40 / 70 : 54 / 70;
  const configured = weapon?.scoped ? rules.scopedFovRatio : rules.fovRatio;
  const ratio = finite(weapon?.adsFovRatio, standard) * finite(configured, standard) / standard;
  return clamp(ratio, .2, 1);
}
