/**
 * Crea 6 CRMs en Google Drive:
 *   - 6 carpetas (una por CRM)
 *   - 1 hoja de cálculo dentro de cada carpeta
 *
 * Salida: imprime los 6 IDs separados por coma listos para SHEETS_SYNC_IDS.
 *
 * Uso: node scripts/create_6_crms.js
 */
const { google } = require("googleapis");
require("dotenv").config();

const CRMS = [
  { name: "CRM 1 — Booking",       sheetName: "CONTACTOS" },
  { name: "CRM 2 — Newsletter",    sheetName: "CONTACTOS" },
  { name: "CRM 3 — Leads",         sheetName: "CONTACTOS" },
  { name: "CRM 4 — Eventos",       sheetName: "CONTACTOS" },
  { name: "CRM 5 — Distritos",     sheetName: "CONTACTOS" },
  { name: "CRM 6 — Pruebas",       sheetName: "CONTACTOS" }
];

const HEADERS = ["EMAIL", "NOMBRE", "EMPRESA", "TELEFONO", "CIUDAD", "TAG", "NOTAS"];

const oauth = new google.auth.OAuth2(
  process.env.GOOGLE_OAUTH_CLIENT_ID,
  process.env.GOOGLE_OAUTH_CLIENT_SECRET
);
oauth.setCredentials({ refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN });

const drive = google.drive({ version: "v3", auth: oauth });
const sheets = google.sheets({ version: "v4", auth: oauth });

(async () => {
  // 1. Crear carpeta paraguas "ARTES BUHO — CRMs"
  console.log("Creando carpeta paraguas…");
  const umbrella = await drive.files.create({
    requestBody: {
      name: "ARTES BUHO — CRMs (Emailing local)",
      mimeType: "application/vnd.google-apps.folder"
    },
    fields: "id, name, webViewLink"
  });
  console.log(`✅ Carpeta: ${umbrella.data.name}`);
  console.log(`   ${umbrella.data.webViewLink}\n`);

  const sheetIds = [];

  for (const crm of CRMS) {
    // 2a. Crear sub-carpeta del CRM
    const folder = await drive.files.create({
      requestBody: {
        name: crm.name,
        mimeType: "application/vnd.google-apps.folder",
        parents: [umbrella.data.id]
      },
      fields: "id, name, webViewLink"
    });

    // 2b. Crear hoja dentro de la sub-carpeta
    const sheet = await sheets.spreadsheets.create({
      resource: {
        properties: { title: crm.name },
        sheets: [
          {
            properties: { title: crm.sheetName },
            data: [
              {
                rowData: [
                  { values: HEADERS.map((h) => ({ userEnteredValue: { stringValue: h } })) }
                ]
              }
            ]
          }
        ]
      }
    });

    // 2c. Mover la hoja a la sub-carpeta del CRM
    await drive.files.update({
      fileId: sheet.data.spreadsheetId,
      addParents: folder.data.id,
      removeParents: "root",
      fields: "id, parents"
    });

    sheetIds.push(sheet.data.spreadsheetId);
    console.log(`✅ ${crm.name}`);
    console.log(`   📁 Folder: ${folder.data.webViewLink}`);
    console.log(`   📊 Sheet: ${sheet.data.spreadsheetUrl}`);
    console.log(`   ID: ${sheet.data.spreadsheetId}\n`);
  }

  console.log("═══════════════════════════════════════════════");
  console.log("Añade esto a tu .env:");
  console.log("═══════════════════════════════════════════════");
  console.log(`SHEETS_SYNC_IDS=${sheetIds.join(",")}`);
  console.log("═══════════════════════════════════════════════");
})().catch((e) => {
  console.error("ERROR:", e.message);
  if (e.errors) console.error(JSON.stringify(e.errors, null, 2));
  process.exit(1);
});
