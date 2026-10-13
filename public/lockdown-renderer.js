/** Lockdown ¾-view canvas renderer (Spiral Knights style, with our own art).
 * The simulation is flat; this view tilts it: walls are drawn raised with a front face,
 * knights stand up and turn toward their aim in eight directions, and shots and swings
 * travel at chest height. Everything that stands up is depth-sorted, so knights pass
 * behind walls. Draws from the art manifest when a sprite exists and falls back to
 * readable placeholder shapes otherwise. Pure presentation: it never changes the state. */
import { MAPS, TILE, RULES, ABILITIES, WEAPONS, CLASSES, ARMORS, GUARD, STATUS_IDS, inBase, chargeTicksFor } from './lockdown-engine.js';
import { isWall, isPit, levelAt, levelCell, STAIRS } from './lockdown-maps.js';
import { KNIGHT_FACINGS } from './lockdown-assets.js';

/** How far a wall's top face is lifted, and the height that shots and swings travel at. */
export const WALL_HEIGHT = 24, BODY_LIFT = 22;
const FEET = 8; // a knight's feet sit this far below the centre of its collision circle
/** On two-floor maps the raised floor is one storey up: this many pixels on screen. */
export const FLOOR_RISE = 24;
/** The ¾ camera: the floor is seen tilted, so ground depth is foreshortened to this fraction on screen
 * (a 48x48 tile shows as 48x36). Upright things (knights, wall faces, ledges) keep their full height.
 * The simulation stays flat and exact: every ring drawn on the floor is the real hit area. */
export const GROUND = .75;
const TK = TILE * GROUND; // on-screen depth of one tile
/** Things on the raised floor sort a little later, so the floor they stand on never covers their feet. */
const RAISED_SORT = 16;
const WEAPON_SCALE = .75;
const TICK_MS = 1000 / 120;
const STATUS_COLORS = Object.freeze({ burn: '#ff8a3d', poison: '#7bd65a', shock: '#7fc8ff', freeze: '#bfeaff', chill: '#6fb6ff', curse: '#b26bff', drain: '#ff4d6d' });
/** A weapon's element colour (glow on the blade or muzzle, tint on its shots). */
const FLAT_EFFECTS = new Set(['slash', 'spinTurn', 'slam', 'dust', 'vortexOpen', 'explosion', 'heal', 'capture', 'pop', 'kill']);
const elementColor = weapon => weapon?.element ? STATUS_COLORS[weapon.element] : null;
const SHOT_COLORS = Object.freeze({ thorn: '#9bd36a', wave: '#6b4fa8', pulse: '#9fe8ee', ricochet: '#8fd0ff', catalyst: '#ffd36b', detonator: '#ff7b5a', shard: '#d8e4ef' });
/** Aim angle → which drawn row faces it, and whether to mirror it (eight directions). */
export function knightFacing(aim) {
  const degrees = Math.atan2(Math.sin(aim), Math.cos(aim)) * 180 / Math.PI, side = Math.abs(degrees); // 0 = right, 90 = down
  if (degrees >= 67.5 && degrees <= 112.5) return { row: 0, flip: false };
  if (degrees <= -67.5 && degrees >= -112.5) return { row: 4, flip: false };
  if (side <= 22.5) return { row: 2, flip: false };
  if (side >= 157.5) return { row: 2, flip: true };
  return degrees > 0 ? { row: 1, flip: degrees > 90 } : { row: 3, flip: degrees < -90 };
}

export const TEAM_COLORS = Object.freeze([
  Object.freeze({ main: '#e39a3b', light: '#ffd08a', dark: '#7a4a14', name: 'Amber' }),
  Object.freeze({ main: '#3bb8c4', light: '#9fe8ee', dark: '#14545c', name: 'Cyan' }),
]);
/** Placeholder palettes per map theme (used until the tile art exists). `pit` is the chasm,
 * water or lava that blocks feet but not shots. */
const THEMES = Object.freeze({
  castle: { floor: '#5d5a52', floorAlt: '#56534c', grout: '#4a4842', wall: '#58616b', wallTop: '#8b949e', wallEdge: '#2b3036', pit: '#24425a', pitEdge: '#5c86a3', pitKind: 'water' },
  maze: { floor: '#6f6550', floorAlt: '#6a604b', grout: '#5d5543', wall: '#2f5a32', wallTop: '#4f8a4a', wallEdge: '#1d3720', pit: '#1f3d2a', pitEdge: '#3d6b46', pitKind: 'chasm' },
  foundry: { floor: '#433b31', floorAlt: '#3e362d', grout: '#352e26', wall: '#6d5a40', wallTop: '#a08a62', wallEdge: '#2a231a', pit: '#a8381a', pitEdge: '#ffb347', pitKind: 'lava' },
  ruins: { floor: '#6f6a58', floorAlt: '#6a6553', grout: '#5c5848', wall: '#5f6b5a', wallTop: '#94a38c', wallEdge: '#2f362c', pit: '#2a6b74', pitEdge: '#8fd6d6', pitKind: 'water' },
  graveyard: { floor: '#3b3f3a', floorAlt: '#373a35', grout: '#2f322d', wall: '#4d5157', wallTop: '#7a7f88', wallEdge: '#24262a', pit: '#121418', pitEdge: '#3a3f4a', pitKind: 'chasm' },
  skyway: { floor: '#7a7f8c', floorAlt: '#737885', grout: '#646876', wall: '#5a6274', wallTop: '#9aa3b8', wallEdge: '#2e3340', pit: '#8fb6e8', pitEdge: '#ffffff', pitKind: 'void' },
  stone: { floor: '#3c4048', floorAlt: '#383b43', grout: '#30333a', wall: '#6b6f78', wallTop: '#8a8f99', wallEdge: '#24262b', pit: '#20242c', pitEdge: '#4a505c', pitKind: 'chasm' },
});
const VIEW_WORLD_WIDTH = 1100; // world units across the screen at the default zoom
const lerp = (a, b, t) => a + (b - a) * t;
const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const armorKey = player => player.armor && player.armor !== 'none' ? `armor_${player.armor}_team${player.team}` : null;

export class LockdownRenderer {
  constructor(canvas, assets) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.assets = assets;
    this.mapCache = null; this.mapKey = ''; this.effects = []; this.seenEvents = new Set(); this.eventOrder = [];
    this.camera = { x: 0, y: 0, zoom: 1 };
    this.flashes = new Map(); this.shake = 0; this.tint = null;
  }
  resize() {
    const ratio = Math.min(2, globalThis.devicePixelRatio || 1), rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width * ratio)), height = Math.max(1, Math.round(rect.height * ratio));
    if (this.canvas.width !== width || this.canvas.height !== height) { this.canvas.width = width; this.canvas.height = height; }
  }
  /** Screen → world, for mouse aiming: undoes the floor tilt for a point `height` pixels above the floor
   * (chest height for aiming, so shots drawn at chest height pass under the pointer). */
  screenToWorld(px, py, height = 0) {
    const ratio = this.canvas.width / Math.max(1, this.canvas.getBoundingClientRect().width);
    const { x, y, zoom } = this.camera;
    return { x: x + (px * ratio - this.canvas.width / 2) / zoom, y: (y + (py * ratio - this.canvas.height / 2) / zoom + height) / GROUND };
  }
  sprite(key) { return this.assets?.get(key) || null; }
  drawSprite(ctx, key, x, y, { rotation = 0, frame = 0, row = 0, scale = 1, flipX = false, flipY = false, alpha = 1 } = {}) {
    const image = this.sprite(key), entry = this.assets?.entry(key);
    if (!image || !entry) return false;
    const frames = entry.frames || 1, rows = entry.rows || 1, fw = entry.size[0] / frames, fh = entry.size[1] / rows;
    // HD art: a PNG may be drawn at 2x (or more) the listed size; it shows at the listed size with the extra detail.
    const density = Math.max(1, Math.round(image.naturalWidth / entry.size[0])) || 1;
    ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(x, y); ctx.rotate(rotation); ctx.scale(scale * (flipX ? -1 : 1), scale * (flipY ? -1 : 1));
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, (Math.floor(frame) % frames) * fw * density, (Math.floor(row) % rows) * fh * density, fw * density, fh * density, -entry.anchor[0], -entry.anchor[1], fw, fh);
    ctx.restore(); return true;
  }
  /** Aim from the knight's chest to the cursor, so shots drawn at chest height pass under the pointer. */
  get aimLift() { return BODY_LIFT; }

  // ---------- static map ----------
  buildMap(map) {
    const key = `${map.id}:${this.assets?.version || 0}`;
    if (this.mapKey === key) return this.mapCache;
    // The static map is cached at the density of its tile art, so HD tiles keep their detail on screen.
    const floorArt = this.sprite(`tile_floor_${map.theme}`), floorEntry = this.assets?.entry(`tile_floor_${map.theme}`);
    const density = this.mapDensity = floorArt && floorEntry ? Math.min(2, Math.max(1, Math.round(floorArt.naturalWidth / floorEntry.size[0]))) : 1;
    const makeCanvas = (width, height) => {
      const made = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(width * density, height * density) : Object.assign(document.createElement('canvas'), { width: width * density, height: height * density });
      made.getContext('2d').scale(density, density); return made;
    };
    const canvas = makeCanvas(map.width, map.height);
    const ctx = canvas.getContext('2d'), theme = THEMES[map.theme] || THEMES.stone;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    // One strip per row of wall blocks: the raised top face, then the front face where floor lies below.
    // Walls standing on the raised floor of a two-floor map are lifted one storey higher.
    this.wallRows = [];
    const high = (col, row) => levelCell(map, col, row) === '1';
    for (let row = 0; row < map.rows; row++) {
      if (!map.grid[row].includes('#')) continue;
      // Strips are in screen space: the top face is foreshortened (TK deep), the front face is full height.
      const strip = makeCanvas(map.width, TK + WALL_HEIGHT + FLOOR_RISE), sctx = strip.getContext('2d');
      sctx.imageSmoothingEnabled = true; sctx.imageSmoothingQuality = 'high';
      for (let col = 0; col < map.cols; col++) {
        if (map.grid[row][col] !== '#') continue;
        const x = col * TILE, top = high(col, row) ? 0 : FLOOR_RISE;
        // The front face drops from this wall's top to whatever is in front: floor, or a lower wall.
        const ownTop = WALL_HEIGHT + (high(col, row) ? FLOOR_RISE : 0), belowWall = isWall(map, col, row + 1);
        const face = ownTop - (belowWall ? WALL_HEIGHT : 0) - (high(col, row + 1) ? FLOOR_RISE : 0);
        if (row + 1 < map.rows && face > 0) {
          if (!this.drawSprite(sctx, `tile_wall_front_${map.theme}`, x, top + TK)) {
            sctx.fillStyle = theme.wall; sctx.fillRect(x, top + TK, TILE, face);
            sctx.fillStyle = theme.wallEdge; sctx.fillRect(x, top + TK + face - 4, TILE, 4);
            sctx.fillStyle = 'rgba(0,0,0,.18)'; for (let course = 1; course < face / 8; course++) sctx.fillRect(x, top + TK + course * 8, TILE, 1);
            sctx.fillRect(x + (row % 2 ? 12 : 30), top + TK, 1, 8); sctx.fillRect(x + (row % 2 ? 36 : 6), top + TK + 8, 1, 8);
          } else if (face > WALL_HEIGHT) this.drawSprite(sctx, `tile_wall_front_${map.theme}`, x, top + TK + WALL_HEIGHT);
        }
        sctx.save(); sctx.translate(0, top); sctx.scale(1, GROUND);
        if (!this.drawSprite(sctx, `tile_wall_top_${map.theme}`, x, 0)) {
          sctx.fillStyle = theme.wallTop; sctx.fillRect(x, 0, TILE, TILE);
          sctx.fillStyle = 'rgba(255,255,255,.12)'; sctx.fillRect(x, 0, TILE, 3);
          sctx.fillStyle = 'rgba(0,0,0,.12)'; if (!isWall(map, col + 1, row)) sctx.fillRect(x + TILE - 3, 0, 3, TILE);
        }
        sctx.restore();
      }
      this.wallRows.push({ row, canvas: strip });
    }
    // Raised floor and stairs: one strip per row, lifted a storey, with a ledge face over lower ground.
    this.floorRows = [];
    if (map.twoFloors) for (let row = 0; row < map.rows; row++) {
      const cells = [...map.levels[row]].map((cell, col) => ({ cell, col })).filter(({ cell, col }) => cell !== '0' && map.grid[row][col] !== '#');
      if (!cells.length) continue;
      const strip = makeCanvas(map.width, TK + FLOOR_RISE), sctx = strip.getContext('2d');
      sctx.imageSmoothingEnabled = true; sctx.imageSmoothingQuality = 'high';
      for (const { cell, col } of cells) {
        const x = col * TILE;
        if (cell === '1') {
          sctx.save(); sctx.scale(1, GROUND); // the raised floor's top, foreshortened like the ground
          const tile = map.grid[row][col], spawnTeam = tile === '1' ? 0 : tile === '2' ? 1 : null, alt = hash(col, row) < .18;
          if (!this.drawSprite(sctx, spawnTeam !== null ? `tile_spawn_team${spawnTeam}` : `tile_floor_${map.theme}${alt ? '_alt' : ''}`, x, 0)) {
            sctx.fillStyle = alt ? theme.floorAlt : theme.floor; sctx.fillRect(x, 0, TILE, TILE);
            sctx.strokeStyle = theme.grout; sctx.lineWidth = 1; sctx.strokeRect(x + .5, .5, TILE - 1, TILE - 1);
            if (spawnTeam !== null) { sctx.fillStyle = TEAM_COLORS[spawnTeam].main + '33'; sctx.fillRect(x, 0, TILE, TILE); }
          }
          // Raised floor catches more light; its rim shows where the drop is.
          sctx.fillStyle = 'rgba(255,240,210,.11)'; sctx.fillRect(x, 0, TILE, TILE);
          sctx.fillStyle = 'rgba(255,255,255,.25)';
          if (levelCell(map, col - 1, row) === '0') sctx.fillRect(x, 0, 2, TILE);
          if (levelCell(map, col + 1, row) === '0') sctx.fillRect(x + TILE - 2, 0, 2, TILE);
          if (levelCell(map, col, row - 1) === '0') sctx.fillRect(x, 0, TILE, 2);
          if (isWall(map, col, row - 1)) { const shade = sctx.createLinearGradient(0, 0, 0, 14); shade.addColorStop(0, 'rgba(0,0,0,.35)'); shade.addColorStop(1, 'rgba(0,0,0,0)'); sctx.fillStyle = shade; sctx.fillRect(x, 0, TILE, 14); }
          sctx.restore();
          const below = levelCell(map, col, row + 1);
          if (row + 1 < map.rows && below !== '1' && below !== '^' && !isWall(map, col, row + 1) && !this.drawSprite(sctx, `tile_ledge_${map.theme}`, x, TK)) {
            sctx.fillStyle = theme.wall; sctx.fillRect(x, TK, TILE, FLOOR_RISE);
            sctx.fillStyle = 'rgba(255,255,255,.18)'; sctx.fillRect(x, TK, TILE, 2);
            sctx.fillStyle = 'rgba(0,0,0,.25)'; sctx.fillRect(x, TK + FLOOR_RISE - 5, TILE, 5); sctx.fillRect(x + (col % 2 ? 16 : 32), TK + 2, 1, FLOOR_RISE - 7);
          }
        } else this.drawStairs(sctx, map, theme, cell, col, row);
      }
      this.floorRows.push({ row, canvas: strip });
    }
    for (let row = 0; row < map.rows; row++) for (let col = 0; col < map.cols; col++) {
      const x = col * TILE, y = row * TILE, cell = map.grid[row][col];
      if (cell === '#' || levelCell(map, col, row) !== '0') continue;
      if (cell === '~') { this.drawPit(ctx, map, theme, col, row); continue; }
      const spawnTeam = cell === '1' ? 0 : cell === '2' ? 1 : null;
      const alt = hash(col, row) < .18;
      if (!this.drawSprite(ctx, spawnTeam !== null ? `tile_spawn_team${spawnTeam}` : `tile_floor_${map.theme}${alt ? '_alt' : ''}`, x, y)) {
        ctx.fillStyle = alt ? theme.floorAlt : theme.floor; ctx.fillRect(x, y, TILE, TILE);
        ctx.strokeStyle = theme.grout; ctx.lineWidth = 1; ctx.strokeRect(x + .5, y + .5, TILE - 1, TILE - 1);
        if (spawnTeam !== null) { ctx.fillStyle = TEAM_COLORS[spawnTeam].main + '33'; ctx.fillRect(x, y, TILE, TILE); }
      }
      // Raised floor casts a shadow on the low ground at its foot, and darkens the ground beside it.
      if (map.twoFloors) {
        if (levelCell(map, col, row - 1) === '1') { const shade = ctx.createLinearGradient(0, y, 0, y + 22); shade.addColorStop(0, 'rgba(0,0,0,.45)'); shade.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = shade; ctx.fillRect(x, y, TILE, 22); }
        if (levelCell(map, col - 1, row) === '1') { const shade = ctx.createLinearGradient(x, 0, x + 14, 0); shade.addColorStop(0, 'rgba(0,0,0,.3)'); shade.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = shade; ctx.fillRect(x, y, 14, TILE); }
        if (levelCell(map, col + 1, row) === '1') { const shade = ctx.createLinearGradient(x + TILE, 0, x + TILE - 14, 0); shade.addColorStop(0, 'rgba(0,0,0,.3)'); shade.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = shade; ctx.fillRect(x + TILE - 14, y, 14, TILE); }
        ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.fillRect(x, y, TILE, TILE);
      }
      // Walls cast a soft shadow onto the floor in front of them.
      if (isWall(map, col, row - 1)) { const shade = ctx.createLinearGradient(0, y, 0, y + 14); shade.addColorStop(0, 'rgba(0,0,0,.35)'); shade.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = shade; ctx.fillRect(x, y, TILE, 14); }
    }
    this.mapCache = canvas; this.mapKey = key; return canvas;
  }

  /** A stair tile, drawn into its row's raised strip: the ramp climbs one storey toward the arrow. */
  drawStairs(ctx, map, theme, cell, col, row) {
    const x = col * TILE, R = FLOOR_RISE;
    if (this.drawSprite(ctx, `tile_stairs_${map.theme}_${({ '^': 'up', v: 'down', '<': 'left', '>': 'right' })[cell]}`, x, 0)) return;
    const T = TK, tread = theme.floor, riser = theme.wall, edge = 'rgba(0,0,0,.28)', steps = 6;
    ctx.save();
    if (cell === '^') {
      // Climbing away from the camera: treads and risers stack up the screen.
      for (let i = 0; i < steps; i++) {
        const y0 = T + R - (i + 1) * (T + R) / steps, h = (T + R) / steps;
        ctx.fillStyle = riser; ctx.fillRect(x, y0 + h * .55, TILE, h * .45); ctx.fillStyle = tread; ctx.fillRect(x, y0, TILE, h * .55);
        ctx.fillStyle = edge; ctx.fillRect(x, y0 + h * .55, TILE, 1);
      }
    } else if (cell === 'v') {
      // Climbing toward the camera: only the treads show, foreshortened.
      for (let i = 0; i < steps; i++) { const y0 = R + i * (T - R) / steps; ctx.fillStyle = i % 2 ? tread : theme.floorAlt; ctx.fillRect(x, y0, TILE, (T - R) / steps + 1); }
      ctx.fillStyle = edge; ctx.fillRect(x, R, TILE, 1);
    } else {
      // Climbing sideways: a sloped top face over a stepped side face.
      const up = cell === '>' ? 1 : -1;
      for (let i = 0; i < steps; i++) {
        const w = TILE / steps, sx = up > 0 ? x + i * w : x + TILE - (i + 1) * w, lift = (i + 1) * R / steps;
        ctx.fillStyle = tread; ctx.fillRect(sx, R - lift, w + .5, T);
        ctx.fillStyle = riser; ctx.fillRect(sx, R - lift + T, w + .5, lift);
        ctx.fillStyle = edge; ctx.fillRect(up > 0 ? sx : sx + w - 1, R - lift, 1, T + lift);
      }
    }
    ctx.restore();
  }
  /** Chasm, water or lava: sunk below the floor, with a lip where it meets solid ground. */
  drawPit(ctx, map, theme, col, row) {
    const x = col * TILE, y = row * TILE;
    const textured = this.drawSprite(ctx, `tile_pit_${map.theme}`, x, y);
    const solid = (c, r) => map.grid[r]?.[c] !== undefined && map.grid[r][c] !== '~';
    if (!textured) {
      ctx.fillStyle = theme.pit; ctx.fillRect(x, y, TILE, TILE);
      if (theme.pitKind === 'void') {
        ctx.fillStyle = 'rgba(255,255,255,.35)'; if (hash(col, row) < .3) { ctx.beginPath(); ctx.ellipse(x + 24, y + 26, 16, 6, 0, 0, Math.PI * 2); ctx.fill(); }
      } else {
        ctx.fillStyle = theme.pitEdge; ctx.globalAlpha = theme.pitKind === 'lava' ? .55 : .3;
        for (let i = 0; i < 3; i++) ctx.fillRect(x + 6 + ((col * 7 + row * 13 + i * 17) % 30), y + 8 + i * 13, 10, 2);
        ctx.globalAlpha = 1;
      }
    }
    // The near lip of the floor above shows as a cut face, like a wall front sunk into the ground.
    if (solid(col, row - 1)) { ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(x, y, TILE, 12); ctx.fillStyle = theme.wallEdge; ctx.fillRect(x, y, TILE, 3); }
    ctx.fillStyle = theme.pitEdge; ctx.globalAlpha = .7;
    if (solid(col - 1, row)) ctx.fillRect(x, y, 2, TILE);
    if (solid(col + 1, row)) ctx.fillRect(x + TILE - 2, y, 2, TILE);
    if (solid(col, row + 1)) ctx.fillRect(x, y + TILE - 2, TILE, 2);
    ctx.globalAlpha = 1;
  }

  // ---------- events → short-lived effects ----------
  consumeEvents(state, now) {
    for (const event of state.events || []) {
      if (this.seenEvents.has(event.id)) continue;
      this.seenEvents.add(event.id); this.eventOrder.push(event.id);
      if (this.eventOrder.length > 600) this.seenEvents.delete(this.eventOrder.shift());
      if (state.tick - event.tick > 30) continue;
      const add = (type, life, extra) => this.effects.push({ type, born: now, life, ...extra });
      // Swings carry their exact arc, reach and timing, so the drawn sweep is the hitbox.
      if (event.type === 'swing') add('slash', (event.startup + event.active) * TICK_MS + 140, { playerId: event.playerId, angle: event.angle, dir: event.dir, arc: event.arc, reach: event.reach, delay: event.startup * TICK_MS, sweep: event.active * TICK_MS });
      else if (event.type === 'spinTurn') add('spinTurn', 18 * TICK_MS + 60, { playerId: event.playerId, reach: event.reach });
      else if (event.type === 'slam') { add('slam', 420, { x: event.x, y: event.y, radius: event.radius }); this.bump(event.x, event.y, 7); }
      else if (event.type === 'shot') add('muzzle', 90, { x: event.x, y: event.y, angle: event.angle, playerId: event.playerId });
      else if (event.type === 'explosion') { add('explosion', 480, { x: event.x, y: event.y, radius: event.radius, weapon: event.weapon }); this.bump(event.x, event.y, 6); }
      else if (event.type === 'vortex') add('vortexOpen', 300, { x: event.x, y: event.y, radius: event.radius });
      else if (event.type === 'damage') {
        add('number', 700, { x: event.x, y: event.y, amount: event.amount, targetId: event.targetId, color: event.kind === 'burn' ? STATUS_COLORS.burn : event.kind === 'shock' || event.kind === 'chain' ? STATUS_COLORS.shock : '#ffffff' });
        this.flashes.set(event.targetId, now);
        if (event.targetId === this.localId) this.shake = Math.max(this.shake, Math.min(8, 2 + event.amount / 5));
      }
      else if (event.type === 'block') add('block', 220, { x: event.x, y: event.y, playerId: event.playerId });
      else if (event.type === 'evade') add('evade', 500, { x: event.x, y: event.y });
      else if (event.type === 'dodge') add('dust', 260, { x: event.x, y: event.y + FEET, angle: event.angle });
      else if (event.type === 'cancel') add('cancel', 160, { playerId: event.playerId });
      else if (event.type === 'guardBreak') { add('guardBreak', 420, { x: event.x, y: event.y, playerId: event.playerId }); if (event.playerId === this.localId) this.shake = Math.max(this.shake, 7); }
      else if (event.type === 'detonate') { add('explosion', 360, { x: event.x, y: event.y, radius: 26 + event.count * 10, weapon: 'catalyzer' }); this.bump(event.x, event.y, 3 + event.count); }
      else if (event.type === 'ricochet') add('spark', 160, { x: event.x, y: event.y });
      else if (event.type === 'chain') add('chain', 220, { fromX: event.fromX, fromY: event.fromY, toX: event.toX, toY: event.toY, seed: Math.random() });
      else if (event.type === 'drain') add('drain', 600, { x: event.x, y: event.y, amount: Math.round(event.amount) });
      else if (event.type === 'cursed') add('statusPop', 400, { x: event.x, y: event.y, status: 'curse' });
      else if (event.type === 'status') add('statusPop', 500, { x: event.x, y: event.y, status: event.status });
      else if (event.type === 'heal') add('heal', 600, { x: event.x, y: event.y, radius: event.radius });
      else if (event.type === 'capture') add('capture', 900, { x: event.x, y: event.y, team: event.team });
      else if (event.type === 'dome') add('heal', 500, { x: event.x, y: event.y, radius: event.radius });
      else if (event.type === 'kill') add('kill', 600, { x: event.x, y: event.y });
      else if (event.type === 'heartPickup') add('healNumber', 800, { x: event.x, y: event.y, amount: event.amount });
      else if (event.type === 'heartUse') add('healNumber', 800, { x: event.x, y: event.y, amount: event.amount });
      else if (event.type === 'heartStored') add('statusPop', 600, { x: event.x, y: event.y, status: 'drain', text: `+♥ ${event.count}/${RULES.heart.stack}` });
    }
    this.effects = this.effects.filter(effect => now - effect.born < effect.life);
    for (const [id, at] of this.flashes) if (now - at > 120) this.flashes.delete(id);
  }
  /** Screen shake when something big happens near the viewer. */
  bump(x, y, amount) {
    const viewer = this.viewer; if (!viewer) return;
    const near = 1 - Math.min(1, Math.hypot(viewer.x - x, viewer.y - y) / 420);
    if (near > 0) this.shake = Math.max(this.shake, amount * near);
  }

  render(state, { localId = null, now = performance.now(), focus = null } = {}) {
    this.resize();
    const ctx = this.ctx, map = MAPS[state.mapId], canvas = this.canvas;
    if (!map) return;
    const local = localId !== null ? state.players[localId] : null;
    this.localId = localId; this.viewer = local?.alive ? local : null;
    this.consumeEvents(state, now);
    const zoom = canvas.width / VIEW_WORLD_WIDTH;
    // The camera works in screen space: ground y is foreshortened by GROUND, heights are not.
    const liftAt = (x, y) => map.twoFloors ? levelAt(map, x, y) * FLOOR_RISE : 0;
    const wanted = focus ? { x: focus.x, y: focus.y * GROUND } : local ? { x: local.x, y: local.y * GROUND - BODY_LIFT / 2 - liftAt(local.x, local.y) } : { x: map.width / 2, y: map.height * GROUND / 2 };
    // Keep the arena filling the screen: clamp to the map edges (centre it when the view is larger).
    const halfW = canvas.width / zoom / 2, halfH = canvas.height / zoom / 2;
    const fit = (value, half, size) => size <= half * 2 ? size / 2 : Math.max(half, Math.min(size - half, value));
    const target = { x: fit(wanted.x, halfW, map.width), y: fit(wanted.y, halfH, map.height * GROUND) };
    this.camera.zoom = zoom;
    this.camera.x = lerp(this.camera.x || target.x, target.x, .25); this.camera.y = lerp(this.camera.y || target.y, target.y, .25);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#16181c'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const shakeX = this.shake ? (Math.random() - .5) * this.shake * 2 : 0, shakeY = this.shake ? (Math.random() - .5) * this.shake * 2 : 0;
    this.shake = this.shake > .2 ? this.shake * .86 : 0;
    ctx.setTransform(zoom, 0, 0, zoom, canvas.width / 2 - (this.camera.x + shakeX) * zoom, canvas.height / 2 - (this.camera.y + shakeY) * zoom);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.buildMap(map), 0, 0, map.width, map.height * GROUND);
    // Two ways to draw: `flat` lies on the (foreshortened) floor at a height; `upright` stands at a
    // world position, so its sprite keeps its proportions.
    const flat = (amount, draw) => () => { ctx.save(); ctx.translate(0, -amount); ctx.scale(1, GROUND); draw(); ctx.restore(); };
    const upright = (y, amount, draw) => () => { ctx.save(); ctx.translate(0, y * (GROUND - 1) - amount); draw(); ctx.restore(); };
    this.flat = flat; this.upright = upright;
    // Floor layer: point plates and rings, domes, bomb radii, shadows and team rings.
    const viewerTeam = local?.team ?? null;
    const players = state.players.filter(player => player.alive && !(player.cloakTicks > 0 && viewerTeam !== null && player.team !== viewerTeam
      && !(local?.alive && Math.hypot(local.x - player.x, local.y - player.y) < ABILITIES.cloak.revealRange)));
    for (const point of state.points) flat(0, () => this.drawPoint(ctx, point, now))();
    // Things on the raised floor are drawn lifted a storey, after it, instead of on the ground layer.
    const lift = liftAt;
    const raisedFloor = [];
    const onFloor = (x, y, draw) => { const amount = lift(x, y); if (amount) raisedFloor.push(flat(amount, draw)); else flat(0, draw)(); };
    for (const cloud of state.clouds || []) onFloor(cloud.x, cloud.y, () => this.drawCloud(ctx, cloud, now));
    for (const bomb of state.bombs || []) onFloor(bomb.x, bomb.y, () => this.drawBombRadius(ctx, bomb, now));
    for (const player of players) if (player.guarding && player.guardRaise >= GUARD.expandTicks) onFloor(player.x, player.y, () => this.drawDome(ctx, player, now));
    for (const player of players) if (!lift(player.x, player.y)) upright(player.y, 0, () => this.drawFootprint(ctx, player, player.id === localId))();
    // Standing layer, back to front: wall rows, knights, beacons, bombs, hearts and shots.
    const items = [];
    for (const wall of this.wallRows || []) items.push({ key: (wall.row + 1) * TILE, draw: () => ctx.drawImage(wall.canvas, 0, wall.row * TK - WALL_HEIGHT - FLOOR_RISE, map.width, TK + WALL_HEIGHT + FLOOR_RISE) });
    for (const floor of this.floorRows || []) items.push({ key: floor.row * TILE, draw: () => ctx.drawImage(floor.canvas, 0, floor.row * TK - FLOOR_RISE, map.width, TK + FLOOR_RISE) });
    const sortKey = (y, amount) => y + amount / FLOOR_RISE * RAISED_SORT;
    for (const point of state.points) items.push({ key: point.y, draw: upright(point.y, 0, () => this.drawBeacon(ctx, point, now)) });
    for (const bomb of state.bombs || []) { const amount = lift(bomb.x, bomb.y); items.push({ key: sortKey(bomb.y, amount), draw: upright(bomb.y, amount, () => this.drawBomb(ctx, bomb, state, now)) }); }
    for (const pickup of state.pickups || []) { const amount = lift(pickup.x, pickup.y); items.push({ key: sortKey(pickup.y, amount), draw: upright(pickup.y, amount, () => this.drawHeart(ctx, pickup, now)) }); }
    for (const player of players) {
      const amount = lift(player.x, player.y);
      items.push({ key: sortKey(player.y + FEET, amount), draw: upright(player.y, amount, () => { if (amount) this.drawFootprint(ctx, player, player.id === localId); this.drawKnight(ctx, player, state, now, { mine: player.id === localId, alpha: player.cloakTicks > 0 ? .4 : 1 }); }) });
    }
    for (const shot of state.projectiles || []) { const amount = (shot.z || 0) * FLOOR_RISE; items.push({ key: sortKey(shot.y + FEET, amount), draw: upright(shot.y, amount, () => this.drawProjectile(ctx, shot)) }); }
    // Clouds, bomb rings and domes on the raised floor go over it, after everything standing.
    items.push({ key: Infinity, draw: () => raisedFloor.forEach(draw => draw()) });
    items.sort((a, b) => a.key - b.key);
    this.players = state.players;
    for (const item of items) item.draw();
    this.drawEffects(ctx, now, lift);
    // Labels stay readable even when a knight is behind a wall.
    for (const player of players) upright(player.y, lift(player.x, player.y), () => {
      if (player.guarding) this.drawGuard(ctx, player, now);
      this.drawKnightOverlay(ctx, player, now, player.id === localId);
      if (state.phase === 'fight' && player.hp < player.maxHp && inBase(state, player)) this.drawRegen(ctx, player, now);
    })();
  }

  drawPoint(ctx, point, now) {
    const radius = RULES.pointRadius, owner = point.owner, progress = point.progress / 100;
    if (!this.drawSprite(ctx, 'point_base', point.x, point.y, { scale: radius * 2.2 / 160 })) {
      ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.beginPath(); ctx.arc(point.x, point.y, radius, 0, Math.PI * 2); ctx.fill();
    }
    ctx.lineWidth = 4; ctx.strokeStyle = owner === null ? 'rgba(220,225,235,.45)' : TEAM_COLORS[owner].main;
    ctx.setLineDash(owner === null ? [10, 8] : []); ctx.beginPath(); ctx.arc(point.x, point.y, radius, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    if (Math.abs(progress) > .001) {
      const team = progress > 0 ? 0 : 1;
      ctx.strokeStyle = TEAM_COLORS[team].light; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.arc(point.x, point.y, radius - 8, -Math.PI / 2, -Math.PI / 2 + Math.abs(progress) * Math.PI * 2); ctx.stroke();
    }
  }
  drawBeacon(ctx, point, now) {
    const glow = point.owner === null ? '#cfd6e2' : TEAM_COLORS[point.owner].light;
    if (!this.drawSprite(ctx, 'point_beacon', point.x, point.y + 6)) {
      ctx.fillStyle = '#20232a'; ctx.fillRect(point.x - 9, point.y - 52, 18, 58);
      ctx.fillStyle = '#353942'; ctx.fillRect(point.x - 9, point.y - 52, 18, 8);
    }
    ctx.fillStyle = glow; ctx.globalAlpha = .6 + .4 * Math.sin(now / 300); ctx.beginPath(); ctx.arc(point.x, point.y - 60, 7, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    ctx.font = 'bold 22px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillText(point.id, point.x + 1, point.y - 83);
    ctx.fillStyle = glow; ctx.fillText(point.id, point.x, point.y - 84);
  }

  drawCloud(ctx, cloud, now) {
    const fade = Math.min(1, cloud.ticks / 60, (cloud.total - cloud.ticks) / 20 + .2), colour = STATUS_COLORS[cloud.status] || '#ffffff';
    if (this.drawSprite(ctx, `fx_cloud_${cloud.status}`, cloud.x, cloud.y, { scale: cloud.radius * 2 / 192, alpha: .7 * fade })) return;
    ctx.save(); ctx.globalAlpha = .28 * fade; ctx.fillStyle = colour;
    for (let i = 0; i < 7; i++) {
      const a = now / 1400 + i * .9 + cloud.id, r = cloud.radius * (.35 + .4 * ((i * 37) % 10) / 10);
      ctx.beginPath(); ctx.ellipse(cloud.x + Math.cos(a) * r * .6, cloud.y + Math.sin(a) * r * .35, cloud.radius * .45, cloud.radius * .28, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = .55 * fade; ctx.strokeStyle = colour; ctx.lineWidth = 2; ctx.setLineDash([8, 8]);
    ctx.beginPath(); ctx.ellipse(cloud.x, cloud.y, cloud.radius, cloud.radius * .62, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
  }
  drawBombRadius(ctx, bomb, now) {
    const weapon = WEAPONS[bomb.weapon];
    if (bomb.phase === 'pull') {
      const radius = weapon.pull.radius;
      if (!this.drawSprite(ctx, 'fx_vortex', bomb.x, bomb.y, { frame: now / 70, scale: radius * 2 / 128, alpha: .75 })) {
        ctx.strokeStyle = 'rgba(170,140,255,.6)'; ctx.lineWidth = 3;
        for (let i = 0; i < 3; i++) { const k = 1 - ((now / 600 + i / 3) % 1); ctx.beginPath(); ctx.arc(bomb.x, bomb.y, radius * k, 0, Math.PI * 2); ctx.stroke(); }
      }
      return;
    }
    if (weapon.pull) this.drawSprite(ctx, 'fx_vortex', bomb.x, bomb.y, { frame: now / 80, scale: weapon.radius * 2 / 128, alpha: .6 }) || (ctx.strokeStyle = 'rgba(170,140,255,.35)', ctx.lineWidth = 2, ctx.beginPath(), ctx.arc(bomb.x, bomb.y, weapon.radius * (.6 + .4 * ((now / 400) % 1)), 0, Math.PI * 2), ctx.stroke());
    ctx.strokeStyle = TEAM_COLORS[bomb.team].main + '88'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.arc(bomb.x, bomb.y, weapon.radius, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  }
  drawBomb(ctx, bomb, state, now) {
    const weapon = WEAPONS[bomb.weapon], left = bomb.fuse / bomb.total;
    if (!this.drawSprite(ctx, `bomb_${bomb.weapon}`, bomb.x, bomb.y)) {
      ctx.fillStyle = '#2a2d33'; ctx.beginPath(); ctx.arc(bomb.x, bomb.y, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = weapon.pull ? '#a88cff' : weapon.shards ? '#9fd8ff' : '#ff9a4a'; ctx.beginPath(); ctx.arc(bomb.x, bomb.y, 5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = left < .3 ? '#ff5a4a' : '#ffd36b'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(bomb.x, bomb.y - 20, 7, -Math.PI / 2, -Math.PI / 2 + left * Math.PI * 2); ctx.stroke();
  }

  drawHeart(ctx, heart, now) {
    // Hearts bob, and blink through their last three seconds.
    const y = heart.y - 14 + Math.sin(now / 220 + heart.id) * 3;
    if (heart.ttl < 3 * 120 && Math.floor(now / 150) % 2) return;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(heart.x, heart.y + 2, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
    if (this.drawSprite(ctx, 'pickup_heart', heart.x, y)) return;
    ctx.save(); ctx.translate(heart.x, y); ctx.scale(1.1, 1.1);
    ctx.fillStyle = '#ff4d6d'; ctx.strokeStyle = '#5c0f1f'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 8); ctx.bezierCurveTo(-12, -1, -9, -11, 0, -5); ctx.bezierCurveTo(9, -11, 12, -1, 0, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.arc(-4, -4, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  drawRegen(ctx, player, now) {
    // Small green pluses drift up while a knight heals in base.
    for (let i = 0; i < 3; i++) {
      const phase = ((now / 900) + i / 3) % 1, x = player.x + Math.sin(i * 2.3 + player.id) * 14, y = player.y - 24 - phase * 30;
      if (this.drawSprite(ctx, 'fx_regen', x, y, { alpha: 1 - phase })) continue;
      ctx.globalAlpha = 1 - phase; ctx.fillStyle = '#7cf0a0'; ctx.fillRect(x - 1.5, y - 5, 3, 10); ctx.fillRect(x - 5, y - 1.5, 10, 3); ctx.globalAlpha = 1;
    }
  }

  /** A Guardian's grown shield: a dome on the floor that covers and heals teammates inside. */
  drawDome(ctx, player, now) {
    const radius = GUARD.radius, team = TEAM_COLORS[player.team], health = Math.max(0, player.guardHp / GUARD.max);
    if (!this.drawSprite(ctx, 'fx_bubble', player.x, player.y, { scale: radius * 2 / 192, alpha: .55 })) {
      const gradient = ctx.createRadialGradient(player.x, player.y, radius * .4, player.x, player.y, radius);
      gradient.addColorStop(0, team.main + '10'); gradient.addColorStop(1, team.light + '55');
      ctx.fillStyle = gradient; ctx.beginPath(); ctx.ellipse(player.x, player.y, radius, radius * .7, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = team.light; ctx.globalAlpha = .35 + .5 * health; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(player.x, player.y, radius + Math.sin(now / 120) * 1.5, (radius + Math.sin(now / 120) * 1.5) * .7, 0, 0, Math.PI * 2); ctx.stroke();
    // Healing pluses rise inside the dome.
    ctx.fillStyle = '#7cf0a0';
    for (let i = 0; i < 5; i++) { const p = (now / 1100 + i / 5) % 1, a = i * 1.3 + player.id; ctx.globalAlpha = (1 - p) * .8; const hx = player.x + Math.cos(a) * radius * .6, hy = player.y + Math.sin(a) * radius * .4 - p * 24; ctx.fillRect(hx - 1.5, hy - 5, 3, 10); ctx.fillRect(hx - 5, hy - 1.5, 10, 3); }
    ctx.globalAlpha = 1;
  }

  /** Floor marks under a knight: shadow, team ring, spawn shield and charge ring. */
  drawFootprint(ctx, player, mine) {
    const team = TEAM_COLORS[player.team], fx = player.x, fy = player.y + FEET, weapon = WEAPONS[player.weapons[player.slot]];
    ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.beginPath(); ctx.ellipse(fx, fy, 16, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = mine ? '#ffffff' : team.main; ctx.lineWidth = mine ? 3 : 2; ctx.beginPath(); ctx.ellipse(fx, fy, 21, 10, 0, 0, Math.PI * 2); ctx.stroke();
    if (player.shieldTicks > 0) { ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(fx, fy, 26, 13, 0, 0, Math.PI * 2); ctx.stroke(); }
    if (player.charging && weapon) {
      const full = Math.min(1, player.chargeTicks / chargeTicksFor(player, weapon));
      ctx.strokeStyle = full >= 1 ? '#ffffff' : '#ffd36b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(fx, fy, 26, 13, 0, -Math.PI / 2, -Math.PI / 2 + full * Math.PI * 2); ctx.stroke();
    }
  }
  drawKnight(ctx, player, state, now, { mine = false, alpha = 1 } = {}) {
    const team = TEAM_COLORS[player.team], weapon = WEAPONS[player.weapons[player.slot]], moving = Math.hypot(player.vx, player.vy) > 20;
    // Committed attacks face their locked direction, so the body matches the hitbox.
    const facingAim = player.action !== 'idle' && player.action !== 'cast' ? player.swingAim : player.aim;
    const { row, flip } = knightFacing(facingAim), facing = KNIGHT_FACINGS[row], fx = player.x;
    // The heavy slam leaps: the body rises and falls over the jump.
    const leap = player.action === 'slam' && player.actionTotal - player.actionTicks < player.chargeMoveTicks ? Math.sin((player.actionTotal - player.actionTicks) / player.chargeMoveTicks * Math.PI) * 26 : 0;
    const fy = player.y + FEET - leap;
    if (player.dodgeTicks > 0 || player.evadeTicks > 0) {
      // A dodging Striker leaves a streak of afterimages and flickers while untouchable.
      ctx.save(); ctx.fillStyle = team.light;
      for (let i = 1; i <= 4; i++) { ctx.globalAlpha = .22 / i; ctx.beginPath(); ctx.ellipse(fx - player.dodgeX * 16 * i, fy - 22 - player.dodgeY * 16 * i, 12, 20, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
      if (player.evadeTicks > 0) alpha *= .55 + .3 * Math.sin(now / 30);
    }
    if (player.action === 'lunge' || player.action === 'lungeBurst') {
      // Afterimages along a lunge.
      ctx.save(); ctx.fillStyle = team.light;
      for (let i = 1; i <= 3; i++) { ctx.globalAlpha = .18 / i; ctx.beginPath(); ctx.ellipse(fx - Math.cos(player.swingAim) * 14 * i, fy - 22 - Math.sin(player.swingAim) * 14 * i, 12, 20, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    const frame = moving ? 2 + Math.floor(now / 110) % 4 : Math.floor(now / 500) % 2;
    const map = MAPS[state.mapId];
    if (map && isPit(map, Math.floor(player.x / TILE), Math.floor(player.y / TILE))) {
      // Crossing a pit: ripples on water and bog, a glowing hover pad over lava or open sky.
      ctx.save(); ctx.globalAlpha = alpha * .8;
      if (map.pit === 'water' || map.pit === 'bog') { ctx.strokeStyle = map.pit === 'water' ? '#d9f3ff' : '#b7d68a'; ctx.lineWidth = 2; for (let i = 0; i < 2; i++) { const k = (now / 700 + i / 2) % 1; ctx.globalAlpha = alpha * (1 - k) * .8; ctx.beginPath(); ctx.ellipse(fx, fy, 10 + k * 18, 4 + k * 6, 0, 0, Math.PI * 2); ctx.stroke(); } }
      else { ctx.fillStyle = map.pit === 'lava' ? '#ffb35a' : '#9fe8ff'; ctx.globalAlpha = alpha * (.35 + .15 * Math.sin(now / 90)); ctx.beginPath(); ctx.ellipse(fx, fy + 2, 16, 6, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    ctx.save(); ctx.globalAlpha = alpha;
    if (player.dashTicks > 0) this.drawSprite(ctx, 'fx_dash', fx, fy - 20, { rotation: Math.atan2(player.vy, player.vx) + Math.PI }) || (ctx.fillStyle = team.light + '55', ctx.beginPath(), ctx.ellipse(fx - player.vx * .06, fy - 20 - player.vy * .06, 12, 18, 0, 0, Math.PI * 2), ctx.fill());
    // The weapon is pinned to this facing's hand and rotated to the aim; facing away it goes behind the body.
    const swingOffset = player.action === 'swing' ? Math.sin((1 - player.actionTicks / Math.max(1, player.actionTotal)) * Math.PI) * (player.comboStep % 2 ? -1 : 1) * .9 : player.action === 'charge' ? (now / 40) % (Math.PI * 2) : 0;
    const hand = { x: fx + (facing.hand[0] - 32) * (flip ? -1 : 1), y: fy + facing.hand[1] - 58 };
    // Empty hands hold nothing; a heart slot shows a heart in the hand.
    const drawWeapon = () => {
      if (weapon) return this.drawHeldWeapon(ctx, weapon, hand.x, hand.y, this.weaponAngle(player, weapon, now));
      if (player.hearts?.[player.slot] > 0 && !this.drawSprite(ctx, 'pickup_heart', hand.x, hand.y - 4, { scale: .5 })) { ctx.fillStyle = '#ff4d6d'; ctx.font = 'bold 14px system-ui'; ctx.textAlign = 'center'; ctx.fillText('♥', hand.x, hand.y); }
    };
    if (facing.weaponBehind) drawWeapon();
    const key = `character_base_team${player.team}`, layer = armorKey(player), flash = this.flashes.has(player.id);
    const pose = { row, frame, flipX: flip };
    if (!this.drawSprite(ctx, key, fx, fy, pose)) this.placeholderCharacter(ctx, { ...player, armor: 'none', y: player.y - leap }, team, { row, flip, frame, moving, now });
    if (layer) this.drawSprite(ctx, layer, fx, fy, pose);
    const layers = [key, layer];
    // Shoes, pants and helmet cover the body and armor with the exact same pose.
    for (const slot of ['shoes', 'pants', 'helmet']) {
      const id = player[slot];
      if (!id || id === 'none') continue;
      const gearKey = `gear_${slot}_${id}`;
      if (!this.drawSprite(ctx, gearKey, fx, fy, pose)) this.placeholderGear(ctx, slot, id, fx, fy, { row, flip, frame, moving, now, team });
      layers.push(gearKey);
    }
    if (flash) for (const name of layers) if (name) this.drawFlash(ctx, name, fx, fy, pose);
    if (!facing.weaponBehind) drawWeapon();
    if (player.status?.freeze > 0) {
      ctx.globalAlpha = .55; ctx.fillStyle = STATUS_COLORS.freeze; ctx.fillRect(fx - 18, fy - 54, 36, 54);
      ctx.globalAlpha = .9; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.strokeRect(fx - 18, fy - 54, 36, 54);
    }
    if (player.status?.burn > 0) for (let i = 0; i < 3; i++) { const p = (now / 400 + i / 3) % 1; ctx.globalAlpha = 1 - p; ctx.fillStyle = i % 2 ? '#ffd36b' : STATUS_COLORS.burn; ctx.beginPath(); ctx.arc(fx - 8 + i * 8, fy - 20 - p * 30, 4 * (1 - p) + 1, 0, Math.PI * 2); ctx.fill(); }
    if (player.status?.shock > 0 && Math.floor(now / 70) % 3 === 0) { ctx.globalAlpha = .9; ctx.strokeStyle = STATUS_COLORS.shock; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(fx - 14, fy - 40); ctx.lineTo(fx - 4, fy - 30); ctx.lineTo(fx - 9, fy - 26); ctx.lineTo(fx + 6, fy - 12); ctx.stroke(); }
    if (player.status?.chill > 0) {
      // Frost creeps up the legs, one band per chill stack.
      ctx.globalAlpha = .45; ctx.fillStyle = STATUS_COLORS.chill;
      for (let i = 0; i < Math.max(1, player.chillStacks || 0); i++) ctx.fillRect(fx - 14, fy - 8 - i * 9, 28, 6);
      ctx.globalAlpha = .9; ctx.fillStyle = '#ffffff'; for (let i = 0; i < 3; i++) { const a = now / 500 + i * 2.1; ctx.fillRect(fx + Math.cos(a) * 16 - 1, fy - 20 + Math.sin(a) * 6 - 1, 2, 2); }
    }
    if (player.status?.curse > 0) {
      ctx.globalAlpha = .55 + .25 * Math.sin(now / 120); ctx.strokeStyle = STATUS_COLORS.curse; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(fx, fy - 2, 18, 6, 0, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 4; i++) { const a = -now / 400 + i * Math.PI / 2; ctx.fillStyle = STATUS_COLORS.curse; ctx.fillRect(fx + Math.cos(a) * 18 - 2, fy - 2 + Math.sin(a) * 6 - 6, 4, 6); }
    }
    if (player.status?.poison > 0) { ctx.globalAlpha = .7; ctx.fillStyle = STATUS_COLORS.poison; for (let i = 0; i < 2; i++) { const p = (now / 700 + i / 2) % 1; ctx.beginPath(); ctx.arc(fx + (i ? 9 : -9), fy - 26 - p * 22, 3, 0, Math.PI * 2); ctx.fill(); } }
    if (player.catalysts > 0) for (let i = 0; i < player.catalysts; i++) { const a = now / 260 + i * Math.PI * 2 / 3; ctx.globalAlpha = 1; ctx.fillStyle = SHOT_COLORS.catalyst; ctx.beginPath(); ctx.arc(fx + Math.cos(a) * 18, fy - 26 + Math.sin(a) * 8, 4, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
  /** Weapon angle: aim when idle; blades follow the swept arc exactly as the engine tests it. */
  weaponAngle(player, weapon, now) {
    if (weapon.family !== 'blade') return player.aim;
    const elapsed = player.actionTotal - player.actionTicks;
    if (player.action === 'swing') {
      const move = weapon.combo[player.comboStep], start = player.swingAim - player.swingDir * move.arc / 2, startup = player.swingStartup || move.startup, active = player.swingActive || move.active;
      if (elapsed < startup) return start - player.swingDir * .35 * (elapsed / startup);
      return start + player.swingDir * move.arc * Math.min(1, (elapsed - startup + 1) / active);
    }
    if (player.action === 'spin') return player.swingAim + (elapsed % weapon.charge.ticksPerTurn) / weapon.charge.ticksPerTurn * Math.PI * 2;
    if (player.action !== 'idle') return player.swingAim;
    if (player.charging) return player.aim - .9 + Math.sin(now / 90) * .05; // drawn back, ready to strike
    return player.aim;
  }
  /** A white flash over the knight on the frame it is hit. */
  drawFlash(ctx, key, x, y, options) {
    const entry = this.assets?.entry(key), image = this.sprite(key);
    if (!entry || !image) { ctx.globalAlpha = .7; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(x, y - 26, 15, 26, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; return; }
    const tint = this.tint ||= Object.assign(document.createElement('canvas'), { width: 64, height: 64 }), tctx = tint.getContext('2d');
    tctx.clearRect(0, 0, 64, 64); tctx.globalCompositeOperation = 'source-over'; tctx.imageSmoothingEnabled = true;
    const fw = entry.size[0] / entry.frames, fh = entry.size[1] / (entry.rows || 1);
    tctx.drawImage(image, (Math.floor(options.frame) % entry.frames) * fw, options.row * fh, fw, fh, 0, 0, 64, 64);
    tctx.globalCompositeOperation = 'source-atop'; tctx.fillStyle = 'rgba(255,255,255,.85)'; tctx.fillRect(0, 0, 64, 64);
    ctx.save(); ctx.translate(x, y); if (options.flipX) ctx.scale(-1, 1); ctx.drawImage(tint, -entry.anchor[0], -entry.anchor[1]); ctx.restore();
  }
  /** The shield: a team-tinted dome while raised, with its health along the rim; cracks as it weakens. */
  drawGuard(ctx, player, now) {
    const team = TEAM_COLORS[player.team], health = Math.max(0, player.guardHp / GUARD.max);
    const raise = Math.min(1, (player.guardRaise || 0) / GUARD.raiseTicks), cx = player.x, cy = player.y + FEET - 24;
    if (this.drawSprite(ctx, 'fx_guard', cx, cy, { scale: .6 + .4 * raise, alpha: .85 })) { /* sprite drawn */ }
    else {
      ctx.save(); ctx.globalAlpha = .22 + .18 * raise; ctx.fillStyle = team.light;
      ctx.beginPath(); ctx.ellipse(cx, cy, 26 * (.6 + .4 * raise), 32 * (.6 + .4 * raise), 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = .8; ctx.strokeStyle = health < .3 ? '#ff6b5a' : team.light; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(cx, cy, 26, 32, 0, -Math.PI / 2, -Math.PI / 2 + health * Math.PI * 2); ctx.stroke(); ctx.restore();
    }
  }
  drawHeldWeapon(ctx, weapon, x, y, angle) {
    // Pointing left, the sprite is mirrored vertically so it is never upside down.
    const flipY = Math.cos(angle) < 0;
    if (!this.drawSprite(ctx, `weapon_${weapon.id}`, x, y, { rotation: angle, scale: WEAPON_SCALE, flipY })) this.placeholderWeapon(ctx, weapon, x, y, angle);
  }
  /** Name, health bar, mark and stun stars above the head. */
  drawKnightOverlay(ctx, player, now, mine) {
    const team = TEAM_COLORS[player.team], top = player.y + FEET - 58;
    if (player.markTicks > 0 && !this.drawSprite(ctx, 'fx_mark', player.x, top - 18)) { ctx.fillStyle = '#ff4d6d'; ctx.font = 'bold 16px system-ui'; ctx.textAlign = 'center'; ctx.fillText('◎', player.x, top - 18); }
    if (player.stunTicks > 0) { ctx.fillStyle = '#ffe680'; for (let i = 0; i < 3; i++) { const a = now / 150 + i * 2.1; ctx.beginPath(); ctx.arc(player.x + Math.cos(a) * 14, top + 4 + Math.sin(a) * 4, 2.5, 0, Math.PI * 2); ctx.fill(); } }
    const statuses = STATUS_IDS.filter(id => player.status?.[id] > 0);
    if (player.status?.chill > 0) for (let i = 0; i < 3; i++) { ctx.fillStyle = i < (player.chillStacks || 0) ? STATUS_COLORS.chill : 'rgba(255,255,255,.25)'; ctx.fillRect(player.x - 10 + i * 7, top - 12, 5, 3); }
    statuses.forEach((id, i) => {
      const x = player.x - (statuses.length - 1) * 6 + i * 12, y = top - 28;
      if (!this.drawSprite(ctx, `fx_status_${id}`, x, y)) { ctx.fillStyle = STATUS_COLORS[id]; ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 1; ctx.stroke(); }
    });
    const w = 38, pct = Math.max(0, player.hp / player.maxHp);
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(player.x - w / 2, top - 4, w, 5);
    ctx.fillStyle = pct > .5 ? team.light : pct > .25 ? '#ffd36b' : '#ff6b5a'; ctx.fillRect(player.x - w / 2, top - 4, w * pct, 5);
    ctx.font = '11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = mine ? '#ffffff' : team.light;
    ctx.fillText(player.name, player.x, top - 8);
  }
  /** Loading fallback follows equipment too, so an unarmored player never gets a helmet. */
  placeholderCharacter(ctx, player, team, options) {
    const { row, flip, frame, moving, now } = options, step = moving ? (frame % 2 ? 2 : -2) : 0;
    const bob = moving ? 0 : Math.sin(now / 300) * .8, hand = KNIGHT_FACINGS[row].hand;
    ctx.save(); ctx.translate(player.x, player.y + FEET); if (flip) ctx.scale(-1, 1);
    const capsule = (x, y, w, h, colour, radius = 3) => { ctx.fillStyle = colour; ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fill(); };
    capsule(-8, -12 + step, 6, 10 - step, '#d8a47d'); capsule(2, -12 - step, 6, 10 + step, '#d8a47d');
    capsule(-9, -4, 8, 4, '#3d4852', 2); capsule(1, -4, 8, 4, '#3d4852', 2);
    capsule(-10, -17, 20, 8, '#29333c'); capsule(-11, -32 + bob, 22, 17, '#e4eaed', 6);
    capsule(-6, -32 + bob, 12, 2, team.main, 1);
    ctx.fillStyle = '#d8a47d'; ctx.beginPath(); ctx.arc(0, -42 + bob, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#493429'; ctx.beginPath(); ctx.ellipse(0, -47 + bob, 11, row >= 3 ? 11 : 6, 0, 0, Math.PI * 2); ctx.fill();
    if (row < 3) { ctx.fillStyle = '#20272e'; const eyes = row === 0 ? [-5, 3] : row === 1 ? [0, 6] : [6]; for (const eye of eyes) ctx.fillRect(eye, -42 + bob, 2, 3); }
    ctx.fillStyle = '#d8a47d'; ctx.beginPath(); ctx.arc(hand[0] - 32, hand[1] - 58, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  /** Simple stand-ins for helmets, pants and shoes until their overlay sheets exist. Same feet point and
   * proportions as placeholderCharacter: feet at 0, legs up to -12, hips -17, head centred at -42. */
  placeholderGear(ctx, slot, id, fx, fy, { row, flip, frame, moving, now, team }) {
    const step = moving ? (frame % 2 ? 2 : -2) : 0, bob = moving ? 0 : Math.sin(now / 300) * .8, back = row >= 3;
    const rect = (color, x, y, w, h) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
    const legs = (color, top = -12, extra = 0) => { rect(color, -8 - extra, top + step, 6 + extra, -top - 2 - step); rect(color, 2, top - step, 6 + extra, -top - 2 + step); };
    ctx.save(); ctx.translate(fx, fy); if (flip) ctx.scale(-1, 1);
    if (slot === 'shoes') {
      const look = { sneakers: ['#f4f6f8', team.main], sabatons: ['#8e98a3', '#5d666f'], dashboots: ['#3f7fd0', '#e8eef5'], spurs: ['#6a4428', '#e0b84a'], treads: ['#1d2024', '#4a4f57'], clogs: ['#c99a55', '#6b6f75'], sandals: ['#8a5a32', '#d8a47d'] }[id] || ['#444', '#888'];
      const big = id === 'sabatons' || id === 'treads' ? 2 : 0;
      rect(look[0], -9 - big, -4 - big, 8 + big, 4 + big); rect(look[0], 1, -4 - big, 8 + big, 4 + big);
      if (id === 'clogs') { rect(look[1], -7, 0, 4, 2); rect(look[1], 3, 0, 4, 2); }
      else if (id === 'dashboots') { rect(look[1], -12, -6, 3, 2); rect(look[1], 9, -6, 3, 2); }
      else if (id === 'spurs') { rect(look[1], -11, -3, 2, 2); rect(look[1], 9, -3, 2, 2); }
      else if (id === 'sandals') { rect(look[1], -8, -3, 6, 1); rect(look[1], 2, -3, 6, 1); }
      else rect(look[1], -9 - big, -1, 8 + big, 1), rect(look[1], 1, -1, 8 + big, 1);
    } else if (slot === 'pants') {
      const color = { greaves: '#9aa4ae', leggings: '#273455', chausses: '#7d848c', breeches: '#e9e1cc', sapper: '#59603a', cargo: '#a99766', kilt: '#9b2b2b' }[id] || '#555';
      if (id === 'kilt') {
        rect(color, -11, -18, 22, 10); rect('#2f6b3a', -11, -15, 22, 2); rect('#2f6b3a', -4, -18, 2, 10); rect('#2f6b3a', 4, -18, 2, 10);
        if (!back) rect('#7a5232', -3, -14, 6, 5);
      } else {
        rect(color, -10, -18, 20, 8); legs(color, -12);
        if (id === 'greaves') { rect('#d5dbe1', -8, -9 + step, 6, 3); rect('#d5dbe1', 2, -9 - step, 6, 3); }
        if (id === 'leggings') { rect('#cfd8ea', -8, -12 + step, 1, 10 - step); rect('#cfd8ea', 7, -12 - step, 1, 10 + step); }
        if (id === 'chausses') { ctx.fillStyle = '#b6bcc3'; for (let y = -16; y < -2; y += 3) for (let x = -9; x < 9; x += 3) ctx.fillRect(x, y, 1, 1); }
        if (id === 'breeches') { rect('#ffffff', -8, -6 + step, 6, 4); rect('#ffffff', 2, -6 - step, 6, 4); }
        if (id === 'sapper') { rect('#3d4227', -8, -8 + step, 6, 3); rect('#c46a2a', 5, -16, 4, 5); }
        if (id === 'cargo') { rect('#857548', -11, -13 + step, 3, 5); rect('#857548', 8, -13 - step, 3, 5); }
      }
    } else {
      const hy = -42 + bob;
      if (id === 'sallet') { ctx.fillStyle = '#a9b2bb'; ctx.beginPath(); ctx.arc(0, hy, 12, Math.PI, 0); ctx.fill(); rect('#a9b2bb', -12, hy, 24, back ? 10 : 5); rect('#8a939c', -14, hy + 4, 6, 4); if (!back) rect('#1b2026', -8, hy + 1, 16, 2); }
      else if (id === 'visor') { if (!back) { rect('#1c2830', -10, hy - 3, 20, 6); rect('#59e2ff', -8, hy - 2, 14, 3); } else rect('#1c2830', -10, hy - 3, 20, 3); rect('#3b4650', 9, hy - 2, 3, 5); }
      else if (id === 'horned') { ctx.fillStyle = '#6f757c'; ctx.beginPath(); ctx.arc(0, hy - 2, 11, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#efe4c8'; for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(9 * d, hy - 6); ctx.quadraticCurveTo(20 * d, hy - 8, 17 * d, hy - 20); ctx.lineTo(11 * d, hy - 9); ctx.fill(); } }
      else if (id === 'hood') { ctx.fillStyle = '#3b3348'; ctx.beginPath(); ctx.arc(0, hy, 13, Math.PI * .85, Math.PI * 2.15); ctx.fill(); rect('#3b3348', -13, hy, 26, 10); if (!back) { rect('#1a1622', -8, hy - 4, 16, 10); rect('#c9a7ff', -5, hy, 2, 2); rect('#c9a7ff', 3, hy, 2, 2); } }
      else if (id === 'lampcap') { ctx.fillStyle = '#5a4630'; ctx.beginPath(); ctx.arc(0, hy - 2, 11, Math.PI, 0); ctx.fill(); rect('#5a4630', -13, hy - 3, 26, 3); if (!back) { rect('#c9a347', -3, hy - 10, 6, 6); ctx.globalAlpha *= .5; ctx.fillStyle = '#ffe58a'; ctx.beginPath(); ctx.arc(0, hy - 7, 7, 0, Math.PI * 2); ctx.fill(); } }
      else if (id === 'feather') { ctx.fillStyle = '#3f7a3a'; ctx.beginPath(); ctx.arc(0, hy - 3, 11, Math.PI, 0); ctx.fill(); rect('#2f5e2c', -12, hy - 4, 24, 3); ctx.strokeStyle = '#e04040'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(4, hy - 8); ctx.quadraticCurveTo(-6, hy - 22, -18, hy - 16); ctx.stroke(); }
      else if (id === 'bucket') { rect('#7b8590', -12, hy - 13, 24, 22); rect('#98a2ad', -13, hy - 13, 26, 3); rect('#5f6871', -12, hy + 6, 24, 2); if (!back) { rect('#15181c', -7, hy - 2, 4, 3); rect('#15181c', 3, hy - 2, 4, 3); } }
      else if (id === 'circlet') { rect('#e6c45a', -11, hy - 6, 22, 2); if (!back) rect('#3fd07a', -2, hy - 7, 4, 4); }
      else if (id === 'goggles') { rect('#6a4428', -11, hy - 7, 22, 3); for (const x of [-5, 5]) { ctx.fillStyle = '#c99a55'; ctx.beginPath(); ctx.arc(x, hy - 7, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = back ? '#c99a55' : '#8fd8ff'; ctx.beginPath(); ctx.arc(x, hy - 7, 3, 0, Math.PI * 2); ctx.fill(); } }
    }
    ctx.restore();
  }
  /** A small chibi knight until the armor artwork loads. */
  placeholderKnight(ctx, player, team, { row, flip, frame, moving, now }) {
    const fx = player.x, fy = player.y + FEET, dir = flip ? -1 : 1, step = moving ? (frame % 2 ? 2 : -2) : 0, bob = moving ? 0 : Math.sin(now / 300) * .8;
    ctx.save();
    ctx.fillStyle = '#23262c'; ctx.fillRect(fx - 8, fy - 9 + step, 6, 9 - step); ctx.fillRect(fx + 2, fy - 9 - step, 6, 9 + step);
    ctx.fillStyle = team.dark; ctx.fillRect(fx - 12, fy - 28 + bob, 24, 20);
    ctx.fillStyle = team.main; ctx.fillRect(fx - 10, fy - 26 + bob, 20, 15);
    if (player.cls === 'guardian') { ctx.fillStyle = team.light; ctx.fillRect(fx - 16, fy - 29 + bob, 8, 7); ctx.fillRect(fx + 8, fy - 29 + bob, 8, 7); }
    if (player.cls === 'recon') { ctx.fillStyle = '#2b2f36'; ctx.fillRect(fx - 12, fy - 26 + bob, 24, 6); }
    const hy = fy - 40 + bob;
    ctx.fillStyle = team.dark; ctx.beginPath(); ctx.arc(fx, hy, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = player.cls === 'recon' ? '#3a3f48' : '#c9ced8'; ctx.beginPath(); ctx.arc(fx, hy, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#16181c';
    if (row === 0) ctx.fillRect(fx - 7, hy - 1, 14, 4);
    else if (row === 1) ctx.fillRect(fx - 2 * dir - (dir < 0 ? 10 : 0), hy - 1, 10, 4);
    else if (row === 2) ctx.fillRect(fx + (dir > 0 ? 4 : -10), hy - 2, 6, 5);
    else if (row === 3) ctx.fillRect(fx + (dir > 0 ? 8 : -11), hy - 2, 3, 4);
    ctx.fillStyle = team.light;
    if (player.cls === 'striker') { ctx.beginPath(); ctx.moveTo(fx + 6 * dir, hy - 12); ctx.lineTo(fx - 12 * dir, hy - 6); ctx.lineTo(fx - 2 * dir, hy - 15); ctx.closePath(); ctx.fill(); }
    else if (player.cls === 'guardian') ctx.fillRect(fx - 9, hy - 13, 18, 4);
    else { ctx.beginPath(); ctx.arc(fx, hy - 2, 13, Math.PI * 1.05, Math.PI * 1.95); ctx.lineWidth = 3; ctx.strokeStyle = team.main; ctx.stroke(); }
    ctx.restore();
  }
  placeholderWeapon(ctx, weapon, x, y, angle) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    if (weapon.family === 'blade') {
      const length = weapon.id === 'cleaver' ? 34 : weapon.id === 'rapier' ? 40 : 34, width = weapon.id === 'cleaver' ? 9 : weapon.id === 'rapier' ? 2.5 : 5;
      ctx.fillStyle = '#6b4a2b'; ctx.fillRect(-4, -2, 8, 4);
      ctx.fillStyle = '#c9b27a'; ctx.fillRect(3, -6, 3, 12);
      ctx.fillStyle = '#dfe6ee'; ctx.fillRect(6, -width / 2, length, width);
      if (elementColor(weapon)) { ctx.globalAlpha *= .7; ctx.fillStyle = elementColor(weapon); ctx.fillRect(6, -width / 2 - 1.5, length, 2); ctx.fillRect(length + 2, -width / 2, 4, width); ctx.globalAlpha /= .7; }
    } else if (weapon.family === 'gun') {
      const length = weapon.id === 'magnus' ? 26 : weapon.id === 'scatter' ? 22 : 20;
      ctx.fillStyle = '#2e3138'; ctx.fillRect(0, -4, length, 8);
      ctx.fillStyle = elementColor(weapon) || (weapon.id === 'autogun' ? '#9fd8ff' : weapon.id === 'magnus' ? '#ffb36b' : '#ffe08a'); ctx.fillRect(length - 4, -3, 4, 6);
      if (elementColor(weapon)) ctx.fillRect(4, -5, 8, 2);
    } else { ctx.fillStyle = '#2a2d33'; ctx.beginPath(); ctx.arc(10, 0, 7, 0, Math.PI * 2); ctx.fill(); if (elementColor(weapon)) { ctx.fillStyle = elementColor(weapon); ctx.beginPath(); ctx.arc(10, 0, 3, 0, Math.PI * 2); ctx.fill(); } }
    ctx.restore();
  }
  /** Shots are drawn at the size of their hitbox, at chest height, with a shadow on the floor. */
  drawProjectile(ctx, shot) {
    const angle = Math.atan2(shot.vy * GROUND, shot.vx), kind = shot.kind, lift = kind === 'shard' || kind === 'thorn' ? 10 : BODY_LIFT, y = shot.y - lift, size = shot.size || 5;
    ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(shot.x, shot.y + 2, size, size * .4, 0, 0, Math.PI * 2); ctx.fill();
    const key = `proj_${kind}`, entry = this.assets?.entry(key);
    const element = elementColor(WEAPONS[shot.weapon]);
    if (element) { ctx.save(); ctx.globalAlpha = .35; ctx.fillStyle = element; ctx.beginPath(); ctx.arc(shot.x, y, size * 1.9, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    if (entry && this.drawSprite(ctx, key, shot.x, y, { rotation: angle, scale: kind === 'pulse' || kind === 'wave' ? size * 2 / entry.size[1] : 1 })) return;
    const color = element || SHOT_COLORS[kind] || TEAM_COLORS[shot.team].light;
    ctx.save(); ctx.translate(shot.x, y); ctx.rotate(angle);
    if (kind === 'wave') {
      ctx.globalAlpha = .75; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(-size * .4, 0, size, -1.1, 1.1); ctx.arc(-size * .9, 0, size * .8, 1.1, -1.1, true); ctx.fill();
      ctx.globalAlpha = 1; ctx.strokeStyle = '#c9a8ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(-size * .4, 0, size, -1.1, 1.1); ctx.stroke();
    } else if (kind === 'pulse') {
      ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.globalAlpha = .85; ctx.beginPath(); ctx.arc(-size * .5, 0, size, -1, 1); ctx.stroke();
      ctx.lineWidth = 2; ctx.globalAlpha = .5; ctx.beginPath(); ctx.arc(-size * .8, 0, size * .8, -.9, .9); ctx.stroke();
    } else if (kind === 'explosive' || kind === 'catalyst' || kind === 'detonator') {
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(-size * .3, -size * .3, size * .35, 0, Math.PI * 2); ctx.fill();
    } else if (kind === 'thorn' || kind === 'shard') {
      ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(size * 1.6, 0); ctx.lineTo(-size, -size * .55); ctx.lineTo(-size, size * .55); ctx.closePath(); ctx.fill();
    } else {
      const length = kind === 'pierce' ? size * 3 : size * 2.4;
      ctx.fillStyle = kind === 'ricochet' || element ? color : TEAM_COLORS[shot.team].light; ctx.fillRect(-length, -size * .45, length, size * .9);
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, size * .55, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  drawEffects(ctx, now, lift = () => 0) {
    for (const effect of this.effects) {
      const t = (now - effect.born) / effect.life;
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - t);
      // Effects happen at the height of where they are: a slash at its knight, a blast on its floor.
      const at = effect.playerId !== undefined && this.players?.[effect.playerId] ? this.players[effect.playerId] : effect.x !== undefined ? effect : effect.fromX !== undefined ? { x: effect.fromX, y: effect.fromY } : null;
      const height = at ? lift(at.x, at.y) : 0;
      // Rings, blasts and sword arcs lie flat (foreshortened); text and sparks stand upright where they happen.
      if (FLAT_EFFECTS.has(effect.type)) { ctx.translate(0, -height + (effect.type === 'slash' || effect.type === 'spinTurn' ? FEET - BODY_LIFT : 0)); ctx.scale(1, GROUND); }
      else if (effect.type !== 'chain' && at) ctx.translate(0, at.y * (GROUND - 1) - height);
      else ctx.translate(0, -height);
      const chest = effect.y - BODY_LIFT;
      if (effect.type === 'slash' || effect.type === 'spinTurn') {
        // The trail follows the knight and covers exactly the arc and reach the engine tests.
        const owner = this.players?.[effect.playerId]; if (!owner?.alive) { ctx.restore(); continue; }
        const age = now - effect.born, ox = owner.x, oy = owner.y; // chest height is applied before the floor tilt
        let from, to, fade;
        if (effect.type === 'spinTurn') { from = owner.swingAim; to = from + Math.PI * 2 * Math.min(1, age / (18 * TICK_MS)); fade = 1; }
        else {
          if (age < effect.delay) { ctx.restore(); continue; }
          const sweep = Math.min(1, (age - effect.delay) / Math.max(1, effect.sweep)), start = effect.angle - effect.dir * effect.arc / 2;
          from = start; to = start + effect.dir * effect.arc * sweep; fade = 1 - Math.max(0, (age - effect.delay - effect.sweep) / 140);
        }
        const reach = effect.reach;
        ctx.globalAlpha = Math.max(0, fade);
        if (!this.drawSprite(ctx, 'fx_slash', ox, oy, { rotation: (from + to) / 2, frame: t * 4, scale: reach / 72, flipY: effect.dir < 0 })) {
          ctx.lineCap = 'round';
          ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 16; ctx.beginPath(); ctx.arc(ox, oy, reach - 10, Math.min(from, to), Math.max(from, to)); ctx.stroke();
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(ox, oy, reach, Math.min(from, to), Math.max(from, to)); ctx.stroke();
        }
      } else if (effect.type === 'slam') {
        if (!this.drawSprite(ctx, 'fx_slam', effect.x, effect.y, { frame: t * 5, scale: effect.radius * 2 / 128 })) { ctx.strokeStyle = '#ffcf8a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(effect.x, effect.y, effect.radius * (.3 + .7 * t), 0, Math.PI * 2); ctx.stroke(); }
      } else if (effect.type === 'block') {
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; for (let i = 0; i < 5; i++) { const a = i * 1.26; ctx.beginPath(); ctx.moveTo(effect.x + Math.cos(a) * 8, effect.y - 24 + Math.sin(a) * 8); ctx.lineTo(effect.x + Math.cos(a) * (10 + t * 16), effect.y - 24 + Math.sin(a) * (10 + t * 16)); ctx.stroke(); }
      } else if (effect.type === 'guardBreak') {
        ctx.fillStyle = '#d8f4ff'; for (let i = 0; i < 8; i++) { const a = i * .785; ctx.fillRect(effect.x + Math.cos(a) * (14 + t * 40) - 3, effect.y - 24 + Math.sin(a) * (14 + t * 40) - 3, 6, 6); }
        ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff'; ctx.fillText('GUARD BREAK', effect.x, effect.y - 70 - t * 10);
      } else if (effect.type === 'dust') {
        ctx.fillStyle = 'rgba(220,220,210,.6)'; for (let i = 0; i < 4; i++) { const a = effect.angle + Math.PI + (i - 1.5) * .45; ctx.beginPath(); ctx.arc(effect.x + Math.cos(a) * (6 + t * 22), effect.y + Math.sin(a) * (3 + t * 10), 4 * (1 - t) + 1, 0, Math.PI * 2); ctx.fill(); }
      } else if (effect.type === 'evade') {
        ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff'; ctx.fillText('DODGE', effect.x, effect.y - 66 - t * 14);
      } else if (effect.type === 'cancel') {
        const owner = this.players?.[effect.playerId];
        if (owner?.alive) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(owner.x, owner.y + FEET - 24, 18 + t * 10, 26 + t * 10, 0, 0, Math.PI * 2); ctx.stroke(); }
      } else if (effect.type === 'spark') {
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(effect.x, effect.y - BODY_LIFT, 5 * (1 - t) + 1, 0, Math.PI * 2); ctx.fill();
      } else if (effect.type === 'statusPop') {
        ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = STATUS_COLORS[effect.status]; ctx.fillText(effect.text || effect.status.toUpperCase(), effect.x, effect.y - 64 - t * 16);
      } else if (effect.type === 'vortexOpen') {
        ctx.strokeStyle = '#b49cff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(effect.x, effect.y, effect.radius * (1 - t * .5), 0, Math.PI * 2); ctx.stroke();
      } else if (effect.type === 'muzzle') {
        if (!this.drawSprite(ctx, 'fx_muzzle', effect.x + Math.cos(effect.angle) * 30, chest + Math.sin(effect.angle) * 30, { rotation: effect.angle, frame: t * 3 })) { ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.arc(effect.x + Math.cos(effect.angle) * 32, chest + Math.sin(effect.angle) * 32, 6 * (1 - t), 0, Math.PI * 2); ctx.fill(); }
      } else if (effect.type === 'explosion') {
        if (!this.drawSprite(ctx, 'fx_explosion', effect.x, effect.y, { frame: t * 6, scale: (effect.radius || 90) * 2 / 128 })) {
          ctx.fillStyle = effect.weapon === 'vortex' ? '#b49cff' : '#ffb35a'; ctx.beginPath(); ctx.arc(effect.x, effect.y, (effect.radius || 80) * (.4 + .6 * t), 0, Math.PI * 2); ctx.fill();
        }
      } else if (effect.type === 'number') {
        ctx.fillStyle = effect.color || '#ffffff'; ctx.font = 'bold 16px system-ui'; ctx.textAlign = 'center'; ctx.fillText(String(effect.amount), effect.x + 12, effect.y - 50 - t * 26);
      } else if (effect.type === 'chain') {
        // A jagged lightning arc between the two knights, at chest height.
        let seed = effect.seed * 1000; const rand = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
        const fy = effect.fromY * GROUND - BODY_LIFT, ty = effect.toY * GROUND - BODY_LIFT;
        ctx.globalAlpha = 1 - t; ctx.strokeStyle = STATUS_COLORS.shock; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(effect.fromX, fy);
        for (let i = 1; i < 6; i++) { const k = i / 6; ctx.lineTo(effect.fromX + (effect.toX - effect.fromX) * k + (rand() - .5) * 18, fy + (ty - fy) * k + (rand() - .5) * 18); }
        ctx.lineTo(effect.toX, ty); ctx.stroke(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1;
      } else if (effect.type === 'drain') {
        ctx.fillStyle = STATUS_COLORS.drain; ctx.font = 'bold 14px system-ui'; ctx.textAlign = 'center'; ctx.fillText(`+${effect.amount} ♥`, effect.x - 14, effect.y - 50 - t * 22);
      } else if (effect.type === 'healNumber') {
        ctx.fillStyle = '#7cf0a0'; ctx.font = 'bold 16px system-ui'; ctx.textAlign = 'center'; ctx.fillText(`+${effect.amount}`, effect.x, effect.y - 50 - t * 26);
      } else if (effect.type === 'heal') {
        if (!this.drawSprite(ctx, 'fx_heal', effect.x, effect.y, { scale: effect.radius * 2 / 256 * (.5 + t * .5) })) { ctx.strokeStyle = '#8dffb0'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(effect.x, effect.y, effect.radius * t, 0, Math.PI * 2); ctx.stroke(); }
      } else if (effect.type === 'capture') {
        ctx.strokeStyle = TEAM_COLORS[effect.team].light; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(effect.x, effect.y, RULES.pointRadius + t * 50, 0, Math.PI * 2); ctx.stroke();
      } else if (effect.type === 'pop' || effect.type === 'kill') {
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(effect.x, effect.y, 20 + t * 40, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    }
  }

  /** Small overview used by the HUD minimap and the respawn camera. */
  drawMinimap(target, state, { localId = null } = {}) {
    const ctx = target.getContext('2d'), map = MAPS[state.mapId]; if (!map) return;
    const scale = Math.min(target.width / map.width, target.height / map.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, target.width, target.height);
    ctx.setTransform(scale, 0, 0, scale, (target.width - map.width * scale) / 2, (target.height - map.height * scale) / 2);
    ctx.fillStyle = 'rgba(20,22,26,.85)'; ctx.fillRect(0, 0, map.width, map.height);
    if (map.twoFloors) {
      ctx.fillStyle = 'rgba(255,255,255,.12)';
      for (let row = 0; row < map.rows; row++) for (let col = 0; col < map.cols; col++) if (levelCell(map, col, row) !== '0') ctx.fillRect(col * TILE, row * TILE, TILE, TILE);
    }
    ctx.fillStyle = '#5b606b';
    for (let row = 0; row < map.rows; row++) for (let col = 0; col < map.cols; col++) if (map.grid[row][col] === '#') ctx.fillRect(col * TILE, row * TILE, TILE, TILE);
    ctx.fillStyle = (THEMES[map.theme] || THEMES.stone).pit;
    for (let row = 0; row < map.rows; row++) for (let col = 0; col < map.cols; col++) if (map.grid[row][col] === '~') ctx.fillRect(col * TILE, row * TILE, TILE, TILE);
    ctx.fillStyle = '#5b606b';
    for (const point of state.points) { ctx.fillStyle = point.owner === null ? '#cfd6e2' : TEAM_COLORS[point.owner].main; ctx.beginPath(); ctx.arc(point.x, point.y, RULES.pointRadius, 0, Math.PI * 2); ctx.fill(); }
    const viewer = localId !== null ? state.players[localId] : null;
    for (const player of state.players) {
      if (!player.alive || player.cloakTicks > 0 && viewer && player.team !== viewer.team) continue;
      ctx.fillStyle = player.id === localId ? '#ffffff' : TEAM_COLORS[player.team].light;
      ctx.beginPath(); ctx.arc(player.x, player.y, player.id === localId ? 34 : 24, 0, Math.PI * 2); ctx.fill();
    }
  }
}
export { CLASSES, WEAPONS };
