/**
 * Crea CRM 7 — PRUEBAS con rubencoton1993@gmail.com como contacto.
 * El usuario tiene 6 CRMs reales (Sheets que él comparte). Este es el 7º
 * dedicado solo a pruebas locales del sistema.
 */
const { google } = require("googleapis");
require("dotenv").config();

const oauth = new google.auth.OAuth2(
  process.env.GOOGLE_OAUTH_CLIENT_ID,
  process.env.GOOGLE_OAUTH_CLIENT_SECRET
);
oauth.setCredentials({ refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN });

const drive = google.drive({ version: "v3", auth: oauth });
const sheets = google.sheets({ version: "v4", auth: oauth });

(async () => {
  // 1. Crear carpeta "CRM 7 — PRUEBAS"
  console.log("Creando carpeta CRM 7 — PRUEBAS…");
  const folder = await drive.files.create({
    requestBody: {
      name: "CRM 7 — PRUEBAS",
      mimeType: "application/vnd.google-apps.folder"
    },
    fields: "id, name, webViewLink"
  });
  console.log(`✓ Carpeta: ${folder.data.webViewLink}`);

  // 2. Crear Hoja con el contacto de prueba
  console.log("\nCreando hoja con rubencoton1993@gmail.com…");
  const newSheet = await sheets.spreadsheets.create({
    resource: {
      properties: { title: "CRM 7 — PRUEBAS" },
      sheets: [
        {
          properties: { title: "PRUEBAS" },
          data: [
            {
              rowData: [
                {
                  values: [
                    { userEnteredValue: { stringValue: "EMAIL" } },
                    { userEnteredValue: { stringValue: "NOMBRE" } },
                    { userEnteredValue: { stringValue: "EMPRESA" } },
                    { userEnteredValue: { stringValue: "TELEFONO" } },
                    { userEnteredValue: { stringValue: "CIUDAD" } },
                    { userEnteredValue: { stringValue: "TAG" } },
                    { userEnteredValue: { stringValue: "NOTAS" } }
                  ]
                },
                {
                  values: [
                    { userEnteredValue: { stringValue: "rubencoton1993@gmail.com" } },
                    { userEnteredValue: { stringValue: "Rubén Cotón" } },
                    { userEnteredValue: { stringValue: "RUBEN COTON TEST" } },
                    { userEnteredValue: { stringValue: "+34613009336" } },
                    { userEnteredValue: { stringValue: "Madrid" } },
                    { userEnteredValue: { stringValue: "TEST" } },
                    { userEnteredValue: { stringValue: "Contacto de prueba para sistema local" } }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  });

  // 3. Mover la hoja a la carpeta
  await drive.files.update({
    fileId: newSheet.data.spreadsheetId,
    addParents: folder.data.id,
    removeParents: "root",
    fields: "id, parents"
  });

  console.log(`✓ Hoja: ${newSheet.data.spreadsheetUrl}`);
  console.log(`✓ ID: ${newSheet.data.spreadsheetId}`);
  console.log("\n═══════════════════════════════════════════════");
  console.log("  Añade este ID al final de SHEETS_SYNC_IDS:");
  console.log(`  ${newSheet.data.spreadsheetId}`);
  console.log("═══════════════════════════════════════════════");
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
