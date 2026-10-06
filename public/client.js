import { setText, setAttribute, setHidden, setDisabled, setClass, toggleClass, setStyle, setHTML } from './hub/dom.js';
import { createState, step, startMatch, cloneState, emptyInput, TICK_RATE } from './engine.js';
import { ArenaRenderer } from './renderer.js';
import { botInput, TRAINING_STAGES } from './practice.js';
import { GameAudio } from './audio.js';

const elements = new Map();
const $ = id => { const node = elements.get(id) || document.getElementById(id); if (node) elements.set(id, node); return node; };
const canvas = $('arena');
const renderer = new ArenaRenderer(canvas);
const audio = new GameAudio();
const STEP_MS = 1000 / TICK_RATE;
const roomId = new URLSearchParams(location.search).get('room');
const storage = {
  get(key, fallback) { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* Private browsing still works. */ } },
};
let playerName = storage.get('afterimage-name', 'Challenger');
$('player-name').value = playerName;
let socket, localId = null, connected = false, reconnectAttempts = 0, reconnectTimer;
let authoritative = createState(), predicted = cloneState(authoritative), practiceState = null;
let players = [null, null], sequence = 0, pending = [], snapshots = [];
let keys = emptyInput(), correction = { x: 0, y: 0 }, practice = false;
let trainingMode='open', trainingStage=0;
const trainingProfile=()=>trainingMode==='ladder'?TRAINING_STAGES[trainingStage]:TRAINING_STAGES.find(stage=>stage.id===trainingMode);
function trainingHUD(){
  setHidden($('training-panel'), !practice);const profile=trainingProfile();
  setText($('training-title'), profile?.name || 'Open sparring');
  setText($('training-tip'), profile?.tip || 'Practice the whole move set against a balanced sparring partner.');
  setText($('training-progress'), trainingMode==='ladder'?`${trainingStage+1} / 5 DUELS${practiceState?.phase==='matchEnd' && practiceState.winner===0?' · CLEARED':''}`:'');
}
function restartPractice(){
  releaseKeys();audio.resetEvents();renderer.resetEffects?.();practiceState=createState();startMatch(practiceState);
  previousPhase=practiceState.phase;countdownLast=null;canvas.focus();trainingHUD();
}
$('training-mode').addEventListener('change',()=>{trainingMode=$('training-mode').value;trainingStage=0;if(practice)restartPractice();});
$('training-mode').addEventListener('focus',releaseKeys);
let fullRoom = false, intentionalClose = false, ping = null, lastSnapshotAt = 0;
let inviteAddress = roomId ? location.href : location.origin + '/afterimage.html', focusLost = false, toastTimer;
let previousPhase = 'lobby', fightFlashUntil = 0, countdownLast = null, lastHUD = 0;
const safeName = (value, fallback) => typeof value === 'string' && value.trim() ? value.trim().slice(0, 20) : fallback;
const copyInput = () => ({ ...keys });

function toast(message) {
  $('toast').textContent = message;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 2600);
}

function error(message) {
  $('error-banner').textContent = message || '';
  $('error-banner').hidden = !message;
}

function send(message) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function connectedUI() {
  toggleClass($('connection-dot'), 'online', connected || practice);
  setText($('connection-status'), practice ? 'PRACTICE' : connected ? 'HOST CONNECTED' : fullRoom ? 'ROOM FULL' : 'RECONNECTING');
  setText($('ping'), practice ? 'LOCAL' : ping == null ? '— ms' : `${ping} ms`);
  setDisabled($('ready-button'), !practice && (!connected || localId == null));
  setHidden($('p1-you'), (practice ? 0 : localId) !== 0);
  setHidden($('p2-you'), (practice ? 0 : localId) !== 1);
  setText($('identity-number'), (practice ? 0 : localId) === 1 ? '02' : '01');
  setText($('corner-label'), practice ? 'PRACTICE / YOUR CORNER' : 'YOUR CORNER');
  setStyle(document.querySelector('.name-field>span'), 'color', !practice && localId === 1 ? 'var(--purple)' : 'var(--green)');
}

function receiveState(message) {
  const state = message.state;
  if (!state?.fighters || state.fighters.length !== 2) return;
  lastSnapshotAt = performance.now();
  players = message.players || players;
  authoritative = state;
  const oldPosition = localId == null ? null : predicted.fighters[localId];
  const old = oldPosition ? { x: oldPosition.x, y: oldPosition.y } : null;
  const ack = message.acks?.[localId] ?? -1;
  pending = pending.filter((frame) => frame.seq > ack);
  // Only combat prediction mutates state. Idle snapshots can be read directly.
  predicted = state.phase === 'fight' ? cloneState(state) : state;
  if (localId != null && state.phase === 'fight') {
    const remoteInput = { ...emptyInput(), ...state.fighters[1 - localId].previousInput };
    for (const frame of pending) {
      const inputs = [emptyInput(), emptyInput()];
      inputs[localId] = frame.buttons;
      inputs[1 - localId] = remoteInput;
      step(predicted, inputs);
    }
    if (old && previousPhase === 'fight') {
      const fighter = predicted.fighters[localId];
      correction.x = Math.max(-45, Math.min(45, old.x + correction.x - fighter.x));
      correction.y = Math.max(-35, Math.min(35, old.y + correction.y - fighter.y));
    }
  } else correction = { x: 0, y: 0 };
  snapshots.push({ time: lastSnapshotAt, state });
  if (snapshots.length > 12) snapshots.shift();
  if (!practice) audio.playEvents(state.events || []);
  if (!practice && state.phase !== previousPhase) {
    if (state.phase === 'fight') { fightFlashUntil = performance.now() + 650; audio.fight(); }
    if (state.phase === 'lobby') { keys = emptyInput(); fightFlashUntil = 0; }
  }
  if (!practice) previousPhase = state.phase;
}

function connect() {
  clearTimeout(reconnectTimer);
  if (fullRoom || intentionalClose) return;
  socket = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws${roomId ? '?room=' + encodeURIComponent(roomId) : ''}`);
  socket.addEventListener('open', () => {
    connected = true; reconnectAttempts = 0; sequence = 0; pending = []; snapshots = [];
    ping = null; lastSnapshotAt = performance.now();
    send({ type: 'join', name: playerName });
    error(''); connectedUI();
  });
  socket.addEventListener('message', ({ data }) => {
    let message;
    try { message = JSON.parse(data); } catch { return; }
    if (message.type === 'welcome') {
      if (message.gameId && message.gameId !== 'afterimage') {
        location.replace(`/play.html?room=${encodeURIComponent(roomId)}&game=${encodeURIComponent(message.gameId)}`);
        return;
      }
      localId = message.playerId;
      connectedUI();
      if (practice) send({ type: 'ready', ready: false });
    } else if (message.type === 'state') receiveState(message);
    else if (message.type === 'pong') { ping = Math.max(0, Math.round(performance.now() - message.time)); connectedUI(); }
    else if (message.type === 'error') {
      error(message.message || 'The host could not accept that action.');
      if (/full|two players|occupied|not found|expired/i.test(message.message || '')) { fullRoom = true; localId = null; }
    }
  });
  socket.addEventListener('close', () => {
    connected = false; localId = null; ping = null; keys = emptyInput(); pending = []; snapshots = [];
    authoritative = createState(); predicted = cloneState(authoritative);
    players = [null, null]; connectedUI();
    if (!fullRoom && !intentionalClose) {
      error('Connection to the host was lost. Reconnecting automatically…');
      reconnectTimer = setTimeout(connect, Math.min(5000, 750 * 2 ** reconnectAttempts++));
    }
  });
  socket.addEventListener('error', () => { /* close provides the reconnect path. */ });
}

const keyMapping = new Map([
  ['KeyA', 'left'], ['ArrowLeft', 'left'], ['KeyD', 'right'], ['ArrowRight', 'right'],
  ['KeyW', 'jump'], ['Space', 'jump'], ['ArrowUp', 'jump'], ['KeyJ', 'light'],
  ['KeyK', 'heavy'], ['KeyL', 'dash'], ['ShiftLeft', 'dash'], ['ShiftRight', 'dash'],
  ['KeyI', 'block'], ['KeyU', 'block'],
]);
const heldCodes = new Set();
function refreshKeys() {
  keys = emptyInput();
  for (const code of heldCodes) if (keyMapping.has(code)) keys[keyMapping.get(code)] = true;
}
function releaseKeys() {
  heldCodes.clear(); keys = emptyInput();
  if (connected && localId != null) {
    const frame = { type: 'input', seq: ++sequence, buttons: copyInput() };
    pending.push(frame); send(frame);
  }
}
function isTyping(target) { return target instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable); }
document.addEventListener('keydown', (event) => {
  if (isTyping(event.target) || event.target instanceof Element && event.target.closest('button,a,summary') || event.ctrlKey || event.metaKey || event.altKey) return;
  if (keyMapping.has(event.code)) {
    event.preventDefault(); heldCodes.add(event.code); refreshKeys(); focusLost = false;
    $('focus-note').hidden = true;
  } else if (event.code === 'KeyR' && !event.repeat) { event.preventDefault(); $('ready-button').click(); }
});
document.addEventListener('keyup', (event) => {
  if (keyMapping.has(event.code)) { heldCodes.delete(event.code); refreshKeys(); if (!isTyping(event.target) && !(event.target instanceof Element && event.target.closest('button,a,summary'))) event.preventDefault(); }
});
window.addEventListener('blur', () => { releaseKeys(); focusLost = true; });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) releaseKeys();
  previousTime = performance.now(); accumulator = 0;
});
$('player-name').addEventListener('focus', releaseKeys);
canvas.tabIndex = 0;
canvas.addEventListener('pointerdown', () => { canvas.focus(); focusLost = false; $('focus-note').hidden = true; });

function toggleReady() {
  if (practice) {
    if(trainingMode==='ladder' && practiceState.phase==='matchEnd' && practiceState.winner===0)trainingStage=(trainingStage+1)%TRAINING_STAGES.length;
    restartPractice();return;
  }
  if (!connected || localId == null) return;
  const current = authoritative.phase;
  if (current === 'fight' || current === 'roundEnd') return;
  const ready = !players[localId]?.ready;
  send(current === 'matchEnd' ? { type: 'rematch' } : { type: 'ready', ready });
  if (ready) { $('player-name').blur(); canvas.focus(); }
}
$('ready-button').addEventListener('click', toggleReady);
$('player-name').addEventListener('change', () => {
  playerName = safeName($('player-name').value, 'Challenger');
  $('player-name').value = playerName; storage.set('afterimage-name', playerName);
  send({ type: 'join', name: playerName });
});
$('player-name').addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.target.blur(); canvas.focus(); } });

$('practice-button').addEventListener('click', () => {
  practice = !practice;
  audio.resetEvents(); renderer.resetEffects?.();
  releaseKeys(); correction = { x: 0, y: 0 }; countdownLast = null; fightFlashUntil = 0;
  if (practice) {
    send({ type: 'ready', ready: false });
    trainingStage=0;restartPractice();
    toast('Practice opponent joined. Make the first move.');
  } else { practiceState = null; previousPhase = authoritative.phase; toast('Back in the multiplayer room.'); }
  $('app').classList.toggle('is-practice', practice);
  $('practice-button').querySelector('span').textContent = practice ? 'Leave practice' : 'Practice';
  $('mode-tag').textContent = practice ? 'SPARRING SESSION' : 'PRIVATE 1V1';
  connectedUI(); trainingHUD(); canvas.focus();
});

$('sound-button').addEventListener('click', async () => {
  try {
    await audio.setEnabled(!audio.enabled);
    $('sound-button').setAttribute('aria-pressed', String(audio.enabled));
    $('sound-button').setAttribute('aria-label', audio.enabled ? 'Mute game sound' : 'Enable game sound');
    $('sound-button').title = audio.enabled ? 'Mute game sound' : 'Enable game sound';
    $('sound-button').innerHTML = audio.enabled
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m11 5-5 4H3v6h3l5 4V5zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m11 5-5 4H3v6h3l5 4V5zm5 4 5 6m0-6-5 6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  } catch { toast('Sound is unavailable in this browser.'); }
});
$('fullscreen-button').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await $('app').requestFullscreen();
  } catch { toast('Fullscreen is unavailable in this browser.'); }
});
$('guide-button').addEventListener('click', () => {
  const open = $('combat-guide').hidden;
  $('combat-guide').hidden = !open;
  $('guide-button').setAttribute('aria-expanded', String(open));
  $('guide-button').querySelector('span').textContent = open ? '−' : '+';
});
$('copy-button').addEventListener('click', async () => {
  try {
    if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(inviteAddress);
    else {
      const field = document.createElement('textarea');
      field.value = inviteAddress; field.style.position = 'fixed'; field.style.opacity = '0';
      document.body.append(field); field.select();
      const success = document.execCommand('copy'); field.remove();
      if (!success) throw new Error('Clipboard unavailable');
    }
    toast('Invite copied. Send it to your opponent.');
  } catch {
    toast('Select the room address to copy it.');
    const selection = window.getSelection(); const range = document.createRange();
    range.selectNodeContents($('invite-address')); selection.removeAllRanges(); selection.addRange(range);
  }
});

async function setInvite() {
  try {
      const info = await (await fetch('/api/host-info')).json();
      $('download-link').hidden = !info.downloadAvailable;
      if (['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0'].includes(location.hostname)) {
      const hostname = typeof info.hostname === 'string' && /^[a-zA-Z0-9._-]+$/.test(info.hostname) ? info.hostname : info.addresses?.[0];
      if (hostname) inviteAddress = `http://${hostname}:${info.port || location.port || 3000}${roomId ? location.pathname + location.search : '/afterimage.html'}`;
      }
  } catch { /* Current address remains selectable. */ }
  $('invite-address').textContent = inviteAddress;
  $('invite-address').title = `${inviteAddress} — your opponent needs access to your PC over LAN or VPN`;
}

function inputTick() {
  if (practice) {
    const phase = practiceState.phase;
    step(practiceState, [copyInput(), botInput(practiceState, 1, trainingProfile()?.id || 'open')]);
    audio.playEvents(practiceState.events || []);
    if (phase !== practiceState.phase) {
      if (practiceState.phase === 'fight') { fightFlashUntil = performance.now() + 650; audio.fight(); }
      previousPhase = practiceState.phase;
    }
  }
  if (!practice && authoritative.phase === 'fight' && connected && localId != null) {
    const frame = { type: 'input', seq: ++sequence, buttons: copyInput() };
    send(frame);
    pending.push(frame);
    if (pending.length > 180) pending.shift();
    if (!practice && predicted.phase === 'fight') {
      const inputs = [emptyInput(), emptyInput()];
      inputs[localId] = frame.buttons;
      inputs[1 - localId] = { ...emptyInput(), ...authoritative.fighters[1 - localId].previousInput };
      step(predicted, inputs);
    }
  }
}

function displayState(now) {
  if (practice) return practiceState;
  if (authoritative.phase !== 'fight' || localId == null) return authoritative;
  // Own fighter is predicted. Opponent is interpolated behind the latest snapshot.
  const state = { ...predicted, fighters: predicted.fighters.map((f) => ({ ...f })) };
  state.events = authoritative.events || [];
  const own = state.fighters[localId];
  own.x += correction.x; own.y += correction.y;
  correction.x *= .72; correction.y *= .72;
  const target = now - 35;
  const remote = 1 - localId;
  let before = snapshots[0], after = snapshots.at(-1);
  for (let i = 1; i < snapshots.length; i++) {
    if (snapshots[i].time >= target) { before = snapshots[i - 1]; after = snapshots[i]; break; }
  }
  if (before && after && before.state.phase === 'fight' && after.state.phase === 'fight') {
    const a = before.state.fighters[remote], b = after.state.fighters[remote];
    const alpha = Math.max(0, Math.min(1, (target - before.time) / Math.max(1, after.time - before.time)));
    state.fighters[remote] = { ...b, x: a.x + (b.x - a.x) * alpha, y: a.y + (b.y - a.y) * alpha };
  }
  return state;
}

const actionLabels = { idle: 'HOLD YOUR GROUND', run: 'FINDING THE RANGE', jump: 'AIRBORNE', light: 'QUICK STRIKE', heavy: 'HEAVY STRIKE', dash: 'EVASION', block: 'GUARDING', parry: 'PARRY', hit: 'RECOVERING', dead: 'KNOCKED OUT' };
function updateHUD(now) {
  const state = practice ? practiceState : authoritative;
  const inMatch = ['countdown', 'fight', 'roundEnd', 'matchEnd'].includes(state.phase);
  const names = practice ? [playerName, trainingProfile()?.name.slice(5) || 'Sparring partner'] : players.map((p, i) => safeName(p?.name, `Challenger 0${i + 1}`));
  for (let i = 0; i < 2; i++) {
    const fighter = state.fighters[i], prefix = `p${i + 1}`;
    setText($(prefix + '-name'), names[i].toUpperCase());
    const hp = Math.max(0, Math.min(100, fighter.hp));
    setStyle($(prefix + '-health'), 'width', `${hp}%`);
    setStyle($(prefix + '-ghost'), 'width', `${hp}%`);
    setStyle($(prefix + '-stamina'), 'width', `${Math.max(0, Math.min(100, fighter.stamina))}%`);
    setText($(prefix + '-action'), state.phase === 'lobby'
      ? (players[i]?.connected ? players[i]?.ready ? 'READY TO DUEL' : 'IN THE ROOM' : 'WAITING FOR PLAYER')
      : fighter.guardBroken > 0 ? 'GUARD BROKEN' : actionLabels[fighter.action] || 'FIGHTING');
    $(prefix + '-wins').querySelectorAll('i').forEach((dot, j) => toggleClass(dot, 'won', j < (fighter.wins || 0)));
    const active = practice || players[i]?.connected;
    const ready = practice || players[i]?.ready;
    setClass($(`slot${i + 1}-dot`), active ? ready ? 'ready' : 'connected' : '');
    const cornerStatus = state.phase === 'fight' || state.phase === 'roundEnd' ? 'In the game' : ready ? 'Ready' : 'Not ready';
    setText($(`slot${i + 1}-status`), practice ? `${names[i]} · ${i ? 'Practice AI' : 'You'}` : active ? `${names[i]} · ${cornerStatus}` : `Waiting for ${i === localId ? 'connection' : 'opponent'}`);
  }
  setText($('round-label'), `ROUND ${String(state.round || 1).padStart(2, '0')}`);
  const seconds = Math.max(0, Math.ceil((state.roundTicks ?? 90 * TICK_RATE) / TICK_RATE));
  setText($('timer'), String(seconds).padStart(2, '0'));
  setStyle($('timer'), 'color', seconds <= 10 && state.phase === 'fight' ? '#eea087' : '');
  const mine = players[localId];
  const button = $('ready-button');
  toggleClass(button, 'is-ready', !practice && !!mine?.ready);
  setText(button.querySelector('span'), practice ? state.phase === 'matchEnd' ? trainingMode==='ladder' && state.winner===0 ? trainingStage===4 ? 'Ladder complete · Play again' : 'Next training duel' : 'Retry duel' : 'Restart practice' : state.phase === 'matchEnd' ? mine?.ready ? 'Rematch ready' : 'Rematch' : state.phase === 'fight' || state.phase === 'roundEnd' ? 'Match in progress' : mine?.ready ? 'Cancel ready' : 'Ready up');
  setDisabled(button, !practice && (!connected || localId == null || state.phase === 'fight' || state.phase === 'roundEnd' || state.phase === 'countdown' && state.round > 1));
  setDisabled($('practice-button'), !practice && ['fight', 'roundEnd', 'countdown'].includes(authoritative.phase));
  setDisabled($('player-name'), inMatch);
  toggleClass(document.querySelector('.game-shell'), 'in-fight', state.phase === 'fight');
  setHidden($('focus-note'), !(focusLost && state.phase === 'fight'));
  if(practice)trainingHUD();
  setText($('timer-caption'), practice ? 'SPARRING SESSION' : 'BEST OF THREE');
  const overlay = $('game-overlay');
  let overlayClass = 'game-overlay', overlayHidden = false;
  let kicker, title, subtitle;
  if (state.phase === 'lobby') {
    countdownLast = null;
    kicker = fullRoom ? 'TWO CORNERS. TWO FIGHTERS.' : !connected ? 'FINDING THE HOST' : mine?.ready ? 'CHALLENGE ACCEPTED' : 'THE ROOM IS OPEN';
    title = fullRoom ? 'Room occupied.' : !connected ? 'Reconnecting.' : mine?.ready ? 'Hold your ground.' : 'Your move.';
    subtitle = fullRoom ? 'Both player slots are in use. You can still train in practice.' : !connected ? 'Keep the host running. We’ll bring you back into the room.' : mine?.ready ? 'Waiting for your opponent to ready up.' : 'Ready up. Your opponent will meet you here.';
    setHTML($('arena-status'), '<i></i> WAITING FOR TWO FIGHTERS');
    setText($('round-message'), 'BOTH PLAYERS READY → FIGHT');
  } else if (state.phase === 'countdown') {
    const count = Math.max(1, Math.ceil(state.phaseTicks / TICK_RATE));
    kicker = `ROUND ${String(state.round).padStart(2, '0')} / GET READY`;
    title = String(count); subtitle = 'Find your range.'; overlayClass += ' countdown';
    if (count !== countdownLast) { audio.countdown(count); countdownLast = count; }
    setHTML($('arena-status'), '<i></i> BOTH FIGHTERS READY');
    setText($('round-message'), 'THE DUEL STARTS NOW');
  } else if (state.phase === 'fight') {
    if (now < fightFlashUntil) { kicker = 'NO SECOND GUESSING'; title = 'FIGHT'; subtitle = ''; overlayClass += ' fight-flash'; }
    else overlayHidden = true;
    setHTML($('arena-status'), `<i></i> ${practice ? 'SPARRING SESSION' : 'DUEL IN PROGRESS'}`);
    setText($('round-message'), 'READ. REACT. COMMIT.');
  } else {
    countdownLast = null;
    const winner = state.winner;
    kicker = state.phase === 'matchEnd' ? 'THE ROOFTOP HAS A WINNER' : `ROUND ${String(state.round).padStart(2, '0')} COMPLETE`;
    title = winner == null ? 'A perfect tie.' : `${winner === (practice ? 0 : localId) ? 'You' : names[winner]} ${winner === (practice ? 0 : localId) ? 'win' : 'wins'}.`;
    subtitle = state.phase === 'matchEnd' ? practice ? trainingMode==='ladder' && winner===0 ? trainingStage===4 ? 'All five opponents defeated. The rooftop is yours.' : 'Challenge cleared. Continue to your next opponent below.' : 'Study the matchup, then retry or choose another training opponent.' : 'Run it back. Both players must ready up for a rematch.' : 'Take a breath. Next round starts shortly.';
    setHTML($('arena-status'), `<i></i> ${state.phase === 'matchEnd' ? 'MATCH COMPLETE' : 'ROUND COMPLETE'}`);
    setText($('round-message'), state.phase === 'matchEnd' ? 'READY FOR A REMATCH?' : 'FIRST TO TWO ROUNDS');
  }
  setClass(overlay, overlayClass); setHidden(overlay, overlayHidden);
  if (!overlayHidden) {
    setText($('overlay-kicker'), kicker);
    setText($('overlay-title'), title);
    setText($('overlay-subtitle'), subtitle);
  }
}

let previousTime = performance.now(), accumulator = 0;
function animate(now) {
  if (document.hidden) {
    previousTime = now; accumulator = 0;
    requestAnimationFrame(animate); return;
  }
  // Drop long browser stalls. Never flood the server with stale catch-up inputs.
  accumulator += Math.min(65, now - previousTime); previousTime = now;
  let ticks = 0;
  while (accumulator >= STEP_MS && ticks++ < 8) { inputTick(); accumulator -= STEP_MS; }
  renderer.render(displayState(now), { localId: practice ? 0 : localId, time: now, camera: 'crop' });
  if (now - lastHUD > 50) { updateHUD(now); lastHUD = now; }
  requestAnimationFrame(animate);
}

setInterval(() => { if (connected) send({ type: 'ping', time: performance.now() }); }, 1000);
setInterval(() => {
  if (connected && !practice && performance.now() - lastSnapshotAt > 3000) {
    error('The host has stopped responding. Reconnecting…'); socket.close();
  }
}, 1500);
window.addEventListener('beforeunload', () => { intentionalClose = true; socket?.close(); });
window.addEventListener('resize', () => renderer.resize());
// A small callable surface lets browser-based verification inspect real state.
window.afterimage = { getState: () => cloneState(practice ? practiceState : authoritative), get playerId() { return localId; }, get connected() { return connected; }, get practice() { return practice; } };
setInvite(); connect(); connectedUI(); requestAnimationFrame(animate);
