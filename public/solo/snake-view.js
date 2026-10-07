import { GARDENS, GAUNTLET_FRUIT_GOAL, gardenLevels, advanceGarden, createState, step, turn, togglePause as pauseState } from './snake-engine.js';
import { gameKey, getKeyboardLayout, displayKey, subscribeKeyboardLayout } from '../keyboard-layout.js';

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
const setText = (node, text) => { if (node.textContent !== text) node.textContent = text; };

export function mount(container, { onUpdate = () => {} } = {}) {
  let mode = 'gauntlet';
  let state = createState({ mode });
  let timer = null;
  let animationFrame = null;
  let lastPaint = 0;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let destroyed = false;
  const view = element('section', 'snake-view');
  view.setAttribute('aria-label', 'Snake game');
  const topline = element('div', 'snake-topline');
  const label = element('span', '', 'GARDEN SNAKE');
  const speed = element('span', 'snake-speed');
  topline.append(label, speed);
  const modes = element('div', 'snake-modes'); modes.setAttribute('aria-label', 'Snake game mode');
  for (const [id, title] of [['gauntlet', 'Gauntlet'], ['classic', 'Classic'], ['gardens', 'Six gardens']]) { const button = element('button', '', title); button.type = 'button'; button.dataset.mode = id; button.setAttribute('aria-pressed', String(id === mode)); modes.append(button); }
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
  const garden = document.createElement('canvas');
  const gardenContext = garden.getContext('2d');
  let gardenKey = null;
  let cssSize = Math.max(1, canvas.getBoundingClientRect().width || 600);
  const detail = () => ({
    playing: state.mode !== 'classic' ? `${state.mode === 'gauntlet' ? 'Gauntlet · ' : ''}${gardenLevels(state.mode)[state.level].title}: ${state.levelFoods} / ${gardenLevels(state.mode)[state.level].goal} fruit.${state.mode === 'gauntlet' ? ` ${state.fruitMoves} moves to reach the fruit.` : ''} Stone hedges end the run.` : 'Keep growing. The garden gets faster with every fruit.',
    levelClear: `${gardenLevels(state.mode)[state.level].title} cleared. The next garden opens in a moment.`,
    paused: 'Paused. Resume when you are ready to keep growing.',
    lost: state.result === 'fruitExpired' ? 'The fruit wilted. Take a direct route and keep room for the longer trail.' : state.result === 'hedge' ? 'A stone hedge stopped your trail. Restart the garden tour.' : state.result === 'wall' ? 'You reached the garden wall. Start a new run.' : 'Your trail caught up with you. Start a new run.',
    won: state.mode === 'gauntlet' ? `All ${GAUNTLET_FRUIT_GOAL} fruit claimed. The six-garden gauntlet is complete!` : state.mode === 'gardens' ? 'All six gardens cleared. A complete orchard tour!' : 'Every tile is yours. A perfect garden!',
  })[state.phase];

  function paintGarden(pixelSize) {
    const key = `${pixelSize}:${state.width}:${state.height}:${state.mode}:${state.level}`;
    if (gardenKey === key) return;
    gardenKey = key;
    garden.width = pixelSize; garden.height = pixelSize;
    const ctx = gardenContext;
    // Integer boundaries keep the tiles sharp at every viewport size and DPR.
    const cell = pixelSize / state.width;
    const rect = (x, y, w, h, color) => {
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(x * cell), Math.round(y * cell), Math.round((x + w) * cell) - Math.round(x * cell), Math.round((y + h) * cell) - Math.round(y * cell));
    };
    ctx.imageSmoothingEnabled = false;
    for (let y = 0; y < state.height; y += 1) {
        for (let x = 0; x < state.width; x += 1) rect(x, y, 1, 1, (x + y) % 2 ? '#284f3e' : '#2d5743');
    }
    ctx.save();
    ctx.scale(cell, cell);
    const oval = (x, y, rx, ry, color) => { ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); };
    const rounded = (x, y, width, height, radius, color) => { ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, width, height, radius); ctx.fill(); };
    // Little tufts belong to the floor; fruit remains the only bright red object.
    for (let y = 1; y < state.height; y += 3) for (let x = (y % 4) + 1; x < state.width; x += 4) {
      ctx.strokeStyle = '#427255'; ctx.lineWidth = .045; ctx.beginPath();
      ctx.moveTo(x + .25, y + .82); ctx.lineTo(x + .19, y + .63);
      ctx.moveTo(x + .27, y + .82); ctx.lineTo(x + .33, y + .57);
      ctx.moveTo(x + .31, y + .83); ctx.lineTo(x + .43, y + .68); ctx.stroke();
      oval(x + .7, y + .21, .06, .025, '#3d654b');
    }
    for (const { x, y } of state.obstacles) {
      rounded(x + .02, y + .12, .96, .85, .13, '#163b2b');
      rounded(x + .04, y + .04, .92, .83, .12, '#708567');
      rounded(x + .1, y + .08, .8, .15, .07, '#a4b48b');
      rounded(x + .08, y + .69, .84, .11, .04, '#4b654b');
      ctx.strokeStyle = '#465f47'; ctx.lineWidth = .035; ctx.beginPath();
      ctx.moveTo(x + .57, y + .24); ctx.lineTo(x + .48, y + .41); ctx.lineTo(x + .61, y + .58); ctx.stroke();
      oval(x + .2, y + .65, .15, .06, '#89a260');
    }
    ctx.restore();
  }

  function draw() {
    if (destroyed || !ctx || !gardenContext) return;
    const pixelSize = Math.round(cssSize * Math.min(window.devicePixelRatio || 1, 3));
    if (canvas.width !== pixelSize || canvas.height !== pixelSize) {
      canvas.width = pixelSize; canvas.height = pixelSize;
    }
    // Grid, grass and stone hedges are static until the layout or size changes.
    paintGarden(pixelSize);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(garden, 0, 0);
    ctx.save();
    ctx.scale(pixelSize / state.width, pixelSize / state.width);
    const oval = (x, y, rx, ry, color) => { ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); };
    const rounded = (x, y, width, height, radius, color) => { ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, width, height, radius); ctx.fill(); };
    const now = performance.now();
    if (state.food) {
      const { x, y } = state.food;
      const pulse = reducedMotion.matches || state.phase !== 'playing' ? 0 : Math.sin(now / 210) * .025;
      oval(x + .51, y + .83, .33, .11, '#123b2aaa');
      ctx.save(); ctx.translate(x + .5, y + .51); ctx.scale(1 + pulse, 1 + pulse);
      ctx.fillStyle = '#b8433c'; ctx.beginPath(); ctx.moveTo(0, -.25);
      ctx.bezierCurveTo(-.5, -.57, -.49, .31, -.13, .37);
      ctx.bezierCurveTo(-.04, .33, .05, .33, .14, .37);
      ctx.bezierCurveTo(.48, .29, .51, -.57, 0, -.25); ctx.fill();
      oval(-.09, -.08, .21, .24, '#e97851');
      oval(-.15, -.16, .06, .095, '#ffd5a1');
      ctx.strokeStyle = '#a9aa64'; ctx.lineWidth = .07; ctx.beginPath(); ctx.moveTo(0, -.22); ctx.quadraticCurveTo(-.02, -.4, .11, -.47); ctx.stroke();
      ctx.fillStyle = '#97c875'; ctx.beginPath(); ctx.moveTo(.02, -.33); ctx.quadraticCurveTo(.31, -.64, .35, -.36); ctx.quadraticCurveTo(.16, -.19, .02, -.33); ctx.fill();
      ctx.restore();
    }
    const trail = [...state.snake].reverse();
    const trace = offset => { ctx.beginPath(); trail.forEach(({ x, y }, index) => index ? ctx.lineTo(x + .5, y + .5 + offset) : ctx.moveTo(x + .5, y + .5 + offset)); };
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    trace(.11); ctx.lineWidth = .79; ctx.strokeStyle = '#123a2b'; ctx.stroke();
    trace(0); ctx.lineWidth = .77; ctx.strokeStyle = '#467543'; ctx.stroke();
    trace(-.035); ctx.lineWidth = .62;
    const bodyGradient = ctx.createLinearGradient(0, 0, 0, state.height);
    bodyGradient.addColorStop(0, '#b7d577'); bodyGradient.addColorStop(1, '#85b66a');
    ctx.strokeStyle = bodyGradient; ctx.stroke();
    trail.slice(0, -1).forEach(({ x, y }, index) => {
      oval(x + .44, y + .32, .18, .08, '#d2e99a66');
      ctx.fillStyle = index % 2 ? '#609459' : '#709f5d'; ctx.beginPath();
      ctx.moveTo(x + .5, y + .4); ctx.lineTo(x + .64, y + .51); ctx.lineTo(x + .5, y + .64); ctx.lineTo(x + .36, y + .51); ctx.fill();
    });
    const head = state.snake[0];
    ctx.save(); ctx.translate(head.x + .5, head.y + .5);
    ctx.rotate({ right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[state.direction]);
    rounded(-.42, -.41, .9, .83, .24, '#cbe28b');
    rounded(-.32, -.34, .69, .65, .2, '#dbeaa2');
    if (!reducedMotion.matches && state.phase === 'playing' && now % 2800 < 220) {
      ctx.strokeStyle = '#ed9975'; ctx.lineWidth = .045; ctx.beginPath();
      ctx.moveTo(.42, .01); ctx.lineTo(.61, .01); ctx.lineTo(.68, -.05);
      ctx.moveTo(.61, .01); ctx.lineTo(.68, .07); ctx.stroke();
    }
    for (const y of [-.23, .23]) { oval(.19, y, .15, .14, '#f4f5d3'); oval(.23, y, .075, .09, '#234f36'); oval(.25, y - .025, .025, .028, '#fff'); }
    oval(.36, -.07, .025, .025, '#719656'); oval(.36, .07, .025, .025, '#719656');
    ctx.restore(); ctx.restore();
    if (state.phase !== 'playing') {
      ctx.fillStyle = '#183b32c9';
      ctx.fillRect(0, 0, pixelSize, pixelSize);
      const fontSize = Math.round(pixelSize * .066);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#eef1cf';
      ctx.font = `bold ${fontSize}px ui-monospace, monospace`;
      ctx.fillText({ paused: 'TAKE A BREATHER', lost: 'GARDEN CLOSED', won: state.mode !== 'classic' ? 'SIX GARDENS COMPLETE' : 'PERFECT GARDEN', levelClear: 'GARDEN CLEAR' }[state.phase], pixelSize / 2, pixelSize * .47);
      ctx.fillStyle = '#bed0a1';
      ctx.font = `${Math.round(pixelSize * .029)}px ui-monospace, monospace`;
      ctx.fillText(state.phase === 'paused' ? 'PRESS SPACE OR RESUME' : state.phase === 'levelClear' ? 'THE NEXT GARDEN OPENS SOON' : `${state.score} POINTS · START A NEW RUN`, pixelSize / 2, pixelSize * .55);
    }
  }
  function animate() {
    animationFrame = null;
    if (destroyed || reducedMotion.matches || state.phase !== 'playing') return;
    const now = performance.now();
    if (now - lastPaint >= 40) { draw(); lastPaint = now; }
    animationFrame = window.requestAnimationFrame(animate);
  }
  function publish() {
    const message = detail();
    if (status.textContent !== message) status.textContent = message;
    setText(label, state.mode === 'gauntlet' ? `GAUNTLET ${state.level + 1} / 6` : state.mode === 'gardens' ? `GARDEN ${state.level + 1} / 6` : 'GARDEN SNAKE');
    if (progress.hidden !== (state.mode === 'classic')) progress.hidden = state.mode === 'classic';
    for (const dot of progress.children) {
      const value = Number(dot.dataset.level) < state.level || state.phase === 'won' ? 'done' : Number(dot.dataset.level) === state.level ? 'current' : 'future';
      if (dot.dataset.state !== value) dot.dataset.state = value;
    }
    for (const button of modes.children) {
      const value = String(button.dataset.mode === mode);
      if (button.getAttribute('aria-pressed') !== value) button.setAttribute('aria-pressed', value);
    }
    view.dataset.keyboardLayout = getKeyboardLayout();
    const keyboardHint = `Arrows / ${displayKey('WASD')} to steer · Space pauses. `;
    setText(hint, keyboardHint + (state.mode === 'gauntlet' ? `${GAUNTLET_FRUIT_GOAL} fruit across six demanding layouts. Start with a longer trail each stage. Reach each fruit before its move allowance runs out; pausing preserves it.` : state.mode === 'gardens' ? 'Six gentler layouts. Reach each fruit goal to move on. A new garden gives you a short trail; score carries.' : 'Eat the fruit, grow your trail, and keep room to turn.'));
    setText(speed, `SPEED ${Math.round(1000 / state.stepMs * 10) / 10}${state.mode === 'gauntlet' ? ` · ${state.fruitMoves ?? '—'} MOVES` : ''}`);
    const description = `Snake board. ${state.snake.length} tiles long. Score ${state.score}. ${message} Use arrow keys or ${displayKey('W A S D')} to steer. Space pauses.`;
    if (canvas.getAttribute('aria-label') !== description) canvas.setAttribute('aria-label', description);
    onUpdate({ phase: state.phase === 'levelClear' ? 'playing' : state.phase, recordKey: mode === 'classic' ? 'default' : mode === 'gauntlet' ? 'gauntlet-v3' : mode, score: state.score, record: state.score, recordLabel: mode === 'gauntlet' ? 'BEST GAUNTLET' : 'BEST SCORE', scoreLabel: 'SCORE', detail: message });
    draw();
    if (state.phase === 'playing' && !reducedMotion.matches && animationFrame === null) animationFrame = window.requestAnimationFrame(animate);
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
    const key = gameKey(event);
    if (key === ' ' || key === 'Space') {
      if (event.target instanceof Element && event.target.closest('button,a,summary')) return;
      event.preventDefault();
      if (!event.repeat) togglePause();
    } else if (KEY_DIRECTIONS[key]) {
      event.preventDefault();
      steer(KEY_DIRECTIONS[key]);
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
  function resize(entries) {
    if (destroyed) return;
    const width = Array.isArray(entries) ? entries[0]?.borderBoxSize?.[0]?.inlineSize || canvas.getBoundingClientRect().width : canvas.getBoundingClientRect().width;
    cssSize = Math.max(1, width || 600);
    draw();
  }
  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  if (resizeObserver) resizeObserver.observe(canvas);
  window.addEventListener('resize', resize);
  const unsubscribeKeyboardLayout = subscribeKeyboardLayout(publish);
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
      unsubscribeKeyboardLayout();
      if (timer !== null) window.clearTimeout(timer);
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
      timer = null;
      resizeObserver?.disconnect();
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('blur', autoPause);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', visibility);
      canvas.removeEventListener('pointerdown', focusCanvas);
      controls.removeEventListener('click', clickDirection);
      modes.removeEventListener('click', changeMode);
      view.remove();
    },
  };
}
