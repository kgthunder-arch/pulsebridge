export type UserStatus = "online" | "offline";
export type CallType = "audio" | "video";

export type MessageReaction = {
  id: string;
  messageId: string;
  userId: string;
  username: string;
  emoji: string;
  createdAt: string;
};

export type AuthUser = {
  id: string;
  email: string;
  username: string;
  publicKey: string;
  encryptedPrivateKey: string;
  privateKeySalt: string;
  privateKeyIv: string;
  preferredLanguage: string;
  preferredTheme: string;
  avatarSeed: string;
  status: UserStatus;
  lastSeen: string;
  allowFriendRequests: boolean;
  readReceiptsEnabled: boolean;
  relationshipStatus?: "friends" | "incoming-request" | "outgoing-request" | "none";
  relationshipRequestId?: string | null;
};

export type ContactRequest = {
  id: string;
  createdAt: string;
  user: AuthUser;
};

export type ConversationParticipant = {
  userId: string;
  username: string;
  publicKey: string;
  preferredLanguage: string;
  avatarSeed: string;
  role: string;
  status: UserStatus;
  lastSeen: string;
};

export type Conversation = {
  id: string;
  type: "direct" | "group" | "room";
  name: string;
  slug: string;
  topic: string;
  ephemeralSeconds: number;
  lastMessageAt: string;
  participants: ConversationParticipant[];
};

export type AttachmentMeta = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
};

export type AttachmentPayload = AttachmentMeta & {
  dataUrl: string;
};

export type RecipientKeyEnvelope = {
  userId: string;
  wrappedKey: string;
  deliveredAt: string | null;
  readAt: string | null;
};

export type ServerMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  sender: ConversationParticipant | null;
  clientGeneratedId: string;
  ciphertext: string;
  iv: string;
  algorithm: string;
  attachments: AttachmentMeta[];
  recipientKeys: RecipientKeyEnvelope[];
  reactions: MessageReaction[];
  expiresAt: string | null;
  createdAt: string;
};

export type MessageContent = {
  text: string;
  attachments: AttachmentPayload[];
};

export type DecryptedMessage = ServerMessage & {
  content: MessageContent;
  translatedText?: string;
  reactions: MessageReaction[];
};

export type IceConfig = {
  iceServers: RTCIceServer[];
};

export type IncomingCallState = {
  conversationId: string;
  fromUserId: string;
  fromUsername: string;
  callType: CallType;
};

export type SmartReplyState = Record<string, string[]>;

export type QueuedMessageDraft = {
  id: string;
  conversationId: string;
  text: string;
  attachments: AttachmentPayload[];
  expiresAt: string | null;
  createdAt: string;
};
