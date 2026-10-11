import { createFpsInputQueue } from './voxel-input-queue.js';

/** Fresh combat presses survive render/network coalescing until a real step. */
export const SHINOBI_VOXEL_EDGE_ACTIONS = Object.freeze(['fire', 'aim', 'jump', 'dash', 'kunai', 'feint']);
const SHINOBI_VOXEL_AIM_ACTIONS = Object.freeze(['fire', 'aim', 'dash', 'kunai']);
const SHINOBI_VOXEL_MOVEMENT_ACTIONS = Object.freeze(['dash']);

export function createShinobiVoxelInputQueue(options = {}) {
  return createFpsInputQueue({
    ...options,
    edgeActions: SHINOBI_VOXEL_EDGE_ACTIONS,
    aimActions: SHINOBI_VOXEL_AIM_ACTIONS,
    movementActions: SHINOBI_VOXEL_MOVEMENT_ACTIONS,
  });
}
