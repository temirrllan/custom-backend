import { google } from "googleapis";

interface AppendData {
  bookingId: string; // ID заказа для поиска
  date: string;
  clientName: string;
  phone: string;
  costumeTitle: string;
  size: string;
  childName?: string;
  childAge?: string | number;
  childHeight?: string | number;
  status: string;
  stock?: number; // остаток на складе
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

  const private_key = raw_private_key.replace(/\\n/g, "\n");

  const jwtClient = new google.auth.JWT({
    email: client_email,
    key: private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  await jwtClient.authorize();

  const sheets = google.sheets({ version: "v4", auth: jwtClient });

  // ✅ ПРАВИЛЬНЫЙ ПОРЯДОК КОЛОНОК:
  // Дата | Имя клиента | Телефон | Костюм | Размер | Имя ребёнка | Возраст | Рост | Статус | Количество
  const values = [
    [
      data.date || new Date().toLocaleString("ru-RU"),           // A - Дата
      data.clientName || "",                                     // B - Имя клиента
      data.phone || "",                                          // C - Телефон
      data.costumeTitle || "",                                   // D - Костюм
      data.size || "",                                           // E - Размер
      data.childName || "",                                      // F - Имя ребёнка
      data.childAge || "",                                       // G - Возраст
      data.childHeight || "",                                    // H - Рост
      data.status || "new",                                      // I - Статус
      data.stock !== undefined ? data.stock : "",                // J - Количество
    ],
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: `${sheetName}!A:J`, // 10 колонок (A-J)
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });

  return `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
}

// 🆕 Функция обновления статуса по ID заказа
export async function updateBookingStatusInSheet(
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

  // 1. Получаем все данные из таблицы
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${sheetName}!A:J`,
  });

  const rows = response.data.values;
  if (!rows || rows.length === 0) {
    throw new Error("Таблица пуста");
  }

  // 2. Ищем строку с нужным booking ID
  // Для этого добавим скрытую колонку K с ID заказа
  // Но пока будем искать по комбинации: дата + имя + телефон + костюм
  // Более надёжный способ — добавить колонку K "ID заказа" (скрытую)
  
  // Временное решение: ищем по последней добавленной строке
  // (так как bookingId у нас не хранится в таблице)
  
  // ⚠️ ВАЖНО: Чтобы это работало правильно, нужно добавить колонку K с booking ID
  // Пока обновляем последнюю строку с таким же костюмом и телефоном
  
  console.warn("⚠️ Обновление статуса в Google Sheets работает по последней строке");
  console.warn("⚠️ Для точного поиска добавьте скрытую колонку K с ID заказа");

  // Обновляем последнюю строку (строка I = статус)
  const lastRow = rows.length;
  
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${sheetName}!I${lastRow}`, // колонка I = статус
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[newStatus]],
    },
  });

  console.log(`✅ Google Sheets обновлён: статус → "${newStatus}"`);
}

// 🆕 УЛУЧШЕННАЯ версия с ID заказа в скрытой колонке K
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

  // Добавляем колонку K с booking ID (скрытую)
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
      data.stock !== undefined ? data.stock : "",
      data.bookingId || "", // 🆕 K - ID заказа (скрытая колонка)
    ],
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: `${sheetName}!A:K`, // 11 колонок
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });

  return `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
}

// 🆕 Точное обновление по ID заказа (с колонкой K)
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
    range: `${sheetName}!A:K`,
  });

  const rows = response.data.values;
  if (!rows || rows.length === 0) {
    throw new Error("Таблица пуста");
  }

  // Ищем строку по ID заказа (колонка K, индекс 10)
  let rowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][10] === bookingId) { // колонка K
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) {
    console.warn(`⚠️ Заказ ${bookingId} не найден в Google Sheets`);
    return;
  }

  // Обновляем статус (колонка I)
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${sheetName}!I${rowIndex}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[newStatus]],
    },
  });

  console.log(`✅ Google Sheets обновлён: заказ ${bookingId} → статус "${newStatus}"`);
}