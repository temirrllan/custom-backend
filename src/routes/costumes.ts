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

    // Ищем все активные брони (new, confirmed) для этого костюма
    const filter: any = {
      costumeId: id,
      status: { $in: ['new', 'confirmed'] },
    };

    // Если указан размер — фильтруем по нему
    if (size) {
      filter.size = size;
    }

    const bookings = await Booking.find(filter).select('bookingDate size').lean();

    // Возвращаем массив занятых дат в формате ISO
    const bookedDates = bookings.map((b) => ({
      date: b.bookingDate.toISOString().split('T')[0], // YYYY-MM-DD
      size: b.size,
    }));

    res.json(bookedDates);
  } catch (err) {
    console.error('GET /api/costumes/:id/booked-dates error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;