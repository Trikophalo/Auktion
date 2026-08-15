# 06 — Implementation Notes

What was actually built, where each rule lives, and where reality differed from the plan.

## 1. Where the rules live

Every game rule is in `packages/shared/src/engine/` as a **pure reducer**. The server
executes it; nothing else may mutate state.

| File | Owns |
| --- | --- |
| `reduce.ts` | The state machine: phases, auction lifecycle, category flow, trading actions, reveal. The single entry point `reduce(state, action) → {state, events, timer}` |
| `helpers.ts` | Eligibility (`eligiblePlayers`, `pendingPlayers`), `minNextBid`, price decay |
| `setup.ts` | Game creation, shuffled category order, per-category decks |
| `economy.ts` | Cash injections, score totals, end-of-game awards |
| `trading.ts` | Offer validation (`checkTrade`) and execution |
| `../view.ts` | **The redaction boundary** — the only shape clients ever see |
| `../constants.ts` | Every tunable number (bid step, decay, timings, injection range) |

Purity buys three things: the 46 engine tests need no mocks, the balance simulator reuses
the exact production rules, and a game is replayable from `(seed, action log)`.

**Timers as data.** The reducer never calls `setTimeout`; it *requests* a delay
(`timer: {ms}`) and `GameRoom` schedules it, feeding the resulting `TICK` back through the
same queue as player actions. That is why a timer expiry and a bid can never interleave
badly — they are strictly ordered.

## 2. How the completion guarantee is enforced

`beginNextAuction()` in `reduce.ts` is the whole guarantee in one function:

```
0 eligible players  → category ends
too many dead ends  → forced allocation (free characters)
1 eligible player   → Last Pick (never a solo auction)
otherwise           → draw the next character, run a real auction
```

Supported by: pools of ≥ 12 per category (validated at boot) against ≤ 6 buyers; skipped
characters returning to the deck 25% cheaper (floor 10M); `min(price, balance)` payment in
Last Pick. Tested by `tests/engine.test.ts` → *completion guarantee* and the full-game
tests for 2–6 players, including a game where every player always skips.

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
| Character art hotlinked from the web | **Procedurally generated canvas portraits** + a `CHARACTER_IMAGES` override map | The image hosts are blocked by this environment's egress policy. The art is deterministic per character (colour, silhouette, hat style, monogram), looks intentional rather than placeholder, and is drawn on canvas — which makes the pixelated reveal *real* pixelation rather than a blur filter. Dropping in real URLs later is a one-line data change. |
| Howler.js sound sprites | **WebAudio synthesis** (`store/sound.ts`) | No assets to license or load, works offline, and the effects can react to the game — bid pitch rises with each raise, the countdown heartbeat drops in pitch as it approaches zero. |
| Tailwind CSS | **Plain CSS** with custom properties | The UI is almost entirely bespoke components; a utility framework earned nothing here and added a build dependency. |
| Fastify | **Node `http` + socket.io** | The only HTTP needs are `/healthz` and serving the client build. Fewer moving parts. |
| Framer Motion, React, Vite, Zustand, seeded RNG, pure engine | as planned | — |

## 5. Verification

| Check | Command | Result |
| --- | --- | --- |
| Engine rules | `npm test` | 46/46 pass |
| Types | `npm run typecheck` | clean |
| Balance | `npm run simulate -- 400 4` | see below |
| Multiplayer over sockets | `npx tsx tools/smoke.ts` | full game, 3 clients, no leaks |
| Real browsers, full game | `npx tsx tools/playthrough.ts` | lobby → reveal, no page errors |

### Balance report (400 games × 4 players)

```
Auktionspreise      ⌀ 133 Mio. · Median 130 Mio. · 10/90% 70/190 Mio. · Max 345 Mio.
Erwerb              Auktion 75.0% · Letzte Wahl 25.0% · Zwangszuteilung 0.0%
Ökonomie            Restgeld Median 110 Mio. · 7.6% enden bei 0 Berry (alle komplett)
Punkte              ⌀ 562 · Spanne Sieger↔Letzter 159 Punkte (Median)
Siegquote           aggressive 34.5% · balanced 32.0% · patient 30.3% · bargain 3.3%
```

Reading it:

- **133 Mio. average** against a ~1,270 Mio. lifetime budget for 10 characters is right at
  the sustainable line — bidding wars are affordable but genuinely cost you later.
- **Forced allocation 0.0%** confirms price decay does the work; the backstop is there for
  correctness, not for gameplay.
- **Last Pick 25%** is structural, not a flaw: with 4 players, one player per category is
  always the last one standing. It is a designed moment, not a fallback.
- **No dominant strategy** (34.5 / 32.0 / 30.3) is the key result. Pure hoarding
  (`bargain`, 3.3%) loses badly — leftover cash is worth nothing, exactly as intended.

## 6. Known gaps / next steps

- **Reveal pacing** is host-driven with an 8s auto-advance; a "dramatic pause before the
  final column" is planned but not special-cased yet.
- **Counter-offers** work as new offers referencing the original; a threaded negotiation
  view would read better than two separate trays.
- **No persistence** — a server restart drops in-flight games (rooms are in memory).
  A Redis snapshot of `GameState` is a drop-in addition since state is plain data.
- **Mobile** is usable (tabbed layout, thumb-zone bid bar) but the board is best on a
  tablet or larger.
- A second theme pack is data-only work; the villains category drafted in doc 02 §4 is the
  obvious first expansion.
