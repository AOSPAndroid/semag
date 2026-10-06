import { GAMES, roomUrl, getName, saveName, hostInfo, copyText } from './shared.js';
const $ = (id) => document.getElementById(id);
let name = getName(), origin = location.origin, rooms = [], toastTimer, creating = false;
$('hub-name').value = name; $('name-avatar').textContent = name[0].toUpperCase();
const emptyRooms = $('rooms-list').innerHTML;
function error(message) { $('hub-error').textContent = message; $('hub-error').hidden = !message; }
function toast(message) { $('hub-toast').textContent = message; $('hub-toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('hub-toast').hidden = true; }, 2500); }
function updateName() { name = saveName($('hub-name').value); $('hub-name').value = name; $('name-avatar').textContent = name[0].toUpperCase(); }
$('hub-name').addEventListener('change', updateName);
$('hub-name').addEventListener('keydown', (event) => { if (event.key === 'Enter') event.target.blur(); });
document.querySelectorAll('[data-create-game]').forEach(button => button.addEventListener('click', async () => {
  if (creating) return;
  updateName(); creating = true; error('');
  document.querySelectorAll('[data-create-game]').forEach(b => { b.disabled = true; });
  button.firstChild.textContent = 'Opening… ';
  try {
    const response = await fetch('/api/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameId: button.dataset.createGame, name: `${name}'s room` }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'The room could not be opened.');
    location.href = roomUrl(data.room);
  } catch (e) { error(e.message || 'Could not reach your host.'); creating = false; button.firstChild.textContent = 'Create room '; document.querySelectorAll('[data-create-game]').forEach(b => { b.disabled = false; }); }
}));
function renderRooms() {
  $('nav-room-count').textContent = rooms.length;
  const list = $('rooms-list');
  if (!rooms.length) { list.innerHTML = emptyRooms; return; }
  list.replaceChildren();
  for (const room of rooms) {
    const game = GAMES[room.gameId]; if (!game) continue;
    const count = room.players.filter(p => p?.connected).length;
    const row = document.createElement('div'); row.className = 'room-item'; row.dataset.roomId = room.id;
    const icon = document.createElement('div'); icon.className = 'room-icon'; icon.textContent = game.icon;
    const description = document.createElement('div');
    const title = document.createElement('strong'); title.textContent = room.players.find(p => p?.connected)?.name || room.name || game.title;
    const subtitle = document.createElement('small'); subtitle.textContent = `${game.title} · ${count}/2 players`;
    description.append(title, subtitle);
    const join = document.createElement('button'); join.textContent = count >= 2 ? 'Full' : 'Join'; join.disabled = count >= 2;
    join.addEventListener('click', () => { updateName(); location.href = roomUrl(room); });
    row.append(icon, description, join); list.append(row);
  }
}
async function refreshRooms() {
  try {
    const response = await fetch('/api/rooms'); if (!response.ok) throw new Error();
    const data = await response.json(); rooms = data.rooms || []; renderRooms();
    $('host-status').textContent = 'Host is online'; $('host-dot').classList.add('online');
  } catch { $('host-status').textContent = 'Host unavailable'; $('host-dot').classList.remove('online'); }
}
$('join-form').addEventListener('submit', async (event) => {
  event.preventDefault(); updateName(); $('join-error').hidden = true;
  let code = $('room-code').value.trim().toUpperCase();
  try { if (/^https?:\/\//i.test(code)) code = new URL($('room-code').value.trim()).searchParams.get('room')?.toUpperCase() || ''; } catch { code = ''; }
  if (!/^[A-Z0-9]{6}$/.test(code)) { $('join-error').textContent = 'Enter the six-character room code or an invite link.'; $('join-error').hidden = false; return; }
  $('join-button').disabled = true;
  try {
    await refreshRooms();
    const room = rooms.find(room => room.id === code);
    if (!room) throw new Error('Room not found. Check the code or ask your friend to create a new room.');
    if (room.players.filter(p => p?.connected).length >= 2) throw new Error('Both seats are taken in that room.');
    location.href = roomUrl(room);
  } catch (e) { $('join-error').textContent = e.message; $('join-error').hidden = false; $('join-button').disabled = false; }
});
$('copy-hub').addEventListener('click', async () => { try { await copyText(origin); toast('Hub address copied. Bring a friend.'); } catch (e) { toast(e.message); } });
hostInfo().then(info => { origin = info.origin; $('hub-address').textContent = origin; $('hub-download').hidden = !info.downloadAvailable; }).catch(() => { $('hub-address').textContent = origin; });
refreshRooms(); setInterval(refreshRooms, 2000);

// Cards show the games' own renderers; no remote images or asset downloads.
async function drawPreviews() {
  const renderers = [];
  const requests = await Promise.allSettled([
    (async () => {
      const [{ createState }, { ArenaRenderer }] = await Promise.all([import('../engine.js'), import('../renderer.js')]);
      const canvas = $('preview-afterimage'), renderer = new ArenaRenderer(canvas); renderers.push(renderer);
      const state = createState(); state.fighters[0].x = 445; state.fighters[1].x = 755;
      const draw = () => renderer.render(state, { time: 1600, camera: 'crop' }); draw(); return draw;
    })(),
    (async () => {
      const [engine, { TopdownRenderer }] = await Promise.all([import('../topdown-engine.js'), import('../topdown-renderer.js')]);
      const draws = [];
      for (const [id, mode] of [['preview-duel', 'duel'], ['preview-coop', 'coop']]) {
        const renderer = new TopdownRenderer($(id)); renderers.push(renderer);
        const state = engine.createState(mode); engine.startMatch(state);
        for (let i = 0; i < 361; i++) engine.step(state, [engine.emptyInput(), engine.emptyInput()]);
        const draw = () => renderer.render(state, { time: 1200 }); draw(); draws.push(draw);
      }
      return () => draws.forEach(draw => draw());
    })(),
  ]);
  const draws = requests.filter(r => r.status === 'fulfilled').map(r => r.value);
  const drawBoard = () => {
    const canvas = $('preview-checkers'), ctx = canvas.getContext('2d');
    const dpr = Math.min(devicePixelRatio || 1, 2), rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
    ctx.setTransform(canvas.width / 900, 0, 0, canvas.height / 600, 0, 0);
    const background = ctx.createLinearGradient(0, 0, 900, 600); background.addColorStop(0, '#d7c39b'); background.addColorStop(1, '#ac956e');
    ctx.fillStyle = background; ctx.fillRect(0, 0, 900, 600);
    ctx.save(); ctx.translate(450, 345); ctx.rotate(-.14); ctx.scale(1.05, .8); ctx.translate(-245, -245);
    ctx.shadowColor = '#51402d55'; ctx.shadowBlur = 35; ctx.shadowOffsetY = 19; ctx.fillStyle = '#69583c'; ctx.fillRect(-20, -20, 530, 530); ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { ctx.fillStyle = (r + c) % 2 ? '#71836a' : '#f0e3c5'; ctx.fillRect(c * 61.25, r * 61.25, 61.25, 61.25); }
    for (const [r, c, green, king] of [[1, 2, true, false], [1, 6, true, false], [2, 1, true, false], [2, 5, true, true], [3, 4, true, false], [4, 3, false, false], [5, 0, false, false], [5, 4, false, true], [6, 1, false, false], [6, 5, false, false]]) {
      const x = c * 61.25 + 30.625, y = r * 61.25 + 30.625;
      ctx.fillStyle = '#26362333'; ctx.beginPath(); ctx.ellipse(x + 1, y + 7, 23, 22, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = green ? '#35583d' : '#dbcda7'; ctx.beginPath(); ctx.arc(x, y + 3, 23, 0, Math.PI * 2); ctx.fill();
      const fill = ctx.createRadialGradient(x - 10, y - 12, 1, x, y, 28); fill.addColorStop(0, green ? '#84a46e' : '#fffbea'); fill.addColorStop(1, green ? '#456943' : '#e7d8b5');
      ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, 23, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = green ? '#b8ca9444' : '#baaa8555'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(x, y, 17, 0, Math.PI * 2); ctx.stroke();
      if (king) { ctx.fillStyle = green ? '#d9daa0' : '#ae9255'; ctx.beginPath(); ctx.moveTo(x - 10, y - 6); ctx.lineTo(x - 7, y + 7); ctx.lineTo(x + 7, y + 7); ctx.lineTo(x + 10, y - 6); ctx.lineTo(x + 3, y - 1); ctx.lineTo(x, y - 9); ctx.lineTo(x - 3, y - 1); ctx.closePath(); ctx.fill(); }
    }
    ctx.restore();
  };
  drawBoard(); draws.push(drawBoard);
  window.addEventListener('resize', () => { renderers.forEach(r => r.resize()); draws.forEach(draw => draw()); });
}
drawPreviews();
