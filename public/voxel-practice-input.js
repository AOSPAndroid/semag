/** Native action edges wait for the next 120 Hz step; presentation stays read only. */
export const PRACTICE_EDGE_ACTIONS = Object.freeze(['fire', 'jump', 'reload', 'interact', 'swap', 'grenade', 'heal']);

export function createPracticeInputQueue() {
  const pending = new Map(), sampled = new Map(), blocked = new Set();
  let prime = false;
  return Object.freeze({
    press(action) {
      if (PRACTICE_EDGE_ACTIONS.includes(action) && !blocked.has(action)) pending.set(action, Math.min(8, (pending.get(action) || 0) + 1));
    },
    release(action) { blocked.delete(action); },
    reset({ held = {}, neutral = false } = {}) {
      pending.clear(); sampled.clear(); blocked.clear(); prime = neutral;
      for (const action of PRACTICE_EDGE_ACTIONS) if (held[action] === true) blocked.add(action);
    },
    preview(input) {
      const output = { ...input };
      for (const action of PRACTICE_EDGE_ACTIONS) if (prime || blocked.has(action)) output[action] = false;
      return output;
    },
    sample(input) {
      const output = { ...input };
      for (const action of PRACTICE_EDGE_ACTIONS) {
        if (blocked.has(action) && input[action] !== true) blocked.delete(action);
        const count = pending.get(action) || 0;
        if (prime || blocked.has(action)) output[action] = false;
        else if (count > 0) {
          // A release tick separates presses that both arrived between frames.
          output[action] = sampled.get(action) !== true;
          if (output[action]) pending.set(action, count - 1);
        }
        sampled.set(action, output[action] === true);
      }
      prime = false;
      return output;
    },
    inspect() { return Object.fromEntries(PRACTICE_EDGE_ACTIONS.map(action => [action, pending.get(action) || 0])); },
  });
}
