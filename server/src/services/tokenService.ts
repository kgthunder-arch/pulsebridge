import jwt from "jsonwebtoken";

import { env } from "../config/env.js";

export type SessionTokenPayload = {
  sub: string;
  username: string;
};

export const signToken = (payload: SessionTokenPayload) =>
  jwt.sign(payload, env.jwtSecret, { expiresIn: "7d" });

export const verifyToken = (token: string) =>
  jwt.verify(token, env.jwtSecret) as SessionTokenPayload;

