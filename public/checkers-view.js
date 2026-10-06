import { legalMoves } from './checkers-engine.js';

const crown = '<svg viewBox="0 0 32 26" aria-hidden="true"><path d="m4 7 6 6 6-10 6 10 6-6-3 14H7L4 7Z"/><path d="M8 24h16"/><circle cx="4" cy="5" r="2"/><circle cx="16" cy="2" r="2"/><circle cx="28" cy="5" r="2"/></svg>';
const coordinate = square => `${'abcdefgh'[square % 8]}${8 - Math.floor(square / 8)}`;
const boardKey = state => `${state.phase}:${state.turn}:${state.forcedFrom}:${state.moves}:${state.board.map(piece => piece ? `${piece.owner}${piece.king ? 'k' : 'm'}` : '.').join('')}`;

/** Accessible board view. The server remains the only writer of game state. */
export class CheckersView {
  constructor(container, { onMove = () => {} } = {}) {
    this.container = container;
    this.onMove = onMove;
    this.selected = null;
    this.focused = 40;
    this.pending = null;
    this.state = null;
    this.localId = null;
    this.history = [];
    this.lastObservedMove = null;
    this.order = [];
    this.buttons = new Map();
    this.element = document.createElement('div');
    this.element.className = 'checkers-view';
    this.frame = document.createElement('div');
    this.frame.className = 'checkers-frame';
    this.grid = document.createElement('div');
    this.grid.className = 'checkers-grid';
    this.grid.setAttribute('role', 'grid');
    this.grid.setAttribute('aria-label', 'Checkers board. Use arrow keys to explore squares. Select a piece, then its destination.');
    this.grid.setAttribute('aria-rowcount', '8');
    this.grid.setAttribute('aria-colcount', '8');
    this.ranks = document.createElement('div');
    this.ranks.className = 'checkers-ranks';
    this.files = document.createElement('div');
    this.files.className = 'checkers-files';
    this.notice = document.createElement('p');
    this.notice.className = 'checkers-notice';
    this.notice.setAttribute('role', 'status');
    this.notice.setAttribute('aria-live', 'polite');
    this.notice.setAttribute('aria-atomic', 'true');
    this.toolbar = document.createElement('div');
    this.toolbar.className = 'checkers-toolbar';
    this.turnLabel = document.createElement('strong');
    this.material = document.createElement('div');
    this.material.className = 'checkers-material';
    this.zoom = document.createElement('button');
    this.zoom.type = 'button'; this.zoom.className = 'checkers-zoom'; this.zoom.textContent = 'Larger board';
    this.zoom.setAttribute('aria-pressed', 'false');
    this.zoomHandler = () => { const enlarged = this.element.classList.toggle('is-enlarged'); this.zoom.setAttribute('aria-pressed', String(enlarged)); this.zoom.textContent = enlarged ? 'Fit board' : 'Larger board'; this.paint(); };
    this.zoom.addEventListener('click', this.zoomHandler);
    this.toolbar.append(this.turnLabel, this.zoom);
    this.historyPanel = document.createElement('details'); this.historyPanel.className = 'checkers-history';
    const historyTitle = document.createElement('summary'); historyTitle.textContent = 'Recent moves';
    this.historyList = document.createElement('ol'); this.historyList.className = 'checkers-history-list';
    this.recap = document.createElement('p'); this.recap.className = 'checkers-recap';
    this.historyPanel.append(historyTitle, this.historyList, this.recap);
    this.legend = document.createElement('div'); this.legend.className = 'checkers-legend';
    for (const [kind, text] of [['move', 'Legal move'], ['capture', 'Required capture'], ['king', 'Crowned king']]) { const key = document.createElement('span'); key.className = `checkers-key-${kind}`; key.textContent = text; this.legend.append(key); }
    this.frame.append(this.ranks, this.grid, this.files);
    this.element.append(this.toolbar, this.material, this.frame, this.notice, this.legend, this.historyPanel);
    this.container.append(this.element);
    this.clickHandler = event => {
      const button = event.target.closest('button[data-square]');
      if (button && this.grid.contains(button)) this.choose(Number(button.dataset.square));
    };
    this.keyHandler = event => this.navigate(event);
    this.focusHandler = event => {
      const square = Number(event.target.dataset.square);
      if (Number.isInteger(square) && this.buttons.has(square)) {
        this.focused = square;
        this.updateTabStops();
      }
    };
    this.grid.addEventListener('click', this.clickHandler);
    this.grid.addEventListener('keydown', this.keyHandler);
    this.grid.addEventListener('focusin', this.focusHandler);
    this.build(false);
  }

  build(flipped) {
    const activeSquare = Number(document.activeElement?.dataset?.square);
    const retainedFocus = this.grid.contains(document.activeElement);
    this.flipped = flipped;
    this.order = Array.from({ length: 64 }, (_, i) => flipped ? 63 - i : i);
    this.grid.replaceChildren();
    this.buttons.clear();
    for (let visualRow = 0; visualRow < 8; visualRow += 1) {
      const rowElement = document.createElement('div');
      rowElement.className = 'checkers-row';
      rowElement.setAttribute('role', 'row');
      rowElement.setAttribute('aria-rowindex', String(visualRow + 1));
      this.grid.append(rowElement);
      for (const square of this.order.slice(visualRow * 8, visualRow * 8 + 8)) {
        const row = Math.floor(square / 8);
        const col = square % 8;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `checker-square ${(row + col) % 2 ? 'is-dark' : 'is-light'}`;
        button.dataset.square = String(square);
        button.setAttribute('role', 'gridcell');
        button.setAttribute('aria-rowindex', String(flipped ? 8 - row : row + 1));
        button.setAttribute('aria-colindex', String(flipped ? 8 - col : col + 1));
        this.buttons.set(square, button);
        rowElement.append(button);
      }
    }
    this.ranks.replaceChildren(...Array.from({ length: 8 }, (_, i) => {
      const label = document.createElement('span');
      label.textContent = String(flipped ? i + 1 : 8 - i);
      return label;
    }));
    this.files.replaceChildren(...Array.from({ length: 8 }, (_, i) => {
      const label = document.createElement('span');
      label.textContent = 'abcdefgh'[flipped ? 7 - i : i];
      return label;
    }));
    if (retainedFocus && this.buttons.has(activeSquare)) this.buttons.get(activeSquare).focus({ preventScroll: true });
    this.updateTabStops();
  }

  updateTabStops() {
    for (const [square, button] of this.buttons) button.tabIndex = square === this.focused ? 0 : -1;
  }

  navigate(event) {
    const square = Number(event.target.dataset.square);
    const current = this.order.indexOf(square);
    if (current < 0) return;
    let next = current;
    if (event.key === 'ArrowLeft') next = current % 8 > 0 ? current - 1 : current;
    else if (event.key === 'ArrowRight') next = current % 8 < 7 ? current + 1 : current;
    else if (event.key === 'ArrowUp') next = current >= 8 ? current - 8 : current;
    else if (event.key === 'ArrowDown') next = current < 56 ? current + 8 : current;
    else if (event.key === 'Home') next = Math.floor(current / 8) * 8;
    else if (event.key === 'End') next = Math.floor(current / 8) * 8 + 7;
    else if (event.key === 'Escape') {
      this.resetSelection();
      event.preventDefault();
      return;
    } else return;
    event.preventDefault();
    this.focused = this.order[next];
    this.updateTabStops();
    this.buttons.get(this.focused).focus({ preventScroll: true });
  }

  choose(square) {
    const state = this.state;
    if (!state || state.phase !== 'fight' || state.turn !== this.localId || this.pending) return;
    const choices = legalMoves(state, this.localId);
    const destination = choices.find(move => move.from === this.selected && move.to === square);
    if (destination) {
      const from = this.selected;
      this.pending = boardKey(state);
      this.selected = null;
      this.paint();
      this.onMove(from, square);
      return;
    }
    if (choices.some(move => move.from === square)) {
      this.selected = square === this.selected && state.forcedFrom === null ? null : square;
      this.focused = square;
    } else if (state.forcedFrom === null) this.selected = null;
    this.paint();
  }

  render(state, { localId = null } = {}) {
    if (!state?.board || state.board.length !== 64) return;
    const previous = this.state ? boardKey(this.state) : null;
    if (['lobby', 'countdown'].includes(state.phase) && this.state && !['lobby', 'countdown'].includes(this.state.phase)) { this.history = []; this.lastObservedMove = null; this.historyPanel.open = false; }
    const move = state.lastMove;
    if (move && ['fight', 'matchEnd'].includes(state.phase)) {
      const moveKey = `${move.tick}:${move.from}:${move.to}:${move.capture}`;
      if (moveKey !== this.lastObservedMove) {
        this.lastObservedMove = moveKey;
        this.history.push({ ...move, number: state.moves + (state.forcedFrom !== null ? 1 : 0), continuing: state.forcedFrom !== null });
        if (this.history.length > 12) this.history.shift();
      }
    }
    this.state = state;
    this.localId = localId;
    if (this.flipped !== (localId === 1)) this.build(localId === 1);
    const key = boardKey(state);
    if (this.pending && this.pending !== key) this.pending = null;
    const playable = state.phase === 'fight' && state.turn === localId;
    if (!playable) this.selected = null;
    else if (state.forcedFrom !== null && state.forcedFrom !== undefined) this.selected = state.forcedFrom;
    else if (previous !== key && this.selected !== null && !legalMoves(state, localId).some(move => move.from === this.selected)) this.selected = null;
    this.paint();
  }

  paint() {
    const state = this.state;
    if (!state) return;
    const playable = state.phase === 'fight' && state.turn === this.localId && !this.pending;
    const choices = playable ? legalMoves(state, this.localId) : [];
    const destinations = new Map(choices.filter(move => move.from === this.selected).map(move => [move.to, move]));
    const canCapture = choices.some(move => move.capture !== null);
    const victims = new Set([...destinations.values()].filter(move => move.capture !== null).map(move => move.capture));
    this.element.classList.toggle('is-your-turn', playable);
    this.element.classList.toggle('has-selection', this.selected !== null);
    for (const [square, button] of this.buttons) {
      const piece = state.board[square];
      const selected = square === this.selected;
      const available = choices.some(move => move.from === square);
      const destination = destinations.get(square);
      const last = state.lastMove && (square === state.lastMove.from || square === state.lastMove.to);
      button.classList.toggle('is-selected', selected);
      button.classList.toggle('is-available', available);
      button.classList.toggle('is-destination', Boolean(destination));
      button.classList.toggle('is-capture-destination', Boolean(destination && destination.capture !== null));
      button.classList.toggle('is-last-move', Boolean(last));
      button.classList.toggle('is-capture-victim', victims.has(square));
      button.classList.toggle('is-forced', playable && square === state.forcedFrom);
      button.setAttribute('aria-selected', String(selected));
      button.setAttribute('aria-disabled', String(!playable || (!available && !destination)));
      const description = piece ? `${piece.owner === 0 ? 'Ivory' : 'Jade'} ${piece.king ? 'king' : 'piece'}` : 'empty';
      button.setAttribute('aria-label', `${coordinate(square)}, ${description}${selected ? ', selected' : ''}${destination ? destination.capture !== null ? ', capture destination' : ', legal destination' : ''}${available && !selected ? ', selectable' : ''}`);
      const tokenKey = piece ? `${piece.owner}:${piece.king}` : 'empty';
      if (button.dataset.token !== tokenKey) {
        button.dataset.token = tokenKey;
        button.replaceChildren();
        if (piece) {
          const token = document.createElement('span');
          token.className = `checker-piece ${piece.owner === 0 ? 'is-ivory' : 'is-jade'}${piece.king ? ' is-king' : ''}`;
          token.setAttribute('aria-hidden', 'true');
          const face = document.createElement('span');
          face.className = 'checker-piece-face';
          if (piece.king) face.innerHTML = crown;
          else {
            const emblem = document.createElement('span');
            emblem.className = 'checker-piece-emblem';
            face.append(emblem);
          }
          token.append(face);
          button.append(token);
        }
      }
    }
    let notice = 'Ivory moves first. Both players ready up to begin.';
    if (state.phase === 'countdown') notice = `Get ready. First move in ${Math.ceil(state.phaseTicks / 120)}…`;
    else if (state.phase === 'fight') {
      if (this.pending) notice = 'Sending your move…';
      else if (state.turn !== this.localId) notice = `${state.turn === 0 ? 'Ivory' : 'Jade'} is thinking. Your board stays live.`;
      else if (state.forcedFrom !== null && state.forcedFrom !== undefined) notice = 'Keep going. Complete the capture with this piece.';
      else if (canCapture) notice = 'Your turn. A capture is available — you must take it.';
      else if (this.selected !== null) notice = 'Choose a highlighted square to move.';
      else notice = 'Your turn. Select a piece to see its moves.';
    } else if (state.phase === 'matchEnd') notice = state.result === 'draw' ? 'A draw. Ready up for another game.' : `${state.winner === 0 ? 'Ivory' : 'Jade'} wins. Ready up for a rematch.`;
    if (this.element.classList.contains('is-enlarged') && this.frame.scrollWidth > this.frame.clientWidth) notice += ' Swipe the board sideways to see every file.';
    this.notice.classList.toggle('is-capture', playable && canCapture);
    if (this.notice.textContent !== notice) this.notice.textContent = notice;
    this.paintContext(choices);
    this.updateTabStops();
  }

  paintContext(choices) {
    const state = this.state;
    const turn = state.phase === 'fight' ? state.turn === this.localId ? 'YOUR MOVE' : `${state.turn === 0 ? 'IVORY' : 'JADE'} TO MOVE` : state.phase === 'matchEnd' ? 'MATCH COMPLETE' : 'THE CHECKERS TABLE';
    this.turnLabel.textContent = `${turn} · ${state.moves || 0} TURNS`;
    this.material.replaceChildren();
    for (const id of [0, 1]) {
      const pieces = state.board.filter(p => p?.owner === id); const kings = pieces.filter(p => p.king).length;
      const panel = document.createElement('span'); panel.className = `checkers-material-player checkers-material-${id}`;
      const name = document.createElement('strong'); name.textContent = id === 0 ? 'Ivory' : 'Jade';
      const detail = document.createElement('span'); detail.textContent = `${pieces.length} pieces · ${kings} kings · ${12 - pieces.length} lost`;
      panel.append(name, detail); this.material.append(panel);
    }
    const signature = JSON.stringify(this.history);
    if (this.historyList.dataset.signature !== signature) {
      this.historyList.dataset.signature = signature; this.historyList.replaceChildren();
      for (const move of [...this.history].reverse()) {
        const line = document.createElement('li');
        const who = document.createElement('span'); who.textContent = `${move.number || 1}. ${move.playerId === 0 ? 'Ivory' : 'Jade'}`;
        const path = document.createElement('strong'); path.textContent = `${coordinate(move.from)}${move.capture !== null ? ' × ' : ' → '}${coordinate(move.to)}${move.kinged ? ' · king' : move.continuing ? ' · continue' : ''}`;
        line.append(who, path); this.historyList.append(line);
      }
      if (!this.history.length) { const line = document.createElement('li'); line.textContent = 'Moves will appear here as the game unfolds.'; this.historyList.append(line); }
    }
    const reasons = { 'no-legal-moves': 'The losing side has no legal move.', 'all-pieces-captured': 'Every opposing piece has been captured.', 'threefold-repetition': 'The same position appeared three times.', '80-half-moves': 'Eighty turns passed without a capture or a man moving.' };
    this.recap.textContent = state.phase === 'matchEnd' ? reasons[state.reason] || 'The match has ended. Ready up for a new board.' : state.forcedFrom !== null ? `Continue from ${coordinate(state.forcedFrom)}. Every available jump in this chain is compulsory.` : choices.some(m => m.capture !== null) ? `${new Set(choices.map(m => m.from)).size} piece${new Set(choices.map(m => m.from)).size === 1 ? '' : 's'} can capture. Choose the strongest continuation.` : 'Men move forward. Kings move both ways. Captures take priority over ordinary moves.';
    if (state.phase === 'matchEnd') this.historyPanel.open = true;
  }

  resetSelection() {
    this.selected = null;
    this.pending = null;
    if (this.state?.phase === 'fight' && this.state.turn === this.localId && this.state.forcedFrom !== null) this.selected = this.state.forcedFrom;
    this.paint();
  }

  destroy() {
    this.zoom.removeEventListener('click', this.zoomHandler);
    this.grid.removeEventListener('click', this.clickHandler);
    this.grid.removeEventListener('keydown', this.keyHandler);
    this.grid.removeEventListener('focusin', this.focusHandler);
    this.element.remove();
    this.buttons.clear();
  }
}
