import assert from 'node:assert/strict';
import test from 'node:test';
import { GRENADE, grenadeBlastHits } from '../public/voxel-ordnance.js';

const arena = (colliders = []) => ({ bounds: { minX: -12, maxX: 12, minZ: -12, maxZ: 12 }, colliders });
const human = (id = 1, extra = {}) => ({ id, team: 1, alive: true, x: 0, y: 0, z: 0, radius: .32, crouching: false, ...extra });
const hound = (id = 1, extra = {}) => human(id, { monster: true, human: false, monsterType: 'hound', radius: .5, yaw: 0, ...extra });
const frag = (extra = {}) => ({ id: 1, playerId: 0, team: 0, x: 0, y: .12, z: 0, ...extra });
const hits = (players, grenade = frag(), map = arena()) => grenadeBlastHits({ players }, grenade, map);
const cover = { id: 'low-cover', x: -3, y: 0, z: -1, w: 6, h: .9, d: .2 };

test('low solid cover hides the entire hound instead of exposing an imaginary human head', () => {
  const grenade = frag({ z: 2.5 });
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const dog = hound(1, { z: -2.5, yaw });
    assert.ok(hits([dog], grenade)[0]?.damage > 0, 'uncovered flesh takes a real blast');
    assert.deepEqual(hits([dog], grenade, arena([cover])), [], `fully hidden hound at yaw ${yaw}`);
  }
});

test('real exposed hound anatomy takes reduced damage through partial cover', () => {
  const dog = hound(1, { z: -2.5 }), grenade = frag({ z: 2.5 });
  const open = hits([dog], grenade)[0].damage;
  const partial = hits([dog], grenade, arena([{ ...cover, h: .35 }]))[0];
  assert.ok(partial?.damage > 0 && partial.damage < open);
  assert.equal(partial.attack, 'grenade'); assert.equal(partial.headshot, false);
  assert.deepEqual(hits([{ ...dog, crouching: true }], grenade), hits([dog], grenade), 'hound stance cannot invent a taller body');
});

test('blast range stops at real hound height while standing humans keep their original height', () => {
  const grenade = frag({ y: 6.31 });
  assert.deepEqual(hits([hound()], grenade), [], 'all dog flesh lies beyond the blast radius');
  assert.ok(hits([human()], grenade)[0]?.damage > 0, 'the real standing human head is in range');
});

test('hound blast falloff follows its oriented head and torso rather than an inflated collision disc', () => {
  const grenade = frag({ y: .6, z: 5.9 });
  assert.deepEqual(hits([hound()], grenade), [], 'rear flesh lies outside the blast radius');
  const turned = hits([hound(1, { yaw: Math.PI })], grenade);
  assert.equal(turned.length, 1, 'turning the real head toward the blast exposes it at the range edge');
  assert.ok(turned[0].damage > 0 && turned[0].damage < 5);
});

test('arbitrary hound radius and height fields cannot manufacture blast targets', () => {
  const dog = hound(1, { radius: 100, height: 100, bodyHeight: 100, eyeHeight: 100, speed: 100 });
  assert.deepEqual(hits([dog], frag({ y: 6.31 })), []);
  assert.deepEqual(hits([dog], frag({ z: 2.5 }), arena([cover])), hits([hound()], frag({ z: 2.5 }), arena([cover])));
  assert.deepEqual(hits([dog]), hits([hound()]), 'trusted flesh alone controls exposure and falloff');
});

test('a human or untrusted monster label retains the original human blast silhouette', () => {
  const grenade = frag({ y: 6.31 });
  const expected = hits([human()], grenade);
  for (const extra of [{ monster: false, monsterType: 'hound' }, { monster: true, human: true, monsterType: 'hound' }, { monster: true, monsterType: ['hound'] }, { monster: true, monsterType: 'unknown' }]) {
    assert.deepEqual(hits([human(1, extra)], grenade), expected);
  }
});

test('hound blast damage preserves self risk, friendly immunity and dead-body immunity', () => {
  const players = [hound(0, { team: 0 }), hound(1, { team: 0 }), hound(2), hound(3, { alive: false })];
  const result = hits(players);
  assert.deepEqual(result.map(hit => hit.targetId), [0, 2]);
  assert.ok(result.every(hit => hit.damage > 0 && hit.damage <= GRENADE.damage));
  assert.deepEqual(hits([hound(0, { team: 1 })], frag({ team: 1 })).map(hit => hit.targetId), [0]);
});

test('human blast samples and stance retain exact original damage through low cover', () => {
  const person = human(1, { x: 1 }), grenade = frag({ y: 1.15 });
  const crate = { id: 'human-cover', x: .3, y: 0, z: -2, w: .3, h: 1.2, d: 4 };
  assert.equal(hits([person], grenade)[0].damage, 105);
  assert.equal(hits([person], grenade, arena([crate]))[0].damage, 46);
  assert.deepEqual(hits([{ ...person, crouching: true }], grenade, arena([crate])), []);
});

test('body-aware blast queries never mutate players, grenade or world geometry', () => {
  const state = { players: [hound(1, { z: -2.5, yaw: .73 }), human(2, { x: 3 })] };
  const grenade = frag({ z: 2.5 }), map = arena([{ ...cover, h: .35 }]);
  const before = JSON.stringify({ state, grenade, map });
  const first = grenadeBlastHits(state, grenade, map);
  assert.deepEqual(grenadeBlastHits(state, grenade, map), first);
  assert.equal(JSON.stringify({ state, grenade, map }), before);
});
