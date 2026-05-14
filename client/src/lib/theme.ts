import type { DecryptedMessage } from "./types";

export type Mood = "aurora" | "focus" | "warm" | "urgent";

export const deriveMood = (messages: DecryptedMessage[]): Mood => {
  const sample = messages
    .slice(-6)
    .map((message) => message.content.text.toLowerCase())
    .join(" ");

  if (!sample) {
    return "aurora";
  }

  if (/(urgent|asap|now|critical|immediately)/.test(sample)) {
    return "urgent";
  }

  if (/(love|great|amazing|celebrate|happy|nice)/.test(sample)) {
    return "warm";
  }

  if (/(build|debug|deploy|ship|code|review)/.test(sample)) {
    return "focus";
  }

  return "aurora";
};

