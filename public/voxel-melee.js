/** Shared melee handling for the authoritative simulation and its presentation. */
import { monsterAttackOrigin } from './voxel-monster-bodies.js';
// Each carried blade has a close-range role; Royale's free starter knife stays
// short and quick. Distances are metres; durations are 120 Hz ticks.
export const MELEE = Object.freeze({ id: 'sword', name: 'Breach Sword', label: 'SWORD', startupTicks: 12, activeTicks: 12, recoveryTicks: 30, damage: 100, reach: 3.05, arcRadians: .70, speed: 5.85, slashRadius: .24, slashTilt: -.16, slashDropRadians: .28, pushSpeed: 4.2, description: 'A wide, powerful two-hit slash. Guide the windup, then commit the cut and step through recovery.' });
export const KNIFE = Object.freeze({ id: 'knife', name: 'Survivor Knife', label: 'KNIFE', startupTicks: 10, activeTicks: 8, recoveryTicks: 26, damage: 28, reach: 1.7, arcRadians: .64, speed: 6.1, slashRadius: .14, slashTilt: 0, pushSpeed: 2.2, description: 'A small, quick starter blade. Close the gap and commit each strike carefully.' });

/** Every blade contacts once per committed swing; paired tonfas alternate hands. */
export const MELEE_WEAPONS = Object.freeze({
  knife: KNIFE,
  sword: MELEE,
  katana: Object.freeze({ id: 'katana', name: 'Raven Katana', label: 'KATANA', startupTicks: 8, activeTicks: 10, recoveryTicks: 24, damage: 75, reach: 3.35, arcRadians: .52, speed: 6, slashRadius: .22, slashTilt: -.12, slashDropRadians: .34, pushSpeed: 3, description: 'A fast long cut with modest pushback. Guide the short windup and chain three precise cuts at close range.' }),
  axe: Object.freeze({ id: 'axe', name: 'Bulwark Axe', label: 'AXE', startupTicks: 22, activeTicks: 12, recoveryTicks: 50, damage: 140, reach: 2.85, arcRadians: .72, speed: 5.1, slashRadius: .26, slashTilt: -.72, slashDropRadians: .32, pushSpeed: 10, description: 'A heavy committed chop. High impact trades wind-up, recovery and movement speed.' }),
  tonfas: Object.freeze({ id: 'tonfas', name: 'Twin Tonfas', label: 'DUAL TONFAS', startupTicks: 6, activeTicks: 7, recoveryTicks: 17, damage: 42, reach: 2, arcRadians: .58, speed: 6.15, dualWield: true, slashRadius: .20, slashTilt: -.20, pushSpeed: 2.6, description: 'Alternate quick close strikes with both hands. Five clean blows defeat a full-health rival; each press is one blow.' }),
});
/** A precise RMB commitment extends the starter knife without widening its band. */
export const KNIFE_SECONDARY = Object.freeze({ ...KNIFE, startupTicks: 20, activeTicks: 6, recoveryTicks: 54, damage: 60, reach: 2.15, slashRadius: .10, pushSpeed: 3.2 });
const guard = (startupTicks, activeTicks, recoveryTicks, cooldownTicks, staminaCost, halfAngle) => Object.freeze({ startupTicks, activeTicks, recoveryTicks, cooldownTicks, staminaCost, halfAngle });
export const PARRY_PROFILES = Object.freeze({ sword: guard(4, 12, 24, 72, 12, .75), katana: guard(4, 12, 24, 72, 12, .75), axe: guard(7, 8, 38, 96, 16, .6), tonfas: guard(3, 14, 22, 66, 10, .8) });
export const MELEE_IDS = Object.freeze(Object.keys(MELEE_WEAPONS));
export const MELEE_WEAPON_IDS = MELEE_IDS;
export const meleeWeaponId = playerOrId => {
  const id = typeof playerOrId === 'string' ? playerOrId : playerOrId?.meleeWeapon;
  return typeof id === 'string' && Object.hasOwn(MELEE_WEAPONS, id) ? id : 'sword';
};
export const meleeProfile = playerOrId => meleeWeaponId(playerOrId) === 'knife' && playerOrId?.meleeAction === 'secondary' ? KNIFE_SECONDARY : MELEE_WEAPONS[meleeWeaponId(playerOrId)];
export const meleeLabel = playerOrId => meleeProfile(playerOrId).label;
export const meleeHand = (playerOrId, swingIndex = 1) => meleeProfile(playerOrId).dualWield && Math.max(1, Math.floor(Number.isFinite(swingIndex) ? swingIndex : 1)) % 2 === 0 ? 1 : 0;
export const parryProfile = playerOrId => PARRY_PROFILES[meleeWeaponId(playerOrId)] || null;

const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const point = (x, y, z) => ({ x, y, z });

/** One fresh primary press may bridge only the final 83 ms of blade recovery. */
export const MELEE_PRESS_BUFFER_TICKS = 10;
/** A queued click is transient intent, never a physical inventory cooldown. */
export function clearMeleeBuffer(player) { player.pendingMeleeTicks = 0; return player; }
export function advanceMeleePrimaryPress(player, input, actions = player) {
  let pendingMeleeTicks = Math.max(0, Math.min(MELEE_PRESS_BUFFER_TICKS, finite(actions.pendingMeleeTicks)) - 1);
  const cancelled = player.alive === false || player.slot !== 'sword' || actions.reloadTicks || actions.healTicks || actions.grenadeThrowTicks || actions.parryTicks || actions.triggerBlocked
    || input.interact || input.reload || input.heal || input.grenade || input.swap || input.drop || ['slot1', 'slot2', 'slot3', 'slot4'].some(key => input[key]);
  if (cancelled) return { pendingMeleeTicks: 0, primaryPressed: false };
  // Defense clears a queued followup, but a fresh cut keeps primary precedence
  // at idle, including fallback right-button dragging with the left button.
  if (input.aim) pendingMeleeTicks = 0;
  const remaining = Math.max(0, finite(actions.meleeTicks) - 1), ready = !remaining && !actions.meleeCooldown;
  const fresh = input.fire && !player.previousInput?.fire;
  if (fresh && !input.aim && !ready && actions.meleeAction !== 'secondary' && actions.meleeTicks > 0 && actions.meleeTicks <= Math.min(meleeProfile(player).recoveryTicks, MELEE_PRESS_BUFFER_TICKS) && actions.meleeCooldown <= MELEE_PRESS_BUFFER_TICKS) pendingMeleeTicks = MELEE_PRESS_BUFFER_TICKS;
  const primaryPressed = Boolean(ready && (fresh || pendingMeleeTicks));
  return { pendingMeleeTicks: primaryPressed ? 0 : pendingMeleeTicks, primaryPressed };
}

const direction = (yaw, pitch) => [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
const angleBetween = (a, b) => Math.acos(clamp(a.reduce((sum, value, index) => sum + value * b[index], 0), -1, 1));
function rotateToward(from, to, limit) {
  const angle = angleBetween(from, to);
  if (angle <= limit) return to;
  // A deterministic perpendicular axis keeps a directly backwards mouse turn
  // finite without choosing a random side or accumulating more than the cap.
  let tangent = to.map((value, index) => value - from[index] * Math.cos(angle));
  let length = Math.hypot(...tangent);
  if (length < 1e-8) { tangent = [from[2], 0, -from[0]]; length = Math.hypot(...tangent); }
  return from.map((value, index) => value * Math.cos(limit) + tangent[index] / length * Math.sin(limit));
}
/** Human sword/katana windups can be guided 12 degrees; active cuts never turn. */
export function meleeStartupAim(player, input = player) {
  const profile = meleeProfile(player);
  const yaw = finite(player?.meleeYaw, finite(player?.yaw)), pitch = clamp(finite(player?.meleePitch, finite(player?.pitch)), -1.35, 1.35);
  if (!['sword', 'katana'].includes(profile.id) || player?.meleeAction === 'secondary' || player?.monster === true || finite(player?.meleeTicks) <= profile.activeTicks + profile.recoveryTicks) return { yaw, pitch };
  const initial = direction(finite(player.meleeInitialYaw, yaw), clamp(finite(player.meleeInitialPitch, pitch), -1.35, 1.35));
  const wanted = direction(finite(input?.yaw, yaw), clamp(finite(input?.pitch, pitch), -1.35, 1.35));
  const bounded = rotateToward(initial, wanted, Math.PI / 15);
  const next = rotateToward(direction(yaw, pitch), bounded, Math.PI / 120);
  return { yaw: Math.atan2(next[0], -next[2]), pitch: clamp(Math.asin(clamp(next[1], -1, 1)), -1.35, 1.35) };
}

/** Cancel transient defense; genuine physical-item and global recovery survive. */
export function resetMeleeDefense(player, { clearCooldown = false, blockAim = player.meleeAimBlocked === true } = {}) {
  clearMeleeBuffer(player); player.meleeInitialYaw = player.meleeInitialPitch = 0;
  player.parryTicks = 0; player.parryYaw = 0; player.parryPitch = 0; player.parryStartTick = 0; player.parryConsumed = false; player.meleeAction = 'primary'; player.meleeAimBlocked = blockAim === true;
  if (clearCooldown) {
    player.parryCooldown = player.meleeSecondaryCooldown = 0;
    for (const item of player.inventory || []) if (item?.kind === 'melee') item.parryCooldown = 0;
  }
  return player;
}

/** Accepted guard timers are shared with world/first-person presentation. */
export function parryPhase(player) {
  const profile = parryProfile(player), total = profile ? profile.startupTicks + profile.activeTicks + profile.recoveryTicks : 0;
  const remaining = clamp(finite(player?.parryTicks), 0, total);
  if (!remaining || !profile) return { phase: 'idle', progress: 0 };
  if (remaining > profile.activeTicks + profile.recoveryTicks) return { phase: 'startup', progress: (total - remaining) / profile.startupTicks };
  if (remaining > profile.recoveryTicks && !player.parryConsumed) return { phase: 'active', progress: (profile.activeTicks + profile.recoveryTicks - remaining) / profile.activeTicks };
  return { phase: 'recovery', progress: clamp((profile.recoveryTicks - remaining) / profile.recoveryTicks, 0, 1) };
}

/** Face the true attack origin using the committed three-dimensional guard. */
export function parryFacesOrigin(player, origin) {
  const profile = parryProfile(player), pivot = meleeSlashOrigin(player);
  if (!profile || ![origin?.x, origin?.y, origin?.z].every(Number.isFinite)) return false;
  const dx = origin.x - pivot.x, dy = origin.y - pivot.y, dz = origin.z - pivot.z, distance = Math.hypot(dx, dy, dz);
  if (distance <= 1e-8) return false;
  const yaw = finite(player.parryYaw), pitch = clamp(finite(player.parryPitch), -1.35, 1.35), cp = Math.cos(pitch);
  return (dx * Math.sin(yaw) * cp + dy * Math.sin(pitch) - dz * Math.cos(yaw) * cp) / distance >= Math.cos(profile.halfAngle);
}

/** The committed blade pivots at the same physical chest height in every mode. */
export function meleeSlashOrigin(player) {
  return monsterAttackOrigin(player) || point(finite(player?.x), finite(player?.y) + (player?.crouching ? .98 : 1.62) * .76, finite(player?.z));
}

/** Active geometry leads to the end of the exact 120 Hz damage slice. */
export function meleeSlashPhase(player) {
  const profile = meleeProfile(player), total = profile.startupTicks + profile.activeTicks + profile.recoveryTicks;
  const remaining = clamp(finite(player?.meleeTicks), 0, total);
  if (!remaining) return { phase: 'idle', from: 0, to: 0, progress: 0 };
  if (remaining > profile.activeTicks + profile.recoveryTicks) return { phase: 'startup', from: 0, to: 0, progress: 0 };
  if (remaining <= profile.recoveryTicks) return { phase: 'recovery', from: 1, to: 1, progress: 1 };
  const elapsed = profile.activeTicks + profile.recoveryTicks - remaining, from = elapsed / profile.activeTicks, to = clamp((elapsed + 1) / profile.activeTicks, 0, 1);
  return { phase: 'active', from, to, progress: to };
}

/**
 * A slash is a finite swept blade band, rather than a whole damaging cone.
 * Its capsule samples define both contacts and the visible blade ribbon.
 * Knife is a focused stab; the two short tonfa cuts alternate their sweep.
 */
export function meleeSlashGeometry(player, { from = 0, to = 1, origin = meleeSlashOrigin(player) } = {}) {
  const profile = meleeProfile(player), kind = profile.id === 'knife' ? 'stab' : 'slash';
  from = clamp(finite(from), 0, 1); to = clamp(finite(to, 1), from, 1);
  const radius = profile.slashRadius, innerLength = .18, outerLength = profile.reach - radius;
  const yaw = finite(player?.meleeYaw, finite(player?.yaw)), pitch = clamp(finite(player?.meleePitch, finite(player?.pitch)), -1.35, 1.35);
  const sy = Math.sin(yaw), cy = Math.cos(yaw), tilt = profile.slashTilt, drop = finite(profile.slashDropRadians);
  const reverse = profile.dualWield && player?.meleeHand === 1 ? -1 : 1;
  const steps = kind === 'stab' ? 1 : Math.min(48, Math.max(1, Math.ceil((to - from) * (profile.arcRadians * 2 + drop * Math.PI) / .035)));
  const samples = [];
  if ([origin?.x, origin?.y, origin?.z].every(Number.isFinite)) for (let index = 0; index <= steps; index++) {
    const progress = from + (to - from) * index / steps, angle = kind === 'stab' ? 0 : (progress * 2 - 1) * profile.arcRadians * reverse;
    // Authored waist-crossing cuts let a level slash contact a real low body.
    // Both collision and ribbon follow this same finite downward blade segment.
    const samplePitch = pitch - drop * Math.sin(Math.PI * progress), sp = Math.sin(samplePitch), cp = Math.cos(samplePitch);
    const forward = [sy * cp, sp, -cy * cp], right = [cy, 0, sy], up = [-sy * sp, cp, cy * sp];
    const side = right.map((value, axis) => value * Math.cos(tilt) + up[axis] * Math.sin(tilt));
    const direction = point(...forward.map((value, axis) => value * Math.cos(angle) + side[axis] * Math.sin(angle)));
    const at = distance => point(origin.x + direction.x * distance, origin.y + direction.y * distance, origin.z + direction.z * distance);
    samples.push({ progress, inner: at(innerLength), outer: at(outerLength), direction });
  }
  return { kind, origin: { ...origin }, from, to, reach: profile.reach, radius, samples };
}

/** Exact closest contact of a finite segment with a box, without enlarging it. */
export function meleeSegmentBoxContact(a, b, box) {
  if (![a?.x, a?.y, a?.z, b?.x, b?.y, b?.z, box?.x, box?.y, box?.z, box?.w, box?.h, box?.d].every(Number.isFinite) || box.w <= 0 || box.h <= 0 || box.d <= 0) return null;
  const axes = [['x', 'w'], ['y', 'h'], ['z', 'd']], delta = point(b.x - a.x, b.y - a.y, b.z - a.z), cuts = [0, 1];
  for (const [axis, size] of axes) if (Math.abs(delta[axis]) > 1e-10) for (const edge of [box[axis], box[axis] + box[size]]) {
    const t = (edge - a[axis]) / delta[axis]; if (t > 0 && t < 1) cuts.push(t);
  }
  cuts.sort((x, y) => x - y);
  let nearest = null;
  const evaluate = t => {
    const blade = point(a.x + delta.x * t, a.y + delta.y * t, a.z + delta.z * t), flesh = point(clamp(blade.x, box.x, box.x + box.w), clamp(blade.y, box.y, box.y + box.h), clamp(blade.z, box.z, box.z + box.d));
    const distance = Math.hypot(blade.x - flesh.x, blade.y - flesh.y, blade.z - flesh.z);
    if (!nearest || distance < nearest.distance) nearest = { distance, flesh, blade, t, kind: box.kind || 'body' };
  };
  for (let index = 0; index < cuts.length - 1; index++) {
    const low = cuts[index], high = cuts[index + 1], middle = (low + high) / 2; let numerator = 0, denominator = 0;
    for (const [axis, size] of axes) {
      const value = a[axis] + delta[axis] * middle;
      if (value < box[axis] || value > box[axis] + box[size]) {
        const edge = value < box[axis] ? box[axis] : box[axis] + box[size];
        numerator += delta[axis] * (a[axis] - edge); denominator += delta[axis] ** 2;
      }
    }
    evaluate(low); evaluate(high);
    if (denominator > 1e-12) evaluate(clamp(-numerator / denominator, low, high));
  }
  return nearest;
}
