/** Equipment is independent of class abilities. Resistances are fractions of direct
 * health damage blocked after shields; status damage keeps its existing behavior.
 * Outfits may also carry attack perks that multiply with the class perks:
 * gunDamage / bladeDamage (damage), gunCharge (charge time, below 1 is faster) and
 * bladeSpeed (swing speed). */
const armor = (id, name, description, gunResistance, bladeResistance, bombResistance, speedMultiplier, spriteStyle, perks = {}) => Object.freeze({
  id, name, description, gunResistance, bladeResistance, bombResistance, speedMultiplier, spriteStyle,
  gunDamage: perks.gunDamage ?? 1, gunCharge: perks.gunCharge ?? 1, bladeDamage: perks.bladeDamage ?? 1, bladeSpeed: perks.bladeSpeed ?? 1,
});

export const ARMORS = Object.freeze({
  none: armor('none', 'Unarmored', 'T-shirt and shorts. Normal speed, with no damage resistance.', 0, 0, 0, 1, 'none'),
  scout: armor('scout', 'Scout Armor', 'Light armor for faster movement and longer dashes, with modest protection.', .10, .10, .05, 1.15, 'light'),
  ballistic: armor('ballistic', 'Ballistic Armor', 'Specialized protection against guns, with a small speed cost.', .30, .08, .15, .95, 'ballistic'),
  duelist: armor('duelist', 'Duelist Armor', 'Specialized protection against swords, with a small speed cost.', .08, .30, .10, .95, 'duelist'),
  heavy: armor('heavy', 'Heavy Armor', 'Strong protection against direct attacks, with slower movement and shorter dashes.', .30, .30, .20, .82, 'heavy'),
  gunslinger: armor('gunslinger', 'Gunslinger Duster', 'A long riding coat for marksmen: guns hit 15% harder and charge 15% faster, with little protection.', .10, .05, .05, 1, 'gunslinger', { gunDamage: 1.15, gunCharge: .85 }),
  fencer: armor('fencer', 'Fencing Garb', 'A light padded fencing jacket: swords hit 15% harder and swing 10% faster, with little protection.', .05, .10, .05, 1.05, 'fencer', { bladeDamage: 1.15, bladeSpeed: 1.1 }),
});
export const ARMOR_IDS = Object.freeze(Object.keys(ARMORS));
