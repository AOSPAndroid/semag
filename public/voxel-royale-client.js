import { aimFraction as gunAimFraction, aimLookMultiplier as gunAimLookMultiplier, meleeActionReadout, secondaryActionPresentation, paintSecondaryAction, staminaPresentation, paintStamina, createReloadAudioPresenter, createGunImpactReporter, createParryAudioReporter } from './voxel-fps-feedback.js';
import { displayKey, gameKey, getKeyboardLayout, mountKeyboardLayoutPicker, subscribeKeyboardLayout } from './keyboard-layout.js';
import { copyText, getName, hostInfo, roomUrl, saveName } from './hub/shared.js';
import { GameAudio } from './audio.js';
import { createMeleeImpactReporter } from './voxel-client.js';
import { WEAPONS } from './voxel-weapons.js';
import { resolveActiveFire, weaponReloadDuration } from './voxel-fire-modes.js';
import { predictLocalMovement, sweepPresentationOffset, traceShot, ADS, HEAL, PLAYER_HEALTH } from './voxel-engine.js';

import { meleeLabel, meleeProfile } from './voxel-melee.js';
import { incomingDamageFeedback, damageFeedbackPresentation, paintDamageFeedback } from './voxel-damage-feedback.js';
import { createHitFeedback, paintHitFeedback } from './voxel-hit-feedback.js';
import { createCrosshairPresenter, paintCrosshair } from './voxel-crosshair.js';
import { combatPresentation, createCorrectionPresenter, createMovementPresenter, hudTransitionKey, interpolatedVoxelState, reconcileMovement, resolvePresentationContacts, withCombatPresentation } from './voxel-presentation.js';
import { createNetworkTimeline } from './network-timeline.js';
import { createFpsInputQueue, releaseFpsTouchAction } from './voxel-input-queue.js';
import { setAttribute, setDisabled, setHidden, setStyle, setText, toggleClass } from './hub/dom.js';
import { inventoryControlForKey, inventoryItemReadout, inventoryLootPresentation, inventoryEventFeedback, inventorySlots, inventorySwapPresentation, mountInventoryHotbar, mountWeaponWheel } from './voxel-inventory-ui.js';

export const LOOK_SENSITIVITY = .0025;
export const INPUT_ACTIONS = Object.freeze(['up', 'down', 'left', 'right', 'jump', 'crouch', 'walk', 'sprint', 'fire', 'reload', 'interact', 'aim', 'swap', 'grenade', 'heal', 'slot1', 'slot2', 'slot3', 'slot4', 'drop']);
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const finite = (n, fallback = 0) => Number.isFinite(n) ? n : fallback;
const clone = value => value == null ? value : structuredClone(value);
const TAU = Math.PI * 2;

export function cleanAim(yaw = 0, pitch = 0) {
  return { yaw: ((finite(yaw) + Math.PI) % TAU + TAU) % TAU - Math.PI, pitch: clamp(finite(pitch), -1.35, 1.35) };
}
export function neutralInput(yaw = 0, pitch = 0) {
  return { ...Object.fromEntries(INPUT_ACTIONS.map(action => [action, false])), ...cleanAim(yaw, pitch) };
}
export function controlForKey(event, layout = getKeyboardLayout()) {
  if (event.defaultPrevented || event.isComposing || event.altKey || event.metaKey) return null;
  return inventoryControlForKey(event) || ({ w: 'up', s: 'down', a: 'left', d: 'right', arrowup: 'up', arrowdown: 'down', arrowleft: 'left', arrowright: 'right', ' ': 'jump', control: 'crouch', shift: 'sprint', c: 'walk', b: 'fire', j: 'fire', r: 'reload', e: 'interact', v: 'swap', q: 'grenade', g: 'grenade', f: 'heal', h: 'heal' })[gameKey(event, layout).toLowerCase()] || null;
}
export function isFormTarget(target) {
  return !!(target?.isContentEditable || target?.closest?.('input, select, textarea, button, a, [contenteditable]:not([contenteditable="false"]), [role="dialog"]'));
}
export function controlsAllowed({ connected, entered, paused, modalOpen, graphicsError, hidden, alive, phase, pointerLocked, fallback, touchMode }) {
  return !!(connected && entered && !paused && !modalOpen && !graphicsError && !hidden && alive && ['countdown', 'fight'].includes(phase) && (pointerLocked || fallback || touchMode));
}
export function composeInput(keys, touch, mouse, aim, active = true) {
  const input = neutralInput(aim.yaw, aim.pitch); if (!active) return input;
  for (const action of INPUT_ACTIONS) input[action] = keys.has(action) || touch.actions.has(action);
  input.up ||= touch.move.y < -.22; input.down ||= touch.move.y > .22;
  input.left ||= touch.move.x < -.22; input.right ||= touch.move.x > .22;
  input.fire ||= mouse.fire === true; input.aim ||= mouse.aim === true;
  return input;
}
/** Continuous look, movement and heartbeat share one budget. Press/release edges bypass it. */
export function createInputPacer(maxHz = 60) {
  let previousAt = -Infinity; const interval = 1000 / maxHz;
  return { shouldSend(now, edge = false) { if (!edge && now - previousAt < interval - .001) return false; previousAt = now; return true; }, reset() { previousAt = -Infinity; } };
}
export function aliveParticipants(state) {
  const participants = new Set(state?.participantIds || []);
  return (state?.players || []).filter(player => player.alive && participants.has(player.id));
}
export function canHostStart(state, roster, localId, hostId, connected = true) {
  return !!(connected && state?.phase === 'lobby' && localId != null && localId === hostId && roster.filter(person => person?.connected).length >= 2);
}
/** The server-selected room capacity governs invitations, labels and visible seats. */
export function roomPresentation(state, roster = [], fallbackCapacity = 10) {
  const valid = value => Number.isInteger(value) && value >= 2 && value <= 10;
  const capacity = valid(state?.capacity) ? state.capacity : valid(fallbackCapacity) ? fallbackCapacity : 10;
  const count = roster.filter(person => person?.connected).length;
  return { capacity, count, label: `${count} / ${capacity} PLAYERS`, slots: Array.from({ length: capacity }, (_, id) => ({ id, person: roster.find(person => person?.id === id) || null })) };
}
/** A living player sees their own HUD. Eliminated players may follow any remaining participant. */
export function spectatorPlayer(state, localId, spectatorId) {
  const local = state?.players?.find(player => player.id === localId);
  if (local?.alive) return local;
  const living = aliveParticipants(state);
  return living.find(player => player.id === spectatorId) || living[0] || local || null;
}
/** Pickup eligibility and line of sight come from the shared authoritative helper. */
export function lootPresentation(loot, player) {
  if (!loot || !player?.alive) return null;
  if (Array.isArray(player.inventory)) return inventoryLootPresentation(loot, player);
  if (loot.kind === 'weapon') {
    const weapon = WEAPONS[loot.weapon]; if (!weapon) return null;
    const exchange = player.hasGun && player.weapon !== loot.weapon;
    return { id: loot.id, name: weapon.name, detail: exchange ? `EXCHANGE ${WEAPONS[player.weapon]?.label || 'GUN'} · ${loot.ammo ?? weapon.magazine} / ${loot.reserve ?? weapon.reserve}` : `PICK UP · ${loot.ammo ?? weapon.magazine} / ${loot.reserve ?? weapon.reserve}`, kind: 'weapon' };
  }
  if (loot.kind === 'heal') return { id: loot.id, name: 'Healing potion', detail: `PICK UP · F TO HEAL UP TO ${HEAL.amount} HP`, kind: 'heal' };
  if (loot.kind === 'grenade') return { id: loot.id, name: 'Fragmentation grenade', detail: 'PICK UP · THROW WITH Q', kind: 'grenade' };
  if (loot.kind === 'ammo') return { id: loot.id, name: 'Ammunition', detail: `PICK UP · +${Math.max(0, loot.amount || 0)} RESERVE`, kind: 'ammo' };
  return null;
}
export function stormPresentation(state, player) {
  const storm = state?.storm;
  if (!storm || state.phase !== 'fight') return { visible: false, outside: false, label: 'SAFE ZONE', text: '—', detail: '' };
  const radius = Math.max(0, finite(storm.radius));
  const outside = !!player?.alive && [player.x, player.z, storm.x, storm.z].every(Number.isFinite) && Math.hypot(player.x - storm.x, player.z - storm.z) > radius;
  const shrinking = storm.mode === 'shrinking'; const final = storm.mode === 'final';
  const ticks = shrinking ? storm.ticksUntilNext : storm.ticksUntilShrink;
  const seconds = Math.max(0, Math.ceil(finite(ticks) / 120));
  return { visible: true, outside, shrinking, final, seconds,
    label: final ? 'FINAL ZONE' : shrinking ? 'ZONE CLOSING' : 'ZONE CLOSES IN',
    text: final ? 'SURVIVE' : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`,
    detail: outside ? `${Math.max(0, finite(storm.damagePerSecond))} HP / SEC · GET INSIDE` : `STAGE ${Math.max(1, finite(storm.stage) + 1)} · ${Math.round(radius)} M SAFE RADIUS` };
}
export function healthPresentation(player, previous = null, { now = 0, matchId = 0 } = {}) {
  const maxHp = Number.isFinite(player?.maxHp) && player.maxHp > 0 ? player.maxHp : PLAYER_HEALTH;
  const hp = clamp(finite(player?.hp), 0, maxHp);
  const reset = !previous || previous.id !== player?.id || previous.matchId !== matchId || previous.maxHp !== maxHp;
  let trailFrom = reset ? hp : previous.trailFrom; let damageAt = reset ? -Infinity : previous.damageAt;
  if (!reset && hp < previous.hp) { trailFrom = Math.max(previous.trailHp, previous.hp); damageAt = now; }
  if (reset || hp > previous.hp) { trailFrom = hp; damageAt = -Infinity; }
  const decay = clamp((now - damageAt - 400) / 550, 0, 1);
  const trailHp = hp + Math.max(0, trailFrom - hp) * (1 - decay);
  return { id: player?.id, matchId, hp, maxHp, trailHp, trailFrom, damageAt, percent: hp / maxHp * 100, trailPercent: trailHp / maxHp * 100, low: hp > 0 && hp / maxHp <= .3, dead: player?.alive === false || hp === 0 };
}
export function aimFraction(player, ticks = 18) {
  return gunAimFraction(player, ticks, { requireGun: true });
}
export function aimLookMultiplier(player, ads = {}) {
  return gunAimLookMultiplier(player, ads, { requireGun: true });
}
export function combatReadout(player, rules = {}) {
  const weapon = player?.hasGun ? WEAPONS[player.weapon] : null;
  const fire = resolveActiveFire(weapon, player);
  const sword = !weapon || player?.slot === 'sword';
  const blade = player?.meleeWeapon ? player : { ...player, meleeWeapon: 'knife' };
  const bladeLabel = meleeLabel(blade), profile = meleeProfile(blade);
  const healing = player?.healTicks > 0;
  const bladeAction = sword ? meleeActionReadout({ ...blade, slot: 'sword' }, profile) : null;
  let label = sword ? bladeLabel : weapon.label, ammo = sword ? bladeAction?.ammo || 'READY' : player.ammo;
  let status = sword ? bladeAction?.status || 'LMB STRIKE · FIND A GUN' : weapon.adsSupported === false ? fire.automatic ? 'HOLD FIRE · HIP FIRE' : 'CLICK EACH SHOT · R RELOAD' : 'RMB AIM · R RELOAD';
  let progress = bladeAction?.progress || null;
  if (!sword && !player.ammo) status = player.reserve ? 'R TO RELOAD' : 'NO AMMUNITION';
  if (!sword && weapon.spinupTicks && player.spinTicks > 0 && player.spinTicks < weapon.spinupTicks) {
    status = 'HOLD FIRE · WINDING UP'; progress = { remaining: weapon.spinupTicks - player.spinTicks, total: weapon.spinupTicks, label: 'Weapon wind-up' };
  }
  if (!sword && player.reloadTicks > 0) { status = `RELOADING ${(player.reloadTicks / 120).toFixed(1)}S`; progress = { remaining: player.reloadTicks, total: weaponReloadDuration(weapon, player.ammo), label: 'Reload' }; }
  if (!sword && player.shotCooldown > 0 && ['bolt', 'pump', 'burst'].includes(fire.mode) && !player.reloadTicks) status = ({ bolt: 'CYCLING BOLT', pump: 'PUMPING', burst: 'BURST RECOVERY' })[fire.mode];
  if (!sword && fire.alternate && !player.reloadTicks && !player.shotCooldown) status = fire.mode === 'airburst' ? `RMB AIRBURST · ${fire.popDistance}M POP` : `RMB BURST · ${Math.min(fire.ammoCost || fire.count, player.ammo)} ROUNDS`;
  else if (!sword && weapon.adsBurst && fire.mode === 'burst' && !player.reloadTicks && (player.burstRemaining > 0 || !player.shotCooldown)) status = player.burstRemaining > 0 ? 'BURST FIRING' : `ADS ${fire.count}-SHOT BURST · HOLD LMB`;
  if (healing) { label = 'HEALING POTION'; ammo = `+${Math.min(rules.HEAL?.amount || HEAL.amount, Math.max(0, (player.maxHp || PLAYER_HEALTH) - player.hp))}`; status = 'DRINKING · STAY IN COVER'; progress = { remaining: player.healTicks, total: rules.HEAL?.ticks || 240, label: 'Drinking healing potion' }; }
  if (progress) progress.percent = clamp(100 - progress.remaining / progress.total * 100, 0, 100);
  return { label, ammo, reserve: Math.max(0, finite(player?.reserve)), sword, healing, status, progress, inventory: Array.isArray(player?.inventory) ? inventorySlots(player).filter(slot => slot.kind !== 'empty').map(slot => slot.label).join(' · ') : weapon ? `${weapon.label} + ${bladeLabel}` : `${bladeLabel} ONLY · SCAVENGE A GUN`, grenades: Math.max(0, finite(player?.grenades)), potions: Math.max(0, finite(player?.potions)), ...inventoryItemReadout(player) };
}
export function confirmedHitGroups(events, localId) {
  const groups = new Map();
  for (const event of events || []) {
    const source = event.attackerId ?? event.shooterId ?? event.playerId ?? event.ownerId;
    if (event.type !== 'damage' || !(event.damage > 0) || source !== localId || event.targetId == null || event.targetId === localId) continue;
    const key = `${event.tick}:${event.targetId}:${event.weapon || ''}`, group = groups.get(key) || { targetId: event.targetId, damage: 0, headshot: false, legshot: true };
    group.damage += event.damage; group.headshot ||= !!event.headshot; group.legshot &&= event.hitKind === 'leg'; groups.set(key, group);
  }
  return [...groups.values()].map(group => ({ ...group, label: group.headshot ? 'HEADSHOT' : group.legshot ? 'LEG HIT' : 'HIT' }));
}
/** Bounded copied history predicts movement only: HP, inventory and attacks stay authoritative. */
export function reconcilePlayer(player, history, ack, map, predictMovement, allowMovement = true, peers = [], authoritativeTick) {
  return reconcileMovement(player, history, ack, map, predictMovement, allowMovement, peers, authoritativeTick);
}
export function interpolatedState(samples, targetTime, localId, options = {}) {
  return interpolatedVoxelState(samples, targetTime, localId, options);
}

async function boot() {
  const $ = id => document.getElementById(id), canvas = $('arena');
  const roomId = new URLSearchParams(location.search).get('room')?.trim().toUpperCase() || '';
  setText($('room-code'), /^[A-Z0-9]{6}$/.test(roomId) ? roomId : 'NO ROOM');
  const layoutPickerHost = document.querySelector('[data-keyboard-layout-picker]'), layoutPickerHome = layoutPickerHost.parentElement;
  const layoutPicker = mountKeyboardLayoutPicker(layoutPickerHost);
  let playerName = getName(); $('player-name').value = playerName;
  let engine, renderer, socket, state = null, playerId = null, hostId = null, connected = false, roster = [], capacity = 10;
  let predictedPlayer = null, presentationPlayer = null, presentationPlayers = [], snapshots = [], pending = [], sequence = 0, predictionTick = 0, aim = cleanAim();
  let dialogReturnFocus = null, guideReturnToRoom = false;
  let paused = true, entered = false, fallback = false, touchMode = false, rightDrag = false, modalOpen = false, graphicsError = '', spectatorId = null;
  let destroyed = false, permanentError = false, reconnectTimer, reconnectAttempts = 0, frameId = null, lastFrameAt = 0, accumulator = 0, renderCount = 0;
  let heartbeat = null, lastTouchLookAt = performance.now(), lastHUDAt = 0, previousPhase = null, previousMatch = null;
  const hitFeedback = createHitFeedback(), hitMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const hitElements = { crosshair: $('crosshair'), scope: $('scope-reticle'), marker: $('hit-marker') };
  const presentCrosshair = createCrosshairPresenter();
  let reticleView = null;
  function clearReticle() { presentCrosshair.reset(); reticleView = null; paintCrosshair(hitElements.crosshair, null); setHidden(hitElements.scope, true); }
  let toastTimer, damageFeedback = null, feedbackUntil = 0, healthView = null, healthGain = 0, healthGainUntil = 0, lastCountdown = null;
  let rosterSignature = '', mapPlanId = '', mapSelf = null, zoneCircle = null, nextCircle = null, idleSignature = '';
  const keys = new Set(), pressedKeys = new Map(), mouse = { fire: false, aim: false };
  const touch = { actions: new Set(), move: { x: 0, y: 0 }, look: { x: 0, y: 0 } };
  const actionPointers = new Map(), padPointers = new Map(), wirePacer = createInputPacer(60);
  const presentMovement = createMovementPresenter();
  const actionInputs = createFpsInputQueue();
  const correction = createCorrectionPresenter();
  const timeline = createNetworkTimeline({ snapshotTicks: 4 });
  let paintedHUDKey = "";
  const hudKey = () => hudTransitionKey(state, roster, playerId);
  const eventSeen = new Set(), eventOrder = [], kills = [], audio = new GameAudio(), removers = [];
  const meleeImpacts = createMeleeImpactReporter(audio), gunImpacts = createGunImpactReporter(audio), parryAudio = createParryAudioReporter(audio);
  const reloadAudio = createReloadAudioPresenter(audio), staminaElements = { meter: $('stamina-meter'), fill: $('stamina-fill') };
  let staminaView = staminaPresentation(null, { active: false });
  function paintVitals(player, name = 'Your', active = true) { staminaView = staminaPresentation(player, { name, active }); paintStamina(staminaElements.meter, staminaElements.fill, staminaView); }
  function listen(target, name, callback, options) { target.addEventListener(name, callback, options); removers.push(() => target.removeEventListener(name, callback, options)); }
  function send(message) { if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message)); }
  function error(message = '') { setText($('error-banner'), message); setHidden($('error-banner'), !message); }
  function toast(message) { clearTimeout(toastTimer); setText($('toast'), message); setHidden($('toast'), false); toastTimer = setTimeout(() => { setHidden($('toast'), true); }, 2800); }
  function ownPlayer() { return state?.players?.find(player => player.id === playerId) || null; }
  function lookupName(id) { return roster.find(person => person?.id === id)?.name || `Player ${Number(id) + 1}`; }
  function pointerLocked() { return document.pointerLockElement === canvas; }
  function controlsActive() { return controlsAllowed({ connected, entered, paused, modalOpen, graphicsError, hidden: document.hidden, alive: ownPlayer()?.alive, phase: state?.phase, pointerLocked: pointerLocked(), fallback, touchMode }); }
  function currentInput() { return composeInput(keys, touch, mouse, aim, controlsActive()); }
  const weaponWheel = mountWeaponWheel(canvas, {
    context: () => ({ player: ownPlayer(), active: !destroyed && controlsActive() && state?.phase === 'fight', pointerLocked: pointerLocked(), fallback, crouchHeld: keys.has('crouch') }),
    dispatch: action => { const input = currentInput(); if (input[action]) return false; sendInput({ ...input, [action]: true }, true); sendInput(input, true); return true; },
  });
  const inventory = mountInventoryHotbar($('royale-inventory'), actions => {
    if (!controlsActive() || state?.phase !== 'fight') return;
    weaponWheel.reset();
    const fresh = actions.filter(action => !keys.has(action)); fresh.forEach(action => keys.add(action)); sendInput(currentInput(), true);
    fresh.forEach(action => keys.delete(action)); sendInput(currentInput(), true); canvas.focus({ preventScroll: true });
  });
  function sendInput(buttons = currentInput(), edge = false, now = performance.now(), cancelActions = false, cancelPress = null) {
    const nextSequence = sequence >= 999999000 ? 1 : sequence + 1;
    if (cancelActions) actionInputs.reset({ held: buttons, neutral: true });
    else {
      if (cancelPress) actionInputs.cancel(cancelPress);
      actionInputs.observe(buttons, now, { sequence: nextSequence });
    }
    if (!connected || playerId == null || !wirePacer.shouldSend(now, edge || cancelActions || cancelPress)) return null;
    // Preserve the rendered remote timeline when the trigger changes between frames.
    const viewTime = timeline.getState().renderTime;
    const viewTick = state?.phase === 'fight' && Number.isFinite(viewTime) && viewTime >= 0 ? viewTime * 120 / 1000 : null;
    sequence = nextSequence;
    send({ type: 'input', seq: sequence, buttons, ...(viewTick === null ? {} : { viewTick }), ...(cancelActions ? { cancelActions: true } : {}), ...(cancelPress ? { cancelPress } : {}) }); return sequence;
  }
  function utilityFeedback(action) {
    const player = ownPlayer(); if (!player?.alive || state?.phase !== 'fight') return;
    if (action === 'heal' && !player.healTicks) {
      if (!player.potions) toast('No potions. Search structures for supplies.');
      else if (player.hp >= player.maxHp) toast('Health is full. Save your potion.');
      else if (!player.grounded) toast('Land before drinking.');
    } else if (action === 'grenade' && !player.grenades) toast('No grenades. Scavenge one first.');
    else if (action === 'swap' && !player.hasGun) toast('Knife equipped. Find a gun and press E to pick it up.');
  }
  function refreshHeartbeat() {
    const needed = !destroyed && connected && !document.hidden && ['countdown', 'fight'].includes(state?.phase);
    if (needed && !heartbeat) heartbeat = setInterval(() => { integrateTouchLook(); sendInput(); }, 50);
    if (!needed && heartbeat) { clearInterval(heartbeat); heartbeat = null; }
  }
  function integrateTouchLook(now = performance.now()) {
    const dt = clamp((now - lastTouchLookAt) / 1000, 0, .1); lastTouchLookAt = now;
    if (touchMode && controlsActive()) { const sensitivity = aimLookMultiplier(presentationPlayer || ownPlayer(), engine?.ADS); aim = cleanAim(aim.yaw + touch.look.x * dt * 2.4 * sensitivity, aim.pitch - touch.look.y * dt * 1.85 * sensitivity); }
  }
  function neutralize({ pause = false, unlock = false } = {}) {
    weaponWheel.reset();
    clearReticle();
    reloadAudio.suspend(); paintVitals(null, 'Your', false);
    hitFeedback.reset(); paintHitFeedback(hitElements, { visible: false });
    keys.clear(); pressedKeys.clear(); mouse.fire = mouse.aim = false; rightDrag = false;
    touch.actions.clear(); touch.move = { x: 0, y: 0 }; touch.look = { x: 0, y: 0 };
    for (const button of document.querySelectorAll('[data-royale-action="sprint"], [data-royale-action="walk"], [data-royale-action="crouch"]')) button.setAttribute('aria-pressed', 'false');
    paintSecondaryAction(document.querySelector('[data-royale-action="aim"]'), secondaryActionPresentation(null, { active: false }));
    for (const [id, record] of actionPointers) try { record.element.releasePointerCapture(id); } catch { /* Already cancelled. */ }
    for (const [id, record] of padPointers) try { record.element.releasePointerCapture(id); } catch { /* Already cancelled. */ }
    actionPointers.clear(); padPointers.clear(); document.querySelectorAll('.touch-pad.active, .touch-actions .pressed').forEach(element => element.classList.remove('active', 'pressed'));
    document.querySelectorAll('.touch-pad i').forEach(element => { element.style.transform = ''; });
    if (pause) paused = true;
    if (unlock && pointerLocked()) document.exitPointerLock?.();
    sendInput(neutralInput(aim.yaw, aim.pitch), true, performance.now(), true); wirePacer.reset(); pending = []; accumulator = 0; predictionTick = state?.tick || 0; correction.reset(); presentationPlayer = null; presentationPlayers = []; lastTouchLookAt = performance.now();
    predictedPlayer = clone(ownPlayer()); updateUI();
  }
  function updateMap(viewed) {
    const map = state?.map; setHidden($('tactical-map'), !map || !viewed || !['countdown', 'fight', 'matchEnd'].includes(state.phase)); if (!map || !viewed) return;
    const svg = $('map-plan'), node = (tag, attrs) => { const element = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value); return element; };
    if (mapPlanId !== map.id) {
      mapPlanId = map.id; svg.replaceChildren(); const b = map.bounds;
      svg.setAttribute('viewBox', `${b.minX - 2} ${b.minZ - 2} ${b.maxX - b.minX + 4} ${b.maxZ - b.minZ + 4}`);
      svg.append(node('rect', { x: b.minX, y: b.minZ, width: b.maxX - b.minX, height: b.maxZ - b.minZ, class: 'map-floor' }));
      for (const box of map.colliders) if (!box.overhead && box.h >= .3) svg.append(node('rect', { x: box.x, y: box.z, width: box.w, height: box.d, class: 'map-cover' }));
      zoneCircle = node('circle', { class: 'map-storm' }); nextCircle = node('circle', { class: 'map-next' }); mapSelf = node('path', { d: 'M0 -2 L1.6 1.5 L0 .8 L-1.6 1.5 Z', class: 'map-self' });
      svg.append(nextCircle, zoneCircle, mapSelf);
    }
    for (const [circle, radius] of [[zoneCircle, state.storm?.radius], [nextCircle, state.storm?.nextRadius]]) {
      circle.setAttribute('display', Number.isFinite(radius) ? 'inline' : 'none'); circle.setAttribute('cx', finite(state.storm?.x)); circle.setAttribute('cy', finite(state.storm?.z)); circle.setAttribute('r', Math.max(0, finite(radius)));
    }
    const pose = viewed.id === playerId ? predictedPlayer || viewed : viewed;
    mapSelf.setAttribute('transform', `translate(${pose.x} ${pose.z}) rotate(${(viewed.id === playerId ? aim.yaw : viewed.yaw) * 180 / Math.PI})`);
    setAttribute($('tactical-map'), 'aria-label', `${viewed.id === playerId ? 'Your' : 'Spectated player'} position and current safe zone; opponent positions are hidden`);
  }
  function renderRoster() {
    const room = roomPresentation(state, roster, capacity);
    const signature = JSON.stringify([room.capacity, hostId, playerId, state?.phase, roster.map(person => person && [person.id, person.name, person.connected]), state?.players?.map(player => [player.id, player.alive, player.kills]), state?.participantIds]);
    if (signature === rosterSignature) return; rosterSignature = signature; const container = $('player-roster'); container.replaceChildren();
    for (const { id, person } of room.slots) {
      const player = state?.players?.find(other => other.id === id), participating = state?.participantIds?.includes(id);
      const eliminated = participating && !player?.alive && state.phase !== 'lobby';
      const row = document.createElement('div'); row.className = `roster-slot${person ? '' : ' empty'}${eliminated ? ' eliminated' : ''}`; row.dataset.playerId = id;
      const number = document.createElement('i'); number.textContent = String(id + 1).padStart(2, '0');
      const detail = document.createElement('div'), name = document.createElement('strong'), status = document.createElement('small'), badge = document.createElement('span');
      name.textContent = person?.name || 'Open seat'; status.textContent = !person ? 'SEND AN INVITE' : !person.connected ? 'DISCONNECTED' : state?.phase === 'lobby' ? id === hostId ? 'ROOM HOST' : 'IN THE LOBBY' : eliminated ? `ELIMINATED · ${player?.kills || 0} KILLS` : participating ? `ALIVE · ${player?.kills || 0} KILLS` : 'NEXT BATTLE';
      badge.textContent = id === playerId ? 'YOU' : id === hostId ? 'HOST' : ''; detail.append(name, status); row.append(number, detail, badge); container.append(row);
    }
  }
  function updateUI() {
    lastHUDAt = performance.now(); paintedHUDKey = hudKey();
    refreshHeartbeat(); const phase = state?.phase || 'lobby', local = ownPlayer(), room = roomPresentation(state, roster, capacity), { count } = room, isHost = playerId != null && playerId === hostId;
    document.querySelector('.royale-app').dataset.phase = phase;
    setText($('connection-status'), connected ? 'CONNECTED' : permanentError ? 'UNAVAILABLE' : 'RECONNECTING'); toggleClass($('connection-dot'), 'online', connected);
    setText($('seat-count'), room.label); setText($('map-name'), (state?.mapName || state?.map?.name || 'PRIVATE ISLAND').toUpperCase());
    setText($('phase-label'), ({ lobby: 'ASSEMBLING', countdown: 'SPAWNING', fight: 'LAST PLAYER STANDING', matchEnd: 'BATTLE COMPLETE' })[phase] || phase.toUpperCase());
    setText($('alive-count'), phase === 'lobby' ? count : aliveParticipants(state).length); setText($('alive-label'), phase === 'lobby' ? ` / ${room.capacity} PLAYERS` : ` / ${state?.participantIds?.length || 0} ALIVE`);
    setDisabled($('player-name'), !connected || phase !== 'lobby');
    const startable = canHostStart(state, roster, playerId, hostId, connected) && !graphicsError;
    setHidden($('start-button'), !isHost || phase !== 'lobby'); setDisabled($('start-button'), !startable);
    setHidden($('overlay-start'), !isHost || phase !== 'lobby' || !!graphicsError); setDisabled($('overlay-start'), !startable);
    setHidden($('rematch-button'), !isHost || phase !== 'matchEnd'); setDisabled($('rematch-button'), !connected);
    setHidden($('overlay-rematch'), $('rematch-button').hidden); setDisabled($('overlay-rematch'), $('rematch-button').disabled);
    setHidden($('overlay-room'), !connected || !['lobby', 'matchEnd'].includes(phase) || !!graphicsError);
    $('overlay-room').firstChild.textContent = phase === 'matchEnd' ? 'Room & controls ' : 'Room setup ';
    setText($('host-label'), isHost ? 'You host this room.' : hostId != null ? `${lookupName(hostId)} hosts this room.` : 'Waiting for the host');
    setText($('start-note'), phase === 'lobby' ? count < 2 ? 'Invite at least one rival. The host chooses when to start.' : count >= room.capacity ? `${count} players are here. This room is full and the host can start.` : `${count} players are here. The host can start now or invite up to ${room.capacity - count} more.` : phase === 'matchEnd' ? isHost ? 'Return everyone to the lobby, invite more rivals and start a new battle.' : 'The host can open the lobby for another battle.' : 'The battle keeps running when controls are released.');
    const viewed = spectatorPlayer(state, playerId, spectatorId), spectating = !!viewed && viewed.id !== playerId;
    if (!local?.alive) spectatorId = viewed?.alive ? viewed.id : null;
    paintVitals(viewed, spectating ? `${lookupName(viewed.id)}’s` : 'Your', connected && !paused && !modalOpen && ['countdown', 'fight'].includes(phase));
    const health = healthPresentation(viewed, healthView, { now: performance.now(), matchId: state?.matchId }); healthView = health;
    setHidden($('combat-hud'), !viewed?.alive || !['countdown', 'fight'].includes(phase));
    setText($('health'), Math.round(health.hp)); setText($('health-max'), `/ ${health.maxHp}`);
    setStyle($('health-fill'), 'width', `${health.percent}%`); setStyle($('health-trail'), 'width', `${health.trailPercent}%`);
    setAttribute($('health-meter'), 'aria-valuenow', String(health.hp)); setAttribute($('health-meter'), 'aria-valuemax', String(health.maxHp)); setAttribute($('health-meter'), 'aria-label', spectating ? `${lookupName(viewed.id)} health` : 'Your health');
    setText($('health-subject'), spectating ? lookupName(viewed.id).toUpperCase() : 'YOUR HEALTH'); toggleClass($('health-readout'), 'low-health', health.low);
    setText($('health-status'), health.low ? 'LOW HEALTH · FIND COVER' : spectating ? 'SPECTATING' : 'ONE LIFE · STAY SHARP');
    setHidden($('health-gain'), spectating || performance.now() >= healthGainUntil || !healthGain); setText($('health-gain'), `+${healthGain}`);
    const readout = combatReadout(viewed || {}, engine); setText($('weapon-label'), readout.label); setText($('ammo'), readout.ammo); setText($('reserve'), readout.reserve);
    inventory.update(viewed, { visible: !!viewed?.alive && ['countdown', 'fight'].includes(phase), interactive: !spectating && controlsActive() && phase === 'fight' });
    setHidden($('ammo-reserve'), readout.sword || readout.healing || readout.utility); setText($('weapon-status'), readout.status); setText($('inventory-label'), readout.inventory);
    $('weapon-readout').dataset.slot = readout.utility ? viewed?.slot || 'empty' : readout.healing ? 'potion' : readout.sword ? 'sword' : 'primary';
    setHidden($('reload-track'), !readout.progress); setStyle($('reload-progress'), 'width', `${readout.progress?.percent || 0}%`); setAttribute($('reload-track'), 'aria-label', readout.progress?.label || 'Weapon action'); setAttribute($('reload-track'), 'aria-valuenow', String(Math.round(readout.progress?.percent || 0))); setAttribute($('reload-track'), 'aria-valuetext', `${((readout.progress?.remaining || 0) / 120).toFixed(1)} seconds remaining`);
    setText($('grenade-charge'), readout.grenades); setText($('potion-charge'), readout.potions);
    const storm = stormPresentation(state, viewed); setHidden($('storm-hud'), !storm.visible); setText($('storm-label'), storm.label); setText($('storm-clock'), storm.text); setText($('storm-detail'), storm.detail); toggleClass($('storm-hud'), 'shrinking', !!storm.shrinking); toggleClass($('storm-hud'), 'outside', storm.outside); setHidden($('storm-warning'), !storm.outside);
    updateMap(viewed);
    const nearLoot = local?.alive && phase === 'fight' && engine?.findNearbyLoot ? lootPresentation(engine.findNearbyLoot(state, playerId), local) : null;
    setHidden($('loot-prompt'), !nearLoot || paused || !entered || modalOpen); setText($('loot-name'), nearLoot?.name || ''); setText($('loot-detail'), nearLoot?.detail ? displayKey(nearLoot.detail) : '');
    if (!controlsActive() || phase !== 'fight') clearReticle();
    const living = aliveParticipants(state), placement = state?.placements?.find(item => item.playerId === playerId);
    setHidden($('spectator-hud'), !local || local.alive || phase !== 'fight'); setText($('placement-label'), placement ? `PLACED #${placement.place}` : 'ELIMINATED'); setText($('spectator-label'), spectating ? `SPECTATING ${lookupName(viewed.id).toUpperCase()}` : 'NO SURVIVORS'); setHidden($('next-spectator'), living.length < 2);
    setHidden($('pause-button'), paused || !entered || !local?.alive || !['countdown', 'fight'].includes(phase)); setHidden($('touch-controls'), !touchMode || !entered || paused || !local?.alive || !['countdown', 'fight'].includes(phase));
    for (const button of document.querySelectorAll('[data-royale-action]')) { const action = button.dataset.royaleAction; if (action === 'swap') { const swap = inventorySwapPresentation(local); button.textContent = swap?.label || (readout.sword && local?.hasGun ? 'GUN' : 'KNIFE'); button.setAttribute('aria-label', swap?.ariaLabel || (readout.sword && local?.hasGun ? 'Switch to scavenged gun' : 'Switch to small knife')); button.setAttribute('aria-pressed', String(readout.sword)); } if (action === 'aim') paintSecondaryAction(button, secondaryActionPresentation(local, { active: controlsActive() && phase === 'fight', requireGun: true })); if (['sprint', 'walk', 'crouch'].includes(action)) button.setAttribute('aria-pressed', String(!!currentInput()[action])); }
    setText($('objective'), phase === 'lobby' ? room.capacity === 2 ? 'Invite your rival. The host starts with both players here.' : `The host can start with 2–${room.capacity} players.` : phase === 'countdown' ? 'Random spawns. Scavenge a gun when the battle begins.' : phase === 'fight' ? local?.alive ? 'Scavenge supplies. Stay inside the zone. Be the last alive.' : 'One life spent. Watch the remaining survivors.' : 'Battle complete. The host can return everyone to the lobby.');
    let overlay = false, title = '', kicker = '', subtitle = '', enter = false;
    if (graphicsError) { overlay = true; kicker = 'GRAPHICS UNAVAILABLE'; title = 'The island could not render.'; subtitle = graphicsError; }
    else if (!connected) { overlay = true; kicker = 'CONNECTING TO THE HOST'; title = permanentError ? 'This room is unavailable.' : 'Waiting for the host.'; subtitle = permanentError ? 'Return to the shelf to create a room or join the next battle.' : 'Your controls are released while the connection recovers.'; }
    else if (phase === 'lobby') { overlay = true; kicker = `${state?.mapName || 'PRIVATE ISLAND'} / ${count} PLAYERS`; title = isHost ? count >= 2 ? 'Your rivals are here.' : 'Gather your rivals.' : 'Waiting for the host.'; subtitle = isHost ? count >= 2 ? count >= room.capacity ? 'Everyone is here. Start when you are ready.' : `Start with the players here, or invite more. This room holds up to ${room.capacity} players.` : 'Share your invite with at least one other player. You choose when the battle begins.' : `${lookupName(hostId)} starts the battle when everyone is here. You do not need to ready up.`; }
    else if (phase === 'matchEnd') { overlay = true; const winner = state.winnerId ?? state.winner; kicker = 'BATTLE COMPLETE'; title = winner == null ? 'No one left standing.' : winner === playerId ? 'You outlasted everyone.' : `${lookupName(winner)} survives.`; subtitle = `${placement ? `You placed #${placement.place}. ` : ''}${local?.kills || 0} eliminations. ${isHost ? 'Return to the lobby to invite players and go again.' : 'The host can open the lobby for another battle.'}`; }
    else if (local?.alive && (paused || !entered) && !modalOpen) { overlay = true; kicker = entered ? 'CONTROLS RELEASED' : 'YOUR ONE LIFE STARTS HERE'; title = entered ? 'Controls released.' : 'Enter the arena.'; subtitle = 'You start with a small knife and 200 health. Find a gun and supplies, then keep moving with the safe zone. The battle keeps running while controls are released.'; enter = true; }
    setHidden($('game-overlay'), !overlay); setText($('overlay-kicker'), kicker); setText($('overlay-title'), title); setText($('overlay-subtitle'), subtitle); setHidden($('enter-arena'), !enter); setHidden($('retry-graphics'), !graphicsError); setHidden($('aim-note'), !enter); setText($('aim-note'), touchMode ? 'Move / Look pads. AIM becomes STAB with a knife or PARRY with another blade.' : 'RMB: gun sights / knife stab / blade parry. If capture is unavailable, hold RMB and drag to look.');
    setHidden($('phase-announcement'), phase !== 'countdown' || overlay || modalOpen || !connected); setText($('countdown-number'), Math.max(1, Math.ceil(finite(state?.phaseTicks) / 120))); renderRoster();
  }
  function playEvents(events = []) {
    const fresh = [], impactSounds = new Set();
    const impactOptions = { lifeKey: `${state?.mapId}:${state?.matchId}`, viewedId: spectatorPlayer(state, playerId, spectatorId)?.id, gain: .22 };
    for (const event of events) {
      const id = event.id ?? `${state?.tick}:${event.type}:${event.playerId ?? event.attackerId ?? ''}:${event.targetId ?? ''}`;
      if (eventSeen.has(id)) continue; eventSeen.add(id); eventOrder.push(id); fresh.push(event); if (eventOrder.length > 512) eventSeen.delete(eventOrder.shift());
      const source = event.shooterId ?? event.attackerId ?? event.playerId ?? event.ownerId, target = event.targetId;
      const meleeImpact = meleeImpacts.consume(event, playerId, impactOptions);
      const inventoryFeedback = source === playerId ? inventoryEventFeedback(event) : null; if (inventoryFeedback) toast(inventoryFeedback);
      if (event.type === 'damage' && event.damage > 0) { const incoming = incomingDamageFeedback(event, spectatorPlayer(state, playerId, spectatorId), state.players, { now: performance.now(), lifeKey: state.matchId, friendlyFire: true }); if (incoming) damageFeedback = incoming; }
      if (['kill', 'elimination', 'death'].includes(event.type)) {
        kills.push({ at: performance.now(), own: source === playerId && target !== playerId, text: `${source == null ? 'THE STORM' : source === target ? 'SELF FRAG' : lookupName(source)} ${event.headshot ? '[HS]' : '›'} ${lookupName(target)}` }); if (kills.length > 4) kills.shift();
      }
      if (source === playerId && ['healStart', 'healCancel', 'healComplete'].includes(event.type)) { feedbackUntil = performance.now() + 1100; setText($('combat-feedback'), event.type === 'healComplete' ? `HEALED +${Math.round(event.amount || 0)} HP` : event.type === 'healCancel' ? 'HEALING INTERRUPTED' : 'DRINKING POTION'); if (event.type === 'healComplete') { healthGain = Math.max(0, Math.round(event.amount || 0)); healthGainUntil = performance.now() + 1400; } }
      if (event.type === 'lootPickup' && source === playerId) toast(event.kind === 'weapon' ? `${WEAPONS[event.weapon]?.label || 'Weapon'} equipped.` : event.kind === 'heal' ? 'Healing potion collected.' : event.kind === 'grenade' ? 'Frag grenade collected.' : 'Ammunition collected.');
      if (!audio.enabled) continue;
      try {
        if (['shot', 'fire', 'boltLaunch'].includes(event.type) && (event.pellet == null || event.pellet === 0)) audio.gunshot(event.weapon, { gain: source === playerId ? 1 : .3 });
        else if (event.type === 'damage' && !meleeImpact && target === playerId) { const key = `${event.tick}:${target === playerId ? 'in' : 'out'}`; if (impactSounds.has(key)) continue; impactSounds.add(key); audio.tone(130, .055, { end: 70, type: 'triangle', gain: .22 }); }
        else if (event.type === 'meleeStart') audio.meleeSwing(event.weapon, { gain: source === playerId ? 1 : .3 });
        else if (event.type === 'explosion' || event.type === 'grenadeExplosion') { audio.noise(.45, { highpass: 30, lowpass: 1700, gain: .4 }); audio.tone(65, .42, { end: 28, gain: .22 }); }
        else if (event.type === 'healComplete' && source === playerId) audio.tone(660, .13, { end: 920, type: 'triangle', gain: .15 });
      } catch { /* Optional sound cannot interrupt the match. */ }
    }
    gunImpacts.consume(fresh, playerId, { context: `${state.mapId}:${state.matchId}`, viewedId: spectatorPlayer(state, playerId, spectatorId)?.id });
    parryAudio.consume(fresh, playerId, { context: `${state.mapId}:${state.matchId}`, viewedId: spectatorPlayer(state, playerId, spectatorId)?.id, active: connected && !paused && !modalOpen && state.phase === 'fight' });
    hitFeedback.consume(fresh, ownPlayer(), state.players, { now: performance.now(), lifeKey: `${state.mapId}:${state.matchId}:${ownPlayer()?.lifeId || 0}`, active: state.phase === 'fight' && !paused && !modalOpen && connected });
    const hits = confirmedHitGroups(fresh, playerId); if (hits.length) { const hit = hits.reduce((best, next) => next.damage > best.damage ? next : best); const killed = fresh.some(event => ['kill', 'elimination', 'death'].includes(event.type) && event.targetId === hit.targetId && (event.attackerId ?? event.shooterId ?? event.playerId) === playerId); feedbackUntil = performance.now() + (killed ? 1100 : 650); setText($('combat-feedback'), `${hit.label} · ${Math.round(hit.damage)} HP${killed ? ' · ELIMINATED' : ''}`); }
  }
  function draw(now = performance.now()) {
    if (!renderer?.available || !state || graphicsError || document.hidden) { clearReticle(); reloadAudio.suspend(); paintVitals(null, 'Your', false); return; }
    const rendered = interpolatedState(snapshots, timeline.time(now), playerId, { predictMovement: engine.predictLocalMovement, traceProjectile: engine.traceShot, combatTime: timeline.currentTime(now) }) || { ...state, players: state.players.map(player => ({ ...player })) };
    const local = ownPlayer();
    presentationPlayer = predictedPlayer || local;
    if (state.phase === 'fight' && presentationPlayer?.alive) presentationPlayer = presentMovement(presentationPlayer, actionInputs.preview(currentInput(), now), state.map, accumulator, engine.predictLocalMovement, state.players);
    const newest = snapshots[snapshots.length - 1], previous = snapshots[snapshots.length - 2];
    const visualCombat = local && combatPresentation(local, previous?.state.players.find(player => player.id === playerId) || local, 1, Math.max(0, timeline.currentTime(now) - (newest?.time || 0)));
    presentationPlayer = withCombatPresentation(presentationPlayer, visualCombat);
    presentationPlayer = correction.present(presentationPlayer, now, engine.sweepPresentationOffset, state.map, state.players);
    presentationPlayers = resolvePresentationContacts(rendered.players.map(player => local?.alive && player.id === playerId ? presentationPlayer : player), state.map,
      { anchorId: local?.alive ? playerId : undefined, authoritativePlayers: state.players });
    rendered.players = presentationPlayers; rendered.fighters = presentationPlayers;
    if (local?.alive) presentationPlayer = presentationPlayers.find(player => player.id === playerId) || presentationPlayer;
    const viewed = spectatorPlayer(rendered, playerId, spectatorId);
    const camera = state.phase === 'lobby' ? { ...state.map.spawnPoints[0], alive: false, id: playerId, y: finite(state.map.spawnPoints[0]?.y) } : local?.alive ? presentationPlayer : viewed;
    const viewAim = local?.alive ? aim : cleanAim(camera?.yaw, camera?.pitch);
    renderer.render(rendered, { acceptedPlayers: state.players, playerId, localId: playerId, localPlayer: presentationPlayer, viewPlayer: camera, yaw: viewAim.yaw, pitch: viewAim.pitch + finite(camera?.recoil), time: now }); renderCount++;
    reticleView = presentCrosshair(camera, now, `${state.mapId}:${state.matchId}:${state.round}:${state.phase}`, { width: canvas.clientWidth, height: canvas.clientHeight, rules: engine.ADS, active: controlsActive() && state.phase === 'fight', reducedMotion: hitMotion.matches });
    paintCrosshair(hitElements.crosshair, reticleView); setHidden(hitElements.scope, !reticleView.visible || !reticleView.scoped);
    setText($('scope-label'), `${WEAPONS[camera?.weapon]?.label || 'PRECISION'} / PRECISION SIGHT`);
    paintVitals(camera, camera?.id !== playerId ? `${lookupName(camera?.id)}’s` : 'Your', connected && !paused && !modalOpen && ['countdown', 'fight'].includes(state.phase));
    reloadAudio.observe(state.players.find(player => player.id === camera?.id), { tick: state.tick, context: `${state.mapId}:${state.matchId}:${state.round}`, active: connected && !paused && !modalOpen && state.phase === 'fight' });
    paintHitFeedback(hitElements, hitFeedback.present(local, { now, lifeKey: `${state.mapId}:${state.matchId}:${local?.lifeId || 0}`, active: state.phase === 'fight' && !paused && !modalOpen && connected, reducedMotion: hitMotion.matches })); paintDamageFeedback($('damage-cue'), damageFeedbackPresentation(damageFeedback, camera, { now, lifeKey: state.matchId, yaw: viewAim.yaw, active: state.phase === 'fight' })); setHidden($('combat-feedback'), now >= feedbackUntil);
    while (kills.length && now - kills[0].at > 6000) kills.shift(); const signature = kills.map(item => item.text).join('|');
    if ($('kill-feed').dataset.signature !== signature) { $('kill-feed').dataset.signature = signature; $('kill-feed').replaceChildren(...kills.map(kill => { const item = document.createElement('li'); item.textContent = kill.text; item.classList.toggle('own-kill', kill.own); return item; })); }
  }
  function activeAnimation() { return connected && state && !document.hidden && !graphicsError && ['countdown', 'fight'].includes(state.phase); }
  function frame(now) {
    frameId = null; if (destroyed || !activeAnimation()) { lastFrameAt = 0; return; }
    weaponWheel.flush();
    const dt = lastFrameAt ? Math.min(.0667, (now - lastFrameAt) / 1000) : 0; lastFrameAt = now; integrateTouchLook(now); accumulator += dt;
    const buttons = currentInput(); let ticks = 0;
    while (accumulator >= 1 / 120 && ticks++ < 8) { accumulator -= 1 / 120; const tick = ++predictionTick; if (state.phase === 'fight' && predictedPlayer?.alive) { const sampled = actionInputs.sample(buttons, now).buttons; engine.predictLocalMovement(predictedPlayer, sampled, state.map, 1, state.players); pending.push({ tick, buttons: { ...sampled } }); if (pending.length > 240) pending.shift(); } }
    if (ticks) sendInput(buttons);
    if (predictedPlayer) { predictedPlayer.yaw = aim.yaw; predictedPlayer.pitch = aim.pitch; }
    draw(now); if (now - lastHUDAt >= 80) { updateUI(); lastHUDAt = now; } frameId = requestAnimationFrame(frame);
  }
  function wake() {
    if (!frameId && activeAnimation()) { idleSignature = ''; lastFrameAt = 0; frameId = requestAnimationFrame(frame); }
    else if (!activeAnimation()) { const signature = JSON.stringify([state?.mapId, state?.phase, playerId, spectatorId, state?.winner, state?.players?.map(player => [player.id, player.x, player.y, player.z, player.alive])]); if (signature !== idleSignature) { idleSignature = signature; draw(); } }
  }
  function receiveState(message) {
    const next = message.state; if (!next?.players || !engine?.MAPS?.[next.mapId]) return;
    const old = state; state = { ...next, map: engine.MAPS[next.mapId] }; state.fighters = state.players;
    capacity = roomPresentation(next, [], message.capacity ?? capacity).capacity;
    hostId = message.hostId ?? next.hostId ?? hostId;
    roster = (Array.isArray(message.players) ? message.players : Object.values(message.players || {})).map((person, id) => person ? { ...person, id: person.id ?? id } : null);
    const local = ownPlayer(), fresh = previousMatch !== state.matchId || previousPhase === 'lobby' && state.phase !== 'lobby';
    const reconciliationTime = performance.now();
    const beforePrediction = predictedPlayer;
    const beforePose = beforePrediction && old?.phase === 'fight' ? presentMovement(beforePrediction, actionInputs.preview(currentInput(), reconciliationTime), old.map, accumulator, engine.predictLocalMovement, old.players) : beforePrediction;
    if (!old || predictedPlayer?.id !== playerId || fresh) { neutralize(); aim = cleanAim(local?.yaw, local?.pitch); pending = []; snapshots = []; spectatorId = null; accumulator = 0; renderer?.resetEffects(); healthView = null; damageFeedback = null; if (fresh) { eventSeen.clear(); eventOrder.length = 0; kills.length = 0; feedbackUntil = 0; hitFeedback.reset({ clearHistory: true }); damageFeedback = null; meleeImpacts.reset(); gunImpacts.reset(); parryAudio.reset(); reloadAudio.reset(); healthGainUntil = 0; lastCountdown = null; } sendInput(neutralInput(aim.yaw, aim.pitch), true); }
    if (previousPhase !== null && previousPhase !== state.phase) neutralize();
    if (state.phase === 'lobby' && previousPhase !== 'lobby') { neutralize({ pause: true, unlock: true }); entered = false; fallback = false; healthView = null; damageFeedback = null; snapshots = []; pending = []; audio.resetEvents(); meleeImpacts.reset(); gunImpacts.reset(); parryAudio.reset(); reloadAudio.reset(); }
    if (local && !local.alive && old?.players?.find(player => player.id === playerId)?.alive !== false) neutralize({ pause: true, unlock: true });
    if (state.phase === 'matchEnd' && previousPhase !== 'matchEnd') neutralize({ pause: true, unlock: true });
    const ackValue = message.acks?.[playerId], ack = typeof ackValue === 'number' ? ackValue : ackValue?.seq ?? -1;
    if (local) {
      const result = reconcilePlayer(local, pending, ack, state.map, engine.predictLocalMovement, state.phase === 'fight', state.players, state.tick);
      predictedPlayer = result.predicted; pending = result.pending; predictionTick = result.predictionTick; predictedPlayer.yaw = aim.yaw; predictedPlayer.pitch = aim.pitch;
      const afterPose = state.phase === 'fight' ? presentMovement(predictedPlayer, actionInputs.preview(currentInput(), reconciliationTime), state.map, accumulator, engine.predictLocalMovement, state.players) : predictedPlayer;
      correction.correct(beforePose, afterPose, reconciliationTime, { continuous: old?.phase === 'fight' && state.phase === 'fight' && old.matchId === state.matchId && old.mapId === state.mapId });
    }
    const receivedAt = performance.now(), sample = timeline.sample(state, receivedAt, `${state.mapId}:${state.matchId}:${state.phase}`);
    if (sample) {
      const previous = snapshots[snapshots.length - 1]?.state;
      if (previous && (previous.phase !== state.phase || previous.matchId !== state.matchId || previous.mapId !== state.mapId)) snapshots = [];
      snapshots.push(sample); if (snapshots.length > 12) snapshots.shift();
    } playEvents(state.events || message.events || []);
    if (state.phase === 'countdown') { const number = Math.ceil(finite(state.phaseTicks) / 120); if (number !== lastCountdown) { audio.countdown(number); lastCountdown = number; } }
    if (state.phase === 'fight' && previousPhase !== 'fight') audio.fight(); previousPhase = state.phase; previousMatch = state.matchId;
    if (!activeAnimation() || receivedAt - lastHUDAt >= 80 || hudKey() !== paintedHUDKey) updateUI();
    wake();
  }
  function connect() {
    clearTimeout(reconnectTimer); if (destroyed || permanentError) return;
    if (!/^[A-Z0-9]{6}$/.test(roomId)) { permanentError = true; error('This invite needs a valid room code. Return to Semag to create or join Voxel Royale.'); updateUI(); return; }
    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws?room=${encodeURIComponent(roomId)}`); socket = ws;
    ws.addEventListener('open', () => { if (socket !== ws) return; connected = true; reconnectAttempts = 0; sequence = 0; pending = []; snapshots = []; wirePacer.reset(); timeline.reset(); correction.reset(); error(''); send({ type: 'join', name: playerName }); updateUI(); });
    ws.addEventListener('message', ({ data }) => { if (socket !== ws || destroyed) return; let message; try { message = JSON.parse(data); } catch { return; }
      if (message.type === 'welcome') { if (message.gameId !== 'voxel-royale') { permanentError = true; location.replace(roomUrl({ id: roomId, gameId: message.gameId })); return; } neutralize({ pause: true, unlock: true }); playerId = message.playerId; hostId = message.hostId ?? hostId; capacity = roomPresentation(null, [], message.capacity).capacity; sequence = 0; pending = []; entered = false; fallback = false; aim = cleanAim(ownPlayer()?.yaw, ownPlayer()?.pitch); updateUI(); }
      else if (message.type === 'state') receiveState(message);
      else if (message.type === 'pong') setText($('ping'), `${Math.max(0, Math.round(performance.now() - message.time))} ms`);
      else if (message.type === 'error') { error(message.message || 'The host could not accept that action.'); if (/room.*(?:full|not found|expired|in progress|already started)|unknown room|all.*occupied/i.test(message.message || '')) permanentError = true; }
    });
    ws.addEventListener('close', event => { if (socket !== ws || destroyed) return; connected = false; neutralize({ pause: true, unlock: true }); playerId = null; pending = []; snapshots = []; timeline.reset(); correction.reset(); setText($('ping'), '— ms'); if ([4403, 4404, 4409].includes(event.code)) permanentError = true; if (frameId) cancelAnimationFrame(frameId); frameId = null; lastFrameAt = 0; updateUI(); if (!permanentError) { error('Connection lost. Reconnecting automatically. If the battle has started, join again when the host opens the lobby.'); reconnectTimer = setTimeout(connect, Math.min(5000, 750 * 2 ** reconnectAttempts++)); } });
    ws.addEventListener('error', () => {});
  }
  async function enterArena(event) {
    if (!connected || !ownPlayer()?.alive || graphicsError || !['countdown', 'fight'].includes(state?.phase)) return;
    neutralize(); entered = true; paused = false; touchMode ||= event?.pointerType === 'touch' || matchMedia('(pointer: coarse)').matches; canvas.focus({ preventScroll: true });
    if (touchMode) { fallback = false; updateUI(); wake(); return; } fallback = false;
    if (!canvas.requestPointerLock) { fallback = true; updateUI(); wake(); return; }
    try { const request = canvas.requestPointerLock(); if (request?.then) await request; if (!pointerLocked()) { fallback = true; toast('Mouse capture unavailable. Hold right mouse and drag to look.'); } } catch { fallback = true; toast('Mouse capture unavailable. Hold right mouse and drag to look.'); }
    updateUI(); wake();
  }
  function positionLayoutPicker() {
    if (document.fullscreenElement || !$('room-dialog').hidden) $('room-keyboard-host').append(layoutPickerHost);
    else layoutPickerHome.insertBefore(layoutPickerHost, $('sound-button'));
  }
  function setDialog(kind) {
    modalOpen = !!kind;
    setHidden($('room-dialog'), kind !== 'room');
    setHidden($('guide-dialog'), kind !== 'guide');
    positionLayoutPicker();
    setAttribute($('room-panel-button'), 'aria-expanded', String(kind === 'room'));
    for (const id of ['guide-button', 'arena-guide-button']) $(id).setAttribute('aria-expanded', String(kind === 'guide'));
    // Keep the active dialog reachable in fullscreen and remove the background from Tab order.
    for (const element of document.querySelector('.royale-app').children) {
      if (element !== $('game-shell')) element.inert = modalOpen;
    }
    for (const element of $('game-shell').children) {
      if (element !== $('room-dialog') && element !== $('guide-dialog')) element.inert = modalOpen;
    }
  }
  function restoreDialogFocus() {
    const target = dialogReturnFocus?.isConnected && !dialogReturnFocus.closest('[hidden], [inert]') ? dialogReturnFocus : $('room-panel-button');
    target.focus({ preventScroll: true });
  }
  function openRoom(event) {
    dialogReturnFocus = event?.currentTarget || document.activeElement;
    guideReturnToRoom = false; setDialog('room');
    neutralize({ pause: true, unlock: true }); $('close-room').focus({ preventScroll: true });
  }
  function closeRoom() { setDialog(null); updateUI(); restoreDialogFocus(); }
  function openGuide(event) {
    guideReturnToRoom = !$('room-dialog').hidden;
    if (!guideReturnToRoom) dialogReturnFocus = event?.currentTarget || document.activeElement;
    setDialog('guide'); neutralize({ pause: true, unlock: true }); $('close-guide').focus({ preventScroll: true });
  }
  function closeGuide() {
    const returnToRoom = guideReturnToRoom; guideReturnToRoom = false;
    setDialog(returnToRoom ? 'room' : null); updateUI();
    if (returnToRoom) $('room-guide-button').focus({ preventScroll: true }); else restoreDialogFocus();
  }
  function trapDialogTab(event) {
    if (event.key !== 'Tab') return;
    const items = [...event.currentTarget.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]')].filter(element => element.getClientRects().length && !element.closest('[hidden]'));
    const first = items[0], last = items.at(-1); if (!first) return;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  function updateKeyLabels() { setText($('move-keys'), getKeyboardLayout().toUpperCase()); for (const label of document.querySelectorAll('[data-royale-key]')) label.textContent = displayKey(label.dataset.royaleKey); canvas.setAttribute('aria-label', `3D battle royale. ${getKeyboardLayout().toUpperCase()} or arrows move; mouse looks; left click uses your selected item; right click aims guns, stabs with a knife or parries with other blades; 1 to 4 equip inventory slots; wheel up or down switches carried weapons; X drops the selected item; E picks up loot; V swaps blade and gun; ${displayKey('Q')} throws grenade; F heals; R reloads; Space jumps; Control crouches; Shift sprints, C walks quietly; Escape releases controls.`); }
  const unsubscribeLayout = subscribeKeyboardLayout(() => { neutralize({ pause: entered, unlock: true }); updateKeyLabels(); }); updateKeyLabels();
  listen(window, 'keydown', event => { if (event.defaultPrevented || event.isComposing || event.altKey || event.metaKey) return; if (event.key === 'Escape') { if (modalOpen) { if (!$('guide-dialog').hidden) closeGuide(); else closeRoom(); } else if (entered) neutralize({ pause: true, unlock: true }); return; } if (event.key.toLowerCase() === 'p' && !isFormTarget(event.target) && entered) { event.preventDefault(); neutralize({ pause: true, unlock: true }); return; } if (!controlsActive() || isFormTarget(event.target)) return; const action = controlForKey(event); if (!action) return; event.preventDefault(); const id = event.code || event.key; if (pressedKeys.has(id) || event.repeat) return; if (/^slot[1-4]$/.test(action) || ['drop', 'swap'].includes(action)) weaponWheel.reset(); pressedKeys.set(id, action); keys.add(action); utilityFeedback(action); sendInput(currentInput(), true); });
  listen(window, 'keyup', event => { const id = event.code || event.key, action = pressedKeys.get(id); pressedKeys.delete(id); if (action && ![...pressedKeys.values()].includes(action)) keys.delete(action); if (action) { sendInput(currentInput(), true); if (!isFormTarget(event.target)) event.preventDefault(); } });
  listen(document, 'focusin', event => { if (isFormTarget(event.target) && !actionPointers.size && !padPointers.size) neutralize(); });
  listen(window, 'blur', () => neutralize({ pause: entered, unlock: true }));
  listen(document, 'visibilitychange', () => { if (document.hidden) { neutralize({ pause: entered, unlock: true }); if (frameId) cancelAnimationFrame(frameId); frameId = null; lastFrameAt = 0; } else { renderer?.resize(); updateUI(); wake(); } });
  listen(document, 'pointerlockchange', () => { if (pointerLocked()) { fallback = false; paused = false; entered = true; updateUI(); wake(); } else if (entered && !fallback && !touchMode && ownPlayer()?.alive) neutralize({ pause: true }); });
  listen(document, 'pointerlockerror', () => { if (entered && !modalOpen) { fallback = true; paused = false; updateUI(); toast('Hold right mouse and drag to look. Left click fires.'); } });
  listen(canvas, 'mousedown', event => { if (!controlsActive()) return; event.preventDefault(); canvas.focus({ preventScroll: true }); if (event.button === 0) mouse.fire = true; if (event.button === 2) { mouse.aim = true; if (fallback) rightDrag = true; } if ([0, 2].includes(event.button)) sendInput(currentInput(), true); });
  listen(window, 'mouseup', event => { if (event.button === 0) mouse.fire = false; if (event.button === 2) { mouse.aim = false; rightDrag = false; } if (entered && [0, 2].includes(event.button)) sendInput(currentInput(), true); });
  listen(document, 'mousemove', event => { if (!controlsActive() || !(pointerLocked() || fallback && rightDrag)) return; const sensitivity = LOOK_SENSITIVITY * aimLookMultiplier(presentationPlayer || ownPlayer(), engine?.ADS); aim = cleanAim(aim.yaw + event.movementX * sensitivity, aim.pitch - event.movementY * sensitivity); sendInput(); });
  listen(canvas, 'contextmenu', event => event.preventDefault()); listen(canvas, 'click', event => { if (!entered || paused) enterArena(event); }); listen($('enter-arena'), 'click', enterArena);
  listen($('pause-button'), 'click', () => neutralize({ pause: true, unlock: true }));
  listen($('guide-button'), 'click', openGuide); listen($('close-guide'), 'click', closeGuide); listen($('close-guide-bottom'), 'click', closeGuide); listen($('guide-dialog'), 'click', event => { if (event.target === $('guide-dialog')) closeGuide(); });
  listen($('guide-dialog'), 'keydown', trapDialogTab);
  listen($('room-dialog'), 'keydown', trapDialogTab);
  listen($('room-dialog'), 'click', event => { if (event.target === $('room-dialog')) closeRoom(); });
  listen($('room-panel-button'), 'click', openRoom); listen($('overlay-room'), 'click', openRoom);
  listen($('close-room'), 'click', closeRoom); listen($('close-room-bottom'), 'click', closeRoom);
  listen($('arena-guide-button'), 'click', openGuide); listen($('room-guide-button'), 'click', openGuide);
  const startBattle = () => { playerName = saveName($('player-name').value); $('player-name').value = playerName; send({ type: 'join', name: playerName }); neutralize({ pause: true, unlock: true }); send({ type: 'start' }); };
  listen($('overlay-rematch'), 'click', () => $('rematch-button').click());
  listen($('start-button'), 'click', startBattle); listen($('overlay-start'), 'click', startBattle); listen($('rematch-button'), 'click', () => send({ type: 'rematch' }));
  listen($('player-name'), 'change', () => { playerName = saveName($('player-name').value); $('player-name').value = playerName; send({ type: 'join', name: playerName }); });
  listen($('next-spectator'), 'click', () => { const alive = aliveParticipants(state); spectatorId = alive[(alive.findIndex(player => player.id === spectatorId) + 1) % Math.max(1, alive.length)]?.id ?? null; healthView = null; updateUI(); draw(); });
  listen($('sound-button'), 'click', async () => { const enabled = await audio.setEnabled(!audio.enabled); setAttribute($('sound-button'), 'aria-pressed', String(enabled)); setAttribute($('sound-button'), 'aria-label', enabled ? 'Mute sound' : 'Enable sound'); toast(enabled ? 'Sound on.' : 'Sound off.'); });
  async function toggleFullscreen() {
    neutralize({ pause: entered, unlock: true });
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await $('game-shell').requestFullscreen(); }
    catch { toast('Fullscreen is unavailable in this browser.'); }
  }
  listen($('fullscreen-button'), 'click', toggleFullscreen); listen($('arena-fullscreen-button'), 'click', toggleFullscreen);
  listen(document, 'fullscreenchange', () => {
    positionLayoutPicker(); renderer?.resize(); draw();
    for (const id of ['fullscreen-button', 'arena-fullscreen-button']) {
      const label = document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen'; $(id).setAttribute('aria-label', label); $(id).title = label;
    }
  });
  listen($('retry-graphics'), 'click', () => location.reload());
  listen(canvas, 'voxel-renderer-error', event => { graphicsError = event.detail?.message || 'Graphics were interrupted. Reload to try again.'; neutralize({ pause: true, unlock: true }); error(graphicsError); });
  listen(canvas, 'voxel-renderer-restored', () => { graphicsError = ''; error(''); renderer?.resize(); idleSignature = ''; updateUI(); draw(); wake(); }); listen(window, 'resize', () => { renderer?.resize(); draw(); });
  for (const pad of document.querySelectorAll('[data-royale-pad]')) {
    function movePad(event) { const record = padPointers.get(event.pointerId); if (!record || record.element !== pad) return; const before = currentInput(), rect = pad.getBoundingClientRect(), radius = Math.max(20, Math.min(rect.width, rect.height) * .37); let x = (event.clientX - record.startX) / radius, y = (event.clientY - record.startY) / radius; const length = Math.hypot(x, y); if (length > 1) { x /= length; y /= length; } if (pad.dataset.royalePad === 'look') integrateTouchLook(); touch[pad.dataset.royalePad === 'look' ? 'look' : 'move'] = { x, y }; pad.querySelector('i').style.transform = `translate(${x * radius * .55}px, ${y * radius * .55}px)`; const after = currentInput(); sendInput(after, INPUT_ACTIONS.some(action => before[action] !== after[action])); }
    listen(pad, 'pointerdown', event => { if (!entered || paused || !ownPlayer()?.alive || modalOpen || !connected) return; event.preventDefault(); for (const record of padPointers.values()) if (record.element === pad) return; touchMode = true; fallback = false; padPointers.set(event.pointerId, { element: pad, startX: event.clientX, startY: event.clientY }); pad.setPointerCapture(event.pointerId); pad.classList.add('active'); movePad(event); updateUI(); });
    listen(pad, 'pointermove', event => { if (padPointers.has(event.pointerId)) { event.preventDefault(); movePad(event); } });
    const end = event => { const record = padPointers.get(event.pointerId); if (!record || record.element !== pad) return; if (pad.dataset.royalePad === 'look') integrateTouchLook(); padPointers.delete(event.pointerId); touch[pad.dataset.royalePad === 'look' ? 'look' : 'move'] = { x: 0, y: 0 }; pad.classList.remove('active'); pad.querySelector('i').style.transform = ''; sendInput(currentInput(), true); };
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(pad, name, end);
  }
  for (const button of document.querySelectorAll('[data-royale-action]')) {
    listen(button, 'pointerdown', event => {
      if (!controlsActive()) return; event.preventDefault();
      const action = button.dataset.royaleAction, wasHeld = currentInput()[action];
      if (/^slot[1-4]$/.test(action) || ['drop', 'swap'].includes(action)) weaponWheel.reset();
      utilityFeedback(action);
      const pointer = { element: button, action, pressSeq: null }; actionPointers.set(event.pointerId, pointer);
      touch.actions.add(action); button.classList.add('pressed'); button.setPointerCapture(event.pointerId);
      const sent = sendInput(currentInput(), true); if (!wasHeld) pointer.pressSeq = sent;
    });
    const end = event => {
      const pointer = actionPointers.get(event.pointerId); if (pointer?.element !== button) return;
      actionPointers.delete(event.pointerId);
      const cancelPress = releaseFpsTouchAction(pointer, actionPointers, touch.actions, action => currentInput()[action], event.type !== 'pointerup');
      sendInput(currentInput(), true, performance.now(), false, cancelPress);
    };
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(button, name, end); listen(button, 'contextmenu', event => event.preventDefault());
  }
  let invite = `${location.origin}/voxel-royale.html?room=${encodeURIComponent(roomId)}`; setText($('invite-address'), invite);
  hostInfo().then(info => { invite = `${info.origin}/voxel-royale.html?room=${encodeURIComponent(roomId)}`; setText($('invite-address'), invite); }).catch(() => {});
  listen($('copy-code'), 'click', async () => { try { await copyText(roomId); toast('Room code copied.'); } catch (cause) { toast(cause.message); } }); listen($('copy-invite'), 'click', async () => { try { await copyText(invite); toast('Invite link copied.'); } catch (cause) { toast(cause.message); } });
  const pingTimer = setInterval(() => { if (connected && !document.hidden) send({ type: 'ping', time: performance.now() }); }, 1500);
  function destroy() { if (destroyed) return; neutralize({ pause: true, unlock: true }); destroyed = true; clearTimeout(reconnectTimer); clearTimeout(toastTimer); clearInterval(pingTimer); clearInterval(heartbeat); heartbeat = null; if (frameId) cancelAnimationFrame(frameId); frameId = null; socket?.close(); renderer?.destroy(); audio.destroy(); inventory.destroy(); weaponWheel.destroy(); layoutPicker.destroy(); unsubscribeLayout(); for (const remove of removers) remove(); pending = []; snapshots = []; kills.length = 0; eventSeen.clear(); }
  listen(window, 'pagehide', destroy);
  const inspect = () => { const { map, ...snapshot } = state || {}; return clone({ state: state ? snapshot : null, players: roster, playerId, hostId, input: currentInput(), predictedPlayer, presentationPlayer, presentationPlayers, predictionRemainder: accumulator, predictionTick, actionQueue: actionInputs.inspect(), timeline: timeline.getState(), correction: correction.getState(), connected, controls: { pointerLocked: pointerLocked(), fallback, touch: touchMode, paused, entered, modalOpen }, queueLength: pending.length, renderCount, crosshair: reticleView, renderStats: renderer?.stats || null, audio: audio.inspectGunshots(), meleeAudio: audio.inspectMelee(), meleeImpactAudio: meleeImpacts.inspect(), reloadAudio: reloadAudio.inspect(), reloadSounds: audio.inspectReloads(), gunImpactAudio: gunImpacts.inspect(), parryAudio: parryAudio.inspect(), parrySounds: audio.inspectParries(), stamina: staminaView, weaponWheel: weaponWheel.inspect(), graphicsError, spectatorId }); };
  window.SemagRoyale = Object.freeze({ getState: inspect, inspect }); updateUI();
  try { const [rules, visual] = await Promise.all([import('./voxel-royale-engine.js'), import('./voxel-renderer.js')]); if (destroyed) return; engine = { ...rules, predictLocalMovement, sweepPresentationOffset, traceShot, ADS, HEAL, PLAYER_HEALTH }; renderer = new visual.VoxelRenderer(canvas); renderer.resize(); } catch (cause) { graphicsError = cause?.message || 'This game requires WebGL. Enable hardware acceleration and reload graphics.'; error(graphicsError); updateUI(); return; }
  connect();
}
if (typeof document !== 'undefined' && document.querySelector('.royale-app') && document.getElementById('arena')) boot().catch(cause => { const banner = document.getElementById('error-banner'); banner.hidden = false; banner.textContent = `The game could not start: ${cause.message}. Reload to try again.`; });
