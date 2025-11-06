// backend/src/middlewares/adminAuth.ts
import { Request, Response, NextFunction } from "express";

export function adminAuth(req: Request, res: Response, next: NextFunction) {
  const token = (req.header("x-admin-token") || "").toString();
  const envToken = process.env.ADMIN_TOKEN || process.env.ADMIN_CHAT_ID;
  if (!token || token !== envToken) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}
