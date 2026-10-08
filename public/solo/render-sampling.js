// Presentation samples sit between completed physics steps. No sampled pose
// is fed into movement, collisions, inputs, timers, scores, or saved records.
// Scratch records are reused by body identity; the renderer consumes each
// sample synchronously, so dense scenes do not allocate copies at display Hz.
const clamp = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 1));
const guards = ['phase', 'mode', 'type', 'owner', 'dead'];
const compile = (spec, identityGuard = false) => ({
  ...spec, identityGuard, fields: spec.fields || [], angles: spec.angles || [],
  numericKeys: [...(spec.fields || []), ...(spec.angles || [])],
  guardKeys: [...guards, ...(spec.guards || [])], limits: Object.entries(spec.limits || {}),
  snapshots: new WeakMap(), poses: new WeakMap(), previous: new Map(),
});

function captureBody(body, spec) {
  if (!body) return null;
  let sample = spec.snapshots.get(body);
  if (!sample) { sample = { body, values: {}, guard: [] }; spec.snapshots.set(body, sample); }
  for (let index = 0; index < spec.guardKeys.length; index++) sample.guard[index] = body[spec.guardKeys[index]];
  for (const key of spec.numericKeys) sample.values[key] = body[key];
  if (spec.velocityGuard) { sample.vx = body.vx; sample.vy = body.vy; }
  return sample;
}

function sampleBody(body, previous, spec, fraction) {
  if (!body || !previous || spec.identityGuard && body !== previous.body) return body;
  for (let index = 0; index < spec.guardKeys.length; index++)
    if (body[spec.guardKeys[index]] !== previous.guard[index]) return body;
  if (spec.velocityGuard && previous.vx * body.vx + previous.vy * body.vy < 0) return body;
  if (Number.isFinite(body.x) && Number.isFinite(body.y)
    && Math.hypot(body.x - previous.values.x, body.y - previous.values.y) > (spec.maxDistance ?? 64)) return body;
  for (const [key, limit] of spec.limits) if (Math.abs(body[key] - previous.values[key]) > limit) return body;
  let result = spec.poses.get(body);
  if (!result) { result = {}; spec.poses.set(body, result); }
  Object.assign(result, body);
  for (const key of spec.fields) {
    const before = previous.values[key], current = body[key];
    if (Number.isFinite(before) && Number.isFinite(current)) result[key] = before + (current - before) * fraction;
  }
  for (const key of spec.angles) {
    const before = previous.values[key], current = body[key];
    if (Number.isFinite(before) && Number.isFinite(current)) {
      const difference = Math.atan2(Math.sin(current - before), Math.cos(current - before));
      result[key] = before + difference * fraction;
    }
  }
  return result;
}

export function createRenderSampling({ fields = [], limits = {}, objects = {}, collections = {}, continuity = () => '' } = {}) {
  const rootSpec = compile({ fields, limits });
  const objectSpecs = Object.entries(objects).map(([key, spec]) => [key, compile(spec, true)]);
  const collectionSpecs = Object.entries(collections).map(([key, spec]) => [key, compile(spec), []]);
  let previous = null;
  const stats = { physicsSamples: 0, renderSamples: 0, interpolatedSamples: 0, lastFraction: 1 };
  return {
    capture(state) {
      stats.physicsSamples++;
      previous = { state, phase: state.phase, continuity: continuity(state), root: captureBody(state, rootSpec), objects: {} };
      for (const [key, spec] of objectSpecs) previous.objects[key] = captureBody(state[key], spec);
      for (const [key, spec] of collectionSpecs) {
        spec.previous.clear();
        for (const body of state[key] || []) spec.previous.set(body.id ?? body, captureBody(body, spec));
      }
    },
    sample(state, amount = 1) {
      const fraction = clamp(amount);
      stats.renderSamples++; stats.lastFraction = fraction;
      if (fraction === 1 || !previous || state.phase !== 'playing' || previous.state !== state
        || previous.phase !== state.phase || previous.continuity !== continuity(state)) return state;
      const result = sampleBody(state, previous.root, rootSpec, fraction);
      // A root teleport or discontinuity snaps the complete scene together.
      if (result === state) return state;
      stats.interpolatedSamples++;
      for (const [key, spec] of objectSpecs) result[key] = sampleBody(state[key], previous.objects[key], spec, fraction);
      for (const [key, spec, poses] of collectionSpecs) {
        poses.length = 0;
        for (const body of state[key] || []) poses.push(sampleBody(body, spec.previous.get(body.id ?? body), spec, fraction));
        result[key] = poses;
      }
      return result;
    },
    reset() { previous = null; },
    getStats() { return { ...stats }; },
  };
}
