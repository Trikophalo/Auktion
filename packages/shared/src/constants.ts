/** All tunable game rules live here so balancing never means hunting through logic. */

export const MILLION = 1_000_000;

export const RULES = {
  /** Starting balance per player. */
  START_MONEY: 1_000 * MILLION,
  /** Every bid must raise by at least this much, and land on a multiple of it. */
  BID_STEP: 5 * MILLION,

  /** Cash injection after each category (inclusive range, snapped to BID_STEP). */
  INJECTION_MIN: 10 * MILLION,
  INJECTION_MAX: 50 * MILLION,

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
} as const;

/** Every duration the server schedules, in milliseconds. */
export const TIMINGS = {
  /** Category banner before the first auction of a category. */
  CATEGORY_INTRO: 3_200,
  /** Reveal choreography: starting bid stamp -> pixelated image -> name. */
  AUCTION_REVEAL: 7_000,
  /** No-bid window before the dramatic countdown starts. */
  SOFT_TIMER: 10_000,
  /** Countdown starts at 5 and ticks every second down to 0. */
  COUNTDOWN_FROM: 5,
  COUNTDOWN_TICK: 1_000,
  /** "VERKAUFT!" celebration before the next character enters. */
  SOLD: 3_800,
  /** Nobody wanted them - back into the deck. */
  PASSED: 2_800,
  /** Last eligible player picks one of three. */
  LAST_PICK: 20_000,
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
  /** Grace period before a disconnected player is auto-skipped. */
  DISCONNECT_GRACE: 10_000,
} as const;

/**
 * Deadlock backstop: if this many auctions in a row end with nobody bidding,
 * remaining players are simply dealt a free character. With price decay this
 * should effectively never fire - it exists so "stuck" is impossible, not rare.
 */
export const FORCED_ALLOCATION_AFTER_PASSES = 10;

/** Number of face-up options offered to the last eligible player. */
export const LAST_PICK_OPTIONS = 3;
