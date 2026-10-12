/** Surface craft only. Silhouettes, cover and climbable tops come from colliders. */
export function appendHordeCoverArt(mesh, map, { wallPatch, wallText, glyphs }) {
  const byId = new Map(map.colliders.map(box => [box.id, box]));
  for (const group of map.hordeCover || []) {
    const [body, dark, accent] = group.palette;
    const faces = group.turn ? ['west', 'east'] : ['north', 'south'];
    const boxes = group.collisionIds.map(id => byId.get(id));
    const patch = (box, face, x, y, w, h, color, offset = .009) => {
      const width = ['north', 'south'].includes(face) ? box.w : box.d;
      const xx = Math.max(.015, x), yy = Math.max(.015, y);
      const ww = Math.min(w, width - xx - .015), hh = Math.min(h, box.h - yy - .015);
      if (ww > .005 && hh > .005) wallPatch(mesh, box, face, xx, yy, ww, hh, color, offset);
    };
    for (const box of boxes) {
      const part = box.id.slice(group.id.length + 1);
      for (const face of faces) {
        const w = ['north', 'south'].includes(face) ? box.w : box.d, h = box.h;
        // Trim and scuffed corners give the modules a shared level of detail.
        patch(box, face, .035, .035, w - .07, .035, accent);
        patch(box, face, .035, h - .07, w - .07, .035, body);
        if (group.kind === 'screen' && part.startsWith('display')) {
          patch(box, face, .07, .075, w - .14, h - .15, '#13282e');
          patch(box, face, .12, h * .72, w * .52, .03, accent, .012);
          for (let column = 0; column < 6; column++) {
            const x = .12 + column * (w - .26) / 6;
            const top = h * (.25 + ((column * 3 + group.label.length) % 5) * .07);
            patch(box, face, x, .16, (w - .26) / 10, top, column > 3 ? '#da7d61' : accent, .012);
          }
          patch(box, face, w - .15, h - .17, .045, .045, '#f0d88c', .013);
        } else if (group.kind === 'locker') {
          for (let column = .11; column < w - .10; column += .42) {
            patch(box, face, column, .12, .022, h - .24, dark);
            patch(box, face, column + .05, h * .60, .11, .045, accent, .012);
          }
          for (let vent = .18; vent < w - .13; vent += .13) patch(box, face, vent, h * .80, .07, .025, '#283e3e');
        } else if (group.kind === 'pipe') {
          for (let joint = .22; joint < w - .1; joint += .42) {
            patch(box, face, joint, .04, .045, h - .08, accent);
            patch(box, face, joint + .05, .10, .024, h - .20, '#304747');
          }
          patch(box, face, w * .45, h * .28, .18, h * .40, '#c5805b', .013);
          patch(box, face, w * .38, h * .42, .40, .13, '#c5805b', .014);
        } else if (['generator', 'forge'].includes(group.kind)) {
          for (let vent = .14; vent < w - .11; vent += .15) patch(box, face, vent, .14, .055, h * .45, '#2d4142');
          patch(box, face, w - .25, h - .23, .12, .10, accent, .012);
          patch(box, face, w - .24, h - .21, .04, .04, '#de8060', .013);
        } else if (group.kind === 'reel') {
          for (let ring = .11; ring < Math.min(w, h) / 2; ring += .15) {
            patch(box, face, ring, ring, w - ring * 2, .035, accent);
            patch(box, face, ring, h - ring - .035, w - ring * 2, .035, accent);
            patch(box, face, ring, ring, .035, h - ring * 2, dark, .011);
            patch(box, face, w - ring - .035, ring, .035, h - ring * 2, dark, .011);
          }
        } else if (group.kind === 'tea-cart' && part === 'machine') {
          patch(box, face, .08, .18, w - .16, h - .28, '#243b3b');
          for (const x of [.16, .37]) patch(box, face, x, .42, .075, .07, accent, .012);
          patch(box, face, .13, .15, w - .26, .06, '#c7c8b1', .013);
        } else if (['sled', 'wagon', 'table', 'stall'].includes(group.kind)) {
          for (let stripe = .14; stripe < w - .14; stripe += .38) {
            patch(box, face, stripe, .14, .13, Math.min(.20, h * .30), accent);
            patch(box, face, stripe + .05, .14 + Math.min(.20, h * .30), .13, .055, dark, .012);
          }
        } else if (['relic', 'throne'].includes(group.kind)) {
          patch(box, face, w * .46, h * .24, w * .08, h * .55, accent);
          patch(box, face, w * .30, h * .56, w * .40, .065, accent, .011);
        }
      }
      // Narrow ends need readable hardware too: players approach cover from
      // every direction. A few surface patches keep this inside the map budget.
      for (const face of ['north', 'south', 'west', 'east'].filter(face => !faces.includes(face))) {
        const width = ['north', 'south'].includes(face) ? box.w : box.d;
        patch(box, face, .04, .05, width - .08, .03, accent);
        patch(box, face, width * .22, box.h * .25, width * .56, box.h * .38, '#2b4241');
        patch(box, face, width * .44, box.h * .60, width * .12, .065, accent, .012);
      }
      if (group.kind === 'planter' && part === 'shrubs') {
        for (let x = box.x + .12; x < box.x + box.w - .09; x += .27)
          for (let z = box.z + .12; z < box.z + box.d - .09; z += .27)
            mesh.floor(x, z, .09, .09, (Math.round(x * 10 + z * 10) & 1) ? accent : '#b78a83', box.y + box.h + .004);
      }
      if (group.kind === 'forge' && part === 'hearth') {
        mesh.floor(box.x + .06, box.z + .06, box.w - .12, box.d - .12, '#512d28', box.y + box.h + .004);
        for (let x = box.x + .12; x < box.x + box.w - .1; x += .23) mesh.floor(x, box.z + .22, .12, .12, '#df9855', box.y + box.h + .005);
      }
    }
    const sign = boxes.find(box => box.h >= .68 && (group.turn ? box.d : box.w) > 1.15);
    if (!sign) continue;
    const width = group.turn ? sign.d : sign.w;
    const units = [...group.label].reduce((sum, letter) => sum + (glyphs[letter]?.[0]?.length || 2) + 1, 0) - 1;
    const height = Math.min(.15, (width - .25) * 7 / units);
    const labelWidth = units * height / 7;
    for (const face of faces) {
      const left = (width - labelWidth) / 2, bottom = Math.min(sign.h - height - .08, sign.h * .57);
      patch(sign, face, left - .07, bottom - .055, labelWidth + .14, height + .11, '#253c3e', .016);
      wallText(mesh, sign, face, group.label, left, bottom, height, accent, .020);
    }
  }
}
