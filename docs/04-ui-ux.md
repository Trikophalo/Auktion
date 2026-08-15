# 04 — UI / UX & Animation Design

## 1. Art direction

- **"Anime game show":** deep ocean-blue gradient backdrop with subtle drifting clouds /
  wave parallax (nod to the reference image), high-contrast cream card faces, thick
  rounded borders, chunky display font for numbers (game-show ticker feel), warm gold for
  money, red accent for the auction stage ("Aktuelle Auktion" energy from the mockup).
- Dark, cinematic base so reveals and particles pop; light text.
- Every number that changes **counts** (tween), never snaps.
- Improvements over the reference mockup: real character portraits instead of emoji
  placeholders, a live auction stage with bid history, per-player money always visible,
  and a clear "whose turn is it to sweat" focus state.

## 2. Screens

### 2.1 Lobby
- Big title + ship background. Create room → 6-char code with copy-link; join via code
  or link. Name + avatar pick (12 preset chibi avatars). Player list with ready states.
- Host sees a fat **"SPIEL STARTEN"** button; rules digest in a side panel ("So wird
  gespielt" — 5 bullet points, because friends *will* join without reading anything).

### 2.2 Main game screen (desktop layout)

```
┌────────────────────────────────────────────────┬──────────────────────┐
│  TEAM BOARD (≈65%)                             │  AUCTION STAGE (≈35%)│
│  ┌──────┬────┬────┬────┬────┬─────────────┐    │  ┌────────────────┐  │
│  │Player│ 👑 │ ⚔️ │ 🍳 │ …  │ (10 columns)│    │  │ "AKTUELLE      │  │
│  ├──────┼────┼────┼────┼────┼─────────────┤    │  │  AUKTION"      │  │
│  │ HUD  │card│card│ ·  │ ·  │             │    │  │  [character    │  │
│  │ HUD  │card│ ·  │ ·  │ ·  │             │    │  │   portrait]    │  │
│  │ HUD  │card│card│ ·  │ ·  │             │    │  │  name/epithet  │  │
│  └──────┴────┴────┴────┴────┴─────────────┘    │  │  STARTGEBOT    │  │
│  Active category column glows; empty cells     │  │  AKTUELLES     │  │
│  in it pulse softly.                           │  │  GEBOT + bidder│  │
│                                                │  │  bid history   │  │
│  BID BAR (bottom, fixed):                      │  │  countdown ring│  │
│  [ +5M GEBOT ]  [ custom amount ⌃⌄ ] [ SKIP ]  │  └────────────────┘  │
└────────────────────────────────────────────────┴──────────────────────┘
```

- **Player HUD** (left rail cell per row): avatar, name, animated balance
  ("850 Mio" compact; full "850.000.000 ฿" on hover), characters-collected pips (n/10),
  live status chip: 🔨 leading bid / 💤 skipped / 👁 spectating (slot filled) / 🔌 offline.
- **Board cells:** face-up mini character cards (portrait + name + price paid). Hover →
  enlarged card tooltip. Scores are *never* shown pre-reveal.
- **Money format:** `40 Mio` / `1,2 Mrd` compact everywhere; full dotted format
  (`150.000.000`) for the big auction numbers where drama wants digits.

### 2.3 Trading phase
Full-screen overlay "MARKTPHASE — 90s": player pods around a table; drag-your-card onto
a player (or tap-tap on mobile) → offer builder modal (my card | their card | signed
money slider) → outgoing/incoming offer trays with Accept / Reject / Counter buttons.
Accepted trades animate both cards flying across the table with a coin burst. "Bereit"
button per player; timer bar on top.

### 2.4 Final reveal
Cinematic full-screen: all boards stacked, camera pans per category column; cards flip
one row at a time, score chips slam in, totals tick up, leaderboard bars race and
reorder with springs; "SCHNÄPPCHEN!"/"REINFALL!" stingers on outliers; drumroll pause
before the final column; winner spotlight → confetti cannons → "DAS BESTE TEAM!" +
stats screen (best bargain, worst overpay, most cash left, biggest trade win).
Host paces with "Weiter" (auto-advance after 8s so nobody is hostage).

## 3. Animation inventory (mapped to implementation)

| Moment | Effect | Tech |
| --- | --- | --- |
| Category start | Banner slam + board column glow | Framer Motion spring + CSS glow |
| Starting bid | Stamp-in with dust puff + "thump" | keyframes + Howler |
| Character reveal | 6-step de-pixelation with beat ticks | canvas downscale/upscale, `image-rendering: pixelated` |
| Name reveal | Letterbox wipe, letter-by-letter | Framer stagger |
| Bid accepted | Amount punches up (scale pop), bidder chip flashes, bid-history row slides in | spring + layout animation |
| Outbid (you) | Red shake on your bid bar + "Überboten!" toast with re-raise button | keyframes |
| Soft timer | Thin ring drains around portrait | SVG stroke-dashoffset |
| Countdown 5→0 | Full-stage number slams, heartbeat, vignette pulse, slight zoom on portrait | Framer + CSS filter |
| Sold | Hammer slam, white flash, card shrinks & flies along a curve into the winner's cell, cell lands with bounce; balance counts down | Framer `layoutId` flight + counter tween |
| All skipped | Card grays out, spins away back into a deck stack ("Kommt später wieder…" + decayed price tag) | Framer presence |
| Injection | Coin burst per HUD, "+35.000.000" floats up, balance counts up | particles + tween |
| Trade done | Two cards cross mid-air + coin arc | Framer flight |
| Last Pick | Spotlight dims board, 3 cards fan out, picked card enlarges | presence + stagger |
| Forced allocation | Slot-machine spin over remaining cards | CSS ticker |
| Reveal/winner | Flips, counting totals, racing bars, confetti cannons, glow | Framer + canvas-confetti |
| Micro | Button press depress, hover lift, focus rings, subtle idle float on the auction portrait | CSS only |

Rules: transforms/opacity only (60fps), every animation interruptible, total added
latency to *gameplay-critical* feedback ≤ 100ms (drama lives in reveals, not in bids),
`prefers-reduced-motion` swaps big effects for fades.

## 4. Sound design (all CC0/self-made)

stamp thump · reveal beat tick · bid "pop" (pitch rises with price!) · overbid buzz ·
heartbeat countdown · hammer + crowd "oooh" · coin shower (injection/trade) ·
sad trombone (trap reveal) · fanfare (winner). Master mute + volume in settings,
persisted; audio unlocked on first tap (mobile requirement).

## 5. Responsive strategy

- **Desktop (≥1100px):** full layout above.
- **Tablet (700–1100px):** auction stage docks top-right smaller; board scrolls
  horizontally with snap columns; active category auto-scrolled into view.
- **Mobile (≤700px, usable not perfect):** tab layout — "Auktion" (stage + bid bar,
  the default), "Board" (pinch/scroll grid), "Spieler". Bid bar is a fixed bottom
  thumb-zone: giant **+5M** button, amount stepper, SKIP behind a slide-to-confirm
  (prevents fat-finger skips). Countdown and sold moments overlay every tab so nothing
  critical is missable.
- Touch targets ≥ 44px; board virtualized only if perf demands (6×10 cards is fine).

## 6. UX guardrails

- Bid controls disable instantly on countdown end (no ghost-bid frustration); server
  rejection always paired with a helpful toast.
- Custom bid field snaps to valid 5M steps as you type; shows "= +15 Mio über Gebot".
- Confirm dialog only for bids ≥ 50% of balance ("Wirklich ALLES reinwerfen?") — big
  bids should feel scary, small bids frictionless.
- Everything important is also text (color-blind safe): leader chip says "Höchstgebot",
  not just a color.
- New-round recap toast keeps returning/backgrounded players oriented ("Kategorie 4/10 —
  Marines. 2 Spieler brauchen noch einen Charakter.").
