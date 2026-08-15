import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { TIMINGS, money, moneyFull } from '@gla/shared';
import { useGame } from '../store/game';
import { sfx } from '../store/sound';
import { useCountUp, useCountdown } from '../fx/hooks';
import { CharacterArt } from './CharacterArt';

/**
 * The dramatic final seconds.
 *
 * Deliberately `pointer-events: none` and offset from the bid bar: the whole
 * point of the rule is that you can still bid while this is on screen, and a
 * bid inside the hot window buys everyone another 10 seconds.
 */
export function Countdown() {
  const state = useGame((s) => s.state)!;
  const remaining = useCountdown(state.deadline);
  const seconds = Math.ceil(remaining / 1000);
  const active = state.phase === 'auction_open' && remaining > 0 && seconds <= TIMINGS.CRITICAL_SECONDS;

  return (
    <AnimatePresence>
      {active && (
        <motion.div className="countdown-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div
            key={seconds}
            className={`countdown-number ${seconds <= 2 ? 'critical' : ''}`}
            initial={{ scale: 2.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 16 }}
          >
            {seconds}
          </motion.div>
          <div className="countdown-caption">Jetzt noch bieten - jedes Gebot gibt 10 Sekunden zurück!</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * The leftover character is handed to the last player standing. Since every
 * category holds exactly one character per player, this is a guaranteed moment
 * rather than a fallback - so it gets its own little ceremony.
 */
export function AutoAssignOverlay() {
  const state = useGame((s) => s.state)!;
  const theme = useGame((s) => s.theme)!;
  const character = useGame((s) => s.character(state.autoAssign?.characterId));

  if (state.phase !== 'auto_assign' || !state.autoAssign) return null;

  const { playerId, price, fullPrice } = state.autoAssign;
  const player = state.players.find((p) => p.id === playerId)!;
  const category = theme.categories.find((c) => c.id === state.categoryOrder[state.categoryIndex])!;
  const mine = playerId === state.you;
  const discounted = price < fullPrice;

  return (
    <motion.div className="overlay assign" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        className="assign-card"
        initial={{ scale: 0.7, y: 40, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 18 }}
      >
        <motion.span
          className="assign-kicker"
          initial={{ y: -14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
        >
          Letzter Charakter der Kategorie
        </motion.span>

        <motion.div
          className="assign-art"
          initial={{ rotate: -6, scale: 0.9 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 14, delay: 0.2 }}
        >
          <CharacterArt character={character} accent={category.color} width={220} height={260} />
        </motion.div>

        <motion.div className="assign-name" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}>
          <span className="an-name">{character?.name}</span>
          <span className="an-epithet">{character?.epithet}</span>
        </motion.div>

        <motion.div
          className="assign-to"
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 16, delay: 0.7 }}
        >
          <span className="at-arrow">↓</span>
          <span className="at-player">
            {player.avatar} {mine ? 'Du' : player.name}
          </span>
          <span className="at-price">
            {price === 0 ? (
              <b className="free">GRATIS</b>
            ) : (
              <>
                {discounted && <s>{money(fullPrice)}</s>} <b>{moneyFull(price)}</b>
                <em> Mindestpreis</em>
              </>
            )}
          </span>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

/** Free characters dealt when a category somehow stalls completely. */
export function ForcedOverlay() {
  const state = useGame((s) => s.state)!;
  const characters = useGame((s) => s.characters);
  if (state.phase !== 'forced_allocation' || !state.forced) return null;

  return (
    <motion.div className="overlay forced" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="overlay-card">
        <h2 className="overlay-title">ZWANGSZUTEILUNG</h2>
        <p className="overlay-sub">Niemand wollte bieten - das Auktionshaus verteilt gratis.</p>
        <div className="forced-list">
          {state.forced.awards.map((award, i) => {
            const player = state.players.find((p) => p.id === award.playerId);
            return (
              <motion.div
                key={award.playerId}
                className="forced-row"
                initial={{ x: -40, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: i * 0.25 }}
              >
                <span>{player?.avatar} {player?.name}</span>
                <b>{characters.get(award.characterId)?.name}</b>
                <span className="free">GRATIS</span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

/** Recap + injection between categories. */
export function CategoryEndOverlay() {
  const state = useGame((s) => s.state)!;
  const theme = useGame((s) => s.theme)!;
  const characters = useGame((s) => s.characters);
  if (state.phase !== 'category_end') return null;

  const category = theme.categories.find((c) => c.id === state.categoryOrder[state.categoryIndex])!;

  return (
    <motion.div className="overlay recap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="overlay-card" initial={{ scale: 0.95 }} animate={{ scale: 1 }}>
        <h2 className="overlay-title" style={{ color: category.color }}>
          {category.icon} {category.title} abgeschlossen
        </h2>
        <div className="recap-list">
          {state.recap.map((entry, i) => {
            const player = state.players.find((p) => p.id === entry.playerId);
            return (
              <motion.div
                key={entry.playerId}
                className="recap-row"
                initial={{ y: 16, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: i * 0.12 }}
              >
                <span className="recap-player">{player?.avatar} {player?.name}</span>
                <span className="recap-char">{characters.get(entry.characterId)?.name}</span>
                <span className="recap-price">
                  {entry.pricePaid === 0 ? 'gratis' : moneyFull(entry.pricePaid)}
                </span>
              </motion.div>
            );
          })}
        </div>
        {state.lastInjection.length > 0 && <InjectionReveal />}
      </motion.div>
    </motion.div>
  );
}

/**
 * The cash injection, paid out one player at a time.
 *
 * Showing every payout at once made it impossible to see who got what - the
 * numbers are the whole point, so each one gets its own beat, its own coin
 * sound and a counter that ticks up to the amount.
 */
function InjectionReveal() {
  const state = useGame((s) => s.state)!;
  const grants = state.lastInjection;
  const [revealed, setRevealed] = useState(0);

  const START_DELAY = 900;
  const STEP = 800;

  useEffect(() => {
    setRevealed(0);
    const timers = grants.map((_, i) =>
      setTimeout(() => {
        setRevealed(i + 1);
        sfx.coins();
      }, START_DELAY + i * STEP),
    );
    return () => timers.forEach(clearTimeout);
  }, [grants]);

  return (
    <div className="injection-reveal">
      <motion.div
        className="injection-title"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        💰 Geldspritze
      </motion.div>

      <div className="injection-rows">
        {grants.map((grant, i) => {
          const player = state.players.find((p) => p.id === grant.playerId);
          const open = i < revealed;
          return (
            <div key={grant.playerId} className={`injection-row ${open ? 'open' : ''}`}>
              <span className="ir-player">
                <span className="ir-avatar">{player?.avatar}</span>
                {player?.name}
              </span>
              {open ? (
                <motion.span
                  className="ir-amount"
                  initial={{ scale: 2, opacity: 0, x: 20 }}
                  animate={{ scale: 1, opacity: 1, x: 0 }}
                  transition={{ type: 'spring', stiffness: 340, damping: 15 }}
                >
                  +<CountingAmount value={grant.amount} />
                </motion.span>
              ) : (
                <span className="ir-pending">…</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CountingAmount({ value }: { value: number }) {
  const display = useCountUp(value, 600);
  return <>{money(Math.round(display / 5_000_000) * 5_000_000)}</>;
}
