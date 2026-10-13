/** Lockdown arenas: tile grids mirrored left/right so neither team has an edge.
 * '#' wall, '.' floor, '1'/'2' team spawn floor. Control points sit at fixed
 * world positions. One tile is TILE world units; the renderer draws one tile per
 * floor/wall asset, so maps are cheap to author and easy to theme. */
export const TILE = 48;

const mirrorRow = row => row + [...row].reverse().map(cell => cell === '1' ? '2' : cell).join('');

const MAP_DEFS = {
  gate: {
    name: 'Coliseum Gate',
    theme: 'stone',
    description: 'Two flank points and a sunken middle court. Pillars break up long gun lanes.',
    left: [
      '##################',
      '#1111.....#.......',
      '#1111.....#.......',
      '#1111.............',
      '#1111.....###.....',
      '#.........#.......',
      '###.......#....#..',
      '#...............#.',
      '#...##..........#.',
      '#...##............',
      '#.........##......',
      '#.........##......',
      '#...##............',
      '#...##..........#.',
      '#...............#.',
      '###.......#....#..',
      '#.........#.......',
      '#1111.....###.....',
      '#1111.............',
      '#1111.....#.......',
      '#1111.....#.......',
      '##################',
    ],
    points: [{ id: 'A', col: 12.5, row: 5.5 }, { id: 'B', col: 18, row: 16.5 }, { id: 'C', col: 23.5, row: 5.5 }],
  },
  yard: {
    name: 'Clockwork Yard',
    theme: 'brass',
    description: 'A long central hall with side workshops. The middle point is wide open; the flanks are tight.',
    left: [
      '##################',
      '#111.....#........',
      '#111.....#........',
      '#111..........##..',
      '#111.....#....##..',
      '##.##....#........',
      '#........######...',
      '#.................',
      '#....#............',
      '#....#....##......',
      '#.........##......',
      '#.........##......',
      '#....#....##......',
      '#....#............',
      '#.................',
      '#........######...',
      '##.##....#........',
      '#111.....#....##..',
      '#111..........##..',
      '#111.....#........',
      '#111.....#........',
      '##################',
    ],
    points: [{ id: 'A', col: 6.5, row: 11 }, { id: 'B', col: 18, row: 11 }, { id: 'C', col: 29.5, row: 11 }],
  },
};

function build(id, def) {
  const grid = def.left.map(mirrorRow);
  const rows = grid.length, cols = grid[0].length;
  const spawns = [[], []];
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    const cell = grid[row][col];
    if (cell === '1' || cell === '2') spawns[cell === '1' ? 0 : 1].push({ x: (col + .5) * TILE, y: (row + .5) * TILE });
  }
  return Object.freeze({
    id, name: def.name, theme: def.theme, description: def.description,
    grid: Object.freeze(grid), cols, rows, width: cols * TILE, height: rows * TILE,
    spawns: Object.freeze(spawns.map(list => Object.freeze(list))),
    points: Object.freeze(def.points.map(point => Object.freeze({ id: point.id, x: point.col * TILE, y: point.row * TILE }))),
  });
}

export const MAPS = Object.freeze(Object.fromEntries(Object.entries(MAP_DEFS).map(([id, def]) => [id, build(id, def)])));
export const MAP_IDS = Object.freeze(Object.keys(MAPS));

export const isWall = (map, col, row) => row < 0 || col < 0 || row >= map.rows || col >= map.cols || map.grid[row][col] === '#';
export const wallAt = (map, x, y) => isWall(map, Math.floor(x / TILE), Math.floor(y / TILE));
