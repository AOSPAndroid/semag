import * as engine from './shinobi-voxel-engine.js';
import { ShinobiVoxelRenderer } from './shinobi-voxel-renderer.js';
import { SHINOBI_CAMERA } from './shinobi-voxel-camera.js';
import { createShinobiVoxelInputQueue } from './shinobi-voxel-input.js';
import { createMovementPresenter, createCorrectionPresenter, interpolatedVoxelState, reconcileMovement, resolvePresentationContacts } from './voxel-presentation.js';
import { sweepPresentationOffset } from './voxel-engine.js';
import { createNetworkTimeline } from './network-timeline.js';
import { createEndPresentation } from './voxel-end-presentation.js';
import { mountVoxelVictory } from './voxel-victory.js';
import { createResultActionGate } from './practice-result-actions.js';
import { GameAudio } from './audio.js';
import { createEnemyFootstepPresenter } from './voxel-footsteps.js';
import { createHitFeedback, paintHitFeedback } from './voxel-hit-feedback.js';
import { mountVoxelLabelOverlay } from './voxel-label-overlay.js';
import { gameKey, displayKey, getKeyboardLayout, mountKeyboardLayoutPicker, subscribeKeyboardLayout } from './keyboard-layout.js';
import { isPauseShortcut } from './pause-shortcut.js';
import { getName, copyText } from './hub/shared.js';
import { setAttribute, setDisabled, setHidden, setStyle, setText } from './hub/dom.js';

export const SHINOBI_LOOK_SENSITIVITY = .0025;
const STEP = 1 / 120, clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const clone = value => value == null ? value : structuredClone(value);
const count = value => Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
export function cleanShinobiOrbit(yaw = 0, pitch = SHINOBI_CAMERA.defaultPitch) {
  const angle = Number.isFinite(yaw) ? yaw : 0;
  return { yaw: ((angle + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI, pitch: clamp(Number.isFinite(pitch) ? pitch : SHINOBI_CAMERA.defaultPitch, SHINOBI_CAMERA.minPitch, SHINOBI_CAMERA.maxPitch) };
}
export function shinobiControlForKey(event, layout = getKeyboardLayout()) {
  if (!event || event.defaultPrevented || event.isComposing || event.altKey || event.metaKey) return null;
  return ({ w: 'up', arrowup: 'up', s: 'down', arrowdown: 'down', a: 'left', arrowleft: 'left', d: 'right', arrowright: 'right', ' ': 'jump', shift: 'sprint', control: 'crouch', c: 'walk', j: 'fire', b: 'fire', k: 'aim', e: 'dash', q: 'kunai', f: 'feint' })[gameKey(event, layout).toLowerCase()] || null;
}
export function isShinobiFormTarget(target) {
  return !!(target?.isContentEditable || target?.closest?.('input, select, textarea, button, a, [contenteditable]:not([contenteditable="false"])'));
}
export function composeShinobiInput(keys, touch, mouse, aim, active = true) {
  const input = engine.emptyInput(aim || {});
  input.moveYaw = Number.isFinite(aim?.moveYaw) ? cleanShinobiOrbit(aim.moveYaw).yaw : input.yaw;
  if (!active) return input;
  for (const action of engine.INPUT_KEYS) input[action] = keys.has(action) || touch.actions.has(action);
  input.up ||= touch.move.y < -.22; input.down ||= touch.move.y > .22; input.left ||= touch.move.x < -.22; input.right ||= touch.move.x > .22;
  input.fire ||= mouse.fire === true; input.aim ||= mouse.aim === true;
  return input;
}
/** Winner identity, combat counters and elapsed ticks come from the accepted match. */
export function shinobiMatchSummary(state, localId = 0) {
  const local = state?.players?.find(player => player.id === localId), winner = state?.winner === 0 || state?.winner === 1 ? state.winner : null;
  const localTeam = local?.team === 1 ? 1 : 0;
  return { won: !!local && winner !== null && winner === local.team, winner, localTeam,
    scores: [count(state?.scores?.[localTeam]), count(state?.scores?.[1 - localTeam])], kills: count(local?.kills), deaths: count(local?.deaths),
    damage: count(local?.damageDealt), taken: count(local?.damageTaken), parries: count(local?.parries), dashes: count(local?.dashes), kunai: count(local?.kunaithrown ?? local?.kunaiThrown),
    ticks: count(state?.fightTicks), map: state?.mapName || '', bots: count(state?.bots), difficulty: state?.difficulty || 'hard' };
}
/** Compact network snapshots use exactly the same immutable authored map as solo. */
export function hydrateShinobiSnapshot(raw) {
  if (!raw || raw.gameId !== 'shinobi-voxel' || !Object.hasOwn(engine.MAPS, raw.mapId) || !Array.isArray(raw.players)) return null;
  return { ...raw, map: engine.MAPS[raw.mapId], fighters: raw.players };
}
export function mayResumeShinobi({ online = false, phase = 'lobby', resumePhase, connected = true, alive = true } = {}) {
  if (!connected) return false;
  if (online) return ['countdown', 'fight', 'roundEnd'].includes(phase) && (alive || phase === 'roundEnd');
  return phase === 'paused' && ['countdown', 'fight', 'roundEnd'].includes(resumePhase);
}
/** Gameplay renders at display refresh; a released online menu needs only a quiet backdrop. */
export function shouldRenderShinobiFrame({ online = false, controlsPaused = false, ending = false, now = 0, lastRenderAt = -Infinity } = {}) {
  return !online || !controlsPaused || ending || now - lastRenderAt >= 1000 / 15;
}
export function shinobiAbilityReadout(player) {
  const cooldown = ticks => ticks > 0 ? `${(ticks / 120).toFixed(1)}s` : 'READY';
  return { dash: cooldown(count(player?.dashCooldown)), dashReady: !count(player?.dashCooldown) && (player?.stamina || 0) >= (engine.ABILITIES?.dash?.staminaCost ?? 18),
    kunai: String(count(player?.kunai)), kunaiReady: count(player?.kunai) > 0 && !count(player?.kunaiCooldown), feint: cooldown(count(player?.feintCooldown)), feintReady: !count(player?.feintCooldown),
    combo: clamp(count(player?.meleeComboStep), 0, 3), status: player?.hitStunTicks > 0 ? 'STAGGERED · RECOVER' : player?.parryTicks > 0 ? 'PARRY WINDOW' : player?.meleeTicks > 0 ? 'COMMITTED CUT' : player?.meleeComboConfirmed && player?.meleeComboWindowTicks > 0 ? 'HIT CONFIRMED · CHAIN' : player?.meleeCooldown > 0 ? 'RECOVERY' : 'CUT · CONFIRM · CHAIN' };
}
export function mountShinobiVoxel(document = globalThis.document, window = document?.defaultView) {
  const $ = id => document.getElementById(id), canvas = $('sv-canvas');
  if (!canvas || !window) return null;
  const params = new URLSearchParams(window.location.search), roomId = (params.get('room') || '').trim().toUpperCase(), online = !!roomId;
  const audio = new GameAudio(), footsteps = createEnemyFootstepPresenter(audio), hitFeedback = createHitFeedback();
  const endPresentation = createEndPresentation(), resultGate = createResultActionGate(), actionQueue = createShinobiVoxelInputQueue();
  const victory = mountVoxelVictory({ container: $('sv-viewport'), resultCard: $('sv-result-card'), kind: 'shinobi', audio });
  const worldLabels = mountVoxelLabelOverlay(canvas);
  const timeline = createNetworkTimeline({ snapshotTicks: 4 }), correction = createCorrectionPresenter(), movement = new Map();
  const hitElements = { crosshair: $('sv-crosshair'), marker: $('sv-hit') }, reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const touchMode = window.matchMedia('(pointer: coarse)').matches;
  const touch = { actions: new Set(), move: { x: 0, y: 0 }, look: { x: 0, y: 0 } }, mouse = { fire: false, aim: false };
  const keys = new Set(), keyActions = new Map(), physicalKeys = new Set(), blockedKeys = new Set(), physicalMouse = new Set(), blockedMouse = new Set(), physicalTouch = new Set();
  const actionPointers = new Map(), padPointers = new Map(), listeners = [];
  let state, renderer, destroyed = false, graphicsError = '', controlsPaused = online, entered = false, guideOpen = false;
  let orbit = cleanShinobiOrbit(), combatAim = { yaw: 0, pitch: 0 }, playerId = online ? null : 0, roster = [], socket = null, connected = !online, permanentError = false;
  let frameId = null, lastFrame = null, accumulator = 0, renderCount = 0, physicsSamples = 0, session = 0, previousRound = null, lastRenderAt = -Infinity;
  const renderSources = { animation: 0, packet: 0, event: 0 };
  const connection = { opens: 0, welcomes: 0, closes: 0, statePackets: 0, inputPackets: 0, lastStateAt: null, lastInputAt: null, lastClose: null, lastError: null };
  let snapshots = [], predictedPlayer = null, pending = [], predictionTick = 0, sequence = 0, lastWireAt = -Infinity, heartbeat = null, reconnectTimer = null, attempts = 0;
  let drag = false, lastPointer = null, feedbackUntil = 0, parryUntil = 0, damageUntil = 0, resultTimer = null, resultVisible = false, resultActionsReady = false, resultSignature = '';
  let deathView = { holding: false }, rewardView = { holding: false }, eventContext = '', eventSeen = new Set(), eventOrder = [], lastHud = -Infinity, lastDrawAt = 0, finishTime = 0;
  let displayedState = null, displayedPlayer = null;
  const listen = (target, type, handler, options) => { target.addEventListener(type, handler, options); listeners.push(() => target.removeEventListener(type, handler, options)); };
  const own = () => state?.players?.find(player => player.id === playerId);
  const identity = () => `${state?.mapId}:${state?.matchId ?? session}:${state?.round}`;
  const pointerLocked = () => document.pointerLockElement === canvas;
  const localLive = () => !destroyed && !guideOpen && !controlsPaused && !graphicsError && !document.hidden && connected && entered && !!own()?.alive && ['countdown', 'fight', 'roundEnd'].includes(state?.phase);
  const currentInput = () => composeShinobiInput(keys, touch, mouse, { ...combatAim, moveYaw: orbit.yaw }, localLive() && state?.phase === 'fight');
  function showError(text, graphics = false) { setText($('sv-error-text'), text); setHidden($('sv-error'), !text); setHidden($('sv-retry'), !graphics); }
  function send(message) { if (socket?.readyState !== 1) return; socket.send(JSON.stringify(message)); if (message.type === 'input') { connection.inputPackets++; connection.lastInputAt = performance.now(); } }
  function sendInput({ edge = false, neutral = false } = {}) {
    if (!online || !connected || playerId === null || !state) return;
    const now = performance.now(); if (!edge && now - lastWireAt < 1000 / 60) return;
    lastWireAt = now; const buttons = neutral ? composeShinobiInput(keys, touch, mouse, { ...combatAim, moveYaw: orbit.yaw }, false) : currentInput();
    send({ type: 'input', seq: ++sequence, buttons, ...(neutral ? { cancelActions: true } : {}) });
  }
  function observeInput(edge = true) { const now = performance.now(); actionQueue.observe(currentInput(), now); sendInput({ edge }); wake(); }
  function neutralize({ unlock = true } = {}) {
    for (const code of physicalKeys) blockedKeys.add(code); for (const button of physicalMouse) blockedMouse.add(button);
    keys.clear(); keyActions.clear(); mouse.fire = mouse.aim = false; drag = false; lastPointer = null;
    touch.actions.clear(); touch.move = { x: 0, y: 0 }; touch.look = { x: 0, y: 0 };
    for (const [id, record] of [...actionPointers, ...padPointers]) try { record.element.releasePointerCapture(id); } catch { /* Already released. */ }
    actionPointers.clear(); padPointers.clear();
    for (const button of document.querySelectorAll('[data-sv-action]')) button.classList.remove('pressed');
    for (const pad of document.querySelectorAll('[data-sv-pad] i')) pad.style.transform = '';
    actionQueue.reset({ neutral: true }); accumulator = 0; lastFrame = null; pending = []; predictionTick = state?.tick || 0; predictedPlayer = clone(own()); correction.reset(); movement.clear();
    hitFeedback.reset(); footsteps.suspend(); worldLabels.clear(); sendInput({ edge: true, neutral: true });
    if (unlock && pointerLocked()) document.exitPointerLock?.();
  }
  function resetPresentation() {
    session++; endPresentation.reset(); victory.reset(); resultGate.cancel(); clearTimeout(resultTimer); resultTimer = null; resultVisible = resultActionsReady = false; resultSignature = '';
    snapshots = []; timeline.reset(); eventSeen.clear(); eventOrder = []; eventContext = ''; damageUntil = parryUntil = feedbackUntil = 0; finishTime = 0;
    deathView = rewardView = { holding: false }; displayedState = displayedPlayer = null; worldLabels.clear(); renderer?.resetEffects(); hitFeedback.reset({ clearHistory: true }); footsteps.reset();
  }
  function selectedConfig() { return { mapId: $('sv-map').value, bots: Number($('sv-bots').value), difficulty: $('sv-difficulty').value, online: false }; }
  function preview() {
    controlsPaused = false; entered = false; neutralize(); resetPresentation(); state = engine.createState(selectedConfig()); playerId = 0; orbit = cleanShinobiOrbit(own()?.yaw); combatAim = { yaw: orbit.yaw, pitch: 0 }; updateHud(performance.now(), true); draw(performance.now());
  }
  function start() {
    if (destroyed || graphicsError || !renderer?.available || online || guideOpen) return;
    neutralize(); resetPresentation(); state = engine.createState(selectedConfig()); engine.startMatch(state); entered = true; controlsPaused = false;
    orbit = cleanShinobiOrbit(own()?.yaw); combatAim = { yaw: orbit.yaw, pitch: 0 }; previousRound = state.round;
    canvas.focus({ preventScroll: true }); requestCapture(); updateHud(performance.now(), true); draw(performance.now()); wake();
  }
  function pause() {
    if (!entered || !['countdown', 'fight', 'roundEnd'].includes(state?.phase)) return;
    controlsPaused = true; if (!online) engine.pauseMatch(state); neutralize(); updateHud(performance.now(), true); draw(lastDrawAt || performance.now()); $('sv-resume').focus({ preventScroll: true });
  }
  function resume() {
    if (graphicsError || guideOpen || !renderer?.available || !mayResumeShinobi({ online, connected, phase: state?.phase, resumePhase: state?.resumePhase, alive: !!own()?.alive })) return;
    neutralize(); if (!online) engine.resumeMatch(state); controlsPaused = false; entered = true; canvas.focus({ preventScroll: true }); requestCapture(); updateHud(performance.now(), true); wake();
  }
  function requestCapture() {
    if (touchMode || !localLive()) return;
    try { const result = canvas.requestPointerLock?.(); result?.catch?.(() => { feedback('HOLD A MOUSE BUTTON + DRAG TO LOOK', performance.now(), 1800); }); } catch { feedback('HOLD A MOUSE BUTTON + DRAG TO LOOK', performance.now(), 1800); }
  }
  function feedback(text, now = performance.now(), duration = 850) { setText($('sv-feedback'), text); feedbackUntil = now + duration; }
  function updateAim(now = performance.now()) {
    if (!renderer?.available || !state || !own()) return;
    const view = displayedState?.mapId === state.mapId && displayedState?.round === state.round ? displayedState : state;
    const cameraPlayer = view === displayedState ? displayedPlayer || own() : predictedPlayer || own();
    const camera = renderer.updateCamera(view, { localId: playerId, cameraPlayer, players: view.players, ...orbit, time: now, paused: state.phase === 'paused', reducedMotion: reduced.matches });
    if (camera?.aim) combatAim = { yaw: camera.aim.yaw, pitch: camera.aim.pitch };
  }
  function look(dx, dy) { if (!localLive()) return; orbit = cleanShinobiOrbit(orbit.yaw + dx * SHINOBI_LOOK_SENSITIVITY, orbit.pitch - dy * SHINOBI_LOOK_SENSITIVITY); updateAim(); observeInput(false); }
  function consumeEvents(now) {
    const nextContext = identity(); if (eventContext !== nextContext) { eventContext = nextContext; eventSeen.clear(); eventOrder = []; }
    const fresh = [];
    for (const event of state?.events || []) {
      const id = event.id ?? `${event.tick}:${event.type}:${event.playerId}:${event.targetId}`; if (eventSeen.has(id)) continue;
      eventSeen.add(id); eventOrder.push(id); if (eventOrder.length > 256) eventSeen.delete(eventOrder.shift());
      if (Number.isFinite(event.tick) && state.tick - event.tick > 24) continue;
      fresh.push(event); const source = event.playerId ?? event.attackerId ?? event.shooterId, incoming = event.targetId === playerId;
      if (event.type === 'meleeStart') audio.meleeSwing(event.weapon || 'katana', { gain: source === playerId ? .7 : .23 });
      if (event.type === 'meleeParry' || event.type === 'kunaiParry') { if (source === playerId) { parryUntil = now + 280; feedback('PARRY CONFIRMED · TAKE THE OPENING', now, 1100); } audio.meleeParry('katana', { gain: source === playerId ? .65 : .23 }); }
      if (event.type === 'damage' && event.damage > 0) { if (incoming) { damageUntil = now + 210; audio.tone(135, .045, { end: 70, gain: .14 }); } else if (source === playerId) audio.meleeImpact('katana', { gain: .45 }); }
      if (event.type === 'kill' && source === playerId) feedback('SHINOBI DOWN', now, 1100);
      if (event.type === 'feint' && source === playerId) feedback('FEINT · RESET YOUR ANGLE', now, 600);
    }
    hitFeedback.consume(fresh, own(), state.players, { now, lifeKey: identity(), active: entered && !guideOpen && !controlsPaused });
  }
  function observeEnding(now) {
    now = Math.max(finishTime, now, performance.now()); finishTime = now;
    const eligible = connected && entered && !destroyed && !graphicsError && !document.hidden;
    const context = `${state?.mapId}:${state?.matchId ?? session}`, report = shinobiMatchSummary(state, playerId);
    deathView = endPresentation.observe(state?.phase, now, { contextKey: context, eligible, reducedMotion: reduced.matches });
    rewardView = victory.observe({ phase: state?.phase, now, contextKey: context, death: deathView, won: report.won, eligible, reducedMotion: reduced.matches, kicker: 'SHOWDOWN VICTORY', title: 'Your blade. Your arena.', copy: `${report.map} · ${report.scores[0]} : ${report.scores[1]} rounds` });
    return deathView.holding || rewardView.holding;
  }
  function paintResultActions() {
    clearTimeout(resultTimer); resultTimer = null;
    resultActionsReady = resultVisible && resultGate.isReady(performance.now()); setDisabled($('sv-replay'), !resultActionsReady || online && !connected); setDisabled($('sv-result-setup'), !resultActionsReady);
    setText($('sv-result-note'), resultActionsReady ? 'Review the fight. Choose your next opening when you’re ready.' : resultGate.waitingForRelease() ? 'Release held controls before choosing your next challenge.' : 'Take a breath. Your next challenge will be ready in a moment.');
    const delay = resultVisible ? resultGate.nextDelay(performance.now()) : null; if (delay !== null) resultTimer = window.setTimeout(paintResultActions, delay);
  }
  function paintResults(now) {
    const visible = state?.phase === 'matchEnd' && !deathView.holding && !rewardView.holding && !guideOpen;
    if (visible && !resultVisible) { resultVisible = true; controlsPaused = true; neutralize(); resultGate.begin(now); $('sv-result-title').focus({ preventScroll: true }); }
    if (!visible && resultVisible) { resultVisible = false; resultGate.cancel(); }
    setHidden($('sv-result-card'), !visible); if (!visible) return;
    const report = shinobiMatchSummary(state, playerId), signature = JSON.stringify(report);
    if (signature !== resultSignature) {
      resultSignature = signature; setText($('sv-result-kicker'), report.won ? 'SHOWDOWN VICTORY' : 'SHOWDOWN COMPLETE'); setText($('sv-result-title'), report.won ? 'Your blade. Your arena.' : 'A sharper return awaits.');
      setText($('sv-result-context'), `${report.map} · ${online ? 'Private duel' : `${report.bots} ${report.bots === 1 ? 'shinobi' : 'shinobi'} · ${report.difficulty}`} · first to two rounds`);
      for (const [id, value] of [['score', report.scores.join(' : ')], ['kills', report.kills], ['time', formatClock(report.ticks)], ['damage', report.damage], ['taken', report.taken], ['parries', report.parries], ['dashes', report.dashes], ['kunai', report.kunai], ['deaths', report.deaths]]) setText($(`sv-result-${id}`), value);
      victory.decorateResult({ won: report.won, kicker: report.won ? 'SHINOBI VICTORY' : 'SHOWDOWN COMPLETE', context: report.map });
      setText($('sv-replay'), online ? 'Rematch · ready up again →' : 'Run it again →'); setText($('sv-result-setup'), online ? 'Back to game shelf' : 'Change challenge');
    }
    paintResultActions();
  }
  function updateHud(now = performance.now(), force = false) {
    if (!state) return; const holding = observeEnding(now), local = own(), phase = state.phase;
    const urgent = phase === 'matchEnd' || phase === 'lobby' || phase === 'paused'; if (!force && !urgent && now - lastHud < 60) return; lastHud = now;
    setAttribute($('sv-app'), 'data-phase', phase); setText($('sv-map-label'), state.mapName || state.map?.name || 'Shinobi arena');
    setText($('sv-phase-label'), ({ lobby: online ? 'ASSEMBLE YOUR DUEL' : 'CHOOSE YOUR CHALLENGE', countdown: 'GET READY', fight: 'READ · REACT · COMMIT', roundEnd: 'ROUND COMPLETE', matchEnd: 'SHOWDOWN COMPLETE', paused: 'SOLO PAUSED' })[phase] || '');
    const team = local?.team === 1 ? 1 : 0; setText($('sv-score-you'), count(state.scores?.[team])); setText($('sv-score-them'), count(state.scores?.[1 - team]));
    setText($('sv-clock'), phase === 'fight' ? formatClock(state.roundTicks) : phase === 'countdown' || phase === 'roundEnd' ? `${Math.ceil((state.phaseTicks || 0) / 120)}s` : 'FIRST TO 2');
    setDisabled($('sv-pause'), !entered || !['countdown', 'fight', 'roundEnd', 'paused'].includes(phase));
    const menu = !graphicsError && !guideOpen && (phase === 'paused' || online && connected && ['countdown', 'fight', 'roundEnd'].includes(phase) && (controlsPaused || !entered));
    setHidden($('sv-setup-form'), online || phase !== 'lobby' || guideOpen || !!graphicsError); setHidden($('sv-online-card'), !online || phase !== 'lobby' && connected || guideOpen);
    setHidden($('sv-pause-card'), !menu); setHidden($('sv-overlay'), !menu && (online ? connected && phase !== 'lobby' : phase !== 'lobby') && (phase !== 'matchEnd' || holding) || guideOpen);
    setText($('sv-pause-kicker'), online ? 'CONTROLS RELEASED' : 'TAKE A BREATH'); setText($('sv-pause-title'), online ? entered ? 'Controls released.' : 'Enter the showdown.' : 'Showdown paused.');
    setText($('sv-pause-copy'), online ? 'The online duel keeps running. Press P or Enter showdown to take control.' : 'The shinobi and round clock wait for you. Resume with P. Changing challenge starts a fresh showdown.');
    setText($('sv-resume'), online ? 'Enter showdown →' : 'Resume showdown →'); setHidden($('sv-change-setup'), online);
    if (online) paintOnlineLobby();
    paintResults(now);
    const combat = entered && !guideOpen && !menu && ['countdown', 'fight', 'roundEnd'].includes(phase) && !!local;
    setHidden($('sv-hud'), !combat || holding); setHidden($('sv-touch'), !touchMode || !localLive() || phase !== 'fight');
    if (local) {
      const hp = Math.max(0, local.hp || 0), maxHp = local.maxHp || 200, stamina = clamp(local.stamina || 0, 0, 100), readout = shinobiAbilityReadout(local);
      setText($('sv-health'), Math.ceil(hp)); setText($('sv-health-max'), `/ ${maxHp}`); setStyle($('sv-health-fill'), 'width', `${hp / maxHp * 100}%`); setStyle($('sv-stamina-fill'), 'width', `${stamina}%`);
      setAttribute($('sv-health-meter'), 'aria-valuenow', Math.ceil(hp)); setAttribute($('sv-health-meter'), 'aria-valuemax', maxHp); setAttribute($('sv-stamina-meter'), 'aria-valuenow', Math.round(stamina)); setAttribute($('sv-health-meter').parentElement, 'data-low', hp < maxHp * .3);
      setText($('sv-stance'), !local.alive ? 'ELIMINATED · NEXT ROUND' : local.sprinting ? 'SPRINTING · STAMINA' : local.crouching ? 'CROUCHED · LOW PROFILE' : !local.grounded ? 'AIRBORNE' : 'STAMINA · SHIFT TO SPRINT');
      setText($('sv-dash-status'), readout.dash); setText($('sv-kunai-status'), readout.kunai); setText($('sv-feint-status'), readout.feint);
      for (const action of ['dash', 'kunai', 'feint']) setAttribute($(`sv-${action}-ability`), 'data-ready', readout[`${action}Ready`]);
      const dashTotal = engine.ABILITIES?.dash?.cooldownTicks || 120, feintTotal = engine.ABILITIES?.feint?.cooldownTicks || 90;
      setStyle($('sv-dash-fill'), 'width', `${100 * (1 - clamp((local.dashCooldown || 0) / dashTotal, 0, 1))}%`); setStyle($('sv-feint-fill'), 'width', `${100 * (1 - clamp((local.feintCooldown || 0) / feintTotal, 0, 1))}%`);
      setStyle($('sv-kunai-fill'), 'width', readout.kunaiReady ? '100%' : '0%'); setText($('sv-blade-status'), readout.status);
      [...$('sv-combo-pips').children].forEach((node, index) => setAttribute(node, 'data-active', readout.combo > index));
    }
    const round = !guideOpen && !menu && !holding && ['countdown', 'roundEnd'].includes(phase); setHidden($('sv-round'), !round);
    if (round) { setText($('sv-round-kicker'), `ROUND ${state.round || 1} · FIRST TO 2`); setText($('sv-round-title'), phase === 'countdown' ? String(Math.ceil((state.phaseTicks || 0) / 120)) : state.roundWinner === local?.team ? 'Round secured.' : 'Round lost.'); setText($('sv-round-copy'), phase === 'countdown' ? 'Read the arena. Save your first dash.' : `Next round in ${Math.ceil((state.phaseTicks || 0) / 120)}s · reset your rhythm`); }
    if (state.phase === 'matchEnd') setText($('sv-objective'), 'Showdown complete. Your stats come from the fight you just played.'); else setText($('sv-objective'), 'A clean parry opens the fight. Confirm your cuts; save stamina for an escape.');
  }
  function paintOnlineLobby() {
    const me = roster.find(person => person?.id === playerId), ready = roster.filter(person => person?.connected && person.ready).length;
    setText($('sv-online-kicker'), `${roomId} · PRIVATE DUEL`); setText($('sv-online-title'), !connected ? permanentError ? 'This room is unavailable.' : 'Connecting to the host.' : me?.ready ? 'Ready. Awaiting your rival.' : 'Take your position.');
    setText($('sv-online-copy'), !connected ? 'Your controls stay released while the connection recovers.' : `${state.mapName || 'Shinobi arena'} · ${ready} of 2 players ready. Share the invite, then ready up together.`);
    setDisabled($('sv-ready'), !connected || permanentError); setText($('sv-ready'), me?.ready ? 'Cancel ready' : 'Ready up →');
    const signature = JSON.stringify(roster.map(person => [person?.id, person?.name, person?.connected, person?.ready]));
    if ($('sv-roster').dataset.signature !== signature) {
      $('sv-roster').dataset.signature = signature; $('sv-roster').replaceChildren();
      for (let id = 0; id < 2; id++) { const person = roster.find(player => player?.id === id), row = document.createElement('div'), dot = document.createElement('i'), name = document.createElement('strong'), status = document.createElement('span'); row.dataset.ready = String(!!person?.ready); name.textContent = person?.connected ? `${person.name || `Shinobi ${id + 1}`}${id === playerId ? ' · you' : ''}` : 'Open seat'; status.textContent = person?.ready ? 'READY' : person?.connected ? 'NOT READY' : 'WAITING'; row.append(dot, name, status); $('sv-roster').append(row); }
    }
  }
  function draw(now = performance.now(), source = 'event') {
    if (!renderer?.available || !state || document.hidden || graphicsError) return;
    const live = state.phase === 'fight' && !controlsPaused && !guideOpen && !deathView.holding && !rewardView.holding;
    let view = online && snapshots.length ? interpolatedVoxelState(snapshots, timeline.time(now), playerId, { predictMovement: engine.predictLocalMovement, maxExtrapolationMs: 25, combatTime: timeline.currentTime(now) }) : { ...state, players: state.players.map(player => ({ ...player })) };
    if (!view) view = { ...state, players: state.players.map(player => ({ ...player })) };
    let players = view.players;
    if (live) players = players.map(player => {
      const source = online && player.id === playerId ? predictedPlayer || own() : !online ? state.players.find(other => other.id === player.id) : player;
      if (!source?.alive || online && player.id !== playerId) return player;
      if (!movement.has(player.id)) movement.set(player.id, createMovementPresenter());
      const input = player.id === playerId ? actionQueue.preview(currentInput(), now) : source.previousInput || engine.emptyInput();
      let pose = movement.get(player.id)(source, input, state.map, accumulator, engine.predictLocalMovement, state.players);
      if (online && player.id === playerId) pose = correction.present(pose, now, sweepPresentationOffset, state.map, state.players);
      return { ...player, ...pose };
    });
    players = resolvePresentationContacts(players, state.map);
    const cameraPlayer = players.find(player => player.id === playerId) || players[0];
    if (!cameraPlayer) return;
    view = { ...view, players, fighters: players };
    displayedState = view; displayedPlayer = cameraPlayer;
    const frozen = state.phase === 'paused' || guideOpen || controlsPaused && !online, time = frozen ? lastDrawAt || now : now;
    const camera = renderer.updateCamera(view, { localId: playerId, cameraPlayer, players, ...orbit, time, paused: frozen, reducedMotion: reduced.matches });
    if (camera?.aim) combatAim = { yaw: camera.aim.yaw, pitch: camera.aim.pitch };
    renderer.render(view, { localId: playerId, playerId, localPlayer: cameraPlayer, cameraPlayer, ...orbit, time, cameraPose: camera, acceptedPlayers: state.players, paused: frozen, reducedMotion: reduced.matches, roster });
    renderCount++; renderSources[source]++; lastRenderAt = now; if (!frozen) lastDrawAt = now;
    const reticle = localLive() && state.phase === 'fight' && !deathView.holding && !rewardView.holding;
    worldLabels.paint(renderer.worldLabels, { active: reticle });
    setHidden($('sv-crosshair'), !reticle); setAttribute($('sv-crosshair'), 'data-blocked', !!camera?.aim?.blocked); setAttribute($('sv-crosshair'), 'data-parrying', own()?.parryTicks > 0);
    paintHitFeedback(hitElements, hitFeedback.present(own(), { now, lifeKey: identity(), active: reticle, reducedMotion: reduced.matches }));
    setHidden($('sv-parry'), !reticle || now >= parryUntil); setHidden($('sv-damage'), !reticle || now >= damageUntil); setHidden($('sv-feedback'), !reticle || now >= feedbackUntil);
    footsteps.observe(renderer.locomotionActors, { now: time, context: identity(), listener: cameraPlayer, yaw: orbit.yaw, active: reticle });
  }
  function animate() { return !destroyed && !document.hidden && !graphicsError && !guideOpen && connected && !!state && (deathView.holding || rewardView.holding || ['countdown', 'fight', 'roundEnd'].includes(state.phase) && (online || !controlsPaused)); }
  function frame(now) {
    frameId = null; if (destroyed) return;
    const dt = lastFrame === null ? 0 : clamp((now - lastFrame) / 1000, 0, .1); lastFrame = now;
    if (localLive() && (touch.look.x || touch.look.y)) { orbit = cleanShinobiOrbit(orbit.yaw + touch.look.x * dt * 2.6, orbit.pitch - touch.look.y * dt * 2.2); updateAim(now); }
    const active = online ? connected && !controlsPaused && ['countdown', 'fight', 'roundEnd'].includes(state?.phase) : !controlsPaused && ['countdown', 'fight', 'roundEnd'].includes(state?.phase);
    if (active) {
      accumulator += dt; let ticks = 0;
      while (accumulator >= STEP && ticks++ < 12) {
        const phase = state.phase, sampled = actionQueue.sample(currentInput(), now).buttons;
        if (!online) { const inputs = engine.botInputs(state); inputs[playerId] = sampled; engine.step(state, inputs); physicsSamples++; }
        else if (phase === 'fight' && predictedPlayer?.alive && !controlsPaused) { const tick = ++predictionTick; engine.predictLocalMovement(predictedPlayer, sampled, state.map, 1, state.players); pending.push({ tick, buttons: { ...sampled } }); if (pending.length > 240) pending.shift(); physicsSamples++; }
        accumulator -= STEP;
        if (!online && previousRound !== state.round) { previousRound = state.round; neutralize({ unlock: false }); orbit = cleanShinobiOrbit(own()?.yaw); renderer?.resetEffects(); displayedState = displayedPlayer = null; footsteps.reset(); }
        if (phase !== state.phase) { actionQueue.reset({ held: currentInput(), neutral: true }); keys.delete('fire'); mouse.fire = false; }
        if (!online && state.phase === 'matchEnd') break;
      }
      if (accumulator >= STEP) accumulator %= STEP;
      if (online) sendInput();
    } else accumulator = 0;
    consumeEvents(now); updateHud(now);
    if (shouldRenderShinobiFrame({ online, controlsPaused, ending: deathView.holding || rewardView.holding, now, lastRenderAt })) draw(now, 'animation');
    if (animate()) frameId = window.requestAnimationFrame(frame);
  }
  function wake() { if (frameId === null && animate()) frameId = window.requestAnimationFrame(frame); }
  function stop() { if (frameId !== null) window.cancelAnimationFrame(frameId); frameId = null; lastFrame = null; accumulator = 0; }
  function receiveState(message) {
    const next = hydrateShinobiSnapshot(message.state); if (!next) return;
    connection.statePackets++; connection.lastStateAt = performance.now();
    const old = state, now = performance.now(), before = predictedPlayer;
    state = next; roster = (Array.isArray(message.players) ? message.players : Object.values(message.players || {})).map((person, id) => person ? { ...person, id: person.id ?? id } : null);
    const discontinuity = !old || old.mapId !== next.mapId || old.round !== next.round || old.phase === 'lobby' && next.phase !== 'lobby';
    if (discontinuity) { neutralize({ unlock: false }); snapshots = []; timeline.reset(); correction.reset(); orbit = cleanShinobiOrbit(own()?.yaw); updateAim(now); }
    if (old?.phase !== next.phase && next.phase === 'lobby') { entered = false; controlsPaused = true; neutralize(); resetPresentation(); }
    if (old?.phase !== next.phase && next.phase === 'matchEnd') neutralize();
    if (own()) { const ackValue = message.acks?.[playerId], ack = typeof ackValue === 'number' ? ackValue : ackValue?.seq ?? -1; const result = reconcileMovement(own(), pending, ack, state.map, engine.predictLocalMovement, state.phase === 'fight' && !controlsPaused, state.players, state.tick); predictedPlayer = result.predicted; pending = result.pending; predictionTick = result.predictionTick ?? state.tick; }
    if (!discontinuity && before && predictedPlayer) correction.correct(before, predictedPlayer, now, { continuous: old?.phase === 'fight' && state.phase === 'fight' });
    const sample = timeline.sample(state, now, identity()); if (sample) { snapshots.push(sample); if (snapshots.length > 12) snapshots.shift(); }
    previousRound = state.round; consumeEvents(now); updateHud(now, true);
    // A wire packet updates accepted gameplay immediately; the existing RAF owns
    // the GPU submission so several packets can never stack extra world draws.
    if (!animate()) draw(now, 'packet');
    wake();
  }
  function connect() {
    clearTimeout(reconnectTimer); if (destroyed || permanentError) return;
    if (!/^[A-Z0-9]{6}$/.test(roomId)) { permanentError = true; showError('This invite has no valid room code. Return to semaG and create or join a Shinobi Showdown 3D room.'); updateHud(performance.now(), true); return; }
    const ws = new window.WebSocket(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws?room=${encodeURIComponent(roomId)}`); socket = ws;
    ws.addEventListener('open', () => { if (socket !== ws || destroyed) return; connection.opens++; connected = true; attempts = 0; sequence = 0; showError(''); send({ type: 'join', name: getName() }); });
    ws.addEventListener('message', ({ data }) => {
      if (socket !== ws || destroyed) return; let message; try { message = JSON.parse(data); } catch { return; }
      if (message.type === 'welcome') { if (message.gameId !== 'shinobi-voxel') { permanentError = true; showError('This room belongs to a different game. Open its invite from the game shelf.'); return; } connection.welcomes++; playerId = message.playerId; entered = false; controlsPaused = true; updateHud(performance.now(), true); }
      else if (message.type === 'state') receiveState(message);
      else if (message.type === 'error') { connection.lastError = { at: performance.now(), message: String(message.message || '').slice(0, 180) }; showError(message.message || 'The host could not accept that action.'); if (/room.*(?:full|not found|expired)|unknown room|all.*occupied/i.test(message.message || '')) permanentError = true; }
    });
    ws.addEventListener('close', event => { if (socket !== ws || destroyed) return; connection.closes++; connection.lastClose = { at: performance.now(), code: event.code, reason: String(event.reason || '').slice(0, 120), wasClean: event.wasClean, tick: state?.tick, phase: state?.phase, playerId }; connected = false; controlsPaused = true; entered = false; neutralize(); stop(); resetPresentation(); playerId = null; if (event.code === 4403 || event.code === 4404) permanentError = true; updateHud(performance.now(), true); if (!permanentError) { showError('The host connection was lost. Reconnecting; ready up together after returning.'); reconnectTimer = window.setTimeout(connect, Math.min(5000, 750 * 2 ** attempts++)); } });
    ws.addEventListener('error', () => {});
  }
  function setGraphics() {
    try { renderer?.destroy(); renderer = new ShinobiVoxelRenderer(canvas); if (!renderer.available) throw new Error(renderer.error || 'WebGL is unavailable.'); graphicsError = ''; showError(''); setDisabled($('sv-start'), false); draw(performance.now()); updateHud(performance.now(), true); wake(); }
    catch (error) { graphicsError = String(error.message || error); controlsPaused = true; neutralize(); stop(); showError(`The arena could not render: ${graphicsError}`, true); setDisabled($('sv-start'), true); }
  }
  function openGuide() { if (guideOpen) return; if (entered && ['countdown', 'fight', 'roundEnd'].includes(state.phase)) pause(); guideOpen = true; neutralize(); stop(); setHidden($('sv-guide'), false); setAttribute($('sv-help'), 'aria-expanded', 'true'); updateHud(performance.now(), true); $('sv-guide-close').focus({ preventScroll: true }); }
  function closeGuide() { if (!guideOpen) return; guideOpen = false; setHidden($('sv-guide'), true); setAttribute($('sv-help'), 'aria-expanded', 'false'); updateHud(performance.now(), true); draw(performance.now()); (state.phase === 'paused' || controlsPaused && entered ? $('sv-resume') : $('sv-help')).focus({ preventScroll: true }); wake(); }
  function returnSetup() { if (online) { window.location.href = '/'; return; } neutralize(); stop(); preview(); $('sv-arena-cards').querySelector('[aria-pressed=true]')?.focus({ preventScroll: true }); }
  function paintLayouts() { setText($('sv-move-keys'), displayKey('WASD')); setText($('sv-kunai-key'), displayKey('Q')); setText($('sv-guide-kunai'), displayKey('Q')); setText($('sv-bottom-keys'), displayKey('WASD MOVE · E DASH · Q KUNAI · P MENU')); }
  const picker = mountKeyboardLayoutPicker($('sv-layout'), { id: 'sv-keyboard-layout' }); const unsubscribe = subscribeKeyboardLayout(() => { neutralize({ unlock: false }); paintLayouts(); }); paintLayouts();
  buildArenaCards(document, engine.MAPS);
  state = engine.createState({ mapId: $('sv-map').value, bots: online ? 0 : Number($('sv-bots').value), difficulty: $('sv-difficulty').value, online });
  orbit = cleanShinobiOrbit(own()?.yaw); combatAim = { yaw: orbit.yaw, pitch: 0 };
  setText($('sv-mode'), online ? 'PRIVATE DUEL · THIRD PERSON' : 'SOLO · THIRD PERSON'); setHidden($('sv-share'), !online);
  listen($('sv-setup-form'), 'submit', event => { event.preventDefault(); start(); });
  for (const id of ['sv-map', 'sv-bots', 'sv-difficulty']) listen($(id), 'change', () => { syncArenaCards(document); if (!online && state.phase === 'lobby') preview(); });
  listen($('sv-pause'), 'click', () => controlsPaused || state.phase === 'paused' ? resume() : pause()); listen($('sv-resume'), 'click', resume); listen($('sv-change-setup'), 'click', returnSetup);
  listen($('sv-result-setup'), 'click', () => { if (resultVisible && resultGate.isReady(performance.now())) returnSetup(); });
  listen($('sv-replay'), 'click', () => { if (!resultVisible || !resultGate.isReady(performance.now())) return; if (online) { neutralize(); send({ type: 'rematch' }); } else start(); });
  listen($('sv-ready'), 'click', () => { if (!connected || state.phase !== 'lobby') return; const me = roster.find(person => person?.id === playerId); neutralize(); send({ type: 'ready', ready: !me?.ready }); });
  listen($('sv-share'), 'click', async () => { try { await copyText(window.location.href); showError(''); setText($('sv-online-copy'), 'Invite copied. Send it to your rival, then ready up together.'); feedback('INVITE COPIED', performance.now(), 1800); } catch { showError('Copy this page’s address from your browser to share the room.'); } });
  listen($('sv-help'), 'click', openGuide); listen($('sv-guide-close'), 'click', closeGuide); listen($('sv-guide-back'), 'click', closeGuide);
  listen($('sv-retry'), 'click', setGraphics);
  listen($('sv-sound'), 'click', async () => { const enabled = await audio.setEnabled(!audio.enabled); setAttribute($('sv-sound'), 'aria-pressed', enabled); setAttribute($('sv-sound'), 'aria-label', enabled ? 'Mute sound' : 'Enable sound'); });
  listen($('sv-fullscreen'), 'click', async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await $('sv-app').requestFullscreen(); } catch { showError('Fullscreen is unavailable in this browser. The arena remains playable.'); } });
  listen(document, 'fullscreenchange', () => { setAttribute($('sv-fullscreen'), 'aria-pressed', !!document.fullscreenElement); renderer?.resize(); draw(performance.now()); });
  listen(window, 'keydown', event => {
    const code = event.code || event.key; physicalKeys.add(code); resultGate.press(`key:${code}`, performance.now());
    if (isPauseShortcut(event)) { event.preventDefault(); if (guideOpen) closeGuide(); else if (controlsPaused || state.phase === 'paused') resume(); else pause(); return; }
    if (event.key === 'Escape') {
      if (document.fullscreenElement) try { document.exitFullscreen?.()?.catch?.(() => {}); } catch { /* The browser can still handle Escape normally. */ }
      if (guideOpen) closeGuide(); else if (localLive()) pause(); return;
    }
    if (isShinobiFormTarget(event.target) || blockedKeys.has(code)) return;
    const action = shinobiControlForKey(event); if (!action || !localLive() || event.repeat) return; event.preventDefault(); keyActions.set(code, action); keys.add(action); observeInput();
  });
  listen(window, 'keyup', event => { const code = event.code || event.key; physicalKeys.delete(code); blockedKeys.delete(code); resultGate.release(`key:${code}`, performance.now()); const action = keyActions.get(code); keyActions.delete(code); if (action && ![...keyActions.values()].includes(action)) keys.delete(action); observeInput(); if (resultVisible) paintResultActions(); });
  listen(window, 'pointerdown', event => { if (event.pointerType === 'mouse') { physicalMouse.add(event.button); resultGate.press(`mouse:${event.button}`, performance.now()); } else { physicalTouch.add(event.pointerId); resultGate.press(`touch:${event.pointerId}`, performance.now()); } });
  function physicalPointerReleased(event) {
    if (event.pointerType === 'mouse') { physicalMouse.delete(event.button); blockedMouse.delete(event.button); resultGate.release(`mouse:${event.button}`, performance.now()); if (event.button === 0) mouse.fire = false; if (event.button === 2) mouse.aim = false; if (!physicalMouse.size) { drag = false; lastPointer = null; } }
    else { physicalTouch.delete(event.pointerId); resultGate.release(`touch:${event.pointerId}`, performance.now()); }
    observeInput(); if (resultVisible) paintResultActions();
  }
  listen(window, 'pointerup', physicalPointerReleased); listen(window, 'pointercancel', physicalPointerReleased);
  listen(canvas, 'pointerdown', event => { if (event.pointerType !== 'mouse' || !localLive() || blockedMouse.has(event.button)) return; event.preventDefault(); canvas.focus({ preventScroll: true }); if (event.button === 0) mouse.fire = true; if (event.button === 2) mouse.aim = true; drag = !pointerLocked(); lastPointer = { x: event.clientX, y: event.clientY }; requestCapture(); updateAim(); observeInput(); });
  listen(window, 'pointermove', event => { if (event.pointerType !== 'mouse' || !localLive()) return; if (pointerLocked()) look(event.movementX, event.movementY); else if (drag && lastPointer) { look(event.clientX - lastPointer.x, event.clientY - lastPointer.y); lastPointer = { x: event.clientX, y: event.clientY }; } });
  listen(canvas, 'contextmenu', event => event.preventDefault());
  listen(document, 'pointerlockchange', () => { if (!pointerLocked() && entered && !controlsPaused && !touchMode && localLive()) pause(); });
  listen(document, 'pointerlockerror', () => feedback('HOLD A MOUSE BUTTON + DRAG TO LOOK', performance.now(), 1800));
  listen(window, 'blur', () => { if (entered) pause(); else neutralize(); resultGate.clearHeld(); physicalKeys.clear(); physicalMouse.clear(); physicalTouch.clear(); blockedKeys.clear(); blockedMouse.clear(); });
  listen(document, 'visibilitychange', () => { if (document.hidden) { if (entered) pause(); else neutralize(); stop(); } else { updateHud(performance.now(), true); draw(performance.now()); wake(); } });
  listen(canvas, 'webglcontextlost', event => { event.preventDefault(); graphicsError = 'The graphics context was lost.'; if (!online && ['countdown', 'fight', 'roundEnd'].includes(state.phase)) engine.pauseMatch(state); controlsPaused = true; neutralize(); stop(); showError('The graphics context was lost. Retry graphics, then resume your showdown.', true); });
  listen(canvas, 'webglcontextrestored', setGraphics);
  listen(window, 'resize', () => { renderer?.resize(); draw(performance.now()); });
  for (const button of document.querySelectorAll('[data-sv-action]')) {
    listen(button, 'pointerdown', event => { if (!localLive()) return; event.preventDefault(); const action = button.dataset.svAction; button.setPointerCapture(event.pointerId); actionPointers.set(event.pointerId, { action, element: button }); touch.actions.add(action); button.classList.add('pressed'); observeInput(); });
    const end = event => { const pointer = actionPointers.get(event.pointerId); if (!pointer) return; actionPointers.delete(event.pointerId); if (![...actionPointers.values()].some(other => other.action === pointer.action)) { touch.actions.delete(pointer.action); pointer.element.classList.remove('pressed'); } if (event.type !== 'pointerup') actionQueue.reset({ held: currentInput(), neutral: true }); observeInput(); };
    listen(button, 'pointerup', end); listen(button, 'pointercancel', end); listen(button, 'lostpointercapture', end);
  }
  for (const pad of document.querySelectorAll('[data-sv-pad]')) {
    const move = event => { const pointer = padPointers.get(event.pointerId); if (!pointer) return; const bounds = pad.getBoundingClientRect(), radius = bounds.width * .34, x = clamp((event.clientX - pointer.x) / radius, -1, 1), y = clamp((event.clientY - pointer.y) / radius, -1, 1), size = Math.hypot(x, y), point = { x: size > 1 ? x / size : x, y: size > 1 ? y / size : y }; touch[pointer.type] = point; pad.querySelector('i').style.transform = `translate(${point.x * radius}px,${point.y * radius}px)`; observeInput(); };
    listen(pad, 'pointerdown', event => { if (!localLive()) return; event.preventDefault(); if ([...padPointers.values()].some(pointer => pointer.type === pad.dataset.svPad)) return; pad.setPointerCapture(event.pointerId); padPointers.set(event.pointerId, { type: pad.dataset.svPad, element: pad, x: event.clientX, y: event.clientY }); move(event); }); listen(pad, 'pointermove', move);
    const end = event => { const pointer = padPointers.get(event.pointerId); if (!pointer) return; padPointers.delete(event.pointerId); touch[pointer.type] = { x: 0, y: 0 }; pad.querySelector('i').style.transform = ''; observeInput(); }; listen(pad, 'pointerup', end); listen(pad, 'pointercancel', end); listen(pad, 'lostpointercapture', end);
  }
  setGraphics(); updateHud(performance.now(), true); draw(performance.now());
  if (online) { connect(); heartbeat = window.setInterval(() => sendInput(), 50); }
  function inspect() { return clone({ online, connected, playerId, phase: state?.phase, tick: state?.tick, input: currentInput(), orbit, controls: { pointerLocked: pointerLocked(), paused: controlsPaused, entered, guideOpen }, camera: renderer?.camera, renderCount, renderSources, connection, physicsSamples, accumulator, renderer: renderer?.stats, ending: { death: deathView, reward: rewardView, resultVisible, resultActionsReady, victory: victory.inspect() }, inputQueue: actionQueue.inspect() }); }
  function destroy() { if (destroyed) return; destroyed = true; neutralize(); stop(); clearTimeout(resultTimer); clearTimeout(reconnectTimer); clearInterval(heartbeat); socket?.close(); for (const remove of listeners) remove(); picker.destroy(); unsubscribe(); worldLabels.destroy(); victory.destroy(); renderer?.destroy(); audio.destroy(); footsteps.reset(); }
  listen(window, 'pagehide', destroy, { once: true });
  const diagnostics = Object.freeze({ getState: () => clone(state), inspect }); window.semagShinobiVoxel = diagnostics;
  return Object.freeze({ destroy, inspect });
}
function formatClock(ticks = 0) { const seconds = Math.max(0, Math.floor((ticks || 0) / 120)); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; }
const ARENA_DETAILS = Object.freeze({ 'shinobi-courtyard': ['Cedar Courtyard', 'Open duels · raised cedar terraces', '<path fill="#405b4d" d="M0 54h240v22H0z"/><path fill="#d3b591" d="M34 47h55v6H34zm117 0h55v6h-55zM83 60h75v6H83z"/><path fill="#825f49" d="M46 31h10v26H46zm142 0h10v26h-10zM40 28h164v7H40z"/><path fill="#586d46" d="M5 13h20v42H5zm203 4h19v39h-19z"/><path fill="#d1c49d" d="M106 38h30v23h-30z"/>'], 'shinobi-rooftops': ['Moonlit Rooftops', 'Linked roofs · climbing routes', '<path fill="#172431" d="M0 54h240v22H0z"/><path fill="#665852" d="M8 49h54v27H8zm170-16h53v43h-53zM92 46h51v30H92z"/><path fill="#577087" d="M3 42h63v9H3zm169-17h64v10h-64zM84 38h65v10H84z"/><path fill="#b49a7d" d="M61 42h24v4H61zm86-15h27v4h-27zM139 43h8v18h-8zm8-6h8v18h-8zm8-6h8v18h-8z"/><path fill="#dddcc3" d="M198 8h8v8h-8z"/>'], 'shinobi-dojo': ['Lantern Dojo', 'Tight halls · split mezzanine', '<path fill="#6a503c" d="M0 58h240v18H0z"/><path fill="#c3a784" d="M27 12h7v52h-7zm180 0h7v52h-7zM27 12h187v6H27zM82 39h89v7H82z"/><path fill="#998260" d="M37 58h35v6H37zm143-2h28v7h-28zM77 47h8v16h-8zm8-7h8v23h-8z"/><path fill="#e5b66c" d="M50 26h8v11h-8zm137 0h8v11h-8z"/><path fill="#d8c498" d="M105 21h28v17h-28z"/>'] });
function buildArenaCards(document, maps) {
  const select = document.getElementById('sv-map'), cards = document.getElementById('sv-arena-cards');
  for (const [id, map] of Object.entries(maps)) { const details = ARENA_DETAILS[id] || [map.name || id, map.description || 'Shinobi arena', '']; const option = document.createElement('option'); option.value = id; option.textContent = map.name || details[0]; select.append(option); const button = document.createElement('button'); button.type = 'button'; button.className = 'sv-arena-card'; button.dataset.arena = id; button.setAttribute('aria-label', `${details[0]}. ${details[1]}`); button.innerHTML = `<span class="sv-arena-art" aria-hidden="true"><svg viewBox="0 0 240 76" preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges">${details[2]}</svg></span><span class="sv-arena-info"><strong></strong><small></small></span><span class="sv-arena-check" aria-hidden="true">✓</span>`; button.querySelector('strong').textContent = details[0]; button.querySelector('small').textContent = details[1]; button.addEventListener('click', () => { select.value = id; select.dispatchEvent(new document.defaultView.Event('change', { bubbles: true })); }); cards.append(button); }
  syncArenaCards(document);
}
function syncArenaCards(document) { const selected = document.getElementById('sv-map').value; for (const button of document.querySelectorAll('[data-arena]')) button.setAttribute('aria-pressed', String(button.dataset.arena === selected)); }
if (typeof document !== 'undefined' && document.getElementById('sv-canvas')) mountShinobiVoxel();
