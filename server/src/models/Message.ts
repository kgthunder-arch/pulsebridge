export type MessageAttachmentRecord = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
};

export type MessageRecipientKeyRecord = {
  userId: string;
  wrappedKey: string;
  deliveredAt: Date | null;
  readAt: Date | null;
};

export type MessageRecord = {
  id: string;
  conversationId: string;
  senderId: string;
  sender: {
    userId: string;
    username: string;
    publicKey: string;
    preferredLanguage: string;
    avatarSeed: string;
    role: string;
    status: "online" | "offline";
    lastSeen: Date;
  } | null;
  clientGeneratedId: string;
  ciphertext: string;
  iv: string;
  algorithm: string;
  attachments: MessageAttachmentRecord[];
  recipientKeys: MessageRecipientKeyRecord[];
  expiresAt: Date | null;
  createdAt: Date;
};

