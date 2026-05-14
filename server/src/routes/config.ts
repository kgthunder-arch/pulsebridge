import { Router } from "express";

import { authMiddleware } from "../middleware/auth.js";
import { env } from "../config/env.js";

const router = Router();

router.use(authMiddleware);

router.get("/realtime", (_request, response) => {
  const iceServers = [
    ...env.stunUrls.map((url) => ({ urls: url })),
    ...(env.turnUrl
      ? [
          {
            urls: env.turnUrl,
            username: env.turnUsername,
            credential: env.turnCredential
          }
        ]
      : [])
  ];

  response.json({ iceServers });
});

export default router;

