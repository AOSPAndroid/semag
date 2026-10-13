/** Lockdown page: lobby, input, HUD and networking around the shared engine.
 * `?solo=1` runs the simulation in the page with bots; `?room=ID` plays online. */
import * as Engine from './lockdown-engine.js';
import { LockdownRenderer, TEAM_COLORS, FLOOR_RISE } from './lockdown-renderer.js';
import { createAssetLibrary } from './lockdown-assets.js';
import { gameKey } from './keyboard-layout.js';
import { GameAudio } from './audio.js';
import { getName, saveName } from './hub/shared.js';

const { TICK_RATE, RULES, CLASSES, ARMORS, ARMOR_IDS, GEAR, GEAR_SLOTS, combineGear, WEAPONS, WEAPON_IDS, DEFAULT_LOADOUTS, SLOT_COUNT, MAPS, MAP_IDS, ABILITIES, INPUT_KEYS, GUARD, STATUS, STATUS_IDS } = Engine;
const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const roomId = params.get('room');
const solo = !roomId;
const FAMILY_GLYPH = { blade: '⚔', gun: '✦', bomb: '●' };
const CLASS_GLYPH = { striker: '➶', guardian: '⛨', recon: '◐' };
const ELEMENT_TAGS = { chill: 'Frost', freeze: 'Frost', burn: 'Fire', shock: 'Shock', poison: 'Poison', curse: 'Curse', drain: 'Drain' };
let gearTab = 'armor';
const GEAR_LABELS = { helmet: 'Helmet', armor: 'Armor', pants: 'Pants', shoes: 'Shoes' };
const GEAR_GLYPH = { helmet: '⛑', pants: '⫴', shoes: '👢' };
const gearIcon = (slot, id) => iconMarkup(slot === 'armor' ? `icon_armor_${id}` : `icon_${slot}_${id}`, slot === 'armor' ? ARMOR_GLYPH[id] || '◆' : GEAR_GLYPH[slot]);
const ARMOR_GLYPH = { none: '♙', scout: '➶', ballistic: '▣', duelist: '⚔', heavy: '⛨', gunslinger: '✦', fencer: '†', windrunner: '≋', juggernaut: '▦', bombardier: '●', berserker: '✷', mirrorweave: '◇', medic: '✚', clockwork: '⚙' };
const ABILITY_ICON = { striker: 'dash', guardian: 'bubble', recon: 'cloak' };
const STORAGE_KEY = 'semag-lockdown-setup';
const SEND_INTERVAL_MS = 16, HEARTBEAT_MS = 100, MAX_EXTRAPOLATE_MS = 60;

const app = $('ld-app'), canvas = $('ld-arena'), minimap = $('ld-minimap');
const audio = new GameAudio();
const assets = createAssetLibrary({ onChange: () => refreshIcons() });
const renderer = new LockdownRenderer(canvas, assets);
const scene = renderer;

// ---------- local setup (remembered per browser) ----------
function loadSetup() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    const weapons = Array.isArray(saved?.weapons) ? Array.from({ length: SLOT_COUNT }, (_, slot) => Object.hasOwn(WEAPONS, saved.weapons[slot]) ? saved.weapons[slot] : null) : [];
    const chosen = weapons.filter(Boolean);
    if (saved && Object.hasOwn(CLASSES, saved.cls) && chosen.length && new Set(chosen).size === chosen.length) {
      return { cls: saved.cls, ...Object.fromEntries(GEAR_SLOTS.map(slot => [slot, Object.hasOwn(GEAR[slot], saved[slot]) ? saved[slot] : 'none'])), weapons, team: saved.team === 1 ? 1 : 0 };
    }
  } catch {}
  return { cls: 'striker', ...Object.fromEntries(GEAR_SLOTS.map(slot => [slot, 'none'])), weapons: [...DEFAULT_LOADOUTS.striker], team: 0 };
}
function storeSetup() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(setup)); } catch {} }
const setup = loadSetup();
const gearOf = source => Object.fromEntries(GEAR_SLOTS.map(slot => [slot, Object.hasOwn(GEAR[slot], source?.[slot]) ? source[slot] : 'none']));
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
  const result = Engine.setPlayerSetup(state, 0, { team: setup.team, cls: setup.cls, ...gearOf(setup), weapons: setup.weapons, name: getName() });
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
  if (!me) return;
  // Send the remembered setup the first time we sit in a lobby.
  if (!setupSent && state.phase === 'lobby') { setupSent = true; send({ type: 'lockdown-setup', team: setup.team, cls: setup.cls, ...gearOf(setup), weapons: setup.weapons }); return; }
  // The server is the source of truth (a full team, for example, keeps you where you were).
  rememberAuthoritativeSetup(me);
}
function rememberAuthoritativeSetup(me) {
  const gear = gearOf(me);
  if (setup.team === me.team && setup.cls === me.cls && GEAR_SLOTS.every(slot => setup[slot] === gear[slot]) && setup.weapons.join() === me.weapons.join()) return;
  Object.assign(setup, { team: me.team, cls: me.cls, ...gear, weapons: [...me.weapons] });
  storeSetup();
}

// ---------- input ----------
const held = new Set();      // logical keys currently down
const pressed = new Set();   // edges seen since the last sample, so quick taps are never lost
const mouse = { x: 0, y: 0, inside: false, left: false, right: false };
let aim = 0, wheelSwap = false;
const KEY_BINDINGS = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  Space: 'dash', ShiftLeft: 'dash', Digit1: 'slot1', Digit2: 'slot2', Digit3: 'slot3', Digit4: 'slot4', KeyQ: 'swap',
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
  if (event.code === 'Escape' && inventoryOpen) { event.preventDefault(); toggleInventory(false); return; }
  if (event.code === 'Escape' || event.code === 'KeyP') { event.preventDefault(); toggleMenu(); return; }
  if (event.code === 'Tab') { event.preventDefault(); showBoard(true); return; }
  if (gameKey(event) === 'i' && !event.repeat && !menuOpen) { event.preventDefault(); toggleInventory(); return; }
  if (event.code === 'Escape' && inventoryOpen) { event.preventDefault(); toggleInventory(false); return; }
  if (event.code === 'KeyB' && !event.repeat && !menuOpen) {
    // The loadout opens in base (or while waiting to respawn); elsewhere B just says where to go.
    event.preventDefault();
    if (canChangeLoadout()) toggleMenu(true); else flashBaseHint();
    return;
  }
  if (menuOpen) return;
  const control = bindingFor(event);
  if (!control) return;
  event.preventDefault();
  if (!event.repeat) press(control);
});
addEventListener('keyup', event => { if (event.code === 'Tab') showBoard(false); const control = bindingFor(event); if (control) release(control); });
addEventListener('blur', () => { held.clear(); mouse.left = mouse.right = false; showBoard(false); });
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
  // Shots fly at chest height in the ¾ view (a storey higher on raised floor), so the pointer is read
  // on that plane, through the camera tilt.
  const world = scene.screenToWorld(mouse.x, mouse.y, scene.aimLift + (me.z || 0) * FLOOR_RISE);
  aim = Math.atan2(world.y - me.y, world.x - me.x);
}
/** One input frame. Edge presses that were already released still count once. */
function sampleInput(consume) {
  const input = Engine.emptyInput(aim);
  if (menuOpen) return input;
  for (const key of INPUT_KEYS) input[key] = held.has(key) || pressed.has(key);
  // With the inventory open the mouse drags items, so clicks never attack.
  if (inventoryOpen) input.attack = input.ability = false;
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
        case 'block': audio.tone(1200, .05, { end: 900, type: 'square', gain: .07 * near }); audio.noise(.05, { highpass: 2500, gain: .08 * near }); break;
        case 'guardBreak': audio.noise(.25, { highpass: 1800, gain: .25 * near }); audio.tone(400, .3, { end: 120, type: 'sawtooth', gain: .15 * near }); break;
        case 'status': audio.tone(event.status === 'freeze' ? 1400 : event.status === 'shock' ? 900 : event.status === 'burn' ? 300 : 500, .18, { end: event.status === 'freeze' ? 2000 : 200, type: 'triangle', gain: .1 * near }); break;
        case 'ricochet': audio.tone(2200, .04, { end: 1500, type: 'square', gain: .04 * near }); break;
        case 'detonate': audio.noise(.3, { highpass: 60, lowpass: 1800, gain: .35 * near }); break;
        case 'slam': audio.noise(.35, { highpass: 40, lowpass: 900, gain: .45 * near }); audio.tone(70, .3, { end: 35, gain: .35 * near }); break;
        case 'spinTurn': audio.noise(.1, { highpass: 1200, lowpass: 5000, gain: .12 * near }); break;
        case 'vortex': audio.tone(200, .6, { end: 60, type: 'sawtooth', gain: .12 * near }); break;
        case 'chargeRelease': if (event.playerId === localId) audio.tone(660, .08, { end: 990, type: 'triangle', gain: .12 }); break;
        case 'dryFire': if (event.playerId === localId) audio.tone(180, .04, { type: 'square', gain: .08 }); break;
        case 'reloaded': if (event.playerId === localId) audio.tone(1000, .04, { end: 1300, type: 'square', gain: .05 }); break;
        case 'fight': audio.fight?.(); break;
        case 'heartDrop': audio.tone(440, .12, { end: 660, type: 'triangle', gain: .06 * near }); break;
        case 'heartPickup': audio.tone(660, .18, { end: 990, type: 'sine', gain: (event.playerId === localId ? .22 : .08) * near }); break;
        case 'loadoutChange': if (event.playerId === localId) audio.tone(392, .15, { end: 523, type: 'triangle', gain: .15 }); break;
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
/** What sits in one inventory slot, for the HUD and the inventory screen. */
function slotItem(me, slot) {
  const id = me.weapons[slot], hearts = me.hearts?.[slot] || 0;
  if (id) { const weapon = WEAPONS[id]; return { kind: 'weapon', id, name: weapon.name, type: weapon.type, icon: iconMarkup(`icon_weapon_${id}`, FAMILY_GLYPH[weapon.family]) }; }
  if (hearts) return { kind: 'hearts', id: 'hearts', name: `Heart × ${hearts}`, type: `Click to heal ${RULES.heart.heal}`, icon: iconMarkup('pickup_heart', '♥'), hearts };
  return { kind: 'empty', id: 'empty', name: 'Empty', type: 'Hearts go here', icon: '<span class="ld-glyph" aria-hidden="true">·</span>' };
}
function buildWeaponCards(me) {
  const key = Array.from({ length: SLOT_COUNT }, (_, slot) => `${me.weapons[slot]}:${me.hearts?.[slot] || 0}`).join(',');
  if ($('ld-weapons').dataset.key === key) return;
  $('ld-weapons').dataset.key = key; $('ld-weapons').textContent = '';
  weaponCards = Array.from({ length: SLOT_COUNT }, (_, slot) => {
    const item = slotItem(me, slot), card = document.createElement('div');
    card.className = 'ld-weapon'; card.dataset.kind = item.kind;
    card.innerHTML = `<kbd>${slot + 1}</kbd>${item.icon}<b></b><small></small><div class="ld-pips"></div><div class="ld-charge"><em></em></div>`;
    card.querySelector('b').textContent = item.name; card.querySelector('small').textContent = item.type;
    $('ld-weapons').append(card);
    return { card, pips: card.querySelector('.ld-pips'), charge: card.querySelector('.ld-charge em'), id: item.kind === 'weapon' ? item.id : null };
  });
}
function iconMarkup(key, glyph) {
  const image = assets.get(key);
  return image ? `<img alt="" src="${image.src}">` : `<span class="ld-glyph" aria-hidden="true">${glyph}</span>`;
}
const percent = value => Math.round(value * 100);
const damageReduction = value => percent(value) > 0 ? `−${percent(value)}%` : percent(value) < 0 ? `+${-percent(value)}%` : '0%';
function armorSpeed(armor) {
  const delta = Math.round((armor.speedMultiplier - 1) * 100);
  return delta > 0 ? `+${delta}%` : delta < 0 ? `−${Math.abs(delta)}%` : '0%';
}
/** Perks and drawbacks an outfit adds on top of the class, as [text, good] pairs. */
const signed = value => `${value > 0 ? '+' : '−'}${Math.abs(percent(value))}%`;
function armorPerkList(armor) {
  const list = [], add = (good, text) => list.push([text, good]);
  if (armor.gunDamage !== 1) add(armor.gunDamage > 1, `Gun damage ${signed(armor.gunDamage - 1)}`);
  if (armor.gunCharge !== 1) add(armor.gunCharge < 1, `Gun charge ${armor.gunCharge < 1 ? 'faster' : 'slower'} ${Math.abs(percent(1 - armor.gunCharge))}%`);
  if (armor.bladeDamage !== 1) add(armor.bladeDamage > 1, `Sword damage ${signed(armor.bladeDamage - 1)}`);
  if (armor.bladeSpeed !== 1) add(armor.bladeSpeed > 1, `Swings ${armor.bladeSpeed > 1 ? 'faster' : 'slower'} ${Math.abs(percent(armor.bladeSpeed - 1))}%`);
  if (armor.bombDamage !== 1) add(armor.bombDamage > 1, `Bomb damage ${signed(armor.bombDamage - 1)}`);
  if (armor.bombCharge !== 1) add(armor.bombCharge < 1, `Bomb charge ${armor.bombCharge < 1 ? 'faster' : 'slower'} ${Math.abs(percent(1 - armor.bombCharge))}%`);
  if (armor.maxHp) add(armor.maxHp > 0, `Health ${armor.maxHp > 0 ? '+' : '−'}${Math.abs(armor.maxHp)}`);
  if (armor.dashCooldown !== 1) add(armor.dashCooldown < 1, `Dash recharge ${armor.dashCooldown < 1 ? 'faster' : 'slower'} ${Math.abs(percent(1 - armor.dashCooldown))}%`);
  if (armor.dashDistance !== 1) add(armor.dashDistance > 1, `Dash ${armor.dashDistance > 1 ? 'longer' : 'shorter'} ${Math.abs(percent(armor.dashDistance - 1))}%`);
  if (armor.abilityCooldown !== 1) add(armor.abilityCooldown < 1, `Ability recharge ${armor.abilityCooldown < 1 ? 'faster' : 'slower'} ${Math.abs(percent(1 - armor.abilityCooldown))}%`);
  if (armor.knockback !== 1) add(armor.knockback < 1, `Knockback ${armor.knockback < 1 ? '−' : '+'}${Math.abs(percent(1 - armor.knockback))}%`);
  if (armor.statusDuration !== 1) add(armor.statusDuration < 1, `Status effects ${Math.abs(percent(1 - armor.statusDuration))}% ${armor.statusDuration < 1 ? 'shorter' : 'longer'}`);
  if (armor.healing !== 1) add(armor.healing > 1, `Healing ${signed(armor.healing - 1)}`);
  if (armor.walk?.length) add(true, `Walks over ${armor.walk.join(', ').replace('chasm', 'open sky and chasms')}`);
  if (armor.regen) add(true, `Regenerates ${Math.round(armor.regen * armor.healing * 10) / 10} HP/s out of combat`);
  return list;
}
const armorPerks = armor => armorPerkList(armor).map(([text]) => text);
function armorStats(armor) {
  return [`Gun ${damageReduction(armor.gunResistance)} · Sword ${damageReduction(armor.bladeResistance)} · Blast ${damageReduction(armor.bombResistance)} · Speed ${armorSpeed(armor)}`, ...armorPerks(armor)].join(' · ');
}
function armorStatMarkup(armor) {
  const weak = value => value < 0 ? ' class="slower" title="Takes more damage"' : '';
  return `<span${weak(armor.gunResistance)}>Gun <b>${damageReduction(armor.gunResistance)}</b></span><span${weak(armor.bladeResistance)}>Sword <b>${damageReduction(armor.bladeResistance)}</b></span><span${weak(armor.bombResistance)}>Blast <b>${damageReduction(armor.bombResistance)}</b></span><span class="${armor.speedMultiplier > 1 ? 'faster' : armor.speedMultiplier < 1 ? 'slower' : ''}">Speed <b>${armorSpeed(armor)}</b></span>${armorPerkList(armor).map(([text, good]) => `<span class="perk ${good ? 'good' : 'bad'}">${good ? '▲' : '▼'} ${text}</span>`).join('')}`;
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
    const gear = combineGear(me);
    $('ld-armor-name').textContent = gear.name;
    $('ld-armor-stats').textContent = armorStats(gear);
    $('ld-hp').textContent = `${Math.max(0, Math.ceil(me.alive ? me.hp : 0))} / ${me.maxHp}`;
    $('ld-hp-bar').style.width = `${me.alive ? Math.max(0, me.hp / me.maxHp * 100) : 0}%`;
    // The class ability: Striker Boost and Recon Cloak have cooldowns; the Guardian's shield has health.
    const ability = { striker: ['Boost', ABILITIES.dash.cooldown, me.dashTicks > 0 || me.evadeTicks > 0], guardian: ['Shield (hold)', 1, me.guarding], recon: ['Cloak', ABILITIES.cloak.cooldown, me.cloakTicks > 0] }[me.cls];
    $('ld-ability1-name').textContent = ability[0];
    $('ld-ability1').dataset.active = String(ability[2]);
    $('ld-ability1').querySelector('em').style.transform = `scaleX(${me.cls === 'guardian' ? 0 : me.abilityCooldown / ability[1]})`;
    $('ld-guard').hidden = me.cls !== 'guardian';
    $('ld-dash').querySelector('em').style.transform = `scaleX(${(me.dashCooldown || 0) / RULES.dash.cooldown})`;
    $('ld-dash').dataset.active = String(me.dodgeTicks > 0);
    const guardMax = GUARD.max;
    $('ld-guard-bar').style.width = `${Math.max(0, (me.guardHp ?? guardMax) / guardMax * 100)}%`;
    $('ld-guard').dataset.state = me.guardBroken ? 'broken' : me.guarding ? 'up' : 'ready';
    $('ld-statuses').textContent = STATUS_IDS.filter(id => me.status?.[id] > 0).map(id => `${STATUS[id].name}${id === 'chill' ? ` ${me.chillStacks}/${STATUS.chill.freezeAt}` : ''} ${Math.ceil(me.status[id] / TICK_RATE)}s${id === 'curse' ? ' (no dash or ability)' : ''}`).join(' · ');
    buildWeaponCards(me);
    renderInventory();
    weaponCards.forEach((card, slot) => {
      const weapon = WEAPONS[card.id];
      card.card.dataset.active = String(slot === me.slot);
      if (!weapon) { card.pips.textContent = ''; card.charge.style.width = '0%'; return; }
      const pips = weapon.family === 'gun' ? weapon.clip : 0, have = me.clips?.[card.id] ?? 0;
      if (card.pips.childElementCount !== pips) { card.pips.textContent = ''; for (let i = 0; i < pips; i++) card.pips.append(document.createElement('i')); }
      [...card.pips.children].forEach((pip, index) => pip.classList.toggle('empty', index >= have || (me.reloadTicks?.[card.id] ?? 0) > 0));
      const needed = Engine.chargeTicksFor(me, weapon);
      card.charge.style.width = slot === me.slot && me.charging ? `${Math.min(100, me.chargeTicks / needed * 100)}%` : '0%';
      card.charge.style.background = slot === me.slot && me.chargeTicks >= needed ? '#ffffff' : '';
    });
  }
  // Big centre banner: countdown, respawn, result.
  const banner = $('ld-banner');
  let text = '', sub = '';
  if (current.phase === 'countdown') { text = String(Math.ceil(current.phaseTicks / TICK_RATE)); sub = `${current.mapName} — take the points!`; }
  else if (current.phase === 'fight' && me && !me.alive) { text = `Respawn in ${Math.ceil(me.respawnTicks / TICK_RATE)}`; sub = 'Press B to change class or equipment before you return.'; }
  else if (current.phase === 'matchEnd') { text = current.winner === null ? 'Draw' : `${TEAM_COLORS[current.winner].name} wins`; sub = `${current.scores[0]} – ${current.scores[1]}`; }
  banner.hidden = !text;
  const base = me && me.alive && current.phase === 'fight' && Engine.inBase(current, me);
  $('ld-base-hint').hidden = !(base && !menuOpen) && performance.now() > baseHintFlash;
  const hint = $('ld-base-hint'), [label, status, action] = hint.children;
  for (const button of hint.querySelectorAll('[data-base-class]')) button.setAttribute('aria-pressed', String(me && button.dataset.baseClass === me.cls));
  hint.querySelector('.ld-base-classes').hidden = !base;
  hint.classList.toggle('away', !base);
  label.textContent = base ? 'IN BASE' : 'LOADOUT';
  status.textContent = base ? (me.hp < me.maxHp ? 'Healing' : 'Full health') : 'Go back to your base to change class or equipment';
  action.hidden = !base;
  if (boardOpen && performance.now() - boardDrawn > 250) { boardDrawn = performance.now(); $('ld-board').hidden = false; $('ld-board').replaceChildren(scoreTables(current)); }
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
  // Class stations in the base: one click switches class without opening the menu.
  for (const button of document.querySelectorAll('[data-base-class]')) button.addEventListener('click', event => {
    event.stopPropagation(); if (!canChangeLoadout()) return;
    const id = button.dataset.baseClass, keepWeapons = !Object.values(DEFAULT_LOADOUTS).some(loadout => loadout.join() === setup.weapons.join());
    chooseSetup(keepWeapons ? { cls: id } : { cls: id, weapons: [...DEFAULT_LOADOUTS[id]] });
    canvas.focus();
  });
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
    card.querySelector('small').textContent = `${cls.hp} HP · ${cls.ability}`;
    card.addEventListener('click', () => {
      // Picking a class also offers its signature loadout unless you already customised one.
      const defaults = Object.values(DEFAULT_LOADOUTS).some(loadout => loadout.join() === setup.weapons.join());
      chooseSetup(defaults ? { cls: cls.id, weapons: [...DEFAULT_LOADOUTS[cls.id]] } : { cls: cls.id });
    });
    classes.append(card);
  }
  // Equipment: one tab per slot (helmet, armour, pants, shoes); every piece is a card.
  for (const tab of document.querySelectorAll('[data-gear-tab]')) tab.addEventListener('click', () => { gearTab = tab.dataset.gearTab; buildGearCards(); renderMenu(); });
  $('ld-gear-random').addEventListener('click', () => {
    if (!canChangeLoadout()) return;
    const pick = slot => { const ids = Object.keys(GEAR[slot]); return ids[Math.floor(Math.random() * ids.length)]; };
    chooseSetup(Object.fromEntries(GEAR_SLOTS.map(slot => [slot, pick(slot)])));
  });
  $('ld-gear-clear').addEventListener('click', () => { if (canChangeLoadout()) chooseSetup(Object.fromEntries(GEAR_SLOTS.map(slot => [slot, 'none']))); });
  buildGearCards();
  const loadout = $('ld-loadout');
  for (let slot = 0; slot < SLOT_COUNT; slot++) {
    const label = document.createElement('label'), select = document.createElement('select');
    label.append(Object.assign(document.createElement('kbd'), { textContent: String(slot + 1) }), select);
    select.append(new Option('Empty (room for hearts)', ''));
    for (const family of ['blade', 'gun', 'bomb']) {
      const group = document.createElement('optgroup'); group.label = `${family[0].toUpperCase()}${family.slice(1)}s`;
      for (const id of WEAPON_IDS.filter(weaponId => WEAPONS[weaponId].family === family)) group.append(new Option(`${WEAPONS[id].name}${ELEMENT_TAGS[WEAPONS[id].element] ? ` · ${ELEMENT_TAGS[WEAPONS[id].element]}` : ''}`, id));
      select.append(group);
    }
    select.addEventListener('change', () => {
      const value = select.value || null, weapons = [...setup.weapons], other = value ? weapons.indexOf(value) : -1;
      if (other >= 0 && other !== slot) weapons[other] = weapons[slot]; // swap instead of duplicating
      weapons[slot] = value;
      if (!weapons.some(Boolean)) { setStatus('Carry at least one weapon.'); renderMenu(); return; }
      chooseSetup({ weapons });
    });
    select.addEventListener('focus', () => { if (select.value) showWeaponNote(select.value); });
    select.addEventListener('input', () => { if (select.value) showWeaponNote(select.value); });
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
function buildGearCards() {
  const list = $('ld-armors'); list.textContent = ''; list.setAttribute('aria-label', GEAR_LABELS[gearTab]);
  for (const [id, piece] of Object.entries(GEAR[gearTab])) {
    const card = document.createElement('button');
    card.type = 'button'; card.className = 'ld-armor-card'; card.dataset.armor = id; card.dataset.slot = gearTab;
    card.innerHTML = '<span class="ld-armor-icon"></span><b class="ld-armor-title"></b><span class="ld-armor-tradeoffs"></span>';
    card.querySelector('.ld-armor-icon').innerHTML = gearIcon(gearTab, id);
    card.querySelector('.ld-armor-title').textContent = piece.name;
    card.querySelector('.ld-armor-tradeoffs').innerHTML = armorStatMarkup(piece);
    card.title = piece.description;
    card.setAttribute('aria-label', `${piece.name}. ${piece.description} ${armorStats(piece)}.`);
    card.addEventListener('click', () => chooseSetup({ [gearTab]: id }));
    list.append(card);
  }
}
// ---------- inventory (I): drag and drop to reorder the four slots ----------
let inventoryOpen = false, dragFrom = null;
function toggleInventory(force) {
  inventoryOpen = typeof force === 'boolean' ? force : !inventoryOpen;
  $('ld-inventory').hidden = !inventoryOpen; dragFrom = null;
  if (inventoryOpen) { held.delete('attack'); held.delete('ability'); renderInventory(); } else canvas.focus();
}
function reorder(from, to) {
  if (from === to) return;
  const order = [...Array(SLOT_COUNT).keys()]; order[from] = to; order[to] = from; // swap the two slots
  if (solo) { const result = Engine.reorderInventory(state, localId ?? 0, order); if (!result.ok) setStatus(result.error); }
  else send({ type: 'lockdown-inventory', order });
}
function renderInventory() {
  if (!inventoryOpen) return;
  const me = viewState()?.players[localId ?? -1], grid = $('ld-inventory-slots');
  if (!me) return;
  const key = Array.from({ length: SLOT_COUNT }, (_, slot) => `${me.weapons[slot]}:${me.hearts?.[slot] || 0}`).join(',') + `|${me.slot}`;
  if (grid.dataset.key === key) return;
  grid.dataset.key = key; grid.textContent = '';
  for (let slot = 0; slot < SLOT_COUNT; slot++) {
    const item = slotItem(me, slot), cell = document.createElement('div');
    cell.className = 'ld-inv-slot'; cell.dataset.slot = slot; cell.dataset.kind = item.kind; cell.dataset.active = String(slot === me.slot);
    cell.draggable = item.kind !== 'empty';
    cell.innerHTML = `<kbd>${slot + 1}</kbd>${item.icon}<b></b><small></small>`;
    cell.querySelector('b').textContent = item.name; cell.querySelector('small').textContent = item.type;
    if (item.kind === 'hearts') cell.querySelector('b').insertAdjacentHTML('beforeend', ` <span class="ld-heart-pips">${'♥'.repeat(item.hearts)}${'♡'.repeat(RULES.heart.stack - item.hearts)}</span>`);
    // Mouse drag and drop (HTML5), plus pointer fallback for touch screens.
    cell.addEventListener('dragstart', event => { dragFrom = slot; cell.classList.add('dragging'); event.dataTransfer?.setData('text/plain', String(slot)); });
    cell.addEventListener('dragend', () => { cell.classList.remove('dragging'); dragFrom = null; });
    cell.addEventListener('dragover', event => { event.preventDefault(); cell.classList.add('over'); });
    cell.addEventListener('dragleave', () => cell.classList.remove('over'));
    cell.addEventListener('drop', event => { event.preventDefault(); cell.classList.remove('over'); const from = dragFrom ?? Number(event.dataTransfer?.getData('text/plain')); if (Number.isInteger(from)) reorder(from, slot); dragFrom = null; });
    cell.addEventListener('pointerdown', event => { if (event.pointerType !== 'mouse') dragFrom = slot; });
    cell.addEventListener('pointerup', event => { if (event.pointerType !== 'mouse' && dragFrom !== null) { reorder(dragFrom, slot); dragFrom = null; } });
    grid.append(cell);
  }
}
function showWeaponNote(id) { const weapon = WEAPONS[id]; if (weapon) $('ld-weapon-note').textContent = `${weapon.name}: ${weapon.description}`; }
function chooseSetup(change) {
  if (inMatch() && !canChangeLoadout()) { flashBaseHint(); setStatus('Return to your base to change class or equipment.'); return; }
  const changedWeapon = change.weapons?.find((id, slot) => id !== setup.weapons[slot]);
  const nextSetup = { ...setup, ...change };
  if (inMatch()) {
    // Mid-match changes apply straight away, but only in base (the engine checks too).
    const { team, ...loadout } = change;
    if (solo) { const result = Engine.setPlayerSetup(state, 0, loadout); if (!result.ok) { setStatus(result.error); renderMenu(); return; } }
    else send({ type: 'lockdown-setup', ...loadout });
    nextSetup.team = setup.team;
  } else if (solo) {
    const result = Engine.setPlayerSetup(state, 0, { ...nextSetup, name: getName() });
    if (!result.ok) { setStatus(result.error); renderMenu(); return; }
  }
  else send({ type: 'lockdown-setup', ...change });
  Object.assign(setup, nextSetup); storeSetup();
  if (solo) rememberAuthoritativeSetup(state.players[0]);
  if (changedWeapon) showWeaponNote(changedWeapon);
  if (change.cls) $('ld-class-note').textContent = `${CLASSES[setup.cls].perks}. ${CLASSES[setup.cls].description}`;
  renderMenu();
}
function refreshIcons() {
  for (const card of document.querySelectorAll('.ld-class-card')) card.querySelector('.ld-class-icon').innerHTML = iconMarkup(`icon_class_${card.dataset.cls}`, CLASS_GLYPH[card.dataset.cls]);
  for (const card of document.querySelectorAll('.ld-armor-card')) card.querySelector('.ld-armor-icon').innerHTML = gearIcon(card.dataset.slot, card.dataset.armor);
  $('ld-weapons').dataset.key = '';
}
const inMatch = () => state?.phase === 'countdown' || state?.phase === 'fight';
function canChangeLoadout() {
  const me = state?.players[localId ?? -1];
  return !inMatch() || !!me && (!me.alive || Engine.inBase(state, me));
}
let baseHintFlash = 0;
function flashBaseHint() { baseHintFlash = performance.now() + 1800; }
function renderMenu() {
  const me = state?.players[localId ?? -1];
  const phase = state?.phase ?? 'lobby';
  app.dataset.phase = phase;
  const team = me?.team ?? setup.team, cls = me?.cls ?? setup.cls, gear = gearOf(me ?? setup), weapons = me?.weapons ?? setup.weapons;
  const lobby = phase === 'lobby' || phase === 'matchEnd', editable = canChangeLoadout();
  for (const button of document.querySelectorAll('.ld-team-button')) { button.setAttribute('aria-pressed', String(Number(button.dataset.team) === team)); button.disabled = !lobby; }
  for (const card of document.querySelectorAll('.ld-class-card')) {
    const choice = CLASSES[card.dataset.cls];
    card.setAttribute('aria-pressed', String(choice.id === cls)); card.disabled = !editable;
    card.querySelector('small').textContent = `${Engine.maxHpFor(choice.id, gear)} HP · ${choice.ability}`;
  }
  for (const card of document.querySelectorAll('.ld-armor-card')) { card.setAttribute('aria-pressed', String(card.dataset.armor === gear[card.dataset.slot])); card.disabled = !editable; }
  for (const tab of document.querySelectorAll('[data-gear-tab]')) {
    tab.setAttribute('aria-selected', String(tab.dataset.gearTab === gearTab));
    tab.querySelector('small').textContent = GEAR[tab.dataset.gearTab][gear[tab.dataset.gearTab]].name;
  }
  $('ld-gear-random').disabled = $('ld-gear-clear').disabled = !editable;
  const total = combineGear(gear), piece = GEAR[gearTab][gear[gearTab]];
  $('ld-armor-summary').textContent = `${piece.name}: ${piece.description}`;
  $('ld-armor-summary-stats').innerHTML = `<b>Whole build</b> (${total.name}): ${Engine.maxHpFor(cls, gear)} max HP (${CLASSES[cls].hp} class ${total.maxHp >= 0 ? '+' : '−'} ${Math.abs(total.maxHp)} equipment) · ${armorStatMarkup(total)}`;
  [...$('ld-loadout').querySelectorAll('select')].forEach((select, slot) => { if (document.activeElement !== select) select.value = weapons[slot] || ''; select.disabled = !editable; });
  const note = $('ld-base-note');
  note.hidden = lobby;
  if (!lobby) {
    note.classList.toggle('away', !editable);
    note.textContent = !me?.alive ? 'Waiting to respawn: class and equipment changes apply when you return.' : editable ? 'You are in your base: class and equipment changes apply right away. Teams stay fixed until the next lobby.' : 'Return to your base to change class or equipment. Your base also heals you.';
  }
  $('ld-class-note').textContent = `${CLASSES[cls].perks}. ${CLASSES[cls].description}`;
  if (!$('ld-weapon-note').textContent) showWeaponNote(weapons[0]);
  const isHost = solo || hostId === localId;
  const mapId = state?.mapId ?? soloMapId;
  $('ld-map').value = mapId; $('ld-map').disabled = !isHost || phase !== 'lobby';
  $('ld-map-note').textContent = `${MAPS[mapId].description}${isHost ? '' : ' The host picks the map.'}`;
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
/** Two team tables: score (from capturing zones), kills, deaths and damage per knight. */
const BOARD_COLUMNS = [['score', 'Score'], ['kills', 'Kills'], ['deaths', 'Deaths'], ['damage', 'Damage'], ['captures', 'Caps']];
function scoreTables(current) {
  const board = Engine.getScoreboard(current), wrap = document.createElement('div'); wrap.className = 'ld-teams-board';
  const best = Object.fromEntries(BOARD_COLUMNS.filter(([key]) => key !== 'deaths').map(([key]) => [key, Math.max(1, ...board.map(row => row[key]))]));
  for (const team of [0, 1]) {
    const rows = board.filter(row => row.team === team), section = document.createElement('section');
    section.className = `ld-team-table t${team}`;
    const title = document.createElement('h3');
    title.append(`${TEAM_COLORS[team].name} · ${current.scores[team]}`, Object.assign(document.createElement('small'), { textContent: current.winner === team ? 'WINNER' : current.phase === 'matchEnd' && current.winner === null ? 'DRAW' : '' }));
    const table = document.createElement('table');
    const head = document.createElement('tr'); head.append(Object.assign(document.createElement('th'), { textContent: 'Knight' }));
    for (const [, label] of BOARD_COLUMNS) head.append(Object.assign(document.createElement('th'), { textContent: label }));
    const thead = document.createElement('thead'); thead.append(head);
    const body = document.createElement('tbody');
    for (const row of rows) {
      const tr = document.createElement('tr'); tr.className = `${row.id === localId ? 'me' : ''}${row.human ? '' : ' bot'}`;
      tr.append(Object.assign(document.createElement('td'), { textContent: `${row.name}${row.id === localId ? ' (you)' : ''} · ${CLASSES[row.cls].name}` }));
      for (const [key] of BOARD_COLUMNS) {
        const cell = Object.assign(document.createElement('td'), { textContent: String(row[key]) });
        if (best[key] !== undefined && row[key] === best[key]) cell.className = 'best';
        tr.append(cell);
      }
      body.append(tr);
    }
    const total = document.createElement('tr'); total.append(Object.assign(document.createElement('td'), { textContent: 'Team' }));
    for (const [key] of BOARD_COLUMNS) total.append(Object.assign(document.createElement('td'), { textContent: String(rows.reduce((sum, row) => sum + row[key], 0)) }));
    const foot = document.createElement('tfoot'); foot.append(total);
    table.append(thead, body, foot); section.append(title, table); wrap.append(section);
  }
  return wrap;
}
function renderResults() {
  const box = $('ld-results');
  if (!state || state.phase !== 'matchEnd') { box.hidden = true; return; }
  if (box.dataset.tick === String(state.tick) && !box.hidden) return;
  box.dataset.tick = String(state.tick); box.hidden = false; box.textContent = '';
  const heading = document.createElement('h2');
  heading.textContent = state.winner === null ? `Draw · ${state.scores[0]} – ${state.scores[1]}` : `${TEAM_COLORS[state.winner].name} wins · ${state.scores[0]} – ${state.scores[1]}`;
  const mvp = Engine.getScoreboard(state).sort((a, b) => b.score - a.score || b.kills - a.kills || b.damage - a.damage)[0];
  const line = Object.assign(document.createElement('p'), { className: 'ld-mvp', textContent: mvp ? `Top knight: ${mvp.name} — ${mvp.score} pts from zones, ${mvp.kills} kills, ${mvp.damage} damage. Score comes from capturing (+${RULES.captureScore}) and neutralising (+${RULES.neutralizeScore}) zones.` : '' });
  box.append(heading, line, scoreTables(state));
}
let boardOpen = false, boardDrawn = 0;
function showBoard(open) { boardOpen = open; $('ld-board').hidden = !open || !state || state.phase === 'lobby'; boardDrawn = 0; }

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
    scene.render(shown, { localId, now, focus });
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
addEventListener('resize', () => scene.resize());
// Exposed for automated smoke tests.
globalThis.__lockdown = { get state() { return state; }, get scene() { return scene; }, get localId() { return localId; }, get menuOpen() { return menuOpen; }, get inventoryOpen() { return inventoryOpen; }, toggleMenu, toggleInventory, chooseSetup, showBoard };
