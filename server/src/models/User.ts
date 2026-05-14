export type UserStatus = "online" | "offline";

export type UserRecord = {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  publicKey: string;
  encryptedPrivateKey: string;
  privateKeySalt: string;
  privateKeyIv: string;
  preferredLanguage: string;
  preferredTheme: string;
  avatarSeed: string;
  status: UserStatus;
  lastSeen: Date;
  allowFriendRequests: boolean;
  readReceiptsEnabled: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

export type SanitizedUser = {
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
  lastSeen: Date;
  allowFriendRequests: boolean;
  readReceiptsEnabled: boolean;
  relationshipStatus?: "friends" | "incoming-request" | "outgoing-request" | "none";
  relationshipRequestId?: string | null;
};

export type FriendRequestRecord = {
  id: string;
  senderId: string;
  receiverId: string;
  status: "pending" | "accepted" | "declined" | "cancelled";
  createdAt: Date;
  respondedAt: Date | null;
  otherUser: UserRecord;
};
