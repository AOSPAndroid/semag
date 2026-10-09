/** Screen annotations use the same camera and actors as the world draw. */
import { monsterTypeId } from './voxel-monster-bodies.js';

export const MAX_WORLD_LABELS = 23;
export const EMPTY_WORLD_LABELS = Object.freeze([]);
const PHASES = new Set(['fight', 'paused', 'intermission', 'roundEnd', 'matchEnd', 'buy', 'countdown']);
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const smooth = value => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); };

/** Column-major matrices are the actual uploaded world matrices, including ADS. */
export function projectWorldLabel(point, view, projection) {
  if (![point?.x, point?.y, point?.z].every(Number.isFinite) || view?.length !== 16 || projection?.length !== 16) return null;
  const x = point.x, y = point.y, z = point.z;
  const vx = view[0] * x + view[4] * y + view[8] * z + view[12];
  const vy = view[1] * x + view[5] * y + view[9] * z + view[13];
  const vz = view[2] * x + view[6] * y + view[10] * z + view[14];
  const vw = view[3] * x + view[7] * y + view[11] * z + view[15];
  const cx = projection[0] * vx + projection[4] * vy + projection[8] * vz + projection[12] * vw;
  const cy = projection[1] * vx + projection[5] * vy + projection[9] * vz + projection[13] * vw;
  const cz = projection[2] * vx + projection[6] * vy + projection[10] * vz + projection[14] * vw;
  const cw = projection[3] * vx + projection[7] * vy + projection[11] * vz + projection[15] * vw;
  if (![cx, cy, cz, cw].every(Number.isFinite) || cw <= .001 || cx < -cw || cx > cw || cy < -cw || cy > cw || cz < -cw || cz > cw) return null;
  return { x: (cx / cw + 1) / 2, y: (1 - cy / cw) / 2, depth: cz / cw };
}

function worldPoint(actor, x, y, z) {
  const yaw = finite(actor.yaw), c = Math.cos(yaw), s = Math.sin(yaw);
  return { x: actor.x + c * x - s * z, y: actor.y + y, z: actor.z + s * x + c * z };
}

/** Samples lie inside the drawn head/torso, never a taller movement envelope. */
function anatomy(actor, monster, joints) {
  if (monster && actor.monsterType === 'hound') {
    return { anchor: worldPoint(actor, 0, .96, -.26), samples: [
      worldPoint(actor, 0, .632, -.28), worldPoint(actor, -.11, .64, -.28), worldPoint(actor, .11, .64, -.28),
      worldPoint(actor, -.07, .75, -.29), worldPoint(actor, .07, .75, -.29),
      worldPoint(actor, 0, .46, .05), worldPoint(actor, -.15, .46, .05), worldPoint(actor, .15, .46, .05),
    ] };
  }
  let crown = actor.crouching && !monster ? 1.15 : 1.8;
  let headBase = crown - .32, headFront = -.1, chest = actor.crouching && !monster ? .70 : 1.1;
  if (monster && ['leaper', 'screecher'].includes(actor.monsterType)) {
    const windup = ['windup', 'lungeWindup'].includes(actor.monsterState) ? smooth(1 - clamp(finite(actor.attackTicks) / Math.max(1, finite(actor.attackDuration, 1)), 0, 1)) : 0;
    const roar = actor.monsterState === 'roar' && finite(actor.roarTicks) > 0 ? smooth(1 - clamp(finite(actor.roarTicks) / Math.max(1, finite(actor.roarDuration, 1)), 0, 1)) : 0;
    const crouch = actor.monsterType === 'leaper' ? windup * .055 + (actor.monsterState === 'leap' && finite(actor.lungeTicks) > 0 ? .035 : 0) : .018 + roar * .025;
    crown = 1.8 - crouch; headBase = 1.486; chest = 1.03 - crouch;
    headFront = actor.monsterType === 'screecher' ? -.13 : -.1;
  } else if (!monster && joints?.head && joints?.torso) {
    headBase = finite(joints.head.base, headBase); crown = headBase + .32;
    chest = finite(joints.torso.chestY, chest);
  }
  return { anchor: worldPoint(actor, 0, crown + .16, 0), samples: [
    worldPoint(actor, 0, headBase + .16, 0), worldPoint(actor, -.10, headBase + .16, headFront), worldPoint(actor, .10, headBase + .16, headFront),
    worldPoint(actor, -.10, headBase + .16, .07), worldPoint(actor, .10, headBase + .16, .07), worldPoint(actor, 0, crown - .025, 0),
    worldPoint(actor, 0, chest, 0), worldPoint(actor, -.12, chest, 0), worldPoint(actor, .12, chest, 0),
  ] };
}

function candidateCover(colliders, eye, geometry) {
  let minX = eye[0], maxX = minX, minY = eye[1], maxY = minY, minZ = eye[2], maxZ = minZ;
  for (const point of [geometry.anchor, ...geometry.samples]) {
    minX = Math.min(minX, point.x); maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y);
    minZ = Math.min(minZ, point.z); maxZ = Math.max(maxZ, point.z);
  }
  // Broad phase runs once per actor; individual flesh rays only inspect cover
  // inside their shared camera-to-body bounds. No map cache or GPU readback.
  return colliders.filter(box => box.x <= maxX && box.x + box.w >= minX && box.y <= maxY && box.y + box.h >= minY && box.z <= maxZ && box.z + box.d >= minZ);
}

function unobstructed(eye, point, colliders) {
  const delta = [point.x - eye[0], point.y - eye[1], point.z - eye[2]], distance = Math.hypot(...delta);
  if (distance <= .001) return false;
  for (const box of colliders) {
    let near = 0, far = 1;
    for (const [index, axis, size] of [[0, 'x', 'w'], [1, 'y', 'h'], [2, 'z', 'd']]) {
      if (Math.abs(delta[index]) < 1e-8) { if (eye[index] < box[axis] || eye[index] > box[axis] + box[size]) { far = -1; break; } }
      else {
        let a = (box[axis] - eye[index]) / delta[index], b = (box[axis] + box[size] - eye[index]) / delta[index];
        if (a > b) [a, b] = [b, a];
        near = Math.max(near, a); far = Math.min(far, b);
        if (near > far) break;
      }
    }
    if (near <= far && far >= 0 && near < 1 - .0001 / distance) return false;
  }
  return true;
}

/** Bounded, immutable presentation; it never alters authority, aim or physics. */
export function presentWorldLabels({ state, players = state?.players, roster = [], localId, cameraPlayer, eye, view, projection, humanPoses } = {}) {
  if (!state || !PHASES.has(state.phase) || !Array.isArray(players) || !Array.isArray(eye) || eye.length !== 3 || !eye.every(Number.isFinite)) return EMPTY_WORLD_LABELS;
  const horde = state.gameId === 'voxel-horde', breach = !state.gameId || state.gameId === 'voxel-breach';
  if (!horde && !breach) return EMPTY_WORLD_LABELS;
  const map = state.map;
  if (!Array.isArray(map?.colliders)) return EMPTY_WORLD_LABELS;
  const local = players.find(actor => actor?.id === localId), names = new Map();
  for (const person of Array.isArray(roster) ? roster.slice(0, 10) : []) {
    if (person?.connected === true && Number.isSafeInteger(person.id) && person.id >= 0 && person.id < 10) names.set(person.id, typeof person.name === 'string' ? person.name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 24) : '');
  }
  const result = [], kept = new Set();
  for (const actor of players.slice(0, MAX_WORLD_LABELS)) {
    if (!actor || !Number.isSafeInteger(actor.id) || actor.id < 0 || actor.id >= MAX_WORLD_LABELS || kept.has(actor.id) || actor.id === cameraPlayer?.id || actor.alive !== true || ![actor.x, actor.y, actor.z].every(Number.isFinite)) continue;
    const monster = horde && monsterTypeId(actor) !== null;
    const teammate = actor.bot !== true && !actor.monster && !actor.monsterType && names.has(actor.id) && local && actor.team === local.team && actor.id !== localId && (!horde || actor.human === true && actor.connected === true && actor.participating === true);
    if (!monster && !teammate || monster && (finite(actor.emergenceTicks) > 0 || actor.monsterState === 'emerging' || !Number.isFinite(actor.hp) || actor.hp <= 0 || !Number.isFinite(actor.maxHp) || actor.maxHp <= 0)) continue;
    const geometry = anatomy(actor, monster, humanPoses?.get(actor.id)?.joints), position = projectWorldLabel(geometry.anchor, view, projection);
    if (!position) continue;
    const cover = candidateCover(map.colliders, eye, geometry);
    // Checking the anchor alone would reveal a short dog behind a low wall.
    // Both the floating anchor AND real on-screen flesh must be uncovered.
    if (!unobstructed(eye, geometry.anchor, cover) || !geometry.samples.some(point => projectWorldLabel(point, view, projection) && unobstructed(eye, point, cover))) continue;
    const lifeId = Number.isSafeInteger(actor.lifeId) && actor.lifeId >= 0 ? actor.lifeId : 0;
    const base = { key: `${monster ? 'monster' : 'teammate'}:${actor.id}:${lifeId}`, id: actor.id, lifeId, kind: monster ? 'monster' : 'teammate', x: position.x, y: position.y };
    result.push(Object.freeze(monster ? { ...base, hp: clamp(actor.hp, 0, actor.maxHp), maxHp: actor.maxHp } : { ...base, name: names.get(actor.id) || `Player ${actor.id + 1}` }));
    kept.add(actor.id);
  }
  return result.length ? Object.freeze(result) : EMPTY_WORLD_LABELS;
}
