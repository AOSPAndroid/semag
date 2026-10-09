import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { promisify } from 'node:util';
import { brotliCompress, gzip, constants as zlibConstants } from 'node:zlib';
import { WebSocket, WebSocketServer } from 'ws';
import * as Afterimage from './public/engine.js';
import * as Checkers from './public/checkers-engine.js';
import * as Topdown from './public/topdown-engine.js';
import * as Cards from './public/cards-engine.js';
import * as Vector from './public/vector-engine.js';
import * as Shinobi from './public/shinobi-engine.js';
import * as Voxel from './public/voxel-engine.js';
import * as Royale from './public/voxel-royale-engine.js';
import * as Horde from './public/voxel-horde-engine.js';
import { MELEE_WEAPONS } from './public/voxel-melee.js';
import { enableLagCompensation, isValidViewTick, setShotViewTick } from './public/voxel-lag-compensation.js';
import * as Brawl from './public/brawl-engine.js';
import { createFpsInputQueue, FPS_EDGE_ACTIONS } from './public/voxel-input-queue.js';

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
  'vector-arena': {
    title: 'Vector Arena', engine: Vector, makeState: () => Vector.createState(), inputKeys: Vector.INPUT_KEYS,
    numericControls: { aimX: { min: -1, max: 1, default: 1 }, aimY: { min: -1, max: 1, default: 0 } },
  },
  'shinobi-showdown': {
    title: 'Shinobi Showdown', engine: Shinobi, makeState: () => Shinobi.createState(), inputKeys: Shinobi.INPUT_KEYS,
    numericControls: { aimX: { min: -1, max: 1, default: 1 }, aimY: { min: -1, max: 1, default: 0 } },
  },
  'voxel-breach': {
    title: 'Voxel Breach', engine: Voxel, makeState: settings => Voxel.createState(settings), inputKeys: Voxel.INPUT_KEYS,
    numericControls: { yaw: { min: -Math.PI, max: Math.PI, default: 0 }, pitch: { min: -1.35, max: 1.35, default: 0 } },
    latestInput: true, snapshotInterval: 4, compensateHitscan: true,
    snapshotState: state => ({ ...state, fighters: undefined }),
  },
  'voxel-royale': {
    title: 'Voxel Royale', engine: Royale, makeState: settings => Royale.createState(settings), inputKeys: Royale.INPUT_KEYS,
    numericControls: { yaw: { min: -Math.PI, max: Math.PI, default: 0 }, pitch: { min: -1.35, max: 1.35, default: 0 } },
    latestInput: true, snapshotInterval: 4, compensateHitscan: true,
    snapshotState: state => ({ ...state, map: undefined, fighters: undefined }),
  },
  'voxel-horde': {
    title: 'Voxel Last Stand', engine: Horde, makeState: settings => Horde.createState(settings), inputKeys: Horde.INPUT_KEYS,
    numericControls: { yaw: { min: -Math.PI, max: Math.PI, default: 0 }, pitch: { min: -1.35, max: 1.35, default: 0 } },
    latestInput: true, snapshotInterval: 4, compensateHitscan: true,
    snapshotState: state => ({ ...state, map: undefined, fighters: undefined, horde: { ...state.horde, brains: undefined } }),
  },
  'oddstock-rumble': { title: 'Oddstock Rumble', engine: Brawl, makeState: () => Brawl.createState(), inputKeys: Brawl.INPUT_KEYS, selectionComplete: Brawl.selectionComplete },
};
const cleanName = (name, maximum) => name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, maximum);
function freshInput(room, playerId, previous) {
  const input = Object.fromEntries(room.adapter.inputKeys.map(key => [key, false]));
  for (const [key, limits] of Object.entries(room.adapter.numericControls || {})) {
    const retained = room.adapter.latestInput ? previous?.[key] ?? room.state.players?.[playerId]?.[key] : undefined;
    input[key] = validControl(room.adapter, key, retained) ? retained : limits.default;
  }
  return input;
}
function validControl(adapter, key, value) {
  if (adapter.inputKeys.includes(key)) return typeof value === 'boolean';
  if (!Object.hasOwn(adapter.numericControls || {}, key)) return false;
  const limits = adapter.numericControls[key];
  return typeof value === 'number' && Number.isFinite(value) && value >= limits.min && value <= limits.max;
}
const isFile = filename => stat(filename).then(info => info.isFile(), () => false);
const compressBrotli = promisify(brotliCompress), compressGzip = promisify(gzip);
const assetCache = new Map();
const ASSET_CACHE_BYTES = 16 * 1024 * 1024;
let assetCacheBytes = 0;

function encodingFor(header = '') {
  const accepted = new Map(String(header).toLowerCase().split(',').map(part => {
    const [name, ...params] = part.trim().split(';');
    const quality = params.find(param => param.trim().startsWith('q='));
    return [name, quality === undefined ? 1 : Number(quality.trim().slice(2))];
  }));
  const quality = name => accepted.get(name) ?? accepted.get('*') ?? 0;
  if (quality('br') > 0 && quality('br') >= quality('gzip')) return 'br';
  return quality('gzip') > 0 ? 'gzip' : null;
}

async function encodedAsset(filename, info, encoding) {
  const key = `${filename}:${info.size}:${info.mtimeMs}:${encoding}`;
  let entry = assetCache.get(key);
  if (entry) { assetCache.delete(key); assetCache.set(key, entry); return entry.promise; }
  entry = { bytes: 0, promise: null };
  entry.promise = (async () => {
    const source = await readFile(filename);
    const result = encoding === 'br'
      ? await compressBrotli(source, { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 4 } })
      : await compressGzip(source);
    // Evicted in-flight entries may finish after another request starts them.
    if (assetCache.get(key) === entry) {
      entry.bytes = result.length; assetCacheBytes += result.length;
      while (assetCacheBytes > ASSET_CACHE_BYTES && assetCache.size) {
        const oldest = assetCache.keys().next().value;
        assetCacheBytes -= assetCache.get(oldest).bytes; assetCache.delete(oldest);
      }
    }
    return result;
  })().catch(error => { if (assetCache.get(key) === entry) assetCache.delete(key); throw error; });
  assetCache.set(key, entry);
  // Also bound in-flight entries and tiny files by count.
  while (assetCache.size > 256) {
    const oldest = assetCache.keys().next().value;
    assetCacheBytes -= assetCache.get(oldest).bytes; assetCache.delete(oldest);
  }
  return entry.promise;
}

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
      ETag: `W/"${info.size.toString(16)}-${info.mtimeMs.toString(16)}"`,
      'Last-Modified': info.mtime.toUTCString(),
    };
    if (download) headers['Content-Disposition'] = `attachment; filename="${path.basename(filename)}"`;
    const compressible = !download && info.size >= 1024 && info.size <= 512 * 1024 && /\.(?:html|js|css|json|svg)$/i.test(filename);
    if (compressible) headers.Vary = 'Accept-Encoding';
    const validators = String(req.headers['if-none-match'] || '').split(',').map(value => value.trim());
    // If-None-Match uses weak comparison even when a client sends a strong tag.
    const weakTag = value => value.replace(/^W\//, '');
    const notModified = req.headers['if-none-match'] !== undefined
      ? validators.some(value => value === '*' || weakTag(value) === weakTag(headers.ETag))
      : req.headers['if-modified-since'] !== undefined && Math.floor(info.mtimeMs / 1000) * 1000 <= Date.parse(req.headers['if-modified-since']);
    if (notModified) {
      delete headers['Content-Length']; res.writeHead(304, headers); res.end(); return;
    }
    const encoding = compressible ? encodingFor(req.headers['accept-encoding']) : null;
    if (encoding) {
      const content = await encodedAsset(filename, info, encoding);
      headers['Content-Encoding'] = encoding; headers['Content-Length'] = content.length;
      res.writeHead(200, headers); res.end(req.method === 'HEAD' ? undefined : content); return;
    }
    res.writeHead(200, headers);
    if (req.method === 'HEAD') res.end();
    else createReadStream(filename).on('error', () => res.destroy()).pipe(res);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Not found');
  }
}

/** Creates a PC-hosted hub with independent authoritative game rooms. */
export function createServer(options = {}) {
  const rooms = new Map();
  const occupiedRooms = new Set();
  const creationRates = new Map();
  const maxRooms = Math.max(1, Math.min(100, options.maxRooms ?? 100));
  const creationLimit = options.creationLimit ?? 20;
  let ticker = null;
  let heartbeat = null;
  let maintenance = null;
  let closing = false;
  let accumulator = 0;
  let lastTime = performance.now();

  function makeRoom(id, gameId, name, settings = {}) {
    const adapter = GAMES[gameId];
    const createdAt = Date.now();
    const teamSize = gameId === 'voxel-breach' ? settings.teamSize : ['voxel-royale', 'voxel-horde'].includes(gameId) ? undefined : 1;
    const capacity = gameId === 'voxel-horde' ? 3 : gameId === 'voxel-royale' ? settings.capacity : teamSize * 2;
    const mapId = ['voxel-breach', 'voxel-royale', 'voxel-horde'].includes(gameId) ? settings.mapId : undefined;
    const maps = gameId === 'voxel-horde' ? Horde.MAPS : gameId === 'voxel-royale' ? Royale.MAPS : Voxel.MAPS;
    const difficulty = gameId === 'voxel-horde' ? settings.difficulty : undefined;
    const melee = gameId === 'voxel-horde' ? settings.melee : undefined;
    const state = adapter.makeState({ teamSize, capacity, mapId, difficulty, ...(gameId === 'voxel-horde' ? { melee } : {}) });
    if (gameId === 'voxel-horde') for (let id = 0; id < capacity; id++) Horde.setConnected(state, id, false);
    // Pose history belongs to authoritative rooms and never enters snapshots or practice.
    if (adapter.compensateHitscan) enableLagCompensation(state);
    return {
      id, gameId, name: cleanName(name || adapter.title, 48) || adapter.title,
      capacity, teamSize, difficulty, melee, mapId, mapName: mapId === undefined ? undefined : maps[mapId].name,
      ...(['voxel-royale', 'voxel-horde'].includes(gameId) ? { hostId: null } : {}),
      adapter, createdAt, emptySince: createdAt, hadPlayers: false, sessionId: randomUUID(),
      state, players: Array(capacity).fill(null), slots: Array(capacity).fill(null), acks: Array(capacity).fill(-1),
      lastBroadcastTick: -12, lastBroadcastRevision: -1,
    };
  }
  const legacyRoom = makeRoom(null, 'afterimage', 'Afterimage Duel');
  const roomSettings = room => ({ capacity: room.capacity, teamSize: room.teamSize, mapId: room.mapId, mapName: room.mapName,
    ...(['voxel-royale', 'voxel-horde'].includes(room.gameId) ? { hostId: room.hostId } : {}),
    ...(room.gameId === 'voxel-horde' ? { difficulty: room.difficulty, melee: room.melee } : {}),
  });
  const summary = room => ({ id: room.id, gameId: room.gameId, name: room.name, ...roomSettings(room), players: room.players, phase: room.state.phase, createdAt: room.createdAt });
  function reapRooms(now = Date.now()) {
    for (const [id, room] of rooms) {
      if (room.slots.some(Boolean)) continue;
      const lifetime = room.hadPlayers ? 60_000 : 600_000;
      const emptyFrom = room.hadPlayers ? room.emptySince : room.createdAt;
      if (now - emptyFrom >= lifetime) rooms.delete(id);
    }
    for (const [ip, rate] of creationRates) if (now - rate.startedAt > 120_000) creationRates.delete(ip);
  }
  function createRoom(gameId, name, settings = {}) {
    if (!Object.hasOwn(GAMES, gameId)) throw Object.assign(new Error('Choose an available game.'), { status: 400 });
    if (name !== undefined && typeof name !== 'string') throw Object.assign(new Error('Room name must be text.'), { status: 400 });
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw Object.assign(new Error('Room settings must be an object.'), { status: 400 });
    if (gameId === 'voxel-breach') {
      if (Object.keys(settings).some(key => !['teamSize', 'mapId'].includes(key))) throw Object.assign(new Error('Choose only a team size and map for this room.'), { status: 400 });
      const teamSize = Object.hasOwn(settings, 'teamSize') ? settings.teamSize : 1;
      const mapId = Object.hasOwn(settings, 'mapId') ? settings.mapId : 'courtyard';
      if (!Number.isInteger(teamSize) || ![1, 2, 3].includes(teamSize)) throw Object.assign(new Error('Choose 1v1, 2v2, or 3v3.'), { status: 400 });
      if (typeof mapId !== 'string' || !Object.hasOwn(Voxel.MAPS, mapId)) throw Object.assign(new Error('Choose an available Voxel Breach map.'), { status: 400 });
      settings = { teamSize, mapId };
    } else if (gameId === 'voxel-royale') {
      if (Object.keys(settings).some(key => !['capacity', 'mapId'].includes(key))) throw Object.assign(new Error('Choose only a player capacity and map for this room.'), { status: 400 });
      const capacity = Object.hasOwn(settings, 'capacity') ? settings.capacity : 10;
      const mapId = Object.hasOwn(settings, 'mapId') ? settings.mapId : 'forest';
      if (!Number.isInteger(capacity) || capacity < 2 || capacity > 10) throw Object.assign(new Error('Choose a player capacity from 2 to 10.'), { status: 400 });
      if (typeof mapId !== 'string' || !Object.hasOwn(Royale.MAPS, mapId)) throw Object.assign(new Error('Choose an available Voxel Royale map.'), { status: 400 });
      settings = { capacity, mapId };
    } else if (gameId === 'voxel-horde') {
      if (Object.keys(settings).some(key => !['capacity', 'mapId', 'difficulty', 'melee'].includes(key))) throw Object.assign(new Error('Choose only a map and difficulty, plus a starting blade, for this three-player co-op room.'), { status: 400 });
      const capacity = Object.hasOwn(settings, 'capacity') ? settings.capacity : 3;
      const mapId = Object.hasOwn(settings, 'mapId') ? settings.mapId : 'courtyard';
      const difficulty = Object.hasOwn(settings, 'difficulty') ? settings.difficulty : 'veteran';
      const melee = Object.hasOwn(settings, 'melee') ? settings.melee : 'katana';
      if (capacity !== 3) throw Object.assign(new Error('Voxel Last Stand supports up to three teammates.'), { status: 400 });
      if (typeof mapId !== 'string' || !Object.hasOwn(Horde.MAPS, mapId)) throw Object.assign(new Error('Choose an available Voxel Last Stand map.'), { status: 400 });
      if (typeof difficulty !== 'string' || !Object.hasOwn(Horde.HORDE_DIFFICULTIES, difficulty)) throw Object.assign(new Error('Choose Veteran or Nightmare difficulty.'), { status: 400 });
      if (typeof melee !== 'string' || !Object.hasOwn(MELEE_WEAPONS, melee)) throw Object.assign(new Error('Choose an available close-combat weapon.'), { status: 400 });
      settings = { capacity, mapId, difficulty, melee };
    } else if (Object.hasOwn(settings, 'teamSize') || Object.hasOwn(settings, 'mapId')) {
      throw Object.assign(new Error('Team and map settings are only available in Voxel Breach.'), { status: 400 });
    }
    reapRooms();
    if (rooms.size >= maxRooms) throw Object.assign(new Error('The hub has reached its room limit. Try again after an empty room closes.'), { status: 503 });
    let id;
    do { id = [...randomBytes(6)].map(byte => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join(''); } while (rooms.has(id));
    const room = makeRoom(id, gameId, name, settings);
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
        if (data.gameId === 'voxel-breach' && Object.keys(data).some(key => !['gameId', 'name', 'teamSize', 'mapId'].includes(key))) {
          throw Object.assign(new Error('Choose only a room name, team size, and map.'), { status: 400 });
        }
        if (data.gameId === 'voxel-royale' && Object.keys(data).some(key => !['gameId', 'name', 'capacity', 'mapId'].includes(key))) {
          throw Object.assign(new Error('Choose only a room name, player capacity, and map.'), { status: 400 });
        }
        if (data.gameId === 'voxel-horde' && Object.keys(data).some(key => !['gameId', 'name', 'capacity', 'mapId', 'difficulty', 'melee'].includes(key))) {
          throw Object.assign(new Error('Choose only a room name, map, difficulty, and starting blade for Voxel Last Stand.'), { status: 400 });
        }
        const settings = {};
        for (const key of ['teamSize', 'mapId']) if (Object.hasOwn(data, key)) settings[key] = data[key];
        if (['voxel-royale', 'voxel-horde'].includes(data.gameId) && Object.hasOwn(data, 'capacity')) settings.capacity = data.capacity;
        if (data.gameId === 'voxel-horde' && Object.hasOwn(data, 'difficulty')) settings.difficulty = data.difficulty;
        if (data.gameId === 'voxel-horde' && Object.hasOwn(data, 'melee')) settings.melee = data.melee;
        const room = createRoom(data.gameId, data.name, settings);
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
    for (const room of selectedRoom ? [selectedRoom] : occupiedRooms) {
      if (!room.slots.some(Boolean)) continue;
      const envelope = { type: 'state', roomId: room.id, gameId: room.gameId, ...roomSettings(room), players: room.players, acks: room.acks };
      // Hidden-information games never share their internal state, even in the lobby.
      const message = room.adapter.viewForPlayer ? null : JSON.stringify({ ...envelope, state: room.adapter.snapshotState ? room.adapter.snapshotState(room.state) : room.state });
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
    if (room.adapter.compensateHitscan) for (const player of room.state.players) setShotViewTick(room.state, player.id, null);
    for (const slot of room.slots) {
      if (!slot) continue;
      slot.queue.length = 0; slot.buttons = freshInput(room, slot.id);
      slot.latestButtons = slot.buttons; slot.actionInputs?.reset({ neutral: true });
      room.acks[slot.id] = slot.lastAccepted;
    }
  }
  function returnToLobby(room) {
    room.adapter.engine.resetLobby(room.state); resetInputs(room);
    for (let id = 0; id < room.players.length; id++) {
      if (['voxel-royale', 'voxel-horde'].includes(room.gameId) && !room.slots[id]) room.players[id] = null;
      else if (room.players[id]) room.players[id].ready = false;
    }
  }
  function maybeStart(room) {
    if (['voxel-royale', 'voxel-horde'].includes(room.gameId)) return;
    if (room.state.phase === 'lobby' && room.players.every(p => p?.connected && p.ready) && (!room.adapter.selectionComplete || room.adapter.selectionComplete(room.state))) {
      resetInputs(room); room.adapter.engine.startMatch(room.state);
    }
  }
  function tick() {
    const now = performance.now();
    for (const room of occupiedRooms) {
      const inputs = room.slots.map((slot, index) => {
        if (!slot) {
          if (room.adapter.compensateHitscan) setShotViewTick(room.state, index, null);
          return freshInput(room, index);
        }
        if (room.adapter.latestInput && now - slot.lastInputTime > 350) {
          slot.buttons = freshInput(room, index, slot.queue.at(-1)?.buttons ?? slot.latestButtons);
          slot.latestButtons = slot.buttons; slot.actionInputs.reset({ neutral: true });
          slot.queue.length = 0;
          room.acks[index] = slot.lastAccepted;
          if (room.adapter.compensateHitscan) setShotViewTick(room.state, index, null);
          return slot.buttons;
        }
        if (slot.queue.length) {
          const command = slot.queue.shift(); slot.buttons = command.buttons; slot.latestButtons = command.buttons; room.acks[index] = command.seq;
          if (room.adapter.compensateHitscan) setShotViewTick(room.state, index, command.viewTick);
        } else if (now - slot.lastInputTime > 350) slot.buttons = freshInput(room, index, slot.buttons);
        if (room.adapter.latestInput) {
          if (room.state.phase !== 'fight' && !(room.gameId === 'voxel-horde' && room.state.phase === 'intermission')) { slot.actionInputs.reset({ held: slot.latestButtons }); slot.buttons = { ...slot.latestButtons }; }
          else {
            const sampled = slot.actionInputs.sample(slot.latestButtons, now);
            slot.buttons = sampled.buttons;
            if (room.adapter.compensateHitscan) setShotViewTick(room.state, index, sampled.viewTick);
          }
        }
        return slot.buttons;
      });
      const previousPhase = room.state.phase;
      room.adapter.engine.step(room.state, inputs);
      const phaseChanged = previousPhase !== room.state.phase;
      if (room.adapter.latestInput && phaseChanged) {
        for (const slot of room.slots) slot?.actionInputs.reset({ held: slot.latestButtons });
      }
      if (previousPhase === 'countdown' && ['buy', 'fight', 'roundEnd', 'matchEnd'].includes(room.state.phase)) {
        for (const player of room.players) if (player) player.ready = false;
      }
      // Phase commits must arrive even when a terminal engine stops its clock.
      // Steady card/idle snapshots retain their existing 10 Hz heartbeat.
      if (phaseChanged) broadcast(room);
      else if (room.adapter.viewForPlayer) {
        if (room.state.revision !== room.lastBroadcastRevision || room.state.tick - room.lastBroadcastTick >= 12) broadcast(room);
      } else {
        const idle = room.state.phase === 'lobby' || room.state.phase === 'matchEnd' || !room.adapter.inputKeys.length && room.state.phase === 'fight';
        if (room.state.tick - room.lastBroadcastTick >= (idle ? 12 : room.adapter.snapshotInterval || 2)) broadcast(room);
      }
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
    if (ticker || options.autoTick === false || !occupiedRooms.size) return;
    lastTime = performance.now(); accumulator = 0;
    ticker = setInterval(pump, 4);
    heartbeat = setInterval(() => {
      for (const room of occupiedRooms) for (const slot of room.slots) {
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
    if (['voxel-royale', 'voxel-horde'].includes(room.gameId) && room.state.phase !== 'lobby') {
      error(ws, `This ${room.adapter.title} match has already started. Join when the host opens the next lobby.`);
      ws.close(4409, 'Match already started'); return;
    }
    let id = room.slots.findIndex(slot => slot === null);
    if (id === -1) {
      error(ws, `This room already has ${room.capacity === 2 ? 'two' : room.capacity} players. Ask a player to disconnect before joining.`);
      ws.close(4403, 'Room full'); return;
    }
    const slot = {
      id, ws, queue: [], buttons: freshInput(room, id), latestButtons: freshInput(room, id), actionInputs: room.adapter.latestInput ? createFpsInputQueue() : null, lastAccepted: -1,
      lastInputTime: performance.now(), alive: true, rateWindow: performance.now(), messages: 0,
    };
    room.slots[id] = slot;
    occupiedRooms.add(room);
    startTicker();
    room.players[id] = { name: `Player ${id + 1}`, connected: true, ready: false };
    if (room.gameId === 'voxel-breach') room.players[id].team = id < room.teamSize ? 0 : 1;
    if (['voxel-royale', 'voxel-horde'].includes(room.gameId) && room.hostId === null) room.hostId = id;
    if (room.gameId === 'voxel-horde') Horde.setConnected(room.state, id, true);
    room.acks[id] = -1; room.hadPlayers = true; room.emptySince = null;
    const welcome = () => send(ws, { type: 'welcome', playerId: id, roomId: room.id, gameId: room.gameId, ...roomSettings(room), sessionId: room.sessionId, tickRate: TICK_RATE });
    welcome();
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
      } else if (data.type === 'start') {
        if (!['voxel-royale', 'voxel-horde'].includes(room.gameId)) { error(ws, 'This game starts when all players are ready.'); return; }
        if (Object.keys(data).some(key => key !== 'type')) { error(ws, 'Start accepts no player, map, or inventory overrides.'); return; }
        if (id !== room.hostId) { error(ws, `Only the room host can start ${room.adapter.title}.`); return; }
        if (state.phase !== 'lobby') { error(ws, 'The host can start only from the lobby.'); return; }
        const participantIds = room.slots.flatMap((candidate, participantId) => candidate?.ws.readyState === WebSocket.OPEN ? [participantId] : []);
        if (room.gameId === 'voxel-royale' && participantIds.length < 2) { error(ws, 'At least two connected players are needed to start Voxel Royale.'); return; }
        if (room.gameId === 'voxel-horde' && (!participantIds.length || participantIds.some(participantId => !room.players[participantId]?.ready))) { error(ws, 'Every connected teammate must be ready before the host starts Voxel Last Stand.'); return; }
        room.adapter.engine.startMatch(state, participantIds); resetInputs(room); broadcast(room);
      } else if (data.type === 'ready') {
        if (typeof data.ready !== 'boolean') { error(ws, 'Ready must be true or false.'); return; }
        if (room.gameId === 'voxel-royale') {
          if (state.phase !== 'lobby') { error(ws, 'Readiness can change only in the Voxel Royale lobby.'); return; }
          room.players[id].ready = data.ready; broadcast(room); return;
        }
        if (room.gameId === 'voxel-horde') {
          if (!['lobby', 'countdown'].includes(state.phase)) { error(ws, 'Readiness can change only in the Voxel Last Stand lobby or initial countdown.'); return; }
          if (state.phase === 'countdown' && !data.ready) returnToLobby(room);
          else room.players[id].ready = data.ready;
          broadcast(room); return;
        }
        if (data.ready && room.adapter.selectionComplete && (!state.fighters[id].selected || !state.stageSelected)) {
          error(ws, 'Choose your comic and have player one confirm a stage before getting ready.'); return;
        }
        if (state.phase !== 'lobby' && !(state.phase === 'countdown' && (state.round ?? 1) === 1)) {
          error(ws, 'Readiness can change in the lobby or before the first round.'); return;
        }
        if (state.phase === 'countdown' && !data.ready) returnToLobby(room);
        else room.players[id].ready = data.ready;
        maybeStart(room); broadcast(room);
      } else if (data.type === 'rematch') {
        if (['voxel-royale', 'voxel-horde'].includes(room.gameId)) {
          if (Object.keys(data).some(key => key !== 'type')) { error(ws, 'Rematch accepts no player, map, or inventory overrides.'); return; }
          if (id !== room.hostId) { error(ws, `Only the room host can open the next ${room.adapter.title} lobby.`); return; }
          if (state.phase !== 'matchEnd') { error(ws, 'Finish the current match before opening the next lobby.'); return; }
          returnToLobby(room); broadcast(room); return;
        }
        if (state.phase !== 'matchEnd' && state.phase !== 'lobby') { error(ws, 'Finish the current match before requesting a rematch.'); return; }
        if (room.adapter.selectionComplete && (!state.fighters[id].selected || !state.stageSelected)) { error(ws, 'Choose your comic and confirm the host stage before a rematch.'); return; }
        if (state.phase === 'matchEnd') returnToLobby(room);
        room.players[id].ready = true;
        maybeStart(room); broadcast(room);
      } else if (data.type === 'brawl-select') {
        if (room.gameId !== 'oddstock-rumble') { error(ws, 'Comic selection is only available in Oddstock Rumble.'); return; }
        if (Object.keys(data).some(key => !['type', 'character', 'stage'].includes(key)) || !Object.hasOwn(data, 'character') && !Object.hasOwn(data, 'stage')) {
          error(ws, 'Choose only your comic or the host stage.'); return;
        }
        const choice = {};
        for (const key of ['character', 'stage']) if (Object.hasOwn(data, key)) choice[key] = data[key];
        const result = Brawl.select(state, id, choice);
        if (!result.ok) { error(ws, result.error); return; }
        if (result.changed) room.players[id].ready = false;
        if (result.stageChanged) for (const player of room.players) if (player) player.ready = false;
        broadcast(room);
      } else if (data.type === 'fps-team') {
        if (room.gameId === 'voxel-royale') { error(ws, 'Voxel Royale is free-for-all; team selection is unavailable.'); return; }
        if (room.gameId !== 'voxel-breach') { error(ws, 'Team selection is only available in Voxel Breach.'); return; }
        if (Object.keys(data).some(key => !['type', 'team'].includes(key)) || !Number.isInteger(data.team) || ![0, 1].includes(data.team)) {
          error(ws, 'Choose the amber or cyan team.'); return;
        }
        if (state.phase !== 'lobby') { error(ws, 'Teams can change only in the lobby.'); return; }
        if (room.players[id].team === data.team) { broadcast(room); return; }
        const target = room.slots.findIndex((candidate, index) => candidate === null && (index < room.teamSize ? 0 : 1) === data.team);
        if (target < 0) { error(ws, 'That team is full. Choose a team with an open seat.'); return; }
        const weaponId = state.players[id].weapon;
        const loadout = Voxel.selectLoadout(state, target, weaponId);
        if (!loadout.ok) { error(ws, loadout.error || 'Could not move your loadout to that team.'); return; }
        Voxel.selectLoadout(state, id, 'carbine');
        room.slots[target] = slot; room.slots[id] = null;
        room.players[target] = { ...room.players[id], team: data.team, ready: false }; room.players[id] = null;
        room.acks[id] = -1;
        id = target; slot.id = id; slot.lastAccepted = -1;
        slot.lastInputTime = now;
        for (const player of room.players) if (player) player.ready = false;
        resetInputs(room);
        welcome(); broadcast(room);
      } else if (data.type === 'fps-loadout') {
        if (room.gameId === 'voxel-royale') { error(ws, 'Pick up weapons in the arena; Voxel Royale has no loadout selection.'); return; }
        if (!['voxel-breach', 'voxel-horde'].includes(room.gameId)) { error(ws, 'Weapon selection is only available in Voxel Breach and Voxel Last Stand.'); return; }
        const hasGun = Object.hasOwn(data, 'weaponId'), hasMelee = Object.hasOwn(data, 'meleeId');
        if (Object.keys(data).some(key => !['type', 'weaponId', 'meleeId'].includes(key)) || !hasGun && !hasMelee ||
            hasGun && (typeof data.weaponId !== 'string' || !Object.hasOwn(Voxel.WEAPONS, data.weaponId)) ||
            hasMelee && (typeof data.meleeId !== 'string' || !Object.hasOwn(MELEE_WEAPONS, data.meleeId))) {
          error(ws, 'Choose a valid weapon loadout.'); return;
        }
        // Validate the complete request before applying either part of a paired loadout.
        const phases = room.gameId === 'voxel-horde' ? ['lobby', 'countdown', 'intermission', 'matchEnd'] : ['lobby', 'countdown', 'buy', 'roundEnd'];
        if (!phases.includes(state.phase)) { error(ws, room.gameId === 'voxel-horde' ? 'Change weapons between waves.' : 'Weapons can be changed between rounds.'); return; }
        const results = [];
        if (hasGun) results.push(room.adapter.engine.selectLoadout(state, id, data.weaponId));
        if (hasMelee) results.push(room.gameId === 'voxel-horde' ? Horde.chooseMelee(state, id, data.meleeId) : Voxel.selectMeleeLoadout(state, id, data.meleeId));
        const failure = results.find(result => !result.ok);
        if (failure) { error(ws, failure.error || 'That weapon loadout is not available.'); return; }
        if (results.some(result => result.changed) && state.phase === 'lobby') room.players[id].ready = false;
        broadcast(room);
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
        if (room.adapter.compensateHitscan && Object.hasOwn(data, 'viewTick') && !isValidViewTick(data.viewTick)) {
          error(ws, 'View tick must be a finite nonnegative simulation tick.'); return;
        }
        if (!data.buttons || typeof data.buttons !== 'object' || Array.isArray(data.buttons) ||
            Object.keys(data.buttons).some(key => !validControl(room.adapter, key, data.buttons[key]))) {
          error(ws, ['voxel-breach', 'voxel-royale', 'voxel-horde'].includes(room.gameId) ? 'Use boolean controls, yaw between -π and π, and pitch between -1.35 and 1.35.' : room.adapter.numericControls ? 'Use boolean controls and finite aim components between -1 and 1.' : 'Input buttons must contain only valid boolean controls for this game.'); return;
        }
        if (Object.hasOwn(data, 'cancelActions') && (typeof data.cancelActions !== 'boolean' || !room.adapter.latestInput)) { error(ws, 'Action cancellation must be a boolean FPS control.'); return; }
        if (Object.hasOwn(data, 'cancelPress') && (!room.adapter.latestInput || !data.cancelPress || typeof data.cancelPress !== 'object' || Array.isArray(data.cancelPress)
            || Object.keys(data.cancelPress).length !== 2 || !FPS_EDGE_ACTIONS.includes(data.cancelPress.action)
            || !Number.isSafeInteger(data.cancelPress.seq) || data.cancelPress.seq < 0 || data.cancelPress.seq >= data.seq)) {
          error(ws, 'A cancelled FPS press needs its action and earlier input sequence.'); return;
        }
        if (data.seq <= slot.lastAccepted) return;
        if (data.seq - slot.lastAccepted > 600) { error(ws, 'Input sequence is too far ahead.'); return; }
        if (slot.queue.length >= 60) { error(ws, 'Input queue is full.'); return; }
        const buttons = freshInput(room, id, slot.queue.at(-1)?.buttons ?? (room.adapter.latestInput ? slot.latestButtons : slot.buttons));
        for (const key of room.adapter.inputKeys) buttons[key] = data.buttons[key] === true;
        for (const key of Object.keys(room.adapter.numericControls || {})) {
          if (Object.hasOwn(data.buttons, key)) buttons[key] = data.buttons[key];
        }
        if (room.adapter.latestInput) {
          slot.queue.length = 0;
          if (data.cancelActions) slot.actionInputs.reset({ held: buttons, neutral: true });
          else {
            if (data.cancelPress) slot.actionInputs.cancel(data.cancelPress);
            slot.actionInputs.observe(buttons, now, { viewTick: data.viewTick, sequence: data.seq });
          }
        }
        slot.queue.push({ seq: data.seq, buttons, ...(room.adapter.compensateHitscan ? { viewTick: data.viewTick } : {}) }); slot.lastAccepted = data.seq; slot.lastInputTime = now;
      } else error(ws, 'Unknown message type.');
    });
    ws.on('close', () => {
      if (room.slots[id] !== slot) return;
      const activeHorde = room.gameId === 'voxel-horde' && room.state.phase !== 'lobby';
      const activeRoyale = room.gameId === 'voxel-royale' && ['countdown', 'fight', 'matchEnd'].includes(room.state.phase);
      room.slots[id] = null; room.acks[id] = -1;
      if (activeRoyale || activeHorde) room.players[id] = { ...room.players[id], connected: false, ready: false };
      else room.players[id] = null;
      if (room.gameId === 'voxel-royale') {
        if (room.hostId === id) room.hostId = room.slots.findIndex(Boolean);
        if (room.hostId === -1) room.hostId = null;
        if (activeRoyale && room.state.participantIds.includes(id)) Royale.eliminateParticipant(room.state, id);
      }
      if (room.gameId === 'voxel-horde') {
        Horde.setConnected(room.state, id, false);
        if (room.hostId === id) room.hostId = room.slots.findIndex(Boolean);
        if (room.hostId === -1) room.hostId = null;
      }
      if (!room.slots.some(Boolean)) {
        room.emptySince = Date.now(); occupiedRooms.delete(room);
        if (!occupiedRooms.size) {
          clearInterval(ticker); clearInterval(heartbeat); ticker = heartbeat = null;
        }
      }
      if (!(activeRoyale || activeHorde) || !room.slots.some(Boolean)) returnToLobby(room);
      if (room.gameId === 'oddstock-rumble') Brawl.clearSelection(room.state, id);
      broadcast(room);
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
    console.log('\nSEMAG GAME HUB · your PC, your game night');
    console.log(`Open the hub:      http://localhost:${port}`);
    console.log(`Share hostname:    http://${os.hostname()}:${port}`);
    for (const interfaces of Object.values(os.networkInterfaces())) for (const adapter of interfaces || []) {
      if (adapter.family === 'IPv4' && !adapter.internal) console.log(`Share LAN address: http://${adapter.address}:${port}`);
    }
    console.log('Create a room and share the invite. Ready together, or host-start Voxel Royale / Last Stand. Ctrl+C stops the hub.\n');
  }).catch(error => { console.error(`Cannot start game hub: ${error.message}`); process.exitCode = 1; });
  let stopping = false;
  const stop = async () => { if (stopping) return; stopping = true; await game.close(); process.exitCode = 0; };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}
