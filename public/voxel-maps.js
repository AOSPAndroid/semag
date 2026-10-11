import { createParisMap } from './voxel-paris.js';
import { createExpansionMap } from './voxel-expansion-maps.js';
import { enhanceMapIdentity } from './voxel-map-landmarks.js';
import { createCloseCombatMap } from './voxel-close-combat-maps.js';
import { addCombatLayers } from './voxel-map-layers.js';
import { addTacticalJumpCover } from './voxel-tactical-cover.js';
import { createMedievalMap } from './voxel-medieval-map.js';

import { createCoreMap } from './voxel-core-layouts.js';

const core = id => { const authored = createCoreMap(id), identified = enhanceMapIdentity(authored); return Object.freeze({ ...identified, description: authored.description }); };

/** Single catalog consumed by server validation, prediction, setup and rendering. */
export const MAPS = Object.freeze(Object.fromEntries(Object.entries({
  courtyard: core('courtyard'), depot: core('depot'), canal: core('canal'),
  rooftops: core('rooftops'), foundry: core('foundry'), bastion: core('bastion'),
  paris: enhanceMapIdentity(createParisMap('breach')), snow: createExpansionMap('snow'), sewers: createExpansionMap('sewers'), trading: createExpansionMap('trading'),
  market: createCloseCombatMap('market'), lockdown: createCloseCombatMap('lockdown'),
  medieval: createMedievalMap(),
}).map(([id, arena]) => [id, addTacticalJumpCover(addCombatLayers(arena))])));
export const MAP_IDS = Object.freeze(Object.keys(MAPS));
