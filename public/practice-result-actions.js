/** Keep a finishing attack from becoming a results-screen activation. */
export function createResultActionGate({ cooldownMs = 900, quietMs = 250 } = {}) {
  const held = new Set();
  let readyAt = null, lastActivityAt = 0, armed = false;
  function isReady(now) {
    if (readyAt === null) return false;
    if (!armed && held.size === 0 && now >= Math.max(readyAt, lastActivityAt + quietMs)) armed = true;
    return armed;
  }
  return {
    begin(now) { readyAt = now + cooldownMs; lastActivityAt = now; armed = false; },
    cancel() { readyAt = null; armed = false; },
    press(token, now) { held.add(token); if (readyAt !== null && !armed) lastActivityAt = now; },
    release(token, now) { if (held.delete(token) && readyAt !== null && !armed) lastActivityAt = now; },
    clearHeld() { held.clear(); },
    waitingForRelease() { return readyAt !== null && !armed && held.size > 0; },
    isReady,
    nextDelay(now) {
      if (readyAt === null || isReady(now) || held.size) return null;
      return Math.max(1, Math.ceil(Math.max(readyAt, lastActivityAt + quietMs) - now));
    },
  };
}
