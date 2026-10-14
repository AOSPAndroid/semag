import { VoxelMesh } from './voxel-renderer.js';
export const MATERIAL = Object.freeze({ grass: 0, rock: 1, leaves: 2, paving: 3, iron: 4, metal: 5, masonry: 6, hazard: 7, temple: 8 });
export const PAINTED_ASSETS = Object.freeze({ materials: '/assets/lockdown/painted/materials.webp', foliage: '/assets/lockdown/painted/foliage.webp' });

/** Keep the shared voxel layout. Opaque alpha values >= 2 encode a material
 * slot; ordinary solid/dynamic geometry retains normal colour and alpha. */
export class PaintedMesh extends VoxelMesh {
  constructor() { super(); this.material = -1; this.shade = 1; }
  vertex(position, normal, color) {
    super.vertex(position, normal, this.material < 0 ? color : [this.shade, this.shade, this.shade, 2 + this.material]);
  }
  paint(material, draw, shade = 1) {
    const previous = this.material, oldShade = this.shade;
    this.material = material; this.shade = shade;
    try { draw(); } finally { this.material = previous; this.shade = oldShade; }
  }
  box(x, y, z, w, h, d, color) {
    if (this.material < 0) return super.box(x, y, z, w, h, d, color);
    if (w <= 0 || h <= 0 || d <= 0) return;
    const c = [1, 1, 1, 1];
    this.quad([x,y,z], [x,y+h,z], [x+w,y+h,z], [x+w,y,z], [0,0,-1], c);
    this.quad([x+w,y,z+d], [x+w,y+h,z+d], [x,y+h,z+d], [x,y,z+d], [0,0,1], c);
    this.quad([x,y,z+d], [x,y+h,z+d], [x,y+h,z], [x,y,z], [-1,0,0], c);
    this.quad([x+w,y,z], [x+w,y+h,z], [x+w,y+h,z+d], [x+w,y,z+d], [1,0,0], c);
    this.quad([x,y+h,z], [x,y+h,z+d], [x+w,y+h,z+d], [x+w,y+h,z], [0,1,0], c);
    this.quad([x,y,z+d], [x,y,z], [x+w,y,z], [x+w,y,z+d], [0,-1,0], c);
  }
}
