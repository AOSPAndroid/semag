import { secondaryActionPresentation, paintSecondaryAction, staminaPresentation, paintStamina, createReloadAudioPresenter, createGunImpactReporter, createParryAudioReporter } from './voxel-fps-feedback.js';
import { GameAudio } from './audio.js';
import { gameKey, displayKey, getKeyboardLayout, mountKeyboardLayoutPicker, subscribeKeyboardLayout } from './keyboard-layout.js';
import { ADS, HEAL, PLAYER_HEALTH, predictLocalMovement, findNearbyLoot as findNearbyBreachLoot } from './voxel-engine.js';
import { MAPS as BREACH_MAPS } from './voxel-maps.js';
import { MAPS as ROYALE_MAPS } from './voxel-royale-maps.js';
import { findNearbyLoot } from './voxel-royale-engine.js';
import { WEAPONS } from './voxel-weapons.js';
import { MELEE_WEAPONS } from './voxel-melee.js';
import { VoxelRenderer } from './voxel-renderer.js';
import { createMovementPresenter, combatPresentation, withCombatPresentation, resolvePresentationContacts } from './voxel-presentation.js';
import { cleanAim, composeInput, controlForKey, aimFraction, aimLookMultiplier, combatReadout, isFormTarget, hasGunshotReport, combatEventPerspective, createMeleeImpactReporter, LOOK_SENSITIVITY, populateWeaponSelect, renderWeaponDetails, weaponCrosshairSpread } from './voxel-client.js';
import { incomingDamageFeedback, damageFeedbackPresentation } from './voxel-damage-feedback.js';
import { createHitFeedback, paintHitFeedback } from './voxel-hit-feedback.js';
import { setHidden, setAttribute, setStyle, setDisabled } from './hub/dom.js';
import { createPractice, startPractice, stepPractice, pausePractice, resumePractice, getPracticeStats, TICK_RATE } from './voxel-practice-engine.js';
import { tickFraction } from './display-timing.js';
import { createPracticeInputQueue } from './voxel-practice-input.js';
import { DOJO_MAP } from './voxel-dojo-map.js';
import { DOJO_ACTIONS, findDojoStation, findDojoStationLoot } from './voxel-dojo-engine.js';
import { inventoryLootPresentation, inventoryEventFeedback, inventorySwapPresentation, mountInventoryHotbar, mountWeaponWheel } from './voxel-inventory-ui.js';

const STEP = 1 / TICK_RATE;

/** Coalesce only wheel-owned presses; keyboard and touch keep their own tokens. */
export function createPracticeWheelDispatch(queue, getInput, wake = () => {}) {
  const inventoryActions = ['slot1', 'slot2', 'slot3', 'slot4', 'drop', 'swap'];
  let token = null;
  const cancel = () => { if (token) queue.cancel(token); token = null; };
  return {
    cancel,
    dispatch(action) {
      const input = getInput(); cancel();
      const pending = queue.inspect();
      if (inventoryActions.some(action => input[action] || pending[action] > 0)) return false;
      token = queue.press(action, input); wake(); return !!token;
    },
  };
}
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const copy = value => JSON.parse(JSON.stringify(value));
const clock = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

/** Finish one action contact without erasing other held sources or valid taps. */
export function releasePracticeTouchAction(pointer, pointers, actions, inputQueue, isHeld, cancelled = false) {
  if (!pointer.action) return;
  const others = [...pointers.values()].filter(other => other.action === pointer.action);
  if (!others.length) {
    actions.delete(pointer.action);
    if (!isHeld(pointer.action)) {
      if (cancelled) inputQueue.cancel(pointer.token);
      inputQueue.release(pointer.action);
    }
    pointer.target.setAttribute('aria-pressed', 'false');
  } else if (cancelled && pointer.token) {
    // Preserve the aggregate hold; a final cancelled finger may still
    // withdraw the original press if physics has not consumed it yet.
    others[0].token = pointer.token;
  } else if (!cancelled) {
    // Any valid release preserves the aggregate tap, even when its original
    // token belongs to a different finger that subsequently loses capture.
    for (const other of others) other.token = null;
  }
}

export function bootPractice() {
  const elements = new Map();
  const $ = id => { if (!elements.has(id)) elements.set(id, document.getElementById(id)); return elements.get(id); };
  const app = $('practice-app'), canvas = $('practice-canvas'), shell = $('practice-shell');
  if (!app || !canvas) return null;
  const params = new URLSearchParams(location.search), game = params.get('game') === 'voxel-royale' ? 'voxel-royale' : 'voxel';
  const royale = game === 'voxel-royale', dojo = !royale && params.get('mode') === 'dojo', maps = dojo ? { dojo: DOJO_MAP } : royale ? ROYALE_MAPS : BREACH_MAPS;
  let renderer = null, graphicsError = '', destroyed = false, frameId = null, previousFrame = null, accumulator = 0;
  let state, aim = { yaw: 0, pitch: 0 }, previousPlayers = [], presentationPlayer = null, lastHudAt = -Infinity, lastPhase = '';
  const hitFeedback = createHitFeedback(), hitMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const hitElements = { crosshair: $('practice-crosshair'), scope: $('practice-scope'), marker: $('practice-hit') };
  let urgentHud = '', eventCursor = 0, feedbackUntil = 0, damageFeedback = null, lastDrawAt = 0, fallback = false, modalOpen = false;
  let renderCount = 0, physicsSamples = 0, lastFraction = 0, activeSession = false, lastCountdown = null, returnFocus = null, dojoToolsOpen = false;
  const listeners = [], keys = new Set(), physicalKeys = new Map(), mouse = { fire: false, aim: false }, inputQueue = createPracticeInputQueue({ extraActions: dojo ? DOJO_ACTIONS : [] });
  const touch = { move: { x: 0, y: 0 }, look: { x: 0, y: 0 }, actions: new Set() }, pointers = new Map(), movement = new Map();
  const audio = new GameAudio(), picker = mountKeyboardLayoutPicker($('practice-keyboard'), { id: 'practice-keyboard-select' });
  const meleeImpacts = createMeleeImpactReporter(audio), gunImpacts = createGunImpactReporter(audio), parryAudio = createParryAudioReporter(audio);
  const reloadAudio = createReloadAudioPresenter(audio), staminaElements = { meter: $('practice-stamina-meter'), fill: $('practice-stamina-fill') };
  let staminaView = staminaPresentation(null, { active: false });
  function paintVitals(player, name = 'Your', active = true) { staminaView = staminaPresentation(player, { name, active }); paintStamina(staminaElements.meter, staminaElements.fill, staminaView); }
  // Secondary touch hardware does not decide how a player uses the mouse.
  let touchMode = matchMedia('(pointer: coarse)').matches;
  const setText = (id, value) => { const element = $(id); if (element.textContent !== String(value)) element.textContent = String(value); };
  const listen = (target, name, callback, options) => { target.addEventListener(name, callback, options); listeners.push(() => target.removeEventListener(name, callback, options)); };
  const locked = () => document.pointerLockElement === canvas;
  const active = () => !destroyed && !modalOpen && ['countdown', 'fight'].includes(state?.phase);
  const currentInput = () => ({ ...composeInput(keys, touch, mouse, aim, active()), ...(dojo ? { dojoWeapon: $('dojo-weapon').value, dojoBlade: $('dojo-blade').value, dojoTools: dojoToolsOpen } : {}) });
  const wheelInput = createPracticeWheelDispatch(inputQueue, currentInput, wake);
  const weaponWheel = mountWeaponWheel(canvas, {
    context: () => ({ player: state?.players?.[0], active: active() && state?.phase === 'fight' && !graphicsError && !!renderer?.available && !document.hidden, pointerLocked: locked(), fallback, crouchHeld: keys.has('crouch') }),
    cancelPending: wheelInput.cancel,
    dispatch: wheelInput.dispatch,
  });
  const inventory = mountInventoryHotbar($('practice-inventory'), actions => {
    if (!active() || state?.phase !== 'fight') return;
    weaponWheel.reset();
    for (const action of actions) inputQueue.press(action, currentInput());
    canvas.focus({ preventScroll: true }); wake();
  });
  const mapMarkers = new Map(); let playerMarker, stormMarker;

  setText('practice-title', royale ? 'Voxel Royale' : 'Voxel Breach'); document.title = `${royale ? 'Voxel Royale' : 'Voxel Breach'} Practice — Semag`;
  if (royale) { setText('practice-setup-title', 'Find your next opening.'); setText('practice-setup-copy', 'Start with a knife. Scavenge the real maps while bots move, loot and fight for the last safe ground.'); setHidden($('practice-loadout-field'), true); setHidden($('practice-melee-field'), true); setHidden($('practice-melee-note'), true); }
  if (royale) $('practice-mode').querySelector('option[value="blades"]')?.remove();
  setHidden($('practice-blade-guide'), royale);
  if (dojo) {
    setText('practice-title', 'Voxel Dojo'); setText('practice-subtitle', 'WEAPONS LAB'); document.title = 'Voxel Dojo — Semag';
    const option = document.createElement('option'); option.value = 'dojo'; option.textContent = 'Equipment sandbox'; $('practice-mode').append(option); $('practice-mode').value = 'dojo';
    setHidden($('practice-mode-field'), true); setHidden($('practice-difficulty-field'), true); setHidden($('dojo-motion-field'), false);
    $('practice-count').value = '5'; setText('practice-online', 'Back to hub ↗'); $('practice-online').href = '/';
    setText('practice-start', 'Enter dojo →');
  }
  try { const target = new URL(params.get('return') || '/', location.origin); if (target.origin === location.origin && /^\/(?:voxel(?:-royale)?(?:\/|\.html|$)|$)/.test(target.pathname)) $('practice-online').href = target.href; } catch {}
  for (const [id, map] of Object.entries(maps)) { const option = document.createElement('option'); option.value = id; option.textContent = map.name; $('practice-map').append(option); }
  $('practice-map').value = dojo ? 'dojo' : Object.hasOwn(maps, params.get('map')) ? params.get('map') : royale ? 'forest' : 'courtyard';
  populateWeaponSelect($('practice-weapon'));
  for (const [id, blade] of Object.entries(MELEE_WEAPONS)) { const option = document.createElement('option'); option.value = id; option.textContent = blade.name; $('practice-blade').append(option); }
  $('practice-blade').value = dojo ? 'knife' : 'sword';
  populateWeaponSelect($('dojo-weapon'));
  for (const [id, blade] of Object.entries(MELEE_WEAPONS)) { const option = document.createElement('option'); option.value = id; option.textContent = blade.name; $('dojo-blade').append(option); }
  $('dojo-weapon').value = 'carbine'; $('dojo-blade').value = 'knife';
  const weaponDetails = document.createElement('details'); weaponDetails.className = 'arsenal-fold'; weaponDetails.hidden = royale;
  const detailSummary = document.createElement('summary'); detailSummary.textContent = 'Weapon damage and handling';
  const detailCard = document.createElement('section'); detailCard.id = 'practice-weapon-details'; detailCard.setAttribute('aria-label', 'Selected weapon statistics');
  weaponDetails.append(detailSummary, detailCard); $('practice-weapon-note').after(weaponDetails);
  $('practice-weapon').value = 'carbine';
  function config() { return { game, mapId: $('practice-map').value, bots: Number($('practice-count').value), mode: $('practice-mode').value, difficulty: $('practice-difficulty').value, weapon: $('practice-weapon').value, melee: !royale && ['blades', 'dojo'].includes($('practice-mode').value) ? $('practice-blade').value : 'knife', ...(dojo ? { targetMotion: $('dojo-start-motion').value } : {}) }; }
  function hints() {
    const layout = getKeyboardLayout(); app.dataset.keyboardLayout = layout;
    setText('practice-move-keys', displayKey('WASD')); setText('practice-grenade-key', displayKey('Q')); setText('practice-guide-grenade', displayKey('Q'));
    canvas.setAttribute('aria-label', `First-person ${royale ? 'Royale' : 'Breach'} practice. ${displayKey('WASD')} or arrows move, mouse looks, left click or B / J uses your selected item, right click aims guns, stabs with a knife or parries with other blades, Space jumps, Control crouches, Shift sprints, C walks quietly, R reloads, 1 to 4 equip inventory slots, wheel up or down switches carried weapons, X drops your selected item, V switches blade, ${displayKey('Q')} throws a grenade, F heals, E picks up supplies, Escape pauses.`);
    setText('practice-look-hint', dojo ? `TAB RANGE TOOLS · ${displayKey('WASD')} MOVE · ESC PAUSE` : fallback ? 'DRAG TO LOOK · ESC PAUSE' : `${displayKey('WASD')} MOVE · RMB SECONDARY · ESC PAUSE`);
  }
  function stopFrame() { if (frameId !== null) cancelAnimationFrame(frameId); frameId = null; previousFrame = null; accumulator = 0; }
  function release() {
    weaponWheel.reset();
    reloadAudio.suspend(); paintVitals(null, 'Your', false);
    hitFeedback.reset(); paintHitFeedback(hitElements, { visible: false });
    inputQueue.reset();
    keys.clear(); physicalKeys.clear(); mouse.fire = mouse.aim = false; touch.move = { x: 0, y: 0 }; touch.look = { x: 0, y: 0 }; touch.actions.clear();
    for (const [id, value] of pointers) try { if (value.target.hasPointerCapture?.(id)) value.target.releasePointerCapture(id); } catch {}
    pointers.clear();
    for (const pad of document.querySelectorAll('[data-practice-pad]')) pad.querySelector('i').style.transform = 'translate(0,0)';
    for (const button of document.querySelectorAll('[data-practice-action]')) button.setAttribute('aria-pressed', 'false');
    paintSecondaryAction(document.querySelector('[data-practice-action="aim"]'), secondaryActionPresentation(null, { active: false }));
  }
  function unlock() { if (locked()) document.exitPointerLock?.(); }
  function setDojoTools(open) {
    if (!dojo || !activeSession || state.phase !== 'fight') return;
    dojoToolsOpen = open; setHidden($('dojo-tools'), !open); setAttribute($('dojo-tools-toggle'), 'aria-expanded', String(open));
    release();
    if (open) { unlock(); $('dojo-weapon').focus({ preventScroll: true }); }
    else { canvas.focus({ preventScroll: true }); inputQueue.reset({ neutral: true }); requestCapture(); }
    updateHud(performance.now(), true); wake();
  }
  function requestCapture() {
    if (touchMode || !canvas.requestPointerLock) { fallback = !touchMode; hints(); return; }
    try { const result = canvas.requestPointerLock(); result?.catch?.(() => { fallback = true; hints(); }); } catch { fallback = true; hints(); }
  }
  function resetView() {
    release(); stopFrame(); previousPlayers = []; presentationPlayer = null; movement.clear(); eventCursor = 0; feedbackUntil = 0; hitFeedback.reset({ clearHistory: true }); damageFeedback = null;
    lastCountdown = null; lastHudAt = -Infinity; lastPhase = ''; renderCount = physicsSamples = 0; lastFraction = 0; audio.resetEvents(); meleeImpacts.reset(); gunImpacts.reset(); parryAudio.reset(); reloadAudio.reset(); renderer?.resetEffects();
    aim = cleanAim(state.players[0]?.yaw, state.players[0]?.pitch); lastDrawAt = performance.now();
    dojoToolsOpen = false; setHidden($('dojo-tools'), true); setAttribute($('dojo-tools-toggle'), 'aria-expanded', 'false');
    if (dojo) { $('dojo-weapon').value = state.practice.config.weapon; $('dojo-blade').value = state.practice.config.melee; }
  }
  function buildRadar() {
    const svg = $('practice-map-plan'), map = state.map, { minX, maxX, minZ, maxZ } = map.bounds;
    svg.replaceChildren(); svg.setAttribute('viewBox', `${minX - 2} ${minZ - 2} ${maxX - minX + 4} ${maxZ - minZ + 4}`); mapMarkers.clear();
    const make = (tag, attrs) => { const element = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, value); svg.append(element); return element; };
    for (const box of map.colliders) if (!box.overhead && box.y >= -.01 && box.h > .25) make('rect', { x: box.x, y: box.z, width: box.w, height: box.d });
    if (royale) stormMarker = make('circle', { class: 'practice-map-storm', cx: state.storm.x, cy: state.storm.z, r: state.storm.radius });
    for (const peer of state.players) if (peer.bot) mapMarkers.set(peer.id, make('circle', { cx: peer.x, cy: peer.z, r: (maxX - minX) / 60 }));
    playerMarker = make('circle', { class: 'practice-map-self', cx: state.players[0].x, cy: state.players[0].z, r: (maxX - minX) / 46 });
  }
  function preview() {
    activeSession = false; modalOpen = false; setHidden($('practice-guide'), true); unlock(); state = createPractice(config()); resetView(); buildRadar();
    const blades = state.practice.config.mode === 'blades';
    setHidden($('practice-blade-field'), !blades && !dojo); setHidden($('practice-melee-field'), royale || blades || dojo);
    if (!royale) {
      setText('practice-setup-title', dojo ? 'Find your favourite weapon.' : blades ? 'Make every cut count.' : 'Make every shot count.');
      setText('practice-setup-copy', dojo ? 'Explore a cedar dojo, try every gun and blade, and test grenades and healing. Targets reset after each kill. Enter when you’re ready.' : blades ? 'Train real cuts against approaching targets. They move and use solid cover, but never attack. Your chosen blade is equipped at Start.' : 'Practice movement and weapon handling against moving targets. Add return fire when you’re ready.');
    }
    setText('practice-weapon-note', royale ? 'Knife start · 200 health · weapons, ammo and healing are found in structures.' : WEAPONS[state.practice.config.weapon].description);
    if (!royale) renderWeaponDetails(detailCard, state.practice.config.weapon);
    setText('practice-melee-note', dojo ? 'Your chosen gun + blade. E uses equipment stations; supplies restock, reserve ammo is unlimited, magazines and reloads stay real. Tab opens range tools.' : royale ? 'Knife only. Collect every gun and supply with E.' : blades ? `Training kit: ${MELEE_WEAPONS[state.practice.config.melee].name} in slot 1, chosen gun in slot 2. No supplies. ${MELEE_WEAPONS[state.practice.config.melee].description}` : 'Knife + chosen gun. Slots 3–4 are empty; E collects blades, guns and supplies.');
    updateHud(performance.now(), true); draw(performance.now());
  }
  function start() {
    if (destroyed || !renderer?.available || modalOpen) return;
    state = createPractice(config()); startPractice(state); activeSession = true; resetView(); buildRadar(); updateHud(performance.now(), true); canvas.focus({ preventScroll: true }); requestCapture(); wake();
  }
  function pause() {
    if (!active()) return; dojoToolsOpen = false; setHidden($('dojo-tools'), true); pausePractice(state); release(); stopFrame(); unlock(); updateHud(performance.now(), true); draw(lastDrawAt); $('practice-resume').focus({ preventScroll: true });
  }
  function resume() {
    if (state?.phase !== 'paused' || modalOpen || !renderer?.available) return; release(); resumePractice(state); previousFrame = null; accumulator = 0; previousPlayers = []; movement.clear();
    inputQueue.reset({ neutral: true }); canvas.focus({ preventScroll: true }); requestCapture(); updateHud(performance.now(), true); wake();
  }
  function setup() { release(); stopFrame(); unlock(); preview(); $('practice-map').focus({ preventScroll: true }); }
  function showHelp() {
    if (modalOpen) return; if (active()) pause(); modalOpen = true; returnFocus = document.activeElement; setHidden($('practice-guide'), false); setAttribute($('practice-help'), 'aria-expanded', 'true'); $('practice-guide-close').focus({ preventScroll: true }); release(); unlock();
  }
  function hideHelp() {
    if (!modalOpen) return; modalOpen = false; setHidden($('practice-guide'), true); setAttribute($('practice-help'), 'aria-expanded', 'false');
    const target = state.phase === 'paused' ? $('practice-resume') : returnFocus; target?.focus?.({ preventScroll: true });
  }
  function feedback(message, now, duration = 900) { setText('practice-feedback', message); feedbackUntil = now + duration; }
  function consumeEvents(now) {
    const freshEvents = [];
    const impactOptions = { lifeKey: `${state.mapId}:${state.practice.sessionId}`, gain: .18 };
    for (const event of state.events) {
      if (event.id <= eventCursor) continue; eventCursor = event.id;
      freshEvents.push(event);
      const perspective = combatEventPerspective(event, 0);
      const meleeImpact = meleeImpacts.consume(event, 0, impactOptions);
      if (event.type === 'damage' && event.damage > 0) {
        const incoming = incomingDamageFeedback(event, state.players[0], state.players, { now, lifeKey: state.practice.sessionId, friendlyFire: royale }); if (incoming) damageFeedback = incoming;
        if (audio.enabled && !meleeImpact && perspective.incoming) audio.tone(140, .055, { end: 70, gain: .18, type: 'triangle' });
      }
      if (['kill', 'elimination'].includes(event.type) && perspective.outgoing) feedback(event.headshot ? 'HEADSHOT · TARGET DOWN' : 'TARGET DOWN', now);
      if (event.type === 'lootPickup' && perspective.source === 0) feedback(event.kind === 'weapon' ? `PICKED UP ${WEAPONS[event.weapon]?.label || 'WEAPON'}` : `PICKED UP ${event.kind.toUpperCase()}`, now);
      const inventoryFeedback = perspective.source === 0 ? inventoryEventFeedback(event) : null; if (inventoryFeedback) feedback(inventoryFeedback, now);
      if (event.type === 'healComplete' && perspective.source === 0) feedback(`HEALED +${Math.round(event.amount || 0)} HP`, now);
      if (event.type === 'healCancel' && perspective.source === 0) feedback('HEALING INTERRUPTED', now);
      if (audio.enabled && event.type === 'meleeStart') audio.meleeSwing(event.weapon, { gain: perspective.source === 0 ? 1 : .28 });
      if (audio.enabled && hasGunshotReport(event)) audio.gunshot(event.weapon, { gain: perspective.source === 0 ? 1 : .28 });
      if (audio.enabled && event.type === 'grenadeExplosion') { audio.noise(.4, { highpass: 40, lowpass: 1500, gain: .3 }); audio.tone(70, .3, { end: 25, gain: .2 }); }
    }
    gunImpacts.consume(freshEvents, 0, { context: `${state.mapId}:${state.practice.sessionId}` });
    parryAudio.consume(freshEvents, 0, { context: `${state.mapId}:${state.practice.sessionId}`, active: active() && state.phase === 'fight' });
    hitFeedback.consume(freshEvents, state.players[0], state.players, { now, lifeKey: `${state.mapId}:${state.practice.sessionId}`, active: state.phase === 'fight' && !modalOpen });
  }
  function updateHud(now, force = false) {
    const phase = state.phase, local = state.players[0];
    const signature = [phase, local.hp, local.alive, local.weapon, local.slot, local.hasGun, local.ammo, local.reserve, local.potions, local.grenades, local.aiming, local.healTicks > 0, local.reloadTicks > 0, local.grenadeThrowTicks > 0, local.shotCooldown > 0, local.burstRemaining > 0, local.meleeWeapon, local.meleePhase, local.pendingMeleeTicks > 0, local.parryTicks > 0, local.parryConsumed, local.parryCooldown > 0, local.kills, local.damageDealt].join(':');
    if (!force && phase === lastPhase && signature === urgentHud && now - lastHudAt < 80) return;
    urgentHud = signature; const changed = phase !== lastPhase; lastPhase = phase; lastHudAt = now; setAttribute(app, 'data-phase', phase);
    const stats = getPracticeStats(state), player = state.players[0], blades = state.practice.config.mode === 'blades', readout = combatReadout(player, WEAPONS, { ADS, HEAL, PLAYER_HEALTH });
    paintVitals(player, 'Your', activeSession && active());
    inventory.update(player, { visible: activeSession && player.alive, interactive: active() && phase === 'fight' });
    const swap = inventorySwapPresentation(player), swapButton = document.querySelector('[data-practice-action="swap"]'); if (swap && swapButton) { swapButton.textContent = swap.label; swapButton.setAttribute('aria-label', swap.ariaLabel); }
    paintSecondaryAction(document.querySelector('[data-practice-action="aim"]'), secondaryActionPresentation(player, { active: active() && phase === 'fight', requireGun: royale }));
    setText('practice-map-label', state.mapName); setText('practice-mode-label', dojo ? 'FREE PRACTICE' : blades ? 'BLADE TRAINING' : state.practice.config.mode === 'targets' ? 'MOVING TARGETS' : 'RETURN FIRE'); setText('practice-bots-left', stats.botsRemaining); setText('practice-hits', dojo ? state.dojo.headContacts + state.dojo.bodyContacts : stats.hits); setText('practice-clock', clock(stats.seconds));
    setHidden($('dojo-tools-toggle'), !dojo || !activeSession); setDisabled($('dojo-tools-toggle'), phase !== 'fight'); setHidden($('dojo-contact'), !dojo || !activeSession);
    if (dojo) {
      const hit = state.dojo.lastHit, station = findDojoStation(state), recovery = findDojoStation(state, 'recovery');
      setText('dojo-contact-kind', hit ? `${hit.kind.toUpperCase()} CONTACT` : 'RANGE READY'); setText('dojo-contact-damage', hit ? `${Math.round(hit.damage * 10) / 10} DMG` : '—'); setText('dojo-contact-distance', hit ? `${hit.distance.toFixed(1)} m · ${WEAPONS[hit.weapon]?.name || MELEE_WEAPONS[hit.weapon]?.name || hit.weapon}` : '10 / 20 / 30 m lanes · Tab tools');
      setAttribute($('dojo-contact'), 'data-kind', hit?.kind || 'ready');
      setAttribute($('dojo-motion'), 'aria-pressed', String(state.dojo.moving)); setText('dojo-motion', state.dojo.moving ? 'Moving targets' : 'Stationary targets');
      setDisabled($('dojo-use-station'), !station || !player.alive); setText('dojo-use-station', station ? `${station.name} · use E` : 'Approach an equipment station');
      setDisabled($('dojo-wound'), !recovery || !player.alive || player.hp <= 60); setDisabled($('dojo-recover'), !recovery || !player.alive);
    }
    setHidden($('practice-overlay'), phase === 'fight'); setHidden($('practice-setup-form'), phase !== 'ready'); setHidden($('practice-pause-card'), phase !== 'paused'); setHidden($('practice-result-card'), phase !== 'matchEnd'); setHidden($('practice-countdown'), phase !== 'countdown');
    setHidden($('practice-combat'), !activeSession); setHidden($('practice-radar'), !activeSession); setDisabled($('practice-pause'), !['fight', 'countdown', 'paused'].includes(phase));
    setText('practice-pause', phase === 'paused' ? '▶' : 'Ⅱ'); setAttribute($('practice-pause'), 'aria-label', phase === 'paused' ? 'Resume practice' : 'Pause practice');
    setDisabled($('practice-start'), !renderer?.available || !!graphicsError);
    setText('practice-health', player.hp); setText('practice-health-max', `/ ${player.maxHp}`); setStyle($('practice-health-fill'), 'width', `${clamp(player.hp / player.maxHp, 0, 1) * 100}%`); setAttribute($('practice-health-rail'), 'aria-valuenow', String(player.hp)); setAttribute($('practice-health-rail'), 'aria-valuemax', String(player.maxHp)); setAttribute($('practice-health-rail'), 'data-low', String(player.hp <= 60));
    setText('practice-grenades', readout.grenades); setText('practice-potions', readout.potions); setText('practice-weapon-name', readout.label); setText('practice-ammo', readout.ammo); setText('practice-reserve', readout.sword || readout.healing || readout.utility ? '' : `/ ${readout.reserve}`); setText('practice-weapon-status', readout.status); setAttribute(document.querySelector('.practice-weapon'), 'data-sword', String(readout.sword || readout.healing || readout.utility));
    setHidden($('practice-action-track'), !readout.progress); if (readout.progress) setStyle($('practice-action-fill'), 'width', `${readout.progress.percent}%`);
    setAttribute($('practice-action-track'), 'aria-label', readout.progress?.label || 'Weapon action'); setAttribute($('practice-action-track'), 'aria-valuenow', String(Math.round(readout.progress?.percent || 0))); setAttribute($('practice-action-track'), 'aria-valuetext', `${((readout.progress?.remaining || 0) / 120).toFixed(1)} seconds remaining`);
    const loot = dojo ? findDojoStationLoot(state) || findNearbyBreachLoot(state, 0) : (royale ? findNearbyLoot : findNearbyBreachLoot)(state, 0), lootView = inventoryLootPresentation(loot, player), recoveryStation = dojo && findDojoStation(state, 'recovery'); setHidden($('practice-pickup'), !lootView && !recoveryStation || phase !== 'fight'); if (lootView) { setText('practice-pickup-name', lootView.name); setText('practice-pickup-detail', displayKey(lootView.detail)); } else if (recoveryStation) { setText('practice-pickup-name', 'Recovery station'); setText('practice-pickup-detail', 'Restore health · Tab for healing test'); }
    if (playerMarker) { setAttribute(playerMarker, 'cx', player.x); setAttribute(playerMarker, 'cy', player.z); }
    for (const [id, marker] of mapMarkers) { const peer = state.players[id]; setAttribute(marker, 'cx', peer.x); setAttribute(marker, 'cy', peer.z); setStyle(marker, 'display', peer.alive && ['targets', 'blades', 'dojo'].includes(state.practice.config.mode) ? '' : 'none'); }
    if (stormMarker && royale) { setAttribute(stormMarker, 'r', state.storm.radius); setStyle(stormMarker, 'display', state.storm.active ? '' : 'none'); }
    setText('practice-objective', phase === 'ready' ? 'Choose your arena. Start when you’re ready.' : phase === 'paused' ? 'All movement and combat paused.' : royale ? `${stats.botsRemaining + (player.alive ? 1 : 0)} survivors · ${state.storm.active ? state.storm.mode === 'shrinking' ? 'Storm closing — move to the ring.' : `Storm closes in ${Math.ceil(state.storm.ticksUntilShrink / TICK_RATE)}s.` : 'Start with a knife. Search for supplies.'}` : blades ? 'Blade training: LMB cuts. Release before the next strike; a late recovery tap queues one cut. RMB stabs or guards. Targets never attack.' : state.practice.config.mode === 'targets' ? 'Targets move and use solid cover. Track, counter-strafe and settle before firing.' : 'Bots react to sight and shoot in bursts. Use cover and choose your timing.');
    if (dojo && phase === 'fight') setText('practice-objective', player.alive ? 'E equipment stations · R reload · F potion · Q frag · Tab range tools · targets reset after 2 seconds' : 'Training accident. Returning you to the entrance in two seconds.');
    if (phase === 'countdown') { const seconds = Math.ceil(state.phaseTicks / TICK_RATE); setText('practice-countdown-value', seconds); setText('practice-countdown-copy', royale ? 'Knife first. Find cover and supplies.' : blades ? 'Your blade is equipped. Step in and time each cut.' : 'Read the cover. Settle your aim.'); if (seconds !== lastCountdown) { lastCountdown = seconds; audio.countdown(seconds); } }
    if (phase === 'fight' && changed) audio.fight();
    if (phase === 'matchEnd') {
      const won = stats.result === 'won'; setText('practice-result-tag', won ? royale ? 'LAST SURVIVOR' : 'DRILL CLEARED' : stats.result === 'timeout' ? 'TIME LIMIT' : 'RUN ENDED'); setText('practice-result-title', won ? blades ? 'Clean cuts.' : 'Clean angles.' : 'Find the next opening.');
      setText('practice-result-copy', blades ? `${stats.damageDealt} damage dealt · ${stats.landedSwings} of ${stats.swings} cuts connected. Try another blade or more targets.` : `${stats.damageDealt} damage dealt · ${stats.damageTaken} damage taken. ${won ? 'Try a harder pace or a different weapon.' : 'Change your route, settle your aim and protect your reloads.'}`);
      setText('practice-result-accuracy-label', blades ? 'CUT ACCURACY' : 'ACCURACY');
      setText('practice-result-kills', stats.kills); setText('practice-result-accuracy', `${Math.round(stats.accuracy)}%`); setText('practice-result-time', clock(stats.seconds));
      if (changed) { release(); unlock(); stopFrame(); $('practice-replay').focus({ preventScroll: true }); }
    }
  }
  function draw(now = performance.now()) {
    if (destroyed || !renderer?.available) { reloadAudio.suspend(); paintVitals(null, 'Your', false); return; } const live = active(); if (live) lastDrawAt = now;
    const view = { ...state, players: state.players.map(player => {
      let pose = player;
      if (state.phase === 'fight' && player.alive) { if (!movement.has(player.id)) movement.set(player.id, createMovementPresenter()); pose = movement.get(player.id)(player, player.id === 0 ? inputQueue.preview(currentInput()) : player.previousInput, state.map, accumulator, predictLocalMovement, state.players); }
      return withCombatPresentation(pose, combatPresentation(player, previousPlayers[player.id] || player, 1, live ? accumulator * 1000 : 0));
    }) };
    // Fractional player endpoints share one collision-safe rendered world.
    // The camera follows that same body batch without changing real combat.
    view.players = resolvePresentationContacts(view.players, state.map);
    view.fighters = view.players; presentationPlayer = view.players[0]; renderer.render(view, { acceptedPlayers: state.players, playerId: 0, localId: 0, localPlayer: presentationPlayer, cameraPlayer: presentationPlayer, yaw: aim.yaw, pitch: aim.pitch + (presentationPlayer.recoil || 0), time: live ? now : lastDrawAt }); renderCount++; lastFraction = tickFraction(accumulator, STEP);
    paintVitals(presentationPlayer, 'Your', activeSession && active());
    reloadAudio.observe(state.players[0], { tick: state.tick, context: `${state.mapId}:${state.practice.sessionId}`, active: active() && state.phase === 'fight' });
    const scoped = state.phase === 'fight' && presentationPlayer.alive && !modalOpen && presentationPlayer.slot !== 'sword' && WEAPONS[presentationPlayer.weapon]?.scoped && aimFraction(presentationPlayer, ADS.ticks) >= 14 / 18;
    const spread = weaponCrosshairSpread(presentationPlayer, ADS); const ads = aimFraction(presentationPlayer, ADS.ticks);
    const size = presentationPlayer.slot === 'sword' ? 18 : Math.round(20 - ads * 8 + Math.min(60, spread * canvas.clientHeight * 2));
    setStyle($('practice-crosshair'), 'width', `${size}px`); setStyle($('practice-crosshair'), 'height', `${size}px`);
    setHidden($('practice-scope'), !scoped); setHidden($('practice-crosshair'), state.phase !== 'fight' || modalOpen || scoped || presentationPlayer.healing);
    paintHitFeedback(hitElements, hitFeedback.present(state.players[0], { now, lifeKey: `${state.mapId}:${state.practice.sessionId}`, active: state.phase === 'fight' && !modalOpen, reducedMotion: hitMotion.matches })); setHidden($('practice-feedback'), now >= feedbackUntil || state.phase !== 'fight');
    const cue = damageFeedbackPresentation(damageFeedback, state.players[0], { now, lifeKey: state.practice.sessionId, yaw: aim.yaw, active: state.phase === 'fight' }), element = $('practice-damage');
    setHidden(element, !cue.visible);
    if (cue.visible) {
      setAttribute(element, 'data-kind', cue.kind); setAttribute(element, 'data-direction', cue.direction);
      for (const [name, value] of [['--damage-opacity', String(cue.opacity)], ['--damage-angle', `${cue.angle || 0}rad`]]) if (element.style.getPropertyValue(name) !== value) element.style.setProperty(name, value);
    }
  }
  function frame(now) {
    weaponWheel.flush();
    frameId = null; if (!active()) return;
    const dt = previousFrame === null ? 0 : clamp((now - previousFrame) / 1000, 0, .1); previousFrame = now;
    if (touch.look.x || touch.look.y) { const multiplier = aimLookMultiplier(presentationPlayer || state.players[0], ADS); aim = cleanAim(aim.yaw + touch.look.x * dt * 2.6 * multiplier, aim.pitch - touch.look.y * dt * 2.2 * multiplier); }
    accumulator += dt; let ticks = 0;
    while (accumulator >= STEP && ticks++ < 24 && active()) {
      previousPlayers = state.players.map(player => ({ ...player }));
      const phase = state.phase, held = currentInput();
      stepPractice(state, phase === 'fight' ? inputQueue.sample(held) : held);
      if (phase === 'countdown' && state.phase === 'fight') inputQueue.reset({ held: currentInput() });
      accumulator -= STEP; physicsSamples++;
    }
    consumeEvents(now); updateHud(now); draw(now); if (active()) wake();
  }
  function wake() { if (!destroyed && active() && frameId === null) frameId = requestAnimationFrame(frame); }
  function keyboardDown(event) {
    if (modalOpen) {
      if (event.key === 'Escape') { event.preventDefault(); hideHelp(); return; }
      if (event.key === 'Tab') { const buttons = [...$('practice-guide').querySelectorAll('button:not(:disabled),a[href],[tabindex="0"]')]; const index = buttons.indexOf(document.activeElement); if (event.shiftKey && index <= 0) { event.preventDefault(); buttons.at(-1)?.focus(); } else if (!event.shiftKey && index === buttons.length - 1) { event.preventDefault(); buttons[0]?.focus(); } }
      return;
    }
    if (dojo && event.key === 'Tab' && active() && state.phase === 'fight' && (!dojoToolsOpen || event.target === canvas)) { event.preventDefault(); if (!event.repeat) setDojoTools(!dojoToolsOpen); return; }
    if (event.key === 'Escape' && ['fight', 'countdown', 'paused'].includes(state.phase)) { event.preventDefault(); if (!event.repeat && state.phase !== 'paused') pause(); return; }
    if (!active() || isFormTarget(event.target) || event.isComposing || event.altKey || event.metaKey) return;
    const action = controlForKey(event);
    if (!action) return; event.preventDefault(); const physical = event.code || event.key; if (event.repeat && !physicalKeys.has(physical)) return;
    if (/^slot[1-4]$/.test(action) || ['drop', 'swap'].includes(action)) weaponWheel.reset();
    const wasHeld = currentInput()[action]; physicalKeys.set(physical, action); keys.add(action);
    if (state.phase === 'fight' && !wasHeld) inputQueue.press(action, currentInput()); wake();
  }
  function keyboardUp(event) {
    const physical = event.code || event.key, action = physicalKeys.get(physical); physicalKeys.delete(physical);
    if (action && ![...physicalKeys.values()].includes(action)) keys.delete(action);
    if (action && !currentInput()[action]) inputQueue.release(action);
  }
  function mouseMove(event) {
    if (!active() || event.pointerType === 'touch') return; if (!locked() && (!fallback || !mouse.fire && !mouse.aim || event.target !== canvas)) return;
    const multiplier = aimLookMultiplier(presentationPlayer || state.players[0], ADS); aim = cleanAim(aim.yaw + (event.movementX || 0) * LOOK_SENSITIVITY * multiplier, aim.pitch - (event.movementY || 0) * LOOK_SENSITIVITY * multiplier); wake();
  }
  function mouseDown(event) {
    if (dojo && dojoToolsOpen && active()) { event.preventDefault(); setDojoTools(false); return; }
    if (!active() || event.sourceCapabilities?.firesTouchEvents || touchMode && event.sourceCapabilities?.firesTouchEvents !== false || ![0, 2].includes(event.button)) return; touchMode = false; event.preventDefault(); canvas.focus({ preventScroll: true });
    const action = event.button === 0 ? 'fire' : 'aim', wasHeld = currentInput()[action]; mouse[action] = true;
    if (state.phase === 'fight' && !wasHeld) inputQueue.press(action, currentInput());
    if (!locked()) { fallback = true; hints(); requestCapture(); } wake();
  }
  function mouseUp(event) {
    if (event.sourceCapabilities?.firesTouchEvents || touchMode && event.sourceCapabilities?.firesTouchEvents !== false) return;
    const action = event.button === 0 ? 'fire' : event.button === 2 ? 'aim' : null;
    if (action) { mouse[action] = false; if (!currentInput()[action]) inputQueue.release(action); }
  }
  function touchDown(event) {
    const target = event.target.closest?.('[data-practice-action],[data-practice-pad]'); if (!target || !active()) return; event.preventDefault();
    const pad = target.dataset.practicePad, action = target.dataset.practiceAction, pointer = { target, pad, action, token: null };
    pointers.set(event.pointerId, pointer); try { target.setPointerCapture(event.pointerId); } catch {}
    if (action) { if (/^slot[1-4]$/.test(action) || ['drop', 'swap'].includes(action)) weaponWheel.reset(); const wasHeld = currentInput()[action]; touch.actions.add(action); if (state.phase === 'fight' && !wasHeld) pointer.token = inputQueue.press(action, currentInput()); target.setAttribute('aria-pressed', 'true'); } if (pad) touchMove(event); wake();
  }
  function touchMove(event) {
    const pointer = pointers.get(event.pointerId); if (!pointer?.pad || !active()) return; event.preventDefault();
    const box = pointer.target.getBoundingClientRect(), radius = box.width * .35; let x = clamp((event.clientX - box.left - box.width / 2) / radius, -1, 1), y = clamp((event.clientY - box.top - box.height / 2) / radius, -1, 1), distance = Math.hypot(x, y); if (distance > 1) { x /= distance; y /= distance; }
    touch[pointer.pad] = { x, y }; pointer.target.querySelector('i').style.transform = `translate(${x * radius}px,${y * radius}px)`;
  }
  function touchEnd(event) {
    const pointer = pointers.get(event.pointerId); if (!pointer) return; pointers.delete(event.pointerId);
    if (pointer.pad) { touch[pointer.pad] = { x: 0, y: 0 }; pointer.target.querySelector('i').style.transform = 'translate(0,0)'; }
    releasePracticeTouchAction(pointer, pointers, touch.actions, inputQueue, action => currentInput()[action], event.type === 'pointercancel' || event.type === 'lostpointercapture');
    try { if (pointer.target.hasPointerCapture?.(event.pointerId)) pointer.target.releasePointerCapture(event.pointerId); } catch {}
  }
  function graphics() {
    if (destroyed) return; renderer?.destroy(); renderer = null; graphicsError = '';
    try { renderer = new VoxelRenderer(canvas); if (!renderer.available) throw new Error(renderer.error || 'WebGL is unavailable.'); setHidden($('practice-error'), true); updateHud(performance.now(), true); draw(performance.now()); }
    catch (cause) { graphicsError = cause?.message || 'Enable hardware acceleration to run Voxel practice.'; setHidden($('practice-error'), false); setText('practice-error-text', graphicsError); setDisabled($('practice-start'), true); }
  }
  async function fullscreen() {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await shell.requestFullscreen(); } catch { feedback('Fullscreen is unavailable in this browser.', performance.now()); }
  }
  function destroy() {
    if (destroyed) return; destroyed = true; stopFrame(); release(); unlock(); for (const remove of listeners) remove(); unsubscribe(); picker.destroy(); audio.destroy(); inventory.destroy(); weaponWheel.destroy(); renderer?.destroy(); movement.clear();
  }
  listen($('practice-setup-form'), 'submit', event => { event.preventDefault(); start(); });
  for (const id of ['practice-map', 'practice-count', 'practice-mode', 'practice-difficulty', 'practice-weapon', 'practice-blade', 'dojo-start-motion']) listen($(id), 'change', preview);
  listen($('dojo-tools-toggle'), 'click', () => setDojoTools(!dojoToolsOpen)); listen($('dojo-tools-close'), 'click', () => setDojoTools(false)); listen($('dojo-return'), 'click', () => setDojoTools(false));
  for (const id of ['dojo-weapon', 'dojo-blade']) listen($(id), 'change', () => { if (dojo && active()) { updateHud(performance.now(), true); wake(); } });
  for (const [id, action] of [['dojo-motion', 'dojoMotion'], ['dojo-reset', 'dojoReset'], ['dojo-wound', 'dojoWound'], ['dojo-recover', 'dojoRecover'], ['dojo-use-station', 'interact']]) listen($(id), 'click', () => { if (dojo && active() && state.phase === 'fight') { inputQueue.press(action, currentInput()); inputQueue.release(action); wake(); } });
  listen($('practice-pause'), 'click', () => state.phase === 'paused' ? resume() : pause()); listen($('practice-touch-pause'), 'click', pause);
  listen($('practice-resume'), 'click', resume); listen($('practice-restart'), 'click', start); listen($('practice-replay'), 'click', start);
  listen($('practice-change-setup'), 'click', setup); listen($('practice-result-setup'), 'click', setup);
  listen($('practice-help'), 'click', showHelp); listen($('practice-guide-close'), 'click', hideHelp); listen($('practice-guide-back'), 'click', hideHelp);
  listen($('practice-fullscreen'), 'click', fullscreen); listen($('retry-graphics'), 'click', graphics);
  listen($('practice-sound'), 'click', async () => { const enabled = await audio.setEnabled(!audio.enabled); setAttribute($('practice-sound'), 'aria-pressed', String(enabled)); setAttribute($('practice-sound'), 'aria-label', enabled ? 'Mute sound' : 'Enable sound'); });
  listen(document, 'pointerdown', event => { if (event.pointerType === 'touch') touchMode = true; else if (event.pointerType === 'mouse') touchMode = false; }, true);
  // MouseEvents report each button in an ADS/fire chord; PointerEvents only
  // report its first press and final release. Touch keeps its pointer handlers.
  listen(window, 'keydown', keyboardDown); listen(window, 'keyup', keyboardUp); listen(window, 'mousemove', mouseMove); listen(canvas, 'mousedown', mouseDown); listen(window, 'mouseup', mouseUp);
  listen(canvas, 'contextmenu', event => event.preventDefault()); listen($('practice-touch'), 'pointerdown', touchDown); listen(window, 'pointermove', touchMove); listen(window, 'pointerup', touchEnd); listen(window, 'pointercancel', touchEnd); listen($('practice-touch'), 'lostpointercapture', touchEnd);
  listen(document, 'pointerlockchange', () => { if (locked()) { fallback = false; hints(); } else if (active() && !dojoToolsOpen) pause(); });
  listen(document, 'pointerlockerror', () => { fallback = true; hints(); });
  listen(document, 'fullscreenchange', () => { const full = document.fullscreenElement === shell; setAttribute($('practice-fullscreen'), 'aria-pressed', String(full)); setAttribute($('practice-fullscreen'), 'aria-label', full ? 'Exit fullscreen' : 'Enter fullscreen'); renderer?.resize(); draw(performance.now()); });
  listen(window, 'resize', () => { renderer?.resize(); if (!active()) draw(performance.now()); });
  listen(window, 'blur', () => { if (active()) pause(); else release(); }); listen(document, 'visibilitychange', () => { if (document.hidden && active()) pause(); }); listen(window, 'pagehide', destroy);
  listen(canvas, 'voxel-renderer-error', event => { if (event.detail?.message) { graphicsError = event.detail.message; if (active()) pause(); setHidden($('practice-error'), false); setText('practice-error-text', graphicsError); } else { graphicsError = ''; setHidden($('practice-error'), true); updateHud(performance.now(), true); draw(performance.now()); } });
  const unsubscribe = subscribeKeyboardLayout(() => { release(); hints(); }); hints(); preview(); graphics();
  const inspect = () => copy({ state: { ...state, map: undefined, fighters: undefined }, stats: getPracticeStats(state), input: currentInput(), queuedActions: inputQueue.inspect(), presentationPlayer, controls: { pointerLocked: locked(), fallback, modalOpen, paused: state.phase === 'paused', entered: activeSession, touch: touchMode }, renderCount, renderStats: renderer?.stats || null, audio: audio.inspectGunshots(), meleeAudio: audio.inspectMelee(), meleeImpactAudio: meleeImpacts.inspect(), reloadAudio: reloadAudio.inspect(), reloadSounds: audio.inspectReloads(), gunImpactAudio: gunImpacts.inspect(), parryAudio: parryAudio.inspect(), parrySounds: audio.inspectParries(), stamina: staminaView, weaponWheel: weaponWheel.inspect(), graphicsError, displayTiming: { physicsSamples, renderSamples: renderCount, lastFraction } });
  const api = Object.freeze({ getState: inspect, getDisplayTiming: () => ({ physicsSamples, renderSamples: renderCount, lastFraction }) }); window.firesidePractice = api;
  return { destroy, inspect };
}

if (typeof document !== 'undefined' && document.getElementById('practice-app')) {
  try { bootPractice(); } catch (cause) { const banner = document.getElementById('practice-error'); banner.hidden = false; document.getElementById('practice-error-text').textContent = `Practice could not load: ${cause.message}`; }
}
