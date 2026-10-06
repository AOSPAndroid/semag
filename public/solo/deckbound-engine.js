/** Deckbound: deterministic, turn-based deck roguelike. No clock or DOM dependency. */
export const ACTS = ['The Moss Road', 'The Brass Archive', 'The Hollow Crown'];
export const CARDS = Object.freeze({
  strike: { name: 'Wayfarer’s Cut', cost: 1, kind: 'attack', rarity: 0, text: 'Deal 7 damage.', upgraded: 'Deal 10 damage.', art: 'sword' },
  guard: { name: 'Oak Guard', cost: 1, kind: 'skill', rarity: 0, text: 'Gain 6 block.', upgraded: 'Gain 9 block.', art: 'shield' },
  ember: { name: 'Ember Thread', cost: 1, kind: 'attack', rarity: 1, text: 'Deal 4 damage. Apply 3 burn.', upgraded: 'Deal 6 damage. Apply 4 burn.', art: 'flame' },
  quickstep: { name: 'Quickstep', cost: 0, kind: 'skill', rarity: 1, text: 'Gain 3 block. Draw 1 card.', upgraded: 'Gain 5 block. Draw 1 card.', art: 'boot' },
  cleave: { name: 'Crescent Sweep', cost: 1, kind: 'attack', rarity: 1, text: 'Deal 9 damage to every enemy.', upgraded: 'Deal 12 damage to every enemy.', art: 'axe' },
  pierce: { name: 'Needlepoint', cost: 1, kind: 'attack', rarity: 1, text: 'Deal 11 damage, ignoring block.', upgraded: 'Deal 15 damage, ignoring block.', art: 'arrow' },
  bash: { name: 'Bell Ringer', cost: 2, kind: 'attack', rarity: 1, text: 'Deal 12 damage. Apply 2 vulnerable.', upgraded: 'Deal 16 damage. Apply 3 vulnerable.', art: 'hammer' },
  riposte: { name: 'Briar Riposte', cost: 1, kind: 'attack', rarity: 1, text: 'Gain 5 block. Deal 5 + half your block as damage.', upgraded: 'Gain 8 block. Deal 8 + half your block as damage.', art: 'thorn' },
  fortress: { name: 'Living Fortress', cost: 2, kind: 'skill', rarity: 2, text: 'Gain 18 block. Keep half your remaining block next turn.', upgraded: 'Gain 24 block. Keep half your remaining block next turn.', art: 'castle' },
  focus: { name: 'Tempered Edge', cost: 1, kind: 'power', rarity: 1, exhaust: true, text: 'Gain 2 strength this battle. Exhaust.', upgraded: 'Gain 3 strength this battle. Exhaust.', art: 'forge' },
  brace: { name: 'Rooted Stance', cost: 1, kind: 'power', rarity: 1, exhaust: true, text: 'Gain 2 dexterity this battle. Exhaust.', upgraded: 'Gain 3 dexterity this battle. Exhaust.', art: 'root' },
  flurry: { name: 'Threefold Cut', cost: 1, kind: 'attack', rarity: 1, text: 'Deal 3 damage three times.', upgraded: 'Deal 4 damage three times.', art: 'blades' },
  kindle: { name: 'Kindling', cost: 1, kind: 'attack', rarity: 1, text: 'Apply 7 burn.', upgraded: 'Apply 10 burn.', art: 'lantern' },
  wildfire: { name: 'Wildfire', cost: 2, kind: 'attack', rarity: 2, text: 'Deal 9 damage. Double the target’s burn.', upgraded: 'Deal 14 damage. Double the target’s burn.', art: 'phoenix' },
  leech: { name: 'Crimson Pact', cost: 2, kind: 'attack', rarity: 2, text: 'Deal 15 damage. Heal 4 HP if unblocked damage is dealt.', upgraded: 'Deal 20 damage. Heal 6 HP if unblocked damage is dealt.', art: 'heart' },
  insight: { name: 'Far Sight', cost: 0, kind: 'skill', rarity: 1, exhaust: true, text: 'Draw 2 cards. Exhaust.', upgraded: 'Draw 3 cards. Exhaust.', art: 'eye' },
  salvage: { name: 'Brass Salvage', cost: 0, kind: 'skill', rarity: 1, exhaust: true, text: 'Gain 1 energy. Draw 1 card. Exhaust.', upgraded: 'Gain 2 energy. Draw 1 card. Exhaust.', art: 'gear' },
  weakness: { name: 'Dimming Hex', cost: 1, kind: 'attack', rarity: 1, text: 'Deal 5 damage. Apply 2 weak.', upgraded: 'Deal 8 damage. Apply 3 weak.', art: 'moon' },
  bulwark: { name: 'Thorn Mantle', cost: 1, kind: 'skill', rarity: 2, exhaust: true, text: 'Gain 7 block and 3 thorns this battle. Exhaust.', upgraded: 'Gain 10 block and 5 thorns this battle. Exhaust.', art: 'mantle' },
  execute: { name: 'Last Light', cost: 2, kind: 'attack', rarity: 2, text: 'Deal 19 damage; 30 if the target has half HP or less.', upgraded: 'Deal 25 damage; 40 if the target has half HP or less.', art: 'sun' },
  windfall: { name: 'Second Wind', cost: 1, kind: 'skill', rarity: 2, text: 'Gain 9 block. Draw 2 cards.', upgraded: 'Gain 12 block. Draw 2 cards.', art: 'wind' },
  cinder: { name: 'Cinder Choir', cost: 2, kind: 'attack', rarity: 2, text: 'Apply 6 burn to every enemy. Gain 8 block.', upgraded: 'Apply 9 burn to every enemy. Gain 11 block.', art: 'choir' },
  echo: { name: 'Echo Blade', cost: 1, kind: 'attack', rarity: 2, text: 'Deal 6 + 3 damage for each exhausted card this battle.', upgraded: 'Deal 9 + 4 damage for each exhausted card this battle.', art: 'echo' },
  mend: { name: 'Green Renewal', cost: 1, kind: 'skill', rarity: 2, exhaust: true, text: 'Heal 7 HP. Gain 4 block. Exhaust.', upgraded: 'Heal 10 HP. Gain 7 block. Exhaust.', art: 'leaf' },
});
export const RELICS = Object.freeze({
  emberglass: { name: 'Emberglass', text: 'Whenever you apply burn, apply 2 more.', art: 'flame' },
  whetstone: { name: 'Old Whetstone', text: 'Start each battle with 1 strength.', art: 'sword' },
  satchel: { name: 'Traveller’s Satchel', text: 'Draw 1 extra card on the first turn.', art: 'bag' },
  tea: { name: 'Evergreen Tea', text: 'Heal 5 HP after every battle.', art: 'leaf' },
  buckle: { name: 'Brass Buckle', text: 'The first skill you play each turn grants 3 extra block.', art: 'shield' },
  lantern: { name: 'Soul Lantern', text: 'The first card you exhaust each turn grants 1 energy.', art: 'lantern' },
  crown: { name: 'Small Crown', text: 'Start each battle with 1 dexterity. Gain 10 maximum HP.', art: 'crown' },
  coin: { name: 'Fox Coin', text: 'Earn 12 extra gold after every battle.', art: 'coin' },
});
const ACTIVE = new Set(['route', 'battle', 'reward', 'rest', 'shop', 'event', 'relic']);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function rng(s) { let n = s.rng >>> 0; n ^= n << 13; n ^= n >>> 17; n ^= n << 5; s.rng = n >>> 0; return s.rng / 4294967296; }
function shuffle(s, a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng(s) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function sample(s, a, n) { return shuffle(s, [...a]).slice(0, n); }
function card(s, id, upgraded = false) { return { uid: s.nextCard++, id, upgraded }; }
function note(s, text) { s.message = text; s.log.push(text); if (s.log.length > 30) s.log.shift(); }
const has = (s, id) => s.relics.includes(id);
export function cardInfo(c) { const def = CARDS[c?.id]; return def ? { ...def, name: def.name + (c.upgraded ? ' +' : ''), text: c.upgraded ? def.upgraded : def.text } : null; }
function routeOptions(s) {
  if (s.floor === 6) return [{ id: 'boss', kind: 'boss', title: ['The Mosswarden', 'The Clockwork Curator', 'The Hollow Regent'][s.act - 1], text: 'The gatekeeper awaits. A relic lies beyond.' }];
  const rows = [
    ['combat', 'combat', 'event'], ['combat', 'rest', 'shop'], ['elite', 'combat', 'event'], ['shop', 'rest', 'combat'], ['elite', 'combat', 'rest'],
  ];
  const names = { combat: ['Mosslit Crossing', 'Lantern Watch', 'The Broken Stair'], elite: ['The Unquiet Grove', 'Brassbound Sentinel', 'The Crown’s Hound'], rest: ['Wayside Hearth', 'The Quiet Alcove', 'Last Shelter'], shop: ['The Travelling Market', 'A Collector’s Stall', 'The Last Merchant'], event: ['A Sealed Well', 'The Scribe’s Table', 'A Wishing Tree'] };
  return rows[s.floor - 1].map((kind, i) => ({ id: `path-${i}`, kind, title: names[kind][(s.act + i - 1) % 3], text: { combat: 'Card reward · gold', elite: 'Hard battle · card + relic', rest: 'Heal or upgrade a card', shop: 'Buy cards · remove a card', event: 'A choice with a cost' }[kind] }));
}
export function createState({ seed = Date.now() } = {}) {
  const numeric = typeof seed === 'number' ? seed : [...String(seed)].reduce((n, c) => (Math.imul(n, 31) + c.charCodeAt(0)) >>> 0, 2166136261);
  const s = { gameId: 'deckbound', seed: numeric >>> 0, rng: (numeric >>> 0) || 0x9e3779b9, phase: 'route', pausedPhase: null,
    act: 1, floor: 1, score: 0, gold: 65, nextCard: 1, hp: 82, maxHp: 82, deck: [], relics: ['satchel'], path: [],
    routeOptions: [], hand: [], draw: [], discard: [], exhaust: [], enemies: [], energy: 0, turn: 0,
    player: { block: 0, strength: 0, dexterity: 0, weak: 0, vulnerable: 0, poison: 0, thorns: 0, retain: false },
    rewardCards: [], relicChoices: [], shopOffers: [], shopRemoved: false, event: null, encounter: null, log: [], message: '', result: null };
  for (const id of ['strike', 'strike', 'strike', 'strike', 'guard', 'guard', 'guard', 'guard', 'ember', 'quickstep']) s.deck.push(card(s, id));
  s.routeOptions = routeOptions(s); note(s, 'Choose a road. Read the enemy’s intent before spending your energy.'); return s;
}
function drawCards(s, amount) {
  for (let i = 0; i < amount && s.hand.length < 10; i++) {
    if (!s.draw.length && s.discard.length) { s.draw = shuffle(s, s.discard); s.discard = []; }
    if (!s.draw.length) break;
    s.hand.push(s.draw.pop());
  }
}
const PATTERNS = {
  sprig: { name: 'Briar Imp', hp: 24, art: 'imp', intents: [{ kind: 'attack', damage: 6, hits: 1, label: 'Briar jab' }, { kind: 'guard', block: 7, label: 'Curl up' }, { kind: 'attack', damage: 4, hits: 2, label: 'Twin thorns' }] },
  moth: { name: 'Ash Moth', hp: 28, art: 'moth', intents: [{ kind: 'debuff', weak: 2, damage: 3, hits: 1, label: 'Dust veil' }, { kind: 'attack', damage: 10, hits: 1, label: 'Searing dive' }, { kind: 'attack', damage: 6, hits: 1, label: 'Wing cut' }] },
  sentinel: { name: 'Brass Sentinel', hp: 35, art: 'sentinel', intents: [{ kind: 'guard', block: 12, strength: 1, label: 'Wind the gears' }, { kind: 'attack', damage: 12, hits: 1, label: 'Hammerfall' }, { kind: 'attack', damage: 5, hits: 2, label: 'Gear teeth' }] },
  hexer: { name: 'Hollow Scribe', hp: 30, art: 'scribe', intents: [{ kind: 'debuff', poison: 3, label: 'Bitter ink' }, { kind: 'attack', damage: 9, hits: 1, label: 'Quill strike' }, { kind: 'debuff', vulnerable: 2, damage: 4, hits: 1, label: 'Expose a seam' }] },
  hunter: { name: 'Crown Hound', hp: 42, art: 'hound', intents: [{ kind: 'attack', damage: 5, hits: 2, label: 'Double bite' }, { kind: 'buff', strength: 2, label: 'Hunting howl' }, { kind: 'attack', damage: 15, hits: 1, label: 'Pounce' }] },
  giant: { name: 'Stone Pilgrim', hp: 63, art: 'giant', intents: [{ kind: 'guard', block: 14, label: 'Stone skin' }, { kind: 'attack', damage: 19, hits: 1, label: 'Falling monolith' }, { kind: 'debuff', weak: 2, damage: 8, hits: 1, label: 'Grinding dust' }] },
  boss1: { name: 'The Mosswarden', hp: 98, art: 'warden', intents: [{ kind: 'attack', damage: 7, hits: 2, label: 'Branch lash' }, { kind: 'guard', block: 14, strength: 1, label: 'Root the grove' }, { kind: 'debuff', weak: 2, damage: 15, hits: 1, label: 'Autumn’s weight' }, { kind: 'attack', damage: 7, hits: 3, label: 'Thornstorm' }] },
  boss2: { name: 'The Clockwork Curator', hp: 142, art: 'curator', intents: [{ kind: 'guard', block: 18, strength: 1, label: 'Recalibration' }, { kind: 'attack', damage: 6, hits: 3, label: 'Three hands' }, { kind: 'debuff', vulnerable: 2, damage: 10, hits: 1, label: 'Measure the flaw' }, { kind: 'attack', damage: 23, hits: 1, label: 'Midnight bell' }] },
  boss3: { name: 'The Hollow Regent', hp: 186, art: 'regent', intents: [{ kind: 'debuff', poison: 3, damage: 12, hits: 1, label: 'Royal decree' }, { kind: 'attack', damage: 8, hits: 3, label: 'Crown of blades' }, { kind: 'guard', block: 22, strength: 2, label: 'Claim the throne' }, { kind: 'attack', damage: 28, hits: 1, label: 'Last judgement' }] },
};
export const ENEMIES = Object.freeze(PATTERNS);
function makeEnemy(s, id, elite = false) {
  const def = PATTERNS[id]; const scale = id.startsWith('boss') ? 1 : 1 + .22 * (s.act - 1) + (elite ? .22 : 0);
  const hp = Math.round(def.hp * scale);
  const e = { id, name: def.name, art: def.art, hp, maxHp: hp, block: 0, strength: s.act - 1, burn: 0, weak: 0, vulnerable: 0, step: 0, intent: null };
  e.intent = { ...def.intents[0] }; return e;
}
export function intentDamage(e) { const base = (e.intent?.damage || 0) + e.strength; return Math.max(0, Math.floor(base * (e.weak > 0 ? .75 : 1))); }
function beginBattle(s, kind) {
  s.phase = 'battle'; s.encounter = kind; s.hand = []; s.discard = []; s.exhaust = []; s.draw = shuffle(s, s.deck.map(c => ({ ...c })));
  s.player = { block: 0, strength: has(s, 'whetstone') ? 1 : 0, dexterity: has(s, 'crown') ? 1 : 0, weak: 0, vulnerable: 0, poison: 0, thorns: 0, retain: false };
  const ordinary = [['sprig', 'moth', 'sentinel'], ['sentinel', 'hexer', 'hunter'], ['hunter', 'hexer', 'sentinel']][s.act - 1];
  if (kind === 'boss') s.enemies = [makeEnemy(s, `boss${s.act}`)];
  else if (kind === 'elite') s.enemies = [makeEnemy(s, s.act === 1 ? 'giant' : 'hunter', true), ...(s.act > 1 ? [makeEnemy(s, 'sprig')] : [])];
  else { const id = ordinary[Math.floor(rng(s) * ordinary.length)]; s.enemies = [makeEnemy(s, id), ...(s.floor >= 3 && rng(s) < .45 ? [makeEnemy(s, 'sprig')] : [])]; }
  s.turn = 0; startTurn(s); note(s, `${kind === 'boss' ? 'Gatekeeper' : kind === 'elite' ? 'Elite encounter' : 'Encounter'}: ${s.enemies.map(e => e.name).join(' & ')}.`);
}
function startTurn(s) {
  s.turn++; s.energy = 3; s.player.block = s.player.retain ? Math.floor(s.player.block / 2) : 0; s.player.retain = false;
  s.skillRelicUsed = false; s.exhaustRelicUsed = false;
  drawCards(s, 5 + (s.turn === 1 && has(s, 'satchel') ? 1 : 0));
}
function heal(s, amount) { s.hp = Math.min(s.maxHp, s.hp + amount); }
function gainBlock(s, amount) { s.player.block += Math.max(0, amount + s.player.dexterity); }
function damageEnemy(s, e, amount, { ignoreBlock = false, raw = false } = {}) {
  if (!e || e.hp <= 0) return 0;
  let value = raw ? amount : Math.floor((amount + s.player.strength) * (s.player.weak > 0 ? .75 : 1) * (e.vulnerable > 0 ? 1.5 : 1));
  value = Math.max(0, value);
  const blocked = ignoreBlock ? 0 : Math.min(e.block, value); e.block -= blocked;
  const dealt = Math.min(e.hp, value - blocked); e.hp -= dealt; if (!e.hp) s.score += e.id.startsWith('boss') ? 500 : 100; return dealt;
}
function burn(s, e, amount) { if (e.hp > 0) e.burn += amount + (has(s, 'emberglass') ? 2 : 0); }
function hitPlayer(s, amount) {
  const value = Math.max(0, Math.floor(amount * (s.player.vulnerable > 0 ? 1.5 : 1)));
  const blocked = Math.min(s.player.block, value); s.player.block -= blocked; s.hp = Math.max(0, s.hp - value + blocked);
}
function advance(s) {
  s.floor++; if (s.floor > 6) { s.act++; s.floor = 1; }
  if (s.act > 3) { s.phase = 'won'; s.score += 1500 + s.hp * 5 + s.gold; s.result = 'The Hollow Crown is quiet. Your road is complete.'; note(s, s.result); return; }
  s.phase = 'route'; s.routeOptions = routeOptions(s); note(s, `Choose your next road through ${ACTS[s.act - 1]}.`);
}
function finishBattle(s) {
  if (s.hp <= 0) { s.phase = 'lost'; s.result = `Your road ended in ${ACTS[s.act - 1]}, encounter ${s.floor}.`; note(s, s.result); return true; }
  if (s.enemies.some(e => e.hp > 0)) return false;
  const amount = (s.encounter === 'boss' ? 65 : s.encounter === 'elite' ? 38 : 24) + (has(s, 'coin') ? 12 : 0);
  s.gold += amount; s.score += 40 + s.act * 15; if (has(s, 'tea')) heal(s, 5);
  s.rewardCards = sample(s, Object.keys(CARDS).filter(id => CARDS[id].rarity > 0), 3);
  s.phase = 'reward'; note(s, `Victory. +${amount} gold. Take one card, or keep your deck lean.`); return true;
}
function completeRelicEncounter(s) {
  if (s.encounter === 'boss') heal(s, 22);
  advance(s);
}
function relicReward(s) {
  s.relicChoices = sample(s, Object.keys(RELICS).filter(id => !has(s, id)), 3);
  if (!s.relicChoices.length) return completeRelicEncounter(s);
  s.phase = 'relic'; note(s, 'Choose one relic. Its effect lasts for the rest of this run.');
}
function play(s, uid, target = 0) {
  const index = s.hand.findIndex(c => c.uid === uid); if (index < 0) return { ok: false, error: 'That card is not in your hand.' };
  const c = s.hand[index]; const def = CARDS[c.id];
  if (s.energy < def.cost) return { ok: false, error: 'Not enough energy.' };
  const e = s.enemies[target]; if (def.kind === 'attack' && (!Number.isInteger(target) || !e || e.hp <= 0)) return { ok: false, error: 'Choose a living enemy.' };
  s.energy -= def.cost; s.hand.splice(index, 1); const up = c.upgraded;
  switch (c.id) {
    case 'strike': damageEnemy(s, e, up ? 10 : 7); break;
    case 'guard': gainBlock(s, up ? 9 : 6); break;
    case 'ember': damageEnemy(s, e, up ? 6 : 4); burn(s, e, up ? 4 : 3); break;
    case 'quickstep': gainBlock(s, up ? 5 : 3); drawCards(s, 1); break;
    case 'cleave': for (const enemy of s.enemies) damageEnemy(s, enemy, up ? 12 : 9); break;
    case 'pierce': damageEnemy(s, e, up ? 15 : 11, { ignoreBlock: true }); break;
    case 'bash': damageEnemy(s, e, up ? 16 : 12); e.vulnerable += up ? 3 : 2; break;
    case 'riposte': gainBlock(s, up ? 8 : 5); damageEnemy(s, e, (up ? 8 : 5) + Math.floor(s.player.block / 2)); break;
    case 'fortress': gainBlock(s, up ? 24 : 18); s.player.retain = true; break;
    case 'focus': s.player.strength += up ? 3 : 2; break;
    case 'brace': s.player.dexterity += up ? 3 : 2; break;
    case 'flurry': for (let i = 0; i < 3; i++) damageEnemy(s, e, up ? 4 : 3); break;
    case 'kindle': burn(s, e, up ? 10 : 7); break;
    case 'wildfire': damageEnemy(s, e, up ? 14 : 9); e.burn *= 2; break;
    case 'leech': if (damageEnemy(s, e, up ? 20 : 15) > 0) heal(s, up ? 6 : 4); break;
    case 'insight': drawCards(s, up ? 3 : 2); break;
    case 'salvage': s.energy += up ? 2 : 1; drawCards(s, 1); break;
    case 'weakness': damageEnemy(s, e, up ? 8 : 5); e.weak += up ? 3 : 2; break;
    case 'bulwark': gainBlock(s, up ? 10 : 7); s.player.thorns += up ? 5 : 3; break;
    case 'execute': damageEnemy(s, e, e.hp <= e.maxHp / 2 ? (up ? 40 : 30) : (up ? 25 : 19)); break;
    case 'windfall': gainBlock(s, up ? 12 : 9); drawCards(s, 2); break;
    case 'cinder': for (const enemy of s.enemies) burn(s, enemy, up ? 9 : 6); gainBlock(s, up ? 11 : 8); break;
    case 'echo': damageEnemy(s, e, (up ? 9 : 6) + s.exhaust.length * (up ? 4 : 3)); break;
    case 'mend': heal(s, up ? 10 : 7); gainBlock(s, up ? 7 : 4); break;
  }
  if (def.kind === 'skill' && has(s, 'buckle') && !s.skillRelicUsed) { s.player.block += 3; s.skillRelicUsed = true; }
  if (def.exhaust) {
    s.exhaust.push(c);
    if (has(s, 'lantern') && !s.exhaustRelicUsed) { s.energy++; s.exhaustRelicUsed = true; }
  } else s.discard.push(c);
  note(s, `${cardInfo(c).name} played.`); finishBattle(s); return { ok: true };
}
function endTurn(s) {
  const oldWeak = s.player.weak; const oldVulnerable = s.player.vulnerable;
  s.discard.push(...s.hand); s.hand = [];
  for (const e of s.enemies) if (e.hp > 0 && e.burn > 0) { damageEnemy(s, e, e.burn, { raw: true, ignoreBlock: true }); e.burn--; }
  if (finishBattle(s)) return;
  for (const e of s.enemies) {
    if (e.hp <= 0 || s.hp <= 0) continue;
    const intent = e.intent; e.block = 0;
    if (intent.damage) for (let i = 0; i < (intent.hits || 1) && e.hp > 0 && s.hp > 0; i++) { hitPlayer(s, intentDamage(e)); if (s.player.thorns > 0) damageEnemy(s, e, s.player.thorns, { raw: true, ignoreBlock: true }); }
    if (e.hp <= 0) continue;
    if (intent.block) e.block += intent.block;
    if (intent.strength) e.strength += intent.strength;
    if (intent.weak) s.player.weak += intent.weak;
    if (intent.vulnerable) s.player.vulnerable += intent.vulnerable;
    if (intent.poison) s.player.poison += intent.poison;
    e.step++; e.intent = { ...PATTERNS[e.id].intents[e.step % PATTERNS[e.id].intents.length] };
    e.weak = Math.max(0, e.weak - 1); e.vulnerable = Math.max(0, e.vulnerable - 1);
  }
  if (s.player.poison > 0 && s.hp > 0) { s.hp = Math.max(0, s.hp - s.player.poison); s.player.poison--; }
  // Debuffs applied this enemy turn must still affect the following player turn.
  s.player.weak = Math.max(0, s.player.weak - (oldWeak > 0 ? 1 : 0)); s.player.vulnerable = Math.max(0, s.player.vulnerable - (oldVulnerable > 0 ? 1 : 0));
  if (finishBattle(s)) return; startTurn(s); note(s, `Turn ${s.turn}. Read the next intent, then make your hand count.`);
}
function prepareShop(s) {
  s.phase = 'shop'; s.shopRemoved = false;
  s.shopOffers = sample(s, Object.keys(CARDS).filter(id => CARDS[id].rarity > 0), 3).map((id, i) => ({ id: `card-${i}`, kind: 'card', cardId: id, cost: CARDS[id].rarity === 2 ? 58 : 38, sold: false }));
  const relic = sample(s, Object.keys(RELICS).filter(id => !has(s, id)), 1)[0];
  if (relic) s.shopOffers.push({ id: 'relic', kind: 'relic', relicId: relic, cost: 75, sold: false });
  note(s, 'Spend carefully. Removing a starter card costs 40 gold.');
}
export function togglePause(s) {
  if (s.phase === 'paused' && ACTIVE.has(s.pausedPhase)) { s.phase = s.pausedPhase; s.pausedPhase = null; return true; }
  if (!ACTIVE.has(s.phase)) return false;
  s.pausedPhase = s.phase; s.phase = 'paused'; return true;
}
export function dispatch(s, action, payload = {}) {
  if (!s || !ACTIVE.has(s.phase)) return { ok: false, error: 'This run is not accepting actions.' };
  if (!payload || typeof payload !== 'object') return { ok: false, error: 'Provide an action choice.' };
  if (s.phase === 'battle') {
    if (action === 'play-card') return play(s, payload.uid, payload.target ?? 0);
    if (action === 'end-turn') { endTurn(s); return { ok: true }; }
  }
  if (s.phase === 'route' && action === 'choose-route') {
    const option = s.routeOptions.find(o => o.id === payload.id); if (!option) return { ok: false, error: 'Choose a road on the map.' };
    s.path.push({ act: s.act, floor: s.floor, kind: option.kind, title: option.title }); s.score += 15;
    if (['combat', 'elite', 'boss'].includes(option.kind)) beginBattle(s, option.kind);
    else if (option.kind === 'rest') { s.phase = 'rest'; note(s, 'Rest by the hearth: recover 25 HP, or upgrade one card.'); }
    else if (option.kind === 'shop') prepareShop(s);
    else { s.phase = 'event'; s.event = { name: ['The Sealed Well', 'The Scribe’s Bargain', 'The Wishing Tree'][s.act - 1], choices: [{ id: 'gift', title: 'Take the offering', text: 'Lose 8 HP. Gain a rare card and 25 gold.' }, { id: 'renew', title: 'Leave a little gold', text: 'Pay 25 gold. Heal 18 HP.' }, { id: 'leave', title: 'Keep walking', text: 'Leave unharmed.' }] }; note(s, 'A small bargain waits beside the road.'); }
    return { ok: true };
  }
  if (s.phase === 'reward' && action === 'choose-reward') {
    if (payload.id !== 'skip' && !s.rewardCards.includes(payload.id)) return { ok: false, error: 'Choose one offered card.' };
    if (payload.id !== 'skip') s.deck.push(card(s, payload.id)); s.rewardCards = [];
    if (s.encounter === 'boss' || s.encounter === 'elite') relicReward(s); else advance(s); return { ok: true };
  }
  if (s.phase === 'relic' && action === 'claim-relic') {
    if (!s.relicChoices.includes(payload.id)) return { ok: false, error: 'Choose one offered relic.' };
    s.relics.push(payload.id); if (payload.id === 'crown') { s.maxHp += 10; heal(s, 10); }
    s.relicChoices = []; completeRelicEncounter(s); return { ok: true };
  }
  if (s.phase === 'rest' && action === 'rest') {
    if (payload.kind === 'heal') { heal(s, 25); advance(s); return { ok: true }; }
    if (payload.kind === 'upgrade') { const c = s.deck.find(c => c.uid === payload.uid && !c.upgraded); if (!c) return { ok: false, error: 'Choose a card that is not upgraded.' }; c.upgraded = true; advance(s); return { ok: true }; }
  }
  if (s.phase === 'shop' && action === 'buy') {
    const offer = s.shopOffers.find(o => o.id === payload.id && !o.sold); if (!offer) return { ok: false, error: 'That offer is unavailable.' };
    if (s.gold < offer.cost) return { ok: false, error: 'Not enough gold.' };
    s.gold -= offer.cost; offer.sold = true;
    if (offer.kind === 'card') s.deck.push(card(s, offer.cardId));
    else { s.relics.push(offer.relicId); if (offer.relicId === 'crown') { s.maxHp += 10; heal(s, 10); } }
    note(s, 'A new piece for your build.'); return { ok: true };
  }
  if (s.phase === 'shop' && action === 'remove-card') {
    const index = s.deck.findIndex(c => c.uid === payload.uid);
    if (s.shopRemoved || s.gold < 40 || index < 0 || s.deck.length <= 5) return { ok: false, error: 'Removal needs 40 gold, an unused service, and more than five cards.' };
    s.deck.splice(index, 1); s.gold -= 40; s.shopRemoved = true; note(s, 'A lighter pack makes a more reliable hand.'); return { ok: true };
  }
  if (s.phase === 'shop' && action === 'leave-shop') { advance(s); return { ok: true }; }
  if (s.phase === 'event' && action === 'choose-event') {
    let discovery = '';
    if (payload.id === 'gift') {
      if (s.hp <= 8) return { ok: false, error: 'You need more than 8 HP to make this bargain.' };
      s.hp -= 8; s.gold += 25; const id = sample(s, Object.keys(CARDS).filter(id => CARDS[id].rarity === 2), 1)[0]; s.deck.push(card(s, id)); discovery = `You received ${CARDS[id].name} and 25 gold.`;
    } else if (payload.id === 'renew') { if (s.gold < 25) return { ok: false, error: 'You need 25 gold.' }; s.gold -= 25; heal(s, 18); }
    else if (payload.id !== 'leave') return { ok: false, error: 'Choose one bargain.' };
    advance(s); if (discovery) note(s, `${discovery} ${s.message}`); return { ok: true };
  }
  return { ok: false, error: 'That action is unavailable here.' };
}
