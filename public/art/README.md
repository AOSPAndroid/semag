# Fireside game artwork

These local assets and drawing modules provide the hub's original game artwork.
They are bundled with the host and work without an external image service.

The visual system keeps warm paper and forest green in the hub. Each cabinet
then has its own materials and palette: weathered stone for adventures,
illustrated paper and felt for cards, cut glass for Prism, lit asphalt for driving,
wood and enamel for classic boards, and distinct comic silhouettes for Oddstock.
Paris Pedal has a daytime perspective street view, with Haussmann facades, cafe
awnings, a courier seen from behind on an e-bike, buses, and cyclists. Cached
facades, skyline art, and vehicle sprites ship with the host.

Static environments and reusable portraits are cached by their renderers.
Animated poses and effects follow the game state; artwork never changes movement,
collision, attack range, card identity, or the multiplayer rules.

Shelf covers live in `../hub/`. The three original action previews use their
live renderers so their characters and scenery stay consistent with gameplay.
The pixel logo remains in `../hub/logo.svg`.
