import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createState,
  step,
  togglePause,
  resetCar,
  nearestTrack,
  trackInfo,
  TRACKS,
  getTrack,
  advanceStage,
  recordScope,
  medalForTime,
  WORLD,
  TRACK,
  TRACK_LENGTH,
  GATES,
  ROAD_WIDTH,
  MAX_SPEED,
  LAPS,
  FIXED_DT,
  RESET_PENALTY,
  DIFFICULTIES,
  getDifficulty,
  raceTargets,
} from '../public/solo/circuit-engine.js';

const clone = (value) => JSON.parse(JSON.stringify(value));
const near = (actual, expected, tolerance = 1e-6) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ~= ${expected}`);
const angle = (value) => Math.atan2(Math.sin(value), Math.cos(value));
const active = () => {
  const state = createState();
  state.startDelay = 0;
  return state;
};
const ticks = (state, count, controls = {}) => {
  for (let i = 0; i < count; i += 1) step(state, controls);
};

function fixtureAtGate(index, { reverse = false, offset = 0, travel = TRACK_LENGTH / GATES.length } = {}) {
  const state = active(),
    gate = GATES[index],
    direction = reverse ? -1 : 1;
  state.nextGate = index;
  Object.assign(state.car, {
    x: gate.x - gate.tx * 0.3 * direction + gate.nx * offset,
    y: gate.y - gate.ty * 0.3 * direction + gate.ny * offset,
    vx: gate.tx * 100 * direction,
    vy: gate.ty * 100 * direction,
    heading: Math.atan2(gate.ty, gate.tx),
    speed: 100 * direction,
  });
  state.course.previous = { x: state.car.x, y: state.car.y };
  state.course.lastS = nearestTrack(state.car).s;
  state.course.travel = travel;
  return state;
}

function driver(state) {
  const car = state.car,
    speed = Math.abs(car.speed),
    projection = nearestTrack(car);
  const target = trackInfo(projection.s + Math.max(28, speed * 0.27));
  const error = angle(Math.atan2(target.y - car.y, target.x - car.x) - car.heading);
  const curve = Math.abs(angle(trackInfo(projection.s + 95).heading - trackInfo(projection.s + 25).heading));
  const desired = Math.max(75, 205 - curve * 140);
  return {
    throttle: speed < desired,
    brake: speed > desired + 10 && speed > 80,
    left: error < -0.03,
    right: error > 0.03,
  };
}

test('circuit centreline, wrapped positions, tangent gates, and starting car share one geometry', () => {
  assert.ok(TRACK.length > 300);
  assert.ok(TRACK_LENGTH > 2000 && TRACK_LENGTH < 2500);
  assert.equal(GATES.length, 12);
  for (const point of TRACK) {
    assert.ok(point.x > ROAD_WIDTH / 2 && point.x < WORLD.width - ROAD_WIDTH / 2);
    assert.ok(point.y > ROAD_WIDTH / 2 && point.y < WORLD.height - ROAD_WIDTH / 2);
    near(Math.hypot(point.tx, point.ty), 1);
    assert.ok(nearestTrack(point).distance < 1e-6);
  }
  for (const [index, gate] of GATES.entries()) {
    assert.equal(gate.index, index);
    near(gate.tx * gate.nx + gate.ty * gate.ny, 0);
    near(gate.s, (TRACK_LENGTH * index) / GATES.length);
  }
  const wrapped = trackInfo(-18),
    same = trackInfo(TRACK_LENGTH - 18);
  near(wrapped.x, same.x);
  near(wrapped.y, same.y);
  const state = createState();
  near(state.car.x, wrapped.x);
  near(state.car.y, wrapped.y);
  near(state.car.heading, wrapped.heading);
  assert.ok(
    state.car.heading > -0.1 && state.car.heading < 0.1,
    'start faces right along the bottom straight',
  );
  assert.equal(nearestTrack(NaN, 2).distance, Infinity);
});

test('fresh state is serializable and independent, with three empty timed laps', () => {
  const first = createState(),
    second = createState();
  assert.deepEqual(first, clone(first));
  assert.deepEqual(first, second);
  assert.equal(first.gameId, 'apex-circuit');
  assert.equal(first.phase, 'playing');
  assert.equal(first.lap, 1);
  assert.equal(first.lapsCompleted, 0);
  assert.equal(first.nextGate, 1);
  first.car.x += 4;
  first.lapTimes.push(1);
  assert.notEqual(first.car.x, second.car.x);
  assert.deepEqual(second.lapTimes, []);
});

test('countdown holds both car and clock; active driving begins after exactly one second', () => {
  const state = createState(),
    before = clone(state.car);
  ticks(state, 120, { throttle: true, right: true });
  assert.deepEqual(state.car, before);
  assert.equal(state.startDelay, 0);
  assert.equal(state.elapsed, 0);
  step(state, { throttle: true });
  assert.ok(state.car.speed > 0);
  near(state.elapsed, FIXED_DT);
});

test('throttle accelerates, brake sheds speed, and a held brake eventually reverses with a speed cap', () => {
  const state = active();
  ticks(state, 120, { throttle: true });
  const speed = state.car.speed;
  assert.ok(speed > 120 && speed < MAX_SPEED);
  ticks(state, 30, { brake: true });
  assert.ok(state.car.speed > 0 && state.car.speed < speed / 2);
  ticks(state, 180, { brake: true });
  near(state.car.speed, -65, 0.5);
  assert.ok(Math.hypot(state.car.vx, state.car.vy) <= MAX_SPEED);
  ticks(state, 120, { throttle: true });
  assert.ok(state.car.speed > 40, 'throttle first slows reverse, then drives forward');
});

test('steering needs movement, opposing steer keys cancel, and reverse steering changes yaw direction', () => {
  const parked = active(),
    heading = parked.car.heading;
  ticks(parked, 240, { left: true });
  near(parked.car.heading, heading);
  const neutral = active(),
    cancelled = active();
  ticks(neutral, 60, { throttle: true });
  ticks(cancelled, 60, { throttle: true, left: true, right: true });
  assert.deepEqual(cancelled, neutral);
  const forward = active(),
    reverse = active();
  for (const [state, sign] of [
    [forward, 1],
    [reverse, -1],
  ]) {
    state.car.vx = Math.cos(state.car.heading) * 60 * sign;
    state.car.vy = Math.sin(state.car.heading) * 60 * sign;
    ticks(state, 20, { left: true });
  }
  assert.ok(angle(forward.car.heading - heading) < 0);
  assert.ok(angle(reverse.car.heading - heading) > 0);
});

test('released throttle coasts and then stops without an automatic direction or stale steering input', () => {
  const state = active();
  ticks(state, 90, { throttle: true });
  const previousSpeed = state.car.speed,
    heading = state.car.heading;
  step(state, {});
  assert.ok(state.car.speed > 0 && state.car.speed < previousSpeed);
  ticks(state, 1500);
  near(state.car.speed, 0);
  near(state.car.heading, heading);
});

test('handbrake relaxes lateral grip into a stronger slide and sacrifices speed', () => {
  const grip = active(),
    drift = active();
  for (const state of [grip, drift]) {
    state.car.vx = 150 * Math.cos(state.car.heading);
    state.car.vy = 150 * Math.sin(state.car.heading);
  }
  ticks(grip, 60, { throttle: true, right: true });
  ticks(drift, 60, { throttle: true, right: true, handbrake: true });
  assert.ok(Math.abs(drift.car.slip) > Math.abs(grip.car.slip) * 1.5);
  assert.ok(drift.car.speed < grip.car.speed);
  assert.ok(angle(drift.car.heading - grip.car.heading) > 0);
});

test('grass slows the car but still permits acceleration and steering back toward the track', () => {
  const state = active();
  Object.assign(state.car, { x: 500, y: 340, vx: 140, vy: 0, heading: 0 });
  ticks(state, 120, { throttle: true });
  assert.equal(state.onRoad, false);
  assert.ok(state.car.speed > 45 && state.car.speed <= 75);
  const heading = state.car.heading;
  ticks(state, 60, { throttle: true, left: true });
  assert.ok(Math.abs(angle(state.car.heading - heading)) > 0.4);
  assert.ok(state.car.x > 500, 'grass is traversable rather than a permanent collision');
});

test('reset restores the last earned checkpoint, preserves progress, and adds a lap/race time penalty', () => {
  const state = fixtureAtGate(3);
  state.elapsed = 8;
  step(state);
  assert.equal(state.nextGate, 4);
  assert.equal(state.lastCheckpoint, 3);
  const elapsed = state.elapsed;
  state.car.x = 500;
  state.car.y = 340;
  assert.equal(togglePause(state), true);
  assert.equal(resetCar(state), true);
  assert.equal(state.phase, 'paused');
  assert.equal(state.nextGate, 4);
  assert.equal(state.gateProgress, 3);
  assert.equal(state.penalty, RESET_PENALTY);
  near(state.elapsed, elapsed + RESET_PENALTY);
  near(state.lapElapsed, state.elapsed);
  assert.equal(state.car.speed, 0);
  assert.equal(state.onRoad, true);
  assert.ok(nearestTrack(state.car).distance < 1e-6);
  near(nearestTrack(state.car).s, GATES[3].s + 12, 0.001);
  assert.equal(resetCar(createState()), false, 'countdown cannot be used to gain a rolling start');
});

test('only the expected forward gate counts: reverse, missed road, early finish and repeated finish are rejected', () => {
  const valid = fixtureAtGate(1);
  step(valid);
  assert.equal(valid.nextGate, 2);
  const backward = fixtureAtGate(1, { reverse: true });
  step(backward);
  assert.equal(backward.nextGate, 1);
  assert.equal(backward.wrongWay, true);
  const outside = fixtureAtGate(1, { offset: ROAD_WIDTH });
  step(outside);
  assert.equal(outside.nextGate, 1);
  const earlyFinish = fixtureAtGate(0);
  earlyFinish.nextGate = 1;
  step(earlyFinish);
  assert.equal(earlyFinish.lapsCompleted, 0);
  const finish = fixtureAtGate(0);
  step(finish);
  assert.equal(finish.lapsCompleted, 1);
  assert.equal(finish.nextGate, 1);
  Object.assign(finish.car, { x: GATES[0].x - 0.3 * GATES[0].tx, y: GATES[0].y - 0.3 * GATES[0].ty });
  step(finish);
  assert.equal(finish.lapsCompleted, 1, 'recrossing finish cannot farm the remaining laps');
});

test('shortcut travel and a direct teleport to the next gate do not count checkpoint progress', () => {
  const shortcut = fixtureAtGate(1, { travel: 10 });
  step(shortcut);
  assert.equal(shortcut.nextGate, 1);
  const teleport = fixtureAtGate(1);
  teleport.course.previous = { x: createState().car.x, y: createState().car.y };
  teleport.course.lastS = TRACK_LENGTH - 18;
  step(teleport);
  assert.equal(teleport.nextGate, 1);
  assert.equal(teleport.course.travel, 0);
  const reversedFinish = fixtureAtGate(0, { reverse: true });
  step(reversedFinish);
  assert.equal(reversedFinish.lapsCompleted, 0);
});

test('a legal physics-only driver completes exactly three laps, with cumulative timing and frozen terminal state', () => {
  const state = createState();
  let gatesPassed = 0,
    maximumDeviation = 0;
  for (let tick = 0; tick < 7200 && state.phase === 'playing'; tick += 1) {
    const expected = state.nextGate;
    step(state, driver(state));
    if (state.nextGate !== expected) gatesPassed += 1;
    maximumDeviation = Math.max(maximumDeviation, nearestTrack(state.car).distance);
  }
  assert.equal(state.phase, 'won');
  assert.equal(state.result, 'finished');
  assert.equal(state.lapsCompleted, LAPS);
  assert.equal(state.lap, LAPS);
  assert.equal(gatesPassed, GATES.length * LAPS);
  assert.equal(state.lapTimes.length, LAPS);
  assert.ok(state.raceTime > 35 && state.raceTime < 55);
  assert.ok(maximumDeviation < ROAD_WIDTH / 2);
  near(
    state.lapTimes.reduce((sum, time) => sum + time, 0),
    state.raceTime,
  );
  near(state.bestLap, Math.min(...state.lapTimes));
  near(state.lapElapsed, state.lapTimes.at(-1));
  assert.equal(state.score, state.raceTime);
  const before = clone(state);
  assert.equal(step(state, { throttle: true }), false);
  assert.equal(togglePause(state), false);
  assert.equal(resetCar(state), false);
  assert.deepEqual(state, before);
});

test('pause freezes countdown, movement, checkpoint bookkeeping and race time until resumed', () => {
  const countdown = createState();
  togglePause(countdown);
  const parked = clone(countdown);
  step(countdown, { throttle: true }, 0.1);
  assert.deepEqual(countdown, parked);
  const state = active();
  ticks(state, 45, { throttle: true, right: true });
  assert.equal(togglePause(state), true);
  const before = clone(state);
  ticks(state, 100, { throttle: true, left: true });
  assert.deepEqual(state, before);
  assert.equal(togglePause(state), true);
  step(state, { throttle: true });
  assert.ok(state.elapsed > before.elapsed);
});

test('fixed substeps agree with individual steps and oversized frame deltas are bounded', () => {
  const frame = active(),
    fixed = active();
  const controls = { throttle: true, left: true };
  step(frame, controls, 0.05);
  ticks(fixed, 6, controls);
  near(frame.car.x, fixed.car.x);
  near(frame.car.y, fixed.car.y);
  near(frame.car.heading, fixed.car.heading);
  near(frame.elapsed, fixed.elapsed);
  const bounded = active();
  step(bounded, { throttle: true }, 400);
  near(bounded.elapsed, 0.1);
});

test('non-boolean held controls and invalid deltas cannot poison the simulation', () => {
  const neutral = active(),
    invalid = active();
  ticks(neutral, 60);
  ticks(invalid, 60, { throttle: 'true', brake: 1, left: {}, right: [], handbrake: Infinity });
  assert.deepEqual(invalid, neutral);
  step(invalid, null);
  const before = clone(invalid);
  for (const dt of [0, -1, NaN, Infinity, -Infinity])
    assert.equal(step(invalid, { throttle: true }, dt), false);
  assert.deepEqual(invalid, before);
  for (let i = 0; i < 12000; i += 1) {
    step(
      invalid,
      {
        throttle: i % 3 !== 0,
        brake: i % 7 === 0,
        left: i % 221 < 92,
        right: i % 221 > 127,
        handbrake: i % 101 < 30,
      },
      i % 17 === 0 ? 0.05 : FIXED_DT,
    );
    assert.ok(Object.values(invalid.car).every(Number.isFinite));
    assert.ok(Math.hypot(invalid.car.vx, invalid.car.vy) <= MAX_SPEED + 1e-8);
    assert.ok(invalid.car.x >= 12 && invalid.car.x <= WORLD.width - 12);
    assert.ok(invalid.car.y >= 12 && invalid.car.y <= WORLD.height - 12);
  }
});

function courseDriver(state) {
  const track = getTrack(state),
    car = state.car,
    speed = Math.abs(car.speed),
    projection = nearestTrack(car.x, car.y, track.id);
  const target = trackInfo(projection.s + Math.max(24, speed * 0.22), track.id);
  const error = angle(Math.atan2(target.y - car.y, target.x - car.x) - car.heading);
  const bend = Math.abs(
    angle(trackInfo(projection.s + 90, track.id).heading - trackInfo(projection.s + 20, track.id).heading),
  );
  const desired = Math.max(45, (track.surface === 'dry' ? 195 : 150) - bend * 125);
  return {
    throttle: speed < desired,
    brake: speed > desired + 6 && speed > 45,
    left: error < -0.025,
    right: error > 0.025,
  };
}

function challengeDriver(state, slow = false) {
  const track = getTrack(state),
    car = state.car,
    speed = Math.abs(car.speed);
  const projection = nearestTrack(car.x, car.y, track.id);
  const target = trackInfo(
    projection.s + Math.max(24, speed * (track.surface === 'coastal' ? 0.25 : 0.22)),
    track.id,
  );
  const error = angle(Math.atan2(target.y - car.y, target.x - car.x) - car.heading);
  const bend = Math.abs(
    angle(trackInfo(projection.s + 90, track.id).heading - trackInfo(projection.s + 20, track.id).heading),
  );
  const desired = Math.max(45, (slow ? 130 : track.surface === 'coastal' ? 185 : 195) - bend * 125);
  return {
    throttle: speed < desired,
    brake: speed > desired + 6 && speed > 45,
    left: error < -0.025,
    right: error > 0.025,
  };
}

test('difficulty targets and clean limits are serializable, strict and isolated from practice records', () => {
  assert.equal(createState().difficulty, 'standard');
  assert.equal(createState().challenge, null);
  assert.throws(() => createState({ difficulty: 'impossible' }), RangeError);
  for (const profile of DIFFICULTIES)
    for (const track of TRACKS) {
      const state = createState({ difficulty: profile.id, trackId: track.id });
      assert.equal(getDifficulty(state), profile);
      const base = track.id === 'meadow-loop' ? 'three-laps' : `${track.id}-three-laps`;
      assert.equal(recordScope(state), profile.id === 'standard' ? base : `${profile.id}-${base}`);
      assert.deepEqual(state, clone(state));
      if (state.challenge) {
        assert.equal(state.challenge.limit, profile.limits[TRACKS.indexOf(track)]);
        assert.ok(raceTargets(track.id, profile.id)[0] < raceTargets(track.id, profile.id)[1]);
        assert.equal(raceTargets(track.id, profile.id)[2], state.challenge.limit);
      }
    }
});

test('slow legal circuit driving fails Veteran pace while the same inputs can finish Standard practice', () => {
  const veteran = createState({ difficulty: 'veteran' });
  for (let tick = 0; tick < 120 * 100 && veteran.phase === 'playing'; tick++)
    step(veteran, challengeDriver(veteran, true));
  assert.equal(veteran.phase, 'lost');
  assert.equal(veteran.result, 'time-limit');
  assert.ok(veteran.lapsCompleted < 3);
  assert.equal(veteran.raceTime, null);
  assert.equal(veteran.challenge.remaining, 0);
  const before = clone(veteran);
  assert.equal(step(veteran, { throttle: true }), false);
  assert.equal(resetCar(veteran), false);
  assert.deepEqual(veteran, before);
  const practice = createState();
  for (let tick = 0; tick < 120 * 130 && practice.phase === 'playing'; tick++)
    step(practice, challengeDriver(practice, true));
  assert.equal(practice.phase, 'won');
  assert.ok(practice.raceTime > DIFFICULTIES[1].limits[0]);
});

test('all harder circuits can be completed with legal fast controls, three laps and every directed gate', () => {
  for (const difficulty of ['veteran', 'nightmare'])
    for (const track of TRACKS) {
      const state = createState({ difficulty, trackId: track.id });
      let gates = 0;
      for (let tick = 0; tick < 120 * 100 && state.phase === 'playing'; tick++) {
        const previous = state.nextGate;
        step(state, challengeDriver(state));
        if (state.nextGate !== previous) gates++;
      }
      assert.equal(state.phase, 'won', `${difficulty} ${track.id}`);
      assert.equal(gates, 36);
      assert.equal(state.lapsCompleted, 3);
      assert.ok(state.raceTime < state.challenge.limit);
      assert.ok(state.challenge.offRoad <= state.challenge.offRoadLimit);
      assert.equal(state.challenge.resets, 0);
      assert.equal(state.medal, medalForTime(state.raceTime, track.id, difficulty));
    }
});

test('off-track allowance is cumulative and reset limits cannot restore challenge time or clean allowance', () => {
  const state = createState({ difficulty: 'nightmare' });
  state.startDelay = 0;
  const outside = trackInfo(100);
  Object.assign(state.car, { x: outside.x - outside.ty * 70, y: outside.y + outside.tx * 70 });
  ticks(state, 40);
  assert.equal(state.phase, 'playing');
  const used = state.challenge.offRoad;
  assert.ok(used > 0.3);
  togglePause(state);
  const paused = clone(state);
  ticks(state, 120, { throttle: true });
  assert.deepEqual(state, paused);
  assert.equal(resetCar(state), false, 'Nightmare has no recovery resets');
  togglePause(state);
  ticks(state, 70);
  assert.equal(state.phase, 'lost');
  assert.equal(state.result, 'track-limits');
  const veteran = createState({ difficulty: 'veteran' });
  veteran.startDelay = 0;
  veteran.challenge.offRoad = 0.5;
  assert.equal(resetCar(veteran), true);
  near(veteran.elapsed, RESET_PENALTY);
  assert.equal(veteran.challenge.resets, 1);
  assert.equal(veteran.challenge.offRoad, 0.5);
  near(veteran.challenge.remaining, veteran.challenge.limit - RESET_PENALTY);
  const exhausted = clone(veteran);
  assert.equal(resetCar(veteran), false);
  assert.deepEqual(veteran, exhausted);
});

test('harder championship keeps its profile and requires three qualifying races before the final record', () => {
  const state = createState({ difficulty: 'veteran', mode: 'championship' });
  assert.equal(recordScope(state), 'veteran-championship');
  for (let race = 0; race < 3; race++) {
    for (let tick = 0; tick < 120 * 100 && state.phase === 'playing'; tick++)
      step(state, challengeDriver(state));
    assert.equal(state.phase, race < 2 ? 'stage-clear' : 'won');
    assert.equal(state.seriesResults.length, race + 1);
    if (race < 2) {
      assert.equal(advanceStage(state), true);
      assert.equal(state.difficulty, 'veteran');
      assert.equal(state.challenge.offRoad, 0);
      assert.equal(state.challenge.resets, 0);
      assert.equal(state.challenge.limit, DIFFICULTIES[1].limits[race + 1]);
    }
  }
  assert.equal(state.result, 'champion');
  near(
    state.raceTime,
    state.seriesResults.reduce((sum, race) => sum + race.time, 0),
  );
});

test('three selectable courses have distinct safe geometry, gate tangents and record scopes', () => {
  assert.equal(TRACKS.length, 3);
  assert.equal(new Set(TRACKS.map((track) => track.length.toFixed(2))).size, 3);
  assert.deepEqual(
    TRACKS.map((track) => track.surface),
    ['dry', 'coastal', 'rain'],
  );
  for (const track of TRACKS) {
    const state = createState({ trackId: track.id });
    assert.equal(state.trackId, track.id);
    assert.equal(getTrack(state), track);
    assert.equal(track.gates.length, 12);
    assert.equal(state.car.heading, trackInfo(-18, track.id).heading);
    for (const point of track.points) {
      assert.ok(point.x > track.roadWidth / 2 && point.x < WORLD.width - track.roadWidth / 2);
      assert.ok(point.y > track.roadWidth / 2 && point.y < WORLD.height - track.roadWidth / 2);
      assert.ok(nearestTrack(point.x, point.y, track.id).distance < 1e-6);
    }
    assert.equal(recordScope(state), track.id === 'meadow-loop' ? 'three-laps' : `${track.id}-three-laps`);
    assert.equal(medalForTime(track.targets[0], track.id), 'gold');
    assert.equal(medalForTime(track.targets[1], track.id), 'silver');
    assert.equal(medalForTime(track.targets[2], track.id), 'bronze');
    assert.equal(medalForTime(track.targets[2] + 1, track.id), 'finish');
  }
  assert.throws(() => createState({ trackId: 'invalid' }), RangeError);
  assert.throws(() => createState({ mode: 'invalid' }), RangeError);
});

test('actual controls complete all distinct courses, including rain slicks, with exactly 36 ordered gates', () => {
  for (const track of TRACKS) {
    const state = createState({ trackId: track.id });
    let crossings = 0,
      sawSlick = false,
      maxDeviation = 0;
    for (let tick = 0; tick < 18000 && state.phase === 'playing'; tick += 1) {
      const gate = state.nextGate;
      step(state, courseDriver(state));
      if (state.nextGate !== gate) crossings += 1;
      sawSlick ||= state.slick;
      maxDeviation = Math.max(maxDeviation, nearestTrack(state.car.x, state.car.y, track.id).distance);
    }
    assert.equal(state.phase, 'won', track.id);
    assert.equal(state.lapsCompleted, 3, track.id);
    assert.equal(crossings, 36, track.id);
    assert.ok(maxDeviation < track.roadWidth / 2, `${track.id} remains on road (${maxDeviation})`);
    assert.equal(sawSlick, track.surface === 'rain');
    near(
      state.lapTimes.reduce((a, b) => a + b, 0),
      state.raceTime,
    );
    assert.equal(state.medal, medalForTime(state.raceTime, track.id));
  }
});

test('championship requires all nine actual laps and explicit continuation, preserving total results and stage pause', () => {
  const state = createState({ mode: 'championship', trackId: 'rain-pass' });
  assert.equal(state.trackId, 'meadow-loop');
  assert.equal(recordScope(state), 'championship');
  assert.equal(advanceStage(state), false);
  for (let round = 0; round < 3; round += 1) {
    assert.equal(state.trackId, TRACKS[round].id);
    for (let tick = 0; tick < 18000 && state.phase === 'playing'; tick += 1) step(state, courseDriver(state));
    assert.equal(state.seriesResults.length, round + 1);
    assert.equal(state.seriesResults[round].trackId, TRACKS[round].id);
    if (round < 2) {
      assert.equal(state.phase, 'stage-clear');
      assert.equal(state.lapElapsed, state.lapTimes.at(-1), 'completed stage keeps the final lap on the HUD');
      const before = clone(state);
      assert.equal(step(state, { throttle: true }), false);
      assert.deepEqual(state, before);
      assert.equal(togglePause(state), true);
      assert.equal(state.pausedPhase, 'stage-clear');
      assert.equal(advanceStage(state), false);
      assert.equal(resetCar(state), false);
      assert.equal(togglePause(state), true);
      assert.equal(state.phase, 'stage-clear');
      assert.equal(advanceStage(state), true);
      assert.equal(state.elapsed, 0);
      assert.equal(state.lapsCompleted, 0);
    }
  }
  assert.equal(state.phase, 'won');
  assert.equal(state.result, 'champion');
  near(
    state.seriesResults.reduce((sum, race) => sum + race.time, 0),
    state.raceTime,
  );
  near(state.score, state.raceTime);
  assert.equal(advanceStage(state), false);
});

test('wet slick zones preserve momentum longer than dry tyres and resetting uses each selected course', () => {
  const dry = createState(),
    wet = createState({ trackId: 'rain-pass' });
  for (const state of [dry, wet]) {
    const track = getTrack(state),
      point = trackInfo(track.length * 0.24, track.id);
    state.startDelay = 0;
    Object.assign(state.car, {
      x: point.x,
      y: point.y,
      heading: point.heading,
      vx: point.tx * 80 - point.ty * 30,
      vy: point.ty * 80 + point.tx * 30,
    });
    state.course.previous = { x: point.x, y: point.y };
    state.course.lastS = point.s;
    step(state, {});
  }
  assert.equal(wet.slick, true);
  assert.ok(Math.abs(wet.car.slip) > Math.abs(dry.car.slip));
  for (const track of TRACKS) {
    const state = createState({ trackId: track.id });
    state.startDelay = 0;
    state.lastCheckpoint = 3;
    state.nextGate = 4;
    state.car.x = 2;
    assert.equal(resetCar(state), true);
    assert.equal(state.penalty, 3);
    assert.ok(nearestTrack(state.car.x, state.car.y, track.id).distance < 1e-6);
    assert.equal(state.nextGate, 4);
  }
});
