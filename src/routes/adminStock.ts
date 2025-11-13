import { Router } from "express";
import { Costume } from "../models/Costume";
import { Booking } from "../models/Booking";
import { AdminLog } from "../models/AdminLog";
import { adminAuthByTg } from "../middlewares/adminAuthByTg";

const router = Router();
router.use(adminAuthByTg);

// 🟢 Получить текущий остаток всех костюмов
router.get("/", async (_req, res) => {
  try {
    const costumes = await Costume.find().select("title sizes stockBySize photos").lean();
    res.json(costumes);
  } catch (err) {
    console.error("GET /api/admin/stock error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🟢 Изменить количество (+ или -)
router.post("/adjust", async (req, res) => {
  try {
    const { costumeId, size, amount } = req.body; // amount: +1 или -1

    if (!costumeId || !size || amount === undefined) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Проверяем, что не уходим в минус
    const costume = await Costume.findById(costumeId);
    if (!costume) {
      return res.status(404).json({ error: "Costume not found" });
    }

    const currentStock = costume.stockBySize?.[size] || 0;
    const newStock = currentStock + amount;

    if (newStock < 0) {
      return res.status(400).json({ error: "Количество не может быть отрицательным" });
    }

    // Обновляем сток
    await Costume.findByIdAndUpdate(costumeId, {
      $inc: { [`stockBySize.${size}`]: amount }
    });

    // Если это офлайн-аренда (уменьшение), создаём запись
    if (amount < 0) {
      await Booking.create({
        userTgId: 0, // техническая запись
        clientName: "Оффлайн-аренда",
        phone: "+70000000000",
        costumeId,
        costumeTitle: costume.title,
        size,
        status: "confirmed",
        type: "offline",
      });
    }

    // Логируем действие
    await AdminLog.create({
      adminTgId: (req as any).adminUser?.tgId,
      action: "adjust_stock",
      details: { costumeId, costumeTitle: costume.title, size, amount, newStock },
    });

    console.log(`📦 Сток изменён: ${costume.title}, размер ${size}, изменение: ${amount}, новый остаток: ${newStock}`);

    res.json({ success: true, newStock });
  } catch (err) {
    console.error("POST /api/admin/stock/adjust error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;