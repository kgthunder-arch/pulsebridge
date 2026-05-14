import { Router } from "express";

import { authMiddleware, type AuthedRequest } from "../middleware/auth.js";
import {
  createConversation,
  ensureRoomCatalogue,
  findConversationByIdForUser,
  findDirectConversation,
  findRoomById,
  joinRoom,
  leaveRoom,
  listDiscoverableRooms,
  listJoinedConversations,
  touchConversation
} from "../repositories/conversations.js";
import { createMessage, listMessagesForConversation } from "../repositories/messages.js";
import { areUsersFriends, findUserById } from "../repositories/users.js";
import { serializeConversation, serializeMessage } from "../services/serializers.js";
import { presenceStore } from "../socket/presence.js";

const router = Router();

router.use(authMiddleware);

router.get("/", async (request: AuthedRequest, response) => {
  await ensureRoomCatalogue(request.auth!.id);

  const joinedConversations = await listJoinedConversations(request.auth!.id);
  const rooms = await listDiscoverableRooms(request.auth!.id);

  response.json({
    conversations: await Promise.all(joinedConversations.map(serializeConversation)),
    discoverableRooms: await Promise.all(rooms.map(serializeConversation))
  });
});

router.post("/direct", async (request: AuthedRequest, response) => {
  const { targetUserId } = request.body ?? {};

  if (!targetUserId) {
    response.status(400).json({ error: "targetUserId is required." });
    return;
  }

  const targetUser = await findUserById(String(targetUserId));

  if (!targetUser) {
    response.status(404).json({ error: "Target user not found." });
    return;
  }

  if (!(await areUsersFriends(request.auth!.id, String(targetUserId)))) {
    response.status(403).json({ error: "You can only message accepted friends." });
    return;
  }

  const existing = await findDirectConversation(request.auth!.id, String(targetUserId));

  if (existing) {
    response.json({ conversation: await serializeConversation(existing) });
    return;
  }

  const conversation = await createConversation({
    type: "direct",
    createdBy: request.auth!.id,
    participants: [
      { userId: request.auth!.id, role: "owner" },
      { userId: String(targetUserId), role: "member" }
    ]
  });

  response.status(201).json({ conversation: await serializeConversation(conversation) });
});

router.post("/group", async (request: AuthedRequest, response) => {
  const { name, participantIds = [], ephemeralSeconds = 0 } = request.body ?? {};
  const uniqueIds = Array.from(new Set([request.auth!.id, ...participantIds.map(String)]));

  if (!name || uniqueIds.length < 3) {
    response.status(400).json({ error: "A group needs a name and at least three members." });
    return;
  }

  for (const userId of uniqueIds) {
    if (userId === request.auth!.id) {
      continue;
    }

    if (!(await areUsersFriends(request.auth!.id, userId))) {
      response.status(403).json({ error: "Groups can only include accepted friends." });
      return;
    }
  }

  const conversation = await createConversation({
    type: "group",
    name,
    createdBy: request.auth!.id,
    ephemeralSeconds,
    participants: uniqueIds.map((userId, index) => ({
      userId,
      role: index === 0 ? "owner" : "member"
    }))
  });

  response.status(201).json({ conversation: await serializeConversation(conversation) });
});

router.post("/rooms/:roomId/join", async (request: AuthedRequest, response) => {
  const room = await findRoomById(String(request.params.roomId));

  if (!room) {
    response.status(404).json({ error: "Room not found." });
    return;
  }

  const conversation = await joinRoom(room.id, request.auth!.id);

  response.json({ conversation: await serializeConversation(conversation!) });
});

router.post("/rooms/:roomId/leave", async (request: AuthedRequest, response) => {
  const room = await findRoomById(String(request.params.roomId));

  if (!room) {
    response.status(404).json({ error: "Room not found." });
    return;
  }

  const isParticipant = room.participants.some((participant) => participant.userId === request.auth!.id);

  if (!isParticipant) {
    response.status(400).json({ error: "You are not part of this room." });
    return;
  }

  const updatedRoom = await leaveRoom(room.id, request.auth!.id);

  response.json({ room: await serializeConversation(updatedRoom!) });
});

router.get("/:conversationId/messages", async (request: AuthedRequest, response) => {
  const conversation = await findConversationByIdForUser(String(request.params.conversationId), request.auth!.id);

  if (!conversation) {
    response.status(404).json({ error: "Conversation not found." });
    return;
  }

  const messages = await listMessagesForConversation(conversation.id);

  response.json({
    messages: await Promise.all(messages.map(serializeMessage))
  });
});

router.post("/:conversationId/messages", async (request: AuthedRequest, response) => {
  const conversation = await findConversationByIdForUser(String(request.params.conversationId), request.auth!.id);

  if (!conversation) {
    response.status(404).json({ error: "Conversation not found." });
    return;
  }

  const {
    ciphertext,
    iv,
    algorithm = "AES-GCM",
    recipientKeys = [],
    attachments = [],
    clientGeneratedId = "",
    expiresAt = null
  } = request.body ?? {};

  if (!ciphertext || !iv || !Array.isArray(recipientKeys) || recipientKeys.length === 0) {
    response.status(400).json({ error: "Encrypted payload is incomplete." });
    return;
  }

  const now = new Date();
  const participantIds = conversation.participants.map((participant) => String(participant.userId));

  const normalizedRecipientKeys = recipientKeys
    .filter((item: { userId?: string; wrappedKey?: string }) => participantIds.includes(String(item.userId)))
    .map((item: { userId: string; wrappedKey: string }) => ({
      userId: item.userId,
      wrappedKey: item.wrappedKey,
      deliveredAt: presenceStore.isOnline(String(item.userId)) ? now : null,
      readAt: null
    }));

  const message = await createMessage({
    conversationId: conversation.id,
    senderId: request.auth!.id,
    clientGeneratedId,
    ciphertext,
    iv,
    algorithm,
    attachments,
    recipientKeys: normalizedRecipientKeys,
    expiresAt
  });

  await touchConversation(conversation.id, now);

  const serialized = await serializeMessage(message);

  response.status(201).json({ message: serialized });
});

export default router;
