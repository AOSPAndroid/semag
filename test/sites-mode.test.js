import assert from 'node:assert/strict';
import test from 'node:test';
import { pcHostUrl, isBrowserHosted } from '../public/hub/hosting-mode.js';
import { GAMES, soloUrl } from '../public/hub/shared.js';

test('PC handoff accepts hostname:port, LAN IP, bracketed IPv6 and full room invites', () => {
  assert.equal(pcHostUrl('MY-PC:3000'), 'http://my-pc:3000/');
  assert.equal(pcHostUrl('MY-PC:3000/voxel.html?room=ABC123'), 'http://my-pc:3000/voxel.html?room=ABC123');
  assert.equal(pcHostUrl('192.168.1.12:4000'), 'http://192.168.1.12:4000/');
  assert.equal(pcHostUrl('localhost'), 'http://localhost:3000/');
  assert.equal(pcHostUrl('[::1]:3000'), 'http://[::1]:3000/');
  assert.equal(pcHostUrl('https://host.example/voxel.html?room=ABC123'), 'https://host.example/voxel.html?room=ABC123');
});
test('PC handoff rejects non-web protocols, login-bearing addresses and malformed ports', () => {
  for (const text of ['', 'javascript:alert(1)', 'file:///tmp/test', 'data:text/html,test', 'http://user:pass@host/', 'host:99999', 'a bad host']) assert.throws(() => pcHostUrl(text));
});
test('browser-hosted mode is explicit while the PC hub keeps its multiplayer default', () => {
  assert.equal(isBrowserHosted({ querySelector: () => ({ content: 'sites' }) }), true);
  assert.equal(isBrowserHosted({ querySelector: () => ({ content: 'pc' }) }), false);
  assert.equal(isBrowserHosted({ querySelector: () => null }), false);
});
test('the dojo is a standalone local entry and resolves to its explicit setup page', () => {
  assert.equal(GAMES['voxel-dojo'].kind, 'solo');
  assert.equal(soloUrl('voxel-dojo'), '/voxel-practice.html?mode=dojo');
});
