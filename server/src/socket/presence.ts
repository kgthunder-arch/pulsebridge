import type { Server } from "socket.io";

type UserConnectionMap = Map<string, Set<string>>;

class PresenceStore {
  private readonly connections: UserConnectionMap = new Map();
  private io: Server | null = null;

  attachIo(io: Server) {
    this.io = io;
  }

  add(userId: string, socketId: string) {
    const sockets = this.connections.get(userId) ?? new Set<string>();
    sockets.add(socketId);
    this.connections.set(userId, sockets);
  }

  remove(userId: string, socketId: string) {
    const sockets = this.connections.get(userId);
    if (!sockets) {
      return;
    }

    sockets.delete(socketId);

    if (sockets.size === 0) {
      this.connections.delete(userId);
      return;
    }

    this.connections.set(userId, sockets);
  }

  isOnline(userId: string) {
    return this.connections.has(userId);
  }

  room(userId: string) {
    return `user:${userId}`;
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    this.io?.to(this.room(userId)).emit(event, payload);
  }
}

export const presenceStore = new PresenceStore();

