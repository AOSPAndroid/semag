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
