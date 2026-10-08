import assert from 'node:assert/strict';
import test from 'node:test';
import { GRENADE, MAX_GRENADES, grenadeCapacity, throwGrenade, advanceGrenades, grenadeBlastHits, sweepSphereBox } from '../public/voxel-ordnance.js';

const arena = (colliders = [], size = 30) => ({ bounds: { minX: -size, maxX: size, minZ: -size, maxZ: size }, colliders });
const player = (id = 0, team = 0, fields = {}) => ({ id, team, alive: true, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, vx: 0, vy: 0, vz: 0, radius: .32, grenades: 1, ...fields });
const state = (players = [player(), player(1, 1, { z: -5 })]) => ({ tick: 10, capacity: players.length, players, grenades: [], grenadeId: 0 });
const frag = (fields = {}) => ({ id: 1, playerId: 0, team: 0, x: 0, y: .12, z: 0, vx: 0, vy: 0, vz: 0, radius: .12, fuseTicks: GRENADE.fuseTicks, bornTick: 0, bounces: 0, ...fields });
const close = (actual, expected, epsilon = 1e-6) => assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
const advance = (match, map, ticks, options = {}) => { for (let tick = 0; tick < ticks; tick++) { match.tick++; advanceGrenades(match, map, options); } };
const distanceBox = (point, box) => Math.hypot(point.x - Math.max(box.x, Math.min(box.x + box.w, point.x)), point.y - Math.max(box.y, Math.min(box.y + box.h, point.y)), point.z - Math.max(box.z, Math.min(box.z + box.d, point.z)));

test('throws use finite aim and modest loft, conserve inventory and carry independent owner identity', () => {
  const match = state(), events = [], grenade = throwGrenade(match, match.players[0], arena(), (type, data) => events.push({ type, ...data }));
  assert.equal(grenade, match.grenades[0]); assert.equal(match.players[0].grenades, 0); assert.equal(match.grenadeId, 1);
  close(grenade.x, 0); close(grenade.y, 1.62); close(grenade.z, -.42); close(grenade.vz, -11.5); close(grenade.vy, 3.1);
  assert.equal(grenade.fuseTicks, 288); assert.equal(grenade.playerId, 0); assert.equal(grenade.team, 0);
  assert.equal(events[0].type, 'grenadeThrow'); assert.equal(events[0].grenadeId, 1); assert.equal(events[0].attack, 'grenade');
  assert.equal(throwGrenade(match, match.players[0], arena()), null); assert.equal(events.length, 1);
  match.players[1].yaw = NaN; match.players[1].pitch = Infinity; match.players[1].vx = Infinity;
  const second = throwGrenade(match, match.players[1], arena()); assert.ok([second.x, second.y, second.z, second.vx, second.vy, second.vz].every(Number.isFinite));
});

test('dead owners and full capacities cannot create or consume more grenades', () => {
  const match = state(); match.players[0].alive = false; assert.equal(throwGrenade(match, match.players[0], arena()), null); assert.equal(match.players[0].grenades, 1);
  match.players[0].alive = true; match.grenades = [frag(), frag({ id: 2 })];
  assert.equal(throwGrenade(match, match.players[0], arena()), null); assert.equal(match.players[0].grenades, 1);
  const six = state(Array.from({ length: 6 }, (_, id) => player(id, id < 3 ? 0 : 1)));
  for (const member of six.players) assert.ok(throwGrenade(six, member, arena()));
  six.players[0].grenades = 1; assert.equal(throwGrenade(six, six.players[0], arena()), null); assert.equal(six.grenades.length, 6);
});

test('an explicit mode budget is capped at twenty while absent or invalid overrides preserve the original capacity', () => {
  assert.equal(MAX_GRENADES, 20); assert.equal(grenadeCapacity({ capacity: 10 }), 6);
  assert.equal(grenadeCapacity({ capacity: 2, maxGrenades: 20 }), 20);
  assert.equal(grenadeCapacity({ capacity: 2, maxGrenades: 100000 }), 20);
  assert.equal(grenadeCapacity({ capacity: 10, maxGrenades: NaN }), 6);
  assert.equal(grenadeCapacity({ capacity: 10, maxGrenades: Infinity }), 6);
  assert.equal(grenadeCapacity({ capacity: 10, maxGrenades: 0 }), 0);
  const match = state(Array.from({ length: 10 }, (_, id) => player(id, id))); match.maxGrenades = 100000;
  for (let index = 0; index < 20; index++) { match.players[0].grenades = 1; assert.ok(throwGrenade(match, match.players[0], arena())); }
  match.players[0].grenades = 1; assert.equal(throwGrenade(match, match.players[0], arena()), null); assert.equal(match.players[0].grenades, 1);
  match.grenades.push(frag({ id: 21 })); advance(match, arena(), 1); assert.equal(match.grenades.length, 20);
});

test('sphere sweeps contact faces, rounded edges and corners at their exact physical points', () => {
  const box = { id: 'crate', x: 0, y: 0, z: 0, w: 2, h: 2, d: 2 };
  const face = sweepSphereBox({ x: -1, y: 1, z: 1 }, { x: 2, y: 0, z: 0 }, box); close(face.t, .44); close(face.nx, -1);
  const edge = sweepSphereBox({ x: -1, y: -.072, z: 1 }, { x: 2, y: 0, z: 0 }, box);
  close(edge.t, (1 - .096) / 2); close(edge.nx, -.8); close(edge.ny, -.6);
  const corner = sweepSphereBox({ x: -1, y: -.06, z: -.06 }, { x: 2, y: 0, z: 0 }, box);
  close(corner.t, (1 - Math.sqrt(.12 ** 2 - .06 ** 2 * 2)) / 2); close(Math.hypot(corner.nx, corner.ny, corner.nz), 1);
  // Inside an expanded slab, but outside the true spherical edge/corner.
  assert.equal(sweepSphereBox({ x: -.11, y: -.11, z: -1 }, { x: 0, y: 0, z: 4 }, box), null);
});

test('touching contacts allow outward and tangent motion without phantom rebounds', () => {
  const box = { x: 0, y: 0, z: 0, w: 2, h: 2, d: 2 }, origin = { x: -.12, y: 1, z: 1 };
  assert.equal(sweepSphereBox(origin, { x: -1, y: 0, z: 0 }, box), null);
  assert.equal(sweepSphereBox(origin, { x: 0, y: 1, z: 0 }, box), null);
  close(sweepSphereBox(origin, { x: 1, y: 0, z: 0 }, box).t, 0);
});

test('very small rolling displacements still contact the exact sphere face', () => {
  const box = { x: 0, y: 0, z: 0, w: 2, h: 2, d: 2 };
  const contact = sweepSphereBox({ x: -.120004, y: 1, z: 1 }, { x: .00001, y: 0, z: 0 }, box);
  assert.ok(contact); close(contact.t, .4, 1e-5); close(contact.nx, -1);
});

test('point-blank release is swept from the eye and never spawns through a wall', () => {
  const wall = { id: 'wall', x: -2, y: 0, z: -.5, w: 4, h: 3, d: .15 }, map = arena([wall]), match = state();
  const grenade = throwGrenade(match, match.players[0], map);
  assert.ok(grenade.z >= -.35 + GRENADE.radius - 1e-7); assert.ok(distanceBox(grenade, wall) >= GRENADE.radius - 1e-7);
  advance(match, map, 1); assert.ok(grenade.vz > 0); assert.ok(distanceBox(grenade, wall) >= GRENADE.radius - 1e-7);
});

test('high-speed grenades sweep thin walls instead of tunnelling', () => {
  const wall = { id: 'thin', x: 0, y: 0, z: -3, w: .015, h: 5, d: 6 }, map = arena([wall]), match = state();
  const grenade = frag({ x: -2, y: 1, vx: 600 }); match.grenades.push(grenade);
  const events = []; advance(match, map, 1, { emit: (type, data) => events.push({ type, ...data }) });
  assert.ok(grenade.x < -.12); assert.ok(grenade.vx < 0); assert.ok(distanceBox(grenade, wall) >= .12 - 1e-7);
  assert.equal(events[0].type, 'grenadeBounce'); assert.equal(events[0].colliderId, 'thin');
});

test('arcs clear low cover while descending spheres land on its real top', () => {
  const crate = { id: 'crate', x: -2, y: 0, z: -3, w: 4, h: .8, d: 1 }, map = arena([crate]), match = state();
  const thrown = throwGrenade(match, match.players[0], map); advance(match, map, 40);
  assert.ok(thrown.z < -3.12, 'the airborne throw travels over the low crate'); assert.equal(thrown.bounces, 0);
  const falling = frag({ x: 0, y: 2, z: -2.5, vy: -8 }); match.grenades = [falling];
  let contact = null; advance(match, map, 18, { emit: (type, event) => { if (type === 'grenadeBounce') contact = event; } });
  assert.ok(contact); close(contact.ny, 1); close(contact.y, .92, 2e-6); assert.ok(falling.y >= .92);
});

test('resting and rolling grenades remain above the floor and friction settles them', () => {
  const match = state(), map = arena(), grenade = frag({ vx: 5, vz: 2 }); match.grenades = [grenade];
  advance(match, map, 180); assert.ok(grenade.x > 0); assert.ok(grenade.z > 0); close(grenade.y, .12, 1e-6);
  close(grenade.vx, 0); close(grenade.vz, 0); close(grenade.vy, 0); assert.equal(grenade.bounces, 0);
});

test('world boundaries bounce grenades inward and bound every point of a long trajectory', () => {
  const map = arena([], 2), match = state(), grenade = frag({ x: 1.8, y: 2, z: 1.8, vx: 60, vy: 7, vz: 60 }); match.grenades = [grenade];
  let bounces = 0;
  for (let tick = 0; tick < GRENADE.fuseTicks - 1; tick++) {
    advance(match, map, 1, { emit: type => { if (type === 'grenadeBounce') bounces++; } });
    assert.ok(Math.abs(grenade.x) <= 1.88 + 1e-7); assert.ok(Math.abs(grenade.z) <= 1.88 + 1e-7); assert.ok(grenade.y >= .12);
    assert.ok([grenade.x, grenade.y, grenade.z, grenade.vx, grenade.vy, grenade.vz].every(Number.isFinite));
  }
  assert.ok(bounces >= 2); assert.ok(bounces <= 12);
});

test('the fuse detonates once at 2.4 seconds after the thrower dies', () => {
  const match = state(), map = arena(), events = [], hits = [], grenade = throwGrenade(match, match.players[0], map);
  match.players[0].alive = false;
  advance(match, map, GRENADE.fuseTicks - 1, { emit: (type, data) => events.push({ type, ...data }), queueDamage: hit => hits.push(hit) });
  assert.equal(match.grenades.length, 1); assert.equal(grenade.fuseTicks, 1); assert.equal(events.some(event => event.type === 'grenadeExplosion'), false);
  match.players[1].x = grenade.x; match.players[1].z = grenade.z;
  advance(match, map, 1, { emit: (type, data) => events.push({ type, ...data }), queueDamage: hit => hits.push(hit) });
  assert.equal(match.grenades.length, 0); assert.equal(events.filter(event => event.type === 'grenadeExplosion').length, 1);
  assert.equal(hits.length, 1); assert.equal(hits[0].playerId, 0); assert.equal(hits[0].targetId, 1);
  advance(match, map, 300, { emit: (type, data) => events.push({ type, ...data }) });
  assert.equal(events.filter(event => event.type === 'grenadeExplosion').length, 1);
});

test('throw-tick integration preserves the full advertised fuse and begins motion on the next tick', () => {
  const match = state(), map = arena(), grenade = throwGrenade(match, match.players[0], map), position = { x: grenade.x, y: grenade.y, z: grenade.z };
  advanceGrenades(match, map); assert.equal(grenade.fuseTicks, GRENADE.fuseTicks);
  assert.deepEqual({ x: grenade.x, y: grenade.y, z: grenade.z }, position);
  advance(match, map, 1); assert.equal(grenade.fuseTicks, GRENADE.fuseTicks - 1); assert.ok(grenade.z < position.z);
});

test('blast falloff is strong at the centre, weaker at range and zero outside the radius', () => {
  const match = state([player(0, 0), player(1, 1), player(2, 1, { x: 2.75 }), player(3, 1, { x: 5.81 }), player(4, 1, { x: 5.83 })]);
  const hits = grenadeBlastHits(match, frag(), arena());
  assert.equal(hits.find(hit => hit.targetId === 1).damage, 120); assert.ok(hits.find(hit => hit.targetId === 2).damage < 80);
  assert.equal(hits.find(hit => hit.targetId === 4), undefined); assert.ok(hits.every(hit => hit.attack === 'grenade' && hit.headshot === false));
});

test('frag damage has self risk while friendly and dead players are immune', () => {
  const match = state([player(0, 0), player(1, 0), player(2, 1), player(3, 1, { alive: false })]);
  const hits = grenadeBlastHits(match, frag(), arena()); assert.deepEqual(hits.map(hit => hit.targetId), [0, 2]);
  const movedOwner = { ...frag(), team: 1 }; match.players[0].team = 1;
  assert.ok(grenadeBlastHits(match, movedOwner, arena()).some(hit => hit.targetId === 0));
});

test('solid full-height cover blocks all blast rays even at point-blank range', () => {
  const wall = { x: .3, y: 0, z: -2, w: .05, h: 3, d: 4 }, match = state([player(0, 0, { x: -10 }), player(1, 1, { x: 1 })]);
  assert.equal(grenadeBlastHits(match, frag({ y: .5 }), arena([wall])).length, 0);
  assert.equal(grenadeBlastHits(match, frag({ y: .5 }), arena()).length, 1);
});

test('low cover protects crouched bodies while an exposed standing head takes reduced damage', () => {
  const crate = { x: .3, y: 0, z: -2, w: .3, h: 1.2, d: 4 }, match = state([player(0, 0, { x: -10 }), player(1, 1, { x: 1 })]);
  const grenade = frag({ y: 1.15 }), open = grenadeBlastHits(match, grenade, arena())[0].damage;
  const covered = grenadeBlastHits(match, grenade, arena([crate])); assert.equal(covered.length, 1); assert.ok(covered[0].damage < open);
  match.players[1].crouching = true; assert.equal(grenadeBlastHits(match, grenade, arena([crate])).length, 0);
});

test('blast visibility handles a partially exposed shoulder and exact solid corners', () => {
  const wall = { x: .5, y: 0, z: -.2, w: .1, h: 3, d: .4 }, match = state([player(0, 0, { x: -10 }), player(1, 1, { x: 1, z: .22 })]);
  const open = grenadeBlastHits(match, frag({ y: 1 }), arena())[0].damage;
  const covered = grenadeBlastHits(match, frag({ y: 1 }), arena([wall])); assert.ok(covered.length); assert.ok(covered[0].damage < open);
  match.players[1].z = 0; assert.equal(grenadeBlastHits(match, frag({ y: 1 }), arena([{ ...wall, z: -1, d: 2 }])).length, 0);
});

test('deterministic replay preserves all trajectories, fuse events and damage', () => {
  const map = arena([{ id: 'wall', x: -1, y: 0, z: -7, w: 2, h: 3, d: .4 }]);
  const run = () => {
    const match = state(), events = [], frames = [], hits = [];
    match.players[0].pitch = -.2; match.players[0].vx = 2; throwGrenade(match, match.players[0], map, (type, data) => events.push({ type, ...data }));
    for (let tick = 0; tick < 300; tick++) { advance(match, map, 1, { emit: (type, data) => events.push({ type, ...data }), queueDamage: hit => hits.push(hit) }); frames.push(JSON.stringify(match.grenades)); }
    return { events, frames, hits };
  };
  assert.deepEqual(run(), run());
});

test('excess or corrupt state cannot create an unbounded fuse, active list or non-finite physics', () => {
  const match = state(), map = arena(); match.grenades = [frag({ fuseTicks: 100000 }), frag({ vx: NaN }), ...Array.from({ length: 50 }, (_, id) => frag({ id: id + 3 }))];
  advance(match, map, 1); assert.equal(match.grenades.length, 1); assert.equal(match.grenades[0].fuseTicks, GRENADE.fuseTicks - 1);
  advance(match, map, GRENADE.fuseTicks); assert.equal(match.grenades.length, 0);
});
