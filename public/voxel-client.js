import { gameKey, getKeyboardLayout, mountKeyboardLayoutPicker, subscribeKeyboardLayout } from './keyboard-layout.js';
import { copyText, getName, hostInfo, roomUrl, saveName } from './hub/shared.js';
import { GameAudio } from './audio.js';

export const LOOK_SENSITIVITY = 0.0025;
export const FPS_BUTTONS = Object.freeze(['up', 'down', 'left', 'right', 'jump', 'crouch', 'walk', 'fire', 'reload', 'interact']);
const TAU = Math.PI * 2;
const clone = value => value == null ? value : structuredClone(value);

export function cleanAim(yaw = 0, pitch = 0) {
  const safeYaw = Number.isFinite(yaw) ? yaw : 0;
  return { yaw: ((safeYaw + Math.PI) % TAU + TAU) % TAU - Math.PI, pitch: Math.max(-1.35, Math.min(1.35, Number.isFinite(pitch) ? pitch : 0)) };
}

export function neutralInput(yaw = 0, pitch = 0) {
  return Object.fromEntries([...FPS_BUTTONS.map(key => [key, false]), ...Object.entries(cleanAim(yaw, pitch))]);
}

export function controlForKey(event, layout = getKeyboardLayout()) {
  const key = gameKey(event, layout).toLowerCase();
  return ({ w: 'up', arrowup: 'up', s: 'down', arrowdown: 'down', a: 'left', arrowleft: 'left', d: 'right', arrowright: 'right', ' ': 'jump', control: 'crouch', shift: 'walk', r: 'reload', e: 'interact' })[key] || null;
}

export function isFormTarget(target) {
  return !!target?.closest?.('input, select, textarea, button, a, [contenteditable="true"], [role="dialog"]');
}

export function composeInput(keys, touch, mouse, aim, active = true) {
  const input = neutralInput(aim.yaw, aim.pitch);
  if (!active) return input;
  for (const action of FPS_BUTTONS) input[action] = keys.has(action) || touch.actions.has(action);
  input.up ||= touch.move.y < -0.22;
  input.down ||= touch.move.y > 0.22;
  input.left ||= touch.move.x < -0.22;
  input.right ||= touch.move.x > 0.22;
  input.fire ||= mouse.fire;
  return input;
}

/** Both touch pads share a wire budget; digital transitions always bypass it. */
export function createContinuousInputPacer(maxHz = 60) {
  const interval = 1000 / maxHz;
  let lastSentAt = -Infinity;
  return {
    shouldSend(now, digitalEdge = false) {
      if (!digitalEdge && now - lastSentAt < interval - .001) return false;
      lastSentAt = now;
      return true;
    },
    reset() { lastSentAt = -Infinity; },
  };
}

/** The planted charge replaces the round clock; it never runs beside a stale timer. */
export function matchClock(state) {
  const phase = state?.phase || 'lobby';
  const planted = phase === 'fight' && state?.bomb?.status === 'planted';
  const ticks = planted ? state.bomb.timerTicks : phase === 'fight' ? state.roundTicks : state?.phaseTicks;
  const seconds = Math.max(0, Math.ceil((ticks || 0) / 120));
  const inactive = phase === 'lobby' || phase === 'matchEnd';
  return { seconds, planted, urgent: !inactive && phase === 'fight' && seconds <= 10,
    label: planted ? `SITE ${state.bomb.siteId || 'A'} · DEVICE PLANTED` : phase === 'lobby' ? 'ASSEMBLE YOUR TEAM' : phase === 'buy' ? 'LOADOUT PHASE' : phase === 'roundEnd' ? 'NEXT ROUND' : phase === 'matchEnd' ? 'MATCH COMPLETE' : `ROUND ${String(state?.round || 1).padStart(2, '0')}`,
    text: inactive ? '—' : phase === 'fight' && !planted ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : String(seconds).padStart(2, '0') };
}

export function roundResult(state, localTeam) {
  const winner = state?.roundWinner;
  if (winner !== 0 && winner !== 1) return null;
  const won = winner === localTeam;
  const reason = ({ defuse: 'Device defused.', explosion: 'Device detonated.', time: 'Time expired. Both sites held.', elimination: won ? 'Opposing squad eliminated.' : 'Your squad was eliminated.' })[state.roundReason] || 'Round complete.';
  return { won, title: won ? 'Round secured.' : 'Round lost.', team: winner === 0 ? 'AMBER' : 'TEAL', role: winner === state.attackTeam ? 'BREACH' : 'HOLD', reason };
}

/** Navigation contains only connected, living teammates; opponents never supply markers. */
export function tacticalMapPlayers(state, localId, connectedIds) {
  const local = state?.players?.find(player => player.id === localId);
  if (!local) return [];
  const connected = connectedIds == null ? null : new Set(connectedIds);
  return state.players.filter(player => player.team === local.team && player.alive && (!connected || connected.has(player.id)) && [player.x, player.z, player.yaw].every(Number.isFinite))
    .map(player => ({ id: player.id, x: player.x, z: player.z, yaw: player.yaw, self: player.id === localId }));
}

export function loadoutForKey(event, phase) {
  if (!['countdown', 'buy', 'roundEnd'].includes(phase) || event.repeat || event.altKey || event.ctrlKey || event.metaKey || isFormTarget(event.target)) return null;
  // Unshifted AZERTY prints &, é and " on these physical number keys.
  return ({ Digit1: 'carbine', Digit2: 'smg', Digit3: 'marksman', Numpad1: 'carbine', Numpad2: 'smg', Numpad3: 'marksman' })[event.code]
    || ({ '1': 'carbine', '2': 'smg', '3': 'marksman' })[event.key] || null;
}

/** Interpolate remote bodies only. Camera aim and authoritative combat remain immediate. */
export function interpolatedState(samples, targetTime, localId, { predictMovement, maxExtrapolationMs = 25 } = {}) {
  if (!samples.length) return null;
  let from = samples[0]; let to = samples[samples.length - 1];
  for (let i = 1; i < samples.length; i++) {
    if (samples[i].time >= targetTime) { from = samples[i - 1]; to = samples[i]; break; }
    from = samples[i];
  }
  const state = { ...to.state, players: to.state.players.map(player => ({ ...player })) };
  state.fighters = state.players;
  const span = to.time - from.time;
  const ratio = span > 0 ? Math.max(0, Math.min(1, (targetTime - from.time) / span)) : 1;
  if (from.state.phase !== to.state.phase || from.state.round !== to.state.round) return state;
  for (const player of state.players) {
    const old = from.state.players.find(other => other.id === player.id);
    if (player.id === localId || !old || old.alive !== player.alive) continue;
    // A respawn, team change or correction never sweeps an avatar through the map.
    if (Math.hypot(player.x - old.x, player.y - old.y, player.z - old.z) > 4) continue;
    for (const axis of ['x', 'y', 'z']) player[axis] = old[axis] + (player[axis] - old[axis]) * ratio;
    const turn = cleanAim(player.yaw - old.yaw, 0).yaw;
    player.yaw = cleanAim(old.yaw + turn * ratio, 0).yaw;
    player.pitch = old.pitch + (player.pitch - old.pitch) * ratio;
  }
  // Snapshots arrive at 30 Hz. A short, collision-tested projection avoids aiming
  // at bodies rendered a full network frame behind their authoritative pose.
  const projectedTicks = Math.floor(Math.min(maxExtrapolationMs, Math.max(0, targetTime - to.time)) * 120 / 1000);
  if (projectedTicks && state.phase === 'fight' && typeof predictMovement === 'function') {
    for (const player of state.players) if (player.id !== localId && player.alive) predictMovement(player, player.previousInput || neutralInput(player.yaw, player.pitch), state.mapId, projectedTicks);
  }
  return state;
}

/** Replay a bounded, copied movement history after the server acknowledges inputs. */
export function reconcilePlayer(player, history, ack, mapId, predictMovement, allowMovement = true) {
  const pending = history.filter(frame => frame.seq > ack).slice(-240);
  const predicted = clone(player);
  if (predicted?.alive && allowMovement) for (const frame of pending) predictMovement(predicted, frame.buttons, mapId, 1);
  return { predicted, pending };
}

async function boot() {
  const $ = id => document.getElementById(id);
  const canvas = $('arena');
  const roomId = new URLSearchParams(location.search).get('room')?.trim().toUpperCase() || '';
  const roomLabel = /^[A-Z0-9]{6}$/.test(roomId) ? roomId : 'NO ROOM';
  $('room-code').textContent = roomLabel;
  const layoutPicker = mountKeyboardLayoutPicker(document.querySelector('[data-keyboard-layout-picker]'));
  let playerName = getName(); $('player-name').value = playerName;
  let engine; let renderer; let socket; let connected = false; let playerId = null;
  let state = null; let roster = []; let capacity = 2; let teamSize = 1; let mapName = '';
  let predictedPlayer = null; let snapshots = []; let pending = []; let sequence = 0;
  let frameId = null; let lastFrameAt = 0; let accumulator = 0; let renderCount = 0;
  let destroyed = false; let reconnectTimer; let attempts = 0; let permanentError = false;
  let paused = true; let entered = false; let fallback = false; let touchMode = false;
  let rightDrag = false; let graphicsError = ''; let modalOpen = false; let spectatorId = null; let teamSwitchPending = false; let requestedTeam = null;
  let previousPhase = null; let previousRound = null; let aim = { yaw: 0, pitch: 0 };
  let hitUntil = 0; let hitKind = 'body'; let damageUntil = 0; let feedbackUntil = 0; let toastTimer; let lastCountdown = null; let lastHUDAt = 0;
  let inputHeartbeat = null; let lastAimSendAt = 0; let lastTouchLookAt = performance.now();
  const keys = new Set(); const pressedKeys = new Map();
  const mouse = { fire: false };
  const touch = { move: { x: 0, y: 0 }, look: { x: 0, y: 0 }, actions: new Set() };
  const actionPointers = new Map(); const padPointers = new Map();
  const padInputPacer = createContinuousInputPacer(60);
  let rosterSignature = ''; let idleDrawSignature = ''; let mapPlanId = ''; const mapMarkers = new Map();
  const audio = new GameAudio(); const eventSeen = new Set(); const eventOrder = []; const kills = [];
  const removers = [];
  function listen(target, name, handler, options) { target.addEventListener(name, handler, options); removers.push(() => target.removeEventListener(name, handler, options)); }
  function send(message) { if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message)); }
  function error(message = '') { $('error-banner').textContent = message; $('error-banner').hidden = !message; }
  function toast(message) { clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false; toastTimer = setTimeout(() => { $('toast').hidden = true; }, 2800); }
  function ownPlayer() { return state?.players?.find(player => player.id === playerId) || null; }
  function pointerLocked() { return document.pointerLockElement === canvas; }
  function controlsActive() { return connected && entered && !paused && !modalOpen && !graphicsError && !document.hidden && !!ownPlayer()?.alive && ['countdown', 'buy', 'fight'].includes(state?.phase) && (pointerLocked() || fallback || touchMode); }
  function currentInput() { return composeInput(keys, touch, mouse, aim, controlsActive()); }
  function sendInput(buttons = currentInput()) { if (teamSwitchPending) return sequence; if (sequence >= 999999000) sequence = 0; send({ type: 'input', seq: ++sequence, buttons }); return sequence; }
  function integrateTouchLook(now = performance.now()) {
    const delta = Math.max(0, Math.min(.1, (now - lastTouchLookAt) / 1000)); lastTouchLookAt = now;
    if (controlsActive() && touchMode) aim = cleanAim(aim.yaw + touch.look.x * delta * 2.4, aim.pitch - touch.look.y * delta * 1.85);
  }
  function refreshHeartbeat() {
    const shouldRun = !destroyed && connected && !document.hidden && !teamSwitchPending && ['countdown', 'buy', 'fight'].includes(state?.phase);
    if (shouldRun && !inputHeartbeat) inputHeartbeat = setInterval(() => { integrateTouchLook(); sendInput(); }, 50);
    else if (!shouldRun && inputHeartbeat) { clearInterval(inputHeartbeat); inputHeartbeat = null; }
  }
  function neutralize({ pause = false, unlock = false } = {}) {
    keys.clear(); pressedKeys.clear(); mouse.fire = false; rightDrag = false;
    touch.actions.clear(); touch.move = { x: 0, y: 0 }; touch.look = { x: 0, y: 0 };
    for (const [pointerId, element] of actionPointers) try { element.releasePointerCapture(pointerId); } catch { /* A cancelled pointer is already released. */ }
    for (const [pointerId, record] of padPointers) try { record.element.releasePointerCapture(pointerId); } catch { /* A cancelled pointer is already released. */ }
    actionPointers.clear(); padPointers.clear();
    document.querySelectorAll('.pressed, .touch-pad.active').forEach(element => element.classList.remove('pressed', 'active'));
    document.querySelectorAll('.touch-pad>i').forEach(element => { element.style.transform = ''; });
    if (pause) paused = true;
    if (unlock && pointerLocked()) document.exitPointerLock?.();
    if (connected && playerId !== null) sendInput(neutralInput(aim.yaw, aim.pitch));
    pending = []; accumulator = 0;
    padInputPacer.reset();
    lastTouchLookAt = performance.now();
    if (state) predictedPlayer = clone(ownPlayer());
    updateUI();
  }
  function connectionUI() {
    $('connection-status').textContent = connected ? 'CONNECTED' : permanentError ? 'UNAVAILABLE' : 'RECONNECTING';
    $('connection-dot').classList.toggle('online', connected);
  }
  function lookupName(id) { return roster.find(player => player?.id === id)?.name || `Player ${id + 1}`; }
  function bombState() { const value = state?.bomb || state?.objective; return value && typeof value === 'object' ? value : null; }
  function allConnected() { return roster.filter(player => player?.connected).length === capacity; }

  function selectArenaLoadout(weaponId) {
    if (!connected || modalOpen || graphicsError || !['countdown', 'buy', 'roundEnd'].includes(state?.phase) || ownPlayer()?.weapon === weaponId) return;
    neutralize(); send({ type: 'fps-loadout', weaponId });
  }

  function updateTacticalMap() {
    const plan = engine?.MAPS?.[state?.mapId]; const local = ownPlayer();
    $('tactical-map').hidden = !plan || !local || !['countdown', 'buy', 'fight', 'roundEnd'].includes(state?.phase);
    if (!plan || !local) return;
    const svg = $('map-plan'); const svgNode = (tag, attributes) => {
      const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
      for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
      return node;
    };
    if (mapPlanId !== plan.id) {
      mapPlanId = plan.id; mapMarkers.clear(); svg.replaceChildren();
      const bounds = plan.bounds;
      svg.setAttribute('viewBox', `${bounds.minX - 2} ${bounds.minZ - 2} ${bounds.maxX - bounds.minX + 4} ${bounds.maxZ - bounds.minZ + 4}`);
      svg.append(svgNode('rect', { x: bounds.minX, y: bounds.minZ, width: bounds.maxX - bounds.minX, height: bounds.maxZ - bounds.minZ, class: 'map-floor' }));
      for (const box of plan.colliders) svg.append(svgNode('rect', { x: box.x, y: box.z, width: box.w, height: box.d, class: `map-cover${box.h < 1.3 ? ' low' : ''}` }));
      for (const site of plan.sites) {
        svg.append(svgNode('circle', { cx: site.x, cy: site.z, r: site.radius + .4, class: 'map-site' }));
        const label = svgNode('text', { x: site.x, y: site.z + 1.1, class: 'map-site-label' }); label.textContent = site.id; svg.append(label);
      }
      const markers = svgNode('g', { class: 'map-team-markers' }); svg.append(markers);
      // Exactly six reusable nodes cover the largest lobby. Updates only move/hide them.
      for (let id = 0; id < 6; id++) {
        const node = svgNode('path', { d: 'M0 -1.8 L1.3 1.3 L0 .7 L-1.3 1.3 Z', class: 'map-player', display: 'none' });
        node.dataset.playerId = String(id); markers.append(node); mapMarkers.set(id, node);
      }
    }
    const players = tacticalMapPlayers(state, playerId, roster.filter(person => person?.connected).map(person => person.id));
    const visible = new Set(players.map(player => player.id));
    for (const [id, marker] of mapMarkers) marker.setAttribute('display', visible.has(id) ? 'inline' : 'none');
    for (const player of players) {
      const marker = mapMarkers.get(player.id); if (!marker) continue;
      const pose = player.self && local.alive ? predictedPlayer || local : player;
      marker.setAttribute('transform', `translate(${pose.x} ${pose.z}) rotate(${(player.self ? aim.yaw : player.yaw) * 180 / Math.PI})`);
      marker.setAttribute('d', player.self ? 'M0 -1.8 L1.3 1.3 L0 .7 L-1.3 1.3 Z' : 'M1.2 0 A1.2 1.2 0 1 1 -1.2 0 A1.2 1.2 0 1 1 1.2 0 Z');
      marker.setAttribute('class', player.self ? 'map-player self' : 'map-player');
    }
  }

  function playEvents(events = []) {
    for (const event of events) {
      const eventId = event.id ?? `${state?.tick}:${event.type}:${event.playerId ?? event.attackerId ?? ''}:${event.targetId ?? ''}`;
      if (eventSeen.has(eventId)) continue;
      eventSeen.add(eventId); eventOrder.push(eventId);
      if (eventOrder.length > 512) eventSeen.delete(eventOrder.shift());
      const shooter = event.shooterId ?? event.attackerId ?? event.playerId ?? event.attacker;
      const target = event.targetId ?? event.victimId ?? event.target;
      if (event.type === 'damage' && event.damage > 0) {
        if (shooter === playerId) { hitUntil = performance.now() + 150; hitKind = event.headshot ? 'headshot' : 'body'; }
        if (target === playerId) damageUntil = performance.now() + 230;
      }
      if (['kill', 'death', 'elimination'].includes(event.type)) {
        kills.push({ at: performance.now(), text: `${lookupName(shooter)}  ${event.headshot ? '[HS]' : '›'}  ${lookupName(target)}`, own: shooter === playerId, headshot: !!event.headshot });
        if (kills.length > 4) kills.shift();
        if (shooter === playerId) { hitUntil = performance.now() + 230; hitKind = 'elimination'; feedbackUntil = performance.now() + 1100; $('combat-feedback').textContent = event.headshot ? 'HEADSHOT · ELIMINATED' : 'ELIMINATED'; }
      }
      if (!audio.enabled) continue;
      try {
        if (event.type === 'shot' || event.type === 'fire') {
          const own = shooter === playerId;
          audio.noise(0.075, { highpass: 170, lowpass: 4400, gain: own ? 0.34 : 0.12 });
          audio.tone(event.weapon === 'marksman' ? 90 : 150, 0.09, { end: 48, type: 'triangle', gain: own ? 0.26 : 0.09 });
        } else if (event.type === 'damage' && (shooter === playerId || target === playerId)) {
          audio.tone(shooter === playerId ? 920 : 130, 0.055, { end: shooter === playerId ? 620 : 70, type: 'triangle', gain: 0.23 });
        } else if (['plant', 'planted', 'defuse', 'defused', 'bombPlant', 'bombDefuse'].includes(event.type)) {
          audio.tone(640, 0.13, { gain: 0.18 }); audio.tone(880, 0.12, { gain: 0.12, delay: 0.13 });
        } else if (event.type === 'explosion' || event.type === 'detonate') {
          audio.noise(0.45, { highpass: 30, lowpass: 1700, gain: 0.45 }); audio.tone(65, 0.42, { end: 28, gain: 0.25 });
        }
      } catch { /* Optional sound cannot interrupt gameplay. */ }
    }
  }

  function renderRoster() {
    const signature = JSON.stringify([teamSize, playerId, state?.phase, roster.map(person => person && [person.id, person.name, person.connected, person.ready]), state?.players?.map(player => [player.id, player.alive, player.weapon])]);
    if (signature === rosterSignature) return;
    rosterSignature = signature;
    for (let team = 0; team < 2; team++) {
      const container = $(`team${team}-roster`); container.replaceChildren();
      for (let seat = 0; seat < teamSize; seat++) {
        const id = team * teamSize + seat; const person = roster.find(player => player?.id === id);
        const player = state?.players?.find(other => other.id === id);
        const row = document.createElement('div'); row.className = `roster-slot${person?.connected ? '' : ' empty'}`;
        row.dataset.playerId = id;
        const number = document.createElement('i'); number.textContent = String(seat + 1).padStart(2, '0');
        const details = document.createElement('div'); const name = document.createElement('strong');
        name.textContent = person?.connected ? person.name || `Player ${id + 1}` : 'Open seat';
        const status = document.createElement('small');
        status.textContent = !person?.connected ? 'SEND AN INVITE' : state?.phase === 'lobby' ? person.ready ? 'READY' : 'CHOOSING LOADOUT' : player?.alive ? (player.weapon || 'carbine').toUpperCase() : 'ELIMINATED';
        details.append(name, status); row.append(number, details);
        const badge = document.createElement('span'); badge.textContent = id === playerId ? 'YOU' : '';
        row.append(badge); container.append(row);
      }
    }
  }

  function updateUI() {
    refreshHeartbeat();
    connectionUI();
    const phase = state?.phase || 'lobby'; const local = ownPlayer(); const inLobby = phase === 'lobby';
    $('seat-count').textContent = `${roster.filter(player => player?.connected).length} / ${capacity} PLAYERS · ${teamSize}V${teamSize}`;
    $('mode-tag').textContent = `${teamSize}V${teamSize} · FIRST TO FOUR`;
    $('stage-mode').textContent = `${teamSize}V${teamSize} / FIRST TO FOUR`;
    $('objective-mode').textContent = `${teamSize}V${teamSize} / ${mapName || 'VOXEL BREACH'}`;
    $('player-name').disabled = !inLobby || !connected;
    $('loadout-select').disabled = !connected || !['lobby', 'countdown', 'buy', 'roundEnd'].includes(phase);
    if (local?.weapon && document.activeElement !== $('loadout-select')) $('loadout-select').value = local.weapon;
    const me = roster.find(player => player?.id === playerId);
    $('ready-button').hidden = phase === 'matchEnd'; $('rematch-button').hidden = phase !== 'matchEnd';
    const mayCancelCountdown = phase === 'countdown' && state?.round === 1 && !(state?.scores?.[0] || state?.scores?.[1]) && !!me?.ready;
    $('ready-button').disabled = !connected || playerId === null || !(inLobby || mayCancelCountdown) || !!graphicsError;
    if ($('ready-button').dataset.ready !== String(!!me?.ready)) {
      $('ready-button').dataset.ready = String(!!me?.ready);
      $('ready-button').replaceChildren(document.createTextNode(me?.ready ? 'Cancel ready ' : 'Ready up '));
      const readyArrow = document.createElement('span'); readyArrow.textContent = me?.ready ? '✓' : '→'; $('ready-button').append(readyArrow);
    }
    $('ready-button').setAttribute('aria-pressed', String(!!me?.ready));
    $('rematch-button').disabled = !connected || !allConnected() || !!graphicsError;
    for (const button of document.querySelectorAll('[data-choose-team]')) {
      const team = Number(button.dataset.chooseTeam);
      button.disabled = !connected || !inLobby || teamSwitchPending || local?.team === team || roster.filter(person => person?.connected && person.team === team).length >= teamSize;
      button.setAttribute('aria-pressed', String(local?.team === team));
    }
    $('team-choice-note').textContent = inLobby ? 'Choose any team with an open seat.' : 'Teams are fixed for this match.';
    $('ready-note').textContent = inLobby ? `All ${capacity} seats must be connected and ready. Changing loadout or team clears readiness.` : phase === 'matchEnd' ? 'Rematch returns the squad to the lobby. Every player must ready up again.' : phase === 'buy' ? 'Choose your weapon now. Movement unlocks when the round goes live.' : 'The match continues while controls are released. Escape or Help releases all inputs.';
    const attackTeam = state?.attackTeam ?? 0;
    $('team0-role').textContent = attackTeam === 0 ? 'BREACH' : 'HOLD'; $('team1-role').textContent = attackTeam === 1 ? 'BREACH' : 'HOLD';
    $('team0-score').textContent = state?.scores?.[0] ?? 0; $('team1-score').textContent = state?.scores?.[1] ?? 0;
    for (let team = 0; team < 2; team++) {
      const lives = $(`team${team}-lives`);
      const teamPlayers = state?.players?.filter(person => person.team === team) || Array(teamSize).fill({ alive: true });
      lives.setAttribute('aria-label', `${team === 0 ? 'Amber' : 'Teal'}: ${teamPlayers.filter(player => player.alive).length} of ${teamSize} alive`);
      const livesSignature = teamPlayers.map(player => player.alive ? '1' : '0').join('');
      if (lives.dataset.signature === livesSignature) continue;
      lives.dataset.signature = livesSignature; lives.replaceChildren();
      for (const player of teamPlayers) {
        const marker = document.createElement('i'); marker.className = player.alive ? '' : 'dead'; lives.append(marker);
      }
    }
    const clock = matchClock(state);
    $('round-label').textContent = clock.label; $('timer').textContent = clock.text;
    $('timer').classList.toggle('urgent', clock.urgent); $('round-label').classList.toggle('device-live', clock.planted);
    $('map-label').textContent = `${mapName || state?.mapName || 'PRIVATE ROOM'} / ${local ? `TEAM ${local.team === 0 ? 'AMBER' : 'TEAL'}` : 'CONNECTING'}`.toUpperCase();
    $('combat-hud').hidden = inLobby || !local || !local.alive || phase === 'matchEnd';
    $('health').textContent = local?.hp ?? 100; $('health-fill').style.width = `${Math.max(0, Math.min(100, local?.hp ?? 100))}%`;
    $('health').closest('.health-readout').classList.toggle('low-health', !!local && local.hp <= 30);
    $('weapon-label').textContent = (local?.weapon || 'carbine').toUpperCase(); $('ammo').textContent = local?.ammo ?? '—'; $('reserve').textContent = local?.reserve ?? '—';
    const reloading = local?.reloadTicks > 0; const weapon = engine?.WEAPONS?.[local?.weapon];
    const reloadPercent = reloading && weapon ? Math.max(0, Math.min(100, 100 - local.reloadTicks / weapon.reloadTicks * 100)) : 0;
    $('reload-track').hidden = !reloading; $('reload-progress').style.width = `${reloadPercent}%`;
    $('reload-track').setAttribute('aria-valuenow', String(Math.round(reloadPercent)));
    $('reload-track').setAttribute('aria-valuetext', `${((local?.reloadTicks || 0) / 120).toFixed(1)} seconds remaining`);
    $('weapon-status').textContent = reloading ? `RELOADING ${(local.reloadTicks / 120).toFixed(1)}S` : local?.ammo === 0 ? local.reserve > 0 ? 'R TO RELOAD' : 'OUT OF AMMUNITION' : !local?.grounded ? 'AIRBORNE / UNSTEADY' : local?.crouching ? 'CROUCHED / STEADY' : 'STOP. AIM. BURST.';
    $('ammo').classList.toggle('low-ammo', !reloading && !!weapon && local?.ammo <= Math.max(2, Math.floor(weapon.magazine / 4)));
    $('crosshair').hidden = !controlsActive() || phase !== 'fight';
    if (local) {
      const weapon = engine?.WEAPONS?.[local.weapon];
      const motion = weapon ? Math.max(0, Math.min(1, (Math.hypot(local.vx, local.vz) - .22) / weapon.speed)) : 0;
      const spread = weapon ? motion * weapon.movingSpread + (local.grounded ? 0 : weapon.airborneSpread) + Math.min(8, local.heat || 0) * weapon.bloom : 0;
      const size = Math.round(22 + Math.min(64, spread * canvas.clientHeight * 2));
      $('crosshair').style.width = `${size}px`; $('crosshair').style.height = `${size}px`;
    }
    $('pause-button').hidden = paused || inLobby || phase === 'matchEnd' || !entered;
    $('touch-controls').hidden = !touchMode || !entered || !['countdown', 'buy', 'fight'].includes(phase) || !local?.alive;
    $('spectator-hud').hidden = !local || local.alive || !['fight', 'roundEnd'].includes(phase);
    const allies = state?.players?.filter(player => player.team === local?.team && player.alive && player.id !== playerId) || [];
    if (!allies.some(player => player.id === spectatorId)) spectatorId = allies[0]?.id ?? null;
    $('spectator-label').textContent = spectatorId !== null ? `SPECTATING ${lookupName(spectatorId).toUpperCase()}` : 'YOUR TEAM IS ELIMINATED';
    $('next-spectator').hidden = allies.length < 2;
    const bomb = bombState();
    $('objective-hud').hidden = !bomb || phase !== 'fight';
    $('interaction-track').hidden = true;
    if (bomb) {
      let label; let detail;
      if (bomb.status === 'planted') { label = `SITE ${String(bomb.siteId || 'A').toUpperCase()} / DEVICE PLANTED`; detail = `${Math.ceil((bomb.timerTicks || 0) / 120)}S TO DETONATION`; }
      else if (bomb.status === 'dropped') { label = 'DEVICE DROPPED'; detail = local?.team === attackTeam ? 'Recover it and reach A or B' : 'Hold your angle'; }
      else { label = local?.team === attackTeam ? 'BREACH / PLANT AT A OR B' : 'HOLD / PROTECT A AND B'; detail = bomb.carrierId === playerId ? 'YOU CARRY THE DEVICE · HOLD E AT A SITE' : bomb.carrierId != null ? `${lookupName(bomb.carrierId)} carries the device` : 'The device is in play'; }
      const planting = bomb.plantPlayerId === playerId && bomb.plantTicks > 0;
      const defusing = bomb.defusePlayerId === playerId && bomb.defuseTicks > 0;
      if (planting || defusing) {
        label = planting ? 'PLANTING / KEEP HOLDING E' : 'DEFUSING / KEEP HOLDING E';
        const ticks = planting ? bomb.plantTicks : bomb.defuseTicks; const total = planting ? 360 : 600;
        detail = `${((total - ticks) / 120).toFixed(1)} SECONDS REMAINING`;
        const progress = Math.min(100, ticks / total * 100);
        $('interaction-track').hidden = false; $('interaction-progress').style.width = `${progress}%`;
        $('interaction-track').setAttribute('aria-valuenow', String(Math.round(progress)));
        $('interaction-track').setAttribute('aria-label', planting ? 'Planting device' : 'Defusing device');
        $('interaction-track').setAttribute('aria-valuetext', `${((total - ticks) / 120).toFixed(1)} seconds remaining`);
      } else if (phase === 'fight' && local?.alive && local.grounded && bomb.status === 'carried' && bomb.carrierId === playerId) {
        const nearSite = engine.MAPS?.[state.mapId]?.sites?.find(site => Math.hypot(local.x - site.x, local.z - site.z) <= site.radius);
        if (nearSite) detail = `SITE ${nearSite.id} · STOP AND HOLD E TO PLANT`;
      } else if (phase === 'fight' && local?.alive && local.team !== attackTeam && bomb.status === 'planted' && Math.hypot(local.x - bomb.x, local.z - bomb.z) <= 1.6) {
        detail = engine.canInteractWithBomb?.(state, local) ? 'STOP AND HOLD E TO DEFUSE' : 'Find a clear angle to the device';
      }
      $('objective-label').textContent = label; $('objective-detail').textContent = detail;
      $('objective-hud').classList.toggle('interacting', planting || defusing);
      $('objective-hud').classList.toggle('device-live', bomb.status === 'planted');
    }
    const roles = local?.team === attackTeam ? 'Breach' : 'Hold';
    $('objective').textContent = inLobby ? `All ${capacity} players must be connected and ready.` : phase === 'buy' ? `${roles}: choose your weapon. Movement is locked during setup.` : phase === 'fight' ? local?.alive ? `${roles}: ${local.team === attackTeam ? 'plant at A or B, or eliminate Hold.' : 'protect the sites; hold E to defuse.'}` : 'Eliminated. Watch your own team until the next round.' : phase === 'roundEnd' ? state?.objective || 'Round complete. The next round is on its way.' : phase === 'matchEnd' ? 'Match complete. Rematch returns to lobby; everyone must ready up.' : 'Round begins shortly. Enter the arena when ready.';
    let overlay = false; let kicker = ''; let title = ''; let subtitle = ''; let enter = false;
    if (graphicsError) { overlay = true; kicker = 'GRAPHICS UNAVAILABLE'; title = 'The arena could not render.'; subtitle = graphicsError; }
    else if (!connected) { overlay = true; kicker = 'CONNECTING TO THE HOST'; title = permanentError ? 'This room is unavailable.' : 'Waiting for the host.'; subtitle = permanentError ? 'Return to the game shelf and create or join a room.' : 'Your controls are released while the connection recovers.'; }
    else if (inLobby) {
      const readyCount = roster.filter(person => person?.connected && person.ready).length;
      const waiting = capacity - readyCount;
      overlay = true; kicker = `${teamSize}V${teamSize} / ${mapName || 'PRIVATE MATCH'}`; title = me?.ready ? `Ready. Waiting for ${waiting}.` : 'Take your position.';
      subtitle = me?.ready ? `${readyCount} of ${capacity} players ready. Share the invite below; the countdown begins when everyone is ready.` : `Choose your loadout below, invite the other ${capacity - 1} players, then ready up. Every seat must be connected and ready.`;
    }
    else if (phase === 'matchEnd') { overlay = true; kicker = 'MATCH COMPLETE'; title = state.winner === local?.team ? 'Your team takes the match.' : 'A hard-fought match.'; subtitle = `${state.scores?.[0] || 0} — ${state.scores?.[1] || 0}. Rematch returns everyone to the lobby. All players must ready up again.`; }
    else if (local?.alive && ['countdown', 'buy', 'fight'].includes(phase) && (paused || !entered) && !modalOpen) { overlay = true; kicker = phase === 'countdown' || phase === 'buy' ? `${roles.toUpperCase()} / ROUND ${String(state.round).padStart(2, '0')}` : 'CONTROLS RELEASED'; title = !entered ? 'Enter the arena.' : 'Controls released.'; subtitle = phase === 'countdown' || phase === 'buy' ? `${roles}: ${local.team === attackTeam ? 'plant at A or B.' : 'protect A and B, then defuse.'} Choose a weapon; movement unlocks when live.` : 'The multiplayer round keeps running. Return when you are ready.'; enter = true; }
    $('game-overlay').hidden = !overlay; $('overlay-kicker').textContent = kicker; $('overlay-title').textContent = title; $('overlay-subtitle').textContent = subtitle;
    $('enter-arena').hidden = !enter; $('retry-graphics').hidden = !graphicsError;
    $('arena-loadouts').hidden = !enter || !['countdown', 'buy'].includes(phase);
    for (const button of document.querySelectorAll('[data-arena-loadout]')) {
      button.setAttribute('aria-pressed', String(button.dataset.arenaLoadout === local?.weapon));
      button.disabled = !connected || !['countdown', 'buy'].includes(phase);
    }
    $('aim-note').hidden = !enter; $('aim-note').textContent = touchMode ? 'Touch: Move and Look pads, with six action buttons.' : 'Mouse capture where available. Otherwise, hold right mouse and drag to look.';
    const result = roundResult(state, local?.team);
    $('phase-announcement').hidden = !connected || !!graphicsError || modalOpen || overlay || !['countdown', 'buy', 'roundEnd'].includes(phase);
    $('phase-announcement').dataset.phase = phase;
    $('phase-announcement').dataset.outcome = result?.won ? 'won' : 'lost';
    $('phase-kicker').textContent = phase === 'roundEnd' && result ? `${result.team} / ${result.role} · ROUND ${String(state.round).padStart(2, '0')}` : `${roles.toUpperCase()} / ROUND ${String(state?.round || 1).padStart(2, '0')}`;
    $('phase-title').textContent = phase === 'roundEnd' ? result?.title || 'Round complete.' : phase === 'buy' ? 'Choose your weapon.' : 'Take your angle.';
    $('phase-detail').textContent = phase === 'roundEnd' ? `${result?.reason || ''} Next round in ${clock.seconds}s.${state.round === 3 ? ' Teams switch roles.' : ''}` : phase === 'buy' ? `${clock.seconds}s until live · ${(local?.weapon || 'carbine').toUpperCase()} selected` : `${clock.seconds}s until setup · ${roles === 'Breach' ? 'Plant at A or B.' : 'Protect both sites.'}`;
    $('phase-shortcuts').hidden = phase === 'roundEnd' || touchMode;
    updateTacticalMap();
    renderRoster();
  }

  function draw(now = performance.now()) {
    if (!renderer || !state || graphicsError || document.hidden) return;
    const renderedState = interpolatedState(snapshots, now - 12, playerId, { predictMovement: engine.predictLocalMovement }) || state;
    const local = ownPlayer();
    if (teamSwitchPending && local?.team === requestedTeam) { teamSwitchPending = false; requestedTeam = null; }
    const viewPlayer = local?.alive ? predictedPlayer || local : renderedState.players.find(player => player.id === spectatorId && player.team === local?.team && player.alive) || local;
    const viewAim = local?.alive ? aim : { yaw: viewPlayer?.yaw || 0, pitch: viewPlayer?.pitch || 0 };
    renderer.render(renderedState, { playerId, localId: playerId, localPlayer: predictedPlayer, viewPlayer, cameraPlayer: viewPlayer, yaw: viewAim.yaw, pitch: viewAim.pitch + (viewPlayer?.recoil || 0), time: now });
    renderCount++;
    $('hit-marker').hidden = now >= hitUntil;
    $('hit-marker').dataset.kind = hitKind;
    $('damage-cue').hidden = now >= damageUntil;
    $('combat-feedback').hidden = now >= feedbackUntil;
    while (kills.length && now - kills[0].at > 6000) kills.shift();
    const feed = $('kill-feed');
    if (feed.dataset.signature !== kills.map(item => item.text).join('|')) {
      feed.replaceChildren(...kills.map(kill => { const item = document.createElement('li'); item.textContent = kill.text; item.classList.toggle('own-kill', kill.own); item.classList.toggle('headshot', kill.headshot); return item; })); feed.dataset.signature = kills.map(item => item.text).join('|');
    }
  }

  function activeAnimation() { return connected && state && !document.hidden && !graphicsError && ['countdown', 'buy', 'fight', 'roundEnd'].includes(state.phase); }
  function frame(now) {
    frameId = null;
    if (destroyed || !activeAnimation()) { lastFrameAt = 0; return; }
    const delta = lastFrameAt ? Math.min(0.0667, (now - lastFrameAt) / 1000) : 0; lastFrameAt = now;
    integrateTouchLook(now);
    accumulator += delta; let ticks = 0; let buttons = currentInput();
    while (accumulator >= 1 / 120 && ticks++ < 8) {
      accumulator -= 1 / 120;
      const seq = ++sequence;
      if (state.phase === 'fight' && predictedPlayer?.alive) {
        engine.predictLocalMovement(predictedPlayer, buttons, state.mapId, 1);
        pending.push({ seq, buttons: { ...buttons } }); if (pending.length > 240) pending.shift();
      }
    }
    if (ticks && !teamSwitchPending) send({ type: 'input', seq: sequence, buttons });
    if (predictedPlayer) { predictedPlayer.yaw = aim.yaw; predictedPlayer.pitch = aim.pitch; }
    draw(now);
    if (now - lastHUDAt > 80) { updateUI(); lastHUDAt = now; }
    frameId = requestAnimationFrame(frame);
  }
  function wake() {
    if (!frameId && activeAnimation()) { idleDrawSignature = ''; lastFrameAt = 0; frameId = requestAnimationFrame(frame); }
    else if (!activeAnimation()) {
      const bomb = bombState();
      const signature = JSON.stringify([playerId, state?.mapId, state?.phase, spectatorId, state?.players?.map(player => [player.id, player.x, player.y, player.z, player.yaw, player.pitch, player.alive, player.weapon]), state?.scores, bomb && [bomb.status, bomb.carrierId, bomb.x, bomb.y, bomb.z, bomb.siteId]]);
      if (signature !== idleDrawSignature) { idleDrawSignature = signature; draw(); }
    }
  }

  function receiveState(message) {
    const next = message.state;
    if (!next?.players) return;
    const old = state; state = next; capacity = message.capacity || next.capacity || capacity; teamSize = message.teamSize || next.teamSize || teamSize;
    if (previousPhase === 'lobby' && state.phase === 'countdown' && !modalOpen && document.activeElement !== $('loadout-select')) {
      $('game-shell').scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    }
    mapName = message.mapName || next.mapName || mapName;
    roster = (Array.isArray(message.players) ? message.players : Object.values(message.players || {})).map((player, id) => player ? { ...player, id: player.id ?? id } : null);
    const local = ownPlayer();
    if (!old || predictedPlayer?.id !== playerId || previousRound !== state.round || previousPhase === 'lobby' && state.phase !== 'lobby' || local?.alive && old?.players.find(player => player.id === playerId)?.alive === false) {
      neutralize();
      const spawn = local && engine.MAPS?.[state.mapId]?.spawns?.[local.team === state.attackTeam ? 0 : 1]?.[local.id % teamSize];
      const useSpawn = state.phase !== 'lobby' && (previousRound !== state.round || previousPhase === 'lobby');
      aim = cleanAim(useSpawn ? spawn?.yaw ?? local?.yaw : local?.yaw, useSpawn ? spawn?.pitch ?? 0 : local?.pitch);
      pending = []; snapshots = []; spectatorId = null; accumulator = 0;
      if (local) sendInput(neutralInput(aim.yaw, aim.pitch));
      renderer?.resetEffects();
    }
    if (previousPhase !== state.phase && previousPhase !== null) neutralize();
    if (state.phase === 'lobby' && previousPhase !== 'lobby') {
      neutralize({ pause: true, unlock: true }); entered = false; fallback = false;
      eventSeen.clear(); eventOrder.length = 0; kills.length = 0; hitUntil = damageUntil = feedbackUntil = 0; lastCountdown = null; audio.resetEvents();
    }
    if (local && !local.alive && old?.players.find(player => player.id === playerId)?.alive !== false) neutralize({ pause: true, unlock: true });
    const ackValue = message.acks?.[playerId];
    const ack = typeof ackValue === 'number' ? ackValue : ackValue?.seq ?? -1;
    if (local) {
      const reconciled = reconcilePlayer(local, pending, ack, state.mapId, engine.predictLocalMovement, state.phase === 'fight');
      predictedPlayer = reconciled.predicted; pending = reconciled.pending;
      predictedPlayer.yaw = aim.yaw; predictedPlayer.pitch = aim.pitch;
    }
    const now = performance.now(); snapshots.push({ time: now, state }); if (snapshots.length > 12) snapshots.shift();
    playEvents(state.events || message.events || []);
    if (state.phase === 'countdown') { const number = Math.ceil((state.phaseTicks || 0) / 120); if (number !== lastCountdown) { audio.countdown(number); lastCountdown = number; } }
    if (state.phase === 'fight' && previousPhase !== 'fight') audio.fight();
    previousPhase = state.phase; previousRound = state.round;
    updateUI(); wake();
  }

  function connect() {
    clearTimeout(reconnectTimer);
    if (destroyed || permanentError) return;
    if (!/^[A-Z0-9]{6}$/.test(roomId)) { permanentError = true; error('This invite has no valid room code. Return to Semag and choose Voxel Breach.'); updateUI(); return; }
    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws?room=${encodeURIComponent(roomId)}`); socket = ws;
    ws.addEventListener('open', () => { if (socket !== ws) return; connected = true; attempts = 0; sequence = 0; pending = []; snapshots = []; error(''); send({ type: 'join', name: playerName }); updateUI(); });
    ws.addEventListener('message', ({ data }) => {
      if (socket !== ws || destroyed) return;
      let message; try { message = JSON.parse(data); } catch { return; }
      if (message.type === 'welcome') {
        if (message.gameId !== 'voxel-breach') { permanentError = true; location.replace(roomUrl({ id: roomId, gameId: message.gameId })); return; }
        teamSwitchPending = true; neutralize({ pause: true, unlock: true }); playerId = message.playerId; capacity = message.capacity || capacity; teamSize = message.teamSize || teamSize;
        mapName = message.mapName || mapName; sequence = 0; pending = []; entered = false; fallback = false;
        aim = cleanAim(ownPlayer()?.yaw, ownPlayer()?.pitch); teamSwitchPending = false; requestedTeam = null; updateUI();
      } else if (message.type === 'state') receiveState(message);
      else if (message.type === 'pong') $('ping').textContent = `${Math.max(0, Math.round(performance.now() - message.time))} ms`;
      else if (message.type === 'error') {
        teamSwitchPending = false; requestedTeam = null;
        error(message.message || 'The host could not accept that action.');
        if (/room.*(?:full|not found|expired|already has .*players)|unknown room|all.*occupied/i.test(message.message || '')) permanentError = true;
      }
    });
    ws.addEventListener('close', event => {
      if (socket !== ws || destroyed) return;
      connected = false; neutralize({ pause: true, unlock: true }); playerId = null; pending = []; snapshots = []; $('ping').textContent = '— ms';
      if (event.code === 4403 || event.code === 4404) permanentError = true;
      if (frameId) cancelAnimationFrame(frameId); frameId = null; lastFrameAt = 0;
      updateUI();
      if (!permanentError) { error('The host connection was lost. Reconnecting automatically; ready up again once everyone returns.'); reconnectTimer = setTimeout(connect, Math.min(5000, 750 * 2 ** attempts++)); }
    });
    ws.addEventListener('error', () => {});
  }

  async function enterArena(event) {
    if (!connected || !ownPlayer()?.alive || graphicsError || !['countdown', 'buy', 'fight'].includes(state?.phase)) return;
    neutralize(); entered = true; paused = false;
    touchMode ||= event?.pointerType === 'touch' || matchMedia('(pointer: coarse)').matches;
    canvas.focus({ preventScroll: true });
    if (touchMode) { fallback = false; updateUI(); wake(); return; }
    fallback = false;
    if (!canvas.requestPointerLock) { fallback = true; updateUI(); wake(); return; }
    try {
      const request = canvas.requestPointerLock();
      if (request?.then) await request;
      // Older browsers signal success/failure through document events only.
      if (!pointerLocked()) { fallback = true; toast('Mouse capture unavailable. Hold right mouse and drag to look.'); }
    } catch { fallback = true; toast('Mouse capture unavailable. Hold right mouse and drag to look.'); }
    updateUI(); wake();
  }

  function openGuide() {
    modalOpen = true; neutralize({ pause: true, unlock: true }); $('guide-dialog').hidden = false; $('guide-button').setAttribute('aria-expanded', 'true'); $('close-guide').focus();
  }
  function closeGuide() { $('guide-dialog').hidden = true; modalOpen = false; $('guide-button').setAttribute('aria-expanded', 'false'); updateUI(); $('guide-button').focus(); }
  function updateLayout() { neutralize({ pause: entered, unlock: true }); $('move-keys').textContent = getKeyboardLayout().toUpperCase(); }
  const unsubscribeLayout = subscribeKeyboardLayout(updateLayout); $('move-keys').textContent = getKeyboardLayout().toUpperCase();
  listen(window, 'keydown', event => {
    if (event.key === 'Escape') { if (modalOpen) closeGuide(); else if (entered && state?.phase !== 'lobby') neutralize({ pause: true, unlock: true }); return; }
    const loadout = entered && !modalOpen && !document.hidden ? loadoutForKey(event, state?.phase) : null;
    if (loadout) { event.preventDefault(); selectArenaLoadout(loadout); return; }
    if (!controlsActive() || isFormTarget(event.target)) return;
    const action = controlForKey(event); if (!action) return;
    event.preventDefault(); const keyId = event.code || event.key;
    if (pressedKeys.has(keyId)) return;
    pressedKeys.set(keyId, action); keys.add(action); sendInput();
  });
  listen(window, 'keyup', event => {
    const keyId = event.code || event.key; const action = pressedKeys.get(keyId); pressedKeys.delete(keyId);
    if (action && ![...pressedKeys.values()].includes(action)) keys.delete(action);
    if (action) sendInput();
    if (action && !isFormTarget(event.target)) event.preventDefault();
  });
  listen(document, 'focusin', event => { if (isFormTarget(event.target) && !actionPointers.size && !padPointers.size) neutralize(); });
  listen(window, 'blur', () => neutralize({ pause: entered, unlock: true }));
  listen(document, 'visibilitychange', () => {
    if (document.hidden) { neutralize({ pause: entered, unlock: true }); if (frameId) cancelAnimationFrame(frameId); frameId = null; lastFrameAt = 0; }
    else { renderer?.resize(); updateUI(); wake(); }
  });
  listen(document, 'pointerlockchange', () => {
    if (pointerLocked()) { fallback = false; paused = false; entered = true; updateUI(); wake(); }
    else if (entered && !fallback && !touchMode && ownPlayer()?.alive) neutralize({ pause: true });
  });
  listen(document, 'pointerlockerror', () => { if (entered && !modalOpen) { fallback = true; paused = false; updateUI(); toast('Hold right mouse and drag to look. Left click fires.'); } });
  listen(canvas, 'mousedown', event => {
    if (!controlsActive()) return;
    event.preventDefault(); canvas.focus({ preventScroll: true });
    if (event.button === 0) mouse.fire = true;
    if (event.button === 2 && fallback) rightDrag = true;
    sendInput();
  });
  listen(window, 'mouseup', event => { if (event.button === 0) mouse.fire = false; if (event.button === 2) rightDrag = false; if (entered && [0, 2].includes(event.button)) sendInput(); });
  listen(document, 'mousemove', event => {
    if (!controlsActive() || !(pointerLocked() || fallback && rightDrag)) return;
    aim = cleanAim(aim.yaw + event.movementX * LOOK_SENSITIVITY, aim.pitch - event.movementY * LOOK_SENSITIVITY);
    const now = performance.now(); if (now - lastAimSendAt >= 1000 / 120) { sendInput(); lastAimSendAt = now; }
  });
  listen(canvas, 'contextmenu', event => event.preventDefault());
  listen(canvas, 'click', event => { if (!entered || paused) enterArena(event); });
  listen($('enter-arena'), 'click', enterArena);
  listen($('pause-button'), 'click', () => neutralize({ pause: true, unlock: true }));
  listen($('guide-button'), 'click', openGuide); listen($('close-guide'), 'click', closeGuide); listen($('close-guide-bottom'), 'click', closeGuide);
  listen($('guide-dialog'), 'click', event => { if (event.target === $('guide-dialog')) closeGuide(); });
  listen($('guide-dialog'), 'keydown', event => {
    if (event.key !== 'Tab') return;
    const first = $('close-guide'); const last = $('close-guide-bottom');
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  listen($('ready-button'), 'click', () => { playerName = saveName($('player-name').value); $('player-name').value = playerName; send({ type: 'join', name: playerName }); send({ type: 'ready', ready: !roster.find(player => player?.id === playerId)?.ready }); });
  listen($('rematch-button'), 'click', () => send({ type: 'rematch' }));
  listen($('player-name'), 'change', () => { playerName = saveName($('player-name').value); $('player-name').value = playerName; send({ type: 'join', name: playerName }); });
  listen($('loadout-select'), 'change', () => { neutralize(); send({ type: 'fps-loadout', weaponId: $('loadout-select').value }); });
  for (const button of document.querySelectorAll('[data-arena-loadout]')) listen(button, 'click', () => selectArenaLoadout(button.dataset.arenaLoadout));
  for (const button of document.querySelectorAll('[data-choose-team]')) listen(button, 'click', () => { neutralize({ pause: true, unlock: true }); teamSwitchPending = true; requestedTeam = Number(button.dataset.chooseTeam); send({ type: 'fps-team', team: requestedTeam }); updateUI(); });
  listen($('next-spectator'), 'click', () => {
    const local = ownPlayer(); const allies = state?.players.filter(player => player.team === local?.team && player.alive && player.id !== playerId) || [];
    spectatorId = allies[(allies.findIndex(player => player.id === spectatorId) + 1) % Math.max(1, allies.length)]?.id ?? null; updateUI(); draw();
  });
  listen($('sound-button'), 'click', async () => {
    const enabled = await audio.setEnabled(!audio.enabled); $('sound-button').setAttribute('aria-pressed', String(enabled)); $('sound-button').setAttribute('aria-label', enabled ? 'Mute sound' : 'Enable sound'); $('sound-button').title = enabled ? 'Mute sound' : 'Enable sound'; toast(enabled ? 'Sound on.' : 'Sound off.');
  });
  listen($('fullscreen-button'), 'click', async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await $('game-shell').requestFullscreen(); } catch { toast('Fullscreen is unavailable in this browser.'); } });
  listen(document, 'fullscreenchange', () => { renderer?.resize(); draw(); $('fullscreen-button').setAttribute('aria-label', document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen'); });
  listen($('retry-graphics'), 'click', () => location.reload());
  listen(canvas, 'voxel-renderer-error', event => { graphicsError = event.detail?.message || 'WebGL was interrupted. Reload graphics to try again.'; neutralize({ pause: true, unlock: true }); error(graphicsError); });
  listen(canvas, 'voxel-renderer-restored', () => {
    graphicsError = ''; error(''); renderer?.resize(); idleDrawSignature = ''; updateUI(); draw(); wake();
  });
  listen(window, 'resize', () => { renderer?.resize(); draw(); });

  for (const pad of document.querySelectorAll('[data-voxel-pad]')) {
    function movePad(event) {
      const record = padPointers.get(event.pointerId); if (!record || record.element !== pad) return;
      const before = currentInput();
      const rect = pad.getBoundingClientRect(); const radius = Math.max(20, Math.min(rect.width, rect.height) * .37);
      let x = (event.clientX - record.startX) / radius; let y = (event.clientY - record.startY) / radius;
      const length = Math.hypot(x, y); if (length > 1) { x /= length; y /= length; }
      if (pad.dataset.voxelPad === 'look') integrateTouchLook();
      touch[pad.dataset.voxelPad === 'look' ? 'look' : 'move'] = { x, y };
      pad.querySelector('i').style.transform = `translate(${x * radius * .55}px, ${y * radius * .55}px)`;
      const after = currentInput();
      const digitalEdge = FPS_BUTTONS.some(action => before[action] !== after[action]);
      if (padInputPacer.shouldSend(performance.now(), digitalEdge)) sendInput(after);
    }
    listen(pad, 'pointerdown', event => {
      if (!entered || paused || !ownPlayer()?.alive || modalOpen || !connected) return;
      event.preventDefault(); touchMode = true; fallback = false;
      for (const [id, record] of padPointers) if (record.element === pad) return;
      padPointers.set(event.pointerId, { element: pad, startX: event.clientX, startY: event.clientY }); pad.setPointerCapture(event.pointerId); pad.classList.add('active'); movePad(event); updateUI();
    });
    listen(pad, 'pointermove', event => { if (padPointers.has(event.pointerId)) { event.preventDefault(); movePad(event); } });
    const end = event => { const record = padPointers.get(event.pointerId); if (!record || record.element !== pad) return; if (pad.dataset.voxelPad === 'look') integrateTouchLook(); padPointers.delete(event.pointerId); touch[pad.dataset.voxelPad === 'look' ? 'look' : 'move'] = { x: 0, y: 0 }; pad.classList.remove('active'); pad.querySelector('i').style.transform = ''; sendInput(); };
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(pad, event, end);
  }
  for (const button of document.querySelectorAll('[data-voxel-action]')) {
    listen(button, 'pointerdown', event => { if (!controlsActive()) return; event.preventDefault(); actionPointers.set(event.pointerId, button); touch.actions.add(button.dataset.voxelAction); button.classList.add('pressed'); button.setPointerCapture(event.pointerId); sendInput(); });
    const end = event => {
      if (actionPointers.get(event.pointerId) !== button) return; actionPointers.delete(event.pointerId);
      if (![...actionPointers.values()].includes(button)) { touch.actions.delete(button.dataset.voxelAction); button.classList.remove('pressed'); }
      sendInput();
    };
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(button, event, end);
    listen(button, 'contextmenu', event => event.preventDefault());
  }

  let invite = `${location.origin}/voxel.html?room=${encodeURIComponent(roomId)}`; $('invite-address').textContent = invite;
  hostInfo().then(info => { invite = `${info.origin}/voxel.html?room=${encodeURIComponent(roomId)}`; $('invite-address').textContent = invite; }).catch(() => {});
  listen($('copy-code'), 'click', async () => { try { await copyText(roomId); toast('Room code copied.'); } catch (cause) { toast(cause.message); } });
  listen($('copy-invite'), 'click', async () => { try { await copyText(invite); toast('Invite link copied.'); } catch (cause) { toast(cause.message); } });
  const pingTimer = setInterval(() => { if (connected && !document.hidden) send({ type: 'ping', time: performance.now() }); }, 1500);
  function destroy() {
    if (destroyed) return; neutralize({ pause: true, unlock: true }); destroyed = true;
    clearTimeout(reconnectTimer); clearTimeout(toastTimer); clearInterval(pingTimer);
    clearInterval(inputHeartbeat); inputHeartbeat = null;
    if (frameId) cancelAnimationFrame(frameId); frameId = null; socket?.close(); renderer?.destroy(); audio.destroy(); layoutPicker.destroy(); unsubscribeLayout();
    for (const remove of removers) remove(); pending = []; snapshots = []; kills.length = 0; eventSeen.clear();
  }
  listen(window, 'pagehide', destroy);
  const inspect = () => clone({ state, players: roster, playerId, input: currentInput(), predictedPlayer, connected, controls: { pointerLocked: pointerLocked(), fallback, touch: touchMode, paused, entered, modalOpen }, queueLength: pending.length, renderCount, graphicsError, spectatorId });
  window.SemagVoxel = Object.freeze({ getState: inspect });
  updateUI();
  try {
    const [engineModule, rendererModule] = await Promise.all([import('./voxel-engine.js'), import('./voxel-renderer.js')]);
    if (destroyed) return;
    engine = engineModule; renderer = new rendererModule.VoxelRenderer(canvas); renderer.resize();
  } catch (cause) { graphicsError = cause?.message || 'This game requires WebGL. Enable hardware acceleration and reload graphics.'; error(graphicsError); updateUI(); return; }
  connect();
}

if (typeof document !== 'undefined' && document.getElementById('arena') && document.querySelector('.voxel-app')) boot().catch(cause => {
  const banner = document.getElementById('error-banner'); banner.hidden = false; banner.textContent = `The game could not start: ${cause.message}. Reload the page to try again.`;
});
