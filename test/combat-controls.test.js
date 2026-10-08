import assert from 'node:assert/strict';
import test from 'node:test';
import { createCombatKeyMap, combatInputFromKeys } from '../public/combat-controls.js';
import { gameCode } from '../public/keyboard-layout.js';
import * as afterimage from '../public/engine.js';
import * as shinobi from '../public/shinobi-engine.js';
import * as vector from '../public/vector-engine.js';
import * as brawl from '../public/brawl-engine.js';
import * as topdown from '../public/topdown-engine.js';

const games = [
  ['afterimage', afterimage, [['c', 'j', 'light'], ['g', 'k', 'heavy'], ['f', 'i', 'block']]],
  ['shinobi-showdown', shinobi, [['c', 'j', 'attack'], ['g', 'k', 'heavy'], ['f', 'i', 'parry'], ['e', 'l', 'throw'], ['r', 'r', 'feint']]],
  ['vector-arena', vector, [['c', 'j', 'fire'], ['f', 'i', 'focus'], ['r', 'r', 'reload']]],
  ['oddstock-rumble', brawl, [['c', 'j', 'attack'], ['g', 'k', 'special'], ['f', 'i', 'shield']]],
  ['relic-duel', topdown, [['c', 'j', 'attack'], ['g', 'k', 'shoot'], ['f', 'i', 'block']]],
  ['dungeon-run', topdown, [['c', 'j', 'attack'], ['g', 'k', 'shoot'], ['f', 'i', 'block']]],
];

const event = key => ({ key, code: `Key${key.toUpperCase()}` });
const input = (gameId, engine, events, layout) => combatInputFromKeys(
  createCombatKeyMap(gameId), events.map(value => gameCode(value, layout)), engine.emptyInput(),
);

test('nearby combat actions remain distinct from movement on both printed layouts', () => {
  for (const [gameId, engine, actions] of games) {
    for (const layout of ['wasd', 'zqsd']) {
      const left = layout === 'zqsd' ? { key: 'q', code: 'KeyA' } : event('a');
      const right = event('d');
      for (const [key, , action] of actions) {
        const result = input(gameId, engine, [left, event(key)], layout);
        assert.equal(result.left, true, `${gameId} ${layout}: movement lost with ${key}`);
        assert.equal(result[action], true, `${gameId} ${layout}: action lost with movement`);
        assert.equal(result.right, false);
        const reverse = input(gameId, engine, [right, event(key)], layout);
        assert.equal(reverse.right, true); assert.equal(reverse[action], true); assert.equal(reverse.left, false);
      }
      const up = layout === 'zqsd' ? { key: 'z', code: 'KeyW' } : event('w');
      assert.equal(input(gameId, engine, [up], layout)[gameId === 'afterimage' ? 'jump' : 'up'], true);
      assert.equal(input(gameId, engine, [{ key: 's', code: 'KeyS' }], layout).down, gameId === 'afterimage' ? undefined : true);
    }
  }
});

test('every nearby and legacy combat binding uses an existing engine action', () => {
  for (const [gameId, engine, actions] of games) {
    const keyMap = createCombatKeyMap(gameId);
    for (const action of keyMap.values()) assert.ok(engine.INPUT_KEYS.includes(action), `${gameId}: unknown action ${action}`);
    for (const [nearby, legacy, action] of actions) {
      assert.equal(keyMap.get(gameCode(event(nearby), 'wasd')), action);
      assert.equal(keyMap.get(gameCode(event(legacy), 'zqsd')), action);
    }
    assert.equal(keyMap.has('KeyR'), ['vector-arena', 'shinobi-showdown'].includes(gameId), 'R supports reload or an in-fight feint');
    assert.equal(keyMap.has('KeyQ'), false, 'Q must never become an action while French movement uses Q');
    assert.equal(keyMap.has('KeyZ'), false);
  }
});

test('nearby bindings preserve real combat behavior compared with legacy keys', () => {
  for (const [gameId, engine, actions] of games) {
    for (const [nearby, legacy] of actions) {
      const original = engine.createState(gameId === 'dungeon-run' ? 'coop' : 'duel');
      if (gameId === 'oddstock-rumble') {
        engine.select(original, 0, { character: 'wrench', stage: 'rooftop' });
        engine.select(original, 1, { character: 'sprout' });
      }
      engine.startMatch(original); original.phaseTicks = 1; engine.step(original);
      assert.equal(original.phase, 'fight');
      const french = structuredClone(original), historical = structuredClone(original);
      const frenchInput = input(gameId, engine, [{ key: 'q', code: 'KeyA' }, event(nearby)], 'zqsd');
      const legacyInput = input(gameId, engine, [event('a'), event(legacy)], 'wasd');
      for (let tick = 0; tick < 50; tick++) {
        engine.step(french, [frenchInput, engine.emptyInput()]);
        engine.step(historical, [legacyInput, engine.emptyInput()]);
      }
      assert.deepEqual(french, historical, `${gameId}: new ${nearby} changes old ${legacy} combat`);
    }
  }
});

test('releasing one alias leaves another held alias active, then fully neutralizes', () => {
  for (const [gameId, engine, actions] of games) {
    const keyMap = createCombatKeyMap(gameId);
    for (const [nearby, legacy, action] of actions.filter(([nearby, legacy]) => nearby !== legacy)) {
      const held = new Map();
      const down = value => held.set(value.code, gameCode(value, 'zqsd'));
      down({ key: 'q', code: 'KeyA' }); down(event(nearby)); down(event(legacy));
      let result = combatInputFromKeys(keyMap, held.values(), engine.emptyInput());
      assert.equal(result.left, true); assert.equal(result[action], true);
      held.delete(event(nearby).code);
      result = combatInputFromKeys(keyMap, held.values(), engine.emptyInput());
      assert.equal(result[action], true, `${gameId}: releasing nearby key lost held legacy alias`);
      held.delete(event(legacy).code);
      result = combatInputFromKeys(keyMap, held.values(), engine.emptyInput());
      assert.equal(result[action], false); assert.equal(result.left, true);
      held.clear();
      assert.deepEqual(combatInputFromKeys(keyMap, held.values(), engine.emptyInput()), engine.emptyInput());
    }
  }
});

test('held physical identities survive shifted releases and layout changes cannot stick actions', () => {
  const keyMap = createCombatKeyMap('shinobi-showdown'), held = new Map();
  for (const value of [{ key: 'q', code: 'KeyA' }, event('e'), event('f')]) held.set(value.code, gameCode(value, 'zqsd'));
  assert.equal(combatInputFromKeys(keyMap, held.values(), shinobi.emptyInput()).throw, true);
  // Production keyup removes the physical identity captured on keydown, even after Shift changes the printed key.
  held.delete({ key: 'E', code: 'KeyE' }.code);
  const released = combatInputFromKeys(keyMap, held.values(), shinobi.emptyInput());
  assert.equal(released.throw, false); assert.equal(released.parry, true); assert.equal(released.left, true);
  // Blur/layout changes clear every identity before the new layout is used.
  held.clear();
  assert.deepEqual(combatInputFromKeys(keyMap, held.values(), shinobi.emptyInput()), shinobi.emptyInput());
  held.set('KeyA', gameCode(event('a'), 'wasd'));
  assert.equal(combatInputFromKeys(keyMap, held.values(), shinobi.emptyInput()).left, true);
});

test('evasion, jumps, arrows and the original alternate aliases remain available', () => {
  for (const [gameId, engine] of games) {
    const keyMap = createCombatKeyMap(gameId);
    const evasion = gameId === 'afterimage' || gameId === 'shinobi-showdown' || gameId === 'vector-arena' ? 'dash' : gameId === 'oddstock-rumble' ? 'dodge' : 'roll';
    assert.equal(keyMap.get('ShiftLeft'), evasion); assert.equal(keyMap.get('ShiftRight'), evasion);
    assert.equal(keyMap.get('Space'), ['afterimage', 'oddstock-rumble'].includes(gameId) ? 'jump' : evasion);
    assert.equal(input(gameId, engine, [{ key: 'ArrowLeft', code: 'ArrowLeft' }], 'zqsd').left, true);
  }
  assert.equal(createCombatKeyMap('afterimage').get('KeyU'), 'block');
  assert.equal(createCombatKeyMap('afterimage').get('KeyL'), 'dash');
  assert.equal(createCombatKeyMap('oddstock-rumble').get('KeyL'), 'dodge');
  assert.equal(createCombatKeyMap('relic-duel').get('KeyL'), 'block');
});

test('game maps and composed frames are independent and ignore unrelated keys', () => {
  const first = createCombatKeyMap('shinobi-showdown'), second = createCombatKeyMap('shinobi-showdown');
  first.set('KeyC', 'heavy'); assert.equal(second.get('KeyC'), 'attack');
  const neutral = shinobi.emptyInput();
  const frame = combatInputFromKeys(second, ['KeyC', 'KeyP', 'Unidentified'], neutral);
  assert.equal(frame.attack, true); assert.equal(neutral.attack, false);
  assert.deepEqual(Object.keys(frame), Object.keys(neutral)); assert.equal(frame.aimX, 1); assert.equal(frame.aimY, 0);
  const following = combatInputFromKeys(second, [], neutral);
  assert.equal(following.attack, false); assert.equal(frame.attack, true);
});
