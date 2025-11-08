// backend/src/utils/googleSheets.ts
import { google } from "googleapis";

interface AppendData {
  date: string;
  clientName: string;
  phone: string;
  costumeTitle: string;
  size: string;
  childName?: string;
  childAge?: string;
  childHeight?: string;
  status: string;
}

export async function appendBookingToSheet(data: AppendData): Promise<string> {
  const client_email = process.env.GOOGLE_CLIENT_EMAIL;
  const raw_private_key = process.env.GOOGLE_PRIVATE_KEY;
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const sheetName = process.env.GOOGLE_SHEET_NAME || "Заявки";

  if (!client_email || !raw_private_key || !sheetId) {
    throw new Error(
      "❌ Missing Google credentials (GOOGLE_CLIENT_EMAIL / GOOGLE_PRIVATE_KEY / GOOGLE_SHEET_ID)"
    );
  }

  // Преобразуем приватный ключ (заменяем \n на реальные переводы строк)
  const private_key = raw_private_key.replace(/\\n/g, "\n");

  // Авторизация в Google API
  const jwtClient = new google.auth.JWT({
    email: client_email,
    key: private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  await jwtClient.authorize();

  const sheets = google.sheets({ version: "v4", auth: jwtClient });

  // Формируем строку данных в нужном порядке
  const values = [
    [
      data.date || new Date().toLocaleString("ru-RU"),
      data.clientName || "",
      data.phone || "",
      data.costumeTitle || "",
      data.size || "",
      data.childName || "",
      data.childAge || "",
      data.childHeight || "",
      data.status || "new",
    ],
  ];

  // Добавляем строку в таблицу
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: `${sheetName}!A:I`, // 9 колонок
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });

  // Возвращаем ссылку на таблицу
  return `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
}
