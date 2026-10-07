import {
  WIDTH,
  VISIBLE_HEIGHT,
  HIDDEN_ROWS,
  SHAPES,
  pieceCells,
  ghostPiece,
  createState,
  dispatch,
  step,
  togglePause as pauseState,
  PROFILES,
  getProfile,
  recordScope,
  timeRemaining,
  lockDelayFor,
  lockResetLimit,
  getDigStages,
  getDigStageCount,
  getDigStage,
  advanceDigStage,
} from './prism-engine.js';
import { gameKey, getKeyboardLayout, displayKey, subscribeKeyboardLayout } from '../keyboard-layout.js';

const COLORS = {
  I: ['#70ced7', '#c4f3f3', '#347f91'],
  J: ['#82a5ec', '#ccdcff', '#435f9e'],
  L: ['#edac79', '#ffe0b5', '#a66340'],
  O: ['#e9cf77', '#fff1ba', '#9b813b'],
  S: ['#9bcf95', '#d6efbf', '#5a905c'],
  T: ['#b295e0', '#e5d0ff', '#705792'],
  Z: ['#e09398', '#ffd0d0', '#a85868'],
  G: ['#7d8d86', '#bac3a8', '#4a615e'],
};
const KEY_ACTIONS = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowDown: 'softDrop',
  ArrowUp: 'rotateCW',
  a: 'left',
  A: 'left',
  d: 'right',
  D: 'right',
  s: 'softDrop',
  S: 'softDrop',
  w: 'rotateCW',
  W: 'rotateCW',
  x: 'rotateCW',
  X: 'rotateCW',
  z: 'rotateCCW',
  Z: 'rotateCCW',
  c: 'hold',
  C: 'hold',
  Shift: 'hold',
  ' ': 'hardDrop',
};
const ENGINE_ACTIONS = {
  left: 'left',
  right: 'right',
  softDrop: 'soft-drop',
  rotateCW: 'rotate-cw',
  rotateCCW: 'rotate-ccw',
  hardDrop: 'hard-drop',
  hold: 'hold',
};
const isForm = (target) =>
  target instanceof Element &&
  Boolean(target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])'));
function setValue(target, key, value) {
  if (target[key] !== value) target[key] = value;
}
function setAttribute(target, key, value) {
  if (target.getAttribute(key) !== value) target.setAttribute(key, value);
}
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
  let repeatNext = 0.14;
  let observedLocks = state.piecesLocked;
  let effect = null;
  let dropEffect = null;
  let canvasCssWidth = 300;
  const sources = new Map();
  const pointers = new Map();

  const view = element('section', 'prism-view');
  view.setAttribute('aria-label', 'Prism Shift falling block game');
  const top = element('div', 'prism-topline');
  const brand = element('div', 'prism-brand');
  const mark = element('span', 'prism-mark');
  mark.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 4; i += 1) mark.append(element('i', ''));
  const brandWords = element('div', 'prism-brand-words');
  brandWords.append(element('strong', '', 'PRISM SHIFT'), element('span', '', 'PRECISION OVER PANIC'));
  brand.append(mark, brandWords);
  const modes = element('div', 'prism-mode');
  modes.setAttribute('role', 'group');
  modes.setAttribute('aria-label', 'Choose game mode. Changing mode starts a fresh game.');
  for (const [mode, text] of [
    ['marathon', 'Marathon'],
    ['sprint', 'Sprint 40'],
    ['dig', 'Dig 8'],
  ]) {
    const button = element('button', '', text);
    button.type = 'button';
    button.dataset.mode = mode;
    button.setAttribute('aria-pressed', String(mode === state.mode));
    modes.append(button);
  }
  top.append(brand, modes);
  const difficulty = element('div', 'prism-difficulty');
  const profiles = element('div', 'prism-profile');
  profiles.setAttribute('role', 'group');
  profiles.setAttribute('aria-label', 'Choose difficulty. Changing difficulty starts a fresh game.');
  for (const profile of Object.values(PROFILES)) {
    const button = element('button', '', profile.name);
    button.type = 'button';
    button.dataset.profile = profile.id;
    button.setAttribute('aria-pressed', String(profile.id === state.profile));
    profiles.append(button);
  }
  const profileNote = element('p', 'prism-profile-note');
  difficulty.append(profiles, profileNote);

  const metrics = element('div', 'prism-metrics');
  const metricNodes = {};
  const metricLabels = {};
  for (const [name, label] of [
    ['level', 'LEVEL'],
    ['lines', 'LINES'],
    ['time', 'TIME'],
  ]) {
    const item = element('div', `prism-metric prism-${name}`);
    const value = element('strong', '', '0');
    const labelNode = element('span', '', label);
    item.append(labelNode, value);
    metrics.append(item);
    metricNodes[name] = value;
    metricLabels[name] = labelNode;
  }
  const boardZone = element('div', 'prism-stage');
  const board = element('div', 'prism-board');
  const boardHeading = element('div', 'prism-board-heading');
  const activeLabel = element('span', 'prism-active-label', 'READY');
  boardHeading.append(element('span', '', 'PLAYFIELD'), activeLabel);
  const canvas = element('canvas', 'prism-canvas');
  canvas.width = 300;
  canvas.height = 600;
  canvas.tabIndex = 0;
  canvas.dataset.soloFocus = '';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute(
    'aria-label',
    'Falling block board. Arrow keys move, up rotates, space drops, C holds.',
  );
  const boardFoot = element('div', 'prism-board-foot');
  const boardDimensions = element('span', '', '10 × 20');
  const lockLabel = element('span', '', 'FALLING');
  boardFoot.append(boardDimensions, lockLabel);
  board.append(boardHeading, canvas, boardFoot);

  const rail = element('aside', 'prism-rail');
  rail.setAttribute('aria-label', 'Held piece and upcoming pieces');
  const holdPanel = element('div', 'prism-preview-panel prism-hold-panel');
  const holdHeading = element('div', 'prism-preview-heading');
  const holdTitle = element('span', '');
  holdTitle.append(
    element('span', 'prism-label-long', 'HOLD / RESERVE'),
    element('span', 'prism-label-short', 'HOLD'),
  );
  holdHeading.append(holdTitle, element('kbd', '', 'C'));
  const holdCanvas = element('canvas', 'prism-hold-canvas');
  holdCanvas.width = 120;
  holdCanvas.height = 64;
  holdCanvas.setAttribute('role', 'img');
  holdCanvas.setAttribute('aria-label', 'No piece held');
  const holdNote = element('span', 'prism-hold-note', 'ONE SWAP PER PIECE');
  holdPanel.append(holdHeading, holdCanvas, holdNote);
  const nextPanel = element('div', 'prism-preview-panel prism-next-panel');
  const nextHeading = element('div', 'prism-preview-heading');
  const nextTitle = element('span', '');
  nextTitle.append(
    element('span', 'prism-label-long', 'NEXT / QUEUE'),
    element('span', 'prism-label-short', 'NEXT'),
  );
  const previewCount = element('span', 'prism-preview-count', '05');
  nextHeading.append(nextTitle, previewCount);
  nextPanel.append(nextHeading);
  const nextCanvases = [];
  for (let i = 0; i < 5; i += 1) {
    const preview = element('canvas', 'prism-next-canvas');
    preview.width = 120;
    preview.height = 56;
    preview.setAttribute('role', 'img');
    const slot = element('div', 'prism-next-slot');
    slot.append(element('span', 'prism-next-number', String(i + 1).padStart(2, '0')), preview);
    nextPanel.append(slot);
    nextCanvases.push(preview);
  }
  const chain = element('div', 'prism-chain');
  const chainHeading = element('span', 'prism-chain-heading', 'CLEAR CHAIN');
  const combo = element('strong', 'prism-combo', '—');
  const b2b = element('span', 'prism-b2b', 'TETRIS / T-SPIN');
  const clearLabel = element('p', 'prism-clear-label', 'BUILD A CLEAN STACK');
  chain.append(chainHeading, combo, b2b, clearLabel);
  const progressPanel = element('div', 'prism-progress-panel');
  const progressHeading = element('div', 'prism-progress-heading');
  const progressTitle = element('span', '', 'NEXT LEVEL');
  const progressValue = element('span', '', '0 / 10');
  const progressTrack = element('div', 'prism-progress-track');
  const progressFill = element('i', '');
  progressTrack.append(progressFill);
  progressHeading.append(progressTitle, progressValue);
  progressPanel.append(progressHeading, progressTrack);
  const summary = element('div', 'prism-summary');
  summary.append(chain, progressPanel);
  const incoming = element('div', 'prism-incoming');
  incoming.hidden = true;
  const incomingText = element('div', 'prism-incoming-text');
  const incomingTitle = element('strong', '');
  const incomingBrief = element('p', '');
  const incomingRules = element('span', '', 'FIXED QUEUE · RESERVE RESETS EACH STAGE');
  incomingText.append(incomingTitle, incomingBrief, incomingRules);
  const incomingPreview = element('canvas', 'prism-incoming-preview');
  incomingPreview.width = 100;
  incomingPreview.height = 200;
  incomingPreview.setAttribute('role', 'img');
  const continueButton = element('button', 'prism-continue', 'Descend to next stage →');
  continueButton.type = 'button';
  incoming.append(incomingPreview, incomingText, continueButton);
  rail.append(holdPanel, nextPanel);
  boardZone.append(board, rail, summary);

  const footer = element('div', 'prism-footer');
  const status = element('p', 'prism-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  const controls = element('div', 'prism-controls');
  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', 'Move, rotate, hold, and drop pieces');
  const controlsInfo = [
    ['left', '←', 'Move left'],
    ['rotateCCW', '↶', 'Rotate counterclockwise'],
    ['rotateCW', '↷', 'Rotate clockwise'],
    ['right', '→', 'Move right'],
    ['hold', 'HOLD', 'Hold piece'],
    ['softDrop', '↓', 'Soft drop'],
    ['hardDrop', 'DROP', 'Hard drop'],
  ];
  for (const [action, text, label] of controlsInfo) {
    const button = element('button', 'prism-control');
    button.append(element('span', 'prism-control-icon', text));
    const keyLabel = {
      left: '←',
      right: '→',
      rotateCCW: 'Z',
      rotateCW: 'X / ↑',
      hold: 'C',
      softDrop: '↓',
      hardDrop: 'SPACE',
    }[action];
    button.append(element('span', 'prism-control-key', keyLabel));
    button.type = 'button';
    button.dataset.action = action;
    button.setAttribute('aria-label', label);
    controls.append(button);
  }
  const keyboardLegend = element('div', 'prism-keyboard-legend');
  keyboardLegend.append(element('span', '', '← → move  ·  X / Z rotate  ·  SPACE drop'));
  const controlsToggle = element('button', 'prism-controls-toggle', 'On-screen controls +');
  controlsToggle.type = 'button';
  controlsToggle.setAttribute('aria-expanded', 'false');
  keyboardLegend.append(controlsToggle);
  footer.append(keyboardLegend, controls, status);
  view.append(top, difficulty, metrics, boardZone, incoming, footer);
  container.append(view);
  const ctx = canvas.getContext('2d');
  const motionPreference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const reduceMotion = () => motionPreference?.matches === true;

  const tiles = new Map();
  const previewStates = new WeakMap();
  const boardArt = document.createElement('canvas');
  let paintedBoard = null;
  let paintedLocks = -1;
  let ghostCache = null;
  let incomingStageId = null;
  function tileArt(type) {
    if (tiles.has(type)) return tiles.get(type);
    const tile = document.createElement('canvas');
    tile.width = tile.height = 32;
    const c = tile.getContext('2d'),
      palette = COLORS[type] || COLORS.T;
    const r = (x, y, w, h, color) => {
      c.fillStyle = color;
      c.fillRect(x, y, w, h);
    };
    r(2, 2, 28, 29, '#071a25');
    r(1, 1, 30, 28, palette[2]);
    r(3, 3, 26, 24, palette[0]);
    const shine = c.createLinearGradient(3, 3, 26, 29);
    shine.addColorStop(0, palette[1]);
    shine.addColorStop(0.28, palette[0]);
    shine.addColorStop(1, palette[2]);
    r(4, 4, 24, 23, shine);
    r(3, 3, 26, 2, palette[1]);
    r(3, 5, 2, 21, palette[1]);
    r(27, 6, 2, 23, palette[2]);
    r(6, 27, 22, 2, palette[2]);
    if (type === 'G') {
      r(7, 8, 19, 17, '#91a094');
      r(9, 9, 15, 14, '#788e84');
      r(11, 10, 10, 2, '#b4bd9f');
      r(20, 11, 2, 8, '#4b675e');
      r(13, 17, 8, 2, '#4b675e');
      r(11, 18, 2, 5, '#4b675e');
      r(7, 23, 3, 2, '#b7c1a4');
      r(24, 8, 2, 3, '#697b70');
      r(14, 24, 9, 1, '#566f63');
    } else {
      c.fillStyle = palette[1];
      c.globalAlpha = 0.32;
      c.beginPath();
      c.moveTo(7, 7);
      c.lineTo(24, 7);
      c.lineTo(7, 24);
      c.fill();
      c.globalAlpha = 1;
      r(10, 10, 14, 14, palette[0]);
      r(11, 11, 12, 2, palette[1]);
      r(11, 13, 2, 9, `${palette[1]}88`);
      r(22, 13, 2, 11, `${palette[2]}99`);
      r(13, 22, 9, 2, palette[2]);
      r(15, 15, 4, 4, `${palette[1]}66`);
      r(5, 5, 3, 2, '#e7efd4');
      r(7, 7, 2, 1, `${palette[1]}aa`);
    }
    tiles.set(type, tile);
    return tile;
  }
  function block(context, x, y, size, type, ghost = false, active = false) {
    const palette = COLORS[type] || COLORS.T;
    const px = Math.round(x),
      py = Math.round(y),
      edge = Math.max(1, Math.round(size)),
      gap = Math.max(1, Math.round(size * 0.06));
    if (ghost) {
      context.fillStyle = `${palette[0]}13`;
      context.fillRect(px + gap + 1, py + gap + 1, edge - gap * 2 - 2, edge - gap * 2 - 2);
      context.strokeStyle = `${palette[1]}b8`;
      context.lineWidth = Math.max(1, size * 0.045);
      context.strokeRect(px + gap + 0.5, py + gap + 0.5, edge - gap * 2 - 1, edge - gap * 2 - 1);
      const cap = Math.max(2, Math.round(size * 0.19));
      context.fillStyle = `${palette[0]}a8`;
      context.fillRect(px + gap, py + gap, cap, Math.max(1, gap));
      context.fillRect(px + edge - gap - cap, py + edge - gap - 1, cap, Math.max(1, gap));
      return;
    }
    context.drawImage(
      tileArt(type),
      px + gap,
      py + gap,
      Math.max(1, edge - gap * 2),
      Math.max(1, edge - gap * 2),
    );
    if (active) {
      context.strokeStyle = `${palette[1]}a8`;
      context.lineWidth = Math.max(1, size * 0.035);
      context.strokeRect(px + gap + 1.5, py + gap + 1.5, edge - gap * 2 - 3, edge - gap * 2 - 3);
    }
  }
  function paintBoard(width, ratio) {
    boardArt.width = width;
    boardArt.height = width * 2;
    const c = boardArt.getContext('2d'),
      cell = width / WIDTH;
    c.imageSmoothingEnabled = false;
    const back = c.createLinearGradient(0, 0, width, width * 2);
    back.addColorStop(0, '#17343d');
    back.addColorStop(1, '#102330');
    c.fillStyle = back;
    c.fillRect(0, 0, width, width * 2);
    for (let y = 0; y < VISIBLE_HEIGHT; y++)
      for (let x = 0; x < WIDTH; x++) {
        const px = Math.round(x * cell),
          py = Math.round(y * cell);
        c.fillStyle = (x + y) % 2 ? '#23434b13' : '#071b2512';
        c.fillRect(px + 1, py + 1, Math.round(cell) - 1, Math.round(cell) - 1);
        c.strokeStyle = x === 5 ? '#6d8d8735' : '#526b681c';
        c.lineWidth = Math.max(1, ratio * 0.55);
        c.beginPath();
        c.moveTo(px, py);
        c.lineTo(px, py + cell);
        c.moveTo(px, py);
        c.lineTo(px + cell, py);
        c.stroke();
        if (x % 5 === 0 && y % 5 === 0) {
          c.fillStyle = '#87a29735';
          c.fillRect(px + 1, py + 1, Math.max(1, ratio), Math.max(1, ratio));
        }
      }
    c.fillStyle = '#06182422';
    c.fillRect(0, 0, cell * 0.12, width * 2);
    c.fillRect(width - cell * 0.12, 0, cell * 0.12, width * 2);
    for (let y = 0; y < VISIBLE_HEIGHT; y++)
      for (let x = 0; x < WIDTH; x++) {
        const type = state.board[y + HIDDEN_ROWS][x];
        if (type) block(c, x * cell, y * cell, cell, type);
      }
    paintedBoard = state.board;
    paintedLocks = state.piecesLocked;
  }

  function preview(target, type, dimmed = false) {
    const previous = previewStates.get(target);
    if (previous?.type === type && previous.dimmed === dimmed) return;
    previewStates.set(target, { type, dimmed });
    const context = target.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, target.width, target.height);
    context.fillStyle = '#a5cab017';
    context.fillRect(14, target.height - 8, target.width - 28, 1);
    context.imageSmoothingEnabled = false;
    if (!type) {
      context.strokeStyle = '#50707a';
      context.lineWidth = 1;
      context.setLineDash([3, 3]);
      context.strokeRect(target.width / 2 - 22, target.height / 2 - 14, 44, 28);
      context.setLineDash([]);
      return;
    }
    const cells = SHAPES[type][0];
    const minX = Math.min(...cells.map((cell) => cell.x)),
      maxX = Math.max(...cells.map((cell) => cell.x));
    const minY = Math.min(...cells.map((cell) => cell.y)),
      maxY = Math.max(...cells.map((cell) => cell.y));
    const size = 19;
    const offsetX = (target.width - (maxX - minX + 1) * size) / 2;
    const offsetY = (target.height - (maxY - minY + 1) * size) / 2;
    context.globalAlpha = dimmed ? 0.48 : 1;
    for (const cell of cells)
      block(context, offsetX + (cell.x - minX) * size, offsetY + (cell.y - minY) * size, size, type);
    context.globalAlpha = 1;
  }

  function draw(now = performance.now()) {
    if (destroyed || !ctx) return;
    if (typeof now !== 'number') now = performance.now();
    const size = Math.max(1, canvasCssWidth);
    const ratio = Math.min(window.devicePixelRatio || 1, 3);
    const width = Math.max(10, Math.round(size * ratio));
    if (canvas.width !== width || canvas.height !== width * 2) {
      canvas.width = width;
      canvas.height = width * 2;
    }
    const cell = width / WIDTH;
    ctx.imageSmoothingEnabled = false;
    if (
      boardArt.width !== width ||
      boardArt.height !== width * 2 ||
      paintedBoard !== state.board ||
      paintedLocks !== state.piecesLocked
    )
      paintBoard(width, ratio);
    ctx.drawImage(boardArt, 0, 0);
    if (dropEffect && !reduceMotion()) {
      const age = (now - dropEffect.time) / 170;
      if (age >= 1) dropEffect = null;
      else {
        const palette = COLORS[dropEffect.type] || COLORS.I;
        ctx.fillStyle = `${palette[0]}${Math.round((1 - age) * 36)
          .toString(16)
          .padStart(2, '0')}`;
        for (const part of dropEffect.from) {
          const landing = dropEffect.to.find((cell) => cell.x === part.x && cell.y >= part.y);
          if (!landing) continue;
          const topY = Math.max(0, part.y - HIDDEN_ROWS) * cell;
          const endY = (landing.y - HIDDEN_ROWS + 1) * cell;
          ctx.fillRect(part.x * cell + cell * 0.24, topY, cell * 0.52, Math.max(0, endY - topY));
        }
      }
    }
    if (state.active) {
      const active = state.active;
      if (
        !ghostCache ||
        ghostCache.board !== state.board ||
        ghostCache.locks !== state.piecesLocked ||
        ghostCache.type !== active.type ||
        ghostCache.rotation !== active.rotation ||
        ghostCache.x !== active.x ||
        ghostCache.y !== active.y
      )
        ghostCache = { ...active, board: state.board, locks: state.piecesLocked, piece: ghostPiece(state) };
      const ghost = ghostCache.piece;
      if (ghost && (ghost.y !== state.active.y || ghost.x !== state.active.x)) {
        for (const part of pieceCells(ghost)) {
          if (part.y >= HIDDEN_ROWS)
            block(ctx, part.x * cell, (part.y - HIDDEN_ROWS) * cell, cell, ghost.type, true);
        }
      }
      for (const part of pieceCells(state.active)) {
        if (part.y >= HIDDEN_ROWS)
          block(ctx, part.x * cell, (part.y - HIDDEN_ROWS) * cell, cell, state.active.type, false, true);
      }
      if (state.lockElapsed > 0 && state.phase === 'playing') {
        const progress = Math.min(1, state.lockElapsed / lockDelayFor(state));
        ctx.fillStyle = '#b4ded9';
        ctx.fillRect(
          0,
          canvas.height - Math.max(2, ratio * 2),
          canvas.width * progress,
          Math.max(2, ratio * 2),
        );
      }
    }
    if (effect && !reduceMotion()) {
      const progress = Math.max(0, 1 - (now - effect.time) / 230);
      if (!progress) effect = null;
      else if (effect.lines > 0) {
        const tint = effect.spin ? '#d5b5ed' : '#c0e8e2';
        for (const row of effect.rows) {
          ctx.fillStyle = `rgba(192,232,226,${progress * 0.22})`;
          ctx.fillRect(0, (row - HIDDEN_ROWS) * cell, width, cell);
          ctx.fillStyle = `${tint}${Math.round(progress * 120)
            .toString(16)
            .padStart(2, '0')}`;
          ctx.fillRect(
            (width * (1 - progress)) / 2,
            (row - HIDDEN_ROWS) * cell + cell * 0.44,
            width * progress,
            Math.max(1, cell * 0.09),
          );
          for (let x = 0; x < WIDTH; x++) {
            const size = Math.max(1, cell * 0.07 * progress),
              px = (x + 0.5) * cell,
              py = (row - HIDDEN_ROWS + 0.5) * cell - (1 - progress) * cell * (x % 2 ? 0.8 : 0.4);
            ctx.fillRect(px, py, size, size);
          }
        }
        ctx.strokeStyle = `rgba(192,232,226,${progress * 0.55})`;
        ctx.lineWidth = Math.max(2, ratio * 2);
        ctx.strokeRect(1, 1, width - 2, width * 2 - 2);
      } else {
        for (const part of effect.cells) {
          if (part.y < HIDDEN_ROWS) continue;
          ctx.strokeStyle = `rgba(247,236,198,${progress * 0.7})`;
          ctx.lineWidth = Math.max(1, ratio);
          ctx.strokeRect(part.x * cell + 2, (part.y - HIDDEN_ROWS) * cell + 2, cell - 4, cell - 4);
        }
      }
    }
    if (state.phase !== 'playing') {
      ctx.fillStyle = '#0b202ce8';
      ctx.fillRect(0, 0, width, width * 2);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#f4ead0';
      ctx.font = `bold ${Math.round(width * 0.079)}px ui-monospace, monospace`;
      const title =
        state.phase === 'paused'
          ? 'PAUSED'
          : state.phase === 'stage-clear'
            ? 'LAYER CLEARED'
            : state.phase === 'won'
              ? state.mode === 'dig'
                ? 'EXCAVATED'
                : '40 LINES'
              : state.result === 'piece-budget'
                ? 'NO PIECES LEFT'
                : state.result === 'time-budget'
                  ? 'TIME EXPIRED'
                  : 'STACK FILLED';
      ctx.fillText(title, width / 2, width * 0.89);
      ctx.fillStyle = '#b6d1d1';
      ctx.font = `${Math.max(8, Math.round(width * 0.044))}px ui-monospace, monospace`;
      const line =
        state.phase === 'paused'
          ? 'P / RESUME'
          : state.phase === 'stage-clear'
            ? `${getDigStage(state).title.toUpperCase()}`
            : state.phase === 'won'
              ? `${state.elapsed.toFixed(2)} SECONDS`
              : `${state.score.toLocaleString()} POINTS`;
      ctx.fillText(line, width / 2, width * 1.02);
      if (state.phase !== 'paused') {
        ctx.font = `${Math.max(7, Math.round(width * 0.033))}px ui-monospace, monospace`;
        ctx.fillText(
          state.phase === 'stage-clear' ? 'NEXT STACK BELOW' : 'R / NEW GAME',
          width / 2,
          width * 1.13,
        );
      }
    }
  }

  function detail() {
    if (state.phase === 'paused') return 'Paused. Gravity, lock timing, and the challenge clock are stopped.';
    if (state.phase === 'lost' && state.result === 'time-budget')
      return state.mode === 'dig'
        ? 'The stage clock expired. Read the fixed queue, reserve the detour, and commit each placement.'
        : 'The Sprint clock expired before forty lines. Build clean wells and use your previews to stay ahead.';
    if (state.mode === 'dig') {
      if (state.phase === 'won')
        return `${getDigStageCount(state)} excavation stages and ${getDigStages(state).reduce((sum, stage) => sum + stage.rows, 0)} rows in ${state.elapsed.toFixed(2)} seconds. The shaft is clear.`;
      if (state.phase === 'lost')
        return state.result === 'piece-budget'
          ? 'The piece budget ran out. Read the shaped openings and use your reserve before dropping.'
          : 'The shaft filled up. Restart the challenge and leave room to rotate.';
      if (state.phase === 'stage-clear')
        return `${getDigStage(state).title} cleared. Time is stopped. Review the next stack, then descend.`;
      return `Stage ${state.dig.stageIndex + 1} of ${getDigStageCount(state)}: ${getDigStage(state).title}. ${state.dig.remainingRows} garbage rows remain, ${state.dig.budget - state.dig.piecesUsed} pieces left. Fixed queue; hold resets each stage.`;
    }
    if (state.phase === 'won')
      return `Forty lines in ${state.elapsed.toFixed(2)} seconds. Chase a cleaner, faster sprint.`;
    if (state.phase === 'lost')
      return 'The stack reached the top. Start fresh and leave room for your next piece.';
    return state.mode === 'sprint'
      ? `${Math.max(0, 40 - state.lines)} lines to go. Plan ahead, place quickly, and keep the stack clean.`
      : getProfile(state).paceSeconds
        ? `Pace rises with lines or the clock. ${Math.round(lockDelayFor(state) * 1000)} ms lock, ${lockResetLimit(state)} resets. Build clean four-line clears and T-spins before the next acceleration.`
        : 'Build four-line clears and T-spins. Chain difficult clears for a bigger score.';
  }

  function publish() {
    if (destroyed) return;
    const message = detail();
    const dig = state.mode === 'dig';
    const profile = getProfile(state);
    const remaining = timeRemaining(state);
    setValue(view.dataset, 'prismProfile', state.profile);
    setValue(profileNote, 'textContent', `${profile.description} · ${Math.round(lockDelayFor(state) * 1000)} ms lock · ${lockResetLimit(state)} resets`);
    setValue(metricLabels.time, 'textContent', remaining === null ? 'TIME' : 'TIME LEFT');
    setValue(metricNodes.time.dataset, 'urgent', String(remaining !== null && remaining <= 10));
    setValue(view.dataset, 'prismMode', state.mode);
    setValue(metricLabels.level, 'textContent', dig ? 'STAGE' : 'LEVEL');
    setValue(metricLabels.lines, 'textContent', dig ? 'ROWS LEFT' : 'LINES');
    setValue(
      metricNodes.level,
      'textContent',
      dig ? `${state.dig.stageIndex + 1} / ${getDigStageCount(state)}` : String(state.level),
    );
    setValue(
      metricNodes.lines,
      'textContent',
      dig
        ? String(state.dig.remainingRows)
        : state.mode === 'sprint'
          ? `${Math.min(state.lines, 40)} / 40`
          : String(state.lines),
    );
    setValue(metricNodes.time, 'textContent', (remaining ?? state.elapsed).toFixed(2));
    if (status.textContent !== message) setValue(status, 'textContent', message);
    const journey =
      state.level < 4 ? 'WARMUP' : state.level < 8 ? 'FLOW' : state.level < 13 ? 'PRESSURE' : 'OVERDRIVE';
    const maximumPace = state.mode === 'marathon' && state.level >= 30;
    setValue(chainHeading, 'textContent', dig ? 'EXCAVATION' : 'CLEAR CHAIN');
    setValue(
      combo,
      'textContent',
      dig ? getDigStage(state).title : state.combo > 0 ? `×${state.combo + 1}` : '—',
    );
    setValue(
      b2b,
      'textContent',
      dig ? 'FIXED QUEUE · USE HOLD' : state.backToBack ? 'BACK TO BACK ×1.5' : 'TETRIS / T-SPIN',
    );
    setValue(chain.dataset, 'active', String(state.backToBack || state.combo > 0));
    const recentClear = state.lastClear && state.lastClear.label && state.elapsed - state.lastClear.time < 4;
    setValue(chain.dataset, 'spin', String(Boolean(recentClear && state.lastClear.spin)));
    setValue(
      clearLabel,
      'textContent',
      dig
        ? `${state.dig.remainingRows} ROWS · ${state.dig.budget - state.dig.piecesUsed} PIECES LEFT`
        : recentClear
          ? `${state.lastClear.label}${state.lastClear.points ? ` +${state.lastClear.points}` : ''}`
          : 'BUILD A CLEAN STACK',
    );
    const topRow = state.board.findIndex((row) => row.some(Boolean));
    const danger = topRow >= 0 && topRow < HIDDEN_ROWS + 5;
    setValue(
      activeLabel,
      'textContent',
      danger ? 'HIGH STACK' : state.active ? `${state.active.type} / ACTIVE` : 'COMPLETE',
    );
    setValue(activeLabel.dataset, 'danger', String(danger));
    setValue(
      boardDimensions,
      'textContent',
      dig ? `PIECES ${state.dig.piecesUsed} / ${state.dig.budget}` : '10 × 20',
    );
    setValue(
      lockLabel,
      'textContent',
      state.phase === 'paused'
        ? 'PAUSED'
        : state.lockElapsed > 0
          ? `LOCK ${Math.min(100, Math.round((state.lockElapsed / lockDelayFor(state)) * 100))}%`
          : 'GHOST ON',
    );
    const timedPace = state.mode === 'marathon' && profile.paceSeconds;
    const linesTowardPace = timedPace ? Math.max(0, state.lines - (state.level - profile.startLevel) * profile.linesPerLevel) : state.lines % profile.linesPerLevel;
    const secondsTowardPace = timedPace ? Math.max(0, state.elapsed - (state.level - profile.startLevel) * profile.paceSeconds) : 0;
    setValue(
      progressTitle,
      'textContent',
      dig
        ? 'ROWS EXCAVATED'
        : state.mode === 'sprint'
          ? 'SPRINT GOAL'
          : maximumPace
            ? 'MAXIMUM PACE'
            : `${journey} → LV ${state.level + 1}`,
    );
    setValue(
      progressValue,
      'textContent',
      dig
        ? `${state.dig.garbageRows - state.dig.remainingRows} / ${state.dig.garbageRows}`
        : state.mode === 'sprint'
          ? `${Math.min(state.lines, 40)} / 40`
          : maximumPace
            ? 'LEVEL 30'
            : timedPace
              ? `${linesTowardPace} / ${profile.linesPerLevel} L · ${Math.max(0, (state.level + 1 - profile.startLevel) * profile.paceSeconds - state.elapsed).toFixed(0)}s`
              : `${linesTowardPace} / ${profile.linesPerLevel}`,
    );
    const progression = dig
      ? 1 - state.dig.remainingRows / state.dig.garbageRows
      : state.mode === 'sprint'
        ? Math.min(1, state.lines / 40)
        : maximumPace
          ? 1
          : Math.max(linesTowardPace / profile.linesPerLevel, timedPace ? secondsTowardPace / profile.paceSeconds : 0);
    setValue(progressFill.style, 'width', `${progression * 100}%`);
    setAttribute(progressTrack, 'role', 'progressbar');
    setAttribute(
      progressTrack,
      'aria-label',
      dig
        ? 'Garbage rows excavated in this stage'
        : state.mode === 'sprint'
          ? 'Sprint lines completed'
          : maximumPace
            ? 'Maximum Marathon pace reached'
            : 'Progress to next level',
    );
    setAttribute(progressTrack, 'aria-valuemin', '0');
    setAttribute(
      progressTrack,
      'aria-valuemax',
      dig ? String(state.dig.garbageRows) : state.mode === 'sprint' ? '40' : String(profile.linesPerLevel),
    );
    setAttribute(
      progressTrack,
      'aria-valuenow',
      String(
        dig
          ? state.dig.garbageRows - state.dig.remainingRows
          : state.mode === 'sprint'
            ? Math.min(state.lines, 40)
            : maximumPace
              ? profile.linesPerLevel
              : linesTowardPace,
      ),
    );
    setValue(incoming, 'hidden', !dig || state.phase !== 'stage-clear');
    if (!incoming.hidden) {
      const nextStage = getDigStages(state)[state.dig.stageIndex + 1];
      setValue(
        incomingTitle,
        'textContent',
        `NEXT ${state.dig.stageIndex + 2} / ${getDigStageCount(state)} · ${nextStage.title}`,
      );
      setValue(
        incomingBrief,
        'textContent',
        `${nextStage.rows} rows · ${nextStage.budget} pieces${nextStage.seconds ? ` · ${nextStage.seconds}s` : ''}. ${nextStage.brief}`,
      );
      setValue(incomingRules, 'textContent', `QUEUE ${nextStage.queue.join(' ')} · RESERVE RESETS`);
      setAttribute(
        incomingPreview,
        'aria-label',
        `Next stack: ${nextStage.rows} shaped garbage rows. ${nextStage.title}.`,
      );
      const context = incomingPreview.getContext('2d');
      if (context && incomingStageId !== nextStage.id) {
        incomingStageId = nextStage.id;
        context.imageSmoothingEnabled = false;
        context.fillStyle = '#102b35';
        context.fillRect(0, 0, 100, 200);
        nextStage.board.slice(HIDDEN_ROWS).forEach((row, y) =>
          row.forEach((type, x) => {
            if (type) block(context, x * 10, y * 10, 10, type);
          }),
        );
      }
    }
    setValue(holdPanel.dataset, 'used', String(state.holdUsed));
    setValue(
      holdNote,
      'textContent',
      !state.hold ? 'PRESS C TO RESERVE' : state.holdUsed ? 'READY AFTER NEXT LOCK' : 'ONE SWAP PER PIECE',
    );
    setAttribute(
      holdCanvas,
      'aria-label',
      state.hold
        ? `Held ${state.hold} piece${state.holdUsed ? '. Available after your next lock.' : ''}`
        : 'No piece held. Press C to hold the active piece.',
    );
    preview(holdCanvas, state.hold, state.holdUsed);
    setValue(previewCount, 'textContent', String(profile.previews).padStart(2, '0'));
    nextCanvases.forEach((target, i) => {
      setValue(target.parentElement, 'hidden', i >= profile.previews);
      if (i >= profile.previews) return;
      setAttribute(target, 'aria-label', `Next piece ${i + 1}: ${state.next[i] || 'empty'}`);
      preview(target, state.next[i]);
    });
    modes
      .querySelectorAll('button')
      .forEach((button) => setAttribute(button, 'aria-pressed', String(button.dataset.mode === state.mode)));
    profiles.querySelectorAll('button').forEach(button =>
      setAttribute(button, 'aria-pressed', String(button.dataset.profile === state.profile)));
    setValue(modes.querySelector('[data-mode=dig]'), 'textContent', `Dig ${getDigStageCount(state)}`);
    setAttribute(
      canvas,
      'aria-label',
      `Prism Shift ${profile.name} ${state.mode}. ${state.lines} lines, level ${state.level}, ${state.score} points. ${message} Use arrows or ${displayKey('WASD')} to move and rotate clockwise. X also rotates clockwise, ${displayKey('Z')} rotates counterclockwise, Space drops, C or Shift holds.`,
    );
    const timed = state.mode === 'sprint' || dig;
    onUpdate({
      phase: state.phase === 'stage-clear' ? 'playing' : state.phase,
      mode: state.mode,
      profile: state.profile,
      score: timed ? Number(state.elapsed.toFixed(2)) : state.score,
      scoreLabel: timed ? 'TIME' : 'SCORE',
      scoreDigits: timed ? 2 : 0,
      scoreUnit: timed ? 's' : '',
      record: timed ? (state.phase === 'won' ? state.elapsed : null) : state.score,
      recordKey: recordScope(state),
      recordDirection: timed ? 'min' : 'max',
      recordLabel: `${state.profile === 'standard' ? '' : `${profile.name.toUpperCase()} · `}${dig ? `BEST DIG ${getDigStageCount(state)}` : timed ? 'BEST 40 LINES' : 'BEST SCORE'}`,
      detail: message,
    });
    updateElapsed = 0;
  }

  function noticeLock(oldPiece, rows = []) {
    if (state.piecesLocked === observedLocks) return;
    observedLocks = state.piecesLocked;
    effect = {
      time: performance.now(),
      lines: state.lastClear?.lines || 0,
      cells: oldPiece ? pieceCells(oldPiece) : [],
      rows,
      spin: state.lastClear?.spin,
    };
    publish();
  }
  function pendingClearRows(piece) {
    if (!piece) return [];
    const cells = pieceCells(piece);
    return state.board.flatMap((row, y) =>
      y >= HIDDEN_ROWS && row.every((type, x) => type || cells.some((cell) => cell.x === x && cell.y === y))
        ? [y]
        : [],
    );
  }

  function act(action) {
    if (destroyed || state.phase !== 'playing') return;
    const oldPiece = state.active ? (action === 'hardDrop' ? ghostPiece(state) : { ...state.active }) : null;
    const rows = action === 'hardDrop' ? pendingClearRows(oldPiece) : [];
    if (action === 'hardDrop' && oldPiece) {
      const cells = pieceCells(oldPiece);
      if (!reduceMotion() && state.active.y !== oldPiece.y) {
        dropEffect = {
          time: performance.now(),
          type: state.active.type,
          from: pieceCells(state.active),
          to: cells,
        };
      }
    }
    dispatch(state, ENGINE_ACTIONS[action]);
    noticeLock(oldPiece, rows);
    if (state.phase !== 'playing') releaseInputs();
    publish();
    draw();
    syncAnimation();
  }

  const held = (action) => [...sources.values()].includes(action);
  function press(action, source) {
    if (destroyed || state.phase !== 'playing' || sources.has(source)) return;
    sources.set(source, action);
    if (action === 'left' || action === 'right') {
      priority = action;
      repeatElapsed = 0;
      repeatNext = 0.14;
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
      repeatNext = 0.14;
      if (priority && state.phase === 'playing') act(priority);
    }
  }

  function releaseInputs() {
    sources.clear();
    priority = null;
    repeatElapsed = 0;
    repeatNext = 0.14;
    for (const [pointerId, button] of pointers) {
      button.classList.remove('is-held');
      try {
        if (button.hasPointerCapture(pointerId)) button.releasePointerCapture(pointerId);
      } catch {}
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
    syncAnimation();
  }

  function autoPause() {
    releaseInputs();
    if (state.phase === 'playing' || state.phase === 'stage-clear') togglePause();
  }

  function restart(mode = state.mode, profile = state.profile) {
    if (destroyed) return;
    releaseInputs();
    state = createState({ mode, profile });
    effect = null;
    dropEffect = null;
    observedLocks = state.piecesLocked;
    lastFrame = 0;
    accumulator = 0;
    publish();
    draw();
    syncAnimation();
  }

  function frame(now) {
    animationId = null;
    if (destroyed) return;
    const delta = lastFrame ? Math.min(0.05, Math.max(0, (now - lastFrame) / 1000)) : 0;
    lastFrame = now;
    if (state.phase === 'playing') {
      accumulator += delta;
      const interval = 1 / 120;
      while (accumulator >= interval && state.phase === 'playing') {
        if (priority && held(priority)) {
          repeatElapsed += interval;
          while (repeatElapsed >= repeatNext) {
            dispatch(state, ENGINE_ACTIONS[priority]);
            repeatNext += 0.03;
          }
        }
        const oldPiece = state.active ? { ...state.active } : null;
        const rows = state.lockElapsed > lockDelayFor(state) - 0.03 ? pendingClearRows(oldPiece) : [];
        step(state, { softDrop: held('softDrop') }, interval);
        noticeLock(oldPiece, rows);
        accumulator -= interval;
        updateElapsed += interval;
      }
      if (state.phase !== 'playing') {
        releaseInputs();
        accumulator = 0;
        publish();
      } else if (updateElapsed >= 0.1) publish();
    }
    draw(now);
    syncAnimation();
  }
  function syncAnimation() {
    const finishingEffect = state.phase !== 'paused' && !reduceMotion() && Boolean(effect || dropEffect);
    if (destroyed || (state.phase !== 'playing' && !finishingEffect)) {
      if (animationId !== null) window.cancelAnimationFrame(animationId);
      animationId = null;
    } else if (animationId === null) animationId = window.requestAnimationFrame(frame);
  }
  function resizeCanvas() {
    canvasCssWidth = canvas.getBoundingClientRect().width || 300;
    draw();
  }
  function motionChanged() {
    draw();
    syncAnimation();
  }

  function keydown(event) {
    if (
      event.defaultPrevented ||
      event.isComposing ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      isForm(event.target)
    )
      return;
    const key = gameKey(event);
    const action = KEY_ACTIONS[key];
    if (key === 'Escape') {
      event.preventDefault();
      if (!event.repeat) togglePause();
      return;
    }
    if (
      !action ||
      (action === 'hardDrop' && event.target instanceof Element && event.target.closest('button,a'))
    )
      return;
    event.preventDefault();
    if (event.repeat) return;
    press(action, `key:${event.code || event.key}`);
  }
  const keyup = (event) => release(`key:${event.code || event.key}`);
  const focusCanvas = () => canvas.focus({ preventScroll: true });
  function pointerdown(event) {
    const button = event.target.closest('.prism-control[data-action]');
    if (!button || !controls.contains(button) || state.phase !== 'playing') return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    focusCanvas();
    try {
      button.setPointerCapture(event.pointerId);
    } catch {}
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
    try {
      if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
    } catch {}
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
  function changeProfile(event) {
    const button = event.target.closest('button[data-profile]');
    if (!button || !profiles.contains(button) || button.dataset.profile === state.profile) return;
    restart(state.mode, button.dataset.profile);
    focusCanvas();
  }
  function toggleControls() {
    const open = view.dataset.controlsOpen !== 'true';
    view.dataset.controlsOpen = String(open);
    controlsToggle.setAttribute('aria-expanded', String(open));
    controlsToggle.textContent = open ? 'On-screen controls −' : 'On-screen controls +';
  }
  function continueDig() {
    releaseInputs();
    if (!advanceDigStage(state)) return;
    effect = null;
    dropEffect = null;
    lastFrame = 0;
    accumulator = 0;
    publish();
    draw();
    syncAnimation();
    focusCanvas();
  }
  const visibility = () => {
    if (document.hidden) autoPause();
  };
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
  profiles.addEventListener('click', changeProfile);
  controlsToggle.addEventListener('click', toggleControls);
  continueButton.addEventListener('click', continueDig);
  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(resizeCanvas) : null;
  if (resizeObserver) resizeObserver.observe(canvas);
  window.addEventListener('resize', resizeCanvas);
  motionPreference?.addEventListener('change', motionChanged);
  function updateKeyboardHints() {
    view.dataset.keyboardLayout = getKeyboardLayout();
    keyboardLegend.firstElementChild.textContent = `${displayKey('A / D')} / ← → move · X / ${displayKey('Z')} rotate · SPACE drop`;
    const labels = { left: `${displayKey('A')} / ←`, right: 'D / →', rotateCCW: displayKey('Z'), rotateCW: `X / ${displayKey('W')} / ↑`, hold: 'C', softDrop: 'S / ↓', hardDrop: 'SPACE' };
    for (const button of controls.children) button.querySelector('.prism-control-key').textContent = labels[button.dataset.action];
  }
  const unsubscribeKeyboardLayout = subscribeKeyboardLayout(() => { releaseInputs(); updateKeyboardHints(); publish(); });
  updateKeyboardHints();
  publish();
  resizeCanvas();
  syncAnimation();

  return {
    getState: () => JSON.parse(JSON.stringify(state)),
    restart: () => restart(),
    togglePause,
    destroy() {
      if (destroyed) return;
      unsubscribeKeyboardLayout();
      releaseInputs();
      destroyed = true;
      tiles.clear();
      if (animationId !== null) window.cancelAnimationFrame(animationId);
      resizeObserver?.disconnect();
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
      window.removeEventListener('blur', autoPause);
      window.removeEventListener('pagehide', pageHidden);
      window.removeEventListener('resize', resizeCanvas);
      motionPreference?.removeEventListener('change', motionChanged);
      document.removeEventListener('visibilitychange', visibility);
      canvas.removeEventListener('pointerdown', focusCanvas);
      controls.removeEventListener('pointerdown', pointerdown);
      controls.removeEventListener('pointerup', pointerend);
      controls.removeEventListener('pointercancel', pointerend);
      controls.removeEventListener('lostpointercapture', pointerend);
      controls.removeEventListener('click', clickControl);
      modes.removeEventListener('click', changeMode);
      profiles.removeEventListener('click', changeProfile);
      controlsToggle.removeEventListener('click', toggleControls);
      continueButton.removeEventListener('click', continueDig);
      view.remove();
    },
  };
}
