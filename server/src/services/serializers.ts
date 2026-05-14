import type { ConversationRecord } from "../models/Conversation.js";
import type { MessageRecord } from "../models/Message.js";
import type { SanitizedUser, UserRecord } from "../models/User.js";
import { presenceStore } from "../socket/presence.js";

export const sanitizeUser = (user: UserRecord) =>
  ({
    id: user.id,
    email: user.email,
    username: user.username,
    publicKey: user.publicKey,
    encryptedPrivateKey: user.encryptedPrivateKey,
    privateKeySalt: user.privateKeySalt,
    privateKeyIv: user.privateKeyIv,
    preferredLanguage: user.preferredLanguage,
    preferredTheme: user.preferredTheme,
    avatarSeed: user.avatarSeed,
    status: presenceStore.isOnline(user.id) ? "online" : "offline",
    lastSeen: user.lastSeen,
    allowFriendRequests: user.allowFriendRequests,
    readReceiptsEnabled: user.readReceiptsEnabled,
    relationshipStatus: (user as UserRecord & { relationshipStatus?: SanitizedUser["relationshipStatus"] }).relationshipStatus,
    relationshipRequestId: (user as UserRecord & { relationshipRequestId?: string | null }).relationshipRequestId ?? null
  }) satisfies SanitizedUser;

export const serializeConversation = async (conversation: ConversationRecord) => {
  return {
    id: conversation.id,
    type: conversation.type,
    name: conversation.name ?? "",
    slug: conversation.slug ?? "",
    topic: conversation.topic ?? "",
    ephemeralSeconds: conversation.ephemeralSeconds,
    lastMessageAt: conversation.lastMessageAt,
    participants: conversation.participants.map((participant) => ({
      ...participant,
      status: presenceStore.isOnline(participant.userId) ? "online" : participant.status
    }))
  };
};

export const serializeMessage = async (message: MessageRecord) => {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    sender: message.sender
      ? {
          ...message.sender,
          status: presenceStore.isOnline(message.sender.userId) ? "online" : message.sender.status
        }
      : null,
    clientGeneratedId: message.clientGeneratedId ?? "",
    ciphertext: message.ciphertext,
    iv: message.iv,
    algorithm: message.algorithm,
    attachments: message.attachments,
    recipientKeys: message.recipientKeys,
    expiresAt: message.expiresAt,
    createdAt: message.createdAt
  };
};
