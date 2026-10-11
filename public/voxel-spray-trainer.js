/** Dojo spray drill: compares your last spray with the gun's natural pattern.
 * Presentation only. It reads accepted `shot` events and never feeds back into
 * combat, so it cannot change a round's direction or timing. */
import { WEAPONS } from './voxel-weapons.js';
import { sprayPath } from './voxel-recoil.js';

const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
// A pause longer than this ends the spray being recorded.
export const SPRAY_GAP_TICKS = 36;
export const SPRAY_MIN_ROUNDS = 3;

const rayAngles = event => ({ yaw: Math.atan2(finite(event.dx), -finite(event.dz)), pitch: Math.atan2(finite(event.dy), Math.hypot(finite(event.dx), finite(event.dz))) });
const wrap = angle => Math.atan2(Math.sin(angle), Math.cos(angle));

/** Offsets of each round from the opening round, plus a 0–100 control score.
 * A perfectly countered spray keeps every round on the opening point. */
export function summarizeSpray(shots, weaponId) {
  const weapon = WEAPONS[weaponId];
  if (!weapon || shots.length < SPRAY_MIN_ROUNDS) return null;
  const first = rayAngles(shots[0]);
  const rounds = shots.map(shot => { const angles = rayAngles(shot); return { yaw: wrap(angles.yaw - first.yaw), pitch: angles.pitch - first.pitch }; });
  const natural = sprayPath(weapon, rounds.length);
  const drift = list => list.reduce((total, point) => total + Math.hypot(point.yaw, point.pitch), 0) / list.length;
  const yours = drift(rounds), uncorrected = Math.max(1e-6, drift(natural));
  const control = Math.round(Math.max(0, Math.min(1, 1 - yours / uncorrected)) * 100);
  return { weapon: weaponId, rounds, natural, control };
}

export function createSprayTrainer({ card, canvas, label, score } = {}) {
  let current = [], lastTick = -Infinity, weapon = null, summary = null;
  function finish() {
    const result = summarizeSpray(current, weapon);
    if (result) { summary = result; draw(); }
    current = [];
  }
  function draw() {
    if (!summary || !canvas?.getContext) return;
    const context = canvas.getContext('2d'), width = canvas.width, height = canvas.height;
    const points = [...summary.natural, ...summary.rounds];
    const reach = Math.max(.02, ...points.map(point => Math.max(Math.abs(point.yaw) * 2, point.pitch, -point.pitch * 2)));
    const scale = (height - 24) / reach, originX = width / 2, originY = height - 12;
    const at = point => [originX + point.yaw * scale, originY - point.pitch * scale];
    context.clearRect(0, 0, width, height);
    context.strokeStyle = '#ffffff1c'; context.lineWidth = 1;
    context.beginPath(); context.moveTo(originX, 6); context.lineTo(originX, height - 6); context.stroke();
    // Natural pattern: where an untouched mouse would send each round.
    context.strokeStyle = '#a1a1aa'; context.setLineDash([3, 3]); context.beginPath();
    summary.natural.forEach((point, index) => { const [x, y] = at(point); index ? context.lineTo(x, y) : context.moveTo(x, y); });
    context.stroke(); context.setLineDash([]);
    // Your accepted rounds, warming from first to last.
    summary.rounds.forEach((point, index) => {
      const [x, y] = at(point), heat = index / Math.max(1, summary.rounds.length - 1);
      context.fillStyle = `hsl(${42 - heat * 32} 95% ${68 - heat * 12}%)`;
      context.beginPath(); context.arc(x, y, 2.6, 0, Math.PI * 2); context.fill();
    });
    context.fillStyle = '#fafafa'; context.beginPath(); context.arc(originX, originY, 3.4, 0, Math.PI * 2); context.fill();
    if (label) label.textContent = `${WEAPONS[summary.weapon]?.label || 'GUN'} · ${summary.rounds.length} ROUNDS`;
    if (score) score.textContent = `${summary.control}% control`;
    if (card) card.hidden = false;
  }
  return {
    /** Feed every fresh combat event; only the local player's opening pellet counts. */
    consume(events, playerId = 0) {
      for (const event of events) {
        if (event.type !== 'shot' || event.playerId !== playerId || event.pellet > 0) continue;
        if (event.weapon !== weapon || event.tick - lastTick > SPRAY_GAP_TICKS) { finish(); weapon = event.weapon; }
        current.push(event); lastTick = event.tick;
      }
    },
    /** Close an idle spray so the card updates soon after the trigger is released. */
    update(tick) { if (current.length && tick - lastTick > SPRAY_GAP_TICKS) finish(); },
    reset() { current = []; summary = null; weapon = null; lastTick = -Infinity; if (card) card.hidden = true; },
    get summary() { return summary; },
  };
}
