import assert from 'node:assert/strict';
import test from 'node:test';
import { combatStep, createCombatPlayer, emptyInput } from '../public/voxel-engine.js';
import { setInventoryMeleeLoadout } from '../public/voxel-inventory.js';
import { MELEE_IDS, MELEE_COMBO_WINDOW_TICKS, meleeComboLength, meleeProfile, meleeSlashGeometry, meleeSlashPhase } from '../public/voxel-melee.js';
import { meleeActionReadout } from '../public/voxel-fps-feedback.js';
import { createSlashImpactPresenter } from '../public/voxel-slash-effects.js';
import { meleeMeshes, meleeMotion, meleeTrailMeshes, meleeTrailPath, meleeWorldPose, VoxelRenderer } from '../public/voxel-renderer.js';

const map = { id: 'combo-feedback-arena', theme: 'forest', bounds: { minX: -5, maxX: 5, minZ: -5, maxZ: 5 },
  colliders: [{ x: -4, y: 0, z: -2, w: 8, h: 3, d: .1 }], sites: [] };
const points = mesh => Array.from({ length: mesh.length / 10 }, (_, index) => [...mesh.slice(index * 10, index * 10 + 3)]);
const close = (a, b, label, tolerance = 1e-6) => assert.ok(Math.abs(a - b) <= tolerance, `${label}: ${a} != ${b}`);
const axis = pose => [Math.sin(pose.yaw) * Math.cos(pose.pitch), Math.sin(pose.pitch), -Math.cos(pose.yaw) * Math.cos(pose.pitch)];

/** Real presses, real HP loss and normal recovery create the sampled chain. */
function fight(weapon = 'sword', { miss = false } = {}) {
  const source = { ...createCombatPlayer(0), human: true, lifeId: 1 }, target = { ...createCombatPlayer(1), lifeId: 2, x: miss ? 4 : 0, z: -1.3, hp: 10000, maxHp: 10000 };
  setInventoryMeleeLoadout(source, weapon, { equip: true });
  const state = { gameId: 'voxel-horde', phase: 'fight', tick: 0, round: 1, players: [source, target], map, events: [], eventId: 0, grenades: [], bolts: [], loot: [] };
  const contacts = [], poses = [];
  const step = fire => {
    const previous = state.eventId;
    state.tick++;
    combatStep(state, state.players.map(player => ({ ...emptyInput(player), fire: player.id === 0 && fire })), map);
    for (const event of state.events.filter(event => event.id > previous && event.type === 'meleeHit')) contacts.push({ event: structuredClone(event), state: structuredClone(state) });
  };
  const attack = () => {
    step(true);
    const startup = meleeActionReadout(source);
    while (source.meleeTicks && meleeSlashPhase(source).phase !== 'active') step(false);
    const active = structuredClone(source); poses.push(active);
    while (source.meleeTicks) step(false);
    return { startup, active, idle: meleeActionReadout(source) };
  };
  return { state, source, target, contacts, poses, step, attack };
}

function activeSample(player, progress = .6) {
  const profile = meleeProfile(player);
  return { ...player, meleeTicks: profile.recoveryTicks + profile.activeTicks * (1 - progress), meleePhase: 'active' };
}

function harness() {
  const calls = { creates: 0, allocations: 0 };
  const gl = new Proxy({}, { get(_target, name) {
    if (name === 'getShaderParameter' || name === 'getProgramParameter') return () => true;
    if (name === 'getAttribLocation') return () => 0;
    if (name === 'getUniformLocation') return (_program, uniform) => uniform;
    if (name === 'createBuffer') return () => { calls.creates++; return {}; };
    if (name === 'bufferData') return () => { calls.allocations++; };
    if (typeof name === 'string' && name.startsWith('create')) return () => ({});
    return () => {};
  } });
  const canvas = { getContext: () => gl, addEventListener() {}, removeEventListener() {}, getBoundingClientRect: () => ({ width: 960, height: 540 }) };
  return { renderer: new VoxelRenderer(canvas), calls };
}

test('each real confirmed chain uses the existing compact readout and advertises only its real follow-up window', () => {
  for (const weapon of MELEE_IDS) {
    const trial = fight(weapon), length = meleeComboLength(weapon);
    for (let step = 1; step <= length; step++) {
      const sample = trial.attack(), finisher = step === length;
      assert.match(sample.startup.status, new RegExp(`^${finisher ? 'FINISHER' : weapon === 'knife' ? 'STAB' : 'CUT'} ${step}/${length} ·`));
      const active = meleeActionReadout(sample.active);
      assert.equal(active.ammo, finisher ? 'FINISHER' : 'STRIKE');
      assert.equal(trial.source.meleeComboConfirmed, true);
      if (finisher) {
        assert.equal(sample.idle.state, 'ready'); assert.equal(sample.idle.progress, null);
      } else {
        assert.equal(sample.idle.state, 'combo'); assert.equal(sample.idle.progress.total, MELEE_COMBO_WINDOW_TICKS);
        assert.equal(sample.idle.progress.remaining, MELEE_COMBO_WINDOW_TICKS);
        assert.match(sample.idle.status, new RegExp(`CLICK FOR ${step + 1 === length ? 'FINISHER' : weapon === 'knife' ? 'STAB' : 'CUT'} ${step + 1}/${length}$`));
      }
    }
    assert.equal(trial.contacts.length, length);
    assert.deepEqual(trial.contacts.map(({ event }) => event.comboStep), Array.from({ length }, (_, index) => index + 1));
  }
});

test('whiffs, expired confirmations and stale wrong-item metadata never advertise a chain', () => {
  const miss = fight('sword', { miss: true }); miss.attack();
  assert.equal(miss.source.meleeComboConfirmed, false); assert.equal(meleeActionReadout(miss.source).state, 'ready');
  const trial = fight(); trial.attack();
  const confirmed = structuredClone(trial.source), before = structuredClone(confirmed);
  for (const patch of [{ meleeComboConfirmed: false }, { meleeComboWindowTicks: 0 }, { meleeComboWindowTicks: NaN },
    { meleeComboWindowTicks: MELEE_COMBO_WINDOW_TICKS + 1 }, { meleeComboStep: 99 }, { meleeComboWeapon: 'katana' },
    { inventoryIndex: 1 }, { inventory: undefined }, { meleeAction: 'secondary' }, { triggerBlocked: true }, { monster: true }]) {
    assert.notEqual(meleeActionReadout({ ...confirmed, ...patch })?.state, 'combo', JSON.stringify(patch));
  }
  for (let tick = 0; tick < MELEE_COMBO_WINDOW_TICKS; tick++) trial.step(false);
  assert.equal(meleeActionReadout(trial.source).state, 'ready');
  assert.deepEqual(confirmed, before, 'readouts leave accepted timing intact');
});

test('accepted recovery differentiates a confirmed combo queue from another fresh miss', () => {
  for (const miss of [false, true]) {
    const trial = fight('katana', { miss }); trial.step(true);
    while (trial.source.meleeTicks > 5) trial.step(false);
    const unqueued = meleeActionReadout(trial.source);
    assert.equal(/CLICK TO CHAIN/.test(unqueued.status), !miss);
    trial.step(true);
    assert.match(meleeActionReadout(trial.source).status, miss ? /NEXT STRIKE QUEUED$/ : /COMBO QUEUED$/);
    assert.equal(trial.source.meleeComboStep, 1, 'queued intent is not an accepted second cut');
  }
});

test('alternating cuts and finishers keep first-person, world blade and ribbon on the actual shared finite path', () => {
  for (const weapon of MELEE_IDS) {
    const trial = fight(weapon);
    for (let step = 1; step <= meleeComboLength(weapon); step++) trial.attack();
    for (const accepted of trial.poses) for (const progress of [.15, .5, .75]) {
      const player = activeSample(accepted, progress), before = structuredClone(player), profile = meleeProfile(player), phase = meleeSlashPhase(player);
      const motion = meleeMotion(player), pose = meleeWorldPose(player), geometry = meleeSlashGeometry(player, { from: phase.progress, to: phase.progress }), sample = geometry.samples[0];
      assert.equal(motion.comboStep, player.meleeComboStep); assert.equal(motion.comboFinisher, profile.comboFinisher); assert.equal(motion.slashDirection, profile.slashDirection);
      axis(pose).forEach((value, index) => close(value, [sample.direction.x, sample.direction.y, sample.direction.z][index], `${weapon} step${profile.comboStep} locked axis`));
      const projected = points(meleeMeshes(player, pose, { hand: player.meleeHand })).map(point => point.reduce((sum, value, index) => sum + (value - [geometry.origin.x, geometry.origin.y, geometry.origin.z][index]) * axis(pose)[index], 0));
      close(Math.max(...projected), geometry.reach - geometry.radius, 'visible blade tip matches finite contact end', .00002);
      const path = meleeTrailPath(player), shared = meleeSlashGeometry(player, { from: path.from, to: path.to });
      assert.equal(path.comboFinisher, profile.comboFinisher);
      path.samples.forEach((tip, index) => tip.outer.forEach((value, axis) => close(value, [shared.samples[index].outer.x, shared.samples[index].outer.y, shared.samples[index].outer.z][axis], 'actual ribbon tip')));
      const receiver = { lastAim: null, swayX: 0, swayY: 0 };
      VoxelRenderer.prototype._viewModel.call(receiver, player, 0, 0, 1000);
      assert.equal(receiver.meleePose.comboStep, player.meleeComboStep); assert.equal(receiver.meleePose.slashDirection, profile.slashDirection);
      assert.deepEqual(player, before, 'presentation never advances or steers the accepted attack');
    }
    if (weapon !== 'knife') {
      const first = meleeMotion(activeSample(trial.poses[0], .2)), second = meleeMotion(activeSample(trial.poses[1], .2));
      assert.ok(first.yaw * second.yaw < 0, `${weapon} reverses its second cut`);
    }
  }
});

test('the golden finisher stays finite, cover-clipped and softer in reduced-motion mode without adding geometry', () => {
  const wall = { x: -4, y: 0, z: -.90, w: 8, h: 3, d: .02 };
  for (const weapon of MELEE_IDS) {
    const trial = fight(weapon); for (let step = 0; step < meleeComboLength(weapon); step++) trial.attack();
    const first = activeSample(trial.poses[0]), finish = activeSample(trial.poses.at(-1));
    const mesh = meleeTrailMeshes(finish), reduced = meleeTrailMeshes(finish, [], [0, 1.62, 0], { reducedMotion: true });
    assert.equal(mesh.length, reduced.length); assert.equal(mesh.length, meleeTrailMeshes(first).length);
    assert.ok(mesh.every(Number.isFinite)); assert.ok(mesh.length / 10 <= 48 * 18);
    assert.equal(mesh[6], 1); assert.ok(mesh[7] >= .79 && mesh[8] <= .37, 'the real final cut has a warm gold accent');
    const covered = meleeTrailMeshes(finish, [wall]);
    assert.ok(covered.length > 0); assert.ok(points(covered).every(([, , z]) => z > -.88), 'no finisher flourish crosses solid cover');
    const origin = meleeTrailPath(finish).origin;
    assert.ok(points(mesh).every(point => Math.hypot(...point.map((value, axis) => value - origin[axis])) <= meleeProfile(finish).reach + .04));
    assert.equal(meleeTrailPath({ ...finish, monsterType: 'stalker', monster: true }), null, 'monsters never receive human combo ribbons');
  }
});

test('only an authority-confirmed final contact gets one modest gold burst; repeats and reduced motion remain silent', () => {
  const trial = fight(); for (let step = 0; step < meleeComboLength('sword'); step++) trial.attack();
  const first = trial.contacts[0], last = trial.contacts.at(-1), present = createSlashImpactPresenter();
  const ordinary = present(first.event, first.state, 1000), finish = present(last.event, last.state, 1100);
  assert.equal(ordinary.length, 6); assert.equal(finish.length, 6); assert.ok(ordinary.every(particle => !particle.comboFinisher));
  assert.ok(finish.every(particle => particle.comboFinisher && particle.cover && particle.radius === .34 && particle.life < 200 && particle.size <= .014));
  assert.equal(finish[2].color, '#ffd872'); assert.ok(finish[2].size > ordinary[2].size);
  assert.equal(present(last.event, last.state, 1100).length, 0);
  assert.ok(createSlashImpactPresenter()({ ...first.event, comboFinisher: true }, first.state, 1000).every(particle => !particle.comboFinisher), 'an early cut cannot manufacture the final accent');
  const muted = createSlashImpactPresenter(); assert.equal(muted(last.event, last.state, 1100, { reducedMotion: true }).length, 0);
  assert.equal(muted(last.event, last.state, 1100).length, 0, 'changing motion preference cannot replay an already-consumed contact');
});

test('frozen accepted finisher renders identically at 60/144/240 Hz using the same bounded GPU buffers', () => {
  const trial = fight('katana'); for (let step = 0; step < meleeComboLength('katana'); step++) trial.attack();
  const player = activeSample(trial.poses.at(-1)), scene = { ...trial.state, players: [player], events: [] }, before = structuredClone(scene);
  let expected;
  for (const hz of [60, 144, 240]) {
    const { renderer, calls } = harness(), storage = renderer.frameMeshes.tracer.storage.buffer;
    renderer.render(scene, { localId: 0, time: 1000 });
    const creates = calls.creates, allocations = calls.allocations;
    for (let frame = 0; frame < hz / 4; frame++) {
      renderer.render(scene, { localId: 0, time: 1000 + frame * 1000 / hz });
      assert.equal(renderer.frameMeshes.tracer.storage.buffer, storage); assert.ok(renderer.stats.drawCalls <= 7);
    }
    const mesh = [...renderer.frameMeshes.tracer.array];
    if (expected) assert.deepEqual(mesh, expected); else expected = mesh;
    assert.equal(calls.creates, creates); assert.equal(calls.allocations, allocations);
    assert.equal(renderer.stats.firstPerson.melee.comboFinisher, true);
    assert.deepEqual(scene, before); renderer.destroy();
  }
});
