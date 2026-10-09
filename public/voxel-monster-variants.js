/** Authored unarmed Horde anatomy. Living actors and cached corpses share these cuboids. */
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const finite = value => Number.isFinite(value) ? value : 0;
const EMPTY_OPTIONS = Object.freeze({});

export const MONSTER_VARIANT_ART = Object.freeze({
  bomber: Object.freeze({ skin: '#8e4936', shadow: '#382c29', armor: '#593527', head: '#a56348', eye: '#f5ad64', width: .52,
    seam: '#f18142', charge: '#ffd68a', bone: '#c9ad87', state: 'bomberFuse' }),
  spitter: Object.freeze({ skin: '#647e69', shadow: '#273d3a', armor: '#3c5750', head: '#849c72', eye: '#8eead0', width: .34,
    seam: '#4fc3ad', charge: '#c0fff0', bone: '#cad7a6', state: 'spitting' }),
  weaver: Object.freeze({ skin: '#63546e', shadow: '#262334', armor: '#493454', head: '#837082', eye: '#ccadf8', width: .38,
    seam: '#9c6ed5', charge: '#ecddff', bone: '#c3b8b0', state: 'weaving' }),
});
export const MONSTER_VARIANT_IDS = Object.freeze(Object.keys(MONSTER_VARIANT_ART));

// x/y/z, width/height/depth, palette key, optional articulation. All parts fit
// authority's ordinary .58-wide torso/legs and .44-wide head shooting boxes,
// including continuous yaw: every corner fits their inscribed circle.
// Cached string colours also reuse the renderer's existing shaded-face cache.
const parts = entries => Object.freeze(entries.map(entry => Object.freeze(entry)));
const BOMBER_PARTS = parts([
  [-.235, .008, -.135, .17, .11, .27, 'shadow', 'leftFoot'],
  [.065, .008, -.135, .17, .11, .27, 'shadow', 'rightFoot'],
  [-.205, .115, -.092, .125, .43, .184, 'skin', 'leftLeg'],
  [.080, .115, -.092, .125, .43, .184, 'skin', 'rightLeg'],
  [-.226, .34, -.118, .15, .095, .027, 'armor', 'leftLeg'],
  [.076, .34, -.118, .15, .095, .027, 'armor', 'rightLeg'],
  [-.214, .57, -.119, .428, .49, .238, 'skin', 'belly'],
  [-.23, .74, -.125, .46, .42, .25, 'skin', 'belly'],
  [-.221, 1.06, -.168, .442, .30, .336, 'head'],
  [-.25, 1.235, -.13, .13, .18, .26, 'armor'],
  [.12, 1.235, -.13, .13, .18, .26, 'armor'],
  [-.27, .88, -.095, .055, .345, .15, 'skin', 'leftArm'],
  [.215, .88, -.095, .055, .345, .15, 'skin', 'rightArm'],
  [-.27, .83, -.10, .055, .105, .16, 'shadow', 'leftArm'],
  [.215, .83, -.10, .055, .105, .16, 'shadow', 'rightArm'],
  [-.15, 1.375, -.09, .30, .10, .18, 'shadow'],
  [-.169, 1.48, -.137, .338, .25, .274, 'head'],
  [-.146, 1.73, -.12, .292, .069, .24, 'armor'],
  [-.144, 1.514, -.153, .288, .060, .016, 'shadow'],
  [-.096, 1.529, -.170, .047, .022, .016, 'bone'],
  [.049, 1.529, -.170, .047, .022, .016, 'bone'],
  [-.11, 1.638, -.157, .075, .026, .018, 'eye'],
  [.035, 1.638, -.157, .075, .026, .018, 'eye'],
  [-.095, .87, -.148, .19, .15, .030, 'shadow', 'belly'],
  [-.068, .894, -.177, .136, .10, .030, 'seam', 'core'],
  [-.198, .665, -.126, .030, .32, .017, 'seam', 'belly'],
  [.168, .665, -.126, .030, .32, .017, 'seam', 'belly'],
  [-.022, 1.027, -.179, .044, .23, .020, 'seam', 'core'],
  [-.041, 1.761, -.035, .082, .038, .07, 'seam', 'core'],
]);
const SPITTER_PARTS = parts([
  [-.222, .008, -.16, .15, .11, .28, 'shadow', 'leftFoot'],
  [.072, .008, -.16, .15, .11, .28, 'shadow', 'rightFoot'],
  [-.192, .118, -.103, .105, .43, .184, 'skin', 'leftLeg'],
  [.087, .118, -.103, .105, .43, .184, 'skin', 'rightLeg'],
  [-.202, .35, -.13, .123, .09, .05, 'armor', 'leftLeg'],
  [.079, .35, -.13, .123, .09, .05, 'armor', 'rightLeg'],
  [-.17, .59, -.142, .34, .60, .29, 'skin'],
  [-.21, 1.15, -.17, .42, .23, .30, 'armor'],
  [-.131, .8, .147, .262, .44, .083, 'armor'],
  [-.117, 1.37, -.095, .234, .10, .20, 'shadow'],
  [-.264, .855, -.097, .065, .40, .15, 'skin', 'leftArm'],
  [.199, .855, -.097, .065, .40, .15, 'skin', 'rightArm'],
  [-.258, .785, -.115, .061, .12, .13, 'shadow', 'leftArm'],
  [.197, .785, -.115, .061, .12, .13, 'shadow', 'rightArm'],
  [-.16, 1.48, -.129, .32, .275, .248, 'head'],
  [-.15, 1.755, -.129, .30, .044, .24, 'armor'],
  [-.114, 1.019, -.231, .228, .133, .08, 'shadow', 'jaw'],
  [-.097, 1.157, -.221, .194, .094, .05, 'armor'],
  [-.043, 1.079, -.265, .086, .045, .033, 'seam', 'core'],
  [-.15, 1.015, -.201, .04, .188, .05, 'bone', 'leftMandible'],
  [.11, 1.015, -.201, .04, .188, .05, 'bone', 'rightMandible'],
  [-.15, 1.006, -.221, .069, .029, .03, 'bone', 'leftMandible'],
  [.081, 1.006, -.221, .069, .029, .03, 'bone', 'rightMandible'],
  [-.125, 1.665, -.135, .071, .045, .025, 'shadow'],
  [.054, 1.665, -.135, .071, .045, .025, 'shadow'],
  [-.109, 1.679, -.160, .045, .022, .025, 'eye'],
  [.064, 1.679, -.160, .045, .022, .025, 'eye'],
  [-.127, .83, -.163, .254, .031, .024, 'armor'],
  [-.103, .931, -.162, .206, .030, .024, 'armor'],
  [-.079, 1.032, -.162, .158, .030, .024, 'armor'],
  [-.030, 1.124, -.172, .060, .09, .025, 'seam', 'core'],
]);
const WEAVER_PARTS = parts([
  [-.203, .009, -.122, .15, .10, .245, 'shadow', 'leftFoot'],
  [.053, .009, -.122, .15, .10, .245, 'shadow', 'rightFoot'],
  [-.18, .12, -.082, .106, .43, .164, 'shadow', 'leftLeg'],
  [.074, .12, -.082, .106, .43, .164, 'shadow', 'rightLeg'],
  [-.21, .34, -.165, .42, .418, .30, 'armor'],
  [-.195, .746, -.152, .39, .53, .312, 'skin'],
  [-.234, 1.26, -.13, .468, .155, .28, 'armor'],
  [-.21, .48, .12, .42, .88, .045, 'armor'],
  [-.15, 1.399, -.098, .30, .072, .196, 'shadow'],
  [-.17, 1.48, -.135, .34, .319, .27, 'armor'],
  [-.125, 1.505, -.146, .25, .206, .025, 'shadow'],
  [-.070, 1.541, -.172, .14, .131, .026, 'head'],
  [-.08, 1.617, -.183, .052, .018, .010, 'eye'],
  [.028, 1.617, -.183, .052, .018, .010, 'eye'],
  [-.022, 1.57, -.184, .044, .028, .012, 'seam'],
  [-.185, 1.70, -.104, .055, .099, .069, 'bone'],
  [.13, 1.70, -.104, .055, .099, .069, 'bone'],
  [-.267, .916, -.086, .065, .352, .15, 'armor', 'leftArm'],
  [.202, .916, -.086, .065, .352, .15, 'armor', 'rightArm'],
  [-.213, .852, -.11, .055, .091, .14, 'head', 'leftHand'],
  [.158, .852, -.11, .055, .091, .14, 'head', 'rightHand'],
  [-.205, .867, -.131, .040, .051, .022, 'seam', 'leftRune'],
  [.165, .867, -.131, .040, .051, .022, 'seam', 'rightRune'],
  [-.095, .80, -.17, .030, .40, .024, 'bone'],
  [.065, .80, -.17, .030, .40, .024, 'bone'],
  [-.12, 1.209, -.171, .24, .045, .024, 'bone'],
  [-.06, 1.145, -.171, .12, .064, .024, 'seam', 'core'],
  [-.032, .907, -.171, .064, .083, .024, 'seam', 'core'],
  [-.152, .573, -.2, .027, .16, .024, 'seam'],
  [.125, .573, -.2, .027, .16, .024, 'seam'],
]);
const VARIANT_PARTS = Object.freeze({ bomber: BOMBER_PARTS, spitter: SPITTER_PARTS, weaver: WEAVER_PARTS });

/**
 * Append directly to the renderer's reusable mesh, without temporary part arrays,
 * closures, particles or renderer imports. False leaves the mesh unchanged.
 */
export function appendMonsterVariant(mesh, player, pose, options = EMPTY_OPTIONS) {
  const type = player?.monsterType;
  if (player?.monster !== true || player.human === true || typeof type !== 'string' || !Object.hasOwn(VARIANT_PARTS, type)
      || typeof mesh?.box !== 'function' || !Number.isFinite(pose?.x) || !Number.isFinite(pose?.y) || !Number.isFinite(pose?.z)
      || !Number.isFinite(pose?.yaw)) return false;
  const art = MONSTER_VARIANT_ART[type], entries = VARIANT_PARTS[type];
  const alive = player.alive !== false, animation = options.animation;
  const stride = alive ? clamp(finite(animation?.stride), 0, 1) : 0, phase = finite(animation?.phase);
  const charge = alive && player.monsterState === art.state && Number.isFinite(player.attackTicks) && Number.isFinite(player.attackDuration) && player.attackDuration > 0
    ? clamp(1 - player.attackTicks / player.attackDuration, 0, 1) : 0;
  // The pulse follows the accepted attack timer, so pausing freezes every seam.
  const bright = charge > .12 && (charge > .84 || Math.sin(charge * Math.PI * (type === 'bomber' ? 10 : 6)) > -.18);
  const walk = Math.sin(phase) * stride * (type === 'spitter' ? .022 : .018);
  const lift = Math.max(0, Math.cos(phase)) * stride * .025;
  for (let index = 0; index < entries.length; index++) {
    const part = entries[index], tag = part[7];
    let x = part[0], y = part[1], z = part[2], w = part[3], h = part[4], d = part[5], color = art[part[6]];
    if (tag === 'leftLeg' || tag === 'leftFoot') { z += walk; if (tag === 'leftFoot') y += lift; }
    else if (tag === 'rightLeg' || tag === 'rightFoot') { z -= walk; if (tag === 'rightFoot') y += stride * .025 - lift; }
    if (type === 'bomber') {
      if (tag === 'belly') { const swelling = charge * .018; x -= swelling; w += swelling * 2; z -= swelling; d += swelling * 2; }
      else if (tag === 'leftArm' || tag === 'rightArm') y += charge * .09;
    } else if (type === 'spitter') {
      if (tag === 'jaw') { y -= charge * .003; h += charge * .022; }
      else if (tag === 'leftMandible') { x -= charge * .012; z -= charge * .008; }
      else if (tag === 'rightMandible') { x += charge * .012; z -= charge * .008; }
      else if (tag === 'leftArm' || tag === 'rightArm') y += charge * .11;
    } else if (tag === 'leftArm' || tag === 'rightArm') y += charge * .12;
    else if (tag === 'leftHand' || tag === 'rightHand' || tag === 'leftRune' || tag === 'rightRune') { y += charge * .32; z -= charge * .06; }
    if (part[6] === 'eye') color = alive ? bright ? art.charge : art.eye : art.shadow;
    else if (tag === 'core' || tag === 'leftRune' || tag === 'rightRune') color = alive ? bright ? art.charge : art.seam : art.shadow;
    mesh.box(x, y, z, w, h, d, color, pose);
  }
  return true;
}
