import type { RngState } from './rng.js';

// ---------------------------------------------------------------------------
// Theme data (a theme is pure data - the engine never knows what One Piece is)
// ---------------------------------------------------------------------------

export type CategoryId = string;
export type CharacterId = string;

export interface CategoryDef {
  id: CategoryId;
  /** Short label used on the board header. */
  label: string;
  /** Longer label for the auction stage banner. */
  title: string;
  icon: string;
  /** Accent colour (hex) used for the column, cards and glow. */
  color: string;
  blurb: string;
}

/** Everything a client is allowed to know about a character during the game. */
export interface CharacterPublic {
  id: CharacterId;
  name: string;
  epithet: string;
  category: CategoryId;
  /** Base starting bid before any decay. */
  startingBid: number;
  /** Set by themes that can be filtered by era (Pokémon generations). */
  generation?: number;
  flavor: string;
  /** Optional real artwork. When absent (or when loading fails) the client
   *  renders procedural art, so the game never looks broken. */
  image?: string;
}

/** Server-side character record. `hiddenScore` never leaves the server. */
export interface CharacterDef extends CharacterPublic {
  hiddenScore: number;
}

export interface ThemePack {
  id: string;
  title: string;
  tagline: string;
  /** Shown on the home screen theme picker. */
  blurb: string;
  icon: string;
  currency: { symbol: string; name: string };
  categories: CategoryDef[];
  characters: CharacterDef[];
  /** Category that always opens the game (best hook). Optional. */
  openingCategory?: CategoryId;
  /**
   * Themes whose characters carry a `generation` can be narrowed to
   * "everything up to generation N" in the lobby.
   */
  generations?: { max: number; label: string };
}

// ---------------------------------------------------------------------------
// Room settings (chosen by the host in the lobby)
// ---------------------------------------------------------------------------

export type InjectionMode = 'random' | 'fixed';

export interface GameSettings {
  /** Length of a single auction, in seconds (60-300). */
  auctionSeconds: number;
  /** Upper bound of the cash injection paid after every category. */
  injectionMax: number;
  /** random = each player rolls up to the max, fixed = everyone gets the max. */
  injectionMode: InjectionMode;
  /**
   * For themes with eras: play with everything up to this generation.
   * Ignored by themes that do not declare generation support.
   */
  maxGeneration: number;
}

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------

export type Phase =
  | 'lobby'
  | 'category_intro'
  | 'auction_reveal'
  | 'auction_open'
  | 'auction_sold'
  | 'auction_passed'
  /** The last remaining player is handed the last remaining character. */
  | 'auto_assign'
  | 'forced_allocation'
  | 'category_end'
  | 'trading'
  | 'final_reveal'
  /** Everyone votes for the coolest opponent team. */
  | 'voting'
  | 'game_over';

export interface OwnedCharacter {
  characterId: CharacterId;
  /** What the player actually paid (0 for free allocations). */
  pricePaid: number;
  /** How it was obtained - drives the end-of-game awards. */
  via: 'auction' | 'auto' | 'forced' | 'trade';
}

export interface Player {
  id: string;
  name: string;
  avatar: string;
  money: number;
  connected: boolean;
  isHost: boolean;
  /** categoryId -> owned character. Exactly one per category at game end. */
  roster: Record<CategoryId, OwnedCharacter | undefined>;
  /** Total spent on auctions (for the awards screen). */
  totalSpent: number;
  /** Net money moved through trades (positive = received). */
  tradeBalance: number;
  /** Ready flag in lobby / trading phase. */
  ready: boolean;
}

export interface DeckEntry {
  characterId: CharacterId;
  /** Current starting bid, after any decay from being passed over. */
  startingBid: number;
  /** How often this character has cycled back into the deck. */
  timesPassed: number;
}

export interface BidRecord {
  playerId: string;
  amount: number;
  /** Monotonic sequence number - the authoritative bid ordering. */
  seq: number;
}

export interface AuctionState {
  characterId: CharacterId;
  /** Starting bid for this run (already decayed). */
  startingBid: number;
  /** Original starting bid, if this character has been passed before. */
  originalBid: number;
  timesPassed: number;
  currentBid: number;
  leaderId: string | null;
  /** Players who declared SKIP for this character. */
  skipped: string[];
  /** Players who voted to cut the remaining time short. */
  timeSkips: string[];
  bids: BidRecord[];
  /** Winner, once resolved. */
  winnerId?: string;
  winningBid?: number;
}

export interface AutoAssignState {
  playerId: string;
  characterId: CharacterId;
  price: number;
  /** The undiscounted price, when the character had been passed over. */
  fullPrice: number;
}

export interface ForcedAllocationState {
  /** What each remaining player was dealt, and what they paid for it. */
  awards: { playerId: string; characterId: CharacterId; price: number }[];
}

export interface TradeOffer {
  id: string;
  fromId: string;
  toId: string;
  categoryId: CategoryId;
  /** Character the sender gives away. */
  giveCharacterId: CharacterId;
  /** Character the sender wants. */
  wantCharacterId: CharacterId;
  /** Positive: sender adds money. Negative: sender wants money on top. */
  money: number;
  status: 'open' | 'accepted' | 'rejected' | 'cancelled' | 'expired';
  /** Set when this offer is a counter to another one. */
  counterOf?: string;
}

export interface TradingState {
  offers: TradeOffer[];
  readyPlayers: string[];
  /** Absolute epoch ms when the phase closes (may be extended). */
  endsAt: number;
}

export interface RevealState {
  /** How many category columns have been revealed so far. */
  revealedColumns: number;
  /** Running totals, recomputed as columns flip. */
  totals: Record<string, number>;
  finished: boolean;
}

export interface VotingState {
  /** voterId -> the player they think built the coolest team. */
  votes: Record<string, string>;
  /** Winner of the vote, once it closes. Tie broken by the seeded RNG. */
  winnerId: string | null;
  /** Final tally, filled in when the vote closes. */
  tally: Record<string, number>;
}

export interface CategoryRecapEntry {
  playerId: string;
  characterId: CharacterId;
  pricePaid: number;
  via: OwnedCharacter['via'];
}

export interface ChatMessage {
  id: number;
  /** null for system lines. */
  playerId: string | null;
  name: string;
  avatar: string;
  text: string;
  at: number;
  kind: 'player' | 'system';
}

export interface GameState {
  roomCode: string;
  themeId: string;
  phase: Phase;
  settings: GameSettings;
  rng: RngState;
  players: Player[];
  /** Shuffled per game. */
  categoryOrder: CategoryId[];
  categoryIndex: number;
  /** Remaining, undrawn characters per category - exactly one per player. */
  decks: Record<CategoryId, DeckEntry[]>;
  auction: AuctionState | null;
  autoAssign: AutoAssignState | null;
  forced: ForcedAllocationState | null;
  trading: TradingState | null;
  reveal: RevealState | null;
  voting: VotingState | null;
  chat: ChatMessage[];
  /** Consecutive auctions in this category that nobody bid on. */
  consecutivePasses: number;
  /** Recap of the category that just ended. */
  recap: CategoryRecapEntry[];
  /** Last injection amounts, for the animation. */
  lastInjection: { playerId: string; amount: number }[];
  /** Epoch ms when the current phase auto-advances (null = waiting on players). */
  deadline: number | null;
  /** Monotonic bid sequence, also used to order all auction events. */
  seq: number;
  /** Bumped on every state change so clients can detect gaps. */
  version: number;
  startedAt: number | null;
  endedAt: number | null;
  /** Winner on hidden points. */
  winnerId: string | null;
  /** Winner of the "coolest team" vote. */
  coolestId: string | null;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type Action =
  | { type: 'PLAYER_JOIN'; playerId: string; name: string; avatar: string; now: number }
  | { type: 'PLAYER_LEAVE'; playerId: string; now: number }
  | { type: 'PLAYER_CONNECTION'; playerId: string; connected: boolean; now: number }
  | { type: 'SET_READY'; playerId: string; ready: boolean; now: number }
  | { type: 'UPDATE_SETTINGS'; playerId: string; settings: Partial<GameSettings>; now: number }
  | { type: 'START_GAME'; playerId: string; now: number }
  | { type: 'BID'; playerId: string; amount: number | 'quick'; now: number }
  | { type: 'SKIP'; playerId: string; now: number }
  /** Vote to cut the remaining auction time down to the final window. */
  | { type: 'SKIP_TIME'; playerId: string; now: number }
  | { type: 'CHAT'; playerId: string; text: string; now: number }
  | { type: 'TRADE_OFFER'; playerId: string; toId: string; giveCharacterId: CharacterId; wantCharacterId: CharacterId; money: number; counterOf?: string; now: number }
  | { type: 'TRADE_RESPOND'; playerId: string; offerId: string; response: 'accept' | 'reject' | 'cancel'; now: number }
  | { type: 'TRADE_READY'; playerId: string; now: number }
  | { type: 'REVEAL_ADVANCE'; playerId: string; now: number }
  | { type: 'VOTE'; playerId: string; targetId: string; now: number }
  /** Fired by the room when the scheduled phase timer expires. */
  | { type: 'TICK'; now: number };

// ---------------------------------------------------------------------------
// Events (server -> clients). The engine returns these; the room broadcasts.
// ---------------------------------------------------------------------------

export type GameEvent =
  | { type: 'category:intro'; categoryId: CategoryId; index: number; deckSize: number }
  | { type: 'auction:reveal'; character: CharacterPublic; startingBid: number; originalBid: number; timesPassed: number }
  | { type: 'auction:open'; endsAt: number }
  | { type: 'auction:bid'; playerId: string; amount: number; seq: number; endsAt: number; extended: boolean }
  | { type: 'auction:skip'; playerId: string }
  | { type: 'auction:timeSkip'; playerId: string; votes: number; needed: number; applied: boolean }
  | { type: 'auction:sold'; playerId: string; amount: number; characterId: CharacterId; categoryId: CategoryId }
  | { type: 'auction:passed'; characterId: CharacterId }
  | { type: 'auction:autoAssign'; playerId: string; characterId: CharacterId; price: number; fullPrice: number }
  | { type: 'forced:allocate'; awards: { playerId: string; characterId: CharacterId; price: number }[] }
  | { type: 'category:end'; recap: CategoryRecapEntry[] }
  | { type: 'economy:injection'; grants: { playerId: string; amount: number }[] }
  | { type: 'trading:start'; endsAt: number }
  | { type: 'trading:offer'; offer: TradeOffer }
  | { type: 'trading:update'; offer: TradeOffer }
  | { type: 'trading:end' }
  | { type: 'chat:message'; message: ChatMessage }
  | { type: 'settings:update'; settings: GameSettings }
  | { type: 'reveal:start' }
  | { type: 'reveal:column'; columnIndex: number; categoryId: CategoryId; cells: { playerId: string; characterId: CharacterId; score: number; pricePaid: number }[]; totals: Record<string, number> }
  | { type: 'voting:start'; endsAt: number }
  | { type: 'voting:cast'; playerId: string; votesIn: number; needed: number }
  | { type: 'voting:result'; coolestId: string; tally: Record<string, number>; tiebreak: boolean }
  | { type: 'game:over'; winnerId: string; totals: Record<string, number>; awards: Award[] }
  | { type: 'error'; playerId: string; message: string };

export interface Award {
  id: string;
  title: string;
  playerId: string;
  detail: string;
}

/** Result of a reduce() call: new state, what to broadcast, and the next timer. */
export interface ReduceResult {
  state: GameState;
  events: GameEvent[];
  /** null = leave the current timer alone, 'clear' = cancel it. */
  timer: { ms: number } | 'clear' | null;
}
