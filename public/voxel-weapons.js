/** Shared Voxel Breach loadouts. Distances are metres; durations are 120 Hz ticks. */
// Presentation follows the same immutable catalog as authoritative damage.
// Durations are 120 Hz ticks, widths are world metres; audio durations are seconds.
const PROFILES = Object.freeze({
  carbine: { legMultiplier: .75, effects: { tracerColor: '#ffe0a0', muzzleColor: '#ffd38c', impactColor: '#ffcc8c', tracerWidth: .016, tracerTicks: 15, muzzleTicks: 5, muzzleSize: 1, muzzleStrength: .95, impactStrength: 1, kickStrength: .8, kickTicks: 13 }, sound: { noiseDuration: .07, noiseVolume: .2, frequency: 170, toneDuration: .08, toneVolume: .09, wave: 'triangle', lowpass: 3400 } },
  smg: { legMultiplier: .8, effects: { tracerColor: '#fff0bf', muzzleColor: '#ffe0a6', impactColor: '#f9d693', tracerWidth: .012, tracerTicks: 12, muzzleTicks: 3, muzzleSize: .72, muzzleStrength: .72, impactStrength: .65, kickStrength: .45, kickTicks: 9 }, sound: { noiseDuration: .045, noiseVolume: .15, frequency: 230, toneDuration: .05, toneVolume: .065, wave: 'triangle', lowpass: 4500 } },
  marksman: { legMultiplier: .75, effects: { tracerColor: '#edddff', muzzleColor: '#fff0be', impactColor: '#e6c9ff', tracerWidth: .021, tracerTicks: 21, muzzleTicks: 7, muzzleSize: 1.15, muzzleStrength: 1.1, impactStrength: 1.25, kickStrength: 1.25, kickTicks: 22 }, sound: { noiseDuration: .11, noiseVolume: .23, frequency: 118, toneDuration: .12, toneVolume: .13, wave: 'triangle', lowpass: 2800 } },
  pistol: { legMultiplier: .85, effects: { tracerColor: '#d8efff', muzzleColor: '#ffe9b8', impactColor: '#b8dfff', tracerWidth: .014, tracerTicks: 13, muzzleTicks: 4, muzzleSize: .7, muzzleStrength: .75, impactStrength: .8, kickStrength: .9, kickTicks: 16 }, sound: { noiseDuration: .065, noiseVolume: .17, frequency: 270, toneDuration: .07, toneVolume: .085, wave: 'triangle', lowpass: 3900 } },
  shotgun: { legMultiplier: .7, effects: { tracerColor: '#ffd6a0', muzzleColor: '#ffb969', impactColor: '#eab480', tracerWidth: .01, tracerTicks: 12, muzzleTicks: 8, muzzleSize: 1.42, muzzleStrength: 1.3, impactStrength: .65, kickStrength: 1.65, kickTicks: 30 }, sound: { noiseDuration: .17, noiseVolume: .29, frequency: 92, toneDuration: .16, toneVolume: .16, wave: 'triangle', lowpass: 2100 } },
  burst: { legMultiplier: .78, effects: { tracerColor: '#ffd0b0', muzzleColor: '#ffcf8c', impactColor: '#edbba0', tracerWidth: .015, tracerTicks: 15, muzzleTicks: 4, muzzleSize: .95, muzzleStrength: .88, impactStrength: .92, kickStrength: .7, kickTicks: 12 }, sound: { noiseDuration: .06, noiseVolume: .19, frequency: 195, toneDuration: .065, toneVolume: .095, wave: 'triangle', lowpass: 3600 } },
  sniper: { legMultiplier: .7, effects: { tracerColor: '#f2d5ff', muzzleColor: '#fff2c9', impactColor: '#e8baff', tracerWidth: .03, tracerTicks: 26, muzzleTicks: 10, muzzleSize: 1.65, muzzleStrength: 1.45, impactStrength: 1.6, kickStrength: 1.95, kickTicks: 39 }, sound: { noiseDuration: .2, noiseVolume: .3, frequency: 72, toneDuration: .23, toneVolume: .18, wave: 'triangle', lowpass: 2200 } },
  lmg: { legMultiplier: .8, effects: { tracerColor: '#f1efb1', muzzleColor: '#ffdd94', impactColor: '#d5d6a4', tracerWidth: .019, tracerTicks: 18, muzzleTicks: 6, muzzleSize: 1.28, muzzleStrength: 1.13, impactStrength: 1.05, kickStrength: 1.05, kickTicks: 14 }, sound: { noiseDuration: .09, noiseVolume: .22, frequency: 135, toneDuration: .095, toneVolume: .12, wave: 'triangle', lowpass: 2700 } },
  crossbow: { legMultiplier: .8, effects: { tracerColor: '#a7e6e9', muzzleColor: '#a7e6e9', impactColor: '#9ad4d6', tracerWidth: .012, tracerTicks: 0, muzzleTicks: 0, muzzleSize: 0, muzzleStrength: 0, impactStrength: .7, kickStrength: .3, kickTicks: 18 }, sound: { noiseDuration: .09, noiseVolume: .075, frequency: 410, toneDuration: .115, toneVolume: .06, wave: 'sine', lowpass: 1900 } },
  revolver: { legMultiplier: .8, effects: { tracerColor: '#ffe4c1', muzzleColor: '#ffd091', impactColor: '#edc294', tracerWidth: .02, tracerTicks: 18, muzzleTicks: 6, muzzleSize: .96, muzzleStrength: 1.06, impactStrength: 1.18, kickStrength: 1.4, kickTicks: 24 }, sound: { noiseDuration: .105, noiseVolume: .24, frequency: 104, toneDuration: .12, toneVolume: .14, wave: 'triangle', lowpass: 2900 } },
  pdw: { legMultiplier: .82, effects: { tracerColor: '#ccece2', muzzleColor: '#d2b68a', impactColor: '#b0d9cc', tracerWidth: .009, tracerTicks: 10, muzzleTicks: 2, muzzleSize: .25, muzzleStrength: .16, impactStrength: .55, kickStrength: .36, kickTicks: 8 }, sound: { noiseDuration: .034, noiseVolume: .065, frequency: 182, toneDuration: .038, toneVolume: .032, wave: 'triangle', lowpass: 1800 } },
  autoshotgun: { legMultiplier: .7, effects: { tracerColor: '#ffcca3', muzzleColor: '#ffad65', impactColor: '#ddb087', tracerWidth: .009, tracerTicks: 10, muzzleTicks: 7, muzzleSize: 1.3, muzzleStrength: 1.22, impactStrength: .58, kickStrength: 1.35, kickTicks: 24 }, sound: { noiseDuration: .135, noiseVolume: .265, frequency: 79, toneDuration: .13, toneVolume: .145, wave: 'triangle', lowpass: 1950 } },
  battlerifle: { legMultiplier: .75, effects: { tracerColor: '#fff1bd', muzzleColor: '#ffc27b', impactColor: '#e0c191', tracerWidth: .023, tracerTicks: 20, muzzleTicks: 7, muzzleSize: 1.24, muzzleStrength: 1.18, impactStrength: 1.3, kickStrength: 1.25, kickTicks: 20 }, sound: { noiseDuration: .12, noiseVolume: .25, frequency: 89, toneDuration: .135, toneVolume: .15, wave: 'triangle', lowpass: 2400 } },
  dualpistols: { legMultiplier: .85, effects: { tracerColor: '#f5daae', muzzleColor: '#ffe6a0', impactColor: '#e9c18c', tracerWidth: .014, tracerTicks: 13, muzzleTicks: 4, muzzleSize: .68, muzzleStrength: .73, impactStrength: .75, kickStrength: .68, kickTicks: 12 }, sound: { noiseDuration: .06, noiseVolume: .18, frequency: 245, toneDuration: .065, toneVolume: .08, wave: 'triangle', lowpass: 3850 } },
  dualsmg: { legMultiplier: .82, effects: { tracerColor: '#ffd9be', muzzleColor: '#ffd394', impactColor: '#ddad84', tracerWidth: .011, tracerTicks: 10, muzzleTicks: 3, muzzleSize: .6, muzzleStrength: .62, impactStrength: .52, kickStrength: .38, kickTicks: 8 }, sound: { noiseDuration: .038, noiseVolume: .14, frequency: 214, toneDuration: .04, toneVolume: .06, wave: 'triangle', lowpass: 4250 } },
  slugshotgun: { legMultiplier: .72, effects: { tracerColor: '#ffd09c', muzzleColor: '#ffba75', impactColor: '#edaf77', tracerWidth: .026, tracerTicks: 20, muzzleTicks: 8, muzzleSize: 1.38, muzzleStrength: 1.28, impactStrength: 1.48, kickStrength: 1.72, kickTicks: 34 }, sound: { noiseDuration: .175, noiseVolume: .29, frequency: 81, toneDuration: .19, toneVolume: .17, wave: 'triangle', lowpass: 1950 } },
});
const freezeWeapon = weapon => Object.freeze({ adsFovRatio: 54 / 70, adsSightHeight: .152, ...weapon,
  legMultiplier: PROFILES[weapon.id].legMultiplier,
  effects: Object.freeze(PROFILES[weapon.id].effects), sound: Object.freeze(PROFILES[weapon.id].sound),
  ...(weapon.falloff ? { falloff: Object.freeze(weapon.falloff) } : {}) });

export const WEAPONS = Object.freeze({
  carbine: freezeWeapon({ id: 'carbine', name: 'Kestrel Carbine', label: 'CARBINE', magazine: 24, reserve: 72, damage: 28, headMultiplier: 3, cooldown: 12, reloadTicks: 252, speed: 5.4, range: 100, recoil: .0085, movingSpread: .043, airborneSpread: .105, bloom: .0028, color: '#83d0bd', description: 'Accurate opening shot; controlled bursts beat sustained recoil.' }),
  smg: freezeWeapon({ id: 'smg', name: 'Swift SMG', label: 'SMG', magazine: 30, reserve: 90, damage: 20, headMultiplier: 2.5, cooldown: 9, reloadTicks: 216, speed: 5.9, range: 70, recoil: .0065, movingSpread: .026, airborneSpread: .082, bloom: .0022, falloff: { start: 20, span: 70, minimum: .65 }, color: '#ffc77a', description: 'Fast movement and close-range fire; damage falls beyond 20 metres.' }),
  marksman: freezeWeapon({ id: 'marksman', name: 'Heron Marksman', label: 'MARKSMAN', magazine: 8, reserve: 24, damage: 58, headMultiplier: 2, cooldown: 54, reloadTicks: 300, speed: 4.85, range: 120, recoil: .019, movingSpread: .077, airborneSpread: .15, bloom: .001, scoped: true, adsFovRatio: 40 / 70, adsSightHeight: .175, color: '#bcb5ff', description: 'Precise follow-up shots reward patient aim. Movement demands discipline.' }),
  pistol: freezeWeapon({ id: 'pistol', name: 'Finch Pistol', label: 'PISTOL', mode: 'semi', magazine: 12, reserve: 48, damage: 34, headMultiplier: 2.4, cooldown: 22, reloadTicks: 180, speed: 6, range: 85, recoil: .012, movingSpread: .029, airborneSpread: .095, bloom: .0022, color: '#a1d0f3', description: 'One shot per press. Quick movement rewards deliberate close-range aim.' }),
  shotgun: freezeWeapon({ id: 'shotgun', name: 'Warden Shotgun', label: 'SHOTGUN', mode: 'pump', magazine: 6, reserve: 18, damage: 12, headMultiplier: 1.35, cooldown: 90, reloadTicks: 288, speed: 5.15, range: 36, recoil: .024, movingSpread: .035, airborneSpread: .09, bloom: .002, pellets: 8, pelletSpread: .055, falloff: { start: 8, span: 24, minimum: .25 }, color: '#eac394', description: 'Eight pellets per shell. Powerful up close; cover blocks each pellet.' }),
  burst: freezeWeapon({ id: 'burst', name: 'Osprey Burst Rifle', label: 'BURST', mode: 'burst', magazine: 27, reserve: 81, damage: 23, headMultiplier: 2.8, cooldown: 42, burstCount: 3, burstInterval: 8, reloadTicks: 264, speed: 5.15, range: 105, recoil: .0095, movingSpread: .05, airborneSpread: .115, bloom: .0028, color: '#ecab91', description: 'Three shots per press. Release and re-aim during the burst recovery.' }),
  sniper: freezeWeapon({ id: 'sniper', name: 'Rook Bolt Sniper', label: 'BOLT SNIPER', mode: 'bolt', magazine: 5, reserve: 15, damage: 100, headMultiplier: 1.5, cooldown: 150, reloadTicks: 360, speed: 4.35, range: 150, recoil: .035, movingSpread: .11, airborneSpread: .22, bloom: .004, hipSpread: .085, aimedSpread: .0015, scoped: true, adsFovRatio: 32 / 70, adsSightHeight: .175, color: '#d6a5d9', description: 'One deliberate shot per click. Settle into the scope; a missed shot leaves a long bolt-cycle opening.' }),
  lmg: freezeWeapon({ id: 'lmg', name: 'Bastion LMG', label: 'LMG', mode: 'auto', magazine: 48, reserve: 96, damage: 26, headMultiplier: 2.25, cooldown: 12, reloadTicks: 396, speed: 4.4, range: 100, recoil: .0115, movingSpread: .065, airborneSpread: .145, bloom: .0016, spinupTicks: 24, color: '#c7cc8c', description: 'Hold fire through a brief wind-up. A long belt holds a lane; heavy movement and reloads demand cover.' }),
  crossbow: freezeWeapon({ id: 'crossbow', name: 'Peregrine Crossbow', label: 'CROSSBOW', mode: 'bolt', magazine: 1, reserve: 12, damage: 75, headMultiplier: 2, cooldown: 90, reloadTicks: 198, speed: 5.7, range: 100, recoil: .004, movingSpread: .022, airborneSpread: .065, bloom: 0, projectile: true, projectileSpeed: 48, projectileGravity: 9, projectileTicks: 240, color: '#93d3da', description: 'Lead moving targets and aim above distant ones. One flying bolt, then a manual reload.' }),
  revolver: freezeWeapon({ id: 'revolver', name: 'Shrike Revolver', label: 'REVOLVER', mode: 'semi', magazine: 6, reserve: 30, damage: 64, headMultiplier: 2, cooldown: 46, reloadTicks: 324, speed: 5.7, range: 95, recoil: .026, movingSpread: .051, airborneSpread: .125, bloom: .0018, hipSpread: .006, aimedSpread: .001, adsFovRatio: 50 / 70, falloff: { start: 28, span: 70, minimum: .78 }, color: '#edbe96', description: 'Six powerful rounds, one per press. Settle your aim and make each shot count before the long cylinder reload.' }),
  pdw: freezeWeapon({ id: 'pdw', name: 'Moth Suppressed PDW', label: 'SUPPRESSED PDW', mode: 'auto', magazine: 32, reserve: 96, damage: 18, headMultiplier: 2.5, cooldown: 7, reloadTicks: 228, speed: 5.75, range: 65, recoil: .0058, movingSpread: .022, airborneSpread: .079, bloom: .0028, hipSpread: .012, aimedSpread: .002, falloff: { start: 12, span: 32, minimum: .4 }, suppressed: true, color: '#95c5b7', description: 'A quiet, fast close-range burst with a subdued muzzle flash. Aim down sights; damage drops sharply beyond 12 metres.' }),
  autoshotgun: freezeWeapon({ id: 'autoshotgun', name: 'Harrier Auto Shotgun', label: 'AUTO SHOTGUN', mode: 'auto', magazine: 8, reserve: 24, damage: 10, headMultiplier: 1.2, cooldown: 42, reloadTicks: 336, speed: 4.95, range: 29, recoil: .021, movingSpread: .045, airborneSpread: .105, bloom: .003, pellets: 7, pelletSpread: .071, adsFovRatio: 58 / 70, falloff: { start: 6, span: 18, minimum: .18 }, color: '#dcb293', description: 'Hold fire for seven pellets per shell. A wide close-range cone trades reach and reload speed for repeated pressure.' }),
  battlerifle: freezeWeapon({ id: 'battlerifle', name: 'Condor Battle Rifle', label: 'BATTLE RIFLE', mode: 'auto', magazine: 20, reserve: 60, damage: 37, headMultiplier: 2.7, cooldown: 20, reloadTicks: 300, speed: 4.9, range: 125, recoil: .018, movingSpread: .065, airborneSpread: .145, bloom: .004, hipSpread: .003, aimedSpread: .0008, adsFovRatio: 46 / 70, falloff: { start: 36, span: 95, minimum: .7 }, color: '#d5c496', description: 'Heavy automatic rounds reward settled headshots. Short bursts control its climbing recoil and slow movement.' }),
  dualpistols: freezeWeapon({ id: 'dualpistols', name: 'Twin Finch Pistols', label: 'DUAL PISTOLS', mode: 'semi', dualWield: true, pressBufferTicks: 16, magazine: 24, reserve: 72, damage: 26, headMultiplier: 2.4, cooldown: 16, reloadTicks: 240, speed: 5.8, range: 75, recoil: .009, movingSpread: .034, airborneSpread: .105, bloom: .0026, hipSpread: .005, aimedSpread: .002, adsFovRatio: 60 / 70, falloff: { start: 18, span: 65, minimum: .6 }, color: '#e8ca93', description: 'One alternating-hand shot per press. A shared 24-round pair rewards close-range rhythm and deliberate aim.' }),
  dualsmg: freezeWeapon({ id: 'dualsmg', name: 'Twin Swift SMGs', label: 'DUAL SMGS', mode: 'auto', dualWield: true, magazine: 48, reserve: 144, damage: 16, headMultiplier: 2.4, cooldown: 6, reloadTicks: 300, speed: 5.5, range: 60, recoil: .0055, movingSpread: .034, airborneSpread: .098, bloom: .0032, hipSpread: .016, aimedSpread: .006, adsFovRatio: 60 / 70, falloff: { start: 10, span: 36, minimum: .38 }, color: '#d5a5b5', description: 'Hold fire to alternate both guns. A combined 48-round magazine and wide close-range cone demand careful reload timing.' }),
  slugshotgun: freezeWeapon({ id: 'slugshotgun', name: 'Goshawk Slug Shotgun', label: 'SLUG SHOTGUN', mode: 'pump', magazine: 5, reserve: 20, damage: 82, headMultiplier: 1.6, cooldown: 102, reloadTicks: 312, speed: 5, range: 80, recoil: .029, movingSpread: .059, airborneSpread: .13, bloom: .0025, hipSpread: .004, aimedSpread: .001, adsFovRatio: 48 / 70, falloff: { start: 12, span: 54, minimum: .35 }, color: '#e1af83', description: 'One powerful slug per press. Reward precise aim; damage falls beyond 12 metres and a miss leaves a long pump recovery.' }),
});

/** Slot order is shared by keyboard shortcuts and both loadout selectors. */
export const WEAPON_IDS = Object.freeze(Object.keys(WEAPONS));

const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const resolveWeapon = weapon => typeof weapon === 'string' ? (Object.hasOwn(WEAPONS, weapon) ? WEAPONS[weapon] : null) : weapon;

/** Hands alternate only after an accepted physical round: 0 right, 1 left. */
export function weaponHand(weaponOrId, shotIndex = 1) {
  const weapon = resolveWeapon(weaponOrId), index = Math.max(1, Math.floor(finite(shotIndex, 1)));
  return weapon?.dualWield && index % 2 === 0 ? 1 : 0;
}

/** Damage at a real contact, before HP clamping. Shotgun callers apply this per pellet. */
export function weaponDamage(weaponOrId, hitKind = 'body', distance = 0) {
  const weapon = resolveWeapon(weaponOrId);
  if (!weapon || !Number.isFinite(weapon.damage) || weapon.damage <= 0) return 0;
  const falloff = weapon.falloff;
  const multiplier = falloff ? clamp(1 - Math.max(0, finite(distance) - falloff.start) / falloff.span, falloff.minimum, 1) : 1;
  const zone = hitKind === 'head' ? finite(weapon.headMultiplier, 1) : hitKind === 'leg' ? finite(weapon.legMultiplier, .75) : 1;
  return Math.round(weapon.damage * zone * multiplier);
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


/** Loadout comparison describes actual damage and cadence, not nominal pellet DPS. */
export function weaponStats(weaponOrId) {
  const weapon = resolveWeapon(weaponOrId);
  if (!weapon || !Number.isFinite(weapon.cooldown) || weapon.cooldown <= 0) return null;
  const mode = weapon.mode || 'auto', pellets = weapon.pellets || 1;
  const cycleTicks = mode === 'burst'
    ? (weapon.burstCount - 1) * weapon.burstInterval + weapon.cooldown
    : weapon.projectile ? Math.max(weapon.cooldown, weapon.reloadTicks) : weapon.cooldown;
  const shotsPerSecond = 120 * (mode === 'burst' ? weapon.burstCount : 1) / cycleTicks;
  const cadence = `${Number(shotsPerSecond.toFixed(1))} ${pellets > 1 ? 'shells' : 'shots'}/s`;
  const fireRateLabel = mode === 'burst' ? `${weapon.burstCount}-round burst · ${cadence}` : mode === 'semi' || mode === 'pump' || mode === 'bolt' ? `${cadence} · per press` : cadence;
  return Object.freeze({
    body: weaponDamage(weapon, 'body'), head: weaponDamage(weapon, 'head'), leg: weaponDamage(weapon, 'leg'),
    pellets, damagePerPellet: pellets > 1, shotsPerSecond, fireRateLabel, mode,
    reloadSeconds: weapon.reloadTicks / 120, cycleSeconds: cycleTicks / 120,
    windupSeconds: (weapon.spinupTicks || 0) / 120,
    effectiveRange: weapon.range, falloffStart: weapon.falloff?.start ?? null,
    falloffEnd: weapon.falloff ? weapon.falloff.start + weapon.falloff.span * (1 - weapon.falloff.minimum) : null,
    falloffMinimum: weapon.falloff?.minimum ?? 1,
    projectileSpeed: weapon.projectile ? weapon.projectileSpeed : null,
    projectileGravity: weapon.projectile ? weapon.projectileGravity : null,
  });
}
