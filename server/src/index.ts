import http from "http";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

import cors from "cors";
import express from "express";

import { connectToDatabase } from "./config/db.js";
import { env } from "./config/env.js";
import aiRoutes from "./routes/ai.js";
import authRoutes from "./routes/auth.js";
import configRoutes from "./routes/config.js";
import conversationRoutes from "./routes/conversations.js";
import userRoutes from "./routes/users.js";
import { authLimiter, aiLimiter, apiLimiter } from "./middleware/rateLimiter.js";
import { createSocketServer } from "./socket/server.js";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFilePath);
const clientDistPath = path.resolve(currentDirectory, "../../client/dist");
const clientIndexPath = path.join(clientDistPath, "index.html");

const bootstrap = async () => {
  await connectToDatabase();

  const app = express();
  const server = http.createServer(app);

  app.set("trust proxy", 1);

  app.use(
    cors({
      origin: true,
      credentials: true
    })
  );
  app.use(express.json({ limit: "12mb" }));

  app.get("/health", (_request, response) => {
    response.json({ ok: true, service: "pulsebridge-server" });
  });

  app.use("/api/auth", authLimiter, authRoutes);
  app.use("/api/users", apiLimiter, userRoutes);
  app.use("/api/conversations", apiLimiter, conversationRoutes);
  app.use("/api/ai", aiLimiter, aiRoutes);
  app.use("/api/config", apiLimiter, configRoutes);

  if (existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath));

    app.get(/^(?!\/api|\/health|\/socket\.io).*/, (_request, response) => {
      response.sendFile(clientIndexPath);
    });
  }

  await createSocketServer(server);

  server.listen(env.port, () => {
    console.log(`PulseBridge server listening on http://localhost:${env.port}`);
  });
};

bootstrap().catch((error) => {
  console.error("PulseBridge server failed to start", error);
  process.exit(1);
});
