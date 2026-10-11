/** Camera locomotion preference only; other motion keeps the device preference. */
export const CAMERA_MOTION_STORAGE_KEY = 'semag-camera-motion';
export const CAMERA_MOTION_CHOICES = Object.freeze(['system', 'normal', 'strong', 'off']);

export function normalizeCameraMotion(value) {
  return typeof value === 'string' && CAMERA_MOTION_CHOICES.includes(value) ? value : 'system';
}

export function cameraMotionStatus(value, reducedMotion = false) {
  switch (normalizeCameraMotion(value)) {
    case 'normal': return 'Natural walking and running sway. Aiming stays steady.';
    case 'strong': return 'Stronger walking and running sway. Aiming stays steady.';
    case 'off': return 'Steady camera while walking, running and aiming.';
    default: return reducedMotion === true
      ? 'Reduced motion is on. Normal or Strong enables wobble; aiming stays steady.'
      : 'Follows your device preference: natural sway. Aiming stays steady.';
  }
}

function browserStorage() {
  try { return globalThis.localStorage; } catch { return undefined; }
}

/** A blocked browser store never prevents an in-session camera choice. */
export function createCameraMotionStore({ storage = browserStorage() } = {}) {
  let value = 'system';
  try { value = normalizeCameraMotion(storage?.getItem(CAMERA_MOTION_STORAGE_KEY)); } catch { /* Retain the accessible default. */ }
  const listeners = new Set();
  return {
    get: () => value,
    set(nextValue) {
      const next = normalizeCameraMotion(nextValue);
      if (next === value) return value;
      const previous = value; value = next;
      try { storage?.setItem(CAMERA_MOTION_STORAGE_KEY, value); } catch { /* Keep the in-memory choice. */ }
      for (const callback of [...listeners]) callback(value, previous);
      return value;
    },
    subscribe(callback) {
      if (typeof callback !== 'function') throw new TypeError('Camera motion listener must be a function.');
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    destroy() { listeners.clear(); },
  };
}
