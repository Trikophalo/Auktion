import type { CategoryDef } from '../../types.js';

/**
 * Ten categories, chosen so that (a) each holds at least 12 viable characters,
 * (b) no character fits two of them, and (c) the mix balances raw power with
 * charm - the comedy categories produce the best auction moments.
 */
export const CATEGORIES: CategoryDef[] = [
  {
    id: 'captains',
    label: 'Kapitäne',
    title: 'Legendäre Kapitäne',
    icon: '👑',
    color: '#f4b942',
    blurb: 'Die Krone jeder Crew. Wer hier spart, spart am falschen Ende.',
  },
  {
    id: 'commanders',
    label: 'Kommandos',
    title: 'Rechte Hände & Kommandanten',
    icon: '🥈',
    color: '#8ab4f8',
    blurb: 'Die loyalen Monster neben dem Thron.',
  },
  {
    id: 'swordsmen',
    label: 'Schwerter',
    title: 'Schwertkämpfer',
    icon: '⚔️',
    color: '#5dd6c0',
    blurb: 'Klingen, Duelle und die besten Kämpfe der Grand Line.',
  },
  {
    id: 'marines',
    label: 'Marine',
    title: 'Marines',
    icon: '⚓',
    color: '#6ea8ff',
    blurb: 'Admiräle, Helden - und ein sehr nutzloser Leutnant.',
  },
  {
    id: 'specialists',
    label: 'Spezialisten',
    title: 'Crew-Spezialisten',
    icon: '🧭',
    color: '#a78bfa',
    blurb: 'Navigatoren, Scharfschützen, Archäologen, Schiffszimmerer, Musiker.',
  },
  {
    id: 'cooks',
    label: 'Köche',
    title: 'Köche',
    icon: '🍳',
    color: '#ff9f6e',
    blurb: 'Ein Superstar, viel Comedy - und mindestens eine Katastrophe.',
  },
  {
    id: 'doctors',
    label: 'Ärzte',
    title: 'Ärzte & Heiler',
    icon: '🩺',
    color: '#7ee081',
    blurb: 'Vom Chirurgen des Todes bis zum kleinen Rentier.',
  },
  {
    id: 'agents',
    label: 'Agenten',
    title: 'Agenten & Attentäter',
    icon: '🕵️',
    color: '#c3a6ff',
    blurb: 'CP9, CP0 und Baroque Works. Verrat inklusive.',
  },
  {
    id: 'revolutionaries',
    label: 'Revolution',
    title: 'Revolutionäre',
    icon: '🔥',
    color: '#ff7a7a',
    blurb: 'Dragons Schattenarmee gegen die Weltregierung.',
  },
  {
    id: 'royals',
    label: 'Adel',
    title: 'Königshäuser & Adel',
    icon: '👸',
    color: '#f78fd4',
    blurb: 'Prinzessinnen, Könige - und zwei antike Waffen in aller Öffentlichkeit.',
  },
];

/** The game always opens with captains: everyone instantly understands the game. */
export const OPENING_CATEGORY = 'captains';
