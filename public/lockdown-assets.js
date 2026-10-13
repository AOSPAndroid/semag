/** Lockdown art manifest and loader.
 *
 * Every sprite the game draws is listed here with its file name, pixel size,
 * anchor and frame layout. The renderer asks for an asset by key; until the PNG
 * exists in /art/lockdown/ it draws a simple placeholder instead, so the game is
 * fully playable before any art is made. See /art/lockdown/ASSETS.md for the
 * brief that goes with this list.
 *
 * Conventions for every sprite:
 * - Transparent PNG, ¾ view (camera tilted about 60° down, like Spiral Knights or Enter the Gungeon),
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
import { WEAPONS, CLASSES, MAPS, ARMORS } from './lockdown-engine.js';

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
    asset(`tile_wall_top_${theme}`, 48, 48, [0, 0], `Top face of a wall block — ${style}. The game raises it 24 px above the floor; neighbouring tiles must join seamlessly.`, { group: 'tiles' }),
    asset(`tile_wall_front_${theme}`, 48, 24, [0, 0], `Front (south-facing) face of a ${theme} wall block, drawn under the top face wherever floor lies below. Darker than the top, lit top edge, shadowed bottom edge. Must tile horizontally.`, { group: 'tiles' }),
    asset(`tile_pit_${theme}`, 48, 48, [0, 0], `Pit tile ('~'): ${pit}. Knights cannot walk on it but shots fly over it. Must tile in all directions; the game adds the edge lip.`, { group: 'tiles' }),
  ];
});
const spawnPads = [0, 1].map(team => asset(`tile_spawn_team${team}`, 48, 48, [0, 0], `Spawn floor tile tinted for team ${team === 0 ? 'Amber (warm orange)' : 'Cyan (cool teal)'}.`, { group: 'tiles' }));

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
const knights = Object.values(CLASSES).flatMap(cls => [0, 1].map(team => asset(
  `knight_${cls.id}_team${team}`, 384, 320, [32, 58],
  `${cls.name} knight, team ${team === 0 ? 'Amber' : 'Cyan'}, ¾ view, EMPTY-HANDED (the game draws the weapon at each row's hand point). Sheet of 64x64 frames: 6 columns × 5 facing rows. Columns 1–2 idle (gentle breathing bob), columns 3–6 walk cycle. Rows: ${facingList}. Left-facing directions are mirrored by the game. Feet rest on (32, 58) in every frame; the knight is about 36 px wide and 50 px tall with a big chibi helmet. Class must read at a glance from every side: ${cls.id === 'striker' ? 'light armour, swept-back crest plume, short cape' : cls.id === 'guardian' ? 'heavy rounded plate, broad pauldrons, flat-topped great helm' : 'slim, hooded cloak over a light helm, scarf'}. Team colour on the plume/cloak/trim.`,
  { group: 'knights', frames: 6, rows: KNIGHT_FACINGS.length, facings: KNIGHT_FACINGS },
)));

// Armor chooses the outfit; class abilities do not change the character's clothes.
const characters = ['base', 'ballistic'].flatMap(outfit => [0, 1].map(team => asset(
  `character_${outfit}_team${team}`, 384, 320, [32, 58],
  `${outfit === 'base' ? 'Unarmored character in a white T-shirt, charcoal shorts and simple shoes, with an uncovered head and bare hands' : 'The same casual character wearing a neutral padded ballistic vest over the T-shirt'}. Team ${team === 0 ? 'Amber' : 'Cyan'} color on narrow clothing trim only. 6 columns by 5 facing rows of 64x64 frames; two idle and four walking poses. Feet at 32, 58; hands follow the same facing points as the armored outfits. Empty-handed.`,
  { group: 'characters', frames: 6, rows: KNIGHT_FACINGS.length, facings: KNIGHT_FACINGS },
)));

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
  ...['burn', 'poison', 'shock', 'freeze'].map(id => asset(`fx_status_${id}`, 12, 12, [6, 6], `Tiny status icon shown above a knight's head: ${id === 'burn' ? 'flame' : id === 'poison' ? 'green drop' : id === 'shock' ? 'lightning bolt' : 'snowflake'}.`, { group: 'effects' })),
];
const pickups = [
  asset('pickup_heart', 32, 32, [16, 16], 'Heart dropped by a knocked-out knight; heals whoever grabs it. Bright red, chunky, readable at a glance. The game bobs it and adds the shadow.', { group: 'pickups' }),
  asset('fx_regen', 16, 16, [8, 8], 'Small green plus that drifts up from a knight healing inside their base.', { group: 'pickups' }),
];
const pointArt = [
  asset('point_base', 160, 160, [80, 80], 'Control point floor plate seen from above, neutral grey, with a centre emblem area. The game draws the capture ring and letter on top.', { group: 'points' }),
  asset('point_beacon', 48, 96, [24, 88], 'Beacon pylon at the centre of a control point; the game tints its light by owner.', { group: 'points' }),
];
const ui = [
  ...Object.values(ARMORS).map(armor => asset(`icon_armor_${armor.id}`, 48, 48, [24, 24], `${armor.name} equipment icon. Neutral clothing or armor silhouette on a transparent background.`, { group: 'icons' })),
  ...Object.values(CLASSES).map(cls => asset(`icon_class_${cls.id}`, 64, 64, [32, 32], `${cls.name} class emblem for the lobby and scoreboard.`, { group: 'icons' })),
  ...['dash', 'bubble', 'heal', 'cloak'].map(id => asset(`icon_ability_${id}`, 48, 48, [24, 24], `Ability icon: ${id}.`, { group: 'icons' })),
];

export const MANIFEST = Object.freeze([...tiles, ...spawnPads, ...characters, ...knights, ...weapons, ...projectiles, ...bombs, ...effects, ...pickups, ...pointArt, ...ui]);
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
