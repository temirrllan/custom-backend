// backend/src/utils/googleSheets.ts
import { google } from "googleapis";

const sheets = google.sheets("v4");

interface AppendData {
  date: string;
  clientName: string;
  phone: string;
  costumeTitle: string;
  size: string;
  childAge?: number;
  childHeight?: number;
  status: string;
}

export async function appendBookingToSheet(data: AppendData): Promise<string> {
  const client_email = process.env.GOOGLE_CLIENT_EMAIL;
  const raw_private_key = process.env.GOOGLE_PRIVATE_KEY;
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const sheetName = process.env.GOOGLE_SHEET_NAME || "Заявки";

  if (!client_email || !raw_private_key || !sheetId) {
    throw new Error("Google Sheets credentials (GOOGLE_CLIENT_EMAIL / GOOGLE_PRIVATE_KEY / GOOGLE_SHEET_ID) are not set");
  }

  // In .env private key stored with escaped newlines \n, replace them to real newlines
  const private_key = raw_private_key.replace(/\\n/g, "\n");

  const jwtClient = new google.auth.JWT({
    email: client_email,
    key: private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  // Authorize
  await jwtClient.authorize();

  const values = [[
    data.date,
    data.clientName,
    data.phone,
    data.costumeTitle,
    data.size,
    data.childAge ?? "",
    data.childHeight ?? "",
    data.status
  ]];

  const resp = await sheets.spreadsheets.values.append({
    auth: jwtClient,
    spreadsheetId: sheetId,
    range: `${sheetName}!A:H`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });

  // Получим ссылку на таблицу — и, по возможности, ссылку на добавленную строку.
  // API возвращает информацию о обновлении; точную ссылку на строку можно сформировать по известному ID таблицы + номеру строки,
  // но проще вернуть ссылку на сам spreadsheet.
  return `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
}
