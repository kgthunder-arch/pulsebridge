export type ConversationType = "direct" | "group" | "room";

export type ConversationParticipantRecord = {
  userId: string;
  username: string;
  publicKey: string;
  preferredLanguage: string;
  avatarSeed: string;
  role: string;
  status: "online" | "offline";
  lastSeen: Date;
};

export type ConversationRecord = {
  id: string;
  type: ConversationType;
  name: string;
  slug: string;
  topic: string;
  createdBy: string;
  ephemeralSeconds: number;
  lastMessageAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
  participants: ConversationParticipantRecord[];
};

