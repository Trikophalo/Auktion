import type { Server } from 'socket.io';
import { GameRoom } from './gameRoom.js';

/** Unambiguous alphabet: no O/0, no I/1. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_TTL_MS = 30 * 60 * 1000;

export class RoomManager {
  private rooms = new Map<string, GameRoom>();

  constructor(private readonly io: Server) {
    setInterval(() => this.sweep(), 60_000).unref?.();
  }

  create(themeId = 'one-piece'): GameRoom {
    let code = this.generateCode();
    while (this.rooms.has(code)) code = this.generateCode();
    const room = new GameRoom(code, this.io, themeId);
    this.rooms.set(code, room);
    return room;
  }

  get(code: string): GameRoom | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  get count(): number {
    return this.rooms.size;
  }

  private generateCode(): string {
    let code = '';
    for (let i = 0; i < 6; i++) code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    return code;
  }

  /** Drops rooms that have been abandoned; games in progress are kept alive. */
  private sweep(): void {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      const stale = now - room.lastActivity > ROOM_TTL_MS;
      if (stale && room.isEmpty) {
        room.dispose();
        this.rooms.delete(code);
      }
    }
  }
}
