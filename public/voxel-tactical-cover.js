/** Small, authored jump cover. The same boxes are drawn, stood on and shot-tested. */
const freeze = Object.freeze;
const point = (x, z, y = 0) => freeze({ x, y, z });
const cluster = (id, name, x, z, color, material, kind, approachSide = 0) => freeze({ id, name, x, z, color, material, kind, approachSide });

// Kept out of doors, planting centres, existing climbs and their landing seams.
// Each group is just 3.3 m wide; the outer/ground rotations stay open. The two
// .48/.84 m tops offer a short hop sequence rather than another tall barricade.
const LAYOUTS = freeze({
  courtyard: freeze([
    cluster('garden', 'Garden masonry', -18, 7, '#a99c81', 'stone', 'garden-step'),
    cluster('arcade', 'Arcade deliveries', 6, -9, '#a98251', 'wood', 'supply-crate'),
    cluster('arrival', 'Courtyard supply pallets', -8, 15, '#a6885e', 'wood', 'supply-pallet'),
  ]),
  depot: freeze([
    cluster('dispatch', 'Dispatch pallets', -6, 5, '#b19360', 'wood', 'freight-pallet'),
    cluster('workshop', 'Workshop freight cases', 8, 7, '#5a7c83', 'metal', 'freight-case'),
    cluster('loading', 'Loading-court pallets', 0, -13, '#9d7e50', 'wood', 'freight-pallet'),
  ]),
  canal: freeze([
    cluster('delivery', 'Market delivery crates', -16, 11, '#ab8857', 'wood', 'market-crate'),
    cluster('quay', 'Quay mooring blocks', 12, -7, '#889995', 'stone', 'mooring-block'),
    cluster('arrival', 'Lock keeper supplies', 8, 17, '#68818b', 'metal', 'service-case'),
  ]),
  rooftops: freeze([
    cluster('service', 'South service cases', -6, 7, '#758a88', 'metal', 'service-case'),
    cluster('repair', 'Roof repair supplies', 6, -9, '#af9469', 'wood', 'supply-crate'),
    cluster('arrival', 'Alley equipment cases', -10, 13, '#677f83', 'metal', 'service-case'),
  ]),
  foundry: freeze([
    cluster('tooling', 'Casting tool cases', -6, 11, '#8a7961', 'metal', 'tool-case'),
    cluster('mould', 'Mould delivery pallets', 16, -7, '#a28358', 'wood', 'freight-pallet'),
    cluster('inspection', 'Inspection equipment', 4, -13, '#637e86', 'metal', 'service-case'),
  ]),
  bastion: freeze([
    cluster('rubble', 'Low ruined masonry', -8, 9, '#a7ab92', 'stone', 'masonry-step'),
    cluster('signal', 'Signal station supplies', 8, -9, '#929a80', 'stone', 'masonry-step'),
    cluster('arrival', 'Battlement supply crates', 14, 15, '#a08a60', 'wood', 'supply-crate'),
  ]),
  paris: freeze([
    cluster('florist', 'Florist delivery boxes', -22, 5, '#a48865', 'wood', 'delivery-crate'),
    cluster('boulevard', 'Boulevard maintenance cases', 6, 11, '#688a87', 'metal', 'service-case'),
    cluster('cafe', 'Café delivery pallets', -10, 17, '#a68054', 'wood', 'delivery-pallet'),
  ]),
  snow: freeze([
    cluster('research', 'Research instrument cases', -10, 3, '#7e9eac', 'snow-crate', 'instrument-case'),
    cluster('rescue', 'Rescue supply cases', -4, -11, '#d4a16a', 'snow-crate', 'rescue-case'),
    cluster('arrival', 'Survey supply pallets', 8, 15, '#9fb9c5', 'snow-crate', 'supply-pallet'),
  ]),
  sewers: freeze([
    cluster('north', 'North collector repair cases', -4, -11, '#7d8470', 'metal', 'repair-case', -1),
    cluster('south', 'South collector filter blocks', 4, 11, '#929079', 'sewer-brick', 'filter-block', 1),
    cluster('pump', 'Pump service cases', 0, 5, '#6a8075', 'metal', 'repair-case'),
  ]),
  trading: freeze([
    cluster('archive', 'Archive storage pedestals', -14, 9, '#879ba6', 'desk-cabinet', 'archive-pedestal'),
    cluster('equipment', 'Operations equipment cases', 14, -7, '#647e8c', 'metal', 'equipment-case'),
    cluster('arrival', 'Reception storage pedestals', -10, 15, '#a5ada8', 'desk-cabinet', 'archive-pedestal'),
  ]),
  market: freeze([
    cluster('produce', 'Produce delivery crates', -7, 13, '#b58f59', 'wood', 'produce-crate'),
    cluster('tea', 'Tea delivery boxes', 7, -13, '#6d9994', 'wood', 'delivery-crate'),
    cluster('court', 'Food court supply boxes', 5, 3, '#a07f57', 'wood', 'supply-crate'),
  ]),
  lockdown: freeze([
    cluster('south', 'South workshop tool cases', -7, 13, '#8f7c60', 'metal', 'tool-case'),
    cluster('north', 'North workshop supply cases', 7, -13, '#71888d', 'metal', 'supply-case'),
    cluster('maintenance', 'Maintenance floor cases', 9, 1, '#839391', 'metal', 'tool-case'),
  ]),
});

export function addTacticalJumpCover(arena) {
  if (!LAYOUTS[arena.id] || arena.jumpCover || arena.mode === 'royale') return arena;
  const added = [], jumpCover = [], hopRoutes = [], landmarks = [];
  for (const group of LAYOUTS[arena.id]) {
    const supports = [];
    for (const [index, [offset, height]] of [[-.95, .48], [.95, .84]].entries()) {
      const centreX = group.x + offset, id = `${arena.id}-hop-${group.id}-${index + 1}`;
      const collider = freeze({ id, x: centreX - .7, y: 0, z: group.z - .7,
        w: 1.4, h: height, d: 1.4, color: group.color, material: group.material });
      const landing = point(centreX, group.z, height);
      // Collector-side boxes approach from the broad service bank; the solid
      // tunnel bend behind them remains a wall, rather than a fake entry point.
      const approaches = freeze((group.approachSide ? [group.approachSide] : [-1, 1])
        .map(side => point(centreX, group.z + side * 1.4)));
      added.push(collider); supports.push(freeze({ colliderId: id, ...landing }));
      jumpCover.push(freeze({ colliderId: id, name: `${group.name} / ${index + 1}`, kind: group.kind, landing, approaches }));
      landmarks.push(freeze({ kind: 'combat-cover', ...collider, collisionIds: freeze([id]) }));
    }
    hopRoutes.push(freeze({ id: `${arena.id}-hop-${group.id}`, name: group.name,
      start: point(group.x - 2.4, group.z), steps: freeze(supports), end: point(group.x + 2.4, group.z) }));
  }
  return freeze({ ...arena, colliders: freeze([...arena.colliders, ...added]),
    coverIds: freeze([...(arena.coverIds || []), ...added.map(value => value.id)]),
    landmarks: freeze([...(arena.landmarks || []), ...landmarks]),
    jumpCover: freeze(jumpCover), hopRoutes: freeze(hopRoutes) });
}
