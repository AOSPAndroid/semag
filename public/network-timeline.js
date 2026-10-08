const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = value => Number.isFinite(value);
const percentile = (values, amount) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * amount)];
};

/**
 * Render a network game on its simulation clock, rather than packet arrival time.
 *
 * sample(state, receivedAt, identity) returns a tick-stamped interpolation sample.
 * Feed those samples and time(now) to an existing interpolation function. Keep
 * the newest authoritative state separately: health, action results and input
 * never wait behind the display buffer. Changing identity resets the clock.
 *
 * Clock corrections change playback speed slightly, never its direction. A
 * stopped connection permits only a short, bounded extrapolation; the caller
 * must still use its real collision sweep when projecting a received body.
 */
export function createNetworkTimeline({ tickRate = 120, snapshotTicks = 2, maxExtrapolationMs = 25 } = {}) {
  const rate = finite(tickRate) && tickRate > 0 ? tickRate : 120;
  const quantum = 1000 / rate;
  const interval = quantum * (finite(snapshotTicks) && snapshotTicks > 0 ? snapshotTicks : 2);
  const baseBuffer = clamp(interval + 12, 20, 55);
  const extrapolation = clamp(finite(maxExtrapolationMs) ? maxExtrapolationMs : 25, 0, 100);
  let identity, offsets, offset, buffer, latestTick, latestTime, receivedAt;
  let cursor, cursorAt, estimated, playbackRate;

  function reset() {
    identity = undefined; offsets = []; offset = null; buffer = baseBuffer;
    latestTick = -1; latestTime = -Infinity; receivedAt = null;
    cursor = null; cursorAt = null; estimated = null; playbackRate = 1;
  }
  reset();

  function sample(state, now, nextIdentity = '') {
    if (!state || !finite(state.tick) || state.tick < 0 || !finite(now)) return null;
    if (identity !== undefined && identity !== nextIdentity) reset();
    identity = nextIdentity;
    if (state.tick < latestTick) return null;
    const time = state.tick * 1000 / rate;
    if (receivedAt !== null && now - receivedAt > 250 && state.tick > latestTick) {
      // A genuine outage is a discontinuity, not ordinary arrival jitter. Resume
      // near the current world instead of replaying seconds of obsolete poses.
      offsets = []; offset = now - time; buffer = baseBuffer;
      cursor = Math.max(cursor, time - buffer); cursorAt = now;
      estimated = Math.max(estimated, time); playbackRate = 1;
    }
    // Lobby/Ready broadcasts may share a tick. They update membership immediately
    // without adding repeated observations of the same simulation instant.
    if (state.tick > latestTick) {
      offsets.push(now - time);
      if (offsets.length > 90) offsets.shift();
      const candidate = percentile(offsets, .1);
      if (offset === null) offset = candidate;
      else offset += (candidate - offset) * (candidate < offset ? .08 : .015);
      const jitter = Math.max(0, percentile(offsets, .9) - candidate);
      buffer = clamp(baseBuffer + Math.min(10, jitter * .25), 20, 55);
      latestTick = state.tick; latestTime = time;
    }
    receivedAt = now;
    if (cursor === null) { cursor = time - buffer; cursorAt = now; estimated = time; }
    return { state, time, receivedAt: now };
  }

  function time(now) {
    if (cursor === null || !finite(now)) return cursor;
    if (now - cursorAt > 250) {
      // RAF may sleep while a tab is hidden even though snapshots keep arriving.
      cursor = Math.max(cursor, Math.min(latestTime + extrapolation, now - offset - buffer));
      cursorAt = now; playbackRate = 1; return cursor;
    }
    const elapsed = clamp(now - cursorAt, 0, 250);
    const desired = now - offset - buffer;
    const error = desired - (cursor + elapsed);
    playbackRate = clamp(1 + error / 250, .94, 1.06);
    cursor = Math.max(cursor, Math.min(latestTime + extrapolation, cursor + elapsed * playbackRate));
    cursorAt = Math.max(cursorAt, now);
    return cursor;
  }

  function currentTime(now) {
    if (offset === null || !finite(now)) return estimated;
    // This clock is useful for tagging local history, not for extrapolating
    // opponents. Prediction remains bounded if packets stop arriving.
    estimated = Math.max(estimated, Math.min(latestTime + 250, now - offset));
    return estimated;
  }

  const getState = () => ({ tickRate: rate, snapshotTicks: interval / quantum,
    bufferMs: buffer, offsetMs: offset, latestTick, latestTime, receivedAt,
    renderTime: cursor, currentTime: estimated, playbackRate, maxExtrapolationMs: extrapolation });
  return Object.freeze({ sample, time, currentTime, reset, getState });
}
