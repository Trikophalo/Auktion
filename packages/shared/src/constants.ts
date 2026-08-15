import type { GameSettings } from './types.js';

/** All tunable game rules live here so balancing never means hunting through logic. */

export const MILLION = 1_000_000;

export const RULES = {
  /** Starting balance per player. */
  START_MONEY: 1_000 * MILLION,
  /** Every bid must raise by at least this much, and land on a multiple of it. */
  BID_STEP: 5 * MILLION,

  /** Lower bound of a random cash injection. */
  INJECTION_MIN: 10 * MILLION,

  /** A character nobody wanted returns to the deck this much cheaper. */
  DECAY_FACTOR: 0.75,
  /** ...but never below this. Guarantees prices eventually reach payable levels. */
  DECAY_FLOOR: 10 * MILLION,

  /** Player count bounds. */
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 6,

  /** Trading opens after these category indices (0-based) => after the 3rd, 6th, 9th. */
  TRADING_AFTER_CATEGORY_INDEX: [2, 5, 8],
  /** Cap on simultaneously open offers per player, keeps the UI readable. */
  MAX_OPEN_OFFERS_PER_PLAYER: 3,

  /** A bid above this share of your balance asks for confirmation (client-side only). */
  BIG_BID_CONFIRM_RATIO: 0.5,

  /** Chat. */
  CHAT_MAX_LENGTH: 200,
  CHAT_HISTORY: 60,
} as const;

/** Bounds for the host-configurable lobby settings. */
export const SETTINGS_BOUNDS = {
  AUCTION_SECONDS_MIN: 60,
  AUCTION_SECONDS_MAX: 300,
  AUCTION_SECONDS_STEP: 30,
  INJECTION_MAX_MIN: 10 * MILLION,
  INJECTION_MAX_MAX: 100 * MILLION,
  INJECTION_MAX_STEP: 5 * MILLION,
} as const;

export const DEFAULT_SETTINGS: GameSettings = {
  auctionSeconds: 120,
  injectionMax: 50 * MILLION,
  injectionMode: 'random',
};

/** Clamps host input so a malformed payload can never break a game. */
export function normaliseSettings(input: Partial<GameSettings>, base = DEFAULT_SETTINGS): GameSettings {
  const b = SETTINGS_BOUNDS;
  const snap = (value: number, step: number) => Math.round(value / step) * step;

  const auctionSeconds = Number.isFinite(input.auctionSeconds)
    ? Math.min(b.AUCTION_SECONDS_MAX, Math.max(b.AUCTION_SECONDS_MIN, snap(Number(input.auctionSeconds), b.AUCTION_SECONDS_STEP)))
    : base.auctionSeconds;

  const injectionMax = Number.isFinite(input.injectionMax)
    ? Math.min(b.INJECTION_MAX_MAX, Math.max(b.INJECTION_MAX_MIN, snap(Number(input.injectionMax), b.INJECTION_MAX_STEP)))
    : base.injectionMax;

  const injectionMode = input.injectionMode === 'fixed' || input.injectionMode === 'random'
    ? input.injectionMode
    : base.injectionMode;

  return { auctionSeconds, injectionMax, injectionMode };
}

/** Every duration the server schedules, in milliseconds. */
export const TIMINGS = {
  /** Category banner before the first auction of a category. */
  CATEGORY_INTRO: 3_200,
  /** Reveal choreography: starting bid stamp -> pixelated image -> name. */
  AUCTION_REVEAL: 7_000,
  /**
   * The hot window at the end of an auction. A bid landing inside it pushes the
   * deadline back out to a full window, so nobody can snipe unanswerably - and
   * an all-player time skip cuts straight to it.
   */
  HOT_WINDOW: 10_000,
  /** Below this the client takes over the screen with the big countdown. */
  CRITICAL_SECONDS: 5,
  /** "VERKAUFT!" celebration before the next character enters. */
  SOLD: 3_800,
  /** Nobody wanted them - back into the deck. */
  PASSED: 2_800,
  /** The last player is handed the last character. */
  AUTO_ASSIGN: 4_200,
  /** Deadlock backstop: one free character dealt per remaining player. */
  FORCED_ALLOCATION: 4_000,
  /** Category recap + money injection. */
  CATEGORY_END: 5_200,
  /** Market phase. */
  TRADING: 90_000,
  /** An open offer keeps the phase alive at least this long. */
  TRADING_MIN_EXTENSION: 12_000,
  /** Final reveal: auto-advance per column if the host does nothing. */
  REVEAL_COLUMN: 8_000,
} as const;

/**
 * Deadlock backstop: if this many auctions in a row end with nobody bidding,
 * remaining players are simply dealt a free character. With price decay this
 * should effectively never fire - it exists so that "stuck" is impossible.
 */
export const FORCED_ALLOCATION_AFTER_PASSES = 10;
