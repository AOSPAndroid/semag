import assert from 'node:assert/strict';
import test from 'node:test';
import { createState, createCombatPlayer, combatStep, emptyInput } from '../public/voxel-engine.js';
import { MELEE, KNIFE } from '../public/voxel-melee.js';
import { meleeMeshes, meleeMotion, particlePosition, VoxelRenderer } from '../public/voxel-renderer.js';

const arena = { id: 'combat-art-fixture', colliders: [], bounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 } };
function combatFixture(weapon = 'carbine', patch = {}, colliders = [], pitch = -.075) {
  const state = createState();
  Object.assign(state, { map: { ...arena, colliders }, phase: 'fight', tick: 0, events: [] });
  state.players = [{ ...createCombatPlayer(0, 1, weapon), z: 3 }, { ...createCombatPlayer(1), z: -3, ...patch }];
  for (let tick = 0; tick < 25; tick++) {
    state.tick++;
    combatStep(state, state.players.map(player => ({ ...emptyInput({ yaw: 0, pitch }), fire: player.id === 0 && tick === 0 })), state.map);
    if (state.events.some(event => event.type === 'damage' || ['shot', 'boltHit'].includes(event.type) && event.hitKind !== 'none')) break;
  }
  return state;
}
const effectRenderer = () => ({ eventIds: new Set(), eventQueue: [], particles: [], tracers: [], localShot: null });
const effects = (renderer, state, time = 1000, localId = 0) => VoxelRenderer.prototype._events.call(renderer, state, time, localId);
const blood = renderer => renderer.particles.filter(particle => particle.material === 'blood');
const vertices = mesh => Array.from({ length: mesh.length / 10 }, (_, index) => Array.from(mesh.slice(index * 10, index * 10 + 3)));

test('actual gun and flying-bolt HP loss emits one short blood burst at the confirmed contact for every viewer', () => {
  for (const weapon of ['carbine', 'crossbow']) {
    const state = combatFixture(weapon), damage = state.events.find(event => event.type === 'damage');
    assert.ok(damage?.damage > 0, `${weapon}: actual authoritative damage`);
    assert.equal(state.players[1].hp, state.players[1].maxHp - damage.damage);
    for (const localId of [0, 1, 2]) {
      const renderer = effectRenderer();
      effects(renderer, state, 1000, localId);
      assert.ok(blood(renderer).length >= 4 && blood(renderer).length <= 8);
      for (const particle of blood(renderer)) {
        assert.ok(Math.hypot(...particle.origin.map((value, axis) => value - [damage.hitX, damage.hitY, damage.hitZ][axis])) < .046);
        assert.ok(particle.cover && particle.shrink && particle.gravity > 0 && particle.radius <= .72);
        assert.ok(particle.life <= 316, 'restrained burst clears the sight line quickly');
        const start = particlePosition(particle, 1000), late = particlePosition(particle, 1200);
        assert.ok(late.size < start.size && late.fade < start.fade, 'voxel pieces shrink as they fade');
        assert.ok(late.point.every(Number.isFinite));
      }
      const count = blood(renderer).length;
      effects(renderer, state, 1001, localId);
      assert.equal(blood(renderer).length, count, 'repeated contact and damage snapshots do not duplicate blood');
      effects(renderer, { ...state, events: [] }, 1400, localId);
      assert.equal(blood(renderer).length, 0);
    }
  }
});

function renderHarness() {
  const gl = new Proxy({}, { get(_, name) {
    if (name === 'getShaderParameter' || name === 'getProgramParameter') return () => true;
    if (name === 'getAttribLocation') return () => 0;
    if (name === 'getUniformLocation') return (_program, uniform) => uniform;
    if (typeof name === 'string' && name.startsWith('create')) return () => ({});
    return () => {};
  } });
  const canvas = { getContext: () => gl, addEventListener() {}, removeEventListener() {}, getBoundingClientRect: () => ({ width: 960, height: 540 }) };
  const renderer = new VoxelRenderer(canvas), world = [];
  const upload = renderer._dynamic;
  renderer._dynamic = function(array, kind = 'world') { if (kind === 'world') world.push(array); return upload.call(this, array, kind); };
  return { renderer, world };
}

test('actual head-hit blood and contact cubes never draw over the victim or watched victim, while other observers retain the burst', () => {
  for (const weapon of ['carbine', 'crossbow']) {
    const state = combatFixture(weapon, {}, [], 0), damage = state.events.find(event => event.type === 'damage');
    assert.equal(damage.hitKind, 'head', `${weapon}: actual head contact near the victim's camera`);
    state.players.push({ ...createCombatPlayer(2), team: 2, x: 5, z: 0 });
    for (const options of [{ localId: 1 }, { localId: 99, viewPlayer: 1 }, { localId: 0 }, { localId: 2 }, { localId: 99, viewPlayer: 0 }]) {
      const { renderer, world } = renderHarness(), watchingVictim = options.viewPlayer === 1 || options.localId === 1;
      renderer.render({ ...state, events: [] }, { ...options, time: 1000, hideWeapon: true });
      const baseline = world.at(-1);
      renderer.render(state, { ...options, time: 1000, hideWeapon: true });
      const hit = world.at(-1);
      assert.ok(blood(renderer).length > 0, 'confirmed burst remains available for other observers');
      assert.ok(renderer.particles.every(particle => particle.targetId === 1), 'both blood and ordinary head-contact fragments identify their victim');
      if (watchingVictim) {
        assert.deepEqual(hit, baseline, 'neither red blood nor beige contact cubes are uploaded in the victim camera');
        assert.equal(renderer.stats.visibleBloodParticles, 0);
      } else {
        assert.equal(hit.length - baseline.length, renderer.particles.length * 36 * 10, 'other cameras still draw every ordinary and confirmed blood voxel');
        assert.equal(renderer.stats.visibleBloodParticles, blood(renderer).length);
      }
      assert.ok(renderer.stats.drawCalls <= 7);
      assert.ok(renderer.particles.length <= 84);
      renderer.destroy();
    }
  }
});

test('wall contacts, allied blockers, unconfirmed reports and storm damage never produce gun blood', () => {
  const wall = { id: 'cover', material: 'metal', x: -2, y: 0, z: -.1, w: 4, h: 3, d: .2 };
  for (const state of [combatFixture('carbine', {}, [wall]), combatFixture('carbine', { team: 0 }), combatFixture('crossbow', {}, [wall]), combatFixture('crossbow', { team: 0 })]) {
    assert.equal(state.players[1].hp, state.players[1].maxHp);
    const renderer = effectRenderer(); effects(renderer, state);
    assert.equal(blood(renderer).length, 0);
    assert.ok(renderer.particles.length > 0, 'honest material contacts remain visible');
  }
  const actual = combatFixture(), renderer = effectRenderer();
  effects(renderer, { ...actual, events: actual.events.filter(event => event.type !== 'damage') });
  assert.equal(blood(renderer).length, 0, 'a damaging shot report still needs confirmed HP loss');
  effects(renderer, { ...actual, events: [{ id: 100, tick: actual.tick, type: 'damage', attack: 'storm', targetId: 1, damage: 10, x: 0, y: 1.6, z: -3 }] });
  assert.equal(blood(renderer).length, 0);
});

test('lethal shotgun pellets create blood only for the HP actually lost, without corpse or zero-damage bursts', () => {
  const state = combatFixture('shotgun', { hp: 1 }), confirmed = state.events.filter(event => event.type === 'damage');
  assert.ok(state.events.filter(event => event.type === 'shot' && event.damage > 0).length > 1, 'multiple collision pellets arrived');
  assert.equal(confirmed.length, 1, 'only one pellet could remove the last HP');
  assert.equal(confirmed[0].damage, 1);
  const renderer = effectRenderer(); effects(renderer, state);
  assert.equal(blood(renderer).length, 4, 'one small confirmed burst, despite several speculative contacts');
  const zero = { ...confirmed[0], id: 100, damage: 0 };
  effects(renderer, { ...state, events: [zero] }, 1001);
  assert.equal(blood(renderer).length, 4);
});

test('a ten-player sustained confirmed volley stays within the shared effect pool', () => {
  const state = combatFixture(), template = state.events.find(event => event.type === 'damage');
  const renderer = effectRenderer();
  effects(renderer, { ...state, gameId: 'voxel-royale', events: Array.from({ length: 150 }, (_, id) => ({ ...template, id: id + 100, playerId: id % 10, targetId: (id + 1) % 10 })) });
  assert.equal(renderer.particles.length, 84);
  assert.equal(blood(renderer).length, 84);
  effects(renderer, { ...state, events: [] }, 1400);
  assert.equal(renderer.particles.length, 0);
});

test('round resets clear confirmed blood and setup snapshots cannot recreate it', () => {
  const state = combatFixture(), renderer = effectRenderer();
  effects(renderer, state);
  assert.ok(blood(renderer).length > 0);
  VoxelRenderer.prototype.resetEffects.call(renderer);
  assert.equal(blood(renderer).length, 0);
  effects(renderer, { ...state, phase: 'buy' });
  assert.equal(blood(renderer).length, 0);
  assert.equal(renderer.tracers.length, 0);
});

test('short knives and long swords have distinct finite clipped first and third person geometry', () => {
  const player = { ...createCombatPlayer(0), slot: 'sword', meleeWeapon: 'sword' };
  const sword = meleeMeshes(player), knife = meleeMeshes({ ...player, meleeWeapon: 'knife' });
  const reach = mesh => -Math.min(...vertices(mesh).map(([, , z]) => z));
  assert.ok(reach(sword) > 1.1 && reach(knife) < .48);
  assert.ok(knife.length < sword.length, 'starter knife is a small distinct model');
  for (const meleeWeapon of ['sword', 'knife']) {
    const p = { ...player, meleeWeapon }, profile = meleeWeapon === 'knife' ? KNIFE : MELEE;
    for (const limit of [0, .05, .18, .4]) {
      const mesh = meleeMeshes(p, {}, { limit });
      assert.ok(mesh.every(Number.isFinite));
      assert.ok(vertices(mesh).every(([, , z]) => z >= -limit - 1e-6), 'the blade cannot extend through its physical clipping distance');
    }
    for (const meleeTicks of [0, profile.startupTicks + profile.activeTicks + profile.recoveryTicks, profile.activeTicks + profile.recoveryTicks, profile.recoveryTicks]) {
      const model = VoxelRenderer.prototype._viewModel.call({ lastAim: null, swayX: 0, swayY: 0 }, { ...p, meleeTicks }, 0, 0, 1000);
      assert.ok(model.every(Number.isFinite));
      assert.ok(model.length / 10 < (meleeWeapon === 'knife' ? 1000 : 1800), 'two-handed sword grips fit the bounded first-person mesh');
    }
    const wall = { ...arena, colliders: [{ x: -2, y: 0, z: -.95, w: 4, h: 3, d: .2 }] };
    const clipped = VoxelRenderer.prototype._viewModel.call({ lastAim: null, swayX: 0, swayY: 0 }, p, 0, 0, 1000, false, wall);
    assert.ok(vertices(clipped).every(([, , z]) => z >= -.75), `${meleeWeapon}: first-person blade stops before the real wall`);
  }
});

test('melee presentation follows each weapon’s actual committed startup, active and recovery timing', () => {
  for (const [meleeWeapon, profile] of [['sword', MELEE], ['knife', KNIFE]]) {
    const total = profile.startupTicks + profile.activeTicks + profile.recoveryTicks;
    assert.equal(meleeMotion({ meleeWeapon, meleeTicks: total }).active, false);
    assert.equal(meleeMotion({ meleeWeapon, meleeTicks: profile.activeTicks + profile.recoveryTicks + 1 }).active, false);
    assert.equal(meleeMotion({ meleeWeapon, meleeTicks: profile.activeTicks + profile.recoveryTicks }).active, true);
    assert.equal(meleeMotion({ meleeWeapon, meleeTicks: profile.recoveryTicks + 1 }).active, true);
    assert.equal(meleeMotion({ meleeWeapon, meleeTicks: profile.recoveryTicks }).active, false);
    assert.equal(meleeMotion({ meleeWeapon, meleeTicks: 0 }).active, false);
  }
});
