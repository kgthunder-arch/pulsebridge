import bcrypt from "bcryptjs";
import { Router } from "express";

import { authMiddleware, type AuthedRequest } from "../middleware/auth.js";
import { createUser, findUserByEmailOrUsername, findUserById } from "../repositories/users.js";
import {
  createRefreshToken,
  consumeRefreshToken,
  revokeAllRefreshTokensForUser
} from "../repositories/refreshTokens.js";
import { signToken } from "../services/tokenService.js";
import { sanitizeUser } from "../services/serializers.js";

const router = Router();

router.post("/register", async (request, response) => {
  const {
    email,
    username,
    password,
    publicKey,
    encryptedPrivateKey,
    privateKeySalt,
    privateKeyIv,
    preferredLanguage = "en",
    preferredTheme = "aurora"
  } = request.body ?? {};

  if (
    !email ||
    !username ||
    !password ||
    !publicKey ||
    !encryptedPrivateKey ||
    !privateKeySalt ||
    !privateKeyIv
  ) {
    response.status(400).json({ error: "Missing required registration fields." });
    return;
  }

  const existingUser =
    (await findUserByEmailOrUsername(String(email).toLowerCase())) ??
    (await findUserByEmailOrUsername(String(username)));

  if (existingUser) {
    response.status(409).json({ error: "A user with that email or username already exists." });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await createUser({
    email: String(email).toLowerCase(),
    username,
    passwordHash,
    publicKey,
    encryptedPrivateKey,
    privateKeySalt,
    privateKeyIv,
    preferredLanguage,
    preferredTheme,
    avatarSeed: `${username}-${Date.now()}`
  });

  const token = signToken({ sub: user.id, username: user.username });
  const refreshToken = await createRefreshToken(user.id);

  response.status(201).json({
    token,
    refreshToken,
    user: sanitizeUser(user)
  });
});

router.post("/login", async (request, response) => {
  const { emailOrUsername, password } = request.body ?? {};

  if (!emailOrUsername || !password) {
    response.status(400).json({ error: "Email/username and password are required." });
    return;
  }

  const user = await findUserByEmailOrUsername(String(emailOrUsername));

  if (!user) {
    response.status(401).json({ error: "Invalid credentials." });
    return;
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);

  if (!isValid) {
    response.status(401).json({ error: "Invalid credentials." });
    return;
  }

  const token = signToken({ sub: user.id, username: user.username });
  const refreshToken = await createRefreshToken(user.id);

  response.json({
    token,
    refreshToken,
    user: sanitizeUser(user)
  });
});

router.get("/me", authMiddleware, async (request: AuthedRequest, response) => {
  response.json({ user: request.auth });
});

router.post("/refresh", async (request, response) => {
  const { refreshToken } = request.body ?? {};

  if (!refreshToken || typeof refreshToken !== "string") {
    response.status(400).json({ error: "Refresh token is required." });
    return;
  }

  const userId = await consumeRefreshToken(refreshToken);

  if (!userId) {
    response.status(401).json({ error: "Invalid or expired refresh token." });
    return;
  }

  const user = await findUserById(userId);

  if (!user) {
    response.status(401).json({ error: "User not found." });
    return;
  }

  const newToken = signToken({ sub: user.id, username: user.username });
  const newRefreshToken = await createRefreshToken(user.id);

  response.json({
    token: newToken,
    refreshToken: newRefreshToken,
    user: sanitizeUser(user)
  });
});

router.post("/logout", authMiddleware, async (request: AuthedRequest, response) => {
  if (request.auth?.id) {
    await revokeAllRefreshTokensForUser(request.auth.id);
  }
  response.json({ ok: true });
});

export default router;
