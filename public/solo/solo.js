import { setText, setAttribute, setDisabled, setHTML } from '../hub/dom.js';
const ACTION_SCOPES = ['default', 'veteran', 'nightmare'];
const tierScopes = scopes => [...scopes, ...['veteran', 'nightmare'].flatMap(tier => scopes.map(scope => `${tier}-${scope}`))];
const RACE_SCOPES = tierScopes(['three-laps', 'harbor-ring-three-laps', 'rain-pass-three-laps', 'championship']);
const PRISM_SCOPES = tierScopes(['marathon', 'sprint', 'dig']);
const PARIS_SURVIVAL_SCOPES = ['standard', 'veteran', 'nightmare'].map(tier => `${tier}-survival-v1`);
const GAME_INFO = {
  'paris-pedal': {
    title: 'Paris Pedal', category: 'DRIVING / PARIS E-BIKE SURVIVAL', description: 'The longer you last, the faster Paris flies past.',
    module: '/solo/paris-view.js', ruleTitle: 'Last one more second.',
    recordPolicy: { scopes: [...PARIS_SURVIVAL_SCOPES, 'standard-delivery', 'veteran-delivery', 'nightmare-delivery', 'standard-rush', 'veteran-rush', 'nightmare-rush'], variants: {
      ...Object.fromEntries(PARIS_SURVIVAL_SCOPES.map(scope => [scope, { onlyCrashed: true, unit: 'duration-ms' }])),
      'standard-delivery': { onlyWon: true }, 'veteran-delivery': { onlyWon: true }, 'nightmare-delivery': { onlyWon: true },
    } },
    controls: [[['A', 'D', '←', '→'], 'Steer'], [['W', '↑'], 'Pedal'], [['S', '↓'], 'Brake'], [['Space'], 'Motor assist'], [['B'], 'Ring bell']],
    touch: 'Your e-bike moves automatically. Hold the steering and brake buttons to find gaps; use pedal and assist for bursts. Tap the bell to warn cyclists.',
    rules: ['Survival starts by default. Stay alive as long as possible while the streets cycle endlessly through five Paris-inspired districts.', 'Your e-bike moves automatically and its pace keeps rising with time alive. Braking trims speed but cannot stop the ride.', 'Thread between cars. Buses signal before pulling out, cyclists warn before veering, and parked doors flash before opening.', 'Motor assist spends battery; braking recovers charge. The bell warns nearby cyclists, while buses and cars still need a clear escape route.', 'Three impacts end a Survival run. District changes never repair the rider. Pause time does not count toward your record.', 'Your longest completed survival time stays in this browser, separately for Standard, Veteran and Nightmare.', 'Five deliveries is an alternate route with checkpoint deadlines on Veteran and Nightmare. Its points records require all five districts and stay separate from Survival.'],
  },
  'ember-delve': {
    recordPolicy: { scopes: ACTION_SCOPES },
    title: 'Ember Delve', category: 'ACTION ROGUELIKE / THREE ACTS', description: 'Read the windup. Break the pursuit. Earn your descent.',
    module: '/solo/ember-view.js', ruleTitle: 'Keep the flame alive.',
    controls: [[['W','A','S','D'], 'Move'], [['Mouse'], 'Aim'], [['Click','J'], 'Sword'], [['E','K'], 'Ember bolt'], [['Space','Shift'], 'Dodge'], [['F'], 'Interact']],
    touch: 'Use the left pad to move, the right pad to aim, and the action buttons to attack, cast, dodge, or interact.',
    rules: ['Clear each chamber, then reach a glowing exit to choose a route.', 'Safe roads offer supplies and camps. Risky roads offer elite fights and richer rewards.', 'Choose relics to shape sword, spell, and dodge combinations. Health carries between rooms.', 'Veteran starts by default: enemies intercept, flank, and pressure your recovery. Watch their warnings and vary your movement.', 'Standard offers a gentler descent; Nightmare demands tighter resource management and dodges. Changing difficulty begins a fresh run.', 'Save the run seed to revisit the same dungeon at the same difficulty. A new run resets your build.'],
  },
  'deckbound': {
    recordPolicy: { scopes: ACTION_SCOPES },
    title: 'Deckbound', category: 'DECKBUILDING ROGUELIKE / THREE ACTS', description: 'Read the enemy. Build a deck. Survive the long road.',
    module: '/solo/deckbound-view.js', ruleTitle: 'Make every card count.',
    controls: [[['Click','Tap'], 'Play cards and choose routes'], [['1–9'], 'Play a hand card'], [['E'], 'End turn']],
    touch: 'Tap a card to play it. Choose an enemy target when several foes are present. Route, reward, camp, and shop choices use buttons.',
    rules: ['Complete eighteen encounters across three acts. Enemy intent shows the next attack.', 'Spend energy on damage, block, and status effects; unused block expires at your next turn.', 'Shape your deck with card rewards, upgrades, removal, shops, and relics.', 'Elite roads offer stronger rewards and tougher battles. Rest stops can heal or upgrade a card.', 'Veteran is the default. Standard, Veteran, and Nightmare have separate records; changing difficulty begins a fresh expedition.', 'Defeat all three bosses. Death ends the expedition; replay its seed or begin a fresh route.'],
  },
  snake: {
    recordPolicy: { scopes: ['default', 'gardens', 'gauntlet'] },
    title: 'Snake', category: 'SOLO ARCADE / SPEED & ROUTES', description: 'Classic runs or a faster, seventy-eight-fruit Gauntlet.',
    module: '/solo/snake-view.js', ruleTitle: 'Keep it growing.',
    controls: [[['↑', '←', '↓', '→'], 'Steer'], [['W', 'A', 'S', 'D'], 'Also steer']],
    touch: 'Use the direction buttons below the board on a phone or tablet.',
    rules: ['Eat apples to grow your snake and build your score.', 'Plan your turns. Hitting a wall or your own tail ends the run.', 'You cannot reverse straight into yourself. Keep some room to turn.', 'Gauntlet starts by default: six obstacle gardens with faster turns, longer tails, and bigger fruit goals.', 'Choose Classic for an endless score run or Six gardens for the original gentler road. Each mode keeps its own best score.'],
  },
  minesweeper: {
    title: 'Minesweeper', category: 'SOLO PUZZLE / THREE DIFFICULTIES', description: 'Three fields. Up to ninety-nine mines. Earn a clean sweep.',
    module: '/solo/minesweeper-view.js', ruleTitle: 'Read between the mines.',
    recordPolicy: { direction: 'min', scopes: ['beginner', 'intermediate', 'expert'], unit: 's', onlyWon: true },
    controls: [[['Click'], 'Reveal a tile'], [['Right click'], 'Place a flag'], [['↑', '←', '↓', '→'], 'Explore the board'], [['Enter'], 'Reveal'], [['F'], 'Flag']],
    touch: 'Switch Flag mode on to flag tiles with a tap. Pick Beginner, Intermediate, or Expert for a fresh board.',
    rules: ['Numbers tell you how many mines touch a tile, including diagonals.', 'Reveal every safe tile to win. Flags help you keep track of suspected mines.', 'Expert starts by default with a 30 × 16 board and 99 mines. Beginner and Intermediate remain available.', 'Your first reveal is safe. Best completed times are saved separately for each difficulty.'],
  },
  '2048': {
    recordPolicy: { scopes: ['default', 'puzzles', 'master'] },
    title: '2048', category: 'SOLO PUZZLE / CLASSIC & MASTER', description: 'Classic merges or six Master trials, reaching 4096.',
    module: '/solo/2048-view.js', ruleTitle: 'Leave room to grow.',
    controls: [[['↑', '←', '↓', '→'], 'Slide all tiles'], [['W', 'A', 'S', 'D'], 'Also slide']],
    touch: 'Swipe across the board to slide. Use Undo to take back your last move.',
    rules: ['Slide the board. Equal tiles merge into one tile with twice the value.', 'Master puzzles start by default: dense preset boards with tight move budgets and larger tile goals. Plan several moves ahead.', 'Puzzles add no random tiles. Every challenge has a valid solution; undo lets you rethink your last move.', 'Choose Classic for the familiar random-tile game: reach 2048, then keep going if you wish. Six puzzles retains the original easier road.', 'Classic, Six puzzles, and Master puzzles keep separate records.'],
  },
  'apex-circuit': {
    title: 'Apex Circuit', category: 'DRIVING / TIME TRIAL', description: 'Beat the deadline. Keep a clean line. Earn the championship.',
    module: '/solo/circuit-view.js', ruleTitle: 'Find your racing line.',
    scoreDigits: 2, scoreUnit: 's',
    recordPolicy: { direction: 'min', scopes: RACE_SCOPES, unit: 's', digits: 2, onlyWon: true },
    controls: [[['W', '↑'], 'Accelerate'], [['S', '↓'], 'Brake / reverse'], [['A', 'D', '←', '→'], 'Steer'], [['Space'], 'Handbrake'], [['Q'], 'Reset car (+3s)']],
    touch: 'Hold the pedal and steering buttons below the track. The handbrake helps rotate the car through a tight corner.',
    rules: ['Complete three laps. Follow the direction arrows and pass each checkpoint in order.', 'Veteran starts by default. Beat the track deadline and stay within the off-track and reset allowances.', 'Brake before a corner, then accelerate out. Grass slows you down. Use Q or Reset car to recover; each reset adds three seconds.', 'Select Meadow Loop, Harbor Ring, or Rain Pass. Slick zones and grip change the handling.', 'Standard practice has no qualifying deadline. Nightmare asks for a faster, cleaner racing line.', 'Championship links all three races. Only completed qualifying runs set records, separately for each track, championship, and difficulty.'],
  },
  'night-drive': {
    recordPolicy: { scopes: tierScopes(['default', 'tour']), variants: {
      'veteran-tour': { onlyWon: true },
      'nightmare-tour': { onlyWon: true },
    } },
    title: 'Night Drive', category: 'DRIVING / HIGHWAY', description: 'Five districts. A ticking clock. Leave yourself an escape lane.',
    module: '/solo/highway-view.js', ruleTitle: 'Keep a lane open.',
    controls: [[['A', 'D', '←', '→'], 'Steer'], [['W', '↑'], 'Accelerate'], [['S', '↓'], 'Brake'], [['Space'], 'Boost']],
    touch: 'Hold the steering, pedal, and boost buttons below the road. The car cruises automatically when you release the pedals.',
    rules: ['Weave through traffic to build your distance and score.', 'Veteran starts by default: reach each district checkpoint before its clock runs out. Slow cruising will miss the delivery.', 'Close, clean passes earn a near-miss bonus. Hitting traffic damages your car; three impacts end the run.', 'Boost uses charge. Manage it for fast clear stretches, and brake early to leave a safe escape lane.', 'Tour crosses five districts over 4.5 km. Watch construction warnings and merging traffic. Harder checkpoints do not heal your car automatically.', 'Standard practice keeps the original untimed drive; Nightmare tightens the delivery windows. Tour challenge records require a full finish.'],
  },
  'prism-shift': {
    title: 'Prism Shift', category: 'FALLING BLOCKS / TIME & SCORE', description: 'Faster drops. Tighter placements. Keep your rhythm under pressure.',
    module: '/solo/prism-view.js', ruleTitle: 'Build with a plan.',
    recordPolicy: { scopes: PRISM_SCOPES, variants: Object.fromEntries(PRISM_SCOPES.map(scope => [scope,
      scope.endsWith('marathon') ? { direction: 'max' } : { direction: 'min', digits: 2, unit: 's', onlyWon: true },
    ])) },
    controls: [[['←', '→'], 'Move the piece'], [['↓'], 'Soft drop'], [['↑', 'X'], 'Rotate clockwise'], [['Z'], 'Rotate counterclockwise'], [['Space'], 'Hard drop'], [['C', 'Shift'], 'Hold the piece']],
    touch: 'Use the buttons below the board. Hold a direction to move repeatedly. Choose Marathon, the 40-line Sprint, or Excavation; its road grows with the difficulty.',
    rules: ['Fill a horizontal row to clear it. Use the ghost to plan where a piece will land.', 'Each bag contains all seven piece types. Hold saves one piece; you can swap once per placement.', 'Rotations can kick away from walls. The lock delay gives you a moment to finish a placement.', 'Veteran starts at a faster tempo with less time to adjust a landed piece. Standard retains the original pace; Nightmare pushes speed and precision further.', 'Marathon saves your best score. Harder 40-line Sprints must finish within their time budgets to qualify.', 'Excavation uses handcrafted garbage layouts, piece budgets, and fixed queues. Clear each stage to advance; completed times stay separate by difficulty.'],
  },
  'rift-survivor': {
    recordPolicy: { scopes: ['default', 'veteran', 'veteran-v2', 'nightmare'] },
    title: 'Rift Survivor', category: 'SURVIVAL ARENA / FOUR SECTORS', description: 'Find your opening. Shape your build. Close the rift.',
    module: '/solo/rift-view.js', ruleTitle: 'Learn the patterns.',
    controls: [[['W', 'A', 'S', 'D'], 'Move'], [['Mouse'], 'Aim'], [['Click', 'J'], 'Fire'], [['Space', 'Shift'], 'Dash']],
    touch: 'Use the left pad to move and the right pad to aim and fire. Dash at the right moment to cross a dangerous gap.',
    rules: ['Clear twenty waves across four sectors. Chasers, strafers, casters, charging brutes, and affixed elites demand different movement.', 'Veteran starts with mixed threats and stronger pursuit. Change direction after an enemy locks its aim; use cover and keep room to dash.', 'Sustained fire heats your weapon. Release it to cool down; dash uses stamina.', 'Choose an upgrade after each cleared wave. Build around ricochet, chains, frost, dash attacks, and recovery. Overcharge a wave for extra risk and rewards.', 'Four guardians protect waves five, ten, fifteen, and twenty. Read their warning patterns and floor hazards.', 'Expedition (Standard) and Nightmare remain selectable. New Veteran records are separate from the earlier, gentler Veteran mode.'],
  },
};

function validRecord(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/** Each game qualifies its own records: finished races, survival deaths, or growing scores. */
export function recordDetails(gameId, update) {
  const base = GAME_INFO[gameId]?.recordPolicy || {};
  const scopes = base.scopes || ['default'];
  const scope = scopes.includes(update.recordKey) ? update.recordKey : scopes[0];
  const policy = { ...base, ...base.variants?.[scope] };
  const knownScope = update.recordKey === undefined || scopes.includes(update.recordKey);
  return {
    scope,
    direction: policy.direction === 'min' ? 'min' : 'max',
    candidate: !knownScope ? null : policy.onlyCrashed ? (update.phase === 'lost' && update.result === 'crashed' ? update.record : null) : policy.onlyWon ? (update.phase === 'won' ? update.record : null) : (update.record ?? update.score),
    unit: policy.unit || '', digits: policy.digits,
  };
}

function recordNote(gameId, scope, direction) {
  const tier = scope.startsWith('nightmare') ? 'Nightmare' : scope.startsWith('veteran') ? 'Veteran' : 'Standard';
  if (gameId === 'paris-pedal') {
    if (scope.endsWith('-survival-v1')) return `${tier} longest survival counts active riding time until the third impact. Pauses do not count; other difficulties and points records stay separate.`;
    return scope.endsWith('-delivery') ? `${tier} Delivery records require all five districts and stay separate from Survival.` : `${tier} historical Rush points stay separate from Survival and Delivery.`;
  }
  if (gameId === 'minesweeper') return `Best ${scope} time stays in this browser, on this host.`;
  if (gameId === 'apex-circuit') return `${tier} completed times are saved separately for each track and championship.`;
  if (gameId === 'night-drive' && scope.endsWith('-tour')) return `${tier} Tour records require a full five-district finish and stay separate from Endless.`;
  if (gameId === 'prism-shift' && direction === 'min') return `${tier} completed ${scope.endsWith('sprint') ? '40-line Sprint' : 'Excavation'} time stays in this browser, on this host.`;
  if (['ember-delve', 'deckbound', 'rift-survivor', 'night-drive', 'prism-shift'].includes(gameId)) return `${tier} best scores are saved separately from other difficulties and modes.`;
  return 'Best scores are saved separately for each mode in this browser, on this host.';
}

export function formatValue(value, digits, unit = '') {
  if (unit === 'duration-ms') {
    const hundredths = Math.floor(value / 10);
    return `${Math.floor(hundredths / 6000)}:${String(Math.floor(hundredths / 100) % 60).padStart(2, '0')}.${String(hundredths % 100).padStart(2, '0')}`;
  }
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
    if ($('solo-app').dataset.phase !== phase) $('solo-app').dataset.phase = phase;
    setText($('solo-status-label'), { playing: 'IN PLAY', paused: 'PAUSED', won: 'YOU DID IT', lost: 'RUN COMPLETE' }[phase]);
    const { scope, direction, candidate, unit, digits } = recordDetails(gameId, update);
    const scoreUnit = update.scoreUnit ?? (gameId === 'paris-pedal' && unit === 'duration-ms' ? unit : info.scoreUnit);
    setText($('solo-score'), formatValue(validRecord(update.score) ? update.score : 0, update.scoreDigits ?? info.scoreDigits, scoreUnit));
    setText($('solo-score-label'), update.scoreLabel || 'SCORE');
    setText($('solo-record-label'), update.recordLabel || (gameId === 'minesweeper' ? 'BEST TIME' : 'BEST SCORE'));
    setText($('solo-detail'), update.detail || (phase === 'paused' ? 'Take your time. Resume when you are ready.' : 'A new personal best is only a game away.'));
    const best = validRecord(candidate) ? records.update(gameId, candidate, { scope, direction }) : records.read(gameId, scope);
    setText($('solo-record'), best === null ? '—' : formatValue(best, digits, unit));
    setText($('solo-record-scope'), recordNote(gameId, scope, direction));
    setDisabled(pause, finished);
    setAttribute(pause, 'aria-pressed', String(phase === 'paused'));
    setText(pause.querySelector('span'), phase === 'paused' ? 'Resume' : 'Pause');
    setHTML(pause.querySelector('b'), phase === 'paused' ? '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="m4 2 10 6-10 6z"/></svg>' : '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M3 2h3v12H3zm7 0h3v12h-3z"/></svg>');
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
