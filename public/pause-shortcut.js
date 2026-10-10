/** P opens the game menu without taking the browser's Escape key. */
export function isPauseShortcut(event) {
  if (!event || event.defaultPrevented || event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return false;
  const key = typeof event.key === 'string' ? event.key : '';
  const pauseKey = key && key !== 'Unidentified' ? key.toLowerCase() === 'p' : event.code === 'KeyP';
  if (!pauseKey) return false;
  const target = event.target;
  if (target?.isContentEditable || target?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')) return false;
  return true;
}
