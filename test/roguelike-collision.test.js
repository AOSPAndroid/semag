import test from 'node:test';
import assert from 'node:assert/strict';
import { createState as createEmber, step as stepEmber, togglePause as pauseEmber } from '../public/solo/ember-engine.js';
import { createState as createRift, step as stepRift, togglePause as pauseRift } from '../public/solo/rift-engine.js';

const DT = 1 / 30;
const families = [
  { name: 'Ember', create: () => createEmber({ seed: 1 }), step: stepEmber, pause: pauseEmber, speed: 580, radius: 6 },
  { name: 'Rift', create: () => createRift({ random: () => .4 }), step: stepRift, pause: pauseRift, speed: 780, radius: 4 },
];
function quiet(family) {
  const state = family.create();
  state.enemies = [{ ...state.enemies[0], x: 850, y: 550, hp: 1000, maxHp: 1000, speed: 0, phase: 'recover', timer: 100 }];
  state.projectiles = [];
  state.player.invulnerable = state.player.damageCooldown = 0;
  return state;
}
function bullet(owner, x, y, vx, vy, radius = 5, extra = {}) {
  return { id: 999, owner, x, y, vx, vy, radius, damage: 10, life: 1, hits: [], pierce: 0, bounces: 0, ...extra };
}
function entry(ox, oy, dx, dy, radius) {
  const a = dx * dx + dy * dy, b = 2 * (ox * dx + oy * dy);
  return (-b - Math.sqrt(b * b - 4 * a * (ox * ox + oy * oy - radius * radius))) / (2 * a);
}
function near(actual, expected, message = '') { assert.ok(Math.abs(actual - expected) < 1e-7, `${message}: ${actual} versus ${expected}`); }
function segmentGap(a, b, corner) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((corner.x - a.x) * dx + (corner.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(a.x + dx * t - corner.x, a.y + dy * t - corner.y);
}

for (const family of families) {
  test(`${family.name}: a normal-speed shot passing before a moving player arrives is a clean graze`, () => {
    const state = quiet(family), player = state.player, hp = player.hp;
    player.x = 480; player.y = 300 + player.moveSpeed * DT + 16.8;
    state.projectiles = [bullet('enemy', 484.75, 300, -285, 0)];
    family.step(state, { up: true }, DT);
    near(player.y, 316.8);
    assert.equal(player.hp, hp);
    assert.ok(!state.events.some(e => e.type === 'hurt'));
    assert.equal(state.projectiles.length, 1);
  });

  test(`${family.name}: a genuine moving interception reports the first projectile contact, before its frame endpoint`, () => {
    const state = quiet(family), player = state.player, hp = player.hp;
    player.x = 480; player.y = 310;
    state.projectiles = [bullet('enemy', 505, 300, -285, 0)];
    const t = entry(25, -10, -285 * DT, player.moveSpeed * DT, 17);
    assert.ok(t > 0 && t < 1);
    family.step(state, { up: true }, DT);
    const hit = state.events.find(e => e.type === 'hurt');
    assert.equal(player.hp, hp - 10);
    assert.equal(state.events.filter(e => e.type === 'hurt').length, 1);
    near(hit.x, 505 - 285 * DT * t, 'first impact x'); near(hit.y, 300);
    assert.ok(Math.abs(hit.x - player.x) > 10);
    assert.ok(Math.abs(hit.x - (505 - 285 * DT)) > .1);
    assert.equal(state.projectiles.length, 0);
  });

  test(`${family.name}: player shots use a charging target's trajectory, not its eventual position`, () => {
    const state = quiet(family), target = state.enemies[0];
    const radius = target.radius + family.radius;
    Object.assign(target, { x: 530, y: 300 + 450 * DT + radius - .2, phase: 'charge', aimX: 0, aimY: -1,
      chargeSpeed: 450, committedChargeSpeed: 450, timer: 1 });
    state.player.x = 100; state.player.y = 550;
    state.projectiles = [bullet('player', 530 + family.speed * DT / 2, 300, -family.speed, 0, family.radius)];
    family.step(state, {}, DT);
    near(target.y, 300 + radius - .2);
    assert.equal(target.hp, 1000);
    assert.ok(!state.events.some(e => e.type === 'hit'));
  });

  test(`${family.name}: a moving enemy's hit spark is at first bolt contact, not at its final center`, () => {
    const state = quiet(family), target = state.enemies[0];
    Object.assign(target, { x: 530, y: 330, phase: 'charge', aimX: 0, aimY: -1,
      chargeSpeed: 450, committedChargeSpeed: 450, timer: 1 });
    // The enemy moves up into the shot's line during this same step.
    state.player.x = 100; state.player.y = 550;
    state.projectiles = [bullet('player', 500, 320, family.speed, 0, family.radius)];
    const t = entry(-30, -10, family.speed * DT, 450 * DT, target.radius + family.radius);
    family.step(state, {}, DT);
    const hit = state.events.find(e => e.type === 'hit');
    assert.equal(target.hp, 990);
    near(hit.x, 500 + family.speed * DT * t); near(hit.y, 320);
    assert.ok(Math.abs(hit.x - target.x) > 1);
    assert.ok(Math.abs(hit.x - (500 + family.speed * DT)) > 1);
  });

  test(`${family.name}: a new muzzle shot cannot retrospectively strike an enemy's earlier position`, () => {
    const state = quiet(family), target = state.enemies[0], player = state.player;
    player.x = 100; player.y = 320; player.invulnerable = 1;
    Object.assign(target, { x: family.name === 'Ember' ? 125 : 121, y: 330,
      phase: 'charge', aimX: 0, aimY: 1, chargeSpeed: 450, committedChargeSpeed: 450, timer: 1 });
    family.step(state, { spell: true, fire: true, aimX: 1, aimY: 0 }, DT);
    assert.equal(target.hp, 1000);
    assert.equal(state.projectiles.length, 1);
    assert.ok(!state.events.some(e => e.type === 'hit'));
  });

  test(`${family.name}: cover absorbs a shot at its surface before an actor beyond it`, () => {
    const state = quiet(family);
    const cover = family.name === 'Ember' ? state.room.obstacles[0] : { x: 280, y: 200, width: 90, height: 70 };
    const y = cover.y + cover.height / 2;
    Object.assign(state.enemies[0], { x: cover.x + cover.width + 50, y });
    state.projectiles = [bullet('player', cover.x - 40, y, 6000, 0, family.radius)];
    family.step(state, {}, DT);
    assert.equal(state.enemies[0].hp, 1000);
    const impact = state.events.find(e => e.type === 'impact');
    assert.equal(impact.kind, 'cover'); near(impact.x, cover.x - family.radius); near(impact.y, y);
    assert.equal(state.projectiles.length, 0);
  });

  test(`${family.name}: touching cover permits retreat and tangent sliding while stopping a dash at exact contact`, () => {
    const state = quiet(family), player = state.player;
    const cover = family.name === 'Ember' ? state.room.obstacles[0] : { x: 280, y: 200, width: 90, height: 70 };
    player.x = cover.x - 45; player.y = cover.y + cover.height / 2;
    family.step(state, { right: true, dash: true }, DT);
    family.step(state, { right: true }, DT);
    near(player.x, cover.x - player.radius, 'no floating wall gap');
    player.dashTime = 0;
    const y = player.y;
    family.step(state, { up: true }, DT);
    near(player.x, cover.x - player.radius); assert.ok(player.y < y);
    family.step(state, { left: true }, DT);
    assert.ok(player.x < cover.x - player.radius);
  });

  test(`${family.name}: a rounded-corner dash follows two clear segments instead of cutting through the pillar`, () => {
    const state = quiet(family), player = state.player;
    const cover = family.name === 'Ember' ? state.room.obstacles[0] : { x: 280, y: 200, width: 90, height: 70 };
    const start = { x: cover.x - player.radius, y: cover.y - 1 };
    Object.assign(player, start);
    const delta = (family.name === 'Ember' ? 660 : 620) * DT / Math.sqrt(2);
    const t = entry(-player.radius, -1, delta, -delta, player.radius);
    const contact = { x: start.x + delta * t, y: start.y - delta * t };
    const normal = { x: (contact.x - cover.x) / player.radius, y: (contact.y - cover.y) / player.radius };
    const remainder = { x: delta * (1 - t), y: -delta * (1 - t) };
    const dot = remainder.x * normal.x + remainder.y * normal.y;
    const end = { x: contact.x + remainder.x - dot * normal.x, y: contact.y + remainder.y - dot * normal.y };
    family.step(state, { right: true, up: true, dash: true }, DT);
    near(player.x, end.x); near(player.y, end.y);
    assert.ok(segmentGap(start, contact, cover) >= player.radius - 1e-7);
    assert.ok(segmentGap(contact, player, cover) >= player.radius - 1e-7);
    assert.ok(player.x < cover.x, 'cover removed the inward velocity');
  });

  test(`${family.name}: a charger crossing a vulnerable stationary player hits on that step, once`, () => {
    const state = quiet(family), player = state.player, target = state.enemies[0], hp = player.hp;
    player.x = 480; player.y = 320;
    Object.assign(target, { x: 525, y: 320, phase: 'charge', aimX: -1, aimY: 0,
      chargeSpeed: 450, committedChargeSpeed: 450, timer: 1 });
    family.step(state, {}, DT);
    assert.ok(player.hp < hp, 'charge reaches the player this step, rather than one frame late');
    assert.equal(state.events.filter(e => e.type === 'hurt').length, 1);
    const after = player.hp;
    family.step(state, {}, DT);
    assert.equal(player.hp, after, 'shared hurt cooldown still limits contact');
  });

  test(`${family.name}: swept paths stay private, paused contact stays frozen, and lethal interception is terminal`, () => {
    const state = quiet(family), player = state.player;
    player.x = 480; player.y = 320; player.hp = 1;
    state.projectiles = [bullet('enemy', 505, 320, -285, 0)];
    family.pause(state); const paused = structuredClone(state);
    family.step(state, { right: true, dash: true }, DT); assert.deepEqual(state, paused);
    family.pause(state); family.step(state, {}, DT);
    assert.equal(state.phase, 'lost'); assert.equal(player.hp, 0);
    assert.equal(Object.hasOwn(player, 'motion'), false);
    const terminal = structuredClone(state);
    family.step(state, { right: true }, DT); assert.deepEqual(state, terminal);
    assert.doesNotThrow(() => JSON.stringify(state));
  });
}

test('Ember piercing resolves the nearest body first regardless of enemy array order', () => {
  const family = families[0], state = quiet(family), template = state.enemies[0];
  state.player.x = 100; state.player.y = 320;
  state.enemies = [{ ...template, id: 100, x: 530, y: 320 }, { ...template, id: 101, x: 480, y: 320 }];
  state.projectiles = [bullet('player', 420, 320, 6000, 0, 6, { pierce: 1 })];
  family.step(state, {}, DT);
  const hits = state.events.filter(e => e.type === 'hit');
  assert.deepEqual(hits.map(e => e.enemyId), [101, 100]);
  near(hits[0].x, 460); near(hits[1].x, 510);
  assert.ok(state.enemies.every(e => e.hp === 990));
});
