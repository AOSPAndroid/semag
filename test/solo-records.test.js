import assert from 'node:assert/strict';
import test from 'node:test';
import { createBestStore, recordDetails, formatValue } from '../public/solo/solo.js';

test('new campaign records reject unfinished runs and unknown challenge scopes', () => {
  for (const [gameId, scope, result] of [
    ['skyline-hook', 'veteran-campaign-v1', undefined],
    ['starfall-squadron', 'veteran-campaign-v1', 'campaign'],
    ['ironwood-tactics', 'ironwood-v1-veteran', undefined],
    ['shadow-lantern', 'shadow-v1-veteran', undefined],
  ]) {
    for (const phase of ['playing', 'paused', 'lost', 'upgrade', 'stage-clear', 'mission-clear', 'reward']) {
      assert.equal(recordDetails(gameId, { phase, recordKey: scope, score: 500, record: 500, result }).candidate, null, `${gameId}/${phase}`);
    }
    assert.equal(recordDetails(gameId, { phase: 'won', recordKey: scope, record: 500, result }).candidate, 500);
    assert.ok(recordDetails(gameId, { phase: 'won', recordKey: scope, score: 500, result }).candidate == null, `${gameId}/missing-completion-record`);
    assert.equal(recordDetails(gameId, { phase: 'won', recordKey: scope + '-unknown', record: 500, result }).candidate, null);
  }
  assert.equal(recordDetails('starfall-squadron', { phase: 'won', recordKey: 'veteran-campaign-v1', record: 500, result: 'stage' }).candidate, null);
});

test('Skyline fastest completed campaigns survive reload and stay separate by difficulty', () => {
  const storage = browserStorage();
  let store = createBestStore(storage);
  const save = (tier, phase, time) => {
    const policy = recordDetails('skyline-hook', { phase, recordKey: `${tier}-campaign-v1`, score: time, record: time });
    return store.update('skyline-hook', policy.candidate, policy);
  };
  assert.equal(save('veteran', 'playing', 1), null);
  assert.equal(save('veteran', 'won', 240.38), 240.38);
  assert.equal(save('veteran', 'won', 260.5), 240.38);
  assert.equal(save('veteran', 'lost', 1), 240.38);
  assert.equal(save('standard', 'won', 100), 100);
  assert.equal(save('nightmare', 'won', 300), 300);
  store = createBestStore(storage);
  assert.equal(store.read('skyline-hook', 'veteran-campaign-v1'), 240.38);
  assert.equal(save('veteran', 'won', 230.2), 230.2);
  assert.equal(formatValue(230.2, 2, 's'), '230.20s');
  assert.equal(store.read('skyline-hook', 'standard-campaign-v1'), 100);
  assert.equal(store.read('apex-circuit', 'veteran-three-laps-v3'), null);
});

test('Starfall, Ironwood and Shadow completed scores remain isolated across difficulties and games', () => {
  const storage = browserStorage();
  let store = createBestStore(storage);
  for (const gameId of ['starfall-squadron', 'ironwood-tactics', 'shadow-lantern']) {
    for (const [index, tier] of ['standard', 'veteran', 'nightmare'].entries()) {
      const recordKey = gameId === 'shadow-lantern' ? `shadow-v1-${tier}` : gameId === 'ironwood-tactics' ? `ironwood-v1-${tier}` : `${tier}-campaign-v1`;
      const save = (phase, record) => {
        const policy = recordDetails(gameId, { phase, recordKey, record, result: 'campaign' });
        return store.update(gameId, policy.candidate, policy);
      };
      assert.equal(save('won', 900 + index), 900 + index);
      assert.equal(save('won', 800), 900 + index);
      assert.equal(save('lost', 9999), 900 + index);
      assert.equal(save('playing', 9999), 900 + index);
      store = createBestStore(storage);
      assert.equal(store.read(gameId, recordKey), 900 + index);
    }
  }
  assert.equal(store.read('deckbound', 'veteran-v3'), null);
});

function browserStorage() {
  const values = new Map();
  return {
    values,
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
  };
}

test('solo best scores survive a new store and never drop when a run restarts', () => {
  const storage = browserStorage();
  const first = createBestStore(storage);
  assert.equal(first.update('snake', 70), 70);
  assert.equal(first.update('snake', 0), 70);
  assert.equal(first.update('2048', 256), 256);
  const reloaded = createBestStore(storage);
  assert.equal(reloaded.read('snake'), 70);
  assert.equal(reloaded.read('2048'), 256);
  assert.equal(reloaded.update('snake', 90), 90);
});

test('Minesweeper saves faster times separately for each difficulty', () => {
  const records = createBestStore(browserStorage());
  const beginner = { scope: 'beginner', direction: 'min' };
  const intermediate = { scope: 'intermediate', direction: 'min' };
  assert.equal(records.update('minesweeper', 42, beginner), 42);
  assert.equal(records.update('minesweeper', 60, beginner), 42);
  assert.equal(records.update('minesweeper', 31, beginner), 31);
  assert.equal(records.update('minesweeper', 150, intermediate), 150);
  assert.equal(records.read('minesweeper', 'beginner'), 31);
  assert.equal(records.read('minesweeper', 'intermediate'), 150);
});

test('Apex Circuit records require a completed race and retain the fastest time after reload', () => {
  const storage = browserStorage();
  const records = createBestStore(storage);
  const save = (update, store = records) => {
    const { candidate, scope, direction } = recordDetails('apex-circuit', update);
    return store.update('apex-circuit', candidate, { scope, direction });
  };
  for (const phase of ['playing', 'paused', 'lost']) {
    assert.equal(save({ phase, score: 0, record: 0 }), null);
  }
  assert.equal(save({ phase: 'won', score: 49.27, record: 49.27 }), 49.27);
  assert.equal(save({ phase: 'playing', score: 1, record: 1 }), 49.27);
  assert.equal(save({ phase: 'won', score: 52.19, record: 52.19 }), 49.27);
  assert.equal(save({ phase: 'won', score: 44.63, record: 44.63 }), 44.63);
  const reloaded = createBestStore(storage);
  assert.equal(reloaded.read('apex-circuit', 'three-laps'), 44.63);
  assert.equal(save({ phase: 'playing', score: 0 }, reloaded), 44.63);
});

test('Night Drive saves a growing best score independently from timed games', () => {
  const records = createBestStore(browserStorage());
  const save = (gameId, update) => {
    const { candidate, scope, direction } = recordDetails(gameId, update);
    return records.update(gameId, candidate, { scope, direction });
  };
  assert.equal(save('night-drive', { phase: 'playing', score: 125 }), 125);
  assert.equal(save('night-drive', { phase: 'lost', score: 480 }), 480);
  assert.equal(save('night-drive', { phase: 'playing', score: 0 }), 480);
  assert.equal(save('minesweeper', { phase: 'playing', recordKey: 'intermediate', record: 1 }), null);
  assert.equal(save('minesweeper', { phase: 'won', recordKey: 'intermediate', record: 103 }), 103);
  assert.equal(save('minesweeper', { phase: 'won', recordKey: 'intermediate', record: 88 }), 88);
  assert.equal(records.read('night-drive'), 480);
  assert.equal(records.read('minesweeper', 'intermediate'), 88);
});

test('Prism marathon scores and completed sprint times compete under separate policies', () => {
  const storage = browserStorage();
  const records = createBestStore(storage);
  const save = update => {
    const policy = recordDetails('prism-shift', update);
    return records.update('prism-shift', policy.candidate, policy);
  };
  assert.equal(save({ phase: 'playing', recordKey: 'marathon', score: 2400 }), 2400);
  assert.equal(save({ phase: 'lost', recordKey: 'marathon', score: 1200 }), 2400);
  assert.equal(save({ phase: 'playing', recordKey: 'sprint', score: 2, record: 2 }), null);
  assert.equal(save({ phase: 'paused', recordKey: 'sprint', record: 1 }), null);
  assert.equal(save({ phase: 'lost', recordKey: 'sprint', record: 1 }), null);
  assert.equal(save({ phase: 'won', recordKey: 'sprint', record: 87.25 }), 87.25);
  assert.equal(save({ phase: 'won', recordKey: 'sprint', record: 94.1 }), 87.25);
  assert.equal(save({ phase: 'won', recordKey: 'sprint', record: 76.54 }), 76.54);
  const reloaded = createBestStore(storage);
  assert.equal(reloaded.read('prism-shift', 'marathon'), 2400);
  assert.equal(reloaded.read('prism-shift', 'sprint'), 76.54);
  assert.equal(recordDetails('prism-shift', { recordKey: 'sprint' }).unit, 's');
});

test('Rift Survivor records persist across waves and upgrades without replacing other games', () => {
  const records = createBestStore(browserStorage());
  for (const [phase, score] of [['playing', 50], ['upgrade', 400], ['lost', 400], ['playing', 0]]) {
    const policy = recordDetails('rift-survivor', { phase, score });
    records.update('rift-survivor', policy.candidate, policy);
  }
  assert.equal(records.read('rift-survivor'), 400);
  assert.equal(records.read('prism-shift', 'marathon'), null);
});

test('invalid stored records do not poison future scores', () => {
  const storage = browserStorage();
  const key = 'fireside-solo-best:snake:default';
  for (const raw of ['null', 'true', '"80"', '{}', '-1', 'Infinity', 'NaN', '', ' 80 ']) {
    storage.values.set(key, raw);
    const records = createBestStore(storage);
    assert.equal(records.read('snake'), null, raw);
    assert.equal(records.update('snake', 80), 80, raw);
    assert.equal(storage.values.get(key), '80', raw);
  }
  const records = createBestStore(storage);
  for (const invalid of [null, '90', -1, NaN, Infinity, undefined]) {
    assert.equal(records.update('snake', invalid), 80);
  }
});

test('blocked browser storage retains records in memory without interrupting play', () => {
  const unavailable = createBestStore({
    getItem() { throw new Error('Storage blocked'); },
    setItem() { throw new Error('Storage blocked'); },
  });
  assert.equal(unavailable.update('snake', 30), 30);
  assert.equal(unavailable.read('snake'), 30);
  assert.equal(unavailable.update('snake', 10), 30);
  const absent = createBestStore(undefined);
  assert.equal(absent.update('2048', 16), 16);
  assert.equal(absent.read('2048'), 16);
});

test('losing storage write access mid-run preserves the existing record and new best', () => {
  const storage = browserStorage();
  storage.values.set('fireside-solo-best:snake:default', '40');
  const records = createBestStore(storage);
  assert.equal(records.read('snake'), 40);
  storage.setItem = () => { throw new Error('Write access revoked'); };
  assert.equal(records.update('snake', 60), 60);
  assert.equal(records.read('snake'), 60);
  assert.equal(records.update('snake', 20), 60);
});


test('expanded courses, challenge roads and tiers keep independent records',()=>{
 for(const [game,keys] of [['snake',['default','gardens']],['2048',['default','puzzles']],['minesweeper',['beginner','intermediate','expert']],['apex-circuit',['three-laps','harbor-ring-three-laps','rain-pass-three-laps','championship']],['night-drive',['default','tour']],['rift-survivor',['default','veteran']]]){
  const store=createBestStore();
  keys.forEach((key,index)=>{const policy=recordDetails(game,{phase:'won',score:100+index,record:100+index,recordKey:key});assert.equal(policy.scope,key);store.update(game,policy.candidate,policy);});
  keys.forEach((key,index)=>assert.equal(store.read(game,key),100+index));
 }
});


test('Prism Excavation records require the full road and stay separate from Sprint',()=>{
 for(const phase of ['playing','paused','lost'])assert.equal(recordDetails('prism-shift',{recordKey:'dig',phase,score:12,record:12}).candidate,null);
 const policy=recordDetails('prism-shift',{recordKey:'dig',phase:'won',score:24.6,record:24.6});
 assert.equal(policy.scope,'dig');assert.equal(policy.direction,'min');assert.equal(policy.candidate,24.6);
});

test('challenge records never replace easier or historical bests', () => {
  const games = [
    ['ember-delve', ['default', 'veteran', 'nightmare']],
    ['deckbound', ['default', 'veteran', 'nightmare']],
    ['rift-survivor', ['default', 'veteran', 'veteran-v2', 'nightmare']],
    ['snake', ['default', 'gardens', 'gauntlet']],
    ['2048', ['default', 'puzzles', 'master']],
    ['night-drive', ['default', 'tour', 'veteran-default', 'veteran-tour', 'nightmare-default', 'nightmare-tour']],
    ['prism-shift', ['marathon', 'veteran-marathon', 'nightmare-marathon']],
  ];
  for (const [game, scopes] of games) {
    const storage = browserStorage();
    let records = createBestStore(storage);
    for (const [index, scope] of scopes.entries()) {
      const policy = recordDetails(game, { phase: 'won', recordKey: scope, score: 1000 - index * 100, record: 1000 - index * 100 });
      assert.equal(policy.scope, scope, `${game}/${scope}`);
      records.update(game, policy.candidate, policy);
    }
    records = createBestStore(storage);
    for (const [index, scope] of scopes.entries()) assert.equal(records.read(game, scope), 1000 - index * 100, `${game}/${scope}`);
  }
});

test('timed challenge records require qualifying finishes in every tier', () => {
  const games = [
    ['apex-circuit', ['three-laps', 'harbor-ring-three-laps', 'rain-pass-three-laps', 'championship']],
    ['prism-shift', ['sprint', 'dig']],
  ];
  for (const [game, modes] of games) {
    const storage = browserStorage();
    const records = createBestStore(storage);
    for (const tier of ['', 'veteran-', 'nightmare-']) {
      for (const mode of modes) {
        const scope = tier + mode;
        for (const phase of ['playing', 'paused', 'lost', 'stage-clear']) {
          const policy = recordDetails(game, { recordKey: scope, phase, record: 1, score: 1 });
          assert.equal(policy.candidate, null, `${game}/${scope}/${phase}`);
          assert.equal(records.update(game, policy.candidate, policy), null);
        }
        for (const elapsed of [110, 125, 95]) {
          const policy = recordDetails(game, { recordKey: scope, phase: 'won', record: elapsed });
          assert.equal(policy.scope, scope);
          assert.equal(policy.direction, 'min');
          assert.equal(policy.unit, 's');
          records.update(game, policy.candidate, policy);
        }
        assert.equal(createBestStore(storage).read(game, scope), 95);
      }
    }
  }
});

test('an unrecognized challenge scope cannot silently overwrite a standard record', () => {
  const records = createBestStore();
  records.update('ember-delve', 120);
  const invalid = recordDetails('ember-delve', { recordKey: 'veteran-typo', phase: 'won', score: 99999 });
  assert.equal(invalid.candidate, null);
  assert.equal(records.update('ember-delve', invalid.candidate, invalid), 120);
  assert.equal(recordDetails('ember-delve', { phase: 'playing', score: 100 }).candidate, 100);
});

test('Night Drive challenge tours save only completed scores and endless remains open', () => {
  for (const tier of ['veteran', 'nightmare']) {
    const store = createBestStore();
    for (const phase of ['playing', 'paused', 'lost']) {
      const policy = recordDetails('night-drive', { recordKey: `${tier}-tour`, phase, score: 5000, record: 5000 });
      assert.equal(policy.candidate, null);
      assert.equal(store.update('night-drive', policy.candidate, policy), null);
    }
    const finished = recordDetails('night-drive', { recordKey: `${tier}-tour`, phase: 'won', score: 9000, record: 9000 });
    assert.equal(store.update('night-drive', finished.candidate, finished), 9000);
    const endless = recordDetails('night-drive', { recordKey: `${tier}-default`, phase: 'lost', score: 500 });
    assert.equal(store.update('night-drive', endless.candidate, endless), 500);
    assert.equal(store.read('night-drive', `${tier}-tour`), 9000);
  }
});


test('Paris Pedal saves finished deliveries and keeps Rush and difficulty records separate', () => {
  const storage = browserStorage();
  const store = createBestStore(storage);
  for (const [index, tier] of ['standard', 'veteran', 'nightmare'].entries()) {
    const routeScope = `${tier}-delivery`;
    for (const phase of ['playing', 'paused', 'lost']) {
      const policy = recordDetails('paris-pedal', { recordKey: routeScope, phase, score: 9000, record: 9000 });
      assert.equal(policy.scope, routeScope);
      assert.equal(policy.candidate, null);
      assert.equal(store.update('paris-pedal', policy.candidate, policy), null);
    }
    const score = 2000 + index * 100;
    const complete = recordDetails('paris-pedal', { recordKey: routeScope, phase: 'won', score, record: score });
    assert.equal(complete.direction, 'max');
    assert.equal(store.update('paris-pedal', complete.candidate, complete), score);
    const rushScope = `${tier}-rush`;
    for (const [phase, value] of [['playing', 300], ['lost', 500], ['playing', 0]]) {
      const rush = recordDetails('paris-pedal', { recordKey: rushScope, phase, score: value });
      assert.equal(rush.scope, rushScope);
      assert.equal(rush.candidate, value);
      store.update('paris-pedal', rush.candidate, rush);
    }
    assert.equal(createBestStore(storage).read('paris-pedal', routeScope), score);
    assert.equal(createBestStore(storage).read('paris-pedal', rushScope), 500);
  }
  const invalid = recordDetails('paris-pedal', { recordKey: 'veteran-delivery-typo', phase: 'won', score: 99999 });
  assert.equal(invalid.candidate, null);
});

test('Paris Survival qualifies collision-ending time and preserves the longest across reloads and tiers', () => {
  const storage = browserStorage();
  const store = createBestStore(storage);
  for (const [index, tier] of ['standard', 'veteran', 'nightmare'].entries()) {
    const scope = `${tier}-survival-v1`;
    store.update('paris-pedal', 999999, { scope: `${tier}-rush` });
    store.update('paris-pedal', 888888, { scope: `${tier}-delivery` });
    for (const phase of ['playing', 'paused', 'won']) {
      const policy = recordDetails('paris-pedal', { recordKey: scope, phase, result: 'crashed', record: 999000, score: 999000 });
      assert.equal(policy.candidate, null);
      assert.equal(store.update('paris-pedal', policy.candidate, policy), null);
    }
    for (const result of [null, 'delivery-late', 'deliveries-complete']) {
      assert.equal(recordDetails('paris-pedal', { recordKey: scope, phase: 'lost', result, record: 999000 }).candidate, null);
    }
    assert.equal(recordDetails('paris-pedal', { recordKey: scope, phase: 'lost', result: 'crashed', score: 999999 }).candidate, undefined, 'Points cannot substitute for an explicit survival time');
    const longest = 65420 + index * 30000;
    for (const time of [longest, longest - 1000]) {
      const policy = recordDetails('paris-pedal', { recordKey: scope, phase: 'lost', result: 'crashed', record: time, score: 999999 });
      assert.equal(policy.scope, scope);
      assert.equal(policy.direction, 'max');
      assert.equal(policy.unit, 'duration-ms');
      assert.equal(store.update('paris-pedal', policy.candidate, policy), longest);
    }
    const reload = createBestStore(storage);
    assert.equal(reload.read('paris-pedal', scope), longest);
    assert.equal(reload.read('paris-pedal', `${tier}-rush`), 999999);
    assert.equal(reload.read('paris-pedal', `${tier}-delivery`), 888888);
  }
  assert.equal(recordDetails('paris-pedal', { recordKey: 'veteran-survival', phase: 'lost', result: 'crashed', record: 999999 }).candidate, null);
});

test('Survival milliseconds display as elapsed time without rounding into the next second', () => {
  for (const [milliseconds, displayed] of [[0, '0:00.00'], [5429, '0:05.42'], [59999, '0:59.99'], [60000, '1:00.00'], [65420, '1:05.42'], [3600000, '60:00.00']]) {
    assert.equal(formatValue(milliseconds, undefined, 'duration-ms'), displayed);
  }
  assert.equal(formatValue(87.25, 2, 's'), '87.25s');
  assert.equal(formatValue(9210), '9210');
});

test('rebalanced solo records survive reload without competing against historical results', () => {
  const cases = [
    ['ember-delve', 'veteran', 'veteran-v3'], ['ember-delve', 'nightmare', 'nightmare-v3'],
    ['rift-survivor', 'veteran-v2', 'veteran-v3'], ['rift-survivor', 'nightmare', 'nightmare-v3'],
    ['deckbound', 'veteran', 'veteran-v3'], ['deckbound', 'nightmare', 'nightmare-v3'],
    ['snake', 'gauntlet', 'gauntlet-v3'], ['minesweeper', 'expert', 'master-v3'],
    ['2048', 'master', 'master-v3'],
  ];
  for (const [game, previous, current] of cases) {
    const storage = browserStorage(), store = createBestStore(storage);
    store.update(game, 999999, { scope: previous });
    const policy = recordDetails(game, { recordKey: current, phase: 'won', result: 'tour', record: 1234, score: 1234 });
    assert.equal(policy.scope, current); assert.equal(policy.candidate, 1234);
    store.update(game, policy.candidate, policy);
    const loaded = createBestStore(storage);
    assert.equal(loaded.read(game, current), 1234, game);
    assert.equal(loaded.read(game, previous), 999999, game);
  }
});

test('versioned driving and Prism records retain completed-only and time policies', () => {
  for (const tier of ['veteran', 'nightmare']) {
    for (const [game, modes, direction, unit] of [
      ['apex-circuit', ['three-laps', 'harbor-ring-three-laps', 'rain-pass-three-laps', 'championship'], 'min', 's'],
      ['prism-shift', ['sprint', 'dig'], 'min', 's'],
      ['night-drive', ['tour'], 'max', ''],
      ['paris-pedal', ['delivery'], 'max', ''],
    ]) for (const mode of modes) {
      const key = `${tier}-${mode}-v3`;
      for (const phase of ['playing', 'paused', 'lost', 'stage-clear'])
        assert.equal(recordDetails(game, { recordKey: key, phase, record: 1 }).candidate, null, `${game}/${key}/${phase}`);
      const policy = recordDetails(game, { recordKey: key, phase: 'won', record: 120 });
      assert.equal(policy.scope, key); assert.equal(policy.candidate, 120);
      assert.equal(policy.direction, direction); assert.equal(policy.unit, unit);
      assert.equal(recordDetails(game, { recordKey: key, phase: 'won', score: 999 }).candidate, undefined);
    }
    const marathon = recordDetails('prism-shift', { recordKey: `${tier}-marathon-v3`, phase: 'playing', score: 800 });
    assert.equal(marathon.direction, 'max'); assert.equal(marathon.candidate, 800);
    const survival = `${tier}-survival-v3`;
    for (const phase of ['playing', 'paused', 'won'])
      assert.equal(recordDetails('paris-pedal', { recordKey: survival, phase, result: 'crashed', record: 60000 }).candidate, null);
    const finished = recordDetails('paris-pedal', { recordKey: survival, phase: 'lost', result: 'crashed', record: 60123, score: 999999 });
    assert.equal(finished.scope, survival); assert.equal(finished.unit, 'duration-ms'); assert.equal(finished.candidate, 60123);
    assert.equal(recordDetails('paris-pedal', { recordKey: survival, phase: 'lost', result: 'delivery-late', record: 60000 }).candidate, null);
  }
});

test('the new Master tour record requires all six trials, not an individual puzzle win', () => {
  for (const result of [null, undefined, 'puzzle', 'budget'])
    assert.equal(recordDetails('2048', { recordKey: 'master-v3', phase: 'won', result, record: 9000 }).candidate, null);
  for (const phase of ['playing', 'paused', 'lost'])
    assert.equal(recordDetails('2048', { recordKey: 'master-v3', phase, result: 'tour', record: 9000 }).candidate, null);
  assert.equal(recordDetails('2048', { recordKey: 'master-v3', phase: 'won', result: 'tour', record: 9000 }).candidate, 9000);
  assert.equal(recordDetails('2048', { recordKey: 'master', phase: 'playing', score: 999 }).candidate, 999, 'historical scope retains its original meaning');
});

test('accelerating survival records are recognized and isolated from earlier fixed-pace scores', () => {
  for (const tier of ['veteran', 'nightmare']) {
    for (const [game, previous, current] of [
      ['night-drive', `${tier}-default-v3`, `${tier}-default-v4`],
      ['rift-survivor', `${tier}-v3`, `${tier}-v4`],
    ]) {
      const storage = browserStorage(), store = createBestStore(storage);
      const old = recordDetails(game, { recordKey: previous, phase: 'lost', score: 999999 });
      assert.equal(old.scope, previous); assert.equal(old.candidate, 999999);
      store.update(game, old.candidate, old);
      for (const [phase, score] of [['playing', 120], ['lost', 480]]) {
        const policy = recordDetails(game, { recordKey: current, phase, score });
        assert.equal(policy.scope, current); assert.equal(policy.candidate, score);
        assert.equal(policy.direction, 'max');
        store.update(game, policy.candidate, policy);
      }
      const reloaded = createBestStore(storage);
      assert.equal(reloaded.read(game, current), 480);
      assert.equal(reloaded.read(game, previous), 999999);
      assert.equal(recordDetails(game, { recordKey: current + '-typo', score: 1000000 }).candidate, null);
    }
    assert.equal(recordDetails('night-drive', { recordKey: `${tier}-tour-v3`, phase: 'lost', record: 8000 }).candidate, null);
    assert.equal(recordDetails('night-drive', { recordKey: `${tier}-tour-v3`, phase: 'won', record: 8000 }).candidate, 8000);
  }
});
