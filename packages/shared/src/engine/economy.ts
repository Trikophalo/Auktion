import type { Award, GameState } from '../types.js';
import { RULES } from '../constants.js';
import { nextInt } from '../rng.js';
import { characterOf } from './helpers.js';

/**
 * Cash injection after every category.
 *
 * This is the anti-elimination valve: a player who overspent early is poorer
 * than everyone else, but never permanently locked out of bidding. The host
 * picks the ceiling and whether it is rolled per player or paid flat.
 */
export function applyInjection(state: GameState): {
  state: GameState;
  grants: { playerId: string; amount: number }[];
} {
  const { injectionMax, injectionMode } = state.settings;
  const max = Math.max(RULES.INJECTION_MIN, injectionMax);
  let rng = state.rng;
  const grants: { playerId: string; amount: number }[] = [];

  const players = state.players.map((p) => {
    let amount = max;
    if (injectionMode === 'random') {
      const steps = Math.max(0, (max - RULES.INJECTION_MIN) / RULES.BID_STEP);
      const [step, next] = nextInt(rng, 0, steps);
      rng = next;
      amount = RULES.INJECTION_MIN + step * RULES.BID_STEP;
    }
    grants.push({ playerId: p.id, amount });
    return { ...p, money: p.money + amount };
  });

  return { state: { ...state, players, rng, lastInjection: grants }, grants };
}

/** Final totals: the sum of every hidden score on a player's board. */
export function computeTotals(state: GameState): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const p of state.players) {
    totals[p.id] = state.categoryOrder.reduce((sum, cat) => {
      const owned = p.roster[cat];
      return owned ? sum + characterOf(state, owned.characterId).hiddenScore : sum;
    }, 0);
  }
  return totals;
}

/** Totals counting only the first N revealed columns - drives the live reveal. */
export function partialTotals(state: GameState, columns: number): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const p of state.players) {
    let sum = 0;
    for (let i = 0; i < columns && i < state.categoryOrder.length; i++) {
      const owned = p.roster[state.categoryOrder[i]];
      if (owned) sum += characterOf(state, owned.characterId).hiddenScore;
    }
    totals[p.id] = sum;
  }
  return totals;
}

/**
 * End-of-game awards. These exist because the funniest part of the game is
 * usually not who won, but who paid 300M for Spandam.
 */
export function computeAwards(state: GameState): Award[] {
  const awards: Award[] = [];
  const nameOf = (id: string) => state.players.find((p) => p.id === id)?.name ?? '?';

  type Pick = { playerId: string; characterId: string; price: number; score: number };
  const picks: Pick[] = [];
  for (const p of state.players) {
    for (const cat of state.categoryOrder) {
      const owned = p.roster[cat];
      if (!owned) continue;
      picks.push({
        playerId: p.id,
        characterId: owned.characterId,
        price: owned.pricePaid,
        score: characterOf(state, owned.characterId).hiddenScore,
      });
    }
  }

  if (picks.length) {
    // Bargain: high score, low price. Free picks count as 1 Berry to stay finite.
    const bargain = picks.reduce((best, p) =>
      p.score / Math.max(p.price, 1) > best.score / Math.max(best.price, 1) ? p : best,
    );
    awards.push({
      id: 'bargain',
      title: 'Schnäppchen des Spiels',
      playerId: bargain.playerId,
      detail: `${nameOf(bargain.playerId)} holte ${characterOf(state, bargain.characterId).name} (${bargain.score} Punkte) für ${Math.round(bargain.price / 1_000_000)} Mio.`,
    });

    const flop = picks.reduce((worst, p) => (p.price / Math.max(p.score, 1) > worst.price / Math.max(worst.score, 1) ? p : worst));
    awards.push({
      id: 'flop',
      title: 'Der größte Reinfall',
      playerId: flop.playerId,
      detail: `${nameOf(flop.playerId)} zahlte ${Math.round(flop.price / 1_000_000)} Mio. für ${characterOf(state, flop.characterId).name} - ${flop.score} Punkte.`,
    });
  }

  const richest = state.players.reduce((a, b) => (b.money > a.money ? b : a));
  awards.push({
    id: 'hoarder',
    title: 'Ungenutztes Vermögen',
    playerId: richest.id,
    detail: `${richest.name} sitzt auf ${Math.round(richest.money / 1_000_000)} Mio. - die jetzt niemanden mehr interessieren.`,
  });

  const spender = state.players.reduce((a, b) => (b.totalSpent > a.totalSpent ? b : a));
  awards.push({
    id: 'spender',
    title: 'Größter Geldregen',
    playerId: spender.id,
    detail: `${spender.name} verbrannte ${Math.round(spender.totalSpent / 1_000_000)} Mio. in Auktionen.`,
  });

  return awards;
}
