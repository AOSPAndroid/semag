import { displayKey, gameKey, getKeyboardLayout, mountKeyboardLayoutPicker, subscribeKeyboardLayout } from './keyboard-layout.js';
import { copyText, getName, hostInfo, roomUrl, saveName } from './hub/shared.js';
import { GameAudio } from './audio.js';
import { WEAPONS, WEAPON_IDS, weaponAimFovRatio, weaponSpread, weaponStats } from './voxel-weapons.js';
import { advanceBolts, MAX_BOLTS } from './voxel-projectiles.js';

export const LOOK_SENSITIVITY = 0.0025;
export const FPS_BUTTONS = Object.freeze(['up', 'down', 'left', 'right', 'jump', 'crouch', 'walk', 'fire', 'reload', 'interact', 'aim', 'swap', 'grenade', 'heal']);
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
  if (event.defaultPrevented || event.isComposing || event.altKey || event.metaKey) return null;
  const key = gameKey(event, layout).toLowerCase();
  const action = ({ w: 'up', arrowup: 'up', s: 'down', arrowdown: 'down', a: 'left', arrowleft: 'left', d: 'right', arrowright: 'right', ' ': 'jump', control: 'crouch', shift: 'walk', r: 'reload', e: 'interact', v: 'swap', q: 'grenade', g: 'grenade', f: 'heal', h: 'heal' })[key] || null;
  // Ctrl is the crouch control, so captured gameplay actions must work while it is held.
  return action;
}

export function isFormTarget(target) {
  return !!(target?.isContentEditable || target?.closest?.('input, select, textarea, button, a, [contenteditable]:not([contenteditable="false"]), [role="dialog"]'));
}

export function composeInput(keys, touch, mouse, aim, active = true) {
  const input = neutralInput(aim.yaw, aim.pitch);
  if (!active) return input;
  for (const action of FPS_BUTTONS) input[action] = keys.has(action) || touch.actions.has(action);
  input.up ||= touch.move.y < -0.22;
  input.down ||= touch.move.y > 0.22;
  input.left ||= touch.move.x < -0.22;
  input.right ||= touch.move.x > 0.22;
  input.fire ||= mouse.fire === true;
  input.aim ||= mouse.aim === true;
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
    .map(player => ({ id: player.id, x: player.x, y: Number.isFinite(player.y) ? player.y : 0, z: player.z, yaw: player.yaw, self: player.id === localId }));
}

export function loadoutForKey(event, phase) {
  if (!['countdown', 'buy', 'roundEnd'].includes(phase) || event.defaultPrevented || event.isComposing || event.repeat || event.altKey || event.ctrlKey || event.metaKey || isFormTarget(event.target)) return null;
  // Physical number keys also work with unshifted AZERTY symbols, including è, _ and ç.
  const physical = /^(?:Digit|Numpad)([1-9])$/.exec(event.code || '');
  const digit = physical?.[1] || (/^[1-9]$/.test(event.key || '') ? event.key : null);
  return digit ? WEAPON_IDS[Number(digit) - 1] || null : null;
}

/** Scope and look cues use the same finite authoritative ADS transition as the camera. */
export function aimFraction(player, ticks = 18) {
  if (player?.alive === false || player?.slot === 'sword' || player?.healing || player?.healTicks > 0 || player?.reloadTicks > 0 || player?.grenadeThrowTicks > 0) return 0;
  return Math.max(0, Math.min(1, Number.isFinite(player?.aimTicks) ? player.aimTicks / Math.max(1, ticks) : 0));
}

export function aimLookMultiplier(player, ads = {}) {
  const progress = aimFraction(player, ads.ticks); const smooth = progress * progress * (3 - 2 * progress);
  const zoom = weaponAimFovRatio(player?.weapon, ads);
  return 1 + (zoom - 1) * smooth;
}

/** Action progress always comes from the simulation; readiness never anticipates a hit. */
export function combatReadout(player, weapons = WEAPONS, rules = {}) {
  const weapon = weapons[player?.weapon]; const sword = player?.slot === 'sword';
  const ticks = Math.max(0, Number.isFinite(player?.meleeTicks) ? player.meleeTicks : 0, Number.isFinite(player?.meleeCooldown) ? player.meleeCooldown : 0);
  const meleePhase = ticks && !(player?.meleeTicks > 0) ? 'recovery' : player?.meleePhase || 'idle';
  const meleeTotal = (rules.MELEE?.startupTicks || 18) + (rules.MELEE?.activeTicks || 12) + (rules.MELEE?.recoveryTicks || 42);
  const healing = player?.healTicks > 0; const reloading = !sword && player?.reloadTicks > 0;
  let label = sword ? 'SWORD' : weapon?.label || (player?.weapon || 'carbine').toUpperCase();
  let ammo = sword ? ({ startup: 'WINDUP', active: 'STRIKE', recovery: 'RECOVER' })[meleePhase] || 'READY' : player?.ammo ?? '—';
  let status; let progress = null;
  if (sword) {
    status = ticks ? `${(ticks / 120).toFixed(1)}S · ${meleePhase === 'startup' ? 'COMMITTING' : meleePhase === 'active' ? 'BLADE ACTIVE' : 'RECOVERING'}` : 'LMB STRIKE · V GUN';
    if (ticks) progress = { label: 'Sword attack and recovery', remaining: ticks, total: meleeTotal };
  } else if (player?.ammo === 0) status = player.reserve > 0 ? weapon?.projectile ? 'R TO RELOAD BOLT' : 'R TO RELOAD' : 'OUT OF AMMUNITION';
  else if (weapon?.spinupTicks && player?.spinTicks > 0 && player.spinTicks < weapon.spinupTicks) {
    status = 'SPINNING UP · HOLD FIRE';
    progress = { label: 'LMG wind-up', remaining: weapon.spinupTicks - player.spinTicks, total: weapon.spinupTicks };
  }
  else if (weapon?.mode === 'burst' && player?.burstRemaining > 0) status = 'BURST FIRING';
  else if (weapon?.mode === 'burst' && player?.shotCooldown > 0) status = `BURST RECOVERY ${(player.shotCooldown / 120).toFixed(1)}S`;
  else if (weapon?.mode === 'pump' && player?.shotCooldown > 0) status = `PUMPING ${(player.shotCooldown / 120).toFixed(1)}S`;
  else if (weapon?.mode === 'bolt' && player?.shotCooldown > 0) {
    status = `CYCLING BOLT ${(player.shotCooldown / 120).toFixed(1)}S`;
    progress = { label: 'Bolt recovery', remaining: player.shotCooldown, total: weapon.cooldown };
  }
  else if (!player?.grounded) status = 'AIRBORNE / UNSTEADY';
  else if (player?.aiming) status = Math.hypot(player.vx || 0, player.vz || 0) > .22 ? 'AIMING / MOVING' : 'AIMING / STEADY';
  else if (player?.crouching) status = Math.hypot(player.vx || 0, player.vz || 0) > .22 ? 'CROUCHED / MOVING' : 'CROUCHED / STEADY';
  else status = weapon?.projectile ? 'LEAD TARGET · CLICK EACH BOLT' : weapon?.spinupTicks ? 'HOLD FIRE · WIND-UP' : ({ semi: 'CLICK EACH SHOT', burst: 'CLICK EACH BURST', pump: 'CLICK EACH SHELL', bolt: 'SETTLE INTO SCOPE' })[weapon?.mode] || 'RMB AIM · V SWORD';
  if (reloading) { status = `RELOADING ${(player.reloadTicks / 120).toFixed(1)}S`; progress = { label: 'Reload', remaining: player.reloadTicks, total: weapon?.reloadTicks || player.reloadTicks }; }
  if (player?.grenadeThrowTicks > 0) status = `THROWING ${(player.grenadeThrowTicks / 120).toFixed(1)}S`;
  if (healing) {
    label = 'HEALING POTION'; ammo = `+${Math.min(rules.HEAL?.amount || 40, Math.max(0, (player.maxHp || 100) - player.hp))}`;
    status = `${(player.healTicks / 120).toFixed(1)}S · STAY IN COVER`;
    progress = { label: 'Drinking healing potion', remaining: player.healTicks, total: rules.HEAL?.ticks || 240 };
  }
  if (progress) progress.percent = Math.max(0, Math.min(100, 100 - progress.remaining / progress.total * 100));
  return { label, ammo, reserve: player?.reserve ?? '—', sword, healing, reloading, status, progress,
    grenades: Math.max(0, player?.grenades ?? 0), potions: Math.max(0, player?.potions ?? 0) };
}

/** A shotgun shell reports once; every pellet still supplies its own contact feedback. */
export function hasGunshotReport(event) {
  return ['shot', 'fire', 'boltLaunch'].includes(event?.type) && (event.pellet == null || event.pellet === 0);
}

/** Self-inflicted damage is incoming damage; it never earns an offensive hit cue. */
export function combatEventPerspective(event, localId) {
  const source = event.shooterId ?? event.attackerId ?? event.playerId ?? event.ownerId ?? event.attacker;
  const target = event.targetId ?? event.victimId ?? event.target;
  return { source, target, self: source != null && source === target,
    outgoing: localId != null && source === localId && target != null && target !== localId,
    incoming: localId != null && target === localId };
}

/** The HUD follows the same allied camera as the renderer; enemy health is never shown. */
export function healthHUDPlayer(state, localId, spectatorId) {
  const local = state?.players?.find(player => player.id === localId);
  if (!local || local.alive) return local || null;
  return state.players.find(player => player.id === spectatorId && player.team === local.team && player.alive) || local;
}

/** A compact two-seat squad readout excludes rivals, self and disconnected seats. */
export function tacticalSquadHealth(state, localId, connectedIds) {
  const local = state?.players?.find(player => player.id === localId); if (!local) return [];
  const connected = connectedIds == null ? null : new Set(connectedIds);
  return state.players.filter(player => player.team === local.team && player.id !== localId && (!connected || connected.has(player.id))).slice(0, 2)
    .map(player => { const health = healthPresentation(player); return { id: player.id, hp: health.hp, maxHp: health.maxHp, percent: health.percent, low: health.low, dead: health.dead }; });
}

/** Actual HP paints immediately. A short separate trail makes recent damage readable. */
export function healthPresentation(player, previous = null, { now = 0, round = 0 } = {}) {
  const maxHp = Number.isFinite(player?.maxHp) && player.maxHp > 0 ? player.maxHp : 100;
  const hp = Math.max(0, Math.min(maxHp, Number.isFinite(player?.hp) ? player.hp : 0));
  const reset = !previous || previous.id !== player?.id || previous.round !== round || previous.maxHp !== maxHp;
  let trailHp = reset ? hp : previous.trailHp;
  let damageAt = reset ? -Infinity : previous.damageAt;
  let trailFrom = reset ? hp : previous.trailFrom;
  if (!reset && hp < previous.hp) { trailFrom = Math.max(previous.trailHp, previous.hp); damageAt = now; }
  if (reset || hp > previous.hp) { trailHp = hp; trailFrom = hp; damageAt = -Infinity; }
  else { const decay = Math.max(0, Math.min(1, (now - damageAt - 400) / 550)); trailHp = hp + Math.max(0, trailFrom - hp) * (1 - decay); }
  return { id: player?.id, round, hp, maxHp, trailHp, trailFrom, damageAt,
    percent: hp / maxHp * 100, trailPercent: trailHp / maxHp * 100,
    low: hp > 0 && hp / maxHp <= .3, dead: player?.alive === false || hp === 0 };
}

/** Group confirmed HP loss, never speculative bullet contacts or overkill damage. */
export function confirmedHitGroups(events = [], localId) {
  const groups = new Map();
  for (const event of events) {
    if (event.type !== 'damage' || !(event.damage > 0) || !combatEventPerspective(event, localId).outgoing) continue;
    const target = combatEventPerspective(event, localId).target;
    const key = `${event.tick ?? ''}:${target}:${event.weapon || event.attack || ''}`;
    const group = groups.get(key) || { targetId: target, weapon: event.weapon, damage: 0, headshot: false, legshot: true, contacts: 0 };
    group.damage += event.damage; group.headshot ||= !!event.headshot;
    group.legshot &&= event.hitKind === 'leg' || event.hitZone === 'leg'; group.contacts++;
    groups.set(key, group);
  }
  return [...groups.values()].map(group => ({ ...group, label: group.headshot ? 'HEADSHOT' : group.legshot ? 'LEG HIT' : 'HIT' }));
}

export function weaponComparison(id) {
  const weapon = WEAPONS[id]; const stats = weaponStats(id);
  if (!weapon || !stats) return null;
  return { name: weapon.name, description: weapon.description, body: stats.body, head: stats.head, leg: stats.leg,
    damageLabel: stats.pellets > 1 ? `DAMAGE / PELLET · ${stats.pellets} PELLETS PER SHELL` : 'DAMAGE / HIT · CLOSE RANGE',
    rate: stats.fireRateLabel, reload: `${stats.reloadSeconds.toFixed(2)} s`,
    range: stats.falloffStart != null ? `Falls after ${stats.falloffStart} m · minimum ${Math.round(stats.falloffMinimum * 100)}%` : `Full damage to ${stats.effectiveRange} m`,
    handling: stats.projectileSpeed ? `Bolts ${stats.projectileSpeed} m/s · gravity ${stats.projectileGravity} m/s²` : stats.windupSeconds ? `${stats.windupSeconds.toFixed(2)} s wind-up before fire` : weapon.scoped ? 'Scoped precision · settle before firing' : weapon.mode === 'burst' ? 'Three-shot volley · release between bursts' : ['semi', 'pump', 'bolt'].includes(weapon.mode) ? 'One shot per click · release between shots' : 'Automatic fire · control recoil' };
}

/** Smooth remote bodies and live bolts. Combat and camera aim remain authoritative. */
export function interpolatedState(samples, targetTime, localId, { predictMovement, traceProjectile, maxExtrapolationMs = 25 } = {}) {
  if (!samples.length) return null;
  let from = samples[0]; let to = samples[samples.length - 1];
  for (let i = 1; i < samples.length; i++) {
    if (samples[i].time >= targetTime) { from = samples[i - 1]; to = samples[i]; break; }
    from = samples[i];
  }
  const state = { ...to.state, players: to.state.players.map(player => ({ ...player })),
    bolts: (to.state.bolts || []).slice(0, MAX_BOLTS).map(bolt => ({ ...bolt })) };
  state.fighters = state.players;
  const span = to.time - from.time;
  const ratio = span > 0 ? Math.max(0, Math.min(1, (targetTime - from.time) / span)) : 1;
  if (from.state.phase !== to.state.phase || from.state.round !== to.state.round) return state;
  // Keep the newest membership: a hit/deleted bolt must never reappear while
  // interpolating. Birth identity also prevents a reused round ID from sliding.
  for (const bolt of state.bolts) {
    const old = from.state.bolts?.find(other => other.id === bolt.id && other.playerId === bolt.playerId && other.bornTick === bolt.bornTick);
    if (!old) continue;
    for (const axis of ['x', 'y', 'z', 'vx', 'vy', 'vz']) {
      if (Number.isFinite(old[axis]) && Number.isFinite(bolt[axis])) bolt[axis] = old[axis] + (bolt[axis] - old[axis]) * ratio;
    }
  }
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
    // Every projection sees the same body poses; render order never moves a blocker.
    const peers = state.players.map(player => ({ ...player }));
    for (const player of state.players) if (player.id !== localId && player.alive) predictMovement(player, player.previousInput || neutralInput(player.yaw, player.pitch), state.mapId, projectedTicks, peers);
  }
  // A short projection fills the part of the 30 Hz interval beyond the newest
  // sample. Reuse the authoritative sweep on copies, with no events or damage.
  let boltSeconds = Math.min(25, maxExtrapolationMs, Math.max(0, targetTime - to.time)) / 1000;
  if (boltSeconds > 0 && state.phase === 'fight' && state.bolts.length && typeof traceProjectile === 'function') {
    const projection = { ...state, tick: state.tick };
    while (boltSeconds > 1e-8 && projection.bolts.length) {
      const dt = Math.min(1 / 120, boltSeconds);
      projection.tick++;
      advanceBolts(projection, { dt, trace: traceProjectile });
      boltSeconds -= dt;
    }
    state.bolts = projection.bolts;
  }
  return state;
}

/** Replay a bounded, copied movement history after the server acknowledges inputs. */
export function reconcilePlayer(player, history, ack, mapId, predictMovement, allowMovement = true, peers = []) {
  const pending = history.filter(frame => frame.seq > ack).slice(-240);
  const predicted = clone(player);
  if (predicted?.alive && allowMovement) for (const frame of pending) predictMovement(predicted, frame.buttons, mapId, 1, peers);
  return { predicted, pending };
}

async function boot() {
  const $ = id => document.getElementById(id);
  const canvas = $('arena');
  // Both selectors are built once from the same catalog that validates the server loadout.
  const loadoutOptions = document.createDocumentFragment(), arenaButtons = document.createDocumentFragment();
  for (const [index, id] of WEAPON_IDS.entries()) {
    const weapon = WEAPONS[id];
    const caption = weapon.projectile ? 'Lead + bolt drop' : weapon.spinupTicks ? 'Hold fire to wind up' : weapon.mode === 'bolt' ? 'Settle into scope' : weapon.mode === 'burst' ? 'Three-shot volleys' : weapon.mode === 'pump' ? 'Close-range spread' : weapon.mode === 'semi' ? 'Fast single shots' : weapon.scoped ? 'Precise headshots' : weapon.magazine >= 30 ? 'Close quarters' : 'Measured bursts';
    const option = document.createElement('option'); option.value = id; option.textContent = `${weapon.label} · ${caption}`; loadoutOptions.append(option);
    const button = document.createElement('button'); button.dataset.arenaLoadout = id; button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-label', `${index + 1}: ${weapon.name}. ${weapon.description}`); button.title = weapon.description;
    const number = document.createElement('b'); number.textContent = String(index + 1);
    const detail = document.createElement('small'); detail.textContent = caption;
    button.append(number, document.createTextNode(` ${weapon.label}`), detail); arenaButtons.append(button);
  }
  $('loadout-select').replaceChildren(loadoutOptions); $('arena-loadouts').replaceChildren(arenaButtons);
  $('phase-shortcuts').textContent = WEAPON_IDS.map((id, index) => `${index + 1} ${WEAPONS[id].label}`).join(' · ');
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
  const mouse = { fire: false, aim: false };
  const touch = { move: { x: 0, y: 0 }, look: { x: 0, y: 0 }, actions: new Set() };
  const actionPointers = new Map(); const padPointers = new Map();
  const padInputPacer = createContinuousInputPacer(60);
  let healthView = null; let healthGain = 0; let healthGainUntil = 0; let previewWeapon = null;
  let squadSignature = ''; let rosterSignature = ''; let idleDrawSignature = ''; let mapPlanId = ''; const mapMarkers = new Map();
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
  function utilityFeedback(action) {
    const local = ownPlayer(); if (state?.phase !== 'fight' || !local?.alive) return;
    if (action === 'heal' && !local.healTicks) {
      if (!local.potions) toast('Your potion is spent. Supplies reset next round.');
      else if (local.hp >= local.maxHp) toast('Health is full. Save your potion.');
      else if (!local.grounded) toast('Land before drinking your potion.');
    } else if (action === 'grenade' && !local.grenades) toast('Your frag is spent. Supplies reset next round.');
  }
  function sendInput(buttons = currentInput()) { if (teamSwitchPending) return sequence; if (sequence >= 999999000) sequence = 0; send({ type: 'input', seq: ++sequence, buttons }); return sequence; }
  function integrateTouchLook(now = performance.now()) {
    const delta = Math.max(0, Math.min(.1, (now - lastTouchLookAt) / 1000)); lastTouchLookAt = now;
    if (controlsActive() && touchMode) {
      const sensitivity = aimLookMultiplier(ownPlayer(), engine?.ADS);
      aim = cleanAim(aim.yaw + touch.look.x * delta * 2.4 * sensitivity, aim.pitch - touch.look.y * delta * 1.85 * sensitivity);
    }
  }
  function refreshHeartbeat() {
    const shouldRun = !destroyed && connected && !document.hidden && !teamSwitchPending && ['countdown', 'buy', 'fight'].includes(state?.phase);
    if (shouldRun && !inputHeartbeat) inputHeartbeat = setInterval(() => { integrateTouchLook(); sendInput(); }, 50);
    else if (!shouldRun && inputHeartbeat) { clearInterval(inputHeartbeat); inputHeartbeat = null; }
  }
  function neutralize({ pause = false, unlock = false } = {}) {
    keys.clear(); pressedKeys.clear(); mouse.fire = mouse.aim = false; rightDrag = false;
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
      for (const box of plan.colliders) {
        const top = box.y + box.h;
        const cover = svgNode('rect', { x: box.x, y: box.z, width: box.w, height: box.d, class: `map-cover${top < 1.3 ? ' low' : top >= 2.5 && !box.id.startsWith('wall-') ? ' elevated' : ''}` });
        svg.append(cover);
      }
      const climbMarkers = new Set();
      for (const route of plan.routes || []) {
        svg.append(svgNode('polyline', { points: [route.start, ...route.steps].map(point => `${point.x},${point.z}`).join(' '), class: 'map-climb-path' }));
        for (const step of route.steps) {
          const key = `${step.x}:${step.z}`; if (climbMarkers.has(key)) continue;
          climbMarkers.add(key);
          svg.append(svgNode('circle', { cx: step.x, cy: step.z, r: .5, class: 'map-climb-step' }));
        }
      }
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
      marker.setAttribute('class', `${player.self ? 'map-player self' : 'map-player'}${pose.y >= .75 ? ' elevated-player' : ''}`);
    }
  }

  function playEvents(events = []) {
    const impactSounds = new Set(); const freshEvents = [];
    for (const event of events) {
      const eventId = event.id ?? `${state?.tick}:${event.type}:${event.playerId ?? event.attackerId ?? ''}:${event.targetId ?? ''}`;
      if (eventSeen.has(eventId)) continue;
      eventSeen.add(eventId); eventOrder.push(eventId); freshEvents.push(event);
      if (eventOrder.length > 512) eventSeen.delete(eventOrder.shift());
      const perspective = combatEventPerspective(event, playerId);
      const shooter = perspective.source; const target = perspective.target;
      if (event.type === 'damage' && event.damage > 0) {
        if (perspective.outgoing) { hitUntil = performance.now() + 150; hitKind = event.headshot ? 'headshot' : 'body'; }
        if (target === playerId) damageUntil = performance.now() + 230;
      }
      if (['kill', 'death', 'elimination'].includes(event.type)) {
        kills.push({ at: performance.now(), text: perspective.self ? `${lookupName(target)}  [SELF FRAG]` : `${shooter == null ? 'THE DEVICE' : lookupName(shooter)}  ${event.weapon === 'crossbow' ? event.headshot ? '[BOLT HS]' : '[BOLT]' : event.headshot ? '[HS]' : '›'}  ${lookupName(target)}`, own: perspective.outgoing, headshot: !!event.headshot });
        if (kills.length > 4) kills.shift();
        if (perspective.outgoing) { hitUntil = performance.now() + 230; hitKind = 'elimination'; feedbackUntil = performance.now() + 1100; $('combat-feedback').textContent = event.headshot ? 'HEADSHOT · ELIMINATED' : 'ELIMINATED'; }
      }
      if (shooter === playerId && ['healStart', 'healComplete', 'healCancel'].includes(event.type)) {
        feedbackUntil = performance.now() + (event.type === 'healStart' ? 650 : 1100);
        if (event.type === 'healComplete') { healthGain = Math.max(0, Math.round(event.amount || 0)); healthGainUntil = performance.now() + 1400; }
        $('combat-feedback').textContent = event.type === 'healComplete' ? `HEALED +${Math.round(event.amount || 0)} HP` : event.type === 'healCancel' ? 'HEALING INTERRUPTED' : 'DRINKING POTION';
      }
      if (!audio.enabled) continue;
      try {
        if (hasGunshotReport(event)) {
          const own = shooter === playerId;
          const profile = WEAPONS[event.weapon]?.sound;
          const gain = own ? 1 : .34;
          if (profile) {
            audio.noise(profile.noiseDuration, { highpass: profile.highpass || 170, lowpass: profile.lowpass, gain: profile.noiseVolume * gain });
            audio.tone(profile.frequency, profile.toneDuration, { end: profile.endFrequency || 48, type: profile.wave || 'triangle', gain: profile.toneVolume * gain });
          }
        } else if (event.type === 'damage' && (shooter === playerId || target === playerId)) {
          const soundKey = `${event.tick ?? state?.tick}:${perspective.incoming ? 'incoming' : 'outgoing'}`;
          if (impactSounds.has(soundKey)) continue;
          impactSounds.add(soundKey);
          audio.tone(perspective.outgoing ? 920 : 130, 0.055, { end: perspective.outgoing ? 620 : 70, type: 'triangle', gain: 0.23 });
        } else if (['plant', 'planted', 'defuse', 'defused', 'bombPlant', 'bombDefuse'].includes(event.type)) {
          audio.tone(640, 0.13, { gain: 0.18 }); audio.tone(880, 0.12, { gain: 0.12, delay: 0.13 });
        } else if (event.type === 'meleeStart') {
          audio.noise(.13, { highpass: 1600, lowpass: 4500, gain: shooter === playerId ? .14 : .045 });
          audio.tone(170, .13, { end: 70, type: 'triangle', gain: shooter === playerId ? .10 : .035 });
        } else if (event.type === 'grenadeThrow' && shooter === playerId) {
          audio.noise(.06, { highpass: 1800, lowpass: 3900, gain: .12 });
        } else if (event.type === 'healComplete' && shooter === playerId) {
          audio.tone(660, .13, { end: 920, type: 'triangle', gain: .15 });
        } else if (event.type === 'explosion' || event.type === 'detonate' || event.type === 'grenadeExplosion') {
          audio.noise(0.45, { highpass: 30, lowpass: 1700, gain: 0.45 }); audio.tone(65, 0.42, { end: 28, gain: 0.25 });
        }
      } catch { /* Optional sound cannot interrupt gameplay. */ }
    }
    const hits = confirmedHitGroups(freshEvents, playerId);
    if (hits.length) {
      const hit = hits.reduce((best, next) => next.damage > best.damage ? next : best);
      const killed = freshEvents.some(event => ['kill', 'death', 'elimination'].includes(event.type) && combatEventPerspective(event, playerId).outgoing && combatEventPerspective(event, playerId).target === hit.targetId);
      feedbackUntil = performance.now() + (killed ? 1100 : 650);
      $('combat-feedback').textContent = `${hit.label} · ${Math.round(hit.damage)} HP${killed ? ' · ELIMINATED' : ''}`;
    }
  }

  function renderWeaponComparison(id) {
    if ($('weapon-comparison').dataset.weapon === id) return;
    const data = weaponComparison(id); if (!data) return;
    $('weapon-comparison').dataset.weapon = id;
    $('comparison-name').textContent = data.name;
    $('comparison-description').textContent = data.description;
    for (const key of ['body', 'head', 'leg', 'rate', 'reload', 'range', 'handling']) $(`comparison-${key}`).textContent = data[key];
    $('comparison-damage-label').textContent = data.damageLabel;
    $('arena-weapon-stats').textContent = `${data.head} HEAD / ${data.body} BODY / ${data.leg} LEGS${WEAPONS[id].pellets > 1 ? ' · PER PELLET' : ''} · ${data.rate}`;
  }

  function renderRoster() {
    const signature = JSON.stringify([teamSize, playerId, state?.phase, roster.map(person => person && [person.id, person.name, person.connected, person.ready]), state?.players?.map(player => [player.id, player.alive, player.weapon, player.team === ownPlayer()?.team ? player.hp : null])]);
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
        details.append(name, status);
        if (person?.connected && player && player.team === ownPlayer()?.team && state?.phase !== 'lobby') {
          const health = healthPresentation(player); const meter = document.createElement('span'); meter.className = 'roster-health';
          meter.setAttribute('role', 'meter'); meter.setAttribute('aria-label', `${name.textContent} health`);
          meter.setAttribute('aria-valuemin', '0'); meter.setAttribute('aria-valuemax', String(health.maxHp)); meter.setAttribute('aria-valuenow', String(health.hp));
          const fill = document.createElement('i'); fill.style.width = `${health.percent}%`; meter.append(fill);
          const amount = document.createElement('b'); amount.textContent = `${health.hp} HP`; status.append(document.createTextNode(' · '), amount); details.append(meter);
        }
        row.append(number, details);
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
    const livingAllies = state?.players?.filter(player => player.team === local?.team && player.alive && player.id !== playerId) || [];
    if (!livingAllies.some(player => player.id === spectatorId)) spectatorId = livingAllies[0]?.id ?? null;
    const squad = tacticalSquadHealth(state, playerId, roster.filter(person => person?.connected).map(person => person.id));
    $('squad-health').hidden = !squad.length || !['fight', 'roundEnd'].includes(phase);
    const nextSquadSignature = JSON.stringify(squad.map(person => [person, lookupName(person.id)]));
    if (nextSquadSignature !== squadSignature) {
      squadSignature = nextSquadSignature; $('squad-health').replaceChildren();
      for (const person of squad) {
        const row = document.createElement('div'); row.className = `squad-health-row${person.low ? ' low' : ''}${person.dead ? ' eliminated' : ''}`; row.dataset.playerId = person.id;
        const name = document.createElement('span'); name.textContent = lookupName(person.id);
        const hp = document.createElement('b'); hp.textContent = person.dead ? 'OUT' : `${person.hp} HP`;
        const meter = document.createElement('i'); meter.setAttribute('role', 'meter'); meter.setAttribute('aria-label', `${lookupName(person.id)} health`);
        meter.setAttribute('aria-valuemin', '0'); meter.setAttribute('aria-valuemax', String(person.maxHp)); meter.setAttribute('aria-valuenow', String(person.hp));
        const fill = document.createElement('em'); fill.style.width = `${person.percent}%`; meter.append(fill); row.append(name, hp, meter); $('squad-health').append(row);
      }
    }
    const viewed = healthHUDPlayer(state, playerId, spectatorId);
    const spectating = viewed && viewed.id !== playerId;
    $('combat-hud').hidden = inLobby || !viewed || (!viewed.alive && !spectating) || phase === 'matchEnd';
    healthView = healthPresentation(viewed, healthView, { now: performance.now(), round: state?.round });
    $('health').textContent = healthView.hp; $('health-max').textContent = `/ ${healthView.maxHp}`;
    $('health-fill').style.width = `${healthView.percent}%`; $('health-trail').style.width = `${healthView.trailPercent}%`;
    $('health-meter').setAttribute('aria-valuemax', String(healthView.maxHp)); $('health-meter').setAttribute('aria-valuenow', String(healthView.hp));
    $('health-meter').setAttribute('aria-label', spectating ? `${lookupName(viewed.id)} health` : 'Your health');
    $('health-subject').textContent = spectating ? lookupName(viewed.id).toUpperCase() : 'YOUR HEALTH';
    $('health-status').textContent = healthView.dead ? 'ELIMINATED' : healthView.low ? 'LOW HEALTH · FIND COVER' : spectating ? 'TEAMMATE' : 'COMBAT READY';
    $('health-readout').classList.toggle('low-health', healthView.low); $('health-readout').classList.toggle('is-spectating', !!spectating);
    $('health-gain').hidden = spectating || performance.now() >= healthGainUntil || !healthGain;
    $('health-gain').textContent = `+${healthGain} HP`;
    const readout = combatReadout(viewed, WEAPONS, engine);
    if (!previewWeapon) renderWeaponComparison(local?.weapon || 'carbine');
    const weapon = WEAPONS[viewed?.weapon];
    const pose = spectating ? viewed : predictedPlayer || local;
    $('position-status').textContent = !pose?.grounded ? 'AIRBORNE' : pose.y >= .75 ? 'HIGH GROUND' : 'GROUND LEVEL';
    $('position-status').classList.toggle('elevated', !!pose && pose.y >= .75);
    $('weapon-label').textContent = readout.label; $('ammo').textContent = readout.ammo; $('reserve').textContent = readout.reserve;
    $('weapon-readout').dataset.slot = readout.healing ? 'potion' : readout.sword ? 'sword' : 'primary';
    $('weapon-readout').classList.toggle('healing', readout.healing);
    $('ammo-reserve').hidden = readout.sword || readout.healing;
    $('reload-track').hidden = !readout.progress; $('reload-progress').style.width = `${readout.progress?.percent || 0}%`;
    $('reload-track').setAttribute('aria-label', readout.progress?.label || 'Weapon action');
    $('reload-track').setAttribute('aria-valuenow', String(Math.round(readout.progress?.percent || 0)));
    $('reload-track').setAttribute('aria-valuetext', `${((readout.progress?.remaining || 0) / 120).toFixed(1)} seconds remaining`);
    $('weapon-status').textContent = readout.status;
    $('ammo').classList.toggle('low-ammo', !readout.sword && !readout.reloading && !!weapon && viewed?.ammo <= Math.max(2, Math.floor(weapon.magazine / 4)));
    $('grenade-charge').textContent = readout.grenades; $('potion-charge').textContent = readout.potions;
    $('grenade-utility').classList.toggle('spent', !readout.grenades);
    $('potion-utility').classList.toggle('spent', !readout.potions);
    $('potion-utility').classList.toggle('channeling', readout.healing);
    const scoped = !!local?.alive && local.slot !== 'sword' && !readout.healing && !!weapon?.scoped && aimFraction(local, engine?.ADS?.ticks) >= 14 / 18;
    $('scope-reticle').hidden = !controlsActive() || phase !== 'fight' || !scoped;
    $('scope-label').textContent = `${weapon?.label || 'PRECISION'} / PRECISION SIGHT`;
    $('crosshair').hidden = !controlsActive() || phase !== 'fight' || scoped || readout.healing;
    $('crosshair').dataset.stance = readout.sword ? 'sword' : local?.aiming ? 'aim' : 'hip';
    if (local) {
      const motion = weapon ? Math.max(0, Math.min(1, (Math.hypot(local.vx, local.vz) - .22) / weapon.speed)) : 0;
      const ads = aimFraction(local, engine?.ADS?.ticks);
      const spread = weapon ? (weapon.pelletSpread || 0) + weaponSpread(weapon, { motion, grounded: local.grounded, heat: local.heat, ads }, engine?.ADS) : 0;
      const size = readout.sword ? 27 : Math.round(22 - ads * 8 + Math.min(64, spread * canvas.clientHeight * 2));
      $('crosshair').style.width = `${size}px`; $('crosshair').style.height = `${size}px`;
    }
    for (const button of document.querySelectorAll('[data-voxel-action]')) {
      const action = button.dataset.voxelAction;
      if (action === 'swap') { button.textContent = readout.sword ? 'GUN' : 'SWORD'; button.setAttribute('aria-label', readout.sword ? 'Switch to primary gun' : 'Switch to sword'); button.setAttribute('aria-pressed', String(readout.sword)); }
      if (action === 'aim') button.setAttribute('aria-pressed', String(!!local?.aiming));
      if (action === 'grenade') { button.textContent = `FRAG ${readout.grenades}`; button.setAttribute('aria-label', `Throw fragmentation grenade: ${readout.grenades} remaining`); button.classList.toggle('unavailable', !readout.grenades); }
      if (action === 'heal') { button.textContent = readout.healing ? 'DRINKING' : `POTION ${readout.potions}`; button.setAttribute('aria-label', `Drink healing potion: ${readout.potions} remaining; restores up to 40 health after two seconds; interruption spends the potion`); button.classList.toggle('unavailable', (!readout.potions && !readout.healing) || local?.hp >= (local?.maxHp || 100)); }
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
    $('arena-weapon-stats').hidden = $('arena-loadouts').hidden;
    for (const button of document.querySelectorAll('[data-arena-loadout]')) {
      button.setAttribute('aria-pressed', String(button.dataset.arenaLoadout === local?.weapon));
      button.disabled = !connected || !['countdown', 'buy'].includes(phase);
    }
    $('aim-note').hidden = !enter; $('aim-note').textContent = touchMode ? 'Touch: Move / Look pads. Hold AIM for sights; tap SWORD, FRAG or POTION.' : 'RMB aims. If mouse capture is unavailable, hold RMB and drag to look.';
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
    const renderedState = interpolatedState(snapshots, now - 12, playerId, { predictMovement: engine.predictLocalMovement, traceProjectile: engine.traceShot }) || state;
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
        engine.predictLocalMovement(predictedPlayer, buttons, state.mapId, 1, state.players);
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
      eventSeen.clear(); eventOrder.length = 0; kills.length = 0; healthView = null; healthGainUntil = 0; hitUntil = damageUntil = feedbackUntil = 0; lastCountdown = null; audio.resetEvents();
    }
    if (local && !local.alive && old?.players.find(player => player.id === playerId)?.alive !== false) neutralize({ pause: true, unlock: true });
    const ackValue = message.acks?.[playerId];
    const ack = typeof ackValue === 'number' ? ackValue : ackValue?.seq ?? -1;
    if (local) {
      const reconciled = reconcilePlayer(local, pending, ack, state.mapId, engine.predictLocalMovement, state.phase === 'fight', state.players);
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
  function updateKeyLabels() {
    const layout = getKeyboardLayout();
    $('move-keys').textContent = layout.toUpperCase();
    for (const label of document.querySelectorAll('[data-voxel-key]')) label.textContent = displayKey(label.dataset.voxelKey, layout);
    canvas.setAttribute('aria-label', `3D tactical shooter. ${layout.toUpperCase()} or arrows to move, mouse to look, left click to shoot or strike, right click to aim, V switch sword, ${displayKey('Q', layout)} grenade, F healing potion, R reload, hold E to plant or defuse, Space jump between crates and ledges, Control crouch, Shift walk. Choose nine weapons with number keys 1 to 9 during setup.`);
  }
  function updateLayout() { neutralize({ pause: entered, unlock: true }); updateKeyLabels(); }
  const unsubscribeLayout = subscribeKeyboardLayout(updateLayout); updateKeyLabels();
  listen(window, 'keydown', event => {
    if (event.defaultPrevented || event.isComposing || event.altKey || event.metaKey) return;
    if (event.key === 'Escape') { if (modalOpen) closeGuide(); else if (entered && state?.phase !== 'lobby') neutralize({ pause: true, unlock: true }); return; }
    const loadout = entered && !modalOpen && !document.hidden ? loadoutForKey(event, state?.phase) : null;
    if (loadout) { event.preventDefault(); selectArenaLoadout(loadout); return; }
    if (!controlsActive() || isFormTarget(event.target)) return;
    const action = controlForKey(event); if (!action) return;
    event.preventDefault(); const keyId = event.code || event.key;
    if (pressedKeys.has(keyId)) return;
    pressedKeys.set(keyId, action); keys.add(action); utilityFeedback(action); sendInput();
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
    if (event.button === 2) { mouse.aim = true; if (fallback) rightDrag = true; }
    sendInput();
  });
  listen(window, 'mouseup', event => { if (event.button === 0) mouse.fire = false; if (event.button === 2) { mouse.aim = false; rightDrag = false; } if (entered && [0, 2].includes(event.button)) sendInput(); });
  listen(document, 'mousemove', event => {
    if (!controlsActive() || !(pointerLocked() || fallback && rightDrag)) return;
    const sensitivity = LOOK_SENSITIVITY * aimLookMultiplier(ownPlayer(), engine?.ADS);
    aim = cleanAim(aim.yaw + event.movementX * sensitivity, aim.pitch - event.movementY * sensitivity);
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
  listen($('loadout-select'), 'change', () => { previewWeapon = null; renderWeaponComparison($('loadout-select').value); neutralize(); send({ type: 'fps-loadout', weaponId: $('loadout-select').value }); });
  for (const button of document.querySelectorAll('[data-arena-loadout]')) {
    listen(button, 'click', () => { previewWeapon = null; renderWeaponComparison(button.dataset.arenaLoadout); selectArenaLoadout(button.dataset.arenaLoadout); });
    listen(button, 'mouseenter', () => { previewWeapon = button.dataset.arenaLoadout; renderWeaponComparison(previewWeapon); });
    listen(button, 'focus', () => { previewWeapon = button.dataset.arenaLoadout; renderWeaponComparison(previewWeapon); });
    listen(button, 'mouseleave', () => { previewWeapon = null; renderWeaponComparison(ownPlayer()?.weapon || 'carbine'); });
    listen(button, 'blur', () => { previewWeapon = null; renderWeaponComparison(ownPlayer()?.weapon || 'carbine'); });
  }
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
    listen(button, 'pointerdown', event => { if (!controlsActive()) return; event.preventDefault(); utilityFeedback(button.dataset.voxelAction); actionPointers.set(event.pointerId, button); touch.actions.add(button.dataset.voxelAction); button.classList.add('pressed'); button.setPointerCapture(event.pointerId); sendInput(); });
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
  const inspect = () => clone({ state, players: roster, playerId, input: currentInput(), predictedPlayer, connected, controls: { pointerLocked: pointerLocked(), fallback, touch: touchMode, paused, entered, modalOpen }, queueLength: pending.length, renderCount, renderStats: renderer?.stats || null, graphicsError, spectatorId });
  window.SemagVoxel = Object.freeze({ getState: inspect, inspect });
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
