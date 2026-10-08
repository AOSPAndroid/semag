import { mountKeyboardLayoutPicker, subscribeKeyboardLayout, displayKey } from '../keyboard-layout.js';
import { soloSessionShortcut } from './input-shortcuts.js';
import { setText, setAttribute, setDisabled, setHTML } from '../hub/dom.js';
const SOLO_COVERS = {
  'shadow-lantern': 'shadow',
  'skyline-hook': 'skyline', 'starfall-squadron': 'starfall', 'ironwood-tactics': 'ironwood',
  'paris-pedal': 'paris', 'ember-delve': 'ember', deckbound: 'deckbound',
  snake: 'snake', minesweeper: 'minesweeper', '2048': '2048',
  'apex-circuit': 'circuit', 'night-drive': 'highway', 'prism-shift': 'prism', 'rift-survivor': 'rift',
};
const ACTION_SCOPES = ['default', 'veteran', 'nightmare', 'veteran-v3', 'nightmare-v3'];
const tierScopes = scopes => [...scopes, ...['veteran', 'nightmare'].flatMap(tier => scopes.flatMap(scope => [`${tier}-${scope}`, `${tier}-${scope}-v3`]))];
const RACE_SCOPES = tierScopes(['three-laps', 'harbor-ring-three-laps', 'rain-pass-three-laps', 'championship']);
const PRISM_SCOPES = tierScopes(['marathon', 'sprint', 'dig']);
const PARIS_SURVIVAL_SCOPES = [...['standard', 'veteran', 'nightmare'].map(tier => `${tier}-survival-v1`), 'veteran-survival-v3', 'nightmare-survival-v3'];
const PARIS_DELIVERY_SCOPES = ['standard-delivery', 'veteran-delivery', 'nightmare-delivery', 'veteran-delivery-v3', 'nightmare-delivery-v3'];
const PARIS_RUSH_SCOPES = ['standard-rush', 'veteran-rush', 'nightmare-rush', 'veteran-rush-v3', 'nightmare-rush-v3'];
const baseScope = scope => scope.replace(/-v\d+$/, '');
const GAME_INFO = {
  'shadow-lantern': {
    title: 'Shadow Lantern', category: 'NINJA / NINE STEALTH HEISTS', description: 'Watch the patrol. Take the seal. Leave no trail.',
    module: '/solo/shadow-view.js', ruleTitle: 'Leave the lanterns undisturbed.',
    recordPolicy: { scopes: ['shadow-v1-standard', 'shadow-v1-veteran', 'shadow-v1-nightmare'], onlyWon: true },
    controls: [[['W', 'A', 'S', 'D', '↑', '←', '↓', '→'], 'Move'], [['Shift'], 'Sneak'], [['E'], 'Hold to interact / rear takedown'], [['Space'], 'Smoke'], [['Mouse'], 'Aim distraction'], [['Q'], 'Throw distraction kunai']],
    touch: 'Use the direction buttons and Sneak, Interact, Smoke, and Distract controls. Face your target before throwing.',
    rules: ['Collect the guarded seals and return to extraction in nine authored missions across three districts.', 'Watch patrol routes, facing and suspicion. Solid cover blocks sight, and shadow and sneaking help you stay unnoticed.', 'Hold Interact beside a seal or behind an unaware guard. Rear takedowns require careful approach and timing.', 'Use smoke to break sight or a distraction kunai to draw a patrol away. Health, tools and alarm pressure carry through the campaign.', 'Mission clocks count active play and give you time to plan a route. Pauses and decisions freeze the clock; waiting forever cannot finish a heist.', 'Veteran starts by default. Complete all nine missions to save a campaign score, separately for Standard, Veteran and Nightmare.'],
  },
  'skyline-hook': {
    title: 'Skyline Hook', category: 'PRECISION PLATFORMER / GRAPPLING', description: 'Build momentum. Catch an anchor. Earn the next rooftop.',
    module: '/solo/skyline-view.js', ruleTitle: 'Turn a swing into a clean landing.',
    scoreDigits: 2, scoreUnit: 's',
    recordPolicy: { scopes: ['standard-campaign-v1', 'veteran-campaign-v1', 'nightmare-campaign-v1'], direction: 'min', unit: 's', digits: 2, onlyWon: true },
    controls: [[['A', 'D', '←', '→'], 'Move'], [['Space'], 'Jump / hold for height'], [['Mouse'], 'Aim the hook'], [['Click', 'E'], 'Hold hook / release'], [['W', 'S', '↑', '↓'], 'Reel rope']],
    touch: 'Use the direction and jump buttons. Tap a visible anchor to grapple; release and reel the rope with the action buttons.',
    rules: ['Cross twelve authored rooftop stages in three distinct districts. Collect both relay chips and reach the exit to continue the same campaign.', 'Accelerate into a jump, hold the hook on a visible anchor, then release to carry your momentum onto the next platform. Holding jump changes its height.', 'A short jump buffer and coyote window help precise inputs. Grappling does not make you immune to spikes, laser gates, or falls.', 'Veteran starts by default. Lives carry through the campaign, so learn the hazard rhythm and choose controlled landings.', 'Pause freezes the stage and campaign clock. A new game resets the campaign and its resources.', 'Complete all twelve rooftops to save your fastest campaign time. Standard, Veteran, and Nightmare records stay separate.'],
  },
  'starfall-squadron': {
    title: 'Starfall Squadron', category: 'BULLET HELL / SIX GUARDIANS', description: 'Read the pattern. Find the gap. Bring your squadron home.',
    module: '/solo/starfall-view.js', ruleTitle: 'Stay calm inside the pattern.',
    recordPolicy: { scopes: ['standard-campaign-v1', 'veteran-campaign-v1', 'nightmare-campaign-v1'], onlyWon: true, completionResult: 'campaign' },
    controls: [[['W', 'A', 'S', 'D', '↑', '←', '↓', '→'], 'Move'], [['Shift'], 'Focus / precision movement'], [['Click', 'C'], 'Fire'], [['Space', 'E'], 'Bomb']],
    touch: 'Drag to move your ship. Hold Focus for fine movements, and use Bomb when a pattern leaves little room. Auto-fire starts enabled.',
    rules: ['Fight through six stages in three regions. Each stage ends with a guardian; the final guardian changes its attacks across three phases.', 'Your visible pilot core is the collision target. Focus slows your movement for narrow gaps and concentrates your fire.', 'Near passes build your graze score, but direct contact costs hull. Watch the warnings and leave room to change direction.', 'Bombs clear dangerous shots and are limited across the campaign. Choose upgrades between stages to shape your ship.', 'Veteran starts by default. Standard and Nightmare have separate campaign records; changing difficulty begins a fresh run.', 'Only a completed six-stage campaign saves a score. Pauses and upgrade choices freeze combat.'],
  },
  'ironwood-tactics': {
    title: 'Ironwood Tactics', category: 'TURN-BASED SQUAD ROGUELIKE', description: 'Read their intent. Push the line. Protect the beacon.',
    module: '/solo/ironwood-view.js', ruleTitle: 'Change the board before they strike.',
    recordPolicy: { scopes: ['ironwood-v1-standard', 'ironwood-v1-veteran', 'ironwood-v1-nightmare'], onlyWon: true },
    controls: [[['Click', 'Tap'], 'Select heroes, actions and tiles'], [['1', '2', '3'], 'Select a hero'], [['W', 'A', 'S', 'D', '↑', '←', '↓', '→'], 'Move the grid cursor'], [['Enter'], 'Choose a tile'], [['F'], 'Choose attack'], [['C'], 'Choose movement'], [['E'], 'End squad turn']],
    touch: 'Tap a hero, choose an action, then tap a highlighted tile. Review the enemy intent and resolution order before ending the turn.',
    rules: ['Lead a Warden, Ranger, and Weaver through nine missions in three biomes, with a guardian at the end of each biome.', 'Each hero has movement and one action per turn. Use pushes, pulls, cover, and firing lines to change the board. Bosses are rooted: displacement deals its collision bonus but cannot move them or cancel their intent.', 'Enemy intent marks the exact attack tiles and the order they resolve. Reposition your squad and protect the beacon before ending your turn. Royal lines can also hit the beacon, and living bosses drain one, two, or three beacon health each turn by biome.', 'Health and limited bandages carry between battles. Choose a unique permanent upgrade or a constrained recovery after each victory.', 'A mission deadline brings escalating storm damage. Waiting indefinitely cannot clear an expedition.', 'Veteran starts by default. Finish all nine missions to save expedition renown; practice and Nightmare records stay separate.'],
  },
  'paris-pedal': {
    title: 'Paris Pedal', category: 'DRIVING / PARIS E-BIKE SURVIVAL', description: 'The longer you last, the faster Paris flies past.',
    module: '/solo/paris-view.js', ruleTitle: 'Last one more second.',
    recordPolicy: { scopes: [...PARIS_SURVIVAL_SCOPES, ...PARIS_DELIVERY_SCOPES, ...PARIS_RUSH_SCOPES], variants: {
      ...Object.fromEntries(PARIS_SURVIVAL_SCOPES.map(scope => [scope, { onlyCrashed: true, unit: 'duration-ms' }])),
      ...Object.fromEntries(PARIS_DELIVERY_SCOPES.map(scope => [scope, { onlyWon: true }])),
    } },
    controls: [[['A', 'D', '←', '→'], 'Steer'], [['W', '↑'], 'Pedal'], [['S', '↓'], 'Brake'], [['Space'], 'Motor assist'], [['E'], 'Ring bell']],
    touch: 'Your e-bike moves automatically. Hold the steering and brake buttons to find gaps; use pedal and assist for bursts. Tap the bell to warn cyclists.',
    rules: ['Survival starts by default. Stay alive as long as possible while the streets cycle endlessly through five Paris-inspired districts.', 'Your e-bike moves automatically and its pace keeps rising with time alive. Braking trims speed but cannot stop the ride.', 'Thread between cars. Buses signal before pulling out, cyclists warn before veering, and parked doors flash before opening.', 'Motor assist spends battery; braking recovers charge. The bell warns nearby cyclists, while buses and cars still need a clear escape route.', 'Three impacts end a Survival run. District changes never repair the rider. Pause time does not count toward your record.', 'Veteran starts faster and demands more precise gaps as you survive. Your longest completed time stays separate by difficulty and from earlier rules.', 'Five deliveries is an alternate route with checkpoint deadlines on Veteran and Nightmare. Its points records require all five districts and stay separate from Survival. Veteran and Nightmare Rush also use automatic pace and finite braking.'],
  },
  'ember-delve': {
    recordPolicy: { scopes: ACTION_SCOPES },
    title: 'Ember Delve', category: 'ACTION ROGUELIKE / THREE ACTS', description: 'Read the windup. Break the pursuit. Earn your descent.',
    module: '/solo/ember-view.js', ruleTitle: 'Keep the flame alive.',
    controls: [[['W','A','S','D'], 'Move'], [['Mouse'], 'Aim'], [['Click','C'], 'Sword'], [['Right click','E'], 'Ember bolt'], [['Space','Shift'], 'Dodge'], [['F'], 'Interact']],
    touch: 'Use the left pad to move, the right pad to aim, and the action buttons to attack, cast, dodge, or interact.',
    rules: ['Clear each chamber, then reach a glowing exit to choose a route.', 'Safe roads offer supplies and camps. Risky roads offer elite fights and richer rewards.', 'Choose relics to shape sword, spell, and dodge combinations. Health carries between rooms. Relic chambers are guarded, bosses bring support, and repeated healing shares a room allowance.', 'Veteran starts by default: enemies intercept, flank, and pressure your recovery. Watch their warnings and vary your movement. Attacking briefly slows you and delays stamina recovery, so commit after an opening.', 'Standard offers a gentler descent; Nightmare demands tighter resource management and dodges. Changing difficulty begins a fresh run.', 'Save the run seed to revisit the same dungeon at the same difficulty. A new run resets your build.'],
  },
  'deckbound': {
    recordPolicy: { scopes: ACTION_SCOPES },
    title: 'Deckbound', category: 'DECKBUILDING ROGUELIKE / THREE ACTS', description: 'Read the enemy. Build a deck. Survive the long road.',
    module: '/solo/deckbound-view.js', ruleTitle: 'Make every card count.',
    controls: [[['Click','Tap'], 'Play cards and choose routes'], [['1–9'], 'Play a hand card'], [['E'], 'End turn']],
    touch: 'Tap a card to play it. Choose an enemy target when several foes are present. Route, reward, camp, and shop choices use buttons.',
    rules: ['Complete eighteen encounters across three acts. Enemy intent shows the next attack and any ally shields.', 'Spend energy on damage, block, and status effects; unused block expires at your next turn.', 'Shape your deck with card rewards, upgrades, removal, shops, and relics.', 'Elite roads offer stronger rewards and tougher battles. Rest stops can heal or upgrade a card. Veteran requires three road battles per act; Nightmare requires four. Card healing has a visible battle allowance, and prolonged fights grow more dangerous.', 'Veteran is the default. Standard, Veteran, and Nightmare have separate records; changing difficulty begins a fresh expedition.', 'Defeat all three bosses. Death ends the expedition; replay its seed or begin a fresh route.'],
  },
  snake: {
    recordPolicy: { scopes: ['default', 'gardens', 'gauntlet', 'gauntlet-v3'] },
    title: 'Snake', category: 'SOLO ARCADE / SPEED & ROUTES', description: 'Six tight gardens. Longer trails. A 168-fruit Gauntlet.',
    module: '/solo/snake-view.js', ruleTitle: 'Keep it growing.',
    controls: [[['↑', '←', '↓', '→'], 'Steer'], [['W', 'A', 'S', 'D'], 'Also steer']],
    touch: 'Use the direction buttons below the board on a phone or tablet.',
    rules: ['Eat apples to grow your snake and build your score.', 'Plan your turns. Hitting a wall, hedge, or your own tail ends the run.', 'You cannot reverse straight into yourself. Keep some room to turn.', 'Gauntlet starts by default: six denser obstacle gardens with faster turns, longer starting trails, and 168 fruit to collect.', 'Reach each apple within its movement allowance. Circling forever spends that allowance, so choose a route around your moving tail.', 'Choose Classic for an endless practice run or Six gardens for the gentler road. The new Gauntlet keeps its own records.'],
  },
  minesweeper: {
    title: 'Minesweeper', category: 'SOLO PUZZLE / MASTER DEDUCTIONS', description: 'Ninety mines. Overlapping clues. Six active minutes.',
    module: '/solo/minesweeper-view.js', ruleTitle: 'Read between the mines.',
    recordPolicy: { direction: 'min', scopes: ['beginner', 'intermediate', 'expert', 'master-v3'], unit: 's', onlyWon: true },
    controls: [[['Click'], 'Reveal a tile'], [['Right click'], 'Place a flag'], [['↑', '←', '↓', '→'], 'Explore the board'], [['Enter'], 'Reveal'], [['F'], 'Flag']],
    touch: 'Switch Flag mode on to flag tiles with a tap. Pick Master, Expert, Intermediate, or Beginner for a fresh board.',
    rules: ['Numbers tell you how many mines touch a tile, including diagonals.', 'Reveal every safe tile to win. Flags help you keep track of suspected mines.', 'Master starts by default: a 24 × 16 field with 90 mines and six minutes of active play.', 'Master boards are verified solvable from their visible clues. Compare overlapping clues to deduce mines and safe cells; your first reveal and its neighbors are safe.', 'Pause stops the clock. Expert, Intermediate, and Beginner are practice alternatives; completed times stay separate.'],
  },
  '2048': {
    recordPolicy: { scopes: ['default', 'puzzles', 'master', 'master-v3'], variants: { 'master-v3': { onlyWon: true, completionResult: 'tour' } } },
    title: '2048', category: 'SOLO PUZZLE / CLASSIC & MASTER', description: 'Six exacting trials. Two rewinds. Reach 16,384.',
    module: '/solo/2048-view.js', ruleTitle: 'Leave room to grow.',
    controls: [[['↑', '←', '↓', '→'], 'Slide all tiles'], [['W', 'A', 'S', 'D'], 'Also slide']],
    touch: 'Swipe across the board to slide. Master gives you two one-step rewinds across the whole tour.',
    rules: ['Slide the board. Equal tiles merge into one tile with twice the value.', 'Master starts by default with six dense boards, exact move budgets, and targets reaching 16,384. Every trial has a verified solution.', 'No random tiles are added in puzzles. Plan ahead: Master allows only two rewinds and two retries across the entire tour, with no refill between trials.', 'Finish all six Master trials to set a record. If your retries are spent, begin a new tour.', 'Classic offers the familiar random-tile game; Six puzzles is the gentler practice road. Their records and historical Master scores stay separate.'],
  },
  'apex-circuit': {
    title: 'Apex Circuit', category: 'DRIVING / TIME TRIAL', description: 'Beat the deadline. Keep a clean line. Earn the championship.',
    module: '/solo/circuit-view.js', ruleTitle: 'Find your racing line.',
    scoreDigits: 2, scoreUnit: 's',
    recordPolicy: { direction: 'min', scopes: RACE_SCOPES, unit: 's', digits: 2, onlyWon: true },
    controls: [[['W', '↑'], 'Accelerate'], [['S', '↓'], 'Brake / reverse'], [['A', 'D', '←', '→'], 'Steer'], [['Space'], 'Handbrake'], [['Q'], 'Reset car (+3s)']],
    touch: 'Hold the pedal and steering buttons below the track. The handbrake helps rotate the car through a tight corner.',
    rules: ['Complete three laps. Follow the direction arrows and pass each checkpoint in order.', 'Veteran starts by default. Beat each progressively tighter lap target and the track deadline while staying within the off-track and reset allowances.', 'Brake before a corner, then accelerate out. Tyres lose grip if you keep full throttle through tight corners. Grass slows you down. Use Q or Reset car to recover; each reset adds three seconds.', 'Select Meadow Loop, Harbor Ring, or Rain Pass. Slick zones and grip change the handling.', 'Standard practice has no qualifying deadline. Nightmare asks for a faster, cleaner racing line.', 'Championship links all three races. Only completed qualifying runs set records, separately for each track, championship, and difficulty.'],
  },
  'night-drive': {
    recordPolicy: { scopes: [...tierScopes(['default', 'tour']), 'veteran-default-v4', 'nightmare-default-v4'], variants: {
      'veteran-tour': { onlyWon: true },
      'nightmare-tour': { onlyWon: true },
      'veteran-tour-v3': { onlyWon: true },
      'nightmare-tour-v3': { onlyWon: true },
    } },
    title: 'Night Drive', category: 'DRIVING / HIGHWAY', description: 'The clock pushes your pace. Keep an escape lane open.',
    module: '/solo/highway-view.js', ruleTitle: 'Keep a lane open.',
    controls: [[['A', 'D', '←', '→'], 'Steer'], [['W', '↑'], 'Accelerate'], [['S', '↓'], 'Brake'], [['Space'], 'Boost']],
    touch: 'Hold the steering, pedal, and boost buttons below the road. The car cruises automatically when you release the pedals.',
    rules: ['Weave through traffic to build your distance and score.', 'Veteran starts by default: Endless pace rises continuously with active driving time, so the longer you survive, the faster the road moves. Reach each district checkpoint before its clock runs out.', 'Close, clean passes earn a near-miss bonus. Hitting traffic damages your car; three impacts end the run. A car remains dangerous until its rear is fully clear.', 'Boost uses charge. Manage it for fast clear stretches. Endless braking gives you brief bursts to find an escape lane; release it to recharge. Holding a brake cannot stop the pace from rising.', 'Tour crosses five districts over 4.5 km. Watch construction warnings and merging traffic. Endless loops add denser traffic, stronger crosswind, and tighter checkpoint pace. Harder checkpoints do not heal your car automatically.', 'Pause and leaving the tab freeze the pace clock. A new run starts at the opening pace. Standard practice and Tour keep their existing handling; the accelerating Endless records stay separate from earlier scores.'],
  },
  'prism-shift': {
    title: 'Prism Shift', category: 'FALLING BLOCKS / TIME & SCORE', description: 'Faster drops. Tighter placements. Keep your rhythm under pressure.',
    module: '/solo/prism-view.js', ruleTitle: 'Build with a plan.',
    recordPolicy: { scopes: PRISM_SCOPES, variants: Object.fromEntries(PRISM_SCOPES.map(scope => [scope,
      baseScope(scope).endsWith('marathon') ? { direction: 'max' } : { direction: 'min', digits: 2, unit: 's', onlyWon: true },
    ])) },
    controls: [[['←', '→'], 'Move the piece'], [['↓'], 'Soft drop'], [['↑', 'X'], 'Rotate clockwise'], [['Z'], 'Rotate counterclockwise'], [['Space'], 'Hard drop'], [['C', 'Shift'], 'Hold the piece']],
    touch: 'Use the buttons below the board. Hold a direction to move repeatedly. Choose Marathon, the 40-line Sprint, or Excavation; its road grows with the difficulty.',
    rules: ['Fill a horizontal row to clear it. Use the ghost to plan where a piece will land.', 'Each bag contains all seven piece types. Hold saves one piece; you can swap once per placement.', 'Rotations can kick away from walls. The lock delay gives you a moment to finish a placement.', 'Veteran starts at a faster tempo with less time to adjust a landed piece. Standard retains the original pace; Nightmare pushes speed and precision further.', 'Marathon saves your best score. Veteran and Nightmare accelerate Marathon through both cleared lines and active time. Their 40-line Sprints must finish within 75 and 50 seconds respectively.', 'Excavation uses handcrafted garbage layouts, piece budgets, and fixed queues. Harder stages have exact piece budgets and shorter clocks. Clear each stage to advance; completed times stay separate by difficulty.'],
  },
  'rift-survivor': {
    recordPolicy: { scopes: ['default', 'veteran', 'veteran-v2', 'nightmare', 'veteran-v3', 'nightmare-v3', 'veteran-v4', 'nightmare-v4'] },
    title: 'Rift Survivor', category: 'SURVIVAL ARENA / FOUR SECTORS', description: 'Find your opening. Shape your build. Close the rift.',
    module: '/solo/rift-view.js', ruleTitle: 'Learn the patterns.',
    controls: [[['W', 'A', 'S', 'D'], 'Move'], [['Mouse'], 'Aim'], [['Click', 'C'], 'Fire'], [['Space', 'Shift'], 'Dash']],
    touch: 'Use the left pad to move and the right pad to aim and fire. Dash at the right moment to cross a dangerous gap.',
    rules: ['Clear twenty waves across four sectors. Chasers, strafers, casters, charging brutes, and affixed elites demand different movement.', 'Veteran starts with mixed threats and stronger pursuit. Enemy movement, new attacks, and attack frequency grow faster with active combat time, adding up to 25% threat pace after five minutes. Change direction after an enemy locks its aim; use cover and keep room to dash.', 'Sustained fire heats your weapon. Release it to cool down faster; dash uses stamina. Elites mark escape routes with visible warnings, so change direction and use cover. Warning durations remain readable as the threat pace rises.', 'Choose an upgrade after each cleared wave. Build around ricochet, chains, frost, dash attacks, and recovery. Upgrade menus and pauses freeze the pace clock; clearing a wave does not reset it. Overcharge a wave for extra risk and rewards.', 'Four guardians protect waves five, ten, fifteen, and twenty. Read their warning patterns and floor hazards. Guardians add a second phase; frost slows them but cannot pin them indefinitely.', 'Expedition (Standard) and Nightmare remain selectable. A new run resets threat pace. Accelerating Veteran and Nightmare records stay separate from earlier scores.'],
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
  const won = update.phase === 'won' && (!policy.completionResult || update.result === policy.completionResult);
  return {
    scope,
    direction: policy.direction === 'min' ? 'min' : 'max',
    candidate: !knownScope ? null : policy.onlyCrashed ? (update.phase === 'lost' && update.result === 'crashed' ? update.record : null) : policy.onlyWon ? (won ? update.record : null) : (update.record ?? update.score),
    unit: policy.unit || '', digits: policy.digits,
  };
}

function recordNote(gameId, scope, direction) {
  scope = baseScope(scope);
  if (gameId === 'shadow-lantern') {
    const tier = scope.endsWith('nightmare') ? 'Nightmare' : scope.endsWith('veteran') ? 'Veteran' : 'Standard';
    return `${tier} best score requires all nine heists. Pauses do not count; difficulties and other campaigns stay separate.`;
  }
  if (gameId === 'ironwood-tactics') {
    const tier = scope.endsWith('nightmare') ? 'Nightmare' : scope.endsWith('veteran') ? 'Veteran' : 'Standard';
    return `${tier} renown requires all nine missions. Difficulties and earlier records stay separate.`;
  }
  const tier = scope.startsWith('nightmare') ? 'Nightmare' : scope.startsWith('veteran') ? 'Veteran' : 'Standard';
  if (gameId === 'skyline-hook') return `${tier} fastest time requires all twelve rooftops in one campaign. Pauses do not count; difficulties stay separate.`;
  if (gameId === 'starfall-squadron') return `${tier} best score requires all six stages and guardians. Difficulties stay separate.`;
  if (gameId === 'paris-pedal') {
    if (scope.endsWith('-survival')) return `${tier} longest survival counts active riding time until the third impact. Pauses do not count; other difficulties and older challenge records stay separate.`;
    return scope.endsWith('-delivery') ? `${tier} Delivery records require all five districts and stay separate from Survival.` : `${tier} historical Rush points stay separate from Survival and Delivery.`;
  }
  if (gameId === 'minesweeper') return `Best ${scope} time stays in this browser, on this host.`;
  if (gameId === '2048' && scope === 'master') return 'The current Master record requires all six trials in one tour. Two rewinds and two retries cover the entire tour; practice and older records stay separate.';
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
  const start = $('solo-start');
  const restart = $('solo-restart');
  const pause = $('solo-pause');
  const sessionActions = document.querySelector('.solo-session-actions');
  const container = $('solo-game');
  const help = $('solo-how-to');
  let game = null;
  let starting = false;
  let destroyed = false;

  document.title = `${info.title} — Semag`;
  const keyboardPicker = mountKeyboardLayoutPicker(document.querySelector('[data-keyboard-layout-picker]'));
  const keyCaps = [];
  $('solo-app').dataset.game = gameId;
  $('solo-title').textContent = info.title;
  $('solo-category').textContent = info.category;
  $('solo-description').textContent = info.description;
  $('solo-preview').src = `/hub/${SOLO_COVERS[gameId]}-cover.svg`;
  $('solo-rules-title').textContent = info.ruleTitle;
  $('solo-touch-help').textContent = info.touch;
  container.setAttribute('aria-label', `${info.title} game area`);
  Object.defineProperty(window, 'firesideSolo', { configurable: true, value: Object.freeze({ gameId, getState: () => game?.getState() ?? null, getDisplayTiming: () => game?.getDisplayTiming?.() ?? null }) });
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
      cap.textContent = displayKey(key);
      keyCaps.push([cap, key]);
      keyGroup.append(cap);
    }
    const text = document.createElement('span');
    text.textContent = label;
    line.append(keyGroup, text);
    $('solo-controls-list').append(line);
  }
  const unsubscribeLayout = subscribeKeyboardLayout(() => {
    for (const [cap, key] of keyCaps) cap.textContent = displayKey(key);
  });
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
    if (!game || destroyed) return;
    const shortcut = soloSessionShortcut(event);
    if (shortcut === 'restart') { event.preventDefault(); newGame(); }
    else if (shortcut === 'pause') { event.preventDefault(); togglePause(); }
  }
  function helpKeydown(event) {
    // Keep native disclosure activation from also triggering a game action.
    if (['Space', 'Enter'].includes(event.code) && event.target instanceof Element && event.target.closest('summary')) event.stopPropagation();
  }
  function cleanup() {
    if (destroyed) return;
    destroyed = true;
    unsubscribeLayout(); keyboardPicker.destroy();
    start.removeEventListener('click', startGame);
    restart.removeEventListener('click', newGame);
    pause.removeEventListener('click', togglePause);
    help.removeEventListener('keydown', helpKeydown);
    window.removeEventListener('keydown', keydown);
    window.removeEventListener('blur', autoPause);
    window.removeEventListener('pagehide', pageHidden);
    document.removeEventListener('visibilitychange', visibilityChanged);
    game?.destroy();
    game = null;
  }

  async function startGame() {
    if (destroyed || starting || game) return;
    starting = true;
    start.disabled = true;
    setText(start.querySelector('span'), 'Starting…');
    $('solo-app').dataset.phase = 'loading';
    setText($('solo-status-label'), 'LOADING');
    container.setAttribute('aria-busy', 'true');
    try {
      const module = await import(info.module);
      if (destroyed) return;
      const focused = document.activeElement;
      const focusPlayArea = focused === document.body || container.contains(focused);
      container.replaceChildren();
      game = module.mount(container, { onUpdate });
      if (!game || typeof game.getState !== 'function' || typeof game.restart !== 'function' || typeof game.togglePause !== 'function' || typeof game.destroy !== 'function') throw new Error('Invalid solo game interface');
      container.tabIndex = 0;
      restart.disabled = false;
      sessionActions.hidden = false;
      // Loading can finish after the player has left this tab or window.
      if (document.hidden || !document.hasFocus()) autoPause();
      else if (focusPlayArea) focusGame();
      else if (focused?.isConnected) focused.focus({ preventScroll: true });
    } catch (error) {
      cleanup();
      $('solo-error').textContent = 'This game could not load. Refresh the page to try again, or choose another game from the shelf.';
      $('solo-error').hidden = false;
      $('solo-app').dataset.phase = 'unavailable';
      $('solo-status-label').textContent = 'UNAVAILABLE';
      $('solo-detail').textContent = 'Your best scores are saved for your next visit.';
      restart.disabled = true;
      pause.disabled = true;
      console.error('Solo game failed to load', error);
    } finally {
      container.removeAttribute('aria-busy');
    }
  }

  start.addEventListener('click', startGame);
  restart.addEventListener('click', newGame);
  pause.addEventListener('click', togglePause);
  help.addEventListener('keydown', helpKeydown);
  window.addEventListener('keydown', keydown);
  window.addEventListener('blur', autoPause);
  window.addEventListener('pagehide', pageHidden);
  document.addEventListener('visibilitychange', visibilityChanged);
}

if (typeof document !== 'undefined') startSolo();
