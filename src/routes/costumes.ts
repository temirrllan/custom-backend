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
 * Возвращает список дат, которые заблокированы для бронирования
 * 
 * Логика:
 * - Для каждой активной брони получаем pickupDate и returnDate
 * - Блокируем все даты в этом диапазоне
 * - Учитываем количество экземпляров костюма
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
    }).select('eventDate pickupDate returnDate').lean();

    console.log(`📅 [BLOCKED_DATES] Костюм: ${costume.title}, Размер: ${size}`);
    console.log(`📦 [BLOCKED_DATES] Всего экземпляров: ${totalStock}`);
    console.log(`📊 [BLOCKED_DATES] Активных броней: ${bookings.length}`);

    // Группируем даты по дням и считаем количество броней в каждый день
    const dateCounts: Map<string, number> = new Map();

    for (const booking of bookings) {
      // Получаем все даты в диапазоне [pickupDate, returnDate]
      const pickup = new Date(booking.pickupDate);
      const returnD = new Date(booking.returnDate);
      
      // Сбрасываем время для корректного сравнения
      pickup.setHours(0, 0, 0, 0);
      returnD.setHours(0, 0, 0, 0);
      
      // Добавляем все даты в диапазоне
      const current = new Date(pickup);
      while (current <= returnD) {
        const dateStr = current.toISOString().split('T')[0]; // YYYY-MM-DD
        dateCounts.set(dateStr, (dateCounts.get(dateStr) || 0) + 1);
        current.setDate(current.getDate() + 1);
      }
    }

    // Возвращаем только те даты, где количество броней >= общего количества экземпляров
    const blockedDates: Array<{ date: string; size: string }> = [];
    
    for (const [date, count] of dateCounts.entries()) {
      if (count >= totalStock) {
        blockedDates.push({ date, size: size as string });
      }
    }

    console.log(`🔒 [BLOCKED_DATES] Заблокировано дат: ${blockedDates.length}`);

    res.json(blockedDates);
  } catch (err) {
    console.error('GET /api/costumes/:id/booked-dates error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;