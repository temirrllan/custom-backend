import { Router } from "express";
import { Booking } from "../models/Booking";
import { Costume } from "../models/Costume";
import { validatePhone } from "../utils/validatePhone";
import { bot } from "../bot/bot";
import { appendBookingToSheet } from "../utils/googleSheets";
import { bookingRateLimit } from "../middlewares/bookingRateLimit";

const router = Router();

// POST /api/bookings
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
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!validatePhone(phone)) {
      return res
        .status(400)
        .json({ error: "Invalid phone format. Use +7XXXXXXXXXX" });
    }

    const costume = await Costume.findById(costumeId);
    if (!costume)
      return res.status(404).json({ error: "Costume not found" });

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
    });

    // Добавление в Google Sheets
    let sheetLink = "";
    try {
      sheetLink = await appendBookingToSheet({
        date: new Date().toLocaleString("ru-RU"),
        clientName,
        phone,
        costumeTitle: costume.title,
        size,
        childName,
        childAge,
        childHeight,
        status: "Новая заявка",
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
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
