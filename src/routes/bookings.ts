import { Router } from "express";
import { Booking } from "../models/Booking";
import { Costume } from "../models/Costume";
import { validatePhone } from "../utils/validatePhone";
import { bot } from "../bot/bot";
import { appendBookingToSheet, updateBookingStatusInSheet } from "../utils/googleSheets";
import { bookingRateLimit } from "../middlewares/bookingRateLimit";

const router = Router();

// POST /api/bookings - создание брони с уменьшением стока
router.post("/", bookingRateLimit, async (req, res) => {
  try {
    const {
      userTgId,
      clientName,
      phone,
      costumeId,
      size,
      childName,
      childAge,
      childHeight,
    } = req.body;

    if (!userTgId || !clientName || !phone || !costumeId || !size) {
      return res.status(400).json({ error: "Не заполнены обязательные поля" });
    }

    if (!validatePhone(phone)) {
      return res
        .status(400)
        .json({ error: "Неверный формат телефона. Используйте +7XXXXXXXXXX" });
    }

    // 🔒 Атомарное уменьшение стока
    const costume = await Costume.findOneAndUpdate(
      {
        _id: costumeId,
        [`stockBySize.${size}`]: { $gt: 0 },
      },
      {
        $inc: { [`stockBySize.${size}`]: -1 },
      },
      { new: true }
    );

    if (!costume) {
      return res.status(400).json({
        error: `❌ Размер "${size}" закончился или не существует`,
      });
    }

    // Создание бронирования
    const booking = await Booking.create({
      userTgId,
      clientName,
      phone,
      costumeId,
      costumeTitle: costume.title,
      size,
      childName,
      childAge,
      childHeight,
      status: "new",
      type: "online",
    });

    // Добавление в Google Sheets
    let sheetLink = "";
    try {
      sheetLink = await appendBookingToSheet({
        bookingId: String(booking._id), // ✅ Исправлено: явное приведение к строке
        date: new Date().toLocaleString("ru-RU"),
        clientName,
        phone,
        costumeTitle: costume.title,
        size,
        childName,
        childAge,
        childHeight,
        status: "Новая заявка",
        stock: costume.stockBySize?.[size] || 0,
      });
      booking.googleSheetRowLink = sheetLink;
      await booking.save();
    } catch (err) {
      console.warn("❗ Google Sheets append failed:", err);
    }

    // Уведомление администратору
    const adminId = process.env.ADMIN_CHAT_ID;
    if (adminId) {
      const message =
        `🎭 *Новая заявка на костюм!*\n\n` +
        `👤 *Клиент:* ${clientName}\n` +
        `📞 *Телефон:* ${phone}\n` +
        `🧥 *Костюм:* ${costume.title}\n` +
        `📏 *Размер:* ${size}\n` +
        `📦 *Осталось:* ${costume.stockBySize?.[size] || 0} шт.\n` +
        (childName ? `👶 *Имя ребёнка:* ${childName}\n` : "") +
        (childAge ? `🎂 *Возраст:* ${childAge} лет\n` : "") +
        (childHeight ? `📐 *Рост:* ${childHeight} см\n\n` : "\n") +
        (sheetLink ? `🔗 [Открыть в Google Sheets](${sheetLink})\n` : "") +
        `🆔 ID заявки: \`${booking._id}\``;

      try {
        await bot.api.sendMessage(Number(adminId), message, {
          parse_mode: "Markdown",
        });
      } catch (e) {
        console.warn("⚠️ Ошибка отправки уведомления админу:", e);
      }
    }

    res.json(booking);
  } catch (err) {
    console.error("POST /api/bookings error", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// 🆕 GET /api/bookings/my - получить заказы пользователя
router.get("/my", async (req, res) => {
  try {
    const tgId = Number(req.header("x-tg-id"));
    if (!tgId) return res.status(401).json({ error: "Missing x-tg-id header" });

    const bookings = await Booking.find({ userTgId: tgId })
      .sort({ createdAt: -1 })
      .lean();

    res.json(bookings);
  } catch (err) {
    console.error("GET /api/bookings/my error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🆕 PUT /api/bookings/:id/cancel - отменить заказ
router.put("/:id/cancel", async (req, res) => {
  try {
    const tgId = Number(req.header("x-tg-id"));
    if (!tgId) return res.status(401).json({ error: "Missing x-tg-id header" });

    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    // Проверяем, что это заказ пользователя
    if (booking.userTgId !== tgId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Нельзя отменить уже отменённый или завершённый заказ
    if (booking.status === "cancelled" || booking.status === "completed") {
      return res.status(400).json({ error: "Этот заказ уже завершён или отменён" });
    }

    // Возвращаем сток
    await Costume.findByIdAndUpdate(booking.costumeId, {
      $inc: { [`stockBySize.${booking.size}`]: 1 },
    });

    // Меняем статус
    booking.status = "cancelled";
    await booking.save();

    // 🆕 Обновляем Google Sheets
    try {
      await updateBookingStatusInSheet(String(booking._id), "Отменено"); // ✅ Исправлено
    } catch (err) {
      console.warn("❗ Google Sheets update failed:", err);
    }

    console.log(`✅ Заказ ${booking._id} отменён пользователем ${tgId}`);

    res.json({ success: true, booking });
  } catch (err) {
    console.error("PUT /api/bookings/:id/cancel error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;