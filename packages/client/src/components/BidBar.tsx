import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { RULES, TIMINGS, money, moneyFull } from '@gla/shared';
import { useGame } from '../store/game';
import { net } from '../net/socket';
import { useCountdown } from '../fx/hooks';

/**
 * The bid controls.
 *
 * Invalid bids are made unreachable rather than merely rejected: the stepper
 * only moves in 5M steps, the amount is clamped to what the player owns, and
 * SKIP disappears while they are the high bidder (bids are binding).
 *
 * Crucially, bidding stays enabled all the way through the big countdown - a
 * bid in the final seconds is exactly the moment the rules are built around.
 */
export function BidBar() {
  const state = useGame((s) => s.state)!;
  const me = useGame((s) => s.me())!;
  const auction = state.auction;
  const [custom, setCustom] = useState<number | null>(null);
  const [shake, setShake] = useState(false);
  const remaining = useCountdown(state.deadline);

  const category = state.categoryOrder[state.categoryIndex];
  const isBidding = state.phase === 'auction_open';
  const alreadyOwns = Boolean(me.roster[category]);
  const hasSkipped = auction?.skipped.includes(me.id) ?? false;
  const isLeader = auction?.leaderId === me.id;
  const hot = isBidding && remaining <= TIMINGS.HOT_WINDOW;

  const minBid = auction ? (auction.currentBid === 0 ? auction.startingBid : auction.currentBid + RULES.BID_STEP) : 0;
  const canAfford = me.money >= minBid;
  const canAct = isBidding && !alreadyOwns && !hasSkipped && !isLeader;

  // Time-skip is a table-wide vote: everyone connected has to want it.
  const timeVotes = auction?.timeSkips.length ?? 0;
  const votersNeeded = state.players.filter((p) => p.connected).length;
  const iVotedTime = auction?.timeSkips.includes(me.id) ?? false;

  // Reset the custom amount whenever the minimum moves past it.
  useEffect(() => {
    setCustom((value) => (value === null || value < minBid ? null : value));
  }, [minBid]);

  // Flash the bar when someone outbids us.
  useEffect(() => {
    if (auction?.leaderId && auction.leaderId !== me.id) {
      const wasMine = auction.bids.slice(0, -1).at(-1)?.playerId === me.id;
      if (wasMine) {
        setShake(true);
        const id = setTimeout(() => setShake(false), 500);
        return () => clearTimeout(id);
      }
    }
  }, [auction?.bids.length, auction?.leaderId, me.id]);

  const amount = custom ?? minBid;
  const step = (delta: number) => {
    const next = Math.max(minBid, Math.min(me.money - (me.money % RULES.BID_STEP), amount + delta * RULES.BID_STEP));
    setCustom(next);
  };

  const submit = () => {
    if (!canAct || amount > me.money) return;
    // Big commitments deserve a second of hesitation - but never in the final
    // seconds, where a confirm dialog would cost you the auction.
    if (
      !hot &&
      amount > me.money * RULES.BIG_BID_CONFIRM_RATIO &&
      !confirm(`${moneyFull(amount)} bieten? Das ist mehr als die Hälfte deines Vermögens.`)
    ) {
      return;
    }
    net.bid(amount);
    setCustom(null);
  };

  if (alreadyOwns && isBidding) {
    return (
      <div className="bidbar spectating">
        <span className="spectate-note">
          ✓ Du hast bereits einen Charakter in dieser Kategorie - lehn dich zurück und schau zu.
        </span>
        <TimeSkipButton voted={iVotedTime} votes={timeVotes} needed={votersNeeded} disabled={!isBidding} />
      </div>
    );
  }

  return (
    <motion.div
      className={`bidbar ${hot ? 'hot' : ''}`}
      animate={shake ? { x: [0, -10, 10, -6, 0] } : { x: 0 }}
      transition={{ duration: 0.45 }}
    >
      <div className="bidbar-info">
        {isLeader ? (
          <span className="you-lead">🔨 Du führst mit {money(auction!.currentBid)}</span>
        ) : hasSkipped ? (
          <span className="you-skipped">Du hast gepasst</span>
        ) : canAfford ? (
          <span className="min-note">Mindestgebot <b>{money(minBid)}</b></span>
        ) : (
          <span className="broke">Zu wenig Berry für dieses Gebot</span>
        )}
      </div>

      <div className="bidbar-controls">
        <button className={`btn quick ${hot ? 'urgent' : ''}`} disabled={!canAct || !canAfford} onClick={() => net.quickBid()}>
          <span className="quick-label">Bieten</span>
          <span className="quick-amount">{money(minBid)}</span>
        </button>

        <div className="stepper">
          <button className="btn step" disabled={!canAct || amount <= minBid} onClick={() => step(-1)} aria-label="Weniger">
            −
          </button>
          <div className="stepper-value">
            <span className="stepper-amount">{moneyFull(amount)}</span>
            <span className="stepper-delta">
              {amount > minBid ? `+${money(amount - minBid)} über Minimum` : 'Minimum'}
            </span>
          </div>
          <button
            className="btn step"
            disabled={!canAct || amount + RULES.BID_STEP > me.money}
            onClick={() => step(1)}
            aria-label="Mehr"
          >
            +
          </button>
          <button className="btn custom" disabled={!canAct || amount > me.money} onClick={submit}>
            Gebot abgeben
          </button>
        </div>

        <TimeSkipButton voted={iVotedTime} votes={timeVotes} needed={votersNeeded} disabled={!isBidding || hot} />

        {!isLeader && (
          <button className="btn skip" disabled={!canAct} onClick={() => net.skip()}>
            Passen
          </button>
        )}
      </div>
    </motion.div>
  );
}

function TimeSkipButton({
  voted,
  votes,
  needed,
  disabled,
}: {
  voted: boolean;
  votes: number;
  needed: number;
  disabled: boolean;
}) {
  return (
    <button
      className={`btn time-skip ${voted ? 'voted' : ''}`}
      disabled={disabled || voted}
      onClick={() => net.skipTime()}
      title="Wenn alle zustimmen, springt die Auktion auf die letzten 10 Sekunden."
    >
      <span className="ts-label">⏩ Zeit überspringen</span>
      <span className="ts-count">
        {votes}/{needed}
      </span>
    </button>
  );
}
