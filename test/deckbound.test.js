import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTS, CARDS, RELICS, DIFFICULTIES, difficultyInfo, removalCost, relicInfo, createState, dispatch, togglePause, cardInfo, intentDamage, intentDamageAt, pressureStrength, recoveryRemaining, recordScope } from '../public/solo/deckbound-engine.js';
const copy = value => structuredClone(value);
function battle(seed = 1) { const s = createState({ seed }); assert.equal(dispatch(s, 'choose-route', { id: 'path-0' }).ok, true); return s; }
function hand(s, id, upgraded = false) { const c = { uid: 900 + s.hand.length, id, upgraded }; s.hand = [c]; return c; }
function dummy(s, hp = 100) { s.enemies = [{ ...s.enemies[0], hp, maxHp: hp, block: 0, strength: 0, weak: 0, burn: 0, vulnerable: 0, intent: { kind: 'guard', block: 0, label: 'Wait' } }]; }
function cast(s, id, upgraded = false, target = 0) { s.energy = 3; const c = hand(s, id, upgraded); assert.equal(dispatch(s, 'play-card', { uid: c.uid, target }).ok, true); }

test('Deckbound supplies three acts,24 distinct readable cards,eight relics,and a lean starter deck', () => {
  const s = createState({ seed: 1 }); assert.equal(ACTS.length, 3); assert.equal(Object.keys(CARDS).length, 24); assert.equal(Object.keys(RELICS).length, 8);
  assert.equal(s.deck.length, 10); assert.equal(new Set(s.deck.map(c => c.uid)).size, 10);
  for (const [id, c] of Object.entries(CARDS)) { assert.ok(c.text.length > 10); assert.ok(c.upgraded.length > 10); assert.ok(c.art); assert.ok(c.cost >= 0 && c.cost <= 2); assert.equal(cardInfo({ id, upgraded: true }).text, c.upgraded); }
});
test('Seeds reproduce routes,shuffles,rewards,and allow string seeds', () => { assert.deepEqual(battle('fireside'), battle('fireside')); assert.notDeepEqual(battle(2).draw, battle(3).draw); });
test('Illegal phase,card,target,and energy actions leave the state unchanged', () => {
  const s = battle(); const c = s.hand.find(c => c.id === 'strike'); s.energy = 0; const before = copy(s);
  for (const payload of [{ uid: c.uid }, { uid: -1 }, { uid: c.uid, target: 99 }, null]) assert.equal(dispatch(s, 'play-card', payload).ok, false);
  assert.equal(dispatch(s, 'choose-route', { id: 'path-0' }).ok, false); assert.deepEqual(s, before);
  s.energy = 3; const current = copy(s); assert.equal(dispatch(s, 'play-card', { uid: c.uid, target: '0' }).ok, false); assert.deepEqual(s, current);
});
test('Attack uses block,strength,vulnerable,and weak in the displayed order', () => {
  const s = battle(); dummy(s); s.player.strength = 2; s.player.weak = 1; s.enemies[0].vulnerable = 1; s.enemies[0].block = 3;
  cast(s, 'strike'); assert.equal(s.enemies[0].hp, 93); assert.equal(s.enemies[0].block, 0); assert.equal(s.energy, 2); assert.equal(s.discard.at(-1).id, 'strike');
});
test('Needlepoint ignores block; Threefold Cut benefits from strength on each strike', () => {
  const s = battle(); dummy(s); s.enemies[0].block = 20; cast(s, 'pierce', true); assert.equal(s.enemies[0].hp, 85); assert.equal(s.enemies[0].block, 20);
  s.enemies[0].block = 0; s.player.strength = 2; cast(s, 'flurry'); assert.equal(s.enemies[0].hp, 70);
});
test('Area cards affect both targets; single target effects cannot strike a dead enemy', () => {
  const s = battle(); dummy(s); s.enemies.push(copy(s.enemies[0])); cast(s, 'cleave'); assert.deepEqual(s.enemies.map(e => e.hp), [91, 91]);
  cast(s, 'cinder'); assert.deepEqual(s.enemies.map(e => e.burn), [6, 6]); assert.equal(s.player.block, 8);
  s.enemies[0].hp = 0; const c = hand(s, 'ember'); const before = copy(s); assert.equal(dispatch(s, 'play-card', { uid: c.uid }).ok, false); assert.deepEqual(s, before);
});
test('Burn ticks before enemy attacks,decrements,and ignores block', () => {
  const s = battle(); dummy(s, 6); s.enemies[0].block = 20; s.enemies[0].burn = 7; s.enemies[0].intent = { damage: 80, hits: 1 }; const hp = s.hp;
  assert.equal(dispatch(s, 'end-turn').ok, true); assert.equal(s.phase, 'reward'); assert.equal(s.hp, hp);
});
test('Burn relic,double burn,and weakness create distinct build paths', () => {
  const s = battle(); dummy(s); s.relics.push('emberglass'); cast(s, 'kindle'); assert.equal(s.enemies[0].burn, 9);
  cast(s, 'wildfire'); assert.equal(s.enemies[0].burn, 18); cast(s, 'weakness'); assert.equal(s.enemies[0].weak, 2);
  s.enemies[0].intent = { damage: 12, hits: 1 }; assert.equal(intentDamage(s.enemies[0]), 9);
});
test('Power cards exhaust and their permanent combat bonuses reset in the next battle', () => {
  const s = battle(); dummy(s); cast(s, 'focus'); cast(s, 'brace', true); cast(s, 'bulwark');
  assert.equal(s.player.strength, 2); assert.equal(s.player.dexterity, 3); assert.equal(s.player.thorns, 3); assert.equal(s.exhaust.length, 3);
  s.enemies[0].hp = 1; cast(s, 'strike'); dispatch(s, 'choose-reward', { id: 'skip' }); dispatch(s, 'choose-route', { id: 'path-0' });
  assert.equal(s.player.strength, 0); assert.equal(s.player.dexterity, 0); assert.equal(s.player.thorns, 0); assert.equal(s.exhaust.length, 0);
});
test('Exhaust energy relic is once per turn and discard is recycled without exhausted cards', () => {
  const s = battle(); dummy(s); s.relics.push('lantern'); s.energy = 2;
  s.hand = [{ uid: 801, id: 'insight' }, { uid: 802, id: 'salvage' }]; s.draw = []; s.discard = [{ uid: 803, id: 'guard' }];
  dispatch(s, 'play-card', { uid: 801 }); assert.equal(s.energy, 3); assert.ok(s.hand.some(c => c.uid === 803));
  dispatch(s, 'play-card', { uid: 802 }); assert.equal(s.energy, 4); assert.deepEqual(s.exhaust.map(c => c.uid), [801, 802]);
  dispatch(s, 'end-turn'); assert.ok(!s.hand.some(c => [801, 802].includes(c.uid))); assert.equal(s.exhaust.length, 2);
});
test('Block resets each turn; Living Fortress retains exactly half of remaining block', () => {
  const s = battle(); dummy(s); cast(s, 'guard'); assert.equal(s.player.block, 6); dispatch(s, 'end-turn'); assert.equal(s.player.block, 0);
  s.enemies[0].intent = { kind: 'guard', block: 0 }; cast(s, 'fortress'); dispatch(s, 'end-turn'); assert.equal(s.player.block, 9); assert.equal(s.player.retain, false);
});
test('New player debuffs survive the enemy turn and poison bypasses block then decays', () => {
  const s = battle(); dummy(s); s.player.block = 30; s.enemies[0].intent = { kind: 'debuff', weak: 2, vulnerable: 2, poison: 3 };
  dispatch(s, 'end-turn'); assert.equal(s.player.weak, 2); assert.equal(s.player.vulnerable, 2); assert.equal(s.player.poison, 2); assert.equal(s.hp, 79);
  s.enemies[0].intent = { kind: 'guard', block: 0 }; dispatch(s, 'end-turn'); assert.equal(s.player.weak, 1); assert.equal(s.player.vulnerable, 1); assert.equal(s.hp, 77);
});
test('Thorns retaliate per hit and can kill before a later strike', () => {
  const s = battle(); dummy(s, 5); s.player.thorns = 3; s.player.block = 0; s.enemies[0].intent = { damage: 2, hits: 3 }; dispatch(s, 'end-turn');
  assert.equal(s.phase, 'reward'); assert.equal(s.hp, 78);
});
test('Healing cards cap at maximum HP and Crimson Pact requires damage through block', () => {
  const s = battle(); dummy(s); s.hp = 78; cast(s, 'mend', true); assert.equal(s.hp, 82);
  s.hp = 50; s.enemies[0].block = 30; cast(s, 'leech'); assert.equal(s.hp, 50); s.enemies[0].block = 0; cast(s, 'leech', true); assert.equal(s.hp, 56);
});
test('Buckle grants block once per turn; upgraded riposte and exhausted Echo scale', () => {
  const s = battle(); dummy(s); s.relics.push('buckle'); cast(s, 'guard'); assert.equal(s.player.block, 9); cast(s, 'guard'); assert.equal(s.player.block, 15);
  cast(s, 'riposte', true); assert.equal(s.enemies[0].hp, 81); s.exhaust = [{ id: 'focus' }, { id: 'brace' }]; cast(s, 'echo', true); assert.equal(s.enemies[0].hp, 64);
});
test('A hand caps at ten cards and zero cost cards spend no energy', () => {
  const s = battle(); dummy(s); s.hand = Array.from({ length: 10 }, (_, i) => ({ id: 'insight', uid: 700 + i })); s.draw = Array.from({ length: 10 }, (_, i) => ({ id: 'guard', uid: 800 + i })); s.energy = 0;
  dispatch(s, 'play-card', { uid: 700 }); assert.equal(s.hand.length, 10); assert.equal(s.draw.length, 9); assert.equal(s.energy, 0);
});
test('Victory rewards are unique, legal, permanent,and skipping preserves deck size', () => {
  const s = battle(); dummy(s, 1); const gold = s.gold; cast(s, 'strike'); assert.equal(s.phase, 'reward'); assert.equal(s.gold, gold + 24); assert.equal(new Set(s.rewardCards).size, 3);
  const before = copy(s); assert.equal(dispatch(s, 'choose-reward', { id: 'strike' }).ok, false); assert.deepEqual(s, before);
  const id = s.rewardCards[0]; dispatch(s, 'choose-reward', { id }); assert.equal(s.deck.length, 11); assert.equal(s.deck.at(-1).id, id); assert.equal(s.floor, 2);
});
test('Rest trades healing for one permanent upgrade; shops prevent double purchases/removals', () => {
  // Obtain floor2 route through a completed battle to retain the engine-created options.
  const t = battle(9); dummy(t, 1); cast(t, 'strike'); dispatch(t, 'choose-reward', { id: 'skip' });
  dispatch(t, 'choose-route', { id: 'path-1' }); const uid = t.deck[0].uid; dispatch(t, 'rest', { kind: 'upgrade', uid }); assert.equal(t.deck[0].upgraded, true); assert.equal(t.floor, 3);
  const shop = battle(3); dummy(shop, 1); cast(shop, 'strike'); dispatch(shop, 'choose-reward', { id: 'skip' }); dispatch(shop, 'choose-route', { id: 'path-2' });
  const offer = shop.shopOffers[0]; assert.equal(dispatch(shop, 'buy', { id: offer.id }).ok, true); const after = copy(shop); assert.equal(dispatch(shop, 'buy', { id: offer.id }).ok, false); assert.deepEqual(shop, after);
  shop.gold = 100; const count = shop.deck.length; assert.equal(dispatch(shop, 'remove-card', { uid: shop.deck[0].uid }).ok, true); assert.equal(shop.deck.length, count - 1); assert.equal(shop.gold, 60); assert.equal(dispatch(shop, 'remove-card', { uid: shop.deck[0].uid }).ok, false);
});
test('Events reject lethal bargains/insufficient gold and deliver a rare card', () => {
  const s = createState({ seed: 4 }); dispatch(s, 'choose-route', { id: 'path-2' }); s.hp = 8; assert.equal(dispatch(s, 'choose-event', { id: 'gift' }).ok, false); s.gold = 24; assert.equal(dispatch(s, 'choose-event', { id: 'renew' }).ok, false);
  s.hp = 20; dispatch(s, 'choose-event', { id: 'gift' }); assert.equal(s.hp, 12); assert.equal(s.gold, 49); assert.equal(CARDS[s.deck.at(-1).id].rarity, 2); assert.equal(s.floor, 2);
});
test('Boss recovery also applies when every relic is owned and the relic choice is skipped', () => {
  for (const allOwned of [false, true]) {
    const s = battle(1); s.act = 2; s.floor = 6; s.encounter = 'boss'; s.phase = 'reward'; s.hp = 20;
    s.relics = allOwned ? Object.keys(RELICS) : ['satchel'];
    assert.equal(dispatch(s, 'choose-reward', { id: 'skip' }).ok, true);
    if (!allOwned) { assert.equal(s.phase, 'relic'); const id = s.relicChoices.find(id => id !== 'crown'); assert.equal(dispatch(s, 'claim-relic', { id }).ok, true); }
    assert.equal(s.phase, 'route'); assert.equal(s.act, 3); assert.equal(s.floor, 1); assert.equal(s.hp, 42);
  }
});
test('Pause preserves every active decision and rejects actions until resumed', () => {
  for (const phase of ['route', 'battle', 'reward', 'rest', 'shop', 'event', 'relic']) { const s = createState({ seed: 1 }); s.phase = phase; const before = copy(s); assert.equal(togglePause(s), true); assert.equal(dispatch(s, 'end-turn').ok, false); assert.equal(togglePause(s), true); assert.deepEqual(s, before); }
});
test('Run death blocks further actions and a new run resets cards,resources,and relics', () => {
  const s = battle(); dummy(s); s.hp = 1; s.enemies[0].intent = { damage: 50, hits: 1 }; dispatch(s, 'end-turn'); assert.equal(s.phase, 'lost'); const before = copy(s); assert.equal(dispatch(s, 'end-turn').ok, false); assert.equal(togglePause(s), false); assert.deepEqual(s, before);
  const fresh = createState({ seed: s.seed }); assert.equal(fresh.hp, 82); assert.equal(fresh.deck.length, 10); assert.deepEqual(fresh.relics, ['satchel']); assert.equal(fresh.score, 0);
});

// This planner only inspects state and submits the same public actions as a player.
// It never changes HP,cards,route depth,enemies,rewards,or other game state.
const rank = { mend: 10, leech: 9, kindle: 9, wildfire: 8, cinder: 8, weakness: 8, riposte: 8, windfall: 7, fortress: 7, quickstep: 7, salvage: 7, insight: 6, focus: 6, brace: 6, bulwark: 6, execute: 6, pierce: 5, flurry: 5, ember: 5, cleave: 5, echo: 4, bash: 4 };
function utility(s) {
  if (s.phase === 'lost') return -1e6; if (s.phase !== 'battle') return 2000 + s.hp * 6;
  const enemy = s.enemies.reduce((n, e) => n + e.hp + Math.max(0, e.block - e.burn) * .15 - e.burn * 2, 0);
  return s.hp * 7 - enemy * 2 + s.player.strength * 9 + s.player.dexterity * 8 + s.player.thorns * 7 - s.player.poison * 10 + s.hand.length * .25;
}
function legalTurn(s) {
  let beam = [{ s: copy(s), path: [] }]; let best;
  for (let depth = 0; depth < 11; depth++) {
    const next = [];
    for (const node of beam) {
      const end = copy(node.s); if (end.phase === 'battle') dispatch(end, 'end-turn'); const value = utility(end);
      if (!best || value > best.value) best = { path: node.path, value };
      if (node.s.phase !== 'battle') continue;
      for (const c of node.s.hand) {
        if (CARDS[c.id].cost > node.s.energy) continue;
        for (let target = 0; target < (CARDS[c.id].kind === 'attack' ? node.s.enemies.length : 1); target++) {
          const trial = copy(node.s); const action = { uid: c.uid, target };
          if (dispatch(trial, 'play-card', action).ok) next.push({ s: trial, path: [...node.path, action], value: utility(trial) + trial.player.block * 1.8 + trial.energy * .8 });
        }
      }
    }
    next.sort((a, b) => b.value - a.value); beam = []; const seen = new Set();
    for (const node of next) { const key = JSON.stringify([node.s.phase, node.s.hp, node.s.player, node.s.energy, node.s.enemies, node.s.hand.map(c => c.uid)]); if (!seen.has(key)) { seen.add(key); beam.push(node); } if (beam.length >= 28) break; }
    if (!beam.length) break;
  }
  for (const payload of best.path) if (s.phase === 'battle') assert.equal(dispatch(s, 'play-card', payload).ok, true);
  if (s.phase === 'battle') assert.equal(dispatch(s, 'end-turn').ok, true);
}
function playRun(seed, difficulty = "standard", adaptive = false) {
  const s = createState({ seed, difficulty });
  const rating = id => {
    if (!adaptive) return rank[id] || 0;
    const count = s.deck.filter(c => c.id === id).length;
    if (id === 'mend') return count ? 3 : 10;
    if (id === 'leech') return count >= 2 ? 3 : 8;
    if (id === 'kindle') return count >= 3 ? 4 : 10;
    if (id === 'wildfire') return s.deck.some(c => c.id === 'kindle') ? count >= 2 ? 5 : 10 : 7;
    if (id === 'cleave') return count ? 4 : 8;
    return rank[id] || 0;
  };
  const visited = new Set(); const bosses = new Set(); let actions = 0;
  const act = (name, payload) => { actions++; assert.equal(dispatch(s, name, payload).ok, true, `${name}: ${JSON.stringify(payload)}`); };
  while (!['won', 'lost'].includes(s.phase) && actions < 1500) {
    visited.add(s.phase);
    if (s.phase === 'route') { const options = s.routeOptions; const o = options.find(o => o.kind === 'rest' && s.hp < 55) || options.find(o => o.kind === 'shop' && s.gold > 80) || options.find(o => o.kind === 'combat') || options.find(o => o.kind === 'rest') || options[0]; act('choose-route', { id: o.id }); }
    else if (s.phase === 'battle') { s.enemies.filter(e => e.id.startsWith('boss')).forEach(e => bosses.add(e.id)); legalTurn(s); actions++; }
    else if (s.phase === 'reward') { const id = [...s.rewardCards].sort((a, b) => rating(b) - rating(a))[0]; act('choose-reward', { id: s.deck.length < 18 || rating(id) > 8 ? id : 'skip' }); }
    else if (s.phase === 'relic') act('claim-relic', { id: s.relicChoices.find(id => id === 'tea') || s.relicChoices.find(id => id === 'emberglass') || s.relicChoices.find(id => id === 'buckle') || s.relicChoices[0] });
    else if (s.phase === 'rest') { if (s.hp < s.maxHp - difficultyInfo(s).restHeal + 4) act('rest', { kind: 'heal' }); else { const c = s.deck.filter(c => !c.upgraded).sort((a, b) => rating(b.id) - rating(a.id))[0]; act('rest', c ? { kind: 'upgrade', uid: c.uid } : { kind: 'heal' }); } }
    else if (s.phase === 'shop') { for (const o of s.shopOffers) { if (o.kind === 'card' && rating(o.cardId) >= 8 && s.gold >= o.cost) act('buy', { id: o.id }); if (o.kind === 'relic' && ['tea', 'emberglass', 'buckle'].includes(o.relicId) && s.gold >= o.cost) act('buy', { id: o.id }); } const c = s.deck.find(c => c.id === 'strike'); if (c && s.gold >= removalCost(s) && s.deck.length > 9) act('remove-card', { uid: c.uid }); act('leave-shop'); }
    else if (s.phase === 'event') act('choose-event', { id: s.hp > 45 ? 'gift' : s.gold >= difficultyInfo(s).renewCost ? 'renew' : 'leave' });
  }
  return { s, actions, visited, bosses };
}
test('A complete three-act run is won from real legal choices through all three distinct bosses', () => {
  const { s, actions, visited, bosses } = playRun(1); assert.equal(s.phase, 'won'); assert.equal(s.path.length, 18); assert.deepEqual([...bosses], ['boss1', 'boss2', 'boss3']); assert.ok(visited.has('shop')); assert.ok(visited.has('relic')); assert.ok(actions > 70); assert.ok(s.score > 4000); assert.ok(s.hp > 0); assert.ok(s.deck.length > 10); assert.ok(s.relics.length >= 4);
});

test('Standard remains the engine default; every tier is seeded and invalid tiers safely fall back', () => {
  assert.equal(createState({ seed: 1 }).difficulty, 'standard');
  assert.equal(createState({ seed: 1, difficulty: 'unknown' }).difficulty, 'standard');
  for (const difficulty of Object.keys(DIFFICULTIES)) {
    const first = createState({ seed: 89, difficulty }), second = createState({ seed: 89, difficulty });
    dispatch(first, 'choose-route', { id: 'path-0' }); dispatch(second, 'choose-route', { id: 'path-0' });
    assert.deepEqual(first, second); assert.equal(first.difficulty, difficulty);
    const before = copy(first); togglePause(first); assert.equal(dispatch(first, 'end-turn').ok, false); togglePause(first); assert.deepEqual(first, before);
  }
});
test('Several zero-cost Quicksteps exhaust once each and cannot form a free reshuffle/block loop', () => {
  const s = battle(); dummy(s, 1000);
  const cards = Array.from({ length: 5 }, (_, i) => ({ uid: 1000 + i, id: 'quickstep', upgraded: true }));
  s.hand = [cards[0]]; s.draw = cards.slice(1); s.discard = []; s.exhaust = [];
  const energy = s.energy;
  for (let i = 0; i < 5; i++) assert.equal(dispatch(s, 'play-card', { uid: s.hand[0].uid }).ok, true);
  assert.equal(s.hand.length, 0); assert.equal(s.exhaust.length, 5); assert.equal(s.discard.length, 0); assert.equal(s.player.block, 25); assert.equal(s.energy, energy);
  dispatch(s, 'end-turn'); assert.equal(s.hand.length, 0); assert.equal(s.player.block, 0);
  const before = copy(s); assert.equal(dispatch(s, 'play-card', { uid: cards[0].uid }).ok, false); assert.deepEqual(s, before);
});
test('Avoiding every offered fight still requires three Veteran or four Nightmare road battles before the boss', () => {
  for (const difficulty of ['standard', 'veteran', 'nightmare']) {
    const s = createState({ seed: 7, difficulty }); let decisions = 0;
    while (!(s.phase === 'route' && s.floor === 6) && decisions++ < 100) {
      if (s.phase === 'route') { const road = s.routeOptions.find(o => !['combat', 'elite', 'boss'].includes(o.kind)) || s.routeOptions.find(o => o.kind === 'combat'); assert.ok(road); dispatch(s, 'choose-route', { id: road.id }); }
      else if (s.phase === 'battle') legalTurn(s);
      else if (s.phase === 'event') dispatch(s, 'choose-event', { id: 'leave' });
      else if (s.phase === 'rest') dispatch(s, 'rest', { kind: 'heal' });
      else if (s.phase === 'shop') dispatch(s, 'leave-shop');
      else if (s.phase === 'reward') dispatch(s, 'choose-reward', { id: s.rewardCards.includes('kindle') ? 'kindle' : s.rewardCards[0] });
      else if (s.phase === 'relic') dispatch(s, 'claim-relic', { id: s.relicChoices[0] });
      else assert.fail(`Unexpected route phase ${s.phase}`);
    }
    assert.equal(s.floor, 6); assert.equal(s.roadBattles, difficultyInfo(s).roadBattles);
    assert.equal(s.path.filter(p => ['combat', 'elite'].includes(p.kind)).length, difficultyInfo(s).roadBattles);
    assert.deepEqual(s.routeOptions.map(o => o.kind), ['boss']);
  }
});
test('Veteran tactical attack/block/target choices clear openings; passive shuffling loses on the same seeds', () => {
  for (const seed of [1, 5, 12, 29]) {
    const active = createState({ seed, difficulty: 'veteran' }); dispatch(active, 'choose-route', { id: 'path-0' });
    const passive = copy(active); let turns = 0;
    while (active.phase === 'battle' && turns++ < 25) legalTurn(active);
    assert.equal(active.phase, 'reward'); assert.ok(active.hp > 0);
    turns = 0;
    while (passive.phase === 'battle' && turns++ < 80) {
      for (const c of [...passive.hand]) if (['guard', 'quickstep', 'mend', 'insight', 'brace', 'fortress', 'salvage', 'windfall'].includes(c.id) && CARDS[c.id].cost <= passive.energy) dispatch(passive, 'play-card', { uid: c.uid });
      dispatch(passive, 'end-turn');
    }
    assert.equal(passive.phase, 'lost'); assert.equal(passive.hp, 0);
  }
});
test('Enemies gain announced strength on the tier’s exact prolonged-fight turns, without changing Standard', () => {
  for (const difficulty of ['standard', 'veteran', 'nightmare']) {
    const s = createState({ seed: 2, difficulty }); dispatch(s, 'choose-route', { id: 'path-0' });
    dummy(s, 1000); const enemy = s.enemies[0]; s.hp = 1000; s.maxHp = 1000;
    const initial = enemy.strength;
    dispatch(s, 'end-turn'); assert.equal(s.turn, 2); assert.equal(enemy.strength, initial);
    dispatch(s, 'end-turn'); assert.equal(enemy.strength, initial + (difficulty === 'nightmare' ? 1 : 0));
    dispatch(s, 'end-turn'); assert.equal(s.turn, 4); assert.equal(enemy.strength, initial + (difficulty === 'standard' ? 0 : 1));
    // This fixture is an imp, so its pattern never grants strength itself.
    assert.equal(enemy.id, 'sprig');
    dispatch(s, 'end-turn'); dispatch(s, 'end-turn');
    assert.equal(enemy.strength, initial + (difficulty === 'standard' ? 0 : 2));
  }
});
function bossFixture(difficulty, act) {
  const s = createState({ seed: 1, difficulty }); s.act = act; s.floor = 6;
  s.routeOptions = [{ id: 'boss', kind: 'boss', title: 'Gatekeeper fixture' }];
  assert.equal(dispatch(s, 'choose-route', { id: 'boss' }).ok, true); return s;
}
test('Mosswarden visibly announces temporary thorns; block absorbs each hit and burn bypasses retaliation', () => {
  const s = bossFixture('veteran', 1); s.player.block = 100; dispatch(s, 'end-turn');
  assert.equal(s.enemies[0].intent.thorns, 2); dispatch(s, 'end-turn'); assert.equal(s.enemies[0].thorns, 2);
  s.enemies[0].block = 0; s.player.block = 4; const hp = s.hp; cast(s, 'flurry'); assert.equal(s.hp, hp - 2); assert.equal(s.player.block, 0);
  s.enemies[0].burn = 8; s.player.block = 100; dispatch(s, 'end-turn'); assert.equal(s.enemies[0].thorns, 0); assert.equal(s.hp, hp - 2);
});
test('Curator burn cleansing is telegraphed and occurs after burn damage, preserving burn as a viable build', () => {
  const s = bossFixture('nightmare', 2), enemy = s.enemies[0]; assert.equal(enemy.intent.cleanseBurn, 6);
  enemy.burn = 12; const hp = enemy.hp; dispatch(s, 'end-turn'); assert.equal(enemy.hp, hp - 12); assert.equal(enemy.burn, 5);
  const standard = bossFixture('standard', 2); assert.equal(standard.enemies[0].intent.cleanseBurn, undefined);
});
test('Regent frail survives its application turn, reduces card and relic block, then decays', () => {
  const s = bossFixture('veteran', 3); assert.equal(s.enemies[0].intent.frail, 2); s.relics.push('buckle');
  dispatch(s, 'end-turn'); assert.equal(s.player.frail, 2); s.player.dexterity = 2;
  cast(s, 'guard'); assert.equal(s.player.block, 8); // floor((6+2)*.75) + floor(3*.75)
  dispatch(s, 'end-turn'); assert.equal(s.player.frail, 1); dispatch(s, 'end-turn'); assert.equal(s.player.frail, 0);
});
test('A lethal thorn counter cannot be reversed by Crimson Pact healing', () => {
  const s = battle(); dummy(s); s.enemies[0].thorns = 5; s.hp = 1; cast(s, 'leech'); assert.equal(s.phase, 'lost'); assert.equal(s.hp, 0);
});
test('Later multihit and area attacks stop after a lethal thorn counter, without posthumous kill renown', () => {
  const flurry = battle(); dummy(flurry, 7); flurry.enemies[0].thorns = 1; flurry.hp = 1; const score = flurry.score;
  cast(flurry, 'flurry'); assert.equal(flurry.phase, 'lost'); assert.equal(flurry.enemies[0].hp, 4); assert.equal(flurry.score, score);
  const area = battle(); dummy(area, 15); area.enemies[0].thorns = 1; area.enemies.push({ ...copy(area.enemies[0]), hp: 5 }); area.hp = 1;
  cast(area, 'cleave'); assert.equal(area.phase, 'lost'); assert.deepEqual(area.enemies.map(e => e.hp), [6, 5]);
});
test('Displayed intent includes player vulnerability with the same two rounding steps as actual damage', () => {
  const s = battle(); dummy(s); s.enemies[0].intent = { damage: 10, hits: 2 }; s.enemies[0].weak = 2; s.player.vulnerable = 2;
  assert.equal(intentDamage(s.enemies[0]), 7); assert.equal(intentDamage(s.enemies[0], s.player), 10);
  const hp = s.hp; dispatch(s, 'end-turn'); assert.equal(s.hp, hp - 20);
});
test('Later enemy intent anticipates earlier vulnerability, unless burn or retaliatory thorns prevents the debuff', () => {
  const s = battle(); dummy(s); const first = s.enemies[0]; first.intent = { damage: 4, hits: 1, vulnerable: 2 };
  s.enemies.push({ ...copy(first), intent: { damage: 6, hits: 1 } });
  assert.deepEqual(s.enemies.map((_, i) => intentDamageAt(s, i)), [4, 9]);
  const hp = s.hp; const actual = copy(s); dispatch(actual, 'end-turn'); assert.equal(actual.hp, hp - 13);
  first.burn = first.hp; assert.equal(intentDamageAt(s, 1), 6);
  first.burn = 0; s.player.thorns = first.hp; assert.equal(intentDamageAt(s, 1), 6);
});
test('Harder recovery and removal prices match their visible profile, including no-choice boss relic rewards', () => {
  for (const difficulty of Object.keys(DIFFICULTIES)) {
    const s = createState({ seed: 1, difficulty }), d = difficultyInfo(s);
    assert.equal(relicInfo('tea', s).text, `Heal ${d.teaHeal} HP after every battle.`);
    dispatch(s, 'choose-route', { id: 'path-2' }); s.hp = 40; const gold = s.gold;
    assert.ok(s.event.choices[0].text.includes(`Lose ${d.giftHp} HP`));
    dispatch(s, 'choose-event', { id: 'renew' }); assert.equal(s.hp, 40 + d.renewHeal); assert.equal(s.gold, gold - d.renewCost);
    // Recovery amounts are independent of route admission, tested above.
    s.phase = 'rest'; s.hp = 20; dispatch(s, 'rest', { kind: 'heal' }); assert.equal(s.hp, 20 + d.restHeal);
    s.phase = 'shop'; s.gold = 500; s.shopRemoved = false; const cost = removalCost(s);
    dispatch(s, 'remove-card', { uid: s.deck[0].uid }); assert.equal(s.gold, 500 - cost); assert.equal(removalCost(s), cost + d.removalStep);
    s.phase = 'reward'; s.encounter = 'boss'; s.floor = 6; s.hp = 20; s.relics = Object.keys(RELICS); s.roadBattles = d.roadBattles;
    dispatch(s, 'choose-reward', { id: 'skip' }); assert.equal(s.hp, 20 + d.bossHeal); assert.equal(s.act, 2); assert.equal(s.roadBattles, 0);
  }
});
test('Veteran and Nightmare both allow a complete legal three-boss run with meaningful deck growth and required battles', () => {
  for (const [difficulty, seed] of [['veteran', 1], ['nightmare', 9]]) {
    const { s, bosses, visited } = playRun(seed, difficulty); assert.equal(s.phase, 'won'); assert.ok(s.hp > 0); assert.equal(s.path.length, 18);
    assert.deepEqual([...bosses], ['boss1', 'boss2', 'boss3']); assert.ok(s.deck.length > 10); assert.ok(visited.has('shop')); assert.ok(s.relics.length >= 3);
    for (let act = 1; act <= 3; act++) assert.ok(s.path.filter(p => p.act === act && ['combat', 'elite'].includes(p.kind)).length >= DIFFICULTIES[difficulty].roadBattles);
    assert.equal(s.difficulty, difficulty);
  }
});

test('Challenge records have new scopes while Standard renown remains compatible', () => {
  assert.equal(recordScope(createState()), 'default');
  assert.equal(recordScope(createState({ difficulty: 'veteran' })), 'veteran-v3');
  assert.equal(recordScope(createState({ difficulty: 'nightmare' })), 'nightmare-v3');
});

test('Later roads guarantee complementary foes and honest support shields, with unchanged enemy HP scales', () => {
  for (const difficulty of ['veteran', 'nightmare']) {
    const rules = DIFFICULTIES[difficulty]; let shieldFixture;
    for (let seed = 1; seed <= 20; seed++) {
      const s = createState({ seed, difficulty }); s.act = 2; s.floor = rules.pairFloor;
      s.routeOptions = [{ id: 'road', kind: 'combat' }]; dispatch(s, 'choose-route', { id: 'road' });
      assert.equal(s.enemies.length, 2);
      assert.notEqual(s.enemies[0].id, s.enemies[1].id);
      assert.equal(s.enemies[0].maxHp, Math.round(({sentinel:35,hexer:30,hunter:42})[s.enemies[0].id] * 1.22 * rules.hpScale));
      if (s.enemies[0].id === 'sentinel' && s.enemies[0].intent.allyBlock) shieldFixture = s;
    }
    assert.ok(shieldFixture, 'a real generated guard opening is covered');
    const support = shieldFixture.enemies[0], ally = shieldFixture.enemies[1];
    assert.equal(support.intent.allyBlock, rules.allyBlock);
    const removed = copy(shieldFixture); removed.enemies[0].burn = removed.enemies[0].hp;
    shieldFixture.player.block = 100; dispatch(shieldFixture, 'end-turn');
    assert.equal(ally.block, rules.allyBlock, 'the later ally keeps its formation shield after acting');
    removed.player.block = 100; dispatch(removed, 'end-turn');
    assert.equal(removed.enemies[0].hp, 0); assert.equal(removed.enemies[1].block, 0, 'killing the support before its intent prevents the shield');
  }
  const standard = createState({ seed: 1 }); dispatch(standard, 'choose-route', { id: 'path-0' });
  assert.equal(standard.enemies.length, 1);
});

test('Card healing uses the announced finite battle reserve, consumes only recovered HP, and leaves rests separate', () => {
  for (const difficulty of ['standard', 'veteran', 'nightmare']) {
    const s = createState({ seed: 1, difficulty }); dispatch(s, 'choose-route', { id: 'path-0' }); dummy(s, 1000);
    cast(s, 'leech', true); assert.equal(s.recoveryUsed, 0, 'full-health casts do not spend the reserve');
    s.hp = 20;
    for (let castIndex = 0; castIndex < 5; castIndex++) cast(s, 'leech', true);
    const recovered = difficultyInfo(s).recoveryLimit ?? 30;
    assert.equal(s.hp, 20 + recovered);
    assert.equal(recoveryRemaining(s), difficulty === 'standard' ? null : 0);
    if (difficulty !== 'standard') {
      assert.match(cardInfo({ id: 'mend', upgraded: true }, s).text, /Heal up to 0 HP/);
      const hp = s.hp; cast(s, 'mend', true); assert.equal(s.hp, hp); assert.equal(s.player.block, 7, 'exhausted recovery does not remove the card’s defensive value');
      s.phase = 'rest'; dispatch(s, 'rest', { kind: 'heal' }); assert.equal(s.hp, hp + difficultyInfo(s).restHeal);
      s.phase = 'route'; s.routeOptions = [{ id: 'next', kind: 'combat' }]; dispatch(s, 'choose-route', { id: 'next' });
      assert.equal(recoveryRemaining(s), difficultyInfo(s).recoveryLimit, 'the next encounter replenishes the allowance');
    }
  }
});

test('Long fights escalate beyond the first strength pulse rather than sustaining a permanent heal/block loop', () => {
  for (const difficulty of ['veteran', 'nightmare']) {
    const s = createState({ seed: 2, difficulty }); dispatch(s, 'choose-route', { id: 'path-0' }); dummy(s, 10000);
    s.enemies[0].id = 'sprig'; s.enemies[0].intent = { kind: 'guard', block: 0 }; s.hp = s.maxHp = 10000;
    let expected = s.enemies[0].strength;
    while (s.turn < 14) {
      expected += pressureStrength(s, s.turn + 1); dispatch(s, 'end-turn');
      assert.equal(s.enemies[0].strength, expected);
    }
    const rules = difficultyInfo(s);
    assert.equal(pressureStrength(s, rules.pressureTurn), 1);
    assert.equal(pressureStrength(s, rules.pressureTurn + rules.pressureEvery * 3), 2);
    assert.equal(pressureStrength(s, rules.pressureTurn + rules.pressureEvery * 6), 3);
  }
});

test('The conservative recovery-first planner now fails difficult roads that adaptive deck decisions must solve', () => {
  for (const [difficulty, seed, ending] of [['veteran', 29, [2,6]], ['nightmare', 1, [2,6]]]) {
    const { s } = playRun(seed, difficulty);
    assert.equal(s.phase, 'lost'); assert.deepEqual([s.act, s.floor], ending);
  }
  const adaptive = playRun(29, 'veteran', true).s;
  assert.equal(adaptive.phase, 'won'); assert.equal(adaptive.hp, 46);
  assert.ok(adaptive.deck.some(c => c.id === 'weakness') && adaptive.deck.some(c => c.id === 'riposte'));
  assert.ok(!adaptive.deck.some(c => ['kindle', 'wildfire'].includes(c.id)), 'a defensive/debuff road remains viable without the burn-scaling combo');
  const burn = playRun(5, 'veteran', true).s;
  assert.equal(burn.phase, 'won'); assert.ok(burn.deck.some(c => c.id === 'kindle') && burn.deck.some(c => c.id === 'wildfire'));
});
