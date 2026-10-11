import test from 'node:test';
import assert from 'node:assert/strict';
import { mountPwaInstall } from '../public/hub/pwa-install.js';

class Element extends EventTarget {
  constructor() {
    super(); this.hidden = true; this.disabled = false; this.textContent = ''; this.open = false;
    this.attributes = new Map(); this.isConnected = true; this.focusCount = 0;
  }
  setAttribute(name, value) { this.attributes.set(name, value); }
  focus() { this.focusCount += 1; }
  showModal() { this.open = true; this.showCount = (this.showCount || 0) + 1; }
  close() { if (this.open) { this.open = false; this.dispatchEvent(new Event('close')); } }
  getBoundingClientRect() { return { left: 20, right: 300, top: 20, bottom: 500 }; }
}
class MediaQuery extends EventTarget {
  constructor(matches = false) { super(); this.matches = matches; }
  set(matches) { this.matches = matches; this.dispatchEvent(new Event('change')); }
}
function fixture({ secure = true, standalone = false, ios = false, ready = 'complete', register } = {}) {
  const ids = ['pwa-install', 'pwa-install-dialog', 'pwa-install-close', 'pwa-install-status', 'pwa-install-security'];
  const elements = new Map(ids.map(id => [id, new Element()]));
  const media = new Map([['(display-mode: standalone)', new MediaQuery(standalone)], ['(display-mode: minimal-ui)', new MediaQuery()]]);
  const calls = [], doc = { readyState: ready, getElementById: id => elements.get(id) };
  doc.activeElement = elements.get('pwa-install');
  const win = new EventTarget(); win.document = doc; win.isSecureContext = secure;
  win.navigator = { standalone: ios, serviceWorker: { register: register || ((...args) => { calls.push(args); return Promise.resolve({}); }) } };
  win.matchMedia = query => media.get(query);
  const controller = mountPwaInstall({ window: win, document: doc });
  return { win, doc, elements, media, calls, controller, button: elements.get('pwa-install'), dialog: elements.get('pwa-install-dialog'), status: elements.get('pwa-install-status'), security: elements.get('pwa-install-security'), close: elements.get('pwa-install-close') };
}
function promptEvent(choice, prompt = () => Promise.resolve()) {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  event.prompt = prompt; event.userChoice = Promise.resolve(choice);
  return event;
}
const click = element => element.dispatchEvent(new Event('click'));
const flush = () => new Promise(resolve => setImmediate(resolve));

test('service worker registration waits for load and runs once with network update checks', () => {
  const f = fixture({ ready: 'interactive' });
  assert.equal(f.calls.length, 0); assert.equal(f.button.hidden, false);
  f.win.dispatchEvent(new Event('load')); f.win.dispatchEvent(new Event('load'));
  assert.deepEqual(f.calls, [['/service-worker.js', { scope: '/', updateViaCache: 'none' }]]);
  f.controller.destroy();
});

test('a loaded secure hub registers immediately; unavailable service workers leave install guidance usable', () => {
  const f = fixture(); assert.equal(f.calls.length, 1); f.controller.destroy();
  const unsupported = fixture({ register: undefined, ready: 'loading' });
  delete unsupported.win.navigator.serviceWorker;
  unsupported.win.dispatchEvent(new Event('load')); click(unsupported.button);
  assert.equal(unsupported.calls.length, 0); assert.equal(unsupported.dialog.open, true);
  unsupported.controller.destroy();
});

test('insecure LAN never registers a worker or pretends to support installation', () => {
  const f = fixture({ secure: false });
  assert.equal(f.calls.length, 0); assert.equal(f.security.hidden, false);
  click(f.button); assert.equal(f.dialog.open, true); assert.equal(f.status.hidden, true);
  f.controller.destroy();
});

test('worker registration failure is nonfatal for both rejected promises and synchronous blocks', async () => {
  for (const register of [() => Promise.reject(new Error('denied')), () => { throw new Error('blocked'); }]) {
    const f = fixture({ register }); await flush(); click(f.button);
    assert.equal(f.dialog.open, true); assert.equal(f.button.disabled, false); f.controller.destroy();
  }
});

test('installed standalone and iOS web apps hide the redundant installation action', () => {
  for (const configuration of [{ standalone: true }, { ios: true }]) {
    const f = fixture(configuration); assert.equal(f.button.hidden, true);
    click(f.button); assert.equal(f.dialog.open, false); f.controller.destroy();
  }
});

test('display mode changes close guidance and preserve install availability in a regular browser', () => {
  const f = fixture(); click(f.button); assert.equal(f.dialog.open, true);
  f.media.get('(display-mode: standalone)').set(true);
  assert.equal(f.button.hidden, true); assert.equal(f.dialog.open, false);
  f.media.get('(display-mode: standalone)').set(false); assert.equal(f.button.hidden, false);
  f.media.get('(display-mode: minimal-ui)').set(true); assert.equal(f.button.hidden, true);
  f.controller.destroy();
});

test('install prompts are retained without opening and invoked once by an explicit user click', async () => {
  const f = fixture(); let requests = 0;
  const event = promptEvent({ outcome: 'dismissed' }, () => { requests += 1; return Promise.resolve(); });
  f.win.dispatchEvent(event);
  assert.equal(event.defaultPrevented, true); assert.equal(requests, 0); assert.equal(f.dialog.open, false);
  click(f.button); click(f.button); assert.equal(requests, 1); assert.equal(f.button.disabled, true);
  await flush(); assert.equal(f.button.disabled, false); assert.equal(f.button.attributes.get('aria-busy'), 'false');
  assert.match(f.status.textContent, /cancelled/); assert.equal(f.status.hidden, false); assert.equal(f.button.hidden, false);
  f.dialog.close(); click(f.button); await flush(); assert.equal(requests, 1, 'a consumed event cannot be replayed');
  assert.equal(f.dialog.open, true); f.controller.destroy();
});

test('acceptance is described as requested until appinstalled confirms actual installation', async () => {
  const f = fixture(); f.win.dispatchEvent(promptEvent({ outcome: 'accepted' })); click(f.button); await flush();
  assert.equal(f.button.hidden, false); assert.match(f.status.textContent, /^Installation requested\./);
  assert.equal(f.dialog.open, true); f.win.dispatchEvent(new Event('appinstalled'));
  assert.equal(f.button.hidden, true); assert.equal(f.dialog.open, false); f.controller.destroy();
});

test('installation confirmation while a prompt is pending prevents late misleading help', async () => {
  const f = fixture(); let resolve;
  const choice = new Promise(done => { resolve = done; });
  const event = promptEvent({}); event.userChoice = choice;
  f.win.dispatchEvent(event); click(f.button); f.win.dispatchEvent(new Event('appinstalled'));
  resolve({ outcome: 'accepted' }); await flush();
  assert.equal(f.button.hidden, true); assert.equal(f.dialog.open, false); f.controller.destroy();
});

test('a failing native prompt consumes the event and offers real browser instructions', async () => {
  const f = fixture(); let requests = 0;
  f.win.dispatchEvent(promptEvent({}, () => { requests += 1; throw new Error('not allowed'); }));
  click(f.button); await flush(); assert.equal(requests, 1); assert.equal(f.dialog.open, true);
  assert.match(f.status.textContent, /could not open/); assert.equal(f.button.disabled, false);
  f.dialog.close(); click(f.button); assert.equal(requests, 1); f.controller.destroy();
});

test('closing guidance returns focus and inside padding never acts like the backdrop', () => {
  const f = fixture(); click(f.button); click(f.close);
  assert.equal(f.dialog.open, false); assert.equal(f.button.focusCount, 1);
  click(f.button);
  const inside = new Event('click'); inside.clientX = 25; inside.clientY = 25; f.dialog.dispatchEvent(inside);
  assert.equal(f.dialog.open, true);
  const outside = new Event('click'); outside.clientX = 4; outside.clientY = 4; f.dialog.dispatchEvent(outside);
  assert.equal(f.dialog.open, false); assert.equal(f.button.focusCount, 2); f.controller.destroy();
});

test('teardown removes listeners, cancels a deferred prompt, and ignores late promise completion', async () => {
  const f = fixture({ ready: 'loading' }); let requests = 0;
  f.win.dispatchEvent(promptEvent({ outcome: 'accepted' }, () => { requests += 1; return Promise.resolve(); }));
  f.controller.destroy(); click(f.button); f.win.dispatchEvent(new Event('load'));
  assert.equal(requests, 0); assert.equal(f.calls.length, 0); assert.equal(f.dialog.open, false);
  const pending = fixture(); let resolve;
  const event = promptEvent({}); event.userChoice = new Promise(done => { resolve = done; });
  pending.win.dispatchEvent(event); click(pending.button); pending.controller.destroy(); resolve({ outcome: 'accepted' }); await flush();
  assert.equal(pending.dialog.open, false); assert.equal(pending.status.textContent, '');
});

test('import and mount are safe on non-browser or incomplete pages', () => {
  assert.doesNotThrow(() => mountPwaInstall({ window: null, document: null }).destroy());
  assert.doesNotThrow(() => mountPwaInstall({ window: {}, document: { getElementById: () => null } }).destroy());
});
