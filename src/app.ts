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


const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use("/api/admin/logs", adminLogsRouter);

app.get("/", (req, res) => {
  res.send("Nadezhda backend is up ✅");
});
const uploadsPath = path.join(__dirname, "..", "uploads");
app.use("/uploads", express.static(path.join(__dirname, "../public/uploads")));
app.use("/api/admin/bookings", adminBookingsRouter);
// admin upload route
app.use("/api/costumes", costumesRouter);
app.use("/api/bookings", bookingsRouter);
app.use("/api/admin/costumes", adminCostumesRouter);
app.use("/api/admin/upload", adminUploadRouter);
app.use("/api/users", usersRouter);
app.use("/api/users", userRoutes);

export default app;
  