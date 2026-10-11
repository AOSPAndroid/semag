import { MAPS } from '../shinobi-voxel-maps.js';

export function validShinobiRoomSettings(mapId) {
  return typeof mapId === 'string' && Object.hasOwn(MAPS, mapId);
}

/** The arena cards show the authored collision layout, including raised routes. */
export function shinobiArenaOverview(arena) {
  const { minX, maxX, minZ, maxZ } = arena.bounds;
  const width = maxX - minX, depth = maxZ - minZ;
  const solids = arena.colliders.filter(box => !box.overhead && !box.id.startsWith('wall-')).map(box =>
    `<rect x="${box.x - minX}" y="${box.z - minZ}" width="${box.w}" height="${box.d}" fill="${box.y > 0 ? '#ab8974' : box.h >= 2.4 ? '#475f70' : '#748d83'}" stroke="#d1d9d5" stroke-width=".11"/>`).join('');
  const paths = (arena.routes || []).map(route => `<polyline points="${[route.start, ...route.steps].map(point => `${point.x - minX},${point.z - minZ}`).join(' ')}" fill="none" stroke="#e0c59b" stroke-width=".34" stroke-dasharray=".65 .4"/>`).join('');
  return `<svg viewBox="-1 -1 ${width + 2} ${depth + 2}" aria-hidden="true"><rect width="${width}" height="${depth}" rx=".5" fill="#18242f"/>${solids}${paths}</svg>`;
}

/** No room is created until the native dialog receives an explicit submit. */
export function chooseShinobiRoom(dialog) {
  if (!dialog || dialog.open) return Promise.resolve(null);
  const form = dialog.querySelector('form');
  const cards = dialog.querySelector('[data-shinobi-arenas]');
  const note = dialog.querySelector('[data-shinobi-arena-note]');
  const selected = form.elements.namedItem('mapId')?.value;
  cards.replaceChildren();
  Object.values(MAPS).forEach((arena, index) => {
    const label = document.createElement('label');
    label.className = 'shinobi-arena-choice';
    const radio = document.createElement('input');
    radio.type = 'radio'; radio.name = 'mapId'; radio.value = arena.id;
    radio.checked = validShinobiRoomSettings(selected) ? selected === arena.id : index === 0;
    const card = document.createElement('span');
    const preview = document.createElement('span'); preview.className = 'shinobi-arena-preview'; preview.innerHTML = shinobiArenaOverview(arena);
    const title = document.createElement('strong'); title.textContent = arena.name;
    const detail = document.createElement('small'); detail.textContent = `${arena.routes?.length || 0} climb routes`;
    card.append(preview, title, detail); label.append(radio, card); cards.append(label);
  });
  const updateMap = () => {
    const arena = MAPS[form.elements.namedItem('mapId').value];
    note.textContent = arena?.description || '';
  };
  updateMap();
  return new Promise(resolve => {
    let finished = false;
    const finish = settings => {
      if (finished) return;
      finished = true;
      form.removeEventListener('submit', submit);
      cards.removeEventListener('change', updateMap);
      dialog.removeEventListener('close', cancel);
      dialog.removeEventListener('cancel', cancel);
      dialog.querySelector('[data-cancel-shinobi]').removeEventListener('click', cancel);
      dialog.close();
      resolve(settings);
    };
    const cancel = () => finish(null);
    const submit = event => {
      event.preventDefault();
      const mapId = form.elements.namedItem('mapId').value;
      if (validShinobiRoomSettings(mapId)) finish({ mapId });
    };
    form.addEventListener('submit', submit);
    cards.addEventListener('change', updateMap);
    dialog.addEventListener('close', cancel);
    dialog.addEventListener('cancel', cancel);
    dialog.querySelector('[data-cancel-shinobi]').addEventListener('click', cancel);
    dialog.showModal();
  });
}
