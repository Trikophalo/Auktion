import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useGame } from '../store/game';
import { net } from '../net/socket';
import { useCountdown } from '../fx/hooks';
import { CharacterArt } from '../components/CharacterArt';

/**
 * "Coolest team" vote.
 *
 * Deliberately separate from the hidden-score winner: points reward reading the
 * auction, this rewards the team people actually want to look at. You cannot
 * vote for yourself, so the choice is always about someone else's board.
 */
export function Voting() {
  const state = useGame((s) => s.state)!;
  const theme = useGame((s) => s.theme)!;
  const me = useGame((s) => s.me())!;
  const remaining = useCountdown(state.deadline);

  const voting = state.voting;
  const decided = Boolean(voting?.winnerId);
  const myVote = voting?.votes[me.id];
  const opponents = state.players.filter((p) => p.id !== me.id);
  const votesIn = Object.keys(voting?.votes ?? {}).length;

  useEffect(() => {
    if (!decided) return;
    const end = Date.now() + 1800;
    const frame = () => {
      confetti({ particleCount: 3, spread: 80, origin: { y: 0.35 }, zIndex: 2, colors: ['#f4b942', '#f78fd4', '#ffffff'] });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }, [decided]);

  const winner = state.players.find((p) => p.id === voting?.winnerId);

  return (
    <motion.div className="screen voting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <header className="voting-head">
        <h1>{decided ? 'DAS COOLSTE TEAM' : 'WER HAT DAS COOLSTE TEAM?'}</h1>
        <p>
          {decided
            ? 'Die Fans haben entschieden.'
            : 'Stimme für ein gegnerisches Team - für dein eigenes kannst du nicht abstimmen.'}
        </p>
        {!decided && (
          <div className="voting-meta">
            <span className="vote-timer">{Math.ceil(remaining / 1000)}s</span>
            <span className="vote-count">
              {votesIn}/{state.players.filter((p) => p.connected).length} Stimmen
            </span>
          </div>
        )}
      </header>

      <AnimatePresence>
        {decided && winner && (
          <motion.div
            className="vote-winner"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 220, damping: 15 }}
          >
            <span className="vw-crown">🏆</span>
            <span className="vw-name">
              {winner.avatar} {winner.name}
            </span>
            <span className="vw-votes">
              {voting!.tally[winner.id]} {voting!.tally[winner.id] === 1 ? 'Stimme' : 'Stimmen'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="vote-teams">
        {opponents.map((player) => {
          const chosen = myVote === player.id;
          const tally = voting?.tally[player.id];
          return (
            <motion.button
              key={player.id}
              className={`vote-team ${chosen ? 'chosen' : ''} ${decided && player.id === voting?.winnerId ? 'won' : ''}`}
              whileHover={decided ? {} : { y: -6 }}
              disabled={decided}
              onClick={() => net.vote(player.id)}
            >
              <div className="vt-head">
                <span className="vt-avatar">{player.avatar}</span>
                <span className="vt-name">{player.name}</span>
                {chosen && <span className="vt-badge">Deine Stimme</span>}
                {decided && tally !== undefined && <span className="vt-tally">{tally}</span>}
              </div>

              <div className="vt-cards">
                {state.categoryOrder.map((catId) => {
                  const owned = player.roster[catId];
                  const accent = theme.categories.find((c) => c.id === catId)!.color;
                  return <VoteCard key={catId} characterId={owned?.characterId} accent={accent} />;
                })}
              </div>
            </motion.button>
          );
        })}
      </div>

      {!decided && myVote && <p className="vote-hint">Stimme abgegeben - warte auf die anderen.</p>}
    </motion.div>
  );
}

function VoteCard({ characterId, accent }: { characterId?: string; accent: string }) {
  const character = useGame((s) => s.character(characterId));
  return (
    <div className="vt-card" title={character?.name}>
      <CharacterArt character={character} accent={accent} width={70} height={82} />
    </div>
  );
}
