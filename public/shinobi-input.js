/** Native presses wait for fixed steps; rendering never consumes an action. */
export const SHINOBI_EDGE_ACTIONS = Object.freeze(['attack', 'heavy', 'throw', 'parry', 'dash', 'feint']);

/** Only genuine presses on the game surface arm mouse attack buttons. */
export function createShinobiMouseButtons() {
  let armed = 0;
  const mask = buttons => Number.isInteger(buttons) && buttons >= 0 ? buttons & 3 : 0;
  const read = () => ({ attack: Boolean(armed & 1), heavy: Boolean(armed & 2) });
  return Object.freeze({
    down(button, buttons) {
      const observed = mask(buttons), pressed = button === 0 ? 1 : button === 2 ? 2 : 0;
      // A newly pressed secondary button must never restore a primary button
      // that remained physically held across a focus or dialog reset.
      armed &= observed;
      if (observed & pressed) armed |= pressed;
      return read();
    },
    sync(buttons) { armed &= mask(buttons); return read(); },
    reset() { armed = 0; return read(); },
    read,
  });
}

function capturedAim(input) {
  if (!Number.isFinite(input?.aimX) || !Number.isFinite(input?.aimY)) return null;
  const length = Math.hypot(input.aimX, input.aimY);
  return length > .0001 && Number.isFinite(length)
    ? { aimX: input.aimX / length, aimY: input.aimY / length } : null;
}

/**
 * Count fresh logical presses, including taps released between display frames.
 * Call press/release after composing held keyboard, mouse and touch aliases.
 * sample belongs to physics; preview and inspect are read-only presentation.
 */
export function createShinobiInputQueue({ actions = SHINOBI_EDGE_ACTIONS } = {}) {
  const actionList = [...new Set(actions.filter(action => typeof action === 'string'))];
  const accepted = new Set(actionList), pending = [], sampled = new Map(), blocked = new Set();
  let prime = false;

  function preview(input = {}) {
    const output = { ...input };
    for (const action of actionList) {
      output[action] = !prime && !blocked.has(action) && input[action] === true;
    }
    return output;
  }

  return Object.freeze({
    press(action, aim = {}) {
      if (!accepted.has(action) || blocked.has(action) || pending.length >= 16) return false;
      pending.push({ action, aim: capturedAim(aim) });
      return true;
    },
    // A released short tap stays queued. Release only removes a lifecycle fence.
    release(action) { blocked.delete(action); },
    reset({ held = {}, neutral = false } = {}) {
      pending.length = 0; sampled.clear(); blocked.clear(); prime = neutral === true;
      for (const action of actionList) if (held[action] === true) blocked.add(action);
    },
    preview,
    sample(input = {}) {
      for (const action of actionList) if (blocked.has(action) && input[action] !== true) blocked.delete(action);
      const output = preview(input);
      if (!prime && pending.length) {
        // Raw holds keep already sampled actions down, but cannot bypass the
        // ordering or captured aim of a different queued commitment.
        for (const action of actionList) output[action] = !blocked.has(action) && sampled.get(action) === true && input[action] === true;
        const edge = pending[0];
        if (!blocked.has(edge.action)) {
          if (sampled.get(edge.action) === true) output[edge.action] = false;
          else {
            output[edge.action] = true; pending.shift();
            if (edge.aim) Object.assign(output, edge.aim);
          }
        }
      }
      for (const action of actionList) sampled.set(action, output[action] === true);
      prime = false;
      return output;
    },
    inspect() {
      return {
        pending: pending.map(edge => ({ action: edge.action, aim: edge.aim && { ...edge.aim } })),
        sampled: Object.fromEntries(actionList.map(action => [action, sampled.get(action) === true])),
        blocked: [...blocked], neutral: prime,
      };
    },
  });
}
