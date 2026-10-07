const MAP_NOTES = Object.freeze({
  courtyard: 'Stone arches, timber cover, and two sites. Control mid or take the outer lanes.',
  depot: 'Freight crates and warehouse lanes. Use the cover heights to change your approach.',
  canal: 'Industrial walkways and narrow crossings. Keep a teammate watching the flank.',
});

/** The setup dialog resolves only an explicit choice; cancelling never creates a room. */
export function chooseVoxelRoom(dialog) {
  if (dialog.open) return Promise.resolve(null);
  const form = dialog.querySelector('form');
  const map = form.elements.namedItem('mapId');
  const note = dialog.querySelector('[data-map-note]');
  const updateMap = () => { note.textContent = MAP_NOTES[map.value] || ''; };
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
      if (![1, 2, 3].includes(teamSize) || !Object.hasOwn(MAP_NOTES, map.value)) return;
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
