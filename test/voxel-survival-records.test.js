import test from 'node:test';
import assert from 'node:assert/strict';
import { createBestStore, recordDetails } from '../public/solo/solo.js';

test('Wilds records require an ended expedition and remain separate from other survival games', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  let store = createBestStore(storage);
  const save = (phase, time, scope = 'wilds-survival-v1') => {
    const policy = recordDetails('voxel-wilds', { phase, recordKey: scope, score: time, record: time });
    return store.update('voxel-wilds', policy.candidate, policy);
  };
  for (const phase of ['playing', 'paused', 'ready', 'won']) assert.equal(save(phase, 500), null);
  assert.equal(save('lost', 500, 'unknown'), null);
  assert.equal(save('lost', 500), 500);
  assert.equal(save('lost', 100), 500);
  store = createBestStore(storage);
  assert.equal(store.read('voxel-wilds', 'wilds-survival-v1'), 500);
  assert.equal(store.read('voxel-wilds', 'default'), null);
  assert.equal(store.read('night-drive', 'wilds-survival-v1'), null);
  assert.equal(store.read('rift-survivor', 'wilds-survival-v1'), null);
});
