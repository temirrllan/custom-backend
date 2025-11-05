import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import costumesRouter from "./routes/costumes";
import bookingsRouter from "./routes/bookings";
import adminCostumesRouter from "./routes/adminCostumes";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get("/", (req, res) => {
  res.send("Nadezhda backend is up ✅");
});

app.use("/api/costumes", costumesRouter);
app.use("/api/bookings", bookingsRouter);
app.use("/api/admin/costumes", adminCostumesRouter);

export default app;
