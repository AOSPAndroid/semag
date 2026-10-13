/** Lockdown art manifest and loader.
 *
 * Every sprite the game draws is listed here with its file name, pixel size,
 * anchor and frame layout. The renderer asks for an asset by key; until the PNG
 * exists in /art/lockdown/ it draws a simple placeholder instead, so the game is
 * fully playable before any art is made. See /art/lockdown/ASSETS.md for the
 * brief that goes with this list.
 *
 * Conventions for every sprite:
 * - Transparent PNG, top-down view (camera looking straight down, light from the top-left).
 * - Anything that rotates (knights, weapons, projectiles, slashes) is drawn FACING RIGHT (+x).
 * - Team colours are NOT baked in unless the key says team0/team1: the renderer tints
 *   neutral sprites with an outline/ring, so one sprite serves both teams.
 * - `anchor` is the pivot in pixels from the top-left: where the sprite sits on the
 *   world position and what it rotates around.
 * - Sheets are horizontal strips of `frames` equal frames.
 */
import { WEAPONS, CLASSES } from './lockdown-engine.js';

export const ASSET_BASE = '/art/lockdown/';

const asset = (key, w, h, anchor, description, extra = {}) => Object.freeze({ key, file: `${key}.png`, size: Object.freeze([w, h]), anchor: Object.freeze(anchor), frames: 1, description, ...extra });

const tiles = ['stone', 'brass'].flatMap(theme => [
  asset(`tile_floor_${theme}`, 48, 48, [0, 0], `Seamless ${theme} arena floor tile. Must tile in all directions.`, { group: 'tiles' }),
  asset(`tile_floor_${theme}_alt`, 48, 48, [0, 0], `Variant ${theme} floor tile (cracks, rivets or a drain) mixed in at random for variety.`, { group: 'tiles' }),
  asset(`tile_wall_${theme}`, 48, 48, [0, 0], `${theme} wall block seen from above: a raised top face with a darker lower edge to read as height.`, { group: 'tiles' }),
]);
const spawnPads = [0, 1].map(team => asset(`tile_spawn_team${team}`, 48, 48, [0, 0], `Spawn floor tile tinted for team ${team === 0 ? 'Amber (warm orange)' : 'Cyan (cool teal)'}.`, { group: 'tiles' }));

const knights = Object.values(CLASSES).flatMap(cls => [0, 1].map(team => asset(
  `knight_${cls.id}_team${team}`, 256, 64, [32, 32],
  `${cls.name} knight, team ${team === 0 ? 'Amber' : 'Cyan'}, seen from above, facing right. 4-frame walk cycle strip (64x64 each). Helmet and armour should make the class readable at a glance: ${cls.id === 'striker' ? 'light armour, swept-back crest' : cls.id === 'guardian' ? 'heavy rounded plate, broad shoulders' : 'hooded, slim, cloak edges'}.`,
  { group: 'knights', frames: 4 },
)));

const weapons = Object.values(WEAPONS).flatMap(weapon => [
  asset(`weapon_${weapon.id}`, 64, 32, [12, 16], `${weapon.name} (${weapon.family}) held in the hand, pointing right; the grip sits at the anchor. ${weapon.description}`, { group: 'weapons' }),
  asset(`icon_weapon_${weapon.id}`, 48, 48, [24, 24], `HUD/lobby icon for the ${weapon.name}. Clear silhouette on a transparent background.`, { group: 'icons' }),
]);

const projectiles = [
  asset('proj_bullet', 16, 8, [8, 4], 'Standard energy round, pointing right.', { group: 'projectiles' }),
  asset('proj_pierce', 32, 10, [16, 5], 'Charged piercing bolt, longer and brighter, pointing right.', { group: 'projectiles' }),
  asset('proj_explosive', 18, 18, [9, 9], 'Charged Magnus explosive shell.', { group: 'projectiles' }),
  asset('proj_shard', 14, 6, [7, 3], 'Shard Bomb fragment, pointing right.', { group: 'projectiles' }),
  asset('proj_pellet', 8, 8, [4, 4], 'Scattergun pellet.', { group: 'projectiles' }),
];
const bombs = ['blast', 'vortex', 'shard'].map(id => asset(`bomb_${id}`, 32, 32, [16, 16], `${WEAPONS[id].name} planted on the floor (the fuse ring is drawn by the game).`, { group: 'bombs' }));

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
  ...Object.values(CLASSES).map(cls => asset(`icon_class_${cls.id}`, 64, 64, [32, 32], `${cls.name} class emblem for the lobby and scoreboard.`, { group: 'icons' })),
  ...['dash', 'bubble', 'heal', 'cloak'].map(id => asset(`icon_ability_${id}`, 48, 48, [24, 24], `Ability icon: ${id}.`, { group: 'icons' })),
];

export const MANIFEST = Object.freeze([...tiles, ...spawnPads, ...knights, ...weapons, ...projectiles, ...bombs, ...effects, ...pickups, ...pointArt, ...ui]);
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
