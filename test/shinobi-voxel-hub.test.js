import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { GAMES, practiceUrl, roomUrl, roomCapacity } from '../public/hub/shared.js';
import { MAPS } from '../public/shinobi-voxel-maps.js';
import { validShinobiRoomSettings, shinobiArenaOverview } from '../public/hub/shinobi-voxel-setup.js';

test('third-person Shinobi has separate two-player routes while the original duel remains available', () => {
  assert.equal(GAMES['shinobi-voxel'].title, 'Shinobi Showdown 3D');
  assert.equal(GAMES['shinobi-voxel'].kind, 'duel');
  assert.equal(GAMES['shinobi-voxel'].theme, 'ninja');
  assert.deepEqual(GAMES['shinobi-voxel'].themes, ['ninja', 'voxel']);
  assert.equal(GAMES['shinobi-voxel'].maxPlayers, 2);
  assert.equal(practiceUrl('shinobi-voxel'), '/shinobi-voxel.html?practice=1');
  assert.equal(roomUrl({ gameId: 'shinobi-voxel', id: 'ABC123' }), '/shinobi-voxel.html?room=ABC123');
  assert.equal(roomUrl({ gameId: 'shinobi-voxel', id: 'A&B' }), '/shinobi-voxel.html?room=A%26B');
  assert.equal(roomCapacity({ gameId: 'shinobi-voxel', capacity: 6 }), 2);
  assert.equal(GAMES['shinobi-showdown'].title, 'Shinobi Showdown');
  assert.equal(practiceUrl('shinobi-showdown'), '/play.html?game=shinobi-showdown&practice=1');
  assert.equal(roomUrl({ gameId: 'shinobi-showdown', id: 'ABC123' }), '/play.html?room=ABC123&game=shinobi-showdown');
});

test('room setup only accepts authored ninja arenas and shows their distinct real layouts', () => {
  assert.deepEqual(Object.keys(MAPS), ['shinobi-courtyard', 'shinobi-rooftops', 'shinobi-dojo']);
  const previews = new Set();
  for (const arena of Object.values(MAPS)) {
    assert.equal(validShinobiRoomSettings(arena.id), true);
    const preview = shinobiArenaOverview(arena);
    assert.match(preview, /<svg viewBox=/);
    assert.match(preview, /<polyline points=/);
    assert.doesNotMatch(preview, /NaN|undefined/);
    previews.add(preview);
  }
  assert.equal(previews.size, Object.keys(MAPS).length);
  for (const invalid of ['courtyard', '__proto__', 'constructor', '', null, 1, ['shinobi-dojo']]) assert.equal(validShinobiRoomSettings(invalid), false);
});

test('the library exposes both Shinobi games, an explicit practice start route, and accessible arena choices', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.equal((html.match(/data-game-card="shinobi-showdown"/g) || []).length, 1);
  assert.equal((html.match(/data-game-card="shinobi-voxel"/g) || []).length, 1);
  assert.match(html, /data-play-practice="shinobi-voxel" href="\/shinobi-voxel\.html\?practice=1"/);
  assert.match(html, /id="shinobi-voxel-setup" aria-labelledby="shinobi-voxel-setup-title"/);
  assert.match(html, /data-shinobi-arenas/);
  assert.match(html, /data-cancel-shinobi/);
  assert.match(html, /src="\/hub\/shinobi-voxel-cover\.svg"/);
});
