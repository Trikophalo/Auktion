import { AnimatePresence, motion } from 'framer-motion';
import { useGame } from '../store/game';

export function Toasts() {
  const toasts = useGame((s) => s.toasts);
  const dismiss = useGame((s) => s.dismissToast);

  return (
    <div className="toasts" role="status" aria-live="polite">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.button
            key={toast.id}
            className={`toast ${toast.kind}`}
            initial={{ x: 60, opacity: 0, scale: 0.9 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={{ x: 60, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            onClick={() => dismiss(toast.id)}
          >
            {toast.text}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
