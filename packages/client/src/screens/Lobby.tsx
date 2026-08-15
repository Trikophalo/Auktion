import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { RULES, SETTINGS_BOUNDS, money } from '@gla/shared';
import { useGame } from '../store/game';
import { net, type ThemeSummary } from '../net/socket';
import { Chat } from '../components/Chat';

const AVATARS = ['🏴‍☠️', '🐒', '🦊', '🐧', '🦁', '🐙', '🦈', '🐲', '🦅', '🐺', '🦝', '🐯'];

/**
 * How many players the current era filter can seat.
 *
 * Every category deals one character per player, so the smallest category after
 * filtering is the hard ceiling for the table.
 */
function useCapacity() {
  const state = useGame((s) => s.state);
  const theme = useGame((s) => s.theme);
  const catalog = useGame((s) => s.characters);

  return useMemo(() => {
    if (!state || !theme?.generations) return { max: RULES.MAX_PLAYERS, tightest: '' };
    let max = Infinity;
    let tightest = '';
    for (const category of theme.categories) {
      const size = [...catalog.values()].filter(
        (c) => c.category === category.id && (c.generation ?? 1) <= state.settings.maxGeneration,
      ).length;
      if (size < max) {
        max = size;
        tightest = category.id;
      }
    }
    return { max: Number.isFinite(max) ? max : 0, tightest };
  }, [state?.settings.maxGeneration, theme, catalog]);
}

export function Lobby() {
  const state = useGame((s) => s.state);
  const me = useGame((s) => s.me());
  const [name, setName] = useState(() => localStorage.getItem('gla.name') ?? '');
  const [avatar, setAvatar] = useState(() => localStorage.getItem('gla.avatar') ?? AVATARS[0]);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [themes, setThemes] = useState<ThemeSummary[]>([]);
  const [themeId, setThemeId] = useState(() => localStorage.getItem('gla.theme') ?? 'one-piece');

  useEffect(() => {
    net.themes().then(setThemes);
  }, []);

  const capacity = useCapacity();

  const remember = () => {
    localStorage.setItem('gla.name', name);
    localStorage.setItem('gla.avatar', avatar);
  };

  async function create() {
    if (!name.trim()) return setError('Bitte gib deinen Namen ein.');
    setBusy(true);
    remember();
    localStorage.setItem('gla.theme', themeId);
    const res = await net.createRoom(name.trim(), avatar, themeId);
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
    const tooFewPlayers = state.players.length < RULES.MIN_PLAYERS;
    const tooManyForEra = state.players.length > capacity.max;
    const canStart = me.isHost && !tooFewPlayers && !tooManyForEra;

    // Say what actually blocks the start - "zu wenige Spieler" would be a lie
    // when the real problem is that the era filter cannot seat the table.
    const startLabel = tooFewPlayers
      ? `Mindestens ${RULES.MIN_PLAYERS} Spieler`
      : tooManyForEra
        ? `Zu wenige Charaktere für ${state.players.length} Spieler`
        : '⚔️ Spiel starten';
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

          <RoomSettings canEdit={me.isHost} capacity={capacity} />

          <Chat variant="panel" />

          <details className="rules-digest">
            <summary>So wird gespielt</summary>
            <ol>
              <li>Jeder startet mit <b>1 Mrd. Berry</b> und braucht am Ende genau einen Charakter aus <b>10 Kategorien</b>.</li>
              <li>Charaktere werden einzeln versteigert. Mindestschritt: <b>5 Mio.</b> In den letzten 10 Sekunden setzt jedes Gebot die Uhr wieder auf 10s.</li>
              <li>Jeder Charakter hat eine <b>geheime Punktzahl</b>. Teuer heißt nicht automatisch gut.</li>
              <li>Pro Kategorie gibt es <b>genau so viele Charaktere wie Spieler</b> - der Letzte bekommt automatisch den Rest.</li>
              <li>Nach jeder Kategorie gibt es eine <b>Geldspritze</b>. Nach Kategorie 3, 6 und 9 wird <b>gehandelt</b>.</li>
              <li>Am Ende zählt nur die Summe der geheimen Punkte. Das beste Team gewinnt.</li>
            </ol>
          </details>

          <div className="lobby-actions">
            {me.isHost ? (
              <button className="btn primary big start-game" disabled={!canStart} onClick={() => net.start()}>
                {startLabel}
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
          AUKTIONS <span>ARENA</span>
        </h1>
        <p className="tagline">Ersteigere das stärkste Team - Genre frei wählbar.</p>
      </motion.div>

      <div className="lobby-card">
        {themes.length > 1 && (
          <div className="field">
            <span>Genre</span>
            <div className="theme-picker">
              {themes.map((t) => (
                <button
                  key={t.id}
                  className={`theme-option ${t.id === themeId ? 'selected' : ''}`}
                  onClick={() => setThemeId(t.id)}
                >
                  <span className="theme-icon">{t.icon}</span>
                  <span className="theme-body">
                    <span className="theme-title">{t.title}</span>
                    <span className="theme-blurb">{t.blurb}</span>
                  </span>
                  <span className="theme-count">{t.characterCount}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="field">
          <span>Dein Name</span>
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

/**
 * Host-configurable room settings. Everyone sees the current values live; only
 * the host can change them, so nobody is surprised by the rules mid-game.
 */
function RoomSettings({
  canEdit,
  capacity,
}: {
  canEdit: boolean;
  capacity: { max: number; tightest: string };
}) {
  const state = useGame((s) => s.state)!;
  const theme = useGame((s) => s.theme);
  const settings = state.settings;
  const players = state.players.length;
  const b = SETTINGS_BOUNDS;

  const capacityLabel = theme?.categories.find((c) => c.id === capacity.tightest)?.title ?? '';

  const minutes = (settings.auctionSeconds / 60).toFixed(settings.auctionSeconds % 60 === 0 ? 0 : 1);

  return (
    <div className={`room-settings ${canEdit ? '' : 'readonly'}`}>
      <h3>⚙️ Einstellungen {!canEdit && <em>- nur der Host kann sie ändern</em>}</h3>

      <label className="setting">
        <span className="setting-head">
          Zeit pro Auktion
          <b>{minutes} Min.</b>
        </span>
        <input
          type="range"
          min={b.AUCTION_SECONDS_MIN}
          max={b.AUCTION_SECONDS_MAX}
          step={b.AUCTION_SECONDS_STEP}
          value={settings.auctionSeconds}
          disabled={!canEdit}
          onChange={(e) => net.settings({ auctionSeconds: Number(e.target.value) })}
        />
        <span className="setting-hint">
          Läuft die Zeit ab, gewinnt das Höchstgebot. Alle können gemeinsam „Zeit überspringen“ drücken.
        </span>
      </label>

      {theme?.generations && (
        <label className="setting">
          <span className="setting-head">
            Generationen
            <b>Gen 1-{settings.maxGeneration}</b>
          </span>
          <input
            type="range"
            min={1}
            max={theme.generations.max}
            step={1}
            value={settings.maxGeneration}
            disabled={!canEdit}
            onChange={(e) => net.settings({ maxGeneration: Number(e.target.value) })}
          />
          <span className={`setting-hint ${capacity.max < players ? 'warn' : ''}`}>
            {capacity.max < players
              ? `⚠ Reicht nur für ${capacity.max} Spieler - die Kategorie „${capacityLabel}“ hat zu wenige Pokémon. Mehr Generationen zulassen oder Spieler entfernen.`
              : `Reicht für bis zu ${capacity.max} Spieler (knappste Kategorie: „${capacityLabel}“).`}
          </span>
        </label>
      )}

      <label className="setting">
        <span className="setting-head">
          Geldspritze pro Runde
          <b>max. {money(settings.injectionMax)}</b>
        </span>
        <input
          type="range"
          min={b.INJECTION_MAX_MIN}
          max={b.INJECTION_MAX_MAX}
          step={b.INJECTION_MAX_STEP}
          value={settings.injectionMax}
          disabled={!canEdit}
          onChange={(e) => net.settings({ injectionMax: Number(e.target.value) })}
        />
      </label>

      <div className="setting">
        <span className="setting-head">Verteilung</span>
        <div className="mode-toggle">
          <button
            className={settings.injectionMode === 'random' ? 'selected' : ''}
            disabled={!canEdit}
            onClick={() => net.settings({ injectionMode: 'random' })}
          >
            🎲 Zufällig
            <em>10 Mio. bis Maximum</em>
          </button>
          <button
            className={settings.injectionMode === 'fixed' ? 'selected' : ''}
            disabled={!canEdit}
            onClick={() => net.settings({ injectionMode: 'fixed' })}
          >
            ⚖️ Gleich
            <em>alle bekommen das Maximum</em>
          </button>
        </div>
      </div>
    </div>
  );
}
