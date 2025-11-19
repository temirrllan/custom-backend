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

// 🆕 GET /api/costumes/:id/booked-dates - получить занятые даты для костюма
router.get('/:id/booked-dates', async (req, res) => {
  try {
    const { id } = req.params;
    const { size } = req.query;

    if (!size) {
      return res.status(400).json({ error: 'Size parameter is required' });
    }

    // Получаем костюм, чтобы узнать общее количество
    const costume = await Costume.findById(id);
    if (!costume) {
      return res.status(404).json({ error: 'Costume not found' });
    }

    const totalStock = costume.stockBySize?.[size as string] || 0;

    // Ищем все активные брони для этого костюма и размера
    const bookings = await Booking.find({
      costumeId: id,
      size: size as string,
      status: { $in: ['new', 'confirmed'] },
    }).select('bookingDate').lean();

    // Группируем брони по датам и считаем количество
    const dateCount: Record<string, number> = {};
    
    bookings.forEach((b) => {
      const dateStr = b.bookingDate.toISOString().split('T')[0]; // YYYY-MM-DD
      dateCount[dateStr] = (dateCount[dateStr] || 0) + 1;
    });

    // Возвращаем только те даты, где количество броней >= общего количества костюмов
    const fullyBookedDates = Object.entries(dateCount)
      .filter(([_, count]) => count >= totalStock)
      .map(([date, _]) => ({ date, size: size as string }));

    res.json(fullyBookedDates);
  } catch (err) {
    console.error('GET /api/costumes/:id/booked-dates error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;