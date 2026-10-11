import { cameraMotionStatus } from './voxel-camera-motion-settings.js';

/** Bind setup/pause fields to one preference without touching game controls. */
export function mountCameraMotionControls(root, { store, reducedMotion = false } = {}) {
  if (typeof root?.querySelectorAll !== 'function' || !store?.get || !store?.set || !store?.subscribe) throw new TypeError('Camera motion controls need a root and preference store.');
  const document = root.ownerDocument ?? root;
  const controls = [...root.querySelectorAll('[data-camera-motion]')].map(select => ({
    select,
    statuses: (select.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean).map(id => document.getElementById?.(id)).filter(Boolean),
  }));
  let destroyed = false;
  const sync = () => {
    if (destroyed) return;
    const value = store.get(), reduced = reducedMotion === true || reducedMotion?.matches === true;
    for (const { select, statuses } of controls) {
      select.value = value;
      for (const status of statuses) status.textContent = cameraMotionStatus(value, reduced);
    }
  };
  const onChange = event => store.set(event.currentTarget.value);
  for (const { select } of controls) select.addEventListener('change', onChange);
  const unsubscribe = store.subscribe(sync);
  if (typeof reducedMotion?.addEventListener === 'function') reducedMotion.addEventListener('change', sync);
  else reducedMotion?.addListener?.(sync);
  sync();
  return {
    sync,
    destroy() {
      if (destroyed) return;
      destroyed = true; unsubscribe();
      for (const { select } of controls) select.removeEventListener('change', onChange);
      if (typeof reducedMotion?.removeEventListener === 'function') reducedMotion.removeEventListener('change', sync);
      else reducedMotion?.removeListener?.(sync);
    },
  };
}
