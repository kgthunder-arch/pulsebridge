-- Run this file in your Supabase SQL editor to add refresh token and reaction support.

-- Refresh tokens table
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

-- Message reactions table
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
