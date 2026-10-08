import { FIXED_STEP, DAY_SECONDS, DAYLIGHT_SECONDS, BLOCKS, ITEMS, RECIPES, createState, step, selectSlot, craft, canCraft, discardSelected, setPaused, snapshot, serialize, restore, getPlacement, getSelectedItem } from '../voxel-survival-engine.js';
import { createSurvivalRenderer } from '../voxel-survival-renderer.js';
import { createSurvivalPresentation } from '../voxel-survival-presentation.js';
import { gameKey, displayKey, getKeyboardLayout, subscribeKeyboardLayout } from '../keyboard-layout.js';
import { tickFraction } from '../display-timing.js';

const SAVE_KEY = 'semag-voxel-wilds-world:v1';
const SAVE_LIMIT = 500000;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const node = (tag, className, text) => { const element = document.createElement(tag); element.className = className; if (text !== undefined) element.textContent = text; return element; };
const setText = (element, value) => { const string = String(value); if (element.textContent !== string) element.textContent = string; };
const isUI = target => target instanceof Element && Boolean(target.closest('input,textarea,select,button,a,summary,[contenteditable]:not([contenteditable="false"])'));
const phaseOf = state => state.phase === 'dead' ? 'lost' : state.paused ? 'paused' : 'playing';
const newSeed = () => { const value = new Uint32Array(1); try { crypto.getRandomValues(value); } catch { value[0] = Date.now() >>> 0; } return value[0] || 1; };

function icon(item) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 32 32'); svg.setAttribute('aria-hidden', 'true'); svg.classList.add('wilds-item-icon');
  const path = document.createElementNS(svg.namespaceURI, 'path');
  path.setAttribute('fill', item?.color || '#b9c3af'); path.setAttribute('stroke', '#17241c'); path.setAttribute('stroke-width', '1.4'); path.setAttribute('stroke-linejoin', 'round');
  const kind = item?.kind || 'material';
  path.setAttribute('d', kind === 'block' ? 'M16 3 29 10v13l-13 7L3 23V10ZM3 10l13 7 13-7M16 17v13' : kind === 'food' ? 'M16 10c-9-8-15 1-11 12l6 7h10l6-7c4-11-2-20-11-12ZM16 10V3l6 2-6 5' : kind === 'healing' ? 'M11 3h10v7l5 6v12H6V16l5-6ZM11 6h10M11 21h10M16 16v10' : kind === 'tool' && /sword/.test(item.id) ? 'M21 3 29 3 29 11 16 23 10 17ZM8 15l11 11-3 3-11-11ZM8 22l3 3-5 5-3-3Z' : kind === 'tool' ? 'M4 9 12 4 25 5l5 8-9-5-7 2 10 17-4 3-11-18Z' : 'M16 3 28 13 23 27H9L4 13ZM4 13h24M9 27l7-24 7 24');
  svg.append(path); return svg;
}

export function mount(container, { onUpdate = () => {} } = {}) {
  let state = createState({ seed: newSeed() }), destroyed = false, raf = null, previousTime = null, accumulator = 0;
  const presentation = createSurvivalPresentation(), look = {}, renderOptions = {};
  let renderer = null, rendererError = '', inventoryOpen = false, pendingSave = null, choosingSave = false;
  let yaw = state.player.yaw, pitch = state.player.pitch, drag = null, ignoreLockLoss = false, pointerRequest = false;
  let lastPublish = -1, lastPublishedPhase = '', lastSave = -1, lastMessage = '', saveStatus = 'Not saved yet', storage = null, saveAvailable = false;
  let muted = false, audio = null, soundEvent = 0;
  const held = new Map(), pressed = new Set(), reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  try { storage = window.localStorage; const raw = storage.getItem(SAVE_KEY); if (raw && raw.length <= SAVE_LIMIT) pendingSave = restore(raw); if (pendingSave?.phase === 'dead') pendingSave = null; saveAvailable = Boolean(pendingSave); } catch { storage = null; saveStatus = 'Saving unavailable in this browser'; }

  const view = node('section', 'wilds-view'); view.setAttribute('aria-label', 'Voxel Wilds survival expedition');
  const toolbar = node('div', 'wilds-toolbar'), worldInfo = node('div', 'wilds-world-info'), seedLabel = node('span', 'wilds-seed-label'), saveLabel = node('span', 'wilds-save-status');
  const inventoryButton = node('button', 'wilds-open-inventory', 'Inventory · Tab'); inventoryButton.type = 'button'; inventoryButton.setAttribute('aria-expanded', 'false'); inventoryButton.setAttribute('aria-controls', 'wilds-inventory');
  const toolbarActions = node('div', 'wilds-toolbar-actions'), soundButton = node('button', 'wilds-sound', '♪'); soundButton.type = 'button'; soundButton.setAttribute('aria-label', 'Mute game sound'); soundButton.setAttribute('aria-pressed', 'false'); soundButton.title = 'Mute game sound'; toolbarActions.append(soundButton, inventoryButton); worldInfo.append(seedLabel, saveLabel); toolbar.append(worldInfo, toolbarActions);
  const board = node('div', 'wilds-board'), canvas = node('canvas', 'wilds-canvas'); canvas.width = 1200; canvas.height = 750; canvas.tabIndex = 0; canvas.dataset.soloFocus = ''; canvas.setAttribute('aria-label', 'First person voxel wilderness. Click to look with the mouse.');
  const hud = node('div', 'wilds-hud'), health = node('div', 'wilds-vital wilds-health'), hunger = node('div', 'wilds-vital wilds-hunger');
  function makeVital(element, label) { const text = node('span', '', label), number = node('b', ''), track = node('div', 'wilds-vital-track'), fill = node('i', ''); track.append(fill); element.append(text, number, track); return { number, fill, track }; }
  const hpUI = makeVital(health, 'HEALTH'), hungerUI = makeVital(hunger, 'FOOD'), day = node('div', 'wilds-day'), dayLabel = node('b', ''), dayTime = node('span', ''); day.append(dayLabel, dayTime); hud.append(health, hunger, day);
  const compass = node('span', 'wilds-compass'), crosshair = node('div', 'wilds-crosshair'); crosshair.setAttribute('aria-hidden', 'true');
  const aimHint = node('div', 'wilds-aim-hint', 'Click the world to look · hold C to mine');
  const target = node('div', 'wilds-target'), targetName = node('span', ''), miningTrack = node('div', 'wilds-mining-track'), miningFill = node('i', ''); miningTrack.append(miningFill); target.append(targetName, miningTrack);
  const hotbar = node('div', 'wilds-hotbar'); hotbar.setAttribute('role', 'group'); hotbar.setAttribute('aria-label', 'Eight inventory slots. Number keys or mouse wheel select.');
  const slots = Array.from({ length: 8 }, (_, index) => { const button = node('button', 'wilds-slot'); button.type = 'button'; button.dataset.slot = String(index); button.setAttribute('aria-pressed', 'false'); const key = node('span', 'wilds-slot-key', String(index + 1)), art = node('span', 'wilds-slot-art'), count = node('span', 'wilds-slot-count'), durability = node('i', 'wilds-durability'); button.append(key, art, count, durability); hotbar.append(button); return { button, art, count, durability, id: null }; });
  const selectedName = node('div', 'wilds-selected-name'), objective = node('div', 'wilds-objective'), objectiveTitle = node('b', '', 'BEFORE NIGHTFALL'), objectiveText = node('span', 'Gather wood. Make a workbench. Build shelter before dusk.'); objective.append(objectiveTitle, objectiveText);
  const status = node('p', 'wilds-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const overlay = node('div', 'wilds-overlay'), overlayCard = node('div', 'wilds-overlay-card'), overlayTag = node('span', 'wilds-overlay-tag'), overlayTitle = node('h3', ''), overlayText = node('p', ''), overlayActions = node('div', 'wilds-overlay-actions');
  const resumeButton = node('button', 'wilds-pause-resume', 'Return to the wilds'), continueButton = node('button', 'wilds-continue-save', 'Continue saved expedition'), freshButton = node('button', 'wilds-new-world', 'Start a new world'); for (const button of [resumeButton, continueButton, freshButton]) button.type = 'button';
  const seedField = node('label', 'wilds-seed-field', 'NEW WORLD SEED'), seedInput = node('input', 'wilds-seed'); seedInput.type = 'text'; seedInput.maxLength = 48; seedInput.placeholder = 'Leave blank for a new wilderness'; seedField.append(seedInput); overlayActions.append(resumeButton, continueButton, seedField, freshButton); overlayCard.append(overlayTag, overlayTitle, overlayText, overlayActions); overlay.append(overlayCard);
  const inventory = node('div', 'wilds-inventory'); inventory.id = 'wilds-inventory'; inventory.hidden = true; inventory.setAttribute('role', 'dialog'); inventory.setAttribute('aria-modal', 'true'); inventory.setAttribute('aria-labelledby', 'wilds-inventory-title');
  const inventoryCard = node('div', 'wilds-inventory-card'), inventoryHeader = node('div', 'wilds-inventory-header'), inventoryTitle = node('h3', '', 'Pack & craft'); inventoryTitle.id = 'wilds-inventory-title';
  const closeInventory = node('button', 'wilds-close-inventory', 'Back to world · Tab'); closeInventory.type = 'button'; inventoryHeader.append(inventoryTitle, closeInventory);
  const inventoryNote = node('p', 'wilds-inventory-note', 'The world is paused while you craft. Eight slots: combine materials, carry food, and leave space for discoveries. Arrow keys choose a recipe; Enter crafts.');
  const inventorySummary = node('div', 'wilds-inventory-summary'), recipeList = node('div', 'wilds-recipes'), recipeRows = [];
  const packActions = node('div', 'wilds-pack-actions'), packSelected = node('span', 'wilds-pack-selected'), discardButton = node('button', 'wilds-discard', 'Discard one selected item'); discardButton.type = 'button'; packActions.append(packSelected, discardButton);
  for (const recipe of Object.values(RECIPES)) { const row = node('button', 'wilds-recipe'); row.type = 'button'; row.dataset.recipe = recipe.id; const item = ITEMS[recipe.output.id], art = icon(item), detail = node('span', 'wilds-recipe-detail'), name = node('b', '', `${recipe.name}${recipe.output.count > 1 ? ` ×${recipe.output.count}` : ''}`), cost = node('span', 'wilds-recipe-cost', Object.entries(recipe.ingredients).map(([id, count]) => `${count} ${ITEMS[id]?.name || id}`).join(' · ')), availability = node('span', 'wilds-recipe-availability'); detail.append(name, cost); row.append(art, detail, availability); recipeList.append(row); recipeRows.push({ row, availability, id: recipe.id }); }
  const craftStatus = node('p', 'wilds-craft-status'); craftStatus.setAttribute('role', 'status'); craftStatus.setAttribute('aria-live', 'polite');
  inventoryCard.append(inventoryHeader, inventoryNote, inventorySummary, packActions, recipeList, craftStatus); inventory.append(inventoryCard);
  board.append(canvas, hud, compass, crosshair, aimHint, target, selectedName, hotbar, overlay, inventory);
  const hint = node('p', 'wilds-controls-hint'), help = node('details', 'wilds-field-guide'), helpTitle = node('summary', '', 'Field guide & survival tips'), helpText = node('p', '', 'Wood becomes planks. Craft a workbench, then a stone pick. Put a campfire inside your shelter and keep food in your pack. Mine deeper for iron to make a stronger pick and sword; stronger enemies arrive each night. Hold your aim on a block to finish mining. Place blocks on the face you are looking at: you cannot build inside yourself or enemies. Falling hurts. Sprinting spends food. Your world saves in this browser on this host.'); help.append(helpTitle, helpText);
  view.append(toolbar, board, objective, status, hint, help); container.append(view);

  try { renderer = createSurvivalRenderer(canvas); } catch (error) { rendererError = error?.message || 'A WebGL capable browser is required.'; setPaused(state, true); }
  if (pendingSave) { choosingSave = true; setPaused(state, true); saveStatus = 'Saved expedition available'; }

  function release() { held.clear(); pressed.clear(); drag = null; pointerRequest = false; }
  function unlockSound(event) { if (muted || audio || !event?.isTrusted) return; try { const Audio = window.AudioContext || window.webkitAudioContext; if (Audio) { audio = new Audio(); audio.resume().catch(() => {}); } } catch { audio = null; } }
  function soundFeedback() {
    for (const event of state.events) { if (event.id <= soundEvent) continue; soundEvent = event.id; if (muted || !audio || audio.state !== 'running') continue; const frequency = { mined: 240, placed: 145, hit: 110, hurt: 65, crafted: 440, used: 320, kill: 175 }[event.type]; if (!frequency) continue;
      try { const oscillator = audio.createOscillator(), gain = audio.createGain(), now = audio.currentTime; oscillator.type = event.type === 'hurt' ? 'sawtooth' : 'triangle'; oscillator.frequency.setValueAtTime(frequency, now); oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, frequency * .45), now + .09); gain.gain.setValueAtTime(.035, now); gain.gain.exponentialRampToValueAtTime(.001, now + .09); oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(now); oscillator.stop(now + .1); } catch { /* Audio is optional, including after device changes. */ }
    }
  }
  function toggleSound(event) { muted = !muted; unlockSound(event); soundButton.setAttribute('aria-pressed', String(muted)); soundButton.setAttribute('aria-label', muted ? 'Enable game sound' : 'Mute game sound'); soundButton.title = muted ? 'Enable game sound' : 'Mute game sound'; soundButton.dataset.muted = String(muted); }
  function exitLook() { drag = null; pointerRequest = false; if (document.pointerLockElement === canvas) { ignoreLockLoss = true; try { document.exitPointerLock(); } catch { ignoreLockLoss = false; } } }
  function resetPresentation() { previousTime = null; accumulator = 0; presentation.reset(); }
  function save(force = false) {
    if (!storage || choosingSave || destroyed && !force) return;
    if (!force && state.elapsed - lastSave < 15) return;
    try { const raw = serialize(state); if (raw.length > SAVE_LIMIT) throw new Error('World save is too large'); storage.setItem(SAVE_KEY, raw); lastSave = state.elapsed; saveAvailable = true; saveStatus = state.phase === 'dead' ? 'Final expedition saved' : 'World saved'; } catch { storage = null; saveStatus = 'Saving unavailable; keep this tab open'; }
    setText(saveLabel, saveStatus);
  }
  function pause() { if (destroyed || state.phase === 'dead' || state.paused) return; release(); setPaused(state, true); resetPresentation(); exitLook(); save(true); refresh(); }
  function resume() { if (destroyed || choosingSave || rendererError || state.phase === 'dead') return; inventoryOpen = false; inventory.hidden = true; release(); setPaused(state, false); resetPresentation(); refresh(); canvas.focus({ preventScroll: true }); }
  function togglePause() { if (inventoryOpen) { leaveInventory(); return; } if (state.paused) resume(); else pause(); }
  function replaceWorld(next) { release(); exitLook(); state = next; soundEvent = state.eventId; choosingSave = false; pendingSave = null; inventoryOpen = false; inventory.hidden = true; yaw = state.player.yaw; pitch = state.player.pitch; setPaused(state, Boolean(rendererError)); lastMessage = ''; lastSave = -1; resetPresentation(); save(true); refresh(); canvas.focus({ preventScroll: true }); }
  function restart() { if (destroyed) return; replaceWorld(createState({ seed: seedInput.value.trim() || newSeed() })); }
  function continueSaved() { if (!pendingSave || rendererError) return; replaceWorld(pendingSave); }
  function openInventory() { if (destroyed || choosingSave || rendererError || state.phase === 'dead' || inventoryOpen) return; release(); setPaused(state, true); resetPresentation(); inventoryOpen = true; exitLook(); save(true); refresh(); closeInventory.focus({ preventScroll: true }); }
  function leaveInventory() { if (!inventoryOpen) return; inventoryOpen = false; inventory.hidden = true; setText(craftStatus, ''); resume(); }
  function select(index) { if (choosingSave || state.phase === 'dead') return; selectSlot(state, index); refresh(false); }

  function updateSlots() {
    for (let index = 0; index < slots.length; index++) { const ui = slots[index], slot = state.inventory[index], item = slot && ITEMS[slot.id];
      if (ui.id !== (slot?.id || '')) { ui.art.replaceChildren(...(item ? [icon(item)] : [])); ui.id = slot?.id || ''; }
      const label = slot ? `${index + 1}: ${item?.name || slot.id}, ${slot.count}${Number.isFinite(slot.durability) ? `, ${Math.round(slot.durability)} durability` : ''}` : `${index + 1}: empty slot`;
      ui.button.setAttribute('aria-label', label); ui.button.title = label; ui.button.setAttribute('aria-pressed', String(index === state.selectedSlot)); setText(ui.count, slot && slot.count > 1 ? slot.count : '');
      ui.durability.hidden = !slot || !Number.isFinite(slot.durability); ui.durability.style.width = `${slot && item?.durability ? clamp(slot.durability / item.durability, 0, 1) * 100 : 100}%`;
    }
    const selected = state.inventory[state.selectedSlot]; setText(selectedName, selected ? ITEMS[selected.id]?.name || selected.id : 'Empty hand');
  }
  function updateCrafting() {
    inventorySummary.replaceChildren();
    for (let index = 0; index < state.inventory.length; index++) { const slot = state.inventory[index], item = slot && ITEMS[slot.id], line = node('button', 'wilds-pack-item'); line.type = 'button'; line.dataset.packSlot = String(index); line.setAttribute('aria-pressed', String(index === state.selectedSlot)); line.append(...(slot ? [icon(item)] : []), node('span', '', slot ? `${index + 1} · ${item?.name || slot.id} ×${slot.count}` : `${index + 1} · Empty`)); inventorySummary.append(line); }
    const selected = state.inventory[state.selectedSlot]; setText(packSelected, selected ? `SELECTED · ${ITEMS[selected.id]?.name || selected.id}` : 'SELECTED · Empty slot'); discardButton.disabled = !selected;
    for (const recipe of recipeRows) { const result = canCraft(state, recipe.id); recipe.row.disabled = !result.ok; recipe.row.dataset.available = String(result.ok); setText(recipe.availability, result.ok ? 'CRAFT' : result.error || 'Needs materials'); recipe.row.title = result.ok ? `Craft ${RECIPES[recipe.id]?.name || recipe.id}` : result.error || 'Collect more materials'; }
  }
  function updateOverlay() {
    const phase = phaseOf(state), visible = Boolean(rendererError || choosingSave || phase === 'lost' || phase === 'paused' && !inventoryOpen); overlay.hidden = !visible;
    resumeButton.hidden = Boolean(rendererError || choosingSave || phase === 'lost'); continueButton.hidden = !choosingSave || Boolean(rendererError); freshButton.hidden = Boolean(rendererError) || !choosingSave && phase !== 'lost'; seedField.hidden = freshButton.hidden;
    if (rendererError) { setText(overlayTag, 'GRAPHICS UNAVAILABLE'); setText(overlayTitle, renderer?.contextLost ? 'Your expedition is safe' : 'The wilderness needs WebGL'); setText(overlayText, renderer?.contextLost ? rendererError : `${rendererError} Try a browser with hardware acceleration enabled.`); }
    else if (choosingSave) { setText(overlayTag, 'YOUR WORLD IS WAITING'); setText(overlayTitle, 'Continue your expedition?'); setText(overlayText, `Return to day ${pendingSave.day || 1} with your shelter and pack intact, or choose a seed for a new wilderness. A new world replaces the saved expedition.`); }
    else if (phase === 'lost') { setText(overlayTag, 'EXPEDITION ENDED'); setText(overlayTitle, `You survived ${Math.floor(state.elapsed)} seconds`); setText(overlayText, `${state.stats.nights} nights weathered · ${state.stats.mined} blocks mined · ${state.stats.built} blocks placed. Build cover and prepare food before the next night.`); }
    else { setText(overlayTag, 'WORLD PAUSED'); setText(overlayTitle, 'A quiet moment'); setText(overlayText, 'Your expedition is saved. Return when you are ready, then click the world to look around.'); }
    inventory.hidden = !inventoryOpen; inventoryButton.setAttribute('aria-expanded', String(inventoryOpen));
  }
  function publish(force = false) {
    const now = performance.now(), phase = phaseOf(state); if (!force && now - lastPublish < 100 && phase === lastPublishedPhase) return; lastPublish = now; lastPublishedPhase = phase;
    view.dataset.phase = phase; view.dataset.night = String(state.night); view.dataset.keyboardLayout = getKeyboardLayout();
    const hp = Math.max(0, Math.ceil(state.player.hp)), food = Math.max(0, Math.ceil(state.player.hunger)); setText(hpUI.number, hp); setText(hungerUI.number, food); hpUI.fill.style.width = `${clamp(hp / (state.player.maxHp || 100), 0, 1) * 100}%`; hungerUI.fill.style.width = `${clamp(food / 100, 0, 1) * 100}%`;
    health.dataset.urgent = String(hp < 30); hunger.dataset.urgent = String(food < 25); setText(dayLabel, `DAY ${state.day}`); const cycle = (state.time % DAY_SECONDS + DAY_SECONDS) % DAY_SECONDS; setText(dayTime, state.night ? `Night · dawn in ${Math.ceil(DAY_SECONDS - cycle)}s` : `Daylight · night in ${Math.ceil(DAYLIGHT_SECONDS - cycle)}s`);
    const facing = ((yaw / (Math.PI * 2) * 360) % 360 + 360) % 360; setText(compass, `${['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(facing / 45) % 8]} · ${Math.round(state.player.x)}, ${Math.round(state.player.z)}`);
    setText(seedLabel, `SEED ${state.seed}`); setText(saveLabel, saveStatus); setText(objectiveTitle, state.night ? 'SURVIVE THE NIGHT' : 'BEFORE NIGHTFALL'); setText(objectiveText, state.objective || (state.night ? 'Keep cover between you and the creatures. Defend your shelter.' : 'Gather wood. Make a workbench. Build shelter before dusk.'));
    const aimed = state.target, block = aimed && BLOCKS[aimed.id]; target.hidden = !aimed; setText(targetName, block?.name || ''); miningTrack.hidden = !state.mining || state.mining.progress <= 0; miningFill.style.width = `${state.mining ? clamp(state.mining.progress / Math.max(.001, state.mining.total), 0, 1) * 100 : 0}%`;
    const message = state.message || 'Gather wood and berries. Make a workbench, then prepare a shelter before nightfall.'; if (message !== lastMessage) { lastMessage = message; setText(status, message); }
    aimHint.hidden = Boolean(document.pointerLockElement === canvas || drag || phase !== 'playing' || inventoryOpen); crosshair.hidden = phase !== 'playing' || inventoryOpen;
    updateSlots(); updateOverlay(); if (inventoryOpen) updateCrafting();
    onUpdate({ phase, score: Math.floor(state.elapsed), scoreLabel: 'TIME ALIVE', scoreUnit: 's', scoreDigits: 0, recordKey: 'wilds-survival-v1', record: phase === 'lost' ? Math.floor(state.elapsed) : null, recordLabel: 'LONGEST RUN', detail: state.night ? `Night ${state.day}: find cover, keep food, and defend your shelter.` : `Day ${state.day}: ${state.objective || 'build shelter before dusk.'}` });
  }
  function render(fraction = 1, deltaMs = 0) {
    look.yaw = yaw; look.pitch = pitch;
    const sample = presentation.sample(state, fraction, look);
    Object.assign(renderOptions, sample.options, { fraction, deltaMs, reducedMotion: reduced.matches, hideHands: inventoryOpen, placement: getPlacement(state), selectedItem: getSelectedItem(state) });
    renderer?.render(state, sample.camera, renderOptions);
  }
  function schedule() { if (!destroyed && !state.paused && state.phase === 'playing' && raf === null && !rendererError) raf = requestAnimationFrame(frame); }
  function input() { const values = new Set(held.values()); const primary = values.has('primary'); const next = { forward: Number(values.has('forward')) - Number(values.has('back')), strafe: Number(values.has('right')) - Number(values.has('left')), yaw, pitch, jump: pressed.has('jump'), sprint: values.has('sprint'), mine: primary, attack: primary, place: pressed.has('place'), use: pressed.has('use') }; pressed.clear(); return next; }
  function frame(now) { raf = null; if (destroyed) return; const dt = previousTime === null ? 0 : clamp((now - previousTime) / 1000, 0, .1); previousTime = now;
    if (!state.paused && state.phase === 'playing') { accumulator = Math.min(accumulator + dt, FIXED_STEP * 12); let ticks = 0; while (accumulator + 1e-10 >= FIXED_STEP && ticks++ < 12 && !state.paused && state.phase === 'playing') { presentation.capture(state); step(state, input(), FIXED_STEP); accumulator = Math.max(0, accumulator - FIXED_STEP); }
      save(); if (state.phase === 'dead') { release(); exitLook(); resetPresentation(); save(true); }
    } else resetPresentation(); soundFeedback(); publish(); render(state.paused || state.phase !== 'playing' ? 1 : tickFraction(accumulator, FIXED_STEP), dt * 1000); schedule(); }
  function refresh(force = true) { if (state.paused || state.phase !== 'playing') { if (raf !== null) cancelAnimationFrame(raf); raf = null; } soundFeedback(); publish(force); render(); schedule(); }

  function keydown(event) {
    if (destroyed || event.defaultPrevented || event.repeat && !held.has(event.code || event.key) || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
    const key = gameKey(event), canonical = key.length === 1 ? key.toLowerCase() : key;
    if (canonical === 'Tab' && !isUI(event.target) || canonical === 'Tab' && inventory.contains(event.target) && !event.shiftKey) { event.preventDefault(); if (!event.repeat) inventoryOpen ? leaveInventory() : openInventory(); return; }
    if (inventoryOpen) {
      if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(canonical)) { event.preventDefault(); const available = recipeRows.map(recipe => recipe.row).filter(row => !row.disabled); if (available.length) { const current = available.indexOf(document.activeElement), direction = canonical === 'ArrowUp' || canonical === 'ArrowLeft' ? -1 : 1; available[(current + direction + available.length) % available.length].focus({ preventScroll: true }); } }
      return;
    }
    if (choosingSave || state.paused || state.phase !== 'playing' || isUI(event.target)) return;
    const digit = /^Digit([1-8])$/.exec(event.code || '') || /^([1-8])$/.exec(key); if (digit) { event.preventDefault(); if (!event.repeat) select(Number(digit[1]) - 1); return; }
    const control = { w: 'forward', ArrowUp: 'forward', s: 'back', ArrowDown: 'back', a: 'left', ArrowLeft: 'left', d: 'right', ArrowRight: 'right', Shift: 'sprint', ' ': 'jump', c: 'primary', e: 'place', f: 'use' }[canonical];
    if (!control) return; event.preventDefault(); unlockSound(event); held.set(event.code || event.key, control); if (!event.repeat && ['jump', 'place', 'use'].includes(control)) pressed.add(control);
  }
  function keyup(event) { held.delete(event.code || event.key); }
  function pointerdown(event) {
    if (destroyed || state.paused || state.phase !== 'playing' || choosingSave || inventoryOpen || rendererError || ![0, 2].includes(event.button)) return; event.preventDefault(); unlockSound(event); canvas.focus({ preventScroll: true });
    if (document.pointerLockElement !== canvas) {
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
      try { canvas.setPointerCapture(event.pointerId); } catch { /* Drag look still works over the canvas. */ }
      if (event.pointerType !== 'touch' && canvas.requestPointerLock && !pointerRequest) { pointerRequest = true; try { const pending = canvas.requestPointerLock(); pending?.catch?.(() => { pointerRequest = false; }); } catch { pointerRequest = false; } }
      publish(true); return; // The click which captures the mouse never mines or places.
    }
    if (event.button === 0) held.set(`pointer:${event.pointerId}`, 'primary'); else pressed.add('place');
  }
  function pointermove(event) {
    if (destroyed || state.paused || state.phase !== 'playing' || inventoryOpen) return;
    let dx = 0, dy = 0;
    if (document.pointerLockElement === canvas) { dx = event.movementX; dy = event.movementY; }
    else if (drag && event.pointerId === drag.id) { dx = event.clientX - drag.x; dy = event.clientY - drag.y; drag.x = event.clientX; drag.y = event.clientY; }
    else return;
    yaw += clamp(dx, -600, 600) * .0023; yaw = ((yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; pitch = clamp(pitch - clamp(dy, -600, 600) * .0023, -1.46, 1.46);
  }
  function pointerup(event) { held.delete(`pointer:${event.pointerId}`); if (drag?.id === event.pointerId) { drag = null; try { if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); } catch {} } }
  function pointercancel(event) { pointerup(event); pressed.clear(); }
  function lockchange() { pointerRequest = false; if (document.pointerLockElement === canvas) { drag = null; ignoreLockLoss = false; if (destroyed || state.paused || state.phase !== 'playing' || inventoryOpen || choosingSave || rendererError) exitLook(); publish(true); return; } release(); if (ignoreLockLoss) { ignoreLockLoss = false; publish(true); return; } if (!state.paused && state.phase === 'playing') pause(); }
  function lockerror() { pointerRequest = false; setText(status, 'Mouse capture is unavailable. Hold and drag the world to look; C mines, E places, F uses.'); }
  function wheel(event) { if (destroyed || state.paused || inventoryOpen || state.phase !== 'playing' || !event.deltaY) return; event.preventDefault(); select((state.selectedSlot + (event.deltaY > 0 ? 1 : 7)) % 8); }
  function contextmenu(event) { event.preventDefault(); }
  function graphicsError(event) { rendererError = event.detail?.message || 'Graphics interrupted. Waiting for the browser to restore WebGL.'; release(); inventoryOpen = false; inventory.hidden = true; setPaused(state, true); resetPresentation(); exitLook(); save(true); refresh(); }
  function graphicsRestored() { rendererError = ''; setPaused(state, true); resetPresentation(); refresh(); }
  function blur() { release(); pause(); }
  function visibility() { if (document.hidden) blur(); }
  function pagehide() { release(); save(true); }
  function keyboardHints() { setText(hint, `${displayKey('W A S D')} / arrows move · Mouse look (click to capture, drag fallback) · C / left click mine & attack · E / right click place · F eat / use · Space jump · Shift sprint · 1–8 / wheel select · Tab pack & craft · Esc pause`); }
  function recipeClick(event) { const button = event.target instanceof Element && event.target.closest('[data-recipe]'); if (!button || !inventoryOpen) return; unlockSound(event); const result = craft(state, button.dataset.recipe); setText(craftStatus, result.ok ? `Crafted ${RECIPES[button.dataset.recipe]?.name || button.dataset.recipe}.` : result.error || 'Cannot craft this yet.'); save(true); refresh(); }
  function discardClick() { if (!inventoryOpen) return; const selected = state.inventory[state.selectedSlot], name = selected && ITEMS[selected.id]?.name; const result = discardSelected(state, 1); setText(craftStatus, result.ok ? `Discarded one ${name || 'item'}.` : result.error || 'Choose an item to discard.'); save(true); refresh(); }
  function slotClick(event) { const button = event.target instanceof Element && event.target.closest('[data-slot],[data-pack-slot]'); if (button) { select(Number(button.dataset.slot ?? button.dataset.packSlot)); if (!inventoryOpen && !state.paused) canvas.focus({ preventScroll: true }); } }
  const unsubscribe = subscribeKeyboardLayout(() => { release(); keyboardHints(); });
  const fitViewport = () => { renderer?.resize(); if (state.paused || state.phase !== 'playing') render(); };
  const resize = new ResizeObserver(fitViewport); resize.observe(board);
  window.addEventListener('resize', fitViewport); document.addEventListener('fullscreenchange', fitViewport);
  const motion = () => { if (state.paused) render(); };
  window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', blur); window.addEventListener('pagehide', pagehide); document.addEventListener('visibilitychange', visibility); document.addEventListener('pointerlockchange', lockchange); document.addEventListener('pointerlockerror', lockerror);
  canvas.addEventListener('pointerdown', pointerdown); document.addEventListener('pointermove', pointermove); window.addEventListener('pointerup', pointerup); window.addEventListener('pointercancel', pointercancel); canvas.addEventListener('lostpointercapture', pointerup); canvas.addEventListener('wheel', wheel, { passive: false }); canvas.addEventListener('contextmenu', contextmenu); canvas.addEventListener('voxel-survival-renderer-error', graphicsError); canvas.addEventListener('voxel-survival-renderer-restored', graphicsRestored);
  hotbar.addEventListener('click', slotClick); inventorySummary.addEventListener('click', slotClick); discardButton.addEventListener('click', discardClick); recipeList.addEventListener('click', recipeClick); inventoryButton.addEventListener('click', openInventory); closeInventory.addEventListener('click', leaveInventory); resumeButton.addEventListener('click', resume); continueButton.addEventListener('click', continueSaved); freshButton.addEventListener('click', restart); soundButton.addEventListener('click', toggleSound); reduced.addEventListener('change', motion);
  keyboardHints(); refresh();

  return {
    getState() { return { ...snapshot(state), phase: phaseOf(state), enginePhase: state.phase, paused: state.paused, day: state.day, night: state.night, world: { width: state.world.width, height: state.world.height, depth: state.world.depth, revision: state.world.revision }, target: state.target ? JSON.parse(JSON.stringify(state.target)) : null, mining: state.mining ? { ...state.mining } : null, placement: getPlacement(state), menuOpen: inventoryOpen, choosingSave, saveAvailable, saveStatus, controls: { pointerLocked: document.pointerLockElement === canvas, lookYaw: yaw, lookPitch: pitch, held: [...held.values()] }, graphicsAvailable: Boolean(renderer?.available), displayTiming: presentation.getStats(), presentation: presentation.getPresentation(), renderer: renderer?.getStats?.() || null }; },
    getDisplayTiming: () => presentation.getStats(), restart, togglePause, pause, resume,
    destroy() { if (destroyed) return; save(true); destroyed = true; release(); exitLook(); if (raf !== null) cancelAnimationFrame(raf); unsubscribe(); resize.disconnect(); window.removeEventListener('resize', fitViewport); document.removeEventListener('fullscreenchange', fitViewport); reduced.removeEventListener('change', motion); window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', blur); window.removeEventListener('pagehide', pagehide); document.removeEventListener('visibilitychange', visibility); document.removeEventListener('pointerlockchange', lockchange); document.removeEventListener('pointerlockerror', lockerror); canvas.removeEventListener('pointerdown', pointerdown); document.removeEventListener('pointermove', pointermove); window.removeEventListener('pointerup', pointerup); window.removeEventListener('pointercancel', pointercancel); canvas.removeEventListener('lostpointercapture', pointerup); canvas.removeEventListener('wheel', wheel); canvas.removeEventListener('contextmenu', contextmenu); canvas.removeEventListener('voxel-survival-renderer-error', graphicsError); canvas.removeEventListener('voxel-survival-renderer-restored', graphicsRestored); audio?.close().catch(() => {}); renderer?.destroy(); view.remove(); },
  };
}
