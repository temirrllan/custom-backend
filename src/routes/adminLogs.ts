// backend/src/routes/adminLogs.ts
import { Router } from "express";
import { AdminLog } from "../models/AdminLog";
import { adminAuthByTg } from "../middlewares/adminAuthByTg";
const router = Router();

router.use(adminAuthByTg);

router.get("/", async (req, res) => {
  const list = await AdminLog.find().sort({ createdAt: -1 }).limit(200).lean();
  res.json(list);
});

export default router;
