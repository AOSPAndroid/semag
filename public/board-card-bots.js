/** Offline opponents. Card decisions accept only cards-engine.viewForPlayer snapshots. */
import { applyMove, legalMoves } from './checkers-engine.js';
import { canPlay, cardTotal } from './cards-engine.js';

export const BOARD_CARD_BOT_PROFILES = Object.freeze({
  normal: Object.freeze({ delayTicks: 72, depth: 3, nodes: 1000, memory: 12, memoryAge: 24 }),
  hard: Object.freeze({ delayTicks: 60, depth: 5, nodes: 3500, memory: 24, memoryAge: 64 }),
  expert: Object.freeze({ delayTicks: 48, depth: 7, nodes: 7500, memory: 32, memoryAge: 128 }),
});
const SUPPORTED = new Set(['checkers', 'crazy-eights', 'twenty-one', 'memory']);
const visibleCard = card => card && Number.isInteger(card.rank) && card.rank >= 1 && card.rank <= 13
  && Number.isInteger(card.suit) && card.suit >= 0 && card.suit <= 3 && typeof card.id === 'string';
const valueOf = card => card.rank === 8 ? 50 : Math.min(card.rank, 10);
const cardOrder = (a, b) => a.id.localeCompare(b.id);
const searchCopy = state => ({ ...state,
  board: state.board.map(piece => piece ? { ...piece } : null),
  positionCounts: { ...state.positionCounts },
  lastMove: state.lastMove ? { ...state.lastMove } : null,
});

function boardValue(state, playerId) {
  if (state.phase === 'matchEnd') return state.winner === null ? 0 : state.winner === playerId ? 100000 : -100000;
  let score = 0;
  const threatened = [new Set(), new Set()];
  const mobility = [legalMoves(state, 0), legalMoves(state, 1)];
  for (const owner of [0, 1]) {
    for (const move of mobility[1 - owner]) if (move.capture !== null) threatened[owner].add(move.capture);
  }
  for (let index = 0; index < 64; index += 1) {
    const piece = state.board[index];
    if (!piece) continue;
    const row = Math.floor(index / 8);
    const column = index % 8;
    const progress = piece.owner === 0 ? 7 - row : row;
    const central = 7 - Math.abs(3.5 - row) - Math.abs(3.5 - column);
    let value = piece.king ? 175 + central * 3 : 100 + progress * 4 + central * 1.5;
    if (column === 0 || column === 7) value += 5;
    if (!piece.king && progress === 0) value += 7;
    if (threatened[piece.owner].has(index)) value -= piece.king ? 35 : 25;
    score += piece.owner === playerId ? value : -value;
  }
  return score + (mobility[playerId].length - mobility[1 - playerId].length) * 2;
}

function orderedMoves(state) {
  return legalMoves(state).sort((a, b) => {
    const priority = move => {
      const row = Math.floor(move.to / 8);
      return (move.capture === null ? 0 : 50 + (state.board[move.capture]?.king ? 20 : 0))
        + (!state.board[move.from]?.king && row === (state.turn === 0 ? 0 : 7) ? 30 : 0)
        + (7 - Math.abs(3.5 - move.to % 8) - Math.abs(3.5 - row));
    };
    return priority(b) - priority(a) || a.from - b.from || a.to - b.to;
  });
}

function checkersDecision(view, playerId, profile) {
  const stats = { nodes: 0, completedDepth: 0 };
  const choices = orderedMoves(view);
  if (!choices.length) return { action: null, stats };
  let best = choices[0];
  const exhausted = Symbol('search budget');
  function search(state, depth, alpha, beta) {
    if (stats.nodes >= profile.nodes) throw exhausted;
    stats.nodes += 1;
    if (state.phase === 'matchEnd' || (depth <= 0 && state.forcedFrom === null)) return boardValue(state, playerId);
    const maximizing = state.turn === playerId;
    let score = maximizing ? -Infinity : Infinity;
    const moves = orderedMoves(state);
    if (!moves.length) return maximizing ? -100000 : 100000;
    for (const move of moves) {
      const child = searchCopy(state);
      applyMove(child, state.turn, move.from, move.to);
      // A forced jump is part of the same turn, including at the search horizon.
      const candidate = search(child, depth - (child.turn !== state.turn ? 1 : 0), alpha, beta);
      score = maximizing ? Math.max(score, candidate) : Math.min(score, candidate);
      if (maximizing) alpha = Math.max(alpha, score);
      else beta = Math.min(beta, score);
      if (alpha >= beta) break;
    }
    return score;
  }
  // Keep only fully searched iterations so a budget boundary cannot favor an early branch.
  for (let depth = 1; depth <= profile.depth; depth += 1) {
    let candidateBest = choices[0];
    let candidateScore = -Infinity;
    let alpha = -Infinity;
    try {
      for (const move of choices) {
        const child = searchCopy(view);
        applyMove(child, playerId, move.from, move.to);
        const score = search(child, depth - (child.turn !== playerId ? 1 : 0), alpha, Infinity);
        if (score > candidateScore) { candidateScore = score; candidateBest = move; }
        alpha = Math.max(alpha, candidateScore);
      }
      best = candidateBest;
      stats.completedDepth = depth;
      if (candidateScore >= 100000) break;
    } catch (error) {
      if (error !== exhausted) throw error;
      break;
    }
  }
  return { action: { kind: 'move', from: best.from, to: best.to }, stats };
}

function crazyEightsDecision(view, playerId) {
  const hand = (view.hands?.[playerId] || []).filter(visibleCard);
  if (!visibleCard(view.topCard)) return null;
  const playable = hand.filter(card => canPlay(card, view.topCard, view.activeSuit));
  if (!playable.length) return { kind: view.drawn?.[playerId] ? 'pass' : 'draw' };
  const opponentClose = view.handCounts?.[1 - playerId] <= 2;
  const suitFor = omitted => {
    const counts = [0, 0, 0, 0];
    for (const card of hand) if (card !== omitted && card.rank !== 8) counts[card.suit] += 1;
    return counts.indexOf(Math.max(...counts));
  };
  const rankScore = card => {
    const suit = card.rank === 8 ? suitFor(card) : card.suit;
    const remainder = hand.filter(other => other !== card);
    const links = remainder.filter(other => other.rank !== 8 && (other.suit === suit || other.rank === card.rank)).length;
    // Save wilds as an escape unless getting caught with fifty points is a near-term risk.
    const conserve = card.rank === 8 && !(opponentClose && hand.length <= 3) ? 24 : 0;
    return links * 8 + valueOf(card) * (opponentClose ? 0.7 : 0.18) - conserve;
  };
  const selected = playable.sort((a, b) => rankScore(b) - rankScore(a) || cardOrder(a, b))[0];
  return { kind: 'play', cardId: selected.id, ...(selected.rank === 8 ? { suit: suitFor(selected) } : {}) };
}

function twentyOneDecision(view, playerId, difficulty) {
  if (view.stood?.[playerId]) return null;
  const hand = (view.hands?.[playerId] || []).filter(visibleCard);
  if (!hand.length) return null;
  const total = cardTotal(hand);
  const hardTotal = hand.reduce((sum, card) => sum + Math.min(card.rank, 10), 0);
  const soft = hand.some(card => card.rank === 1) && total > hardTotal;
  let threshold = 17;
  if (difficulty !== 'normal' && soft) threshold = 18;
  // A final-round deficit permits a little more risk, using the visible score only.
  if (difficulty !== 'normal' && view.round === view.maxRounds && view.scores?.[playerId] < view.scores?.[1 - playerId]) {
    threshold = Math.max(threshold, soft ? 19 : 18);
  }
  return { kind: total < threshold && view.deckCount > 0 ? 'hit' : 'stand', round: view.round };
}

/**
 * Call observe on all snapshots, including human turns; action also observes.
 * Apply its returned move through the genuine engine. It emits at most once per
 * logical position/revision, and never writes to the supplied snapshot.
 */
export function createBoardCardBot({ gameId, playerId = 1, difficulty = 'hard' } = {}) {
  if (!SUPPORTED.has(gameId)) throw new Error(`Unsupported board/card bot: ${gameId}`);
  if (playerId !== 0 && playerId !== 1) throw new TypeError('Bot playerId must be 0 or 1');
  if (!Object.hasOwn(BOARD_CARD_BOT_PROFILES, difficulty)) throw new TypeError('Unknown bot difficulty');
  const profile = BOARD_CARD_BOT_PROFILES[difficulty];
  const memory = new Map();
  let observedRevision = null;
  let observation = 0;
  let cursor = 0;
  let lastAction = null;
  let lastPhase = null;
  let searchStats = { nodes: 0, completedDepth: 0 };

  function reset() {
    memory.clear();
    observedRevision = null;
    observation = 0;
    cursor = 0;
    lastAction = null;
    lastPhase = null;
    searchStats = { nodes: 0, completedDepth: 0 };
  }

  function observe(view) {
    if (!view || (view.gameId !== undefined && view.gameId !== gameId)) return;
    if ((view.phase === 'lobby' || view.phase === 'countdown') && lastPhase !== view.phase) reset();
    lastPhase = view.phase;
    if (gameId !== 'memory' || !Array.isArray(view.cards) || !Array.isArray(view.matched)) return;
    if (observedRevision !== null && view.revision < observedRevision) {
      memory.clear(); observation = 0; cursor = 0; lastAction = null;
    }
    if (view.revision !== observedRevision) { observation += 1; observedRevision = view.revision; }
    const revealed = new Set(view.revealed || []);
    for (let index = 0; index < Math.min(32, view.cards.length); index += 1) {
      if (view.matched[index] !== null && view.matched[index] !== undefined) { memory.delete(index); continue; }
      const card = view.cards[index];
      // Extra card values in a malformed snapshot never grant knowledge of a face-down card.
      if (revealed.has(index) && visibleCard(card)) memory.set(index, { face: `${card.rank}:${card.suit}`, seen: observation });
    }
    for (const [index, known] of memory) if (observation - known.seen > profile.memoryAge) memory.delete(index);
    while (memory.size > profile.memory) {
      const oldest = [...memory].sort((a, b) => a[1].seen - b[1].seen || a[0] - b[0])[0][0];
      memory.delete(oldest);
    }
  }

  function memoryDecision(view) {
    if (view.mismatchTicks > 0 || !Array.isArray(view.cards) || !Array.isArray(view.matched)) return null;
    const revealed = new Set(view.revealed || []);
    const available = Array.from({ length: Math.min(32, view.cards.length) }, (_, index) => index)
      .filter(index => view.matched[index] === null && !revealed.has(index));
    if (!available.length || revealed.size > 1) return null;
    if (revealed.size === 1) {
      const first = [...revealed][0];
      const face = memory.get(first)?.face;
      const mate = available.find(index => face !== undefined && memory.get(index)?.face === face);
      if (mate !== undefined) return { kind: 'flip', index: mate };
    } else {
      const pair = available.find((index, position) => memory.has(index)
        && available.slice(position + 1).some(other => memory.get(other)?.face === memory.get(index).face));
      if (pair !== undefined) return { kind: 'flip', index: pair };
    }
    const unexplored = available.filter(index => !memory.has(index));
    const pool = unexplored.length ? unexplored : available;
    const selected = pool.find(index => index >= cursor) ?? pool[0];
    cursor = (selected + 1) % 32;
    return { kind: 'flip', index: selected };
  }

  function action(view) {
    observe(view);
    if (!view || view.phase !== 'fight' || (view.gameId !== undefined && view.gameId !== gameId)) return null;
    if (gameId !== 'twenty-one' && view.turn !== playerId) return null;
    const signature = gameId === 'checkers'
      ? `${view.turn}:${view.forcedFrom}:${view.board?.map(piece => piece ? `${piece.owner}${piece.king ? 'K' : 'M'}` : '.').join('')}`
      : gameId === 'twenty-one'
        ? `${view.round}:${view.stood?.[playerId]}:${view.hands?.[playerId]?.map(card => card?.id).join(',')}`
        : `${view.revision}:${view.round}:${view.turn}`;
    if (signature === lastAction) return null;
    let result;
    if (gameId === 'checkers') {
      if (!Array.isArray(view.board) || view.board.length !== 64) return null;
      const decision = checkersDecision(view, playerId, profile);
      searchStats = decision.stats;
      result = decision.action;
    } else if (gameId === 'crazy-eights') result = crazyEightsDecision(view, playerId);
    else if (gameId === 'twenty-one') result = twentyOneDecision(view, playerId, difficulty);
    else result = memoryDecision(view);
    if (!result) return null;
    lastAction = signature;
    // Twenty-One decisions are concurrent: an opponent hit changes revision, but
    // cannot invalidate this player's choice in the same hand.
    return gameId === 'checkers' || gameId === 'twenty-one' ? result : { ...result, revision: view.revision };
  }

  return Object.freeze({ reset, observe, action, delayTicks: profile.delayTicks,
    get diagnostics() { return Object.freeze({ ...searchStats, remembered: memory.size }); } });
}
