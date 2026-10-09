import { setText, setAttribute, setHidden, setDisabled, setClass, toggleClass, setStyle, setHTML } from './dom.js';
import { gameCode, displayKey, formatKeyboardText, subscribeKeyboardLayout, mountKeyboardLayoutPicker } from '../keyboard-layout.js';
import { createCombatKeyMap, combatInputFromKeys } from '../combat-controls.js';
import * as topdown from '../topdown-engine.js';
import * as checkers from '../checkers-engine.js';
import * as cards from '../cards-engine.js';
import * as vector from '../vector-engine.js';
import * as shinobi from '../shinobi-engine.js';
import { createShinobiInputQueue, createShinobiMouseButtons, SHINOBI_EDGE_ACTIONS } from '../shinobi-input.js';
import * as brawl from '../brawl-engine.js';
import { TopdownRenderer } from '../topdown-renderer.js';
import { CheckersView } from '../checkers-view.js';
import { CardsView } from '../cards-view.js';
import { VectorRenderer } from '../vector-renderer.js';
import { ShinobiRenderer } from '../shinobi-renderer.js';
import { BrawlRenderer, drawFighterPortrait, drawStagePreview } from '../brawl-renderer.js';
import { GameAudio } from '../audio.js';
import { frameDecay, tickFraction } from '../display-timing.js';
import { capturePlanarPose, presentPlanarFighter, presentNetworkPlanarFighter, retainAdjacentPlanarPose, rebasePlanarCorrection, presentPlanarEntities } from '../planar-presentation.js';
import { createNetworkTimeline } from '../network-timeline.js';
import { GAMES, roomUrl, getName, saveName, hostInfo, copyText } from './shared.js';
import { createPvpPractice, PVP_PRACTICE_GAME_IDS } from './pvp-practice.js';

const elements = new Map();
const $ = id => { const node = elements.get(id) || document.getElementById(id); if (node) elements.set(id, node); return node; };
const params = new URLSearchParams(location.search);
const roomId = (params.get('room') || '').toUpperCase();
const gameId = GAMES[params.get('game')] ? params.get('game') : 'relic-duel';
const game = GAMES[gameId], boardMode = gameId === 'checkers', coop = gameId === 'dungeon-run';
const vectorMode = gameId === 'vector-arena', shinobiMode = gameId === 'shinobi-showdown', aimMode = vectorMode || shinobiMode, brawlMode = gameId === 'oddstock-rumble', modernControls = aimMode || brawlMode;
const cardMode = ['crazy-eights', 'twenty-one', 'memory'].includes(gameId), realtimeMode = !boardMode && !cardMode;
const engine = boardMode ? checkers : cardMode ? cards : vectorMode ? vector : shinobiMode ? shinobi : brawlMode ? brawl : topdown;
const emptyInput = vectorMode ? vector.emptyInput : shinobiMode ? shinobi.emptyInput : brawlMode ? brawl.emptyInput : topdown.emptyInput, clone = state => JSON.parse(JSON.stringify(state));
const practiceMode = params.get('practice') === '1' && PVP_PRACTICE_GAME_IDS.includes(gameId);
const practiceSession = practiceMode ? createPvpPractice(gameId, { difficulty: ['normal', 'hard', 'expert'].includes(params.get('difficulty')) ? params.get('difficulty') : 'hard', bots: shinobiMode ? Math.max(1, Math.min(4, Math.floor(Number(params.get('bots')) || 1))) : 1, ...(shinobiMode ? { stageId: Object.hasOwn(shinobi.STAGES, params.get('stage')) ? params.get('stage') : 'rooftop' } : {}) }) : null;
let practicePaused = false;
const initialState = () => practiceMode ? practiceSession.getState() : boardMode ? checkers.createState() : cardMode ? cards.viewForPlayer(cards.createState(gameId), 0) : vectorMode ? vector.createState() : shinobiMode ? shinobi.createState() : brawlMode ? brawl.createState() : topdown.createState(coop ? 'coop' : 'duel');
let authoritative = initialState();
let predicted = clone(authoritative), players = [null, null], localId = null;
let socket, connected = false, permanentlyClosed = false, intentionalClose = false, attempts = 0, reconnectTimer;
let sequence = 0, pending = [], snapshots = [], keys = emptyInput(), correction = { x: 0, y: 0 };
const timeline = createNetworkTimeline({ tickRate: engine.TICK_RATE || 120, snapshotTicks: 2 });
let snapshotContext = null;
let previousPose = null, lastDisplayTime = null;
let presentation = null, renderCount = 0;
let playerName = getName(), invite = location.href, ping = null, lastSnapshotAt = 0;
let previousPhase = 'lobby', flashUntil = 0, countdownLast = null, toastTimer, focusLost = false;
const audio = new GameAudio();
const canvas = $('arena');
const renderer = realtimeMode ? vectorMode ? new VectorRenderer(canvas) : shinobiMode ? new ShinobiRenderer(canvas) : brawlMode ? new BrawlRenderer(canvas) : new TopdownRenderer(canvas) : null;
const board = boardMode ? new CheckersView($('checkers-board'), { onMove: (from, to) => send({ type: 'move', from, to }) }) : null;
const cardTable = cardMode ? new CardsView($('cards-table'), { onAction: action => send({ type: 'card-action', action }) }) : null;
if (cardTable) {
  const progress = document.createElement('section');
  progress.className = 'cards-progress-panel';
  const title = document.createElement('h2');
  title.textContent = 'Match progress';
  progress.append(title, cardTable.context);
  document.querySelector('.room-sidebar').append(progress);
}
const held = new Map();
const safeName = (name, fallback) => typeof name === 'string' && name.trim() ? name.trim().slice(0, 24) : fallback;

document.title = `${game.title} — Semag`;
$('game-title').textContent = game.title;
$('game-category').textContent = game.category;
$('game-description').textContent = game.description;
$('room-panel-note').textContent = `${game.description} Invite a friend or check the controls here. Live games continue while this panel is open.`;
$('room-code-label').textContent = roomId || '—';
$('player-name').value = playerName;
$('room-app').classList.toggle('board-mode', boardMode);
$('room-app').classList.toggle('card-mode', cardMode);
$('room-app').classList.toggle('vector-mode', vectorMode);
$('room-app').classList.toggle('shinobi-mode', shinobiMode);
$('room-app').classList.toggle('brawl-mode', brawlMode);
$('game-title').setAttribute('title', game.description);
$('checkers-board').hidden = !boardMode; $('cards-table').hidden = !cardMode; canvas.hidden = !realtimeMode;
$('controls-panel').hidden = !realtimeMode; $('board-instructions').hidden = !boardMode; $('card-instructions').hidden = !cardMode;
$('party-title').textContent = coop ? 'Your party' : 'Your room';
$('footer-mode').textContent = coop ? 'TWO-PLAYER CO-OP' : boardMode ? 'AMERICAN CHECKERS' : cardMode ? 'TWO-PLAYER CARD TABLE' : 'REAL-TIME 1V1';
$('stage-label').textContent = coop ? 'THE RUINS / TWO ADVENTURERS' : 'THE MOSS GARDEN / 120 HZ';
if (vectorMode) {
  canvas.setAttribute('aria-label', 'Vector Arena. WASD or arrow keys move, mouse aims, left mouse or C fires, right mouse or F focuses, Space dashes, R reloads.');
  $('stage-label').textContent = 'THE OVERGROWN GRID / 120 HZ';
  $('controls-panel').innerHTML = `<h2>Keep your angles.</h2><div class="control-line"><span class="keys"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span><span>Move</span></div><div class="control-line"><kbd class="wide-key">MOUSE</kbd><span>Aim</span></div><div class="control-line"><kbd class="wide-key">LMB / C</kbd><span>Hold to fire</span></div><div class="control-line"><kbd class="wide-key">RMB / F</kbd><span>Focus aim</span></div><div class="control-line"><kbd class="wide-key">SPACE</kbd><span>Dash / evade</span></div><div class="control-line"><kbd>R</kbd><span>Reload</span></div><p id="combat-tip">Focus slows your movement and removes recoil. Use cover, lead your shots, and dash after the four-frame startup. Dashing cancels a reload.</p><details><summary>Timing &amp; touch controls</summary><p>Six shots per magazine. Reload takes 1.1 seconds. Dash costs 28 stamina and evades bullets during frames 4–15. Shift also dashes; J also fires and I also focuses. On touch screens, use the Move and Aim pads with the Fire, Focus, Dash, and Reload buttons.</p></details>`;
}
if (shinobiMode) {
  $('stage-label').textContent = 'MOONLIT ROOFTOPS / 120 HZ';
  $('controls-panel').innerHTML = `<h2>Read. Confirm. Outplay.</h2><div class="control-line"><span class="keys"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span><span>Move</span></div><div class="control-line"><kbd class="wide-key">MOUSE</kbd><span>Aim</span></div><div class="control-line"><kbd class="wide-key">LMB / C</kbd><span>Cut / link a confirmed hit</span></div><div class="control-line"><kbd class="wide-key">RMB / G</kbd><span>Committed heavy cut</span></div><div class="control-line"><kbd>R</kbd><span>Feint a heavy windup</span></div><div class="control-line"><kbd>E</kbd><span>Throw a kunai</span></div><div class="control-line"><kbd>F</kbd><span>Directional parry</span></div><div class="control-line"><kbd class="wide-key">SPACE</kbd><span>Dash / evade</span></div><p id="combat-tip">Confirm a light hit, then tap Cut again to link up to three strikes or Dash to retreat. Each cut locks your aim separately. Feint a heavy windup to bait a parry; its recovery leaves you open. Face the incoming strike and time a perfect parry for a stronger counter opening.</p><details><summary>Timing &amp; touch controls</summary><p>At 120 ticks per second, quick cuts start after ${shinobi.MOVES.light.startup} ticks and heavy cuts after ${shinobi.MOVES.heavy.startup}. A fresh press after a damaging hit can link during light frames ${shinobi.CHAIN.startFrame}–${shinobi.CHAIN.endFrame}; a missed cut and the third cut complete recovery. A confirmed retreat dash costs ${shinobi.CHAIN.dashCancelCost} stamina. R feints a heavy during frames ${shinobi.FEINT.startFrame}–${shinobi.FEINT.endFrame}, costs ${shinobi.FEINT.cost} extra stamina and leaves ${shinobi.FEINT.duration} ticks of exposed recovery. Parry works during frames ${shinobi.PARRY.startup}–${shinobi.PARRY.activeEnd}; frames ${shinobi.PARRY.startup}–${shinobi.PARRY.perfectEnd} with precise facing reward a perfect parry. Successful parries recover sooner; a failed parry stays vulnerable. Dash costs ${shinobi.DASH.cost} and evades only during frames ${shinobi.DASH.startup}–${shinobi.DASH.invulnerableEnd}; bodies and cover still block it. Three kunai recover one at a time after two seconds of free movement. A perfect deflection returns a faster kunai. Inputs buffer briefly and keep the aim chosen when you press. Use the Move and Aim pads with six action buttons on touch screens. Arrow keys move; Shift also dashes. Legacy J/K cuts, L kunai and I parry work. First to two rounds across three arenas, 75 seconds per round. R readies up in the lobby.</p></details>`;
}
if (coop) $('combat-tip').textContent = 'Clear nine rooms across three biomes and defeat three bosses. Between rooms, walk to a shrine and hold Guard to choose a boon. Hold Guard near a fallen ally to revive them. No friendly fire.';
if (realtimeMode && !coop && !modernControls) $('combat-tip').textContent = 'Win two rounds across Moss Courtyard, Tide Archive, and Cinder Gallery. Face a strike to guard, tap just before impact to parry, and use each arena’s pillars as cover.';
$('dungeon-build').hidden = !coop;
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
function send(message) {
  if (practiceMode) {
    if (message.type === 'join') { syncPractice(); return; }
    if (practicePaused || $('room-panel').open || document.hidden) return;
    if (['move', 'card-action', 'brawl-select'].includes(message.type)) {
      const accepted = practiceSession.action(message);
      if (!accepted.ok) { error(accepted.error); board?.resetSelection(); cardTable?.resetSelection(); }
      else error('');
      syncPractice(); scheduleFrame();
    }
    return;
  }
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}
function practiceSettings() {
  return { ...practiceSession.settings, difficulty: $('practice-difficulty').value,
    ...(shinobiMode ? { bots: Number($('practice-bots').value), stageId: $('practice-stage').value } : {}),
    seed: crypto.getRandomValues(new Uint32Array(1))[0] };
}
function playCombatAudio(state) {
  audio.playEvents(shinobiMode ? (state.events || []).map(event => event.type === 'parry' && event.target == null ? { ...event, type: 'parryStart' } : event.type === 'attack' ? { ...event, type: 'swing', move: event.action } : event.type === 'throw' && event.release ? { ...event, type: 'swing', move: 'light' } : event.type === 'deflect' ? { ...event, type: 'parry' } : event.type === 'cover' ? { ...event, type: 'block' } : event.type === 'hit' ? { ...event, move: event.attack } : event) : state.events || []);
}
function syncPractice() {
  authoritative = practiceSession.getState(); predicted = authoritative;
  const count = shinobiMode ? authoritative.fighters.length : 2;
  players = Array.from({ length: count }, (_, id) => ({ id, name: id === 0 ? playerName : shinobiMode ? `Shinobi ${id}` : 'Bot', connected: true, ready: id !== 0, bot: id !== 0 }));
  if (realtimeMode) playCombatAudio(authoritative);
  else if (boardMode && authoritative.lastMove && authoritative.lastMove.tick !== syncPractice.lastMoveTick) {
    syncPractice.lastMoveTick = authoritative.lastMove.tick;
    audio.playEvents([{ id: authoritative.moves * 1000 + authoritative.lastMove.tick, type: authoritative.lastMove.capture == null ? 'block' : 'hit', x: 0, y: 0 }]);
  }
  if (authoritative.phase !== previousPhase) {
    previousPose = null;
    if (shinobiInputs) { refreshKeys(); shinobiInputs.reset({ held: keys, neutral: authoritative.phase === 'fight' }); }
    if (authoritative.phase === 'fight' && realtimeMode) { flashUntil = performance.now() + 550; audio.fight(); }
    previousPhase = authoritative.phase;
  }
}
function setPracticePaused(value) {
  if (!practiceMode || !['countdown', 'fight', 'roundEnd'].includes(authoritative.phase)) return;
  practicePaused = !!value; releaseKeys(); previousPose = null;
  previousTime = performance.now(); accumulator = 0; focusLost = practicePaused;
  if (!practicePaused && realtimeMode) canvas.focus({ preventScroll: true });
  updateHUD(performance.now()); scheduleFrame();
}
function startPracticeGame() {
  releaseKeys(); practicePaused = false; previousPose = null; lastDisplayTime = null;
  audio.resetEvents(); renderer?.resetEffects(); board?.resetSelection(); cardTable?.resetSelection();
  practiceSession.start(practiceSettings()); syncPractice.lastMoveTick = null; syncPractice();
  previousTime = performance.now(); accumulator = 0; countdownLast = null; focusLost = false;
  $('player-name').blur(); if (realtimeMode) canvas.focus({ preventScroll: true });
  queuePlaySpaceResize(); updateHUD(performance.now()); scheduleFrame();
}
function updateConnection() {
  toggleClass($('connection-dot'), 'online', connected);
  setText($('connection-status'), practiceMode ? 'VS BOTS' : connected ? 'HOST CONNECTED' : permanentlyClosed ? 'ROOM UNAVAILABLE' : 'RECONNECTING');
  setText($('ping'), practiceMode ? 'LOCAL' : ping == null ? '— ms' : `${ping} ms`);
  setHidden($('p1-you'), localId !== 0); setHidden($('p2-you'), localId !== 1);
  if (!realtimeMode) scheduleFrame();
}
function receiveState(message) {
  const state = message.state;
  if (!state || (boardMode ? !state.board : cardMode ? state.gameId !== gameId : !state.fighters)) return;
  lastSnapshotAt = performance.now(); players = message.players || players;
  const oldPose = realtimeMode ? capturePlanarPose(predicted) : null, oldPreviousPose = previousPose;
  const fraction = tickFraction((accumulator + Math.max(0, lastSnapshotAt - previousTime)) / 1000);
  const old = realtimeMode && localId != null ? presentPlanarFighter(predicted, previousPose, localId, fraction) : null;
  const phase = authoritative.phase; authoritative = state;
  if (realtimeMode) {
    pending = pending.filter(frame => frame.seq > (message.acks?.[localId] ?? -1));
    // Clone only the state that prediction will advance; received snapshots
    // remain immutable and can also serve the interpolation history directly.
    predicted = state.phase === 'fight' ? clone(state) : state;
    previousPose = null;
    if (localId != null && state.phase === 'fight') {
      const remote = { ...emptyInput(), ...state.fighters[1 - localId].previousInput };
      for (const frame of pending) {
        const inputs = [emptyInput(), emptyInput()]; inputs[localId] = frame.buttons; inputs[1 - localId] = remote;
        previousPose = capturePlanarPose(predicted);
        engine.step(predicted, inputs);
      }
      previousPose = retainAdjacentPlanarPose(predicted, previousPose, oldPreviousPose, oldPose);
      if (old && phase === 'fight') {
        const own = presentPlanarFighter(predicted, previousPose, localId, fraction);
        correction = rebasePlanarCorrection(predicted, oldPose, localId, old, own, correction);
      }
    } else correction = { x: 0, y: 0 };
    const context = JSON.stringify([state.phase, state.round, state.wave, state.stageId]);
    if (context !== snapshotContext) { timeline.reset(); snapshots = []; correction = { x: 0, y: 0 }; snapshotContext = context; }
    const sample = timeline.sample(state, lastSnapshotAt, context);
    if (sample) {
      const next = { ...sample, pose: capturePlanarPose(state) };
      if (snapshots.at(-1)?.time === next.time) snapshots[snapshots.length - 1] = next;
      else snapshots.push(next);
      if (snapshots.length > 12) snapshots.shift();
    }
    playCombatAudio(state);
  } else if (boardMode && state.lastMove && state.lastMove.tick !== receiveState.lastMoveTick) {
    receiveState.lastMoveTick = state.lastMove.tick;
    audio.playEvents([{ id: state.moves * 1000 + state.lastMove.tick, type: state.lastMove.capture == null ? 'block' : 'hit', x: 0, y: 0 }]);
  }
  if (state.phase !== previousPhase) {
    if (shinobiInputs) { refreshKeys(); shinobiInputs.reset({ held: keys, neutral: state.phase === 'fight' }); }
    if (state.phase === 'fight' && realtimeMode) { flashUntil = performance.now() + 550; audio.fight(); }
    if (state.phase === 'lobby') { releaseKeys(); countdownLast = null; board?.resetSelection(); cardTable?.resetSelection(); }
    previousPhase = state.phase;
  }
  if (!realtimeMode) scheduleFrame();
}
function connect() {
  clearTimeout(reconnectTimer);
  if (permanentlyClosed || intentionalClose) return;
  if (!/^[A-Z0-9]{6}$/.test(roomId)) { permanentlyClosed = true; error('This invite has no valid room code. Go back to Semag and choose a game.'); updateConnection(); return; }
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws?room=${encodeURIComponent(roomId)}`);
  socket = ws;
  ws.addEventListener('open', () => {
    connected = true; attempts = 0; sequence = 0; pending = []; snapshots = []; timeline.reset(); snapshotContext = null; ping = null;
    lastSnapshotAt = performance.now(); send({ type: 'join', name: playerName }); error(''); updateConnection();
  });
  ws.addEventListener('message', ({ data }) => {
    let message; try { message = JSON.parse(data); } catch { return; }
    if (message.type === 'welcome') {
      if (message.gameId !== gameId) { intentionalClose = true; location.replace(roomUrl({ id: roomId, gameId: message.gameId })); return; }
      localId = message.playerId;
      if (aimMode) { vectorAim = { x: localId === 1 ? -1 : 1, y: 0 }; pointerTarget = null; refreshKeys(); }
      updateConnection();
    } else if (message.type === 'state') receiveState(message);
    else if (message.type === 'pong') { ping = Math.max(0, Math.round(performance.now() - message.time)); updateConnection(); }
    else if (message.type === 'error') {
      error(message.message || 'The host could not accept that action.'); board?.resetSelection(); cardTable?.resetSelection();
      if (/full|two players|occupied|not found|expired|unknown room/i.test(message.message || '')) permanentlyClosed = true;
    }
  });
  ws.addEventListener('close', () => {
    connected = false; localId = null; ping = null; pending = []; snapshots = []; timeline.reset(); snapshotContext = null; releaseKeys();
    previousPose = null;
    authoritative = initialState(); predicted = clone(authoritative);
    players = [null, null]; board?.resetSelection(); cardTable?.resetSelection(); renderer?.resetEffects(); updateConnection();
    if (!permanentlyClosed && !intentionalClose) {
      error('Connection to the host was lost. Reconnecting automatically…');
      reconnectTimer = setTimeout(connect, Math.min(5000, 750 * 2 ** attempts++));
    }
  });
  ws.addEventListener('error', () => {});
}

const keyMap = createCombatKeyMap(gameId);
let vectorAim = { x: 1, y: 0 }, pointerTarget = null;
const pointerButtons = { fire: false, focus: false, attack: false, heavy: false }, touchButtons = Object.create(null), touchPointers = new Map();
const pressIntents = new Set(), actionButtonKeys = new Map();
const latchedActions = new Set(shinobiMode ? SHINOBI_EDGE_ACTIONS : vectorMode ? ['fire', 'dash', 'reload'] : brawlMode ? ['jump', 'attack', 'special', 'dodge'] : []);
const shinobiInputs = shinobiMode ? createShinobiInputQueue() : null;
const shinobiMouse = shinobiMode ? createShinobiMouseButtons() : null;
function typing(target) { return target instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable); }
function refreshKeys() {
  const previous = keys;
  keys = combatInputFromKeys(keyMap, held.values(), emptyInput());
  if (!modernControls) return;
  for (const [key, value] of Object.entries(touchButtons)) if (value) keys[key] = true;
  for (const action of actionButtonKeys.values()) keys[action] = true;
  if (!aimMode) return;
  if (vectorMode) { keys.fire ||= pointerButtons.fire; keys.focus ||= pointerButtons.focus; }
  if (shinobiMode) { keys.attack ||= pointerButtons.attack; keys.heavy ||= pointerButtons.heavy; }
  if (pointerTarget && localId != null) {
    const own = predicted.fighters[localId], dx = pointerTarget.x - own.x, dy = pointerTarget.y - own.y;
    const length = Math.hypot(dx, dy);
    if (length > 1) vectorAim = { x: dx / length, y: dy / length };
  }
  keys.aimX = vectorAim.x; keys.aimY = vectorAim.y;
  if (shinobiInputs) for (const action of SHINOBI_EDGE_ACTIONS) {
    if (keys[action] && !previous[action] && authoritative.phase === 'fight') shinobiInputs.press(action, keys);
    if (!keys[action] && previous[action]) shinobiInputs.release(action);
  }
}
function releaseKeys() {
  shinobiInputs?.reset({ neutral: true });
  shinobiMouse?.reset();
  held.clear(); pressIntents.clear(); actionButtonKeys.clear(); pointerButtons.fire = false; pointerButtons.focus = false; pointerButtons.attack = false; pointerButtons.heavy = false;
  for (const key of Object.keys(touchButtons)) delete touchButtons[key];
  for (const [id, control] of touchPointers) {
    control.classList.remove('is-held'); control.style.removeProperty('--pad-x'); control.style.removeProperty('--pad-y');
    if (control.hasPointerCapture?.(id)) control.releasePointerCapture(id);
  }
  touchPointers.clear(); refreshKeys();
  if (!practiceMode && realtimeMode && connected && localId != null) {
    const frame = { type: 'input', seq: ++sequence, buttons: { ...keys } }; pending.push(frame); send(frame);
  }
}
// Keep the binding chosen on keydown so a layout change or shifted keyup
// cannot turn a held movement key into a different action.
const keyboardIdentity = event => event.code || (event.key?.length === 1 ? event.key.toLowerCase() : event.key);
document.addEventListener('keydown', event => {
  if (event.defaultPrevented || typing(event.target) || event.isComposing || event.metaKey || event.ctrlKey || event.altKey) return;
  if ($('room-panel').open) return;
  const identity = keyboardIdentity(event), code = gameCode(event);
  if (practiceMode && code === 'Escape' && !event.repeat) { event.preventDefault(); setPracticePaused(!practicePaused); return; }
  if (practiceMode && practicePaused) return;
  const interactive = event.target instanceof Element ? event.target.closest('button, a, summary') : null;
  if (interactive && ['Space', 'Enter'].includes(code)) {
    const action = modernControls && (interactive.dataset.vectorAction || interactive.dataset.shinobiAction || interactive.dataset.brawlAction);
    if (!action || event.repeat && !actionButtonKeys.has(identity)) return;
    event.preventDefault();
    if (!actionButtonKeys.has(identity) && latchedActions.has(action)) pressIntents.add(action);
    actionButtonKeys.set(identity, action); refreshKeys(); focusLost = false; return;
  }
  if (event.repeat && !held.has(identity)) return;
  if (modernControls) {
    const action = keyMap.get(code);
    if (!held.has(identity) && latchedActions.has(action)) pressIntents.add(action);
  }
  if (!vectorMode && code === 'KeyR' && !event.repeat && (!shinobiMode || ['lobby', 'matchEnd'].includes(authoritative.phase))) { event.preventDefault(); $('ready-button').click(); }
  if (realtimeMode && keyMap.has(code)) { event.preventDefault(); held.set(identity, code); refreshKeys(); focusLost = false; }
});
document.addEventListener('keyup', event => {
  const identity = keyboardIdentity(event), code = held.get(identity);
  if (modernControls && actionButtonKeys.has(identity)) { actionButtonKeys.delete(identity); refreshKeys(); event.preventDefault(); return; }
  if (!code) return;
  held.delete(identity); refreshKeys();
  if (!typing(event.target)) event.preventDefault();
});
window.addEventListener('blur', () => { releaseKeys(); focusLost = true; if (practiceMode) setPracticePaused(true); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { releaseKeys(); if (practiceMode) setPracticePaused(true); } });
canvas.addEventListener('pointerdown', event => {
  if ($('room-panel').open || practiceMode && practicePaused) return;
  canvas.focus(); focusLost = false;
  if (!aimMode) return;
  if (!shinobiMode || event.pointerType !== 'mouse') event.preventDefault();
  updatePointerAim(event);
  if (event.pointerType === 'mouse' || event.pointerType === 'pen') {
    if (vectorMode) { pointerButtons.fire = !!(event.buttons & 1); pointerButtons.focus = !!(event.buttons & 2); if (event.button === 0) pressIntents.add('fire'); }
    if (shinobiMode) Object.assign(pointerButtons, shinobiMouse.down(event.button, event.buttons));
  }
  canvas.setPointerCapture(event.pointerId); refreshKeys();
});
function updatePointerAim(event) {
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  pointerTarget = {
    x: Math.max(0, Math.min(engine.WORLD.width, (event.clientX - rect.left) * engine.WORLD.width / rect.width)),
    y: Math.max(0, Math.min(engine.WORLD.height, (event.clientY - rect.top) * engine.WORLD.height / rect.height)),
  };
}
canvas.addEventListener('pointermove', event => {
  if ($('room-panel').open) return;
  if (!aimMode) return;
  updatePointerAim(event);
  if (event.pointerType === 'mouse' || event.pointerType === 'pen') {
    if (vectorMode) { pointerButtons.fire = !!(event.buttons & 1); pointerButtons.focus = !!(event.buttons & 2); }
    if (shinobiMode) Object.assign(pointerButtons, shinobiMouse.sync(event.buttons));
  }
  refreshKeys();
});
function releasePointer(event) {
  if (!aimMode || event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
  pointerButtons.fire = event.type === 'pointerup' && !!(event.buttons & 1);
  pointerButtons.focus = event.type === 'pointerup' && !!(event.buttons & 2);
  if (shinobiMode) Object.assign(pointerButtons, event.type === 'pointercancel' ? shinobiMouse.reset() : shinobiMouse.sync(event.buttons));
  else {
    pointerButtons.attack = event.type === 'pointerup' && !!(event.buttons & 1);
    pointerButtons.heavy = event.type === 'pointerup' && !!(event.buttons & 2);
  }
  if (event.type === 'pointercancel') for (const action of ['fire', 'attack', 'heavy']) pressIntents.delete(action);
  refreshKeys();
  if (shinobiMode && event.type === 'pointercancel') shinobiInputs.reset({ held: keys, neutral: true });
}
window.addEventListener('pointerup', releasePointer);
window.addEventListener('pointercancel', releasePointer);
canvas.addEventListener('lostpointercapture', event => {
  if (shinobiMode) {
    if (!['mouse', 'pen'].includes(event.pointerType)) return;
    const hadButtons = pointerButtons.attack || pointerButtons.heavy;
    // Chromium may release capture after a chorded partial button release.
    // The event's remaining held bits are physical input, not cancellation.
    Object.assign(pointerButtons, shinobiMouse.sync(event.buttons));
    refreshKeys();
    if (hadButtons && !(event.buttons & 3)) shinobiInputs.reset({ held: keys, neutral: true });
    return;
  }
  if (aimMode) { if (pointerButtons.fire) pressIntents.delete('fire'); if (pointerButtons.attack) pressIntents.delete('attack'); if (pointerButtons.heavy) pressIntents.delete('heavy'); pointerButtons.fire = false; pointerButtons.focus = false; pointerButtons.attack = false; pointerButtons.heavy = false; refreshKeys(); }
});
canvas.addEventListener('contextmenu', event => { if (aimMode) event.preventDefault(); });
// Pointer events report the first pressed and final released mouse button.
// Mouse events also preserve short second-button taps while another is held.
canvas.addEventListener('mousedown', event => {
  if (!shinobiMode || $('room-panel').open || event.sourceCapabilities?.firesTouchEvents) return;
  if (![0, 2].includes(event.button)) return;
  event.preventDefault(); canvas.focus(); focusLost = false; updatePointerAim(event);
  Object.assign(pointerButtons, shinobiMouse.down(event.button, event.buttons)); refreshKeys();
});
window.addEventListener('mouseup', event => {
  if (!shinobiMode || event.sourceCapabilities?.firesTouchEvents) return;
  Object.assign(pointerButtons, shinobiMouse.sync(event.buttons)); refreshKeys();
});
setupVectorTouch();
setupShinobiTouch();
setupBrawl();
// Brawl builds its own controls, so capture canonical copy after all game setup.
const keyboardLabels = [...$('controls-panel').querySelectorAll('kbd')].map(node => ({ node, text: node.textContent }));
const keyboardArenaLabel = brawlMode
  ? 'Oddstock Rumble. {A} and {D} move, {W} and {S} choose move direction, Space jumps, {C} attacks, {G} uses a special, {F} shields, Shift dodges. Legacy {J}, {K}, {I} and {L} controls also work.'
  : shinobiMode
    ? 'Shinobi Showdown. {WASD} or arrow keys move, mouse aims, left mouse or {C} cuts and links confirmed hits, right mouse or {G} uses a heavy cut, {R} feints its windup, {E} throws a kunai, {F} parries, Space or Shift dashes.'
    : vectorMode
    ? 'Vector Arena. {WASD} or arrow keys move, mouse aims, left mouse or {C} fires, right mouse or {F} focuses, Space dashes, {R} reloads.'
    : 'Top-down adventure game. Use {WASD} to move, {C} to swing, {G} to shoot, Space or Shift to roll, {F} to guard. Legacy {J}, {K}, {I} and {L} controls also work.';
function updateKeyboardHints() {
  for (const { node, text } of keyboardLabels) setText(node, displayKey(text));
  setAttribute(canvas, 'aria-label', formatKeyboardText(keyboardArenaLabel));
  if (brawlMode) { updateBrawlLobby.character = null; updateBrawlLobby(authoritative); }
}
subscribeKeyboardLayout(() => { releaseKeys(); updateKeyboardHints(); });
const keyboardPicker = document.querySelector('[data-keyboard-layout-picker]');
if (keyboardPicker) mountKeyboardLayoutPicker(keyboardPicker);
keyboardPicker?.addEventListener('focusin', releaseKeys);
updateKeyboardHints();
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
      if (event.type !== 'pointerup' && control.dataset.vectorAction) pressIntents.delete(control.dataset.vectorAction);
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
        if (latchedActions.has(action)) pressIntents.add(action);
        refreshKeys();
      }
    });
    control.addEventListener('pointermove', event => { if (touchPointers.get(event.pointerId) === control && control.dataset.vectorPad) updatePad(control, event); });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) control.addEventListener(type, release);
  }
}
function setupShinobiTouch() {
  const controls = $('shinobi-controls'); controls.hidden = !shinobiMode;
  if (!shinobiMode) return;
  const updatePad = (control, event) => {
    const rect = control.getBoundingClientRect(), radius = Math.max(1, Math.min(rect.width, rect.height) * .36);
    const dx = (event.clientX - rect.left - rect.width / 2) / radius;
    const dy = (event.clientY - rect.top - rect.height / 2) / radius;
    const length = Math.hypot(dx, dy), scale = Math.max(1, length);
    control.style.setProperty('--pad-x', `${dx / scale * 25}px`);
    control.style.setProperty('--pad-y', `${dy / scale * 25}px`);
    if (control.dataset.shinobiPad === 'move') {
      touchButtons.left = dx < -.25; touchButtons.right = dx > .25;
      touchButtons.up = dy < -.25; touchButtons.down = dy > .25;
    } else if (length > .2) {
      vectorAim = { x: dx / length, y: dy / length }; pointerTarget = null;
    }
    refreshKeys();
  };
  for (const control of controls.querySelectorAll('[data-shinobi-pad], [data-shinobi-action]')) {
    const release = event => {
      if (touchPointers.get(event.pointerId) !== control) return;
      touchPointers.delete(event.pointerId); control.classList.remove('is-held');
      control.style.removeProperty('--pad-x'); control.style.removeProperty('--pad-y');
      if (control.dataset.shinobiPad === 'move') for (const key of ['left', 'right', 'up', 'down']) touchButtons[key] = false;
      if (control.dataset.shinobiAction) touchButtons[control.dataset.shinobiAction] = false;
      if (event.type !== 'pointerup' && control.dataset.shinobiAction) pressIntents.delete(control.dataset.shinobiAction);
      refreshKeys();
      if (event.type !== 'pointerup') shinobiInputs?.reset({ held: keys, neutral: true });
      if (control.hasPointerCapture(event.pointerId)) control.releasePointerCapture(event.pointerId);
    };
    control.addEventListener('pointerdown', event => {
      if (event.button !== 0 || [...touchPointers.values()].includes(control)) return;
      event.preventDefault(); canvas.focus(); focusLost = false;
      touchPointers.set(event.pointerId, control); control.setPointerCapture(event.pointerId); control.classList.add('is-held');
      if (control.dataset.shinobiPad) updatePad(control, event);
      else {
        const action = control.dataset.shinobiAction; touchButtons[action] = true;
        if (latchedActions.has(action)) pressIntents.add(action);
        refreshKeys();
      }
    });
    control.addEventListener('pointermove', event => { if (touchPointers.get(event.pointerId) === control && control.dataset.shinobiPad) updatePad(control, event); });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) control.addEventListener(type, release);
  }
}
function setupBrawl() {
  $('brawl-controls').hidden = !brawlMode; $('brawl-move-card').hidden = !brawlMode;
  if (!brawlMode) return;
  canvas.width = brawl.WORLD.width; canvas.height = brawl.WORLD.height;
  canvas.setAttribute('aria-label', 'Oddstock Rumble. A and D move, W and S choose move direction, Space jumps, C attacks, G uses a special, F shields, Shift dodges.');
  $('footer-mode').textContent = 'THREE-STOCK PLATFORM BRAWLER';
  $('controls-panel').innerHTML = `<h2>Make a glorious mess.</h2><div class="control-line"><span class="keys"><kbd>A</kbd><kbd>D</kbd></span><span>Move / steer in air</span></div><div class="control-line"><span class="keys"><kbd>W</kbd><kbd>S</kbd></span><span>Choose move direction</span></div><div class="control-line"><kbd class="wide-key">SPACE</kbd><span>Jump / double jump</span></div><div class="control-line"><kbd>C</kbd><span>Attack</span></div><div class="control-line"><kbd>G</kbd><span>Directional special</span></div><div class="control-line"><kbd>F</kbd><span>Shield / timed parry</span></div><div class="control-line"><kbd class="wide-key">SHIFT</kbd><span>Dodge / air evade</span></div><p id="combat-tip">Damage builds knockback, rather than draining health. Launch your rival beyond the stage boundaries to take a stock. Keep your extra jump and upward special for recovery.</p><details><summary>Movement and timing</summary><p>Arrow keys also move and choose direction. Legacy J/K attacks, I shield and L dodge also work. Neutral, side, up and down attacks change again in the air. Hold Down to fast-fall; Down + Jump drops through thin platforms. Tap Shield just before a hit to parry. Holding it drains the shield; a broken shield leaves you open. Three stocks each, four minutes, then remaining stocks and lower damage decide the winner.</p></details>`;
  for (const character of Object.values(brawl.CHARACTERS)) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'brawl-choice';
    button.dataset.brawlCharacter = character.id; button.setAttribute('aria-pressed', 'false');
    const portrait = document.createElement('canvas'); portrait.width = 160; portrait.height = 144; portrait.setAttribute('aria-hidden', 'true');
    drawFighterPortrait(portrait, character.id);
    const copy = document.createElement('span'), name = document.createElement('strong'), role = document.createElement('small');
    name.textContent = character.name; role.textContent = character.role;
    copy.append(name, role); button.append(portrait, copy);
    button.addEventListener('click', () => { releaseKeys(); send({ type: 'brawl-select', character: character.id }); });
    $('brawl-roster').append(button);
  }
  for (const [id, stage] of Object.entries(brawl.STAGES)) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'brawl-stage';
    button.dataset.brawlStage = id; button.setAttribute('aria-pressed', 'false');
    const preview = document.createElement('canvas'); preview.width = 300; preview.height = 180; preview.setAttribute('aria-hidden', 'true');
    drawStagePreview(preview, id);
    const row = document.createElement('span'), title = document.createElement('span'), label = document.createElement('small');
    title.textContent = stage.name; label.textContent = id === 'foundry' ? 'TIMED HAZARD' : id === 'garden' ? 'HIGH PLATFORMS' : 'BALANCED';
    row.append(title, label); button.append(preview, row);
    button.addEventListener('click', () => { releaseKeys(); send({ type: 'brawl-select', stage: id }); });
    $('brawl-stages').append(button);
  }
  for (const control of $('brawl-controls').querySelectorAll('[data-brawl-action]')) {
    const action = control.dataset.brawlAction;
    const release = event => {
      if (touchPointers.get(event.pointerId) !== control) return;
      touchPointers.delete(event.pointerId); touchButtons[action] = false; control.classList.remove('is-held');
      if (event.type !== 'pointerup') pressIntents.delete(action);
      refreshKeys(); if (control.hasPointerCapture(event.pointerId)) control.releasePointerCapture(event.pointerId);
    };
    control.addEventListener('pointerdown', event => {
      if (event.button !== 0 || [...touchPointers.values()].includes(control)) return;
      event.preventDefault(); canvas.focus(); focusLost = false;
      touchPointers.set(event.pointerId, control); control.setPointerCapture(event.pointerId); control.classList.add('is-held');
      touchButtons[action] = true; if (latchedActions.has(action)) pressIntents.add(action); refreshKeys();
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) control.addEventListener(type, release);
  }
}
function updateBrawlLobby(state) {
  if (!brawlMode) return;
  const lobby = state.phase === 'lobby', own = localId == null ? null : state.fighters[localId];
  toggleClass($('room-app'), 'brawl-lobby-open', lobby); setHidden($('brawl-lobby'), !lobby);
  setHidden($('brawl-controls'), lobby);
  setText($('brawl-selection-status'), own?.selected ? `${brawl.CHARACTERS[own.characterId]?.name || 'FIGHTER'} SELECTED` : 'PICK YOUR FIGHTER');
  for (const button of $('brawl-roster').children) {
    setDisabled(button, !connected || localId == null || !lobby);
    setAttribute(button, 'aria-pressed', String(button.dataset.brawlCharacter === own?.characterId));
  }
  for (const button of $('brawl-stages').children) {
    setDisabled(button, !connected || localId !== 0 || !lobby);
    setAttribute(button, 'aria-pressed', String(state.stageSelected && button.dataset.brawlStage === state.stageId));
  }
  setText($('brawl-stage-note'), localId === 0 ? 'YOU HOST / CHOOSE THE STAGE' : state.stageSelected ? `HOST CHOSE ${brawl.STAGES[state.stageId]?.name?.toUpperCase()}` : 'WAITING FOR THE HOST TO CHOOSE');
  const character = brawl.CHARACTERS[own?.characterId];
  if (updateBrawlLobby.character !== character?.id) {
    updateBrawlLobby.character = character?.id;
    setText($('brawl-character-name'), character?.name || 'Meet your fighter.');
    setText($('brawl-character-description'), character?.description || 'Choose a fighter to see their signature moves.');
    $('brawl-moves').replaceChildren();
    if (character) for (const [label, detail] of [
      [character.specialName, '{G} + side or neutral: your signature special.'],
      [character.recoveryName, '{W} + {G}: upward recovery, once per airtime.'],
      [character.downName, '{S} + {G}: your downward special.'],
      ['Ground and aerial attacks', '{C} changes with direction and whether you are airborne.'],
    ]) {
      const row = document.createElement('div'), title = document.createElement('strong'), copy = document.createElement('small');
      title.textContent = label; copy.textContent = formatKeyboardText(detail); row.append(title, copy); $('brawl-moves').append(row);
    }
  }
}
$('player-name').addEventListener('focus', releaseKeys);
$('player-name').addEventListener('change', () => { playerName = saveName($('player-name').value); $('player-name').value = playerName; send({ type: 'join', name: playerName }); });
$('player-name').addEventListener('keydown', event => { if (event.key === 'Enter') event.target.blur(); });
const roomPanel = $('room-panel');
let roomPanelReturnToGame = false;
function closeRoomPanel({ returnToGame = false } = {}) {
  if (!roomPanel.open) return;
  roomPanelReturnToGame = returnToGame;
  roomPanel.close();
}
$('room-panel-button').addEventListener('click', () => {
  releaseKeys();
  focusLost = realtimeMode && authoritative.phase === 'fight';
  roomPanel.showModal();
  roomPanelReturnToGame = false;
  $('room-panel-button').setAttribute('aria-expanded', 'true');
  $('room-panel-close').focus({ preventScroll: true });
});
$('room-panel-close').addEventListener('click', () => closeRoomPanel({ returnToGame: authoritative.phase === 'fight' }));
roomPanel.addEventListener('close', () => {
  releaseKeys();
  $('room-panel-button').setAttribute('aria-expanded', 'false');
  const returnToGame = roomPanelReturnToGame && realtimeMode && authoritative.phase === 'fight';
  if (returnToGame) focusLost = false;
  (returnToGame ? canvas : $('room-panel-button')).focus({ preventScroll: true });
  roomPanelReturnToGame = false;
});
roomPanel.addEventListener('keydown', event => {
  if (event.key !== 'Tab') return;
  const controls = [...roomPanel.querySelectorAll('button, input, select, textarea, a[href], summary, [tabindex]')]
    .filter(node => !node.disabled && node.tabIndex >= 0 && node.getClientRects().length);
  if (!controls.length) { event.preventDefault(); roomPanel.focus(); return; }
  const first = controls[0], last = controls.at(-1);
  if (!roomPanel.contains(document.activeElement) || event.shiftKey && document.activeElement === first || !event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  }
});
roomPanel.addEventListener('click', event => {
  if (event.target !== roomPanel) return;
  const rect = roomPanel.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeRoomPanel({ returnToGame: authoritative.phase === 'fight' });
});
for (const id of ['practice-difficulty', 'practice-bots', 'practice-stage']) $(id).addEventListener('change', () => {
  if (!practiceMode || !['lobby', 'matchEnd'].includes(authoritative.phase)) return;
  releaseKeys(); previousPose = null; practicePaused = false;
  audio.resetEvents(); renderer?.resetEffects(); board?.resetSelection(); cardTable?.resetSelection();
  practiceSession.reset(practiceSettings()); syncPractice(); updateHUD(performance.now()); scheduleFrame(); queuePlaySpaceResize();
});
$('practice-pause').addEventListener('click', () => setPracticePaused(!practicePaused));
$('ready-button').addEventListener('click', () => {
  if (practiceMode) { if (['lobby', 'matchEnd'].includes(authoritative.phase)) startPracticeGame(); return; }
  if (!connected || localId == null) return;
  if (authoritative.phase === 'fight' || authoritative.phase === 'roundEnd') return;
  send(authoritative.phase === 'matchEnd' ? { type: 'rematch' } : { type: 'ready', ready: !players[localId]?.ready });
  $('player-name').blur(); if (realtimeMode) canvas.focus();
});
$('copy-code').addEventListener('click', async () => { try { await copyText(roomId); toast('Room code copied.'); } catch (e) { toast(e.message); } });
$('copy-invite').addEventListener('click', async () => { try { await copyText(invite); toast('Invite copied. Your friend has a seat.'); } catch (e) { toast(e.message); } });
if (!practiceMode) hostInfo().then(info => { invite = info.origin + location.pathname + location.search; $('invite-address').textContent = invite; }).catch(() => { $('invite-address').textContent = invite; });
$('sound-button').addEventListener('click', async () => {
  await audio.setEnabled(!audio.enabled);
  $('sound-button').setAttribute('aria-pressed', String(audio.enabled));
  $('sound-button').setAttribute('aria-label', audio.enabled ? 'Mute sound' : 'Enable sound');
  $('sound-button').title = audio.enabled ? 'Mute sound' : 'Enable sound';
});
$('fullscreen-button').addEventListener('click', async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await $('room-app').requestFullscreen(); } catch { toast('Fullscreen is unavailable in this browser.'); } });

function inputTick() {
  if (practiceMode) {
    if (practicePaused || $('room-panel').open || document.hidden || ['lobby', 'matchEnd'].includes(authoritative.phase)) return;
    if (realtimeMode) refreshKeys();
    const buttons = authoritative.phase === 'fight' ? shinobiInputs ? shinobiInputs.sample(keys) : { ...keys } : emptyInput();
    if (modernControls) { if (!shinobiInputs && authoritative.phase === 'fight') for (const action of pressIntents) buttons[action] = true; pressIntents.clear(); }
    previousPose = realtimeMode ? capturePlanarPose(authoritative) : null;
    practiceSession.step(buttons); syncPractice(); return;
  }
  if (!realtimeMode || !connected || localId == null) return;
  if (authoritative.phase !== 'fight') { pressIntents.clear(); shinobiInputs?.reset({ held: keys }); return; }
  if (modernControls) refreshKeys();
  const buttons = shinobiInputs ? shinobiInputs.sample(keys) : { ...keys };
  if (modernControls) { if (!shinobiInputs) for (const action of pressIntents) buttons[action] = true; pressIntents.clear(); }
  const frame = { type: 'input', seq: ++sequence, buttons }; pending.push(frame); send(frame);
  if (pending.length > 180) pending.shift();
  if (predicted.phase === 'fight') {
    const inputs = [emptyInput(), emptyInput()]; inputs[localId] = frame.buttons;
    inputs[1 - localId] = { ...emptyInput(), ...authoritative.fighters[1 - localId].previousInput };
    previousPose = capturePlanarPose(predicted);
    engine.step(predicted, inputs);
  }
}
function displayState(now, fraction) {
  if (practiceMode) {
    if (practicePaused || $('room-panel').open || authoritative.phase !== 'fight') return authoritative;
    const local = { ...authoritative, ...presentPlanarEntities(authoritative, previousPose, fraction), fighters: authoritative.fighters.map((_, id) => presentPlanarFighter(authoritative, previousPose, id, fraction)) };
    if (shinobiMode) local.fighters = shinobi.sweepPresentationFighters(authoritative, local.fighters);
    else if (vectorMode) local.fighters = vector.sweepPresentationFighters(authoritative, local.fighters);
    else if (!brawlMode) return topdown.sweepPresentationScene(authoritative, local);
    return local;
  }
  const deltaMs = lastDisplayTime == null ? 1000 / 60 : now - lastDisplayTime;
  lastDisplayTime = now;
  if (authoritative.phase !== 'fight' || localId == null) return authoritative;
  const state = { ...predicted, ...presentPlanarEntities(predicted, previousPose, fraction), fighters: predicted.fighters.map(f => ({ ...f })), events: authoritative.events || [] };
  state.fighters[localId] = presentPlanarFighter(predicted, previousPose, localId, fraction);
  state.fighters[localId].x += correction.x; state.fighters[localId].y += correction.y;
  const decay = frameDecay(.72, deltaMs);
  correction.x *= decay; correction.y *= decay;
  const target = timeline.time(now);
  let before = snapshots[0], after = snapshots.at(-1);
  for (let i = 1; i < snapshots.length; i++) if (snapshots[i].time >= target) { before = snapshots[i - 1]; after = snapshots[i]; break; }
  if (before && after && before.state.phase === 'fight' && after.state.phase === 'fight') {
    state.fighters[1 - localId] = presentNetworkPlanarFighter(authoritative, before, after, 1 - localId, target, { maxDistance: shinobiMode ? 96 : 64 });
  }
  if (shinobiMode) state.fighters = shinobi.sweepPresentationFighters(predicted, state.fighters);
  else if (vectorMode) state.fighters = vector.sweepPresentationFighters(predicted, state.fighters, { anchorId: localId });
  if (!aimMode && !brawlMode) return topdown.sweepPresentationScene(predicted, state, { anchorId: localId });
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
function updateDungeonBuild(state) {
  if (!coop) return;
  const own = state.fighters[localId], choices = state.shrineChoices || [];
  const signature = JSON.stringify([localId, state.wave, state.roomBreak, state.roomName, state.biome, own?.boons, state.boonSelections, choices]);
  if (updateDungeonBuild.signature === signature) return;
  updateDungeonBuild.signature = signature;
  $('dungeon-location').textContent = `${state.biome?.name || 'Garden Ruins'} · Room ${Math.max(1, state.wave)} of ${state.maxWaves || 9} · ${state.roomName || 'Moss Gate'}`;
  const current = state.boonSelections?.[localId];
  $('dungeon-shrine-note').textContent = state.roomBreak ? current ? `You chose ${topdown.BOONS[current]?.name || 'a boon'}. Both adventurers must choose before the next room.` : 'Walk within one step of a glowing shrine, then hold I / Guard. Each adventurer chooses their own boon.' : 'Clear the room to reveal three shrines. Each choice strengthens the rest of your run.';
  $('dungeon-shrines').hidden = !state.roomBreak;
  $('dungeon-shrines').replaceChildren(...choices.map((choice, index) => {
    const row = document.createElement('li'), name = document.createElement('strong');
    name.textContent = `${choice.name} (${['left', 'middle', 'right'][index]} shrine)`; row.append(name, ` — ${choice.detail}${current === choice.id ? ' · YOUR CHOICE' : ''}`); return row;
  }));
  const boons = Object.entries(own?.boons || {}).filter(([, rank]) => rank > 0);
  $('dungeon-boons').replaceChildren(...boons.map(([id, rank]) => {
    const row = document.createElement('li'), name = document.createElement('strong'), boon = topdown.BOONS[id];
    name.textContent = `${boon?.name || id}${rank > 1 ? ` ×${rank}` : ''}`; row.append(name, ` — ${boon?.detail || ''}`); return row;
  }));
  $('dungeon-boon-empty').hidden = boons.length > 0;
  if (state.roomBreak && !updateDungeonBuild.wasBreak) $('dungeon-build-details').open = true;
  updateDungeonBuild.wasBreak = state.roomBreak;
}
function shinobiDetail(fighter) {
  const options = shinobi.getCombatOptions(fighter);
  if (fighter.action === 'stun') return 'PARRIED / OPEN';
  if (fighter.action === 'feint') return 'FEINT / EXPOSED';
  if (options.canFeint) return 'FEINT READY';
  if (options.canChain) return `LINK CUT ${fighter.comboStep + 1}`;
  if (fighter.action === 'parry') return fighter.parrySuccess ? 'COUNTER OPENING' : options.perfectParryActive ? 'PERFECT WINDOW' : options.parryActive ? 'PARRY WINDOW' : 'RECOVERING';
  if (fighter.action === 'light') return `CUT ${fighter.comboStep} / ${shinobi.CHAIN.max}`;
  return `${fighter.kunai} / ${shinobi.KUNAI.capacity} KUNAI`;
}
function updateHUD(now) {
  const state = authoritative, phase = state.phase;
  setAttribute($('room-app'), 'data-phase', phase);
  setText($('room-seat-summary'), practiceMode ? 'SOLO' : `${players.filter(player => player?.connected).length} / 2`);
  if (practiceMode) {
    setHidden($('practice-setup'), !['lobby', 'matchEnd'].includes(phase));
    setHidden($('practice-pause'), !['countdown', 'fight', 'roundEnd'].includes(phase));
    setText($('practice-pause'), practicePaused ? 'Resume' : 'Pause');
    setAttribute($('practice-pause'), 'aria-pressed', String(practicePaused));
  }
  const names = players.map((p, i) => safeName(p?.name, `Player ${i + 1}`));
  const botTeam = practiceMode && shinobiMode && state.fighters.length > 2 ? state.fighters.slice(1) : null;
  if (botTeam) names[1] = `${botTeam.length} Shinobi`;
  const active = ['countdown', 'fight', 'roundEnd'].includes(phase);
  for (let i = 0; i < 2; i++) {
    const prefix = `p${i + 1}`, player = players[i];
    setText($(prefix + '-name'), names[i].toUpperCase());
    setText($(`slot${i + 1}-name`), player?.connected ? names[i] : 'Waiting for a friend');
    setText($(`slot${i + 1}-status`), player?.connected ? player.ready ? 'Ready to play' : active ? 'In the game' : 'Not ready yet' : 'Seat open');
    setClass($(`slot${i + 1}-dot`), `slot-dot ${player?.connected ? player.ready ? 'ready' : 'connected' : ''}`);
    setText($(`slot${i + 1}-avatar`), player?.connected ? names[i].slice(0, 1).toUpperCase() : `0${i + 1}`);
    if (boardMode) {
      const pieces = state.board.filter(p => p?.owner === i).length, kings = state.board.filter(p => p?.owner === i && p.king).length;
      setText($(prefix + '-score'), pieces);
      setText($(prefix + '-detail'), `${pieces} PIECES / ${kings} KINGS`);
    } else if (cardMode) {
      setText($(prefix + '-score'), gameId === 'crazy-eights' ? state.handCounts[i] : state.scores[i]);
      setText($(prefix + '-detail'), gameId === 'crazy-eights' ? 'CARDS IN HAND' : gameId === 'memory' ? 'PAIRS FOUND' : `${state.scores[i]} POINTS / ${state.totals[i] == null ? 'HIDDEN HAND' : state.totals[i] > 21 ? 'BUST' : `${state.totals[i]} IN HAND`}`);
    } else if (brawlMode) {
      const fighter = state.fighters[i], character = brawl.CHARACTERS[fighter.characterId];
      setText($(prefix + '-score'), `${Math.round(fighter.damage)}%`);
      setText($(prefix + '-detail'), fighter.respawnTicks > 0 ? 'RETURNING…' : character?.name?.toUpperCase() || 'CHOOSE FIGHTER');
      let stocks = $(prefix + '-stocks');
      if (!stocks) { stocks = document.createElement('span'); stocks.id = prefix + '-stocks'; setClass(stocks, 'brawl-stocks'); $(prefix + '-detail').parentElement.prepend(stocks); }
      setText(stocks, '●'.repeat(Math.max(0, fighter.stocks)) || 'OUT'); setAttribute(stocks, 'aria-label', `${fighter.stocks} stocks left`);
    } else {
      const fighter = botTeam && i === 1 ? { ...state.fighters[1], hp: botTeam.reduce((sum, f) => sum + Math.max(0, f.hp), 0), maxHp: botTeam.reduce((sum, f) => sum + f.maxHp, 0), stamina: botTeam.reduce((sum, f) => sum + (f.hp > 0 ? f.stamina : 0), 0) / Math.max(1, botTeam.filter(f => f.hp > 0).length) } : state.fighters[i];
      setStyle($(prefix + '-health'), 'width', `${Math.min(100, Math.max(0, fighter.hp) / (fighter.maxHp || 100) * 100)}%`);
      setStyle($(prefix + '-stamina'), 'width', `${Math.max(0, fighter.stamina)}%`);
      setText($(prefix + '-score'), coop ? fighter.downed ? '↓' : `${Math.ceil(fighter.hp)}` : `${fighter.wins} / 2`);
      setText($(prefix + '-detail'), botTeam && i === 1 ? `${botTeam.filter(f => f.hp > 0).length} / ${botTeam.length} BOTS · ${practiceSession.settings.difficulty.toUpperCase()}` : shinobiMode ? shinobiDetail(fighter) : vectorMode ? fighter.reloadTicks > 0 ? `RELOAD ${(fighter.reloadTicks / 120).toFixed(1)}s` : `${fighter.ammo} / 6 SHOTS` : fighter.downed ? `REVIVE ${Math.round((fighter.reviveProgress || 0) / 180 * 100)}%` : fighter.guardBroken ? 'GUARD BROKEN' : fighter.action === 'block' ? 'GUARDING' : fighter.action === 'roll' ? 'EVADING' : 'STAMINA');
      if (aimMode) {
        setAttribute($(prefix + '-health-track'), 'aria-label', `${names[i]} health: ${Math.ceil(fighter.hp)} of ${fighter.maxHp || 100}`);
        setAttribute($(prefix + '-stamina-track'), 'aria-label', `${names[i]} ${shinobiMode ? 'combat' : 'dash'} stamina: ${Math.round(fighter.stamina)} of 100`);
      }
    }
  }
  if (boardMode) {
    setText($('round-label'), phase === 'fight' ? `TURN ${String(state.moves + 1).padStart(2, '0')}` : 'CHECKERS');
    setText($('timer'), phase === 'fight' ? state.turn === localId ? 'YOU' : 'THEM' : '1V1');
    setText($('hud-caption'), phase === 'fight' ? 'TO MOVE' : 'TAKE YOUR SEATS');
    setText($('objective'), phase === 'fight' ? state.forcedFrom != null ? 'Finish your capture chain with the same piece.' : `${names[state.turn]}'s turn. Captures are required when available.` : phase === 'matchEnd' ? state.result === 'draw' ? 'Draw. Ready for another game?' : `${names[state.winner]} wins. Ready for a rematch?` : 'Both players must ready up to begin.');
    setText($('objective-detail'), 'AMERICAN CHECKERS');
    board.render(state, { localId });
  } else if (cardMode) {
    const twentyOne = gameId === 'twenty-one';
    setText($('round-label'), twentyOne ? `ROUND ${state.round} / ${state.maxRounds}` : gameId === 'memory' ? 'MEMORY MATCH' : 'CRAZY EIGHTS');
    setText($('timer'), twentyOne ? '21' : phase === 'fight' ? state.turn === localId ? 'YOU' : 'THEM' : '1V1');
    setText($('hud-caption'), twentyOne ? 'CLOSEST WINS' : phase === 'fight' ? gameId === 'memory' ? 'TO FLIP' : 'TO PLAY' : 'TAKE YOUR SEATS');
    setText($('objective'), cardObjective(state, names));
    setText($('objective-detail'), twentyOne ? 'FIVE ROUNDS / NO BETTING' : gameId === 'memory' ? `${state.pairsRemaining} PAIRS LEFT` : `${state.deckCount} IN DECK`);
    cardTable.render(state, { localId, players });
    setHidden(cardTable.context.parentElement, !cardTable.context.childNodes.length);
  } else if (brawlMode) {
    setText($('round-label'), '3 STOCKS'); setText($('timer'), `${Math.floor(Math.max(0, state.roundTicks) / 7200)}:${String(Math.floor(Math.max(0, state.roundTicks) / 120) % 60).padStart(2, '0')}`); setText($('hud-caption'), 'DAMAGE');
    setText($('objective'), phase === 'fight' ? 'Build damage. Launch your rival. Save a jump for the trip back.' : phase === 'matchEnd' ? state.winner == null ? 'A glorious draw. Ready for another rumble?' : `${names[state.winner]} takes the rumble.` : 'Choose a fighter and let the host pick a stage, then both ready up.');
    setText($('objective-detail'), brawl.STAGES[state.stageId]?.name?.toUpperCase() || 'THREE PLAYGROUNDS');
    updateBrawlLobby(state);
  } else if (coop) {
    setText($('round-label'), ({ garden: 'GARDEN', crypt: 'TIDE', ember: 'EMBER' })[state.biome?.id] || 'DUNGEON'); setText($('timer'), `${Math.max(1, state.wave)}/${state.maxWaves}`); setText($('hud-caption'), state.roomBreak ? 'BOON BREAK' : 'ROOMS');
    setText($('objective'), phase === 'fight' ? state.objective : phase === 'matchEnd' ? state.result === 'victory' ? 'The ruins are clear. You made it home together.' : 'The party fell. Ready for another run?' : 'Both adventurers must ready up to begin.');
    setText($('objective-detail'), state.roomBreak ? 'BOTH CHOOSE / GUARD AT SHRINE' : state.roomName || `${state.enemies.filter(e => e.hp > 0).length} ENEMIES`);
    updateDungeonBuild(state);
  } else {
    setText($('round-label'), `ROUND ${String(state.round).padStart(2, '0')}`);
    setText($('timer'), String(Math.max(0, Math.ceil(state.roundTicks / 120))).padStart(2, '0')); setText($('hud-caption'), vectorMode ? 'FIRST TO TWO' : 'FIRST TO 2');
    setText($('objective'), phase === 'fight' ? shinobiMode ? `${state.stageName} · Confirm the cut. Feint the parry. Own the angle.` : vectorMode ? `${state.stageName || 'Reclaimed Garden'} · Control an angle. Focus your shots. Keep a dash in reserve.` : state.objective || 'Use the pillars as cover. Face your attacks and watch your stamina.' : phase === 'matchEnd' ? 'A winner. A rematch. Or a different game?' : 'Both players must ready up to begin.');
    setText($('objective-detail'), (aimMode ? state.stageName : state.roomName)?.toUpperCase() || '90 SECOND ROUNDS');
    setText($('stage-label'), `${aimMode ? state.stageName || 'Reclaimed Garden' : state.roomName || 'Moss Courtyard'} / 120 HZ`.toUpperCase());
  }
  setDisabled($('player-name'), active);
  const mine = players[localId]; const button = $('ready-button');
  const needsBrawlChoice = brawlMode && phase === 'lobby' && (!state.fighters[localId]?.selected || !state.stageSelected);
  setText(button.querySelector('span'), phase === 'matchEnd' ? 'Play again' : phase === 'fight' || phase === 'roundEnd' || !boardMode && phase === 'countdown' && state.round > 1 ? 'Game in progress' : mine?.ready ? 'Cancel ready' : 'Ready up');
  setDisabled(button, needsBrawlChoice || !connected || localId == null || phase === 'fight' || phase === 'roundEnd' || !boardMode && phase === 'countdown' && state.round > 1);
  toggleClass(button, 'is-ready', !!mine?.ready);
  setText($('ready-note'), needsBrawlChoice ? 'Choose your fighter and let the host choose a stage, then ready up.' : phase === 'matchEnd' ? 'Both players must ready up for another game.' : phase === 'roundEnd' && cardMode ? 'The next hand starts shortly.' : phase === 'fight' ? 'Make it a good one.' : phase === 'countdown' ? 'Both players are ready. Starting shortly.' : mine?.ready ? 'Waiting for your friend to ready up.' : 'The game starts when both players are ready.');
  if (practiceMode) {
    setText(button.querySelector('span'), phase === 'matchEnd' ? 'Play again' : phase === 'lobby' ? 'Start game' : 'Game in progress');
    setDisabled(button, needsBrawlChoice || !['lobby', 'matchEnd'].includes(phase));
    toggleClass(button, 'is-ready', false);
    setText($('ready-note'), needsBrawlChoice ? 'Choose your fighter and arena, then start.' : phase === 'lobby' ? 'Choose your challenge. Start when you are ready.' : phase === 'matchEnd' ? 'Try again or change the challenge.' : practicePaused ? 'Paused. Resume when you are ready.' : 'Solo play · the controls panel pauses the game.');
    if (phase === 'lobby') setText($('objective'), 'Choose your challenge, then press Start game.');
    setText($('slot1-status'), 'You'); setText($('slot2-status'), `${practiceSession.settings.difficulty.toUpperCase()} BOT${botTeam ? 'S' : ''}`);
  }
  setHidden($('focus-note'), !realtimeMode || !focusLost || phase !== 'fight' || practiceMode);
  updateOverlay(now, names);
}
function updateOverlay(now, names) {
  const state = authoritative, phase = state.phase, overlay = $('game-overlay');
  let overlayClass = 'room-overlay', overlayHidden = false;
  let kicker, title, subtitle;
  if (practiceMode && practicePaused) {
    setClass(overlay, overlayClass); setHidden(overlay, false);
    setText($('overlay-kicker'), 'TAKE A BREATHER'); setText($('overlay-title'), 'Paused.');
    setText($('overlay-subtitle'), 'Press Resume or Escape to continue.'); return;
  }
  if (brawlMode && connected && phase === 'lobby') { setHidden(overlay, true); return; }
  if (!connected) {
    kicker = permanentlyClosed ? 'THIS SEAT IS UNAVAILABLE' : 'FINDING THE HOST';
    title = permanentlyClosed ? 'Try another room.' : 'Reconnecting…';
    subtitle = permanentlyClosed ? 'Head back to the game shelf and choose an open room.' : 'Keep the host running. We’ll reconnect automatically.';
  } else if (phase === 'lobby') {
    kicker = coop ? 'ADVENTURE IS BETTER TOGETHER' : 'A LITTLE FRIENDLY COMPETITION';
    title = players.every(p => p?.connected) ? 'Take your places.' : 'A friend is on the way.';
    subtitle = players.every(p => p?.connected) ? 'Both players ready up, then the game begins.' : 'Send the room code or invite link, then ready up.';
    if (practiceMode) { kicker = 'SOLO CHALLENGE'; title = 'Read your opponent.'; subtitle = shinobiMode ? 'Choose one to four bots, then press Start game.' : 'Choose a difficulty, then press Start game.'; }
  } else if (phase === 'countdown') {
    const number = Math.max(1, Math.ceil(state.phaseTicks / 120));
    kicker = coop ? 'STAY TOGETHER' : 'MAKE YOUR NEXT MOVE COUNT'; title = number; subtitle = coop ? 'Keep an eye on your friend.' : 'Good luck. Have fun.'; overlayClass += ' countdown';
    if (number !== countdownLast) { audio.countdown(number); countdownLast = number; }
  } else if (phase === 'fight') {
    if (realtimeMode && now < flashUntil) { kicker = coop ? 'YOUR ADVENTURE STARTS HERE' : shinobiMode ? 'READ THEIR BLADE' : vectorMode ? 'TAKE YOUR ANGLE' : 'FIND YOUR OPENING'; title = coop ? 'LET’S GO' : shinobiMode ? 'SHINOBI' : vectorMode ? 'ENGAGE' : brawlMode ? 'RUMBLE!' : 'DUEL'; subtitle = ''; overlayClass += ' fight'; }
    else overlayHidden = true;
  } else if (cardMode) {
    // Keep showdown hands and memory pairs visible; results live above the table.
    overlayHidden = true;
  } else if (coop) {
    kicker = state.result === 'victory' ? 'YOU MADE IT TOGETHER' : 'THE RUINS WILL BE WAITING'; title = state.result === 'victory' ? 'Adventure complete.' : 'The party fell.';
    subtitle = 'Ready up for another run, or choose another game.';
  } else {
    kicker = phase === 'roundEnd' ? `ROUND ${state.round} COMPLETE` : 'GOOD GAME. WELL PLAYED.';
    title = state.winner == null ? 'A well-earned draw.' : state.winner === localId ? 'You win.' : `${names[state.winner]} wins.`;
    subtitle = phase === 'roundEnd' ? 'Next round starts shortly.' : practiceMode ? 'Press Play again for another challenge.' : 'Both players ready up to play again.';
  }
  if (phase !== 'countdown') countdownLast = null;
  setClass(overlay, overlayClass); setHidden(overlay, overlayHidden);
  if (!overlayHidden) { setText($('overlay-kicker'), kicker); setText($('overlay-title'), title); setText($('overlay-subtitle'), subtitle); }
}

let previousTime = performance.now(), accumulator = 0, lastHUD = 0, frameId = null;
function scheduleFrame() {
  if (frameId === null && !document.hidden) frameId = requestAnimationFrame(animate);
}
function animate(now) {
  frameId = null;
  if (document.hidden) { previousTime = now; accumulator = 0; return; }
  accumulator += Math.min(65, now - previousTime); previousTime = now;
  let ticks = 0; while (accumulator >= 1000 / 120 && ticks++ < 8) { inputTick(); accumulator -= 1000 / 120; }
  if (renderer) {
    const fraction = tickFraction(accumulator / 1000), state = displayState(now, fraction);
    renderer.render(state, { localId, time: now, aimTarget: aimMode ? pointerTarget : null, players: coop || practiceMode ? players : undefined });
    presentation = { state, pose: previousPose, time: now, fraction, renderCount: ++renderCount };
  }
  if (!realtimeMode || now - lastHUD > 50) { updateHUD(now); lastHUD = now; }
  if (realtimeMode || practiceMode && !['lobby', 'matchEnd'].includes(authoritative.phase)) scheduleFrame();
}
document.addEventListener('visibilitychange', () => {
  previousTime = performance.now(); accumulator = 0;
  previousPose = null; lastDisplayTime = null;
  if (document.hidden) { if (frameId !== null) cancelAnimationFrame(frameId); frameId = null; }
  else scheduleFrame();
});
window.firesideRoom = {
  getState: () => clone(authoritative),
  getInputState: () => ({ buttons: { ...keys }, queued: shinobiInputs?.inspect() || null }),
  getPracticeState: () => practiceMode ? clone({ settings: practiceSession.settings, paused: practicePaused || $('room-panel').open, players, state: authoritative }) : null,
  getPresentation: () => presentation && ({
    renderCount: presentation.renderCount, time: presentation.time, tick: presentation.state.tick, fraction: presentation.fraction,
    fighters: presentation.state.fighters.map(({ id, x, y }) => ({ id, x, y })),
    previousPositions: presentation.pose?.fighters.map(({ id, x, y }) => ({ id, x, y })) || null,
  }),
  get playerId() { return localId; }, get connected() { return connected; }, roomId, gameId,
};
window.addEventListener('beforeunload', () => { intentionalClose = true; socket?.close(); });
// Size the whole arena to the space below its actual toolbar and HUD. The
// canvas always retains the engine's aspect ratio, including in fullscreen.
let resizeFrame = null;
function resizePlaySpace() {
  resizeFrame = null;
  const app = $('room-app'), viewport = $('game-viewport');
  const fitArena = matchMedia('(min-width: 801px) and (pointer: fine), (min-width: 600px) and (orientation: landscape)').matches;
  if (fitArena && (!brawlMode || !app.classList.contains('brawl-lobby-open'))) {
    const footer = document.querySelector('.room-footer'), objective = document.querySelector('.objective-bar');
    const footerSpace = footer.getBoundingClientRect().height + parseFloat(getComputedStyle(footer).marginTop || 0);
    const touchSpace = ['vector-controls', 'shinobi-controls', 'brawl-controls']
      .reduce((height, id) => height + $(id).getBoundingClientRect().height, 0);
    const height = Math.max(180, innerHeight - viewport.getBoundingClientRect().top - objective.getBoundingClientRect().height - touchSpace - footerSpace - 12);
    app.style.setProperty('--room-game-width', `${Math.floor(height * (brawlMode ? 5 / 3 : 3 / 2))}px`);
    if (boardMode) {
      const notice = document.querySelector('.checkers-notice');
      const viewportStyle = getComputedStyle(viewport);
      const padding = parseFloat(viewportStyle.paddingTop) + parseFloat(viewportStyle.paddingBottom);
      app.style.setProperty('--room-board-width', `${Math.max(300, Math.min(650, Math.floor(height - (notice?.getBoundingClientRect().height || 20) - 12 - padding)))}px`);
    }
    if (gameId === 'memory') {
      const grid = document.querySelector('.memory-grid');
      if (grid) {
        const gridStyle = getComputedStyle(grid);
        const rowGap = parseFloat(gridStyle.rowGap) || 9;
        const extraHeight = viewport.getBoundingClientRect().height - grid.getBoundingClientRect().height;
        const width = ((height - extraHeight - rowGap * 3) / 4) * .74 * 8 + rowGap * 7;
        app.style.setProperty('--room-memory-width', `${Math.max(420, Math.min(650, Math.floor(width)))}px`);
      }
    }
  } else {
    app.style.removeProperty('--room-game-width');
    app.style.removeProperty('--room-board-width');
    app.style.removeProperty('--room-memory-width');
  }
  renderer?.resize();
}
function queuePlaySpaceResize() {
  if (resizeFrame == null) resizeFrame = requestAnimationFrame(resizePlaySpace);
}
window.addEventListener('resize', queuePlaySpaceResize);
document.addEventListener('fullscreenchange', () => {
  const fullscreen = !!document.fullscreenElement;
  const label = fullscreen ? 'Exit fullscreen' : 'Enter fullscreen';
  $('fullscreen-button').setAttribute('aria-label', label);
  $('fullscreen-button').title = label;
  queuePlaySpaceResize();
});
if (typeof ResizeObserver === 'function') {
  const observer = new ResizeObserver(queuePlaySpaceResize);
  for (const node of [document.querySelector('.room-heading'), document.querySelector('.game-hud'), document.querySelector('.objective-bar'), document.querySelector('.room-footer'), $('game-viewport')]) observer.observe(node);
}
queuePlaySpaceResize();
if (practiceMode) {
  connected = true; localId = 0;
  $('practice-difficulty').value = practiceSession.settings.difficulty;
  $('practice-bots').value = String(practiceSession.settings.bots);
  if (shinobiMode) $('practice-stage').value = practiceSession.settings.stageId;
  setHidden($('practice-bots-field'), !shinobiMode); setHidden($('practice-stage-field'), !shinobiMode);
  setHidden($('copy-code'), true); setHidden(document.querySelector('.room-invite'), true);
  setText($('room-panel-note'), 'Check the controls here. Solo play pauses while this panel is open.');
  setText($('party-title'), 'Your challenge'); setText($('footer-mode'), 'SOLO / VS BOTS');
  setAttribute($('room-app'), 'data-practice', 'true'); syncPractice();
} else {
  setInterval(() => { if (connected) send({ type: 'ping', time: performance.now() }); }, 1000);
  setInterval(() => { if (connected && performance.now() - lastSnapshotAt > 3000) { error('The host stopped responding. Reconnecting…'); socket.close(); } }, 1500);
  connect();
}
updateConnection(); scheduleFrame();
