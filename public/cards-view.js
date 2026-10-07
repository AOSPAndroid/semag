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
function royalArt(rank, suit = 0) {
  const red = suit % 2; const robe = red ? '#aa6c60' : '#50786c'; const shadow = red ? '#75584c' : '#355b50';
  const headwear = rank === 11 ? '<path d="M11 13q11-11 23 0l-3 6H12z" fill="'+robe+'"/><path d="M31 13q-2-10 7-12-1 10-7 12" fill="#c6b57e"/>' : '<path d="m12 7 6 5 4-9 5 9 6-5-3 11H14z" fill="#c9ab70" stroke="#a78b5b" stroke-width=".8"/><path d="M15 15h14" stroke="#e4cd96" stroke-width="1"/>';
  const hair = rank === 12 ? '<path d="M13 20q-3 9 0 15l4-3v-9m13-3q4 10 0 15l-4-3v-9" fill="#947b50"/>' : '<path d="M13 20h18v6H13z" fill="'+shadow+'"/>';
  const garment = '<path d="M10 36q12-6 24 0l3 17H7z" fill="'+robe+'" stroke="'+shadow+'" stroke-width="1"/><path d="m18 36 4 12 5-12" fill="#e9dbb5"/><path d="M13 38v11m18-11v11M9 52h26" stroke="#d3b47d" stroke-width="1"/><path d="m13 43 2 2-2 2-2-2m18-2 2 2-2 2-2-2" fill="#d2bd84"/>';
  const prop = rank === 12 ? '<path d="M34 49V31m-4 5 4 3 4-3" stroke="#789265" stroke-width="1.2" fill="none"/><circle cx="34" cy="30" r="3" fill="#c59c78"/>' : '<path d="M10 49V26m-3 3h6m-4-4 1-7 2 7" stroke="#b69e6b" stroke-width="1.3" fill="none"/>';
  const portrait = headwear+hair+'<path d="M15 19h14v14l-7 5-7-5z" fill="#d9bd95" stroke="#a48a6a" stroke-width=".7"/><path d="M17 25h3m5 0h3m-6 1v4" stroke="'+shadow+'" stroke-width=".9"/>'+ (rank === 13 ? '<path d="m16 31 6 9 6-9-6 3z" fill="'+shadow+'"/>' : '<path d="M19 32h6" stroke="#aa7e62" stroke-width=".8"/>')+garment+prop;
  return cachedSvg(`court-${rank}-${suit}`,'<path d="M2 1h40v58H2z" fill="#eee4c4" stroke="#cbb680" stroke-width=".8"/><path d="M4 3h36v54H4z" fill="none" stroke="#d8c69d" stroke-width=".5"/>'+portrait+'<path d="M8 55h28" stroke="#c1a56e" stroke-width="1"/>','0 0 44 60','card-court-art');
}
const ART_CACHE = new Map();
const MEMORY_SEALS = [
 {name:'Crescent Moon',art:'<path d="M44 9C18 2 6 35 25 49c13 9 25 5 34-6-23 10-41-14-15-34z" fill="#7898a0"/><path d="M23 25q-9 14 3 23" fill="none" stroke="#d0d7b7" stroke-width="2"/><path d="m50 12 2 6 6 1-5 4 1 6-5-4-6 2 3-5-3-5 6 1z" fill="#c6a566"/>'},
 {name:'Woodland Owl',art:'<path d="m16 18 5-10 11 9 11-9 5 10v21L32 55 16 39z" fill="#7d8f75"/><path d="M17 28q7-15 15-4 8-11 15 4-2 13-15 11-13 2-15-11" fill="#d4c896"/><circle cx="24" cy="28" r="4" fill="#426559"/><circle cx="40" cy="28" r="4" fill="#426559"/><path d="m28 38 4 6 4-6M25 48h14" fill="#b5985c" stroke="#c0ac73" stroke-width="2"/>'},
 {name:'Silk Moth',art:'<path d="M29 29C9 3-1 34 22 44l9-6m4-9C55 3 65 34 42 44l-9-6M28 40c-17 1-13 21 0 12m8-12c17 1 13 21 0 12" fill="#b2937c" stroke="#7b7858" stroke-width="1.4"/><circle cx="16" cy="30" r="5" fill="#5b8275"/><circle cx="48" cy="30" r="5" fill="#5b8275"/><path d="M29 20h6v27h-6M30 19l-6-6m10 6 6-6" fill="#517b6b" stroke="#517b6b" stroke-width="2"/>'},
 {name:'Silver Fir',art:'<path d="m32 6 17 22h-7l14 18H8l14-18h-7z" fill="#63886d"/><path d="M28 44h8v14h-8z" fill="#a88d62"/><path d="m24 23 8 6 8-6m-21 17 13 7 13-7M32 13v31" fill="none" stroke="#b7c89c" stroke-width="2"/>'},
 {name:'Hearth Lantern',art:'<path d="M22 15q10-14 20 0M19 21h26v31H19zM16 18h32v6H16zm0 32h32v6H16z" fill="#607d67" stroke="#a89461" stroke-width="2"/><path d="M24 25h16v23H24z" fill="#dbb575"/><path d="m32 29 6 11-6 8-6-8z" fill="#b57b57"/><path d="M29 24v6m6 14v6" stroke="#ecd098" stroke-width="1"/>'},
 {name:'Copper Fox',art:'<path d="m14 10 17 11 18-11-3 32-15 13-15-13z" fill="#be916c" stroke="#8f7557" stroke-width="1.5"/><path d="m16 25 15 15 16-15-3 18-13 10-13-10z" fill="#e0cfaa"/><path d="m20 27 7 3m10 0 7-3" stroke="#577868" stroke-width="3"/><path d="m28 41 3 4 4-4z" fill="#5e7055"/>'},
 {name:'North Star',art:'<path d="m32 5 8 18 20 9-20 8-8 19-8-19-20-8 20-9z" fill="#c5a56b"/><path d="m32 16 5 12 12 4-12 5-5 12-5-12-12-5 12-4z" fill="#e3d09b"/><path d="M32 22v20M22 32h20" stroke="#789281" stroke-width="2"/>'},
 {name:'Hollow Crown',art:'<path d="m10 17 13 10L32 9l10 18 13-10-7 32H17z" fill="#c5aa72" stroke="#9d8653" stroke-width="1.5"/><path d="M18 45h29v10H18z" fill="#dfc894"/><path d="m32 29 5 7-5 7-5-7z" fill="#708c77"/><path d="M21 51h23" stroke="#a79365" stroke-width="1"/>'},
 {name:'Golden Sun',art:'<circle cx="32" cy="31" r="17" fill="#d3b177"/><circle cx="32" cy="31" r="12" fill="none" stroke="#f1d6a1" stroke-width="1.5"/><path d="M32 3v7m0 43v8M3 31h8m43 0h7M11 10l6 6m31 31 6 6M10 52l6-6m32-31 6-6" stroke="#b99766" stroke-width="3"/><path d="M25 29h3m9 0h3m-12 8h9" stroke="#927d57" stroke-width="2"/>'},
 {name:'Wild Rose',art:'<path d="M32 24C10-2-1 25 21 34-4 50 22 64 32 43c10 21 36 7 11-9C65 25 54-2 32 24z" fill="#b58d89" stroke="#92766b" stroke-width="1.2"/><circle cx="32" cy="33" r="8" fill="#d4bb80"/><circle cx="32" cy="33" r="3" fill="#748469"/><path d="m27 23-3 4m16-4 3 4m-22 14 4-1m14 9-1-5" stroke="#e2b9a9" stroke-width="1.5"/>'},
 {name:'Garden Bee',art:'<path d="M29 27C6 5 8 32 27 36m8-9c23-22 21 5 2 9" fill="#ccd9bd" stroke="#8eaa96" stroke-width="1.3"/><ellipse cx="32" cy="38" rx="11" ry="17" fill="#d0b47a"/><path d="M23 30h18m-21 9h22m-18 9h16" stroke="#758363" stroke-width="4"/><path d="M27 23 21 13m16 10 6-10" stroke="#738d76" stroke-width="2"/><path d="m29 54 3 5 3-5" fill="#758363"/>'},
 {name:'River Leaf',art:'<path d="M13 48C-1 18 30 6 52 11c3 26-14 47-36 40z" fill="#8ba17c" stroke="#6d8c66" stroke-width="1.5"/><path d="M7 57 44 19M22 39l-1-17m10 9 14 1" stroke="#d0d0a1" stroke-width="2"/><path d="M39 40q-6 9 0 11 6-2 0-11z" fill="#d7e2bd"/>'},
 {name:'Forest Mushroom',art:'<path d="M24 32h16l5 25H19z" fill="#d8cca6" stroke="#a6a181" stroke-width="1.5"/><path d="M7 32C11 0 53 0 57 32z" fill="#b3846b" stroke="#866f55" stroke-width="1.6"/><path d="M9 32h46" stroke="#d4b290" stroke-width="3"/><circle cx="23" cy="21" r="4" fill="#dfc99f"/><circle cx="39" cy="17" r="4" fill="#dfc99f"/><path d="M27 40v12m8-12v12" stroke="#bbad86" stroke-width="1"/>'},
 {name:'Silver Fish',art:'<path d="M15 32C31 8 51 17 58 31 48 47 28 56 15 34L3 46V18z" fill="#83a29a" stroke="#66877b" stroke-width="1.5"/><path d="m25 24 11 8-11 9m7-20 10 11-10 12" fill="none" stroke="#c4d0ad" stroke-width="1.5"/><circle cx="47" cy="29" r="3" fill="#53786b"/><path d="M15 30h-7m7 5h-7m29-17 4-10" stroke="#a6bb9c" stroke-width="1.5"/>'},
 {name:'Wayfinder Compass',art:'<circle cx="32" cy="32" r="24" fill="#d0c293" stroke="#a48b5f" stroke-width="2"/><circle cx="32" cy="32" r="18" fill="#e1d7b3" stroke="#c1ab76" stroke-width="1"/><path d="m32 12 8 20-8 20-8-20z" fill="#79937b"/><path d="m32 12 8 20h-8z" fill="#bd9672"/><circle cx="32" cy="32" r="3" fill="#d9bb7e"/><path d="M10 32h6m32 0h6M32 10v6m0 32v6" stroke="#ad925e" stroke-width="1.5"/>'},
 {name:'Wind Feather',art:'<path d="M12 49C9 12 36-1 55 9c3 27-15 46-36 43z" fill="#b5bb9a" stroke="#859a7a" stroke-width="1.5"/><path d="M9 59 45 17M21 43l-2-22m12 12 15-2M37 24l-2-11" stroke="#e3dbb5" stroke-width="2"/><path d="M36 42h-7m14-8h-7" stroke="#879a79" stroke-width="1.5"/>'},
];
function cachedSvg(key, markup, box, className) {
 let template = ART_CACHE.get(key);
 if (!template) { template = document.createElementNS('http://www.w3.org/2000/svg','svg'); template.setAttribute('viewBox',box); template.setAttribute('aria-hidden','true'); template.innerHTML=markup; ART_CACHE.set(key,template); }
 const copy = template.cloneNode(true); copy.setAttribute('class',className); return copy;
}
function memoryIdentity(card) { return MEMORY_SEALS[(card.suit ? 8 : 0)+(card.rank-1)%8]; }
function memoryArt(card) {
 const identity = memoryIdentity(card);
 return cachedSvg(`memory-${card.suit}-${card.rank}`,`<circle cx="32" cy="32" r="29" fill="#efead6" stroke="#c5b583" stroke-width="1"/><circle cx="32" cy="32" r="26" fill="#e4e3ca"/>${identity.art}`,'0 0 64 64','card-memory-seal');
}
function backArt() {
 return cachedSvg('card-back','<path d="M6 6h88v128H6z" fill="none" stroke="#c0b580" stroke-width=".8"/><path d="m10 19 9-9m62 0 9 9m-80 103 9 9m62 0 9-9" fill="none" stroke="#a9bb8b" stroke-width="2"/><circle cx="50" cy="70" r="31" fill="none" stroke="#a4b17e" stroke-width="1"/><circle cx="50" cy="70" r="26" fill="#2a523e" stroke="#ccbf83" stroke-width="1.2"/><path d="m50 47 8 16 15 7-15 7-8 16-8-16-15-7 15-7z" fill="#bdc28c"/><path d="m50 56 5 9 10 5-10 5-5 10-5-10-10-5 10-5z" fill="#e0d39d"/><path d="M50 23v13m0 69v13M20 36l9 9m42 50 9 9M20 104l9-9m42-50 9-9" stroke="#9dac7c" stroke-width="1.5"/><path d="M15 26q19-22 35-9 18-14 35 9M15 113q19 22 35 9 18 14 35-9" fill="none" stroke="#718f64" stroke-width="1"/>','0 0 100 140','card-back-art');
}
const TITLES = { 'crazy-eights': 'Crazy Eights', 'twenty-one': '21 Duel', memory: 'Memory Match' };
const rankLabel = rank => ({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' })[rank] || String(rank);
const cardName = card => `${({ 1: 'Ace', 11: 'Jack', 12: 'Queen', 13: 'King' })[card.rank] || card.rank} of ${SUITS[card.suit]?.name || 'cards'}`;
const playableCard = (card, state) => card && (card.rank === 8 || card.rank === state.topCard?.rank || card.suit === state.activeSuit);
const setText = (node, value) => { const text = String(value); if (node.textContent !== text) node.textContent = text; };
const setAttribute = (node, name, value) => { if (node.getAttribute(name) !== value) node.setAttribute(name, value); };
const setDisabled = (node, value) => { if (node.disabled !== value) node.disabled = value; };
const setHidden = (node, value) => { if (node.hidden !== value) node.hidden = value; };
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
    this.tableLabel = element('span', 'cards-table-label', 'SEMAG CARD ROOM');
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
      pattern.append(backArt());
      node.append(pattern);
      return;
    }
    const rank = rankLabel(card.rank), suit = SUITS[card.suit]?.symbol || '•';
    const top = element('span', 'card-corner');
    const cornerSuit = element('span'); cornerSuit.append(suitArt(card.suit)); top.append(element('b', '', rank), cornerSuit);
    const bottom = top.cloneNode(true);
    bottom.classList.add('card-corner-bottom');
    const face = element('span', 'card-face');
    if (this.gameId === 'memory') face.append(memoryArt(card));
    else if (card.rank > 10) face.append(royalArt(card.rank, card.suit));
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
      if (card && own) {
        if (node.dataset.cardId !== String(card.id)) node.dataset.cardId = card.id;
      } else if (node.dataset.cardId !== undefined) delete node.dataset.cardId;
      const playable = own && this.gameId === 'crazy-eights' && this.canAct() && card && playableCard(card, state);
      node.classList.toggle('is-playable', Boolean(playable));
      node.classList.toggle('is-selected', card?.id === this.selected);
      setAttribute(node, 'aria-label', card ? `${cardName(card)}${playable ? ', playable' : ''}${card.id === this.selected ? ', choosing suit' : ''}` : inLobby ? 'Cards will be dealt when the game begins' : 'Concealed opponent card');
      if (node.tagName === 'BUTTON') setAttribute(node, 'aria-disabled', String(!playable));
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
        setAttribute(this.discard, 'aria-label', state.topCard ? `Top discard: ${cardName(state.topCard)}` : 'Discard pile. No cards dealt yet.');
        setText(this.drawLabel, `DRAW · ${state.deckCount || 0}`);
        const suit = SUITS[state.activeSuit];
        if (suit) showSuit(this.activeSuitSymbol, state.activeSuit); else setText(this.activeSuitSymbol, '—');
        setText(this.activeSuitText, suit ? `${suit.name.toUpperCase()} IN PLAY` : 'YOUR NEXT GAME');
        this.activeSuit.classList.toggle('is-red', Boolean(state.activeSuit % 2));
        const hand = state.hands?.[this.localId] || [];
        const legal = hand.some(card => playableCard(card, state));
        setDisabled(this.drawButton, !this.canAct() || legal || Boolean(state.drawn?.[this.localId]));
        setAttribute(this.drawButton, 'aria-label', `Draw one card, ${state.deckCount || 0} in deck${legal ? '. Play a matching card first.' : ''}`);
        setHidden(this.passButton, !state.drawn?.[this.localId]);
        setDisabled(this.passButton, !this.canAct());
        setHidden(this.suitPicker, !this.selected);
        for (const choice of this.suitPicker.querySelectorAll('button[data-suit]')) setDisabled(choice, !this.canAct());
      } else {
        setDisabled(this.hitButton, !this.canAct());
        setDisabled(this.standButton, !this.canAct());
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
      setAttribute(node, 'aria-disabled', String(!canFlip));
      setAttribute(node, 'aria-label', `Card ${index + 1}, ${card ? `${memoryIdentity(card).name}, ${cardName(card)}` : 'face down'}${claimed ? `, matched by ${this.name(matched)}` : revealed.has(index) ? ', revealed' : canFlip ? ', flip to reveal' : ''}`);
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
      if (claimed >= 0 && state.cards[claimed]) text = `${this.name(state.matched[claimed])} claimed the ${memoryIdentity(state.cards[claimed]).name} pair. Another turn earned.`;
    }
    if (text) { this.publicTrail.push(text); if (this.publicTrail.length > 4) this.publicTrail.shift(); }
  }

  paintContext() {
    const state = this.state;
    const own = state.hands?.[this.localId] || [];
    // The guide and collection do not change when a selection or send lock changes.
    // Use only the public information each panel displays, including revealed results.
    const key = JSON.stringify([this.gameId, this.localId, [this.name(0), this.name(1)], this.publicTrail,
      this.gameId === 'twenty-one' ? [state.phase === 'fight', state.totals?.[this.localId], state.scores, state.round, state.maxRounds, this.roundHistory]
        : this.gameId === 'memory' ? [state.scores, (state.cards || []).flatMap((card, index) => state.matched?.[index] === 0 || state.matched?.[index] === 1 ? [[card?.rank, card?.suit, state.matched[index]]] : [])]
          : [state.phase === 'fight', own.filter(card => playableCard(card, state)).length, own.filter(card => card?.rank === 8).length]]);
    if (this.contextKey === key) return;
    this.contextKey = key;
    this.context.replaceChildren();
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
      (state.cards || []).forEach((card, index) => { const owner = state.matched?.[index]; if (!card || owner === null || owner === undefined) return; const key = `${card.rank}:${card.suit}`; if (seen.has(key)) return; seen.add(key); const identity = memoryIdentity(card); const item = element('span', `cards-claimed-pair claimed-by-${owner}`); item.append(memoryArt(card), element('span', '', identity.name)); item.setAttribute('role', 'img'); item.setAttribute('aria-label', `${this.name(owner)}: ${identity.name}, pair of ${cardName(card)}`); item.title = `${this.name(owner)} · ${identity.name}`; gallery.append(item); });
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
    this.memoryNodes.forEach((node, index) => {
      const value = index === this.focused ? 0 : -1;
      if (node.tabIndex !== value) node.tabIndex = value;
    });
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
