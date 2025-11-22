import { Router } from 'express';
import { Costume } from '../models/Costume';
import { Booking } from '../models/Booking';

const router = Router();

// GET /api/costumes - список доступных костюмов
router.get('/', async (req, res) => {
  try {
    const costumes = await Costume.find({ available: true }).lean();
    res.json(costumes);
  } catch (err) {
    console.error('GET /api/costumes error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * 🆕 GET /api/costumes/:id/booked-dates
 * 
 * НОВАЯ ЛОГИКА:
 * - Блокируем только ДАТУ СОБЫТИЯ (eventDate), а НЕ весь период выдачи-возврата
 * - Один размер можно сдавать каждый день
 * - Блокируется дата только если ВСЕ экземпляры этого размера заняты в этот день
 */
router.get('/:id/booked-dates', async (req, res) => {
  try {
    const { id } = req.params;
    const { size } = req.query;

    if (!size) {
      return res.status(400).json({ error: 'Size parameter is required' });
    }

    // Получаем костюм
    const costume = await Costume.findById(id);
    if (!costume) {
      return res.status(404).json({ error: 'Costume not found' });
    }

    const totalStock = costume.stockBySize?.[size as string] || 0;

    if (totalStock === 0) {
      return res.json([]); // Если стока нет вообще, возвращаем пустой список
    }

    // Получаем все активные брони для этого костюма и размера
    const bookings = await Booking.find({
      costumeId: id,
      size: size as string,
      status: { $in: ['new', 'confirmed'] },
    }).select('eventDate').lean();

    console.log(`📅 [BLOCKED_DATES] Костюм: ${costume.title}, Размер: ${size}`);
    console.log(`📦 [BLOCKED_DATES] Всего экземпляров: ${totalStock}`);
    console.log(`📊 [BLOCKED_DATES] Активных броней: ${bookings.length}`);

    if (bookings.length === 0) {
      console.log(`✅ [BLOCKED_DATES] Нет активных броней - все даты свободны`);
      return res.json([]);
    }

    // 🆕 НОВАЯ ЛОГИКА: Считаем количество броней на каждую дату события
    const dateCountMap = new Map<string, number>();

    for (const booking of bookings) {
      const eventDate = new Date(booking.eventDate);
      eventDate.setHours(0, 0, 0, 0);
      const dateStr = eventDate.toISOString().split('T')[0];
      
      dateCountMap.set(dateStr, (dateCountMap.get(dateStr) || 0) + 1);
    }

    // Блокируем даты, где количество броней >= общего количества экземпляров
    const blockedDates: Array<{ date: string; size: string }> = [];

    for (const [dateStr, count] of dateCountMap.entries()) {
      if (count >= totalStock) {
        blockedDates.push({ date: dateStr, size: size as string });
        console.log(`🔒 [BLOCKED_DATES] ${dateStr}: ${count}/${totalStock} - ЗАБЛОКИРОВАНО`);
      } else {
        console.log(`✅ [BLOCKED_DATES] ${dateStr}: ${count}/${totalStock} - свободно`);
      }
    }

    console.log(`🔒 [BLOCKED_DATES] Итого заблокировано дат: ${blockedDates.length}`);

    res.json(blockedDates);
  } catch (err) {
    console.error('GET /api/costumes/:id/booked-dates error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;