import { MAPS, ADS, HEAL, WORLD } from './voxel-engine.js';
import { WEAPONS, weaponAimFovRatio } from './voxel-weapons.js';
import { valorantModel, legacyShotgunModel } from './voxel-valorant-models.js';
import { weaponReloadDuration } from './voxel-fire-modes.js';
import { grenadeCapacity } from './voxel-ordnance.js';
import { MELEE_WEAPONS, meleeProfile, meleeWeaponId, meleeSlashOrigin, meleeSlashGeometry, meleeSlashPhase, parryPhase } from './voxel-melee.js';
import { frameAlpha } from './display-timing.js';
import { createPlayerAnimationPresenter, playerAnimationPose, weaponReloadPose, createWeaponReloadPresenter } from './voxel-player-animation.js';
import { createFirstPersonMotionPresenter, createWeaponShotPresenter, weaponShotPose, weaponCyclePose } from './voxel-first-person-motion.js';
import { MONSTER_BODIES, monsterBodyProfile } from './voxel-monster-bodies.js';
import { MONSTER_DEATH_RULES, monsterDeathPose, createMonsterDeathPresenter } from './voxel-monster-death.js';
import { HUMAN_DEATH_RULES, humanDeathPose, humanDeathCameraPose, createHumanDeathPresenter } from './voxel-human-death.js';
import { EMPTY_WORLD_LABELS, presentWorldLabels } from './voxel-label-presentation.js';
import { createSlashImpactPresenter } from './voxel-slash-effects.js';
import { MONSTER_VARIANT_ART, appendMonsterVariant } from './voxel-monster-variants.js';
import { MONSTER_SPECIAL_RULES } from './voxel-monster-specials.js';
import { monsterLocomotionPose, appendMonsterLimb } from './voxel-monster-animation.js';

// All solid world surfaces come directly from the engine's minimum-corner
// colliders. Decoration is either painted on those surfaces or outside bounds.
const VERTEX_STRIDE = 10;
const MAX_PARTICLES = 84;
const MAX_TRACERS = 14;
const MAX_EVENT_IDS = 256;
const MAX_MELEE_TRAILS = 10;
const MAX_MELEE_TRAIL_SAMPLES = 49;
const MELEE_TRAIL_FADE_TICKS = 10;
const MAX_MELEE_TRAIL_VERTICES = MAX_MELEE_TRAILS * (MAX_MELEE_TRAIL_SAMPLES - 1) * 18;
const TEAM_COLORS = ['#efad64', '#66d3c8'];
const SURVIVOR_COLORS = ['#cfb785', '#94bca3', '#c69e8f', '#a9b6d5', '#b4a0c3', '#d2aa6e', '#8bb7b8', '#c5bd8b', '#9bac80', '#c897b1'];
const ROYALE_THEMES = new Set(['forest', 'maze', 'desert']);
const MAX_LOOT = 128;
const MAX_SPAWN_WARNINGS = 4;
const TAU = Math.PI * 2;
const ATMOSPHERE = Object.freeze({
  courtyard: { sun: [-.52, .76, .39], direct: [.66, .51, .35], ambient: [.45, .52, .60], top: '#729aac', horizon: '#efd1ac', sunColor: '#ffe2a6' },
  depot: { sun: [-.36, .88, -.31], direct: [.51, .59, .61], ambient: [.40, .49, .59], top: '#719cae', horizon: '#d0ddd9', sunColor: '#e8f2df' },
  canal: { sun: [.47, .81, -.35], direct: [.62, .58, .45], ambient: [.44, .52, .61], top: '#799fb6', horizon: '#e7dfc5', sunColor: '#fff0c5' },
  rooftops: { sun: [-.58, .75, -.30], direct: [.64, .57, .43], ambient: [.43, .53, .61], top: '#729aac', horizon: '#eee0c3', sunColor: '#ffe6b6' },
  foundry: { sun: [.42, .80, .43], direct: [.60, .50, .35], ambient: [.44, .49, .56], top: '#748b9c', horizon: '#c5bdac', sunColor: '#ffd69d' },
  bastion: { sun: [-.37, .84, .40], direct: [.56, .59, .54], ambient: [.44, .53, .62], top: '#7699b0', horizon: '#d9e4d9', sunColor: '#f0edc5' },
  forest: { sun: [-.48, .78, .38], direct: [.53, .55, .36], ambient: [.44, .54, .48], top: '#749fac', horizon: '#d6ddbc', sunColor: '#fff0bd' },
  maze: { sun: [.40, .82, -.36], direct: [.52, .50, .42], ambient: [.47, .52, .60], top: '#7a9dab', horizon: '#d9dfcf', sunColor: '#efe9c8' },
  desert: { sun: [-.34, .90, -.28], direct: [.68, .57, .39], ambient: [.52, .55, .60], top: '#6ca9ba', horizon: '#eed9b7', sunColor: '#fff1c6' },
  paris: { sun: [-.47, .76, .45], direct: [.64, .56, .43], ambient: [.47, .53, .61], top: '#789eaf', horizon: '#ecd6b5', sunColor: '#ffebbd' },
  snow: { sun: [-.41, .82, .39], direct: [.50, .58, .65], ambient: [.50, .60, .73], top: '#759bbf', horizon: '#e4edf2', sunColor: '#edf5ff' },
  sewers: { sun: [.15, .98, .10], direct: [.28, .25, .18], ambient: [.56, .52, .46], top: '#242823', horizon: '#5a5b48', sunColor: '#ffe3aa' },
  market: { sun: [-.15, .98, .10], direct: [.25, .23, .19], ambient: [.66, .60, .51], top: '#14283d', horizon: '#405b64', sunColor: '#ffcd80' },
  lockdown: { sun: [.20, .96, -.18], direct: [.29, .26, .20], ambient: [.58, .61, .65], top: '#263a49', horizon: '#777164', sunColor: '#ffc876' },
  trading: { sun: [-.30, .91, .24], direct: [.51, .48, .43], ambient: [.66, .65, .63], top: '#aebbc4', horizon: '#e5e2d9', sunColor: '#fff5df' },
  dojo: { sun: [-.37, .82, .43], direct: [.67, .57, .44], ambient: [.51, .57, .59], top: '#7ea4b0', horizon: '#ecdbc4', sunColor: '#ffebbc' },
});
const ART = Object.freeze({
  courtyard: { paving: '#d7c7aa', accent: '#cc9d76', skyline: '#748b90', cloud: '#f4dcc0', tile: 2.5 },
  depot: { paving: '#4f626c', accent: '#c79152', skyline: '#5f747c', cloud: '#dfe9df', tile: 5 },
  canal: { paving: '#a9b8b2', accent: '#608f91', skyline: '#657c81', cloud: '#dfe9df', tile: 1.6 },
  rooftops: { paving: '#b6c5bc', accent: '#6faaa3', skyline: '#7e9d9b', cloud: '#ece8d5', tile: 2.5 },
  foundry: { paving: '#5d6769', accent: '#d69b62', skyline: '#5f7078', cloud: '#d9d7c9', tile: 5 },
  bastion: { paving: '#a2afa9', accent: '#c4b06c', skyline: '#70878a', cloud: '#e2e9dd', tile: 2.5 },
  forest: { paving: '#657b48', accent: '#bdd19c', skyline: '#47674f', cloud: '#edf0dc', tile: 4 },
  maze: { paving: '#899783', accent: '#9cc6bd', skyline: '#718d78', cloud: '#e5e9de', tile: 4 },
  desert: { paving: '#d7ba83', accent: '#51aca5', skyline: '#bd9867', cloud: '#f6e9c8', tile: 4 },
  paris: { paving: '#b9b4a7', accent: '#68847d', skyline: '#b3a894', cloud: '#f0e3cd', tile: 3 },
  snow: { paving: '#dce7ec', accent: '#779eb6', skyline: '#688b91', cloud: '#f2f6f8', tile: 4 },
  sewers: { paving: '#5e5a4d', accent: '#d5af61', skyline: '#464b3f', cloud: '#83958b', tile: 2.4 },
  market: { paving: '#566060', accent: '#e7b06a', skyline: '#354c60', cloud: '#718997', tile: 2.5 },
  lockdown: { paving: '#686765', accent: '#d2a063', skyline: '#485664', cloud: '#9ba4a9', tile: 3.2 },
  trading: { paving: '#858a89', accent: '#4787a0', skyline: '#738ca3', cloud: '#edf2f6', tile: 1.6 },
  dojo: { paving: '#798777', accent: '#bfa67b', skyline: '#738f82', cloud: '#f0e4d2', tile: 2 },
});
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const smooth = value => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, amount) => a + (b - a) * amount;
const gunHeld = player => !['sword', 'potion', 'grenade', 'empty'].includes(player?.slot) && !!WEAPONS[player?.weapon];

/** Remaining accepted recovery uses the short interval inside a committed burst. */
export function playerShotAge(player) {
  if (!gunHeld(player) || !(player.shotIndex > 0) || !(player.shotCooldown > 0) || player.reloadTicks > 0 || player.alive === false) return Infinity;
  const weapon = WEAPONS[player.weapon], duration = weapon.mode === 'burst' && player.burstRemaining > 0 ? weapon.burstInterval : weapon.cooldown;
  return Math.max(0, (duration - player.shotCooldown) * 1000 / 120);
}

/** Free-for-all uniforms never imply the two tactical teams. */
export function survivorColor(player) {
  const id = player?.id;
  const index = Number.isInteger(id) ? Math.abs(id) % SURVIVOR_COLORS.length : hash(id ?? 'spectator') % SURVIVOR_COLORS.length;
  return SURVIVOR_COLORS[index];
}

function aimProgress(player) {
  return WEAPONS[player.weapon]?.adsSupported === false || WEAPONS[player.weapon]?.adsEnabled === false || ['sword', 'potion', 'grenade', 'empty'].includes(player.slot) || player.healing || finite(player.healTicks) > 0 || finite(player.reloadTicks) > 0 || finite(player.grenadeThrowTicks) > 0 || player.alive === false ? 0 : smooth(finite(player.aimTicks) / ADS.ticks);
}

export function meleeMotion(player) {
  const profile = meleeProfile(player), id = meleeWeaponId(player), knife = id === 'knife', hand = id === 'tonfas' && player.meleeHand === 1 ? -1 : 1;
  const combo = { comboStep: finite(profile.comboStep), comboLength: finite(profile.comboLength), comboFinisher: profile.comboFinisher === true, slashDirection: profile.slashDirection === -1 ? -1 : 1 };
  const secondary = knife && player.meleeAction === 'secondary';
  const phase = meleeSlashPhase(player);
  const total = profile.startupTicks + profile.activeTicks + profile.recoveryTicks;
  const elapsed = total - clamp(finite(player.meleeTicks), 0, total);
  const idleYaw = (knife ? -.10 : id === 'axe' ? -.13 : id === 'tonfas' ? -.08 : -.18) * hand;
  const idlePitch = knife ? .22 : id === 'axe' ? .60 : id === 'tonfas' ? .12 : .48;
  const idleRoll = knife ? 0 : (id === 'katana' ? -.32 : id === 'tonfas' ? .12 : -.18) * hand;
  const defense = player.slot === 'sword' && player.alive !== false && !player.monsterType && phase.phase === 'idle' ? parryPhase(player) : { phase: 'idle' };
  if (defense.phase !== 'idle') {
    const progress = smooth(defense.progress), weight = defense.phase === 'startup' ? progress : defense.phase === 'active' ? 1 : 1 - progress;
    // The blade crosses the committed frontal guard. Paired batons meet in
    // a raised V; the visible hold ends with the real short defense timer.
    const guardYaw = (id === 'tonfas' ? -.70 : id === 'axe' ? -.80 : -.94) * hand;
    const guardPitch = id === 'tonfas' ? .82 : id === 'axe' ? .70 : .58;
    return { ...combo, yaw: lerp(idleYaw, guardYaw, weight), pitch: lerp(idlePitch, guardPitch, weight), roll: lerp(idleRoll, (id === 'tonfas' ? .35 : .52) * hand, weight), extension: .03 * weight, active: false, phase: `parry-${defense.phase}`, progress: defense.progress, grip: weight, guarding: true, guardActive: defense.phase === 'active', action: 'parry' };
  }
  const action = secondary ? 'secondary' : 'primary';
  if (phase.phase === 'idle') return { ...combo, yaw: idleYaw, pitch: idlePitch, roll: idleRoll, extension: 0, active: false, phase: 'idle', progress: 0, grip: 0, action };
  const pathProgress = phase.phase === 'startup' ? 0 : phase.phase === 'active' ? phase.progress : 1;
  const sample = meleeSlashGeometry(player, { from: pathProgress, to: pathProgress }).samples[0];
  const yaw = Math.atan2(sample.direction.x, -sample.direction.z), pitch = Math.asin(clamp(sample.direction.y, -1, 1));
  let relativeYaw = yaw - finite(player.meleeYaw, finite(player.yaw));
  while (relativeYaw > Math.PI) relativeYaw -= TAU;
  while (relativeYaw < -Math.PI) relativeYaw += TAU;
  const relativePitch = pitch - finite(player.meleePitch, finite(player.pitch));
  // The broad blade edge lies in the accepted cut plane. Axial wrist roll
  // makes the metal read as a slicing edge without rotating its damage ray.
  const roll = knife ? 0 : meleeCutRoll(player, sample, yaw, pitch);
  if (phase.phase === 'startup') {
    // A heavy blade loads slowly, with a distinct pull back before its cut.
    const progress = smooth(elapsed / profile.startupTicks), weight = id === 'axe' ? progress ** 1.3 : progress;
    const extension = secondary ? -.18 * progress + .88 * smooth((progress - .72) / .28) : knife ? -progress * .10 : -Math.sin(progress * Math.PI) * (id === 'axe' ? .16 : .10);
    return { ...combo, yaw: lerp(idleYaw, relativeYaw, weight), pitch: lerp(idlePitch, relativePitch, weight), roll: lerp(idleRoll, roll, weight), extension, active: false, phase: 'startup', progress, grip: weight, action };
  }
  if (phase.phase === 'active') {
    return { ...combo, yaw: relativeYaw, pitch: relativePitch, roll, extension: knife ? (secondary ? .70 : .48) - phase.progress * (secondary ? .10 : .12) : Math.sin(phase.progress * Math.PI) * (id === 'tonfas' ? .19 : .28), active: true, phase: 'active', progress: phase.progress, grip: 1, action };
  }
  const progress = smooth((elapsed - profile.startupTicks - profile.activeTicks) / profile.recoveryTicks);
  return { ...combo, yaw: lerp(relativeYaw, idleYaw, progress), pitch: lerp(relativePitch, idlePitch, progress), roll: lerp(roll, idleRoll, progress), extension: knife ? (secondary ? .60 : .36) * (1 - progress) : 0, active: false, phase: 'recovery', progress, grip: 1 - progress, action };
}

function meleeCutRoll(player, sample, yaw, pitch) {
  const nearby = meleeSlashGeometry(player, { from: Math.max(0, sample.progress - .001), to: Math.min(1, sample.progress + .001) }).samples;
  const first = nearby[0].direction, last = nearby.at(-1).direction;
  const reverse = meleeProfile(player).dualWield && player.meleeHand === 1 ? -1 : 1;
  const vector = [sample.direction.x, sample.direction.y, sample.direction.z];
  const travel = [last.x - first.x, last.y - first.y, last.z - first.z].map(value => value * reverse);
  const dot = travel.reduce((sum, value, axis) => sum + value * vector[axis], 0);
  const tangent = travel.map((value, axis) => value - vector[axis] * dot);
  const right = rotate([1, 0, 0], yaw, pitch), up = rotate([0, 1, 0], yaw, pitch);
  return Math.atan2(tangent.reduce((sum, value, axis) => sum + value * up[axis], 0), tangent.reduce((sum, value, axis) => sum + value * right[axis], 0));
}

function rgba(value, alpha = 1) {
  if (Array.isArray(value)) return [value[0] ?? 1, value[1] ?? 1, value[2] ?? 1, value[3] ?? alpha];
  const hex = typeof value === 'string' ? value.replace('#', '') : '879498';
  if (hex.length === 3) return [parseInt(hex[0] + hex[0], 16) / 255, parseInt(hex[1] + hex[1], 16) / 255, parseInt(hex[2] + hex[2], 16) / 255, alpha];
  if (hex.length === 6 && /^[0-9a-f]+$/i.test(hex)) return [parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255, alpha];
  return [.53, .58, .60, alpha];
}
function shade(color, amount, alpha = color[3] ?? 1) {
  return [clamp(color[0] * amount, 0, 1), clamp(color[1] * amount, 0, 1), clamp(color[2] * amount, 0, 1), alpha];
}
function mix(a, b, amount) {
  return [a[0] + (b[0] - a[0]) * amount, a[1] + (b[1] - a[1]) * amount, a[2] + (b[2] - a[2]) * amount, a[3] ?? 1];
}
function hash(value) {
  let result = 2166136261;
  for (const character of String(value)) result = Math.imul(result ^ character.charCodeAt(0), 16777619);
  return result >>> 0;
}
const DEFAULT_SHOT_EFFECT = Object.freeze({ tracerColor: '#f5ce83', muzzleColor: '#f6d991', impactColor: '#e4c286', tracerWidth: .009, tracerTicks: 8, muzzleTicks: 5, muzzleSize: 1, muzzleStrength: 1, impactStrength: 1, kickStrength: 1, kickTicks: 28 });
const shotEffect = weapon => WEAPONS[weapon]?.effects || DEFAULT_SHOT_EFFECT;
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normalized = (vector, fallback = [0, 1, 0]) => { const length = Math.hypot(...vector); return length > 1e-6 ? vector.map(value => value / length) : fallback; };

function impactParticles(event, contact, direction, map, time, key) {
  const effects = shotEffect(event.weapon || (event.type === 'boltHit' ? 'crossbow' : 'carbine'));
  const collider = map?.colliders?.find(box => box.id === event.colliderId);
  let normal = [finite(event.nx), finite(event.ny), finite(event.nz)];
  if (Math.hypot(...normal) < 1e-5) {
    if (event.colliderId === 'floor') normal = [0, 1, 0];
    else if (collider) {
      // Use the contacted physical face, including the underside of a deck.
      const faces = [[Math.abs(contact[0] - collider.x), [-1, 0, 0]], [Math.abs(contact[0] - collider.x - collider.w), [1, 0, 0]], [Math.abs(contact[1] - collider.y), [0, -1, 0]], [Math.abs(contact[1] - collider.y - collider.h), [0, 1, 0]], [Math.abs(contact[2] - collider.z), [0, 0, -1]], [Math.abs(contact[2] - collider.z - collider.d), [0, 0, 1]]];
      normal = faces.reduce((nearest, face) => face[0] < nearest[0] ? face : nearest)[1];
    } else normal = direction.map(value => -value);
  }
  normal = normalized(normal);
  const tangent = normalized(cross(normal, Math.abs(normal[1]) > .9 ? [1, 0, 0] : [0, 1, 0]));
  const bitangent = cross(normal, tangent);
  const material = event.hitKind === 'wall' ? collider?.material || 'stone' : event.damage > 0 ? event.hitKind : 'cloth';
  const metal = material === 'metal', wood = material === 'wood' || material === 'bark', leaves = material === 'foliage', head = material === 'head', leg = material === 'leg';
  const strength = clamp(finite(effects.impactStrength, 1), .25, 2);
  const count = clamp(Math.round((metal || head ? 6 : 5) * strength), 3, 10);
  const color = leaves ? '#90ac6f' : wood ? '#bd9163' : metal ? effects.impactColor : head ? '#ffdfad' : leg ? '#ad7d68' : material === 'body' ? '#d6a189' : material === 'cloth' ? '#89928a' : '#c6bba5';
  const seed = hash(key), origin = contact.map((value, i) => value + normal[i] * .055);
  return Array.from({ length: count }, (_, i) => {
    const angle = seed % 7 + i * 2.39996, outward = (metal ? .75 : .40) * strength;
    const scatter = (metal ? .75 : wood ? .55 : .35) * (.5 + i / count) * strength;
    const velocity = normal.map((value, axis) => value * outward + (tangent[axis] * Math.cos(angle) + bitangent[axis] * Math.sin(angle)) * scatter);
    return { origin, born: time, vx: velocity[0], vy: velocity[1] + .12, vz: velocity[2], color, life: (metal ? 145 : wood ? 250 : 190) + i * 13, gravity: metal ? 3 : 4, cover: true, size: metal ? .016 : wood ? .026 : .030, material, targetId: event.targetId ?? null };
  });
}

function bloodParticles(event, state, time, key) {
  // Shot/bolt contact reports can still describe a pellet arriving after a
  // lethal hit, or an allied blocker. Only confirmed HP loss creates blood.
  if (event.type !== 'damage' || !(event.damage > 0) || !['gun', 'bolt'].includes(event.attack) || event.targetId == null || event.playerId == null || event.targetId === event.playerId) return [];
  const target = state.players?.find(player => player.id === event.targetId), source = state.players?.find(player => player.id === event.playerId);
  if (state.gameId !== 'voxel-royale' && target && source && target.team === source.team) return [];
  const contact = [event.hitX, event.hitY, event.hitZ].every(Number.isFinite) ? [event.hitX, event.hitY, event.hitZ] : [event.x, event.y, event.z];
  if (!contact.every(Number.isFinite)) return [];
  const normal = normalized([-finite(event.dx), -finite(event.dy), -finite(event.dz)], [0, .12, 1]);
  const tangent = normalized(cross(normal, Math.abs(normal[1]) > .9 ? [1, 0, 0] : [0, 1, 0])), bitangent = cross(normal, tangent);
  const seed = hash(key), count = clamp(3 + Math.ceil(event.damage / 35), 4, 8);
  const origin = contact.map((value, axis) => value + normal[axis] * .045);
  return Array.from({ length: count }, (_, i) => {
    const angle = seed % 11 + i * 2.39996, scatter = .34 + (i % 4) * .11;
    const velocity = normal.map((value, axis) => value * (.56 + (i % 3) * .12) + (tangent[axis] * Math.cos(angle) + bitangent[axis] * Math.sin(angle)) * scatter);
    return { origin, born: time, vx: velocity[0], vy: velocity[1] + .18 + (i % 3) * .07, vz: velocity[2], color: i % 3 === 0 ? '#922f37' : i % 3 === 1 ? '#c4484b' : '#ac353d', life: 235 + (i % 4) * 27, gravity: 4.8, cover: true, radius: .72, size: .016 + (i % 3) * .004, material: 'blood', shrink: true, targetId: event.targetId };
  });
}
function rotate(vector, yaw = 0, pitch = 0, roll = 0) {
  const cp = Math.cos(pitch), sp = Math.sin(pitch), cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cr = Math.cos(roll), sr = Math.sin(roll), x = vector[0] * cr - vector[1] * sr, vertical = vector[0] * sr + vector[1] * cr;
  const y = vertical * cp - vector[2] * sp;
  const z = vertical * sp + vector[2] * cp;
  return [x * cy - z * sy, y, x * sy + z * cy];
}
function perspective(fov, aspect, near, far) {
  const f = 1 / Math.tan(fov / 2), out = new Float32Array(16);
  out[0] = f / aspect; out[5] = f; out[10] = (far + near) / (near - far);
  out[11] = -1; out[14] = 2 * far * near / (near - far);
  return out;
}
function viewMatrix(eye, yaw, pitch, roll = 0) {
  const sy = Math.sin(yaw), cy = Math.cos(yaw), sp = Math.sin(pitch), cp = Math.cos(pitch);
  const right = rotate([1, 0, 0], yaw, pitch, roll), up = rotate([0, 1, 0], yaw, pitch, roll), forward = [sy * cp, sp, -cy * cp];
  const dot = vector => vector[0] * eye[0] + vector[1] * eye[1] + vector[2] * eye[2];
  return new Float32Array([right[0], up[0], -forward[0], 0, right[1], up[1], -forward[1], 0, right[2], up[2], -forward[2], 0, -dot(right), -dot(up), dot(forward), 1]);
}
const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

// Face order and vertex winding match the authored meshes. Rigid boxes write
// directly into reusable typed storage, without per-face points or transforms.
const BOX_FACES = [
  { corners: [2, 6, 7, 3], normal: [0, 1, 0], shade: 1.075 },
  { corners: [0, 1, 5, 4], normal: [0, -1, 0], shade: .83 },
  { corners: [0, 2, 3, 1], normal: [0, 0, -1], shade: 1 },
  { corners: [5, 7, 6, 4], normal: [0, 0, 1], shade: .93 },
  { corners: [4, 6, 2, 0], normal: [-1, 0, 0], shade: .94 },
  { corners: [1, 3, 7, 5], normal: [1, 0, 0], shade: .98 },
];
const BOX_TRIANGLES = [0, 1, 2, 0, 2, 3];
const boxColorCache = new Map();
function boxColors(color) {
  if (typeof color === 'string' && boxColorCache.has(color)) return boxColorCache.get(color);
  const base = rgba(color), colors = BOX_FACES.map(face => face.shade === 1 ? base : shade(base, face.shade));
  if (typeof color === 'string') {
    boxColorCache.set(color, colors);
    if (boxColorCache.size > 256) boxColorCache.delete(boxColorCache.keys().next().value);
  }
  return colors;
}
class Mesh {
  constructor() { this.storage = new Float32Array(2048); this.length = 0; }
  reset() { this.length = 0; return this; }
  ensure(addition) {
    const required = this.length + addition;
    if (required <= this.storage.length) return;
    let capacity = this.storage.length;
    while (capacity < required) capacity *= 2;
    const grown = new Float32Array(capacity); grown.set(this.storage.subarray(0, this.length)); this.storage = grown;
  }
  append(array) { this.ensure(array.length); this.storage.set(array, this.length); this.length += array.length; }
  vertex(position, normal, color) {
    this.ensure(VERTEX_STRIDE); const out = this.storage; let at = this.length;
    out[at++] = position[0]; out[at++] = position[1]; out[at++] = position[2];
    out[at++] = normal[0]; out[at++] = normal[1]; out[at++] = normal[2];
    out[at++] = color[0]; out[at++] = color[1]; out[at++] = color[2]; out[at++] = color[3]; this.length = at;
  }
  quad(a, b, c, d, normal, color) {
    this.vertex(a, normal, color); this.vertex(b, normal, color); this.vertex(c, normal, color);
    this.vertex(a, normal, color); this.vertex(c, normal, color); this.vertex(d, normal, color);
  }
  box(x, y, z, w, h, d, color, pose = null) {
    if (w <= 0 || h <= 0 || d <= 0) return;
    this.ensure(36 * VERTEX_STRIDE);
    const colors = boxColors(color), out = this.storage;
    const scale = pose?.scale || 1, cp = Math.cos(pose?.pitch || 0), sp = Math.sin(pose?.pitch || 0), cy = Math.cos(pose?.yaw || 0), sy = Math.sin(pose?.yaw || 0), roll = pose?.roll || 0, cr = Math.cos(roll), sr = Math.sin(roll);
    let at = this.length;
    for (let face = 0; face < BOX_FACES.length; face++) {
      const { corners, normal } = BOX_FACES[face], tint = colors[face];
      let nx = normal[0], ny = normal[1], nz = normal[2];
      if (roll) { const rx = nx * cr - ny * sr; ny = nx * sr + ny * cr; nx = rx; }
      if (pose) { const py = ny * cp - nz * sp, pz = ny * sp + nz * cp; nz = nx * sy + pz * cy; nx = nx * cy - pz * sy; ny = py; }
      for (let i = 0; i < BOX_TRIANGLES.length; i++) {
        const corner = corners[BOX_TRIANGLES[i]];
        let px = corner & 1 ? x + w : x, py = corner & 2 ? y + h : y, pz = corner & 4 ? z + d : z;
        if (pose) {
          px *= scale; py *= scale; pz *= scale;
          if (roll) { const rx = px * cr - py * sr; py = px * sr + py * cr; px = rx; }
          const ry = py * cp - pz * sp, rz = py * sp + pz * cp;
          pz = px * sy + rz * cy + pose.z; py = ry + pose.y; px = px * cy - rz * sy + pose.x;
        }
        out[at++] = px; out[at++] = py; out[at++] = pz;
        out[at++] = nx; out[at++] = ny; out[at++] = nz;
        out[at++] = tint[0]; out[at++] = tint[1]; out[at++] = tint[2]; out[at++] = tint[3];
      }
    }
    this.length = at;
  }
  beam(a, b, width, color) {
    const delta = b.map((value, i) => value - a[i]), length = Math.hypot(...delta);
    if (length <= 0) return;
    this.box(-width / 2, 0, -width / 2, width, length, width, color, {
      x: a[0], y: a[1], z: a[2], yaw: Math.atan2(-delta[0], delta[2]), pitch: Math.atan2(Math.hypot(delta[0], delta[2]), delta[1]),
    });
  }
  floor(x, z, w, d, color, y = .008) {
    this.quad([x, y, z], [x, y, z + d], [x + w, y, z + d], [x + w, y, z], [0, 1, 0], rgba(color));
  }
  floorPolygon(points, color, y = .006) {
    // The monotone hull supplies a convex silhouette for static sun shadows.
    const sorted = points.map(point => [...point]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const half = list => { const hull = []; for (const point of list) { while (hull.length > 1 && cross(hull.at(-2), hull.at(-1), point) <= 0) hull.pop(); hull.push(point); } return hull; };
    const hull = [...half(sorted).slice(0, -1), ...half(sorted.reverse()).slice(0, -1)], c = rgba(color);
    for (let i = 1; i < hull.length - 1; i++) {
      // Reverse the X/Z winding to point upward in the X/Y/Z world.
      for (const point of [hull[0], hull[i + 1], hull[i]]) this.vertex([point[0], y, point[1]], [0, 1, 0], c);
    }
  }
  panel(x, y, z, w, h, d, color) {
    const c = rgba(color);
    if (d <= w) {
      this.quad([x, y, z], [x, y + h, z], [x + w, y + h, z], [x + w, y, z], [0, 0, -1], c);
      this.quad([x + w, y, z + d], [x + w, y + h, z + d], [x, y + h, z + d], [x, y, z + d], [0, 0, 1], c);
    } else {
      this.quad([x, y, z + d], [x, y + h, z + d], [x, y + h, z], [x, y, z], [-1, 0, 0], c);
      this.quad([x + w, y, z], [x + w, y + h, z], [x + w, y + h, z + d], [x + w, y, z + d], [1, 0, 0], c);
    }
  }
  floorRing(x, z, inner, outer, color, y = .009, segments = 40) {
    const c = rgba(color);
    for (let i = 0; i < segments; i++) {
      const a = i * TAU / segments, b = (i + 1) * TAU / segments;
      this.quad([x + Math.sin(a) * inner, y, z + Math.cos(a) * inner], [x + Math.sin(a) * outer, y, z + Math.cos(a) * outer], [x + Math.sin(b) * outer, y, z + Math.cos(b) * outer], [x + Math.sin(b) * inner, y, z + Math.cos(b) * inner], [0, 1, 0], c);
    }
  }
  line(a, b, width, color, camera) {
    const delta = b.map((value, i) => value - a[i]);
    const middle = a.map((value, i) => (value + b[i]) / 2);
    const toEye = camera.map((value, i) => value - middle[i]);
    const side = [delta[1] * toEye[2] - delta[2] * toEye[1], delta[2] * toEye[0] - delta[0] * toEye[2], delta[0] * toEye[1] - delta[1] * toEye[0]];
    const length = Math.hypot(...side) || 1;
    const offset = side.map(value => value * width / length);
    this.quad(a.map((v, i) => v - offset[i]), b.map((v, i) => v - offset[i]), b.map((v, i) => v + offset[i]), a.map((v, i) => v + offset[i]), [0, 1, 0], rgba(color));
  }
  get array() { return this.storage.subarray(0, this.length); }
}

const VERTEX_SHADER = `
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec4 aColor;
uniform mat4 uProjection;
uniform mat4 uView;
uniform vec3 uEye;
uniform vec3 uLightDirection;
uniform vec3 uSun;
uniform vec3 uAmbient;
varying vec4 vColor;
varying float vDistance;
varying vec2 vWorldXZ;
void main() {
  gl_Position = uProjection * uView * vec4(aPosition, 1.0);
  vec3 normal = normalize(aNormal);
  float direct = max(0.0, dot(normal, normalize(uLightDirection)));
  vec3 light = uAmbient + uSun * direct + vec3(0.08, 0.09, 0.10) * (normal.y * 0.5 + 0.5);
  vColor = vec4(aColor.rgb * light, aColor.a);
  vDistance = length(aPosition - uEye);
  vWorldXZ = aPosition.xz;
}`;
const FRAGMENT_SHADER = `
precision mediump float;
uniform vec3 uFog;
uniform float uFogStrength;
uniform vec3 uStormCircle;
uniform float uStormStrength;
varying vec4 vColor;
varying float vDistance;
varying vec2 vWorldXZ;
void main() {
  float fog = clamp((vDistance - 27.0) / 90.0, 0.0, 0.56) * uFogStrength;
  vec3 color = mix(vColor.rgb, uFog, fog);
  // Surface haze adds no opaque wall or false cover at the safe-zone edge.
  float outside = smoothstep(-0.20, 3.5, length(vWorldXZ - uStormCircle.xy) - uStormCircle.z);
  color = mix(color, vec3(0.30, 0.48, 0.69), outside * uStormStrength * (0.20 + fog * 0.35));
  gl_FragColor = vec4(color, vColor.a);
}`;
const SKY_VERTEX_SHADER = `
attribute vec2 aPosition;
varying vec2 vScreen;
void main() {
  gl_Position = vec4(aPosition, 0.999, 1.0);
  vScreen = aPosition;
}`;
const SKY_FRAGMENT_SHADER = `
precision mediump float;
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uSunColor;
uniform vec3 uSunDirection;
uniform vec3 uRight;
uniform vec3 uUp;
uniform vec3 uForward;
uniform vec2 uScale;
varying vec2 vScreen;
void main() {
  vec3 ray = normalize(uForward + uRight * vScreen.x * uScale.x + uUp * vScreen.y * uScale.y);
  vec3 sun = normalize(uSunDirection);
  float glow = pow(max(0.0, dot(ray, sun)), 48.0) * 0.13;
  // A tiny square sun suits the block world. Its basis is world-relative so
  // the sky and light direction remain attached to the map when looking up.
  vec3 side = normalize(cross(sun, vec3(0.0, 1.0, 0.0)));
  vec3 up = normalize(cross(side, sun));
  float square = step(abs(dot(ray, side)), 0.016) * step(abs(dot(ray, up)), 0.016) * step(0.99, dot(ray, sun));
  vec3 sky = mix(uHorizon, uTop, smoothstep(-0.05, 0.70, ray.y));
  gl_FragColor = vec4(mix(sky, uSunColor, min(1.0, glow + square)), 1.0);
}`;

function shader(gl, type, source) {
  const result = gl.createShader(type);
  gl.shaderSource(result, source); gl.compileShader(result);
  if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) {
    const reason = gl.getShaderInfoLog(result); gl.deleteShader(result);
    throw new Error(`Voxel shader could not compile: ${reason}`);
  }
  return result;
}
function rayCoverDistance(origin, direction, colliders, maximum, padding = 0) {
  let nearest = maximum;
  for (const collider of colliders) {
    let entry = 0, exit = nearest;
    const mins = [collider.x - padding, collider.y - padding, collider.z - padding], maxs = [collider.x + collider.w + padding, collider.y + collider.h + padding, collider.z + collider.d + padding];
    let valid = true;
    for (let axis = 0; axis < 3; axis++) {
      if (Math.abs(direction[axis]) < 1e-8) {
        if (origin[axis] < mins[axis] || origin[axis] > maxs[axis]) { valid = false; break; }
      } else {
        const a = (mins[axis] - origin[axis]) / direction[axis], b = (maxs[axis] - origin[axis]) / direction[axis];
        entry = Math.max(entry, Math.min(a, b)); exit = Math.min(exit, Math.max(a, b));
        if (entry > exit) { valid = false; break; }
      }
    }
    if (valid && exit >= 0) nearest = Math.min(nearest, Math.max(0, entry));
  }
  return nearest;
}

/** The last few authoritative blade slices, clipped before solid cover. */
export function meleeTrailPath(player, colliders = []) {
  if (!player || player.alive === false || player.monsterType || player.slot !== 'sword') return null;
  const profile = meleeProfile(player), phase = meleeSlashPhase(player);
  const total = profile.startupTicks + profile.activeTicks + profile.recoveryTicks;
  const elapsed = total - clamp(finite(player.meleeTicks), 0, total);
  const recoveryAge = elapsed - profile.startupTicks - profile.activeTicks;
  if (phase.phase === 'idle' || phase.phase === 'startup' || recoveryAge >= MELEE_TRAIL_FADE_TICKS) return null;
  const to = phase.phase === 'active' ? phase.to : 1;
  const fade = phase.phase === 'active' ? 1 : 1 - recoveryAge / MELEE_TRAIL_FADE_TICKS;
  const path = meleeSlashGeometry(player, { from: Math.max(0, to - .55), to });
  const origin = [path.origin.x, path.origin.y, path.origin.z];
  const reach = path.reach + .05;
  const cover = colliders.filter(box => box && [box.x, box.y, box.z, box.w, box.h, box.d].every(Number.isFinite) && box.w > 0 && box.h > 0 && box.d > 0 && box.x < origin[0] + reach && box.x + box.w > origin[0] - reach && box.y < origin[1] + reach && box.y + box.h > origin[1] - reach && box.z < origin[2] + reach && box.z + box.d > origin[2] - reach);
  const samples = path.samples.slice(0, MAX_MELEE_TRAIL_SAMPLES).map(sample => {
    const direction = [sample.direction.x, sample.direction.y, sample.direction.z];
    const rawLength = Math.hypot(sample.outer.x - origin[0], sample.outer.y - origin[1], sample.outer.z - origin[2]);
    const length = Math.max(0, Math.min(rawLength, rayCoverDistance(origin, direction, cover, rawLength + .025, .012) - .025));
    return { progress: sample.progress, inner: [sample.inner.x, sample.inner.y, sample.inner.z], outer: origin.map((value, axis) => value + direction[axis] * length), direction, length, clipped: length < rawLength - .001 };
  });
  return { kind: path.kind, origin, radius: path.radius, from: path.from, to: path.to, fade, samples, cover,
    comboStep: finite(profile.comboStep), comboLength: finite(profile.comboLength), comboFinisher: profile.comboFinisher === true, slashDirection: profile.slashDirection === -1 ? -1 : 1 };
}

function quadTouchesCover(points, colliders) {
  // A conservative AABB test also catches thin cover wholly inside a ribbon,
  // where merely testing its edge rays would let a triangle bridge a wall.
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const point of points) for (let axis = 0; axis < 3; axis++) { lo[axis] = Math.min(lo[axis], point[axis]); hi[axis] = Math.max(hi[axis], point[axis]); }
  return colliders.some(box => hi[0] >= box.x && lo[0] <= box.x + box.w && hi[1] >= box.y && lo[1] <= box.y + box.h && hi[2] >= box.z && lo[2] <= box.z + box.d);
}

function meleeTrailParts(mesh, player, colliders, camera, { reducedMotion = false } = {}) {
  const path = meleeTrailPath(player, colliders);
  if (!path || !path.samples.length) return 0;
  const start = mesh.length;
  const id = meleeWeaponId(player), warm = id === 'axe' || id === 'katana';
  const core = path.comboFinisher ? [1, 1, .93, 1] : warm ? [1, .97, .85, 1] : [.94, 1, 1, 1];
  const ribbon = path.comboFinisher ? [1, .80, .36, 1] : id === 'tonfas' ? [.78, .66, 1, 1] : id === 'katana' ? [1, .84, .47, 1] : warm ? [1, .64, .32, 1] : [.46, .89, 1, 1];
  if (path.kind === 'stab') {
    const sample = path.samples.at(-1);
    if (sample.length > .21) {
      const accent = path.comboFinisher && !reducedMotion ? 1.2 : 1;
      mesh.line(sample.inner, sample.outer, .026 * accent, [ribbon[0], ribbon[1], ribbon[2], .15 * accent * path.fade], camera);
      mesh.line(sample.inner, sample.outer, .006 * accent, [core[0], core[1], core[2], .62 * accent * path.fade], camera);
    }
    return (mesh.length - start) / VERTEX_STRIDE;
  }
  for (let index = 1; index < path.samples.length; index++) {
    const a = path.samples[index - 1], b = path.samples[index];
    if (a.length <= .21 || b.length <= .21) continue;
    const full = [a.inner, a.outer, b.outer, b.inner];
    if (quadTouchesCover(full, path.cover)) continue;
    const age = (a.progress + b.progress) / 2 - path.from;
    const span = Math.max(.001, path.to - path.from);
    const taperA = clamp((a.progress - path.from) / span, 0, 1), taperB = clamp((b.progress - path.from) / span, 0, 1);
    const head = clamp(age / span, 0, 1), fade = path.fade * (.06 + .94 * head ** 1.2);
    const depthA = Math.min(path.radius * (.16 + taperA * .74), a.length - .19), depthB = Math.min(path.radius * (.16 + taperB * .74), b.length - .19);
    const innerA = a.outer.map((value, axis) => value - a.direction[axis] * depthA);
    const innerB = b.outer.map((value, axis) => value - b.direction[axis] * depthB);
    // A faint finite blade band, a narrow tip ribbon and a bright thin edge.
    // All three layers follow the actual sampled cut, never a projectile.
    mesh.quad(...full, [0, 1, 0], [ribbon[0], ribbon[1], ribbon[2], (reducedMotion ? .028 : .070) * fade]);
    mesh.quad(innerA, a.outer, b.outer, innerB, [0, 1, 0], [ribbon[0], ribbon[1], ribbon[2], (reducedMotion ? .22 : .52) * fade]);
    // Every fourth short edge catches the light, rather than adding a new
    // free-moving spark object or another draw pass for each swinging actor.
    const glint = !reducedMotion && (index + finite(player.meleeIndex)) % 4 === 0;
    const width = (reducedMotion ? .009 : (.016 + head * .010 + (glint ? .009 : 0)) * (path.comboFinisher ? 1.2 : 1)) * path.fade;
    const delta = b.outer.map((value, axis) => value - a.outer[axis]), middle = a.outer.map((value, axis) => (value + b.outer[axis]) / 2);
    const toEye = camera.map((value, axis) => value - middle[axis]), side = normalized(cross(delta, toEye), [0, 0, 0]).map(value => value * width);
    const edge = [a.outer.map((v, i) => v - side[i]), b.outer.map((v, i) => v - side[i]), b.outer.map((v, i) => v + side[i]), a.outer.map((v, i) => v + side[i])];
    if (!quadTouchesCover(edge, path.cover)) mesh.quad(...edge, [0, 1, 0], [core[0], core[1], core[2], Math.min(1, (glint ? 1.15 : .98) * fade)]);
  }
  return (mesh.length - start) / VERTEX_STRIDE;
}

/** Inspect the same finite trail assembly without creating a WebGL context. */
export function meleeTrailMeshes(player, colliders = [], camera = [0, 1.62, 0], options = {}) {
  const mesh = new Mesh(); meleeTrailParts(mesh, player, colliders, camera, options); return mesh.array;
}

/** Smooth stance height without delaying movement, aim or authoritative collision. */
export function createEyeHeightPresenter() {
  let previous = null;
  const present = (player, map, time, contextKey) => {
    const target = player?.crouching ? WORLD.crouchEyeHeight : WORLD.eyeHeight;
    const x = finite(player?.x), y = finite(player?.y), z = finite(player?.z);
    const valid = player && Number.isFinite(time) && [player.x, player.y, player.z].every(Number.isFinite);
    const reset = !valid || !previous || previous.map !== map || previous.contextKey !== contextKey || previous.id !== player.id || previous.alive !== player.alive || player.alive === false || time < previous.time || time - previous.time > 150 || Math.hypot(x - previous.x, y - previous.y, z - previous.z) > 2;
    let height = reset ? target : target + (previous.height - target) * Math.exp(-(time - previous.time) / 45);
    height = clamp(height, WORLD.crouchEyeHeight, WORLD.eyeHeight);
    const delta = height - target;
    if (Math.abs(delta) > 1e-8 && map?.colliders?.length) {
      const distance = Math.abs(delta), direction = [0, Math.sign(delta), 0];
      const contact = rayCoverDistance([x, y + target, z], direction, map.colliders, distance, .04);
      if (contact < distance) height = target + Math.sign(delta) * Math.max(0, contact - .005);
    }
    previous = valid ? { x, y, z, time, height, map, contextKey, id: player.id, alive: player.alive } : null;
    return [x, y + height, z];
  };
  present.reset = () => { previous = null; };
  return present;
}

/** Cosmetic fragments remain on the visible side of real collision surfaces. */
export function particlePosition(particle, time, colliders = []) {
  const elapsed = clamp(finite(time - particle.born), 0, finite(particle.life, 1));
  const age = elapsed / 1000, fade = 1 - elapsed / finite(particle.life, 1);
  const size = particle.shrink ? finite(particle.size, .026) * fade + fade * .025 : finite(particle.size, .026) + fade * .028;
  let point = [particle.origin[0] + finite(particle.vx) * age, Math.max(size / 2, particle.origin[1] + finite(particle.vy) * age - age * age * finite(particle.gravity, 3)), particle.origin[2] + finite(particle.vz) * age];
  if (particle.cover) {
    const delta = point.map((value, i) => value - particle.origin[i]), length = Math.hypot(...delta);
    if (length > 1e-5) {
      const direction = delta.map(value => value / length), limit = Math.min(length, finite(particle.radius, Infinity));
      const contact = rayCoverDistance(particle.origin, direction, colliders, limit, size * .55);
      const travel = contact < length ? Math.max(0, contact - size * .6) : Math.min(length, limit);
      point = particle.origin.map((value, i) => value + direction[i] * travel);
    }
  }
  return { point, size, fade };
}

/** Highest surface beneath a point, independent of authored collider order. */
export function surfaceBelow(colliders, x, z, height) {
  let support = null, top = 0;
  for (const collider of colliders || []) {
    const candidate = collider.y + collider.h;
    if (x < collider.x || x > collider.x + collider.w || z < collider.z || z > collider.z + collider.d || candidate > height + .005 || candidate <= top) continue;
    support = collider; top = candidate;
  }
  return support;
}

const SPECIAL_RING_SEGMENTS = 28;
const SPECIAL_RING_POINTS = Object.freeze(Array.from({ length: SPECIAL_RING_SEGMENTS + 1 }, (_, index) => Object.freeze([Math.sin(index * TAU / SPECIAL_RING_SEGMENTS), Math.cos(index * TAU / SPECIAL_RING_SEGMENTS)])));
const actorLife = actor => Number.isSafeInteger(actor?.lifeId) ? actor.lifeId : 0;
function specialSource(state, attack, type) {
  const source = state.players?.find(player => player.id === (attack.sourceId ?? attack.playerId));
  return source?.monster === true && source.human !== true && source.monsterType === type && actorLife(source) === attack.sourceLifeId ? source : null;
}
function validSpecialTimer(attack, maximum) {
  return [attack.x, attack.y, attack.z, attack.ticksLeft, attack.lifeTicks].every(Number.isFinite) && attack.ticksLeft > 0 && attack.ticksLeft <= attack.lifeTicks && attack.lifeTicks > 0 && attack.lifeTicks <= maximum;
}
function groundWarningRing(mesh, map, x, y, z, inner, outer, color) {
  const colliders = map.colliders || [], points = [[0, y + .016, 0], [0, y + .016, 0], [0, y + .016, 0], [0, y + .016, 0]], normal = [0, 1, 0];
  for (let index = 0; index < SPECIAL_RING_SEGMENTS; index++) {
    const a = SPECIAL_RING_POINTS[index], b = SPECIAL_RING_POINTS[index + 1];
    points[0][0] = x + a[0] * inner; points[0][2] = z + a[1] * inner;
    points[1][0] = x + a[0] * outer; points[1][2] = z + a[1] * outer;
    points[2][0] = x + b[0] * outer; points[2][2] = z + b[1] * outer;
    points[3][0] = x + b[0] * inner; points[3][2] = z + b[1] * inner;
    // A marker paints the accepted ground. Do not bridge a wall, float
    // past a deck edge or imply a second attack downstairs.
    if (points.some(point => {
      const ground = surfaceBelow(colliders, point[0], point[2], y + .04);
      return Math.abs((ground ? ground.y + ground.h : 0) - y) > .06 || map.bounds && (point[0] < map.bounds.minX || point[0] > map.bounds.maxX || point[2] < map.bounds.minZ || point[2] > map.bounds.maxZ);
    }) || quadTouchesCover(points, colliders)) continue;
    mesh.quad(...points, normal, color);
  }
}
function specialWarning(mesh, map, attack, radius, color, reducedMotion) {
  const progress = clamp(1 - attack.ticksLeft / attack.lifeTicks, 0, 1);
  const alpha = reducedMotion ? .48 : .56 + progress * .26;
  groundWarningRing(mesh, map, attack.x, attack.y, attack.z, radius - .09, radius, [...color, alpha]);
  const countdown = radius * (.16 + progress * .76);
  groundWarningRing(mesh, map, attack.x, attack.y, attack.z, Math.max(.03, countdown - .045), countdown, [...color, reducedMotion ? .28 : .34]);
}
function monsterSpecialParts(world, contacts, state, map, { reducedMotion = false } = {}) {
  const startWorld = world.length, startContacts = contacts.length;
  let shards = 0, runes = 0, fuses = 0;
  if (state.gameId !== 'voxel-horde') return { shards, runes, fuses, vertices: 0 };
  for (const projectile of (state.horde?.projectiles || []).slice(0, MONSTER_SPECIAL_RULES.maxProjectiles)) {
    if (!specialSource(state, projectile, 'spitter') || !validSpecialTimer(projectile, MONSTER_SPECIAL_RULES.shardTicks) || ![projectile.dx, projectile.dy, projectile.dz].every(Number.isFinite)) continue;
    const direction = normalized([projectile.dx, projectile.dy, projectile.dz], [0, 0, 0]);
    if (Math.hypot(...direction) < .5) continue;
    const pose = { x: projectile.x, y: projectile.y, z: projectile.z, yaw: Math.atan2(direction[0], -direction[2]), pitch: Math.asin(clamp(direction[1], -1, 1)) };
    const back = direction.map(value => -value), origin = [projectile.x, projectile.y, projectile.z];
    const length = Math.max(0, rayCoverDistance(origin, back, map.colliders || [], .23, .026) - .014);
    if (length < .018) continue;
    // Its simulated point is the tip, and both small solids sit behind it.
    // There is no fake instantaneous beam or wall-clock extrapolation.
    world.box(-.022, -.022, .003, .044, .044, Math.min(.09, length), '#9bfff0', pose);
    if (length > .10) world.box(-.012, -.012, .09, .024, .024, length - .09, '#32b9b1', pose);
    shards++;
  }
  for (const hazard of (state.horde?.hazards || []).slice(0, MONSTER_SPECIAL_RULES.maxHazards)) {
    const source = specialSource(state, hazard, 'weaver'), target = state.players?.find(player => player.id === hazard.targetId);
    if (!source?.alive || !target?.alive || target.human !== true || actorLife(target) !== hazard.targetLifeId || !validSpecialTimer(hazard, MONSTER_SPECIAL_RULES.runeTicks) || hazard.radius !== MONSTER_SPECIAL_RULES.runeRadius) continue;
    specialWarning(contacts, map, hazard, MONSTER_SPECIAL_RULES.runeRadius, [.79, .58, 1], reducedMotion); runes++;
  }
  for (const source of state.players || []) {
    if (fuses >= 4) break;
    if (!source.alive || source.monster !== true || source.monsterType !== 'bomber' || source.monsterState !== 'bomberFuse' || ![source.x, source.y, source.z, source.attackTicks, source.attackDuration].every(Number.isFinite) || source.attackTicks <= 0 || source.attackDuration !== 90 || source.attackTicks > source.attackDuration) continue;
    const support = surfaceBelow(map.colliders || [], source.x, source.z, source.y + .04), ground = support ? support.y + support.h : 0;
    specialWarning(contacts, map, { x: source.x, y: ground, z: source.z, ticksLeft: source.attackTicks, lifeTicks: source.attackDuration }, MONSTER_SPECIAL_RULES.blastRadius, [1, .51, .24], reducedMotion); fuses++;
  }
  return { shards, runes, fuses, vertices: (world.length - startWorld + contacts.length - startContacts) / VERTEX_STRIDE };
}

/** The same bounded, depth-tested special geometry used by actual frames. */
export function monsterSpecialMeshes(state, map, options = {}) {
  const world = new Mesh(), contacts = new Mesh(), stats = monsterSpecialParts(world, contacts, state, map, options);
  return { world: world.array, contacts: contacts.array, ...stats };
}

export function createMonsterSpecialImpactPresenter() {
  const seen = new Map();
  const present = (event, state, time, { reducedMotion = false } = {}) => {
    const blast = event.type === 'monsterBlast', rune = event.type === 'monsterMark' && event.stage === 'release', shard = event.type === 'monsterShardImpact';
    if ((!blast && !rune && !shard) || ![event.x, event.y, event.z, event.tick, time].every(Number.isFinite) || event.tick > state.tick + 1 || state.tick - event.tick > 18 || !specialSource(state, event, blast ? 'bomber' : rune ? 'weaver' : 'spitter')) return [];
    const key = `${event.playerId}:${event.sourceLifeId}:${event.type}:${event.specialId ?? event.spawnTick ?? event.tick}:${event.x}:${event.y}:${event.z}`;
    if (seen.has(key)) return [];
    seen.set(key, true); while (seen.size > 128) seen.delete(seen.keys().next().value);
    if (reducedMotion) return [];
    const count = shard ? 4 : 12, origin = [event.x, event.y + (shard ? 0 : .04), event.z];
    return Array.from({ length: count }, (_, index) => {
      const angle = index * 2.39996, spread = shard ? .45 : 1 + index % 3 * .18;
      return { origin, born: time, vx: Math.sin(angle) * spread, vy: shard ? .25 : .6 + index % 3 * .16, vz: Math.cos(angle) * spread,
        color: shard ? '#8ce7d4' : rune ? index % 3 ? '#b497e0' : '#ead7ff' : index % 3 ? '#f2a156' : '#ffe6a1',
        life: shard ? 150 : 220 + index * 8, gravity: 3, cover: true, radius: shard ? .22 : .8, size: shard ? .012 : .02, shrink: true, material: 'monster-special' };
    });
  };
  present.reset = () => seen.clear();
  present.getStats = () => ({ seenContacts: seen.size, capacity: 128 });
  return present;
}

const GLYPHS = Object.freeze({
  A: ['01110','10001','10001','11111','10001','10001','10001'], B: ['11110','10001','10001','11110','10001','10001','11110'],
  C: ['01111','10000','10000','10000','10000','10000','01111'], D: ['11110','10001','10001','10001','10001','10001','11110'],
  E: ['11111','10000','10000','11110','10000','10000','11111'], F: ['11111','10000','10000','11110','10000','10000','10000'],
  G: ['01111','10000','10000','10111','10001','10001','01111'], H: ['10001','10001','10001','11111','10001','10001','10001'],
  I: ['111','010','010','010','010','010','111'], L: ['10000','10000','10000','10000','10000','10000','11111'],
  M: ['10001','11011','10101','10101','10001','10001','10001'], N: ['10001','11001','10101','10011','10001','10001','10001'],
  O: ['01110','10001','10001','10001','10001','10001','01110'], P: ['11110','10001','10001','11110','10000','10000','10000'],
  R: ['11110','10001','10001','11110','10100','10010','10001'], S: ['01111','10000','10000','01110','00001','00001','11110'],
  T: ['11111','00100','00100','00100','00100','00100','00100'], U: ['10001','10001','10001','10001','10001','10001','01110'],
  V: ['10001','10001','10001','10001','10001','01010','00100'], W: ['10001','10001','10001','10101','10101','10101','01010'],
  X: ['10001','10001','01010','00100','01010','10001','10001'], Y: ['10001','10001','01010','00100','00100','00100','00100'],
  '0': ['01110','10001','10011','10101','11001','10001','01110'], '1': ['010','110','010','010','010','010','111'],
  '2': ['01110','10001','00001','00010','00100','01000','11111'], '3': ['11110','00001','00001','01110','00001','00001','11110'],
  '4': ['10010','10010','10010','11111','00010','00010','00010'], '5': ['11111','10000','10000','11110','00001','00001','11110'],
  '6': ['01110','10000','10000','11110','10001','10001','01110'], '7': ['11111','00001','00010','00100','01000','01000','01000'],
  '8': ['01110','10001','10001','01110','10001','10001','01110'], '9': ['01110','10001','10001','01111','00001','00001','01110'],
  '<': ['00100','01000','10000','11111','10000','01000','00100'], '>': ['00100','00010','00001','11111','00001','00010','00100'],
});

function wallPatch(mesh, collider, face, left, bottom, width, height, color, offset = .015) {
  if (width <= 0 || height <= 0) return;
  const { x, y, z, w, d } = collider, c = rgba(color), low = y + bottom, high = low + height;
  // Every patch is paint directly on an existing solid face. It never adds a
  // protruding prop, a fake doorway or an uncollidable sight-line obstruction.
  if (face === 'south') mesh.quad([x + left + width, low, z + d + offset], [x + left + width, high, z + d + offset], [x + left, high, z + d + offset], [x + left, low, z + d + offset], [0, 0, 1], c);
  if (face === 'north') mesh.quad([x + left, low, z - offset], [x + left, high, z - offset], [x + left + width, high, z - offset], [x + left + width, low, z - offset], [0, 0, -1], c);
  if (face === 'west') mesh.quad([x - offset, low, z + left + width], [x - offset, high, z + left + width], [x - offset, high, z + left], [x - offset, low, z + left], [-1, 0, 0], c);
  if (face === 'east') mesh.quad([x + w + offset, low, z + left], [x + w + offset, high, z + left], [x + w + offset, high, z + left + width], [x + w + offset, low, z + left + width], [1, 0, 0], c);
}

function wallText(mesh, collider, face, text, left, bottom, height, color, offset = .026) {
  const pixel = height / 7, reversed = face === 'north' || face === 'east';
  const glyphs = [...text].map(character => GLYPHS[character.toUpperCase()]);
  const total = glyphs.reduce((sum, glyph) => sum + (glyph ? glyph[0].length + 1 : 3), 0) - 1;
  let cursor = 0;
  for (const rows of glyphs) {
    if (rows) for (let row = 0; row < rows.length; row++) for (let column = 0; column < rows[row].length; column++) {
      if (rows[row][column] === '1') wallPatch(mesh, collider, face, left + (reversed ? total - cursor - column - 1 : cursor + column) * pixel, bottom + (6 - row) * pixel, pixel * .88, pixel * .88, color, offset);
    }
    cursor += rows ? rows[0].length + 1 : 3;
  }
}

function siteSign(mesh, collider, siteId) {
  const color = siteId === 'A' ? '#ecb964' : '#64c9bc', dark = '#263b3e';
  for (const face of ['north', 'south', 'west', 'east']) {
    const width = face === 'north' || face === 'south' ? collider.w : collider.d;
    if (width < .8) continue;
    const size = Math.min(.83, width - .22), left = (width - size) / 2;
    wallPatch(mesh, collider, face, left, 1.42, size, 1.02, dark, .025);
    wallPatch(mesh, collider, face, left + .04, 1.47, size - .08, .065, color, .028);
    wallText(mesh, collider, face, siteId, left + (size - .50) / 2, 1.67, .70, color, .03);
  }
}

function paintRoyaleCollider(mesh, collider, theme) {
  const { x, y, z, w, h, d } = collider;
  const color = rgba(collider.color || (theme === 'desert' ? '#c8a574' : theme === 'forest' ? '#6f7c52' : '#8c9788'));
  const material = String(collider.material || 'stone').toLowerCase();
  const id = String(collider.id || ''), dark = mix(color, rgba('#263b33'), .31), pale = mix(color, rgba('#ead7ae'), .25);
  // The complete base box is always emitted; painted detail can never erase
  // collision surfaces or replace a physical doorway with decoration.
  mesh.box(x, y, z, w, h, d, color);
  if (h < .12) return;
  const leaves = /foliage|leaves|leaf|canopy/.test(`${material}:${id}`);
  const trunk = /bark|trunk/.test(`${material}:${id}`);
  if (theme === 'dojo' && !leaves && !trunk) {
    for (const face of ['north', 'south', 'west', 'east']) {
      const width = face === 'north' || face === 'south' ? w : d;
      const patch = (left, bottom, ww, hh, tint, offset = .004) => {
        if (left >= .012 && bottom >= .012 && left + ww <= width - .012 && bottom + hh <= h - .012) wallPatch(mesh, collider, face, left, bottom, ww, hh, tint, offset);
      };
      if (material === 'shoji' && width > .5) {
        // Cedar lattice is paint on the real opaque paper screen, preserving
        // its exact cover silhouette and every open doorway in the hall.
        for (let left = .08; left < width - .04; left += .52) patch(left, .04, .025, h - .08, '#785a40');
        for (let bottom = .08; bottom < h - .04; bottom += .60) patch(.04, bottom, width - .08, .025, '#785a40');
        patch(.025, .025, .045, h - .05, '#664c35', .006);
        patch(width - .07, .025, .045, h - .05, '#664c35', .006);
      } else if (material === 'dojo-cedar' || material === 'torii') {
        const grain = material === 'torii' ? '#762f24' : '#65442f';
        for (const fraction of [.22, .54, .79]) patch(width * fraction, .035, Math.min(.018, width * .04), h - .07, grain);
        if (material === 'torii') patch(.025, .035, width - .05, Math.min(.21, h * .20), '#353e3a', .006);
        else if (width > 1) for (let left = .26; left < width - .30; left += .74) patch(left, h * .46, Math.min(.31, width - left - .02), .009, '#be9566', .005);
      } else if (material === 'dojo-plaster') {
        patch(.035, .035, width - .07, Math.min(.22, h * .10), '#75583d');
        patch(.035, h - .20, width - .07, .080, '#897257');
        for (let left = 3.1; left < width - .05; left += 4.8) patch(left, .10, .020, h - .25, '#b3a38b');
      } else if (material === 'dojo-roof') {
        for (let left = .13; left < width - .05; left += .48) patch(left, .025, .028, h - .05, '#6f7972');
        patch(.035, .025, width - .07, .018, '#242e2c');
      } else if (material === 'lantern') {
        patch(.04, .055, width - .08, h - .11, '#ecd3a1');
        patch(width * .47, .055, Math.min(.025, width * .05), h - .11, '#725d44', .006);
      }
    }
    if (material === 'dojo-cedar' && w > 1 && d > .5) for (let zz = .15; zz < d - .08; zz += .22) mesh.floor(x + .035, z + zz, w - .07, .012, '#6f4c31', y + h + .004);
    return;
  }
  for (const face of ['north', 'south', 'west', 'east']) {
    const width = face === 'north' || face === 'south' ? w : d;
    const patch = (left, bottom, ww, hh, tint, offset = .004) => {
      if (left >= .015 && bottom >= .015 && left + ww <= width - .015 && bottom + hh <= h - .015) wallPatch(mesh, collider, face, left, bottom, ww, hh, tint, offset);
    };
    if (leaves) {
      // Interlocking leaf clusters retain the real cuboid canopy silhouette.
      // Warm upper edges and cool low pockets give foliage depth without
      // adding branches or transparent cover that the engine cannot hit.
      for (let i = 0; i < 4; i++) {
        const seed = hash(`${id}:${face}:${i}`), left = width * (.06 + i * .22);
        const bottom = h * (.12 + (seed % 4) * .15), ww = width * .18, hh = h * .18;
        patch(left, bottom, ww, hh, i % 2 ? mix(color, rgba(theme === 'dojo' ? '#865368' : '#123d34'), .28) : mix(color, rgba(theme === 'dojo' ? '#ffe3db' : '#a5b66f'), .30));
        patch(left + ww * .20, bottom + hh, ww * .57, hh * .35, mix(color, rgba(theme === 'dojo' ? '#ffe5dc' : '#b9c984'), .23));
      }
    } else if (trunk) {
      for (const fraction of [.16, .43, .76]) {
        patch(width * fraction, .035, Math.min(.048, width * .08), h - .07, dark);
        patch(width * fraction + .045, .12, Math.min(.024, width * .045), h - .24, pale, .005);
      }
      const knotY = h * (.37 + hash(id + face) % 3 * .08), knotX = width * .47;
      patch(knotX - .055, knotY, .11, .18, dark, .006);
      patch(knotX - .024, knotY + .045, .048, .09, '#ad8158', .007);
      patch(.025, .02, width - .05, Math.min(.32, h * .18), mix(color, rgba('#698356'), .43), .008);
    } else if (/wood|crate/.test(material)) {
      const rows = clamp(Math.round(h / .42), 1, theme === 'paris' ? 4 : 7);
      for (let i = 0; i < rows; i++) {
        const bottom = h * i / rows + .023, boardHeight = h / rows - .046;
        patch(.025, bottom, width - .05, boardHeight, shade(color, .90 + hash(`${id}:${face}:board:${i}`) % 4 * .065));
        if (width > .8 && boardHeight > .09 && (theme !== 'paris' || i % 2 === 0)) patch(width * (.16 + i % 3 * .17), bottom + boardHeight * .48, Math.min(width * .34, .90), .012, dark, .005);
      }
      if (!/roof/.test(id)) for (const fraction of [.13, .84]) {
        patch(width * fraction, .045, Math.min(.065, width * .06), h - .09, pale, .006);
        for (const bottom of theme === 'paris' ? [fraction < .5 ? .11 : h - .15] : [.11, h - .15]) patch(width * fraction + .017, bottom, .022, .022, '#3d4136', .008);
      }
      if (/fallen/.test(id) && width < 1.2 && h > .4) {
        patch(width * .12, h * .16, width * .76, h * .67, '#b79967', .009);
        patch(width * .21, h * .23, width * .58, h * .53, '#805c3d', .010);
        patch(width * .29, h * .31, width * .42, h * .37, '#c0a176', .011);
        patch(width * .41, h * .40, width * .18, h * .19, '#966d48', .012);
      }
    } else {
      // Broad stone blocks use a bounded number of masonry seams. A 200-box
      // survival map must not inherit the city renderer's dense window art.
      const rows = clamp(Math.round(h / .72), 1, 4);
      for (let i = 1; i < rows; i++) {
        patch(.02, h * i / rows, width - .04, .016, dark);
        for (const fraction of [.26, .66]) patch(width * fraction + (i % 2) * .11, h * (i - 1) / rows + .025, .015, Math.max(.01, h / rows - .04), dark);
      }
      if (h > 1.1 && width > .65) {
        patch(.03, h - .18, width - .06, .055, pale);
        patch(.03, .08, width - .06, .055, dark);
        if (theme === 'desert' && /temple|column|pyramid|shrine|obelisk|gate/.test(id)) {
          const turquoise = mix(color, rgba('#428f91'), .58);
          const bandY = Math.min(h * .64, h - .27);
          patch(.03, bandY, width - .06, .12, turquoise, .006);
          for (let left = .16; left < width - .20; left += .58) {
            patch(left, bandY + .025, .16, .022, '#efd59a', .008);
            patch(left + .07, bandY + .047, .025, .055, '#efd59a', .008);
          }
          if (/column|obelisk/.test(id) && h > 2) for (const bottom of [.55, 1.12, 1.69]) {
            patch(width / 2 - .10, bottom, .20, .027, dark, .006);
            patch(width / 2 - .022, bottom - .12, .044, .24, dark, .006);
            patch(width / 2 - .075, bottom + .095, .15, .04, pale, .007);
          }
        } else if (theme === 'maze' && !id.startsWith('boundary') && width > 1.8) {
          const bandY = Math.min(h * .57, h - .40), moss = mix(color, rgba('#4f7769'), .46);
          patch(.04, bandY, width - .08, .24, moss, .006);
          for (let left = .18; left < width - .35; left += .72) {
            patch(left, bandY + .04, .29, .025, pale, .008);
            patch(left, bandY + .04, .025, .12, pale, .008);
            patch(left + .265, bandY + .04, .025, .12, pale, .008);
            patch(left + .10, bandY + .16, .29, .025, pale, .008);
          }
        }
      }
      // Local chips and moss remain tonal paint on the same collision face.
      if (width > 1 && h > .5 && !id.startsWith('boundary')) for (let i = 0; i < 2; i++) {
        const seed = hash(`${id}:${face}:weather:${i}`);
        patch(width * (.14 + i * .48), .17 + (seed % 5) * Math.min(.13, h * .08), Math.min(.45, width * .17), .08, theme === 'maze' ? mix(color, rgba('#658269'), .42) : pale, .009);
      }
    }
  }
  if (leaves) {
    for (let row = 0; row < 2; row++) for (let column = 0; column < 3; column++) mesh.floor(x + w * (.04 + column * .32), z + d * (.04 + row * .47), w * .27, d * .40, shade(color, .94 + (column + row) % 3 * .09), y + h + .002);
  } else if (/roof/.test(id) && material === 'wood') {
    mesh.floor(x + .025, z + .025, w - .05, d - .05, '#496c61', y + h + .002);
    for (let left = .24; left < w - .10; left += .82) mesh.floor(x + left, z + .045, .025, d - .09, '#789389', y + h + .003);
  } else {
    mesh.floor(x + .025, z + .025, Math.max(.01, w - .05), Math.max(.01, d - .05), pale, y + h + .002);
    if (/wood|crate/.test(material) && w > .6 && d > .6) for (let row = .22; row < d - .08; row += .43) mesh.floor(x + .045, z + row, w - .09, .018, dark, y + h + .003);
  }
}

function paintParisCollider(mesh, collider) {
  const { x, y, z, w, h, d } = collider, id = String(collider.id || '');
  const material = String(collider.material || 'stone').toLowerCase();
  if (id.startsWith('paris-bus-stop-')) {
    mesh.box(x, y, z, w, h, d, collider.color);
    for (const face of ['north', 'south', 'west', 'east']) {
      const width = face === 'north' || face === 'south' ? w : d;
      wallPatch(mesh, collider, face, .04, .09, width - .08, .065, '#354e49', .004);
      wallPatch(mesh, collider, face, .07, .58, width - .14, 1.04, '#d9d6be', .005);
      const routeWidth = Math.max(.04, width - .32);
      wallPatch(mesh, collider, face, .16, .86, routeWidth, .025, '#738f75', .008);
      wallPatch(mesh, collider, face, width / 2 - .012, .74, .024, .52, '#877ca0', .008);
      for (const fraction of [.29, .52, .77]) wallPatch(mesh, collider, face, width / 2 - .032, .74 + fraction * .52, .064, .037, '#47665f', .010);
      wallPatch(mesh, collider, face, .07, 1.78, width - .14, .32, '#334f49', .005);
      const label = width > 1 ? 'METRO' : 'M', height = .23, textWidth = (label.length * 6 - 1) * height / 7;
      wallText(mesh, collider, face, label, (width - textWidth) / 2, 1.82, height, '#e6d1a0', .011);
      wallPatch(mesh, collider, face, .04, h - .065, width - .08, .025, '#c0b486', .008);
    }
    return;
  }
  if (id === 'paris-bus-body' || id === 'paris-bus-top') {
    mesh.box(x, y, z, w, h, d, collider.color);
    if (id === 'paris-bus-top') {
      mesh.floor(x + .19, z + .18, w - .38, d - .36, '#b6beb4', y + h + .002);
      for (const zz of [z + .55, z + d - 1.1]) {
        mesh.floor(x + .68, zz, w - 1.36, .54, '#768d89', y + h + .003);
        for (let row = 0; row < 4; row++) mesh.floor(x + .73, zz + .08 + row * .10, w - 1.46, .022, '#adbcb1', y + h + .004);
      }
      for (const face of ['north', 'south', 'east', 'west']) wallPatch(mesh, collider, face, .07, .07, (face === 'north' || face === 'south' ? w : d) - .14, .06, '#829c95', .006);
      return;
    }
    for (const face of ['east', 'west']) {
      wallPatch(mesh, collider, face, .05, .68, d - .10, .13, '#e0decb', .004);
      wallPatch(mesh, collider, face, .05, .10, d - .10, .09, '#345e60', .005);
      for (let left = .36; left < d - .70; left += .90) {
        wallPatch(mesh, collider, face, left, .94, .74, .58, '#203b42', .006);
        wallPatch(mesh, collider, face, left + .045, 1.00, .65, .45, '#668e95', .008);
        wallPatch(mesh, collider, face, left + .06, 1.30, .62, .07, '#a6c0bc', .010);
        wallPatch(mesh, collider, face, left + .36, 1.00, .03, .45, '#b2c6bd', .011);
      }
      // Sliding passenger doors are paint on solid vehicle cover, with narrow
      // frames and a handle; no open-door silhouette suggests a walk-in bus.
      const doorLeft = d - 1.19;
      wallPatch(mesh, collider, face, doorLeft, .27, .82, 1.20, '#356368', .012);
      wallPatch(mesh, collider, face, doorLeft + .065, .83, .69, .57, '#668e95', .014);
      wallPatch(mesh, collider, face, doorLeft + .39, .30, .025, 1.09, '#d7d9c5', .015);
      wallPatch(mesh, collider, face, doorLeft + .48, .68, .14, .025, '#dfd9bb', .016);
      for (const left of [.45, d - 1.0]) {
        wallPatch(mesh, collider, face, left, .05, .62, .43, '#283537', .007);
        wallPatch(mesh, collider, face, left + .17, .15, .28, .23, '#abb5b0', .009);
      }
      wallText(mesh, collider, face, 'BUS', d / 2 - .33, .31, .25, '#e4dfbc', .011);
    }
    for (const face of ['north', 'south']) {
      wallPatch(mesh, collider, face, .24, .80, w - .48, .71, '#203b42', .006);
      wallPatch(mesh, collider, face, .31, .87, w - .62, .55, '#668e95', .008);
      wallPatch(mesh, collider, face, .36, 1.29, w - .72, .06, '#a9c3bd', .010);
      wallPatch(mesh, collider, face, .05, .10, w - .10, .08, '#345357', .010);
      wallPatch(mesh, collider, face, w / 2 - .10, .18, .20, .09, '#d2d6c4', .012);
      wallPatch(mesh, collider, face, w / 2 - .13, .40, .26, .12, '#e6ddc1', .006);
      for (const left of [.15, w - .38]) wallPatch(mesh, collider, face, left, .67, .23, .13, face === 'north' ? '#efe1b7' : '#b0715b', .008);
      wallPatch(mesh, collider, face, .34, 1.40, .58, .18, '#233936', .011);
      wallText(mesh, collider, face, '38', .39, 1.425, .13, '#e8d698', .013);
      for (const left of [.63, 1.32]) wallPatch(mesh, collider, face, left, .86, .38, .018, '#334d51', .012);
    }
    return;
  }
  if (/foliage|bark/.test(material)) return paintRoyaleCollider(mesh, collider, 'forest');
  if (/wood|crate|metal/.test(material)) {
    paintRoyaleCollider(mesh, collider, 'paris');
    if (/terrace-table/.test(id)) {
      mesh.floor(x + .08, z + .08, w - .16, d - .16, '#d0c4aa', y + h + .004);
      for (let row = .25; row < d - .10; row += .35) mesh.floor(x + .12, z + row, w - .24, .013, '#abac97', y + h + .005);
      mesh.floor(x + .16, z + .16, .48, .27, '#715652', y + h + .006);
      mesh.floor(x + w - .55, z + d - .42, .39, .23, '#715652', y + h + .006);
    } else if (/bench/.test(id)) {
      for (let row = .10; row < d - .05; row += .20) mesh.floor(x + .05, z + row, w - .10, .025, '#564937', y + h + .004);
    }
    return;
  }
  const slate = material === 'slate' || /roof/.test(id), chimney = /chimney/.test(id);
  const color = rgba(collider.color || (slate ? '#536574' : '#d6c7ae'));
  mesh.box(x, y, z, w, h, d, color);
  if (h < .08) return;
  const dark = mix(color, rgba(slate ? '#253b48' : '#887d6b'), .35), pale = mix(color, rgba('#f0e3c9'), .42);
  const buildingWall = /paris-(opera|atelier|cafe|librairie)-/.test(id) && !/climb|roof|chimney/.test(id);
  const innerFace = !buildingWall ? null : /-north-/.test(id) ? 'south' : /-south-/.test(id) ? 'north' : id.endsWith('-west') ? 'east' : id.endsWith('-east') ? 'west' : null;
  for (const face of ['north', 'south', 'west', 'east']) {
    const width = face === 'north' || face === 'south' ? w : d;
    if (width < .12) continue;
    const patch = (left, bottom, patchWidth, patchHeight, tint, offset = .005) => {
      // Thin lintels and split door jambs receive only paint that fits their
      // actual face. Detail must never bridge a doorway or shifted roof tier.
      if (left >= .02 && bottom >= .02 && left + patchWidth <= width - .02 && bottom + patchHeight <= h - .02) wallPatch(mesh, collider, face, left, bottom, patchWidth, patchHeight, tint, offset);
    };
    if (slate) {
      patch(.03, Math.max(.03, h * .15), width - .06, Math.min(.05, h * .18), '#85959d');
      for (let left = .32; left < width - .10; left += 1.25) patch(left, .04, .016, Math.max(.01, h - .08), dark);
      continue;
    }
    if (face === innerFace) {
      // Interior walls deliberately differ from the street frontage. Panelled
      // skirting and warm plaster sit on the actual inner collision faces.
      patch(.025, .025, width - .05, h - .05, '#dfd0b4', .003);
      if (y < .1) {
        patch(.03, .04, width - .06, .69, '#9a927b', .005);
        patch(.03, .71, width - .06, .055, '#786e5b', .006);
        for (let left = .16; left < width - .30; left += .85) patch(left, .11, .022, .52, '#b6ab91', .007);
      }
      patch(.03, h - .15, width - .06, .06, pale, .006);
      continue;
    }
    patch(.03, .04, width - .06, Math.min(.13, h / 4), dark);
    patch(.03, h - .16, width - .06, .08, pale);
    // Align cornices and window rows in world coordinates, including the
    // separate left/right pieces around each genuine open entrance.
    for (let level = 1.45; level < y + h; level += 1.9) patch(.03, level - y, width - .06, .045, pale);
    if (!buildingWall) {
      const course = chimney ? .24 : .72;
      for (let level = Math.ceil((y + .02) / course) * course; level < y + h; level += course) patch(.03, level - y, width - .06, .012, dark);
      if (chimney) for (let left = .24; left < width - .09; left += .40) patch(left, .04, .014, h - .08, dark);
      continue;
    }
    // Dressed limestone courses use a shared world grid on neighboring jambs.
    for (const level of [.62, 1.18, 1.78, 3.30]) patch(.03, level - y, width - .06, .012, dark);
    const origin = face === 'north' || face === 'south' ? x : z, spacing = 2.6;
    for (let left = Math.ceil((origin + .12) / 1.3) * 1.3 - origin; left < width - .06; left += 1.3) {
      patch(left, Math.max(.03, .10 - y), .012, Math.min(.47, h - .06), dark);
      patch(left + .18, 1.18 - y, .012, .56, dark);
    }
    for (const left of [.07, width - .15]) {
      patch(left, .20, .07, Math.max(.01, h - .48), pale, .006);
      patch(left + .02, .20, .015, Math.max(.01, h - .48), dark, .007);
    }
    const first = Math.ceil((origin + .23) / spacing) * spacing - origin;
    for (let left = first; left + 1.02 < width - .20; left += spacing) {
      for (let level = 2.12; level + 1.09 < y + h; level += 1.9) {
        const bottom = level - y;
        if (bottom < .05) continue;
        patch(left, bottom, .98, 1.04, '#756f65', .005);
        patch(left + .08, bottom + .07, .82, .88, '#4c6672', .008);
        patch(left + .09, bottom + .60, .79, .065, '#8da6aa', .011);
        patch(left + .465, bottom + .07, .045, .88, pale, .012);
        patch(left + .08, bottom + .47, .82, .038, pale, .012);
        for (const shutter of [left + .04, left + .88]) {
          patch(shutter, bottom + .05, .06, .95, '#506e66', .013);
          for (let line = 0; line < 3; line++) patch(shutter, bottom + .22 + line * .22, .06, .012, '#a0b4a1', .014);
        }
        // Wrought-iron balcony impressions are surface paint, not invisible
        // protruding platforms that players could mistake for jump targets.
        patch(left + .02, bottom - .025, .94, .035, '#293e40', .018);
        for (const fraction of [.12, .39, .66, .86]) patch(left + fraction, bottom + .01, .024, .20, '#293e40', .019);
        patch(left + .02, bottom + .19, .94, .035, '#293e40', .020);
        patch(left - .03, bottom - .08, 1.04, .045, pale, .016);
      }
    }
  }
  if (slate && w > .2 && d > .2) {
    for (let row = .08, index = 0; row < d - .12; row += .62, index++) {
      const depth = Math.min(.58, d - row - .06);
      mesh.floor(x + .07, z + row, w - .14, depth, shade(color, index % 2 ? 1.055 : .97), y + h + .002);
      mesh.floor(x + .07, z + row + depth - .022, w - .14, .022, dark, y + h + .003);
      for (let column = .25 + index % 2 * .59; column < w - .10; column += 1.18) mesh.floor(x + column, z + row, .014, depth, '#8b9c9f', y + h + .004);
    }
    for (const zz of [z + .03, z + d - .08]) mesh.floor(x + .03, zz, w - .06, .05, '#a2afa9', y + h + .005);
    for (const xx of [x + .03, x + w - .08]) mesh.floor(xx, z + .03, .05, d - .06, '#a2afa9', y + h + .005);
  }
  if (/planter/.test(id) && w > .20 && d > .20) {
    mesh.floor(x + .08, z + .08, w - .16, d - .16, '#617b54', y + h + .002);
    for (let i = 0; i < 7; i++) mesh.floor(x + .15 + i % 3 * (w - .30) / 3, z + .15 + Math.floor(i / 3) * (d - .30) / 3, .055, .055, i % 2 ? '#d6c292' : '#b68f7d', y + h + .003);
  }
}

function paintExpansionCollider(mesh, collider, theme) {
  const { x, y, z, w, h, d } = collider, id = String(collider.id || ''), material = String(collider.material || 'concrete');
  const color = rgba(collider.color || (theme === 'snow' ? '#89a5b3' : theme === 'sewers' ? '#707a65' : '#9aa7b3'));
  const dark = mix(color, rgba('#23363e'), .48), pale = mix(color, rgba('#e7eef0'), .50);
  mesh.box(x, y, z, w, h, d, color);
  // Finishes hug their real solid; snow, drain grilles, screens and glass do
  // not introduce a lip, phantom obstacle, or see-through opening in cover.
  const faces = ['north', 'south', 'west', 'east'];
  const patch = (face, left, bottom, ww, hh, tint, offset = .006) => {
    const width = face === 'north' || face === 'south' ? w : d;
    const xx = clamp(left, .008, Math.max(.008, width - .008)), yy = clamp(bottom, .008, Math.max(.008, h - .008));
    const pw = Math.min(ww, width - xx - .008), ph = Math.min(hh, h - yy - .008);
    if (pw > .006 && ph > .006) wallPatch(mesh, collider, face, xx, yy, pw, ph, tint, offset);
  };
  if (/ceiling/.test(material) || theme === 'sewers' && collider.overhead && /roof/.test(material)) {
    const underside = (xx, zz, ww, dd, tint, offset = .004) => mesh.quad([xx, y - offset, zz], [xx + ww, y - offset, zz], [xx + ww, y - offset, zz + dd], [xx, y - offset, zz + dd], [0, -1, 0], rgba(tint));
    if (theme === 'sewers') {
      // Brick collectors have longitudinal vault joints and sparse amber work
      // lights. No office tile grid appears in these low maintenance tunnels.
      underside(x + .01, z + .01, w - .02, d - .02, '#554e40');
      const alongZ = d > w, length = alongZ ? d : w;
      for (let at = .55; at < length - .15; at += 1.8) {
        if (alongZ) underside(x + .03, z + at, w - .06, .035, '#343b33', .005);
        else underside(x + at, z + .03, .035, d - .06, '#343b33', .005);
      }
      const lamps = Math.max(1, Math.ceil(length / 8));
      for (let i = 0; i < lamps; i++) {
        const cx = alongZ ? x + w / 2 : x + length * (i + .5) / lamps;
        const cz = alongZ ? z + length * (i + .5) / lamps : z + d / 2;
        const lw = Math.min(.85, w - .1), ld = Math.min(.27, d - .1);
        underside(cx - lw / 2, cz - ld / 2, lw, ld, '#313f37', .006);
        underside(cx - lw / 2 + .045, cz - ld / 2 + .045, lw - .09, ld - .09, '#ffe0a0', .008);
      }
    } else {
      for (let xx = .03; xx < w - .03; xx += 3.2) for (let zz = .03; zz < d - .03; zz += 3.2) {
        const ww = Math.min(3.16, w - xx - .03), dd = Math.min(3.16, d - zz - .03);
        if (Math.min(ww, dd) <= .03) continue;
        underside(x + xx, z + zz, ww, dd, '#dbdbd2');
        if (ww > 2 && dd > 1) {
          underside(x + xx + .4, z + zz + .65, Math.min(2.2, ww - .7), .36, '#8a8c85', .006);
          underside(x + xx + .44, z + zz + .69, Math.min(2.12, ww - .78), .28, '#fff7e8', .008);
        }
      }
    }
    return;
  }
  if (material === 'water') {
    mesh.floor(x + .008, z + .008, w - .016, d - .016, '#3f5142', y + h + .012);
    const alongZ = d > w, length = alongZ ? d : w;
    for (let line = .30; line < length - .04; line += .80) {
      if (alongZ) mesh.floor(x + .06, z + line, w - .12, .016, line % 2 < 1 ? '#78836b' : '#5f6e59', y + h + .014);
      else mesh.floor(x + line, z + .06, .016, d - .12, line % 2 < 1 ? '#78836b' : '#5f6e59', y + h + .014);
    }
    return;
  }
  if (theme === 'snow') {
    const foliage = material === 'foliage', bark = /bark|trunk/.test(material + id), roof = /roof/.test(material + id);
    if (!bark) {
      mesh.floor(x + .012, z + .012, Math.max(.01, w - .024), Math.max(.01, d - .024), foliage ? '#d4e3e4' : '#eef4f7', y + h + .005);
      if (w > .45 && d > .45) mesh.floor(x + w * .15, z + d * .17, w * .44, d * .17, '#d9e7ed', y + h + .006);
    }
    if (/radar/.test(material)) {
      for (const face of faces) {
        const width = face === 'north' || face === 'south' ? w : d;
        patch(face, .02, .02, width - .04, h - .04, '#d9e5e7', .003);
        for (let band = .22; band < h - .04; band += .42) {
          patch(face, .03, band, width - .06, .015, '#93b1bd', .004);
          for (let seam = .25 + (Math.floor(band / .42) % 2) * .3; seam < width - .05; seam += .6) patch(face, seam, band, .014, Math.min(.39, h - band - .025), '#adc1c8', .004);
        }
        patch(face, width * .18, h * .23, width * .12, h * .14, '#f1f6f6', .005);
      }
      return;
    }
    if (/antenna|weather-equipment|laboratory-desk/.test(material) || /generator/.test(id)) {
      for (const face of faces) {
        const width = face === 'north' || face === 'south' ? w : d;
        patch(face, .025, .025, width - .05, h - .05, /antenna/.test(material) ? '#637b87' : '#b89158', .003);
        if (width > .6 && h > .5) {
          patch(face, width * .20, h * .24, width * .60, h * .48, '#3b5660', .005);
          for (let row = 0; row < 4; row++) patch(face, width * .27, h * .29 + row * h * .09, width * .34, .025, '#7eadaf', .006);
          patch(face, width * .68, h * .32, width * .05, h * .23, '#e5bc7a', .006);
        } else patch(face, .035, h * .68, width - .07, .04, '#edf0df', .005);
      }
      return;
    }
    if (/snow-bank/.test(material)) {
      for (const face of faces) {
        const width = face === 'north' || face === 'south' ? w : d;
        patch(face, .01, .015, width - .02, h * .36, '#9fbdcd', .003);
        patch(face, .01, h * .34, width - .02, h * .31, '#c7dce4', .004);
        patch(face, width * .16, h * .68, width * .43, h * .17, '#e5eff2', .004);
      }
      return;
    }
    for (const face of faces) {
      const width = face === 'north' || face === 'south' ? w : d;
      if (foliage) {
        patch(face, .02, h - Math.min(.19, h * .20), width - .04, .16, '#d6e5e7');
        for (const fraction of [.22, .70]) patch(face, width * fraction, h * .36, width * .18, h * .20, '#618976', .005);
      } else if (bark) {
        for (const fraction of [.18, .48, .76]) patch(face, width * fraction, .07, .017, h - .14, '#4e6058');
      } else if (roof) {
        patch(face, .01, h - Math.min(.10, h * .35), width - .02, .08, '#eef5f7');
        patch(face, .01, .025, width - .02, .024, '#526d7b');
      } else if (/wood|crate/.test(material)) {
        const rows = clamp(Math.round(h / .30), 1, 7);
        for (let row = 1; row < rows; row++) patch(face, .03, h * row / rows, width - .06, .016, dark);
        for (const fraction of [.12, .84]) {
          patch(face, width * fraction, .055, .025, h - .11, '#b3c2c0');
          for (const bottom of [.10, h - .15]) patch(face, width * fraction, bottom, .022, .022, '#34474a', .009);
        }
      } else {
        patch(face, .03, .08, width - .06, .075, '#4e7387');
        patch(face, .03, h - .17, width - .06, .060, pale);
        for (let column = 1.2; column < width - .3; column += 1.8) patch(face, column, .19, .016, h - .34, dark);
        if (h > 2.5 && width > 2.3 && /wall/.test(material)) for (let left = .60; left < width - 1.1; left += 2.3) {
          patch(face, left, 1.30, .95, .91, '#435f70', .009);
          patch(face, left + .045, 1.345, .86, .82, '#bdab80', .010);
          patch(face, left + .075, 1.38, .79, .22, '#f0d7a0', .011);
          patch(face, left + .43, 1.345, .025, .82, '#dbe7ec', .012);
          patch(face, left + .045, 1.70, .86, .025, '#dbe7ec', .012);
        }
      }
    }
    return;
  }
  if (theme === 'sewers') {
    const brick = /brick|arch/.test(material + id), pipe = /pipe/.test(material + id);
    for (const face of faces) {
      const width = face === 'north' || face === 'south' ? w : d;
      if (brick) {
        // Large, staggered brick courses survive at FPS distance without
        // thousands of tiny boxes. Mortar remains flush against real masonry.
        const rows = clamp(Math.ceil(h / .43), 1, 10), columns = clamp(Math.ceil(width / 1.2), 1, 12);
        for (let row = 1; row < rows; row++) {
          patch(face, .012, h * row / rows, width - .024, .026, '#3c4036', .003);
          for (let column = 0; column < columns; column++) patch(face, (column + .2 + row % 2 * .5) * width / columns, h * (row - 1) / rows + .025, .020, h / rows - .05, '#46483d', .004);
        }
        patch(face, .018, .025, width - .036, Math.min(.24, h * .18), '#3a4b39', .005);
        for (const fraction of [.12, .61]) {
          const streak = Math.min(.48, width * .17), bottom = Math.min(.4, h * .14);
          patch(face, width * fraction, bottom, streak, Math.min(1.2, h * .62), '#59614a', .005);
          patch(face, width * fraction + streak * .3, bottom, streak * .36, Math.min(.73, h * .42), '#637255', .006);
        }
        if (h > 2 && width > 2.4 && !/arch/.test(id)) {
          const left = width * .42, bottom = Math.min(h - .65, 2.35);
          patch(face, left, bottom, .52, .25, '#303c32', .007);
          patch(face, left + .045, bottom + .05, .43, .15, '#f4c476', .009);
          for (let bar = .08; bar < .50; bar += .12) patch(face, left + bar, bottom + .01, .024, .23, '#5d6147', .010);
        }
      } else if (pipe) {
        const along = width > h;
        patch(face, .015, h * .15, width - .03, Math.max(.015, h * .10), '#4a5a4c', .004);
        patch(face, .015, h * .71, width - .03, Math.max(.015, h * .10), '#a5aa83', .004);
        for (let band = along ? .30 : .12; band < (along ? width : h) - .08; band += along ? 2.2 : 1.1) patch(face, along ? band : .012, along ? .018 : band, along ? .065 : width - .024, along ? h - .036 : .065, '#676f58', .009);
        if (Math.abs(width - h) < .3 && width > .4) {
          // Faceted cap is closed metal, not a black painted passage.
          patch(face, width * .20, h * .20, width * .60, h * .60, '#8d9575', .005);
          patch(face, width * .28, h * .28, width * .44, h * .44, '#778064', .007);
          for (const [u, v] of [[.22, .22], [.72, .22], [.22, .72], [.72, .72]]) patch(face, width * u, h * v, .035, .035, '#c4bea0', .008);
        }
      } else {
        patch(face, .02, .04, width - .04, .038, '#354638', .004);
        patch(face, .02, h - .08, width - .04, .032, '#b0aa86', .004);
        if (/control|pump|valve/.test(id) && width > .9 && h > .7) {
          patch(face, width * .18, h * .29, width * .64, h * .48, '#3f5047', .005);
          for (let index = 0; index < 3; index++) {
            patch(face, width * (.23 + index * .20), h * .58, Math.min(.07, width * .06), .05, index === 1 ? '#d3b557' : '#8cab73', .007);
            patch(face, width * (.23 + index * .20), h * .36, Math.min(.12, width * .09), .09, '#79886b', .007);
          }
        }
      }
    }
    if (/roof|grate|catwalk|bridge/.test(material + id)) {
      const top = y + h;
      mesh.floor(x + .012, z + .012, Math.max(.01, w - .024), Math.max(.01, d - .024), /grate|catwalk|bridge/.test(material + id) ? '#677366' : '#675e48', top + .003);
      for (let line = .12; line < Math.min(d, 6) - .04; line += .35) mesh.floor(x + .04, z + line, Math.max(.01, w - .08), .025, '#354638', top + .005);
      if (w > .3 && d > .3) for (const xx of [x + .04, x + w - .06]) mesh.floor(xx, z + .04, .020, Math.max(.01, d - .08), '#d0b469', top + .006);
      if (/roof/.test(material) && h > .04) mesh.quad([x + .015, y - .004, z + .015], [x + w - .015, y - .004, z + .015], [x + w - .015, y - .004, z + d - .015], [x + .015, y - .004, z + d - .015], [0, -1, 0], rgba('#5b5243'));
    }
    return;
  }
  if (/screen|monitor/.test(material)) {
    // Each screen is a real collision slab. A restrained bezel surrounds
    // authored chart panes and a ticker; a monitor bank is useful solid cover.
    const displayFaces = w >= d ? ['north', 'south'] : ['west', 'east'];
    for (const face of displayFaces) {
      const width = face === 'north' || face === 'south' ? w : d;
      if (width < .16 || h < .14) continue;
      patch(face, .035, .035, width - .07, h - .07, '#151f24', .003);
      patch(face, .07, .07, width - .14, h - .14, '#26373b', .005);
      const panes = clamp(Math.round(width / 1.25), 1, 8), paneWidth = (width - .20) / panes;
      for (let pane = 0; pane < panes; pane++) {
        const left = .10 + pane * paneWidth, graphHeight = Math.max(.05, h - .30), graphBottom = .15;
        patch(face, left, h - .12, paneWidth - .06, .025, '#70a1ac', .007);
        for (let row = 1; row < 4; row++) patch(face, left, graphBottom + graphHeight * row / 4, paneWidth - .06, .010, '#3d5052', .006);
        for (let candle = 0; candle < 5; candle++) {
          const seed = hash(`${id}:${pane}:${candle}`), center = graphBottom + graphHeight * (.25 + seed % 50 / 100);
          const graph = Math.min(graphHeight * .22, .16 + seed % 5 / 80), cx = left + .06 + candle * Math.max(.018, (paneWidth - .18) / 5);
          const tint = seed % 3 ? '#70b69e' : '#d29a7f';
          patch(face, cx + .018, center - graph * .7, .012, graph * 1.4, tint, .008);
          patch(face, cx, center - graph * .35, Math.max(.016, (paneWidth - .20) / 11), graph * .7, tint, .009);
        }
        if (pane > 0) patch(face, left - .025, .12, .015, h - .24, '#0e171b', .008);
      }
      patch(face, .09, .085, width - .18, .026, '#87999b', .008);
      patch(face, width - .08, .018, .02, .012, '#88c7a6', .009);
    }
  } else if (/desk|table/.test(material)) {
    mesh.floor(x + .008, z + .008, Math.max(.01, w - .016), Math.max(.01, d - .016), '#b4a38b', y + h + .003);
    for (let grain = .11; grain < d - .03; grain += .27) mesh.floor(x + .025, z + grain, w - .05, .012, '#a79780', y + h + .004);
    if (/top|table|desk/.test(id) && h < .4) for (let station = .50; station < w - .35; station += 1.45) {
      mesh.floor(x + station - .24, z + d * .23, .48, Math.min(.21, d * .20), '#29312e', y + h + .005);
      for (let row = 0; row < 3; row++) mesh.floor(x + station - .21, z + d * .23 + .035 + row * .049, .42, .015, '#b0b3a6', y + h + .006);
      mesh.floor(x + station + .35, z + d * .24, .10, .135, '#4b5048', y + h + .005);
      mesh.floor(x + station - .38, z + d * .70, .28, .36, '#e9e4d4', y + h + .006);
      mesh.floor(x + station - .34, z + d * .70 + .055, .20, .015, '#7d8b86', y + h + .007);
    }
    for (const face of faces) {
      const width = face === 'north' || face === 'south' ? w : d;
      patch(face, .02, h - Math.min(.045, h * .3), width - .04, Math.min(.03, h * .22), '#d6c7ac', .004);
      if (h > .35) {
        patch(face, .02, .045, width - .04, .045, '#5e6157', .004);
        for (let row = .20; row < h - .07; row += .25) {
          patch(face, .06, row, width - .12, .018, '#7d7667', .005);
          patch(face, Math.max(.08, width / 2 - .07), row + .055, Math.min(.14, width - .16), .022, '#484f4a', .006);
        }
      }
    }
  } else if (/chair|fabric|lounge/.test(material + id)) {
    mesh.floor(x + .015, z + .015, w - .03, d - .03, '#4f605e', y + h + .004);
    for (const face of faces) {
      const width = face === 'north' || face === 'south' ? w : d;
      patch(face, .045, .045, width - .09, h - .09, '#56655f', .004);
      patch(face, .06, h * .30, width - .12, .020, '#3c4944', .005);
      patch(face, .06, h * .67, width - .12, .016, '#75847a', .005);
    }
  } else if (/glass/.test(material)) {
    for (const face of faces) {
      const width = face === 'north' || face === 'south' ? w : d;
      patch(face, .016, .035, width - .032, h - .07, '#83989b', .003);
      for (let left = .9; left < width - .1; left += 2.6) patch(face, left, .035, .028, h - .07, '#4d6265', .005);
      patch(face, .035, Math.min(1.25, h * .46), width - .07, Math.min(.20, h * .17), '#c0cec7', .007);
      patch(face, .035, Math.min(1.28, h * .47), width - .07, .034, '#4d8998', .008);
      patch(face, .04, h - .12, width - .08, .023, '#d9e0d6', .006);
    }
  } else {
    for (const face of faces) {
      const width = face === 'north' || face === 'south' ? w : d;
      patch(face, .02, .085, width - .04, .038, '#696e65', .004);
      patch(face, .02, h - .10, width - .04, .035, '#d0d4c6', .004);
      if (/rack|server/.test(id) && h > 1) {
        for (let row = .22; row < h - .20; row += .30) {
          patch(face, .08, row, width - .16, .17, '#273532', .006);
          patch(face, .12, row + .04, .025, .025, '#8dcc9e', .008);
          patch(face, .18, row + .04, .022, .025, '#d7b870', .008);
          for (let vent = .28; vent < width - .09; vent += .09) patch(face, vent, row + .035, .025, .10, '#485a50', .007);
        }
      } else if (/panel|wall/.test(material) && h > 2) {
        for (let left = 2; left < width - .08; left += 2) patch(face, left, .06, .015, h - .12, '#898f83', .004);
      }
    }
    if (/roof/.test(material)) {
      mesh.floor(x + .016, z + .016, Math.max(.01, w - .032), Math.max(.01, d - .032), '#b7b8ab', y + h + .004);
      for (let line = .8; line < d - .08; line += 1.6) mesh.floor(x + .03, z + line, Math.max(.01, w - .06), .014, '#9ca499', y + h + .005);
    }
  }

}

/** Covered market and workshop surfaces stay on their actual solid faces. */
function paintCloseCombatCollider(mesh, collider, theme) {
  const { x, y, z, w, h, d } = collider, id = String(collider.id || ''), color = rgba(collider.color || ART[theme].paving);
  mesh.box(x, y, z, w, h, d, color);
  if (collider.overhead) {
    // Down-facing work lamps are paint on the physical hall ceiling, with a
    // bounded number of strips even in the larger battle-royale variant.
    for (let xx = x + 4; xx < x + w - 2; xx += 10) for (let zz = z + 4; zz < z + d - 2; zz += 10) {
      const strip = theme === 'market' ? '#efd19a' : '#dddcc5';
      mesh.quad([xx, y - .003, zz], [xx + 2.2, y - .003, zz], [xx + 2.2, y - .003, zz + .34], [xx, y - .003, zz + .34], [0, -1, 0], rgba('#25383e'));
      mesh.quad([xx + .08, y - .004, zz + .07], [xx + 2.12, y - .004, zz + .07], [xx + 2.12, y - .004, zz + .27], [xx + .08, y - .004, zz + .27], [0, -1, 0], rgba(strip));
    }
    return;
  }
  const wood = collider.material === 'wood', pale = mix(color, rgba(theme === 'market' ? '#e4bd86' : '#c1c5bd'), .22), dark = shade(color, .64);
  for (const face of ['north', 'south', 'west', 'east']) {
    const width = face === 'north' || face === 'south' ? w : d;
    if (width < .22 || h < .2) continue;
    const patch = (left, bottom, ww, hh, tint, offset = .003) => wallPatch(mesh, collider, face, left, bottom, ww, hh, tint, offset);
    patch(.025, .035, width - .05, .030, dark);
    patch(.025, h - .065, width - .05, .030, pale);
    const rows = Math.min(wood ? 5 : 3, Math.floor(h / .4));
    for (let row = 1; row <= rows; row++) patch(.035, h * row / (rows + 1), width - .07, wood ? .018 : .028, dark);
    if (width > 2 && h > 1.2) for (let at = 1.1; at < width - .2; at += Math.max(1.8, width / 6)) patch(at, .07, .017, h - .14, dark);
    if (theme === 'lockdown' && /boiler|machine|workshop|furnace|generator/.test(id) && width > .8 && h > .5) {
      patch(.08, .16, width - .16, .12, '#b89658', .005);
      for (let at = .14; at < width - .25; at += .45) patch(at, .16, .19, .12, '#343d3d', .006);
    }
    if (theme === 'market' && /screen|sign|lintel/.test(id) && width > .8) {
      patch(.08, Math.max(.04, h - .16), width - .16, .055, /east|food-1|food-2/.test(id) ? '#96d2cf' : '#edc482', .005);
    }
  }
}

function paintCollider(mesh, collider, theme) {
  if (theme === 'market' || theme === 'lockdown') return paintCloseCombatCollider(mesh, collider, theme);
  if (theme === 'paris') return paintParisCollider(mesh, collider);
  if (['snow', 'sewers', 'trading'].includes(theme)) return paintExpansionCollider(mesh, collider, theme);
  if (ROYALE_THEMES.has(theme) || theme === 'dojo') return paintRoyaleCollider(mesh, collider, theme);
  const { x, y, z, w, h, d } = collider;
  if (String(collider.id || '').startsWith('landmark-')) {
    // Semantic props have their own surface finishes below. Reusing building
    // facade detail on tiny components would add invisible per-brick work.
    mesh.box(x, y, z, w, h, d, collider.color || '#7d8d83');
    return;
  }
  const original = rgba(collider.color || (theme === 'canal' ? '#b6b0a2' : '#8d9b9b'));
  const material = String(collider.material || 'concrete').toLowerCase();
  const c = /wood|crate/.test(material) ? mix(original, rgba('#bd8042'), .28) : material === 'stone' && theme === 'courtyard' ? mix(original, rgba('#dfcbb1'), .24) : original;
  mesh.box(x, y, z, w, h, d, c);
  const detail = (xx, yy, zz, ww, hh, dd, color) => {
    if (Math.min(ww, dd) <= .049) mesh.panel(xx, yy, zz, ww, hh, dd, color);
    else mesh.box(xx, yy, zz, ww, hh, dd, color);
  };
  const skin = .012;
  const dark = shade(c, .58), pale = mix(c, rgba('#e4dfcb'), .30), accent = rgba((ART[theme] || ART.courtyard).accent);
  const rim = Math.min(.08, w / 5, d / 5, h / 6);
  if (material === 'water') {
    for (let i = 0; i < 9; i++) {
      const zz = z + .45 + i * Math.max(.25, (d - .8) / 9);
      mesh.floor(x + .20 + (i % 3) * .22, zz, Math.max(.15, w - .55 - (i % 2) * .45), .028, mix(c, rgba('#d9e8d6'), .30), y + h + .001);
    }
    return;
  }
  if (h > .5) {
    detail(x - skin, y + .035, z - skin, w + skin * 2, Math.min(.105, h / 8), d + skin * 2, dark);
    detail(x - skin, y + h - rim, z - skin, w + skin * 2, rim, d + skin * 2, pale);
  }
  if (/crate|wood|cargo|container|metal/.test(material)) {
    if (/wood|crate/.test(material)) {
      const boards = clamp(Math.round(h / .22), 2, 10);
      for (let i = 0; i < boards; i++) {
        const tint = shade(c, .88 + (hash(`${collider.id}:board:${i}`) % 5) * .045);
        for (const face of ['north', 'south']) wallPatch(mesh, collider, face, .05, i * h / boards + .025, w - .1, h / boards - .04, tint, .003);
        for (const face of ['west', 'east']) wallPatch(mesh, collider, face, .05, i * h / boards + .025, d - .1, h / boards - .04, tint, .003);
      }
      for (let xx = x + .05; xx < x + w - .05; xx += .28) mesh.floor(xx, z + .025, Math.min(.25, x + w - xx - .025), d - .05, shade(c, .9 + (hash(`${collider.id}:${xx}`) % 4) * .045), y + h + .002);
      for (const face of ['north', 'south']) for (const left of [.10, w - .13]) for (const bottom of [.15, h - .19]) wallPatch(mesh, collider, face, left, bottom, .035, .035, '#3b4140', .026);
    }
    const panelsX = clamp(Math.round(w / .65), 1, 18), panelsZ = clamp(Math.round(d / .65), 1, 18);
    for (let i = 0; i <= panelsX; i++) {
      const xx = x + .06 + i * (w - .12) / panelsX;
      detail(xx - .025, y + .15, z - skin, .05, Math.max(.04, h - .25), skin, dark);
      detail(xx - .025, y + .15, z + d, .05, Math.max(.04, h - .25), skin, dark);
    }
    for (let i = 0; i <= panelsZ; i++) {
      const zz = z + .06 + i * (d - .12) / panelsZ;
      detail(x - skin, y + .15, zz - .025, skin, Math.max(.04, h - .25), .05, dark);
      detail(x + w, y + .15, zz - .025, skin, Math.max(.04, h - .25), .05, dark);
    }
    if (w > .9 && h > .65) {
      for (const zz of [z - skin - .001, z + d + .001]) {
        detail(x + w * .15, y + h * .49, zz, w * .7, .12, skin, accent);
        detail(x + w * .30, y + h * .49 + .025, zz - .001, w * .32, .045, skin + .002, dark);
      }
    }
    if (/metal|container/.test(material) && w > 2 && h > 2) {
      for (const face of ['north', 'south']) {
        wallPatch(mesh, collider, face, w * .15, h * .57, w * .70, .78, shade(c, .73), .018);
        wallText(mesh, collider, face, 'CARGO', w * .19, h * .63, .48, '#e5dac2', .031);
        wallText(mesh, collider, face, String(hash(collider.id) % 90 + 10), w * .18, h * .34, .34, '#dcc29a', .032);
      }
      for (const zz of [z - skin - .002, z + d + .002]) {
        for (const fraction of [.28, .72]) {
          detail(x + w * fraction, y + .30, zz, .038, h - .56, skin + .004, pale);
          detail(x + w * fraction - .06, y + h * .38, zz - .002, .16, .07, skin + .009, '#313c40');
          for (const yy of [.45, h - .58]) detail(x + w * fraction - .055, y + yy, zz - .002, .14, .05, skin + .008, pale);
        }
      }
    }
    if (/wood|crate/.test(material)) {
      const count = clamp(Math.round(h / .25), 1, 12);
      for (let i = 1; i < count; i++) {
        detail(x - skin, y + i * h / count, z - skin, w + skin * 2, .013, d + skin * 2, dark);
      }
    }
    return;
  }
  if (/stone|brick|wall|plaster|concrete/.test(material)) {
    const count = clamp(Math.round(h / .48), 1, 14);
    for (let i = 1; i < count; i++) {
      const yy = y + i * h / count;
      for (const face of ['north', 'south', 'west', 'east']) wallPatch(mesh, collider, face, 0, yy - y, face === 'north' || face === 'south' ? w : d, .017, shade(c, .84), .004);
      const rowsX = Math.min(20, Math.floor(w / 1.1)), rowsZ = Math.min(20, Math.floor(d / 1.1));
      for (let j = 0; j < rowsX; j++) {
        const xx = x + .50 + j * w / Math.max(1, rowsX) + (i % 2) * .25;
        if (xx < x + w - .06) {
          for (const face of ['north', 'south']) wallPatch(mesh, collider, face, xx - x, yy - y - h / count + .026, .013, h / count - .045, shade(c, .82), .004);
        }
      }
      for (let j = 0; j < rowsZ; j++) {
        const zz = z + .50 + j * d / Math.max(1, rowsZ) + (i % 2) * .25;
        if (zz < z + d - .06) {
          for (const face of ['west', 'east']) wallPatch(mesh, collider, face, zz - z, yy - y - h / count + .026, .013, h / count - .045, shade(c, .82), .004);
        }
      }
    }
    // Broad masonry faces get shallow vertical pilasters, never extra cover.
    if (h > 2.3) {
      const xxCount = clamp(Math.floor(w / 3), 0, 10), zzCount = clamp(Math.floor(d / 3), 0, 10);
      for (let i = 0; i <= xxCount && xxCount; i++) {
        const xx = x + .12 + i * (w - .24) / xxCount;
        detail(xx - .07, y + .12, z - skin * 2, .14, h - .16, skin * 2, pale);
        detail(xx - .07, y + .12, z + d, .14, h - .16, skin * 2, pale);
      }
      for (let i = 0; i <= zzCount && zzCount; i++) {
        const zz = z + .12 + i * (d - .24) / zzCount;
        detail(x - skin * 2, y + .12, zz - .07, skin * 2, h - .16, .14, pale);
        detail(x + w, y + .12, zz - .07, skin * 2, h - .16, .14, pale);
      }
      // Sealed ventilation panels sit above eye level. The full solid stone
      // behind them remains visible around the frame; they cannot suggest an
      // open doorway, crawlspace, or window that shots would pass through.
      const windowY = y + Math.min(h - .82, 2.30), glass = rgba(theme === 'courtyard' ? '#766f64' : '#526d76');
      for (let xx = x + 1.03; xx < x + w - .95 && w > 3; xx += 2.6) {
        for (const zz of [z - skin * 3, z + d]) {
          detail(xx - .38, windowY - .08, zz, .76, .64, skin * 3, dark);
          detail(xx - .32, windowY - .025, zz - .001, .64, .52, skin * 3 + .002, glass);
          for (let slat = 0; slat < 4; slat++) detail(xx - .32, windowY + slat * .135, zz - .002, .64, .024, skin * 3 + .004, pale);
          detail(xx - .39, windowY - .09, zz - .003, .78, .06, skin * 3 + .008, pale);
        }
      }
      for (let zz = z + 1.03; zz < z + d - .95 && d > 3; zz += 2.6) {
        for (const xx of [x - skin * 3, x + w]) {
          detail(xx, windowY - .08, zz - .38, skin * 3, .64, .76, dark);
          detail(xx - .001, windowY - .025, zz - .32, skin * 3 + .002, .52, .64, glass);
          for (let slat = 0; slat < 4; slat++) detail(xx - .002, windowY + slat * .135, zz - .32, skin * 3 + .004, .024, .64, pale);
          detail(xx - .003, windowY - .09, zz - .39, skin * 3 + .008, .06, .78, pale);
        }
      }
    }
    // Staggered stone wear is surface paint; its low contrast keeps the useful
    // outer silhouette stronger than the masonry pattern at long distances.
    for (const face of ['north', 'south', 'west', 'east']) {
      const width = face === 'north' || face === 'south' ? w : d;
      for (let left = .24; left < width - .60; left += 1.46) {
        const seed = hash(`${collider.id}:${face}:${left}`), bottom = .35 + seed % Math.max(1, Math.floor((h - .7) * 10)) / 10;
        wallPatch(mesh, collider, face, left, bottom, Math.min(.64, width - left - .10), .23, shade(c, seed % 2 ? 1.06 : .94), .004);
      }
      wallPatch(mesh, collider, face, 0, .02, width, Math.min(.14, h / 6), shade(c, .54), .014);
      wallPatch(mesh, collider, face, 0, h - .23, width, .085, mix(c, rgba('#e6dbc6'), .6), .014);
    }
  }
  if (String(collider.id).includes('planter')) {
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
      mesh.floor(x + .05 + i * (w - .1) / 5, z + .05 + j * (d - .1) / 5, (w - .1) / 5, (d - .1) / 5, (i + j) % 2 ? '#6e8263' : '#81936c', y + h + .001);
    }
  }
}

function floorLetter(mesh, letter, x, z, size, color) {
  const rows = GLYPHS[letter] || GLYPHS.A;
  const pixel = size / 7;
  for (let row = 0; row < rows.length; row++) {
    for (let column = 0; column < rows[row].length; column++) {
      if (rows[row][column] === '1') mesh.floor(x + (column - 2.5) * pixel, z + (row - 3.5) * pixel, pixel * .87, pixel * .87, color, .014);
    }
  }
}

function floorChevron(mesh, x, z, yaw, color, y = .016) {
  const point = ([xx, zz]) => {
    const rotated = rotate([xx, 0, zz], yaw);
    return [x + rotated[0], y, z + rotated[2]];
  };
  for (const points of [[[-.30, .20], [-.22, .28], [.045, .015], [-.04, -.07]], [[-.045, .015], [.22, .28], [.30, .20], [.04, -.07]]]) {
    mesh.quad(...points.map(point), [0, 1, 0], rgba(color));
  }
}

function routePaint(mesh, map) {
  const byId = new Map((map.colliders || []).map(collider => [collider.id, collider]));
  const trimmed = new Set();
  const color = mix(rgba('#e1c88e'), rgba((ART[map.theme || map.id] || ART.courtyard).accent), .23);
  for (const route of map.routes || []) {
    const steps = route.steps || [], start = route.start, first = steps[0];
    if (start && first && [start.x, start.z, first.x, first.z].every(Number.isFinite)) {
      floorChevron(mesh, start.x, start.z, Math.atan2(first.x - start.x, start.z - first.z), color);
    }
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i], collider = byId.get(step.colliderId);
      if (!collider || ![step.x, step.z].every(Number.isFinite)) continue;
      const top = collider.y + collider.h;
      if (!trimmed.has(collider.id)) {
        trimmed.add(collider.id);
        // These narrow strips are paint on the playable top, never a railing
        // or a lip that would alter the jump or its collision silhouette.
        const inset = .065, edge = .027;
        if (collider.w > .20 && collider.d > .20) {
          mesh.floor(collider.x + inset, collider.z + inset, collider.w - inset * 2, edge, color, top + .004);
          mesh.floor(collider.x + inset, collider.z + collider.d - inset - edge, collider.w - inset * 2, edge, color, top + .004);
          mesh.floor(collider.x + inset, collider.z + inset, edge, collider.d - inset * 2, color, top + .004);
          mesh.floor(collider.x + collider.w - inset - edge, collider.z + inset, edge, collider.d - inset * 2, color, top + .004);
        }
      }
      const next = steps[i + 1];
      if (collider.w >= .75 && collider.d >= .75) {
        const x = clamp(step.x, collider.x + .36, collider.x + collider.w - .36);
        const z = clamp(step.z, collider.z + .36, collider.z + collider.d - .36);
        floorChevron(mesh, x, z, next ? Math.atan2(next.x - x, z - next.z) : route.side === 'north' ? Math.PI : 0, color, top + .016);
      }
    }
  }
}

function landmarkArt(mesh, map, theme) {
  const byId = new Map((map.colliders || []).map(collider => [collider.id, collider]));
  for (const landmark of map.landmarks || []) {
    const kind = String(landmark.kind || ''), ids = landmark.colliderIds || landmark.collisionIds || [landmark.id];
    const boxes = ids.map(id => byId.get(id)).filter(Boolean);
    const labelBox = boxes.filter(box => box.h > .6).sort((a, b) => Math.max(b.w, b.d) - Math.max(a.w, a.d))[0];
    for (const box of boxes) {
      const { x, y, z, w, h, d } = box;
      const patch = (face, left, bottom, ww, hh, tint, offset = .007) => {
        const width = face === 'north' || face === 'south' ? w : d;
        const xx = Math.max(.01, left), yy = Math.max(.01, bottom);
        const pw = Math.min(ww, width - xx - .01), ph = Math.min(hh, h - yy - .01);
        if (pw > .003 && ph > .003) wallPatch(mesh, box, face, xx, yy, pw, ph, tint, offset);
      };
      if (/forklift/.test(kind)) {
        for (const face of ['north', 'south', 'west', 'east']) {
          const width = face === 'north' || face === 'south' ? w : d;
          patch(face, .025, .10, width - .05, Math.min(.15, h * .20), '#d2a04c');
          if (/cab|roof/.test(box.id)) {
            patch(face, .05, .20, width - .10, h - .27, '#344b52', .005);
            patch(face, width * .17, .22, .035, h - .30, '#e6b85f', .008);
            patch(face, width * .78, .22, .035, h - .30, '#e6b85f', .008);
          } else if (width > .6 && h > .45) {
            for (const u of [.14, .73]) {
              patch(face, width * u, .09, width * .15, Math.min(.28, h * .50), '#303b38', .008);
              patch(face, width * u + .035, .14, Math.max(.015, width * .15 - .07), Math.min(.16, h * .27), '#8c8f75', .009);
            }
          }
        }
      } else if (kind === 'market-shop') {
        for (const face of ['north', 'south', 'west', 'east']) {
          const width = face === 'north' || face === 'south' ? w : d;
          if (width < .5) continue;
          if (/lintel/.test(box.id)) {
            patch(face, .04, .07, width - .08, h - .14, '#233e46');
            patch(face, .06, .09, width - .12, .035, /east/.test(box.id) ? '#8ed5d0' : '#efc488', .008);
          } else {
            patch(face, .04, .06, width - .08, Math.min(2.20, h - .12), '#59696b', .005);
            for (let row = .25; row < Math.min(2.3, h - .15); row += .23) patch(face, .07, row, width - .14, .026, '#354e56', .007);
            patch(face, .04, h - .30, width - .08, .12, /east/.test(box.id) ? '#74c2c3' : '#ddac64', .008);
          }
        }
      } else if (/market-stall|newspaper-stand/.test(kind)) {
        if (/canopy|roof/.test(box.id)) {
          for (let at = .06; at < w - .04; at += .38) mesh.floor(x + at, z + .025, Math.min(.19, w - at - .02), d - .05, '#e8d7aa', y + h + .004);
        } else for (const face of ['north', 'south']) {
          patch(face, .035, .035, w - .07, h * .55, '#795f45');
          if (/newspaper/.test(kind)) for (let paper = .10; paper < w - .18; paper += .34) {
            patch(face, paper, h * .36, .26, Math.min(.32, h * .45), '#e0d7be', .009);
            patch(face, paper + .025, h * .44, .20, .025, '#657165', .010);
          }
        }
      } else if (/hvac|generator|signal-array|water-tank/.test(kind)) {
        for (const face of ['north', 'south', 'west', 'east']) {
          const width = face === 'north' || face === 'south' ? w : d;
          if (width < .35 || h < .25) continue;
          patch(face, .025, .045, width - .05, h - .09, '#566d68', .005);
          for (let row = .14; row < h - .09; row += .17) patch(face, .08, row, width - .16, .033, '#263f3d', .008);
          patch(face, width * .65, Math.min(h - .12, .3), Math.min(.07, width * .10), .05, '#cfb975', .010);
        }
      } else if (/logging-pile/.test(kind)) {
        for (const face of ['west', 'east']) {
          const width = d;
          patch(face, .015, .015, width - .03, h - .03, '#c0a374', .005);
          for (let ring = 0; ring < 3; ring++) {
            const inset = .055 + ring * .06;
            patch(face, inset, inset, width - inset * 2, .018, '#8e704b', .008);
            patch(face, inset, h - inset - .018, width - inset * 2, .018, '#8e704b', .008);
            patch(face, inset, inset, .018, h - inset * 2, '#8e704b', .008);
            patch(face, width - inset - .018, inset, .018, h - inset * 2, '#8e704b', .008);
          }
        }
      } else if (/carved-marker|carved-obelisk|fountain-sculpture/.test(kind)) {
        for (const face of ['north', 'south', 'west', 'east']) {
          const width = face === 'north' || face === 'south' ? w : d;
          patch(face, .035, h * .15, width - .07, .030, '#827d63', .007);
          patch(face, .035, h * .78, width - .07, .035, '#d1be8b', .008);
          if (width > .35 && h > .50) for (let mark = .12; mark < h - .13; mark += .36) {
            patch(face, width * .38, mark, width * .22, .065, '#5c7167', .008);
            patch(face, width * .48, mark + .065, .030, .12, '#5c7167', .008);
          }
        }
      } else if (/slag-vat/.test(kind)) {
        mesh.floor(x + .025, z + .025, w - .05, d - .05, '#c88b43', y + h + .004);
        for (let line = .15; line < d - .06; line += .32) mesh.floor(x + .08, z + line, w - .16, .033, '#e6b863', y + h + .005);
      } else if (/stone-planter/.test(kind)) {
        mesh.floor(x + .03, z + .03, w - .06, d - .06, '#66815c', y + h + .004);
        for (let flower = .12; flower < w - .08; flower += .24) mesh.floor(x + flower, z + d * .50, .048, .048, '#d6bb85', y + h + .005);
      }
      if (!landmark.label || box !== labelBox || h < .65 || !/trail-board|metro-kiosk|service-control|pump|forklift|market-stall|market-shop|newspaper-stand|carved-marker/.test(kind)) continue;
      const face = w >= d ? 'south' : 'east', width = w >= d ? w : d;
      const label = String(landmark.label).toUpperCase();
      const units = [...label].reduce((sum, letter) => sum + (GLYPHS[letter]?.[0]?.length || 2) + 1, 0) - 1;
      const height = Math.min(.21, h * .18, (width - .14) * 7 / units);
      if (height < .075) continue;
      const left = (width - units * height / 7) / 2, bottom = Math.min(h - height - .05, h * .60);
      patch(face, left - .035, bottom - .035, units * height / 7 + .07, height + .07, '#304c4a', .009);
      wallText(mesh, box, face, label, left, bottom, height, '#e4d8b4', .012);
    }
  }
  // Decorations outside expansion/Paris already have a matching world floor.
  // Painting these flat region labels never introduces uncollidable cover.
  if (!['snow', 'sewers', 'trading', 'paris'].includes(theme)) for (const decoration of map.decorations || []) {
    const { x, z, w, d } = decoration;
    if (![x, z, w, d].every(Number.isFinite) || Math.min(w, d) <= 0) continue;
    mesh.floor(x, z, w, d, decoration.color || (ART[theme] || ART.courtyard).accent, finite(decoration.y, 0) + .008);
    if (/trail|walk|lane/.test(decoration.kind || '')) for (let at = .24; at < d - .2; at += 1.1) mesh.floor(x + .06, z + at, .025, .55, '#bcb896', finite(decoration.y, 0) + .009);
    if ((theme === 'market' || theme === 'lockdown') && /tiles|floor/.test(decoration.kind || '')) for (let row = 1; row < d; row += 1.6) mesh.floor(x + .04, z + row, w - .08, .017, theme === 'market' ? '#878473' : '#464e4f', finite(decoration.y, 0) + .010);
    if (theme === 'lockdown' && /hazard|furnace/.test(decoration.kind || '')) for (let at = .1; at < w - .3; at += .6) mesh.floor(x + at, z + .06, .25, Math.min(.23, d - .12), '#d4a460', finite(decoration.y, 0) + .010);
  }
}

function dojoMapPaint(mesh, map) {
  for (const decoration of map.decorations || []) {
    const { x, z, w, d, kind } = decoration, y = finite(decoration.y) + .008;
    if (![x, z, w, d].every(Number.isFinite) || w <= 0 || d <= 0) continue;
    mesh.floor(x, z, w, d, decoration.color || ART.dojo.accent, y);
    if (kind === 'cedar-floor') for (let xx = .02; xx < w; xx += .42) mesh.floor(x + xx, z + .015, .013, d - .03, '#755a40', y + .001);
    if (kind === 'dojo-tatami') {
      for (let zz = .08; zz < d - .02; zz += .11) mesh.floor(x + .02, z + zz, w - .04, .012, '#999768', y + .001);
      for (let xx = 0; xx < w; xx += 1.04) mesh.floor(x + xx, z, .040, d, '#545f45', y + .002);
      for (let zz = 0; zz < d; zz += 1.75) mesh.floor(x, z + zz, w, .040, '#545f45', y + .002);
    }
    if (kind === 'stone-path') {
      for (let zz = .04; zz < d - .01; zz += .92) mesh.floor(x + .02, z + zz, w - .04, .018, '#8e887a', y + .001);
      for (let xx = .80; xx < w - .02; xx += .86) mesh.floor(x + xx, z + .02, .018, d - .04, '#938b7e', y + .001);
    }
    if (kind === 'gravel-garden') for (let zz = .17; zz < d - .10; zz += .52) mesh.floor(x + .07, z + zz, w - .14, .025, '#bfb7a4', y + .001);
  }
  for (const station of (map.stations || []).slice(0, 4)) {
    const bench = map.colliders.find(collider => collider.id === station.colliderId);
    if (!bench || typeof station.label !== 'string') continue;
    const label = station.label.slice(0, 10), height = .135, units = [...label].reduce((sum, letter) => sum + (GLYPHS[letter]?.[0]?.length || 2) + 1, 0) - 1;
    const left = (bench.w - units * height / 7) / 2;
    wallPatch(mesh, bench, 'north', left - .045, .022, units * height / 7 + .09, .165, '#344a40', .008);
    wallText(mesh, bench, 'north', label, left, .036, height, '#f2deb3', .011);
  }
  for (const lane of (map.rangeLanes || []).slice(0, 4)) {
    const label = lane.id === 'blade-pad' ? 'BLADE' : `${Math.round(lane.distance)}M`, size = .42;
    const origin = lane.origin;
    if (!origin || ![origin.x, origin.z].every(Number.isFinite)) continue;
    for (let index = 0; index < label.length; index++) floorLetter(mesh, label[index], origin.x + (index - (label.length - 1) / 2) * .39, origin.z + .58, size, '#eed5a5');
  }
  // Petals remain flat markings near physical cherry trees; none pretend to
  // be cover or add a continuously moving particle emitter to the range.
  for (const tree of map.colliders.filter(collider => /dojo-cherry.*trunk/.test(collider.id))) {
    for (let index = 0; index < 14; index++) {
      const seed = hash(`${tree.id}:${index}`), px = tree.x + tree.w / 2 + Math.sin(seed % 97) * 1.8, pz = tree.z + tree.d / 2 + Math.cos(seed % 83) * 1.8;
      mesh.floor(px, pz, .075 + seed % 3 * .014, .045, index % 3 ? '#d69da8' : '#ebc0b8', .018);
    }
  }
}

function mapPaint(mesh, map, theme) {
  if (theme === 'dojo') { dojoMapPaint(mesh, map); return; }
  const find = id => map.colliders.find(collider => collider.id === id);
  const siteColumn = id => {
    const side = id === 'A' ? 'west' : 'east';
    const prefix = ({ rooftops: 'roofline', foundry: 'foundry', bastion: 'bastion' })[theme];
    return find(prefix ? `${prefix}-${side}-site-column` : `${side}-${theme === 'courtyard' ? 'site-column' : theme === 'depot' ? 'loading-column' : 'site-pillar'}`);
  };
  for (const site of map.sites || []) {
    const column = siteColumn(site.id) || map.colliders.filter(collider => collider.h >= 2.5 && collider.y < .1 && collider.w >= .8 && collider.d >= .8 && !String(collider.id).startsWith('wall-')).sort((a, b) => Math.hypot(a.x + a.w / 2 - site.x, a.z + a.d / 2 - site.z) - Math.hypot(b.x + b.w / 2 - site.x, b.z + b.d / 2 - site.z))[0];
    if (column) siteSign(mesh, column, site.id);
  }
  if (['snow', 'sewers', 'trading'].includes(theme)) {
    for (const decoration of map.decorations || []) {
      const { x, z, w, d } = decoration;
      if (![x, z, w, d].every(Number.isFinite) || Math.min(w, d) <= 0) continue;
      mesh.floor(x, z, w, d, decoration.color || ART[theme].paving, finite(decoration.y, 0) + .003);
      if (theme === 'snow' && /path|yard|trail/.test(decoration.kind || '')) {
        const alongZ = d > w, length = alongZ ? d : w;
        for (let at = .4, index = 0; at < length - .3; at += .9, index++) {
          const side = index % 2 ? .14 : -.14;
          if (alongZ) mesh.floor(x + w / 2 + side, z + at, .11, .22, '#96b3c1', .006);
          else mesh.floor(x + at, z + d / 2 + side, .22, .11, '#96b3c1', .006);
        }
      }
      if (theme === 'sewers' && !/water/.test(decoration.kind || '')) {
        for (let at = .5; at < d - .15; at += 1.4) mesh.floor(x + .13, z + at, Math.min(.44, w - .2), .065, '#4b5b43', .006);
      }
      if (/aisle|path/.test(decoration.kind || '')) {
        const alongZ = d > w, length = alongZ ? d : w;
        for (let at = .3; at < length - .3; at += 2.8) {
          if (alongZ) mesh.floor(x + .09, z + at, .026, Math.min(1.1, length - at - .15), ART[theme].accent, .004);
          else mesh.floor(x + at, z + .09, Math.min(1.1, length - at - .15), .026, ART[theme].accent, .004);
        }
      }
    }
    for (const building of map.buildings || []) {
      const room = building.interior;
      if (!room) continue;
      const x = room.minX + .016, z = room.minZ + .016, w = room.maxX - room.minX - .032, d = room.maxZ - room.minZ - .032;
      const base = theme === 'trading' ? '#8e958b' : theme === 'sewers' ? '#797760' : '#b6c4ca';
      mesh.floor(x, z, w, d, base, .004);
      for (let line = .35; line < d - .04; line += theme === 'trading' ? 1.5 : 1.0) mesh.floor(x + .03, z + line, w - .06, .016, shade(rgba(base), .82), .005);
      const wall = find(`${building.id}-west`);
      if (wall && wall.d > 3 && wall.h > 2) {
        const left = Math.max(.12, (wall.d - 2.2) / 2), color = theme === 'trading' ? '#4f6f72' : theme === 'sewers' ? '#595b40' : '#557c8b';
        wallPatch(mesh, wall, 'east', left, 1.12, 2.2, .72, color, .009);
        wallText(mesh, wall, 'east', '0' + ((map.buildings || []).indexOf(building) + 1), left + .82, 1.27, .32, '#dbe8df', .012);
        wallPatch(mesh, wall, 'east', left + .10, 1.20, .40, .035, ART[theme].accent, .013);
      }
    }
    if (theme === 'trading') {
      const brand = find('trading-brand-wall');
      if (brand && brand.w >= 6 && brand.h >= .8) {
        for (const face of ['north', 'south']) {
          wallPatch(mesh, brand, face, .12, .12, brand.w - .24, brand.h - .24, '#154d6d', .006);
          for (const [label, bottom, height, tint] of [['BARCLAYS', .49, .46, '#d5f0ff'], ['TRADING', .20, .21, '#5cc3ec']]) {
            const textWidth = ([...label].reduce((width, character) => width + (GLYPHS[character]?.[0].length || 2) + 1, 0) - 1) * height / 7;
            wallText(mesh, brand, face, label, (brand.w - textWidth) / 2, bottom, height, tint, .010);
          }
          wallPatch(mesh, brand, face, .30, .28, .05, brand.h - .56, '#36b4e3', .012);
          wallPatch(mesh, brand, face, brand.w - .35, .28, .05, brand.h - .56, '#36b4e3', .012);
        }
      }
    }
  } else if (theme === 'paris') {
    for (const decoration of map.decorations || []) {
      const { kind, x, z, w, d } = decoration;
      if (![x, z, w, d].every(Number.isFinite) || w <= 0 || d <= 0) continue;
      if (kind === 'road') {
        mesh.floor(x, z, w, d, decoration.color || '#667076', .003);
        const vertical = d > w;
        const length = vertical ? d : w;
        for (let cursor = .8; cursor < length - .8; cursor += 3.6) {
          if (vertical) mesh.floor(x + w / 2 - .045, z + cursor, .09, Math.min(1.35, length - cursor), '#e3d6af', .004);
          else mesh.floor(x + cursor, z + d / 2 - .045, Math.min(1.35, length - cursor), .09, '#e3d6af', .004);
        }
        if (vertical) for (const xx of [x + .13, x + w - .18]) {
          mesh.floor(xx, z + .05, .05, d - .10, '#b7b8a5', .005);
          for (let cursor = 2.5; cursor < d - 1; cursor += 9) {
            mesh.floor(xx + (xx < x + w / 2 ? .10 : -.28), z + cursor, .18, .42, '#596d70', .005);
            for (let grate = 0; grate < 4; grate++) mesh.floor(xx + (xx < x + w / 2 ? .11 : -.27), z + cursor + .06 + grate * .085, .16, .022, '#919e97', .006);
          }
        }
      } else if (kind === 'crosswalk') {
        for (let cursor = .15; cursor < d - .20; cursor += .68) mesh.floor(x + .25, z + cursor, Math.max(.01, w - .50), Math.min(.30, d - cursor), '#e9e2cd', .004);
      } else if (kind === 'park') {
        mesh.floor(x, z, w, d, decoration.color || '#829465', .003);
        for (let i = 0; i < 14; i++) {
          const seed = hash(`${map.id}:park:${x}:${z}:${i}`), xx = x + .25 + seed % 90 / 100 * Math.max(0, w - .5), zz = z + .25 + (seed >>> 8) % 90 / 100 * Math.max(0, d - .5);
          mesh.floor(xx, zz, .045, .045, i % 3 ? '#d4c489' : '#b98377', .004);
        }
      } else if (kind === 'sidewalk' || kind === 'cafe') {
        mesh.floor(x, z, w, d, decoration.color || (kind === 'cafe' ? '#c6b292' : '#c7c1b1'), .003);
        for (let row = .12; row < d - .12; row += 1.2) mesh.floor(x + .04, z + row, w - .08, .014, '#a49d8e', .004);
        if (kind === 'cafe') {
          for (let xx = .16; xx < w - .20; xx += .8) for (let zz = .16; zz < d - .20; zz += .8) {
            if ((Math.round(xx / .8) + Math.round(zz / .8)) % 2 === 0) mesh.floor(x + xx, z + zz, Math.min(.58, w - xx - .08), Math.min(.58, d - zz - .08), '#b79f82', .005);
          }
        } else for (let row = .15; row < d - .2; row += .60) mesh.floor(x + .07, z + row, .14, .32, '#ccc5b0', .005);
      }
    }
    for (const building of map.buildings || []) {
      const label = ({ 'paris-opera': 'OPERA', 'paris-atelier': 'ATELIER', 'paris-cafe': 'CAFE', 'paris-librairie': 'LIVRES' })[building.id] || 'PARIS';
      const interior = building.interior;
      if (interior && [interior.minX, interior.maxX, interior.minZ, interior.maxZ].every(Number.isFinite)) {
        const ix = interior.minX + .025, iz = interior.minZ + .025, iw = interior.maxX - interior.minX - .05, id = interior.maxZ - interior.minZ - .05;
        mesh.floor(ix, iz, iw, id, building.id === 'paris-cafe' ? '#c0ad8d' : '#a99272', .003);
        // Floorboards and tile inlays are entirely flat. Both genuine door
        // thresholds remain open and there are no decorative interior props.
        for (let row = .06, index = 0; row < id - .08; row += .48, index++) {
          mesh.floor(ix + .025, iz + row, iw - .05, Math.min(.45, id - row - .025), index % 2 ? '#af9978' : '#b9a584', .004);
          for (let column = .55 + index % 2 * .86; column < iw - .05; column += 1.72) mesh.floor(ix + column, iz + row, .014, Math.min(.45, id - row - .025), '#827661', .005);
        }
        mesh.floor(ix + .08, iz + .08, iw - .16, .045, '#6f7b69', .006);
        mesh.floor(ix + .08, iz + id - .125, iw - .16, .045, '#6f7b69', .006);
        for (const xx of [ix + .08, ix + iw - .125]) mesh.floor(xx, iz + .08, .045, id - .16, '#6f7b69', .006);
        for (const side of ['west', 'east']) {
          const wall = find(`${building.id}-${side}`);
          if (!wall || wall.d < 3 || wall.h < 2.8) continue;
          const face = side === 'west' ? 'east' : 'west', left = (wall.d - 2.10) / 2;
          wallPatch(mesh, wall, face, left, 1.05, 2.10, 1.29, '#756954', .012);
          wallPatch(mesh, wall, face, left + .055, 1.10, 1.99, 1.18, building.id === 'paris-cafe' ? '#344e49' : '#d6c6a2', .014);
          if (building.id === 'paris-cafe') {
            wallText(mesh, wall, face, 'CAFE', left + .51, 1.78, .23, '#e6d9b3', .018);
            for (let row = 0; row < 4; row++) {
              wallPatch(mesh, wall, face, left + .23, 1.31 + row * .11, .87 - row % 2 * .14, .020, '#b7c2a4', .018);
              wallPatch(mesh, wall, face, left + 1.40, 1.31 + row * .11, .24, .020, '#d9cba7', .018);
            }
          } else if (building.id === 'paris-librairie') {
            // A flat reading-room mural: colored book spines sit on the wall,
            // without introducing a shelf players cannot collide with.
            for (let row = 0; row < 2; row++) for (let column = 0; column < 8; column++) {
              const palette = ['#647c6c', '#9b6854', '#708794', '#b69868'];
              const hh = .31 + column % 3 * .025, bookX = left + .19 + column * .22, bookY = 1.20 + row * .49;
              wallPatch(mesh, wall, face, bookX, bookY, .15, hh, palette[(column + row) % palette.length], .018);
              wallPatch(mesh, wall, face, bookX + .025, bookY + hh - .09, .10, .018, '#e6d7b4', .020);
            }
          } else {
            wallPatch(mesh, wall, face, left + .17, 1.20, .78, .93, '#5c7d81', .018);
            wallPatch(mesh, wall, face, left + 1.03, 1.20, .88, .93, '#b48768', .018);
            wallPatch(mesh, wall, face, left + .26, 1.31, .19, .69, '#d6c7a3', .020);
            wallPatch(mesh, wall, face, left + .45, 1.31, .34, .16, '#b49a72', .020);
            wallPatch(mesh, wall, face, left + 1.15, 1.44, .57, .38, '#d8c6a0', .020);
            wallPatch(mesh, wall, face, left + 1.40, 1.32, .12, .64, '#6f7e6b', .022);
          }
        }
      }
      for (const sign of map.colliders.filter(collider => building.wallIds?.includes(collider.id) && /lintel/.test(collider.id))) {
        const face = /north/.test(sign.id) ? 'north' : 'south';
        if (sign.w < 1 || sign.h < .50) continue;
        const height = Math.min(.30, sign.h - .30), textWidth = (label.length * 6 - 1) * height / 7;
        if (textWidth > sign.w - .30) continue;
        wallPatch(mesh, sign, face, .09, .10, sign.w - .18, .46, building.facade?.accent || '#57746b', .016);
        wallText(mesh, sign, face, label, (sign.w - textWidth) / 2, .19, height, '#eddfbd', .024);
        wallPatch(mesh, sign, face, .13, .13, sign.w - .26, .016, '#bcaa84', .026);
      }
    }
  } else if (ROYALE_THEMES.has(theme)) {
    for (const building of map.buildings || []) {
      const room = building.interior;
      if (!room) continue;
      const x = room.minX + .025, z = room.minZ + .025, w = room.maxX - room.minX - .05, d = room.maxZ - room.minZ - .05;
      const wood = theme === 'forest', base = wood ? '#98805a' : theme === 'desert' ? '#c0a174' : '#9da58c';
      mesh.floor(x, z, w, d, base, .003);
      for (let row = .05, index = 0; row < d - .05; row += wood ? .44 : .95, index++) {
        if (wood) {
          mesh.floor(x + .025, z + row, w - .05, Math.min(.40, d - row - .025), index % 2 ? '#a18b64' : '#8f7854', .004);
          for (let column = .6 + index % 2 * 1.1; column < w - .03; column += 2.2) mesh.floor(x + column, z + row, .014, Math.min(.40, d - row - .025), '#625a44', .005);
        } else for (let column = .05; column < w - .05; column += .95) mesh.floor(x + column, z + row, Math.min(.89, w - column - .025), Math.min(.89, d - row - .025), shade(rgba(base), (Math.round(column / .95) + index) % 2 ? .95 : 1.035), .004);
      }
      const side = find(`${building.id}-west`), face = 'east';
      if (side && side.d > 4) {
        wallPatch(mesh, side, face, 2.30, 1.04, 2.15, 1.16, wood ? '#584e3a' : '#776d54', .010);
        wallPatch(mesh, side, face, 2.36, 1.10, 2.03, 1.04, wood ? '#b9bd90' : '#c7bb8e', .012);
        if (wood) {
          for (const fraction of [.20, .52, .76]) {
            wallPatch(mesh, side, face, 2.47 + fraction * 1.65, 1.30, .11, .61, '#61826b', .014);
            wallPatch(mesh, side, face, 2.41 + fraction * 1.65, 1.57, .23, .19, '#61826b', .014);
          }
          wallPatch(mesh, side, face, 2.52, 1.25, 1.51, .024, '#8d7350', .016);
        } else {
          for (let row = 0; row < 4; row++) for (let column = 0; column < 6; column++) if ((row + column) % 3 !== 0) wallPatch(mesh, side, face, 2.52 + column * .26, 1.24 + row * .18, .13, .055, theme === 'desert' ? '#927346' : '#698979', .015);
        }
      }
    }
  } else if (theme === 'courtyard') {
    for (const side of ['west', 'east']) {
      const collider = find(`${side}-arcade`), color = side === 'west' ? '#dfa962' : '#68aaa2';
      if (!collider) continue;
      for (const face of ['north', 'south']) {
        wallPatch(mesh, collider, face, .24, 1.57, 2.02, .73, '#354648', .027);
        const label = face === 'south' ? (side === 'west' ? 'A <' : '> B') : (side === 'west' ? '> A' : 'B <');
        wallText(mesh, collider, face, label, .42, 1.73, .45, color, .034);
        wallPatch(mesh, collider, face, .28, .48, collider.w - .56, .08, color, .025);
      }
    }
    const central = find('central-north');
    if (central) for (const face of ['north', 'south']) {
      wallPatch(mesh, central, face, 3.53, 2.01, 2.94, .93, '#9b6851', .025);
      wallText(mesh, central, face, 'COURT', 3.75, 2.28, .49, '#edd9b3', .034);
    }
  } else if (theme === 'depot') {
    // Loading-lane markings sit on traversable asphalt, never on phantom kerbs.
    for (const x of [-10.2, 10.2]) {
      for (let z = -18; z < 19; z += 3.2) mesh.floor(x - .055, z, .11, 1.5, '#c8ac68', .005);
    }
    for (const site of map.sites) {
      mesh.floor(site.x - 2.75, site.z - 2.75, 5.5, .075, '#d6b35f', .005);
      mesh.floor(site.x - 2.75, site.z + 2.70, 5.5, .075, '#d6b35f', .005);
      for (const x of [site.x - 2.75, site.x + 2.70]) mesh.floor(x, site.z - 2.75, .075, 5.5, '#d6b35f', .005);
    }
    const central = find('mid-container');
    if (central) for (const face of ['west', 'east']) {
      wallPatch(mesh, central, face, .34, .42, .14, 2.32, '#d7b269', .032);
      wallText(mesh, central, face, '03', .79, 1.31, .82, '#eddfc7', .032);
    }
  } else if (theme === 'canal') {
    for (const side of ['west', 'east']) {
      const market = find(`${side}-market`), accent = side === 'west' ? '#527f81' : '#bf7f59';
      if (!market) continue;
      for (const face of ['north', 'south']) {
        wallPatch(mesh, market, face, .08, .19, market.w - .16, .55, accent, .024);
        for (let left = .10; left < market.w - .10; left += .72) wallPatch(mesh, market, face, left, 2.74, .33, .34, '#d6d4b6', .025);
        wallPatch(mesh, market, face, 2.25, 1.5, 2.5, .85, accent, .024);
        wallText(mesh, market, face, 'MARCHE', 2.38, 1.71, .40, '#eee2bf', .030);
      }
    }
    for (const id of ['canal-west-bank', 'canal-east-bank']) {
      const bank = find(id);
      if (!bank) continue;
      for (let z = bank.z + .20; z < bank.z + bank.d - .20; z += .38) mesh.floor(bank.x + .025, z, bank.w - .05, .035, '#d0cdb7', bank.y + bank.h + .003);
    }
  } else if (theme === 'rooftops') {
    // Flat service-lane paint keeps the alleys readable below the walkways.
    for (const x of [-10.5, 10.5]) for (let z = -17; z < 18; z += 3.2) mesh.floor(x, z, .085, 1.15, '#d9dfc9', .005);
    for (const collider of map.colliders) {
      if (collider.y > 2 && collider.h < .8) {
        const top = collider.y + collider.h;
        mesh.floor(collider.x + .08, collider.z + .08, collider.w - .16, .08, '#719e98', top + .003);
        mesh.floor(collider.x + .08, collider.z + collider.d - .16, collider.w - .16, .08, '#719e98', top + .003);
      }
    }
  } else if (theme === 'foundry') {
    for (const x of [-10, 10]) for (let z = -18; z < 18; z += 3) mesh.floor(x - .08, z, .16, 1.4, '#caa063', .005);
    for (const collider of map.colliders) {
      if (collider.h > 1.8 && collider.w > 3 && collider.y < .1 && !String(collider.id).startsWith('wall-')) {
        for (const face of ['north', 'south']) {
          wallPatch(mesh, collider, face, .15, .38, collider.w - .3, .08, '#d2a16a', .021);
          for (let left = .2; left < collider.w - .25; left += .48) wallPatch(mesh, collider, face, left, .58, .15, .16, '#c48b52', .021);
        }
      }
    }
  } else if (theme === 'bastion') {
    for (const x of [-12.5, 12.5]) {
      for (let z = -17; z < 18; z += 1.5) mesh.floor(x - .24, z, .48, .14, '#bdc3aa', .005);
    }
    for (const collider of map.colliders) {
      if (collider.h > 2.4 && collider.w > 3 && collider.y < .1) {
        for (const face of ['north', 'south']) {
          wallPatch(mesh, collider, face, .06, 1.1, collider.w - .12, .12, '#8c9d85', .021);
          wallPatch(mesh, collider, face, .06, collider.h - .40, collider.w - .12, .10, '#c4ba88', .021);
        }
      }
    }
  }
  if (['rooftops', 'foundry', 'bastion'].includes(theme)) {
    const sign = map.colliders.find(collider => collider.w >= 5 && collider.h >= 2.7 && collider.y < .1 && !String(collider.id).startsWith('wall-'));
    if (sign) {
      const label = theme === 'rooftops' ? 'ROOFLINE' : theme === 'foundry' ? 'FOUNDRY' : 'BASTION';
      const width = Math.min(4.2, sign.w - .4), left = (sign.w - width) / 2;
      for (const face of ['north', 'south']) {
        wallPatch(mesh, sign, face, left, 1.72, width, .78, '#314748', .026);
        wallText(mesh, sign, face, label, left + .15, 1.91, .42, '#e5d2a4', .034);
      }
    }
  }
  landmarkArt(mesh, map, theme);
  routePaint(mesh, map);
}

export function mapMeshes(map) {
  const opaque = new Mesh(), shadows = new Mesh();
  const bounds = map.bounds || { minX: -25, maxX: 25, minZ: -25, maxZ: 25 };
  const theme = map.theme || map.id;
  const art = ART[theme] || ART.courtyard;
  const floorColor = mix(rgba(map.floorColor || '#929b8b'), rgba(art.paving), .36);
  const { minX, maxX, minZ, maxZ } = bounds;
  const width = maxX - minX, depth = maxZ - minZ;
  opaque.floor(minX - 35, minZ - 35, width + 70, depth + 70, shade(floorColor, .72), -.025);
  opaque.floor(minX, minZ, width, depth, floorColor, 0);
  // Repeating paving seams are flat markings, so visible traversable ground is
  // identical to collision ground. A single GPU mesh serves the entire map.
  const tile = art.tile;
  for (let x = minX; x < maxX; x += tile) for (let z = minZ; z < maxZ; z += tile) {
    const seed = hash(`${map.id}:${x}:${z}`), lane = theme === 'courtyard' && Math.abs(Math.abs(x + tile / 2) - 11) < 2;
    const tint = shade(floorColor, .94 + seed % 5 * .022);
    opaque.floor(x + .025, z + .025, Math.min(tile - .05, maxX - x - .025), Math.min(tile - .05, maxZ - z - .025), lane ? mix(tint, rgba('#94a09a'), .25) : tint, .001);
    if (theme === 'depot' && seed % 4 === 0) opaque.floor(x + .27, z + .57, tile * .49, tile * .44, shade(floorColor, .89), .002);
    if (theme === 'forest') {
      opaque.floor(x + .36 + seed % 13 / 10, z + .28 + seed % 17 / 10, .42, .14, shade(floorColor, .78), .002);
      if (seed % 3 === 0) opaque.floor(x + .58, z + .72, .09, .25, '#adab6c', .003);
    }
    if (theme === 'desert') for (let i = 0; i < 2; i++) opaque.floor(x + .35 + i * .28, z + .65 + i * 1.15, 2.4 - i * .5, .025, shade(floorColor, .90), .002);
    if (theme === 'maze' && seed % 3 === 0) opaque.floor(x + .35, z + .42, .81, .31, '#728b71', .002);
  }
  const atmosphere = ATMOSPHERE[theme] || ATMOSPHERE.courtyard;
  for (const collider of map.colliders || []) {
    paintCollider(opaque, collider, theme);
    if (collider.h < .15 || collider.overhead) continue;
    const sun = atmosphere.sun, elevation = collider.y + collider.h, dx = -sun[0] / sun[1] * elevation, dz = -sun[2] / sun[1] * elevation;
    for (let layer = 3; layer >= 0; layer--) {
      const soft = .035 + layer * .075;
      const corners = [[collider.x - soft, collider.z - soft], [collider.x + collider.w + soft, collider.z - soft], [collider.x + collider.w + soft, collider.z + collider.d + soft], [collider.x - soft, collider.z + collider.d + soft]];
      shadows.floorPolygon([...corners, ...corners.map(point => [point[0] + dx, point[1] + dz])], [.075, .095, .13, .062], (theme === 'dojo' ? .020 : .005) + (3 - layer) * .0003);
    }
    shadows.floor(collider.x - .08, collider.z - .08, collider.w + .16, collider.d + .16, [.055, .07, .08, .22], theme === 'dojo' ? .022 : .007);
  }
  mapPaint(opaque, map, theme);
  for (const site of map.sites || []) {
    const color = site.id === 'A' ? rgba('#d9ae72') : rgba('#69bcb6');
    const radius = site.radius || 2.2;
    opaque.floorRing(site.x, site.z, radius - .045, radius + .045, color);
    floorLetter(opaque, site.id, site.x, site.z, 1.25, color);
    for (let i = 0; i < 4; i++) {
      const angle = i * Math.PI / 2;
      opaque.floor(site.x + Math.sin(angle) * (radius + .20) - .075, site.z + Math.cos(angle) * (radius + .20) - .075, .15, .15, color);
    }
  }
  // Only skyline geometry sits outside the collision perimeter. It cannot
  // create misleading obstacles, routes, or peek-through decorative windows.
  const skylineColor = rgba(art.skyline);
  const backdrop = (axis, side, start, length) => {
    for (let i = 0; i < length; i += theme === 'paris' ? 9 : ROYALE_THEMES.has(theme) ? 8 : 4.5) {
      const seed = hash(`${map.id}:${axis}:${side}:${i}`), h = 6 + seed % 7;
      const x = axis === 'x' ? side : start + i;
      const z = axis === 'z' ? side : start + i;
      const w = axis === 'x' ? 4 : 4.1, d = axis === 'z' ? 4 : 4.1;
      const c = shade(skylineColor, .80 + (seed % 4) * .07);
      if (theme === 'dojo') {
        for (let tier = 0; tier < 3; tier++) opaque.box(x - .3 + tier * .5, -.10 + tier * 1.35, z - .3 + tier * .5, 6.1 - tier, 1.6, 6.1 - tier, shade(c, .90 + tier * .05));
        continue;
      }
      if (theme === 'forest' || theme === 'snow') {
        opaque.box(x + 1.65, -.05, z + 1.65, .70, h + 1, .70, '#5a6650');
        for (let tier = 0; tier < 4; tier++) {
          const spread = 5 - tier * .82;
          opaque.box(x + 2 - spread / 2, 3.2 + tier * 1.4, z + 2 - spread / 2, spread, 1.85, spread, shade(c, .83 + tier * .07));
          if (theme === 'snow') opaque.floor(x + 2 - spread / 2, z + 2 - spread / 2, spread, spread, '#dce9ee', 5.052 + tier * 1.4);
        }
        continue;
      }
      if (theme === 'desert') {
        // Distant stepped dunes, never city towers or walls inside the arena.
        for (let tier = 0; tier < 3; tier++) opaque.box(x - 1 + tier * .8, -.10 + tier * 1.0, z - 1 + tier * .8, 8 - tier * 1.6, 1.2, 8 - tier * 1.6, shade(c, .94 + tier * .035));
        continue;
      }
      if (theme === 'maze') {
        for (let tier = 0; tier < 3; tier++) opaque.box(x + tier * .18, -.10 + tier * 1.6, z + tier * .18, 5.6 - tier * .36, 1.8, 5.6 - tier * .36, shade(c, .84 + tier * .09));
        continue;
      }
      if (theme === 'paris') {
        const building = { x, y: -.05, z, w, h, d };
        opaque.box(x, -.05, z, w, h, d, c);
        // Skyline backs face away from every playable camera position. Keep
        // their complete building silhouette, but spend window/cornice detail
        // only on street faces visible from inside the collision perimeter.
        const streetFaces = ['north', 'south', 'west', 'east'].filter(face => face === 'north' ? z > bounds.minZ
          : face === 'south' ? z + d < bounds.maxZ : face === 'west' ? x > bounds.minX : x + w < bounds.maxX);
        for (const face of streetFaces) {
          const faceWidth = face === 'north' || face === 'south' ? w : d;
          wallPatch(opaque, building, face, .04, h - .24, faceWidth - .08, .10, '#e0d3b8', .004);
          for (let level = 2.12; level < h - 1.12; level += 1.9) {
            wallPatch(opaque, building, face, .04, level - .13, faceWidth - .08, .032, shade(c, 1.12), .004);
            for (let slot = .45; slot < faceWidth - .95; slot += 1.75) {
              wallPatch(opaque, building, face, slot, level, .73, .98, '#716e65', .005);
              wallPatch(opaque, building, face, slot + .06, level + .06, .61, .84, '#526e76', .007);
              wallPatch(opaque, building, face, slot + .33, level + .06, .025, .84, '#d1c4aa', .009);
              wallPatch(opaque, building, face, slot + .06, level + .43, .61, .025, '#d1c4aa', .009);
            }
          }
        }
        // Stepped zinc mansards and dormers are outside the playable perimeter.
        // Inside the arena, every rooftop remains the exact shared collider.
        for (let tier = 0; tier < 3; tier++) opaque.box(x + tier * .31, h + tier * .39, z + tier * .31, w - tier * .62, .43, d - tier * .62, shade(rgba('#576b79'), .95 + tier * .06));
        opaque.box(x + .58, h + .23, z + .45, .54, .65, .63, '#c4bba7');
        opaque.box(x + w - 1.10, h + .35, z + d - 1.00, .47, 1.08, .51, '#a2917b');
        continue;
      }
      opaque.box(x, -.05, z, w, h, d, c);
      opaque.box(x - .07, h - .2, z - .07, w + .14, .18, d + .14, shade(c, .70));
      if (theme === 'courtyard') opaque.box(x + .16, h, z + .16, w - .32, .30, d - .32, mix(c, rgba('#ad8971'), .34));
      if ((theme === 'depot' || theme === 'foundry') && seed % 3 === 0) {
        opaque.box(x + .45, h, z + .45, 1.4, .72, 1.6, shade(c, .72));
        opaque.box(x + 2.50, h, z + 1.1, .38, 2.3, .38, '#80634f');
      }
      if (theme === 'canal') {
        opaque.box(x + .1, h, z + .1, w - .2, .40, d - .2, mix(c, rgba('#b48369'), .42));
        opaque.box(x + .65, h + .4, z + .8, 2.6, .35, 2.4, mix(c, rgba('#b48369'), .54));
      }
      if (theme === 'rooftops') opaque.box(x + .1, h, z + .1, w - .2, .18, d - .2, '#c4cbb9');
      if (theme === 'bastion') {
        for (let xx = x + .2; xx < x + w - .25; xx += 1.1) opaque.box(xx, h, z + .1, .55, .48, .52, mix(c, rgba('#9eaa98'), .22));
      }
      if (seed % 4 === 0) {
        const xx = x + 1.2, zz = z + 1.4;
        opaque.box(xx, h - .02, zz, .075, 1.70, .075, '#4b626b');
        opaque.box(xx - .55, h + 1.14, zz, 1.18, .055, .055, '#4b626b');
        opaque.box(xx - .35, h + 1.54, zz, .78, .055, .055, '#4b626b');
        opaque.box(x + 2.5, h, z + .55, .68, .40, .75, shade(c, .80));
      }
      for (let level = 1.8; level < h - .8; level += 1.55) {
        for (let slot = .55; slot < 3.8; slot += 1.15) {
          const glass = ((seed + Math.round(level * 10) + Math.round(slot * 7)) % 4 === 0) ? '#bcaa79' : '#526d76';
          // Outward backdrop faces on both axes remain aligned to their walls.
          const building = { x, y: 0, z, w, d };
          for (const face of ['north', 'south', 'west', 'east']) wallPatch(opaque, building, face, slot, level, .48, .62, glass, .012);
        }
      }
    }
  };
  const indoor = ['sewers', 'trading', 'market', 'lockdown'].includes(theme);
  if (!indoor) {
    backdrop('z', minZ - 11, minX - 8, width + 16);
    backdrop('z', maxZ + 7, minX - 8, width + 16);
    backdrop('x', minX - 11, minZ - 8, depth + 16);
    backdrop('x', maxX + 7, minZ - 8, depth + 16);
  }
  if (theme === 'paris') opaque.append(parisLandmarkMesh(bounds));
  const cloud = rgba(art.cloud);
  for (let i = 0; i < (indoor ? 0 : 6); i++) {
    const seed = hash(`${map.id}:cloud:${i}`), xx = minX - 22 + i * 17, zz = minZ - 28 + (seed % 35), yy = 23 + seed % 7;
    opaque.box(xx, yy, zz, 8 + seed % 5, .65, 3.6, cloud);
    opaque.box(xx + 2, yy + .62, zz + .7, 5.5, .65, 2.5, shade(cloud, 1.025));
    opaque.box(xx + 7, yy - .35, zz + .45, 4.5, .40, 2.5, shade(cloud, .94));
  }
  return { opaque: opaque.array, shadows: shadows.array };
}

/** Original low-cost Eiffel silhouette: all of it stays beyond the north wall. */
export function parisLandmarkMesh(bounds) {
  const mesh = new Mesh(), centerX = (bounds.minX + bounds.maxX) / 2 - 9, centerZ = bounds.minZ - 24;
  const iron = '#716a58', warm = '#91846b', dark = '#575b51';
  const corner = (sx, sz, spread, y) => [centerX + sx * spread, y, centerZ + sz * spread];
  const levels = [{ y: 0, spread: 6.7 }, { y: 3, spread: 5.6 }, { y: 6, spread: 4.3 }, { y: 9, spread: 3.1 }, { y: 13.5, spread: 2.1 }, { y: 18, spread: 1.25 }, { y: 22, spread: .70 }, { y: 26, spread: .32 }];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    mesh.box(centerX + sx * 6.7 - .72, 0, centerZ + sz * 6.7 - .72, 1.44, .42, 1.44, '#b8ab8e');
    for (let i = 1; i < levels.length; i++) {
      const a = levels[i - 1], b = levels[i];
      mesh.beam(corner(sx, sz, a.spread, a.y), corner(sx, sz, b.spread, b.y), i < 4 ? .52 : .31, sx === sz ? warm : iron);
    }
  }
  // Leave the recognizable ground arch open below the first platform.
  for (let level = 3; level < levels.length; level++) {
    const below = levels[level - 1], above = levels[level];
    for (const side of [-1, 1]) {
      mesh.beam(corner(-1, side, below.spread, below.y + .18), corner(1, side, above.spread, above.y), .12, dark);
      mesh.beam(corner(1, side, below.spread, below.y + .18), corner(-1, side, above.spread, above.y), .12, dark);
      mesh.beam(corner(side, -1, below.spread, below.y + .18), corner(side, 1, above.spread, above.y), .12, iron);
      mesh.beam(corner(side, 1, below.spread, below.y + .18), corner(side, -1, above.spread, above.y), .12, iron);
    }
  }
  for (const { y, spread } of [levels[3], levels[5]]) {
    mesh.box(centerX - spread - .32, y - .22, centerZ - spread - .32, spread * 2 + .64, .40, spread * 2 + .64, warm);
    for (const sx of [-1, 1]) mesh.box(centerX + sx * (spread + .22) - .04, y + .18, centerZ - spread - .26, .08, .33, spread * 2 + .52, dark);
    for (const sz of [-1, 1]) mesh.box(centerX - spread - .26, y + .18, centerZ + sz * (spread + .22) - .04, spread * 2 + .52, .33, .08, dark);
  }
  mesh.box(centerX - .40, 25.8, centerZ - .40, .80, 1.18, .80, warm);
  mesh.box(centerX - .19, 26.98, centerZ - .19, .38, 2.05, .38, iron);
  mesh.box(centerX - .055, 29.03, centerZ - .055, .11, 2.58, .11, dark);
  return mesh.array;
}

/** Rotate an opened barrel around its breech, clipping each physical face in
 * gun space before the regular held transform. A thin wall cannot recreate it. */
function hingedWeaponPart(mesh, item, pose, limit, hinge, angle) {
  const colors = boxColors(item.color);
  const local = point => { const value = rotate([point[0], point[1], point[2] - hinge], 0, angle); value[2] += hinge; return value; };
  const world = point => { const value = rotate(point.map(value => value * finite(pose.scale, 1)), pose.yaw, pose.pitch); return value.map((value, axis) => value + [pose.x, pose.y, pose.z][axis]); };
  for (let face = 0; face < BOX_FACES.length; face++) {
    const { corners, normal } = BOX_FACES[face];
    const polygon = corners.map(corner => local([corner & 1 ? item.x + item.w : item.x, corner & 2 ? item.y + item.h : item.y, corner & 4 ? item.z + item.d : item.z]));
    const clipped = [];
    for (let at = 0; at < polygon.length; at++) {
      const current = polygon[at], previous = polygon[(at + polygon.length - 1) % polygon.length], currentInside = current[2] >= -limit, previousInside = previous[2] >= -limit;
      if (currentInside !== previousInside) {
        const ratio = (-limit - previous[2]) / (current[2] - previous[2]);
        clipped.push([lerp(previous[0], current[0], ratio), lerp(previous[1], current[1], ratio), -limit]);
      }
      if (currentInside) clipped.push(current);
    }
    const transformed = clipped.map(world), outward = rotate(rotate(normal, 0, angle), pose.yaw, pose.pitch);
    for (let at = 1; at < transformed.length - 1; at++) for (const point of [transformed[0], transformed[at], transformed[at + 1]]) mesh.vertex(point, outward, colors[face]);
  }
}

const weaponVisualModel = weapon => valorantModel(weapon) || legacyShotgunModel(weapon);
const weaponLength = weapon => weaponVisualModel(weapon)?.length || ({ pistol: .42, smg: .68, marksman: 1.04, shotgun: 1.02, burst: .87, sniper: 1.26, lmg: 1.08, crossbow: .83, revolver: .51, pdw: .80, autoshotgun: .93, battlerifle: 1.14, dualpistols: .46, dualsmg: .61, slugshotgun: 1.12 })[weapon] || .92;
const reloadMagazineDrop = (weapon, progress) => Math.max(...[0, 1].map(hand => weaponReloadPose(weapon, progress, { active: progress > 0, hand }).magazineDrop));
const weaponCoverPadding = (weapon, scale = 1, reloadProgress = 0) => {
  const authored = weaponVisualModel(weapon);
  if (authored) {
    const open = weaponReloadPose(weapon, reloadProgress, { active: reloadProgress > 0 }).breakOpen || 0;
    return (authored.coverPadding + reloadMagazineDrop(weapon, reloadProgress) + open * Math.sin(.42) * (authored.length + finite(authored.breakHingeZ))) * scale;
  }
  const width = weapon === 'crossbow' ? .51 : weapon === 'lmg' ? .28 : weapon === 'sniper' ? .18 : weapon === 'revolver' ? .26 : weapon === 'autoshotgun' ? .18 : .11;
  const height = (weapon === 'pistol' ? .22 : weapon === 'lmg' ? .30 : weapon === 'autoshotgun' ? .36 : .29) + (weapon === 'revolver' ? 0 : reloadMagazineDrop(weapon, reloadProgress));
  return Math.max(width, height) * scale;
};

function weaponParts(mesh, weapon, pose, options = {}) {
  if (WEAPONS[weapon]?.dualWield && !Number.isInteger(options.hand)) {
    for (const hand of [0, 1]) {
      const offset = rotate([hand === 0 ? .15 : -.15, 0, 0], pose.yaw, pose.pitch).map(value => value * finite(pose.scale, 1));
      weaponParts(mesh, weapon, { ...pose, x: pose.x + offset[0], y: pose.y + offset[1], z: pose.z + offset[2] }, { ...options, hand });
    }
    return weaponLength(weapon);
  }
  const pistol = weapon === 'pistol', shotgun = weapon === 'shotgun', burst = weapon === 'burst';
  const rifle = !pistol, smg = weapon === 'smg', marksman = weapon === 'marksman', sniper = weapon === 'sniper', lmg = weapon === 'lmg';
  const scoped = !!WEAPONS[weapon]?.scoped;
  const length = weaponLength(weapon);
  const limit = options.limit ?? length + .20;
  const body = rgba(options.body || (smg ? '#4f747c' : sniper ? '#677961' : lmg ? '#76764d' : marksman ? '#526976' : shotgun ? '#7b5f43' : burst ? '#805b4f' : pistol ? '#607b91' : '#56685f')), trim = '#202d32', metal = '#b2bfb7';
  const stock = rgba(options.stock || (shotgun ? '#a37a4f' : sniper ? '#7e8c70' : '#8a927d'));
  const reloadMotion = options.reloadMotion || weaponReloadPose(weapon, finite(options.reloadProgress), { active: options.reloadActive ?? finite(options.reloadProgress) > 0, hand: options.hand });
  const reload = reloadMotion.active ? reloadMotion.progress : 0, magazineDrop = reloadMotion.magazineDrop;
  const mechanicalBolt = Math.max(clamp(finite(options.bolt), 0, 1), reloadMotion.bolt), mechanicalPump = Math.max(clamp(finite(options.pump), 0, 1), reloadMotion.pump);
  const part = (x, y, z, w, h, d, color) => {
    // The weapon points down local -Z. Clamp each part at the first solid
    // cover contact so a barrel cannot reappear through a thin wall.
    const clippedZ = Math.max(z, -limit);
    const clippedDepth = z + d - clippedZ;
    if (clippedDepth > 0) mesh.box(x, y, clippedZ, w, h, clippedDepth, color, pose);
  };
  const magazine = (...args) => { if (reloadMotion.magazineVisible) part(...args); };
  const detail = (points, normal, color) => {
    if (points.every(point => point[2] < -limit)) return;
    const transform = point => {
      const clipped = [point[0], point[1], Math.max(point[2], -limit)];
      const rotated = rotate(pose.scale ? clipped.map(value => value * pose.scale) : clipped, pose.yaw, pose.pitch);
      return rotated.map((value, axis) => value + [pose.x, pose.y, pose.z][axis]);
    };
    mesh.quad(...points.map(transform), rotate(normal, pose.yaw, pose.pitch), rgba(color));
  };
  const side = (x, y, z, h, d, color) => detail([[x, y, z], [x, y + h, z], [x, y + h, z + d], [x, y, z + d]], [x < 0 ? -1 : 1, 0, 0], color);
  const top = (x, y, z, w, d, color) => detail([[x, y, z], [x, y, z + d], [x + w, y, z + d], [x + w, y, z]], [0, 1, 0], color);
  const bore = (width, height, z, y = -.008) => detail([[-width / 2, y, z], [-width / 2, y + height, z], [width / 2, y + height, z], [width / 2, y, z]], [0, 0, -1], '#101d21');
  const string = (a, b, width, color) => {
    if (Math.max(a[2], b[2]) < -limit) return;
    const dx = b[0] - a[0], dz = b[2] - a[2], length = Math.hypot(dx, dz) || 1;
    const offset = [-dz / length * width / 2, 0, dx / length * width / 2];
    const transform = point => {
      const clipped = [point[0], point[1], Math.max(point[2], -limit)];
      const rotated = rotate(pose.scale ? clipped.map(value => value * pose.scale) : clipped, pose.yaw, pose.pitch);
      return [rotated[0] + pose.x, rotated[1] + pose.y, rotated[2] + pose.z];
    };
    const points = [a.map((v, i) => v - offset[i]), a.map((v, i) => v + offset[i]), b.map((v, i) => v + offset[i]), b.map((v, i) => v - offset[i])].map(transform);
    const normal = rotate([0, 1, 0], pose.yaw, pose.pitch), tint = rgba(color);
    // A two-sided continuous ribbon reads as a taut string from either side,
    // using fewer triangles than disconnected tiny boxes along its length.
    mesh.quad(...points, normal, tint);
    mesh.quad(...[...points].reverse(), normal.map(value => -value), tint);
  };
  const ironSights = (front, rear = -.15, hinge = null, frontBase = .109) => {
    // Authored shotgun stalks reach their actual rib/barrel surface. The same
    // existing box keeps its exact .152m tip and open sight line; no floating
    // post, additional pedestal geometry or changed muzzle/cover budget.
    const frontHeight = frontBase === .109 ? .043 : .152 - frontBase;
    const frontMetal = frontBase === .109 ? '#c3d2bc' : '#53686a';
    part(-.036, .112, rear, .017, .040, .035, '#253237');
    part(.019, .112, rear, .017, .040, .035, '#253237');
    if (hinge) {
      hingedWeaponPart(mesh, { x: -.008, y: frontBase, z: front, w: .016, h: frontHeight, d: .025, color: frontMetal }, pose, limit, hinge.z, hinge.angle);
      hingedWeaponPart(mesh, { x: -.004, y: .142, z: front - .002, w: .008, h: .010, d: .005, color: '#c8e6b4' }, pose, limit, hinge.z, hinge.angle);
    } else {
      part(-.008, frontBase, front, .016, frontHeight, .025, frontMetal);
      part(-.004, .142, front - .002, .008, .010, .005, '#c8e6b4');
    }
    part(-.031, .137, rear + .036, .010, .010, .004, '#bdd4ae');
    part(.021, .137, rear + .036, .010, .010, .004, '#bdd4ae');
  };
  const authored = weaponVisualModel(weapon);
  if (authored) {
    const breakAngle = -.42 * finite(reloadMotion.breakOpen), pumpTravel = finite(authored.pumpTravel, .16);
    // All new weapons share the proven cut plane and pooled batches, but their
    // authored silhouettes, magazines, scopes and barrel ports are independent.
    for (const item of authored.parts) {
      if (item.motion === 'break' && breakAngle) { hingedWeaponPart(mesh, item, pose, limit, authored.breakHingeZ, breakAngle); continue; }
      if (item.motion === 'magazine' && !reloadMotion.magazineVisible) continue;
      const x = item.x - (item.motion === 'cylinder' ? reloadMotion.cylinder * .15 : 0);
      const y = item.y - (item.motion === 'magazine' ? magazineDrop : 0) + (item.motion === 'lid' ? reloadMotion.lid * .13 : 0);
      const z = item.z + (item.motion === 'bolt' ? mechanicalBolt * .09 : item.motion === 'pump' ? mechanicalPump * pumpTravel : item.motion === 'magazine' ? magazineDrop * .12 : item.motion === 'lid' ? reloadMotion.lid * .04 : 0);
      part(x, y, z, item.w, item.h, item.d, item.color);
    }
    for (const item of authored.details) {
      if (item.motion === 'magazine' && !reloadMotion.magazineVisible) continue;
      const args = item.args, shiftX = item.motion === 'cylinder' ? -reloadMotion.cylinder * .15 : 0;
      const shiftY = item.motion === 'magazine' ? -magazineDrop : 0;
      const shiftZ = item.motion === 'pump' ? mechanicalPump * pumpTravel : item.motion === 'magazine' ? magazineDrop * .12 : 0;
      const [x, y, z, a, b, color] = args;
      let points, normal;
      if (item.kind === 'side') {
        points = [[x, y, z], [x, y + a, z], [x, y + a, z + b], [x, y, z + b]];
        normal = [x < 0 ? -1 : 1, 0, 0];
      } else if (item.kind === 'top') {
        points = [[x, y, z], [x, y, z + b], [x + a, y, z + b], [x + a, y, z]];
        normal = [0, 1, 0];
      } else if (item.kind === 'front') {
        points = [[x, y, z], [x, y + b, z], [x + a, y + b, z], [x + a, y, z]];
        normal = [0, 0, -1];
      } else continue;
      points = points.map(point => [point[0] + shiftX, point[1] + shiftY, point[2] + shiftZ]);
      if (item.motion === 'break' && breakAngle) {
        points = points.map(point => { const p = rotate([point[0], point[1], point[2] - authored.breakHingeZ], 0, breakAngle); p[2] += authored.breakHingeZ; return p; });
        normal = rotate(normal, 0, breakAngle);
      }
      detail(points, normal, color);
    }
    if (!authored.scoped) ironSights(-authored.length + .042, -.073, breakAngle ? { z: authored.breakHingeZ, angle: breakAngle } : null, finite(authored.frontSightBase, .109));
    if (authored.breakHingeZ !== null && reloadMotion.shellVisible) {
      for (let shell = 0; shell < 2; shell++) {
        const y = (shell === 0 ? .035 : -.034) - (1 - reloadMotion.shell) * .13;
        const z = authored.breakHingeZ + .04 + (1 - reloadMotion.shell) * .10, depth = weapon === 'shorty' ? .056 : .087;
        part(-.018, y - .017, z, .036, .034, depth, '#a88a5f');
        part(-.019, y - .018, z + depth - .010, .038, .036, .012, '#d3ba7e');
      }
    }
    if (authored.family === 'shotgun' && authored.breakHingeZ === null && reloadMotion.shellVisible) {
      // Tube-fed guns insert one visible hull at the accepted loading hand;
      // their brass rim travels with it rather than floating on the receiver.
      const shell = reloadMotion.shell;
      part(-.09, -.20 + shell * .067, -.25 + shell * .04, .033, .073, .033, '#a76f4e');
      part(-.091, -.132 + shell * .067, -.25 + shell * .04, .035, .014, .035, '#c5b17b');
    }
    if (weapon === 'sheriff') {
      for (let chamber = 0; chamber < 6; chamber++) {
        const angle = chamber * TAU / 6, x = Math.sin(angle) * .052 - reloadMotion.cylinder * .15, y = .03 + Math.cos(angle) * .043;
        detail([[x - .011, y - .009, -.283], [x - .011, y + .009, -.283], [x + .011, y + .009, -.283], [x + .011, y - .009, -.283]], [0, 0, -1], reloadMotion.cylinder > .2 ? '#b8a06f' : '#213640');
      }
    }
    return authored.length;
  }
  if (weapon === 'dualpistols' || weapon === 'dualsmg') {
    const automatic = weapon === 'dualsmg', slide = mechanicalBolt * .046;
    const casing = automatic ? '#576d79' : '#b7c0b6', accent = automatic ? '#b49162' : '#907454';
    // Each hand has a complete compact firearm. Flush vent paint and a small
    // number of solid parts keep ten paired loadouts below the shared budget.
    part(-.047, -.026, automatic ? -.44 : -.39, .094, automatic ? .128 : .09, automatic ? .43 : .35, casing);
    part(-.047, automatic ? .102 : .064, (automatic ? -.435 : -.395) + slide, .094, .031, automatic ? .37 : .35, automatic ? '#7e969e' : '#d4d9cd');
    part(-.032, -.19, -.087, .064, .172, .089, '#324650');
    magazine(-.034, -.190 - magazineDrop, -.085, .068, .043, .088, accent);
    part(-.046, -.098, -.19, .013, .067, .102, trim);
    part(.033, -.098, -.19, .013, .067, .102, trim);
    part(-.046, -.108, -.19, .092, .015, .102, trim);
    part(-.028, .006, -length - .022, .056, .047, automatic ? .18 : .078, '#455963');
    if (automatic) {
      magazine(-.032, -.253 - magazineDrop, -.285, .064, .230, .098, '#394f58');
      magazine(-.033, -.253 - magazineDrop, -.286, .066, .026, .10, accent);
      part(-.053, -.040, -.39, .106, .045, .066, '#384e57');
    }
    for (const xx of [-.0475, .0475]) {
      side(xx, automatic ? .034 : .07, -.30 + slide, .014, .062, '#2a414b');
      side(xx, -.126, -.064, .041, .034, accent);
    }
    bore(.027, .032, -length - .023, .012);
    ironSights(-length + .053, -.072);
    return length;
  }
  if (weapon === 'revolver') {
    // An exposed six chamber cylinder, brushed steel frame and walnut grip
    // give this hand cannon a silhouette distinct from the magazine pistol.
    const open = reloadMotion.cylinder, cylinderX = -.145 * open;
    part(-.042, -.041, -.30, .084, .138, .27, '#9ca9a9');
    part(-.028, -.006, -length - .025, .056, .068, .235, '#bbc6c2');
    part(-.035, .062, -.50, .070, .032, .20, '#718d96');
    part(-.041, -.189, -.080, .082, .153, .103, '#735948');
    part(-.043, -.191, -.080, .086, .022, .105, '#3d3936');
    side(-.043, -.154, -.071, .087, .070, '#b28b61');
    side(.043, -.154, -.071, .087, .070, '#b28b61');
    part(-.061, -.010, -.072, .122, .032, .036, '#748b94');
    part(-.045, -.106, -.178, .018, .048, .105, trim);
    part(.027, -.106, -.178, .018, .048, .105, trim);
    part(-.033, -.109, -.178, .066, .016, .105, trim);
    part(cylinderX - .065, -.034, -.286, .130, .137, .156, '#85979b');
    part(cylinderX - .085, -.005, -.272, .170, .080, .128, '#a8b6b7');
    part(cylinderX - .044, -.044, -.267, .088, .155, .120, '#8b9d9f');
    for (let chamber = 0; chamber < 6; chamber++) {
      const angle = chamber * TAU / 6 + clamp(finite(options.cycle), 0, 1) * TAU / 6;
      const xx = cylinderX + Math.sin(angle) * .053, yy = .031 + Math.cos(angle) * .051;
      detail([[xx - .010, yy - .011, -.287], [xx - .010, yy + .011, -.287], [xx + .010, yy + .011, -.287], [xx + .010, yy - .011, -.287]], [0, 0, -1], open > .20 ? '#bfa979' : '#34474c');
      if (reload > .25 && reload < .67) part(xx - .008, yy - .04 * open, -.233 + open * .075, .016, .022, .040, '#c6b482');
    }
    part(.045, .029, -.12, .018, .025, .035, '#cfb692');
    part(-.021, .080, -.045, .042, .026, .040, '#4d656f');
    bore(.034, .039, -length - .026, .004);
    ironSights(-.48, -.06);
    return length;
  }
  if (['pdw', 'battlerifle'].includes(weapon)) {
    const compact = weapon === 'pdw';
    const receiver = compact ? '#477d88' : '#4f627e';
    const lengthBody = compact ? .36 : .47;
    part(-.069, -.055, -lengthBody, .138, .145, lengthBody + .02, receiver);
    part(-.048, .080, -.34, .096, .032, .29, '#293f49');
    part(-.030, -.177, -.026, .060, .126, .086, '#334c55');
    part(-.035, -.126, -.117, .012, .067, .107, trim);
    part(.023, -.126, -.117, .012, .067, .107, trim);
    part(-.035, -.129, -.117, .070, .013, .107, trim);
    const stockDepth = compact ? .14 : .25;
    part(-.058, -.047, -.010, .116, .113, stockDepth, compact ? '#689397' : '#748297');
    part(-.065, -.060, stockDepth - .035, .130, .138, .040, trim);
    side(-.059, -.036, .021, .072, stockDepth - .085, stock);
    side(.059, -.036, .021, .072, stockDepth - .085, stock);
    if (compact) {
      // A short receiver, long integral suppressor, forward ribbed grip and
      // straight rear magazine make the quiet PDW readable at any distance.
      part(-.053, -.027, -.520, .106, .090, .19, '#31515d');
      part(-.044, -.009, -length - .035, .088, .080, .30, '#284851');
      part(-.046, .070, -.625, .092, .016, .093, '#6697a0');
      for (let band = 0; band < 3; band++) part(-.047, -.012, -.75 + band * .083, .094, .083, .011, '#4d6e76');
      magazine(-.034, -.242 - magazineDrop, -.075, .068, .212, .100, '#42616a');
      magazine(-.035, -.240 - magazineDrop, -.076, .070, .038, .102, '#8cb3b4');
      part(-.039, -.134, -.405, .078, .098, .084, '#436976');
      for (let rib = 0; rib < 3; rib++) side(-.040, -.113 + rib * .025, -.40, .008, .066, '#83abae');
      side(.070, -.013, -.23, .060, .105, '#183a43');
      part(.066, .014, -.18 + mechanicalBolt * .04, .035, .022, .038, '#abc1bf');
      bore(.050, .045, -length - .036, .010);
    } else {
      // A long ventilated handguard, substantial box magazine and broad
      // shoulder stock distinguish the heavy battle rifle from the carbine.
      part(-.061, -.034, -.79, .122, .106, .39, '#526b83');
      part(-.027, -.011, -length - .034, .054, .060, .39, '#a8b9bb');
      part(-.045, -.018, -length - .035, .090, .076, .082, '#3c556a');
      magazine(-.054, -.257 - magazineDrop, -.19 + magazineDrop * .13, .108, .227, .153, '#3f536b');
      magazine(-.056, -.251 - magazineDrop, -.192 + magazineDrop * .13, .112, .037, .157, '#9baeb2');
      for (let vent = 0; vent < 5; vent++) {
        side(-.062, -.005, -.755 + vent * .068, .036, .029, '#233c52');
        side(.062, -.005, -.755 + vent * .068, .036, .029, '#233c52');
      }
      top(-.052, .074, -.75, .104, .20, '#879eaa');
      side(.070, -.010, -.365, .049, .141, '#2b4155');
      part(.068, .021, -.26 + mechanicalBolt * .10, .047, .025, .056, metal);
      part(-.066, .043, .085, .132, .047, .109, '#8999a6');
      side(-.070, -.025, -.34, .033, .027, '#c7b991');
      bore(.052, .045, -length - .036, .004);
    }
    ironSights(-length + (compact ? .25 : .09));
    return length;
  }
  if (weapon === 'crossbow') {
    const loaded = options.loaded !== false && !reloadMotion.active || reloadMotion.loaded;
    const draw = reloadMotion.active ? reloadMotion.draw : options.loaded !== false ? 1 : 0;
    const stringZ = lerp(-.61, -.19, draw);
    part(-.055, -.061, -.62, .11, .132, .68, '#676d52');
    part(-.065, -.012, -.65, .13, .080, .51, '#354844');
    part(-.045, .069, -.72, .09, .020, .63, '#a0ac8a');
    part(-.067, -.060, -.055, .134, .13, .26, '#826f52');
    part(-.071, -.057, .17, .142, .12, .033, trim);
    side(-.068, -.035, .018, .065, .112, stock);
    side(.068, -.035, .018, .065, .112, stock);
    part(-.034, -.20, -.01, .068, .15, .075, '#31433d');
    // The horizontal limbs and thin cocking string distinguish this weapon
    // from a rifle. A real loaded bolt disappears as soon as ammo is spent.
    part(-.44, -.014, -.69, .88, .052, .085, '#6f8d79');
    part(-.49, -.010, -.76, .17, .046, .084, '#a2b59a');
    part(.32, -.010, -.76, .17, .046, .084, '#a2b59a');
    part(-.497, -.021, -.746, .035, .068, .055, '#293d3a');
    part(.462, -.021, -.746, .035, .068, .055, '#293d3a');
    part(-.087, -.044, -.63, .174, .082, .07, '#42574e');
    top(-.037, .091, -.60, .074, .35, '#bbc5a8');
    for (const x of [-.077, .077]) side(x, -.018, -.47, .022, .027, '#b9c3a5');
    string([-.45, .014, -.69], [0, .014, stringZ], .009, '#d7d3b1');
    string([0, .014, stringZ], [.45, .014, -.69], .009, '#d7d3b1');
    if (loaded) {
      part(-.009, .094, -.79, .018, .018, .66, '#ddcc99');
      part(-.015, .090, -.84, .030, .024, .078, '#c4d1c3');
      part(-.040, .089, -.16, .080, .012, .11, '#709d8e');
      part(-.006, .073, -.16, .012, .056, .11, '#709d8e');
    }
    part(-.034, .112, -.13, .015, .040, .027, trim);
    part(.019, .112, -.13, .015, .040, .027, trim);
    part(-.006, .112, -.61, .012, .040, .020, '#cce1af');
    return length;
  }
  if (rifle) {
    part(-.067, -.055, -.44, .134, .145, .45, body);
    part(-.055, -.032, smg ? -.575 : -.64, .11, .10, smg ? .175 : .24, trim);
    part(-.025, -.014, -length, .05, .054, length - .60 + .04, metal);
    part(-.041, -.02, -length - .035, .082, .075, .06, trim);
    part(-.049, .080, -.36, .098, .033, .30, '#262f35');
    if (!shotgun && !lmg) {
      const magazineZ = burst ? -.11 : -.18;
      magazine(-.045, -.25 - magazineDrop, magazineZ + magazineDrop * .16, .09, .20, .105, trim);
      magazine(-.045, -.23 - magazineDrop, magazineZ - .002 + magazineDrop * .16, .09, .04, .109, burst ? '#bb8878' : '#738b80');
    }
    part(-.06, -.067, -.06, .12, .125, .25, shotgun ? '#a37a4f' : sniper ? '#6b7b60' : '#47564f');
    part(-.066, -.083, .167, .132, .154, .045, trim);
    side(-.061, -.045, .03, .064, .107, mix(stock, rgba('#697666'), .50));
    side(.061, -.045, .03, .064, .107, mix(stock, rgba('#697666'), .50));
    part(-.033, -.19, -.035, .066, .13, .09, '#42564d');
    part(-.037, -.17, -.099, .074, .020, .073, trim);
    part(-.043, -.080, -.12, .013, .020, .09, trim);
    part(.030, -.080, -.12, .013, .020, .09, trim);
    part(-.072, .016, -.51, .144, .014, .045, '#c6a474');
    side(-.068, -.012, -.35, .048, .12, '#8d9d90');
    side(.068, -.008, -.32, .045, .135, '#293c3e');
    side(.069, .001, -.305, .029, .078, '#151f24');
    top(-.045, .091, -.435, .09, .060, '#a8b6a5');
    for (const x of [-.069, .069]) {
      side(x, -.023, -.415, .015, .018, '#bcc5b6');
      side(x, -.023, -.175, .015, .018, '#bcc5b6');
    }
    // Handguard vent paint sits on its actual top. Four mostly enclosed
    // cubes would spend triangles on hidden faces in every remote rifle.
    for (let i = 0; i < 4; i++) top(-.055, .069, (smg ? -.555 : -.61) + i * .045, .11, .017, '#667f78');
    const bolt = mechanicalBolt;
    part(.061, .022, -.23 + bolt * .09, .046, .025, .06, metal);
    bore(.044, .042, -length - .036);
    if (smg) {
      part(-.079, -.04, -.50, .016, .082, .14, '#77a9a5');
      part(.063, -.04, -.50, .016, .082, .14, '#77a9a5');
      part(-.073, -.014, .15, .146, .055, .055, '#748a80');
      part(-.036, -.032, -.72, .072, .077, .068, '#647c80');
      part(-.063, -.056, .03, .018, .021, .11, '#202f34');
      part(.045, -.056, .03, .018, .021, .11, '#202f34');
      for (let i = 0; i < 3; i++) side(-.080, -.010, -.475 + i * .035, .045, .016, '#253c44');
    }
    if (burst) {
      part(-.08, -.045, -.50, .16, .10, .18, '#5a4441');
      part(-.08, .055, -.43, .16, .025, .30, '#b88271');
      part(-.075, -.03, -.66, .15, .036, .14, '#c39e84');
      for (let i = 0; i < 3; i++) part(.075, -.01, -.40 + i * .035, .008, .035, .019, '#d7b399');
      part(-.060, -.048, .15, .12, .095, .075, '#795c52');
      part(-.051, -.046, -.73, .102, .087, .082, '#383c39');
      top(-.052, .082, -.407, .104, .22, '#936d5d');
      side(-.081, -.023, -.49, .061, .116, '#ad846b');
      side(.081, -.023, -.49, .061, .116, '#ad846b');
    }
    if (lmg) {
      part(-.090, -.068, -.51, .18, .17, .37, '#536250');
      part(-.100, -.030 + reloadMotion.lid * .13, -.34 + reloadMotion.lid * .04, .20, .18, .31, '#797d58');
      magazine(-.075, -.27 - magazineDrop, -.27, .15, .23, .24, '#485340');
      magazine(-.074, -.262 - magazineDrop, -.268, .148, .048, .236, '#9c9d70');
      part(-.05, -.092, -.95, .10, .063, .41, '#435442');
      for (let i = 0; i < 6; i++) {
        part(-.155 - i * .022, .040 - i * .012, -.30, .027, .034, .043, '#b5a570');
        part(-.154 - i * .022, .067 - i * .012, -.30, .025, .009, .042, '#d4c189');
      }
      part(-.15, .017, -.34, .07, .05, .105, '#344331');
      part(-.032, -.038, -1.11, .064, .073, .082, '#293830');
      const spin = clamp(finite(options.spin), 0, 1);
      for (let i = 0; i < 3; i++) part(.102, .062, -.20 + i * .034, .006, .018, .022, spin >= (i + 1) / 3 ? '#d4dba2' : '#35483c');
      part(-.12, .154, -.34, .025, .035, .17, '#28362f');
      part(.095, .154, -.34, .025, .035, .17, '#28362f');
      part(-.12, .175, -.24, .24, .025, .062, '#475742');
      for (let i = 0; i < 4; i++) side(-.051, -.077, -.90 + i * .062, .036, .031, '#1e332c');
    }
    if (sniper) {
      part(-.071, -.025, -.58, .142, .11, .46, '#718170');
      part(-.044, -.01, -1.18, .088, .075, .29, '#344740');
      part(-.065, -.018, -1.30, .13, .095, .14, '#43594f');
      part(-.075, .02, .10, .15, .135, .17, '#7e8b70');
      part(-.030, -.040, -1.01, .022, .11, .035, '#516055');
      part(.008, -.040, -1.01, .022, .11, .035, '#516055');
      const recovery = mechanicalBolt, bolt = recovery * .15;
      part(.065, .013, -.28 + bolt, .087, .023, .037, '#b7c6b6');
      part(.13, -.025 + recovery * .055, -.28 + bolt, .045, .07, .045, '#31483e');
      part(-.081, .079, .083, .162, .068, .105, '#879572');
      part(-.073, -.018, -.80, .146, .039, .26, '#4b6053');
      for (let i = 0; i < 3; i++) side(-.075, -.010, -.765 + i * .060, .025, .033, '#213a32');
    }
    if (scoped) {
      part(-.050, .105, -.36, .10, .023, .19, '#2c3f43');
      const front = sniper ? -.58 : -.465;
      for (const z of [front, -.14]) {
        // The scope is an open square tube. At full ADS the camera looks
        // through its aperture, rather than at a solid painted glass block.
        part(-.063, .115, z, .023, .12, .045, '#202f34');
        part(.040, .115, z, .023, .12, .045, '#202f34');
        part(-.040, .115, z, .080, .017, .045, '#202f34');
        part(-.040, .216, z, .080, .019, .045, '#202f34');
      }
      part(-.060, .139, front + .045, .017, .063, -front - .18, '#31464a');
      part(.043, .139, front + .045, .017, .063, -front - .18, '#31464a');
      part(-.03, -.023, -.68, .06, .025, .05, '#bca6de');
      part(.057, .160, -.29, .029, .035, .065, '#a1bdb1');
      part(-.018, .233, -.29, .036, .031, .052, '#32484b');
      top(-.021, .265, -.289, .042, .048, '#8da99f');
      for (const z of [front + .013, -.127]) {
        side(-.064, .133, z, .061, .011, '#72948c');
        side(.064, .133, z, .061, .011, '#72948c');
      }
      if (finite(options.aim) < .2) {
        part(-.040, .132, front - .004, .08, .075, .004, '#73aaa7');
        part(-.040, .132, -.094, .08, .075, .004, '#5f9c9d');
        part(-.007, .132, -.089, .004, .075, .002, '#203d40');
        part(-.040, .171, -.089, .08, .004, .002, '#203d40');
      }
    }
    if (marksman) {
      part(-.061, -.016, -.835, .122, .075, .165, '#3c565b');
      part(-.065, .056, .052, .13, .058, .127, '#778b80');
      for (let i = 0; i < 3; i++) side(-.062, .001, -.805 + i * .049, .038, .021, '#a0b4a5');
    }
    if (weapon === 'carbine') {
      part(-.076, -.022, -.675, .152, .072, .235, '#455c53');
      part(-.042, -.060, -.89, .084, .094, .081, '#3a4843');
      for (let i = 0; i < 3; i++) side(-.077, -.005, -.642 + i * .064, .038, .032, '#263d38');
    }
  } else {
    const slide = mechanicalBolt * .053;
    part(-.048, -.025, -.38, .096, .088, .34, body);
    part(-.046, .063, -.385 + slide, .092, .044, .345, metal);
    part(-.022, -.018, -.44, .044, .044, .065, trim);
    magazine(-.040, -.19 - magazineDrop, -.11, .08, .18, .105, trim);
    part(-.041, -.08, -.115, .008, .066, .086, '#a4b1ae');
    part(.033, -.08, -.115, .008, .066, .086, '#a4b1ae');
    magazine(-.040, -.19 - magazineDrop, -.113, .08, .015, .109, '#8eb0bd');
    for (let i = 0; i < 4; i++) part(.046, .066, -.17 + slide + i * .02, .006, .035, .008, '#596e79');
    part(-.052, -.023, -.15, .104, .030, .087, '#283d46');
    part(-.050, -.165, -.10, .011, .091, .074, '#3c5361');
    part(.039, -.165, -.10, .011, .091, .074, '#3c5361');
    top(-.033, .108, -.34 + slide, .066, .23, '#91a8b3');
    side(-.048, .069, -.275 + slide, .020, .077, '#415766');
    for (const x of [-.052, .052]) side(x, -.140, -.087, .014, .017, '#a9bec4');
    bore(.032, .035, -.441, -.013);
  }
  if (!scoped) {
    // A genuine open rear notch and luminous front post share the same
    // .152 sight line, which the first-person ADS pose places on camera Y=0.
    const front = pistol ? -.355 : -length + .05, rear = pistol ? -.085 : -.15;
    ironSights(front, rear);
  }
  return length;
}

/** Pure geometry for render budgets and the same clipped world-gun assembly. */
export function weaponMeshes(weapon, pose = {}, options = {}) {
  const mesh = new Mesh(); weaponParts(mesh, weapon, { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, ...pose }, options); return mesh.array;
}

function swordParts(mesh, pose, options = {}) {
  const limit = finite(options.limit, 1.24);
  const part = (x, y, z, w, h, d, color) => {
    const clippedZ = Math.max(z, -limit), clippedDepth = z + d - clippedZ;
    if (clippedDepth > 0) mesh.box(x, y, clippedZ, w, h, clippedDepth, color, pose);
  };
  part(-.030, -.036, -.045, .060, .072, .235, '#443a35');
  for (let i = 0; i < 4; i++) part(-.032, -.038, -.013 + i * .045, .064, .076, .018, '#887953');
  part(-.044, -.047, .167, .088, .094, .047, '#aebfc0');
  part(-.172, -.035, -.09, .344, .070, .055, '#bba772');
  part(-.18, -.043, -.095, .047, .086, .065, '#6a755c');
  part(.133, -.043, -.095, .047, .086, .065, '#6a755c');
  const blade = options.active ? '#dde9e4' : '#b6c9cc';
  part(-.062, -.024, -.83, .124, .048, .75, blade);
  part(-.036, -.018, -1.03, .072, .036, .22, blade);
  part(-.019, -.010, -1.14, .038, .020, .13, '#eef2dc');
  part(-.011, -.026, -.82, .022, .052, .70, '#748d96');
  part(-.065, -.026, -.81, .011, .052, .69, '#e5eadd');
  part(.054, -.026, -.81, .011, .052, .69, '#e5eadd');
  part(-.024, .036, -.087, .048, .009, .040, '#e0c78c');
  part(-.018, .048, .176, .036, .008, .024, '#516b72');
}

const meleeLength = player => ({ knife: .48, sword: 1.24, katana: 1.42, axe: 1.03, tonfas: .76 })[meleeWeaponId(player)] || 1.24;
const meleePadding = player => ({ knife: .08, sword: .18, katana: .16, axe: .32, tonfas: .13 })[meleeWeaponId(player)] || .18;
const meleeTipLength = player => ({ knife: .47, sword: 1.14, katana: 1.405, axe: .991, tonfas: .736 })[meleeWeaponId(player)] || 1.14;

function meleeCommittedAim(player, motion, yaw = finite(player.yaw), pitch = finite(player.pitch)) {
  if (motion.guarding) return { yaw: finite(player.parryYaw, yaw), pitch: clamp(finite(player.parryPitch, pitch), -1.35, 1.35) };
  return finite(player.meleeTicks) > 0 ? { yaw: finite(player.meleeYaw, yaw), pitch: finite(player.meleePitch, pitch) } : { yaw, pitch };
}

/** The active world blade shares its pivot, orientation and tip with damage. */
export function meleeWorldPose(player, motion = meleeMotion(player)) {
  const id = meleeWeaponId(player), profile = meleeProfile(player), knife = id === 'knife';
  const aim = meleeCommittedAim(player, motion), yaw = aim.yaw + motion.yaw, pitch = aim.pitch + motion.pitch;
  const direction = rotate([0, 0, -1], yaw, pitch);
  const origin = meleeSlashOrigin(player), outer = profile.reach - profile.slashRadius;
  const activeScale = knife ? 1.05 : profile.dualWield ? 1.15 : (outer - .18) / meleeTipLength(player);
  let gripDistance = knife || profile.dualWield ? outer - meleeTipLength(player) * activeScale : .18;
  if (motion.action === 'secondary' && motion.phase === 'startup') gripDistance = .16 + (gripDistance - .16) * smooth((motion.progress - .72) / .28);
  const side = profile.dualWield && player.meleeHand === 1 ? -1 : 1;
  const ready = rotate([side * .21, player.crouching ? .82 : 1.24, -.24 - Math.max(0, motion.extension) * .25], aim.yaw);
  const grip = clamp(finite(motion.grip), 0, 1);
  if (motion.guarding) {
    const guard = rotate([side * .19, -.07, -.34], aim.yaw, aim.pitch);
    return { x: lerp(finite(player.x) + ready[0], origin.x + guard[0], grip), y: lerp(finite(player.y) + ready[1], origin.y + guard[1], grip), z: lerp(finite(player.z) + ready[2], origin.z + guard[2], grip), yaw, pitch, roll: finite(motion.roll), scale: lerp(profile.dualWield ? 1.15 : 1.35, id === 'axe' ? 1.08 : 1.15, grip) };
  }
  return {
    x: lerp(finite(player.x) + ready[0], origin.x + direction[0] * gripDistance, grip),
    y: lerp(finite(player.y) + ready[1], origin.y + direction[1] * gripDistance, grip),
    z: lerp(finite(player.z) + ready[2], origin.z + direction[2] * gripDistance, grip),
    yaw, pitch, roll: finite(motion.roll), scale: lerp(knife ? 1.15 : profile.dualWield ? 1.15 : 1.35, activeScale, grip),
  };
}

function meleeWorldCoverLimit(player, pose, colliders) {
  const origin = meleeSlashOrigin(player), pivot = [origin.x, origin.y, origin.z];
  const grip = [pose.x, pose.y, pose.z], delta = grip.map((value, axis) => value - pivot[axis]);
  const distance = Math.hypot(...delta), padding = meleePadding(player) * pose.scale;
  if (distance > .001 && rayCoverDistance(pivot, delta.map(value => value / distance), colliders, distance, padding) < distance) return -meleeLength(player) - 1;
  return Math.max(0, rayCoverDistance(grip, rotate([0, 0, -1], pose.yaw, pose.pitch), colliders, meleeLength(player) * pose.scale, padding) - .025) / pose.scale;
}

function meleeViewAngles(player, motion, yaw, pitch, roll) {
  const aim = meleeCommittedAim(player, motion, yaw, pitch);
  const intoCamera = vector => rotate(rotate(rotate(vector, -yaw), 0, -pitch), 0, 0, -roll);
  const direction = rotate([0, 0, -1], aim.yaw + motion.yaw, aim.pitch + motion.pitch);
  const local = intoCamera(direction), localYaw = Math.atan2(local[0], -local[2]), localPitch = Math.asin(clamp(local[1], -1, 1));
  const edge = intoCamera(rotate([1, 0, 0], aim.yaw + motion.yaw, aim.pitch + motion.pitch, finite(motion.roll)));
  const right = rotate([1, 0, 0], localYaw, localPitch), up = rotate([0, 1, 0], localYaw, localPitch);
  const localRoll = Math.atan2(edge.reduce((sum, value, axis) => sum + value * up[axis], 0), edge.reduce((sum, value, axis) => sum + value * right[axis], 0));
  return { yaw: localYaw, pitch: localPitch, roll: localRoll };
}

/** A deterministic grip path; only accepted swing/guard timers move the blade. */
export function meleeViewPose(player, motion = meleeMotion(player), view = {}, hand = player.meleeHand === 1 ? 1 : 0) {
  const knife = meleeWeaponId(player) === 'knife', dual = !!meleeProfile(player).dualWield;
  const yaw = finite(view.yaw, finite(player.yaw)), pitch = finite(view.pitch, finite(player.pitch));
  const angles = meleeViewAngles(player, motion, yaw, pitch, finite(view.roll));
  // Lift during the load, cross the cut and settle through recovery. These
  // small hand translations never steer the active blade's accepted axis.
  const lift = knife || motion.guarding || motion.phase === 'idle' ? 0 : motion.phase === 'startup' ? .085 * Math.sin(motion.progress * Math.PI / 2) : motion.phase === 'active' ? .085 * (1 - motion.progress * 2) : -.085 * motion.grip;
  const side = hand === 0 ? 1 : -1;
  if (dual) return {
    x: side * (.245 - (motion.guarding ? motion.grip * .035 : 0)) + finite(view.swayX) * .5 + Math.sin(motion.yaw) * .075 * motion.grip,
    y: -.285 + (motion.guarding ? motion.grip * .13 : lift * .7) + finite(view.weaponY) - Math.sin(motion.pitch) * .035 * motion.grip,
    z: -.43 - motion.extension * .70, ...angles, scale: .90,
  };
  return {
    x: (knife ? .22 - (motion.action === 'secondary' ? .10 * motion.grip : 0) : .255) + finite(view.swayX) * .5 + Math.sin(motion.yaw) * (knife ? .03 : .15) * motion.grip,
    y: (knife ? -.28 : -.30) + (motion.guarding ? .18 * motion.grip : motion.action === 'secondary' ? .055 * motion.grip : lift) + finite(view.weaponY) - Math.sin(motion.pitch) * .06 * motion.grip,
    z: -.42 - motion.extension * (knife ? .70 : .45), ...angles, scale: .90,
  };
}

/** The off hand holds the long handle behind the primary hand. */
export function meleeSupportGrip(player, pose) {
  if (meleeWeaponId(player) === 'knife' || meleeProfile(player).dualWield) return null;
  const offset = rotate([-.026, -.035, .175], pose.yaw, pose.pitch, finite(pose.roll)).map(value => value * pose.scale);
  return [pose.x + offset[0], pose.y + offset[1], pose.z + offset[2]];
}

function meleeParts(mesh, player, pose, options = {}) {
  const id = meleeWeaponId(player);
  if (id === 'tonfas' && !Number.isInteger(options.hand)) {
    for (const hand of [0, 1]) {
      const offset = rotate([hand === 0 ? .16 : -.16, 0, 0], pose.yaw, pose.pitch).map(value => value * finite(pose.scale, 1));
      meleeParts(mesh, player, { ...pose, x: pose.x + offset[0], y: pose.y + offset[1], z: pose.z + offset[2] }, { ...options, hand });
    }
    return;
  }
  if (id === 'sword') { swordParts(mesh, pose, options); return; }
  const limit = finite(options.limit, meleeLength(player));
  const part = (x, y, z, w, h, d, color) => {
    const clippedZ = Math.max(z, -limit), clippedDepth = z + d - clippedZ;
    if (clippedDepth > 0) mesh.box(x, y, clippedZ, w, h, clippedDepth, color, pose);
  };
  if (id === 'katana') {
    part(-.028, -.030, -.047, .056, .060, .28, '#303c3c');
    for (let wrap = 0; wrap < 5; wrap++) part(-.029, -.031, -.020 + wrap * .044, .058, .062, .017, '#9a735b');
    part(-.033, -.033, .215, .066, .066, .038, '#c5b98c');
    part(-.116, -.034, -.098, .232, .068, .032, '#857548');
    part(-.081, -.051, -.099, .162, .102, .033, '#aa9a60');
    part(-.043, -.032, -.15, .086, .064, .052, '#d2b67f');
    // Six stepped single-edge blade segments describe the katana's gentle
    // curve. A narrow dark spine and bright edge remain actual clipped parts.
    for (let segment = 0; segment < 6; segment++) {
      const curve = segment * segment * .0025, z = -.35 - segment * .175;
      const width = segment === 5 ? .041 : .068;
      part(-.032 + curve, -.015, z, width, .030, .205, options.active ? '#e5eddf' : '#c3d1cf');
      part(-.034 + curve, -.016, z, .011, .032, .205, '#f2efd8');
      part(.025 + curve, -.016, z, .011, .032, .205, '#66848a');
    }
    part(.044, -.011, -1.405, .018, .022, .185, '#ecf0df');
    return;
  }
  if (id === 'axe') {
    part(-.027, -.030, -.96, .054, .060, 1.20, '#6c5141');
    part(-.031, -.034, .015, .062, .068, .22, '#3e514c');
    for (let wrap = 0; wrap < 4; wrap++) part(-.033, -.036, .025 + wrap * .046, .066, .072, .014, '#a38a59');
    part(-.038, -.040, .211, .076, .080, .041, '#a7b5a3');
    part(-.090, -.054, -.912, .180, .108, .19, '#53686c');
    part(-.305, -.049, -.935, .255, .098, .155, '#bec9c5');
    part(-.283, -.040, -.991, .200, .080, .071, '#d6decd');
    part(-.302, -.041, -.802, .169, .082, .152, '#a9bbb8');
    part(-.318, -.044, -.991, .024, .088, .240, '#f2eddb');
    part(.069, -.042, -.905, .129, .084, .112, '#95a9a9');
    part(.166, -.029, -.891, .074, .058, .085, '#cad2c7');
    part(-.034, -.055, -.951, .068, .110, .024, '#b29b69');
    return;
  }
  if (id === 'tonfas') {
    // T-handled batons, one in each hand, instead of a recoloured short sword.
    part(-.039, .022, -.68, .078, .076, .90, '#334c54');
    part(-.047, .014, -.736, .094, .092, .075, '#b6c4b7');
    part(-.047, .014, .192, .094, .092, .06, '#8ea7a4');
    part(-.032, -.154, -.062, .064, .197, .072, '#5b6e68');
    part(-.039, -.167, -.068, .078, .024, .084, '#bba679');
    for (let wrap = 0; wrap < 3; wrap++) part(-.034, -.130 + wrap * .045, -.064, .068, .012, .076, '#a49474');
    part(-.041, .015, -.20, .082, .090, .016, '#788f89');
    part(-.041, .015, -.51, .082, .090, .016, '#788f89');
    return;
  }
  // A short single-edged utility knife. Its silhouette, scale and quicker cut
  // make the unarmed scavenger clearly different from Breach's long sword.
  part(-.026, -.030, -.023, .052, .060, .175, '#344943');
  for (let i = 0; i < 3; i++) part(-.028, -.033, .003 + i * .040, .056, .066, .013, '#5c7469');
  part(-.032, -.035, .142, .064, .070, .023, '#8fa6a3');
  part(-.071, -.028, -.056, .142, .056, .030, '#8fa6a3');
  const blade = options.active ? '#d5e3dc' : '#a0b9bc';
  part(-.044, -.014, -.34, .088, .028, .29, blade);
  part(-.030, -.012, -.42, .060, .024, .09, blade);
  part(-.012, -.009, -.47, .024, .018, .06, '#e2ebe0');
  part(-.048, -.015, -.34, .010, .030, .285, '#edf0df');
  part(.028, -.015, -.33, .010, .030, .27, '#738d94');
  part(-.015, .033, .010, .030, .005, .018, '#aebcaf');
  part(-.015, .033, .091, .030, .005, .018, '#aebcaf');
  part(-.030, -.036, .145, .060, .072, .017, '#34443f');
  part(-.045, -.017, -.105, .090, .034, .052, '#6b868b');
  part(-.016, .014, -.320, .014, .003, .180, '#68878c');
}

/** The same clipped blade geometry is used by both first and third person. */
export function meleeMeshes(player, pose = {}, options = {}) {
  const mesh = new Mesh(); meleeParts(mesh, player, { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, ...pose }, options); return mesh.array;
}

function potionParts(mesh, pose, progress = 0, limit = Infinity) {
  // Opaque sea-glass, stepped shoulders and a ribbed brass seal read clearly
  // in a hand or on a shelf, without another transparency pass.
  const part = (x, y, z, w, h, d, color) => { const zz = Math.max(z, -limit), dd = z + d - zz; if (dd > 0) mesh.box(x, y, zz, w, h, dd, color, pose); };
  part(-.066, -.082, -.059, .132, .154, .118, '#5e947f');
  part(-.052, .071, -.046, .104, .032, .092, '#8fbba3');
  part(-.031, .097, -.031, .062, .082, .062, '#9dc5ad');
  if (progress < .13 || progress > .94) part(-.037, .170, -.037, .074, .039, .074, '#bd9a62');
  const face = (x, y, z, w, h, color, back = false) => {
    if (z < -limit) return;
    const points = [[x, y, z], [x, y + h, z], [x + w, y + h, z], [x + w, y, z]];
    if (back) points.reverse();
    const transform = point => { const p = rotate(point.map(value => value * finite(pose.scale, 1)), pose.yaw, pose.pitch); return p.map((value, i) => value + [pose.x, pose.y, pose.z][i]); };
    mesh.quad(...points.map(transform), rotate([0, 0, back ? 1 : -1], pose.yaw, pose.pitch), rgba(color));
  };
  face(-.047, -.060, -.0594, .094, .105, '#304f46');
  face(-.016, -.042, -.0598, .032, .069, '#f2edcf');
  face(-.035, -.020, -.0599, .070, .025, '#f2edcf');
  face(-.056, .015, -.0595, .012, .041, '#b9d9c3');
  face(-.047, -.045, .0594, .094, .051, '#304f46', true);
  face(-.028, -.029, .0598, .056, .007, '#bd9a62', true);
  face(-.031, .140, -.0314, .062, .027, '#617f6b');
  face(-.031, .140, .0314, .062, .027, '#617f6b', true);
}

function grenadeParts(mesh, pose, radius, fuseTicks, time, intact = false, limit = Infinity) {
  const r = clamp(finite(radius, .12), .04, .25), scale = r / .12;
  const blinkPeriod = lerp(70, 320, clamp(finite(fuseTicks) / 288, 0, 1));
  const lit = Math.floor(time / blinkPeriod) % 2 === 0;
  const shell = lit && fuseTicks < 120 ? '#977457' : '#4a6655';
  const part = (x, y, z, w, h, d, color) => {
    const zz = Math.max(z * scale, -limit), dd = (z + d) * scale - zz;
    if (dd > 0) mesh.box(x * scale, y * scale, zz, w * scale, h * scale, dd, color, pose);
  };
  // Every corner stays inside the engine's .12m sphere. Voxel steps suggest a
  // rounded shell without the corners of a large cube becoming false cover.
  part(-.069, -.069, -.069, .138, .138, .138, shell);
  part(-.104, -.034, -.034, .208, .068, .068, shell);
  if (!intact) part(-.034, -.104, -.034, .068, .208, .068, shell);
  part(-.034, -.034, -.104, .068, .068, .208, shell);
  part(-.024, .070, -.027, .048, .035, .054, '#91a397');
  const face = (points, normal, color) => {
    if (points.every(point => point[2] * scale < -limit)) return;
    const transform = point => { const clipped = [point[0] * scale, point[1] * scale, Math.max(point[2] * scale, -limit)]; const p = rotate(clipped.map(value => value * finite(pose.scale, 1)), pose.yaw, pose.pitch); return p.map((value, i) => value + [pose.x, pose.y, pose.z][i]); };
    mesh.quad(...points.map(transform), rotate(normal, pose.yaw, pose.pitch), rgba(color));
  };
  if (intact) face([[.039, .070, -.0164], [.039, .096, -.0164], [.052, .096, -.0164], [.052, .070, -.0164]], [0, 0, -1], '#a2aa94');
  else part(.039, .025, -.016, .013, .071, .032, '#a2aa94');
  // Painted grooves subdivide the shell while all corners, lever and pin stay
  // inside the actual collision sphere, including when the grenade tumbles.
  for (const side of intact ? [-1] : [-1, 1]) {
    const z = side * .0693;
    for (const y of [-.033, .025]) {
      const points = [[-.063, y, z], [-.063, y + .008, z], [.063, y + .008, z], [.063, y, z]];
      if (side > 0) points.reverse();
      face(points, [0, 0, side], '#2c493d');
    }
    for (const x of intact ? [-.024, .017] : [-.004]) {
      const points = [[x, -.064, z], [x, .064, z], [x + .008, .064, z], [x + .008, -.064, z]];
      if (side > 0) points.reverse();
      face(points, [0, 0, side], '#2c493d');
    }
  }
  if (intact) {
    for (const [x, y, w, h] of [[.026, .070, .037, .006], [.026, .089, .037, .006], [.026, .070, .006, .025], [.057, .070, .006, .025]]) {
      face([[x, y, -.037], [x, y + h, -.037], [x + w, y + h, -.037], [x + w, y, -.037]], [0, 0, -1], '#dcc391');
    }
  } else {
    for (const side of [-1, 1]) {
      const x = side * .0693;
      for (const y of [-.033, .025]) {
        const points = [[x, y, -.063], [x, y + .008, -.063], [x, y + .008, .063], [x, y, .063]];
        if (side < 0) points.reverse();
        face(points, [side, 0, 0], '#2c493d');
      }
      const points = [[x, -.064, -.004], [x, .064, -.004], [x, .064, .004], [x, -.064, .004]];
      if (side < 0) points.reverse();
      face(points, [side, 0, 0], '#2c493d');
    }
    face([[-.014, .1054, -.019], [-.014, .1054, .019], [.014, .1054, .019], [.014, .1054, -.019]], [0, 1, 0], lit ? '#efb86a' : '#aa7a4f');
  }
}

function lootGun(mesh, weapon, pose) {
  const authored = weaponVisualModel(weapon);
  if (authored) {
    for (const item of authored.lootParts) mesh.box(item.x, item.y, item.z, item.w, item.h, item.d, item.color, pose);
    return;
  }
  if (WEAPONS[weapon]?.dualWield) {
    const automatic = weapon === 'dualsmg';
    for (const side of [-1, 1]) {
      const offset = rotate([side * .17 * finite(pose.scale, 1), 0, 0], pose.yaw, pose.pitch);
      const handPose = { ...pose, x: pose.x + offset[0], y: pose.y + offset[1], z: pose.z + offset[2] };
      mesh.box(-.048, -.025, -weaponLength(weapon), .096, .112, weaponLength(weapon) - .022, automatic ? '#728892' : '#c2c9ba', handPose);
      mesh.box(-.034, automatic ? -.255 : -.183, automatic ? -.26 : -.087, .068, automatic ? .231 : .160, .092, '#425960', handPose);
      const paint = (z, y, color) => {
        const points = [[-.048, y, z], [-.048, y + .032, z], [.048, y + .032, z], [.048, y, z]];
        const world = points.map(point => { const p = rotate(point.map(value => value * finite(pose.scale, 1)), pose.yaw, pose.pitch); return p.map((value, i) => value + [handPose.x, handPose.y, handPose.z][i]); });
        mesh.quad(...world, rotate([0, 0, -1], pose.yaw, pose.pitch), rgba(color));
      };
      paint(-weaponLength(weapon) - .0005, .018, '#192f37');
      paint(automatic ? -.261 : -.088, -.122, '#b99c67');
    }
    return;
  }
  const part = (...values) => mesh.box(...values, pose);
  const metal = '#acbdb5', trim = '#25363b';
  const body = ({ pistol: '#607b91', smg: '#4f747c', marksman: '#526976', shotgun: '#926b43', burst: '#805b4f', sniper: '#677961', lmg: '#76764d', crossbow: '#7b8765' })[weapon] || '#56685f';
  const face = (points, normal, color) => {
    const transform = vector => { const p = rotate(vector.map(value => value * finite(pose.scale, 1)), pose.yaw, pose.pitch); return p.map((value, axis) => value + [pose.x, pose.y, pose.z][axis]); };
    mesh.quad(...points.map(transform), rotate(normal, pose.yaw, pose.pitch), rgba(color));
  };
  const top = (x, y, z, w, d, color) => face([[x, y, z], [x, y, z + d], [x + w, y, z + d], [x + w, y, z]], [0, 1, 0], color);
  if (['revolver', 'pdw', 'battlerifle'].includes(weapon)) {
    const length = weaponLength(weapon);
    if (weapon === 'revolver') {
      part(-.039, -.030, -.30, .078, .127, .28, '#9eaeb1');
      part(-.075, -.030, -.278, .150, .130, .150, '#c0ccca');
      part(-.027, -.005, -length - .025, .054, .068, .24, '#afc1bf');
      part(-.041, -.188, -.080, .082, .159, .103, '#986c4b');
      part(-.009, .108, -.45, .018, .044, .040, '#475f70');
      face([[-.014, .006, -length - .026], [-.014, .040, -length - .026], [.014, .040, -length - .026], [.014, .006, -length - .026]], [0, 0, -1], '#192f38');
      top(-.045, .101, -.25, .09, .094, '#d2bd85');
    } else if (weapon === 'pdw') {
      part(-.069, -.044, -.365, .138, .140, .39, '#487e89');
      part(-.044, -.010, -length - .035, .088, .083, .46, '#315661');
      part(-.035, -.239, -.075, .070, .206, .10, '#6e9b9d');
      part(-.057, -.041, .012, .114, .114, .135, '#729e9e');
      part(-.009, .108, -.50, .018, .044, .041, '#a5c2b8');
      top(-.052, .098, -.30, .104, .10, '#b3cecb');
      face([[-.024, .010, -length - .036], [-.024, .056, -length - .036], [.024, .056, -length - .036], [.024, .010, -length - .036]], [0, 0, -1], '#16333d');
    } else {
      part(-.062, -.042, -.77, .124, .140, .79, '#526f8b');
      part(-.029, -.010, -length - .035, .058, .060, .40, '#b3c3c4');
      part(-.054, -.254, -.19, .108, .223, .153, '#8297a8');
      part(-.062, -.044, .01, .124, .126, .240, '#5c7089');
      part(-.044, -.018, -length - .035, .088, .076, .076, '#304b64');
      top(-.048, .101, -.47, .096, .20, '#adc1c5');
      face([[-.023, .002, -length - .036], [-.023, .047, -length - .036], [.023, .047, -length - .036], [.023, .002, -length - .036]], [0, 0, -1], '#1d354a');
    }
    return;
  }
  if (weapon === 'crossbow') {
    part(-.052, -.045, -.62, .104, .115, .68, body);
    part(-.46, -.02, -.70, .92, .045, .082, '#8eb298');
    part(-.064, -.04, -.02, .128, .12, .22, '#967951');
    part(-.026, -.17, -.01, .052, .13, .069, trim);
    top(-.009, .084, -.82, .018, .67, '#eddbad');
    face([[0, .074, -.82], [0, .093, -.82], [0, .093, -.15], [0, .074, -.15]], [1, 0, 0], '#eddbad');
    const center = [0, .028, -.18];
    for (const end of [[-.45, .028, -.68], [.45, .028, -.68]]) {
      const points = [end, [end[0], .028, end[2] + .009], [center[0], .028, center[2] + .009], center];
      face(points, [0, 1, 0], '#dad9b8');
      face([...points].reverse(), [0, -1, 0], '#dad9b8');
    }
    top(-.035, .071, -.58, .07, .35, '#bec9ad');
    return;
  }
  const pistol = weapon === 'pistol', length = weaponLength(weapon);
  if (pistol) {
    part(-.048, -.025, -.37, .096, .088, .34, body);
    part(-.046, .063, -.38, .092, .044, .34, metal);
    part(-.022, -.018, -.44, .044, .044, .065, trim);
    part(-.039, -.18, -.10, .078, .17, .093, '#3c5361');
    top(-.033, .108, -.34, .066, .20, '#92adb6');
    face([[-.014, -.011, -.441], [-.014, .018, -.441], [.014, .018, -.441], [.014, -.011, -.441]], [0, 0, -1], '#13242b');
    return;
  }
  const wide = weapon === 'smg' || weapon === 'burst';
  part(wide ? -.077 : -.065, -.045, wide ? -.52 : -.44, wide ? .154 : .13, .135, wide ? .53 : .45, body);
  part(-.026, -.006, -length - .023, .052, .054, Math.max(.06, length - .54), metal);
  if (weapon !== 'marksman') part(-.034, -.19, -.035, .068, .13, .09, trim);
  part(-.06, -.06, -.05, .12, .12, .25, weapon === 'shotgun' ? '#b48a59' : weapon === 'sniper' ? '#8a9871' : '#526650');
  if (weapon === 'lmg') {
    part(-.095, -.24, -.28, .19, .21, .24, '#5c6a45');
    top(-.20, .075, -.29, .15, .059, '#cab976');
  } else {
    // A bolt-action rifle's small flush magazine stays in its receiver at
    // miniature scale, preserving the long stock/scope silhouette cheaply.
    if (weapon !== 'sniper') part(-.045, -.24, weapon === 'burst' ? -.11 : -.20, .09, .20, .105, trim);
    if (weapon === 'carbine') top(-.048, .091, -.41, .096, .22, '#91aa8e');
    if (weapon === 'smg') top(-.070, .048, -.514, .14, .038, '#bfd3b7');
    if (weapon === 'burst') top(-.056, .088, -.40, .112, .21, '#d6ad87');
  }
  if (weapon === 'marksman' || weapon === 'sniper') {
    const front = weapon === 'sniper' ? -.57 : -.465;
    part(-.06, .115, front, .12, .11, -front - .13, trim);
    face([[-.044, .133, front - .001], [-.044, .207, front - .001], [.044, .207, front - .001], [.044, .133, front - .001]], [0, 0, -1], '#83b3b5');
  }
}

const validLoot = item => item && ['weapon', 'melee', 'heal', 'ammo', 'grenade'].includes(item.kind) && [item.x, item.y, item.z].every(Number.isFinite) && (item.kind !== 'weapon' || Object.hasOwn(WEAPONS, item.weapon)) && (item.kind !== 'melee' || Object.hasOwn(MELEE_WEAPONS, item.weapon));

/** Pickups are deliberately small display props, not misleading solid cover. */
function buildLootMeshes(items = [], time = 0, movingRanges = null) {
  const opaque = new Mesh(), contacts = new Mesh();
  let count = 0;
  for (const item of items) {
    if (count >= MAX_LOOT) break;
    if (!validLoot(item)) continue;
    count++;
    const x = item.x, y = item.y, z = item.z, seed = hash(item.id);
    const tint = item.kind === 'heal' ? '#a3e6b7' : item.kind === 'weapon' || item.kind === 'melee' ? '#edd494' : item.kind === 'grenade' ? '#deb39c' : '#94c8da';
    contacts.floorRing(x, z, .23, .275, rgba(tint, .64), y + .018, WEAPONS[item.weapon]?.dualWield ? 6 : 8);
    const bob = Math.sin(finite(time) * .0023 + seed % 13) * .016;
    const movingStart = opaque.length; let movingEnd = movingStart;
    if (item.kind === 'melee') {
      const id = item.weapon, knife = id === 'knife', length = meleeLength({ meleeWeapon: id });
      const yaw = (seed % 4) * Math.PI / 2 + .45, offset = rotate([0, 0, length * .19], yaw);
      const pose = { x: x + offset[0], y: y + .22 + bob, z: z + offset[2], yaw, pitch: 0, scale: knife ? .60 : .44 };
      const part = (...values) => opaque.box(...values, pose);
      if (id === 'axe') {
        part(-.024, -.029, -.98, .048, .058, 1.20, '#7d5c44');
        part(-.26, -.045, -.97, .33, .09, .23, '#c4d0c5');
        part(-.29, -.04, -.99, .04, .08, .29, '#e5e8cd');
        part(-.034, -.033, .02, .068, .066, .20, '#465b53');
      } else if (id === 'tonfas') {
        for (const side of [-1, 1]) {
          part(side * .16 - .032, .012, -.73, .064, .072, .95, '#718e90');
          part(side * .16 - .029, -.135, -.052, .058, .18, .074, '#ad996c');
        }
      } else {
        part(-.019, -.012, -length + .10, .038, .024, length - .21, '#bdcbd0');
        part(id === 'katana' ? .004 : -.011, -.010, -length, .022, .020, .12, '#e4e8d7');
        part(-.035, -.028, -.11, .07, .056, .30, knife ? '#566c5c' : id === 'katana' ? '#965f49' : '#5d574e');
        part(knife ? -.054 : id === 'katana' ? -.10 : -.13, -.025, -.12, knife ? .108 : id === 'katana' ? .20 : .26, .05, .025, '#ac986a');
      }
      movingEnd = opaque.length;
      opaque.floor(x - .15, z - .15, .30, .30, '#6f6d51', y + .022);
    } else if (item.kind === 'weapon') {
      const length = weaponLength(item.weapon);
      const yaw = (seed % 4) * Math.PI / 2 + .45;
      // Center the sideways miniature over its marker; it cannot resemble a
      // crate or a wall that a player could use as cover.
      const offset = rotate([0, 0, length * .22], yaw);
      lootGun(opaque, item.weapon, { x: x + offset[0], y: y + .27 + bob, z: z + offset[2], yaw, pitch: 0, scale: .44 });
      movingEnd = opaque.length;
      opaque.floor(x - .15, z - .15, .30, .30, '#6f6d51', y + .022);
    } else if (item.kind === 'heal') {
      const pose = { x, y: y + .15 + bob, z, yaw: .32, pitch: 0, scale: 1.10 };
      potionParts(opaque, pose); movingEnd = opaque.length;
    } else if (item.kind === 'ammo') {
      opaque.box(x - .14, y + .025, z - .11, .28, .18, .22, '#49666a');
      opaque.box(x - .15, y + .205, z - .12, .30, .032, .24, '#8da699');
      opaque.box(x - .018, y + .182, z - .126, .036, .040, .013, '#d3bf8c');
      opaque.box(x - .046, y + .238, z - .028, .092, .008, .056, '#304b50');
      const front = (xx, yy, w, h, color, zz = -.111) => opaque.quad([x + xx, y + yy, z + zz], [x + xx, y + yy + h, z + zz], [x + xx + w, y + yy + h, z + zz], [x + xx + w, y + yy, z + zz], [0, 0, -1], rgba(color));
      front(-.092, .058, .184, .098, '#2a454d');
      for (let i = 0; i < 3; i++) {
        front(-.068 + i * .053, .074, .024, .057, '#dbc185', -.1114);
        front(-.064 + i * .053, .131, .016, .012, '#eee0ab', -.1115);
      }
      front(-.121, .039, .011, .147, '#8fa393');
      front(.110, .039, .011, .147, '#8fa393');
    } else {
      // The intact brass pin distinguishes a safe pickup from a live frag.
      grenadeParts(opaque, { x, y: y + .15 + bob, z, yaw: .30, pitch: 0, scale: 1 }, .12, 288, time, true);
      movingEnd = opaque.length;
    }
    if (movingRanges && movingEnd > movingStart) movingRanges.push({ start: movingStart, end: movingEnd, bob, seed });
  }
  return { opaque: opaque.array, contacts: contacts.array, count };
}

/** Pure pickup assembly remains available for asset validation and previews. */
export function lootMeshes(items = [], time = 0) { return buildLootMeshes(items, time); }

/** Reuse pickup art across network snapshots; only the little bob changes. */
export function createLootPresenter() {
  const cache = new Map(), opaque = new Mesh(), contacts = new Mesh();
  let builds = 0;
  const present = (items = [], time = 0) => {
    opaque.reset(); contacts.reset(); const kept = new Set(); let count = 0;
    for (const item of items) {
      if (count >= MAX_LOOT) break;
      if (!validLoot(item)) continue;
      const key = item.id ?? `slot-${count}`;
      let entry = cache.get(key);
      if (!entry || ['id', 'kind', 'weapon', 'x', 'y', 'z'].some(field => entry.source[field] !== item[field])) {
        const ranges = [], mesh = buildLootMeshes([item], 0, ranges);
        entry = { source: { id: item.id, kind: item.kind, weapon: item.weapon, x: item.x, y: item.y, z: item.z }, base: mesh.opaque, animated: mesh.opaque.slice(), contacts: mesh.contacts, ranges };
        cache.set(key, entry); builds++;
      }
      for (const range of entry.ranges) {
        const offset = Math.sin(finite(time) * .0023 + range.seed % 13) * .016 - range.bob;
        for (let at = range.start + 1; at < range.end; at += VERTEX_STRIDE) entry.animated[at] = entry.base[at] + offset;
      }
      opaque.append(entry.animated); contacts.append(entry.contacts); kept.add(key); count++;
    }
    for (const key of cache.keys()) if (!kept.has(key)) cache.delete(key);
    return { opaque: opaque.array, contacts: contacts.array, count };
  };
  present.reset = () => { cache.clear(); opaque.reset(); contacts.reset(); builds = 0; };
  present.getStats = () => ({ cachedItems: cache.size, builds, bufferBytes: opaque.storage.byteLength + contacts.storage.byteLength, templateBytes: [...cache.values()].reduce((bytes, entry) => bytes + entry.base.buffer.byteLength + entry.animated.byteLength + entry.contacts.buffer.byteLength, 0) });
  return present;
}

const MONSTER_ART = Object.freeze({
  stalker: { skin: '#718e79', shadow: '#374f49', armor: '#435b53', eye: '#ddf19b', width: .38, head: '#829d83' },
  runner: { skin: '#9689aa', shadow: '#493c5e', armor: '#66597c', eye: '#c9b3ff', width: .32, head: '#524967' },
  brute: { skin: '#837a6b', shadow: '#443e3c', armor: '#7c6350', eye: '#ffb077', width: .47, head: '#665244' },
  gunner: { skin: '#839e97', shadow: '#324b4e', armor: '#476975', eye: '#a6f0df', width: .40, head: '#4e6970' },
  sniper: { skin: '#8b92a3', shadow: '#303f57', armor: '#536582', eye: '#a5d5ff', width: .35, head: '#3e506d' },
  hound: { skin: '#796859', shadow: '#363331', armor: '#514d40', eye: '#f4a767', width: .38, head: '#938171' },
  leaper: { skin: '#a4ad8c', shadow: '#4b5445', armor: '#67735a', eye: '#e5e98b', width: .29, head: '#9da783' },
  screecher: { skin: '#917e8c', shadow: '#463d4b', armor: '#665668', eye: '#efa6c5', width: .40, head: '#786577' },
  ...MONSTER_VARIANT_ART,
});

const CREATURE_TYPES = new Set(['hound', 'leaper', 'screecher']);
const STILL_MONSTER_GAIT = Object.freeze({ phase: 0, stride: 0, speed: 0, airborne: false, land: 0 });
const monsterCycleLength = type => type === 'hound' ? 1.28 : type === 'leaper' ? 2.05 : type === 'screecher' ? 1.85 : type === 'runner' ? 1.75 : 3;

/** Pure anatomy inspection fallback; live gait integrates presented travel below. */
export function monsterAnimationPose(player, time = 0) {
  const speed = player?.alive === false ? 0 : Math.min(14, Math.hypot(finite(player?.vx), finite(player?.vz)));
  const airborne = player?.alive !== false && player?.grounded === false;
  const phase = speed && !airborne ? (finite(time) * .001 * speed * TAU / monsterCycleLength(player?.monsterType) + hash(player?.id) % 13) % TAU : 0;
  const yaw = finite(player?.yaw), vx = finite(player?.vx), vz = finite(player?.vz);
  return { phase, stride: airborne ? 0 : clamp(speed / 5, 0, 1), speed, airborne, land: 0,
    jump: airborne ? clamp(finite(player?.vy) / 6.4, 0, 1) : 0, fall: airborne ? clamp(-finite(player?.vy) / 8, 0, 1) : 0,
    forward: speed > .05 ? (Math.sin(yaw) * vx - Math.cos(yaw) * vz) / speed : 1,
    strafe: speed > .05 ? (Math.cos(yaw) * vx + Math.sin(yaw) * vz) / speed : 0 };
}

/** Bounded, independent creature gaits observe the final rendered positions. */
export function createMonsterAnimationPresenter({ maxMonsters = 20 } = {}) {
  const capacity = clamp(Number.isSafeInteger(maxMonsters) ? maxMonsters : 20, 1, 32), histories = new Map();
  const present = (player, time, context = null, { paused = false } = {}) => {
    const id = player?.id;
    if (!Number.isSafeInteger(id) || id < 0 || ![player?.x, player?.y, player?.z, time].every(Number.isFinite) || player?.alive === false || !Object.hasOwn(MONSTER_ART, player?.monsterType)) {
      histories.delete(id); return { phase: 0, stride: 0, speed: 0 };
    }
    let history = histories.get(id);
    const elapsed = history ? time - history.time : 0;
    const dx = history ? player.x - history.x : 0, dz = history ? player.z - history.z : 0;
    const reset = !history || history.context !== context || history.lifeId !== player.lifeId || history.type !== player.monsterType
      || elapsed < 0 || elapsed > 1000 && !paused && !history.paused || Math.hypot(dx, dz) > Math.max(.5, elapsed * .020);
    if (reset) {
      history = { x: player.x, y: player.y, z: player.z, gaitX: player.x, gaitZ: player.z, time, context, lifeId: player.lifeId, type: player.monsterType, paused,
        pose: { ...monsterAnimationPose({ ...player, vx: 0, vz: 0 }, 0), phase: hash(id) % 13 } };
      histories.delete(id);
      while (histories.size >= capacity) histories.delete(histories.keys().next().value);
      histories.set(id, history);
    }
    if (paused || history.paused) {
      // A tab resuming from pause keeps its held pose and discards elapsed wall time.
      history.x = history.gaitX = player.x; history.y = player.y; history.z = history.gaitZ = player.z; history.time = time; history.paused = paused;
      return history.pose;
    }
    if (!reset && elapsed > 0) {
      const travelled = Math.hypot(player.x - history.gaitX, player.z - history.gaitZ), distance = travelled > .001 ? travelled : 0;
      const speed = distance ? Math.min(14, Math.hypot(dx, dz) * 1000 / elapsed) : 0;
      const amount = 1 - Math.exp(-elapsed / (speed > .05 ? 45 : 70));
      const airborne = player.grounded === false, yaw = finite(player.yaw), length = Math.hypot(dx, dz);
      const stride = history.pose.stride + ((airborne ? 0 : clamp(speed / 5, 0, 1)) - history.pose.stride) * amount;
      const land = airborne ? 0 : history.pose.airborne ? clamp(Math.max(.25, -finite(player.vy) / 8, (history.y - player.y) * 1000 / elapsed / 8), 0, 1) : finite(history.pose.land) * Math.exp(-elapsed / 95);
      history.pose = { phase: (history.pose.phase + (airborne ? 0 : distance) * TAU / monsterCycleLength(player.monsterType)) % TAU, stride: stride < .00001 ? 0 : stride, speed, airborne,
        land: land < .00001 ? 0 : land, jump: airborne ? clamp(finite(player.vy) / 6.4, 0, 1) : 0, fall: airborne ? clamp(-finite(player.vy) / 8, 0, 1) : 0,
        forward: length > .001 ? (Math.sin(yaw) * dx - Math.cos(yaw) * dz) / length : history.pose.forward,
        strafe: length > .001 ? (Math.cos(yaw) * dx + Math.sin(yaw) * dz) / length : history.pose.strafe };
      if (distance) { history.gaitX = player.x; history.gaitZ = player.z; }
    }
    history.x = player.x; history.y = player.y; history.z = player.z; history.time = time;
    histories.delete(id); histories.set(id, history);
    return history.pose;
  };
  present.retain = ids => { const retained = new Set(ids); for (const id of histories.keys()) if (!retained.has(id)) histories.delete(id); };
  present.reset = () => histories.clear();
  Object.defineProperty(present, 'size', { get: () => histories.size });
  return present;
}

function creatureParts(mesh, player, type, art, pose, front, animation, motion) {
  const box = (x, y, z, w, h, d, color) => mesh.box(x, y + (motion.active && y >= .30 && y + h <= .64 && z >= -.20 && z + d <= .34 ? motion.bodyBob : 0), z, w, h, d, color, pose);
  const phase = finite(animation.phase), stride = clamp(finite(animation.stride), 0, 1), sprint = clamp(finite(animation.sprint), 0, 1);
  const windup = ['windup', 'lungeWindup'].includes(player.monsterState) ? smooth(1 - clamp(finite(player.attackTicks) / Math.max(1, finite(player.attackDuration, 1)), 0, 1)) : 0;
  const leap = player.monsterState === 'leap' && finite(player.lungeTicks) > 0;
  const roaring = player.monsterState === 'roar' && finite(player.roarTicks) > 0;
  const roar = roaring ? smooth(1 - clamp(finite(player.roarTicks) / Math.max(1, finite(player.roarDuration, 1)), 0, 1)) : 0;
  const rally = finite(player.monsterRallyTicks) > 0, eye = windup > .45 || leap || roaring ? '#ffe0a3' : art.eye;
  if (type === 'hound') {
    // The four independently planted paws, short docked tail, ears and muzzle
    // occupy the same oriented head/torso/leg boxes used by authoritative hits.
    const body = monsterBodyProfile(player), crown = (body || MONSTER_BODIES.hound).height;
    box(-.175, .30, -.17, .35, .255, .475, art.skin);
    box(-.13, .555, -.125, .26, .075, .36, art.shadow);
    box(-.18, .365, -.195, .36, .19, .07, art.head);
    box(-.15, .32, .235, .30, .16, .09, art.armor);
    let pawIndex = 0;
    for (const side of [-1, 1]) for (const end of [-1, 1]) {
      const centerX = side * .13, centerZ = end < 0 ? -.19 : .21;
      if (motion.active) {
        const paw = motion.paws[pawIndex++];
        appendMonsterLimb(mesh, pose, paw.hip, paw.knee, .074, .072, art.skin);
        appendMonsterLimb(mesh, pose, paw.knee, paw.ankle, .066, .062, art.shadow);
        mesh.box(paw.foot[0] - .050, paw.foot[1], paw.foot[2] - .052, .100, .050, .104, art.armor, pose);
        continue;
      }
      // Diagonal pairs trot together; each entire pose fits its own leg box.
      const swing = Math.sin(phase + (side === end ? 0 : Math.PI)), travel = swing * stride * .016;
      const lift = Math.max(0, Math.cos(phase + (side === end ? 0 : Math.PI))) * stride * .052;
      box(centerX - .046, .16, centerZ - .048 + travel, .092, .16, .096, art.skin);
      box(centerX - .038, .055 + lift, centerZ - .038 + travel, .076, .13, .076, art.shadow);
      box(centerX - .056, .006 + lift, centerZ - .072 + travel, .112, .05, .144, art.armor);
    }
    box(-.135, .555, -.38, .27, .155, .20, art.head);
    box(-.107, .587, -.445, .214, .070, .118, art.skin);
    box(-.11, .516 - windup * .012, -.448, .22, .054, .125, art.shadow);
    box(-.063, .628, -.455, .126, .041, .040, '#302e2c');
    front(-.093, .568, -.449, .186, .022, '#e1cbb0');
    for (const x of [-.105, .035]) {
      box(x, .701, -.324, .07, crown - .701, .066, art.skin);
      front(x + .015, .730, -.3245, .04, .044, art.shadow);
      front(x - .006, .673, -.381, .084, .028, art.shadow);
      front(x + .006, .681, -.3815, .055, .011 + windup * .008, eye);
    }
    // A compact bony stump stays inside the real torso, rather than drawing a
    // long unhittable appendage outside the dog's body.
    box(-.032, .476, .268, .064, .086, .065, art.shadow);
    box(-.023, .558, .273, .046, .061, .056, art.head);
    front(-.025, .447, -.196, .05, .052, rally ? '#aff0b4' : '#cab89d');
    return;
  }
  const crouch = type === 'leaper' ? windup * .055 + (leap ? .035 : 0) : .018 + roar * .025;
  const legStride = Math.sin(phase) * stride * .028;
  for (const [index, side] of [-1, 1].entries()) {
    const x = side < 0 ? -.184 : .084, travel = side * legStride;
    if (motion.active) {
      const leg = motion.legs[index];
      appendMonsterLimb(mesh, pose, leg.hip, leg.knee, .090, .112, art.armor);
      appendMonsterLimb(mesh, pose, leg.knee, leg.ankle, .078, .100, art.skin);
      mesh.box(leg.foot[0] - .050, leg.foot[1], leg.foot[2] - .090, .100, .110, .180, art.shadow, pose);
      front(leg.knee[0] - .014, leg.knee[1] - .08, leg.knee[2] - .060, .028, .140, type === 'leaper' ? '#d6d5b9' : '#b09cae');
      continue;
    }
    box(x, .018, -.13 + travel, .10, .11, .26, art.shadow);
    box(x + .011, .126, -.085 + travel, .078, .38, .15, art.skin);
    box(x - .004, .476, -.102 + travel, .108, .30 - crouch, .19, art.armor);
    front(x + .027, .183, -.086 + travel, .022, .245, type === 'leaper' ? '#d6d5b9' : '#b09cae');
  }
  const width = type === 'leaper' ? .28 : .40;
  box(-width / 2, .752 - crouch, -.128, width, .53, .26, art.skin);
  box(-.186, 1.135 - crouch, type === 'screecher' ? -.065 : -.109, .372, .265, .237, art.armor);
  box(-.105, 1.378 - crouch, -.088, .21, .11 + crouch, .176, art.shadow);
  for (let rib = 0; rib < 4; rib++) {
    const ribWidth = width * .78 - rib * .020;
    front(-ribWidth / 2, .834 + rib * .075 - crouch, -.1285, ribWidth, .019, art.shadow);
  }
  for (const [index, side] of [-1, 1].entries()) {
    const x = side < 0 ? -.236 : .172;
    const lift = type === 'leaper' ? windup * .23 + (leap ? .18 : 0) : roar * .14;
    if (motion.active) {
      const arm = motion.arms[index];
      appendMonsterLimb(mesh, pose, arm.shoulder, arm.elbow, .064, .078, art.skin);
      appendMonsterLimb(mesh, pose, arm.elbow, arm.hand, .058, .072, art.shadow);
      for (let claw = 0; claw < 2; claw++) mesh.box(arm.hand[0] - .024 + claw * .028, arm.hand[1] - .072, arm.hand[2] - .043, .013, .092, .027, '#dbd2b9', pose);
      continue;
    }
    // Longer bare forearms and small real claws stay within .29 body / .32
    // movement bounds; lunge travel belongs to the swept engine body itself.
    box(x, .803 + lift - crouch, -.115, .064, .395, .13, art.skin);
    box(x + .003, .618 + lift - crouch, -.15, .058, .20, .16, art.shadow);
    for (let claw = 0; claw < 2; claw++) box(x + .009 + claw * .022, .545 + lift - crouch, -.158, .013, .107, .027, '#dbd2b9');
  }
  const headBottom = 1.486, headWidth = type === 'leaper' ? .26 : .29, headFront = type === 'screecher' ? -.158 : -.13;
  box(-headWidth / 2, headBottom, headFront, headWidth, .224 - crouch * .4, .25, art.head);
  box(-headWidth / 2 + .019, 1.710 - crouch * .4, headFront + .020, headWidth - .038, .09 - crouch * .6, .218, art.skin);
  for (const x of [-.112, .026]) {
    front(x, 1.636 - crouch * .25, headFront - .0005, .086, .029, art.shadow);
    front(x + .013, 1.644 - crouch * .25, headFront - .001, .060, .012 + windup * .008 + roar * .007, eye);
  }
  if (type === 'leaper') {
    front(-.091, 1.509, -.1305, .182, .066, art.shadow);
    for (const x of [-.076, -.019, .039]) front(x, 1.516, -.131, .037, .017, '#e0d6b9');
    front(-.018, 1.653 - crouch * .25, -.131, .036, .053, art.shadow);
    front(-.025, .86 - crouch, -.129, .05, .275, rally ? '#aff0b4' : '#d2d6a8');
  } else {
    // Oversized black mouth and exposed luminous throat distinguish the
    // support ghoul. Mouth grows only during its real interruptible roar.
    const mouthHeight = .083 + roar * .052;
    front(-.104, 1.500, headFront - .001, .208, mouthHeight, '#272c31');
    front(-.055, 1.513, headFront - .0015, .110, .042 + roar * .022, roaring ? '#ffc2d2' : '#bd718e');
    for (const x of [-.090, -.036, .018, .072]) front(x, 1.572 + roar * .021, headFront - .002, .022, .016, '#ded0ca');
    front(-.045, 1.396 - crouch, -.0885, .09, .076, roaring ? '#f4b1cf' : rally ? '#aff0b4' : '#b57494');
    front(-.038, .886 - crouch, -.1285, .076, .19, rally ? '#aff0b4' : '#b993ab');
  }
}

function monsterParts(mesh, player, time, animation = null) {
  const type = MONSTER_ART[player.monsterType] ? player.monsterType : 'stalker', art = MONSTER_ART[type];
  const yaw = finite(player.yaw), pose = { x: player.x, y: finite(player.y), z: player.z, yaw };
  const gait = player.alive === false ? STILL_MONSTER_GAIT : animation || monsterAnimationPose(player, time), motion = monsterLocomotionPose(player, gait);
  const windup = player.monsterState === 'windup' ? 1 - clamp(finite(player.attackTicks) / Math.max(1, finite(player.attackDuration, 1)), 0, 1) : 0;
  const aiming = player.monsterState === 'aiming', armed = type === 'gunner' || type === 'sniper';
  const stride = Math.sin(finite(gait.phase)) * clamp(finite(gait.stride), 0, 1) * .025;
  const box = (x, y, z, w, h, d, color) => mesh.box(x, y + (motion.active && y >= .79 && y + h <= 1.38 ? motion.bodyBob : 0), z, w, h, d, color, pose);
  const front = (x, y, z, w, h, color) => {
    const points = [[x, y, z], [x, y + h, z], [x + w, y + h, z], [x + w, y, z]].map(point => {
      const p = rotate(point, yaw); return [p[0] + pose.x, p[1] + pose.y, p[2] + pose.z];
    });
    mesh.quad(...points, rotate([0, 0, -1], yaw), rgba(color));
  };
  if (appendMonsterVariant(mesh, player, pose, { time, animation: gait, motion })) return { type, armed: false, art, pose, yaw, pitch: 0 };
  if (CREATURE_TYPES.has(type)) {
    creatureParts(mesh, player, type, art, pose, front, gait, motion);
    return { type, armed: false, art, pose, yaw, pitch: 0 };
  }
  // Every moving anatomical corner stays inside the shared .29 body and .22
  // head shooting boxes at every yaw, including the claw windup. Bigger armor
  // fills that envelope; it does not imply an unhittable oversized brute.
  for (const [index, [x, step]] of [[-.22, stride], [.06, -stride]].entries()) {
    if (motion.active) {
      const leg = motion.legs[index], depth = .26 - motion.stride * .085, width = .16 - motion.stride * .025;
      appendMonsterLimb(mesh, pose, leg.hip, leg.knee, .124, .142, art.skin);
      appendMonsterLimb(mesh, pose, leg.knee, leg.ankle, .115, .125, art.skin);
      mesh.box(leg.foot[0] - width / 2, leg.foot[1], leg.foot[2] - depth / 2, width, .145, depth, art.shadow, pose);
      front(leg.knee[0] - .053, leg.knee[1] - .006, leg.knee[2] - .078, .106, .025, type === 'brute' ? '#c6a282' : '#a6b29b');
      front(leg.ankle[0] - .012, leg.ankle[1] + .032, leg.ankle[2] - .064, .024, .100, art.shadow);
      continue;
    }
    box(x, .018, -.13 + step, .16, .16, .26, art.shadow);
    box(x + .018, .17, -.075 + step, .124, .64, .16, art.skin);
    box(x + .008, .45, -.096 + step, .144, .16, .028, art.armor);
    front(x + .027, .474, -.1245 + step, .106, .018, type === 'brute' ? '#c6a282' : '#a6b29b');
    front(x + .036, .23, -.0754 + step, .024, .135, art.shadow);
  }
  box(-art.width / 2, .79, -.15, art.width, .59, .30, art.skin);
  box(-.145, 1.375, -.10, .29, .105, .20, art.shadow);
  if (type === 'brute') {
    box(-.22, .86, -.15, .44, .43, .028, art.armor);
    front(-.198, .91, -.1785, .396, .035, '#ba936b');
    front(-.198, 1.07, -.1785, .396, .018, '#332f30');
    front(-.026, .89, -.1788, .052, .36, '#bc885b');
    for (const side of [-1, 1]) box(side < 0 ? -.24 : .16, 1.24, -.105, .08, .15, .21, '#9a7855');
  } else if (armed) {
    box(-.177, .89, -.152, .354, .36, .026, art.armor);
    for (const x of [-.16, -.054, .052]) {
      box(x, .93, -.177, .09, .16, .030, art.shadow);
      front(x + .012, .956, -.2075, .066, .023, type === 'sniper' ? '#9ebad0' : '#afc9b6');
    }
    front(-.149, 1.176, -.1785, .298, .024, '#9da8a1');
  } else {
    // Flush rib paint and a narrow luminous sternum read as an original ghoul,
    // rather than an ordinary operator with a green team tint.
    for (let rib = 0; rib < 4; rib++) {
      const width = art.width * .72 - rib * .026;
      front(-width / 2, .89 + rib * .089, -.1505, width, .021, art.shadow);
    }
    front(-.027, .902, -.151, .054, .30, type === 'runner' ? '#a294c2' : '#bac899');
    if (type === 'runner') {
      box(-.155, 1.265, -.156, .31, .113, .029, art.armor);
      front(-.138, 1.28, -.1855, .276, .018, '#a998c8');
    }
  }
  if (finite(player.monsterRallyTicks) > 0) front(-.027, 1.31, -.1508, .054, .036, '#aff0b4');
  for (const [index, side] of [-1, 1].entries()) {
    const x = side < 0 ? -.235 : .165;
    if (motion.active) {
      const arm = motion.arms[index];
      appendMonsterLimb(mesh, pose, arm.shoulder, arm.elbow, .070, .085, art.skin);
      appendMonsterLimb(mesh, pose, arm.elbow, arm.hand, .060, .072, art.armor);
      if (!armed) for (let claw = 0; claw < 2; claw++) mesh.box(arm.hand[0] - .024 + claw * .027, arm.hand[1] - .080, arm.hand[2] - .040, .013, .100, .025, '#d4d7b4', pose);
      front(arm.shoulder[0] - .020, arm.shoulder[1] - .065, arm.shoulder[2] - .052, .040, .055, art.shadow);
      continue;
    }
    const lift = armed ? .09 : windup * .20, forward = -.116 - windup * .030;
    box(x, .83 + lift, forward, .070, .42, .15, art.skin);
    box(x - (side < 0 ? 0 : .005), .805 + lift, forward - .021, .075, .15, .16, art.armor);
    if (!armed) for (let claw = 0; claw < 2; claw++) box(x + .012 + claw * .027, .75 + lift, forward - .021, .013, .115, .025, '#d4d7b4');
    front(x + .015, 1.15 + lift, forward - .0006, .04, .055, art.shadow);
  }
  const helmet = type === 'brute' || armed;
  const headWidth = type === 'brute' ? .31 : type === 'runner' ? .265 : .29;
  box(-headWidth / 2, 1.48, -.125, headWidth, .25, .25, art.head);
  box(-headWidth / 2 + .014, 1.73, -.113, headWidth - .028, .07, .226, helmet ? art.armor : art.skin);
  if (helmet) {
    front(-headWidth / 2 + .018, 1.637, -.1257, headWidth - .036, .041, art.armor);
    front(-.108, 1.51, -.126, .216, .077, art.shadow);
    for (const x of [-.071, -.019, .033]) front(x, 1.528, -.1265, .032, .025, '#849187');
  } else {
    front(-.108, 1.512, -.126, .216, .079, art.shadow);
    for (const x of [-.089, -.022, .045]) front(x, 1.525, -.1265, .044, .024, '#c7c4ad');
    front(-.025, 1.664, -.126, .05, .066, art.shadow);
  }
  const danger = windup > .55 || aiming;
  const eyes = danger ? '#ffe1a0' : art.eye;
  for (const x of [-.111, .027]) {
    front(x, 1.603, -.1263, .084, .033, '#202f33');
    front(x + .009, 1.611, -.1268, .066, danger ? .025 : .012, eyes);
  }
  if (type === 'sniper') {
    box(-.162, 1.68, -.137, .324, .059, .274, art.armor);
    front(-.150, 1.696, -.1376, .30, .013, '#92aac7');
  } else if (type === 'runner') {
    front(-.129, 1.564, -.1265, .258, .021, '#b2a0c5');
    front(-.013, 1.489, -.1267, .026, .063, '#9387a5');
  }
  return { type, armed, art, pose, yaw, pitch: clamp(finite(player.pitch) + finite(player.recoil), -1.45, 1.45) };
}

/** Inspectable anatomy excludes the gun, which uses the same real cover sweep as operators. */
export function monsterMeshes(player, time = 0, animation = null) {
  const mesh = new Mesh(); monsterParts(mesh, player, finite(time), animation); return mesh.array;
}

// Corpse cuboids remain rigid. The same anatomy is assembled once per species;
// limbs fold around their joints while the entire body topples onto real ground.
function deathTemplate(type) {
  const mesh = new Mesh(), parts = [];
  for (const name of ['box', 'quad']) {
    const original = mesh[name];
    mesh[name] = function(...args) {
      const start = this.length; original.apply(this, args);
      if (this.length === start) return;
      let x = 0, y = 0, z = 0, count = 0;
      for (let at = start; at < this.length; at += VERTEX_STRIDE) { x += this.storage[at]; y += this.storage[at + 1]; z += this.storage[at + 2]; count++; }
      const center = [x / count, y / count, z / count];
      const joint = type === 'hound' ? center[1] < .30 ? 'paw' : 'body'
        : center[1] < .43 ? 'shin' : center[1] < .81 ? 'thigh' : Math.abs(center[0]) > .20 && center[1] < 1.46 ? 'arm' : 'body';
      parts.push({ start, end: this.length, center, joint, order: hash(`${type}:${start}`) / 4294967296 });
    };
  }
  monsterParts(mesh, { id: 0, monster: true, human: false, monsterType: type, alive: false, x: 0, y: 0, z: 0, yaw: 0, vx: 0, vz: 0, monsterState: 'dead' }, 0, { phase: 0, stride: 0, speed: 0 });
  const base = mesh.array.slice(), eye = rgba(MONSTER_ART[type].eye), shadow = rgba(MONSTER_ART[type].shadow);
  for (let at = 0; at < base.length; at += VERTEX_STRIDE) {
    if ([0, 1, 2].every(axis => Math.abs(base[at + 6 + axis] - eye[axis]) < .00001)) {
      for (let axis = 0; axis < 3; axis++) base[at + 6 + axis] = shadow[axis];
    }
  }
  return { base, parts };
}

function rotateAxis(point, axis, angle) {
  const c = Math.cos(angle), s = Math.sin(angle), dot = point[0] * axis[0] + point[1] * axis[1] + point[2] * axis[2];
  return [point[0] * c + (axis[1] * point[2] - axis[2] * point[1]) * s + axis[0] * dot * (1 - c),
    point[1] * c + (axis[2] * point[0] - axis[0] * point[2]) * s + axis[1] * dot * (1 - c),
    point[2] * c + (axis[0] * point[1] - axis[1] * point[0]) * s + axis[2] * dot * (1 - c)];
}

function deathJoint(part, type, bend, crouching = false) {
  if (type === 'hound') return part.joint === 'paw' ? { pivot: [part.center[0], .30, part.center[2]], pitch: bend * .30, lower: 0 } : { pivot: [0, 0, 0], pitch: 0, lower: 0 };
  const side = part.center[0] < 0 ? -1 : 1;
  if (crouching) {
    if (part.joint === 'shin') return { pivot: [side * .11, .295, -.11], pitch: -.40 * bend, lower: -.05 * bend };
    if (part.joint === 'thigh') return { pivot: [side * .10, .53, .06], pitch: .22 * bend, lower: -.15 * bend };
    if (part.joint === 'arm') return { pivot: [side * .21, .767, 0], pitch: -.28 * bend, lower: -.15 * bend };
    return { pivot: [0, 0, 0], pitch: 0, lower: -.15 * bend };
  }
  if (part.joint === 'shin') return { pivot: [side * .14, .46, 0], pitch: -.58 * bend, lower: -.12 * bend };
  if (part.joint === 'thigh') return { pivot: [side * .14, .80, 0], pitch: .30 * bend, lower: -.31 * bend };
  if (part.joint === 'arm') return { pivot: [side * .21, 1.23, 0], pitch: -.28 * bend, lower: -.31 * bend };
  return { pivot: [0, 0, 0], pitch: 0, lower: -.31 * bend };
}

function writeDeathPose(entry, pose, { boundsOnly = false } = {}) {
  const { death, template, output, axis, maxAngle, ground } = entry;
  const angle = pose.angle * maxAngle / (death.monsterType === 'hound' ? 1.49 : 1.47);
  // Compose three rigid rotations once per cuboid, not once per vertex. This
  // keeps a twenty-monster cleave from creating thousands of frame objects.
  const globalColumns = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map(point => rotateAxis(rotate(point, death.yaw), axis, angle));
  const transform = point => [globalColumns[0][0] * point[0] + globalColumns[1][0] * point[1] + globalColumns[2][0] * point[2],
    globalColumns[0][1] * point[0] + globalColumns[1][1] * point[1] + globalColumns[2][1] * point[2],
    globalColumns[0][2] * point[0] + globalColumns[1][2] * point[1] + globalColumns[2][2] * point[2]];
  const boundParts = []; let length = 0, minY = Infinity;
  const settle = pose.reducedMotion ? Math.max(0, death.y - ground) : Math.max(0, death.y - ground - 4.9 * (pose.ageMs / 1000) ** 2);
  for (const part of template.parts) {
    const hidden = !boundsOnly && pose.dissolve > part.order;
    const joint = deathJoint(part, death.monsterType, pose.bend, death.crouching), start = length;
    const columns = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map(point => transform(rotate(point, 0, joint.pitch)));
    const pivot = rotate(joint.pivot, 0, joint.pitch), offset = transform([joint.pivot[0] - pivot[0], joint.pivot[1] - pivot[1] + joint.lower, joint.pivot[2] - pivot[2]]);
    const bounds = boundsOnly ? [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity] : null;
    const breakup = !boundsOnly && !pose.reducedMotion ? smooth((pose.dissolve - part.order + .12) / .12) * .028 : 0;
    const scatter = hash(`${death.key}:${part.start}`), scatterX = ((scatter & 15) / 15 - .5) * breakup, scatterZ = ((scatter >> 4 & 15) / 15 - .5) * breakup;
    const cx = columns[0], cy = columns[1], cz = columns[2], tint = 1 - pose.darken;
    for (let at = part.start; at < part.end; at += VERTEX_STRIDE) {
      const x = template.base[at], y = template.base[at + 1], z = template.base[at + 2];
      const px = cx[0] * x + cy[0] * y + cz[0] * z + offset[0] + death.x + scatterX;
      const py = cx[1] * x + cy[1] * y + cz[1] * z + offset[1];
      const pz = cx[2] * x + cy[2] * y + cz[2] * z + offset[2] + death.z + scatterZ;
      minY = Math.min(minY, py);
      if (hidden) continue;
      const nx = template.base[at + 3], ny = template.base[at + 4], nz = template.base[at + 5];
      output[length] = px; output[length + 1] = py; output[length + 2] = pz;
      output[length + 3] = cx[0] * nx + cy[0] * ny + cz[0] * nz;
      output[length + 4] = cx[1] * nx + cy[1] * ny + cz[1] * nz;
      output[length + 5] = cx[2] * nx + cy[2] * ny + cz[2] * nz;
      output[length + 6] = template.base[at + 6] * tint; output[length + 7] = template.base[at + 7] * tint; output[length + 8] = template.base[at + 8] * tint; output[length + 9] = 1;
      if (bounds) { bounds[0] = Math.min(bounds[0], px); bounds[1] = Math.min(bounds[1], py); bounds[2] = Math.min(bounds[2], pz); bounds[3] = Math.max(bounds[3], px); bounds[4] = Math.max(bounds[4], py); bounds[5] = Math.max(bounds[5], pz); }
      length += VERTEX_STRIDE;
    }
    if (bounds) boundParts.push(bounds);
  }
  // Grounding uses the complete folded anatomy, even when its lowest cubes
  // dissolve first; remaining body pieces therefore never jump upward.
  const lift = ground + settle + .008 - (Number.isFinite(minY) ? minY : 0);
  for (let at = 1; at < length; at += VERTEX_STRIDE) output[at] += lift;
  for (const bounds of boundParts) { bounds[1] += lift; bounds[4] += lift; }
  return { array: output.subarray(0, length), bounds: boundParts };
}

function deathTouchesCover(entry, map, angle = entry.maxAngle) {
  const old = entry.maxAngle; entry.maxAngle = angle;
  const result = writeDeathPose(entry, monsterDeathPose(entry.death, MONSTER_DEATH_RULES.collapseMs), { boundsOnly: true }); entry.maxAngle = old;
  return result.bounds.some(bound => (map.colliders || []).some(box => bound[3] > box.x + .001 && bound[0] < box.x + box.w - .001
    && bound[4] > box.y + .001 && bound[1] < box.y + box.h - .001 && bound[5] > box.z + .001 && bound[2] < box.z + box.d - .001));
}

function prepareDeathMesh(death, map, template) {
  const support = surfaceBelow(map.colliders || [], death.x, death.z, death.y + .06);
  const ground = support ? support.y + support.h : 0;
  const entry = { death, template, output: new Float32Array(template.base.length), axis: [1, 0, 0], maxAngle: death.monsterType === 'hound' ? 1.49 : 1.47, ground };
  const directionLength = Math.hypot(death.dx, death.dz), facing = death.yaw;
  const direction = directionLength > .001 ? Math.atan2(death.dx, death.dz) : facing;
  const hound = death.monsterType === 'hound', sign = death.dx * Math.cos(facing) + death.dz * Math.sin(facing) < 0 ? -1 : 1;
  const turns = hound ? [sign, -sign] : [0, 1, -1, 2, -2, 3, -3, 4];
  for (const turn of turns) {
    entry.axis = hound ? [Math.sin(facing) * turn, 0, -Math.cos(facing) * turn]
      : [Math.cos(direction + turn * Math.PI / 4), 0, -Math.sin(direction + turn * Math.PI / 4)];
    // The middle of a fall must also clear a desk or crate, not just its end.
    if (!deathTouchesCover(entry, map) && !deathTouchesCover(entry, map, entry.maxAngle * .55)) return entry;
  }
  // In a narrow corner, fold against the obstruction rather than extending
  // a horizontal corpse through it. The final pose remains unmistakably dead.
  let low = 0, high = entry.maxAngle;
  for (let i = 0; i < 7; i++) { const angle = (low + high) / 2; if (deathTouchesCover(entry, map, angle)) high = angle; else low = angle; }
  entry.maxAngle = low; return entry;
}

/** Pure, inspectable death anatomy contains neither a held gun nor loot. */
export function monsterDeathMeshes(death, ageMs = 0, map = MAPS.courtyard) {
  const pose = monsterDeathPose(death, ageMs);
  if (!pose.visible || !death || !Object.hasOwn(MONSTER_ART, death.monsterType) || ![death.x, death.y, death.z, death.yaw].every(Number.isFinite)) return new Float32Array(0);
  const normalized = { ...death, key: death.key || `${death.targetId}:${death.lifeId}`, dx: finite(death.dx), dz: finite(death.dz) };
  return writeDeathPose(prepareDeathMesh(normalized, map, deathTemplate(death.monsterType)), pose).array;
}

/** One bounded body buffer per kill; all corpses join the existing world batch. */
export function createMonsterDeathMeshPresenter() {
  const templates = new Map(), entries = new Map(), mesh = new Mesh(); let builds = 0;
  const present = (deaths = [], map = MAPS.courtyard) => {
    mesh.reset(); const keep = new Set();
    for (const death of deaths.slice(0, MONSTER_DEATH_RULES.maxCorpses)) {
      const pose = monsterDeathPose(death, death.ageMs); if (!pose.visible || !Object.hasOwn(MONSTER_ART, death.monsterType)) continue;
      const key = death.key || `${death.targetId}:${death.lifeId}`; let entry = entries.get(key);
      if (!entry) {
        if (!templates.has(death.monsterType)) templates.set(death.monsterType, deathTemplate(death.monsterType));
        entry = prepareDeathMesh(death, map, templates.get(death.monsterType)); entries.set(key, entry); builds++;
      }
      mesh.append(writeDeathPose(entry, pose).array); keep.add(key);
    }
    for (const key of entries.keys()) if (!keep.has(key)) entries.delete(key);
    return mesh.array;
  };
  present.reset = () => { entries.clear(); templates.clear(); mesh.reset(); builds = 0; };
  present.getStats = () => ({ geometryBuilds: builds, vertices: mesh.length / VERTEX_STRIDE,
    templateBytes: [...templates.values()].reduce((sum, template) => sum + template.base.byteLength, 0) + [...entries.values()].reduce((sum, entry) => sum + entry.output.byteLength, 0), bufferBytes: mesh.storage.byteLength });
  return present;
}

function monsterMesh(mesh, player, map, time, animation = null, presentedReload = null) {
  const { armed, art, pose, yaw, pitch } = monsterParts(mesh, player, time, animation);
  if (!armed) return;
  const offset = rotate([.12, 1.24, -.18], yaw), reloadProgress = presentedReload?.globalProgress ?? (player.reloadTicks > 0 ? clamp(1 - player.reloadTicks / (weaponReloadDuration(player.weapon, player.ammo) || 252), 0, 1) : 0);
  const gunPose = { x: pose.x + offset[0], y: pose.y + offset[1], z: pose.z + offset[2], yaw, pitch, scale: .84 };
  const direction = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
  const limit = Math.max(0, rayCoverDistance([gunPose.x, gunPose.y, gunPose.z], direction, map.colliders || [], weaponLength(player.weapon) * gunPose.scale + .12, weaponCoverPadding(player.weapon, gunPose.scale, reloadProgress)) - .025) / gunPose.scale;
  weaponParts(mesh, player.weapon, gunPose, { limit, stock: art.armor, reloadProgress, reloadMotion: presentedReload || undefined, aim: aimProgress(player), loaded: player.ammo > 0, cycle: 1 - finite(player.shotCooldown) / (WEAPONS[player.weapon]?.cooldown || 1) });
  mesh.box(-.07, -.14, -.10, .13, .14, .16, art.skin, gunPose);
}

function fallenSurvivorKit(mesh, contacts, player, cameraYaw) {
  const pose = { x: player.x, y: finite(player.y), z: player.z, yaw: finite(player.yaw) }, mint = '#a3e6b7';
  mesh.box(-.15, .023, -.20, .30, .12, .40, '#394b4c', pose);
  mesh.box(-.125, .143, -.165, .25, .055, .33, '#8d8b6f', pose);
  for (const x of [-.092, .065]) mesh.box(x, .035, -.206, .027, .138, .018, '#bcb294', pose);
  mesh.box(-.11, .198, -.095, .22, .087, .19, '#566c61', pose);
  mesh.box(-.08, .245, -.125, .16, .028, .034, '#bfc9a7', pose);
  // A face-on cross is ordinary depth-tested world geometry, so a fallen
  // teammate is easy to locate without a marker revealing them through walls.
  const marker = { x: pose.x, y: pose.y, z: pose.z, yaw: finite(cameraYaw) };
  mesh.box(-.039, .46, -.015, .078, .28, .03, mint, marker);
  mesh.box(-.14, .561, -.015, .28, .078, .03, mint, marker);
  contacts.floorRing(pose.x, pose.z, .23, .26, rgba(mint, .55), pose.y + .016, 12);
}

function validSpawnWarning(warning) {
  return warning && [warning.x, warning.y, warning.z, warning.ticksLeft, warning.durationTicks].every(Number.isFinite) && warning.ticksLeft > 0 && warning.durationTicks > 0;
}

/** Four small rifts identify the actual pending spawn points before enemies arrive. */
export function createSpawnWarningPresenter() {
  const cache = new Map(), output = new Mesh(); let builds = 0;
  const present = (warnings = [], time = 0) => {
    output.reset(); const kept = new Set(); let count = 0;
    for (const warning of warnings) {
      if (count >= MAX_SPAWN_WARNINGS) break;
      if (!validSpawnWarning(warning)) continue;
      const key = warning.id ?? `slot-${count}`; let entry = cache.get(key);
      if (!entry || ['x', 'y', 'z', 'monsterType'].some(field => entry.source[field] !== warning[field])) {
        const base = new Mesh(), color = rgba(MONSTER_ART[warning.monsterType]?.eye || '#c9b3ff', .55);
        base.floorRing(warning.x, warning.z, .34, .395, color, warning.y + .027, 12);
        base.floorRing(warning.x, warning.z, .47, .492, shade(color, .85), warning.y + .025, 12);
        for (const [dx, dz] of [[-.29, -.29], [.29, -.29], [-.29, .29], [.29, .29]]) {
          for (let tier = 0; tier < 3; tier++) base.box(warning.x + dx - .017, warning.y + .07 + tier * .145, warning.z + dz - .017, .034, .077, .034, color);
        }
        entry = { source: { x: warning.x, y: warning.y, z: warning.z, monsterType: warning.monsterType }, base: base.array, animated: base.array.slice() };
        cache.set(key, entry); builds++;
      }
      const progress = 1 - clamp(warning.ticksLeft / warning.durationTicks, 0, 1), glow = .58 + Math.sin(finite(time) * .008 + hash(key) % 13) * .16 + progress * .25;
      for (let at = 0; at < entry.base.length; at += VERTEX_STRIDE) {
        entry.animated[at + 1] = warning.y + .025 + (entry.base[at + 1] - warning.y - .025) * (.40 + progress * .60);
        entry.animated[at + 9] = entry.base[at + 9] * glow;
      }
      output.append(entry.animated); kept.add(key); count++;
    }
    for (const key of cache.keys()) if (!kept.has(key)) cache.delete(key);
    return { contacts: output.array, count };
  };
  present.reset = () => { cache.clear(); output.reset(); builds = 0; };
  present.getStats = () => ({ cachedItems: cache.size, builds, bufferBytes: output.storage.byteLength, templateBytes: [...cache.values()].reduce((bytes, entry) => bytes + entry.base.byteLength + entry.animated.byteLength, 0) });
  return present;
}

/** The circle is a ground projection; outside danger comes from surface haze. */
export function stormMesh(storm) {
  const mesh = new Mesh();
  if (!storm?.active || ![storm.x, storm.z, storm.radius].every(Number.isFinite) || storm.radius < 0) return mesh.array;
  const radius = Math.min(storm.radius, 256);
  mesh.floorRing(storm.x, storm.z, Math.max(0, radius - .11), radius + .11, [.49, .79, .94, .68], .035, 64);
  mesh.floorRing(storm.x, storm.z, Math.max(0, radius - .43), Math.max(.025, radius - .32), [.47, .73, .90, .19], .034, 64);
  return mesh.array;
}

// Human appearances are deterministic presentation data, shared by the arena,
// battle royale, monster survival and their practice modes. Team colours are
// small cloth tabs; a player always retains their own skin, hair and clothes.
const HUMAN_SKIN = ['#dfb18d', '#b47b57', '#8e593e', '#edc7a2', '#c9956d', '#70452f'];
const HUMAN_HAIR = ['#342a26', '#573a2a', '#241f21', '#9d7045', '#40332d', '#b49b73'];
const HUMAN_SHIRTS = ['#65736f', '#697789', '#82745c', '#6b7770', '#756681', '#8a7063'];
const HUMAN_PANTS = ['#444b47', '#3d4650', '#525043', '#424e47', '#4e464f', '#4f463f'];

export function humanAppearance(player = {}, freeForAll = false) {
  const identity = Number.isInteger(player.id) ? Math.abs(player.id) : hash(player.id ?? 'spectator');
  const skin = HUMAN_SKIN[identity % HUMAN_SKIN.length], hair = HUMAN_HAIR[(identity * 3 + Math.floor(identity / 3)) % HUMAN_HAIR.length];
  const accent = freeForAll ? survivorColor(player) : TEAM_COLORS[player.team === 1 ? 1 : 0];
  return { skin, skinShadow: shade(rgba(skin), .78), hair, eyes: ['#46615b', '#4c3f32', '#40566b'][identity % 3],
    shirt: HUMAN_SHIRTS[identity % HUMAN_SHIRTS.length], pants: HUMAN_PANTS[identity % HUMAN_PANTS.length],
    vest: '#394849', accent, style: identity % 4, beard: identity % 3 === 1,
    face: { front: -.126, eyesY: .178, mouthY: .096, exposed: true } };
}

/** Articulated joints in player-local metres: +X right, +Y up, -Z forward. */
export function operativePose(player, animation = playerAnimationPose(player, 0)) {
  // Structural height follows the actual stance. Only joint flex settles after
  // standing up, so a transitioning body never acquires a stretched neck.
  const crouch = player.crouching ? 1 : 0, crouchBlend = player.crouching ? 1 : clamp(finite(animation.crouch), 0, 1), airborne = !!animation.airborne;
  const phase = finite(animation.phase), stride = clamp(finite(animation.stride), 0, 1), sprint = clamp(finite(animation.sprint), 0, 1);
  const forward = clamp(finite(animation.forward, 1), -1, 1), strafe = clamp(finite(animation.strafe), -1, 1);
  const bob = clamp(finite(animation.bodyBob), -.028, 0), land = clamp(finite(animation.land), 0, 1);
  const hipY = lerp(.81, .53, crouch) + bob - land * .014, chestY = lerp(1.12, .68, crouch) + bob;
  const legs = [-1, 1].map((side, index) => {
    const swing = Math.sin(phase + index * Math.PI), raised = Math.max(0, Math.cos(phase + index * Math.PI));
    const lift = airborne ? .055 + finite(animation.jump) * .050 : raised ** 1.4 * stride * lerp(.108 + sprint * .022, .046, crouch);
    const travel = swing * stride * lerp(.080 + sprint * .020, .040, crouch);
    const foot = [side * .108 + strafe * travel * .55, .018 + lift, -.012 - forward * travel];
    const ankle = [foot[0], foot[1] + .112, foot[2] + .015];
    const hip = [side * .098, hipY, .024 + crouch * .036];
    // The raised swing foot bends its knee; the planted leg remains extended.
    // Crouch bends both knees forward rather than shrinking two rigid poles.
    const knee = [side * .111 + strafe * travel * .28, lerp(.445, .295, crouch) + lift * .55 + bob * .5 - land * .010,
      -.020 - crouchBlend * .090 - forward * travel * .28 - lift * .52];
    return { hip, knee, ankle, foot, lift };
  });
  const aiming = aimProgress(player), reloadProgress = animation.reload?.globalProgress ?? clamp(1 - finite(player.reloadTicks) / (weaponReloadDuration(player.weapon, player.ammo) || 252), 0, 1);
  const reloading = gunHeld(player) && (animation.reload ? animation.reload.reloadActive : finite(player.reloadTicks) > 0), reloadPose = animation.reload || weaponReloadPose(player.weapon, reloadProgress, { active: reloading }), reload = reloadPose.weight;
  const healing = finite(player.healTicks) > 0, potion = healing || player.slot === 'potion', melee = player.slot === 'sword', dual = !potion && (melee ? !!meleeProfile(player).dualWield : gunHeld(player) && !!WEAPONS[player.weapon]?.dualWield), single = melee || potion || player.slot === 'grenade' || player.slot === 'empty', swing = meleeMotion(player);
  const throwLift = finite(player.grenadeThrowTicks) > 0 ? .085 : 0;
  const arms = [-1, 1].map((side, index) => {
    const armSwing = Math.sin(phase + index * Math.PI + Math.PI) * stride * (.034 + sprint * .013) * (1 - aiming * .75);
    const shoulder = [side * .211, lerp(1.295, .767, crouch) + bob, .012];
    const elbow = [side * .192, lerp(1.065, .638, crouch) + bob + aiming * .020, -.053 + armSwing];
    const hand = [side * (side < 0 ? .106 : .125), lerp(1.145, .735, crouch) + bob + aiming * .070 - (side < 0 ? reload * .110 : 0), -.185 + armSwing * .42];
    if (!single && !dual && side < 0) { hand[0] = .074 - reload * .080 + reloadPose.bolt * .045; hand[1] += .015 + reloadPose.seat * .010 + reloadPose.bolt * .040; hand[2] = -.215 + armSwing * .30 + reload * .042 + reloadPose.bolt * .025; }
    if (player.slot === 'empty') { hand[0] = side * .193; hand[1] -= .11; hand[2] = -.035 + armSwing; elbow[2] += .015; }
    if (potion && !healing && side < 0) { hand[0] = -.125; hand[2] = -.17; }
    if (healing && side < 0) { hand[0] = -.114; hand[1] = lerp(1.415, .792, crouch); hand[2] = -.105; elbow[1] += .035; }
    if (dual) {
      const handReload = weaponReloadPose(player.weapon, reloadProgress, { active: reloading, hand: side > 0 ? 0 : 1 });
      hand[0] = side * (melee ? .185 : .128); hand[1] -= handReload.weight * .085; hand[2] = (melee ? -.22 : -.140) + armSwing * .3 + handReload.weight * .035; elbow[0] = side * .202;
    }
    if (sprint > 0) { hand[1] -= sprint * .040; hand[2] += sprint * .018; elbow[2] += sprint * .016; }
    const twoHandedBlade = melee && !dual && meleeWeaponId(player) !== 'knife';
    const posedBladeArm = melee && (dual ? swing.guarding || index === (player.meleeHand === 1 ? 0 : 1) : side > 0 || twoHandedBlade);
    if (posedBladeArm) {
      if (swing.phase !== 'idle' || twoHandedBlade) {
        const heldPlayer = dual && swing.guarding ? { ...player, meleeHand: side > 0 ? 0 : 1 } : player;
        const grip = meleeWorldPose(heldPlayer, heldPlayer === player ? swing : meleeMotion(heldPlayer));
        const support = twoHandedBlade && side < 0 ? meleeSupportGrip(player, grip) : null;
        const contact = support || [grip.x, grip.y - .025, grip.z];
        const local = rotate([contact[0] - finite(player.x), contact[1] - finite(player.y), contact[2] - finite(player.z)], -finite(player.yaw));
        hand[0] = local[0]; hand[1] = local[1]; hand[2] = local[2];
        elbow[0] = lerp(shoulder[0], hand[0], .55); elbow[1] = lerp(shoulder[1], hand[1], .48) - .09; elbow[2] = hand[2] * .48;
      } else { hand[0] += Math.sin(swing.yaw) * .028; hand[1] += -.035 + Math.sin(-swing.pitch) * .035; elbow[2] -= .025; }
    }
    if (throwLift && side < 0) { hand[1] += throwLift * (1 - crouch * .65); hand[2] += .025; elbow[1] += .055 * (1 - crouch * .6); }
    if (!(posedBladeArm && swing.phase !== 'idle')) hand[1] = Math.min((player.crouching ? .83 : 1.48) - .044, hand[1]);
    return { shoulder, elbow, hand };
  });
  return { phase, crouch, airborne, stride, legs, arms, torso: { hipY, chestY, bob }, head: { base: player.crouching ? .83 : 1.48 } };
}

function operativeParts(mesh, player, time, freeForAll = false, animation = null) {
  const crouch = !!player.crouching, yaw = finite(player.yaw), pitch = clamp(finite(player.pitch) + finite(player.recoil), -1.45, 1.45);
  const art = humanAppearance(player, freeForAll), joints = operativePose(player, animation || playerAnimationPose(player, time / 1000));
  const pose = { x: finite(player.x), y: finite(player.y), z: finite(player.z), yaw, pitch: 0 };
  const color = art.accent, team = rgba(color), uniform = rgba(art.shirt), headBase = crouch ? .83 : 1.48;
  const world = point => { const p = rotate(point, yaw); return [pose.x + p[0], pose.y + p[1], pose.z + p[2]]; };
  const box = (x, y, z, w, h, d, c) => mesh.box(x, y, z, w, h, d, c, pose);
  const paint = (points, normal, c) => mesh.quad(...points.map(world), rotate(normal, yaw), rgba(c));
  const front = (x, y, z, w, h, c) => paint([[x, y, z], [x, y + h, z], [x + w, y + h, z], [x + w, y, z]], [0, 0, -1], c);
  const back = (x, y, z, w, h, c) => paint([[x + w, y, z], [x + w, y + h, z], [x, y + h, z], [x, y, z]], [0, 0, 1], c);
  const limb = (a, b, width, depth, c) => {
    const aa = world(a), bb = world(b), dx = bb[0] - aa[0], dy = bb[1] - aa[1], dz = bb[2] - aa[2], horizontal = Math.hypot(dx, dz), length = Math.hypot(horizontal, dy);
    mesh.box(-width / 2, 0, -depth / 2, width, length, depth, c, { x: aa[0], y: aa[1], z: aa[2], yaw: horizontal > 1e-7 ? Math.atan2(-dx, dz) : yaw, pitch: Math.atan2(horizontal, dy) });
  };
  for (const leg of joints.legs) {
    limb(leg.hip, leg.knee, .129, .139, art.pants);
    limb(leg.knee, leg.ankle, .112, .121, art.pants);
    box(leg.foot[0] - .064, leg.foot[1], leg.foot[2] - .088, .128, .112, .176, '#303532');
    front(leg.foot[0] - .057, leg.foot[1] + .009, leg.foot[2] - .0885, .114, .019, '#968778');
    front(leg.foot[0] - .050, leg.foot[1] + .068, leg.foot[2] - .0885, .100, .017, '#5a6156');
  }
  const hipY = joints.torso.hipY, torsoTop = lerp(1.375, .812, joints.crouch) + joints.torso.bob;
  box(-.168, hipY - .060, -.121, .336, .106, .258, art.pants);
  box(-.178, hipY + .024, -.134, .356, torsoTop - hipY - .024, .268, art.shirt);
  box(-.057, torsoTop, -.056, .114, Math.max(.018, headBase + .043 - torsoTop), .112, art.skin);
  // A compact cloth carrier, three printed pockets and straps keep the human
  // silhouette readable without spending triangles on hidden enclosed gear.
  const vestBottom = hipY + .073, vestTop = torsoTop - .058, vestHeight = Math.max(.08, vestTop - vestBottom);
  box(-.155, vestBottom, -.162, .310, vestHeight, .029, art.vest);
  box(-.117, vestBottom + .010, .134, .234, Math.max(.08, vestHeight - .018), .067, '#4a5550');
  front(-.159, hipY - .021, -.1215, .318, .031, '#303735');
  front(-.018, hipY - .017, -.122, .036, .023, '#b6aa81');
  for (const x of [-.135, -.039, .057]) {
    front(x, vestBottom + vestHeight * .16, -.1915, .078, vestHeight * .36, '#697769');
    front(x + .009, vestBottom + vestHeight * .41, -.192, .060, .013, '#a7ad91');
  }
  for (const x of [-.130, .099]) front(x, vestBottom + vestHeight * .51, -.1915, .030, vestHeight * .46, '#809181');
  front(-.078, vestTop - .045, -.192, .156, .025, team);
  back(-.083, vestBottom + vestHeight * .57, .2015, .166, .023, team);
  back(-.097, vestBottom + .012, .2015, .017, Math.max(.02, vestHeight - .045), '#87947f');
  back(.080, vestBottom + .012, .2015, .017, Math.max(.02, vestHeight - .045), '#87947f');
  for (const [index, arm] of joints.arms.entries()) {
    limb(arm.shoulder, arm.elbow, .079, .090, art.shirt);
    limb(arm.elbow, arm.hand, .063, .069, art.skin);
    box(arm.hand[0] - .037, arm.hand[1] - .037, arm.hand[2] - .037, .074, .074, .074, art.skin);
    const side = index ? 1 : -1;
    // The stitched team stripe lies on the sleeve, so it remains depth-tested.
    const stripe = [[side * .253, arm.shoulder[1] - .069, -.028], [side * .253, arm.shoulder[1] - .035, -.028], [side * .253, arm.shoulder[1] - .035, .040], [side * .253, arm.shoulder[1] - .069, .040]];
    if (side < 0) stripe.reverse();
    paint(stripe, [side, 0, 0], team);
  }
  const headPose = { ...pose, y: pose.y + headBase };
  const headBox = (x, y, z, w, h, d, c) => mesh.box(x, y, z, w, h, d, c, headPose);
  const headPaint = (points, normal, c) => {
    const transform = point => { const p = rotate(point, yaw); return [headPose.x + p[0], headPose.y + p[1], headPose.z + p[2]]; };
    mesh.quad(...points.map(transform), rotate(normal, yaw), rgba(c));
  };
  const headFront = (x, y, z, w, h, c) => headPaint([[x, y, z], [x, y + h, z], [x + w, y + h, z], [x + w, y, z]], [0, 0, -1], c);
  headBox(-.137, .018, -.125, .274, .255, .236, art.skin);
  headBox(-.143, .267, -.128, .286, .053, .244, art.hair);
  headBox(-.020, .119, -.151, .040, .058, .028, art.skin);
  headBox(-.163, .126, -.043, .027, .083, .067, art.skin);
  headBox(.136, .126, -.043, .027, .083, .067, art.skin);
  const gaze = Math.sin(pitch) * .010, eyeY = .172 + gaze;
  // Exposed cheeks, sclera, dark pupils and separate eyebrows replace the old
  // opaque visor. Only these flush pixels follow pitch, inside real head bounds.
  for (const x of [-.106, .041]) {
    headFront(x, eyeY, -.1258, .065, .031, '#ece2ca');
    headFront(x + .019, eyeY + .002, -.1264, .027, .026, art.eyes);
    headFront(x + .027, eyeY + .004, -.1269, .012, .021, '#282725');
    headFront(x - .002, eyeY + .041, -.1261, .069, .014, art.hair);
  }
  headFront(-.052, .089, -.1261, .104, .009, '#915e4a');
  headFront(-.044, .098, -.1265, .088, .009, '#be927a');
  headFront(-.126, .118, -.1257, .061, .019, art.skinShadow);
  headFront(.065, .118, -.1257, .061, .019, art.skinShadow);
  headFront(-.135, .229, -.1259, .270, .034, art.hair);
  headFront(-.135, .206, -.126, .031, .058, art.hair);
  headFront(.104, .206, -.126, .031, .058, art.hair);
  headFront(art.style % 2 ? -.059 : .042, .239, -.1264, .066, .022, art.skin);
  // A subtle stubble wash remains below the mouth, never a face-covering mask.
  headFront(-.084, .028, -.1259, .168, .039, art.beard ? mix(rgba(art.skin), rgba(art.hair), .38) : art.skin);
  return { crouch, yaw, pitch, pose, color, team, uniform, art, joints };
}

/** Body/head art is inspectable separately from the continuously aimed gun. */
export function operativeMeshes(player, time = 0, freeForAll = false, animation = null) {
  const mesh = new Mesh(); operativeParts(mesh, player, finite(time), freeForAll, animation); return mesh.array;
}

function humanDeathTemplate(death, freeForAll = false) {
  const mesh = new Mesh(), parts = [], crouch = death.crouching === true;
  for (const name of ['box', 'quad']) {
    const original = mesh[name];
    mesh[name] = function(...args) {
      const start = this.length; original.apply(this, args);
      if (this.length === start) return;
      let x = 0, y = 0, z = 0, count = 0;
      for (let at = start; at < this.length; at += VERTEX_STRIDE) { x += this.storage[at]; y += this.storage[at + 1]; z += this.storage[at + 2]; count++; }
      const center = [x / count, y / count, z / count];
      const joint = center[1] < (crouch ? .28 : .43) ? 'shin' : center[1] < (crouch ? .57 : .81) ? 'thigh'
        : Math.abs(center[0]) > .18 && center[1] < (crouch ? .85 : 1.46) ? 'arm' : 'body';
      parts.push({ start, end: this.length, center, joint, order: hash(`human:${death.targetId}:${start}`) / 4294967296 });
    };
  }
  operativeParts(mesh, { id: death.targetId, team: death.team, alive: false, crouching: crouch, slot: 'empty', weapon: 'carbine', x: 0, y: 0, z: 0, yaw: 0 }, 0, freeForAll,
    { phase: 0, stride: 0, speed: 0, crouch: crouch ? 1 : 0 });
  return { base: mesh.array.slice(), parts };
}

/** Retain the operator's skin, clothes and stance, excluding dropped equipment. */
export function humanDeathMeshes(death, ageMs = 0, map = MAPS.courtyard, options = {}) {
  const pose = humanDeathPose(death, ageMs, options);
  if (!pose.visible || !death || ![death.x, death.y, death.z, death.yaw].every(Number.isFinite)) return new Float32Array(0);
  const normalized = { ...death, key: death.key || `${death.targetId}:${death.lifeId}:${death.deaths}`, dx: finite(death.dx), dz: finite(death.dz) };
  return writeDeathPose(prepareDeathMesh(normalized, map, humanDeathTemplate(death, options.freeForAll)), pose).array;
}

/** Bodies stay in the existing depth-tested world batch, with bounded buffers. */
export function createHumanDeathMeshPresenter() {
  const templates = new Map(), entries = new Map(), mesh = new Mesh(); let builds = 0;
  const present = (deaths = [], map = MAPS.courtyard, options = {}) => {
    mesh.reset(); const keep = new Set(), keepTemplates = new Set();
    for (const death of deaths.slice(0, HUMAN_DEATH_RULES.maxCorpses)) {
      const pose = humanDeathPose(death, death.ageMs, options); if (!pose.visible) continue;
      const key = death.key || `${death.targetId}:${death.lifeId}:${death.deaths}`, templateKey = `${death.targetId}:${death.team}:${death.crouching}:${!!options.freeForAll}`;
      let entry = entries.get(key);
      if (!entry) {
        if (!templates.has(templateKey)) templates.set(templateKey, humanDeathTemplate(death, options.freeForAll));
        entry = prepareDeathMesh(death, map, templates.get(templateKey)); entries.set(key, entry); builds++;
      }
      mesh.append(writeDeathPose(entry, pose).array); keep.add(key); keepTemplates.add(templateKey);
    }
    for (const key of entries.keys()) if (!keep.has(key)) entries.delete(key);
    for (const key of templates.keys()) if (!keepTemplates.has(key)) templates.delete(key);
    return mesh.array;
  };
  present.reset = () => { entries.clear(); templates.clear(); mesh.reset(); builds = 0; };
  present.getStats = () => ({ geometryBuilds: builds, vertices: mesh.length / VERTEX_STRIDE,
    templateBytes: [...templates.values()].reduce((sum, template) => sum + template.base.byteLength, 0) + [...entries.values()].reduce((sum, entry) => sum + entry.output.byteLength, 0), bufferBytes: mesh.storage.byteLength });
  return present;
}

function playerMesh(mesh, player, map, time, allied, freeForAll = false, animation = null, presentedReload = null) {
  const { crouch, yaw, pitch, pose, color, team, uniform, art, joints } = operativeParts(mesh, player, time, freeForAll, animation);
  const healing = finite(player.healTicks) > 0;
  const potion = healing || player.slot === 'potion', grenade = player.slot === 'grenade', empty = player.slot === 'empty';
  const sword = player.slot === 'sword', knife = sword && meleeWeaponId(player) === 'knife', motion = meleeMotion(player);
  const heldYaw = sword && player.meleeTicks > 0 ? finite(player.meleeYaw, yaw) : yaw;
  const heldPitch = sword && player.meleeTicks > 0 ? finite(player.meleePitch, pitch) : pitch;
  const handOffset = rotate([potion ? -.14 : sword ? .21 : .14, healing ? (crouch ? .87 : 1.42) : potion || grenade ? (crouch ? .71 : 1.14) : (crouch ? .82 : 1.24), healing ? -.34 : potion || grenade ? -.23 : sword ? -.24 - motion.extension : -.14], heldYaw);
  const reloadProgress = presentedReload?.globalProgress ?? (player.reloadTicks > 0 ? clamp(1 - player.reloadTicks / (weaponReloadDuration(player.weapon, player.ammo) || 252), 0, 1) : 0);
  const reloadPose = presentedReload || weaponReloadPose(player.weapon, reloadProgress, { active: gunHeld(player) && finite(player.reloadTicks) > 0 });
  const shotAge = playerShotAge(player);
  const worldShot = weaponShotPose(player.weapon, shotAge, aimProgress(player)), worldCycle = weaponCyclePose(player.weapon, shotAge);
  const gunPose = sword && !healing ? meleeWorldPose(player, motion) : { x: pose.x + handOffset[0], y: pose.y + handOffset[1] + reloadPose.weapon.y + (gunHeld(player) ? worldShot.y : 0) - finite(animation?.sprint) * .04, z: pose.z + handOffset[2], yaw: heldYaw + (gunHeld(player) ? worldShot.yaw : 0), pitch: heldPitch + reloadPose.weapon.pitch + (gunHeld(player) ? worldShot.pitch : 0) - finite(animation?.sprint) * .08, scale: 1 };
  const direction = [Math.sin(gunPose.yaw) * Math.cos(gunPose.pitch), Math.sin(gunPose.pitch), -Math.cos(gunPose.yaw) * Math.cos(gunPose.pitch)];
  const limit = sword ? meleeWorldCoverLimit(player, gunPose, map.colliders || []) : Math.max(0, rayCoverDistance([gunPose.x, gunPose.y, gunPose.z], direction, map.colliders || [], weaponLength(player.weapon) + .12, weaponCoverPadding(player.weapon, gunPose.scale, reloadProgress)) - .025) / gunPose.scale;
  if (potion) {
    const progress = healing ? clamp(1 - player.healTicks / HEAL.ticks, 0, 1) : 0, drink = healing ? Math.sin(progress * Math.PI) : 0;
    const bottlePose = { ...gunPose, pitch: drink * .72 };
    const reach = .24, limit = Math.max(0, rayCoverDistance([bottlePose.x, bottlePose.y, bottlePose.z], [Math.sin(bottlePose.yaw) * Math.cos(bottlePose.pitch), Math.sin(bottlePose.pitch), -Math.cos(bottlePose.yaw) * Math.cos(bottlePose.pitch)], map.colliders || [], reach, .14) - .015);
    potionParts(mesh, bottlePose, progress, limit);
    mesh.box(-.055, -.095, -.030, .110, .085, .130, art.skin, bottlePose);
  } else if (grenade) {
    const limit = Math.max(0, rayCoverDistance([gunPose.x, gunPose.y, gunPose.z], direction, map.colliders || [], .24, .14) - .015);
    grenadeParts(mesh, gunPose, .12, 288, time, true, limit);
    mesh.box(-.050, -.10, -.024, .10, .095, .12, art.skin, gunPose);
  } else if (sword && meleeProfile(player).dualWield) {
    for (const hand of [0, 1]) {
      const arm = joints.arms[hand === 0 ? 1 : 0], offset = rotate(arm.hand, yaw);
      const heldPlayer = motion.guarding ? { ...player, meleeHand: hand } : hand === (player.meleeHand === 1 ? 1 : 0) ? player : { ...player, meleeTicks: 0, meleeHand: hand };
      const swing = meleeMotion(heldPlayer);
      const handPose = swing.phase !== 'idle' ? meleeWorldPose(heldPlayer, swing) : { x: pose.x + offset[0], y: pose.y + offset[1] + .085, z: pose.z + offset[2] - .016, yaw: heldYaw + swing.yaw, pitch: heldPitch + swing.pitch, roll: finite(swing.roll), scale: 1.15 };
      const limit = meleeWorldCoverLimit(player, handPose, map.colliders || []);
      meleeParts(mesh, player, handPose, { hand, limit, active: swing.active || swing.guardActive });
      mesh.box(-.043, -.142, -.048, .086, .108, .11, art.skin, handPose);
    }
  } else if (sword) {
    meleeParts(mesh, player, gunPose, { limit, active: motion.active || motion.guardActive });
    mesh.box(-.047, -.080, -.025, .094, .110, .160, art.skin, gunPose);
    mesh.box(-.060, -.075, .15, .12, .15, .27, uniform, gunPose);
  } else if (!empty && gunHeld(player) && WEAPONS[player.weapon]?.dualWield) {
    const age = playerShotAge(player);
    for (const hand of [0, 1]) {
      const arm = joints.arms[hand === 0 ? 1 : 0], offset = rotate(arm.hand, yaw);
      const kick = weaponShotPose(player.weapon, hand === player.lastShotHand ? age : Infinity, aimProgress(player), hand === 0 ? 1 : -1);
      const pairedReload = weaponReloadPose(player.weapon, reloadProgress, { active: finite(player.reloadTicks) > 0, hand });
      const handPose = { x: pose.x + offset[0], y: pose.y + offset[1] + .12 + kick.y, z: pose.z + offset[2], yaw: heldYaw + kick.yaw + pairedReload.weapon.yaw * (hand === 0 ? 1 : -1), pitch: heldPitch + kick.pitch + pairedReload.weapon.pitch, scale: 1 };
      const forward = rotate([0, 0, -1], handPose.yaw, handPose.pitch), limit = Math.max(0, rayCoverDistance([handPose.x, handPose.y, handPose.z], forward, map.colliders || [], weaponLength(player.weapon) + .12, weaponCoverPadding(player.weapon, 1, reloadProgress)) - .025);
      weaponParts(mesh, player.weapon, handPose, { hand, limit, reloadProgress, reloadMotion: pairedReload, bolt: weaponCyclePose(player.weapon, hand === player.lastShotHand ? age : Infinity).bolt, aim: aimProgress(player) });
      mesh.box(-.043, -.128, -.041, .086, .108, .10, art.skin, handPose);
    }
  } else if (!empty && gunHeld(player)) {
    weaponParts(mesh, player.weapon, gunPose, { limit, stock: color, reloadProgress, reloadMotion: reloadPose, bolt: worldCycle.bolt, pump: worldCycle.pump, aim: aimProgress(player), loaded: player.ammo > 0, spin: finite(player.spinTicks) / (WEAPONS[player.weapon]?.spinupTicks || 1), cycle: 1 - finite(player.shotCooldown) / (WEAPONS[player.weapon]?.cooldown || 1) });
    mesh.box(-.067, -.135, -.11, .104, .115, .140, art.skin, gunPose);
  }
  if (allied) {
    // A small in-world team tab is depth-tested like every other triangle.
    mesh.box(-.055, (crouch ? 1.15 : 1.8) + .09, -.045, .11, .045, .09, team, pose);
  }
}

export class VoxelRenderer {
  constructor(canvas) {
    if (!canvas || typeof canvas.getContext !== 'function') throw new Error('A canvas is required for Voxel Breach.');
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: true, powerPreference: 'high-performance', preserveDrawingBuffer: false }) || canvas.getContext('experimental-webgl');
    if (!this.gl) throw new Error('Voxel Breach needs WebGL. Enable hardware acceleration in your browser and reopen the game.');
    this.available = true; this.contextLost = false; this.error = null; this.destroyed = false;
    this.mapCache = new Map(); this.hordeMaps = new WeakMap(); this.mapId = null; this.effectMap = null; this.effectGameId = null; this.effectRound = null; this.effectPhase = null; this.eventIds = new Set(); this.eventQueue = [];
    this.particles = []; this.tracers = []; this.localShot = null; this.localReload = null; this.shotContext = null;
    this.reducedMotion = typeof globalThis.matchMedia === 'function' ? globalThis.matchMedia('(prefers-reduced-motion: reduce)') : null;
    this.presentSlashImpacts = createSlashImpactPresenter();
    this.presentMonsterSpecialImpacts = createMonsterSpecialImpactPresenter();
    this.lastAim = null; this.swayX = 0; this.swayY = 0;
    this.frameMeshes = { world: new Mesh(), contact: new Mesh(), tracer: new Mesh(), weapon: new Mesh() };
    this.frameMeshes.tracer.ensure((MAX_MELEE_TRAIL_VERTICES + MAX_TRACERS * 6) * VERTEX_STRIDE);
    this.presentLoot = createLootPresenter(); this.presentWarnings = createSpawnWarningPresenter(); this.presentEye = createEyeHeightPresenter(); this.presentHumans = createPlayerAnimationPresenter(); this.presentMonsters = createMonsterAnimationPresenter(); this.presentHead = createFirstPersonMotionPresenter(); this.presentShots = createWeaponShotPresenter(); this.presentReloads = createWeaponReloadPresenter({ maxPlayers: 32 }); this.cameraReload = null; this.firstPersonMotion = null; this.shotMotion = null; this.humanPoses = new Map(); this.resizeReads = 0;
    this._frameDrawCalls = 0; this._frameDynamicVertices = 0; this._mapVertices = 0; this._lootItems = 0; this._stormVertices = 0;
    this._worldLabels = EMPTY_WORLD_LABELS;
    this.presentMonsterDeaths = createMonsterDeathPresenter(); this.presentMonsterDeathMeshes = createMonsterDeathMeshPresenter(); this.monsterDeaths = [];
    this.presentHumanDeaths = createHumanDeathPresenter(); this.presentHumanDeathMeshes = createHumanDeathMeshPresenter(); this.humanDeaths = []; this.deathCamera = null; this.deathCameraActor = null;
    this._onLost = event => {
      event.preventDefault(); this.contextLost = true; this.available = false; this._worldLabels = EMPTY_WORLD_LABELS;
      this.error = 'The 3D graphics context was interrupted. Waiting for the browser to restore it.';
      this._notify(this.error, true);
    };
    this._onRestored = () => {
      if (this.destroyed) return;
      try {
        this.mapCache.clear(); this._createResources(); this.contextLost = false; this.available = true; this.error = null; this.resetEffects(); this.resize();
        this.canvas.dispatchEvent(new CustomEvent('voxel-renderer-restored'));
      } catch (error) { this.error = error.message; this.available = false; this._notify(this.error, false); }
    };
    canvas.addEventListener('webglcontextlost', this._onLost, false);
    canvas.addEventListener('webglcontextrestored', this._onRestored, false);
    this._onResize = () => this.resize();
    if (typeof ResizeObserver === 'function') {
      this.resizeObserver = new ResizeObserver(entries => { const entry = entries.find(item => item.target === canvas); if (entry) this.resize(entry.contentRect); });
      this.resizeObserver.observe(canvas);
    }
    if (typeof window !== 'undefined') window.addEventListener('resize', this._onResize);
    if (typeof document !== 'undefined') document.addEventListener('fullscreenchange', this._onResize);
    try { this._createResources(); this.resize(); } catch (error) { this.destroy(); throw error; }
  }
  _notify(message, recoverable) {
    if (typeof CustomEvent === 'function') this.canvas.dispatchEvent(new CustomEvent('voxel-renderer-error', { detail: { message, recoverable } }));
  }
  _createResources() {
    const gl = this.gl;
    const vertex = shader(gl, gl.VERTEX_SHADER, VERTEX_SHADER), fragment = shader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    const program = gl.createProgram(); gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
    gl.deleteShader(vertex); gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const reason = gl.getProgramInfoLog(program); gl.deleteProgram(program);
      throw new Error(`Voxel graphics could not initialize: ${reason}`);
    }
    this.program = program;
    this.attributes = { position: gl.getAttribLocation(program, 'aPosition'), normal: gl.getAttribLocation(program, 'aNormal'), color: gl.getAttribLocation(program, 'aColor') };
    this.uniforms = Object.fromEntries(['Projection', 'View', 'Eye', 'Fog', 'FogStrength', 'LightDirection', 'Sun', 'Ambient', 'StormCircle', 'StormStrength'].map(name => [name.toLowerCase(), gl.getUniformLocation(program, `u${name}`)]));
    this.dynamicBuffer = gl.createBuffer(); this.weaponBuffer = gl.createBuffer(); this.contactBuffer = gl.createBuffer();
    this.tracerBuffer = gl.createBuffer();
    this.dynamicCapacity = 0; this.weaponCapacity = 0; this.contactCapacity = 0;
    this.tracerCapacity = this.frameMeshes.tracer.storage.byteLength;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.tracerBuffer); gl.bufferData(gl.ARRAY_BUFFER, this.tracerCapacity, gl.DYNAMIC_DRAW);
    const skyVertex = shader(gl, gl.VERTEX_SHADER, SKY_VERTEX_SHADER), skyFragment = shader(gl, gl.FRAGMENT_SHADER, SKY_FRAGMENT_SHADER);
    this.skyProgram = gl.createProgram(); gl.attachShader(this.skyProgram, skyVertex); gl.attachShader(this.skyProgram, skyFragment); gl.linkProgram(this.skyProgram);
    gl.deleteShader(skyVertex); gl.deleteShader(skyFragment);
    if (!gl.getProgramParameter(this.skyProgram, gl.LINK_STATUS)) throw new Error('Voxel sky graphics could not initialize.');
    this.skyAttributes = { position: gl.getAttribLocation(this.skyProgram, 'aPosition') };
    this.skyUniforms = Object.fromEntries(['Top', 'Horizon', 'SunColor', 'SunDirection', 'Right', 'Up', 'Forward', 'Scale'].map(name => [name.toLowerCase(), gl.getUniformLocation(this.skyProgram, `u${name}`)]));
    this.skyBuffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.skyBuffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.frontFace(gl.CCW);
    gl.disable(gl.DITHER);
  }
  resize(measuredRect = null) {
    if (this.destroyed || this.contextLost) return;
    const rect = measuredRect || this.canvas.getBoundingClientRect();
    if (!measuredRect) this.resizeReads++;
    const width = Math.max(1, rect.width || this.canvas.clientWidth || 960), height = Math.max(1, rect.height || this.canvas.clientHeight || 540);
    const ratio = Math.min(1.75, typeof devicePixelRatio === 'number' ? devicePixelRatio : 1);
    // Keep large/retina screens within a fixed pixel budget rather than scaling
    // draw cost without limit. Projection still uses the true CSS aspect.
    const cappedRatio = Math.min(ratio, Math.sqrt(2200000 / (width * height)));
    const pixelWidth = Math.max(1, Math.round(width * cappedRatio)), pixelHeight = Math.max(1, Math.round(height * cappedRatio));
    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) { this.canvas.width = pixelWidth; this.canvas.height = pixelHeight; }
    this.aspect = width / height; this.gl.viewport(0, 0, pixelWidth, pixelHeight);
  }
  _staticMesh(array) {
    const gl = this.gl, buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, array, gl.STATIC_DRAW);
    return { buffer, count: array.length / VERTEX_STRIDE };
  }
  _getMap(map) {
    // The immutable catalog object distinguishes mode variants that share an
    // id, such as the differently sized Breach and Royale Paris districts.
    if (this.mapCache.has(map)) return this.mapCache.get(map);
    const meshes = mapMeshes(map);
    const result = { opaque: this._staticMesh(meshes.opaque), shadows: this._staticMesh(meshes.shadows) };
    this.mapCache.set(map, result);
    // A bounded cache keeps authored maps from doubling resident memory.
    while (this.mapCache.size > 3) {
      const [key, old] = this.mapCache.entries().next().value;
      this.gl.deleteBuffer(old.opaque.buffer); this.gl.deleteBuffer(old.shadows.buffer); this.mapCache.delete(key);
    }
    return result;
  }
  _draw(mesh) {
    if (!mesh.count) return;
    const gl = this.gl, attributes = this.attributes, stride = VERTEX_STRIDE * 4;
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer);
    gl.enableVertexAttribArray(attributes.position); gl.vertexAttribPointer(attributes.position, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(attributes.normal); gl.vertexAttribPointer(attributes.normal, 3, gl.FLOAT, false, stride, 12);
    gl.enableVertexAttribArray(attributes.color); gl.vertexAttribPointer(attributes.color, 4, gl.FLOAT, false, stride, 24);
    gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
    this._frameDrawCalls++;
  }
  _dynamic(array, kind = 'world') {
    const gl = this.gl, buffer = kind === 'weapon' ? this.weaponBuffer : kind === 'tracer' ? this.tracerBuffer : kind === 'contact' ? this.contactBuffer : this.dynamicBuffer, capacityKey = kind === 'weapon' ? 'weaponCapacity' : kind === 'tracer' ? 'tracerCapacity' : kind === 'contact' ? 'contactCapacity' : 'dynamicCapacity';
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    if (array.byteLength > this[capacityKey]) {
      this[capacityKey] = Math.max(16384, Math.ceil(array.byteLength / 16384) * 16384);
      gl.bufferData(gl.ARRAY_BUFFER, this[capacityKey], gl.DYNAMIC_DRAW);
    }
    if (array.byteLength) gl.bufferSubData(gl.ARRAY_BUFFER, 0, array);
    this._frameDynamicVertices += array.length / VERTEX_STRIDE;
    return { buffer, count: array.length / VERTEX_STRIDE };
  }
  _events(state, time, localId, { reducedMotion = false } = {}) {
    const combat = !state.phase || ['fight', 'roundEnd', 'matchEnd'].includes(state.phase) || (state.gameId === 'voxel-horde' && state.phase === 'intermission');
    const map = typeof state.map === 'object' && state.map?.colliders ? state.map : MAPS[state.mapId];
    const localAlive = state.players?.find(player => player.id === localId)?.alive !== false;
    for (const event of state.events || []) {
      const key = event.id ?? `${event.tick}:${event.type}:${event.playerId}:${event.shotIndex ?? ''}`;
      if (this.eventIds.has(key)) continue;
      this.eventIds.add(key); this.eventQueue.push(key);
      while (this.eventQueue.length > MAX_EVENT_IDS) this.eventIds.delete(this.eventQueue.shift());
      if (Number.isFinite(state.tick) && Number.isFinite(event.tick) && state.tick - event.tick > 18) continue;
      if (!combat) continue;
      if (event.type === 'shot') {
        // Ballistic bolts are represented only by their moving world geometry.
        if (WEAPONS[event.weapon]?.projectile) continue;
        const origin = [finite(event.x), finite(event.y), finite(event.z)];
        const direction = [finite(event.dx), finite(event.dy), finite(event.dz, -1)];
        const end = [event.hitX, event.hitY, event.hitZ].every(Number.isFinite) ? [event.hitX, event.hitY, event.hitZ] : origin.map((value, i) => value + direction[i] * 60);
        const effects = shotEffect(event.weapon);
        this.tracers.push({ origin, end, born: time, team: event.team, local: event.playerId === localId, width: effects.tracerWidth, color: effects.tracerColor, life: effects.tracerTicks * 1000 / 120, weapon: event.weapon });
        if (event.playerId === localId && localAlive && (!event.pellet || event.pelletCount === 1)) {
          this.presentShots ||= createWeaponShotPresenter();
          if (this.presentShots.report(event, time)) this.localShot = { born: time, weapon: event.weapon, hand: event.hand === 1 ? 1 : 0, ...(Number.isInteger(event.shotIndex) ? { shotIndex: event.shotIndex } : {}) };
        }
        if (event.hitKind && event.hitKind !== 'none') {
          this.particles.push(...impactParticles(event, end, direction, map, time, key));
        }
      } else if (event.type === 'boltLaunch') {
        if (event.playerId === localId && localAlive) {
          this.presentShots ||= createWeaponShotPresenter();
          if (this.presentShots.report(event, time)) this.localShot = { born: time, weapon: 'crossbow' };
        }
      } else if (event.type === 'boltHit') {
        const origin = [finite(event.x), finite(event.y), finite(event.z)];
        this.particles.push(...impactParticles(event, origin, [-finite(event.nx), -finite(event.ny), -finite(event.nz)], map, time, key));
      } else if (event.type === 'damage') {
        this.particles.push(...bloodParticles(event, state, time, key));
      } else if (event.type === 'meleeParry' && [event.x, event.y, event.z].every(Number.isFinite)) {
        // A confirmed blade contact emits a tiny depth-tested clash. Guard
        // startup/holding never manufactures a contact, flash or camera kick.
        const origin = [event.x, event.y, event.z];
        for (let i = 0; i < 4; i++) {
          const angle = i * 2.39996 + hash(key) % 7;
          this.particles.push({ origin, born: time, vx: Math.sin(angle) * .55, vy: .32 + i * .055, vz: Math.cos(angle) * .55, color: i % 2 ? '#e8be78' : '#d9eee5', life: 100 + i * 13, gravity: 3, cover: true, radius: .22, size: .012, material: 'parry', shrink: true });
        }
      } else if (event.type === 'meleeHit') {
        this.presentSlashImpacts ||= createSlashImpactPresenter();
        this.particles.push(...this.presentSlashImpacts(event, state, time, { reducedMotion }));
      } else if (['monsterBlast', 'monsterMark', 'monsterShardImpact'].includes(event.type)) {
        this.presentMonsterSpecialImpacts ||= createMonsterSpecialImpactPresenter();
        this.particles.push(...this.presentMonsterSpecialImpacts(event, state, time, { reducedMotion }));
      } else if (event.type === 'reload' && event.playerId === localId) this.localReload = { born: time, weapon: event.weapon };
      else if (event.type === 'grenadeBounce' || event.type === 'healComplete') {
        const origin = [finite(event.x), finite(event.y, .2), finite(event.z)], heal = event.type === 'healComplete';
        const count = heal ? 8 : 4;
        for (let i = 0; i < count; i++) {
          const angle = i * 2.39996 + hash(key) % 7;
          this.particles.push({ origin, born: time, vx: Math.sin(angle) * (heal ? .25 : .48) + finite(event.nx) * .45, vy: heal ? .35 + i * .04 : .25 + finite(event.ny) * .40, vz: Math.cos(angle) * (heal ? .25 : .48) + finite(event.nz) * .45, color: heal ? '#a9d6b9' : '#bfa47b', life: heal ? 360 + i * 15 : 180 + i * 12, gravity: heal ? 0 : 3, cover: true });
        }
      } else if (event.type === 'explosion' || event.type === 'grenadeExplosion') {
        const origin = [finite(event.x), finite(event.y, .25), finite(event.z)];
        const grenade = event.type === 'grenadeExplosion', count = grenade ? 28 : 24;
        for (let i = 0; i < count; i++) {
          const angle = i * 2.39996;
          this.particles.push({ origin, born: time, vx: Math.sin(angle) * (2 + i % 4), vy: 1 + i % 5, vz: Math.cos(angle) * (2 + i % 4), color: i % 3 ? '#efbc77' : '#8c8c79', life: grenade ? 330 + i * 9 : 450 + i * 12, gravity: 3, cover: true, radius: grenade ? finite(event.radius, 5.5) : 8 });
        }
      }
    }
    if (this.tracers.length > MAX_TRACERS) this.tracers.splice(0, this.tracers.length - MAX_TRACERS);
    if (this.particles.length > MAX_PARTICLES) this.particles.splice(0, this.particles.length - MAX_PARTICLES);
    this.tracers = this.tracers.filter(trace => time - trace.born < finite(trace.life, 68));
    this.particles = this.particles.filter(particle => time - particle.born < particle.life);
  }
  _bomb(mesh, state, players, time) {
    if (state.gameId === 'voxel-royale' || state.gameId === 'voxel-horde') return;
    const bomb = state.bomb;
    if (!bomb) return;
    if (bomb.status === 'carried') {
      const carrier = players.find(player => player.id === bomb.carrierId && player.alive);
      if (!carrier) return;
      const pose = { x: carrier.x, y: finite(carrier.y), z: carrier.z, yaw: carrier.yaw, pitch: 0 };
      const y = carrier.crouching ? .58 : .99;
      mesh.box(-.16, y, .18, .32, .28, .15, '#a88f68', pose);
      mesh.box(-.12, y + .07, .325, .24, .05, .018, '#d8b96d', pose);
      return;
    }
    if (bomb.status !== 'planted' && bomb.status !== 'dropped') return;
    const x = finite(bomb.x), y = finite(bomb.y) + .035, z = finite(bomb.z);
    mesh.box(x - .22, y, z - .16, .44, .13, .32, '#2d3d40');
    mesh.box(x - .20, y + .13, z - .14, .40, .07, .28, '#bba777');
    mesh.box(x - .10, y + .20, z - .07, .14, .008, .10, bomb.status === 'planted' && Math.floor(time / 220) % 2 ? '#f4a76f' : '#74c7b4');
    mesh.box(x + .10, y + .20, z - .06, .06, .01, .11, '#263d3f');
    for (let i = 0; i < 3; i++) mesh.box(x - .17 + i * .034, y + .03, z - .168, .016, .13, .016, i === 1 ? '#b45e4c' : '#6e998c');
  }
  _grenades(mesh, contacts, state, map, time) {
    for (const grenade of (state.grenades || []).slice(0, grenadeCapacity(state))) {
      if (![grenade.x, grenade.y, grenade.z].every(Number.isFinite)) continue;
      const r = clamp(finite(grenade.radius, .12), .04, .25);
      const speed = Math.hypot(finite(grenade.vx), finite(grenade.vy), finite(grenade.vz));
      const spin = speed > .12 ? time * .005 + finite(grenade.bounces) * .8 : finite(grenade.bounces) * .8;
      grenadeParts(mesh, { x: grenade.x, y: grenade.y, z: grenade.z, yaw: spin, pitch: spin * .7 }, r, grenade.fuseTicks, time);
      const support = surfaceBelow(map.colliders, grenade.x, grenade.z, grenade.y - r);
      const ground = support ? support.y + support.h : 0, altitude = Math.max(0, grenade.y - r - ground);
      for (let layer = 1; layer >= 0; layer--) {
        const size = r * (.8 + layer * .5) + Math.min(.10, altitude * .05);
        const minX = Math.max(grenade.x - size, support?.x ?? -Infinity), maxX = Math.min(grenade.x + size, support ? support.x + support.w : Infinity);
        const minZ = Math.max(grenade.z - size, support?.z ?? -Infinity), maxZ = Math.min(grenade.z + size, support ? support.z + support.d : Infinity);
        contacts.floor(minX, minZ, maxX - minX, maxZ - minZ, [.035, .055, .08, .17 / (1 + altitude * 1.5)], ground + .014 + layer * .0004);
      }
    }
  }
  _bolts(mesh, state) {
    for (const bolt of (state.bolts || []).slice(0, 24)) {
      if (![bolt.x, bolt.y, bolt.z, bolt.vx, bolt.vy, bolt.vz].every(Number.isFinite)) continue;
      const horizontal = Math.hypot(bolt.vx, bolt.vz);
      const pose = { x: bolt.x, y: bolt.y, z: bolt.z, yaw: Math.atan2(bolt.vx, -bolt.vz), pitch: Math.atan2(bolt.vy, horizontal) };
      const feather = state.gameId === 'voxel-royale' ? survivorColor({ id: bolt.playerId }) : bolt.team === 1 ? '#7baaa1' : '#b7a177';
      // The live projectile is depth-tested in the operative batch. It never
      // draws an instantaneous beam or a trail through solid cover.
      // The simulated point is the tip; the shaft stays behind it so it cannot
      // visually enter a wall before the swept projectile contact does.
      mesh.box(-.009, -.009, .04, .018, .018, .37, '#d8ceaa', pose);
      mesh.box(-.015, -.012, 0, .030, .024, .078, '#c3d2c1', pose);
      mesh.box(-.045, -.006, .32, .09, .012, .09, feather, pose);
      mesh.box(-.006, -.042, .32, .012, .084, .09, feather, pose);
    }
  }
  _viewModel(player, yaw, pitch, time, freeForAll = false, map = null, viewEye = null, viewRoll = 0) {
    const mesh = this.frameMeshes?.weapon?.reset() || new Mesh(), team = freeForAll ? survivorColor(player) : TEAM_COLORS[player.team === 1 ? 1 : 0], art = humanAppearance(player, freeForAll);
    let motion = this.firstPersonMotion;
    if (!motion) {
      const fallback = playerAnimationPose(player, time / 1000);
      motion = { weaponX: Math.sin(fallback.phase) * .009 * fallback.stride, weaponY: -(1 - Math.cos(fallback.phase * 2)) * .004 * fallback.stride };
    }
    this.reloadMotion = null; this.meleePose = null;
    const aim = aimProgress(player);
    const age = this.presentShots ? this.presentShots.age(player.weapon, time) : this.localShot?.weapon === player.weapon ? Math.max(0, time - this.localShot.born) : Infinity;
    const effects = shotEffect(player.weapon), firing = gunHeld(player) ? (this.presentShots ? this.presentShots.sample(player.weapon, time, aim) : weaponShotPose(player.weapon, age, aim)) : weaponShotPose(player.weapon, Infinity, 0);
    this.shotMotion = firing;
    if (this.lastAim && Number.isFinite(this.lastAim.time) && time > this.lastAim.time) {
      let yawDelta = yaw - this.lastAim.yaw;
      while (yawDelta > Math.PI) yawDelta -= TAU;
      while (yawDelta < -Math.PI) yawDelta += TAU;
      // Normalize the look impulse and damping to elapsed time. A 240 Hz
      // display should retain the same weight as a 60 Hz display, rather than
      // producing quarter-sized impulses with four times as much damping.
      const elapsed = Math.min(100, time - this.lastAim.time), referenceFrame = 1000 / 60;
      const gain = frameAlpha(.3, elapsed);
      const lookRate = time - this.lastAim.time <= 100 ? referenceFrame / elapsed : 0;
      this.swayX += (clamp(-yawDelta * lookRate * .19, -.027, .027) - this.swayX) * gain;
      this.swayY += (clamp((pitch - this.lastAim.pitch) * lookRate * .17, -.021, .021) - this.swayY) * gain;
    }
    this.lastAim = { yaw, pitch, time };
    const coverLimit = (pose, reach, padding) => {
      if (!map?.colliders?.length) return reach;
      const offset = rotate([pose.x, pose.y, pose.z], yaw, pitch, viewRoll), eye = viewEye || [finite(player.x), finite(player.y) + (player.crouching ? WORLD.crouchEyeHeight : WORLD.eyeHeight), finite(player.z)];
      const origin = eye.map((value, axis) => value + offset[axis]);
      const direction = rotate(rotate([0, 0, -1], pose.yaw, pose.pitch), yaw, pitch, viewRoll);
      let limit = Math.max(0, rayCoverDistance(origin, direction, map.colliders, reach * pose.scale, padding) - .025) / pose.scale;
      const anchorDistance = Math.hypot(...offset), anchorDirection = normalized(offset);
      const anchorCover = rayCoverDistance(eye, anchorDirection, map.colliders, anchorDistance, padding);
      if (anchorCover < anchorDistance) {
        const alignment = anchorDirection.reduce((dot, value, axis) => dot + value * direction[axis], 0);
        // During a sideways committed melee swing the axial cut plane cannot
        // represent the wall behind this anchor. Stow the occluded item until
        // the anchor clears cover instead of painting a blade through it.
        if (alignment < .75) return -reach - 1;
        // A thin wall can lie between the eye and the view-model anchor.
        // Allow the local cut plane to move behind that anchor; otherwise a
        // forward-only ray could recreate the held item on the far side.
        const contact = eye.map((value, axis) => value + anchorDirection[axis] * Math.max(0, anchorCover - .025));
        limit = Math.min(limit, contact.reduce((distance, value, axis) => distance + (value - origin[axis]) * direction[axis], 0) / pose.scale);
      }
      return limit;
    };
    const glove = (pose, x, y, z, grip = 'gun', limit = Infinity) => {
      const fabric = art.shirt, palm = art.skinShadow, fingers = art.skin;
      const part = (dx, dy, dz, w, h, d, color) => {
        const clippedZ = Math.max(z + dz, -limit), depth = z + dz + d - clippedZ;
        if (depth > 0) mesh.box(x + dx, y + dy, clippedZ, w, h, depth, color, pose);
      };
      // A narrower palm, bent thumb and three finger segments read as a
      // gripping glove. The short wrist/cuff leave the sight line open.
      part(-.046, -.054, -.046, .092, .108, .104, palm);
      part(-.052, .015, -.032, .104, .034, .086, art.skin);
      const left = grip === 'support' || grip === 'blade-support', blade = grip === 'blade' || grip === 'blade-support';
      part(left ? -.076 : .044, -.006, -.059, .032, .060, .062, fingers);
      for (let i = 0; i < 3; i++) {
        if (blade) part(-.049, -.067, -.046 + i * .034, .104, .039, .027, fingers);
        else part(-.048, -.050 + i * .032, -.065, .098, .025, .042, fingers);
      }
      part(-.037, -.049, .044, .074, .085, .068, art.skin);
      part(-.047, -.059, .101, .094, .101, .054, fabric);
      part(-.044, -.065, .146, .088, .107, .145, art.shirt);
      part(-.033, .043, .110, .066, .005, .033, '#91a28a');
    };
    if (finite(player.healTicks) > 0 || player.slot === 'potion') {
      const healing = finite(player.healTicks) > 0, progress = healing ? clamp(1 - player.healTicks / HEAL.ticks, 0, 1) : 0, drink = healing ? Math.sin(progress * Math.PI) : 0;
      const pose = { x: -.14 - drink * .025 + finite(motion.weaponX), y: -.22 + drink * .11 + finite(motion.weaponY), z: -.43 + drink * .08, yaw: .12, pitch: drink * .72, scale: .93 };
      const limit = coverLimit(pose, .32, .23 * pose.scale);
      potionParts(mesh, pose, progress, limit);
      glove(pose, 0, -.081, .025, 'blade', limit);
      return mesh.array;
    }
    if (player.slot === 'sword') {
      const motion = meleeMotion(player), knife = meleeWeaponId(player) === 'knife';
      this.meleePose = { weapon: meleeWeaponId(player), ...motion };
      // Convert the locked world direction into the current camera basis.
      // Looking away cannot rotate the committed blade or its real trail.
      if (meleeProfile(player).dualWield) {
        for (const hand of [0, 1]) {
          const activeHand = hand === (player.meleeHand === 1 ? 1 : 0);
          const swing = motion.guarding ? meleeMotion({ ...player, meleeHand: hand }) : activeHand ? motion : meleeMotion({ ...player, meleeTicks: 0, meleeHand: hand });
          const pose = meleeViewPose(player, swing, { yaw, pitch, roll: viewRoll, swayX: this.swayX, weaponY: finite(this.firstPersonMotion?.weaponY) }, hand);
          const limit = coverLimit(pose, meleeLength(player), meleePadding(player) * pose.scale);
          meleeParts(mesh, player, pose, { hand, limit, active: swing.active || swing.guardActive });
          glove(pose, 0, -.105, -.014, hand === 0 ? 'blade' : 'support', limit);
        }
        return mesh.array;
      }
      const pose = meleeViewPose(player, motion, { yaw, pitch, roll: viewRoll, swayX: this.swayX, weaponY: finite(this.firstPersonMotion?.weaponY) });
      const limit = coverLimit(pose, meleeLength(player), meleePadding(player) * pose.scale);
      meleeParts(mesh, player, pose, { limit, active: motion.active || motion.guardActive });
      glove(pose, .003, -.057, knife ? .071 : .026, 'blade', limit);
      if (!knife) glove(pose, -.026, -.035, .175, 'blade-support', limit);
      return mesh.array;
    }
    if (player.slot === 'grenade') {
      const throwing = Math.sin(clamp(finite(player.grenadeThrowTicks) / 24, 0, 1) * Math.PI);
      const pose = { x: .21 + finite(motion.weaponX), y: -.24 - throwing * .12 + finite(motion.weaponY), z: -.44 - throwing * .13, yaw: -.12, pitch: throwing * -.22, scale: .94 };
      const limit = coverLimit(pose, .34, .20 * pose.scale);
      grenadeParts(mesh, pose, .12, 288, time, true, limit);
      glove(pose, 0, -.078, .029, 'blade', limit);
      return mesh.array;
    }
    if (player.slot === 'empty' || !gunHeld(player)) {
      for (const side of [-1, 1]) {
        const pose = { x: side * .20 + finite(motion.weaponX), y: -.33 + finite(motion.weaponY), z: -.38, yaw: side * -.13, pitch: .06, scale: .90 };
        glove(pose, 0, -.035, .015, 'blade', coverLimit(pose, .34, .14));
      }
      return mesh.array;
    }
    const acceptedReloadTicks = this.cameraReload?.authoritativeTicks ?? finite(player.reloadTicks);
    const reloadActive = acceptedReloadTicks > 0 && (this.cameraReload ? this.cameraReload.reloadActive : true);
    const reloadProgress = reloadActive ? clamp(1 - acceptedReloadTicks / (weaponReloadDuration(player.weapon, player.ammo) || WEAPONS.carbine.reloadTicks), 0, 1) : 0;
    const reloadPose = this.cameraReload || weaponReloadPose(player.weapon, reloadProgress, { active: reloadActive });
    const visualReloadProgress = reloadPose.globalProgress;
    const reloadHands = WEAPONS[player.weapon]?.dualWield ? [reloadPose, weaponReloadPose(player.weapon, visualReloadProgress, { active: reloadActive, hand: 1 })] : [reloadPose];
    this.reloadMotion = { weapon: player.weapon, active: reloadActive, progress: reloadProgress, visualProgress: visualReloadProgress, authoritativeTicks: acceptedReloadTicks, visualTicks: reloadPose.remainingTicks ?? acceptedReloadTicks, hands: reloadHands.map(hand => ({ hand: hand.hand, active: hand.active, stage: hand.stage, audioPhase: hand.audioPhase, magazineDrop: hand.magazineDrop, bolt: hand.bolt, pump: hand.pump, cylinder: hand.cylinder, lid: hand.lid, draw: hand.draw })) };
    const steady = 1 - aim * .92;
    const throwing = Math.sin(clamp(finite(player.grenadeThrowTicks) / 24, 0, 1) * Math.PI);
    if (WEAPONS[player.weapon]?.dualWield) {
      for (const hand of [0, 1]) {
        const side = hand === 0 ? 1 : -1;
        const handShot = this.presentShots ? this.presentShots.sample(player.weapon, time, aim, hand) : weaponShotPose(player.weapon, this.localShot?.hand === hand ? age : Infinity, aim, side);
        const handReload = reloadHands[hand], reloadWeapon = handReload.weapon;
        const pose = { x: side * lerp(.275, .175, aim) + (this.swayX + motion.weaponX) * steady + handShot.x + reloadWeapon.x * side,
          y: lerp(-.29, -.212, aim) + (this.swayY + motion.weaponY) * steady + handShot.y + reloadWeapon.y - throwing * .15,
          z: lerp(-.49, -.405, aim) + handShot.z + reloadWeapon.z + finite(motion.weaponZ) * steady,
          yaw: -side * lerp(.08, .055, aim) + this.swayX * 2 * steady + handShot.yaw + reloadWeapon.yaw * side,
          pitch: handShot.pitch + reloadWeapon.pitch + finite(motion.weaponPitch) * steady - throwing * .20, scale: .74 };
        const limit = coverLimit(pose, weaponLength(player.weapon) + .20, weaponCoverPadding(player.weapon, pose.scale, visualReloadProgress));
        const handAge = this.presentShots ? this.presentShots.age(player.weapon, time, hand) : this.localShot?.hand === hand ? age : Infinity;
        const length = weaponParts(mesh, player.weapon, pose, { hand, limit, reloadProgress, reloadMotion: handReload, bolt: weaponCyclePose(player.weapon, handAge).bolt, aim });
        glove(pose, 0, -.122, -.010, hand === 0 ? 'gun' : 'support', limit);
        const flashDuration = finite(effects.muzzleTicks, 5) * 1000 / 120;
        if (this.localShot?.hand === hand && age < flashDuration && !reloadActive && !throwing && finite(effects.muzzleStrength, 1) > 0) {
          const flare = (1 - age / flashDuration) * finite(effects.muzzleStrength, 1), flash = (.025 + flare * .036) * finite(effects.muzzleSize, 1), glow = rgba(effects.muzzleColor), core = mix(glow, rgba('#fff8dc'), .60);
          const flashPart = (x, y, z, w, h, d, color) => { const zz = Math.max(z, -limit), dd = z + d - zz; if (dd > 0) mesh.box(x, y, zz, w, h, dd, color, pose); };
          flashPart(-flash / 2, -.015, -length - .070, flash, flash, .05 + flare * .04, glow);
          flashPart(-flash * .95, -.013 + flash * .2, -length - .055, flash * 1.9, flash * .38, .028, core);
        }
      }
      return mesh.array;
    }
    const pose = {
      x: lerp(.29, 0, aim) + (this.swayX + motion.weaponX) * steady + firing.x + reloadPose.weapon.x,
      y: lerp(-.29, -(WEAPONS[player.weapon]?.adsSightHeight || .152) * .74, aim) + (this.swayY + motion.weaponY) * steady + firing.y + reloadPose.weapon.y - throwing * .15,
      z: lerp(-.49, -.35, aim) + firing.z + reloadPose.weapon.z + finite(motion.weaponZ) * steady,
      yaw: -.065 * (1 - aim) + this.swayX * 2 * steady + firing.yaw + reloadPose.weapon.yaw,
      pitch: firing.pitch + reloadPose.weapon.pitch + finite(motion.weaponPitch) * steady - throwing * .20,
      scale: .74,
    };
    const cyclePose = weaponCyclePose(player.weapon, age), pump = Math.max(cyclePose.pump, reloadPose.pump);
    const limit = coverLimit(pose, weaponLength(player.weapon) + .20, weaponCoverPadding(player.weapon, pose.scale, visualReloadProgress));
    const length = weaponParts(mesh, player.weapon, pose, { stock: team, limit, reloadProgress, reloadMotion: reloadPose, bolt: cyclePose.bolt, pump, aim, loaded: player.ammo > 0, spin: finite(player.spinTicks) / (WEAPONS[player.weapon]?.spinupTicks || 1), cycle: 1 - finite(player.shotCooldown) / (WEAPONS[player.weapon]?.cooldown || 1) });
    const support = reloadPose.support;
    glove(pose, support[0], support[1], support[2] + (reloadActive ? reloadPose.pump : cyclePose.pump) * finite(weaponVisualModel(player.weapon)?.pumpTravel, .16), 'support', limit);
    glove(pose, .004, -.131, .002, 'gun', limit);
    if (throwing > 0) {
      const hand = { x: -.20, y: -.17 - (1 - throwing) * .22, z: -.39 - throwing * .18, yaw: .17, pitch: -.16, scale: .74 };
      glove(hand, 0, -.015, .028, 'blade', coverLimit(hand, .35, .085));
    }
    const flashDuration = finite(effects.muzzleTicks, 5) * 1000 / 120;
    if (age < flashDuration && !reloadActive && !throwing && finite(effects.muzzleStrength, 1) > 0 && player.weapon !== 'crossbow') {
      const flare = (1 - age / flashDuration) * finite(effects.muzzleStrength, 1);
      const flash = (.025 + flare * .036) * finite(effects.muzzleSize, 1);
      const glow = rgba(effects.muzzleColor), core = mix(glow, rgba('#fff8dc'), .60);
      const flashPart = (x, y, z, w, h, d, color) => {
        const clippedZ = Math.max(z, -limit), depth = z + d - clippedZ;
        if (depth > 0) mesh.box(x, y, clippedZ, w, h, depth, color, pose);
      };
      const ports = weaponVisualModel(player.weapon)?.muzzlePorts;
      const port = ports?.[Math.max(0, Math.floor(finite(this.localShot?.shotIndex, 1)) - 1) % ports.length];
      const muzzleX = port?.x || 0, muzzleY = port ? port.y - .012 : 0;
      flashPart(muzzleX - flash / 2, muzzleY - .015, -length - .070, flash, flash, .05 + flare * .04, glow);
      flashPart(muzzleX - flash * .95, muzzleY - .013 + flash * .2, -length - .055, flash * 1.9, flash * .38, .028, core);
    }
    return mesh.array;
  }
  render(state, options = {}) {
    this._worldLabels = EMPTY_WORLD_LABELS;
    if (this.destroyed || this.contextLost || !this.available || !state) return false;
    let map = typeof state.map === 'object' && state.map?.colliders ? state.map : MAPS[state.mapId] || MAPS.courtyard;
    if (!map) return false;
    const players = state.players || state.fighters || [];
    const freeForAll = state.gameId === 'voxel-royale';
    const horde = state.gameId === 'voxel-horde';
    if (horde && map.sites?.length) {
      let presentation = this.hordeMaps.get(map);
      if (!presentation) { presentation = { ...map, sites: [] }; this.hordeMaps.set(map, presentation); }
      map = presentation;
    }
    const localId = options.localId ?? options.playerId;
    let cameraPlayer = options.viewPlayer ?? options.cameraPlayer ?? options.predictedPlayer ?? options.localPlayer ?? players.find(player => player.id === localId) ?? players.find(player => player.alive) ?? players[0];
    if (typeof cameraPlayer === 'string' || typeof cameraPlayer === 'number') cameraPlayer = players.find(player => player.id === cameraPlayer);
    if (!cameraPlayer) {
      const spawn = map.spawns?.[0]?.[0] || { x: 0, z: 0, yaw: 0 };
      cameraPlayer = { ...spawn, y: 0, alive: false };
    }
    const time = finite(options.time, typeof performance !== 'undefined' ? performance.now() : 0);
    const freshRound = Number.isFinite(state.round) && state.round !== this.effectRound;
    const setupTransition = state.phase !== this.effectPhase && ['lobby', 'countdown', 'buy'].includes(state.phase);
    if (map !== this.effectMap || state.gameId !== this.effectGameId || freshRound || setupTransition) this.resetEffects();
    this.mapId = map.id; this.effectMap = map; this.effectGameId = state.gameId; this.effectRound = state.round; this.effectPhase = state.phase;
    const shotOwner = players.find(player => player.id === localId) || cameraPlayer;
    const shotContext = { id: shotOwner.id, alive: shotOwner.alive, lifeId: shotOwner.lifeId, deaths: shotOwner.deaths, weapon: shotOwner.weapon, slot: shotOwner.slot, inventoryIndex: shotOwner.inventoryIndex };
    if (this.shotContext && Object.keys(shotContext).some(key => this.shotContext[key] !== shotContext[key])) {
      this.presentShots.reset(); this.localShot = null; this.localReload = null;
    }
    this.shotContext = shotContext;
    const reducedMotion = this.reducedMotion?.matches === true || options.reducedMotion === true || options.quality === 'reduced';
    this._events(state, time, localId, { reducedMotion });
    const yaw = finite(options.aimYaw ?? options.yaw, finite(cameraPlayer.yaw));
    let pitch = clamp(finite(options.aimPitch ?? options.pitch, finite(cameraPlayer.pitch)), -1.48, 1.48);
    const aim = aimProgress(cameraPlayer), zoom = weaponAimFovRatio(cameraPlayer.weapon, ADS);
    const headContext = `${state.gameId || 'voxel-breach'}:${map.id}:${state.matchId ?? ''}:${state.round ?? ''}`;
    const motion = this.presentHead(cameraPlayer, time, headContext, { aim, paused: state.phase === 'paused' || !!options.paused });
    this.presentReloads.retain([...players.map(player => player.id), cameraPlayer.id]);
    const acceptedPlayers = Array.isArray(options.acceptedPlayers) ? options.acceptedPlayers : players;
    this.monsterDeaths = this.presentMonsterDeaths({ ...state, players: acceptedPlayers }, time, { paused: state.phase === 'paused' || !!options.paused });
    this.humanDeaths = this.presentHumanDeaths({ ...state, players: acceptedPlayers }, time, { paused: state.phase === 'paused' || !!options.paused });
    const acceptedById = new Map(acceptedPlayers.map(player => [player.id, player]));
    const presentReload = player => {
      const accepted = acceptedById.get(player.id);
      const sameActor = accepted && ['id', 'alive', 'lifeId', 'deaths', 'weapon', 'slot', 'inventoryIndex'].every(field => accepted[field] === player[field]);
      // Body/camera positions are already projected. Only the raw accepted
      // timer enters this one bounded clock, so it cannot advance twice.
      const source = sameActor ? accepted : { ...player, reloadTicks: 0 };
      return this.presentReloads(source, time, headContext, { durationTicks: weaponReloadDuration(source.weapon, source.ammo) || undefined, paused: state.phase === 'paused' || !!options.paused });
    };
    this.cameraReload = presentReload(cameraPlayer);
    const eye = this.presentEye(cameraPlayer, map, time);
    let bobY = motion.bobY;
    if (bobY < 0 && map.colliders?.length) {
      const contact = rayCoverDistance(eye, [0, -1, 0], map.colliders, -bobY, .04);
      if (contact < -bobY) bobY = -Math.max(0, contact - .005);
    }
    eye[1] += bobY;
    const sameCameraLife = death => cameraPlayer.alive === false && death?.targetId === cameraPlayer.id
      && death.lifeId === (cameraPlayer.lifeId || 0) && death.deaths === cameraPlayer.deaths;
    const localDeath = this.humanDeaths.find(sameCameraLife);
    // The corpse has a short lifetime; hold the settled camera until a real
    // respawn/view change so the end card never arrives after an upright snap.
    this.deathCameraActor = localDeath || (sameCameraLife(this.deathCameraActor) ? this.deathCameraActor : null);
    this.deathCamera = this.deathCameraActor ? humanDeathCameraPose({ ...this.deathCameraActor,
      ageMs: Math.max(this.deathCameraActor.ageMs, this.presentHumanDeaths.getStats().clockMs - this.deathCameraActor.born) }, { reducedMotion }) : null;
    let roll = motion.roll;
    if (this.deathCamera) {
      const lower = Math.min(this.deathCamera.lower, Math.max(0, rayCoverDistance(eye, [0, -1, 0], map.colliders || [], this.deathCamera.lower + .05, .04) - .05));
      eye[1] -= lower; roll += this.deathCamera.roll; pitch = clamp(pitch + this.deathCamera.pitch, -1.48, 1.48);
      this.deathCamera = { ...this.deathCamera, lower };
    }
    this.firstPersonMotion = { ...motion, roll, bobY, eye: [...eye], yaw, pitch };
    this.shotMotion = gunHeld(cameraPlayer) ? this.presentShots.sample(cameraPlayer.weapon, time, aim) : weaponShotPose(cameraPlayer.weapon, Infinity, 0);
    this.cameraEyeHeight = eye[1] - finite(cameraPlayer.y);
    const gl = this.gl;
    this._frameDrawCalls = 0; this._frameDynamicVertices = 0;
    const fov = clamp(finite(options.fov, 70), 55, 95) * lerp(1, zoom, aim) * Math.PI / 180;
    const projection = perspective(fov, this.aspect || 16 / 9, .025, 110), view = viewMatrix(eye, yaw, pitch, roll);
    const sky = rgba(map.skyColor || (map.id === 'canal' ? '#a3bdc2' : map.id === 'depot' ? '#8da6b0' : '#a8bcb9'));
    const atmosphere = ATMOSPHERE[map.theme || map.id] || ATMOSPHERE.courtyard;
    gl.clearColor(...sky); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
    gl.useProgram(this.skyProgram); gl.bindBuffer(gl.ARRAY_BUFFER, this.skyBuffer);
    gl.enableVertexAttribArray(this.skyAttributes.position); gl.vertexAttribPointer(this.skyAttributes.position, 2, gl.FLOAT, false, 8, 0);
    gl.uniform3fv(this.skyUniforms.top, rgba(atmosphere.top).slice(0, 3));
    gl.uniform3fv(this.skyUniforms.horizon, rgba(atmosphere.horizon).slice(0, 3));
    gl.uniform3fv(this.skyUniforms.suncolor, rgba(atmosphere.sunColor).slice(0, 3));
    gl.uniform3fv(this.skyUniforms.sundirection, atmosphere.sun);
    const sy = Math.sin(yaw), cy = Math.cos(yaw), sp = Math.sin(pitch), cp = Math.cos(pitch), tangent = Math.tan(fov / 2);
    gl.uniform3fv(this.skyUniforms.right, rotate([1, 0, 0], yaw, pitch, roll)); gl.uniform3fv(this.skyUniforms.up, rotate([0, 1, 0], yaw, pitch, roll)); gl.uniform3fv(this.skyUniforms.forward, [sy * cp, sp, -cy * cp]);
    gl.uniform2fv(this.skyUniforms.scale, [tangent * this.aspect, tangent]); gl.drawArrays(gl.TRIANGLES, 0, 3); this._frameDrawCalls++;
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(this.uniforms.projection, false, projection); gl.uniformMatrix4fv(this.uniforms.view, false, view);
    gl.uniform3fv(this.uniforms.eye, eye); gl.uniform3fv(this.uniforms.fog, sky.slice(0, 3)); gl.uniform1f(this.uniforms.fogstrength, 1);
    const storm = freeForAll && state.storm?.active && [state.storm.x, state.storm.z, state.storm.radius].every(Number.isFinite) && state.storm.radius >= 0 ? state.storm : null;
    gl.uniform3fv(this.uniforms.stormcircle, storm ? [storm.x, storm.z, Math.min(storm.radius, 256)] : [0, 0, 256]);
    gl.uniform1f(this.uniforms.stormstrength, storm ? 1 : 0);
    gl.uniform3fv(this.uniforms.lightdirection, atmosphere.sun); gl.uniform3fv(this.uniforms.sun, atmosphere.direct); gl.uniform3fv(this.uniforms.ambient, atmosphere.ambient);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.BLEND); gl.enable(gl.CULL_FACE);
    const cached = this._getMap(map);
    this._mapVertices = cached.opaque.count + cached.shadows.count;
    this._draw(cached.opaque);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    this._draw(cached.shadows); gl.depthMask(true); gl.disable(gl.BLEND);
    const dynamic = this.frameMeshes.world.reset(), contacts = this.frameMeshes.contact.reset(), local = players.find(player => player.id === localId) || cameraPlayer;
    const humanContext = `${state.gameId || 'voxel-breach'}:${map.id}:${state.matchId ?? ''}:${state.round ?? ''}`;
    this.humanPoses.clear();
    this.presentHumans.retain(players.filter(player => !player.monsterType).map(player => player.id));
    this.presentMonsters.retain(horde ? players.filter(player => Object.hasOwn(MONSTER_ART, player.monsterType) && player.alive).map(player => player.id) : []);
    for (const player of players) {
      if (!Number.isFinite(player.x) || !Number.isFinite(player.z)) continue;
      const reloadAnimation = player.id === cameraPlayer.id ? this.cameraReload : presentReload(player);
      const gaitAnimation = !player.monsterType ? this.presentHumans(player, time, humanContext, { paused: state.phase === 'paused' || !!options.paused }) : null;
      const humanAnimation = gaitAnimation ? { ...gaitAnimation, reload: reloadAnimation } : null;
      if (humanAnimation) this.humanPoses.set(player.id, { animation: humanAnimation, joints: operativePose(player, humanAnimation) });
      if (!player.alive) {
        if (horde && player.human && player.connected && player.participating && player.revivesThisWave < 1 && ['fight', 'paused'].includes(state.phase)) fallenSurvivorKit(dynamic, contacts, player, yaw);
        continue;
      }
      if (player.id === cameraPlayer.id) continue;
      if (horde && player.monsterType) monsterMesh(dynamic, player, map, time, this.presentMonsters(player, time, humanContext, { paused: state.phase === 'paused' || !!options.paused }), reloadAnimation);
      else playerMesh(dynamic, player, map, time, !freeForAll && player.team === local.team, freeForAll, humanAnimation, reloadAnimation);
      const support = surfaceBelow(map.colliders, player.x, player.z, finite(player.y) + .045);
      const ground = support ? support.y + support.h : 0;
      const altitude = Math.max(0, finite(player.y) - ground), spread = .26 + Math.min(.22, altitude * .08), opacity = .15 / (1 + altitude);
      for (let layer = 2; layer >= 0; layer--) {
        const size = spread + layer * .055;
        const minX = Math.max(player.x - size, support?.x ?? -Infinity), maxX = Math.min(player.x + size, support ? support.x + support.w : Infinity);
        const minZ = Math.max(player.z - size * .8, support?.z ?? -Infinity), maxZ = Math.min(player.z + size * .8, support ? support.z + support.d : Infinity);
        contacts.floor(minX, minZ, maxX - minX, maxZ - minZ, [.035, .055, .08, opacity], ground + .012 + (2 - layer) * .0003);
      }
    }
    this._worldLabels = presentWorldLabels({ state: { ...state, map }, players, roster: options.roster, localId, cameraPlayer, eye, view, projection, humanPoses: this.humanPoses });
    dynamic.append(this.presentMonsterDeathMeshes(this.monsterDeaths, map));
    dynamic.append(this.presentHumanDeathMeshes(this.humanDeaths.filter(death => death.targetId !== cameraPlayer.id), map, { reducedMotion, freeForAll }));
    this._lootItems = 0; this._stormVertices = 0; this._spawnWarnings = 0;
    const loot = this.presentLoot(state.loot || [], time);
    dynamic.append(loot.opaque); contacts.append(loot.contacts);
    this._lootItems = loot.count;
    if (freeForAll) {
      const boundary = stormMesh(storm); contacts.append(boundary); this._stormVertices = boundary.length / VERTEX_STRIDE;
    } else if (horde) {
      const warnings = this.presentWarnings(state.spawnWarnings || [], time);
      contacts.append(warnings.contacts); this._spawnWarnings = warnings.count;
    }
    this._bomb(dynamic, state, players.filter(player => player.id !== cameraPlayer.id), time);
    this._grenades(dynamic, contacts, state, map, time);
    this._bolts(dynamic, state);
    this._monsterSpecials = monsterSpecialParts(dynamic, contacts, state, map, { reducedMotion });
    this._reducedMotion = reducedMotion;
    this._visibleBloodParticles = 0;
    for (const particle of this.particles) {
      // A head contact sits directly against its victim's eye. Rendering the
      // victim's own cubes here fills the crosshair with a near-plane square;
      // incoming damage already has a restrained screen-edge cue. Use the
      // watched player, rather than localId, so spectators keep the same view.
      if (particle.targetId != null && particle.targetId === cameraPlayer.id) continue;
      const { point, size, fade } = particlePosition(particle, time, map.colliders);
      if (particle.material === 'monster-special' && Math.hypot(...point.map((value, axis) => value - eye[axis])) < .22) continue;
      dynamic.box(point[0] - size / 2, point[1] - size / 2, point[2] - size / 2, size, size, size, shade(rgba(particle.color), .7 + fade * .3));
      if (particle.material === 'blood') this._visibleBloodParticles++;
    }
    this._draw(this._dynamic(dynamic.array));
    if (contacts.length) {
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
      this._draw(this._dynamic(contacts.array, 'contact')); gl.depthMask(true); gl.disable(gl.BLEND);
    }
    const traces = this.frameMeshes.tracer.reset();
    this._meleeTrailVertices = 0; this._meleeTrailActors = 0;
    for (const player of players) {
      if (this._meleeTrailActors >= MAX_MELEE_TRAILS) break;
      const actor = player.id === cameraPlayer.id ? cameraPlayer : player;
      const count = meleeTrailParts(traces, actor, map.colliders || [], eye, { reducedMotion });
      this._meleeTrailVertices += count; if (count) this._meleeTrailActors++;
    }
    if (this.tracers.length || traces.length) {
      for (const trace of this.tracers) {
        // Start local tracers just beyond the eye to avoid a giant full-screen
        // quad when a shot originates inside the camera's near plane.
        const delta = trace.end.map((value, i) => value - trace.origin[i]), length = Math.hypot(...delta) || 1;
        const start = trace.local ? trace.origin.map((value, i) => value + delta[i] / length * Math.min(.35, length * .2)) : trace.origin;
        const fade = 1 - clamp((time - trace.born) / finite(trace.life, 68), 0, 1);
        traces.line(start, trace.end, finite(trace.width, .009), rgba(trace.color || '#f5ce83', .42 * fade), eye);
      }
      gl.disable(gl.CULL_FACE); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE); gl.depthMask(false);
      this._draw(this._dynamic(traces.array, 'tracer'));
      gl.depthMask(true); gl.disable(gl.BLEND); gl.enable(gl.CULL_FACE);
    }
    const scoped = gunHeld(cameraPlayer) && WEAPONS[cameraPlayer.weapon]?.scoped && aim >= smooth(14 / ADS.ticks);
    if (cameraPlayer.alive && cameraPlayer.id === localId && !options.hideWeapon && !scoped) {
      // Independent depth for the hands prevents flickering against a near
      // wall. World cover and hit detection continue using the real camera.
      gl.clear(gl.DEPTH_BUFFER_BIT); gl.uniformMatrix4fv(this.uniforms.view, false, IDENTITY);
      gl.uniform3fv(this.uniforms.eye, [0, 0, 0]); gl.uniform1f(this.uniforms.fogstrength, 0);
      gl.uniform1f(this.uniforms.stormstrength, 0);
      // The hands use a stable soft key light so turning into map shade cannot
      // hide the weapon's sights or the magazine during a reload.
      gl.uniform3fv(this.uniforms.lightdirection, [-.30, .70, .62]); gl.uniform3fv(this.uniforms.sun, [.43, .43, .40]); gl.uniform3fv(this.uniforms.ambient, [.64, .68, .72]);
      this._draw(this._dynamic(this._viewModel(cameraPlayer, yaw, pitch, time, freeForAll, map, eye, motion.roll), 'weapon'));
    }
    return true;
  }
  get worldLabels() { return this._worldLabels; }
  get stats() {
    const loot = this.presentLoot?.getStats(), warnings = this.presentWarnings?.getStats();
    const deathGeometry = this.presentMonsterDeathMeshes?.getStats();
    const monsterDeaths = Object.freeze({ ...this.presentMonsterDeaths?.getStats(), geometryBuilds: deathGeometry?.geometryBuilds || 0, vertices: deathGeometry?.vertices || 0, templateBytes: deathGeometry?.templateBytes || 0,
      corpses: Object.freeze((this.monsterDeaths || []).map(death => { const pose = monsterDeathPose(death, death.ageMs); return Object.freeze({ targetId: death.targetId, lifeId: death.lifeId, monsterType: death.monsterType, x: death.x, y: death.y, z: death.z, ageMs: death.ageMs, progress: pose.progress, collapse: pose.collapse, dissolve: pose.dissolve }); })) });
    const humanDeathGeometry = this.presentHumanDeathMeshes?.getStats();
    const humanDeaths = Object.freeze({ ...this.presentHumanDeaths?.getStats(), geometryBuilds: humanDeathGeometry?.geometryBuilds || 0, vertices: humanDeathGeometry?.vertices || 0, templateBytes: humanDeathGeometry?.templateBytes || 0,
      corpses: Object.freeze((this.humanDeaths || []).map(death => { const pose = humanDeathPose(death, death.ageMs, { reducedMotion: this._reducedMotion }); return Object.freeze({ targetId: death.targetId, lifeId: death.lifeId, deaths: death.deaths, x: death.x, y: death.y, z: death.z, ageMs: death.ageMs, progress: pose.progress, collapse: pose.collapse, dissolve: pose.dissolve }); })),
      camera: this.deathCamera ? Object.freeze({ ...this.deathCamera }) : null });
    const humanAnimation = Object.freeze({ cachedPlayers: this.presentHumans?.size || 0, poses: Object.freeze([...this.humanPoses].map(([id, { animation, joints }]) => Object.freeze({ id, phase: animation.phase, stride: animation.stride, speed: animation.speed, sprint: animation.sprint, forward: animation.forward, strafe: animation.strafe, crouch: animation.crouch, airborne: animation.airborne, jump: animation.jump, land: animation.land, bodyBob: animation.bodyBob, knees: Object.freeze(joints.legs.map(leg => Object.freeze([...leg.knee]))), feet: Object.freeze(joints.legs.map(leg => Object.freeze([...leg.foot]))) }))) });
    const firstPerson = this.firstPersonMotion ? Object.freeze({ ...this.firstPersonMotion, eye: Object.freeze([...this.firstPersonMotion.eye]), shot: Object.freeze({ ...this.shotMotion }), melee: this.meleePose ? Object.freeze({ ...this.meleePose }) : null, reload: this.reloadMotion ? Object.freeze({ ...this.reloadMotion, hands: Object.freeze(this.reloadMotion.hands.map(hand => Object.freeze({ ...hand }))) }) : null, ...this.presentShots.getStats() }) : null;
    return Object.freeze({ mapId: this.mapId, mapVertices: this._mapVertices, cachedMaps: this.mapCache.size, drawCalls: this._frameDrawCalls, dynamicVertices: this._frameDynamicVertices, lootItems: this._lootItems, stormVertices: this._stormVertices, spawnWarnings: this._spawnWarnings || 0, meleeTrailVertices: this._meleeTrailVertices || 0, meleeTrailActors: this._meleeTrailActors || 0, slashImpacts: Object.freeze(this.presentSlashImpacts?.getStats() || {}), monsterSpecials: Object.freeze(this._monsterSpecials || { shards: 0, runes: 0, fuses: 0, vertices: 0 }), reducedMotion: this._reducedMotion === true, cachedSpawnWarnings: warnings?.cachedItems || 0, spawnWarningBuilds: warnings?.builds || 0, bloodParticles: this.particles.filter(particle => particle.material === 'blood').length, visibleBloodParticles: this._visibleBloodParticles || 0, cachedLootItems: loot?.cachedItems || 0, lootGeometryBuilds: loot?.builds || 0, geometryBufferBytes: Object.values(this.frameMeshes || {}).reduce((bytes, mesh) => bytes + mesh.storage.byteLength, 0) + (loot?.bufferBytes || 0) + (loot?.templateBytes || 0) + (warnings?.bufferBytes || 0) + (warnings?.templateBytes || 0) + (deathGeometry?.bufferBytes || 0) + (deathGeometry?.templateBytes || 0) + (humanDeathGeometry?.bufferBytes || 0) + (humanDeathGeometry?.templateBytes || 0), cameraEyeHeight: this.cameraEyeHeight, resizeReads: this.resizeReads, humanAnimation, firstPerson, monsterDeaths, humanDeaths });
  }
  resetEffects() {
    this._worldLabels = EMPTY_WORLD_LABELS;
    this.eventIds.clear(); this.eventQueue.length = 0; this.particles.length = 0; this.tracers.length = 0;
    this.presentSlashImpacts?.reset();
    this.presentMonsterSpecialImpacts?.reset(); this._monsterSpecials = null; this._reducedMotion = false;
    this._visibleBloodParticles = 0; this._meleeTrailVertices = 0; this._meleeTrailActors = 0;
    this.localShot = null; this.localReload = null; this.shotContext = null; this.lastAim = null; this.swayX = 0; this.swayY = 0;
    this.presentLoot?.reset(); this.presentWarnings?.reset(); this.presentEye?.reset(); this.presentHumans?.reset(); this.presentMonsters?.reset(); this.presentHead?.reset(); this.presentShots?.reset(); this.presentReloads?.reset(); this.cameraReload = null; this.firstPersonMotion = null; this.shotMotion = null; this.reloadMotion = null; this.meleePose = null; this.humanPoses?.clear(); this._spawnWarnings = 0;
    this.presentMonsterDeaths?.reset(); this.presentMonsterDeathMeshes?.reset(); this.monsterDeaths = [];
    this.presentHumanDeaths?.reset(); this.presentHumanDeathMeshes?.reset(); this.humanDeaths = []; this.deathCamera = null; this.deathCameraActor = null;
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true; this.available = false; this._worldLabels = EMPTY_WORLD_LABELS;
    this.canvas.removeEventListener('webglcontextlost', this._onLost);
    this.canvas.removeEventListener('webglcontextrestored', this._onRestored);
    this.resizeObserver?.disconnect();
    if (typeof window !== 'undefined') window.removeEventListener('resize', this._onResize);
    if (typeof document !== 'undefined') document.removeEventListener('fullscreenchange', this._onResize);
    const gl = this.gl;
    if (!this.contextLost) {
      for (const cached of this.mapCache.values()) { gl.deleteBuffer(cached.opaque.buffer); gl.deleteBuffer(cached.shadows.buffer); }
      if (this.dynamicBuffer) gl.deleteBuffer(this.dynamicBuffer);
      if (this.weaponBuffer) gl.deleteBuffer(this.weaponBuffer);
      if (this.contactBuffer) gl.deleteBuffer(this.contactBuffer);
      if (this.tracerBuffer) gl.deleteBuffer(this.tracerBuffer);
      if (this.skyBuffer) gl.deleteBuffer(this.skyBuffer);
      if (this.program) gl.deleteProgram(this.program);
      if (this.skyProgram) gl.deleteProgram(this.skyProgram);
    }
    this.mapCache.clear(); this.resetEffects(); this.frameMeshes = null;
  }
}
