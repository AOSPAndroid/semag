import assert from 'node:assert/strict';
import test from 'node:test';
import * as game from '../public/voxel-engine.js';
import { grenadeBlastHits, sweepSphereBox, GRENADE } from '../public/voxel-ordnance.js';

const input = (buttons = {}, player = {}) => ({ ...game.emptyInput(player), ...buttons });
const near = (actual, expected, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
const fixtureMap = colliders => ({ bounds: { minX: -30, maxX: 30, minZ: -30, maxZ: 30 }, colliders });
const player = (pose = {}) => Object.assign(game.cloneState(game.createState().players[0]), { x: 0, z: 0 }, pose);
const move = (fighter, buttons, arena, ticks = 1) => game.predictLocalMovement(fighter, input(buttons, fighter), arena, ticks);

test('a fresh jump press just before landing queues one takeoff on the next grounded tick', () => {
  const arena = fixtureMap([]), fighter = player({ y: .06, vy: -1, grounded: false });
  move(fighter, { jump: true }, arena);
  assert.ok(fighter.jumpBufferTicks > 0);
  let landed = false, tookOff = false;
  for (let tick = 0; tick < game.WORLD.jumpBufferTicks; tick++) {
    const wasGrounded = fighter.grounded;
    move(fighter, { jump: true }, arena);
    landed ||= fighter.grounded;
    if (wasGrounded && fighter.vy > 0) { tookOff = true; break; }
  }
  assert.ok(landed, 'the body physically contacts the floor before taking off');
  assert.ok(tookOff, 'the buffered press is consumed after landing');
  assert.equal(fighter.jumpBufferTicks, 0);
  for (let tick = 0; tick < 150; tick++) move(fighter, { jump: true }, arena);
  near(fighter.y, 0); assert.equal(fighter.grounded, true);
  assert.equal(fighter.jumpBufferTicks, 0, 'a held key cannot queue another jump');
});

test('early airborne presses expire, crouching blocks takeoff, and ledges grant no floating jump', () => {
  const arena = fixtureMap([]), early = player({ y: 3, grounded: false });
  move(early, { jump: true }, arena);
  for (let tick = 0; tick < 120; tick++) move(early, { jump: true }, arena);
  near(early.y, 0); assert.equal(early.jumpBufferTicks, 0); assert.equal(early.grounded, true);
  const crouched = player();
  for (let tick = 0; tick < 15; tick++) move(crouched, { jump: true, crouch: true }, arena);
  near(crouched.y, 0); assert.equal(crouched.jumpBufferTicks, 0);
  move(crouched, { jump: true }, arena); near(crouched.y, 0);
  const crate = fixtureMap([{ x: 0, y: 0, z: -2, w: 2, h: .8, d: 4 }]);
  const ledge = player({ x: -.32, y: .8, vx: -5.4, grounded: true });
  move(ledge, { left: true }, crate);
  assert.equal(ledge.grounded, false);
  move(ledge, { left: true, jump: true }, crate);
  assert.ok(ledge.vy < 0, 'a new press after walking off the edge keeps falling');
});

test('jump queues reset through weapon preparation, round changes, death and rematches', () => {
  const state = game.createState(); game.startMatch(state);
  state.players[0].jumpBufferTicks = 8;
  for (let tick = 0; tick < 11 * game.TICK_RATE; tick++) game.step(state, state.players.map(f => input({ jump: true }, f)));
  assert.equal(state.phase, 'fight'); assert.equal(state.players[0].jumpBufferTicks, 0);
  game.step(state, state.players.map(f => input({ jump: true }, f)));
  near(state.players[0].y, 0, 1e-6);
  state.players[0].jumpBufferTicks = 8; state.roundTicks = 1;
  game.step(state, state.players.map(f => input({}, f)));
  assert.equal(state.phase, 'roundEnd'); assert.equal(state.players[0].jumpBufferTicks, 0);
  state.players[0].jumpBufferTicks = 8; game.startMatch(state);
  assert.equal(state.players[0].jumpBufferTicks, 0);
  const dead = player({ alive: false, jumpBufferTicks: 8 });
  move(dead, { jump: true }, fixtureMap([])); assert.equal(dead.jumpBufferTicks, 0);
});

test('authority and prediction consume the same landing jump queue on real map cover', () => {
  const state = game.createState(); game.startMatch(state);
  for (let tick = 0; tick < 11 * game.TICK_RATE; tick++) game.step(state, state.players.map(f => input({}, f)));
  const box = game.MAPS.courtyard.colliders.find(box => box.id === 'west-site-crate');
  const fighter = state.players[0];
  Object.assign(fighter, { x: box.x + box.w / 2, z: box.z + box.d / 2, y: box.y + box.h + .06, vy: -1, grounded: false });
  const predicted = game.cloneState(fighter);
  let bufferedTakeoff = false;
  for (let tick = 0; tick < 105; tick++) {
    const controls = input({ jump: tick < 90, up: tick > 18, yaw: Math.PI / 2 }, fighter);
    const wasGrounded = fighter.grounded;
    game.predictLocalMovement(predicted, controls, state.mapId, 1, state.players);
    game.step(state, [controls, input({}, state.players[1])]);
    for (const key of ['x', 'y', 'z', 'vx', 'vy', 'vz']) near(predicted[key], fighter[key]);
    for (const key of ['grounded', 'crouching', 'jumpBufferTicks']) assert.equal(predicted[key], fighter[key], `${key} at tick ${tick}`);
    bufferedTakeoff ||= wasGrounded && fighter.vy > 0;
  }
  assert.ok(bufferedTakeoff, 'the same buffered press takes off in both simulations');
});

function floorClear(arena, x, z) {
  const radius = game.WORLD.radius + .045;
  if (x < arena.bounds.minX + radius || x > arena.bounds.maxX - radius || z < arena.bounds.minZ + radius || z > arena.bounds.maxZ - radius) return false;
  return !arena.colliders.some(box => {
    if (box.y >= game.WORLD.standHeight || box.y + box.h <= 0) return false;
    const dx = x - Math.max(box.x, Math.min(x, box.x + box.w));
    const dz = z - Math.max(box.z, Math.min(z, box.z + box.d));
    return dx * dx + dz * dz < radius * radius;
  });
}

// This path only chooses ordinary floor directions; every segment below is
// subsequently traversed by production movement, with no position corrections.
function floorPath(arena, start, goal) {
  const unit = .5, nx = Math.round((arena.bounds.maxX - arena.bounds.minX) / unit) + 1;
  const nz = Math.round((arena.bounds.maxZ - arena.bounds.minZ) / unit) + 1;
  const point = index => ({ x: arena.bounds.minX + index % nx * unit, z: arena.bounds.minZ + Math.floor(index / nx) * unit });
  const nearest = pose => {
    let best = null, distance = Infinity;
    for (let index = 0; index < nx * nz; index++) {
      const p = point(index), next = Math.hypot(p.x - pose.x, p.z - pose.z);
      if (next < distance && floorClear(arena, p.x, p.z)) { best = index; distance = next; }
    }
    assert.ok(distance < .65, `no nearby floor waypoint for ${JSON.stringify(pose)}`);
    return best;
  };
  const origin = nearest(start), destination = nearest(goal), parents = new Int32Array(nx * nz).fill(-2), queue = [origin];
  parents[origin] = -1;
  for (let head = 0; head < queue.length && parents[destination] === -2; head++) {
    const current = queue[head], x = current % nx, z = Math.floor(current / nx);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (x + dx < 0 || x + dx >= nx || z + dz < 0 || z + dz >= nz) continue;
      const next = current + dx + dz * nx, p = point(next);
      if (parents[next] !== -2 || !floorClear(arena, p.x, p.z)) continue;
      parents[next] = current; queue.push(next);
    }
  }
  assert.notEqual(parents[destination], -2, 'the route start must be reachable from its squad spawn on foot');
  const path = [];
  for (let index = destination; index !== -1; index = parents[index]) path.push(point(index));
  path.reverse(); path.push(goal);
  return path;
}

function walkTo(fighter, target, arena, label) {
  for (let tick = 0; tick < 900; tick++) {
    const dx = target.x - fighter.x, dz = target.z - fighter.z, distance = Math.hypot(dx, dz);
    if (distance < .11 && Math.hypot(fighter.vx, fighter.vz) < .08) break;
    move(fighter, { up: distance > .1, walk: true, yaw: distance > .01 ? Math.atan2(dx, -dz) : fighter.yaw }, arena);
  }
  assert.ok(Math.hypot(fighter.x - target.x, fighter.z - target.z) < .16, `${label} stopped at ${fighter.x},${fighter.y},${fighter.z} before ${target.x},${target.z}`);
}

function climbRoute(fighter, route, arena, label) {
  const landings = [];
  for (const step of route.steps) {
    const box = arena.colliders.find(collider => collider.id === step.colliderId);
    assert.ok(box, `${label} names a real solid platform`);
    const top = box.y + box.h;
    if (Math.abs(top - fighter.y) < 1e-6) {
      walkTo(fighter, step, arena, label);
      near(fighter.y, top); assert.equal(fighter.grounded, true);
      landings.push({ x: fighter.x, y: fighter.y, z: fighter.z });
      continue;
    }
    const face = { x: Math.max(box.x, Math.min(fighter.x, box.x + box.w)), z: Math.max(box.z, Math.min(fighter.z, box.z + box.d)) };
    const dx = face.x - fighter.x, dz = face.z - fighter.z, length = Math.hypot(dx, dz);
    assert.ok(length > .32, `${label} must approach ${step.colliderId} from outside its raised face`);
    walkTo(fighter, { x: face.x - dx / length * .4, z: face.z - dz / length * .4 }, arena, label);
    const startY = fighter.y;
    assert.ok(top > startY && top - startY <= 1, `${label} jump rises ${top - startY} metres`);
    const yaw = Math.atan2(step.x - fighter.x, -(step.z - fighter.z));
    move(fighter, { up: true, jump: true, yaw }, arena);
    let landed = false;
    for (let tick = 0; tick < 140; tick++) {
      move(fighter, { up: true, yaw }, arena);
      if (fighter.grounded) { landed = true; break; }
    }
    assert.ok(landed, `${label} failed to land on ${step.colliderId}`);
    near(fighter.y, top);
    walkTo(fighter, step, arena, label);
    near(fighter.y, top); assert.equal(fighter.grounded, true);
    assert.ok(fighter.x >= box.x + .32 && fighter.x <= box.x + box.w - .32 && fighter.z >= box.z + .32 && fighter.z <= box.z + box.d - .32, `${label} needs a complete standing footprint on ${step.colliderId}`);
    landings.push({ x: fighter.x, y: fighter.y, z: fighter.z });
  }
  return landings;
}

for (const [mapId, arena] of Object.entries(game.MAPS)) {
  test(`${arena.name}: every authored climb is reachable from spawn with the slowest loadout`, () => {
    assert.ok(arena.routes.length >= 4);
    const slowest = Object.values(game.WEAPONS).reduce((a, b) => a.speed < b.speed ? a : b);
    for (const route of arena.routes) {
      const state = game.createState({ mapId }), fighter = state.players[route.side === 'north' ? 1 : 0];
      fighter.weapon = slowest.id;
      const label = `${mapId}/${route.id}/${slowest.id}`;
      assert.ok(floorClear(arena, route.start.x, route.start.z), `${label} begins on clear standing floor`);
      for (const waypoint of floorPath(arena, fighter, route.start)) walkTo(fighter, waypoint, arena, label);
      near(fighter.y, 0); assert.equal(fighter.grounded, true);
      const landings = climbRoute(fighter, route, arena, label);
      assert.equal(landings.length, route.steps.length);
      assert.ok(fighter.y >= 3.2 - 1e-6, `${label} ends on a useful elevated firing position`);
    }
  });

  test(`${arena.name}: every climb ends with a real downward firing lane`, () => {
    for (const route of arena.routes) {
      const state = game.createState({ mapId }), shooter = state.players[0], target = state.players[1];
      const last = route.steps.at(-1), deck = arena.colliders.find(box => box.id === last.colliderId);
      Object.assign(shooter, { x: last.x, y: deck.y + deck.h, z: last.z });
      const origin = { x: shooter.x, y: shooter.y + game.eyeHeight(shooter), z: shooter.z };
      let visible = false;
      for (let radius = 4; radius <= 16 && !visible; radius += 2) for (let angle = 0; angle < 16 && !visible; angle++) {
        const x = shooter.x + Math.cos(angle * Math.PI / 8) * radius, z = shooter.z + Math.sin(angle * Math.PI / 8) * radius;
        if (!floorClear(arena, x, z)) continue;
        Object.assign(target, { x, y: 0, z });
        const dx = x - origin.x, dy = 1.64 - origin.y, dz = z - origin.z, distance = Math.hypot(dx, dy, dz);
        const hit = game.traceShot(state, shooter.id, origin, { x: dx / distance, y: dy / distance, z: dz / distance }, distance + 1);
        visible = hit.playerId === target.id && hit.kind === 'head';
      }
      assert.ok(visible, `${mapId}/${route.id} should overlook at least one reachable ground lane`);
    }
  });
}

test('raised decks have matching upward and downward grenade contacts and protect the level below', () => {
  const deck = { id: 'raised-deck', x: -2, y: 3, z: -2, w: 4, h: .25, d: 4 };
  const up = sweepSphereBox({ x: 0, y: 2.5, z: 0 }, { x: 0, y: 1, z: 0 }, deck);
  near(up.t, .5 - GRENADE.radius); assert.equal(up.ny, -1);
  const down = sweepSphereBox({ x: 0, y: 4, z: 0 }, { x: 0, y: -1, z: 0 }, deck);
  near(down.t, .75 - GRENADE.radius); assert.equal(down.ny, 1);
  const above = player({ id: 1, team: 1, y: 3.25 }), grenade = { x: 0, y: 2.5, z: 0, playerId: 0, team: 0 };
  assert.equal(grenadeBlastHits({ players: [above] }, grenade, fixtureMap([deck])).length, 0, 'a solid deck blocks the entire blast path');
  assert.equal(grenadeBlastHits({ players: [above] }, grenade, fixtureMap([])).length, 1);
});

test('authored roof and gallery underpasses share solid ceiling, shot and blast geometry', () => {
  for (const [mapId, colliderId, x, z] of [
    ['rooftops', 'roofline-west-roof', -13, -1],
    ['foundry', 'foundry-west-gallery', -14.5, 0],
    ['bastion', 'bastion-west-bridge', -7.5, 1],
  ]) {
    const arena = game.MAPS[mapId], deck = arena.colliders.find(box => box.id === colliderId);
    const below = player({ x, z });
    assert.ok(floorClear(arena, x, z), `${mapId} has real standing clearance below the deck`);
    let maxY = 0;
    for (let tick = 0; tick < 110; tick++) {
      move(below, { jump: true }, arena); maxY = Math.max(maxY, below.y);
    }
    near(maxY, deck.y - game.WORLD.standHeight);
    near(below.y, 0); assert.equal(below.grounded, true);
    move(below, { up: true }, arena, 30);
    assert.ok(below.z < z - .7, `${mapId} permits ordinary standing movement under its deck`);
    assert.equal(below.crouching, false); near(below.y, 0);

    const state = game.createState({ mapId }), above = state.players[0], target = state.players[1];
    Object.assign(above, { x, y: deck.y + deck.h, z }); Object.assign(target, { x, y: 0, z });
    const down = game.traceShot(state, above.id, { x, y: above.y + game.eyeHeight(above), z }, { x: 0, y: -1, z: 0 });
    assert.equal(down.colliderId, colliderId); assert.equal(down.kind, 'wall');
    const up = game.traceShot(state, target.id, { x, y: game.eyeHeight(target), z }, { x: 0, y: 1, z: 0 });
    assert.equal(up.colliderId, colliderId); assert.equal(up.kind, 'wall');
    const grenade = { x, y: deck.y - .5, z, playerId: 1, team: 1 };
    assert.equal(grenadeBlastHits({ players: [above] }, grenade, arena).length, 0, `${mapId} roof protects the player above from a hidden blast`);
    assert.equal(grenadeBlastHits({ players: [above] }, grenade, fixtureMap([])).length, 1);
  }
});
