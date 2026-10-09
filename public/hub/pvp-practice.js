/** Local opponents run the shipped rules; private card authority stays inside this session. */
import * as Checkers from '../checkers-engine.js';
import * as Cards from '../cards-engine.js';
import * as Topdown from '../topdown-engine.js';
import * as Vector from '../vector-engine.js';
import * as Brawl from '../brawl-engine.js';
import { STAGES as SHINOBI_STAGES } from '../shinobi-engine.js';
import { createPractice as createShinobiPractice, startPractice as startShinobiPractice, stepPractice as stepShinobiPractice } from '../shinobi-bots.js';
import { createArenaBotController } from '../arena-bots.js';
import { createBoardCardBot } from '../board-card-bots.js';

export const PVP_PRACTICE_GAME_IDS = Object.freeze(['shinobi-showdown', 'relic-duel', 'vector-arena', 'oddstock-rumble', 'checkers', 'crazy-eights', 'twenty-one', 'memory']);
export const TICK_RATE = 120;
const CARD_GAMES = new Set(Cards.GAME_IDS);
const ARENA_ENGINES = Object.freeze({ 'relic-duel': Topdown, 'vector-arena': Vector, 'oddstock-rumble': Brawl });
const rejected = error => ({ ok: false, error });
const known = (catalog, value) => typeof value === 'string' && Object.hasOwn(catalog, value);
const settingsObject = value => value && typeof value === 'object' && !Array.isArray(value);

// Keep the generator registered on the live Cards state through deals and reshuffles.
function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let mixed = value;
    mixed = Math.imul(mixed ^ mixed >>> 15, mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ mixed >>> 7, mixed | 61);
    return ((mixed ^ mixed >>> 14) >>> 0) / 4294967296;
  };
}

function normalize(gameId, options) {
  if (!settingsObject(options)) throw new TypeError('Practice settings must be an object.');
  const difficulty = options.difficulty ?? 'hard';
  if (!['normal', 'hard', 'expert'].includes(difficulty)) throw new RangeError('Choose normal, hard or expert opponents.');
  const bots = options.bots ?? 1;
  if (!Number.isInteger(bots) || bots < 1 || bots > (gameId === 'shinobi-showdown' ? 4 : 1)) throw new RangeError(gameId === 'shinobi-showdown' ? 'Choose 1–4 opponents.' : 'This game supports one practice opponent.');
  const seed = options.seed ?? ((Date.now() ^ Math.floor(Math.random() * 4294967296)) >>> 0);
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError('Practice seed must be an unsigned 32-bit integer.');
  const config = { difficulty, bots, seed };
  if (gameId === 'shinobi-showdown') {
    config.stageId = options.stageId ?? 'rooftop';
    if (!known(SHINOBI_STAGES, config.stageId)) throw new RangeError('Choose an available Shinobi arena.');
  } else if (gameId === 'oddstock-rumble') {
    config.character = options.character ?? 'wrench'; config.stageId = options.stageId ?? 'rooftop';
    if (!known(Brawl.CHARACTERS, config.character) || !known(Brawl.STAGES, config.stageId)) throw new RangeError('Choose an available comic and stage.');
    if (options.botCharacter !== undefined) {
      config.botCharacter = options.botCharacter;
      if (!known(Brawl.CHARACTERS, config.botCharacter)) throw new RangeError('Choose an available opponent comic.');
    }
  }
  return Object.freeze(config);
}

/** Start is explicit. The caller pauses by stopping fixed simulation steps. */
export function createPvpPractice(gameId, settings = {}) {
  if (!PVP_PRACTICE_GAME_IDS.includes(gameId)) throw new RangeError('Choose an available local practice game.');
  const cardGame = CARD_GAMES.has(gameId), boardGame = gameId === 'checkers', shinobiGame = gameId === 'shinobi-showdown';
  const engine = boardGame ? Checkers : cardGame ? Cards : ARENA_ENGINES[gameId];
  let config = normalize(gameId, settings), state, bot, decisionKey = null, decisionTick = null;
  const getState = () => cardGame ? Cards.viewForPlayer(state, 0) : state;
  const botView = () => cardGame ? Cards.viewForPlayer(state, 1) : Checkers.cloneState(state);

  function positionKey(view) {
    if (view.phase !== 'fight') return null;
    if (gameId === 'twenty-one') return view.stood[1] ? null : JSON.stringify([view.round, view.hands[1]]);
    if (view.turn !== 1 || gameId === 'memory' && view.mismatchTicks > 0) return null;
    return boardGame ? JSON.stringify([view.turn, view.forcedFrom, view.board]) : String(view.revision);
  }
  function observe() {
    if (!boardGame && !cardGame) return null;
    const view = botView(); bot.observe(view);
    const key = positionKey(view);
    if (key === null) { decisionKey = decisionTick = null; }
    else if (key !== decisionKey) { decisionKey = key; decisionTick = state.tick + bot.delayTicks; }
    return view;
  }
  function create(nextConfig, start) {
    let nextState, nextBot;
    if (shinobiGame) {
      nextState = createShinobiPractice(nextConfig);
      if (start) startShinobiPractice(nextState);
    } else if (boardGame || cardGame) {
      nextState = boardGame ? Checkers.createState() : Cards.createState(gameId, { random: seededRandom(nextConfig.seed) });
      nextBot = createBoardCardBot({ gameId, playerId: 1, difficulty: nextConfig.difficulty });
      if (start) engine.startMatch(nextState);
    } else {
      nextState = engine.createState(gameId === 'relic-duel' ? 'duel' : undefined);
      if (gameId === 'oddstock-rumble') {
        const opponents = Object.keys(Brawl.CHARACTERS).filter(id => id !== nextConfig.character);
        Brawl.select(nextState, 0, { character: nextConfig.character, stage: nextConfig.stageId });
        Brawl.select(nextState, 1, { character: nextConfig.botCharacter ?? opponents[nextConfig.seed % opponents.length] });
      }
      nextBot = createArenaBotController(gameId, 1, nextConfig.difficulty);
      if (start) engine.startMatch(nextState);
    }
    nextState.gameId = gameId;
    config = nextConfig; state = nextState; bot = nextBot; decisionKey = decisionTick = null;
    observe();
    return getState();
  }
  function configure(options, start) {
    if (!settingsObject(options)) throw new TypeError('Practice settings must be an object.');
    const retained = gameId === 'oddstock-rumble' && state ? { character: state.fighters[0].characterId, stageId: state.stageId } : {};
    return create(normalize(gameId, { ...config, ...retained, ...options }), start);
  }
  create(config, false);
  return Object.freeze({
    getState,
    get settings() { return config; },
    start: (options = {}) => configure(options, true),
    reset: (options = {}) => configure(options, false),
    step(humanInput = {}) {
      if (state.phase === 'lobby' || state.phase === 'matchEnd') return getState();
      if (shinobiGame) { stepShinobiPractice(state, humanInput); return getState(); }
      if (!boardGame && !cardGame) { engine.step(state, [humanInput, bot.input(state)]); return getState(); }
      // Capture public reveals before a mismatch turns over, and after every clock change.
      observe(); engine.step(state); const view = observe();
      if (decisionTick !== null && state.tick >= decisionTick) {
        decisionTick = Infinity;
        const action = bot.action(view);
        if (action) {
          if (boardGame) Checkers.applyMove(state, 1, action.from, action.to);
          else Cards.applyAction(state, 1, action);
          observe();
        }
      }
      return getState();
    },
    action(message) {
      if (!message || typeof message !== 'object' || Array.isArray(message)) return rejected('Choose a valid practice action.');
      let result;
      if (boardGame && message.type === 'move') result = Checkers.applyMove(state, 0, message.from, message.to);
      else if (cardGame && message.type === 'card-action') result = Cards.applyAction(state, 0, message.action);
      else if (gameId === 'oddstock-rumble' && message.type === 'brawl-select') {
        const choice = {};
        if (Object.hasOwn(message, 'character')) choice.character = message.character;
        if (Object.hasOwn(message, 'stage')) choice.stage = message.stage;
        result = Brawl.select(state, 0, choice);
        if (result.ok) config = Object.freeze({ ...config, character: state.fighters[0].characterId, stageId: state.stageId });
      } else return rejected('That action is unavailable in this practice game.');
      if (result.ok) observe();
      return result;
    },
  });
}
