import { Router } from "express";
import { Booking } from "../models/Booking";
import { Costume } from "../models/Costume";
import { AdminLog } from "../models/AdminLog";
import { adminAuthByTg } from "../middlewares/adminAuthByTg";

const router = Router();

router.use(adminAuthByTg);

// 🟢 Получить список всех заявок
router.get("/", async (req, res) => {
  try {
    const filter: any = {};
    if (req.query.status) filter.status = req.query.status;

    const list = await Booking.find(filter).sort({ createdAt: -1 }).lean();
    res.json(list);
  } catch (err) {
    console.error("GET /api/admin/bookings error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🟢 Изменить статус заявки (с возвратом стока при отмене/завершении)
router.put("/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: "Missing status" });

    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    const oldStatus = booking.status;
    booking.status = status;

    // 🔄 Логика возврата стока
    if (oldStatus !== "cancelled" && oldStatus !== "completed") {
      // Если меняем на "отменена" или "завершена" → возвращаем сток
      if (status === "cancelled" || status === "completed") {
        await Costume.findByIdAndUpdate(booking.costumeId, {
          $inc: { [`stockBySize.${booking.size}`]: 1 }
        });
        console.log(`✅ Возвращён сток: ${booking.costumeTitle}, размер ${booking.size}`);
      }
    }

    await booking.save();

    await AdminLog.create({
      adminTgId: (req as any).adminUser?.tgId,
      action: "update_booking_status",
      details: { bookingId: booking._id, oldStatus, newStatus: status },
    });

    res.json(booking);
  } catch (err) {
    console.error("PUT /api/admin/bookings/:id/status error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;