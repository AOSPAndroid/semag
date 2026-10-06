const GAME_INFO = {
  snake: {
    title: 'Snake', category: 'A QUICK SOLO CLASSIC', description: 'One more apple. One sharper turn.',
    module: '/solo/snake-view.js', ruleTitle: 'Keep it growing.',
    controls: [[['↑', '←', '↓', '→'], 'Steer'], [['W', 'A', 'S', 'D'], 'Also steer']],
    touch: 'Use the direction buttons below the board on a phone or tablet.',
    rules: ['Eat apples to grow your snake and build your score.', 'Plan your turns. Hitting a wall or your own tail ends the run.', 'You cannot reverse straight into yourself. Keep some room to turn.'],
  },
  minesweeper: {
    title: 'Minesweeper', category: 'A LITTLE DEDUCTION', description: 'A quiet board. A careful next step.',
    module: '/solo/minesweeper-view.js', ruleTitle: 'Read between the mines.',
    controls: [[['Click'], 'Reveal a tile'], [['Right click'], 'Place a flag'], [['↑', '←', '↓', '→'], 'Explore the board'], [['Enter'], 'Reveal'], [['F'], 'Flag']],
    touch: 'Switch Flag mode on to flag tiles with a tap. Pick Beginner or Intermediate for a fresh board.',
    rules: ['Numbers tell you how many mines touch a tile, including diagonals.', 'Reveal every safe tile to win. Flags help you keep track of suspected mines.', 'Your first reveal is safe. Your best time is saved separately for each difficulty.'],
  },
  '2048': {
    title: '2048', category: 'ONE MORE GOOD MOVE', description: 'Small numbers. Big possibilities.',
    module: '/solo/2048-view.js', ruleTitle: 'Leave room to grow.',
    controls: [[['↑', '←', '↓', '→'], 'Slide all tiles'], [['W', 'A', 'S', 'D'], 'Also slide']],
    touch: 'Swipe across the board to slide. Use Undo to take back your last move.',
    rules: ['Slide the board. Equal tiles merge into one tile with twice the value.', 'A new tile appears after each move that changes the board.', 'Reach 2048 to win, then keep playing if you wish. The run ends when no moves remain.'],
  },
};

function validRecord(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

// Records are local to this browser and origin. The memory mirror keeps play
// usable when the browser denies storage, including denial partway through a run.
export function createBestStore(storage) {
  const memory = new Map();
  let storageUnavailable = !storage;
  const keyFor = (gameId, scope) => `fireside-solo-best:${gameId}:${scope}`;
  function read(gameId, scope = 'default') {
    const key = keyFor(gameId, scope);
    if (storageUnavailable) return memory.get(key) ?? null;
    try {
      const raw = storage.getItem(key);
      if (raw === null) return null;
      if (typeof raw !== 'string' || raw.length === 0 || raw !== raw.trim()) return null;
      let value;
      try { value = JSON.parse(raw); } catch { return null; }
      if (!validRecord(value)) return null;
      memory.set(key, value);
      return value;
    } catch { storageUnavailable = true; return memory.get(key) ?? null; }
  }
  function update(gameId, value, { scope = 'default', direction = 'max' } = {}) {
    const previous = read(gameId, scope);
    if (!validRecord(value)) return previous;
    const next = previous === null ? value : direction === 'min' ? Math.min(previous, value) : Math.max(previous, value);
    const key = keyFor(gameId, scope);
    memory.set(key, next);
    if (!storageUnavailable && previous !== next) {
      try { storage.setItem(key, JSON.stringify(next)); } catch { storageUnavailable = true; }
    }
    return next;
  }
  return Object.freeze({ read, update });
}

async function startSolo() {
  const $ = (id) => document.getElementById(id);
  const query = new URLSearchParams(location.search);
  const requested = query.get('game');
  const gameId = Object.hasOwn(GAME_INFO, requested) ? requested : 'snake';
  const info = GAME_INFO[gameId];
  const invalidGame = requested !== null && !Object.hasOwn(GAME_INFO, requested);
  let storage;
  try { storage = window.localStorage; } catch {}
  const records = createBestStore(storage);
  const restart = $('solo-restart');
  const pause = $('solo-pause');
  const container = $('solo-game');
  let game = null;
  let destroyed = false;

  document.title = `${info.title} — Fireside`;
  $('solo-title').textContent = info.title;
  $('solo-category').textContent = info.category;
  $('solo-description').textContent = info.description;
  $('solo-rules-title').textContent = info.ruleTitle;
  $('solo-touch-help').textContent = info.touch;
  container.setAttribute('aria-label', `${info.title} game area`);
  if (invalidGame) {
    $('solo-notice').textContent = 'That game is not on the solo shelf. Here is Snake instead.';
    $('solo-notice').hidden = false;
  }
  for (const [keys, label] of info.controls) {
    const line = document.createElement('div');
    line.className = 'solo-control-line';
    const keyGroup = document.createElement('span');
    keyGroup.className = 'solo-control-keys';
    for (const key of keys) {
      const cap = document.createElement('kbd');
      cap.textContent = key;
      keyGroup.append(cap);
    }
    const text = document.createElement('span');
    text.textContent = label;
    line.append(keyGroup, text);
    $('solo-controls-list').append(line);
  }
  for (const rule of info.rules) {
    const item = document.createElement('li');
    item.textContent = rule;
    $('solo-rules').append(item);
  }

  function onUpdate(update) {
    if (destroyed) return;
    const phase = ['playing', 'paused', 'won', 'lost'].includes(update.phase) ? update.phase : 'playing';
    const finished = phase === 'won' || phase === 'lost';
    $('solo-app').dataset.phase = phase;
    $('solo-status-label').textContent = { playing: 'IN PLAY', paused: 'PAUSED', won: 'YOU DID IT', lost: 'RUN COMPLETE' }[phase];
    $('solo-score').textContent = validRecord(update.score) ? String(update.score) : '0';
    $('solo-score-label').textContent = update.scoreLabel || 'SCORE';
    $('solo-record-label').textContent = update.recordLabel || (gameId === 'minesweeper' ? 'BEST TIME' : 'BEST SCORE');
    $('solo-detail').textContent = update.detail || (phase === 'paused' ? 'Take your time. Resume when you are ready.' : 'A new personal best is only a game away.');
    const scope = gameId === 'minesweeper' && update.recordKey === 'intermediate' ? 'intermediate' : gameId === 'minesweeper' ? 'beginner' : 'default';
    const direction = gameId === 'minesweeper' ? 'min' : 'max';
    const candidate = gameId === 'minesweeper' ? (phase === 'won' ? update.record : null) : (update.record ?? update.score);
    const best = validRecord(candidate) ? records.update(gameId, candidate, { scope, direction }) : records.read(gameId, scope);
    $('solo-record').textContent = best === null ? '—' : gameId === 'minesweeper' ? `${best}s` : String(best);
    $('solo-record-scope').textContent = gameId === 'minesweeper' ? `Best ${scope} time stays in this browser, on this host.` : 'Best score stays in this browser, on this host.';
    pause.disabled = finished;
    pause.setAttribute('aria-pressed', String(phase === 'paused'));
    pause.querySelector('span').textContent = phase === 'paused' ? 'Resume' : 'Pause';
    pause.querySelector('b').textContent = phase === 'paused' ? '▷' : 'Ⅱ';
    $('solo-session-note').textContent = phase === 'paused' ? 'A breather is part of the game. Pick up where you left off.' : finished ? 'A fresh board is one click away. Your best is yours to keep.' : 'One player. Start straight away and play at your own pace.';
  }

  function focusGame() {
    const target = container.querySelector('[data-solo-focus],canvas[tabindex],[role="grid"][tabindex],[tabindex="0"]') || container;
    target.focus({ preventScroll: true });
  }
  function newGame() {
    if (!game || destroyed) return;
    game.restart();
    focusGame();
  }
  function togglePause() {
    if (!game || destroyed || ['won', 'lost'].includes(game.getState().phase)) return;
    game.togglePause();
  }
  function autoPause() {
    if (game && !destroyed && game.getState().phase === 'playing') game.togglePause();
  }
  function visibilityChanged() { if (document.hidden) autoPause(); }
  function pageHidden(event) {
    // A cached page keeps its controller so browser Back restores a paused game.
    if (event.persisted) autoPause();
    else cleanup();
  }
  function keydown(event) {
    if (event.defaultPrevented || event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target instanceof Element && event.target.closest('input,select,textarea,[contenteditable="true"]')) return;
    const key = event.key.toLowerCase();
    if (key === 'r') { event.preventDefault(); newGame(); }
    else if (key === 'p') { event.preventDefault(); togglePause(); }
  }
  function cleanup() {
    if (destroyed) return;
    destroyed = true;
    restart.removeEventListener('click', newGame);
    pause.removeEventListener('click', togglePause);
    window.removeEventListener('keydown', keydown);
    window.removeEventListener('blur', autoPause);
    window.removeEventListener('pagehide', pageHidden);
    document.removeEventListener('visibilitychange', visibilityChanged);
    game?.destroy();
  }

  try {
    const module = await import(info.module);
    if (destroyed) return;
    game = module.mount(container, { onUpdate });
    if (!game || typeof game.getState !== 'function' || typeof game.restart !== 'function' || typeof game.togglePause !== 'function' || typeof game.destroy !== 'function') throw new Error('Invalid solo game interface');
    restart.disabled = false;
    restart.addEventListener('click', newGame);
    pause.addEventListener('click', togglePause);
    window.addEventListener('keydown', keydown);
    window.addEventListener('blur', autoPause);
    window.addEventListener('pagehide', pageHidden);
    document.addEventListener('visibilitychange', visibilityChanged);
    Object.defineProperty(window, 'firesideSolo', { configurable: true, value: Object.freeze({ gameId, getState: () => game?.getState() ?? null }) });
    focusGame();
  } catch (error) {
    cleanup();
    $('solo-error').textContent = 'This game could not load. Refresh the page to try again, or choose another game from the shelf.';
    $('solo-error').hidden = false;
    $('solo-status-label').textContent = 'UNAVAILABLE';
    $('solo-detail').textContent = 'Your best scores are saved for your next visit.';
    restart.disabled = true;
    pause.disabled = true;
    console.error('Solo game failed to load', error);
  }
}

if (typeof document !== 'undefined') startSolo();
