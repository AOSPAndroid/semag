import assert from 'node:assert/strict';
import test from 'node:test';
import { createTradingMap } from '../public/voxel-trading-map.js';
import { WORLD, WEAPONS, createCombatPlayer, emptyInput, predictLocalMovement, traceShot } from '../public/voxel-engine.js';
import { navigationCanOccupy, navigationPath } from '../public/voxel-navigation.js';
import { MONSTER_BODIES } from '../public/voxel-monster-bodies.js';

const EPS = 1e-6;
const heavy = Object.values(WEAPONS).reduce((slow, weapon) => weapon.speed < slow.speed ? weapon : slow);
const solid = (map, id) => {
  const collider = map.colliders.find(value => value.id === id);
  assert.ok(collider, `missing shown solid ${id}`);
  return collider;
};
const shoot = (map, x, y, z, distance = 2.5) => traceShot({ map, players: [] }, -1, { x, y, z }, { x: 0, y: 0, z: -1 }, distance);

function walk(map, start, target, monster = false) {
  const actor = monster ? { monster: true, human: false, monsterType: 'hound', radius: MONSTER_BODIES.hound.radius } : {};
  const player = Object.assign(createCombatPlayer(99, 1, heavy.id), actor, start, { grounded: true, vx: 0, vy: 0, vz: 0 });
  player.previousInput = emptyInput(player);
  const path = navigationPath(map, player, target);
  assert.ok(path.length && path.every(point => point.y === 3.2 && !point.jump), 'a standing same-floor route exists');
  let waypoint = 0;
  for (let tick = 0; tick < 3000 && waypoint < path.length; tick++) {
    const next = path[waypoint], dx = next.x - player.x, dz = next.z - player.z, gap = Math.hypot(dx, dz);
    if (gap < .18 && player.grounded) { waypoint++; continue; }
    predictLocalMovement(player, { ...emptyInput(player), up: gap > .08, walk: true, yaw: Math.atan2(dx, -dz) }, map);
    assert.ok(navigationCanOccupy(map, player), 'real swept body never enters a workstation');
    assert.ok(Math.abs(player.y - 3.2) < EPS && player.grounded, 'real feet retain second-floor support');
  }
  assert.equal(waypoint, path.length, 'armed players and hounds can traverse the actual desk aisle');
  assert.ok(Math.hypot(target.x - player.x, target.z - player.z) < .22);
}

for (const mode of ['breach', 'royale']) {
  const map = createTradingMap(mode), benches = map.landmarks.filter(value => value.kind === 'trading-workstation');

  test(`${mode}/trading: upper floor has three complete open benches and six real dual-screen PC terminals`, () => {
    assert.equal(benches.length, 3);
    assert.equal(new Set(benches.map(value => value.label)).size, 3, 'distinct trading sectors');
    assert.ok(map.colliders.length <= 180, 'the original collision budget is retained');
    assert.equal(new Set(map.colliders.map(value => value.id)).size, map.colliders.length);
    for (const bench of benches) {
      assert.ok(Object.isFrozen(bench) && Object.isFrozen(bench.collisionIds));
      const top = solid(map, bench.tabletopId);
      assert.equal(top.material, 'desk'); assert.equal(top.desktopStations, 2);
      assert.equal(top.desktopFacing, 'south'); assert.ok(Object.isFrozen(top.desktopStationOffsets));
      assert.equal(bench.monitorIds.length, 2); assert.equal(bench.computerIds.length, 2);
      assert.equal(bench.supportIds.length, 2); assert.equal(bench.chairIds.length, 3);
      for (const id of [...bench.monitorIds, ...bench.computerIds]) {
        const piece = solid(map, id);
        assert.ok(Math.abs(piece.y - (top.y + top.h)) < EPS, 'equipment rests on the real tabletop');
        assert.ok(piece.x >= top.x && piece.x + piece.w <= top.x + top.w + EPS
          && piece.z >= top.z && piece.z + piece.d <= top.z + top.d + EPS, 'equipment fits its desk');
        assert.ok(navigationCanOccupy(map, { x: piece.x + piece.w / 2, y: 0, z: piece.z + piece.d / 2 }),
          'upper equipment does not create invisible ground-floor cover');
      }
      for (const [station, id] of bench.monitorIds.entries()) {
        const monitor = solid(map, id);
        assert.equal(monitor.material, 'screen'); assert.equal(monitor.screenProfile, 'trading-terminal'); assert.equal(monitor.screens, 2);
        assert.ok(Math.abs(top.x + top.desktopStationOffsets[station] - (monitor.x + monitor.w / 2)) < EPS,
          'keyboard positions line up with the real terminal displays');
      }
      for (const id of bench.computerIds) assert.equal(solid(map, id).material, 'office-pc');
      assert.ok(!map.colliders.some(value => value.id.startsWith(bench.id) && /-(west|east|front-west|front-east)$/.test(value.id)),
        'booth partitions no longer fence off the shared trading floor');
    }
    const sign = map.decorations.find(value => value.colliderId === 'trading-upper-office-0-back');
    const wall = solid(map, sign.colliderId), riskMonitors = benches[0].monitorIds.map(id => solid(map, id));
    assert.ok(wall.y + sign.bottom > Math.max(...riskMonitors.map(value => value.y + value.h)),
      'the complete upper Barclays sign clears the monitor tops');
    assert.ok(sign.bottom + sign.h <= wall.h, 'the sign remains on its actual backing wall');
  });

  test(`${mode}/trading: individual upper monitors and desktop towers stop actual shots at their shown faces`, () => {
    for (const bench of benches) for (const id of [...bench.monitorIds, ...bench.computerIds]) {
      const piece = solid(map, id), height = piece.material === 'screen' ? 3.2 + WORLD.eyeHeight : piece.y + piece.h / 2;
      const hit = shoot(map, piece.x + piece.w / 2, height, bench.z + bench.d + .6);
      assert.equal(hit.colliderId, id, `${id}: displayed equipment is the first real shot contact`);
      assert.ok(Math.abs(hit.z - (piece.z + piece.d)) < EPS, 'visible front and authoritative contact coincide');
      assert.equal(navigationCanOccupy(map, { x: piece.x + piece.w / 2, y: 3.2, z: piece.z + piece.d / 2 }), false,
        'standing bodies cannot cross a displayed monitor or tower');
    }
  });

  test(`${mode}/trading: table undersides and gaps between individual monitors remain honest shot lanes`, () => {
    for (const bench of benches) {
      const top = solid(map, bench.tabletopId), left = solid(map, bench.monitorIds[0]), right = solid(map, bench.monitorIds[1]);
      const gapX = (left.x + left.w + right.x) / 2, frontZ = top.z + top.d + .6;
      assert.equal(shoot(map, gapX, 3.5, frontZ).kind, 'none', 'drawers and chair do not fill the open underside');
      assert.equal(shoot(map, gapX, top.y + top.h / 2, frontZ).colliderId, top.id, 'the actual thin tabletop is solid');
      assert.equal(shoot(map, gapX, 3.2 + WORLD.eyeHeight, frontZ).kind, 'none', 'the physical monitor separation admits a bullet');
      for (const id of bench.supportIds) {
        const drawer = solid(map, id);
        assert.equal(shoot(map, drawer.x + drawer.w / 2, drawer.y + drawer.h / 2, frontZ).colliderId, id,
          'real drawer pedestals provide their visible low cover');
      }
    }
  });

  test(`${mode}/trading: heavy humans and hounds can walk the shared upper aisle and reach both terminal positions`, () => {
    for (const monster of [false, true]) {
      walk(map, { x: -14, y: 3.2, z: -11.3 }, { x: 14.8, y: 3.2, z: -11.3 }, monster);
      for (const bench of benches) for (const id of bench.monitorIds) {
        const screen = solid(map, id), terminal = { x: screen.x + screen.w / 2, y: 3.2, z: -12.3 };
        walk(map, { x: terminal.x, y: 3.2, z: -10.2 }, terminal, monster);
      }
    }
  });
}
