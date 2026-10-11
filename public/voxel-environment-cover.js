/** Small equipment belongs to its authored environment, never a shared placement template. */
const freeze = Object.freeze;
const point = (x, z, y = 0) => freeze({ x, y, z });

export function environmentCover(groups) {
  const colliders = [], landmarks = [], jumpCover = [], hopRoutes = [];
  for (const group of groups) {
    const steps = [];
    for (const [index, value] of group.boxes.entries()) {
      const { id, x, z, w, h, d, color, material } = value;
      const box = freeze({ id, x, y: 0, z, w, h, d, color, material });
      const landing = point(x + w / 2, z + d / 2, h);
      const approaches = freeze(value.approaches.map(p => point(p[0], p[1])));
      colliders.push(box); steps.push(freeze({ colliderId: id, ...landing }));
      landmarks.push(freeze({ kind: 'combat-cover', ...box, collisionIds: freeze([id]) }));
      jumpCover.push(freeze({ colliderId: id, name: `${group.name} / ${index + 1}`, kind: group.kind, landing, approaches }));
    }
    hopRoutes.push(freeze({ id: group.id, name: group.name, start: point(...group.start),
      steps: freeze(steps), end: point(...group.end) }));
  }
  return { colliders, landmarks, jumpCover: freeze(jumpCover), hopRoutes: freeze(hopRoutes),
    coverIds: freeze(colliders.map(box => box.id)) };
}
