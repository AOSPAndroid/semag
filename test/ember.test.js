import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, step, togglePause, chooseRoute, chooseReward, chooseCamp, RELICS, BOSSES } from '../public/solo/ember-engine.js';
const ticks = (s, n, input = {}) => { for (let i = 0; i < n; i++) step(s, input); };
const reward = (s, id) => { s.phase = 'reward'; s.choices = [{ ...RELICS[id] }]; s.pending = 'treasure'; assert.equal(chooseReward(s, id), true); };

test('seeded rooms and enemy timings replay exactly', () => {
  const a = createState({ seed: 987 }), b = createState({ seed: 987 });
  ticks(a, 600, { right: true, spell: true }); ticks(b, 600, { right: true, spell: true });
  assert.deepEqual(a, b); assert.notDeepEqual(createState({ seed: 1 }).enemies, createState({ seed: 2 }).enemies);
});
test('starting room has four distinct enemy behaviors and a sealed physical exit', () => {
  const s = createState({ seed: 7 }); assert.equal(new Set(s.enemies.map(e => e.type)).size, 4);
  s.player.x = 890; s.player.y = 320; step(s, { interact: true }); assert.equal(s.phase, 'playing'); assert.equal(s.room.cleared, false);
});
test('room rewards require a cleared room and physically reaching the exit', () => {
  const s = createState({ seed: 2 }); s.enemies = []; step(s); assert.equal(s.room.cleared, true);
  step(s, { interact: true }); assert.equal(s.phase, 'playing'); step(s); s.player.x = 890; s.player.y = 320;
  step(s, { interact: true }); assert.equal(s.phase, 'reward'); assert.equal(s.choices.length, 3); assert.equal(new Set(s.choices.map(c => c.id)).size, 3);
});
test('route choices offer visible safety versus combat risk and keep resources', () => {
  const s = createState({ seed: 3 }); s.phase = 'reward'; s.pending = 'advance'; s.choices = [{ ...RELICS.coil }]; s.player.hp = 63; s.player.mana = 37; s.gold = 14;
  chooseReward(s, 'coil'); assert.equal(s.phase, 'route'); assert.deepEqual(s.choices.map(c => c.id), ['combat', 'treasure']);
  assert.equal(chooseRoute(s, 'boss'), false); assert.equal(chooseRoute(s, 'treasure'), true);
  assert.equal(s.depth, 2); assert.equal(s.room.kind, 'treasure'); assert.equal(s.player.hp, 63); assert.equal(s.player.mana, 37); assert.equal(s.gold, 14);
});
test('treasure needs shrine interaction before its exit can open', () => {
  const s = createState({ seed: 4 }); s.phase = 'route'; s.choices = [{ id: 'treasure' }]; chooseRoute(s, 'treasure');
  step(s, { interact: true }); assert.equal(s.phase, 'playing'); assert.equal(s.room.cleared, false);
  step(s); s.player.x = s.room.shrine.x; s.player.y = s.room.shrine.y; step(s, { interact: true }); assert.equal(s.phase, 'reward');
  chooseReward(s, s.choices[0].id); assert.equal(s.room.cleared, true); assert.equal(s.room.rewardTaken, true);
});
test('camp purchase rejects insufficient gold while free meditation changes resources', () => {
  const s = createState({ seed: 5 }); s.phase = 'camp'; s.choices = [{ id: 'rest' }, { id: 'meditate' }]; s.player.hp = 20; s.gold = 19;
  assert.equal(chooseCamp(s, 'rest'), false); assert.equal(s.player.hp, 20); assert.equal(s.gold, 19);
  const mana = s.player.maxMana; assert.equal(chooseCamp(s, 'meditate'), true); assert.equal(s.player.maxMana, mana + 10); assert.equal(s.player.mana, mana + 10);
});
test('camp healing spends gold, caps health, and carries the run', () => {
  const s = createState({ seed: 6 }); s.phase = 'camp'; s.choices = [{ id: 'rest' }]; s.gold = 31; s.player.hp = 130;
  assert.equal(chooseCamp(s, 'rest'), true); assert.equal(s.player.hp, 140); assert.equal(s.gold, 11); assert.equal(s.room.cleared, true);
});
test('pause freezes combat and restores every decision phase without consuming choices', () => {
  for (const phase of ['playing', 'route', 'reward', 'camp']) {
    const s = createState({ seed: 7 }); s.phase = phase; s.choices = [{ id: 'blade' }]; togglePause(s); const before = structuredClone(s); ticks(s, 120, { melee: true, spell: true, right: true }); assert.deepEqual(s, before); togglePause(s); assert.equal(s.phase, phase); assert.deepEqual(s.choices, [{ id: 'blade' }]);
  }
});
test('melee has an aiming arc, stamina cost, cooldown, and no wall penetration', () => {
  const s = createState({ seed: 8 }); const p = s.player; p.x = 480; p.y = 320;
  s.enemies = [{ ...s.enemies[0], type: 'crawler', x: 540, y: 320, hp: 100, maxHp: 100, timer: 10 }, { ...s.enemies[1], id: 99, type: 'crawler', x: 420, y: 320, hp: 100, maxHp: 100, timer: 10 }];
  step(s, { melee: true, aimX: 1, aimY: 0 }); assert.equal(s.enemies[0].hp, 70); assert.equal(s.enemies[1].hp, 100); assert.ok(p.stamina < 100);
  ticks(s, 10, { melee: true, aimX: 1, aimY: 0 }); assert.equal(s.enemies[0].hp, 70);
  const o = s.room.obstacles[0]; p.x = o.x - 20; p.y = o.y + o.height / 2; s.enemies = [{ ...s.enemies[0], x: o.x + o.width + 10, y: p.y, hp: 100 }]; p.attackCooldown = 0; step(s, { melee: true, aimX: 1, aimY: 0 }); assert.equal(s.enemies[0].hp, 100);
});
test('spells consume mana, cooldown gates firing, and pillars stop projectiles', () => {
  const s = createState({ seed: 9 }); s.enemies = [{ ...s.enemies[0], x: 850, y: 550, timer: 10 }]; const p = s.player; const o = s.room.obstacles[0]; p.x = o.x - 50; p.y = o.y + o.height / 2;
  step(s, { spell: true, aimX: 1, aimY: 0 }); assert.ok(p.mana < 90); assert.equal(s.projectiles.length, 1);
  ticks(s, 20); assert.equal(s.projectiles.length, 0); p.mana = 2; p.spellCooldown = 0; step(s, { spell: true }); assert.equal(s.projectiles.length, 0);
});
test('dodge is edge triggered, grants invulnerability, and spends stamina once per press', () => {
  const s = createState({ seed: 10 }); s.enemies = []; const p = s.player;
  step(s, { dash: true, up: true }); assert.ok(p.invulnerable > 0); assert.ok(p.stamina < 70); const spent = p.stamina;
  ticks(s, 80, { dash: true }); assert.ok(p.stamina > spent); assert.equal(s.events.filter(e => e.type === 'dash').length, 1);
  step(s); step(s, { dash: true }); assert.equal(s.events.filter(e => e.type === 'dash').length, 2);
});
test('walls and cover remain solid during repeated movement and dashes', () => {
  const s = createState({ seed: 11 }); s.enemies = []; ticks(s, 240, { left: true, dash: true }); assert.equal(s.player.x, 54);
  const o = s.room.obstacles[0]; s.player.x = o.x - 30; s.player.y = o.y + o.height / 2; ticks(s, 150, { right: true }); assert.ok(s.player.x <= o.x - s.player.radius + .1);
});
test('relic stacks produce distinct stats and synergistic hit effects', () => {
  const s = createState({ seed: 12 }); reward(s, 'vitality'); reward(s, 'focus'); reward(s, 'blade'); reward(s, 'fleet'); reward(s, 'ember'); reward(s, 'coil'); reward(s, 'frost');
  assert.equal(s.player.maxHp, 160); assert.equal(s.player.maxMana, 120); assert.equal(s.player.swordDamage, 38); assert.equal(s.player.moveSpeed, 257);
  s.player.x = 480; s.player.y = 320; s.enemies = [{ ...s.enemies[0], type: 'crawler', hp: 200, maxHp: 200, x: 545, y: 320, timer: 10 }];
  step(s, { melee: true, aimX: 1, aimY: 0 }); assert.ok(s.enemies[0].burn > 0); const hp = s.enemies[0].hp;
  ticks(s, 20, { spell: true, aimX: 1, aimY: 0 }); assert.ok(s.enemies[0].hp < hp - 38); assert.ok(s.enemies[0].slow > 0);
});
test('shield guards frontal sword attacks but leaves its back vulnerable', () => {
  const s = createState({ seed: 13 }); s.player.x = 450; s.player.y = 320; const template = s.enemies.find(e => e.type === 'sentinel'); s.enemies = [{ ...template, x: 510, y: 320, hp: 200, maxHp: 200, aimX: -1, aimY: 0, timer: 10 }];
  step(s, { melee: true, aimX: 1, aimY: 0 }); assert.equal(s.enemies[0].hp, 189.5);
  s.player.x = 570; s.player.attackCooldown = 0; step(s, { melee: true, aimX: -1, aimY: 0 }); assert.equal(s.enemies[0].hp, 159.5);
});
test('bosses use different readable pattern cycles including final act summons', () => {
  const patterns = [];
  for (let act = 1; act <= 3; act++) { const s = createState({ seed: 14 }); s.act = act; s.depth = 3; s.phase = 'route'; s.choices = [{ id: 'boss' }]; chooseRoute(s, 'boss'); s.player.x = 80; s.player.y = 80; const tells = new Set();
    for (let i = 0; i < 2200; i++) { step(s); for (const e of s.events.filter(e => e.type === 'tell')) tells.add(e.kind); if (s.phase === 'lost') break; }
    patterns.push(tells); assert.equal(s.room.title, BOSSES[act - 1]); }
  assert.ok(patterns[0].has('sweep')); assert.ok(patterns[1].has('fan')); assert.ok(!patterns[1].has('summon')); assert.ok(patterns[2].has('summon'));
});
test('bounded effects and strict finite input keep long sessions stable', () => {
  const s = createState({ seed: 15 }); ticks(s, 2000, { moveX: Infinity, moveY: NaN, aimX: Infinity, aimY: NaN, melee: 'yes', spell: 'yes' });
  assert.ok(Number.isFinite(s.player.x)); assert.ok(Number.isFinite(s.player.aimX)); assert.ok(s.events.length <= 40); assert.ok(s.projectiles.length <= 160); assert.ok(s.enemies.length <= 18);
  const before = structuredClone(s); step(s, {}, NaN); step(s, {}, -1); assert.deepEqual(s, before);
});
test('defeat is terminal and a fresh seeded run resets relics, route, health, and score', () => {
  const s = createState({ seed: 16 }); s.player.hp = 1; s.player.invulnerable = 0; s.player.damageCooldown = 0; s.projectiles.push({ id: 1, owner: 'enemy', x: s.player.x, y: s.player.y, vx: 0, vy: 0, radius: 5, damage: 10, life: 1, hits: [] }); step(s); assert.equal(s.phase, 'lost'); const before = structuredClone(s); ticks(s, 120, { spell: true }); assert.deepEqual(s, before);
  const fresh = createState({ seed: 16 }); assert.equal(fresh.player.hp, 140); assert.equal(fresh.score, 0); assert.deepEqual(fresh.relics, {}); assert.deepEqual(fresh.routeHistory, []);
});

// This driver reads the public state and sends only legal game inputs/choices.
// Its navigation grid is outside the engine; it never alters enemies, health,
// damage, room completion, position, or any other game state to finish a run.
function navigation(s, start, goal) {
  const blocked = p => s.room.obstacles.some(o => p.x > o.x - 22 && p.x < o.x + o.width + 22 && p.y > o.y - 22 && p.y < o.y + o.height + 22);
  const pts = []; for (let y = 80; y <= 560; y += 40) for (let x = 80; x <= 880; x += 40) if (!blocked({ x, y })) pts.push({ x, y });
  const nearest = p => pts.reduce((a, b) => Math.hypot(b.x - p.x, b.y - p.y) < Math.hypot(a.x - p.x, a.y - p.y) ? b : a);
  const begin = nearest(start), end = nearest(goal), q = [begin], parents = new Map([[begin, null]]);
  for (let i = 0; i < q.length; i++) { const cur = q[i]; if (cur === end) break; for (const n of pts) if (!parents.has(n) && Math.abs(n.x - cur.x) + Math.abs(n.y - cur.y) === 40) { parents.set(n, cur); q.push(n); } }
  const out = [goal]; for (let n = end; n; n = parents.get(n)) out.unshift(n); return out;
}
function finishRun(seed, risky = false) {
  const s = createState({ seed }); let waypoint = 0, navTag = '', path = [], lastRoom = '';  const visited = new Set(), bosses = new Set();
  for (let frame = 0; frame < 120 * 500 && !['won', 'lost'].includes(s.phase); frame++) {
    if (lastRoom !== s.room.id) { lastRoom = s.room.id; waypoint = 0; }
    visited.add(s.room.id); if (s.room.kind === 'boss') bosses.add(s.room.title);
    if (s.phase === 'route') { chooseRoute(s, s.choices.find(c => (risky ? ['combat', 'elite', 'boss'] : ['treasure', 'camp', 'boss']).includes(c.id))?.id || s.choices[0].id); continue; }
    if (s.phase === 'reward') { const order = ['chalice', 'vitality', 'focus', 'coil', 'frost', 'blade', 'fleet', 'ember', 'duelist']; chooseReward(s, [...s.choices].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))[0].id); continue; }
    if (s.phase === 'camp') { chooseCamp(s, s.player.hp < s.player.maxHp - 30 && s.gold >= 20 ? 'rest' : 'meditate'); continue; }
    const p = s.player; let dx = 0, dy = 0, aimX = 1, aimY = 0, dash = false, interact = false;
    if (!s.enemies.length) {
      const target = s.room.cleared ? s.room.exit : s.room.shrine; const tag = s.room.id + String(s.room.cleared); if (tag !== navTag) { navTag = tag; path = navigation(s, p, target); }
      const t = path[0] || target; if (Math.hypot(t.x - p.x, t.y - p.y) < 20) path.shift(); dx = t.x - p.x; dy = t.y - p.y; if (Math.hypot(target.x - p.x, target.y - p.y) < 50) { dx = dy = 0; interact = frame % 2 === 0; }
    } else {
      const e = [...s.enemies].sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0]; aimX = e.x - p.x; aimY = e.y - p.y;
      const pts = [{ x: 120, y: 90 }, { x: 840, y: 90 }, { x: 840, y: 550 }, { x: 120, y: 550 }]; if (Math.hypot(pts[waypoint].x - p.x, pts[waypoint].y - p.y) < 30) waypoint = (waypoint + 1) % 4;
      dx = pts[waypoint].x - p.x; dy = pts[waypoint].y - p.y;
      dash = frame % 50 === 0 && (s.projectiles.some(b => b.owner === 'enemy' && Math.hypot(b.x - p.x, b.y - p.y) < 75) || Math.hypot(aimX, aimY) < 100);
    }
    const length = Math.hypot(dx, dy); step(s, { moveX: length ? dx / length : 0, moveY: length ? dy / length : 0, aimX, aimY, spell: s.enemies.length > 0, melee: s.enemies.length > 0, dash, interact });
  }
  return { s, visited, bosses };
}
test('actual input run traverses all twelve rooms and defeats three bosses on safe branches', () => {
  const { s, visited, bosses } = finishRun(12345); assert.equal(s.phase, 'won'); assert.equal(visited.size, 12); assert.equal(bosses.size, 3); assert.equal(s.roomsCleared, 12); assert.ok(s.kills >= 18); assert.ok(s.player.hp > 0); assert.ok(s.elapsed < 500); assert.ok(s.score > 5000);
});
test('actual input run wins combat and elite branches with greater risk rewards', () => {
  const safe = finishRun(12345), risky = finishRun(12345, true); assert.equal(risky.s.phase, 'won'); assert.equal(risky.visited.size, 12); assert.ok(risky.s.kills > safe.s.kills); assert.ok(risky.s.score > safe.s.score); assert.ok(risky.s.routeHistory.some(r => r.kind === 'elite'));
});

test('lethal burn cancels a queued enemy attack before damage and still awards the kill', () => {
  const s = createState({ seed: 24 }); s.player.x = 480; s.player.y = 320;
  s.player.hp = 10; s.player.invulnerable = 0; s.player.damageCooldown = 0;
  s.enemies = [{ ...s.enemies[0], type: 'crawler', x: 530, y: 320, hp: .01,
    burn: 3, burnDps: 10, phase: 'tell', timer: 0, tell: 'sweep', attackId: 1 }];
  step(s);
  assert.equal(s.player.hp, 10); assert.equal(s.phase, 'playing');
  assert.equal(s.kills, 1); assert.equal(s.enemies.length, 0);
  assert.ok(s.events.some(e => e.type === 'kill')); assert.ok(!s.events.some(e => e.type === 'hurt'));
  assert.equal(s.room.cleared, true); assert.equal(s.score, 175);
});
