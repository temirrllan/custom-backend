import { google } from "googleapis";

interface AppendData {
  bookingId: string; // 🆕 ID заказа для последующего поиска
  date: string;
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

  // 🆕 Добавили колонку "ID заказа" в начало
  const values = [
    [
      data.bookingId || "", // 🆕 ID заказа (1-я колонка)
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
    ],
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: `${sheetName}!A:K`, // 🆕 теперь 11 колонок
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
    range: `${sheetName}!A:K`,
  });

  const rows = response.data.values;
  if (!rows || rows.length === 0) {
    throw new Error("Таблица пуста");
  }

  // 2. Ищем строку с нужным ID (ID в первой колонке)
  let rowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    // начинаем с 1, чтобы пропустить заголовок
    if (rows[i][0] === bookingId) {
      rowIndex = i + 1; // +1 потому что индексация в Sheets начинается с 1
      break;
    }
  }

  if (rowIndex === -1) {
    console.warn(`⚠️ Заказ ${bookingId} не найден в Google Sheets`);
    return;
  }

  // 3. Обновляем статус (10-я колонка = J)
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${sheetName}!J${rowIndex}`, // колонка J = статус
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[newStatus]],
    },
  });

  console.log(`✅ Google Sheets обновлён: заказ ${bookingId} → статус "${newStatus}"`);
}