/** Deterministic American checkers, shared by the host and board view. */
export const TICK_RATE = 120;
export const cloneState = state => JSON.parse(JSON.stringify(state));

const validSquare = index => Number.isInteger(index) && index >= 0 && index < 64;
const darkSquare = index => (Math.floor(index / 8) + index % 8) % 2 === 1;
const positionKey = state => `${state.turn}:${state.board.map(piece => piece ? `${piece.owner}${piece.king ? 'K' : 'M'}` : '.').join('')}`;

function startingBoard() {
  return Array.from({ length: 64 }, (_, index) => {
    const row = Math.floor(index / 8);
    if (!darkSquare(index) || (row > 2 && row < 5)) return null;
    return { owner: row < 3 ? 1 : 0, king: false };
  });
}

export function createState() {
  const state = {
    tick: 0, phase: 'lobby', phaseTicks: 0, board: startingBoard(), turn: 0,
    winner: null, result: null, reason: null, forcedFrom: null, moves: 0,
    halfMoves: 0, lastMove: null, positionCounts: {},
  };
  state.positionCounts[positionKey(state)] = 1;
  return state;
}

export function startMatch(state) {
  const tick = state.tick;
  Object.assign(state, createState(), { tick, phase: 'countdown', phaseTicks: TICK_RATE * 3 });
  return state;
}

export function resetLobby(state) {
  const tick = state.tick;
  Object.assign(state, createState(), { tick });
  return state;
}

/** Checkers has no thinking clock. Only the shared ready countdown advances. */
export function step(state) {
  state.tick += 1;
  if (state.phase === 'countdown') {
    state.phaseTicks = Math.max(0, state.phaseTicks - 1);
    if (state.phaseTicks === 0) state.phase = 'fight';
  }
  return state;
}

function movesFrom(board, from, captureOnly = false) {
  const piece = board[from];
  if (!piece) return [];
  const row = Math.floor(from / 8);
  const col = from % 8;
  const directions = piece.king ? [-1, 1] : [piece.owner === 0 ? -1 : 1];
  const moves = [];
  for (const dr of directions) {
    for (const dc of [-1, 1]) {
      const nextRow = row + dr;
      const nextCol = col + dc;
      if (nextRow < 0 || nextRow > 7 || nextCol < 0 || nextCol > 7) continue;
      const next = nextRow * 8 + nextCol;
      if (board[next] === null) {
        if (!captureOnly) moves.push({ from, to: next, capture: null });
        continue;
      }
      if (board[next]?.owner === piece.owner) continue;
      const landRow = row + dr * 2;
      const landCol = col + dc * 2;
      if (landRow < 0 || landRow > 7 || landCol < 0 || landCol > 7) continue;
      const to = landRow * 8 + landCol;
      if (board[to] === null) moves.push({ from, to, capture: next });
    }
  }
  return moves;
}

/** All legal next steps, including the compulsory next jump in a capture chain. */
export function legalMoves(state, playerId = state.turn) {
  if (playerId !== 0 && playerId !== 1) return [];
  if (state.forcedFrom !== null && state.forcedFrom !== undefined && playerId === state.turn) {
    const piece = state.board[state.forcedFrom];
    return piece?.owner === playerId ? movesFrom(state.board, state.forcedFrom, true) : [];
  }
  const moves = [];
  for (let from = 0; from < 64; from += 1) {
    if (state.board[from]?.owner === playerId) moves.push(...movesFrom(state.board, from));
  }
  const captures = moves.filter(move => move.capture !== null);
  return captures.length ? captures : moves;
}

function finish(state, winner, reason) {
  state.phase = 'matchEnd';
  state.phaseTicks = 0;
  state.winner = winner;
  state.result = winner === null ? 'draw' : 'win';
  state.reason = reason;
  state.forcedFrom = null;
}

export function applyMove(state, playerId, from, to) {
  const reject = error => ({ ok: false, error });
  if (state.phase !== 'fight') return reject('The match has not started or has already ended.');
  if (playerId !== 0 && playerId !== 1) return reject('Only a seated player can move.');
  if (state.turn !== playerId) return reject('Wait for your turn.');
  if (!validSquare(from) || !validSquare(to)) return reject('Choose two valid board squares.');
  const piece = state.board[from];
  if (!piece || piece.owner !== playerId) return reject('Choose one of your own pieces.');
  if (!darkSquare(to)) return reject('Pieces stay on the dark squares.');
  if (state.board[to] !== null) return reject('That square is occupied.');
  if (state.forcedFrom !== null && state.forcedFrom !== undefined && from !== state.forcedFrom) {
    return reject('Finish the capture with the same piece.');
  }
  const choices = legalMoves(state, playerId);
  const move = choices.find(candidate => candidate.from === from && candidate.to === to);
  if (!move) {
    if (choices.some(candidate => candidate.capture !== null)) return reject('A capture is available. You must take it.');
    return reject(piece.king ? 'Kings move one diagonal square or jump an adjacent opponent.' : 'Move forward diagonally to an empty square.');
  }

  const wasMan = !piece.king;
  state.board[from] = null;
  state.board[to] = piece;
  if (move.capture !== null) state.board[move.capture] = null;
  const kinged = wasMan && Math.floor(to / 8) === (playerId === 0 ? 0 : 7);
  if (kinged) piece.king = true;
  state.lastMove = { from, to, capture: move.capture, playerId, kinged, tick: state.tick };

  // A newly crowned man ends its turn, even if the new king could jump again.
  if (move.capture !== null && !kinged && movesFrom(state.board, to, true).length > 0) {
    state.forcedFrom = to;
    state.halfMoves = 0;
    return { ok: true };
  }

  state.forcedFrom = null;
  state.moves += 1;
  state.halfMoves = move.capture !== null || wasMan ? 0 : (state.halfMoves || 0) + 1;
  state.turn = 1 - playerId;
  if (!legalMoves(state).length) {
    finish(state, playerId, state.board.some(next => next?.owner === state.turn) ? 'no-legal-moves' : 'all-pieces-captured');
    return { ok: true };
  }

  // Irreversible progress makes every earlier position impossible to repeat.
  if (move.capture !== null || wasMan) state.positionCounts = {};
  if (!state.positionCounts) state.positionCounts = {};
  const key = positionKey(state);
  state.positionCounts[key] = (state.positionCounts[key] || 0) + 1;
  if (state.positionCounts[key] >= 3) finish(state, null, 'threefold-repetition');
  else if (state.halfMoves >= 80) finish(state, null, '80-half-moves');
  return { ok: true };
}
