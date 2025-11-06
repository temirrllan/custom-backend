import { Router } from 'express';
import { Booking } from '../models/Booking';
import { Costume } from '../models/Costume';
import { validatePhone } from '../utils/validatePhone';
import { bot } from '../bot/bot';
import { appendBookingToSheet } from "../utils/googleSheets";
import { bookingRateLimit } from "../middlewares/bookingRateLimit";

const router = Router();

// POST /api/bookings
router.post('/',bookingRateLimit, async (req, res) => {
  try {
    const {
      userTgId, clientName, phone, costumeId, size, childName, childAge, childHeight
    } = req.body;

    if (!userTgId || !clientName || !phone || !costumeId || !size) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!validatePhone(phone)) {
      return res.status(400).json({ error: 'Invalid phone format. Use +7XXXXXXXXXX' });
    }

    const costume = await Costume.findById(costumeId);
    if (!costume) return res.status(404).json({ error: 'Costume not found' });

    // create booking
    const booking = await Booking.create({
  userTgId, clientName, phone,
  costumeId, costumeTitle: costume.title,
  size, childName, childAge, childHeight,
  status: "new"
});
// добавим запись в Google Sheet
try {
  const sheetLink = await appendBookingToSheet({
    date: new Date().toLocaleString("ru-RU"),
    clientName,
    phone,
    costumeTitle: costume.title,
    size,
    childAge,
    childHeight,
    status: "new"
  });
  booking.googleSheetRowLink = sheetLink;
  await booking.save();
} catch (err) {
  console.warn("❗ Google Sheets append failed:", err);
}
    // send admin notification if ADMIN_CHAT_ID set
    const adminId = process.env.ADMIN_CHAT_ID;
    if (adminId) {
      const message = `Новая заявка:
Имя: ${clientName}
Телефон: ${phone}
Костюм: ${costume.title}
Размер: ${size}
ID: ${booking._id}`;
      try { await bot.api.sendMessage(Number(adminId), message); } catch (e) { console.warn('Failed sending admin message', e); }
    }

    res.json(booking);
  } catch (err) {
    console.error('POST /api/bookings error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
