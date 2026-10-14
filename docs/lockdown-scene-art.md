# Connected Lockdown scenery

The scene uses one orthographic projection: a 48-unit tile is 48 × 36 on screen, a raised floor rises 24 units, and a wall rises 72. Stair treads and risers come from `public/lockdown-scene-geometry.js`. Their endpoints meet the real low and high landings, and they sample the same materials as those landings. This removes the empty wedges around the old diagonal staircase pictures and the flattened south-facing stair that resembled a floating weapon.

All six themes share a regenerated material, prop and landmark kit: 107 PNGs across the eight arenas. Generated source paintings and their exact prompts are in `tools/art-source/lockdown-*.png` and `tools/art-source/lockdown-prompts.json`. They were created with the built-in image generation tool. Character animation and equipment remain registered to the existing body sheets.

The build script slices material cells, packs transparent props at their declared foot anchors, and derives all 24 exported stair tiles from the same geometry used at runtime. It preserves the generated alpha channel; RGB color outside the alpha silhouette is not a background. The manifest and index validate all 319 runtime sprites at either native or exactly double resolution.

Ground and masonry repeats mirror at their boundaries to avoid disconnected texture edges. Sky Bridges uses one continuous sky painting. Every exposed platform edge receives a rim, with a consistent stone face below south-facing drops. Stair entrances have no rim across the opening. Solid footprints are filled before raised surfaces, including beneath fading walls.

The capture medallion is 104 units across; the capture ring still represents the actual 132-unit radius. The crystal socket has a compact 48 × 48 registration. Portrait framing and the HUD keep the score and all four equipment slots on screen.

## Rebuild and check

```sh
npm ci
npm run art:lockdown
npm run test:lockdown
```

With the server running on port 3128 (or `LOCKDOWN_URL` set to another local server):

```sh
npm run preview:lockdown
node tools/lockdown-browser-smoke.mjs
```

The browser scripts use an installed Chrome browser. The scene preview is a deterministic renderer fixture with a positioned character, separate from the live smoke test. The smoke test starts an actual match through the lobby, uses keyboard/mouse movement and combat, checks runtime/HTTP errors, checks the bounds of the score and equipment HUD, and captures desktop, 393 × 852 and 320 × 720 layouts.

The regression suite also checks every stair landing across every map, all four stair projections, PNG dimensions, transparent cutout corners and objective scale. Existing traversal, combat, equipment and server tests continue to exercise the unchanged simulation.

![Renderer fixture: connected Sky Bridges stairs and compact point A](screenshots/lockdown/skyway-phone.png)

![Actual phone-sized gameplay with the compact HUD](screenshots/lockdown/live-phone.png)

![All eight arenas: Sky Bridges, Old Keep, Hedge Labyrinth, Foundry, Temple, Graveyard, Rampart Walk, Sunken Atrium](screenshots/lockdown/overview.png)
