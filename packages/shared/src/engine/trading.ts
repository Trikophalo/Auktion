import type { GameState, TradeOffer } from '../types.js';
import { RULES } from '../constants.js';
import { characterOf, playerOf } from './helpers.js';

export interface TradeCheck {
  ok: boolean;
  error?: string;
  categoryId?: string;
}

/**
 * Trades are always character-for-character within the same category, plus an
 * optional signed money component.
 *
 * That restriction is deliberate: it makes it structurally impossible for a
 * trade to leave someone without a character in a category they had already
 * filled - the core invariant of the whole game.
 */
export function checkTrade(
  state: GameState,
  fromId: string,
  toId: string,
  giveCharacterId: string,
  wantCharacterId: string,
  money: number,
): TradeCheck {
  if (fromId === toId) return { ok: false, error: 'Du kannst nicht mit dir selbst handeln.' };

  const from = playerOf(state, fromId);
  const to = playerOf(state, toId);
  if (!from || !to) return { ok: false, error: 'Spieler nicht gefunden.' };

  if (money % RULES.BID_STEP !== 0) {
    return { ok: false, error: 'Geldbeträge müssen in 5-Mio-Schritten angegeben werden.' };
  }

  const give = characterOf(state, giveCharacterId);
  const want = characterOf(state, wantCharacterId);
  if (give.category !== want.category) {
    return { ok: false, error: 'Nur Charaktere derselben Kategorie können getauscht werden.' };
  }

  const cat = give.category;
  if (from.roster[cat]?.characterId !== giveCharacterId) {
    return { ok: false, error: 'Dieser Charakter gehört dir nicht.' };
  }
  if (to.roster[cat]?.characterId !== wantCharacterId) {
    return { ok: false, error: 'Der gewünschte Charakter gehört diesem Spieler nicht (mehr).' };
  }

  if (money > 0 && from.money < money) {
    return { ok: false, error: 'Du hast nicht genug Berry für dieses Angebot.' };
  }
  if (money < 0 && to.money < -money) {
    return { ok: false, error: 'Der andere Spieler kann sich das nicht leisten.' };
  }

  return { ok: true, categoryId: cat };
}

/** Executes an already validated offer: swaps the characters and moves money. */
export function executeTrade(state: GameState, offer: TradeOffer): GameState {
  const cat = offer.categoryId;

  const players = state.players.map((p) => {
    if (p.id === offer.fromId) {
      const received = state.players.find((x) => x.id === offer.toId)!.roster[cat]!;
      return {
        ...p,
        money: p.money - offer.money,
        tradeBalance: p.tradeBalance - offer.money,
        roster: { ...p.roster, [cat]: { ...received, via: 'trade' as const } },
      };
    }
    if (p.id === offer.toId) {
      const received = state.players.find((x) => x.id === offer.fromId)!.roster[cat]!;
      return {
        ...p,
        money: p.money + offer.money,
        tradeBalance: p.tradeBalance + offer.money,
        roster: { ...p.roster, [cat]: { ...received, via: 'trade' as const } },
      };
    }
    return p;
  });

  return { ...state, players };
}

export function openOfferCount(state: GameState, playerId: string): number {
  return (state.trading?.offers ?? []).filter((o) => o.fromId === playerId && o.status === 'open').length;
}
