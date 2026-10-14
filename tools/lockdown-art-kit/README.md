# Lockdown art kit

Everything needed to make the art for Lockdown in its own repository, without the game code.

- `AGENTS.md`: how the art agent works and the quality bar (Codex reads this automatically).
- `BRIEF.md`: the style guide and every sprite with its size, anchor, frames and notes.
- `manifest.json`: the same list for tools.
- `check.mjs`: checks the PNGs in `art/` for the defects earlier art had. `node check.mjs`
- `sheets.mjs`: writes review images to `review/`. `node sheets.mjs`

## Start a new art repository

1. Create the repository and copy this folder's files into its root, plus an empty `art/` folder.
2. Open Codex in it and say: *"Read AGENTS.md and BRIEF.md, then do step 1 (style lock) for the skyway theme."*
3. Approve or redirect at each gate.

## Bring the art into the game

Copy `art/*.png` into the game repository's `public/art/lockdown/`, then run `node tools/lockdown-art-index.mjs`
there. The kit is generated from the game: after the game's manifest changes, run
`node tools/lockdown-art-kit.mjs` in the game repository and copy `manifest.json` and `BRIEF.md` across again.
