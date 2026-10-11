/** Cached, bounded furniture detail for Paris's four physically furnished shops. */
export function appendParisShopCollider(mesh, collider, { wallPatch, wallText }) {
  if (collider.material !== 'paris-shop') return false;
  const { x, y, z, w, h, d, shopProp: kind } = collider;
  const wood = '#71543c', brass = '#c4a56a', cream = '#e4d6b6', dark = '#34352e';
  // Detailed working faces point into the room; unseen backs stay simple.
  const fronts = [collider.shopFacing || (w >= d ? 'south' : 'east')];
  mesh.box(x, y, z, w, h, d, collider.color || wood);
  const patch = (face, left, bottom, width, height, color, offset = .006) => {
    const span = face === 'north' || face === 'south' ? w : d;
    const low = Math.max(.012, bottom), start = Math.max(.012, left);
    const ww = Math.min(width, span - .012 - start), hh = Math.min(height, h - .012 - low);
    if (ww > .004 && hh > .004) wallPatch(mesh, collider, face, start, low, ww, hh, color, offset);
  };
  const top = (u, v, ww, dd, color, level = .004) => {
    const left = Math.max(.014, u), back = Math.max(.014, v);
    const width = Math.min(ww, w - .014 - left), depth = Math.min(dd, d - .014 - back);
    if (width > .005 && depth > .005) mesh.floor(x + left, z + back, width, depth, color, y + h + level);
  };
  // Cup, paper and paint details are at most 18 cm high, within their real
  // supporting surface. Substantial equipment is the collider itself.
  const display = (u, v, ww, hh, dd, color) => {
    const left = Math.max(.035, u), back = Math.max(.035, v);
    const width = Math.min(ww, w - .035 - left), depth = Math.min(dd, d - .035 - back);
    if (width > .01 && depth > .01) mesh.box(x + left, y + h + .006, z + back, width, Math.min(.18, hh), depth, color);
  };
  const label = (face, text, bottom, height, color = cream) => {
    const span = face === 'north' || face === 'south' ? w : d;
    const size = Math.min(height, (span - .18) * 7 / (text.length * 6 - 1), h - bottom - .02);
    if (size > .045) wallText(mesh, collider, face, text, (span - (text.length * 6 - 1) * size / 7) / 2, bottom, size, color, .016, true);
  };
  const cabinet = () => {
    for (const face of fronts) {
      const span = face === 'north' || face === 'south' ? w : d;
      patch(face, .02, .025, span - .04, .085, dark);
      patch(face, .025, h - .10, span - .05, .065, brass);
      const count = Math.max(1, Math.min(4, Math.round(span / .85))), cell = span / count;
      for (let i = 0; i < count; i++) {
        patch(face, i * cell + .06, .17, cell - .12, h - .34, wood);
        patch(face, i * cell + .09, .20, cell - .18, .022, '#a07b51', .008);
        patch(face, (i + .76) * cell, h * .54, .035, .105, brass, .010);
      }
    }
  };
  if (kind === 'bistro-base') {
    for (const face of ['north', 'south', 'west', 'east']) {
      const span = face === 'north' || face === 'south' ? w : d;
      patch(face, .025, .03, span - .05, .08, '#b9ab88');
      patch(face, .025, h - .11, span - .05, .08, brass);
    }
    return true;
  }
  if (kind === 'bistro-top') {
    top(.035, .035, w - .07, d - .07, '#d9cdb3');
    for (let row = .16; row < d - .10; row += .29) top(.07, row, w - .14, .012, '#b6ae98', .005);
    for (const u of [.17, w - .37]) {
      top(u - .055, d * .48 - .065, .25, .25, '#ac997b', .007);
      display(u, d * .48, .13, .11, .13, cream);
      top(u + .018, d * .48 + .018, .094, .094, '#453729', .119);
    }
    return true;
  }
  if (kind === 'cafe-booth') {
    top(.04, .04, w - .08, d - .08, '#93513f');
    for (const face of fronts) {
      const span = w >= d ? w : d;
      patch(face, .06, .15, span - .12, h - .22, '#884839');
      for (let at = .20; at < span - .10; at += .49) patch(face, at, .18, .023, h - .28, '#ba7860', .010);
      patch(face, .025, .045, span - .05, .055, brass);
    }
    return true;
  }
  if (kind === 'bookcase' || kind === 'paint-rack' || kind === 'programme-display') {
    const shelves = 3;
    const palette = kind === 'paint-rack' ? ['#b47145', '#47777d', '#a19a61', '#976a86'] : ['#47756a', '#985647', '#4c7084', '#b49758', '#786084'];
    for (const face of fronts) {
      const span = w >= d ? w : d, bottom = .17, spacing = (h - .43) / shelves;
      patch(face, .055, .10, span - .11, h - .20, '#3c332a');
      for (let row = 0; row < shelves; row++) {
        const yy = bottom + row * spacing;
        patch(face, .08, yy, span - .16, .055, '#b29162', .011);
        const step = kind === 'programme-display' ? .37 : kind === 'paint-rack' ? .25 : .28;
        for (let at = .14, index = 0; at < span - step - .10; at += step, index++) {
          const height = Math.min(spacing - .10, (kind === 'paint-rack' ? .24 : spacing - .13) + index % 3 * .018);
          const tint = palette[(index + row * 2) % palette.length];
          patch(face, at, yy + .07, step - .03, height, tint, .013);
          patch(face, at + .019, yy + .10 + height * .55, step - .065, .023, cream, .015);
          if (kind === 'programme-display') {
            patch(face, at + .055, yy + .10, step - .13, height * .35, '#d5bf90', .015);
            patch(face, at + .11, yy + .12, .06, height * .25, '#6c8774', .017);
          } else if (kind === 'paint-rack') patch(face, at + .03, yy + height + .03, step - .09, .033, '#bfc4b4', .017);
        }
      }
      patch(face, .045, h - .24, span - .09, .18, kind === 'paint-rack' ? '#5d6b59' : '#746045', .012);
      label(face, kind === 'bookcase' ? 'LIVRES' : kind === 'paint-rack' ? 'COULEURS' : 'OPERA', h - .21, .13);
    }
    return true;
  }
  if (kind === 'upright-piano') {
    for (const face of fronts) {
      const span = w >= d ? w : d;
      patch(face, .065, .12, span - .13, h - .22, '#322c29');
      patch(face, .10, h * .52, span - .20, .15, '#dcd3b5', .010);
      for (let at = .12, key = 0; at < span - .14; at += .075, key++) {
        patch(face, at, h * .52, .012, .15, '#534b3c', .012);
        if (![2, 6].includes(key % 7)) patch(face, at + .025, h * .52 + .06, .036, .087, '#262723', .014);
      }
      patch(face, .13, h - .15, span - .26, .03, brass, .011);
      label(face, 'PARIS', h * .74, .11, brass);
      for (const at of [span * .41, span * .55]) patch(face, at, .11, .07, .07, brass, .012);
    }
    top(.03, .03, w - .06, d - .06, '#493a2d');
    display(w * .34, d * .26, w * .29, .055, d * .43, cream);
    return true;
  }
  if (kind === 'travel-trunks') {
    for (const face of fronts) {
      const span = face === 'north' || face === 'south' ? w : d;
      for (const band of [.10, .83]) patch(face, span * band, .025, .07, h - .05, '#b99563');
      for (const row of [h * .34, h * .70]) {
        patch(face, .015, row, span - .03, .024, dark, .009);
        patch(face, span * .42, row + .085, span * .16, .046, brass, .011);
        patch(face, span * .25, row + .09, .10, .08, '#e2cf9c', .013);
      }
    }
    top(.04, .04, w - .08, d - .08, '#796044');
    for (const at of [.10, .83]) top(w * at, .025, .07, d - .05, brass, .006);
    return true;
  }
  cabinet();
  const stoneTop = ['coffee-counter', 'ticket-counter', 'cashier-desk'].includes(kind);
  top(.025, .025, w - .05, d - .05, stoneTop ? '#d1c0a0' : '#a48357');
  if (kind === 'espresso-cabinet') {
    for (const face of fronts) {
      const span = w >= d ? w : d;
      patch(face, .06, h * .47, span - .12, h * .44, '#b3b9ac', .011);
      patch(face, .12, h * .49, span - .24, h * .25, '#263d3b', .013);
      for (const at of [span * .28, span * .64]) {
        patch(face, at, h * .71, .16, .11, '#c1b58b', .016);
        patch(face, at + .04, h * .54, .04, .15, '#ced3bd', .017);
        patch(face, at + .005, h * .50, .11, .09, cream, .018);
      }
      patch(face, .10, h * .46, span - .20, .045, '#c5b277', .018);
      label(face, 'CAFE', h * .80, .14, dark);
    }
  } else if (kind === 'tool-cabinet') {
    for (const face of fronts) {
      const span = w >= d ? w : d;
      for (let row = .15; row < h - .25; row += .28) {
        patch(face, .09, row, span - .18, .20, '#52766e', .011);
        patch(face, span * .37, row + .085, span * .26, .028, '#cbc0a0', .013);
      }
    }
  } else if (kind === 'coffee-counter') {
    // Pastry trays and small coffee cups stay attached to the countertop.
    const trayW = Math.min(.82, w * .47), trayD = Math.min(.88, d * .42);
    top(.08, .09, trayW, trayD, '#5e6250', .007);
    for (let row = 0; row < 3; row++) display(.13, .15 + row * trayD / 3, Math.min(.45, trayW - .10), .055, trayD / 4, '#c89b55');
    display(w - .26, d - .27, .14, .13, .14, cream);
  } else if (kind === 'book-display' || kind === 'programme-display' || kind === 'ticket-counter') {
    for (let index = 0; index < 4; index++) {
      const u = w >= d ? .11 + index * (w - .30) / 4 : w * .24;
      const v = w >= d ? d * .27 : .11 + index * (d - .30) / 4;
      const ww = w >= d ? Math.min(.37, (w - .30) / 4 - .03) : w * .46;
      const dd = w >= d ? d * .46 : Math.min(.37, (d - .30) / 4 - .03);
      const stackHeight = .04 + index % 2 * .035;
      display(u, v, ww, stackHeight, dd, ['#476d63', '#96574c', '#657888', '#be9b61'][index]);
      top(u + .035, v + .025, ww - .07, dd * .22, cream, .007 + stackHeight);
    }
    if (kind === 'ticket-counter') for (const face of fronts) label(face, 'BILLETS', h * .51, .17, brass);
  } else if (kind === 'workbench') {
    top(w * .16, d * .20, w * .54, d * .53, '#e2d3ad', .008);
    top(w * .30, d * .24, Math.max(.08, w * .24), .025, '#5b7880', .010);
    top(w * .43, d * .25, .025, d * .34, '#5b7880', .011);
    display(w - .26, d - .28, .13, .15, .14, '#587575');
  } else if (kind === 'display-plinth') {
    top(.07, .07, w - .14, d - .14, '#d9cfb1', .005);
    display(w * .28, d * .25, w * .44, .16, d * .49, '#759082');
    for (const face of fronts) label(face, 'ART', h * .56, .13, brass);
  } else if (kind === 'cashier-desk') {
    top(w * .18, d * .22, w * .30, d * .51, '#405249', .006);
    display(w * .21, d * .26, Math.min(.37, w * .25), .12, Math.min(.35, d * .43), '#717e6a');
    display(w * .62, d * .27, w * .20, .05, d * .45, cream);
  }
  return true;
}
