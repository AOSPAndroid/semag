import assert from 'node:assert/strict';
import test from 'node:test';
import { createEndPresentation, END_PRESENTATION_RULES } from '../public/voxel-end-presentation.js';
import { createRoyaleRewardPresenter, createRoyaleRewardAudio, royaleBattleResult, ROYALE_REWARD_RULES } from '../public/voxel-royale-reward.js';
import { createResultActionGate } from '../public/practice-result-actions.js';

function presentation({ won = true, reducedMotion = false } = {}) {
  const death = createEndPresentation(), reward = createRoyaleRewardPresenter();
  const options = { contextKey: 'forest:7', won, reducedMotion };
  const observe = (phase, now, extra = {}) => reward.observe(phase, now, { ...options, ...extra, death: death.observe(phase, now, { ...options, ...extra }) });
  observe('fight', 0);
  return { observe, reward };
}

test('a real win presents final death before the crown, then results, without repeated celebrations', () => {
  const { observe } = presentation();
  assert.equal(observe('matchEnd', 100).stage, 'death');
  assert.equal(observe('matchEnd', 1199).stage, 'death');
  const crown = observe('matchEnd', 1200);
  assert.equal(crown.stage, 'victory'); assert.equal(crown.started, true); assert.equal(crown.remainingMs, ROYALE_REWARD_RULES.victoryMs);
  assert.equal(observe('matchEnd', 1200).started, false);
  assert.equal(observe('matchEnd', 3049).stage, 'victory');
  assert.equal(observe('matchEnd', 3050).stage, 'results');
  assert.equal(observe('matchEnd', 9000).holding, false);
});

test('a loss keeps the final death animation and reaches results with no crown', () => {
  const { observe } = presentation({ won: false });
  assert.equal(observe('matchEnd', 100).stage, 'death');
  assert.equal(observe('matchEnd', 1199).visible, false);
  assert.equal(observe('matchEnd', 1200).stage, 'results');
  assert.equal(observe('matchEnd', 1600).started, false);
});

test('reduced motion uses fixed shorter beats and refresh rates do not alter the accepted match', () => {
  const accepted = Object.freeze({ phase: 'matchEnd', tick: 2300, hp: 24, result: 'won' });
  for (const reducedMotion of [false, true]) for (const hz of [30, 60, 144, 240]) {
    const { observe } = presentation({ reducedMotion });
    const deathMs = reducedMotion ? END_PRESENTATION_RULES.reducedDurationMs : END_PRESENTATION_RULES.durationMs;
    const victoryMs = reducedMotion ? ROYALE_REWARD_RULES.reducedVictoryMs : ROYALE_REWARD_RULES.victoryMs;
    observe(accepted.phase, 100);
    for (let frame = 1; frame * 1000 / hz < deathMs + victoryMs; frame++) observe(accepted.phase, 100 + frame * 1000 / hz);
    assert.equal(observe(accepted.phase, 100 + deathMs + victoryMs).stage, 'results');
    assert.deepEqual(accepted, { phase: 'matchEnd', tick: 2300, hp: 24, result: 'won' });
  }
  const { observe } = presentation({ reducedMotion: true }); observe('matchEnd', 100);
  assert.equal(observe('matchEnd', 500, { reducedMotion: false }).remainingMs, 650, 'a preference change cannot extend the accepted deadline');
});

test('background, replay, a new context and malformed clocks cannot replay historical victory', () => {
  for (const cancel of [{ eligible: false }, { contextKey: 'maze:8' }]) {
    const { observe } = presentation(); observe('matchEnd', 100); observe('matchEnd', 1200);
    assert.equal(observe('matchEnd', 1300, cancel).stage, 'results');
    assert.equal(observe('matchEnd', 1400, cancel).started, false);
  }
  const { observe, reward } = presentation(); observe('matchEnd', 100);
  assert.equal(observe('matchEnd', NaN).stage, 'results');
  assert.equal(observe('matchEnd', 1400).stage, 'results');
  observe('fight', 1500); assert.equal(observe('matchEnd', 1600).stage, 'death');
  reward.reset(); assert.equal(reward.observe('matchEnd', 1700, { won: true }).stage, 'results');
  const background = presentation(); background.observe('matchEnd', 100);
  assert.equal(background.observe('matchEnd', 500, { eligible: false }).stage, 'results', 'backgrounding during the final death cancels the pending crown');
  assert.equal(background.observe('matchEnd', 1200).stage, 'results', 'returning after death cannot manufacture a delayed fanfare');
});

test('authoritative ranks distinguish a winner, runner-up and early elimination without awarding other bots kills', () => {
  const state = Object.freeze({ practice: Object.freeze({ config: Object.freeze({ bots: 10 }) }), placements: Object.freeze([Object.freeze({ playerId: 0, place: 7 })]) });
  const stats = Object.freeze({ result: 'lost', botsRemaining: 6, kills: 1 });
  const result = royaleBattleResult(state, stats);
  assert.equal(result.place, 7); assert.equal(result.total, 11); assert.equal(result.outlasted, 4); assert.equal(result.won, false);
  assert.equal(stats.kills, 1);
  assert.equal(royaleBattleResult(state, { result: 'won', botsRemaining: 0 }).place, 1);
  assert.equal(royaleBattleResult({ practice: { config: { bots: 1 } }, placements: [{ playerId: 0, place: 2 }] }, { result: 'lost', botsRemaining: 1 }).label, 'RUNNER-UP');
});

test('the finishing fire hold remains fenced through both cosmetic beats and the results cooldown', () => {
  const { observe } = presentation(), gate = createResultActionGate();
  gate.press('mouse:0', 90); observe('matchEnd', 100); observe('matchEnd', 1200);
  assert.equal(observe('matchEnd', 3050).stage, 'results'); gate.begin(3050);
  assert.equal(gate.isReady(5000), false);
  gate.release('mouse:0', 5000); assert.equal(gate.isReady(5249), false); assert.equal(gate.isReady(5250), true);
});

function fakeAudio() {
  const oscillators = [];
  const param = () => ({ setValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = () => ({ connect() {}, disconnect() { this.disconnected = true; } });
  return { enabled: true, master: {}, oscillators, context: { state: 'running', currentTime: 4, createGain: () => ({ ...node(), gain: param() }), createOscillator: () => { const oscillator = { ...node(), frequency: param(), start() {}, stop() { this.stopped = true; } }; oscillators.push(oscillator); return oscillator; } } };
}

test('the winner chime is bounded, plays once and cancels every scheduled voice on mute or departure', () => {
  const audio = fakeAudio(), presenter = createRoyaleRewardAudio(audio), view = { stage: 'victory', started: true };
  assert.equal(presenter.observe(view), true); assert.equal(presenter.inspect().activeVoices, 6);
  assert.equal(presenter.observe(view), false); assert.equal(audio.oscillators.length, 6);
  audio.enabled = false; presenter.observe({ stage: 'victory', started: false });
  assert.equal(presenter.inspect().activeVoices, 0); assert.ok(audio.oscillators.every(voice => voice.stopped && voice.disconnected));
  audio.enabled = true; assert.equal(presenter.observe({ stage: 'victory', started: false }), false);
  presenter.reset(); assert.equal(presenter.observe(view), true); presenter.observe({ stage: 'results' });
  assert.equal(presenter.inspect().activeVoices, 0); assert.equal(presenter.inspect().played, 2);
});

test('muted wins, losses and background finishes never produce delayed fanfare when sound returns', () => {
  const audio = fakeAudio(), presenter = createRoyaleRewardAudio(audio);
  audio.enabled = false; assert.equal(presenter.observe({ stage: 'victory', started: true }), false);
  audio.enabled = true; assert.equal(presenter.observe({ stage: 'victory', started: false }), false);
  presenter.reset(); assert.equal(presenter.observe({ stage: 'victory', started: true }, { eligible: false }), false);
  assert.equal(presenter.observe({ stage: 'results', started: false }), false);
  assert.equal(audio.oscillators.length, 0);
});
