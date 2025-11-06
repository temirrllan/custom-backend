// backend/src/routes/adminUpload.ts
import { Router } from "express";
import multer from "multer";
import path from "path";
import { adminAuth } from "../middlewares/adminAuth";
import fs from "fs";

const router = Router();

// ensure uploads folder
const uploadsDir = path.join(__dirname, "..", "..", "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.random().toString(36).slice(2,8)}${ext}`;
    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
}).array("photos", 5); // поле photos, максимум 5 файлов

router.post("/", adminAuth, (req, res) => {
  upload(req as any, res as any, (err: any) => {
    if (err) {
      return res.status(400).json({ error: err.message || "Upload error" });
    }
    // return URLs relative to server
    const files = (req as any).files || [];
    const urls = files.map((f: any) => `/uploads/${f.filename}`);
    res.json({ urls });
  });
});

export default router;
