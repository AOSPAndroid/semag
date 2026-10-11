import assert from 'node:assert/strict';
import test from 'node:test';
import { mountVoxelVictory } from '../public/voxel-victory.js';
import { createEndPresentation } from '../public/voxel-end-presentation.js';
import { createRoyaleRewardPresenter } from '../public/voxel-royale-reward.js';

class Node {
  constructor(document, tag) {
    this.ownerDocument = document; this.tagName = tag; this.children = []; this.attributes = new Map(); this.hidden = false;
    this.parentElement = null; this._text = '';
    this.classList = {
      contains: value => this.className.split(/\s+/).includes(value),
      add: value => { if (!this.classList.contains(value)) this.className = `${this.className} ${value}`.trim(); },
      remove: value => { this.className = this.className.split(/\s+/).filter(part => part !== value).join(' '); },
    };
  }
  get className() { return this.getAttribute('class') || ''; }
  set className(value) { this.setAttribute('class', value); }
  get firstChild() { return this.children[0] || null; }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  set textContent(value) { this.ownerDocument.writes++; this._text = value; for (const child of this.children) child.parentElement = null; this.children = []; }
  setAttribute(name, value) { this.ownerDocument.writes++; this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  removeAttribute(name) { this.ownerDocument.writes++; this.attributes.delete(name); }
  append(node) { this.insertBefore(node, null); }
  insertBefore(node, before) {
    node.remove(); this.ownerDocument.writes++; node.parentElement = this;
    if (before === null) this.children.push(node); else this.children.splice(this.children.indexOf(before), 0, node);
  }
  remove() { if (this.parentElement) { this.ownerDocument.writes++; const list = this.parentElement.children; list.splice(list.indexOf(this), 1); this.parentElement = null; } }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) {
    const selectors = selector.split(',').map(part => part.trim()), found = [];
    const visit = node => { for (const child of node.children) {
      if (selectors.some(part => part.startsWith('.') ? child.classList.contains(part.slice(1)) : part.startsWith('#') ? child.getAttribute('id') === part.slice(1) : child.tagName === part)) found.push(child);
      visit(child);
    } };
    visit(this); return found;
  }
}

function dom({ reducedMotion = false } = {}) {
  const document = { writes: 0, reducedMotion, defaultView: { matchMedia: () => ({ matches: document.reducedMotion }) } };
  document.createElement = tag => new Node(document, tag);
  document.createElementNS = (_namespace, tag) => document.createElement(tag);
  const container = document.createElement('section'), card = document.createElement('section');
  card.className = 'existing-card'; card.setAttribute('id', 'existing-result');
  const header = document.createElement('header'), title = document.createElement('h2'), stats = document.createElement('dl'), button = document.createElement('button');
  title.setAttribute('id', 'existing-title'); title.textContent = 'Authoritative finish';
  stats.setAttribute('id', 'existing-stats'); stats.textContent = '204 damage';
  button.setAttribute('id', 'existing-replay'); button.textContent = 'Replay'; button.disabled = true;
  header.append(title); card.append(header); card.append(stats); card.append(button); container.append(card);
  return { document, container, card, title, stats, button, header };
}

function sequencer(component, contextKey = 'courtyard:7') {
  const death = createEndPresentation();
  return (phase, now, extra = {}) => {
    const options = { phase, now, contextKey, won: true, ...extra };
    return component.observe({ ...options, death: death.observe(phase, now, options) });
  };
}

function audioFixture() {
  const nodes = [], parameter = () => ({ setValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const audio = { enabled: true, destroyed: false, master: {}, context: { state: 'running', currentTime: 3,
    createGain: () => ({ gain: parameter(), connect() {}, disconnect() {} }),
    createOscillator: () => { const node = { frequency: parameter(), connect() {}, disconnect() { this.disconnected = true; }, start() {}, stop() { this.stopped = true; } }; nodes.push(node); return node; },
  } };
  return { audio, nodes };
}

test('shared victory follows the existing death/reward sequence exactly and announces once', () => {
  const scene = dom(), component = mountVoxelVictory({ container: scene.container, resultCard: scene.card });
  const observe = sequencer(component), death = createEndPresentation(), original = createRoyaleRewardPresenter();
  for (const [phase, now] of [['fight', 0], ['matchEnd', 100], ['matchEnd', 1199], ['matchEnd', 1200], ['matchEnd', 2200], ['matchEnd', 3049], ['matchEnd', 3050], ['matchEnd', 6000]]) {
    const options = { contextKey: 'courtyard:7', won: true };
    const expected = original.observe(phase, now, { ...options, death: death.observe(phase, now, options) });
    assert.deepEqual(observe(phase, now), expected);
    assert.equal(scene.container.querySelector('.voxel-victory').hidden, !expected.visible);
  }
  const live = scene.container.querySelector('.voxel-victory-announcement');
  assert.equal(live.getAttribute('aria-live'), 'polite'); assert.equal(live.getAttribute('aria-atomic'), 'true');
  assert.equal(component.inspect().announcements, 1); assert.match(live.textContent, /MISSION COMPLETE.*Victory secured/);
  assert.equal(component.inspect().visible, false); assert.equal(component.inspect().audio.activeVoices, 0);
});

test('OS reduced motion shortens the accepted beat without changing authoritative result or replaying it', () => {
  const scene = dom({ reducedMotion: true }), component = mountVoxelVictory({ container: scene.container });
  const accepted = Object.freeze({ phase: 'matchEnd', winner: 0, tick: 270, hp: 19 });
  const observe = (now, death = {}) => component.observe({ phase: accepted.phase, now, contextKey: 'reduced', won: true, death });
  component.observe({ phase: 'fight', now: 0, contextKey: 'reduced' });
  assert.equal(observe(100, { holding: true, started: true, remainingMs: 400 }).stage, 'death');
  assert.equal(observe(500).remainingMs, 650);
  scene.document.reducedMotion = false;
  assert.equal(observe(1149).stage, 'victory');
  assert.equal(observe(1150).stage, 'results');
  assert.deepEqual(accepted, { phase: 'matchEnd', winner: 0, tick: 270, hp: 19 });
  assert.equal(component.inspect().announcements, 1);
});

test('late terminal joins and losses never manufacture a victory, celebration or audio', () => {
  for (const won of [false, true]) {
    const scene = dom(), sound = audioFixture(), component = mountVoxelVictory({ container: scene.container, audio: sound.audio });
    assert.equal(component.observe({ phase: 'matchEnd', now: 100, contextKey: 'joined', won, death: {} }).stage, 'results');
    assert.equal(component.observe({ phase: 'matchEnd', now: 999, contextKey: 'joined', won, death: {} }).visible, false);
    assert.equal(component.inspect().announcements, 0); assert.equal(sound.nodes.length, 0);
  }
  const scene = dom(), component = mountVoxelVictory({ container: scene.container }), observe = sequencer(component);
  observe('fight', 0); assert.equal(observe('matchEnd', 100, { won: false }).stage, 'death');
  assert.equal(observe('matchEnd', 1200, { won: false }).stage, 'results'); assert.equal(component.inspect().announcements, 0);
});

test('background cancellation, context change and reset cancel pending victory and fanfare', () => {
  const scene = dom(), sound = audioFixture(), component = mountVoxelVictory({ container: scene.container, audio: sound.audio });
  let observe = sequencer(component); observe('fight', 0); observe('matchEnd', 100);
  assert.equal(observe('matchEnd', 300, { eligible: false }).stage, 'results');
  assert.equal(observe('matchEnd', 1200).stage, 'results'); assert.equal(sound.nodes.length, 0);
  component.reset(); observe = sequencer(component, 'new-run'); observe('fight', 2000); observe('matchEnd', 2100); observe('matchEnd', 3200);
  assert.equal(component.inspect().audio.activeVoices, 6);
  assert.equal(observe('matchEnd', 3300, { contextKey: 'other-run' }).stage, 'results');
  assert.equal(component.inspect().audio.activeVoices, 0); assert.ok(sound.nodes.every(node => node.stopped && node.disconnected));
  component.reset(); assert.equal(component.inspect().reward.revealAt, null);
  assert.equal(scene.container.querySelector('.voxel-victory-announcement').textContent, '');
});

test('result decoration preserves existing IDs, real stats, button state and node identities then restores prior attributes', () => {
  const scene = dom(); scene.card.setAttribute('data-voxel-kind', 'pre-existing');
  const component = mountVoxelVictory({ container: scene.container, resultCard: scene.card, kind: 'royale' });
  for (let index = 0; index < 10; index++) component.decorateResult({ won: true, kicker: 'LAST SURVIVOR', title: 'Actual title', context: 'Paris · 3 eliminations', rank: '#1 / 10' });
  assert.equal(scene.card.querySelectorAll('.voxel-finish-hero').length, 1);
  assert.equal(scene.header.firstChild.className, 'voxel-finish-hero');
  assert.equal(scene.card.querySelector('#existing-title'), scene.title); assert.equal(scene.title.textContent, 'Authoritative finish');
  assert.equal(scene.card.querySelector('#existing-stats'), scene.stats); assert.equal(scene.stats.textContent, '204 damage');
  assert.equal(scene.card.querySelector('#existing-replay'), scene.button); assert.equal(scene.button.disabled, true);
  assert.equal(scene.card.getAttribute('data-voxel-result'), 'won'); assert.equal(scene.card.querySelector('.voxel-finish-rank').textContent, '#1 / 10');
  component.decorateResult({ won: false, kicker: 'RUN COMPLETE', context: 'Paris', rank: '#7 / 10' });
  assert.equal(scene.card.getAttribute('data-voxel-result'), 'lost'); assert.equal(scene.card.querySelector('.voxel-finish-rank').textContent, '#7 / 10');
  component.observe({ phase: 'fight', now: 100 });
  assert.equal(scene.card.querySelectorAll('.voxel-finish-hero').length, 0); assert.equal(scene.card.className, 'existing-card');
  assert.equal(scene.card.getAttribute('data-voxel-kind'), 'pre-existing'); assert.equal(scene.card.getAttribute('data-voxel-result'), null);
  assert.equal(scene.header.firstChild, scene.title);
});

test('every supported mode has a distinct pixel crest and dojo completion remains a neutral finish', () => {
  const symbols = new Set();
  for (const kind of ['breach', 'royale', 'horde', 'ember', 'wilds', 'dojo', 'shinobi']) {
    const scene = dom(), component = mountVoxelVictory({ container: scene.container, resultCard: scene.card, kind });
    component.decorateResult({ won: false });
    assert.equal(scene.card.getAttribute('data-voxel-kind'), kind); assert.equal(scene.card.getAttribute('data-voxel-result'), 'lost');
    symbols.add(scene.card.querySelector('.voxel-crest-symbol').getAttribute('d'));
    if (kind === 'dojo') assert.equal(scene.card.querySelector('.voxel-finish-label').textContent, 'TRAINING COMPLETE');
    component.destroy();
  }
  assert.equal(symbols.size, 7);
  const scene = dom(), fallback = mountVoxelVictory({ container: scene.container, kind: 'invalid' }); assert.equal(fallback.inspect().kind, 'breach');
});

test('many high refresh observations retain bounded DOM and audio; muted wins cannot play delayed sound', () => {
  const scene = dom(), sound = audioFixture(), component = mountVoxelVictory({ container: scene.container, audio: sound.audio });
  const observe = sequencer(component); observe('fight', 0); observe('matchEnd', 100); observe('matchEnd', 1200);
  const writes = scene.document.writes;
  for (let frame = 1; frame <= 350; frame++) observe('matchEnd', 1200 + frame * 1000 / 240);
  assert.equal(scene.document.writes, writes, 'cosmetic progress does not rewrite DOM every refresh');
  assert.equal(component.inspect().particles, 8); assert.equal(sound.nodes.length, 6); assert.equal(component.inspect().announcements, 1);
  sound.audio.enabled = false; observe('matchEnd', 2700); assert.equal(component.inspect().audio.activeVoices, 0);
  sound.audio.enabled = true; observe('matchEnd', 2800); assert.equal(sound.nodes.length, 6);
  observe('matchEnd', 3050); assert.equal(component.inspect().visible, false);
});

test('a truthful nonblocking milestone uses the same finite clock and can be reset for the next day or wave', () => {
  const scene = dom(), component = mountVoxelVictory({ container: scene.container, kind: 'wilds' });
  const accepted = Object.freeze({ phase: 'explore', day: 3, hp: 68 });
  const options = { phase: 'matchEnd', now: 100, contextKey: 'night:2', won: true, milestone: true, death: { started: true, remainingMs: 0 }, kicker: 'NIGHT SURVIVED', title: 'Dawn breaks.', copy: 'Night 2 · 68 health remaining' };
  assert.equal(component.observe(options).stage, 'victory'); assert.equal(component.inspect().milestone, true);
  const overlay = scene.container.querySelector('.voxel-victory'); assert.equal(overlay.getAttribute('data-milestone'), 'true');
  assert.equal(component.observe({ ...options, now: 1950, death: {} }).stage, 'results');
  assert.deepEqual(accepted, { phase: 'explore', day: 3, hp: 68 });
  component.observe({ phase: 'fight', now: 2000, contextKey: 'night:3' });
  assert.equal(scene.container.querySelector('.voxel-victory-announcement').textContent, '', 'returning to gameplay clears the prior live announcement so identical future wins can announce once');
  assert.equal(component.observe({ ...options, now: 2100, contextKey: 'night:3' }).started, true);
  assert.equal(component.inspect().announcements, 2);
  assert.match(scene.container.querySelector('.voxel-victory-announcement').textContent, /NIGHT SURVIVED.*Dawn breaks/);
});

test('destroy removes all owned DOM and audio, is idempotent and leaves later observations harmless', () => {
  const scene = dom(), sound = audioFixture(), component = mountVoxelVictory({ container: scene.container, resultCard: scene.card, audio: sound.audio });
  component.decorateResult({ won: true }); component.observe({ phase: 'matchEnd', now: 0, contextKey: 1, won: true, death: { started: true, remainingMs: 0 } });
  assert.equal(sound.nodes.length, 6); component.destroy(); component.destroy();
  assert.deepEqual(scene.container.children, [scene.card]); assert.equal(scene.header.firstChild, scene.title);
  assert.equal(component.inspect().audio.activeVoices, 0); assert.equal(component.inspect().destroyed, true);
  assert.equal(component.observe({ phase: 'matchEnd', now: 10, won: true, death: { started: true } }).stage, 'results');
  component.decorateResult({ won: true }); assert.equal(scene.card.querySelector('.voxel-finish-hero'), null);
  assert.ok(sound.nodes.every(node => node.stopped && node.disconnected));
});
