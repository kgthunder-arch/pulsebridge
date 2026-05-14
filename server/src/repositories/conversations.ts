import { query } from "./db.js";
import type { ConversationParticipantRecord, ConversationRecord, ConversationType } from "../models/Conversation.js";

const DEFAULT_ROOMS = [
  { name: "World Pulse", slug: "world-pulse", topic: "Global headlines and instant reactions" },
  { name: "Creator Orbit", slug: "creator-orbit", topic: "Design, media, and product launches" },
  { name: "Code Relay", slug: "code-relay", topic: "Engineering help and live build sessions" }
];

const mapParticipant = (row: any): ConversationParticipantRecord => ({
  userId: row.userId,
  username: row.username,
  publicKey: row.publicKey,
  preferredLanguage: row.preferredLanguage,
  avatarSeed: row.avatarSeed,
  role: row.role,
  status: row.status,
  lastSeen: row.lastSeen
});

const mapConversation = (row: any): ConversationRecord => ({
  id: row.id,
  type: row.type,
  name: row.name ?? "",
  slug: row.slug ?? "",
  topic: row.topic ?? "",
  createdBy: row.created_by,
  ephemeralSeconds: row.ephemeral_seconds ?? 0,
  lastMessageAt: row.last_message_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  participants: Array.isArray(row.participants) ? row.participants.map(mapParticipant) : []
});

const conversationsWithParticipantsSql = `
  select
    c.*,
    coalesce(
      json_agg(
        json_build_object(
          'userId', u.id::text,
          'username', u.username,
          'publicKey', u.public_key,
          'preferredLanguage', u.preferred_language,
          'avatarSeed', u.avatar_seed,
          'role', cp.role,
          'status', u.status,
          'lastSeen', u.last_seen
        )
        order by cp.joined_at
      ) filter (where u.id is not null),
      '[]'::json
    ) as participants
  from conversations c
  left join conversation_participants cp on cp.conversation_id = c.id
  left join users u on u.id = cp.user_id
`;

export const ensureRoomCatalogue = async (createdBy: string) => {
  for (const room of DEFAULT_ROOMS) {
    await query(
      `insert into conversations (type, name, slug, topic, created_by)
       values ('room', $1, $2, $3, $4)
       on conflict do nothing`,
      [room.name, room.slug, room.topic, createdBy]
    );
  }
};

export const listJoinedConversations = async (userId: string) => {
  const result = await query(
    `${conversationsWithParticipantsSql}
     where exists (
       select 1 from conversation_participants cp_self
       where cp_self.conversation_id = c.id and cp_self.user_id = $1::uuid
     )
     group by c.id
     order by c.last_message_at desc`,
    [userId]
  );

  return result.rows.map(mapConversation);
};

export const listDiscoverableRooms = async (userId: string) => {
  const result = await query(
    `${conversationsWithParticipantsSql}
     where c.type = 'room'
       and not exists (
         select 1 from conversation_participants cp_self
         where cp_self.conversation_id = c.id and cp_self.user_id = $1::uuid
       )
     group by c.id
     order by c.name asc`,
    [userId]
  );

  return result.rows.map(mapConversation);
};

export const findConversationByIdForUser = async (conversationId: string, userId: string) => {
  const result = await query(
    `${conversationsWithParticipantsSql}
     where c.id = $1::uuid
       and exists (
         select 1 from conversation_participants cp_self
         where cp_self.conversation_id = c.id and cp_self.user_id = $2::uuid
       )
     group by c.id
     limit 1`,
    [conversationId, userId]
  );

  return result.rows[0] ? mapConversation(result.rows[0]) : null;
};

export const findRoomById = async (conversationId: string) => {
  const result = await query(
    `${conversationsWithParticipantsSql}
     where c.id = $1::uuid and c.type = 'room'
     group by c.id
     limit 1`,
    [conversationId]
  );

  return result.rows[0] ? mapConversation(result.rows[0]) : null;
};

export const findDirectConversation = async (userId: string, targetUserId: string) => {
  const result = await query(
    `${conversationsWithParticipantsSql}
     where c.type = 'direct'
       and exists (
         select 1 from conversation_participants a
         where a.conversation_id = c.id and a.user_id = $1::uuid
       )
       and exists (
         select 1 from conversation_participants b
         where b.conversation_id = c.id and b.user_id = $2::uuid
       )
     group by c.id
     having count(cp.user_id) = 2
     limit 1`,
    [userId, targetUserId]
  );

  return result.rows[0] ? mapConversation(result.rows[0]) : null;
};

export const createConversation = async (input: {
  type: ConversationType;
  name?: string;
  slug?: string;
  topic?: string;
  createdBy: string;
  ephemeralSeconds?: number;
  participants: { userId: string; role: string }[];
}) => {
  const conversationResult = await query(
    `insert into conversations (type, name, slug, topic, created_by, ephemeral_seconds)
     values ($1, $2, $3, $4, $5::uuid, $6)
     returning *`,
    [
      input.type,
      input.name ?? null,
      input.slug ?? null,
      input.topic ?? null,
      input.createdBy,
      input.ephemeralSeconds ?? 0
    ]
  );

  const conversation = conversationResult.rows[0];

  for (const participant of input.participants) {
    await query(
      `insert into conversation_participants (conversation_id, user_id, role)
       values ($1::uuid, $2::uuid, $3)
       on conflict (conversation_id, user_id) do update set role = excluded.role`,
      [conversation.id, participant.userId, participant.role]
    );
  }

  return findConversationById(conversation.id);
};

export const findConversationById = async (conversationId: string) => {
  const result = await query(
    `${conversationsWithParticipantsSql}
     where c.id = $1::uuid
     group by c.id
     limit 1`,
    [conversationId]
  );

  return result.rows[0] ? mapConversation(result.rows[0]) : null;
};

export const joinRoom = async (conversationId: string, userId: string) => {
  await query(
    `insert into conversation_participants (conversation_id, user_id, role)
     values ($1::uuid, $2::uuid, 'member')
     on conflict (conversation_id, user_id) do nothing`,
    [conversationId, userId]
  );

  return findConversationById(conversationId);
};

export const leaveRoom = async (conversationId: string, userId: string) => {
  await query(
    `delete from conversation_participants
     where conversation_id = $1::uuid
       and user_id = $2::uuid`,
    [conversationId, userId]
  );

  return findRoomById(conversationId);
};

export const listConversationIdsForUser = async (userId: string) => {
  const result = await query(
    "select conversation_id from conversation_participants where user_id = $1::uuid",
    [userId]
  );

  return result.rows.map((row: any) => row.conversation_id as string);
};

export const touchConversation = async (conversationId: string, timestamp: Date) => {
  await query(
    "update conversations set last_message_at = $2 where id = $1::uuid",
    [conversationId, timestamp]
  );
};
