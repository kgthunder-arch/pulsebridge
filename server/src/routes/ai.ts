import { Router } from "express";

import { authMiddleware } from "../middleware/auth.js";
import { getSmartReplies, translateMessage } from "../services/aiService.js";

const router = Router();

router.use(authMiddleware);

router.post("/translate", async (request, response) => {
  const { text, targetLanguage } = request.body ?? {};

  if (!text || !targetLanguage) {
    response.status(400).json({ error: "Text and targetLanguage are required." });
    return;
  }

  const translatedText = await translateMessage(String(text), String(targetLanguage));
  response.json({ translatedText });
});

router.post("/smart-replies", async (request, response) => {
  const { messages, targetLanguage = "en" } = request.body ?? {};

  if (!Array.isArray(messages) || messages.length === 0) {
    response.status(400).json({ error: "messages must be a non-empty array." });
    return;
  }

  const replies = await getSmartReplies(messages.map(String), String(targetLanguage));
  response.json({ replies });
});

export default router;

