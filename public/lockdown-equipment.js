/** Equipment is independent of class abilities. Resistances are fractions of direct
 * health damage blocked after shields; status damage keeps its existing behavior. */
const armor = (id, name, description, gunResistance, bladeResistance, bombResistance, speedMultiplier, spriteStyle) => Object.freeze({
  id, name, description, gunResistance, bladeResistance, bombResistance, speedMultiplier, spriteStyle,
});

export const ARMORS = Object.freeze({
  none: armor('none', 'Unarmored', 'T-shirt and shorts. Normal speed, with no damage resistance.', 0, 0, 0, 1, 'none'),
  scout: armor('scout', 'Scout Armor', 'Light armor for faster movement and modest protection.', .08, .08, .05, 1.10, 'light'),
  ballistic: armor('ballistic', 'Ballistic Armor', 'Specialized protection against guns, with a small speed cost.', .30, .08, .15, .95, 'ballistic'),
  duelist: armor('duelist', 'Duelist Armor', 'Specialized protection against swords, with a small speed cost.', .08, .30, .10, .95, 'duelist'),
  heavy: armor('heavy', 'Heavy Armor', 'Strong protection against direct attacks, with slower movement.', .35, .35, .25, .82, 'heavy'),
});
export const ARMOR_IDS = Object.freeze(Object.keys(ARMORS));
