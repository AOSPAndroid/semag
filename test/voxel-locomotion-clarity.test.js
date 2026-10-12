import assert from 'node:assert/strict';
import test from 'node:test';
import { createCombatPlayer } from '../public/voxel-engine.js';
import { createPlayerAnimationPresenter } from '../public/voxel-player-animation.js';
import { createMonsterAnimationPresenter, operativePose } from '../public/voxel-renderer.js';
import { monsterLocomotionPose } from '../public/voxel-monster-animation.js';

function movingPoses(actor, speed, present, pose = value => value) {
  present(actor, 0, 'clarity');
  return Array.from({ length: 180 }, (_, frame) => {
    const player = { ...actor, z: actor.z - (frame + 1) * speed / 60 };
    return pose(present(player, (frame + 1) * 1000 / 60, 'clarity'), player);
  }).slice(60);
}

test('a normal walk has clearly lifted feet, bent knees and visible opposing weight shifts', () => {
  const player = { ...createCombatPlayer(1), x: 0, y: 0, z: 0 }, before = structuredClone(player);
  const poses = movingPoses(player, 2.8, createPlayerAnimationPresenter(), (a, p) => operativePose(p, a));
  const feet = poses.flatMap(p => p.legs);
  assert.ok(Math.max(...feet.map(leg => leg.lift)) > .19, 'walking raises the swing foot about 20 cm instead of 6 cm');
  assert.ok(Math.max(...feet.map(leg => leg.knee[1])) - Math.min(...feet.map(leg => leg.knee[1])) > .10, 'knees visibly articulate');
  assert.ok(Math.min(...poses.map(p => p.torso.bob)) < -.035, 'body loads its supporting leg');
  assert.ok(poses.every(p => p.legs.some(leg => leg.planted && leg.foot[1] === .018)), 'every grounded walk frame retains a supporting foot');
  assert.deepEqual(player, before);
});

test('sprinting visibly lifts higher than walking, while a crouched step stays compact', () => {
  const base = { ...createCombatPlayer(1), x: 0, y: 0, z: 0 };
  const lift = (actor, speed) => Math.max(...movingPoses(actor, speed, createPlayerAnimationPresenter(), (a, p) => operativePose(p, a)).flatMap(p => p.legs.map(leg => leg.lift)));
  assert.ok(lift({ ...base, sprinting: true }, 7.7) > .29);
  assert.ok(lift(base, 2.8) < .24);
  assert.ok(lift({ ...base, crouching: true }, 2.35) < .09);
});

test('slow zombies lift visibly and animal runs have unmistakable alternating paws', () => {
  for (const [type, speed, minimum] of [['stalker', 2.8, .19], ['runner', 5.5, .28], ['hound', 6.8, .14], ['wolf', 7, .145], ['pig', 4, .09], ['rat', 7.2, .045], ['stag', 4.4, .16]]) {
    const actor = { ...createCombatPlayer(7), monster: true, human: false, monsterType: type, monsterState: 'chase', x: 0, y: 0, z: 0 }, before = structuredClone(actor);
    const poses = movingPoses(actor, speed, createMonsterAnimationPresenter(), (a, p) => monsterLocomotionPose(p, a));
    const limbs = poses.flatMap(p => p.legs.concat(p.paws));
    assert.ok(Math.max(...limbs.map(leg => leg.lift)) > minimum, `${type}: readable foot clearance at normal movement speed`);
    assert.ok(poses.every(p => p.legs.concat(p.paws).some(leg => leg.planted)), `${type}: supporting feet remain grounded`);
    assert.deepEqual(actor, before);
  }
});
