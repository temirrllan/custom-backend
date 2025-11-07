import { Router } from "express";
import { Booking } from "../models/Booking";
import { AdminLog } from "../models/AdminLog";
import { adminAuthByTg } from "../middlewares/adminAuthByTg";

const router = Router();

// ✅ Проверка прав администратора по Telegram ID
router.use(adminAuthByTg);

// 🟢 Получить список всех заявок (с фильтром по статусу)
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

// 🟢 Изменить статус заявки
router.put("/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: "Missing status" });

    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!booking) return res.status(404).json({ error: "Booking not found" });

    await AdminLog.create({
      adminTgId: (req as any).adminUser?.tgId,
      action: "update_booking_status",
      details: { bookingId: booking._id, newStatus: status },
    });

    res.json(booking);
  } catch (err) {
    console.error("PUT /api/admin/bookings/:id/status error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
