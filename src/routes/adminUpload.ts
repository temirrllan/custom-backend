import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { adminAuthByTg } from "../middlewares/adminAuthByTg";
import { AdminLog } from "../models/AdminLog";

const router = Router();

// ✅ Папка uploads (создаётся автоматически, если не существует)
const uploadsDir = path.join(__dirname, "..", "..", "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// ✅ Настройки Multer (хранение файлов)
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
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB максимум
}).array("photos", 5); // поле `photos`, максимум 5 файлов

// ✅ Загрузка фотографий костюмов (только для админов)
router.post("/", adminAuthByTg, (req, res) => {
  upload(req as any, res as any, async (err: any) => {
    try {
      if (err) {
        console.error("Upload error:", err);
        return res.status(400).json({ error: err.message || "Upload error" });
      }

      const files = (req as any).files || [];
      const urls = files.map((f: any) => `/uploads/${f.filename}`);

      // 📜 Логирование загрузки
      await AdminLog.create({
        adminTgId: (req as any).adminUser?.tgId,
        action: "upload_photos",
        details: { count: urls.length, urls },
      });

      res.json({ urls });
    } catch (e) {
      console.error("POST /api/admin/upload error:", e);
      res.status(500).json({ error: "Server error" });
    }
  });
});

export default router;
