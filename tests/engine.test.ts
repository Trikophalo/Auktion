import { describe, expect, it } from 'vitest';
import {
  RULES,
  createGame,
  getTheme,
  reduce,
  toClientState,
  validateTheme,
} from '@gla/shared/server';
import { Harness, drive, playFullGame } from './helpers.js';

const CATEGORIES = 10;

describe('theme data', () => {
  it('passes boot validation', () => {
    expect(() => validateTheme(getTheme('one-piece'))).not.toThrow();
  });

  it('has enough characters in every category and no duplicates', () => {
    const theme = getTheme('one-piece');
    const ids = new Set(theme.characters.map((c) => c.id));
    expect(ids.size).toBe(theme.characters.length);

    for (const cat of theme.categories) {
      const pool = theme.characters.filter((c) => c.category === cat.id);
      // Pool must exceed max players so a category can never run dry.
      expect(pool.length).toBeGreaterThan(RULES.MAX_PLAYERS);
      expect(pool.length).toBeGreaterThanOrEqual(12);
    }
  });

  it('keeps every character in exactly one category', () => {
    const theme = getTheme('one-piece');
    const seen = new Map<string, string>();
    for (const c of theme.characters) {
      expect(seen.has(c.id)).toBe(false);
      seen.set(c.id, c.category);
    }
  });
});

describe('lobby', () => {
  it('rejects a start below the minimum player count', () => {
    const h = new Harness(['Solo']);
    h.start();
    expect(h.state.phase).toBe('lobby');
    expect(h.took('error').length).toBeGreaterThan(0);
  });

  it('only lets the host start', () => {
    const h = new Harness(['A', 'B']);
    h.dispatch({ type: 'START_GAME', playerId: 'p1', now: h.now });
    expect(h.state.phase).toBe('lobby');
  });

  it('shuffles categories but always opens with captains', () => {
    const orders = new Set<string>();
    for (let seed = 0; seed < 25; seed++) {
      const h = new Harness(['A', 'B'], seed);
      h.start();
      expect(h.state.categoryOrder[0]).toBe('captains');
      expect(h.state.categoryOrder.length).toBe(CATEGORIES);
      orders.add(h.state.categoryOrder.join(','));
    }
    // Replayability: different seeds must produce different orders.
    expect(orders.size).toBeGreaterThan(15);
  });
});

describe('bidding rules', () => {
  function openAuction(names = ['A', 'B', 'C']) {
    const h = new Harness(names);
    h.start();
    h.tickUntil((s) => s.phase === 'auction_open');
    return h;
  }

  it('requires at least the starting bid', () => {
    const h = openAuction();
    const start = h.state.auction!.startingBid;
    h.act('BID', 'p0', start - RULES.BID_STEP);
    expect(h.state.auction!.currentBid).toBe(0);
    h.act('BID', 'p0', start);
    expect(h.state.auction!.currentBid).toBe(start);
    expect(h.state.auction!.leaderId).toBe('p0');
  });

  it('enforces the 5M increment and rejects off-grid amounts', () => {
    const h = openAuction();
    const start = h.state.auction!.startingBid;
    h.act('BID', 'p0', start);

    h.act('BID', 'p1', start + 2_000_000); // not a multiple of 5M
    expect(h.state.auction!.leaderId).toBe('p0');

    h.act('BID', 'p1', start + 1_000_000);
    expect(h.state.auction!.leaderId).toBe('p0');

    h.act('BID', 'p1', start + RULES.BID_STEP);
    expect(h.state.auction!.leaderId).toBe('p1');
  });

  it('accepts large custom bids that stay on the 5M grid', () => {
    const h = openAuction();
    const start = h.state.auction!.startingBid;
    h.act('BID', 'p0', start);
    h.act('BID', 'p1', start + 60_000_000);
    expect(h.state.auction!.currentBid).toBe(start + 60_000_000);
  });

  it('never lets a player bid more than they own', () => {
    const h = openAuction();
    h.act('BID', 'p0', RULES.START_MONEY + RULES.BID_STEP);
    expect(h.state.auction!.leaderId).toBeNull();
  });

  it('refuses self-outbidding and bidding after skipping', () => {
    const h = openAuction();
    const start = h.state.auction!.startingBid;
    h.act('BID', 'p0', start);
    h.act('BID', 'p0', start + RULES.BID_STEP);
    expect(h.state.auction!.currentBid).toBe(start);

    h.act('SKIP', 'p1');
    h.act('BID', 'p1', start + RULES.BID_STEP);
    expect(h.state.auction!.leaderId).toBe('p0');
  });

  it('blocks the leader from skipping (bids are binding)', () => {
    const h = openAuction();
    h.act('BID', 'p0', h.state.auction!.startingBid);
    h.act('SKIP', 'p0');
    expect(h.state.auction!.skipped).not.toContain('p0');
  });

  it('serialises simultaneous bids: first arrival wins, second is rejected', () => {
    const h = openAuction();
    const start = h.state.auction!.startingBid;
    h.act('BID', 'p0', start);

    // Both players try the same amount "at the same time".
    h.act('BID', 'p1', start + RULES.BID_STEP);
    h.act('BID', 'p2', start + RULES.BID_STEP);

    expect(h.state.auction!.leaderId).toBe('p1');
    expect(h.state.auction!.currentBid).toBe(start + RULES.BID_STEP);
  });

  it('makes quick-bids race-proof: a stale quick-bid still outbids the new leader', () => {
    const h = openAuction();
    h.act('BID', 'p0', 'quick');
    const afterFirst = h.state.auction!.currentBid;
    h.act('BID', 'p1', 'quick');
    h.act('BID', 'p2', 'quick');
    expect(h.state.auction!.currentBid).toBe(afterFirst + 2 * RULES.BID_STEP);
    expect(h.state.auction!.leaderId).toBe('p2');
  });
});

describe('auction resolution', () => {
  it('runs the countdown and sells to the highest bidder', () => {
    const h = new Harness(['A', 'B', 'C']);
    h.start();
    h.tickUntil((s) => s.phase === 'auction_open');
    const start = h.state.auction!.startingBid;
    const characterId = h.state.auction!.characterId;
    h.act('BID', 'p0', start);

    h.tick(); // soft timer -> countdown
    expect(h.state.phase).toBe('auction_countdown');
    expect(h.state.auction!.countdown).toBe(5);

    h.tickUntil((s) => s.phase === 'auction_sold');
    expect(h.player('p0').roster[h.category]?.characterId).toBe(characterId);
    expect(h.player('p0').money).toBe(RULES.START_MONEY - start);
  });

  it('cancels the countdown when someone bids during it', () => {
    const h = new Harness(['A', 'B']);
    h.start();
    h.tickUntil((s) => s.phase === 'auction_open');
    h.act('BID', 'p0', 'quick');
    h.tick();
    expect(h.state.phase).toBe('auction_countdown');

    h.act('BID', 'p1', 'quick');
    expect(h.state.phase).toBe('auction_open');
    expect(h.state.auction!.countdown).toBeNull();
    expect(h.took('auction:countdownCancelled').length).toBe(1);
  });

  it('sells immediately once everyone but the leader has skipped', () => {
    const h = new Harness(['A', 'B', 'C']);
    h.start();
    h.tickUntil((s) => s.phase === 'auction_open');
    h.act('BID', 'p0', 'quick');
    h.act('SKIP', 'p1');
    h.act('SKIP', 'p2');
    expect(h.state.phase).toBe('auction_sold');
  });

  it('cycles a fully skipped character back into the deck 25% cheaper', () => {
    const h = new Harness(['A', 'B']);
    h.start();
    h.tickUntil((s) => s.phase === 'auction_open');

    const { characterId, startingBid } = h.state.auction!;
    h.act('SKIP', 'p0');
    h.act('SKIP', 'p1');

    expect(h.state.phase).toBe('auction_passed');
    const deck = h.state.decks[h.category];
    const back = deck.find((d) => d.characterId === characterId);
    expect(back).toBeDefined();
    expect(back!.startingBid).toBeLessThan(startingBid);
    expect(back!.startingBid % RULES.BID_STEP).toBe(0);
    expect(back!.timesPassed).toBe(1);
    // Nobody paid anything.
    expect(h.player('p0').money).toBe(RULES.START_MONEY);
  });

  it('never decays below the floor and always stays affordable eventually', () => {
    const h = new Harness(['A', 'B']);
    h.start();
    h.tickUntil((s) => s.phase === 'auction_open');
    const id = h.state.auction!.characterId;

    for (let i = 0; i < 12; i++) {
      if (h.state.phase !== 'auction_open') h.tickUntil((s) => s.phase === 'auction_open' || s.phase === 'last_pick' || s.phase === 'forced_allocation');
      if (h.state.phase !== 'auction_open') break;
      h.act('SKIP', 'p0');
      h.act('SKIP', 'p1');
    }

    const entry = h.state.decks[h.category].find((d) => d.characterId === id);
    if (entry) expect(entry.startingBid).toBeGreaterThanOrEqual(RULES.DECAY_FLOOR);
  });

  it('drops a character nobody bid on when the soft timer expires', () => {
    const h = new Harness(['A', 'B']);
    h.start();
    h.tickUntil((s) => s.phase === 'auction_open');
    h.tick(); // soft timer with no bids at all
    expect(h.state.phase).toBe('auction_passed');
  });

  it('treats a disconnected player as passing so the game keeps moving', () => {
    const h = new Harness(['A', 'B']);
    h.start();
    h.tickUntil((s) => s.phase === 'auction_open');
    h.act('BID', 'p0', 'quick');
    h.dispatch({ type: 'PLAYER_CONNECTION', playerId: 'p1', connected: false, now: h.now });
    expect(h.state.phase).toBe('auction_sold');
  });
});

describe('completion guarantee', () => {
  it('locks players out of a category once their slot is filled', () => {
    const h = new Harness(['A', 'B', 'C']);
    h.start();
    h.tickUntil((s) => s.phase === 'auction_open');
    h.act('BID', 'p0', 'quick');
    h.act('SKIP', 'p1');
    h.act('SKIP', 'p2');
    h.tickUntil((s) => s.phase === 'auction_open');

    const before = h.state.auction!.currentBid;
    h.act('BID', 'p0', 'quick'); // p0 already owns a captain
    expect(h.state.auction!.currentBid).toBe(before);
    expect(h.state.auction!.leaderId).toBeNull();
  });

  it('switches to Last Pick instead of running a solo auction', () => {
    const h = new Harness(['A', 'B']);
    h.start();
    h.tickUntil((s) => s.phase === 'auction_open');
    h.act('BID', 'p0', 'quick');
    h.act('SKIP', 'p1');
    h.tickUntil((s) => s.phase === 'last_pick');

    expect(h.state.lastPick!.playerId).toBe('p1');
    expect(h.state.lastPick!.options.length).toBe(3);
  });

  it('gives the last player their pick for free when they cannot afford it', () => {
    const h = new Harness(['A', 'B']);
    h.start();
    h.tickUntil((s) => s.phase === 'auction_open');

    // Bankrupt p1 completely.
    h.state = { ...h.state, players: h.state.players.map((p) => (p.id === 'p1' ? { ...p, money: 0 } : p)) };

    h.act('BID', 'p0', 'quick');
    h.act('SKIP', 'p1');
    h.tickUntil((s) => s.phase === 'last_pick');

    const choice = h.state.lastPick!.options[0];
    h.dispatch({ type: 'LAST_PICK', playerId: 'p1', characterId: choice.characterId, now: h.now });

    // They own the character, paid nothing, and are not in debt. (The balance
    // is no longer 0 because the end-of-category injection has already landed.)
    expect(h.player('p1').roster[h.state.categoryOrder[0]]?.characterId).toBe(choice.characterId);
    expect(h.player('p1').roster[h.state.categoryOrder[0]]?.pricePaid).toBe(0);
    expect(h.player('p1').money).toBeGreaterThanOrEqual(0);
  });

  it('auto-resolves Last Pick if the player never chooses', () => {
    const h = new Harness(['A', 'B']);
    h.start();
    h.tickUntil((s) => s.phase === 'auction_open');
    h.act('BID', 'p0', 'quick');
    h.act('SKIP', 'p1');
    h.tickUntil((s) => s.phase === 'last_pick');
    h.tick(); // timeout
    expect(h.player('p1').roster[h.state.categoryOrder[0]]).toBeDefined();
  });

  it('falls back to free forced allocation rather than ever deadlocking', () => {
    const h = new Harness(['A', 'B', 'C']);
    h.start();
    h.tickUntil((s) => s.phase === 'auction_open');

    // Everyone is broke and everyone always skips: the worst possible case.
    h.state = { ...h.state, players: h.state.players.map((p) => ({ ...p, money: 0 })) };

    let guard = 0;
    while (h.state.categoryIndex === 0 && h.state.phase !== 'category_end' && guard++ < 500) {
      if (h.state.phase === 'auction_open') {
        for (const p of h.state.players) if (!p.roster[h.category]) h.act('SKIP', p.id);
      } else if (h.state.phase === 'last_pick') {
        h.tick();
      } else {
        h.tick();
      }
    }

    // Everyone got a character without paying a single Berry.
    for (const p of h.state.players) {
      expect(p.roster[h.state.categoryOrder[0]]).toBeDefined();
      expect(p.roster[h.state.categoryOrder[0]]!.pricePaid).toBe(0);
      expect(p.totalSpent).toBe(0);
    }
  });
});

describe('economy', () => {
  it('injects 10-50M per player after a category, on the 5M grid', () => {
    const h = new Harness(['A', 'B']);
    h.start();
    h.tickUntil((s) => s.phase === 'category_end');
    const grants = h.state.lastInjection;
    expect(grants.length).toBe(2);
    for (const g of grants) {
      expect(g.amount).toBeGreaterThanOrEqual(RULES.INJECTION_MIN);
      expect(g.amount).toBeLessThanOrEqual(RULES.INJECTION_MAX);
      expect(g.amount % RULES.BID_STEP).toBe(0);
    }
  });

  it('never lets a balance go negative across a full game', () => {
    const h = new Harness(['A', 'B', 'C', 'D']);
    playFullGame(h);
    for (const p of h.state.players) expect(p.money).toBeGreaterThanOrEqual(0);
  });
});

describe('trading', () => {
  function reachTrading() {
    const h = new Harness(['A', 'B', 'C']);
    h.start();
    drive(h, (s) => s.phase === 'trading');
    expect(h.state.phase).toBe('trading');
    // The bots bid until they are broke; give everyone a known balance so these
    // tests exercise trading rules rather than whatever the auctions left over.
    h.state = { ...h.state, players: h.state.players.map((p) => ({ ...p, money: 500_000_000 })) };
    return h;
  }

  it('opens a market phase after the third category', () => {
    const h = reachTrading();
    expect(h.state.categoryIndex).toBe(2);
    expect(h.state.trading).not.toBeNull();
  });

  it('swaps characters and moves money on accept', () => {
    const h = reachTrading();
    const cat = h.state.categoryOrder[0];
    const a = h.player('p0');
    const b = h.player('p1');
    const aChar = a.roster[cat]!.characterId;
    const bChar = b.roster[cat]!.characterId;
    const aMoney = a.money;
    const bMoney = b.money;

    h.dispatch({
      type: 'TRADE_OFFER',
      playerId: 'p0',
      toId: 'p1',
      giveCharacterId: aChar,
      wantCharacterId: bChar,
      money: 50_000_000,
      now: h.now,
    });
    const offer = h.state.trading!.offers[0];
    h.dispatch({ type: 'TRADE_RESPOND', playerId: 'p1', offerId: offer.id, response: 'accept', now: h.now });

    expect(h.player('p0').roster[cat]!.characterId).toBe(bChar);
    expect(h.player('p1').roster[cat]!.characterId).toBe(aChar);
    expect(h.player('p0').money).toBe(aMoney - 50_000_000);
    expect(h.player('p1').money).toBe(bMoney + 50_000_000);
  });

  it('supports asking for money on top (negative offers)', () => {
    const h = reachTrading();
    const cat = h.state.categoryOrder[0];
    const aChar = h.player('p0').roster[cat]!.characterId;
    const bChar = h.player('p1').roster[cat]!.characterId;
    const bMoney = h.player('p1').money;

    h.dispatch({
      type: 'TRADE_OFFER',
      playerId: 'p0',
      toId: 'p1',
      giveCharacterId: aChar,
      wantCharacterId: bChar,
      money: -30_000_000,
      now: h.now,
    });
    const offer = h.state.trading!.offers[0];
    h.dispatch({ type: 'TRADE_RESPOND', playerId: 'p1', offerId: offer.id, response: 'accept', now: h.now });

    expect(h.player('p0').money).toBeGreaterThan(0);
    expect(h.player('p1').money).toBe(bMoney - 30_000_000);
  });

  it('rejects cross-category trades', () => {
    const h = reachTrading();
    const catA = h.state.categoryOrder[0];
    const catB = h.state.categoryOrder[1];
    h.dispatch({
      type: 'TRADE_OFFER',
      playerId: 'p0',
      toId: 'p1',
      giveCharacterId: h.player('p0').roster[catA]!.characterId,
      wantCharacterId: h.player('p1').roster[catB]!.characterId,
      money: 0,
      now: h.now,
    });
    expect(h.state.trading!.offers.length).toBe(0);
  });

  it('re-validates at accept time and expires unaffordable offers', () => {
    const h = reachTrading();
    const cat = h.state.categoryOrder[0];
    h.dispatch({
      type: 'TRADE_OFFER',
      playerId: 'p0',
      toId: 'p1',
      giveCharacterId: h.player('p0').roster[cat]!.characterId,
      wantCharacterId: h.player('p1').roster[cat]!.characterId,
      money: 100_000_000,
      now: h.now,
    });
    const offer = h.state.trading!.offers[0];

    // p0 goes broke after making the offer.
    h.state = { ...h.state, players: h.state.players.map((p) => (p.id === 'p0' ? { ...p, money: 0 } : p)) };

    h.dispatch({ type: 'TRADE_RESPOND', playerId: 'p1', offerId: offer.id, response: 'accept', now: h.now });
    expect(h.state.trading!.offers[0].status).toBe('expired');
  });

  it('keeps every player at exactly one character per category after a trade', () => {
    const h = reachTrading();
    const cat = h.state.categoryOrder[1];
    h.dispatch({
      type: 'TRADE_OFFER',
      playerId: 'p1',
      toId: 'p2',
      giveCharacterId: h.player('p1').roster[cat]!.characterId,
      wantCharacterId: h.player('p2').roster[cat]!.characterId,
      money: 0,
      now: h.now,
    });
    const offer = h.state.trading!.offers[0];
    h.dispatch({ type: 'TRADE_RESPOND', playerId: 'p2', offerId: offer.id, response: 'accept', now: h.now });

    for (const p of h.state.players) {
      for (let i = 0; i <= 2; i++) expect(p.roster[h.state.categoryOrder[i]]).toBeDefined();
    }
  });
});

describe('full games', () => {
  for (const players of [2, 3, 4, 5, 6]) {
    it(`completes with ${players} players: everyone owns exactly 10 characters`, () => {
      const names = Array.from({ length: players }, (_, i) => `P${i}`);
      const h = new Harness(names, 900 + players);
      playFullGame(h);

      expect(h.state.phase).toBe('game_over');
      expect(h.state.winnerId).toBeTruthy();

      const owned = new Set<string>();
      for (const p of h.state.players) {
        expect(Object.keys(p.roster).length).toBe(CATEGORIES);
        for (const cat of h.state.categoryOrder) {
          const entry = p.roster[cat];
          expect(entry).toBeDefined();
          // No character may exist twice in the whole game.
          expect(owned.has(entry!.characterId)).toBe(false);
          owned.add(entry!.characterId);
        }
        expect(p.money).toBeGreaterThanOrEqual(0);
      }
    });
  }

  it('finishes even when every player skips everything they can', () => {
    const h = new Harness(['A', 'B', 'C'], 4242);
    playFullGame(h, () => 'skip');
    expect(h.state.phase).toBe('game_over');
    for (const p of h.state.players) expect(Object.keys(p.roster).length).toBe(CATEGORIES);
  });

  it('produces different games from different seeds', () => {
    const first = new Harness(['A', 'B'], 1);
    const second = new Harness(['A', 'B'], 2);
    playFullGame(first);
    playFullGame(second);
    const rosterOf = (h: Harness) =>
      h.state.categoryOrder.map((c) => h.player('p0').roster[c]!.characterId).join(',');
    expect(rosterOf(first)).not.toBe(rosterOf(second));
  });

  it('reveals scores column by column and crowns the highest total', () => {
    const h = new Harness(['A', 'B', 'C'], 77);
    playFullGame(h);
    const totals = h.state.reveal!.totals;
    const best = Object.entries(totals).sort((a, b) => b[1] - a[1])[0][0];
    expect(h.state.winnerId).toBe(best);
    expect(h.state.reveal!.finished).toBe(true);
  });
});

describe('anti-cheat redaction', () => {
  it('never exposes hidden scores before the reveal', () => {
    const h = new Harness(['A', 'B']);
    h.start();
    h.tickUntil((s) => s.phase === 'auction_open');
    const view = toClientState(h.state, 'p0', Date.now());
    const serialised = JSON.stringify(view);

    expect(serialised).not.toContain('hiddenScore');
    expect(view.reveal).toBeNull();
    // The deck (i.e. which character comes next) is not in the payload either.
    expect(serialised).not.toContain('"decks"');
  });

  it('exposes scores only for columns already revealed', () => {
    const h = new Harness(['A', 'B'], 5);
    playFullGame(h);
    const view = toClientState(h.state, 'p0', Date.now());
    expect(Object.keys(view.reveal!.scores).length).toBe(2 * CATEGORIES);
  });
});

describe('state hygiene', () => {
  it('bumps the version on every accepted action', () => {
    const state = createGame('AAA111', 'one-piece', 1);
    const first = reduce(state, { type: 'PLAYER_JOIN', playerId: 'p0', name: 'A', avatar: '🏴‍☠️', now: 1 });
    expect(first.state.version).toBeGreaterThan(state.version);
  });

  it('keeps a seat reserved when a player disconnects mid-game', () => {
    const h = new Harness(['A', 'B']);
    h.start();
    h.dispatch({ type: 'PLAYER_LEAVE', playerId: 'p1', now: h.now });
    expect(h.state.players.length).toBe(2);
    expect(h.player('p1').connected).toBe(false);
  });
});
