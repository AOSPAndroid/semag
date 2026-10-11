// The browser owns installation and activation. Never reload a live game to update.
export function mountPwaInstall({ window: win = globalThis.window, document: doc = win?.document } = {}) {
  const button = doc?.getElementById('pwa-install');
  const dialog = doc?.getElementById('pwa-install-dialog');
  const close = doc?.getElementById('pwa-install-close');
  const status = doc?.getElementById('pwa-install-status');
  const security = doc?.getElementById('pwa-install-security');
  if (!win || !button || !dialog || !close || !status || !security) return { destroy() {} };

  const standalone = win.matchMedia?.('(display-mode: standalone)');
  const minimalUi = win.matchMedia?.('(display-mode: minimal-ui)');
  const listeners = [];
  let deferredPrompt = null, pending = false, installed = false, destroyed = false;
  let returnFocus = null, workerStarted = false;
  const listen = (target, type, handler) => {
    target?.addEventListener?.(type, handler);
    listeners.push(() => target?.removeEventListener?.(type, handler));
  };
  const isInstalled = () => installed || win.navigator?.standalone === true || standalone?.matches || minimalUi?.matches;
  // Fullscreen is a game/browser state, rather than proof that the app was installed.
  const sync = () => {
    if (destroyed) return;
    button.hidden = !!isInstalled();
    button.disabled = pending;
    button.setAttribute('aria-busy', String(pending));
    security.hidden = win.isSecureContext === true;
  };
  const closeDialog = () => {
    if (dialog.open) dialog.close();
  };
  const showHelp = message => {
    status.textContent = message || '';
    status.hidden = !message;
    if (dialog.open) return;
    returnFocus = doc.activeElement;
    dialog.showModal();
  };
  const onClick = async () => {
    if (destroyed || pending || isInstalled()) return;
    if (!deferredPrompt) { showHelp(); return; }
    const request = deferredPrompt;
    deferredPrompt = null; // A native prompt event is single-use, including after decline.
    pending = true; sync();
    try {
      await request.prompt();
      const choice = await request.userChoice;
      if (destroyed || isInstalled()) return;
      showHelp(choice?.outcome === 'accepted'
        ? 'Installation requested. Finish any remaining steps in your browser.'
        : 'Installation was cancelled. You can still install from your browser menu.');
    } catch {
      if (!destroyed && !isInstalled()) showHelp('Your browser could not open the install prompt. Use the steps below.');
    } finally {
      pending = false; sync();
    }
  };
  const onPrompt = event => {
    event.preventDefault();
    if (!isInstalled() && !pending) deferredPrompt = event;
    sync();
  };
  const onInstalled = () => {
    installed = true; deferredPrompt = null; sync(); closeDialog();
  };
  const onModeChange = () => {
    sync();
    if (isInstalled()) { deferredPrompt = null; closeDialog(); }
  };
  const registerWorker = () => {
    if (destroyed || workerStarted || win.isSecureContext !== true || !win.navigator?.serviceWorker?.register) return;
    workerStarted = true;
    try {
      Promise.resolve(win.navigator.serviceWorker.register('/service-worker.js', { scope: '/', updateViaCache: 'none' })).catch(() => {});
    } catch { /* Installation guidance remains available if registration is blocked. */ }
  };
  listen(button, 'click', onClick);
  listen(close, 'click', closeDialog);
  listen(dialog, 'click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeDialog();
  });
  listen(dialog, 'close', () => {
    if (!button.hidden && returnFocus?.isConnected !== false) returnFocus?.focus?.();
    returnFocus = null;
  });
  listen(win, 'beforeinstallprompt', onPrompt);
  listen(win, 'appinstalled', onInstalled);
  for (const media of [standalone, minimalUi]) listen(media, 'change', onModeChange);
  sync();
  if (doc.readyState === 'complete') registerWorker();
  else listen(win, 'load', registerWorker);
  return {
    destroy() {
      destroyed = true; deferredPrompt = null;
      for (const remove of listeners) remove();
      closeDialog();
    },
  };
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') mountPwaInstall();
