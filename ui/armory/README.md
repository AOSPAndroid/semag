# Voxel Armory UI

The weapon picker is a small React island inside the existing static game shells. Its checked-in production output is `public/voxel-armory-ui.js` and `public/voxel-armory-ui.css`. The game server still needs only its existing `ws` dependency; no UI build is required to launch it.

To work on the UI:

```sh
cd ui/armory
npm ci
npm run check
npm test
npm run build
```

The UI uses official `@shadcn` Base UI source components added with the shadcn CLI: Card, Tabs, Dialog, RadioGroup, Combobox, InputGroup, Button, Badge, Input, Field, Empty, Separator and Accordion. `components.json` records the registry configuration. Semantic CSS roles come from the existing hub theme; Tailwind utilities have a `va:` prefix and preflight is omitted. The Combobox portal accepts the host's dialog/fullscreen container; its source was inspected through the CLI and adapted to the existing semantic theme without replacing the project's Button or changing dependencies.

```js
import { mountWeaponArmory } from './voxel-armory-ui.js';
const picker = mountWeaponArmory({
  select: document.getElementById('weapon-choice'),
  kind: 'gun', // or 'melee'
  title: 'Choose your weapon',
  portalContainer: document.body,
});
picker.sync(); // after programmatic value/disabled changes
picker.isOpen();
picker.focus(); // focus the quick-picker trigger
picker.close();
picker.destroy(); // removes the island and restores native select attributes
```

The native select remains the source of available options and committed selection. The compact quick picker shows actual voxel thumbnails, category groups and ammunition/handling hints. Search, hover and arrow navigation preserve the current loadout; clicking a row or pressing Enter on it explicitly chooses that weapon and closes the popup. The full Armory button still opens the model browser: search, categories and preview selection affect only its modal draft until explicit Equip. Cancel and Escape preserve the selection in both interfaces. Both paths pass the same native disabled-option/disabled-optgroup checks, update the select, and emit its bubbling `change` event only if the value changes.

Only one interface opens at a time. `isOpen()` includes either popup, `close()` closes both, and `focus()` targets the quick-picker trigger. Option mutations are observed automatically; repeated `sync()` calls skip unchanged state. Disabling the select or all offered options closes either interface. Pass a suitable portal container when the host game has an existing dialog that marks its other sections inert. Popup key events are fenced from game movement and weapon shortcuts.

Names, descriptions, categories and stats reference the shared game catalogs, imported externally by the built module. The thumbnail cards show `public/art/armory` renders of actual in-game geometry. A single selected model opens lazily through `voxel-armory-preview.js`, draws only for selection, resize or user input, and releases its WebGL context on close. The thumbnail stays available if interactive inspection fails. Portrait layouts put inspection above the scrolling gallery and expose detailed descriptions and stats through an accessible Accordion.
