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
  DIG_STAGES,
  DIG_STAGE_COUNT,
  getDigStage,
  advanceDigStage,
} from './prism-engine.js';

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
  nextHeading.append(nextTitle, element('span', 'prism-preview-count', '05'));
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
  view.append(top, metrics, boardZone, incoming, footer);
  container.append(view);
  const ctx = canvas.getContext('2d');
  const motionPreference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const reduceMotion = () => motionPreference?.matches === true;

  function block(context, x, y, size, type, ghost = false) {
    const palette = COLORS[type] || COLORS.T;
    const px = Math.round(x),
      py = Math.round(y),
      edge = Math.max(1, Math.round(size));
    const gap = Math.max(1, Math.round(size * 0.065));
    if (ghost) {
      context.strokeStyle = `${palette[0]}b3`;
      context.lineWidth = Math.max(1, size * 0.052);
      context.strokeRect(px + gap + 0.5, py + gap + 0.5, edge - gap * 2 - 1, edge - gap * 2 - 1);
      context.fillStyle = `${palette[0]}12`;
      context.fillRect(px + gap + 1, py + gap + 1, edge - gap * 2 - 2, edge - gap * 2 - 2);
      return;
    }
    context.fillStyle = '#0b1e2a';
    context.fillRect(px + gap, py + gap + Math.max(1, edge * 0.05), edge - gap * 2, edge - gap * 2);
    context.fillStyle = palette[2];
    context.fillRect(px + gap, py + gap, edge - gap * 2, edge - gap * 2);
    context.fillStyle = palette[0];
    context.fillRect(
      px + gap + 1,
      py + gap + 1,
      edge - gap * 2 - 2,
      edge - gap * 2 - Math.max(2, edge * 0.14),
    );
    context.fillStyle = palette[1];
    context.fillRect(px + gap + 1, py + gap + 1, edge - gap * 2 - 2, Math.max(1, Math.round(size * 0.12)));
    context.fillStyle = `${palette[1]}66`;
    context.fillRect(px + gap + 1, py + gap + 1, Math.max(1, Math.round(size * 0.09)), edge - gap * 2 - 3);
    if (size >= 17) {
      context.fillStyle = `${palette[1]}38`;
      context.fillRect(px + edge * 0.24, py + edge * 0.27, edge * 0.48, edge * 0.38);
      context.fillStyle = `${palette[2]}70`;
      context.fillRect(px + edge * 0.24, py + edge * 0.65, edge * 0.48, Math.max(1, edge * 0.05));
    }
    if (type === 'G') {
      context.fillStyle = palette[2];
      context.fillRect(px + edge * 0.45, py + edge * 0.21, Math.max(1, edge * 0.07), edge * 0.23);
      context.fillRect(px + edge * 0.27, py + edge * 0.44, edge * 0.25, Math.max(1, edge * 0.07));
    }
  }

  function preview(target, type, dimmed = false) {
    const context = target.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, target.width, target.height);
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
    const size = Math.max(1, canvas.getBoundingClientRect().width || 300);
    const ratio = Math.min(window.devicePixelRatio || 1, 3);
    const width = Math.max(10, Math.round(size * ratio));
    if (canvas.width !== width || canvas.height !== width * 2) {
      canvas.width = width;
      canvas.height = width * 2;
    }
    const cell = width / WIDTH;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#112730';
    ctx.fillRect(0, 0, width, width * 2);
    for (let y = 0; y < VISIBLE_HEIGHT; y += 1) {
      for (let x = 0; x < WIDTH; x += 1) {
        ctx.fillStyle = (x + y) % 2 ? '#152d37' : '#142b34';
        ctx.fillRect(
          Math.round(x * cell) + 1,
          Math.round(y * cell) + 1,
          Math.round(cell) - 1,
          Math.round(cell) - 1,
        );
        if (x % 5 === 0 && y % 5 === 0) {
          ctx.fillStyle = '#2b4651';
          ctx.fillRect(
            Math.round(x * cell) + 1,
            Math.round(y * cell) + 1,
            Math.max(1, ratio),
            Math.max(1, ratio),
          );
        }
        const type = state.board[y + HIDDEN_ROWS][x];
        if (type) block(ctx, x * cell, y * cell, cell, type);
      }
    }
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
      const ghost = ghostPiece(state);
      if (ghost && (ghost.y !== state.active.y || ghost.x !== state.active.x)) {
        for (const part of pieceCells(ghost)) {
          if (part.y >= HIDDEN_ROWS)
            block(ctx, part.x * cell, (part.y - HIDDEN_ROWS) * cell, cell, ghost.type, true);
        }
      }
      for (const part of pieceCells(state.active)) {
        if (part.y >= HIDDEN_ROWS)
          block(ctx, part.x * cell, (part.y - HIDDEN_ROWS) * cell, cell, state.active.type);
      }
      if (state.lockElapsed > 0 && state.phase === 'playing') {
        const progress = Math.min(1, state.lockElapsed / 0.5);
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
        for (const row of effect.rows) {
          ctx.fillStyle = `rgba(192,232,226,${progress * 0.22})`;
          ctx.fillRect(0, (row - HIDDEN_ROWS) * cell, width, cell);
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
    if (state.phase === 'paused') return 'Paused. Your next move can wait.';
    if (state.mode === 'dig') {
      if (state.phase === 'won')
        return `Eight excavation stages and sixty rows in ${state.elapsed.toFixed(2)} seconds. The shaft is clear.`;
      if (state.phase === 'lost')
        return state.result === 'piece-budget'
          ? 'The piece budget ran out. Read the shaped openings and use your reserve before dropping.'
          : 'The shaft filled up. Restart the challenge and leave room to rotate.';
      if (state.phase === 'stage-clear')
        return `${getDigStage(state).title} cleared. Time is stopped. Review the next stack, then descend.`;
      return `Stage ${state.dig.stageIndex + 1} of ${DIG_STAGE_COUNT}: ${getDigStage(state).title}. ${state.dig.remainingRows} garbage rows remain, ${state.dig.budget - state.dig.piecesUsed} pieces left. Fixed queue; hold resets each stage.`;
    }
    if (state.phase === 'won')
      return `Forty lines in ${state.elapsed.toFixed(2)} seconds. Chase a cleaner, faster sprint.`;
    if (state.phase === 'lost')
      return 'The stack reached the top. Start fresh and leave room for your next piece.';
    return state.mode === 'sprint'
      ? `${Math.max(0, 40 - state.lines)} lines to go. Plan ahead, place quickly, and keep the stack clean.`
      : 'Build four-line clears and T-spins. Chain difficult clears for a bigger score.';
  }

  function publish() {
    if (destroyed) return;
    const message = detail();
    const dig = state.mode === 'dig';
    view.dataset.prismMode = state.mode;
    metricLabels.level.textContent = dig ? 'STAGE' : 'LEVEL';
    metricLabels.lines.textContent = dig ? 'ROWS LEFT' : 'LINES';
    metricNodes.level.textContent = dig
      ? `${state.dig.stageIndex + 1} / ${DIG_STAGE_COUNT}`
      : String(state.level);
    metricNodes.lines.textContent = dig
      ? String(state.dig.remainingRows)
      : state.mode === 'sprint'
        ? `${Math.min(state.lines, 40)} / 40`
        : String(state.lines);
    metricNodes.time.textContent = state.elapsed.toFixed(2);
    if (status.textContent !== message) status.textContent = message;
    const journey =
      state.level < 4 ? 'WARMUP' : state.level < 8 ? 'FLOW' : state.level < 13 ? 'PRESSURE' : 'OVERDRIVE';
    const maximumPace = state.mode === 'marathon' && state.level >= 30;
    chainHeading.textContent = dig ? 'EXCAVATION' : 'CLEAR CHAIN';
    combo.textContent = dig ? getDigStage(state).title : state.combo > 0 ? `×${state.combo + 1}` : '—';
    b2b.textContent = dig
      ? 'FIXED QUEUE · USE HOLD'
      : state.backToBack
        ? 'BACK TO BACK ×1.5'
        : 'TETRIS / T-SPIN';
    chain.dataset.active = String(state.backToBack || state.combo > 0);
    const recentClear = state.lastClear && state.lastClear.label && state.elapsed - state.lastClear.time < 4;
    chain.dataset.spin = String(Boolean(recentClear && state.lastClear.spin));
    clearLabel.textContent = dig
      ? `${state.dig.remainingRows} ROWS · ${state.dig.budget - state.dig.piecesUsed} PIECES LEFT`
      : recentClear
        ? `${state.lastClear.label}${state.lastClear.points ? ` +${state.lastClear.points}` : ''}`
        : 'BUILD A CLEAN STACK';
    const topRow = state.board.findIndex((row) => row.some(Boolean));
    const danger = topRow >= 0 && topRow < HIDDEN_ROWS + 5;
    activeLabel.textContent = danger
      ? 'HIGH STACK'
      : state.active
        ? `${state.active.type} / ACTIVE`
        : 'COMPLETE';
    activeLabel.dataset.danger = String(danger);
    boardDimensions.textContent = dig ? `PIECES ${state.dig.piecesUsed} / ${state.dig.budget}` : '10 × 20';
    lockLabel.textContent =
      state.phase === 'paused'
        ? 'PAUSED'
        : state.lockElapsed > 0
          ? `LOCK ${Math.min(100, Math.round((state.lockElapsed / 0.5) * 100))}%`
          : 'GHOST ON';
    progressTitle.textContent = dig
      ? 'ROWS EXCAVATED'
      : state.mode === 'sprint'
        ? 'SPRINT GOAL'
        : maximumPace
          ? 'MAXIMUM PACE'
          : `${journey} → LV ${state.level + 1}`;
    progressValue.textContent = dig
      ? `${state.dig.garbageRows - state.dig.remainingRows} / ${state.dig.garbageRows}`
      : state.mode === 'sprint'
        ? `${Math.min(state.lines, 40)} / 40`
        : maximumPace
          ? 'LEVEL 30'
          : `${state.lines % 10} / 10`;
    const progression = dig
      ? 1 - state.dig.remainingRows / state.dig.garbageRows
      : state.mode === 'sprint'
        ? Math.min(1, state.lines / 40)
        : maximumPace
          ? 1
          : (state.lines % 10) / 10;
    progressFill.style.width = `${progression * 100}%`;
    progressTrack.setAttribute('role', 'progressbar');
    progressTrack.setAttribute(
      'aria-label',
      dig
        ? 'Garbage rows excavated in this stage'
        : state.mode === 'sprint'
          ? 'Sprint lines completed'
          : maximumPace
            ? 'Maximum Marathon pace reached'
            : 'Progress to next level',
    );
    progressTrack.setAttribute('aria-valuemin', '0');
    progressTrack.setAttribute(
      'aria-valuemax',
      dig ? String(state.dig.garbageRows) : state.mode === 'sprint' ? '40' : '10',
    );
    progressTrack.setAttribute(
      'aria-valuenow',
      String(
        dig
          ? state.dig.garbageRows - state.dig.remainingRows
          : state.mode === 'sprint'
            ? Math.min(state.lines, 40)
            : maximumPace
              ? 10
              : state.lines % 10,
      ),
    );
    incoming.hidden = !dig || state.phase !== 'stage-clear';
    if (!incoming.hidden) {
      const nextStage = DIG_STAGES[state.dig.stageIndex + 1];
      incomingTitle.textContent = `NEXT ${state.dig.stageIndex + 2} / ${DIG_STAGE_COUNT} · ${nextStage.title}`;
      incomingBrief.textContent = `${nextStage.rows} rows · ${nextStage.budget} pieces. ${nextStage.brief}`;
      incomingRules.textContent = `QUEUE ${nextStage.queue.join(' ')} · RESERVE RESETS`;
      incomingPreview.setAttribute(
        'aria-label',
        `Next stack: ${nextStage.rows} shaped garbage rows. ${nextStage.title}.`,
      );
      const context = incomingPreview.getContext('2d');
      if (context) {
        context.fillStyle = '#102b35';
        context.fillRect(0, 0, 100, 200);
        nextStage.board.slice(HIDDEN_ROWS).forEach((row, y) =>
          row.forEach((type, x) => {
            if (type) block(context, x * 10, y * 10, 10, type);
          }),
        );
      }
    }
    holdPanel.dataset.used = String(state.holdUsed);
    holdNote.textContent = !state.hold
      ? 'PRESS C TO RESERVE'
      : state.holdUsed
        ? 'READY AFTER NEXT LOCK'
        : 'ONE SWAP PER PIECE';
    holdCanvas.setAttribute(
      'aria-label',
      state.hold
        ? `Held ${state.hold} piece${state.holdUsed ? '. Available after your next lock.' : ''}`
        : 'No piece held. Press C to hold the active piece.',
    );
    preview(holdCanvas, state.hold, state.holdUsed);
    nextCanvases.forEach((target, i) => {
      target.setAttribute('aria-label', `Next piece ${i + 1}: ${state.next[i] || 'empty'}`);
      preview(target, state.next[i]);
    });
    modes
      .querySelectorAll('button')
      .forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.mode === state.mode)));
    canvas.setAttribute(
      'aria-label',
      `Prism Shift ${state.mode}. ${state.lines} lines, level ${state.level}, ${state.score} points. ${message}`,
    );
    const timed = state.mode === 'sprint' || dig;
    onUpdate({
      phase: state.phase === 'stage-clear' ? 'playing' : state.phase,
      mode: state.mode,
      score: timed ? Number(state.elapsed.toFixed(2)) : state.score,
      scoreLabel: timed ? 'TIME' : 'SCORE',
      scoreDigits: timed ? 2 : 0,
      scoreUnit: timed ? 's' : '',
      record: timed ? (state.phase === 'won' ? state.elapsed : null) : state.score,
      recordKey: state.mode,
      recordDirection: timed ? 'min' : 'max',
      recordLabel: dig ? 'BEST DIG 8' : timed ? 'BEST 40 LINES' : 'BEST SCORE',
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
    };
    publish();
  }

  function act(action) {
    if (destroyed || state.phase !== 'playing') return;
    const oldPiece = state.active ? (action === 'hardDrop' ? ghostPiece(state) : { ...state.active }) : null;
    const rows = [];
    if (action === 'hardDrop' && oldPiece) {
      const cells = pieceCells(oldPiece);
      for (let y = HIDDEN_ROWS; y < state.height; y += 1) {
        if (state.board[y].every((type, x) => type || cells.some((cell) => cell.x === x && cell.y === y)))
          rows.push(y);
      }
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
  }

  function autoPause() {
    releaseInputs();
    if (state.phase === 'playing' || state.phase === 'stage-clear') togglePause();
  }

  function restart(mode = state.mode) {
    if (destroyed) return;
    releaseInputs();
    state = createState({ mode });
    effect = null;
    dropEffect = null;
    observedLocks = state.piecesLocked;
    lastFrame = 0;
    accumulator = 0;
    publish();
    draw();
  }

  function frame(now) {
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
        step(state, { softDrop: held('softDrop') }, interval);
        noticeLock(oldPiece);
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
    animationId = window.requestAnimationFrame(frame);
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
    const action = KEY_ACTIONS[event.key];
    if (event.key === 'Escape') {
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
  controlsToggle.addEventListener('click', toggleControls);
  continueButton.addEventListener('click', continueDig);
  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(() => draw()) : null;
  if (resizeObserver) resizeObserver.observe(canvas);
  else window.addEventListener('resize', draw);
  publish();
  draw();
  animationId = window.requestAnimationFrame(frame);

  return {
    getState: () => JSON.parse(JSON.stringify(state)),
    restart: () => restart(),
    togglePause,
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
      controlsToggle.removeEventListener('click', toggleControls);
      continueButton.removeEventListener('click', continueDig);
      view.remove();
    },
  };
}
