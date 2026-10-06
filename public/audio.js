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
  }

  async setEnabled(enabled) {
    const version = ++this.toggleVersion;
    this.enabled = false;
    if (this.master && this.context?.state === 'running') this.master.gain.setTargetAtTime(0, this.context.currentTime, 0.015);
    if (!enabled || this.destroyed) return false;
    try {
      const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AudioContext) return false;
      if (!this.context || this.context.state === 'closed') {
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

  playEvents(events = []) {
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
        }
      } catch {
        // Sound support must never interrupt input or the simulation.
      }
    }
  }

  resetEvents() {
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
    try {
      if (this.context && this.context.state !== 'closed') this.context.close().catch(() => {});
    } catch { /* A detached or unsupported context may already be unavailable. */ }
    this.context = null;
    this.master = null;
  }
}
