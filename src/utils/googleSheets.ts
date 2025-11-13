import { google } from "googleapis";

interface AppendData {
  date: string;
  clientName: string;
  phone: string;
  costumeTitle: string;
  size: string;
  childName?: string;
  childAge?: string | number;
  childHeight?: string | number;
  status: string;
  stock?: number; // 🆕 остаток на складе
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

  // 🆕 Добавили колонку "Остаток" в конец
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
      data.stock !== undefined ? data.stock : "", // 🆕 остаток
    ],
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: `${sheetName}!A:J`, // 🆕 теперь 10 колонок (было 9)
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });

  return `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
}