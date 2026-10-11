import { createParisMap } from './voxel-paris.js';
import { createExpansionMap } from './voxel-expansion-maps.js';
import { enhanceMapIdentity } from './voxel-map-landmarks.js';
import { createCloseCombatMap } from './voxel-close-combat-maps.js';
import { addCombatLayers } from './voxel-map-layers.js';
import { createMedievalMap } from './voxel-medieval-map.js';
import { AUTHORED_ROYALE_MAPS } from './voxel-royale-authored.js';

/** Each Royale arena owns its collision geometry, loot and playable upper routes. */
export const MAPS = Object.freeze(Object.fromEntries(Object.entries({
  ...AUTHORED_ROYALE_MAPS,
  paris: enhanceMapIdentity(createParisMap('royale')), snow: createExpansionMap('snow', 'royale'), sewers: createExpansionMap('sewers', 'royale'), trading: createExpansionMap('trading', 'royale'),
  market: createCloseCombatMap('market', 'royale'), lockdown: createCloseCombatMap('lockdown', 'royale'),
  medieval: createMedievalMap('royale'),
}).map(([id, arena]) => [id, addCombatLayers(arena)])));
export const MAP_IDS = Object.freeze(Object.keys(MAPS));
