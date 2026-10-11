import { createRoyaleRewardPresenter, createRoyaleRewardAudio } from './voxel-royale-reward.js';

const SVG = 'http://www.w3.org/2000/svg';
const FINISHES = Object.freeze({
  breach: { kicker: 'MISSION COMPLETE', title: 'Victory secured.', mark: 'BREACH', path: 'M28 12h8v8h8v8h-8v8h-8v-8h-8v-8h8z', accent: 'M8 8h8v8H8zm40 0h8v8h-8zM8 48h8v8H8zm40 0h8v8h-8z' },
  royale: { kicker: 'LAST SURVIVOR', title: 'The arena is yours.', mark: 'ROYALE', path: 'M12 20h8v8h8V12h8v16h8v-8h8v24H12z', accent: 'M12 44h40v8H12zM12 16h8v4h-8zm32 0h8v4h-8zM28 8h8v4h-8z' },
  horde: { kicker: 'WAVE CLEARED', title: 'Hold the line.', mark: 'LAST STAND', path: 'M28 12h8v8h12v8H36v24h-8V28H16v-8h12z', accent: 'M12 36h8v12h-8zm32 0h8v12h-8zM24 8h16v4H24z' },
  ember: { kicker: 'DESCENT COMPLETE', title: 'Rise from the embers.', mark: 'EMBER DELVE', path: 'M28 8h8v12h8v12h8v12H40v12H24V44H12V32h8V20h8zm0 28v12h8V36z', accent: 'M28 36h8v12h-8zM16 44h8v4h-8zm24 0h8v4h-8z' },
  wilds: { kicker: 'EXPEDITION COMPLETE', title: 'You made the wilds yours.', mark: 'VOXEL WILDS', path: 'M28 8h8v8h8v8h8v8H36v8h8v8H36v8h-8v-8H16v-8h12v-8H12v-8h8v-8h8z', accent: 'M8 48h8v8H8zm40 0h8v8h-8zM28 52h8v8h-8z' },
  dojo: { kicker: 'TRAINING COMPLETE', title: 'Your next move starts here.', mark: 'VOXEL DOJO', path: 'M8 16h48v8H8zm8 8h8v32h-8zm24 0h8v32h-8zM24 32h16v8H24z', accent: 'M12 8h40v8H12zM8 52h48v4H8z' },
});

const idle = phase => ({ stage: phase === 'matchEnd' ? 'results' : 'idle', holding: false, visible: false, started: false, remainingMs: 0, progress: 0 });
const write = (node, value) => { const next = String(value ?? ''); if (node.textContent !== next) node.textContent = next; };
const attribute = (node, name, value) => { const next = String(value); if (node.getAttribute(name) !== next) node.setAttribute(name, next); };

function crest(document, kind) {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 64 64');
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.classList.add('voxel-finish-crest');
  const paths = [
    ['voxel-crest-shadow', 'M8 4h48v8h8v44h-8v8H8v-8H0V12h8z'],
    ['voxel-crest-frame', 'M8 0h48v8h8v44h-8v8H8v-8H0V8h8zm4 8v4H8v36h4v4h40v-4h4V12h-4V8z'],
    ['voxel-crest-inset', 'M12 8h40v4h4v36h-4v4H12v-4H8V12h4z'],
    ['voxel-crest-symbol', FINISHES[kind].path],
    ['voxel-crest-highlight', FINISHES[kind].accent],
  ];
  for (const [className, d] of paths) {
    const path = document.createElementNS(SVG, 'path');
    path.classList.add(className); path.setAttribute('d', d); svg.append(path);
  }
  return svg;
}

/** Cosmetic finish UI only: the caller retains the authoritative state and clock. */
export function mountVoxelVictory({ container, resultCard = null, kind = 'breach', audio = null } = {}) {
  if (!container?.ownerDocument?.createElement) throw new TypeError('Voxel victory needs a DOM container.');
  kind = Object.hasOwn(FINISHES, kind) ? kind : 'breach';
  const document = container.ownerDocument, defaults = FINISHES[kind];
  const reward = createRoyaleRewardPresenter(), fanfare = createRoyaleRewardAudio(audio);
  let destroyed = false, visible = false, announcements = 0, hero = null, decorated = false, milestone = false;
  let lastView = idle();
  let originalKind = null, originalResult = null, originallyClassed = false;
  const make = (tag, className, parent) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (parent) parent.append(node);
    return node;
  };
  const overlay = make('div', 'voxel-victory', container);
  overlay.hidden = true; overlay.setAttribute('aria-hidden', 'true'); overlay.setAttribute('data-voxel-kind', kind);
  make('div', 'voxel-victory-rays', overlay);
  const pixels = make('div', 'voxel-victory-pixels', overlay);
  for (let index = 0; index < 8; index++) make('i', '', pixels);
  const board = make('div', 'voxel-victory-board', overlay);
  const medal = make('div', 'voxel-victory-medal', board); medal.append(crest(document, kind));
  const brand = make('img', 'voxel-victory-brand', medal);
  brand.setAttribute('src', '/hub/logo.svg'); brand.setAttribute('alt', 'semaG'); brand.setAttribute('width', '96'); brand.setAttribute('height', '24');
  const kicker = make('p', 'voxel-victory-kicker', board);
  const title = make('h2', 'voxel-victory-title', board);
  const copy = make('p', 'voxel-victory-copy', board);
  const rule = make('div', 'voxel-victory-rule', board);
  const mark = make('span', 'voxel-victory-mark', rule); write(mark, defaults.mark);
  const live = make('div', 'voxel-victory-announcement', container);
  live.setAttribute('role', 'status'); live.setAttribute('aria-live', 'polite'); live.setAttribute('aria-atomic', 'true');

  function clearDecoration() {
    if (!decorated || !resultCard) return;
    hero?.remove(); hero = null;
    if (!originallyClassed) resultCard.classList.remove('voxel-finish-card');
    for (const [name, previous] of [['data-voxel-kind', originalKind], ['data-voxel-result', originalResult]]) {
      if (previous === null) resultCard.removeAttribute(name); else resultCard.setAttribute(name, previous);
    }
    decorated = false;
  }
  function hide() { if (visible) { overlay.hidden = true; visible = false; } }
  function observe(options = {}) {
    if (destroyed) return idle(options.phase);
    const reducedMotion = !!options.reducedMotion || !!document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const view = reward.observe(options.phase, options.now, { ...options, reducedMotion });
    lastView = view; attribute(overlay, 'data-stage', view.stage);
    fanfare.observe(view, { eligible: options.eligible !== false });
    if (options.phase !== 'matchEnd') { clearDecoration(); write(live, ''); }
    if (!view.visible) hide();
    else {
      if (!visible) { overlay.hidden = false; visible = true; }
      milestone = !!options.milestone; attribute(overlay, 'data-milestone', milestone);
      attribute(overlay, 'data-reduced-motion', reducedMotion);
      write(kicker, options.kicker || defaults.kicker);
      write(title, options.title || defaults.title);
      write(copy, options.copy || 'Take a breath. You earned this.');
      if (view.started) {
        // The visual board is decorative. Exactly one polite live announcement
        // carries the accepted victory to screen readers, including muted wins.
        write(live, `${options.kicker || defaults.kicker}. ${options.title || defaults.title}`);
        announcements++;
      }
    }
    return view;
  }
  function decorateResult({ won = false, kicker = '', title = '', context = '', rank = '' } = {}) {
    if (destroyed || !resultCard) return;
    if (!decorated) {
      originalKind = resultCard.getAttribute('data-voxel-kind');
      originalResult = resultCard.getAttribute('data-voxel-result');
      originallyClassed = resultCard.classList.contains('voxel-finish-card');
      resultCard.classList.add('voxel-finish-card');
      hero = make('div', 'voxel-finish-hero');
      const icon = make('div', 'voxel-finish-medal', hero); icon.append(crest(document, kind));
      const labels = make('div', 'voxel-finish-award', hero);
      make('span', 'voxel-finish-label', labels);
      make('strong', 'voxel-finish-rank', labels);
      make('span', 'voxel-finish-context', labels);
      const heading = resultCard.querySelector('h2, h1, h3');
      const host = heading?.parentElement || resultCard;
      host.insertBefore(hero, host.firstChild);
      decorated = true;
    }
    attribute(resultCard, 'data-voxel-kind', kind);
    attribute(resultCard, 'data-voxel-result', won ? 'won' : 'lost');
    const label = hero.querySelector('.voxel-finish-label'), rankNode = hero.querySelector('.voxel-finish-rank'), contextNode = hero.querySelector('.voxel-finish-context');
    write(label, kicker || (won ? defaults.kicker : kind === 'dojo' ? 'TRAINING COMPLETE' : 'RUN COMPLETE'));
    write(rankNode, rank); rankNode.hidden = !rank;
    write(contextNode, context || title || defaults.mark);
    // Existing IDs, headings, controls, statistics, focus and action gates stay
    // intact. This badge never invents score, placement or an accepted win.
  }
  function reset() {
    if (destroyed) return;
    reward.reset(); fanfare.reset(); hide(); clearDecoration(); write(live, ''); lastView = idle(); milestone = false; attribute(overlay, 'data-stage', 'idle');
  }
  function destroy() {
    if (destroyed) return;
    reset(); fanfare.destroy(); overlay.remove(); live.remove(); destroyed = true;
  }
  return Object.freeze({ observe, decorateResult, reset, destroy, inspect: () => ({ kind, destroyed, visible, decorated, milestone, announcements, particles: pixels.children.length, view: { ...lastView }, reward: reward.inspect(), audio: fanfare.inspect() }) });
}
