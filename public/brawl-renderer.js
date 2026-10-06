import { WORLD, CHARACTERS, STAGES } from './brawl-engine.js';
const TEAMS = ['#edb076', '#93cbb0'];
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const rect = (c, x, y, w, h, fill) => { c.fillStyle = fill; c.fillRect(x, y, w, h); };
function poly(c, points, fill, stroke, width = 1) { c.beginPath(); points.forEach((p, i) => i ? c.lineTo(...p) : c.moveTo(...p)); c.closePath(); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); } }
function line(c, points, color, width = 1) { c.beginPath(); points.forEach((p, i) => i ? c.lineTo(...p) : c.moveTo(...p)); c.strokeStyle = color; c.lineWidth = width; c.stroke(); }
function oval(c, x, y, rx, ry, fill, stroke, width = 1) { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); } }
function seeded(seed) { let n = seed; return () => { n = (n * 1664525 + 1013904223) >>> 0; return n / 4294967296; }; }
function eyes(c, x, y, hurt = false) { rect(c, x, y, 4, 4, '#1e292b'); rect(c, x + 9, y, 4, 4, '#1e292b'); if (hurt) { line(c, [[x, y - 2], [x + 4, y]], '#443432', 2); line(c, [[x + 9, y], [x + 13, y - 2]], '#443432', 2); } else { rect(c, x + 1, y, 1, 1, '#fff5df'); rect(c, x + 10, y, 1, 1, '#fff5df'); } }
function wrench(c, x, y, scale = 1) { c.save(); c.translate(x, y); c.scale(scale, scale); rect(c, -2, -12, 5, 27, '#94a8a4'); rect(c, 0, -10, 2, 23, '#e0e4c7'); poly(c, [[-2, -10], [-9, -15], [-7, -22], [-3, -22], [-4, -16], [3, -14], [6, -20], [10, -18], [8, -10], [3, -7]], '#afc2b5', '#344d47', 1); c.restore(); }

/** Shared by lobby portraits, shelf art and live combat; never changes physics. */
export function drawComicSprite(c, f, time = 0, reduced = false) {
  const id = f.characterId || 'wrench', hurt = f.action === 'hit', active = ['attack', 'special', 'recovery'].includes(f.action);
  const motion = !reduced && f.action === 'run' ? Math.sin(time / 65) * 3 : 0;
  const punch = active ? Math.sin(clamp(f.actionFrame / Math.max(1, f.move?.total || 30), 0, 1) * Math.PI) * 10 : 0;
  c.save(); c.translate(f.x || 0, f.y || 0); c.scale(f.facing || 1, 1);
  if (f.action === 'dodge') c.rotate(-.22); else if (hurt) c.rotate(-.13);
  if (id === 'wrench') {
    // Square cap, impressive moustache, work overalls, a loaded tool belt.
    rect(c, -14 - motion, 18, 13, 8, '#493e36'); rect(c, 3 + motion, 18, 14, 8, '#493e36');
    rect(c, -13, -1, 26, 22, '#486f77'); rect(c, -13, 0, 5, 18, '#88a6a0'); rect(c, 8, 0, 5, 18, '#31505d');
    rect(c, -16, -7, 32, 12, '#d2a15e'); rect(c, -7, -2, 14, 15, '#517b80'); rect(c, -6, 8, 12, 2, '#a5beb0');
    rect(c, -14, 13, 29, 5, '#604a32'); rect(c, -3, 13, 6, 5, '#d4c17b'); rect(c, -13, 14, 5, 9, '#958464');
    rect(c, -11, -24, 23, 20, '#e5b58a'); rect(c, -13, -26, 28, 7, '#d59056'); rect(c, -10, -27, 20, 3, '#f3c681'); rect(c, 12, -21, 7, 3, '#e3a261');
    eyes(c, -6, -17, hurt); rect(c, 0, -11, 7, 4, '#f2c298'); poly(c, [[-8, -9], [-2, -11], [3, -8], [8, -10], [13, -7], [7, -4], [0, -5], [-7, -4]], '#5c4234');
    rect(c, 13, -1, 7 + punch, 7, '#dca674'); rect(c, 17 + punch, -3, 7, 9, '#edc197'); wrench(c, 24 + punch, -4, .8);
  } else if (id === 'sprout') {
    // A long leaf helmet, theatrical cape, wood shield and leafy blade.
    poly(c, [[-16, -15], [-25, 20], [-8, 16], [1, -6]], '#6b4970'); line(c, [[-16, -14], [-21, 14]], '#bc83a2', 2);
    rect(c, -10 - motion, 20, 10, 8, '#46534a'); rect(c, 4 + motion, 20, 10, 8, '#46534a');
    rect(c, -12, -8, 25, 29, '#647e54'); rect(c, -10, -6, 22, 4, '#bdd195'); rect(c, -3, -3, 9, 20, '#9fbc79'); rect(c, -12, 16, 25, 4, '#42543a');
    rect(c, -8, -24, 19, 19, '#d9c79a'); poly(c, [[-12, -18], [-8, -28], [9, -28], [15, -19], [11, -17], [-10, -17]], '#7c9f66');
    poly(c, [[2, -26], [-1, -36], [7, -33], [13, -38], [17, -29], [11, -24]], '#afd580'); line(c, [[6, -25], [10, -33]], '#557946', 2);
    eyes(c, -5, -15, hurt); rect(c, 3, -9, 7, 2, '#574738');
    poly(c, [[-17, -7], [-8, -10], [-4, -3], [-8, 13], [-19, 6]], '#875f46', '#c9ab6d', 2); line(c, [[-15, -5], [-12, 7]], '#b99b69', 2);
    c.save(); c.translate(15 + punch, -3); c.rotate(active ? -.65 : -.18); rect(c, -2, -2, 4, 16, '#86603e'); rect(c, -7, -3, 14, 3, '#d3bd77'); poly(c, [[0, -35], [7, -19], [3, 0], [-4, 0], [-6, -19]], '#b4d18b', '#527341', 1); line(c, [[0, -31], [0, -3]], '#edf0b3', 1); c.restore();
  } else if (id === 'moth') {
    // Soft dumpling body, four patterned wings, antennae and crumb cheeks.
    const flutter = reduced ? 0 : Math.sin(time / 100) * 2;
    poly(c, [[-10, -10], [-29, -20 - flutter], [-33, -5], [-24, 10], [-12, 6]], '#b18ac5', '#685783', 1);
    poly(c, [[9, -10], [27, -21 + flutter], [33, -4], [24, 10], [10, 7]], '#c5a7d8', '#77618d', 1);
    poly(c, [[-13, 2], [-25, 13], [-18, 19], [-7, 10]], '#d2b5db'); poly(c, [[11, 2], [26, 13], [18, 20], [7, 10]], '#d2b5db');
    oval(c, 0, 1, 19, 19, '#ecd8da', '#ac8aab', 1); oval(c, -4, 6, 13, 11, '#f6e6d7');
    line(c, [[-7, -15], [-11, -25], [-17, -25]], '#695474', 2); line(c, [[7, -15], [12, -25], [18, -23]], '#695474', 2);
    oval(c, -17, -25, 3, 3, '#efd49e'); oval(c, 18, -23, 3, 3, '#efd49e');
    eyes(c, -6, -5, hurt); oval(c, 4, 5, active || hurt ? 4 : 2, active || hurt ? 4 : 2, '#a46874'); rect(c, -12, 2, 4, 2, '#d5a1af'); rect(c, 11, 2, 4, 2, '#d5a1af');
    rect(c, -9, 17, 6, 4, '#9b788d'); rect(c, 4, 17, 6, 4, '#9b788d'); oval(c, 18 + punch, 6, 5, 4, '#f2ddd4');
    if (active) { rect(c, 27 + punch, 2, 3, 3, '#f6dc92'); rect(c, 32 + punch, -2, 2, 2, '#d6b66f'); }
  } else if (id === 'parcel') {
    // Wide blue visor, retro space suit, rocket backpack and fragile parcel.
    rect(c, -11 - motion, 17, 10, 8, '#3d5366'); rect(c, 3 + motion, 17, 10, 8, '#3d5366');
    rect(c, -19, -5, 8, 24, '#ab855d'); rect(c, -18, -4, 6, 3, '#e1c293'); rect(c, -17, 17, 6, 5, '#516b77');
    rect(c, -12, -8, 25, 27, '#88a9c7'); rect(c, -9, -7, 7, 23, '#c6d8d8'); rect(c, -11, 9, 24, 5, '#667d98'); rect(c, -3, 10, 7, 3, '#e4c587');
    oval(c, 1, -17, 15, 12, '#c0d2d9', '#657b91', 2); rect(c, -9, -22, 23, 12, '#3c6174'); rect(c, -6, -21, 17, 3, '#85b7bf'); rect(c, 2, -20, 3, 8, '#d9f0db');
    rect(c, 11, -2, 7 + punch, 6, '#bed0d4'); rect(c, 18 + punch, -7, 16, 16, '#c59568'); rect(c, 24 + punch, -7, 4, 16, '#edcea0'); rect(c, 20 + punch, -3, 4, 3, '#f4e7c4');
    if (f.action === 'recovery') poly(c, [[-17, 20], [-21, 34], [-15, 29], [-12, 35], [-12, 20]], '#ffd693');
  } else if (id === 'zap') {
    // Pointed ears, protruding muzzle, yellow jacket and a jagged rat tail.
    line(c, [[-11, 11], [-28, 9], [-23, 1], [-36, -2]], '#c19168', 4);
    rect(c, -10 - motion, 16, 9, 6, '#755444'); rect(c, 4 + motion, 16, 11, 6, '#755444');
    poly(c, [[-12, -2], [-5, -7], [10, -4], [15, 15], [-12, 16]], '#d8b553'); rect(c, -8, 1, 8, 10, '#f1d777'); rect(c, -10, 12, 24, 4, '#806646');
    poly(c, [[-13, -13], [-13, -29], [-5, -24], [-1, -11]], '#bba886', '#615749', 1); poly(c, [[6, -15], [13, -30], [18, -23], [16, -11]], '#cdbb91', '#615749', 1);
    poly(c, [[-10, -20], [-8, -12], [-3, -14]], '#d5a2a0'); poly(c, [[13, -24], [9, -15], [14, -15]], '#dfaead');
    oval(c, 0, -10, 14, 11, '#cdbb91'); poly(c, [[2, -18], [4, -27], [8, -22], [11, -28], [12, -18]], '#efd47b');
    eyes(c, -6, -13, hurt); oval(c, 11, -6, 7, 5, '#e0cca1'); rect(c, 16, -8, 4, 3, '#564e43'); line(c, [[9, -2], [14, -1]], '#765a44', 1);
    rect(c, 10, 2, 8 + punch, 5, '#f0d589'); oval(c, 20 + punch, 3, 4, 4, '#b6a47f');
    if (active) line(c, [[26 + punch, -8], [31 + punch, -2], [27 + punch, 1], [34 + punch, 7]], '#fff3a6', 2);
  } else {
    // Barrel chest, heavy knuckles, cardigan, tiny spectacles and silver sideburns.
    rect(c, -18 - motion, 22, 16, 8, '#483e3d'); rect(c, 5 + motion, 22, 16, 8, '#483e3d');
    oval(c, -1, 2, 22, 24, '#745b50'); rect(c, -20, -8, 39, 33, '#877564'); rect(c, -14, -7, 26, 29, '#b8a38a'); rect(c, -13, -5, 7, 24, '#d0ba99'); rect(c, 5, -5, 8, 25, '#6b6356'); rect(c, -3, -1, 2, 18, '#625f51');
    for (const y of [0, 7, 14]) rect(c, -1, y, 2, 2, '#e0c8a0');
    oval(c, -1, -20, 17, 13, '#755b51'); oval(c, 1, -18, 12, 9, '#c5a283'); rect(c, -16, -23, 5, 11, '#b8b5a0'); rect(c, 12, -22, 4, 10, '#b8b5a0');
    eyes(c, -7, -23, hurt); c.strokeStyle = '#dbcaa2'; c.lineWidth = 1; c.strokeRect(-9, -25, 9, 7); c.strokeRect(2, -25, 9, 7); line(c, [[0, -22], [2, -22]], '#dbcaa2', 1); rect(c, -2, -18, 10, 4, '#9b765b'); rect(c, 0, -12, 9, 2, '#655043');
    oval(c, -20, 3, 8, 15, '#73584c'); oval(c, 20 + punch, 1, 9, 15, '#73584c'); oval(c, 25 + punch, 10, 11, 8, '#ae8b71'); line(c, [[20 + punch, 6], [28 + punch, 6]], '#d2af89', 1);
  }
  c.restore();
}

function paintScene(c, stageId) {
  const stage = STAGES[stageId] || STAGES.rooftop, random = seeded(7135);
  const sky = c.createLinearGradient(0, 0, 0, 720);
  sky.addColorStop(0, stageId === 'garden' ? '#91b8a2' : stageId === 'foundry' ? '#433e53' : '#8a92b0');
  sky.addColorStop(.62, stageId === 'garden' ? '#d2d8ae' : stageId === 'foundry' ? '#a46f69' : '#ecc099');
  sky.addColorStop(1, stageId === 'foundry' ? '#4e4148' : '#7b9583'); c.fillStyle = sky; c.fillRect(0, 0, 1200, 720);
  if (stageId === 'rooftop') {
    oval(c, 914, 130, 53, 53, '#f5d3a2'); rect(c, 0, 110, 310, 10, '#c6c4c342'); rect(c, 160, 126, 250, 6, '#ded4c442'); rect(c, 814, 224, 320, 6, '#f8d7ad42');
    for (const [fill, base, seed] of [['#687f8d', 470, 91], ['#506b77', 530, 195]]) {
      const r = seeded(seed); for (let x = -20; x < 1200;) { const w = 60 + r() * 90, h = 90 + r() * 150; rect(c, x, base - h, w - 6, h, fill); rect(c, x + 8, base - h + 9, w - 22, 3, '#e6c9a02c'); for (let y = base - h + 24; y < base - 10; y += 22) for (let wx = x + 13; wx < x + w - 15; wx += 22) if (r() > .55) rect(c, wx, y, 5, 7, '#dfc89644'); x += w; }
    }
    line(c, [[0, 206], [390, 254], [870, 230], [1200, 181]], '#56646d66', 2);
    for (let x = 100; x < 1200; x += 190) poly(c, [[x, 206 + Math.sin(x) * 20], [x + 16, 211], [x + 12, 232]], '#ce978477');
    rect(c, 216, 615, 768, 105, '#3e5660'); for (let x = 229; x < 980; x += 76) { rect(c, x, 630, 60, 52, '#304852'); rect(c, x + 6, 636, 48, 5, '#64817844'); }
    rect(c, 530, 643, 140, 33, '#263d49'); c.fillStyle = '#d8bd91'; c.font = 'bold 13px Consolas, monospace'; c.textAlign = 'center'; c.fillText('OVERTIME / 24H', 600, 665);
  } else if (stageId === 'garden') {
    oval(c, 180, 105, 53, 53, '#eef0c6');
    for (let i = 0; i < 28; i++) { const x = i * 48, y = 330 + random() * 60; rect(c, x + 20, y, 10, 220, '#63856b'); oval(c, x + 22, y, 63, 65, '#6d98726b'); oval(c, x + 12, y - 20, 48, 45, '#87aa77aa'); }
    rect(c, 96, 529, 1008, 47, '#526f50'); for (let x = 110; x < 1095; x += 42) { rect(c, x, 524, 9, 47, '#8fa77b'); rect(c, x - 4, 526, 17, 4, '#c0c493'); }
    oval(c, 600, 557, 79, 16, '#758e70'); oval(c, 600, 553, 65, 9, '#b8c7a0'); rect(c, 585, 510, 30, 44, '#7c9476'); oval(c, 600, 510, 32, 7, '#b5c49b');
    for (let x = 140; x < 1080; x += 31) { rect(c, x, 604 + random() * 60, 13, 7, '#5c8155'); if (random() > .6) { rect(c, x + 5, 603, 2, 6, '#dee4b4'); rect(c, x + 3, 605, 6, 2, '#c49da0'); } }
    rect(c, 170, 650, 860, 70, '#4d6d53');
  } else {
    for (let x = 0; x < 1200; x += 110) { rect(c, x, 190 + (x % 220 ? 20 : 0), 76, 280, '#594959'); rect(c, x + 7, 200, 6, 240, '#9d797c33'); rect(c, x + 17, 230, 40, 70, '#cd96784c'); rect(c, x + 20, 310, 34, 4, '#392f40'); }
    for (const x of [108, 1080]) { rect(c, x, 100, 22, 453, '#5d575a'); rect(c, x + 5, 104, 5, 447, '#9d9384'); rect(c, x - 9, 131, 40, 9, '#433f4a'); rect(c, x - 9, 463, 40, 9, '#433f4a'); }
    line(c, [[0, 150], [1200, 150]], '#392f40', 12); for (let x = 60; x < 1200; x += 230) { line(c, [[x, 150], [x, 250]], '#baaa8a88', 3); rect(c, x - 18, 243, 36, 12, '#453b47'); rect(c, x - 14, 255, 28, 3, '#f6d6a5'); }
    rect(c, 176, 601, 848, 119, '#4b4a4d'); for (let x = 186; x < 1014; x += 64) { rect(c, x, 617, 50, 47, '#353c42'); for (let dx = 5; dx < 45; dx += 8) rect(c, x + dx, 621, 3, 37, '#696b61'); }
    c.fillStyle = '#dab68b'; c.font = 'bold 13px Consolas, monospace'; c.textAlign = 'center'; c.fillText('WARRANTY VOID IF PUNCHED', 600, 696);
  }
  for (const p of stage.platforms) paintPlatform(c, p, stageId);
}
function paintPlatform(c, p, stageId) {
  const top = stageId === 'garden' ? '#b1c397' : stageId === 'foundry' ? '#c5b58c' : '#b3bbaa', body = stageId === 'garden' ? '#65855d' : stageId === 'foundry' ? '#626069' : '#6c7f7d';
  rect(c, p.x + 5, p.y + 6, p.w, p.h, '#20393b44'); rect(c, p.x, p.y, p.w, p.h, body); rect(c, p.x, p.y, p.w, 4, top); rect(c, p.x, p.y + p.h - 4, p.w, 4, '#344d46');
  for (let x = p.x + 10; x < p.x + p.w - 8; x += 44) { rect(c, x, p.y + 7, 3, 3, '#d6cdaa'); if (p.h > 20) line(c, [[x + 8, p.y + 7], [x + 25, p.y + 7]], '#95a48a66', 2); }
  if (!p.solid) { poly(c, [[p.x + 10, p.y + p.h], [p.x + 25, p.y + p.h + 11], [p.x + 39, p.y + p.h]], body); poly(c, [[p.x + p.w - 39, p.y + p.h], [p.x + p.w - 25, p.y + p.h + 11], [p.x + p.w - 10, p.y + p.h]], body); }
  if (stageId === 'garden') for (let x = p.x + 9; x < p.x + p.w; x += 31) { rect(c, x, p.y - 3, 9, 3, '#82a15b'); rect(c, x + 3, p.y - 5, 2, 4, '#a9bf73'); }
  if (stageId === 'foundry') for (let x = p.x + 6; x < p.x + p.w; x += 40) poly(c, [[x, p.y + p.h - 8], [x + 12, p.y + p.h - 8], [x + 19, p.y + p.h - 3], [x + 7, p.y + p.h - 3]], '#c9a773');
}
export function drawFighterPortrait(canvas, characterId) {
  const c = canvas.getContext('2d'); c.clearRect(0, 0, canvas.width, canvas.height); c.imageSmoothingEnabled = false;
  rect(c, 0, 0, canvas.width, canvas.height, '#e5e9d8'); oval(c, canvas.width / 2, canvas.height * .85, 40, 7, '#a6b39844');
  c.save(); c.translate(canvas.width / 2 - 6, canvas.height * .58); c.scale(1.7, 1.7);
  drawComicSprite(c, { characterId, x: 0, y: 0, facing: 1, action: 'idle', actionFrame: 0 }, 0, true); c.restore();
}
export function drawStagePreview(canvas, stageId) { const c = canvas.getContext('2d'); c.setTransform(canvas.width / 1200, 0, 0, canvas.height / 720, 0, 0); c.imageSmoothingEnabled = false; paintScene(c, stageId); }

export class BrawlRenderer {
  constructor(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d', { alpha: false }); this.backgrounds = new Map();
    for (const id of Object.keys(STAGES)) { const bg = document.createElement('canvas'); bg.width = 1200; bg.height = 720; paintScene(bg.getContext('2d'), id); this.backgrounds.set(id, bg); }
    this.motion = window.matchMedia('(prefers-reduced-motion: reduce)'); this.resize = this.resize.bind(this); this.observer = new ResizeObserver(this.resize); this.observer.observe(canvas); this.resetEffects(); this.resize();
  }
  resize() { const r = this.canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2); const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr)); if (this.canvas.width !== w) this.canvas.width = w; if (this.canvas.height !== h) this.canvas.height = h; }
  resetEffects() { this.effects = []; this.seen = new Set(); this.order = []; this.lastTime = 0; this.lastTick = -1; this.zoom = 1; }
  destroy() { this.observer.disconnect(); this.resetEffects(); }
  observe(state) {
    if (state.tick < this.lastTick) this.resetEffects(); this.lastTick = state.tick;
    for (const e of state.events || []) {
      if (this.seen.has(e.id)) continue; this.seen.add(e.id); this.order.push(e.id); if (this.order.length > 256) this.seen.delete(this.order.shift());
      if (['hit', 'parry', 'stock', 'explosion', 'respawn', 'jump', 'shieldBreak'].includes(e.type) && Number.isFinite(e.x + e.y)) this.effects.push({ ...e, age: 0, life: e.type === 'stock' ? .7 : e.type === 'explosion' ? .28 : .32 });
    }
    if (this.effects.length > 32) this.effects.splice(0, this.effects.length - 32);
  }
  render(state, { time = performance.now(), localId = null } = {}) {
    const c = this.ctx, reduced = this.motion.matches, dt = Math.min(.05, Math.max(0, (time - this.lastTime) / 1000)); this.lastTime = time; this.observe(state);
    const actors = state.fighters.filter(f => f.stocks > 0 && f.respawnTicks === 0);
    const extentX = Math.max(500, ...actors.map(f => Math.abs(f.x - 600) + 80)), extentY = Math.max(310, ...actors.map(f => Math.abs(f.y - 360) + 55));
    const targetZoom = Math.max(.55, Math.min(1, 570 / extentX, 335 / extentY)); this.zoom += (targetZoom - this.zoom) * (reduced ? 1 : .15);
    c.setTransform(1, 0, 0, 1, 0, 0); rect(c, 0, 0, this.canvas.width, this.canvas.height, '#263b42');
    const scale = Math.min(this.canvas.width / 1200, this.canvas.height / 720);
    c.setTransform(scale, 0, 0, scale, (this.canvas.width - 1200 * scale) / 2, (this.canvas.height - 720 * scale) / 2); rect(c, 0, 0, 1200, 720, state.stageId === 'foundry' ? '#493e50' : state.stageId === 'garden' ? '#9ab59e' : '#939aaf');
    c.save(); c.translate(600, 360); c.scale(this.zoom, this.zoom); c.translate(-600, -360); c.imageSmoothingEnabled = false;
    c.drawImage(this.backgrounds.get(state.stageId) || this.backgrounds.get('rooftop'), 0, 0);
    for (const h of state.hazards || []) this.hazard(c, h, time, reduced);
    for (const p of state.projectiles || []) this.projectile(c, p, time, reduced);
    for (const f of state.fighters) {
      if (f.stocks === 0 || f.respawnTicks > 0 || !f.selected) continue;
      if (f.grounded) oval(c, f.x + 2, f.y + f.height / 2 + 2, f.width * .6, 4, '#162b3344');
      if (f.action === 'shield') { const radius = Math.max(f.width, f.height) / 2 + 7; oval(c, f.x, f.y, radius * .82, radius, TEAMS[f.id] + '28', TEAMS[f.id], 2); const amount = clamp(f.shield / 100, 0, 1); rect(c, f.x - 20, f.y + radius + 4, 40, 3, '#233b43'); rect(c, f.x - 20, f.y + radius + 4, 40 * amount, 3, TEAMS[f.id]); }
      if (f.invulnerable) oval(c, f.x, f.y, f.width / 2 + 7, f.height / 2 + 7, null, '#fff0c688', 1.5);
      drawComicSprite(c, f, time, reduced); this.move(c, f);
      const labelY = f.y - f.height / 2 - 14; rect(c, f.x - 11, labelY - 8, 22, 12, '#273c42'); c.fillStyle = TEAMS[f.id]; c.font = 'bold 9px Consolas, monospace'; c.textAlign = 'center'; c.fillText(`P${f.id + 1}`, f.x, labelY + 1);
      if (f.id === localId) poly(c, [[f.x - 4, labelY - 13], [f.x + 4, labelY - 13], [f.x, labelY - 9]], TEAMS[f.id]);
    }
    this.effects = this.effects.filter(e => (e.age += dt) < e.life); for (const e of this.effects) this.effect(c, e, reduced);
    c.restore();
    for (const f of state.fighters) if (f.respawnTicks > 0 && f.stocks > 0) { c.fillStyle = TEAMS[f.id]; c.font = 'bold 12px Consolas, monospace'; c.textAlign = 'center'; c.fillText(`P${f.id + 1} / BACK IN ${(f.respawnTicks / 120).toFixed(1)}s`, f.id === 0 ? 240 : 960, 55); }
    c.fillStyle = '#fff2d3'; c.font = '10px Consolas, monospace'; c.textAlign = 'left'; c.fillText(STAGES[state.stageId]?.name?.toUpperCase() || '', 26, 694);
    c.textAlign = 'right'; c.fillText('BUILD DAMAGE / KEEP YOUR RECOVERY', 1174, 694);
  }
  move(c, f) {
    if (!f.move || !['attack', 'special', 'recovery'].includes(f.action)) return;
    const m = f.move, active = f.actionFrame >= m.startup && f.actionFrame < m.startup + m.active;
    if (!active) { if (f.actionFrame < m.startup) { c.fillStyle = '#fff2c5'; c.fillRect(f.x + f.facing * 20 - 2, f.y - 17, 4, 4); } return; }
    const color = CHARACTERS[f.characterId]?.color || '#ffe0a1', direction = m.direction;
    const x = f.x + (direction === 'up' || direction === 'down' ? 0 : f.facing * m.reach * .55), y = f.y + (direction === 'up' ? -m.reach * .45 : direction === 'down' && !f.grounded ? m.reach * .45 : 0);
    c.save(); c.globalAlpha = .55; const points = direction === 'up' || direction === 'down' ? [[x - 14, y + 5], [x, y - 12], [x + 14, y + 5]] : [[x - f.facing * 9, y - 17], [x + f.facing * 14, y], [x - f.facing * 9, y + 17]];
    line(c, points, color, 4); c.globalAlpha = 1; line(c, points, '#fff2ca', 1); c.restore();
  }
  projectile(c, p, time, reduced) {
    c.save(); c.translate(p.x, p.y);
    if (p.kind === 'wrench') { c.rotate(reduced ? Math.atan2(p.vy, p.vx) : time / 80); wrench(c, 0, 0, .6); }
    else if (p.kind === 'leaf') { c.rotate(Math.atan2(p.vy, p.vx)); poly(c, [[-12, 0], [0, -7], [12, 0], [0, 7]], '#c6db8d', '#4f774a', 1); line(c, [[-8, 0], [9, 0]], '#fff0b6', 1); }
    else if (p.kind === 'parcel') { c.rotate(reduced ? 0 : time / 200); rect(c, -8, -8, 16, 16, '#c5966c'); rect(c, -2, -8, 4, 16, '#ead4ac'); rect(c, -6, -4, 4, 3, '#fff0d0'); }
    else line(c, [[-12, -3], [-4, 2], [0, -3], [10, 3]], '#fff2a5', 3);
    c.restore();
  }
  hazard(c, h, time, reduced) {
    const warning = h.phase === 'warning';
    if (h.type === 'wind') { c.fillStyle = warning ? '#ffe2a8' : '#fff2c9'; c.font = 'bold 11px Consolas, monospace'; c.textAlign = 'center'; c.fillText(warning ? h.direction > 0 ? 'CROSSWIND INCOMING →' : '← CROSSWIND INCOMING' : h.direction > 0 ? 'CROSSWIND →' : '← CROSSWIND', 600, 100); if (!warning) for (let i = 0; i < 6; i++) { const x = 240 + i * 125 + (reduced ? 0 : (time / 7) % 60); line(c, [[x, 180 + i * 38], [x + h.direction * 36, 180 + i * 38]], '#edf0d343', 2); } return; }
    rect(c, h.x, h.y + h.h - 5, h.w, 5, warning ? '#e6b875' : '#ecd7aa');
    if (warning) { c.strokeStyle = '#f4c887'; c.lineWidth = 1; c.setLineDash([5, 5]); c.strokeRect(h.x, h.y, h.w, h.h); c.setLineDash([]); c.fillStyle = '#ffe9b5'; c.font = 'bold 10px Consolas, monospace'; c.textAlign = 'center'; c.fillText(h.type === 'steam' ? 'STEAM!' : 'SPLASH!', h.x + h.w / 2, h.y - 9); }
    else { const color = h.type === 'steam' ? '#efe9ce' : '#b9dbd1'; for (let i = 0; i < 7; i++) { const phase = reduced ? 0 : Math.sin(time / 100 + i) * 6; rect(c, h.x + i * h.w / 7, h.y + 8 + (i % 3) * 17, Math.max(3, h.w / 7 - 3), h.h - 12 - (i % 3) * 17 + phase, color + '55'); } }
  }
  effect(c, e, reduced) {
    const t = e.age / e.life, color = TEAMS[e.fighter] || '#fff0c6'; c.save(); c.globalAlpha = 1 - t;
    if (e.type === 'stock') { c.fillStyle = color; c.font = 'bold 25px Consolas, monospace'; c.textAlign = 'center'; c.fillText('OUT!', clamp(e.x, 90, 1110), clamp(e.y, 110, 630) - (reduced ? 0 : t * 14)); }
    else if (e.type === 'hit' || e.type === 'parry' || e.type === 'shieldBreak') { const r = 10 + (reduced ? 0 : t * 16); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + e.id; line(c, [[e.x + Math.cos(a) * r * .5, e.y + Math.sin(a) * r * .5], [e.x + Math.cos(a) * r, e.y + Math.sin(a) * r]], e.type === 'parry' ? '#edfbcf' : '#ffe4ba', 2); } }
    else oval(c, e.x, e.y, 12 + (reduced ? 0 : t * (e.type === 'explosion' ? 73 : 16)), 9 + (reduced ? 0 : t * (e.type === 'explosion' ? 73 : 9)), null, e.type === 'explosion' ? '#ffca97' : color, 2);
    c.restore();
  }
}
