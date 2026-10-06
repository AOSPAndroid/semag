/** Original pixel materials. Every sprite is painted once and reused by the driving cabinets. */
export function createDrivingSprites() {
  const cache = new Map();
  // Derive paint from the body color once per cached sprite. This keeps every
  // traffic color coherent rather than placing orange highlights on blue cars.
  function shade(color, amount) {
    const value = Number.parseInt(color.slice(1), 16);
    const target = amount < 0 ? 0 : 255;
    const ratio = Math.abs(amount);
    return `#${[16, 8, 0].map((shift) => {
      const channel = (value >> shift) & 255;
      return Math.round(channel + (target - channel) * ratio).toString(16).padStart(2, '0');
    }).join('')}`;
  }
  function sprite(key, width, height, paint) {
    if (cache.has(key)) return cache.get(key);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const r = (x, y, w, h, color) => {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);
    };
    const p = (points, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fill();
    };
    paint(r, p, ctx);
    cache.set(key, canvas);
    return canvas;
  }
  return {
    raceCar(color = '#ed9b51') {
      return sprite(`race:${color}`, 56, 36, (r, p) => {
        const light = shade(color, 0.35), mid = shade(color, 0.15), dark = shade(color, -0.35);
        r(5, 6, 45, 24, '#233c35');
        r(2, 9, 50, 18, '#233c35');
        r(6, 5, 40, 26, color);
        r(3, 10, 48, 16, color);
        r(7, 5, 38, 2, light);
        r(10, 7, 34, 2, mid);
        r(5, 28, 40, 3, dark);
        r(12, 3, 10, 3, '#152b31');
        r(12, 30, 10, 3, '#152b31');
        r(37, 3, 10, 3, '#152b31');
        r(37, 30, 10, 3, '#152b31');
        r(3, 11, 2, 14, dark);
        r(37, 10, 12, 16, mid);
        r(40, 11, 7, 14, light);
        r(15, 8, 21, 20, '#334f4e');
        p(
          [
            [17, 9],
            [33, 9],
            [36, 12],
            [36, 24],
            [33, 27],
            [17, 27],
            [14, 24],
            [14, 12],
          ],
          '#537d77',
        );
        r(17, 9, 14, 3, '#b2d2cc');
        r(17, 12, 15, 2, '#7397a0');
        r(29, 14, 5, 10, '#203c40');
        r(18, 14, 9, 9, color);
        r(18, 14, 9, 2, light);
        r(17, 23, 11, 2, dark);
        r(39, 16, 9, 3, '#f8e5b8');
        r(7, 16, 6, 3, dark);
        r(21, 14, 3, 10, '#f8e5b8');
        r(9, 3, 5, 3, '#6e9382');
        r(9, 30, 5, 3, '#6e9382');
        r(47, 9, 4, 4, '#fff3c7');
        r(47, 23, 4, 4, '#fff3c7');
        r(3, 10, 2, 4, '#de7268');
        r(3, 22, 2, 4, '#de7268');
        r(4, 7, 3, 22, '#59716e');
        r(1, 8, 3, 20, '#263d39');
        r(1, 8, 3, 2, '#8ba98f');
        r(33, 5, 3, 2, '#dcedc5');
        r(33, 29, 3, 2, '#dcedc5');
        r(42, 11, 3, 2, light);
      });
    },
    rearCar(color, player = false) {
      return sprite(`rear:${color}:${player}`, 64, 76, (r, p) => {
        const light = shade(color, 0.32), mid = shade(color, 0.12), dark = shade(color, -0.33);
        // The tire contact is at y=73 for every color and damage material.
        r(8, 35, 8, 38, '#101f27');
        r(48, 35, 8, 38, '#101f27');
        r(9, 50, 2, 17, '#395052');
        r(52, 50, 2, 17, '#395052');
        p([[18, 5], [46, 5], [53, 18], [58, 40], [58, 63],
          [53, 69], [11, 69], [6, 63], [6, 40], [11, 18]], '#172c33');
        p([[19, 6], [45, 6], [51, 18], [55, 35], [58, 42],
          [57, 59], [52, 65], [12, 65], [7, 59], [6, 42], [9, 35], [13, 18]], color);
        // Roof, rear glass and C pillars share straight, symmetric edges.
        p([[19, 6], [45, 6], [49, 14], [15, 14]], mid);
        r(20, 6, 24, 2, light);
        p([[17, 14], [47, 14], [51, 32], [13, 32]], '#223e48');
        p([[19, 16], [45, 16], [48, 29], [16, 29]], player ? '#668f98' : '#567e8b');
        p([[19, 16], [45, 16], [46, 20], [18, 20]], '#a1c7c5');
        p([[18, 23], [33, 23], [30, 27], [17, 27]], '#7ca8af');
        r(30, 28, 14, 1, '#18323e');
        r(36, 26, 9, 1, '#233f46');
        r(31, 29, 7, 1, '#1a313a');
        p([[11, 34], [53, 34], [57, 43], [7, 43]], mid);
        r(12, 35, 40, 2, light);
        r(8, 43, 48, 2, dark);
        p([[8, 45], [56, 45], [55, 57], [51, 61], [13, 61], [9, 57]], color);
        r(13, 46, 38, 2, mid);
        r(15, 59, 34, 2, dark);
        r(8, 45, 2, 10, light);
        r(54, 45, 2, 10, dark);
        r(3, 32, 8, 5, '#28464a');
        r(53, 32, 8, 5, '#28464a');
        r(4, 32, 6, 1, mid);
        r(54, 32, 6, 1, mid);
        // Red lamps, a narrow amber signal, and a low bumper read at distance.
        r(8, 52, 13, 7, '#733d43');
        r(43, 52, 13, 7, '#733d43');
        r(9, 53, 11, 3, '#f28879');
        r(44, 53, 11, 3, '#f28879');
        r(9, 56, 3, 2, '#e1af6c');
        r(52, 56, 3, 2, '#e1af6c');
        r(17, 56, 3, 2, '#d2d9c6');
        r(44, 56, 3, 2, '#d2d9c6');
        r(28, 52, 8, 2, '#b3c6bb');
        r(29, 54, 6, 1, dark);
        r(11, 62, 42, 5, '#375457');
        r(12, 62, 40, 1, '#9daf9f');
        r(25, 63, 14, 4, '#e4e2c9');
        r(28, 64, 8, 1, '#61786f');
        r(11, 67, 42, 3, '#162c34');
        r(14, 70, 5, 2, '#99a9a0');
        r(45, 70, 5, 2, '#99a9a0');
        if (player) {
          r(27, 7, 10, 7, '#eee0b5');
          r(29, 7, 6, 7, '#fff0c6');
          r(27, 34, 10, 9, '#eee0b5');
          r(29, 35, 6, 7, '#fff0c6');
          r(27, 45, 10, 6, '#eee0b5');
          r(29, 45, 6, 6, '#fff0c6');
          r(9, 39, 46, 3, '#19343d');
          r(12, 38, 40, 2, '#a6bab0');
        }
      });
    },
    roadside(kind, side = -1, variant = 0) {
      const cityVariant = variant % 2;
      const key = kind === 'city' ? `side:city:${side}:${cityVariant}` : `side:${kind}`;
      return sprite(key, 96, 160, (r, p, ctx) => {
        // All roadside materials use the same y=154 ground anchor.
        r(4, 150, 88, 4, '#102932');
        if (kind === 'city') {
          if (side > 0) { ctx.translate(96, 0); ctx.scale(-1, 1); }
          const roof = cityVariant ? 47 : 27;
          const wall = cityVariant ? '#395763' : '#2b4955';
          const edge = cityVariant ? '#253e4c' : '#1d3442';
          // Vertical wall edges and matching roof/side corners avoid leaning
          // or mismatched storey lines when scaled into the chase camera.
          p([[12, roof], [74, roof], [88, roof - 9], [26, roof - 9]], '#63817f');
          p([[74, roof], [88, roof - 9], [88, 141], [74, 150]], edge);
          r(12, roof, 62, 123 - roof, wall);
          r(12, roof, 62, 3, '#84a397');
          r(13, roof + 3, 3, 143 - roof, '#46656b');
          r(71, roof + 3, 3, 143 - roof, '#213d47');
          for (let y = roof + 13; y < 116; y += 19) {
            r(17, y + 12, 51, 2, '#49646b');
            for (let x = 21; x < 65; x += 14) {
              r(x, y, 8, 11, '#142c3a');
              r(x + 1, y + 1, 6, 8, (x + y) % 4 ? '#87ada8' : '#d7bb81');
              r(x + 1, y + 4, 6, 1, '#304d56');
              r(x + 4, y + 1, 1, 8, '#304d56');
              r(x - 1, y + 11, 10, 1, '#8ca096');
            }
            p([[79, y - 3], [84, y - 6], [84, y + 3], [79, y + 6]], '#526f78');
          }
          r(16, 124, 55, 23, '#1b343e');
          r(20, 127, 14, 20, '#426674');
          r(22, 129, 10, 9, '#86b6ae');
          r(31, 141, 1, 2, '#dac589');
          r(38, 127, 29, 16, '#527e82');
          r(40, 129, 11, 10, '#9bc9bc');
          r(54, 129, 11, 10, '#6ea49f');
          r(36, 119, 33, 5, cityVariant ? '#bc956f' : '#7fa897');
          r(39, 120, 27, 1, '#e0d3a3');
          r(12, 147, 62, 3, '#748c80');
          p([[74, 147], [88, 138], [88, 141], [74, 150]], '#405e61');
          if (!cityVariant) {
            r(45, 12, 3, 6, '#678d83');
            r(41, 9, 11, 3, '#88ab96');
          }
        } else if (kind === 'works') {
          r(12, 83, 76, 57, '#754e50');
          r(10, 81, 78, 5, '#ad8572');
          r(12, 137, 76, 8, '#433d45');
          r(14, 145, 72, 5, '#293b43');
          for (let x = 20; x < 83; x += 12) {
            r(x, 88, 2, 46, '#b08266');
            r(x + 2, 89, 2, 43, '#634a4e');
          }
          r(24, 96, 28, 15, '#c6b399');
          r(28, 100, 20, 3, '#705c51');
          r(71, 59, 4, 22, '#775f50');
          r(66, 57, 14, 5, '#e8b874');
          r(6, 127, 8, 18, '#e7ad64');
          r(82, 126, 8, 18, '#e7ad64');
          r(5, 137, 11, 4, '#ead8b1');
          r(80, 136, 12, 4, '#ead8b1');
        } else if (kind === 'coast') {
          p(
            [
              [46, 140],
              [55, 140],
              [61, 31],
              [54, 31],
            ],
            '#9b8c66',
          );
          r(50, 63, 5, 5, '#cbb18a');
          r(48, 105, 5, 4, '#cbb18a');
          p(
            [
              [56, 34],
              [25, 15],
              [4, 18],
              [32, 27],
              [54, 41],
            ],
            '#6d9980',
          );
          p(
            [
              [57, 34],
              [79, 11],
              [93, 18],
              [77, 22],
              [59, 41],
            ],
            '#79a18a',
          );
          p(
            [
              [55, 33],
              [44, 5],
              [27, 1],
              [42, 23],
              [54, 44],
            ],
            '#91b19a',
          );
          p(
            [
              [58, 37],
              [87, 34],
              [93, 49],
              [77, 42],
              [60, 43],
            ],
            '#527a72',
          );
          p(
            [
              [56, 37],
              [33, 45],
              [18, 64],
              [22, 44],
              [47, 34],
            ],
            '#446f64',
          );
          r(32, 135, 40, 8, '#9da783');
          r(46, 140, 9, 8, '#9b8c66');
          r(19, 147, 61, 3, '#b8b18b');
        } else {
          r(45, 110, 9, 39, '#6d8078');
          p(
            [
              [48, 13],
              [20, 67],
              [31, 67],
              [10, 100],
              [23, 100],
              [2, 135],
              [92, 135],
              [70, 99],
              [82, 99],
              [63, 67],
              [73, 67],
            ],
            kind === 'summit' ? '#496f68' : '#385d62',
          );
          p(
            [
              [48, 13],
              [30, 48],
              [44, 43],
              [49, 52],
              [57, 43],
              [65, 48],
            ],
            kind === 'summit' ? '#c5d3c3' : '#62868a',
          );
          p(
            [
              [33, 71],
              [20, 96],
              [36, 90],
              [47, 99],
              [55, 89],
              [72, 96],
              [61, 72],
            ],
            kind === 'summit' ? '#91ac9b' : '#486f72',
          );
          r(11, 133, 73, 4, kind === 'summit' ? '#d0d9cc' : '#6d8e87');
          r(2, 149, 92, 3, kind === 'summit' ? '#a8b9af' : '#425d65');
        }
      });
    },
    clear() {
      cache.clear();
    },
  };
}
