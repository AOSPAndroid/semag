import { WORLD, STAGES, MOVES, DASH, PARRY, KUNAI } from './shinobi-engine.js';

const TAU = Math.PI * 2;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const NINJAS = [
  { cloth: '#314451', shade: '#1b2b37', edge: '#6b8491', sash: '#ee9b67', pale: '#ffe6ab', ink: '#101c27' },
  { cloth: '#39434a', shade: '#20292f', edge: '#788784', sash: '#79d5c3', pale: '#dcfff0', ink: '#13212a' },
];
const SCENES = {
  rooftop: { name: 'RAIN ROOFTOP', seed: 1831, ink: '#121d30', floor: '#2c3d53', seam: '#18273d', tiles: ['#304158', '#35475e', '#293b51', '#34445b'], edge: '#8aafbf', stone: '#65798a', light: '#bed6d8', wood: '#635864' },
  garden: { name: 'LANTERN COURTYARD', seed: 5901, ink: '#152829', floor: '#3c514b', seam: '#283d3b', tiles: ['#43564e', '#485b52', '#3e514b', '#465952'], edge: '#a1b295', stone: '#87978b', light: '#d7d8b3', wood: '#756354' },
  shrine: { name: 'SNOW SHRINE', seed: 7293, ink: '#243949', floor: '#b4c6c6', seam: '#839d9f', tiles: ['#b4c8c8', '#bdcecd', '#aebfc0', '#b8c9c8'], edge: '#e7efdf', stone: '#7f9c9b', light: '#e9f1df', wood: '#676b70' },
};

function randomFrom(seed) {
  let value = seed >>> 0;
  return () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 4294967296; };
}
function line(ctx, points, color, width = 1) {
  ctx.beginPath(); for (let i = 0; i < points.length; i++) i ? ctx.lineTo(...points[i]) : ctx.moveTo(...points[i]);
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
}
function polygon(ctx, points, color) {
  ctx.beginPath(); for (let i = 0; i < points.length; i++) i ? ctx.lineTo(...points[i]) : ctx.moveTo(...points[i]);
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
}
function circle(ctx, x, y, radius, color) {
  ctx.beginPath(); ctx.arc(x, y, radius, 0, TAU); ctx.fillStyle = color; ctx.fill();
}
function ring(ctx, x, y, radius, color, width = 1) {
  ctx.beginPath(); ctx.arc(x, y, radius, 0, TAU); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
}
function canvasLayer(width = WORLD.width, height = WORLD.height) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; return canvas;
}
function moveFor(action) {
  return MOVES[action] || null;
}
function convexHull(points) {
  points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const lower = [], upper = [];
  for (const point of points) {
    while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), point) <= 0) lower.pop();
    lower.push(point);
  }
  for (let i = points.length - 1; i >= 0; i--) {
    const point = points[i];
    while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), point) <= 0) upper.pop();
    upper.push(point);
  }
  lower.pop(); upper.pop(); return lower.concat(upper);
}

/** Original pixel assets, cached scenery, and bounded effects outside network state. */
export class ShinobiRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.backgrounds = new Map(); this.scenes = new Map(); this.sprites = new Map();
    this.motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reducedMotion = this.motionQuery.matches;
    this.motionChange = () => {
      this.reducedMotion = this.motionQuery.matches;
      if (this.reducedMotion) { this.particles.length = 0; this.ghosts.length = 0; }
    };
    this.motionQuery.addEventListener?.('change', this.motionChange);
    this.resize = this.resize.bind(this);
    this.observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(this.resize);
    this.observer?.observe(canvas);
    this.resetEffects(); this.resize();
  }

  resize() {
    const bounds = this.canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(bounds.width * dpr)), height = Math.max(1, Math.round(bounds.height * dpr));
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
  }

  resetEffects() {
    this.particles = []; this.bursts = []; this.ghosts = [];
    this.seenEvents = new Set(); this.eventOrder = []; this.lastGhost = [-1, -1];
    this.lastTick = -1; this.lastTime = null; this.hitFlash = [0, 0];
  }

  destroy() {
    this.observer?.disconnect(); this.motionQuery.removeEventListener?.('change', this.motionChange);
    this.resetEffects(); this.backgrounds.clear(); this.scenes.clear(); this.sprites.clear();
  }

  background(id) {
    const stageId = Object.hasOwn(SCENES, id) ? id : 'rooftop';
    if (!this.backgrounds.has(stageId)) {
      const canvas = canvasLayer(); this.paintBackground(canvas.getContext('2d'), stageId);
      this.backgrounds.set(stageId, canvas);
    }
    return this.backgrounds.get(stageId);
  }

  scene(id, obstacles) {
    const stageId = Object.hasOwn(SCENES, id) ? id : 'rooftop';
    const covers = obstacles || STAGES[stageId]?.covers || STAGES[stageId]?.obstacles || [];
    let scene = this.scenes.get(stageId);
    let same = scene?.geometry.length === covers.length * 4;
    for (let i = 0; same && i < covers.length; i++) {
      const cover = covers[i], j = i * 4, geometry = scene.geometry;
      same = geometry[j] === cover.x && geometry[j + 1] === cover.y && geometry[j + 2] === cover.w && geometry[j + 3] === cover.h;
    }
    if (same) return scene;
    const canvas = canvasLayer(), coverLayer = canvasLayer(), ctx = canvas.getContext('2d', { alpha: false });
    const coverCtx = coverLayer.getContext('2d'), geometry = new Float64Array(covers.length * 4);
    ctx.drawImage(this.background(stageId), 0, 0);
    for (let i = 0; i < covers.length; i++) {
      const cover = covers[i], j = i * 4;
      this.paintCover(coverCtx, cover, stageId);
      geometry[j] = cover.x; geometry[j + 1] = cover.y; geometry[j + 2] = cover.w; geometry[j + 3] = cover.h;
    }
    ctx.drawImage(coverLayer, 0, 0);
    scene = { canvas, coverLayer, geometry }; this.scenes.set(stageId, scene);
    return scene;
  }

  paintBackground(ctx, id) {
    const p = SCENES[id], random = randomFrom(p.seed), { width, height, wall } = WORLD;
    ctx.fillStyle = p.ink; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = p.floor; ctx.fillRect(wall, wall, width - wall * 2, height - wall * 2);
    ctx.save(); ctx.beginPath(); ctx.rect(wall, wall, width - wall * 2, height - wall * 2); ctx.clip();
    if (id === 'rooftop') {
      for (let row = 0, y = wall; y < height - wall; y += 24, row++) for (let x = wall - row % 2 * 24; x < width - wall; x += 48) {
        ctx.fillStyle = p.tiles[Math.floor(random() * 4)]; ctx.fillRect(x + 1, y + 1, 46, 22);
        ctx.fillStyle = '#17263c'; ctx.fillRect(x + 1, y + 20, 46, 3);
        ctx.fillStyle = '#8eb1bc35'; ctx.fillRect(x + 3, y + 2, 42, 2);
        ctx.fillStyle = '#4d718251'; ctx.fillRect(x + 4, y + 6, 40, 1);
        if (random() > .78) { ctx.fillStyle = '#b6d0cf21'; ctx.fillRect(x + 8, y + 10, 16, 1); ctx.fillRect(x + 11, y + 12, 8, 1); }
      }
      // Roof seams are flat copper flashing, not additional collision cover.
      for (const y of [78, 562]) {
        ctx.fillStyle = '#152b3b'; ctx.fillRect(48, y, 864, 7);
        ctx.fillStyle = '#72939665'; ctx.fillRect(48, y + 1, 864, 1);
        for (let x = 58; x < 904; x += 28) { ctx.fillStyle = '#b0bda775'; ctx.fillRect(x, y + 2, 2, 2); }
      }
      for (const [x, y] of [[114, 161], [737, 99], [125, 470], [761, 537]]) {
        polygon(ctx, [[x, y], [x + 59, y - 4], [x + 73, y + 4], [x + 40, y + 8], [x - 2, y + 5]], '#77a6b223');
        line(ctx, [[x + 9, y + 1], [x + 49, y]], '#a1c9ce25');
      }
    } else {
      const tileW = id === 'shrine' ? 56 : 64, tileH = id === 'shrine' ? 40 : 48;
      for (let row = 0, y = wall; y < height - wall; y += tileH, row++) for (let x = wall - row % 2 * tileW / 2; x < width - wall; x += tileW) {
        ctx.fillStyle = p.seam; ctx.fillRect(x, y, tileW, tileH);
        ctx.fillStyle = p.tiles[Math.floor(random() * 4)]; ctx.fillRect(x + 1, y + 1, tileW - 2, tileH - 2);
        ctx.fillStyle = p.edge + '35'; ctx.fillRect(x + 3, y + 2, tileW - 6, 1);
        ctx.fillStyle = p.ink + '22'; ctx.fillRect(x + 3, y + tileH - 3, tileW - 6, 1);
        if (random() > .83) line(ctx, [[x + tileW - 18, y + 2], [x + tileW - 22, y + 10], [x + tileW - 17, y + 15]], p.seam + '85');
        if (id === 'shrine' && random() > .56) {
          ctx.fillStyle = '#eef4e645'; ctx.fillRect(x + 2, y + 2, tileW - 9, 4);
          ctx.fillRect(x + 2, y + 6, 12, 3);
        }
      }
      // Subdued flush inlays leave the silhouette and sword tells legible.
      for (const mirror of [false, true]) {
        ctx.save(); if (mirror) { ctx.translate(width, 0); ctx.scale(-1, 1); }
        const color = id === 'garden' ? '#adad7840' : '#6c969a55';
        line(ctx, [[78, 121], [166, 121], [166, 82], [409, 82]], color, 2);
        line(ctx, [[78, 519], [166, 519], [166, 558], [409, 558]], color, 2);
        if (id === 'garden') for (const [x, y] of [[92, 168], [146, 531], [363, 548], [356, 107]]) {
          polygon(ctx, [[x, y], [x + 8, y - 3], [x + 14, y + 1], [x + 5, y + 4]], '#ad8c6849');
          line(ctx, [[x + 2, y], [x + 10, y]], '#c3b48b35');
        }
        ctx.restore();
      }
      if (id === 'shrine') for (const [x, y] of [[125, 185], [813, 476], [758, 130], [188, 557]]) {
        ctx.fillStyle = '#edf4e365'; ctx.fillRect(x, y, 38, 2); ctx.fillRect(x + 6, y + 2, 50, 3); ctx.fillRect(x + 17, y + 5, 36, 2);
      }
    }
    const markings = id === 'shrine' ? [[154, 420, NINJAS[0].sash], [806, 220, NINJAS[1].sash]]
      : [[154, 320, NINJAS[0].sash], [806, 320, NINJAS[1].sash]];
    for (const [x, y, color] of markings) {
      ring(ctx, x, y, 28, color + (id === 'shrine' ? '45' : '28'));
      line(ctx, [[x - 10, y - 26], [x + 10, y - 26]], color + '45');
      line(ctx, [[x - 10, y + 26], [x + 10, y + 26]], color + '45');
    }
    if (id === 'garden') {
      this.paintFloorSeal(ctx, 154, 320, id); this.paintFloorSeal(ctx, 806, 320, id);
    } else this.paintFloorSeal(ctx, 480, 320, id);
    ctx.restore();
    this.paintBorder(ctx, id);
  }

  paintFloorSeal(ctx, x, y, id) {
    ctx.save(); ctx.translate(x, y); ctx.globalAlpha = id === 'shrine' ? .24 : .18;
    const color = id === 'shrine' ? '#496e78' : id === 'garden' ? '#c6c5a1' : '#b7cdcb';
    const radius = id === 'garden' ? 22 : 40;
    ring(ctx, 0, 0, radius, color, 2); ring(ctx, 0, 0, radius - 4, color, 1);
    if (id === 'rooftop') {
      // An inlaid crescent is flat roof metal, rather than a new raised platform.
      ctx.beginPath(); ctx.arc(-3, 0, 22, -.65 * Math.PI, .65 * Math.PI);
      ctx.arc(-10, 0, 19, .65 * Math.PI, -.65 * Math.PI, true);
      ctx.closePath(); ctx.fillStyle = color; ctx.fill();
      for (let i = 0; i < 8; i++) {
        ctx.save(); ctx.rotate(i * Math.PI / 4); line(ctx, [[0, -36], [0, -30]], color, 2); ctx.restore();
      }
      polygon(ctx, [[18, -20], [21, -14], [27, -11], [21, -8], [18, -2], [15, -8], [9, -11], [15, -14]], color);
    } else {
      const count = id === 'garden' ? 5 : 4;
      for (let i = 0; i < count; i++) {
        ctx.save(); ctx.rotate(i * TAU / count);
        const length = id === 'garden' ? 17 : 30;
        polygon(ctx, [[-3, -7], [-7, -length + 5], [-3, -length], [3, -length], [7, -length + 5], [3, -7], [0, -4]], color);
        ctx.restore();
      }
      polygon(ctx, [[0, -6], [6, 0], [0, 6], [-6, 0]], color);
    }
    ctx.restore();
  }

  paintBorder(ctx, id) {
    const p = SCENES[id], { width, height, wall } = WORLD;
    // All lanterns, vegetation, and shrine fixtures remain beyond the walkable wall line.
    for (const y of [0, height - wall]) {
      ctx.fillStyle = p.ink; ctx.fillRect(0, y, width, wall);
      for (let x = 0; x < width; x += 48) {
        ctx.fillStyle = id === 'garden' ? '#5b6960' : id === 'shrine' ? '#73908f' : '#394f65';
        ctx.fillRect(x + 1, y + 2, 46, wall - 4);
        ctx.fillStyle = p.light + '80'; ctx.fillRect(x + 2, y + 2, 44, 2);
        ctx.fillStyle = p.ink + 'aa'; ctx.fillRect(x + 2, y + wall - 6, 44, 4);
      }
    }
    for (const x of [0, width - wall]) {
      ctx.fillStyle = p.ink; ctx.fillRect(x, wall, wall, height - wall * 2);
      for (let y = wall; y < height - wall; y += 40) {
        ctx.fillStyle = id === 'garden' ? '#5b6960' : id === 'shrine' ? '#73908f' : '#394f65';
        ctx.fillRect(x + 2, y + 1, wall - 4, 38);
        ctx.fillStyle = p.light + '60'; ctx.fillRect(x + 2, y + 2, 2, 36);
      }
    }
    ctx.fillStyle = p.ink + '65'; ctx.fillRect(wall, wall, width - wall * 2, 4); ctx.fillRect(wall, wall, 4, height - wall * 2);
    ctx.fillStyle = p.edge + '80'; ctx.fillRect(wall, height - wall - 1, width - wall * 2, 1); ctx.fillRect(width - wall - 1, wall, 1, height - wall * 2);
    // Authored eaves and rails fit wholly on the non-walkable perimeter.
    for (const y of [0, height - wall]) {
      const wood = id === 'garden' ? '#795a47' : id === 'shrine' ? '#80585b' : '#3c5365';
      ctx.fillStyle = '#152832'; ctx.fillRect(0, y + 6, width, 21);
      ctx.fillStyle = wood; ctx.fillRect(0, y + 7, width, 4); ctx.fillRect(0, y + 23, width, 3);
      ctx.fillStyle = id === 'shrine' ? '#bb9690' : id === 'garden' ? '#b59773' : '#819cac';
      ctx.fillRect(0, y + 7, width, 1);
      for (let x = 31; x < width; x += 48) {
        ctx.fillStyle = wood; ctx.fillRect(x, y + 10, 3, 14);
        ctx.fillStyle = '#162a35'; ctx.fillRect(x + 3, y + 10, 2, 14);
        if (id === 'garden') {
          line(ctx, [[x + 6, y + 11], [x + 18, y + 22], [x + 30, y + 11], [x + 42, y + 22]], '#7e785a', 1);
        } else if (id === 'rooftop') {
          ctx.fillStyle = '#63839470'; ctx.fillRect(x + 9, y + 12, 23, 2);
          ctx.fillStyle = '#243e51'; ctx.fillRect(x + 9, y + 18, 23, 3);
        }
      }
    }
    if (id === 'garden') {
      for (const [x, y] of [[16, 104], [16, 526], [944, 104], [944, 526]]) {
        ctx.fillStyle = '#263f31'; ctx.fillRect(x - 10, y - 13, 20, 27);
        for (let i = 0; i < 4; i++) {
          line(ctx, [[x - 6 + i * 4, y + 12], [x - 7 + i * 4, y - 13]], '#789260', 2);
          line(ctx, [[x - 6 + i * 4, y - 6], [x + 1 + i * 3, y - 10]], '#a0ab6a', 2);
        }
      }
    } else if (id === 'shrine') {
      for (const y of [1, height - 9]) {
        ctx.fillStyle = '#e7eee0'; ctx.fillRect(1, y, width - 2, 7);
        for (let x = 12; x < width; x += 39) { ctx.fillStyle = '#cedbd2'; ctx.fillRect(x, y + 6, 22, 3); }
      }
      for (const x of [5, width - 9]) {
        ctx.fillStyle = '#dce8dc'; ctx.fillRect(x, 42, 4, height - 84);
        ctx.fillStyle = '#a6c0b7'; ctx.fillRect(x + 1, 45, 2, height - 90);
      }
      // Rope and paper offerings are attached to the shrine's outer wall.
      for (const x of [16, width - 16]) {
        line(ctx, [[x, 87], [x + 2, 142], [x, 204], [x + 2, 260]], '#c0af88', 3);
        for (const y of [112, 175, 235]) {
          polygon(ctx, [[x + 1, y], [x + 9, y + 4], [x + 4, y + 10], [x + 10, y + 14], [x + 4, y + 20], [x - 1, y + 16], [x + 3, y + 10], [x - 3, y + 6]], '#e6eddd');
          line(ctx, [[x + 4, y + 4], [x + 1, y + 9]], '#a7bdb0');
        }
      }
    }
    for (const [x, y] of [[112, 15], [848, 15], [16, 318], [944, 318], [112, 622], [848, 622]]) this.paintLantern(ctx, x, y, id);
    ctx.fillStyle = p.ink; ctx.fillRect(290, 0, 380, wall);
    ctx.font = 'bold 11px Consolas, monospace'; ctx.textAlign = 'center'; ctx.fillStyle = p.light;
    ctx.fillText(p.name, width / 2, 20);
    ctx.fillStyle = NINJAS[0].sash; ctx.fillRect(300, 14, 26, 3);
    ctx.fillStyle = NINJAS[1].sash; ctx.fillRect(634, 14, 26, 3);
  }

  paintLantern(ctx, x, y, id) {
    const snow = id === 'shrine';
    ctx.fillStyle = '#0e202a65'; ctx.fillRect(x - 10, y - 11, 21, 25);
    ctx.fillStyle = snow ? '#e5ede0' : '#493d3b'; ctx.fillRect(x - 10, y - 12, 20, 4);
    ctx.fillStyle = '#152631'; ctx.fillRect(x - 8, y - 8, 16, 20);
    ctx.fillStyle = '#c68654'; ctx.fillRect(x - 6, y - 7, 12, 16);
    ctx.fillStyle = '#f2c47a'; ctx.fillRect(x - 4, y - 6, 8, 13);
    ctx.fillStyle = '#ffe4a0'; ctx.fillRect(x - 2, y - 4, 4, 8);
    ctx.fillStyle = '#775546'; ctx.fillRect(x - 7, y - 2, 14, 2); ctx.fillRect(x - 7, y + 5, 14, 2);
    ctx.fillStyle = '#2d3339'; ctx.fillRect(x - 10, y + 10, 20, 3);
  }

  paintCover(ctx, cover, id) {
    const { x, y, w, h } = cover, p = SCENES[id];
    ctx.fillStyle = p.ink + '50'; ctx.fillRect(x + 3, y + 4, w + 1, h + 1);
    // The continuous bright outer border is the exact solid footprint.
    ctx.fillStyle = p.ink; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = p.stone; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = p.light; ctx.fillRect(x + 1, y + 1, w - 2, 3); ctx.fillRect(x + 1, y + 4, 2, h - 5);
    ctx.fillStyle = p.ink + 'aa'; ctx.fillRect(x + w - 4, y + 4, 3, h - 5); ctx.fillRect(x + 4, y + h - 5, w - 8, 4);
    const inset = 8;
    ctx.fillStyle = p.wood; ctx.fillRect(x + inset, y + inset, w - inset * 2, h - inset * 2);
    if (id === 'rooftop') {
      for (let py = y + 9; py < y + h - 10; py += 13) {
        ctx.fillStyle = '#8b818077'; ctx.fillRect(x + 9, py, w - 18, 2);
        ctx.fillStyle = '#393744'; ctx.fillRect(x + 9, Math.min(py + 10, y + h - 9), w - 18, 2);
      }
      for (const px of [x + 13, x + w - 18]) {
        ctx.fillStyle = '#243e4c'; ctx.fillRect(px, y + 7, 5, h - 14);
        ctx.fillStyle = '#9bb0ad'; ctx.fillRect(px, y + 7, 5, 2); ctx.fillRect(px, y + h - 10, 5, 2);
      }
      ctx.fillStyle = '#d0c493'; ctx.fillRect(x + w / 2 - 4, y + h / 2 - 4, 8, 7);
      ctx.fillStyle = '#354b58'; ctx.fillRect(x + w / 2 - 2, y + h / 2 - 1, 4, 3);
    } else {
      ctx.fillStyle = id === 'shrine' ? '#698f8f' : '#61766a'; ctx.fillRect(x + 11, y + 11, w - 22, h - 22);
      const size = Math.min(17, (Math.min(w, h) - 22) / 2), cx = x + w / 2, cy = y + h / 2;
      polygon(ctx, [[cx, cy - size], [cx + size, cy], [cx, cy + size], [cx - size, cy]], id === 'shrine' ? '#577d82' : '#536458');
      line(ctx, [[cx, cy - size + 3], [cx + size - 3, cy], [cx, cy + size - 3], [cx - size + 3, cy], [cx, cy - size + 3]], p.light + 'b0', 2);
      ctx.fillStyle = p.light; ctx.fillRect(cx - 2, cy - 2, 4, 4);
      for (const dx of [7, w - 10]) for (const dy of [8, h - 11]) { ctx.fillStyle = p.light; ctx.fillRect(x + dx, y + dy, 3, 2); }
      if (id === 'garden') {
        ctx.fillStyle = '#7c9963'; ctx.fillRect(x + w - 19, y + 5, 12, 3); ctx.fillRect(x + w - 10, y + 8, 4, 7);
        ctx.fillStyle = '#b1bf83'; ctx.fillRect(x + w - 16, y + 5, 7, 1);
      } else {
        ctx.fillStyle = '#edf3e6'; ctx.fillRect(x + 3, y + 3, w - 6, 6); ctx.fillRect(x + 3, y + 9, 13, 4);
        ctx.fillStyle = '#c7dad2'; ctx.fillRect(x + 16, y + 9, w - 29, 2);
        ctx.fillStyle = '#e6eee2'; ctx.fillRect(x + w - 10, y + 10, 5, 7);
      }
    }
  }

  sprite(id, stride = 0) {
    const player = id === 1 ? 1 : 0, key = player * 3 + stride + 1;
    if (this.sprites.has(key)) return this.sprites.get(key);
    const canvas = canvasLayer(64, 64), ctx = canvas.getContext('2d'), p = NINJAS[player];
    ctx.translate(32, 32);
    // Facing is +X. Cloth, mask, and boots stay within the 15 px body radius.
    ctx.fillStyle = p.ink; ctx.fillRect(-12 - stride, -10, 9, 6); ctx.fillRect(-12 + stride, 4, 9, 6);
    ctx.fillStyle = p.edge; ctx.fillRect(-11 - stride, -9, 5, 1); ctx.fillRect(-11 + stride, 8, 5, 1);
    polygon(ctx, [[-12, -7], [-6, -12], [6, -11], [13, -5], [14, 4], [7, 11], [-6, 12], [-12, 7]], p.ink);
    ctx.fillStyle = p.cloth; ctx.fillRect(-10, -7, 18, 14);
    ctx.fillStyle = p.shade; ctx.fillRect(-9, -6, 7, 12);
    ctx.fillStyle = p.edge; ctx.fillRect(-9, -7, 12, 2); ctx.fillRect(-8, -4, 4, 2);
    ctx.fillStyle = p.sash; ctx.fillRect(-5, -8, 3, 16); ctx.fillRect(-8, 5, 10, 3);
    ctx.fillStyle = p.pale; ctx.fillRect(-5, -5, 1, 9); ctx.fillRect(-6, 6, 5, 1);
    polygon(ctx, [[-6, -8], [0, -12], [6, -10], [8, -6], [4, -4], [-3, -5]], p.cloth);
    polygon(ctx, [[-6, 8], [0, 12], [6, 10], [8, 6], [4, 4], [-3, 5]], p.shade);
    ctx.fillStyle = p.edge; ctx.fillRect(-2, -11, 5, 2); ctx.fillRect(-2, 9, 5, 2);
    // A wrapped hood and vertical eye slit make the facing unambiguous.
    polygon(ctx, [[0, -8], [7, -10], [12, -6], [14, -2], [14, 4], [9, 9], [1, 8], [-2, 3], [-2, -3]], p.ink);
    polygon(ctx, [[0, -6], [6, -8], [11, -5], [12, -1], [12, 4], [8, 7], [1, 6], [-1, 2], [-1, -2]], p.cloth);
    ctx.fillStyle = p.edge; ctx.fillRect(1, -6, 6, 2); ctx.fillRect(7, -5, 3, 2);
    ctx.fillStyle = p.sash; ctx.fillRect(0, -2, 10, 2);
    ctx.fillStyle = '#101d29'; ctx.fillRect(10, -4, 3, 9);
    ctx.fillStyle = '#dbb79b'; ctx.fillRect(11, -3, 1, 6);
    ctx.fillStyle = p.pale; ctx.fillRect(11, -3, 2, 2); ctx.fillRect(11, 2, 2, 2);
    ctx.fillStyle = p.shade; ctx.fillRect(3, 3, 7, 3); ctx.fillRect(1, 4, 4, 3);
    // A short tied ribbon is dim cloth rather than a glowing hurtbox extension.
    polygon(ctx, [[-7, 1], [-14, 2], [-16, 6], [-11, 4], [-8, 5]], p.sash);
    ctx.fillStyle = p.pale; ctx.fillRect(-13, 3, 3, 1);
    this.sprites.set(key, canvas); return canvas;
  }

  observeEvents(state) {
    if (state.tick < this.lastTick) this.resetEffects(); this.lastTick = state.tick;
    for (const event of state.events || []) {
      if (this.seenEvents.has(event.id)) continue;
      this.seenEvents.add(event.id); this.eventOrder.push(event.id);
      if (this.eventOrder.length > 256) this.seenEvents.delete(this.eventOrder.shift());
      if (!Number.isFinite(event.x) || !Number.isFinite(event.y)) continue;
      const p = NINJAS[event.fighter ?? event.owner ?? 0] || NINJAS[0];
      if (event.type === 'hit' && event.target != null) this.hitFlash[event.target] = .13;
      const impact = event.type !== 'parry' || event.target != null;
      if (impact && ['hit', 'parry', 'deflect', 'cover', 'dash'].includes(event.type)) {
        const clash = ['parry', 'deflect'].includes(event.type);
        this.bursts.push({ x: event.x, y: event.y, age: 0, life: this.reducedMotion ? .12 : clash ? .26 : .18, type: event.type, color: clash ? '#fff0bb' : event.type === 'cover' ? '#d6ddd0' : p.pale, angle: event.id * .7 });
        const count = this.reducedMotion || event.type === 'dash' ? 0 : clash ? 10 : event.type === 'hit' ? 7 : 4;
        for (let i = 0; i < count; i++) {
          const angle = event.id * .93 + i * 2.399, speed = clash ? 80 + i * 5 : 38 + i * 7;
          this.particles.push({ x: event.x, y: event.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, age: 0, life: .12 + i % 3 * .035, color: clash ? '#ffdda0' : p.pale });
        }
      }
    }
    if (this.particles.length > 96) this.particles.splice(0, this.particles.length - 96);
    if (this.bursts.length > 20) this.bursts.splice(0, this.bursts.length - 20);
  }

  paintBlade(ctx, angle, length, color, active = false) {
    ctx.save(); ctx.rotate(angle);
    ctx.fillStyle = '#111f2c'; ctx.fillRect(8, -4, 10, 7);
    ctx.fillStyle = color.sash; ctx.fillRect(10, -3, 6, 5);
    ctx.fillStyle = '#dfc084'; ctx.fillRect(17, -5, 3, 10);
    polygon(ctx, [[20, -2], [length - 5, -2], [length, -4], [length - 3, 1], [20, 3]], active ? '#fff1c7' : '#b5cbd0');
    line(ctx, [[21, -1], [length - 5, -1], [length - 1, -3]], active ? '#ffffff' : '#e4ece0', 1);
    line(ctx, [[22, 2], [length - 6, 0]], '#4e7184', 1);
    ctx.restore();
  }

  clipWeapons(ctx, fighter, facing, obstacles) {
    // Return temporarily to world coordinates. Paths retain their transformed
    // geometry after restore; clipping is applied to the weapon-only save scope.
    ctx.save(); ctx.rotate(-facing); ctx.translate(-fighter.x, -fighter.y);
    ctx.beginPath(); ctx.rect(WORLD.wall, WORLD.wall, WORLD.width - WORLD.wall * 2, WORLD.height - WORLD.wall * 2);
    ctx.restore();
    ctx.clip();
    for (const cover of obstacles) {
      const points = [[cover.x, cover.y], [cover.x + cover.w, cover.y], [cover.x + cover.w, cover.y + cover.h], [cover.x, cover.y + cover.h]];
      for (let i = 0; i < 4; i++) {
        const point = points[i], dx = point[0] - fighter.x, dy = point[1] - fighter.y;
        const scale = 4096 / Math.max(.001, Math.hypot(dx, dy));
        points.push([fighter.x + dx * scale, fighter.y + dy * scale]);
      }
      // Cover plus its angular shadow forms one convex silhouette. Applying
      // each exclusion separately avoids overlapping even-odd holes cancelling.
      const hull = convexHull(points);
      ctx.save(); ctx.rotate(-facing); ctx.translate(-fighter.x, -fighter.y);
      ctx.beginPath(); ctx.rect(0, 0, WORLD.width, WORLD.height);
      for (let i = 0; i < hull.length; i++) i ? ctx.lineTo(...hull[i]) : ctx.moveTo(...hull[i]);
      ctx.closePath(); ctx.restore(); ctx.clip('evenodd');
    }
  }

  paintFighter(ctx, fighter, tick, ghost = false, obstacles = []) {
    const p = NINJAS[fighter.id] || NINJAS[0], action = fighter.action || 'idle', frame = fighter.actionFrame || 0;
    const move = moveFor(action), committed = !!move || action === 'throw' || action === 'parry';
    const facing = committed ? fighter.actionFacing ?? fighter.facing : fighter.facing || 0;
    ctx.save(); ctx.translate(fighter.x, fighter.y);
    if (!ghost) {
      ctx.fillStyle = '#0a1d2c50'; ctx.beginPath(); ctx.ellipse(1, 3, 15, 12, 0, 0, TAU); ctx.fill();
      if (action === 'dash') ring(ctx, 0, 0, fighter.radius, fighter.invulnerable ? p.pale + 'aa' : p.sash + '55');
    } else ctx.globalAlpha *= .22;
    if (fighter.hp <= 0) ctx.globalAlpha *= .48;
    ctx.rotate(facing);
    const stride = action === 'run' && !this.reducedMotion ? Math.floor(tick / 6) % 3 - 1 : 0;
    ctx.drawImage(this.sprite(fighter.id, stride), -32, -32);
    if (!ghost) {
      ctx.save();
      this.clipWeapons(ctx, fighter, facing, obstacles);
      const startup = move?.startup ?? move?.startupTicks ?? 0, activeTicks = move?.active ?? move?.activeTicks ?? 0;
      const active = !!move && frame >= startup && frame < startup + activeTicks;
      if (move) {
        const cone = move.cone ?? .8, reach = move.range ?? 58;
        if (active) {
          const progress = clamp((frame - startup) / Math.max(1, activeTicks - 1), 0, 1);
          const angle = -cone + cone * 2 * progress;
          // Every active tick checks the whole sector, not just the animated blade tip.
          ctx.beginPath(); ctx.arc(0, 0, reach - .75, -cone, cone);
          ctx.strokeStyle = p.pale + '55'; ctx.lineWidth = 1.5; ctx.stroke();
          const width = action === 'heavy' ? 4 : 3;
          ctx.beginPath(); ctx.arc(0, 0, reach - width / 2, -cone, angle + .02);
          ctx.strokeStyle = p.pale + 'b0'; ctx.lineWidth = width; ctx.stroke();
          if (!this.reducedMotion) {
            ctx.beginPath(); ctx.arc(0, 0, reach - 5, Math.max(-cone, angle - .3), angle + .02);
            ctx.strokeStyle = p.sash + '45'; ctx.lineWidth = 8; ctx.stroke();
          }
          this.paintBlade(ctx, angle, reach - 2, p, true);
        } else if (frame < startup) {
          this.paintBlade(ctx, -2.1 + .3 * clamp(frame / Math.max(1, startup), 0, 1), 39, p);
          if (action === 'heavy' && frame > startup - 10) {
            line(ctx, [[-19, -15], [-23, -21]], p.sash, 2); line(ctx, [[-10, -21], [-11, -27]], p.pale, 2);
          }
        } else {
          const recovery = move.recovery ?? move.recoveryTicks ?? 23, progress = clamp((frame - startup - activeTicks) / Math.max(1, recovery), 0, 1);
          this.paintBlade(ctx, cone + (1.1 - cone) * progress, 39, p);
        }
      } else if (action === 'parry') {
        const start = PARRY.activeStart ?? PARRY.startup ?? 3, end = PARRY.activeEnd ?? 13;
        const active = frame >= start && frame <= end;
        this.paintBlade(ctx, -.8, 34, p, active);
        const cone = PARRY.cone ?? .95;
        ctx.beginPath(); ctx.arc(0, 0, 24, -cone, cone); ctx.strokeStyle = active ? '#ffe9ae' : p.sash + '70'; ctx.lineWidth = active ? 3 : 1; ctx.stroke();
        if (active) { ctx.fillStyle = '#fff4c6'; ctx.fillRect(26, -2, 4, 4); }
      } else if (action === 'throw') {
        const released = frame >= KUNAI.startup;
        ctx.fillStyle = p.sash; ctx.fillRect(released ? 10 : 3, -11, 7, 4);
        if (!released) {
          polygon(ctx, [[9, -12], [14, -15], [17, -12], [14, -10]], '#dce8df');
          ctx.fillStyle = '#adbfc0'; ctx.fillRect(7, -12, 4, 2);
        }
        this.paintBlade(ctx, 1.35, 31, p);
      } else this.paintBlade(ctx, 1.1, 33, p);
      ctx.restore();
      if (this.hitFlash[fighter.id] > 0) ring(ctx, 0, 0, fighter.radius, p.pale, 2);
    }
    ctx.restore();
    if (!ghost && fighter.hp > 0) {
      ctx.fillStyle = '#102431'; ctx.fillRect(fighter.x - 17, fighter.y - 26, 34, 5);
      ctx.fillStyle = p.sash; ctx.fillRect(fighter.x - 16, fighter.y - 25, 32 * clamp(fighter.hp / (fighter.maxHp || 100), 0, 1), 3);
      ctx.fillStyle = p.pale; ctx.fillRect(fighter.x - 16, fighter.y - 25, 32 * clamp(fighter.hp / (fighter.maxHp || 100), 0, 1), 1);
    }
  }

  paintProjectile(ctx, projectile) {
    const p = NINJAS[projectile.owner] || NINJAS[0], radius = projectile.radius ?? 3;
    const speed = Math.hypot(projectile.vx, projectile.vy) || 1, dx = projectile.vx / speed, dy = projectile.vy / speed;
    line(ctx, [[projectile.x - dx * 13, projectile.y - dy * 13], [projectile.x - dx * 3, projectile.y - dy * 3]], p.sash + 'a0', 2);
    // The luminous point is the engine's exact circular 3 px contact shape.
    circle(ctx, projectile.x, projectile.y, radius, projectile.reflections ? '#fff2c1' : p.pale);
    ctx.save(); ctx.translate(projectile.x, projectile.y); ctx.rotate(Math.atan2(dy, dx));
    polygon(ctx, [[-2, -1], [2, 0], [-2, 1], [-1, 0]], '#516b7b'); ctx.restore();
  }

  paintEffects(ctx, dt) {
    let live = 0;
    for (const effect of this.bursts) if ((effect.age += dt) < effect.life) this.bursts[live++] = effect;
    this.bursts.length = live;
    for (const effect of this.bursts) {
      ctx.save(); ctx.translate(effect.x, effect.y); ctx.globalAlpha = 1 - effect.age / effect.life;
      const clash = effect.type === 'parry' || effect.type === 'deflect';
      if (effect.type === 'dash') ring(ctx, 0, 0, 15 + (this.reducedMotion ? 0 : effect.age * 26), effect.color + '90');
      else {
        ctx.rotate(effect.angle);
        const length = clash ? 17 : effect.type === 'hit' ? 12 : 8;
        for (let i = 0; i < 4; i++) {
          ctx.rotate(Math.PI / 2); line(ctx, [[4, 0], [length, 0]], '#203c49', 4); line(ctx, [[4, 0], [length, 0]], effect.color, 2);
        }
        ring(ctx, 0, 0, clash ? 6 : 3, effect.color, 1);
      }
      ctx.restore();
    }
    live = 0;
    for (const particle of this.particles) if ((particle.age += dt) < particle.life) this.particles[live++] = particle;
    this.particles.length = live;
    for (const particle of this.particles) {
      particle.x += particle.vx * dt; particle.y += particle.vy * dt;
      ctx.globalAlpha = 1 - particle.age / particle.life; ctx.fillStyle = particle.color;
      ctx.fillRect(Math.round(particle.x) - 1, Math.round(particle.y) - 1, 2, 2);
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < this.hitFlash.length; i++) this.hitFlash[i] = Math.max(0, this.hitFlash[i] - dt);
  }

  paintLocalHUD(ctx, fighter, aimTarget, phase, id) {
    if (!fighter) return;
    const p = NINJAS[fighter.id] || NINJAS[0];
    ring(ctx, fighter.x, fighter.y, fighter.radius ?? 15, p.pale + '55');
    if (phase === 'fight' && fighter.hp > 0) {
      const x = aimTarget?.x ?? fighter.x + (fighter.aimX ?? Math.cos(fighter.facing || 0)) * 105;
      const y = aimTarget?.y ?? fighter.y + (fighter.aimY ?? Math.sin(fighter.facing || 0)) * 105;
      line(ctx, [[x - 8, y], [x - 4, y]], p.pale, 1); line(ctx, [[x + 4, y], [x + 8, y]], p.pale, 1);
      line(ctx, [[x, y - 8], [x, y - 4]], p.pale, 1); line(ctx, [[x, y + 4], [x, y + 8]], p.pale, 1);
      circle(ctx, x, y, 1, p.pale);
    }
    ctx.fillStyle = SCENES[id]?.ink || SCENES.rooftop.ink; ctx.fillRect(294, 608, 372, 32);
    ctx.fillStyle = '#b5c7c465'; ctx.fillRect(294, 608, 372, 1);
    ctx.textAlign = 'left'; ctx.font = '9px Consolas, monospace'; ctx.fillStyle = '#d8e3d7'; ctx.fillText('KUNAI', 310, 627);
    for (let i = 0; i < KUNAI.capacity; i++) {
      const color = i < fighter.kunai ? p.pale : '#506b71';
      polygon(ctx, [[354 + i * 13, 619], [357 + i * 13, 622], [354 + i * 13, 629], [351 + i * 13, 622]], color);
    }
    ctx.fillStyle = '#597175'; ctx.fillRect(399, 616, 1, 15);
    ctx.fillStyle = '#d8e3d7'; ctx.fillText('STAMINA', 416, 627);
    ctx.fillStyle = '#38515a'; ctx.fillRect(479, 620, 93, 6);
    ctx.fillStyle = fighter.stamina >= (DASH.cost ?? 30) ? p.sash : '#a98b70';
    ctx.fillRect(479, 620, 93 * clamp(fighter.stamina / 100, 0, 1), 6);
    ctx.fillStyle = fighter.stamina >= (PARRY.cost ?? 20) ? p.pale : '#758a89'; ctx.fillText('PARRY', 590, 627);
  }

  render(state, { localId = null, time = performance.now(), aimTarget = null } = {}) {
    const active = state.phase === 'fight' && !state.paused;
    const dt = active && this.lastTime != null ? Math.min(.05, Math.max(0, (time - this.lastTime) / 1000)) : 0;
    this.lastTime = time; this.observeEvents(state);
    const ctx = this.ctx, stageId = Object.hasOwn(SCENES, state.stageId) ? state.stageId : 'rooftop';
    ctx.setTransform(this.canvas.width / WORLD.width, 0, 0, this.canvas.height / WORLD.height, 0, 0);
    ctx.imageSmoothingEnabled = false; ctx.globalAlpha = 1;
    const scene = this.scene(stageId, state.obstacles), fighters = state.fighters || [];
    if (active && !this.reducedMotion) for (const fighter of fighters) {
      if (fighter.action === 'dash' && fighter.invulnerable && state.tick - this.lastGhost[fighter.id] >= 3) {
        this.ghosts.push({ id: fighter.id, x: fighter.x, y: fighter.y, facing: fighter.facing, age: 0 });
        this.lastGhost[fighter.id] = state.tick;
      }
    }
    if (this.ghosts.length > 12) this.ghosts.splice(0, this.ghosts.length - 12);
    let live = 0;
    for (const ghost of this.ghosts) if ((ghost.age += dt) < .12) this.ghosts[live++] = ghost;
    this.ghosts.length = live;
    if (live) {
      ctx.drawImage(this.background(stageId), 0, 0);
      for (const ghost of this.ghosts) {
        ctx.save(); ctx.globalAlpha = (1 - ghost.age / .12) * .22; ctx.translate(ghost.x, ghost.y); ctx.rotate(ghost.facing || 0);
        ctx.drawImage(this.sprite(ghost.id), -32, -32); ctx.restore();
      }
      ctx.drawImage(scene.coverLayer, 0, 0);
    } else ctx.drawImage(scene.canvas, 0, 0);
    for (const projectile of state.projectiles || []) this.paintProjectile(ctx, projectile);
    // Two actors require no general scene sort or per-frame asset allocations.
    const obstacles = state.obstacles || STAGES[stageId].covers;
    if (fighters.length === 2 && fighters[0].y > fighters[1].y) {
      this.paintFighter(ctx, fighters[1], state.tick, false, obstacles); this.paintFighter(ctx, fighters[0], state.tick, false, obstacles);
    } else for (const fighter of fighters) this.paintFighter(ctx, fighter, state.tick, false, obstacles);
    this.paintEffects(ctx, dt);
    if (localId != null) this.paintLocalHUD(ctx, fighters.find(fighter => fighter.id === localId), aimTarget, state.phase, stageId);
    else {
      ctx.fillStyle = SCENES[stageId].light; ctx.textAlign = 'center'; ctx.font = '9px Consolas, monospace';
      ctx.fillText('READ THE BLADE  /  PARRY THE STRIKE  /  OWN THE ANGLE', WORLD.width / 2, 627);
    }
  }
}
