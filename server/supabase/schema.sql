create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  username text not null unique,
  password_hash text not null,
  public_key text not null,
  encrypted_private_key text not null,
  private_key_salt text not null,
  private_key_iv text not null,
  preferred_language text not null default 'en',
  preferred_theme text not null default 'aurora',
  avatar_seed text not null,
  status text not null default 'offline' check (status in ('online', 'offline')),
  allow_friend_requests boolean not null default true,
  read_receipts_enabled boolean not null default true,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('direct', 'group', 'room')),
  name text,
  slug text,
  topic text,
  created_by uuid not null references users(id) on delete cascade,
  ephemeral_seconds integer not null default 0,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists conversations_slug_unique
  on conversations (slug)
  where slug is not null;

create table if not exists conversation_participants (
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index if not exists conversation_participants_user_idx
  on conversation_participants (user_id, conversation_id);

create index if not exists conversations_last_message_idx
  on conversations (last_message_at desc);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid not null references users(id) on delete cascade,
  client_generated_id text,
  ciphertext text not null,
  iv text not null,
  algorithm text not null default 'AES-GCM',
  attachments jsonb not null default '[]'::jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_created_idx
  on messages (conversation_id, created_at desc);

create index if not exists messages_expires_idx
  on messages (expires_at)
  where expires_at is not null;

create table if not exists message_recipient_keys (
  message_id uuid not null references messages(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  wrapped_key text not null,
  delivered_at timestamptz,
  read_at timestamptz,
  primary key (message_id, user_id)
);

create index if not exists message_recipient_keys_user_idx
  on message_recipient_keys (user_id, message_id);

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
