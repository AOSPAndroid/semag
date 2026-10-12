import { MAPS as BASE_MAPS } from './voxel-maps.js';

const freeze = Object.freeze;
const point = (x, z, y = 0) => freeze({ x, y, z });
// Positions belong to each arena. Quarter turns change the real silhouette,
// not just the paint. Low parts make stepping stones; taller parts stop shots.
const PLANS = {
  courtyard: [
    ['tea', 'tea-cart', 'Abandoned garden tea cart', -8, -3, 0, 'TEA'],
    ['statue', 'relic', 'Broken chess king', 7, 13, 1, 'KING'],
    ['garden', 'planter', 'Overgrown shelter', 17, -7, 0, 'GARDEN'],
    ['picnic', 'table', 'Overturned picnic barricade', -7, 8, 1, 'PICNIC'],
  ],
  depot: [
    ['battery', 'generator', 'Forklift charging island', -6, -3, 1, 'CHARGE'],
    ['dispatch', 'locker', 'Lost parcel sorting bank', 8, 12, 0, 'LOST'],
    ['cable', 'reel', 'Oversized cable drums', -17, -17, 0, 'CABLE'],
    ['returns', 'tea-cart', 'Abandoned returns cart', 17, -11, 1, 'RETURN'],
  ],
  canal: [
    ['boat', 'sled', 'Beached canal rescue boat', -9, 2, 1, 'RESCUE'],
    ['fish', 'stall', 'Fishmonger ice counter', 15, -13, 0, 'FISH'],
    ['pump', 'pipe', 'Emergency lock pump', -19, -16, 0, 'PUMP'],
    ['flowers', 'planter', 'Quayside flower blockade', 16, 16, 1, 'FLEURS'],
  ],
  rooftops: [
    ['signal', 'screen', 'Pirate broadcast station', -4, 11, 0, 'ON AIR'],
    ['laundry', 'locker', 'Rooftop laundry machines', 7, 6, 1, 'WASH'],
    ['vent', 'pipe', 'Bent ventilation duct', -19, -3, 0, 'VENT'],
    ['solar', 'table', 'Dislodged solar panel bank', 18, -12, 1, 'SOLAR'],
  ],
  foundry: [
    ['press', 'generator', 'Retired hydraulic press', -7, -4, 0, 'PRESS'],
    ['wire', 'reel', 'Copper winding spools', 10, 8, 1, 'COPPER'],
    ['coolant', 'pipe', 'Cracked coolant manifold', 16, -12, 0, 'COOLANT'],
    ['tools', 'locker', 'Night shift tool lockers', -17, 16, 0, 'SHIFT'],
  ],
  bastion: [
    ['beacon', 'screen', 'Broken signal console', 7, 11, 1, 'SOS'],
    ['relic', 'relic', 'Toppled signal idol', -7, -9, 0, 'RELAY'],
    ['garden', 'planter', 'Reclaimed bunker garden', 17, 16, 0, 'SEEDS'],
    ['cable', 'reel', 'Field antenna cable drums', -18, -17, 1, 'COMMS'],
  ],
  paris: [
    ['espresso', 'tea-cart', 'Boulevard espresso cart', -7, 10, 0, 'CAFE'],
    ['metro', 'locker', 'Abandoned metro ticket bank', 9, 13, 1, 'METRO'],
    ['terrace', 'table', 'Overturned bistro terrace', -9, -12, 1, 'BISTRO'],
    ['florist', 'planter', 'Florist shop barricade', -15, 7, 0, 'FLEURS'],
  ],
  snow: [
    ['rescue', 'sled', 'Stranded snow rescue sled', -19, 10.5, 0, 'RESCUE'],
    ['radio', 'screen', 'Polar distress station', 9, -16, 1, 'SOS'],
    ['heater', 'generator', 'Emergency heating skid', 6, 2, 0, 'HEAT'],
    ['sample', 'locker', 'Frozen sample freezers', -9, -17, 0, 'ICE'],
  ],
  sewers: [
    ['valve', 'pipe', 'Emergency valve elbow', -11.5, -15, 0, 'VALVE'],
    ['filters', 'reel', 'Collector filter drums', 15.5, 16, 1, 'FILTER'],
    ['service', 'generator', 'Old pump service generator', -4.5, 5.5, 0, 'PUMP'],
    ['lost', 'locker', 'Drain workers lost property', 5, -5.5, 1, 'LOST'],
  ],
  trading: [
    ['screens', 'screen', 'Fallen market screen bank', 0, -8, 0, 'SELL'],
    ['coffee', 'tea-cart', 'After hours espresso island', 0, 8, 1, 'COFFEE'],
    ['archive', 'locker', 'Emergency compliance archive', -10, 0, 0, 'FILES'],
    ['ticker', 'screen', 'Upper floor panic ticker', 17.5, -1, 1, 'CRASH', 3.2],
  ],
  market: [
    ['noodle', 'stall', 'Noodle cart barricade', 4.5, -12, 1, 'NOODLES'],
    ['fruit', 'planter', 'Stacked fruit display', -7, 2, 0, 'FRUIT'],
    ['tea', 'tea-cart', 'Night market tea stand', 5, 11, 0, 'TEA'],
    ['games', 'screen', 'Abandoned arcade cabinet bank', 1, .5, 1, 'INSERT'],
  ],
  lockdown: [
    ['laundry', 'locker', 'Laundry room barricade', -6, 2, 0, 'WASH'],
    ['power', 'generator', 'Emergency power island', 6, -7, 1, 'POWER'],
    ['canteen', 'table', 'Overturned canteen tables', -7.5, -10, 1, 'MESS'],
    ['repair', 'reel', 'Maintenance cable drums', 7, 12, 0, 'REPAIR'],
  ],
  medieval: [
    ['cart', 'wagon', 'Broken merchant wagon', -8, 4, 1, 'TRADE'],
    ['throne', 'throne', 'Abandoned stone throne', 8, -12, 0, 'KING'],
    ['forge', 'forge', 'Blacksmith bellows and anvil', 12, 17, 0, 'FORGE'],
    ['feast', 'table', 'Overturned great hall feast', -10.5, -17, 1, 'FEAST'],
  ],
};

const PALETTES = {
  courtyard: ['#97886c', '#657c57', '#e0c89a'], depot: ['#667b83', '#a2804d', '#e9b55c'],
  canal: ['#849c9d', '#527b81', '#d9b877'], rooftops: ['#78898d', '#547c87', '#a3cbd1'],
  foundry: ['#7f6d58', '#596c74', '#e5ac62'], bastion: ['#889580', '#617e70', '#d2c68e'],
  paris: ['#89694d', '#496d61', '#e8c596'], snow: ['#8ca7b1', '#507887', '#e5bb78'],
  sewers: ['#777f62', '#486b64', '#cbbc77'], trading: ['#7e919d', '#274857', '#77d4cb'],
  market: ['#9b764f', '#538882', '#edb67f'], lockdown: ['#75878c', '#52696e', '#d7bb74'],
  medieval: ['#98784e', '#747d66', '#dbc499'],
};

// [part, x, y, z, width, height, depth, palette index]. Every visible mass is
// also a collider; the art layer adds only thin surface paint.
const SHAPES = {
  'tea-cart': [['base', -1.4, 0, -.7, 2.8, .48, 1.4, 0], ['counter', -1.4, .48, -.7, 2.8, .36, 1.4, 1], ['machine', .45, .84, -.52, .7, .72, .72, 1]],
  screen: [['base', -1.45, 0, -.7, 2.9, .8, 1.4, 0], ['display-left', -1.34, .8, -.28, 1.2, 1.05, .38, 1], ['display-right', .14, .8, -.28, 1.2, 1.05, .38, 1]],
  pipe: [['long', -1.45, 0, -.68, 2.9, .94, 1.36, 1], ['elbow', .12, 0, .68, 1.33, .78, 1.05, 0]],
  sled: [['skid', -1.5, 0, -.7, 3, .48, 1.4, 0], ['hood', -.25, .48, -.7, 1.75, .46, 1.4, 1], ['seat', -1.3, .48, -.6, .6, .65, 1.2, 0]],
  locker: [['cabinet', -1.45, 0, -.65, 1.2, 1.85, 1.3, 1], ['fallen', -.25, 0, -.65, 1.7, .72, 1.3, 0]],
  planter: [['bed', -1.5, 0, -.72, 3, .72, 1.44, 0], ['shrubs', -.9, .72, -.5, 1.8, .47, 1, 1]],
  table: [['panel', -1.5, 0, -.22, 3, 1.4, .44, 0], ['bench', -1.5, 0, .65, 3, .48, .7, 1]],
  generator: [['skid', -1.4, 0, -.75, 2.8, .48, 1.5, 0], ['housing', -.8, .48, -.66, 1.6, 1.15, 1.32, 1], ['battery', .8, .48, -.65, .6, .46, 1.3, 0]],
  reel: [['drum-left', -1.45, 0, -.65, 1.25, 1.25, 1.3, 0], ['drum-right', .1, 0, -.65, 1.25, .75, 1.3, 1]],
  relic: [['plinth', -1.1, 0, -.8, 2.2, .6, 1.6, 0], ['chest', -.7, .6, -.64, 1.4, .72, 1.28, 1], ['crown', -.42, 1.32, -.45, .84, .48, .9, 0]],
  stall: [['counter', -1.5, 0, -.75, 3, .94, 1.5, 0], ['icebox', .5, .94, -.5, .75, .52, 1, 1]],
  wagon: [['chassis', -1.5, 0, -.75, 3, .6, 1.5, 0], ['load', -.2, .6, -.65, 1.5, .65, 1.3, 1], ['wheel-front', -.98, .1, -.88, .6, .6, .18, 1], ['wheel-back', .6, .1, .75, .6, .6, .18, 1]],
  throne: [['dais', -1.3, 0, -.85, 2.6, .48, 1.7, 0], ['seat', -.6, .48, -.65, 1.2, .48, 1.3, 1], ['back', -.7, .96, -.65, 1.4, 1.16, .35, 0]],
  forge: [['coal', -1.4, 0, -.7, 1.4, .7, 1.4, 0], ['hearth', -1.28, .7, -.58, 1.16, .5, 1.16, 1], ['anvil', .15, 0, -.68, 1.25, .9, 1.36, 1]],
};

export function addHordeCover(arena) {
  if (arena.hordeCover || !PLANS[arena.id]) return arena;
  const added = [], groups = [], jumpCover = [], landmarks = [], hopRoutes = [];
  const palette = PALETTES[arena.id];
  for (const [key, kind, name, x, z, turn, label, y = 0] of PLANS[arena.id]) {
    const id = `horde-${arena.id}-${key}`, boxes = [];
    for (const [part, xx, yy, zz, ww, h, dd, tint] of SHAPES[kind]) {
      const [dx, dz, w, d] = turn ? [-zz - dd, xx, dd, ww] : [xx, zz, ww, dd];
      const box = freeze({ id: `${id}-${part}`, x: x + dx, y: y + yy, z: z + dz, w, h, d,
        color: palette[tint], material: ['paris', 'market', 'medieval', 'courtyard'].includes(arena.id) ? 'wood' : 'metal' });
      added.push(box); boxes.push(box);
    }
    const collisionIds = freeze(boxes.map(box => box.id));
    groups.push(freeze({ id, kind, name, label, x, y, z, turn, palette: freeze([...palette]), collisionIds }));
    landmarks.push(freeze({ id, kind: 'horde-cover', name, label, collisionIds }));
    for (const box of boxes) {
      const top = box.y + box.h;
      if (top - y > 1.12 || box.w < 1.2 || box.d < 1.2) continue;
      // Only exposed solid tops are marked as hops. Taller machines/screens
      // beside them keep their full collision, including overhead clearance.
      const candidates = [point(box.x + box.w / 2, box.z + box.d / 2, top),
        point(box.x + .61, box.z + .61, top), point(box.x + box.w - .61, box.z + box.d - .61, top)];
      const landing = candidates.find(candidate => ![...arena.colliders, ...boxes].some(other => other !== box && other.y < top + 1.8 && other.y + other.h > top + .005
        && candidate.x > other.x - .52 && candidate.x < other.x + other.w + .52
        && candidate.z > other.z - .52 && candidate.z < other.z + other.d + .52));
      if (!landing) continue;
      const approaches = [point(landing.x, box.z - .9, y), point(landing.x, box.z + box.d + .9, y),
        point(box.x - .9, landing.z, y), point(box.x + box.w + .9, landing.z, y)]
        .filter(p => p.x > arena.bounds.minX + .52 && p.x < arena.bounds.maxX - .52
          && p.z > arena.bounds.minZ + .52 && p.z < arena.bounds.maxZ - .52
          && ![...arena.colliders, ...boxes].some(other => other.y < p.y + 1.8 && other.y + other.h > p.y + .005
            && p.x > other.x - .52 && p.x < other.x + other.w + .52 && p.z > other.z - .52 && p.z < other.z + other.d + .52));
      if (!approaches.length) continue;
      jumpCover.push(freeze({ colliderId: box.id, name, kind: 'horde-hop', landing,
        approaches: freeze(approaches) }));
      hopRoutes.push(freeze({ id: `${box.id}-hop`, name, role: 'horde-shortcut', side: 'cover',
        start: approaches[0], approach: freeze(approaches), steps: freeze([freeze({ colliderId: box.id, ...landing })]) }));
    }
  }
  return freeze({ ...arena, description: `${arena.description || ''} Last Stand adds ${groups.map(group => group.name.toLowerCase()).join(', ')}.`,
    colliders: freeze([...arena.colliders, ...added]), coverIds: freeze([...(arena.coverIds || []), ...added.map(box => box.id)]),
    landmarks: freeze([...(arena.landmarks || []), ...landmarks]), hordeCover: freeze(groups),
    routes: freeze([...(arena.routes || []), ...hopRoutes]), jumpCover: freeze([...(arena.jumpCover || []), ...jumpCover]) });
}

export const HORDE_MAPS = freeze(Object.fromEntries(Object.entries(BASE_MAPS).map(([id, arena]) => [id, addHordeCover(arena)])));
