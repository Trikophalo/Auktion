import { useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useGame } from './store/game';
import { unlockAudio } from './store/sound';
import { Lobby } from './screens/Lobby';
import { Game } from './screens/Game';
import { Reveal } from './screens/Reveal';
import { Toasts } from './components/Toasts';
import { Stinger } from './components/Stinger';

export function App() {
  const state = useGame((s) => s.state);
  const connected = useGame((s) => s.connected);

  // Browsers only allow audio after a gesture - unlock on the first interaction.
  useEffect(() => {
    const handler = () => unlockAudio();
    window.addEventListener('pointerdown', handler, { once: true });
    window.addEventListener('keydown', handler, { once: true });
    return () => {
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('keydown', handler);
    };
  }, []);

  const phase = state?.phase;
  const inReveal = phase === 'final_reveal' || phase === 'game_over';

  return (
    <div className="app">
      <div className="ocean" aria-hidden />
      {!connected && <div className="connection-banner">Verbindung verloren - versuche erneut zu verbinden…</div>}

      <AnimatePresence mode="wait">
        {!state || phase === 'lobby' ? (
          <Lobby key="lobby" />
        ) : inReveal ? (
          <Reveal key="reveal" />
        ) : (
          <Game key="game" />
        )}
      </AnimatePresence>

      <Stinger />
      <Toasts />
    </div>
  );
}
