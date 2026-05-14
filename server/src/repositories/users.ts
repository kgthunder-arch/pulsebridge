import { query } from "./db.js";
import type { FriendRequestRecord, UserRecord } from "../models/User.js";

const mapUser = (row: any): UserRecord => ({
  id: row.id,
  email: row.email,
  username: row.username,
  passwordHash: row.password_hash,
  publicKey: row.public_key,
  encryptedPrivateKey: row.encrypted_private_key,
  privateKeySalt: row.private_key_salt,
  privateKeyIv: row.private_key_iv,
  preferredLanguage: row.preferred_language,
  preferredTheme: row.preferred_theme,
  avatarSeed: row.avatar_seed,
  status: row.status,
  lastSeen: row.last_seen,
  allowFriendRequests: row.allow_friend_requests,
  readReceiptsEnabled: row.read_receipts_enabled,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const mapFriendRequest = (row: any): FriendRequestRecord => ({
  id: row.id,
  senderId: row.sender_id,
  receiverId: row.receiver_id,
  status: row.status,
  createdAt: row.created_at,
  respondedAt: row.responded_at,
  otherUser: mapUser(row.other_user)
});

export const findUserById = async (id: string) => {
  const result = await query("select * from users where id = $1 limit 1", [id]);
  return result.rows[0] ? mapUser(result.rows[0]) : null;
};

export const findUserByEmailOrUsername = async (emailOrUsername: string) => {
  const normalizedEmail = emailOrUsername.toLowerCase();
  const result = await query(
    "select * from users where lower(email) = $1 or username = $2 limit 1",
    [normalizedEmail, emailOrUsername]
  );

  return result.rows[0] ? mapUser(result.rows[0]) : null;
};

export const createUser = async (input: {
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
}) => {
  const result = await query(
    `insert into users (
      email,
      username,
      password_hash,
      public_key,
      encrypted_private_key,
      private_key_salt,
      private_key_iv,
      preferred_language,
      preferred_theme,
      avatar_seed
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    returning *`,
    [
      input.email,
      input.username,
      input.passwordHash,
      input.publicKey,
      input.encryptedPrivateKey,
      input.privateKeySalt,
      input.privateKeyIv,
      input.preferredLanguage,
      input.preferredTheme,
      input.avatarSeed
    ]
  );

  return mapUser(result.rows[0]);
};

export const searchUsers = async (currentUserId: string, rawQuery: string) => {
  const searchTerm = rawQuery.trim();
  const searchClause = searchTerm
    ? `and (u.username ilike $2 or u.email ilike $2)`
    : "";
  const values = searchTerm ? [currentUserId, `%${searchTerm}%`] : [currentUserId];

  const result = await query(
    `select
       u.*,
       case
         when f.user_low is not null then 'friends'
         when incoming.id is not null then 'incoming-request'
         when outgoing.id is not null then 'outgoing-request'
         else 'none'
       end as relationship_status,
       coalesce(incoming.id, outgoing.id) as relationship_request_id
     from users u
     left join friendships f
       on f.user_low = least(u.id, $1::uuid)
      and f.user_high = greatest(u.id, $1::uuid)
     left join friend_requests incoming
       on incoming.sender_id = u.id
      and incoming.receiver_id = $1::uuid
      and incoming.status = 'pending'
     left join friend_requests outgoing
       on outgoing.sender_id = $1::uuid
      and outgoing.receiver_id = u.id
      and outgoing.status = 'pending'
     where u.id <> $1::uuid
       and (
         u.allow_friend_requests = true
         or f.user_low is not null
         or incoming.id is not null
         or outgoing.id is not null
       )
       ${searchClause}
     order by
       case
         when f.user_low is not null then 0
         when incoming.id is not null then 1
         when outgoing.id is not null then 2
         else 3
       end,
       u.username asc
     limit 30`,
    values
  );

  return result.rows.map((row) => ({
    ...mapUser(row),
    relationshipStatus: row.relationship_status,
    relationshipRequestId: row.relationship_request_id
  }));
};

export const listUsersByIds = async (userIds: string[]) => {
  if (userIds.length === 0) {
    return [];
  }

  const result = await query("select * from users where id = any($1::uuid[])", [userIds]);
  return result.rows.map(mapUser);
};

export const updateUserPresence = async (userId: string, status: "online" | "offline") => {
  await query(
    "update users set status = $2, last_seen = now() where id = $1",
    [userId, status]
  );
};

export const updateUserPrivacy = async (
  userId: string,
  input: { allowFriendRequests?: boolean; readReceiptsEnabled?: boolean }
) => {
  const current = await findUserById(userId);

  if (!current) {
    return null;
  }

  const result = await query(
    `update users
     set allow_friend_requests = $2,
         read_receipts_enabled = $3,
         updated_at = now()
     where id = $1::uuid
     returning *`,
    [
      userId,
      input.allowFriendRequests ?? current.allowFriendRequests,
      input.readReceiptsEnabled ?? current.readReceiptsEnabled
    ]
  );

  return mapUser(result.rows[0]);
};

const canonicalPair = (left: string, right: string) => {
  const sorted = [left, right].sort();
  return { low: sorted[0], high: sorted[1] };
};

export const areUsersFriends = async (leftUserId: string, rightUserId: string) => {
  const { low, high } = canonicalPair(leftUserId, rightUserId);
  const result = await query(
    "select 1 from friendships where user_low = $1::uuid and user_high = $2::uuid limit 1",
    [low, high]
  );

  return Boolean(result.rows[0]);
};

export const listFriendships = async (userId: string) => {
  const result = await query(
    `select u.*
     from friendships f
     join users u
       on u.id = case when f.user_low = $1::uuid then f.user_high else f.user_low end
     where f.user_low = $1::uuid or f.user_high = $1::uuid
     order by u.username asc`,
    [userId]
  );

  return result.rows.map(mapUser);
};

export const listPendingFriendRequests = async (userId: string) => {
  const incoming = await query(
    `select
       fr.*,
       row_to_json(u) as other_user
     from friend_requests fr
     join users u on u.id = fr.sender_id
     where fr.receiver_id = $1::uuid and fr.status = 'pending'
     order by fr.created_at desc`,
    [userId]
  );

  const outgoing = await query(
    `select
       fr.*,
       row_to_json(u) as other_user
     from friend_requests fr
     join users u on u.id = fr.receiver_id
     where fr.sender_id = $1::uuid and fr.status = 'pending'
     order by fr.created_at desc`,
    [userId]
  );

  return {
    incoming: incoming.rows.map(mapFriendRequest),
    outgoing: outgoing.rows.map(mapFriendRequest)
  };
};

export const sendFriendRequest = async (senderId: string, receiverId: string) => {
  if (senderId === receiverId) {
    throw new Error("You cannot send a friend request to yourself.");
  }

  if (await areUsersFriends(senderId, receiverId)) {
    return { type: "friends" as const, request: null };
  }

  const receiver = await findUserById(receiverId);

  if (!receiver) {
    throw new Error("User not found.");
  }

  if (!receiver.allowFriendRequests) {
    throw new Error("This user is not accepting friend requests.");
  }

  const reciprocal = await query(
    `select * from friend_requests
     where sender_id = $1::uuid and receiver_id = $2::uuid and status = 'pending'
     limit 1`,
    [receiverId, senderId]
  );

  if (reciprocal.rows[0]) {
    const requestId = reciprocal.rows[0].id as string;
    await acceptFriendRequest(senderId, requestId);
    return { type: "accepted" as const, request: null };
  }

  const existing = await query(
    `select * from friend_requests
     where sender_id = $1::uuid and receiver_id = $2::uuid
     order by created_at desc
     limit 1`,
    [senderId, receiverId]
  );

  if (existing.rows[0]?.status === "pending") {
    return { type: "pending" as const, request: existing.rows[0] };
  }

  const result = await query(
    `insert into friend_requests (sender_id, receiver_id, status, responded_at)
     values ($1::uuid, $2::uuid, 'pending', null)
     on conflict (sender_id, receiver_id)
     do update set status = 'pending', responded_at = null, created_at = now()
     returning *`,
    [senderId, receiverId]
  );

  return { type: "pending" as const, request: result.rows[0] };
};

export const acceptFriendRequest = async (receiverId: string, requestId: string) => {
  const request = await query(
    `update friend_requests
     set status = 'accepted', responded_at = now()
     where id = $1::uuid and receiver_id = $2::uuid and status = 'pending'
     returning *`,
    [requestId, receiverId]
  );

  if (!request.rows[0]) {
    return null;
  }

  const { low, high } = canonicalPair(request.rows[0].sender_id as string, request.rows[0].receiver_id as string);

  await query(
    `insert into friendships (user_low, user_high)
     values ($1::uuid, $2::uuid)
     on conflict do nothing`,
    [low, high]
  );

  return request.rows[0];
};

export const declineFriendRequest = async (receiverId: string, requestId: string) => {
  const result = await query(
    `update friend_requests
     set status = 'declined', responded_at = now()
     where id = $1::uuid and receiver_id = $2::uuid and status = 'pending'
     returning id`,
    [requestId, receiverId]
  );

  return Boolean(result.rows[0]);
};
