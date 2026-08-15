import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { money } from '@gla/shared';
import type { Award } from '@gla/shared';
import { useGame } from '../store/game';
import { net } from '../net/socket';
import { sfx } from '../store/sound';
import { useCountUp } from '../fx/hooks';
import { CharacterArt } from '../components/CharacterArt';

/**
 * The finale.
 *
 * Scores stay hidden until this screen, then land column by column: cards flip,
 * scores punch in, totals count up and the leaderboard physically reorders.
 */
export function Reveal() {
  const state = useGame((s) => s.state)!;
  const theme = useGame((s) => s.theme)!;
  const me = useGame((s) => s.me())!;
  const lastEvents = useGame((s) => s.lastEvents);

  const reveal = state.reveal;
  const revealed = reveal?.revealedColumns ?? 0;
  const finished = state.phase === 'game_over';
  const [awards, setAwards] = useState<Award[]>([]);

  // Capture the awards from the closing event.
  useEffect(() => {
    for (const event of lastEvents) {
      if (event.type === 'game:over') setAwards(event.awards);
    }
  }, [lastEvents]);

  // Trap / bargain stingers as each column lands.
  useEffect(() => {
    const column = lastEvents.find((e) => e.type === 'reveal:column');
    if (column && column.type === 'reveal:column') {
      const flop = column.cells.find((c) => c.pricePaid >= 150_000_000 && c.score <= 45);
      if (flop) setTimeout(() => sfx.trombone(), 700);
    }
  }, [lastEvents]);

  useEffect(() => {
    if (!finished) return;
    const duration = 2800;
    const end = Date.now() + duration;
    const frame = () => {
      // zIndex stays below the leaderboard so the finale text remains readable.
      confetti({ particleCount: 4, angle: 60, spread: 70, origin: { x: 0, y: 0.7 }, zIndex: 2, colors: ['#f4b942', '#e63946', '#ffffff'] });
      confetti({ particleCount: 4, angle: 120, spread: 70, origin: { x: 1, y: 0.7 }, zIndex: 2, colors: ['#f4b942', '#5dd6c0', '#ffffff'] });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }, [finished]);

  const ranking = useMemo(() => {
    const totals = reveal?.totals ?? {};
    return [...state.players].sort((a, b) => (totals[b.id] ?? 0) - (totals[a.id] ?? 0));
  }, [state.players, reveal?.totals]);

  const winner = state.players.find((p) => p.id === state.winnerId);

  return (
    <motion.div className="screen reveal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <header className="reveal-head">
        <h1>{finished ? 'DAS BESTE TEAM' : 'DIE ENTHÜLLUNG'}</h1>
        <p>
          {finished
            ? 'Alle geheimen Werte sind aufgedeckt.'
            : `Kategorie ${Math.min(revealed + 1, state.categoryOrder.length)} von ${state.categoryOrder.length}`}
        </p>
      </header>

      <AnimatePresence>
        {finished && winner && (
          <motion.div
            className="winner-banner"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 14 }}
          >
            <span className="crown">👑</span>
            <span className="winner-name">
              {winner.avatar} {winner.name}
            </span>
            <span className="winner-score">{reveal?.totals[winner.id]} PUNKTE</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="leaderboard">
        {ranking.map((player, rank) => (
          <motion.div
            key={player.id}
            layout
            transition={{ type: 'spring', stiffness: 250, damping: 26 }}
            className={`lb-row ${player.id === me.id ? 'is-me' : ''} ${finished && player.id === state.winnerId ? 'is-winner' : ''}`}
          >
            <div className="lb-rank">{rank + 1}</div>
            <div className="lb-player">
              <span className="lb-avatar">{player.avatar}</span>
              <span className="lb-name">{player.name}</span>
            </div>

            <div className="lb-cards">
              {state.categoryOrder.map((catId, columnIndex) => (
                <RevealCell
                  key={catId}
                  playerId={player.id}
                  categoryId={catId}
                  open={columnIndex < revealed}
                  accent={theme.categories.find((c) => c.id === catId)!.color}
                />
              ))}
            </div>

            <TotalCounter value={reveal?.totals[player.id] ?? 0} />
          </motion.div>
        ))}
      </div>

      {!finished && me.isHost && (
        <button className="btn primary big reveal-advance" onClick={() => net.revealAdvance()}>
          Nächste Kategorie aufdecken →
        </button>
      )}
      {!finished && !me.isHost && <p className="reveal-hint">Der Host deckt gleich auf…</p>}

      {finished && awards.length > 0 && (
        <motion.div className="awards" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.8 }}>
          {awards.map((award) => {
            const player = state.players.find((p) => p.id === award.playerId);
            return (
              <div key={award.id} className={`award ${award.id}`}>
                <span className="award-title">{award.title}</span>
                <span className="award-detail">{award.detail}</span>
                <span className="award-player">{player?.avatar}</span>
              </div>
            );
          })}
        </motion.div>
      )}

      {finished && (
        <button className="btn ghost" onClick={() => { net.leave(); location.href = '/'; }}>
          Neues Spiel
        </button>
      )}
    </motion.div>
  );
}

function RevealCell({
  playerId,
  categoryId,
  open,
  accent,
}: {
  playerId: string;
  categoryId: string;
  open: boolean;
  accent: string;
}) {
  const state = useGame((s) => s.state)!;
  const player = state.players.find((p) => p.id === playerId)!;
  const owned = player.roster[categoryId];
  const character = useGame((s) => s.character(owned?.characterId));
  const score = owned ? state.reveal?.scores[owned.characterId] : undefined;

  const value = score ?? 0;
  const tone = value >= 80 ? 'great' : value >= 60 ? 'good' : value >= 40 ? 'meh' : 'bad';

  return (
    <motion.div
      className={`rv-cell ${open ? 'open' : ''} ${open ? tone : ''}`}
      animate={open ? { rotateY: 0 } : { rotateY: 180 }}
      transition={{ duration: 0.5 }}
      title={character?.name}
    >
      <CharacterArt character={character} accent={accent} width={72} height={84} />
      {open && score !== undefined && (
        <motion.span
          className="rv-score"
          initial={{ scale: 2.2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 16 }}
        >
          {score}
        </motion.span>
      )}
      {open && owned && owned.pricePaid > 0 && (
        <span className="rv-price">{money(owned.pricePaid)}</span>
      )}
    </motion.div>
  );
}

function TotalCounter({ value }: { value: number }) {
  const display = useCountUp(value, 900);
  return (
    <div className="lb-total">
      <span className="total-value">{Math.round(display)}</span>
      <span className="total-label">Punkte</span>
    </div>
  );
}
