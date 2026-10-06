export const GAMES = {
  'relic-duel': { title: 'Relic Duel', category: 'TOP-DOWN ARENA', kind: 'duel', icon: '⚔', description: 'Sword, shield, and a little quick thinking.', color: '#779868' },
  'checkers': { title: 'Checkers', category: 'THE CLASSIC', kind: 'board', icon: '◉', description: 'Every move is a conversation.', color: '#a88e62' },
  'dungeon-run': { title: 'Dungeon Run', category: 'CO-OP ADVENTURE', kind: 'coop', icon: '✦', description: 'Two adventurers. One way through.', color: '#748766' },
  'afterimage': { title: 'Afterimage', category: 'SWORD FIGHTER', kind: 'duel', icon: '〃', description: 'A duel above the city.', color: '#667d7a' },
};
export function roomUrl(room) {
  return room.gameId === 'afterimage' ? `/afterimage.html?room=${encodeURIComponent(room.id)}` : `/play.html?room=${encodeURIComponent(room.id)}&game=${encodeURIComponent(room.gameId)}`;
}
export function getName() { try { return localStorage.getItem('afterimage-name') || 'Challenger'; } catch { return 'Challenger'; } }
export function saveName(name) { const safe = (name || '').trim().slice(0, 20) || 'Challenger'; try { localStorage.setItem('afterimage-name', safe); } catch {} return safe; }
export async function hostInfo() {
  const response = await fetch('/api/host-info');
  if (!response.ok) throw new Error('Cannot reach the host.');
  const info = await response.json();
  let origin = location.origin;
  if (['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0'].includes(location.hostname)) {
    const hostname = typeof info.hostname === 'string' && /^[a-zA-Z0-9._-]+$/.test(info.hostname) ? info.hostname : info.addresses?.[0];
    if (hostname) origin = `http://${hostname}:${info.port}`;
  }
  return { ...info, origin };
}
export async function copyText(value) {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(value);
  const input = document.createElement('textarea'); input.value = value;
  input.style.position = 'fixed'; input.style.opacity = '0'; document.body.append(input); input.select();
  const success = document.execCommand('copy'); input.remove();
  if (!success) throw new Error('Select the address to copy it.');
}
