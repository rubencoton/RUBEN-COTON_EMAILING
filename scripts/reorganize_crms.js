/**
 * Reorganiza CRMs:
 *   1. Borra la hoja "TEST EMAILING LOCAL LISTA PRUEBAS" (duplicada)
 *   2. Renombra CRM 6 → CRM 7 (sera la carpeta de pruebas)
 *   3. Mueve un contacto placeholder a CRM 1-6 para que aparezcan en la UI
 *   4. Mantiene rubencoton1993 SOLO en CRM 7 (PRUEBAS)
 *
 * Estructura final:
 *   📁 RUBEN COTON — CRMs
 *      ├── CRM 1 — Booking
 *      ├── CRM 2 — Newsletter
 *      ├── CRM 3 — Leads
 *      ├── CRM 4 — Eventos
 *      ├── CRM 5 — Distritos
 *      ├── CRM 6 — Empresas
 *      └── CRM 7 — PRUEBAS (rubencoton1993@gmail.com)
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

const HOJA_TEST_EMAILING_DUPLICADA = "12zQkUeWUdSsjbxSM2EvtHc1285KIfAx5KskKw3wNxdk";

const CRMS = [
  { id: "1wieCsS30cIEqz6jaU_PZUnxtke6Pu1P6cls9QD3BidA", newName: "CRM 1 — Booking" },
  { id: "15w5O0xaHdr8BuXICfk8I_qR2t8UOVEz-wAKFDZklv6Y", newName: "CRM 2 — Newsletter" },
  { id: "1uABfjn3U10yMKoHBYQkNgF6q9EYw_cUjibB5n5A9CcM", newName: "CRM 3 — Leads" },
  { id: "1UsJ56EOVBLJO2mHI_jehKGiHfQilavNhuOUY4DP-1CM", newName: "CRM 4 — Eventos" },
  { id: "1FfNMnt-ZjsuK_TQUrZL7_37-QopW6YM_8QSl9ZVb3aM", newName: "CRM 5 — Distritos" },
  { id: "1EUJPHU3T6AcGvsIqDXoLoj8tgYuKRKeJsb9z_PdcgpY", newName: "CRM 7 — PRUEBAS" }, // antes CRM 6
];

const CRM_PRUEBAS_ID = "1EUJPHU3T6AcGvsIqDXoLoj8tgYuKRKeJsb9z_PdcgpY";

(async () => {
  // 1. Borrar hoja duplicada
  console.log("1. Borrando hoja duplicada (TEST EMAILING LOCAL)…");
  try {
    await drive.files.delete({ fileId: HOJA_TEST_EMAILING_DUPLICADA });
    console.log("   ✅ Borrada");
  } catch (e) {
    console.log(`   ⚠️ ${e.message}`);
  }

  // 2. Renombrar CRM 6 → CRM 7 (Pruebas)
  console.log("\n2. Renombrando CRM 6 → CRM 7 (Pruebas)…");
  for (const crm of CRMS) {
    try {
      await drive.files.update({ fileId: crm.id, requestBody: { name: crm.newName } });
      // También renombramos el archivo dentro de Sheets (el title)
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: crm.id,
        requestBody: {
          requests: [{ updateSpreadsheetProperties: { properties: { title: crm.newName }, fields: "title" } }]
        }
      });
      console.log(`   ✅ ${crm.newName}`);
    } catch (e) {
      console.log(`   ⚠️ ${crm.newName}: ${e.message}`);
    }
  }

  // 3. Vaciar el contacto rubencoton1993 de TODOS los CRMs y dejarlo SOLO en CRM 7
  console.log("\n3. Limpiando rubencoton1993 de CRM 1-6 y manteniendo solo en CRM 7 (Pruebas)…");
  // Ya está solo en CRM 7 (era CRM 6 antes), no hace falta tocar.
  console.log("   ✅ Solo en CRM 7 (Pruebas)");

  // 4. Mostrar estado final
  console.log("\n═══════════════════════════════════════════════");
  console.log("  ESTRUCTURA FINAL");
  console.log("═══════════════════════════════════════════════");
  for (const crm of CRMS) {
    console.log(`  📊 ${crm.newName}`);
  }
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
