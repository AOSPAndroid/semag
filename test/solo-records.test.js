import assert from 'node:assert/strict';
import test from 'node:test';
import { createBestStore, recordDetails } from '../public/solo/solo.js';

function browserStorage() {
  const values = new Map();
  return {
    values,
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
  };
}

test('solo best scores survive a new store and never drop when a run restarts', () => {
  const storage = browserStorage();
  const first = createBestStore(storage);
  assert.equal(first.update('snake', 70), 70);
  assert.equal(first.update('snake', 0), 70);
  assert.equal(first.update('2048', 256), 256);
  const reloaded = createBestStore(storage);
  assert.equal(reloaded.read('snake'), 70);
  assert.equal(reloaded.read('2048'), 256);
  assert.equal(reloaded.update('snake', 90), 90);
});

test('Minesweeper saves faster times separately for each difficulty', () => {
  const records = createBestStore(browserStorage());
  const beginner = { scope: 'beginner', direction: 'min' };
  const intermediate = { scope: 'intermediate', direction: 'min' };
  assert.equal(records.update('minesweeper', 42, beginner), 42);
  assert.equal(records.update('minesweeper', 60, beginner), 42);
  assert.equal(records.update('minesweeper', 31, beginner), 31);
  assert.equal(records.update('minesweeper', 150, intermediate), 150);
  assert.equal(records.read('minesweeper', 'beginner'), 31);
  assert.equal(records.read('minesweeper', 'intermediate'), 150);
});

test('Apex Circuit records require a completed race and retain the fastest time after reload', () => {
  const storage = browserStorage();
  const records = createBestStore(storage);
  const save = (update, store = records) => {
    const { candidate, scope, direction } = recordDetails('apex-circuit', update);
    return store.update('apex-circuit', candidate, { scope, direction });
  };
  for (const phase of ['playing', 'paused', 'lost']) {
    assert.equal(save({ phase, score: 0, record: 0 }), null);
  }
  assert.equal(save({ phase: 'won', score: 49.27, record: 49.27 }), 49.27);
  assert.equal(save({ phase: 'playing', score: 1, record: 1 }), 49.27);
  assert.equal(save({ phase: 'won', score: 52.19, record: 52.19 }), 49.27);
  assert.equal(save({ phase: 'won', score: 44.63, record: 44.63 }), 44.63);
  const reloaded = createBestStore(storage);
  assert.equal(reloaded.read('apex-circuit', 'three-laps'), 44.63);
  assert.equal(save({ phase: 'playing', score: 0 }, reloaded), 44.63);
});

test('Night Drive saves a growing best score independently from timed games', () => {
  const records = createBestStore(browserStorage());
  const save = (gameId, update) => {
    const { candidate, scope, direction } = recordDetails(gameId, update);
    return records.update(gameId, candidate, { scope, direction });
  };
  assert.equal(save('night-drive', { phase: 'playing', score: 125 }), 125);
  assert.equal(save('night-drive', { phase: 'lost', score: 480 }), 480);
  assert.equal(save('night-drive', { phase: 'playing', score: 0 }), 480);
  assert.equal(save('minesweeper', { phase: 'playing', recordKey: 'intermediate', record: 1 }), null);
  assert.equal(save('minesweeper', { phase: 'won', recordKey: 'intermediate', record: 103 }), 103);
  assert.equal(save('minesweeper', { phase: 'won', recordKey: 'intermediate', record: 88 }), 88);
  assert.equal(records.read('night-drive'), 480);
  assert.equal(records.read('minesweeper', 'intermediate'), 88);
});

test('invalid stored records do not poison future scores', () => {
  const storage = browserStorage();
  const key = 'fireside-solo-best:snake:default';
  for (const raw of ['null', 'true', '"80"', '{}', '-1', 'Infinity', 'NaN', '', ' 80 ']) {
    storage.values.set(key, raw);
    const records = createBestStore(storage);
    assert.equal(records.read('snake'), null, raw);
    assert.equal(records.update('snake', 80), 80, raw);
    assert.equal(storage.values.get(key), '80', raw);
  }
  const records = createBestStore(storage);
  for (const invalid of [null, '90', -1, NaN, Infinity, undefined]) {
    assert.equal(records.update('snake', invalid), 80);
  }
});

test('blocked browser storage retains records in memory without interrupting play', () => {
  const unavailable = createBestStore({
    getItem() { throw new Error('Storage blocked'); },
    setItem() { throw new Error('Storage blocked'); },
  });
  assert.equal(unavailable.update('snake', 30), 30);
  assert.equal(unavailable.read('snake'), 30);
  assert.equal(unavailable.update('snake', 10), 30);
  const absent = createBestStore(undefined);
  assert.equal(absent.update('2048', 16), 16);
  assert.equal(absent.read('2048'), 16);
});

test('losing storage write access mid-run preserves the existing record and new best', () => {
  const storage = browserStorage();
  storage.values.set('fireside-solo-best:snake:default', '40');
  const records = createBestStore(storage);
  assert.equal(records.read('snake'), 40);
  storage.setItem = () => { throw new Error('Write access revoked'); };
  assert.equal(records.update('snake', 60), 60);
  assert.equal(records.read('snake'), 60);
  assert.equal(records.update('snake', 20), 60);
});
