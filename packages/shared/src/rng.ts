/**
 * Deterministic, serialisable PRNG (mulberry32).
 *
 * The whole game engine is pure: every random decision draws from a seed that
 * lives inside GameState. That means a full game can be replayed from its seed
 * plus the action log, which is what makes the simulation harness and bug
 * reproduction possible.
 */

export interface RngState {
  seed: number;
  cursor: number;
}

export function createRng(seed: number): RngState {
  return { seed: seed >>> 0, cursor: 0 };
}

/** Returns a float in [0, 1) and advances the cursor (immutably). */
export function nextFloat(rng: RngState): [number, RngState] {
  const state = (rng.seed + 0x6d2b79f5 * (rng.cursor + 1)) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, { seed: rng.seed, cursor: rng.cursor + 1 }];
}

/** Integer in [min, max] inclusive. */
export function nextInt(rng: RngState, min: number, max: number): [number, RngState] {
  const [f, next] = nextFloat(rng);
  return [min + Math.floor(f * (max - min + 1)), next];
}

/** Fisher-Yates. Returns a new array; never mutates the input. */
export function shuffle<T>(items: readonly T[], rng: RngState): [T[], RngState] {
  const out = items.slice();
  let state = rng;
  for (let i = out.length - 1; i > 0; i--) {
    const [j, next] = nextInt(state, 0, i);
    state = next;
    [out[i], out[j]] = [out[j], out[i]];
  }
  return [out, state];
}

export function pick<T>(items: readonly T[], rng: RngState): [T, RngState] {
  const [i, next] = nextInt(rng, 0, items.length - 1);
  return [items[i], next];
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}
