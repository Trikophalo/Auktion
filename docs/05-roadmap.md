# 05 — Build Roadmap

Milestones are vertical slices — each ends in something runnable. Estimates assume
focused implementation sessions; the engine-first order means the risky logic is testable
before any polish exists.

## M1 — Foundation & lobby (skeleton that two browsers can join)
- Monorepo scaffolding (shared/server/client), TypeScript, Vite, Fastify+Socket.IO,
  Tailwind, CI check (typecheck + vitest).
- `shared/protocol.ts`, seeded RNG, ThemePack interface + One Piece pack loading with
  the boot-time validator (pool sizes, unique IDs/categories, bid ranges).
- Room manager: create/join/rejoin with seat tokens, lobby screen, avatars, host start.
- ✅ *Accept:* two browsers join a room, see each other live, survive a refresh.

## M2 — Auction core loop (the game's heart, one category)
- Engine: phases CATEGORY_START → AUCTION_* with bid validation, quick-bid, skip,
  soft timer + countdown as timer-commands, sold/passed resolution, price decay,
  eligibility, Last Pick, forced allocation. **Full unit-test suite for doc 01 §11.**
- Client: board grid, player HUDs, auction stage, bid bar, reveal sequence
  (pixelation), countdown overlay, sold flight animation (basic version).
- ✅ *Accept:* 3 players complete a full category incl. all-skip cycling and Last Pick;
  race test (two clients spam quick-bid) never desyncs; engine tests green.

## M3 — Full game loop & database
- All 10 categories with shuffled order, injections, category recap, complete 138-
  character database with images + fallback cards, redaction layer (scores server-only).
- Disconnect handling (auto-skip, grace timers), snapshot recovery, stateVersion gap
  detection.
- ✅ *Accept:* full 10-category game start-to-finish with a disconnect/rejoin mid-game;
  client bundle contains zero `hiddenScore` data (checked by a build assertion).

## M4 — Trading
- Engine: offer lifecycle, escrow validation at accept, counters, phase timer +
  extensions, ready-out.
- Client: trading overlay, offer builder, trays, trade animations.
- ✅ *Accept:* simulated + manual trades incl. counter chains and stale-balance rejects.

## M5 — Final reveal & polish pass
- Reveal choreography (column flips, counting totals, racing leaderboard, outlier
  stingers, winner celebration, stats/awards screen), sound set + settings,
  micro-interactions, reduced-motion support.
- ✅ *Accept:* the reveal demos well with hidden scores producing ≥1 surprise swing.

## M6 — Balance, responsive, hardening
- `tools/simulate.ts`: 10k bot games → tune bids/scores/decay/injections to the targets
  in doc 01 §7 (forced allocation <0.1%, healthy leftover-cash median, sleeper teams
  can win).
- Tablet/mobile layouts, touch bid bar, Playwright smoke (lobby → 1 category → reveal),
  Dockerfile + deploy, room GC, rate limits.
- ✅ *Accept:* balance report in repo; playable on a phone; deployed URL friends can hit.

## Later (explicitly out of v1)
- Second theme pack (villains category exists as ready-made content, doc 02 §4) and
  lobby theme picker · spectator mode & replays (action log already supports it) ·
  bot fill-ins for odd player counts · persistence across server restarts (Redis) ·
  EN locale · secret trading variant · custom lobby rules (budget, timer lengths).

## Test plan summary
- **Engine unit tests** (Vitest): every edge case in doc 01 §11 + property test
  ("any action sequence → all boards complete, no negative balance, no duplicate
  character ownership").
- **Simulation**: economy/balance regression, deadlock hunting with adversarial bots.
- **E2E** (Playwright, 2 headless clients): happy path + refresh-rejoin + bid race.
- **Manual playtest scripts**: 3 sessions (3P desktop, 5P mixed devices, 2P mobile)
  with a feedback checklist tied to the design pillars (fun-when-losing, drama, clarity).
