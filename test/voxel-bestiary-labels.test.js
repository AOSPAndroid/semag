import test from 'node:test';
import assert from 'node:assert/strict';
import * as Horde from '../public/voxel-horde-engine.js';
import { MONSTER_BODIES } from '../public/voxel-monster-bodies.js';
import { presentWorldLabels, projectWorldLabel } from '../public/voxel-label-presentation.js';

const TYPES = ['vampire', 'witch', 'wolf', 'pig', 'rat', 'stag'];
const MAP = Object.freeze({ id: 'bestiary-label-fixture', bounds: { minX: -30, maxX: 30, minZ: -30, maxZ: 30 }, colliders: [] });
const projection = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1.000455, -1, 0, 0, -.050011, 0]);
const view = eye => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -eye[0], -eye[1], -eye[2], 1]);
const wall = fields => ({ x: -5, y: 0, z: -7.25, w: 10, h: 4, d: .1, ...fields });

function fixture(type) {
  const state = Horde.createState({ capacity: 1, seed: 92342 });
  state.players[0].connected = true;
  Horde.startMatch(state, [0]);
  while (state.phase === 'countdown') Horde.step(state);
  state.map = MAP; state.horde.nextSpawnTick = 1e9; state.horde.pending = 1;
  Object.assign(state.players[0], { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 });
  state.spawnWarnings = [{ id: ++state.horde.spawnId, x: 0, y: 0, z: -8, ticksLeft: 1, monsterType: type }];
  Horde.step(state);
  const actor = state.players.find(player => player.monster && player.alive);
  assert.equal(actor?.monsterType, type);
  Object.assign(actor, { x: 0, y: 0, z: -8, yaw: 0, emergenceTicks: 0, monsterState: 'hunt' });
  const present = (eye = [0, 1.62, 0]) => presentWorldLabels({ state, localId: 0, cameraPlayer: state.players[0], eye, view: view(eye), projection });
  return { state, actor, present };
}

test('all six materialized creatures show their current authority health without mutating state', () => {
  for (const type of TYPES) {
    const f = fixture(type), before = JSON.stringify(f.state), labels = f.present();
    assert.equal(labels.length, 1, type);
    assert.equal(labels[0].hp, f.actor.hp); assert.equal(labels[0].maxHp, f.actor.maxHp);
    assert.equal(labels[0].id, f.actor.id); assert.equal(labels[0].kind, 'monster');
    assert.ok(Object.isFrozen(labels) && Object.isFrozen(labels[0]));
    assert.equal(JSON.stringify(f.state), before);
  }
});

test('each quadruped bar follows its own crown rather than a human-height anchor', () => {
  for (const type of ['wolf', 'pig', 'rat', 'stag']) {
    const f = fixture(type), body = MONSTER_BODIES[type], bar = f.present()[0];
    const expected = projectWorldLabel({ x: 0, y: body.height + .16, z: -8 - body.eyeForward }, view([0, 1.62, 0]), projection);
    assert.ok(Math.abs(bar.y - expected.y) < 1e-6, type);
  }
});

test('fully hidden animal flesh suppresses a bar even when its crown clears nearby low cover', () => {
  for (const type of ['wolf', 'pig', 'rat', 'stag']) {
    const f = fixture(type), body = MONSTER_BODIES[type], eye = [0, body.height * .6, 0];
    f.state.map = { ...MAP, colliders: [wall({ h: body.height + .025 })] };
    assert.equal(f.present(eye).length, 0, type);
    // A genuine flank exposes both the animal and its bar.
    f.actor.x = 6;
    assert.equal(f.present(eye).length, 1, type);
  }
});

test('all species respect walls, world height and changes to cover immediately', () => {
  for (const type of TYPES) {
    const f = fixture(type);
    f.state.map = { ...MAP, colliders: [wall()] };
    assert.equal(f.present().length, 0, type);
    f.actor.y = 4;
    assert.equal(f.present([0, 5.62, 0]).length, 1, type);
    f.state.map = MAP; f.actor.y = 0;
    assert.equal(f.present().length, 1, type);
  }
});

test('new species never leak dead, emerging, spoofed or malformed health records', () => {
  for (const type of TYPES) {
    const f = fixture(type);
    for (const patch of [{ alive: false }, { hp: 0 }, { emergenceTicks: 1 }, { monsterState: 'emerging' }, { human: true }, { monster: false }, { hp: NaN }, { maxHp: Infinity }]) {
      const old = { ...f.actor }; Object.assign(f.actor, patch);
      assert.equal(f.present().length, 0, `${type}: ${JSON.stringify(patch)}`);
      Object.assign(f.actor, old);
    }
  }
});
