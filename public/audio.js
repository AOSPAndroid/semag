import { createVoxelShotSamples, createVoxelMeleeSamples, createVoxelReloadSamples, createVoxelImpactSamples } from './voxel-shot-audio.js';
import { PARRY_PROFILES } from './voxel-melee.js';

const MAX_GUNSHOT_VOICES = 24;

/** A short metal contact, cached once and played only for an accepted parry. */
export function createVoxelParrySamples(sampleRate = 48000) {
  if (!Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000) return null;
  const samples = new Float32Array(Math.ceil(sampleRate * .14));
  let seed = 419;
  for (let index = 1; index < samples.length - 1; index++) {
    const time = index / sampleRate, progress = index / (samples.length - 1);
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const contact = Math.sin(time * Math.PI * 2 * 1260) + .43 * Math.sin(time * Math.PI * 2 * 2130) + .26 * Math.sin(time * Math.PI * 2 * 3370);
    const transient = (seed / 2147483648 - 1) * .24 * Math.exp(-time * 180);
    const envelope = Math.min(1, time / .0015) * Math.exp(-time * 35) * (1 - progress) ** 2;
    samples[index] = (contact + transient) * envelope * .2;
  }
  return samples;
}

// Small cached creature tells use the same voice budget as firearm reports.
export const VOXEL_MONSTER_AUDIO = Object.freeze({
  hound: Object.freeze({ duration: .22, low: 138, high: 72, rasp: .28, seed: 71 }),
  leaper: Object.freeze({ duration: .4, low: 84, high: 194, rasp: .18, seed: 193 }),
  screechWindup: Object.freeze({ duration: .58, low: 210, high: 540, rasp: .12, seed: 389 }),
  screechRelease: Object.freeze({ duration: .28, low: 570, high: 240, rasp: .2, seed: 563 }),
});

/** Quiet deterministic growls and rasps, without downloads or per-frame synthesis. */
export function createVoxelMonsterSamples(id, sampleRate = 48000) {
  if (typeof id !== 'string' || !Object.hasOwn(VOXEL_MONSTER_AUDIO, id) || !Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000) return null;
  const profile = VOXEL_MONSTER_AUDIO[id], samples = new Float32Array(Math.ceil(sampleRate * profile.duration));
  let seed = profile.seed, phase = 0, filtered = 0;
  for (let index = 1; index < samples.length - 1; index++) {
    const progress = index / (samples.length - 1), time = index / sampleRate;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    filtered += ((seed / 2147483648 - 1) - filtered) * .08;
    const frequency = profile.low + (profile.high - profile.low) * progress;
    phase += Math.PI * 2 * frequency / sampleRate;
    const throat = Math.sin(phase) * .65 + Math.sin(phase * 2) * .19 + Math.sin(phase * 3.01) * .08;
    const pulse = id === 'hound' ? .65 + .35 * Math.cos(time * Math.PI * 18) : .84 + .16 * Math.sin(time * Math.PI * 32);
    const envelope = Math.sin(Math.PI * progress) ** 1.65;
    samples[index] = (throat * (1 - profile.rasp) + filtered * profile.rasp) * pulse * envelope * .26;
  }
  return samples;
}

/** Procedural sound; AudioContext is only created by an explicit sound toggle. */
export class GameAudio {
  constructor() {
    this.enabled = false;
    this.context = null;
    this.master = null;
    this.seen = new Set();
    this.seenOrder = [];
    this.lastCountdown = null;
    this.destroyed = false;
    this.toggleVersion = 0;
    this.gunshotBuffers = new Map();
    this.meleeBuffers = new Map();
    this.monsterBuffers = new Map();
    this.reloadBuffers = new Map();
    this.impactBuffers = new Map();
    this.gunshotVoices = new Set();
    this.gunshotVariation = 0;
    this.gunshotReports = 0;
    this.meleeReports = 0;
    this.monsterReports = 0;
    this.reloadReports = 0;
    this.impactReports = 0;
    this.parryReports = 0;
  }

  async setEnabled(enabled) {
    const version = ++this.toggleVersion;
    this.enabled = false;
    this.stopGunshots();
    if (this.master && this.context?.state === 'running') this.master.gain.setTargetAtTime(0, this.context.currentTime, 0.015);
    if (!enabled || this.destroyed) return false;
    try {
      const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AudioContext) return false;
      if (!this.context || this.context.state === 'closed') {
        this.gunshotBuffers.clear();
        this.meleeBuffers.clear();
        this.monsterBuffers.clear();
        this.reloadBuffers.clear();
        this.impactBuffers.clear();
        this.context = new AudioContext({ latencyHint: 'interactive' });
        const compressor = this.context.createDynamicsCompressor();
        compressor.threshold.value = -20;
        compressor.knee.value = 15;
        compressor.ratio.value = 5;
        this.master = this.context.createGain();
        this.master.gain.value = 0.27;
        this.master.connect(compressor);
        compressor.connect(this.context.destination);
      }
      if (this.context.state === 'suspended') await this.context.resume();
      if (version !== this.toggleVersion || this.destroyed) return false;
      this.enabled = this.context.state === 'running';
      if (this.enabled) this.master.gain.setTargetAtTime(0.27, this.context.currentTime, 0.015);
    } catch {
      this.enabled = false;
    }
    return this.enabled;
  }

  /** Exactly one cached source per shell; quiet remote reports use the same timbre. */
  gunshot(weaponId, { gain = 1 } = {}) {
    return this.playVoxelReport(weaponId, { gain });
  }

  /** A confirmed swing has its own short whoosh and shares the bounded voice pool. */
  meleeSwing(weaponId, { gain = 1 } = {}) {
    return this.playVoxelReport(weaponId, { gain, melee: true });
  }

  meleeParry(weaponId, { gain = .52 } = {}) {
    if (typeof weaponId !== 'string' || !Object.hasOwn(PARRY_PROFILES, weaponId)) return false;
    return this.playVoxelReport('parry', { gain, parry: true });
  }

  monsterTell(id, { gain = 1, playerId = null } = {}) {
    return this.playVoxelReport(id, { gain, monster: true, playerId });
  }

  reloadAction(weaponId, phase, { gain = .58 } = {}) {
    return this.playVoxelReport(weaponId, { gain, reload: true, phase });
  }

  confirmedImpact(kind, { gain = .68 } = {}) {
    return this.playVoxelReport(kind, { gain, impact: true });
  }

  playVoxelReport(weaponId, { gain = 1, melee = false, parry = false, monster = false, reload = false, impact = false, phase = null, playerId = null } = {}) {
    if (!this.enabled || this.destroyed || this.context?.state !== 'running' || !Number.isFinite(gain) || gain <= 0) return false;
    let source, envelope, voice;
    try {
      const buffers = reload ? this.reloadBuffers : impact ? this.impactBuffers : monster ? this.monsterBuffers : melee || parry ? this.meleeBuffers : this.gunshotBuffers;
      const bufferKey = parry ? 'parry' : reload ? `${weaponId}:${phase}` : weaponId;
      let buffer = buffers.get(bufferKey);
      if (!buffer) {
        const samples = reload ? createVoxelReloadSamples(weaponId, phase, this.context.sampleRate) : impact ? createVoxelImpactSamples(weaponId, this.context.sampleRate) : monster ? createVoxelMonsterSamples(weaponId, this.context.sampleRate) : parry ? createVoxelParrySamples(this.context.sampleRate) : melee ? createVoxelMeleeSamples(weaponId, this.context.sampleRate) : createVoxelShotSamples(weaponId, this.context.sampleRate);
        if (!samples) return false;
        buffer = this.context.createBuffer(1, samples.length, this.context.sampleRate);
        buffer.getChannelData(0).set(samples);
        buffers.set(bufferKey, buffer);
      }
      while (this.gunshotVoices.size >= MAX_GUNSHOT_VOICES) this.endGunshot(this.gunshotVoices.values().next().value, true);
      source = this.context.createBufferSource(); envelope = this.context.createGain();
      source.buffer = buffer;
      // Small, repeatable pitch variation avoids identical machine-gun transients.
      source.playbackRate.value = [.994, 1.008, .985, 1.003, 1.014, .999][this.gunshotVariation++ % 6];
      envelope.gain.value = Math.min(1, gain);
      source.connect(envelope); envelope.connect(this.master);
      voice = { source, envelope, ended: false, reload, monsterKey: monster ? weaponId : null, monsterPlayerId: monster ? playerId : null };
      this.gunshotVoices.add(voice);
      source.onended = () => this.endGunshot(voice);
      source.start(this.context.currentTime);
      // Buffer expiry ends the source naturally; this fence also bounds faulty contexts.
      source.stop(this.context.currentTime + buffer.duration / source.playbackRate.value + .02);
      if (reload) this.reloadReports += 1; else if (impact) this.impactReports += 1; else if (monster) this.monsterReports += 1; else if (parry) this.parryReports += 1; else if (melee) this.meleeReports += 1; else this.gunshotReports += 1;
      return true;
    } catch {
      if (voice) this.endGunshot(voice, true);
      else { try { source?.disconnect(); envelope?.disconnect(); } catch {} }
      return false;
    }
  }

  endGunshot(voice, stop = false) {
    if (!voice || voice.ended) return;
    voice.ended = true; this.gunshotVoices.delete(voice);
    voice.source.onended = null;
    if (stop) try { voice.source.stop(); } catch {}
    try { voice.source.disconnect(); voice.envelope.disconnect(); } catch {}
  }

  stopGunshots() {
    for (const voice of this.gunshotVoices) this.endGunshot(voice, true);
  }

  stopReloads() {
    for (const voice of this.gunshotVoices) if (voice.reload) this.endGunshot(voice, true);
  }

  inspectReloads() { return Object.freeze({ enabled: this.enabled, cachedBuffers: this.reloadBuffers.size, activeVoices: [...this.gunshotVoices].filter(voice => voice.reload).length, maxVoices: MAX_GUNSHOT_VOICES, played: this.reloadReports }); }
  inspectImpacts() { return Object.freeze({ enabled: this.enabled, cachedBuffers: this.impactBuffers.size, maxVoices: MAX_GUNSHOT_VOICES, played: this.impactReports }); }
  inspectParries() { return Object.freeze({ enabled: this.enabled, cachedBuffers: this.meleeBuffers.has('parry') ? 1 : 0, maxVoices: MAX_GUNSHOT_VOICES, played: this.parryReports }); }

  stopMonsterTells(playerId, windupOnly = false) {
    if (!Number.isInteger(playerId)) return;
    for (const voice of this.gunshotVoices) if (voice.monsterKey && voice.monsterPlayerId === playerId && (!windupOnly || voice.monsterKey === 'screechWindup')) this.endGunshot(voice, true);
  }

  inspectGunshots() {
    return Object.freeze({ enabled: this.enabled, cachedBuffers: this.gunshotBuffers.size, activeVoices: this.gunshotVoices.size, maxVoices: MAX_GUNSHOT_VOICES, played: this.gunshotReports });
  }

  inspectMelee() {
    return Object.freeze({ enabled: this.enabled, cachedBuffers: this.meleeBuffers.size, activeVoices: this.gunshotVoices.size, maxVoices: MAX_GUNSHOT_VOICES, played: this.meleeReports });
  }

  inspectMonsters() {
    return Object.freeze({ enabled: this.enabled, cachedBuffers: this.monsterBuffers.size, activeVoices: this.gunshotVoices.size, maxVoices: MAX_GUNSHOT_VOICES, played: this.monsterReports });
  }

  // Each voice ends and disconnects itself, keeping long sessions bounded.
  tone(frequency, duration, { type = 'sine', end = frequency, gain = 0.3, delay = 0 } = {}) {
    if (!this.enabled || this.context?.state !== 'running') return;
    const start = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(1, frequency), start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, end), start + duration);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), start + 0.006);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope);
    envelope.connect(this.master);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
    oscillator.start(start);
    oscillator.stop(start + duration + 0.01);
  }

  noise(duration, { highpass = 500, lowpass = 6000, gain = 0.2, delay = 0 } = {}) {
    if (!this.enabled || this.context?.state !== 'running') return;
    const start = this.context.currentTime + delay;
    const length = Math.max(1, Math.ceil(this.context.sampleRate * duration));
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    const high = this.context.createBiquadFilter();
    high.type = 'highpass'; high.frequency.value = highpass;
    const low = this.context.createBiquadFilter();
    low.type = 'lowpass'; low.frequency.value = lowpass;
    const envelope = this.context.createGain();
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), start + 0.004);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(high); high.connect(low); low.connect(envelope); envelope.connect(this.master);
    source.onended = () => { source.disconnect(); high.disconnect(); low.disconnect(); envelope.disconnect(); };
    source.start(start);
    source.stop(start + duration + 0.01);
  }

  playEvents(events = [], { gain = 1 } = {}) {
    for (const event of events) {
      if (event.id == null || this.seen.has(event.id)) continue;
      this.seen.add(event.id);
      this.seenOrder.push(event.id);
      if (this.seenOrder.length > 512) this.seen.delete(this.seenOrder.shift());
      // Mark muted events as seen so enabling sound never replays old impacts.
      if (!this.enabled) continue;
      try {
        switch (event.type) {
          case 'swing':
            this.noise(event.move === 'heavy' ? 0.16 : 0.095, { highpass: 950, lowpass: 5200, gain: 0.18 });
            this.tone(event.move === 'heavy' ? 230 : 390, 0.075, { end: 85, type: 'triangle', gain: 0.11 });
            break;
          case 'hit':
            this.noise(0.11, { highpass: 70, lowpass: 2100, gain: 0.55 });
            this.tone(event.move === 'heavy' ? 120 : 180, 0.16, { end: 42, type: 'triangle', gain: 0.7 });
            this.tone(790, 0.045, { end: 230, type: 'square', gain: 0.1 });
            break;
          case 'block':
            this.tone(480, 0.09, { end: 300, type: 'triangle', gain: 0.32 });
            this.noise(0.065, { highpass: 1200, lowpass: 7000, gain: 0.24 });
            break;
          case 'parry':
            this.tone(1320, 0.24, { gain: 0.33 });
            this.tone(1980, 0.2, { gain: 0.15, delay: 0.012 });
            this.noise(0.045, { highpass: 2300, gain: 0.3 });
            break;
          case 'guardbreak':
            this.noise(0.3, { highpass: 350, lowpass: 3600, gain: 0.5 });
            this.tone(580, 0.34, { type: 'sawtooth', end: 75, gain: 0.28 });
            break;
          case 'dash':
            this.noise(0.15, { highpass: 450, lowpass: 2600, gain: 0.22 });
            break;
          case 'jump':
            this.tone(130, 0.09, { end: 280, type: 'triangle', gain: 0.13 });
            break;
          case 'land':
            this.noise(0.045, { highpass: 80, lowpass: 650, gain: 0.14 });
            break;
          case 'cancel':
            this.tone(720, 0.07, { end: 1000, gain: 0.1 });
            break;
          case 'round':
            this.lastCountdown = null;
            break;
          case 'fight':
            this.fight();
            break;
          case 'roundEnd':
            this.noise(0.27, { highpass: 35, lowpass: 1300, gain: 0.42 });
            this.tone(95, 0.6, { end: 36, type: 'triangle', gain: 0.6 });
            break;
          case 'matchEnd':
            [330, 440, 660].forEach((note, index) => this.tone(note, 0.35, { delay: index * 0.1, gain: 0.2 }));
            break;
          case 'hordeFight':
            this.lastCountdown = null;
            this.noise(0.18, { highpass: 55, lowpass: 750, gain: 0.22 });
            this.tone(92, 0.38, { end: 48, type: 'triangle', gain: 0.3 });
            this.tone(184, 0.13, { delay: 0.08, end: 120, gain: 0.12 });
            break;
          case 'hordeClear':
            [294, 392, 588].forEach((note, index) => this.tone(note, 0.24, { delay: index * 0.1, type: 'triangle', gain: 0.18 }));
            break;
          case 'hordeRevive':
            this.tone(392, 0.14, { end: 588, type: 'triangle', gain: 0.2 });
            this.tone(784, 0.2, { delay: 0.12, gain: 0.12 });
            break;
          case 'hordeEnd':
            this.tone(146, 0.4, { end: 73, type: 'triangle', gain: 0.24 });
            this.tone(110, 0.48, { delay: 0.15, end: 55, type: 'triangle', gain: 0.16 });
            break;
          case 'monsterWindup':
            if (event.monsterType === 'hound') { this.monsterTell('hound', { gain, playerId: event.playerId }); break; }
            this.noise(0.12, { highpass: 65, lowpass: 950, gain: 0.12 });
            this.tone(event.monsterType === 'brute' ? 82 : 128, 0.16, { end: 48, type: 'sawtooth', gain: 0.06 });
            break;
          case 'monsterLungeWindup':
            if (event.monsterType === 'leaper') this.monsterTell('leaper', { gain, playerId: event.playerId });
            break;
          case 'monsterRoar':
            if (event.stage === 'windup') this.monsterTell('screechWindup', { gain, playerId: event.playerId });
            else if (event.stage === 'release') { this.stopMonsterTells(event.playerId, true); this.monsterTell('screechRelease', { gain, playerId: event.playerId }); }
            else if (event.stage === 'interrupted') this.stopMonsterTells(event.playerId, true);
            break;
          case 'kill':
          case 'elimination':
            this.stopMonsterTells(event.targetId);
            break;
          case 'monsterAim':
            this.tone(540, 0.11, { end: 810, type: 'triangle', gain: 0.1 });
            break;
        }
      } catch {
        // Sound support must never interrupt input or the simulation.
      }
    }
  }

  resetEvents() {
    this.stopGunshots();
    this.seen.clear();
    this.seenOrder.length = 0;
    this.lastCountdown = null;
  }

  countdown(number) {
    if (!Number.isFinite(number) || number <= 0 || this.lastCountdown === number) return;
    this.lastCountdown = number;
    try {
      this.tone(330 + (3 - Math.min(3, number)) * 110, 0.13, { type: 'triangle', gain: 0.36 });
      this.tone(110, 0.1, { gain: 0.2 });
    } catch { /* Optional audio. */ }
  }

  fight() {
    this.lastCountdown = null;
    try {
      this.tone(220, 0.21, { end: 440, type: 'triangle', gain: 0.35 });
      this.tone(660, 0.25, { delay: 0.07, gain: 0.25 });
      this.noise(0.18, { highpass: 700, gain: 0.18 });
    } catch { /* Optional audio. */ }
  }

  destroy() {
    this.enabled = false;
    this.destroyed = true;
    this.toggleVersion += 1;
    this.resetEvents();
    this.gunshotBuffers.clear();
    this.meleeBuffers.clear();
    this.monsterBuffers.clear();
    this.reloadBuffers.clear();
    this.impactBuffers.clear();
    try {
      if (this.context && this.context.state !== 'closed') this.context.close().catch(() => {});
    } catch { /* A detached or unsupported context may already be unavailable. */ }
    this.context = null;
    this.master = null;
  }
}
