import assert from 'node:assert/strict';
import test from 'node:test';
import {
  KEYBOARD_LAYOUT_STORAGE_KEY, KEYBOARD_LAYOUT_CHANGE_EVENT,
  normalizeKeyboardLayout, createKeyboardLayoutStore, gameKey, gameCode,
  displayKey, formatKeyboardText,
} from '../public/keyboard-layout.js';

function storage(initial) {
  const values = new Map(initial === undefined ? [] : [[KEYBOARD_LAYOUT_STORAGE_KEY, initial]]);
  return {
    values,
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
  };
}

test('keyboard preference persists, normalizes invalid values, and notifies only changes', () => {
  const saved = storage();
  const target = new EventTarget();
  const store = createKeyboardLayoutStore({ storage: saved, eventTarget: target });
  const notifications = [];
  const events = [];
  const unsubscribe = store.subscribe((layout, previous) => notifications.push([layout, previous]));
  target.addEventListener(KEYBOARD_LAYOUT_CHANGE_EVENT, event => events.push(event.detail));
  assert.equal(store.get(), 'wasd');
  assert.equal(store.set(' ZQSD '), 'zqsd');
  assert.equal(saved.values.get(KEYBOARD_LAYOUT_STORAGE_KEY), 'zqsd');
  assert.equal(createKeyboardLayoutStore({ storage: saved }).get(), 'zqsd');
  store.set('zqsd');
  assert.deepEqual(notifications, [['zqsd', 'wasd']]);
  assert.deepEqual(events, [{ layout: 'zqsd', previousLayout: 'wasd' }]);
  unsubscribe();
  store.set('corrupted');
  assert.equal(store.get(), 'wasd');
  assert.equal(notifications.length, 1);
  store.destroy();
  for (const value of [null, undefined, '', 'French', {}, false]) assert.equal(normalizeKeyboardLayout(value), 'wasd');
});

test('blocked or missing storage preserves a usable in-memory choice', () => {
  for (const saved of [null, {}, {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
  }]) {
    const store = createKeyboardLayoutStore({ storage: saved, eventTarget: undefined });
    assert.equal(store.get(), 'wasd');
    store.set('zqsd');
    assert.equal(store.get(), 'zqsd');
    store.set('wasd');
    assert.equal(store.get(), 'wasd');
  }
});

test('keyboard changes from another tab synchronize without writing the preference back', () => {
  const saved = storage();
  const target = new EventTarget();
  const store = createKeyboardLayoutStore({ storage: saved, eventTarget: target });
  const changes = [];
  store.subscribe((layout, previous) => changes.push([layout, previous]));
  const update = (key, newValue, storageArea = saved) => {
    const event = new Event('storage');
    Object.assign(event, { key, newValue, storageArea });
    target.dispatchEvent(event);
  };
  update('unrelated', 'zqsd');
  update(KEYBOARD_LAYOUT_STORAGE_KEY, 'zqsd', storage());
  assert.equal(store.get(), 'wasd');
  update(KEYBOARD_LAYOUT_STORAGE_KEY, 'zqsd');
  assert.equal(store.get(), 'zqsd');
  assert.equal(saved.values.size, 0);
  update(KEYBOARD_LAYOUT_STORAGE_KEY, 'zqsd');
  update(null, null);
  assert.deepEqual(changes, [['zqsd', 'wasd'], ['wasd', 'zqsd']]);
  store.destroy();
  update(KEYBOARD_LAYOUT_STORAGE_KEY, 'zqsd');
  assert.equal(store.get(), 'wasd');
});

test('ZQSD uses the selected letters on QWERTY and actual AZERTY keyboards', () => {
  for (const [key, canonical] of [['z', 'w'], ['q', 'a'], ['s', 's'], ['d', 'd'], ['a', 'q'], ['w', 'z']]) {
    for (const code of [`Key${key.toUpperCase()}`, `Key${canonical.toUpperCase()}`]) {
      assert.equal(gameKey({ key, code }, 'zqsd'), canonical);
      assert.equal(gameKey({ key: key.toUpperCase(), code }, 'zqsd'), canonical.toUpperCase());
      assert.equal(gameCode({ key, code }, 'zqsd'), `Key${canonical.toUpperCase()}`);
    }
  }
  // The displaced actions remain accessible: Apex reset Q becomes A; Prism Z becomes W.
  assert.equal(gameCode({ key: 'a', code: 'KeyQ' }, 'zqsd'), 'KeyQ');
  assert.equal(gameKey({ key: 'w', code: 'KeyZ' }, 'zqsd'), 'z');
});

test('WASD likewise follows selected letters even when the physical code differs', () => {
  for (const [key, code] of [['w', 'KeyZ'], ['a', 'KeyQ'], ['z', 'KeyW'], ['q', 'KeyA']]) {
    assert.equal(gameKey({ key, code }, 'wasd'), key);
    assert.equal(gameCode({ key, code }, 'wasd'), `Key${key.toUpperCase()}`);
  }
});

test('arrows, action letters, modifiers, and space keep their existing controls', () => {
  for (const layout of ['wasd', 'zqsd']) {
    for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape', 'Tab']) {
      assert.equal(gameKey({ key, code: key }, layout), key);
      assert.equal(gameCode({ key, code: key }, layout), key);
    }
    for (const key of ['j', 'k', 'e', 'f', 'r', 'p', 'b', 'x', 'c']) {
      assert.equal(gameKey({ key, code: `Key${key.toUpperCase()}` }, layout), key);
      assert.equal(gameCode({ key, code: `Key${key.toUpperCase()}` }, layout), `Key${key.toUpperCase()}`);
    }
    assert.equal(gameKey({ key: ' ', code: 'Space' }, layout), ' ');
    assert.equal(gameCode({ key: ' ', code: 'Space' }, layout), 'Space');
    assert.equal(gameCode({ key: 'Shift', code: 'ShiftRight' }, layout), 'ShiftRight');
    assert.equal(gameCode({ key: 'Enter', code: 'NumpadEnter' }, layout), 'Enter');
    for (const key of ['Dead', 'Process', 'Unidentified']) assert.equal(gameCode({ key, code: 'KeyW' }, layout), '');
  }
});

test('code-only synthetic events have a safe fallback without overriding real key values', () => {
  assert.equal(gameKey({ code: 'KeyZ' }, 'zqsd'), 'w');
  assert.equal(gameCode({ key: '', code: 'KeyQ' }, 'zqsd'), 'KeyA');
  assert.equal(gameKey({ key: '', code: 'ArrowLeft' }, 'zqsd'), 'ArrowLeft');
  assert.equal(gameKey({ key: '', code: 'Space' }, 'zqsd'), ' ');
  assert.equal(gameCode({ code: 'ShiftRight' }, 'zqsd'), 'ShiftRight');
  assert.equal(gameKey({ key: 'q', code: 'KeyW' }, 'zqsd'), 'a');
  assert.equal(gameKey({}, 'zqsd'), '');
  assert.equal(gameCode({}, 'zqsd'), '');
});

test('key legends and explicitly marked prose reflect the chosen layout', () => {
  for (const [canonical, french] of [
    ['WASD', 'ZQSD'], ['wasd', 'zqsd'], ['W A S D', 'Z Q S D'],
    ['A / D', 'Q / D'], ['W / ↑', 'Z / ↑'], ['Q', 'A'], ['Z', 'W'],
    ['ArrowUp', 'ArrowUp'], ['Space', 'Space'], ['Shift', 'Shift'], ['J', 'J'],
  ]) {
    assert.equal(displayKey(canonical, 'zqsd'), french);
    assert.equal(displayKey(canonical, 'wasd'), canonical);
  }
  assert.equal(formatKeyboardText('A car. Use {W A S D}; reset with {Q}.', 'zqsd'), 'A car. Use Z Q S D; reset with A.');
  assert.equal(formatKeyboardText('Use {WASD}.', 'wasd'), 'Use WASD.');
});
