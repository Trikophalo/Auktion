import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { RULES, money, moneyFull } from '@gla/shared';
import { useGame } from '../store/game';
import { net } from '../net/socket';
import { useCountdown } from '../fx/hooks';
import { CharacterArt } from './../components/CharacterArt';

/**
 * Market phase.
 *
 * Only same-category swaps exist (plus a signed money component), which keeps
 * every player at exactly one character per category no matter what they agree.
 */
export function Trading() {
  const state = useGame((s) => s.state)!;
  const me = useGame((s) => s.me())!;
  const remaining = useCountdown(state.trading?.endsAt ?? null);

  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [offerMoney, setOfferMoney] = useState(0);

  const partners = state.players.filter((p) => p.id !== me.id);
  const partner = partners.find((p) => p.id === partnerId) ?? null;

  // Only categories where BOTH sides already own a character can be traded.
  const tradableCategories = useMemo(() => {
    if (!partner) return [];
    return state.categoryOrder.filter((cat) => me.roster[cat] && partner.roster[cat]);
  }, [partner, me.roster, state.categoryOrder]);

  const activeCategory = categoryId && tradableCategories.includes(categoryId) ? categoryId : tradableCategories[0] ?? null;
  const myChar = activeCategory ? me.roster[activeCategory] : undefined;
  const theirChar = activeCategory && partner ? partner.roster[activeCategory] : undefined;

  const incoming = (state.trading?.offers ?? []).filter((o) => o.toId === me.id && o.status === 'open');
  const outgoing = (state.trading?.offers ?? []).filter((o) => o.fromId === me.id && o.status === 'open');

  const send = () => {
    if (!partner || !myChar || !theirChar) return;
    net.tradeOffer({
      toId: partner.id,
      giveCharacterId: myChar.characterId,
      wantCharacterId: theirChar.characterId,
      money: offerMoney,
    });
    setOfferMoney(0);
  };

  return (
    <motion.div className="overlay trading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="trading-shell">
        <header className="trading-head">
          <div>
            <h2 className="overlay-title">MARKTPHASE</h2>
            <p className="overlay-sub">Tausche Charaktere derselben Kategorie - Geld darf in beide Richtungen fließen.</p>
          </div>
          <div className="trading-timer">
            <span className="t-value">{Math.ceil(remaining / 1000)}</span>
            <span className="t-label">Sekunden</span>
          </div>
        </header>

        <div className="trading-body">
          {/* ------------------------------------------------ offer builder */}
          <section className="trade-builder">
            <h3>Angebot erstellen</h3>

            <div className="partner-picker">
              {partners.map((p) => (
                <button
                  key={p.id}
                  className={`partner ${p.id === partnerId ? 'selected' : ''}`}
                  onClick={() => {
                    setPartnerId(p.id);
                    setCategoryId(null);
                  }}
                >
                  <span className="p-avatar">{p.avatar}</span>
                  <span className="p-name">{p.name}</span>
                  <span className="p-money">{money(p.money)}</span>
                </button>
              ))}
            </div>

            {partner && tradableCategories.length === 0 && (
              <p className="hint">Ihr habt noch keine gemeinsame Kategorie zum Tauschen.</p>
            )}

            {partner && tradableCategories.length > 0 && (
              <>
                <div className="category-tabs">
                  {tradableCategories.map((cat) => (
                    <button
                      key={cat}
                      className={`cat-tab ${cat === activeCategory ? 'selected' : ''}`}
                      onClick={() => setCategoryId(cat)}
                    >
                      {useGame.getState().categoryLabel(cat)}
                    </button>
                  ))}
                </div>

                <div className="swap-row">
                  <TradeSide label="Du gibst" characterId={myChar?.characterId} />
                  <div className="swap-arrows">⇄</div>
                  <TradeSide label={`${partner.name} gibt`} characterId={theirChar?.characterId} />
                </div>

                <div className="money-slider">
                  <label>
                    Geld:{' '}
                    <b className={offerMoney > 0 ? 'pay' : offerMoney < 0 ? 'ask' : ''}>
                      {offerMoney === 0
                        ? 'kein Zuschlag'
                        : offerMoney > 0
                          ? `du zahlst ${moneyFull(offerMoney)}`
                          : `du forderst ${moneyFull(-offerMoney)}`}
                    </b>
                  </label>
                  <input
                    type="range"
                    min={-Math.floor(partner.money / RULES.BID_STEP) * RULES.BID_STEP}
                    max={Math.floor(me.money / RULES.BID_STEP) * RULES.BID_STEP}
                    step={RULES.BID_STEP}
                    value={offerMoney}
                    onChange={(e) => setOfferMoney(Number(e.target.value))}
                  />
                </div>

                <button className="btn primary big" disabled={!myChar || !theirChar} onClick={send}>
                  Angebot senden
                </button>
              </>
            )}
          </section>

          {/* ------------------------------------------------------- offers */}
          <section className="trade-offers">
            <h3>Eingehende Angebote {incoming.length > 0 && <span className="badge">{incoming.length}</span>}</h3>
            <AnimatePresence>
              {incoming.map((offer) => (
                <OfferCard key={offer.id} offerId={offer.id} incoming />
              ))}
            </AnimatePresence>
            {incoming.length === 0 && <p className="hint">Noch keine Angebote für dich.</p>}

            <h3>Deine Angebote</h3>
            <AnimatePresence>
              {outgoing.map((offer) => (
                <OfferCard key={offer.id} offerId={offer.id} />
              ))}
            </AnimatePresence>
            {outgoing.length === 0 && <p className="hint">Du hast nichts angeboten.</p>}
          </section>
        </div>

        <footer className="trading-foot">
          <button className={`btn ${me.ready ? 'ok' : 'primary'} big`} onClick={() => net.tradeReady()} disabled={me.ready}>
            {me.ready ? '✓ Bereit - warte auf die anderen' : 'Fertig mit Handeln'}
          </button>
          <span className="ready-count">
            {state.trading?.readyPlayers.length ?? 0}/{state.players.length} bereit
          </span>
        </footer>
      </div>
    </motion.div>
  );
}

function TradeSide({ label, characterId }: { label: string; characterId?: string }) {
  const character = useGame((s) => s.character(characterId));
  const theme = useGame((s) => s.theme)!;
  const accent = theme.categories.find((c) => c.id === character?.category)?.color ?? '#888';

  return (
    <div className="trade-side">
      <span className="side-label">{label}</span>
      <CharacterArt character={character} accent={accent} width={140} height={165} />
      <span className="side-name">{character?.name ?? '—'}</span>
    </div>
  );
}

function OfferCard({ offerId, incoming = false }: { offerId: string; incoming?: boolean }) {
  const state = useGame((s) => s.state)!;
  const characters = useGame((s) => s.characters);
  const offer = state.trading?.offers.find((o) => o.id === offerId);
  if (!offer) return null;

  const from = state.players.find((p) => p.id === offer.fromId);
  const to = state.players.find((p) => p.id === offer.toId);
  const give = characters.get(offer.giveCharacterId);
  const want = characters.get(offer.wantCharacterId);

  return (
    <motion.div
      className="offer-card"
      initial={{ x: incoming ? -30 : 30, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
    >
      <div className="offer-head">
        {incoming ? `${from?.avatar} ${from?.name} bietet:` : `An ${to?.avatar} ${to?.name}:`}
      </div>
      <div className="offer-body">
        <span className="offer-give">{incoming ? give?.name : give?.name}</span>
        <span className="offer-arrow">⇄</span>
        <span className="offer-want">{want?.name}</span>
      </div>
      {offer.money !== 0 && (
        <div className="offer-money">
          {offer.money > 0
            ? `${incoming ? from?.name : 'Du'} legt ${moneyFull(offer.money)} drauf`
            : `${incoming ? from?.name : 'Du'} fordert ${moneyFull(-offer.money)}`}
        </div>
      )}
      <div className="offer-actions">
        {incoming ? (
          <>
            <button className="btn ok small" onClick={() => net.tradeRespond(offer.id, 'accept')}>
              Annehmen
            </button>
            <button className="btn small" onClick={() => net.tradeRespond(offer.id, 'reject')}>
              Ablehnen
            </button>
            <button
              className="btn ghost small"
              onClick={() =>
                net.tradeOffer({
                  toId: offer.fromId,
                  giveCharacterId: offer.wantCharacterId,
                  wantCharacterId: offer.giveCharacterId,
                  money: -offer.money,
                  counterOf: offer.id,
                })
              }
            >
              Gegenangebot
            </button>
          </>
        ) : (
          <button className="btn ghost small" onClick={() => net.tradeRespond(offer.id, 'cancel')}>
            Zurückziehen
          </button>
        )}
      </div>
    </motion.div>
  );
}
