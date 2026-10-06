/** Original Oddstock pixel artwork. Coordinates are cosmetic world pixels. */
import { STAGES } from '../brawl-engine.js';
export const INK = '#26343b';
export const rect = (c, x, y, w, h, color) => { c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
export function poly(c, points, fill, stroke, width = 1) { c.beginPath(); points.forEach((p, i) => i ? c.lineTo(...p) : c.moveTo(...p)); c.closePath(); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.lineJoin = 'miter'; c.stroke(); } }
export function line(c, points, color, width = 1) { c.beginPath(); points.forEach((p, i) => i ? c.lineTo(...p) : c.moveTo(...p)); c.strokeStyle = color; c.lineWidth = width; c.stroke(); }
export function oval(c, x, y, rx, ry, fill, stroke, width = 1) { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); } }
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
function seed(value) { let n = value; return () => { n = (n * 1664525 + 1013904223) >>> 0; return n / 4294967296; }; }
function panel(c, x, y, w, h, color, highlight) { rect(c, x - 1, y - 1, w + 2, h + 2, INK); rect(c, x, y, w, h, color); if (highlight) rect(c, x + 1, y, Math.max(1, w - 2), 2, highlight); }
function rounded(c, x, y, w, h, color, outline = INK, corner = 3) { poly(c, [[x + corner, y], [x + w - corner, y], [x + w - corner, y + 1], [x + w, y + corner], [x + w, y + h - corner], [x + w - corner, y + h], [x + corner, y + h], [x, y + h - corner], [x, y + corner], [x + corner, y + 1]], color, outline); }
function face(c, x, y, hurt, serious = false) { rect(c, x, y, 4, 4, INK); rect(c, x + 9, y, 4, 4, INK); rect(c, x + 1, y, 1, 2, '#fff5d8'); rect(c, x + 10, y, 1, 2, '#fff5d8'); if (hurt) { line(c, [[x - 1, y - 2], [x + 4, y]], INK, 2); line(c, [[x + 8, y], [x + 13, y - 2]], INK, 2); } else if (serious) { rect(c, x - 1, y - 2, 6, 1, INK); rect(c, x + 9, y - 2, 5, 1, INK); } }
function shoe(c, x, y, w, color = '#5d514a') { panel(c, x, y, w, 7, color, '#b4a584'); rect(c, x - 1, y + 6, w + 2, 2, INK); rect(c, x + 2, y + 5, w - 3, 1, '#d8cfb0'); }
export function drawWrench(c, x, y, scale = 1) { c.save(); c.translate(x, y); c.scale(scale, scale); poly(c, [[-3, -11], [-10, -16], [-8, -24], [-4, -24], [-5, -17], [3, -14], [7, -22], [11, -19], [9, -10], [3, -7], [3, 17], [-3, 17]], '#95a9ac', INK, 1.5); rect(c, -1, -7, 2, 21, '#dae5cd'); rect(c, -7, -20, 2, 5, '#e4eacc'); rect(c, 0, 11, 1, 2, '#54737b'); c.restore(); }

export function comicPose(f, time = 0, reduced = false) {
  const action = f.action || 'idle', m = f.move;
  const moving = ['attack', 'special', 'recovery'].includes(action), total = m?.total || 32;
  const frame = moving ? Math.min(7, Math.floor((f.actionFrame || 0) / total * 8)) : 0;
  const phase = !moving ? 'rest' : (f.actionFrame || 0) < (m?.startup || 9) ? 'windup' : (f.actionFrame || 0) < (m?.startup || 9) + (m?.active || 8) ? 'strike' : 'follow';
  const walk = reduced ? 0 : Math.floor(time / 90) % 4;
  const stride = action === 'run' ? reduced ? 0 : [-3, 0, 3, 0][walk] : action === 'jump' ? 3 : 0;
  const stretch = moving ? phase === 'windup' ? -5 : phase === 'strike' ? 17 : Math.max(0, 13 - frame * 2) : 0;
  const direction = m?.direction || 'side', rise = (f.vy || 0) < -1, fired = !!m?.fired;
  // Cache only features that change the drawing: idle mechanics do not need
  // four duplicate walk frames, and only the moth flutters while standing.
  const key = `${f.characterId}/${action}/${phase}/${stretch}/${stride}/${direction}/${f.characterId === 'moth' ? walk : 0}/${f.characterId === 'parcel' && fired}/${action === 'jump' && rise}`;
  return { action, moving, frame, phase, walk, stride, stretch, direction, rise, hurt: action === 'hit', shield: action === 'shield', fired, key };
}
function hand(p, x = 22, y = 1) { if (!p.moving) return [x + (p.action === 'jump' ? 3 : 0), p.action === 'jump' && p.rise ? y - 12 : p.shield ? y - 5 : y]; if (p.direction === 'up' || p.action === 'recovery') return [x - 10, -24]; if (p.direction === 'down') return [x - 5, p.phase === 'windup' ? -24 : 17]; return [x + p.stretch, p.phase === 'windup' ? y - 5 : y]; }

/** Same authored characters in portraits, cover artwork and live combat. */
export function drawComicSprite(c, f, time = 0, reduced = false) {
  const p = comicPose(f, time, reduced), id = f.characterId || 'wrench';
  c.save(); c.translate(Math.round(f.x || 0), Math.round(f.y || 0)); c.scale(f.facing || 1, 1);
  const tilt = p.action === 'dodge' ? -.3 : p.hurt ? -.18 : p.action === 'run' ? .045 : 0;
  if (tilt) c.rotate(tilt);
  if (id === 'wrench') {
    // Stocky mechanic: rolled sleeves, metal knee plates, cap and moustache.
    shoe(c, -15 - p.stride, 18, 14); shoe(c, 2 + p.stride, 18, 16);
    panel(c, -12, 9, 11, 13, '#427182', '#7ba8ab'); panel(c, 2, 9, 11, 13, '#396274'); rect(c, -10, 13, 6, 4, '#a9b2a0'); rect(c, 5, 14, 6, 4, '#a9b2a0');
    rounded(c, -15, -6, 30, 25, '#d69a55'); rect(c, -14, -4, 28, 5, '#edbb75'); panel(c, -9, -4, 20, 20, '#4e7c89', '#93b1a6'); rect(c, -8, -5, 3, 8, '#b9bda1'); rect(c, 6, -5, 3, 8, '#b9bda1'); rect(c, -6, 3, 12, 7, '#335c6b'); rect(c, -5, 3, 10, 1, '#a2c0b2');
    panel(c, -15, 13, 30, 5, '#634b37', '#ab8f5e'); rect(c, -2, 14, 5, 3, '#ecd69b'); panel(c, -14, 15, 6, 7, '#9e8b6b'); rect(c, -12, 17, 2, 5, '#e1c99e'); rect(c, 10, 15, 4, 5, '#89a3a5');
    rounded(c, -12, -25, 25, 23, '#dca576'); rect(c, -10, -23, 20, 4, '#f4c69a'); rect(c, -12, -18, 3, 10, '#b9815d'); rounded(c, -16, -30, 31, 10, '#c77b4c'); rect(c, -12, -29, 22, 2, '#efb879'); panel(c, -7, -27, 8, 4, '#e9c77a'); rect(c, -16, -22, 36, 3, INK); rect(c, -14, -22, 32, 2, '#e99d63');
    face(c, -7, -17, p.hurt, true); rect(c, 1, -12, 6, 5, '#f2c295'); poly(c, [[-9, -10], [-3, -12], [2, -9], [7, -11], [13, -8], [8, -5], [1, -6], [-5, -4], [-10, -6]], '#563d34', INK); rect(c, -2, -4, 7, 1, '#f3d2ab');
    panel(c, -18, -2, 8, 10, '#dba575', '#efc198'); const [hx, hy] = hand(p, 23, 2);
    line(c, [[13, -2], [hx - 5, hy]], INK, 9); line(c, [[13, -3], [hx - 5, hy - 1]], '#e0a56f', 6); rounded(c, hx - 4, hy - 4, 8, 9, '#f2c499');
    c.save(); c.translate(hx + 3, hy - 2); c.rotate(p.direction === 'down' && p.phase !== 'windup' ? Math.PI : p.direction === 'up' || p.action === 'recovery' ? -.2 : p.phase === 'strike' ? Math.PI / 2 : -.15); drawWrench(c, 0, 0, .88); c.restore();
  } else if (id === 'sprout') {
    // Theatrical leaf knight: flared cloak, petal pauldrons and acorn shield.
    poly(c, [[-13, -13], [-23 - p.stride, 1], [-29, 24], [-20, 20], [-16, 26], [-5, 22], [-6, -3]], '#62455c', INK, 1.5); line(c, [[-16, -9], [-23, 17], [-16, 20]], '#b87c99', 2); line(c, [[-12, -6], [-15, 20]], '#845575', 2);
    shoe(c, -12 - p.stride, 20, 12, '#405145'); shoe(c, 3 + p.stride, 20, 13, '#405145'); panel(c, -10, 7, 22, 14, '#597948', '#a8ba78'); rect(c, -7, 16, 5, 6, '#374d3b'); rect(c, 4, 16, 5, 6, '#374d3b');
    poly(c, [[-13, -8], [-4, -12], [10, -11], [15, -1], [11, 15], [-10, 15]], '#77944f', INK, 1.5); poly(c, [[-7, -7], [1, -11], [9, -5], [5, 12], [-5, 10]], '#a8c780'); line(c, [[0, -7], [0, 9]], '#d3dda0', 2); poly(c, [[-17, -11], [-5, -14], [-10, -2], [-18, -2]], '#a2bc77', INK); poly(c, [[9, -14], [17, -9], [15, -1], [7, -4]], '#a2bc77', INK);
    panel(c, -12, 13, 26, 4, '#695742', '#d1b377'); rect(c, -2, 13, 5, 4, '#e4d093'); rounded(c, -10, -26, 23, 19, '#d9bf90'); rect(c, -8, -23, 17, 5, '#ecd5a0');
    poly(c, [[-14, -24], [-9, -31], [10, -30], [17, -20], [13, -16], [-11, -17]], '#6c924f', INK, 1.5); line(c, [[-9, -27], [7, -27], [14, -21]], '#c4d798', 2); poly(c, [[2, -30], [-2, -39], [6, -36], [10, -44], [16, -39], [19, -30], [9, -26]], '#a8cc72', INK); line(c, [[7, -30], [11, -39]], '#5b814a', 2);
    face(c, -5, -18, p.hurt, true); rect(c, 4, -12, 7, 2, '#765342'); rect(c, -7, -9, 6, 1, '#fff0c3');
    poly(c, [[-19, -6], [-9, -10], [-3, -4], [-8, 16], [-20, 9], [-23, 1]], '#785939', INK, 1.5); line(c, [[-18, -4], [-10, -7], [-6, -3], [-10, 11], [-18, 6]], '#cfb476', 2); poly(c, [[-14, -1], [-10, 2], [-14, 7], [-18, 2]], '#9dc174');
    const [hx, hy] = hand(p, 18, 0); line(c, [[11, -3], [hx, hy]], INK, 7); line(c, [[11, -4], [hx, hy - 1]], '#d5bb84', 4);
    c.save(); c.translate(hx, hy); c.rotate(p.direction === 'down' && p.phase !== 'windup' ? Math.PI : p.phase === 'strike' && p.direction !== 'up' ? Math.PI / 2 : -.3); panel(c, -2, -2, 4, 14, '#896244'); panel(c, -8, -4, 16, 3, '#d3b675'); poly(c, [[0, -38], [7, -27], [6, -18], [10, -13], [4, -1], [-4, -1], [-7, -20]], '#bcd593', INK, 1.5); line(c, [[0, -33], [0, -4]], '#eef0b8', 2); line(c, [[-4, -21], [0, -17], [5, -22]], '#759d62'); c.restore();
  } else if (id === 'moth') {
    // A fluffy dumpling with four eye-patterned wings and hungry cheeks.
    const flap = reduced ? 0 : [-2, 1, 4, 1][p.walk];
    poly(c, [[-11, -9], [-27, -25 + flap], [-38, -18 + flap], [-39, -4], [-26, 12], [-10, 8]], '#ac83bf', INK, 1.5); poly(c, [[11, -9], [27, -25 - flap], [37, -18 - flap], [39, -4], [26, 12], [10, 8]], '#c5a7d3', INK, 1.5);
    poly(c, [[-29, -17 + flap], [-21, -10], [-28, 2], [-34, -7]], '#dac5e0'); poly(c, [[28, -17 - flap], [21, -10], [28, 2], [34, -7]], '#e7d3e8'); panel(c, -29, -9, 6, 7, '#7b5c94', '#efe0d4'); panel(c, 23, -9, 6, 7, '#7b5c94', '#efe0d4'); rect(c, -27, -7, 2, 3, '#f0c97e'); rect(c, 25, -7, 2, 3, '#f0c97e');
    poly(c, [[-13, 1], [-27, 13], [-23, 23], [-8, 15]], '#c49ecb', INK); poly(c, [[13, 1], [27, 13], [23, 23], [8, 15]], '#d7b4d5', INK); line(c, [[-22, 16], [-13, 9]], '#f0d6e1', 2); line(c, [[22, 16], [13, 9]], '#f0d6e1', 2);
    rounded(c, -19, -18, 38, 37, '#ead2ce', INK, 7); poly(c, [[-17, -4], [-15, -13], [-7, -17], [3, -16], [15, -10], [17, 5], [11, 16], [-7, 18], [-16, 10]], '#f5e6d4'); rect(c, -18, -2, 2, 11, '#cdaeb7'); rect(c, -10, -18, 5, 3, '#fff0df'); rect(c, 4, -18, 4, 3, '#fff0df');
    line(c, [[-8, -17], [-11, -25], [-18, -29]], INK, 2); line(c, [[8, -17], [12, -25], [20, -28]], INK, 2); rounded(c, -22, -31, 7, 6, '#edc779'); rounded(c, 17, -30, 7, 6, '#edc779'); rect(c, -20, -31, 3, 2, '#fff2c2'); rect(c, 19, -30, 3, 2, '#fff2c2');
    face(c, -7, -7, p.hurt); rounded(c, -2, 3, p.moving || p.hurt ? 10 : 5, p.moving || p.hurt ? 9 : 4, '#a76d77', undefined, 1); if (p.moving) rect(c, 1, 4, 4, 2, '#fff2d8'); rect(c, -15, 0, 5, 3, '#d99ba4'); rect(c, 11, 0, 5, 3, '#d99ba4');
    panel(c, -10, 16, 6, 4, '#a78697'); panel(c, 4, 16, 6, 4, '#a78697'); const [hx, hy] = hand(p, 18, 5); rounded(c, hx - 4, hy - 3, 9, 7, '#f3ddd0'); if (p.phase === 'strike') { panel(c, hx + 7, hy - 8, 3, 3, '#ecd18b'); rect(c, hx + 14, hy - 3, 2, 2, '#caa368'); }
  } else if (id === 'parcel') {
    // A retro courier in a pressure suit, glass visor and overstuffed jetpack.
    shoe(c, -12 - p.stride, 17, 12, '#4a6276'); shoe(c, 3 + p.stride, 17, 13, '#4a6276'); panel(c, -10, 8, 9, 13, '#89a9bb', '#d0d5bf'); panel(c, 3, 8, 9, 13, '#6a8b9e');
    panel(c, -23, -10, 11, 29, '#ad8765', '#e7c58f'); panel(c, -25, -6, 5, 18, '#73868a', '#bec8b2'); rect(c, -21, -4, 7, 3, '#795b48'); panel(c, -21, 18, 7, 5, '#546c77'); rect(c, -20, 19, 5, 2, '#9ebab7');
    rounded(c, -13, -10, 27, 28, '#87aabc'); rect(c, -10, -8, 8, 23, '#c9d8d0'); rect(c, 8, -6, 4, 20, '#5c7b96'); panel(c, -12, 10, 26, 5, '#53677f', '#96a6a6'); panel(c, -2, 10, 7, 4, '#e1c27d'); panel(c, -7, -1, 13, 8, '#425e75'); rect(c, -5, 1, 3, 2, '#d8d39a'); rect(c, 0, 1, 4, 2, '#b2d2c1');
    rounded(c, -15, -29, 31, 23, '#a9c5ce', INK, 5); line(c, [[-10, -26], [10, -26], [14, -23]], '#e1e7cf', 2); rounded(c, -12, -24, 27, 15, '#3f6279', INK, 3); rect(c, -9, -23, 21, 3, '#80b7c1'); rect(c, -7, -19, 5, 2, '#b2d7d7'); rect(c, 2, -22, 3, 10, '#d3eddb'); rect(c, 6, -22, 1, 9, '#a2c6ca'); panel(c, -17, -20, 4, 7, '#cdbb87'); panel(c, 15, -18, 4, 6, '#cdbb87');
    const [hx, hy] = hand(p, 24, 0); line(c, [[12, -3], [hx - 4, hy]], INK, 8); line(c, [[12, -4], [hx - 4, hy - 1]], '#c9d6ca', 5); rounded(c, hx - 4, hy - 4, 8, 8, '#c0d0ca');
    if (!p.fired || !p.moving) { panel(c, hx, hy - 9, 19, 19, '#b78d60', '#e6bb7e'); rect(c, hx + 7, hy - 9, 4, 19, '#efdab0'); rect(c, hx + 1, hy - 3, 6, 5, '#f5e7c4'); rect(c, hx + 2, hy - 2, 4, 1, '#7e8c81'); rect(c, hx + 13, hy + 4, 3, 3, '#916447'); }
    if (p.action === 'recovery') { poly(c, [[-22, 23], [-25, 34], [-21, 31], [-18, 40], [-14, 32], [-13, 23]], '#e49b5f', INK); poly(c, [[-20, 24], [-20, 31], [-17, 35], [-16, 24]], '#ffe6a4'); }
  } else if (id === 'zap') {
    // Rat silhouette, patched saffron jacket, running shoes and a zigzag tail.
    line(c, [[-12, 13], [-26, 10], [-24, 2], [-37, -1 - p.stride]], INK, 6); line(c, [[-12, 12], [-26, 9], [-24, 1], [-37, -2 - p.stride]], '#c18d63', 3);
    shoe(c, -12 - p.stride, 14, 12, '#6f5949'); shoe(c, 4 + p.stride, 14, 13, '#6f5949'); rounded(c, -13, -5, 28, 22, '#d7b455'); rect(c, -10, -3, 11, 16, '#f0d273'); rect(c, 9, -2, 4, 15, '#b28b3e'); panel(c, -10, 12, 24, 4, '#675448'); rect(c, 0, -3, 2, 15, '#ad8a43'); poly(c, [[-8, 0], [-2, 0], [-5, 5], [-1, 5], [-8, 11], [-6, 6], [-10, 6]], '#fff0a6');
    poly(c, [[-14, -13], [-17, -32], [-13, -36], [-4, -29], [0, -12]], '#b29b77', INK, 1.5); poly(c, [[4, -15], [10, -35], [16, -33], [19, -22], [16, -11]], '#cdb18a', INK, 1.5); poly(c, [[-12, -30], [-6, -21], [-7, -13], [-12, -20]], '#cb8c86'); poly(c, [[12, -29], [15, -23], [12, -16], [8, -17]], '#d39c90');
    rounded(c, -14, -21, 28, 18, '#cdb58c', INK, 4); rect(c, -11, -20, 6, 2, '#e8d2a2'); face(c, -7, -15, p.hurt, true); rounded(c, 8, -11, 15, 10, '#e2cca4', INK, 3); panel(c, 20, -9, 4, 4, '#65544a'); rect(c, 11, -3, 7, 1, '#8b6849'); line(c, [[13, -7], [24, -11]], '#8c795b'); line(c, [[13, -5], [25, -4]], '#8c795b');
    const [hx, hy] = hand(p, 20, 2); line(c, [[10, -1], [hx, hy]], INK, 7); line(c, [[10, -2], [hx, hy - 1]], '#efce78', 4); rounded(c, hx - 3, hy - 3, 8, 7, '#e7d4ad');
    if (p.phase === 'strike') line(c, [[hx + 7, hy - 10], [hx + 13, hy - 4], [hx + 8, hy], [hx + 17, hy + 6]], '#fff3b6', 2);
  } else {
    // Retired gorilla boxer: heavy knuckles, knit cardigan and reading glasses.
    shoe(c, -20 - p.stride, 22, 17, '#514647'); shoe(c, 5 + p.stride, 22, 17, '#514647'); rounded(c, -22, -10, 45, 37, '#756458', INK, 4); poly(c, [[-18, -8], [-8, -10], [1, 15], [-4, 26], [-17, 23]], '#b79c79'); poly(c, [[8, -10], [18, -8], [20, 24], [6, 26], [1, 15]], '#b79c79'); poly(c, [[-9, -8], [2, 6], [9, -8]], '#e5cfaa'); line(c, [[-6, -6], [2, 15], [2, 25]], '#6b5143', 2);
    for (const y of [8, 15, 21]) panel(c, 2, y, 2, 2, '#dfc991'); panel(c, -17, 13, 11, 8, '#978066', '#d0b490'); panel(c, 11, 14, 8, 8, '#978066', '#d0b490'); rect(c, -14, 16, 6, 1, '#6b5a4d');
    rounded(c, -18, -32, 36, 27, '#73574b', INK, 5); poly(c, [[-15, -30], [-10, -34], [0, -32], [9, -33], [15, -29], [10, -24], [-11, -23]], '#665144', INK); rounded(c, -13, -23, 27, 19, '#b58f70', INK, 3); rect(c, -16, -26, 5, 16, '#b7b4a4'); rect(c, 12, -26, 4, 15, '#b7b4a4'); face(c, -8, -23, p.hurt, true);
    c.strokeStyle = '#ecd49b'; c.lineWidth = 1; c.strokeRect(-10, -25, 10, 8); c.strokeRect(3, -25, 10, 8); line(c, [[0, -22], [3, -22]], '#ecd49b', 1); rounded(c, -2, -18, 12, 7, '#8f6a53'); rect(c, 0, -17, 7, 2, '#665144'); rect(c, -2, -9, 10, 2, '#e0b995');
    rounded(c, -28, -6, 12, 23, '#75584c'); rounded(c, -29, 9, 14, 12, '#b18b6a'); const [hx, hy] = hand(p, 23, 6); line(c, [[17, -2], [hx, hy]], INK, 17); line(c, [[18, -3], [hx, hy - 1]], '#75574a', 13); rounded(c, hx - 3, hy - 7, 18, 17, '#b58e6b', INK, 3); line(c, [[hx + 1, hy - 5], [hx + 10, hy - 5]], '#e4ba8e', 2); rect(c, hx + 3, hy - 2, 1, 4, '#87634d'); rect(c, hx + 7, hy - 2, 1, 4, '#87634d');
  }
  c.restore();
}

function brickWall(c, x, y, w, h, base, mortar, highlight, brickW = 55, brickH = 20) { rect(c, x, y, w, h, base); for (let row = 0; row < h / brickH; row++) { const yy = y + row * brickH; rect(c, x, yy, w, 1, mortar); for (let xx = x + (row % 2 ? brickW / 2 : 0); xx < x + w; xx += brickW) { rect(c, xx, yy, 1, brickH, mortar); if (xx + 9 < x + w) rect(c, xx + 4, yy + 4, Math.min(brickW - 10, x + w - xx - 4), 1, highlight); } } }
function cloud(c, x, y, w, color) { poly(c, [[x, y + 8], [x + 22, y + 8], [x + 22, y], [x + w * .55, y], [x + w * .55, y + 4], [x + w - 20, y + 4], [x + w - 20, y + 8], [x + w, y + 8], [x + w, y + 12], [x, y + 12]], color); }
function leaves(c, x, y, w, h, fill, light) { poly(c, [[x + w * .25, y], [x + w * .7, y], [x + w * .7, y + h * .12], [x + w * .88, y + h * .12], [x + w * .88, y + h * .35], [x + w, y + h * .35], [x + w, y + h * .7], [x + w * .82, y + h * .7], [x + w * .82, y + h * .88], [x + w * .3, y + h * .88], [x + w * .3, y + h], [x + w * .12, y + h], [x + w * .12, y + h * .72], [x, y + h * .72], [x, y + h * .28], [x + w * .25, y + h * .28]], fill); rect(c, x + w * .32, y + 5, w * .32, 3, light); rect(c, x + 5, y + h * .38, w * .12, 3, light); }
function rivet(c, x, y, color = '#b1bdb0') { rect(c, x, y, 3, 3, '#34454a'); rect(c, x, y, 2, 1, color); }
function rooftop(c, random) {
  cloud(c, 42, 94, 230, '#b4b7c733'); cloud(c, 710, 205, 358, '#f1cfb849'); cloud(c, 90, 165, 132, '#cdd0cb33');
  rounded(c, 860, 76, 106, 108, '#f1c68e', '#e8b784', 25); rect(c, 858, 126, 112, 3, '#eec299'); rect(c, 864, 155, 98, 3, '#e2ad81');
  for (const [base, fill, detail, unit, source] of [[416, '#737f94', '#e2bba54a', 76, 90], [518, '#4d6575', '#c5ba8a50', 112, 351]]) {
    const r = seed(source); for (let x = -20; x < 1200; x += unit) { const h = 95 + Math.floor(r() * 140), top = base - h; rect(c, x, top, unit - 5, h, fill); rect(c, x - 2, top - 4, unit - 1, 5, fill); rect(c, x + unit - 20, top + 9, 4, h - 9, '#e5d0b515'); for (let yy = top + 19; yy < base - 16; yy += 23) for (let xx = x + 13; xx < x + unit - 15; xx += 20) if (r() > .5) { rect(c, xx, yy, 5, 7, detail); rect(c, xx, yy + 7, 6, 1, '#223f4c22'); } if (r() > .55) { rect(c, x + 13, top - 25, 25, 21, '#71808a'); rect(c, x + 16, top - 23, 3, 15, '#acaa942d'); poly(c, [[x + 10, top - 26], [x + 26, top - 34], [x + 41, top - 26]], '#606b7d'); } }
  }
  line(c, [[0, 190], [300, 231], [650, 236], [960, 206], [1200, 162]], '#5a64765c', 2); for (let x = 70; x < 1200; x += 150) { const yy = 203 + Math.sin(x / 450) * 26; poly(c, [[x, yy], [x + 21, yy + 2], [x + 10, yy + 26]], x % 300 ? '#d59c867d' : '#efd0a067'); }
  // Equipment belongs to the distant building, never to a collision platform.
  rect(c, 7, 480, 170, 78, '#3e586966'); rect(c, 30, 470, 93, 10, '#748c9066'); for (let x = 36; x < 124; x += 12) rect(c, x, 492, 5, 41, '#a5b2a033'); line(c, [[37, 470], [37, 449], [139, 449], [139, 480]], '#546f7a70', 10);
  rect(c, 1052, 435, 130, 115, '#3e586957'); rect(c, 1072, 463, 88, 55, '#284a5a4c'); for (let x = 1080; x < 1150; x += 13) rect(c, x, 469, 4, 42, '#99a89233');
  brickWall(c, 210, 610, 780, 110, '#3f5660', '#2d434e', '#6a817747', 66, 22); rect(c, 210, 610, 780, 8, '#748a80'); rect(c, 218, 618, 764, 3, '#243d49');
  for (const x of [257, 809]) { panel(c, x, 643, 135, 65, '#29454f'); rect(c, x + 6, 649, 123, 4, '#77928b'); for (let xx = x + 12; xx < x + 127; xx += 12) rect(c, xx, 659, 3, 41, '#608279'); }
  panel(c, 496, 650, 208, 44, '#293f49', '#90a39a'); rect(c, 502, 656, 196, 32, '#3d5260'); c.font = 'bold 14px Consolas, monospace'; c.fillStyle = '#ecd1a1'; c.textAlign = 'center'; c.fillText('OVERTIME • 24H', 600, 677); rivet(c, 501, 654); rivet(c, 696, 654);
  for (const x of [217, 975]) { rect(c, x, 623, 8, 97, '#536e73'); rect(c, x + 2, 625, 2, 95, '#a0a98a'); }
  for (let i = 0; i < 18; i++) { const x = 214 + random() * 772, y = 620 + random() * 95; rect(c, x, y, 2, 2, '#b6b5942a'); }
}
function garden(c, random) {
  rounded(c, 106, 55, 92, 92, '#ece6ae', '#e0dfa8', 25); cloud(c, 692, 150, 250, '#edf0c540');
  for (let row = 0; row < 2; row++) for (let x = -25; x < 1200; x += 106) { const y = (row ? 284 : 225) + random() * 35; rect(c, x + 33, y + 42, 9, 205, row ? '#5f816633' : '#7a998044'); leaves(c, x - 5, y, 115, 86, row ? '#7c9b7055' : '#799b8440', '#d2d6a518'); }
  // The conservatory's recessed arches add depth without suggesting platforms.
  const shade = '#6e8c7957';
  for (const x of [24, 388, 752]) { rect(c, x, 322, 322, 20, '#839d8488'); rounded(c, x + 22, 337, 280, 172, shade, '#91a88b66', 42); rect(c, x + 22, 391, 280, 116, '#7b99894d'); for (let i = 0; i < 3; i++) { rect(c, x + 9 + i * 5, 344, 5, 173, '#b0b79a44'); rect(c, x + 305 + i * 5, 344, 5, 173, '#91a68a70'); } rect(c, x + 4, 514, 326, 12, '#73907977'); for (let yy = 353; yy < 516; yy += 34) { rect(c, x + 6, yy, 20, 1, '#577b674a'); rect(c, x + 308, yy, 20, 1, '#577b674a'); } }
  leaves(c, -15, 452, 197, 78, '#72885277', '#bdc19122'); leaves(c, 1037, 460, 180, 76, '#72885277', '#bdc19122');
  for (const x of [88, 1070]) { panel(c, x, 494, 46, 34, '#7e9576', '#bec29c'); rect(c, x - 4, 490, 54, 5, '#c6ccaa'); for (let i = 0; i < 7; i++) { const xx = x + 3 + i * 6; line(c, [[xx, 490], [xx + 3, 471 - (i % 3) * 9]], '#617f50', 2); rect(c, xx, 474 - (i % 3) * 9, 5, 4, '#c79f97'); rect(c, xx + 1, 474 - (i % 3) * 9, 2, 2, '#e6cdb0'); } }
  oval(c, 600, 560, 72, 10, '#769987', '#bbcba9', 3); rect(c, 591, 515, 18, 41, '#8aa28d'); rect(c, 594, 516, 3, 38, '#c7d1ad'); oval(c, 600, 514, 31, 6, '#b5c6a2'); poly(c, [[585, 511], [586, 503], [596, 498], [604, 498], [615, 503], [615, 511]], '#879f8b');
  brickWall(c, 130, 600, 940, 120, '#627c60', '#4d6655', '#b1bb8540', 79, 24); rect(c, 130, 601, 940, 6, '#9aac83'); rect(c, 145, 608, 910, 2, '#435d4d');
  for (let x = 155; x < 1070; x += 79) { rect(c, x, 610, 2, 74, '#a9b78c'); rect(c, x + 8, 661, 35, 3, '#91ab7966'); if (random() > .2) { line(c, [[x + 38, 607], [x + 32, 628], [x + 40, 647], [x + 36, 673]], '#3d634c', 3); for (let yy = 622; yy < 674; yy += 13) { rect(c, x + 31, yy, 7, 4, '#83a369'); rect(c, x + 38, yy + 5, 6, 3, '#a1ba7a'); } } }
  panel(c, 498, 665, 205, 29, '#415f51', '#9db893'); c.fillStyle = '#d5d9b0'; c.font = 'bold 11px Consolas, monospace'; c.textAlign = 'center'; c.fillText('THE GARDEN IS A STAGE', 600, 684);
}
function gear(c, x, y, r, fill) { const pts = []; for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, size = i % 3 ? r : r * 1.18; pts.push([x + Math.cos(a) * size, y + Math.sin(a) * size]); } poly(c, pts, fill, '#384a5540', 2); oval(c, x, y, r * .48, r * .48, '#4d515e66'); oval(c, x, y, r * .22, r * .22, '#98a08b35'); }
function foundry(c, random) {
  rect(c, 0, 0, 1200, 67, '#354352'); rect(c, 0, 68, 1200, 8, '#8d92924a');
  for (let x = 20; x < 1200; x += 145) { rect(c, x, 105, 123, 130, '#3c4457'); rounded(c, x + 7, 110, 109, 118, '#b18d7557', '#777b8944', 13); for (let xx = x + 13; xx < x + 116; xx += 27) rect(c, xx, 116, 3, 109, '#4b4a58'); rect(c, x + 7, 166, 110, 4, '#535565'); poly(c, [[x + 13, 123], [x + 46, 123], [x + 105, 214], [x + 72, 214]], '#e9bb8121'); }
  brickWall(c, 0, 252, 1200, 305, '#756b7280', '#5b556132', '#a5947c1a', 94, 32);
  rect(c, 0, 261, 1200, 12, '#45525b'); rect(c, 0, 263, 1200, 2, '#a8ad995b'); for (let x = 28; x < 1200; x += 166) { rect(c, x, 279, 13, 277, '#535d6477'); rect(c, x + 2, 279, 3, 277, '#aeb6a33a'); rect(c, x - 5, 294, 23, 6, '#40515c77'); rect(c, x - 5, 483, 23, 6, '#40515c77'); }
  for (const [x, y, r] of [[119, 415, 47], [1091, 357, 51], [1152, 448, 29]]) gear(c, x, y, r, '#9d93734d');
  for (const x of [54, 1118]) { panel(c, x, 327, 28, 220, '#63797a', '#acb39a'); for (let yy = 341; yy < 550; yy += 50) { panel(c, x - 5, yy, 38, 8, '#947b60'); rivet(c, x - 2, yy + 2); rivet(c, x + 29, yy + 2); } rect(c, x + 15, 338, 4, 200, '#334c5c'); }
  for (let x = 85; x < 1200; x += 260) { line(c, [[x, 76], [x, 288]], '#8b8d857f', 3); for (let yy = 83; yy < 275; yy += 15) rect(c, x - 2, yy, 5, 3, '#3d4756'); panel(c, x - 24, 282, 48, 12, '#424451', '#8c8780'); rect(c, x - 19, 295, 38, 4, '#f0cb8e'); poly(c, [[x - 20, 300], [x + 20, 300], [x + 53, 479], [x - 54, 479]], '#edc1910b'); }
  for (const x of [360, 770]) { rect(c, x + 12, 552, 47, 18, '#46555b'); rect(c, x + 17, 550, 36, 3, '#ddbb7f'); for (let xx = x + 20; xx < x + 53; xx += 8) rect(c, xx, 555, 3, 8, '#ad9f7a'); }
  brickWall(c, 170, 600, 860, 120, '#4b565d', '#34434c', '#83908740', 86, 25); rect(c, 170, 601, 860, 7, '#92a08d'); rect(c, 176, 608, 848, 3, '#273b48');
  for (let x = 187; x < 1010; x += 94) { panel(c, x, 619, 70, 54, '#34434e', '#788c89'); for (let xx = x + 7; xx < x + 65; xx += 9) rect(c, xx, 628, 3, 37, '#637b74'); rivet(c, x + 3, 624); rivet(c, x + 63, 624); }
  panel(c, 451, 683, 299, 27, '#35454c', '#9fac97'); c.fillStyle = '#e4c695'; c.font = 'bold 11px Consolas, monospace'; c.textAlign = 'center'; c.fillText('WARRANTY VOID IF PUNCHED', 600, 701);
  for (let i = 0; i < 24; i++) rect(c, 170 + random() * 860, 608 + random() * 110, 2, 2, '#d6c79d25');
}
export function paintPlatform(c, p, stageId) {
  const gardenStage = stageId === 'garden', foundryStage = stageId === 'foundry';
  const top = gardenStage ? '#d1d3a4' : foundryStage ? '#d6c195' : '#d0ceb6', body = gardenStage ? '#869775' : foundryStage ? '#728082' : '#839592';
  rect(c, p.x + 5, p.y + 7, p.w, p.h, '#263f4c32'); rect(c, p.x, p.y, p.w, p.h, '#30464b'); rect(c, p.x + 1, p.y + 1, p.w - 2, p.h - 2, body); rect(c, p.x, p.y, p.w, 3, top); rect(c, p.x + 1, p.y + 3, p.w - 2, 1, '#f6e6b855'); rect(c, p.x + 1, p.y + p.h - 4, p.w - 2, 3, '#4d6763');
  for (let x = p.x + 12; x < p.x + p.w - 9; x += 43) { rivet(c, x, p.y + 6, top); if (p.h > 20) { rect(c, x + 7, p.y + 9, 23, 1, '#c6ceb94f'); rect(c, x + 7, p.y + 17, 15, 1, '#253f4a3f'); } }
  if (!p.solid) { rect(c, p.x + 5, p.y + p.h, p.w - 10, 3, '#374e50'); for (const x of [p.x + 14, p.x + p.w - 38]) { poly(c, [[x, p.y + p.h + 2], [x + 12, p.y + p.h + 17], [x + 26, p.y + p.h + 2]], gardenStage ? '#799476' : '#546e72', '#304951'); line(c, [[x + 6, p.y + p.h + 4], [x + 13, p.y + p.h + 12]], top, 1); } }
  if (gardenStage) { for (let x = p.x + 11; x < p.x + p.w - 15; x += 68) { rect(c, x, p.y + p.h - 3, 3, 11, '#527d5a'); rect(c, x - 4, p.y + p.h + 4, 7, 3, '#94b477'); rect(c, x + 3, p.y + p.h + 8, 5, 3, '#718e58'); } }
  if (foundryStage) { for (let x = p.x + 7; x < p.x + p.w - 12; x += 38) poly(c, [[x, p.y + p.h - 9], [x + 12, p.y + p.h - 9], [x + 17, p.y + p.h - 5], [x + 5, p.y + p.h - 5]], '#c3a774'); }
}
export function paintStage(c, stageId) {
  const stage = STAGES[stageId] || STAGES.rooftop, random = seed(7125);
  const sky = c.createLinearGradient(0, 0, 0, 720);
  sky.addColorStop(0, stageId === 'garden' ? '#91b5a0' : stageId === 'foundry' ? '#384755' : '#868baf'); sky.addColorStop(.52, stageId === 'garden' ? '#cbd1a7' : stageId === 'foundry' ? '#8b797d' : '#e6b8a0'); sky.addColorStop(1, stageId === 'garden' ? '#728e72' : stageId === 'foundry' ? '#5b6468' : '#8a9a92'); c.fillStyle = sky; c.fillRect(0, 0, 1200, 720);
  if (stageId === 'rooftop') rooftop(c, random); else if (stageId === 'garden') garden(c, random); else foundry(c, random);
  for (const platform of stage.platforms) paintPlatform(c, platform, stageId);
}
