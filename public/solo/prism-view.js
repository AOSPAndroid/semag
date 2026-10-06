import {
  WIDTH, VISIBLE_HEIGHT, HIDDEN_ROWS, SHAPES, pieceCells, ghostPiece,
  createState, dispatch, step, togglePause as pauseState,
} from './prism-engine.js';

const COLORS = {
  I: ['#78d4cf', '#b1f0e8', '#439b9e'], J: ['#7e9ee9', '#b5c9fa', '#4e68ab'],
  L: ['#eaa66b', '#f8d0a1', '#ac7449'], O: ['#e7ce71', '#f8e8ac', '#a7924e'],
  S: ['#96c787', '#c9e6b1', '#65965a'], T: ['#b996d3', '#dfc5ed', '#806497'],
  Z: ['#dc8d8b', '#f5bfba', '#a85e62'],
};
const KEY_ACTIONS = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'softDrop', ArrowUp: 'rotateCW',
  x: 'rotateCW', X: 'rotateCW', z: 'rotateCCW', Z: 'rotateCCW',
  c: 'hold', C: 'hold', Shift: 'hold', ' ': 'hardDrop',
};
const ENGINE_ACTIONS = {
  left: 'left', right: 'right', softDrop: 'soft-drop', rotateCW: 'rotate-cw',
  rotateCCW: 'rotate-ccw', hardDrop: 'hard-drop', hold: 'hold',
};
const isForm = target => target instanceof Element
  && Boolean(target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])'));
const element = (tag, className, text) => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

export function mount(container, { onUpdate = () => {} } = {}) {
  let state = createState({ mode: 'marathon' });
  let destroyed = false;
  let animationId = null;
  let lastFrame = 0;
  let accumulator = 0;
  let updateElapsed = 0;
  let priority = null;
  let repeatElapsed = 0;
  let repeatNext = .14;
  let observedLocks = state.piecesLocked;
  let effect = null;
  const sources = new Map();
  const pointers = new Map();

  const view = element('section', 'prism-view');
  view.setAttribute('aria-label', 'Prism Shift falling block game');
  const top = element('div', 'prism-topline');
  const brand = element('span', 'prism-brand', 'PRISM SHIFT');
  const modes = element('div', 'prism-mode');
  modes.setAttribute('role', 'group');
  modes.setAttribute('aria-label', 'Choose game mode. Changing mode starts a fresh game.');
  for (const [mode, text] of [['marathon', 'Marathon'], ['sprint', 'Sprint 40']]) {
    const button = element('button', '', text);
    button.type = 'button';
    button.dataset.mode = mode;
    button.setAttribute('aria-pressed', String(mode === state.mode));
    modes.append(button);
  }
  top.append(brand, modes);

  const metrics = element('div', 'prism-metrics');
  const metricNodes = {};
  for (const [name, label] of [['level', 'LEVEL'], ['lines', 'LINES'], ['time', 'TIME']]) {
    const item = element('div', `prism-metric prism-${name}`);
    const value = element('strong', '', '0');
    item.append(element('span', '', label), value);
    metrics.append(item);
    metricNodes[name] = value;
  }
  const boardZone = element('div', 'prism-stage');
  const board = element('div', 'prism-board');
  const canvas = element('canvas', 'prism-canvas');
  canvas.width = 300;
  canvas.height = 600;
  canvas.tabIndex = 0;
  canvas.dataset.soloFocus = '';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Falling block board. Arrow keys move, up rotates, space drops, C holds.');
  board.append(canvas);

  const rail = element('aside', 'prism-rail');
  rail.setAttribute('aria-label', 'Held piece and upcoming pieces');
  const holdPanel = element('div', 'prism-preview-panel prism-hold-panel');
  const holdHeading = element('div', 'prism-preview-heading');
  holdHeading.append(element('span', '', 'HOLD'), element('kbd', '', 'C'));
  const holdCanvas = element('canvas', 'prism-hold-canvas');
  holdCanvas.width = 120;
  holdCanvas.height = 64;
  holdCanvas.setAttribute('role', 'img');
  holdCanvas.setAttribute('aria-label', 'No piece held');
  holdPanel.append(holdHeading, holdCanvas);
  const nextPanel = element('div', 'prism-preview-panel prism-next-panel');
  nextPanel.append(element('div', 'prism-preview-heading', 'NEXT'));
  const nextCanvases = [];
  for (let i = 0; i < 5; i += 1) {
    const preview = element('canvas', 'prism-next-canvas');
    preview.width = 120;
    preview.height = 56;
    preview.setAttribute('role', 'img');
    nextPanel.append(preview);
    nextCanvases.push(preview);
  }
  const chain = element('div', 'prism-chain');
  const combo = element('strong', 'prism-combo', 'BUILD A CHAIN');
  const b2b = element('span', 'prism-b2b', 'TETRIS / T-SPIN');
  const clearLabel = element('p', 'prism-clear-label', 'Find your rhythm.');
  chain.append(combo, b2b, clearLabel);
  rail.append(holdPanel, nextPanel, chain);
  boardZone.append(board, rail);

  const footer = element('div', 'prism-footer');
  const status = element('p', 'prism-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  const controls = element('div', 'prism-controls');
  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', 'Move, rotate, hold, and drop pieces');
  const controlsInfo = [
    ['left', '←', 'Move left'], ['rotateCCW', '↶', 'Rotate counterclockwise'],
    ['rotateCW', '↷', 'Rotate clockwise'], ['right', '→', 'Move right'],
    ['hold', 'HOLD', 'Hold piece'], ['softDrop', '↓', 'Soft drop'],
    ['hardDrop', 'DROP', 'Hard drop'],
  ];
  for (const [action, text, label] of controlsInfo) {
    const button = element('button', 'prism-control', text);
    button.type = 'button';
    button.dataset.action = action;
    button.setAttribute('aria-label', label);
    controls.append(button);
  }
  footer.append(status, controls);
  view.append(top, metrics, boardZone, footer);
  container.append(view);
  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  function block(context, x, y, size, type, ghost = false) {
    const palette = COLORS[type] || COLORS.T;
    const px = Math.round(x), py = Math.round(y), edge = Math.max(1, Math.round(size));
    const gap = Math.max(1, Math.round(size * .065));
    if (ghost) {
      context.strokeStyle = `${palette[0]}99`;
      context.lineWidth = Math.max(1, size * .065);
      context.strokeRect(px + gap + .5, py + gap + .5, edge - gap * 2 - 1, edge - gap * 2 - 1);
      context.fillStyle = `${palette[0]}16`;
      context.fillRect(px + gap + 1, py + gap + 1, edge - gap * 2 - 2, edge - gap * 2 - 2);
      return;
    }
    context.fillStyle = palette[2];
    context.fillRect(px + gap, py + gap, edge - gap * 2, edge - gap * 2);
    context.fillStyle = palette[0];
    context.fillRect(px + gap, py + gap, edge - gap * 2, edge - gap * 2 - Math.max(2, edge * .13));
    context.fillStyle = palette[1];
    context.fillRect(px + gap + 1, py + gap + 1, edge - gap * 2 - 2, Math.max(1, Math.round(size * .12)));
    context.fillStyle = `${palette[1]}66`;
    context.fillRect(px + gap + 1, py + gap + 1, Math.max(1, Math.round(size * .09)), edge - gap * 2 - 3);
  }

  function preview(target, type, dimmed = false) {
    const context = target.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, target.width, target.height);
    context.imageSmoothingEnabled = false;
    if (!type) {
      context.fillStyle = '#819584';
      context.font = '9px ui-monospace, monospace';
      context.textAlign = 'center';
      context.fillText('PRESS C', target.width / 2, target.height / 2 + 3);
      return;
    }
    const cells = SHAPES[type][0];
    const minX = Math.min(...cells.map(cell => cell.x)), maxX = Math.max(...cells.map(cell => cell.x));
    const minY = Math.min(...cells.map(cell => cell.y)), maxY = Math.max(...cells.map(cell => cell.y));
    const size = 19;
    const offsetX = (target.width - (maxX - minX + 1) * size) / 2;
    const offsetY = (target.height - (maxY - minY + 1) * size) / 2;
    context.globalAlpha = dimmed ? .48 : 1;
    for (const cell of cells) block(context, offsetX + (cell.x - minX) * size, offsetY + (cell.y - minY) * size, size, type);
    context.globalAlpha = 1;
  }

  function draw(now = performance.now()) {
    if (destroyed || !ctx) return;
    if (typeof now !== 'number') now = performance.now();
    const size = Math.max(1, canvas.getBoundingClientRect().width || 300);
    const ratio = Math.min(window.devicePixelRatio || 1, 3);
    const width = Math.max(10, Math.round(size * ratio));
    if (canvas.width !== width || canvas.height !== width * 2) {
      canvas.width = width;
      canvas.height = width * 2;
    }
    const cell = width / WIDTH;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#1c3435';
    ctx.fillRect(0, 0, width, width * 2);
    for (let y = 0; y < VISIBLE_HEIGHT; y += 1) {
      for (let x = 0; x < WIDTH; x += 1) {
        ctx.fillStyle = (x + y) % 2 ? '#20393a' : '#1e3738';
        ctx.fillRect(Math.round(x * cell) + 1, Math.round(y * cell) + 1, Math.round(cell) - 1, Math.round(cell) - 1);
        const type = state.board[y + HIDDEN_ROWS][x];
        if (type) block(ctx, x * cell, y * cell, cell, type);
      }
    }
    if (state.active) {
      const ghost = ghostPiece(state);
      if (ghost && (ghost.y !== state.active.y || ghost.x !== state.active.x)) {
        for (const part of pieceCells(ghost)) {
          if (part.y >= HIDDEN_ROWS) block(ctx, part.x * cell, (part.y - HIDDEN_ROWS) * cell, cell, ghost.type, true);
        }
      }
      for (const part of pieceCells(state.active)) {
        if (part.y >= HIDDEN_ROWS) block(ctx, part.x * cell, (part.y - HIDDEN_ROWS) * cell, cell, state.active.type);
      }
      if (state.lockElapsed > 0 && state.phase === 'playing') {
        const progress = Math.min(1, state.lockElapsed / .5);
        ctx.fillStyle = '#f2e9bc';
        ctx.fillRect(0, canvas.height - Math.max(2, ratio * 2), canvas.width * progress, Math.max(2, ratio * 2));
      }
    }
    if (effect && !reduceMotion) {
      const progress = Math.max(0, 1 - (now - effect.time) / 330);
      if (!progress) effect = null;
      else if (effect.lines > 0) {
        ctx.fillStyle = `rgba(236,226,179,${progress * .09})`;
        ctx.fillRect(0, 0, width, width * 2);
        ctx.strokeStyle = `rgba(236,226,179,${progress * .7})`;
        ctx.lineWidth = Math.max(2, ratio * 2);
        ctx.strokeRect(1, 1, width - 2, width * 2 - 2);
      } else {
        for (const part of effect.cells) {
          if (part.y < HIDDEN_ROWS) continue;
          ctx.strokeStyle = `rgba(247,236,198,${progress * .7})`;
          ctx.lineWidth = Math.max(1, ratio);
          ctx.strokeRect(part.x * cell + 2, (part.y - HIDDEN_ROWS) * cell + 2, cell - 4, cell - 4);
        }
      }
    }
    if (state.phase !== 'playing') {
      ctx.fillStyle = '#142d31dc';
      ctx.fillRect(0, 0, width, width * 2);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#f3e9c2';
      ctx.font = `bold ${Math.round(width * .079)}px ui-monospace, monospace`;
      ctx.fillText({ paused: 'PAUSED', won: '40 LINES', lost: 'STACK FILLED' }[state.phase], width / 2, width * .89);
      ctx.fillStyle = '#b5cbbc';
      ctx.font = `${Math.max(8, Math.round(width * .044))}px ui-monospace, monospace`;
      const line = state.phase === 'paused' ? 'P / RESUME' : state.phase === 'won' ? `${state.elapsed.toFixed(2)} SECONDS` : `${state.score.toLocaleString()} POINTS`;
      ctx.fillText(line, width / 2, width * 1.02);
      if (state.phase !== 'paused') {
        ctx.font = `${Math.max(7, Math.round(width * .033))}px ui-monospace, monospace`;
        ctx.fillText('R / NEW GAME', width / 2, width * 1.13);
      }
    }
  }

  function detail() {
    if (state.phase === 'paused') return 'Paused. Your next move can wait.';
    if (state.phase === 'won') return `Forty lines in ${state.elapsed.toFixed(2)} seconds. Chase a cleaner, faster sprint.`;
    if (state.phase === 'lost') return 'The stack reached the top. Start fresh and leave room for your next piece.';
    return state.mode === 'sprint'
      ? `${Math.max(0, 40 - state.lines)} lines to go. Plan ahead, place quickly, and keep the stack clean.`
      : 'Build four-line clears and T-spins. Chain difficult clears for a bigger score.';
  }

  function publish() {
    if (destroyed) return;
    const message = detail();
    metricNodes.level.textContent = String(state.level);
    metricNodes.lines.textContent = state.mode === 'sprint' ? `${Math.min(state.lines, 40)} / 40` : String(state.lines);
    metricNodes.time.textContent = state.elapsed.toFixed(2);
    if (status.textContent !== message) status.textContent = message;
    combo.textContent = state.combo > 0 ? `COMBO ×${state.combo + 1}` : 'BUILD A CHAIN';
    b2b.textContent = state.backToBack ? 'BACK TO BACK' : 'TETRIS / T-SPIN';
    chain.dataset.active = String(state.backToBack || state.combo > 0);
    clearLabel.textContent = state.lastClear?.label || 'Find your rhythm.';
    holdPanel.dataset.used = String(state.holdUsed);
    holdCanvas.setAttribute('aria-label', state.hold ? `Held ${state.hold} piece${state.holdUsed ? '. Available after your next lock.' : ''}` : 'No piece held. Press C to hold the active piece.');
    preview(holdCanvas, state.hold, state.holdUsed);
    nextCanvases.forEach((target, i) => {
      target.setAttribute('aria-label', `Next piece ${i + 1}: ${state.next[i] || 'empty'}`);
      preview(target, state.next[i]);
    });
    modes.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === state.mode)));
    canvas.setAttribute('aria-label', `Prism Shift ${state.mode}. ${state.lines} lines, level ${state.level}, ${state.score} points. ${message}`);
    const sprint = state.mode === 'sprint';
    onUpdate({
      phase: state.phase, mode: state.mode, score: sprint ? Number(state.elapsed.toFixed(2)) : state.score,
      scoreLabel: sprint ? 'TIME' : 'SCORE', scoreDigits: sprint ? 2 : 0, scoreUnit: sprint ? 's' : '',
      record: sprint ? (state.phase === 'won' ? state.elapsed : null) : state.score,
      recordKey: state.mode, recordDirection: sprint ? 'min' : 'max',
      recordLabel: sprint ? 'BEST 40 LINES' : 'BEST SCORE', detail: message,
    });
    updateElapsed = 0;
  }

  function noticeLock(oldPiece) {
    if (state.piecesLocked === observedLocks) return;
    observedLocks = state.piecesLocked;
    effect = { time: performance.now(), lines: state.lastClear?.lines || 0, cells: oldPiece ? pieceCells(oldPiece) : [] };
    publish();
  }

  function act(action) {
    if (destroyed || state.phase !== 'playing') return;
    const oldPiece = state.active ? (action === 'hardDrop' ? ghostPiece(state) : { ...state.active }) : null;
    dispatch(state, ENGINE_ACTIONS[action]);
    noticeLock(oldPiece);
    if (state.phase !== 'playing') releaseInputs();
    publish();
    draw();
  }

  const held = action => [...sources.values()].includes(action);
  function press(action, source) {
    if (destroyed || state.phase !== 'playing' || sources.has(source)) return;
    sources.set(source, action);
    if (action === 'left' || action === 'right') {
      priority = action;
      repeatElapsed = 0;
      repeatNext = .14;
    }
    act(action);
  }

  function release(source) {
    const action = sources.get(source);
    sources.delete(source);
    if (action && action === priority && !held(action)) {
      const opposite = action === 'left' ? 'right' : 'left';
      priority = held(opposite) ? opposite : null;
      repeatElapsed = 0;
      repeatNext = .14;
      if (priority && state.phase === 'playing') act(priority);
    }
  }

  function releaseInputs() {
    sources.clear();
    priority = null;
    repeatElapsed = 0;
    repeatNext = .14;
    for (const [pointerId, button] of pointers) {
      button.classList.remove('is-held');
      try { if (button.hasPointerCapture(pointerId)) button.releasePointerCapture(pointerId); } catch {}
    }
    pointers.clear();
  }

  function togglePause() {
    if (destroyed) return;
    releaseInputs();
    if (!pauseState(state)) return;
    accumulator = 0;
    lastFrame = 0;
    publish();
    draw();
  }

  function autoPause() {
    releaseInputs();
    if (state.phase === 'playing') togglePause();
  }

  function restart(mode = state.mode) {
    if (destroyed) return;
    releaseInputs();
    state = createState({ mode });
    effect = null;
    observedLocks = state.piecesLocked;
    lastFrame = 0;
    accumulator = 0;
    publish();
    draw();
  }

  function frame(now) {
    if (destroyed) return;
    const delta = lastFrame ? Math.min(.05, Math.max(0, (now - lastFrame) / 1000)) : 0;
    lastFrame = now;
    if (state.phase === 'playing') {
      accumulator += delta;
      const interval = 1 / 120;
      while (accumulator >= interval && state.phase === 'playing') {
        if (priority && held(priority)) {
          repeatElapsed += interval;
          while (repeatElapsed >= repeatNext) {
            dispatch(state, ENGINE_ACTIONS[priority]);
            repeatNext += .03;
          }
        }
        const oldPiece = state.active ? { ...state.active } : null;
        step(state, { softDrop: held('softDrop') }, interval);
        noticeLock(oldPiece);
        accumulator -= interval;
        updateElapsed += interval;
      }
      if (state.phase !== 'playing') {
        releaseInputs();
        accumulator = 0;
        publish();
      } else if (updateElapsed >= .1) publish();
    }
    draw(now);
    animationId = window.requestAnimationFrame(frame);
  }

  function keydown(event) {
    if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || isForm(event.target)) return;
    const action = KEY_ACTIONS[event.key];
    if (event.key === 'Escape') {
      event.preventDefault();
      if (!event.repeat) togglePause();
      return;
    }
    if (!action || (action === 'hardDrop' && event.target instanceof Element && event.target.closest('button,a'))) return;
    event.preventDefault();
    if (event.repeat) return;
    press(action, `key:${event.code || event.key}`);
  }
  const keyup = event => release(`key:${event.code || event.key}`);
  const focusCanvas = () => canvas.focus({ preventScroll: true });
  function pointerdown(event) {
    const button = event.target.closest('.prism-control[data-action]');
    if (!button || !controls.contains(button) || state.phase !== 'playing') return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    focusCanvas();
    try { button.setPointerCapture(event.pointerId); } catch {}
    pointers.set(event.pointerId, button);
    button.classList.add('is-held');
    press(button.dataset.action, `pointer:${event.pointerId}`);
  }
  function pointerend(event) {
    const button = pointers.get(event.pointerId);
    if (!button) return;
    release(`pointer:${event.pointerId}`);
    pointers.delete(event.pointerId);
    if (![...pointers.values()].includes(button)) button.classList.remove('is-held');
    try { if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId); } catch {}
  }
  function clickControl(event) {
    if (event.detail !== 0) return;
    const button = event.target.closest('.prism-control[data-action]');
    if (button && controls.contains(button)) act(button.dataset.action);
  }
  function changeMode(event) {
    const button = event.target.closest('button[data-mode]');
    if (!button || !modes.contains(button) || button.dataset.mode === state.mode) return;
    restart(button.dataset.mode);
    focusCanvas();
  }
  const visibility = () => { if (document.hidden) autoPause(); };
  const pageHidden = () => autoPause();
  window.addEventListener('keydown', keydown);
  window.addEventListener('keyup', keyup);
  window.addEventListener('blur', autoPause);
  window.addEventListener('pagehide', pageHidden);
  document.addEventListener('visibilitychange', visibility);
  canvas.addEventListener('pointerdown', focusCanvas);
  controls.addEventListener('pointerdown', pointerdown);
  controls.addEventListener('pointerup', pointerend);
  controls.addEventListener('pointercancel', pointerend);
  controls.addEventListener('lostpointercapture', pointerend);
  controls.addEventListener('click', clickControl);
  modes.addEventListener('click', changeMode);
  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(() => draw()) : null;
  if (resizeObserver) resizeObserver.observe(canvas);
  else window.addEventListener('resize', draw);
  publish();
  draw();
  animationId = window.requestAnimationFrame(frame);

  return {
    getState: () => JSON.parse(JSON.stringify(state)),
    restart: () => restart(), togglePause,
    destroy() {
      if (destroyed) return;
      releaseInputs();
      destroyed = true;
      if (animationId !== null) window.cancelAnimationFrame(animationId);
      resizeObserver?.disconnect();
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
      window.removeEventListener('blur', autoPause);
      window.removeEventListener('pagehide', pageHidden);
      window.removeEventListener('resize', draw);
      document.removeEventListener('visibilitychange', visibility);
      canvas.removeEventListener('pointerdown', focusCanvas);
      controls.removeEventListener('pointerdown', pointerdown);
      controls.removeEventListener('pointerup', pointerend);
      controls.removeEventListener('pointercancel', pointerend);
      controls.removeEventListener('lostpointercapture', pointerend);
      controls.removeEventListener('click', clickControl);
      modes.removeEventListener('click', changeMode);
      view.remove();
    },
  };
}
