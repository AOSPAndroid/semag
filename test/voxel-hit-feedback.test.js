import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyCombatDamage, createCombatPlayer } from '../public/voxel-engine.js';
import { confirmedEnemyHit, createHitFeedback, hitFeedbackPresentation, paintHitFeedback, HIT_FEEDBACK_MS, HIT_FEEDBACK_COLORS } from '../public/voxel-hit-feedback.js';
import { incomingDamageFeedback } from '../public/voxel-damage-feedback.js';

const players = () => [createCombatPlayer(0), createCombatPlayer(1), { ...createCombatPlayer(2), team: 0 }];
const damage = (id = 1, extra = {}) => ({ id, tick: id, type: 'damage', playerId: 0, targetId: 1, weapon: 'carbine', attack: 'gun', damage: 30, hp: 170, hitKind: 'body', ...extra });
const show = (feedback, people, now = 100, extra = {}) => feedback.present(people[0], { now, lifeKey: 'round-1', ...extra });
const consume = (feedback, events, people, now = 100, extra = {}) => feedback.consume(events, people[0], people, { now, lifeKey: 'round-1', ...extra });

test('real authoritative HP loss paints a gold head reward, including a lethal headshot', () => {
  const people = players(), state = { gameId: 'feedback-test', players: people, tick: 20, eventId: 0, events: [], eventLimit: 256 };
  applyCombatDamage(state, [{ playerId: 0, targetId: 1, weapon: 'marksman', attack: 'gun', damage: 500, headshot: true, hitKind: 'head' }]);
  assert.equal(state.events[0].damage, 200, 'only actual HP loss is confirmed');
  assert.equal(state.events[1].type, 'kill');
  const view = consume(createHitFeedback(), state.events, people);
  assert.equal(view.kind, 'headshot'); assert.equal(view.color, '#ffd45a'); assert.equal(view.symbol, '✦');
  assert.equal(view.until - view.at, HIT_FEEDBACK_MS.headshot);
});

test('body and leg hits give the compact bloody orange outward reward', () => {
  for (const hitKind of ['body', 'leg']) {
    const view = consume(createHitFeedback(), [damage(1, { hitKind })], players());
    assert.equal(view.kind, 'body'); assert.equal(view.color, '#f47738'); assert.equal(view.symbol, '×');
    assert.equal(view.until - view.at, HIT_FEEDBACK_MS.body);
  }
  assert.notEqual(HIT_FEEDBACK_COLORS.headshot, HIT_FEEDBACK_COLORS.body);
});

test('shots, wall contacts, kills without HP loss and malformed damage never reward the aim point', () => {
  const people = players();
  const invalid = [
    damage(1, { type: 'shot' }), damage(2, { type: 'boltHit' }), damage(3, { type: 'meleeHit' }),
    damage(4, { type: 'kill', headshot: true }), damage(5, { damage: 0 }), damage(6, { damage: -2 }),
    damage(7, { damage: NaN }), damage(8, { damage: Infinity }), damage(9, { hp: undefined }), damage(10, { hp: -1 }),
    damage(11, { hp: Infinity }), damage(12, { attack: 'disconnect' }), damage(13, { targetId: null }), damage(14, { targetId: 99 }),
  ];
  for (const event of invalid) assert.equal(confirmedEnemyHit(event, people[0], people), null);
  assert.equal(consume(createHitFeedback(), invalid, people).visible, false);
});

test('friendly fire, self frags, incoming hits and spectated allies cannot earn an outgoing cue', () => {
  const people = players(), invalid = [damage(1, { targetId: 2 }), damage(2, { targetId: 0 }), damage(3, { playerId: 1, targetId: 0 }), damage(4, { playerId: 2 })];
  assert.equal(consume(createHitFeedback(), invalid, people).visible, false);
  people[0].alive = false;
  assert.equal(consume(createHitFeedback(), [damage()], people).visible, false);
});

test('mixed shotgun pellets and multiple victims are grouped into one head-priority pulse', () => {
  const feedback = createHitFeedback(), people = players(); people[2].team = 1;
  const pellets = Array.from({ length: 12 }, (_, index) => damage(index + 1, { tick: 50, weapon: 'shotgun', pellet: index, targetId: index < 6 ? 1 : 2, damage: 8, hp: 150 - index * 8, headshot: index === 3 }));
  const first = consume(feedback, pellets, people);
  assert.equal(first.kind, 'headshot'); assert.equal(first.pulse, '1');
  assert.deepEqual(consume(feedback, pellets, people, 140), first, 'snapshot replay cannot restart the pulse');
  consume(feedback, [damage(20, { tick: 51 })], people, 150);
  assert.deepEqual(show(feedback, people, 150), first, 'body damage does not overwrite or prolong a head reward');
});

test('a late head pellet upgrades its shell without replaying the pulse or moving its start', () => {
  const feedback = createHitFeedback(), people = players();
  const first = consume(feedback, [damage(1, { tick: 10, weapon: 'shotgun', pellet: 0 })], people);
  const upgrade = consume(feedback, [damage(2, { tick: 10, weapon: 'shotgun', pellet: 1, headshot: true })], people, 140);
  assert.equal(upgrade.kind, 'headshot'); assert.equal(upgrade.pulse, first.pulse); assert.equal(upgrade.at, first.at);
  assert.equal(upgrade.until, first.at + HIT_FEEDBACK_MS.headshot);
});

test('distinct attacks retrigger alternating pulse tokens and feedback expires promptly', () => {
  const feedback = createHitFeedback(), people = players(), first = consume(feedback, [damage()], people);
  const second = consume(feedback, [damage(2)], people, 120);
  assert.notEqual(second.pulse, first.pulse); assert.equal(second.until, 300);
  assert.equal(show(feedback, people, 299).visible, true);
  assert.equal(show(feedback, people, 300).visible, false);
  assert.equal(show(feedback, people, 310).visible, false);
});

test('a following kill cannot turn a gold head reward into generic elimination or restart it', () => {
  const feedback = createHitFeedback(), people = players(), first = consume(feedback, [damage(1, { headshot: true })], people);
  assert.deepEqual(consume(feedback, [damage(2, { type: 'kill' }), damage(3, { type: 'elimination' })], people, 140), first);
});

test('pause, release, phase and life changes clear feedback while pause retains event deduplication', () => {
  const feedback = createHitFeedback(), people = players(); consume(feedback, [damage()], people);
  feedback.reset(); assert.equal(show(feedback, people).visible, false);
  assert.equal(consume(feedback, [damage()], people, 120).visible, false);
  consume(feedback, [damage(2)], people, 150); assert.equal(show(feedback, people, 160, { active: false }).visible, false);
  assert.equal(show(feedback, people, 170).visible, false, 'resume cannot reveal the previous pulse');
  consume(feedback, [damage(3)], people, 180); assert.equal(show(feedback, people, 190, { lifeKey: 'round-2' }).visible, false);
  assert.equal(show(feedback, people, 190).visible, false, 'returning to the old context cannot restore its pulse');
  feedback.reset({ clearHistory: true }); assert.equal(consume(feedback, [damage()], people, 200).visible, true);
});

test('reduced motion keeps distinct colors and shapes while suppressing movement', () => {
  const people = players(), feedback = createHitFeedback(); consume(feedback, [damage(1, { headshot: true })], people);
  const view = show(feedback, people, 100, { reducedMotion: true });
  assert.equal(view.visible, true); assert.equal(view.reducedMotion, true); assert.equal(view.kind, 'headshot'); assert.equal(view.symbol, '✦');
  const css = readFileSync(new URL('../public/voxel-hit-feedback.css', import.meta.url), 'utf8');
  assert.match(css, /\[data-hit-motion=reduced\][^\n]*animation:none!important/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
});

function node() {
  const attributes = new Map(), writes = [];
  return { attributes, writes, hidden: true, textContent: '×', getAttribute: name => attributes.get(name) ?? null, setAttribute(name, value) { attributes.set(name, value); writes.push([name, value]); } };
}

test('DOM painter tints crosshair and scoped aim point without changing their position or spread', () => {
  const elements = { crosshair: node(), scope: node(), marker: node() }, people = players(), view = consume(createHitFeedback(), [damage(1, { headshot: true })], people);
  paintHitFeedback(elements, view);
  for (const [name, element] of Object.entries(elements)) {
    assert.equal(element.attributes.get('data-hit-role'), name); assert.equal(element.attributes.get('data-hit-kind'), 'headshot');
    assert.ok(element.writes.every(([name]) => name.startsWith('data-')), 'never writes layout, spread, stance, class or inline styles');
  }
  assert.equal(elements.marker.hidden, false); assert.equal(elements.marker.textContent, '✦');
  const count = Object.values(elements).reduce((sum, element) => sum + element.writes.length, 0); paintHitFeedback(elements, view);
  assert.equal(Object.values(elements).reduce((sum, element) => sum + element.writes.length, 0), count, 'unchanged render frames cause no attribute writes');
  paintHitFeedback(elements, { visible: false }); assert.equal(elements.marker.hidden, true);
  assert.equal(elements.crosshair.attributes.get('data-hit-kind'), ''); assert.equal(elements.scope.attributes.get('data-hit-kind'), '');
});

test('new physical melee identities produce blood, while a generic monster punch remains blunt', () => {
  const people = players(), incoming = id => damage(1, { playerId: 1, targetId: 0, weapon: id, attack: id });
  for (const id of ['katana', 'axe', 'tonfas']) assert.equal(incomingDamageFeedback(incoming(id), people[0], people).kind, 'blood');
  assert.equal(incomingDamageFeedback(incoming('monsterPunch'), people[0], people).kind, 'impact');
});

test('pure presentation refuses a changed subject, restored life and impossible time', () => {
  const people = players(), feedback = { subjectId: 0, lifeKey: 1, at: 100, until: 340, kind: 'headshot', pulse: 1 };
  for (const options of [{ now: 99, lifeKey: 1 }, { now: 340, lifeKey: 1 }, { now: 120, lifeKey: 2 }, { now: 120, lifeKey: 1, active: false }]) assert.equal(hitFeedbackPresentation(feedback, people[0], options).visible, false);
  assert.equal(hitFeedbackPresentation(feedback, people[1], { now: 120, lifeKey: 1 }).visible, false);
});
