export const GAMES = {
  'paris-pedal': { title: 'Paris Pedal', category: 'DRIVING / E-BIKE SURVIVAL', kind: 'solo', genre: 'driving', icon: '⌁', description: 'Paris gets faster the longer you survive. Last one more second.', color: '#488d87' },
  'ember-delve': { title: 'Ember Delve', category: 'ACTION ROGUELIKE', kind: 'solo', genre: 'action', roguelike: true, icon: '♨', description: 'Read the windup. Break the pursuit. Earn your descent.', color: '#a07151' },
  'deckbound': { title: 'Deckbound', category: 'DECKBUILDING ROGUELIKE', kind: 'solo', genre: 'cards', roguelike: true, icon: '♧', description: 'Read their intent. Commit to battles. Build for the bosses.', color: '#8e815b' },
  'oddstock-rumble': { title: 'Oddstock Rumble', category: 'BONUS PLATFORM BRAWLER', kind: 'duel', genre: 'action', icon: '★', description: 'Six unlikely heroes. Three stages. One glorious send-off.', color: '#927aa1' },
  'relic-duel': { title: 'Relic Duel', category: 'TOP-DOWN ARENA', kind: 'duel', genre: 'action', icon: '⚔', description: 'Sword, shield, and a little quick thinking.', color: '#779868' },
  'checkers': { title: 'Checkers', category: 'THE CLASSIC', kind: 'board', icon: '◉', description: 'Every move is a conversation.', color: '#a88e62' },
  'dungeon-run': { title: 'Dungeon Run', category: 'CO-OP ADVENTURE', kind: 'coop', genre: 'action', icon: '✦', description: 'Two adventurers. One way through.', color: '#748766' },
  'afterimage': { title: 'Afterimage', category: 'SWORD FIGHTER', kind: 'duel', genre: 'action', icon: '〃', description: 'A duel above the city.', color: '#667d7a' },
  'crazy-eights': { title: 'Crazy Eights', category: 'CARD CLASSIC', kind: 'cards', icon: '♠', description: 'Match the suit. Change the game.', color: '#577e68' },
  'twenty-one': { title: '21 Duel', category: 'BLACKJACK-STYLE DUEL', kind: 'cards', icon: '♦', description: 'Push your luck. Know when to stand.', color: '#b17b57' },
  'memory': { title: 'Memory Match', category: 'CARD MEMORY GAME', kind: 'cards', icon: '♣', description: 'Remember a face. Find its match.', color: '#79898d' },
  'snake': { title: 'Snake', category: 'SOLO ARCADE', kind: 'solo', icon: '〰', description: 'Six dense gardens. Longer trails. A 168-fruit Gauntlet.', color: '#658254' },
  'minesweeper': { title: 'Minesweeper', category: 'SOLO PUZZLE', kind: 'solo', icon: '⚑', description: 'Ninety mines. Overlapping clues. Six active minutes.', color: '#899282' },
  '2048': { title: '2048', category: 'SOLO PUZZLE', kind: 'solo', icon: '▦', description: 'Six exact Master trials. Two rewinds. Reach 16,384.', color: '#bf9764' },
  'apex-circuit': { title: 'Apex Circuit', category: 'DRIVING / TIME TRIAL', kind: 'solo', genre: 'driving', icon: '◎', description: 'Beat the deadline. Keep a clean line. Earn the championship.', color: '#82916b' },
  'night-drive': { title: 'Night Drive', category: 'DRIVING / HIGHWAY', kind: 'solo', genre: 'driving', icon: '▰', description: 'Five districts. A ticking clock. Make every clean pass count.', color: '#637e81' },
  'vector-arena': { title: 'Vector Arena', category: 'PRECISION SHOOTER', kind: 'duel', genre: 'action', icon: '⌖', description: 'Lead the shot. Control the angle. Win the duel.', color: '#5b827c' },
  'prism-shift': { title: 'Prism Shift', category: 'FALLING BLOCKS', kind: 'solo', genre: 'puzzle', icon: '▥', description: 'Faster drops. Tighter placements. Master three challenge tiers.', color: '#8c7e9c' },
  'rift-survivor': { roguelike: true, title: 'Rift Survivor', category: 'SURVIVAL ARENA', kind: 'solo', genre: 'action', icon: '✧', description: 'Burst fire. Break suppression. Survive two-phase guardians.', color: '#7c7975' },
};
export function soloUrl(gameId) {
  return `/solo.html?game=${encodeURIComponent(gameId)}`;
}
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
