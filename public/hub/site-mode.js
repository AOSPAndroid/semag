import { pcHostUrl } from './hosting-mode.js';

export function mountPcHostDialog(doc = document) {
  const dialog = doc.getElementById('pc-host-dialog'), input = doc.getElementById('pc-host-address'), error = doc.getElementById('pc-host-error');
  const form = doc.getElementById('pc-host-form');
  const open = () => {
    try { input.value = localStorage.getItem('semag-pc-host') || ''; } catch {}
    error.hidden = true;
    dialog.showModal();
    input.focus();
  };
  doc.getElementById('pc-host-cancel').addEventListener('click', () => dialog.close());
  form.addEventListener('submit', event => {
    event.preventDefault();
    try {
      const url = pcHostUrl(input.value);
      try { localStorage.setItem('semag-pc-host', input.value.trim()); } catch {}
      location.assign(url);
    } catch (e) { error.textContent = e.message; error.hidden = false; input.focus(); }
  });
  return open;
}
