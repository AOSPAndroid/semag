/** Lockdown ¾-view canvas renderer (Spiral Knights style, with our own art).
 * The simulation is flat; this view tilts it: walls are drawn raised with a front face,
 * knights stand up and turn toward their aim in eight directions, and shots and swings
 * travel at chest height. Everything that stands up is depth-sorted, so knights pass
 * behind walls. Draws from the art manifest when a sprite exists and falls back to
 * readable placeholder shapes otherwise. Pure presentation: it never changes the state. */
import { MAPS, TILE, RULES, ABILITIES, WEAPONS, CLASSES, inBase } from './lockdown-engine.js';
import { isWall } from './lockdown-maps.js';
import { KNIGHT_FACINGS } from './lockdown-assets.js';

/** How far a wall's top face is lifted, and the height that shots and swings travel at. */
export const WALL_HEIGHT = 24, BODY_LIFT = 22;
const FEET = 8; // a knight's feet sit this far below the centre of its collision circle
const WEAPON_SCALE = .75;
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
const THEMES = Object.freeze({
  stone: { floor: '#3c4048', floorAlt: '#383b43', grout: '#30333a', wall: '#6b6f78', wallTop: '#8a8f99', wallEdge: '#24262b' },
  brass: { floor: '#433b31', floorAlt: '#3e362d', grout: '#352e26', wall: '#7d6a4c', wallTop: '#a08a62', wallEdge: '#2a231a' },
});
const VIEW_WORLD_WIDTH = 1100; // world units across the screen at the default zoom
const lerp = (a, b, t) => a + (b - a) * t;
const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

export class LockdownRenderer {
  constructor(canvas, assets) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.assets = assets;
    this.mapCache = null; this.mapKey = ''; this.effects = []; this.seenEvents = new Set(); this.eventOrder = [];
    this.camera = { x: 0, y: 0, zoom: 1 };
  }
  resize() {
    const ratio = Math.min(2, globalThis.devicePixelRatio || 1), rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width * ratio)), height = Math.max(1, Math.round(rect.height * ratio));
    if (this.canvas.width !== width || this.canvas.height !== height) { this.canvas.width = width; this.canvas.height = height; }
  }
  /** Screen → world, for mouse aiming. */
  screenToWorld(px, py) {
    const ratio = this.canvas.width / Math.max(1, this.canvas.getBoundingClientRect().width);
    const { x, y, zoom } = this.camera;
    return { x: x + (px * ratio - this.canvas.width / 2) / zoom, y: y + (py * ratio - this.canvas.height / 2) / zoom };
  }
  sprite(key) { return this.assets?.get(key) || null; }
  drawSprite(ctx, key, x, y, { rotation = 0, frame = 0, row = 0, scale = 1, flipX = false, flipY = false, alpha = 1 } = {}) {
    const image = this.sprite(key), entry = this.assets?.entry(key);
    if (!image || !entry) return false;
    const frames = entry.frames || 1, rows = entry.rows || 1, fw = entry.size[0] / frames, fh = entry.size[1] / rows;
    ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(x, y); ctx.rotate(rotation); ctx.scale(scale * (flipX ? -1 : 1), scale * (flipY ? -1 : 1));
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, (Math.floor(frame) % frames) * fw, (Math.floor(row) % rows) * fh, fw, fh, -entry.anchor[0], -entry.anchor[1], fw, fh);
    ctx.restore(); return true;
  }
  /** Aim from the knight's chest to the cursor, so shots drawn at chest height pass under the pointer. */
  get aimLift() { return BODY_LIFT; }

  // ---------- static map ----------
  buildMap(map) {
    const key = `${map.id}:${this.assets?.version || 0}`;
    if (this.mapKey === key) return this.mapCache;
    const makeCanvas = (width, height) => typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(width, height) : Object.assign(document.createElement('canvas'), { width, height });
    const canvas = makeCanvas(map.width, map.height);
    const ctx = canvas.getContext('2d'), theme = THEMES[map.theme] || THEMES.stone;
    ctx.imageSmoothingEnabled = false;
    // One strip per row of wall blocks: the raised top face, then the front face where floor lies below.
    this.wallRows = [];
    for (let row = 0; row < map.rows; row++) {
      if (!map.grid[row].includes('#')) continue;
      const strip = makeCanvas(map.width, TILE + WALL_HEIGHT), sctx = strip.getContext('2d');
      sctx.imageSmoothingEnabled = false;
      for (let col = 0; col < map.cols; col++) {
        if (map.grid[row][col] !== '#') continue;
        const x = col * TILE;
        if (row + 1 < map.rows && !isWall(map, col, row + 1) && !this.drawSprite(sctx, `tile_wall_front_${map.theme}`, x, TILE)) {
          sctx.fillStyle = theme.wall; sctx.fillRect(x, TILE, TILE, WALL_HEIGHT);
          sctx.fillStyle = theme.wallEdge; sctx.fillRect(x, TILE + WALL_HEIGHT - 4, TILE, 4);
          sctx.fillStyle = 'rgba(0,0,0,.18)'; for (let course = 1; course < 3; course++) sctx.fillRect(x, TILE + course * 8, TILE, 1);
          sctx.fillRect(x + (row % 2 ? 12 : 30), TILE, 1, 8); sctx.fillRect(x + (row % 2 ? 36 : 6), TILE + 8, 1, 8);
        }
        if (!this.drawSprite(sctx, `tile_wall_top_${map.theme}`, x, 0)) {
          sctx.fillStyle = theme.wallTop; sctx.fillRect(x, 0, TILE, TILE);
          sctx.fillStyle = 'rgba(255,255,255,.12)'; sctx.fillRect(x, 0, TILE, 3);
          sctx.fillStyle = 'rgba(0,0,0,.12)'; if (!isWall(map, col + 1, row)) sctx.fillRect(x + TILE - 3, 0, 3, TILE);
        }
      }
      this.wallRows.push({ row, canvas: strip });
    }
    for (let row = 0; row < map.rows; row++) for (let col = 0; col < map.cols; col++) {
      const x = col * TILE, y = row * TILE, cell = map.grid[row][col];
      if (cell === '#') continue;
      const spawnTeam = cell === '1' ? 0 : cell === '2' ? 1 : null;
      const alt = hash(col, row) < .18;
      if (!this.drawSprite(ctx, spawnTeam !== null ? `tile_spawn_team${spawnTeam}` : `tile_floor_${map.theme}${alt ? '_alt' : ''}`, x, y)) {
        ctx.fillStyle = alt ? theme.floorAlt : theme.floor; ctx.fillRect(x, y, TILE, TILE);
        ctx.strokeStyle = theme.grout; ctx.lineWidth = 1; ctx.strokeRect(x + .5, y + .5, TILE - 1, TILE - 1);
        if (spawnTeam !== null) { ctx.fillStyle = TEAM_COLORS[spawnTeam].main + '33'; ctx.fillRect(x, y, TILE, TILE); }
      }
      // Walls cast a soft shadow onto the floor in front of them.
      if (isWall(map, col, row - 1)) { const shade = ctx.createLinearGradient(0, y, 0, y + 14); shade.addColorStop(0, 'rgba(0,0,0,.35)'); shade.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = shade; ctx.fillRect(x, y, TILE, 14); }
    }
    this.mapCache = canvas; this.mapKey = key; return canvas;
  }

  // ---------- events → short-lived effects ----------
  consumeEvents(state, now) {
    for (const event of state.events || []) {
      if (this.seenEvents.has(event.id)) continue;
      this.seenEvents.add(event.id); this.eventOrder.push(event.id);
      if (this.eventOrder.length > 600) this.seenEvents.delete(this.eventOrder.shift());
      if (state.tick - event.tick > 30) continue;
      const add = (type, life, extra) => this.effects.push({ type, born: now, life, ...extra });
      if (event.type === 'swing') add(event.charged ? event.kind : 'slash', event.charged ? 380 : 200, { x: event.x, y: event.y, angle: event.angle, step: event.step || 0, playerId: event.playerId });
      else if (event.type === 'shot') add('muzzle', 90, { x: event.x, y: event.y, angle: event.angle });
      else if (event.type === 'explosion') add('explosion', 480, { x: event.x, y: event.y, radius: event.radius, weapon: event.weapon });
      else if (event.type === 'damage') add('number', 700, { x: event.x, y: event.y, amount: event.amount, targetId: event.targetId });
      else if (event.type === 'heal') add('heal', 600, { x: event.x, y: event.y, radius: event.radius });
      else if (event.type === 'capture') add('capture', 900, { x: event.x, y: event.y, team: event.team });
      else if (event.type === 'bubblePop') add('pop', 300, { x: event.x, y: event.y });
      else if (event.type === 'kill') add('kill', 600, { x: event.x, y: event.y });
      else if (event.type === 'heartPickup') add('healNumber', 800, { x: event.x, y: event.y, amount: event.amount });
    }
    this.effects = this.effects.filter(effect => now - effect.born < effect.life);
  }

  render(state, { localId = null, now = performance.now(), focus = null } = {}) {
    this.resize();
    const ctx = this.ctx, map = MAPS[state.mapId], canvas = this.canvas;
    if (!map) return;
    this.consumeEvents(state, now);
    const local = localId !== null ? state.players[localId] : null;
    const zoom = canvas.width / VIEW_WORLD_WIDTH;
    const wanted = focus || (local ? { x: local.x, y: local.y - BODY_LIFT / 2 } : { x: map.width / 2, y: map.height / 2 });
    // Keep the arena filling the screen: clamp to the map edges (centre it when the view is larger).
    const halfW = canvas.width / zoom / 2, halfH = canvas.height / zoom / 2;
    const fit = (value, half, size) => size <= half * 2 ? size / 2 : Math.max(half, Math.min(size - half, value));
    const target = { x: fit(wanted.x, halfW, map.width), y: fit(wanted.y, halfH, map.height) };
    this.camera.zoom = zoom;
    this.camera.x = lerp(this.camera.x || target.x, target.x, .25); this.camera.y = lerp(this.camera.y || target.y, target.y, .25);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#16181c'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(zoom, 0, 0, zoom, canvas.width / 2 - this.camera.x * zoom, canvas.height / 2 - this.camera.y * zoom);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.buildMap(map), 0, 0);
    // Floor layer: point plates and rings, domes, bomb radii, shadows and team rings.
    const viewerTeam = local?.team ?? null;
    const players = state.players.filter(player => player.alive && !(player.cloakTicks > 0 && viewerTeam !== null && player.team !== viewerTeam
      && !(local?.alive && Math.hypot(local.x - player.x, local.y - player.y) < ABILITIES.cloak.revealRange)));
    for (const point of state.points) this.drawPoint(ctx, point, now);
    for (const bomb of state.bombs || []) this.drawBombRadius(ctx, bomb, now);
    for (const player of players) if (player.bubbleTicks > 0) this.drawBubble(ctx, player, now);
    for (const player of players) this.drawFootprint(ctx, player, player.id === localId);
    // Standing layer, back to front: wall rows, knights, beacons, bombs, hearts and shots.
    const items = [];
    for (const wall of this.wallRows || []) items.push({ key: (wall.row + 1) * TILE, draw: () => ctx.drawImage(wall.canvas, 0, wall.row * TILE - WALL_HEIGHT) });
    for (const point of state.points) items.push({ key: point.y, draw: () => this.drawBeacon(ctx, point, now) });
    for (const bomb of state.bombs || []) items.push({ key: bomb.y, draw: () => this.drawBomb(ctx, bomb, state, now) });
    for (const pickup of state.pickups || []) items.push({ key: pickup.y, draw: () => this.drawHeart(ctx, pickup, now) });
    for (const player of players) items.push({ key: player.y + FEET, draw: () => this.drawKnight(ctx, player, state, now, { mine: player.id === localId, alpha: player.cloakTicks > 0 ? .4 : 1 }) });
    for (const shot of state.projectiles || []) items.push({ key: shot.y + FEET, draw: () => this.drawProjectile(ctx, shot) });
    items.sort((a, b) => a.key - b.key);
    for (const item of items) item.draw();
    this.drawEffects(ctx, now);
    // Labels stay readable even when a knight is behind a wall.
    for (const player of players) {
      this.drawKnightOverlay(ctx, player, now, player.id === localId);
      if (state.phase === 'fight' && player.hp < player.maxHp && inBase(state, player)) this.drawRegen(ctx, player, now);
    }
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

  drawBombRadius(ctx, bomb, now) {
    const weapon = WEAPONS[bomb.weapon];
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

  drawBubble(ctx, player, now) {
    const radius = ABILITIES.bubble.radius, team = TEAM_COLORS[player.team], health = Math.max(0, player.bubbleHp / ABILITIES.bubble.hp);
    if (!this.drawSprite(ctx, 'fx_bubble', player.x, player.y, { scale: radius * 2 / 192, alpha: .55 })) {
      const gradient = ctx.createRadialGradient(player.x, player.y, radius * .4, player.x, player.y, radius);
      gradient.addColorStop(0, team.main + '10'); gradient.addColorStop(1, team.light + '55');
      ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(player.x, player.y, radius, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = team.light; ctx.globalAlpha = .35 + .5 * health; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(player.x, player.y, radius + Math.sin(now / 120) * 1.5, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
  }

  /** Floor marks under a knight: shadow, team ring, spawn shield and charge ring. */
  drawFootprint(ctx, player, mine) {
    const team = TEAM_COLORS[player.team], fx = player.x, fy = player.y + FEET, weapon = WEAPONS[player.weapons[player.slot]];
    ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.beginPath(); ctx.ellipse(fx, fy, 16, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = mine ? '#ffffff' : team.main; ctx.lineWidth = mine ? 3 : 2; ctx.beginPath(); ctx.ellipse(fx, fy, 21, 10, 0, 0, Math.PI * 2); ctx.stroke();
    if (player.shieldTicks > 0) { ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(fx, fy, 26, 13, 0, 0, Math.PI * 2); ctx.stroke(); }
    if (player.charging) {
      const full = Math.min(1, player.chargeTicks / weapon.chargeTicks);
      ctx.strokeStyle = full >= 1 ? '#ffffff' : '#ffd36b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(fx, fy, 26, 13, 0, -Math.PI / 2, -Math.PI / 2 + full * Math.PI * 2); ctx.stroke();
    }
  }
  drawKnight(ctx, player, state, now, { mine = false, alpha = 1 } = {}) {
    const team = TEAM_COLORS[player.team], weapon = WEAPONS[player.weapons[player.slot]], moving = Math.hypot(player.vx, player.vy) > 20;
    const { row, flip } = knightFacing(player.aim), facing = KNIGHT_FACINGS[row], fx = player.x, fy = player.y + FEET;
    const frame = moving ? 2 + Math.floor(now / 110) % 4 : Math.floor(now / 500) % 2;
    ctx.save(); ctx.globalAlpha = alpha;
    if (player.dashTicks > 0) this.drawSprite(ctx, 'fx_dash', fx, fy - 20, { rotation: Math.atan2(player.vy, player.vx) + Math.PI }) || (ctx.fillStyle = team.light + '55', ctx.beginPath(), ctx.ellipse(fx - player.vx * .06, fy - 20 - player.vy * .06, 12, 18, 0, 0, Math.PI * 2), ctx.fill());
    // The weapon is pinned to this facing's hand and rotated to the aim; facing away it goes behind the body.
    const swingOffset = player.action === 'swing' ? Math.sin((1 - player.actionTicks / Math.max(1, player.actionTotal)) * Math.PI) * (player.comboStep % 2 ? -1 : 1) * .9 : player.action === 'charge' ? (now / 40) % (Math.PI * 2) : 0;
    const hand = { x: fx + (facing.hand[0] - 32) * (flip ? -1 : 1), y: fy + facing.hand[1] - 58 };
    const drawWeapon = () => this.drawHeldWeapon(ctx, weapon, hand.x, hand.y, player.aim + swingOffset);
    if (facing.weaponBehind) drawWeapon();
    if (!this.drawSprite(ctx, `knight_${player.cls}_team${player.team}`, fx, fy, { row, frame, flipX: flip })) this.placeholderKnight(ctx, player, team, { row, flip, frame, moving, now });
    if (!facing.weaponBehind) drawWeapon();
    ctx.restore();
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
    const w = 38, pct = Math.max(0, player.hp / player.maxHp);
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(player.x - w / 2, top - 4, w, 5);
    ctx.fillStyle = pct > .5 ? team.light : pct > .25 ? '#ffd36b' : '#ff6b5a'; ctx.fillRect(player.x - w / 2, top - 4, w * pct, 5);
    ctx.font = '11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = mine ? '#ffffff' : team.light;
    ctx.fillText(player.name, player.x, top - 8);
  }
  /** A small chibi knight until the art lands: body, legs, big helmet, and a visor that shows the facing. */
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
    } else if (weapon.family === 'gun') {
      const length = weapon.id === 'magnus' ? 26 : weapon.id === 'scatter' ? 22 : 20;
      ctx.fillStyle = '#2e3138'; ctx.fillRect(0, -4, length, 8);
      ctx.fillStyle = weapon.id === 'autogun' ? '#9fd8ff' : weapon.id === 'magnus' ? '#ffb36b' : '#ffe08a'; ctx.fillRect(length - 4, -3, 4, 6);
    } else { ctx.fillStyle = '#2a2d33'; ctx.beginPath(); ctx.arc(10, 0, 7, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
  drawProjectile(ctx, shot) {
    const angle = Math.atan2(shot.vy, shot.vx), key = shot.kind === 'pierce' ? 'proj_pierce' : shot.kind === 'explosive' ? 'proj_explosive' : shot.kind === 'shard' ? 'proj_shard' : shot.weapon === 'scatter' ? 'proj_pellet' : 'proj_bullet';
    const lift = shot.kind === 'shard' ? 8 : BODY_LIFT, y = shot.y - lift;
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(shot.x, shot.y + 2, 5, 2, 0, 0, Math.PI * 2); ctx.fill();
    if (this.drawSprite(ctx, key, shot.x, y, { rotation: angle })) return;
    const color = TEAM_COLORS[shot.team].light;
    ctx.save(); ctx.translate(shot.x, y); ctx.rotate(angle); ctx.fillStyle = color;
    if (shot.kind === 'explosive') { ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill(); }
    else { const length = shot.kind === 'pierce' ? 22 : shot.kind === 'shard' ? 10 : 12; ctx.fillRect(-length, -2, length, 4); ctx.fillStyle = '#ffffff'; ctx.fillRect(-3, -1.5, 3, 3); }
    ctx.restore();
  }
  drawEffects(ctx, now) {
    for (const effect of this.effects) {
      const t = (now - effect.born) / effect.life;
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - t);
      const chest = effect.y - BODY_LIFT;
      if (effect.type === 'slash') {
        if (!this.drawSprite(ctx, 'fx_slash', effect.x, chest, { rotation: effect.angle, frame: t * 4, scale: effect.step % 2 ? 1 : 1 })) {
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 5; ctx.beginPath();
          const dir = effect.step % 2 ? -1 : 1; ctx.arc(effect.x, chest, 52, effect.angle - .8 * dir, effect.angle - .8 * dir + 1.6 * dir * Math.min(1, t * 2.5), dir < 0); ctx.stroke();
        }
      } else if (effect.type === 'spin' || effect.type === 'slam' || effect.type === 'lunge') {
        const key = effect.type === 'slam' ? 'fx_slam' : 'fx_spin';
        if (!this.drawSprite(ctx, key, effect.x, effect.y, { frame: t * 4 })) { ctx.strokeStyle = effect.type === 'slam' ? '#ffcf8a' : '#ffffff'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(effect.x, effect.y, 30 + t * 60, 0, Math.PI * 2); ctx.stroke(); }
      } else if (effect.type === 'muzzle') {
        if (!this.drawSprite(ctx, 'fx_muzzle', effect.x + Math.cos(effect.angle) * 30, chest + Math.sin(effect.angle) * 30, { rotation: effect.angle, frame: t * 3 })) { ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.arc(effect.x + Math.cos(effect.angle) * 32, chest + Math.sin(effect.angle) * 32, 6 * (1 - t), 0, Math.PI * 2); ctx.fill(); }
      } else if (effect.type === 'explosion') {
        if (!this.drawSprite(ctx, 'fx_explosion', effect.x, effect.y, { frame: t * 6, scale: (effect.radius || 90) * 2 / 128 })) {
          ctx.fillStyle = effect.weapon === 'vortex' ? '#b49cff' : '#ffb35a'; ctx.beginPath(); ctx.arc(effect.x, effect.y, (effect.radius || 80) * (.4 + .6 * t), 0, Math.PI * 2); ctx.fill();
        }
      } else if (effect.type === 'number') {
        ctx.fillStyle = '#ffffff'; ctx.font = 'bold 16px system-ui'; ctx.textAlign = 'center'; ctx.fillText(String(effect.amount), effect.x + 12, effect.y - 50 - t * 26);
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
    ctx.fillStyle = '#5b606b';
    for (let row = 0; row < map.rows; row++) for (let col = 0; col < map.cols; col++) if (map.grid[row][col] === '#') ctx.fillRect(col * TILE, row * TILE, TILE, TILE);
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
