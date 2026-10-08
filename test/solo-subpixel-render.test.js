import test from 'node:test';
import assert from 'node:assert/strict';
import { mount as mountShadow } from '../public/solo/shadow-view.js';
import { mount as mountSkyline } from '../public/solo/skyline-view.js';
import { mount as mountStarfall } from '../public/solo/starfall-view.js';
import { mount as mountRift } from '../public/solo/rift-view.js';
import { drawEmberActor, drawEmberBlade } from '../public/art/ember-sprites.js';

// These are isolated unit fixtures, not browser hooks. Real mounted views run
// their own engines/inputs/sampling and draw into a recording Canvas context.
// Native browser QA separately uses trusted inputs and the actual browser RAF.
function fixture({ boardWidth = 960 } = {}) {
  const saved = new Map(), frames = new Map(), canvases = []; let nextId = 0;
  const globals = { document: null, window: null, Element: null, ResizeObserver: null, requestAnimationFrame: null, cancelAnimationFrame: null };
  class Node {
    constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.listeners = new Map(); this.dataset = {}; this.style = {}; this.attrs = {}; this.className = ''; this.textContent = ''; this.width = 0; this.height = 0; }
    append(...children) { for (const child of children) { child.parent = this; this.children.push(child); } }
    prepend(...children) { for (const child of children.reverse()) { child.parent = this; this.children.unshift(child); } }
    insertBefore(child, target) { child.parent = this; const index = this.children.indexOf(target); if (index < 0) this.children.push(child); else this.children.splice(index, 0, child); }
    replaceChildren(...children) { this.children = []; this.append(...children); }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); }
    setAttribute(name, value) { this.attrs[name] = String(value); }
    getAttribute(name) { return this.attrs[name] ?? null; }
    removeAttribute(name) { delete this.attrs[name]; }
    contains(node) { return node === this || this.children.some(child => child.contains?.(node)); }
    closest(selector) { return selector.split(',').some(part => part.trim() === this.tagName.toLowerCase()) ? this : this.parent?.closest(selector) || null; }
    querySelector(selector) { for (const child of this.children) { if (child.tagName?.toLowerCase() === selector || selector.startsWith('.') && child.className?.split(' ').includes(selector.slice(1))) return child; const result = child.querySelector?.(selector); if (result) return result; } return null; }
    addEventListener(name, callback) { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name).add(callback); }
    removeEventListener(name, callback) { this.listeners.get(name)?.delete(callback); }
    emit(name, values = {}) { const event = { target: this, preventDefault() { this.defaultPrevented = true; }, ...values }; for (const callback of this.listeners.get(name) || []) callback(event); }
    focus() { globals.document.activeElement = this; }
    getBoundingClientRect() { return { x: 0, y: 0, left: 0, top: 0, width: this.className.includes('board') ? boardWidth : this.width || 80, height: this.height || 580 }; }
    setPointerCapture() {} releasePointerCapture() {} hasPointerCapture() { return false; }
    getContext() { if (!this.context) this.context = context(this); return this.context; }
  }
  function context(canvas) {
    const raw = { canvas, calls: [], matrix: [1, 0, 0, 1, 0, 0], stack: [], fillStyle: '', strokeStyle: '', imageSmoothingEnabled: false, globalAlpha: 1 };
    const point = (x, y) => ({ x: raw.matrix[0] * x + raw.matrix[2] * y + raw.matrix[4], y: raw.matrix[1] * x + raw.matrix[3] * y + raw.matrix[5] });
    const record = (method, x, y, data = {}) => raw.calls.push({ method, localX: x, localY: y, ...point(x, y), matrix: [...raw.matrix], fillStyle: raw.fillStyle, strokeStyle: raw.strokeStyle, smoothing: raw.imageSmoothingEnabled, ...data });
    raw.save = () => raw.stack.push({ matrix: [...raw.matrix], fillStyle: raw.fillStyle, strokeStyle: raw.strokeStyle, smoothing: raw.imageSmoothingEnabled, alpha: raw.globalAlpha });
    raw.restore = () => { const item = raw.stack.pop(); if (item) { raw.matrix = item.matrix; raw.fillStyle = item.fillStyle; raw.strokeStyle = item.strokeStyle; raw.imageSmoothingEnabled = item.smoothing; raw.globalAlpha = item.alpha; } };
    raw.translate = (x, y) => { const p = point(x, y); raw.matrix[4] = p.x; raw.matrix[5] = p.y; };
    raw.scale = (x, y) => { raw.matrix[0] *= x; raw.matrix[1] *= x; raw.matrix[2] *= y; raw.matrix[3] *= y; };
    raw.rotate = angle => { const [a, b, c, d] = raw.matrix, cs = Math.cos(angle), sn = Math.sin(angle); raw.matrix[0] = a * cs + c * sn; raw.matrix[1] = b * cs + d * sn; raw.matrix[2] = c * cs - a * sn; raw.matrix[3] = d * cs - b * sn; };
    raw.drawImage = (image, ...args) => { const offset = args.length === 8 ? 4 : 0; record('image', args[offset], args[offset + 1], { image, width: args[offset + 2] ?? image.width, height: args[offset + 3] ?? image.height, args }); };
    for (const method of ['fillRect', 'strokeRect', 'clearRect']) raw[method] = (x, y, width, height) => record(method, x, y, { width, height });
    raw.arc = (x, y, radius) => record('arc', x, y, { radius });
    raw.ellipse = (x, y, radiusX, radiusY) => record('ellipse', x, y, { radiusX, radiusY });
    let pathStart = 0;
    raw.beginPath = () => { pathStart = raw.calls.length; };
    raw.stroke = () => { for (const call of raw.calls.slice(pathStart)) call.strokeStyle = raw.strokeStyle; };
    raw.fill = () => { for (const call of raw.calls.slice(pathStart)) call.fillStyle = raw.fillStyle; };
    raw.measureText = value => ({ width: String(value).length * 6 });
    raw.createLinearGradient = raw.createRadialGradient = () => ({ addColorStop() {} });
    return new Proxy(raw, { get(target, key) { return key in target ? target[key] : () => {}; } });
  }
  globals.document = new Node('document'); globals.document.hidden = false;
  globals.document.createElement = tag => { const node = new Node(tag); if (tag === 'canvas') canvases.push(node); return node; };
  globals.document.createElementNS = (namespace, tag) => globals.document.createElement(tag);
  globals.document.createTextNode = value => { const node = new Node('#text'); node.textContent = value; return node; };
  globals.window = new Node('window'); globals.window.devicePixelRatio = 1; globals.window.matchMedia = () => new Node('media');
  globals.Element = Node;
  globals.ResizeObserver = class { constructor(callback) { this.callback = callback; } observe(target) { this.callback([{ target, contentRect: target.getBoundingClientRect() }]); } disconnect() {} };
  globals.requestAnimationFrame = callback => { const id = ++nextId; frames.set(id, callback); return id; };
  globals.cancelAnimationFrame = id => frames.delete(id);
  for (const [key, value] of Object.entries(globals)) { saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, writable: true, value }); }
  const container = new Node('main');
  return {
    container, context,
    key(name, down = true) { globals.window.emit(down ? 'keydown' : 'keyup', { key: name, code: name === ' ' ? 'Space' : name === 'Shift' ? 'ShiftLeft' : `Key${name.toUpperCase()}`, target: container }); },
    frame(now) { for (const canvas of canvases) if (canvas.className) canvas.getContext().calls = []; const due = [...frames.values()]; frames.clear(); for (const callback of due) callback(now); },
    cleanup() { for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } },
  };
}
const close = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-8, `${label}: ${actual} != ${expected}`);
const fractional = value => Math.abs(value - Math.round(value)) > 1e-6;
const last = (calls, predicate) => calls.findLast(predicate);

for (const hz of [60, 120, 144, 240]) test(`${hz} Hz: Shadow camera, sprite, contact ring and shadow share sampled coordinates`, () => {
  const env = fixture({ boardWidth: 480 }); let game;
  try {
    game = mountShadow(env.container); const canvas = env.container.querySelector('canvas'), ctx = canvas.getContext();
    env.frame(0); env.key('d'); env.key('Shift');
    let subpixel = 0, tracked = 0;
    for (let frame = 1; frame <= hz * 2; frame++) {
      env.frame(frame * 1000 / hz + 1e-6);
      const ring = ctx.calls.find(call => call.method === 'ellipse' && call.radiusX === 11 && call.radiusY === 7);
      assert.ok(ring, 'the player contact ring is drawn');
      const worldX = ring.localX, worldY = ring.localY - 3;
      const actor = ctx.calls.find(call => call.method === 'image' && call.image.width === 40 && Math.abs(call.localX + 20 - worldX) < 1e-8 && Math.abs(call.localY + 23 - worldY) < 1e-8);
      assert.ok(actor, 'pixel sprite is placed at the same exact pose as its contact ring');
      const shadow = ctx.calls.find(call => call.method === 'fillRect' && call.fillStyle === '#0d202b80' && Math.abs(call.localX + 10 - worldX) < 1e-8);
      close(shadow.localY - 8, worldY, 'contact shadow Y'); close(actor.x + 20, ring.x, 'screen-space sprite/core X'); close(actor.y + 26, ring.y, 'screen-space sprite/core Y');
      const stage = ctx.calls.find(call => call.method === 'image' && call.image.width === 960);
      const expectedCameraX = Math.max(0, Math.min(480, worldX - 240)), expectedCameraY = Math.max(0, Math.min(200, worldY - 242));
      close(stage.x, -expectedCameraX, 'exact camera X'); close(stage.y, -expectedCameraY, 'exact camera Y');
      assert.equal(actor.smoothing, false, 'source pixel art stays unfiltered');
      subpixel += fractional(worldX) || fractional(worldY) ? 1 : 0; tracked += expectedCameraX > 0 || expectedCameraY > 0 ? 1 : 0;
    }
    assert.ok(subpixel > hz / 2, 'sampled motion reaches fractional world positions'); assert.ok(tracked > hz, 'the narrow view tracks the player');
    const before = game.getState(); game.togglePause(); const paused = game.getState(); env.frame(3000); assert.deepEqual(game.getState(), paused, 'paused render never advances physics'); assert.equal(paused.player.x, before.player.x);
    game.restart(); const restarted = game.getState(), ring = ctx.calls.findLast(call => call.method === 'ellipse' && call.radiusX === 11); close(ring.localX, restarted.player.x, 'restart snaps to new life');
  } finally { game?.destroy(); env.cleanup(); }
});

for (const hz of [60, 120, 144, 240]) test(`${hz} Hz: Skyline retains smooth camera/actor transforms during jumps and floor contact`, () => {
  const env = fixture({ boardWidth: 540 }); let game;
  try {
    game = mountSkyline(env.container); const ctx = env.container.querySelector('canvas').getContext(); env.frame(0); env.key('d');
    let subpixel = 0, cameraTracking = 0, airborne = 0, contact = 0;
    for (let frame = 1; frame <= hz; frame++) {
      if (frame === Math.round(hz * .45)) env.key(' ');
      env.frame(frame * 1000 / hz + 1e-6);
      const actor = last(ctx.calls, call => call.method === 'image' && call.image.width === 36 && call.width === 27);
      assert.ok(actor); const stage = ctx.calls.find(call => call.method === 'image' && call.image.width === 1160), worldX = actor.localX + 13.5, worldY = actor.localY + 15.75;
      close(actor.x + 13.5, worldX + stage.x, 'actor and world use one camera transform');
      const background = ctx.calls.find(call => call.method === 'image' && call.image.width === 1920); close(background.args[0], -stage.x * .22, 'parallax retains fractional camera');
      const shadow = ctx.calls.find(call => call.method === 'fillRect' && call.fillStyle === '#182533');
      if (shadow) { close(shadow.localX + 10, worldX, 'ground contact X'); close(shadow.localY - 12, worldY, 'ground contact Y'); assert.ok(worldY <= 416 + 1e-8, 'interpolation never pushes boots through first roof'); contact++; } else airborne++;
      assert.equal(actor.smoothing, false); subpixel += fractional(worldX) || fractional(worldY) ? 1 : 0; cameraTracking += stage.x < 0 ? 1 : 0;
    }
    assert.ok(subpixel > hz / 2); assert.ok(cameraTracking > 0, 'horizontal follow camera moves during traversal'); assert.ok(airborne > 0 && contact > 0, 'both grounded and jumping poses are exercised');
  } finally { game?.destroy(); env.cleanup(); }
});

for (const hz of [60, 120, 144, 240]) test(`${hz} Hz: Starfall ship, thrusters, core and friendly shots agree without pixel snapping`, () => {
  const env = fixture(); let game;
  try {
    game = mountStarfall(env.container); const ctx = env.container.querySelector('canvas').getContext(); env.frame(0); env.key('d'); env.key('Shift'); let subpixel = 0, shots = 0;
    for (let frame = 1; frame <= hz; frame++) {
      env.frame(frame * 1000 / hz + 1e-6);
      const core = last(ctx.calls, call => call.method === 'arc' && call.radius === 3), actor = last(ctx.calls, call => call.method === 'image' && call.image.width === 40);
      close(actor.x + 20, core.x, 'ship/core X'); close(actor.y + 20, core.y, 'ship/core Y'); assert.equal(actor.smoothing, false);
      const thruster = ctx.calls.find(call => call.method === 'fillRect' && call.fillStyle === '#64bfc2'); close(thruster.x + 11, core.x, 'thruster/core X'); close(thruster.y - 17, core.y, 'thruster/core Y');
      const bullets = ctx.calls.filter(call => call.method === 'fillRect' && call.fillStyle === '#c4f8e6'); const live = game.getState().friendlyShots;
      for (let index = 0; index < bullets.length; index++) { shots++; const shot = bullets[index]; assert.ok(live[index]); if (fractional(live[index].x)) assert.ok(fractional(shot.localX + 1.5), 'focused lance keeps its fractional launch axis'); }
      subpixel += fractional(core.x) ? 1 : 0;
    }
    assert.ok(subpixel > hz / 2); assert.ok(shots > 0, 'focused auto-fire draws real friendly shots');
  } finally { game?.destroy(); env.cleanup(); }
});

test('Rift actor armor remains aligned with its physical contact ring at 240 Hz', () => {
  const env = fixture(); let game;
  try {
    game = mountRift(env.container); const ctx = env.container.querySelector('canvas').getContext(); env.frame(0); env.key('d'); let subpixel = 0;
    for (let frame = 1; frame <= 120; frame++) {
      env.frame(frame * 1000 / 240 + 1e-6);
      const ring = last(ctx.calls, call => call.method === 'arc' && call.radius === game.getState().player.radius && call.strokeStyle === '#d4c89a55');
      const actor = last(ctx.calls, call => call.method === 'image' && call.image.width === 128 && call.width === 64);
      assert.ok(ring && actor); close(actor.matrix[4], ring.x, 'armor/contact center X'); close(actor.matrix[5], ring.y, 'armor/contact center Y'); subpixel += fractional(ring.x) ? 1 : 0;
    }
    assert.ok(subpixel > 60);
  } finally { game?.destroy(); env.cleanup(); }
});

test('Ember keeps its authored 2px sprite recipe while moving continuously with its blade center', () => {
  const env = fixture();
  try {
    const actor = { type: 'hero', x: 123.125, y: 245.375, aimX: 1, aimY: 0, attackTime: 0, dashTime: 0 }, ctx = env.context({});
    drawEmberActor(ctx, actor, 1, 0, false);
    const first = ctx.calls.filter(call => call.method === 'fillRect').map(call => ({ x: call.localX, y: call.localY, width: call.width, height: call.height, color: call.fillStyle }));
    assert.ok(first.length > 10); for (const part of first) for (const key of ['x', 'y', 'width', 'height']) assert.ok(part[key] % 2 === 0, 'pixel recipe stays on its original 2px grid');
    for (const call of ctx.calls) close(call.matrix[4], actor.x, 'fractional actor anchor X');
    ctx.calls = []; actor.x += .375; actor.y += .125; drawEmberActor(ctx, actor, 1, 0, false);
    const second = ctx.calls.filter(call => call.method === 'fillRect').map(call => ({ x: call.localX, y: call.localY, width: call.width, height: call.height, color: call.fillStyle })); assert.deepEqual(second, first, 'subpixel placement changes no source art');
    for (const call of ctx.calls) { close(call.matrix[4], actor.x, 'continuous actor X'); close(call.matrix[5], actor.y, 'continuous actor Y'); assert.equal(call.smoothing, false); }
    ctx.calls = []; drawEmberBlade(ctx, actor);
    for (const call of ctx.calls) { close(call.matrix[4], actor.x, 'blade and body X'); close(call.matrix[5], actor.y, 'blade and body Y'); }
  } finally { env.cleanup(); }
});
