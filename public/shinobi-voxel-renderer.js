import { VoxelRenderer, ninjaAppearance, ninjaOperativeMeshes } from './voxel-renderer.js';
import { createShinobiCameraPresenter } from './shinobi-voxel-camera.js';

export { ninjaAppearance, ninjaOperativeMeshes };
const finite = (n, fallback = 0) => Number.isFinite(n) ? n : fallback;
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const MAX_KUNAI = 32, MAX_DASHES = 6, MAX_SPARKS = 24, MAX_EVENTS = 128;

/** Geometry reads only accepted projectiles and confirmed impacts. */
export function appendShinobiKunai(mesh, projectiles = []) {
  let drawn = 0;
  for (const knife of projectiles.slice(0, MAX_KUNAI)) {
    if (![knife.x, knife.y, knife.z, knife.dx, knife.dy, knife.dz].every(Number.isFinite)) continue;
    const pose = { x: knife.x, y: knife.y, z: knife.z, yaw: Math.atan2(knife.dx, -knife.dz), pitch: Math.atan2(knife.dy, Math.hypot(knife.dx, knife.dz)) };
    mesh.box(-.020, -.015, -.170, .040, .030, .190, '#dbe9e9', pose);
    mesh.box(-.037, -.014, -.062, .074, .028, .067, '#b4cfda', pose);
    mesh.box(-.016, -.016, .019, .032, .032, .107, '#394b56', pose);
    mesh.box(-.024, -.012, .118, .048, .024, .032, '#c79866', pose);
    drawn++;
  }
  return drawn;
}

export function createShinobiEffectPresenter() {
  let context = null, seen = new Set(), queue = [], dashes = [], sparks = [], now = 0, paused = false;
  const reset = () => { context = null; seen.clear(); queue = []; dashes = []; sparks = []; now = 0; paused = false; };
  const observe = (state, time, options = {}) => {
    const key = `${state.map?.id}:${state.matchId ?? ''}:${state.round ?? ''}`;
    if (key !== context || time < now) { reset(); context = key; }
    if (options.paused || state.phase === 'paused') { paused = true; now = time; return; }
    if (paused) { dashes = []; sparks = []; paused = false; }
    now = time;
    for (const event of state.events || []) {
      const id = event.id ?? `${event.tick}:${event.type}:${event.playerId}`;
      if (seen.has(id)) continue;
      seen.add(id); queue.push(id); while (queue.length > MAX_EVENTS) seen.delete(queue.shift());
      if (Number.isFinite(event.tick) && Number.isFinite(state.tick) && state.tick - event.tick > 18) continue;
      if (event.type === 'dashStart' && [event.x, event.y, event.z].every(Number.isFinite)) {
        dashes.push({ playerId: event.playerId, origin: [event.x, event.y + .72, event.z], born: time, life: Math.max(80, Math.min(220, finite(event.ticks, 16) * 1000 / 120)) });
        if (dashes.length > MAX_DASHES) dashes.shift();
      }
      if (event.type === 'kunaiImpact' && [event.x, event.y, event.z].every(Number.isFinite)) {
        const count = options.reducedMotion ? 2 : 5;
        for (let index = 0; index < count; index++) {
          const angle = index * 2.39996 + finite(event.id) % 7;
          sparks.push({ origin: [event.x, event.y, event.z], born: time, vx: Math.cos(angle) * .8, vy: .3 + index * .07, vz: Math.sin(angle) * .8, life: 120 + index * 17 });
        }
        if (sparks.length > MAX_SPARKS) sparks.splice(0, sparks.length - MAX_SPARKS);
      }
    }
    dashes = dashes.filter(dash => time - dash.born < dash.life);
    sparks = sparks.filter(spark => time - spark.born < spark.life);
  };
  const appendWorld = (mesh, { state, time }) => {
    const kunai = appendShinobiKunai(mesh, state.kunai);
    if (!paused) for (const spark of sparks) {
      const age = Math.max(0, time - spark.born) / 1000, fade = 1 - clamp((time - spark.born) / spark.life, 0, 1), size = .022 * fade;
      const point = spark.origin.map((n, axis) => n + [spark.vx, spark.vy, spark.vz][axis] * age - (axis === 1 ? age * age * 2 : 0));
      mesh.box(point[0] - size / 2, point[1] - size / 2, point[2] - size / 2, size, size, size, '#e8cd87');
    }
    return kunai;
  };
  const appendEffects = (mesh, { players, eye, time, reducedMotion }) => {
    if (paused || reducedMotion) return;
    for (const dash of dashes) {
      const player = players.find(actor => actor.id === dash.playerId && actor.alive !== false);
      if (!player) continue;
      const point = [player.x, finite(player.y) + .72, player.z], fade = 1 - clamp((time - dash.born) / dash.life, 0, 1);
      if (Math.hypot(...point.map((n, axis) => n - dash.origin[axis])) < .08) continue;
      mesh.line(dash.origin, point, .032, [.59, .87, .92, .21 * fade], eye);
      for (const offset of [-.19, .19]) mesh.line(dash.origin.map((n, axis) => n + (axis === 1 ? offset : 0)), point.map((n, axis) => n + (axis === 1 ? offset : 0)), .008, [.95, .78, .47, .36 * fade], eye);
    }
  };
  return { observe, appendWorld, appendEffects, reset, inspect: () => Object.freeze({ eventIds: seen.size, dashes: dashes.length, sparks: sparks.length, maxKunai: MAX_KUNAI, maxDashes: MAX_DASHES, maxSparks: MAX_SPARKS }) };
}

/** The existing voxel renderer supplies maps, articulated limbs and blade bands. */
export class ShinobiVoxelRenderer {
  constructor(canvas) {
    this.voxel = new VoxelRenderer(canvas);
    this.presentCamera = createShinobiCameraPresenter();
    this.presentEffects = createShinobiEffectPresenter();
    this.appendWorld = (mesh, context) => this.presentEffects.appendWorld(mesh, context);
    this.appendEffects = (mesh, context) => this.presentEffects.appendEffects(mesh, context);
  }
  updateCamera(state, options = {}) { return this.presentCamera(state, options); }
  render(state, options = {}) {
    if (!state || this.destroyed) return false;
    const time = finite(options.time, typeof performance === 'object' ? performance.now() : 0);
    const cameraPose = options.cameraPose || this.updateCamera(state, { ...options, time });
    if (!cameraPose) return false;
    this.presentEffects.observe(state, time, options);
    return this.voxel.render(state, { ...options, time, cameraPose, showLocalPlayer: true, ninjaSkins: true, hideWeapon: true, fov: options.fov ?? 76,
      appendWorldGeometry: this.appendWorld, appendEffectGeometry: this.appendEffects });
  }
  resize(...args) { return this.voxel.resize(...args); }
  resetEffects() { this.presentCamera.reset(); this.presentEffects.reset(); this.voxel.resetEffects(); }
  destroy() { this.presentCamera.reset(); this.presentEffects.reset(); this.voxel.destroy(); }
  get camera() { return this.presentCamera.inspect(); }
  get available() { return this.voxel.available; }
  get error() { return this.voxel.error; }
  get destroyed() { return this.voxel.destroyed; }
  get contextLost() { return this.voxel.contextLost; }
  get worldLabels() { return this.voxel.worldLabels; }
  get locomotionActors() { return this.voxel.locomotionActors; }
  get stats() { return Object.freeze({ ...this.voxel.stats, thirdPerson: true, ninjaSkins: true, camera: this.camera, shinobiEffects: this.presentEffects.inspect() }); }
  get diagnostics() { return this.stats; }
}
