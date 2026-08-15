import { useState } from 'react';
import { motion } from 'framer-motion';
import { RULES } from '@gla/shared';
import { useGame } from '../store/game';
import { net } from '../net/socket';

const AVATARS = ['🏴‍☠️', '🐒', '🦊', '🐧', '🦁', '🐙', '🦈', '🐲', '🦅', '🐺', '🦝', '🐯'];

export function Lobby() {
  const state = useGame((s) => s.state);
  const me = useGame((s) => s.me());
  const [name, setName] = useState(() => localStorage.getItem('gla.name') ?? '');
  const [avatar, setAvatar] = useState(() => localStorage.getItem('gla.avatar') ?? AVATARS[0]);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const remember = () => {
    localStorage.setItem('gla.name', name);
    localStorage.setItem('gla.avatar', avatar);
  };

  async function create() {
    if (!name.trim()) return setError('Bitte gib deinen Namen ein.');
    setBusy(true);
    remember();
    const res = await net.createRoom(name.trim(), avatar);
    setBusy(false);
    if (!res.ok) setError(res.error ?? 'Raum konnte nicht erstellt werden.');
  }

  async function join() {
    if (!name.trim()) return setError('Bitte gib deinen Namen ein.');
    if (code.trim().length !== 6) return setError('Der Raumcode besteht aus 6 Zeichen.');
    setBusy(true);
    remember();
    const res = await net.joinRoom(code.trim(), name.trim(), avatar);
    setBusy(false);
    if (!res.ok) setError(res.error ?? 'Beitritt fehlgeschlagen.');
  }

  // ------------------------------------------------------------- room view
  if (state && me) {
    const canStart = me.isHost && state.players.length >= RULES.MIN_PLAYERS;
    const link = `${location.origin}/?room=${state.roomCode}`;

    return (
      <motion.div className="screen lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <div className="lobby-card wide">
          <div className="room-head">
            <div>
              <div className="eyebrow">Raumcode</div>
              <div className="room-code">{state.roomCode}</div>
            </div>
            <button
              className="btn ghost"
              onClick={() => {
                navigator.clipboard?.writeText(link);
                useGame.getState().pushToast({ kind: 'success', text: 'Einladungslink kopiert!' });
              }}
            >
              🔗 Link kopieren
            </button>
          </div>

          <div className="player-slots">
            {state.players.map((p) => (
              <motion.div
                key={p.id}
                className={`slot ${p.id === me.id ? 'is-me' : ''}`}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 320, damping: 22 }}
              >
                <span className="slot-avatar">{p.avatar}</span>
                <span className="slot-name">{p.name}</span>
                {p.isHost && <span className="tag">Host</span>}
                {p.ready && !p.isHost && <span className="tag ok">Bereit</span>}
              </motion.div>
            ))}
            {Array.from({ length: RULES.MAX_PLAYERS - state.players.length }).map((_, i) => (
              <div key={`empty-${i}`} className="slot empty">
                Freier Platz
              </div>
            ))}
          </div>

          <div className="rules-digest">
            <h3>So wird gespielt</h3>
            <ol>
              <li>Jeder startet mit <b>1 Mrd. Berry</b> und braucht am Ende genau einen Charakter aus <b>10 Kategorien</b>.</li>
              <li>Charaktere werden einzeln versteigert. Mindestschritt: <b>5 Mio.</b> Nach 10 Sekunden ohne Gebot läuft der Countdown.</li>
              <li>Jeder Charakter hat eine <b>geheime Punktzahl</b>. Teuer heißt nicht automatisch gut.</li>
              <li>Nach jeder Kategorie gibt es <b>10-50 Mio.</b> extra. Nach Kategorie 3, 6 und 9 wird <b>gehandelt</b>.</li>
              <li>Am Ende zählt nur die Summe der geheimen Punkte. Das beste Team gewinnt.</li>
            </ol>
          </div>

          <div className="lobby-actions">
            {me.isHost ? (
              <button className="btn primary big" disabled={!canStart} onClick={() => net.start()}>
                {canStart ? '⚔️ Spiel starten' : `Mindestens ${RULES.MIN_PLAYERS} Spieler`}
              </button>
            ) : (
              <button className={`btn big ${me.ready ? 'ok' : 'primary'}`} onClick={() => net.ready(!me.ready)}>
                {me.ready ? '✓ Bereit' : 'Bereit melden'}
              </button>
            )}
            <button
              className="btn ghost"
              onClick={() => {
                net.leave();
                location.reload();
              }}
            >
              Raum verlassen
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  // ------------------------------------------------------------ entry view
  const prefill = new URLSearchParams(location.search).get('room');
  if (prefill && !code) setCode(prefill.toUpperCase());

  return (
    <motion.div className="screen lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        className="title-block"
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      >
        <h1 className="game-title">
          GRAND LINE <span>AUCTION</span>
        </h1>
        <p className="tagline">Ersteigere die stärkste Crew der Welt.</p>
      </motion.div>

      <div className="lobby-card">
        <label className="field">
          <span>Dein Piratenname</span>
          <input
            value={name}
            maxLength={16}
            placeholder="z.B. Ruffy"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
          />
        </label>

        <div className="field">
          <span>Flagge</span>
          <div className="avatar-picker">
            {AVATARS.map((a) => (
              <button key={a} className={`avatar ${a === avatar ? 'selected' : ''}`} onClick={() => setAvatar(a)}>
                {a}
              </button>
            ))}
          </div>
        </div>

        <button className="btn primary big" disabled={busy} onClick={create}>
          Neues Spiel erstellen
        </button>

        <div className="divider"><span>oder</span></div>

        <div className="join-row">
          <input
            className="code-input"
            value={code}
            maxLength={6}
            placeholder="RAUMCODE"
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && join()}
          />
          <button className="btn" disabled={busy} onClick={join}>
            Beitreten
          </button>
        </div>

        {error && <div className="error-line">{error}</div>}
      </div>
    </motion.div>
  );
}
