import { Router } from "express";
import { Booking } from "../models/Booking";
import { Costume } from "../models/Costume";
import { validatePhone } from "../utils/validatePhone";
import { bot } from "../bot/bot";
import { appendBookingWithId, updateBookingByIdInSheet } from "../utils/googleSheets";
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
      bookingDate,
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
    const selectedDate = new Date(bookingDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
      return res.status(400).json({ error: "Нельзя забронировать прошедшую дату" });
    }

    // Получаем костюм
    const costume = await Costume.findById(costumeId);
    if (!costume) {
      return res.status(404).json({ error: "Костюм не найден" });
    }

    // 🔒 ВАЖНО: Получаем ИЗНАЧАЛЬНОЕ общее количество (до уменьшения стока)
    // Это количество, которое было когда костюм только создали
    const currentGeneralStock = costume.stockBySize?.[size] || 0;
    
    console.log(`📊 [BOOKING] Костюм: ${costume.title}, Размер: ${size}`);
    console.log(`📦 [BOOKING] Текущий общий сток: ${currentGeneralStock}`);

    if (currentGeneralStock < 0) {
      return res.status(400).json({
        error: `❌ Размер "${size}" закончился`,
      });
    }

    // 🔒 Считаем, сколько уже АКТИВНЫХ броней на эту дату для этого размера
    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);

    const existingBookings = await Booking.find({
      costumeId,
      size,
      bookingDate: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
      status: { $in: ['new', 'confirmed'] },
    }).lean();

    const existingBookingsCount = existingBookings.length;

    console.log(`📅 [BOOKING] Дата бронирования: ${selectedDate.toLocaleDateString("ru-RU")}`);
    console.log(`🔢 [BOOKING] Уже забронировано на эту дату: ${existingBookingsCount} шт.`);

    // 🔍 КЛЮЧЕВОЙ МОМЕНТ: 
    // Нужно учитывать, сколько ВСЕГО было изначально (когда костюм создали)
    // Для этого смотрим: сколько ВСЕГО броней существует (не только на эту дату)
    const allActiveBookings = await Booking.countDocuments({
      costumeId,
      size,
      status: { $in: ['new', 'confirmed'] },
    });

    console.log(`📊 [BOOKING] Всего активных броней (на все даты): ${allActiveBookings}`);

    // Вычисляем изначальное количество: 
    // текущий сток + уже забронированные = изначальное количество
    const originalTotalStock = currentGeneralStock + allActiveBookings;

    console.log(`🎯 [BOOKING] Изначальное общее количество: ${originalTotalStock}`);
    console.log(`✅ [BOOKING] Можно ещё забронировать на эту дату: ${originalTotalStock - existingBookingsCount}`);

    // Проверяем: если количество броней на эту дату >= изначального количества → дата занята
    if (existingBookingsCount >= originalTotalStock) {
      console.log(`❌ [BOOKING] ОТКЛОНЕНО: Дата полностью занята`);
      return res.status(400).json({
        error: `❌ Эта дата уже занята для размера "${size}". Все костюмы этого размера уже забронированы на ${selectedDate.toLocaleDateString("ru-RU")}.`,
      });
    }

    console.log(`✅ [BOOKING] РАЗРЕШЕНО: Можно создать бронь`);

    // Создание бронирования
    const booking = await Booking.create({
      userTgId,
      clientName,
      phone,
      costumeId,
      costumeTitle: costume.title,
      size,
      bookingDate: new Date(bookingDate),
      childName,
      childAge,
      childHeight,
      status: "new",
      type: "online",
    });

    console.log(`📝 [BOOKING] Бронь создана: ID ${booking._id}`);

    // 🔒 Уменьшаем общий сток только ПОСЛЕ успешного создания брони
    await Costume.findByIdAndUpdate(costumeId, {
      $inc: { [`stockBySize.${size}`]: -1 },
    });

    console.log(`📉 [BOOKING] Общий сток уменьшен: ${currentGeneralStock} → ${currentGeneralStock - 1}`);

    // Добавление в Google Sheets
    let sheetLink = "";
    try {
      sheetLink = await appendBookingWithId({
        bookingId: String(booking._id),
        date: new Date().toLocaleString("ru-RU"),
        bookingDate: new Date(bookingDate).toLocaleDateString("ru-RU"),
        clientName,
        phone,
        costumeTitle: costume.title,
        size,
        childName,
        childAge,
        childHeight,
        status: "Новая заявка",
        stock: currentGeneralStock - 1,
      });
      booking.googleSheetRowLink = sheetLink;
      await booking.save();
    } catch (err) {
      console.warn("❗ Google Sheets append failed:", err);
    }

    // Получаем обновлённый остаток
    const updatedCostume = await Costume.findById(costumeId);
    const remainingStock = updatedCostume?.stockBySize?.[size] || 0;

    console.log(`📦 [BOOKING] Итоговый остаток: ${remainingStock} шт.`);

    // Уведомление администратору
    const adminId = process.env.ADMIN_CHAT_ID;
    if (adminId) {
      const message =
        `🎭 *Новая заявка на костюм!*\n\n` +
        `👤 *Клиент:* ${clientName}\n` +
        `📞 *Телефон:* ${phone}\n` +
        `🧥 *Костюм:* ${costume.title}\n` +
        `📏 *Размер:* ${size}\n` +
        `📅 *Дата аренды:* ${new Date(bookingDate).toLocaleDateString("ru-RU", { 
          day: "numeric", 
          month: "long", 
          year: "numeric" 
        })}\n` +
        `📦 *Общий остаток:* ${remainingStock} шт.\n` +
        `📊 *Забронировано на эту дату:* ${existingBookingsCount + 1} из ${originalTotalStock} шт.\n` +
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
        `📅 *Дата аренды:* ${new Date(bookingDate).toLocaleDateString("ru-RU", { 
          day: "numeric", 
          month: "long", 
          year: "numeric" 
        })}\n\n` +
        `Мы свяжемся с вами для подтверждения.\n` +
        `Спасибо за ваш заказ! 🎉`;

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
        `📅 *Дата аренды:* ${new Date(booking.bookingDate).toLocaleDateString("ru-RU")}\n` +
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