import { Bot } from "grammy";
import { User } from "../models/User";
import { Costume } from "../models/Costume";
import { Booking } from "../models/Booking";
import dotenv from "dotenv";
dotenv.config();

export const bot = new Bot(process.env.BOT_TOKEN!);

// 🔹 Команда /start
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
      ? "👑 Вы вошли как администратор.\n\n📋 Команды:\n/rent — Сдать костюм\n/return — Вернуть костюм\n/stock — Посмотреть остатки"
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

// 🔹 Команда /rent (сдать костюм вживую)
bot.command("rent", async (ctx) => {
  const tgId = ctx.from?.id;
  if (!tgId) return;

  const user = await User.findOne({ tgId });
  if (!user || !user.isAdmin) {
    return ctx.reply("❌ Эта команда доступна только администраторам");
  }

  // Формат: /rent Название_костюма Размер
  const args = ctx.message?.text?.split(" ").slice(1);
  if (!args || args.length < 2) {
    return ctx.reply(
      "📝 Формат: `/rent Название_костюма Размер`\n\nПример:\n`/rent Платье_Золушка M`",
      { parse_mode: "Markdown" }
    );
  }

  const costumeName = args.slice(0, -1).join(" ");
  const size = args[args.length - 1];

  try {
    // Ищем костюм по названию (регистронезависимый поиск)
    const costume = await Costume.findOne({
      title: { $regex: new RegExp(`^${costumeName}$`, "i") },
    });

    if (!costume) {
      return ctx.reply(`❌ Костюм "${costumeName}" не найден`);
    }

    // Проверяем наличие размера
    const currentStock = costume.stockBySize?.[size] || 0;
    if (currentStock === 0) {
      return ctx.reply(`❌ Размер "${size}" закончился`);
    }

    // Уменьшаем сток атомарно
    const updated = await Costume.findOneAndUpdate(
      { _id: costume._id, [`stockBySize.${size}`]: { $gt: 0 } },
      { $inc: { [`stockBySize.${size}`]: -1 } },
      { new: true }
    );

    if (!updated) {
      return ctx.reply(`❌ Не удалось обновить сток (возможно, размер закончился)`);
    }

    // Создаём запись об оффлайн-аренде
    await Booking.create({
      userTgId: tgId,
      clientName: "Оффлайн-аренда",
      phone: "+70000000000",
      costumeId: costume._id,
      costumeTitle: costume.title,
      size,
      status: "confirmed",
      type: "offline",
    });

    const newStock = updated.stockBySize?.[size] || 0;
    await ctx.reply(
      `✅ Костюм сдан!\n\n🧥 ${costume.title}\n📏 Размер: ${size}\n📦 Осталось: ${newStock} шт.`,
      { parse_mode: "Markdown" }
    );
  } catch (err) {
    console.error("Ошибка /rent:", err);
    ctx.reply("❌ Произошла ошибка при обработке команды");
  }
});

// 🔹 Команда /return (вернуть костюм)
bot.command("return", async (ctx) => {
  const tgId = ctx.from?.id;
  if (!tgId) return;

  const user = await User.findOne({ tgId });
  if (!user || !user.isAdmin) {
    return ctx.reply("❌ Эта команда доступна только администраторам");
  }

  const args = ctx.message?.text?.split(" ").slice(1);
  if (!args || args.length < 2) {
    return ctx.reply(
      "📝 Формат: `/return Название_костюма Размер`\n\nПример:\n`/return Платье_Золушка M`",
      { parse_mode: "Markdown" }
    );
  }

  const costumeName = args.slice(0, -1).join(" ");
  const size = args[args.length - 1];

  try {
    const costume = await Costume.findOne({
      title: { $regex: new RegExp(`^${costumeName}$`, "i") },
    });

    if (!costume) {
      return ctx.reply(`❌ Костюм "${costumeName}" не найден`);
    }

    // Увеличиваем сток
    await Costume.findByIdAndUpdate(costume._id, {
      $inc: { [`stockBySize.${size}`]: 1 },
    });

    const updatedCostume = await Costume.findById(costume._id);
    const newStock = updatedCostume?.stockBySize?.[size] || 0;

    await ctx.reply(
      `✅ Костюм возвращён!\n\n🧥 ${costume.title}\n📏 Размер: ${size}\n📦 Теперь в наличии: ${newStock} шт.`
    );
  } catch (err) {
    console.error("Ошибка /return:", err);
    ctx.reply("❌ Произошла ошибка при обработке команды");
  }
});

// 🔹 Команда /stock (показать остатки)
bot.command("stock", async (ctx) => {
  const tgId = ctx.from?.id;
  if (!tgId) return;

  const user = await User.findOne({ tgId });
  if (!user || !user.isAdmin) {
    return ctx.reply("❌ Эта команда доступна только администраторам");
  }

  try {
    const costumes = await Costume.find({ available: true }).select("title sizes stockBySize").lean();

    if (costumes.length === 0) {
      return ctx.reply("📦 Нет доступных костюмов");
    }

    let message = "📦 *Остатки на складе:*\n\n";

    for (const c of costumes) {
      message += `🧥 *${c.title}*\n`;
      
      if (c.sizes && c.sizes.length > 0) {
        for (const size of c.sizes) {
          const stock = c.stockBySize?.[size] || 0;
          const icon = stock > 0 ? "✅" : "❌";
          message += `   ${icon} ${size}: ${stock} шт.\n`;
        }
      } else {
        message += "   ⚠️ Размеры не заданы\n";
      }
      
      message += "\n";
    }

    await ctx.reply(message, { parse_mode: "Markdown" });
  } catch (err) {
    console.error("Ошибка /stock:", err);
    ctx.reply("❌ Произошла ошибка при получении данных");
  }
});