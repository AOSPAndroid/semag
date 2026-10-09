/** Trusted monster silhouettes and locomotion, shared by authority and rendering. */
const box = (kind, x, y, z, w, h, d) => Object.freeze({ kind, x, y, z, w, h, d });
const houndBoxes = Object.freeze([
  box('head', -.16, .50, -.46, .32, .30, .28),
  box('body', -.19, .29, -.20, .38, .35, .54),
  ...[-.13, .13].flatMap(x => [-.19, .21].map(z => box('leg', x - .06, 0, z - .09, .12, .32, .18))),
]);

export const MONSTER_BODIES = Object.freeze({
  hound: Object.freeze({ id: 'hound', height: .80, radius: .50, eyeHeight: .66, eyeForward: .32, attackHeight: .60, attackForward: .43, speed: 6.8, jumpSpeed: 6.4, crouch: false, boxes: houndBoxes }),
});
const movement = Object.freeze({ hound: 6.8, leaper: 5.5, screecher: 3.8 });
const types = new Set(['stalker', 'runner', 'brute', 'gunner', 'sniper', ...Object.keys(movement)]);
const trustedType = player => player?.monster === true && player.human !== true && typeof player.monsterType === 'string' && types.has(player.monsterType) ? player.monsterType : null;
const timed = (value, maximum) => Number.isInteger(value) && value > 0 && value <= maximum;
const leaping = player => trustedType(player) === 'leaper' && player.monsterState === 'leap' && timed(player.lungeTicks, 30);

/** Recognized authority-owned type, including humanoids using the default body. */
export function monsterTypeId(player) { return trustedType(player); }
/** Input commands cannot supply a body. Only an authoritative, recognized actor can. */
export function monsterBodyProfile(player) { const type = trustedType(player); return type && Object.hasOwn(MONSTER_BODIES, type) ? MONSTER_BODIES[type] : null; }
/** Immutable local boxes face negative Z; tracing rotates the ray, never inflates them. */
export function monsterBodyBoxes(player) { return monsterBodyProfile(player)?.boxes || null; }
export function monsterAttackHeight(player) { return monsterBodyProfile(player)?.attackHeight ?? null; }
function headOrigin(player, height, forward) {
  if (![player?.x, player?.y, player?.z].every(Number.isFinite)) return null;
  const yaw = Number.isFinite(player.yaw) ? player.yaw : 0;
  return { x: player.x + Math.sin(yaw) * forward, y: player.y + height, z: player.z - Math.cos(yaw) * forward };
}
export function monsterEyeOrigin(player) { const body = monsterBodyProfile(player); return body ? headOrigin(player, body.eyeHeight, body.eyeForward) : null; }
export function monsterAttackOrigin(player) { const body = monsterBodyProfile(player); return body ? headOrigin(player, body.attackHeight, body.attackForward) : null; }
/** Real box centers for cover-tested area damage; these never create human samples. */
export function monsterBodySamplePoints(player) {
  const boxes = monsterBodyBoxes(player);
  if (!boxes || ![player.x, player.y, player.z].every(Number.isFinite)) return null;
  const yaw = Number.isFinite(player.yaw) ? player.yaw : 0, c = Math.cos(yaw), s = Math.sin(yaw);
  return boxes.map(box => {
    const x = box.x + box.w / 2, z = box.z + box.d / 2;
    return { kind: box.kind, x: player.x + c * x - s * z, y: player.y + box.y + box.h / 2, z: player.z + s * x + c * z };
  });
}

/** Closest real flesh point, so low melee contacts never aim between four legs. */
export function monsterClosestPoint(player, point) {
  const boxes = monsterBodyBoxes(player);
  if (!boxes || ![point?.x, point?.y, point?.z, player.x, player.y, player.z].every(Number.isFinite)) return null;
  const yaw = Number.isFinite(player.yaw) ? player.yaw : 0, c = Math.cos(yaw), s = Math.sin(yaw), dx = point.x - player.x, dz = point.z - player.z;
  const local = { x: c * dx + s * dz, y: point.y - player.y, z: -s * dx + c * dz };
  let nearest = null;
  for (const box of boxes) {
    const x = Math.max(box.x, Math.min(box.x + box.w, local.x)), y = Math.max(box.y, Math.min(box.y + box.h, local.y)), z = Math.max(box.z, Math.min(box.z + box.d, local.z));
    const distance = Math.hypot(x - local.x, y - local.y, z - local.z);
    if (!nearest || distance < nearest.distance) nearest = { x: player.x + c * x - s * z, y: player.y + y, z: player.z + s * x + c * z, distance, kind: box.kind };
  }
  return nearest;
}

/** A missing override leaves every existing species' weapon/walk movement intact. */
export function monsterMovementSpeed(player) {
  const type = trustedType(player);
  return leaping(player) ? 9 : type && Object.hasOwn(movement, type) ? movement[type] : null;
}
export function monsterMovementMultiplier(player) {
  return trustedType(player) && !leaping(player) && timed(player.monsterRallyTicks, 180) ? 1.18 : 1;
}
