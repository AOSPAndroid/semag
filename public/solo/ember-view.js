import { createRenderSampling } from './render-sampling.js';
import { tickFraction } from '../display-timing.js';
import { ACT_NAMES, BOSSES, RELICS, DIFFICULTIES, getRelicInfo, createState, step, chooseRoute, chooseReward, chooseCamp, togglePause as pauseState } from './ember-engine.js';
import { EmberVoxelRenderer } from './ember-voxel-renderer.js';
import { gameKey, getKeyboardLayout, displayKey, subscribeKeyboardLayout } from '../keyboard-layout.js';
import { blocksSoloShortcut } from './input-shortcuts.js';

const copy = state => JSON.parse(JSON.stringify(state));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const node = (tag, className, value) => {
  const element = document.createElement(tag);
  element.className = className;
  if (value !== undefined) element.textContent = value;
  return element;
};
const controls = {
  ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down',
  ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right',
  j: 'melee', e: 'spell', k: 'spell', ' ': 'dash', Shift: 'sprint', Control: 'crouch', c: 'walk', f: 'interact',
  ',': 'turnLeft', '<': 'turnLeft', '.': 'turnRight', '>': 'turnRight',
};

export function emberControl(event, layout = getKeyboardLayout(), { captured = false, crouchHeld = false } = {}) {
  const key = gameKey(event, layout);
  // Ctrl is a held stance. Its gameplay chords only override browser shortcuts
  // while this dungeon owns mouse capture and the physical crouch is held.
  const crouchChord = captured && crouchHeld;
  const shortcut = {
    defaultPrevented: event.defaultPrevented, isComposing: event.isComposing,
    repeat: event.repeat, metaKey: event.metaKey, altKey: event.altKey, target: event.target,
    ctrlKey: event.ctrlKey && key !== 'Control' && !crouchChord,
  };
  if (blocksSoloShortcut(shortcut, { allowRepeat: true })) return null;
  return controls[key.length === 1 ? key.toLowerCase() : key] || null;
}

/** Camera transforms only the intent: collision and combat stay in the engine. */
export function emberCameraInput(actions, move, yaw) {
  const right = (actions.right ? 1 : 0) - (actions.left ? 1 : 0);
  const forward = (actions.up ? 1 : 0) - (actions.down ? 1 : 0);
  const stick = Math.hypot(move?.x || 0, move?.y || 0) > .16;
  const horizontal = stick ? move.x : right;
  const vertical = stick ? -move.y : forward;
  const x = horizontal * Math.cos(yaw) + vertical * Math.sin(yaw);
  const y = horizontal * Math.sin(yaw) - vertical * Math.cos(yaw);
  const length = Math.hypot(x, y);
  return {
    moveX: length > 1 ? x / length : x,
    moveY: length > 1 ? y / length : y,
    aimX: Math.sin(yaw), aimY: -Math.cos(yaw),
    melee: Boolean(actions.melee), spell: Boolean(actions.spell),
    dash: Boolean(actions.dash), interact: Boolean(actions.interact),
    sprint: Boolean(actions.sprint), crouch: Boolean(actions.crouch), walk: Boolean(actions.walk),
  };
}

/** No simulation tick, score or RNG is changed by mouse look. */
export function emberLook(camera, dx, dy, sensitivity = .0025) {
  const safeX = Number.isFinite(dx) ? clamp(dx, -1200, 1200) : 0;
  const safeY = Number.isFinite(dy) ? clamp(dy, -1200, 1200) : 0;
  return {
    yaw: (camera.yaw + safeX * sensitivity) % (Math.PI * 2),
    pitch: clamp(camera.pitch + safeY * sensitivity, .12, 1.05),
  };
}

export function mount(container, { onUpdate = () => {} } = {}) {
  const presentation = createRenderSampling({
    fields: ['elapsed'],
    objects: { player: { fields: ['x', 'y', 'velocityX', 'velocityY'], decays: ['attackTime', 'castTime', 'dashTime', 'damageCooldown'], maxDistance: 32 } },
    collections: {
      enemies: { fields: ['x', 'y'], maxDistance: 32 },
      projectiles: { fields: ['x', 'y'], maxDistance: 32, velocityGuard: true },
    },
    continuity: state => state.room.id,
  });
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let difficulty = 'veteran', state = createState({ difficulty });
  let camera = { yaw: Math.PI / 2, pitch: .32 };
  let raf = 0, dead = false, previous = null, accumulator = 0, lastUpdate = 0;
  let lastPhase = '', mapKey = '', buildKey = '', choiceKey = '', expectedUnlock = false, mouseLocked = false;
  let lookFallback = false, dragPoint = null, graphicsFailed = false, graphicsError = '';
  let capturedPauseKey = null;
  const held = new Map(), pointers = new Map(), queue = new Set();
  const sticks = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 } };
  const textCache = new WeakMap();
  const text = (element, value) => {
    if (textCache.get(element) !== value) { textCache.set(element, value); element.textContent = value; }
  };
  const hidden = (element, value) => { if (element.hidden !== value) element.hidden = value; };
  const view = node('section', 'ember-view');
  view.setAttribute('aria-label', 'Ember Delve third-person voxel dungeon');

  const board = node('div', 'ember-board');
  const canvas = node('canvas', 'ember-canvas');
  canvas.width = 1280; canvas.height = 720; canvas.tabIndex = 0; canvas.dataset.soloFocus = '';
  canvas.setAttribute('role', 'img');
  const hud = node('div', 'ember-hud');
  const heading = node('div', 'ember-topline');
  const actLabel = node('strong', '', ACT_NAMES[0]), roomLabel = node('span', '', '');
  heading.append(node('span', 'ember-eyebrow', 'EMBER DELVE / 3D'), actLabel, roomLabel);
  const map = node('ol', 'ember-route-map'), mapMarks = [];
  map.setAttribute('aria-label', 'Three-act run progress');
  for (let act = 1; act <= 3; act++) {
    const li = node('li', ''); li.append(node('b', '', `A${act}`));
    for (let depth = 1; depth <= 4; depth++) {
      const mark = node('span', '', depth === 4 ? '♜' : '◇');
      li.append(mark); mapMarks.push({ mark, act, depth });
    }
    map.append(li);
  }
  const meters = node('div', 'ember-meters'), meterRefs = {};
  for (const [key, title] of [['hp', 'HEALTH'], ['stamina', 'STAMINA'], ['mana', 'EMBER']]) {
    const wrap = node('div', `ember-meter ember-meter-${key}`), label = node('div', 'ember-meter-label');
    const value = node('b', ''), rail = node('div', 'ember-meter-rail'), fill = node('i', '');
    rail.setAttribute('role', 'progressbar'); rail.setAttribute('aria-label', title); rail.setAttribute('aria-valuemin', '0');
    label.append(node('span', '', title), value); rail.append(fill); wrap.append(label, rail); meters.append(wrap);
    meterRefs[key] = { value, rail, fill };
  }
  const stance = node('span', 'ember-stance', 'READY');
  stance.setAttribute('aria-label', 'Movement stance'); meters.append(stance);
  const purse = node('div', 'ember-purse');
  const goldLabel = node('b', '', ''), killLabel = node('span', '', ''); purse.append(goldLabel, killLabel);
  const reticle = node('div', 'ember-reticle'); reticle.setAttribute('aria-hidden', 'true');
  reticle.append(node('i', ''), node('b', ''));
  const boss = node('div', 'ember-boss'); boss.hidden = true;
  const bossTitle = node('strong', ''), bossRail = node('div', 'ember-boss-rail'), bossFill = node('i', '');
  bossRail.append(bossFill); boss.append(bossTitle, bossRail);
  const prompt = node('div', 'ember-prompt'); prompt.setAttribute('role', 'status'); prompt.setAttribute('aria-live', 'polite');
  const lookButton = node('button', 'ember-look-button', 'Click to look · drag if capture is unavailable');
  lookButton.type = 'button';
  hud.append(heading, map, meters, purse, reticle, boss, prompt, lookButton);

  const overlay = node('section', 'ember-overlay'); overlay.hidden = true; overlay.setAttribute('aria-label', 'Run status');
  const overlayTitle = node('h2', ''), overlayText = node('p', '');
  const resume = node('button', 'ember-primary', 'Resume descent →'); resume.type = 'button';
  const replay = node('button', 'ember-primary', 'Begin another descent →'); replay.type = 'button';
  const returnHub = node('a', 'ember-primary ember-return', 'Return to the hub →'); returnHub.href = '/'; returnHub.hidden = true;
  const stats = node('div', 'ember-run-stats');
  overlay.append(node('span', 'ember-eyebrow', 'THE DESCENT'), overlayTitle, overlayText, stats, resume, replay, returnHub);
  const decisions = node('section', 'ember-decisions'); decisions.hidden = true;
  decisions.setAttribute('aria-label', 'Dungeon choices');
  const decisionTitle = node('h2', 'ember-decision-title'), decisionNote = node('p', 'ember-decision-note');
  const decisionList = node('div', 'ember-choice-list');
  decisions.append(node('span', 'ember-eyebrow', 'YOUR NEXT CHAPTER'), decisionTitle, decisionNote, decisionList);
  board.append(canvas, hud, overlay, decisions);

  const footer = node('div', 'ember-footer');
  const build = node('div', 'ember-build'); build.setAttribute('aria-label', 'Run relics');
  const hints = node('div', 'ember-hints');
  for (const [key, title] of [['WASD', 'Move'], ['Mouse', 'Look'], ['Shift', 'Sprint'], ['Ctrl', 'Crouch'], ['C', 'Quiet'], ['LMB / J', 'Blade'], ['RMB / E', 'Bolt'], ['Space', 'Dodge'], ['F', 'Use'], ['P', 'Pause']]) {
    const hint = node('span', ''); hint.append(node('kbd', '', key), document.createTextNode(title)); hints.append(hint);
  }
  footer.append(build, hints);
  const touch = node('div', 'ember-controls'), pads = {}, actionRefs = {};
  for (const [id, title] of [['move', 'MOVE'], ['aim', 'LOOK']]) {
    const group = node('div', 'ember-stick-group'), pad = node('button', 'ember-stick'), knob = node('i', 'ember-stick-knob', id === 'move' ? '✥' : '◎');
    pad.type = 'button'; pad.dataset.stick = id;
    pad.setAttribute('aria-label', id === 'move' ? 'Drag to move relative to the camera' : 'Drag to turn the camera');
    pad.append(knob); group.append(pad, node('span', '', title)); touch.append(group); pads[id] = { pad, knob };
  }
  const actions = node('div', 'ember-actions');
  for (const [id, icon, title] of [['melee', '⚔', 'BLADE'], ['spell', '✦', 'BOLT'], ['dash', '↝', 'DODGE'], ['interact', '◇', 'USE']]) {
    const button = node('button', 'ember-action'); button.type = 'button'; button.dataset.control = id;
    button.setAttribute('aria-label', id === 'interact' ? 'Use nearby gate, reliquary or camp' : title);
    button.append(node('b', '', icon), node('span', '', title)); actions.append(button); actionRefs[id] = button;
  }
  touch.insertBefore(actions, touch.lastChild);
  const mobility = node('div', 'ember-mobility');
  for (const [id, icon, title] of [['sprint', '»', 'SPRINT'], ['crouch', '⌄', 'CROUCH'], ['walk', '·', 'QUIET']]) {
    const button = node('button', 'ember-action ember-mobility-action'); button.type = 'button'; button.dataset.control = id;
    button.setAttribute('aria-label', `Hold to ${title.toLowerCase()}`);
    button.append(node('b', '', icon), node('span', '', title)); mobility.append(button); actionRefs[id] = button;
  }
  touch.append(mobility);
  const settings = node('details', 'ember-settings'), settingTitle = node('summary', '', 'Descent settings · seed & difficulty');
  const settingBody = node('div', 'ember-setting-body');
  const difficultyLabel = node('label', '', 'DESCENT'), difficultySelect = node('select', '');
  difficultySelect.setAttribute('aria-label', 'Difficulty; changing begins a fresh run with this seed');
  for (const [id, rules] of Object.entries(DIFFICULTIES)) {
    const option = node('option', '', rules.title); option.value = id; difficultySelect.append(option);
  }
  difficultySelect.value = difficulty;
  const difficultyNote = node('p', 'ember-difficulty-note', DIFFICULTIES[difficulty].description);
  difficultyLabel.append(difficultySelect);
  const seedLabel = node('label', '', 'RUN SEED'), seedInput = node('input', ''), seedButton = node('button', '', 'Replay seed'), newButton = node('button', '', 'New seed');
  seedInput.type = 'text'; seedInput.inputMode = 'numeric'; seedInput.value = state.seed; seedInput.maxLength = 10;
  seedInput.setAttribute('aria-label', 'Run seed, a number from 1 to 4294967295'); seedLabel.append(seedInput);
  seedButton.type = newButton.type = 'button';
  const keyboardNote = node('p', 'ember-keyboard-note', 'Shift sprints using stamina; Ctrl crouches; C walks quietly. Space dodges. Keyboard only: comma / period turn the camera, J swings and E casts. Open settings pauses the run.');
  settingBody.append(difficultyLabel, seedLabel, seedButton, newButton, difficultyNote, keyboardNote);
  settings.append(settingTitle, settingBody); view.append(board, footer, touch, settings); container.append(view);

  const renderer = new EmberVoxelRenderer(canvas);
  if (!renderer.available) { const reason = renderer.error || 'WebGL is unavailable.'; renderer.destroy(); view.remove(); throw new Error(`Ember Delve needs WebGL for its 3D dungeon. ${reason}`); }
  function draw(fraction = 1) {
    if (dead || graphicsFailed) return;
    if (!renderer.available) { failGraphics(); return; }
    const sample = presentation.sample(state, fraction);
    try {
      if (renderer.render(sample, { ...camera, time: sample.elapsed, reducedMotion: reducedMotion.matches }) === false) failGraphics();
    } catch (error) { failGraphics(error?.message); }
  }
  function emit() {
    onUpdate({
      phase: ['route', 'reward', 'camp'].includes(state.phase) ? 'playing' : state.phase,
      score: state.score, record: state.score, recordKey: `${state.difficulty}-thirdperson-v2`,
      recordLabel: `${DIFFICULTIES[state.difficulty].title.toUpperCase()} 3D BEST`,
      detail: `${DIFFICULTIES[state.difficulty].title} · Act ${state.act}/3 · ${state.room.title} · ${state.gold} gold`,
    });
  }
  function unlockMouse() {
    if (document.pointerLockElement === canvas) { expectedUnlock = true; document.exitPointerLock?.(); }
  }
  function release() {
    held.clear(); pointers.clear(); queue.clear(); dragPoint = null;
    for (const id of ['move', 'aim']) {
      sticks[id] = { x: 0, y: 0 }; pads[id].knob.style.transform = 'translate(0,0)'; pads[id].pad.setAttribute('aria-pressed', 'false');
    }
    for (const button of Object.values(actionRefs)) button.setAttribute('aria-pressed', 'false');
  }
  function updateUI() {
    view.dataset.phase = state.phase; view.dataset.difficulty = state.difficulty;
    text(actLabel, ACT_NAMES[state.act - 1]); text(roomLabel, `ACT ${state.act} · ${state.room.title} · ${state.depth}/4`);
    text(difficultyNote, DIFFICULTIES[state.difficulty].description);
    text(goldLabel, `${state.gold} GOLD`); text(killLabel, `${state.kills} fallen · ${state.score.toLocaleString()} score`);
    const p = state.player;
    const stanceId = p.crouching ? 'crouch' : p.walking ? 'quiet' : p.sprinting ? 'sprint' : p.sprintExhausted ? 'exhausted' : Math.hypot(p.velocityX || 0, p.velocityY || 0) > 3 ? 'move' : 'ready';
    view.dataset.stance = stanceId;
    stance.dataset.stance = stanceId;
    text(stance, ({ crouch: 'CROUCHED · LOW PROFILE', quiet: 'QUIET WALK', sprint: 'SPRINTING · STAMINA', exhausted: 'CATCHING BREATH · RELEASE SHIFT', move: 'MOVING', ready: 'READY' })[stanceId]);
    for (const [key, refs] of Object.entries(meterRefs)) {
      const max = state.player[key === 'hp' ? 'maxHp' : key === 'mana' ? 'maxMana' : 'maxStamina'];
      const value = Math.ceil(state.player[key]), width = `${clamp(state.player[key] / max * 100, 0, 100)}%`;
      text(refs.value, `${value} / ${max}`);
      if (refs.width !== width) { refs.width = width; refs.fill.style.width = width; }
      if (refs.max !== max) { refs.max = max; refs.rail.setAttribute('aria-valuemax', max); }
      if (refs.current !== value) { refs.current = value; refs.rail.setAttribute('aria-valuenow', value); }
    }
    const nextMapKey = state.room.id + ':' + state.routeHistory.length;
    if (nextMapKey !== mapKey) {
      mapKey = nextMapKey;
      for (const { mark, act, depth } of mapMarks) {
        mark.dataset.state = act < state.act || act === state.act && depth < state.depth ? 'done' : act === state.act && depth === state.depth ? 'current' : 'future';
        const history = state.routeHistory.find(room => room.act === act && room.depth === depth);
        text(mark, depth === 4 ? '♜' : history?.kind === 'treasure' ? '▣' : history?.kind === 'camp' ? '♨' : history?.kind === 'elite' ? '✦' : '◇');
        mark.setAttribute('aria-label', `Act ${act} room ${depth}${history ? `, ${history.kind}` : ''}`);
      }
    }
    const keeper = state.enemies.find(enemy => enemy.boss && enemy.hp > 0);
    hidden(boss, !keeper);
    if (keeper) { text(bossTitle, BOSSES[state.act - 1]); bossFill.style.width = `${clamp(keeper.hp / keeper.maxHp * 100, 0, 100)}%`; }
    const decision = ['route', 'reward', 'camp'].includes(state.phase);
    hidden(decisions, !decision);
    const signature = decision ? state.phase + state.choices.map(choice => choice.id).join() + state.gold : '';
    if (decision && signature !== choiceKey) {
      choiceKey = signature;
      text(decisionTitle, state.phase === 'route' ? 'Choose your descent.' : state.phase === 'camp' ? 'Tend the flame.' : 'Power for the road ahead.');
      text(decisionNote, state.phase === 'route' ? 'Your health, ember, gold and relics carry into the next chamber.' : state.phase === 'camp' ? `${state.gold} GOLD · Prepare for the act keeper.` : 'Take one relic. Its effects stack with your collection.');
      decisionList.replaceChildren();
      for (const choice of state.choices) {
        const button = node('button', 'ember-choice'); button.type = 'button'; button.dataset.choice = choice.id;
        const category = choice.risk || (state.phase === 'camp' ? choice.cost ? `${choice.cost} GOLD` : 'FREE' : `RELIC${state.relics[choice.id] ? ` · OWNED ${state.relics[choice.id]}` : ''}`);
        button.append(node('span', 'ember-choice-category', category), node('strong', '', choice.title), node('p', '', choice.description), node('b', 'ember-choice-arrow', '→'));
        button.disabled = choice.cost > state.gold;
        button.addEventListener('click', () => select(choice.id)); decisionList.append(button);
      }
    }
    const showOverlay = ['paused', 'won', 'lost'].includes(state.phase);
    hidden(overlay, !showOverlay); hidden(resume, state.phase !== 'paused'); hidden(replay, state.phase === 'paused'); hidden(stats, state.phase === 'paused');
    if (showOverlay) {
      text(overlayTitle, state.phase === 'paused' ? 'Keep your flame.' : state.phase === 'won' ? 'The Crown is yours.' : 'A flame worth remembering.');
      text(overlayText, state.phase === 'paused' ? 'Your room, resources and choices are frozen. P resumes; click the dungeon to capture the mouse.' : state.phase === 'won' ? 'Three keepers defeated. Twelve chambers conquered. Your descent is complete.' : 'The dungeon keeps its secrets. Take what you learned into the next descent.');
      if (state.phase !== 'paused') {
        stats.replaceChildren();
        for (const [title, value] of [['SCORE', state.score.toLocaleString()], ['FALLEN', state.kills], ['CHAMBERS', `${state.roomsCleared}/12`], ['TIME', `${Math.floor(state.elapsed / 60)}:${String(Math.floor(state.elapsed % 60)).padStart(2, '0')}`]]) {
          const stat = node('div', ''); stat.append(node('span', '', title), node('b', '', value)); stats.append(stat);
        }
      }
    }
    hidden(reticle, state.phase !== 'playing'); hidden(lookButton, state.phase !== 'playing' || mouseLocked);
    text(lookButton, lookFallback ? 'Drag to look · comma / period also turn' : 'Click to capture mouse · drag also turns');
    const nearExit = Math.hypot(state.player.x - state.room.exit.x, state.player.y - state.room.exit.y) < 70;
    const nearShrine = Math.hypot(state.player.x - state.room.shrine.x, state.player.y - state.room.shrine.y) < 70;
    text(prompt, decision || state.phase === 'paused' ? '' : state.room.cleared ? nearExit ? 'F / USE · Enter the glowing gate' : 'Chamber clear · Reach the glowing gate' : state.room.kind === 'treasure' ? state.enemies.length ? `${state.enemies.length} relic guards · Clear the reliquary` : nearShrine ? 'F / USE · Open the reliquary' : 'Find the reliquary' : state.room.kind === 'camp' ? nearShrine ? 'F / USE · Rest at the fire' : 'Reach the sanctuary fire' : keeper ? 'Read the amber tells · Dodge, then punish recovery' : `${state.enemies.length} guards · Keep a dodge in reserve`);
    const nextBuildKey = JSON.stringify(state.relics);
    if (nextBuildKey !== buildKey) {
      buildKey = nextBuildKey; build.replaceChildren();
      if (!Object.keys(state.relics).length) build.append(node('span', 'ember-build-empty', 'NO RELICS · Your build begins at the first gate'));
      else for (const [id, count] of Object.entries(state.relics)) {
        const chip = node('span', 'ember-relic', `${RELICS[id].title}${count > 1 ? ` ×${count}` : ''}`);
        chip.title = getRelicInfo(state, id).description; build.append(chip);
      }
    }
    if (state.phase !== lastPhase) {
      lastPhase = state.phase;
      if (state.phase !== 'playing') { release(); unlockMouse(); }
      emit();
    }
    if (graphicsFailed) {
      hidden(overlay, false); hidden(decisions, true); hidden(resume, true); hidden(replay, true); hidden(stats, true); hidden(returnHub, false);
      text(overlayTitle, 'The dungeon needs its graphics.');
      text(overlayText, graphicsError); hidden(reticle, true); hidden(lookButton, true);
    }
  }
  function input() {
    const actions = {};
    for (const control of held.values()) actions[control] = true;
    for (const pointer of pointers.values()) if (pointer.control) actions[pointer.control] = true;
    for (const control of queue) actions[control] = true;
    const result = emberCameraInput(actions, sticks.move, camera.yaw);
    const direction = renderer.getCenterAimDirection(state, camera);
    if (direction && Number.isFinite(direction.x) && Number.isFinite(direction.y)) {
      result.aimX = direction.x; result.aimY = direction.y;
    }
    return result;
  }
  function schedule() { if (!dead && state.phase === 'playing' && !raf) raf = requestAnimationFrame(frame); }
  function stopFrame() { if (raf) cancelAnimationFrame(raf); raf = 0; previous = null; accumulator = 0; presentation.reset(); }
  function select(id) {
    if (graphicsFailed) return;
    release(); unlockMouse();
    if (state.phase === 'route') chooseRoute(state, id);
    else if (state.phase === 'reward') chooseReward(state, id);
    else if (state.phase === 'camp') chooseCamp(state, id);
    stopFrame(); updateUI(); draw(); emit(); canvas.focus({ preventScroll: true }); schedule();
  }
  function restart(seed = Date.now()) {
    if (graphicsFailed) return;
    release(); unlockMouse(); stopFrame();
    state = createState({ seed, difficulty }); camera = { yaw: Math.PI / 2, pitch: .32 };
    seedInput.value = state.seed; choiceKey = ''; mapKey = ''; buildKey = '';
    updateUI(); draw(); emit(); canvas.focus({ preventScroll: true }); schedule();
  }
  function togglePause() {
    if (graphicsFailed) return;
    if (!pauseState(state)) return;
    release(); unlockMouse(); stopFrame(); updateUI(); draw(); emit(); schedule();
  }
  function frame(time) {
    raf = 0; if (dead || state.phase !== 'playing') return;
    if (graphicsFailed || !renderer.available) { failGraphics(); return; }
    if (previous === null) previous = time;
    const delta = Math.min(.05, Math.max(0, (time - previous) / 1000)); previous = time; accumulator += delta;
    const turn = [...held.values()].reduce((value, action) => value + (action === 'turnRight' ? 1 : action === 'turnLeft' ? -1 : 0), 0);
    if (turn || Math.hypot(sticks.aim.x, sticks.aim.y) > .16)
      camera = emberLook(camera, (turn + sticks.aim.x) * delta * 800, sticks.aim.y * delta * 500);
    let count = 0;
    while (accumulator >= 1 / 120 && count < 6 && state.phase === 'playing') {
      presentation.capture(state); step(state, input()); queue.clear(); accumulator -= 1 / 120; count++;
    }
    if (count) updateUI();
    draw(tickFraction(accumulator, 1 / 120));
    if (time - lastUpdate > 180) { emit(); lastUpdate = time; }
    schedule();
  }
  const native = target => target instanceof Element && Boolean(target.closest('input,textarea,select,[contenteditable],button,a,summary'));
  function keydown(event) {
    const physical = event.code || event.key;
    // Once a captured Ctrl+P has paused and released the mouse, suppress its
    // auto-repeat until keyup rather than opening the browser's Print dialog.
    if (event.repeat && capturedPauseKey === physical) { event.preventDefault(); return; }
    if (native(event.target)) return;
    const captured = document.pointerLockElement === canvas, crouchHeld = [...held.values()].includes('crouch');
    if (captured && crouchHeld && event.ctrlKey && gameKey(event).toLowerCase() === 'p' &&
      !blocksSoloShortcut({ defaultPrevented: event.defaultPrevented, repeat: event.repeat, isComposing: event.isComposing, altKey: event.altKey, metaKey: event.metaKey, target: event.target })) {
      event.preventDefault(); capturedPauseKey = physical; togglePause(); return;
    }
    const control = emberControl(event, getKeyboardLayout(), { captured, crouchHeld });
    if (!control) return;
    event.preventDefault();
    // Resume/layout changes require a fresh physical press; stale key repeats
    // cannot refill the held set that a pause or choice has just cleared.
    if (event.repeat && !held.has(event.code || event.key)) return;
    if (state.phase === 'playing') {
      held.set(event.code || event.key, control);
      if (!event.repeat) queue.add(control);
    }
  }
  function keyup(event) { const physical = event.code || event.key; held.delete(physical); if (capturedPauseKey === physical) capturedPauseKey = null; }
  function requestLook() {
    if (dead || state.phase !== 'playing') return;
    canvas.focus({ preventScroll: true });
    if (typeof canvas.requestPointerLock !== 'function') { lookFallback = true; updateUI(); return; }
    try {
      const request = canvas.requestPointerLock();
      request?.catch?.(() => { if (!dead) { lookFallback = true; updateUI(); } });
    } catch { lookFallback = true; updateUI(); }
  }
  function mouseMove(event) {
    if (state.phase === 'playing' && document.pointerLockElement === canvas)
      camera = emberLook(camera, event.movementX, event.movementY);
  }
  function aimMove(event) {
    if (state.phase !== 'playing' || document.pointerLockElement === canvas || !pointers.get(event.pointerId)?.look || !dragPoint) return;
    camera = emberLook(camera, event.clientX - dragPoint.x, event.clientY - dragPoint.y);
    dragPoint = { x: event.clientX, y: event.clientY };
  }
  function canvasDown(event) {
    if (state.phase !== 'playing' || ![0, 2].includes(event.button)) return;
    event.preventDefault(); canvas.focus({ preventScroll: true });
    const touchLook = event.pointerType === 'touch';
    const control = touchLook ? null : event.button === 2 ? 'spell' : 'melee';
    pointers.set(event.pointerId, { control, look: document.pointerLockElement !== canvas });
    dragPoint = { x: event.clientX, y: event.clientY };
    if (control) queue.add(control);
    if (document.pointerLockElement !== canvas) {
      canvas.setPointerCapture?.(event.pointerId);
      if (!touchLook) requestLook();
    }
  }
  function pointerEnd(event) {
    const pointer = pointers.get(event.pointerId); if (!pointer) return;
    if (pointer.stick) {
      sticks[pointer.stick] = { x: 0, y: 0 };
      pads[pointer.stick].knob.style.transform = 'translate(0,0)'; pads[pointer.stick].pad.setAttribute('aria-pressed', 'false');
    }
    if (pointer.control) {
      actionRefs[pointer.control]?.setAttribute('aria-pressed', 'false');
      if (event.type === 'pointercancel') queue.delete(pointer.control);
    }
    pointers.delete(event.pointerId); if (pointer.look) dragPoint = null;
  }
  function pointerLockChanged() {
    const locked = document.pointerLockElement === canvas, wasLocked = mouseLocked;
    mouseLocked = locked; view.dataset.mouseLocked = String(locked); release();
    const intentional = expectedUnlock; expectedUnlock = false;
    if (!locked && wasLocked && !intentional && state.phase === 'playing') togglePause();
    else if (!dead) updateUI();
  }
  function pointerLockError() { if (!dead) { lookFallback = true; updateUI(); } }
  function failGraphics(message) {
    if (dead || graphicsFailed) return;
    graphicsFailed = true;
    graphicsError = message || renderer.error || 'The graphics context was interrupted. Your run is paused. Return to the hub and reopen Ember Delve.';
    if (['playing', 'route', 'reward', 'camp'].includes(state.phase)) pauseState(state);
    stopFrame(); release(); unlockMouse(); updateUI(); emit();
  }
  function contextLost() { failGraphics(); }
  for (const [id, { pad, knob }] of Object.entries(pads)) {
    const update = event => {
      const rect = pad.getBoundingClientRect(), radius = rect.width * .35;
      const x = clamp((event.clientX - rect.left - rect.width / 2) / radius, -1, 1), y = clamp((event.clientY - rect.top - rect.height / 2) / radius, -1, 1), length = Math.hypot(x, y);
      sticks[id] = { x: length > 1 ? x / length : x, y: length > 1 ? y / length : y };
      knob.style.transform = `translate(${sticks[id].x * radius}px,${sticks[id].y * radius}px)`;
    };
    pad.addEventListener('pointerdown', event => {
      if (state.phase !== 'playing') return;
      event.preventDefault(); pointers.set(event.pointerId, { stick: id }); pad.setPointerCapture(event.pointerId); pad.setAttribute('aria-pressed', 'true'); update(event);
    });
    pad.addEventListener('pointermove', event => { if (pointers.get(event.pointerId)?.stick === id) update(event); });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) pad.addEventListener(event, pointerEnd);
  }
  for (const [id, button] of Object.entries(actionRefs)) {
    button.addEventListener('pointerdown', event => {
      if (state.phase !== 'playing') return;
      event.preventDefault(); pointers.set(event.pointerId, { control: id }); queue.add(id); button.setPointerCapture(event.pointerId); button.setAttribute('aria-pressed', 'true');
    });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(event, pointerEnd);
    button.addEventListener('click', event => { if (event.detail === 0 && state.phase === 'playing') queue.add(id); });
  }
  function blur() { release(); if (['playing', 'route', 'reward', 'camp'].includes(state.phase)) togglePause(); }
  function visibility() { if (document.hidden) blur(); }
  function resized() { if (!dead) { renderer.resize(); draw(); } }
  function motionChanged() { if (!dead) draw(); }
  function settingsToggled() { if (settings.open && state.phase === 'playing') togglePause(); }
  const preventContextMenu = event => event.preventDefault();
  window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', blur); window.addEventListener('resize', resized);
  document.addEventListener('visibilitychange', visibility); document.addEventListener('mousemove', mouseMove);
  document.addEventListener('pointerlockchange', pointerLockChanged); document.addEventListener('pointerlockerror', pointerLockError);
  canvas.addEventListener('pointermove', aimMove); canvas.addEventListener('pointerdown', canvasDown);
  // Pointer-lock mouse releases may target the document rather than the canvas.
  document.addEventListener('pointerup', pointerEnd); document.addEventListener('pointercancel', pointerEnd);
  canvas.addEventListener('lostpointercapture', pointerEnd); canvas.addEventListener('contextmenu', preventContextMenu);
  canvas.addEventListener('webglcontextlost', contextLost);
  lookButton.addEventListener('click', requestLook); resume.addEventListener('click', togglePause);
  replay.addEventListener('click', () => restart()); newButton.addEventListener('click', () => restart());
  seedButton.addEventListener('click', () => {
    const seed = Number(seedInput.value);
    if (Number.isInteger(seed) && seed > 0 && seed <= 4294967295) { seedInput.setCustomValidity(''); restart(seed); }
    else { seedInput.setCustomValidity('Enter a whole number from 1 to 4294967295.'); seedInput.reportValidity(); }
  });
  difficultySelect.addEventListener('change', () => { difficulty = difficultySelect.value; restart(state.seed); difficultySelect.focus({ preventScroll: true }); });
  settings.addEventListener('toggle', settingsToggled);
  reducedMotion.addEventListener('change', motionChanged);
  const resizeObserver = new ResizeObserver(resized); resizeObserver.observe(board);
  function updateKeyboardHints() {
    view.dataset.keyboardLayout = getKeyboardLayout(); text(hints.querySelector('kbd'), displayKey('WASD'));
    canvas.setAttribute('aria-label', `Third-person voxel dungeon. ${displayKey('WASD')} or arrows move relative to the camera. Mouse or drag to look. Shift sprints using stamina; Control crouches; C walks quietly. Click or J swings, right click or E casts. Space dodges. F uses gates and shrines. Comma and period turn with the keyboard. P pauses.`);
  }
  const unsubscribeKeyboardLayout = subscribeKeyboardLayout(() => { release(); updateKeyboardHints(); });
  updateKeyboardHints(); updateUI(); draw(); emit(); schedule();
  return {
    getState: () => copy(state),
    getDisplayTiming: () => presentation.getStats(),
    getPresentationDiagnostics: () => ({ ...renderer.diagnostics, camera: { ...renderer.diagnostics.camera, ...camera }, mouseLocked, lookFallback, graphicsFailed }),
    restart: () => restart(), togglePause,
    destroy() {
      dead = true; stopFrame(); release(); unsubscribeKeyboardLayout(); resizeObserver.disconnect();
      window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', blur); window.removeEventListener('resize', resized);
      document.removeEventListener('visibilitychange', visibility); document.removeEventListener('mousemove', mouseMove);
      document.removeEventListener('pointerlockchange', pointerLockChanged); document.removeEventListener('pointerlockerror', pointerLockError);
      document.removeEventListener('pointerup', pointerEnd); document.removeEventListener('pointercancel', pointerEnd);
      canvas.removeEventListener('webglcontextlost', contextLost);
      reducedMotion.removeEventListener('change', motionChanged); unlockMouse(); renderer.destroy(); view.remove();
    },
  };
}
