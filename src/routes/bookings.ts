import { Router } from "express";
import { Booking } from "../models/Booking";
import { Costume } from "../models/Costume";
import { validatePhone } from "../utils/validatePhone";
import { bot } from "../bot/bot";
import { appendBookingToSheet } from "../utils/googleSheets";
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

    // 🔒 Атомарное уменьшение стока (защита от гонки данных)
    const costume = await Costume.findOneAndUpdate(
      {
        _id: costumeId,
        [`stockBySize.${size}`]: { $gt: 0 } // только если сток > 0
      },
      {
        $inc: { [`stockBySize.${size}`]: -1 } // уменьшаем на 1
      },
      { new: true }
    );

    if (!costume) {
      return res.status(400).json({ 
        error: `❌ Размер "${size}" закончился или не существует` 
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
      type: "online", // 🆕 помечаем как онлайн-бронь
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
        stock: costume.stockBySize?.[size] || 0, // 🆕 остаток
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

export default router;