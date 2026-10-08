import { GameAudio } from './audio.js';
import { gameKey, displayKey, getKeyboardLayout, mountKeyboardLayoutPicker, subscribeKeyboardLayout } from './keyboard-layout.js';
import { ADS, HEAL, PLAYER_HEALTH, predictLocalMovement } from './voxel-engine.js';
import { MAPS as BREACH_MAPS } from './voxel-maps.js';
import { MAPS as ROYALE_MAPS } from './voxel-royale-maps.js';
import { findNearbyLoot } from './voxel-royale-engine.js';
import { WEAPONS, WEAPON_IDS } from './voxel-weapons.js';
import { VoxelRenderer } from './voxel-renderer.js';
import { createMovementPresenter, combatPresentation, withCombatPresentation, resolvePresentationContacts } from './voxel-presentation.js';
import { cleanAim, composeInput, controlForKey, aimFraction, aimLookMultiplier, combatReadout, isFormTarget, hasGunshotReport, combatEventPerspective, LOOK_SENSITIVITY } from './voxel-client.js';
import { incomingDamageFeedback, damageFeedbackPresentation } from './voxel-damage-feedback.js';
import { setHidden, setAttribute, setStyle, setDisabled } from './hub/dom.js';
import { createPractice, startPractice, stepPractice, pausePractice, resumePractice, getPracticeStats, TICK_RATE } from './voxel-practice-engine.js';
import { tickFraction } from './display-timing.js';
import { createPracticeInputQueue } from './voxel-practice-input.js';

const STEP = 1 / TICK_RATE;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const copy = value => JSON.parse(JSON.stringify(value));
const clock = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

export function bootPractice() {
  const elements = new Map();
  const $ = id => { if (!elements.has(id)) elements.set(id, document.getElementById(id)); return elements.get(id); };
  const app = $('practice-app'), canvas = $('practice-canvas'), shell = $('practice-shell');
  if (!app || !canvas) return null;
  const params = new URLSearchParams(location.search), game = params.get('game') === 'voxel-royale' ? 'voxel-royale' : 'voxel';
  const royale = game === 'voxel-royale', maps = royale ? ROYALE_MAPS : BREACH_MAPS;
  let renderer = null, graphicsError = '', destroyed = false, frameId = null, previousFrame = null, accumulator = 0;
  let state, aim = { yaw: 0, pitch: 0 }, previousPlayers = [], presentationPlayer = null, lastHudAt = -Infinity, lastPhase = '';
  let urgentHud = '', eventCursor = 0, hitUntil = 0, feedbackUntil = 0, damageFeedback = null, lastDrawAt = 0, fallback = false, modalOpen = false;
  let renderCount = 0, physicsSamples = 0, lastFraction = 0, activeSession = false, lastCountdown = null, returnFocus = null;
  const listeners = [], keys = new Set(), physicalKeys = new Map(), mouse = { fire: false, aim: false }, inputQueue = createPracticeInputQueue();
  const touch = { move: { x: 0, y: 0 }, look: { x: 0, y: 0 }, actions: new Set() }, pointers = new Map(), movement = new Map();
  const audio = new GameAudio(), picker = mountKeyboardLayoutPicker($('practice-keyboard'), { id: 'practice-keyboard-select' });
  // Secondary touch hardware does not decide how a player uses the mouse.
  let touchMode = matchMedia('(pointer: coarse)').matches;
  const setText = (id, value) => { const element = $(id); if (element.textContent !== String(value)) element.textContent = String(value); };
  const listen = (target, name, callback, options) => { target.addEventListener(name, callback, options); listeners.push(() => target.removeEventListener(name, callback, options)); };
  const locked = () => document.pointerLockElement === canvas;
  const active = () => !destroyed && !modalOpen && ['countdown', 'fight'].includes(state?.phase);
  const currentInput = () => composeInput(keys, touch, mouse, aim, active());
  const mapMarkers = new Map(); let playerMarker, stormMarker;

  setText('practice-title', royale ? 'Voxel Royale' : 'Voxel Breach'); document.title = `${royale ? 'Voxel Royale' : 'Voxel Breach'} Practice — Semag`;
  if (royale) { setText('practice-setup-title', 'Find your next opening.'); setText('practice-setup-copy', 'Start with a knife. Scavenge the real maps while bots move, loot and fight for the last safe ground.'); setHidden($('practice-loadout-field'), true); }
  try { const target = new URL(params.get('return') || '/', location.origin); if (target.origin === location.origin && /^\/(?:voxel(?:-royale)?(?:\/|\.html|$)|$)/.test(target.pathname)) $('practice-online').href = target.href; } catch {}
  for (const [id, map] of Object.entries(maps)) { const option = document.createElement('option'); option.value = id; option.textContent = map.name; $('practice-map').append(option); }
  $('practice-map').value = Object.hasOwn(maps, params.get('map')) ? params.get('map') : royale ? 'forest' : 'courtyard';
  for (const id of WEAPON_IDS) { const option = document.createElement('option'); option.value = id; option.textContent = WEAPONS[id].name; $('practice-weapon').append(option); }
  $('practice-weapon').value = 'carbine';
  function config() { return { game, mapId: $('practice-map').value, bots: Number($('practice-count').value), mode: $('practice-mode').value, difficulty: $('practice-difficulty').value, weapon: $('practice-weapon').value }; }
  function hints() {
    const layout = getKeyboardLayout(); app.dataset.keyboardLayout = layout;
    setText('practice-move-keys', displayKey('WASD')); setText('practice-grenade-key', displayKey('Q')); setText('practice-guide-grenade', displayKey('Q'));
    canvas.setAttribute('aria-label', `First-person ${royale ? 'Royale' : 'Breach'} practice. ${displayKey('WASD')} or arrows move, mouse looks, left click or C fires, right click aims, Space jumps, Control crouches, Shift walks, R reloads, V switches blade, ${displayKey('Q')} throws a grenade, F heals, E picks up supplies, Escape pauses.`);
    setText('practice-look-hint', fallback ? 'DRAG TO LOOK · ESC PAUSE' : `${displayKey('WASD')} MOVE · RMB AIM · ESC PAUSE`);
  }
  function stopFrame() { if (frameId !== null) cancelAnimationFrame(frameId); frameId = null; previousFrame = null; accumulator = 0; }
  function release() {
    inputQueue.reset();
    keys.clear(); physicalKeys.clear(); mouse.fire = mouse.aim = false; touch.move = { x: 0, y: 0 }; touch.look = { x: 0, y: 0 }; touch.actions.clear();
    for (const [id, value] of pointers) try { if (value.target.hasPointerCapture?.(id)) value.target.releasePointerCapture(id); } catch {}
    pointers.clear();
    for (const pad of document.querySelectorAll('[data-practice-pad]')) pad.querySelector('i').style.transform = 'translate(0,0)';
    for (const button of document.querySelectorAll('[data-practice-action]')) button.setAttribute('aria-pressed', 'false');
  }
  function unlock() { if (locked()) document.exitPointerLock?.(); }
  function requestCapture() {
    if (touchMode || !canvas.requestPointerLock) { fallback = !touchMode; hints(); return; }
    try { const result = canvas.requestPointerLock(); result?.catch?.(() => { fallback = true; hints(); }); } catch { fallback = true; hints(); }
  }
  function resetView() {
    release(); stopFrame(); previousPlayers = []; presentationPlayer = null; movement.clear(); eventCursor = 0; hitUntil = feedbackUntil = 0; damageFeedback = null;
    lastCountdown = null; lastHudAt = -Infinity; lastPhase = ''; renderCount = physicsSamples = 0; lastFraction = 0; audio.resetEvents(); renderer?.resetEffects();
    aim = cleanAim(state.players[0]?.yaw, state.players[0]?.pitch); lastDrawAt = performance.now();
  }
  function buildRadar() {
    const svg = $('practice-map-plan'), map = state.map, { minX, maxX, minZ, maxZ } = map.bounds;
    svg.replaceChildren(); svg.setAttribute('viewBox', `${minX - 2} ${minZ - 2} ${maxX - minX + 4} ${maxZ - minZ + 4}`); mapMarkers.clear();
    const make = (tag, attrs) => { const element = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, value); svg.append(element); return element; };
    for (const box of map.colliders) if (box.y >= -.01 && box.h > .25) make('rect', { x: box.x, y: box.z, width: box.w, height: box.d });
    if (royale) stormMarker = make('circle', { class: 'practice-map-storm', cx: state.storm.x, cy: state.storm.z, r: state.storm.radius });
    for (const peer of state.players) if (peer.bot) mapMarkers.set(peer.id, make('circle', { cx: peer.x, cy: peer.z, r: (maxX - minX) / 60 }));
    playerMarker = make('circle', { class: 'practice-map-self', cx: state.players[0].x, cy: state.players[0].z, r: (maxX - minX) / 46 });
  }
  function preview() {
    activeSession = false; modalOpen = false; setHidden($('practice-guide'), true); unlock(); state = createPractice(config()); resetView(); buildRadar();
    setText('practice-weapon-note', royale ? 'Knife start · 200 health · weapons, ammo and healing are found in structures.' : WEAPONS[state.practice.config.weapon].description);
    updateHud(performance.now(), true); draw(performance.now());
  }
  function start() {
    if (destroyed || !renderer?.available || modalOpen) return;
    state = createPractice(config()); startPractice(state); activeSession = true; resetView(); buildRadar(); updateHud(performance.now(), true); canvas.focus({ preventScroll: true }); requestCapture(); wake();
  }
  function pause() {
    if (!active()) return; pausePractice(state); release(); stopFrame(); unlock(); updateHud(performance.now(), true); draw(lastDrawAt); $('practice-resume').focus({ preventScroll: true });
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
    for (const event of state.events) {
      if (event.id <= eventCursor) continue; eventCursor = event.id;
      const perspective = combatEventPerspective(event, 0);
      if (event.type === 'damage' && event.damage > 0) {
        if (perspective.outgoing) { hitUntil = now + 170; $('practice-hit').dataset.kind = event.headshot ? 'headshot' : 'body'; }
        const incoming = incomingDamageFeedback(event, state.players[0], state.players, { now, lifeKey: state.practice.sessionId, friendlyFire: royale }); if (incoming) damageFeedback = incoming;
        if (audio.enabled && (perspective.outgoing || perspective.incoming)) audio.tone(perspective.outgoing ? 940 : 140, .055, { end: perspective.outgoing ? 690 : 70, gain: .18, type: 'triangle' });
      }
      if (['kill', 'elimination'].includes(event.type) && perspective.outgoing) { hitUntil = now + 230; feedback(event.headshot ? 'HEADSHOT · TARGET DOWN' : 'TARGET DOWN', now); }
      if (event.type === 'lootPickup' && perspective.source === 0) feedback(event.kind === 'weapon' ? `PICKED UP ${WEAPONS[event.weapon]?.label || 'WEAPON'}` : `PICKED UP ${event.kind.toUpperCase()}`, now);
      if (event.type === 'healComplete' && perspective.source === 0) feedback(`HEALED +${Math.round(event.amount || 0)} HP`, now);
      if (event.type === 'healCancel' && perspective.source === 0) feedback('HEALING INTERRUPTED', now);
      if (audio.enabled && hasGunshotReport(event)) { const sound = WEAPONS[event.weapon]?.sound; if (sound) { const gain = perspective.source === 0 ? 1 : .28; audio.noise(sound.noiseDuration, { highpass: sound.highpass || 170, lowpass: sound.lowpass, gain: sound.noiseVolume * gain }); audio.tone(sound.frequency, sound.toneDuration, { end: sound.endFrequency || 48, type: sound.wave || 'triangle', gain: sound.toneVolume * gain }); } }
      if (audio.enabled && event.type === 'grenadeExplosion') { audio.noise(.4, { highpass: 40, lowpass: 1500, gain: .3 }); audio.tone(70, .3, { end: 25, gain: .2 }); }
    }
  }
  function updateHud(now, force = false) {
    const phase = state.phase, local = state.players[0];
    const signature = [phase, local.hp, local.alive, local.weapon, local.slot, local.hasGun, local.ammo, local.reserve, local.potions, local.grenades, local.aiming, local.healTicks > 0, local.reloadTicks > 0, local.grenadeThrowTicks > 0, local.shotCooldown > 0, local.burstRemaining > 0, local.meleePhase, local.kills, local.damageDealt].join(':');
    if (!force && phase === lastPhase && signature === urgentHud && now - lastHudAt < 80) return;
    urgentHud = signature; const changed = phase !== lastPhase; lastPhase = phase; lastHudAt = now; setAttribute(app, 'data-phase', phase);
    const stats = getPracticeStats(state), player = state.players[0], readout = combatReadout(player, WEAPONS, { ADS, HEAL, PLAYER_HEALTH });
    setText('practice-map-label', state.mapName); setText('practice-mode-label', state.practice.config.mode === 'targets' ? 'MOVING TARGETS' : 'RETURN FIRE'); setText('practice-bots-left', stats.botsRemaining); setText('practice-hits', stats.hits); setText('practice-clock', clock(stats.seconds));
    setHidden($('practice-overlay'), phase === 'fight'); setHidden($('practice-setup-form'), phase !== 'ready'); setHidden($('practice-pause-card'), phase !== 'paused'); setHidden($('practice-result-card'), phase !== 'matchEnd'); setHidden($('practice-countdown'), phase !== 'countdown');
    setHidden($('practice-combat'), !activeSession); setHidden($('practice-radar'), !activeSession); setDisabled($('practice-pause'), !['fight', 'countdown', 'paused'].includes(phase));
    setText('practice-pause', phase === 'paused' ? '▶' : 'Ⅱ'); setAttribute($('practice-pause'), 'aria-label', phase === 'paused' ? 'Resume practice' : 'Pause practice');
    setDisabled($('practice-start'), !renderer?.available || !!graphicsError);
    setText('practice-health', player.hp); setText('practice-health-max', `/ ${player.maxHp}`); setStyle($('practice-health-fill'), 'width', `${clamp(player.hp / player.maxHp, 0, 1) * 100}%`); setAttribute($('practice-health-rail'), 'aria-valuenow', String(player.hp)); setAttribute($('practice-health-rail'), 'aria-valuemax', String(player.maxHp)); setAttribute($('practice-health-rail'), 'data-low', String(player.hp <= 60));
    setText('practice-grenades', readout.grenades); setText('practice-potions', readout.potions); setText('practice-weapon-name', readout.label); setText('practice-ammo', readout.ammo); setText('practice-reserve', readout.sword || readout.healing ? '' : `/ ${readout.reserve}`); setText('practice-weapon-status', readout.status); setAttribute(document.querySelector('.practice-weapon'), 'data-sword', String(readout.sword || readout.healing));
    setHidden($('practice-action-track'), !readout.progress); if (readout.progress) setStyle($('practice-action-fill'), 'width', `${readout.progress.percent}%`);
    const loot = royale ? findNearbyLoot(state, 0) : null; setHidden($('practice-pickup'), !loot || phase !== 'fight'); if (loot) setText('practice-pickup-name', loot.kind === 'weapon' ? WEAPONS[loot.weapon].name : loot.kind === 'heal' ? 'Healing potion' : loot.kind === 'grenade' ? 'Frag grenade' : 'Ammunition');
    if (playerMarker) { setAttribute(playerMarker, 'cx', player.x); setAttribute(playerMarker, 'cy', player.z); }
    for (const [id, marker] of mapMarkers) { const peer = state.players[id]; setAttribute(marker, 'cx', peer.x); setAttribute(marker, 'cy', peer.z); setStyle(marker, 'display', peer.alive && state.practice.config.mode === 'targets' ? '' : 'none'); }
    if (stormMarker && royale) { setAttribute(stormMarker, 'r', state.storm.radius); setStyle(stormMarker, 'display', state.storm.active ? '' : 'none'); }
    setText('practice-objective', phase === 'ready' ? 'Choose your arena. Start when you’re ready.' : phase === 'paused' ? 'All movement and combat paused.' : royale ? `${stats.botsRemaining + (player.alive ? 1 : 0)} survivors · ${state.storm.active ? state.storm.mode === 'shrinking' ? 'Storm closing — move to the ring.' : `Storm closes in ${Math.ceil(state.storm.ticksUntilShrink / TICK_RATE)}s.` : 'Start with a knife. Search for supplies.'}` : state.practice.config.mode === 'targets' ? 'Targets move and use solid cover. Track, counter-strafe and settle before firing.' : 'Bots react to sight and shoot in bursts. Use cover and choose your timing.');
    if (phase === 'countdown') { const seconds = Math.ceil(state.phaseTicks / TICK_RATE); setText('practice-countdown-value', seconds); setText('practice-countdown-copy', royale ? 'Knife first. Find cover and supplies.' : 'Read the cover. Settle your aim.'); if (seconds !== lastCountdown) { lastCountdown = seconds; audio.countdown(seconds); } }
    if (phase === 'fight' && changed) audio.fight();
    if (phase === 'matchEnd') {
      const won = stats.result === 'won'; setText('practice-result-tag', won ? royale ? 'LAST SURVIVOR' : 'DRILL CLEARED' : stats.result === 'timeout' ? 'TIME LIMIT' : 'RUN ENDED'); setText('practice-result-title', won ? 'Clean angles.' : 'Find the next opening.');
      setText('practice-result-copy', `${stats.damageDealt} damage dealt · ${stats.damageTaken} damage taken. ${won ? 'Try a harder pace or a different weapon.' : 'Change your route, settle your aim and protect your reloads.'}`);
      setText('practice-result-kills', stats.kills); setText('practice-result-accuracy', `${Math.round(stats.accuracy)}%`); setText('practice-result-time', clock(stats.seconds));
      if (changed) { release(); unlock(); stopFrame(); $('practice-replay').focus({ preventScroll: true }); }
    }
  }
  function draw(now = performance.now()) {
    if (destroyed || !renderer?.available) return; const live = active(); if (live) lastDrawAt = now;
    const view = { ...state, players: state.players.map(player => {
      let pose = player;
      if (state.phase === 'fight' && player.alive) { if (!movement.has(player.id)) movement.set(player.id, createMovementPresenter()); pose = movement.get(player.id)(player, player.id === 0 ? inputQueue.preview(currentInput()) : player.previousInput, state.map, accumulator, predictLocalMovement, state.players); }
      return withCombatPresentation(pose, combatPresentation(player, previousPlayers[player.id] || player, 1, live ? accumulator * 1000 : 0));
    }) };
    // Fractional player endpoints share one collision-safe rendered world.
    // The camera follows that same body batch without changing real combat.
    view.players = resolvePresentationContacts(view.players, state.map);
    view.fighters = view.players; presentationPlayer = view.players[0]; renderer.render(view, { playerId: 0, localId: 0, localPlayer: presentationPlayer, cameraPlayer: presentationPlayer, yaw: aim.yaw, pitch: aim.pitch + (presentationPlayer.recoil || 0), time: live ? now : lastDrawAt }); renderCount++; lastFraction = tickFraction(accumulator, STEP);
    const scoped = state.phase === 'fight' && presentationPlayer.alive && !modalOpen && presentationPlayer.slot !== 'sword' && WEAPONS[presentationPlayer.weapon]?.scoped && aimFraction(presentationPlayer, ADS.ticks) >= 14 / 18;
    setHidden($('practice-scope'), !scoped); setHidden($('practice-crosshair'), state.phase !== 'fight' || modalOpen || scoped || presentationPlayer.healing);
    setHidden($('practice-hit'), now >= hitUntil || state.phase !== 'fight'); setHidden($('practice-feedback'), now >= feedbackUntil || state.phase !== 'fight');
    const cue = damageFeedbackPresentation(damageFeedback, state.players[0], { now, lifeKey: state.practice.sessionId, yaw: aim.yaw, active: state.phase === 'fight' }), element = $('practice-damage');
    setHidden(element, !cue.visible);
    if (cue.visible) {
      setAttribute(element, 'data-kind', cue.kind); setAttribute(element, 'data-direction', cue.direction);
      for (const [name, value] of [['--damage-opacity', String(cue.opacity)], ['--damage-angle', `${cue.angle || 0}rad`]]) if (element.style.getPropertyValue(name) !== value) element.style.setProperty(name, value);
    }
  }
  function frame(now) {
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
    if (event.key === 'Escape' && ['fight', 'countdown', 'paused'].includes(state.phase)) { event.preventDefault(); if (!event.repeat && state.phase !== 'paused') pause(); return; }
    if (!active() || isFormTarget(event.target) || event.isComposing || event.altKey || event.metaKey) return;
    const canonical = gameKey(event).toLowerCase(), action = ['c', 'j'].includes(canonical) ? 'fire' : controlForKey(event);
    if (!action) return; event.preventDefault(); const physical = event.code || event.key; if (event.repeat && !physicalKeys.has(physical)) return;
    const wasHeld = currentInput()[action]; physicalKeys.set(physical, action); keys.add(action);
    if (state.phase === 'fight' && !wasHeld) inputQueue.press(action); wake();
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
    if (!active() || event.sourceCapabilities?.firesTouchEvents || touchMode && event.sourceCapabilities?.firesTouchEvents !== false || ![0, 2].includes(event.button)) return; touchMode = false; event.preventDefault(); canvas.focus({ preventScroll: true });
    const action = event.button === 0 ? 'fire' : 'aim', wasHeld = currentInput()[action]; mouse[action] = true;
    if (state.phase === 'fight' && !wasHeld) inputQueue.press(action);
    if (!locked()) { fallback = true; hints(); requestCapture(); } wake();
  }
  function mouseUp(event) {
    if (event.sourceCapabilities?.firesTouchEvents || touchMode && event.sourceCapabilities?.firesTouchEvents !== false) return;
    const action = event.button === 0 ? 'fire' : event.button === 2 ? 'aim' : null;
    if (action) { mouse[action] = false; if (!currentInput()[action]) inputQueue.release(action); }
  }
  function touchDown(event) {
    const target = event.target.closest?.('[data-practice-action],[data-practice-pad]'); if (!target || !active()) return; event.preventDefault();
    const pad = target.dataset.practicePad, action = target.dataset.practiceAction; pointers.set(event.pointerId, { target, pad, action }); try { target.setPointerCapture(event.pointerId); } catch {}
    if (action) { const wasHeld = currentInput()[action]; touch.actions.add(action); if (state.phase === 'fight' && !wasHeld) inputQueue.press(action); target.setAttribute('aria-pressed', 'true'); } if (pad) touchMove(event); wake();
  }
  function touchMove(event) {
    const pointer = pointers.get(event.pointerId); if (!pointer?.pad || !active()) return; event.preventDefault();
    const box = pointer.target.getBoundingClientRect(), radius = box.width * .35; let x = clamp((event.clientX - box.left - box.width / 2) / radius, -1, 1), y = clamp((event.clientY - box.top - box.height / 2) / radius, -1, 1), distance = Math.hypot(x, y); if (distance > 1) { x /= distance; y /= distance; }
    touch[pointer.pad] = { x, y }; pointer.target.querySelector('i').style.transform = `translate(${x * radius}px,${y * radius}px)`;
  }
  function touchEnd(event) {
    const pointer = pointers.get(event.pointerId); if (!pointer) return; pointers.delete(event.pointerId);
    if (pointer.pad) { touch[pointer.pad] = { x: 0, y: 0 }; pointer.target.querySelector('i').style.transform = 'translate(0,0)'; }
    if (pointer.action && ![...pointers.values()].some(other => other.action === pointer.action)) { touch.actions.delete(pointer.action); if (!currentInput()[pointer.action]) inputQueue.release(pointer.action); pointer.target.setAttribute('aria-pressed', 'false'); }
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
    if (destroyed) return; destroyed = true; stopFrame(); release(); unlock(); for (const remove of listeners) remove(); unsubscribe(); picker.destroy(); audio.destroy(); renderer?.destroy(); movement.clear();
  }
  listen($('practice-setup-form'), 'submit', event => { event.preventDefault(); start(); });
  for (const id of ['practice-map', 'practice-count', 'practice-mode', 'practice-difficulty', 'practice-weapon']) listen($(id), 'change', preview);
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
  listen(document, 'pointerlockchange', () => { if (locked()) { fallback = false; hints(); } else if (active()) pause(); });
  listen(document, 'pointerlockerror', () => { fallback = true; hints(); });
  listen(document, 'fullscreenchange', () => { const full = document.fullscreenElement === shell; setAttribute($('practice-fullscreen'), 'aria-pressed', String(full)); setAttribute($('practice-fullscreen'), 'aria-label', full ? 'Exit fullscreen' : 'Enter fullscreen'); renderer?.resize(); draw(performance.now()); });
  listen(window, 'resize', () => { renderer?.resize(); if (!active()) draw(performance.now()); });
  listen(window, 'blur', () => { if (active()) pause(); else release(); }); listen(document, 'visibilitychange', () => { if (document.hidden && active()) pause(); }); listen(window, 'pagehide', destroy);
  listen(canvas, 'voxel-renderer-error', event => { if (event.detail?.message) { graphicsError = event.detail.message; if (active()) pause(); setHidden($('practice-error'), false); setText('practice-error-text', graphicsError); } else { graphicsError = ''; setHidden($('practice-error'), true); updateHud(performance.now(), true); draw(performance.now()); } });
  const unsubscribe = subscribeKeyboardLayout(() => { release(); hints(); }); hints(); preview(); graphics();
  const inspect = () => copy({ state: { ...state, map: undefined, fighters: undefined }, stats: getPracticeStats(state), input: currentInput(), queuedActions: inputQueue.inspect(), presentationPlayer, controls: { pointerLocked: locked(), fallback, modalOpen, paused: state.phase === 'paused', entered: activeSession, touch: touchMode }, renderCount, renderStats: renderer?.stats || null, graphicsError, displayTiming: { physicsSamples, renderSamples: renderCount, lastFraction } });
  const api = Object.freeze({ getState: inspect, getDisplayTiming: () => ({ physicsSamples, renderSamples: renderCount, lastFraction }) }); window.firesidePractice = api;
  return { destroy, inspect };
}

if (typeof document !== 'undefined' && document.getElementById('practice-app')) {
  try { bootPractice(); } catch (cause) { const banner = document.getElementById('practice-error'); banner.hidden = false; document.getElementById('practice-error-text').textContent = `Practice could not load: ${cause.message}`; }
}
