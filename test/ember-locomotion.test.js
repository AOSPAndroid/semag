import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, step, togglePause, chooseRoute } from '../public/solo/ember-engine.js';

const DT = 1 / 120;
const close = (actual, expected, tolerance = 1e-7) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} ≠ ${expected}`);
const ticks = (s, count, input = {}) => { for (let i = 0; i < count; i++) step(s, input); };
function room(difficulty = 'veteran') {
  const s = createState({ seed: 73, difficulty });
  s.enemies = [];
  s.room.obstacles = [];
  return s;
}
function patrol(s, count, extra = {}) {
  let direction = 1;
  for (let i = 0; i < count; i++) {
    if (s.player.x > 820) direction = -1;
    else if (s.player.x < 100) direction = 1;
    step(s, { moveX: direction, aimX: direction, aimY: 0, ...extra });
  }
}

test('forward sprint travels faster while paying its full stamina cost at each supported timestep', () => {
  for (const dt of [1 / 120, 1 / 60, 1 / 30]) {
    const jog = room(), run = room();
    jog.player.stamina = run.player.stamina = 60;
    step(jog, { right: true, aimX: 1, aimY: 0 }, dt);
    step(run, { right: true, aimX: 1, aimY: 0, sprint: true }, dt);
    close(run.player.x - 105, (jog.player.x - 105) * 1.4);
    close(run.player.stamina, 60 - 24 * dt);
    assert.equal(run.player.sprinting, true);
    assert.ok(jog.player.stamina > 60);
  }
});

test('sprint follows the camera direction and does not accelerate backpedaling or pure strafing', () => {
  for (const move of [{ moveX: -1, moveY: 0 }, { moveX: 0, moveY: 1 }]) {
    const s = room();
    step(s, { ...move, aimX: 1, aimY: 0, sprint: true });
    close(Math.hypot(s.player.x - 105, s.player.y - 320), 245 * DT);
    assert.equal(s.player.sprinting, false);
    assert.equal(s.player.stamina, 100);
  }
  const rotated = room();
  step(rotated, { moveX: 0, moveY: 1, aimX: 0, aimY: 1, sprint: true });
  close(rotated.player.y - 320, 245 * 1.4 * DT);
  assert.equal(rotated.player.sprinting, true);
});

test('crouch and quiet walking override sprint without spending sprint stamina', () => {
  const jog = room(), crouch = room(), walk = room();
  step(jog, { right: true });
  step(crouch, { right: true, sprint: true, crouch: true, walk: true });
  step(walk, { right: true, sprint: true, walk: true });
  close(crouch.player.x - 105, (jog.player.x - 105) * .48);
  close(walk.player.x - 105, (jog.player.x - 105) * .57);
  assert.equal(crouch.player.crouching, true);
  assert.equal(crouch.player.walking, false);
  assert.equal(walk.player.walking, true);
  for (const s of [crouch, walk]) { assert.equal(s.player.sprinting, false); assert.equal(s.player.stamina, 100); }
  step(crouch, { right: true });
  assert.equal(crouch.player.crouching, false);
});

test('sprint uses normalized diagonal input and ignores nonboolean stance buttons', () => {
  const straight = room(), diagonal = room();
  step(straight, { moveX: 1, aimX: 1, aimY: 0, sprint: true });
  step(diagonal, { moveX: 1, moveY: 1, aimX: 1, aimY: 1, sprint: true });
  close(Math.hypot(diagonal.player.x - 105, diagonal.player.y - 320), straight.player.x - 105);
  close(diagonal.player.stamina, straight.player.stamina);
  const invalid = room();
  step(invalid, { right: true, sprint: 'yes', crouch: 'yes', walk: 'yes' });
  assert.equal(invalid.player.sprinting, false);
  assert.equal(invalid.player.crouching, false);
  assert.equal(invalid.player.walking, false);
});

test('a fully blocked sprint neither drains stamina nor prevents delayed recovery', () => {
  const s = room();
  s.room.obstacles = [{ x: 150, y: 250, width: 30, height: 140 }];
  s.player.x = 138;
  s.player.stamina = 60;
  ticks(s, 240, { right: true, aimX: 1, aimY: 0, sprint: true });
  assert.equal(s.player.x, 138);
  assert.equal(s.player.stamina, 100);
  assert.equal(s.player.sprinting, false);
  assert.equal(s.player.sprintRegenDelay, 0);
});

test('sprint pays for partial travel into cover and slides without passing through it', () => {
  const s = room();
  s.room.obstacles = [{ x: 150, y: 250, width: 30, height: 140 }];
  s.player.x = 137;
  s.player.stamina = 60;
  step(s, { right: true, aimX: 1, aimY: 0, sprint: true });
  close(s.player.x, 138);
  close(s.player.stamina, 60 - 24 * DT / (245 * 1.4 * DT));
  const blockedStamina = s.player.stamina;
  ticks(s, 30, { right: true, aimX: 1, aimY: 0, sprint: true });
  close(s.player.stamina, blockedStamina);
  ticks(s, 10, { right: true, down: true, aimX: 1, aimY: 1, sprint: true });
  close(s.player.x, 138);
  assert.ok(s.player.y > 320);
  assert.ok(s.player.stamina < blockedStamina);
});

test('large sprint steps still sweep a thin obstacle and rounded corners', () => {
  const s = room();
  s.room.obstacles = [{ x: 120, y: 250, width: 1, height: 140 }];
  step(s, { right: true, aimX: 1, aimY: 0, sprint: true }, 1 / 30);
  close(s.player.x, 108);
  assert.equal(s.player.radius, 12);
  ticks(s, 120, { right: true, crouch: true }, 1 / 30);
  close(s.player.x, 108);
});

test('sprinting cannot refill its own pool and exhaustion requires both recovery and a released sprint key', () => {
  const s = room();
  patrol(s, 500, { sprint: true });
  assert.equal(s.player.stamina, 0);
  assert.equal(s.player.sprintExhausted, true);
  assert.equal(s.player.sprinting, false);
  patrol(s, 400, { sprint: true });
  assert.ok(s.player.stamina > 25);
  assert.equal(s.player.sprintExhausted, true);
  assert.equal(s.player.sprinting, false);
  step(s);
  assert.equal(s.player.sprintExhausted, false);
  patrol(s, 1, { sprint: true });
  assert.equal(s.player.sprinting, true);
});

test('an almost empty sprint pool only buys the remaining fraction of boosted movement', () => {
  const s = room();
  s.player.stamina = .05;
  step(s, { right: true, aimX: 1, aimY: 0, sprint: true });
  close(s.player.stamina, 0);
  close(s.player.x - 105, 245 * DT * 1.1);
  assert.equal(s.player.sprintExhausted, true);
  assert.equal(s.player.sprinting, false);
  ticks(s, 20, { right: true, aimX: 1, aimY: 0, sprint: true });
  close(s.player.stamina, 0);
});

test('released sprint waits before regenerating and keeps each difficulty’s combat recovery rate', () => {
  for (const difficulty of ['standard', 'veteran', 'nightmare']) {
    const s = room(difficulty);
    s.player.stamina = 60;
    step(s, { right: true, aimX: 1, aimY: 0, sprint: true });
    const spent = s.player.stamina;
    ticks(s, 140);
    close(s.player.stamina, spent);
    ticks(s, 40);
    assert.ok(s.player.stamina > spent);
    assert.ok(s.player.stamina < 100);
  }
});

test('blade, spell and interaction inputs stop sprint immediately and respect their commitments', () => {
  for (const action of ['melee', 'spell', 'interact']) {
    const s = room();
    step(s, { right: true, aimX: 1, aimY: 0, sprint: true, [action]: true });
    close(s.player.x - 105, 245 * DT);
    assert.equal(s.player.sprinting, false);
    if (action !== 'interact') {
      step(s, { right: true, aimX: 1, aimY: 0, sprint: true });
      assert.equal(s.player.sprinting, false);
      assert.ok(action === 'melee' ? s.player.attackTime > 0 : s.player.castTime > 0);
    }
  }
});

test('sprinting still reserves real stamina for edge-triggered dodges, which interrupt the stance', () => {
  const s = room();
  patrol(s, 120, { sprint: true });
  const before = s.player.stamina;
  step(s, { right: true, aimX: 1, aimY: 0, sprint: true, crouch: true, dash: true });
  close(s.player.stamina, before - 34);
  assert.ok(s.player.dashTime > 0);
  assert.ok(s.player.invulnerable > 0);
  assert.equal(s.player.sprinting, false);
  assert.equal(s.player.crouching, false);
  assert.equal(s.events.filter(e => e.type === 'dash').length, 1);
  ticks(s, 15, { dash: true, sprint: true });
  assert.equal(s.events.filter(e => e.type === 'dash').length, 1);
  const exhausted = room();
  exhausted.player.stamina = 20;
  step(exhausted, { dash: true });
  assert.equal(exhausted.player.dashTime, 0);
});

test('crouching changes the stance but does not dodge damage or shrink cover collision', () => {
  const s = room();
  const guard = createState({ seed: 73 }).enemies[0];
  s.enemies = [{ ...guard, x: 800, y: 500, timer: 10 }];
  s.player.invulnerable = 0;
  s.projectiles = [{ id: 1, owner: 'enemy', x: s.player.x, y: s.player.y, vx: 0, vy: 0, radius: 5, damage: 10, life: 1, hits: [] }];
  step(s, { crouch: true });
  assert.equal(s.player.hp, 130);
  assert.equal(s.player.radius, 12);
  assert.equal(s.player.invulnerable, 0);
  assert.equal(s.player.crouching, true);
});

test('pausing clears locomotion, freezes resources, and resumes without a stuck sprint pose', () => {
  const s = room();
  step(s, { right: true, aimX: 1, aimY: 0, sprint: true });
  const stamina = s.player.stamina;
  togglePause(s);
  assert.equal(s.player.sprinting, false);
  assert.equal(s.player.velocityX, 0);
  const before = structuredClone(s);
  ticks(s, 300, { sprint: true, crouch: true });
  assert.deepEqual(s, before);
  assert.equal(s.player.stamina, stamina);
  togglePause(s);
  step(s);
  assert.equal(s.player.sprinting, false);
  assert.equal(s.player.crouching, false);
});

test('route entry clears stance and velocity without refilling the run’s stamina budget', () => {
  const s = room();
  step(s, { right: true, aimX: 1, aimY: 0, sprint: true });
  const stamina = s.player.stamina, delay = s.player.sprintRegenDelay;
  s.phase = 'route'; s.choices = [{ id: 'combat' }];
  assert.equal(chooseRoute(s, 'combat'), true);
  assert.equal(s.player.sprinting, false);
  assert.equal(s.player.crouching, false);
  assert.equal(s.player.walking, false);
  assert.equal(s.player.velocityX, 0);
  assert.equal(s.player.stamina, stamina);
  assert.equal(s.player.sprintRegenDelay, delay);
});

test('death clears the stance and velocity instead of leaving the runner animated', () => {
  const s = room();
  s.player.hp = 1;
  s.player.invulnerable = 0;
  s.enemies = [{ ...createState({ seed: 73 }).enemies[0], x: 800, y: 500, timer: 10 }];
  s.projectiles = [{ id: 1, owner: 'enemy', x: s.player.x + 245 * 1.4 * DT, y: s.player.y, vx: 0, vy: 0, radius: 5, damage: 10, life: 1, hits: [] }];
  step(s, { right: true, aimX: 1, aimY: 0, sprint: true });
  assert.equal(s.phase, 'lost');
  assert.equal(s.player.sprinting, false);
  assert.equal(s.player.velocityX, 0);
  const before = structuredClone(s);
  ticks(s, 120, { sprint: true });
  assert.deepEqual(s, before);
});
