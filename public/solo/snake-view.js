import { GARDENS, advanceGarden, createState, step, turn, togglePause as pauseState } from './snake-engine.js';

const KEY_DIRECTIONS = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', W: 'up', s: 'down', S: 'down', a: 'left', A: 'left', d: 'right', D: 'right',
};
function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
const isForm = target => target instanceof Element
  && Boolean(target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])'));

export function mount(container, { onUpdate = () => {} } = {}) {
  let mode = 'classic';
  let state = createState({ mode });
  let timer = null;
  let destroyed = false;
  const view = element('section', 'snake-view');
  view.setAttribute('aria-label', 'Snake game');
  const topline = element('div', 'snake-topline');
  const label = element('span', '', 'GARDEN SNAKE');
  const speed = element('span', 'snake-speed');
  topline.append(label, speed);
  const modes = element('div', 'snake-modes'); modes.setAttribute('aria-label', 'Snake game mode');
  for (const [id, title] of [['classic', 'Classic'], ['gardens', 'Six gardens']]) { const button = element('button', '', title); button.type = 'button'; button.dataset.mode = id; button.setAttribute('aria-pressed', String(id === mode)); modes.append(button); }
  const progress = element('div', 'snake-garden-progress'); progress.hidden = true;
  for (let i = 0; i < GARDENS.length; i++) { const dot = element('span', '', String(i + 1)); dot.dataset.level = i; progress.append(dot); }
  const board = element('div', 'snake-board');
  const canvas = element('canvas', 'snake-canvas');
  canvas.width = 600;
  canvas.height = 600;
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Snake board. Use arrow keys or W A S D to steer. Space pauses.');
  board.append(canvas);
  const footer = element('div', 'snake-footer');
  const description = element('div', 'snake-description');
  const status = element('p', 'snake-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  const hint = element('p', 'snake-hint', 'Arrow keys or W A S D to steer. Space to pause. Eat the fruit, grow your trail, and keep room to turn.');
  description.append(status, hint);
  const controls = element('div', 'snake-controls');
  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', 'Steer the snake');
  ['up', 'left', 'down', 'right'].forEach(direction => {
    const button = element('button', 'snake-direction', { up: '↑', left: '←', down: '↓', right: '→' }[direction]);
    button.type = 'button';
    button.dataset.direction = direction;
    button.setAttribute('aria-label', `Steer ${direction}`);
    controls.append(button);
  });
  footer.append(description, controls);
  view.append(modes, topline, progress, board, footer);
  container.append(view);
  const ctx = canvas.getContext('2d');
  const detail = () => ({
    playing: state.mode === 'gardens' ? `${GARDENS[state.level].title}: ${state.levelFoods} / ${GARDENS[state.level].goal} fruit. Stone hedges end the run.` : 'Keep growing. The garden gets faster with every fruit.',
    levelClear: `${GARDENS[state.level].title} cleared. The next garden opens in a moment.`,
    paused: 'Paused. Resume when you are ready to keep growing.',
    lost: state.result === 'hedge' ? 'A stone hedge stopped your trail. Restart the garden tour.' : state.result === 'wall' ? 'You reached the garden wall. Start a new run.' : 'Your trail caught up with you. Start a new run.',
    won: state.mode === 'gardens' ? 'All six gardens cleared. A complete orchard tour!' : 'Every tile is yours. A perfect garden!',
  })[state.phase];

  function draw() {
    if (destroyed || !ctx) return;
    const cssSize = Math.max(1, canvas.getBoundingClientRect().width || 600);
    const ratio = Math.min(window.devicePixelRatio || 1, 3);
    const pixelSize = Math.round(cssSize * ratio);
    if (canvas.width !== pixelSize || canvas.height !== pixelSize) {
      canvas.width = pixelSize;
      canvas.height = pixelSize;
    }
    // Integer boundaries keep the tiles sharp at every viewport size and DPR.
    const cell = pixelSize / state.width;
    const rect = (x, y, w, h, color) => {
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(x * cell), Math.round(y * cell), Math.round((x + w) * cell) - Math.round(x * cell), Math.round((y + h) * cell) - Math.round(y * cell));
    };
    ctx.imageSmoothingEnabled = false;
    for (let y = 0; y < state.height; y += 1) {
      for (let x = 0; x < state.width; x += 1) rect(x, y, 1, 1, (x + y) % 2 ? '#234535' : '#264a39');
    }
    // Small garden flecks add texture without hiding the grid or obstacles.
    for (let y = 1; y < state.height; y += 4) {
      for (let x = 2; x < state.width; x += 5) rect(x + .25, y + .7, .12, .12, '#30583e');
    }
    for (const { x, y } of state.obstacles) { rect(x + .04, y + .04, .92, .92, '#64765a'); rect(x + .1, y + .1, .8, .15, '#9aaa7c'); rect(x + .1, y + .76, .8, .15, '#415940'); rect(x + .46, y + .28, .08, .43, '#52694a'); }
    if (state.food) {
      const { x, y } = state.food;
      rect(x + .15, y + .2, .7, .6, '#dc8953');
      rect(x + .3, y + .08, .42, .75, '#edab71');
      rect(x + .53, y + .05, .16, .14, '#8dc477');
      rect(x + .27, y + .3, .12, .16, '#f3ca99');
    }
    [...state.snake].reverse().forEach((segment, index) => {
      const head = index === state.snake.length - 1;
      const { x, y } = segment;
      rect(x + .08, y + .08, .84, .84, head ? '#d4ed90' : '#90c56b');
      if (!head) rect(x + .16, y + .16, .68, .17, '#b0d782');
      else {
        const eyes = {
          right: [[.65, .24], [.65, .65]], left: [[.2, .24], [.2, .65]],
          up: [[.24, .2], [.65, .2]], down: [[.24, .65], [.65, .65]],
        }[state.direction];
        eyes.forEach(([ex, ey]) => rect(x + ex, y + ey, .13, .13, '#234535'));
      }
    });
    if (state.phase !== 'playing') {
      ctx.fillStyle = '#183b32c9';
      ctx.fillRect(0, 0, pixelSize, pixelSize);
      const fontSize = Math.round(pixelSize * .066);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#eef1cf';
      ctx.font = `bold ${fontSize}px ui-monospace, monospace`;
      ctx.fillText({ paused: 'TAKE A BREATHER', lost: 'GARDEN CLOSED', won: state.mode === 'gardens' ? 'SIX GARDENS COMPLETE' : 'PERFECT GARDEN', levelClear: 'GARDEN CLEAR' }[state.phase], pixelSize / 2, pixelSize * .47);
      ctx.fillStyle = '#bed0a1';
      ctx.font = `${Math.round(pixelSize * .029)}px ui-monospace, monospace`;
      ctx.fillText(state.phase === 'paused' ? 'PRESS SPACE OR RESUME' : state.phase === 'levelClear' ? 'THE NEXT GARDEN OPENS SOON' : `${state.score} POINTS · START A NEW RUN`, pixelSize / 2, pixelSize * .55);
    }
  }
  function publish() {
    const message = detail();
    if (status.textContent !== message) status.textContent = message;
    label.textContent = state.mode === 'gardens' ? `GARDEN ${state.level + 1} / 6` : 'GARDEN SNAKE';
    progress.hidden = state.mode !== 'gardens';
    for (const dot of progress.children) dot.dataset.state = Number(dot.dataset.level) < state.level || state.phase === 'won' ? 'done' : Number(dot.dataset.level) === state.level ? 'current' : 'future';
    for (const button of modes.children) button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
    hint.textContent = state.mode === 'gardens' ? 'Six layouts. Reach each fruit goal to move on. A new garden gives you a short trail; score carries.' : 'Arrow keys or W A S D to steer. Space to pause. Eat the fruit, grow your trail, and keep room to turn.';
    speed.textContent = `SPEED ${Math.round(1000 / state.stepMs * 10) / 10}`;
    canvas.setAttribute('aria-label', `Snake board. ${state.snake.length} tiles long. Score ${state.score}. ${message} Use arrow keys or W A S D to steer. Space pauses.`);
    onUpdate({ phase: state.phase === 'levelClear' ? 'playing' : state.phase, recordKey: mode === 'gardens' ? 'gardens' : 'default', score: state.score, record: state.score, recordLabel: 'BEST SCORE', scoreLabel: 'SCORE', detail: message });
    draw();
  }
  function schedule() {
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
    if (destroyed || !['playing', 'levelClear'].includes(state.phase)) return;
    // One step per timeout; inactive tabs never cause a burst of catch-up moves.
    timer = window.setTimeout(() => {
      timer = null;
      if (destroyed) return;
      if (state.phase === 'levelClear') advanceGarden(state); else step(state);
      publish();
      schedule();
    }, state.phase === 'levelClear' ? 1400 : state.stepMs);
  }
  function togglePause() {
    if (destroyed || !pauseState(state)) return;
    publish();
    schedule();
  }
  function autoPause() {
    if (['playing', 'levelClear'].includes(state.phase)) togglePause();
  }
  function steer(direction) {
    if (!destroyed && turn(state, direction)) publish();
  }
  function keydown(event) {
    if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey || isForm(event.target)) return;
    if (event.code === 'Space' || event.key === ' ') {
      if (event.target instanceof Element && event.target.closest('button,a,summary')) return;
      event.preventDefault();
      if (!event.repeat) togglePause();
    } else if (KEY_DIRECTIONS[event.key]) {
      event.preventDefault();
      steer(KEY_DIRECTIONS[event.key]);
    }
  }
  function clickDirection(event) {
    const button = event.target.closest('button[data-direction]');
    if (!button || !controls.contains(button)) return;
    steer(button.dataset.direction);
  }
  function changeMode(event) { const button = event.target.closest('button[data-mode]'); if (!button) return; mode = button.dataset.mode; state = createState({ mode }); publish(); schedule(); canvas.focus({ preventScroll: true }); }
  modes.addEventListener('click', changeMode);
  const focusCanvas = () => canvas.focus({ preventScroll: true });
  const visibility = () => { if (document.hidden) autoPause(); };
  window.addEventListener('keydown', keydown);
  window.addEventListener('blur', autoPause);
  document.addEventListener('visibilitychange', visibility);
  canvas.addEventListener('pointerdown', focusCanvas);
  controls.addEventListener('click', clickDirection);
  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(draw) : null;
  if (resizeObserver) resizeObserver.observe(canvas);
  else window.addEventListener('resize', draw);
  publish();
  schedule();

  return {
    getState: () => JSON.parse(JSON.stringify(state)),
    restart() {
      if (destroyed) return;
      state = createState({ mode });
      publish();
      schedule();
    },
    togglePause,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
      resizeObserver?.disconnect();
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('blur', autoPause);
      window.removeEventListener('resize', draw);
      document.removeEventListener('visibilitychange', visibility);
      canvas.removeEventListener('pointerdown', focusCanvas);
      controls.removeEventListener('click', clickDirection);
      modes.removeEventListener('click', changeMode);
      view.remove();
    },
  };
}
