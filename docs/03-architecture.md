# 03 — Technical Architecture

## 1. Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Language | **TypeScript everywhere** | One type system across client/server/shared engine |
| Monorepo | **npm workspaces** (no extra tooling) | 3 packages, minimal ceremony |
| Server | **Node 22 + Fastify + Socket.IO** | Rooms, auto-reconnect, fallbacks, battle-tested |
| Client | **React 18 + Vite** | Fast dev loop, huge animation ecosystem |
| State (client) | **Zustand** | Tiny, selector-based — perfect for event-driven game state |
| Styling | **Tailwind CSS v4** + CSS custom properties for theme tokens | Speed + consistent design system |
| Animation | **Framer Motion** (layout/spring/presence) + CSS keyframes + canvas confetti | Covers card flights, counters, reveals |
| Sound | **Howler.js** | Sprite sheets, mobile unlock handling |
| Persistence | **In-memory rooms** (v1) | Games are 30–60 min; a Redis snapshot layer is a later drop-in for server restarts |
| Testing | **Vitest** (engine unit tests + simulation harness), Playwright smoke test | The engine is pure → trivially testable |
| Deploy | Single Node process serves API + WebSocket + built client; Dockerfile; works on Fly.io/Render/Railway | One URL, zero CORS pain |

Deliberately avoided: Colyseus/boardgame.io (less control over the auction timer
choreography than a purpose-built reducer), any database (nothing needs to survive a
week), SSR/Next (this is an app, not a site).

## 2. Repository layout

```
/
├── package.json                  # workspaces: shared, server, client
├── packages/
│   ├── shared/                   # ⭐ pure TS — zero runtime deps
│   │   └── src/
│   │       ├── engine/           # game state machine (pure reducer)
│   │       │   ├── state.ts      # GameState types + invariant helpers
│   │       │   ├── actions.ts    # PlayerAction / SystemAction unions
│   │       │   ├── reduce.ts     # (state, action) → {state, events, timers}
│   │       │   ├── auction.ts    # bid validation, countdown logic, decay
│   │       │   ├── completion.ts # eligibility, Last Pick, forced allocation
│   │       │   ├── trading.ts    # offer lifecycle + escrow validation
│   │       │   ├── economy.ts    # balances, injections, formatting
│   │       │   └── scoring.ts    # totals, reveal ordering, awards (Schnäppchen etc.)
│   │       ├── themes/
│   │       │   ├── theme.ts      # ThemePack interface
│   │       │   └── one-piece/    # categories.ts, characters.json, strings.de.json
│   │       ├── protocol.ts       # socket event names + payload types (single source of truth)
│   │       └── rng.ts            # seeded PRNG + Fisher-Yates
│   ├── server/
│   │   └── src/
│   │       ├── index.ts          # Fastify + Socket.IO bootstrap, serves client build
│   │       ├── roomManager.ts    # create/join/rejoin, 6-char codes, seat tokens
│   │       ├── gameRoom.ts       # owns one GameState + timer scheduler + action queue
│   │       ├── timers.ts         # cancellable named timers (softTimer, countdown, …)
│   │       └── views.ts          # redaction: GameState → per-player ClientState
│   └── client/
│       └── src/
│           ├── net/              # socket wrapper, reconnect, event → store dispatch
│           ├── store/            # zustand stores: game, ui, sound
│           ├── screens/          # Lobby, Game, TradingPhase, FinalReveal
│           ├── components/       # Board, AuctionStage, BidControls, PlayerHUD, …
│           ├── fx/               # confetti, particles, pixelate shader, counters
│           └── i18n/             # de.json (en later)
├── tools/
│   ├── simulate.ts               # headless bot games → balance report (doc 01 §7)
│   └── fetch-assets.ts           # optional: download images → local webp + rewrite refs
└── docs/
```

## 3. The engine: server-authoritative pure reducer

The entire ruleset lives in `shared/engine` as a **pure function**:

```ts
reduce(state: GameState, action: Action): {
  state: GameState;
  events: ServerEvent[];      // what to broadcast (already redaction-tagged)
  timers: TimerCommand[];     // {set|cancel, name, ms, thenAction} — side effects as data
}
```

- **Purity = testability.** Every edge case in doc 01 §11 becomes a unit test with no
  mocks. The simulation harness reuses the exact production rules.
- **Timers as data.** The reducer never calls `setTimeout`; it *requests* timers
  (`{set: "countdown", ms: 1000, thenAction: {type: "COUNTDOWN_TICK"}}`). `gameRoom.ts`
  executes them and feeds the resulting SystemActions back through the same queue —
  so timer expiry and player bids are serialized identically and races are impossible
  by construction.
- **Single writer per room.** All actions (socket + timer) go through one FIFO queue per
  room; Node's single thread + the queue give strict total ordering. Tie-breaking for
  "simultaneous" bids is arrival order, deterministically.
- **Seeded RNG in state.** Shuffles/injections draw from a PRNG whose seed is in
  `GameState` → full-game replay from an action log (debugging + potential spectator
  replays later).

### State machine (phases)

```
LOBBY → CATEGORY_START → AUCTION_INTRO → AUCTION_OPEN ⇄ AUCTION_COUNTDOWN
      → AUCTION_RESOLVED ─┬→ (next auction | LAST_PICK | FORCED_ALLOCATION)
                          └→ CATEGORY_END → INJECTION → [TRADING] → CATEGORY_START…
      → FINAL_REVEAL → GAME_END
```

Each phase whitelists which PlayerActions are legal; everything else is rejected with a
typed error. Phase + deadline are part of state, so reconnects render mid-countdown
correctly.

## 4. Protocol (Socket.IO, typed end-to-end)

All names/payloads in `shared/protocol.ts` — client and server import the same types.

**Client → server (intents):**
`room:create {name, avatar}` · `room:join {code, name, avatar}` · `room:rejoin {token}` ·
`game:start` · `auction:quickBid` *(relative +5M — race-immune)* ·
`auction:bid {amount}` *(absolute, validated)* · `auction:skip` ·
`lastPick:choose {characterId}` · `trade:offer {to, give, want, money}` ·
`trade:accept|reject|counter {offerId, …}` · `trade:ready` · `reveal:advance` *(host)*

**Server → client (events):**
`room:state` *(full redacted snapshot — on join/rejoin/desync)* ·
`auction:intro {category, startingBid, decayedFrom?, revealTimeline}` ·
`auction:imageStep {step}` · `auction:nameReveal {name, epithet}` ·
`auction:bidAccepted {playerId, amount}` · `auction:bidRejected {reason, currentBid}` ·
`auction:playerSkipped {playerId}` · `auction:countdown {n}` ·
`auction:sold {playerId, amount, characterPublic}` · `auction:passed {cycledToDeck: true}` ·
`lastPick:options {characters[]}` · `category:end {recap}` ·
`economy:injection {perPlayer: {playerId, amount}[]}` ·
`trade:*` lifecycle events · `reveal:column {category, cells: {playerId, score, delta}[]}` ·
`game:end {finalBoard, awards, winner}` · `player:connection {playerId, online}`

**Snapshot + events model:** every event also bumps a `stateVersion`; clients detect gaps
(missed event while backgrounded on mobile) and request a fresh `room:state`. This makes
the client stateless-recoverable at any moment — the core of "robust multiplayer".

## 5. Anti-cheat / trust boundaries

- **Hidden scores never reach the client** during play: `views.ts` redacts
  `hiddenScore` from every payload; the character JSON bundled into the client build
  contains **no score field at all** (scores live in a server-only file). Reveal events
  carry scores only at FINAL_REVEAL.
- The deck order, upcoming characters, and other players' pending trade drafts are
  likewise server-only.
- All economic rules enforced server-side; the client's validation is UX sugar only.
- Rate limiting per socket (bids ≤ 5/s) to keep button-mashers from flooding.

## 6. Rooms, identity, reconnection

- Room = 6-character code (no accounts). On join, the server issues a **seat token**
  (stored in localStorage) → refresh/crash/phone-lock rejoins the same seat seamlessly
  with a full snapshot.
- Disconnected seats: game continues on timeouts (doc 01 §10); seat reserved until game
  end; lobby seats expire after 2 min.
- Rooms are garbage-collected 15 min after game end or when empty.

## 7. Theme extensibility

```ts
interface ThemePack {
  id: string;                      // "one-piece"
  title: string;                   // "Grand Line Auction"
  currency: {name: string; format(n: number): string}; // "Berry", "150 Mio"
  categories: CategoryDef[10];     // id, label, icon, blurb
  characters: CharacterDef[];      // ≥12 per category, unique ids, unique category each
  strings: Partial<Strings>;       // theme-flavored UI text overrides
  artTokens: ThemeArt;             // colors, backgrounds, fonts, sfx set
}
```

The engine only ever sees `categoryId`/`characterId` + numbers — **a new theme is pure
data + assets, zero engine changes**. A startup validator asserts pool sizes, bid ranges,
unique IDs, and single-category membership so bad theme data fails fast at boot, not
mid-game. v1 registers only the One Piece pack; the lobby's theme picker stays hidden
until a second pack exists.

## 8. Asset strategy (images & sound)

- Character records point at remote image URLs with a **local-override path** (doc 02 §5);
  `tools/fetch-assets.ts` can mirror everything into `client/public/assets` and rewrite
  refs — one command to go fully self-hosted when hotlinking proves unreliable or for
  licensing hygiene. Every card has a **guaranteed fallback** (styled silhouette +
  initial) so a dead URL never breaks the show.
- The pixelation reveal is done client-side from the full image (canvas downscale →
  upscale with `image-rendering: pixelated`, 6 steps) — no need to pre-generate blurred
  variants, and the server just announces timeline steps.
- Sounds as one Howler sprite (~10 short effects: stamp, tick, heartbeat, hammer, coin,
  whoosh, fanfare, sad-trombone for traps). Ship with CC0/self-made sounds only.

## 9. Performance & limits

- Payloads are tiny (bids are ~40 bytes); one room ≈ 6 sockets; a single small instance
  comfortably runs hundreds of rooms. No scaling work needed for v1 (Socket.IO Redis
  adapter is the known path if ever needed).
- Client perf: animations on transform/opacity only; particle effects capped and
  disabled via `prefers-reduced-motion`; images lazy-loaded per category.
