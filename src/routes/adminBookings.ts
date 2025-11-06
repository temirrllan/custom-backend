// backend/src/routes/adminBookings.ts
import { Router } from "express";
import { Booking } from "../models/Booking";
import { AdminLog } from "../models/AdminLog";
import { adminAuth } from "../middlewares/adminAuth";

const router = Router();
router.use(adminAuth);

// list bookings (can add filter ?status=)
router.get("/", async (req, res) => {
  const q: any = {};
  if (req.query.status) q.status = req.query.status;
  const list = await Booking.find(q).sort({ createdAt: -1 }).lean();
  res.json(list);
});

// change status
router.put("/:id/status", async (req, res) => {
  const { status } = req.body;
  const b = await Booking.findByIdAndUpdate(req.params.id, { status }, { new: true });
  await AdminLog.create({ action: "booking_status_change", details: { id: b?._id, status } });
  res.json(b);
});

export default router;
