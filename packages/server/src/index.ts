import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { RULES, getTheme, validateTheme } from '@gla/shared/server';
import { RoomManager } from './roomManager.js';

const PORT = Number(process.env.PORT ?? 3000);
const ROOT = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const CLIENT_DIST = join(ROOT, 'packages/client/dist');

// Fail loudly at boot if the theme data is malformed - never mid-game.
validateTheme(getTheme('one-piece'));

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.ico': 'image/x-icon',
};

const httpServer = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

  if (url.pathname === '/healthz') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, rooms: rooms.count }));
    return;
  }

  // Static client (production build). In dev, Vite serves the client itself.
  const requested = normalize(url.pathname).replace(/^(\.\.[/\\])+/, '');
  let filePath = join(CLIENT_DIST, requested === '/' ? 'index.html' : requested);

  try {
    const info = await stat(filePath).catch(() => null);
    if (!info?.isFile()) filePath = join(CLIENT_DIST, 'index.html'); // SPA fallback
    const body = await readFile(filePath);
    res.writeHead(200, { 'content-type': MIME[extname(filePath)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Client build not found. Run: npm run build');
  }
});

const io = new Server(httpServer, {
  cors: { origin: true, credentials: true },
  pingTimeout: 20_000,
});

const rooms = new RoomManager(io);

/** Cheap per-socket rate limiting so a stuck key cannot flood a room. */
function rateLimited(socket: { data: Record<string, unknown> }): boolean {
  const now = Date.now();
  const window = (socket.data.rate as number[]) ?? [];
  const recent = window.filter((t) => now - t < 1000);
  recent.push(now);
  socket.data.rate = recent;
  return recent.length > 12;
}

io.on('connection', (socket) => {
  const ctx = socket.data as { roomCode?: string; playerId?: string; rate?: number[] };

  const room = () => (ctx.roomCode ? rooms.get(ctx.roomCode) : undefined);
  const withPlayer = (fn: (r: NonNullable<ReturnType<typeof room>>, playerId: string) => void) => {
    const r = room();
    if (r && ctx.playerId) fn(r, ctx.playerId);
  };

  const attach = (r: ReturnType<RoomManager['create']>, playerId: string) => {
    ctx.roomCode = r.code;
    ctx.playerId = playerId;
    r.bindSocket(playerId, socket.id);
    socket.join(r.code);
  };

  socket.on('room:create', ({ name, avatar }, ack) => {
    const r = rooms.create();
    const playerId = `p_${Math.random().toString(36).slice(2, 10)}`;
    r.dispatch({ type: 'PLAYER_JOIN', playerId, name: sanitize(name), avatar, now: Date.now() });
    attach(r, playerId);
    const token = r.issueToken(playerId);
    ack({ ok: true, roomCode: r.code, playerId, token });
    r.sendSnapshot(socket.id, playerId);
    r.broadcast();
  });

  socket.on('room:join', ({ code, name, avatar }, ack) => {
    const r = rooms.get(code);
    if (!r) return ack({ ok: false, error: 'Diesen Raum gibt es nicht.' });
    if (r.state.phase !== 'lobby') return ack({ ok: false, error: 'Das Spiel läuft bereits.' });
    if (r.state.players.length >= RULES.MAX_PLAYERS) return ack({ ok: false, error: 'Der Raum ist voll.' });

    const playerId = `p_${Math.random().toString(36).slice(2, 10)}`;
    r.dispatch({ type: 'PLAYER_JOIN', playerId, name: sanitize(name), avatar, now: Date.now() });
    attach(r, playerId);
    const token = r.issueToken(playerId);
    ack({ ok: true, roomCode: r.code, playerId, token });
    r.sendSnapshot(socket.id, playerId);
    r.broadcast();
  });

  socket.on('room:rejoin', ({ code, token }, ack) => {
    const r = rooms.get(code);
    if (!r) return ack({ ok: false, error: 'Diesen Raum gibt es nicht mehr.' });
    const playerId = r.playerForToken(token);
    if (!playerId || !r.state.players.some((p) => p.id === playerId)) {
      return ack({ ok: false, error: 'Dein Platz ist nicht mehr reserviert.' });
    }
    attach(r, playerId);
    r.dispatch({ type: 'PLAYER_CONNECTION', playerId, connected: true, now: Date.now() });
    ack({ ok: true, roomCode: r.code, playerId, token });
    r.sendSnapshot(socket.id, playerId);
    r.broadcast();
  });

  socket.on('state:resync', () => withPlayer((r, playerId) => r.sendSnapshot(socket.id, playerId)));

  socket.on('lobby:ready', ({ ready }) =>
    withPlayer((r, playerId) => r.dispatch({ type: 'SET_READY', playerId, ready, now: Date.now() })),
  );

  socket.on('game:start', () =>
    withPlayer((r, playerId) => r.dispatch({ type: 'START_GAME', playerId, now: Date.now() })),
  );

  socket.on('auction:quickBid', () => {
    if (rateLimited(socket)) return;
    withPlayer((r, playerId) => r.dispatch({ type: 'BID', playerId, amount: 'quick', now: Date.now() }));
  });

  socket.on('auction:bid', ({ amount }) => {
    if (rateLimited(socket)) return;
    withPlayer((r, playerId) => r.dispatch({ type: 'BID', playerId, amount: Number(amount), now: Date.now() }));
  });

  socket.on('auction:skip', () =>
    withPlayer((r, playerId) => r.dispatch({ type: 'SKIP', playerId, now: Date.now() })),
  );

  socket.on('auction:skipTime', () =>
    withPlayer((r, playerId) => r.dispatch({ type: 'SKIP_TIME', playerId, now: Date.now() })),
  );

  socket.on('lobby:settings', (settings) =>
    withPlayer((r, playerId) => r.dispatch({ type: 'UPDATE_SETTINGS', playerId, settings, now: Date.now() })),
  );

  socket.on('chat:send', ({ text }) => {
    if (rateLimited(socket)) return;
    withPlayer((r, playerId) => r.dispatch({ type: 'CHAT', playerId, text: String(text ?? ''), now: Date.now() }));
  });

  socket.on('trade:offer', (payload) =>
    withPlayer((r, playerId) =>
      r.dispatch({
        type: 'TRADE_OFFER',
        playerId,
        toId: payload.toId,
        giveCharacterId: payload.giveCharacterId,
        wantCharacterId: payload.wantCharacterId,
        money: Number(payload.money) || 0,
        counterOf: payload.counterOf,
        now: Date.now(),
      }),
    ),
  );

  socket.on('trade:respond', ({ offerId, response }) =>
    withPlayer((r, playerId) => r.dispatch({ type: 'TRADE_RESPOND', playerId, offerId, response, now: Date.now() })),
  );

  socket.on('trade:ready', () =>
    withPlayer((r, playerId) => r.dispatch({ type: 'TRADE_READY', playerId, now: Date.now() })),
  );

  socket.on('reveal:advance', () =>
    withPlayer((r, playerId) => r.dispatch({ type: 'REVEAL_ADVANCE', playerId, now: Date.now() })),
  );

  socket.on('room:leave', () => {
    withPlayer((r, playerId) => {
      r.unbindSocket(playerId);
      r.dispatch({ type: 'PLAYER_LEAVE', playerId, now: Date.now() });
      r.broadcast();
    });
    ctx.roomCode = undefined;
    ctx.playerId = undefined;
  });

  socket.on('disconnect', () => {
    withPlayer((r, playerId) => {
      // Only drop the binding if this socket is still the active one.
      if (r.socketOf(playerId) !== socket.id) return;
      r.unbindSocket(playerId);
      if (r.state.phase === 'lobby') {
        r.dispatch({ type: 'PLAYER_LEAVE', playerId, now: Date.now() });
      } else {
        r.dispatch({ type: 'PLAYER_CONNECTION', playerId, connected: false, now: Date.now() });
      }
      r.broadcast();
    });
  });
});

function sanitize(name: string): string {
  const clean = String(name ?? '').replace(/[<>]/g, '').trim().slice(0, 16);
  return clean || 'Pirat';
}

httpServer.listen(PORT, () => {
  console.log(`⚓ Grand Line Auction server listening on http://localhost:${PORT}`);
});
