#!/usr/bin/env node
/** Export the standalone Lockdown art kit (tools/lockdown-art-kit/) from the game's manifest, so art can be
 * made in a separate repository: manifest.json (every sprite: file, size, anchor, frames, rows, facings,
 * description) and BRIEF.md (the style guide and the per-sprite list). Run after the manifest changes:
 *   node tools/lockdown-art-kit.mjs */
import { readFileSync, writeFileSync } from 'node:fs';
import { MANIFEST, KNIGHT_ANIMATION } from '../public/lockdown-assets.js';

const kit = new URL('./lockdown-art-kit/', import.meta.url).pathname;
writeFileSync(kit + 'manifest.json', JSON.stringify(MANIFEST.map(({ key, file, size, anchor, frames, rows, facings, group, description }) => ({ key, file, group, size, anchor, frames, ...(rows ? { rows, facings } : {}), description })), null, 1) + '\n');
// The style guide is the same text the game repo's brief carries; the sprite lists are rebuilt without progress ticks.
const assets = readFileSync(new URL('../public/art/lockdown/ASSETS.md', import.meta.url), 'utf8');
const guide = assets.slice(assets.indexOf('## Style guide'), assets.indexOf('## How to deliver')).trim();
const titles = { tiles: 'Tiles', environment: 'Base landmarks and terrain borders', characters: 'Bare character body', armors: 'Armor overlays', gear: 'Helmets, pants and shoes (overlays)', weapons: 'Held weapons', projectiles: 'Projectiles', bombs: 'Bombs', effects: 'Effects', pickups: 'Pickups', points: 'Control points', icons: 'Icons' };
const groups = [...new Set(MANIFEST.map(entry => entry.group))];
const table = group => ['| File | Size (px, draw at 2x) | Frames | Anchor | Notes |', '|---|---|---|---|---|',
  ...MANIFEST.filter(entry => entry.group === group).map(entry => `| \`${entry.file}\` | ${entry.size.join('×')} | ${entry.frames}${entry.rows ? ` × ${entry.rows} rows` : ''} | ${entry.anchor.join(', ')} | ${entry.description.replace(/\|/g, '/')} |`)].join('\n');
writeFileSync(kit + 'BRIEF.md', `# Lockdown art brief

Lockdown is a top-down team brawl in the spirit of Spiral Knights' Lockdown: up to 4v4, three control points,
swords, guns and bombs, on six themed arenas. This brief lists all ${MANIFEST.length} sprites the game draws. Read AGENTS.md first:
it says how to work and what quality bar the art must reach.

Knight sheets: ${KNIGHT_ANIMATION.columns} columns of ${KNIGHT_ANIMATION.frameSize.join('×')} frames (at 1x): columns ${KNIGHT_ANIMATION.idle.start + 1}–${KNIGHT_ANIMATION.idle.start + KNIGHT_ANIMATION.idle.frames} idle, ${KNIGHT_ANIMATION.walk.start + 1}–${KNIGHT_ANIMATION.walk.start + KNIGHT_ANIMATION.walk.frames} walk, ${KNIGHT_ANIMATION.run.start + 1}–${KNIGHT_ANIMATION.run.start + KNIGHT_ANIMATION.run.frames} run.

${guide}

${groups.map(group => `## ${titles[group] || group}\n\n${table(group)}`).join('\n\n')}
`);
console.log(`Art kit exported: ${MANIFEST.length} sprites.`);
