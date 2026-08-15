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
  **5M** steps, and an auction clock the host sets (**1–5 minutes**). A bid in the final
  10 seconds puts 10 seconds back on the clock, so nothing can be sniped unanswerably —
  and you can still bid while the big **5-4-3-2-1** is on screen.
- Bored of waiting? Every player has a **"Zeit überspringen"** button; once everyone has
  pressed it, the clock jumps straight to the last 10 seconds.
- Every character has a public **starting bid (40M–150M)** and a **hidden score (0–100)**.
  Expensive ≠ good. Every category hides sleepers and traps (Spandam scores **3**).
- Each category holds **exactly as many characters as there are players** — so the last
  player left is simply handed the leftover at its minimum price (free if broke).
- After each category everyone gets a **cash injection** (host sets the ceiling, random or
  flat); after categories 3, 6 and 9 a **market phase** opens for same-category swaps.
- **Chat** in the lobby and in-game, with the game log woven into the same feed.
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
| Guarantee everyone ends with exactly 10 characters | Each category deals exactly one character per player; players who filled a category can't bid in it any more; the last player left is **handed the leftover** at `min(price, balance)` — free if broke; a **forced free allocation** backstops any deadlock |
| Broke players locked out | Both the last-player hand-over and the dead-cycle allocation cap the payment at the player's balance, so someone with nothing still completes their board |
| Everyone skips | Auction ends instantly; the character goes to the back of the queue at an unchanged price and the next one comes up. A full cycle without a bid is provable stasis, so the rest is allocated at the minimum price |
| Simultaneous bids | Single per-room action queue; quick-bid is a **relative** "+5M" intent, so it can't lose a race |
| Trades breaking the board | Only same-category swaps exist, so the one-per-category invariant is structural |
| Score cheating | The client bundle contains **zero** character data — scores live only on the server and are sent at the reveal |
| Same game every time | Category order and every category's deck are drawn from a per-game seed — with only N of 12–18 characters used per category, the pool differs every match |
| Endless 5-minute clocks | A unanimous **skip-time vote** cuts straight to the final 10 seconds; any new bid voids the consensus |

## Verification

```bash
npm test                       # 60 engine tests
npm run typecheck
npm run simulate -- 500 4      # balance report
npx tsx tools/smoke.ts         # 3 clients play a full game over websockets
npx tsx tools/playthrough.ts   # 2 real browsers play to the winner, with screenshots
npx tsx tools/verify-features.ts  # browser checks for settings, chat, timer, hand-over
```

Current results:

- **60/60 engine tests pass** — full games for 2–6 players, the extending hot window, the
  skip-time vote, automatic hand-over (incl. free-if-broke), chat, settings clamping,
  forced allocation, and the redaction guarantee.
- **Balance (500 games × 4 players, value-aware bots):** forced allocation **0.0%**, win
  rate by strategy balanced **34.4%** / patient **26.4%** / bargain **25.6%** / aggressive
  **13.6%** — no dominant strategy, and overpaying is punished.
- **End-to-end:** a full 10-category game over real websockets finishes with every player
  at 10/10 characters and no score leaked before the reveal; `tools/verify-features.ts`
  drives two browsers through the settings, chat, skip-time vote, countdown bidding and
  hand-over ceremony with all checks green.

## Project layout

```
packages/
  shared/    # pure TypeScript: game engine, theme data, protocol (no deps)
  server/    # Node + socket.io, one authoritative GameRoom per room
  client/    # React + Vite, canvas art, framer-motion, WebAudio sfx
tools/       # simulate.ts, smoke.ts, playthrough.ts, verify-features.ts
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
