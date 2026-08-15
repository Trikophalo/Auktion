/**
 * Headless balance harness.
 *
 * Runs thousands of games through the real engine with economically-motivated
 * bots and reports the numbers that matter for tuning: what characters actually
 * sell for, how often the safety nets fire, how much money is left on the table,
 * and whether being aggressive or patient wins more often.
 *
 *   npm run simulate -- [games] [players]
 */
import {
  type GameState,
  RULES,
  createGame,
  computeTotals,
  reduce,
  getTheme,
} from '@gla/shared/server';

const GAMES = Number(process.argv[2] ?? 400);
const PLAYERS = Number(process.argv[3] ?? 4);

/** How much of its per-category budget a bot is willing to commit. */
const STRATEGIES = {
  aggressive: 1.9,
  balanced: 1.25,
  patient: 0.85,
  bargain: 0.55,
} as const;

type StrategyName = keyof typeof STRATEGIES;
const NAMES = Object.keys(STRATEGIES) as StrategyName[];

interface Stats {
  prices: number[];
  viaAuction: number;
  viaLastPick: number;
  viaForced: number;
  leftover: number[];
  totals: number[];
  wins: Record<StrategyName, number>;
  played: Record<StrategyName, number>;
  passes: number;
  auctions: number;
  bankruptAtEnd: number;
  scoreSpread: number[];
}

function emptyStats(): Stats {
  return {
    prices: [],
    viaAuction: 0,
    viaLastPick: 0,
    viaForced: 0,
    leftover: [],
    totals: [],
    wins: { aggressive: 0, balanced: 0, patient: 0, bargain: 0 },
    played: { aggressive: 0, balanced: 0, patient: 0, bargain: 0 },
    passes: 0,
    auctions: 0,
    bankruptAtEnd: 0,
    scoreSpread: [],
  };
}

/**
 * A bot's ceiling for the current character: it spreads what it has over the
 * categories it still needs, scaled by its aggression, and never bids past
 * what it owns.
 */
function willingness(state: GameState, playerId: string, aggression: number): number {
  const player = state.players.find((p) => p.id === playerId)!;
  const remaining = state.categoryOrder.filter((c) => !player.roster[c]).length || 1;
  const perCategory = player.money / remaining;
  return Math.min(player.money, perCategory * aggression);
}

function runGame(seed: number, playerCount: number, stats: Stats): void {
  let state = createGame('SIM', 'one-piece', seed);
  const strategyOf: Record<string, StrategyName> = {};

  for (let i = 0; i < playerCount; i++) {
    const strategy = NAMES[i % NAMES.length];
    strategyOf[`p${i}`] = strategy;
    stats.played[strategy]++;
    state = reduce(state, { type: 'PLAYER_JOIN', playerId: `p${i}`, name: strategy, avatar: '🏴‍☠️', now: 0 }).state;
  }

  let now = 0;
  let pendingTimer: number | null = null;
  const dispatch = (action: Parameters<typeof reduce>[1]) => {
    const result = reduce(state, action);
    state = result.state;
    if (result.timer === 'clear') pendingTimer = null;
    else if (result.timer) pendingTimer = result.timer.ms;
  };

  dispatch({ type: 'START_GAME', playerId: 'p0', now });

  let guard = 0;
  while (state.phase !== 'game_over' && guard++ < 60_000) {
    const phase = state.phase;

    if (phase === 'auction_open' || phase === 'auction_countdown') {
      const auction = state.auction!;
      const category = state.categoryOrder[state.categoryIndex];
      const min = auction.currentBid === 0 ? auction.startingBid : auction.currentBid + RULES.BID_STEP;

      const actor = state.players.find(
        (p) => !p.roster[category] && !auction.skipped.includes(p.id) && auction.leaderId !== p.id,
      );

      if (actor) {
        const cap = willingness(state, actor.id, STRATEGIES[strategyOf[actor.id]]);
        if (min <= cap && min <= actor.money) dispatch({ type: 'BID', playerId: actor.id, amount: 'quick', now });
        else dispatch({ type: 'SKIP', playerId: actor.id, now });
        continue;
      }
    }

    if (phase === 'last_pick') {
      const options = state.lastPick!.options;
      // Take the cheapest available option.
      const choice = [...options].sort((a, b) => a.startingBid - b.startingBid)[0];
      dispatch({ type: 'LAST_PICK', playerId: state.lastPick!.playerId, characterId: choice.characterId, now });
      continue;
    }

    if (phase === 'trading') {
      for (const p of state.players) dispatch({ type: 'TRADE_READY', playerId: p.id, now });
      continue;
    }

    // Nothing to decide: fire the scheduled timer.
    now += pendingTimer ?? 1000;
    if (phase === 'auction_passed') stats.passes++;
    dispatch({ type: 'TICK', now });
  }

  if (state.phase !== 'game_over') throw new Error(`game ${seed} did not finish (${state.phase})`);

  // ---- collect ----------------------------------------------------------
  const totals = computeTotals(state);
  const best = state.players.reduce((a, b) => (totals[b.id] > totals[a.id] ? b : a));
  stats.wins[strategyOf[best.id]]++;

  const scores: number[] = [];
  for (const p of state.players) {
    stats.leftover.push(p.money);
    stats.totals.push(totals[p.id]);
    scores.push(totals[p.id]);
    if (p.money === 0) stats.bankruptAtEnd++;
    for (const cat of state.categoryOrder) {
      const owned = p.roster[cat]!;
      if (owned.via === 'auction') {
        stats.viaAuction++;
        stats.prices.push(owned.pricePaid);
        stats.auctions++;
      } else if (owned.via === 'last_pick') stats.viaLastPick++;
      else if (owned.via === 'forced') stats.viaForced++;
    }
  }
  stats.scoreSpread.push(Math.max(...scores) - Math.min(...scores));
}

// ---------------------------------------------------------------- reporting

const pct = (n: number, total: number) => `${((n / total) * 100).toFixed(1)}%`;
const mio = (n: number) => `${Math.round(n / 1_000_000)} Mio.`;

function quantile(values: number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length * q)] ?? 0;
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / (values.length || 1);
}

function main() {
  const theme = getTheme('one-piece');
  console.log(`\n⚓ Grand Line Auction - Balance-Simulation`);
  console.log(`   ${GAMES} Spiele × ${PLAYERS} Spieler · ${theme.characters.length} Charaktere in ${theme.categories.length} Kategorien\n`);

  const stats = emptyStats();
  const started = Date.now();
  for (let i = 0; i < GAMES; i++) runGame(i * 7919 + 13, PLAYERS, stats);
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  const picks = stats.viaAuction + stats.viaLastPick + stats.viaForced;

  console.log('── Auktionspreise ─────────────────────────────');
  console.log(`   Durchschnitt      ${mio(mean(stats.prices))}`);
  console.log(`   Median            ${mio(quantile(stats.prices, 0.5))}`);
  console.log(`   10% / 90% Quantil ${mio(quantile(stats.prices, 0.1))} / ${mio(quantile(stats.prices, 0.9))}`);
  console.log(`   Teuerster Zuschlag ${mio(Math.max(...stats.prices))}`);

  console.log('\n── Wie Charaktere erworben wurden ─────────────');
  console.log(`   Auktion           ${pct(stats.viaAuction, picks)}`);
  console.log(`   Letzte Wahl       ${pct(stats.viaLastPick, picks)}`);
  console.log(`   Zwangszuteilung   ${pct(stats.viaForced, picks)}   ← sollte ~0% sein`);
  console.log(`   Durchgereichte Charaktere: ${(stats.passes / GAMES).toFixed(1)} pro Spiel`);

  console.log('\n── Ökonomie am Spielende ──────────────────────');
  console.log(`   Restgeld Median   ${mio(quantile(stats.leftover, 0.5))}`);
  console.log(`   Restgeld 90%      ${mio(quantile(stats.leftover, 0.9))}`);
  console.log(`   Spieler mit 0 Berry am Ende: ${pct(stats.bankruptAtEnd, GAMES * PLAYERS)}`);

  console.log('\n── Punkte ─────────────────────────────────────');
  console.log(`   Durchschnitt      ${Math.round(mean(stats.totals))}`);
  console.log(`   Bester / schlechtester Wert  ${Math.max(...stats.totals)} / ${Math.min(...stats.totals)}`);
  console.log(`   Abstand Sieger↔Letzter (Median)  ${Math.round(quantile(stats.scoreSpread, 0.5))} Punkte`);

  console.log('\n── Siegquote nach Strategie ───────────────────');
  for (const name of NAMES) {
    if (!stats.played[name]) continue;
    const games = stats.played[name] / 1; // one seat per game per strategy slot
    console.log(`   ${name.padEnd(11)} ${pct(stats.wins[name], GAMES).padStart(6)}  (${stats.wins[name]} Siege)`);
    void games;
  }

  console.log(`\n   ${GAMES} Spiele in ${elapsed}s simuliert.\n`);
}

main();
