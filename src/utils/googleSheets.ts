import { google } from "googleapis";

interface AppendData {
  bookingId: string;
  date: string; // Дата создания заявки
  bookingDate: string; // 🆕 Дата бронирования (когда клиент хочет получить костюм)
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

  // 🆕 ОБНОВЛЁННЫЙ ПОРЯДОК КОЛОНОК:
  // A: Дата создания | B: Дата бронирования | C: Имя | D: Телефон | E: Костюм | F: Размер 
  // G: Имя ребёнка | H: Возраст | I: Рост | J: Статус | K: Количество | L: ID заказа
  const values = [
    [
      data.date || new Date().toLocaleString("ru-RU"),           // A - Дата создания
      data.bookingDate || "",                                    // B - 🆕 Дата бронирования
      data.clientName || "",                                     // C - Имя клиента
      data.phone || "",                                          // D - Телефон
      data.costumeTitle || "",                                   // E - Костюм
      data.size || "",                                           // F - Размер
      data.childName || "",                                      // G - Имя ребёнка
      data.childAge || "",                                       // H - Возраст
      data.childHeight || "",                                    // I - Рост
      data.status || "new",                                      // J - Статус
      data.stock !== undefined ? data.stock : "",                // K - Количество
      data.bookingId || "",                                      // L - ID заказа
    ],
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: `${sheetName}!A:L`, // 🆕 12 колонок
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });

  return `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
}

// Точное обновление по ID заказа (колонка L)
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
    range: `${sheetName}!A:L`,
  });

  const rows = response.data.values;
  if (!rows || rows.length === 0) {
    throw new Error("Таблица пуста");
  }

  // Ищем строку по ID заказа (колонка L, индекс 11)
  let rowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][11] === bookingId) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) {
    console.warn(`⚠️ Заказ ${bookingId} не найден в Google Sheets`);
    return;
  }

  // Обновляем статус (колонка J)
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${sheetName}!J${rowIndex}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[newStatus]],
    },
  });

  console.log(`✅ Google Sheets обновлён: заказ ${bookingId} → статус "${newStatus}"`);
}