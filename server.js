import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { WebSocket, WebSocketServer } from 'ws';
import * as Afterimage from './public/engine.js';
import * as Checkers from './public/checkers-engine.js';
import * as Topdown from './public/topdown-engine.js';
import * as Cards from './public/cards-engine.js';

const TICK_RATE = 120;
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.zip': 'application/zip',
};
const GAMES = {
  afterimage: { title: 'Afterimage Duel', engine: Afterimage, makeState: () => Afterimage.createState(), inputKeys: Afterimage.INPUT_KEYS },
  checkers: { title: 'Checkers', engine: Checkers, makeState: () => Checkers.createState(), inputKeys: [] },
  'relic-duel': { title: 'Relic Duel', engine: Topdown, makeState: () => Topdown.createState('duel'), inputKeys: Topdown.INPUT_KEYS },
  'dungeon-run': { title: 'Dungeon Run', engine: Topdown, makeState: () => Topdown.createState('coop'), inputKeys: Topdown.INPUT_KEYS },
  'crazy-eights': { title: 'Crazy Eights', engine: Cards, makeState: () => Cards.createState('crazy-eights'), inputKeys: [], viewForPlayer: Cards.viewForPlayer },
  'twenty-one': { title: '21 Duel', engine: Cards, makeState: () => Cards.createState('twenty-one'), inputKeys: [], viewForPlayer: Cards.viewForPlayer },
  memory: { title: 'Memory Match', engine: Cards, makeState: () => Cards.createState('memory'), inputKeys: [], viewForPlayer: Cards.viewForPlayer },
};
const cleanName = (name, maximum) => name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, maximum);
const freshInput = room => Object.fromEntries(room.adapter.inputKeys.map(key => [key, false]));
const isFile = filename => stat(filename).then(info => info.isFile(), () => false);

function json(res, status, data, head = false) {
  res.writeHead(status, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(head ? undefined : JSON.stringify(data));
}

function readJSON(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    let tooLarge = Number(req.headers['content-length'] || 0) > 4096;
    const timer = setTimeout(() => {
      reject(Object.assign(new Error('Request body timed out.'), { status: 408 }));
      req.resume();
    }, 5000);
    req.on('data', chunk => {
      size += chunk.length;
      if (size > 4096) tooLarge = true;
      if (!tooLarge) chunks.push(chunk);
    });
    req.on('end', () => {
      clearTimeout(timer);
      if (tooLarge) { reject(Object.assign(new Error('Request body exceeds 4 KB.'), { status: 413 })); return; }
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
        resolve(body);
      } catch { reject(Object.assign(new Error('Send a valid JSON object.'), { status: 400 })); }
    });
    const failed = () => { clearTimeout(timer); reject(Object.assign(new Error('Request was interrupted.'), { status: 400 })); };
    req.on('error', failed); req.on('aborted', failed);
  });
}

async function serveFile(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }); res.end('Method not allowed'); return;
  }
  const download = pathname === '/download/fireside-hub.zip' || pathname === '/download/afterimage-duel.zip';
  let filename;
  if (download) {
    filename = path.join(ROOT, 'downloads', 'fireside-hub.zip');
    if (pathname.endsWith('afterimage-duel.zip') && !await isFile(filename)) filename = path.join(ROOT, 'downloads', 'afterimage-duel.zip');
  } else filename = path.resolve(PUBLIC, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (!download && !filename.startsWith(PUBLIC + path.sep)) { res.writeHead(403); res.end('Forbidden'); return; }
  try {
    const info = await stat(filename);
    if (!info.isFile()) throw new Error('Not a file');
    const headers = {
      'Content-Type': MIME[path.extname(filename).toLowerCase()] || 'application/octet-stream',
      'Content-Length': info.size, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff',
    };
    if (download) headers['Content-Disposition'] = `attachment; filename="${path.basename(filename)}"`;
    res.writeHead(200, headers);
    if (req.method === 'HEAD') res.end();
    else createReadStream(filename).on('error', () => res.destroy()).pipe(res);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Not found');
  }
}

/** Creates a PC-hosted hub with independent authoritative, two-player rooms. */
export function createServer(options = {}) {
  const rooms = new Map();
  const creationRates = new Map();
  const maxRooms = Math.max(1, Math.min(100, options.maxRooms ?? 100));
  const creationLimit = options.creationLimit ?? 20;
  let ticker = null;
  let heartbeat = null;
  let maintenance = null;
  let closing = false;
  let accumulator = 0;
  let lastTime = performance.now();

  function makeRoom(id, gameId, name) {
    const adapter = GAMES[gameId];
    const createdAt = Date.now();
    return {
      id, gameId, name: cleanName(name || adapter.title, 48) || adapter.title,
      adapter, createdAt, emptySince: createdAt, hadPlayers: false, sessionId: randomUUID(),
      state: adapter.makeState(), players: [null, null], slots: [null, null], acks: [-1, -1],
      lastBroadcastTick: -12, lastBroadcastRevision: -1,
    };
  }
  const legacyRoom = makeRoom(null, 'afterimage', 'Afterimage Duel');
  const allRooms = () => [legacyRoom, ...rooms.values()];
  const summary = room => ({ id: room.id, gameId: room.gameId, name: room.name, players: room.players, phase: room.state.phase, createdAt: room.createdAt });
  function reapRooms(now = Date.now()) {
    for (const [id, room] of rooms) {
      if (room.slots.some(Boolean)) continue;
      const lifetime = room.hadPlayers ? 60_000 : 600_000;
      const emptyFrom = room.hadPlayers ? room.emptySince : room.createdAt;
      if (now - emptyFrom >= lifetime) rooms.delete(id);
    }
    for (const [ip, rate] of creationRates) if (now - rate.startedAt > 120_000) creationRates.delete(ip);
  }
  function createRoom(gameId, name) {
    if (!Object.hasOwn(GAMES, gameId)) throw Object.assign(new Error('Choose an available game.'), { status: 400 });
    if (name !== undefined && typeof name !== 'string') throw Object.assign(new Error('Room name must be text.'), { status: 400 });
    reapRooms();
    if (rooms.size >= maxRooms) throw Object.assign(new Error('The hub has reached its room limit. Try again after an empty room closes.'), { status: 503 });
    let id;
    do { id = [...randomBytes(6)].map(byte => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join(''); } while (rooms.has(id));
    const room = makeRoom(id, gameId, name);
    rooms.set(id, room);
    return room;
  }

  async function handleHTTP(req, res) {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
    catch { json(res, 400, { error: 'Invalid URL.' }); return; }
    if (pathname.includes('\0') || pathname.includes('\\')) { json(res, 400, { error: 'Invalid path.' }); return; }
    const head = req.method === 'HEAD';
    if (pathname === '/api/rooms') {
      reapRooms();
      if (req.method === 'GET' || head) {
        const now = Date.now();
        json(res, 200, { rooms: [...rooms.values()].filter(room => room.slots.some(Boolean) || now - room.createdAt < 60_000).map(summary) }, head);
        return;
      }
      if (req.method !== 'POST') { res.writeHead(405, { Allow: 'GET, HEAD, POST' }); res.end('Method not allowed'); return; }
      const now = Date.now();
      const ip = req.socket.remoteAddress || 'local';
      let rate = creationRates.get(ip);
      if (!rate || now - rate.startedAt >= 60_000) { rate = { startedAt: now, count: 0 }; creationRates.set(ip, rate); }
      if (++rate.count > creationLimit) {
        req.resume(); res.setHeader('Retry-After', '60'); json(res, 429, { error: 'Too many room requests. Please wait a minute.' }); return;
      }
      try {
        const data = await readJSON(req);
        if (typeof data.gameId !== 'string') throw Object.assign(new Error('Choose an available game.'), { status: 400 });
        const room = createRoom(data.gameId, data.name);
        json(res, 201, { room: summary(room) });
      } catch (error) { if (!res.writableEnded) json(res, error.status || 400, { error: error.message }); }
      return;
    }
    if (pathname === '/health' || pathname === '/api/host-info') {
      if (req.method !== 'GET' && !head) { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end('Method not allowed'); return; }
      if (pathname === '/health') { json(res, 200, { ok: true, tickRate: TICK_RATE, games: Object.keys(GAMES) }, head); return; }
      const hostname = os.hostname();
      const port = req.socket.localPort;
      const addresses = Object.values(os.networkInterfaces()).flatMap(items => (items || [])
        .filter(item => item.family === 'IPv4' && !item.internal).map(item => item.address));
      const downloadAvailable = await isFile(path.join(ROOT, 'downloads', 'fireside-hub.zip'));
      json(res, 200, { hostname, port, addresses, inviteUrl: `http://${hostname}:${port}`, downloadAvailable }, head);
      return;
    }
    await serveFile(req, res, pathname);
  }
  const server = http.createServer((req, res) => {
    handleHTTP(req, res).catch(() => { if (!res.headersSent) json(res, 500, { error: 'Server error.' }); else res.end(); });
  });
  server.headersTimeout = 15_000;
  server.requestTimeout = 15_000;
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4096, perMessageDeflate: false });

  function send(ws, data) {
    if (ws.readyState === WebSocket.OPEN) ws.send(typeof data === 'string' ? data : JSON.stringify(data));
  }
  function error(ws, message) { send(ws, { type: 'error', message }); }
  function broadcast(selectedRoom) {
    for (const room of selectedRoom ? [selectedRoom] : allRooms()) {
      if (!room.slots.some(Boolean)) continue;
      const envelope = { type: 'state', roomId: room.id, gameId: room.gameId, players: room.players, acks: room.acks };
      // Hidden-information games never share their internal state, even in the lobby.
      const message = room.adapter.viewForPlayer ? null : JSON.stringify({ ...envelope, state: room.state });
      for (const slot of room.slots) {
        if (!slot || slot.ws.readyState !== WebSocket.OPEN) continue;
        if (slot.ws.bufferedAmount > 1024 * 1024) { slot.ws.terminate(); continue; }
        if (slot.ws.bufferedAmount < 128 * 1024) {
          send(slot.ws, message ?? { ...envelope, state: room.adapter.viewForPlayer(room.state, slot.id) });
        }
      }
      room.lastBroadcastTick = room.state.tick;
      room.lastBroadcastRevision = room.state.revision;
    }
  }
  function resetInputs(room) {
    for (const slot of room.slots) {
      if (!slot) continue;
      slot.queue.length = 0; slot.buttons = freshInput(room);
      room.acks[slot.id] = slot.lastAccepted;
    }
  }
  function returnToLobby(room) {
    room.adapter.engine.resetLobby(room.state); resetInputs(room);
    for (const player of room.players) if (player) player.ready = false;
  }
  function maybeStart(room) {
    if (room.state.phase === 'lobby' && room.players.every(p => p?.connected && p.ready)) {
      resetInputs(room); room.adapter.engine.startMatch(room.state);
    }
  }
  function tick() {
    const now = performance.now();
    for (const room of allRooms()) {
      const inputs = room.slots.map((slot, index) => {
        if (!slot) return freshInput(room);
        if (slot.queue.length) {
          const command = slot.queue.shift(); slot.buttons = command.buttons; room.acks[index] = command.seq;
        } else if (now - slot.lastInputTime > 350) slot.buttons = freshInput(room);
        return slot.buttons;
      });
      const previousPhase = room.state.phase;
      room.adapter.engine.step(room.state, inputs);
      if (previousPhase === 'countdown' && ['fight', 'roundEnd', 'matchEnd'].includes(room.state.phase)) {
        for (const player of room.players) if (player) player.ready = false;
      }
      // Card actions broadcast immediately; a 10 Hz heartbeat keeps idle tables alive.
      if (room.adapter.viewForPlayer) {
        if (room.state.revision !== room.lastBroadcastRevision || room.state.tick - room.lastBroadcastTick >= 12) broadcast(room);
      } else if (room.state.tick % 2 === 0) broadcast(room);
    }
  }
  function pump() {
    const now = performance.now();
    accumulator += Math.min(250, now - lastTime); lastTime = now;
    const quantum = 1000 / TICK_RATE;
    let iterations = 0;
    while (accumulator >= quantum && iterations < 16) { tick(); accumulator -= quantum; iterations += 1; }
    if (iterations === 16) accumulator = Math.min(accumulator, quantum * 2);
  }
  function startTicker() {
    if (!maintenance) maintenance = setInterval(reapRooms, 10_000);
    if (ticker || options.autoTick === false) return;
    lastTime = performance.now(); accumulator = 0;
    ticker = setInterval(pump, 4);
    heartbeat = setInterval(() => {
      for (const room of allRooms()) for (const slot of room.slots) {
        if (!slot) continue;
        if (!slot.alive) { slot.ws.terminate(); continue; }
        slot.alive = false; slot.ws.ping();
      }
    }, 10_000);
  }

  server.on('upgrade', (req, socket, head) => {
    let pathname;
    try { pathname = new URL(req.url, 'http://localhost').pathname; } catch { socket.destroy(); return; }
    if (pathname !== '/ws' || closing) { socket.destroy(); return; }
    if (req.headers.origin) {
      try {
        if (new URL(req.headers.origin).host.toLowerCase() !== String(req.headers.host).toLowerCase()) {
          socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); socket.destroy(); return;
        }
      } catch { socket.destroy(); return; }
    }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
  });

  wss.on('connection', (ws, req) => {
    ws.on('error', () => {});
    const query = new URL(req.url, 'http://localhost').searchParams;
    let room = legacyRoom;
    if (query.has('room')) {
      const roomId = query.get('room').trim().toUpperCase();
      reapRooms(); room = rooms.get(roomId);
      if (!/^[A-Z0-9]{6}$/.test(roomId) || !room) {
        error(ws, 'This room does not exist or has expired. Return to the hub to create a new room.');
        ws.close(4404, 'Room not found'); return;
      }
    }
    const id = room.slots.findIndex(slot => slot === null);
    if (id === -1) {
      error(ws, 'This room already has two players. Ask a player to disconnect before joining.');
      ws.close(4403, 'Room full'); return;
    }
    const slot = {
      id, ws, queue: [], buttons: freshInput(room), lastAccepted: -1,
      lastInputTime: performance.now(), alive: true, rateWindow: performance.now(), messages: 0,
    };
    room.slots[id] = slot;
    room.players[id] = { name: `Player ${id + 1}`, connected: true, ready: false };
    room.acks[id] = -1; room.hadPlayers = true; room.emptySince = null;
    send(ws, { type: 'welcome', playerId: id, roomId: room.id, gameId: room.gameId, sessionId: room.sessionId, tickRate: TICK_RATE });
    broadcast(room);
    ws.on('pong', () => { slot.alive = true; });
    ws.on('message', (raw, isBinary) => {
      if (closing || room.slots[id] !== slot) return;
      const now = performance.now();
      if (now - slot.rateWindow >= 1000) { slot.rateWindow = now; slot.messages = 0; }
      if (++slot.messages > 300) { error(ws, 'Too many messages.'); ws.close(4408, 'Rate limit'); return; }
      if (isBinary) { error(ws, 'Messages must be JSON text.'); return; }
      let data;
      try { data = JSON.parse(raw.toString()); } catch { error(ws, 'Invalid JSON message.'); return; }
      if (!data || typeof data !== 'object' || Array.isArray(data)) { error(ws, 'Invalid message.'); return; }
      const state = room.state;
      if (data.type === 'join') {
        if (typeof data.name !== 'string') { error(ws, 'A player name is required.'); return; }
        room.players[id].name = cleanName(data.name, 24) || `Player ${id + 1}`;
        broadcast(room);
      } else if (data.type === 'ready') {
        if (typeof data.ready !== 'boolean') { error(ws, 'Ready must be true or false.'); return; }
        if (state.phase !== 'lobby' && !(state.phase === 'countdown' && (state.round ?? 1) === 1)) {
          error(ws, 'Readiness can change in the lobby or before the first round.'); return;
        }
        if (state.phase === 'countdown' && !data.ready) returnToLobby(room);
        else room.players[id].ready = data.ready;
        maybeStart(room); broadcast(room);
      } else if (data.type === 'rematch') {
        if (state.phase !== 'matchEnd' && state.phase !== 'lobby') { error(ws, 'Finish the current match before requesting a rematch.'); return; }
        if (state.phase === 'matchEnd') returnToLobby(room);
        room.players[id].ready = true;
        maybeStart(room); broadcast(room);
      } else if (data.type === 'ping') {
        if (typeof data.time !== 'number' || !Number.isFinite(data.time)) { error(ws, 'Invalid ping timestamp.'); return; }
        send(ws, { type: 'pong', time: data.time });
      } else if (data.type === 'move') {
        if (room.gameId !== 'checkers') { error(ws, 'Board moves are only available in Checkers.'); return; }
        if (!Number.isInteger(data.from) || !Number.isInteger(data.to) || data.from < 0 || data.from > 63 || data.to < 0 || data.to > 63) {
          error(ws, 'Choose two board squares from 0 to 63.'); return;
        }
        const result = room.adapter.engine.applyMove(state, id, data.from, data.to);
        if (!result.ok) error(ws, result.error || 'That move is not legal.');
        else broadcast(room);
      } else if (data.type === 'card-action') {
        if (!room.adapter.viewForPlayer) { error(ws, 'Card actions are only available at card tables.'); return; }
        if (!data.action || typeof data.action !== 'object' || Array.isArray(data.action) || typeof data.action.kind !== 'string') {
          error(ws, 'Choose a valid card action.'); return;
        }
        const result = room.adapter.engine.applyAction(state, id, data.action);
        if (!result.ok) error(ws, result.error || 'That card action is not legal.');
        else broadcast(room);
      } else if (data.type === 'input') {
        if (!room.adapter.inputKeys.length) { error(ws, room.gameId === 'checkers' ? 'Checkers uses board moves instead of realtime controls.' : 'Card games use card actions instead of realtime controls.'); return; }
        if (!Number.isSafeInteger(data.seq) || data.seq < 0 || data.seq > 1_000_000_000) { error(ws, 'Invalid input sequence.'); return; }
        if (!data.buttons || typeof data.buttons !== 'object' || Array.isArray(data.buttons) ||
            Object.keys(data.buttons).some(key => !room.adapter.inputKeys.includes(key) || typeof data.buttons[key] !== 'boolean')) {
          error(ws, 'Input buttons must contain only valid boolean controls for this game.'); return;
        }
        if (data.seq <= slot.lastAccepted) return;
        if (data.seq - slot.lastAccepted > 600) { error(ws, 'Input sequence is too far ahead.'); return; }
        if (slot.queue.length >= 60) { error(ws, 'Input queue is full.'); return; }
        const buttons = freshInput(room);
        for (const key of room.adapter.inputKeys) buttons[key] = data.buttons[key] === true;
        slot.queue.push({ seq: data.seq, buttons }); slot.lastAccepted = data.seq; slot.lastInputTime = now;
      } else error(ws, 'Unknown message type.');
    });
    ws.on('close', () => {
      if (room.slots[id] !== slot) return;
      room.slots[id] = null; room.players[id] = null; room.acks[id] = -1;
      if (!room.slots.some(Boolean)) room.emptySince = Date.now();
      returnToLobby(room); broadcast(room);
    });
  });

  server.on('listening', startTicker);
  async function listen(port = options.port ?? Number(process.env.PORT || 3000), host = options.host ?? '0.0.0.0') {
    if (server.listening) return server.address();
    await new Promise((resolve, reject) => {
      const failed = error => { server.off('listening', succeeded); reject(error); };
      const succeeded = () => { server.off('error', failed); resolve(); };
      server.once('error', failed); server.once('listening', succeeded); server.listen(port, host);
    });
    return server.address();
  }
  async function close() {
    closing = true;
    for (const timer of [ticker, heartbeat, maintenance]) if (timer) clearInterval(timer);
    ticker = heartbeat = maintenance = null;
    for (const client of wss.clients) client.terminate();
    await new Promise(resolve => wss.close(resolve));
    if (server.listening) await new Promise(resolve => { server.close(resolve); server.closeAllConnections?.(); });
  }
  return {
    server, httpServer: server, wss, state: legacyRoom.state, players: legacyRoom.players, acks: legacyRoom.acks,
    rooms, legacyRoom, createRoom, reapRooms, listen, close, tick, broadcast,
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const game = createServer();
  game.listen().then(address => {
    const port = address.port;
    console.log('\nFIRESIDE GAME HUB · your PC, your game night');
    console.log(`Open the hub:      http://localhost:${port}`);
    console.log(`Share hostname:    http://${os.hostname()}:${port}`);
    for (const interfaces of Object.values(os.networkInterfaces())) for (const adapter of interfaces || []) {
      if (adapter.family === 'IPv4' && !adapter.internal) console.log(`Share LAN address: http://${adapter.address}:${port}`);
    }
    console.log('Create a room, invite a colleague, and both mark ready. Ctrl+C stops the hub.\n');
  }).catch(error => { console.error(`Cannot start game hub: ${error.message}`); process.exitCode = 1; });
  let stopping = false;
  const stop = async () => { if (stopping) return; stopping = true; await game.close(); process.exitCode = 0; };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}
