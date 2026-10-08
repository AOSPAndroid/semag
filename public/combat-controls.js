const MOVEMENT = [
  ['KeyA', 'left'], ['ArrowLeft', 'left'], ['KeyD', 'right'], ['ArrowRight', 'right'],
  ['KeyW', 'up'], ['ArrowUp', 'up'], ['KeyS', 'down'], ['ArrowDown', 'down'],
];

/** Canonical controls; gameCode resolves the player's printed keyboard layout. */
export function createCombatKeyMap(gameId) {
  switch (gameId) {
    case 'afterimage':
      return new Map([
        ['KeyA', 'left'], ['ArrowLeft', 'left'], ['KeyD', 'right'], ['ArrowRight', 'right'],
        ['KeyW', 'jump'], ['ArrowUp', 'jump'], ['Space', 'jump'],
        ['KeyC', 'light'], ['KeyJ', 'light'], ['KeyG', 'heavy'], ['KeyK', 'heavy'],
        ['KeyF', 'block'], ['KeyI', 'block'], ['KeyU', 'block'],
        ['ShiftLeft', 'dash'], ['ShiftRight', 'dash'], ['KeyL', 'dash'],
      ]);
    case 'shinobi-showdown':
      return new Map([...MOVEMENT,
        ['KeyC', 'attack'], ['KeyJ', 'attack'], ['KeyG', 'heavy'], ['KeyK', 'heavy'],
        ['KeyE', 'throw'], ['KeyL', 'throw'], ['KeyF', 'parry'], ['KeyI', 'parry'],
        ['KeyR', 'feint'],
        ['Space', 'dash'], ['ShiftLeft', 'dash'], ['ShiftRight', 'dash'],
      ]);
    case 'vector-arena':
      return new Map([...MOVEMENT,
        ['KeyC', 'fire'], ['KeyJ', 'fire'], ['KeyF', 'focus'], ['KeyI', 'focus'],
        ['KeyR', 'reload'], ['Space', 'dash'], ['ShiftLeft', 'dash'], ['ShiftRight', 'dash'],
      ]);
    case 'oddstock-rumble':
      return new Map([...MOVEMENT,
        ['Space', 'jump'], ['KeyC', 'attack'], ['KeyJ', 'attack'],
        ['KeyG', 'special'], ['KeyK', 'special'], ['KeyF', 'shield'], ['KeyI', 'shield'],
        ['ShiftLeft', 'dodge'], ['ShiftRight', 'dodge'], ['KeyL', 'dodge'],
      ]);
    default:
      return new Map([...MOVEMENT,
        ['KeyC', 'attack'], ['KeyJ', 'attack'], ['KeyG', 'shoot'], ['KeyK', 'shoot'],
        ['KeyF', 'block'], ['KeyI', 'block'], ['KeyL', 'block'],
        ['Space', 'roll'], ['ShiftLeft', 'roll'], ['ShiftRight', 'roll'],
      ]);
  }
}

/** Compose all held aliases so releasing one key cannot release another. */
export function combatInputFromKeys(keyMap, heldCodes, neutralInput) {
  const input = { ...neutralInput };
  for (const code of heldCodes) {
    const action = keyMap.get(code);
    if (action) input[action] = true;
  }
  return input;
}
