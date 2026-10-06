const SUITS = [
  { symbol: '♠', name: 'spades' }, { symbol: '♥', name: 'hearts' },
  { symbol: '♣', name: 'clubs' }, { symbol: '♦', name: 'diamonds' },
];
const SUIT_PATHS = [
  '<path d="M16 2C10 9 2 13 2 21c0 9 10 11 14 4 4 7 14 5 14-4C30 13 22 9 16 2zm-3 23-3 9h12l-3-9z"/>',
  '<path d="M16 32 4 19C-7 7 8-3 16 8 24-3 39 7 28 19z"/>',
  '<circle cx="16" cy="9" r="8"/><circle cx="8" cy="21" r="8"/><circle cx="24" cy="21" r="8"/><path d="m13 23-3 11h12l-3-11z"/>',
  '<path d="m16 1 15 17-15 17L1 18z"/>',
];
function suitArt(suit, className = '') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 32 36'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('class', className); svg.innerHTML = SUIT_PATHS[suit] || SUIT_PATHS[0]; return svg;
}
function showSuit(node, suit) { const key = String(suit); if (node.dataset.suitArt === key) return; node.dataset.suitArt = key; node.replaceChildren(suitArt(suit)); }
const PIP_POSITIONS = {
  1: [[50,50]], 2: [[50,20],[50,80]], 3: [[50,18],[50,50],[50,82]],
  4: [[25,20],[75,20],[25,80],[75,80]], 5: [[25,18],[75,18],[50,50],[25,82],[75,82]],
  6: [[25,17],[75,17],[25,50],[75,50],[25,83],[75,83]],
  7: [[25,17],[75,17],[50,33],[25,50],[75,50],[25,83],[75,83]],
  8: [[25,15],[75,15],[50,34],[25,50],[75,50],[50,66],[25,85],[75,85]],
  9: [[25,14],[75,14],[25,38],[75,38],[50,50],[25,62],[75,62],[25,86],[75,86]],
  10: [[25,10],[75,10],[50,28],[25,36],[75,36],[25,64],[75,64],[50,72],[25,90],[75,90]],
};
function royalArt(rank) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 44 60'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('class', 'card-court-art');
  const hat = rank === 11 ? '<path d="m10 14 22-8 5 12H9z"/><path d="m30 7 4-7 5 3-5 8z" opacity=".5"/>' : '<path d="m10 6 7 6 5-9 5 9 7-6-3 13H13z"/>';
  svg.innerHTML = `<path d="M4 2h36v56H4z" fill="none" stroke="currentColor" stroke-width="1" opacity=".25"/>${hat}<path d="M14 20h16v17H14z" opacity=".35"/><path d="M10 37h24l4 16H6z" opacity=".85"/><path d="m18 39 4 10 4-10" fill="#e6d5a6"/><path d="M17 25h3v3h-3zm8 0h3v3h-3z"/>${rank === 13 ? '<path d="m17 30 5 10 5-10z" opacity=".8"/>' : '<path d="M18 32h8v2h-8z"/>'}<path d="M7 49h30M22 51v5" fill="none" stroke="#d7bd79" stroke-width="2"/>`;
  return svg;
}
const TITLES = { 'crazy-eights': 'Crazy Eights', 'twenty-one': '21 Duel', memory: 'Memory Match' };
const rankLabel = rank => ({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' })[rank] || String(rank);
const cardName = card => `${({ 1: 'Ace', 11: 'Jack', 12: 'Queen', 13: 'King' })[card.rank] || card.rank} of ${SUITS[card.suit]?.name || 'cards'}`;
const playableCard = (card, state) => card && (card.rank === 8 || card.rank === state.topCard?.rank || card.suit === state.activeSuit);
const setText = (node, value) => { const text = String(value); if (node.textContent !== text) node.textContent = text; };
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function button(className, text, action) {
  const node = element('button', className, text);
  node.type = 'button';
  if (action) node.dataset.action = action;
  return node;
}
function visibleKey(state, localId, players) {
  return JSON.stringify({
    gameId: state.gameId, phase: state.phase, revision: state.revision, localId,
    countdown: ['countdown', 'roundEnd'].includes(state.phase) ? Math.ceil(state.phaseTicks / 120) : null,
    hands: state.hands, handCounts: state.handCounts, topCard: state.topCard, activeSuit: state.activeSuit,
    deckCount: state.deckCount, drawn: state.drawn, turn: state.turn, totals: state.totals, stood: state.stood,
    cards: state.cards, matched: state.matched, revealed: state.revealed,
    mismatch: state.mismatchTicks > 0, pairsRemaining: state.pairsRemaining,
    scores: state.scores, winner: state.winner, result: state.result, round: state.round,
    roundWinner: state.roundWinner, roundOutcome: state.roundOutcome,
    players: players?.map(player => ({ name: player?.name, connected: player?.connected })),
  });
}
const ownHandKey = (state, localId) => JSON.stringify({
  phase: state.phase, round: state.round, hand: state.hands?.[localId],
  total: state.totals?.[localId], stood: state.stood?.[localId],
});

/** A server-driven card table. Concealed snapshots are rendered only as card backs. */
export class CardsView {
  constructor(container, { onAction = () => {} } = {}) {
    this.container = container;
    this.onAction = onAction;
    this.state = null;
    this.localId = null;
    this.players = [];
    this.lastKey = null;
    this.pending = null;
    this.selected = null;
    this.focused = 0;
    this.memoryNodes = [];
    this.publicTrail = [];
    this.roundHistory = [];
    this.lastObservedRevision = null;
    this.element = element('section', 'cards-view');
    this.element.setAttribute('aria-label', 'Card table');
    this.topline = element('div', 'cards-topline');
    this.tableLabel = element('span', 'cards-table-label', 'FIRESIDE CARD ROOM');
    this.progress = element('span', 'cards-progress');
    this.topline.append(this.tableLabel, this.progress);
    this.surface = element('div', 'cards-surface');
    this.notice = element('p', 'cards-status');
    this.notice.setAttribute('role', 'status');
    this.notice.setAttribute('aria-live', 'polite');
    this.notice.setAttribute('aria-atomic', 'true');
    this.hint = element('p', 'cards-hint');
    this.context = element('section', 'cards-context'); this.context.setAttribute('aria-label', 'Public match progress');
    this.element.append(this.topline, this.surface, this.notice, this.hint, this.context);
    this.container.append(this.element);
    this.clickHandler = event => this.choose(event);
    this.keyHandler = event => this.navigate(event);
    this.focusHandler = event => {
      if (event.target.matches('button[data-index]')) {
        this.focused = Number(event.target.dataset.index);
        this.updateTabStops();
      }
    };
    this.element.addEventListener('click', this.clickHandler);
    this.element.addEventListener('keydown', this.keyHandler);
    this.element.addEventListener('focusin', this.focusHandler);
  }

  build(gameId) {
    this.gameId = gameId;
    this.element.dataset.game = gameId;
    this.surface.replaceChildren();
    this.memoryNodes = [];
    this.suitPicker = null;
    this.selected = null;
    this.pending = null;
    this.publicTrail = []; this.roundHistory = []; this.lastObservedRevision = null;
    if (gameId === 'memory') {
      this.memoryScores = element('div', 'memory-scores');
      this.scorePanels = [0, 1].map(id => {
        const panel = element('div', `memory-player memory-player-${id}`);
        const name = element('strong', 'memory-player-name');
        const score = element('span', 'memory-player-score');
        panel.append(name, score);
        this.memoryScores.append(panel);
        return { panel, name, score };
      });
      this.grid = element('div', 'memory-grid');
      this.grid.setAttribute('role', 'group');
      this.grid.setAttribute('aria-label', 'Memory board. Use arrow keys to explore cards. Enter or Space flips a card.');
      for (let index = 0; index < 32; index += 1) {
        const card = button('playing-card memory-card');
        card.dataset.index = String(index);
        card.tabIndex = index === this.focused ? 0 : -1;
        this.memoryNodes.push(card);
        this.grid.append(card);
      }
      this.surface.append(this.memoryScores, this.grid);
      return;
    }
    this.opponent = this.createHand(false);
    this.own = this.createHand(true);
    this.center = element('div', 'cards-center');
    if (gameId === 'crazy-eights') {
      this.drawButton = button('playing-card card-back draw-pile', undefined, 'draw');
      this.drawButton.setAttribute('aria-label', 'Draw a card');
      this.paintCard(this.drawButton, null);
      this.drawLabel = element('span', 'cards-pile-label');
      const drawStack = element('div', 'cards-pile');
      drawStack.append(this.drawButton, this.drawLabel);
      this.discard = element('div', 'playing-card discard-card');
      this.discard.setAttribute('role', 'img');
      this.discardLabel = element('span', 'cards-pile-label', 'DISCARD');
      const discardStack = element('div', 'cards-pile');
      discardStack.append(this.discard, this.discardLabel);
      this.activeSuit = element('div', 'cards-active-suit');
      this.activeSuitSymbol = element('span', 'active-suit-symbol');
      this.activeSuitText = element('span');
      this.activeSuit.append(this.activeSuitSymbol, this.activeSuitText);
      this.center.append(drawStack, discardStack, this.activeSuit);
      this.suitPicker = element('div', 'cards-suit-picker');
      this.suitPicker.hidden = true;
      this.suitPicker.setAttribute('role', 'group');
      this.suitPicker.setAttribute('aria-label', 'Choose the suit for your wild eight');
      const title = element('span', 'suit-picker-title', 'Wild eight. Choose the next suit:');
      const choices = element('div', 'suit-choices');
      SUITS.forEach((suit, id) => {
        const choice = button(`suit-choice${id % 2 ? ' is-red' : ''}`);
        choice.dataset.suit = String(id);
        choice.setAttribute('aria-label', `Play eight and choose ${suit.name}`);
        const symbol = element('span', 'suit-choice-symbol'); symbol.append(suitArt(id)); choice.append(symbol, element('span', '', suit.name));
        choices.append(choice);
      });
      this.cancelSuit = button('cards-text-button', 'Cancel', 'cancel');
      this.suitPicker.append(title, choices, this.cancelSuit);
      this.passButton = button('cards-action cards-secondary', 'Pass turn', 'pass');
      this.own.actions.append(this.passButton);
    } else {
      this.target = element('div', 'cards-target');
      this.target.append(element('span', '', 'THE SWEET SPOT'), element('strong', '', '21'), element('span', '', 'ACES COUNT AS 1 OR 11'));
      this.center.append(this.target);
      this.hitButton = button('cards-action', 'Hit · draw a card', 'hit');
      this.standButton = button('cards-action cards-secondary', 'Stand · keep your hand', 'stand');
      this.own.actions.append(this.hitButton, this.standButton);
    }
    this.surface.append(this.opponent.section, this.center);
    if (this.suitPicker) this.surface.append(this.suitPicker);
    this.surface.append(this.own.section);
  }

  createHand(own) {
    const section = element('section', `cards-hand-section${own ? ' is-local' : ' is-opponent'}`);
    const heading = element('div', 'cards-hand-heading');
    const name = element('h3');
    const badge = element('span', 'cards-hand-badge');
    heading.append(name, badge);
    const cards = element('div', own ? 'cards-hand local-hand' : 'cards-hand opponent-hand');
    cards.setAttribute('role', 'group');
    cards.setAttribute('aria-label', own ? 'Your hand' : 'Opponent hand');
    const actions = element('div', 'cards-actions');
    section.append(heading, cards);
    if (own) section.append(actions);
    return { section, heading, name, badge, cards, actions, nodes: new Map() };
  }

  paintCard(node, card, placeholder = false) {
    const key = card ? `${card.id}:${card.rank}:${card.suit}` : placeholder ? 'placeholder' : 'hidden';
    if (node.dataset.face === key) return;
    node.dataset.face = key;
    node.classList.toggle('card-back', !card);
    node.classList.toggle('is-red', Boolean(card && card.suit % 2));
    node.classList.toggle('is-wild', Boolean(card && this.gameId === 'crazy-eights' && card.rank === 8));
    node.classList.toggle('is-placeholder', placeholder);
    node.replaceChildren();
    if (!card) {
      const pattern = element('span', 'card-back-pattern');
      pattern.setAttribute('aria-hidden', 'true');
      pattern.append(element('span', 'card-back-emblem', '✦'));
      node.append(pattern);
      return;
    }
    const rank = rankLabel(card.rank), suit = SUITS[card.suit]?.symbol || '•';
    const top = element('span', 'card-corner');
    const cornerSuit = element('span'); cornerSuit.append(suitArt(card.suit)); top.append(element('b', '', rank), cornerSuit);
    const bottom = top.cloneNode(true);
    bottom.classList.add('card-corner-bottom');
    const face = element('span', 'card-face');
    if (card.rank > 10) face.append(royalArt(card.rank));
    else for (const [x, y] of PIP_POSITIONS[card.rank] || [[50,50]]) { const pip = suitArt(card.suit, `card-pip${card.rank === 1 ? ' card-pip-ace' : ''}${y > 50 ? ' is-inverted' : ''}`); pip.style.left = `${x}%`; pip.style.top = `${y}%`; face.append(pip); }
    if (card.rank === 8 && this.gameId === 'crazy-eights') node.append(element('span', 'card-wild-label', 'WILD'));
    top.setAttribute('aria-hidden', 'true');
    bottom.setAttribute('aria-hidden', 'true');
    face.setAttribute('aria-hidden', 'true');
    node.append(top, face, bottom);
  }

  name(id) {
    const text = this.players?.[id]?.name;
    return typeof text === 'string' && text.trim() ? text.trim().slice(0, 24) : `Player ${id + 1}`;
  }

  render(state, { localId = null, players = [] } = {}) {
    if (!state || !TITLES[state.gameId]) return;
    const key = visibleKey(state, localId, players);
    const previous = this.state;
    this.state = state;
    this.localId = localId;
    this.players = players;
    if (key === this.lastKey) return;
    if (this.gameId !== state.gameId) this.build(state.gameId);
    this.observePublic(previous, state);
    if (this.pending !== null && (state.gameId === 'twenty-one'
      ? this.pending.ownHand !== ownHandKey(state, localId)
      : this.pending.revision !== state.revision)) this.pending = null;
    if (state.phase !== 'fight' || state.turn !== localId || !state.hands?.[localId]?.some(card => card?.id === this.selected)) this.selected = null;
    this.lastKey = key;
    this.paint();
  }

  paintHand(handView, id, own) {
    const state = this.state;
    const showdown = ['roundEnd', 'matchEnd'].includes(state.phase);
    const cards = state.hands?.[id] || [];
    const count = state.handCounts?.[id] ?? cards.length;
    const concealed = !own && !cards.some(Boolean);
    setText(handView.name, `${this.name(id)}${own ? ' · you' : ''}`);
    handView.section.classList.toggle('is-active', state.phase === 'fight' && (this.gameId === 'twenty-one' ? !state.stood?.[id] : state.turn === id));
    handView.section.classList.toggle('is-winner', showdown && state.roundWinner === id || state.phase === 'matchEnd' && state.winner === id);
    if (this.gameId === 'twenty-one') {
      const total = state.totals?.[id];
      const minimum = cards.reduce((sum, card) => sum + (card ? Math.min(card.rank, 10) : 0), 0);
      const soft = total != null && cards.some(card => card?.rank === 1) && minimum + 10 === total;
      const totalText = total == null ? 'TOTAL HIDDEN' : total > 21 ? `${total} · BUST` : total === 21 ? '21 · PERFECT' : `${total} POINTS${soft ? ' · SOFT ACE' : ''}`;
      setText(handView.badge, `${totalText}${state.stood?.[id] && state.phase === 'fight' ? ' · STOOD' : ''}`);
      handView.badge.classList.toggle('is-bust', total != null && total > 21);
    } else setText(handView.badge, `${count} CARD${count === 1 ? '' : 'S'}`);
    const shown = concealed ? Array.from({ length: Math.min(count, 9) }, () => null) : cards;
    const inLobby = ['lobby', 'countdown'].includes(state.phase) && !shown.length;
    const displayed = inLobby ? [null, null] : shown;
    const focusedNode = handView.cards.contains(document.activeElement) ? document.activeElement : null;
    const focusedIndex = focusedNode ? [...handView.cards.children].indexOf(focusedNode) : -1;
    const wanted = new Set();
    displayed.forEach((card, index) => {
      const key = card ? String(card.id) : `hidden-${index}`;
      wanted.add(key);
      let node = handView.nodes.get(key);
      if (!node) {
        node = own && this.gameId === 'crazy-eights' ? button('playing-card hand-card') : element('div', 'playing-card hand-card');
        if (node.tagName !== 'BUTTON') node.setAttribute('role', 'img');
        handView.nodes.set(key, node);
      }
      this.paintCard(node, card, inLobby);
      if (card && own) node.dataset.cardId = card.id;
      else delete node.dataset.cardId;
      const playable = own && this.gameId === 'crazy-eights' && this.canAct() && card && playableCard(card, state);
      node.classList.toggle('is-playable', Boolean(playable));
      node.classList.toggle('is-selected', card?.id === this.selected);
      node.setAttribute('aria-label', card ? `${cardName(card)}${playable ? ', playable' : ''}${card.id === this.selected ? ', choosing suit' : ''}` : inLobby ? 'Cards will be dealt when the game begins' : 'Concealed opponent card');
      if (node.tagName === 'BUTTON') node.setAttribute('aria-disabled', String(!playable));
      if (handView.cards.children[index] !== node) handView.cards.insertBefore(node, handView.cards.children[index] || null);
    });
    for (const [key, node] of handView.nodes) {
      if (!wanted.has(key)) { node.remove(); handView.nodes.delete(key); }
    }
    if (focusedNode && !focusedNode.isConnected) {
      handView.cards.children[Math.min(focusedIndex, handView.cards.children.length - 1)]?.focus?.({ preventScroll: true });
    }
    if (concealed && count > 9) handView.cards.dataset.extra = `+${count - 9}`;
    else delete handView.cards.dataset.extra;
    handView.cards.classList.toggle('is-empty', !displayed.length);
  }

  canAct() {
    return this.state?.phase === 'fight' && (this.localId === 0 || this.localId === 1) && this.pending === null && (this.gameId === 'twenty-one' ? !this.state.stood?.[this.localId] : this.state.turn === this.localId);
  }

  paint() {
    const state = this.state;
    if (!state) return;
    this.element.classList.toggle('is-your-turn', this.canAct());
    this.element.classList.toggle('is-pending', this.pending !== null);
    setText(this.progress, this.gameId === 'twenty-one' ? `HAND ${state.round || 1} / ${state.maxRounds || 5}` : this.gameId === 'memory' ? `${state.pairsRemaining ?? 16} PAIRS LEFT` : 'SHED YOUR HAND');
    if (this.gameId === 'memory') this.paintMemory();
    else {
      const ownId = this.localId === 1 ? 1 : 0;
      this.paintHand(this.opponent, 1 - ownId, false);
      this.paintHand(this.own, ownId, this.localId !== null);
      if (this.gameId === 'crazy-eights') {
        this.paintCard(this.discard, state.topCard, !state.topCard);
        this.discard.setAttribute('aria-label', state.topCard ? `Top discard: ${cardName(state.topCard)}` : 'Discard pile. No cards dealt yet.');
        setText(this.drawLabel, `DRAW · ${state.deckCount || 0}`);
        const suit = SUITS[state.activeSuit];
        if (suit) showSuit(this.activeSuitSymbol, state.activeSuit); else setText(this.activeSuitSymbol, '—');
        setText(this.activeSuitText, suit ? `${suit.name.toUpperCase()} IN PLAY` : 'YOUR NEXT GAME');
        this.activeSuit.classList.toggle('is-red', Boolean(state.activeSuit % 2));
        const hand = state.hands?.[this.localId] || [];
        const legal = hand.some(card => playableCard(card, state));
        this.drawButton.disabled = !this.canAct() || legal || Boolean(state.drawn?.[this.localId]);
        this.drawButton.setAttribute('aria-label', `Draw one card, ${state.deckCount || 0} in deck${legal ? '. Play a matching card first.' : ''}`);
        this.passButton.hidden = !state.drawn?.[this.localId];
        this.passButton.disabled = !this.canAct();
        this.suitPicker.hidden = !this.selected;
        for (const choice of this.suitPicker.querySelectorAll('button[data-suit]')) choice.disabled = !this.canAct();
      } else {
        this.hitButton.disabled = !this.canAct();
        this.standButton.disabled = !this.canAct();
      }
    }
    this.paintNotice();
    this.paintContext();
  }

  paintMemory() {
    const state = this.state;
    this.scorePanels.forEach(({ panel, name, score }, id) => {
      setText(name, `${this.name(id)}${id === this.localId ? ' · you' : ''}`);
      const pairs = state.scores?.[id] || 0;
      setText(score, `${pairs} PAIR${pairs === 1 ? '' : 'S'}`);
      panel.classList.toggle('is-active', state.phase === 'fight' && state.turn === id);
    });
    const revealed = new Set(state.revealed || []);
    this.memoryNodes.forEach((node, index) => {
      const matched = state.matched?.[index];
      const claimed = matched === 0 || matched === 1;
      const card = state.cards?.[index];
      this.paintCard(node, card);
      node.classList.toggle('is-matched', claimed);
      node.classList.toggle('matched-by-0', matched === 0);
      node.classList.toggle('matched-by-1', matched === 1);
      node.classList.toggle('is-revealed', revealed.has(index));
      const canFlip = this.canAct() && !state.mismatchTicks && !claimed && !card && (state.revealed?.length || 0) < 2;
      node.setAttribute('aria-disabled', String(!canFlip));
      node.setAttribute('aria-label', `Card ${index + 1}, ${card ? cardName(card) : 'face down'}${claimed ? `, matched by ${this.name(matched)}` : revealed.has(index) ? ', revealed' : canFlip ? ', flip to reveal' : ''}`);
    });
    this.updateTabStops();
  }

  observePublic(previous, state) {
    if (['lobby', 'countdown'].includes(state.phase) && previous && !['lobby', 'countdown'].includes(previous.phase)) { this.publicTrail = []; this.roundHistory = []; this.lastObservedRevision = null; }
    if (state.revision === this.lastObservedRevision) return;
    this.lastObservedRevision = state.revision;
    if (state.gameId === 'twenty-one' && ['roundEnd', 'matchEnd'].includes(state.phase) && state.totals?.every(total => typeof total === 'number') && !this.roundHistory.some(hand => hand.round === state.round)) this.roundHistory.push({ round: state.round, totals: [...state.totals], winner: state.roundWinner });
    if (!previous || previous.gameId !== state.gameId || !['fight', 'matchEnd'].includes(state.phase) || previous.phase !== 'fight') return;
    let text;
    if (state.gameId === 'crazy-eights') {
      const actor = previous.turn;
      if (state.topCard?.id !== previous.topCard?.id) text = `${this.name(actor)} played ${cardName(state.topCard)}${state.topCard.rank === 8 ? ` · ${SUITS[state.activeSuit].name} chosen` : ''}.`;
      else { const drawn = [0,1].find(id => state.handCounts[id] > previous.handCounts[id]); if (drawn !== undefined) text = `${this.name(drawn)} drew one card.`; else if (state.turn !== previous.turn) text = `${this.name(actor)} passed.`; }
    } else if (state.gameId === 'memory') {
      if (state.mismatchTicks > 0 && !previous.mismatchTicks) text = `Cards ${(state.revealed || []).map(index => index + 1).join(' + ')} did not match. The turn changes after the reveal.`;
      const claimed = state.matched?.findIndex((owner, index) => owner !== null && previous.matched?.[index] === null);
      if (claimed >= 0 && state.cards[claimed]) text = `${this.name(state.matched[claimed])} claimed a pair of ${cardName(state.cards[claimed])}. Another turn earned.`;
    }
    if (text) { this.publicTrail.push(text); if (this.publicTrail.length > 4) this.publicTrail.shift(); }
  }

  paintContext() {
    const state = this.state; this.context.replaceChildren();
    if (this.gameId === 'twenty-one') {
      const score = element('div', 'cards-match-score');
      for (const id of [0,1]) { const side = element('span'); side.append(element('strong', '', this.name(id)), element('b', '', `${state.scores?.[id] || 0} hands`)); score.append(side); }
      this.context.append(score);
      const own = state.totals?.[this.localId];
      if (state.phase === 'fight' && typeof own === 'number') this.context.append(element('p', 'cards-decision-guide', own > 21 ? 'Your hand is over 21. The other player still completes their decision.' : own === 21 ? 'Exactly 21. Your hand stands automatically.' : `${21 - own} points of room before 21. A face card adds 10; an Ace adjusts to 1 or 11.`));
      const ledger = element('div', 'cards-hand-ledger'); ledger.setAttribute('aria-label', 'Five-hand public results');
      for (let i = 1; i <= (state.maxRounds || 5); i++) {
        const hand = this.roundHistory.find(h => h.round === i); const entry = element('span', `cards-ledger-entry${i === state.round ? ' is-current' : ''}${hand ? ' is-complete' : ''}`);
        entry.append(element('small', '', `HAND ${i}`), element('strong', '', hand ? `${hand.totals[0]} : ${hand.totals[1]}` : i === state.round && state.phase === 'fight' ? 'IN PLAY' : '—'), element('span', '', hand ? hand.winner === null ? 'DRAW' : `${this.name(hand.winner)} wins` : '')); ledger.append(entry);
      }
      this.context.append(ledger);
    } else if (this.gameId === 'memory') {
      const scores = state.scores || [0,0]; const difference = scores[0] - scores[1]; const title = element('div', 'cards-collection-heading');
      title.append(element('strong', '', 'Claimed pairs'), element('span', '', difference ? `${this.name(difference > 0 ? 0 : 1)} leads by ${Math.abs(difference)}` : 'LEVEL MATCH')); this.context.append(title);
      const gallery = element('div', 'cards-pair-gallery'); const seen = new Set();
      (state.cards || []).forEach((card, index) => { const owner = state.matched?.[index]; if (!card || owner === null || owner === undefined) return; const key = `${card.rank}:${card.suit}`; if (seen.has(key)) return; seen.add(key); const item = element('span', `cards-claimed-pair claimed-by-${owner}`); item.append(element('b', '', rankLabel(card.rank)), suitArt(card.suit)); item.setAttribute('role', 'img'); item.setAttribute('aria-label', `${this.name(owner)}: pair of ${cardName(card)}`); item.title = `${this.name(owner)} · ${cardName(card)}`; gallery.append(item); });
      if (!seen.size) gallery.append(element('span', 'cards-no-pairs', 'Find your first pair. Matched cards stay visible.')); this.context.append(gallery);
    } else {
      const own = state.hands?.[this.localId] || []; const legal = own.filter(card => playableCard(card, state));
      if (state.phase === 'fight' && this.localId !== null) this.context.append(element('p', 'cards-decision-guide', `${legal.length} matching card${legal.length === 1 ? '' : 's'} in your hand. ${own.filter(c => c.rank === 8).length ? 'Save a wild eight to change the suit when it matters.' : 'Plan your next suit; keep your opponent’s hand count in mind.'}`));
    }
    if (this.publicTrail.length) { const list = element('ol', 'cards-public-trail'); for (const text of this.publicTrail.slice(-3).reverse()) list.append(element('li', '', text)); this.context.append(list); }
  }

  paintNotice() {
    const state = this.state;
    let notice = 'Both players ready up to shuffle and begin.';
    let hint = this.gameId === 'crazy-eights' ? 'Match the rank or suit. Eights are wild. The first empty hand wins.' : this.gameId === 'twenty-one' ? 'Get closer to 21 than your friend. Go over and you bust. Five hands, most wins.' : 'Find identical pairs. A match earns another turn. Most pairs wins.';
    if (state.phase === 'countdown') notice = `Shuffling. Cards on the table in ${Math.ceil(state.phaseTicks / 120)}…`;
    else if (state.phase === 'matchEnd') {
      notice = state.winner == null ? 'An even match. Ready up to play again.' : `${this.name(state.winner)} wins${this.gameId === 'memory' ? ` with ${state.scores?.[state.winner] || 0} pairs` : ''}. Ready up for a rematch.`;
    } else if (state.phase === 'roundEnd') {
      notice = state.roundWinner == null ? 'This hand is a draw.' : `${this.name(state.roundWinner)} takes the hand.`;
      hint = `The next hand is dealt in ${Math.ceil(state.phaseTicks / 120)}… Both hands are revealed.`;
    } else if (state.phase === 'fight') {
      if (this.pending !== null) notice = 'Your move is on its way…';
      else if (this.localId === null) notice = 'Take a seat to play. Your friend’s cards stay concealed.';
      else if (this.gameId === 'twenty-one') {
        const total = state.totals?.[this.localId];
        if (state.stood?.[this.localId]) notice = total > 21 ? 'You busted. Waiting for the other hand.' : 'You stood. Waiting for your friend to finish.';
        else notice = 'Your call. Hit for another card, or stand with your total.';
        hint = 'Play at your own pace. Your hand stays private until both players stand.';
      } else if (this.gameId === 'memory' && state.mismatchTicks) notice = 'Not a pair. Take a moment to remember these cards.';
      else if (state.turn !== this.localId) notice = `${this.name(state.turn)}’s turn. Watch the table.`;
      else if (this.gameId === 'memory') notice = state.revealed?.length === 1 ? 'Choose a second card to find its match.' : 'Your turn. Flip a card and find its twin.';
      else if (this.selected) notice = 'Your eight is wild. Choose the suit below the discard.';
      else if (state.drawn?.[this.localId]) notice = (state.hands?.[this.localId] || []).some(card => playableCard(card, state)) ? 'Play a matching card, or pass your turn.' : 'No match after drawing. Pass your turn.';
      else notice = (state.hands?.[this.localId] || []).some(card => playableCard(card, state)) ? 'Your turn. Play a highlighted card.' : 'No match in your hand. Draw one card from the deck.';
    }
    setText(this.notice, notice);
    setText(this.hint, hint);
  }

  submit(action) {
    if (!this.canAct()) return;
    const selected = this.selected;
    this.pending = { revision: this.state.revision, ownHand: ownHandKey(this.state, this.localId) };
    this.selected = null;
    this.paint();
    if (selected) this.own?.nodes.get(selected)?.focus({ preventScroll: true });
    this.onAction({ ...action, ...(this.gameId === 'twenty-one' ? { round: this.state.round } : { revision: this.state.revision }) });
  }

  choose(event) {
    const target = event.target.closest('button');
    if (!target || !this.element.contains(target) || target.disabled) return;
    const action = target.dataset.action;
    if (action === 'cancel') {
      const selected = this.selected;
      this.resetSelection();
      this.own?.nodes.get(selected)?.focus({ preventScroll: true });
      return;
    }
    if (!this.canAct()) return;
    if (target.dataset.suit !== undefined) {
      const card = this.state.hands?.[this.localId]?.find(item => item?.id === this.selected);
      if (card?.rank === 8) this.submit({ kind: 'play', cardId: card.id, suit: Number(target.dataset.suit) });
    } else if (target.dataset.cardId) {
      const card = this.state.hands?.[this.localId]?.find(item => item?.id === target.dataset.cardId);
      if (!playableCard(card, this.state)) return;
      if (card.rank === 8) {
        this.selected = card.id;
        this.paint();
        this.suitPicker.querySelector('button[data-suit]')?.focus({ preventScroll: true });
      } else this.submit({ kind: 'play', cardId: card.id });
    } else if (target.dataset.index !== undefined) {
      const index = Number(target.dataset.index);
      if (!this.state.cards?.[index] && this.state.matched?.[index] == null && !this.state.mismatchTicks && (this.state.revealed?.length || 0) < 2) this.submit({ kind: 'flip', index });
    } else if (['draw', 'pass', 'hit', 'stand'].includes(action)) this.submit({ kind: action });
  }

  updateTabStops() {
    this.memoryNodes.forEach((node, index) => { node.tabIndex = index === this.focused ? 0 : -1; });
  }

  navigate(event) {
    if (event.key === 'Escape' && this.selected) {
      const selected = this.selected;
      this.resetSelection();
      this.own?.nodes.get(selected)?.focus({ preventScroll: true });
      event.preventDefault();
      return;
    }
    if (!event.target.matches('button[data-index]')) return;
    const index = Number(event.target.dataset.index);
    const columns = getComputedStyle(this.grid).gridTemplateColumns.split(' ').length;
    let next = index;
    if (event.key === 'ArrowLeft') next = Math.max(Math.floor(index / columns) * columns, index - 1);
    else if (event.key === 'ArrowRight') next = Math.min(Math.floor(index / columns) * columns + columns - 1, index + 1, 31);
    else if (event.key === 'ArrowUp') next = Math.max(0, index - columns);
    else if (event.key === 'ArrowDown') next = Math.min(31, index + columns);
    else if (event.key === 'Home') next = Math.floor(index / columns) * columns;
    else if (event.key === 'End') next = Math.min(31, Math.floor(index / columns) * columns + columns - 1);
    else return;
    event.preventDefault();
    this.focused = next;
    this.updateTabStops();
    this.memoryNodes[next]?.focus({ preventScroll: true });
  }

  resetSelection() {
    this.selected = null;
    this.pending = null;
    this.lastKey = null;
    this.paint();
  }

  destroy() {
    this.element.removeEventListener('click', this.clickHandler);
    this.element.removeEventListener('keydown', this.keyHandler);
    this.element.removeEventListener('focusin', this.focusHandler);
    this.element.remove();
    this.memoryNodes = [];
  }
}
