import dotenv from "dotenv";
import { connectDB } from "./db";
import app from "./app";
import { bot } from "./bot/bot"; // используем нашего бота с кнопкой

dotenv.config();

const PORT = process.env.PORT || 4000;

async function start() {
  try {
    await connectDB();
    console.log("✅ Database connected");

    // запускаем бота, который импортирован из bot.ts
    bot.start();
    console.log("🤖 Bot started");

    // запускаем сервер Express
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  } catch (err) {
    console.error("❌ Error starting server:", err);
    process.exit(1);
  }
}

start();
