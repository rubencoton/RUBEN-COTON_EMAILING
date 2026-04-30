/**
 * Crea una nueva hoja Google Sheets "TEST EMAILING LOCAL" con
 * rubencoton1993@gmail.com como contacto de prueba.
 *
 * Uso: node scripts/create_test_sheet.js
 */
const { google } = require("googleapis");
require("dotenv").config();

const oauth = new google.auth.OAuth2(
  process.env.GOOGLE_OAUTH_CLIENT_ID,
  process.env.GOOGLE_OAUTH_CLIENT_SECRET
);
oauth.setCredentials({ refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN });

(async () => {
  const sheets = google.sheets({ version: "v4", auth: oauth });

  // Crear nueva hoja
  console.log("Creando nueva Google Sheet…");
  const newSheet = await sheets.spreadsheets.create({
    resource: {
      properties: { title: "TEST EMAILING LOCAL — Lista pruebas" },
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
                    { userEnteredValue: { stringValue: "TAG" } }
                  ]
                },
                {
                  values: [
                    { userEnteredValue: { stringValue: "rubencoton1993@gmail.com" } },
                    { userEnteredValue: { stringValue: "Rubén Cotón" } },
                    { userEnteredValue: { stringValue: "TEST" } },
                    { userEnteredValue: { stringValue: "TEST" } }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  });

  console.log("\n✅ Hoja creada");
  console.log("ID:", newSheet.data.spreadsheetId);
  console.log("URL:", newSheet.data.spreadsheetUrl);
  console.log("\nAñade este ID a SHEETS_SYNC_IDS en .env y reinicia la app:");
  console.log(`SHEETS_SYNC_IDS=${newSheet.data.spreadsheetId}`);
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
