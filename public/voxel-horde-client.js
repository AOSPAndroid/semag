import { mountWeaponArmory } from './voxel-armory-ui.js';
import { secondaryActionPresentation, paintSecondaryAction, staminaPresentation, paintStamina, createReloadAudioPresenter, createGunImpactReporter, createParryAudioReporter } from './voxel-fps-feedback.js';
import { GameAudio } from './audio.js';
import { displayKey, gameKey, getKeyboardLayout, mountKeyboardLayoutPicker, subscribeKeyboardLayout } from './keyboard-layout.js';
import { copyText, getName, hostInfo, roomUrl, saveName } from './hub/shared.js';
import { ADS, HEAL, PLAYER_HEALTH, predictLocalMovement, sweepPresentationOffset, traceShot } from './voxel-engine.js';
import { WEAPONS } from './voxel-weapons.js';
import { cleanAim, composeInput, controlForKey, aimLookMultiplier, combatReadout, isFormTarget, hasGunshotReport, combatEventPerspective, createMeleeImpactReporter, createContinuousInputPacer as createInputPacer, LOOK_SENSITIVITY, populateWeaponSelect, renderWeaponDetails } from './voxel-client.js';
import { inventoryLootPresentation, inventoryEventFeedback, inventorySwapPresentation, mountInventoryHotbar, mountWeaponWheel } from './voxel-inventory-ui.js';
import { combatPresentation, createCorrectionPresenter, createMovementPresenter, interpolatedVoxelState, reconcileMovement, resolvePresentationContacts, withCombatPresentation } from './voxel-presentation.js';
import { incomingDamageFeedback, damageFeedbackPresentation, paintDamageFeedback } from './voxel-damage-feedback.js';
import { createHitFeedback, paintHitFeedback } from './voxel-hit-feedback.js';
import { createCrosshairPresenter, paintCrosshair } from './voxel-crosshair.js';
import { createFpsInputQueue, FPS_EDGE_ACTIONS, releaseFpsTouchAction } from './voxel-input-queue.js';
import { createNetworkTimeline } from './network-timeline.js';
import { tickFraction } from './display-timing.js';
import { mountVoxelLabelOverlay } from './voxel-label-overlay.js';
import { isPauseShortcut } from './pause-shortcut.js';
import { createEndPresentation } from './voxel-end-presentation.js';

const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const finite = n => Number.isFinite(n) ? n : 0;
const copy = value => value == null ? value : structuredClone(value);
const clock = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const LIVE_PHASES = Object.freeze(['countdown', 'fight', 'intermission']);
const MOVEMENT_PHASES = Object.freeze(['fight', 'intermission']);
const INTERMISSION_COMBAT_ACTIONS = Object.freeze(['fire', 'aim', 'grenade', 'heal', 'swap', 'reload']);

/** Repositioning previews cannot invent an attack while the squad is resupplying. */
export function hordeInputForPhase(input, phase) {
  if (phase !== 'intermission') return input;
  const allowed = { ...input };
  for (const action of INTERMISSION_COMBAT_ACTIONS) allowed[action] = false;
  return allowed;
}

/** Only connected, ready squad members count toward an explicit host start. */
export function hordeLobbyPresentation(state, roster = [], playerId, hostId, connected = true) {
  const capacity = Number.isInteger(state?.capacity) ? clamp(state.capacity, 1, 3) : 3;
  const people = roster.filter(person => person?.connected && Number.isInteger(person.id) && person.id >= 0 && person.id < capacity);
  const self = people.find(person => person.id === playerId);
  return { capacity, count: people.length, ready: !!self?.ready, host: playerId != null && playerId === hostId,
    canStart: !!(connected && state?.phase === 'lobby' && playerId === hostId && playerId != null && people.length && people.every(person => person.ready)),
    slots: Array.from({ length: capacity }, (_, id) => people.find(person => person.id === id) || { id, connected: false }) };
}

/** Elimination follows a surviving human, never a monster occupying a later slot. */
export function hordeSpectatorPlayer(state, playerId, spectatorId) {
  const participants = new Set(state?.horde?.participantIds || state?.participantIds || []);
  const humans = (state?.players || []).filter(player => player.team === 0 && !player.monsterType && participants.has(player.id));
  const local = humans.find(player => player.id === playerId) || state?.players?.find(player => player.id === playerId);
  if (local?.alive) return local;
  const living = humans.filter(player => player.alive);
  return living.find(player => player.id === spectatorId) || living[0] || local || null;
}

/** Creature tells follow committed nearby events, never an inferred body pose. */
export function hordeMonsterSoundGain(event, listener) {
  if (!event || event.id == null || !listener) return 0;
  const hound = event.type === 'monsterWindup' && event.monsterType === 'hound';
  const leaper = event.type === 'monsterLungeWindup' && event.monsterType === 'leaper';
  const roar = event.type === 'monsterRoar' && ['windup', 'release'].includes(event.stage);
  if (!hound && !leaper && !roar) return ['monsterWindup', 'monsterAim'].includes(event.type) && event.targetId === listener.id ? 1 : 0;
  if (!['x', 'y', 'z'].every(axis => Number.isFinite(event[axis]) && Number.isFinite(listener[axis]))) return 0;
  const radius = hound ? 12 : leaper ? 16 : 18, distance = Math.hypot(event.x - listener.x, event.y - listener.y, event.z - listener.z);
  if (distance >= radius) return 0;
  const gain = .35 + .65 * (1 - distance / radius);
  return event.targetId === listener.id ? Math.max(.8, gain) : gain * .7;
}

/** Spawned bodies keep their new pose even if an array slot was used last wave. */
export function hordeInterpolationSamples(samples) {
  const newest = samples.at(-1)?.state;
  if (!newest?.players) return samples;
  const lives = new Map(newest.players.map(player => [player.id, player]));
  return samples.map(sample => {
    let changed = false;
    const players = sample.state.players.map(player => {
      const current = lives.get(player.id);
      if (!current || current.lifeId === player.lifeId) return player;
      changed = true; return { ...current, alive: false };
    });
    return changed ? { ...sample, state: { ...sample.state, players } } : sample;
  });
}

export function hordeWavePresentation(state, tickRate = 120) {
  const horde = state?.horde || {}, wave = Math.max(0, finite(horde.wave));
  const seconds = Math.ceil(Math.max(0, finite(horde.phaseTicks ?? state?.phaseTicks)) / tickRate);
  return { wave, threats: Math.max(0, finite(horde.alive)) + Math.max(0, finite(horde.pending)), kills: Math.max(0, finite(horde.totalKills)), seconds,
    elapsed: Math.max(0, finite(horde.elapsedTicks)) / tickRate,
    banner: state?.phase === 'intermission' ? { tag: 'WAVE CLEARED', title: `NEXT WAVE IN ${seconds}`, detail: 'Recover, resupply and choose your next angle.' } :
      state?.phase === 'fight' && finite(horde.waveTicks) < tickRate * 2 ? { tag: 'HOLD YOUR GROUND', title: `WAVE ${wave}`, detail: wave >= 4 ? 'Armed hostiles — use solid cover.' : 'Watch the entry points.' } : null };
}

/** Personal damage comes from accepted HP loss across the whole run. */
export function hordeResultPresentation(state, playerId = 0, tickRate = 120) {
  const wave = hordeWavePresentation(state, tickRate);
  const player = state?.players?.find(player => player.id === playerId && !player.monster);
  return { wave: wave.wave, kills: wave.kills, elapsed: wave.elapsed,
    damage: Math.max(0, Math.round(finite(player?.damageDealt))) };
}

/** The fight-entry card remains reachable after the countdown has disappeared. */
export function hordeOverlayPresentation(state, { solo = false, connected = true, entered = false, paused = false, alive = false } = {}) {
  if (!state || !solo && !connected) return 'connection';
  if (state.phase === 'lobby') return 'setup';
  if (state.phase === 'matchEnd') return 'result';
  if (state.phase === 'paused' || LIVE_PHASES.includes(state.phase) && alive && paused) return 'pause';
  if (state.phase === 'countdown') return 'countdown';
  if (LIVE_PHASES.includes(state.phase) && alive && !entered) return 'pause';
  return null;
}

/** Revive feedback follows the authoritative uninterrupted hold, including resets. */
export function hordeRevivePresentation(player, target, { reviveTicks = 360, tickRate = 120 } = {}) {
  if (!target) return null;
  const total = Math.max(1, finite(reviveTicks)), active = player?.interaction === `revive:${target.id}` && player.interactTicks > 0;
  const ticks = active ? clamp(finite(player.interactTicks), 0, total) : 0, percent = Math.floor(ticks / total * 100);
  return { active, percent, seconds: (total - ticks) / tickRate,
    text: active ? `REVIVING ${percent}% · HOLD E · ${((total - ticks) / tickRate).toFixed(1)}s` : `Hold E · stay still in cover for ${(total / tickRate).toFixed(0)} seconds` };
}

export async function bootHorde() {
  const elements = new Map(), $ = id => { if (!elements.has(id)) elements.set(id, document.getElementById(id)); return elements.get(id); };
  const app = $('horde-app'), canvas = $('horde-canvas'), shell = $('horde-shell');
  if (!app || !canvas) return null;
  const worldLabels = mountVoxelLabelOverlay(canvas);
  const params = new URLSearchParams(location.search), roomId = (params.get('room') || '').trim().toUpperCase(), solo = params.get('solo') === '1' || !roomId;
  let engine, renderer, state = null, socket = null, playerId = solo ? 0 : null, hostId = solo ? 0 : null, connected = solo, roster = [];
  let destroyed = false, graphicsError = '', permanentError = false, reconnectTimer = null, reconnectAttempts = 0, invite = location.href;
  let aim = cleanAim(), predictedPlayer = null, presentationPlayer = null, presentationPlayers = [], snapshots = [], pending = [], previousPlayers = [];
  let entered = false, paused = false, modalOpen = false, fallback = false, spectatorId = null, frameId = null, previousFrame = null, accumulator = 0;
  let predictionTick = 0, sequence = 0, renderCount = 0, physicsSamples = 0, lastFraction = 0, lastHUDAt = -Infinity, lastDrawAt = 0, previousPhase = null;
  const hitFeedback = createHitFeedback(), hitMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const endPresentation = createEndPresentation();
  let endView = { holding: false, started: false, finished: false, remainingMs: 0 }, pendingResultFocus = false;
  let endObservedAt = -Infinity;
  function observeEnd(now = performance.now()) {
    now = Math.max(now, endObservedAt); endObservedAt = now;
    const viewedSelf = presentationPlayers.find(player => player.id === playerId);
    const spectating = viewedSelf?.alive === false && presentationPlayers.some(player => player.id !== playerId && !player.monsterType && player.team === 0 && player.alive);
    endView = endPresentation.observe(state?.phase, now, { contextKey: `${state?.mapId}:${state?.matchId}:${state?.horde?.sessionId ?? 0}`, eligible: !destroyed && connected && !graphicsError && !document.hidden && !modalOpen && (endView.holding || entered && !paused || spectating), reducedMotion: hitMotion.matches });
    return endView;
  }
  const hitElements = { crosshair: $('horde-crosshair'), scope: $('horde-scope'), marker: $('horde-hit') };
  const presentCrosshair = createCrosshairPresenter();
  let reticleView = null;
  function clearReticle() { presentCrosshair.reset(); reticleView = null; paintCrosshair(hitElements.crosshair, null); hide('horde-scope', true); }
  let feedbackUntil = 0, damageFeedback = null, lastCountdown = null, lastWave = 0, waveBannerUntil = 0, returnFocus = null, heartbeat = null;
  const keys = new Set(), physicalKeys = new Map(), mouse = { fire: false, aim: false }, touch = { move: { x: 0, y: 0 }, look: { x: 0, y: 0 }, actions: new Set() };
  const actionPointers = new Map(), padPointers = new Map(), inputQueue = createFpsInputQueue(), pacer = createInputPacer(60), movement = new Map();
  const correction = createCorrectionPresenter(), timeline = createNetworkTimeline({ snapshotTicks: 4 }), audio = new GameAudio(), listeners = [], eventSeen = new Set();
  const meleeImpacts = createMeleeImpactReporter(audio), gunImpacts = createGunImpactReporter(audio), parryAudio = createParryAudioReporter(audio);
  const reloadAudio = createReloadAudioPresenter(audio), staminaElements = { meter: $('horde-stamina-meter'), fill: $('horde-stamina-fill') };
  let staminaView = staminaPresentation(null, { active: false });
  function paintVitals(player, name = 'Your', active = true) { staminaView = staminaPresentation(player, { name, active }); paintStamina(staminaElements.meter, staminaElements.fill, staminaView); }
  const picker = mountKeyboardLayoutPicker($('horde-keyboard'), { id: 'horde-keyboard-select' });
  let touchMode = matchMedia('(pointer: coarse)').matches;
  const text = (id, value) => { const element = $(id); if (element.textContent !== String(value)) element.textContent = String(value); };
  const hide = (id, value) => { $(id).hidden = !!value; };
  const listen = (target, name, handler, options) => { target.addEventListener(name, handler, options); listeners.push(() => target.removeEventListener(name, handler, options)); };
  const locked = () => document.pointerLockElement === canvas;
  const localPlayer = () => state?.players?.find(player => player.id === playerId) || null;
  const running = () => !destroyed && connected && !!state && !graphicsError && !document.hidden && LIVE_PHASES.includes(state.phase);
  const finishingMonsterDeaths = () => !destroyed && connected && !graphicsError && !document.hidden && state?.phase === 'matchEnd' && renderer?.stats?.monsterDeaths?.activeCorpses > 0;
  const labelsActive = () => running() && !modalOpen && (localPlayer()?.alive ? entered && !paused : !!hordeSpectatorPlayer(state, playerId, spectatorId)?.alive);
  const controlsActive = () => !endView.holding && running() && entered && !paused && !modalOpen && localPlayer()?.alive && (locked() || fallback || touchMode);
  const currentInput = () => composeInput(keys, touch, mouse, aim, controlsActive());
  const weaponWheel = mountWeaponWheel(canvas, {
    context: () => ({ player: localPlayer(), active: controlsActive() && state?.phase === 'fight', pointerLocked: locked(), fallback, crouchHeld: keys.has('crouch') }),
    dispatch: action => { const input = currentInput(); if (input[action]) return false; sendInput({ ...input, [action]: true }, true); sendInput(input, true); wake(); return true; },
  });
  const inventory = mountInventoryHotbar($('horde-inventory'), actions => {
    if (!controlsActive() || !MOVEMENT_PHASES.includes(state?.phase)) return;
    weaponWheel.reset();
    const fresh = actions.filter(action => !keys.has(action)); fresh.forEach(action => keys.add(action)); sendInput(currentInput(), true);
    fresh.forEach(action => keys.delete(action)); sendInput(currentInput(), true); canvas.focus({ preventScroll: true }); wake();
  });
  const nameFor = id => roster.find(person => person?.id === id)?.name || (solo && id === 0 ? 'You' : `Player ${Number(id) + 1}`);
  const send = message => { if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message)); };
  function error(message = '') { text('horde-error-text', message); hide('horde-error', !message); hide('horde-retry', !graphicsError); }
  function feedback(message, now = performance.now(), duration = 1400) { text('horde-feedback', message); feedbackUntil = now + duration; }
  function hints() {
    app.dataset.keyboardLayout = getKeyboardLayout(); text('horde-guide-move', displayKey('WASD')); text('horde-grenade-key', displayKey('Q')); text('horde-guide-grenade', displayKey('Q'));
    text('horde-look-hint', fallback ? 'DRAG TO LOOK · P MENU · ESC RELEASE' : `${displayKey('WASD')} MOVE · RMB SECONDARY · P ${solo ? 'PAUSE' : 'MENU'} · ESC RELEASE`);
    canvas.setAttribute('aria-label', `First-person monster survival. ${displayKey('WASD')} or arrows move, mouse looks, left click or B / J uses your selected item, right click aims guns, stabs with a knife or parries with other blades, Space jumps, Control crouches, Shift sprints, C walks quietly, R reloads, 1 to 4 equip inventory slots, wheel up or down switches carried weapons, X drops the selected item, V switches blade, ${displayKey('Q')} throws a grenade, F heals, E picks up supplies or holds to revive. P ${solo ? 'toggles pause and opens the setup menu' : 'opens the controls menu or resumes controls'}. Escape exits fullscreen and releases your controls.`);
  }
  function sendInput(buttons = currentInput(), edge = false, now = performance.now(), cancelActions = false, cancelPress = null) {
    const nextSequence = sequence >= 999999000 ? 1 : sequence + 1;
    if (cancelActions) inputQueue.reset({ held: buttons, neutral: true });
    else { if (cancelPress) inputQueue.cancel(cancelPress); inputQueue.observe(hordeInputForPhase(buttons, state?.phase), now, { sequence: nextSequence }); }
    if (solo) { sequence = nextSequence; return sequence; }
    if (!connected || playerId == null || !pacer.shouldSend(now, edge || cancelActions || cancelPress)) return null;
    const renderTime = timeline.getState().renderTime;
    const viewTick = state?.phase === 'fight' && Number.isFinite(renderTime) && renderTime >= 0 ? renderTime * engine.TICK_RATE / 1000 : null;
    sequence = nextSequence; send({ type: 'input', seq: sequence, buttons, ...(viewTick === null ? {} : { viewTick }), ...(cancelActions ? { cancelActions: true } : {}), ...(cancelPress ? { cancelPress } : {}) }); return sequence;
  }
  function stopFrame() { if (frameId !== null) cancelAnimationFrame(frameId); frameId = null; previousFrame = null; accumulator = 0; }
  function clearInputs({ fence = false } = {}) {
    weaponWheel.reset();
    clearReticle();
    reloadAudio.suspend(); paintVitals(null, 'Your', false);
    worldLabels.clear();
    hitFeedback.reset(); paintHitFeedback(hitElements, { visible: false });
    const held = currentInput(); keys.clear(); physicalKeys.clear(); mouse.fire = mouse.aim = false; touch.actions.clear(); touch.move = { x: 0, y: 0 }; touch.look = { x: 0, y: 0 };
    // Remove records before releasing capture: synchronous loss cannot replay a tap.
    const pointers = [...actionPointers, ...padPointers]; actionPointers.clear(); padPointers.clear();
    for (const [id, pointer] of pointers) try { if (pointer.element.hasPointerCapture?.(id)) pointer.element.releasePointerCapture(id); } catch {}
    for (const element of document.querySelectorAll('[data-horde-action]')) { element.classList.remove('pressed'); element.setAttribute('aria-pressed', 'false'); }
    paintSecondaryAction(document.querySelector('[data-horde-action="aim"]'), secondaryActionPresentation(null, { active: false }));
    for (const element of document.querySelectorAll('[data-horde-pad] i')) element.style.transform = 'translate(0,0)';
    sendInput(composeInput(keys, touch, mouse, aim, false), true, performance.now(), true);
    if (fence) inputQueue.reset({ held });
    pacer.reset(); pending = []; predictionTick = state?.tick || 0; accumulator = 0; correction.reset(); predictedPlayer = copy(localPlayer());
  }
  function unlock() { if (locked()) document.exitPointerLock?.(); }
  function requestCapture() {
    if (touchMode || !canvas.requestPointerLock) { fallback = !touchMode; hints(); return; }
    try { const promise = canvas.requestPointerLock(); promise?.catch?.(() => { fallback = true; hints(); updateHUD(true); wake(); }); }
    catch { fallback = true; hints(); }
  }
  function enter() {
    if (!connected || !renderer?.available || !localPlayer()?.alive || !LIVE_PHASES.includes(state?.phase)) return;
    clearInputs(); if (solo && state.phase === 'paused') engine.resumeMatch(state); entered = true; paused = false; canvas.focus({ preventScroll: true }); requestCapture(); updateHUD(true); wake();
  }
  function pause() {
    if (!state || !LIVE_PHASES.includes(state.phase)) return;
    if (solo) engine.pauseMatch(state);
    paused = true; clearInputs(); unlock(); if (solo) stopFrame(); updateHUD(true); draw(lastDrawAt || performance.now()); $('horde-resume').focus({ preventScroll: true });
  }
  function resume() {
    if (!state || !renderer?.available || modalOpen || !localPlayer()?.alive) return;
    if (solo && state.phase === 'paused') engine.resumeMatch(state);
    if (!LIVE_PHASES.includes(state.phase)) return;
    clearInputs(); paused = false; entered = true; previousFrame = null; accumulator = 0; movement.clear(); correction.reset(); canvas.focus({ preventScroll: true }); requestCapture(); updateHUD(true); wake();
  }
  function resetPresentation() {
    endPresentation.reset(); pendingResultFocus = false; observeEnd();
    clearInputs(); stopFrame(); previousPlayers = []; snapshots = []; movement.clear(); timeline.reset(); correction.reset(); damageFeedback = null;
    feedbackUntil = waveBannerUntil = 0; hitFeedback.reset({ clearHistory: true }); eventSeen.clear(); renderer?.resetEffects(); audio.resetEvents(); meleeImpacts.reset(); gunImpacts.reset(); parryAudio.reset(); reloadAudio.reset(); lastCountdown = null; lastWave = 0; previousPhase = null;
    renderCount = physicsSamples = 0; lastFraction = 0; lastHUDAt = -Infinity; aim = cleanAim(localPlayer()?.yaw, localPlayer()?.pitch); predictedPlayer = copy(localPlayer());
  }
  function config() { return { capacity: 3, mapId: $('horde-map').value, difficulty: $('horde-difficulty').value, melee: 'knife' }; }
  function preview() {
    if (!solo || !engine || destroyed) return; entered = paused = false; unlock(); state = engine.createState(config()); engine.selectLoadout(state, 0, $('horde-weapon').value);
    state.map = engine.MAPS[state.mapId];
    resetPresentation(); updateHUD(true); draw();
  }
  function startSolo() {
    if (!solo || !renderer?.available || graphicsError || modalOpen) return;
    state = engine.createState({ ...config(), seed: Date.now() >>> 0 }); engine.selectLoadout(state, 0, $('horde-weapon').value); engine.startMatch(state, [0]); state.map = engine.MAPS[state.mapId]; resetPresentation();
    entered = true; paused = false; canvas.focus({ preventScroll: true }); requestCapture(); updateHUD(true); wake();
  }
  function showHelp() {
    if (modalOpen) return; returnFocus = document.activeElement; if (running()) pause(); modalOpen = true; clearInputs(); unlock(); hide('horde-guide', false); $('horde-help').setAttribute('aria-expanded', 'true'); $('horde-guide-close').focus({ preventScroll: true }); updateHUD(true);
  }
  function hideHelp() { modalOpen = false; hide('horde-guide', true); $('horde-help').setAttribute('aria-expanded', 'false'); (paused ? $('horde-resume') : returnFocus)?.focus?.({ preventScroll: true }); updateHUD(true); }
  function consumeEvents(now) {
    const freshEvents = [];
    const impactOptions = { lifeKey: `${state?.mapId}:${state?.matchId}`, viewedId: hordeSpectatorPlayer(state, playerId, spectatorId)?.id, gain: .13 };
    for (const event of state?.events || []) {
      const identity = `${state.matchId}:${event.id}`; if (eventSeen.has(identity)) continue; eventSeen.add(identity);
      freshEvents.push(event);
      if (eventSeen.size > 512) eventSeen.delete(eventSeen.values().next().value);
      const perspective = combatEventPerspective(event, playerId);
      const meleeImpact = meleeImpacts.consume(event, playerId, impactOptions);
      if (['hordeFight', 'hordeClear', 'hordeRevive', 'hordeEnd'].includes(event.type)) audio.playEvents([event]);
      else if (event.type === 'monsterRoar' && event.stage === 'interrupted' || ['kill', 'elimination'].includes(event.type) && state.players[event.targetId]?.monster) audio.playEvents([event]);
      else if (['monsterWindup', 'monsterAim', 'monsterLungeWindup', 'monsterRoar'].includes(event.type)) {
        const gain = hordeMonsterSoundGain(event, hordeSpectatorPlayer(state, playerId, spectatorId));
        if (gain > 0) audio.playEvents([event], { gain });
      }
      if (event.type === 'damage' && event.damage > 0) {
        const incoming = incomingDamageFeedback(event, localPlayer(), state.players, { now, lifeKey: `${state.matchId}:${localPlayer()?.lifeId}`, friendlyFire: false }); if (incoming) damageFeedback = incoming;
      }
      if (['kill', 'elimination'].includes(event.type) && perspective.outgoing) feedback(event.headshot ? 'HEADSHOT · HOSTILE DOWN' : 'HOSTILE DOWN', now, 850);
      if (['loot', 'lootPickup'].includes(event.type) && perspective.source === playerId) feedback(event.kind === 'weapon' ? `PICKED UP ${WEAPONS[event.weapon]?.label || 'WEAPON'}` : event.kind === 'heal' ? 'POTION COLLECTED' : event.kind === 'grenade' ? 'FRAG COLLECTED' : 'AMMUNITION PICKED UP', now);
      const inventoryFeedback = perspective.source === playerId ? inventoryEventFeedback(event) : null; if (inventoryFeedback) feedback(inventoryFeedback, now);
      if (event.type === 'healComplete' && perspective.source === playerId) feedback(`HEALED +${Math.round(event.amount || 0)} HP`, now);
      if (event.type === 'healCancel' && perspective.source === playerId) feedback('HEALING INTERRUPTED', now);
      if (event.type === 'hordeRevive') feedback(`${nameFor(event.targetId)} IS BACK IN THE FIGHT`, now);
      if (audio.enabled) try {
        if (event.type === 'meleeStart') audio.meleeSwing(event.weapon, { gain: perspective.source === playerId ? 1 : .22 });
        else if (hasGunshotReport(event)) audio.gunshot(event.weapon, { gain: perspective.source === playerId ? 1 : .22 });
        else if (event.type === 'grenadeExplosion') { audio.noise(.4, { highpass: 40, lowpass: 1500, gain: .28 }); audio.tone(70, .3, { end: 25, gain: .18 }); }
        else if (event.type === 'damage' && !meleeImpact && perspective.incoming) audio.tone(140, .055, { end: 70, gain: .13, type: 'triangle' });
      } catch {}
    }
    gunImpacts.consume(freshEvents, playerId, { context: `${state.mapId}:${state.matchId}:${state.round}`, viewedId: hordeSpectatorPlayer(state, playerId, spectatorId)?.id });
    parryAudio.consume(freshEvents, playerId, { context: `${state.mapId}:${state.matchId}:${state.round}`, viewedId: hordeSpectatorPlayer(state, playerId, spectatorId)?.id, active: connected && !paused && !modalOpen && state.phase === 'fight' });
    hitFeedback.consume(freshEvents, localPlayer(), state.players, { now, lifeKey: `${state.mapId}:${state.matchId}:${localPlayer()?.lifeId}`, active: state.phase === 'fight' && !paused && !modalOpen && connected });
  }
  function updateRoster() {
    const lobby = hordeLobbyPresentation(state, roster, playerId, hostId, connected);
    const signature = JSON.stringify(lobby.slots.map(person => [person.id, person.name, person.connected, person.ready]));
    if ($('horde-roster').dataset.signature !== signature) {
      $('horde-roster').dataset.signature = signature; $('horde-roster').replaceChildren(...lobby.slots.map(person => {
        const item = document.createElement('li'), name = document.createElement('b'), status = document.createElement('span');
        name.textContent = person.connected ? `${person.name || nameFor(person.id)}${person.id === playerId ? ' · YOU' : ''}${person.id === hostId ? ' · HOST' : ''}` : 'Open squad seat';
        status.textContent = person.connected ? person.ready ? 'READY' : 'NOT READY' : 'INVITE A FRIEND'; item.dataset.ready = String(!!person.ready); item.dataset.empty = String(!person.connected); item.append(name, status); return item;
      }));
    }
    $('horde-ready').disabled = !connected || playerId == null || state?.phase !== 'lobby'; $('horde-ready').setAttribute('aria-pressed', String(lobby.ready)); text('horde-ready', lobby.ready ? 'Ready ✓ · click to unready' : 'Ready up');
    $('horde-start').disabled = !renderer?.available || !!graphicsError || !lobby.canStart; hide('horde-start', !lobby.host);
    text('horde-ready-note', !connected ? 'Connecting to your host…' : lobby.canStart ? `${lobby.count} ready · the host can start with this squad.` : lobby.host ? 'Ready your squad, then start with 1–3 connected players.' : 'Ready up. The host starts when everyone is ready.');
    text('horde-start-note', `${lobby.count} / 3 connected · co-op has no global pause`);
  }
  function updateTeam() {
    const participants = new Set(state.horde?.participantIds || []), humans = state.players.filter(player => player.team === 0 && participants.has(player.id) && player.id !== playerId);
    hide('horde-team', solo || !humans.length || state.phase === 'lobby');
    const signature = JSON.stringify(humans.map(player => [player.id, player.hp, player.alive, player.reviveTicks, player.revivesThisWave]));
    if ($('horde-team').dataset.signature === signature) return; $('horde-team').dataset.signature = signature;
    $('horde-team').replaceChildren(...humans.map(player => { const item = document.createElement('li'), status = document.createElement('span'); item.textContent = nameFor(player.id); item.dataset.dead = String(!player.alive); status.textContent = player.alive ? `${Math.round(player.hp)} HP` : player.revivesThisWave >= 1 ? 'DOWN · RETURNS NEXT WAVE' : 'DOWN · HOLD E TO REVIVE'; item.append(status); return item; }));
  }
  function updateHUD(force = false, now = performance.now()) {
    const ending = observeEnd(now);
    if (!labelsActive()) worldLabels.clear();
    if (!state) { hide('horde-setup', true); hide('horde-pause-card', true); hide('horde-result', true); hide('horde-countdown', true); hide('horde-connection-card', false); hide('horde-overlay', false); text('horde-connection-title', permanentError ? 'Room unavailable.' : 'Connecting…'); text('horde-connection-copy', permanentError ? 'This room is full, closed or already fighting. Return to Semag to join the next run.' : 'Finding your squad on the host.'); return; }
    if (!force && now - lastHUDAt < 70) return; lastHUDAt = now;
    const phase = state.phase, player = localPlayer(), vitals = hordeSpectatorPlayer(state, playerId, spectatorId) || player, wave = hordeWavePresentation(state, engine.TICK_RATE), readout = vitals ? combatReadout(vitals, WEAPONS, { ADS, HEAL, PLAYER_HEALTH }) : null;
    for (const [id, value] of [['horde-weapon', player?.weapon]]) {
      $(id).disabled = !solo && (!connected || !['lobby', 'countdown', 'intermission', 'matchEnd'].includes(phase));
      if (!solo && value && !weaponArmory.isOpen() && document.activeElement !== $(id)) $(id).value = value;
    }
    weaponArmory.sync();
    weaponNote();
    paintVitals(vitals, vitals?.id !== playerId ? `${nameFor(vitals?.id)}’s` : 'Your', connected && !paused && !modalOpen && MOVEMENT_PHASES.includes(phase));
    inventory.update(vitals, { visible: !!vitals?.alive && !['lobby', 'matchEnd'].includes(phase), interactive: !!player?.alive && controlsActive() && MOVEMENT_PHASES.includes(phase) });
    const swap = inventorySwapPresentation(player), swapButton = document.querySelector('[data-horde-action="swap"]'); if (swap && swapButton) { swapButton.textContent = swap.label; swapButton.setAttribute('aria-label', swap.ariaLabel); }
    paintSecondaryAction(document.querySelector('[data-horde-action="aim"]'), secondaryActionPresentation(player, { active: controlsActive() && phase === 'fight' }));
    app.dataset.phase = phase; text('horde-map-label', state.mapName || state.map?.name || state.mapId); text('horde-wave', wave.wave || '—'); text('horde-threat', wave.threats); text('horde-clock', clock(wave.elapsed)); text('horde-status', phase === 'intermission' ? 'RESUPPLY & REPOSITION' : phase === 'fight' ? 'SURVIVE THE HORDE' : phase === 'paused' ? 'WORLD PAUSED' : phase === 'matchEnd' ? 'OVERRUN' : 'HOLD YOUR GROUND');
    text('horde-connection', solo ? 'SOLO' : connected ? `${roomId} · CO-OP` : 'DISCONNECTED');
    const disconnected = !solo && !connected, lobby = phase === 'lobby', acceptedCard = hordeOverlayPresentation(state, { solo, connected, entered, paused, alive: player?.alive });
    const card = ending.holding && acceptedCard === 'result' ? null : acceptedCard;
    hide('horde-overlay', !card); hide('horde-setup', card !== 'setup'); if (card !== 'setup') weaponArmory.close(); hide('horde-pause-card', card !== 'pause'); hide('horde-result', card !== 'result'); hide('horde-countdown', card !== 'countdown'); hide('horde-connection-card', card !== 'connection');
    if (disconnected) { text('horde-connection-title', permanentError ? 'Room unavailable.' : 'Connection lost.'); text('horde-connection-copy', permanentError ? 'This run has started or the room is unavailable. Return to Semag for the next squad.' : 'Your controls are released. Reconnecting to the host…'); }
    hide('horde-combat', !player || lobby || disconnected || phase === 'matchEnd'); hide('horde-enter', entered && !paused); $('horde-enter').disabled = !connected || !!graphicsError;
    text('horde-countdown-value', Math.ceil(Math.max(0, finite(state.phaseTicks ?? state.horde?.phaseTicks)) / engine.TICK_RATE));
    text('horde-pause-tag', solo ? 'TAKE A BREATH' : 'YOUR CONTROLS ARE RELEASED'); text('horde-pause-title', solo ? 'Paused.' : entered ? 'Step back in.' : 'Your squad is fighting.');
    text('horde-pause-copy', solo ? 'The world and every enemy are frozen. Press P to return, or change your loadout and setup for a new run.' : 'The battle keeps running for your teammates. Press P to return when you are ready.'); hide('horde-restart', !solo); hide('horde-change-setup', !solo);
    $('horde-pause').disabled = !LIVE_PHASES.includes(phase) && phase !== 'paused'; text('horde-pause', phase === 'paused' || paused ? '▶' : 'Ⅱ'); $('horde-pause').setAttribute('aria-label', phase === 'paused' || paused ? 'Resume controls' : solo ? 'Pause game' : 'Release controls');
    if (solo) { hide('horde-start', false); $('horde-start').disabled = !renderer?.available || !!graphicsError; }
    else updateRoster();
    if (vitals && readout) {
      text('horde-health-subject', vitals.id !== playerId ? nameFor(vitals.id).toUpperCase() : 'HEALTH'); $('horde-health-rail').setAttribute('aria-label', vitals.id !== playerId ? `${nameFor(vitals.id)} health` : 'Your health');
      text('horde-health', Math.ceil(vitals.hp)); text('horde-health-max', `/ ${vitals.maxHp || PLAYER_HEALTH}`); $('horde-health-fill').style.width = `${clamp(vitals.hp / (vitals.maxHp || PLAYER_HEALTH), 0, 1) * 100}%`; $('horde-health-rail').setAttribute('aria-valuenow', String(vitals.hp)); $('horde-health-rail').setAttribute('aria-valuemax', String(vitals.maxHp || PLAYER_HEALTH)); $('horde-health-rail').dataset.low = String(vitals.hp < (vitals.maxHp || PLAYER_HEALTH) * .3);
      text('horde-grenades', readout.grenades); text('horde-potions', readout.potions); text('horde-weapon-name', readout.label); text('horde-ammo', readout.ammo); text('horde-reserve', readout.sword || readout.healing || readout.utility ? '' : `/ ${readout.reserve}`); text('horde-weapon-status', phase === 'intermission' && !readout.progress ? 'E SUPPLIES · X DROP · REPOSITION' : readout.status); $('horde-weapon-panel').dataset.sword = String(readout.sword || readout.healing || readout.utility); hide('horde-action-track', !readout.progress); if (readout.progress) $('horde-action-fill').style.width = `${readout.progress.percent}%`;
      $('horde-action-track').setAttribute('aria-label', readout.progress?.label || 'Weapon action'); $('horde-action-track').setAttribute('aria-valuenow', String(Math.round(readout.progress?.percent || 0))); $('horde-action-track').setAttribute('aria-valuetext', `${((readout.progress?.remaining || 0) / 120).toFixed(1)} seconds remaining`);
    }
    const loot = player?.alive && MOVEMENT_PHASES.includes(phase) ? engine.findNearbyLoot?.(state, playerId) : null, revive = player?.alive && phase === 'fight' ? engine.findReviveTarget?.(state, playerId) : null;
    const reviveView = hordeRevivePresentation(player, revive, { reviveTicks: engine.HORDE_RULES.reviveTicks, tickRate: engine.TICK_RATE });
    hide('horde-revive-track', !reviveView?.active);
    if (reviveView?.active) { $('horde-revive-fill').style.width = `${reviveView.percent}%`; $('horde-revive-track').setAttribute('aria-valuenow', String(reviveView.percent)); }
    hide('horde-pickup', !loot && !revive || paused || modalOpen); if (revive) { text('horde-pickup-name', `Revive ${nameFor(revive.id)}`); text('horde-pickup-detail', reviveView.text); } else if (loot) { const lootView = inventoryLootPresentation(loot, player); text('horde-pickup-name', lootView?.name || 'Supply'); text('horde-pickup-detail', lootView?.detail ? displayKey(lootView.detail) : 'E to pick up'); }
    const downCopy = player?.revivesThisWave >= 1 ? 'Your revive is spent for this wave. Clear it to return to the fight.' : 'Hold on — teammates can revive you. Clear the wave to return.';
    const spectatorHint = $('horde-spectator').querySelector('span'); if (spectatorHint.textContent !== downCopy) spectatorHint.textContent = downCopy;
    const spectating = !player?.alive && phase === 'fight'; hide('horde-spectator', !spectating || disconnected); const viewed = hordeSpectatorPlayer(state, playerId, spectatorId); text('horde-spectator-name', viewed?.alive ? `WATCHING ${nameFor(viewed.id).toUpperCase()}` : 'SQUAD DOWN');
    if (phase === 'matchEnd') {
      const result = hordeResultPresentation(state, playerId, engine.TICK_RATE);
      text('horde-result-damage', result.damage.toLocaleString()); text('horde-result-wave', result.wave);
      text('horde-result-kills', result.kills); text('horde-result-time', clock(result.elapsed));
      text('horde-result-kills-label', solo ? 'HOSTILES DEFEATED' : 'SQUAD KILLS');
      text('horde-result-copy', 'Find better cover, protect your reloads, and make the next stand count.');
      text('horde-replay-label', solo ? 'Replay' : playerId === hostId ? 'Open the next squad lobby' : 'Waiting for the host');
      $('horde-replay').disabled = ending.holding || !solo && playerId !== hostId; hide('horde-result-setup', !solo); $('horde-result-setup').disabled = ending.holding;
      if (!ending.holding && pendingResultFocus) {
        pendingResultFocus = false;
        if (solo && !modalOpen) { $('horde-result-title').setAttribute('tabindex', '-1'); $('horde-result-title').focus({ preventScroll: true }); }
      }
    }
    text('horde-objective', lobby ? solo ? 'Choose your arena and loadout. Start when you’re ready.' : 'Invite up to two friends. Everyone readies; the host starts.' : phase === 'paused' ? 'All movement and combat paused.' : phase === 'matchEnd' ? solo ? 'Your stand is over. Replay the same challenge, or change your setup.' : 'Squad overrun. The host can open the next lobby.' : phase === 'intermission' ? `Next wave in ${wave.seconds}s · recover, resupply, reposition.` : !player?.alive ? downCopy : 'Keep an escape route. E picks up drops · F drinks a potion · hold E near a fallen teammate.');
    const banner = wave.banner || (phase === 'fight' && now < waveBannerUntil ? { tag: 'HOLD YOUR GROUND', title: `WAVE ${wave.wave}`, detail: wave.wave >= 4 ? 'Armed hostiles — use solid cover.' : 'Watch the entry points.' } : null);
    hide('horde-wave-banner', !banner || modalOpen || paused); if (banner) { text('horde-wave-tag', banner.tag); text('horde-wave-copy', banner.title); text('horde-wave-detail', banner.detail); }
    updateTeam();
  }
  function draw(now = performance.now()) {
    if (!renderer?.available || !state || destroyed || graphicsError || document.hidden) { clearReticle(); worldLabels.clear(); reloadAudio.suspend(); paintVitals(null, 'Your', false); return; }
    if (endView.holding) {
      const players = state.players.map(player => ({ ...player })), view = { ...state, players, fighters: players };
      const camera = players.find(player => player.id === playerId) || hordeSpectatorPlayer(view, playerId, spectatorId) || players[0];
      const viewAim = camera?.id === playerId && camera.alive ? aim : cleanAim(camera?.yaw, camera?.pitch);
      presentationPlayer = players.find(player => player.id === playerId); presentationPlayers = players;
      renderer.render(view, { acceptedPlayers: state.players, playerId, localId: playerId, localPlayer: presentationPlayer, viewPlayer: camera, cameraPlayer: camera, yaw: viewAim.yaw, pitch: viewAim.pitch, time: now, roster });
      clearReticle(); worldLabels.clear(); reloadAudio.suspend(); paintVitals(null, 'Your', false); renderCount++; lastDrawAt = now;
      return;
    }
    const live = running(); if (live) lastDrawAt = now;
    let view;
    if (solo) {
      view = { ...state, players: state.players.map(player => {
        let pose = player;
        if (MOVEMENT_PHASES.includes(state.phase) && player.alive) { if (!movement.has(player.id)) movement.set(player.id, createMovementPresenter()); pose = movement.get(player.id)(player, player.id === playerId ? inputQueue.preview(hordeInputForPhase(currentInput(), state.phase), now) : player.previousInput || player, state.map, accumulator, predictLocalMovement, state.players); }
        return withCombatPresentation(pose, combatPresentation(player, previousPlayers[player.id] || player, 1, live ? accumulator * 1000 : 0));
      }) };
      view.players = resolvePresentationContacts(view.players, state.map, { anchorId: localPlayer()?.alive ? playerId : undefined, authoritativePlayers: state.players }); presentationPlayer = view.players.find(player => player.id === playerId);
    } else {
      view = interpolatedVoxelState(hordeInterpolationSamples(snapshots), timeline.time(now), playerId, { predictMovement: predictLocalMovement, traceProjectile: traceShot, combatTime: timeline.currentTime(now) }) || { ...state, players: state.players.map(player => ({ ...player })) };
      presentationPlayer = predictedPlayer || localPlayer();
      if (MOVEMENT_PHASES.includes(state.phase) && presentationPlayer?.alive && controlsActive()) { if (!movement.has(playerId)) movement.set(playerId, createMovementPresenter()); presentationPlayer = movement.get(playerId)(presentationPlayer, inputQueue.preview(hordeInputForPhase(currentInput(), state.phase), now), state.map, accumulator, predictLocalMovement, state.players); }
      const previous = snapshots.at(-2)?.state.players.find(player => player.id === playerId) || localPlayer(), newest = snapshots.at(-1);
      presentationPlayer = withCombatPresentation(presentationPlayer, localPlayer() && combatPresentation(localPlayer(), previous, 1, Math.max(0, timeline.currentTime(now) - (newest?.time || 0))));
      presentationPlayer = correction.present(presentationPlayer, now, sweepPresentationOffset, state.map, state.players);
      view.players = resolvePresentationContacts(view.players.map(player => localPlayer()?.alive && player.id === playerId ? presentationPlayer : player), state.map, { anchorId: localPlayer()?.alive ? playerId : undefined, authoritativePlayers: state.players });
      if (localPlayer()?.alive) presentationPlayer = view.players.find(player => player.id === playerId) || presentationPlayer;
    }
    presentationPlayers = view.players; view.fighters = view.players;
    const camera = hordeSpectatorPlayer(view, playerId, spectatorId) || presentationPlayer || state.players[0], viewAim = camera?.id === playerId && camera.alive ? aim : cleanAim(camera?.yaw, camera?.pitch);
    renderer.render(view, { acceptedPlayers: state.players, playerId, localId: playerId, localPlayer: presentationPlayer, viewPlayer: camera, cameraPlayer: camera, yaw: viewAim.yaw, pitch: viewAim.pitch + finite(camera?.recoil), time: live || state.phase === 'matchEnd' ? now : lastDrawAt || now, roster });
    worldLabels.paint(renderer.worldLabels, { active: labelsActive() });
    paintVitals(camera, camera?.id !== playerId ? `${nameFor(camera?.id)}’s` : 'Your', labelsActive());
    reloadAudio.observe(state.players.find(player => player.id === camera?.id), { tick: state.tick, context: `${state.mapId}:${state.matchId}:${state.round}`, active: connected && !paused && !modalOpen && state.phase === 'fight' }); renderCount++; lastFraction = tickFraction(accumulator, 1 / engine.TICK_RATE);
    reticleView = presentCrosshair(camera, now, `${state.mapId}:${state.matchId}:${state.round}:${state.phase}`, { width: canvas.clientWidth, height: canvas.clientHeight, rules: ADS, active: labelsActive() && !paused && state.phase === 'fight', reducedMotion: hitMotion.matches });
    paintCrosshair(hitElements.crosshair, reticleView); hide('horde-scope', !reticleView.visible || !reticleView.scoped);
    paintHitFeedback(hitElements, hitFeedback.present(localPlayer(), { now, lifeKey: `${state.mapId}:${state.matchId}:${localPlayer()?.lifeId}`, active: state.phase === 'fight' && !paused && !modalOpen && connected, reducedMotion: hitMotion.matches })); hide('horde-feedback', now >= feedbackUntil || !LIVE_PHASES.includes(state.phase));
    paintDamageFeedback($('horde-damage'), damageFeedbackPresentation(damageFeedback, localPlayer(), { now, lifeKey: `${state.matchId}:${localPlayer()?.lifeId}`, yaw: aim.yaw, active: state.phase === 'fight' && !paused }));
  }
  function phaseTransition(oldPhase, oldLife, now) {
    observeEnd(now);
    if (state.phase !== oldPhase || localPlayer()?.lifeId !== oldLife) {
      hitFeedback.reset();
      const held = currentInput(); pending = []; predictionTick = state.tick; accumulator = 0; correction.reset(); movement.clear();
      if (!solo) sendInput(composeInput(keys, touch, mouse, aim, false), true, now, true);
      inputQueue.reset({ held });
    }
    if (state.horde.wave !== lastWave) { lastWave = state.horde.wave; waveBannerUntil = now + 2200; }
    if (state.phase === 'countdown') { const value = Math.ceil(finite(state.phaseTicks) / engine.TICK_RATE); if (value !== lastCountdown) { lastCountdown = value; audio.countdown(value); } }
    if (state.phase === 'matchEnd' && oldPhase !== 'matchEnd') {
      clearInputs(); entered = false; paused = false; unlock();
      pendingResultFocus = true;
      // Death and the result are already authoritative. Render their short
      // cosmetic tail before exposing the replay controls.
      updateHUD(true, now);
    }
    if (localPlayer()?.alive === false && oldLife !== undefined) { if (entered) { clearInputs(); unlock(); entered = false; } }
    if (state.phase === 'lobby' && oldPhase !== 'lobby') { clearInputs(); unlock(); entered = paused = false; snapshots = []; timeline.reset(); }
    previousPhase = state.phase;
  }
  function frame(now) {
    frameId = null;
    const wasHolding = endView.holding, ending = observeEnd(now);
    if (!running()) {
      previousFrame = null;
      if (wasHolding || ending.holding || finishingMonsterDeaths()) {
        draw(now); updateHUD(wasHolding !== ending.holding, now); wake();
      }
      return;
    }
    weaponWheel.flush();
    const dt = previousFrame == null ? 0 : clamp((now - previousFrame) / 1000, 0, .0667); previousFrame = now;
    if (controlsActive() && (touch.look.x || touch.look.y)) { const multiplier = aimLookMultiplier(presentationPlayer || localPlayer(), ADS); aim = cleanAim(aim.yaw + touch.look.x * dt * 2.6 * multiplier, aim.pitch - touch.look.y * dt * 2.2 * multiplier); }
    accumulator += dt; const buttons = currentInput(); sendInput(buttons, false, now); let ticks = 0;
    while (accumulator >= 1 / engine.TICK_RATE && ticks++ < 8 && running()) {
      accumulator -= 1 / engine.TICK_RATE;
      if (solo) {
        previousPlayers = state.players.map(player => ({ ...player })); const oldPhase = state.phase, oldLife = localPlayer()?.lifeId;
        let input = MOVEMENT_PHASES.includes(state.phase) ? inputQueue.sample(hordeInputForPhase(buttons, state.phase), now).buttons : buttons;
        // The engine sees held combat intent for next-wave release fences, while
        // intermission's real rules suppress every attack and item commitment.
        if (state.phase === 'intermission') { input = { ...input }; for (const action of INTERMISSION_COMBAT_ACTIONS) input[action] = buttons[action]; }
        engine.step(state, [input]); physicsSamples++; phaseTransition(oldPhase, oldLife, now);
      } else {
        const tick = ++predictionTick; if (MOVEMENT_PHASES.includes(state.phase) && predictedPlayer?.alive && controlsActive()) { const sampled = inputQueue.sample(hordeInputForPhase(buttons, state.phase), now).buttons; predictLocalMovement(predictedPlayer, sampled, state.map, 1, state.players); pending.push({ tick, buttons: { ...sampled } }); if (pending.length > 240) pending.shift(); physicsSamples++; }
      }
    }
    if (!solo && predictedPlayer) { predictedPlayer.yaw = aim.yaw; predictedPlayer.pitch = aim.pitch; }
    consumeEvents(now); updateHUD(false, now); draw(now); wake();
  }
  function wake() { if ((running() || endView.holding || finishingMonsterDeaths()) && frameId === null) frameId = requestAnimationFrame(frame); }
  function receiveState(message) {
    const next = message.state; if (!next?.players || !engine.MAPS[next.mapId]) return;
    const old = state, now = performance.now(), before = predictedPlayer && MOVEMENT_PHASES.includes(old?.phase) ? (movement.get(playerId) || (() => predictedPlayer))(predictedPlayer, inputQueue.preview(hordeInputForPhase(currentInput(), old.phase), now), old.map, accumulator, predictLocalMovement, old.players) : predictedPlayer;
    state = { ...next, map: engine.MAPS[next.mapId] }; state.fighters = state.players; hostId = message.hostId ?? state.hostId ?? hostId;
    roster = (Array.isArray(message.players) ? message.players : Object.values(message.players || {})).map((person, id) => person ? { ...person, id: person.id ?? id } : null);
    const local = localPlayer(), fresh = !old || old.matchId !== state.matchId || old.phase === 'lobby' && state.phase !== 'lobby';
    if (fresh) { aim = cleanAim(local?.yaw, local?.pitch); pending = []; snapshots = []; timeline.reset(); correction.reset(); movement.clear(); eventSeen.clear(); hitFeedback.reset({ clearHistory: true }); damageFeedback = null; renderer?.resetEffects(); meleeImpacts.reset(); gunImpacts.reset(); parryAudio.reset(); reloadAudio.reset(); lastCountdown = null; }
    phaseTransition(old?.phase, old?.players.find(player => player.id === playerId)?.lifeId, now);
    if (local) {
      const ack = typeof message.acks?.[playerId] === 'number' ? message.acks[playerId] : message.acks?.[playerId]?.seq ?? -1;
      const result = reconcileMovement(local, pending, ack, state.map, predictLocalMovement, MOVEMENT_PHASES.includes(state.phase) && controlsActive(), state.players, state.tick);
      predictedPlayer = result.predicted; pending = result.pending; predictionTick = result.predictionTick; predictedPlayer.yaw = aim.yaw; predictedPlayer.pitch = aim.pitch;
      const after = MOVEMENT_PHASES.includes(state.phase) && controlsActive() && movement.has(playerId) ? movement.get(playerId)(predictedPlayer, inputQueue.preview(hordeInputForPhase(currentInput(), state.phase), now), state.map, accumulator, predictLocalMovement, state.players) : predictedPlayer;
      if (!fresh) correction.correct(before, after, now, { continuous: MOVEMENT_PHASES.includes(old?.phase) && old.phase === state.phase && old.matchId === state.matchId && old.mapId === state.mapId && old.players.find(player => player.id === playerId)?.lifeId === local.lifeId });
    }
    const sample = timeline.sample(state, now, `${state.mapId}:${state.matchId}:${state.round}:${state.phase}`); if (sample) { snapshots.push(sample); if (snapshots.length > 12) snapshots.shift(); }
    consumeEvents(now); updateHUD(true, now); if (!running()) draw(now); wake();
  }
  function connect() {
    clearTimeout(reconnectTimer); if (solo || destroyed || permanentError) return;
    if (!/^[A-Z0-9]{6}$/.test(roomId)) { permanentError = true; error('This invite needs a valid room code. Return to Semag to create or join a squad.'); updateHUD(true); return; }
    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws?room=${encodeURIComponent(roomId)}`); socket = ws;
    listen(ws, 'open', () => { if (socket !== ws) return; connected = true; reconnectAttempts = 0; sequence = 0; send({ type: 'join', name: saveName($('horde-name').value) }); error(''); updateHUD(true); });
    listen(ws, 'message', ({ data }) => { if (socket !== ws || destroyed) return; let message; try { message = JSON.parse(data); } catch { return; }
      if (message.type === 'welcome') { if (message.gameId !== 'voxel-horde') { permanentError = true; location.replace(roomUrl({ id: roomId, gameId: message.gameId })); return; } playerId = message.playerId; hostId = message.hostId ?? hostId; connected = true; entered = paused = false; clearInputs(); }
      else if (message.type === 'state') receiveState(message);
      else if (message.type === 'error') { error(message.message || 'The host could not accept that action.'); if (/room.*(?:full|not found|expired|in progress|already started)|unknown room|all.*occupied/i.test(message.message || '')) permanentError = true; }
    });
    listen(ws, 'close', event => { if (socket !== ws || destroyed) return; connected = false; endPresentation.reset(); pendingResultFocus = false; clearInputs(); entered = false; paused = true; unlock(); stopFrame(); timeline.reset(); snapshots = []; pending = []; if ([4403, 4404, 4409].includes(event.code)) permanentError = true; updateHUD(true); if (!permanentError) reconnectTimer = setTimeout(connect, Math.min(5000, 750 * 2 ** reconnectAttempts++)); });
    listen(ws, 'error', () => {});
  }
  function keyboardDown(event) {
    if (event.target?.closest?.('[data-voxel-armory]')) return;
    if (modalOpen) {
      if (event.key === 'Escape' && !event.repeat) hideHelp();
      else if (event.key === 'Tab') { const buttons = [...$('horde-guide').querySelectorAll('button:not(:disabled)')], index = buttons.indexOf(document.activeElement); if (event.shiftKey && index <= 0) { event.preventDefault(); buttons.at(-1)?.focus(); } else if (!event.shiftKey && index === buttons.length - 1) { event.preventDefault(); buttons[0]?.focus(); } }
      return;
    }
    if (isPauseShortcut(event) && (LIVE_PHASES.includes(state?.phase) || state?.phase === 'paused')) {
      event.preventDefault();
      if (paused || state.phase === 'paused' || !entered) resume(); else pause();
      return;
    }
    if (event.key === 'Escape' && (LIVE_PHASES.includes(state?.phase) || state?.phase === 'paused')) { if (!event.repeat && !paused && state.phase !== 'paused') pause(); return; }
    if (!controlsActive() || isFormTarget(event.target) || event.isComposing || event.altKey || event.metaKey) return;
    const action = controlForKey(event); if (!action) return;
    event.preventDefault(); const physical = event.code || event.key; if (event.repeat || physicalKeys.has(physical)) return;
    if (/^slot[1-4]$/.test(action) || ['drop', 'swap'].includes(action)) weaponWheel.reset();
    physicalKeys.set(physical, action); keys.add(action); sendInput(currentInput(), true); wake();
  }
  function keyboardUp(event) { const physical = event.code || event.key, action = physicalKeys.get(physical); physicalKeys.delete(physical); if (action && ![...physicalKeys.values()].includes(action)) keys.delete(action); if (action) sendInput(currentInput(), true); }
  function mouseDown(event) {
    if (!controlsActive() || event.sourceCapabilities?.firesTouchEvents || ![0, 2].includes(event.button)) return;
    touchMode = false; event.preventDefault(); canvas.focus({ preventScroll: true }); mouse[event.button === 0 ? 'fire' : 'aim'] = true; sendInput(currentInput(), true); if (!locked()) { fallback = true; requestCapture(); } wake();
  }
  function mouseUp(event) { if (event.sourceCapabilities?.firesTouchEvents) return; const action = event.button === 0 ? 'fire' : event.button === 2 ? 'aim' : null; if (action) { mouse[action] = false; if (entered) sendInput(currentInput(), true); } }
  function mouseMove(event) { if (!controlsActive() || !locked() && (!fallback || !mouse.fire && !mouse.aim || event.target !== canvas)) return; const multiplier = aimLookMultiplier(presentationPlayer || localPlayer(), ADS); aim = cleanAim(aim.yaw + finite(event.movementX) * LOOK_SENSITIVITY * multiplier, aim.pitch - finite(event.movementY) * LOOK_SENSITIVITY * multiplier); sendInput(); wake(); }
  function touchDown(event) {
    const element = event.target.closest?.('[data-horde-action],[data-horde-pad]'); if (!element || !controlsActive()) return;
    event.preventDefault(); const action = element.dataset.hordeAction, pad = element.dataset.hordePad;
    if (action) { if (/^slot[1-4]$/.test(action) || ['drop', 'swap'].includes(action)) weaponWheel.reset(); const wasHeld = currentInput()[action], pointer = { element, action, pressSeq: null }; actionPointers.set(event.pointerId, pointer); touch.actions.add(action); const sent = sendInput(currentInput(), true); if (!wasHeld && FPS_EDGE_ACTIONS.includes(action)) pointer.pressSeq = sent; element.classList.add('pressed'); element.setAttribute('aria-pressed', 'true'); }
    else { if ([...padPointers.values()].some(pointer => pointer.pad === pad)) return; padPointers.set(event.pointerId, { element, pad }); touchMove(event); }
    try { element.setPointerCapture(event.pointerId); } catch {} wake();
  }
  function touchMove(event) {
    const pointer = padPointers.get(event.pointerId); if (!pointer || !controlsActive()) return; event.preventDefault(); const rect = pointer.element.getBoundingClientRect(), radius = Math.max(15, rect.width * .35);
    let x = (event.clientX - rect.left - rect.width / 2) / radius, y = (event.clientY - rect.top - rect.height / 2) / radius, length = Math.hypot(x, y); if (length > 1) { x /= length; y /= length; }
    const before = currentInput(); touch[pointer.pad] = { x, y }; pointer.element.querySelector('i').style.transform = `translate(${x * radius}px,${y * radius}px)`;
    const after = currentInput(); sendInput(after, engine.INPUT_KEYS.some(action => before[action] !== after[action]));
  }
  function touchEnd(event) {
    const action = actionPointers.get(event.pointerId), pad = padPointers.get(event.pointerId); if (!action && !pad) return;
    const pointer = action || pad;
    if (action) { actionPointers.delete(event.pointerId); const cancelPress = releaseFpsTouchAction(action, actionPointers, touch.actions, name => currentInput()[name], event.type !== 'pointerup'); if (![...actionPointers.values()].some(other => other.action === action.action)) action.element.setAttribute('aria-pressed', 'false'); sendInput(currentInput(), true, performance.now(), false, cancelPress); }
    if (pad) { padPointers.delete(event.pointerId); touch[pad.pad] = { x: 0, y: 0 }; pad.element.querySelector('i').style.transform = 'translate(0,0)'; sendInput(currentInput(), true); }
    try { if (pointer.element.hasPointerCapture?.(event.pointerId)) pointer.element.releasePointerCapture(event.pointerId); } catch {}
  }
  function graphics() {
    if (destroyed) return; worldLabels.clear(); renderer?.destroy(); renderer = null; graphicsError = '';
    try { renderer = new rendererClass(canvas); if (!renderer.available) throw new Error(renderer.error || 'WebGL is unavailable.'); error(''); updateHUD(true); draw(); }
    catch (cause) { graphicsError = cause?.message || 'Enable hardware acceleration to run Voxel Last Stand.'; error(graphicsError); updateHUD(true); }
  }
  let rendererClass;
  function destroy() {
    if (destroyed) return; clearInputs(); destroyed = true; endPresentation.reset(); pendingResultFocus = false; weaponArmory.destroy(); stopFrame(); clearTimeout(reconnectTimer); clearInterval(heartbeat); unlock(); socket?.close(); for (const remove of listeners) remove(); unsubscribe(); picker.destroy(); audio.destroy(); inventory.destroy(); weaponWheel.destroy(); renderer?.destroy(); worldLabels.destroy(); movement.clear(); pending = []; snapshots = [];
  }
  const unsubscribe = subscribeKeyboardLayout(() => { clearInputs(); hints(); });
  text('horde-mode', solo ? 'SOLO SURVIVAL' : '1–3 PLAYER CO-OP'); text('horde-room-code', roomId); $('horde-name').value = getName(); hide('horde-name-field', solo); hide('horde-lobby', solo); hide('horde-map-field', !solo); hide('horde-difficulty-field', !solo);
  text('horde-start-label', solo ? 'Start survival' : 'Start squad survival'); if (!solo) text('horde-setup-copy', 'One squad, up to three players. Everyone readies; the host starts. Clear waves to recover, share supplies, and bring fallen teammates back.');
  populateWeaponSelect($('horde-weapon')); $('horde-weapon').value = 'carbine';
  const weaponArmory = mountWeaponArmory({ select: $('horde-weapon'), title: 'Choose your starting weapon', portalContainer: $('horde-shell') });
  const weaponDetails = document.createElement('details'); weaponDetails.className = 'arsenal-fold';
  const detailSummary = document.createElement('summary'); detailSummary.textContent = 'Weapon damage and handling';
  const detailCard = document.createElement('section'); detailCard.id = 'horde-weapon-details'; detailCard.setAttribute('aria-label', 'Selected weapon statistics');
  weaponDetails.append(detailSummary, detailCard); $('horde-weapon-note').after(weaponDetails);
  weaponDetails.hidden = true; $('horde-weapon-note').hidden = true;
  function weaponNote() { text('horde-weapon-note', WEAPONS[$('horde-weapon').value]?.description || ''); renderWeaponDetails(detailCard, $('horde-weapon').value); }
  listen($('horde-setup'), 'submit', event => { event.preventDefault(); if (solo) startSolo(); else { if (!hordeLobbyPresentation(state, roster, playerId, hostId, connected).canStart) return; clearInputs(); entered = true; paused = false; canvas.focus({ preventScroll: true }); requestCapture(); send({ type: 'start' }); } });
  for (const id of ['horde-map', 'horde-difficulty']) listen($(id), 'change', preview);
  for (const id of ['horde-weapon']) listen($(id), 'change', () => { weaponNote(); if (solo) preview(); else send({ type: 'fps-loadout', weaponId: $('horde-weapon').value, meleeId: 'knife' }); });
  listen($('horde-name'), 'change', () => { $('horde-name').value = saveName($('horde-name').value); send({ type: 'join', name: $('horde-name').value }); });
  listen($('horde-ready'), 'click', () => { const lobby = hordeLobbyPresentation(state, roster, playerId, hostId, connected); send({ type: 'ready', ready: !lobby.ready }); });
  listen($('horde-pause'), 'click', () => paused || state?.phase === 'paused' ? resume() : pause()); listen($('horde-touch-pause'), 'click', pause); listen($('horde-resume'), 'click', resume); listen($('horde-enter'), 'click', enter);
  function changeSetup() { if (!solo || observeEnd().holding) return; preview(); weaponArmory.focus(); }
  listen($('horde-restart'), 'click', startSolo); listen($('horde-replay'), 'click', () => { if (observeEnd().holding || state?.phase !== 'matchEnd') return; if (solo) startSolo(); else if (playerId === hostId) send({ type: 'rematch' }); }); listen($('horde-change-setup'), 'click', changeSetup); listen($('horde-result-setup'), 'click', changeSetup);
  listen($('horde-help'), 'click', showHelp); listen($('horde-guide-close'), 'click', hideHelp); listen($('horde-guide-back'), 'click', hideHelp); listen($('horde-retry'), 'click', graphics);
  listen($('horde-sound'), 'click', async () => { const enabled = await audio.setEnabled(!audio.enabled); $('horde-sound').setAttribute('aria-pressed', String(enabled)); $('horde-sound').setAttribute('aria-label', enabled ? 'Mute sound' : 'Enable sound'); });
  listen($('horde-fullscreen'), 'click', async () => { if (running()) pause(); try { if (document.fullscreenElement) await document.exitFullscreen(); else await shell.requestFullscreen(); } catch { feedback('Fullscreen is unavailable in this browser.'); } });
  listen($('horde-copy-invite'), 'click', async () => { try { await copyText(invite); text('horde-copy-invite', 'Copied ✓'); setTimeout(() => { if (!destroyed) text('horde-copy-invite', 'Copy invite ↗'); }, 1800); } catch (cause) { error(cause.message); } });
  listen($('horde-spectator-next'), 'click', () => { const participants = new Set(state?.horde?.participantIds || []), alive = state.players.filter(player => player.team === 0 && player.alive && participants.has(player.id)); spectatorId = alive[(alive.findIndex(player => player.id === spectatorId) + 1) % Math.max(1, alive.length)]?.id; draw(); updateHUD(true); });
  listen(window, 'keydown', keyboardDown); listen(window, 'keyup', keyboardUp); listen(window, 'mousemove', mouseMove); listen(canvas, 'mousedown', mouseDown); listen(window, 'mouseup', mouseUp); listen(canvas, 'contextmenu', event => event.preventDefault());
  listen(document, 'pointerdown', event => { if (event.pointerType === 'touch') touchMode = true; else if (event.pointerType === 'mouse') touchMode = false; }, true);
  listen($('horde-touch'), 'pointerdown', touchDown); listen(window, 'pointermove', touchMove); listen(window, 'pointerup', touchEnd); listen(window, 'pointercancel', touchEnd); listen($('horde-touch'), 'lostpointercapture', touchEnd);
  listen(document, 'pointerlockchange', () => { if (locked()) { if (paused || modalOpen || !entered) { unlock(); return; } fallback = false; hints(); updateHUD(true); wake(); } else if (controlsActive() || entered && !paused && running()) pause(); }); listen(document, 'pointerlockerror', () => { if (!paused && !modalOpen && entered) { fallback = true; hints(); updateHUD(true); } });
  let wasFullscreen = document.fullscreenElement === shell;
  listen(document, 'fullscreenchange', () => { const full = document.fullscreenElement === shell; if (wasFullscreen && !full && running() && !paused) pause(); wasFullscreen = full; $('horde-fullscreen').setAttribute('aria-pressed', String(full)); $('horde-fullscreen').setAttribute('aria-label', full ? 'Exit fullscreen' : 'Enter fullscreen'); renderer?.resize(); draw(); });
  listen(window, 'resize', () => { renderer?.resize(); if (!running()) draw(); }); listen(window, 'blur', () => { if (running()) pause(); else clearInputs(); }); listen(document, 'visibilitychange', () => { if (document.hidden) { endPresentation.reset(); endView = observeEnd(); if (LIVE_PHASES.includes(state?.phase)) pause(); else { stopFrame(); clearInputs(); } } else { updateHUD(true); draw(); wake(); } }); listen(window, 'pagehide', destroy);
  listen(canvas, 'voxel-renderer-error', event => { graphicsError = event.detail?.message || ''; if (graphicsError) { if (LIVE_PHASES.includes(state?.phase)) pause(); error(graphicsError); } else { error(''); renderer?.resize(); updateHUD(true); draw(); } });
  listen(canvas, 'voxel-renderer-restored', () => { graphicsError = ''; error(''); renderer?.resize(); updateHUD(true); draw(); wake(); });
  hints(); weaponNote(); updateHUD(true);
  try {
    const [rules, visual] = await Promise.all([import('./voxel-horde-engine.js'), import('./voxel-renderer.js')]); if (destroyed) return null; engine = rules; rendererClass = visual.VoxelRenderer;
    for (const [id, map] of Object.entries(engine.MAPS)) { const option = document.createElement('option'); option.value = id; option.textContent = map.name; $('horde-map').append(option); }
    $('horde-map').value = Object.hasOwn(engine.MAPS, params.get('map')) ? params.get('map') : 'courtyard'; $('horde-difficulty').value = params.get('difficulty') === 'nightmare' ? 'nightmare' : 'veteran';
    if (solo) preview(); graphics(); if (!solo) { connect(); hostInfo().then(info => { invite = `${info.origin}/voxel-horde.html?room=${encodeURIComponent(roomId)}`; }).catch(() => {}); }
  } catch (cause) { graphicsError = cause?.message || 'The game could not load.'; error(`Voxel Last Stand could not load: ${graphicsError}`); }
  heartbeat = setInterval(() => { if (!solo && connected && !document.hidden && LIVE_PHASES.includes(state?.phase)) sendInput(); }, 50);
  const inspect = () => copy({ state: state ? { ...state, map: undefined, fighters: undefined } : null, solo, playerId, hostId, aim, input: currentInput(), paused: paused || state?.phase === 'paused', connected, roomPlayers: roster, pendingInputs: pending, queuedActions: inputQueue.inspect(), presentationPlayer, presentationPlayers, ending: { ...endView }, controls: { pointerLocked: locked(), fallback, touch: touchMode, entered, modalOpen }, renderCount, crosshair: reticleView, renderStats: renderer?.stats || null, worldLabels: worldLabels.inspect(), audio: audio.inspectGunshots(), meleeAudio: audio.inspectMelee(), meleeImpactAudio: meleeImpacts.inspect(), reloadAudio: reloadAudio.inspect(), reloadSounds: audio.inspectReloads(), gunImpactAudio: gunImpacts.inspect(), parryAudio: parryAudio.inspect(), parrySounds: audio.inspectParries(), stamina: staminaView, weaponWheel: weaponWheel.inspect(), monsterAudio: audio.inspectMonsters(), graphicsError, displayTiming: { physicsSamples, renderSamples: renderCount, lastFraction }, timeline: timeline.getState(), spectatorId });
  window.semagHorde = Object.freeze({ getState: inspect, getDebugState: inspect, getDisplayTiming: () => ({ physicsSamples, renderSamples: renderCount, lastFraction }) });
  return { destroy, inspect };
}

if (typeof document !== 'undefined' && document.getElementById('horde-app')) bootHorde().catch(cause => { const banner = document.getElementById('horde-error'); banner.hidden = false; document.getElementById('horde-error-text').textContent = `Voxel Last Stand could not load: ${cause.message}`; });
