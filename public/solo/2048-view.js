import { PUZZLES, nextPuzzle, retryPuzzle, createState, move, undo, togglePause, continueGame } from './2048-engine.js';

const keyDirections = {
  ArrowUp: 'up', ArrowRight: 'right', ArrowDown: 'down', ArrowLeft: 'left',
  w: 'up', d: 'right', s: 'down', a: 'left',
};

export function mount(container, { onUpdate = () => {} } = {}) {
  let mode = 'classic';
  let state = createState({ mode });
  let destroyed = false;
  let animationTimer = null;
  let pointer = null;
  const element = document.createElement('section');
  element.className = 'tiles-2048';
  element.setAttribute('aria-label', '2048 game');
  element.innerHTML = `
    <div class="tiles-2048-modes" aria-label="2048 game mode"><button type="button" data-mode="classic" aria-pressed="true">Classic</button><button type="button" data-mode="puzzles" aria-pressed="false">Six puzzles</button></div>
    <div class="tiles-2048-challenge" hidden><div><span class="tiles-2048-puzzle-title"></span><b class="tiles-2048-budget"></b></div><p>No new tiles. Merge the entire board into its target before your moves run out.</p><div class="tiles-2048-puzzle-progress"></div></div>
    <p class="tiles-2048-hint">Move together. Make room. Go one tile further.</p>
    <div class="tiles-2048-frame">
      <div class="tiles-2048-grid" role="grid" aria-label="2048 board. Use arrow keys or W A S D to slide all tiles." aria-rowcount="4" aria-colcount="4" tabindex="0"></div>
      <div class="tiles-2048-overlay" hidden>
        <strong></strong><p></p>
        <button type="button" data-action="continue" hidden>Keep going <span aria-hidden="true">→</span></button>
        <button type="button" data-action="next-puzzle" hidden>Next puzzle <span aria-hidden="true">→</span></button>
        <button type="button" data-action="retry-puzzle" hidden>Retry this puzzle <span aria-hidden="true">↻</span></button>
        <button type="button" data-action="resume" hidden>Resume game <span aria-hidden="true">→</span></button>
      </div>
    </div>
    <div class="tiles-2048-tools">
      <button type="button" data-action="undo"><span aria-hidden="true">↶</span> Undo last move</button>
      <span>One move back. Another way forward.</span>
    </div>
    <div class="tiles-2048-directions" aria-label="Slide tiles">
      <button type="button" data-action="move-up" aria-label="Slide tiles up"><span aria-hidden="true">↑</span></button>
      <button type="button" data-action="move-left" aria-label="Slide tiles left"><span aria-hidden="true">←</span></button>
      <button type="button" data-action="move-down" aria-label="Slide tiles down"><span aria-hidden="true">↓</span></button>
      <button type="button" data-action="move-right" aria-label="Slide tiles right"><span aria-hidden="true">→</span></button>
    </div>
    <p class="tiles-2048-notice" role="status" aria-live="polite" aria-atomic="true"></p>
    <p class="tiles-2048-instructions">Arrows / WASD to move · Swipe on touch · Matching tiles merge once per move</p>
  `;
  const grid = element.querySelector('.tiles-2048-grid');
  const overlay = element.querySelector('.tiles-2048-overlay');
  const title = overlay.querySelector('strong');
  const description = overlay.querySelector('p');
  const continueButton = element.querySelector('[data-action="continue"]');
  const resumeButton = element.querySelector('[data-action="resume"]');
  const challengePanel = element.querySelector('.tiles-2048-challenge');
  const puzzleTitle = element.querySelector('.tiles-2048-puzzle-title');
  const budget = element.querySelector('.tiles-2048-budget');
  const progress = element.querySelector('.tiles-2048-puzzle-progress');
  const nextButton = element.querySelector('[data-action=next-puzzle]');
  const retryButton = element.querySelector('[data-action=retry-puzzle]');
  for (let i = 0; i < 6; i++) { const dot = document.createElement('span'); dot.textContent = i + 1; progress.append(dot); }
  const undoButton = element.querySelector('[data-action="undo"]');
  const moveButtons = [...element.querySelectorAll('[data-action^="move-"]')];
  const notice = element.querySelector('.tiles-2048-notice');
  const cells = [];
  for (let row = 0; row < 4; row += 1) {
    const rowElement = document.createElement('div');
    rowElement.className = 'tiles-2048-row';
    rowElement.setAttribute('role', 'row');
    rowElement.setAttribute('aria-rowindex', String(row + 1));
    grid.append(rowElement);
    for (let column = 0; column < 4; column += 1) {
      const cell = document.createElement('div');
      cell.className = 'tiles-2048-cell';
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-colindex', String(column + 1));
      cell.setAttribute('aria-rowindex', String(row + 1));
      const value = document.createElement('span');
      value.className = 'tiles-2048-value';
      value.setAttribute('aria-hidden', 'true');
      cell.append(value);
      const ornament = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      ornament.setAttribute('viewBox', '0 0 100 100');
      ornament.setAttribute('aria-hidden', 'true');
      ornament.classList.add('tiles-2048-ornament');
      ornament.innerHTML = '<path d="M12 29V12H29M71 12H88V29M88 71V88H71M29 88H12V71" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M17 17Q29 16 26 25Q17 29 17 17M83 17Q84 29 75 26Q71 17 83 17M83 83Q71 84 74 75Q83 71 83 83M17 83Q16 71 25 74Q29 83 17 83" fill="currentColor"/><path d="M42 12H58M42 88H58" stroke="currentColor" stroke-width="1"/>';
      cell.append(ornament);
      rowElement.append(cell);
      cells.push(cell);
    }
  }
  container.append(element);

  function emit() {
    const maximum = Math.max(...state.board);
    onUpdate({
      phase: state.phase, score: state.score, record: state.score, recordKey: mode === 'puzzles' ? 'puzzles' : 'default',
      recordLabel: 'BEST SCORE', scoreLabel: 'SCORE',
      detail: mode === 'puzzles' ? `Puzzle ${state.level + 1}/6 · Target ${PUZZLES[state.level].target} · ${state.moves}/${PUZZLES[state.level].budget} moves` : `${state.moves} ${state.moves === 1 ? 'move' : 'moves'} · Highest tile ${maximum}`,
    });
  }

  function paint(result = null, direction = null) {
    if (destroyed) return;
    clearTimeout(animationTimer);
    challengePanel.hidden = mode !== 'puzzles';
    element.querySelector('.tiles-2048-hint').hidden = mode === 'puzzles';
    for (const button of element.querySelectorAll('[data-mode]')) button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
    if (mode === 'puzzles') { const puzzle = PUZZLES[state.level]; puzzleTitle.textContent = `${state.level + 1} / 6 · ${puzzle.title}`; budget.textContent = `TARGET ${puzzle.target} · ${Math.max(0, puzzle.budget - state.moves)} MOVES LEFT`; for (let i = 0; i < 6; i++) progress.children[i].dataset.state = i < state.level || state.phase === 'won' && i === state.level ? 'done' : i === state.level ? 'current' : 'future'; }
    nextButton.hidden = mode !== 'puzzles' || state.phase !== 'won' || state.level === PUZZLES.length - 1;
    retryButton.hidden = mode !== 'puzzles' || state.phase !== 'lost';
    const dx = direction === 'left' ? '8px' : direction === 'right' ? '-8px' : '0px';
    const dy = direction === 'up' ? '8px' : direction === 'down' ? '-8px' : '0px';
    grid.style.setProperty('--tile-move-x', dx);
    grid.style.setProperty('--tile-move-y', dy);
    cells.forEach((cell, index) => {
      const value = state.board[index];
      const changed = cell.dataset.value !== String(value);
      cell.classList.remove('is-merged', 'is-new', 'is-sliding');
      cell.dataset.value = String(value);
      cell.classList.toggle('is-large', value >= 10000);
      cell.firstElementChild.textContent = value ? String(value) : '';
      cell.setAttribute('aria-label', `Row ${Math.floor(index / 4) + 1}, column ${index % 4 + 1}: ${value || 'empty'}`);
      if (result?.merged.includes(index)) cell.classList.add('is-merged');
      else if (result?.spawned?.index === index) cell.classList.add('is-new');
      else if (direction && changed && value) cell.classList.add('is-sliding');
    });
    if (result) animationTimer = setTimeout(() => cells.forEach(cell => cell.classList.remove('is-merged', 'is-new', 'is-sliding')), 220);
    undoButton.disabled = !state.undoAvailable;
    moveButtons.forEach(button => { button.disabled = state.phase !== 'playing'; });
    element.dataset.phase = state.phase;
    overlay.hidden = state.phase === 'playing';
    continueButton.hidden = state.phase !== 'won' || mode === 'puzzles';
    resumeButton.hidden = state.phase !== 'paused';
    if (state.phase === 'paused') {
      title.textContent = 'A moment to think.';
      description.textContent = 'Your board is waiting right here.';
      notice.textContent = 'Game paused.';
    } else if (state.phase === 'won') {
      title.textContent = mode === 'puzzles' ? state.level === PUZZLES.length - 1 ? 'Six puzzles. Solved.' : `Target ${PUZZLES[state.level].target}. Solved.` : '2048. Well played.';
      description.textContent = mode === 'puzzles' ? state.level === PUZZLES.length - 1 ? `A complete puzzle tour in ${state.totalMoves} moves.` : `${state.moves} moves used. Your score carries to the next puzzle.` : 'Keep going and see how far you can reach.';
      notice.textContent = mode === 'puzzles' ? state.level === PUZZLES.length - 1 ? 'All six challenges complete.' : 'Puzzle complete. Choose Next puzzle when you’re ready.' : 'You reached 2048! Choose Keep going to continue.';
    } else if (state.phase === 'lost') {
      title.textContent = mode === 'puzzles' ? 'A different route awaits.' : 'A full board.';
      description.textContent = mode === 'puzzles' ? state.result === 'budget' ? 'The move budget ran out. Undo once or retry this puzzle.' : 'These tiles cannot reach the target. Undo once or retry this puzzle.' : 'No more moves. Undo your last move or start a new game.';
      notice.textContent = `No moves left. Final score ${state.score}.`;
    } else {
      notice.textContent = result?.gained ? `Merged for ${result.gained} points. Score ${state.score}.` : `${state.moves} moves. Score ${state.score}.`;
    }
    emit();
  }

  function slide(direction) {
    if (destroyed) return;
    const result = move(state, direction);
    if (result.changed) paint(result, direction);
  }

  function focusBoard() { grid.focus({ preventScroll: true }); }

  function onKey(event) {
    if (destroyed || event.altKey || event.ctrlKey || event.metaKey || event.defaultPrevented) return;
    if (event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    const direction = keyDirections[event.key] || keyDirections[event.key.toLowerCase()];
    if (!direction) return;
    // This listener is scoped to the game: page navigation keeps its normal keys.
    event.preventDefault();
    slide(direction);
  }

  function onClick(event) {
    const modeButton = event.target.closest('button[data-mode]');
    if (modeButton) { mode = modeButton.dataset.mode; pointer = null; state = createState({ mode }); paint(); focusBoard(); return; }
    const button = event.target.closest('button[data-action]');
    if (!button || !element.contains(button) || button.disabled) return;
    const action = button.dataset.action;
    if (action.startsWith('move-')) slide(action.slice(5));
    else if (action === 'undo' && undo(state)) paint();
    else if (action === 'continue' && continueGame(state)) paint();
    else if (action === 'next-puzzle' && nextPuzzle(state)) paint();
    else if (action === 'retry-puzzle' && retryPuzzle(state)) paint();
    else if (action === 'resume' && togglePause(state)) paint();
    focusBoard();
  }

  function onPointerDown(event) {
    if (state.phase !== 'playing' || (event.pointerType === 'mouse' && event.button !== 0)) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    grid.setPointerCapture?.(event.pointerId);
    focusBoard();
  }

  function onPointerUp(event) {
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    pointer = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 26) return;
    slide(Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  }

  function onPointerCancel() { pointer = null; }
  container.addEventListener('keydown', onKey);
  element.addEventListener('click', onClick);
  grid.addEventListener('pointerdown', onPointerDown);
  grid.addEventListener('pointerup', onPointerUp);
  grid.addEventListener('pointercancel', onPointerCancel);
  paint();

  return {
    getState() { return JSON.parse(JSON.stringify(state)); },
    restart() {
      if (destroyed) return;
      pointer = null;
      state = createState({ mode });
      paint();
      focusBoard();
    },
    togglePause() {
      if (!destroyed && togglePause(state)) {
        pointer = null;
        paint();
      }
    },
    destroy() {
      destroyed = true;
      clearTimeout(animationTimer);
      pointer = null;
      container.removeEventListener('keydown', onKey);
      element.removeEventListener('click', onClick);
      grid.removeEventListener('pointerdown', onPointerDown);
      grid.removeEventListener('pointerup', onPointerUp);
      grid.removeEventListener('pointercancel', onPointerCancel);
      element.remove();
    },
  };
}
