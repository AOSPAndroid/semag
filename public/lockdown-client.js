/** Lockdown page: lobby, input, HUD and networking around the shared engine.
 * `?solo=1` runs the simulation in the page with bots; `?room=ID` plays online. */
import * as Engine from './lockdown-engine.js';
import { LockdownRenderer, TEAM_COLORS } from './lockdown-renderer.js';
import { createAssetLibrary } from './lockdown-assets.js';
import { gameKey } from './keyboard-layout.js';
import { GameAudio } from './audio.js';
import { getName, saveName } from './hub/shared.js';

const { TICK_RATE, RULES, CLASSES, WEAPONS, WEAPON_IDS, DEFAULT_LOADOUTS, MAPS, MAP_IDS, ABILITIES, INPUT_KEYS } = Engine;
const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const roomId = params.get('room');
const solo = !roomId;
const FAMILY_GLYPH = { blade: '⚔', gun: '✦', bomb: '●' };
const CLASS_GLYPH = { striker: '➶', guardian: '⛨', recon: '◐' };
const ABILITY_ICON = { striker: 'dash', guardian: 'bubble', recon: 'cloak' };
const STORAGE_KEY = 'semag-lockdown-setup';
const SEND_INTERVAL_MS = 16, HEARTBEAT_MS = 100, MAX_EXTRAPOLATE_MS = 60;

const app = $('ld-app'), canvas = $('ld-arena'), minimap = $('ld-minimap');
const audio = new GameAudio();
const assets = createAssetLibrary({ onChange: () => refreshIcons() });
const renderer = new LockdownRenderer(canvas, assets);

// ---------- local setup (remembered per browser) ----------
function loadSetup() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved && Object.hasOwn(CLASSES, saved.cls) && Array.isArray(saved.weapons) && saved.weapons.length === 3 && new Set(saved.weapons).size === 3 && saved.weapons.every(id => Object.hasOwn(WEAPONS, id))) return { cls: saved.cls, weapons: saved.weapons, team: saved.team === 1 ? 1 : 0 };
  } catch {}
  return { cls: 'striker', weapons: [...DEFAULT_LOADOUTS.striker], team: 0 };
}
function storeSetup() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(setup)); } catch {} }
const setup = loadSetup();
let soloMapId = MAP_IDS[0];

// ---------- session state ----------
let state = null;          // latest authoritative (or local) state
let previous = null;       // previous snapshot, for interpolation
let receivedAt = 0, previousAt = 0, snapshotGap = 1000 / 40;
let localId = solo ? 0 : null;
let hostId = solo ? 0 : null;
let socket = null, connected = false, seq = 0, setupSent = false;
let menuOpen = true, lastPhase = null, statusTimer = 0;

function setStatus(text, sticky = false) {
  $('ld-status').textContent = text || '';
  clearTimeout(statusTimer);
  if (text && !sticky) statusTimer = setTimeout(() => { $('ld-status').textContent = ''; }, 4000);
}

// ---------- solo simulation ----------
let accumulator = 0, lastFrame = performance.now();
function soloCreate() {
  state = Engine.createState({ mapId: soloMapId, seed: (Math.random() * 2 ** 32) >>> 0 });
  Engine.setConnected(state, 0, true, getName());
  applySetupLocally();
}
function applySetupLocally() {
  if (!state || state.phase !== 'lobby' && state.phase !== 'matchEnd') return;
  const result = Engine.setPlayerSetup(state, 0, { team: setup.team, cls: setup.cls, weapons: setup.weapons, name: getName() });
  if (!result.ok) setStatus(result.error);
}
function soloStep(elapsedMs) {
  if (!state || menuOpen && state.phase !== 'matchEnd') return; // the menu pauses practice
  accumulator = Math.min(accumulator + elapsedMs, 250);
  const stepMs = 1000 / TICK_RATE;
  while (accumulator >= stepMs) {
    accumulator -= stepMs;
    const inputs = []; inputs[0] = sampleInput(true);
    Engine.step(state, inputs);
  }
}

// ---------- networking ----------
function connect() {
  const url = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws?room=${encodeURIComponent(roomId)}`;
  socket = new WebSocket(url);
  socket.addEventListener('open', () => { connected = true; send({ type: 'join', name: getName() }); setStatus('Connected.'); });
  socket.addEventListener('close', () => { connected = false; setStatus('Disconnected from the room. Refresh to rejoin.', true); });
  socket.addEventListener('message', event => {
    let data; try { data = JSON.parse(event.data); } catch { return; }
    if (data.type === 'welcome') {
      localId = data.playerId; setupSent = false;
    } else if (data.type === 'state') {
      hostId = data.hostId ?? null;
      previous = state; previousAt = receivedAt;
      state = data.state; receivedAt = performance.now();
      if (previous && previous.tick < state.tick) snapshotGap = Math.max(8, Math.min(120, (receivedAt - previousAt) * .3 + snapshotGap * .7));
      syncLocalSetupFromState();
    } else if (data.type === 'error') setStatus(data.message);
  });
}
function send(message) { if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message)); }
function syncLocalSetupFromState() {
  const me = state && localId !== null ? state.players[localId] : null;
  if (!me || state.phase !== 'lobby') return;
  // Send the remembered setup the first time we sit in a lobby.
  if (!setupSent) { setupSent = true; send({ type: 'lockdown-setup', team: setup.team, cls: setup.cls, weapons: setup.weapons }); return; }
  // The server is the source of truth (a full team, for example, keeps you where you were).
  setup.team = me.team;
}

// ---------- input ----------
const held = new Set();      // logical keys currently down
const pressed = new Set();   // edges seen since the last sample, so quick taps are never lost
const mouse = { x: 0, y: 0, inside: false, left: false, right: false };
let aim = 0, wheelSwap = false;
const KEY_BINDINGS = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  Space: 'ability', KeyE: 'ability2', Digit1: 'slot1', Digit2: 'slot2', Digit3: 'slot3', KeyQ: 'swap',
};
function bindingFor(event) {
  if (KEY_BINDINGS[event.code] && event.code.startsWith('Arrow')) return KEY_BINDINGS[event.code];
  const key = gameKey(event);
  const code = typeof key === 'string' && key.length === 1 ? (/[0-9]/.test(key) ? `Digit${key}` : `Key${key.toUpperCase()}`) : event.code;
  return KEY_BINDINGS[code] || KEY_BINDINGS[event.code] || null;
}
function press(control) { held.add(control); pressed.add(control); }
function release(control) { held.delete(control); }
addEventListener('keydown', event => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
  if (event.code === 'Escape' || event.code === 'KeyP') { event.preventDefault(); toggleMenu(); return; }
  if (menuOpen) return;
  const control = bindingFor(event);
  if (!control) return;
  event.preventDefault();
  if (!event.repeat) press(control);
});
addEventListener('keyup', event => { const control = bindingFor(event); if (control) release(control); });
addEventListener('blur', () => { held.clear(); mouse.left = mouse.right = false; });
canvas.addEventListener('contextmenu', event => event.preventDefault());
canvas.addEventListener('pointermove', event => { mouse.x = event.offsetX; mouse.y = event.offsetY; mouse.inside = true; });
canvas.addEventListener('pointerdown', event => {
  enableAudio();
  canvas.focus();
  mouse.x = event.offsetX; mouse.y = event.offsetY;
  if (event.button === 0) { mouse.left = true; press('attack'); }
  if (event.button === 2) { mouse.right = true; press('ability'); }
  canvas.setPointerCapture?.(event.pointerId);
});
canvas.addEventListener('pointerup', event => {
  if (event.button === 0) { mouse.left = false; release('attack'); }
  if (event.button === 2) { mouse.right = false; release('ability'); }
});
canvas.addEventListener('wheel', event => { event.preventDefault(); if (Math.abs(event.deltaY) > 4) wheelSwap = true; }, { passive: false });

function updateAim() {
  const me = viewState()?.players[localId ?? -1];
  if (!me || !mouse.inside) return;
  const world = renderer.screenToWorld(mouse.x, mouse.y);
  aim = Math.atan2(world.y - me.y, world.x - me.x);
}
/** One input frame. Edge presses that were already released still count once. */
function sampleInput(consume) {
  const input = Engine.emptyInput(aim);
  if (menuOpen) return input;
  for (const key of INPUT_KEYS) input[key] = held.has(key) || pressed.has(key);
  if (wheelSwap) input.swap = true;
  if (consume) { pressed.clear(); wheelSwap = false; }
  return input;
}
let lastSent = 0, lastSentKey = '';
function sendInput(now) {
  if (!connected || localId === null) return;
  const input = sampleInput(false), key = JSON.stringify(input);
  if (now - lastSent < SEND_INTERVAL_MS || key === lastSentKey && now - lastSent < HEARTBEAT_MS) return;
  sampleInput(true);
  lastSent = now; lastSentKey = key;
  send({ type: 'input', seq: ++seq, buttons: input });
  // A tap released before this send goes out as a press now and a release next time.
  if (INPUT_KEYS.some(control => input[control] && !held.has(control))) lastSentKey = '';
}

// ---------- audio ----------
let audioOn = false;
async function enableAudio() { if (audioOn) return; audioOn = true; try { await audio.setEnabled(true); } catch { audioOn = false; } }
const heardEvents = new Set(), heardOrder = [];
function playEvents(current) {
  for (const event of current.events || []) {
    if (heardEvents.has(event.id)) continue;
    heardEvents.add(event.id); heardOrder.push(event.id); if (heardOrder.length > 600) heardEvents.delete(heardOrder.shift());
    if (current.tick - event.tick > TICK_RATE / 2) continue;
    const me = current.players[localId ?? -1], near = me && Number.isFinite(event.x) ? Math.max(.15, 1 - Math.hypot(event.x - me.x, event.y - me.y) / 900) : .6;
    try {
      switch (event.type) {
        case 'swing': audio.noise(event.charged ? .22 : .09, { highpass: 900, lowpass: 5200, gain: .16 * near }); if (event.charged) audio.tone(180, .2, { end: 60, type: 'triangle', gain: .2 * near }); break;
        case 'shot': audio.tone(event.weapon === 'magnus' ? 220 : event.weapon === 'scatter' ? 300 : 620, event.charged ? .18 : .08, { end: 120, type: 'square', gain: .08 * near }); audio.noise(.06, { highpass: 1200, gain: .1 * near }); break;
        case 'damage': if (event.targetId === localId) audio.tone(140, .12, { end: 70, type: 'sawtooth', gain: .2 }); else if (event.playerId === localId) audio.tone(880, .05, { end: 660, type: 'triangle', gain: .12 }); break;
        case 'explosion': audio.noise(.45, { highpass: 40, lowpass: 1400, gain: .5 * near }); audio.tone(90, .4, { end: 30, gain: .4 * near }); break;
        case 'bombPlant': audio.tone(500, .06, { end: 700, type: 'square', gain: .08 * near }); break;
        case 'kill': if (event.playerId === localId) audio.tone(520, .25, { end: 1040, type: 'triangle', gain: .2 }); else if (event.targetId === localId) audio.tone(260, .5, { end: 80, type: 'sawtooth', gain: .2 }); break;
        case 'capture': audio.tone(me && event.team === me.team ? 660 : 330, .35, { end: me && event.team === me.team ? 990 : 220, type: 'triangle', gain: .22 }); break;
        case 'bubble': audio.tone(300, .3, { end: 520, gain: .15 * near }); break;
        case 'bubblePop': audio.noise(.15, { highpass: 1500, gain: .2 * near }); break;
        case 'heal': audio.tone(520, .3, { end: 880, gain: .15 * near }); break;
        case 'dash': audio.noise(.18, { highpass: 2000, gain: .1 * near }); break;
        case 'cloak': audio.tone(700, .25, { end: 200, gain: .1 * near }); break;
        case 'fight': audio.fight?.(); break;
        case 'matchEnd': audio.tone(me && event.winner === me.team ? 523 : 262, .6, { end: me && event.winner === me.team ? 1046 : 131, type: 'triangle', gain: .25 }); break;
      }
    } catch {}
  }
}

// ---------- interpolation ----------
/** Online play renders between the two latest snapshots; practice renders the live state. */
function viewState(now = performance.now()) {
  if (!state) return null;
  if (solo || !previous || previous.phase !== state.phase) return state;
  const alpha = Math.max(0, Math.min(1, (now - receivedAt) / snapshotGap));
  const extra = Math.max(0, Math.min(MAX_EXTRAPOLATE_MS, now - receivedAt - snapshotGap)) / 1000;
  const players = state.players.map((player, index) => {
    const before = previous.players[index];
    if (!before || !before.alive || !player.alive || Math.hypot(player.x - before.x, player.y - before.y) > 120) return player;
    return { ...player, x: before.x + (player.x - before.x) * alpha, y: before.y + (player.y - before.y) * alpha };
  });
  const projectiles = state.projectiles.map(shot => ({ ...shot, x: shot.x + shot.vx * extra, y: shot.y + shot.vy * extra }));
  return { ...state, players, projectiles };
}

// ---------- HUD ----------
const fmtTime = ticks => { const s = Math.ceil(ticks / TICK_RATE); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const pointChips = new Map();
function ensurePointChips(points) {
  const box = $('ld-points');
  if (pointChips.size === points.length && points.every(point => pointChips.has(point.id))) return;
  box.textContent = ''; pointChips.clear();
  for (const point of points) {
    const chip = document.createElement('span'); chip.className = 'ld-point'; chip.textContent = point.id;
    const bar = document.createElement('i'), fill = document.createElement('em'); bar.append(fill); chip.append(bar);
    box.append(chip); pointChips.set(point.id, { chip, fill });
  }
}
let weaponCards = [];
function buildWeaponCards(me) {
  const key = me.weapons.join(',');
  if ($('ld-weapons').dataset.key === key) return;
  $('ld-weapons').dataset.key = key; $('ld-weapons').textContent = '';
  weaponCards = me.weapons.map((id, slot) => {
    const weapon = WEAPONS[id], card = document.createElement('div');
    card.className = 'ld-weapon';
    card.innerHTML = `<kbd>${slot + 1}</kbd>${iconMarkup(`icon_weapon_${id}`, FAMILY_GLYPH[weapon.family])}<b></b><small></small><div class="ld-pips"></div><div class="ld-charge"><em></em></div>`;
    card.querySelector('b').textContent = weapon.name; card.querySelector('small').textContent = weapon.family;
    $('ld-weapons').append(card);
    return { card, pips: card.querySelector('.ld-pips'), charge: card.querySelector('.ld-charge em'), id };
  });
}
function iconMarkup(key, glyph) {
  const image = assets.get(key);
  return image ? `<img alt="" src="${image.src}">` : `<span class="ld-glyph" aria-hidden="true">${glyph}</span>`;
}
const feedSeen = new Set();
function pushFeed(current) {
  const feed = $('ld-feed');
  for (const event of current.events || []) {
    if (event.type !== 'kill' && event.type !== 'capture' || feedSeen.has(event.id)) continue;
    feedSeen.add(event.id);
    if (current.tick - event.tick > TICK_RATE * 4) continue;
    const item = document.createElement('li');
    const name = id => { const player = current.players[id]; const span = document.createElement('span'); span.className = player?.team === 0 ? 'a' : 'c'; span.textContent = player?.name ?? '—'; return span; };
    if (event.type === 'kill') { if (event.playerId !== null && event.playerId !== undefined) item.append(name(event.playerId), ' ⚔ '); item.append(name(event.targetId)); }
    else { const span = document.createElement('span'); span.className = event.team === 0 ? 'a' : 'c'; span.textContent = `${TEAM_COLORS[event.team].name} took ${event.pointId}`; item.append(span); }
    feed.prepend(item);
    setTimeout(() => item.remove(), 5000);
    while (feed.children.length > 6) feed.lastElementChild.remove();
  }
}
function updateHud(current) {
  for (const team of [0, 1]) {
    $(`ld-score${team}`).textContent = current.scores[team];
    $(`ld-bar${team}`).style.width = `${Math.min(100, current.scores[team] / RULES.scoreToWin * 100)}%`;
  }
  $('ld-timer').textContent = fmtTime(current.timeLeftTicks);
  ensurePointChips(current.points);
  for (const point of current.points) {
    const { chip, fill } = pointChips.get(point.id);
    chip.dataset.owner = point.owner ?? 'none';
    chip.dataset.contested = String(!!(point.counts && point.counts[0] && point.counts[1]));
    fill.style.width = `${Math.abs(point.progress)}%`;
    fill.style.background = point.progress >= 0 ? TEAM_COLORS[0].main : TEAM_COLORS[1].main;
  }
  const me = current.players[localId ?? -1];
  if (me) {
    $('ld-class').textContent = CLASSES[me.cls].name.toUpperCase();
    $('ld-hp').textContent = Math.max(0, Math.ceil(me.alive ? me.hp : 0));
    $('ld-hp-bar').style.width = `${me.alive ? Math.max(0, me.hp / me.maxHp * 100) : 0}%`;
    const ability = { striker: ['Dash', ABILITIES.dash.cooldown, me.dashTicks > 0], guardian: ['Bubble', ABILITIES.bubble.cooldown, me.bubbleTicks > 0], recon: ['Cloak', ABILITIES.cloak.cooldown, me.cloakTicks > 0] }[me.cls];
    $('ld-ability1-name').textContent = ability[0];
    $('ld-ability1').dataset.active = String(ability[2]);
    $('ld-ability1').querySelector('em').style.transform = `scaleX(${me.abilityCooldown / ability[1]})`;
    $('ld-ability2').hidden = me.cls !== 'guardian';
    $('ld-ability2').querySelector('em').style.transform = `scaleX(${me.ability2Cooldown / ABILITIES.heal.cooldown})`;
    buildWeaponCards(me);
    weaponCards.forEach((card, slot) => {
      const weapon = WEAPONS[card.id];
      card.card.dataset.active = String(slot === me.slot);
      const pips = weapon.family === 'gun' ? weapon.clip : 0, have = me.clips?.[card.id] ?? 0;
      if (card.pips.childElementCount !== pips) { card.pips.textContent = ''; for (let i = 0; i < pips; i++) card.pips.append(document.createElement('i')); }
      [...card.pips.children].forEach((pip, index) => pip.classList.toggle('empty', index >= have || (me.reloadTicks?.[card.id] ?? 0) > 0));
      card.charge.style.width = slot === me.slot && me.charging ? `${Math.min(100, me.chargeTicks / weapon.chargeTicks * 100)}%` : '0%';
      card.charge.style.background = slot === me.slot && me.chargeTicks >= weapon.chargeTicks ? '#ffffff' : '';
    });
  }
  // Big centre banner: countdown, respawn, result.
  const banner = $('ld-banner');
  let text = '', sub = '';
  if (current.phase === 'countdown') { text = String(Math.ceil(current.phaseTicks / TICK_RATE)); sub = `${current.mapName} — take the points!`; }
  else if (current.phase === 'fight' && me && !me.alive) { text = `Respawn in ${Math.ceil(me.respawnTicks / TICK_RATE)}`; sub = 'Pick a different weapon with 1–3 while you wait.'; }
  else if (current.phase === 'matchEnd') { text = current.winner === null ? 'Draw' : `${TEAM_COLORS[current.winner].name} wins`; sub = `${current.scores[0]} – ${current.scores[1]}`; }
  banner.hidden = !text;
  if (text && (banner.dataset.text !== text + sub)) { banner.dataset.text = text + sub; banner.textContent = text; const small = document.createElement('small'); small.textContent = sub; banner.append(small); }
  renderer.drawMinimap(minimap, current, { localId });
  pushFeed(current);
}

// ---------- menu ----------
function toggleMenu(force) {
  menuOpen = typeof force === 'boolean' ? force : !menuOpen;
  if (state && state.phase === 'lobby') menuOpen = true;
  app.dataset.menu = menuOpen ? 'open' : 'closed';
  held.clear(); pressed.clear(); mouse.left = mouse.right = false;
  if (!menuOpen) canvas.focus();
  renderMenu();
}
function buildMenu() {
  $('ld-name').value = getName();
  $('ld-name').addEventListener('change', () => {
    const name = saveName($('ld-name').value); $('ld-name').value = name;
    if (solo) applySetupLocally(); else send({ type: 'join', name });
  });
  for (const button of document.querySelectorAll('.ld-team-button')) button.addEventListener('click', () => chooseSetup({ team: Number(button.dataset.team) }));
  const classes = $('ld-classes');
  for (const cls of Object.values(CLASSES)) {
    const card = document.createElement('button'); card.type = 'button'; card.className = 'ld-class-card'; card.dataset.cls = cls.id;
    card.innerHTML = `<span class="ld-class-icon"></span><b></b><small></small>`;
    card.querySelector('b').textContent = cls.name;
    card.querySelector('small').textContent = `${cls.hp} HP · ${cls.ability}${cls.ability2 ? ` + ${cls.ability2}` : ''}`;
    card.addEventListener('click', () => {
      // Picking a class also offers its signature loadout unless you already customised one.
      const defaults = Object.values(DEFAULT_LOADOUTS).some(loadout => loadout.join() === setup.weapons.join());
      chooseSetup(defaults ? { cls: cls.id, weapons: [...DEFAULT_LOADOUTS[cls.id]] } : { cls: cls.id });
    });
    classes.append(card);
  }
  const loadout = $('ld-loadout');
  for (let slot = 0; slot < 3; slot++) {
    const label = document.createElement('label'), select = document.createElement('select');
    label.append(Object.assign(document.createElement('kbd'), { textContent: String(slot + 1) }), select);
    for (const family of ['blade', 'gun', 'bomb']) {
      const group = document.createElement('optgroup'); group.label = `${family[0].toUpperCase()}${family.slice(1)}s`;
      for (const id of WEAPON_IDS.filter(weaponId => WEAPONS[weaponId].family === family)) group.append(new Option(WEAPONS[id].name, id));
      select.append(group);
    }
    select.addEventListener('change', () => {
      const weapons = [...setup.weapons], other = weapons.indexOf(select.value);
      if (other >= 0 && other !== slot) weapons[other] = weapons[slot]; // swap instead of duplicating
      weapons[slot] = select.value;
      chooseSetup({ weapons });
    });
    select.addEventListener('focus', () => showWeaponNote(select.value));
    select.addEventListener('input', () => showWeaponNote(select.value));
    loadout.append(label);
  }
  const mapSelect = $('ld-map');
  for (const id of MAP_IDS) mapSelect.append(new Option(MAPS[id].name, id));
  mapSelect.addEventListener('change', () => {
    if (solo) { soloMapId = mapSelect.value; Engine.selectMap(state, soloMapId); renderMenu(); }
    else send({ type: 'lockdown-map', mapId: mapSelect.value });
  });
  $('ld-start').addEventListener('click', () => {
    enableAudio();
    if (!state) return;
    if (state.phase === 'matchEnd') { if (solo) { Engine.resetLobby(state); applySetupLocally(); } else send({ type: 'rematch' }); renderMenu(); return; }
    if (solo) { applySetupLocally(); Engine.startMatch(state, [0]); toggleMenu(false); }
    else send({ type: 'start' });
  });
  $('ld-resume').addEventListener('click', () => toggleMenu(false));
  $('ld-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(location.href); setStatus('Invite link copied.'); } catch { setStatus(location.href, true); }
  });
  if (!solo) { $('ld-room-box').hidden = false; $('ld-room-code').textContent = roomId; $('ld-mode').textContent = 'ONLINE ROOM · UP TO 4V4'; }
  else $('ld-mode').textContent = 'PRACTICE · YOU + 7 BOTS';
}
function showWeaponNote(id) { const weapon = WEAPONS[id]; if (weapon) $('ld-weapon-note').textContent = `${weapon.name}: ${weapon.description}`; }
function chooseSetup(change) {
  const changedWeapon = change.weapons?.find((id, slot) => id !== setup.weapons[slot]);
  Object.assign(setup, change); storeSetup();
  if (solo) applySetupLocally();
  else send({ type: 'lockdown-setup', ...change });
  if (changedWeapon) showWeaponNote(changedWeapon);
  if (change.cls) $('ld-class-note').textContent = CLASSES[setup.cls].description;
  renderMenu();
}
function refreshIcons() {
  for (const card of document.querySelectorAll('.ld-class-card')) card.querySelector('.ld-class-icon').innerHTML = iconMarkup(`icon_class_${card.dataset.cls}`, CLASS_GLYPH[card.dataset.cls]);
  $('ld-weapons').dataset.key = '';
}
function renderMenu() {
  const me = state?.players[localId ?? -1];
  const phase = state?.phase ?? 'lobby';
  app.dataset.phase = phase;
  const team = me?.team ?? setup.team, cls = me?.cls ?? setup.cls, weapons = me?.weapons ?? setup.weapons;
  for (const button of document.querySelectorAll('.ld-team-button')) { button.setAttribute('aria-pressed', String(Number(button.dataset.team) === team)); button.disabled = phase !== 'lobby' && phase !== 'matchEnd'; }
  for (const card of document.querySelectorAll('.ld-class-card')) { card.setAttribute('aria-pressed', String(card.dataset.cls === cls)); card.disabled = phase !== 'lobby' && phase !== 'matchEnd'; }
  [...$('ld-loadout').querySelectorAll('select')].forEach((select, slot) => { select.value = weapons[slot]; select.disabled = phase !== 'lobby' && phase !== 'matchEnd'; });
  if (!$('ld-class-note').textContent) $('ld-class-note').textContent = CLASSES[cls].description;
  if (!$('ld-weapon-note').textContent) showWeaponNote(weapons[0]);
  const isHost = solo || hostId === localId;
  const mapId = state?.mapId ?? soloMapId;
  $('ld-map').value = mapId; $('ld-map').disabled = !isHost || phase !== 'lobby';
  $('ld-map-note').textContent = isHost ? `${MAPS[mapId].name}: three points, mirrored for both teams.` : `${MAPS[mapId].name}. The host picks the map.`;
  const start = $('ld-start');
  start.textContent = phase === 'matchEnd' ? (solo ? 'New match' : 'Back to the lobby') : 'Start match';
  start.hidden = !(phase === 'lobby' || phase === 'matchEnd');
  start.disabled = !isHost || !state || (!solo && !connected);
  if (!isHost && (phase === 'lobby' || phase === 'matchEnd')) setStatus('Waiting for the host to start…', true);
  $('ld-resume').hidden = !(phase === 'countdown' || phase === 'fight');
  // Roster: everyone in seat order, bots greyed.
  const roster = $('ld-roster'); roster.textContent = '';
  for (const player of state?.players ?? []) {
    const item = document.createElement('li');
    item.className = `t${player.team}${player.human ? '' : ' bot'}`;
    item.textContent = `${player.human ? player.name : 'Bot'}${player.id === localId ? ' (you)' : ''}${player.id === hostId && !solo ? ' ★' : ''} · ${CLASSES[player.cls].name}`;
    roster.append(item);
  }
  renderResults();
}
function renderResults() {
  const box = $('ld-results');
  if (!state || state.phase !== 'matchEnd') { box.hidden = true; return; }
  box.hidden = false; box.textContent = '';
  const heading = document.createElement('h2');
  heading.textContent = state.winner === null ? `Draw · ${state.scores[0]} – ${state.scores[1]}` : `${TEAM_COLORS[state.winner].name} wins · ${state.scores[0]} – ${state.scores[1]}`;
  const table = document.createElement('table');
  table.innerHTML = '<thead><tr><th>Knight</th><th>Class</th><th>Captures</th><th>Kills</th><th>Deaths</th><th>Damage</th></tr></thead>';
  const body = document.createElement('tbody');
  for (const row of Engine.getScoreboard(state)) {
    const tr = document.createElement('tr'); tr.className = `t${row.team}`;
    for (const value of [`${row.human ? row.name : 'Bot'}${row.id === localId ? ' (you)' : ''}`, CLASSES[row.cls].name, row.captures, row.kills, row.deaths, Math.round(row.damage)]) tr.append(Object.assign(document.createElement('td'), { textContent: String(value) }));
    body.append(tr);
  }
  table.append(body); box.append(heading, table);
}

// ---------- main loop ----------
function frame(now) {
  const elapsed = now - lastFrame; lastFrame = now;
  updateAim();
  if (solo) soloStep(elapsed); else sendInput(now);
  const view = viewState(now);
  if (view) {
    const me = view.players[localId ?? -1];
    // Show your own aim instantly instead of waiting for the server echo.
    const shown = me && !menuOpen && me.alive ? { ...view, players: view.players.map(player => player.id === localId ? { ...player, aim } : player) } : view;
    const focus = me && !me.alive ? overviewFocus(view, me) : null;
    renderer.render(shown, { localId, now, focus });
    playEvents(view);
    if (view.phase !== 'lobby') updateHud(view);
    if (view.phase !== lastPhase) {
      if (view.phase === 'countdown' && lastPhase !== null) toggleMenu(false);
      if (view.phase === 'matchEnd') toggleMenu(true);
      if (view.phase === 'lobby') toggleMenu(true);
      lastPhase = view.phase; renderMenu();
    } else if (menuOpen && Math.floor(now / 250) !== Math.floor((now - elapsed) / 250)) renderMenu();
  }
  requestAnimationFrame(frame);
}
/** While you wait to respawn the camera drifts toward the most contested point. */
function overviewFocus(view, me) {
  const hot = [...view.points].sort((a, b) => ((b.counts?.[0] || 0) + (b.counts?.[1] || 0)) - ((a.counts?.[0] || 0) + (a.counts?.[1] || 0)))[0];
  return hot ? { x: hot.x, y: hot.y } : { x: me.x, y: me.y };
}

buildMenu();
refreshIcons();
if (solo) soloCreate(); else connect();
app.dataset.menu = 'open';
renderMenu();
requestAnimationFrame(frame);
addEventListener('resize', () => renderer.resize());
// Exposed for automated smoke tests.
globalThis.__lockdown = { get state() { return state; }, get localId() { return localId; }, get menuOpen() { return menuOpen; }, toggleMenu, chooseSetup };
