import test from 'node:test';
import assert from 'node:assert/strict';
import { GAMES, roomCapacity, roomUrl } from '../public/hub/shared.js';
import { validRoyaleSettings } from '../public/hub/royale-setup.js';

test('Royale routing and variable room capacity coexist with existing duel and team rooms', () => {
  assert.equal(GAMES['voxel-royale'].maxPlayers, 10);
  assert.equal(roomUrl({ gameId: 'voxel-royale', id: 'ABC123' }), '/voxel-royale.html?room=ABC123');
  for (let capacity = 2; capacity <= 10; capacity++) assert.equal(roomCapacity({ gameId: 'voxel-royale', capacity }), capacity);
  assert.equal(roomCapacity({ gameId: 'voxel-royale', capacity: 99 }), 10);
  assert.equal(roomCapacity({ gameId: 'checkers', capacity: 10 }), 2);
  assert.equal(roomCapacity({ gameId: 'voxel-breach', capacity: 6 }), 6);
  assert.equal(roomUrl({ gameId: 'voxel-breach', id: 'ABC123' }), '/voxel.html?room=ABC123');
});

test('Royale setup admits three authored maps and an integer two-to-ten player ceiling', () => {
  for (const map of ['forest', 'maze', 'desert']) for (let capacity = 2; capacity <= 10; capacity++) assert.equal(validRoyaleSettings(map, capacity), true);
  for (const map of ['courtyard', '__proto__', '', null]) assert.equal(validRoyaleSettings(map, 10), false);
  for (const capacity of [1, 11, 2.5, '10', NaN, Infinity, null]) assert.equal(validRoyaleSettings('forest', capacity), false);
});
