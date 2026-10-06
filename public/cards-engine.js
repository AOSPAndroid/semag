/** Authoritative, two-player card rules. Never send the internal state to a client. */
export const TICK_RATE = 120;
export const GAME_IDS = ['crazy-eights', 'twenty-one', 'memory'];
const randomSources = new WeakMap();
const isPlayer = id => id === 0 || id === 1;
const cardCopy = card => card ? { id: card.id, rank: card.rank, suit: card.suit } : null;
const rejected = error => ({ ok: false, error });

function shuffle(cards, random) {
  for (let index = cards.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [cards[index], cards[other]] = [cards[other], cards[index]];
  }
  return cards;
}

function standardDeck(random) {
  return shuffle(Array.from({ length: 52 }, (_, id) => ({
    id: `c${id}`, rank: id % 13 + 1, suit: Math.floor(id / 13),
  })), random);
}

export function cardTotal(hand) {
  let total = 0;
  let aces = 0;
  for (const card of hand) {
    if (card.rank === 1) { total += 11; aces += 1; }
    else total += Math.min(card.rank, 10);
  }
  while (total > 21 && aces > 0) { total -= 10; aces -= 1; }
  return total;
}

export function canPlay(card, topCard, activeSuit = topCard?.suit) {
  return !!card && !!topCard && (card.rank === 8 || card.suit === activeSuit || card.rank === topCard.rank);
}

function dealTwentyOne(state, random) {
  state.deck = standardDeck(random);
  state.hands = [[], []];
  for (let count = 0; count < 2; count += 1) {
    for (let player = 0; player < 2; player += 1) state.hands[player].push(state.deck.pop());
  }
  state.stood = state.hands.map(hand => cardTotal(hand) >= 21);
  state.roundWinner = null;
  state.roundOutcome = null;
}

export function createState(gameId, { random = Math.random } = {}) {
  if (!GAME_IDS.includes(gameId)) throw new Error(`Unknown card game: ${gameId}`);
  if (typeof random !== 'function') throw new TypeError('random must be a function');
  const state = {
    gameId, tick: 0, phase: 'lobby', phaseTicks: 0, revision: 0,
    scores: [0, 0], winner: null, result: null, reason: null,
    round: 1, maxRounds: gameId === 'twenty-one' ? 5 : 1,
  };
  randomSources.set(state, random);
  if (gameId === 'crazy-eights') {
    state.deck = standardDeck(random);
    state.hands = [[], []];
    for (let count = 0; count < 7; count += 1) {
      for (let player = 0; player < 2; player += 1) state.hands[player].push(state.deck.pop());
    }
    // Start on an ordinary card so the active suit is unambiguous.
    const initialIndex = state.deck.findLastIndex(card => card.rank !== 8);
    state.discard = state.deck.splice(initialIndex, 1);
    state.activeSuit = state.discard[0].suit;
    state.turn = 0;
    state.drawn = [false, false];
    state.emptyPasses = 0;
  } else if (gameId === 'twenty-one') dealTwentyOne(state, random);
  else {
    state.board = shuffle(Array.from({ length: 32 }, (_, id) => ({
      id: `m${id}`, rank: Math.floor(id / 2) % 8 + 1, suit: Math.floor(id / 16),
    })), random);
    state.matched = Array(32).fill(null);
    state.revealed = [];
    state.turn = 0;
    state.mismatchTicks = 0;
  }
  return state;
}

function replaceState(state, phase) {
  const random = randomSources.get(state) || Math.random;
  const fresh = createState(state.gameId, { random });
  const tick = state.tick;
  const revision = state.revision + 1;
  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, fresh, { tick, revision, phase, phaseTicks: phase === 'countdown' ? 240 : 0 });
  randomSources.set(state, random);
  return state;
}

export const startMatch = state => replaceState(state, 'countdown');
export const resetLobby = state => replaceState(state, 'lobby');

function finish(state, winner, reason) {
  state.phase = 'matchEnd';
  state.phaseTicks = 0;
  state.winner = winner;
  state.result = winner === null ? 'draw' : 'win';
  state.reason = reason;
}

function resolveTwentyOne(state) {
  if (!state.stood.every(Boolean)) return;
  const totals = state.hands.map(cardTotal);
  const effective = totals.map(total => total > 21 ? -1 : total);
  const winner = effective[0] === effective[1] ? null : effective[0] > effective[1] ? 0 : 1;
  state.roundWinner = winner;
  state.roundOutcome = winner === null ? 'draw' : 'win';
  if (winner !== null) state.scores[winner] += 1;
  if (state.round === state.maxRounds) {
    const matchWinner = state.scores[0] === state.scores[1] ? null : state.scores[0] > state.scores[1] ? 0 : 1;
    finish(state, matchWinner, 'Five rounds complete');
  } else {
    state.phase = 'roundEnd';
    state.phaseTicks = 480;
  }
}

export function step(state) {
  state.tick += 1;
  if (state.phase === 'countdown') {
    state.phaseTicks = Math.max(0, state.phaseTicks - 1);
    if (state.phaseTicks === 0) {
      state.phase = 'fight';
      if (state.gameId === 'twenty-one') resolveTwentyOne(state);
      state.revision += 1;
    }
  } else if (state.phase === 'roundEnd' && state.gameId === 'twenty-one') {
    state.phaseTicks = Math.max(0, state.phaseTicks - 1);
    if (state.phaseTicks === 0) {
      state.round += 1;
      dealTwentyOne(state, randomSources.get(state) || Math.random);
      state.phase = 'fight';
      resolveTwentyOne(state);
      state.revision += 1;
    }
  } else if (state.phase === 'fight' && state.gameId === 'memory' && state.mismatchTicks > 0) {
    state.mismatchTicks -= 1;
    if (state.mismatchTicks === 0) {
      state.revealed = [];
      state.turn = 1 - state.turn;
      state.revision += 1;
    }
  }
  return state;
}

function nextTurn(state) {
  state.drawn = [false, false];
  state.turn = 1 - state.turn;
}

function remainingPoints(hand) {
  return hand.reduce((total, card) => total + (card.rank === 8 ? 50 : Math.min(card.rank, 10)), 0);
}

function applyCrazyEights(state, player, action) {
  if (state.turn !== player) return rejected('Wait for your turn');
  const hand = state.hands[player];
  const top = state.discard.at(-1);
  if (action.kind === 'play') {
    const index = hand.findIndex(card => card.id === action.cardId);
    if (index < 0) return rejected('That card is not in your hand');
    const card = hand[index];
    if (!canPlay(card, top, state.activeSuit)) return rejected('Match the rank or active suit, or play an eight');
    if (card.rank === 8 && (!Number.isInteger(action.suit) || action.suit < 0 || action.suit > 3)) {
      return rejected('Choose a suit for your eight');
    }
    hand.splice(index, 1);
    state.discard.push(card);
    state.activeSuit = card.rank === 8 ? action.suit : card.suit;
    state.emptyPasses = 0;
    if (hand.length === 0) {
      state.scores[player] += 1;
      finish(state, player, 'All cards played');
    } else nextTurn(state);
  } else if (action.kind === 'draw') {
    if (state.drawn[player]) return rejected('You already drew this turn');
    if (hand.some(card => canPlay(card, top, state.activeSuit))) return rejected('Play a matching card before drawing');
    if (!state.deck.length && state.discard.length > 1) {
      state.deck = shuffle(state.discard.slice(0, -1), randomSources.get(state) || Math.random);
      state.discard = [top];
    }
    if (state.deck.length) {
      hand.push(state.deck.pop());
      state.emptyPasses = 0;
    }
    state.drawn[player] = true;
  } else if (action.kind === 'pass') {
    if (!state.drawn[player]) return rejected('Draw once before passing');
    if (!state.deck.length && state.discard.length <= 1) state.emptyPasses += 1;
    else state.emptyPasses = 0;
    if (state.emptyPasses >= 2 && state.hands.every(cards => !cards.some(card => canPlay(card, top, state.activeSuit)))) {
      const points = state.hands.map(remainingPoints);
      const winner = points[0] === points[1] ? null : points[0] < points[1] ? 0 : 1;
      if (winner !== null) state.scores[winner] += 1;
      finish(state, winner, 'No cards can be played; lowest remaining points wins');
    } else nextTurn(state);
  } else return rejected('Unknown Crazy Eights action');
  return { ok: true };
}

function applyTwentyOne(state, player, action) {
  if (state.stood[player]) return rejected('Your hand is already finished');
  if (action.kind === 'hit') {
    if (!state.deck.length) return rejected('The deck is empty');
    state.hands[player].push(state.deck.pop());
    if (cardTotal(state.hands[player]) >= 21) state.stood[player] = true;
  } else if (action.kind === 'stand') state.stood[player] = true;
  else return rejected('Choose hit or stand');
  resolveTwentyOne(state);
  return { ok: true };
}

function applyMemory(state, player, action) {
  if (state.turn !== player) return rejected('Wait for your turn');
  if (state.mismatchTicks > 0) return rejected('Wait for these cards to turn over');
  if (action.kind !== 'flip') return rejected('Choose a card to flip');
  const index = action.index;
  if (!Number.isInteger(index) || index < 0 || index >= 32) return rejected('Invalid card position');
  if (state.matched[index] !== null || state.revealed.includes(index)) return rejected('That card is already face up');
  state.revealed.push(index);
  if (state.revealed.length === 2) {
    const [first, second] = state.revealed;
    const a = state.board[first];
    const b = state.board[second];
    if (a.rank === b.rank && a.suit === b.suit) {
      state.matched[first] = player;
      state.matched[second] = player;
      state.revealed = [];
      state.scores[player] += 1;
      if (state.scores[0] + state.scores[1] === 16) {
        const winner = state.scores[0] === state.scores[1] ? null : state.scores[0] > state.scores[1] ? 0 : 1;
        finish(state, winner, 'All pairs found');
      }
    } else state.mismatchTicks = 120;
  }
  return { ok: true };
}

export function applyAction(state, player, action) {
  if (!isPlayer(player)) return rejected('Invalid player');
  if (state.phase !== 'fight') return rejected('The hand is not active');
  if (!action || typeof action !== 'object' || Array.isArray(action)) return rejected('Invalid card action');
  if (action.revision !== undefined && action.revision !== state.revision) return rejected('That action is stale; try again');
  if (state.gameId === 'twenty-one' && action.round !== undefined && action.round !== state.round) {
    return rejected('That action belongs to a previous hand; try again');
  }
  const result = state.gameId === 'crazy-eights' ? applyCrazyEights(state, player, action)
    : state.gameId === 'twenty-one' ? applyTwentyOne(state, player, action)
      : applyMemory(state, player, action);
  if (result.ok) state.revision += 1;
  return result;
}

/** Build a new allow-listed snapshot for this player; hidden cards have no IDs or values. */
export function viewForPlayer(state, player) {
  const view = {
    gameId: state.gameId, tick: state.tick, phase: state.phase, phaseTicks: state.phaseTicks,
    revision: state.revision, handCounts: state.hands ? state.hands.map(hand => hand.length) : [0, 0],
    scores: [...state.scores], winner: state.winner, result: state.result, reason: state.reason,
    round: state.round, maxRounds: state.maxRounds,
  };
  if (state.gameId === 'crazy-eights') {
    Object.assign(view, {
      hands: state.hands.map((hand, owner) => hand.map(card => owner === player ? cardCopy(card) : null)),
      turn: state.turn, topCard: cardCopy(state.discard.at(-1)), activeSuit: state.activeSuit,
      deckCount: state.deck.length, drawn: [...state.drawn],
    });
  } else if (state.gameId === 'twenty-one') {
    const reveal = state.phase === 'roundEnd' || state.phase === 'matchEnd';
    Object.assign(view, {
      hands: state.hands.map((hand, owner) => hand.map(card => reveal || owner === player ? cardCopy(card) : null)),
      totals: state.hands.map((hand, owner) => reveal || owner === player ? cardTotal(hand) : null),
      stood: [...state.stood], roundWinner: state.roundWinner, roundOutcome: state.roundOutcome,
      deckCount: state.deck.length, turn: null,
    });
  } else {
    Object.assign(view, {
      cards: state.board.map((card, index) => state.matched[index] !== null || state.revealed.includes(index) ? cardCopy(card) : null),
      matched: [...state.matched], revealed: [...state.revealed], turn: state.turn,
      mismatchTicks: state.mismatchTicks, pairsRemaining: 16 - state.scores[0] - state.scores[1],
    });
  }
  return view;
}
