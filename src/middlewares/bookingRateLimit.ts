// backend/src/middlewares/bookingRateLimit.ts
import { Request, Response, NextFunction } from "express";

const map = new Map<string, number>(); // key -> last timestamp (ms)
const WINDOW_MS = 30 * 1000; // 30 seconds

export function bookingRateLimit(req: Request, res: Response, next: NextFunction) {
  const phone = req.body.phone || req.body.userTgId || "anon";
  const key = phone.toString();
  const last = map.get(key) || 0;
  const now = Date.now();
  if (now - last < WINDOW_MS) {
    return res.status(429).json({ error: "You can create only 1 booking per 30 seconds" });
  }
  map.set(key, now);
  next();
}
