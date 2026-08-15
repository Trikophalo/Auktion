import type {
  Action,
  CategoryRecapEntry,
  DeckEntry,
  GameEvent,
  GameState,
  ReduceResult,
  TradeOffer,
} from '../types.js';
import { FORCED_ALLOCATION_AFTER_PASSES, LAST_PICK_OPTIONS, RULES, TIMINGS } from '../constants.js';
import { nextInt, shuffle } from '../rng.js';
import { toPublic } from '../theme/index.js';
import { applyInjection, computeAwards, computeTotals, partialTotals } from './economy.js';
import {
  bump,
  categoryOf,
  characterOf,
  decayedBid,
  eligiblePlayers,
  isTradingDue,
  minNextBid,
  pendingPlayers,
  playerOf,
  withPlayer,
} from './helpers.js';
import { buildBoard, makePlayer } from './setup.js';
import { checkTrade, executeTrade, openOfferCount } from './trading.js';

type Flow = { state: GameState; events: GameEvent[]; timer: { ms: number } | 'clear' | null };

const NO_EVENTS: GameEvent[] = [];

function schedule(state: GameState, now: number, ms: number): { state: GameState; timer: { ms: number } } {
  return { state: { ...state, deadline: now + ms }, timer: { ms } };
}

function fail(state: GameState, playerId: string, message: string): ReduceResult {
  return { state, events: [{ type: 'error', playerId, message }], timer: null };
}

// ---------------------------------------------------------------------------
// Flow: category / auction lifecycle
// ---------------------------------------------------------------------------

function startCategory(state: GameState, now: number): Flow {
  const categoryId = state.categoryOrder[state.categoryIndex];
  const s0: GameState = {
    ...state,
    phase: 'category_intro',
    auction: null,
    lastPick: null,
    forced: null,
    trading: null,
    consecutivePasses: 0,
    recap: [],
  };
  const { state: s1, timer } = schedule(s0, now, TIMINGS.CATEGORY_INTRO);
  return {
    state: s1,
    events: [
      {
        type: 'category:intro',
        categoryId,
        index: state.categoryIndex,
        deckSize: state.decks[categoryId].length,
      },
    ],
    timer,
  };
}

/**
 * Decides what happens next inside a category. This single function carries the
 * completion guarantee:
 *
 *   0 eligible players  -> category is done
 *   too many dead ends  -> forced allocation (free characters, no deadlock)
 *   1 eligible player   -> Last Pick (never a solo "auction")
 *   otherwise           -> draw the next character and run a real auction
 */
function beginNextAuction(state: GameState, now: number): Flow {
  const eligible = eligiblePlayers(state);
  if (eligible.length === 0) return endCategory(state, now);

  const categoryId = categoryOf(state);
  const deck = state.decks[categoryId];

  // Unreachable with valid theme data (pool >= 12, at most 6 buyers), but the
  // game must degrade gracefully rather than hang if a theme is misconfigured.
  if (deck.length === 0) return endCategory(state, now);

  if (state.consecutivePasses >= Math.min(FORCED_ALLOCATION_AFTER_PASSES, deck.length)) {
    return forcedAllocation(state, now);
  }

  if (eligible.length === 1) return startLastPick(state, now, eligible[0].id);

  const [entry, ...rest] = deck;
  const character = characterOf(state, entry.characterId);

  const s0: GameState = {
    ...state,
    decks: { ...state.decks, [categoryId]: rest },
    phase: 'auction_reveal',
    auction: {
      characterId: entry.characterId,
      startingBid: entry.startingBid,
      originalBid: character.startingBid,
      timesPassed: entry.timesPassed,
      currentBid: 0,
      leaderId: null,
      skipped: [],
      bids: [],
      countdown: null,
    },
  };

  const { state: s1, timer } = schedule(s0, now, TIMINGS.AUCTION_REVEAL);
  return {
    state: s1,
    events: [
      {
        type: 'auction:reveal',
        character: toPublic(character),
        startingBid: entry.startingBid,
        originalBid: character.startingBid,
        timesPassed: entry.timesPassed,
      },
    ],
    timer,
  };
}

function openBidding(state: GameState, now: number): Flow {
  const s0: GameState = { ...state, phase: 'auction_open' };
  // Players may press SKIP during the reveal; if everyone did, resolve at once.
  const settled = maybeResolveEarly(s0, now);
  if (settled) return { ...settled, events: [{ type: 'auction:open' }, ...settled.events] };

  const { state: s1, timer } = schedule(s0, now, TIMINGS.SOFT_TIMER);
  return { state: s1, events: [{ type: 'auction:open' }], timer };
}

/** Nobody left to act? Then sell (or pass) immediately instead of idling. */
function maybeResolveEarly(state: GameState, now: number): Flow | null {
  if (state.phase !== 'auction_open' && state.phase !== 'auction_countdown') return null;
  if (pendingPlayers(state).length > 0) return null;
  return state.auction?.leaderId ? sellToLeader(state, now) : passCharacter(state, now);
}

function sellToLeader(state: GameState, now: number): Flow {
  const auction = state.auction!;
  const winnerId = auction.leaderId!;
  const amount = auction.currentBid;
  const categoryId = categoryOf(state);

  let s0 = withPlayer(state, winnerId, (p) => ({
    ...p,
    money: p.money - amount,
    totalSpent: p.totalSpent + amount,
    roster: {
      ...p.roster,
      [categoryId]: { characterId: auction.characterId, pricePaid: amount, via: 'auction' as const },
    },
  }));

  s0 = {
    ...s0,
    phase: 'auction_sold',
    consecutivePasses: 0,
    auction: { ...auction, countdown: null, winnerId, winningBid: amount },
  };

  const { state: s1, timer } = schedule(s0, now, TIMINGS.SOLD);
  return {
    state: s1,
    events: [
      { type: 'auction:sold', playerId: winnerId, amount, characterId: auction.characterId, categoryId },
    ],
    timer,
  };
}

/**
 * Nobody wanted this character: they go back into the deck at a random position
 * and 25% cheaper (floor 10M). The decay is what guarantees that a category can
 * always be finished, even by broke players.
 */
function passCharacter(state: GameState, now: number): Flow {
  const auction = state.auction!;
  const categoryId = categoryOf(state);
  const newBid = decayedBid(auction.startingBid);

  const entry: DeckEntry = {
    characterId: auction.characterId,
    startingBid: newBid,
    timesPassed: auction.timesPassed + 1,
  };

  const deck = state.decks[categoryId];
  const [position, rng] = nextInt(state.rng, 0, deck.length);
  const nextDeck = [...deck.slice(0, position), entry, ...deck.slice(position)];

  const s0: GameState = {
    ...state,
    rng,
    decks: { ...state.decks, [categoryId]: nextDeck },
    phase: 'auction_passed',
    consecutivePasses: state.consecutivePasses + 1,
    auction: { ...auction, countdown: null },
  };

  const { state: s1, timer } = schedule(s0, now, TIMINGS.PASSED);
  return {
    state: s1,
    events: [{ type: 'auction:passed', characterId: auction.characterId, newStartingBid: newBid }],
    timer,
  };
}

/**
 * Only one player still needs this category. A solo auction would be pointless,
 * so they get a real decision instead: three face-up characters, pick one.
 * Payment is capped at their balance - if they are broke, it is free.
 */
function startLastPick(state: GameState, now: number, playerId: string): Flow {
  const categoryId = categoryOf(state);
  const deck = state.decks[categoryId];
  const [shuffled, rng] = shuffle(deck, state.rng);
  const options = shuffled.slice(0, Math.min(LAST_PICK_OPTIONS, shuffled.length));

  const s0: GameState = {
    ...state,
    rng,
    phase: 'last_pick',
    auction: null,
    lastPick: { playerId, options },
  };
  const { state: s1, timer } = schedule(s0, now, TIMINGS.LAST_PICK);

  return {
    state: s1,
    events: [
      {
        type: 'lastPick:start',
        playerId,
        options: options.map((o) => ({
          character: toPublic(characterOf(state, o.characterId)),
          startingBid: o.startingBid,
        })),
      },
    ],
    timer,
  };
}

function resolveLastPick(state: GameState, now: number, characterId: string): Flow {
  const { playerId, options } = state.lastPick!;
  const option = options.find((o) => o.characterId === characterId) ?? options[0];
  const player = playerOf(state, playerId)!;
  const categoryId = categoryOf(state);

  // Free if they cannot afford it: the game must never be impossible to finish.
  const price = Math.min(option.startingBid, player.money);

  let s0 = withPlayer(state, playerId, (p) => ({
    ...p,
    money: p.money - price,
    totalSpent: p.totalSpent + price,
    roster: {
      ...p.roster,
      [categoryId]: { characterId: option.characterId, pricePaid: price, via: 'last_pick' as const },
    },
  }));

  s0 = {
    ...s0,
    decks: {
      ...s0.decks,
      [categoryId]: s0.decks[categoryId].filter((d) => d.characterId !== option.characterId),
    },
    lastPick: { ...s0.lastPick!, chosen: option.characterId },
    consecutivePasses: 0,
  };

  const events: GameEvent[] = [
    { type: 'lastPick:done', playerId, characterId: option.characterId, pricePaid: price },
  ];

  const ended = endCategory(s0, now);
  return { ...ended, events: [...events, ...ended.events] };
}

/**
 * Deadlock backstop. If an entire deck cycle passes without a single bid, every
 * remaining player is simply dealt a free character. Price decay makes this
 * essentially unreachable - it exists so that "stuck" is impossible, not rare.
 */
function forcedAllocation(state: GameState, now: number): Flow {
  const categoryId = categoryOf(state);
  let deck = state.decks[categoryId];
  let rng = state.rng;
  const awards: { playerId: string; characterId: string }[] = [];
  let s0 = state;

  for (const player of eligiblePlayers(state)) {
    if (deck.length === 0) break;
    const [index, nextRng] = nextInt(rng, 0, deck.length - 1);
    rng = nextRng;
    const entry = deck[index];
    deck = deck.filter((_, i) => i !== index);

    awards.push({ playerId: player.id, characterId: entry.characterId });
    s0 = withPlayer(s0, player.id, (p) => ({
      ...p,
      roster: {
        ...p.roster,
        [categoryId]: { characterId: entry.characterId, pricePaid: 0, via: 'forced' as const },
      },
    }));
  }

  s0 = {
    ...s0,
    rng,
    decks: { ...s0.decks, [categoryId]: deck },
    phase: 'forced_allocation',
    forced: { awards },
    consecutivePasses: 0,
  };

  const { state: s1, timer } = schedule(s0, now, TIMINGS.FORCED_ALLOCATION);
  return { state: s1, events: [{ type: 'forced:allocate', awards }], timer };
}

function endCategory(state: GameState, now: number): Flow {
  const categoryId = categoryOf(state);
  const recap: CategoryRecapEntry[] = state.players
    .filter((p) => p.roster[categoryId])
    .map((p) => ({
      playerId: p.id,
      characterId: p.roster[categoryId]!.characterId,
      pricePaid: p.roster[categoryId]!.pricePaid,
      via: p.roster[categoryId]!.via,
    }));

  const isLastCategory = state.categoryIndex >= state.categoryOrder.length - 1;
  const events: GameEvent[] = [{ type: 'category:end', recap }];

  // No injection after the final category - that money could never be spent.
  let s0: GameState = { ...state, recap, phase: 'category_end', auction: null, lastPick: null, forced: null };
  if (!isLastCategory) {
    const injected = applyInjection(s0);
    s0 = injected.state;
    events.push({ type: 'economy:injection', grants: injected.grants });
  }

  const { state: s1, timer } = schedule(s0, now, TIMINGS.CATEGORY_END);
  return { state: s1, events, timer };
}

function afterCategory(state: GameState, now: number): Flow {
  if (isTradingDue(state.categoryIndex) && state.categoryIndex < state.categoryOrder.length - 1) {
    return startTrading(state, now);
  }
  return nextCategoryOrReveal(state, now);
}

function nextCategoryOrReveal(state: GameState, now: number): Flow {
  if (state.categoryIndex >= state.categoryOrder.length - 1) return startReveal(state, now);
  return startCategory({ ...state, categoryIndex: state.categoryIndex + 1 }, now);
}

// ---------------------------------------------------------------------------
// Flow: trading
// ---------------------------------------------------------------------------

function startTrading(state: GameState, now: number): Flow {
  const endsAt = now + TIMINGS.TRADING;
  const s0: GameState = {
    ...state,
    phase: 'trading',
    trading: { offers: [], readyPlayers: [], endsAt },
    players: state.players.map((p) => ({ ...p, ready: false })),
  };
  const { state: s1, timer } = schedule(s0, now, TIMINGS.TRADING);
  return { state: s1, events: [{ type: 'trading:start', endsAt }], timer };
}

function endTrading(state: GameState, now: number): Flow {
  const s0: GameState = { ...state, trading: null };
  const next = nextCategoryOrReveal(s0, now);
  return { ...next, events: [{ type: 'trading:end' }, ...next.events] };
}

// ---------------------------------------------------------------------------
// Flow: final reveal
// ---------------------------------------------------------------------------

function startReveal(state: GameState, now: number): Flow {
  const s0: GameState = {
    ...state,
    phase: 'final_reveal',
    auction: null,
    trading: null,
    reveal: {
      revealedColumns: 0,
      totals: Object.fromEntries(state.players.map((p) => [p.id, 0])),
      finished: false,
    },
  };
  const { state: s1, timer } = schedule(s0, now, TIMINGS.REVEAL_COLUMN);
  return { state: s1, events: [{ type: 'reveal:start' }], timer };
}

function revealNextColumn(state: GameState, now: number): Flow {
  const reveal = state.reveal!;
  const columnIndex = reveal.revealedColumns;

  if (columnIndex >= state.categoryOrder.length) return finishGame(state, now);

  const categoryId = state.categoryOrder[columnIndex];
  const cells = state.players.map((p) => {
    const owned = p.roster[categoryId];
    return {
      playerId: p.id,
      characterId: owned?.characterId ?? '',
      score: owned ? characterOf(state, owned.characterId).hiddenScore : 0,
      pricePaid: owned?.pricePaid ?? 0,
    };
  });

  const totals = partialTotals(state, columnIndex + 1);
  const s0: GameState = {
    ...state,
    reveal: { ...reveal, revealedColumns: columnIndex + 1, totals },
  };

  const isLast = columnIndex + 1 >= state.categoryOrder.length;
  const { state: s1, timer } = schedule(s0, now, isLast ? TIMINGS.REVEAL_COLUMN : TIMINGS.REVEAL_COLUMN);

  return {
    state: s1,
    events: [{ type: 'reveal:column', columnIndex, categoryId, cells, totals }],
    timer,
  };
}

function finishGame(state: GameState, now: number): Flow {
  const totals = computeTotals(state);
  const winnerId = state.players.reduce((best, p) => (totals[p.id] > totals[best.id] ? p : best)).id;
  const awards = computeAwards(state);

  const s0: GameState = {
    ...state,
    phase: 'game_over',
    endedAt: now,
    winnerId,
    deadline: null,
    reveal: { ...state.reveal!, totals, finished: true },
  };

  return { state: s0, events: [{ type: 'game:over', winnerId, totals, awards }], timer: 'clear' };
}

// ---------------------------------------------------------------------------
// The reducer
// ---------------------------------------------------------------------------

export function reduce(state: GameState, action: Action): ReduceResult {
  const result = handle(state, action);
  return { ...result, state: bump(result.state) };
}

function handle(state: GameState, action: Action): ReduceResult {
  switch (action.type) {
    // ---------------------------------------------------------------- lobby
    case 'PLAYER_JOIN': {
      if (state.phase !== 'lobby') return fail(state, action.playerId, 'Das Spiel läuft bereits.');
      if (state.players.length >= RULES.MAX_PLAYERS) {
        return fail(state, action.playerId, 'Der Raum ist voll.');
      }
      if (state.players.some((p) => p.id === action.playerId)) {
        return { state, events: NO_EVENTS, timer: null };
      }
      const isHost = state.players.length === 0;
      const player = makePlayer(action.playerId, action.name, action.avatar, isHost);
      return { state: { ...state, players: [...state.players, player] }, events: NO_EVENTS, timer: null };
    }

    case 'PLAYER_LEAVE': {
      // Seats are only released in the lobby - mid-game a seat must survive, or
      // the "one character per category per player" invariant would break.
      if (state.phase !== 'lobby') {
        return handle(state, { type: 'PLAYER_CONNECTION', playerId: action.playerId, connected: false, now: action.now });
      }
      const players = state.players.filter((p) => p.id !== action.playerId);
      const withHost = players.length && !players.some((p) => p.isHost)
        ? players.map((p, i) => (i === 0 ? { ...p, isHost: true } : p))
        : players;
      return { state: { ...state, players: withHost }, events: NO_EVENTS, timer: null };
    }

    case 'PLAYER_CONNECTION': {
      const s0 = withPlayer(state, action.playerId, (p) => ({ ...p, connected: action.connected }));
      // A player going offline may be the last one an auction was waiting for.
      const settled = !action.connected ? maybeResolveEarly(s0, action.now) : null;
      return settled ?? { state: s0, events: NO_EVENTS, timer: null };
    }

    case 'SET_READY': {
      if (state.phase !== 'lobby') return { state, events: NO_EVENTS, timer: null };
      return {
        state: withPlayer(state, action.playerId, (p) => ({ ...p, ready: action.ready })),
        events: NO_EVENTS,
        timer: null,
      };
    }

    case 'START_GAME': {
      if (state.phase !== 'lobby') return fail(state, action.playerId, 'Das Spiel läuft bereits.');
      const player = playerOf(state, action.playerId);
      if (!player?.isHost) return fail(state, action.playerId, 'Nur der Host kann das Spiel starten.');
      if (state.players.length < RULES.MIN_PLAYERS) {
        return fail(state, action.playerId, `Mindestens ${RULES.MIN_PLAYERS} Spieler nötig.`);
      }
      const board = buildBoard({ ...state, startedAt: action.now });
      return startCategory(board, action.now);
    }

    // -------------------------------------------------------------- auction
    case 'BID': {
      if (state.phase !== 'auction_open' && state.phase !== 'auction_countdown') {
        return fail(state, action.playerId, 'Gerade läuft keine Auktion.');
      }
      const auction = state.auction!;
      const player = playerOf(state, action.playerId);
      if (!player) return fail(state, action.playerId, 'Spieler nicht gefunden.');

      const categoryId = categoryOf(state);
      if (player.roster[categoryId]) {
        return fail(state, action.playerId, 'Du hast in dieser Kategorie bereits einen Charakter.');
      }
      if (auction.skipped.includes(action.playerId)) {
        return fail(state, action.playerId, 'Du hast bei diesem Charakter bereits gepasst.');
      }
      if (auction.leaderId === action.playerId) {
        return fail(state, action.playerId, 'Du bist bereits Höchstbietender.');
      }

      const min = minNextBid(state);
      const amount = action.amount === 'quick' ? min : action.amount;

      if (!Number.isFinite(amount) || amount <= 0) {
        return fail(state, action.playerId, 'Ungültiger Betrag.');
      }
      if (amount % RULES.BID_STEP !== 0) {
        return fail(state, action.playerId, 'Gebote müssen auf 5 Mio. enden.');
      }
      if (amount < min) {
        return fail(state, action.playerId, `Mindestgebot: ${min / 1_000_000} Mio.`);
      }
      if (amount > player.money) {
        return fail(state, action.playerId, 'Dafür reicht dein Geld nicht.');
      }

      const seq = state.seq + 1;
      const s0: GameState = {
        ...state,
        seq,
        phase: 'auction_open',
        auction: {
          ...auction,
          currentBid: amount,
          leaderId: action.playerId,
          countdown: null,
          bids: [...auction.bids, { playerId: action.playerId, amount, seq }],
        },
      };

      const events: GameEvent[] = [{ type: 'auction:bid', playerId: action.playerId, amount, seq }];
      if (state.phase === 'auction_countdown') events.push({ type: 'auction:countdownCancelled' });

      // Everyone else already skipped? Then this bid wins on the spot.
      const settled = maybeResolveEarly(s0, action.now);
      if (settled) return { ...settled, events: [...events, ...settled.events] };

      const { state: s1, timer } = schedule(s0, action.now, TIMINGS.SOFT_TIMER);
      return { state: s1, events, timer };
    }

    case 'SKIP': {
      const skippable = state.phase === 'auction_reveal' || state.phase === 'auction_open' || state.phase === 'auction_countdown';
      if (!skippable || !state.auction) return fail(state, action.playerId, 'Gerade läuft keine Auktion.');

      const auction = state.auction;
      const player = playerOf(state, action.playerId);
      if (!player) return fail(state, action.playerId, 'Spieler nicht gefunden.');
      if (player.roster[categoryOf(state)]) return { state, events: NO_EVENTS, timer: null };
      if (auction.leaderId === action.playerId) {
        return fail(state, action.playerId, 'Als Höchstbietender kannst du nicht passen.');
      }
      if (auction.skipped.includes(action.playerId)) return { state, events: NO_EVENTS, timer: null };

      const s0: GameState = {
        ...state,
        auction: { ...auction, skipped: [...auction.skipped, action.playerId] },
      };
      const events: GameEvent[] = [{ type: 'auction:skip', playerId: action.playerId }];

      const settled = maybeResolveEarly(s0, action.now);
      if (settled) return { ...settled, events: [...events, ...settled.events] };

      return { state: s0, events, timer: null };
    }

    case 'LAST_PICK': {
      if (state.phase !== 'last_pick' || !state.lastPick) {
        return fail(state, action.playerId, 'Gerade läuft keine letzte Wahl.');
      }
      if (state.lastPick.playerId !== action.playerId) {
        return fail(state, action.playerId, 'Du bist nicht an der Reihe.');
      }
      if (!state.lastPick.options.some((o) => o.characterId === action.characterId)) {
        return fail(state, action.playerId, 'Diese Karte steht nicht zur Wahl.');
      }
      return resolveLastPick(state, action.now, action.characterId);
    }

    // -------------------------------------------------------------- trading
    case 'TRADE_OFFER': {
      if (state.phase !== 'trading' || !state.trading) {
        return fail(state, action.playerId, 'Die Marktphase ist geschlossen.');
      }
      if (openOfferCount(state, action.playerId) >= RULES.MAX_OPEN_OFFERS_PER_PLAYER) {
        return fail(state, action.playerId, 'Du hast bereits zu viele offene Angebote.');
      }
      const check = checkTrade(
        state,
        action.playerId,
        action.toId,
        action.giveCharacterId,
        action.wantCharacterId,
        action.money,
      );
      if (!check.ok) return fail(state, action.playerId, check.error!);

      const offer: TradeOffer = {
        id: `offer-${state.seq + 1}`,
        fromId: action.playerId,
        toId: action.toId,
        categoryId: check.categoryId!,
        giveCharacterId: action.giveCharacterId,
        wantCharacterId: action.wantCharacterId,
        money: action.money,
        status: 'open',
        counterOf: action.counterOf,
      };

      let offers = [...state.trading.offers, offer];
      if (action.counterOf) {
        offers = offers.map((o) => (o.id === action.counterOf ? { ...o, status: 'rejected' as const } : o));
      }

      // Keep the phase alive so an offer sent at the buzzer can still be answered.
      const endsAt = Math.max(state.trading.endsAt, action.now + TIMINGS.TRADING_MIN_EXTENSION);
      const s0: GameState = {
        ...state,
        seq: state.seq + 1,
        trading: { ...state.trading, offers, endsAt },
        deadline: endsAt,
      };
      return { state: s0, events: [{ type: 'trading:offer', offer }], timer: { ms: endsAt - action.now } };
    }

    case 'TRADE_RESPOND': {
      if (state.phase !== 'trading' || !state.trading) {
        return fail(state, action.playerId, 'Die Marktphase ist geschlossen.');
      }
      const offer = state.trading.offers.find((o) => o.id === action.offerId);
      if (!offer || offer.status !== 'open') return fail(state, action.playerId, 'Dieses Angebot ist nicht mehr aktiv.');

      if (action.response === 'cancel') {
        if (offer.fromId !== action.playerId) return fail(state, action.playerId, 'Nicht dein Angebot.');
        const updated = { ...offer, status: 'cancelled' as const };
        return {
          state: { ...state, trading: { ...state.trading, offers: state.trading.offers.map((o) => (o.id === offer.id ? updated : o)) } },
          events: [{ type: 'trading:update', offer: updated }],
          timer: null,
        };
      }

      if (offer.toId !== action.playerId) return fail(state, action.playerId, 'Dieses Angebot richtet sich nicht an dich.');

      if (action.response === 'reject') {
        const updated = { ...offer, status: 'rejected' as const };
        return {
          state: { ...state, trading: { ...state.trading, offers: state.trading.offers.map((o) => (o.id === offer.id ? updated : o)) } },
          events: [{ type: 'trading:update', offer: updated }],
          timer: null,
        };
      }

      // Accept: re-validate now, because balances and rosters may have changed
      // since the offer was made.
      const check = checkTrade(state, offer.fromId, offer.toId, offer.giveCharacterId, offer.wantCharacterId, offer.money);
      if (!check.ok) {
        const updated = { ...offer, status: 'expired' as const };
        return {
          state: { ...state, trading: { ...state.trading, offers: state.trading.offers.map((o) => (o.id === offer.id ? updated : o)) } },
          events: [
            { type: 'trading:update', offer: updated },
            { type: 'error', playerId: action.playerId, message: check.error! },
          ],
          timer: null,
        };
      }

      const traded = executeTrade(state, offer);
      const updated = { ...offer, status: 'accepted' as const };
      // Any other offer involving one of these two characters is now stale.
      const offers = traded.trading!.offers.map((o) => {
        if (o.id === offer.id) return updated;
        if (
          o.status === 'open' &&
          (o.giveCharacterId === offer.giveCharacterId ||
            o.giveCharacterId === offer.wantCharacterId ||
            o.wantCharacterId === offer.giveCharacterId ||
            o.wantCharacterId === offer.wantCharacterId)
        ) {
          return { ...o, status: 'expired' as const };
        }
        return o;
      });

      return {
        state: { ...traded, trading: { ...traded.trading!, offers } },
        events: [{ type: 'trading:update', offer: updated }],
        timer: null,
      };
    }

    case 'TRADE_READY': {
      if (state.phase !== 'trading' || !state.trading) return { state, events: NO_EVENTS, timer: null };
      const readyPlayers = state.trading.readyPlayers.includes(action.playerId)
        ? state.trading.readyPlayers
        : [...state.trading.readyPlayers, action.playerId];
      const s0: GameState = {
        ...withPlayer(state, action.playerId, (p) => ({ ...p, ready: true })),
        trading: { ...state.trading, readyPlayers },
      };
      const online = s0.players.filter((p) => p.connected);
      if (online.every((p) => readyPlayers.includes(p.id))) return endTrading(s0, action.now);
      return { state: s0, events: NO_EVENTS, timer: null };
    }

    // --------------------------------------------------------------- reveal
    case 'REVEAL_ADVANCE': {
      if (state.phase !== 'final_reveal') return { state, events: NO_EVENTS, timer: null };
      const player = playerOf(state, action.playerId);
      if (!player?.isHost) return fail(state, action.playerId, 'Nur der Host steuert die Enthüllung.');
      return revealNextColumn(state, action.now);
    }

    // ----------------------------------------------------------------- tick
    case 'TICK':
      return tick(state, action.now);

    default:
      return { state, events: NO_EVENTS, timer: null };
  }
}

/** The scheduled timer fired: advance whatever the current phase was waiting for. */
function tick(state: GameState, now: number): ReduceResult {
  switch (state.phase) {
    case 'category_intro':
      return beginNextAuction(state, now);

    case 'auction_reveal':
      return openBidding(state, now);

    case 'auction_open':
      // Soft timer expired: start the dramatic countdown, or drop the character
      // if nobody bid at all.
      if (!state.auction?.leaderId) return passCharacter(state, now);
      return {
        state: { ...state, phase: 'auction_countdown', auction: { ...state.auction, countdown: TIMINGS.COUNTDOWN_FROM }, deadline: now + TIMINGS.COUNTDOWN_TICK },
        events: [{ type: 'auction:countdown', value: TIMINGS.COUNTDOWN_FROM }],
        timer: { ms: TIMINGS.COUNTDOWN_TICK },
      };

    case 'auction_countdown': {
      const value = (state.auction?.countdown ?? 0) - 1;
      if (value <= 0) return sellToLeader(state, now);
      return {
        state: { ...state, auction: { ...state.auction!, countdown: value }, deadline: now + TIMINGS.COUNTDOWN_TICK },
        events: [{ type: 'auction:countdown', value }],
        timer: { ms: TIMINGS.COUNTDOWN_TICK },
      };
    }

    case 'auction_sold':
    case 'auction_passed':
      return beginNextAuction(state, now);

    case 'last_pick': {
      // Timed out - take a random one of the three, under the same price rules.
      const [index, rng] = nextInt(state.rng, 0, state.lastPick!.options.length - 1);
      const choice = state.lastPick!.options[index];
      return resolveLastPick({ ...state, rng }, now, choice.characterId);
    }

    case 'forced_allocation':
      return endCategory(state, now);

    case 'category_end':
      return afterCategory(state, now);

    case 'trading':
      return endTrading(state, now);

    case 'final_reveal':
      return revealNextColumn(state, now);

    default:
      return { state, events: NO_EVENTS, timer: null };
  }
}
