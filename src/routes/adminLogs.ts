// backend/src/routes/adminLogs.ts
import { Router } from "express";
import { AdminLog } from "../models/AdminLog";
import { adminAuth } from "../middlewares/adminAuth";
const router = Router();

router.use(adminAuth);

router.get("/", async (req, res) => {
  const list = await AdminLog.find().sort({ createdAt: -1 }).limit(200).lean();
  res.json(list);
});

export default router;
