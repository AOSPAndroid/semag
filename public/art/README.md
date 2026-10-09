# Semag game artwork

These local assets and drawing modules provide the hub's original game artwork.
They are bundled with the host and work without an external image service.

The visual system keeps warm paper and forest green in the hub. Each cabinet
then has its own materials and palette: weathered stone for adventures,
illustrated paper and felt for cards, cut glass for Prism, lit asphalt for driving,
wood and enamel for classic boards, and distinct comic silhouettes for Oddstock.
Paris Pedal has a daytime perspective street view, with Haussmann facades, cafe
awnings, a courier seen from behind on an e-bike, buses, and cyclists. Its stone
walls and zinc roofs use separate materials, with straight floor bands and
window bays mapped into the street perspective. Night Drive's roadside
buildings face the road and meet the ground. Night Drive and Apex Circuit share
painted car bodies, glass, tyres and rear lights. These cached materials,
skyline art, and vehicle sprites ship with the host.

Skyline Hook uses three layered rooftop palettes, detailed runners, signal
anchors, and rope paths. Starfall Squadron uses distinct ship silhouettes,
region scenery, and shot colors with a visible pilot collision core. Ironwood
Tactics uses biome tiles, hero and enemy portraits, and exact intent overlays.
Their original artwork is drawn locally and bundled with the host, including
the shelf covers.

The voxel FPS games share original human player models with exposed faces,
varied hair and skin tones, layered clothing, and articulated movement.
Their procedural meshes and animation code ship with the host; no character
models or textures need to load from another service.

Static environments and reusable portraits are cached by their renderers.
Animated poses and effects follow the game state; artwork never changes movement,
collision, attack range, card identity, or the multiplayer rules.

Shelf covers live in `../hub/`. The three original action previews use their
live renderers so their characters and scenery stay consistent with gameplay.
The pixel logo remains in `../hub/logo.svg`.
