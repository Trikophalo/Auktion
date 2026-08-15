import type {
  CategoryDef,
  CategoryId,
  CharacterId,
  CharacterPublic,
  ChatMessage,
  GameSettings,
  GameState,
  OwnedCharacter,
  Phase,
  TradeOffer,
} from './types.js';
import { getTheme, toPublic } from './theme/index.js';
import { characterOf } from './engine/helpers.js';

/**
 * The redaction boundary.
 *
 * Everything a browser is ever allowed to know is produced here. Hidden scores,
 * the deck order and the upcoming characters never appear in this shape - the
 * only way to learn a score is the final reveal, which the server drives.
 */

export interface ClientPlayer {
  id: string;
  name: string;
  avatar: string;
  money: number;
  connected: boolean;
  isHost: boolean;
  ready: boolean;
  roster: Record<CategoryId, OwnedCharacter | undefined>;
  totalSpent: number;
}

export interface ClientAuction {
  characterId: CharacterId;
  startingBid: number;
  originalBid: number;
  timesPassed: number;
  currentBid: number;
  leaderId: string | null;
  skipped: string[];
  /** Who has voted to cut the remaining time short. */
  timeSkips: string[];
  bids: { playerId: string; amount: number; seq: number }[];
  winnerId?: string;
}

export interface ClientState {
  roomCode: string;
  version: number;
  phase: Phase;
  settings: GameSettings;
  you: string;
  players: ClientPlayer[];
  categoryOrder: CategoryId[];
  categoryIndex: number;
  /** How many characters are still undrawn in the active category. */
  deckSize: number;
  auction: ClientAuction | null;
  autoAssign: { playerId: string; characterId: CharacterId; price: number; fullPrice: number } | null;
  forced: { awards: { playerId: string; characterId: CharacterId; price: number }[] } | null;
  trading: { offers: TradeOffer[]; readyPlayers: string[]; endsAt: number } | null;
  reveal: {
    revealedColumns: number;
    totals: Record<string, number>;
    finished: boolean;
    /** Scores of already-revealed columns only (so a rejoin mid-reveal works). */
    scores: Record<CharacterId, number>;
  } | null;
  /** Votes are public as they come in; the result lands with the tally. */
  voting: { votes: Record<string, string>; winnerId: string | null; tally: Record<string, number> } | null;
  chat: ChatMessage[];
  recap: GameState['recap'];
  lastInjection: GameState['lastInjection'];
  deadline: number | null;
  winnerId: string | null;
  coolestId: string | null;
  /** Server clock, so clients can render countdowns without drift. */
  serverNow: number;
}

export interface ThemeInfo {
  id: string;
  title: string;
  tagline: string;
  icon: string;
  currency: { symbol: string; name: string };
  categories: CategoryDef[];
  generations?: { max: number; label: string };
}

/** Sent once per session: theme chrome plus the score-free character catalog. */
export function themeInfo(themeId: string): ThemeInfo {
  const theme = getTheme(themeId);
  return {
    id: theme.id,
    title: theme.title,
    tagline: theme.tagline,
    icon: theme.icon,
    currency: theme.currency,
    categories: theme.categories,
    generations: theme.generations,
  };
}

export function catalog(themeId: string): CharacterPublic[] {
  return getTheme(themeId).characters.map(toPublic);
}

export function toClientState(state: GameState, playerId: string, now: number): ClientState {
  const categoryId = state.categoryOrder[state.categoryIndex];

  // Only scores of columns already revealed on stage are included.
  const scores: Record<CharacterId, number> = {};
  if (state.reveal) {
    for (let i = 0; i < state.reveal.revealedColumns; i++) {
      const cat = state.categoryOrder[i];
      for (const p of state.players) {
        const owned = p.roster[cat];
        if (owned) scores[owned.characterId] = characterOf(state, owned.characterId).hiddenScore;
      }
    }
  }

  return {
    roomCode: state.roomCode,
    version: state.version,
    phase: state.phase,
    settings: state.settings,
    you: playerId,
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      money: p.money,
      connected: p.connected,
      isHost: p.isHost,
      ready: p.ready,
      roster: p.roster,
      totalSpent: p.totalSpent,
    })),
    categoryOrder: state.categoryOrder,
    categoryIndex: state.categoryIndex,
    deckSize: categoryId ? (state.decks[categoryId]?.length ?? 0) : 0,
    auction: state.auction
      ? {
          characterId: state.auction.characterId,
          startingBid: state.auction.startingBid,
          originalBid: state.auction.originalBid,
          timesPassed: state.auction.timesPassed,
          currentBid: state.auction.currentBid,
          leaderId: state.auction.leaderId,
          skipped: state.auction.skipped,
          timeSkips: state.auction.timeSkips,
          bids: state.auction.bids,
          winnerId: state.auction.winnerId,
        }
      : null,
    autoAssign: state.autoAssign,
    forced: state.forced,
    trading: state.trading,
    reveal: state.reveal ? { ...state.reveal, scores } : null,
    voting: state.voting,
    chat: state.chat,
    recap: state.recap,
    lastInjection: state.lastInjection,
    deadline: state.deadline,
    winnerId: state.winnerId,
    coolestId: state.coolestId,
    serverNow: now,
  };
}
