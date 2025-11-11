import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { adminAuthByTg } from "../middlewares/adminAuthByTg";
import { AdminLog } from "../models/AdminLog";

const router = Router();

// 📁 ВАЖНО: Папка для хранения файлов теперь СНАРУЖИ проекта
// Это гарантирует, что файлы не удалятся при пересборке
const uploadsDir = path.join(__dirname, "..", "..", "..", "uploads");

// Создаём папку, если её нет
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log("✅ Создана папка для загрузок:", uploadsDir);
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
  limits: { fileSize: 5 * 1024 * 1024 }, // увеличили до 5MB
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Разрешены только JPG, PNG и WebP"));
    }
  },
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
      
      if (files.length === 0) {
        return res.status(400).json({ error: "Файлы не загружены" });
      }

      // 🧩 Сохраняем только относительные пути (начинаются с /uploads/)
      const urls = files.map((f: any) => `/uploads/${f.filename}`);

      // 📜 Лог
      await AdminLog.create({
        adminTgId: (req as any).adminUser?.tgId,
        action: "upload_photos",
        details: { count: urls.length, files: files.map((f: any) => f.filename) },
      });

      console.log(`✅ Загружено ${urls.length} фото:`, urls);
      res.json({ urls });
    } catch (e) {
      console.error("POST /api/admin/upload error:", e);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  });
});

export default router;