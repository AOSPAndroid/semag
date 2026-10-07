import { CHARACTERS, STAGES } from './brawl-engine.js';
import { INK, rect, poly, line, oval, comicPose, drawComicSprite, drawWrench, paintStage } from './art/oddstock-art.js';
export { drawComicSprite } from './art/oddstock-art.js';
const TEAMS = ['#edb076', '#93cbb0'];
const SPRITE_WIDTH = 160, SPRITE_HEIGHT = 128;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const STAR_X = Array.from({ length: 16 }, (_, i) => Math.cos(i * Math.PI / 8));
const STAR_Y = Array.from({ length: 16 }, (_, i) => Math.sin(i * Math.PI / 8));
const BADGE_WIDTHS = new Map();
function star(c, x, y, radius, inner, fill, stroke) { c.beginPath(); for (let i = 0; i < 16; i++) { const r = i % 2 ? inner : radius, px = x + STAR_X[i] * r, py = y + STAR_Y[i] * r; i ? c.lineTo(px, py) : c.moveTo(px, py); } c.closePath(); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1.5; c.lineJoin = 'miter'; c.stroke(); } }
function badge(c, x, y, text, color, size = 10) { c.font = `bold ${size}px Consolas, monospace`; const key = `${size}/${text}`; let w = BADGE_WIDTHS.get(key); if (w == null) { w = Math.ceil(c.measureText(text).width) + 12; BADGE_WIDTHS.set(key, w); if (BADGE_WIDTHS.size > 64) BADGE_WIDTHS.delete(BADGE_WIDTHS.keys().next().value); } rect(c, x - w / 2, y - size, w, size + 7, INK); rect(c, x - w / 2 + 1, y - size + 1, w - 2, size + 5, color); c.fillStyle = INK; c.textAlign = 'center'; c.fillText(text, x, y + 1); }
export function drawFighterPortrait(canvas, characterId) {
  const c = canvas.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.imageSmoothingEnabled = false;
  rect(c, 0, 0, canvas.width, canvas.height, '#e9e9d6'); rect(c, 0, canvas.height - 22, canvas.width, 22, '#d0d7be');
  for (let x = 6; x < canvas.width; x += 18) { rect(c, x, 8 + x % 31, 2, 2, '#c4ceb2'); rect(c, x + 5, canvas.height - 16, 12, 1, '#f6f2dc'); }
  oval(c, canvas.width / 2, canvas.height - 22, 36, 6, '#7b947747');
  c.save(); c.translate(canvas.width / 2 - 4, canvas.height * .62); c.scale(1.72, 1.72);
  drawComicSprite(c, { characterId, x: 0, y: 0, facing: 1, action: 'idle', actionFrame: 0 }, 0, true); c.restore();
}
export function drawStagePreview(canvas, stageId) { const c = canvas.getContext('2d'); c.setTransform(canvas.width / 1200, 0, 0, canvas.height / 720, 0, 0); c.imageSmoothingEnabled = false; paintStage(c, stageId); }

export class BrawlRenderer {
  constructor(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d', { alpha: false }); this.backgrounds = new Map(); this.sprites = new Map(); this.lastSprites = [null, null];
    // Static architecture is authored once. Live frames draw two cached sprites.
    for (const id of Object.keys(STAGES)) { const bg = document.createElement('canvas'); bg.width = 1200; bg.height = 720; paintStage(bg.getContext('2d', { alpha: false }), id); this.backgrounds.set(id, bg); }
    this.motion = window.matchMedia('(prefers-reduced-motion: reduce)'); this.resize = this.resize.bind(this); this.observer = new ResizeObserver(this.resize); this.observer.observe(canvas); this.resetEffects(); this.resize();
  }
  resize() { const r = this.canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2); const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr)); if (this.canvas.width !== w) this.canvas.width = w; if (this.canvas.height !== h) this.canvas.height = h; }
  resetEffects() { this.effects = []; this.seen = new Set(); this.order = []; this.trails = [[], []]; this.lastTime = 0; this.lastTick = -1; this.zoom = 1; }
  destroy() { this.observer.disconnect(); this.resetEffects(); this.sprites.clear(); this.backgrounds.clear(); this.lastSprites.fill(null); }
  sprite(f, time, reduced) {
    const pose = comicPose(f, time, reduced), key = `${reduced ? 'still' : 'motion'}/${pose.key}`;
    if (this.lastSprites[f.id]?.key === key) return this.lastSprites[f.id].sprite;
    let sprite = this.sprites.get(key);
    if (sprite) { this.sprites.delete(key); this.sprites.set(key, sprite); this.lastSprites[f.id] = { key, sprite }; return sprite; }
    // Sprout's extended leaf blade exceeds the old 64px half-width. Keep the
    // complete weapon silhouette in the cache so visible reach stays readable.
    sprite = document.createElement('canvas'); sprite.width = SPRITE_WIDTH; sprite.height = SPRITE_HEIGHT;
    const c = sprite.getContext('2d'); c.translate(SPRITE_WIDTH / 2, SPRITE_HEIGHT / 2);
    drawComicSprite(c, { ...f, x: 0, y: 0, facing: 1 }, time, reduced); this.sprites.set(key, sprite);
    if (this.sprites.size > 128) this.sprites.delete(this.sprites.keys().next().value);
    this.lastSprites[f.id] = { key, sprite };
    return sprite;
  }
  observe(state) {
    if (state.tick < this.lastTick) this.resetEffects(); this.lastTick = state.tick;
    for (const e of state.events || []) {
      if (this.seen.has(e.id)) continue; this.seen.add(e.id); this.order.push(e.id); if (this.order.length > 256) this.seen.delete(this.order.shift());
      if (['hit', 'parry', 'block', 'stock', 'explosion', 'respawn', 'jump', 'dodge', 'impact', 'shieldBreak'].includes(e.type) && Number.isFinite(e.x + e.y)) this.effects.push({ ...e, height: state.fighters[e.fighter]?.height || 52, age: 0, life: e.type === 'stock' ? .65 : e.type === 'explosion' ? .32 : e.type === 'jump' || e.type === 'dodge' ? .18 : .24 });
    }
    if (this.effects.length > 32) this.effects.splice(0, this.effects.length - 32);
  }
  render(state, { time = performance.now(), localId = null } = {}) {
    const c = this.ctx, reduced = this.motion.matches, dt = Math.min(.05, Math.max(0, (time - this.lastTime) / 1000)); this.lastTime = time; this.observe(state);
    let extentX = 500, extentY = 310;
    for (const f of state.fighters) if (f.stocks > 0 && f.respawnTicks === 0) { extentX = Math.max(extentX, Math.abs(f.x - 600) + 80); extentY = Math.max(extentY, Math.abs(f.y - 360) + 55); }
    const targetZoom = Math.max(.55, Math.min(1, 570 / extentX, 335 / extentY)); this.zoom += (targetZoom - this.zoom) * (reduced ? 1 : .15);
    const scale = Math.min(this.canvas.width / 1200, this.canvas.height / 720);
    const offsetX = (this.canvas.width - 1200 * scale) / 2, offsetY = (this.canvas.height - 720 * scale) / 2;
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (offsetX > 0 || offsetY > 0 || this.zoom !== 1) rect(c, 0, 0, this.canvas.width, this.canvas.height, '#263b42');
    c.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    if (this.zoom !== 1) rect(c, 0, 0, 1200, 720, state.stageId === 'foundry' ? '#56606a' : state.stageId === 'garden' ? '#91ae91' : '#8c93ab');
    c.save(); c.translate(600, 360); c.scale(this.zoom, this.zoom); c.translate(-600, -360); c.imageSmoothingEnabled = false;
    c.drawImage(this.backgrounds.get(state.stageId) || this.backgrounds.get('rooftop'), 0, 0);
    for (const h of state.hazards || []) this.hazard(c, h, time, reduced);
    for (const p of state.projectiles || []) this.projectile(c, p, time, reduced);
    for (const f of state.fighters) {
      if (f.stocks === 0 || f.respawnTicks > 0 || !f.selected) { this.trails[f.id] = []; continue; }
      this.shadow(c, f, state.platforms); const sprite = this.sprite(f, time, reduced);
      const trail = this.trails[f.id];
      if (!reduced && (f.action === 'dodge' || f.action === 'recovery')) { if (!trail.length || time - trail[trail.length - 1].time > 32) trail.push({ x: f.x, y: f.y, facing: f.facing, sprite, time }); while (trail.length > 3) trail.shift(); }
      let liveTrail = 0;
      if (!reduced) for (const sample of trail) if (time - sample.time < 130) trail[liveTrail++] = sample;
      trail.length = liveTrail;
      for (const t of this.trails[f.id]) { c.save(); c.globalAlpha = .12 * (1 - (time - t.time) / 130); c.translate(Math.round(t.x), Math.round(t.y)); c.scale(t.facing, 1); c.drawImage(t.sprite, -SPRITE_WIDTH / 2, -SPRITE_HEIGHT / 2); c.restore(); }
      if (f.action === 'shield') this.shield(c, f, time, reduced, false);
      c.save(); c.translate(Math.round(f.x), Math.round(f.y)); c.scale(f.facing, 1); c.drawImage(sprite, -SPRITE_WIDTH / 2, -SPRITE_HEIGHT / 2); c.restore();
      if (f.invulnerable) { c.strokeStyle = '#fff0bb'; c.lineWidth = 1.5; c.setLineDash([4, 5]); c.strokeRect(f.x - f.width / 2 - 4, f.y - f.height / 2 - 4, f.width + 8, f.height + 8); c.setLineDash([]); }
      this.move(c, f);
      if (f.action === 'shield') this.shield(c, f, time, reduced, true);
      const labelY = f.y - f.height / 2 - 15; badge(c, f.x, labelY, `P${f.id + 1}`, TEAMS[f.id], 9);
      if (f.id === localId) poly(c, [[f.x - 3, labelY - 17], [f.x + 3, labelY - 17], [f.x, labelY - 12]], '#fff2c8', INK);
    }
    let liveEffects = 0;
    for (const e of this.effects) if ((e.age += dt) < e.life) this.effects[liveEffects++] = e;
    this.effects.length = liveEffects;
    for (const e of this.effects) this.effect(c, e, reduced);
    c.restore();
    for (const f of state.fighters) if (f.respawnTicks > 0 && f.stocks > 0) badge(c, f.id === 0 ? 240 : 960, 53, `P${f.id + 1} / BACK IN ${(f.respawnTicks / 120).toFixed(1)}s`, TEAMS[f.id], 12);
    c.fillStyle = '#f8ead0'; c.font = '10px Consolas, monospace'; c.textAlign = 'left'; c.fillText(STAGES[state.stageId]?.name?.toUpperCase() || '', 26, 698);
    c.textAlign = 'right'; c.fillText('BUILD DAMAGE / KEEP YOUR RECOVERY', 1174, 698);
  }
  shadow(c, f, platforms = []) {
    const feet = f.y + f.height / 2; let ground = f.grounded ? feet : Infinity;
    if (!f.grounded) for (const p of platforms) if (f.x >= p.x && f.x <= p.x + p.w && p.y >= feet && p.y < ground) ground = p.y;
    if (!Number.isFinite(ground) || ground - feet > 230) return;
    const fade = clamp(1 - (ground - feet) / 250, 0, 1); oval(c, f.x + 3, ground + 2, f.width * .62 * fade, 3, '#263c4150');
  }
  shield(c, f, time, reduced, front) {
    const color = f.shield < 24 ? '#ebad7f' : TEAMS[f.id], r = Math.max(f.width, f.height) / 2 + 8;
    if (!front) { oval(c, f.x, f.y, r * .82, r, color + '17'); return; }
    c.save(); c.strokeStyle = color; c.lineWidth = 2; c.setLineDash([9, 2]); c.beginPath(); c.ellipse(f.x, f.y, r * .82, r, 0, 0, Math.PI * 2); c.stroke(); c.setLineDash([]); line(c, [[f.x - r * .55, f.y - r * .64], [f.x - r * .69, f.y - r * .28]], '#fff0c5', 2);
    if (f.shieldTicks < 7) star(c, f.x + f.facing * (r * .65), f.y - 9, 7, 3, '#fff6cd', color);
    rect(c, f.x - 20, f.y + r + 6, 40, 4, INK); rect(c, f.x - 19, f.y + r + 7, Math.max(0, 38 * f.shield / 100), 2, color); c.restore();
  }
  move(c, f) {
    if (!f.move || !['attack', 'special', 'recovery'].includes(f.action)) return;
    const m = f.move, active = f.actionFrame >= m.startup && f.actionFrame < m.startup + m.active;
    if (!active) { if (f.actionFrame < m.startup) star(c, f.x + f.facing * (f.width / 2 + 6), f.y - 10, 4, 2, '#fff2c5'); return; }
    if (m.kind === 'projectile') return;
    const color = CHARACTERS[f.characterId]?.color || '#ffe0a1'; c.save(); c.globalAlpha = .78;
    if (m.kind === 'burst' || m.kind === 'slam' || m.direction === 'neutral' && m.airborne) { oval(c, f.x, f.y, m.reach, m.reach, null, color, 2); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; rect(c, f.x + Math.cos(a) * m.reach - 2, f.y + Math.sin(a) * m.reach - 2, 3, 3, '#fff1c7'); } }
    else if (m.direction === 'up' || m.kind === 'recovery') { line(c, [[f.x - 14, f.y - 10], [f.x - 11, f.y - m.reach * .65], [f.x, f.y - m.reach], [f.x + 11, f.y - m.reach * .65]], color, 3); line(c, [[f.x - 10, f.y - m.reach * .64], [f.x, f.y - m.reach + 3]], '#fff2cd', 1); }
    else if (m.direction === 'down' && m.airborne) { line(c, [[f.x - 11, f.y + m.reach * .48], [f.x, f.y + m.reach], [f.x + 11, f.y + m.reach * .48]], color, 3); }
    else { const x = f.x + f.facing * m.reach, left = f.x + f.facing * 20; if (f.characterId === 'zap') line(c, [[left, f.y - 10], [x - f.facing * 7, f.y - 6], [x - f.facing * 15, f.y + 3], [x, f.y + 8]], '#ffe9a1', 3); else { line(c, [[left, f.y - 18], [x - f.facing * 9, f.y - 11], [x, f.y + 1], [x - f.facing * 6, f.y + 17]], color, 3); line(c, [[x - f.facing * 8, f.y - 9], [x - f.facing * 2, f.y + 2], [x - f.facing * 6, f.y + 11]], '#fff0c9', 1); } }
    c.restore();
  }
  projectile(c, p, time, reduced) {
    c.save(); c.translate(Math.round(p.x), Math.round(p.y));
    if (p.kind === 'wrench') { c.rotate(reduced ? Math.atan2(p.vy, p.vx) : time / 80); drawWrench(c, 0, 0, .55); }
    else if (p.kind === 'leaf') { c.rotate(Math.atan2(p.vy, p.vx)); poly(c, [[-12, 0], [-3, -7], [7, -6], [13, 0], [3, 7], [-7, 5]], '#cfe0a1', INK, 1.5); line(c, [[-9, 0], [9, 0]], '#fff2bb', 1); line(c, [[-2, 0], [2, -4]], '#73945f'); }
    else if (p.kind === 'parcel') { c.rotate(reduced ? 0 : Math.floor(time / 90) * .45); rect(c, -10, -10, 20, 20, INK); rect(c, -9, -9, 18, 18, '#bd8f5f'); rect(c, -2, -9, 4, 18, '#ead6a8'); rect(c, -8, -4, 5, 4, '#fff0d0'); rect(c, 5, 4, 3, 3, '#916443'); }
    else { line(c, [[-13, -3], [-5, 3], [0, -4], [10, 1], [14, -2]], INK, 5); line(c, [[-13, -3], [-5, 3], [0, -4], [10, 1], [14, -2]], '#ffe99b', 3); rect(c, 0, -2, 6, 2, '#fff8d5'); }
    c.restore();
  }
  hazard(c, h, time, reduced) {
    const warning = h.phase === 'warning';
    if (h.type === 'wind') { badge(c, 600, 80, warning ? h.direction > 0 ? 'CROSSWIND INCOMING →' : '← CROSSWIND INCOMING' : h.direction > 0 ? 'CROSSWIND →' : '← CROSSWIND', '#ebd8ab', 11); if (!warning) for (let i = 0; i < 4; i++) { const x = 220 + i * 210 + (reduced ? 0 : (time / 7) % 60); line(c, [[x, 130 + i * 54], [x + h.direction * 42, 130 + i * 54]], '#edf0d333', 2); } return; }
    rect(c, h.x, h.y + h.h - 5, h.w, 5, warning ? '#e6b875' : '#edd7aa');
    if (warning) { c.strokeStyle = '#f4c887'; c.lineWidth = 2; c.setLineDash([7, 5]); c.strokeRect(h.x, h.y, h.w, h.h); c.setLineDash([]); badge(c, h.x + h.w / 2, h.y - 14, h.type === 'steam' ? 'STEAM!' : 'SPLASH!', '#f4d3a0', 10); }
    else { const color = h.type === 'steam' ? '#eee8ce' : '#b6dfd5'; for (let i = 0; i < 6; i++) { const dy = reduced ? 0 : Math.floor(time / 65 + i) % 3 * 4; rect(c, h.x + i * h.w / 6 + 2, h.y + 9 + (i % 3) * 15 + dy, Math.max(3, h.w / 6 - 5), h.h - 17 - (i % 3) * 15 - dy, color + '49'); } line(c, [[h.x + h.w / 2, h.y + 8], [h.x + h.w / 2, h.y + h.h - 12]], color + '87', 2); }
  }
  effect(c, e, reduced) {
    const t = e.age / e.life, color = TEAMS[e.fighter] || '#fff0c6'; c.save(); c.globalAlpha = 1 - t;
    if (e.type === 'stock') badge(c, clamp(e.x, 90, 1110), clamp(e.y, 110, 630) - (reduced ? 0 : t * 12), 'OUT!', color, 22);
    else if (e.type === 'hit' || e.type === 'impact') { const r = e.type === 'impact' ? 9 : 12 + Math.min(11, e.damage || 6); star(c, e.x, e.y, reduced ? r : r * (1 + t * .35), r * .3, '#ffe4a2', INK); star(c, e.x, e.y, r * .4, r * .2, '#fff3cc'); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + .4; rect(c, e.x + Math.cos(a) * (r + 6 + (reduced ? 0 : t * 12)), e.y + Math.sin(a) * (r + 6 + (reduced ? 0 : t * 12)), 3, 3, color); } }
    else if (e.type === 'parry' || e.type === 'shieldBreak' || e.type === 'block') { const r = e.type === 'block' ? 12 : 23 + (reduced ? 0 : t * 13); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; line(c, [[e.x + Math.cos(a) * r * .65, e.y + Math.sin(a) * r * .65], [e.x + Math.cos(a) * r, e.y + Math.sin(a) * r]], e.type === 'shieldBreak' ? '#eeaf87' : '#fff2c0', 2); } }
    else if (e.type === 'jump' || e.type === 'dodge') { const y = e.y + e.height / 2; for (let i = 0; i < 4; i++) { const offset = (i - 1.5) * (7 + (reduced ? 0 : t * 13)); rect(c, e.x + offset, y - 2 - i % 2 * 3, 5 - t * 2, 3, '#eee0bd'); } }
    else if (e.type === 'explosion') { const r = reduced ? e.radius || 85 : 10 + t * ((e.radius || 85) - 10); oval(c, e.x, e.y, r, r, null, '#ffcc93', 3); if (t < .3) star(c, e.x, e.y, 18, 7, '#fff1c1', '#cc946e'); }
    else if (e.type === 'respawn') { oval(c, e.x, e.y, 22, 32, null, '#fff0b8', 2); star(c, e.x - 17, e.y - 27, 6, 2, '#fff0b8'); }
    c.restore();
  }
}
