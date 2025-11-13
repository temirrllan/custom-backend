import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import costumesRouter from "./routes/costumes";
import bookingsRouter from "./routes/bookings";
import adminCostumesRouter from "./routes/adminCostumes";
import path from "path";
import adminUploadRouter from "./routes/adminUpload";
dotenv.config();
import adminBookingsRouter from "./routes/adminBookings";
import adminLogsRouter from "./routes/adminLogs";
import usersRouter from "./routes/users";
import userRoutes from "./routes/users";
import adminStockRouter from "./routes/adminStock";
const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get("/", (req, res) => {
  res.send("Nadezhda backend is up ✅");
});

// 📁 ВАЖНО: Раздача статических файлов из папки uploads (снаружи проекта)
const uploadsPath = path.join(__dirname, "..", "..", "uploads");
app.use("/uploads", express.static(uploadsPath));
console.log("📁 Статические файлы раздаются из:", uploadsPath);

// API роуты
app.use("/api/admin/logs", adminLogsRouter);
app.use("/api/admin/bookings", adminBookingsRouter);
app.use("/api/costumes", costumesRouter);
app.use("/api/bookings", bookingsRouter);
app.use("/api/admin/costumes", adminCostumesRouter);
app.use("/api/admin/upload", adminUploadRouter);
app.use("/api/users", usersRouter);
app.use("/api/users", userRoutes);
app.use("/api/admin/stock", adminStockRouter);

export default app;