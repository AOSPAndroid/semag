import test from 'node:test';
import assert from 'node:assert/strict';
import { createCombatPlayer, emptyInput, predictLocalMovement, WORLD } from '../public/voxel-engine.js';
import { createMovementPresenter, resolvePresentationContacts } from '../public/voxel-presentation.js';

const openMap = { id: 'camera-anchor', bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 }, colliders: [] };
const player = (id, patch = {}) => ({ ...createCombatPlayer(id), ...patch });
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} versus ${b}`);
const freeze = value => { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
function legal(players, map) {
  for (const body of players) if (body.alive) {
    assert.ok(body.x >= map.bounds.minX + body.radius - 1e-7 && body.x <= map.bounds.maxX - body.radius + 1e-7);
    assert.ok(body.z >= map.bounds.minZ + body.radius - 1e-7 && body.z <= map.bounds.maxZ - body.radius + 1e-7);
    const height = body.crouching ? WORLD.crouchHeight : WORLD.standHeight;
    for (const box of map.colliders) if (body.y < box.y + box.h - 1e-7 && body.y + height > box.y + 1e-7) {
      const x = Math.max(box.x, Math.min(box.x + box.w, body.x)), z = Math.max(box.z, Math.min(box.z + box.d, body.z));
      assert.ok(Math.hypot(body.x - x, body.z - z) >= body.radius - 1e-7, 'display body stays outside cover');
    }
    for (const other of players) if (other.alive && other.id !== body.id) {
      const otherHeight = other.crouching ? WORLD.crouchHeight : WORLD.standHeight;
      if (body.y < other.y + otherHeight - 1e-7 && body.y + height > other.y + 1e-7) assert.ok(Math.hypot(body.x - other.x, body.z - other.z) >= body.radius + other.radius - 1e-7, 'display bodies stay separated');
    }
  }
}

test('a stale departing opponent yields without displacing the collision-tested stationary camera', () => {
  const camera = player(0), current = player(1, { x: 1, vx: 5.4 });
  const predicted = structuredClone(camera); predictLocalMovement(predicted, emptyInput(), openMap, 1, [camera, current]);
  const stale = { ...current, x: .5 }, shown = [predicted, stale], authority = [camera, current];
  const before = structuredClone({ shown, authority }); freeze(shown); freeze(authority);
  const view = resolvePresentationContacts(shown, openMap, { anchorId: 0, authoritativePlayers: authority });
  assert.deepEqual(view[0], predicted); near(view[1].x, .64 + 1e-8); legal(view, openMap);
  for (const key of Object.keys(stale).filter(key => !['x', 'y', 'z'].includes(key))) assert.deepEqual(view[1][key], stale[key], key);
  assert.deepEqual({ shown, authority }, before);
});

test('a stale wall-pinned body restores its actual newer movement instead of pushing the camera', () => {
  const map = { ...openMap, colliders: [{ x: -1, y: 0, z: -3, w: 1, h: 4, d: 6 }] };
  const stale = player(1, { x: .32 }), current = structuredClone(stale);
  predictLocalMovement(current, { ...emptyInput(), up: true }, map, 25);
  const camera = player(0, { x: .88 }), unrelated = player(2, { x: 8, z: 8 });
  predictLocalMovement(camera, emptyInput(), map, 1, [current, unrelated]);
  const shown = [camera, stale, unrelated], authority = [camera, current, unrelated], before = structuredClone({ shown, authority }); freeze(shown); freeze(authority);
  const view = resolvePresentationContacts(shown, map, { anchorId: 0, authoritativePlayers: authority });
  assert.deepEqual(view[0], camera); assert.deepEqual(view[2], unrelated);
  for (const axis of ['x', 'y', 'z']) near(view[1][axis], current[axis]);
  assert.equal(view[1].vz, stale.vz, 'a fallback changes presentation coordinates only');
  legal(view, map); assert.deepEqual({ shown, authority }, before);
});

test('crowd fallback expands to a stale neighbour while preserving the current camera and valid cover', () => {
  const map = { ...openMap, colliders: [{ x: -1, y: 0, z: -3, w: 1, h: 4, d: 6 }] };
  const camera = player(0, { x: .88 }), stale = player(1, { x: .32 }), neighbour = player(2, { x: .32, z: -.7 });
  const current = { ...stale, z: -.7 }, currentNeighbour = { ...neighbour, z: -1.4 };
  const authority = [camera, current, currentNeighbour];
  const view = resolvePresentationContacts([camera, stale, neighbour], map, { anchorId: 0, authoritativePlayers: authority });
  assert.deepEqual(view[0], camera); legal(view, map);
});

for (const hz of [60, 120, 144, 240]) test(`${hz} Hz movement and sub-tick camera cannot be shoved by delayed approaching or departing views`, () => {
  const held = { ...emptyInput(), right: true }, camera = player(0), peer = player(1, { x: 3 });
  const present = createMovementPresenter(); let remainder = 0;
  for (let frame = 1; frame <= hz / 2; frame++) {
    remainder += 1 / hz;
    while (remainder + 1e-12 >= 1 / 120) {
      remainder = Math.max(0, remainder - 1 / 120);
      predictLocalMovement(peer, held, openMap, 1);
      predictLocalMovement(camera, held, openMap, 1, [peer]);
    }
    const source = present(camera, held, openMap, remainder, predictLocalMovement, [peer]);
    for (const vx of [-5.4, 5.4]) {
      const stale = { ...peer, x: source.x + .5, z: source.z, vx };
      const view = resolvePresentationContacts([source, stale], openMap, { anchorId: 0, authoritativePlayers: [camera, peer] });
      assert.deepEqual(view[0], source, 'the displayed camera follows only real prediction and its sub-tick sweep'); legal(view, openMap);
      assert.equal(view[1].vx, vx);
    }
  }
});

test('anchor resolution retains stable IDs, deaths, vertical separation and all inventory fields', () => {
  const camera = player(0, { hp: 90, ammo: 8, potions: 0 }), peer = player(1, { x: .5, hp: 30, ammo: 2, grenades: 0 });
  const authority = [camera, { ...peer, x: 1 }], inputs = [camera, peer], before = structuredClone(inputs);
  const first = resolvePresentationContacts(inputs, openMap, { anchorId: 0, authoritativePlayers: authority });
  const reversed = resolvePresentationContacts([...inputs].reverse(), openMap, { anchorId: 0, authoritativePlayers: [...authority].reverse() }).reverse();
  assert.deepEqual(first, reversed); assert.deepEqual(inputs, before);
  for (const patch of [{ alive: false }, { y: 2 }]) {
    const separate = [camera, { ...peer, ...patch }];
    assert.deepEqual(resolvePresentationContacts(separate, openMap, { anchorId: 0, authoritativePlayers: authority }), separate);
  }
  const dead = [{ ...camera, alive: false }, peer];
  assert.deepEqual(resolvePresentationContacts(dead, openMap, { anchorId: 0, authoritativePlayers: authority }), dead);
  assert.equal(first[0].hp, 90); assert.equal(first[0].ammo, 8); assert.equal(first[1].hp, 30); assert.equal(first[1].grenades, 0);
});

test('missing or illegal authority context preserves the original collision-safe crowd behavior', () => {
  const sources = [player(0), player(1, { x: .5 })], original = resolvePresentationContacts(sources, openMap);
  assert.deepEqual(resolvePresentationContacts(sources, openMap, { anchorId: 0 }), original);
  assert.deepEqual(resolvePresentationContacts(sources, openMap, { anchorId: 0, authoritativePlayers: [sources[0], { ...sources[1], x: NaN }] }), original);
  assert.deepEqual(resolvePresentationContacts(sources, openMap, { anchorId: 0, authoritativePlayers: sources }), original);
  const crowd = [...sources, player(2, { x: 1 })], badAuthority = [sources[0], player(1, { x: 2 }), player(2, { x: 2 })];
  assert.deepEqual(resolvePresentationContacts(crowd, openMap, { anchorId: 0, authoritativePlayers: badAuthority }), resolvePresentationContacts(crowd, openMap));
  legal(original, openMap);
});
