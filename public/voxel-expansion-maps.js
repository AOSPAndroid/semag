import { createSnowMap } from './voxel-snow-map.js';
import { createSewerMap } from './voxel-sewer-map.js';
import { createTradingMap } from './voxel-trading-map.js';

/** Separate authored environments share the arena contract, not a room template. */
export function createExpansionMap(id, mode = 'breach') {
  if (!['snow', 'sewers', 'trading'].includes(id)) throw new TypeError('Unknown expansion map');
  if (mode !== 'breach' && mode !== 'royale') throw new TypeError('Expansion mode must be breach or royale');
  if (id === 'snow') return createSnowMap(mode);
  if (id === 'sewers') return createSewerMap(mode);
  return createTradingMap(mode);
}
