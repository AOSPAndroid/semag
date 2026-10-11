import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { MONSTER_TYPES } from '../public/voxel-horde-engine.js';
import { hordeBestiaryEntries, hordeBestiaryMarkup } from '../public/hub/horde-setup.js';
import { hordeGuideTabTarget } from '../public/voxel-horde-client.js';

test('the field guide uses all six actual monster labels and first appearance waves', () => {
  const entries = hordeBestiaryEntries(MONSTER_TYPES);
  assert.deepEqual(entries.map(entry => entry.id), ['rat', 'pig', 'wolf', 'vampire', 'witch', 'stag']);
  assert.deepEqual(entries.map(entry => entry.debutWave), [2, 3, 4, 6, 8, 9]);
  for (const entry of entries) {
    assert.equal(entry.label, MONSTER_TYPES[entry.id].label);
    assert.equal(entry.debutWave, MONSTER_TYPES[entry.id].debutWave);
    assert.equal(MONSTER_TYPES[entry.id].unarmed, true, 'the shared no-gun-or-blade-drop note is true');
    assert.notEqual(MONSTER_TYPES[entry.id].gun, true);
  }
  const revised = { ...MONSTER_TYPES, rat: { ...MONSTER_TYPES.rat, label: 'Revised Rat', debutWave: 12 } };
  assert.equal(hordeBestiaryEntries(revised)[0].label, 'Revised Rat');
  assert.equal(hordeBestiaryEntries(revised)[0].debutWave, 12, 'balance metadata is never copied into the guide');
});

test('the six tactics correspond to distinct physical enemy behaviors', () => {
  const entries = Object.fromEntries(hordeBestiaryEntries(MONSTER_TYPES).map(entry => [entry.id, entry]));
  assert.ok(MONSTER_TYPES.rat.health < MONSTER_TYPES.hound.health && MONSTER_TYPES.rat.speed > MONSTER_TYPES.hound.speed);
  assert.match(entries.rat.tactic, /floor/);
  for (const type of ['pig', 'vampire']) {
    assert.equal(MONSTER_TYPES[type].lunge, true);
    assert.ok(MONSTER_TYPES[type].windup > 0 && MONSTER_TYPES[type].lungeTicks > 0);
    assert.match(entries[type].tactic, /sidestep/i);
  }
  assert.ok(MONSTER_TYPES.vampire.biteHeal > 0); assert.match(entries.vampire.behavior, /bite restores/);
  assert.ok(MONSTER_TYPES.wolf.flankRange > 0); assert.match(entries.wolf.tactic, /surround/);
  assert.equal(MONSTER_TYPES.witch.special, 'witch'); assert.match(entries.witch.tactic, /projectile.*cover/);
  assert.ok(MONSTER_TYPES.stag.knockbackSpeed > 0 && MONSTER_TYPES.stag.knockbackTicks > 0);
  assert.match(entries.stag.behavior, /pushes you back/);
  assert.equal(new Set(Object.values(entries).map(entry => entry.art)).size, 6, 'each creature has its own silhouette');
});

test('guide cards reject unfinished profiles and safely render a supplied display label', () => {
  for (const roster of [undefined, null, {}, { rat: { label: 'Rat' } }, { rat: { label: 'Rat', debutWave: Infinity } }, { rat: { label: '', debutWave: 2 } }]) {
    assert.deepEqual(hordeBestiaryEntries(roster), []);
  }
  const markup = hordeBestiaryMarkup({ rat: { label: '<img src=x onerror="alert(1)"> & Rat', debutWave: 2 } });
  assert.match(markup, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt; &amp; Rat/);
  assert.equal(markup.includes('<img'), false);
  assert.match(markup, /Wave 2\+/); assert.match(markup, /aria-hidden="true" focusable="false"/);
  const complete = hordeBestiaryMarkup(MONSTER_TYPES);
  assert.equal((complete.match(/<article /g) || []).length, 6);
  assert.equal((complete.match(/<svg /g) || []).length, 6);
});

test('modal tab containment includes expandable sections in both directions', () => {
  const close = {}, bestiary = {}, combat = {}, back = {}, outside = {};
  const controls = [close, bestiary, combat, back];
  assert.equal(hordeGuideTabTarget(controls, close, true), back);
  assert.equal(hordeGuideTabTarget(controls, back), close);
  for (const summary of [bestiary, combat]) {
    assert.equal(hordeGuideTabTarget(controls, summary), null, 'native forward traversal can reach the next control');
    assert.equal(hordeGuideTabTarget(controls, summary, true), null, 'native backward traversal can reach the previous control');
  }
  assert.equal(hordeGuideTabTarget(controls, outside), close);
  assert.equal(hordeGuideTabTarget(controls, outside, true), back);
  assert.equal(hordeGuideTabTarget([], outside), null);
});

test('setup exposes the guide without submitting or adding another live HUD panel', async () => {
  const html = await readFile(new URL('../public/voxel-horde.html', import.meta.url), 'utf8');
  assert.match(html, /<button id="horde-field-guide" type="button" aria-controls="horde-guide horde-bestiary" disabled>/);
  assert.ok(html.indexOf('id="horde-field-guide"') < html.indexOf('id="horde-start"'));
  assert.match(html, /<details class="horde-guide-fold" id="horde-bestiary">/);
  assert.match(html, /<details class="horde-guide-fold" id="horde-advanced-guide">/);
  const hud = html.slice(html.indexOf('id="horde-combat"'), html.indexOf('id="horde-overlay"'));
  assert.equal(hud.includes('horde-bestiary'), false);
  const cover = await readFile(new URL('../public/hub/horde-cover.svg', import.meta.url), 'utf8');
  for (const { id } of hordeBestiaryEntries(MONSTER_TYPES)) assert.ok(cover.includes(`<use href="#${id}"`));
});
