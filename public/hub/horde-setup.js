import { MAPS } from '../voxel-maps.js';
import { MELEE_WEAPONS } from '../voxel-melee.js';

// Original pixel silhouettes. Names and debut waves come from the engine rather
// than a second balance table, so the field guide follows the actual roster.
const BESTIARY = Object.freeze([
  Object.freeze({ id: 'rat', behavior: 'A tiny, quick pest with little health.', tactic: 'Watch the floor; keep moving and cut it before it reaches your feet.', art: '<path fill="#302b2c" d="M12 48h37v5H12z"/><path fill="#796c61" d="M16 35h27v15H16zM12 40h8v8h-8zM39 33h12v15H39z"/><path fill="#a29383" d="M17 31h9v10h-9zM36 29h10v11H36z"/><path fill="#c69b98" d="M19 33h5v5h-5zM38 31h6v6h-6zM49 41h7v5h-7zM7 45h9v4H7zM5 39h4v8H5zM1 35h6v5H1z"/><path fill="#ead6bb" d="M46 39h3v3h-3zM52 39h8v2h-8zM53 47h8v2h-8z"/><path fill="#1d1e21" d="M42 38h3v3h-3zM20 48h6v5h-6zM36 48h6v5h-6z"/>' }),
  Object.freeze({ id: 'pig', behavior: 'A broad, pink boar that commits to a rushing charge.', tactic: 'Wait for its windup, then sidestep the straight rush or use solid cover.', art: '<path fill="#32282d" d="M8 53h46v4H8z"/><path fill="#b57482" d="M12 30h33v20H12zM39 27h15v21H39zM10 34H5v10h9z"/><path fill="#e7a7ad" d="M16 30h24v9H16zM40 26h5v-8h8v13h-5zM44 35h14v10H44zM6 30h5v6H6z"/><path fill="#8f515f" d="M47 38h3v4h-3zM53 38h3v4h-3z"/><path fill="#1f2025" d="M43 31h3v3h-3zM14 48h9v7h-9zM34 48h9v7h-9z"/><path fill="#cb929c" d="M18 48h1v7h-1zM38 48h1v7h-1z"/>' }),
  Object.freeze({ id: 'wolf', behavior: 'A fast, silver pack hunter that flanks with nearby wolves.', tactic: 'Keep an escape route through cover; do not let the pack surround you.', art: '<path fill="#222b35" d="M8 53h47v4H8z"/><path fill="#68798b" d="M13 33h31v15H13zM34 28h13v18H34zM42 27h13v13H42z"/><path fill="#a6b5c4" d="M37 18h5v15h-5zM48 17h6v14h-6zM39 32h13v8H39zM50 34h10v7H50zM18 33h17v5H18zM9 26h8v12H9zM4 21h7v10H4z"/><path fill="#d7dfe4" d="M32 40h12v6H32zM51 35h7v3h-7z"/><path fill="#344657" d="M14 45h6v10h-6zM33 45h6v10h-6zM6 23h3v5H6z"/><path fill="#d8b565" d="M47 31h3v2h-3z"/><path fill="#141d26" d="M58 34h4v4h-4zM13 52h8v3h-8zM32 52h8v3h-8z"/>' }),
  Object.freeze({ id: 'vampire', behavior: 'A crimson-caped predator; a landed bite restores a little health.', tactic: 'Sidestep its committed lunge, or interrupt the windup with a blade.', art: '<path fill="#24232d" d="M12 29h40v26H12zM18 22h28v32H18z"/><path fill="#8d304d" d="M20 28h24v24H20zM14 23h7v11h-7zM43 23h7v11h-7z"/><path fill="#353345" d="M24 29h16v22H24zM23 50h7v9h-7zM34 50h7v9h-7z"/><path fill="#e3d9c9" d="M23 10h18v18H23zM16 36h5v9h-5zM43 36h5v9h-5z"/><path fill="#1b1c29" d="M23 9h18v5H23zM23 14h3v3h-3zM38 14h3v3h-3z"/><path fill="#d25260" d="M26 19h4v2h-4zM34 19h4v2h-4z"/><path fill="#fcf6e7" d="M28 24h3v5h-3zM34 24h3v5h-3z"/><path fill="#c6a970" d="M29 35h6v3h-6z"/>' }),
  Object.freeze({ id: 'witch', behavior: 'A violet-robed caster that winds up a slow, physical hex.', tactic: 'Strafe the projectile or break its path with cover; punish the recovery.', art: '<path fill="#3b2b54" d="M18 29h24v12H18zM14 39h32v17H14z"/><path fill="#705090" d="M12 19h37v5H12zM18 13h24v8H18zM25 7h12v8H25zM29 2h7v8h-7zM16 41h8v13h-8zM8 31h12v6H8z"/><path fill="#adb5a4" d="M23 24h14v10H23zM7 32h6v6H7zM42 34h6v6h-6z"/><path fill="#232c2d" d="M25 27h3v2h-3zM32 27h3v2h-3zM20 54h8v5h-8zM34 54h8v5h-8z"/><path fill="#917051" d="M49 22h3v36h-3z"/><path fill="#69cf9c" d="M45 14h11v11H45zM48 11h5v17h-5z"/><path fill="#c9f3c5" d="M48 15h5v4h-5z"/>' }),
  Object.freeze({ id: 'stag', behavior: 'A durable, antlered brute whose melee hit briefly pushes you back.', tactic: 'Respect its longer reach; sidestep the warning and strike during recovery.', art: '<path fill="#392c28" d="M6 54h51v4H6z"/><path fill="#895f46" d="M12 34h28v15H12zM34 24h13v23H34zM40 21h12v13H40z"/><path fill="#b1825d" d="M16 34h21v6H16zM43 26h12v7H43zM13 45h5v10h-5zM33 45h5v10h-5z"/><path fill="#e0d1af" d="M35 33h7v11h-7zM41 9h3v14h-3zM51 7h3v15h-3zM35 13h8v3h-8zM34 7h3v9h-3zM28 8h8v3h-8zM28 3h3v8h-3zM51 11h9v3h-9zM58 3h3v11h-3zM51 2h3v6h-3z"/><path fill="#242329" d="M47 24h3v3h-3zM53 28h4v4h-4zM12 52h7v4h-7zM32 52h7v4h-7z"/>' }),
]);
const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

/** Reject absent or unfinished profiles instead of inventing a debut wave. */
export function hordeBestiaryEntries(monsterTypes = {}) {
  return BESTIARY.flatMap(creature => {
    const profile = monsterTypes?.[creature.id];
    if (typeof profile?.label !== 'string' || !profile.label.trim() || !Number.isInteger(profile.debutWave) || profile.debutWave < 1) return [];
    return [{ ...creature, label: profile.label, debutWave: profile.debutWave }];
  });
}

export function hordeBestiaryMarkup(monsterTypes) {
  return hordeBestiaryEntries(monsterTypes).map(creature => `<article class="horde-creature" data-monster-type="${creature.id}"><div class="horde-creature-art"><svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" shape-rendering="crispEdges">${creature.art}</svg></div><div class="horde-creature-copy"><div class="horde-creature-heading"><h3>${escapeHtml(creature.label)}</h3><span>Wave ${creature.debutWave}+</span></div><p>${creature.behavior}</p><p class="horde-creature-tactic"><b>Counter</b> ${creature.tactic}</p></div></article>`).join('');
}

export function validHordeSettings(mapId, difficulty, capacity = 3, melee = 'knife') {
  return typeof mapId === 'string' && Object.hasOwn(MAPS, mapId) && ['veteran', 'nightmare'].includes(difficulty) && capacity === 3 && melee === 'knife';
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
  const map = form.elements.namedItem('mapId'), difficulty = form.elements.namedItem('difficulty');
  const note = dialog.querySelector('[data-horde-map-note]'), preview = dialog.querySelector('[data-horde-map-preview]');
  const selectedMap = map.value;
  map.replaceChildren(...Object.values(MAPS).map(arena => {
    const option = document.createElement('option'); option.value = arena.id; option.textContent = arena.name; return option;
  }));
  if (Object.hasOwn(MAPS, selectedMap)) map.value = selectedMap;
  dialog.querySelector('[data-horde-setup-title]').textContent = solo ? 'Plan your solo holdout.' : 'Set up your co-op holdout.';
  dialog.querySelector('[data-horde-setup-note]').textContent = solo
    ? 'Survive escalating waves alone. Pack hunters, charging beasts and hex casters join the horde. Explore the field guide in the game, then start when you are ready.'
    : 'One to three teammates. Everyone gets ready, then the host starts. Read the in-game field guide to prepare for pack hunters, charging beasts and hex casters.';
  dialog.querySelector('[data-horde-submit]').textContent = solo ? 'Open solo game →' : 'Create co-op room ↗';
  const updateMap = () => {
    const arena = MAPS[map.value];
    note.textContent = arena?.description || '';
    preview.innerHTML = arena ? hordeOverview(arena) : '';
    preview.setAttribute('aria-label', arena ? `${arena.name} holdout overview with cover and climb routes` : 'Holdout overview');
  };
  updateMap();
  return new Promise(resolve => {
    let finished = false;
    const finish = settings => {
      if (finished) return; finished = true;
      form.removeEventListener('submit', submit); map.removeEventListener('change', updateMap);
      dialog.removeEventListener('close', cancel); dialog.removeEventListener('cancel', cancel);
      dialog.querySelector('[data-cancel-horde]').removeEventListener('click', cancel);
      dialog.close(); resolve(settings);
    };
    const cancel = () => finish(null);
    const submit = event => {
      event.preventDefault();
      if (validHordeSettings(map.value, difficulty.value, 3, 'knife')) finish({ capacity: 3, mapId: map.value, difficulty: difficulty.value, melee: 'knife' });
    };
    form.addEventListener('submit', submit); map.addEventListener('change', updateMap);
    dialog.addEventListener('close', cancel); dialog.addEventListener('cancel', cancel);
    dialog.querySelector('[data-cancel-horde]').addEventListener('click', cancel);
    dialog.showModal();
  });
}
