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
