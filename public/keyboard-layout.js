export const KEYBOARD_LAYOUT_STORAGE_KEY = 'semag-keyboard-layout';
export const KEYBOARD_LAYOUT_CHANGE_EVENT = 'semag:keyboard-layout-change';

const FRENCH_KEYS = Object.freeze({ w: 'z', a: 'q', q: 'a', z: 'w' });
const NAMED_KEYS = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape', 'Tab',
  'Backspace', 'Delete', 'Insert', 'Home', 'End', 'PageUp', 'PageDown',
  'CapsLock', 'NumLock', 'ScrollLock', 'Pause', 'PrintScreen', 'ContextMenu',
]);

export function normalizeKeyboardLayout(value) {
  return typeof value === 'string' && value.trim().toLowerCase() === 'zqsd' ? 'zqsd' : 'wasd';
}

function browserStorage() {
  try { return globalThis.localStorage; } catch { return undefined; }
}

/** The preference stays usable in memory when browser storage is unavailable. */
export function createKeyboardLayoutStore({ storage = browserStorage(), eventTarget = globalThis.window } = {}) {
  let layout = 'wasd';
  try { layout = normalizeKeyboardLayout(storage?.getItem(KEYBOARD_LAYOUT_STORAGE_KEY)); } catch { /* Storage can be blocked. */ }
  const listeners = new Set();

  function announce(previousLayout) {
    const detail = { layout, previousLayout };
    for (const listener of [...listeners]) listener(layout, previousLayout);
    if (eventTarget?.dispatchEvent) {
      const EventClass = eventTarget.CustomEvent || globalThis.CustomEvent;
      if (EventClass) eventTarget.dispatchEvent(new EventClass(KEYBOARD_LAYOUT_CHANGE_EVENT, { detail }));
    }
  }

  function set(value) {
    const next = normalizeKeyboardLayout(value);
    if (next === layout) return layout;
    const previous = layout;
    layout = next;
    try { storage?.setItem(KEYBOARD_LAYOUT_STORAGE_KEY, layout); } catch { /* Keep the in-memory choice. */ }
    announce(previous);
    return layout;
  }

  function storageChanged(event) {
    if (event.key !== KEYBOARD_LAYOUT_STORAGE_KEY && event.key !== null) return;
    if (event.storageArea && event.storageArea !== storage) return;
    const next = normalizeKeyboardLayout(event.newValue);
    if (next === layout) return;
    const previous = layout;
    layout = next;
    announce(previous);
  }

  eventTarget?.addEventListener?.('storage', storageChanged);
  return {
    get: () => layout,
    set,
    subscribe(callback) {
      if (typeof callback !== 'function') throw new TypeError('Keyboard layout listener must be a function.');
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    destroy() {
      eventTarget?.removeEventListener?.('storage', storageChanged);
      listeners.clear();
    },
  };
}

const preference = createKeyboardLayoutStore();
export const getKeyboardLayout = () => preference.get();
export const setKeyboardLayout = value => preference.set(value);
export const subscribeKeyboardLayout = callback => preference.subscribe(callback);

function swapLetter(key) {
  const mapped = FRENCH_KEYS[key.toLowerCase()];
  return mapped ? key === key.toUpperCase() ? mapped.toUpperCase() : mapped : key;
}

function keyFromCode(code = '') {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (code === 'Space') return ' ';
  if (/^(Shift|Control|Alt|Meta)(Left|Right)$/.test(code)) return code.replace(/(Left|Right)$/, '');
  if (code === 'NumpadEnter') return 'Enter';
  return code;
}

/** Normalize the selected printed letters, including real AZERTY key/code mismatches. */
export function gameKey(event, layout = getKeyboardLayout()) {
  const key = typeof event?.key === 'string' && event.key !== '' ? event.key : keyFromCode(event?.code);
  return normalizeKeyboardLayout(layout) === 'zqsd' && /^[a-z]$/i.test(key) ? swapLetter(key) : key;
}

/** Code-based games receive the same canonical controls as key-based games. */
export function gameCode(event, layout = getKeyboardLayout()) {
  const key = gameKey(event, layout);
  if (/^[a-z]$/i.test(key)) return `Key${key.toUpperCase()}`;
  if (/^[0-9]$/.test(key)) return `Digit${key}`;
  if (key === ' ') return 'Space';
  if (NAMED_KEYS.has(key) || /^F(?:[1-9]|1[0-9]|2[0-4])$/.test(key)) return key;
  if (['Dead', 'Process', 'Unidentified'].includes(key)) return '';
  if (['Shift', 'Control', 'Alt', 'Meta'].includes(key)) {
    return typeof event?.code === 'string' && event.code.startsWith(key) ? event.code : `${key}Left`;
  }
  return event?.code || key;
}

/** Use for canonical key labels, rather than ordinary sentences. */
export function displayKey(label, layout = getKeyboardLayout()) {
  const text = String(label);
  if (normalizeKeyboardLayout(layout) !== 'zqsd') return text;
  return text.replace(/\b(WASD|W|A|Q|Z)\b/gi, token => [...token].map(swapLetter).join(''));
}

/** Mark key labels in prose explicitly: "Use {W A S D}. Reset with {Q}." */
export function formatKeyboardText(text, layout = getKeyboardLayout()) {
  return String(text).replace(/\{([^{}]+)\}/g, (_, label) => displayKey(label, layout));
}

let pickerNumber = 0;
export function mountKeyboardLayoutPicker(container, { id = `keyboard-layout-${++pickerNumber}` } = {}) {
  const document = container.ownerDocument;
  const element = document.createElement('label');
  element.className = 'keyboard-layout-picker';
  element.htmlFor = id;
  const title = document.createElement('span');
  title.className = 'keyboard-layout-label';
  title.textContent = 'Keyboard';
  const select = document.createElement('select');
  select.className = 'keyboard-layout-select';
  select.id = id;
  select.setAttribute('data-keyboard-layout', '');
  for (const [value, text] of [['wasd', 'WASD'], ['zqsd', 'ZQSD · Français']]) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    select.append(option);
  }
  select.value = getKeyboardLayout();
  const changed = () => setKeyboardLayout(select.value);
  select.addEventListener('change', changed);
  const unsubscribe = subscribeKeyboardLayout(layout => { select.value = layout; });
  element.append(title, select);
  container.append(element);
  return {
    element,
    select,
    destroy() {
      unsubscribe();
      select.removeEventListener('change', changed);
      element.remove();
    },
  };
}
