import { Router } from "express";
import { Booking } from "../models/Booking";
import { Costume } from "../models/Costume";
import { validatePhone } from "../utils/validatePhone";
import { bot } from "../bot/bot";
import { appendBookingWithId, updateBookingByIdInSheet } from "../utils/googleSheets";
import { bookingRateLimit } from "../middlewares/bookingRateLimit";

const router = Router();

/**
 * 🆕 Вспомогательная функция: расчёт дат выдачи и возврата
 */
function calculateBookingDates(eventDate: Date): {
  pickupDate: Date;
  returnDate: Date;
} {
  const pickup = new Date(eventDate);
  pickup.setDate(pickup.getDate() - 1); // За 1 день до
  pickup.setHours(17, 0, 0, 0);        // 17:00
  
  const returnD = new Date(eventDate);
  returnD.setHours(17, 0, 0, 0);       // До 17:00 в день события
  
  return { pickupDate: pickup, returnDate: returnD };
}

// POST /api/bookings - создание брони
router.post("/", bookingRateLimit, async (req, res) => {
  try {
    const {
      userTgId,
      clientName,
      phone,
      costumeId,
      size,
      bookingDate,  // Дата мероприятия
      childName,
      childAge,
      childHeight,
    } = req.body;

    if (!userTgId || !clientName || !phone || !costumeId || !size || !bookingDate) {
      return res.status(400).json({ error: "Не заполнены обязательные поля" });
    }

    if (!validatePhone(phone)) {
      return res
        .status(400)
        .json({ error: "Неверный формат телефона. Используйте +7XXXXXXXXXX" });
    }

    // Проверяем, что дата не в прошлом
    const eventDate = new Date(bookingDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (eventDate < today) {
      return res.status(400).json({ error: "Нельзя забронировать прошедшую дату" });
    }

    // Получаем костюм
    const costume = await Costume.findById(costumeId);
    if (!costume) {
      return res.status(404).json({ error: "Костюм не найден" });
    }

    // 🆕 Рассчитываем даты выдачи и возврата
    const { pickupDate, returnDate } = calculateBookingDates(eventDate);

    console.log(`📅 [BOOKING] Дата мероприятия: ${eventDate.toLocaleDateString("ru-RU")}`);
    console.log(`📅 [BOOKING] Выдача: ${pickupDate.toLocaleString("ru-RU")}`);
    console.log(`📅 [BOOKING] Возврат: ${returnDate.toLocaleString("ru-RU")}`);

    // 🆕 Получаем общее количество экземпляров этого размера
    const totalStock = costume.stockBySize?.[size] || 0;
    
    if (totalStock === 0) {
      return res.status(400).json({
        error: `❌ Размер "${size}" отсутствует в наличии`,
      });
    }

    console.log(`📦 [BOOKING] Всего экземпляров размера ${size}: ${totalStock}`);

    // 🆕 НОВАЯ ЛОГИКА: Проверяем брони ТОЛЬКО на дату события
    const eventDateStr = eventDate.toISOString().split('T')[0];
    
    const conflictingBookings = await Booking.countDocuments({
      costumeId,
      size,
      status: { $in: ['new', 'confirmed'] },
      eventDate: {
        $gte: new Date(eventDateStr + 'T00:00:00.000Z'),
        $lt: new Date(eventDateStr + 'T23:59:59.999Z')
      }
    });

    console.log(`⚠️ [BOOKING] Броней на ${eventDateStr}: ${conflictingBookings} из ${totalStock} доступных`);

    // 🆕 Проверяем: если количество броней на эту дату >= общего количества экземпляров → отклоняем
    if (conflictingBookings >= totalStock) {
      console.log(`❌ [BOOKING] ОТКЛОНЕНО: Все ${totalStock} экземпляров заняты на ${eventDateStr}`);
      return res.status(400).json({
        error: `❌ К сожалению, все костюмы этого размера (${size}) заняты на ${eventDate.toLocaleDateString("ru-RU")}. Пожалуйста, выберите другую дату.`,
      });
    }

    console.log(`✅ [BOOKING] РАЗРЕШЕНО: Доступно ${totalStock - conflictingBookings} из ${totalStock} экземпляров`);

    // Получаем текущий сток (для информации)
    const currentStock = costume.stockBySize?.[size] || 0;

    // Создание бронирования
    const booking = await Booking.create({
      userTgId,
      clientName,
      phone,
      costumeId,
      costumeTitle: costume.title,
      size,
      bookingDate: eventDate,
      eventDate,
      pickupDate,
      returnDate,
      childName,
      childAge,
      childHeight,
      status: "new",
      type: "online",
    });

    console.log(`📝 [BOOKING] Бронь создана: ID ${booking._id}`);

    // 🔒 Уменьшаем общий сток
    await Costume.findByIdAndUpdate(costumeId, {
      $inc: { [`stockBySize.${size}`]: -1 },
    });

    console.log(`📉 [BOOKING] Общий сток уменьшен: ${currentStock} → ${currentStock - 1}`);

    // Добавление в Google Sheets
    let sheetLink = "";
    try {
      sheetLink = await appendBookingWithId({
        bookingId: String(booking._id),
        date: new Date().toLocaleString("ru-RU"),
        bookingDate: eventDate.toLocaleDateString("ru-RU"),
        pickupDate: pickupDate.toLocaleString("ru-RU"),
        returnDate: returnDate.toLocaleString("ru-RU"),
        clientName,
        phone,
        costumeTitle: costume.title,
        size,
        childName,
        childAge,
        childHeight,
        status: "Новая заявка",
        stock: currentStock - 1,
      });
      booking.googleSheetRowLink = sheetLink;
      await booking.save();
    } catch (err) {
      console.warn("❗ Google Sheets append failed:", err);
    }

    // Получаем обновлённый остаток
    const updatedCostume = await Costume.findById(costumeId);
    const remainingStock = updatedCostume?.stockBySize?.[size] || 0;

    // Уведомление администратору
    const adminId = process.env.ADMIN_CHAT_ID;
    if (adminId) {
      const message =
        `🎭 *Новая заявка на костюм!*\n\n` +
        `👤 *Клиент:* ${clientName}\n` +
        `📞 *Телефон:* ${phone}\n` +
        `🧥 *Костюм:* ${costume.title}\n` +
        `📏 *Размер:* ${size}\n\n` +
        `📅 *Дата мероприятия:* ${eventDate.toLocaleDateString("ru-RU", { 
          day: "numeric", 
          month: "long", 
          year: "numeric" 
        })}\n` +
        `📦 *Выдача:* ${pickupDate.toLocaleDateString("ru-RU")} с 17:00 до 19:00\n` +
        `🔄 *Возврат:* ${returnDate.toLocaleDateString("ru-RU")} до 17:00\n\n` +
        `📦 *Общий остаток:* ${remainingStock} шт.\n` +
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

    // Уведомление пользователю
    try {
      const userMessage =
        `✅ *Ваша заявка успешно оформлена!*\n\n` +
        `🧥 *Костюм:* ${costume.title}\n` +
        `📏 *Размер:* ${size}\n` +
        `📅 *Дата мероприятия:* ${eventDate.toLocaleDateString("ru-RU", { 
          day: "numeric", 
          month: "long", 
          year: "numeric" 
        })}\n\n` +
        `📦 *Выдача костюма:*\n` +
        `${pickupDate.toLocaleDateString("ru-RU")} с 17:00 до 19:00\n\n` +
        `🔄 *Возврат костюма:*\n` +
        `${returnDate.toLocaleDateString("ru-RU")} до 17:00\n\n` +
        `⚠️ При нарушении сроков возврата предусмотрен штраф.\n\n` +
        `Мы свяжемся с вами для подтверждения.\nСпасибо за ваш заказ! 🎉`;

      await bot.api.sendMessage(userTgId, userMessage, {
        parse_mode: "Markdown",
      });
    } catch (e) {
      console.warn("⚠️ Ошибка отправки уведомления пользователю:", e);
    }

    res.json(booking);
  } catch (err) {
    console.error("POST /api/bookings error", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// GET /api/bookings/my - получить заказы пользователя
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

// PUT /api/bookings/:id/cancel - отменить заказ
router.put("/:id/cancel", async (req, res) => {
  try {
    const tgId = Number(req.header("x-tg-id"));
    if (!tgId) return res.status(401).json({ error: "Missing x-tg-id header" });

    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    if (booking.userTgId !== tgId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (booking.status === "cancelled" || booking.status === "completed") {
      return res.status(400).json({ error: "Этот заказ уже завершён или отменён" });
    }

    // Возвращаем сток
    await Costume.findByIdAndUpdate(booking.costumeId, {
      $inc: { [`stockBySize.${booking.size}`]: 1 },
    });

    const oldStatus = booking.status;
    booking.status = "cancelled";
    await booking.save();

    console.log(`🔄 [CANCEL] Заказ ${booking._id} отменён, сток возвращён`);

    // Обновляем Google Sheets
    try {
      await updateBookingByIdInSheet(String(booking._id), "Отменено");
    } catch (err) {
      console.warn("❗ Google Sheets update failed:", err);
    }

    // Уведомление админу об отмене
    const adminId = process.env.ADMIN_CHAT_ID;
    if (adminId) {
      const message =
        `❌ *Заказ отменён пользователем*\n\n` +
        `👤 *Клиент:* ${booking.clientName}\n` +
        `📞 *Телефон:* ${booking.phone}\n` +
        `🧥 *Костюм:* ${booking.costumeTitle}\n` +
        `📏 *Размер:* ${booking.size}\n` +
        `📅 *Дата мероприятия:* ${new Date(booking.eventDate).toLocaleDateString("ru-RU")}\n` +
        `📅 *Дата заказа:* ${new Date(booking.createdAt).toLocaleString("ru-RU")}\n` +
        `📅 *Дата отмены:* ${new Date().toLocaleString("ru-RU")}\n\n` +
        `🔄 *Статус изменён:* ${oldStatus} → cancelled\n` +
        `📦 *Сток возвращён:* +1 к размеру ${booking.size}\n\n` +
        `🆔 ID заявки: \`${booking._id}\``;

      try {
        await bot.api.sendMessage(Number(adminId), message, {
          parse_mode: "Markdown",
        });
      } catch (e) {
        console.warn("⚠️ Ошибка отправки уведомления админу:", e);
      }
    }

    res.json({ success: true, booking });
  } catch (err) {
    console.error("PUT /api/bookings/:id/cancel error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;