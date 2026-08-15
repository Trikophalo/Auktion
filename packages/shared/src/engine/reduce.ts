import type {
  Action,
  CategoryRecapEntry,
  ChatMessage,
  DeckEntry,
  GameEvent,
  GameState,
  ReduceResult,
  TradeOffer,
} from '../types.js';
import { RULES, TIMINGS, isDeadlocked, normaliseSettings } from '../constants.js';
import { nextInt, pick } from '../rng.js';
import { getTheme, playerCapacity, toPublic } from '../theme/index.js';
import { applyInjection, computeAwards, computeTotals, partialTotals } from './economy.js';
import {
  bump,
  categoryOf,
  characterOf,
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

/** Appends a system line to the chat, which doubles as the game log. */
function withSystemChat(state: GameState, text: string, now: number): { state: GameState; event: GameEvent } {
  const message: ChatMessage = {
    id: state.seq + 1,
    playerId: null,
    name: 'Auktionshaus',
    avatar: '📣',
    text,
    at: now,
    kind: 'system',
  };
  return {
    state: { ...state, seq: state.seq + 1, chat: [...state.chat, message].slice(-RULES.CHAT_HISTORY) },
    event: { type: 'chat:message', message },
  };
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
    autoAssign: null,
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
 *   too many dead ends  -> forced allocation (free characters)
 *   1 eligible player   -> the last character is handed to them automatically
 *   otherwise           -> draw the next character, run a real auction
 *
 * Because every deck holds exactly one character per player, "1 player left"
 * always means "1 character left" - they belong together by construction.
 */
function beginNextAuction(state: GameState, now: number): Flow {
  const eligible = eligiblePlayers(state);
  if (eligible.length === 0) return endCategory(state, now);

  const categoryId = categoryOf(state);
  const deck = state.decks[categoryId];

  // Unreachable with a well-formed deck, but the game must degrade gracefully.
  if (deck.length === 0) return endCategory(state, now);

  if (eligible.length > 1 && isDeadlocked(state.consecutivePasses, deck.length)) {
    return forcedAllocation(state, now);
  }

  if (eligible.length === 1) return autoAssign(state, now, eligible[0].id, deck[0]);

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
      timeSkips: [],
      bids: [],
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
  if (settled) return settled;

  const ms = state.settings.auctionSeconds * 1000;
  const { state: s1, timer } = schedule(s0, now, ms);
  return { state: s1, events: [{ type: 'auction:open', endsAt: now + ms }], timer };
}

/** Nobody left to act? Then sell (or pass) immediately instead of idling. */
function maybeResolveEarly(state: GameState, now: number): Flow | null {
  if (state.phase !== 'auction_open') return null;
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
    auction: { ...auction, winnerId, winningBid: amount },
  };

  const winner = playerOf(s0, winnerId)!;
  const chat = withSystemChat(
    s0,
    `${winner.name} ersteigert ${characterOf(s0, auction.characterId).name} für ${Math.round(amount / 1_000_000)} Mio.`,
    now,
  );

  const { state: s1, timer } = schedule(chat.state, now, TIMINGS.SOLD);
  return {
    state: s1,
    events: [
      { type: 'auction:sold', playerId: winnerId, amount, characterId: auction.characterId, categoryId },
      chat.event,
    ],
    timer,
  };
}

/**
 * Nobody wanted this character: they go to the back of the queue at exactly the
 * same price and the next one comes up. A character never sells below its
 * starting bid, so waiting someone out only costs time, never money.
 *
 * Because the price never moves, a full cycle without a single bid proves the
 * situation cannot improve - that is what `isDeadlocked` watches for.
 */
function passCharacter(state: GameState, now: number): Flow {
  const auction = state.auction!;
  const categoryId = categoryOf(state);

  const entry: DeckEntry = {
    characterId: auction.characterId,
    startingBid: auction.startingBid,
    timesPassed: auction.timesPassed + 1,
  };

  const s0: GameState = {
    ...state,
    decks: { ...state.decks, [categoryId]: [...state.decks[categoryId], entry] },
    phase: 'auction_passed',
    consecutivePasses: state.consecutivePasses + 1,
  };

  const { state: s1, timer } = schedule(s0, now, TIMINGS.PASSED);
  return {
    state: s1,
    events: [{ type: 'auction:passed', characterId: auction.characterId }],
    timer,
  };
}

/**
 * One player, one character, no auction to run: the leftover is handed over at
 * its current starting price - capped at whatever the player can still afford,
 * so a broke player gets it for free and the board always completes.
 */
function autoAssign(state: GameState, now: number, playerId: string, entry: DeckEntry): Flow {
  const categoryId = categoryOf(state);
  const player = playerOf(state, playerId)!;
  const price = Math.min(entry.startingBid, player.money);

  let s0 = withPlayer(state, playerId, (p) => ({
    ...p,
    money: p.money - price,
    totalSpent: p.totalSpent + price,
    roster: {
      ...p.roster,
      [categoryId]: { characterId: entry.characterId, pricePaid: price, via: 'auto' as const },
    },
  }));

  s0 = {
    ...s0,
    decks: {
      ...s0.decks,
      [categoryId]: s0.decks[categoryId].filter((d) => d.characterId !== entry.characterId),
    },
    phase: 'auto_assign',
    auction: null,
    consecutivePasses: 0,
    autoAssign: { playerId, characterId: entry.characterId, price, fullPrice: entry.startingBid },
  };

  const chat = withSystemChat(
    s0,
    price === 0
      ? `${player.name} erhält ${characterOf(s0, entry.characterId).name} gratis - der Rest der Kategorie.`
      : `${player.name} erhält ${characterOf(s0, entry.characterId).name} zum Mindestpreis (${Math.round(price / 1_000_000)} Mio.).`,
    now,
  );

  const { state: s1, timer } = schedule(chat.state, now, TIMINGS.AUTO_ASSIGN);
  return {
    state: s1,
    events: [
      { type: 'auction:autoAssign', playerId, characterId: entry.characterId, price, fullPrice: entry.startingBid },
      chat.event,
    ],
    timer,
  };
}

/**
 * Nobody bid for a full cycle, so the auction house allocates what is left.
 *
 * Each remaining player pays the minimum price, capped at their balance - the
 * exact same deal as the last-player hand-over. Dealing these for free would
 * hand the table an exploit: everyone passes on everything and collects a whole
 * category for nothing.
 */
function forcedAllocation(state: GameState, now: number): Flow {
  const categoryId = categoryOf(state);
  let deck = state.decks[categoryId];
  let rng = state.rng;
  const awards: { playerId: string; characterId: string; price: number }[] = [];
  let s0 = state;

  for (const player of eligiblePlayers(state)) {
    if (deck.length === 0) break;
    const [index, nextRng] = nextInt(rng, 0, deck.length - 1);
    rng = nextRng;
    const entry = deck[index];
    deck = deck.filter((_, i) => i !== index);

    const price = Math.min(entry.startingBid, playerOf(s0, player.id)!.money);
    awards.push({ playerId: player.id, characterId: entry.characterId, price });
    s0 = withPlayer(s0, player.id, (p) => ({
      ...p,
      money: p.money - price,
      totalSpent: p.totalSpent + price,
      roster: {
        ...p.roster,
        [categoryId]: { characterId: entry.characterId, pricePaid: price, via: 'forced' as const },
      },
    }));
  }

  s0 = {
    ...s0,
    rng,
    decks: { ...s0.decks, [categoryId]: deck },
    phase: 'forced_allocation',
    auction: null,
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
  let s0: GameState = { ...state, recap, phase: 'category_end', auction: null, autoAssign: null, forced: null };
  if (!isLastCategory) {
    const injected = applyInjection(s0);
    s0 = injected.state;
    events.push({ type: 'economy:injection', grants: injected.grants });
  }

  // No injection after the last category, so no per-player reveal to wait for.
  const duration = isLastCategory
    ? TIMINGS.CATEGORY_END_BASE
    : TIMINGS.CATEGORY_END_BASE + state.players.length * TIMINGS.CATEGORY_END_PER_PLAYER;

  const { state: s1, timer } = schedule(s0, now, duration);
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

  if (columnIndex >= state.categoryOrder.length) return startVoting(state, now);

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

  // After the last column the vote opens rather than the scoreboard.
  const isLast = columnIndex + 1 >= state.categoryOrder.length;
  const { state: s1, timer } = schedule(s0, now, isLast ? TIMINGS.REVEAL_COLUMN : TIMINGS.REVEAL_COLUMN);
  void isLast;

  return {
    state: s1,
    events: [{ type: 'reveal:column', columnIndex, categoryId, cells, totals }],
    timer,
  };
}

/**
 * After the points are known, the table votes on the coolest team. You cannot
 * vote for yourself, so with two players it is simply "the other one" - the
 * vote still runs, it just cannot be a contest.
 */
function startVoting(state: GameState, now: number): Flow {
  const s0: GameState = {
    ...state,
    phase: 'voting',
    voting: { votes: {}, winnerId: null, tally: {} },
  };
  const { state: s1, timer } = schedule(s0, now, TIMINGS.VOTING);
  return { state: s1, events: [{ type: 'voting:start', endsAt: now + TIMINGS.VOTING }], timer };
}

/** Closes the vote: highest tally wins, a tie is broken by the seeded RNG. */
function closeVoting(state: GameState, now: number): Flow {
  const voting = state.voting ?? { votes: {}, winnerId: null, tally: {} };

  const tally: Record<string, number> = {};
  for (const player of state.players) tally[player.id] = 0;
  for (const targetId of Object.values(voting.votes)) {
    if (tally[targetId] !== undefined) tally[targetId] += 1;
  }

  const best = Math.max(...Object.values(tally));
  const leaders = Object.keys(tally).filter((id) => tally[id] === best);

  let rng = state.rng;
  let coolestId = leaders[0];
  const tiebreak = leaders.length > 1;
  if (tiebreak) {
    const [chosen, nextRng] = pick(leaders, rng);
    coolestId = chosen;
    rng = nextRng;
  }

  const winner = playerOf(state, coolestId);
  const chat = withSystemChat(
    { ...state, rng, coolestId, voting: { ...voting, winnerId: coolestId, tally } },
    tiebreak
      ? `Gleichstand beim Voting - das Los entscheidet: ${winner?.name} hat das coolste Team!`
      : `${winner?.name} hat das coolste Team!`,
    now,
  );

  const s0: GameState = { ...chat.state, phase: 'voting' };
  const { state: s1, timer } = schedule(s0, now, TIMINGS.VOTING_RESULT);

  return {
    state: s1,
    events: [{ type: 'voting:result', coolestId, tally, tiebreak }, chat.event],
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

    case 'UPDATE_SETTINGS': {
      if (state.phase !== 'lobby') return fail(state, action.playerId, 'Einstellungen sind nur in der Lobby änderbar.');
      const player = playerOf(state, action.playerId);
      if (!player?.isHost) return fail(state, action.playerId, 'Nur der Host kann die Einstellungen ändern.');
      const settings = normaliseSettings(action.settings, state.settings);
      return { state: { ...state, settings }, events: [{ type: 'settings:update', settings }], timer: null };
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
      if (state.phase !== 'auction_open') {
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

      // A bid inside the hot window pushes the deadline back out to a full
      // window, so a last-second snipe can always be answered. Earlier bids
      // leave the clock alone.
      const remaining = (state.deadline ?? action.now) - action.now;
      const extended = remaining <= TIMINGS.HOT_WINDOW;
      const deadline = extended ? action.now + TIMINGS.HOT_WINDOW : state.deadline!;

      const seq = state.seq + 1;
      const s0: GameState = {
        ...state,
        seq,
        deadline,
        auction: {
          ...auction,
          currentBid: amount,
          leaderId: action.playerId,
          // The situation changed - a previous "let's move on" consensus is void.
          timeSkips: [],
          bids: [...auction.bids, { playerId: action.playerId, amount, seq }],
        },
      };

      const events: GameEvent[] = [
        { type: 'auction:bid', playerId: action.playerId, amount, seq, endsAt: deadline, extended },
      ];

      // Everyone else already passed? Then this bid wins on the spot.
      const settled = maybeResolveEarly(s0, action.now);
      if (settled) return { ...settled, events: [...events, ...settled.events] };

      return { state: s0, events, timer: extended ? { ms: TIMINGS.HOT_WINDOW } : null };
    }

    case 'SKIP': {
      const skippable = state.phase === 'auction_reveal' || state.phase === 'auction_open';
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

    /**
     * "Zeit überspringen": everyone at the table agreeing that the clock is just
     * in the way cuts straight to the final window. Any single player can undo
     * the consensus simply by bidding.
     */
    case 'SKIP_TIME': {
      if (state.phase !== 'auction_open' || !state.auction) {
        return fail(state, action.playerId, 'Gerade läuft keine Auktion.');
      }
      const auction = state.auction;
      if (!playerOf(state, action.playerId)) return fail(state, action.playerId, 'Spieler nicht gefunden.');
      if (auction.timeSkips.includes(action.playerId)) return { state, events: NO_EVENTS, timer: null };

      const timeSkips = [...auction.timeSkips, action.playerId];
      const voters = state.players.filter((p) => p.connected);
      const applied = voters.every((p) => timeSkips.includes(p.id));

      const remaining = (state.deadline ?? action.now) - action.now;
      const cut = applied && remaining > TIMINGS.HOT_WINDOW;

      const s0: GameState = {
        ...state,
        auction: { ...auction, timeSkips },
        deadline: cut ? action.now + TIMINGS.HOT_WINDOW : state.deadline,
      };

      return {
        state: s0,
        events: [
          { type: 'auction:timeSkip', playerId: action.playerId, votes: timeSkips.length, needed: voters.length, applied },
        ],
        timer: cut ? { ms: TIMINGS.HOT_WINDOW } : null,
      };
    }

    // ----------------------------------------------------------------- chat
    case 'CHAT': {
      const player = playerOf(state, action.playerId);
      if (!player) return { state, events: NO_EVENTS, timer: null };
      const text = action.text.trim().slice(0, RULES.CHAT_MAX_LENGTH);
      if (!text) return { state, events: NO_EVENTS, timer: null };

      const message: ChatMessage = {
        id: state.seq + 1,
        playerId: player.id,
        name: player.name,
        avatar: player.avatar,
        text,
        at: action.now,
        kind: 'player',
      };

      return {
        state: {
          ...state,
          seq: state.seq + 1,
          chat: [...state.chat, message].slice(-RULES.CHAT_HISTORY),
        },
        events: [{ type: 'chat:message', message }],
        timer: null,
      };
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

      const from = playerOf(traded, offer.fromId)!;
      const to = playerOf(traded, offer.toId)!;
      const chat = withSystemChat(
        { ...traded, trading: { ...traded.trading!, offers } },
        `${from.name} und ${to.name} haben getauscht: ${characterOf(traded, offer.giveCharacterId).name} ⇄ ${characterOf(traded, offer.wantCharacterId).name}`,
        action.now,
      );

      return {
        state: chat.state,
        events: [{ type: 'trading:update', offer: updated }, chat.event],
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

    case 'VOTE': {
      if (state.phase !== 'voting' || !state.voting) {
        return fail(state, action.playerId, 'Gerade läuft keine Abstimmung.');
      }
      if (state.voting.winnerId) return { state, events: NO_EVENTS, timer: null };
      if (action.playerId === action.targetId) {
        return fail(state, action.playerId, 'Für das eigene Team kannst du nicht stimmen.');
      }
      if (!playerOf(state, action.playerId) || !playerOf(state, action.targetId)) {
        return fail(state, action.playerId, 'Spieler nicht gefunden.');
      }

      const votes = { ...state.voting.votes, [action.playerId]: action.targetId };
      const s0: GameState = { ...state, voting: { ...state.voting, votes } };

      const voters = s0.players.filter((p) => p.connected);
      const events: GameEvent[] = [
        { type: 'voting:cast', playerId: action.playerId, votesIn: Object.keys(votes).length, needed: voters.length },
      ];

      // Everyone has voted - no reason to run out the clock.
      if (voters.every((p) => votes[p.id])) {
        const closed = closeVoting(s0, action.now);
        return { ...closed, events: [...events, ...closed.events] };
      }

      return { state: s0, events, timer: null };
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
      // The clock ran out: sell to the leader, or drop a character nobody wanted.
      return state.auction?.leaderId ? sellToLeader(state, now) : passCharacter(state, now);

    case 'auction_sold':
    case 'auction_passed':
    case 'auto_assign':
      return beginNextAuction(state, now);

    case 'forced_allocation':
      return endCategory(state, now);

    case 'category_end':
      return afterCategory(state, now);

    case 'trading':
      return endTrading(state, now);

    case 'final_reveal':
      return revealNextColumn(state, now);

    case 'voting':
      // First tick closes the vote, the second ends the game after the result.
      return state.voting?.winnerId ? finishGame(state, now) : closeVoting(state, now);

    default:
      return { state, events: NO_EVENTS, timer: null };
  }
}
