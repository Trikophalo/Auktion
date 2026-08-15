# 01 — Game Design

## 1. Core concept

**Grand Line Auction** is a live multiplayer auction game for 2–6 players. Each player
builds a 10-character One Piece crew — exactly one character from each of 10 categories —
by winning live auctions with a shared, limited budget. Character quality is expressed as
a **hidden score (0–100)** that is only revealed at the end, so the game is a mix of
auction tension, economic strategy, bluffing, fandom knowledge, and luck.

Design pillars (in priority order):

1. Fun even when losing — comebacks, bargains, funny trap picks, social play.
2. Smooth multiplayer — instant feedback, no desync, robust to disconnects.
3. Game-show presentation — reveals, countdowns, confetti, drama.
4. Strategic economy — overspending early must hurt; patience must be rewarded.
5. Replayability — randomized pools and category order every game.

Currency is **Berry** (One Piece's canonical currency). UI language for the MVP is
**German** (matching the reference mockup: "Aktuelle Auktion", "Startgebot"), with all
strings in a single locale file so English can be added trivially.

---

## 2. Setup

- Room of **2–6 players** (recommended 3–5; board and economy tuned for that).
- Each player starts with **1,000,000,000 Berry**.
- The board: **10 columns** (categories) × **one row per player**. Every cell will hold
  exactly one character at game end.
- Category order: **shuffled per game**, except *Legendäre Kapitäne* is always the first
  category (strong opening hook; everyone understands the game immediately).
- Per category, a **draw deck** of **exactly one character per player** is drawn at random
  from that category's full pool (12–18 characters, see doc 02).

Randomization uses a per-game server seed (Fisher-Yates). The seed is logged so a game
can be reproduced for debugging.

---

## 3. Auction round (one character)

### 3.1 Reveal sequence (~8s, server-driven timeline)

| t | Step |
| --- | --- |
| 0.0s | Category banner slams in ("KATEGORIE: SCHWERTKÄMPFER") |
| 1.5s | "STARTGEBOT: 140.000.000" stamps in with impact sound |
| 3.0s | Character image appears **extremely pixelated** (mosaic ~12px blocks) |
| 3.0–7.0s | Image de-pixelates in 6 discrete steps (each step a small "beat") |
| 7.0s | Character name banner reveals letter-by-letter |
| 8.0s | "AUKTION LÄUFT" — bidding opens |

Players may already press **SKIP** during the reveal (their skip registers when bidding
opens), but bids are only accepted from t=8.0s. Knowledgeable players will often guess
the character from the silhouette mid-reveal — that's intended fun.

### 3.2 Who may bid

Only **eligible players**: players who do **not** yet own a character in the active
category. Players who already filled the slot are spectators for the rest of the category
(they see everything, they just can't bid). This rule is essential — without it a player
could win a second character for a slot they can't use, or grief risk-free.

Consequence (intended strategy): late auctions in a category have fewer bidders, so
prices drop — waiting is a real strategy, but since the deck holds exactly one character
per player, waiting also means being handed whatever nobody else wanted (see §5).

### 3.3 Bids

- Opening bid = the character's **starting bid** (40M–150M). It never changes, however
  often the character has been passed over (§4). The first bid must be ≥ that price.
- Every subsequent bid must be **≥ current bid + 5M** and a **multiple of 5M**.
- A bid can never exceed the bidder's current balance. Bids are **binding**: the current
  high bidder cannot skip or retract (the UI hides SKIP while you lead).
- Two ways to bid:
  - **Quick-bid button** ("+5M"): sends a *relative* intent; the server computes
    `currentBid + 5M`. Immune to races — it always means "outbid whoever is leading".
  - **Custom bid**: an amount field with a stepper snapped to 5M increments. The client
    pre-validates (≥ current+5M, multiple of 5M, ≤ balance) and the server re-validates.
    If the amount is stale because someone bid in between and the custom amount is still
    higher than the new current bid, it is accepted; otherwise rejected with an
    "Überboten!" toast and a one-tap re-raise option.

### 3.4 Timer

Every auction runs on a single clock whose length the host sets in the lobby
(**1–5 minutes**, default 2). Three rules shape it:

- **The clock runs down** regardless of bidding; a bid placed early does *not* extend it.
  The remaining time is shown as mm:ss plus a ring around the portrait.
- **Hot window (final 10s):** a bid landing inside the last 10 seconds pushes the deadline
  back out to a full 10 seconds. A snipe at 0:03 gives *everyone* 10 seconds to answer, so
  no auction can be stolen unanswerably. This can repeat indefinitely — a real bidding war
  simply keeps the auction alive.
- **Final 5 seconds:** the big **5 → 4 → 3 → 2 → 1** takes over the screen. Bidding stays
  fully enabled during it — that is the point of the hot window, and the overlay is
  click-through with the bid bar untouched underneath.
- At 0: **highest bidder wins** — hammer slam, "VERKAUFT!", the card flies into the
  winner's board cell, the price is deducted with an animated counter.
- If the clock expires with **no bid at all**, the character is passed (§4).

### 3.5 "Zeit überspringen" (skip time)

A 5-minute clock is only fun while people are actually deciding. Every player has a
**skip-time button**; when **all connected players** have pressed it, the clock jumps
straight to the final 10 seconds. It is a table-wide vote, not a majority: one player who
is still thinking keeps the clock running.

Any new bid **voids the consensus** (the votes reset), because the situation everyone
agreed on has changed.

### 3.6 SKIP

- SKIP declares "I'm out **for this character**" — it is final for the current auction
  (bids only go up, so there is nothing to come back for) and shown publicly on the
  player's HUD ("passt").
- Early resolution rules (no pointless waiting):
  - If **all eligible players skip** and there is **no bid**: the auction ends instantly
    → the character **returns to the deck** (see §4).
  - If everyone except the current **high bidder** has skipped: instant resolve — 3s
    "VERKAUFT!" hammer, no countdown needed.

---

## 4. Skipped characters: cycling at a fixed price

Requirement: skipped characters are **not** removed; they must be able to reappear.

- A character passed by every eligible player goes to the **back of the queue** and the
  next character comes up immediately.
- The price **never changes**. A character is never sold below its starting bid, so
  waiting someone out costs time, not money, and there is no reward for stalling.

Because prices are static, a category that runs a **full cycle without a single bid**
cannot improve: the same characters would return at the same prices to the same wallets.
That is provable stasis, and it is exactly what triggers the allocation in §5.3 — one
cycle, not an endless loop.

---

## 5. Guaranteed completion (the game can never get stuck)

Invariant to guarantee: **every player ends the game with exactly one character in every
category**, regardless of balances or behavior. Three layered mechanisms:

### 5.1 Deck sizing: exactly one character per player
Each category deals **exactly as many characters as there are players**, drawn at random
from that category's much larger pool (12–18). Every character in the deck therefore ends
up on somebody's board, and "one player left" always means "one character left" — the two
are tied together by construction.

This is what makes the endgame of a category tense: there is no spare to fall back on, and
waiting means taking whatever the others did not want.

### 5.2 Automatic hand-over (exactly one eligible player left)
An auction with a single bidder is pointless, so when only **one** player still needs the
category, the leftover character is **handed to them automatically** at its current
starting price, capped at their balance:

    price = min(startingBid, balance)     → free if broke

It plays as a short ceremony ("LETZTER CHARAKTER DER KATEGORIE" → card → arrow → player →
price), not a dialog. Being the one who has to take the leftovers is a visible, slightly
embarrassing outcome — exactly the tone the game wants.

### 5.3 Allocation after a dead cycle
If ≥ 2 eligible players remain and a **full deck cycle** passes without a single bid, the
category enters **Zwangszuteilung**: each remaining player is dealt a random remaining
character at `min(startingBid, balance)` — the same deal as the hand-over in §5.2, so a
broke player still pays nothing.

Charging the minimum price matters: dealing these for free would hand the table an
exploit, where everyone agrees to pass on everything and collects a whole category for
nothing. At the asking price, colluding gains you only the skipped bidding war.

Simulation puts this at roughly **10% of categories** with cautious bots — it is a normal
outcome ("nobody wanted to bid above the asking price"), not an emergency brake.

### 5.4 Why a player can never be priced out forever
- Decay floors at 10M; injections give 10–50M per category; Last Pick and forced
  allocation are free-if-broke. A player at 0 Berry still completes their board.

---

## 6. Category round flow

```
CATEGORY_START (banner, deck size shown)
  └─ repeat: AUCTION (reveal → bidding → sold / all-skip cycle)
       until every player owns a character in this category
       (AUTO-ZUTEILUNG when 1 eligible player remains,
        ZWANGSZUTEILUNG if the deadlock backstop fires)
CATEGORY_END (mini-recap: who paid what this category)
MONEY_INJECTION (host-configured: a ceiling of 10M–100M, paid either as an
                 independent random roll per player or flat to everyone;
                 animated "+35.000.000" flying into each HUD)
TRADING_PHASE (only after categories 3, 6, 9 — see §8)
→ next category, or FINAL_REVEAL after category 10
```

Money injection happens after categories 1–9 (an injection after category 10 would be
dead money). Expected total injections ≈ 9 × 30M = **~270M per player**.

---

## 7. Economy design

Budget math for tuning (P players):

- Total budget per player ≈ 1,000M + ~270M injections = **~1,270M for 10 characters**
  → sustainable average price **~127M**.
- Starting bids range 40M–150M. Contested stars will go for 200M–350M in bidding wars;
  the economy balances because late-category auctions (fewer eligible bidders) and
  re-runs of an unwanted character sell at their unchanged base price.
- **Intended tension:** a player who blows 400M+ on two early stars *will* be visibly
  poor in mid-game, must hunt bargains and lean on injections/trades — painful but never
  hopeless (§5.4). That regret arc is a feature (brief §15, §20).

Balancing plan (implementation phase): a **headless simulation harness** runs thousands
of games with bot strategies (aggressive / balanced / bargain-hunter / troll-skipper) and
reports price curves, bankruptcy rates, score spreads, and how often Last Pick / forced
allocation trigger. Starting bids and the injection range are tuned against it.
Target: forced allocation < 0.1% of categories; median end-game leftover cash 50–200M
(leftover cash is worth nothing — announced up front so hoarding is a real mistake).

---

## 8. Trading phases (after categories 3, 6, 9)

- Duration: **90 seconds**, shown as a market-floor scene. All players can press
  **"Bereit"** to end early; the phase also auto-extends by up to 30s while an offer is
  awaiting a response (no rug-pulls at the buzzer).
- An offer is always a **same-category character swap** plus an optional money component
  in **either direction** (improvement over the brief: "I give Sanji + 100M for Pudding"
  *and* "I give Sanji for Pudding + 50M" are both expressible — one signed money field).
  Swap-only trading is deliberate: it preserves the core invariant that everyone always
  holds exactly one character per filled category. Pure cash-for-character sales are
  therefore not allowed in v1.
- Flow: select player → pick your character (auto-filters to categories where both sides
  own one) → pick theirs → set money slider → send. Recipient can **Accept / Reject /
  Counter** (counter swaps the editable fields and sends back). Max 3 open offers per
  player to keep the phase readable.
- Server-side escrow: balances and ownership are validated **at accept time** (not offer
  time) — an offer that is no longer affordable simply fails with a notice.
- Everything is public: trades are announced with an animation of both cards crossing the
  board plus the money amount. (Secret trading is a possible later variant; public trades
  create better table talk.)
- Since hidden scores are unknown, trading is inherently speculative — selling a "star"
  that might be a trap is the game's best bluffing surface.

---

## 9. Hidden scores & final reveal

- Every character has a hidden **score 0–100**, fixed per character (not per game),
  designed per category (see doc 02): scores correlate with starting bids (~0.8) but each
  category contains **2–3 sleepers** (cheap, high score) and **1–3 traps** (looks good or
  is famous, low score). The 300M-for-a-trap moment is a core memory the game is built
  to produce.
- Scores live **only on the server** during the game (see doc 03 — anti-cheat).
- **Final reveal** (game-show finale, ~2–4 min, host-paced with a "Weiter" button or
  auto-advance):
  1. All boards shown, cards face-up but scores hidden.
  2. Column-by-column (category order of the game): all players' cards in that column
     flip → each score pops in with a counter tick → running totals count up →
     leaderboard reorders with spring animations.
  3. Per column, the reveal calls out moments: "SCHNÄPPCHEN!" (score ≫ price paid),
     "REINFALL!" (price ≫ score) with dramatic stings.
  4. Before the last column, a deliberate pause + drumroll if the outcome is still open.
  5. Winner: spotlight, confetti/particles, "DAS BESTE TEAM! — {Name} — {Punkte} PUNKTE",
     followed by a full stats screen (best bargain of the game, worst overpay, most money
     wasted, biggest trade win).

---

## 9a. Lobby settings (host)

| Setting | Range | Default | Effect |
| --- | --- | --- | --- |
| Zeit pro Auktion | 60–300s, 30s steps | 120s | Length of every auction clock (§3.4) |
| Geldspritze pro Runde | 10M–100M, 5M steps | 50M | Ceiling of the post-category injection |
| Verteilung | zufällig / gleich | zufällig | Random rolls 10M…ceiling per player; fixed pays the ceiling to everyone |

Settings are live-synced to every player in the lobby and locked once the game starts, so
nobody is surprised by the rules mid-game. All values are clamped server-side.

## 9b. Chat

A chat is available in the lobby (panel) and in-game (collapsible dock with an unread
badge), with one-tap quick phrases. The engine writes **system lines** into the same feed
("Ruffy ersteigert Shanks für 140 Mio.", trades, free hand-overs), so it doubles as a game
log that survives a reconnect.

## 10. Multiplayer conduct rules

- **Disconnects:** the seat is held for the whole game. A disconnected player is
  auto-treated as **skipping** every auction (after a 10s grace period per auction) and
  auto-resolves Last Pick randomly; injections still accrue. Reconnection (session token)
  restores the seat with a full state snapshot at any time.
- **AFK/griefing:** identical treatment — every decision point has a server-side timeout
  that resolves to the passive option (skip / offer expires). The game always advances.
  Offline players are also excluded from the skip-time vote, so one dropped connection
  cannot block the table.
- **Host:** the room creator starts the game and can kick in the lobby only. Mid-game
  there is no kick (a kicked player's board would break the invariant); an abandoned
  seat just runs on timeouts. If the host disconnects, host rights migrate to the next
  player (only relevant for lobby and reveal pacing).

---

## 11. Edge cases — explicit resolutions

| # | Case | Resolution |
| --- | --- | --- |
| 1 | Two bids arrive "simultaneously" | Server serializes per room; first accepted wins, second is validated against the *new* state and usually rejected ("Überboten!") with one-tap re-raise. Quick-bids are relative, so they almost never reject. |
| 2 | Bid arrives during the final countdown | Accepted, and it resets the clock to 10s (§3.4). Bidding is never disabled while the auction is open; only the server's expiry tick closes it. |
| 3 | All eligible players skip, no bid | Instant resolve; the character goes to the back of the queue at an unchanged price and the next one is shown. |
| 4 | All but high bidder skip | Instant "VERKAUFT!" (3s hammer), no countdown. |
| 5 | Only one eligible player left in category | Automatic hand-over at min(price, balance) (§5.2) — no solo auctions. |
| 6 | Full deck cycle with zero sales | Allocation at min(price, balance) (§5.3) — provable stasis, resolved in one cycle. |
| 7 | Player balance 0 with unfilled slots | Still receives the automatic hand-over (free at 0 balance) or forced allocation. Never stuck. |
| 8 | Bid > balance | Rejected client- and server-side. |
| 9 | High bidder tries to skip | Impossible — bids are binding, UI hides SKIP while leading. |
| 10 | Trade accepted after balance changed | Re-validated at accept; fails gracefully with notice. |
| 11 | Trade would leave a category slot empty | Impossible by construction — only same-category swaps exist. |
| 12 | Player disconnects mid-auction while high bidder | Their bid stands (binding). If they win, they pay and the card is placed normally. |
| 13 | Deck exhausted mid-category | Cannot happen (§5.1) — the deck holds exactly one character per player and skips return to it. |
| 14 | Duplicate characters across categories | Forbidden by data model: each character belongs to exactly one category (see doc 02 for the assignment rules, e.g. Mihawk is a Schwertkämpfer, not a Warlord). |
