# Grand Line Auction — One Piece Team-Builder (Planning)

A multiplayer browser game: build the strongest One Piece crew by winning live auctions
against your friends. Auction-show drama, hidden character scores, trading phases, and a
game-show style final reveal.

> **Status: Planning phase.** This repository currently contains the complete game design,
> character database draft, and technical architecture. No implementation yet — the plan
> below is the blueprint for the build.

## Documents

| Doc | Contents |
| --- | --- |
| [docs/01-game-design.md](docs/01-game-design.md) | Core concept, full rules, edge-case analysis (guaranteed completion, all-skip cycling, simultaneous bids), auction timing, economy design, trading rules |
| [docs/02-characters.md](docs/02-characters.md) | The 10 categories with rationale + full draft character database (starting bids & hidden scores) |
| [docs/03-architecture.md](docs/03-architecture.md) | Tech stack, monorepo layout, server-authoritative game engine, realtime protocol, anti-cheat, theme extensibility, asset strategy |
| [docs/04-ui-ux.md](docs/04-ui-ux.md) | Screen layouts, reveal sequences, animation & sound design, responsive behavior |
| [docs/05-roadmap.md](docs/05-roadmap.md) | Build milestones with acceptance criteria and test plan |

## The game in 30 seconds

- 2–6 players join a room. Everyone starts with **1,000,000,000 Berry**.
- The board has **10 columns** (character categories) × one row per player.
- Characters are auctioned one at a time with a dramatic pixelated reveal, live bidding
  (5M increments), a 10-second soft timer, and a 5-4-3-2-1 final countdown.
- Every character has a public **starting bid (40M–150M)** and a **hidden score (0–100)**
  — expensive does not always mean best. Sleepers and trap picks exist in every category.
- After every category each player gets a random **10M–50M cash injection**; after
  categories 3, 6 and 9 a **trading phase** opens (same-category character swaps + money).
- When all players own one character per category, a game-show **final reveal** counts up
  the hidden scores column by column. Highest total wins.

## Key design decisions (summary)

1. **Server-authoritative engine.** All bids, timers and state transitions are decided by
   the server; clients only render and send intents. Hidden scores never leave the server
   until the final reveal (anti-cheat).
2. **Guaranteed completion.** Players who already own a character in the active category
   become spectators for the rest of that category. Skipped characters cycle back into the
   deck with a **25% price decay** (floor 10M). When only one eligible player remains, the
   game switches to **Last Pick** (choose 1 of 3, pay capped at your balance — free if
   broke). A forced-allocation fallback makes deadlock mathematically impossible.
3. **Race-condition-free bidding.** Quick-bid is sent as a *relative* "+5M" intent; the
   server serializes all bids per room and resolves ties by arrival order.
4. **Theme packs.** The engine is theme-agnostic; One Piece is the first `ThemePack`
   (categories, characters, art, strings). New themes are data, not code.
5. **Stack:** TypeScript monorepo — shared pure game engine, Node + Socket.IO server,
   React + Vite + Tailwind + Framer Motion client. Single deployable process.
