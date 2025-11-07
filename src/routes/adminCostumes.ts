import { Router } from "express";
import { Costume } from "../models/Costume";
import { AdminLog } from "../models/AdminLog";
import { adminAuthByTg } from "../middlewares/adminAuthByTg";

const router = Router();

// ✅ Проверка прав администратора по Telegram ID (из заголовка x-tg-id)
router.use(adminAuthByTg);

// 🟢 Получить все костюмы
router.get("/", async (_req, res) => {
  try {
    const list = await Costume.find().lean();
    res.json(list);
  } catch (err) {
    console.error("GET /api/admin/costumes error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🟢 Создать костюм
router.post("/", async (req, res) => {
  try {
    const created = await Costume.create(req.body);
    await AdminLog.create({
      adminTgId: (req as any).adminUser?.tgId,
      action: "create_costume",
      details: created,
    });
    res.json(created);
  } catch (err) {
    console.error("POST /api/admin/costumes error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🟢 Обновить костюм
router.put("/:id", async (req, res) => {
  try {
    const updated = await Costume.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: "Costume not found" });

    await AdminLog.create({
      adminTgId: (req as any).adminUser?.tgId,
      action: "update_costume",
      details: updated,
    });

    res.json(updated);
  } catch (err) {
    console.error("PUT /api/admin/costumes/:id error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🟢 Удалить костюм
router.delete("/:id", async (req, res) => {
  try {
    const removed = await Costume.findByIdAndDelete(req.params.id);
    if (!removed) return res.status(404).json({ error: "Costume not found" });

    await AdminLog.create({
      adminTgId: (req as any).adminUser?.tgId,
      action: "delete_costume",
      details: removed,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/admin/costumes/:id error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
