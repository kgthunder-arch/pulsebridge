import { query } from "./db.js";

export type MessageReaction = {
  id: string;
  messageId: string;
  userId: string;
  username: string;
  emoji: string;
  createdAt: string;
};

export const addReaction = async (
  messageId: string,
  userId: string,
  emoji: string
): Promise<MessageReaction | null> => {
  const result = await query(
    `insert into message_reactions (message_id, user_id, emoji)
     values ($1::uuid, $2::uuid, $3)
     on conflict (message_id, user_id, emoji) do nothing
     returning *`,
    [messageId, userId, emoji]
  );

  if (!result.rows[0]) {
    return null; // already reacted
  }

  const row = result.rows[0];
  const userResult = await query("select username from users where id = $1::uuid limit 1", [userId]);

  return {
    id: row.id,
    messageId: row.message_id,
    userId: row.user_id,
    username: userResult.rows[0]?.username ?? "Unknown",
    emoji: row.emoji,
    createdAt: row.created_at
  };
};

export const removeReaction = async (
  messageId: string,
  userId: string,
  emoji: string
): Promise<boolean> => {
  const result = await query(
    `delete from message_reactions
     where message_id = $1::uuid and user_id = $2::uuid and emoji = $3
     returning id`,
    [messageId, userId, emoji]
  );

  return Boolean(result.rows[0]);
};

export const getReactionsForMessages = async (
  messageIds: string[]
): Promise<MessageReaction[]> => {
  if (messageIds.length === 0) return [];

  const result = await query(
    `select r.*, u.username
     from message_reactions r
     join users u on u.id = r.user_id
     where r.message_id = any($1::uuid[])
     order by r.created_at asc`,
    [messageIds]
  );

  return result.rows.map((row) => ({
    id: row.id,
    messageId: row.message_id,
    userId: row.user_id,
    username: row.username,
    emoji: row.emoji,
    createdAt: row.created_at
  }));
};
