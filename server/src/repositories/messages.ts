import { query } from "./db.js";
import type { MessageRecord } from "../models/Message.js";

const mapMessage = (row: any): MessageRecord => ({
  id: row.id,
  conversationId: row.conversation_id,
  senderId: row.sender_id,
  sender: row.sender
    ? {
        userId: row.sender.userId,
        username: row.sender.username,
        publicKey: row.sender.publicKey,
        preferredLanguage: row.sender.preferredLanguage,
        avatarSeed: row.sender.avatarSeed,
        role: row.sender.role,
        status: row.sender.status,
        lastSeen: row.sender.lastSeen
      }
    : null,
  clientGeneratedId: row.client_generated_id ?? "",
  ciphertext: row.ciphertext,
  iv: row.iv,
  algorithm: row.algorithm,
  attachments: Array.isArray(row.attachments) ? row.attachments : [],
  recipientKeys: Array.isArray(row.recipient_keys) ? row.recipient_keys : [],
  expiresAt: row.expires_at,
  createdAt: row.created_at
});

const baseMessageSql = `
  select
    m.*,
    json_build_object(
      'userId', sender.id::text,
      'username', sender.username,
      'publicKey', sender.public_key,
      'preferredLanguage', sender.preferred_language,
      'avatarSeed', sender.avatar_seed,
      'role', 'member',
      'status', sender.status,
      'lastSeen', sender.last_seen
    ) as sender,
    coalesce(
      json_agg(
        json_build_object(
          'userId', mrk.user_id::text,
          'wrappedKey', mrk.wrapped_key,
          'deliveredAt', mrk.delivered_at,
          'readAt', mrk.read_at
        )
        order by mrk.user_id
      ) filter (where mrk.user_id is not null),
      '[]'::json
    ) as recipient_keys
  from messages m
  join users sender on sender.id = m.sender_id
  left join message_recipient_keys mrk on mrk.message_id = m.id
`;

export const listMessagesForConversation = async (conversationId: string) => {
  const result = await query(
    `select * from (
      ${baseMessageSql}
      where m.conversation_id = $1::uuid
        and (m.expires_at is null or m.expires_at > now())
      group by m.id, sender.id
      order by m.created_at desc
      limit 80
    ) recent
    order by recent.created_at asc`,
    [conversationId]
  );

  return result.rows.map(mapMessage);
};

export const createMessage = async (input: {
  conversationId: string;
  senderId: string;
  clientGeneratedId: string;
  ciphertext: string;
  iv: string;
  algorithm: string;
  attachments: unknown[];
  recipientKeys: {
    userId: string;
    wrappedKey: string;
    deliveredAt: Date | null;
    readAt: Date | null;
  }[];
  expiresAt: string | null;
}) => {
  const insertMessageResult = await query(
    `insert into messages (
      conversation_id,
      sender_id,
      client_generated_id,
      ciphertext,
      iv,
      algorithm,
      attachments,
      expires_at
    ) values ($1::uuid, $2::uuid, $3, $4, $5, $6, $7::jsonb, $8)
    returning id`,
    [
      input.conversationId,
      input.senderId,
      input.clientGeneratedId || null,
      input.ciphertext,
      input.iv,
      input.algorithm,
      JSON.stringify(input.attachments),
      input.expiresAt
    ]
  );

  const messageId = insertMessageResult.rows[0].id as string;

  for (const recipientKey of input.recipientKeys) {
    await query(
      `insert into message_recipient_keys (
        message_id,
        user_id,
        wrapped_key,
        delivered_at,
        read_at
      ) values ($1::uuid, $2::uuid, $3, $4, $5)`,
      [
        messageId,
        recipientKey.userId,
        recipientKey.wrappedKey,
        recipientKey.deliveredAt,
        recipientKey.readAt
      ]
    );
  }

  const result = await query(
    `${baseMessageSql}
     where m.id = $1::uuid
     group by m.id, sender.id
     limit 1`,
    [messageId]
  );

  return mapMessage(result.rows[0]);
};

export const markMessageRead = async (messageId: string, userId: string) => {
  const result = await query(
    `update message_recipient_keys
     set delivered_at = coalesce(delivered_at, now()),
         read_at = coalesce(read_at, now())
     where message_id = $1::uuid and user_id = $2::uuid
     returning read_at`,
    [messageId, userId]
  );

  return result.rows[0]?.read_at ?? null;
};

