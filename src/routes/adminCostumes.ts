import { Router } from 'express';
import { Costume } from '../models/Costume';
import { AdminLog } from '../models/AdminLog';

const router = Router();

// Простая "админ-аутентификация" через заголовок x-admin-token === process.env.ADMIN_CHAT_ID
router.use((req, res, next) => {
  const token = req.header('x-admin-token');
  if (!token || token !== process.env.ADMIN_CHAT_ID) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
});

// GET all costumes (admin)
router.get('/', async (req, res) => {
  const list = await Costume.find().lean();
  res.json(list);
});

// POST create costume
router.post('/', async (req, res) => {
  const payload = req.body;
  const created = await Costume.create(payload);
  await AdminLog.create({ action: 'create_costume', details: created });
  res.json(created);
});

// PUT update costume
router.put('/:id', async (req, res) => {
  const updated = await Costume.findByIdAndUpdate(req.params.id, req.body, { new: true });
  await AdminLog.create({ action: 'update_costume', details: updated });
  res.json(updated);
});

// DELETE costume
router.delete('/:id', async (req, res) => {
  const removed = await Costume.findByIdAndDelete(req.params.id);
  await AdminLog.create({ action: 'delete_costume', details: removed });
  res.json({ ok: true });
});

export default router;
