import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { adminAuthByTg } from "../middlewares/adminAuthByTg";
import { AdminLog } from "../models/AdminLog";

const router = Router();

// 📁 Папка для хранения файлов (внутри public, чтобы файлы не удалялись)
const uploadsDir = path.join(__dirname, "..", "..", "public", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ⚙️ Настройки Multer
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // максимум 2MB
}).array("photos", 5); // до 5 файлов

// 🟢 Загрузка фотографий (только для админов)
router.post("/", adminAuthByTg, (req, res) => {
  upload(req as any, res as any, async (err: any) => {
    try {
      if (err) {
        console.error("Upload error:", err);
        return res.status(400).json({ error: err.message || "Ошибка загрузки" });
      }

      const files = (req as any).files || [];
      const baseUrl =
        process.env.API_URL || // например, https://myserver.ru
        `${req.protocol}://${req.get("host")}`;

      // 🧩 Сохраняем относительный и полный URL
      const urls = files.map((f: any) => `/uploads/${f.filename}`);
const fullUrls = urls.map((u: string) => `${baseUrl}${u}`);

      // 📜 Лог
      await AdminLog.create({
        adminTgId: (req as any).adminUser?.tgId,
        action: "upload_photos",
        details: { count: urls.length, urls: fullUrls },
      });

      res.json({ urls }); // сохраняем относительные ссылки в БД (лучше)
    } catch (e) {
      console.error("POST /api/admin/upload error:", e);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  });
});

export default router;
