# Instructions for the art agent

You make the art for **Lockdown**, a top-down 4v4 team brawl in the spirit of Spiral Knights' Lockdown. The game
code lives in another repository; this repository holds only the art. Every sprite the game draws is listed in
`manifest.json` (machine-readable) and `BRIEF.md` (the style guide and a table with each sprite's size, anchor,
frames and notes). The game loads `art/<file>` by exact file name; nothing else is read.

The person you work with is the **art director**. They decide what looks good. Show them work early and stop for
their approval at the gates below. Do not mass-produce art they have not approved.

## The look

Painted fantasy 3D, like Spiral Knights: chunky, rounded, toy-like shapes; soft painted shading with broad
highlights and gentle bevels; clean antialiased silhouettes that read at small size; light from the top-left;
saturated but harmonious colour, one restrained palette per theme. Original designs only: use Spiral Knights for
mood, shapes and materials, never copy its sprites.

**Never:**
- stretch or smear pixels to fill a canvas (repeated identical rows or columns), or resize art non-uniformly;
- bake in a background, a sky, a matte, a coloured strip, a frame or a guide line; sprites are transparent PNGs;
- leave slivers of neighbouring sprites from cutting up a generated sheet;
- darken or outline the edges of a tile (that draws a grid over the whole floor in game); tiles must repeat seamlessly;
- paint perspective into flat art (floor, wall tops, pits, plates, rings), the game foreshortens it itself;
- draw "down" stairs as a flat slab: every stair is a full flight of steps that climbs one storey;
- use pixel-art, voxels, photo textures, heavy black outlines, text or watermarks;
- mix styles between sprites of the same set (the same armor on every knight sheet, the same stone on every tile).

## Technical rules (details in BRIEF.md)

- Draw everything at **exactly 2x** the size listed (a 48×48 tile is a 96×96 PNG). 8-bit RGBA PNG, non-interlaced.
- **Flat** art is drawn straight from above; **upright** art (knights, gear, weapons, wall fronts, ledges, stairs,
  beacons, bombs, hearts) is drawn as seen by the ¾ camera.
- Anything the game rotates (weapons, projectiles, slashes, muzzle flashes) faces **right**.
- `anchor` is the pivot pixel at 1x (double it at 2x): where the sprite sits on the world and rotates around.
- Knight sheets: 10 columns × 5 facing rows of 64×64 frames at 1x (128×128 at 2x). Columns 1–2 idle, 3–6 walk,
  7–10 run. Rows: down, down-right, right, up-right, up. Feet on the anchor. Knights are empty-handed.
  Body, armor, pants, shoes and helmet are separate layers that must line up exactly in every frame:
  draw the body first, then fit every garment to that exact pose.
- Team colour (Amber `#e39a3b`, Cyan `#3bb8c4`) only on files whose name says `team0` / `team1`.

## How to work

1. **Style lock (gate 1).** Before anything else, make one sample set for one theme: floor, floor variant,
   wall top + wall front, pit, ledge + cut bank, the four stairs, one knight row (idle + walk + run), one sword and
   one gun. Put them in `art/`, run the tools below and show the director the review sheets. Wait for approval.
   If they reject it, change direction, do not polish.
2. **One full theme (gate 2).** Finish every sprite of that theme, check, show the tiling preview, wait for approval.
3. **Everything else in batches** (other themes, then knights and gear, then weapons, effects, icons). For each
   batch: make the art, run `node check.mjs` until it reports **no errors**, run `node sheets.mjs`, **look at
   every review image yourself**, fix what looks wrong, then report to the director with the review images.
4. When generating several sprites on one canvas, leave wide transparent gaps between them and cut each one out
   with a margin, then check for fragments. When a sprite is wrong, redraw it; never patch it by stretching.
5. Keep `CHANGELOG.md` up to date: which files changed in each batch and why.

## Tools

- `node check.mjs` (or `node check.mjs art --only=tile_`) checks every PNG in `art/`: size, empty images,
  baked backgrounds, haze, stray fragments, smeared rows and columns, darker tile edges, seams where tiles repeat,
  empty animation frames and stairs that are not a full flight. Errors must be fixed; read warnings.
- `node sheets.mjs` writes `review/`: one contact sheet per group on a checkerboard, and `tiling_<theme>.png`
  showing floors 4×4, ground and pit paintings 2×2, a wall, the ledge over its cut bank and each stair on the floor,
  the way the game repeats them.

The tools need only Node 18 or newer, no install.
