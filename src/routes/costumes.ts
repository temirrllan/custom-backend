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
 * Новая логика:
 * - Для каждой даты считаем, сколько активных броней пересекаются с периодом этой даты
 * - Блокируем дату только если количество пересечений >= общего количества экземпляров
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

    if (bookings.length === 0) {
      console.log(`✅ [BLOCKED_DATES] Нет активных броней - все даты свободны`);
      return res.json([]);
    }

    // Функция проверки пересечения периодов
    const periodsOverlap = (
      start1: Date, 
      end1: Date, 
      start2: Date, 
      end2: Date
    ): boolean => {
      return start1.getTime() <= end2.getTime() && end1.getTime() >= start2.getTime();
    };

    // Собираем все уникальные даты из броней
    const allDates = new Set<string>();
    for (const booking of bookings) {
      const pickup = new Date(booking.pickupDate);
      const returnD = new Date(booking.returnDate);
      
      pickup.setHours(0, 0, 0, 0);
      returnD.setHours(0, 0, 0, 0);
      
      const current = new Date(pickup);
      while (current <= returnD) {
        allDates.add(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
      }
    }

    console.log(`📅 [BLOCKED_DATES] Уникальных дат в бронях: ${allDates.size}`);

    // Для каждой уникальной даты проверяем, сколько броней её занимают
    const blockedDates: Array<{ date: string; size: string }> = [];

    for (const dateStr of allDates) {
      // Создаём период для этой даты (с учётом правил выдачи/возврата)
      const eventDate = new Date(dateStr);
      eventDate.setHours(0, 0, 0, 0);
      
      const pickupForDate = new Date(eventDate);
      pickupForDate.setDate(pickupForDate.getDate() - 1);
      pickupForDate.setHours(17, 0, 0, 0);
      
      const returnForDate = new Date(eventDate);
      returnForDate.setHours(17, 0, 0, 0);

      // Считаем, сколько броней пересекаются с этим периодом
      let conflictCount = 0;
      for (const booking of bookings) {
        const bookingPickup = new Date(booking.pickupDate);
        const bookingReturn = new Date(booking.returnDate);
        
        if (periodsOverlap(pickupForDate, returnForDate, bookingPickup, bookingReturn)) {
          conflictCount++;
        }
      }

      // Блокируем дату только если все экземпляры заняты
      if (conflictCount >= totalStock) {
        blockedDates.push({ date: dateStr, size: size as string });
        console.log(`🔒 [BLOCKED_DATES] ${dateStr}: ${conflictCount}/${totalStock} - ЗАБЛОКИРОВАНО`);
      } else {
        console.log(`✅ [BLOCKED_DATES] ${dateStr}: ${conflictCount}/${totalStock} - свободно`);
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