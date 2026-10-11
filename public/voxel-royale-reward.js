/** Royale's cosmetic finish follows the final death; simulation stays stopped. */
export const ROYALE_REWARD_RULES = Object.freeze({ victoryMs: 1850, reducedVictoryMs: 650, maxVoices: 6 });

const idle = stage => ({ stage, holding: false, visible: false, started: false, remainingMs: 0, progress: 0 });

export function createRoyaleRewardPresenter() {
  let context = null, previousTime = null, revealAt = null, finishAt = null, revealed = false, consumed = false;
  const reset = () => { context = previousTime = revealAt = finishAt = null; revealed = consumed = false; };
  function observe(phase, now, { contextKey = null, death = {}, won = false, eligible = true, reducedMotion = false } = {}) {
    if (!Number.isFinite(now)) { reset(); return idle(phase === 'matchEnd' ? 'results' : 'idle'); }
    const fresh = !Object.is(context, contextKey) || previousTime !== null && now < previousTime;
    if (fresh) { reset(); context = contextKey; }
    previousTime = now;
    if (phase !== 'matchEnd') { revealAt = finishAt = null; revealed = consumed = false; return idle('idle'); }
    if (!eligible) { revealAt = finishAt = null; revealed = false; consumed = true; return idle('results'); }
    if (death.started && won && !consumed) {
      revealAt = now + Math.max(0, death.remainingMs || 0);
      finishAt = revealAt + (reducedMotion ? ROYALE_REWARD_RULES.reducedVictoryMs : ROYALE_REWARD_RULES.victoryMs);
      revealed = false; consumed = true;
    }
    if (death.holding) return { ...idle('death'), holding: true, remainingMs: death.remainingMs };
    if (revealAt === null || !won) return idle('results');
    if (now >= finishAt) { revealAt = finishAt = null; return idle('results'); }
    const started = !revealed; revealed = true;
    return { stage: 'victory', holding: true, visible: true, started, remainingMs: finishAt - now, progress: Math.max(0, Math.min(1, (now - revealAt) / (finishAt - revealAt))) };
  }
  return Object.freeze({ observe, reset, inspect: () => ({ context, previousTime, revealAt, finishAt, revealed, consumed }) });
}

/** Ranks come from actual Royale eliminations, including battles lost early. */
export function royaleBattleResult(state, stats) {
  const opponents = Math.max(1, Math.min(10, Number(state?.practice?.config?.bots) || 1));
  const total = opponents + 1, won = stats?.result === 'won';
  const recorded = state?.placements?.find(entry => entry.playerId === 0)?.place;
  const remaining = Math.max(0, Math.min(opponents, Number(stats?.botsRemaining) || 0));
  const place = won ? 1 : Number.isInteger(recorded) && recorded >= 2 && recorded <= total ? recorded : Math.max(2, Math.min(total, remaining + 1));
  const outlasted = total - place;
  return Object.freeze({ won, place, total, outlasted, label: won ? 'LAST SURVIVOR' : place === 2 ? 'RUNNER-UP' : 'BATTLE COMPLETE', title: won ? 'Victory secured.' : place === 2 ? 'So close. Go again.' : 'Your next drop awaits.', copy: won ? `You outlasted all ${opponents} ${opponents === 1 ? 'rival' : 'rivals'}. The arena is yours.` : `${outlasted} ${outlasted === 1 ? 'rival' : 'rivals'} outlasted. A new route, a better pickup, another chance.` });
}

/** A quiet six-voice chiptune shares the sound toggle and can always be stopped. */
export function createRoyaleRewardAudio(audio) {
  const voices = new Set(); let played = 0, consumed = false;
  function stop() {
    for (const voice of voices) {
      voice.oscillator.onended = null;
      try { voice.oscillator.stop(); } catch {}
      try { voice.oscillator.disconnect(); voice.envelope.disconnect(); } catch {}
    }
    voices.clear();
  }
  function play() {
    if (!audio?.enabled || audio.destroyed || audio.context?.state !== 'running' || !audio.master) return false;
    const context = audio.context;
    const notes = [[392, 0, .21, .12], [494, .14, .21, .12], [587, .28, .22, .13], [784, .44, .42, .12], [988, .60, .45, .08], [196, .44, .66, .09]];
    try {
      for (const [frequency, delay, duration, gain] of notes) {
        const oscillator = context.createOscillator(), envelope = context.createGain(), start = context.currentTime + delay;
        const voice = { oscillator, envelope }; voices.add(voice);
        oscillator.type = 'triangle'; oscillator.frequency.setValueAtTime(frequency, start);
        envelope.gain.setValueAtTime(.0001, start); envelope.gain.exponentialRampToValueAtTime(gain, start + .009); envelope.gain.exponentialRampToValueAtTime(.0001, start + duration);
        oscillator.connect(envelope); envelope.connect(audio.master);
        oscillator.onended = () => { voices.delete(voice); oscillator.disconnect(); envelope.disconnect(); };
        oscillator.start(start); oscillator.stop(start + duration + .01);
      }
      played++; return true;
    } catch { stop(); return false; }
  }
  function observe(view, { eligible = true } = {}) {
    if (!eligible || !audio?.enabled || view?.stage !== 'victory') stop();
    if (view?.stage !== 'victory') { consumed = false; return false; }
    if (!view.started || consumed) return false;
    consumed = true;
    return eligible && play();
  }
  return Object.freeze({ observe, stop, reset: () => { stop(); consumed = false; }, destroy: stop, inspect: () => ({ activeVoices: voices.size, maxVoices: ROYALE_REWARD_RULES.maxVoices, played }) });
}
