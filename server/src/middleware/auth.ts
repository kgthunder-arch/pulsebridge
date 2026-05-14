import type { NextFunction, Request, Response } from "express";

import type { SanitizedUser } from "../models/User.js";
import { findUserById } from "../repositories/users.js";
import { verifyToken } from "../services/tokenService.js";
import { sanitizeUser } from "../services/serializers.js";

export type AuthedRequest = Request & {
  auth?: SanitizedUser;
};

export const authMiddleware = async (
  request: AuthedRequest,
  response: Response,
  next: NextFunction
) => {
  try {
    const header = request.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      response.status(401).json({ error: "Authentication required." });
      return;
    }

    const payload = verifyToken(token);
    const user = await findUserById(payload.sub);

    if (!user) {
      response.status(401).json({ error: "User session is invalid." });
      return;
    }

    request.auth = sanitizeUser(user);
    next();
  } catch (error) {
    response.status(401).json({ error: "Authentication required." });
  }
};
