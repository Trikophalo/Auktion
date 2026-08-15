import type { Server } from 'socket.io';
import {
  type Action,
  type GameEvent,
  type GameState,
  catalog,
  createGame,
  reduce,
  themeInfo,
  toClientState,
} from '@gla/shared/server';

/**
 * One room = one authoritative game.
 *
 * Every mutation - player intents and timer expiry alike - goes through the
 * same `dispatch` queue on Node's single thread, which is what makes racing
 * bids impossible: they are simply serialised in arrival order.
 */
export class GameRoom {
  state: GameState;
  /** playerId -> seat token (a refresh reclaims the same seat). */
  private tokens = new Map<string, string>();
  private timer: NodeJS.Timeout | null = null;
  private processing = false;
  private queue: Action[] = [];
  lastActivity = Date.now();

  constructor(
    public readonly code: string,
    private readonly io: Server,
    themeId = 'one-piece',
  ) {
    this.state = createGame(code, themeId);
  }

  // --------------------------------------------------------------- identity

  issueToken(playerId: string): string {
    const token = `${playerId}.${Math.random().toString(36).slice(2, 12)}`;
    this.tokens.set(playerId, token);
    return token;
  }

  playerForToken(token: string): string | undefined {
    for (const [playerId, t] of this.tokens) if (t === token) return playerId;
    return undefined;
  }

  get isEmpty(): boolean {
    return this.state.players.length === 0 || this.state.players.every((p) => !p.connected);
  }

  // --------------------------------------------------------------- dispatch

  dispatch(action: Action): void {
    this.queue.push(action);
    if (this.processing) return;

    this.processing = true;
    try {
      while (this.queue.length) {
        const next = this.queue.shift()!;
        const result = reduce(this.state, next);
        this.state = result.state;
        this.applyTimer(result.timer);
        this.broadcast(result.events);
      }
    } finally {
      this.processing = false;
      this.lastActivity = Date.now();
    }
  }

  /**
   * The engine requests timers as data (`{ms}` / 'clear'); executing them here
   * keeps the rules pure and makes the whole game replayable in tests.
   */
  private applyTimer(timer: { ms: number } | 'clear' | null): void {
    if (timer === null) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (timer === 'clear') return;

    this.timer = setTimeout(() => {
      this.timer = null;
      this.dispatch({ type: 'TICK', now: Date.now() });
    }, Math.max(0, timer.ms));
  }

  // -------------------------------------------------------------- broadcast

  /** Each player receives their own redacted view; errors are private. */
  broadcast(events: GameEvent[] = []): void {
    const now = Date.now();
    const shared = events.filter((e) => e.type !== 'error');

    for (const player of this.state.players) {
      const socketId = this.socketOf(player.id);
      if (!socketId) continue;
      const personal = events.filter((e) => e.type === 'error' && e.playerId === player.id);
      this.io.to(socketId).emit('game:update', {
        state: toClientState(this.state, player.id, now),
        events: [...shared, ...personal],
      });
    }
  }

  sendSnapshot(socketId: string, playerId: string): void {
    this.io.to(socketId).emit('room:state', {
      state: toClientState(this.state, playerId, Date.now()),
      theme: themeInfo(this.state.themeId),
      catalog: catalog(this.state.themeId),
    });
  }

  private sockets = new Map<string, string>(); // playerId -> socketId

  bindSocket(playerId: string, socketId: string): void {
    this.sockets.set(playerId, socketId);
  }

  unbindSocket(playerId: string): void {
    this.sockets.delete(playerId);
  }

  socketOf(playerId: string): string | undefined {
    return this.sockets.get(playerId);
  }

  dispose(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
