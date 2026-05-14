import type { AuthUser, QueuedMessageDraft } from "./types";
import type { Mood } from "./theme";

const TOKEN_KEY = "pulsebridge.token";
const USER_KEY = "pulsebridge.user";
const QUEUE_KEY = "pulsebridge.queue";
const THEME_KEY = "pulsebridge.theme";
const MOOD_KEY = "pulsebridge.moods";
const REFRESH_TOKEN_KEY = "pulsebridge.refreshToken";

export const saveSession = (token: string, user: AuthUser) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const readSession = () => ({
  token: localStorage.getItem(TOKEN_KEY),
  user: JSON.parse(localStorage.getItem(USER_KEY) ?? "null") as AuthUser | null
});

export const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
};

export const saveRefreshToken = (refreshToken: string) => {
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
};

export const readRefreshToken = () =>
  localStorage.getItem(REFRESH_TOKEN_KEY);


export const readQueuedDrafts = () =>
  JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]") as QueuedMessageDraft[];

export const saveQueuedDrafts = (drafts: QueuedMessageDraft[]) => {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(drafts));
};

export const queueDraft = (draft: QueuedMessageDraft) => {
  saveQueuedDrafts([...readQueuedDrafts(), draft]);
};

export const saveThemePreference = (theme: "dark" | "light") => {
  localStorage.setItem(THEME_KEY, theme);
};

export const readThemePreference = () =>
  (localStorage.getItem(THEME_KEY) as "dark" | "light" | null) ?? "dark";

export const readConversationMoodPreferences = () =>
  JSON.parse(localStorage.getItem(MOOD_KEY) ?? "{}") as Record<string, Mood>;

export const saveConversationMoodPreferences = (moods: Record<string, Mood>) => {
  localStorage.setItem(MOOD_KEY, JSON.stringify(moods));
};
