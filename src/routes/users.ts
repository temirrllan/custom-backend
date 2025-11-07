import { Router } from "express";
import { User } from "../models/User";

const router = Router();

router.get("/:tgId", async (req, res) => {
  const user = await User.findOne({ tgId: Number(req.params.tgId) }).lean();
  if (!user) return res.status(404).json({ error: "Not found" });
  res.json({ isAdmin: user.isAdmin });
});

export default router;
