import { env } from "../config/env.js";

type CompletionResult = {
  translatedText?: string;
  replies?: string[];
};

const fallbackTranslate = (text: string, targetLanguage: string) =>
  `[${targetLanguage.toUpperCase()}] ${text}`;

const fallbackReplies = (text: string) => {
  const normalized = text.toLowerCase();

  if (normalized.includes("?")) {
    return [
      "Yes, that works for me.",
      "Give me two minutes and I will confirm.",
      "Can you share one more detail?"
    ];
  }

  if (normalized.includes("meeting") || normalized.includes("call")) {
    return [
      "Let's do it now.",
      "I can join in 10 minutes.",
      "Send me the room link."
    ];
  }

  return [
    "Sounds good.",
    "I am on it.",
    "Let's keep moving."
  ];
};

const runLlm = async (system: string, prompt: string): Promise<CompletionResult> => {
  const response = await fetch(`${env.aiBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.aiApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: env.aiModel,
      temperature: 0.4,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    throw new Error(`AI provider error ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? "{}";
  return JSON.parse(content) as CompletionResult;
};

export const translateMessage = async (text: string, targetLanguage: string) => {
  if (env.aiMode === "mock" || !env.aiApiKey) {
    return fallbackTranslate(text, targetLanguage);
  }

  const result = await runLlm(
    "You translate chat messages while preserving tone, slang, and brevity. Return JSON {\"translatedText\":\"...\"}.",
    `Translate into ${targetLanguage}: ${text}`
  );

  return result.translatedText ?? fallbackTranslate(text, targetLanguage);
};

export const getSmartReplies = async (messages: string[], targetLanguage: string) => {
  const latest = messages[messages.length - 1] ?? "";

  if (env.aiMode === "mock" || !env.aiApiKey) {
    return fallbackReplies(latest);
  }

  const result = await runLlm(
    "You generate exactly three concise chat replies. Return JSON {\"replies\":[\"...\",\"...\",\"...\"]}.",
    `Conversation snippets in ${targetLanguage}:\n${messages.join("\n")}`
  );

  return result.replies?.slice(0, 3) ?? fallbackReplies(latest);
};

