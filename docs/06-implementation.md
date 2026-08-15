# 06 — Implementation Notes

What was actually built, where each rule lives, and where reality differed from the plan.

## 1. Where the rules live

Every game rule is in `packages/shared/src/engine/` as a **pure reducer**. The server
executes it; nothing else may mutate state.

| File | Owns |
| --- | --- |
| `reduce.ts` | The state machine: phases, auction lifecycle, category flow, trading actions, reveal. The single entry point `reduce(state, action) → {state, events, timer}` |
| `helpers.ts` | Eligibility (`eligiblePlayers`, `pendingPlayers`), `minNextBid` |
| `setup.ts` | Game creation, shuffled category order, per-category decks |
| `economy.ts` | Cash injections, score totals, end-of-game awards |
| `trading.ts` | Offer validation (`checkTrade`) and execution |
| `../view.ts` | **The redaction boundary** — the only shape clients ever see |
| `../constants.ts` | Every tunable number (bid step, timings, injection range, deadlock rule) |

Purity buys three things: the 78 engine tests need no mocks, the balance simulator reuses
the exact production rules, and a game is replayable from `(seed, action log)`.

**Timers as data.** The reducer never calls `setTimeout`; it *requests* a delay
(`timer: {ms}`) and `GameRoom` schedules it, feeding the resulting `TICK` back through the
same queue as player actions. That is why a timer expiry and a bid can never interleave
badly — they are strictly ordered.

## 2. How the completion guarantee is enforced

`beginNextAuction()` in `reduce.ts` is the whole guarantee in one function:

```
0 eligible players  → category ends
a dead full cycle   → allocate the rest at min(price, balance)
1 eligible player   → hand the leftover over (never a solo auction)
otherwise           → draw the next character, run a real auction
```

Supported by: a deck of exactly one character per player; passed characters returning to
the back of the queue at an unchanged price; and `min(price, balance)` payment in both the
last-player hand-over and the dead-cycle allocation, so a broke player always completes.
Because prices never move, one full cycle without a bid is provable stasis - the engine
allocates instead of looping. Tested by `tests/engine.test.ts` → *completion guarantee*
and the full-game tests for 2-6 players, including a game where every player always skips.

## 3. Anti-cheat: scores never reach the browser

Two mechanisms, belt and braces:

1. `packages/shared/src/index.ts` (the client-safe entry) **does not export the engine or
   the character database**. Only `@gla/shared/server` does, and the Vite config aliases
   only the client-safe entry — the server module is not resolvable from the browser.
2. `view.ts:toClientState()` strips `hiddenScore` from everything, and only adds scores for
   reveal columns the server has already announced.

Verified on the built bundle: `hiddenScore` appears **0** times, and no character name
appears at all — the client receives the catalog from the server at runtime.

## 4. Deviations from the plan

| Planned | Built | Why |
| --- | --- | --- |
| Character art hotlinked from the web | **Local files for One Piece, CDN URLs for Pokémon, procedural art as the universal fallback** | Anime databases block hotlinking and send no CORS header, which the canvas reveal requires. One Piece art is served locally from `public/assets/characters`; Pokémon uses the PokéAPI sprite CDN, which does send `Access-Control-Allow-Origin`. Anything that fails to load falls back to the procedural portrait, so a dead URL never breaks the board. |
| Howler.js sound sprites | **WebAudio synthesis** (`store/sound.ts`) | No assets to license or load, works offline, and the effects can react to the game — bid pitch rises with each raise, the countdown heartbeat drops in pitch as it approaches zero. |
| Tailwind CSS | **Plain CSS** with custom properties | The UI is almost entirely bespoke components; a utility framework earned nothing here and added a build dependency. |
| Fastify | **Node `http` + socket.io** | The only HTTP needs are `/healthz` and serving the client build. Fewer moving parts. |
| Framer Motion, React, Vite, Zustand, seeded RNG, pure engine | as planned | — |

## 5. Verification

| Check | Command | Result |
| --- | --- | --- |
| Engine rules | `npm test` | 78/78 pass |
| Types | `npm run typecheck` | clean |
| Balance | `npm run simulate -- 500 4` | see below |
| Multiplayer over sockets | `npx tsx tools/smoke.ts` | full game, 3 clients, no leaks |
| Real browsers, full game | `npx tsx tools/playthrough.ts` | lobby → reveal, no page errors |

### Balance report (500 games × 4 players, value-aware bots)

```
Erwerb              Auktion 70.0% · Auto-Zuteilung 20.0% · Zwangszuteilung 10.0%
Ökonomie            Restgeld Median 415 Mio. · 4.0% enden bei 0 Berry (alle komplett)
Punkte              ⌀ 618 · Spanne Sieger↔Letzter 125 Punkte (Median)
Siegquote           balanced 34.0% · patient 27.0% · bargain 24.8% · aggressive 14.2%
```

Reading it:

- **Leftover cash is high (415 Mio. median)** because every player is guaranteed one
  character per category: you bid to get a *better* one, not to get *any*, which softens
  competition. A starting-capital setting would be the lever if that ever needs tightening.
- **Zwangszuteilung ~10%** is a normal outcome since prices no longer fall: when nobody
  bids above the asking price for a whole cycle, the rest is allocated at that price.
- **Auto-Zuteilung ~20-25%** is structural, not a flaw: with 4 players, one player per
  category is always the last one standing. It is a designed moment, not a fallback.
- **No dominant strategy** (34.0 / 27.0 / 24.8 / 14.2) is the key result, and overpaying
  is punished: leftover cash scores nothing, but so does an overpriced roster.

## 6. Known gaps / next steps

- **Reveal pacing** is host-driven with an 8s auto-advance; a "dramatic pause before the
  final column" is planned but not special-cased yet.
- **Counter-offers** work as new offers referencing the original; a threaded negotiation
  view would read better than two separate trays.
- **No persistence** — a server restart drops in-flight games (rooms are in memory).
  A Redis snapshot of `GameState` is a drop-in addition since state is plain data.
- **Mobile** is usable (tabbed layout, thumb-zone bid bar) but the board is best on a
  tablet or larger.
- The Pokémon sprite CDN is an external runtime dependency. It sends CORS headers and every
  generated URL was checked (189/189 → 200), but a self-host script would remove the
  dependency entirely if it ever proves flaky.
