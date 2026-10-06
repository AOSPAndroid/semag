const WIDTH = 1200;
const HEIGHT = 600;
const FLOOR = 470;
const COLORS = [
  { main: '#b6f36a', light: '#e2ffbd', dark: '#638748', suit: '#283c3a', shade: '#172a2b', accent: '#dfff9b' },
  { main: '#bc9bff', light: '#e9ddff', dark: '#785d9e', suit: '#34354e', shade: '#21243b', accent: '#d9c4ff' },
];
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const mix = (a, b, t) => a + (b - a) * t;
const ease = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

function polygon(ctx, points, fill, stroke, width = 1) {
  ctx.beginPath();
  points.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}
function line(ctx, points, color, width = 1) {
  ctx.beginPath();
  points.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}
function segment(ctx, a, b, widthA, widthB, fill, edge) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length, ny = dx / length;
  polygon(ctx, [
    [a[0] + nx * widthA / 2, a[1] + ny * widthA / 2],
    [b[0] + nx * widthB / 2, b[1] + ny * widthB / 2],
    [b[0] - nx * widthB / 2, b[1] - ny * widthB / 2],
    [a[0] - nx * widthA / 2, a[1] - ny * widthA / 2],
  ], fill, edge, 1);
}
function seeded(seed) {
  let value = seed >>> 0;
  return () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 4294967296; };
}

export class ArenaRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.background = document.createElement('canvas');
    this.background.width = WIDTH * 2;
    this.background.height = HEIGHT * 2;
    const bg = this.background.getContext('2d');
    bg.scale(2, 2);
    this.drawBackground(bg);
    this.particles = [];
    this.rings = [];
    this.seenEvents = new Set();
    this.lastTick = -1;
    this.lastTime = 0;
    this.shake = 0;
    this.flash = 0;
    this.ghosts = [];
    this.ghostTick = [-1, -1];
    this.resize = this.resize.bind(this);
    this.resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(this.resize) : null;
    this.resizeObserver?.observe(canvas);
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(Math.max(rect.width, 1) * dpr);
    const height = Math.round(Math.max(rect.height, 1) * dpr);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  destroy() {
    this.resizeObserver?.disconnect();
    this.resetEffects();
  }

  resetEffects() {
    this.particles = [];
    this.rings = [];
    this.ghosts = [];
    this.seenEvents.clear();
    this.ghostTick = [-1, -1];
    this.lastTick = -1;
    this.lastTime = 0;
    this.shake = 0;
    this.flash = 0;
  }

  drawBackground(ctx) {
    const sky = ctx.createLinearGradient(0, 0, 0, 460);
    sky.addColorStop(0, '#101923');
    sky.addColorStop(0.42, '#233a46');
    sky.addColorStop(0.76, '#405660');
    sky.addColorStop(1, '#53615b');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Long clouds and haze leave a clear middle for the fighters.
    const cloud = ctx.createLinearGradient(0, 70, 0, 255);
    cloud.addColorStop(0, '#86919c00');
    cloud.addColorStop(0.5, '#74848918');
    cloud.addColorStop(1, '#60788600');
    ctx.fillStyle = cloud;
    ctx.fillRect(0, 70, WIDTH, 185);
    const rng = seeded(30127);
    for (let i = 0; i < 35; i++) {
      const x = rng() * WIDTH, y = 32 + rng() * 200;
      ctx.fillStyle = `rgba(158, 180, 186, ${0.015 + rng() * 0.025})`;
      ctx.fillRect(x, y, 100 + rng() * 320, 1 + rng() * 3);
    }
    for (let i = 0; i < 65; i++) {
      const x = rng() * WIDTH, y = 8 + rng() * 158;
      ctx.fillStyle = `rgba(226, 242, 228, ${0.08 + rng() * 0.22})`;
      ctx.fillRect(x, y, 1, 1);
    }

    const moonHalo = ctx.createRadialGradient(909, 92, 7, 909, 92, 100);
    moonHalo.addColorStop(0, '#dce3c923');
    moonHalo.addColorStop(1, '#dce3c900');
    ctx.fillStyle = moonHalo;
    ctx.fillRect(805, 0, 210, 200);
    ctx.fillStyle = '#c9d6c5';
    ctx.beginPath(); ctx.arc(909, 92, 23, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#243a47';
    ctx.beginPath(); ctx.arc(901, 84, 22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#60778320';
    ctx.fillRect(780, 90, 248, 5);

    // Three layers of individually articulated city buildings.
    this.cityLayer(ctx, seeded(920), 0, '#31444d', 80, 285, 367, false);
    this.cityLayer(ctx, seeded(624), -34, '#23353e', 54, 230, 392, true);
    this.cityLayer(ctx, seeded(1139), -62, '#1c2c35', 87, 285, 408, true);

    // Distant elevated track, rooftop antennae and overhead cable silhouettes.
    ctx.fillStyle = '#192a31';
    ctx.fillRect(0, 355, WIDTH, 7);
    for (let x = 25; x < WIDTH; x += 130) {
      ctx.fillRect(x, 360, 8, 48);
      line(ctx, [[x + 8, 367], [x + 42, 397]], '#22353b', 4);
    }
    line(ctx, [[0, 311], [1200, 311]], '#4f626244', 1);
    ctx.strokeStyle = '#14242a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-50, 48); ctx.quadraticCurveTo(290, 130, 627, 39); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(718, -10); ctx.quadraticCurveTo(1009, 105, 1245, 27); ctx.stroke();
    line(ctx, [[74, 169], [74, 53]], '#14272e', 3);
    line(ctx, [[60, 69], [90, 69]], '#1b2d35', 2);
    line(ctx, [[66, 81], [86, 81]], '#1b2d35', 2);
    line(ctx, [[74, 95], [119, 125]], '#17282f', 1);

    // Left utility tower and a quiet illuminated district number.
    polygon(ctx, [[0, 220], [81, 220], [103, 240], [103, 400], [0, 400]], '#182831');
    ctx.fillStyle = '#21343c'; ctx.fillRect(0, 238, 90, 162);
    for (let y = 259; y < 375; y += 17) {
      ctx.fillStyle = '#0f2129'; ctx.fillRect(12, y, 63, 5);
      ctx.fillStyle = '#34474c'; ctx.fillRect(12, y + 5, 63, 1);
    }
    ctx.fillStyle = '#121f27'; ctx.fillRect(1137, 203, 63, 202);
    ctx.fillStyle = '#22323b'; ctx.fillRect(1149, 207, 51, 192);
    line(ctx, [[1172, 202], [1172, 127], [1191, 127]], '#17262e', 4);
    line(ctx, [[1152, 220], [1147, 185]], '#1c2c33', 3);
    ctx.shadowColor = '#c0d983'; ctx.shadowBlur = 15;
    ctx.fillStyle = '#b4c996'; ctx.font = 'bold 22px monospace'; ctx.fillText('09', 1159, 253);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#758970'; ctx.font = '7px monospace'; ctx.fillText('SECTOR', 1154, 268);

    // Atmospheric horizon mist softens the skyline.
    const mist = ctx.createLinearGradient(0, 304, 0, 426);
    mist.addColorStop(0, '#87aaa900');
    mist.addColorStop(0.55, '#92b3ad20');
    mist.addColorStop(1, '#56716f00');
    ctx.fillStyle = mist; ctx.fillRect(100, 304, 1025, 122);

    // Rooftop retaining rail.
    ctx.fillStyle = '#1b2d32'; ctx.fillRect(0, 391, WIDTH, 15);
    ctx.fillStyle = '#50635d'; ctx.fillRect(0, 390, WIDTH, 2);
    ctx.fillStyle = '#29403d'; ctx.fillRect(0, 406, WIDTH, 4);
    for (let x = 118; x < 1118; x += 172) {
      ctx.fillStyle = '#182a2e'; ctx.fillRect(x, 362, 6, 28);
      ctx.fillStyle = '#5c7367'; ctx.fillRect(x, 361, 6, 2);
    }
    line(ctx, [[118, 371], [1151, 371]], '#233b3b', 3);
    line(ctx, [[118, 371], [1151, 371]], '#65807444', 1);

    // Main platform: perspective grooves, inset metal plates, weathered front face.
    const floor = ctx.createLinearGradient(0, 407, 0, FLOOR);
    floor.addColorStop(0, '#33463f'); floor.addColorStop(1, '#263632');
    ctx.fillStyle = floor; ctx.fillRect(0, 410, WIDTH, 60);
    line(ctx, [[0, 410], [WIDTH, 410]], '#87917836', 1);
    for (let x = -400; x <= 1700; x += 145) {
      const startX = 600 + (x - 600) * 0.70;
      line(ctx, [[startX, 410], [x, 470]], '#101e2260', 1);
      line(ctx, [[startX + 2, 410], [x + 2, 470]], '#6a7b6130', 1);
    }
    for (const y of [418, 431, 449, 464]) {
      line(ctx, [[0, y], [WIDTH, y]], '#0f232542', 1);
      line(ctx, [[0, y + 1], [WIDTH, y + 1]], '#69735c25', 1);
    }
    ctx.fillStyle = '#1c2e2a'; ctx.fillRect(21, 439, 93, 20); ctx.fillRect(1086, 439, 93, 20);
    for (let i = 0; i < 9; i++) {
      line(ctx, [[25 + i * 10, 443], [25 + i * 10, 456]], '#435447', 3);
      line(ctx, [[1090 + i * 10, 443], [1090 + i * 10, 456]], '#435447', 3);
    }
    const face = ctx.createLinearGradient(0, 470, 0, 600);
    face.addColorStop(0, '#1a2b2b'); face.addColorStop(0.22, '#111f24'); face.addColorStop(1, '#101a22');
    ctx.fillStyle = face; ctx.fillRect(0, 470, WIDTH, 130);
    ctx.fillStyle = '#82927c'; ctx.fillRect(0, 468, WIDTH, 2);
    ctx.fillStyle = '#0c191e'; ctx.fillRect(0, 476, WIDTH, 5);
    for (let x = -15; x < WIDTH; x += 152) {
      ctx.fillStyle = '#1e3030'; ctx.fillRect(x, 487, 134, 73);
      ctx.strokeStyle = '#3a494233'; ctx.strokeRect(x + 1, 488, 132, 71);
      ctx.fillStyle = '#17272b'; ctx.fillRect(x + 5, 496, 124, 57);
      for (const dx of [8, 124]) {
        ctx.fillStyle = '#57665c'; ctx.fillRect(x + dx, 490, 2, 2); ctx.fillRect(x + dx, 554, 2, 2);
      }
      ctx.fillStyle = '#92bf70'; ctx.fillRect(x + 36, 475, 51, 2);
      ctx.shadowColor = '#b6f36a'; ctx.shadowBlur = 10; ctx.fillStyle = '#b3d887'; ctx.fillRect(x + 45, 475, 33, 2); ctx.shadowBlur = 0;
    }
    ctx.fillStyle = '#80917360'; ctx.font = '8px monospace';
    ctx.fillText('CAUTION // HIGH VOLTAGE', 31, 543);
    ctx.fillStyle = '#50645452'; ctx.fillText('PLATFORM 009 · RESTRICTED ACCESS', 500, 543);
    ctx.fillText('NIGHT SHIFT / 21:08', 1014, 543);
    for (let i = 0; i < 100; i++) {
      ctx.fillStyle = `rgba(151, 160, 138, ${rng() * 0.07})`;
      ctx.fillRect(rng() * WIDTH, 412 + rng() * 176, 1 + rng() * 25, 1);
    }
    const vignette = ctx.createRadialGradient(600, 295, 200, 600, 290, 710);
    vignette.addColorStop(0, '#070e1600'); vignette.addColorStop(0.7, '#070e1610'); vignette.addColorStop(1, '#070e1682');
    ctx.fillStyle = vignette; ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  cityLayer(ctx, rng, start, fill, avgWidth, minY, base, windows) {
    let x = start;
    while (x < WIDTH) {
      const w = avgWidth * (0.5 + rng() * 0.9);
      const y = minY + rng() * 90;
      ctx.fillStyle = fill; ctx.fillRect(x, y, w, base - y);
      if (rng() > 0.46) {
        ctx.fillRect(x + w * 0.18, y - 7, w * 0.64, 7);
        line(ctx, [[x + w * 0.45, y - 7], [x + w * 0.45, y - 19 - rng() * 37]], fill, 2);
      }
      ctx.fillStyle = '#52605b2c'; ctx.fillRect(x + 1, y, w - 1, 2);
      if (windows) {
        for (let wx = x + 7; wx < x + w - 5; wx += 11) {
          for (let wy = y + 12; wy < base - 6; wy += 13) {
            const light = rng();
            ctx.fillStyle = light > 0.79 ? '#c9ac6e66' : light > 0.67 ? '#adc2b040' : '#50656926';
            ctx.fillRect(wx, wy, 3 + rng() * 2, 5);
          }
        }
        if (rng() > 0.74) {
          ctx.fillStyle = '#819d8433'; ctx.fillRect(x + w - 6, y + 12, 2, base - y - 22);
        }
      }
      x += w + 4 + rng() * 12;
    }
  }

  consumeEvents(state) {
    if (this.lastTick > (state.tick ?? 0)) {
      this.seenEvents.clear(); this.particles = []; this.rings = []; this.ghosts = [];
      this.ghostTick = [-1, -1];
    }
    this.lastTick = state.tick ?? 0;
    for (const event of state.events || []) {
      const key = event.id ?? `${state.tick}:${event.type}:${event.x}:${event.y}`;
      if (this.seenEvents.has(key)) continue;
      this.seenEvents.add(key);
      if (this.seenEvents.size > 600) this.seenEvents.delete(this.seenEvents.values().next().value);
      if (event.tick != null && this.lastTick - event.tick > 48) continue;
      const type = event.type || '';
      const fighter = event.fighter ?? event.attacker ?? 0;
      const color = COLORS[fighter === 1 ? 1 : 0].main;
      const x = event.x ?? state.fighters?.[event.target ?? fighter]?.x ?? 600;
      const y = event.y ?? (state.fighters?.[event.target ?? fighter]?.y ?? FLOOR) - 65;
      if (type === 'hit' || type === 'guardbreak' || type === 'ko') {
        const heavy = (event.damage || 0) >= 18 || type !== 'hit';
        this.emitSparks(x, y, heavy ? 25 : 15, color, heavy ? 1.35 : 1);
        this.rings.push({ x, y, life: 0.18, maxLife: 0.18, color: '#f5ffe6', radius: 36 });
        this.shake = Math.max(this.shake, heavy ? 6 : 3.6);
        this.flash = Math.max(this.flash, heavy ? 0.08 : 0.035);
      } else if (type === 'parry') {
        this.emitSparks(x, y, 32, '#dcffff', 1.4);
        this.rings.push({ x, y, life: 0.35, maxLife: 0.35, color: '#defcff', radius: 65 });
        this.shake = Math.max(this.shake, 4);
        this.flash = 0.075;
      } else if (type === 'block') {
        this.emitSparks(x, y, 10, '#b1d2ed', 0.6);
        this.rings.push({ x, y, life: 0.15, maxLife: 0.15, color: '#c7e0ec', radius: 20 });
        this.shake = Math.max(this.shake, 1.5);
      } else if (type === 'jump' || type === 'land' || type === 'dash') {
        this.emitDust(x, type === 'dash' ? FLOOR - 3 : Math.min(y, FLOOR - 2), type === 'dash' ? 10 : 6);
      }
    }
  }

  emitSparks(x, y, count, color, intensity) {
    const rng = seeded((x * 17 + y * 31 + this.lastTick * 137) | 0);
    for (let i = 0; i < count; i++) {
      const angle = rng() * Math.PI * 2;
      const speed = (65 + rng() * 245) * intensity;
      const life = 0.18 + rng() * 0.26;
      this.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life, maxLife: life, color: i % 4 ? color : '#fffbe0', size: 1 + rng() * 2.2, spark: true });
    }
  }

  emitDust(x, y, count) {
    const rng = seeded((x * 53 + this.lastTick * 31) | 0);
    for (let i = 0; i < count; i++) {
      const life = 0.25 + rng() * 0.25;
      this.particles.push({ x: x + (rng() - 0.5) * 20, y, vx: (rng() - 0.5) * 100, vy: -rng() * 35 - 6, life, maxLife: life, color: '#879b84', size: 2 + rng() * 5, spark: false });
    }
  }

  render(state, options = {}) {
    const time = options.time ?? performance.now();
    const dt = this.lastTime ? clamp((time - this.lastTime) / 1000, 0, 0.05) : 1 / 60;
    this.lastTime = time;
    if (state) this.consumeEvents(state);
    const ctx = this.ctx;
    const scale = options.camera === 'crop'
      ? this.canvas.width / WIDTH
      : Math.min(this.canvas.width / WIDTH, this.canvas.height / HEIGHT);
    const offsetX = (this.canvas.width - WIDTH * scale) / 2;
    const offsetY = (this.canvas.height - HEIGHT * scale) / 2;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#101a22';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    ctx.drawImage(this.background, 0, 0, WIDTH, HEIGHT);
    ctx.save();
    if (this.shake > 0.05 && options.quality !== 'reduced') {
      ctx.translate(Math.sin(time * 0.173) * this.shake, Math.cos(time * 0.137) * this.shake * 0.55);
    }

    // Slowly drifting foreground haze; deliberately subtle beneath combat.
    ctx.save();
    ctx.globalAlpha = 0.026;
    ctx.fillStyle = '#d0f2d4';
    for (let i = 0; i < 5; i++) {
      const x = ((time * 0.008 + i * 284) % 1560) - 260;
      ctx.beginPath(); ctx.ellipse(x, 436 + i % 2 * 7, 150, 6, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    const fighters = state?.fighters || [];
    for (const f of fighters) {
      const air = Math.max(0, FLOOR - f.y);
      ctx.save();
      ctx.globalAlpha = 0.30 * (1 - clamp(air / 280, 0, 0.8));
      ctx.fillStyle = '#070f17';
      ctx.beginPath(); ctx.ellipse(f.x, FLOOR - 1, Math.max(13, 30 - air * 0.055), 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      if (f.action === 'dash' && (state.tick ?? 0) - (this.ghostTick[f.id ?? fighters.indexOf(f)] ?? -1) >= 4) {
        const id = f.id ?? fighters.indexOf(f);
        this.ghosts.push({ fighter: { ...f, id }, life: 0.15, maxLife: 0.15 });
        this.ghostTick[id] = state.tick ?? 0;
      }
    }
    this.ghosts = this.ghosts.filter(ghost => (ghost.life -= dt) > 0);
    for (const ghost of this.ghosts) {
      ctx.save(); ctx.globalAlpha = ghost.life / ghost.maxLife * 0.18;
      this.drawFighter(ctx, ghost.fighter, time, true); ctx.restore();
    }
    for (let i = 0; i < fighters.length; i++) {
      const f = fighters[i];
      this.drawFighter(ctx, { ...f, id: f.id ?? i }, time);
      if (options.localId === (f.id ?? i) && state.phase === 'lobby') {
        const color = COLORS[i % 2].main;
        ctx.fillStyle = color; ctx.globalAlpha = 0.7;
        polygon(ctx, [[f.x - 4, f.y - 142], [f.x + 4, f.y - 142], [f.x, f.y - 137]], color);
        ctx.font = '9px monospace'; ctx.textAlign = 'center'; ctx.fillText('YOU', f.x, f.y - 148); ctx.globalAlpha = 1;
      }
    }
    this.drawEffects(ctx, dt);
    ctx.restore();
    this.shake *= Math.exp(-dt * 24);
    this.flash *= Math.exp(-dt * 35);
    if (this.flash > 0.005) {
      ctx.fillStyle = `rgba(220,245,214,${this.flash})`; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }
  }

  pose(f, time) {
    const frame = f.actionFrame || 0;
    const action = f.action || 'idle';
    const breath = Math.sin(time / 440 + f.id * 2) * 0.8;
    const p = {
      hip: [-4, -43 + breath], shoulder: [-5, -81 + breath], head: [-3, -101 + breath],
      frontKnee: [15, -23], frontFoot: [27, 0], backKnee: [-20, -25], backFoot: [-28, 0],
      backElbow: [-23, -65 + breath], backHand: [-24, -46 + breath],
      frontElbow: [14, -65 + breath], frontHand: [29, -73 + breath], sword: -0.50,
      swordLength: 69, trail: null, scarf: 1,
    };
    if (action === 'run') {
      const swing = Math.sin(frame * 0.17);
      p.hip = [0, -43 + Math.abs(swing) * 3]; p.shoulder = [6, -81 + Math.abs(swing) * 3]; p.head = [11, -100 + Math.abs(swing) * 3];
      p.frontKnee = [swing * 22 + 8, -25]; p.frontFoot = [swing * 33 + 3, -Math.max(0, -swing) * 17];
      p.backKnee = [-swing * 24 - 4, -25]; p.backFoot = [-swing * 33, -Math.max(0, swing) * 17];
      p.frontElbow = [18 - swing * 8, -66]; p.frontHand = [32 - swing * 12, -73];
      p.backElbow = [-18 + swing * 6, -65]; p.backHand = [-24 + swing * 12, -46];
      p.sword = -0.42; p.scarf = 1.8;
    } else if (action === 'jump' || (f.y < FLOOR - 3 && action === 'idle')) {
      p.hip = [-1, -47]; p.shoulder = [0, -82]; p.head = [4, -102];
      p.frontKnee = [23, -41]; p.frontFoot = [20, -20]; p.backKnee = [-18, -30]; p.backFoot = [-35, -21];
      p.frontElbow = [20, -83]; p.frontHand = [30, -92]; p.backHand = [-28, -63];
      p.sword = -0.3; p.scarf = 1.6;
    } else if (action === 'dash') {
      p.hip = [-3, -32]; p.shoulder = [14, -63]; p.head = [23, -82];
      p.frontKnee = [23, -21]; p.frontFoot = [39, -1]; p.backKnee = [-24, -14]; p.backFoot = [-46, -1];
      p.frontElbow = [25, -49]; p.frontHand = [38, -54]; p.backElbow = [-5, -46]; p.backHand = [-24, -34];
      p.sword = -0.12; p.scarf = 3;
    } else if (action === 'light' || action === 'heavy') {
      const heavy = action === 'heavy';
      const startup = heavy ? 28 : 12, active = heavy ? 11 : 8, total = heavy ? 78 : 44;
      const windup = clamp(frame / startup, 0, 1);
      const swing = clamp((frame - startup) / active, 0, 1);
      const recover = clamp((frame - startup - active) / (total - startup - active), 0, 1);
      const angleStart = heavy ? -2.22 : -2.48, angleEnd = heavy ? 0.46 : 0.62;
      let angle;
      if (frame < startup) angle = mix(-0.5, angleStart, ease(windup));
      else if (frame < startup + active) angle = mix(angleStart, angleEnd, ease(swing));
      else angle = mix(angleEnd, -0.5, ease(recover));
      const drive = frame < startup ? -windup * 5 : (1 - recover) * (heavy ? 14 : 10);
      p.hip = [drive * 0.30 - 4, -42]; p.shoulder = [drive - 4, -79]; p.head = [drive - 2, -99];
      p.frontFoot = [heavy ? 39 : 33, 0]; p.frontKnee = [24, -23]; p.backFoot = [-34, 0];
      p.frontHand = [p.shoulder[0] + Math.cos(angle) * 27, p.shoulder[1] + Math.sin(angle) * 23];
      p.frontElbow = [p.shoulder[0] + 9 + Math.cos(angle) * 7, p.shoulder[1] + 15 + Math.sin(angle) * 9];
      p.backElbow = [-21 + drive, -65]; p.backHand = [-24 + drive, -51];
      if (heavy) { p.backHand = [p.frontHand[0] - Math.cos(angle) * 8, p.frontHand[1] - Math.sin(angle) * 8]; p.backElbow = [p.shoulder[0] - 9, p.shoulder[1] + 11]; }
      p.sword = angle;
      p.swordLength = heavy ? 69 + 55 * (frame < startup ? windup : 1 - recover) : 69;
      p.scarf = 1.5;
      if (frame >= startup && frame <= startup + active + 5) p.trail = { angle, from: angleStart, heavy, fade: frame > startup + active ? 1 - (frame - startup - active) / 6 : 1 };
    } else if (action === 'block' || action === 'parry') {
      p.hip = [-10, -43]; p.shoulder = [-10, -81]; p.head = [-8, -101];
      p.frontElbow = [9, -66]; p.frontHand = [26, -86]; p.backElbow = [1, -68]; p.backHand = [18, -77];
      p.frontKnee = [12, -26]; p.frontFoot = [23, 0]; p.sword = -1.3;
    } else if (action === 'hit') {
      const impact = Math.max(0, 1 - frame / 30);
      p.hip = [-7, -42]; p.shoulder = [-12 - impact * 6, -77]; p.head = [-17 - impact * 7, -94];
      p.frontElbow = [5, -60]; p.frontHand = [20, -49]; p.backElbow = [-31, -60]; p.backHand = [-35, -43];
      p.frontKnee = [9, -26]; p.frontFoot = [23, 0]; p.backFoot = [-36, 0]; p.sword = 0.25;
    } else if (action === 'dead') {
      const fall = ease(frame / 35);
      p.hip = [-10, mix(-43, -14, fall)]; p.shoulder = [mix(-5, -37, fall), mix(-81, -17, fall)]; p.head = [mix(-3, -53, fall), mix(-101, -17, fall)];
      p.frontKnee = [9, -11]; p.frontFoot = [32, -1]; p.backKnee = [-24, -6]; p.backFoot = [-40, -1];
      p.frontElbow = [-21, mix(-65, -7, fall)]; p.frontHand = [5, mix(-73, -5, fall)]; p.backElbow = [-38, -7]; p.backHand = [-45, -3];
      p.sword = 0.08; p.scarf = 0.2;
    }
    return p;
  }

  drawFighter(ctx, f, time, ghost = false) {
    const color = COLORS[(f.id ?? 0) % 2];
    const p = this.pose(f, time);
    const face = f.facing === -1 ? -1 : 1;
    ctx.save(); ctx.translate(f.x, f.y); ctx.scale(face, 1);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    if (p.trail && !ghost) this.drawSlash(ctx, p, color);
    if ((f.action === 'block' || f.action === 'parry') && !ghost) {
      const parry = f.action === 'parry';
      ctx.save();
      const alpha = parry ? 0.5 : 0.13;
      ctx.strokeStyle = parry ? '#e6ffff' : color.main;
      ctx.lineWidth = parry ? 2 : 1;
      ctx.shadowColor = color.main; ctx.shadowBlur = parry ? 17 : 8;
      ctx.globalAlpha = alpha;
      ctx.beginPath(); ctx.ellipse(24, -68, 27, 46, 0.18, -1.3, 1.3); ctx.stroke();
      if (parry) { ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(24, -68, 32, 50, 0.18, -1.2, 1.2); ctx.stroke(); }
      ctx.restore();
    }

    const hip = p.hip, shoulder = p.shoulder, head = p.head;
    // Scarf, rear limbs, and sheathed blade establish depth behind the torso.
    const flutter = Math.sin(time / 78 + (f.id || 0) * 3) * 3;
    polygon(ctx, [[shoulder[0] - 2, shoulder[1] - 6], [shoulder[0] - 19, shoulder[1] - 4], [shoulder[0] - 28 - p.scarf * 8, shoulder[1] + 4 + flutter], [shoulder[0] - 14 - p.scarf * 9, shoulder[1] + 14 + flutter], [shoulder[0] - 7, shoulder[1] + 1]], color.dark);
    line(ctx, [[shoulder[0] - 13, shoulder[1] - 1], [shoulder[0] - 27 - p.scarf * 5, shoulder[1] + 5 + flutter]], color.main, 2);
    segment(ctx, [hip[0] - 8, hip[1] - 7], [shoulder[0] - 23, shoulder[1] - 19], 5, 4, '#111e28', '#49616a');
    segment(ctx, hip, p.backKnee, 15, 12, color.shade, '#0e1b25');
    segment(ctx, p.backKnee, [p.backFoot[0], p.backFoot[1] - 6], 12, 9, color.shade, '#0e1b25');
    polygon(ctx, [[p.backFoot[0] - 8, p.backFoot[1] - 9], [p.backFoot[0] + 5, p.backFoot[1] - 8], [p.backFoot[0] + 11, p.backFoot[1] - 2], [p.backFoot[0] + 11, p.backFoot[1]], [p.backFoot[0] - 9, p.backFoot[1]]], '#182629', '#3d534d');
    segment(ctx, [shoulder[0] - 4, shoulder[1] + 4], p.backElbow, 13, 9, color.shade, '#10202a');
    segment(ctx, p.backElbow, p.backHand, 10, 7, color.shade, '#14232b');
    ctx.fillStyle = '#26373a'; ctx.beginPath(); ctx.arc(...p.backHand, 4.5, 0, Math.PI * 2); ctx.fill();

    // Tapered body armor, fabric underlayer and asymmetric illuminated chest plate.
    polygon(ctx, [[shoulder[0] - 11, shoulder[1] - 2], [shoulder[0] + 11, shoulder[1] - 1], [hip[0] + 10, hip[1] - 1], [hip[0] - 11, hip[1] + 1]], color.suit, '#101d27', 1.5);
    polygon(ctx, [[shoulder[0] - 9, shoulder[1] - 2], [shoulder[0] + 8, shoulder[1] - 2], [shoulder[0] + 12, shoulder[1] + 17], [hip[0] + 5, hip[1] - 12], [hip[0] - 8, hip[1] - 13]], '#45584f', '#728172', 1);
    polygon(ctx, [[shoulder[0] + 1, shoulder[1]], [shoulder[0] + 9, shoulder[1] + 1], [shoulder[0] + 12, shoulder[1] + 15], [shoulder[0] + 4, shoulder[1] + 19]], color.main);
    line(ctx, [[shoulder[0] - 6, shoulder[1] + 3], [hip[0] + 6, hip[1] - 8]], '#101d28', 4);
    line(ctx, [[shoulder[0] - 7, shoulder[1] + 3], [hip[0] + 5, hip[1] - 8]], '#75817a', 1);
    line(ctx, [[hip[0] - 8, hip[1] - 13], [hip[0] + 8, hip[1] - 13]], '#6b7a6b', 2);
    segment(ctx, [hip[0] - 10, hip[1] - 2], [hip[0] + 12, hip[1] - 2], 7, 7, '#111f25', '#53665c');
    ctx.fillStyle = color.main; ctx.fillRect(hip[0] + 1, hip[1] - 6, 5, 4);
    polygon(ctx, [[hip[0] - 8, hip[1]], [hip[0] + 6, hip[1]], [hip[0] + 3, hip[1] + 17], [hip[0] - 10, hip[1] + 13]], '#30413e', '#12232a');

    segment(ctx, [hip[0] + 4, hip[1] + 1], p.frontKnee, 16, 12, color.suit, '#0e1c25');
    segment(ctx, p.frontKnee, [p.frontFoot[0] - 1, p.frontFoot[1] - 7], 12, 9, '#394943', '#102129');
    // Shin plate and bright knee accent retain readability on the dark floor.
    segment(ctx, [p.frontKnee[0] + 1, p.frontKnee[1] + 5], [p.frontFoot[0] - 1, p.frontFoot[1] - 10], 8, 6, color.dark, '#77866f');
    polygon(ctx, [[p.frontKnee[0] - 7, p.frontKnee[1] - 3], [p.frontKnee[0] + 6, p.frontKnee[1] - 4], [p.frontKnee[0] + 8, p.frontKnee[1] + 3], [p.frontKnee[0] - 5, p.frontKnee[1] + 5]], color.main, '#577346');
    polygon(ctx, [[p.frontFoot[0] - 8, p.frontFoot[1] - 10], [p.frontFoot[0] + 5, p.frontFoot[1] - 8], [p.frontFoot[0] + 13, p.frontFoot[1] - 3], [p.frontFoot[0] + 13, p.frontFoot[1]], [p.frontFoot[0] - 8, p.frontFoot[1]]], '#17292d', '#536a60');
    line(ctx, [[p.frontFoot[0] - 6, p.frontFoot[1] - 1], [p.frontFoot[0] + 11, p.frontFoot[1] - 1]], color.dark, 2);

    segment(ctx, [shoulder[0] + 8, shoulder[1] + 4], p.frontElbow, 13, 9, color.suit, '#13232c');
    polygon(ctx, [[shoulder[0] + 4, shoulder[1] - 3], [shoulder[0] + 15, shoulder[1]], [shoulder[0] + 17, shoulder[1] + 11], [shoulder[0] + 6, shoulder[1] + 13]], color.dark, '#9caf83');
    segment(ctx, p.frontElbow, p.frontHand, 11, 7, '#536453', '#14252c');
    const forearmMid = [mix(p.frontElbow[0], p.frontHand[0], 0.7), mix(p.frontElbow[1], p.frontHand[1], 0.7)];
    segment(ctx, forearmMid, p.frontHand, 10, 8, color.main, '#486445');
    this.drawSword(ctx, p.frontHand, p.sword, p.swordLength, color, ghost);
    ctx.fillStyle = '#223638'; ctx.strokeStyle = '#73866a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(...p.frontHand, 4.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // Head: neck gaiter, angular mask, metallic visor, swept hair silhouette.
    segment(ctx, [shoulder[0], shoulder[1] - 3], [head[0], head[1] + 8], 11, 10, '#263c39');
    polygon(ctx, [[head[0] - 11, head[1] - 10], [head[0] + 6, head[1] - 10], [head[0] + 13, head[1] - 2], [head[0] + 11, head[1] + 10], [head[0] + 3, head[1] + 15], [head[0] - 8, head[1] + 11], [head[0] - 13, head[1] + 1]], '#53675f', '#122029', 1.5);
    polygon(ctx, [[head[0] - 10, head[1] + 2], [head[0] + 12, head[1] + 2], [head[0] + 10, head[1] + 12], [head[0] + 1, head[1] + 15], [head[0] - 9, head[1] + 10]], '#203239');
    line(ctx, [[head[0] + 3, head[1] + 7], [head[0] + 9, head[1] + 7]], '#6e8275', 1);
    polygon(ctx, [[head[0] - 12, head[1] - 3], [head[0] + 11, head[1] - 4], [head[0] + 14, head[1]], [head[0] + 11, head[1] + 3], [head[0] - 8, head[1] + 3]], '#121f2a');
    ctx.save(); ctx.shadowColor = color.main; ctx.shadowBlur = ghost ? 0 : 7;
    line(ctx, [[head[0] + 1, head[1] - 1], [head[0] + 10, head[1] - 1]], color.light, 2); ctx.restore();
    polygon(ctx, [[head[0] - 12, head[1]], [head[0] - 15, head[1] - 7], [head[0] - 17, head[1] - 12], [head[0] - 6, head[1] - 10], [head[0] - 11, head[1] - 16], [head[0] + 1, head[1] - 13], [head[0] + 7, head[1] - 15], [head[0] + 10, head[1] - 7], [head[0] + 1, head[1] - 5]], '#17262e', '#50625a');
    polygon(ctx, [[head[0] - 10, head[1] + 10], [head[0] + 8, head[1] + 12], [shoulder[0] + 8, shoulder[1] + 1], [shoulder[0] - 12, shoulder[1]]], color.main, '#405d41');
    line(ctx, [[head[0] - 8, head[1] + 12], [shoulder[0] + 4, shoulder[1] - 1]], color.light, 1);

    if (f.guardBroken > 0 && !ghost) {
      ctx.strokeStyle = '#f8b57d'; ctx.lineWidth = 1.5;
      const a = time / 140;
      for (let i = 0; i < 3; i++) {
        const x = head[0] + Math.cos(a + i * 2.09) * 18;
        const y = head[1] - 25 + Math.sin(a + i * 2.09) * 3;
        line(ctx, [[x - 2, y - 3], [x + 2, y], [x - 1, y + 3]], '#f8b57d', 1.5);
      }
    }
    ctx.restore();
  }

  drawSword(ctx, hand, angle, length, color, ghost) {
    ctx.save(); ctx.translate(...hand); ctx.rotate(angle);
    polygon(ctx, [[-13, -3], [1, -3], [1, 3], [-13, 3]], '#263434', '#6a8271');
    for (let x = -11; x < 0; x += 3) line(ctx, [[x, -2], [x + 1, 2]], color.dark, 1);
    line(ctx, [[3, -8], [3, 8]], '#94ab8e', 3);
    polygon(ctx, [[7, -3], [length - 7, -2.7], [length, -5], [length - 4, 0], [13, 3.3], [7, 2.6]], '#d8e5d7', '#426b63', 0.6);
    ctx.save(); ctx.shadowColor = color.main; ctx.shadowBlur = ghost ? 0 : 7;
    line(ctx, [[8, 2], [length - 4, -0.3], [length, -5]], color.light, 1.4); ctx.restore();
    line(ctx, [[12, -1], [length - 10, -1.5]], '#738d90', 0.8);
    ctx.restore();
  }

  drawSlash(ctx, p, color) {
    const { angle, from, heavy, fade } = p.trail;
    const center = p.shoulder;
    const radius = p.swordLength + 27;
    const end = angle;
    const start = Math.max(from, end - (heavy ? 1.8 : 1.55));
    ctx.save(); ctx.translate(...center);
    ctx.globalCompositeOperation = 'screen';
    const points = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20, a = mix(start, end, t), r = radius - (1 - t) * 17;
      points.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    for (let i = 20; i >= 0; i--) {
      const t = i / 20, a = mix(start, end, t), r = radius - (heavy ? 35 : 24) * Math.sin(t * Math.PI / 2) - 18;
      points.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    ctx.globalAlpha = 0.23 * fade; polygon(ctx, points, color.main);
    ctx.globalAlpha = 0.85 * fade; ctx.strokeStyle = color.light; ctx.lineWidth = heavy ? 2.5 : 1.6;
    ctx.shadowColor = color.main; ctx.shadowBlur = 8;
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const t = i / 24, a = mix(start, end, t), r = radius - (1 - t) * 17;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 0.35 * fade; ctx.shadowBlur = 0; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, radius - 9, start + 0.15, end); ctx.stroke();
    ctx.restore();
  }

  drawEffects(ctx, dt) {
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    this.rings = this.rings.filter(ring => {
      ring.life -= dt;
      if (ring.life <= 0) return false;
      const progress = 1 - ring.life / ring.maxLife;
      ctx.strokeStyle = ring.color; ctx.globalAlpha = (1 - progress) * 0.85; ctx.lineWidth = 1.5 - progress;
      ctx.beginPath(); ctx.arc(ring.x, ring.y, 5 + ring.radius * ease(progress), 0, Math.PI * 2); ctx.stroke();
      return true;
    });
    this.particles = this.particles.filter(p => {
      p.life -= dt;
      if (p.life <= 0) return false;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += (p.spark ? 245 : -12) * dt;
      p.vx *= Math.exp(-dt * (p.spark ? 2.8 : 4));
      ctx.globalAlpha = clamp(p.life / p.maxLife * 1.4, 0, 1) * (p.spark ? 1 : 0.25);
      if (p.spark) {
        const speed = Math.hypot(p.vx, p.vy) || 1;
        const length = Math.min(10, speed * 0.035) * p.life / p.maxLife;
        line(ctx, [[p.x, p.y], [p.x - p.vx / speed * length, p.y - p.vy / speed * length]], p.color, p.size * p.life / p.maxLife + 0.3);
      } else {
        ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size * (2 - p.life / p.maxLife), p.size * 0.4);
      }
      return true;
    });
    if (this.particles.length > 220) this.particles.splice(0, this.particles.length - 220);
    ctx.restore();
  }
}
