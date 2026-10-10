import { isPauseShortcut } from '../pause-shortcut.js';

const SHORTCUT_UI = 'input,select,textarea,[contenteditable]:not([contenteditable="false"]),summary,#solo-how-to,.ironwood-help';

/** Single-press actions must leave typing, help and browser shortcuts alone. */
export function blocksSoloShortcut(event, { allowRepeat = false } = {}) {
  return Boolean(event?.defaultPrevented || (!allowRepeat && event?.repeat) || event?.isComposing ||
    event?.ctrlKey || event?.metaKey || event?.altKey || event?.target?.closest?.(SHORTCUT_UI));
}

export function soloSessionShortcut(event) {
  if (blocksSoloShortcut(event)) return null;
  const key = typeof event?.key === 'string' ? event.key.toLowerCase() : '';
  if (isPauseShortcut(event)) return 'pause';
  if (key === 'r') return 'restart';
  return null;
}

/** AZERTY number-row keys produce symbols without Shift, but retain DigitN. */
export function handShortcutIndex(event, count) {
  if (blocksSoloShortcut(event)) return null;
  const physical = /^Digit([1-9])$/.exec(event?.code || '');
  const printed = /^[1-9]$/.test(event?.key || '') ? Number(event.key) : null;
  const number = physical ? Number(physical[1]) : printed;
  return number !== null && number <= count ? number - 1 : null;
}

/** A tap remains pending until an actual simulation step samples it. */
export function createPressLatch() {
  let pending = false;
  return {
    press() { pending = true; },
    consume(held = false) {
      const pressed = held || pending;
      pending = false;
      return pressed;
    },
    reset() { pending = false; },
  };
}
