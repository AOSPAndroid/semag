/** A short cosmetic tail never changes the accepted combat phase or its clock. */
export const END_PRESENTATION_RULES = Object.freeze({ durationMs: 1100, reducedDurationMs: 400 });

export function createEndPresentation() {
  let primed = false, contextKey = null, previousPhase = null, deadline = null, previousTime = null;
  const reset = () => { primed = false; contextKey = previousPhase = deadline = previousTime = null; };
  const empty = () => ({ holding: false, started: false, finished: false, remainingMs: 0 });
  function observe(phase, now, { contextKey: nextContext = null, eligible = true, reducedMotion = false } = {}) {
    if (!Number.isFinite(now)) { reset(); return empty(); }
    const terminal = phase === 'roundEnd' || phase === 'matchEnd';
    const fresh = !primed || !Object.is(contextKey, nextContext) || previousTime !== null && now < previousTime;
    const before = fresh ? null : previousPhase;
    if (fresh || !eligible || !terminal) deadline = null;
    primed = true; contextKey = nextContext; previousPhase = phase; previousTime = now;
    if (!eligible) { previousPhase = null; return empty(); }
    const started = terminal && before === 'fight';
    if (started) deadline = now + (reducedMotion ? END_PRESENTATION_RULES.reducedDurationMs : END_PRESENTATION_RULES.durationMs);
    const finished = deadline !== null && now >= deadline;
    if (finished) deadline = null;
    const remainingMs = deadline === null ? 0 : Math.max(0, deadline - now);
    return { holding: remainingMs > 0, started, finished, remainingMs };
  }
  return Object.freeze({ observe, reset, inspect: () => ({ primed, contextKey, previousPhase, deadline, previousTime }) });
}
