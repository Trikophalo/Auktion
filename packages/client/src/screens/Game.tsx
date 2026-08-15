import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGame } from '../store/game';
import { isMuted, setMuted } from '../store/sound';
import { Board } from '../components/Board';
import { AuctionStage } from '../components/AuctionStage';
import { BidBar } from '../components/BidBar';
import { AutoAssignOverlay, CategoryEndOverlay, Countdown, ForcedOverlay } from '../components/Overlays';
import { Chat } from '../components/Chat';
import { Trading } from './Trading';

type Tab = 'auction' | 'board';

export function Game() {
  const state = useGame((s) => s.state)!;
  const theme = useGame((s) => s.theme)!;
  const [tab, setTab] = useState<Tab>('auction');
  const [muted, setMutedState] = useState(isMuted());

  const category = theme.categories.find((c) => c.id === state.categoryOrder[state.categoryIndex]);
  const isBidding = state.phase === 'auction_open' || state.phase === 'auction_reveal';

  return (
    <motion.div className="screen game" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <header className="topbar">
        <div className="topbar-left">
          <span className="brand">GRAND LINE AUCTION</span>
          <span className="room-pill">{state.roomCode}</span>
        </div>

        <div className="progress">
          {state.categoryOrder.map((catId, i) => (
            <span
              key={catId}
              className={`prog-dot ${i < state.categoryIndex ? 'done' : ''} ${i === state.categoryIndex ? 'now' : ''}`}
              title={theme.categories.find((c) => c.id === catId)?.title}
            />
          ))}
          <span className="progress-label">
            Kategorie {state.categoryIndex + 1}/{state.categoryOrder.length} · {category?.title}
          </span>
        </div>

        <div className="topbar-right">
          <button
            className="btn icon"
            onClick={() => {
              const next = !muted;
              setMuted(next);
              setMutedState(next);
            }}
            aria-label={muted ? 'Ton an' : 'Ton aus'}
          >
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
      </header>

      {/* Mobile tabs - on desktop both panes are visible at once. */}
      <nav className="mobile-tabs">
        <button className={tab === 'auction' ? 'active' : ''} onClick={() => setTab('auction')}>
          Auktion
        </button>
        <button className={tab === 'board' ? 'active' : ''} onClick={() => setTab('board')}>
          Board
        </button>
      </nav>

      <main className={`game-main tab-${tab}`}>
        <section className="board-pane">
          <Board />
        </section>
        <AuctionStage />
      </main>

      {isBidding && <BidBar />}

      <Chat />

      <Countdown />
      <AnimatePresence>
        <AutoAssignOverlay key="assign" />
        <ForcedOverlay key="forced" />
        <CategoryEndOverlay key="recap" />
        {state.phase === 'trading' && <Trading key="trading" />}
      </AnimatePresence>
    </motion.div>
  );
}
