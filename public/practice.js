import { ARENA, MOVES, emptyInput } from './engine.js';

// A repeatable sparring partner: decisions depend on visible animation and the
// simulation tick, never the other player's input or a random wall-clock value.
const roll = seed => {
  let value = seed | 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x45d9f3b);
  value ^= value >>> 16;
  value = Math.imul(value, 0x45d9f3b);
  value ^= value >>> 16;
  return (value >>> 0) / 4294967296;
};
const attacking = f => f.action === 'light' || f.action === 'heavy';
const moveToward = (input, direction) => {
  input.left = direction < 0;
  input.right = direction > 0;
};
export const TRAINING_STAGES = Object.freeze([
  {id:'foundations',name:'01 · The Patient Blade',tip:'Bait a long heavy strike, then punish its recovery.',range:155,reaction:28,think:17,confirm:.25},
  {id:'guard',name:'02 · The Iron Guard',tip:'Vary your timing. Heavy attacks wear down a held guard.',range:130,reaction:12,think:13,confirm:.45},
  {id:'air',name:'03 · The Rooftop Acrobat',tip:'Control landing space, turn for cross-ups, and time an anti-air.',range:155,reaction:18,think:11,confirm:.5},
  {id:'pressure',name:'04 · The Close Pursuit',tip:'Parry the first strike, evade pressure, and confirm your own combo.',range:91,reaction:14,think:9,confirm:.95},
  {id:'master',name:'05 · The Last Duel',tip:'Mix spacing, parries, stamina recovery, and confirmed cancels.',range:112,reaction:9,think:7,confirm:.9},
]);

export function botInput(state, botId = 1, style = 'open') {
  const input = emptyInput();
  const bot = state?.fighters?.[botId];
  const opponent = state?.fighters?.[1 - botId];
  if (!bot || !opponent || state.phase !== 'fight' || bot.hp <= 0) return input;

  const tick = state.tick;
  const profile=TRAINING_STAGES.find(stage=>stage.id===style);
  const direction = opponent.x >= bot.x ? 1 : -1;
  const distance = Math.abs(opponent.x - bot.x);
  const grounded = bot.y >= ARENA.floor - 0.01;
  const enemyGrounded = opponent.y >= ARENA.floor - 0.01;
  const personality = roll(Math.floor(tick / 420) + 731 * (botId + 1));
  const thinking = (tick + botId * 3) % (profile?.think || 11) === 0;
  const attackChoice = roll(Math.floor(tick / 11) + 2017 * (botId + 1));
  const cornered = direction === 1 ? bot.x < ARENA.minX + 55 : bot.x > ARENA.maxX - 55;

  // Light hits can be confirmed into a heavy. The bot sometimes drops the
  // confirm, and only commits after its own hit is visible in the simulation.
  if (bot.action === 'light' && bot.landed && bot.actionFrame >= 20 && bot.actionFrame <= 33) {
    if (thinking && attackChoice < (profile?.confirm ?? 0.66) && bot.stamina >= MOVES.heavy.stamina) input.heavy = true;
    return input;
  }
  if (bot.stun > 0 || attacking(bot) || bot.action === 'dash') return input;

  // Give each visible swing a consistent, imperfect response. Reaction times
  // are 125–250 ms; a fast light often connects before the bot can defend.
  if (attacking(opponent)) {
    const threat = MOVES[opponent.action];
    const swingSeed = (opponent.attackId ?? Math.floor((tick - opponent.actionFrame) / 11)) * 101 + botId * 67;
    const response = roll(swingSeed + 41);
    const reactionTicks = (profile?.reaction ?? 15) + Math.floor(roll(swingSeed + 93) * (style==='master'?6:16));
    const facedByEnemy = (bot.x - opponent.x) * opponent.facing >= -8;
    const inReach = distance < threat.reach + 43 && Math.abs(bot.y - opponent.y) < 105;
    const stillThreatening = opponent.actionFrame < threat.startup + threat.active + 4;
    if (facedByEnemy && inReach && stillThreatening && opponent.actionFrame >= reactionTicks) {
      if (response < 0.21 && grounded && bot.stamina > 35 && !cornered) {
        moveToward(input, -direction);
        input.dash = true;
      } else if ((response < 0.85 || style==='guard') && grounded && !bot.guardBroken && bot.stamina > 14) {
        input.block = true;
        // A cautious retreat while holding guard changes range without turning.
        if (response > 0.52 && !cornered) moveToward(input, -direction);
      } else if (!cornered) {
        moveToward(input, -direction);
      }
      return input;
    }
  }

  const recovering = attacking(opponent) && opponent.actionFrame >= MOVES[opponent.action].startup + MOVES[opponent.action].active;
  const vulnerable = recovering || opponent.stun > 10;
  const tired = bot.stamina < 27;
  const preferredRange = tired ? 210 : profile?.range ?? (personality < 0.45 ? 96 : 143);
  if (distance > preferredRange + 16) moveToward(input, direction);
  else if (distance < preferredRange - 18 && !cornered && !vulnerable) moveToward(input, -direction);

  if (!thinking) return input;

  if(style==='air' && grounded && distance<340 && attackChoice>.4) {
    input.jump=true;moveToward(input,direction);return input;
  }
  if(style==='guard' && grounded && distance<175 && bot.stamina>45 && !vulnerable && attackChoice<.28) {
    input.block=true;input.left=false;input.right=false;return input;
  }

  // Spend a little time backing away to recover rather than guarding forever.
  if (tired) {
    if (distance < 160 && !cornered) moveToward(input, -direction);
    if (cornered && grounded && attackChoice < 0.16) input.jump = true;
    return input;
  }

  const verticalOverlap = Math.abs(bot.y - opponent.y) < 92;
  if (style !== 'foundations' && distance < MOVES.light.reach + 12 && verticalOverlap && (vulnerable || attackChoice < 0.78)) {
    input.light = true;
  } else if (distance < MOVES.heavy.reach + 6 && verticalOverlap && bot.stamina > 36 && (vulnerable || attackChoice < (style==='foundations'?.8:.45))) {
    input.heavy = true;
  } else if (grounded && distance > 320 && bot.stamina > 68 && attackChoice < 0.19) {
    moveToward(input, direction);
    input.dash = true;
  } else if (grounded && distance > 95 && distance < 230 && enemyGrounded && attackChoice > 0.95) {
    // Occasional approach jumps allow anti-air practice and imperfect cross-ups.
    input.jump = true;
    moveToward(input, direction);
  }
  return input;
}
