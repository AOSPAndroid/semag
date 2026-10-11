import assert from 'node:assert/strict';
import test from 'node:test';
import { TICK_RATE, WEAPONS, createCombatPlayer, combatStep, emptyInput } from '../public/voxel-engine.js';
import { RECOIL, recoilKick, sprayPath, weaponRecoilPattern } from '../public/voxel-recoil.js';
import { summarizeSpray } from '../public/voxel-spray-trainer.js';
import { combatPresentation } from '../public/voxel-presentation.js';

const arena = { id: 'pattern-range', bounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 }, colliders: [], sites: [] };
const fixture = weapon => {
  const players = [createCombatPlayer(0, 1, weapon)];
  return { gameId: 'pattern-fixture', phase: 'fight', tick: 0, map: arena, mapId: arena.id, players, fighters: players, grenades: [], grenadeId: 0, bolts: [], boltId: 0, events: [], eventId: 0, loot: [], lootId: 0 };
};
const step = (state, controls = {}) => { state.tick++; combatStep(state, [{ ...emptyInput(state.players[0]), ...controls }], arena); };
const shots = state => state.events.filter(event => event.type === 'shot' && event.pellet === 0);
const angles = event => ({ yaw: Math.atan2(event.dx, -event.dz), pitch: Math.atan2(event.dy, Math.hypot(event.dx, event.dz)) });
const spray = (weapon, rounds, { counter = false } = {}) => {
  const state = fixture(weapon), player = state.players[0];
  for (let limit = 0; player.shots < rounds && limit < 2000; limit++) {
    // A perfect counter pulls the mouse against the accumulated kick.
    const aim = counter ? { yaw: -player.recoilYaw, pitch: -player.recoil } : { yaw: 0, pitch: 0 };
    step(state, { fire: true, ...aim });
  }
  assert.equal(player.shots, rounds);
  return { state, player, rays: shots(state).map(angles) };
};

test('every gun has a named pattern and rifles sweep both ways after their opening climb', () => {
  for (const id of Object.keys(WEAPONS)) assert.ok(['rifle', 'smg', 'lmg', 'burst', 'single'].includes(weaponRecoilPattern(WEAPONS[id]).template), id);
  const path = sprayPath(WEAPONS.vandal, 25);
  assert.equal(path[0].pitch, 0); assert.equal(path[0].yaw, 0);
  assert.ok(path[5].pitch > path[1].pitch * 3, 'opening rounds climb straight up');
  assert.ok(Math.abs(path[5].yaw) < .01, 'the opening climb is almost vertical');
  const yaws = path.map(point => point.yaw);
  assert.ok(Math.max(...yaws) > .03 && yaws.slice(12).some(yaw => yaw < Math.max(...yaws) - .03), 'the sweep reverses');
  for (const point of path) { assert.ok(point.pitch <= RECOIL.pitchCap + 1e-9); assert.ok(Math.abs(point.yaw) <= RECOIL.yawCap + 1e-9); }
});

test('similar rifles open their sweep in opposite directions', () => {
  assert.ok(recoilKick(WEAPONS.vandal, 8).yaw > 0, 'Vandal sweeps right first');
  assert.ok(recoilKick(WEAPONS.phantom, 8).yaw < 0, 'Phantom sweeps left first');
});

test('the same uncorrected spray follows the same path every time', () => {
  const a = spray('phantom', 18), b = spray('phantom', 18);
  assert.deepEqual(a.rays, b.rays);
  const offsets = a.rays.map(ray => ({ yaw: ray.yaw - a.rays[0].yaw, pitch: ray.pitch - a.rays[0].pitch }));
  assert.ok(offsets.at(-1).pitch > .05, 'an untouched spray climbs');
  assert.ok(Math.min(...offsets.map(offset => offset.yaw)) < -.015, 'and drifts left');
});

test('pulling against the pattern keeps a long spray tight; ignoring it does not', () => {
  for (const weapon of ['vandal', 'phantom', 'spectre', 'odin']) {
    const loose = spray(weapon, 20), tight = spray(weapon, 20, { counter: true });
    const drift = rays => rays.reduce((total, ray) => total + Math.hypot(ray.yaw - rays[0].yaw, ray.pitch - rays[0].pitch), 0) / rays.length;
    assert.ok(drift(tight.rays) < drift(loose.rays) * .6, `${weapon}: countered ${drift(tight.rays)} vs loose ${drift(loose.rays)}`);  }
});

test('a held trigger keeps its climb; a pause rewinds the spray to its opening round', () => {
  const { state, player } = spray('vandal', 10);
  const climbed = player.recoil;
  assert.ok(player.sprayShots === 10);
  for (let tick = 0; tick < TICK_RATE * 4; tick++) step(state);
  assert.equal(player.sprayShots, 0);
  assert.equal(player.recoil, 0); assert.equal(player.recoilYaw, 0);
  assert.ok(climbed > .1);
});

test('short bursts stay on the straight opening climb', () => {
  const state = fixture('vandal'), player = state.players[0];
  for (let burst = 0; burst < 4; burst++) {
    while (player.sprayShots < 3 && player.shots < (burst + 1) * 3) step(state, { fire: true });
    for (let tick = 0; tick < 60; tick++) step(state);
    assert.ok(player.sprayShots < 3, `burst ${burst}: the pause rewinds the pattern`);
  }
  assert.equal(player.shots, 12);
});

test('presentation eases the signed sideways offset toward centre without overshoot', () => {
  const player = { alive: true, weapon: 'vandal', slot: 'primary', recoil: .05, recoilYaw: -.02 };
  const pose = combatPresentation(player, { ...player, recoilYaw: -.03, recoil: .06 }, .5, 16);
  assert.ok(pose.recoilYaw < 0 && pose.recoilYaw > -.03);
  const settled = combatPresentation({ ...player, recoilYaw: 0 }, { ...player, recoilYaw: 0 }, 1, 25);
  assert.equal(settled.recoilYaw, 0);
});

test('the dojo spray card scores a perfect counter near 100% and an untouched spray near 0%', () => {
  const toEvents = rays => rays.map((ray, index) => ({ type: 'shot', playerId: 0, pellet: 0, tick: index * 10, dx: Math.sin(ray.yaw) * Math.cos(ray.pitch), dy: Math.sin(ray.pitch), dz: -Math.cos(ray.yaw) * Math.cos(ray.pitch) }));
  const natural = sprayPath(WEAPONS.vandal, 15);
  assert.ok(summarizeSpray(toEvents(natural), 'vandal').control <= 5);
  assert.equal(summarizeSpray(toEvents(natural.map(() => ({ yaw: 0, pitch: 0 }))), 'vandal').control, 100);
  assert.equal(summarizeSpray(toEvents(natural.slice(0, 2)), 'vandal'), null, 'two rounds is not a spray');
});
