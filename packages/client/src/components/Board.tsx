import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { money } from '@gla/shared';
import { useGame } from '../store/game';
import { useCountUp } from '../fx/hooks';
import { CharacterArt } from './CharacterArt';

export function Board() {
  const state = useGame((s) => s.state)!;
  const theme = useGame((s) => s.theme)!;
  const activeCategory = state.categoryOrder[state.categoryIndex];
  const scroller = useRef<HTMLDivElement>(null);

  // On narrow screens the board scrolls - always keep the live category visible.
  useEffect(() => {
    const head = scroller.current?.querySelector('.board-head.active');
    head?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [state.categoryIndex]);

  return (
    <div className="board" role="table" aria-label="Team-Board">
      <div className="board-scroll" ref={scroller}>
        <div className="board-grid" style={{ gridTemplateColumns: `var(--rail) repeat(${state.categoryOrder.length}, minmax(58px, 1fr))` }}>
          {/* Header row */}
          <div className="board-corner">Crew</div>
          {state.categoryOrder.map((catId, i) => {
            const cat = theme.categories.find((c) => c.id === catId)!;
            const done = i < state.categoryIndex;
            const active = catId === activeCategory;
            return (
              <div
                key={catId}
                className={`board-head ${active ? 'active' : ''} ${done ? 'done' : ''}`}
                style={{ '--accent': cat.color } as React.CSSProperties}
                title={cat.title}
              >
                <span className="head-icon">{cat.icon}</span>
                <span className="head-label">{cat.label}</span>
              </div>
            );
          })}

          {/* One row per player */}
          {state.players.map((player) => (
            <PlayerRow key={player.id} playerId={player.id} activeCategory={activeCategory} />
          ))}
        </div>
      </div>
    </div>
  );
}

function PlayerRow({ playerId, activeCategory }: { playerId: string; activeCategory: string }) {
  const state = useGame((s) => s.state)!;
  const theme = useGame((s) => s.theme)!;
  const player = state.players.find((p) => p.id === playerId)!;

  const displayMoney = useCountUp(player.money);
  const isMe = player.id === state.you;
  const isLeader = state.auction?.leaderId === player.id;
  const hasSkipped = state.auction?.skipped.includes(player.id) ?? false;
  const isSpectating = Boolean(player.roster[activeCategory]);
  const collected = state.categoryOrder.filter((c) => player.roster[c]).length;

  return (
    <>
      <div className={`player-rail ${isMe ? 'is-me' : ''} ${isLeader ? 'is-leader' : ''}`}>
        <div className="rail-top">
          <span className="rail-avatar">{player.avatar}</span>
          <div className="rail-id">
            <span className="rail-name">
              {player.name}
              {isMe && <em> (du)</em>}
            </span>
            <span className="rail-money">{money(Math.round(displayMoney))}</span>
          </div>
        </div>

        <div className="rail-meta">
          <span className="pips" title={`${collected} von ${state.categoryOrder.length}`}>
            {collected}/{state.categoryOrder.length}
          </span>
          {!player.connected && <span className="chip off">offline</span>}
          {isLeader && <span className="chip lead">Höchstgebot</span>}
          {!isLeader && hasSkipped && <span className="chip skip">passt</span>}
          {!isLeader && !hasSkipped && isSpectating && <span className="chip spec">fertig</span>}
        </div>

      </div>

      {state.categoryOrder.map((catId) => {
        const owned = player.roster[catId];
        const cat = theme.categories.find((c) => c.id === catId)!;
        const isActive = catId === activeCategory;
        return (
          <div
            key={catId}
            className={`cell ${isActive ? 'active-col' : ''} ${owned ? 'filled' : 'empty'}`}
            style={{ '--accent': cat.color } as React.CSSProperties}
          >
            {owned ? <BoardCard characterId={owned.characterId} price={owned.pricePaid} accent={cat.color} /> : <span className="cell-dot" />}
          </div>
        );
      })}
    </>
  );
}

function BoardCard({ characterId, price, accent }: { characterId: string; price: number; accent: string }) {
  const character = useGame((s) => s.character(characterId));
  return (
    <motion.div
      className="board-card"
      layoutId={`char-${characterId}`}
      initial={{ scale: 0.4, rotate: -8, opacity: 0 }}
      animate={{ scale: 1, rotate: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      title={`${character?.name ?? ''} - ${money(price)}`}
    >
      <CharacterArt character={character} accent={accent} width={120} height={140} />
      <span className="board-card-name">{character?.name}</span>
      <span className="board-card-price">{price === 0 ? 'gratis' : money(price)}</span>
    </motion.div>
  );
}
