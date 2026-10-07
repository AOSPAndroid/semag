import test from 'node:test';
import assert from 'node:assert/strict';
import { BODY, DIFFICULTIES, LEVELS, TOTAL_LEVELS, FIXED_STEP, PHYSICS, createState, step, togglePause, retryStage, nextStage, gatePhase, targetAnchor, anchorVisible, sweepPolygon } from '../public/solo/skyline-engine.js';
const copy = state => JSON.parse(JSON.stringify(state));
const advance = (state, seconds, input = {}) => { for (let i = 0; i < Math.ceil(seconds / FIXED_STEP) && state.phase === 'playing'; i++) step(state, typeof input === 'function' ? input(state) : input); return state; };
function at(x, y, fields = {}, level = 0) { const s = createState(); s.level = level; s.relays = LEVELS[level].relays.map(() => false); Object.assign(s.player, { x, y, vx: 0, vy: 0, grounded: false }, fields); return s; }

// This controller only submits the same buttons a player can press. Its release
// preview uses copied public states with normal step calls; the live campaign
// never receives fixture changes, invulnerability, teleports or extra batteries.
function skilledCourier(state) {
  let hold = 0, releaseMode = null;
  const forecast = current => {
    for (const mode of [1, 0, -1]) {
      const candidate = copy(current); candidate.events = [];
      for (let tick = 0; tick < 180; tick++) {
        step(candidate, { right: mode === 1, left: mode === -1 });
        if (candidate.phase !== 'playing') break;
        if (candidate.player.grounded) {
          const destination = LEVELS[candidate.level].platforms.find(r => r.x > current.hook.x);
          if (destination && candidate.player.x > destination.x + 12 && candidate.player.x < destination.x + destination.width - 12) return mode;
          break;
        }
      }
    }
    return null;
  };
  return {
    reset() { hold = 0; releaseMode = null; },
    input() {
      const p = state.player, level = LEVELS[state.level], missing = state.relays.findIndex(v => !v), target = missing >= 0 ? level.relays[missing][0] : level.goal[0];
      const direction = Math.sign(target - p.x), roof = level.platforms.find(r => p.x >= r.x - 8 && p.x <= r.x + r.width + 8 && Math.abs(p.y + 14 - r.y) < 3);
      const input = { right: direction > 0, left: direction < 0, jump: hold-- > 0, hook: false };
      if (p.grounded && Math.abs(p.vx) > 295) { input.right = p.vx < 0; input.left = p.vx > 0; }
      if (Math.abs(target - p.x) < 20) { input.right = p.vx < -15; input.left = p.vx > 15; }
      if (roof && p.grounded) {
        const end = direction > 0 ? roof.x + roof.width : roof.x;
        const spike = level.spikes.some(s => direction > 0 ? s.x > p.x && s.x - p.x < 90 : s.x + s.width < p.x && p.x - s.x - s.width < 90);
        const gap = direction > 0 ? end - p.x < 55 && target > end : p.x - end < 55 && target < end;
        const obstacle = level.platforms.some(r => r.x > p.x && r.x - p.x < 80 && r.y < roof.y && r.x < end);
        if ((gap || spike || obstacle) && hold < 0) { hold = 60; input.jump = true; }
      }
      if (!p.grounded) {
        const anchor = level.anchors.find(a => a.x > p.x - 150 && a.x < p.x + 400), destination = level.platforms.find(r => r.x > p.x - 160 && r.x > 160);
        if (anchor && (!destination || p.x < destination.x - 10) && p.x > 180) { input.hook = true; input.aimX = anchor.x; input.aimY = anchor.y; }
      }
      if (!p.grounded && p.x > 880 && p.vx > 300) { input.left = true; input.right = false; }
      if (state.hook) {
        const release = forecast(state);
        if (release === null) { input.hook = true; input.aimX = state.hook.x; input.aimY = state.hook.y; input.up = true; }
        else { input.hook = false; input.left = release === -1; input.right = release === 1; releaseMode = release; }
      } else if (releaseMode !== null && !p.grounded) { input.hook = false; input.left = releaseMode === -1; input.right = releaseMode === 1; }
      else if (p.grounded) releaseMode = null;
      for (const g of level.gates) if (direction > 0 && g.x - p.x > 12 && g.x - p.x < 60 && p.y + 14 > g.top && gatePhase(g, state.levelElapsed, state.difficulty) !== 'off') { input.right = p.vx < -5; input.left = p.vx > 5; }
      return input;
    },
  };
}
function campaign(difficulty) {
  const state = createState({ difficulty }), courier = skilledCourier(state); let transitions = 0, hookCount = 0, eventId = 0;
  for (let tick = 0; tick < 120 * 240 && !['won', 'lost'].includes(state.phase); tick++) {
    if (state.phase === 'stage-clear') { assert.equal(state.relays.filter(Boolean).length, 2); assert.ok(nextStage(state)); courier.reset(); transitions++; }
    assert.notEqual(state.phase, 'dead', `The skilled courier missed stage ${state.level + 1}: ${state.reason}`);
    step(state, courier.input());
    for (const event of state.events) if (event.id > eventId) { eventId = event.id; if (event.type === 'attach') hookCount++; }
  }
  return { state, transitions, hookCount };
}

test('Veteran is the default and all campaign record scopes stay independent', () => {
  assert.equal(createState().difficulty, 'veteran'); assert.equal(TOTAL_LEVELS, 12);
  for (const [tier, info] of Object.entries(DIFFICULTIES)) { const s = createState({ difficulty: tier }); assert.equal(s.recordKey, `${tier}-campaign-v1`); assert.equal(s.lives, info.lives); assert.equal(s.phase, 'playing'); }
  assert.equal(createState({ difficulty: 'unknown' }).difficulty, 'veteran');
});
test('twelve routes include anchor chaining, a vertical ascent and a station canopy choice', () => {
  assert.equal(new Set(LEVELS.map(l => l.name)).size, 12); assert.equal(new Set(LEVELS.map(l => l.district)).size, 3);
  assert.equal(LEVELS[6].anchors.length, 3); assert.equal(LEVELS[6].platforms.filter(r => r.kind === 'ledge').length, 2);
  assert.deepEqual(LEVELS[9].platforms.map(p => p.y), [430, 365, 285, 325]);
  assert.ok(LEVELS[10].platforms.some(p => p.kind === 'ledge' && p.y < 320));
});
for (const difficulty of Object.keys(DIFFICULTIES)) test(`normal movement, jumps, visible hooks and timed releases complete all twelve ${difficulty} stages`, () => {
  const { state, transitions, hookCount } = campaign(difficulty);
  assert.equal(state.phase, 'won'); assert.equal(state.cleared, 12); assert.equal(transitions, 11); assert.equal(state.levelTimes.length, 12);
  assert.equal(state.deaths, 0); assert.equal(state.lives, DIFFICULTIES[difficulty].lives); assert.ok(hookCount >= 20); assert.ok(state.elapsed > 35 && state.elapsed < 100);
  const time = state.elapsed; advance(state, 10, { right: true, jump: true, hook: true }); assert.equal(state.elapsed, time);
});
test('holding only Right cannot auto-complete a stage or survive the first gap', () => { const s = createState(); advance(s, 8, { right: true }); assert.equal(s.phase, 'dead'); assert.equal(s.cleared, 0); assert.equal(s.lives, 11); });
test('idling loses a finite campaign battery to the active stage clock', () => { const s = createState({ difficulty: 'nightmare' }); advance(s, 49); assert.equal(s.phase, 'dead'); assert.equal(s.reason, 'Delivery clock expired'); assert.equal(s.lives, 4); });
test('pauses freeze motion, campaign and delivery clocks and block progression', () => { const s = createState(); advance(s, .2, { right: true }); togglePause(s); const before = copy(s); advance(s, 8, { right: true, jump: true, hook: true }); assert.deepEqual(s, before); assert.equal(nextStage(s), false); assert.equal(retryStage(s), false); togglePause(s); assert.equal(s.phase, 'playing'); });
test('a death spends one battery once; retry resets chips and stage but retains campaign time', () => { const s = createState(); advance(s, 2, { right: true }); assert.equal(s.phase, 'dead'); const elapsed = s.elapsed; const lives = s.lives; advance(s, 30); assert.equal(s.lives, lives); assert.ok(retryStage(s)); assert.equal(s.lives, lives); assert.equal(s.elapsed, elapsed); assert.equal(s.levelElapsed, 0); assert.deepEqual(s.relays, [false, false]); assert.equal(retryStage(s), false); });
test('Nightmare cannot refill lives through repeated retries or advance an unfinished stage', () => { const s = createState({ difficulty: 'nightmare' }); for (let death = 0; death < 5; death++) { advance(s, 2, { right: true }); assert.equal(s.lives, 4 - death); if (death < 4) assert.ok(retryStage(s)); } assert.equal(s.phase, 'lost'); assert.equal(retryStage(s), false); assert.equal(nextStage(s), false); });
test('the receiver stays locked until both route chips have been collected', () => { const s = at(1080, 386, { grounded: true }); advance(s, .2); assert.equal(s.phase, 'playing'); s.relays = [true, false]; advance(s, .2); assert.equal(s.phase, 'playing'); s.relays = [true, true]; step(s); assert.equal(s.phase, 'stage-clear'); assert.equal(s.cleared, 1); });
test('continue is explicit and carries resources into the next rooftop', () => { const s = at(1080, 386, { grounded: true }); s.relays = [true, true]; s.lives = 7; step(s); const elapsed = s.elapsed; advance(s, 20, { right: true }); assert.equal(s.level, 0); assert.equal(s.elapsed, elapsed); assert.ok(nextStage(s)); assert.equal(s.level, 1); assert.equal(s.lives, 7); assert.deepEqual(s.relays, [false, false]); });
test('a held jump has one launch; it cannot bounce automatically on landing', () => { const s = createState(); advance(s, 2, { jump: true }); assert.equal(s.events.filter(e => e.type === 'jump').length, 1); assert.equal(s.player.grounded, true); step(s, { jump: false }); step(s, { jump: true }); assert.equal(s.events.filter(e => e.type === 'jump').length, 2); });
test('releasing Jump cuts upward speed for precise short hops', () => { const full = createState(), short = createState(); advance(full, .15, { jump: true }); advance(short, .15, { jump: true }); step(full, { jump: true }); step(short, {}); assert.ok(short.player.vy > full.player.vy + 60); advance(full, .3, { jump: true }); advance(short, .3); assert.ok(short.player.y > full.player.y + 20); });
test('coyote time accepts a fresh jump immediately after leaving a roof', () => { const s = at(246, 416, { vx: 290, grounded: false }); s.coyote = .075; step(s, { right: true, jump: true }); assert.ok(s.player.vy < -450); assert.equal(s.events.at(-1).type, 'jump'); });
test('a buffered press just before landing launches on the next fixed step', () => { const s = at(70, 399, { vy: 480 }); s.coyote = 0; step(s, { jump: true }); assert.ok(s.jumpBuffer > 0); advance(s, .05, { jump: true }); assert.ok(s.events.some(e => e.type === 'jump')); assert.ok(s.player.vy < 0); });
test('solid roof faces catch fast landings and wall impacts without penetration', () => { const s = at(450, 250, { vy: 1600 }); advance(s, .2); assert.equal(s.player.y, 416); assert.equal(s.player.grounded, true); const wall = at(370, 500, { vx: 800 }); advance(wall, .1, { right: true }); assert.ok(wall.player.x <= 402 + 1e-7); assert.equal(wall.player.vx, 0); });
test('solid contact permits parallel motion and retreat instead of pinning the courier', () => { const s = at(402, 470, { grounded: false }); step(s, { left: true }); assert.ok(s.player.x < 402); assert.ok(s.player.y > 470); });
test('a fast spike crossing hits in the swept path rather than tunneling between endpoints', () => { const s = at(492, 405, { vx: 5000 }); s.coyote = 0; step(s); assert.equal(s.phase, 'dead'); assert.equal(s.reason, 'Spike contact'); assert.ok(s.player.x < 520); });
test('spike triangle corners stay clear where a rectangle-only collision would report a hit', () => { const triangle = [[1, 14], [8, 0], [15, 14]]; assert.equal(sweepPolygon(1, 1, 0, 0, 1, 1, triangle), null); assert.equal(sweepPolygon(8, -3, 0, 8, 1, 1, triangle).time, .25); });
test('spike contact uses the first hazard point and consumes only one campaign battery', () => { const s = at(512, 405, { vx: 600 }); advance(s, .05, { right: true }); assert.equal(s.phase, 'dead'); const lives = s.lives; advance(s, 1, { right: true }); assert.equal(s.lives, lives); assert.equal(s.events.filter(e => e.type === 'impact').length, 1); });
test('an off security gate can be crossed; an active gate hits the actual beam envelope', () => { const s = at(600, 406, { vx: 290, grounded: true }, 3); s.levelElapsed = 2; advance(s, .1, { right: true }); assert.equal(s.phase, 'playing'); assert.ok(s.player.x > 625); const hit = at(600, 406, { vx: 290, grounded: true }, 3); hit.levelElapsed = 0; advance(hit, .1, { right: true }); assert.equal(hit.phase, 'dead'); assert.equal(hit.reason, 'Security beam'); });
test('security cycles remain deterministic and warning bars never deal damage', () => { const gate = LEVELS[3].gates[0]; assert.equal(gatePhase(gate, 0), 'active'); assert.equal(gatePhase(gate, 2), 'off'); assert.equal(gatePhase(gate, gate.period - gate.offset + .1), 'warning'); const s = at(602, 406, { vx: 290, grounded: true }, 3); s.levelElapsed = gate.period - gate.offset + .1; advance(s, .1, { right: true }); assert.equal(s.phase, 'playing'); });
test('a hook targets a visible in-range anchor and aim can select another anchor', () => { const s = at(430, 280); const chosen = targetAnchor(s, { aimX: 744, aimY: 175 }); assert.equal(chosen.index, 1); step(s, { hook: true, aimX: 744, aimY: 175 }); assert.equal(s.hook.index, 1); assert.ok(s.hook.length <= 365); });
test('an out-of-range anchor and a roof-hidden anchor cannot catch a rope', () => { const s = at(402, 470); assert.equal(anchorVisible(s, LEVELS[0].anchors[1]), false); assert.notEqual(targetAnchor(s, { aimX: 744, aimY: 175 })?.index, 1); const far = at(8, 100); assert.equal(targetAnchor(far, { aimX: 744, aimY: 175 })?.index === 1, false); });
test('releasing Hook preserves tangential swing velocity rather than resetting momentum', () => { const s = at(370, 230, { vx: 320, vy: -80 }); s.hook = { index: 0, x: 315, y: 195, length: 100 }; step(s); assert.equal(s.hook, null); assert.ok(s.player.vx > 310); assert.ok(s.player.vy < -60); assert.equal(s.events.at(-1).type, 'release'); });
test('reeling changes rope length within the finite hook spool limits', () => { const s = at(330, 270); step(s, { hook: true, aimX: 315, aimY: 195 }); const length = s.hook.length; advance(s, .1, { hook: true, up: true }); assert.ok(s.hook.length < length); advance(s, 1, { hook: true, up: true }); assert.ok(s.hook.length >= 65); });
test('a slack attached rope snaps as soon as a chimney occludes its actual line', () => { const s = at(621, 300, { vy: 420 }, 2); s.hook = { index: 0, x: 334, y: 155, length: 365 }; assert.equal(anchorVisible(s, s.hook), true); for (let i = 0; i < 10; i++) step(s, { hook: true }); assert.ok(s.events.some(e => e.type === 'snap')); assert.notEqual(s.hook?.index, 0); });
test('a taut rope constraint cannot pull the courier through a solid roof', () => { const s = at(402, 470, { vx: 100 }); s.hook = { index: 1, x: 744, y: 175, length: 100 }; step(s, { hook: true }); assert.ok(s.player.x <= 402 + 1e-7); assert.equal(s.hook, null); });
test('bad delta values are harmless and a hitch uses collision-safe fixed substeps', () => { const s = createState(), before = copy(s); for (const dt of [0, -1, NaN, Infinity]) step(s, { right: true }, dt); assert.deepEqual(s, before); const fast = at(492, 405, { vx: 5000 }); step(fast, {}, .5); assert.equal(fast.phase, 'dead'); });
test('events remain bounded through a long practiced traversal', () => { const s = createState(); for (let i = 0; i < 30; i++) { advance(s, 1, { jump: true }); step(s, {}); } assert.ok(s.events.length <= 24); assert.ok(Number.isFinite(s.player.x) && Number.isFinite(s.player.y)); });

test('a beam that activates after the courier has fully cleared cannot report a late false hit', () => { const s = at(600, 406, { vx: 4000, grounded: true }, 3); s.levelElapsed = 3.013; step(s, { right: true }); assert.equal(gatePhase(LEVELS[3].gates[0], s.levelElapsed), 'active'); assert.equal(s.phase, 'playing'); assert.ok(s.player.x > 630); });
test('a beam activation catches a courier whose swept body is still crossing at that instant', () => { const s = at(570, 406, { vx: 5000, grounded: true }, 3); s.levelElapsed = 3.013; step(s); assert.equal(s.phase, 'dead'); assert.equal(s.reason, 'Security beam'); });
test('a beam deactivation cannot erase a real contact earlier in the same fixed step', () => { const s = at(570, 406, { vx: 5000, grounded: true }, 3); s.levelElapsed = .393; step(s, { right: true }); assert.equal(s.phase, 'dead'); assert.equal(s.reason, 'Security beam'); });
test('a body that reaches a beam after deactivation passes safely, even while its endpoint overlaps', () => { const s = at(570, 406, { vx: 4000, grounded: true }, 3); s.levelElapsed = .393; step(s, { right: true }); assert.equal(s.phase, 'playing'); assert.ok(s.player.x > 602 && s.player.x < 613); assert.equal(gatePhase(LEVELS[3].gates[0], s.levelElapsed), 'off'); });
