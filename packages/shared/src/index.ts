/**
 * Client-safe surface.
 *
 * IMPORTANT: this module must never re-export the character database or the
 * engine, because everything reachable from here ends up in the browser bundle.
 * Hidden scores live behind `@gla/shared/server` only.
 */

export * from './types.js';
export * from './constants.js';
export * from './format.js';
export * from './protocol.js';
export type { ClientState, ClientPlayer, ClientAuction, ThemeInfo } from './view.js';
