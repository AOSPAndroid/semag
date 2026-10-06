import assert from 'node:assert/strict';
import test from 'node:test';
import { createState, startMatch, step, emptyInput, TICK_RATE, chooseBoon } from '../public/topdown-engine.js';

const gap = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function blocked(state, a, b, padding = 14.9) {
  return state.obstacles.some(rect => {
    let low = 0, high = 1;
    for (const [origin, delta, min, max] of [[a.x, b.x - a.x, rect.x - padding, rect.x + rect.w + padding], [a.y, b.y - a.y, rect.y - padding, rect.y + rect.h + padding]]) {
      if (Math.abs(delta) < 1e-8) { if (origin < min || origin > max) return false; }
      else { let first = (min - origin) / delta, last = (max - origin) / delta; if (first > last) [first, last] = [last, first]; low = Math.max(low, first); high = Math.min(high, last); if (low > high) return false; }
    }
    return true;
  });
}

// This navigator reads the room geometry and produces ordinary digital movement.
// It cannot teleport, grant resources, change enemy AI, or choose boons directly.
function waypoint(state, start, goal) {
  if (!blocked(state, start, goal)) return goal;
  const points = [start, goal];
  for (const rect of state.obstacles) for (const x of [rect.x - 22, rect.x + rect.w + 22]) for (const y of [rect.y - 22, rect.y + rect.h + 22]) points.push({ x, y });
  const costs = points.map(() => Infinity), previous = points.map(() => -1), done = new Set(); costs[0] = 0;
  for (let count = 0; count < points.length; count++) {
    let current = -1;
    for (let i = 0; i < points.length; i++) if (!done.has(i) && (current < 0 || costs[i] < costs[current])) current = i;
    if (current < 0 || !Number.isFinite(costs[current])) break;
    if (current === 1) break;
    done.add(current);
    for (let next = 1; next < points.length; next++) {
      if (done.has(next) || blocked(state, points[current], points[next])) continue;
      const cost = costs[current] + gap(points[current], points[next]);
      if (cost < costs[next]) { costs[next] = cost; previous[next] = current; }
    }
  }
  if (previous[1] < 0) return goal;
  let node = 1; while (previous[node] > 0) node = previous[node];
  return points[node];
}
function steer(controls, dx, dy) {
  if (Math.hypot(dx, dy) < 3) return;
  const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * Math.PI / 4;
  controls.right = Math.cos(angle) > .3; controls.left = Math.cos(angle) < -.3;
  controls.down = Math.sin(angle) > .3; controls.up = Math.sin(angle) < -.3;
}

function controller() {
  const routes = new Map(), lastAttacks = [-100, -100];
  return (state, f) => {
    const buttons = emptyInput();
    if (f.downed || state.phase !== 'fight') return buttons;
    const alive = state.enemies.filter(enemy => enemy.hp > 0);
    if (state.roomBreak) {
      if (state.boonSelections[f.id]) return buttons;
      const choice = state.shrineChoices.find(c => c.id === (state.wave % 2 ? 'ward' : 'leech')) || state.shrineChoices[0];
      const target = waypoint(state, f, choice);
      if (gap(f, choice) < 45) buttons.block = true;
      else steer(buttons, target.x - f.x, target.y - f.y);
      return buttons;
    }
    if (!alive.length) return buttons;
    const ally = state.fighters[1 - f.id];
    if (ally.downed && gap(f, ally) < 58 && alive.every(enemy => gap(f, enemy) > 120)) { buttons.block = true; return buttons; }
    const enemy = [...alive].sort((a, b) => gap(f, a) - gap(f, b))[0];
    const distance = gap(f, enemy);
    // Late projectile windups demand strafing instead of another greedy swing.
    const volley = alive.find(e => e.action === 'windup' && ['burst', 'fan', 'crown'].includes(e.attackKind) && gap(f,e)<340 && e.actionFrame>e.windupTicks-35);
    if (volley) {
      steer(buttons,-(f.y-volley.y),f.x-volley.x);
      if (f.stamina>32 && !f.previousInput.roll && volley.actionFrame>volley.windupTicks-8) buttons.roll=true;
      return buttons;
    }
    const threat = alive.find(e => ['windup', 'attack'].includes(e.action) && !['burst', 'fan', 'crown'].includes(e.attackKind) && gap(f, e) < e.reach + 65);
    if (threat && (threat.action === 'attack' || threat.actionFrame > threat.windupTicks - 28)) {
      if (threat.attackKind !== 'slam' && threat.attackKind !== 'charge' && (threat.action === 'attack' || threat.actionFrame >= threat.windupTicks - 4) && f.action !== 'attack') {
        steer(buttons, threat.x - f.x, threat.y - f.y); buttons.block = true; return buttons;
      }
      steer(buttons, f.x - threat.x, f.y - threat.y);
      if (f.stamina > 32 && !f.previousInput.roll && (threat.action === 'attack' || threat.actionFrame >= threat.windupTicks - 8)) buttons.roll = true;
      return buttons;
    }
    const danger = state.hazards.find(h => h.kind === 'fire' && (h.active || h.warning) && gap(f, h) < h.radius + 40);
    if (danger) { steer(buttons, f.x - danger.x, f.y - danger.y); return buttons; }
    const projectile = state.projectiles.find(p => p.team === 'enemies' && gap(f, p) < 65);
    if (projectile && f.stamina > 36 && !f.previousInput.roll && f.action !== 'attack') {
      steer(buttons, -projectile.vy, projectile.vx); buttons.roll = true; return buttons;
    }
    if (f.stamina < 12 && f.action !== 'attack') { steer(buttons, f.x - enemy.x, f.y - enemy.y); return buttons; }
    let route = routes.get(f.id);
    if (!route || route.wave !== state.wave || route.enemy !== enemy.id || state.tick - route.tick > 12 || gap(f, route.target) < 12) {
      route = { wave: state.wave, enemy: enemy.id, tick: state.tick, target: waypoint(state, f, enemy) }; routes.set(f.id, route);
    }
    if (distance > 57 || blocked(state, f, enemy, 2)) steer(buttons, route.target.x - f.x, route.target.y - f.y);
    else steer(buttons, enemy.x - f.x, enemy.y - f.y);
    if (distance < 87 && !blocked(state, f, enemy, 2) && state.tick - lastAttacks[f.id] >= 66 && f.stamina >= 10 && !['attack', 'roll'].includes(f.action) && f.stun === 0) {
      buttons.attack = true; lastAttacks[f.id] = state.tick;
    } else if (distance > 160 && distance < 320 && !blocked(state, f, enemy, 5) && state.tick - lastAttacks[f.id] >= 90 && f.stamina > 40 && !['attack', 'roll'].includes(f.action) && f.stun === 0) {
      buttons.shoot = true; lastAttacks[f.id] = state.tick;
    }
    return buttons;
  };
}

test('two heroes complete all nine Dungeon rooms and choose all sixteen boons using normal inputs', t => {
  const state = createState('coop'), play = controller(), rooms = new Set(), guardians = new Set(), chosen = [], seen = new Set(), actions = new Set();
  startMatch(state);
  for (let tick = 0; tick < TICK_RATE * 900 && state.phase !== 'matchEnd'; tick++) {
    step(state, state.fighters.map(f => play(state, f)));
    if (state.wave) rooms.add(state.wave);
    for (const event of state.events) if (!seen.has(event.id)) {
      seen.add(event.id);
      if (event.type === 'boon') chosen.push(event);
      if (event.type === 'enemyDeath' && event.enemyType === 'boss') guardians.add(state.wave);
      actions.add(event.type);
    }
  }
  assert.equal(state.result, 'victory', `expedition ended ${state.phase}/${state.result} in room ${state.wave}; heroes ${state.fighters.map(f => `${f.hp}hp ${f.stamina}stamina at ${Math.round(f.x)},${Math.round(f.y)}`).join(' / ')}; foes ${state.enemies.filter(e=>e.hp>0).map(e=>`${e.type}:${e.hp}`).join(', ')}`);
  assert.deepEqual([...rooms], [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual([...guardians], [3, 6, 9]);
  assert.equal(chosen.length, 16);
  assert.deepEqual(state.fighters.map(f => Object.values(f.boons).reduce((sum, count) => sum + count, 0)), [8, 8]);
  for (const action of ['swing', 'shoot', 'roll', 'parry']) assert.ok(actions.has(action), `the legal run exercises ${action}`);
  assert.ok(state.tick < TICK_RATE * 900, 'the run completes within its test budget');
  t.diagnostic(`Nine rooms cleared in ${(state.elapsedTicks / TICK_RATE).toFixed(1)} seconds of simulated play; heroes finish with ${state.fighters.map(f => `${f.hp.toFixed(1)}/${f.maxHp} health`).join(' and ')}.`);
});

// Build a valid boss actor through room progression, then inspect each variant's
// attack setup in a controlled geometry fixture. This is a rules regression;
// the earlier expedition test independently proves the complete legal run.
test('boss warning geometry follows its final biome pattern without stale slam fields', () => {
  const state = createState('coop'); startMatch(state);
  for (let n=0;n<TICK_RATE*3;n++) step(state);
  for (let room=1;room<3;room++) {
    for (const enemy of state.enemies) enemy.hp=0;
    step(state); chooseBoon(state,0,state.shrineChoices[0].id); chooseBoon(state,1,state.shrineChoices[0].id);
    for (let n=0;n<TICK_RATE*3;n++) step(state);
  }
  const boss = structuredClone(state.enemies.find(e => e.type === 'boss'));
  const expected = { garden: ['slam','melee','burst'], crypt: ['fan','slam','burst'], ember: ['charge','slam','crown'] };
  for (const [variant,patterns] of Object.entries(expected)) for (let index=0;index<3;index++) {
    const s=structuredClone(state); s.obstacles=[]; s.hazards=[];
    s.fighters[0].x=480;s.fighters[0].y=300;s.fighters[1].x=100;s.fighters[1].y=500;
    const enemy={...structuredClone(boss),variant,x:480,y:210,action:'idle',actionFrame:0,cooldown:0,stun:0,attackId:index,
      telegraphRadius:128,telegraphLength:270,telegraphHalfArc:1.25}; s.enemies=[enemy]; step(s);
    const kind=patterns[index]; assert.equal(enemy.action,'windup');assert.equal(enemy.attackKind,kind);
    assert.equal(enemy.telegraphRadius,kind==='slam'?128:0);
    assert.equal(enemy.reach,kind==='slam'?128:kind==='charge'?64:kind==='fan'?300:112);
    assert.equal(enemy.windupTicks,['fan','charge','crown'].includes(kind)?90:kind==='burst'?84:72);
    assert.equal(enemy.activeTicks,kind==='charge'?38:18);
    assert.ok(Math.abs(enemy.telegraphLength-(kind==='charge'?269.2:0))<1e-9);
    assert.equal(enemy.telegraphHalfArc,kind==='fan'?.4:.95);
  }
});

test('a large guardian detours to a smaller hero hugging the far side of cover', () => {
  const s=createState('coop');startMatch(s);for(let n=0;n<TICK_RATE*3;n++)step(s);
  for(let room=1;room<3;room++){for(const e of s.enemies)e.hp=0;step(s);chooseBoon(s,0,s.shrineChoices[0].id);chooseBoon(s,1,s.shrineChoices[0].id);for(let n=0;n<TICK_RATE*3;n++)step(s);}
  const boss=s.enemies.find(e=>e.type==='boss');s.enemies=[boss];boss.x=180;boss.y=300;boss.cooldown=0;
  s.fighters[0].x=313;s.fighters[0].y=300;s.fighters[1].x=100;s.fighters[1].y=500;
  for(let n=0;n<1200&&s.phase==='fight';n++)step(s);
  assert.ok(boss.attackId>0,'guardian finds a clear attack route instead of pushing the pillar forever');
  assert.ok(boss.x>298||boss.y<244-boss.radius||boss.y>340+boss.radius,'guardian traverses a reachable side');
});
