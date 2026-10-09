import assert from 'node:assert/strict';
import test from 'node:test';
import { createExpansionMap } from '../public/voxel-expansion-maps.js';
import { MAPS as BREACH } from '../public/voxel-maps.js';
import { MAPS as ROYALE } from '../public/voxel-royale-maps.js';
import { WORLD, createCombatPlayer, createState, emptyInput, predictLocalMovement, traceShot } from '../public/voxel-engine.js';
import { navigationCanOccupy, navigationPath, navigationVisible } from '../public/voxel-navigation.js';

const IDS = ['snow', 'sewers', 'trading'], near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

function walk(player, map, destination) {
  for (let tick = 0; tick < 1200; tick++) {
    const dx = destination.x - player.x, dz = destination.z - player.z, gap = Math.hypot(dx, dz);
    if (gap < .11 && Math.hypot(player.vx, player.vz) < .08) break;
    predictLocalMovement(player, { ...emptyInput(player), up: gap > .1, walk: true, yaw: gap > .01 ? Math.atan2(dx, -dz) : player.yaw }, map);
    assert.ok(navigationCanOccupy(map, player), `${map.id} physically crossed a solid`);
  }
  assert.ok(Math.hypot(destination.x - player.x, destination.z - player.z) < .16, `${map.id} did not reach ${JSON.stringify(destination)} from ${JSON.stringify(player)}`);
  near(player.y, 0); assert.equal(player.grounded, true); assert.equal(player.crouching, false);
}

function connectedFloor(map) {
  const step = .5, nx = Math.round((map.bounds.maxX - map.bounds.minX) / step) + 1, nz = Math.round((map.bounds.maxZ - map.bounds.minZ) / step) + 1;
  const point = index => ({ x: map.bounds.minX + index % nx * step, y: 0, z: map.bounds.minZ + Math.floor(index / nx) * step });
  const clear = p => p.x >= map.bounds.minX + WORLD.radius + .025 && p.x <= map.bounds.maxX - WORLD.radius - .025
    && p.z >= map.bounds.minZ + WORLD.radius + .025 && p.z <= map.bounds.maxZ - WORLD.radius - .025
    && !map.colliders.some(b => b.y < WORLD.standHeight && b.y + b.h > 0
      && Math.hypot(p.x - Math.max(b.x, Math.min(p.x, b.x + b.w)), p.z - Math.max(b.z, Math.min(p.z, b.z + b.d))) < WORLD.radius + .025);
  const allowed = new Uint8Array(nx * nz), seen = new Uint8Array(nx * nz);
  for (let index = 0; index < allowed.length; index++) allowed[index] = Number(clear(point(index)));
  const nearest = p => {
    let result = -1, gap = Infinity;
    for (let index = 0; index < allowed.length; index++) if (allowed[index]) {
      const next = point(index), distance = Math.hypot(p.x - next.x, p.z - next.z);
      if (distance < gap && clear({ x: (p.x + next.x) / 2, z: (p.z + next.z) / 2 })) { gap = distance; result = index; }
    }
    assert.ok(gap < .55, `${map.id}: clear floor node near ${JSON.stringify(p)}`);
    return result;
  };
  const queue = [nearest(map.spawns[0][0])]; seen[queue[0]] = 1;
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head], ix = current % nx, iz = Math.floor(current / nx);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (ix + dx < 0 || ix + dx >= nx || iz + dz < 0 || iz + dz >= nz) continue;
      const next = current + dx + dz * nx, a = point(current), b = point(next);
      if (!allowed[next] || seen[next] || !clear({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 })) continue;
      seen[next] = 1; queue.push(next);
    }
  }
  return { reachable: p => Boolean(seen[nearest(p)]), count: queue.length };
}

test('expansion factories reject unknown modes and retain immutable authored geometry in both catalogs', () => {
  for (const mode of ['breach', 'royale']) for (const id of IDS) {
    const actual = createExpansionMap(id, mode), catalog = mode === 'breach' ? BREACH : ROYALE;
    assert.deepEqual(actual, catalog[id]);
    assert.ok(Object.isFrozen(actual) && Object.isFrozen(actual.ceilings) && Object.isFrozen(actual.landmarks) && Object.isFrozen(actual.tunnels));
    for (const landmark of actual.landmarks) {
      assert.ok(Object.isFrozen(landmark) && Object.isFrozen(landmark.collisionIds));
      assert.ok(landmark.collisionIds.every(id => actual.colliders.some(value => value.id === id)));
    }
    assert.ok(actual.colliders.length <= 180, `${mode}/${id} bounded collision cost for authored interiors`);
  }
  assert.throws(() => createExpansionMap('missing'), TypeError);
  assert.throws(() => createExpansionMap('snow', 'unknown'), TypeError);
});

test('new tactical sites, all squad starts, both room doors and every climb share conservative standing floor', () => {
  for (const id of IDS) {
    const map = BREACH[id], graph = connectedFloor(map);
    assert.ok(graph.count > (id === 'sewers' ? 1500 : 5000), `${id} substantial connected movement space`);
    const locations = [...map.spawns.flat(), ...map.sites, ...map.routes.map(value => value.start),
      ...map.buildings.flatMap(value => value.doorways.flatMap(door => [door.inside, door.outside])),
      ...map.tunnels.flatMap(value => [value.entry, value.midpoint, value.exit])];
    for (const location of locations) assert.ok(graph.reachable(location), `${id}: disconnected ${JSON.stringify(location)}`);
    for (const site of map.sites) {
      assert.ok(graph.reachable({ x: site.x, z: site.z - 2.5 }));
      assert.ok(graph.reachable({ x: site.x, z: site.z + 2.5 }));
    }
  }
});

for (const [mode, catalog] of [['breach', BREACH], ['royale', ROYALE]]) {
  test(`${mode}: all drainage tunnels admit a full standing player in both directions under real solid roofs`, () => {
    const map = catalog.sewers;
    assert.ok(map.tunnels.length >= 6);
    for (const tunnel of map.tunnels) {
      const roof = map.colliders.find(value => value.id === tunnel.roofId);
      assert.ok(tunnel.height >= WORLD.standHeight + 1 && tunnel.width >= 3);
      near(roof.y, tunnel.height);
      const player = Object.assign(createCombatPlayer(0), tunnel.entry);
      walk(player, map, tunnel.midpoint); walk(player, map, tunnel.exit);
      walk(player, map, tunnel.midpoint); walk(player, map, tunnel.entry);
      const state = createState({ mapId: 'sewers' }); state.map = map;
      const hit = traceShot(state, state.players[0].id, { ...tunnel.midpoint, y: 1.64 }, { x: 0, y: 1, z: 0 });
      assert.equal(hit.kind, 'wall'); assert.equal(hit.colliderId, roof.id);
    }
    for (const channel of map.channelRoutes) {
      const player = Object.assign(createCombatPlayer(0), channel.points[0]);
      for (const point of channel.points.slice(1)) walk(player, map, point);
    }
  });

  test(`${mode}: office and pumping chambers are enclosed by real high ceilings that still permit upper-route jumps`, () => {
    for (const id of ['sewers', 'trading']) {
      const map = catalog[id]; assert.ok(map.ceilings.length >= 1);
      const ceiling = map.colliders.find(value => value.id === map.ceilings[0]);
      for (const ceilingId of map.ceilings) {
        const roof = map.colliders.find(value => value.id === ceilingId);
        assert.equal(roof.overhead, true);
        assert.ok(['office-ceiling', 'sewer-ceiling', 'sewer-roof', 'sewer-brick', 'pipe'].includes(roof.material), 'ceilings include honest collector arches and pressure-pipe overheads');
      }
      for (const route of map.routes) {
        const landing = route.steps.at(-1), support = map.colliders.find(box => box.id === landing.colliderId);
        const above = map.colliders.filter(box => box.overhead && landing.x >= box.x && landing.x <= box.x + box.w
          && landing.z >= box.z && landing.z <= box.z + box.d && box.y > support.y + support.h);
        assert.ok(above.length, `${route.id}: genuinely indoors`);
        assert.ok(Math.min(...above.map(box => box.y)) - (support.y + support.h) > WORLD.standHeight + 1.1, 'standing jump clears overhead structure');
      }
      const state = createState({ mapId: id }); state.map = map;
      const origin = id === 'trading' ? { x: 0, y: 1.64, z: 6 } : { x: 4.5, y: 1.64, z: 0 };
      const hit = traceShot(state, state.players[0].id, origin, { x: 0, y: 1, z: 0 });
      assert.ok(map.ceilings.includes(hit.colliderId)); assert.equal(hit.kind, 'wall');
      const contactedRoof = map.colliders.find(value => value.id === hit.colliderId);
      assert.equal(navigationVisible(map, origin, { ...origin, y: contactedRoof.y + .1 }), false);
      assert.equal(navigationVisible({ ...map, colliders: map.colliders.filter(value => value.id !== contactedRoof.id) }, origin, { ...origin, y: contactedRoof.y + .1 }), true);
      for (const boundary of map.colliders.filter(value => /^(wall|boundary)-/.test(value.id))) assert.ok(boundary.h >= ceiling.y + ceiling.h);
    }
  });
}

test('snow stays open outdoors with four snowy research roofs and readable supply-cover sight lines', () => {
  for (const map of [BREACH.snow, ROYALE.snow]) {
    assert.deepEqual(map.ceilings, []); assert.equal(map.tunnels.length, 0);
    assert.equal(map.colliders.filter(value => value.material === 'snow-roof').length, 4);
    assert.ok(map.colliders.some(value => value.material === 'snow-crate'));
    assert.ok(map.landmarks.some(value => value.kind === 'snow-generator'));
    const a = { x: 0, y: 1.64, z: 10 }, b = { x: 0, y: 1.64, z: -10 };
    assert.equal(navigationVisible(map, a, b), false, 'supply stack screens the central spawn-to-spawn angle');
    const fingerprints = new Set(map.buildings.map(room => `${room.interior.maxX - room.interior.minX}:${room.interior.maxZ - room.interior.minZ}`));
    assert.ok(fingerprints.size >= 3, 'research buildings use distinct footprints');
    assert.ok(map.landmarks.some(value => value.kind === 'radar-dish'));
  }
});

test('the fictional trading office has eight genuine desk pods, solid monitor screens, glass rooms and a readable brand wall', () => {
  for (const map of [BREACH.trading, ROYALE.trading]) {
    assert.match(map.name, /Barclays Trading Floor/); assert.match(map.description, /fictional/);
    const desks = map.landmarks.filter(value => value.kind === 'desk-pod'), monitors = map.landmarks.filter(value => value.kind === 'monitor');
    assert.equal(desks.length, map.mode === 'royale' ? 12 : 8); assert.equal(monitors.length, desks.length);
    for (const [index, desk] of desks.entries()) {
      const screen = monitors[index]; near(screen.y, desk.y + desk.h);
      assert.ok(screen.x >= desk.x && screen.x + screen.w <= desk.x + desk.w);
      assert.ok(screen.z >= desk.z && screen.z + screen.d <= desk.z + desk.d);
      assert.equal(navigationCanOccupy(map, { x: desk.x + desk.w / 2, y: 0, z: desk.z + desk.d / 2 }), false, 'rectangular desk cover has honest solid collision');
    }
    assert.equal(map.buildings.length, 1, 'a distinct glass meeting suite beside an open server gallery');
    assert.ok(map.buildings.every(room => room.wallIds.every(id => map.colliders.find(value => value.id === id).material === 'glass')));
    assert.ok(map.landmarks.some(value => value.kind === 'server-gallery'));
    assert.ok(map.landmarks.some(value => value.kind === 'server-rack'));
    assert.ok(map.colliders.some(value => value.id === 'trading-brand-wall' && value.w >= 10));
    assert.ok(map.decorations.some(value => value.kind === 'office-aisle' && value.w >= 5));
  }
});
