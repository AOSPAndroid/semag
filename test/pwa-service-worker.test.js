import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../public/service-worker.js', import.meta.url), 'utf8');
const ORIGIN = 'https://semag.lol';
const OFFLINE_URL = `${ORIGIN}/offline.html`;
const CURRENT_CACHE = 'semag-pwa-3.68.0';

function workerPlatform({ network = async () => new Response('live'), existingCaches = {} } = {}) {
  const listeners = new Map();
  const stores = new Map(Object.entries(existingCaches).map(([name, entries]) => [name, new Map(entries)]));
  const fetches = [];
  const deleted = [];
  let claimed = 0;
  let skipped = 0;
  const fetch = async (request, options) => {
    fetches.push({ url: request.url, options, request });
    return network(request, options);
  };
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return {
        async addAll(requests) {
          const entries = await Promise.all(requests.map(async request => {
            const response = await fetch(request);
            if (!response.ok) throw new TypeError('Precache response is not successful');
            return [request.url, response.clone()];
          }));
          for (const [url, response] of entries) store.set(url, response);
        },
        async match(request) { return store.get(typeof request === 'string' ? request : request.url)?.clone(); },
      };
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { deleted.push(name); return stores.delete(name); },
  };
  const self = {
    registration: { scope: `${ORIGIN}/` },
    addEventListener(type, listener) { listeners.set(type, listener); },
    clients: { async claim() { claimed++; } },
    async skipWaiting() { skipped++; },
  };
  vm.runInNewContext(source, { self, caches, fetch, Request, Response, URL }, { filename: 'service-worker.js' });
  function dispatch(type, request) {
    const pending = [];
    let response;
    listeners.get(type)({ request, waitUntil(promise) { pending.push(promise); }, respondWith(promise) { response = promise; } });
    return { completion: Promise.all(pending), response };
  }
  return { dispatch, stores, fetches, deleted, get claimed() { return claimed; }, get skipped() { return skipped; } };
}

const navigation = (path = '/', changes = {}) => ({ url: new URL(path, ORIGIN).href, method: 'GET', mode: 'navigate', ...changes });

test('install caches only the small offline page and leaves activation to the browser', async () => {
  const worker = workerPlatform({ network: async () => new Response('connection page') });
  await worker.dispatch('install').completion;
  assert.deepEqual([...worker.stores.keys()], [CURRENT_CACHE]);
  assert.deepEqual([...worker.stores.get(CURRENT_CACHE).keys()], [OFFLINE_URL]);
  assert.equal(worker.fetches.length, 1);
  assert.equal(worker.fetches[0].request.cache, 'reload');
  assert.equal(await worker.stores.get(CURRENT_CACHE).get(OFFLINE_URL).text(), 'connection page');
  assert.equal(worker.skipped, 0);
  assert.equal(worker.claimed, 0);
});

test('a missing or unreachable connection page fails installation rather than caching an error page', async () => {
  for (const network of [async () => new Response('not found', { status: 404 }), async () => { throw new TypeError('offline'); }]) {
    const worker = workerPlatform({ network });
    await assert.rejects(worker.dispatch('install').completion, TypeError);
    assert.equal(worker.stores.get(CURRENT_CACHE).size, 0);
    assert.equal(worker.skipped, 0);
  }
});

test('game navigations fetch fresh pages every time and never store pages or invite URLs', async () => {
  let revision = 0;
  const worker = workerPlatform({ network: async () => new Response(`revision ${++revision}`) });
  const paths = ['/', '/voxel-practice.html?game=voxel', '/voxel.html?room=SECRET'];
  for (const path of paths) {
    const first = await worker.dispatch('fetch', navigation(path)).response;
    const second = await worker.dispatch('fetch', navigation(path)).response;
    assert.notEqual(await first.text(), await second.text());
  }
  assert.equal(worker.fetches.length, paths.length * 2);
  assert.equal(worker.fetches.every(({ options }) => options.cache === 'no-store'), true);
  assert.equal(worker.stores.size, 0);
});

test('a failed game navigation returns only the current offline page without caching the requested game', async () => {
  const worker = workerPlatform({
    network: async () => { throw new TypeError('network unavailable'); },
    existingCaches: {
      [CURRENT_CACHE]: [[OFFLINE_URL, new Response('current connection page')]],
      'another-app': [[OFFLINE_URL, new Response('foreign connection page')]],
    },
  });
  const response = await worker.dispatch('fetch', navigation('/solo.html?game=voxel-wilds')).response;
  assert.equal(await response.text(), 'current connection page');
  assert.deepEqual([...worker.stores.get(CURRENT_CACHE).keys()], [OFFLINE_URL]);
  assert.equal(await (await worker.dispatch('fetch', navigation('/voxel-royale.html?room=PRIVATE')).response).text(), 'current connection page');
});

test('API, downloads, game assets, writes and other origins bypass the worker entirely', async () => {
  const worker = workerPlatform();
  const requests = [
    ...['/api', '/api/rooms?name=Player', '/download', '/download/fireside-hub.zip', '/downloads/fireside-hub.zip'].map(path => navigation(path)),
    navigation('/voxel-client.js', { mode: 'cors' }),
    navigation('/hub/dojo-cover.svg', { mode: 'no-cors' }),
    navigation('/api/rooms', { method: 'POST', mode: 'cors' }),
    navigation('/', { method: 'POST' }),
    navigation('https://koobz3:3000/voxel.html?room=PRIVATE'),
    navigation('http://192.168.1.20:3000/'),
    navigation('wss://semag.lol/'),
  ];
  for (const request of requests) assert.equal(worker.dispatch('fetch', request).response, undefined, request.url);
  assert.equal(worker.fetches.length, 0);
  assert.equal(worker.stores.size, 0);
});

test('server error responses remain visible rather than being replaced by an offline screen', async () => {
  const worker = workerPlatform({ network: async () => new Response('host error', { status: 503 }) });
  const response = await worker.dispatch('fetch', navigation('/')).response;
  assert.equal(response.status, 503);
  assert.equal(await response.text(), 'host error');
  assert.equal(worker.stores.size, 0);
});

test('activation removes only older semaG PWA caches and then claims pages', async () => {
  const worker = workerPlatform({ existingCaches: {
    'semag-pwa-3.67.0': [],
    'semag-pwa-3.68.0': [[OFFLINE_URL, new Response('current connection page')]],
    'semag-pwa-3.66.0': [],
    'another-app': [],
    'semag-game-art': [],
  } });
  await worker.dispatch('activate').completion;
  assert.deepEqual(worker.deleted.sort(), ['semag-pwa-3.66.0', 'semag-pwa-3.67.0']);
  assert.deepEqual([...worker.stores.keys()].sort(), ['another-app', CURRENT_CACHE, 'semag-game-art'].sort());
  assert.equal(worker.claimed, 1);
  assert.equal(worker.skipped, 0);
});

test('evicted offline content produces a network error and never borrows a foreign cache', async () => {
  const worker = workerPlatform({
    network: async () => { throw new TypeError('offline'); },
    existingCaches: { 'another-app': [[OFFLINE_URL, new Response('foreign app')]] },
  });
  const response = await worker.dispatch('fetch', navigation('/')).response;
  assert.equal(response.type, 'error');
  assert.equal(response.status, 0);
  assert.equal(worker.stores.get(CURRENT_CACHE).size, 0);
});
