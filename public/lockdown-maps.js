/** Lockdown arenas: tile grids mirrored left/right so neither team has an edge.
 * '#' wall (blocks movement and shots), '~' chasm, water or lava (blocks movement but
 * not shots), '.' floor, '1'/'2' team base floor. Control points sit at fixed world
 * positions. One tile is TILE world units; the renderer draws one tile per asset. */
export const TILE = 48;

/** What the '~' tiles are in each theme, which decides which shoes can cross them. */
export const PIT_KINDS = Object.freeze({ castle: 'water', ruins: 'water', maze: 'bog', foundry: 'lava', graveyard: 'chasm', skyway: 'chasm' });

const mirrorRow = row => row + [...row].reverse().map(cell => cell === '1' ? '2' : cell).join('');

/** Six arenas in the Spiral Knights Lockdown mould. Each team's base is a spawn room
 * against the far left or far right wall; A sits on the left half, B in the middle and
 * C mirrors A on the right. Authored as the left half and mirrored, so neither side
 * has an edge. */
const MAP_DEFS = {
  keep: {
    name: 'Old Keep',
    theme: 'castle',
    description: 'A ruined castle courtyard. Towers guard the flanks and a moat rings the inner keep where B stands; cross by the bridges.',
    left: [
      '#####################',
      '#............#.......',
      '#.......###..#.......',
      '#.......###..#.......',
      '#.......###..#.......',
      '#............#.~~~..~',
      '#..............~.....',
      '#.........##...~.####',
      '######.........~.#...',
      '#111.#.#.........#...',
      '#111.#.#.............',
      '#111...........~.#...',
      '#111...........~.....',
      '#111...........~.#...',
      '#111.#.#.............',
      '#111.#.#.........#...',
      '######.........~.#...',
      '#.........##...~.####',
      '#..............~.....',
      '#............#.~~~..~',
      '#.......###..#.......',
      '#.......###..#.......',
      '#.......###..#.......',
      '#............#.......',
      '#####################',
    ],
    points: [{ id: 'A', col: 10.5, row: 12.5 }, { id: 'B', col: 21, row: 12.5 }, { id: 'C', col: 31.5, row: 12.5 }],
  },
  maze: {
    name: 'Hedge Labyrinth',
    theme: 'maze',
    description: 'Twisting hedge corridors with three clearings. Swords rule the corners; guns rarely get a long line.',
    left: [
      '#####################',
      '#.....#.......#......',
      '#.....#.###.#.#.####.',
      '#.###.#.#...#........',
      '#.#.....#.#####.###.#',
      '#.#.###.#.....#...#..',
      '#...#...#####.#.#.#..',
      '###.#.#.......#.#....',
      '######.........#.....',
      '#111.#.#.......#.....',
      '#111.#.#.......#.....',
      '#111.................',
      '#111.................',
      '#111.................',
      '#111.#.#.......#.....',
      '#111.#.#.......#.....',
      '######.........#.....',
      '###.#.#.......#.#....',
      '#...#...#####.#.#.#..',
      '#.#.###.#.....#...#..',
      '#.#.....#.#####.###.#',
      '#.###.#.#...#........',
      '#.....#.###.#.#.####.',
      '#.....#.......#......',
      '#####################',
    ],
    points: [{ id: 'A', col: 10.5, row: 12.5 }, { id: 'B', col: 21, row: 12.5 }, { id: 'C', col: 31.5, row: 12.5 }],
  },
  foundry: {
    name: 'Clockwork Foundry',
    theme: 'foundry',
    description: 'Molten channels split the floor; only three bridges cross each one. B sits on the gantry at the top.',
    left: [
      '#####################',
      '#........~...........',
      '#........~...........',
      '#..............##....',
      '#........~.....##....',
      '#........~.....##....',
      '#........~...........',
      '#........~..##.......',
      '######...~..##...~~~.',
      '#111.#...~...........',
      '#111.#...~...........',
      '#111.................',
      '#111.................',
      '#111.................',
      '#111.#...~...........',
      '#111.#...~...........',
      '######...~..##...~~~.',
      '#........~..##.......',
      '#........~...........',
      '#........~.....##....',
      '#........~.....##....',
      '#..............##.#..',
      '#........~........#..',
      '#........~........#..',
      '#####################',
    ],
    points: [{ id: 'A', col: 12.5, row: 12.5 }, { id: 'B', col: 21, row: 4.5 }, { id: 'C', col: 29.5, row: 12.5 }],
  },
  temple: {
    name: 'Sunken Temple',
    theme: 'ruins',
    description: 'A half-flooded temple. Pools block your feet but not your shots, so gunners hold the water lines.',
    left: [
      '#####################',
      '#.................###',
      '#.................###',
      '#.......#...#...#....',
      '#....................',
      '#....................',
      '#....................',
      '#.......#.......#....',
      '######.............~~',
      '#111.#...............',
      '#111.#...............',
      '#111..........#......',
      '#111.................',
      '#111..........#......',
      '#111.#...............',
      '#111.#...............',
      '######.............~~',
      '#.......#.......#....',
      '#....................',
      '#....................',
      '#....................',
      '#.......#...#...#....',
      '#.................###',
      '#.................###',
      '#####################',
    ],
    points: [{ id: 'A', col: 10.5, row: 12.5 }, { id: 'B', col: 21, row: 12.5 }, { id: 'C', col: 31.5, row: 12.5 }],
  },
  graveyard: {
    name: 'Gloom Graveyard',
    theme: 'graveyard',
    description: 'Tombstone rows give stop-and-go cover. B hides inside the crypt, entered from the sides.',
    left: [
      '#####################',
      '#..........#.........',
      '#....................',
      '#......#..#..#..#..#.',
      '#....................',
      '#....................',
      '#......#..#..#..#..#.',
      '#....................',
      '######...............',
      '#111.#......~~..###..',
      '#111.#..........#....',
      '#111.................',
      '#111.................',
      '#111.................',
      '#111.#..........#....',
      '#111.#......~~..###..',
      '######...............',
      '#....................',
      '#......#..#..#..#..#.',
      '#....................',
      '#....................',
      '#......#..#..#..#..#.',
      '#....................',
      '#..........#.........',
      '#####################',
    ],
    points: [{ id: 'A', col: 10.5, row: 12.5 }, { id: 'B', col: 21, row: 12.5 }, { id: 'C', col: 31.5, row: 12.5 }],
  },
  skyway: {
    name: 'Sky Bridges',
    theme: 'skyway',
    description: 'Platforms floating over the void, joined by narrow bridges. Knockback near an edge is deadly to your plans, not your knight.',
    left: [
      '#####################',
      '#.....~~~~~~~~~~~~~~~',
      '#.....~~~~.....~~~~~~',
      '#....................',
      '#......~~~.....~~~~~~',
      '#......~~~.....~~~~~~',
      '#......~~~~.~~~~~~~~~',
      '#......~~~~.~~~~~~~~~',
      '######.~~~~.~~~~~~~~~',
      '#111.#.~~.....~~.....',
      '#111.#~~~.....~~.....',
      '#111...........~.....',
      '#111.................',
      '#111...........~.....',
      '#111.#~~~.....~~.....',
      '#111.#.~~.....~~.....',
      '######.~~~~.~~~~~~~~~',
      '#......~~~~.~~~~~~~~~',
      '#......~~~~.~~~~~~~~~',
      '#......~~~.....~~~~~~',
      '#......~~~.....~~~~~~',
      '#....................',
      '#.....~~~~.....~~~~~~',
      '#.....~~~~~~~~~~~~~~~',
      '#####################',
    ],
    points: [{ id: 'A', col: 11.5, row: 12.5 }, { id: 'B', col: 21, row: 12.5 }, { id: 'C', col: 30.5, row: 12.5 }],
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
    id, name: def.name, theme: def.theme, pit: PIT_KINDS[def.theme] || 'chasm', description: def.description,
    grid: Object.freeze(grid), cols, rows, width: cols * TILE, height: rows * TILE,
    spawns: Object.freeze(spawns.map(list => Object.freeze(list))),
    points: Object.freeze(def.points.map(point => Object.freeze({ id: point.id, x: point.col * TILE, y: point.row * TILE }))),
  });
}

export const MAPS = Object.freeze(Object.fromEntries(Object.entries(MAP_DEFS).map(([id, def]) => [id, build(id, def)])));
export const MAP_IDS = Object.freeze(Object.keys(MAPS));

export const isWall = (map, col, row) => row < 0 || col < 0 || row >= map.rows || col >= map.cols || map.grid[row][col] === '#';
export const wallAt = (map, x, y) => isWall(map, Math.floor(x / TILE), Math.floor(y / TILE));
/** Chasms and pools stop feet but let shots and sight lines pass. Some shoes cross them:
 * `walk` lists the pit kinds a knight can stand on (see PIT_KINDS). */
export const isPit = (map, col, row) => map.grid[row]?.[col] === '~';
export const isBlocked = (map, col, row, walk = null) => isWall(map, col, row) || isPit(map, col, row) && !(walk && walk.includes(map.pit));
