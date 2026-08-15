# ⚓ Grand Line Auction

A multiplayer browser game: build the strongest One Piece crew by winning live auctions
against your friends. Auction-show drama, hidden character scores, trading phases, and a
game-show style final reveal.

**Playable.** Server-authoritative multiplayer, 138 characters, 10 categories, full
auction/trading/reveal loop.

```bash
npm install
npm run dev      # server on :3000, client on :5173 (hot reload)
# or, production-style:
npm run build && npm start   # everything on http://localhost:3000
```

## Deploy for free (Render)

The server keeps game state (rooms, timers, WebSocket connections) in memory, so it needs
a persistent Node process — not a serverless platform like Vercel. Render's free web
service tier fits without any code changes.

**One-click:** open [render.com/deploy](https://render.com/deploy?repo=https://github.com/Trikophalo/Auktion)
and point it at this repo — `render.yaml` in the repo root configures everything.

**Manual:**
1. [render.com](https://render.com) → New → Web Service → connect this GitHub repo.
2. Branch: `claude/one-piece-auction-game-plan-8wpcia`
3. Build command: `npm install && npm run build`
4. Start command: `npm start`
5. Plan: **Free**

Render gives you a permanent `https://<name>.onrender.com` URL to share. Free-tier caveat:
the service sleeps after 15 minutes with no traffic and takes ~30-50s to wake up on the
next visit — fine for occasional game nights, not for an always-on server.

Open the URL, create a room, share the 6-character code (or the invite link) with 1–5
friends, and start.

## The game in 30 seconds

- 2–6 players. Everyone starts with **1,000,000,000 Berry**.
- The board is **10 columns** (character categories) × one row per player. You need
  exactly one character per category.
- Characters are auctioned one at a time: a dramatic pixelated reveal, live bidding in
  **5M** steps, a 10-second soft timer, then a **5-4-3-2-1** countdown.
- Every character has a public **starting bid (40M–150M)** and a **hidden score (0–100)**.
  Expensive ≠ good. Every category hides sleepers and traps (Spandam scores **3**).
- After each category everyone gets **10–50M**; after categories 3, 6 and 9 a **market
  phase** opens for same-category swaps plus money.
- When every board is full, the **final reveal** flips the scores column by column, counts
  totals up, and reorders the leaderboard live. Highest total wins.

## Documentation

| Doc | Contents |
| --- | --- |
| [docs/01-game-design.md](docs/01-game-design.md) | Full rules and the edge-case analysis (completion guarantee, cycling, race conditions) |
| [docs/02-characters.md](docs/02-characters.md) | The 10 categories + the full 138-character database with bids and hidden scores |
| [docs/03-architecture.md](docs/03-architecture.md) | Stack, engine design, protocol, anti-cheat, theme extensibility |
| [docs/04-ui-ux.md](docs/04-ui-ux.md) | Screen layouts, reveal choreography, animation and sound design |
| [docs/05-roadmap.md](docs/05-roadmap.md) | Milestones, what is built, what is deliberately left for later |
| [docs/06-implementation.md](docs/06-implementation.md) | How the code is organised, where the rules live, verification results |

## How the tricky rules were solved

| Problem | Solution |
| --- | --- |
| Guarantee everyone ends with exactly 10 characters | Players who filled a category can't bid in it any more; when only one player still needs it they get **Last Pick** (1 of 3, paying `min(price, balance)` — free if broke); a **forced free allocation** backstop makes deadlock impossible |
| Broke players locked out | Skipped characters return **25% cheaper** (floor 10M), plus 10–50M per category, plus free-if-broke picks. Simulation: 7.6% of players end at 0 Berry — *all* still complete their board |
| Everyone skips | Auction ends instantly, character re-enters the deck at a random position, cheaper |
| Simultaneous bids | Single per-room action queue; quick-bid is a **relative** "+5M" intent, so it can't lose a race |
| Trades breaking the board | Only same-category swaps exist, so the one-per-category invariant is structural |
| Score cheating | The client bundle contains **zero** character data — scores live only on the server and are sent at the reveal |
| Same game every time | Category order and every category's deck are shuffled from a per-game seed |

## Verification

```bash
npm test                       # 46 engine tests
npm run typecheck
npm run simulate -- 400 4      # balance report
npx tsx tools/smoke.ts         # 3 clients play a full game over websockets
npx tsx tools/playthrough.ts   # 2 real browsers play to the winner, with screenshots
```

Current results:

- **46/46 engine tests pass** — including full games for 2, 3, 4, 5 and 6 players, a game
  where every player always skips, forced allocation, and the redaction guarantee.
- **Balance (400 games × 4 players):** average winning bid **133 Mio.**, forced allocation
  **0.0%**, median leftover cash **110 Mio.**, win rate by strategy aggressive **34.5%** /
  balanced **32.0%** / patient **30.3%** — no dominant strategy.
- **End-to-end:** a full 10-category game over real websockets finishes with every player
  at 10/10 characters and no score leaked before the reveal.

## Project layout

```
packages/
  shared/    # pure TypeScript: game engine, theme data, protocol (no deps)
  server/    # Node + socket.io, one authoritative GameRoom per room
  client/    # React + Vite, canvas art, framer-motion, WebAudio sfx
tools/       # simulate.ts, smoke.ts, playthrough.ts, screenshots.ts
docs/        # design, characters, architecture, UI, roadmap, implementation
```

## Adding artwork

The game ships with procedurally generated portraits (deterministic per character), so it
never looks broken. To use real images, map character ids to URLs or local files in
`CHARACTER_IMAGES` in `packages/shared/src/theme/one-piece/characters.ts` — game logic
never touches image data, and any image that fails to load falls back to the generated art.

## Adding a theme

The engine only ever sees category and character **ids**. A new theme is a `ThemePack`
(categories, characters, colours, strings) registered in
`packages/shared/src/theme/index.ts` — no engine changes. A boot-time validator rejects
malformed themes (wrong category count, duplicate ids, out-of-range bids, pools too small).
