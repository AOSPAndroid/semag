import test from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../public/solo/ember-engine.js';
import { EmberVoxelCamera, EMBER_CAMERA, cameraForward, cameraRight, groundAimDirection, projectWorld, segmentBoxFraction } from '../public/solo/ember-voxel-camera.js';

const close = (a, b, epsilon = 1e-5) => assert.ok(Math.abs(a - b) < epsilon, `${a} differs from ${b}`);

test('camera axes match camera-relative dungeon movement and real perspective ground picking', () => {
  const state = createState({ seed: 143, difficulty: 'veteran' }); state.player.x = 480;
  for (const yaw of [0, Math.PI / 2, Math.PI, -.65]) {
    const f = cameraForward(yaw), r = cameraRight(yaw); close(f.x * r.x + f.y * r.y, 0); close(Math.hypot(f.x, f.y), 1);
    const camera = new EmberVoxelCamera().update(state, { yaw, pitch: .42 });
    const target = [state.player.x / 32 + f.x * 4 + r.x * .6, .84, state.player.y / 32 + f.y * 4 + r.y * .6];
    const projected = projectWorld(target, camera, 16 / 9); assert.ok(projected);
    const actual = groundAimDirection(projected.x, projected.y, state.player, camera, 16 / 9, .84);
    const dx = target[0] - state.player.x / 32, dz = target[2] - state.player.y / 32, length = Math.hypot(dx, dz);
    close(actual.x, dx / length); close(actual.y, dz / length);
  }
});

test('over-shoulder camera stays inside walls and clips its boom before actual pillar faces', () => {
  const state = createState({ seed: 29 });
  const points = [[105, 320], [56, 70], [904, 576], [374, 272], [380, 325], [579, 320], [590, 425]];
  for (const [x, y] of points) for (const pitch of [.12, .32, .8]) for (let index = 0; index < 32; index++) {
    state.player.x = x; state.player.y = y;
    // Skip fixture positions embedded in an engine collider.
    if (state.room.obstacles.some(o => x > o.x - 7 && x < o.x + o.width + 7 && y > o.y - 7 && y < o.y + o.height + 7)) continue;
    const pose = new EmberVoxelCamera().update(state, { yaw: index * Math.PI / 16, pitch });
    assert.ok(pose.eye.every(Number.isFinite));
    assert.ok(pose.eye[0] >= 42 / 32 + .19 && pose.eye[0] <= 918 / 32 - .19);
    assert.ok(pose.eye[2] >= 42 / 32 + .19 && pose.eye[2] <= 598 / 32 - .19);
    assert.ok(pose.eye[1] >= .2);
    const anchor = [x / 32, EMBER_CAMERA.targetHeight, y / 32];
    for (const o of state.room.obstacles) {
      const hit = segmentBoxFraction(anchor, pose.eye, { min: [o.x / 32 - .19, -.19, o.y / 32 - .19], max: [(o.x + o.width) / 32 + .19, 2.84, (o.y + o.height) / 32 + .19] });
      assert.equal(hit, null, 'camera boom must remain on player side of a pillar');
    }
  }
});

test('camera follows without refresh-dependent drift and freezes through pause/decision frames', () => {
  const state = createState({ seed: 51 }); state.player.x = 480;
  const c60 = new EmberVoxelCamera(), c144 = new EmberVoxelCamera();
  c60.update(state); c144.update(state);
  state.player.x += 32;
  for (let tick = 1; tick <= 60; tick++) c60.update(state, { time: tick / 60 });
  for (let tick = 1; tick <= 144; tick++) c144.update(state, { time: tick / 144 });
  for (let i = 0; i < 3; i++) close(c60.pose.eye[i], c144.pose.eye[i]);
  state.phase = 'paused'; state.elapsed = 1;
  const paused = JSON.stringify(c60.pose);
  c60.update(state, { yaw: 6, pitch: .9, time: 300 });
  assert.equal(JSON.stringify(c60.pose), paused);
  state.phase = 'route'; c60.update(state, { time: 900 }); assert.equal(JSON.stringify(c60.pose), paused);
  state.phase = 'playing'; state.room.id = '2-1-combat'; state.player.x = 105; state.elapsed = 0;
  const reset = c60.update(state, { yaw: Math.PI / 2, time: 0 }); assert.ok(reset.eye[0] < 4);
});

test('camera screen-centre aim compensates shoulder offset at the actual bolt height', () => {
  const state = createState({ seed: 8 }); state.player.x = 480; state.room.obstacles = [];
  const pose = new EmberVoxelCamera().update(state, { yaw: Math.PI / 2, pitch: .32 });
  const aim = groundAimDirection(0, 0, state.player, pose, 16 / 9, .84);
  assert.ok(aim.x > .98); assert.ok(Math.abs(aim.y) > .01, 'shoulder offset needs a small correction');
  const forward = pose.target.map((v, i) => v - pose.eye[i]), t = (.84 - pose.eye[1]) / forward[1];
  const hit = pose.eye.map((v, i) => v + forward[i] * t);
  const distance = Math.hypot(hit[0] - state.player.x / 32, hit[2] - state.player.y / 32);
  const projected = projectWorld([state.player.x / 32 + aim.x * distance, .84, state.player.y / 32 + aim.y * distance], pose, 16 / 9);
  close(projected.x, 0); close(projected.y, 0);
});
