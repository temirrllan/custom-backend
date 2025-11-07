import { Request, Response, NextFunction } from "express";
import { User } from "../models/User";

export async function adminAuthByTg(req: Request, res: Response, next: NextFunction) {
  const tgId = Number(req.header("x-tg-id"));
  if (!tgId) return res.status(401).json({ error: "Missing x-tg-id header" });

  const user = await User.findOne({ tgId });
  if (!user || !user.isAdmin) {
    return res.status(403).json({ error: "Forbidden — not admin" });
  }

  (req as any).adminUser = user;
  next();
}
