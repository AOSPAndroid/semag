/** Lockdown art manifest and loader.
 *
 * Every sprite the game draws is listed here with its file name, pixel size,
 * anchor and frame layout. The renderer asks for an asset by key; until the PNG
 * exists in /art/lockdown/ it draws a simple placeholder instead, so the game is
 * fully playable before any art is made. See /art/lockdown/ASSETS.md for the
 * brief that goes with this list.
 *
 * Conventions for every sprite:
 * - Transparent PNG, ¾ view (camera tilted like Spiral Knights). The game itself foreshortens the floor to 75%:
 *   FLAT art (floor, wall-top and pit tiles, the point plate, floor rings, clouds, domes, slashes and blasts) is
 *   drawn straight from above and the game squashes it; UPRIGHT art (knights, gear, weapons, beacons, bombs,
 *   hearts, wall fronts, ledges) is drawn as seen and shown at full height.
 *   light from the top-left. Floors and walls show their top; walls also show a front face.
 * - Knights turn toward the mouse like Spiral Knights: each sheet has 5 facing rows (down, down-right,
 *   right, up-right, up) and the game mirrors the right-hand rows for the left-hand directions. They never
 *   rotate. The weapon is a separate sprite the game pins to the row's hand point and rotates to the aim.
 * - Anything else that rotates (weapons, projectiles, slashes) is drawn FACING RIGHT (+x).
 * - Team colours are NOT baked in unless the key says team0/team1: the renderer tints
 *   neutral sprites with an outline/ring, so one sprite serves both teams.
 * - `anchor` is the pivot in pixels from the top-left: where the sprite sits on the
 *   world position and what it rotates around.
 * - Sheets are horizontal strips of `frames` equal frames.
 */
import { WEAPONS, CLASSES, MAPS, ARMORS, HELMETS, PANTS, SHOES } from './lockdown-engine.js';

export const ASSET_BASE = '/art/lockdown/';

const asset = (key, w, h, anchor, description, extra = {}) => Object.freeze({ key, file: `${key}.png`, size: Object.freeze([w, h]), anchor: Object.freeze(anchor), frames: 1, description, ...extra });

/** One tile set per map theme: what each arena looks like and what its '~' pits are. */
const THEME_LOOKS = Object.freeze({
  castle: { look: 'old castle courtyard: worn flagstones, moss between the stones, grey ashlar walls with battlements', pit: 'moat water, dark blue with ripples' },
  maze: { look: 'hedge labyrinth: packed earth and gravel paths, walls of trimmed green hedge with leaves on top', pit: 'overgrown sinkhole, dark green' },
  foundry: { look: 'clockwork foundry: riveted iron floor plates, brass machinery walls with gears and pipes', pit: 'molten lava, glowing orange with a dark crust' },
  ruins: { look: 'sunken temple: pale sandstone with carved glyphs, weathered pillars and broken walls', pit: 'clear flooded pool, teal water over sunken tiles' },
  graveyard: { look: 'gloomy graveyard: dark soil and slate paths, mossy tombstones and crypt walls', pit: 'open crevice into darkness' },
  skyway: { look: 'floating sky platforms: polished stone panels with gold trim, low balustrade walls', pit: 'open sky far below, soft clouds' },
});
const tiles = [...new Set(Object.values(MAPS).map(map => map.theme))].flatMap(theme => {
  const style = THEME_LOOKS[theme]?.look || theme, pit = THEME_LOOKS[theme]?.pit || 'chasm';
  return [
    asset(`tile_floor_${theme}`, 48, 48, [0, 0], `Seamless floor tile — ${style}. Must tile in all directions.`, { group: 'tiles' }),
    asset(`tile_floor_${theme}_alt`, 48, 48, [0, 0], `Variant floor tile for ${theme} (cracks, a drain, a plant or rubble) mixed in at random.`, { group: 'tiles' }),
    asset(`tile_wall_top_${theme}`, 48, 48, [0, 0], `Overhead cap material for substantial ${theme} architecture — ${style}. The renderer raises the cap 72 px; neighbouring surfaces join seamlessly.`, { group: 'tiles' }),
    asset(`tile_wall_front_${theme}`, 144, 72, [0, 0], `South-facing ${theme} architectural facade, three cells wide. Broad masonry or machinery, pale upper trim, warm dark sides, no end caps; the renderer samples consecutive thirds across the wall. Must tile horizontally.`, { group: 'tiles' }),
    asset(`tile_pit_${theme}`, 48, 48, [0, 0], `Pit tile ('~'): ${pit}. Knights cannot walk on it but shots fly over it. Must tile in all directions; the game adds the edge lip.`, { group: 'tiles' }),
  ];
});
// Two-floor maps: the cliff face under raised floor, and stairs between floors (each named for the
// direction it climbs on screen). The raised floor itself reuses the theme's floor tiles, lifted 24 px.
const floorThemes = [...new Set(Object.values(MAPS).filter(map => map.twoFloors).map(map => map.theme))];
const twoFloorTiles = floorThemes.flatMap(theme => {
  const style = THEME_LOOKS[theme]?.look || theme;
  return [
    asset(`tile_ledge_${theme}`, 48, 24, [0, 0], `Ledge face under the raised floor of a two-floor ${theme} map — ${style}: the 24 px drop from the upper floor to the lower one, seen from the front. Lit top edge, darker toward the bottom; must tile horizontally. Lighter and less blocky than a wall front, so it reads as a step down, not a wall.`, { group: 'tiles' }),
    ...[['up', 'climbing away from the camera (north): steps rise up the screen, from the lower floor at the bottom edge to the upper floor 24 px higher at the top'],
      ['down', 'climbing toward the camera (south): the lower floor is at the top edge and the treads rise toward the viewer, so only foreshortened treads show'],
      ['left', 'climbing to the left (west): treads rise from right to left with the stepped side face visible below them'],
      ['right', 'climbing to the right (east): treads rise from left to right with the stepped side face visible below them']].map(([dir, how]) =>
      asset(`tile_stairs_${theme}_${dir}`, 48, 60, [0, 0], `Stone stairs between the two floors of a ${theme} map, ${how}, drawn as seen by the tilted camera (not flat: the game does not squash it). 48 px wide; 60 px tall = 36 px of foreshortened tile depth plus 24 px of storey height. Same materials as the ${theme} floor and ledge.`, { group: 'tiles' })),
  ];
});
const spawnPads = [0, 1].map(team => asset(`tile_spawn_team${team}`, 48, 48, [0, 0], `Spawn floor tile tinted for team ${team === 0 ? 'Amber (warm orange)' : 'Cyan (cool teal)'}.`, { group: 'tiles' }));
// Approved painted-fantasy landmarks: visual dressing derived from the existing map.
const environmentArt = [
  asset('base_heal_station', 48, 64, [24, 56], 'A rounded red heart hovering above an ivory-and-bronze healing socket, with a gentle green underglow. Upright art; three stations mark each existing healing base.', { group: 'environment' }),
  ...Object.keys(THEME_LOOKS).flatMap(theme => [
    asset(`terrain_ground_${theme}`, 192, 192, [0, 0], `Continuous quiet overhead ${theme} ground painting over a four-by-four-cell court. Broad pavers or grass match approved concept A; no camera perspective or standing objects. Seamless at the outer edges.`, { group: 'environment' }),
    asset(`terrain_pit_${theme}`, 144, 144, [0, 0], `Continuous overhead ${theme} pit painting across three cells, with broad water, lava, cloud or crevice forms. No shore or camera perspective baked in. Seamless at the outer edges.`, { group: 'environment' }),
    asset(`tile_bank_front_${theme}`, 96, 40, [0, 0], `Upright cut bank below the ${theme} walking surface, two cells wide: a lit upper lip, darker descending stone, earth or metal, and restrained hanging roots. Tiles horizontally; the renderer fits the drop to the pit width.`, { group: 'environment' }),
    asset(`prop_border_${theme}`, 128, 96, [64, 88], `Generous rounded ${theme} border clump: foliage, moss, rocks or clockwork pipes. Upright, neutral materials, transparent background. Large readable masses dress the wall foot while leaving the fighting court clear.`, { group: 'environment' }),
    asset(`prop_column_${theme}`, 64, 128, [32, 120], `Stout ${theme} architectural pillar, softly bevelled, with a rounded neutral bronze or stone cap and a small warm-neutral lantern. Upright, feet at the bottom anchor; no floor or cast shadow.`, { group: 'environment' }),
    asset(`prop_vines_${theme}`, 96, 96, [48, 8], `Asymmetric ${theme} wall dressing: a broad upper spray and descending ivy, roots or restrained pipe fittings. Transparent around the silhouette. The anchor hangs over the wall cap.`, { group: 'environment' }),
  ]),
  asset('base_alcove', 192, 144, [96, 136], 'The approved concept healing-base facade: a substantial warm ivory arch, two bronze-capped pillars, a dark closed masonry recess and two neutral lanterns. No floor or hearts baked in; mounted against the existing base wall.', { group: 'environment' }),
  ...[0, 1].map(team => asset(`base_court_team${team}`, 144, 336, [0, 0], `Overhead ivory-stone court for the existing three-by-seven-cell healing base. A restrained bronze perimeter carries a narrow ${team ? 'Cyan #3bb8c4' : 'Amber #e39a3b'} inlay; large paving, opaque interior, no standing objects or perspective.`, { group: 'environment' })),
  ...[0, 1].map(team => asset(`base_banner_team${team}`, 48, 128, [24, 120], `Ivory-and-bronze banner post with a softly folded ${team ? 'Cyan #3bb8c4' : 'Amber #e39a3b'} pennant and an ivory geometric rune. Upright, feet at the anchor, transparent surroundings.`, { group: 'environment' })),
];

/** The five drawn facings of a knight sheet, top row first. Left-hand directions mirror the
 * right-hand rows. `hand` is where that row's weapon grip is pinned (pixels in the 64x64 frame);
 * facing away from the camera the weapon is drawn behind the body. */
export const KNIGHT_FACINGS = Object.freeze([
  Object.freeze({ id: 'down', label: 'facing the camera', hand: Object.freeze([22, 44]), weaponBehind: false }),
  Object.freeze({ id: 'down_right', label: 'three-quarter front, turned right', hand: Object.freeze([40, 44]), weaponBehind: false }),
  Object.freeze({ id: 'right', label: 'side view facing right', hand: Object.freeze([42, 42]), weaponBehind: false }),
  Object.freeze({ id: 'up_right', label: 'three-quarter back, turned right', hand: Object.freeze([42, 38]), weaponBehind: true }),
  Object.freeze({ id: 'up', label: 'back to the camera', hand: Object.freeze([44, 38]), weaponBehind: true }),
]);
const facingList = KNIGHT_FACINGS.map((facing, row) => `row ${row + 1} ${facing.id} (${facing.label}, hand at ${facing.hand.join(', ')})`).join('; ');
/** Shared columns for the body and every worn layer; run columns are ready for speed-based selection. */
export const KNIGHT_ANIMATION = Object.freeze({
  frameSize: Object.freeze([64, 64]), columns: 10,
  idle: Object.freeze({ start: 0, frames: 2 }),
  walk: Object.freeze({ start: 2, frames: 4 }),
  run: Object.freeze({ start: 6, frames: 4 }),
});
// Every class wears this common body. Equipment is a separate registered layer.
const characters = [0, 1].map(team => asset(
  `character_base_team${team}`, 640, 320, [32, 58],
  `Smoothly shaded, rounded casual character in a cream T-shirt, charcoal shorts and shoes, with uncovered hair and bare hands. Team ${team === 0 ? 'Amber' : 'Cyan'} on shirt trim only. Ten columns by five rows of 64x64 frames: columns 1–2 idle, 3–6 walk, 7–10 run (alternating contact and flight poses). Feet at 32, 58; ${facingList}. Empty-handed. All classes use this same body beneath armor.`,
  { group: 'characters', frames: KNIGHT_ANIMATION.columns, rows: KNIGHT_FACINGS.length, facings: KNIGHT_FACINGS },
));
const armors = Object.values(ARMORS).filter(armor => armor.id !== 'none').flatMap(armor => [0, 1].map(team => asset(
  `armor_${armor.id}_team${team}`, 640, 320, [32, 58],
  `${armor.name} torso garment-only overlay: ${armor.description} Smooth rounded materials, softly painted shading. Team ${team === 0 ? 'Amber' : 'Cyan'} on narrow trim only. Match the common body's exact ten-column, five-row grid: 1–2 idle, 3–6 walk, 7–10 run. Draw over the body with the same row, frame and mirroring. No headgear, pants, shoes or weapons; uncovered skin, hands, hair and clothing remain transparent. ${facingList}.`,
  { group: 'armors', frames: KNIGHT_ANIMATION.columns, rows: KNIGHT_FACINGS.length, facings: KNIGHT_FACINGS },
)));

// Helmets, pants and shoes are separate overlay sheets drawn on top of the body outfit, in the same
// 10×5 grid with the same feet point, so any helmet + armor + pants + shoes combination lines up.
const GEAR_LOOKS = Object.freeze({
  helmet: {
    sallet: 'a rounded steel sallet with a narrow eye slit and a short tail at the back',
    visor: 'a slim dark tactical visor wrapping the eyes with a cyan glowing lens and a small earpiece',
    horned: 'a dented iron cap with two big curved bone horns',
    hood: 'a deep charcoal-violet cloth hood that shadows the face (eyes faintly glow)',
    lampcap: 'a sooty leather miner cap with a brass lamp on the front throwing a small yellow glow',
    feather: 'a jaunty green felt cap with a long red feather sweeping back',
    bucket: 'a literal dented metal bucket worn as a helm, with eye holes punched in it',
    circlet: 'a thin gold circlet with a small green gem on the forehead over loose hair',
    goggles: 'brass aviator goggles pushed up on a leather strap over a bare head',
  },
  pants: {
    greaves: 'steel knee greaves and shin plates over dark trousers',
    leggings: 'tight dark-blue running leggings with a light stripe down the side',
    chausses: 'grey chainmail chausses (ring texture) to the ankle',
    breeches: 'cream fencing breeches buckled below the knee with long white socks',
    sapper: 'olive canvas trousers with knee pads and a fuse-cord pouch on the thigh',
    cargo: 'khaki cargo trousers with big side pockets and a holster strap on the thigh',
    kilt: 'a red-and-green tartan kilt with a leather sporran',
  },
  shoes: {
    sneakers: 'white running sneakers with a bright sole stripe',
    sabatons: 'chunky segmented iron sabatons',
    dashboots: 'sleek blue boots with small silver wings at the ankles',
    spurs: 'brown riding boots with gold rowel spurs at the heel',
    treads: 'heavy black rubber-soled work boots with thick treads',
    clogs: 'springy wooden clogs on coiled steel springs',
    sandals: 'simple leather sandals with straps and a little herb sprig tucked in',
    striders: 'light reed-and-cork sandals with wide flat paddles under the soles, beaded with water drops',
    magma: 'thick black obsidian-soled boots with glowing orange cracks',
    hover: 'chunky silver boots with small glowing cyan thrusters under the soles (a soft glow below the feet)',
    quicksilver: 'thin liquid-silver slippers with a mirror sheen and little speed streaks',
  },
});
const GEAR_PIECES = Object.freeze({ helmet: HELMETS, pants: PANTS, shoes: SHOES });
const gear = Object.entries(GEAR_LOOKS).flatMap(([slot, looks]) => Object.entries(looks).flatMap(([id, look]) => [
  asset(`gear_${slot}_${id}`, 640, 320, [32, 58],
    `${GEAR_PIECES[slot][id].name} overlay: ONLY ${look}, nothing else (transparent everywhere else). It is drawn on top of every body outfit, so it must sit exactly where the ${slot === 'helmet' ? 'head' : slot === 'pants' ? 'hips and legs' : 'feet'} of character_base are in each frame: same 10 columns × 5 facing rows of 64x64 frames; 1–2 idle, 3–6 walk, 7–10 run; feet at 32, 58. Neutral colours (no team colour).`,
    { group: 'gear', frames: KNIGHT_ANIMATION.columns, rows: KNIGHT_FACINGS.length, facings: KNIGHT_FACINGS }),
  asset(`icon_${slot}_${id}`, 48, 48, [24, 24], `${GEAR_PIECES[slot][id].name} equipment icon: ${look}. Clear silhouette on a transparent background.`, { group: 'icons' }),
]));

const weapons = Object.values(WEAPONS).flatMap(weapon => [
  asset(`weapon_${weapon.id}`, 64, 32, [12, 16], `${weapon.name} (${weapon.family}) held in the hand, pointing right; the grip sits at the anchor. ${weapon.description}`, { group: 'weapons' }),
  asset(`icon_weapon_${weapon.id}`, 48, 48, [24, 24], `HUD/lobby icon for the ${weapon.name}. Clear silhouette on a transparent background.`, { group: 'icons' }),
]);

const projectiles = [
  asset('proj_bullet', 16, 8, [8, 4], 'Standard energy round, pointing right. Hitbox is a 5 px radius at the bright tip.', { group: 'projectiles' }),
  asset('proj_pierce', 32, 10, [16, 5], 'Charged piercing bolt, longer and brighter, pointing right (9 px hitbox radius).', { group: 'projectiles' }),
  asset('proj_explosive', 18, 18, [9, 9], 'Charged hand-cannon round that explodes on impact.', { group: 'projectiles' }),
  asset('proj_ricochet', 16, 8, [8, 4], 'Ricochet Coil bolt: electric blue, pointing right; it bounces off walls.', { group: 'projectiles' }),
  asset('proj_pulse', 32, 64, [16, 32], 'Ripple Caster wave seen from above: a curved band of light, convex side facing right. The game scales it as the wave widens.', { group: 'projectiles' }),
  asset('proj_catalyst', 14, 14, [7, 7], 'Sticky golden catalyst orb that clings to a knight.', { group: 'projectiles' }),
  asset('proj_detonator', 18, 18, [9, 9], 'Red-orange detonator orb that sets off stuck catalysts.', { group: 'projectiles' }),
  asset('proj_thorn', 14, 6, [7, 3], 'Briar Blade thorn, green and sharp, pointing right.', { group: 'projectiles' }),
  asset('proj_wave', 48, 64, [24, 32], 'Umbral Greatblade shadow wave: a dark violet crescent, convex side facing right. The game scales it to its size.', { group: 'projectiles' }),
  asset('proj_shard', 14, 6, [7, 3], 'Splinter Bomb fragment, pointing right.', { group: 'projectiles' }),
];
const bombs = Object.values(WEAPONS).filter(weapon => weapon.family === 'bomb').map(weapon => asset(`bomb_${weapon.id}`, 32, 32, [16, 24], `${weapon.name} planted on the floor, seen from the ¾ camera (the fuse ring is drawn by the game).`, { group: 'bombs' }));

const effects = [
  asset('fx_slash', 384, 96, [24, 48], 'Blade swipe arc, 4-frame strip (96x96 each), sweeping from top to bottom, pivot at the left middle (the wielder).', { group: 'effects', frames: 4 }),
  asset('fx_spin', 512, 128, [64, 64], 'Full 360° spin slash, 4-frame strip (128x128 each), centred.', { group: 'effects', frames: 4 }),
  asset('fx_slam', 640, 128, [64, 64], 'Ground slam shockwave, 5-frame strip (128x128 each), centred.', { group: 'effects', frames: 5 }),
  asset('fx_explosion', 768, 128, [64, 64], 'Bomb explosion, 6-frame strip (128x128 each), centred.', { group: 'effects', frames: 6 }),
  asset('fx_vortex', 512, 128, [64, 64], 'Swirling vortex pull, 4-frame looping strip (128x128 each).', { group: 'effects', frames: 4 }),
  asset('fx_muzzle', 96, 32, [0, 16], 'Muzzle flash, 3-frame strip (32x32 each), pointing right.', { group: 'effects', frames: 3 }),
  asset('fx_hit', 192, 48, [24, 24], 'Impact spark, 4-frame strip (48x48 each).', { group: 'effects', frames: 4 }),
  asset('fx_bubble', 192, 192, [96, 96], 'Guardian dome seen from above: translucent ring with a soft rim. The game tints and scales it.', { group: 'effects' }),
  asset('fx_heal', 256, 256, [128, 128], 'Healing pulse ring, soft green-white, centred.', { group: 'effects' }),
  asset('fx_cloak', 64, 64, [32, 32], 'Shimmer distortion overlay for a cloaked Recon.', { group: 'effects' }),
  asset('fx_mark', 32, 32, [16, 16], 'Target mark shown over a marked enemy.', { group: 'effects' }),
  asset('fx_dash', 64, 64, [32, 32], 'Speed streak behind a dashing Striker, pointing right.', { group: 'effects' }),
  asset('fx_guard', 64, 80, [32, 40], 'The shield every knight raises with right click: a translucent, faintly hexagonal energy dome around a standing knight, neutral white-blue (the game tints the rim by team and shows its health).', { group: 'effects' }),
  asset('fx_cloud_burn', 192, 192, [96, 96], 'Ember Haze cloud on the floor, seen from the ¾ camera: smouldering orange smoke with sparks. The game scales it to the cloud radius.', { group: 'effects' }),
  asset('fx_cloud_freeze', 192, 192, [96, 96], 'Frost Haze cloud on the floor: pale blue freezing mist with ice glints.', { group: 'effects' }),
  ...['burn', 'poison', 'shock', 'freeze', 'chill', 'curse'].map(id => asset(`fx_status_${id}`, 12, 12, [6, 6], `Tiny status icon shown above a knight's head: ${({ burn: 'flame', poison: 'green drop', shock: 'lightning bolt', freeze: 'snowflake', chill: 'small light-blue frost crystal', curse: 'purple broken-chain skull' })[id]}.`, { group: 'effects' })),
  asset('fx_cloud_poison', 192, 192, [96, 96], 'Venom Veil cloud on the floor: sickly green toxic fog with bubbles.', { group: 'effects' }),
  asset('fx_cloud_shock', 192, 192, [96, 96], 'Storm Haze cloud on the floor: dark blue-grey storm fog with little lightning crackles.', { group: 'effects' }),
  asset('fx_cloud_curse', 192, 192, [96, 96], 'Hex Haze cloud on the floor: swirling violet smoke with faint runes.', { group: 'effects' }),
];
const pickups = [
  asset('pickup_heart', 32, 32, [16, 16], 'Heart dropped by a knocked-out knight; heals whoever grabs it. Bright red, chunky, readable at a glance. The game bobs it and adds the shadow.', { group: 'pickups' }),
  asset('fx_regen', 16, 16, [8, 8], 'Small green plus that drifts up from a knight healing inside their base.', { group: 'pickups' }),
];
const pointArt = [
  asset('point_base', 160, 160, [80, 80], 'Round neutral bronze-and-ivory control-point machine drawn straight from above, with a solid dark metal hub and inset white lamps. Transparent outside the disc. May be supplied at exactly 2x (320x320). The game foreshortens it into an oval and draws the capture indicator, beacon and letter separately.', { group: 'points' }),
  asset('point_beacon', 48, 96, [24, 88], 'Low broad neutral crystal core at the centre of a control point, upright in the ¾ view; the game colours its light by owner.', { group: 'points' }),
];
const ui = [
  ...Object.values(ARMORS).map(armor => asset(`icon_armor_${armor.id}`, 48, 48, [24, 24], `${armor.name} equipment icon. Neutral clothing or armor silhouette on a transparent background.`, { group: 'icons' })),
  ...Object.values(CLASSES).map(cls => asset(`icon_class_${cls.id}`, 64, 64, [32, 32], `${cls.name} class emblem for the lobby and scoreboard.`, { group: 'icons' })),
  asset('ui_crosshair', 48, 48, [24, 24], 'Aiming reticle drawn at the mouse: bold white ring with a dark outline, four short ticks and a centre dot, readable on every floor. The game draws the charge arc around it.', { group: 'icons' }),
  asset('ui_boost_bar', 48, 12, [24, 6], 'Frame for the Striker nitro bar shown under the knight: a slim dark capsule with a metallic rim, empty inside (the game fills it 40 px wide, 5 px tall, centred).', { group: 'icons' }),
  ...['dash', 'bubble', 'heal', 'cloak'].map(id => asset(`icon_ability_${id}`, 48, 48, [24, 24], `Ability icon: ${id}.`, { group: 'icons' })),
];

export const MANIFEST = Object.freeze([...tiles, ...twoFloorTiles, ...spawnPads, ...environmentArt, ...characters, ...armors, ...gear, ...weapons, ...projectiles, ...bombs, ...effects, ...pickups, ...pointArt, ...ui]);
export const MANIFEST_BY_KEY = Object.freeze(Object.fromEntries(MANIFEST.map(entry => [entry.key, entry])));

/** Loads the sprites listed in /art/lockdown/index.json (written by
 * tools/lockdown-art-index.mjs) in the background. Keys without art keep their
 * placeholder, so the page never requests files that do not exist. */
export function createAssetLibrary({ base = ASSET_BASE, onChange = () => {} } = {}) {
  const loaded = new Map();
  let version = 0;
  const load = entry => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => { if (image.naturalWidth > 0) { loaded.set(entry.key, image); version++; onChange(entry.key); } };
    image.onerror = () => {};
    image.src = base + entry.file;
  };
  if (typeof Image === 'function' && typeof fetch === 'function') {
    fetch(`${base}index.json`, { cache: 'no-cache' }).then(response => response.ok ? response.json() : { files: [] }).then(index => {
      const present = new Set(Array.isArray(index?.files) ? index.files : []);
      for (const entry of MANIFEST) if (present.has(entry.file)) load(entry);
    }).catch(() => {});
  }
  return {
    get: key => loaded.get(key) || null,
    entry: key => MANIFEST_BY_KEY[key] || null,
    get version() { return version; },
    get count() { return loaded.size; },
  };
}
