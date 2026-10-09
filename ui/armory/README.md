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

The UI uses official `@shadcn` Base UI source components added with the shadcn CLI: Card, Tabs, Dialog, RadioGroup, Button, Badge, Input, Field, Empty, Separator and Accordion. `components.json` records the registry configuration. Semantic CSS roles come from the existing hub theme; Tailwind utilities have a `va:` prefix and preflight is omitted.

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
picker.focus(); // focus the Armory button
picker.close();
picker.destroy(); // removes the island and restores native select attributes
```

The native select remains the source of available options and committed selection. Search, category changes and preview selection affect a modal draft. Only explicit Equip changes the select value and dispatches its bubbling native `change` event. Cancel and Escape preserve the selection. Option mutations are observed automatically; repeated `sync()` calls skip unchanged state. Pass a suitable portal container when the host game has an existing dialog that marks its other sections inert.

Names, descriptions, categories and stats reference the shared game catalogs, imported externally by the built module. The thumbnail cards show `public/art/armory` renders of actual in-game geometry. A single selected model opens lazily through `voxel-armory-preview.js`, draws only for selection, resize or user input, and releases its WebGL context on close. The thumbnail stays available if interactive inspection fails. Portrait layouts put inspection above the scrolling gallery and expose detailed descriptions and stats through an accessible Accordion.
