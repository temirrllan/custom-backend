import { google } from "googleapis";

interface AppendData {
  bookingId: string;
  date: string;           // Дата создания заявки
  bookingDate: string;    // Дата мероприятия
  pickupDate: string;     // 🆕 Дата выдачи
  returnDate: string;     // 🆕 Дата возврата
  clientName: string;
  phone: string;
  costumeTitle: string;
  size: string;
  childName?: string;
  childAge?: string | number;
  childHeight?: string | number;
  status: string;
  stock?: number;
}

export async function appendBookingWithId(data: AppendData): Promise<string> {
  const client_email = process.env.GOOGLE_CLIENT_EMAIL;
  const raw_private_key = process.env.GOOGLE_PRIVATE_KEY;
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const sheetName = process.env.GOOGLE_SHEET_NAME || "Заявки";

  if (!client_email || !raw_private_key || !sheetId) {
    throw new Error("❌ Missing Google credentials");
  }

  const private_key = raw_private_key.replace(/\\n/g, "\n");

  const jwtClient = new google.auth.JWT({
    email: client_email,
    key: private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  await jwtClient.authorize();

  const sheets = google.sheets({ version: "v4", auth: jwtClient });

  // 🆕 ОБНОВЛЁННАЯ СТРУКТУРА ТАБЛИЦЫ (13 колонок):
  // A: Дата создания
  // B: Дата мероприятия
  // C: Дата выдачи (день до, 17:00-19:00)
  // D: Дата возврата (день мероприятия, до 17:00)
  // E: Имя клиента
  // F: Телефон
  // G: Костюм
  // H: Размер
  // I: Имя ребёнка
  // J: Возраст
  // K: Рост
  // L: Статус
  // M: Количество (остаток)
  // N: ID заказа

  const values = [
    [
      data.date || new Date().toLocaleString("ru-RU"),           // A
      data.bookingDate || "",                                    // B
      data.pickupDate || "",                                     // C - 🆕
      data.returnDate || "",                                     // D - 🆕
      data.clientName || "",                                     // E
      data.phone || "",                                          // F
      data.costumeTitle || "",                                   // G
      data.size || "",                                           // H
      data.childName || "",                                      // I
      data.childAge || "",                                       // J
      data.childHeight || "",                                    // K
      data.status || "new",                                      // L
      data.stock !== undefined ? data.stock : "",                // M
      data.bookingId || "",                                      // N
    ],
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: `${sheetName}!A:N`, // 🆕 14 колонок
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });

  return `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
}

// Точное обновление по ID заказа (колонка N)
export async function updateBookingByIdInSheet(
  bookingId: string,
  newStatus: string
): Promise<void> {
  const client_email = process.env.GOOGLE_CLIENT_EMAIL;
  const raw_private_key = process.env.GOOGLE_PRIVATE_KEY;
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const sheetName = process.env.GOOGLE_SHEET_NAME || "Заявки";

  if (!client_email || !raw_private_key || !sheetId) {
    throw new Error("❌ Missing Google credentials");
  }

  const private_key = raw_private_key.replace(/\\n/g, "\n");

  const jwtClient = new google.auth.JWT({
    email: client_email,
    key: private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  await jwtClient.authorize();

  const sheets = google.sheets({ version: "v4", auth: jwtClient });

  // Получаем все данные
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${sheetName}!A:N`,
  });

  const rows = response.data.values;
  if (!rows || rows.length === 0) {
    throw new Error("Таблица пуста");
  }

  // Ищем строку по ID заказа (колонка N, индекс 13)
  let rowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][13] === bookingId) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) {
    console.warn(`⚠️ Заказ ${bookingId} не найден в Google Sheets`);
    return;
  }

  // Обновляем статус (колонка L, индекс 11)
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${sheetName}!L${rowIndex}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[newStatus]],
    },
  });

  console.log(`✅ Google Sheets обновлён: заказ ${bookingId} → статус "${newStatus}"`);
}