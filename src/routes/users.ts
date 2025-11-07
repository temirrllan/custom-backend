import { Router } from "express";
import { User } from "../models/User";

const router = Router();

/**
 * ✅ Эндпоинт для получения информации о пользователе
 * Используется Telegram Mini App — передаёт Telegram ID через заголовок x-tg-id
 */
router.get("/me", async (req, res) => {
  try {
    const tgId = req.header("x-tg-id");

    if (!tgId) {
      return res.status(400).json({ error: "Missing x-tg-id header" });
    }

    const user = await User.findOne({ tgId: Number(tgId) }).lean();

    if (!user) {
      // если нет — можно автоматически создать запись
      const newUser = await User.create({
        tgId: Number(tgId),
        username: req.header("x-tg-username") || "",
        firstName: req.header("x-tg-firstname") || "",
        lastName: req.header("x-tg-lastname") || "",
        isAdmin: false,
      });
      return res.json(newUser);
    }

    return res.json(user);
  } catch (err) {
    console.error("GET /api/users/me error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * ✅ (опционально) эндпоинт, если хочешь получать юзера по ID
 */
router.get("/:tgId", async (req, res) => {
  try {
    const user = await User.findOne({ tgId: Number(req.params.tgId) }).lean();
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    console.error("GET /api/users/:tgId error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
