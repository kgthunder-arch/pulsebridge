import crypto from "crypto";
import { query } from "./db.js";

const REFRESH_TOKEN_BYTES = 48;
const REFRESH_TOKEN_TTL_DAYS = 30;

const hashToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

export const createRefreshToken = async (userId: string): Promise<string> => {
  const rawToken = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  await query(
    `insert into refresh_tokens (user_id, token_hash, expires_at)
     values ($1::uuid, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );

  return rawToken;
};

export const consumeRefreshToken = async (rawToken: string): Promise<string | null> => {
  const tokenHash = hashToken(rawToken);

  const result = await query(
    `update refresh_tokens
     set revoked = true
     where token_hash = $1
       and revoked = false
       and expires_at > now()
     returning user_id`,
    [tokenHash]
  );

  return (result.rows[0]?.user_id as string) ?? null;
};

export const revokeAllRefreshTokensForUser = async (userId: string): Promise<void> => {
  await query(
    `update refresh_tokens set revoked = true where user_id = $1::uuid`,
    [userId]
  );
};
