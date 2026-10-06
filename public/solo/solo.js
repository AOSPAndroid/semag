const GAME_INFO = {
  'ember-delve': {
    title: 'Ember Delve', category: 'ACTION ROGUELIKE / THREE ACTS', description: 'Twelve rooms. Three guardians. A different build on every descent.',
    module: '/solo/ember-view.js', ruleTitle: 'Keep the flame alive.',
    controls: [[['W','A','S','D'], 'Move'], [['Mouse'], 'Aim'], [['Click','J'], 'Sword'], [['E','K'], 'Ember bolt'], [['Space','Shift'], 'Dodge'], [['F'], 'Interact']],
    touch: 'Use the left pad to move, the right pad to aim, and the action buttons to attack, cast, dodge, or interact.',
    rules: ['Clear each chamber, then reach a glowing exit to choose a route.', 'Safe roads offer supplies and camps. Risky roads offer elite fights and richer rewards.', 'Choose relics to shape sword, spell, and dodge combinations. Health carries between rooms.', 'Read enemy windups, preserve stamina and mana, and learn each of the three bosses.', 'Save the run seed to revisit the same dungeon. A new run resets your build.'],
  },
  'deckbound': {
    title: 'Deckbound', category: 'DECKBUILDING ROGUELIKE / THREE ACTS', description: 'Read the enemy. Build a deck. Survive the long road.',
    module: '/solo/deckbound-view.js', ruleTitle: 'Make every card count.',
    controls: [[['Click','Tap'], 'Play cards and choose routes'], [['1–9'], 'Play a hand card'], [['E'], 'End turn']],
    touch: 'Tap a card to play it. Choose an enemy target when several foes are present. Route, reward, camp, and shop choices use buttons.',
    rules: ['Complete eighteen encounters across three acts. Enemy intent shows the next attack.', 'Spend energy on damage, block, and status effects; unused block expires at your next turn.', 'Shape your deck with card rewards, upgrades, removal, shops, and relics.', 'Elite roads offer stronger rewards and tougher battles. Rest stops can heal or upgrade a card.', 'Defeat all three bosses. Death ends the expedition; replay its seed or begin a fresh route.'],
  },
  snake: {
    recordPolicy: { scopes: ['default', 'gardens'] },
    title: 'Snake', category: 'A QUICK SOLO CLASSIC', description: 'One more apple. One sharper turn.',
    module: '/solo/snake-view.js', ruleTitle: 'Keep it growing.',
    controls: [[['↑', '←', '↓', '→'], 'Steer'], [['W', 'A', 'S', 'D'], 'Also steer']],
    touch: 'Use the direction buttons below the board on a phone or tablet.',
    rules: ['Eat apples to grow your snake and build your score.', 'Plan your turns. Hitting a wall or your own tail ends the run.', 'You cannot reverse straight into yourself. Keep some room to turn.', 'Choose Six gardens to explore six obstacle layouts with fruit goals. Classic remains an endless score run.'],
  },
  minesweeper: {
    title: 'Minesweeper', category: 'A LITTLE DEDUCTION', description: 'A quiet board. A careful next step.',
    module: '/solo/minesweeper-view.js', ruleTitle: 'Read between the mines.',
    recordPolicy: { direction: 'min', scopes: ['beginner', 'intermediate', 'expert'], unit: 's', onlyWon: true },
    controls: [[['Click'], 'Reveal a tile'], [['Right click'], 'Place a flag'], [['↑', '←', '↓', '→'], 'Explore the board'], [['Enter'], 'Reveal'], [['F'], 'Flag']],
    touch: 'Switch Flag mode on to flag tiles with a tap. Pick Beginner, Intermediate, or Expert for a fresh board.',
    rules: ['Numbers tell you how many mines touch a tile, including diagonals.', 'Reveal every safe tile to win. Flags help you keep track of suspected mines.', 'Your first reveal is safe. Expert adds a 30 × 16 board with 99 mines. Your best time is saved separately for each difficulty.'],
  },
  '2048': {
    recordPolicy: { scopes: ['default', 'puzzles'] },
    title: '2048', category: 'ONE MORE GOOD MOVE', description: 'Small numbers. Big possibilities.',
    module: '/solo/2048-view.js', ruleTitle: 'Leave room to grow.',
    controls: [[['↑', '←', '↓', '→'], 'Slide all tiles'], [['W', 'A', 'S', 'D'], 'Also slide']],
    touch: 'Swipe across the board to slide. Use Undo to take back your last move.',
    rules: ['Slide the board. Equal tiles merge into one tile with twice the value.', 'In Classic, a new tile appears after each move that changes the board.', 'Reach 2048 to win, then keep playing if you wish. The run ends when no moves remain.', 'Choose Six puzzles for six preset boards with move budgets and tile goals. Puzzles add no new tiles; plan the whole sequence before sliding.'],
  },
  'apex-circuit': {
    title: 'Apex Circuit', category: 'DRIVING / TIME TRIAL', description: 'Three circuits. A full championship. Your next personal best.',
    module: '/solo/circuit-view.js', ruleTitle: 'Find your racing line.',
    scoreDigits: 2, scoreUnit: 's',
    recordPolicy: { direction: 'min', scopes: ['three-laps', 'harbor-ring-three-laps', 'rain-pass-three-laps', 'championship'], unit: 's', digits: 2, onlyWon: true },
    controls: [[['W', '↑'], 'Accelerate'], [['S', '↓'], 'Brake / reverse'], [['A', 'D', '←', '→'], 'Steer'], [['Space'], 'Handbrake'], [['Q'], 'Reset car (+3s)']],
    touch: 'Hold the pedal and steering buttons below the track. The handbrake helps rotate the car through a tight corner.',
    rules: ['Complete three laps. Follow the direction arrows and pass each checkpoint in order.', 'Brake before a corner, then accelerate out. Grass slows you down.', 'Use Q or Reset car to recover at a checkpoint. Each reset adds three seconds.', 'Select Meadow Loop, Harbor Ring, or Rain Pass. Slick zones and grip change the handling.', 'Championship links all three races. Best completed times are saved separately for each track and for the championship.'],
  },
  'night-drive': {
    recordPolicy: { scopes: ['default', 'tour'] },
    title: 'Night Drive', category: 'DRIVING / HIGHWAY', description: 'City lights. Open lanes. One more mile.',
    module: '/solo/highway-view.js', ruleTitle: 'Keep a lane open.',
    controls: [[['A', 'D', '←', '→'], 'Steer'], [['W', '↑'], 'Accelerate'], [['S', '↓'], 'Brake'], [['Space'], 'Boost']],
    touch: 'Hold the steering, pedal, and boost buttons below the road. The car cruises automatically when you release the pedals.',
    rules: ['Weave through traffic to build your distance and score.', 'Close, clean passes earn a near-miss bonus. Hitting traffic damages your car.', 'Boost uses charge, which recovers while you drive without boosting.', 'Three impacts end the run. Brake early and use clear lanes to recover.', 'Tour crosses five distinct districts over 4.5 km. Watch construction warnings and merging traffic; boost cells and clean checkpoints refill resources.'],
  },
  'prism-shift': {
    title: 'Prism Shift', category: 'FALLING BLOCKS / TIME & SCORE', description: 'Fast hands. A clean stack. One more perfect placement.',
    module: '/solo/prism-view.js', ruleTitle: 'Build with a plan.',
    recordPolicy: { scopes: ['marathon', 'sprint', 'dig'], variants: {
      marathon: { direction: 'max' },
      sprint: { direction: 'min', digits: 2, unit: 's', onlyWon: true },
      dig: { direction: 'min', digits: 2, unit: 's', onlyWon: true },
    } },
    controls: [[['←', '→'], 'Move the piece'], [['↓'], 'Soft drop'], [['↑', 'X'], 'Rotate clockwise'], [['Z'], 'Rotate counterclockwise'], [['Space'], 'Hard drop'], [['C', 'Shift'], 'Hold the piece']],
    touch: 'Use the buttons below the board. Hold a direction to move repeatedly. Choose Marathon, the 40-line Sprint, or Dig 8, the eight-stage Excavation road.',
    rules: ['Fill a horizontal row to clear it. Use the ghost to plan where a piece will land.', 'Each bag contains all seven piece types. Hold saves one piece; you can swap once per placement.', 'Rotations can kick away from walls. The lock delay gives you a moment to finish a placement.', 'Keep your stack low as the pace increases. Build combos, four-line clears, and T-spins for extra points.', 'Marathon saves your best score. Sprint saves your fastest completed 40-line time.', 'Dig 8 (Excavation) has eight handcrafted garbage layouts, piece budgets, and fixed queues. Clear each stage to advance; the full completion time has its own record.'],
  },
  'rift-survivor': {
    recordPolicy: { scopes: ['default', 'veteran'] },
    title: 'Rift Survivor', category: 'SURVIVAL ARENA / FOUR SECTORS', description: 'Find your opening. Shape your build. Close the rift.',
    module: '/solo/rift-view.js', ruleTitle: 'Learn the patterns.',
    controls: [[['W', 'A', 'S', 'D'], 'Move'], [['Mouse'], 'Aim'], [['Click', 'J'], 'Fire'], [['Space', 'Shift'], 'Dash']],
    touch: 'Use the left pad to move and the right pad to aim and fire. Dash at the right moment to cross a dangerous gap.',
    rules: ['Clear twenty waves across four sectors. Chasers, strafers, casters, charging brutes, and affixed elites demand different movement.', 'Watch the attack warnings, aim your shots, and use cover. Keep room to dodge.', 'Sustained fire heats your weapon. Release it to cool down; dash uses stamina.', 'Choose an upgrade after each cleared wave. Build around ricochet, chains, frost, dash attacks, and recovery. Overcharge a wave for extra risk and rewards.', 'Four guardians protect waves five, ten, fifteen, and twenty. Read their warning patterns and floor hazards.'],
  },
};

function validRecord(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/** Completed timed events compete on lowest time; ongoing runs cannot replace them. */
export function recordDetails(gameId, update) {
  const base = GAME_INFO[gameId]?.recordPolicy || {};
  const scopes = base.scopes || ['default'];
  const scope = scopes.includes(update.recordKey) ? update.recordKey : scopes[0];
  const policy = { ...base, ...base.variants?.[scope] };
  return {
    scope,
    direction: policy.direction === 'min' ? 'min' : 'max',
    candidate: policy.onlyWon ? (update.phase === 'won' ? update.record : null) : (update.record ?? update.score),
    unit: policy.unit || '', digits: policy.digits,
  };
}

function formatValue(value, digits, unit = '') {
  return `${Number.isInteger(digits) && digits >= 0 && digits <= 3 ? value.toFixed(digits) : String(value)}${unit}`;
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
  const help = $('solo-how-to');
  let game = null;
  let destroyed = false;

  document.title = `${info.title} — Fireside`;
  $('solo-app').dataset.game = gameId;
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
    $('solo-score').textContent = formatValue(validRecord(update.score) ? update.score : 0, update.scoreDigits ?? info.scoreDigits, update.scoreUnit ?? info.scoreUnit);
    $('solo-score-label').textContent = update.scoreLabel || 'SCORE';
    $('solo-record-label').textContent = update.recordLabel || (gameId === 'minesweeper' ? 'BEST TIME' : 'BEST SCORE');
    $('solo-detail').textContent = update.detail || (phase === 'paused' ? 'Take your time. Resume when you are ready.' : 'A new personal best is only a game away.');
    const { scope, direction, candidate, unit, digits } = recordDetails(gameId, update);
    const best = validRecord(candidate) ? records.update(gameId, candidate, { scope, direction }) : records.read(gameId, scope);
    $('solo-record').textContent = best === null ? '—' : formatValue(best, digits, unit);
    $('solo-record-scope').textContent = gameId === 'minesweeper' ? `Best ${scope} time stays in this browser, on this host.` : gameId === 'apex-circuit' ? 'Best completed time is saved separately for each track and championship.' : gameId === 'prism-shift' && scope === 'sprint' ? 'Best completed 40-line time stays in this browser, on this host.' : gameId === 'prism-shift' && scope === 'dig' ? 'Best completed eight-stage Excavation time stays in this browser, on this host.' : 'Best score stays in this browser, on this host.';
    pause.disabled = finished;
    pause.setAttribute('aria-pressed', String(phase === 'paused'));
    pause.querySelector('span').textContent = phase === 'paused' ? 'Resume' : 'Pause';
    pause.querySelector('b').innerHTML = phase === 'paused' ? '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="m4 2 10 6-10 6z"/></svg>' : '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M3 2h3v12H3zm7 0h3v12h-3z"/></svg>';
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
    if (game && !destroyed && !['paused', 'won', 'lost'].includes(game.getState().phase)) game.togglePause();
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
  function helpKeydown(event) {
    // Keep native disclosure activation from also triggering a game action.
    if (['Space', 'Enter'].includes(event.code) && event.target instanceof Element && event.target.closest('summary')) event.stopPropagation();
  }
  function cleanup() {
    if (destroyed) return;
    destroyed = true;
    restart.removeEventListener('click', newGame);
    pause.removeEventListener('click', togglePause);
    help.removeEventListener('keydown', helpKeydown);
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
    help.addEventListener('keydown', helpKeydown);
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
