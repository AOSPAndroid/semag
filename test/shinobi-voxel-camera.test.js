import test from 'node:test';
import assert from 'node:assert/strict';
import { SHINOBI_CAMERA, createShinobiCameraPresenter, shinobiCrosshairAim, shinobiSegmentBoxFraction, clampShinobiCameraBoom } from '../public/shinobi-voxel-camera.js';
import { meleeSlashOrigin } from '../public/voxel-melee.js';

const close = (a, b, epsilon = 1e-6) => assert.ok(Math.abs(a - b) < epsilon, `${a} differs from ${b}`);
const state = (colliders = []) => ({ gameId: 'shinobi-voxel', phase: 'fight', matchId: 'test', round: 1, map: { id: 'arena', theme: 'dojo', bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 }, colliders }, players: [{ id: 0, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, alive: true, slot: 'sword', meleeWeapon: 'katana', lifeId: 1, deaths: 0 }] });

test('camera boom clips real walls, roof undersides and elevated platforms in 3D', () => {
  const fixtures = [
    [{ x: -4, y: 0, z: 2, w: 8, h: 4, d: .4 }, [0, 1.62, 0], [0, 2, 4]],
    [{ x: -4, y: 2.1, z: -4, w: 8, h: .35, d: 8 }, [0, 1.62, 0], [0, 3, 4]],
    [{ x: -4, y: 3.0, z: 2, w: 8, h: .4, d: 3 }, [0, 4.62, 0], [0, 2.7, 4]],
  ];
  for (const [box, anchor, wanted] of fixtures) {
    const safe = clampShinobiCameraBoom(anchor, wanted, { colliders: [box] });
    assert.equal(shinobiSegmentBoxFraction(anchor, safe, box, SHINOBI_CAMERA.radius), null);
    assert.ok(Math.hypot(...safe.map((n, axis) => n - anchor[axis])) < Math.hypot(...wanted.map((n, axis) => n - anchor[axis])));
  }
});

test('orbit turns immediately and all camera positions stay on player side of cover', () => {
  const wall = { x: -8, y: 0, z: 1.4, w: 16, h: 5, d: .3 };
  const input = state([wall]), present = createShinobiCameraPresenter();
  const pose = present(input, { localId: 0, yaw: 0, pitch: -.13, time: 0 });
  assert.ok(pose.collisionDistance < 2); assert.ok(pose.eye[2] < wall.z - SHINOBI_CAMERA.radius);
  const turned = present(input, { localId: 0, yaw: Math.PI, pitch: -.13, time: 1000 / 144 });
  close(turned.yaw, Math.PI); assert.ok(turned.eye[2] < 0, 'orbit has no delayed angular chasing');
  assert.ok(turned.distance > pose.distance && turned.distance < turned.collisionDistance, 'outward boom settles smoothly');
});

test('shoulder crosshair points at the same world contact as the actual chest attack ray', () => {
  const input = state(), player = input.players[0];
  const camera = { eye: [.64, 2.25, 3.65], yaw: 0, pitch: -.13 };
  const aim = shinobiCrosshairAim(camera, player, input.map), origin = meleeSlashOrigin(player);
  assert.ok(Math.abs(aim.yaw) > .01, 'shoulder parallax needs actual correction');
  const direction = [Math.sin(aim.yaw) * Math.cos(aim.pitch), Math.sin(aim.pitch), -Math.cos(aim.yaw) * Math.cos(aim.pitch)];
  const from = [origin.x, origin.y, origin.z], length = Math.hypot(...aim.target.map((n, axis) => n - from[axis]));
  for (let axis = 0; axis < 3; axis++) close(from[axis] + direction[axis] * length, aim.target[axis]);
  assert.equal(aim.blocked, false);
});

test('a visible enemy above low cover does not turn into a chest shot through the wall', () => {
  const input = state([{ x: -.5, y: 0, z: -1.4, w: 1, h: 1.45, d: .3 }]);
  input.players.push({ id: 1, x: 0, y: 0, z: -5, alive: true });
  const camera = { eye: [0, 2.15, 2.8], yaw: 0, pitch: -.05 };
  const aim = shinobiCrosshairAim(camera, input.players[0], input.map, input.players);
  assert.equal(aim.targetId, 1); assert.equal(aim.blocked, true); assert.ok(aim.coverDistance > 0 && aim.coverDistance < 2);
});

test('stance and outward boom settle consistently at 60 and 144 Hz; long pause is frozen', () => {
  const input = state(), a = createShinobiCameraPresenter(), b = createShinobiCameraPresenter();
  a(input, { localId: 0, pitch: -.13, time: 0 }); b(input, { localId: 0, pitch: -.13, time: 0 });
  input.players[0].crouching = true;
  for (let step = 1; step <= 60; step++) a(input, { localId: 0, pitch: -.13, time: step * 1000 / 60 });
  for (let step = 1; step <= 144; step++) b(input, { localId: 0, pitch: -.13, time: step * 1000 / 144 });
  close(a.inspect().crouchAmount, b.inspect().crouchAmount);
  a.inspect().eye.forEach((n, axis) => close(n, b.inspect().eye[axis]));
  input.phase = 'paused'; const frozen = a.inspect();
  assert.equal(a(input, { localId: 0, pitch: .4, yaw: 2, time: 99999 }), frozen);
  input.phase = 'fight'; input.round++;
  const restarted = a(input, { localId: 0, yaw: 2, pitch: -.13, time: 100001 });
  assert.notEqual(restarted, frozen); close(restarted.yaw, 2);
});

test('bounds, floor, close collision and malformed collider inputs stay finite', () => {
  const input = state(), present = createShinobiCameraPresenter();
  input.players[0].x = 19.5;
  for (const yaw of [0, 1, 2, 3, 4, 5]) for (const pitch of [-.92, .7]) {
    const camera = present(input, { localId: 0, yaw, pitch, time: yaw * 1000 });
    assert.ok(camera.eye.every(Number.isFinite)); assert.ok(camera.eye[0] <= 20 - SHINOBI_CAMERA.radius + 1e-6); assert.ok(camera.eye[1] >= SHINOBI_CAMERA.radius);
  }
  assert.equal(shinobiSegmentBoxFraction([0, 1, 0], [0, 1, 2], { x: NaN }), null);
  input.map.colliders = [{ x: -.5, y: 0, z: .2, w: 1, h: 4, d: .3 }]; input.players[0].x = 0;
  const compressed = present(input, { localId: 0, yaw: 0, pitch: -.13, time: 7000 });
  assert.equal(compressed.nearBody, true); assert.ok(Number.isFinite(compressed.aim.pitch));
});
