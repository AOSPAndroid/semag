import assert from 'node:assert/strict';
import test from 'node:test';
import { createBestStore, recordDetails } from '../public/solo/solo.js';

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
