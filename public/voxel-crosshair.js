/** Cosmetic reticles share the real trigger/spread catalog. No aim or physics is changed. */
import { WEAPONS, weaponAimFovRatio, weaponSpread } from './voxel-weapons.js';
import { resolveActiveFire } from './voxel-fire-modes.js';

const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const smooth = value => value * value * (3 - 2 * value);
const dimension = (value, fallback) => clamp(finite(value, fallback) > 0 ? finite(value, fallback) : fallback, 1, 32768);
const resolveWeapon = player => typeof player?.weapon === 'string' && Object.hasOwn(WEAPONS, player.weapon) ? WEAPONS[player.weapon] : null;
const gunHeld = (player, weapon) => !!weapon && player?.hasGun !== false && (player?.slot == null || player.slot === 'primary');

export const CROSSHAIR_ROLES = Object.freeze({
  sidearm: Object.freeze({ gap: 3, arm: 5, stroke: 1.5 }),
  precision: Object.freeze({ gap: 5, arm: 4, stroke: 1 }),
  smg: Object.freeze({ gap: 5, arm: 6, stroke: 1.5 }),
  rifle: Object.freeze({ gap: 4, arm: 6, stroke: 1.5 }),
  shotgun: Object.freeze({ gap: 10, arm: 3, stroke: 1.5 }),
  slug: Object.freeze({ gap: 5, arm: 4, stroke: 1.5 }),
  lmg: Object.freeze({ gap: 7, arm: 8, stroke: 2 }),
  bolt: Object.freeze({ gap: 5, arm: 5, stroke: 1.5 }),
  blade: Object.freeze({ gap: 5, arm: 4, stroke: 1.5 }),
});

/** Milliseconds: quick expansion and a readable, steadier return after stopping. */
export const CROSSHAIR_TIMING = Object.freeze({ expand: 45, settle: 95, maxStep: 100, resetAfter: 500 });

function adsFraction(player, weapon, rules, override) {
  if (!gunHeld(player, weapon) || player?.alive === false || weapon.adsSupported === false || weapon.adsEnabled === false
      || player.healing || player.healTicks > 0 || player.reloadTicks > 0 || player.grenadeThrowTicks > 0) return 0;
  const ticks = finite(rules?.ticks, 18) > 0 ? finite(rules?.ticks, 18) : 18;
  return clamp(finite(override, finite(player.aimTicks) / ticks), 0, 1);
}

function spreadState(player, rules = {}, adsOverride) {
  const weapon = resolveWeapon(player), held = gunHeld(player, weapon);
  if (!held) return { weapon, held, fire: null, angularSpread: 0, motion: 0, speed: 0, heat: 0, ads: 0, grounded: player?.grounded !== false };
  const speed = Math.hypot(finite(player.vx), finite(player.vz));
  const motion = clamp((speed - .22) / Math.max(.001, finite(weapon.speed, 1)), 0, 1);
  const ads = adsFraction(player, weapon, rules, adsOverride), heat = clamp(finite(player.heat), 0, 8), grounded = player.grounded !== false;
  const fire = resolveActiveFire(weapon, player);
  const activeWeapon = fire?.alternate ? { ...weapon, hipSpread: fire.spread, aimedSpread: 0 } : weapon;
  const spread = weaponSpread(activeWeapon, { motion, grounded, heat, ads }, rules);
  // Classic's RMB volley widens its opening cone; Bucky's fan opens after its pop.
  const angularSpread = Math.max(0, finite(spread)) + Math.max(0, finite(fire?.pelletSpread));
  return { weapon, held, fire, angularSpread, motion, speed, heat, ads, grounded };
}

/** Radian envelope of the accepted trigger mode, including every pellet/volley. */
export function crosshairAngularSpread(player, rules = {}) {
  return spreadState(player, rules).angularSpread;
}

function reticleIdentity({ weapon, held, fire }) {
  if (!held) return { role: 'blade', ballistic: 'melee' };
  if (weapon.projectile) return { role: 'bolt', ballistic: 'bolt' };
  if (fire?.mode === 'airburst') return { role: 'shotgun', ballistic: 'airburst' };
  if (fire?.mode === 'volley') return { role: 'shotgun', ballistic: 'volley' };
  if ((fire?.pelletCount || weapon.pellets || 1) > 1) return { role: 'shotgun', ballistic: 'pellets' };
  if (weapon.id === 'slugshotgun') return { role: 'slug', ballistic: 'slug' };
  if (weapon.family === 'sniper' || ['sniper', 'marksman'].includes(weapon.id)) return { role: 'precision', ballistic: 'hitscan' };
  if (weapon.family === 'lmg' || weapon.category === 'heavy' || weapon.id === 'lmg') return { role: 'lmg', ballistic: 'hitscan' };
  if (weapon.category === 'smg' || ['smg', 'pdw', 'dualsmg'].includes(weapon.id)) return { role: 'smg', ballistic: 'hitscan' };
  if (weapon.category === 'sidearm' || ['pistol', 'revolver', 'dualpistols'].includes(weapon.id)) return { role: 'sidearm', ballistic: 'hitscan' };
  return { role: 'rifle', ballistic: 'hitscan' };
}

/**
 * fov is the renderer's BASE vertical FOV in degrees; dimensions are CSS pixels.
 * Spread uses linear ADS; the camera uses smoothstep ADS, just like the renderer.
 * The projected radius is the one-axis angular envelope, not a predicted impact.
 * Bucky airburst describes its distant fan, not a cone beginning at the eye.
 */
export function crosshairPresentation(player, { width = 960, height = 540, fov = 70, rules = {}, ads, active = true } = {}) {
  const state = spreadState(player, rules, ads), { role, ballistic } = reticleIdentity(state), profile = CROSSHAIR_ROLES[role];
  const cssWidth = dimension(width, 960), cssHeight = dimension(height, 540), aspect = cssWidth / cssHeight;
  const cameraAds = smooth(state.ads), baseFov = clamp(finite(fov, 70), 55, 95);
  const zoom = weaponAimFovRatio(state.weapon, rules), effectiveFov = baseFov * (1 + (zoom - 1) * cameraAds);
  const verticalFov = effectiveFov * Math.PI / 180, horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect);
  // A vertical-FOV perspective uses height for BOTH axes. Width alone must not
  // widen a reticle when going ultrawide; resolution/devicePixelRatio is irrelevant.
  const focalLength = cssHeight / (2 * Math.tan(verticalFov / 2));
  const spreadRadius = Math.tan(clamp(state.angularSpread, 0, Math.PI / 3)) * focalLength;
  // Extreme airborne/no-scope cones remain readable instead of covering the view.
  // Keep the real angularSpread and projected radius available for inspection.
  const maxGap = Math.max(4, Math.min(120, Math.min(cssWidth, cssHeight) * .18));
  const targetGap = clamp(Math.max(profile.gap, spreadRadius), 0, maxGap);
  const visible = !!player && player.alive !== false && active !== false && (state.held || player.slot === 'sword')
    && !player.healing && !(player.healTicks > 0) && !(player.grenadeThrowTicks > 0);
  return {
    visible,
    role, ballistic, fireMode: state.fire?.mode || null, alternate: state.fire?.alternate === true,
    weaponId: state.held ? state.weapon.id : player?.meleeWeapon || null,
    ads: state.ads, cameraAds, scoped: state.held && state.weapon.scoped === true && state.ads >= 14 / 18,
    motion: state.motion, speed: state.speed, heat: state.heat, grounded: state.grounded,
    motionState: !state.grounded ? 'airborne' : state.motion > 0 ? 'moving' : 'steady',
    angularSpread: state.angularSpread, spreadRadius, gap: targetGap, targetGap, clipped: spreadRadius > maxGap,
    arm: profile.arm, stroke: profile.stroke, width: cssWidth, height: cssHeight, aspect,
    baseFov, effectiveFov, verticalFov, horizontalFov, focalLength,
    center: { x: cssWidth / 2, y: cssHeight / 2 },
  };
}

/** One bounded clock for cosmetic gap only; neither center nor mouse angles move. */
export function createCrosshairPresenter() {
  let previous = null;
  const present = (player, time, contextKey = null, options = {}) => {
    const next = crosshairPresentation(player, options);
    const valid = next.visible && Number.isFinite(time);
    const context = [contextKey, player?.id, player?.lifeId, player?.deaths, player?.slot, player?.inventoryIndex,
      next.weaponId, next.role, next.ballistic, next.width, next.height, next.baseFov];
    if (!valid) { previous = null; return next; }
    const elapsed = previous ? time - previous.time : 0;
    const reset = !previous || context.some((value, index) => value !== previous.context[index])
      || elapsed < 0 || elapsed > CROSSHAIR_TIMING.resetAfter || previous.paused && !options.paused;
    if (!reset && options.reducedMotion !== true) {
      const step = options.paused ? 0 : clamp(elapsed, 0, CROSSHAIR_TIMING.maxStep);
      const duration = next.targetGap > previous.gap ? CROSSHAIR_TIMING.expand : CROSSHAIR_TIMING.settle;
      next.gap = next.targetGap + (previous.gap - next.targetGap) * Math.exp(-step / duration);
      if (Math.abs(next.gap - next.targetGap) < .005) next.gap = next.targetGap;
    }
    previous = { time, context, gap: next.gap, paused: options.paused === true };
    return next;
  };
  present.reset = () => { previous = null; };
  return present;
}

/** Paint reusable geometry only. Existing hit-feedback attributes remain untouched. */
export function paintCrosshair(element, presentation) {
  if (!element) return;
  const visible = presentation?.visible === true && !presentation.scoped;
  if (element.hidden !== !visible) element.hidden = !visible;
  if (!element.classList.contains('fps-crosshair')) element.classList.add('fps-crosshair');
  for (const [name, value] of Object.entries({ 'data-reticle': visible ? presentation.role : '', 'data-ballistic': visible ? presentation.ballistic : '',
    'data-motion': visible ? presentation.motionState : '', 'data-aim': visible ? presentation.ads > 0 ? 'aim' : 'hip' : '' })) {
    if (element.getAttribute(name) !== value) element.setAttribute(name, value);
  }
  for (const [name, value] of [['--reticle-gap', visible ? presentation.gap : 0], ['--reticle-arm', visible ? presentation.arm : 0], ['--reticle-stroke', visible ? presentation.stroke : 0]]) {
    const css = `${Math.max(0, finite(value)).toFixed(2)}px`;
    if (element.style.getPropertyValue(name) !== css) element.style.setProperty(name, css);
  }
}
