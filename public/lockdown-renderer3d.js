/** Lockdown in real 3D (three.js): the Spiral Knights look — a ¾ perspective camera over chunky
 * bevelled blocks floating above a dark void, framed floor plates, glowing lamps, a mechanical
 * capture platform, heart pads and chibi knights with team rings at their feet.
 *
 * It draws the same deterministic state as the 2D renderer and has the same interface
 * (render, resize, screenToWorld, aimHeight). All geometry is built in code from the map grid, so
 * the game needs no models; materials are painted procedurally per theme. Scene units: one map
 * tile = 1, x east, z south (the engine's y), y up. */
import * as THREE from './vendor/three/three.module.min.js';
import { MAPS, TILE, isWall, levelCell, levelAt, STAIRS } from './lockdown-maps.js';
import { WEAPONS, RULES, GUARD, ABILITIES, STATUS_IDS } from './lockdown-engine.js';
import { TEAM_COLORS } from './lockdown-renderer.js';

const U = 1 / TILE;
const STOREY = .8;          // height of the raised floor
const WALL = 1.3;           // walls stand this high above their floor
const DEPTH = 2.6;          // how far the map's cliffs drop into the void
const BEVEL = .1;           // chamfer on the top edges of wall blocks
const KNIGHT = 1.3;          // knight height as drawn
const FEET_RING = .3;       // team ring radius under each knight (before scaling)
const KNIGHT_SCALE = 1.4;   // chunky, readable knights

const THEMES = Object.freeze({
  castle: { bg: '#0d1117', sky: '#b9c8d8', ground: '#2a2420', floor: ['#8e9088', '#9a9b91', '#84867e'], grout: '#5f615b', wall: '#8a7f6e', wallDark: '#5a5145', wallTop: '#b9ae97', trim: '#d8cdb4', cliff: '#4a4038', pit: 'water', pitColor: '#1d5f7e', lamp: '#ffcf86', style: 'flagstone' },
  maze: { bg: '#0b1410', sky: '#d8f0c0', ground: '#1f2a16', floor: ['#6fa042', '#78aa48', '#669a3c'], grout: '#57843a', wall: '#3f8a2c', wallDark: '#2a5e1e', wallTop: '#8fd14c', trim: '#a8e05a', cliff: '#5a4a32', pit: 'bog', pitColor: '#2e4a24', lamp: '#fff0a0', style: 'grass', hedge: true },
  foundry: { bg: '#0b0a12', sky: '#c8b8d8', ground: '#1a1420', floor: ['#4e5763', '#556070', '#48515c'], grout: '#363d47', wall: '#b23e36', wallDark: '#6e2622', wallTop: '#d0584a', trim: '#e2b04a', cliff: '#3a2e3c', pit: 'lava', pitColor: '#ff6a1a', lamp: '#ffe2a6', style: 'metal' },
  ruins: { bg: '#0c1214', sky: '#e8dcc0', ground: '#2a2418', floor: ['#cdb88e', '#d6c299', '#c3ad83'], grout: '#a8946c', wall: '#cdb990', wallDark: '#8e7b58', wallTop: '#e6d6b0', trim: '#f2e6c6', cliff: '#7a6648', pit: 'water', pitColor: '#1f8a8a', lamp: '#ffe0a0', style: 'sandstone' },
  graveyard: { bg: '#0a0a12', sky: '#9a9ab8', ground: '#16141e', floor: ['#4a4e58', '#52566a', '#444852'], grout: '#33363f', wall: '#5c5a6c', wallDark: '#38364a', wallTop: '#7c7a90', trim: '#9a98b0', cliff: '#2c2a38', pit: 'chasm', pitColor: '#1a1428', lamp: '#b8a8ff', style: 'slate' },
  skyway: { bg: '#6f9fd8', sky: '#ffffff', ground: '#8aa8d0', floor: ['#dcd6c6', '#e4dfd0', '#d2ccbb'], grout: '#b8ae96', wall: '#e8e2d2', wallDark: '#b0a68e', wallTop: '#f6f1e4', trim: '#d8b45a', cliff: '#9a8c74', pit: 'sky', pitColor: '#8ab8ec', lamp: '#fff2c0', style: 'marble' },
});
const ELEMENT = Object.freeze({ burn: '#ff7a2a', chill: '#7cc8ff', freeze: '#bfeaff', shock: '#8fe0ff', poison: '#6ee05a', curse: '#b26bff', drain: '#ff4d6d' });
const STATUS_COLOR = Object.freeze({ burn: '#ff8a3d', poison: '#7bd65a', shock: '#7fc8ff', freeze: '#bfeaff', chill: '#6fb6ff', curse: '#b26bff' });
const CALLOUTS = Object.freeze({
  counter: ['COUNTER', '#ffb347', 'target'], riposte: ['RIPOSTE', '#ffe680', 'target'], perfectDodge: ['PERFECT', '#9ff0ff', 'player'],
  clash: ['CLASH', '#ffffff', 'player'], steady: ['STEADY', '#c9d6ff', 'player'], interrupt: ['INTERRUPTED', '#ff8a7a', 'player'],
  whiff: ['MISS', '#b8b8b8', 'player'], sweetSpot: ['TIP', '#ffe680', 'target'], ambush: ['AMBUSH', '#d29bff', 'target'],
  guardBreak: ['GUARD BREAK', '#ffffff', 'player'], evade: ['DODGE', '#ffffff', 'player'],
});
const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const lerp = (a, b, t) => a + (b - a) * t;
const colour = value => new THREE.Color(value);

// ---------- procedural textures ----------
function canvasTexture(size, paint, { repeat = true } = {}) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  paint(canvas.getContext('2d'), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
  if (repeat) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}
function shadeHex(hex, amount) { const c = colour(hex); c.offsetHSL(0, 0, amount); return `#${c.getHexString()}`; }
/** Fine grain so no surface reads as flat plastic. */
function grain(ctx, size, strength = 10, seed = 1) {
  const image = ctx.getImageData(0, 0, size, size), data = image.data;
  for (let i = 0; i < data.length; i += 4) { const n = (hash(i >> 2, seed) - .5) * strength; data[i] += n; data[i + 1] += n; data[i + 2] += n; }
  ctx.putImageData(image, 0, 0);
}
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
/** Floor: four tiles across, so the paving is broader than the collision grid. */
function floorTexture(theme) {
  const t = THEMES[theme];
  return canvasTexture(512, (ctx, s) => {
    ctx.fillStyle = t.grout; ctx.fillRect(0, 0, s, s);
    if (t.style === 'grass') {
      ctx.fillStyle = t.floor[0]; ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 900; i++) { const x = hash(i, 3) * s, y = hash(i, 4) * s, l = 6 + hash(i, 5) * 10; ctx.strokeStyle = hash(i, 6) < .5 ? t.floor[1] : t.grout; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (hash(i, 7) - .5) * 6, y - l); ctx.stroke(); }
      for (let i = 0; i < 40; i++) { ctx.fillStyle = 'rgba(255,255,200,.06)'; ctx.beginPath(); ctx.arc(hash(i, 8) * s, hash(i, 9) * s, 20 + hash(i, 10) * 40, 0, Math.PI * 2); ctx.fill(); }
      grain(ctx, s, 8, 2); return;
    }
    const cell = s / 4, gap = t.style === 'metal' ? 6 : 5, r = t.style === 'metal' ? 6 : 14;
    const slabs = [];
    // Flagstones and slate mix big and small slabs; metal and marble keep a strict grid.
    for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
      if (slabs.some(slab => slab.cells.includes(`${col},${row}`))) continue;
      const wide = t.style !== 'metal' && t.style !== 'marble' && col < 3 && hash(col, row + 9) < .35 && !slabs.some(slab => slab.cells.includes(`${col + 1},${row}`));
      const tall = !wide && t.style === 'sandstone' && row < 3 && hash(col + 4, row) < .3;
      slabs.push({ x: col * cell, y: row * cell, w: cell * (wide ? 2 : 1), h: cell * (tall ? 2 : 1), cells: [`${col},${row}`, ...(wide ? [`${col + 1},${row}`] : []), ...(tall ? [`${col},${row + 1}`] : [])] });
    }
    slabs.forEach((slab, i) => {
      const base = t.floor[Math.floor(hash(i, 11) * t.floor.length)], x = slab.x + gap / 2, y = slab.y + gap / 2, w = slab.w - gap, h = slab.h - gap;
      roundRect(ctx, x, y, w, h, r); ctx.fillStyle = base; ctx.fill();
      // Soft bevel: lit top-left rim, shaded bottom-right rim.
      const light = ctx.createLinearGradient(x, y, x + w, y + h); light.addColorStop(0, 'rgba(255,255,255,.18)'); light.addColorStop(.45, 'rgba(255,255,255,0)'); light.addColorStop(1, 'rgba(0,0,0,.18)');
      ctx.fillStyle = light; ctx.fill();
      roundRect(ctx, x + 7, y + 7, w - 14, h - 14, Math.max(2, r - 6)); ctx.fillStyle = shadeHex(base, .015); ctx.fill();
      if (t.style === 'metal') {
        ctx.fillStyle = 'rgba(0,0,0,.35)'; for (const [rx, ry] of [[10, 10], [w - 10, 10], [10, h - 10], [w - 10, h - 10]]) { ctx.beginPath(); ctx.arc(x + rx, y + ry, 3.2, 0, Math.PI * 2); ctx.fill(); }
        ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 2; for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x + 12, y + k * h / 4); ctx.lineTo(x + w - 12, y + k * h / 4); ctx.stroke(); }
      }
      if (t.style === 'marble') { ctx.strokeStyle = 'rgba(200,160,70,.55)'; ctx.lineWidth = 3; roundRect(ctx, x + 12, y + 12, w - 24, h - 24, 6); ctx.stroke(); }
      if (hash(i, 12) < .22) {
        // A carved swirl, as on Spiral Knights' plates.
        ctx.strokeStyle = 'rgba(0,0,0,.13)'; ctx.lineWidth = 4; ctx.beginPath();
        const cx = x + w / 2, cy = y + h / 2; for (let a = 0; a < Math.PI * 5; a += .2) { const rr = 3 + a * 3.2; ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } ctx.stroke();
      } else if (hash(i, 13) < .25) { ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 2; ctx.beginPath(); let px = x + w * .3, py = y + h * .2; ctx.moveTo(px, py); for (let k = 0; k < 4; k++) { px += (hash(i, k) - .3) * 22; py += 14; ctx.lineTo(px, py); } ctx.stroke(); }
    });
    grain(ctx, s, 9, 3);
  });
}
/** Wall faces: v = 0 at the wall's top, so the lit cap band always sits on top. */
function wallTexture(theme) {
  const t = THEMES[theme];
  return canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = t.wall; ctx.fillRect(0, 0, s, s);
    if (t.hedge) {
      for (let i = 0; i < 260; i++) { const x = hash(i, 1) * s, y = hash(i, 2) * s, r = 10 + hash(i, 3) * 18; ctx.fillStyle = hash(i, 4) < .5 ? t.wallDark : shadeHex(t.wall, .06); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
      grain(ctx, s, 14, 5); return;
    }
    // Cap band, then panels or courses of blocks below it.
    ctx.fillStyle = t.trim; ctx.fillRect(0, 0, s, 30); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(0, 30, s, 6);
    if (t.style === 'metal') {
      ctx.fillStyle = t.wallDark; for (const x of [16, 144]) { roundRect(ctx, x, 56, 96, 150, 8); ctx.fill(); }
      ctx.strokeStyle = t.trim; ctx.lineWidth = 6; for (const x of [16, 144]) { ctx.beginPath(); ctx.moveTo(x + 10, 70); ctx.lineTo(x + 86, 190); ctx.moveTo(x + 86, 70); ctx.lineTo(x + 10, 190); ctx.stroke(); }
      ctx.fillStyle = 'rgba(0,0,0,.3)'; for (let x = 8; x < s; x += 32) { ctx.beginPath(); ctx.arc(x, 44, 4, 0, Math.PI * 2); ctx.fill(); }
    } else {
      const course = 46;
      for (let row = 0, y = 40; y < s; row++, y += course) for (let x = row % 2 ? -64 : 0; x < s; x += 128) {
        roundRect(ctx, x + 4, y + 4, 120, course - 8, 9); ctx.fillStyle = hash(x + 300, row) < .5 ? t.wall : shadeHex(t.wall, -.04); ctx.fill();
        const g = ctx.createLinearGradient(0, y, 0, y + course); g.addColorStop(0, 'rgba(255,255,255,.14)'); g.addColorStop(1, 'rgba(0,0,0,.2)'); ctx.fillStyle = g; ctx.fill();
      }
    }
    grain(ctx, s, 10, 6);
  });
}
function plainTexture(base, { dark = null, blobs = 0, strength = 10, seed = 7 } = {}) {
  return canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = base; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < blobs; i++) { ctx.fillStyle = hash(i, seed) < .5 ? dark : shadeHex(base, .05); roundRect(ctx, hash(i, seed + 1) * s, hash(i, seed + 2) * s, 30 + hash(i, seed + 3) * 60, 18 + hash(i, seed + 4) * 30, 10); ctx.fill(); }
    grain(ctx, s, strength, seed);
  });
}
/** The capture court painted on the floor: a hazard-striped frame and a soft inner field. */
function courtTexture() {
  return canvasTexture(512, (ctx, s) => {
    const c = s / 2;
    ctx.clearRect(0, 0, s, s);
    const field = ctx.createRadialGradient(c, c, c * .2, c, c, c * .95); field.addColorStop(0, 'rgba(255,255,255,.08)'); field.addColorStop(1, 'rgba(255,255,255,.02)');
    ctx.fillStyle = field; ctx.beginPath(); ctx.arc(c, c, c * .95, 0, Math.PI * 2); ctx.fill();
    // Hazard stripes around the edge, between two brass rims.
    ctx.save(); ctx.beginPath(); ctx.arc(c, c, c * .98, 0, Math.PI * 2); ctx.arc(c, c, c * .86, 0, Math.PI * 2, true); ctx.clip();
    ctx.fillStyle = '#1e1e22'; ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#f2b632'; for (let i = 0; i < 64; i++) { ctx.save(); ctx.translate(c, c); ctx.rotate(i / 64 * Math.PI * 2); ctx.beginPath(); ctx.moveTo(c * .84, -8); ctx.lineTo(c, -22); ctx.lineTo(c, -2); ctx.lineTo(c * .84, 12); ctx.fill(); ctx.restore(); }
    ctx.restore();
    ctx.strokeStyle = '#c99a3c'; ctx.lineWidth = 6; for (const r of [.86, .98]) { ctx.beginPath(); ctx.arc(c, c, c * r, 0, Math.PI * 2); ctx.stroke(); }
  }, { repeat: false });
}
function glowTexture() {
  return canvasTexture(128, (ctx, s) => { const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, s, s); }, { repeat: false });
}
function liquidTexture(theme) {
  const t = THEMES[theme];
  return canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = t.pitColor; ctx.fillRect(0, 0, s, s);
    if (t.pit === 'lava') {
      for (let i = 0; i < 60; i++) { ctx.fillStyle = hash(i, 1) < .5 ? '#ffb040' : '#c83a10'; ctx.beginPath(); ctx.ellipse(hash(i, 2) * s, hash(i, 3) * s, 14 + hash(i, 4) * 26, 8 + hash(i, 5) * 14, hash(i, 6) * 3, 0, Math.PI * 2); ctx.fill(); }
      for (let i = 0; i < 30; i++) { ctx.fillStyle = 'rgba(40,10,0,.55)'; ctx.beginPath(); ctx.ellipse(hash(i, 7) * s, hash(i, 8) * s, 10 + hash(i, 9) * 20, 6 + hash(i, 10) * 10, hash(i, 11) * 3, 0, Math.PI * 2); ctx.fill(); }
    } else if (t.pit === 'sky') {
      for (let i = 0; i < 40; i++) { ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(hash(i, 1) * s, hash(i, 2) * s, 10 + hash(i, 3) * 24, 0, Math.PI * 2); ctx.fill(); }
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 3;
      for (let i = 0; i < 40; i++) { const x = hash(i, 1) * s, y = hash(i, 2) * s; ctx.beginPath(); ctx.arc(x, y, 8 + hash(i, 3) * 20, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
    }
    grain(ctx, s, 6, 9);
  });
}

// ---------- geometry ----------
/** Collects quads into one buffer (positions, normals, uvs, vertex colours). */
class Builder {
  constructor() { this.position = []; this.normal = []; this.uv = []; this.color = []; this.index = []; }
  quad(points, normal, uvs, tint = [1, 1, 1]) {
    const base = this.position.length / 3;
    for (let i = 0; i < 4; i++) { this.position.push(...points[i]); this.normal.push(...normal); this.uv.push(...uvs[i]); this.color.push(...tint); }
    this.index.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  build() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.position, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normal, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.color, 3));
    geometry.setIndex(this.index);
    return geometry;
  }
  get empty() { return !this.index.length; }
}
/** A flat sector of a ring in the floor plane (angles are world headings: 0 east, π/2 south). */
function arcGeometry(inner, outer, from, to, segments = 24) {
  const position = [], index = [];
  for (let i = 0; i <= segments; i++) {
    const a = from + (to - from) * i / segments;
    position.push(Math.cos(a) * inner, 0, Math.sin(a) * inner, Math.cos(a) * outer, 0, Math.sin(a) * outer);
    if (i < segments) { const k = i * 2; index.push(k, k + 1, k + 3, k, k + 3, k + 2); }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3)); geometry.setIndex(index); geometry.computeVertexNormals();
  return geometry;
}
const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export class Lockdown3DRenderer {
  constructor(overlayCanvas, assets, overlay2d) {
    // The WebGL canvas sits under the existing canvas, which stays on top for input and the 2D overlay.
    this.overlayCanvas = overlayCanvas; this.overlay = overlay2d; this.ctx = overlayCanvas.getContext('2d'); this.assets = assets;
    this.canvas = document.createElement('canvas'); this.canvas.className = 'ld-arena3d';
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;';
    overlayCanvas.parentNode.insertBefore(this.canvas, overlayCanvas);
    this.gl = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.gl.shadowMap.enabled = true; this.gl.shadowMap.type = THREE.PCFSoftShadowMap;
    this.gl.toneMapping = THREE.ACESFilmicToneMapping; this.gl.toneMappingExposure = 1.15;
    this.scene = new THREE.Scene();
    this.camera3 = new THREE.PerspectiveCamera(34, 16 / 9, .5, 120);
    this.target = new THREE.Vector3(); this.cameraReady = false;
    this.glow = glowTexture();
    this.hemi = new THREE.HemisphereLight('#c8d4ff', '#2a2420', 1.6); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff3e0', 2.4); this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048); Object.assign(this.sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 });
    this.sun.shadow.bias = -.0006; this.sun.shadow.normalBias = .03;
    this.scene.add(this.sun, this.sun.target);
    this.mapGroup = null; this.mapId = null;
    this.knights = new Map(); this.shots = new Map(); this.bombs = new Map(); this.hearts = new Map(); this.clouds = new Map();
    this.effects = []; this.texts = []; this.seenEvents = new Set(); this.eventOrder = []; this.localId = null; this.shake = 0;
    this.camera = { x: 0, y: 0, zoom: 1 }; // kept for callers that read it
    this.raycaster = new THREE.Raycaster();
    this.resize();
  }
  resize() {
    const ratio = Math.min(2, globalThis.devicePixelRatio || 1), rect = this.overlayCanvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width)), height = Math.max(1, Math.round(rect.height));
    this.gl.setPixelRatio(ratio); this.gl.setSize(width, height, false);
    this.camera3.aspect = width / height; this.camera3.updateProjectionMatrix();
    this.overlay?.resize();
  }
  /** Height (scene units) of the plane the pointer aims on: a knight's chest, on their floor. */
  aimHeight(player) { const map = MAPS[this.mapId]; return (map ? levelAt(map, player.x, player.y) * STOREY : 0) + KNIGHT * .45; }
  get aimLift() { return 0; }
  /** Screen pixel → world position on the horizontal plane at `height` scene units. */
  screenToWorld(px, py, height = 0) {
    const rect = this.overlayCanvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(px / Math.max(1, rect.width) * 2 - 1, -(py / Math.max(1, rect.height)) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera3);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -height), hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(plane, hit)) return { x: this.target.x / U, y: this.target.z / U };
    return { x: hit.x / U, y: hit.z / U };
  }
  /** World position (engine units, plus a height in scene units) → overlay pixel. */
  project(x, y, height) {
    const v = new THREE.Vector3(x * U, height, y * U).project(this.camera3), rect = this.overlayCanvas.getBoundingClientRect();
    return { x: (v.x + 1) / 2 * rect.width, y: (1 - v.y) / 2 * rect.height, visible: v.z < 1 };
  }

  // ---------- the static arena ----------
  buildMap(map) {
    if (this.mapId === map.id && this.mapGroup) return;
    if (this.mapGroup) { this.scene.remove(this.mapGroup); this.mapGroup.traverse(node => { node.geometry?.dispose(); }); }
    this.mapId = map.id;
    const theme = THEMES[map.theme] ? map.theme : 'castle', t = THEMES[theme], group = new THREE.Group();
    this.theme = t; this.mapGroup = group; this.scene.add(group);
    this.scene.background = colour(t.bg);
    this.scene.fog = theme === 'skyway' ? new THREE.Fog(t.bg, 30, 70) : new THREE.Fog(t.bg, 24, 46);
    this.hemi.color = colour(t.sky); this.hemi.groundColor = colour(t.ground);
    const tex = { floor: floorTexture(theme), wall: wallTexture(theme), top: plainTexture(t.wallTop, { dark: shadeHex(t.wallTop, -.05), blobs: t.hedge ? 0 : 10 }), cliff: plainTexture(t.cliff, { dark: shadeHex(t.cliff, -.06), blobs: 24, strength: 14 }) };
    const material = {
      floor: new THREE.MeshStandardMaterial({ map: tex.floor, vertexColors: true, roughness: t.style === 'marble' ? .55 : .9, metalness: t.style === 'metal' ? .25 : 0 }),
      wall: new THREE.MeshStandardMaterial({ map: tex.wall, vertexColors: true, roughness: .85 }),
      top: new THREE.MeshStandardMaterial({ map: tex.top, vertexColors: true, roughness: .8 }),
      cliff: new THREE.MeshStandardMaterial({ map: tex.cliff, vertexColors: true, roughness: 1 }),
    };
    const cell = (col, row) => (row < 0 || col < 0 || row >= map.rows || col >= map.cols) ? 'out' : map.grid[row][col] === '#' ? 'wall' : map.grid[row][col] === '~' ? 'pit' : 'floor';
    const base = (col, row) => levelCell(map, col, row) === '1' ? STOREY : 0;
    const stair = (col, row) => STAIRS[levelCell(map, col, row)] || null;
    const top = (col, row) => { const kind = cell(col, row); return kind === 'out' || kind === 'pit' ? -DEPTH : kind === 'wall' ? base(col, row) + WALL : stair(col, row) ? null : base(col, row); };
    const floors = new Builder(), walls = new Builder(), tops = new Builder(), cliffs = new Builder();
    const spawnTint = [new Set(map.spawns[0].map(p => `${Math.floor(p.x / TILE)},${Math.floor(p.y / TILE)}`)), new Set(map.spawns[1].map(p => `${Math.floor(p.x / TILE)},${Math.floor(p.y / TILE)}`))];
    const teamTint = team => { const c = colour(TEAM_COLORS[team].main); return [1.35 + c.r * .25, 1.3 + c.g * .25, 1.2 + c.b * .25]; };
    /** A vertical face along one cell edge, from y0 down to y1, facing (dx, dz). v runs down from `vTop`. */
    const side = (builder, col, row, dx, dz, y0, y1, tint = [1, 1, 1], vTop = y0) => {
      if (y0 <= y1 + 1e-4) return;
      let a, b;
      if (dx === 1) { a = [col + 1, row + 1]; b = [col + 1, row]; } else if (dx === -1) { a = [col, row]; b = [col, row + 1]; }
      else if (dz === 1) { a = [col, row + 1]; b = [col + 1, row + 1]; } else { a = [col + 1, row]; b = [col, row]; }
      const along = dx ? row : col;
      builder.quad([[a[0], y0, a[1]], [a[0], y1, a[1]], [b[0], y1, b[1]], [b[0], y0, b[1]]], [dx, 0, dz], [[along, vTop - y0], [along, vTop - y1], [along + 1, vTop - y1], [along + 1, vTop - y0]], tint);
    };
    for (let row = 0; row < map.rows; row++) for (let col = 0; col < map.cols; col++) {
      const kind = cell(col, row);
      if (kind === 'pit') continue;
      const steps = stair(col, row);
      if (kind === 'floor' && steps) { this.buildStairs(map, col, row, steps, floors, cliffs, top); continue; }
      const h = top(col, row), shade = 1 - hash(col, row) * .06;
      if (kind === 'floor') {
        const team = spawnTint[0].has(`${col},${row}`) ? 0 : spawnTint[1].has(`${col},${row}`) ? 1 : null;
        // Bases are bright courts, warmed a touch by their team's colour.
        const tint = team !== null ? teamTint(team) : h > 0 ? [1.06, 1.05, 1.02] : [shade, shade, shade];
        floors.quad([[col, h, row], [col, h, row + 1], [col + 1, h, row + 1], [col + 1, h, row]], [0, 1, 0], [[col / 4, row / 4], [col / 4, (row + 1) / 4], [(col + 1) / 4, (row + 1) / 4], [(col + 1) / 4, row / 4]], tint);
        for (const [dx, dz] of SIDES) {
          const other = top(col + dx, row + dz);
          if (other === null) continue; // a stair builds its own sides
          side(cliffs, col, row, dx, dz, h, other, [.9, .9, .9], h);
        }
      } else {
        const floorH = base(col, row), B = BEVEL;
        const neighbour = (dx, dz) => { const otherKind = cell(col + dx, row + dz); return otherKind === 'wall' ? top(col + dx, row + dz) : otherKind === 'out' || otherKind === 'pit' ? -DEPTH : (top(col + dx, row + dz) ?? 0); };
        const open = { px: neighbour(1, 0) < h, nx: neighbour(-1, 0) < h, pz: neighbour(0, 1) < h, nz: neighbour(0, -1) < h };
        // The cap is inset where the block has an edge, and a mitred chamfer runs down to the face:
        // the chunky bevelled look of Spiral Knights' blocks.
        const x0 = col + (open.nx ? B : 0), x1 = col + 1 - (open.px ? B : 0), z0 = row + (open.nz ? B : 0), z1 = row + 1 - (open.pz ? B : 0), hb = h - B;
        const tint = [shade, shade, shade];
        tops.quad([[x0, h, z0], [x0, h, z1], [x1, h, z1], [x1, h, z0]], [0, 1, 0], [[x0, z0], [x0, z1], [x1, z1], [x1, z0]], tint);
        const k = Math.SQRT1_2, lit = [shade * 1.12, shade * 1.1, shade * 1.06];
        if (open.px) tops.quad([[x1, h, z1], [col + 1, hb, row + 1], [col + 1, hb, row], [x1, h, z0]], [k, k, 0], [[0, 0], [0, .1], [1, .1], [1, 0]], lit);
        if (open.nx) tops.quad([[x0, h, z0], [col, hb, row], [col, hb, row + 1], [x0, h, z1]], [-k, k, 0], [[0, 0], [0, .1], [1, .1], [1, 0]], lit);
        if (open.pz) tops.quad([[x0, h, z1], [col, hb, row + 1], [col + 1, hb, row + 1], [x1, h, z1]], [0, k, k], [[0, 0], [0, .1], [1, .1], [1, 0]], lit);
        if (open.nz) tops.quad([[x1, h, z0], [col + 1, hb, row], [col, hb, row], [x0, h, z0]], [0, k, -k], [[0, 0], [0, .1], [1, .1], [1, 0]], lit);
        // A chamfer only on one side of a corner leaves a small notch; fill it with the neighbour's slope.
        for (const [dx, dz] of SIDES) {
          const other = neighbour(dx, dz);
          if (other >= h) continue;
          // Masonry down to the floor it stands on, cliff below that (into a pit or off the map).
          side(walls, col, row, dx, dz, hb, Math.max(other, floorH), [1, 1, 1], h);
          side(cliffs, col, row, dx, dz, Math.min(hb, floorH), other, [.8, .8, .8], floorH);
        }
      }
    }
    const add = (builder, mat, { cast = true, receive = true } = {}) => { if (builder.empty) return; const mesh = new THREE.Mesh(builder.build(), mat); mesh.castShadow = cast; mesh.receiveShadow = receive; group.add(mesh); return mesh; };
    add(floors, material.floor, { cast: false }); add(walls, material.wall); add(tops, material.top); add(cliffs, material.cliff);
    this.buildPits(map, group, theme);
    if (t.hedge) this.buildHedges(map, group, t, top);
    this.buildLamps(map, group, t, cell, base);
    this.buildBases(map, group);
    this.buildPoints(map, group);
  }
  /** Stairs: four steps climbing one storey toward the arrow, with side walls down to the ground. */
  buildStairs(map, col, row, [dx, dz], floors, cliffs, top) {
    const n = 5;
    for (let i = 0; i < n; i++) {
      const y = (i + 1) / n * STOREY, f0 = i / n, f1 = (i + 1) / n;
      // The step's footprint along the climb (from the low end) and across.
      const along = (f, s) => dx ? [dx > 0 ? col + f : col + 1 - f, row + s] : [col + s, dz > 0 ? row + f : row + 1 - f];
      const p = [along(f0, 0), along(f0, 1), along(f1, 1), along(f1, 0)];
      const quadTop = [[p[0][0], y, p[0][1]], [p[1][0], y, p[1][1]], [p[2][0], y, p[2][1]], [p[3][0], y, p[3][1]]];
      const up = dx > 0 || dz > 0;
      floors.quad(up ? quadTop : [quadTop[0], quadTop[3], quadTop[2], quadTop[1]], [0, 1, 0], [[p[0][0] / 4, p[0][1] / 4], [p[1][0] / 4, p[1][1] / 4], [p[2][0] / 4, p[2][1] / 4], [p[3][0] / 4, p[3][1] / 4]], [1.04, 1.03, 1]);
      // Riser facing downhill.
      const r0 = p[0], r1 = p[1], y0 = y - STOREY / n, facing = [-dx, 0, -dz];
      const riser = [[r0[0], y, r0[1]], [r0[0], y0, r0[1]], [r1[0], y0, r1[1]], [r1[0], y, r1[1]]];
      cliffs.quad(dx > 0 || dz < 0 ? riser : [riser[3], riser[2], riser[1], riser[0]], facing, [[0, 0], [0, .2], [1, .2], [1, 0]], [.95, .95, .95]);
      if (i === 0) {
        const low = [[r0[0], y0, r0[1]], [r0[0], 0, r0[1]], [r1[0], 0, r1[1]], [r1[0], y0, r1[1]]];
        cliffs.quad(dx > 0 || dz < 0 ? low : [low[3], low[2], low[1], low[0]], facing, [[0, 0], [0, .1], [1, .1], [1, 0]]);
      }
    }
    // Side walls of the flight, down to whatever lies beside it.
    for (const [sx, sz] of SIDES) {
      if (sx === dx && sz === dz || sx === -dx && sz === -dz) continue;
      const other = top(col + sx, row + sz) ?? 0;
      for (let i = 0; i < n; i++) {
        const y = (i + 1) / n * STOREY; if (y <= other) continue;
        const f0 = i / n, f1 = (i + 1) / n;
        let a, b;
        if (sx) { const x = sx > 0 ? col + 1 : col; const z0 = dz > 0 ? row + f0 : dz < 0 ? row + 1 - f0 : row, z1 = dz > 0 ? row + f1 : dz < 0 ? row + 1 - f1 : row + 1; a = [x, z0]; b = [x, z1]; }
        else { const z = sz > 0 ? row + 1 : row; const x0 = dx > 0 ? col + f0 : dx < 0 ? col + 1 - f0 : col, x1 = dx > 0 ? col + f1 : dx < 0 ? col + 1 - f1 : col + 1; a = [x0, z]; b = [x1, z]; }
        const quad = [[a[0], y, a[1]], [a[0], other, a[1]], [b[0], other, b[1]], [b[0], y, b[1]]];
        // Wind the face outward.
        const cross = (b[0] - a[0]) * sz - (b[1] - a[1]) * sx;
        cliffs.quad(cross > 0 ? [quad[3], quad[2], quad[1], quad[0]] : quad, [sx, 0, sz], [[0, 0], [0, y - other], [.2, y - other], [.2, 0]], [.9, .9, .9]);
      }
    }
  }
  buildPits(map, group, theme) {
    const t = THEMES[theme], liquid = new Builder();
    for (let row = 0; row < map.rows; row++) for (let col = 0; col < map.cols; col++) if (map.grid[row][col] === '~') {
      liquid.quad([[col, -.35, row], [col, -.35, row + 1], [col + 1, -.35, row + 1], [col + 1, -.35, row]], [0, 1, 0], [[col / 3, row / 3], [col / 3, (row + 1) / 3], [(col + 1) / 3, (row + 1) / 3], [(col + 1) / 3, row / 3]]);
    }
    if (t.pit === 'water' || t.pit === 'lava' || t.pit === 'bog') {
      const texture = liquidTexture(theme);
      const mat = new THREE.MeshStandardMaterial({ map: texture, roughness: t.pit === 'water' ? .15 : .7, metalness: t.pit === 'water' ? .2 : 0, transparent: t.pit === 'water', opacity: .9,
        emissive: t.pit === 'lava' ? colour('#ff5a10') : colour('#000000'), emissiveMap: t.pit === 'lava' ? texture : null, emissiveIntensity: t.pit === 'lava' ? 1.4 : 0 });
      const mesh = new THREE.Mesh(liquid.build(), mat); mesh.receiveShadow = true; group.add(mesh); this.liquid = texture;
      if (t.pit === 'lava') for (let i = 0; i < 6; i++) { const light = new THREE.PointLight('#ff6a20', 3, 6, 1.6); const spot = this.pitSpot(map, i); light.position.set(spot.x, .3, spot.z); group.add(light); }
    } else this.liquid = null;
    // Far below the arena: clouds for the sky bridges, mist for the chasms.
    if (t.pit === 'sky' || t.pit === 'chasm') {
      const texture = liquidTexture(theme); texture.repeat.set(8, 8);
      const deep = new THREE.Mesh(new THREE.PlaneGeometry(map.cols * 3, map.rows * 3), new THREE.MeshBasicMaterial({ map: texture, color: t.pit === 'sky' ? '#ffffff' : '#3a2e58', transparent: true, opacity: t.pit === 'sky' ? .9 : .6, fog: false }));
      deep.rotation.x = -Math.PI / 2; deep.position.set(map.cols / 2, t.pit === 'sky' ? -9 : -6, map.rows / 2); group.add(deep); this.liquid = texture;
    }
  }
  pitSpot(map, i) {
    const pits = []; for (let row = 0; row < map.rows; row++) for (let col = 0; col < map.cols; col++) if (map.grid[row][col] === '~') pits.push({ x: col + .5, z: row + .5 });
    return pits[Math.floor(pits.length * (i + .5) / 6)] || { x: 0, z: 0 };
  }
  /** Hedge walls get round leafy bushes on top, like Spiral Knights' garden mazes. */
  buildHedges(map, group, t, top) {
    const cells = []; for (let row = 0; row < map.rows; row++) for (let col = 0; col < map.cols; col++) if (isWall(map, col, row) && row > 0 && col > 0 && row < map.rows - 1 && col < map.cols - 1) cells.push([col, row]);
    const geometry = new THREE.SphereGeometry(.42, 12, 9), mat = new THREE.MeshStandardMaterial({ color: t.wallTop, roughness: .9 });
    const mesh = new THREE.InstancedMesh(geometry, mat, cells.length * 2); mesh.castShadow = true; mesh.receiveShadow = true;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    cells.forEach(([col, row], i) => {
      for (let k = 0; k < 2; k++) {
        const s = .9 + hash(col * 2 + k, row) * .35;
        m.compose(new THREE.Vector3(col + .3 + k * .4, top(col, row) + .05, row + .35 + hash(col, row + k) * .3), q, new THREE.Vector3(s, s * .75, s));
        mesh.setMatrixAt(i * 2 + k, m); mesh.setColorAt(i * 2 + k, c.set(t.wallTop).offsetHSL(0, 0, (hash(col, row * 3 + k) - .5) * .08));
      }
    });
    group.add(mesh);
  }
  /** Floor lamps along the walls: a short post with a glowing cap. */
  buildLamps(map, group, t, cell, base) {
    const postGeo = new THREE.CylinderGeometry(.12, .16, .26, 8), capGeo = new THREE.SphereGeometry(.13, 12, 10);
    const postMat = new THREE.MeshStandardMaterial({ color: '#4a4a52', roughness: .6, metalness: .4 }), capMat = new THREE.MeshStandardMaterial({ color: t.lamp, emissive: t.lamp, emissiveIntensity: 2.2 });
    const glowMat = new THREE.SpriteMaterial({ map: this.glow, color: t.lamp, transparent: true, opacity: .85, depthWrite: false, blending: THREE.AdditiveBlending });
    let placed = 0;
    for (let row = 1; row < map.rows - 1; row++) for (let col = 1; col < map.cols - 1; col++) {
      if (cell(col, row) !== 'floor' || STAIRS[levelCell(map, col, row)]) continue;
      if (!(isWall(map, col, row - 1) && (col + row * 3) % 5 === 0)) continue;
      const y = base(col, row), post = new THREE.Mesh(postGeo, postMat); post.position.set(col + .5, y + .11, row + .14); post.castShadow = true;
      const cap = new THREE.Mesh(capGeo, capMat); cap.position.set(col + .5, y + .26, row + .14);
      const glow = new THREE.Sprite(glowMat); glow.scale.set(1.5, 1.5, 1.5); glow.position.copy(cap.position);
      group.add(post, cap, glow); placed++;
    }
    this.lampCount = placed;
  }
  /** Bases: three heart pads against the back wall of each spawn room. */
  buildBases(map, group) {
    this.pads = [];
    const padGeo = new THREE.BoxGeometry(.62, .1, .62), rimGeo = new THREE.TorusGeometry(.24, .04, 8, 24);
    const padMat = new THREE.MeshStandardMaterial({ color: '#c9a24a', roughness: .4, metalness: .6 }), rimMat = new THREE.MeshStandardMaterial({ color: '#ffd36b', emissive: '#ffb020', emissiveIntensity: 1.4 });
    const heartGeo = this.heartGeometry(), heartMat = new THREE.MeshStandardMaterial({ color: '#ff3a5a', emissive: '#ff2040', emissiveIntensity: .6, roughness: .35 });
    map.spawns.forEach((spots, team) => {
      const xs = spots.map(p => p.x / TILE), zs = spots.map(p => p.y / TILE);
      const edge = team === 0 ? Math.min(...xs) : Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
      for (let i = 0; i < 3; i++) {
        const z = lerp(z0, z1, i / 2), x = edge, y = levelCell(map, Math.floor(x), Math.floor(z)) === '1' ? STOREY : 0;
        const pad = new THREE.Mesh(padGeo, padMat); pad.position.set(x, y + .05, z); pad.receiveShadow = true; pad.castShadow = true;
        const rim = new THREE.Mesh(rimGeo, rimMat); rim.rotation.x = -Math.PI / 2; rim.position.set(x, y + .11, z);
        const heart = new THREE.Mesh(heartGeo, heartMat); heart.position.set(x, y + .55, z); heart.castShadow = true;
        group.add(pad, rim, heart); this.pads.push(heart);
      }
      const light = new THREE.PointLight(TEAM_COLORS[team].main, 4, 7, 1.5); light.position.set(lerp(Math.min(...xs), Math.max(...xs), .5), 1.6, lerp(z0, z1, .5)); group.add(light);
    });
  }
  heartGeometry() {
    const shape = new THREE.Shape(), s = .16;
    shape.moveTo(0, -s * 1.1); shape.bezierCurveTo(-s * 2, -s * .1, -s * 1.2, s * 1.4, 0, s * .55); shape.bezierCurveTo(s * 1.2, s * 1.4, s * 2, -s * .1, 0, -s * 1.1);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: .1, bevelEnabled: true, bevelThickness: .04, bevelSize: .04, bevelSegments: 3 }); geometry.center();
    return geometry;
  }
  /** Control points: a round mechanical platform ringed with lamps, a floating crystal, and the capture ring. */
  buildPoints(map, group) {
    this.pointViews = map.points.map(point => {
      const x = point.x * U, z = point.y * U, radius = RULES.pointRadius * U, view = new THREE.Group(); view.position.set(x, 0, z);
      const court = new THREE.Mesh(new THREE.CircleGeometry(radius, 64), new THREE.MeshStandardMaterial({ map: this.courtMap ||= courtTexture(), transparent: true, roughness: .6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      court.rotation.x = -Math.PI / 2; court.position.y = .012; court.receiveShadow = true; view.add(court);
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(radius * .5, radius * .56, .22, 40), new THREE.MeshStandardMaterial({ color: '#b08a5a', roughness: .4, metalness: .65 }));
      plate.position.y = .11; plate.receiveShadow = true; plate.castShadow = true;
      const inner = new THREE.Mesh(new THREE.CylinderGeometry(radius * .36, radius * .38, .1, 32), new THREE.MeshStandardMaterial({ color: '#5a6878', roughness: .35, metalness: .7 })); inner.position.y = .25; inner.receiveShadow = true;
      const studMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 1.6 }), studs = [];
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, stud = new THREE.Mesh(new THREE.CylinderGeometry(.1, .12, .08, 12), studMat); stud.position.set(Math.cos(a) * radius * .46, .25, Math.sin(a) * radius * .46); studs.push(stud); view.add(stud); }
      const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(.16, .26, .5, 10), new THREE.MeshStandardMaterial({ color: '#8a7a5a', roughness: .4, metalness: .7 })); pedestal.position.y = .5; pedestal.castShadow = true;
      const crystalMat = new THREE.MeshStandardMaterial({ color: '#e8f4ff', emissive: '#a0c8ff', emissiveIntensity: .9, roughness: .15, metalness: .1 });
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(.32, 0), crystalMat); crystal.scale.set(1, 1.7, 1); crystal.position.y = 1.25; crystal.castShadow = true;
      const crystalGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color: '#a0c8ff', transparent: true, opacity: .7, depthWrite: false, blending: THREE.AdditiveBlending })); crystalGlow.scale.set(2.4, 2.4, 1); crystalGlow.position.y = 1.25;
      // The capture zone: a thin outline on the floor, and an arc that fills with the capturing team's colour.
      const zone = new THREE.Mesh(arcGeometry(radius + .02, radius + .1, 0, Math.PI * 2, 64), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .35, depthWrite: false })); zone.position.y = .03;
      const fill = new THREE.Mesh(arcGeometry(radius + .02, radius + .22, 0, Math.PI * 2, 64), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .9, depthWrite: false, blending: THREE.AdditiveBlending })); fill.position.y = .04;
      const light = new THREE.PointLight('#a0c8ff', 5, 6, 1.4); light.position.y = 1.4;
      view.add(plate, inner, pedestal, crystal, crystalGlow, zone, fill, light); group.add(view);
      return { point, view, crystal, crystalMat, crystalGlow, fill, zone, light, studs, studMat, radius, progressShown: null };
    });
  }

  // ---------- knights ----------
  makeKnight(player) {
    const group = new THREE.Group(), team = colour(TEAM_COLORS[player.team].main), armorColor = colour(this.armorColour(player.armor)), helmColor = colour(this.armorColour(player.helmet === 'none' ? player.armor : player.helmet));
    const std = (c, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .55, metalness: .25, ...extra });
    const body = new THREE.Group(); group.add(body);
    const legGeo = new THREE.CapsuleGeometry(.075, .12, 4, 8), legMat = std(player.pants === 'none' ? '#3a3a42' : this.armorColour(player.pants));
    const legL = new THREE.Mesh(legGeo, legMat), legR = new THREE.Mesh(legGeo, legMat); legL.position.set(0, .15, -.1); legR.position.set(0, .15, .1);
    const bootMat = std(player.shoes === 'none' ? '#2a2a30' : this.armorColour(player.shoes));
    const bootL = new THREE.Mesh(new THREE.BoxGeometry(.2, .08, .13), bootMat), bootR = bootL.clone(); bootL.position.set(.03, .04, -.1); bootR.position.set(.03, .04, .1);
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.2, .1, 6, 12), std(player.armor === 'none' ? '#efe6d2' : armorColor, { metalness: player.armor === 'none' ? 0 : .45 }));
    torso.scale.set(.95, 1, 1.1); torso.position.y = .38;
    const belt = new THREE.Mesh(new THREE.TorusGeometry(.2, .035, 6, 20), std(team, { emissive: team, emissiveIntensity: .35 })); belt.rotation.x = Math.PI / 2; belt.position.y = .3;
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(.26, 18, 14), std(player.helmet === 'none' ? '#5a3a28' : helmColor, { metalness: player.helmet === 'none' ? 0 : .5, roughness: player.helmet === 'none' ? .9 : .35 }));
    helmet.position.set(-.03, .7, 0); helmet.scale.set(.95, .95, 1);
    // The face shows through an open visor: skin, two dark eyes and a brim above them.
    const face = new THREE.Mesh(new THREE.SphereGeometry(.2, 16, 12), std('#f3cfae', { metalness: 0, roughness: .75 })); face.position.set(.12, .66, 0); face.scale.set(.75, .78, .95);
    const eyeGeo = new THREE.CapsuleGeometry(.025, .04, 3, 6), eyeMat = std('#1a1c22', { metalness: 0, roughness: .3 });
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat), eyeR = new THREE.Mesh(eyeGeo, eyeMat); eyeL.position.set(.27, .67, -.07); eyeR.position.set(.27, .67, .07);
    const brim = new THREE.Mesh(new THREE.TorusGeometry(.21, .045, 8, 20, Math.PI), std(player.helmet === 'none' ? '#5a3a28' : helmColor, { metalness: .5, roughness: .35 }));
    brim.rotation.set(0, Math.PI / 2, Math.PI / 2); brim.position.set(.1, .74, 0);
    // A team band round the helmet and a class crest on top: readable from the camera above.
    const band = new THREE.Mesh(new THREE.TorusGeometry(.255, .03, 6, 24), std(team, { emissive: team, emissiveIntensity: .5 })); band.rotation.x = Math.PI / 2; band.position.y = .62;
    const crest = new THREE.Mesh(this.crestGeometry(player.cls), std(team, { emissive: team, emissiveIntensity: .35 })); crest.position.y = .95;
    const pauldronGeo = new THREE.SphereGeometry(.1, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), pauldronMat = std(player.armor === 'none' ? '#efe6d2' : armorColor, { metalness: player.armor === 'none' ? 0 : .5 });
    const padL = new THREE.Mesh(pauldronGeo, pauldronMat), padR = new THREE.Mesh(pauldronGeo, pauldronMat); padL.position.set(0, .5, -.2); padR.position.set(0, .5, .2);
    body.add(legL, legR, bootL, bootR, torso, belt, helmet, face, eyeL, eyeR, brim, band, crest, padL, padR);
    // Arms: the right hand holds the weapon on a pivot that the swing turns.
    const armMat = std(player.armor === 'none' ? '#f1c9a5' : armorColor);
    const armL = new THREE.Mesh(new THREE.CapsuleGeometry(.06, .12, 4, 8), armMat); armL.position.set(.02, .4, -.25); armL.rotation.x = .3;
    const pivot = new THREE.Group(); pivot.position.set(.05, .38, .24); body.add(armL, pivot);
    const armR = new THREE.Mesh(new THREE.CapsuleGeometry(.06, .12, 4, 8), armMat); armR.rotation.z = Math.PI / 2; armR.position.set(.08, 0, 0); pivot.add(armR);
    const hand = new THREE.Group(); hand.position.set(.18, 0, 0); pivot.add(hand);
    if (player.cls === 'guardian') { const shield = new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, .05, 18), std('#8a6a3a', { metalness: .6 })); shield.rotation.x = Math.PI / 2; shield.position.set(.1, .4, -.3); body.add(shield); }
    // Team ring at the feet: bright, so allies and enemies read at a glance.
    const ring = new THREE.Mesh(arcGeometry(FEET_RING - .05, FEET_RING, 0, Math.PI * 2, 40), new THREE.MeshBasicMaterial({ color: team, transparent: true, opacity: .95, depthWrite: false, blending: THREE.AdditiveBlending }));
    ring.position.y = .03; group.add(ring);
    const ringGlow = new THREE.Mesh(new THREE.CircleGeometry(FEET_RING, 32), new THREE.MeshBasicMaterial({ color: team, transparent: true, opacity: .18, depthWrite: false, blending: THREE.AdditiveBlending }));
    ringGlow.rotation.x = -Math.PI / 2; ringGlow.position.y = .02; group.add(ringGlow);
    group.traverse(node => { if (node.isMesh && node !== ring && node !== ringGlow) { node.castShadow = true; } });
    group.scale.setScalar(KNIGHT_SCALE);
    this.scene.add(group);
    const view = { group, body, legL, legR, bootL, bootR, pivot, hand, ring, weaponId: null, weapon: null, stride: 0, lastX: player.x, lastY: player.y, key: this.knightKey(player), materials: [] };
    group.traverse(node => { if (node.material) view.materials.push(node.material); });
    return view;
  }
  knightKey(player) { return [player.team, player.cls, player.armor, player.helmet, player.pants, player.shoes].join('|'); }
  armorColour(id) {
    if (!id || id === 'none') return '#d8d2c4';
    const palette = ['#9aa4b2', '#c08a4a', '#5a6270', '#a8483e', '#4e7a52', '#e4dcc8', '#6e5a8e', '#3e6e8a', '#b49a5a', '#7a3e5a'];
    let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
    return palette[Math.abs(h) % palette.length];
  }
  crestGeometry(cls) {
    if (cls === 'striker') { const g = new THREE.ConeGeometry(.07, .24, 4); g.rotateZ(-.9); return g; }
    if (cls === 'recon') return new THREE.ConeGeometry(.1, .14, 6);
    return new THREE.SphereGeometry(.08, 10, 8);
  }
  makeWeapon(id) {
    const weapon = WEAPONS[id], group = new THREE.Group();
    if (!weapon) return group;
    const glow = weapon.element ? colour(ELEMENT[weapon.element] || '#ffffff') : null;
    const metal = new THREE.MeshStandardMaterial({ color: '#d8dde6', roughness: .25, metalness: .85, emissive: glow || '#000000', emissiveIntensity: glow ? .55 : 0 });
    const brass = new THREE.MeshStandardMaterial({ color: '#b8893a', roughness: .35, metalness: .8 }), grip = new THREE.MeshStandardMaterial({ color: '#4a3020', roughness: .8 });
    if (weapon.family === 'blade') {
      const heavy = !!weapon.heavy, length = id === 'maul' ? .55 : heavy ? .78 : id === 'rapier' ? .72 : .62, width = id === 'rapier' ? .035 : heavy ? .17 : .1;
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, .18, 6), grip); handle.rotation.z = Math.PI / 2; handle.position.x = .02;
      const guard = new THREE.Mesh(new THREE.BoxGeometry(.05, .04, .24), brass); guard.position.x = .12;
      if (id === 'maul') { const head = new THREE.Mesh(new THREE.BoxGeometry(.24, .24, .34), new THREE.MeshStandardMaterial({ color: '#7a7066', roughness: .5, metalness: .5 })); head.position.x = .12 + length; const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, length, 6), grip); shaft.rotation.z = Math.PI / 2; shaft.position.x = .12 + length / 2; group.add(handle, shaft, head); }
      else { const blade = new THREE.Mesh(new THREE.BoxGeometry(length, .03, width), metal); blade.position.x = .14 + length / 2; const tip = new THREE.Mesh(new THREE.ConeGeometry(width / 2, .1, 4), metal); tip.rotation.z = -Math.PI / 2; tip.position.x = .14 + length + .05; tip.scale.z = .3; group.add(handle, guard, blade, tip); }
    } else if (weapon.family === 'gun') {
      const long = id === 'rifle' ? .6 : id === 'magnus' || id === 'grimcannon' ? .36 : .3;
      const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(.24, .13, .12), brass); bodyMesh.position.x = .08;
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.045, .055, long, 10), new THREE.MeshStandardMaterial({ color: '#5a6070', roughness: .3, metalness: .8 })); barrel.rotation.z = Math.PI / 2; barrel.position.x = .18 + long / 2;
      const core = new THREE.Mesh(new THREE.SphereGeometry(.05, 10, 8), new THREE.MeshStandardMaterial({ color: glow || '#7fd0ff', emissive: glow || '#7fd0ff', emissiveIntensity: 2 })); core.position.set(.08, .07, 0);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(.06, .14, .07), grip); handle.position.set(0, -.08, 0); handle.rotation.z = .3;
      group.add(bodyMesh, barrel, core, handle);
    } else if (weapon.family === 'bomb') {
      const ball = new THREE.Mesh(new THREE.SphereGeometry(.13, 14, 10), new THREE.MeshStandardMaterial({ color: '#3a3e48', roughness: .4, metalness: .6 })); ball.position.x = .12;
      const band = new THREE.Mesh(new THREE.TorusGeometry(.13, .02, 6, 18), new THREE.MeshStandardMaterial({ color: glow || '#ffb347', emissive: glow || '#ffb347', emissiveIntensity: 1.5 })); band.position.x = .12; band.rotation.y = Math.PI / 2;
      group.add(ball, band);
    }
    group.traverse(node => { if (node.isMesh) node.castShadow = true; });
    return group;
  }
  updateKnight(view, player, map, now, viewer) {
    const x = player.x * U, z = player.y * U, ground = levelAt(map, player.x, player.y) * STOREY;
    view.group.position.set(x, ground, z);
    // Weapon in hand follows the selected slot.
    const weaponId = player.weapons?.[player.slot] || null;
    if (weaponId !== view.weaponId) { if (view.weapon) view.hand.remove(view.weapon); view.weaponId = weaponId; view.weapon = this.makeWeapon(weaponId); view.hand.add(view.weapon); }
    const moved = Math.hypot(player.x - view.lastX, player.y - view.lastY); view.lastX = player.x; view.lastY = player.y;
    if (moved < 30) view.stride += moved * U * 7;
    const moving = Math.hypot(player.vx || 0, player.vy || 0) > 30, swing = Math.sin(view.stride) * (moving ? .7 : 0);
    view.legL.rotation.z = swing; view.legR.rotation.z = -swing; view.bootL.position.x = .03 + Math.sin(view.stride) * (moving ? .08 : 0); view.bootR.position.x = .03 - Math.sin(view.stride) * (moving ? .08 : 0);
    view.body.position.y = moving ? Math.abs(Math.cos(view.stride)) * .04 : Math.sin(now / 400) * .01;
    // Face the aim; a swing turns the weapon arm across its arc.
    const weapon = WEAPONS[weaponId];
    let facing = player.aim, armYaw = 0, armPitch = 0;
    if (player.action === 'swing') {
      const elapsed = player.actionTotal - player.actionTicks, startup = player.swingStartup || 1, active = player.swingActive || 1;
      const progress = elapsed < startup ? 0 : Math.min(1, (elapsed - startup) / active), wind = elapsed < startup ? elapsed / startup : 1;
      facing = player.swingAim;
      armYaw = -player.swingDir * (player.swingArc / 2) * (wind * (1 - progress) * 1.15) + player.swingDir * (player.swingArc / 2) * progress;
    } else if (['lunge', 'lungeBurst'].includes(player.action)) { facing = player.swingAim; armYaw = 0; }
    else if (player.action === 'spin') armYaw = (now / 60) % (Math.PI * 2);
    else if (player.action === 'slam') { facing = player.swingAim; armPitch = player.actionTicks > (player.actionTotal - (player.chargeMoveTicks || 0)) ? -.9 : .4; }
    else if (weapon?.family === 'blade') armYaw = -.5; // at rest the blade points ahead and to the side
    if (player.charging) armPitch = -.5 - Math.sin(now / 60) * .05;
    view.group.rotation.y = -facing;
    view.pivot.rotation.y = -armYaw; view.pivot.rotation.z = armPitch;
    // Cloak, spawn shield and hit flash.
    const cloaked = player.cloakTicks > 0, alpha = cloaked ? .3 : 1;
    for (const material of view.materials) { if (material.transparent !== (alpha < 1) && material.blending !== THREE.AdditiveBlending) { material.transparent = alpha < 1; material.needsUpdate = true; } if (material.blending !== THREE.AdditiveBlending) material.opacity = alpha; }
    const flash = this.flashes?.get(player.id), hit = flash && now - flash < 110;
    if (hit !== view.hit) { view.hit = hit; view.body.traverse(node => { if (node.isMesh && node.material.emissive) { if (hit) { node.material.userData.saved ??= [node.material.emissive.clone(), node.material.emissiveIntensity]; node.material.emissive.set('#ffffff'); node.material.emissiveIntensity = .9; } else if (node.material.userData.saved) { node.material.emissive.copy(node.material.userData.saved[0]); node.material.emissiveIntensity = node.material.userData.saved[1]; } } }); }
    view.ring.material.opacity = player.id === viewer ? 1 : .8;
    view.group.visible = true;
  }

  // ---------- frame ----------
  render(state, { localId = null, now = performance.now(), focus = null, pointer = null } = {}) {
    const map = MAPS[state.mapId]; if (!map) return;
    this.buildMap(map);
    this.localId = localId;
    const local = state.players[localId ?? -1];
    this.viewer = local?.alive ? local : null;
    this.consumeEvents(state, now);
    // Camera: a steep ¾ perspective behind and above the knight, easing after them.
    const goal = focus ? { x: focus.x, y: focus.y } : local ? { x: local.x, y: local.y } : { x: map.width / 2, y: map.height / 2 };
    const goalHeight = local && !focus ? levelAt(map, local.x, local.y) * STOREY : 0;
    const wanted = new THREE.Vector3(goal.x * U, goalHeight, goal.y * U);
    if (!this.cameraReady) { this.target.copy(wanted); this.cameraReady = true; } else this.target.lerp(wanted, .14);
    const shakeX = this.shake ? (Math.random() - .5) * this.shake * .02 : 0, shakeZ = this.shake ? (Math.random() - .5) * this.shake * .02 : 0;
    this.shake = this.shake > .2 ? this.shake * .86 : 0;
    this.camera3.position.set(this.target.x + shakeX, this.target.y + 12.6, this.target.z + 11.2 + shakeZ);
    this.camera3.lookAt(this.target.x + shakeX, this.target.y, this.target.z + shakeZ);
    // The sun's shadow box follows the camera target.
    this.sun.position.set(this.target.x - 7, this.target.y + 16, this.target.z - 4); this.sun.target.position.copy(this.target);
    if (this.liquid) { this.liquid.offset.x = (now / 9000) % 1; this.liquid.offset.y = (now / 13000) % 1; }
    for (const heart of this.pads || []) { heart.rotation.y = now / 700; heart.position.y += (Math.sin(now / 300) * .002); }
    this.updatePoints(state, now);
    this.updateKnights(state, map, now, local);
    this.updateShots(state, map);
    this.updateBombs(state, map, now);
    this.updatePickups(state, map, now);
    this.updateClouds(state, map, now);
    this.updateEffects(now);
    this.gl.render(this.scene, this.camera3);
    this.drawOverlay(state, map, now, local, pointer);
  }
  updatePoints(state, now) {
    for (const view of this.pointViews || []) {
      const point = state.points.find(p => p.id === view.point.id) || view.point, owner = point.owner ?? null, progress = (point.progress || 0) / 100;
      const ownColour = owner === null ? colour('#c8d8ff') : colour(TEAM_COLORS[owner].main);
      view.crystalMat.emissive.copy(ownColour); view.crystalMat.color.copy(ownColour).lerp(colour('#ffffff'), .5);
      view.crystalGlow.material.color.copy(ownColour); view.light.color.copy(ownColour);
      view.crystal.rotation.y = now / 900; view.crystal.position.y = 1.25 + Math.sin(now / 500) * .07;
      view.studMat.emissive.copy(ownColour).lerp(colour('#ffffff'), .4);
      // The fill arc shows the capture in progress, in the colour of the team it leans toward.
      const amount = Math.abs(progress), toward = progress >= 0 ? 0 : 1;
      if (view.progressShown !== Math.round(amount * 64)) {
        view.progressShown = Math.round(amount * 64); view.fill.geometry.dispose();
        view.fill.geometry = arcGeometry(view.radius + .02, view.radius + .22, -Math.PI / 2, -Math.PI / 2 + Math.max(.001, amount) * Math.PI * 2, 64);
      }
      view.fill.material.color.set(TEAM_COLORS[toward].main); view.fill.visible = amount > .005;
      const contested = point.counts && point.counts[0] > 0 && point.counts[1] > 0;
      view.zone.material.opacity = contested ? .45 + .3 * Math.sin(now / 90) : .35;
    }
  }
  updateKnights(state, map, now, local) {
    const viewerTeam = local?.team ?? null, seen = new Set();
    for (const player of state.players) {
      const hiddenEnemy = player.cloakTicks > 0 && viewerTeam !== null && player.team !== viewerTeam && !(local?.alive && Math.hypot(local.x - player.x, local.y - player.y) < ABILITIES.cloak.revealRange);
      if (!player.alive || hiddenEnemy) continue;
      seen.add(player.id);
      let view = this.knights.get(player.id);
      if (view && view.key !== this.knightKey(player)) { this.scene.remove(view.group); view = null; }
      if (!view) { view = this.makeKnight(player); this.knights.set(player.id, view); }
      this.updateKnight(view, player, map, now, this.localId);
      this.updateGuard(view, player, now);
    }
    for (const [id, view] of this.knights) if (!seen.has(id)) view.group.visible = false;
  }
  updateGuard(view, player, now) {
    const up = player.guarding && player.guardRaise >= GUARD.raiseTicks;
    if (up && !view.bubble) {
      view.bubble = new THREE.Mesh(new THREE.SphereGeometry(.55, 24, 16), new THREE.MeshStandardMaterial({ color: TEAM_COLORS[player.team].light, emissive: TEAM_COLORS[player.team].main, emissiveIntensity: .5, transparent: true, opacity: .28, depthWrite: false }));
      view.bubble.position.y = .45; view.group.add(view.bubble);
    }
    if (view.bubble) view.bubble.visible = up;
    const dome = up && player.guardRaise >= GUARD.expandTicks && !player.domeBroken && player.domeHp > 0;
    if (dome && !view.dome) {
      view.dome = new THREE.Mesh(new THREE.SphereGeometry(GUARD.radius * U, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: TEAM_COLORS[player.team].light, emissive: TEAM_COLORS[player.team].main, emissiveIntensity: .35, transparent: true, opacity: .16, depthWrite: false, side: THREE.DoubleSide }));
      view.group.add(view.dome);
    }
    if (view.dome) { view.dome.visible = dome; if (dome) view.dome.material.opacity = .12 + .05 * Math.sin(now / 200); }
  }
  updateShots(state, map) {
    const seen = new Set();
    for (const shot of state.projectiles || []) {
      seen.add(shot.id);
      let view = this.shots.get(shot.id);
      if (!view) {
        const tint = colour(shot.status ? STATUS_COLOR[shot.status] || '#ffffff' : TEAM_COLORS[shot.team]?.light || '#ffffff');
        const size = Math.max(.07, (shot.size || 5) * U * 1.3);
        const ball = new THREE.Mesh(new THREE.SphereGeometry(size, 10, 8), new THREE.MeshBasicMaterial({ color: tint.clone().lerp(colour('#ffffff'), .5) }));
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color: tint, transparent: true, opacity: .9, depthWrite: false, blending: THREE.AdditiveBlending })); glow.scale.setScalar(size * 7);
        const trail = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color: tint, transparent: true, opacity: .4, depthWrite: false, blending: THREE.AdditiveBlending })); trail.scale.setScalar(size * 4);
        view = new THREE.Group(); view.add(ball, glow); view.userData.trail = trail; this.scene.add(view, trail); this.shots.set(shot.id, view);
      }
      const y = (shot.z || 0) * STOREY + KNIGHT * .45;
      view.position.set(shot.x * U, y, shot.y * U);
      view.userData.trail.position.set((shot.x - shot.vx * .03) * U, y, (shot.y - shot.vy * .03) * U);
      if (shot.grow) view.scale.setScalar(1 + (shot.size || 5) / 30);
    }
    for (const [id, view] of this.shots) if (!seen.has(id)) { this.scene.remove(view, view.userData.trail); this.shots.delete(id); }
  }
  updateBombs(state, map, now) {
    const seen = new Set();
    for (const bomb of state.bombs || []) {
      seen.add(bomb.id);
      let view = this.bombs.get(bomb.id);
      const weapon = WEAPONS[bomb.weapon], tint = colour(ELEMENT[weapon?.element] || (weapon?.cloud ? STATUS_COLOR[weapon.cloud.status] : '#ffb347') || '#ffb347');
      if (!view) {
        view = new THREE.Group();
        const ball = new THREE.Mesh(new THREE.SphereGeometry(.2, 16, 12), new THREE.MeshStandardMaterial({ color: '#3a3e48', roughness: .4, metalness: .6 })); ball.position.y = .2; ball.castShadow = true;
        const light = new THREE.Mesh(new THREE.SphereGeometry(.06, 8, 6), new THREE.MeshBasicMaterial({ color: tint })); light.position.y = .42;
        const radius = (weapon?.cloud?.radius || weapon?.radius || 60) * U;
        const zone = new THREE.Mesh(arcGeometry(radius - .05, radius, 0, Math.PI * 2, 48), new THREE.MeshBasicMaterial({ color: tint, transparent: true, opacity: .6, depthWrite: false, blending: THREE.AdditiveBlending })); zone.position.y = .04;
        view.add(ball, light, zone); view.userData = { light, zone }; this.scene.add(view); this.bombs.set(bomb.id, view);
      }
      view.position.set(bomb.x * U, levelAt(map, bomb.x, bomb.y) * STOREY, bomb.y * U);
      const urgency = 1 - bomb.fuse / Math.max(1, bomb.total), blink = Math.sin(now / (120 - urgency * 90)) > 0;
      view.userData.light.visible = blink; view.userData.zone.material.opacity = .25 + urgency * .5;
    }
    for (const [id, view] of this.bombs) if (!seen.has(id)) { this.scene.remove(view); this.bombs.delete(id); }
  }
  updatePickups(state, map, now) {
    const seen = new Set();
    for (const pickup of state.pickups || []) {
      seen.add(pickup.id);
      let view = this.hearts.get(pickup.id);
      if (!view) {
        view = new THREE.Mesh(this.heartGeo ||= this.heartGeometry(), this.heartMat ||= new THREE.MeshStandardMaterial({ color: '#ff3a5a', emissive: '#ff2040', emissiveIntensity: .7, roughness: .35 }));
        view.castShadow = true; this.scene.add(view); this.hearts.set(pickup.id, view);
      }
      view.position.set(pickup.x * U, levelAt(map, pickup.x, pickup.y) * STOREY + .4 + Math.sin(now / 250 + pickup.id) * .06, pickup.y * U); view.rotation.y = now / 500 + pickup.id;
      view.visible = !(pickup.ttl < 180 && Math.floor(now / 120) % 2);
    }
    for (const [id, view] of this.hearts) if (!seen.has(id)) { this.scene.remove(view); this.hearts.delete(id); }
  }
  updateClouds(state, map, now) {
    const seen = new Set();
    for (const cloud of state.clouds || []) {
      seen.add(cloud.id);
      let view = this.clouds.get(cloud.id);
      if (!view) {
        view = new THREE.Mesh(new THREE.CylinderGeometry(cloud.radius * U, cloud.radius * U, .6, 32, 1, true), new THREE.MeshBasicMaterial({ color: STATUS_COLOR[cloud.status] || '#ffffff', transparent: true, opacity: .22, depthWrite: false, side: THREE.DoubleSide }));
        const disc = new THREE.Mesh(new THREE.CircleGeometry(cloud.radius * U, 32), new THREE.MeshBasicMaterial({ color: STATUS_COLOR[cloud.status] || '#ffffff', transparent: true, opacity: .25, depthWrite: false })); disc.rotation.x = -Math.PI / 2; disc.position.y = -.27; view.add(disc);
        this.scene.add(view); this.clouds.set(cloud.id, view);
      }
      view.position.set(cloud.x * U, levelAt(map, cloud.x, cloud.y) * STOREY + .3, cloud.y * U);
      const fade = Math.min(1, cloud.ticks / 60); view.material.opacity = .22 * fade; view.rotation.y = now / 2000;
    }
    for (const [id, view] of this.clouds) if (!seen.has(id)) { this.scene.remove(view); this.clouds.delete(id); }
  }

  // ---------- events → effects ----------
  consumeEvents(state, now) {
    this.flashes ||= new Map();
    const map = MAPS[state.mapId];
    const at = (x, y, lift = 0) => new THREE.Vector3(x * U, (map ? levelAt(map, x, y) * STOREY : 0) + lift, y * U);
    for (const event of state.events || []) {
      if (this.seenEvents.has(event.id)) continue;
      this.seenEvents.add(event.id); this.eventOrder.push(event.id);
      if (this.eventOrder.length > 600) this.seenEvents.delete(this.eventOrder.shift());
      if (state.tick - event.tick > 30) continue;
      const mine = event.playerId === this.localId || event.targetId === this.localId;
      if (event.type === 'swing') this.slashEffect(state, event, now);
      else if (event.type === 'damage') {
        this.flashes.set(event.targetId, now);
        this.texts.push({ x: event.x, y: event.y, lift: KNIGHT + .1, text: String(event.amount), color: event.kind === 'burn' ? STATUS_COLOR.burn : event.kind === 'shock' || event.kind === 'chain' ? STATUS_COLOR.shock : '#ffffff', born: now, life: 700, size: 15, rise: 30 });
        this.burst(at(event.x, event.y, .5), '#ffffff', .5, 160, now);
        if (event.targetId === this.localId) this.shake = Math.max(this.shake, Math.min(8, 2 + event.amount / 5));
      } else if (event.type === 'explosion') { this.burst(at(event.x, event.y, .3), event.burst ? '#ffcf8a' : '#ffb347', (event.radius || 60) * U * 2, 420, now, true); this.shakeNear(event.x, event.y, 6); }
      else if (event.type === 'slam') { this.ringEffect(at(event.x, event.y, .05), (event.radius || 80) * U, '#ffe0a0', 420, now); this.shakeNear(event.x, event.y, 7); }
      else if (event.type === 'shot') this.burst(at(event.x + Math.cos(event.angle) * 22, event.y + Math.sin(event.angle) * 22, KNIGHT * .45), '#fff4c0', .45, 90, now);
      else if (event.type === 'kill') this.burst(at(event.x, event.y, .5), '#ffffff', 1.6, 500, now, true);
      else if (event.type === 'capture') this.ringEffect(at(event.x, event.y, .05), RULES.pointRadius * U, TEAM_COLORS[event.team]?.main || '#ffffff', 900, now);
      else if (event.type === 'heal' || event.type === 'dome') this.ringEffect(at(event.x, event.y, .05), (event.radius || 60) * U, '#7dff9a', 500, now);
      else if (event.type === 'heartUse' || event.type === 'heartPickup') this.texts.push({ x: event.x, y: event.y, lift: KNIGHT + .2, text: `+${event.amount}`, color: '#7dff9a', born: now, life: 800, size: 15, rise: 26 });
      else if (event.type === 'status') this.texts.push({ x: event.x, y: event.y, lift: KNIGHT + .35, text: event.status.toUpperCase(), color: STATUS_COLOR[event.status] || '#ffffff', born: now, life: 600, size: 12, rise: 18 });
      else if (event.type === 'chain') this.beam(at(event.fromX, event.fromY, .5), at(event.toX, event.toY, .5), STATUS_COLOR.shock, 220, now);
      if (event.type === 'clash') { this.burst(at(event.x, event.y, .5), '#ffffff', .9, 220, now, true); this.shakeNear(event.x, event.y, 4); }
      if (CALLOUTS[event.type] && mine && !(event.type === 'interrupt' && event.by === 'clash')) {
        const [text, color, on] = CALLOUTS[event.type], who = on === 'target' ? event.targetId : event.playerId;
        const row = this.texts.filter(t => t.callout && t.playerId === who && now - t.born < t.life).length;
        this.texts.push({ x: event.x, y: event.y, lift: KNIGHT + .55, text, color, born: now, life: 650, size: 13, rise: 14, callout: true, playerId: who, row });
      }
    }
    this.texts = this.texts.filter(t => now - t.born < t.life);
  }
  shakeNear(x, y, amount) { const v = this.viewer; if (!v) return; const d = Math.hypot(v.x - x, v.y - y); if (d < 500) this.shake = Math.max(this.shake, amount * (1 - d / 500)); }
  addEffect(object, now, life, update) { this.scene.add(object); this.effects.push({ object, born: now, life, update }); }
  burst(position, tint, size, life, now, big = false) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color: tint, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending }));
    sprite.position.copy(position); sprite.scale.setScalar(size * .4);
    this.addEffect(sprite, now, life, t => { sprite.scale.setScalar(size * (.4 + t * (big ? 1.2 : .6))); sprite.material.opacity = 1 - t; });
  }
  ringEffect(position, radius, tint, life, now) {
    const mesh = new THREE.Mesh(arcGeometry(.85, 1, 0, Math.PI * 2, 48), new THREE.MeshBasicMaterial({ color: tint, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    mesh.position.copy(position);
    this.addEffect(mesh, now, life, t => { mesh.scale.setScalar(radius * (.3 + .7 * t)); mesh.material.opacity = 1 - t; });
  }
  beam(from, to, tint, life, now) {
    const geometry = new THREE.BufferGeometry().setFromPoints([from, to]), line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: tint, transparent: true }));
    this.addEffect(line, now, life, t => { line.material.opacity = 1 - t; });
  }
  /** The swept arc of a sword cut: it appears where the blade is, in the exact arc and reach of the hit. */
  slashEffect(state, event, now) {
    const owner = state.players[event.playerId], map = MAPS[state.mapId]; if (!owner || !map) return;
    const reach = (event.reach || 70) * U, start = event.angle - event.dir * event.arc / 2, delay = (event.startup || 0) * 1000 / 120, sweep = Math.max(1, (event.active || 1) * 1000 / 120);
    const material = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
    const lift = levelAt(map, owner.x, owner.y) * STOREY + KNIGHT * .4;
    mesh.position.set(owner.x * U, lift, owner.y * U);
    let shown = -1;
    this.addEffect(mesh, now, delay + sweep + 160, (t, age) => {
      const live = state.players[event.playerId]; if (live) mesh.position.set(live.x * U, lift, live.y * U);
      if (age < delay) { material.opacity = 0; return; }
      const progress = Math.min(1, (age - delay) / sweep), key = Math.round(progress * 20);
      if (key !== shown) { shown = key; mesh.geometry.dispose(); const a0 = start, a1 = start + event.dir * event.arc * Math.max(.05, progress); mesh.geometry = arcGeometry(reach * .35, reach, Math.min(a0, a1), Math.max(a0, a1), 20); }
      material.opacity = progress < 1 ? .75 : Math.max(0, .75 * (1 - (age - delay - sweep) / 160));
    });
  }
  updateEffects(now) {
    this.effects = this.effects.filter(effect => {
      const age = now - effect.born, t = Math.min(1, age / effect.life);
      effect.update?.(t, age);
      if (age >= effect.life) { this.scene.remove(effect.object); effect.object.geometry?.dispose(); effect.object.material?.dispose(); return false; }
      return true;
    });
  }

  // ---------- 2D overlay: names, health, numbers, callouts, crosshair ----------
  drawOverlay(state, map, now, local, pointer) {
    const ctx = this.ctx, canvas = this.overlayCanvas, ratio = canvas.width / Math.max(1, canvas.getBoundingClientRect().width);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const viewerTeam = local?.team ?? null;
    for (const player of state.players) {
      const view = this.knights.get(player.id); if (!player.alive || !view?.group.visible) continue;
      const ground = levelAt(map, player.x, player.y) * STOREY, head = this.project(player.x, player.y, ground + KNIGHT + .25);
      if (!head.visible) continue;
      const ally = viewerTeam === null || player.team === viewerTeam, team = TEAM_COLORS[player.team];
      ctx.textAlign = 'center'; ctx.font = '600 12px system-ui, sans-serif'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.6)';
      ctx.strokeText(player.name, head.x, head.y - 8); ctx.fillStyle = player.id === this.localId ? '#ffffff' : team.light; ctx.fillText(player.name, head.x, head.y - 8);
      if (ally) {
        const w = 40, pct = Math.max(0, player.hp / player.maxHp);
        ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(head.x - w / 2 - 1, head.y - 3, w + 2, 6);
        ctx.fillStyle = pct > .5 ? team.light : pct > .25 ? '#ffd36b' : '#ff6b5a'; ctx.fillRect(head.x - w / 2, head.y - 2, w * pct, 4);
      }
      if (player.cls === 'striker' && player.id === this.localId && (player.boosting || player.boostMeter < ABILITIES.dash.meter)) {
        const feet = this.project(player.x, player.y, ground), w = 40, fill = Math.max(0, Math.min(1, player.boostMeter / ABILITIES.dash.meter));
        ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(feet.x - w / 2 - 1, feet.y + 14, w + 2, 6);
        ctx.fillStyle = player.boostLocked ? '#ff6b5a' : player.boosting ? '#ffd36b' : '#8fd8ff'; ctx.fillRect(feet.x - w / 2, feet.y + 15, w * fill, 4);
      }
      const statuses = STATUS_IDS.filter(id => player.status?.[id] > 0);
      statuses.forEach((id, i) => { ctx.fillStyle = STATUS_COLOR[id] || '#fff'; ctx.beginPath(); ctx.arc(head.x - (statuses.length - 1) * 6 + i * 12, head.y - 26, 4.5, 0, Math.PI * 2); ctx.fill(); });
      if (player.stunTicks > 0) { ctx.fillStyle = '#ffe680'; for (let i = 0; i < 3; i++) { const a = now / 150 + i * 2.1; ctx.beginPath(); ctx.arc(head.x + Math.cos(a) * 14, head.y + 8 + Math.sin(a) * 4, 2.5, 0, Math.PI * 2); ctx.fill(); } }
    }
    for (const text of this.texts) {
      const age = (now - text.born) / text.life, owner = text.playerId !== undefined ? state.players[text.playerId] : null;
      const x = owner?.alive ? owner.x : text.x, y = owner?.alive ? owner.y : text.y;
      const p = this.project(x, y, levelAt(map, x, y) * STOREY + text.lift); if (!p.visible) continue;
      const ty = p.y - (text.row || 0) * 15 - age * text.rise;
      ctx.font = `bold ${text.size}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.65)'; ctx.globalAlpha = Math.min(1, (1 - age) * 3);
      ctx.strokeText(text.text, p.x, ty); ctx.fillStyle = text.color; ctx.fillText(text.text, p.x, ty); ctx.globalAlpha = 1;
    }
    if (pointer && this.overlay) this.overlay.drawCrosshair(ctx, pointer, local, now);
  }
}
