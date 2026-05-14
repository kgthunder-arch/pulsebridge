import type { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";

const windowMs = 15 * 60 * 1000; // 15 minutes

export const authLimiter = rateLimit({
  windowMs,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many authentication attempts. Please wait before trying again." }
});

export const aiLimiter = rateLimit({
  windowMs,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "AI request limit reached. Please wait before trying again." }
});

export const apiLimiter = rateLimit({
  windowMs,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." }
});
