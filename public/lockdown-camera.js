import { GROUND } from './lockdown-scene-geometry.js';
/** A fixed oblique overhead camera. Input and picking use the same basis. */
export const LOCKDOWN_YAW = Math.PI / 8;
export const CAMERA_COS = Math.cos(LOCKDOWN_YAW), CAMERA_SIN = Math.sin(LOCKDOWN_YAW);
export const groundToView = (x, y, lift = 0) => ({ x: CAMERA_COS * x - CAMERA_SIN * y, y: (CAMERA_SIN * x + CAMERA_COS * y) * GROUND - lift });
export function viewToGround(x, y, lift = 0) {
  const depth = (y + lift) / GROUND;
  return { x: CAMERA_COS * x + CAMERA_SIN * depth, y: -CAMERA_SIN * x + CAMERA_COS * depth };
}
