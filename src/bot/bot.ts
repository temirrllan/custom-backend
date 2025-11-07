import { Bot } from "grammy";
import { User } from "../models/User";
import dotenv from "dotenv";
dotenv.config();

export const bot = new Bot(process.env.BOT_TOKEN!);

bot.command("start", async (ctx) => {
  const tgId = ctx.from?.id;
  if (!tgId) return;

  const adminIds = (process.env.ADMIN_TG_IDS || "").split(",").map((x) => x.trim());
  const isAdmin = adminIds.includes(tgId.toString());

  await User.findOneAndUpdate(
    { tgId },
    {
      tgId,
      username: ctx.from?.username,
      firstName: ctx.from?.first_name,
      lastName: ctx.from?.last_name,
      isAdmin,
    },
    { upsert: true }
  );

  const webAppUrl = process.env.PUBLIC_WEBAPP_URL!;
  await ctx.reply(
    isAdmin
      ? "👑 Вы вошли как администратор."
      : "Добро пожаловать! Вы можете выбрать костюм из каталога.",
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: isAdmin ? "Открыть админ-панель" : "Открыть каталог",
              web_app: { url: webAppUrl },
            },
          ],
        ],
      },
    }
  );
});
