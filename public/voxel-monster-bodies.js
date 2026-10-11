/** Trusted monster silhouettes and locomotion, shared by authority and rendering. */
const box = (kind, x, y, z, w, h, d) => Object.freeze({ kind, x, y, z, w, h, d });
const houndBoxes = Object.freeze([
  box('head', -.16, .50, -.46, .32, .30, .28),
  box('body', -.19, .29, -.20, .38, .35, .54),
  ...[-.13, .13].flatMap(x => [-.19, .21].map(z => box('leg', x - .06, 0, z - .09, .12, .32, .18))),
]);
const paws = (x, frontZ, rearZ, width, height, depth) => [-x, x].flatMap(side => [frontZ, rearZ]
  .map(z => box('leg', side - width / 2, 0, z - depth / 2, width, height, depth)));
const wolfBoxes = Object.freeze([
  box('head', -.17, .56, -.47, .34, .42, .30), box('body', -.22, .31, -.19, .44, .38, .54),
  ...paws(.16, -.19, .21, .14, .34, .20),
]);
const pigBoxes = Object.freeze([
  box('head', -.20, .33, -.50, .40, .51, .32), box('body', -.255, .24, -.22, .51, .48, .62),
  ...paws(.18, -.16, .27, .15, .29, .21),
]);
const ratBoxes = Object.freeze([
  box('head', -.075, .16, -.22, .15, .20, .17), box('body', -.09, .105, -.085, .18, .125, .24),
  box('body', -.022, .09, .145, .044, .05, .09), ...paws(.065, -.07, .105, .055, .12, .075),
]);
const stagBoxes = Object.freeze([
  box('head', -.17, .83, -.45, .34, .45, .29),
  // Antlers have real branches and gaps. A large bounding cube would reward
  // headshots through the empty space between them. Ten millimetres of lower
  // clearance contain the accepted attack's small cosmetic head load.
  ...[
    [-.11, 1.236, -.273, .052, .217, .06], [.058, 1.236, -.273, .052, .217, .06],
    [-.19, 1.412, -.263, .112, .043, .057], [.078, 1.412, -.263, .112, .043, .057],
    [-.202, 1.448, -.259, .05, .171, .052], [.152, 1.448, -.259, .05, .171, .052],
    [-.278, 1.537, -.25, .117, .039, .046], [.161, 1.537, -.25, .117, .039, .046],
    [-.278, 1.576, -.249, .043, .072, .044], [.235, 1.576, -.249, .043, .072, .044],
    [-.174, 1.482, -.315, .043, .073, .094], [.131, 1.482, -.315, .043, .073, .094],
  ].map(([x, y, z, w, h, d]) => box('head', x, y - .010, z, w, h + .010, d)),
  box('body', -.23, .64, -.22, .46, .42, .61), box('body', -.15, .81, -.21, .30, .45, .20),
  ...paws(.17, -.20, .24, .125, .70, .18),
]);

export const MONSTER_QUADRUPED_IDS = Object.freeze(['hound', 'wolf', 'pig', 'rat', 'stag']);

export const MONSTER_BODIES = Object.freeze({
  hound: Object.freeze({ id: 'hound', height: .80, radius: .50, eyeHeight: .66, eyeForward: .32, attackHeight: .60, attackForward: .43, speed: 6.8, jumpSpeed: 6.4, crouch: false, boxes: houndBoxes }),
  wolf: Object.freeze({ id: 'wolf', height: .98, radius: .52, eyeHeight: .76, eyeForward: .34, attackHeight: .66, attackForward: .44, speed: 7.0, jumpSpeed: 6.4, crouch: false, boxes: wolfBoxes }),
  pig: Object.freeze({ id: 'pig', height: .84, radius: .56, eyeHeight: .60, eyeForward: .36, attackHeight: .48, attackForward: .48, speed: 4.0, jumpSpeed: 5.8, crouch: false, boxes: pigBoxes }),
  rat: Object.freeze({ id: 'rat', height: .36, radius: .25, eyeHeight: .255, eyeForward: .17, attackHeight: .18, attackForward: .21, speed: 7.2, jumpSpeed: 5.2, crouch: false, boxes: ratBoxes }),
  stag: Object.freeze({ id: 'stag', height: 1.65, radius: .63, eyeHeight: 1.12, eyeForward: .31, attackHeight: 1.00, attackForward: .44, speed: 4.4, jumpSpeed: 6.4, crouch: false, boxes: stagBoxes }),
});
const movement = Object.freeze({ hound: 6.8, leaper: 5.5, screecher: 3.8, bomber: 5.8, spitter: 3.6, weaver: 3.1, vampire: 5.2, witch: 3.0, wolf: 7.0, pig: 4.0, rat: 7.2, stag: 4.4 });
const types = new Set(['stalker', 'runner', 'brute', 'gunner', 'sniper', ...Object.keys(movement)]);
const trustedType = player => player?.monster === true && player.human !== true && typeof player.monsterType === 'string' && types.has(player.monsterType) ? player.monsterType : null;
const timed = (value, maximum) => Number.isInteger(value) && value > 0 && value <= maximum;
const LUNGES = Object.freeze({ leaper: Object.freeze({ ticks: 30, speed: 9 }), vampire: Object.freeze({ ticks: 24, speed: 10.5 }), pig: Object.freeze({ ticks: 42, speed: 9.2 }) });
const lungeProfile = player => {
  const type = trustedType(player), profile = type && Object.hasOwn(LUNGES, type) ? LUNGES[type] : null;
  return profile && player.monsterState === 'leap' && timed(player.lungeTicks, profile.ticks) ? profile : null;
};

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
  return lungeProfile(player)?.speed ?? (type && Object.hasOwn(movement, type) ? movement[type] : null);
}
export function monsterMovementMultiplier(player) {
  return trustedType(player) && !lungeProfile(player) && timed(player.monsterRallyTicks, 180) ? 1.18 : 1;
}
