/**
 * End-to-end smoke test: starts nothing, but drives a real server over real
 * websockets with three clients and plays a whole game to the winner.
 *
 *   npm start &   (or npm run dev:server)
 *   npx tsx tools/smoke.ts
 */
import { io, type Socket } from 'socket.io-client';
import type { ClientState, GameEvent } from '@gla/shared';

const URL = process.env.SMOKE_URL ?? 'http://localhost:3000';
const PLAYERS = Number(process.env.SMOKE_PLAYERS ?? 3);

interface Client {
  socket: Socket;
  name: string;
  id: string;
  state: ClientState | null;
}

const clients: Client[] = [];
let leaked = false;

function connectClient(name: string): Promise<Client> {
  return new Promise((resolve) => {
    const socket = io(URL, { transports: ['websocket'] });
    const client: Client = { socket, name, id: '', state: null };

    socket.on('room:state', (p: { state: ClientState }) => {
      client.state = p.state;
    });
    socket.on('game:update', (p: { state: ClientState; events: GameEvent[] }) => {
      client.state = p.state;
      // Any score reaching a client before the reveal would be a leak.
      const raw = JSON.stringify(p);
      if (raw.includes('hiddenScore')) leaked = true;
      for (const e of p.events) if (e.type === 'error') console.log(`   ⚠️  ${name}: ${e.message}`);
    });

    socket.on('connect', () => resolve(client));
  });
}

function emit<T>(socket: Socket, event: string, payload: unknown): Promise<T> {
  return new Promise((resolve) => socket.emit(event, payload, resolve));
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log(`⚓ Smoke test against ${URL} with ${PLAYERS} players\n`);

  const host = await connectClient('Ruffy');
  const created = await emit<{ ok: boolean; roomCode: string; playerId: string; error?: string }>(
    host.socket,
    'room:create',
    { name: 'Ruffy', avatar: '🐒' },
  );
  if (!created.ok) throw new Error(`create failed: ${created.error}`);
  host.id = created.playerId;
  clients.push(host);
  console.log(`✓ Room ${created.roomCode} created`);

  const names = ['Zorro', 'Nami', 'Sanji', 'Chopper', 'Robin'];
  for (let i = 0; i < PLAYERS - 1; i++) {
    const c = await connectClient(names[i]);
    const res = await emit<{ ok: boolean; playerId: string; error?: string }>(c.socket, 'room:join', {
      code: created.roomCode,
      name: names[i],
      avatar: '🏴‍☠️',
    });
    if (!res.ok) throw new Error(`join failed: ${res.error}`);
    c.id = res.playerId;
    clients.push(c);
  }
  console.log(`✓ ${clients.length} players joined`);

  host.socket.emit('game:start');
  await wait(300);
  console.log('✓ Game started\n');

  const seenPhases = new Set<string>();
  let lastCategory = -1;
  const deadline = Date.now() + 15 * 60 * 1000;

  while (Date.now() < deadline) {
    const state = host.state;
    if (!state) {
      await wait(100);
      continue;
    }

    if (!seenPhases.has(state.phase)) {
      seenPhases.add(state.phase);
      console.log(`   phase: ${state.phase}`);
    }
    if (state.categoryIndex !== lastCategory) {
      lastCategory = state.categoryIndex;
      console.log(`\n📦 Kategorie ${state.categoryIndex + 1}/10 (${state.categoryOrder[state.categoryIndex]})`);
    }

    if (state.phase === 'game_over') break;

    // --- act on behalf of every client -----------------------------------
    if (state.phase === 'auction_open' || state.phase === 'auction_countdown') {
      const auction = state.auction!;
      const cat = state.categoryOrder[state.categoryIndex];
      const min = auction.currentBid === 0 ? auction.startingBid : auction.currentBid + 5_000_000;

      for (const client of clients) {
        const me = state.players.find((p) => p.id === client.id)!;
        if (me.roster[cat] || auction.skipped.includes(me.id) || auction.leaderId === me.id) continue;
        // Bid roughly 60% of the time when affordable, otherwise pass.
        if (me.money >= min && Math.random() < 0.6) client.socket.emit('auction:quickBid');
        else client.socket.emit('auction:skip');
        await wait(40);
        break; // one action per loop keeps the auction readable
      }
    }

    if (state.phase === 'last_pick' && state.lastPick) {
      const picker = clients.find((c) => c.id === state.lastPick!.playerId);
      picker?.socket.emit('lastPick:choose', { characterId: state.lastPick.options[0].characterId });
      await wait(120);
    }

    if (state.phase === 'trading') {
      for (const client of clients) client.socket.emit('trade:ready');
      await wait(200);
    }

    if (state.phase === 'final_reveal') {
      host.socket.emit('reveal:advance');
      await wait(160);
    }

    await wait(70);
  }

  const final = host.state!;
  console.log('\n────────────── ERGEBNIS ──────────────');
  if (final.phase !== 'game_over') throw new Error(`game did not finish (phase: ${final.phase})`);

  const ranked = [...final.players].sort((a, b) => (final.reveal!.totals[b.id] ?? 0) - (final.reveal!.totals[a.id] ?? 0));
  for (const [i, p] of ranked.entries()) {
    const owned = final.categoryOrder.filter((c) => p.roster[c]).length;
    console.log(
      `${i + 1}. ${p.name.padEnd(8)} ${String(final.reveal!.totals[p.id]).padStart(4)} Punkte  ` +
        `| ${owned}/10 Charaktere | ${Math.round(p.money / 1_000_000)} Mio. übrig`,
    );
    if (owned !== 10) throw new Error(`${p.name} has ${owned} characters, expected 10`);
    if (p.money < 0) throw new Error(`${p.name} has a negative balance`);
  }

  if (leaked) throw new Error('hidden scores leaked to a client before the reveal!');
  console.log(`\n🏆 Gewinner: ${final.players.find((p) => p.id === final.winnerId)!.name}`);
  console.log('✓ No score leaked before the reveal');
  console.log('✓ Smoke test passed');

  for (const c of clients) c.socket.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('\n✗ Smoke test failed:', err.message);
  for (const c of clients) c.socket.close();
  process.exit(1);
});
