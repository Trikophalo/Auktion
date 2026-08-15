import type { CharacterDef, CharacterPublic, ThemePack } from '../types.js';
import { RULES } from '../constants.js';
import { CATEGORIES, OPENING_CATEGORY } from './one-piece/categories.js';
import { CHARACTERS, CHARACTER_IMAGES } from './one-piece/characters.js';
import { POKEMON_CATEGORIES, POKEMON_OPENING_CATEGORY } from './pokemon/categories.js';
import { POKEMON_CHARACTERS } from './pokemon/characters.js';

export const ONE_PIECE: ThemePack = {
  id: 'one-piece',
  title: 'Grand Line Auction',
  tagline: 'Ersteigere die stärkste Crew der Welt',
  blurb: '138 Charaktere aus One Piece - von Ruffy bis Spandam.',
  icon: '🏴‍☠️',
  currency: { symbol: '฿', name: 'Berry' },
  categories: CATEGORIES,
  characters: CHARACTERS.map((c) => ({ ...c, image: CHARACTER_IMAGES[c.id] })),
  openingCategory: OPENING_CATEGORY,
};

export const POKEMON: ThemePack = {
  id: 'pokemon',
  title: 'Pokémon Auction',
  tagline: 'Ersteigere das coolste Team aller Zeiten',
  blurb: 'Starter, Legendäre, Megas & Shinys aus Gen 1-7.',
  icon: '⚡',
  currency: { symbol: '₽', name: 'Pokédollar' },
  categories: POKEMON_CATEGORIES,
  characters: POKEMON_CHARACTERS,
  openingCategory: POKEMON_OPENING_CATEGORY,
  generations: { max: 7, label: 'Generation' },
};

const THEMES: Record<string, ThemePack> = {
  [ONE_PIECE.id]: ONE_PIECE,
  [POKEMON.id]: POKEMON,
};

export function getTheme(id: string): ThemePack {
  const theme = THEMES[id];
  if (!theme) throw new Error(`Unknown theme: ${id}`);
  return theme;
}

export interface ThemeSummary {
  id: string;
  title: string;
  tagline: string;
  blurb: string;
  icon: string;
  characterCount: number;
  generations?: { max: number; label: string };
}

export function listThemes(): ThemeSummary[] {
  return Object.values(THEMES).map((t) => ({
    id: t.id,
    title: t.title,
    tagline: t.tagline,
    blurb: t.blurb,
    icon: t.icon,
    characterCount: t.characters.length,
    generations: t.generations,
  }));
}

/** Strips the hidden score - this is the only shape clients ever receive. */
export function toPublic(character: CharacterDef): CharacterPublic {
  const { hiddenScore, ...pub } = character;
  void hiddenScore;
  return pub;
}

/**
 * The characters a game actually draws from, after the host's era filter.
 * Themes without generations ignore the setting entirely.
 */
export function charactersFor(theme: ThemePack, maxGeneration: number): CharacterDef[] {
  if (!theme.generations) return theme.characters;
  return theme.characters.filter((c) => (c.generation ?? 1) <= maxGeneration);
}

/**
 * How many players a given era filter can support: every category needs at
 * least one character per player, so the smallest category is the ceiling.
 */
export function playerCapacity(theme: ThemePack, maxGeneration: number): { max: number; tightest: string } {
  const pool = charactersFor(theme, maxGeneration);
  let max = Infinity;
  let tightest = '';
  for (const category of theme.categories) {
    const size = pool.filter((c) => c.category === category.id).length;
    if (size < max) {
      max = size;
      tightest = category.id;
    }
  }
  return { max: Number.isFinite(max) ? max : 0, tightest };
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
    if (theme.generations) {
      if (!ch.generation) errors.push(`${ch.id} is missing a generation`);
      else if (ch.generation < 1 || ch.generation > theme.generations.max) {
        errors.push(`${ch.id} generation ${ch.generation} outside 1-${theme.generations.max}`);
      }
    }
  }

  for (const cat of theme.categories) {
    const pool = theme.characters.filter((c) => c.category === cat.id);
    // A deck deals one character per player, so a full pool must cover a full table.
    if (pool.length < RULES.MAX_PLAYERS) {
      errors.push(`category ${cat.id} has only ${pool.length} characters (need >= ${RULES.MAX_PLAYERS})`);
    }
  }

  if (theme.openingCategory && !theme.categories.some((c) => c.id === theme.openingCategory)) {
    errors.push(`openingCategory ${theme.openingCategory} does not exist`);
  }

  if (errors.length) {
    throw new Error(`Theme "${theme.id}" is invalid:\n  - ${errors.join('\n  - ')}`);
  }
}

export function validateAllThemes(): void {
  for (const theme of Object.values(THEMES)) validateTheme(theme);
}

export { CATEGORIES, CHARACTERS };
