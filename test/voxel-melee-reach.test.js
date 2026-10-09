import assert from 'node:assert/strict';
import test from 'node:test';
import { combatStep, createCombatPlayer, emptyInput } from '../public/voxel-engine.js';
import { meleeProfile, meleeSlashGeometry, meleeSlashOrigin } from '../public/voxel-melee.js';
import { setInventoryMeleeLoadout } from '../public/voxel-inventory.js';

const arena = { id: 'blade-reach-fixture', bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 }, colliders: [], sites: [] };
// These gaps were genuine misses with the previous physical blade lengths.
const gaps = [
  { weapon: 'sword', distance: 3.2, damage: 100 },
  { weapon: 'katana', distance: 3.2, damage: 75 },
  { weapon: 'axe', distance: 3, damage: 140 },
  { weapon: 'knife', distance: 1.8, damage: 28 },
  { weapon: 'knife', action: 'secondary', distance: 2.1, damage: 60 },
  { weapon: 'tonfas', distance: 2.1, damage: 42 },
];
function actor(id, fields = {}) { return Object.assign(createCombatPlayer(id), { lifeId: 1, x: 15, z: 15, ...fields }); }
function fixture(spec, { yaw = 0, pitch = 0, crouching = false, targetCrouching = false, map = arena, gameId = 'voxel-breach', targets } = {}) {
  const attacker = actor(0, { x: 0, z: 0, yaw, pitch, crouching, human: true });
  setInventoryMeleeLoadout(attacker, spec.weapon, { equip: true });
  targets ||= [actor(1, { x: Math.sin(yaw) * spec.distance, z: -Math.cos(yaw) * spec.distance, crouching: targetCrouching })];
  const players = [attacker];
  for (const target of targets) players[target.id] = target;
  for (let id = 0; id < players.length; id++) players[id] ||= actor(id, { alive: false });
  const stances = players.map(player => player.crouching);
  const state = { gameId, phase: 'fight', tick: 0, eventId: 0, events: [], players, fighters: players, map, grenades: [], bolts: [], loot: [] };
  return { attacker, targets, state, stances, profile: meleeProfile({ ...attacker, meleeAction: spec.action || 'primary' }) };
}
function step(setup, commands = {}, count = 1) {
  for (let tick = 0; tick < count; tick++) {
    setup.state.tick++;
    combatStep(setup.state, setup.state.players.map(player => ({ ...emptyInput(player), crouch: setup.stances[player.id], ...commands[player.id] })), setup.state.map);
  }
}
function cut(setup, spec, { held = false } = {}) {
  const command = spec.action === 'secondary' ? { aim: true } : { fire: true };
  step(setup, { 0: command });
  const { startupTicks, activeTicks, recoveryTicks } = setup.profile;
  step(setup, held ? { 0: command } : {}, startupTicks + activeTicks + recoveryTicks + 1);
}
const damageEvents = setup => setup.state.events.filter(event => event.type === 'damage');

for (const spec of gaps) test(`${spec.weapon} ${spec.action || 'primary'} connects across a small previously missed gap, with unchanged damage and one strike per press`, () => {
  const setup = fixture(spec); cut(setup, spec, { held: true });
  assert.equal(setup.targets[0].hp, 200 - spec.damage);
  assert.equal(setup.attacker.damageDealt, spec.damage);
  assert.equal(setup.attacker.meleeIndex, 1);
  assert.equal(setup.attacker.shots, 0); assert.equal(setup.attacker.ammo, 24);
  const [hit] = damageEvents(setup); assert.equal(damageEvents(setup).length, 1);
  assert.equal(hit.headshot, false); assert.equal(hit.targetLifeId, 1);
  assert.ok(hit.tick >= 1 + setup.profile.startupTicks, 'a farther contact still needs the real windup and sweep');
  const origin = meleeSlashOrigin(setup.attacker);
  assert.ok(Math.hypot(hit.hitX - origin.x, hit.hitY - origin.y, hit.hitZ - origin.z) <= setup.profile.reach + 1e-8, 'accepted flesh remains inside the finite blade length');
  assert.equal(setup.attacker.pendingMeleeTicks, 0);
  const outside = fixture({ ...spec, distance: setup.profile.reach + .6 }); cut(outside, spec);
  assert.equal(outside.targets[0].hp, 200); assert.equal(damageEvents(outside).length, 0);
});

test('the extended blade gap remains shielded by solid cover and an allied body for every primary and stab', () => {
  for (const spec of gaps) for (const blocker of ['wall', 'ally']) {
    const map = blocker === 'wall' ? { ...arena, colliders: [{ id: 'thin-solid-wall', x: -3, y: 0, z: -.9, w: 6, h: 3, d: .03 }] } : arena;
    const enemy = actor(1, { x: 0, z: -spec.distance });
    const targets = blocker === 'ally' ? [enemy, actor(2, { x: 0, z: -.9, team: 0, human: true })] : [enemy];
    const setup = fixture(spec, { map, targets }); cut(setup, spec);
    assert.ok(targets.every(target => target.hp === 200), `${spec.weapon}:${spec.action || 'primary'}:${blocker}`);
    assert.equal(damageEvents(setup).length, 0);
    assert.equal(setup.state.events.filter(event => event.type === 'meleeKnockback').length, 0);
  }
});

test('reach adds no rear, side or elevated contacts outside the actual narrow three-dimensional path', () => {
  for (const spec of gaps) for (const position of [{ x: 0, z: 1.2 }, { x: 1.3, z: 0 }, { x: 0, z: -1.2, y: 3 }]) {
    const setup = fixture(spec, { targets: [actor(1, position)] }); cut(setup, spec);
    assert.equal(setup.targets[0].hp, 200, `${spec.weapon}:${spec.action || 'primary'}:${JSON.stringify(position)}`);
    assert.equal(damageEvents(setup).length, 0);
  }
});

test('aimed extended contacts work for standing and crouching bodies without growing either silhouette', () => {
  for (const spec of gaps) for (const crouching of [false, true]) for (const targetCrouching of [false, true]) for (const yaw of [0, .7]) {
    // A crouched long downstroke is aimed slightly upward instead of into the floor.
    const setup = fixture(spec, { crouching, targetCrouching, yaw, pitch: crouching ? .12 : 0 }); cut(setup, spec);
    assert.equal(setup.targets[0].hp, 200 - spec.damage, `${spec.weapon}:${spec.action || 'primary'}:${crouching}:${targetCrouching}:${yaw}`);
    const [hit] = damageEvents(setup), height = targetCrouching ? 1.15 : 1.8;
    assert.ok(hit.hitY >= -1e-8 && hit.hitY <= height + 1e-8);
  }
});

test('a longer cut cleaves real Horde bodies once each, while competitive human bodies still shield the rear opponent', () => {
  for (const gameId of ['voxel-horde', 'voxel-breach', 'voxel-royale']) {
    const monsters = gameId === 'voxel-horde';
    const targets = [1.3, 3.2].map((distance, index) => actor(index + 1, { x: 0, z: -distance, team: 1, monster: monsters, human: !monsters, monsterType: monsters ? 'stalker' : undefined }));
    const spec = gaps[0], setup = fixture(spec, { gameId, targets }); cut(setup, spec);
    assert.equal(targets[0].hp, 100);
    assert.equal(targets[1].hp, monsters ? 100 : 200, gameId);
    assert.equal(damageEvents(setup).length, monsters ? 2 : 1);
    assert.equal(new Set(damageEvents(setup).map(event => event.targetLifeId + ':' + event.targetId)).size, monsters ? 2 : 1);
  }
});

test('the new long sword contact can still be parried by a correctly timed facing guard, with an early guard remaining vulnerable', () => {
  for (const timely of [false, true]) {
    const spec = gaps[0], setup = fixture(spec), defender = setup.targets[0];
    setInventoryMeleeLoadout(defender, 'sword', { equip: true }); defender.yaw = Math.PI;
    step(setup, { 0: { fire: true }, ...(timely ? {} : { 1: { aim: true } }) });
    if (timely) { step(setup, {}, 7); step(setup, { 1: { aim: true } }); }
    step(setup, {}, 24);
    assert.equal(defender.hp, timely ? 200 : 100);
    assert.equal(setup.state.events.filter(event => event.type === 'meleeParry').length, timely ? 1 : 0);
    assert.equal(damageEvents(setup).length, timely ? 0 : 1);
    if (timely) assert.equal(setup.state.events.some(event => event.type === 'meleeHit' || event.type === 'meleeKnockback'), false);
  }
});

test('waist-crossing long blades contact only real low hound flesh at their new gaps, respecting rotation, height, range and cover', () => {
  for (const spec of gaps.filter(spec => ['sword', 'katana', 'axe'].includes(spec.weapon))) {
    const distance = spec.weapon === 'axe' ? 2.8 : 3;
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const target = actor(1, { x: 0, z: -distance, yaw, radius: .5, monster: true, human: false, monsterType: 'hound' });
      const setup = fixture(spec, { gameId: 'voxel-horde', targets: [target] }); cut(setup, spec);
      assert.equal(target.hp, 200 - spec.damage, `${spec.weapon}:${yaw}`);
      const [hit] = damageEvents(setup); assert.ok(hit.hitY >= 0 && hit.hitY <= .8 + 1e-8);
    }
    for (const invalid of ['cover', 'above', 'outside']) {
      const target = actor(1, { x: 0, y: invalid === 'above' ? 3 : 0, z: -(invalid === 'outside' ? meleeProfile(spec.weapon).reach + .8 : distance), radius: .5, monster: true, human: false, monsterType: 'hound' });
      const map = invalid === 'cover' ? { ...arena, colliders: [{ id: 'dog-cover', x: -3, y: 0, z: -1.2, w: 6, h: 3, d: .02 }] } : arena;
      const setup = fixture(spec, { targets: [target], map, gameId: 'voxel-horde' }); cut(setup, spec);
      assert.equal(target.hp, 200, `${spec.weapon}:${invalid}`); assert.equal(damageEvents(setup).length, 0);
    }
  }
});

test('shared blade segments extend by their real length without expanding radius or leaving nonfinite tips', () => {
  for (const spec of gaps) for (const crouching of [false, true]) for (const pitch of [-.8, 0, .7]) {
    const setup = fixture(spec, { yaw: .8, pitch, crouching });
    const geometry = meleeSlashGeometry({ ...setup.attacker, meleeAction: spec.action || 'primary' });
    assert.equal(geometry.radius, setup.profile.slashRadius); assert.ok(geometry.samples.length <= 49);
    for (const sample of geometry.samples) {
      assert.ok(Object.values(sample.outer).every(Number.isFinite));
      const length = Math.hypot(sample.outer.x - geometry.origin.x, sample.outer.y - geometry.origin.y, sample.outer.z - geometry.origin.z);
      assert.ok(Math.abs(length + geometry.radius - setup.profile.reach) < 1e-8);
    }
  }
});
