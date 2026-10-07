/** Local Minesweeper rules. The clock is advanced explicitly by the view. */
export const DIFFICULTIES = Object.freeze({
  beginner: Object.freeze({ rows: 9, cols: 9, mines: 10, label: 'Beginner' }),
  intermediate: Object.freeze({ rows: 16, cols: 16, mines: 40, label: 'Intermediate' }),
  expert: Object.freeze({ rows: 16, cols: 30, mines: 99, label: 'Expert' }),
  master: Object.freeze({ rows: 16, cols: 24, mines: 90, label: 'Master', timeLimit: 360 }),
});

// One certified seed per opening tile bounds first-reveal work even when a
// random source repeatedly supplies an unsolvable field. These are ordinary
// shuffled boards, verified with the same visible-clue deductions below.
const MASTER_SEEDS = Object.freeze([
  758912016, 1982399922, 174714181, 1765143426, 3128667971, 1863651307, 1378974910, 310555092, 341631547, 269026334, 140524786, 2943570718,
  847036825, 156324836, 497118551, 110076705, 58340600, 667777231, 110390892, 234382525, 482261062, 1612833790, 3026871425, 2216328033,
  3445199184, 1989632791, 2093419188, 3812454710, 64980593, 2326021320, 1242115639, 1608497835, 4169153204, 1598604675, 1567737678, 2620881091,
  617926248, 1273820468, 3426460154, 1212086474, 2404602654, 3560763863, 2915845591, 3907045552, 2982717874, 1445002793, 696402853, 2188533675,
  283877255, 108254246, 2746338930, 2157980865, 1337334855, 4109409061, 3412649955, 1910625973, 774879458, 1270531803, 1239664806, 3092689850,
  656794715, 873701526, 4032258435, 1023386369, 1896082671, 2205904660, 3460364292, 1839172779, 347915287, 1989521494, 750093311, 642460871,
  2449028326, 874958274, 100769853, 147332171, 1076588680, 2362020038, 1944006466, 2563545715, 1185408637, 2052721694, 1339812853, 3973178164,
  1015483060, 1010204544, 2398653698, 4051026395, 1691896703, 1976130211, 2998301898, 3586869421, 360531401, 4082626495, 1790823500, 3008928161,
  118559754, 676155551, 3014625593, 1878879078, 2621641359, 1079206905, 568278155, 330711694, 971120051, 3867081161, 243493948, 3815449785,
  3604135677, 305751587, 1229624851, 1931976660, 3852328401, 3217512747, 1796973581, 228950646, 4270865618, 895052213, 1019043846, 4053713851,
  3909726440, 833527677, 1091508832, 2939150631, 2785060602, 2924538098, 4132540141, 1411852355, 1964728779, 3095301507, 2630830346, 3916261704,
  3900880570, 194480797, 711002250, 690237871, 525381352, 1733383395, 1991364550, 1284502826, 618715446, 3003643077, 2337855697, 557086181,
  371360554, 185634927, 1770017055, 282815064, 2627332223, 1192634938, 1688287283, 4228073544, 893334483, 2493866346, 1750649651, 3567319724,
  1074200510, 1007642414, 4073948017, 1714818325, 1606522013, 2024745043, 21790200, 1658677034, 512827901, 2727411039, 1431422649, 2232072881,
  3161329390, 2237001712, 1153096031, 1783401770, 2263568252, 4132079159, 1143412329, 3683198590, 3890002783, 797654285, 3812782926, 3074285604,
  49927675, 3967955743, 1934029174, 4153995557, 1289215631, 2770579963, 1485358063, 1847020886, 3860287805, 210448239, 3318492058, 1305434597,
  1269184355, 593294357, 386699622, 159899651, 2404790643, 3974350780, 4181154973, 593922731, 583260970, 4217824131, 2044524795, 2452645207,
  2963783415, 129311343, 393339615, 3392318521, 2608027482, 2762990841, 1627244326, 558824508, 1214718728, 3955821208, 930799407, 435356520,
  208556549, 399211007, 379110500, 2082660159, 1989849710, 1860684290, 921534621, 689351405, 771604822, 2749180642, 410920058, 1913153498,
  1975201679, 1510730518, 478001799, 2238775537, 3276433087, 1500382944, 2254575587, 3214803822, 3431710633, 1186365227, 2084650010, 1103762125,
  1883543249, 3726465675, 3757542130, 3324042695, 257946550, 2947208196, 1373138144, 2054620845, 2364442834, 1326994742, 1089428281, 1667893186,
  707874409, 2225593712, 2499060730, 826692255, 3619635569, 1653035697, 2587011579, 2607985416, 1467519528, 739788696, 1493317467, 4074178072,
  507814938, 68932258, 322194040, 941733289, 425421294, 74734419, 2583548954, 1122599316, 880313482, 90639198, 2196157423, 477995231,
  3188125985, 1907623458, 230535610, 39426738, 617891643, 380325182, 1222049758, 2352622486, 4009050684, 292548293, 200401716, 3958187909,
  3762359664, 804664560, 2450990140, 1145563004, 3168932541, 1796178708, 3824931490, 588490852, 650539033, 3499378682, 505992479, 629984112,
  3727261441, 1487299280, 1518375735, 388012465, 3144600808, 2060695127, 3799935885, 1905382083, 1033559111, 2463746481, 3067799867, 1379945529,
  2040559122, 265172851, 1953236647, 1148076500, 120731026, 373992808, 1520051399, 1989451391, 4276744471, 1529804332, 998670346, 2263896468,
  895862008, 2868054583, 266534328, 3915919480, 3394888112, 772498749, 654099819, 261674728, 158761661, 3503812798, 1826061078, 1315132328,
  2770908179, 2435707167, 1181456993, 562127202, 314458123, 3102018192, 717300019, 3050386816, 81925222, 1368020452, 3122747073, 1476630951,
  950216338, 4124922982, 91992342, 3159625689, 1384239418, 733937901, 1797183932, 1276152564, 2018914845, 254295064, 3511150396, 837584071,
  233740143, 3398344169, 2639641611, 626584150, 951892002, 890053279, 2464332789, 534087888, 441277439, 332981127, 2170520308, 281349751,
  2914051190, 2568083688, 1247170689, 947660776, 3198598885, 2981901532, 1340504783, 1087452459, 1453834655, 1805394860, 1619669233, 1418457743,
]);
const randomSources = new WeakMap();
const seeded = seed => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const rejected = error => ({ ok: false, error });
const validIndex = (state, index) => Number.isInteger(index) && index >= 0 && index < state.cells.length;

export function createState({ rows = 9, cols = 9, mines = 10, random = Math.random } = {}) {
  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 2 || cols < 2 || rows > 32 || cols > 32) {
    throw new RangeError('The board must have between 2 and 32 rows and columns.');
  }
  if (!Number.isInteger(mines) || mines < 1 || mines >= rows * cols) {
    throw new RangeError('The mine count must be positive and smaller than the board.');
  }
  if (typeof random !== 'function') throw new TypeError('random must be a function');
  const difficulty = Object.entries(DIFFICULTIES).find(([, value]) => value.rows === rows && value.cols === cols && value.mines === mines)?.[0] || 'custom';
  const state = {
    rows, cols, mines, difficulty, phase: 'playing', generated: false,
    elapsed: 0, opened: 0, flags: 0, exploded: null, revision: 0,
    logicOnly: difficulty === 'master', timeLimit: difficulty === 'master' ? DIFFICULTIES.master.timeLimit : null, failure: null, generationAttempts: 0,
    cells: Array.from({ length: rows * cols }, () => ({ mine: false, adjacent: 0, revealed: false, flagged: false })),
  };
  randomSources.set(state, random);
  return state;
}

export function neighbors(state, index) {
  if (!validIndex(state, index)) return [];
  const row = Math.floor(index / state.cols);
  const col = index % state.cols;
  const result = [];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const y = row + dy;
      const x = col + dx;
      if ((dx || dy) && y >= 0 && y < state.rows && x >= 0 && x < state.cols) result.push(y * state.cols + x);
    }
  }
  return result;
}

const unitSample = random => { const sample = Number(random()); return Number.isFinite(sample) ? Math.max(0, Math.min(1 - Number.EPSILON, sample)) : 0; };
const mirroredIndex = (state, index, mirror) => {
  const row = Math.floor(index / state.cols), col = index % state.cols;
  return (mirror & 2 ? state.rows - 1 - row : row) * state.cols + (mirror & 1 ? state.cols - 1 - col : col);
};

function countClues(state) {
  for (const [index, cell] of state.cells.entries()) cell.adjacent = neighbors(state, index).filter(other => state.cells[other].mine).length;
}

function fillMines(state, firstIndex, random) {
  for (const cell of state.cells) { cell.mine = false; cell.adjacent = 0; }
  let excluded = new Set([firstIndex, ...neighbors(state, firstIndex)]);
  // Dense custom boards still guarantee a safe first tile.
  if (state.cells.length - excluded.size < state.mines) excluded = new Set([firstIndex]);
  const candidates = state.cells.flatMap((_, index) => excluded.has(index) ? [] : [index]);
  for (let index = 0; index < state.mines; index += 1) {
    const unit = unitSample(random);
    const other = index + Math.floor(unit * (candidates.length - index));
    [candidates[index], candidates[other]] = [candidates[other], candidates[index]];
    state.cells[candidates[index]].mine = true;
  }
  countClues(state);
}

function placeMines(state, firstIndex) {
  const random = randomSources.get(state) || Math.random;
  if (!state.logicOnly) { fillMines(state, firstIndex, random); state.generationAttempts = 1; }
  else {
    let accepted = false;
    // Eight candidates keep generation bounded; the certified bank supplies
    // the fallback without an unbounded retry loop on the browser thread.
    for (let attempt = 1; attempt <= 8; attempt++) {
      fillMines(state, firstIndex, random);
      const proof = solveLogically(state, firstIndex);
      state.generationAttempts = attempt;
      if (proof.solved && proof.subsetDeductions >= 2 && proof.opening < 70) { accepted = true; break; }
    }
    if (!accepted) {
      // Reflections preserve clues and deductions. Choose the bank entry at the
      // inverse-reflected opening, then reflect its mines back into this board.
      // A repeated opening has four certified fallback layouts to explore.
      const mirror = Math.floor(unitSample(random) * 4);
      fillMines(state, mirroredIndex(state, firstIndex, mirror), seeded(MASTER_SEEDS[mirroredIndex(state, firstIndex, mirror)]));
      if (mirror) {
        const mines = state.cells.map(cell => cell.mine);
        for (let index = 0; index < state.cells.length; index++) state.cells[index].mine = mines[mirroredIndex(state, index, mirror)];
        countClues(state);
      }
      state.generationAttempts = 9;
      if (!solveLogically(state, firstIndex).solved) throw new Error('The Master field failed its deduction certificate.');
    }
  }
  state.generated = true;
}

/** Deductions use only open clues, player flags and the public mine total. */
export function logicalDeductions(state) {
  const constraints = [], safe = new Set(), mines = new Set(), byCell = new Map();
  for (let index = 0; index < state.cells.length; index++) {
    const clue = state.cells[index];
    if (!clue.revealed || !clue.adjacent) continue;
    let remaining = clue.adjacent;
    const covered = [];
    for (const other of neighbors(state, index)) {
      if (state.cells[other].flagged) remaining--;
      else if (!state.cells[other].revealed) covered.push(other);
    }
    if (remaining < 0 || remaining > covered.length) return { safe: [], mines: [], kind: 'contradiction' };
    if (!covered.length) continue;
    if (remaining === 0) for (const other of covered) safe.add(other);
    else if (remaining === covered.length) for (const other of covered) mines.add(other);
    else constraints.push({ cells: covered, remaining });
  }
  if (safe.size || mines.size) return { safe: [...safe], mines: [...mines], kind: 'local' };
  const unknown = [], flagged = state.cells.filter(cell => cell.flagged).length;
  for (let index = 0; index < state.cells.length; index++) if (!state.cells[index].revealed && !state.cells[index].flagged) unknown.push(index);
  const remaining = state.mines - flagged;
  if (unknown.length && (remaining === 0 || remaining === unknown.length)) return { safe: remaining === 0 ? unknown : [], mines: remaining === 0 ? [] : unknown, kind: 'total' };
  for (let index = 0; index < constraints.length; index++) for (const cell of constraints[index].cells) {
    if (!byCell.has(cell)) byCell.set(cell, []);
    byCell.get(cell).push(index);
  }
  const compared = new Set();
  for (let a = 0; a < constraints.length; a++) for (const cell of constraints[a].cells) for (const b of byCell.get(cell)) {
    if (a === b) continue;
    const pair = Math.min(a, b) * constraints.length + Math.max(a, b);
    if (compared.has(pair)) continue;
    compared.add(pair);
    let small = constraints[a], big = constraints[b];
    if (small.cells.length > big.cells.length) [small, big] = [big, small];
    if (small.cells.length === big.cells.length || !small.cells.every(index => big.cells.includes(index))) continue;
    const difference = big.cells.filter(index => !small.cells.includes(index)), count = big.remaining - small.remaining;
    if (count === 0 || count === difference.length) return { safe: count === 0 ? difference : [], mines: count === 0 ? [] : difference, kind: 'subset' };
  }
  return { safe: [], mines: [], kind: 'none' };
}

/** Certify a board without guessing or using hidden mines to choose a move. */
export function solveLogically(state, firstIndex) {
  const proof = { ...state, opened: 0, flags: 0, cells: state.cells.map(cell => ({ ...cell, revealed: false, flagged: false })) };
  let subsetDeductions = 0, deductions = 0;
  if (!validIndex(state, firstIndex) || proof.cells[firstIndex].mine) return { solved: false, opening: 0, opened: 0, subsetDeductions, deductions };
  openSafeTiles(proof, firstIndex);
  const opening = proof.opened;
  while (proof.opened < proof.cells.length - proof.mines && deductions < proof.cells.length) {
    const moves = logicalDeductions(proof);
    if (!moves.safe.length && !moves.mines.length) break;
    // Reading mine bits here only checks the certificate's correctness.
    // logicalDeductions never sees covered mine bits or covered clues.
    if (moves.safe.some(index => proof.cells[index].mine) || moves.mines.some(index => !proof.cells[index].mine)) break;
    for (const index of moves.mines) proof.cells[index].flagged = true;
    for (const index of moves.safe) openSafeTiles(proof, index);
    if (moves.kind === 'subset') subsetDeductions++;
    deductions++;
  }
  return { solved: proof.opened === proof.cells.length - proof.mines, opening, opened: proof.opened, subsetDeductions, deductions };
}

function openSafeTiles(state, start) {
  const queue = [start];
  const queued = new Set(queue);
  for (let position = 0; position < queue.length; position += 1) {
    const index = queue[position];
    const cell = state.cells[index];
    if (cell.revealed || cell.flagged || cell.mine) continue;
    cell.revealed = true;
    state.opened += 1;
    if (cell.adjacent) continue;
    for (const other of neighbors(state, index)) {
      if (!queued.has(other)) { queued.add(other); queue.push(other); }
    }
  }
}

function finishIfWon(state) {
  if (state.opened === state.cells.length - state.mines) state.phase = 'won';
}

function explode(state, index) {
  state.phase = 'lost';
  state.failure = 'mine';
  state.exploded = index;
  for (const cell of state.cells) if (cell.mine) cell.revealed = true;
}

export function reveal(state, index) {
  if (state.phase !== 'playing') return rejected('Resume or start a new board to play.');
  if (!validIndex(state, index)) return rejected('Choose a tile on the board.');
  const cell = state.cells[index];
  if (cell.flagged) return rejected('Remove the flag before revealing this tile.');
  if (cell.revealed) return rejected('This tile is already open.');
  if (!state.generated) placeMines(state, index);
  if (cell.mine) explode(state, index);
  else { openSafeTiles(state, index); finishIfWon(state); }
  state.revision += 1;
  return { ok: true };
}

export function flag(state, index) {
  if (state.phase !== 'playing') return rejected('Resume or start a new board to play.');
  if (!validIndex(state, index)) return rejected('Choose a tile on the board.');
  const cell = state.cells[index];
  if (cell.revealed) return rejected('Open tiles cannot be flagged.');
  cell.flagged = !cell.flagged;
  state.flags += cell.flagged ? 1 : -1;
  state.revision += 1;
  return { ok: true };
}

/** Reveal around a number after placing exactly that many adjacent flags. */
export function chord(state, index) {
  if (state.phase !== 'playing') return rejected('Resume or start a new board to play.');
  if (!validIndex(state, index)) return rejected('Choose a tile on the board.');
  const cell = state.cells[index];
  if (!cell.revealed || !cell.adjacent || cell.mine) return rejected('Chord an open numbered tile.');
  const adjacent = neighbors(state, index);
  if (adjacent.filter(other => state.cells[other].flagged).length !== cell.adjacent) {
    return rejected(`Place ${cell.adjacent} adjacent ${cell.adjacent === 1 ? 'flag' : 'flags'} before opening around this number.`);
  }
  const covered = adjacent.filter(other => !state.cells[other].flagged && !state.cells[other].revealed);
  if (!covered.length) return rejected('All unflagged neighboring tiles are already open.');
  for (const other of covered) {
    if (state.cells[other].mine) { explode(state, other); break; }
    openSafeTiles(state, other);
  }
  if (state.phase === 'playing') finishIfWon(state);
  state.revision += 1;
  return { ok: true };
}

export function togglePause(state) {
  if (state.phase !== 'playing' && state.phase !== 'paused') return rejected('Start a new board to play again.');
  state.phase = state.phase === 'playing' ? 'paused' : 'playing';
  state.revision += 1;
  return { ok: true };
}

export function advanceTime(state, seconds) {
  if (state.phase === 'playing' && state.generated && Number.isFinite(seconds) && seconds > 0) {
    state.elapsed += seconds;
    if (state.timeLimit !== null && state.elapsed >= state.timeLimit) {
      state.elapsed = state.timeLimit; state.phase = 'lost'; state.failure = 'timeout'; state.revision += 1;
    }
  }
  return state.elapsed;
}

export function getStats(state) {
  return { opened: state.opened, safe: state.cells.length - state.mines, flags: state.flags, remaining: state.mines - state.flags, elapsed: state.elapsed };
}

export const cloneState = state => JSON.parse(JSON.stringify(state));
