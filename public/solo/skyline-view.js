import { WORLD, BODY, DIFFICULTIES, DISTRICTS, LEVELS, TOTAL_LEVELS, FIXED_STEP, createState, step, togglePause as pauseState, retryStage, nextStage, gatePhase, targetAnchor } from './skyline-engine.js';
import { gameKey, displayKey, getKeyboardLayout, subscribeKeyboardLayout } from '../keyboard-layout.js';
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const copy = value => JSON.parse(JSON.stringify(value));
const node = (tag, name, text) => { const e = document.createElement(tag); e.className = name; if (text !== undefined) e.textContent = text; return e; };
const setText = (e, value) => { if (e.textContent !== value) e.textContent = value; };
const isForm = target => target instanceof Element && Boolean(target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])'));
const KEY = { a: 'left', A: 'left', ArrowLeft: 'left', d: 'right', D: 'right', ArrowRight: 'right', ' ': 'jump', Space: 'jump', e: 'hook', E: 'hook', w: 'up', W: 'up', ArrowUp: 'up', s: 'down', S: 'down', ArrowDown: 'down' };
const elapsedText = seconds => `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(2).padStart(5, '0')}`;
export function mount(container, { onUpdate = () => {} } = {}) {
  let difficulty = 'veteran', state = createState({ difficulty }), destroyed = false;
  let raf = null, previous = null, accumulator = 0, camera = 0, logicalWidth = 960;
  let published = -1, publishedPhase = '', stageArt = null, artLevel = -1, lastEvent = 0, particles = [], ghost = [];
  let pointerAim = null, jumpQueued = false, hookQueued = false;
  const held = new Map(), pointers = new Map(), reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const view = node('section', 'skyline-view'); view.setAttribute('aria-label', 'Skyline Hook precision platformer');
  const tierbar = node('div', 'skyline-tier-bar'), tierLabel = node('label', '', 'CAMPAIGN');
  const tier = node('select', 'skyline-tier-select'); tier.setAttribute('aria-label', 'Difficulty for a new Skyline campaign');
  for (const [value, info] of Object.entries(DIFFICULTIES)) { const option = node('option', '', info.title); option.value = value; tier.append(option); } tier.value = difficulty; tierLabel.append(tier);
  const tierDetail = node('p', 'skyline-tier-detail'); tierbar.append(tierLabel, tierDetail);
  const journey = node('div', 'skyline-journey'); journey.setAttribute('aria-label', 'Twelve rooftop deliveries');
  const badges = LEVELS.map((level, i) => { const badge = node('span', 'skyline-stage-badge', String(i + 1).padStart(2, '0')); badge.title = level.name; journey.append(badge); return badge; });
  const hud = node('div', 'skyline-hud'), district = node('div', 'skyline-district'), name = node('b', ''), districtName = node('span', ''); district.append(districtName, name);
  const numbers = node('div', 'skyline-numbers'), lives = node('div', ''), timer = node('div', ''), chips = node('div', ''); numbers.append(lives, chips, timer); hud.append(district, numbers);
  const board = node('div', 'skyline-board'), canvas = node('canvas', 'skyline-canvas'); canvas.width = 960; canvas.height = WORLD.height; canvas.tabIndex = 0; canvas.dataset.soloFocus = ''; canvas.setAttribute('role', 'img');
  const overlay = node('div', 'skyline-overlay'); overlay.hidden = true;
  const overlayCard = node('div', 'skyline-overlay-card'), overlayTag = node('span', 'skyline-overlay-tag'), overlayTitle = node('h3', ''), overlayText = node('p', ''), action = node('button', 'skyline-continue'); action.type = 'button';
  overlayCard.append(overlayTag, overlayTitle, overlayText, action); overlay.append(overlayCard); board.append(canvas, overlay);
  const tutorial = node('div', 'skyline-tutorial'), tutorialTitle = node('b', '', 'ROOFTOP NOTES'), tutorialText = node('span', ''); tutorial.append(tutorialTitle, tutorialText);
  const status = node('p', 'skyline-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const hint = node('p', 'skyline-hint');
  const controls = node('div', 'skyline-controls'); controls.setAttribute('aria-label', 'Skyline touch controls'); const controlButtons = new Map();
  for (const [id, symbol, label] of [['left', '←', 'LEFT'], ['right', '→', 'RIGHT'], ['jump', '↟', 'JUMP'], ['hook', '⌁', 'HOOK'], ['up', '−', 'REEL IN'], ['down', '+', 'PAY OUT']]) {
    const button = node('button', `skyline-control skyline-control-${id}`); button.type = 'button'; button.dataset.control = id; button.setAttribute('aria-label', `Hold ${label.toLowerCase()}`); button.setAttribute('aria-pressed', 'false'); button.append(node('b', '', symbol), node('span', '', label)); controls.append(button); controlButtons.set(id, button);
  }
  view.append(tierbar, journey, hud, board, tutorial, status, hint, controls); container.append(view);
  let ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
  const skyLayers = DISTRICTS.map((theme, index) => skyLayer(theme, index));
  const spriteLayers = new Map();
  function layer(width, height, paint) { const layer = document.createElement('canvas'); layer.width = width; layer.height = height; const prior = ctx; ctx = layer.getContext('2d'); ctx.imageSmoothingEnabled = false; paint(); ctx = prior; return layer; }
  function rect(x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  function skyLayer(theme, index) {
    return layer(1920, 580, () => {
      const gradient = ctx.createLinearGradient(0, 0, 0, 580); gradient.addColorStop(0, theme.sky); gradient.addColorStop(1, theme.low); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1920, 580);
      for (let i = 0; i < 74; i++) { const x = (i * 137 + index * 43) % 1920, y = (i * 47) % 270; rect(x, y, i % 6 ? 2 : 4, 2, index === 0 ? '#b98c8b' : '#7599b6'); }
      if (index === 0) { rect(126, 65, 74, 74, '#dfa57a'); rect(112, 84, 104, 38, '#e7ad7f'); rect(110, 131, 115, 5, theme.low); }
      else if (index === 1) { for (let i = 0; i < 7; i++) { rect(i * 300 - 50, 90 + i % 3 * 50, 220, 12, '#233d52'); rect(i * 300, 78 + i % 3 * 50, 105, 12, '#233d52'); } }
      else { for (let i = 0; i < 5; i++) { ctx.globalAlpha = .1; ctx.fillStyle = i % 2 ? '#86d9c7' : '#a597e4'; ctx.beginPath(); ctx.moveTo(i * 400, 0); ctx.lineTo(i * 400 + 210, 0); ctx.lineTo(i * 400 + 510, 200); ctx.lineTo(i * 400 + 240, 170); ctx.fill(); ctx.globalAlpha = 1; } }
      for (let depth = 0; depth < 2; depth++) for (let i = 0; i < 30; i++) {
        const x = i * 73 + depth * 28, width = 42 + (i * 17) % 37, height = 85 + (i * 41 + index * 36) % (depth ? 160 : 120), top = 565 - height;
        rect(x, top, width, height + 15, depth ? '#253143' : '#30334b'); rect(x + 5, top - 8, width - 10, 8, depth ? '#2d3a4c' : '#383951');
        if (i % 4 === 0) { rect(x + width / 2 - 2, top - 36, 4, 28, '#384052'); rect(x + width / 2 - 8, top - 34, 16, 3, '#58677a'); }
        for (let wy = top + 16; wy < 550; wy += 23) for (let wx = x + 7; wx < x + width - 5; wx += 13) if ((wx + wy + i) % 7 !== 0) rect(wx, wy, 4, 7, depth ? '#657070' : '#505166');
      }
      rect(0, 558, 1920, 22, '#192633');
    });
  }
  function buildStage() {
    if (artLevel === state.level) return;
    artLevel = state.level; const level = LEVELS[artLevel], theme = DISTRICTS[level.district];
    stageArt = layer(level.width, WORLD.height, () => {
      for (const [index, r] of level.platforms.entries()) {
        rect(r.x, r.y + 7, r.width, r.height - 7, '#162331'); rect(r.x + 3, r.y + 11, r.width - 6, r.height - 11, theme.roof);
        rect(r.x, r.y, r.width, 6, '#d5b3aa'); rect(r.x, r.y + 6, r.width, 5, '#39444d'); rect(r.x + 4, r.y + 12, r.width - 8, 3, theme.accent);
        for (let y = r.y + 26; y < r.y + r.height; y += 22) { rect(r.x + 5, y, r.width - 10, 2, level.district === 0 ? '#614d5b' : '#364a5d'); for (let x = r.x + (Math.round(y / 22) % 2 ? 23 : 5); x < r.x + r.width; x += 48) rect(x, y, 2, 20, '#3e4050'); }
        if (r.kind === 'roof') {
          for (let y = r.y + 38; y < 555; y += 54) for (let x = r.x + 23; x < r.x + r.width - 20; x += 49) {
            rect(x - 3, y - 3, 22, 29, '#263342'); rect(x, y, 16, 22, (Math.floor(x / 49) + Math.floor(y / 54)) % 3 === 0 ? theme.glow : '#415469'); rect(x + 7, y, 2, 22, '#334152'); rect(x, y + 10, 16, 2, '#334152'); rect(x - 5, y + 25, 26, 4, '#b6a29a');
          }
          const signX = r.x + Math.min(r.width - 90, 20); rect(signX, r.y + 35, 66, 20, '#263545'); rect(signX + 3, r.y + 38, 60, 14, theme.accent); ctx.fillStyle = '#263545'; ctx.font = 'bold 9px monospace'; ctx.fillText(['POST', 'RADIO', 'SKY'][level.district], signX + 9, r.y + 48);
          // Background rooftop details sit outside the player's route and carry no false collision cues.
          rect(r.x + r.width - 35, r.y + 16, 16, 13, '#394954'); rect(r.x + r.width - 31, r.y + 19, 8, 7, '#788c93');
        } else { rect(r.x + 9, r.y + r.height, 6, 70, '#2a3949'); rect(r.x + r.width - 15, r.y + r.height, 6, 70, '#2a3949'); rect(r.x + 4, r.y + 15, r.width - 8, 4, theme.accent); }
      }
      for (const strip of level.spikes) for (let i = 0; i < strip.count; i++) {
        const x = strip.x + i * 16; ctx.fillStyle = '#322c3c'; ctx.beginPath(); ctx.moveTo(x + 1, strip.y + 14); ctx.lineTo(x + 8, strip.y); ctx.lineTo(x + 15, strip.y + 14); ctx.fill(); ctx.fillStyle = '#f29a9f'; ctx.beginPath(); ctx.moveTo(x + 8, strip.y); ctx.lineTo(x + 8, strip.y + 11); ctx.lineTo(x + 3, strip.y + 11); ctx.fill();
      }
      for (const a of level.anchors) { rect(a.x - 17, a.y - 27, 34, 6, '#1a2e40'); rect(a.x - 11, a.y - 23, 22, 6, '#96a7ac'); rect(a.x - 4, a.y - 17, 8, 8, '#6d8391'); }
      for (const g of level.gates) { for (const y of [g.top - 8, g.bottom]) { rect(g.x - 10, y, 20, 8, '#253244'); rect(g.x - 6, y + 2, 12, 4, '#bbc2bd'); } }
      const [gx, gy] = level.goal; rect(gx - 13, gy - 54, 26, 54, '#1e3442'); rect(gx - 9, gy - 49, 18, 36, '#7fae90'); rect(gx - 5, gy - 45, 10, 23, '#183e3f'); rect(gx - 3, gy - 5, 6, 5, '#a6d4aa');
    });
  }
  function sprite(pose, facing) {
    const key = `${pose}:${facing}`; if (spriteLayers.has(key)) return spriteLayers.get(key);
    const img = layer(36, 44, () => {
      ctx.translate(18, 21); ctx.scale(facing, 1);
      // Courier: orange rain scarf, backpack battery, visor and articulated boots.
      rect(-9, -9, 7, 13, '#172936'); rect(-10, -8, 5, 11, '#8d705c'); rect(-10, -5, 3, 5, '#9adebf');
      rect(-6, -7, 12, 14, '#243543'); rect(-5, -5, 10, 8, '#9dbeb7'); rect(-2, -3, 6, 6, '#d4e0cd'); rect(-6, 5, 13, 3, '#334252');
      rect(-6, -18, 12, 12, '#172936'); rect(-5, -19, 12, 6, '#d4b49c'); rect(-3, -14, 11, 6, '#32556a'); rect(1, -13, 6, 3, '#b8e7df'); rect(-6, -17, 3, 10, '#bb927c');
      rect(-7, -8, 15, 4, '#efb46d'); rect(-12, -6, 6, 3, '#cf775f'); rect(-16, -5, 7, 3, '#e4966d');
      if (pose === 'hook') { rect(5, -8, 4, 7, '#b4c9b9'); rect(7, -15, 4, 9, '#d4b59b'); rect(8, -18, 5, 5, '#354f63'); }
      else { rect(5, -3, 4, 10, '#829f9d'); rect(6, 4, 4, 4, '#d4b59b'); }
      const gait = pose === 'run1' ? 4 : pose === 'run2' ? -4 : pose === 'air' ? 3 : 0;
      rect(-5, 8, 5, 9 - Math.max(0, gait), '#2b3b50'); rect(2, 8, 5, 9 + Math.min(0, gait), '#2b3b50'); rect(-7 - gait, 15 - Math.max(0, gait), 9, 4, '#bb9c85'); rect(1 + gait, 15 + Math.min(0, gait), 9, 4, '#c5b19b');
    }); spriteLayers.set(key, img); return img;
  }
  function input() {
    const result = { left: false, right: false, jump: jumpQueued, hook: hookQueued, up: false, down: false };
    for (const id of held.values()) result[id] = true; for (const p of pointers.values()) result[p.id] = true;
    if (pointerAim) { result.aimX = pointerAim.x; result.aimY = pointerAim.y; }
    return result;
  }
  function syncControls() { const controlsInput = input(); for (const [id, e] of controlButtons) { const value = String(Boolean(controlsInput[id])); if (e.getAttribute('aria-pressed') !== value) e.setAttribute('aria-pressed', value); } }
  function releaseControls() { held.clear(); for (const [id, pointer] of pointers) { try { if (pointer.target.hasPointerCapture?.(id)) pointer.target.releasePointerCapture(id); } catch {} } pointers.clear(); jumpQueued = false; hookQueued = false; syncControls(); }
  function consumeEvents() {
    for (const e of state.events) if (e.id > lastEvent) {
      lastEvent = e.id;
      if (!reduced.matches && ['jump', 'impact', 'relay', 'attach', 'clear'].includes(e.type)) for (let i = 0; i < (e.type === 'impact' ? 16 : 8); i++) particles.push({ x: e.x, y: e.y, vx: Math.cos(i * 2.4) * (35 + i * 4), vy: Math.sin(i * 2.4) * 45 - 20, life: .4, color: e.type === 'impact' ? '#f4a39d' : e.type === 'relay' ? '#aee5c5' : '#f2c998' });
      if (e.type === 'relay') setText(status, 'Signal chip secured. Both chips open the receiver.');
      else if (e.type === 'attach') setText(status, 'Hook caught. Release to carry your swing into the landing.');
      else if (e.type === 'impact') setText(status, `${e.reason}. ${state.lives} ${state.lives === 1 ? 'battery remains' : 'batteries remain'} across the whole campaign.`);
    }
    if (particles.length > 96) particles.splice(0, particles.length - 96);
  }
  function publish(force = false) {
    if (!force && state.elapsed - published < .1 && publishedPhase === state.phase) return;
    published = state.elapsed; publishedPhase = state.phase; const level = LEVELS[state.level];
    setText(tierDetail, DIFFICULTIES[difficulty].description); setText(districtName, `${DISTRICTS[level.district].name.toUpperCase()} · DELIVERY ${String(state.level + 1).padStart(2, '0')} / 12`); setText(name, level.name);
    setText(lives, `▰ ${state.lives} BATTERIES`); setText(chips, `◇ ${state.relays.filter(Boolean).length} / 2 SIGNALS`); setText(timer, `${Math.max(0, DIFFICULTIES[difficulty].time - state.levelElapsed).toFixed(1)}s`);
    timer.dataset.urgent = String(DIFFICULTIES[difficulty].time - state.levelElapsed < 12);
    badges.forEach((badge, i) => { const stage = i < state.level ? 'complete' : i === state.level ? 'current' : 'future'; if (badge.dataset.stage !== stage) badge.dataset.stage = stage; });
    setText(tutorialText, level.hint); overlay.hidden = state.phase === 'playing'; action.hidden = state.phase === 'paused';
    if (state.phase === 'paused') { setText(overlayTag, 'CLOCK HELD'); setText(overlayTitle, 'Delivery paused'); setText(overlayText, 'Your route, battery allowance and momentum are waiting. Use Resume above or press Escape.'); }
    if (state.phase === 'dead') { setText(overlayTag, 'BATTERY SPENT'); setText(overlayTitle, state.reason); setText(overlayText, `${state.lives} batteries remain. Retry this stage with both signal chips reset. The campaign clock keeps your earlier attempt.`); setText(action, 'Retry delivery'); }
    if (state.phase === 'lost') { setText(overlayTag, 'CAMPAIGN ENDED'); setText(overlayTitle, 'The skyline won this round'); setText(overlayText, `${state.cleared} / 12 deliveries · ${elapsedText(state.elapsed)} active time. Learn the release point and begin a fresh route.`); setText(action, 'New campaign'); }
    if (state.phase === 'stage-clear') { setText(overlayTag, 'DELIVERY COMPLETE'); setText(overlayTitle, `${state.level + 1} / 12 secured`); setText(overlayText, `${elapsedText(state.levelElapsed)} this stage · ${state.lives} batteries carry forward. Next: ${LEVELS[state.level + 1].name}.`); setText(action, 'Next rooftop'); }
    if (state.phase === 'won') { setText(overlayTag, 'ALL TWELVE RECEIVERS ONLINE'); setText(overlayTitle, 'Skyline delivered'); setText(overlayText, `${elapsedText(state.elapsed)} · ${state.deaths} falls · ${state.lives} batteries left. Completed campaign times count separately for each difficulty.`); setText(action, 'Race the skyline again'); }
    onUpdate({ phase: state.phase, score: state.elapsed, scoreLabel: 'CAMPAIGN TIME', scoreUnit: 's', scoreDigits: 2, recordLabel: 'FASTEST CLEAR', record: state.phase === 'won' ? state.elapsed : undefined, recordKey: state.recordKey, result: state.phase === 'won' ? 'campaign' : undefined, detail: `${state.cleared}/12 deliveries · ${state.lives} batteries · ${elapsedText(state.elapsed)}` });
  }
  function draw() {
    buildStage(); const level = LEVELS[state.level], theme = DISTRICTS[level.district], p = state.player;
    const goalCamera = clamp(p.x - logicalWidth * .35, 0, Math.max(0, level.width - logicalWidth));
    camera = state.phase === 'playing' && !reduced.matches ? camera + (goalCamera - camera) * .18 : goalCamera;
    ctx.clearRect(0, 0, logicalWidth, WORLD.height); ctx.imageSmoothingEnabled = false;
    const parallax = Math.floor(camera * .22); ctx.drawImage(skyLayers[level.district], parallax, 0, logicalWidth, 580, 0, 0, logicalWidth, 580);
    ctx.save(); ctx.translate(-Math.floor(camera), 0); ctx.drawImage(stageArt, 0, 0);
    if (!reduced.matches && level.district === 1) { ctx.strokeStyle = '#8bb0bd'; ctx.globalAlpha = .18; ctx.lineWidth = 1; ctx.beginPath(); for (let i = 0; i < 24; i++) { const x = camera + (i * 97 + state.elapsed * 80) % logicalWidth, y = (i * 109 + state.elapsed * 280) % 560; ctx.moveTo(x, y); ctx.lineTo(x - 7, y + 16); } ctx.stroke(); ctx.globalAlpha = 1; }
    const target = targetAnchor(state, input());
    for (const [i, a] of level.anchors.entries()) {
      const selected = state.hook?.index === i || (!state.hook && target?.index === i);
      rect(a.x - 10, a.y - 9, 20, 18, '#1c3b48'); rect(a.x - 7, a.y - 6, 14, 12, selected ? '#c1efda' : theme.accent); rect(a.x - 3, a.y - 2, 6, 4, '#274956');
      if (selected) { ctx.strokeStyle = '#a8dfd0'; ctx.lineWidth = 2; ctx.strokeRect(a.x - 15, a.y - 14, 30, 28); }
    }
    level.relays.forEach(([x, y], i) => { if (state.relays[i]) { rect(x - 3, y - 3, 6, 6, '#789f9c'); return; } ctx.strokeStyle = '#a8e5c4'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y - 10); ctx.lineTo(x + 8, y); ctx.lineTo(x, y + 10); ctx.lineTo(x - 8, y); ctx.closePath(); ctx.stroke(); rect(x - 2, y - 3, 4, 6, '#dfedcc'); });
    for (const g of level.gates) {
      const phase = gatePhase(g, state.levelElapsed, difficulty); ctx.strokeStyle = phase === 'active' ? '#ff8b98' : phase === 'warning' ? '#ffc980' : '#62818b'; ctx.lineWidth = phase === 'active' ? 6 : 2; ctx.setLineDash(phase === 'active' ? [] : [5, 9]); ctx.beginPath(); ctx.moveTo(g.x, g.top); ctx.lineTo(g.x, g.bottom); ctx.stroke(); ctx.setLineDash([]);
      if (phase === 'active') { rect(g.x - 1, g.top, 2, g.bottom - g.top, '#fff0dc'); } rect(g.x - 4, g.top - 5, 8, 3, phase === 'off' ? '#85d8b1' : phase === 'warning' ? '#ffc980' : '#ff8b98');
    }
    const [gx, gy] = level.goal; rect(gx - 5, gy - 43, 10, 21, state.relays.every(Boolean) ? '#aee7b4' : '#aa895e');
    if (state.hook) { const rope = state.hook; ctx.strokeStyle = '#263244'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(p.x + 4 * p.facing, p.y - 6); ctx.lineTo(rope.x, rope.y); ctx.stroke(); ctx.strokeStyle = '#e4d7b1'; ctx.lineWidth = 2; ctx.stroke(); }
    else if (target && state.phase === 'playing') { ctx.strokeStyle = '#a3b9ad'; ctx.globalAlpha = .2; ctx.lineWidth = 1; ctx.setLineDash([3, 12]); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(target.x, target.y); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; }
    if (!reduced.matches) for (const g of ghost) { ctx.globalAlpha = g.life / .3 * .18; ctx.drawImage(sprite('air', g.facing), Math.round(g.x - 13.5), Math.round(g.y - 15.75), 27, 33); } ctx.globalAlpha = 1;
    // Ground contact shadow stays on the actual body footprint, never on thin air.
    if (p.grounded) { ctx.fillStyle = '#182533'; ctx.fillRect(Math.round(p.x - 10), Math.round(p.y + 12), 20, 3); }
    const pose = state.hook ? 'hook' : !p.grounded ? 'air' : Math.abs(p.vx) > 40 ? Math.floor(state.elapsed * 12) % 2 ? 'run1' : 'run2' : 'idle';
    ctx.drawImage(sprite(pose, p.facing), Math.round(p.x - 13.5), Math.round(p.y - 15.75), 27, 33);
    for (const fx of particles) { ctx.globalAlpha = Math.min(1, fx.life * 3); rect(fx.x, fx.y, 3, 3, fx.color); } ctx.globalAlpha = 1;
    ctx.restore();
    rect(14, 14, 108, 28, '#1a293bea'); ctx.fillStyle = '#d3dfd2'; ctx.font = 'bold 12px monospace'; ctx.fillText(elapsedText(state.elapsed), 24, 33);
    if (state.hook) { rect(logicalWidth - 112, 14, 98, 28, '#1a293bea'); ctx.fillStyle = '#cfdeca'; ctx.fillText(`ROPE ${Math.round(state.hook.length)}`, logicalWidth - 102, 33); }
  }
  function refresh() { if (state.phase !== 'playing' && raf !== null) { cancelAnimationFrame(raf); raf = null; } consumeEvents(); publish(true); draw(); schedule(); }
  function schedule() { if (!destroyed && state.phase === 'playing' && raf === null) raf = requestAnimationFrame(frame); }
  function frame(now) {
    raf = null; if (destroyed) return; const dt = previous === null ? 0 : clamp((now - previous) / 1000, 0, .08); previous = now;
    if (state.phase === 'playing') { accumulator += dt; let ticks = 0; while (accumulator >= FIXED_STEP && ticks++ < 10 && state.phase === 'playing') { step(state, input(), FIXED_STEP); jumpQueued = false; hookQueued = false; accumulator -= FIXED_STEP; consumeEvents(); }
      if (!reduced.matches) { for (const fx of particles) { fx.x += fx.vx * dt; fx.y += fx.vy * dt; fx.vy += 80 * dt; fx.life -= dt; } particles = particles.filter(fx => fx.life > 0); for (const g of ghost) g.life -= dt; ghost = ghost.filter(g => g.life > 0); if (Math.hypot(state.player.vx, state.player.vy) > 470 && ghost.length < 8) ghost.push({ x: state.player.x, y: state.player.y, facing: state.player.facing, life: .3 }); }
    } else accumulator = 0;
    publish(); draw(); schedule();
  }
  function togglePause() { if (destroyed) return; releaseControls(); pauseState(state); previous = null; accumulator = 0; refresh(); }
  function restart() { if (destroyed) return; releaseControls(); state = createState({ difficulty }); pointerAim = null; previous = null; accumulator = 0; camera = 0; artLevel = -1; lastEvent = 0; particles = []; ghost = []; published = -1; setText(status, 'Two signal chips per rooftop. Twelve deliveries. One campaign battery allowance.'); refresh(); canvas.focus({ preventScroll: true }); }
  function continueGame() { if (state.phase === 'dead') retryStage(state); else if (state.phase === 'stage-clear') nextStage(state); else if (['won', 'lost'].includes(state.phase)) { restart(); return; } else return; releaseControls(); previous = null; accumulator = 0; camera = 0; pointerAim = null; particles = []; ghost = []; refresh(); canvas.focus({ preventScroll: true }); }
  function keydown(event) {
    if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || isForm(event.target) || state.phase !== 'playing') return;
    const canonical = gameKey(event), activation = canonical === ' ' || canonical === 'Enter';
    const button = event.target instanceof Element ? event.target.closest('button[data-control]') : null;
    const id = activation && button && controls.contains(button) ? button.dataset.control : KEY[canonical];
    if (!id || activation && !button && event.target instanceof Element && event.target.closest('button,a')) return;
    event.preventDefault(); if (event.repeat && !held.has(event.code || event.key)) return;
    held.set(event.code || event.key, id); if (id === 'jump') jumpQueued = true; if (id === 'hook') hookQueued = true; syncControls();
  }
  function keyup(event) { if (held.delete(event.code || event.key)) syncControls(); }
  function point(event) { const box = canvas.getBoundingClientRect(); return { x: camera + (event.clientX - box.left) / box.width * logicalWidth, y: (event.clientY - box.top) / box.height * WORLD.height }; }
  function aim(event) { if (state.phase === 'playing' && event.pointerType !== 'touch') pointerAim = point(event); }
  function down(event) {
    if (state.phase !== 'playing' || event.button !== 0 && event.pointerType !== 'touch') return;
    const button = event.target instanceof Element ? event.target.closest('[data-control]') : null;
    const target = button && controls.contains(button) ? button : event.target === canvas ? canvas : null; if (!target) return;
    const id = target === canvas ? 'hook' : target.dataset.control; event.preventDefault();
    if (target === canvas) { pointerAim = point(event); canvas.focus({ preventScroll: true }); } else if (id === 'hook') pointerAim = null;
    pointers.set(event.pointerId, { id, target }); try { target.setPointerCapture(event.pointerId); } catch {} if (id === 'jump') jumpQueued = true; if (id === 'hook') hookQueued = true; syncControls();
  }
  function end(event) { const pointer = pointers.get(event.pointerId); if (!pointer) return; pointers.delete(event.pointerId); try { if (pointer.target.hasPointerCapture?.(event.pointerId)) pointer.target.releasePointerCapture(event.pointerId); } catch {} syncControls(); }
  function changeTier() { difficulty = tier.value; restart(); }
  function visibility() { if (document.hidden) releaseControls(); }
  function keyboardHints() { view.dataset.keyboardLayout = getKeyboardLayout(); setText(hint, `${displayKey('A D')} / ← → move · Space jump · Hold click / E hook, release to swing free · ${displayKey('W S')} reel in / out`); canvas.setAttribute('aria-label', `Skyline rooftops. ${displayKey('A D')} move, Space jumps, aim with mouse and hold click or E to grapple; release to swing free. ${displayKey('W S')} reel the rope.`); }
  const unsubscribe = subscribeKeyboardLayout(() => { releaseControls(); pointerAim = null; keyboardHints(); });
  const resize = new ResizeObserver(entries => { const width = entries[0].contentRect.width; const next = width < 560 ? 560 : 960; if (next !== logicalWidth) { logicalWidth = next; canvas.width = logicalWidth; canvas.height = WORLD.height; board.style.aspectRatio = `${logicalWidth} / ${WORLD.height}`; ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false; draw(); } }); resize.observe(board);
  const motion = () => { if (reduced.matches) { particles = []; ghost = []; } if (state.phase !== 'playing') draw(); };
  window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', releaseControls); document.addEventListener('visibilitychange', visibility); canvas.addEventListener('pointermove', aim); canvas.addEventListener('pointerdown', down); controls.addEventListener('pointerdown', down); window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end); view.addEventListener('lostpointercapture', end); action.addEventListener('click', continueGame); tier.addEventListener('change', changeTier); reduced.addEventListener('change', motion);
  keyboardHints(); setText(status, 'Two signal chips per rooftop. Twelve deliveries. One campaign battery allowance.'); refresh();
  return { getState: () => copy(state), restart, togglePause, destroy() { if (destroyed) return; destroyed = true; cancelAnimationFrame(raf); releaseControls(); unsubscribe(); resize.disconnect(); reduced.removeEventListener('change', motion); window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', releaseControls); document.removeEventListener('visibilitychange', visibility); canvas.removeEventListener('pointermove', aim); canvas.removeEventListener('pointerdown', down); controls.removeEventListener('pointerdown', down); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end); view.removeEventListener('lostpointercapture', end); action.removeEventListener('click', continueGame); tier.removeEventListener('change', changeTier); spriteLayers.clear(); stageArt = null; view.remove(); } };
}
