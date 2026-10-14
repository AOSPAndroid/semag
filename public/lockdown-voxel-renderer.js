/** Overhead Lockdown camera over Semag-style 3D architecture. The existing
 * layered knight art, equipment animation and combat HUD remain reusable. */
import { LockdownRenderer, TEAM_COLORS, BODY_LIFT } from './lockdown-renderer.js';
import { MAPS, ABILITIES, RULES, GUARD, inBase } from './lockdown-engine.js';
import { levelAt } from './lockdown-maps.js';
import { GROUND, FLOOR_RISE, sceneWorldWidth } from './lockdown-scene-geometry.js';
import { PaintedMesh, MATERIAL } from './lockdown-painted-mesh.js';
import { buildLockdownWorld, STOREY, cylinder } from './lockdown-world-mesh.js';
import { LockdownWorldView } from './lockdown-world-view.js';
import { LOCKDOWN_YAW, CAMERA_COS, CAMERA_SIN, groundToView, viewToGround } from './lockdown-camera.js';
export { TEAM_COLORS, FLOOR_RISE };

export class LockdownVoxelRenderer extends LockdownRenderer {
  constructor(canvas, assets) {
    super(canvas, assets); this.worlds = new WeakMap(); this.dynamic = new PaintedMesh();
    try { this.world = new LockdownWorldView(); }
    catch (error) { this.graphicsError = error.message; this.world = null; }
    canvas.dataset.renderer = this.world ? 'webgl' : 'canvas-fallback';
  }
  get movementYaw() { return this.world && !this.world.lost ? -LOCKDOWN_YAW : 0; }
  resize() {
    const rect = this.canvas.getBoundingClientRect(), width = Math.max(1, rect.width), height = Math.max(1, rect.height);
    const ratio = Math.min(1.75, globalThis.devicePixelRatio || 1, Math.sqrt(2200000 / (width * height)));
    const w = Math.round(width * ratio), h = Math.round(height * ratio);
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
  }
  screenToWorld(px, py, height = 0) {
    if (!this.world || this.world.lost) return super.screenToWorld(px, py, height);
    const ratio = this.canvas.width / Math.max(1, this.canvas.getBoundingClientRect().width), { x, y, zoom } = this.camera;
    return viewToGround(x + (px * ratio - this.canvas.width / 2) / zoom, y + (py * ratio - this.canvas.height / 2) / zoom, height);
  }
  projectEffect(ctx, effect, at, height, flat) {
    if (!this.world || this.world.lost) {
      if (flat) { ctx.translate(0, -height + (['slash', 'spinTurn'].includes(effect.type) ? 8 - BODY_LIFT : 0)); ctx.scale(1, GROUND); }
      else if (effect.type !== 'chain' && at) ctx.translate(0, at.y * (GROUND - 1) - height);
      else ctx.translate(0, -height);
    } else if (flat) ctx.transform(CAMERA_COS, CAMERA_SIN * GROUND, -CAMERA_SIN, CAMERA_COS * GROUND, 0, -height + (['slash', 'spinTurn'].includes(effect.type) ? 8 - BODY_LIFT : 0));
    else if (effect.type === 'chain') ctx.transform(CAMERA_COS, CAMERA_SIN * GROUND, -CAMERA_SIN / GROUND, CAMERA_COS, 0, -height);
    else if (at) { const p = groundToView(at.x, at.y, height); ctx.translate(p.x - at.x, p.y - at.y); }
  }
  render(state, { localId = null, now = performance.now(), focus = null, pointer = null } = {}) {
    if (!this.world || this.world.lost) {
      if (this.currentMap) { this.camera = { x: 0, y: 0, zoom: 1 }; this.currentMap = null; }
      this.canvas.dataset.renderer = 'canvas-fallback';
      return super.render(state, { localId, now, focus, pointer });
    }
    const map = MAPS[state.mapId]; if (!map) return;
    this.localId = localId; this.players = state.players; this.resize(); this.consumeEvents(state, now);
    const canvas = this.canvas, ctx = this.ctx, local = localId !== null ? state.players[localId] : null;
    this.viewer = local?.alive ? local : null;
    const lift = (x, y) => levelAt(map, x, y) * FLOOR_RISE;
    const zoom = canvas.width / sceneWorldWidth(canvas.width, canvas.height);
    const wanted = focus ? groundToView(focus.x, focus.y) : local ? groundToView(local.x, local.y, BODY_LIFT / 2 + lift(local.x, local.y)) : groundToView(map.width / 2, map.height / 2);
    const fit = (v, half, size) => size <= half * 2 ? size / 2 : Math.max(half - 55, Math.min(size - half + 55, v));
    const minX = -CAMERA_SIN * map.height, width = CAMERA_COS * map.width - minX, height = (CAMERA_SIN * map.width + CAMERA_COS * map.height) * GROUND;
    const target = { x: minX + fit(wanted.x - minX, canvas.width / zoom / 2, width), y: fit(wanted.y, canvas.height / zoom / 2, height) };
    const reset = this.currentMap !== map.id || !this.camera.x;
    const dt = Math.min(100, Math.max(0, now - (this.frameTime ?? now))), follow = 1 - Math.exp(-dt / 75);
    this.camera = { x: reset ? target.x : this.camera.x + (target.x - this.camera.x) * follow, y: reset ? target.y : this.camera.y + (target.y - this.camera.y) * follow, zoom };
    this.currentMap = map.id; this.frameTime = now;
    if (!this.worlds.has(map)) this.worlds.set(map, buildLockdownWorld(map));
    const scene = this.worlds.get(map), mesh = this.dynamic.reset();
    this.world.begin(canvas.width, canvas.height);
    const viewerTeam = local?.team ?? null;
    const players = state.players.filter(p => p.alive && !(p.cloakTicks > 0 && viewerTeam !== null && p.team !== viewerTeam
      && !(local?.alive && Math.hypot(local.x - p.x, local.y - p.y) < ABILITIES.cloak.revealRange)));
    for (const point of state.points) {
      const y = levelAt(map, point.x, point.y) * STOREY, paint = point.owner == null ? '#a9c3c4' : TEAM_COLORS[point.owner].main;
      mesh.floorRing(point.x, point.y, RULES.pointRadius - 1.5, RULES.pointRadius + 1.5, paint, y + .3, 72);
      mesh.paint(map.theme === 'foundry' ? MATERIAL.metal : MATERIAL.masonry, () => cylinder(mesh, point.x, y + .1, point.y, 44, 6, scene.style.trim, 32));
      cylinder(mesh, point.x, y + 6, point.y, 37, 2, '#a08653', 32);
      mesh.paint(MATERIAL.metal, () => cylinder(mesh, point.x, y + 8, point.y, 32, 2, scene.style.roof, 32));
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4, x = point.x + Math.cos(a) * 34, z = point.y + Math.sin(a) * 34;
        cylinder(mesh, x, y + 8, z, 5, 3, '#d2b577', 10);
        cylinder(mesh, x, y + 11, z, 3.4, .8, '#b3fcf7', 12);
      }
      mesh.floorRing(point.x, point.y, 17, 21, '#8ce8e1', y + 10.2, 32);
      cylinder(mesh, point.x, y + 7, point.y, 12, 7, scene.style.trim, 12);
      cylinder(mesh, point.x, y + 14, point.y, 0, 13, paint, 8, 8);
      cylinder(mesh, point.x, y + 27, point.y, 8, 13, paint, 8, 0);
      const progress = Math.min(1, Math.abs(point.progress / 100)), steps = Math.ceil(progress * 72);
      const progressColor = point.progress > 0 ? TEAM_COLORS[0].light : TEAM_COLORS[1].light;
      for (let i = 0; i < steps; i++) {
        const a = -Math.PI / 2 + i / 72 * Math.PI * 2, b = -Math.PI / 2 + Math.min(progress, (i + 1) / 72) * Math.PI * 2, r = RULES.pointRadius - 7;
        mesh.line([point.x + Math.cos(a) * r, y + .5, point.y + Math.sin(a) * r], [point.x + Math.cos(b) * r, y + .5, point.y + Math.sin(b) * r], 2, progressColor, [point.x, 3000, point.y]);
      }
    }
    for (const player of players) {
      const y = levelAt(map, player.x, player.y) * STOREY;
      mesh.floorRing(player.x, player.y, 0, 17, [0.08, .12, .14, .24], y + .2, 24);
      mesh.floorRing(player.x, player.y, 19, player.id === localId ? 21 : 20, TEAM_COLORS[player.team].main, y + .3, 32);
      const p = groundToView(player.x, player.y, lift(player.x, player.y));
      if (Math.abs(p.x - this.camera.x) * zoom > canvas.width / 2 + 140 || Math.abs(p.y - this.camera.y) * zoom > canvas.height / 2 + 140) continue;
      this.world.billboard(player.x, player.y, y, paint => {
        paint.translate(-player.x, -player.y - 8);
        const velocity = groundToView(player.vx, player.vy), dodge = groundToView(player.dodgeX || 0, player.dodgeY || 0);
        const pose = { ...player, aim: player.aim + LOCKDOWN_YAW, swingAim: player.swingAim + LOCKDOWN_YAW, vx: velocity.x, vy: velocity.y / GROUND, dodgeX: dodge.x, dodgeY: dodge.y / GROUND };
        this.drawKnight(paint, pose, state, now, { mine: player.id === localId, alpha: player.cloakTicks > 0 ? .4 : 1 });
      }, player.id === localId);
    }
    this.world.render(map, scene, mesh.array, this.camera);
    this.canvas.dataset.renderer = 'webgl'; this.stats = this.world.stats;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(this.world.canvas, 0, 0);
    ctx.setTransform(zoom, 0, 0, zoom, canvas.width / 2 - this.camera.x * zoom, canvas.height / 2 - this.camera.y * zoom);
    const flat = (x, y, draw) => { ctx.save(); ctx.transform(CAMERA_COS, CAMERA_SIN * GROUND, -CAMERA_SIN, CAMERA_COS * GROUND, 0, -lift(x, y)); draw(); ctx.restore(); };
    const upright = (x, y, draw, amount = lift(x, y)) => { ctx.save(); const p = groundToView(x, y, amount); ctx.translate(p.x - x, p.y - y); draw(); ctx.restore(); };
    for (const cloud of state.clouds || []) flat(cloud.x, cloud.y, () => this.drawCloud(ctx, cloud, now));
    for (const bomb of state.bombs || []) {
      flat(bomb.x, bomb.y, () => this.drawBombRadius(ctx, bomb, now));
      upright(bomb.x, bomb.y, () => this.drawBomb(ctx, bomb, state, now));
    }
    for (const pickup of state.pickups || []) upright(pickup.x, pickup.y, () => this.drawHeart(ctx, pickup, now));
    for (const shot of state.projectiles || []) upright(shot.x, shot.y, () => { const v = groundToView(shot.vx, shot.vy); this.drawProjectile(ctx, { ...shot, vx: v.x, vy: v.y / GROUND }); }, (shot.z || 0) * FLOOR_RISE);
    for (const player of players) {
      if (player.guarding && player.guardRaise >= GUARD.expandTicks && !player.domeBroken && player.domeHp > 0) flat(player.x, player.y, () => this.drawDome(ctx, player, now));
      upright(player.x, player.y, () => {
        if (player.guarding) this.drawGuard(ctx, player, now);
        const showHealth = viewerTeam === null || player.team === undefined || player.team === viewerTeam;
        this.drawKnightOverlay(ctx, player, now, player.id === localId, showHealth);
        if (showHealth && state.phase === 'fight' && player.hp < player.maxHp && inBase(state, player)) this.drawRegen(ctx, player, now);
      });
    }
    for (const point of state.points) upright(point.x, point.y, () => {
      ctx.font = 'bold 19px system-ui'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#24383f';
      ctx.strokeText(point.id, point.x, point.y - 39); ctx.fillStyle = point.owner == null ? '#eef6ee' : TEAM_COLORS[point.owner].light;
      ctx.fillText(point.id, point.x, point.y - 39);
    });
    this.drawEffects(ctx, now, lift);
    if (pointer) this.drawCrosshair(ctx, pointer, local, now);
  }
  destroy() { this.world?.destroy(); }
}
