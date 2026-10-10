import assert from 'node:assert/strict';
import test from 'node:test';
import * as Horde from '../public/voxel-horde-engine.js';
import { emptyInput } from '../public/voxel-engine.js';
import { navigationCanOccupy } from '../public/voxel-navigation.js';

const office = Horde.MAPS.trading;
function pursuit(start, target, type, map = office) {
  const state = Horde.createState({ mapId: 'trading', capacity: 1, seed: 71049 });
  Horde.startMatch(state, [0]);
  while (state.phase === 'countdown') Horde.step(state);
  state.map = map; state.horde.wave = type === 'gunner' ? 4 : 1;
  state.horde.pending = 1; state.horde.nextSpawnTick = 1e9;
  const human = state.players[0];
  Object.assign(human, target, { vx: 0, vy: 0, vz: 0, grounded: true, hp: 10000, maxHp: 10000 });
  human.previousInput = emptyInput(human);
  state.spawnWarnings = [{ id: ++state.horde.spawnId, ...start, y: start.y || 0, ticksLeft: 1, monsterType: type }];
  Horde.step(state);
  const monster = state.players.find(player => player.monster && player.alive);
  assert.ok(monster, 'real rift must spawn at a clear lateral approach');
  monster.emergenceTicks = 0;
  return { state, human, monster, brain: state.horde.brains[monster.id] };
}

// The particularly fast hound used to repeatedly jump sideways off these
// ordinary narrow upper treads. The actual 120 Hz controller must brake while
// centering, then resume its normal chase on the connected mezzanine.
for (const type of ['hound', 'stalker', 'gunner']) for (const route of office.routes) for (const side of [-1, 1]) {
  test(`${type}: lateral ${route.id}/${side} preserves a real route or firing opportunity to the upper player`, () => {
    const first = route.steps[0];
    const { state, human, monster, brain } = pursuit({ x: first.x + side * 3.2, y: 0, z: first.z }, { x: 19, y: 3.2, z: .95 }, type);
    let reachedUpper = false, sawStairWalk = false, sawFullChase = false;
    for (let tick = 0; tick < 4800 && human.hp === human.maxHp; tick++) {
      Horde.step(state);
      assert.ok(navigationCanOccupy(office, monster), 'controller must use the unchanged physical collision solver');
      assert.ok([monster.x, monster.y, monster.z, monster.vx, monster.vy, monster.vz].every(Number.isFinite));
      reachedUpper ||= monster.y >= 3.1;
      sawStairWalk ||= monster.previousInput.walk && monster.previousInput.jump;
      sawFullChase ||= type === 'hound' && !monster.previousInput.walk && monster.grounded && Math.hypot(monster.vx, monster.vz) > 6.7;
    }
    const pose = JSON.stringify({ x: monster.x, y: monster.y, z: monster.z, path: brain.path.slice(0, 3) });
    assert.ok(human.hp < human.maxHp, `actual upper-floor combat must remain possible: ${pose}`);
    if (type !== 'gunner') {
      assert.ok(reachedUpper && sawStairWalk, `melee must genuinely climb and bite: ${pose}`);
      if (type === 'hound') assert.ok(sawFullChase, 'hound must retain full speed away from the stair transitions');
    } else {
      assert.ok(state.events.some(event => event.type === 'damage' && event.playerId === monster.id && event.targetId === human.id && event.attack === 'gun'), 'armed movement must retain actual weapon aim and damage');
    }
  });
}

test('flat-ground pursuit retains the hound 6.8 m/s chase without enabling stair walking', () => {
  const flat = { bounds: { minX: -30, maxX: 30, minZ: -30, maxZ: 30 }, colliders: [] };
  const { state, monster } = pursuit({ x: 0, y: 0, z: 10 }, { x: 0, y: 0, z: -12 }, 'hound', flat);
  for (let tick = 0; tick < 30; tick++) {
    Horde.step(state); assert.equal(monster.previousInput.walk, false); assert.equal(monster.previousInput.jump, false);
  }
  assert.ok(Math.abs(Math.hypot(monster.vx, monster.vz) - 6.8) < 1e-6);
});

test('the armed warning retains its committed aim through the real windup and first shot', () => {
  const flat = { bounds: { minX: -30, maxX: 30, minZ: -30, maxZ: 30 }, colliders: [] };
  const { state, monster, brain } = pursuit({ x: 0, y: 0, z: 10 }, { x: 0, y: 0, z: -12 }, 'gunner', flat);
  let warning = null, shot = null;
  for (let tick = 0; tick < 600 && !shot; tick++) {
    Horde.step(state);
    warning ||= state.events.find(event => event.type === 'monsterAim' && event.playerId === monster.id);
    if (warning) { assert.equal(brain.attackYaw, warning.yaw); assert.equal(brain.attackPitch, warning.pitch); }
    shot = state.events.find(event => event.type === 'shot' && event.playerId === monster.id);
  }
  assert.ok(warning && shot, 'gunner must complete its normal telegraph and actual shot');
  assert.ok(shot.tick - warning.tick >= Horde.MONSTER_TYPES.gunner.windup);
  assert.ok(Math.abs(monster.previousInput.yaw - warning.yaw) < 1e-8);
  assert.ok(Math.abs(monster.previousInput.pitch - warning.pitch) < 1e-8);
  assert.ok(monster.shots > 0 && monster.ammo < Horde.WEAPONS[monster.weapon].magazine, 'telegraph releases a real ammunition-consuming shot; its normal spread can still miss');
});
