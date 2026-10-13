/** Lockdown ¾ voxel view (prototype, `?view=voxel`).
 * The simulation stays 2D. This view lifts it onto the shared voxel renderer under
 * a fixed camera tilted like Spiral Knights': map tiles become voxel blocks, knights
 * reuse the voxel operatives and their swords and guns, and points, hearts, bombs,
 * bubbles and shots are drawn as simple voxel geometry. Names and health bars go on
 * a 2D overlay projected from the same camera. */
import { VoxelRenderer } from './voxel-renderer.js';
import { createCombatPlayer } from './voxel-engine.js';
import { setInventoryMeleeLoadout } from './voxel-inventory.js';
import { MAPS, TILE, RULES, ABILITIES, WEAPONS, inBase } from './lockdown-engine.js';

export const SCALE = 1 / 40; // Lockdown world units → metres (a 48-unit tile is 1.2 m)
export const VOXEL_CAMERA = Object.freeze({ pitch: -1.05, distance: 12, fov: 55, wallHeight: 1.25, lookHeight: .7 });
const TEAM = ['#e39a3b', '#3bb8c4'], TEAM_LIGHT = ['#ffd08a', '#9fe8ee'];
const THEME = { stone: { theme: 'medieval', floor: '#8d8f86', sky: '#9fb3c4' }, brass: { theme: 'foundry', floor: '#8a7b66', sky: '#b3a48c' } };
// Each Lockdown weapon borrows the closest existing voxel model.
const MODEL = { brand: ['melee', 'sword'], cleaver: ['melee', 'axe'], rapier: ['melee', 'spear'], blaster: ['gun', 'pistol'], autogun: ['gun', 'smg'], scatter: ['gun', 'shorty'], magnus: ['gun', 'revolver'], blast: ['melee', 'knife'], vortex: ['melee', 'knife'], shard: ['melee', 'knife'] };
const finite = (n, fallback = 0) => Number.isFinite(n) ? n : fallback;

const voxelMaps = new Map();
/** Wall tiles merged into horizontal runs of voxel blocks. */
export function voxelMap(mapId) {
  if (voxelMaps.has(mapId)) return voxelMaps.get(mapId);
  const map = MAPS[mapId], look = THEME[map.theme] || THEME.stone, colliders = [], size = TILE * SCALE;
  for (let row = 0; row < map.rows; row++) {
    for (let col = 0; col < map.cols;) {
      if (map.grid[row][col] !== '#') { col++; continue; }
      let end = col; while (end + 1 < map.cols && map.grid[row][end + 1] === '#') end++;
      const outer = row === 0 || row === map.rows - 1 || col === 0 || end === map.cols - 1;
      colliders.push({ id: `ld-wall-${row}-${col}`, x: col * size, y: 0, z: row * size, w: (end - col + 1) * size, h: outer ? VOXEL_CAMERA.wallHeight * 1.5 : VOXEL_CAMERA.wallHeight, d: size });
      col = end + 1;
    }
  }
  const result = Object.freeze({ id: `lockdown-${mapId}`, theme: look.theme, floorColor: look.floor, skyColor: look.sky,
    bounds: { minX: 0, maxX: map.width * SCALE, minZ: 0, maxZ: map.height * SCALE }, colliders, spawns: [[{ x: 0, z: 0, yaw: 0 }]], sites: [] });
  voxelMaps.set(mapId, result);
  return result;
}

/** Camera basis for the fixed tilt: looks toward -z, pitched down. */
function cameraFor(target, aspect) {
  const { pitch, distance, fov, lookHeight } = VOXEL_CAMERA;
  const eye = [target.x, lookHeight - Math.sin(pitch) * distance, target.z + Math.cos(pitch) * distance];
  const forward = [0, Math.sin(pitch), -Math.cos(pitch)], up = [0, Math.cos(pitch), Math.sin(pitch)], right = [1, 0, 0];
  return { eye, yaw: 0, pitch, forward, up, right, tangent: Math.tan(fov * Math.PI / 360), aspect };
}

export class LockdownVoxelView {
  constructor(canvas, overlay) {
    this.canvas = canvas; this.overlay = overlay; this.ctx = overlay.getContext('2d');
    this.voxel = new VoxelRenderer(canvas);
    this.proxies = new Map(); this.camera = null; this.focus = null; this.effects = []; this.seen = new Set(); this.seenOrder = [];
  }
  get available() { return this.voxel.available; }
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.voxel.resize(rect); this.aspect = Math.max(1, rect.width) / Math.max(1, rect.height);
    const ratio = Math.min(2, globalThis.devicePixelRatio || 1), width = Math.max(1, Math.round(rect.width * ratio)), height = Math.max(1, Math.round(rect.height * ratio));
    if (this.overlay.width !== width || this.overlay.height !== height) { this.overlay.width = width; this.overlay.height = height; }
  }
  /** Keep the arena filling the screen: how far the view reaches on the floor around its focus. */
  clampFocus(focus, bounds) {
    const probe = cameraFor({ x: 0, z: 0 }, this.aspect || 16 / 9), ground = (nx, ny) => {
      const ray = [0, 1, 2].map(axis => probe.forward[axis] + probe.right[axis] * nx * probe.tangent * probe.aspect + probe.up[axis] * ny * probe.tangent);
      const t = -probe.eye[1] / Math.min(-1e-3, ray[1]); return { x: probe.eye[0] + ray[0] * t, z: probe.eye[2] + ray[2] * t };
    };
    const top = ground(0, 1).z, bottom = ground(0, -1).z, half = Math.abs(ground(1, 0).x), wall = TILE * SCALE * .5;
    const fit = (value, low, high) => low > high ? (low + high) / 2 : Math.max(low, Math.min(high, value));
    return { x: fit(focus.x, bounds.minX + half - wall, bounds.maxX - half + wall), z: fit(focus.z, bounds.minZ - top - wall, bounds.maxZ - bottom + wall) };
  }
  /** Mouse → the floor point under it, in Lockdown world units. */
  screenToWorld(px, py) {
    const camera = this.camera; if (!camera) return { x: 0, y: 0 };
    const rect = this.canvas.getBoundingClientRect();
    const nx = (px / rect.width) * 2 - 1, ny = 1 - (py / rect.height) * 2;
    const ray = [0, 1, 2].map(axis => camera.forward[axis] + camera.right[axis] * nx * camera.tangent * camera.aspect + camera.up[axis] * ny * camera.tangent);
    const t = ray[1] < -1e-6 ? -camera.eye[1] / ray[1] : 0;
    return { x: (camera.eye[0] + ray[0] * t) / SCALE, y: (camera.eye[2] + ray[2] * t) / SCALE };
  }
  /** World (metres) → overlay pixels. */
  project(x, y, z) {
    const camera = this.camera, rel = [x - camera.eye[0], y - camera.eye[1], z - camera.eye[2]];
    const depth = rel[0] * camera.forward[0] + rel[1] * camera.forward[1] + rel[2] * camera.forward[2];
    if (depth <= .05) return null;
    const sx = (rel[0] * camera.right[0] + rel[1] * camera.right[1] + rel[2] * camera.right[2]) / (depth * camera.tangent * camera.aspect);
    const sy = (rel[0] * camera.up[0] + rel[1] * camera.up[1] + rel[2] * camera.up[2]) / (depth * camera.tangent);
    return { x: (sx + 1) / 2 * this.overlay.width, y: (1 - sy) / 2 * this.overlay.height };
  }
  proxy(player) {
    // One voxel operative per seat, rebuilt only when the held weapon changes.
    const weaponId = player.weapons[player.slot], key = `${player.cls}:${weaponId}:${player.team}`;
    let entry = this.proxies.get(player.id);
    if (!entry || entry.key !== key) {
      const [kind, model] = MODEL[weaponId] || ['gun', 'pistol'];
      const proxy = createCombatPlayer(player.id, 1, kind === 'gun' ? model : 'pistol');
      if (kind === 'melee') setInventoryMeleeLoadout(proxy, model, { equip: true });
      entry = { key, proxy }; this.proxies.set(player.id, entry);
    }
    const proxy = entry.proxy;
    Object.assign(proxy, { x: player.x * SCALE, y: 0, z: player.y * SCALE, yaw: player.aim + Math.PI / 2, pitch: 0, team: player.team, alive: player.alive,
      hp: player.hp, maxHp: player.maxHp, crouching: false, sprinting: player.dashTicks > 0, grounded: true,
      meleeTicks: player.action === 'swing' || player.action === 'charge' ? player.actionTicks : 0, meleeYaw: player.aim + Math.PI / 2, meleePitch: 0 });
    return proxy;
  }
  consumeEvents(state, now) {
    for (const event of state.events || []) {
      if (this.seen.has(event.id)) continue;
      this.seen.add(event.id); this.seenOrder.push(event.id); if (this.seenOrder.length > 600) this.seen.delete(this.seenOrder.shift());
      if (state.tick - event.tick > 30) continue;
      if (event.type === 'damage') this.effects.push({ type: 'number', born: now, life: 700, x: event.x, y: event.y, text: String(event.amount), color: '#ffffff' });
      else if (event.type === 'heartPickup') this.effects.push({ type: 'number', born: now, life: 800, x: event.x, y: event.y, text: `+${event.amount}`, color: '#7cf0a0' });
      else if (event.type === 'explosion') this.effects.push({ type: 'blast', born: now, life: 420, x: event.x, y: event.y, radius: event.radius, weapon: event.weapon });
      else if (event.type === 'swing') this.effects.push({ type: 'swing', born: now, life: event.charged ? 360 : 200, x: event.x, y: event.y, angle: event.angle, charged: !!event.charged, kind: event.kind });
      else if (event.type === 'heal') this.effects.push({ type: 'heal', born: now, life: 600, x: event.x, y: event.y, radius: event.radius });
    }
    this.effects = this.effects.filter(effect => now - effect.born < effect.life);
  }

  render(state, { localId = null, now = performance.now(), focus = null } = {}) {
    this.resize();
    const map = voxelMap(state.mapId), local = localId !== null ? state.players[localId] : null;
    const target = focus || (local ? { x: local.x, y: local.y } : { x: MAPS[state.mapId].width / 2, y: MAPS[state.mapId].height / 2 });
    const wanted = this.clampFocus({ x: target.x * SCALE, z: target.y * SCALE }, map.bounds);
    this.focus = this.focus ? { x: this.focus.x + (wanted.x - this.focus.x) * .2, z: this.focus.z + (wanted.z - this.focus.z) * .2 } : wanted;
    this.camera = cameraFor(this.focus, this.aspect || 16 / 9);
    this.consumeEvents(state, now);
    const viewer = local?.team ?? null;
    const visible = state.players.filter(player => !(player.cloakTicks > 0 && viewer !== null && player.team !== viewer && !(local?.alive && Math.hypot(local.x - player.x, local.y - player.y) < ABILITIES.cloak.revealRange)));
    const proxies = visible.map(player => this.proxy(player));
    const voxelState = { gameId: 'lockdown', map, players: proxies, phase: state.phase === 'matchEnd' ? 'paused' : 'fight', tick: state.tick, events: [] };
    const appendWorldGeometry = mesh => this.appendWorld(mesh, state, visible, now);
    const ok = this.voxel.render(voxelState, { localId, time: now, cameraPose: { eye: this.camera.eye, yaw: 0, pitch: VOXEL_CAMERA.pitch }, showLocalPlayer: true, hideWeapon: true, fov: VOXEL_CAMERA.fov, appendWorldGeometry });
    this.drawOverlay(state, visible, localId, now);
    return ok;
  }

  appendWorld(mesh, state, players, now) {
    const s = SCALE;
    // Control points: a ring of floor tiles, coloured by owner, with a capture arc.
    for (const point of state.points) {
      const radius = RULES.pointRadius * s, segments = 40, colour = point.owner === null ? '#d6dbe4' : TEAM[point.owner];
      for (let i = 0; i < segments; i++) {
        const a = i / segments * Math.PI * 2;
        mesh.box(point.x * s + Math.cos(a) * radius - .09, 0, point.y * s + Math.sin(a) * radius - .09, .18, .05, .18, colour);
      }
      const progress = point.progress / 100, team = progress >= 0 ? 0 : 1;
      for (let i = 0; i < Math.round(Math.abs(progress) * segments); i++) {
        const a = -Math.PI / 2 + i / segments * Math.PI * 2;
        mesh.box(point.x * s + Math.cos(a) * (radius - .3) - .08, 0, point.y * s + Math.sin(a) * (radius - .3) - .08, .16, .08, .16, TEAM_LIGHT[team]);
      }
      // Beacon pylon with an owner-coloured light.
      mesh.box(point.x * s - .22, 0, point.y * s - .22, .44, .9, .44, '#3a3d44');
      const pulse = .8 + Math.sin(now / 300) * .1;
      mesh.box(point.x * s - .16, .9, point.y * s - .16, .32, .32 * pulse, .32, point.owner === null ? '#eef1f5' : TEAM_LIGHT[point.owner]);
    }
    // Team base pads: tinted floor, so the healing zone reads in 3D.
    const layout = MAPS[state.mapId], size = TILE * s;
    for (const team of [0, 1]) for (const tile of layout.spawns[team]) mesh.floor(tile.x * s - size / 2 + .02, tile.y * s - size / 2 + .02, size - .04, size - .04, team === 0 ? '#9c7a4f' : '#4f8c90', .004);
    // Hearts: a little voxel heart that bobs.
    for (const heart of state.pickups || []) {
      if (heart.ttl < 360 && Math.floor(now / 150) % 2) continue;
      const lift = .45 + Math.sin(now / 220 + heart.id) * .08, x = heart.x * s, z = heart.y * s, v = .09;
      const cells = [[-2, 1], [-1, 1], [1, 1], [2, 1], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [-1, -1], [0, -1], [1, -1], [0, -2]];
      for (const [cx, cy] of cells) mesh.box(x + cx * v - v / 2, lift + cy * v, z - v / 2, v, v, v, '#ff4d6d');
    }
    // Bombs with a blinking fuse cap.
    for (const bomb of state.bombs || []) {
      const x = bomb.x * s, z = bomb.y * s, blink = bomb.fuse < 40 && Math.floor(now / 90) % 2;
      mesh.box(x - .2, 0, z - .2, .4, .36, .4, bomb.weapon === 'vortex' ? '#4b3b78' : bomb.weapon === 'shard' ? '#3b5a78' : '#2a2d33');
      mesh.box(x - .06, .36, z - .06, .12, .12, .12, blink ? '#ff5a4a' : '#ffd36b');
    }
    // Shots: small glowing slugs at chest height.
    for (const shot of state.projectiles || []) {
      const size = shot.kind === 'explosive' ? .22 : shot.kind === 'pierce' ? .16 : .1;
      mesh.box(shot.x * s - size / 2, .95, shot.y * s - size / 2, size, size, size, shot.team === 0 ? '#ffe2a8' : '#c8fbff');
    }
    for (const player of players) {
      if (!player.alive) continue;
      const x = player.x * s, z = player.y * s;
      // Team ring under each knight.
      for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; mesh.box(x + Math.cos(a) * .58 - .05, 0, z + Math.sin(a) * .58 - .05, .1, .03, .1, TEAM[player.team]); }
      // Knight helmet over the operative's head: team plate, dark visor, class crest.
      const helm = { x, y: 0, z, yaw: player.aim + Math.PI / 2, pitch: 0 }, plate = TEAM[player.team], trim = TEAM_LIGHT[player.team];
      mesh.box(-.17, 1.53, -.17, .34, .33, .34, plate, helm);
      mesh.box(-.12, 1.62, -.185, .24, .06, .02, '#16181c', helm);
      if (player.cls === 'striker') mesh.box(-.03, 1.86, -.12, .06, .14, .32, trim, helm);
      else if (player.cls === 'guardian') { mesh.box(-.33, 1.2, -.12, .16, .14, .24, plate, helm); mesh.box(.17, 1.2, -.12, .16, .14, .24, plate, helm); mesh.box(-.08, 1.86, -.08, .16, .05, .16, trim, helm); }
      else mesh.box(-.19, 1.5, -.02, .38, .38, .2, '#2b2f36', helm);
      // Guardian dome: a ring of posts at its edge.
      if (player.bubbleTicks > 0) {
        const radius = ABILITIES.bubble.radius * s;
        for (let i = 0; i < 36; i++) { const a = i / 36 * Math.PI * 2; mesh.box(x + Math.cos(a) * radius - .06, 0, z + Math.sin(a) * radius - .06, .12, 1.6 + Math.sin(now / 200 + i) * .1, .12, TEAM_LIGHT[player.team]); }
      }
      // Bombs held while charging.
      const weapon = WEAPONS[player.weapons[player.slot]];
      if (weapon.family === 'bomb' && player.charging) mesh.box(x + Math.cos(player.aim) * .45 - .15, .9, z + Math.sin(player.aim) * .45 - .15, .3, .3, .3, '#2a2d33');
      // Healing in base: green pluses rising.
      if (state.phase === 'fight' && player.hp < player.maxHp && inBase(state, player)) for (let i = 0; i < 3; i++) {
        const phase = ((now / 900) + i / 3) % 1;
        mesh.box(x - .04 + Math.sin(i * 2.3) * .3, 1.9 + phase * .8, z - .04, .08, .22, .08, '#7cf0a0');
        mesh.box(x - .11 + Math.sin(i * 2.3) * .3, 1.97 + phase * .8, z - .04, .22, .08, .08, '#7cf0a0');
      }
    }
    // Effects: blade arcs, blast rings and heal waves as flat voxel rings.
    for (const effect of this.effects) {
      const t = (now - effect.born) / effect.life, x = effect.x * s, z = effect.y * s;
      if (effect.type === 'swing') {
        const reach = (effect.charged ? 2.4 : 1.9), sweep = effect.charged ? Math.PI * 2 : 1.8;
        for (let i = 0; i < 10; i++) {
          const a = effect.angle - sweep / 2 + sweep * Math.min(1, t * 1.6) * i / 9;
          mesh.box(x + Math.cos(a) * reach - .07, .9, z + Math.sin(a) * reach - .07, .14, .06, .14, '#ffffff');
        }
      } else if (effect.type === 'blast' || effect.type === 'heal') {
        const radius = (effect.radius || 90) * s * (.3 + .7 * t), colour = effect.type === 'heal' ? '#8dffb0' : effect.weapon === 'vortex' ? '#b49cff' : '#ffb35a';
        for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2; mesh.box(x + Math.cos(a) * radius - .1, .1 + (1 - t) * .4, z + Math.sin(a) * radius - .1, .2, .2, .2, colour); }
      }
    }
  }

  drawOverlay(state, players, localId, now) {
    const ctx = this.ctx, ratio = this.overlay.width / Math.max(1, this.overlay.getBoundingClientRect().width);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);
    ctx.textAlign = 'center';
    for (const player of players) {
      if (!player.alive) continue;
      const head = this.project(player.x * SCALE, 2.25, player.y * SCALE); if (!head) continue;
      const w = 40 * ratio, pct = Math.max(0, player.hp / player.maxHp);
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(head.x - w / 2, head.y, w, 5 * ratio);
      ctx.fillStyle = pct > .5 ? TEAM_LIGHT[player.team] : pct > .25 ? '#ffd36b' : '#ff6b5a'; ctx.fillRect(head.x - w / 2, head.y, w * pct, 5 * ratio);
      ctx.font = `${11 * ratio}px system-ui, sans-serif`; ctx.fillStyle = player.id === localId ? '#ffffff' : TEAM_LIGHT[player.team];
      ctx.fillText(player.name, head.x, head.y - 4 * ratio);
      if (player.charging) {
        const weapon = WEAPONS[player.weapons[player.slot]], full = Math.min(1, player.chargeTicks / weapon.chargeTicks), feet = this.project(player.x * SCALE, 0, player.y * SCALE);
        if (feet) { ctx.strokeStyle = full >= 1 ? '#ffffff' : '#ffd36b'; ctx.lineWidth = 3 * ratio; ctx.beginPath(); ctx.arc(feet.x, feet.y - 30 * ratio, 22 * ratio, -Math.PI / 2, -Math.PI / 2 + full * Math.PI * 2); ctx.stroke(); }
      }
    }
    for (const point of state.points) {
      const top = this.project(point.x * SCALE, 1.7, point.y * SCALE); if (!top) continue;
      ctx.font = `bold ${20 * ratio}px system-ui, sans-serif`; ctx.fillStyle = point.owner === null ? '#eef1f5' : TEAM_LIGHT[point.owner];
      ctx.fillText(point.id, top.x, top.y);
    }
    for (const effect of this.effects) {
      if (effect.type !== 'number') continue;
      const t = (now - effect.born) / effect.life, at = this.project(effect.x * SCALE, 2 + t * .8, effect.y * SCALE); if (!at) continue;
      ctx.globalAlpha = 1 - t * t; ctx.font = `bold ${16 * ratio}px system-ui, sans-serif`; ctx.fillStyle = effect.color; ctx.fillText(effect.text, at.x + 14 * ratio, at.y); ctx.globalAlpha = 1;
    }
  }
}
