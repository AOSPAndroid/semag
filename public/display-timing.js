// Rendering follows requestAnimationFrame; simulation keeps its own fixed step.
// These weights preserve the feel authored at 60 Hz on any display cadence.
const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const elapsedFrames = deltaMs => clamp(finite(deltaMs, 1000 / 60), 0, 100) * 60 / 1000;

export function frameAlpha(alphaAt60Hz, deltaMs = 1000 / 60) {
  const alpha = clamp(finite(alphaAt60Hz, 0), 0, 1);
  return 1 - Math.pow(1 - alpha, elapsedFrames(deltaMs));
}

export function frameDecay(retentionAt60Hz, deltaMs = 1000 / 60) {
  return Math.pow(clamp(finite(retentionAt60Hz, 1), 0, 1), elapsedFrames(deltaMs));
}

export function tickFraction(accumulatorSeconds, stepSeconds = 1 / 120) {
  const step = Number.isFinite(stepSeconds) && stepSeconds > 0 ? stepSeconds : 1 / 120;
  return clamp(finite(accumulatorSeconds, 0) / step, 0, 1);
}
