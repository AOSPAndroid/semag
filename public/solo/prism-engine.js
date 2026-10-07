/** Prism Shift: deterministic falling blocks, with SRS kicks and bounded lock resets. */
export const WIDTH = 10;
export const VISIBLE_HEIGHT = 20;
export const HIDDEN_ROWS = 4;
export const HEIGHT = VISIBLE_HEIGHT + HIDDEN_ROWS;
export const LOCK_DELAY = 0.5;
export const MAX_LOCK_RESETS = 15;
export const SOFT_DROP_SECONDS = 0.035;
export const SPRINT_LINES = 40;
export const TYPES = Object.freeze(['I', 'J', 'L', 'O', 'S', 'T', 'Z']);
export const DEFAULT_PROFILE = 'veteran';
export const PROFILES = Object.freeze(Object.fromEntries([
  { id: 'standard', name: 'Standard', startLevel: 1, linesPerLevel: 10, lockDelay: .5, minLockDelay: .5, lockResets: 15, previews: 5, sprintSeconds: null, paceSeconds: null, digLevel: 1, digLevelEvery: 2, digMaxLevel: 4, description: 'Original pace · open-ended Sprint · Dig 8' },
  { id: 'veteran', name: 'Veteran', startLevel: 10, linesPerLevel: 6, lockDelay: .32, minLockDelay: .20, lockResets: 6, previews: 4, sprintSeconds: 75, paceSeconds: 30, digLevel: 9, digLevelEvery: 3, digMaxLevel: 12, description: 'Lv 10 · Marathon accelerates every 30s / 6 lines · 75s Sprint · Dig 10' },
  { id: 'nightmare', name: 'Nightmare', startLevel: 13, linesPerLevel: 4, lockDelay: .24, minLockDelay: .16, lockResets: 4, previews: 3, sprintSeconds: 50, paceSeconds: 20, digLevel: 11, digLevelEvery: 2, digMaxLevel: 15, description: 'Lv 13 · Marathon accelerates every 20s / 4 lines · 50s Sprint · Dig 12' },
].map(profile => [profile.id, Object.freeze(profile)])));
export const getProfile = state => PROFILES[state.profile] || PROFILES.standard;
export const recordScope = state => state.profile === 'standard' ? state.mode : `${state.profile}-${state.mode}-v3`;
export function lockDelayFor(state) {
  const profile = getProfile(state);
  return state.mode === 'marathon' ? Math.max(profile.minLockDelay, profile.lockDelay - Math.max(0, state.level - profile.startLevel) * .01) : profile.lockDelay;
}
export function lockResetLimit(state) {
  const profile = getProfile(state);
  return state.mode === 'marathon' && profile.paceSeconds ? Math.max(2, profile.lockResets - Math.floor(Math.max(0, state.level - profile.startLevel) / 3)) : profile.lockResets;
}
function paceLevel(state) {
  const profile = getProfile(state), lines = profile.startLevel + Math.floor(state.lines / profile.linesPerLevel);
  if (state.mode !== 'marathon' || !profile.paceSeconds) return lines;
  return Math.min(30, Math.max(lines, profile.startLevel + Math.floor((state.elapsed + EPSILON) / profile.paceSeconds)));
}
export function timeRemaining(state) {
  return state.timeLimit == null ? null : Math.max(0, state.timeLimit - (state.elapsed - (state.mode === 'dig' ? state.dig.stageStart : 0)));
}

const SPAWN_SHAPES = {
  I: [
    [0, 1],
    [1, 1],
    [2, 1],
    [3, 1],
  ],
  J: [
    [0, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ],
  L: [
    [2, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ],
  O: [
    [1, 0],
    [2, 0],
    [1, 1],
    [2, 1],
  ],
  S: [
    [1, 0],
    [2, 0],
    [0, 1],
    [1, 1],
  ],
  T: [
    [1, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ],
  Z: [
    [0, 0],
    [1, 0],
    [1, 1],
    [2, 1],
  ],
};
export const SHAPES = Object.freeze(
  Object.fromEntries(
    TYPES.map((type) => {
      const rotations = [SPAWN_SHAPES[type].map(([x, y]) => ({ x, y }))];
      for (let index = 1; index < 4; index += 1) {
        const size = type === 'I' || type === 'O' ? 4 : 3;
        rotations.push(
          type === 'O'
            ? rotations[0].map((cell) => ({ ...cell }))
            : rotations[index - 1].map(({ x, y }) => ({ x: size - 1 - y, y: x })),
        );
      }
      return [type, Object.freeze(rotations.map((rotation) => Object.freeze(rotation.map(Object.freeze))))];
    }),
  ),
);

/** Fixed excavation puzzles: each layer has a shaped entrance, rather than random single-hole garbage. */
const DIG_DEFINITIONS = [
  {
    id: 'open-shaft',
    title: 'Open shaft',
    brief: 'A straight descent. Turn the long piece before committing.',
    budget: 4,
    queue: ['I', 'J', 'L', 'O', 'T', 'S', 'Z'],
    layers: [['I', 1, 2]],
  },
  {
    id: 'edge-well',
    title: 'Edge well',
    brief: 'The left wall is your guide. Reserve the piece that does not fit.',
    budget: 4,
    queue: ['T', 'I', 'L', 'O', 'S', 'Z', 'J'],
    layers: [['I', 1, -2]],
  },
  {
    id: 'split-shafts',
    title: 'Split shafts',
    brief: 'Two wells switch sides. Save space in hold for the detour.',
    budget: 5,
    queue: ['I', 'O', 'I', 'T', 'J', 'S', 'Z'],
    layers: [
      ['I', 1, 0],
      ['I', 1, 5],
    ],
  },
  {
    id: 'square-chambers',
    title: 'Square chambers',
    brief: 'Clear the upper chamber to uncover the second one.',
    budget: 5,
    queue: ['O', 'L', 'O', 'S', 'J', 'T', 'Z'],
    layers: [
      ['O', 0, 5],
      ['O', 0, 0],
    ],
  },
  {
    id: 'reverse-crowns',
    title: 'Reverse crowns',
    brief: 'Wide openings narrow below. Turn the crowns upside down.',
    budget: 6,
    queue: ['T', 'Z', 'T', 'T', 'I', 'O', 'J'],
    layers: [
      ['T', 2, 2],
      ['T', 2, 5],
      ['T', 2, 0],
    ],
  },
  {
    id: 'sawtooth',
    title: 'Sawtooth',
    brief: 'Mirror-shaped entrances reward deliberate rotation and reserve timing.',
    budget: 6,
    queue: ['L', 'S', 'J', 'L', 'O', 'I', 'T'],
    layers: [
      ['L', 3, 1],
      ['J', 1, 5],
      ['L', 3, 3],
    ],
  },
  {
    id: 'four-way',
    title: 'Four-way junction',
    brief: 'Four different layers. Preview every piece before dropping.',
    budget: 7,
    queue: ['L', 'T', 'S', 'O', 'I', 'J', 'Z'],
    layers: [
      ['L', 3, 0],
      ['T', 2, 5],
      ['O', 0, 1],
      ['I', 1, 5],
    ],
  },
  {
    id: 'final-descent',
    title: 'Final descent',
    brief: 'Fourteen rows guard the exit. Plan the whole route and keep your reserve free.',
    budget: 8,
    queue: ['J', 'Z', 'L', 'T', 'O', 'I', 'S'],
    layers: [
      ['J', 1, 2],
      ['L', 3, 6],
      ['T', 2, 1],
      ['O', 0, 6],
      ['I', 1, -2],
    ],
  },
];
function buildDigStage(definition) {
  const groups = (definition.groups || definition.layers.map(layer => [layer])).map(group => group.map(([type, rotation, x]) => {
    const cells = SHAPES[type][rotation], minY = Math.min(...cells.map(c => c.y)), maxY = Math.max(...cells.map(c => c.y));
    return { type, rotation, x, minY, height: maxY - minY + 1 };
  }));
  const layers = groups.map(group => ({ group, height: Math.max(...group.map(piece => piece.height)) }));
  const rows = layers.reduce((sum, layer) => sum + layer.height, 0),
    board = Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(null));
  let y = HEIGHT - rows;
  const placements = [];
  for (const layer of layers) {
    for (let row = y; row < y + layer.height; row += 1) board[row].fill('G');
    for (const piece of layer.group) {
      const placement = { type: piece.type, rotation: piece.rotation, x: piece.x, y: y - piece.minY };
      for (const cell of pieceCells(placement)) {
        if (cell.x < 0 || cell.x >= WIDTH || board[cell.y][cell.x] === null) throw new Error(`Invalid Dig chamber: ${definition.id}`);
        board[cell.y][cell.x] = null;
      }
      placements.push(Object.freeze(placement));
    }
    y += layer.height;
  }
  return Object.freeze({
    ...definition,
    rows,
    placements: Object.freeze(placements),
    layers: Object.freeze((definition.layers || definition.groups.flat()).map(layer => Object.freeze([...layer]))),
    groups: Object.freeze(groups.map(group => Object.freeze(group.map(piece => Object.freeze(piece))))),
    board: Object.freeze(board.map((row) => Object.freeze(row))),
    queue: Object.freeze(definition.queue),
  });
}
export const DIG_STAGES = Object.freeze(DIG_DEFINITIONS.map(buildDigStage));
export const DIG_STAGE_COUNT = DIG_STAGES.length;
// Paired/triple chambers must be filled together. Unlike a single-shaped well,
// one correct drop often clears nothing, so reserve and queue planning matter.
const CHALLENGE_DIG = [
  ['twin-vaults', 'Twin vaults', [[[ 'O', 0, 0], ['O', 0, 6]], [['I', 1, 2]]], 'Fill both square chambers, then turn into the central shaft.'],
  ['forked-crowns', 'Forked crowns', [[['T', 2, 0], ['T', 2, 6]], [['J', 1, 2], ['L', 3, 6]]], 'Two crowns share a roof. The lower hooks face opposite walls.'],
  ['crossing-shafts', 'Crossing shafts', [[['O', 0, 5], ['I', 1, -2]], [['O', 0, 0], ['I', 1, 5]]], 'Long and short chambers trade sides. Read what survives each clear.'],
  ['crown-triplets', 'Crown triplets', [[['T', 2, 0], ['T', 2, 3], ['T', 2, 6]], [['L', 3, 0], ['J', 1, 6]]], 'Three crowns must fit before the roof falls. Leave your reserve free.'],
  ['long-room', 'The long room', [[['I', 0, 0], ['I', 0, 6]], [['T', 2, 0], ['T', 2, 6]], [['I', 1, 2]]], 'Wide bridges give way to narrow wells. Plan the final orientation.'],
  ['staggered-armory', 'Staggered armory', [[['J', 2, 0], ['L', 2, 6]], [['O', 0, 0], ['O', 0, 6]], [['I', 1, 2]]], 'Turn the hooks upside down, match the squares, then descend.'],
  ['double-helix', 'Double helix', [[['L', 3, 0], ['J', 1, 6]], [['T', 2, 1], ['T', 2, 5]], [['O', 0, 0], ['O', 0, 6]], [['I', 1, 2]]], 'Seven placements, changing entrances. A spare drop costs space.'],
  ['five-turn-gate', 'Five-turn gate', [[['O', 0, 5], ['I', 1, -2]], [['T', 2, 1], ['T', 2, 4]], [['J', 1, -1], ['L', 3, 6]], [['I', 0, 2]]], 'Track the short chamber after a partial clear. End with a bridge.'],
  ['packed-vault', 'Packed vault', [[['T', 2, 0], ['T', 2, 3], ['T', 2, 6]], [['O', 0, 1], ['O', 0, 4], ['O', 0, 7]], [['O', 0, 5], ['I', 1, -2]], [['J', 1, 1], ['L', 3, 6]]], 'Ten exact placements. Repeated shapes hide a change in the queue.'],
  ['deep-junction', 'Deep junction', [[['J', 1, 0], ['L', 3, 4]], [['O', 0, 5], ['I', 1, 7]], [['T', 2, 0], ['T', 2, 3], ['T', 2, 6]], [['O', 0, 1], ['I', 1, 7]], [['L', 2, 0], ['J', 2, 6]]], 'A fifteen-row junction. Every chamber counts; every piece has a place.'],
  ['lost-plinths', 'Lost plinths', [[['L', 3, 0], ['J', 1, 4]], [['O', 0, 5], ['I', 1, 7]], [['T', 2, 0], ['T', 2, 3], ['T', 2, 6]], [['O', 0, 1], ['I', 1, 7]], [['J', 1, 1], ['L', 3, 6]], [['O', 0, 2], ['O', 0, 7]]], 'Eighteen rows. Prepare at spawn and keep the next chamber in mind.'],
  ['last-vault', 'The last vault', [[['T', 2, 0], ['T', 2, 3], ['T', 2, 6]], [['O', 0, 1], ['I', 1, -2]], [['O', 0, 0], ['I', 1, 3]], [['L', 3, 0], ['J', 1, 7]], [['J', 2, 2], ['L', 2, 5]], [['O', 0, -1], ['O', 0, 1], ['O', 0, 5]]], 'Fourteen pieces, no spare locks. Finish the whole route under pressure.'],
];
function challengeLadder(profile) {
  return Object.freeze(CHALLENGE_DIG.slice(0, profile === 'veteran' ? 10 : 12).map(([id, title, groups, brief], index) => {
    const required = groups.flat().map(piece => piece[0]);
    // One disclosed off-route piece requires hold, rather than an extra lock.
    const queue = [required[0], 'Z', ...required.slice(1), 'S', 'I', 'T'];
    return buildDigStage({ id: `${profile}-${id}`, title, groups, brief, queue,
      budget: required.length,
      seconds: profile === 'veteran' ? Math.ceil(9 + required.length * 2.2) : Math.ceil(5 + required.length * 1.5),
    });
  }));
}
export const DIG_LADDERS = Object.freeze({ standard: DIG_STAGES, veteran: challengeLadder('veteran'), nightmare: challengeLadder('nightmare') });
export const getDigStages = state => DIG_LADDERS[getProfile(state).id];
export const getDigStageCount = state => getDigStages(state).length;
export function getDigStage(state) {
  return getDigStages(state)[state.dig?.stageIndex ?? 0];
}
export function garbageRows(state) {
  return state.board.filter((row) => row.includes('G')).length;
}
function beginDigStage(state, index) {
  const stage = getDigStages(state)[index], profile = getProfile(state);
  state.phase = 'playing';
  state.pausedPhase = null;
  state.result = null;
  state.board = stage.board.map((row) => [...row]);
  state.hold = null;
  state.holdUsed = false;
  state.next = [...stage.queue];
  state.combo = -1;
  state.backToBack = false;
  state.level = Math.min(profile.digMaxLevel, profile.digLevel + Math.floor(index / profile.digLevelEvery));
  state.timeLimit = stage.seconds ?? null;
  state.lastClear = null;
  state.dig.stageIndex = index;
  state.dig.piecesUsed = 0;
  state.dig.budget = stage.budget;
  state.dig.stageStart = state.elapsed;
  state.dig.garbageRows = stage.rows;
  state.dig.remainingRows = stage.rows;
  spawnNext(state);
}
export function advanceDigStage(state) {
  if (state.mode !== 'dig' || state.phase !== 'stage-clear' || state.dig.stageIndex >= getDigStageCount(state) - 1)
    return false;
  beginDigStage(state, state.dig.stageIndex + 1);
  return true;
}

// SRS offsets are defined with positive y pointing up; convert on application.
const KICKS = {
  '0>1': [
    [0, 0],
    [-1, 0],
    [-1, 1],
    [0, -2],
    [-1, -2],
  ],
  '1>0': [
    [0, 0],
    [1, 0],
    [1, -1],
    [0, 2],
    [1, 2],
  ],
  '1>2': [
    [0, 0],
    [1, 0],
    [1, -1],
    [0, 2],
    [1, 2],
  ],
  '2>1': [
    [0, 0],
    [-1, 0],
    [-1, 1],
    [0, -2],
    [-1, -2],
  ],
  '2>3': [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, -2],
    [1, -2],
  ],
  '3>2': [
    [0, 0],
    [-1, 0],
    [-1, -1],
    [0, 2],
    [-1, 2],
  ],
  '3>0': [
    [0, 0],
    [-1, 0],
    [-1, -1],
    [0, 2],
    [-1, 2],
  ],
  '0>3': [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, -2],
    [1, -2],
  ],
};
const I_KICKS = {
  '0>1': [
    [0, 0],
    [-2, 0],
    [1, 0],
    [-2, -1],
    [1, 2],
  ],
  '1>0': [
    [0, 0],
    [2, 0],
    [-1, 0],
    [2, 1],
    [-1, -2],
  ],
  '1>2': [
    [0, 0],
    [-1, 0],
    [2, 0],
    [-1, 2],
    [2, -1],
  ],
  '2>1': [
    [0, 0],
    [1, 0],
    [-2, 0],
    [1, -2],
    [-2, 1],
  ],
  '2>3': [
    [0, 0],
    [2, 0],
    [-1, 0],
    [2, 1],
    [-1, -2],
  ],
  '3>2': [
    [0, 0],
    [-2, 0],
    [1, 0],
    [-2, -1],
    [1, 2],
  ],
  '3>0': [
    [0, 0],
    [1, 0],
    [-2, 0],
    [1, -2],
    [-2, 1],
  ],
  '0>3': [
    [0, 0],
    [-1, 0],
    [2, 0],
    [-1, 2],
    [2, -1],
  ],
};
const randomSources = new WeakMap();
const EPSILON = 1e-10;

function shuffledBag(state) {
  const bag = [...TYPES];
  const random = randomSources.get(state) || Math.random;
  for (let index = bag.length - 1; index > 0; index -= 1) {
    const value = random();
    if (!Number.isFinite(value) || value < 0 || value >= 1) {
      throw new RangeError('random must return a number from 0 up to, but not including, 1');
    }
    const target = Math.floor(value * (index + 1));
    [bag[index], bag[target]] = [bag[target], bag[index]];
  }
  return bag;
}
function refillQueue(state) {
  while (state.next.length < 6) state.next.push(...(state.mode === 'dig' ? TYPES : shuffledBag(state)));
}
export function pieceCells(piece) {
  if (
    !piece ||
    !Object.hasOwn(SHAPES, piece.type) ||
    !Number.isInteger(piece.rotation) ||
    piece.rotation < 0 ||
    piece.rotation > 3
  )
    return [];
  return SHAPES[piece.type][piece.rotation].map(({ x, y }) => ({ x: piece.x + x, y: piece.y + y }));
}
export function collides(state, piece) {
  const cells = pieceCells(piece);
  return (
    cells.length !== 4 ||
    cells.some(
      ({ x, y }) =>
        !Number.isInteger(x) ||
        !Number.isInteger(y) ||
        x < 0 ||
        x >= WIDTH ||
        y < 0 ||
        y >= HEIGHT ||
        state.board[y][x] !== null,
    )
  );
}
export function ghostPiece(state) {
  if (!state.active || collides(state, state.active)) return null;
  const ghost = { ...state.active };
  while (!collides(state, { ...ghost, y: ghost.y + 1 })) ghost.y += 1;
  return ghost;
}
export function gravitySeconds(level) {
  const safeLevel = Number.isFinite(level) ? Math.max(1, Math.min(30, Math.floor(level))) : 1;
  return Math.max(0.035, (0.8 - (safeLevel - 1) * 0.007) ** (safeLevel - 1));
}
export function isGrounded(state) {
  return Boolean(state.active && collides(state, { ...state.active, y: state.active.y + 1 }));
}
function spawn(state, type, usedHold = false) {
  state.active = { type, x: 3, y: HIDDEN_ROWS - 1, rotation: 0 };
  state.holdUsed = usedHold;
  state.lockElapsed = 0;
  state.lockResets = 0;
  state.gravityElapsed = 0;
  state.lastMove = 'spawn';
  state.lastRotation = null;
  if (collides(state, state.active)) {
    state.phase = 'lost';
    state.result = 'block-out';
  }
}
function spawnNext(state) {
  refillQueue(state);
  const type = state.next.shift();
  refillQueue(state);
  spawn(state, type);
}
export function createState({ mode = 'marathon', profile = DEFAULT_PROFILE, random = Math.random } = {}) {
  if (!['marathon', 'sprint', 'dig'].includes(mode))
    throw new RangeError('mode must be marathon, sprint or dig');
  if (typeof random !== 'function') throw new TypeError('random must be a function');
  if (!Object.hasOwn(PROFILES, profile)) throw new RangeError('profile must be standard, veteran or nightmare');
  const state = {
    gameId: 'prism-shift',
    mode,
    profile,
    phase: 'playing',
    width: WIDTH,
    height: HEIGHT,
    hiddenRows: HIDDEN_ROWS,
    board: Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(null)),
    active: null,
    hold: null,
    holdUsed: false,
    next: [],
    score: 0,
    lines: 0,
    level: PROFILES[profile].startLevel,
    timeLimit: mode === 'sprint' ? PROFILES[profile].sprintSeconds : null,
    elapsed: 0,
    piecesLocked: 0,
    combo: -1,
    backToBack: false,
    lastClear: null,
    gravityElapsed: 0,
    lockElapsed: 0,
    lockResets: 0,
    lastMove: 'spawn',
    lastRotation: null,
    result: null,
    pausedPhase: null,
    dig:
      mode === 'dig'
        ? {
            stageIndex: 0,
            piecesUsed: 0,
            budget: 0,
            stageStart: 0,
            garbageRows: 0,
            remainingRows: 0,
            results: [],
          }
        : null,
  };
  randomSources.set(state, random);
  if (mode === 'dig') beginDigStage(state, 0);
  else spawnNext(state);
  return state;
}
function resetLockAfterAction(state, wasGrounded) {
  if (wasGrounded && state.lockResets < lockResetLimit(state)) {
    state.lockElapsed = 0;
    state.lockResets += 1;
  }
}
function move(state, dx, dy, { scoreDrop = false, resetLock = false } = {}) {
  const candidate = { ...state.active, x: state.active.x + dx, y: state.active.y + dy };
  if (collides(state, candidate)) return false;
  const wasGrounded = isGrounded(state);
  state.active = candidate;
  state.lastMove = dx ? 'move' : 'drop';
  state.lastRotation = null;
  if (resetLock) resetLockAfterAction(state, wasGrounded);
  if (scoreDrop) state.score += dy;
  return true;
}
function rotate(state, direction) {
  if (state.active.type === 'O') return false;
  const from = state.active.rotation;
  const to = (from + direction + 4) % 4;
  const tests = (state.active.type === 'I' ? I_KICKS : KICKS)[`${from}>${to}`];
  const wasGrounded = isGrounded(state);
  for (let index = 0; index < tests.length; index += 1) {
    const [dx, dyUp] = tests[index];
    const candidate = { ...state.active, x: state.active.x + dx, y: state.active.y - dyUp, rotation: to };
    if (collides(state, candidate)) continue;
    state.active = candidate;
    state.lastMove = 'rotate';
    state.lastRotation = { from, to, kickIndex: index };
    resetLockAfterAction(state, wasGrounded);
    return true;
  }
  return false;
}
function spinKind(state) {
  if (state.active.type !== 'T' || state.lastMove !== 'rotate' || !state.lastRotation) return null;
  const cx = state.active.x + 1;
  const cy = state.active.y + 1;
  const occupied = (x, y) => x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT || state.board[y][x] !== null;
  // Clockwise corners: top left, top right, bottom right, bottom left.
  const corners = [
    occupied(cx - 1, cy - 1),
    occupied(cx + 1, cy - 1),
    occupied(cx + 1, cy + 1),
    occupied(cx - 1, cy + 1),
  ];
  if (corners.filter(Boolean).length < 3) return null;
  const front = state.active.rotation;
  return (corners[front] && corners[(front + 1) % 4]) || state.lastRotation.kickIndex === 4 ? 'full' : 'mini';
}
function lockPiece(state) {
  const cells = pieceCells(state.active);
  const spin = spinKind(state);
  for (const { x, y } of cells) state.board[y][x] = state.active.type;
  const keptRows = state.board.filter((row) => row.some((value) => value === null));
  const cleared = HEIGHT - keptRows.length;
  state.board = [...Array.from({ length: cleared }, () => Array(WIDTH).fill(null)), ...keptRows];
  const difficult = cleared > 0 && (cleared === 4 || spin !== null);
  const chained = difficult && state.backToBack;
  const regular = [0, 100, 300, 500, 800];
  const fullSpin = [400, 800, 1200, 1600];
  const miniSpin = [100, 200, 400];
  let base = spin === 'full' ? fullSpin[cleared] : spin === 'mini' ? miniSpin[cleared] : regular[cleared];
  base = base || 0;
  if (chained) base *= 1.5;
  state.combo = cleared ? state.combo + 1 : -1;
  const points = (base + Math.max(0, state.combo) * 50) * state.level;
  state.score += points;
  if (difficult) state.backToBack = true;
  else if (cleared) state.backToBack = false;
  state.lines += cleared;
  const profile = getProfile(state);
  state.level =
    state.mode === 'dig'
      ? Math.min(profile.digMaxLevel, profile.digLevel + Math.floor(state.dig.stageIndex / profile.digLevelEvery))
      : paceLevel(state);
  state.piecesLocked += 1;
  const lineLabels = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'TETRIS'];
  const label = spin
    ? `T-SPIN${spin === 'mini' ? ' MINI' : ''}${cleared ? ` ${lineLabels[cleared]}` : ''}`
    : lineLabels[cleared] || '';
  state.lastClear = {
    id: state.piecesLocked,
    lines: cleared,
    spin,
    label,
    points,
    combo: state.combo,
    backToBack: chained,
    time: state.elapsed,
  };
  if (state.mode === 'dig') {
    state.dig.piecesUsed += 1;
    state.dig.remainingRows = garbageRows(state);
    if (state.dig.remainingRows === 0) {
      state.dig.results.push({
        id: getDigStage(state).id,
        time: state.elapsed - state.dig.stageStart,
        pieces: state.dig.piecesUsed,
      });
      state.active = null;
      if (state.dig.stageIndex === getDigStageCount(state) - 1) {
        state.phase = 'won';
        state.result = 'excavated';
      } else {
        state.phase = 'stage-clear';
        state.result = 'layer-cleared';
      }
      return;
    }
    if (state.dig.piecesUsed >= state.dig.budget) {
      state.phase = 'lost';
      state.result = 'piece-budget';
      state.active = null;
      return;
    }
  }
  if (state.mode === 'sprint' && state.lines >= SPRINT_LINES) {
    state.phase = 'won';
    state.result = 'forty-lines';
    state.active = null;
    return;
  }
  if (!cleared && cells.every(({ y }) => y < HIDDEN_ROWS)) {
    state.phase = 'lost';
    state.result = 'lock-out';
    state.active = null;
    return;
  }
  spawnNext(state);
}
/** Immediate edge-triggered actions. The view owns keyboard DAS/ARR. */
export function dispatch(state, action) {
  if (state.phase !== 'playing' || !state.active || typeof action !== 'string') return false;
  switch (action) {
    case 'left':
      return move(state, -1, 0, { resetLock: true });
    case 'right':
      return move(state, 1, 0, { resetLock: true });
    case 'rotate-cw':
      return rotate(state, 1);
    case 'rotate-ccw':
      return rotate(state, -1);
    case 'soft-drop':
      return move(state, 0, 1, { scoreDrop: true });
    case 'hard-drop': {
      const ghost = ghostPiece(state);
      if (!ghost) return false;
      const distance = ghost.y - state.active.y;
      state.score += distance * 2;
      if (distance) {
        state.lastMove = 'drop';
        state.lastRotation = null;
      }
      state.active = ghost;
      lockPiece(state);
      return true;
    }
    case 'hold': {
      if (state.holdUsed) return false;
      const held = state.hold;
      state.hold = state.active.type;
      if (held === null) spawnNext(state);
      else spawn(state, held);
      state.holdUsed = true;
      return true;
    }
    default:
      return false;
  }
}
/** Advance in seconds. Invalid deltas cannot change the state or gameplay clocks. */
export function step(state, input = {}, dt = 1 / 120) {
  if (state.phase !== 'playing' || !state.active || !Number.isFinite(dt) || dt <= 0 || dt > 1) return false;
  let remaining = dt;
  const softDrop = input?.softDrop === true;
  const profile = getProfile(state);
  while (remaining > EPSILON && state.phase === 'playing') {
    if (state.mode === 'marathon') state.level = paceLevel(state);
    const lockDelay = lockDelayFor(state);
    const interval = softDrop
      ? Math.min(gravitySeconds(state.level), SOFT_DROP_SECONDS)
      : gravitySeconds(state.level);
    const grounded = isGrounded(state);
    const untilGravity = Math.max(0, interval - state.gravityElapsed);
    const untilLock = grounded ? Math.max(0, lockDelay - state.lockElapsed) : Infinity;
    const untilDeadline = timeRemaining(state) ?? Infinity;
    const untilPace = state.mode === 'marathon' && profile.paceSeconds && state.level < 30
      ? (Math.floor((state.elapsed + EPSILON) / profile.paceSeconds) + 1) * profile.paceSeconds - state.elapsed : Infinity;
    const advance = Math.min(remaining, untilGravity, untilLock, untilDeadline, untilPace);
    state.elapsed += advance;
    state.gravityElapsed += advance;
    if (grounded) state.lockElapsed += advance;
    remaining -= advance;
    if (state.mode === 'marathon') state.level = paceLevel(state);
    if (grounded && state.lockElapsed >= lockDelay - EPSILON) {
      lockPiece(state);
      continue;
    }
    if (timeRemaining(state) !== null && timeRemaining(state) <= EPSILON) break;
    if (state.gravityElapsed >= interval - EPSILON) {
      state.gravityElapsed = 0;
      move(state, 0, 1, { scoreDrop: softDrop });
      continue;
    }
    if (advance <= EPSILON) break;
  }
  if (state.phase === 'playing' && timeRemaining(state) !== null && timeRemaining(state) <= EPSILON) {
    state.phase = 'lost'; state.result = 'time-budget'; state.active = null;
  }
  return true;
}
export function togglePause(state) {
  if (['playing', 'stage-clear'].includes(state.phase)) {
    state.pausedPhase = state.phase;
    state.phase = 'paused';
  } else if (state.phase === 'paused') {
    state.phase = state.pausedPhase || 'playing';
    state.pausedPhase = null;
  } else return false;
  return true;
}
