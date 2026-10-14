# Lockdown 3D arenas

Lockdown renders all eight arenas as real WebGL geometry with an oblique overhead camera. It shares `VoxelMesh` with Semag's Voxel Breach and Shinobi renderer and the matrix helpers used by Ember. Adjacent wall cells merge into continuous structures; towers have round drums and tapered roofs, temple cover uses columns, graveyard cover uses tombstones, foundry structures have tanks, and the labyrinth has faceted foliage. Stairs are solid flights meeting their real low and high landings.

Sky Bridges uses authored rounded islands and bridge polygons in `public/lockdown-map-surfaces.js`. The same polygon union defines visible ground and body collision. Internal joins have no curb across the route. The coarse grid remains for bot navigation, heights and spawn-room cover. Both teams retain mirrored routes to all three capture points, and specialized shoes retain their ability to cross pits.

`public/lockdown-world-mesh.js` constructs the static world. `lockdown-world-view.js` uploads it once per map, with a three-map GPU cache and a bounded sprite atlas. `lockdown-voxel-renderer.js` presents animated knight/equipment sprites with depth testing, compact 3D capture monuments and the combat overlays. A faint local silhouette preserves visibility behind tall cover. The original layered character, weapon and equipment artwork is retained.

`lockdown-camera.js` defines the common projection for the WebGL scene, labels, effects and mouse picking. Movement and dashes rotate through the inverse camera basis; the server validates the movement angle. The capture ring still represents the actual 132-unit radius, while the solid monument is 80 units across. The render target follows Semag's 2.2-million-pixel budget. Hardware context loss switches to the existing Canvas renderer and context restoration rebuilds the GPU resources.

## Art and fallback

The earlier coordinated scene kit remains available to the Canvas fallback: 107 regenerated environment and landmark PNGs across six themes. The source paintings and exact prompts are in `tools/art-source/lockdown-*.png` and `tools/art-source/lockdown-prompts.json`; they were created with the built-in image generation tool. The build script packs the materials and transparent props at their declared anchors, preserves alpha and validates all 319 runtime sprites at native or double resolution. The fallback also uses the rounded Sky Bridges ground outline.

## Rebuild and check

```sh
npm ci
npm run art:lockdown
npm run test:lockdown
```

With the server running on port 3128 (or `LOCKDOWN_URL` set to another server):

```sh
npm run preview:lockdown
node tools/lockdown-browser-smoke.mjs
```

The scripts use an installed Chrome browser. The deterministic fixture renders all eight arenas, checks WebGL errors and tests context loss/restoration. The live smoke test starts matches through the actual lobby, uses keyboard/mouse movement and combat, and checks HUD bounds at 1280 x 820, 393 x 852 and 320 x 720. These are browser viewport checks, not tests on physical iPhones.

The regression suite checks GPU/HUD/picking agreement at different elevations, screen-relative movement, bounded finite mesh geometry, all stair landings, rounded-edge collision, bridge traversal, pit shoes, bot connectivity, multiplayer input, sprite dimensions and alpha. Voxel and Shinobi renderer tests guard the shared mesh export.

![Rounded Sky Bridges islands, continuous bridges and connected terrace stairs](screenshots/lockdown/skyway-phone.png)

![Live phone-sized gameplay](screenshots/lockdown/live-phone.png)

![All eight 3D arenas](screenshots/lockdown/overview.png)
