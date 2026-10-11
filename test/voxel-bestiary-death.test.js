import assert from 'node:assert/strict';
import test from 'node:test';
import { createCombatPlayer, applyCombatDamage } from '../public/voxel-engine.js';
import { MONSTER_DEATH_RULES, MONSTER_DEATH_STYLES, monsterDeathPose, createMonsterDeathPresenter } from '../public/voxel-monster-death.js';

const TYPES = ['vampire', 'witch', 'wolf', 'pig', 'rat', 'stag'];
const creature = (monsterType, patch = {}) => ({ ...createCombatPlayer(1, 1), monster: true, human: false, monsterType, lifeId: 17, x: 1, y: 0, z: -4, yaw: .6, hp: 40, maxHp: 40, ...patch });
const fixture = monsterType => ({ gameId: 'voxel-horde', phase: 'fight', mapId: 'bestiary-death', matchId: 1, tick: 100, eventId: 0, events: [], horde: { sessionId: 1 }, players: [createCombatPlayer(0), creature(monsterType)] });
const kill = state => { state.tick++; applyCombatDamage(state, [{ playerId: 0, targetId: 1, targetLifeId: state.players[1].lifeId, damage: state.players[1].hp, attack: 'gun', weapon: 'carbine', dx: .2, dy: .1, dz: -1 }]); return state.events.findLast(event => event.type === 'kill'); };

test('six new species preserve actual lethal life and pose, consume one death, and expire independently of alive gameplay', () => {
  for (const type of TYPES) {
    const state = fixture(type), present = createMonsterDeathPresenter(); assert.deepEqual(present(state, 0), []);
    const event = kill(state), before = structuredClone(state), deaths = present(state, 10);
    assert.equal(state.players[1].alive, false); assert.equal(state.players[1].hp, 0);
    assert.equal(deaths.length, 1); assert.equal(deaths[0].monsterType, type); assert.equal(deaths[0].lifeId, 17);
    for (const key of ['x', 'y', 'z', 'yaw']) assert.equal(deaths[0][key], event[key]);
    present(state, 110); assert.equal(present.getStats().acceptedKills, 1);
    assert.deepEqual(state, before, 'presentation does not delay loot, damage or wave progression');
    state.events.push({ ...event, id: ++state.eventId }); assert.equal(present(state, 120).length, 1);
    assert.equal(present.getStats().acceptedKills, 1);
    state.players[1] = creature(type, { lifeId: 18, x: 8 }); kill(state);
    assert.equal(present(state, 130).length, 2, 'new occupant can die without erasing the old life');
    assert.equal(present(state, 130 + MONSTER_DEATH_RULES.durationMs).length, 0);
    assert.equal(present(state, 5000).length, 0, 'retained packets cannot resurrect expired bodies');
    present.reset(); assert.equal(present.getStats().activeCorpses, 0);
  }
});

test('light rats, nimble wolves and heavy boars/stags collapse at distinct cadences with one bounded lifetime', () => {
  const signatures = new Set();
  for (const type of TYPES) {
    const corpse = { monsterType: type }, style = MONSTER_DEATH_STYLES[type];
    assert.ok(Object.isFrozen(style));
    const loaded = monsterDeathPose(corpse, 200); signatures.add(`${loaded.collapse}:${loaded.darken}`);
    assert.ok(loaded.collapse > 0 && loaded.collapse < 1);
    const fallen = monsterDeathPose(corpse, style.collapseMs);
    assert.equal(fallen.collapse, 1); assert.equal(fallen.dissolve, 0);
    assert.equal(fallen.angle, ['wolf', 'pig', 'rat', 'stag'].includes(type) ? 1.49 : 1.47);
    assert.equal(monsterDeathPose(corpse, style.collapseMs + style.holdMs).dissolve, 0);
    assert.ok(monsterDeathPose(corpse, 1000).dissolve > .8);
    assert.equal(monsterDeathPose(corpse, MONSTER_DEATH_RULES.durationMs).visible, false);
    assert.equal(monsterDeathPose(corpse, MONSTER_DEATH_RULES.durationMs).dissolve, 1);
  }
  assert.equal(signatures.size, 6);
  assert.ok(monsterDeathPose({ monsterType: 'rat' }, 250).collapse > monsterDeathPose({ monsterType: 'pig' }, 250).collapse);
});

test('new species paused death clocks freeze and malformed/coerced events cannot invent their silhouettes', () => {
  for (const type of TYPES) {
    const state = fixture(type), present = createMonsterDeathPresenter(); present(state, 0); kill(state); present(state, 10);
    const held = present(state, 150, { paused: true })[0]; assert.equal(held.ageMs, 0);
    assert.deepEqual(present(state, 10000, { paused: true })[0], held);
    assert.deepEqual(present(state, 10010)[0], held);
    assert.ok(present(state, 10100)[0].ageMs > 0);
    for (const invalid of [[type], new String(type), null, 'missing']) {
      const bad = fixture(type), clean = createMonsterDeathPresenter(); clean(bad, 0); const event = kill(bad); event.monsterType = invalid;
      assert.deepEqual(clean(bad, 10), []); assert.equal(clean.getStats().acceptedKills, 0);
      assert.equal(monsterDeathPose({ monsterType: invalid }, 500).angle, 1.47, 'bad identities use the ordinary safe cosmetic fallback');
    }
  }
});
