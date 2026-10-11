/** Authored unarmed Horde anatomy. Living actors and cached corpses share these cuboids. */
import { monsterLocomotionPose, appendMonsterLimb } from './voxel-monster-animation.js';
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
  const motion = options.motion || monsterLocomotionPose(player, animation);
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
    if (motion.active) {
      const left = typeof tag === 'string' && tag.startsWith('left'), joint = left ? 0 : 1;
      if (tag === 'leftLeg' || tag === 'rightLeg') {
        const leg = motion.legs[joint];
        if (part[4] > .3) {
          appendMonsterLimb(mesh, pose, leg.hip, leg.knee, part[3], Math.min(.130, part[5]), color);
          appendMonsterLimb(mesh, pose, leg.knee, leg.ankle, part[3] * .88, Math.min(.112, part[5]), color);
        } else mesh.box(leg.knee[0] - w / 2, leg.knee[1] - h / 2, leg.knee[2] - .076, w, h, d, color, pose);
        continue;
      }
      if (tag === 'leftFoot' || tag === 'rightFoot') {
        const foot = motion.legs[joint].foot, width = w - motion.stride * .025, depth = d - motion.stride * .105;
        mesh.box(foot[0] - width / 2, foot[1], foot[2] - depth / 2, width, h, depth, color, pose);
        continue;
      }
      if (tag === 'leftArm' || tag === 'rightArm') {
        const arm = motion.arms[joint];
        appendMonsterLimb(mesh, pose, part[4] > .15 ? arm.shoulder : arm.elbow, part[4] > .15 ? arm.elbow : arm.hand, w, .075, color);
        continue;
      }
      if (tag === 'leftHand' || tag === 'rightHand') {
        const arm = motion.arms[joint];
        appendMonsterLimb(mesh, pose, arm.elbow, arm.hand, w, .068, color);
        continue;
      }
      if (tag === 'leftRune' || tag === 'rightRune') {
        const hand = motion.arms[joint].hand;
        mesh.box(hand[0] - w / 2, hand[1] - .023, hand[2] - .045, w, h, d, color, pose);
        continue;
      }
      if (y >= .57 && y + h < 1.38) y += motion.bodyBob;
    }
    if ((tag === 'leftLeg' || tag === 'rightLeg') && part[4] > .3) {
      // Keep the same two cuboids while stopped and in cached corpses. Their
      // union is the original shin; starting a run cannot pop in extra parts.
      mesh.box(x, y + h / 2, z, w, h / 2, d, color, pose);
      mesh.box(x, y, z, w, h / 2, d, color, pose);
      continue;
    }
    mesh.box(x, y, z, w, h, d, color, pose);
  }
  return true;
}

/** Original fantasy/animal anatomy. Old special-ghoul exports keep their contract. */
export const MONSTER_BESTIARY_ART = Object.freeze({
  vampire: Object.freeze({ skin: '#eee0d0', shadow: '#24202e', armor: '#3d2735', head: '#eee0d0', eye: '#f1839d', width: .34, cloth: '#171b27', lining: '#9e344e', bone: '#fff4dc', charge: '#ffd0df' }),
  witch: Object.freeze({ skin: '#a7c397', shadow: '#292337', armor: '#4d355c', head: '#a7c397', eye: '#c4f4a4', width: .32, cloth: '#35243f', lining: '#8c62a2', bone: '#ad976c', charge: '#dbffd0' }),
  wolf: Object.freeze({ skin: '#7b8994', shadow: '#293540', armor: '#566472', head: '#95a4ae', eye: '#f2c278', width: .44, lining: '#827b82', fur: '#c0c8c9', bone: '#e5d7bf', charge: '#ffe6a8', quadruped: true }),
  pig: Object.freeze({ skin: '#b88081', shadow: '#513c43', armor: '#805958', head: '#d69c93', eye: '#f0c790', width: .51, lining: '#ba7379', fur: '#ca9c91', bone: '#e9dac5', charge: '#ffe4bb', quadruped: true }),
  rat: Object.freeze({ skin: '#786f67', shadow: '#342f31', armor: '#51494a', head: '#92867b', eye: '#efac7e', width: .18, fur: '#b5a694', bone: '#dacdbd', tail: '#c28a87', charge: '#ffd2a5', quadruped: true }),
  stag: Object.freeze({ skin: '#926443', shadow: '#382f29', armor: '#5d4534', head: '#a97851', eye: '#dac78d', width: .46, fur: '#d8c7a0', bone: '#c4ac7f', charge: '#f4dfaa', quadruped: true }),
});
export const MONSTER_BESTIARY_IDS = Object.freeze(Object.keys(MONSTER_BESTIARY_ART));

// Landmarks are genuinely different cuboids, not colour swaps. Animal flesh
// stays in the corresponding trusted body boxes, including real rat tail and
// stag antler anatomy. Gait limbs attach below in one existing world batch.
const BESTIARY_PARTS = Object.freeze({
  vampire: parts([
    [-.17,.78,-.13,.34,.59,.26,'cloth','torso'],[-.135,1.36,-.09,.27,.12,.18,'lining','torso'],
    [-.166,.40,.14,.332,.92,.043,'cloth','cape'],[-.143,.42,.179,.286,.87,.013,'lining','cape'],
    [-.164,.39,.156,.044,.29,.048,'cloth','cape'],[.12,.39,.156,.044,.29,.048,'cloth','cape'],
    [-.174,1.37,-.025,.082,.23,.093,'lining'],[.092,1.37,-.025,.082,.23,.093,'lining'],
    [-.133,1.48,-.115,.266,.258,.23,'head'],[-.138,1.725,-.12,.276,.075,.235,'shadow'],
    [-.138,1.636,-.119,.038,.11,.235,'shadow'],[.100,1.636,-.119,.038,.11,.235,'shadow'],
    [-.110,1.654,-.126,.067,.028,.014,'shadow'],[.043,1.654,-.126,.067,.028,.014,'shadow'],
    [-.096,1.642,-.135,.040,.019,.011,'eye'],[.056,1.642,-.135,.040,.019,.011,'eye'],
    [-.019,1.576,-.136,.038,.042,.025,'skin'],[-.065,1.548,-.132,.13,.014,.013,'lining'],
    [-.050,1.531,-.137,.020,.037,.018,'bone'],[.030,1.531,-.137,.020,.037,.018,'bone'],
    [-.037,1.287,-.145,.074,.055,.022,'lining','torso'],[-.014,1.159,-.144,.028,.025,.018,'bone','torso'],
    [-.014,1.073,-.144,.028,.025,.018,'bone','torso'],[-.105,.84,-.144,.21,.02,.018,'lining','torso'],
  ]),
  witch: parts([
    [-.165,.58,-.135,.33,.78,.27,'cloth','torso'],[-.197,.31,-.143,.394,.29,.286,'cloth','robe'],
    [-.17,.325,-.151,.34,.06,.016,'lining','robe'],[-.174,.535,-.146,.348,.023,.018,'lining','robe'],
    [-.055,.61,-.153,.11,.66,.022,'armor','torso'],[-.109,1.268,-.138,.218,.053,.021,'lining','torso'],
    [-.121,1.47,-.108,.242,.196,.216,'head'],[-.138,1.474,.079,.276,.19,.026,'shadow'],
    [-.108,1.591,-.117,.070,.026,.014,'shadow'],[.038,1.591,-.117,.070,.026,.014,'shadow'],
    [-.093,1.582,-.128,.043,.018,.014,'eye'],[.050,1.582,-.128,.043,.018,.014,'eye'],
    [-.024,1.513,-.145,.048,.061,.047,'head'],[-.073,1.492,-.126,.146,.014,.019,'shadow'],
    [-.158,1.646,-.129,.316,.034,.258,'cloth'],[-.122,1.68,-.096,.244,.045,.192,'lining'],
    [-.085,1.721,-.074,.170,.038,.148,'cloth'],[-.050,1.759,-.052,.10,.027,.104,'cloth'],
    [-.023,1.786,-.032,.046,.014,.064,'cloth'],[-.019,1.685,-.105,.038,.034,.016,'bone'],
    [-.034,.728,-.158,.068,.031,.02,'bone','torso'],
  ]),
  wolf: parts([
    [-.207,.335,-.177,.414,.326,.512,'skin','torso'],[-.189,.50,-.185,.378,.174,.26,'armor','torso'],
    [-.211,.46,-.184,.422,.11,.067,'fur','torso'],[-.192,.573,-.185,.384,.11,.075,'fur','torso'],
    [-.150,.584,-.361,.30,.205,.184,'head'],[-.116,.565,-.454,.232,.126,.156,'head'],
    [-.110,.60,-.47,.220,.071,.037,'shadow'],[-.104,.575,-.435,.208,.019,.048,'bone'],
    [-.146,.785,-.307,.106,.184,.107,'armor'],[.040,.785,-.307,.106,.184,.107,'armor'],
    [-.120,.816,-.309,.055,.111,.012,'lining'],[.066,.816,-.309,.055,.111,.012,'lining'],
    [-.163,.733,-.37,.063,.043,.016,'shadow'],[.100,.733,-.37,.063,.043,.016,'shadow'],
    [-.152,.744,-.381,.041,.021,.014,'eye'],[.111,.744,-.381,.041,.021,.014,'eye'],
    [-.040,.643,-.470,.080,.031,.014,'shadow'],[-.148,.350,.222,.093,.107,.092,'armor','torso'],
    [.055,.350,.222,.093,.107,.092,'armor','torso'],[-.058,.431,.283,.116,.178,.060,'armor','tail'],
    [-.046,.563,.244,.092,.115,.083,'fur','tail'],
  ]),
  pig: parts([
    [-.243,.260,-.199,.486,.426,.576,'skin','torso'],[-.231,.488,-.181,.462,.211,.497,'armor','torso'],
    [-.208,.292,.16,.416,.152,.21,'skin','torso'],[-.184,.355,-.418,.368,.283,.228,'head'],
    [-.178,.39,-.477,.356,.137,.103,'head'],[-.154,.406,-.495,.114,.083,.020,'head'],
    [.040,.406,-.495,.114,.083,.020,'head'],[-.117,.431,-.499,.038,.028,.008,'shadow'],
    [.079,.431,-.499,.038,.028,.008,'shadow'],[-.188,.643,-.38,.110,.18,.109,'head'],
    [.078,.643,-.38,.110,.18,.109,'head'],[-.168,.687,-.389,.065,.102,.018,'lining'],
    [.103,.687,-.389,.065,.102,.018,'lining'],[-.178,.572,-.429,.058,.035,.018,'shadow'],
    [.12,.572,-.429,.058,.035,.018,'shadow'],[-.166,.584,-.438,.033,.018,.012,'eye'],
    [.133,.584,-.438,.033,.018,.012,'eye'],[-.157,.377,-.443,.030,.072,.032,'bone'],
    [.127,.377,-.443,.030,.072,.032,'bone'],[-.022,.477,.351,.044,.068,.035,'head','tail'],
    [.010,.53,.349,.040,.040,.038,'head','tail'],[-.027,.553,.348,.052,.033,.037,'head','tail'],
  ]),
  rat: parts([
    [-.082,.114,-.074,.164,.112,.220,'skin','torso'],[-.072,.185,-.061,.144,.040,.172,'armor','torso'],
    [-.066,.18,-.176,.132,.083,.124,'head'],[-.051,.171,-.217,.102,.054,.081,'head'],
    [-.026,.183,-.220,.052,.025,.011,'tail'],[-.070,.265,-.117,.062,.069,.057,'head'],
    [.008,.265,-.117,.062,.069,.057,'head'],[-.058,.278,-.12,.035,.041,.012,'tail'],
    [.020,.278,-.12,.035,.041,.012,'tail'],[-.058,.319,-.111,.04,.036,.045,'head'],
    [.018,.319,-.111,.04,.036,.045,'head'],[-.061,.239,-.184,.031,.016,.014,'shadow'],
    [.03,.239,-.184,.031,.016,.014,'shadow'],[-.054,.242,-.190,.018,.012,.008,'eye'],
    [.036,.242,-.190,.018,.012,.008,'eye'],[-.070,.192,-.214,.050,.004,.009,'bone'],
    [.020,.192,-.214,.05,.004,.009,'bone'],[-.068,.210,-.198,.045,.004,.01,'bone'],
    [.023,.210,-.198,.045,.004,.01,'bone'],[-.014,.1,.146,.028,.026,.042,'tail','tail'],
    [-.007,.096,.18,.025,.024,.034,'tail','tail'],[.002,.105,.208,.016,.018,.024,'tail','tail'],
  ]),
  stag: parts([
    [-.213,.669,-.199,.426,.342,.560,'skin','torso'],[-.205,.939,-.167,.41,.11,.365,'armor','torso'],
    [-.133,.821,-.19,.266,.419,.170,'skin','neck'],[-.099,.85,-.212,.198,.293,.023,'fur','neck'],
    [-.155,.918,-.367,.310,.224,.205,'head'],[-.107,.856,-.442,.214,.125,.174,'head'],
    [-.086,.861,-.45,.172,.069,.056,'shadow'],
    [-.157,1.143,-.286,.113,.102,.078,'head'],[.044,1.143,-.286,.113,.102,.078,'head'],
    [-.156,1.046,-.376,.068,.036,.016,'shadow'],[.088,1.046,-.376,.068,.036,.016,'shadow'],
    [-.144,1.053,-.385,.043,.021,.013,'eye'],[.100,1.053,-.385,.043,.021,.013,'eye'],
    [-.11,1.236,-.273,.052,.217,.06,'bone','antler'],[.058,1.236,-.273,.052,.217,.06,'bone','antler'],
    [-.19,1.412,-.263,.112,.043,.057,'bone','antler'],[.078,1.412,-.263,.112,.043,.057,'bone','antler'],
    [-.202,1.448,-.259,.05,.171,.052,'bone','antler'],[.152,1.448,-.259,.05,.171,.052,'bone','antler'],
    [-.278,1.537,-.25,.117,.039,.046,'bone','antler'],[.161,1.537,-.25,.117,.039,.046,'bone','antler'],
    [-.278,1.576,-.249,.043,.072,.044,'bone','antler'],[.235,1.576,-.249,.043,.072,.044,'bone','antler'],
    [-.174,1.482,-.315,.043,.073,.094,'bone','antler'],[.131,1.482,-.315,.043,.073,.094,'bone','antler'],
    [-.052,.893,.327,.104,.107,.05,'fur','tail'],
  ]),
});

/** Append true species art with distance-driven joints; no extra draw/material path. */
export function appendMonsterBestiary(mesh, player, pose, options = EMPTY_OPTIONS) {
  const type = player?.monsterType;
  if (player?.monster !== true || player.human === true || typeof type !== 'string' || !Object.hasOwn(BESTIARY_PARTS, type) || typeof mesh?.box !== 'function'
      || ![pose?.x,pose?.y,pose?.z,pose?.yaw].every(Number.isFinite)) return false;
  const art = MONSTER_BESTIARY_ART[type], motion = options.motion || monsterLocomotionPose(player, options.animation), alive = player.alive !== false;
  const stride = alive ? clamp(finite(options.animation?.stride),0,1) : 0, phase = finite(options.animation?.phase), attack = motion.attack;
  for (const item of BESTIARY_PARTS[type]) {
    const tag = item[7]; let x=item[0], y=item[1], z=item[2], color=art[item[6]] || art.lining || art.skin;
    if (tag === 'torso' && motion.active) y += motion.bodyBob;
    // Load the real snout/head inside its existing shooting box, then release
    // through the accepted attack recovery. Stationary animals do not idle-bob.
    if (art.quadruped && (!tag || tag === 'antler')) y -= attack.windup * (type === 'pig' ? .018 : type === 'rat' ? .004 : type === 'wolf' ? .003 : .010);
    if (tag === 'cape') { z += Math.sin(phase + item[0] * 4) * stride * .008; y += motion.bodyBob * .6; }
    if (tag === 'tail') { x += Math.sin(phase) * stride * (type === 'rat' ? .001 : .008); }
    if (item[6] === 'eye') color = alive ? attack.windup > .55 || attack.extension > .4 ? art.charge : art.eye : art.shadow;
    mesh.box(x,y,z,item[3],item[4],item[5],color,pose);
  }
  if (art.quadruped) {
    const small = type === 'rat', hoof = type === 'pig' || type === 'stag';
    const upper = small ? .021 : type === 'stag' ? .072 : .076, lower = small ? .018 : type === 'stag' ? .058 : .066;
    const footW = small ? .036 : type === 'stag' ? .076 : .094, footD = small ? .042 : type === 'stag' ? .108 : type === 'wolf' ? .120 : .121, footH = small ? .026 : type === 'stag' ? .078 : .061;
    for (const paw of motion.paws) {
      appendMonsterLimb(mesh,pose,paw.hip,paw.knee,upper,upper,type === 'wolf' ? art.fur : art.skin);
      appendMonsterLimb(mesh,pose,paw.knee,paw.ankle,lower,lower,art.skin);
      mesh.box(paw.foot[0]-footW/2,paw.foot[1],paw.foot[2]-footD/2,footW,footH,footD,hoof ? art.shadow : art.armor,pose);
      if (hoof) mesh.box(paw.foot[0]-.008,paw.foot[1]+.002,paw.foot[2]-footD/2-.001,.016,footH-.004,.008,art.skin,pose);
    }
  } else {
    for (const leg of motion.legs) {
      appendMonsterLimb(mesh,pose,leg.hip,leg.knee,.109,.119,art.cloth);
      appendMonsterLimb(mesh,pose,leg.knee,leg.ankle,.098,.108,art.cloth);
      mesh.box(leg.foot[0]-.058,leg.foot[1],leg.foot[2]-.087,.116,.110,.174,art.shadow,pose);
    }
    for (const [index,arm] of motion.arms.entries()) {
      appendMonsterLimb(mesh,pose,arm.shoulder,arm.elbow,.073,.083,art.cloth);
      appendMonsterLimb(mesh,pose,arm.elbow,arm.hand,.062,.069,art.skin);
      mesh.box(arm.hand[0]-.032,arm.hand[1]-.035,arm.hand[2]-.032,.064,.07,.064,art.skin,pose);
      if (type === 'vampire') for(const claw of [-.021,.014]) mesh.box(arm.hand[0]+claw,arm.hand[1]-.08,arm.hand[2]-.042,.011,.075,.014,art.bone,pose);
      else if (index === 1) {
        // The staff follows its actual grasp through the accepted hex tell.
        const hand = arm.hand, staffPose = { ...pose, x:pose.x+Math.cos(pose.yaw)*hand[0]-Math.sin(pose.yaw)*hand[2], y:pose.y+hand[1], z:pose.z+Math.sin(pose.yaw)*hand[0]+Math.cos(pose.yaw)*hand[2] };
        mesh.box(-.018,-.27,-.028,.036,.60,.04,art.bone,staffPose);
        mesh.box(-.038,.297,-.043,.076,.068,.069,art.armor,staffPose);
        mesh.box(-.022,.351,-.025,.044,.076,.039,alive && attack.weight > .12 ? art.charge : art.eye,staffPose);
      }
    }
  }
  return true;
}
