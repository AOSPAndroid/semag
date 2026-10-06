import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTS, CARDS, RELICS, createState, dispatch, togglePause, cardInfo, intentDamage } from '../public/solo/deckbound-engine.js';
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
function playRun(seed) {
  const s = createState({ seed }); const visited = new Set(); const bosses = new Set(); let actions = 0;
  const act = (name, payload) => { actions++; assert.equal(dispatch(s, name, payload).ok, true, `${name}: ${JSON.stringify(payload)}`); };
  while (!['won', 'lost'].includes(s.phase) && actions < 1500) {
    visited.add(s.phase);
    if (s.phase === 'route') { const options = s.routeOptions; const o = options.find(o => o.kind === 'rest' && s.hp < 55) || options.find(o => o.kind === 'shop' && s.gold > 80) || options.find(o => o.kind === 'combat') || options.find(o => o.kind === 'rest') || options[0]; act('choose-route', { id: o.id }); }
    else if (s.phase === 'battle') { s.enemies.filter(e => e.id.startsWith('boss')).forEach(e => bosses.add(e.id)); legalTurn(s); actions++; }
    else if (s.phase === 'reward') { const id = [...s.rewardCards].sort((a, b) => (rank[b] || 0) - (rank[a] || 0))[0]; act('choose-reward', { id: s.deck.length < 18 || rank[id] > 8 ? id : 'skip' }); }
    else if (s.phase === 'relic') act('claim-relic', { id: s.relicChoices.find(id => id === 'tea') || s.relicChoices.find(id => id === 'emberglass') || s.relicChoices.find(id => id === 'buckle') || s.relicChoices[0] });
    else if (s.phase === 'rest') { if (s.hp < s.maxHp - 17) act('rest', { kind: 'heal' }); else { const c = s.deck.filter(c => !c.upgraded).sort((a, b) => (rank[b.id] || 0) - (rank[a.id] || 0))[0]; act('rest', c ? { kind: 'upgrade', uid: c.uid } : { kind: 'heal' }); } }
    else if (s.phase === 'shop') { for (const o of s.shopOffers) { if (o.kind === 'card' && (rank[o.cardId] || 0) >= 8 && s.gold >= o.cost) act('buy', { id: o.id }); if (o.kind === 'relic' && ['tea', 'emberglass', 'buckle'].includes(o.relicId) && s.gold >= o.cost) act('buy', { id: o.id }); } const c = s.deck.find(c => c.id === 'strike'); if (c && s.gold >= 40 && s.deck.length > 9) act('remove-card', { uid: c.uid }); act('leave-shop'); }
    else if (s.phase === 'event') act('choose-event', { id: s.hp > 45 ? 'gift' : s.gold > 25 ? 'renew' : 'leave' });
  }
  return { s, actions, visited, bosses };
}
test('A complete three-act run is won from real legal choices through all three distinct bosses', () => {
  const { s, actions, visited, bosses } = playRun(1); assert.equal(s.phase, 'won'); assert.equal(s.path.length, 18); assert.deepEqual([...bosses], ['boss1', 'boss2', 'boss3']); assert.ok(visited.has('shop')); assert.ok(visited.has('relic')); assert.ok(actions > 70); assert.ok(s.score > 4000); assert.ok(s.hp > 0); assert.ok(s.deck.length > 10); assert.ok(s.relics.length >= 4);
});
