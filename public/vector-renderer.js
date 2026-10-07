import { WORLD, STAGES, WEAPON, DASH } from './vector-engine.js';

const COLORS = [
  { main: '#eaae79', light: '#ffe2b3', dark: '#905e44', suit: '#4c433b', visor: '#deebd8' },
  { main: '#8fc9b0', light: '#e0f4d6', dark: '#497c6a', suit: '#354b48', visor: '#e0eed5' },
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
    this.backgrounds = new Map();
    this.coverLayers = new Map();
    this.background = this.stageBackground('garden');
    this.motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reducedMotion = this.motionQuery.matches;
    this.motionChange = () => {
      this.reducedMotion = this.motionQuery.matches;
      if (this.reducedMotion) { this.ghosts = []; this.particles = []; }
    };
    this.motionQuery.addEventListener('change', this.motionChange);
    this.resize = this.resize.bind(this);
    this.observer = new ResizeObserver(this.resize); this.observer.observe(canvas);
    this.resetEffects(); this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width * dpr)), height = Math.max(1, Math.round(rect.height * dpr));
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
  }

  resetEffects() {
    this.particles = []; this.rings = []; this.ghosts = []; this.impacts = []; this.seen = new Set();
    this.eventOrder = []; this.lastTick = -1; this.lastTime = 0; this.lastGhost = [-1, -1]; this.hitFlash = [0, 0];
  }

  destroy() { this.observer.disconnect(); this.motionQuery.removeEventListener('change', this.motionChange); this.resetEffects(); this.backgrounds.clear(); this.coverLayers.clear(); }

  stageBackground(id) {
    const stageId = Object.hasOwn(STAGES, id) ? id : 'garden';
    if (this.backgrounds.has(stageId)) return this.backgrounds.get(stageId);
    const layer = document.createElement('canvas'); layer.width = WORLD.width; layer.height = WORLD.height;
    this.paintBackground(layer.getContext('2d'), stageId);
    this.paintArenaDetails(layer.getContext('2d'), stageId);
    this.backgrounds.set(stageId, layer);
    return layer;
  }

  stageCovers(id, obstacles) {
    const stageId = Object.hasOwn(STAGES, id) ? id : 'garden';
    const covers = obstacles || STAGES[stageId].covers;
    let cached = this.coverLayers.get(stageId);
    // Snapshots can contain fresh arrays with identical geometry. Compare the
    // coordinates directly instead of allocating arrays and signature strings.
    let same = cached?.geometry.length === covers.length * 4;
    for (let i = 0; same && i < covers.length; i++) {
      const c = covers[i], j = i * 4, g = cached.geometry;
      same = g[j] === c.x && g[j + 1] === c.y && g[j + 2] === c.w && g[j + 3] === c.h;
    }
    if (same) return cached;
    const layer = document.createElement('canvas'); layer.width = WORLD.width; layer.height = WORLD.height;
    const ctx = layer.getContext('2d');
    for (const cover of covers) this.paintCover(ctx, cover, stageId);
    const geometry = new Float64Array(covers.length * 4);
    for (let i = 0; i < covers.length; i++) { const c = covers[i], j = i * 4; geometry[j] = c.x; geometry[j + 1] = c.y; geometry[j + 2] = c.w; geometry[j + 3] = c.h; }
    cached = { layer, geometry, scene: null };
    this.coverLayers.set(stageId, cached);
    if (this.coverLayers.size > 3) this.coverLayers.delete(this.coverLayers.keys().next().value);
    return cached;
  }

  stageScene(stageId, covers) {
    if (!covers.scene) {
      const scene = document.createElement('canvas'); scene.width = WORLD.width; scene.height = WORLD.height;
      const ctx = scene.getContext('2d', { alpha: false });
      ctx.drawImage(this.stageBackground(stageId), 0, 0); ctx.drawImage(covers.layer, 0, 0);
      covers.scene = scene;
    }
    return covers.scene;
  }

  paintArenaDetails(ctx, stageId) {
    // Flush service plates and painted markings enrich each arena without
    // suggesting additional walls or concealing an opponent's position.
    const palette = stageId === 'garden' ? ['#4e6849', '#81966a', '#152e25']
      : stageId === 'relay' ? ['#516c6c', '#9faf9a', '#243b3e'] : ['#695f80', '#baacbc', '#2b334c'];
    for (const mirror of [false, true]) {
      ctx.save(); if (mirror) { ctx.translate(WORLD.width, 0); ctx.scale(-1, 1); }
      for (const y of [57, 552]) {
        ctx.fillStyle = '#0e24294d'; ctx.fillRect(62, y, 113, 31);
        ctx.fillStyle = palette[0]; ctx.fillRect(64, y + 2, 109, 27);
        ctx.fillStyle = palette[1]; ctx.fillRect(66, y + 3, 105, 1);
        ctx.fillStyle = palette[2]; ctx.fillRect(70, y + 7, 72, 16);
        for (let x = 75; x < 140; x += 9) { ctx.fillStyle = palette[0]; ctx.fillRect(x, y + 8, 3, 14); }
        ctx.fillStyle = '#aeb790'; ctx.fillRect(151, y + 8, 13, 3);
        ctx.fillStyle = '#adc69a66'; ctx.fillRect(151, y + 15, 6, 6);
      }
      if (stageId === 'garden') {
        // Moss stays on the wall edge; isolated small leaves are flat litter.
        for (const y of [164, 451]) for (let i = 0; i < 6; i += 1) {
          const x = 19 + i % 3 * 6, py = y + Math.floor(i / 3) * 11;
          polygon(ctx, [[x, py], [x + 8, py - 5], [x + 13, py], [x + 7, py + 5]], i % 2 ? '#668352' : '#456b44');
          path(ctx, [[x + 2, py], [x + 10, py]], '#9bb47766');
        }
        ctx.globalAlpha = .2;
        for (const [x, y] of [[211, 297], [376, 445], [155, 191]]) {
          polygon(ctx, [[x, y], [x + 10, y - 6], [x + 17, y - 1], [x + 9, y + 3]], '#bdad7b');
        }
        ctx.globalAlpha = 1;
      } else if (stageId === 'relay') {
        for (let y = 101; y < 551; y += 74) {
          path(ctx, [[37, y], [51, y]], '#d4b98688', 3);
          path(ctx, [[37, y + 6], [46, y + 6]], '#172b32', 3);
        }
        ctx.globalAlpha = .35;
        for (const y of [225, 400]) {
          path(ctx, [[218, y], [365, y]], '#a0ada2', 2);
          polygon(ctx, [[365, y - 5], [375, y], [365, y + 5]], '#a0ada2');
        }
        ctx.globalAlpha = 1;
      } else {
        for (const [x, y] of [[81, 132], [81, 508]]) {
          ring(ctx, x, y, 17, '#ac9aad66'); ring(ctx, x, y, 12, '#c0b49444');
          polygon(ctx, [[x, y - 7], [x + 7, y], [x, y + 7], [x - 7, y]], '#a0aba277');
        }
      }
      ctx.restore();
    }
    // Directional numeral stencils are deliberately less bright than bullets.
    ctx.save(); ctx.globalAlpha = .32; ctx.font = 'bold 17px Consolas, monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = palette[1]; ctx.fillText('01', 112, 321); ctx.fillText('02', 848, 321); ctx.restore();
  }

  paintBackground(ctx, stageId = 'garden') {
    if (stageId !== 'garden') { this.paintStageBackground(ctx, STAGES[stageId]); return; }
    const random = rng(44108), { width, height, wall } = WORLD;
    ctx.fillStyle = '#0c211f'; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#253a35'; ctx.fillRect(wall, wall, width - wall * 2, height - wall * 2);
    // Reclaimed slate slabs. Texture stays quieter than actors and projectiles.
    for (let y = wall; y < height - wall; y += 48) for (let x = wall; x < width - wall; x += 48) {
      const tone = ['#2c403a', '#293d37', '#2e4139', '#2b3e38'][Math.floor(random() * 4)];
      ctx.fillStyle = tone; ctx.fillRect(x + 1, y + 1, 46, 46);
      ctx.fillStyle = '#7585751b'; ctx.fillRect(x + 2, y + 1, 43, 1);
      ctx.fillStyle = '#102a2355'; ctx.fillRect(x + 45, y + 2, 2, 44);
      if (random() > .65) {
        ctx.fillStyle = '#99a78b0c'; ctx.fillRect(x + 8, y + 7, 23, 2);
        ctx.fillStyle = '#172e272b'; ctx.fillRect(x + 17, y + 30, 16, 1);
      }
      if (random() > .87) path(ctx, [[x + 38, y + 2], [x + 34, y + 12], [x + 39, y + 18]], '#17302944');
    }
    // Symmetric copper inlays describe routes without pretending to be cover.
    for (const mirror of [false, true]) {
      ctx.save(); if (mirror) { ctx.translate(width, 0); ctx.scale(-1, 1); }
      path(ctx, [[80, 124], [178, 124], [178, 78], [398, 78], [398, 149]], '#172c27', 5);
      path(ctx, [[80, 124], [178, 124], [178, 78], [398, 78], [398, 149]], '#96876645', 1);
      path(ctx, [[80, 516], [178, 516], [178, 562], [398, 562], [398, 491]], '#172c27', 5);
      path(ctx, [[80, 516], [178, 516], [178, 562], [398, 562], [398, 491]], '#96876645', 1);
      for (const y of [78, 562]) {
        ctx.fillStyle = '#21362c'; ctx.fillRect(174, y - 4, 8, 8);
        ctx.fillStyle = '#9da97d66'; ctx.fillRect(176, y - 2, 4, 4);
      }
      // Worn spawn markings and recessed drainage channels along the perimeter.
      path(ctx, [[76, 264], [118, 264], [130, 276]], '#95a18422', 2);
      path(ctx, [[76, 376], [118, 376], [130, 364]], '#95a18422', 2);
      ctx.fillStyle = '#163028'; ctx.fillRect(40, 74, 10, 492);
      for (let y = 78; y < 565; y += 12) { ctx.fillStyle = '#60765b44'; ctx.fillRect(41, y, 8, 2); }
      for (const y of [176, 464]) {
        ctx.fillStyle = '#213a2e'; ctx.fillRect(60, y, 35, 6);
        ctx.fillStyle = '#7c93693b'; ctx.fillRect(66, y, 15, 2);
      }
      ctx.restore();
    }
    // The garden's compass plate is flush with the slate floor.
    ctx.fillStyle = '#34483d'; ctx.beginPath(); ctx.arc(480, 320, 65, 0, Math.PI * 2); ctx.fill();
    ring(ctx, 480, 320, 65, '#7b866349', 2); ring(ctx, 480, 320, 57, '#a9a58126');
    for (let i = 0; i < 8; i++) {
      ctx.save(); ctx.translate(480, 320); ctx.rotate(i * Math.PI / 4);
      path(ctx, [[0, -59], [0, -53]], '#b0ae7c4c', 2); ctx.restore();
    }
    polygon(ctx, [[480, 291], [509, 320], [480, 349], [451, 320]], '#243c32');
    path(ctx, [[480, 296], [504, 320], [480, 344], [456, 320], [480, 296]], '#a4ac8166', 2);
    polygon(ctx, [[480, 307], [492, 320], [480, 333], [468, 320]], '#6e856375');
    for (const [x, color] of [[154, '#dc9e7255'], [806, '#91c6a955']]) {
      ring(ctx, x, 320, 34, color); ring(ctx, x, 320, 30, '#122c2440');
      for (const y of [-26, 26]) path(ctx, [[x - 12, 320 + y], [x + 12, 320 + y]], color);
    }
    // Warm retaining stone surrounds the exact walkable wall line.
    for (const y of [0, height - wall]) {
      ctx.fillStyle = '#192f27'; ctx.fillRect(0, y, width, wall);
      for (let x = 0; x < width; x += 64) {
        ctx.fillStyle = '#4b5d47'; ctx.fillRect(x + 1, y + 2, 61, wall - 4);
        ctx.fillStyle = '#9aab8055'; ctx.fillRect(x + 2, y + 2, 60, 2);
        ctx.fillStyle = '#21392c'; ctx.fillRect(x + 3, y + wall - 6, 58, 4);
      }
    }
    for (const x of [0, width - wall]) {
      ctx.fillStyle = '#183329'; ctx.fillRect(x, wall, wall, height - wall * 2);
      for (let y = wall; y < height - wall; y += 40) {
        ctx.fillStyle = '#455d42'; ctx.fillRect(x + 2, y + 2, wall - 4, 37);
        ctx.fillStyle = '#849c6b55'; ctx.fillRect(x + 3, y + 2, 2, 33);
      }
    }
    ctx.fillStyle = '#10282270'; ctx.fillRect(wall, wall, width - wall * 2, 5); ctx.fillRect(wall, wall, 4, height - wall * 2);
    // Ferns and moss belong to the border, leaving the combat lanes uncluttered.
    for (const [x, y, sx, sy] of [[8, 6, 1, 1], [width - 8, 6, -1, 1], [8, height - 6, 1, -1], [width - 8, height - 6, -1, -1]]) {
      ctx.save(); ctx.translate(x, y); ctx.scale(sx, sy);
      for (let i = 0; i < 20; i++) {
        const px = -12 + random() * 58, py = -14 + random() * 48, size = 6 + random() * 15;
        ctx.fillStyle = ['#173c29', '#254d31', '#355c39', '#446b40'][i % 4];
        polygon(ctx, [[px, py], [px + size * .3, py - 4], [px + size, py], [px + size, py + size * .6], [px + 2, py + size]], ctx.fillStyle);
        ctx.fillStyle = '#a4b57525'; ctx.fillRect(px + 3, py + 2, size * .5, 2);
      }
      path(ctx, [[13, 0], [20, 22], [14, 43]], '#a0af7355', 2);
      for (let i = 0; i < 5; i++) {
        const py = 6 + i * 7; path(ctx, [[18, py], [7, py - 6]], '#6d9653', 3); path(ctx, [[18, py + 3], [29, py - 1]], '#456e3c', 3);
      }
      ctx.restore();
    }
    // Equipment markings remain on the non-playable border.
    ctx.fillStyle = '#182e26'; ctx.fillRect(278, 0, 404, wall);
    ctx.fillStyle = '#d1d6b9'; ctx.font = 'bold 11px Consolas, monospace'; ctx.textAlign = 'center';
    ctx.fillText('VECTOR ARENA', width / 2, 20);
    ctx.fillStyle = '#96aa84'; ctx.font = '8px Consolas, monospace'; ctx.textAlign = 'left'; ctx.fillText('FIELD / 04', 60, 20);
    ctx.textAlign = 'right'; ctx.fillText('RECLAIMED GRID', 900, 20);
    ctx.fillStyle = '#c59867'; ctx.fillRect(307, 14, 28, 3); ctx.fillStyle = '#80b096'; ctx.fillRect(625, 14, 28, 3);
  }

  paintStageBackground(ctx, stage) {
    const relay = stage.id === 'relay', { width, height, wall } = WORLD;
    ctx.fillStyle = relay ? '#192628' : '#181f31'; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = relay ? '#334246' : '#30394d'; ctx.fillRect(wall, wall, width - wall * 2, height - wall * 2);
    if (relay) {
      // Riveted steel sheets, cable ducts and recessed grates are flat floor detail.
      for (let y = wall; y < height - wall; y += 64) for (let x = wall; x < width - wall; x += 64) {
        ctx.fillStyle = (x + y) % 128 ? '#34464a' : '#304246'; ctx.fillRect(x + 1, y + 1, 62, 62);
        ctx.fillStyle = '#65777a44'; ctx.fillRect(x + 2, y + 2, 59, 1);
        for (const offset of [4, 57]) { ctx.fillStyle = '#162e32'; ctx.fillRect(x + offset, y + 4, 2, 2); ctx.fillRect(x + offset, y + 57, 2, 2); }
        for (let offset = 9; offset < 54; offset += 11) path(ctx, [[x + offset, y + 25], [x + offset + 5, y + 20], [x + offset + 10, y + 25]], '#5d72721b');
      }
      for (const x of [386, 565]) {
        ctx.fillStyle = '#1e353a'; ctx.fillRect(x, 64, 9, 512);
        ctx.fillStyle = '#91a19444'; ctx.fillRect(x + 3, 65, 2, 510);
        for (let y = 77; y < 569; y += 24) { ctx.fillStyle = '#758977'; ctx.fillRect(x + 1, y, 7, 2); }
      }
      for (const [x, y] of [[82, 232], [772, 232], [82, 363], [772, 363]]) {
        ctx.fillStyle = '#1c3439'; ctx.fillRect(x, y, 106, 42);
        for (let offset = 4; offset < 101; offset += 8) { ctx.fillStyle = '#536764'; ctx.fillRect(x + offset, y + 4, 3, 34); }
        ctx.strokeStyle = '#82918355'; ctx.strokeRect(x + .5, y + .5, 106, 42);
      }
      // The long cross marks the open travel channel around the center relay.
      path(ctx, [[70, 320], [405, 320]], '#a99c7255', 2); path(ctx, [[555, 320], [890, 320]], '#a99c7255', 2);
      for (const cover of stage.covers) for (const [x, y] of [[cover.x - 7, cover.y - 7], [cover.x + cover.w + 3, cover.y + cover.h + 3]]) {
        path(ctx, [[x, y + 7], [x + 7, y]], '#bda26d66', 3);
      }
    } else {
      // Observatory tessellation: dark slate hexagons and engraved star charts.
      for (let row = 0, y = 49; y < 603; y += 40, row++) for (let x = 50 + row % 2 * 34; x < 923; x += 68) {
        const points = [[x - 30, y], [x - 15, y - 18], [x + 15, y - 18], [x + 30, y], [x + 15, y + 18], [x - 15, y + 18]];
        polygon(ctx, points, row % 3 ? '#323e51' : '#344253');
        path(ctx, [...points, points[0]], '#6e81901b');
        ctx.fillStyle = '#90a59a24'; ctx.fillRect(x - 1, y - 1, 2, 2);
      }
      ring(ctx, 480, 320, 122, '#b6a78235', 2); ring(ctx, 480, 320, 113, '#819c9e35'); ring(ctx, 480, 320, 82, '#9faf962e');
      for (let i = 0; i < 24; i++) {
        const angle = i * Math.PI / 12;
        path(ctx, [[480 + Math.cos(angle) * 116, 320 + Math.sin(angle) * 116], [480 + Math.cos(angle) * 121, 320 + Math.sin(angle) * 121]], '#c1b48755', i % 3 ? 1 : 2);
      }
      polygon(ctx, [[480, 280], [492, 308], [520, 320], [492, 332], [480, 360], [468, 332], [440, 320], [468, 308]], '#8c9f9633');
      for (const [x, y] of [[83, 220], [877, 420], [363, 103], [597, 537]]) {
        ring(ctx, x, y, 16, '#b7b58b55'); path(ctx, [[x - 21, y], [x + 21, y]], '#b7b58b55'); path(ctx, [[x, y - 21], [x, y + 21]], '#b7b58b55');
      }
      for (const cover of stage.covers) { ctx.strokeStyle = '#baa78333'; ctx.lineWidth = 1; ctx.strokeRect(cover.x - 6.5, cover.y - 6.5, cover.w + 13, cover.h + 13); }
    }
    // Material-specific wall panels keep the exact same playable outer boundary.
    for (const y of [0, height - wall]) for (let x = 0; x < width; x += 64) {
      ctx.fillStyle = relay ? '#536462' : '#625d68'; ctx.fillRect(x + 1, y + 2, 61, wall - 4);
      ctx.fillStyle = relay ? '#9ea79566' : '#baad8e66'; ctx.fillRect(x + 2, y + 2, 59, 2);
      ctx.fillStyle = relay ? '#283f42' : '#33394c'; ctx.fillRect(x + 3, y + wall - 7, 58, 5);
    }
    for (const x of [0, width - wall]) for (let y = wall; y < height - wall; y += 40) {
      ctx.fillStyle = relay ? '#4b6060' : '#535d72'; ctx.fillRect(x + 2, y + 2, wall - 4, 37);
      ctx.fillStyle = relay ? '#9ba78b44' : '#b5a99144'; ctx.fillRect(x + 3, y + 2, 2, 33);
    }
    stage.spawns.forEach((spawn, i) => { ring(ctx, spawn.x, spawn.y, 32, i ? '#91c6a966' : '#dc9e7266'); ring(ctx, spawn.x, spawn.y, 28, '#172f3944'); });
    ctx.fillStyle = relay ? '#243b3b' : '#283447'; ctx.fillRect(278, 0, 404, wall);
    ctx.fillStyle = '#ded7bf'; ctx.font = 'bold 11px Consolas, monospace'; ctx.textAlign = 'center'; ctx.fillText(stage.name.toUpperCase(), 480, 20);
    ctx.fillStyle = '#a1b49f'; ctx.font = '8px Consolas, monospace'; ctx.textAlign = 'left'; ctx.fillText(relay ? 'FIELD / 05' : 'FIELD / 06', 60, 20);
    ctx.textAlign = 'right'; ctx.fillText(relay ? 'HARDLINE EXCHANGE' : 'CELESTIAL SIGHTLINES', 900, 20);
  }

  paintCover(ctx, cover, stageId = 'garden') {
    const { x, y, w, h } = cover;
    if (stageId === 'relay' || stageId === 'vault') {
      const relay = stageId === 'relay';
      ctx.fillStyle = '#0d1f2c55'; ctx.fillRect(x + 4, y + 6, w + 4, h + 3);
      ctx.fillStyle = relay ? '#182e34' : '#242c42'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = relay ? '#87948a' : '#9d9baa'; ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
      ctx.fillStyle = relay ? '#b5b99e' : '#c8bbaa'; ctx.fillRect(x + 2, y + 2, w - 4, 4);
      ctx.fillStyle = relay ? '#445d5c' : '#505e78'; ctx.fillRect(x + 6, y + 7, w - 12, h - 13);
      ctx.fillStyle = relay ? '#314d51' : '#34455f'; ctx.fillRect(x + 10, y + 11, w - 20, h - 22);
      if (relay) {
        for (let offset = 18; offset < w - 18; offset += 12) { ctx.fillStyle = '#849987'; ctx.fillRect(x + offset, y + 16, 4, h - 35); }
        ctx.fillStyle = '#baaa76'; ctx.fillRect(x + 8, y + h - 11, w - 16, 3);
        for (const ox of [7, w - 10]) for (const oy of [8, h - 11]) { ctx.fillStyle = '#d4cfac'; ctx.fillRect(x + ox, y + oy, 3, 2); }
        // The exact solid edge is brighter than its recessed cable grate.
        for (let offset = 12; offset < w - 12; offset += 18) {
          polygon(ctx, [[x + offset, y + h - 10], [x + offset + 6, y + h - 10], [x + offset + 3, y + h - 6], [x + offset - 3, y + h - 6]], '#253e43');
        }
      } else {
        path(ctx, [[x + 13, y + h / 2], [x + w / 2, y + 14], [x + w - 13, y + h / 2], [x + w / 2, y + h - 14], [x + 13, y + h / 2]], '#b5ae98', 2);
        ring(ctx, x + w / 2, y + h / 2, Math.min(9, h / 5), '#9fbab3', 2);
        ctx.fillStyle = '#d6dab7'; ctx.fillRect(x + w / 2 - 2, y + h / 2 - 2, 4, 4);
        for (const sign of [-1, 1]) {
          path(ctx, [[x + w / 2 + sign * 8, y + 11], [x + w / 2 + sign * 15, y + 15]], '#d8c6b377', 2);
          path(ctx, [[x + w / 2 + sign * 8, y + h - 11], [x + w / 2 + sign * 15, y + h - 15]], '#d8c6b377', 2);
        }
      }
      return;
    }
    // A directional shadow gives depth without extending the solid footprint.
    ctx.fillStyle = '#0c211e44'; ctx.fillRect(x + 4, y + 6, w + 4, h + 3);
    ctx.fillStyle = '#112b23'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#687c63'; ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    ctx.fillStyle = '#b0b493'; ctx.fillRect(x + 2, y + 2, w - 4, 4);
    ctx.fillStyle = '#95a480'; ctx.fillRect(x + 2, y + 6, 5, h - 10);
    ctx.fillStyle = '#334d3b'; ctx.fillRect(x + w - 7, y + 6, 5, h - 8); ctx.fillRect(x + 7, y + h - 8, w - 14, 6);
    ctx.fillStyle = '#8e9c7c'; ctx.fillRect(x + 8, y + 7, w - 16, h - 17);
    ctx.fillStyle = '#526c52'; ctx.fillRect(x + 11, y + 11, w - 22, h - 26);
    ctx.fillStyle = '#61785c'; ctx.fillRect(x + 12, y + 12, w - 24, h - 29);
    const cx = x + w / 2, cy = y + h / 2;
    // Slotted metal inserts distinguish solid cover from the darker floor.
    if (h > w) {
      for (let py = y + 22; py < y + h - 25; py += 10) {
        ctx.fillStyle = '#2f4939'; ctx.fillRect(x + 22, py, w - 44, 4);
        ctx.fillStyle = '#bac1a044'; ctx.fillRect(x + 22, py + 4, w - 44, 1);
      }
    } else {
      for (let px = x + 22; px < x + w - 23; px += 12) {
        ctx.fillStyle = '#314a3b'; ctx.fillRect(px, y + 17, 5, h - 35);
        ctx.fillStyle = '#b1b99255'; ctx.fillRect(px + 5, y + 17, 1, h - 35);
      }
    }
    ctx.fillStyle = '#425c45'; ctx.fillRect(cx - 12, cy - 12, 24, 24);
    path(ctx, [[cx, cy - 8], [cx + 8, cy], [cx, cy + 8], [cx - 8, cy], [cx, cy - 8]], '#c0c69e', 2);
    ctx.fillStyle = '#d8d9ac'; ctx.fillRect(cx - 2, cy - 2, 4, 4);
    for (const dx of [6, w - 9]) for (const dy of [8, h - 12]) {
      ctx.fillStyle = '#2e4835'; ctx.fillRect(x + dx - 1, y + dy - 1, 5, 5);
      ctx.fillStyle = '#d1cba1'; ctx.fillRect(x + dx, y + dy, 3, 2);
    }
    ctx.fillStyle = '#caa475'; ctx.fillRect(x + 11, y + h - 7, 16, 2);
    // Small, asymmetric weathering affects the material, never the geometry.
    path(ctx, [[x + w - 19, y + 8], [x + w - 22, y + 15], [x + w - 17, y + 22]], '#485f4199');
    ctx.fillStyle = '#6c8951'; ctx.fillRect(x + w - 19, y + 6, 11, 4); ctx.fillRect(x + w - 11, y + 9, 6, 7);
    ctx.fillStyle = '#96a56a'; ctx.fillRect(x + w - 16, y + 6, 6, 2);
    for (const [px, py] of [[x + 8, y + h - 17], [x + w - 11, y + 19]]) {
      polygon(ctx, [[px, py], [px + 6, py - 5], [px + 8, py + 3], [px + 2, py + 7]], '#5c814e');
      path(ctx, [[px + 1, py + 2], [px + 6, py - 1]], '#a8b279', 1);
    }
  }

  observeEvents(state) {
    if (state.tick < this.lastTick) this.resetEffects(); this.lastTick = state.tick;
    for (const event of state.events || []) {
      if (this.seen.has(event.id)) continue;
      this.seen.add(event.id); this.eventOrder.push(event.id);
      if (this.eventOrder.length > 512) this.seen.delete(this.eventOrder.shift());
      const color = COLORS[event.fighter ?? event.owner ?? 0]?.light || '#e1f1b9';
      if (event.type === 'dash') this.rings.push({ x: event.x, y: event.y, radius: 18, age: 0, life: this.reducedMotion ? .12 : .22, color });
      if (event.type === 'hit' && event.target != null) this.hitFlash[event.target] = .14;
      if (['hit', 'cover'].includes(event.type)) this.impacts.push({ x: event.x, y: event.y, type: event.type, angle: event.id * .83, color, age: 0, life: this.reducedMotion ? .09 : .2 });
      if (event.type === 'roundEnd') {
        const fallen = state.fighters.find(fighter => fighter.hp <= 0);
        if (fallen) this.rings.push({ x: fallen.x, y: fallen.y, radius: 11, age: 0, life: .3, color: COLORS[fallen.id].main });
      }
      if (!['fire', 'hit', 'cover', 'reloaded'].includes(event.type) || !Number.isFinite(event.x + event.y)) continue;
      const count = this.reducedMotion ? 0 : event.type === 'hit' ? 8 : event.type === 'cover' ? 5 : 2;
      for (let i = 0; i < count; i++) {
        const angle = (event.id * .79 + i * 2.4) % (Math.PI * 2), speed = event.type === 'hit' ? 50 + i * 5 : 25 + i * 10;
        this.particles.push({ x: event.x, y: event.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, age: 0, life: .13 + (i % 3) * .04, color: event.type === 'cover' ? '#c6dca0' : color });
      }
    }
    if (this.particles.length > 150) this.particles.splice(0, this.particles.length - 150);
    if (this.rings.length > 12) this.rings.splice(0, this.rings.length - 12);
    if (this.impacts.length > 24) this.impacts.splice(0, this.impacts.length - 24);
  }

  paintFighter(ctx, fighter, time, ghost = false) {
    const color = COLORS[fighter.id], focused = fighter.previousInput?.focus;
    ctx.save(); ctx.translate(fighter.x, fighter.y);
    if (!ghost) {
      ctx.fillStyle = '#081e1970'; ctx.beginPath(); ctx.ellipse(2, 4, 17, 14, 0, 0, Math.PI * 2); ctx.fill();
      if (fighter.dashTicks > 0) {
        ring(ctx, 0, 0, fighter.radius + 4, fighter.invulnerable ? color.light : '#e4b47e80', 1.5);
        if (!fighter.invulnerable && fighter.dashFrame <= DASH.invulnerableStart) {
          path(ctx, [[fighter.dashX * 20, fighter.dashY * 20], [fighter.dashX * 40, fighter.dashY * 40]], color.main, 2);
          const nx = -fighter.dashY, ny = fighter.dashX;
          path(ctx, [[fighter.dashX * 32 + nx * 5, fighter.dashY * 32 + ny * 5], [fighter.dashX * 40, fighter.dashY * 40], [fighter.dashX * 32 - nx * 5, fighter.dashY * 32 - ny * 5]], color.main, 2);
        }
      }
      if (focused) ring(ctx, 0, 0, fighter.radius + 4, color.main + '40');
    }
    ctx.rotate(fighter.facing);
    if (ghost) ctx.globalAlpha *= .18;
    if (fighter.hp <= 0) ctx.globalAlpha *= .45;
    const stride = fighter.action === 'run' && !this.reducedMotion ? Math.sin(time / 85) * 2 : 0;
    // Pilot 01 wears a broad siege helmet; Pilot 02 has a narrow swept visor.
    // Their colored torso cores stay inside the physical 16px body radius.
    ctx.fillStyle = '#101f1c'; ctx.fillRect(-9 - stride, -10, 8, 6); ctx.fillRect(-9 + stride, 4, 8, 6);
    ctx.fillStyle = '#667563'; ctx.fillRect(-8 - stride, -10, 5, 1); ctx.fillRect(-8 + stride, 4, 5, 1);
    polygon(ctx, [[-14, -5], [-7, -13], [7, -12], [14, -5], [14, 5], [7, 12], [-7, 13], [-14, 5]], '#11261f');
    ctx.fillStyle = color.suit; ctx.fillRect(-12, -7, 22, 14);
    for (const sign of [-1, 1]) {
      polygon(ctx, [[-7, sign * 6], [-4, sign * 13], [6, sign * 11], [10, sign * 5]], color.dark);
      polygon(ctx, [[-5, sign * 7], [-3, sign * 11], [5, sign * 9], [7, sign * 5]], color.main);
      path(ctx, [[-2, sign * 10], [5, sign * 8]], color.light, 2);
    }
    ctx.fillStyle = '#203d35'; ctx.fillRect(-13, -5, 7, 10);
    ctx.fillStyle = '#95a98b'; ctx.fillRect(-12, -4, 4, 2); ctx.fillRect(-12, 2, 4, 2);
    ctx.fillStyle = '#e0cda0'; ctx.fillRect(-10, -1, 2, 2);
    if (fighter.id === 0) {
      polygon(ctx, [[-4, -8], [7, -9], [13, -3], [13, 3], [7, 9], [-4, 8]], color.main);
      path(ctx, [[-3, -7], [7, -7], [11, -3]], color.light, 2);
      polygon(ctx, [[2, -5], [10, -4], [12, 0], [10, 4], [2, 5]], '#25483f');
      ctx.fillStyle = '#497366'; ctx.fillRect(5, -3, 5, 6);
      path(ctx, [[7, -3], [10, -2], [10, 2]], color.visor, 2);
      ctx.fillStyle = color.dark; ctx.fillRect(-1, 5, 5, 2);
    } else {
      polygon(ctx, [[-7, -6], [3, -10], [12, -4], [14, 0], [12, 4], [3, 10], [-7, 6]], color.main);
      polygon(ctx, [[-3, -5], [6, -6], [12, 0], [6, 6], [-3, 5]], '#254a4b');
      path(ctx, [[1, -4], [7, -3], [11, 0], [7, 3]], color.visor, 2);
      path(ctx, [[-5, -6], [2, -8], [7, -5]], color.light, 2);
      ctx.fillStyle = color.dark; ctx.fillRect(-5, 4, 5, 2);
    }
    // Reloading visibly opens the magazine hand; recoil changes only the pose.
    const recoil = fighter.shotCooldown > WEAPON.shotTicks - 4 ? 2 : 0;
    ctx.save(); if (fighter.reloadTicks > 0) ctx.rotate(.24);
    ctx.fillStyle = color.dark; ctx.fillRect(8 - recoil, -7, 5, 4); ctx.fillRect(8 - recoil, 3, 5, 4);
    ctx.fillStyle = '#102721'; ctx.fillRect(8 - recoil, -3, 17, 6);
    ctx.fillStyle = '#aabbb0'; ctx.fillRect(10 - recoil, -3, 13, 2);
    ctx.fillStyle = '#4a6b58'; ctx.fillRect(10 - recoil, 1, 13, 2);
    ctx.fillStyle = '#e0d0a4'; ctx.fillRect(15 - recoil, -2, 5, 1);
    ctx.fillStyle = '#c4d1bd'; ctx.fillRect(23 - recoil, -2, 2, 4);
    if (fighter.reloadTicks > 0) {
      ctx.fillStyle = '#31473e'; ctx.fillRect(10, 7, 7, 4);
      ctx.fillStyle = color.main; ctx.fillRect(11, 7, 5, 2);
    }
    ctx.restore();
    if (!ghost && this.hitFlash[fighter.id] > 0) {
      ctx.strokeStyle = color.light; ctx.lineWidth = 1.5; ctx.strokeRect(-4, -8, 13, 16);
    }
    if (!ghost && fighter.shotCooldown > WEAPON.shotTicks - 4) {
      polygon(ctx, [[26, -4], [37, -1], [31, 0], [37, 1], [26, 4], [28, 0]], color.light);
    }
    ctx.restore();
    if (!ghost && fighter.hp < fighter.maxHp && fighter.hp > 0) {
      ctx.fillStyle = '#0e271f'; ctx.fillRect(fighter.x - 15, fighter.y - 24, 30, 4);
      ctx.fillStyle = color.main; ctx.fillRect(fighter.x - 14, fighter.y - 23, 28 * clamp(fighter.hp / fighter.maxHp, 0, 1), 2);
    }
  }

  render(state, { localId = null, time = performance.now(), aimTarget = null } = {}) {
    const ctx = this.ctx, dt = Math.min(.05, Math.max(0, (time - this.lastTime) / 1000)); this.lastTime = time;
    this.observeEvents(state);
    ctx.setTransform(this.canvas.width / WORLD.width, 0, 0, this.canvas.height / WORLD.height, 0, 0);
    this.background = this.stageBackground(state.stageId);
    ctx.imageSmoothingEnabled = false;
    for (const fighter of state.fighters) if (!this.reducedMotion && fighter.dashTicks > 0 && fighter.dashFrame > DASH.invulnerableStart && state.tick - this.lastGhost[fighter.id] >= 4) {
      this.ghosts.push({ fighter: { ...fighter }, age: 0 }); this.lastGhost[fighter.id] = state.tick;
    }
    if (this.ghosts.length > 12) this.ghosts.splice(0, this.ghosts.length - 12);
    let liveGhosts = 0;
    for (const ghost of this.ghosts) if ((ghost.age += dt) < .13) this.ghosts[liveGhosts++] = ghost;
    this.ghosts.length = liveGhosts;
    const covers = this.stageCovers(state.stageId, state.obstacles);
    if (liveGhosts) {
      // Dash silhouettes still pass behind the exact solid cover layer.
      ctx.drawImage(this.background, 0, 0);
      for (const ghost of this.ghosts) { ctx.save(); ctx.globalAlpha = 1 - ghost.age / .13; this.paintFighter(ctx, ghost.fighter, time, true); ctx.restore(); }
      ctx.drawImage(covers.layer, 0, 0);
    } else ctx.drawImage(this.stageScene(state.stageId, covers), 0, 0);
    for (const projectile of state.projectiles || []) {
      const color = COLORS[projectile.owner] || COLORS[0], speed = Math.hypot(projectile.vx, projectile.vy) || 1;
      path(ctx, [[projectile.x - projectile.vx / speed * 20, projectile.y - projectile.vy / speed * 20], [projectile.x, projectile.y]], '#0e211ecc', 5);
      path(ctx, [[projectile.x - projectile.vx / speed * 17, projectile.y - projectile.vy / speed * 17], [projectile.x, projectile.y]], color.main + 'a0', 2);
      path(ctx, [[projectile.x - projectile.vx / speed * 7, projectile.y - projectile.vy / speed * 7], [projectile.x, projectile.y]], color.light, 2);
      const radius = projectile.radius ?? 3;
      // The bright tip follows the same circular footprint used for contact.
      ctx.fillStyle = color.light; ctx.beginPath(); ctx.arc(projectile.x, projectile.y, radius, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff6db'; ctx.fillRect(projectile.x - 1, projectile.y - 1, 2, 2);
    }
    for (const fighter of state.fighters) this.paintFighter(ctx, fighter, time);
    let liveImpacts = 0;
    for (const effect of this.impacts) if ((effect.age += dt) < effect.life) this.impacts[liveImpacts++] = effect;
    this.impacts.length = liveImpacts;
    for (const impact of this.impacts) {
      ctx.save(); ctx.translate(impact.x, impact.y); ctx.rotate(impact.angle); ctx.globalAlpha = 1 - impact.age / impact.life;
      const outer = impact.type === 'hit' ? 15 : 10;
      for (let i = 0; i < 4; i += 1) {
        ctx.rotate(Math.PI / 2);
        path(ctx, [[5, 0], [outer, 0]], '#17372c', 4);
        path(ctx, [[5, 0], [outer, 0]], impact.color, 2);
      }
      ring(ctx, 0, 0, 4, impact.color, 1.5); ctx.restore();
    }
    let liveRings = 0;
    for (const effect of this.rings) if ((effect.age += dt) < effect.life) this.rings[liveRings++] = effect;
    this.rings.length = liveRings;
    for (const effect of this.rings) { ctx.save(); ctx.globalAlpha = 1 - effect.age / effect.life; ring(ctx, effect.x, effect.y, effect.radius + (this.reducedMotion ? 0 : effect.age * 65), effect.color, 2); ctx.restore(); }
    let liveParticles = 0;
    for (const particle of this.particles) if ((particle.age += dt) < particle.life) this.particles[liveParticles++] = particle;
    this.particles.length = liveParticles;
    for (const particle of this.particles) {
      particle.x += particle.vx * dt; particle.y += particle.vy * dt;
      ctx.globalAlpha = 1 - particle.age / particle.life; ctx.fillStyle = particle.color; ctx.fillRect(particle.x - 1, particle.y - 1, 2, 2);
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < this.hitFlash.length; i++) this.hitFlash[i] = Math.max(0, this.hitFlash[i] - dt);
    if (localId != null) this.paintLocalHUD(ctx, state.fighters[localId], aimTarget, state.phase);
    else {
      ctx.fillStyle = '#b9c7a0'; ctx.textAlign = 'center'; ctx.font = '9px Consolas, monospace';
      ctx.fillText('AIM  /  STRAFE  /  CONTROL YOUR ANGLE', WORLD.width / 2, 627);
    }
  }

  paintLocalHUD(ctx, fighter, target, phase) {
    const color = COLORS[fighter.id], ammo = WEAPON.magazine;
    // A solid body outline communicates the exact 16px hit radius.
    ring(ctx, fighter.x, fighter.y, fighter.radius, color.light + '32');
    if (phase === 'fight' && fighter.hp > 0) {
      const x = target?.x ?? fighter.x + fighter.aimX * 95, y = target?.y ?? fighter.y + fighter.aimY * 95;
      const spread = fighter.previousInput?.focus ? 6 : 10;
      path(ctx, [[x - spread - 6, y], [x - spread, y]], color.light, 2);
      path(ctx, [[x + spread, y], [x + spread + 6, y]], color.light, 2);
      path(ctx, [[x, y - spread - 6], [x, y - spread]], color.light, 2);
      path(ctx, [[x, y + spread], [x, y + spread + 6]], color.light, 2);
      ctx.fillStyle = color.light; ctx.fillRect(x - 1, y - 1, 2, 2);
    }
    ctx.fillStyle = '#172d26'; ctx.fillRect(277, 608, 406, 32);
    ctx.fillStyle = '#8c9b7133'; ctx.fillRect(277, 608, 406, 1);
    ctx.fillStyle = '#42533e'; ctx.fillRect(380, 617, 1, 12); ctx.fillRect(536, 617, 1, 12);
    ctx.fillStyle = '#c0cbb0'; ctx.font = '9px Consolas, monospace'; ctx.textAlign = 'left'; ctx.fillText('MAG', 294, 626);
    for (let i = 0; i < ammo; i++) {
      ctx.fillStyle = i < fighter.ammo ? color.main : '#3c5546'; ctx.fillRect(321 + i * 10, 617, 6, 10);
    }
    if (fighter.reloadTicks > 0) {
      const progress = 1 - fighter.reloadTicks / fighter.reloadDuration;
      ctx.fillStyle = '#3c5546'; ctx.fillRect(397, 618, 80, 7);
      ctx.fillStyle = color.main; ctx.fillRect(397, 618, 80 * clamp(progress, 0, 1), 7);
      ctx.fillStyle = '#c0cbb0'; ctx.fillText('RELOAD', 484, 625);
    } else { ctx.fillStyle = '#a5b597'; ctx.fillText(fighter.previousInput?.focus ? 'FOCUS / PRECISE' : 'R / RELOAD', 397, 626); }
    ctx.fillStyle = fighter.stamina >= DASH.cost ? '#c0cbb0' : '#987c59';
    ctx.fillText('DASH', 548, 626);
    ctx.fillStyle = '#3c5546'; ctx.fillRect(584, 619, 79, 6);
    ctx.fillStyle = color.main; ctx.fillRect(584, 619, 79 * clamp(fighter.stamina / 100, 0, 1), 6);
  }
}
