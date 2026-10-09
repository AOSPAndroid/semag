/** Shared melee handling for the authoritative simulation and its presentation. */
import { monsterAttackOrigin } from './voxel-monster-bodies.js';
// Preserve the Breach sword profile while Royale's starter knife trades reach
// and damage for quicker recovery. Distances are metres; durations are 120 Hz ticks.
export const MELEE = Object.freeze({ id: 'sword', name: 'Breach Sword', label: 'SWORD', startupTicks: 18, activeTicks: 12, recoveryTicks: 42, damage: 55, reach: 2.15, arcRadians: .64, speed: 5.85, slashRadius: .22, slashTilt: -.16, pushSpeed: 7.2, description: 'A balanced committed slash. Moderate reach and recovery leave room to reposition.' });
export const KNIFE = Object.freeze({ id: 'knife', name: 'Survivor Knife', label: 'KNIFE', startupTicks: 10, activeTicks: 8, recoveryTicks: 26, damage: 28, reach: 1.3, arcRadians: .64, speed: 6.1, slashRadius: .14, slashTilt: 0, pushSpeed: 2.2, description: 'A small, quick starter blade. Close the gap and commit each strike carefully.' });

/** Every blade contacts once per committed swing; paired tonfas alternate hands. */
export const MELEE_WEAPONS = Object.freeze({
  knife: KNIFE,
  sword: MELEE,
  katana: Object.freeze({ id: 'katana', name: 'Raven Katana', label: 'KATANA', startupTicks: 12, activeTicks: 10, recoveryTicks: 32, damage: 48, reach: 2.45, arcRadians: .42, speed: 6, slashRadius: .18, slashTilt: -.12, pushSpeed: 6, description: 'A quick, precise long cut. Commit your direction and punish a close approach.' }),
  axe: Object.freeze({ id: 'axe', name: 'Bulwark Axe', label: 'AXE', startupTicks: 28, activeTicks: 12, recoveryTicks: 58, damage: 88, reach: 2.05, arcRadians: .72, speed: 5.1, slashRadius: .26, slashTilt: -.72, pushSpeed: 10, description: 'A heavy committed chop. High impact trades wind-up, recovery and movement speed.' }),
  tonfas: Object.freeze({ id: 'tonfas', name: 'Twin Tonfas', label: 'DUAL TONFAS', startupTicks: 7, activeTicks: 7, recoveryTicks: 18, damage: 24, reach: 1.45, arcRadians: .58, speed: 6.15, dualWield: true, slashRadius: .20, slashTilt: -.20, pushSpeed: 3.3, description: 'Alternate short, fast strikes with both hands. Close distance carefully; each press is one blow.' }),
});
export const MELEE_IDS = Object.freeze(Object.keys(MELEE_WEAPONS));
export const MELEE_WEAPON_IDS = MELEE_IDS;
export const meleeWeaponId = playerOrId => {
  const id = typeof playerOrId === 'string' ? playerOrId : playerOrId?.meleeWeapon;
  return typeof id === 'string' && Object.hasOwn(MELEE_WEAPONS, id) ? id : 'sword';
};
export const meleeProfile = playerOrId => MELEE_WEAPONS[meleeWeaponId(playerOrId)];
export const meleeLabel = playerOrId => meleeProfile(playerOrId).label;
export const meleeHand = (playerOrId, swingIndex = 1) => meleeProfile(playerOrId).dualWield && Math.max(1, Math.floor(Number.isFinite(swingIndex) ? swingIndex : 1)) % 2 === 0 ? 1 : 0;

const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const point = (x, y, z) => ({ x, y, z });

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
  const sy = Math.sin(yaw), cy = Math.cos(yaw), sp = Math.sin(pitch), cp = Math.cos(pitch), tilt = profile.slashTilt;
  const forward = [sy * cp, sp, -cy * cp], right = [cy, 0, sy], up = [-sy * sp, cp, cy * sp];
  const side = right.map((value, index) => value * Math.cos(tilt) + up[index] * Math.sin(tilt));
  const reverse = profile.dualWield && player?.meleeHand === 1 ? -1 : 1;
  const steps = kind === 'stab' ? 1 : Math.min(48, Math.max(1, Math.ceil((to - from) * profile.arcRadians * 2 / .035)));
  const samples = [];
  if ([origin?.x, origin?.y, origin?.z].every(Number.isFinite)) for (let index = 0; index <= steps; index++) {
    const progress = from + (to - from) * index / steps, angle = kind === 'stab' ? 0 : (progress * 2 - 1) * profile.arcRadians * reverse;
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
