import { MAPS } from '../voxel-royale-maps.js';

export function validRoyaleSettings(mapId, capacity) {
  return typeof mapId === 'string' && Object.hasOwn(MAPS, mapId) && Number.isInteger(capacity) && capacity >= 2 && capacity <= 10;
}

/** The preview uses real collision geometry; spawn and loot rolls stay hidden. */
export function royaleOverview(arena) {
  const { minX, minZ, maxX, maxZ } = arena.bounds;
  const width = maxX - minX, depth = maxZ - minZ;
  const cover = arena.colliders.filter(box => !box.overhead && !box.id.startsWith('wall-')).map(box =>
    `<rect x="${box.x - minX}" y="${box.z - minZ}" width="${box.w}" height="${box.d}" fill="${box.y > 0 ? '#a98961' : box.h >= 2.4 ? '#5f7c6c' : '#b1b79a'}" stroke="#fffdf8" stroke-width=".16"/>`).join('');
  const routes = (arena.routes || []).map(route => `<polyline points="${[route.start, ...route.steps].map(point => `${point.x - minX},${point.z - minZ}`).join(' ')}" fill="none" stroke="#aa794d" stroke-width=".4" stroke-dasharray=".7 .45"/>`).join('');
  return `<svg viewBox="-1 -1 ${width + 2} ${depth + 2}" aria-hidden="true"><rect width="${width}" height="${depth}" rx=".4" fill="#e4e8d7"/>${cover}${routes}</svg><span>EXPLORE THE TERRAIN<br>Houses, cover and climb routes.<br><b>Spawns and supplies change each match.</b></span>`;
}

export function chooseRoyaleRoom(dialog) {
  if (dialog.open) return Promise.resolve(null);
  const form = dialog.querySelector('form');
  const map = form.elements.namedItem('mapId');
  const capacity = form.elements.namedItem('capacity');
  const note = dialog.querySelector('[data-royale-map-note]');
  const preview = dialog.querySelector('[data-royale-map-preview]');
  // Populate from the shared authoritative catalog rather than duplicated names.
  map.replaceChildren(...Object.values(MAPS).map(arena => {
    const option = document.createElement('option'); option.value = arena.id; option.textContent = arena.name; return option;
  }));
  const updateMap = () => {
    const arena = MAPS[map.value]; note.textContent = arena?.description || '';
    preview.innerHTML = arena ? royaleOverview(arena) : '';
    preview.setAttribute('aria-label', arena ? `${arena.name} terrain overview` : 'Terrain overview');
  };
  updateMap();
  return new Promise(resolve => {
    let finished = false;
    const finish = settings => {
      if (finished) return; finished = true;
      form.removeEventListener('submit', submit); map.removeEventListener('change', updateMap);
      dialog.removeEventListener('close', cancel); dialog.removeEventListener('cancel', cancel);
      dialog.querySelector('[data-cancel-royale]').removeEventListener('click', cancel);
      dialog.close(); resolve(settings);
    };
    const cancel = () => finish(null);
    const submit = event => {
      event.preventDefault(); const maximum = Number(capacity.value);
      if (validRoyaleSettings(map.value, maximum)) finish({ capacity: maximum, mapId: map.value });
    };
    form.addEventListener('submit', submit); map.addEventListener('change', updateMap);
    dialog.addEventListener('close', cancel); dialog.addEventListener('cancel', cancel);
    dialog.querySelector('[data-cancel-royale]').addEventListener('click', cancel);
    dialog.showModal();
  });
}
