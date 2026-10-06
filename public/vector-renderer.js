import { WORLD, COVERS, WEAPON, DASH } from './vector-engine.js';

const COLORS = [
  { main: '#eeb07b', light: '#ffe1af', dark: '#956043', suit: '#684c3b' },
  { main: '#8ac7a3', light: '#d4f5c3', dark: '#497866', suit: '#385e52' },
];
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
function path(ctx, points, color, width = 1) {
  ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
}
function polygon(ctx, points, color) {
  ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
}
function rng(seed) {
  let value = seed >>> 0;
  return () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 4294967296; };
}
function ring(ctx, x, y, radius, color, width = 1) {
  ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
}

/** Render-only effects; cover footprints and player radii come from the engine. */
export class VectorRenderer {
  constructor(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d', { alpha: false });
    this.background = document.createElement('canvas');
    this.background.width = WORLD.width; this.background.height = WORLD.height;
    this.paintBackground(this.background.getContext('2d'));
    this.resize = this.resize.bind(this);
    this.observer = new ResizeObserver(this.resize); this.observer.observe(canvas);
    this.resetEffects(); this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
  }

  resetEffects() {
    this.particles = []; this.rings = []; this.ghosts = []; this.seen = new Set();
    this.eventOrder = []; this.lastTick = -1; this.lastTime = 0; this.lastGhost = [-1, -1]; this.hitFlash = [0, 0];
  }

  destroy() { this.observer.disconnect(); this.resetEffects(); }

  paintBackground(ctx) {
    const random = rng(44108), { width, height, wall } = WORLD;
    ctx.fillStyle = '#132f28'; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#243f35'; ctx.fillRect(wall, wall, width - wall * 2, height - wall * 2);
    // Low contrast floor panels keep orange and mint projectiles easy to see.
    for (let y = wall; y < height - wall; y += 48) for (let x = wall; x < width - wall; x += 48) {
      ctx.fillStyle = random() > .4 ? '#29463a' : '#2c483a'; ctx.fillRect(x + 1, y + 1, 46, 46);
      ctx.fillStyle = '#6d866927'; ctx.fillRect(x + 2, y + 1, 43, 1);
      ctx.fillStyle = '#152f2a77'; ctx.fillRect(x + 45, y + 2, 2, 44);
      if (random() > .55) { ctx.fillStyle = '#7c936b16'; ctx.fillRect(x + 10, y + 13, 22, 2); }
    }
    // Embedded circuits mark lanes, with exact mirror symmetry for fairness.
    for (const mirror of [false, true]) {
      ctx.save(); if (mirror) { ctx.translate(width, 0); ctx.scale(-1, 1); }
      path(ctx, [[82, 120], [182, 120], [182, 82], [422, 82], [422, 140]], '#719b7040', 2);
      path(ctx, [[82, 520], [182, 520], [182, 558], [422, 558], [422, 500]], '#719b7040', 2);
      path(ctx, [[80, 288], [156, 288], [170, 304]], '#5f9e7950', 2);
      path(ctx, [[80, 352], [156, 352], [170, 336]], '#5f9e7950', 2);
      for (const y of [82, 558]) { ctx.fillStyle = '#8bac7155'; ctx.fillRect(411, y - 3, 6, 6); }
      ctx.restore();
    }
    ctx.fillStyle = '#244339'; ctx.fillRect(425, 270, 110, 100);
    ctx.strokeStyle = '#5e887166'; ctx.lineWidth = 1; ctx.strokeRect(425.5, 270.5, 109, 99);
    polygon(ctx, [[480, 293], [507, 320], [480, 347], [453, 320]], '#41654e');
    polygon(ctx, [[480, 302], [498, 320], [480, 338], [462, 320]], '#28473a');
    path(ctx, [[480, 308], [492, 320], [480, 332], [468, 320], [480, 308]], '#b9c18c70', 2);
    ring(ctx, 480, 320, 76, '#9dad7933');
    for (const x of [116, 844]) {
      ring(ctx, x, 320, 46, '#96b47c38');
      ctx.fillStyle = '#90aa6928'; ctx.fillRect(x - 22, 318, 44, 4); ctx.fillRect(x - 2, 298, 4, 44);
    }
    // Stone and foliage stay beyond the walkable wall line.
    for (const y of [0, height - wall]) {
      ctx.fillStyle = '#183b2f'; ctx.fillRect(0, y, width, wall);
      for (let x = 0; x < width; x += 64) {
        ctx.fillStyle = '#355846'; ctx.fillRect(x + 1, y + 2, 61, wall - 4);
        ctx.fillStyle = '#7c997050'; ctx.fillRect(x + 3, y + 2, 58, 2);
      }
    }
    for (const x of [0, width - wall]) {
      ctx.fillStyle = '#214635'; ctx.fillRect(x, wall, wall, height - wall * 2);
      for (let y = wall; y < height - wall; y += 40) {
        ctx.fillStyle = '#3b5b42'; ctx.fillRect(x + 2, y + 2, wall - 4, 37);
      }
    }
    for (const [x, y] of [[10, 10], [width - 10, 10], [10, height - 10], [width - 10, height - 10]]) {
      for (let i = 0; i < 30; i++) {
        const px = x + (random() - .5) * 90, py = y + (random() - .5) * 76;
        const size = 8 + random() * 11;
        ctx.fillStyle = ['#193c2c', '#264f33', '#34593a', '#416342'][i % 4];
        ctx.fillRect(Math.round(px), Math.round(py), size, size);
        ctx.fillStyle = '#77955a2c'; ctx.fillRect(Math.round(px), Math.round(py), size - 2, 2);
      }
    }
    ctx.fillStyle = '#b2c28b'; ctx.font = '9px monospace'; ctx.textAlign = 'center';
    ctx.fillText('V E C T O R  / /  O V E R G R O W N   G R I D', width / 2, 20);
  }

  paintCover(ctx, cover) {
    const { x, y, w, h } = cover;
    ctx.fillStyle = '#102a2344'; ctx.fillRect(x + 5, y + 6, w, h);
    // The solid rectangular footprint exactly matches engine collision.
    ctx.fillStyle = '#18372d'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#57735a'; ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    ctx.fillStyle = '#89a175'; ctx.fillRect(x + 2, y + 2, w - 4, 4);
    ctx.fillStyle = '#6c8a63'; ctx.fillRect(x + 2, y + 6, 5, h - 8);
    ctx.fillStyle = '#314f3d'; ctx.fillRect(x + w - 7, y + 6, 5, h - 8); ctx.fillRect(x + 7, y + h - 7, w - 14, 5);
    ctx.strokeStyle = '#314c37'; ctx.lineWidth = 2;
    ctx.strokeRect(x + 12, y + 12, w - 24, h - 24);
    ctx.fillStyle = '#405c44'; ctx.fillRect(x + 15, y + 15, w - 30, h - 30);
    for (const dx of [6, w - 9]) for (const dy of [8, h - 11]) { ctx.fillStyle = '#bbbf83'; ctx.fillRect(x + dx, y + dy, 3, 3); }
    const cx = x + w / 2, cy = y + h / 2;
    path(ctx, [[cx - 10, cy], [cx, cy - 8], [cx + 10, cy], [cx, cy + 8], [cx - 10, cy]], '#8db579', 2);
    ctx.fillStyle = '#c4d69c'; ctx.fillRect(cx - 2, cy - 2, 4, 4);
    ctx.fillStyle = '#658556'; ctx.fillRect(x + w - 20, y + 7, 10, 6); ctx.fillRect(x + w - 13, y + 12, 9, 9);
  }

  observeEvents(state) {
    if (state.tick < this.lastTick) this.resetEffects(); this.lastTick = state.tick;
    for (const event of state.events || []) {
      if (this.seen.has(event.id)) continue;
      this.seen.add(event.id); this.eventOrder.push(event.id);
      if (this.eventOrder.length > 512) this.seen.delete(this.eventOrder.shift());
      const color = COLORS[event.fighter ?? event.owner ?? 0]?.light || '#e1f1b9';
      if (event.type === 'dash') this.rings.push({ x: event.x, y: event.y, radius: 18, age: 0, life: .3, color });
      if (event.type === 'hit' && event.target != null) this.hitFlash[event.target] = .14;
      if (!['fire', 'hit', 'cover', 'reloaded'].includes(event.type) || !Number.isFinite(event.x + event.y)) continue;
      const count = event.type === 'hit' ? 12 : event.type === 'cover' ? 8 : 4;
      for (let i = 0; i < count; i++) {
        const angle = (event.id * .79 + i * 2.4) % (Math.PI * 2), speed = event.type === 'hit' ? 50 + i * 5 : 25 + i * 10;
        this.particles.push({ x: event.x, y: event.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, age: 0, life: .2 + (i % 3) * .07, color: event.type === 'cover' ? '#c6dca0' : color });
      }
    }
    if (this.particles.length > 150) this.particles.splice(0, this.particles.length - 150);
    if (this.rings.length > 12) this.rings.splice(0, this.rings.length - 12);
  }

  paintFighter(ctx, fighter, time, ghost = false) {
    const color = COLORS[fighter.id];
    ctx.save(); ctx.translate(fighter.x, fighter.y);
    if (!ghost) {
      ctx.fillStyle = '#061f1c66'; ctx.beginPath(); ctx.ellipse(2, 4, 18, 15, 0, 0, Math.PI * 2); ctx.fill();
      if (fighter.dashTicks > 0) {
        ring(ctx, 0, 0, fighter.radius + 5, fighter.invulnerable ? color.light : '#eabb7280', 2);
        if (!fighter.invulnerable && fighter.dashFrame <= DASH.invulnerableStart) path(ctx, [[0, 0], [fighter.dashX * 44, fighter.dashY * 44]], color.main, 2);
      }
      if (fighter.action === 'focus') ring(ctx, 0, 0, fighter.radius + 6, color.main + '70');
    }
    ctx.rotate(fighter.facing);
    if (ghost) ctx.globalAlpha = .3;
    if (fighter.hp <= 0) ctx.globalAlpha = .45;
    const stride = fighter.action === 'run' ? Math.sin(time / 75) * 3 : 0;
    ctx.fillStyle = '#102923'; ctx.fillRect(-12 - stride, -13, 14, 8); ctx.fillRect(-12 + stride, 5, 14, 8);
    ctx.fillStyle = color.suit; ctx.fillRect(-13, -10, 24, 20);
    polygon(ctx, [[-14, -7], [-7, -14], [7, -14], [14, -7], [14, 7], [7, 14], [-7, 14], [-14, 7]], this.hitFlash[fighter.id] > 0 && !ghost ? '#fff0c7' : color.dark);
    ctx.fillStyle = color.main; ctx.fillRect(-10, -11, 17, 22);
    ctx.fillStyle = color.light; ctx.fillRect(-8, -10, 12, 3);
    ctx.fillStyle = color.suit; ctx.fillRect(-9, -6, 9, 12);
    ctx.fillStyle = color.light; ctx.fillRect(-7, -4, 2, 8);
    ctx.fillStyle = '#172e28'; ctx.fillRect(2, -8, 10, 16);
    ctx.fillStyle = '#8aa591'; ctx.fillRect(5, -6, 7, 12);
    ctx.fillStyle = '#dbedcf'; ctx.fillRect(9, -5, 3, 10);
    ctx.fillStyle = '#133229'; ctx.fillRect(8, -4, 17, 8);
    ctx.fillStyle = '#7e9685'; ctx.fillRect(11, -3, 12, 2);
    ctx.fillStyle = color.main; ctx.fillRect(22, -3, 4, 6);
    if (!ghost && fighter.shotCooldown > WEAPON.shotTicks - 5) {
      polygon(ctx, [[27, -6], [38, 0], [27, 6], [30, 0]], color.light);
    }
    ctx.restore();
  }

  render(state, { localId = null, time = performance.now(), aimTarget = null } = {}) {
    const ctx = this.ctx, dt = Math.min(.05, Math.max(0, (time - this.lastTime) / 1000)); this.lastTime = time;
    this.observeEvents(state);
    ctx.setTransform(this.canvas.width / WORLD.width, 0, 0, this.canvas.height / WORLD.height, 0, 0);
    ctx.imageSmoothingEnabled = false; ctx.drawImage(this.background, 0, 0);
    for (const fighter of state.fighters) if (fighter.dashTicks > 0 && fighter.dashFrame > DASH.invulnerableStart && this.lastGhost[fighter.id] !== state.tick) {
      this.ghosts.push({ fighter: { ...fighter }, age: 0 }); this.lastGhost[fighter.id] = state.tick;
    }
    if (this.ghosts.length > 32) this.ghosts.splice(0, this.ghosts.length - 32);
    this.ghosts = this.ghosts.filter(ghost => (ghost.age += dt) < .18);
    for (const ghost of this.ghosts) { ctx.save(); ctx.globalAlpha = 1 - ghost.age / .18; this.paintFighter(ctx, ghost.fighter, time, true); ctx.restore(); }
    for (const cover of state.obstacles || COVERS) this.paintCover(ctx, cover);
    for (const projectile of state.projectiles || []) {
      const color = COLORS[projectile.owner] || COLORS[0], speed = Math.hypot(projectile.vx, projectile.vy) || 1;
      path(ctx, [[projectile.x - projectile.vx / speed * 21, projectile.y - projectile.vy / speed * 21], [projectile.x, projectile.y]], color.main + 'aa', 3);
      ctx.fillStyle = color.light; ctx.fillRect(projectile.x - 3, projectile.y - 3, 6, 6);
    }
    for (const fighter of state.fighters) this.paintFighter(ctx, fighter, time);
    this.rings = this.rings.filter(effect => (effect.age += dt) < effect.life);
    for (const effect of this.rings) { ctx.save(); ctx.globalAlpha = 1 - effect.age / effect.life; ring(ctx, effect.x, effect.y, effect.radius + effect.age * 90, effect.color, 2); ctx.restore(); }
    this.particles = this.particles.filter(particle => (particle.age += dt) < particle.life);
    for (const particle of this.particles) {
      particle.x += particle.vx * dt; particle.y += particle.vy * dt;
      ctx.globalAlpha = 1 - particle.age / particle.life; ctx.fillStyle = particle.color; ctx.fillRect(particle.x - 2, particle.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1; this.hitFlash = this.hitFlash.map(value => Math.max(0, value - dt));
    if (localId != null) this.paintLocalHUD(ctx, state.fighters[localId], aimTarget, state.phase);
    else {
      ctx.fillStyle = '#b9c7a0'; ctx.textAlign = 'center'; ctx.font = '9px monospace';
      ctx.fillText('AIM  /  STRAFE  /  CONTROL YOUR ANGLE', WORLD.width / 2, 627);
    }
  }

  paintLocalHUD(ctx, fighter, target, phase) {
    const color = COLORS[fighter.id], ammo = WEAPON.magazine;
    // A solid body outline communicates the exact 16px hit radius.
    ring(ctx, fighter.x, fighter.y, fighter.radius, color.light + '80');
    if (phase === 'fight' && fighter.hp > 0) {
      const x = target?.x ?? fighter.x + fighter.aimX * 95, y = target?.y ?? fighter.y + fighter.aimY * 95;
      const spread = fighter.action === 'focus' ? 6 : 10;
      path(ctx, [[x - spread - 6, y], [x - spread, y]], color.light, 2);
      path(ctx, [[x + spread, y], [x + spread + 6, y]], color.light, 2);
      path(ctx, [[x, y - spread - 6], [x, y - spread]], color.light, 2);
      path(ctx, [[x, y + spread], [x, y + spread + 6]], color.light, 2);
      ctx.fillStyle = color.light; ctx.fillRect(x - 1, y - 1, 2, 2);
    }
    ctx.fillStyle = '#153129'; ctx.fillRect(277, 608, 406, 32);
    ctx.fillStyle = '#c0cbb0'; ctx.font = '9px monospace'; ctx.textAlign = 'left'; ctx.fillText('MAG', 294, 626);
    for (let i = 0; i < ammo; i++) {
      ctx.fillStyle = i < fighter.ammo ? color.main : '#3c5546'; ctx.fillRect(321 + i * 10, 617, 6, 10);
    }
    if (fighter.reloadTicks > 0) {
      const progress = 1 - fighter.reloadTicks / fighter.reloadDuration;
      ctx.fillStyle = '#3c5546'; ctx.fillRect(397, 618, 80, 7);
      ctx.fillStyle = color.main; ctx.fillRect(397, 618, 80 * clamp(progress, 0, 1), 7);
      ctx.fillStyle = '#c0cbb0'; ctx.fillText('RELOAD', 484, 625);
    } else { ctx.fillStyle = '#a5b597'; ctx.fillText(fighter.action === 'focus' ? 'FOCUS / PRECISE' : 'R / RELOAD', 397, 626); }
    ctx.fillStyle = fighter.stamina >= DASH.cost ? '#c0cbb0' : '#987c59';
    ctx.fillText('DASH', 548, 626);
    ctx.fillStyle = '#3c5546'; ctx.fillRect(584, 619, 79, 6);
    ctx.fillStyle = color.main; ctx.fillRect(584, 619, 79 * clamp(fighter.stamina / 100, 0, 1), 6);
  }
}
