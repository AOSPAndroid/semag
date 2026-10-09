import test from 'node:test';
import assert from 'node:assert/strict';
import { GAMES, roomCapacity, roomUrl, soloUrl } from '../public/hub/shared.js';
import { MAPS } from '../public/voxel-maps.js';
import { validHordeSettings, hordeOverview, chooseHordeSettings } from '../public/hub/horde-setup.js';

test('Last Stand has explicit solo and three-person co-op routes without changing existing FPS routes', () => {
  assert.equal(GAMES['voxel-horde'].supportsSolo, true);
  assert.equal(GAMES['voxel-horde'].kind, 'coop'); assert.equal(GAMES['voxel-horde'].maxPlayers, 3);
  assert.equal(roomUrl({ gameId: 'voxel-horde', id: 'ABC123' }), '/voxel-horde.html?room=ABC123');
  assert.equal(soloUrl('voxel-horde'), '/voxel-horde.html?solo=1');
  for (const capacity of [undefined, 1, 2, 3, 6, 100]) assert.equal(roomCapacity({ gameId: 'voxel-horde', capacity }), 3);
  assert.equal(roomUrl({ gameId: 'voxel-breach', id: 'ABC123' }), '/voxel.html?room=ABC123');
  assert.equal(roomCapacity({ gameId: 'voxel-breach', capacity: 6 }), 6);
  assert.equal(soloUrl('voxel-wilds'), '/solo.html?game=voxel-wilds');
});

test('Holdout setup accepts only authored maps, challenging difficulty levels and the co-op capacity', () => {
  for (const mapId of Object.keys(MAPS)) for (const difficulty of ['veteran', 'nightmare']) assert.equal(validHordeSettings(mapId, difficulty), true);
  for (const mapId of ['forest', '__proto__', '', null, {}]) assert.equal(validHordeSettings(mapId, 'veteran'), false);
  for (const difficulty of ['easy', '', null, {}, 1]) assert.equal(validHordeSettings('courtyard', difficulty), false);
  for (const capacity of [1, 2, 4, '3', null, Infinity]) assert.equal(validHordeSettings('courtyard', 'veteran', capacity), false);
  for (const map of Object.values(MAPS)) {
    const overview = hordeOverview(map);
    assert.match(overview, /<svg viewBox=/); assert.match(overview, /Cover breaks enemy sight lines/);
    assert.equal(overview.includes('<text'), false, 'bomb-site labels do not misrepresent wave objectives');
    const drawnCover = [...overview.matchAll(/<rect x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)"/g)]
      .map(match => match.slice(1).map(Number));
    const floorCover = map.colliders.filter(box => !box.overhead && !box.id.startsWith('wall-'))
      .map(box => [box.x - map.bounds.minX, box.z - map.bounds.minZ, box.w, box.d]);
    assert.deepEqual(drawnCover, floorCover, 'the overview shows every actual floor obstacle, excluding overhead ceilings');
  }
});

class Element extends EventTarget {
  constructor(value = '') { super(); this.value = value; this.textContent = ''; this.innerHTML = ''; this.attributes = {}; }
  replaceChildren(...children) { this.children = children; this.value = children[0]?.value || ''; }
  setAttribute(key, value) { this.attributes[key] = value; }
}
function dialogFixture() {
  const map = new Element('paris'), difficulty = new Element('nightmare'), form = new Element();
  form.elements = { namedItem: name => ({ mapId: map, difficulty })[name] };
  const selectors = Object.fromEntries(['[data-horde-map-note]', '[data-horde-map-preview]', '[data-horde-melee-note]', '[data-horde-setup-title]', '[data-horde-setup-note]', '[data-horde-submit]', '[data-cancel-horde]'].map(selector => [selector, new Element()]));
  const dialog = new Element(); dialog.open = false;
  dialog.querySelector = selector => selector === 'form' ? form : selectors[selector];
  dialog.showModal = () => { dialog.open = true; };
  dialog.close = () => { dialog.open = false; dialog.dispatchEvent(new Event('close')); };
  return { dialog, form, map, difficulty, selectors };
}
function optionDocument(t) {
  const previous = globalThis.document;
  globalThis.document = { createElement: () => new Element() };
  t.after(() => { if (previous === undefined) delete globalThis.document; else globalThis.document = previous; });
}

test('Solo and co-op dialogs require explicit submission and cancelling resolves without a game or room', async t => {
  optionDocument(t);
  const fixture = dialogFixture(), { dialog, form, map, difficulty, selectors } = fixture;
  let resolved = false;
  const first = chooseHordeSettings(dialog, { solo: true }).then(value => { resolved = true; return value; });
  await Promise.resolve(); assert.equal(dialog.open, true); assert.equal(resolved, false);
  assert.equal(map.value, 'paris'); assert.match(selectors['[data-horde-setup-title]'].textContent, /solo/);
  assert.equal(await chooseHordeSettings(dialog), null, 'a second invocation cannot replace an open choice');
  difficulty.value = 'easy'; form.dispatchEvent(new Event('submit', { cancelable: true }));
  assert.equal(dialog.open, true); assert.equal(resolved, false);
  selectors['[data-cancel-horde]'].dispatchEvent(new Event('click'));
  assert.equal(await first, null); assert.equal(dialog.open, false);
  const second = chooseHordeSettings(dialog); difficulty.value = 'nightmare';
  assert.match(selectors['[data-horde-setup-title]'].textContent, /co-op/);
  map.value = 'depot'; map.dispatchEvent(new Event('change'));
  assert.match(selectors['[data-horde-map-preview]'].attributes['aria-label'], /Freight Depot/);
  form.dispatchEvent(new Event('submit', { cancelable: true }));
  assert.deepEqual(await second, { capacity: 3, mapId: 'depot', difficulty: 'nightmare', melee: 'knife' });
  dialog.dispatchEvent(new Event('cancel')); assert.equal(dialog.open, false);
});
