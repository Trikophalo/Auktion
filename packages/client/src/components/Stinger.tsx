import { AnimatePresence, motion } from 'framer-motion';
import { useGame } from '../store/game';

/** Full-width cinematic banner for the game's big beats (SOLD!, market, ...). */
export function Stinger() {
  const stinger = useGame((s) => s.stinger);

  return (
    <AnimatePresence>
      {stinger && (
        <motion.div
          key={stinger.id}
          className={`stinger ${stinger.kind}`}
          initial={{ opacity: 0, scale: 1.25 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.92 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        >
          <motion.div
            className="stinger-band"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            exit={{ scaleX: 0 }}
            transition={{ duration: 0.35 }}
          >
            <h2>{stinger.title}</h2>
            {stinger.detail && <p>{stinger.detail}</p>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
