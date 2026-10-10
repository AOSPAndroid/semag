import { MONSTER_GAIT_CONTACT_PHASE } from './voxel-monster-animation.js';

const TAU = Math.PI * 2;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const phaseOf = phase => (phase % TAU + TAU) % TAU;
const MAX_ACTORS = 64, MAX_RECENT_REPORTS = 18, REPORT_WINDOW_MS = 1000;

export const VOXEL_FOOTSTEP_AUDIO = Object.freeze({
  boot: Object.freeze({ duration: .105, tone: 114, grain: .23, seed: 127, range: 22, gain: .42, intervalMs: 145 }),
  hound: Object.freeze({ duration: .072, tone: 174, grain: .38, seed: 619, range: 18, gain: .35, intervalMs: 100 }),
  brute: Object.freeze({ duration: .155, tone: 67, grain: .12, seed: 853, range: 26, gain: .56, intervalMs: 210 }),
  shamble: Object.freeze({ duration: .122, tone: 96, grain: .34, seed: 947, range: 21, gain: .39, intervalMs: 160 }),
});

/** One compact, deterministic contact buffer per body type; no per-frame synthesis. */
export function createVoxelFootstepSamples(type, sampleRate = 48000) {
  if (!Object.hasOwn(VOXEL_FOOTSTEP_AUDIO, type) || !Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000) return null;
  const profile = VOXEL_FOOTSTEP_AUDIO[type], samples = new Float32Array(Math.ceil(sampleRate * profile.duration));
  let seed = profile.seed, filtered = 0;
  for (let index = 1; index < samples.length - 1; index++) {
    const time = index / sampleRate, progress = index / (samples.length - 1);
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = seed / 2147483648 - 1;
    filtered += (noise - filtered) * .13;
    const contact = Math.sin(time * TAU * profile.tone * (1 - progress * .30)) * Math.exp(-time * 42);
    const grit = (filtered * .65 + noise * .35) * Math.exp(-time * (type === 'hound' ? 72 : 40));
    const envelope = Math.min(1, time / .002) * (1 - progress) ** 2;
    samples[index] = (contact * (1 - profile.grain) + grit * profile.grain) * envelope * .47;
  }
  return samples;
}

const soundType = actor => actor.monsterType === 'hound' ? 'hound' : actor.monsterType === 'brute' ? 'brute' : actor.monsterType ? 'shamble' : 'boot';
const validActor = actor => Number.isSafeInteger(actor?.id) && actor.id >= 0 && actor.alive === true && actor.paused !== true
  && [actor.x, actor.y, actor.z, actor.phase].every(Number.isFinite);

/**
 * Observe the renderer's exact gait, not raw network velocity or a second walking clock.
 * A contact is a rendered swing foot reaching the ground at PI/2 or 3PI/2.
 * Muted contacts remain consumed. Discontinuities and menus prime silently.
 */
export function createEnemyFootstepPresenter(audio, { maxActors = MAX_ACTORS } = {}) {
  const histories = new Map(), recentReports = [];
  const capacity = clamp(Number.isSafeInteger(maxActors) ? maxActors : MAX_ACTORS, 1, MAX_ACTORS);
  let contextKey, listenerKey, active = false, lastTime = null, reports = 0, lastContacts = [];
  function suspend() {
    histories.clear(); recentReports.length = 0; lastContacts = []; active = false; lastTime = null;
    try { audio?.stopFootsteps?.(); } catch { /* Optional sound never affects a frame. */ }
  }
  function reset() { suspend(); contextKey = listenerKey = undefined; reports = 0; }
  function observe(actors, { now, context = null, listener, yaw = listener?.yaw, active: enabled = true, freeForAll = false } = {}) {
    if (!enabled || !Number.isFinite(now) || listener?.alive === false || ![listener?.x, listener?.y, listener?.z, yaw].every(Number.isFinite)) { suspend(); return; }
    const nextListenerKey = `${listener.id}:${listener.lifeId ?? 0}:${listener.deaths ?? 0}`;
    if (contextKey !== context || listenerKey !== nextListenerKey || lastTime !== null && (now < lastTime || now - lastTime > 300)) suspend();
    contextKey = context; listenerKey = nextListenerKey; active = true; lastTime = now;
    while (recentReports.length && now - recentReports[0] >= REPORT_WINDOW_MS) recentReports.shift();
    const keep = new Set(), candidates = [];
    for (const actor of Array.isArray(actors) ? actors : []) {
      if (keep.size >= capacity) break;
      if (!validActor(actor) || actor.id === listener.id || !freeForAll && !actor.monsterType && actor.team === listener.team) continue;
      keep.add(actor.id);
      let history = histories.get(actor.id);
      const phase = phaseOf(actor.phase), elapsed = history ? now - history.time : 0;
      const distance = history ? Math.hypot(actor.x - history.x, actor.y - history.y, actor.z - history.z) : 0;
      const grounded = actor.grounded !== false && actor.airborne !== true;
      const sameLife = history && history.lifeId === actor.lifeId && history.deaths === actor.deaths && history.monsterType === actor.monsterType && history.actorContext === actor.contextKey;
      if (sameLife && elapsed === 0) continue;
      const discontinuity = !sameLife || elapsed < 0 || elapsed > 300 || distance > Math.max(.5, elapsed * .016);
      if (!history || discontinuity) {
        history = { phase, x: actor.x, y: actor.y, z: actor.z, time: now, grounded, lifeId: actor.lifeId, deaths: actor.deaths,
          monsterType: actor.monsterType, actorContext: actor.contextKey, lastContact: -Infinity };
        histories.set(actor.id, history);
        continue;
      }
      const advance = (phase - history.phase + TAU) % TAU;
      const offset = actor.monsterType ? MONSTER_GAIT_CONTACT_PHASE : Math.PI / 2;
      const fromContact = phaseOf(history.phase - offset) % Math.PI;
      const crossed = advance > 1e-8 && advance <= Math.PI && fromContact + advance >= Math.PI - 1e-8;
      const type = soundType(actor), profile = VOXEL_FOOTSTEP_AUDIO[type];
      const contact = crossed && grounded && history.grounded && distance > .00001 && actor.speed > .05 && actor.stride > .08
        && now - history.lastContact >= profile.intervalMs;
      Object.assign(history, { phase, x: actor.x, y: actor.y, z: actor.z, time: now, grounded });
      if (!contact) continue;
      history.lastContact = now;
      const dx = actor.x - listener.x, dy = actor.y - listener.y, dz = actor.z - listener.z;
      const rangeDistance = Math.hypot(dx, dy * 1.5, dz), attenuation = Math.max(0, 1 - rangeDistance / profile.range) ** 2;
      const quiet = actor.crouching ? .14 : actor.walking ? .12 : 1;
      const gain = profile.gain * attenuation * quiet * clamp(actor.stride, .2, 1) * (actor.sprinting ? 1.1 : 1);
      if (gain < .008) continue;
      const horizontal = Math.hypot(dx, dz), pan = horizontal > .001 ? clamp((Math.cos(yaw) * dx + Math.sin(yaw) * dz) / horizontal, -1, 1) * .86 : 0;
      candidates.push({ id: actor.id, type, distance: rangeDistance, gain, pan, time: now, phase, grounded, lifeId: actor.lifeId });
    }
    for (const id of histories.keys()) if (!keep.has(id)) histories.delete(id);
    candidates.sort((a, b) => b.gain - a.gain || a.id - b.id);
    const emitted = [];
    if (!audio?.enabled) return;
    for (const candidate of candidates.slice(0, 3)) {
      if (recentReports.length >= MAX_RECENT_REPORTS) break;
      try {
        if (audio.footstep?.(candidate.type, { gain: candidate.gain, pan: candidate.pan, playerId: candidate.id }) === true) {
          reports++; recentReports.push(now); emitted.push(Object.freeze(candidate));
        }
      } catch { /* An unavailable device cannot interrupt movement or other sounds. */ }
    }
    if (emitted.length) lastContacts = emitted;
  }
  return Object.freeze({ observe, suspend, reset, inspect: () => Object.freeze({ reports, trackedActors: histories.size, limit: capacity, active,
    recentReports: recentReports.length, maxReportsPerSecond: MAX_RECENT_REPORTS, lastContacts: Object.freeze([...lastContacts]) }) });
}
