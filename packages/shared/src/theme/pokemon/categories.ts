import type { CategoryDef } from '../../types.js';

/**
 * Ten Pokémon categories. Every entry in the database is the FINAL evolution of
 * its line; Mega and Shiny are their own categories with their own artwork, so
 * a Pokémon can legitimately show up as itself, as its mega and as its shiny -
 * but never twice inside one category.
 */
export const POKEMON_CATEGORIES: CategoryDef[] = [
  {
    id: 'starter',
    label: 'Starter',
    title: 'Starter-Pokémon',
    icon: '🔥',
    color: '#ff8a4c',
    blurb: 'Die erste Wahl jeder Reise - in ihrer stärksten Form.',
  },
  {
    id: 'legendary',
    label: 'Legendär',
    title: 'Legendäre Pokémon',
    icon: '✨',
    color: '#f4b942',
    blurb: 'Götter, Schöpfer und Naturgewalten.',
  },
  {
    id: 'mega',
    label: 'Mega',
    title: 'Mega-Entwicklungen',
    icon: '💠',
    color: '#c3a6ff',
    blurb: 'Nur Mega-Formen. Kurzzeitig entfesselt.',
  },
  {
    id: 'pseudo',
    label: 'Pseudo',
    title: 'Pseudo-Legendäre',
    icon: '🐉',
    color: '#6ea8ff',
    blurb: 'Die 600er-Klasse: fast legendär, dafür trainierbar.',
  },
  {
    id: 'kanto151',
    label: 'Die 151',
    title: 'Die originalen 151',
    icon: '🎮',
    color: '#e63946',
    blurb: 'Kanto-Nostalgie in Reinform.',
  },
  {
    id: 'eeveelution',
    label: 'Evoli',
    title: 'Evoli-Entwicklungen',
    icon: '🦊',
    color: '#d9b382',
    blurb: 'Acht Wege, ein Evoli.',
  },
  {
    id: 'shiny',
    label: 'Shiny',
    title: 'Shiny-Formen',
    icon: '🌟',
    color: '#ffe066',
    blurb: 'Die seltenen Farbvarianten. Reines Prestige.',
  },
  {
    id: 'fossil',
    label: 'Fossil',
    title: 'Fossil-Pokémon',
    icon: '🦴',
    color: '#b0a08c',
    blurb: 'Aus Bernstein und Stein wiederbelebt.',
  },
  {
    id: 'pet',
    label: 'Begleiter',
    title: 'Kuschel-Begleiter',
    icon: '🐾',
    color: '#7ee081',
    blurb: 'Die Pokémon, die man einfach mitnehmen will.',
  },
  {
    id: 'waifu',
    label: 'Waifu',
    title: 'Waifu & Husbando',
    icon: '💖',
    color: '#f78fd4',
    blurb: 'Das Fandom hat entschieden. Wir setzen es nur um.',
  },
];

/** Starters open the game: everyone instantly gets the premise. */
export const POKEMON_OPENING_CATEGORY = 'starter';
