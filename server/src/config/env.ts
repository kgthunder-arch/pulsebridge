import path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFilePath);

config({ path: path.resolve(currentDirectory, "../../.env") });

const toNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const splitCsv = (value: string | undefined, fallback: string[]) =>
  (value?.split(",") ?? fallback).map((item) => item.trim()).filter(Boolean);

export const env = {
  port: toNumber(process.env.PORT, 4000),
  databaseUrl: process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL ?? "",
  databaseSsl: (process.env.DATABASE_SSL ?? "true") !== "false",
  clientUrl: process.env.CLIENT_URL ?? "http://localhost:5173",
  clientUrls: splitCsv(process.env.CLIENT_URLS, [process.env.CLIENT_URL ?? "http://localhost:5173"]),
  jwtSecret: process.env.JWT_SECRET ?? "pulsebridge-dev-secret",
  aiMode: process.env.AI_MODE ?? "mock",
  aiBaseUrl: process.env.AI_BASE_URL ?? "https://api.openai.com/v1",
  aiApiKey: process.env.AI_API_KEY ?? "",
  aiModel: process.env.AI_MODEL ?? "gpt-4o-mini",
  redisUrl: process.env.REDIS_URL ?? "",
  stunUrls: splitCsv(process.env.STUN_URLS, ["stun:stun.l.google.com:19302"]),
  turnUrl: process.env.TURN_URL ?? "",
  turnUsername: process.env.TURN_USERNAME ?? "",
  turnCredential: process.env.TURN_CREDENTIAL ?? ""
};
