/** Native action edges wait for the next 120 Hz step; presentation stays read only. */
export const PRACTICE_EDGE_ACTIONS = Object.freeze(['slot1', 'slot2', 'slot3', 'slot4', 'drop', 'fire', 'aim', 'jump', 'reload', 'interact', 'swap', 'grenade', 'heal']);

export function createPracticeInputQueue({ extraActions = [] } = {}) {
  const edgeActions = [...new Set([...PRACTICE_EDGE_ACTIONS, ...extraActions.filter(action => typeof action === 'string' && /^dojo[A-Z]\w*$/.test(action))])];
  const pending = new Map(), pendingTokens = new Map(), sampled = new Map(), blocked = new Set();
  let prime = false;
  const select = (input = {}) => {
    const output = { ...input };
    for (const action of edgeActions) {
      if (prime || blocked.has(action) && input[action] === true) output[action] = false;
      else if ((pending.get(action) || 0) > 0) output[action] = sampled.get(action) !== true;
    }
    const aimPress = output.aim === true && (pending.get('aim') || 0) > 0 ? pendingTokens.get('aim')?.[0] : null;
    if (Number.isFinite(aimPress?.yaw)) output.yaw = aimPress.yaw;
    if (Number.isFinite(aimPress?.pitch)) output.pitch = aimPress.pitch;
    return output;
  };
  return Object.freeze({
    press(action, input = {}) {
      const count = pending.get(action) || 0;
      if (!edgeActions.includes(action) || blocked.has(action) || count >= 8) return null;
      if (['slot1', 'slot2', 'slot3', 'slot4', 'drop', 'swap'].includes(action)) {
        pending.delete('aim'); pendingTokens.delete('aim');
        if (input.aim === true) blocked.add('aim');
      }
      const token = Object.freeze({ action, ...(action === 'aim' && Number.isFinite(input.yaw) ? { yaw: input.yaw } : {}), ...(action === 'aim' && Number.isFinite(input.pitch) ? { pitch: input.pitch } : {}) });
      if (!pendingTokens.has(action)) pendingTokens.set(action, []);
      pendingTokens.get(action).push(token); pending.set(action, count + 1);
      return token;
    },
    // A cancelled contact can withdraw only its own unconsumed commitment.
    cancel(token) {
      const tokens = pendingTokens.get(token?.action), index = tokens?.indexOf(token) ?? -1;
      if (index < 0) return false;
      tokens.splice(index, 1); pending.set(token.action, (pending.get(token.action) || 0) - 1);
      if (!tokens.length) pendingTokens.delete(token.action);
      return true;
    },
    release(action) { blocked.delete(action); },
    reset({ held = {}, neutral = false } = {}) {
      pending.clear(); pendingTokens.clear(); sampled.clear(); blocked.clear(); prime = neutral;
      for (const action of edgeActions) if (held[action] === true) blocked.add(action);
    },
    // The displayed next step uses the exact pending press or release fence,
    // without consuming counts, changing sampled holds or clearing a reset gate.
    preview: select,
    sample(input = {}) {
      const output = select(input);
      for (const action of edgeActions) {
        if (blocked.has(action) && input[action] !== true) blocked.delete(action);
        const count = pending.get(action) || 0;
        if (count > 0 && output[action] === true) {
          pending.set(action, count - 1);
          const tokens = pendingTokens.get(action); tokens.shift();
          if (!tokens.length) pendingTokens.delete(action);
        }
        sampled.set(action, output[action] === true);
      }
      prime = false;
      return output;
    },
    inspect() { return Object.fromEntries(edgeActions.map(action => [action, pending.get(action) || 0])); },
  });
}
