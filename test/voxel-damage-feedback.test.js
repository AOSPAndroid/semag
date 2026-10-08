import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, applyCombatDamage, PLAYER_HEALTH } from '../public/voxel-engine.js';
import { DAMAGE_CUE_MS, incomingDamageFeedback, damageFeedbackPresentation, paintDamageFeedback } from '../public/voxel-damage-feedback.js';

const player = { id: 0, team: 0, hp: 172, maxHp: 200, x: 0, z: 0, yaw: 0, alive: true };
const source = { id: 1, team: 1, x: 0, z: -8 };
const hit = { type: 'damage', playerId: 1, targetId: 0, damage: 28, hp: 172, attack: 'gun', weapon: 'carbine' };

test('real authoritative HP loss creates bounded edge blood; contacts and friendly cover cannot', () => {
  const state = createState();
  applyCombatDamage(state, [{ playerId: 1, targetId: 0, damage: 28, attack: 'gun', weapon: 'carbine' }]);
  assert.equal(state.players[0].hp, PLAYER_HEALTH - 28);
  const actual = state.events.find(event => event.type === 'damage');
  const cue = incomingDamageFeedback(actual, state.players[0], state.players, { now: 100, lifeKey: 1 });
  assert.equal(cue.kind, 'blood'); assert.equal(cue.until, 100 + DAMAGE_CUE_MS); assert.ok(cue.strength <= .42);
  for (const event of [{ ...hit, type: 'shot' }, { ...hit, type: 'meleeHit' }, { ...hit, damage: 0 }, { ...hit, damage: Infinity }, { ...hit, hp: undefined }, { ...hit, targetId: 4 }]) assert.equal(incomingDamageFeedback(event, player, [source]), null);
  assert.equal(incomingDamageFeedback(hit, player, [{ ...source, team: 0 }]), null);
  assert.equal(state.players[0].hp, PLAYER_HEALTH - 28, 'presentation must not apply further damage');
});

test('crossbow and blades bleed; storm and frag use a plain edge cue', () => {
  for (const [attack, weapon] of [['bolt', 'crossbow'], ['sword', 'sword'], ['knife', 'knife']]) assert.equal(incomingDamageFeedback({ ...hit, attack, weapon }, player, [source]).kind, 'blood');
  assert.equal(incomingDamageFeedback({ ...hit, attack: 'storm', weapon: null, playerId: null }, player, []).kind, 'hazard');
  assert.equal(incomingDamageFeedback({ ...hit, attack: 'grenade', weapon: 'grenade' }, player, [source]).kind, 'impact');
  assert.equal(incomingDamageFeedback({ ...hit, attack: 'disconnect', weapon: null }, player), null);
});

test('direction follows camera yaw and never marks an unknown or self source', () => {
  const cue = incomingDamageFeedback(hit, player, [source], { now: 0, lifeKey: 2 });
  assert.equal(damageFeedbackPresentation(cue, player, { lifeKey: 2 }).direction, 'front');
  assert.equal(damageFeedbackPresentation(cue, player, { lifeKey: 2, yaw: -Math.PI / 2 }).direction, 'right');
  assert.equal(damageFeedbackPresentation(cue, player, { lifeKey: 2, yaw: Math.PI / 2 }).direction, 'left');
  assert.equal(damageFeedbackPresentation(cue, player, { lifeKey: 2, yaw: Math.PI }).direction, 'back');
  assert.equal(incomingDamageFeedback(hit, player, []).bearing, null);
  assert.equal(incomingDamageFeedback({ ...hit, playerId: 0, attack: 'grenade', weapon: 'grenade' }, player, [player]).bearing, null);
});

test('a delayed crossbow cue follows the arriving bolt after its owner moves to the opposite side', () => {
  const movedOwner = { ...source, z: 8 };
  const boltHit = { ...hit, attack: 'bolt', weapon: 'crossbow', dx: 0, dz: 1 };
  const cue = incomingDamageFeedback(boltHit, player, [movedOwner], { lifeKey: 2 });
  assert.equal(damageFeedbackPresentation(cue, player, { lifeKey: 2 }).direction, 'front', 'the bolt arrives from north although its owner is now south');
  assert.equal(damageFeedbackPresentation(incomingDamageFeedback({ ...boltHit, dx: 0, dz: 0 }, player, [movedOwner], { lifeKey: 2 }), player, { lifeKey: 2 }).direction, 'back', 'a vertical trajectory retains the source-position fallback');
  assert.equal(damageFeedbackPresentation(incomingDamageFeedback({ ...boltHit, attack: 'gun', weapon: 'carbine', dx: -1, dz: 0 }, player, [], { lifeKey: 2 }), player, { lifeKey: 2 }).direction, 'right', 'authoritative gun direction works without a current shooter position');
});

test('feedback follows the actual spectator subject and clears at life, death and phase boundaries', () => {
  const cue = incomingDamageFeedback(hit, player, [source], { now: 10, lifeKey: 7 });
  assert.equal(damageFeedbackPresentation(cue, player, { now: 20, lifeKey: 7 }).visible, true);
  for (const [subject, options] of [[{ ...player, id: 1 }, { lifeKey: 7 }], [player, { lifeKey: 8 }], [{ ...player, alive: false }, { lifeKey: 7 }], [player, { lifeKey: 7, active: false }]]) assert.equal(damageFeedbackPresentation(cue, subject, { now: 20, ...options }).visible, false);
  const spectator = { ...player, id: 2, team: 1 };
  const spectatedHit = { ...hit, targetId: 2 };
  assert.equal(incomingDamageFeedback(spectatedHit, spectator, [source], { friendlyFire: true }).subjectId, 2, 'Royale has no allied damage filter');
  assert.equal(incomingDamageFeedback(spectatedHit, player, [source], { friendlyFire: true }), null);
});

test('damage fades completely after 420ms with no persistent low-health blood', () => {
  const cue = incomingDamageFeedback(hit, player, [source], { now: 100, lifeKey: 1 });
  const start = damageFeedbackPresentation(cue, player, { now: 100, lifeKey: 1 });
  const fade = damageFeedbackPresentation(cue, { ...player, hp: 1 }, { now: 300, lifeKey: 1 });
  assert.ok(start.opacity > fade.opacity && fade.opacity > 0);
  assert.equal(damageFeedbackPresentation(cue, player, { now: 520, lifeKey: 1 }).visible, false);
  assert.equal(damageFeedbackPresentation(cue, player, { now: 99, lifeKey: 1 }).visible, false);
});

test('painting reuses a single overlay and exposes truthful subject, kind and bearing', () => {
  const element = { hidden: true, dataset: {}, style: { setProperty(name, value) { this[name] = value; } } };
  paintDamageFeedback(element, { visible: true, subjectId: 3, kind: 'blood', opacity: .25, angle: Math.PI / 2, direction: 'right' });
  assert.equal(element.hidden, false); assert.equal(element.dataset.subject, '3'); assert.equal(element.dataset.kind, 'blood'); assert.equal(element.dataset.direction, 'right'); assert.equal(element.style['--damage-opacity'], '0.25');
  paintDamageFeedback(element, { visible: false }); assert.equal(element.hidden, true);
});
