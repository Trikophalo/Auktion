import type { CharacterDef, CharacterPublic, ThemePack } from '../types.js';
import { RULES } from '../constants.js';
import { CATEGORIES, OPENING_CATEGORY } from './one-piece/categories.js';
import { CHARACTERS, CHARACTER_IMAGES } from './one-piece/characters.js';

export const ONE_PIECE: ThemePack = {
  id: 'one-piece',
  title: 'Grand Line Auction',
  tagline: 'Ersteigere die stärkste Crew der Welt',
  currency: { symbol: '฿', name: 'Berry' },
  categories: CATEGORIES,
  characters: CHARACTERS.map((c) => ({ ...c, image: CHARACTER_IMAGES[c.id] })),
  openingCategory: OPENING_CATEGORY,
};

const THEMES: Record<string, ThemePack> = {
  [ONE_PIECE.id]: ONE_PIECE,
};

export function getTheme(id: string): ThemePack {
  const theme = THEMES[id];
  if (!theme) throw new Error(`Unknown theme: ${id}`);
  return theme;
}

export function listThemes(): { id: string; title: string; tagline: string }[] {
  return Object.values(THEMES).map((t) => ({ id: t.id, title: t.title, tagline: t.tagline }));
}

/** Strips the hidden score - this is the only shape clients ever receive. */
export function toPublic(character: CharacterDef): CharacterPublic {
  const { hiddenScore, ...pub } = character;
  void hiddenScore;
  return pub;
}

/**
 * Boot-time validation. A malformed theme must fail loudly at startup, never
 * halfway through a live game.
 */
export function validateTheme(theme: ThemePack): void {
  const errors: string[] = [];

  if (theme.categories.length !== 10) {
    errors.push(`expected 10 categories, got ${theme.categories.length}`);
  }

  const ids = new Set<string>();
  for (const ch of theme.characters) {
    if (ids.has(ch.id)) errors.push(`duplicate character id: ${ch.id}`);
    ids.add(ch.id);

    if (!theme.categories.some((cat) => cat.id === ch.category)) {
      errors.push(`${ch.id} references unknown category ${ch.category}`);
    }
    if (ch.hiddenScore < 0 || ch.hiddenScore > 100) {
      errors.push(`${ch.id} hiddenScore out of range: ${ch.hiddenScore}`);
    }
    if (ch.startingBid % RULES.BID_STEP !== 0) {
      errors.push(`${ch.id} startingBid is not a multiple of the bid step`);
    }
    if (ch.startingBid < 40_000_000 || ch.startingBid > 150_000_000) {
      errors.push(`${ch.id} startingBid out of the 40M-150M range`);
    }
  }

  for (const cat of theme.categories) {
    const pool = theme.characters.filter((c) => c.category === cat.id);
    // The completion guarantee relies on every pool outnumbering the players.
    if (pool.length < RULES.MAX_PLAYERS + 6) {
      errors.push(`category ${cat.id} has only ${pool.length} characters (need >= ${RULES.MAX_PLAYERS + 6})`);
    }
  }

  if (theme.openingCategory && !theme.categories.some((c) => c.id === theme.openingCategory)) {
    errors.push(`openingCategory ${theme.openingCategory} does not exist`);
  }

  if (errors.length) {
    throw new Error(`Theme "${theme.id}" is invalid:\n  - ${errors.join('\n  - ')}`);
  }
}

export { CATEGORIES, CHARACTERS };
