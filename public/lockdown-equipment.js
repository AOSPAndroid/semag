/** Equipment is independent of class abilities. Resistances are fractions of direct
 * health damage blocked after shields (negative means you take more); status damage keeps
 * its existing behavior. Outfits may also carry perks and drawbacks, multiplied with the
 * class perks. Multipliers are 1 when unused:
 * - gunDamage, bladeDamage, bombDamage: damage dealt with that weapon family.
 * - gunCharge, bombCharge: charge time (below 1 is faster). bladeSpeed: swing speed.
 * - dashCooldown, dashDistance: the Space dash. abilityCooldown: the class ability (and the
 *   Guardian shield's recharge).
 * - maxHp: flat health added to the class. knockback: how far hits push you.
 * - statusDuration: how long burn, poison, shock and freeze last on you.
 * - healing: hearts, base and dome healing received. regen: health per second after
 *   four seconds without taking damage. */
const PERKS = Object.freeze({ gunDamage: 1, gunCharge: 1, bladeDamage: 1, bladeSpeed: 1, bombDamage: 1, bombCharge: 1, dashCooldown: 1, dashDistance: 1,
  abilityCooldown: 1, maxHp: 0, knockback: 1, statusDuration: 1, healing: 1, regen: 0 });
export const PERK_IDS = Object.freeze(Object.keys(PERKS));
const armor = (id, name, description, gunResistance, bladeResistance, bombResistance, speedMultiplier, spriteStyle, perks = {}) => Object.freeze({
  id, name, description, gunResistance, bladeResistance, bombResistance, speedMultiplier, spriteStyle,
  ...Object.fromEntries(Object.entries(PERKS).map(([key, base]) => [key, perks[key] ?? base])),
  walk: Object.freeze([...(perks.walk || [])]),
});

export const ARMORS = Object.freeze({
  none: armor('none', 'Unarmored', 'T-shirt and shorts. Normal speed, with no damage resistance.', 0, 0, 0, 1, 'none'),
  scout: armor('scout', 'Scout Armor', 'Light armor for faster movement and longer dashes, with modest protection.', .10, .10, .05, 1.15, 'light'),
  ballistic: armor('ballistic', 'Ballistic Armor', 'Specialized protection against guns, with a small speed cost.', .30, .08, .15, .95, 'ballistic'),
  duelist: armor('duelist', 'Duelist Armor', 'Specialized protection against swords, with a small speed cost.', .08, .25, .10, .95, 'duelist'),
  heavy: armor('heavy', 'Heavy Armor', 'Strong protection against direct attacks, with slower movement and shorter dashes.', .30, .30, .20, .82, 'heavy'),
  gunslinger: armor('gunslinger', 'Gunslinger Duster', 'A long riding coat for marksmen: guns hit 15% harder and charge 15% faster, with little protection.', .10, .05, .05, 1, 'gunslinger', { gunDamage: 1.15, gunCharge: .85 }),
  fencer: armor('fencer', 'Fencing Garb', 'A light padded fencing jacket: swords hit 15% harder and swing 10% faster, with little protection.', .05, .10, .05, 1.05, 'fencer', { bladeDamage: 1.15, bladeSpeed: 1.1 }),
  windrunner: armor('windrunner', 'Windrunner Wraps', 'Flowing silk wraps for runners: much faster, with quicker, longer dashes, but swords hit 8% softer and they barely protect you.', .05, 0, 0, 1.18, 'windrunner', { dashCooldown: .65, dashDistance: 1.2, bladeDamage: .92 }),
  juggernaut: armor('juggernaut', 'Juggernaut Plate', 'Riveted siege plate: +30 health and hard to knock back, but very slow, with short dashes and heavier swings.', .25, .25, .25, .78, 'juggernaut', { maxHp: 30, knockback: .4, dashDistance: .7, bladeSpeed: .9 }),
  bombardier: armor('bombardier', 'Bombardier Apron', 'A scorched leather apron full of fuses: bombs charge 35% faster and hit 20% harder, and blasts barely scratch you, but guns lose their edge.', .05, .05, .40, 1, 'bombardier', { bombCharge: .65, bombDamage: 1.2, gunDamage: .9 }),
  berserker: armor('berserker', 'Berserker Hide', 'Bare arms and a wolf pelt: swords hit 25% harder and swing 10% faster, but bullets bite deeper.', -.15, .05, 0, 1.05, 'berserker', { bladeDamage: 1.25, bladeSpeed: 1.1 }),
  mirrorweave: armor('mirrorweave', 'Mirrorweave Cloak', 'A shimmering cloak that sheds fire, poison, shock and frost (60% shorter) and turns some bullets, at the cost of 10 health.', .20, 0, .05, 1, 'mirrorweave', { statusDuration: .4, maxHp: -10 }),
  medic: armor('medic', 'Field Medic Coat', 'A white coat with a satchel of salves: hearts, base and dome heal you 50% more and you mend 3 HP a second out of combat, but every weapon hits 5% softer.', .05, .05, .05, 1, 'medic', { healing: 1.5, regen: 2, gunDamage: .95, bladeDamage: .95, bombDamage: .95 }),
  clockwork: armor('clockwork', 'Clockwork Harness', 'A ticking brass harness: your class ability and dash recharge much faster, but your guns and swords hit 5% softer.', .05, .05, .05, 1, 'clockwork', { abilityCooldown: .65, dashCooldown: .8, gunDamage: .95, bladeDamage: .95 }),
});
export const ARMOR_IDS = Object.freeze(Object.keys(ARMORS));

/** Helmets, pants and shoes. Same fields as body armour; every piece may help or hurt. */
const piece = (id, name, description, gun, blade, bomb, speed, perks = {}) => armor(id, name, description, gun, blade, bomb, speed, id, perks);
export const HELMETS = Object.freeze({
  none: piece('none', 'Bare head', 'Nothing on your head.', 0, 0, 0, 1),
  sallet: piece('sallet', 'Sallet Helm', 'A plain steel sallet: solid all-round protection, a little heavy.', .08, .08, .05, .97),
  visor: piece('visor', 'Marksman Visor', 'A tinted visor: guns hit 10% harder and charge 10% faster, but it leaves your head bare to blades.', 0, -.05, 0, 1, { gunDamage: 1.1, gunCharge: .9 }),
  horned: piece('horned', 'Horned Helm', 'Swords hit 10% harder; the horns make you an easy target for guns.', -.05, .05, 0, 1, { bladeDamage: 1.1 }),
  hood: piece('hood', 'Hexweave Hood', 'Status effects last 30% less and your class ability recharges 10% faster; no protection.', 0, 0, 0, 1, { statusDuration: .7, abilityCooldown: .9 }),
  lampcap: piece('lampcap', 'Sapper Lamp Cap', 'Bombs charge 15% faster and hit 10% harder; blasts still rattle you.', 0, 0, .1, 1, { bombCharge: .85, bombDamage: 1.1 }),
  feather: piece('feather', 'Feathered Cap', 'A dashing cap: 5% faster and the dash recharges 10% sooner, at the cost of 5 health.', 0, 0, 0, 1.05, { dashCooldown: .9, maxHp: -5 }),
  bucket: piece('bucket', 'Bucket Helm', '+15 health and hard to shove, but you can barely see where you are going.', .05, .05, .05, .95, { maxHp: 15, knockback: .8 }),
  circlet: piece('circlet', 'Mender Circlet', 'All healing you receive is 25% stronger.', 0, 0, 0, 1, { healing: 1.25 }),
  goggles: piece('goggles', 'Clockwork Goggles', 'Your class ability recharges 15% faster; the lenses throw off your aim a little (guns −5%).', 0, 0, 0, 1, { abilityCooldown: .85, gunDamage: .95 }),
});
export const PANTS = Object.freeze({
  none: piece('none', 'Shorts', 'Plain shorts.', 0, 0, 0, 1),
  greaves: piece('greaves', 'Plate Greaves', 'Steel leg plates: good against swords, a little slower.', .05, .10, .05, .94),
  leggings: piece('leggings', 'Runner Leggings', '6% faster with a 10% longer dash; no protection.', 0, 0, 0, 1.06, { dashDistance: 1.1 }),
  chausses: piece('chausses', 'Chainmail Chausses', 'Blast protection and 20% less knockback, slightly slower.', .05, .05, .15, .97, { knockback: .8 }),
  breeches: piece('breeches', 'Duelist Breeches', 'Swings 8% faster with light sword protection.', 0, .05, 0, 1, { bladeSpeed: 1.08 }),
  sapper: piece('sapper', 'Sapper Trousers', 'Pockets full of fuses: bombs charge 15% faster.', 0, 0, .05, 1, { bombCharge: .85 }),
  cargo: piece('cargo', 'Cargo Trousers', 'Spare magazines: gun charges 10% faster and guns hit 5% harder, slightly slower.', 0, 0, 0, .97, { gunCharge: .9, gunDamage: 1.05 }),
  kilt: piece('kilt', 'Kilt of Fury', 'Swords hit 10% harder, but bullets find bare knees (guns hit you 10% harder).', -.10, 0, 0, 1.03, { bladeDamage: 1.1 }),
});
export const SHOES = Object.freeze({
  none: piece('none', 'Plain shoes', 'Simple shoes.', 0, 0, 0, 1),
  sneakers: piece('sneakers', 'Sprint Sneakers', '8% faster, at the cost of 5 health.', 0, 0, 0, 1.08, { maxHp: -5 }),
  sabatons: piece('sabatons', 'Iron Sabatons', 'Rooted to the ground: 30% less knockback and some blast protection, but 8% slower.', 0, 0, .10, .92, { knockback: .7 }),
  dashboots: piece('dashboots', 'Dash Boots', 'The dash recharges 25% faster and goes 15% further.', 0, 0, 0, 1, { dashCooldown: .75, dashDistance: 1.15 }),
  spurs: piece('spurs', 'Spurred Boots', 'Swords hit 5% harder and you move 3% faster.', 0, 0, 0, 1.03, { bladeDamage: 1.05 }),
  treads: piece('treads', 'Mud Treads', 'Status effects last 25% less; heavy soles slow you 3%.', 0, 0, 0, .97, { statusDuration: .75 }),
  clogs: piece('clogs', 'Rocket Clogs', 'A huge 35% longer dash that takes 20% longer to recharge.', 0, 0, 0, 1, { dashDistance: 1.35, dashCooldown: 1.2 }),
  sandals: piece('sandals', 'Healer Sandals', 'Mend 1 HP a second out of combat and heal 10% more.', 0, 0, 0, 1, { regen: 1, healing: 1.1 }),
  striders: piece('striders', 'Water Striders', 'Walk across water and bog, cutting corners nobody else can, but the light soles leave you 5% weaker to swords.', 0, -.05, 0, 1, { walk: ['water', 'bog'] }),
  magma: piece('magma', 'Magma Walkers', 'Stride over molten lava; thick soles add 10% blast protection, but slow you 4%.', 0, 0, .10, .96, { walk: ['lava'] }),
  hover: piece('hover', 'Hover Boots', 'Float over every pit: water, bog, lava and open sky. Hovering is slower (8%) and dashes are 15% shorter.', 0, 0, 0, .92, { walk: ['water', 'bog', 'lava', 'chasm'], dashDistance: .85 }),
  quicksilver: piece('quicksilver', 'Quicksilver Slippers', '15% faster than anything else on your feet, but paper-thin: 8% weaker to everything.', -.08, -.08, -.08, 1.15),
});

/** The four equipment slots, head to toe, and the table each one picks from. */
export const GEAR_SLOTS = Object.freeze(['helmet', 'armor', 'pants', 'shoes']);
export const GEAR = Object.freeze({ helmet: HELMETS, armor: ARMORS, pants: PANTS, shoes: SHOES });
// Stacking is allowed to get silly, but not unplayable: every combined stat lives in these bounds.
export const GEAR_LIMITS = Object.freeze({ resistance: [-.5, .6], speed: [.6, 1.45], power: [.6, 1.4], tempo: [.45, 1.6], maxHp: [-40, 60], knockback: [.3, 1.6], statusDuration: [.3, 1.6], healing: [.6, 1.9] });
const PERK_LIMIT = { gunDamage: 'power', bladeDamage: 'power', bombDamage: 'power', bladeSpeed: 'power', healing: 'healing',
  gunCharge: 'tempo', bombCharge: 'tempo', dashCooldown: 'tempo', dashDistance: 'tempo', abilityCooldown: 'tempo', knockback: 'knockback', statusDuration: 'statusDuration', maxHp: 'maxHp' };

const combined = new Map();
/** Everything a knight wears, added up: resistances add (capped), speed and multipliers
 * multiply, health and regeneration add. Accepts a player or { helmet, armor, pants, shoes }. */
export function combineGear(gear = {}) {
  const ids = GEAR_SLOTS.map(slot => Object.hasOwn(GEAR[slot], gear[slot]) ? gear[slot] : 'none'), key = ids.join('|');
  if (combined.has(key)) return combined.get(key);
  const pieces = ids.map((id, index) => GEAR[GEAR_SLOTS[index]][id]);
  const clamp = (value, [low, high]) => Math.max(low, Math.min(high, value));
  const sum = field => pieces.reduce((total, part) => total + part[field], 0), product = field => pieces.reduce((total, part) => total * part[field], 1);
  const stats = { gunResistance: clamp(sum('gunResistance'), GEAR_LIMITS.resistance), bladeResistance: clamp(sum('bladeResistance'), GEAR_LIMITS.resistance), bombResistance: clamp(sum('bombResistance'), GEAR_LIMITS.resistance),
    speedMultiplier: Math.round(clamp(product('speedMultiplier'), GEAR_LIMITS.speed) * 1e4) / 1e4 };
  for (const perk of PERK_IDS) {
    const value = perk === 'maxHp' || perk === 'regen' ? sum(perk) : product(perk);
    stats[perk] = PERK_LIMIT[perk] ? Math.round(clamp(value, GEAR_LIMITS[PERK_LIMIT[perk]]) * 1e4) / 1e4 : value;
  }
  const walk = Object.freeze([...new Set(pieces.flatMap(part => part.walk))].sort());
  const result = Object.freeze({ ...stats, walk, name: pieces.filter(part => part.id !== 'none').map(part => part.name).join(' + ') || 'Unarmored', pieces: Object.freeze(ids) });
  combined.set(key, result);
  return result;
}
