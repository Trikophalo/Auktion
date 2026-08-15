import type { CharacterPublic, GameEvent } from './types.js';
import type { ClientState, ThemeInfo } from './view.js';

/**
 * Single source of truth for the wire. Both sides import these types, so an
 * incompatible change is a compile error rather than a runtime mystery.
 */

export interface JoinResult {
  ok: boolean;
  error?: string;
  roomCode?: string;
  playerId?: string;
  /** Stored client-side; lets a refresh reclaim the same seat. */
  token?: string;
}

export interface ClientToServer {
  'room:create': (payload: { name: string; avatar: string }, ack: (r: JoinResult) => void) => void;
  'room:join': (payload: { code: string; name: string; avatar: string }, ack: (r: JoinResult) => void) => void;
  'room:rejoin': (payload: { code: string; token: string }, ack: (r: JoinResult) => void) => void;
  'room:leave': () => void;
  'lobby:ready': (payload: { ready: boolean }) => void;
  'game:start': () => void;
  /** Relative "+5M" intent - immune to races by construction. */
  'auction:quickBid': () => void;
  'auction:bid': (payload: { amount: number }) => void;
  'auction:skip': () => void;
  'lastPick:choose': (payload: { characterId: string }) => void;
  'trade:offer': (payload: {
    toId: string;
    giveCharacterId: string;
    wantCharacterId: string;
    money: number;
    counterOf?: string;
  }) => void;
  'trade:respond': (payload: { offerId: string; response: 'accept' | 'reject' | 'cancel' }) => void;
  'trade:ready': () => void;
  'reveal:advance': () => void;
  /** Client noticed a version gap and wants a fresh snapshot. */
  'state:resync': () => void;
}

export interface ServerToClient {
  /** Full authoritative snapshot. Sent on join, rejoin and resync. */
  'room:state': (payload: { state: ClientState; theme: ThemeInfo; catalog: CharacterPublic[] }) => void;
  /** Incremental update: new state version plus the events that produced it. */
  'game:update': (payload: { state: ClientState; events: GameEvent[] }) => void;
  'game:error': (payload: { message: string }) => void;
}

export const SOCKET_PATH = '/socket.io';
