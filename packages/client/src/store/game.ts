import { create } from 'zustand';
import type { CharacterPublic, ClientState, GameEvent, ThemeInfo } from '@gla/shared';
import { sfx } from './sound';

export interface Toast {
  id: number;
  kind: 'error' | 'info' | 'success' | 'bid';
  text: string;
}

/** A short-lived cinematic overlay (sold, passed, injection, ...). */
export interface Stinger {
  id: number;
  kind: 'sold' | 'passed' | 'injection' | 'trade' | 'forced' | 'category' | 'time';
  title: string;
  detail?: string;
}

interface GameStore {
  connected: boolean;
  state: ClientState | null;
  theme: ThemeInfo | null;
  characters: Map<string, CharacterPublic>;
  toasts: Toast[];
  stinger: Stinger | null;
  /** Latest events, consumed by components for one-off animations. */
  lastEvents: GameEvent[];
  lastBidder: string | null;
  /** serverNow - Date.now(), so countdowns are immune to a skewed local clock. */
  clockOffset: number;
  /** Messages arrived while the chat was collapsed. */
  unreadChat: number;
  chatOpen: boolean;

  setConnected(v: boolean): void;
  applySnapshot(state: ClientState, theme: ThemeInfo, catalog: CharacterPublic[]): void;
  applyUpdate(state: ClientState, events: GameEvent[]): void;
  pushToast(t: Omit<Toast, 'id'>): void;
  dismissToast(id: number): void;
  setChatOpen(open: boolean): void;
  character(id: string | undefined): CharacterPublic | undefined;
  me(): ClientState['players'][number] | undefined;
  categoryLabel(id: string): string;
  /** Server-aligned wall clock. */
  now(): number;
}

let toastId = 0;
let stingerId = 0;

export const useGame = create<GameStore>((set, get) => ({
  connected: false,
  state: null,
  theme: null,
  characters: new Map(),
  toasts: [],
  stinger: null,
  lastEvents: [],
  lastBidder: null,
  clockOffset: 0,
  unreadChat: 0,
  chatOpen: false,

  setConnected: (v) => set({ connected: v }),

  applySnapshot: (state, theme, catalog) =>
    set({
      state,
      theme,
      characters: new Map(catalog.map((c) => [c.id, c])),
      clockOffset: state.serverNow - Date.now(),
    }),

  applyUpdate: (state, events) => {
    const prev = get().state;
    // A version gap means we missed an update (backgrounded tab, flaky link):
    // ask for a fresh snapshot instead of rendering something inconsistent.
    if (prev && state.version > prev.version + events.length + 8) {
      import('../net/socket').then((m) => m.net.resync());
    }

    set({ state, lastEvents: events, clockOffset: state.serverNow - Date.now() });
    for (const event of events) handleEvent(event, set, get);
  },

  pushToast: (t) => {
    const toast = { ...t, id: ++toastId };
    set((s) => ({ toasts: [...s.toasts, toast].slice(-4) }));
    setTimeout(() => get().dismissToast(toast.id), 3600);
  },

  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  setChatOpen: (open) => set({ chatOpen: open, unreadChat: open ? 0 : get().unreadChat }),

  character: (id) => (id ? get().characters.get(id) : undefined),

  me: () => {
    const s = get().state;
    return s?.players.find((p) => p.id === s.you);
  },

  categoryLabel: (id) => get().theme?.categories.find((c) => c.id === id)?.label ?? id,

  now: () => Date.now() + get().clockOffset,
}));

type Setter = (partial: Partial<GameStore> | ((s: GameStore) => Partial<GameStore>)) => void;

function showStinger(set: Setter, stinger: Omit<Stinger, 'id'>, ms = 2600) {
  const withId = { ...stinger, id: ++stingerId };
  set({ stinger: withId });
  setTimeout(() => {
    // Only clear if no newer stinger replaced this one.
    if (useGame.getState().stinger?.id === withId.id) set({ stinger: null });
  }, ms);
}

function handleEvent(event: GameEvent, set: Setter, get: () => GameStore) {
  const store = get();
  const nameOf = (id: string) => store.state?.players.find((p) => p.id === id)?.name ?? '?';
  const charName = (id: string) => store.characters.get(id)?.name ?? id;

  switch (event.type) {
    case 'category:intro': {
      const cat = store.theme?.categories.find((c) => c.id === event.categoryId);
      sfx.stamp();
      showStinger(set, {
        kind: 'category',
        title: `${cat?.icon ?? ''} ${cat?.title ?? event.categoryId}`,
        detail: cat?.blurb,
      }, 3000);
      break;
    }

    case 'auction:reveal':
      sfx.reveal();
      break;

    case 'auction:bid': {
      set({ lastBidder: event.playerId });
      sfx.bid(store.state?.auction?.bids.length ?? 0);
      if (event.playerId !== store.state?.you) {
        store.pushToast({
          kind: 'bid',
          // A bid inside the hot window buys everyone another 10 seconds.
          text: event.extended
            ? `${nameOf(event.playerId)} bietet in letzter Sekunde - 10s mehr!`
            : `${nameOf(event.playerId)} bietet mit!`,
        });
      }
      break;
    }

    case 'auction:timeSkip': {
      if (event.applied) {
        sfx.whoosh();
        showStinger(set, { kind: 'time', title: 'ZEIT ÜBERSPRUNGEN', detail: 'Alle sind bereit - noch 10 Sekunden!' }, 2000);
      } else {
        store.pushToast({ kind: 'info', text: `${nameOf(event.playerId)} will weiter (${event.votes}/${event.needed})` });
      }
      break;
    }

    case 'auction:sold': {
      sfx.hammer();
      showStinger(set, {
        kind: 'sold',
        title: 'VERKAUFT!',
        detail: `${charName(event.characterId)} geht an ${nameOf(event.playerId)}`,
      });
      break;
    }

    case 'auction:passed':
      sfx.whoosh();
      showStinger(set, {
        kind: 'passed',
        title: 'NIEMAND WILL IHN',
        detail: `${charName(event.characterId)} kommt später günstiger zurück`,
      }, 2200);
      break;

    case 'auction:autoAssign':
      sfx.coins();
      break;

    case 'forced:allocate':
      showStinger(set, { kind: 'forced', title: 'ZWANGSZUTEILUNG', detail: 'Gratis-Charaktere für alle Übriggebliebenen' });
      break;

    case 'economy:injection':
      // The payout is revealed player by player in the category-end overlay,
      // which owns its own sound and timing.
      break;

    case 'trading:start':
      sfx.coins();
      showStinger(set, { kind: 'trade', title: 'MARKTPHASE', detail: 'Jetzt wird gehandelt!' });
      break;

    case 'trading:offer':
      if (event.offer.toId === store.state?.you) {
        sfx.notify();
        store.pushToast({ kind: 'info', text: `${nameOf(event.offer.fromId)} macht dir ein Angebot!` });
      }
      break;

    case 'trading:update':
      if (event.offer.status === 'accepted') {
        sfx.coins();
        store.pushToast({ kind: 'success', text: 'Tausch abgeschlossen!' });
      } else if (event.offer.status === 'rejected' && event.offer.fromId === store.state?.you) {
        store.pushToast({ kind: 'error', text: 'Dein Angebot wurde abgelehnt.' });
      }
      break;

    case 'chat:message': {
      const isMine = event.message.playerId === store.state?.you;
      if (!isMine && event.message.kind === 'player') sfx.notify();
      if (!get().chatOpen && !isMine) set((s) => ({ unreadChat: s.unreadChat + 1 }));
      break;
    }

    case 'reveal:column':
      sfx.reveal();
      break;

    case 'game:over':
      sfx.fanfare();
      break;

    case 'error':
      store.pushToast({ kind: 'error', text: event.message });
      sfx.error();
      break;

    default:
      break;
  }
}
