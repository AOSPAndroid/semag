import { MAPS } from '../voxel-maps.js';
import { MELEE_WEAPONS, MELEE_IDS } from '../voxel-melee.js';

export function validHordeSettings(mapId, difficulty, capacity = 3, melee = 'katana') {
  return typeof mapId === 'string' && Object.hasOwn(MAPS, mapId) && ['veteran', 'nightmare'].includes(difficulty) && capacity === 3 && typeof melee === 'string' && Object.hasOwn(MELEE_WEAPONS, melee);
}

/** Setup compares the real shared blade timings; Last Stand's wave bonus is separate. */
export function meleeLoadoutNote(id) {
  if (typeof id !== 'string' || !Object.hasOwn(MELEE_WEAPONS, id)) return '';
  const blade = MELEE_WEAPONS[id], seconds = ticks => Number((ticks / 120).toFixed(2));
  const cycle = blade.startupTicks + blade.activeTicks + blade.recoveryTicks;
  const description = blade.description || (id === 'knife' ? 'A short, quick strike; approach through cover and leave room to retreat.' : 'A broad committed swing; protect its longer recovery with cover.');
  return `${blade.damage} base damage · ${blade.reach} m reach · ${seconds(blade.startupTicks)} s wind-up · ${seconds(cycle)} s full swing. ${description}`;
}

/** The overview shows the actual cover and climb routes, without tactical bomb sites. */
export function hordeOverview(arena) {
  const { minX, minZ, maxX, maxZ } = arena.bounds;
  const width = maxX - minX, depth = maxZ - minZ;
  const cover = arena.colliders.filter(box => !box.overhead && !box.id.startsWith('wall-')).map(box =>
    `<rect x="${box.x - minX}" y="${box.z - minZ}" width="${box.w}" height="${box.d}" fill="${box.y > 0 ? '#b59163' : box.h >= 2.4 ? '#6d8077' : '#b4b69a'}" stroke="#fffdf8" stroke-width=".16"/>`).join('');
  const routes = arena.routes.map(route => `<polyline points="${[route.start, ...route.steps].map(point => `${point.x - minX},${point.z - minZ}`).join(' ')}" fill="none" stroke="#b76f4c" stroke-width=".42" stroke-dasharray=".7 .45"/>`).join('');
  return `<svg viewBox="-1 -1 ${width + 2} ${depth + 2}" aria-hidden="true"><rect width="${width}" height="${depth}" rx=".4" fill="#e4e8d7"/>${cover}${routes}</svg><span>FIND YOUR HOLDOUT<br>Cover breaks enemy sight lines.<br><b>Dashed paths mark climb routes.</b></span>`;
}

export function chooseHordeSettings(dialog, { solo = false } = {}) {
  if (dialog.open) return Promise.resolve(null);
  const form = dialog.querySelector('form');
  const map = form.elements.namedItem('mapId'), difficulty = form.elements.namedItem('difficulty'), melee = form.elements.namedItem('melee');
  const note = dialog.querySelector('[data-horde-map-note]'), preview = dialog.querySelector('[data-horde-map-preview]');
  const selectedMap = map.value;
  map.replaceChildren(...Object.values(MAPS).map(arena => {
    const option = document.createElement('option'); option.value = arena.id; option.textContent = arena.name; return option;
  }));
  if (Object.hasOwn(MAPS, selectedMap)) map.value = selectedMap;
  const selectedMelee = melee.value;
  melee.replaceChildren(...MELEE_IDS.map(id => {
    const option = document.createElement('option'); option.value = id; option.textContent = MELEE_WEAPONS[id].name; return option;
  }));
  melee.value = Object.hasOwn(MELEE_WEAPONS, selectedMelee) ? selectedMelee : 'katana';
  const updateMelee = () => { dialog.querySelector('[data-horde-melee-note]').textContent = meleeLoadoutNote(melee.value); };
  dialog.querySelector('[data-horde-setup-title]').textContent = solo ? 'Plan your solo holdout.' : 'Set up your co-op holdout.';
  dialog.querySelector('[data-horde-setup-note]').textContent = solo
    ? 'Survive escalating waves alone. Choose your loadout and start when you are ready.'
    : 'One to three teammates. Everyone gets ready, then the host starts the run.';
  dialog.querySelector('[data-horde-submit]').textContent = solo ? 'Open solo game →' : 'Create co-op room ↗';
  const updateMap = () => {
    const arena = MAPS[map.value];
    note.textContent = arena?.description || '';
    preview.innerHTML = arena ? hordeOverview(arena) : '';
    preview.setAttribute('aria-label', arena ? `${arena.name} holdout overview with cover and climb routes` : 'Holdout overview');
  };
  updateMap(); updateMelee();
  return new Promise(resolve => {
    let finished = false;
    const finish = settings => {
      if (finished) return; finished = true;
      form.removeEventListener('submit', submit); map.removeEventListener('change', updateMap); melee.removeEventListener('change', updateMelee);
      dialog.removeEventListener('close', cancel); dialog.removeEventListener('cancel', cancel);
      dialog.querySelector('[data-cancel-horde]').removeEventListener('click', cancel);
      dialog.close(); resolve(settings);
    };
    const cancel = () => finish(null);
    const submit = event => {
      event.preventDefault();
      if (validHordeSettings(map.value, difficulty.value, 3, melee.value)) finish({ capacity: 3, mapId: map.value, difficulty: difficulty.value, melee: melee.value });
    };
    form.addEventListener('submit', submit); map.addEventListener('change', updateMap); melee.addEventListener('change', updateMelee);
    dialog.addEventListener('close', cancel); dialog.addEventListener('cancel', cancel);
    dialog.querySelector('[data-cancel-horde]').addEventListener('click', cancel);
    dialog.showModal();
  });
}
