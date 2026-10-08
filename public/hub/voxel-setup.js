import { MAPS } from '../voxel-maps.js';

/** Overview uses the same solids and jump waypoints as combat; height changes hue. */
export function mapOverview(arena) {
  const { minX, minZ, maxX, maxZ } = arena.bounds;
  const width = maxX - minX, depth = maxZ - minZ;
  const rects = arena.colliders.filter(box => !box.id.startsWith('wall-')).map(box =>
    `<rect x="${box.x - minX}" y="${box.z - minZ}" width="${box.w}" height="${box.d}" fill="${box.y > 0 ? '#bc8a58' : box.h >= 2.4 ? '#5c7c73' : '#b4b893'}" stroke="#fffdf8" stroke-width=".16"/>`).join('');
  const routes = arena.routes.map(route => `<polyline points="${[route.start, ...route.steps].map(point => `${point.x - minX},${point.z - minZ}`).join(' ')}" fill="none" stroke="#bc623c" stroke-width=".42" stroke-dasharray=".7 .45"/>`).join('');
  const sites = arena.sites.map(site => `<circle cx="${site.x - minX}" cy="${site.z - minZ}" r="${site.radius}" fill="#edf1db" stroke="#547252" stroke-width=".25"/><text x="${site.x - minX}" y="${site.z - minZ + .65}" text-anchor="middle" fill="#36543d" font-size="2" font-family="monospace">${site.id}</text>`).join('');
  return `<svg viewBox="-1 -1 ${width + 2} ${depth + 2}" aria-hidden="true"><rect width="${width}" height="${depth}" rx=".4" fill="#e4e8d7"/>${rects}${routes}${sites}</svg><span>OVERVIEW <i></i> COVER <i></i> RAISED DECKS<br><b>Dashed paths mark jump routes.</b></span>`;
}

/** The setup dialog resolves only an explicit choice; cancelling never creates a room. */
export function chooseVoxelRoom(dialog) {
  if (dialog.open) return Promise.resolve(null);
  const form = dialog.querySelector('form');
  const map = form.elements.namedItem('mapId');
  const note = dialog.querySelector('[data-map-note]');
  const preview = dialog.querySelector('[data-map-preview]');
  const selectedMap = map.value;
  map.replaceChildren(...Object.values(MAPS).map(arena => {
    const option = document.createElement('option');
    option.value = arena.id; option.textContent = arena.name; return option;
  }));
  if (Object.hasOwn(MAPS, selectedMap)) map.value = selectedMap;
  const updateMap = () => {
    const arena = MAPS[map.value];
    note.textContent = arena ? `${arena.description} ${arena.routes.length} climb routes; two bomb sites.` : '';
    if (preview) { preview.innerHTML = arena ? mapOverview(arena) : ''; preview.setAttribute('aria-label', arena ? `${arena.name} map overview with climb routes and bomb sites` : 'Map overview'); }
  };
  updateMap();
  return new Promise(resolve => {
    let finished = false;
    const finish = settings => {
      if (finished) return;
      finished = true;
      form.removeEventListener('submit', submit);
      dialog.removeEventListener('close', cancel);
      dialog.removeEventListener('cancel', cancel);
      map.removeEventListener('change', updateMap);
      dialog.querySelector('[data-cancel-voxel]').removeEventListener('click', cancel);
      dialog.close();
      resolve(settings);
    };
    const cancel = () => finish(null);
    const submit = event => {
      event.preventDefault();
      const teamSize = Number(form.elements.namedItem('teamSize').value);
      if (![1, 2, 3].includes(teamSize) || !Object.hasOwn(MAPS, map.value)) return;
      finish({ teamSize, mapId: map.value });
    };
    form.addEventListener('submit', submit);
    dialog.addEventListener('close', cancel);
    dialog.addEventListener('cancel', cancel);
    map.addEventListener('change', updateMap);
    dialog.querySelector('[data-cancel-voxel]').addEventListener('click', cancel);
    dialog.showModal();
  });
}
