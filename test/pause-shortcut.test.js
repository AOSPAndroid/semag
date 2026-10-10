import assert from 'node:assert/strict';
import test from 'node:test';
import { isPauseShortcut } from '../public/pause-shortcut.js';

const press = (changes = {}) => ({ key: 'p', code: 'KeyP', ...changes });

test('P works with both letter cases and a physical-key fallback', () => {
  for (const event of [press(), press({ key: 'P', shiftKey: true }), press({ code: '' }), press({ key: 'Unidentified' }), press({ key: undefined })]) assert.equal(isPauseShortcut(event), true);
});

test('Escape, other keys and composition keys remain outside the menu shortcut', () => {
  for (const key of ['Escape', 'q', 'Dead', 'Process', 'Tab', 'Enter']) assert.equal(isPauseShortcut(press({ key })), false);
});

test('holding P or using browser shortcuts does not repeatedly toggle or resume', () => {
  for (const field of ['repeat', 'defaultPrevented', 'isComposing', 'ctrlKey', 'metaKey', 'altKey']) assert.equal(isPauseShortcut(press({ [field]: true })), false, field);
});

test('editing names, search boxes, selects and rich text keeps P in the field', () => {
  for (const tag of ['input', 'textarea', 'select']) {
    const target = { closest: selector => selector.includes(tag) ? {} : null };
    assert.equal(isPauseShortcut(press({ target })), false);
  }
  assert.equal(isPauseShortcut(press({ target: { isContentEditable: true } })), false);
  assert.equal(isPauseShortcut(press({ target: { closest: selector => selector.includes('[role="textbox"]') ? {} : null } })), false);
});

test('focused menu buttons can use P to return to the game', () => {
  assert.equal(isPauseShortcut(press({ target: { tagName: 'BUTTON', isContentEditable: false, closest: () => null } })), true);
});
