import { io, type Socket } from 'socket.io-client';
import type { CharacterPublic, ClientState, GameEvent, GameSettings, JoinResult, ThemeInfo } from '@gla/shared';
import { useGame } from '../store/game';

let socket: Socket | null = null;

const SEAT_KEY = 'gla.seat';

interface Seat {
  code: string;
  token: string;
}

function saveSeat(seat: Seat) {
  localStorage.setItem(SEAT_KEY, JSON.stringify(seat));
}

export function loadSeat(): Seat | null {
  try {
    const raw = localStorage.getItem(SEAT_KEY);
    return raw ? (JSON.parse(raw) as Seat) : null;
  } catch {
    return null;
  }
}

export function clearSeat() {
  localStorage.removeItem(SEAT_KEY);
}

export function connect(): Socket {
  if (socket) return socket;

  socket = io({ path: '/socket.io', transports: ['websocket', 'polling'] });

  socket.on('room:state', (payload: { state: ClientState; theme: ThemeInfo; catalog: CharacterPublic[] }) => {
    useGame.getState().applySnapshot(payload.state, payload.theme, payload.catalog);
  });

  socket.on('game:update', (payload: { state: ClientState; events: GameEvent[] }) => {
    useGame.getState().applyUpdate(payload.state, payload.events);
  });

  socket.on('game:error', ({ message }: { message: string }) => {
    useGame.getState().pushToast({ kind: 'error', text: message });
  });

  socket.on('connect', () => {
    useGame.getState().setConnected(true);
    // Reclaim our seat after a refresh or a dropped connection.
    const seat = loadSeat();
    if (seat) {
      socket!.emit('room:rejoin', seat, (res: JoinResult) => {
        if (!res.ok) clearSeat();
      });
    }
  });

  socket.on('disconnect', () => useGame.getState().setConnected(false));

  return socket;
}

function sock(): Socket {
  return socket ?? connect();
}

export const net = {
  createRoom(name: string, avatar: string): Promise<JoinResult> {
    return new Promise((resolve) => {
      sock().emit('room:create', { name, avatar }, (res: JoinResult) => {
        if (res.ok && res.token && res.roomCode) saveSeat({ code: res.roomCode, token: res.token });
        resolve(res);
      });
    });
  },

  joinRoom(code: string, name: string, avatar: string): Promise<JoinResult> {
    return new Promise((resolve) => {
      sock().emit('room:join', { code: code.toUpperCase(), name, avatar }, (res: JoinResult) => {
        if (res.ok && res.token && res.roomCode) saveSeat({ code: res.roomCode, token: res.token });
        resolve(res);
      });
    });
  },

  leave() {
    sock().emit('room:leave');
    clearSeat();
  },

  ready: (ready: boolean) => sock().emit('lobby:ready', { ready }),
  settings: (settings: Partial<GameSettings>) => sock().emit('lobby:settings', settings),
  start: () => sock().emit('game:start'),
  quickBid: () => sock().emit('auction:quickBid'),
  bid: (amount: number) => sock().emit('auction:bid', { amount }),
  skip: () => sock().emit('auction:skip'),
  skipTime: () => sock().emit('auction:skipTime'),
  chat: (text: string) => sock().emit('chat:send', { text }),
  tradeOffer: (payload: {
    toId: string;
    giveCharacterId: string;
    wantCharacterId: string;
    money: number;
    counterOf?: string;
  }) => sock().emit('trade:offer', payload),
  tradeRespond: (offerId: string, response: 'accept' | 'reject' | 'cancel') =>
    sock().emit('trade:respond', { offerId, response }),
  tradeReady: () => sock().emit('trade:ready'),
  revealAdvance: () => sock().emit('reveal:advance'),
  resync: () => sock().emit('state:resync'),
};
