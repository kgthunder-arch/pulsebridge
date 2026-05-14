import type { Server as HttpServer } from "http";

import { createClient } from "redis";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";

import { env } from "../config/env.js";
import { listConversationIdsForUser } from "../repositories/conversations.js";
import { markMessageRead } from "../repositories/messages.js";
import { findUserById, updateUserPresence } from "../repositories/users.js";
import { addReaction, removeReaction } from "../repositories/reactions.js";
import { verifyToken } from "../services/tokenService.js";
import { presenceStore } from "./presence.js";

type SignalPayload =
  | { type: "offer"; sdp: unknown; callType: "audio" | "video" }
  | { type: "answer"; sdp: unknown; callType: "audio" | "video" }
  | { type: "ice-candidate"; candidate: unknown; callType: "audio" | "video" };

const joinConversationRooms = async (socket: Server["sockets"]["sockets"] extends never ? never : any, userId: string) => {
  const conversationIds = await listConversationIdsForUser(userId);

  conversationIds.forEach((conversationId) => {
    socket.join(String(conversationId));
  });
};

export const createSocketServer = async (httpServer: HttpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: true,
      credentials: true
    }
  });

  if (env.redisUrl) {
    const pubClient = createClient({ url: env.redisUrl });
    const subClient = pubClient.duplicate();
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
  }

  presenceStore.attachIo(io);

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token) {
        next(new Error("Authentication required"));
        return;
      }

      const payload = verifyToken(token);
      const user = await findUserById(payload.sub);

      if (!user) {
        next(new Error("User not found"));
        return;
      }

      socket.data.userId = user.id;
      socket.data.username = user.username;
      next();
    } catch (error) {
      next(new Error("Authentication failed"));
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.data.userId as string;
    const username = socket.data.username as string;

    socket.join(presenceStore.room(userId));
    await joinConversationRooms(socket, userId);

    presenceStore.add(userId, socket.id);
    await updateUserPresence(userId, "online");
    io.emit("presence:update", { userId, status: "online" });

    socket.on("conversation:join", (conversationId: string) => {
      socket.join(conversationId);
    });

    socket.on("typing:start", (payload: { conversationId: string }) => {
      socket.to(payload.conversationId).emit("typing:update", {
        conversationId: payload.conversationId,
        userId,
        username,
        isTyping: true
      });
    });

    socket.on("typing:stop", (payload: { conversationId: string }) => {
      socket.to(payload.conversationId).emit("typing:update", {
        conversationId: payload.conversationId,
        userId,
        username,
        isTyping: false
      });
    });

    socket.on("message:published", (payload: { conversationId: string; message: unknown }) => {
      io.to(payload.conversationId).emit("message:new", payload.message);
    });

    socket.on("receipt:read", async (payload: { conversationId: string; messageId: string }) => {
      const readAt = await markMessageRead(payload.messageId, userId);

      if (!readAt) {
        return;
      }

      io.to(payload.conversationId).emit("receipt:update", {
        conversationId: payload.conversationId,
        messageId: payload.messageId,
        userId,
        readAt
      });
    });

    // Reactions
    socket.on(
      "reaction:add",
      async (payload: { conversationId: string; messageId: string; emoji: string }) => {
        if (!payload.emoji || payload.emoji.trim().length === 0) return;

        const reaction = await addReaction(payload.messageId, userId, payload.emoji.trim());

        if (reaction) {
          io.to(payload.conversationId).emit("reaction:update", {
            conversationId: payload.conversationId,
            messageId: payload.messageId,
            reaction
          });
        }
      }
    );

    socket.on(
      "reaction:remove",
      async (payload: { conversationId: string; messageId: string; emoji: string }) => {
        const removed = await removeReaction(payload.messageId, userId, payload.emoji.trim());

        if (removed) {
          io.to(payload.conversationId).emit("reaction:removed", {
            conversationId: payload.conversationId,
            messageId: payload.messageId,
            userId,
            emoji: payload.emoji.trim()
          });
        }
      }
    );

    // Calls
    socket.on(
      "call:initiate",
      (payload: {
        conversationId: string;
        targetUserId: string;
        callType: "audio" | "video";
      }) => {
        presenceStore.emitToUser(payload.targetUserId, "call:incoming", {
          conversationId: payload.conversationId,
          fromUserId: userId,
          fromUsername: username,
          callType: payload.callType
        });
      }
    );

    socket.on(
      "call:accept",
      (payload: { conversationId: string; targetUserId: string; callType: "audio" | "video" }) => {
        presenceStore.emitToUser(payload.targetUserId, "call:accepted", {
          conversationId: payload.conversationId,
          fromUserId: userId,
          callType: payload.callType
        });
      }
    );

    socket.on(
      "call:decline",
      (payload: { conversationId: string; targetUserId: string }) => {
        presenceStore.emitToUser(payload.targetUserId, "call:declined", {
          conversationId: payload.conversationId,
          fromUserId: userId
        });
      }
    );

    socket.on(
      "call:signal",
      (payload: {
        conversationId: string;
        targetUserId: string;
        signal: SignalPayload;
      }) => {
        presenceStore.emitToUser(payload.targetUserId, "call:signal", {
          conversationId: payload.conversationId,
          fromUserId: userId,
          signal: payload.signal
        });
      }
    );

    socket.on(
      "call:end",
      (payload: { conversationId: string; targetUserId: string }) => {
        presenceStore.emitToUser(payload.targetUserId, "call:ended", {
          conversationId: payload.conversationId,
          fromUserId: userId
        });
      }
    );

    socket.on("disconnect", async () => {
      presenceStore.remove(userId, socket.id);

      if (!presenceStore.isOnline(userId)) {
        await updateUserPresence(userId, "offline");
        io.emit("presence:update", { userId, status: "offline" });
      }
    });
  });

  return io;
};
