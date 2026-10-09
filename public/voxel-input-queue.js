/** Fresh FPS presses survive packet coalescing; movement and look remain current. */
export const FPS_EDGE_ACTIONS = Object.freeze(['slot1', 'slot2', 'slot3', 'slot4', 'drop', 'fire', 'aim', 'jump', 'reload', 'interact', 'swap', 'grenade', 'heal']);

/** Release one touch source while preserving valid taps and surviving aliases. */
export function releaseFpsTouchAction(pointer, pointers, actions, isHeld, cancelled = false) {
  const others = [...pointers.values()].filter(other => other.action === pointer.action);
  if (!others.length) {
    actions.delete(pointer.action);
    pointer.element.classList.remove('pressed');
    if (cancelled && !isHeld(pointer.action) && Number.isSafeInteger(pointer.pressSeq)) return { action: pointer.action, seq: pointer.pressSeq };
  } else if (cancelled && Number.isSafeInteger(pointer.pressSeq)) {
    // A surviving finger owns the still-live aggregate press until release.
    others[0].pressSeq = pointer.pressSeq;
  } else if (!cancelled) {
    // Any normal release confirms the tap; a later lost capture cannot erase it.
    for (const other of others) other.pressSeq = null;
  }
  return null;
}

export function createFpsInputQueue({ maxPending = 16, maxAgeMs = 120 } = {}) {
  const limit = Number.isFinite(maxPending) ? Math.max(1, Math.min(32, Math.floor(maxPending))) : 16;
  const lifetime = Number.isFinite(maxAgeMs) ? Math.max(0, Math.min(250, maxAgeMs)) : 120;
  let observed = {}, latest = {}, viewTick = null, prime = false;
  const pending = [], sampled = new Set(), blocked = new Set();
  const finiteTime = value => Number.isFinite(value) ? value : 0;
  // Rendering observes exactly the next physics selection, including expiry
  // and release fences, without advancing any queue or held-button state.
  const select = (input, now) => {
    const buttons = { ...input };
    const isBlocked = action => blocked.has(action) && input[action] === true;
    for (const action of FPS_EDGE_ACTIONS) if (prime || isBlocked(action)) buttons[action] = false;
    let discard = 0, selectedViewTick = viewTick;
    while (discard < pending.length && finiteTime(now) - pending[discard].at > lifetime) discard++;
    // ADS remains a continuous hold. A held aim already delivered beside another
    // commitment needs no synthetic release or second journal-only physics tick.
    while (discard < pending.length && pending[discard].action === 'aim' && sampled.has('aim') && input.aim === true && !isBlocked('aim')) discard++;
    if (!prime && discard < pending.length) {
      // Keep existing holds but serialize fresh commitments. Two rapid taps
      // of one action need a real release step between their rising edges.
      for (const action of FPS_EDGE_ACTIONS) buttons[action] = !isBlocked(action) && (action === 'aim' || sampled.has(action)) && input[action] === true;
      const freshAim = buttons.aim && !sampled.has('aim') ? pending.slice(discard).find(edge => edge.action === 'aim') : null;
      const edge = pending[discard];
      if (isBlocked(edge.action)) discard++;
      else if (sampled.has(edge.action)) buttons[edge.action] = false;
      else {
        buttons[edge.action] = true; discard++;
        if (edge.action === 'drop' && edge.inventorySlot) buttons[edge.inventorySlot] = true;
        if (edge.action === 'fire' || edge.action === 'grenade' || edge.action === 'aim') {
          selectedViewTick = edge.viewTick;
          if (Number.isFinite(edge.yaw)) buttons.yaw = edge.yaw;
          if (Number.isFinite(edge.pitch)) buttons.pitch = edge.pitch;
        } else if (freshAim) {
          selectedViewTick = freshAim.viewTick;
          if (Number.isFinite(freshAim.yaw)) buttons.yaw = freshAim.yaw;
          if (Number.isFinite(freshAim.pitch)) buttons.pitch = freshAim.pitch;
        }
      }
    }
    return { buttons, viewTick: selectedViewTick, discard };
  };
  return Object.freeze({
    observe(input, now = 0, context = {}) {
      latest = { ...input }; viewTick = Number.isFinite(context.viewTick) ? context.viewTick : null;
      const inventoryCommit = ['slot1', 'slot2', 'slot3', 'slot4', 'drop'].some(action => input[action] === true && observed[action] !== true && !blocked.has(action));
      const handChange = inventoryCommit || input.swap === true && observed.swap !== true && !blocked.has('swap');
      if (handChange) {
        // A slot/drop commitment supersedes an unconsumed attack and fences a
        // still-held physical trigger until a genuine release is observed.
        for (let index = pending.length - 1; index >= 0; index--) if (pending[index].action === 'aim' || inventoryCommit && pending[index].action === 'fire') pending.splice(index, 1);
        if (inventoryCommit && input.fire === true) blocked.add('fire');
        if (input.aim === true) blocked.add('aim');
      }
      for (const action of FPS_EDGE_ACTIONS) {
        if (input[action] !== true) blocked.delete(action);
        if (input[action] === true && observed[action] !== true && !blocked.has(action) && pending.length < limit) {
      pending.push({ action, at: finiteTime(now), yaw: input.yaw, pitch: input.pitch, viewTick,
            ...(action === 'drop' ? { inventorySlot: ['slot1', 'slot2', 'slot3', 'slot4'].find(key => input[key] === true) || null } : {}),
            ...(Number.isSafeInteger(context.sequence) && context.sequence >= 0 ? { seq: context.sequence } : {}) });
        }
      }
      observed = { ...input };
    },
    // Only the owned, unconsumed press may be withdrawn. Holds and other taps
    // retain their sampled state; old/unknown sequences cannot cancel a new press.
    cancel(press) {
      if (!FPS_EDGE_ACTIONS.includes(press?.action) || !Number.isSafeInteger(press?.seq) || press.seq < 0) return false;
      const index = pending.findIndex(edge => edge.action === press.action && edge.seq === press.seq);
      if (index < 0) return false;
      pending.splice(index, 1); return true;
    },
    reset({ held = {}, neutral = false } = {}) {
      pending.length = 0; sampled.clear(); blocked.clear(); prime = neutral === true;
      observed = { ...held }; latest = { ...held }; viewTick = null;
      for (const action of FPS_EDGE_ACTIONS) if (held[action] === true) blocked.add(action);
    },
    preview: (input = latest, now = 0) => select(input, now).buttons,
    sample(input = latest, now = 0) {
      const { buttons, viewTick: selectedViewTick, discard } = select(input, now);
      for (const action of FPS_EDGE_ACTIONS) if (input[action] !== true) blocked.delete(action);
      if (discard) pending.splice(0, discard);
      sampled.clear();
      for (const action of FPS_EDGE_ACTIONS) if (buttons[action] === true) sampled.add(action);
      prime = false;
      return { buttons, viewTick: selectedViewTick };
    },
    inspect: () => ({ pending: pending.map(edge => ({ ...edge })), blocked: [...blocked], neutral: prime }),
  });
}
