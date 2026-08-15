import {
  type Action,
  type GameEvent,
  type GameState,
  createGame,
  reduce,
} from '@gla/shared/server';

/** A deterministic test harness that also executes the engine's timer requests. */
export class Harness {
  state: GameState;
  events: GameEvent[] = [];
  now = 1_000_000;
  private pendingMs: number | null = null;

  constructor(playerNames: string[], seed = 12345, themeId = 'one-piece') {
    this.state = createGame('TEST01', themeId, seed);
    playerNames.forEach((name, i) =>
      this.dispatch({ type: 'PLAYER_JOIN', playerId: `p${i}`, name, avatar: '🏴‍☠️', now: this.now }),
    );
  }

  dispatch(action: Action): void {
    const result = reduce(this.state, action);
    this.state = result.state;
    this.events.push(...result.events);
    if (result.timer === 'clear') this.pendingMs = null;
    else if (result.timer) this.pendingMs = result.timer.ms;
  }

  act(type: 'BID' | 'SKIP', playerId: string, amount: number | 'quick' = 'quick'): void {
    if (type === 'BID') this.dispatch({ type: 'BID', playerId, amount, now: this.now });
    else this.dispatch({ type: 'SKIP', playerId, now: this.now });
  }

  /** Fires the currently scheduled timer, advancing the virtual clock. */
  tick(): void {
    const ms = this.pendingMs ?? 0;
    this.now += ms;
    this.pendingMs = null;
    this.dispatch({ type: 'TICK', now: this.now });
  }

  /** Runs timers until the predicate holds (or the budget is exhausted). */
  tickUntil(predicate: (s: GameState) => boolean, budget = 4000): void {
    let guard = 0;
    while (!predicate(this.state) && guard++ < budget) this.tick();
    if (guard >= budget) throw new Error(`tickUntil exhausted in phase ${this.state.phase}`);
  }

  start(): void {
    this.dispatch({ type: 'START_GAME', playerId: 'p0', now: this.now });
  }

  player(id: string) {
    return this.state.players.find((p) => p.id === id)!;
  }

  get category(): string {
    return this.state.categoryOrder[this.state.categoryIndex];
  }

  took(type: GameEvent['type']): GameEvent[] {
    return this.events.filter((e) => e.type === type);
  }

  clearEvents(): void {
    this.events = [];
  }
}

/**
 * Drives the game with simple bot behaviour until `done` holds.
 * Bots only bid what they can actually afford, otherwise they skip - so the
 * loop always makes progress.
 */
export function drive(
  harness: Harness,
  done: (s: GameState) => boolean,
  strategy: (state: GameState, playerId: string) => 'bid' | 'skip' = () => 'bid',
): void {
  let guard = 0;

  while (!done(harness.state) && guard++ < 20_000) {
    const s = harness.state;

    if (s.phase === 'auction_open') {
      const cat = s.categoryOrder[s.categoryIndex];
      const auction = s.auction!;
      const actor = s.players.find(
        (p) =>
          !p.roster[cat] &&
          !auction.skipped.includes(p.id) &&
          auction.leaderId !== p.id &&
          p.money >= (auction.currentBid === 0 ? auction.startingBid : auction.currentBid + 5_000_000),
      );
      if (actor && strategy(s, actor.id) === 'bid') {
        harness.act('BID', actor.id);
        continue;
      }
      const skipper = s.players.find(
        (p) => !p.roster[cat] && !auction.skipped.includes(p.id) && auction.leaderId !== p.id,
      );
      if (skipper) {
        harness.act('SKIP', skipper.id);
        continue;
      }
    }

    harness.tick();
  }

  if (!done(harness.state)) {
    throw new Error(`drive() made no progress; stuck in ${harness.state.phase}`);
  }
}

/** Drives a whole game to completion. */
export function playFullGame(
  harness: Harness,
  strategy: (state: GameState, playerId: string) => 'bid' | 'skip' = () => 'bid',
): void {
  harness.start();
  drive(harness, (s) => s.phase === 'game_over', strategy);
}
