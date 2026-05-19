import { env } from "./env.js";
import { pool } from "../repositories/db.js";

const ensureAppSchema = async () => {
  await pool.query(`
    alter table users
      add column if not exists allow_friend_requests boolean not null default true,
      add column if not exists read_receipts_enabled boolean not null default true;

    create table if not exists friend_requests (
      id uuid primary key default gen_random_uuid(),
      sender_id uuid not null references users(id) on delete cascade,
      receiver_id uuid not null references users(id) on delete cascade,
      status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
      created_at timestamptz not null default now(),
      responded_at timestamptz,
      unique (sender_id, receiver_id)
    );

    create index if not exists friend_requests_receiver_status_idx
      on friend_requests (receiver_id, status, created_at desc);

    create index if not exists friend_requests_sender_status_idx
      on friend_requests (sender_id, status, created_at desc);

    create table if not exists friendships (
      user_low uuid not null references users(id) on delete cascade,
      user_high uuid not null references users(id) on delete cascade,
      created_at timestamptz not null default now(),
      primary key (user_low, user_high),
      check (user_low <> user_high)
    );

    create table if not exists refresh_tokens (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references users(id) on delete cascade,
      token_hash text not null unique,
      expires_at timestamptz not null,
      revoked boolean not null default false,
      created_at timestamptz not null default now()
    );

    create index if not exists refresh_tokens_user_idx
      on refresh_tokens (user_id, revoked, expires_at);

    create index if not exists refresh_tokens_hash_idx
      on refresh_tokens (token_hash);

    create table if not exists message_reactions (
      id uuid primary key default gen_random_uuid(),
      message_id uuid not null references messages(id) on delete cascade,
      user_id uuid not null references users(id) on delete cascade,
      emoji text not null check (char_length(emoji) <= 8),
      created_at timestamptz not null default now(),
      unique (message_id, user_id, emoji)
    );

    create index if not exists message_reactions_message_idx
      on message_reactions (message_id);
  `);
};

export const connectToDatabase = async () => {
  if (!env.databaseUrl) {
    throw new Error("DATABASE_URL or SUPABASE_DB_URL is required.");
  }

  await pool.query("select 1");
  await ensureAppSchema();
};
