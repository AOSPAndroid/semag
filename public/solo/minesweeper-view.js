import { DIFFICULTIES, advanceTime, chord, cloneState, createState, flag, getStats, reveal, togglePause as pauseState } from './minesweeper-engine.js';

const formatTime = elapsed => `${Math.floor(elapsed / 60)}:${String(Math.floor(elapsed % 60)).padStart(2, '0')}`;

export function mount(container, { onUpdate = () => {} } = {}) {
  let difficulty = 'beginner';
  let state = createState(DIFFICULTIES[difficulty]);
  let flagMode = false;
  let focused = 0;
  let destroyed = false;
  let lastClock = performance.now();
  let lastSecond = -1;
  let notice = '';
  let tiles = [];

  const root = document.createElement('section');
  root.className = 'minesweeper-view';
  root.setAttribute('aria-label', 'Minesweeper');
  root.innerHTML = `
    <div class="minesweeper-controls">
      <label class="minesweeper-difficulty-label">Difficulty
        <select class="minesweeper-difficulty" aria-label="Minesweeper difficulty">
          <option value="beginner">Beginner · 9 × 9</option>
          <option value="intermediate">Intermediate · 16 × 16</option>
          <option value="expert">Expert · 30 × 16 · 99 mines</option>
        </select>
      </label>
      <button type="button" class="minesweeper-flag-mode" aria-pressed="false">⚑ Flag mode: off</button>
    </div>
    <div class="minesweeper-frame">
      <div class="minesweeper-instruments">
        <div><span>MINES LEFT</span><strong class="minesweeper-remaining">10</strong></div>
        <i class="minesweeper-emblem" aria-hidden="true"></i>
        <div><span>TIME</span><strong class="minesweeper-clock">0:00</strong></div>
      </div>
      <p class="minesweeper-pan-hint" hidden>↔ Pan the field horizontally. Arrow-key focus keeps the selected tile in view.</p>
      <div class="minesweeper-board-wrap">
        <div class="minesweeper-board" role="group"></div>
        <div class="minesweeper-pause" hidden><strong>Paused</strong><span>Resume above to continue.</span></div>
      </div>
      <p class="minesweeper-status" role="status" aria-live="polite" aria-atomic="true"></p>
    </div>
    <p class="minesweeper-help">Uncover the safe tiles. Numbers count nearby mines. Flag those mines, then select a number to open around it.</p>
    <p class="minesweeper-keys"><span>Arrows</span> move <span>Enter / Space</span> reveal <span>F</span> flag · Right-click also flags</p>
  `;
  container.replaceChildren(root);
  const board = root.querySelector('.minesweeper-board');
  const selector = root.querySelector('.minesweeper-difficulty');
  const flagButton = root.querySelector('.minesweeper-flag-mode');
  const remaining = root.querySelector('.minesweeper-remaining');
  const clock = root.querySelector('.minesweeper-clock');
  const status = root.querySelector('.minesweeper-status');
  const pauseOverlay = root.querySelector('.minesweeper-pause');
  const boardWrap = root.querySelector('.minesweeper-board-wrap');
  const panHint = root.querySelector('.minesweeper-pan-hint');

  function syncTime() {
    const now = performance.now();
    advanceTime(state, Math.max(0, now - lastClock) / 1000);
    lastClock = now;
  }

  function detail() {
    if (state.phase === 'paused') return 'Paused. Your timer is stopped.';
    if (state.phase === 'won') return `All ${state.opened} safe tiles found in ${formatTime(state.elapsed)}. Well played!`;
    if (state.phase === 'lost') return 'A mine went off. Start a new board and try again.';
    if (!state.generated) return 'Choose a tile to begin. Your first reveal is safe.';
    return `${state.opened} of ${state.cells.length - state.mines} safe tiles found. ${state.mines - state.flags} mines left to flag.`;
  }

  function emit() {
    const stats = getStats(state);
    onUpdate({
      phase: state.phase, score: stats.opened, scoreLabel: 'SAFE TILES',
      record: state.phase === 'won' ? Math.round(state.elapsed * 1000) / 1000 : null,
      recordDirection: 'min', recordKey: difficulty, recordLabel: 'BEST TIME', detail: detail(),
    });
  }

  function buildBoard() {
    board.replaceChildren();
    board.style.setProperty('--mine-cols', String(state.cols));
    board.setAttribute('aria-label', `${state.rows} by ${state.cols} minefield. Use arrow keys to move, Enter to reveal, and F to flag.`);
    root.classList.toggle('is-intermediate', difficulty === 'intermediate');
    root.classList.toggle('is-expert', difficulty === 'expert');
    root.classList.toggle('is-wide', difficulty !== 'beginner');
    panHint.hidden = difficulty === 'beginner';
    boardWrap.scrollLeft = 0;
    tiles = state.cells.map((_, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'minesweeper-tile';
      button.dataset.index = String(index);
      button.tabIndex = index === focused ? 0 : -1;
      const mark = document.createElement('span');
      mark.setAttribute('aria-hidden', 'true');
      button.append(mark);
      board.append(button);
      return button;
    });
  }

  function syncPauseCover() {
    pauseOverlay.style.left = `${boardWrap.scrollLeft}px`;
    pauseOverlay.style.right = 'auto';
    pauseOverlay.style.width = `${boardWrap.clientWidth}px`;
  }

  function render() {
    syncPauseCover();
    remaining.textContent = String(state.mines - state.flags).padStart(2, '0');
    clock.textContent = formatTime(state.elapsed);
    pauseOverlay.hidden = state.phase !== 'paused';
    flagButton.setAttribute('aria-pressed', String(flagMode));
    flagButton.textContent = `⚑ Flag mode: ${flagMode ? 'on' : 'off'}`;
    flagButton.disabled = state.phase !== 'playing';
    board.classList.toggle('is-paused', state.phase === 'paused');
    for (const [index, cell] of state.cells.entries()) {
      const tile = tiles[index];
      const wrongFlag = state.phase === 'lost' && cell.flagged && !cell.mine;
      const showMine = cell.mine && cell.revealed;
      tile.className = `minesweeper-tile${cell.revealed ? ' is-open' : ''}${cell.flagged ? ' is-flagged' : ''}${showMine ? ' is-mine' : ''}${wrongFlag ? ' is-wrong-flag' : ''}${state.exploded === index ? ' is-exploded' : ''}`;
      tile.dataset.number = cell.revealed && !cell.mine ? String(cell.adjacent) : '';
      const mark = tile.firstElementChild;
      mark.className = showMine ? 'minesweeper-mine' : cell.flagged ? 'minesweeper-flag' : '';
      mark.textContent = wrongFlag ? '×' : cell.revealed && !cell.mine && cell.adjacent ? String(cell.adjacent) : '';
      const row = Math.floor(index / state.cols) + 1;
      const col = index % state.cols + 1;
      let description = showMine ? 'mine' : wrongFlag ? 'incorrect flag' : cell.flagged ? 'flagged' : cell.revealed ? cell.adjacent ? `${cell.adjacent} adjacent ${cell.adjacent === 1 ? 'mine' : 'mines'}` : 'empty' : 'covered';
      if (state.phase === 'playing' && cell.revealed && cell.adjacent && !cell.mine) description += '. Select to open around this number';
      tile.setAttribute('aria-label', `Row ${row}, column ${col}, ${description}`);
      tile.setAttribute('aria-disabled', String(state.phase !== 'playing'));
      tile.tabIndex = index === focused ? 0 : -1;
    }
    status.textContent = notice || detail();
    lastSecond = Math.floor(state.elapsed);
    emit();
  }

  function focusTile(index, moveFocus = true) {
    focused = Math.max(0, Math.min(state.cells.length - 1, index));
    for (const [other, tile] of tiles.entries()) tile.tabIndex = other === focused ? 0 : -1;
    if (moveFocus) { tiles[focused].focus({ preventScroll: true }); tiles[focused].scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' }); }
  }

  function act(index, flagAction = false) {
    if (destroyed || state.phase !== 'playing') return;
    syncTime();
    const openedBefore = state.opened;
    const result = flagAction ? flag(state, index) : state.cells[index]?.revealed ? chord(state, index) : reveal(state, index);
    if (!result.ok) notice = result.error;
    else if (state.phase === 'won' || state.phase === 'lost') notice = '';
    else if (flagAction) notice = `${state.cells[index].flagged ? 'Flag placed' : 'Flag removed'}. ${state.mines - state.flags} mines left to flag.`;
    else notice = `Opened ${state.opened - openedBefore} safe ${state.opened - openedBefore === 1 ? 'tile' : 'tiles'}. ${detail()}`;
    render();
  }

  function tileIndex(event) {
    const tile = event.target.closest('.minesweeper-tile');
    return tile && board.contains(tile) ? Number(tile.dataset.index) : null;
  }

  function click(event) {
    const index = tileIndex(event);
    if (index === null) return;
    focusTile(index, false);
    act(index, flagMode);
  }

  function contextMenu(event) {
    const index = tileIndex(event);
    if (index === null) return;
    event.preventDefault();
    focusTile(index, false);
    act(index, true);
  }

  function keydown(event) {
    const index = tileIndex(event);
    if (index === null || event.altKey || event.metaKey) return;
    const rowStart = Math.floor(index / state.cols) * state.cols;
    let next = null;
    if (event.key === 'ArrowLeft') next = Math.max(rowStart, index - 1);
    if (event.key === 'ArrowRight') next = Math.min(rowStart + state.cols - 1, index + 1);
    if (event.key === 'ArrowUp') next = Math.max(index % state.cols, index - state.cols);
    if (event.key === 'ArrowDown') next = Math.min((state.rows - 1) * state.cols + index % state.cols, index + state.cols);
    if (event.key === 'Home') next = event.ctrlKey ? 0 : rowStart;
    if (event.key === 'End') next = event.ctrlKey ? state.cells.length - 1 : rowStart + state.cols - 1;
    if (next !== null) { event.preventDefault(); focusTile(next); return; }
    if (event.ctrlKey) return;
    if (event.key === 'Enter' || event.key === ' ' || event.key.toLowerCase() === 'f') {
      event.preventDefault();
      if (!event.repeat) act(index, event.key.toLowerCase() === 'f');
    }
  }

  function restart() {
    if (destroyed) return;
    syncTime();
    state = createState(DIFFICULTIES[difficulty]);
    focused = 0;
    notice = '';
    flagMode = false;
    lastClock = performance.now();
    buildBoard();
    render();
  }

  function changeDifficulty() {
    difficulty = selector.value;
    restart();
  }

  function toggleFlagMode() {
    if (state.phase !== 'playing') return;
    flagMode = !flagMode;
    notice = flagMode ? 'Flag mode on. Tap a covered tile to place or remove a flag.' : 'Flag mode off. Tap a tile to reveal it.';
    render();
  }

  boardWrap.addEventListener('scroll', syncPauseCover, { passive: true });
  const pauseResize = typeof ResizeObserver === 'function' ? new ResizeObserver(syncPauseCover) : null;
  pauseResize?.observe(boardWrap);
  board.addEventListener('click', click);
  board.addEventListener('contextmenu', contextMenu);
  board.addEventListener('keydown', keydown);
  selector.addEventListener('change', changeDifficulty);
  flagButton.addEventListener('click', toggleFlagMode);
  buildBoard();
  render();
  const interval = setInterval(() => {
    if (destroyed) return;
    syncTime();
    if (lastSecond !== Math.floor(state.elapsed)) {
      lastSecond = Math.floor(state.elapsed);
      clock.textContent = formatTime(state.elapsed);
      emit();
    }
  }, 200);

  return {
    getState() { syncTime(); return cloneState(state); },
    restart,
    togglePause() {
      if (destroyed) return;
      syncTime();
      pauseState(state);
      notice = '';
      render();
    },
    destroy() {
      destroyed = true;
      clearInterval(interval);
      pauseResize?.disconnect();
      boardWrap.removeEventListener('scroll', syncPauseCover);
      board.removeEventListener('click', click);
      board.removeEventListener('contextmenu', contextMenu);
      board.removeEventListener('keydown', keydown);
      selector.removeEventListener('change', changeDifficulty);
      flagButton.removeEventListener('click', toggleFlagMode);
      root.remove();
    },
  };
}
