import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { ADS, HEAL, KNIFE, MELEE, WEAPONS, createCombatPlayer, playerHeight, WORLD } from '../public/voxel-engine.js';
import { MAPS } from '../public/voxel-royale-maps.js';
import { HORDE_RULES } from '../public/voxel-horde-engine.js';
import { humanAppearance, operativeMeshes, operativePose, VoxelRenderer } from '../public/voxel-renderer.js';
import { createPlayerAnimationPresenter, playerAnimationPose } from '../public/voxel-player-animation.js';

const digest = mesh => createHash('sha256').update(new Uint8Array(mesh.buffer, mesh.byteOffset, mesh.byteLength)).digest('hex');
const actor = (patch = {}) => ({ ...createCombatPlayer(1), x: 1.25, y: 4, z: -2.5, ...patch });
const rgb = hex => [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16) / 255);
const sameColor = (a, b) => a.every((value, index) => Math.abs(value - b[index]) < .000001);
const fixtureMap = { id: 'human-qa-empty', theme: 'custom', colliders: [], sites: [], bounds: { minX: -50, maxX: 50, minZ: -50, maxZ: 50 } };

// Return the genuinely exposed front surface, including occlusion by hair,
// helmets or a visor. Counting authored face-colored vertices alone would
// incorrectly accept human features buried underneath opaque equipment.
function frontColor(mesh, x, y) {
  let nearest = Infinity, color = null;
  for (let at = 0; at < mesh.length; at += 30) {
    const ax = mesh[at], ay = mesh[at + 1], bx = mesh[at + 10], by = mesh[at + 11], cx = mesh[at + 20], cy = mesh[at + 21];
    const denominator = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(denominator) < 1e-10) continue;
    const a = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / denominator;
    const b = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / denominator, c = 1 - a - b;
    if (a < -1e-8 || b < -1e-8 || c < -1e-8) continue;
    const z = a * mesh[at + 2] + b * mesh[at + 12] + c * mesh[at + 22];
    if (z < nearest) { nearest = z; color = Array.from(mesh.slice(at + 6, at + 9)); }
  }
  return color;
}

function renderHarness() {
  const uploads = [];
  const gl = new Proxy({}, { get(_, name) {
    if (name === 'getShaderParameter' || name === 'getProgramParameter') return () => true;
    if (name === 'getAttribLocation') return () => 0;
    if (name === 'getUniformLocation') return (_program, uniform) => uniform;
    if (typeof name === 'string' && name.startsWith('create')) return () => ({});
    return () => {};
  } });
  const renderer = new VoxelRenderer({ getContext: () => gl, addEventListener() {}, removeEventListener() {}, getBoundingClientRect: () => ({ width: 960, height: 540 }) });
  const upload = renderer._dynamic;
  renderer._dynamic = function(array, kind = 'world') { uploads.push({ kind, mesh: array.slice(), buffer: array.buffer }); return upload.call(this, array, kind); };
  return { renderer, uploads };
}

function lowerVertices(mesh, player) {
  const lower = [];
  for (let at = 0; at < mesh.length; at += 10) if (mesh[at + 1] - player.y < (player.crouching ? .47 : .64)) lower.push(mesh[at] - player.x, mesh[at + 1] - player.y, mesh[at + 2] - player.z);
  return lower;
}

test('all ten player identities show genuinely exposed human facial features and retain their appearance', () => {
  const identities = new Set(), skinColors = new Set(), hairColors = new Set();
  for (let id = 0; id < 10; id++) {
    const player = actor({ id, x: 0, y: 0, z: 0, yaw: 0 }), appearance = humanAppearance(player, true), mesh = operativeMeshes(player, 0, true);
    identities.add(digest(mesh)); skinColors.add(appearance.skin); hairColors.add(appearance.hair);
    assert.deepEqual(humanAppearance(structuredClone(player), true), appearance, 'a fresh snapshot does not randomize the same person');
    assert.deepEqual(humanAppearance({ ...player, team: 7 }, true), appearance, 'free-for-all identities cannot imply an alliance');
    const skin = rgb(appearance.skin);
    let exposedSkin = 0, visiblePixels = 0;
    for (let xx = 0; xx < 32; xx++) for (let yy = 0; yy < 28; yy++) {
      const color = frontColor(mesh, -.125 + (xx + .5) * .25 / 32, 1.49 + (yy + .5) * .29 / 28);
      if (color) { visiblePixels++; if (sameColor(color, skin)) exposedSkin++; }
    }
    assert.ok(visiblePixels > 400, `${id}: a full readable head`);
    assert.ok(exposedSkin > 120, `${id}: human face is actually visible rather than hidden behind a visor (${exposedSkin})`);
    const eyeColor = rgb(appearance.eyes), eyeSides = [false, false];
    for (let xx = 0; xx < 50; xx++) for (let yy = 0; yy < 24; yy++) {
      const x = -.12 + (xx + .5) * .24 / 50, y = 1.55 + (yy + .5) * .17 / 24, color = frontColor(mesh, x, y);
      if (color && sameColor(color, eyeColor)) eyeSides[x < 0 ? 0 : 1] = true;
    }
    assert.deepEqual(eyeSides, [true, true], `${id}: both human eyes remain visible on the real front surface`);
  }
  assert.equal(identities.size, 10, 'teammates and all battle-royale seats have distinct authored identities');
  assert.ok(skinColors.size >= 4 && hairColors.size >= 4, 'human variety includes faces and hair as well as shirt colors');
});

test('animated human anatomy stays inside the existing body, head and wall collision envelopes', () => {
  for (let id = 0; id < 10; id++) for (const crouching of [false, true]) for (const grounded of [false, true]) for (const time of [0, .11, .28, .49]) for (const yaw of [0, .41, Math.PI / 4 - .001, Math.PI / 4 + .001, 1.71, -2.8]) {
    const player = actor({ id, crouching, grounded, yaw, vx: 6, vz: 4, vy: grounded ? 0 : 3 }), before = JSON.stringify(player);
    const animation = playerAnimationPose(player, time), mesh = operativeMeshes(player, time * 1000, true, animation), height = playerHeight(player);
    assert.ok(mesh.length / 10 <= 1200 && mesh.length % 30 === 0 && mesh.every(Number.isFinite));
    for (let at = 0; at < mesh.length; at += 10) {
      const x = mesh[at] - player.x, y = mesh[at + 1] - player.y, z = mesh[at + 2] - player.z, radius = y > height - .32 + 1e-6 ? .22 : .29;
      assert.ok(y >= -1e-6 && y <= height + 1e-6, `${id}/${grounded}/${crouching}: no head or foot outside actual height`);
      assert.ok(Math.hypot(x, z) <= radius + 1e-6, `${id}/${grounded}/${crouching}: no animated unhittable corner`);
      assert.ok(Math.hypot(x, z) <= WORLD.radius + 1e-6, 'walking or jumping cannot imply wall penetration');
    }
    assert.equal(JSON.stringify(player), before, 'pose and mesh construction never alter authoritative movement/combat');
  }
});

// A committed blade can extend its cosmetic grasp beyond the standing body
// cylinder. Only the articulated striking arm receives that exception; actual
// head, torso, legs, ordinary gestures and their contact envelopes stay fixed.
function distanceToSegment(point, a, b) {
  const delta = b.map((value, axis) => value - a[axis]), lengthSquared = delta.reduce((sum, value) => sum + value * value, 0);
  const progress = lengthSquared ? Math.max(0, Math.min(1, point.reduce((sum, value, axis) => sum + (value - a[axis]) * delta[axis], 0) / lengthSquared)) : 0;
  return Math.hypot(...point.map((value, axis) => value - a[axis] - delta[axis] * progress));
}

test('ordinary gestures retain body contacts while committed blade arms follow their real grasp without changing head or torso', () => {
  const actions = [
    ...[0, ADS.ticks / 2, ADS.ticks].map(aimTicks => ({ aimTicks })),
    ...[1, WEAPONS.carbine.reloadTicks / 2, WEAPONS.carbine.reloadTicks].map(reloadTicks => ({ reloadTicks })),
    ...[1, HEAL.ticks / 2, HEAL.ticks].map(healTicks => ({ healTicks, healing: true })),
    { slot: 'sword', meleeWeapon: 'sword', meleeTicks: MELEE.activeTicks + MELEE.recoveryTicks },
    { slot: 'sword', meleeWeapon: 'knife', meleeTicks: KNIFE.activeTicks + KNIFE.recoveryTicks },
    { grenadeThrowTicks: 12 }, { grenadeThrowTicks: 24 },
    { aimTicks: ADS.ticks, reloadTicks: WEAPONS.carbine.reloadTicks / 2 },
  ];
  for (const crouching of [false, true]) for (const grounded of [false, true]) for (const pitch of [-1.35, 0, 1.35]) for (const yaw of [0, .731, 1.73]) for (const time of [0, .17, .38]) for (const action of actions) {
    const committed = action.slot === 'sword';
    const player = actor({ crouching, grounded, pitch, yaw, vx: 3, vz: -4, vy: grounded ? 0 : 2, ...action, ...(committed ? { meleeYaw: yaw, meleePitch: pitch, meleePhase: 'active', meleeIndex: 1 } : {}) }), source = JSON.stringify(player);
    const animation = playerAnimationPose(player, time), mesh = operativeMeshes(player, time * 1000, false, animation), height = playerHeight(player);
    const idle = committed ? operativeMeshes({ ...player, meleeTicks: 0, meleePhase: 'idle' }, time * 1000, false, animation) : null;
    const joints = committed ? operativePose(player, animation) : null;
    const toWorld = point => [player.x + point[0] * Math.cos(yaw) - point[2] * Math.sin(yaw), player.y + point[1], player.z + point[0] * Math.sin(yaw) + point[2] * Math.cos(yaw)];
    const grasp = joints ? Object.fromEntries(['shoulder', 'elbow', 'hand'].map(key => [key, toWorld(joints.arms[1][key])])) : null;
    let movedArmVertices = 0;
    assert.ok(mesh.length / 10 <= 1200 && mesh.every(Number.isFinite));
    if (idle) assert.equal(mesh.length, idle.length, 'a cut does not add or remove physical body/head surfaces');
    for (let at = 0; at < mesh.length; at += 10) {
      const point = [mesh[at], mesh[at + 1], mesh[at + 2]];
      const changed = idle && point.some((value, axis) => Math.abs(value - idle[at + axis]) > 1e-6);
      if (changed) {
        movedArmVertices++;
        const nearest = Math.min(distanceToSegment(point, grasp.shoulder, grasp.elbow), distanceToSegment(point, grasp.elbow, grasp.hand));
        assert.ok(nearest <= .071, 'only the narrow articulated striking arm can leave the idle body envelope');
        continue;
      }
      const y = point[1] - player.y, radius = y > height - .32 + 1e-6 ? .22 : .29;
      assert.ok(y >= -1e-6 && y <= height + 1e-6, 'head, torso, legs and ordinary gestures remain inside the real player height');
      assert.ok(Math.hypot(point[0] - player.x, point[2] - player.z) <= radius + 1e-6, `crouch ${crouching}, ${JSON.stringify(action)}: unchanged anatomy preserves the actual body/head contact regions`);
    }
    if (committed) assert.ok(movedArmVertices > 0 && movedArmVertices <= 108, 'only one upper arm, forearm and grasp move; head, torso, legs and the off hand are unchanged');
    assert.equal(JSON.stringify(player), source, 'cosmetic action poses leave actual timers, aim and collision unchanged');
  }
});

const distance = (a, b) => Math.hypot(...a.map((value, index) => value - b[index]));
function jointSignature(pose) { return JSON.stringify(pose.legs.map(leg => ({ knee: leg.knee, ankle: leg.ankle, foot: leg.foot }))); }

test('walking bends actual knees, raises swing feet and settles into grounded and airborne poses', () => {
  const player = actor({ vx: 0, vz: -5, grounded: true }), present = createPlayerAnimationPresenter();
  const poses = [], source = JSON.stringify(player);
  for (let frame = 0; frame <= 90; frame++) {
    const peer = { ...player, z: player.z - frame / 120 * 5 }, animation = present(peer, frame * 1000 / 120, 'human-qa-gait');
    const pose = operativePose(peer, animation), mesh = operativeMeshes(peer, frame * 1000 / 120, false, animation);
    poses.push(pose);
    for (const leg of pose.legs) {
      assert.ok(distance(leg.hip, leg.knee) > .12 && distance(leg.knee, leg.ankle) > .12, 'upper and lower legs remain separate articulated segments');
      for (const joint of [leg.knee, leg.ankle, leg.foot]) {
        let nearest = Infinity;
        for (let at = 0; at < mesh.length; at += 10) nearest = Math.min(nearest, distance(joint, [mesh[at] - peer.x, mesh[at + 1] - peer.y, mesh[at + 2] - peer.z]));
        assert.ok(nearest < .14, 'the joint pipeline has visible limb geometry at its physical endpoints');
      }
    }
  }
  assert.ok(new Set(poses.map(jointSignature)).size > 60, 'walking is a continuous articulated cycle');
  assert.ok(poses.some(pose => pose.legs.some(leg => leg.lift > .025)), 'the swinging foot visibly leaves the ground');
  assert.ok(poses.some(pose => pose.legs.some(leg => distance(leg.hip, leg.knee) + distance(leg.knee, leg.ankle) - distance(leg.hip, leg.ankle) > .006)), 'a bent knee changes the visible thigh-to-calf angle');
  const stopped = { ...player, z: player.z - 90 / 120 * 5, vx: 0, vz: 0 };
  let idle;
  for (let frame = 91; frame <= 240; frame++) idle = operativePose(stopped, present({ ...stopped }, frame * 1000 / 120, 'human-qa-gait'));
  const laterIdle = operativePose(stopped, present({ ...stopped }, 2400, 'human-qa-gait'));
  for (let leg = 0; leg < 2; leg++) for (const joint of ['knee', 'ankle', 'foot']) assert.ok(distance(laterIdle.legs[leg][joint], idle.legs[leg][joint]) < .00001, 'an idle teammate settles instead of marching or snapping into a clock-based stride');
  const airborne = { ...stopped, grounded: false, y: player.y + 1, vx: 3, vz: -3, vy: 2 };
  const airborneAnimation = present(airborne, 2450, 'human-qa-gait'), phase = airborneAnimation.phase;
  for (let frame = 1; frame < 20; frame++) {
    const moved = { ...airborne, x: airborne.x + frame * .025, z: airborne.z - frame * .025, y: airborne.y + frame * .01 };
    const animation = present(moved, 2450 + frame * 1000 / 120, 'human-qa-gait');
    assert.equal(animation.phase, phase, 'airborne travel cannot advance the ground walking cycle');
  }
  assert.equal(JSON.stringify(player), source, 'all animation, joint and mesh previews leave the actual actor untouched');
});

test('real crouch release keeps head, neck and shoulders coherent while leg flex settles', () => {
  const present = createPlayerAnimationPresenter(), player = actor({ id: 0, x: 0, y: 0, z: 0, crouching: true }), skin = rgb(humanAppearance(player).skin);
  present(player, 0, 'human-qa-crouch');
  for (let frame = 1; frame <= 20; frame++) {
    const standing = { ...player, crouching: false }, source = JSON.stringify(standing), animation = present(standing, frame * 1000 / 120, 'human-qa-crouch');
    const joints = operativePose(standing, animation), mesh = operativeMeshes(standing, frame * 1000 / 120, false, animation);
    assert.equal(joints.head.base, WORLD.standHeight - .32, 'the standing silhouette puts its head at the real head contact region');
    assert.ok(joints.arms.every(arm => arm.shoulder[1] > 1.20), 'shoulders rise with the head instead of lingering at crouch height');
    let visibleNeck = 0;
    for (let yy = .60; yy < joints.head.base - .005; yy += .0025) {
      const color = frontColor(mesh, 0, yy);
      if (color && sameColor(color, skin)) visibleNeck += .0025;
    }
    assert.ok(visibleNeck > .05 && visibleNeck < .18, `release frame ${frame}: the actual front surface has a human neck (${visibleNeck.toFixed(3)}m), not a stretched skin column`);
    assert.ok(joints.legs.every(leg => leg.hip[1] > .72), 'hips and limbs use the same standing anatomy as the torso');
    assert.equal(JSON.stringify(standing), source, 'a visual stance transition cannot rewrite physical crouch state');
  }
});

test('actual renderer animates traveled teammates through fresh snapshots while blocked velocity stays planted', () => {
  const { renderer, uploads } = renderHarness(), camera = actor({ id: 0, team: 0, x: -10, y: 0, z: 5 }), teammate = actor({ team: 0, x: 0, y: 0, z: 0, vx: 6 });
  const draw = (player, time) => {
    uploads.length = 0;
    const state = { gameId: 'voxel', map: fixtureMap, mapId: fixtureMap.id, phase: 'fight', round: 1, matchId: 1, tick: Math.floor(time * .12), players: [structuredClone(camera), structuredClone(player)], events: [] }, source = JSON.stringify(state);
    renderer.render(state, { localId: 0, time, hideWeapon: true });
    assert.equal(JSON.stringify(state), source, 'rendering does not add gait or cosmetic fields to the received simulation');
    return lowerVertices(uploads.find(upload => upload.kind === 'world').mesh, player);
  };
  const blocked = draw(teammate, 1000);
  for (let frame = 1; frame < 30; frame++) assert.deepEqual(draw(teammate, 1000 + frame * 1000 / 120), blocked, 'held movement into solid cover must not play a treadmill walk');
  const traveling = [];
  for (let frame = 0; frame < 100; frame++) {
    const player = { ...teammate, z: -frame / 120 * 4, vz: -4, vx: 0 };
    traveling.push(draw(player, 2000 + frame * 1000 / 120));
  }
  assert.ok(new Set(traveling.map(points => JSON.stringify(points))).size > 30, 'actual world upload moves the visible legs, rather than translating a static avatar');
  const changed = traveling.slice(1).some(points => points.length === traveling[0].length && points.some((value, index) => Math.abs(value - traveling[0][index]) > .018));
  assert.ok(changed, 'knees, calves and planted/swinging boots have visible travel');
  renderer.destroy();
});

test('upgraded human skins retain full ten-player and dense monster-wave geometry budgets', () => {
  const { renderer, uploads } = renderHarness();
  const states = [
    { gameId: 'voxel-royale', map: MAPS.paris, phase: 'fight', round: 1, matchId: 1, tick: 100,
      players: Array.from({ length: 10 }, (_, id) => actor({ id, x: id * 2 - 10, y: 0, z: 9, weapon: 'lmg', vx: 3 })),
      maxGrenades: 20, grenades: Array.from({ length: 20 }, (_, id) => ({ id, x: id % 10 * 2 - 10, y: .12, z: 22 + Math.floor(id / 10) * 3, radius: .12, fuseTicks: 180 })),
      loot: Array.from({ length: 128 }, (_, id) => ({ id, kind: 'heal', x: id % 16 - 8, y: 0, z: Math.floor(id / 16) - 4 })), events: [] },
    { gameId: 'voxel-horde', map: MAPS.paris, phase: 'fight', round: 1, matchId: 2, tick: 100,
      players: Array.from({ length: 3 }, (_, id) => actor({ id, human: true, team: 0, x: id * 3 - 4, y: 0, z: 8, vx: 3 })).concat(Array.from({ length: HORDE_RULES.maxMonsters }, (_, index) => actor({ id: index + 3, monster: true, monsterType: ['stalker', 'runner', 'brute', 'gunner', 'sniper'][index % 5], team: 1, x: index % 6 * 3 - 8, y: 0, z: Math.floor(index / 6) * 4 - 8, vx: 2, vz: -1 }))),
      loot: Array.from({ length: HORDE_RULES.maxLoot }, (_, id) => ({ id, kind: id % 2 ? 'heal' : 'ammo', x: id % 5 * 2 - 4, y: 0, z: Math.floor(id / 5) * 2 - 4 })),
      spawnWarnings: Array.from({ length: HORDE_RULES.maxWarnings }, (_, id) => ({ id, x: id * 4 - 6, y: 0, z: -18, monsterType: 'stalker', ticksLeft: 90, durationTicks: 90 })), events: [] },
  ];
  for (const state of states) {
    renderer.resetEffects(); const buffers = new Map(); let bufferBytes;
    for (let frame = 0; frame < 18; frame++) {
      uploads.length = 0;
      const time = 1000 + frame * 1000 / 120, players = state.players.map(player => ({ ...player, x: player.x + frame / 120 * player.vx, z: player.z + frame / 120 * player.vz }));
      assert.equal(renderer.render({ ...state, players }, { localId: 0, time }), true);
      assert.ok(renderer.stats.dynamicVertices < (state.gameId === 'voxel-horde' ? 48000 : 72000), `${state.gameId}: all humans, monsters and pickups fit the existing gameplay budget`);
      assert.ok(renderer.stats.drawCalls <= 7, 'human detail and walking add no draw pass per player');
      if (frame > 2) {
        for (const upload of uploads) if (buffers.has(upload.kind)) assert.equal(upload.buffer, buffers.get(upload.kind), 'animated frames reuse typed geometry'); else buffers.set(upload.kind, upload.buffer);
        if (bufferBytes) assert.equal(renderer.stats.geometryBufferBytes, bufferBytes, 'no growth once maximum character/pickup art is warmed'); else bufferBytes = renderer.stats.geometryBufferBytes;
      }
    }
  }
  renderer.destroy();
});
