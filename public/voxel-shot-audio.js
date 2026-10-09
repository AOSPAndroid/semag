/** Short, cached mono reports: a dry crack, a low body, then a quiet action and tail. */
export const VOXEL_SHOT_AUDIO = Object.freeze(Object.fromEntries(Object.entries({
  carbine: { duration: .30, crack: .70, crackDecay: .0065, body: .27, frequency: 105, bodyDecay: .035, report: .27, reportDecay: .050, brightness: 2600, mechanism: .040, click: .065 },
  smg: { duration: .19, crack: .58, crackDecay: .0045, body: .19, frequency: 145, bodyDecay: .020, report: .20, reportDecay: .032, brightness: 3600, mechanism: .024, click: .050 },
  marksman: { duration: .40, crack: .75, crackDecay: .0080, body: .34, frequency: 78, bodyDecay: .048, report: .29, reportDecay: .070, brightness: 2100, mechanism: .063, click: .078 },
  pistol: { duration: .25, crack: .66, crackDecay: .0048, body: .23, frequency: 132, bodyDecay: .026, report: .22, reportDecay: .043, brightness: 3300, mechanism: .034, click: .082 },
  shotgun: { duration: .45, crack: .77, crackDecay: .0120, body: .40, frequency: 64, bodyDecay: .059, report: .35, reportDecay: .082, brightness: 1600, mechanism: .085, click: .074 },
  burst: { duration: .26, crack: .64, crackDecay: .0057, body: .25, frequency: 116, bodyDecay: .031, report: .24, reportDecay: .046, brightness: 2800, mechanism: .035, click: .060 },
  sniper: { duration: .58, crack: .81, crackDecay: .0100, body: .43, frequency: 52, bodyDecay: .078, report: .36, reportDecay: .105, brightness: 1850, mechanism: .105, click: .075 },
  lmg: { duration: .34, crack: .73, crackDecay: .0080, body: .32, frequency: 85, bodyDecay: .043, report: .31, reportDecay: .059, brightness: 2250, mechanism: .049, click: .085 },
  crossbow: { duration: .30, string: true, crack: .13, crackDecay: .0025, body: .14, frequency: 186, bodyDecay: .041, report: .075, reportDecay: .037, brightness: 1400, mechanism: .021, click: .035 },
  revolver: { duration: .36, crack: .75, crackDecay: .0068, body: .33, frequency: 92, bodyDecay: .040, report: .28, reportDecay: .062, brightness: 2750, mechanism: .057, click: .095 },
  pdw: { duration: .16, crack: .24, crackDecay: .0027, body: .11, frequency: 176, bodyDecay: .016, report: .09, reportDecay: .024, brightness: 1700, mechanism: .021, click: .062 },
  autoshotgun: { duration: .38, crack: .72, crackDecay: .0100, body: .35, frequency: 73, bodyDecay: .046, report: .30, reportDecay: .066, brightness: 1800, mechanism: .060, click: .090 },
  battlerifle: { duration: .37, crack: .76, crackDecay: .0087, body: .35, frequency: 82, bodyDecay: .046, report: .30, reportDecay: .065, brightness: 2300, mechanism: .052, click: .080 },
  dualpistols: { duration: .23, crack: .65, crackDecay: .0042, body: .215, frequency: 139, bodyDecay: .023, report: .205, reportDecay: .038, brightness: 3500, mechanism: .029, click: .077 },
  dualsmg: { duration: .17, crack: .57, crackDecay: .0038, body: .175, frequency: 157, bodyDecay: .018, report: .18, reportDecay: .028, brightness: 3800, mechanism: .020, click: .053 },
  slugshotgun: { duration: .49, crack: .79, crackDecay: .0114, body: .42, frequency: 58, bodyDecay: .066, report: .34, reportDecay: .088, brightness: 1720, mechanism: .091, click: .089 },
}).map(([id, profile]) => [id, Object.freeze(profile)])));

/** No live DSP or repeated noise allocation is needed once a weapon buffer is cached. */
export function createVoxelShotSamples(weaponId, sampleRate = 48000) {
  if (typeof weaponId !== 'string') return null;
  const profile = Object.hasOwn(VOXEL_SHOT_AUDIO, weaponId) ? VOXEL_SHOT_AUDIO[weaponId] : null;
  if (!profile || !Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000) return null;
  const length = Math.ceil(sampleRate * profile.duration), samples = new Float32Array(length);
  let seed = 0x6d2b79f5;
  for (let index = 0; index < weaponId.length; index++) seed = Math.imul(seed ^ weaponId.charCodeAt(index), 16777619);
  let low = 0, bass = 0, phase = 0;
  const alpha = 1 - Math.exp(-2 * Math.PI * profile.brightness / sampleRate);
  const bassAlpha = 1 - Math.exp(-2 * Math.PI * 180 / sampleRate);
  for (let index = 0; index < length; index++) {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    const white = (seed >>> 0) / 2147483648 - 1, time = index / sampleRate;
    low += alpha * (white - low); bass += bassAlpha * (white - bass);
    const crack = (white - low) * profile.crack * Math.exp(-time / profile.crackDecay);
    const bodyEnvelope = Math.exp(-time / profile.bodyDecay);
    phase += 2 * Math.PI * profile.frequency * (1 + (profile.string ? 0 : .62 * Math.exp(-time / .012))) / sampleRate;
    const body = profile.string
      ? (Math.sin(phase) + .30 * Math.sin(phase * 2.01) + .13 * Math.sin(phase * 3.97)) * profile.body * bodyEnvelope
      : (Math.sin(phase) * .72 + bass * 1.8) * profile.body * bodyEnvelope;
    const report = (low - bass + bass * .35) * profile.report * Math.exp(-time / profile.reportDecay);
    const actionTime = time - profile.mechanism;
    const mechanism = actionTime >= 0
      ? ((white - low) * .8 + Math.sin(actionTime * 2 * Math.PI * (profile.string ? 680 : 1730)) * .2) * profile.click * Math.exp(-actionTime / .008)
      : 0;
    // A tiny fade at the end prevents a discontinuity, even at unusual sample rates.
    const fade = Math.min(1, (length - index - 1) / (sampleRate * .006));
    const value = (crack + body + report + mechanism) * fade;
    samples[index] = value / (1 + Math.abs(value) * .65);
  }
  return samples;
}

const RELOAD_PHASES = Object.freeze({ remove: [ .095, 430, .28 ], insert: [ .13, 290, .42 ], seat: [ .075, 205, .36 ], bolt: [ .16, 650, .38 ], open: [ .10, 560, .26 ], close: [ .08, 380, .36 ], eject: [ .14, 780, .25 ], load: [ .12, 325, .29 ], pump: [ .18, 470, .36 ], draw: [ .20, 230, .22 ], place: [ .09, 510, .20 ], shell1: [ .08, 420, .27 ], shell2: [ .08, 420, .27 ], shell3: [ .08, 420, .27 ] });

/** Dry magazine, cylinder, shell and string mechanisms: one short cached source. */
export function createVoxelReloadSamples(weaponId, phase, sampleRate = 48000) {
  const profile = typeof phase === 'string' && Object.hasOwn(RELOAD_PHASES, phase) ? RELOAD_PHASES[phase] : null;
  if (!profile || typeof weaponId !== 'string' || !Object.hasOwn(VOXEL_SHOT_AUDIO, weaponId) || !Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000) return null;
  const [duration, frequency, level] = profile, samples = new Float32Array(Math.ceil(sampleRate * duration));
  const string = weaponId === 'crossbow', heavy = weaponId === 'lmg', pitch = frequency * (heavy ? .76 : string ? .66 : 1);
  let seed = 173 + weaponId.length * 971 + phase.length * 43, low = 0;
  const alpha = 1 - Math.exp(-2 * Math.PI * (string ? 1100 : 2600) / sampleRate);
  for (let index = 1; index < samples.length - 1; index++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const white = seed / 2147483648 - 1, time = index / sampleRate, progress = index / (samples.length - 1);
    low += alpha * (white - low);
    const click = Math.exp(-time / .016) + (phase === 'bolt' || phase === 'pump' ? .65 * Math.exp(-Math.max(0, time - .055) / .013) * (time >= .055 ? 1 : 0) : 0);
    const rub = Math.sin(Math.PI * progress) ** 2 * .24;
    const ring = Math.sin(time * Math.PI * 2 * pitch) * Math.exp(-time / (string ? .045 : .022));
    const fade = Math.min(1, time / .002, (samples.length - index - 1) / (sampleRate * .006));
    samples[index] = ((white - low) * click * .38 + low * rub + ring * .35) * level * fade;
  }
  return samples;
}

/** Accepted hits are short physical contacts; the headshot has a brighter dry tick. */
export function createVoxelImpactSamples(kind, sampleRate = 48000) {
  if (!['body', 'headshot'].includes(kind) || !Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000) return null;
  const head = kind === 'headshot', samples = new Float32Array(Math.ceil(sampleRate * (head ? .11 : .095)));
  let seed = head ? 8731 : 3127, low = 0;
  const alpha = 1 - Math.exp(-2 * Math.PI * (head ? 1700 : 950) / sampleRate);
  for (let index = 1; index < samples.length - 1; index++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const white = seed / 2147483648 - 1, time = index / sampleRate;
    low += alpha * (white - low);
    const contact = (low * .65 + (white - low) * (head ? .20 : .08)) * Math.exp(-time / .018);
    const body = Math.sin(time * Math.PI * 2 * (head ? 118 : 76)) * Math.exp(-time / .023) * .34;
    const tick = head ? (Math.sin(time * Math.PI * 2 * 790) + .3 * Math.sin(time * Math.PI * 2 * 1370)) * Math.exp(-time / .009) * .12 : 0;
    const fade = Math.min(1, time / .001, (samples.length - index - 1) / (sampleRate * .006));
    samples[index] = (contact + body + tick) * .42 * fade;
  }
  return samples;
}

/** Quiet committed swings: the sweep peaks around the blade's active phase. */
export const VOXEL_MELEE_AUDIO = Object.freeze(Object.fromEntries(Object.entries({
  knife: { duration: .22, peak: .102, width: .037, brightness: 3500, air: .27, body: .035, frequency: 230 },
  sword: { duration: .34, peak: .180, width: .056, brightness: 2600, air: .36, body: .055, frequency: 170 },
  katana: { duration: .28, peak: .134, width: .046, brightness: 4600, air: .37, body: .036, frequency: 280 },
  axe: { duration: .43, peak: .278, width: .064, brightness: 1700, air: .34, body: .10, frequency: 103 },
  tonfas: { duration: .19, peak: .082, width: .032, brightness: 1150, air: .27, body: .075, frequency: 330 },
}).map(([id, profile]) => [id, Object.freeze(profile)])));

/** One bounded deterministic sample buffer is cached per melee weapon. */
export function createVoxelMeleeSamples(weaponId, sampleRate = 48000) {
  const profile = typeof weaponId === 'string' && Object.hasOwn(VOXEL_MELEE_AUDIO, weaponId) ? VOXEL_MELEE_AUDIO[weaponId] : null;
  if (!profile || !Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000) return null;
  const length = Math.ceil(sampleRate * profile.duration), samples = new Float32Array(length);
  let seed = 0x9e3779b9, low = 0, slow = 0;
  for (let index = 0; index < weaponId.length; index++) seed = Math.imul(seed ^ weaponId.charCodeAt(index), 16777619);
  const alpha = 1 - Math.exp(-2 * Math.PI * profile.brightness / sampleRate), slowAlpha = 1 - Math.exp(-2 * Math.PI * 160 / sampleRate);
  for (let index = 0; index < length; index++) {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    const white = (seed >>> 0) / 2147483648 - 1, time = index / sampleRate;
    low += alpha * (white - low); slow += slowAlpha * (white - slow);
    const envelope = Math.exp(-(((time - profile.peak) / profile.width) ** 2)) * Math.min(1, time / .008, (length - index - 1) / (sampleRate * .009));
    const sweep = (low - slow) * profile.air + Math.sin(time * 2 * Math.PI * profile.frequency) * profile.body;
    samples[index] = sweep * envelope || 0;
  }
  return samples;
}
