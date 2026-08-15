import type { DeckEntry, GameState, Player, ThemePack } from '../types.js';
import { DEFAULT_SETTINGS, RULES } from '../constants.js';
import { createRng, shuffle, randomSeed } from '../rng.js';
import { getTheme, validateTheme } from '../theme/index.js';

export const AVATARS = ['🏴‍☠️', '🐒', '🦊', '🐧', '🦁', '🐙', '🦈', '🐲', '🦅', '🐺', '🦝', '🐯'];

export function createGame(roomCode: string, themeId = 'one-piece', seed = randomSeed()): GameState {
  const theme = getTheme(themeId);
  validateTheme(theme);

  return {
    roomCode,
    themeId,
    phase: 'lobby',
    settings: { ...DEFAULT_SETTINGS },
    rng: createRng(seed),
    players: [],
    categoryOrder: [],
    categoryIndex: 0,
    decks: {},
    auction: null,
    autoAssign: null,
    forced: null,
    trading: null,
    reveal: null,
    chat: [],
    consecutivePasses: 0,
    recap: [],
    lastInjection: [],
    deadline: null,
    seq: 0,
    version: 0,
    startedAt: null,
    endedAt: null,
    winnerId: null,
  };
}

export function makePlayer(id: string, name: string, avatar: string, isHost: boolean): Player {
  return {
    id,
    name,
    avatar,
    money: RULES.START_MONEY,
    connected: true,
    isHost,
    roster: {},
    totalSpent: 0,
    tradeBalance: 0,
    ready: false,
  };
}

/**
 * Builds the shuffled category order and the per-category decks.
 *
 * Each deck holds **exactly one character per player**, drawn at random from
 * that category's much larger pool. That is what makes the endgame of every
 * category tense: the last player standing gets whatever is left over, and
 * there is never a spare character to fall back on.
 *
 * The opening category is pinned (captains) because it is the clearest possible
 * introduction to the game; the remaining nine are shuffled per game so no two
 * matches feel alike.
 */
export function buildBoard(state: GameState): GameState {
  const theme: ThemePack = getTheme(state.themeId);
  const playerCount = state.players.length;
  let rng = state.rng;

  const rest = theme.categories.map((c) => c.id).filter((id) => id !== theme.openingCategory);
  const [shuffledRest, rng1] = shuffle(rest, rng);
  rng = rng1;
  const categoryOrder = theme.openingCategory
    ? [theme.openingCategory, ...shuffledRest]
    : shuffledRest;

  const decks: Record<string, DeckEntry[]> = {};
  for (const categoryId of categoryOrder) {
    const pool = theme.characters.filter((c) => c.category === categoryId);
    const [shuffled, nextRng] = shuffle(pool, rng);
    rng = nextRng;
    decks[categoryId] = shuffled.slice(0, playerCount).map((c) => ({
      characterId: c.id,
      startingBid: c.startingBid,
      timesPassed: 0,
    }));
  }

  return { ...state, rng, categoryOrder, decks, categoryIndex: 0 };
}
