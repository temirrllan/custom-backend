import { Bot, InlineKeyboard } from "grammy";
import dotenv from "dotenv";
dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error("❌ BOT_TOKEN не найден в .env");
  process.exit(1);
}

export const bot = new Bot(BOT_TOKEN);

// /start команда
bot.command("start", async (ctx) => {
  try {
    const webAppUrl = process.env.PUBLIC_WEBAPP_URL || "https://example.com";
    const user = ctx.from;

    await ctx.reply(
      "Добро пожаловать в прокат костюмов «Надежда»! 🎭\n\nНажмите кнопку ниже, чтобы открыть каталог 👇",
      {
        reply_markup: new InlineKeyboard().webApp(
          "Открыть каталог",
          `${webAppUrl}?tgId=${user?.id}`
        ),
      }
    );

    console.log(`✅ /start обработан для ${user?.username} (${user?.id})`);
  } catch (err) {
    console.error("Ошибка в /start:", err);
  }
});
