import { AnimatePresence, motion } from 'framer-motion';
import { money, moneyFull } from '@gla/shared';
import { useGame } from '../store/game';
import { net } from '../net/socket';
import { useCountdown } from '../fx/hooks';
import { CharacterArt } from './CharacterArt';

/** The dramatic 5-4-3-2-1 takeover. */
export function Countdown() {
  const state = useGame((s) => s.state)!;
  const value = state.auction?.countdown ?? null;
  const active = state.phase === 'auction_countdown' && value !== null;

  return (
    <AnimatePresence>
      {active && (
        <motion.div className="countdown-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div
            key={value}
            className={`countdown-number ${value! <= 2 ? 'critical' : ''}`}
            initial={{ scale: 2.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 16 }}
          >
            {value}
          </motion.div>
          <div className="countdown-caption">Zum Ersten… zum Zweiten…</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Last eligible player picks one of three - never a solo auction. */
export function LastPickOverlay() {
  const state = useGame((s) => s.state)!;
  const me = useGame((s) => s.me())!;
  const theme = useGame((s) => s.theme)!;
  const characters = useGame((s) => s.characters);
  const remaining = useCountdown(state.deadline);

  if (state.phase !== 'last_pick' || !state.lastPick) return null;

  const picker = state.players.find((p) => p.id === state.lastPick!.playerId)!;
  const mine = picker.id === me.id;
  const category = theme.categories.find((c) => c.id === state.categoryOrder[state.categoryIndex])!;

  return (
    <motion.div className="overlay lastpick" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="overlay-card" initial={{ y: 30, scale: 0.94 }} animate={{ y: 0, scale: 1 }}>
        <h2 className="overlay-title">LETZTE WAHL</h2>
        <p className="overlay-sub">
          {mine ? 'Du bist der letzte Spieler ohne Charakter in dieser Kategorie.' : `${picker.name} muss sich entscheiden.`}
          {' '}Bezahlt wird höchstens, was noch auf dem Konto ist.
        </p>

        <div className="lastpick-options">
          {state.lastPick.options.map((option) => {
            const character = characters.get(option.characterId);
            const price = Math.min(option.startingBid, me.money);
            return (
              <motion.button
                key={option.characterId}
                className={`lastpick-card ${mine ? 'pickable' : ''}`}
                whileHover={mine ? { y: -8, scale: 1.03 } : {}}
                disabled={!mine}
                onClick={() => net.lastPick(option.characterId)}
              >
                <CharacterArt character={character} accent={category.color} width={180} height={210} />
                <span className="lp-name">{character?.name}</span>
                <span className="lp-epithet">{character?.epithet}</span>
                <span className="lp-price">
                  {mine && price < option.startingBid ? (
                    <>
                      <s>{money(option.startingBid)}</s> → <b>{price === 0 ? 'GRATIS' : money(price)}</b>
                    </>
                  ) : (
                    money(option.startingBid)
                  )}
                </span>
              </motion.button>
            );
          })}
        </div>

        <div className="overlay-timer">{Math.ceil(remaining / 1000)}s</div>
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
        {state.lastInjection.length > 0 && (
          <motion.div className="recap-injection" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            💰 Geldspritze für alle
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}
