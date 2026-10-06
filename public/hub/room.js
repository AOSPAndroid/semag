import * as topdown from '../topdown-engine.js';
import * as checkers from '../checkers-engine.js';
import * as cards from '../cards-engine.js';
import * as vector from '../vector-engine.js';
import { TopdownRenderer } from '../topdown-renderer.js';
import { CheckersView } from '../checkers-view.js';
import { CardsView } from '../cards-view.js';
import { VectorRenderer } from '../vector-renderer.js';
import { GameAudio } from '../audio.js';
import { GAMES, roomUrl, getName, saveName, hostInfo, copyText } from './shared.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const roomId = (params.get('room') || '').toUpperCase();
const gameId = GAMES[params.get('game')] ? params.get('game') : 'relic-duel';
const game = GAMES[gameId], boardMode = gameId === 'checkers', coop = gameId === 'dungeon-run';
const vectorMode = gameId === 'vector-arena';
const cardMode = ['crazy-eights', 'twenty-one', 'memory'].includes(gameId), realtimeMode = !boardMode && !cardMode;
const engine = boardMode ? checkers : cardMode ? cards : vectorMode ? vector : topdown;
const emptyInput = vectorMode ? vector.emptyInput : topdown.emptyInput, clone = state => JSON.parse(JSON.stringify(state));
const initialState = () => boardMode ? checkers.createState() : cardMode ? cards.viewForPlayer(cards.createState(gameId), 0) : vectorMode ? vector.createState() : topdown.createState(coop ? 'coop' : 'duel');
let authoritative = initialState();
let predicted = clone(authoritative), players = [null, null], localId = null;
let socket, connected = false, permanentlyClosed = false, intentionalClose = false, attempts = 0, reconnectTimer;
let sequence = 0, pending = [], snapshots = [], keys = emptyInput(), correction = { x: 0, y: 0 };
let playerName = getName(), invite = location.href, ping = null, lastSnapshotAt = 0;
let previousPhase = 'lobby', flashUntil = 0, countdownLast = null, toastTimer, focusLost = false;
const audio = new GameAudio();
const canvas = $('arena');
const renderer = realtimeMode ? vectorMode ? new VectorRenderer(canvas) : new TopdownRenderer(canvas) : null;
const board = boardMode ? new CheckersView($('checkers-board'), { onMove: (from, to) => send({ type: 'move', from, to }) }) : null;
const cardTable = cardMode ? new CardsView($('cards-table'), { onAction: action => send({ type: 'card-action', action }) }) : null;
const held = new Set();
const safeName = (name, fallback) => typeof name === 'string' && name.trim() ? name.trim().slice(0, 24) : fallback;

document.title = `${game.title} — Fireside`;
$('game-title').textContent = game.title;
$('game-category').textContent = game.category;
$('game-description').textContent = game.description;
$('room-code-label').textContent = roomId || '—';
$('player-name').value = playerName;
$('room-app').classList.toggle('board-mode', boardMode);
$('room-app').classList.toggle('card-mode', cardMode);
$('room-app').classList.toggle('vector-mode', vectorMode);
$('checkers-board').hidden = !boardMode; $('cards-table').hidden = !cardMode; canvas.hidden = !realtimeMode;
$('controls-panel').hidden = !realtimeMode; $('board-instructions').hidden = !boardMode; $('card-instructions').hidden = !cardMode;
$('party-title').textContent = coop ? 'Your party' : 'Your room';
$('footer-mode').textContent = coop ? 'TWO-PLAYER CO-OP' : boardMode ? 'AMERICAN CHECKERS' : cardMode ? 'TWO-PLAYER CARD TABLE' : 'REAL-TIME 1V1';
$('stage-label').textContent = coop ? 'THE RUINS / TWO ADVENTURERS' : 'THE MOSS GARDEN / 120 HZ';
if (vectorMode) {
  canvas.setAttribute('aria-label', 'Vector Arena. WASD or arrow keys move, mouse aims, left mouse or J fires, right mouse or I focuses, Space dashes, R reloads.');
  $('stage-label').textContent = 'THE OVERGROWN GRID / 120 HZ';
  $('controls-panel').innerHTML = `<h2>Keep your angles.</h2><div class="control-line"><span class="keys"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span><span>Move</span></div><div class="control-line"><kbd class="wide-key">MOUSE</kbd><span>Aim</span></div><div class="control-line"><kbd class="wide-key">LMB / J</kbd><span>Hold to fire</span></div><div class="control-line"><kbd class="wide-key">RMB / I</kbd><span>Focus aim</span></div><div class="control-line"><kbd class="wide-key">SPACE</kbd><span>Dash / evade</span></div><div class="control-line"><kbd>R</kbd><span>Reload</span></div><p id="combat-tip">Focus slows your movement and removes recoil. Use cover, lead your shots, and dash after the four-frame startup. Dashing cancels a reload.</p><details><summary>Timing &amp; touch controls</summary><p>Six shots per magazine. Reload takes 1.1 seconds. Dash costs 28 stamina and evades bullets during frames 4–15. Shift also dashes. On touch screens, use the Move and Aim pads with the Fire, Focus, Dash, and Reload buttons.</p></details>`;
}
if (coop) $('combat-tip').textContent = 'Clear three waves, then defeat the Warden. Hold guard near a fallen ally for 1.5 seconds to revive them. No friendly fire.';
if (cardMode) {
  const rules = {
    'crazy-eights': { title: 'Empty your hand.', intro: 'Take turns matching the top discard by rank or suit.', steps: ['Play an eight on any card, then choose the next suit.', 'If you cannot play, draw one card. Play it if it fits, or pass.', 'The first player with no cards wins.'], keyboard: 'Tab to a card or action, then press Enter or Space.' },
    'twenty-one': { title: 'Know when to hold.', intro: 'A five-round head-to-head game. Get closer to 21 than your friend.', steps: ['Hit to take a card, or stand to keep your hand.', 'Aces count as 1 or 11. Picture cards count as 10.', 'Go over 21 and you bust. Both hands reveal after both players finish.', 'Win a round for one point. The most points after five rounds wins.'], keyboard: 'Use Tab and Enter for Hit or Stand. There is no dealer or betting.' },
    memory: { title: 'Remember the faces.', intro: 'Take turns flipping two cards and finding identical rank-and-suit pairs.', steps: ['Choose two face-down cards on your turn.', 'Keep a matching pair and take another turn.', 'A miss stays visible for a moment, then your friend takes a turn.', 'The most pairs when the table is clear wins.'], keyboard: 'Tab to the cards. Arrow keys move; Enter or Space flips.' },
  }[gameId];
  $('card-rules-title').textContent = rules.title; $('card-rules-intro').textContent = rules.intro;
  $('card-rules-list').replaceChildren(...rules.steps.map(text => { const li = document.createElement('li'); li.textContent = text; return li; }));
  $('card-rules-keyboard').textContent = rules.keyboard;
}

function error(message) { $('error-banner').textContent = message || ''; $('error-banner').hidden = !message; }
function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 2700); }
function send(message) { if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message)); }
function updateConnection() {
  $('connection-dot').classList.toggle('online', connected);
  $('connection-status').textContent = connected ? 'HOST CONNECTED' : permanentlyClosed ? 'ROOM UNAVAILABLE' : 'RECONNECTING';
  $('ping').textContent = ping == null ? '— ms' : `${ping} ms`;
  $('p1-you').hidden = localId !== 0; $('p2-you').hidden = localId !== 1;
}
function receiveState(message) {
  const state = message.state;
  if (!state || (boardMode ? !state.board : cardMode ? state.gameId !== gameId : !state.fighters)) return;
  lastSnapshotAt = performance.now(); players = message.players || players;
  const old = realtimeMode && localId != null ? { x: predicted.fighters[localId].x, y: predicted.fighters[localId].y } : null;
  const phase = authoritative.phase; authoritative = state;
  if (realtimeMode) {
    pending = pending.filter(frame => frame.seq > (message.acks?.[localId] ?? -1));
    predicted = clone(state);
    if (localId != null && state.phase === 'fight') {
      const remote = { ...emptyInput(), ...state.fighters[1 - localId].previousInput };
      for (const frame of pending) {
        const inputs = [emptyInput(), emptyInput()]; inputs[localId] = frame.buttons; inputs[1 - localId] = remote;
        engine.step(predicted, inputs);
      }
      if (old && phase === 'fight') {
        const own = predicted.fighters[localId];
        correction.x = Math.max(-45, Math.min(45, old.x + correction.x - own.x));
        correction.y = Math.max(-45, Math.min(45, old.y + correction.y - own.y));
      }
    } else correction = { x: 0, y: 0 };
    snapshots.push({ time: lastSnapshotAt, state: clone(state) }); if (snapshots.length > 12) snapshots.shift();
    audio.playEvents(state.events || []);
  } else if (boardMode && state.lastMove && state.lastMove.tick !== receiveState.lastMoveTick) {
    receiveState.lastMoveTick = state.lastMove.tick;
    audio.playEvents([{ id: state.moves * 1000 + state.lastMove.tick, type: state.lastMove.capture == null ? 'block' : 'hit', x: 0, y: 0 }]);
  }
  if (state.phase !== previousPhase) {
    if (state.phase === 'fight' && realtimeMode) { flashUntil = performance.now() + 550; audio.fight(); }
    if (state.phase === 'lobby') { releaseKeys(); countdownLast = null; board?.resetSelection(); cardTable?.resetSelection(); }
    previousPhase = state.phase;
  }
}
function connect() {
  clearTimeout(reconnectTimer);
  if (permanentlyClosed || intentionalClose) return;
  if (!/^[A-Z0-9]{6}$/.test(roomId)) { permanentlyClosed = true; error('This invite has no valid room code. Go back to Fireside and choose a game.'); updateConnection(); return; }
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws?room=${encodeURIComponent(roomId)}`);
  socket = ws;
  ws.addEventListener('open', () => {
    connected = true; attempts = 0; sequence = 0; pending = []; snapshots = []; ping = null;
    lastSnapshotAt = performance.now(); send({ type: 'join', name: playerName }); error(''); updateConnection();
  });
  ws.addEventListener('message', ({ data }) => {
    let message; try { message = JSON.parse(data); } catch { return; }
    if (message.type === 'welcome') {
      if (message.gameId !== gameId) { intentionalClose = true; location.replace(roomUrl({ id: roomId, gameId: message.gameId })); return; }
      localId = message.playerId;
      if (vectorMode) { vectorAim = { x: localId === 1 ? -1 : 1, y: 0 }; pointerTarget = null; refreshKeys(); }
      updateConnection();
    } else if (message.type === 'state') receiveState(message);
    else if (message.type === 'pong') { ping = Math.max(0, Math.round(performance.now() - message.time)); updateConnection(); }
    else if (message.type === 'error') {
      error(message.message || 'The host could not accept that action.'); board?.resetSelection(); cardTable?.resetSelection();
      if (/full|two players|occupied|not found|expired|unknown room/i.test(message.message || '')) permanentlyClosed = true;
    }
  });
  ws.addEventListener('close', () => {
    connected = false; localId = null; ping = null; pending = []; snapshots = []; releaseKeys();
    authoritative = initialState(); predicted = clone(authoritative);
    players = [null, null]; board?.resetSelection(); cardTable?.resetSelection(); renderer?.resetEffects(); updateConnection();
    if (!permanentlyClosed && !intentionalClose) {
      error('Connection to the host was lost. Reconnecting automatically…');
      reconnectTimer = setTimeout(connect, Math.min(5000, 750 * 2 ** attempts++));
    }
  });
  ws.addEventListener('error', () => {});
}

const keyMap = new Map(vectorMode ? [
  ['KeyA', 'left'], ['ArrowLeft', 'left'], ['KeyD', 'right'], ['ArrowRight', 'right'],
  ['KeyW', 'up'], ['ArrowUp', 'up'], ['KeyS', 'down'], ['ArrowDown', 'down'],
  ['KeyJ', 'fire'], ['Space', 'dash'], ['ShiftLeft', 'dash'], ['ShiftRight', 'dash'],
  ['KeyR', 'reload'], ['KeyI', 'focus'],
] : [
  ['KeyA', 'left'], ['ArrowLeft', 'left'], ['KeyD', 'right'], ['ArrowRight', 'right'],
  ['KeyW', 'up'], ['ArrowUp', 'up'], ['KeyS', 'down'], ['ArrowDown', 'down'],
  ['KeyJ', 'attack'], ['KeyK', 'shoot'], ['Space', 'roll'], ['ShiftLeft', 'roll'], ['ShiftRight', 'roll'],
  ['KeyI', 'block'], ['KeyL', 'block'],
]);
let vectorAim = { x: 1, y: 0 }, pointerTarget = null;
const pointerButtons = { fire: false, focus: false }, touchButtons = Object.create(null), touchPointers = new Map();
const vectorPresses = new Set(), vectorButtonKeys = new Map();
function typing(target) { return target instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable); }
function refreshKeys() {
  keys = emptyInput();
  for (const code of held) if (keyMap.has(code)) keys[keyMap.get(code)] = true;
  if (!vectorMode) return;
  for (const [key, value] of Object.entries(touchButtons)) if (value) keys[key] = true;
  for (const action of vectorButtonKeys.values()) keys[action] = true;
  keys.fire ||= pointerButtons.fire; keys.focus ||= pointerButtons.focus;
  if (pointerTarget && localId != null) {
    const own = predicted.fighters[localId], dx = pointerTarget.x - own.x, dy = pointerTarget.y - own.y;
    const length = Math.hypot(dx, dy);
    if (length > 1) vectorAim = { x: dx / length, y: dy / length };
  }
  keys.aimX = vectorAim.x; keys.aimY = vectorAim.y;
}
function releaseKeys() {
  held.clear(); vectorPresses.clear(); vectorButtonKeys.clear(); pointerButtons.fire = false; pointerButtons.focus = false;
  for (const key of Object.keys(touchButtons)) delete touchButtons[key];
  for (const [id, control] of touchPointers) {
    control.classList.remove('is-held'); control.style.removeProperty('--pad-x'); control.style.removeProperty('--pad-y');
    if (control.hasPointerCapture?.(id)) control.releasePointerCapture(id);
  }
  touchPointers.clear(); refreshKeys();
  if (realtimeMode && connected && localId != null) {
    const frame = { type: 'input', seq: ++sequence, buttons: { ...keys } }; pending.push(frame); send(frame);
  }
}
document.addEventListener('keydown', event => {
  if (typing(event.target) || event.isComposing || event.metaKey || event.ctrlKey || event.altKey) return;
  if (vectorMode) {
    const interactive = event.target instanceof Element ? event.target.closest('button, a, summary') : null;
    if (interactive && ['Space', 'Enter'].includes(event.code)) {
      const action = interactive.dataset.vectorAction;
      if (!action || event.repeat && !vectorButtonKeys.has(event.code)) return;
      event.preventDefault();
      if (!vectorButtonKeys.has(event.code) && ['fire', 'dash', 'reload'].includes(action)) vectorPresses.add(action);
      vectorButtonKeys.set(event.code, action); refreshKeys(); focusLost = false; return;
    }
    if (event.repeat && !held.has(event.code)) return;
    const action = keyMap.get(event.code);
    if (!held.has(event.code) && ['fire', 'dash', 'reload'].includes(action)) vectorPresses.add(action);
  }
  if (!vectorMode && event.code === 'KeyR' && !event.repeat) { event.preventDefault(); $('ready-button').click(); }
  if (realtimeMode && keyMap.has(event.code)) { event.preventDefault(); held.add(event.code); refreshKeys(); focusLost = false; }
});
document.addEventListener('keyup', event => {
  if (vectorMode && vectorButtonKeys.has(event.code)) { vectorButtonKeys.delete(event.code); refreshKeys(); event.preventDefault(); return; }
  if (vectorMode && event.code === 'Space' && !held.has(event.code) && event.target instanceof Element && event.target.closest('button, a, summary')) return;
  if (realtimeMode && keyMap.has(event.code)) { held.delete(event.code); refreshKeys(); if (!typing(event.target)) event.preventDefault(); }
});
window.addEventListener('blur', () => { releaseKeys(); focusLost = true; });
document.addEventListener('visibilitychange', () => { if (document.hidden) releaseKeys(); });
canvas.addEventListener('pointerdown', event => {
  canvas.focus(); focusLost = false;
  if (!vectorMode) return;
  event.preventDefault(); updatePointerAim(event);
  if (event.pointerType === 'mouse' || event.pointerType === 'pen') {
    pointerButtons.fire = !!(event.buttons & 1); pointerButtons.focus = !!(event.buttons & 2);
    if (event.button === 0) vectorPresses.add('fire');
  }
  canvas.setPointerCapture(event.pointerId); refreshKeys();
});
function updatePointerAim(event) {
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  pointerTarget = {
    x: Math.max(0, Math.min(vector.WORLD.width, (event.clientX - rect.left) * vector.WORLD.width / rect.width)),
    y: Math.max(0, Math.min(vector.WORLD.height, (event.clientY - rect.top) * vector.WORLD.height / rect.height)),
  };
}
canvas.addEventListener('pointermove', event => {
  if (!vectorMode) return;
  updatePointerAim(event);
  if (event.pointerType === 'mouse' || event.pointerType === 'pen') {
    pointerButtons.fire = !!(event.buttons & 1); pointerButtons.focus = !!(event.buttons & 2);
  }
  refreshKeys();
});
function releasePointer(event) {
  if (!vectorMode || event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
  pointerButtons.fire = event.type === 'pointerup' && !!(event.buttons & 1);
  pointerButtons.focus = event.type === 'pointerup' && !!(event.buttons & 2);
  if (event.type === 'pointercancel') vectorPresses.delete('fire');
  refreshKeys();
}
window.addEventListener('pointerup', releasePointer);
window.addEventListener('pointercancel', releasePointer);
canvas.addEventListener('lostpointercapture', () => {
  if (vectorMode) { if (pointerButtons.fire) vectorPresses.delete('fire'); pointerButtons.fire = false; pointerButtons.focus = false; refreshKeys(); }
});
canvas.addEventListener('contextmenu', event => { if (vectorMode) event.preventDefault(); });
setupVectorTouch();
function setupVectorTouch() {
  const controls = $('vector-controls'); controls.hidden = !vectorMode;
  if (!vectorMode) return;
  const updatePad = (control, event) => {
    const rect = control.getBoundingClientRect(), radius = Math.max(1, Math.min(rect.width, rect.height) * .36);
    const dx = (event.clientX - rect.left - rect.width / 2) / radius;
    const dy = (event.clientY - rect.top - rect.height / 2) / radius;
    const length = Math.hypot(dx, dy), scale = Math.max(1, length);
    control.style.setProperty('--pad-x', `${dx / scale * 25}px`);
    control.style.setProperty('--pad-y', `${dy / scale * 25}px`);
    if (control.dataset.vectorPad === 'move') {
      touchButtons.left = dx < -.25; touchButtons.right = dx > .25;
      touchButtons.up = dy < -.25; touchButtons.down = dy > .25;
    } else if (length > .2) {
      vectorAim = { x: dx / length, y: dy / length }; pointerTarget = null;
    }
    refreshKeys();
  };
  for (const control of controls.querySelectorAll('[data-vector-pad], [data-vector-action]')) {
    const release = event => {
      if (touchPointers.get(event.pointerId) !== control) return;
      touchPointers.delete(event.pointerId); control.classList.remove('is-held');
      control.style.removeProperty('--pad-x'); control.style.removeProperty('--pad-y');
      if (control.dataset.vectorPad === 'move') for (const key of ['left', 'right', 'up', 'down']) touchButtons[key] = false;
      if (control.dataset.vectorAction) touchButtons[control.dataset.vectorAction] = false;
      if (event.type !== 'pointerup' && control.dataset.vectorAction) vectorPresses.delete(control.dataset.vectorAction);
      refreshKeys();
      if (control.hasPointerCapture(event.pointerId)) control.releasePointerCapture(event.pointerId);
    };
    control.addEventListener('pointerdown', event => {
      if (event.button !== 0 || [...touchPointers.values()].includes(control)) return;
      event.preventDefault(); canvas.focus(); focusLost = false;
      touchPointers.set(event.pointerId, control); control.setPointerCapture(event.pointerId); control.classList.add('is-held');
      if (control.dataset.vectorPad) updatePad(control, event);
      else {
        const action = control.dataset.vectorAction; touchButtons[action] = true;
        if (['fire', 'dash', 'reload'].includes(action)) vectorPresses.add(action);
        refreshKeys();
      }
    });
    control.addEventListener('pointermove', event => { if (touchPointers.get(event.pointerId) === control && control.dataset.vectorPad) updatePad(control, event); });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) control.addEventListener(type, release);
  }
}
$('player-name').addEventListener('focus', releaseKeys);
$('player-name').addEventListener('change', () => { playerName = saveName($('player-name').value); $('player-name').value = playerName; send({ type: 'join', name: playerName }); });
$('player-name').addEventListener('keydown', event => { if (event.key === 'Enter') event.target.blur(); });
$('ready-button').addEventListener('click', () => {
  if (!connected || localId == null) return;
  if (authoritative.phase === 'fight' || authoritative.phase === 'roundEnd') return;
  send(authoritative.phase === 'matchEnd' ? { type: 'rematch' } : { type: 'ready', ready: !players[localId]?.ready });
  $('player-name').blur(); if (realtimeMode) canvas.focus();
});
$('copy-code').addEventListener('click', async () => { try { await copyText(roomId); toast('Room code copied.'); } catch (e) { toast(e.message); } });
$('copy-invite').addEventListener('click', async () => { try { await copyText(invite); toast('Invite copied. Your friend has a seat.'); } catch (e) { toast(e.message); } });
hostInfo().then(info => { invite = info.origin + location.pathname + location.search; $('invite-address').textContent = invite; }).catch(() => { $('invite-address').textContent = invite; });
$('sound-button').addEventListener('click', async () => {
  await audio.setEnabled(!audio.enabled);
  $('sound-button').setAttribute('aria-pressed', String(audio.enabled));
  $('sound-button').setAttribute('aria-label', audio.enabled ? 'Mute sound' : 'Enable sound');
  $('sound-button').title = audio.enabled ? 'Mute sound' : 'Enable sound';
});
$('fullscreen-button').addEventListener('click', async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await $('room-app').requestFullscreen(); } catch { toast('Fullscreen is unavailable in this browser.'); } });

function inputTick() {
  if (!realtimeMode || !connected || localId == null) return;
  if (vectorMode) refreshKeys();
  const buttons = { ...keys };
  if (vectorMode) { for (const action of vectorPresses) buttons[action] = true; vectorPresses.clear(); }
  const frame = { type: 'input', seq: ++sequence, buttons }; pending.push(frame); send(frame);
  if (pending.length > 180) pending.shift();
  if (predicted.phase === 'fight') {
    const inputs = [emptyInput(), emptyInput()]; inputs[localId] = frame.buttons;
    inputs[1 - localId] = { ...emptyInput(), ...authoritative.fighters[1 - localId].previousInput };
    engine.step(predicted, inputs);
  }
}
function displayState(now) {
  if (authoritative.phase !== 'fight' || localId == null) return authoritative;
  const state = { ...predicted, fighters: predicted.fighters.map(f => ({ ...f })), events: authoritative.events || [] };
  state.fighters[localId].x += correction.x; state.fighters[localId].y += correction.y;
  correction.x *= .72; correction.y *= .72;
  const target = now - 35;
  let before = snapshots[0], after = snapshots.at(-1);
  for (let i = 1; i < snapshots.length; i++) if (snapshots[i].time >= target) { before = snapshots[i - 1]; after = snapshots[i]; break; }
  if (before && after && before.state.phase === 'fight' && after.state.phase === 'fight') {
    const a = before.state.fighters[1 - localId], b = after.state.fighters[1 - localId];
    const alpha = Math.max(0, Math.min(1, (target - before.time) / Math.max(1, after.time - before.time)));
    state.fighters[1 - localId] = { ...b, x: a.x + (b.x - a.x) * alpha, y: a.y + (b.y - a.y) * alpha };
  }
  return state;
}
function cardObjective(state, names) {
  if (state.phase === 'matchEnd') return state.winner == null ? 'A draw. Ready for another game?' : `${names[state.winner]} wins. Ready for a rematch?`;
  if (state.phase === 'roundEnd') {
    const outcome = state.roundWinner == null ? 'Round drawn' : `${names[state.roundWinner]} takes the round`;
    return `${outcome}. Next hand in ${Math.max(1, Math.ceil(state.phaseTicks / 120))}s.`;
  }
  if (state.phase !== 'fight') return 'Both players must ready up to begin.';
  if (gameId === 'twenty-one') return 'Hit or stand. Both players finish before the hands reveal.';
  if (gameId === 'memory') return state.mismatchTicks > 0 ? 'Remember these two cards before they turn over.' : `${names[state.turn]}'s turn. Match identical cards to keep your turn.`;
  return `${names[state.turn]}'s turn. Match the rank or suit, or play an eight.`;
}
function updateHUD(now) {
  const state = authoritative, phase = state.phase;
  const names = players.map((p, i) => safeName(p?.name, `Player ${i + 1}`));
  const active = ['countdown', 'fight', 'roundEnd'].includes(phase);
  for (let i = 0; i < 2; i++) {
    const prefix = `p${i + 1}`, player = players[i];
    $(prefix + '-name').textContent = names[i].toUpperCase();
    $(`slot${i + 1}-name`).textContent = player?.connected ? names[i] : 'Waiting for a friend';
    $(`slot${i + 1}-status`).textContent = player?.connected ? player.ready ? 'Ready to play' : active ? 'In the game' : 'Not ready yet' : 'Seat open';
    $(`slot${i + 1}-dot`).className = `slot-dot ${player?.connected ? player.ready ? 'ready' : 'connected' : ''}`;
    $(`slot${i + 1}-avatar`).textContent = player?.connected ? names[i].slice(0, 1).toUpperCase() : `0${i + 1}`;
    if (boardMode) {
      const pieces = state.board.filter(p => p?.owner === i).length, kings = state.board.filter(p => p?.owner === i && p.king).length;
      $(prefix + '-score').textContent = pieces;
      $(prefix + '-detail').textContent = `${pieces} PIECES / ${kings} KINGS`;
    } else if (cardMode) {
      $(prefix + '-score').textContent = gameId === 'crazy-eights' ? state.handCounts[i] : state.scores[i];
      $(prefix + '-detail').textContent = gameId === 'crazy-eights' ? 'CARDS IN HAND' : gameId === 'memory' ? 'PAIRS FOUND' : `${state.scores[i]} POINTS / ${state.totals[i] == null ? 'HIDDEN HAND' : state.totals[i] > 21 ? 'BUST' : `${state.totals[i]} IN HAND`}`;
    } else {
      const fighter = state.fighters[i];
      $(prefix + '-health').style.width = `${Math.max(0, fighter.hp)}%`;
      $(prefix + '-stamina').style.width = `${Math.max(0, fighter.stamina)}%`;
      $(prefix + '-score').textContent = coop ? fighter.downed ? '↓' : `${Math.ceil(fighter.hp)}` : `${fighter.wins} / 2`;
      $(prefix + '-detail').textContent = vectorMode ? fighter.reloadTicks > 0 ? `RELOAD ${(fighter.reloadTicks / 120).toFixed(1)}s` : `${fighter.ammo} / 6 SHOTS` : fighter.downed ? `REVIVE ${Math.round((fighter.reviveProgress || 0) / 180 * 100)}%` : fighter.guardBroken ? 'GUARD BROKEN' : fighter.action === 'block' ? 'GUARDING' : fighter.action === 'roll' ? 'EVADING' : 'STAMINA';
      if (vectorMode) {
        $(prefix + '-health-track').setAttribute('aria-label', `${names[i]} health: ${Math.ceil(fighter.hp)} of 100`);
        $(prefix + '-stamina-track').setAttribute('aria-label', `${names[i]} dash stamina: ${Math.round(fighter.stamina)} of 100`);
      }
    }
  }
  if (boardMode) {
    $('round-label').textContent = phase === 'fight' ? `TURN ${String(state.moves + 1).padStart(2, '0')}` : 'CHECKERS';
    $('timer').textContent = phase === 'fight' ? state.turn === localId ? 'YOU' : 'THEM' : '1V1';
    $('hud-caption').textContent = phase === 'fight' ? 'TO MOVE' : 'TAKE YOUR SEATS';
    $('objective').textContent = phase === 'fight' ? state.forcedFrom != null ? 'Finish your capture chain with the same piece.' : `${names[state.turn]}'s turn. Captures are required when available.` : phase === 'matchEnd' ? state.result === 'draw' ? 'Draw. Ready for another game?' : `${names[state.winner]} wins. Ready for a rematch?` : 'Both players must ready up to begin.';
    $('objective-detail').textContent = 'AMERICAN CHECKERS';
    board.render(state, { localId });
  } else if (cardMode) {
    const twentyOne = gameId === 'twenty-one';
    $('round-label').textContent = twentyOne ? `ROUND ${state.round} / ${state.maxRounds}` : gameId === 'memory' ? 'MEMORY MATCH' : 'CRAZY EIGHTS';
    $('timer').textContent = twentyOne ? '21' : phase === 'fight' ? state.turn === localId ? 'YOU' : 'THEM' : '1V1';
    $('hud-caption').textContent = twentyOne ? 'CLOSEST WINS' : phase === 'fight' ? gameId === 'memory' ? 'TO FLIP' : 'TO PLAY' : 'TAKE YOUR SEATS';
    $('objective').textContent = cardObjective(state, names);
    $('objective-detail').textContent = twentyOne ? 'FIVE ROUNDS / NO BETTING' : gameId === 'memory' ? `${state.pairsRemaining} PAIRS LEFT` : `${state.deckCount} IN DECK`;
    cardTable.render(state, { localId, players });
  } else if (coop) {
    $('round-label').textContent = 'DUNGEON RUN'; $('timer').textContent = `${Math.max(1, state.wave)} / ${state.maxWaves}`; $('hud-caption').textContent = 'WAVES';
    $('objective').textContent = phase === 'fight' ? state.objective : phase === 'matchEnd' ? state.result === 'victory' ? 'The ruins are clear. You made it home together.' : 'The party fell. Ready for another run?' : 'Both adventurers must ready up to begin.';
    $('objective-detail').textContent = `${state.enemies.filter(e => e.hp > 0).length} ENEMIES`;
  } else {
    $('round-label').textContent = `ROUND ${String(state.round).padStart(2, '0')}`;
    $('timer').textContent = String(Math.max(0, Math.ceil(state.roundTicks / 120))).padStart(2, '0'); $('hud-caption').textContent = 'FIRST TO TWO';
    $('objective').textContent = phase === 'fight' ? vectorMode ? 'Control an angle. Focus your shots. Keep a dash in reserve.' : 'Use the pillars as cover. Face your attacks and watch your stamina.' : phase === 'matchEnd' ? 'A winner. A rematch. Or a different game?' : 'Both players must ready up to begin.';
    $('objective-detail').textContent = '90 SECOND ROUNDS';
  }
  $('player-name').disabled = active;
  const mine = players[localId]; const button = $('ready-button');
  button.querySelector('span').textContent = phase === 'matchEnd' ? 'Play again' : phase === 'fight' || phase === 'roundEnd' || !boardMode && phase === 'countdown' && state.round > 1 ? 'Game in progress' : mine?.ready ? 'Cancel ready' : 'Ready up';
  button.disabled = !connected || localId == null || phase === 'fight' || phase === 'roundEnd' || !boardMode && phase === 'countdown' && state.round > 1;
  button.classList.toggle('is-ready', !!mine?.ready);
  $('ready-note').textContent = phase === 'matchEnd' ? 'Both players must ready up for another game.' : phase === 'roundEnd' && cardMode ? 'The next hand starts shortly.' : phase === 'fight' ? 'Make it a good one.' : phase === 'countdown' ? 'Both players are ready. Starting shortly.' : mine?.ready ? 'Waiting for your friend to ready up.' : 'The game starts when both players are ready.';
  $('focus-note').hidden = !realtimeMode || !focusLost || phase !== 'fight';
  updateOverlay(now, names);
}
function updateOverlay(now, names) {
  const state = authoritative, phase = state.phase, overlay = $('game-overlay');
  overlay.hidden = false; overlay.className = 'room-overlay';
  let kicker, title, subtitle;
  if (!connected) {
    kicker = permanentlyClosed ? 'THIS SEAT IS UNAVAILABLE' : 'FINDING THE HOST';
    title = permanentlyClosed ? 'Try another room.' : 'Reconnecting…';
    subtitle = permanentlyClosed ? 'Head back to the game shelf and choose an open room.' : 'Keep the host running. We’ll reconnect automatically.';
  } else if (phase === 'lobby') {
    kicker = coop ? 'ADVENTURE IS BETTER TOGETHER' : 'A LITTLE FRIENDLY COMPETITION';
    title = players.every(p => p?.connected) ? 'Take your places.' : 'A friend is on the way.';
    subtitle = players.every(p => p?.connected) ? 'Both players ready up, then the game begins.' : 'Send the room code or invite link, then ready up.';
  } else if (phase === 'countdown') {
    const number = Math.max(1, Math.ceil(state.phaseTicks / 120));
    kicker = coop ? 'STAY TOGETHER' : 'MAKE YOUR NEXT MOVE COUNT'; title = number; subtitle = coop ? 'Keep an eye on your friend.' : 'Good luck. Have fun.'; overlay.classList.add('countdown');
    if (number !== countdownLast) { audio.countdown(number); countdownLast = number; }
  } else if (phase === 'fight') {
    if (realtimeMode && now < flashUntil) { kicker = coop ? 'YOUR ADVENTURE STARTS HERE' : vectorMode ? 'TAKE YOUR ANGLE' : 'FIND YOUR OPENING'; title = coop ? 'LET’S GO' : vectorMode ? 'ENGAGE' : 'DUEL'; subtitle = ''; overlay.classList.add('fight'); }
    else overlay.hidden = true;
  } else if (cardMode) {
    // Keep showdown hands and memory pairs visible; results live above the table.
    overlay.hidden = true;
  } else if (coop) {
    kicker = state.result === 'victory' ? 'YOU MADE IT TOGETHER' : 'THE RUINS WILL BE WAITING'; title = state.result === 'victory' ? 'Adventure complete.' : 'The party fell.';
    subtitle = 'Ready up for another run, or choose another game.';
  } else {
    kicker = phase === 'roundEnd' ? `ROUND ${state.round} COMPLETE` : 'GOOD GAME. WELL PLAYED.';
    title = state.winner == null ? 'A well-earned draw.' : state.winner === localId ? 'You win.' : `${names[state.winner]} wins.`;
    subtitle = phase === 'roundEnd' ? 'Next round starts shortly.' : 'Both players ready up to play again.';
  }
  if (phase !== 'countdown') countdownLast = null;
  if (!overlay.hidden) { $('overlay-kicker').textContent = kicker; $('overlay-title').textContent = title; $('overlay-subtitle').textContent = subtitle; }
}

let previousTime = performance.now(), accumulator = 0, lastHUD = 0;
function animate(now) {
  accumulator += Math.min(65, now - previousTime); previousTime = now;
  let ticks = 0; while (accumulator >= 1000 / 120 && ticks++ < 8) { inputTick(); accumulator -= 1000 / 120; }
  renderer?.render(displayState(now), { localId, time: now, aimTarget: vectorMode ? pointerTarget : null });
  if (now - lastHUD > 50) { updateHUD(now); lastHUD = now; }
  requestAnimationFrame(animate);
}
window.firesideRoom = { getState: () => clone(authoritative), get playerId() { return localId; }, get connected() { return connected; }, roomId, gameId };
window.addEventListener('beforeunload', () => { intentionalClose = true; socket?.close(); });
window.addEventListener('resize', () => renderer?.resize());
setInterval(() => { if (connected) send({ type: 'ping', time: performance.now() }); }, 1000);
setInterval(() => { if (connected && performance.now() - lastSnapshotAt > 3000) { error('The host stopped responding. Reconnecting…'); socket.close(); } }, 1500);
connect(); updateConnection(); requestAnimationFrame(animate);
