import { AnimatePresence, motion } from 'framer-motion';
import { TIMINGS, money, moneyFull } from '@gla/shared';
import { useGame } from '../store/game';
import { useCountUp, useCountdown, usePixelReveal } from '../fx/hooks';
import { CharacterArt } from './CharacterArt';

export function AuctionStage() {
  const state = useGame((s) => s.state)!;
  const theme = useGame((s) => s.theme)!;
  const auction = state.auction;
  const category = theme.categories.find((c) => c.id === state.categoryOrder[state.categoryIndex])!;

  const revealing = state.phase === 'auction_reveal';
  const pixelLevel = usePixelReveal(revealing, TIMINGS.AUCTION_REVEAL - 1200, 7);
  const character = useGame((s) => s.character(auction?.characterId));
  const currentBid = useCountUp(auction?.currentBid ?? 0, 450);
  const remaining = useCountdown(state.deadline);

  const leader = state.players.find((p) => p.id === auction?.leaderId);
  const isOpen = state.phase === 'auction_open';
  const hot = isOpen && remaining <= TIMINGS.HOT_WINDOW;
  const total = state.settings.auctionSeconds * 1000;
  const timeProgress = isOpen ? Math.max(0, Math.min(1, remaining / total)) : 1;

  if (!auction) {
    return (
      <aside className="stage" style={{ '--accent': category.color } as React.CSSProperties}>
        <StageIdle />
      </aside>
    );
  }

  const nameHidden = revealing && pixelLevel > 0.12;
  const discounted = auction.timesPassed > 0;

  return (
    <aside className={`stage ${hot ? 'panic' : ''}`} style={{ '--accent': category.color } as React.CSSProperties}>
      <header className="stage-head">
        <span className="stage-kicker">Aktuelle Auktion</span>
        <span className="stage-category">
          {category.icon} {category.title}
        </span>
      </header>

      <div className="stage-price">
        <span className="label">Startgebot</span>
        <motion.span
          key={auction.characterId}
          className="value"
          initial={{ scale: 1.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 14 }}
        >
          {moneyFull(auction.startingBid)}
        </motion.span>
        {discounted && (
          <span className="discount">
            <s>{money(auction.originalBid)}</s> · {auction.timesPassed}× übrig geblieben
          </span>
        )}
      </div>

      <div className="portrait-wrap">
        <motion.div
          className="portrait"
          key={auction.characterId}
          initial={{ scale: 0.86, opacity: 0, rotateY: -18 }}
          animate={{ scale: 1, opacity: 1, rotateY: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
          <CharacterArt character={character} accent={category.color} pixelLevel={pixelLevel} width={320} height={380} />
          {isOpen && (
            <svg className={`soft-ring ${hot ? 'hot' : ''}`} viewBox="0 0 100 100" aria-hidden>
              <circle className="soft-ring-track" cx="50" cy="50" r="47" />
              <circle
                className="soft-ring-bar"
                cx="50"
                cy="50"
                r="47"
                style={{ strokeDashoffset: 295 * (1 - timeProgress) }}
              />
            </svg>
          )}
        </motion.div>

        <div className="name-plate">
          {nameHidden ? (
            <span className="unknown">? ? ?</span>
          ) : (
            <motion.div initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
              <span className="char-name">{character?.name}</span>
              <span className="char-epithet">{character?.epithet}</span>
            </motion.div>
          )}
        </div>
      </div>

      {isOpen && (
        <div className={`auction-clock ${hot ? 'hot' : ''}`}>
          <span className="clock-label">{hot ? 'Letzte Sekunden' : 'Verbleibende Zeit'}</span>
          <span className="clock-value">{formatClock(remaining)}</span>
          {(auction.timeSkips.length > 0 || hot) && (
            <span className="clock-note">
              {hot
                ? 'Jedes Gebot setzt auf 10s zurück'
                : `${auction.timeSkips.length}/${state.players.filter((p) => p.connected).length} wollen weiter`}
            </span>
          )}
        </div>
      )}

      <div className="bid-display">
        <span className="label">Aktuelles Gebot</span>
        <div className="current-bid">
          {auction.currentBid === 0 ? (
            <span className="no-bid">Noch kein Gebot</span>
          ) : (
            <motion.span key={auction.currentBid} className="amount" initial={{ scale: 1.35 }} animate={{ scale: 1 }}>
              {moneyFull(Math.round(currentBid))}
            </motion.span>
          )}
        </div>
        {leader && (
          <div className="leader">
            <span className="leader-avatar">{leader.avatar}</span>
            <span>{leader.name}</span>
            <span className="tag lead">führt</span>
          </div>
        )}
      </div>

      <div className="bid-history">
        <AnimatePresence initial={false}>
          {[...auction.bids]
            .slice(-5)
            .reverse()
            .map((bid) => {
              const p = state.players.find((x) => x.id === bid.playerId);
              return (
                <motion.div
                  key={bid.seq}
                  className="bid-row"
                  initial={{ x: 30, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <span>{p?.avatar} {p?.name}</span>
                  <b>{money(bid.amount)}</b>
                </motion.div>
              );
            })}
        </AnimatePresence>
      </div>
    </aside>
  );
}

function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return minutes > 0 ? `${minutes}:${String(seconds).padStart(2, '0')}` : `${seconds}s`;
}

function StageIdle() {
  const state = useGame((s) => s.state)!;
  const theme = useGame((s) => s.theme)!;
  const category = theme.categories.find((c) => c.id === state.categoryOrder[state.categoryIndex]);

  const text: Record<string, string> = {
    category_intro: 'Die nächste Kategorie wird vorbereitet…',
    category_end: 'Kategorie abgeschlossen!',
    auto_assign: 'Der letzte Charakter wird zugeteilt…',
    forced_allocation: 'Zwangszuteilung läuft…',
    trading: 'Marktphase - jetzt wird gehandelt!',
  };

  return (
    <div className="stage-idle">
      <div className="idle-icon">{category?.icon ?? '⚓'}</div>
      <h2>{category?.title}</h2>
      <p>{text[state.phase] ?? 'Gleich geht es weiter…'}</p>
      <div className="deck-info">Noch {state.deckSize} von {state.players.length} Charakteren</div>
    </div>
  );
}
