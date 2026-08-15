import type {
  CategoryId,
  CharacterDef,
  CharacterId,
  GameState,
  Player,
  ThemePack,
} from '../types.js';
import { RULES } from '../constants.js';
import { getTheme } from '../theme/index.js';

const characterIndex = new Map<string, Map<CharacterId, CharacterDef>>();

function indexFor(theme: ThemePack): Map<CharacterId, CharacterDef> {
  let idx = characterIndex.get(theme.id);
  if (!idx) {
    idx = new Map(theme.characters.map((c) => [c.id, c]));
    characterIndex.set(theme.id, idx);
  }
  return idx;
}

export function themeOf(state: GameState): ThemePack {
  return getTheme(state.themeId);
}

export function characterOf(state: GameState, id: CharacterId): CharacterDef {
  const found = indexFor(themeOf(state)).get(id);
  if (!found) throw new Error(`Unknown character: ${id}`);
  return found;
}

export function categoryOf(state: GameState): CategoryId {
  return state.categoryOrder[state.categoryIndex];
}

export function playerOf(state: GameState, id: string): Player | undefined {
  return state.players.find((p) => p.id === id);
}

/** Players who still need a character in the active category. */
export function eligiblePlayers(state: GameState): Player[] {
  const cat = categoryOf(state);
  return state.players.filter((p) => !p.roster[cat]);
}

/**
 * Eligible players who have neither skipped nor are already leading, and who
 * are online. Once this is empty the auction can resolve immediately - no
 * reason to make everyone stare at a timer.
 */
export function pendingPlayers(state: GameState): Player[] {
  const auction = state.auction;
  if (!auction) return [];
  return eligiblePlayers(state).filter(
    (p) => p.connected && !auction.skipped.includes(p.id) && auction.leaderId !== p.id,
  );
}

/** Smallest legal next bid. */
export function minNextBid(state: GameState): number {
  const auction = state.auction;
  if (!auction) return 0;
  return auction.currentBid === 0 ? auction.startingBid : auction.currentBid + RULES.BID_STEP;
}

/** A character nobody wanted gets cheaper - this is what breaks stalemates. */
export function decayedBid(startingBid: number): number {
  const decayed = startingBid * RULES.DECAY_FACTOR;
  const snapped = Math.floor(decayed / RULES.BID_STEP) * RULES.BID_STEP;
  return Math.max(RULES.DECAY_FLOOR, snapped);
}

export function isTradingDue(categoryIndex: number): boolean {
  return (RULES.TRADING_AFTER_CATEGORY_INDEX as readonly number[]).includes(categoryIndex);
}

export function bump(state: GameState): GameState {
  return { ...state, version: state.version + 1 };
}

/** Immutably replace one player. */
export function withPlayer(state: GameState, id: string, patch: (p: Player) => Player): GameState {
  return { ...state, players: state.players.map((p) => (p.id === id ? patch(p) : p)) };
}
