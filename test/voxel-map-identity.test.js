import assert from 'node:assert/strict';
import test from 'node:test';
import { MAPS as BREACH } from '../public/voxel-maps.js';
import { MAPS as ROYALE } from '../public/voxel-royale-maps.js';
import { WORLD, createCombatPlayer, createState, emptyInput, predictLocalMovement, traceShot, eyeHeight } from '../public/voxel-engine.js';
import { navigationCanOccupy, navigationVisible } from '../public/voxel-navigation.js';

const IDS = ['snow', 'sewers', 'trading'], EPS = 1e-6;
const near = (a, b, label = '') => assert.ok(Math.abs(a - b) < EPS, `${label}: ${a} != ${b}`);
const support = (map, p) => !p.y || map.colliders.some(b => Math.abs(b.y + b.h - p.y) < EPS
  && p.x >= b.x + WORLD.radius - EPS && p.x <= b.x + b.w - WORLD.radius + EPS
  && p.z >= b.z + WORLD.radius - EPS && p.z <= b.z + b.d - WORLD.radius + EPS);
const solid = (map, id) => {
  const result = map.colliders.find(b => b.id === id);
  assert.ok(result, `${map.id}: missing physical support ${id}`);
  return result;
};
const snapshot = map => JSON.stringify(map);

// Independent half-metre floor connectivity uses the real circular body, not
// author-provided adjacency. Links also sample the midpoint to reject narrow
// seams between colliders. The authored map metadata only supplies destinations.
function floorGraph(map) {
  const unit = .5, nx = Math.round((map.bounds.maxX - map.bounds.minX) / unit) + 1;
  const nz = Math.round((map.bounds.maxZ - map.bounds.minZ) / unit) + 1;
  const point = index => ({ x: map.bounds.minX + index % nx * unit, y: 0, z: map.bounds.minZ + Math.floor(index / nx) * unit });
  const clear = p => navigationCanOccupy(map, { ...p, y: 0 }, { radius: WORLD.radius + .025 });
  const allowed = new Uint8Array(nx * nz), seen = new Uint8Array(nx * nz);
  for (let index = 0; index < allowed.length; index++) allowed[index] = Number(clear(point(index)));
  function nearest(p) {
    const ix = Math.round((p.x - map.bounds.minX) / unit), iz = Math.round((p.z - map.bounds.minZ) / unit);
    let chosen = -1, distance = Infinity;
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      if (ix + dx < 0 || ix + dx >= nx || iz + dz < 0 || iz + dz >= nz) continue;
      const index = ix + dx + (iz + dz) * nx, next = point(index), gap = Math.hypot(next.x - p.x, next.z - p.z);
      if (allowed[index] && gap < distance && clear({ x: (next.x + p.x) / 2, z: (next.z + p.z) / 2 })) {
        chosen = index; distance = gap;
      }
    }
    assert.ok(distance <= .55, `${map.mode}/${map.id}: no conservative standing floor near ${p.id || JSON.stringify(p)}`);
    return chosen;
  }
  const starts = map.spawnPoints || map.spawns.flat(), origin = nearest(starts[0]), queue = [origin]; seen[origin] = 1;
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head], ix = current % nx, iz = Math.floor(current / nx);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (ix + dx < 0 || ix + dx >= nx || iz + dz < 0 || iz + dz >= nz) continue;
      const next = current + dx + dz * nx, a = point(current), b = point(next);
      if (!allowed[next] || seen[next] || !clear({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 })) continue;
      seen[next] = 1; queue.push(next);
    }
  }
  return { connected: p => Boolean(seen[nearest(p)]), reachable: queue.length, allowed: allowed.reduce((a, b) => a + b, 0) };
}

function walk(player, map, destination, expectedY = player.y) {
  for (let tick = 0; tick < 1800; tick++) {
    const dx = destination.x - player.x, dz = destination.z - player.z, gap = Math.hypot(dx, dz);
    if (gap < .1 && Math.hypot(player.vx, player.vz) < .08) break;
    predictLocalMovement(player, { ...emptyInput(player), up: gap > .085, walk: true, yaw: gap > .01 ? Math.atan2(dx, -dz) : player.yaw }, map);
    assert.ok(navigationCanOccupy(map, player), `${map.mode}/${map.id}: movement entered a solid`);
    assert.equal(player.crouching, false, `${map.id}: a standing route must not require crouch`);
  }
  assert.ok(Math.hypot(destination.x - player.x, destination.z - player.z) < .17,
    `${map.mode}/${map.id}: could not walk to ${JSON.stringify(destination)}; stopped at ${JSON.stringify({ x: player.x, y: player.y, z: player.z })}`);
  near(player.y, expectedY, `${map.id}: stable support`); assert.equal(player.grounded, true);
}

function climb(map, route) {
  const player = Object.assign(createCombatPlayer(0, 1, 'lmg'), route.start);
  let jumps = 0;
  for (const step of route.steps) {
    const box = solid(map, step.colliderId), top = box.y + box.h;
    const face = { x: Math.max(box.x, Math.min(player.x, box.x + box.w)), z: Math.max(box.z, Math.min(player.z, box.z + box.d)) };
    const dx = face.x - player.x, dz = face.z - player.z, distance = Math.hypot(dx, dz);
    assert.ok(distance > WORLD.radius, `${route.id}: raised face must precede ${box.id}`);
    walk(player, map, { x: face.x - dx / distance * .4, z: face.z - dz / distance * .4 });
    assert.ok(top > player.y && top - player.y <= 1.01, `${route.id}: legal jump rise`);
    const yaw = Math.atan2(step.x - player.x, -(step.z - player.z));
    predictLocalMovement(player, { ...emptyInput(player), up: true, jump: true, yaw }, map); jumps++;
    for (let tick = 0; tick < 160 && !player.grounded; tick++) predictLocalMovement(player, { ...emptyInput(player), up: true, yaw }, map);
    assert.equal(player.grounded, true, `${route.id}: lands on ${box.id}`); near(player.y, top, `${route.id}/${box.id}`);
    walk(player, map, step, top);
    assert.ok(navigationCanOccupy(map, player) && support(map, player), `${route.id}: a full standing footprint is supported`);
  }
  assert.ok(jumps >= 4 && player.y >= 3.2 - EPS, `${route.id}: a meaningful multi-hop perch`);
  const eye = { x: player.x, y: player.y + eyeHeight(player), z: player.z };
  let exposedFloor = 0;
  // Connected sewer galleries overlook the narrower bank corridors too. Keep
  // the five-metre minimum and real clearance/visibility checks for each ray.
  for (const dx of [-8, -5, -2, 0, 2, 5, 8]) for (const dz of [-8, -5, -2, 0, 2, 5, 8]) {
    const p = { x: player.x + dx, y: 0, z: player.z + dz };
    if (Math.hypot(dx, dz) >= 5 && navigationCanOccupy(map, p)
      && navigationVisible(map, eye, { ...p, y: 1.64 })) exposedFloor++;
  }
  assert.ok(exposedFloor > 0, `${route.id}: high ground overlooks real reachable floor instead of a sealed roof`);
  return player;
}

function rayThrough(map, box, height, offset = 0) {
  const alongZ = box.w >= box.d, distance = alongZ ? box.d + 3 : box.w + 3;
  const origin = alongZ
    ? { x: box.x + box.w / 2 + offset, y: height, z: box.z - 1.5 }
    : { x: box.x - 1.5, y: height, z: box.z + box.d / 2 + offset };
  const direction = alongZ ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };
  const state = createState({ mapId: map.id }); state.map = map; state.players = [];
  return { hit: traceShot(state, -1, origin, direction, distance), origin, direction };
}

test('the three expansion arenas have independent physical topology beyond materials and colours', () => {
  for (const mode of ['breach', 'royale']) {
    const catalog = mode === 'breach' ? BREACH : ROYALE;
    const shapes = IDS.map(id => new Set(catalog[id].colliders.map(b => [b.x, b.y, b.z, b.w, b.h, b.d].join(':'))));
    for (let a = 0; a < shapes.length; a++) for (let b = a + 1; b < shapes.length; b++) {
      const overlap = [...shapes[a]].filter(value => shapes[b].has(value)).length;
      assert.ok(overlap / Math.min(shapes[a].size, shapes[b].size) < .35,
        `${mode}/${IDS[a]} and ${IDS[b]} retain too much identical geometry`);
    }
    assert.equal(catalog.snow.colliders.some(b => b.overhead), false, 'snow research remains outdoors');
    assert.ok(catalog.sewers.tunnels.length >= 6, 'sewers form a genuinely branching tunnel network');
    assert.ok(catalog.trading.landmarks.filter(value => value.kind === 'desk-pod').length >= 8, 'office has substantial double-sided trading desks');
  }
});

for (const [mode, catalog] of [['breach', BREACH], ['royale', ROYALE]]) for (const id of IDS) {
  test(`${mode}/${id}: all starts, doors, ground supplies and climb approaches belong to continuous standing floor`, () => {
    const map = catalog[id], before = snapshot(map), graph = floorGraph(map), starts = map.spawnPoints || map.spawns.flat();
    assert.equal(starts.length, mode === 'royale' ? 16 : 6);
    assert.ok(graph.reachable >= 1500, `${mode}/${id}: substantial usable floor area`);
    assert.ok(graph.reachable / graph.allowed >= .98, `${mode}/${id}: ${graph.allowed - graph.reachable} walkable floor nodes stranded`);
    const destinations = [...starts, ...map.sites, ...map.routes.map(route => route.start),
      ...map.buildings.flatMap(room => room.doorways.flatMap(door => [door.inside, door.outside])),
      ...map.tunnels.flatMap(tunnel => [tunnel.entry, tunnel.midpoint, tunnel.exit]),
      ...(map.lootPoints || []).filter(p => !p.y), ...(map.stormCenter ? [map.stormCenter] : [])];
    for (const p of destinations) {
      assert.ok(navigationCanOccupy(map, p) && graph.connected(p), `${mode}/${id}: inaccessible ${p.id || JSON.stringify(p)}`);
    }
    for (const site of map.sites) {
      const approaches = [[0, -2.5], [0, 2.5], [-2.5, 0], [2.5, 0]].filter(([dx, dz]) => {
        const p = { x: site.x + dx, y: 0, z: site.z + dz }; return navigationCanOccupy(map, p) && graph.connected(p);
      });
      assert.ok(approaches.length >= 2, `${id}/${site.id}: two usable approaches to a charge site`);
    }
    assert.ok(map.colliders.length <= 180, `${mode}/${id}: bounded physical complexity`);
    assert.equal(snapshot(map), before, 'validation never mutates authored geometry');
  });

  test(`${mode}/${id}: every authored climb reaches useful high ground through real successive jumps`, () => {
    const map = catalog[id], before = snapshot(map);
    assert.ok(map.routes.length >= 4);
    for (const route of map.routes) climb(map, route);
    assert.equal(snapshot(map), before);
  });
}

test('tactical squad starts have no immediate opposing standing headshot lane', () => {
  for (const id of IDS) {
    const map = BREACH[id];
    for (const a of map.spawns[0]) for (const b of map.spawns[1]) {
      assert.equal(navigationVisible(map, { ...a, y: 1.64 }, { ...b, y: 1.64 }), false,
        `${id}: initial unearned sight lane ${a.x},${a.z} to ${b.x},${b.z}`);
    }
  }
});

test('both tactical charge sites belong to the defending end and have genuine attacker rotations', () => {
  for (const id of IDS) {
    const map = BREACH[id];
    for (const site of map.sites) {
      const distance = team => map.spawns[team].reduce((sum, p) => sum + Math.hypot(p.x - site.x, p.z - site.z), 0) / 3;
      assert.ok(distance(1) < distance(0) * .6, `${id}/${site.id}: defenders must own the initial planting area`);
      const rotations = map.groundRoutes.filter(route => route.siteId === site.id);
      assert.ok(rotations.length >= 1);
      for (const route of rotations) {
        assert.ok(Math.min(...map.spawns[0].map(p => Math.hypot(p.x - route.start.x, p.z - route.start.z))) < 3,
          `${route.id}: authored attack path starts at the attacking squad`);
        const player = Object.assign(createCombatPlayer(0), map.spawns[0][0]);
        for (const point of route.waypoints) walk(player, map, point, 0);
        assert.ok(Math.hypot(player.x - site.x, player.z - site.z) < site.radius, `${route.id}: actual arrival at charge site`);
      }
    }
  }
});

test('legacy arenas expose distinct immutable landmarks backed by real solids', () => {
  const expected = { courtyard: 'fountain-sculpture', depot: 'forklift', canal: 'market-stall', rooftops: 'water-tank',
    foundry: 'industrial-generator', bastion: 'signal-array', paris: 'metro-kiosk', forest: 'logging-pile', maze: 'astrolabe', desert: 'carved-obelisk' };
  for (const [id, kind] of Object.entries(expected)) for (const map of [BREACH[id], ROYALE[id]].filter(Boolean)) {
    assert.ok(Object.isFrozen(map.landmarks) && Object.isFrozen(map.props));
    assert.ok(map.landmarks.some(value => value.kind === kind), `${id}: authored map-specific focal prop`);
    for (const prop of map.landmarks) {
      const ids = prop.colliderIds || prop.collisionIds;
      assert.ok(Object.isFrozen(prop) && Object.isFrozen(ids) && ids.length > 0);
      for (const id of ids) assert.ok(map.colliders.some(box => box.id === id), `${map.id}/${prop.id}: visible cover has matching collision`);
    }
    assert.ok(map.colliders.filter(box => box.id.startsWith('landmark-')).length <= 8, `${id}: bounded extra physical props`);
  }
});

test('Royale supplies are supported, clear and accessible through actual authored upper structures', () => {
  for (const id of IDS) {
    const map = ROYALE[id];
    assert.ok(map.lootPoints.length >= 30, `${id}: enough decentralized resources`);
    for (const p of map.lootPoints) {
      assert.ok(navigationCanOccupy(map, p) && support(map, p), `${id}/${p.id}: honest pickup location`);
      if (p.y) assert.ok(map.routes.some(route => {
        const roof = solid(map, route.steps.at(-1).colliderId);
        return Math.abs(roof.y + roof.h - p.y) < EPS && p.x >= roof.x + WORLD.radius && p.x <= roof.x + roof.w - WORLD.radius
          && p.z >= roof.z + WORLD.radius && p.z <= roof.z + roof.d - WORLD.radius;
      }), `${id}/${p.id}: upper cache has a real climb`);
    }
  }
});

test('trading workstations are real bullet cover with honest table undersides and lateral peeks', () => {
  for (const map of [BREACH.trading, ROYALE.trading]) {
    const monitors = map.landmarks.filter(value => value.kind === 'monitor'), desks = map.landmarks.filter(value => value.kind === 'desk-pod');
    assert.ok(monitors.length >= 8 && desks.length >= 8);
    for (const prop of monitors) {
      const box = solid(map, prop.collisionIds[0]), shot = rayThrough(map, box, 1.64);
      assert.equal(shot.hit.kind, 'wall'); assert.equal(shot.hit.colliderId, box.id, `${box.id}: screen catches a real bullet`);
      assert.ok(box.y + box.h > 1.64, `${box.id}: screen protects a standing head line`);
    }
    let usefulDesks = 0;
    for (const prop of desks) {
      const box = solid(map, prop.collisionIds[0]);
      assert.ok(box.y > .5 && box.y + box.h <= .85, `${box.id}: a table surface with an open underside`);
      const topHit = rayThrough(map, box, box.y + box.h / 2, -box.w * .2);
      assert.equal(topHit.hit.colliderId, box.id, `${box.id}: visible tabletop is actually solid`);
      const underside = rayThrough(map, box, .3, -box.w * .2);
      assert.ok(!prop.collisionIds.includes(underside.hit.colliderId), `${box.id}: no invisible full-box underside`);
      const screen = monitors.find(value => value.x >= box.x && value.x + value.w <= box.x + box.w
        && value.z >= box.z && value.z + value.d <= box.z + box.d);
      assert.ok(screen, `${box.id}: matching monitor bank`);
      const screenBox = solid(map, screen.collisionIds[0]);
      assert.equal(rayThrough(map, screenBox, .98).hit.colliderId, screenBox.id, 'workstation catches a crouching head line');
      // A genuinely clear flank beside the table bank permits a lateral peek,
      // rather than hiding the whole aisle behind an oversized invisible box.
      for (const sign of [-1, 1]) {
        const p = { x: box.x + box.w / 2 + sign * (box.w / 2 + .5), y: 0, z: box.z + box.d / 2 };
        if (navigationCanOccupy(map, p)) { usefulDesks++; break; }
      }
    }
    assert.ok(usefulDesks >= 4, `${map.mode}/trading: workstation cover retains real lateral peek options`);
    assert.ok(map.landmarks.some(prop => prop.kind === 'market-display' && prop.collisionIds.some(id => {
      const box = solid(map, id); return box.w >= 4 && box.h >= 1.8;
    })), 'large market screens provide substantial physical protection');
  }
});

test('sewer collectors permit standing travel under solid roofs and safe water-channel crossings', () => {
  for (const map of [BREACH.sewers, ROYALE.sewers]) {
    assert.ok(map.tunnels.length >= 6);
    for (const tunnel of map.tunnels) {
      const roof = solid(map, tunnel.roofId);
      assert.ok(tunnel.height >= WORLD.standHeight + .6 && tunnel.width >= 2.2);
      const player = Object.assign(createCombatPlayer(0), tunnel.entry);
      walk(player, map, tunnel.midpoint, 0); walk(player, map, tunnel.exit, 0);
      walk(player, map, tunnel.midpoint, 0); walk(player, map, tunnel.entry, 0);
      const state = createState({ mapId: 'sewers' }); state.map = map; state.players = [];
      const shot = traceShot(state, -1, { ...tunnel.midpoint, y: 1.64 }, { x: 0, y: 1, z: 0 });
      assert.equal(shot.kind, 'wall'); assert.equal(shot.colliderId, roof.id, `${tunnel.id}: physical drainage roof`);
    }
    const channels = map.colliders.filter(box => box.material === 'water');
    assert.ok(channels.length >= 2, 'real drainage water channels');
    for (const box of channels) {
      near(box.y + box.h, 0, `${box.id}: water matches the floor instead of creating a false ledge`);
      const p = { x: box.x + box.w / 2, y: 0, z: box.z + box.d / 2 };
      assert.ok(navigationCanOccupy(map, p), `${box.id}: channel crossing leaves standing headroom`);
      const player = Object.assign(createCombatPlayer(0), p);
      for (let tick = 0; tick < 60; tick++) predictLocalMovement(player, emptyInput(player), map);
      near(player.y, 0, `${box.id}: floor remains stable`);
    }
    assert.ok(map.colliders.some(box => box.material === 'pipe' && box.y > WORLD.standHeight), 'solid overhead drainage pipes');
    const overhead = map.landmarks.filter(prop => prop.kind === 'pipe' && prop.underpass);
    assert.ok(overhead.length > 0, 'authored pressure-feed underpass');
    for (const prop of overhead) {
      const player = Object.assign(createCombatPlayer(0), prop.underpass.entry);
      walk(player, map, prop.underpass.midpoint, 0); walk(player, map, prop.underpass.exit, 0);
      walk(player, map, prop.underpass.midpoint, 0);
      const bottom = Math.min(...prop.collisionIds.map(id => solid(map, id).y));
      assert.ok(bottom - player.y > WORLD.standHeight + .3, 'pressure-feed pipe has genuine standing headroom');
      predictLocalMovement(player, { ...emptyInput(player), jump: true }, map);
      let peak = player.y;
      for (let tick = 0; tick < 150 && !player.grounded; tick++) {
        predictLocalMovement(player, emptyInput(player), map); peak = Math.max(peak, player.y);
        assert.ok(player.y + WORLD.standHeight <= bottom + EPS, 'jump head stays below the visible solid pipe');
      }
      assert.ok(peak > .3, 'a real jump reaches the pipe underside');
      assert.equal(player.grounded, true); near(player.y, 0);
    }
  }
});
