#!/usr/bin/env node
/**
 * weekly-sync.js — Sincronizacion semanal completa de CRMs
 *
 * Lee las 6 hojas de Google Sheets via OAuth, importa contactos nuevos/actualizados
 * y BORRA los que ya no existen en las hojas.
 *
 * Ejecutar: node scripts/weekly-sync.js
 * Programado: Cada lunes a las 10:30 via Coolify Scheduled Task
 */

const { google } = require("googleapis");

/* ─── Config ─── */
const APP_URL = process.env.APP_URL || "https://emailing.rubencoton.com";
const APP_PASSWORD = process.env.APP_ACCESS_PASSWORD || "+ruben93";

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

const SHEET_IDS = (process.env.SHEETS_SYNC_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);

const BATCH_SIZE = 200;
const BATCH_DELAY_MS = 500;

/* ─── Helpers ─── */
const slugify = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const EMAIL_HEADERS = ["email", "correo", "correo electrónico", "correo electronico", "e-mail"];
const NAME_HEADERS = ["nombre contacto", "nombre completo", "nombre de contacto"];
const COMPANY_HEADERS = ["nombre", "nombre festival", "nombre discografica", "nombre discográfica", "medio o empresa", "nombre influencer"];
const SKIP_TABS = ["ccaa"];

const findHeader = (headers, candidates) => {
  const lower = headers.map((h) => (h || "").toLowerCase().trim());
  for (const c of candidates) { const i = lower.indexOf(c); if (i !== -1) return i; }
  return -1;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ─── Main ─── */
async function main() {
  console.log("=== SYNC SEMANAL COMPLETO ===");
  console.log("Fecha:", new Date().toISOString());
  console.log("App:", APP_URL);
  console.log("Hojas:", SHEET_IDS.length);

  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
    console.error("ERROR: Faltan variables GOOGLE_OAUTH_*");
    process.exit(1);
  }

  /* Auth Google */
  const oauth2 = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
  oauth2.setCredentials({ refresh_token: REFRESH_TOKEN });
  const sheets = google.sheets({ version: "v4", auth: oauth2 });

  /* Login app */
  const loginRes = await fetch(`${APP_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: APP_PASSWORD })
  });
  const cookie = loginRes.headers.get("set-cookie");
  if (!cookie) { console.error("ERROR: Login fallido"); process.exit(1); }
  console.log("Login: OK\n");

  const allImportedEmails = new Set();
  let totalCreated = 0, totalUpdated = 0;

  for (const sheetId of SHEET_IDS) {
    try {
      const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
      const title = meta.data.properties?.title || sheetId;
      const crmSlug = slugify(title.replace(/^🚀\s*CRM:\s*/i, ""));
      const tabNames = (meta.data.sheets || []).map((s) => s.properties.title).filter((t) => !SKIP_TABS.includes(t.toLowerCase()));

      console.log(`📂 ${title} (${tabNames.length} listas)`);

      for (const tab of tabNames) {
        try {
          const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `'${tab}'!A1:Z` });
          const allRows = res.data.values || [];
          if (allRows.length < 2) continue;

          const headers = allRows[0];
          const emailIdx = findHeader(headers, EMAIL_HEADERS);
          if (emailIdx === -1) continue;
          const nameIdx = findHeader(headers, NAME_HEADERS);
          const companyIdx = findHeader(headers, COMPANY_HEADERS);
          const segSlug = slugify(tab);

          const contacts = allRows.slice(1)
            .filter((r) => r[emailIdx] && r[emailIdx].includes("@"))
            .map((r) => {
              const email = r[emailIdx].trim().toLowerCase();
              allImportedEmails.add(email);
              return {
                email,
                firstName: nameIdx !== -1 ? (r[nameIdx] || "").trim() : "",
                company: companyIdx !== -1 ? (r[companyIdx] || "").trim() : "",
                tags: `crm${crmSlug},seg${segSlug}`
              };
            });

          if (!contacts.length) continue;

          let created = 0, updated = 0;
          for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
            const batch = contacts.slice(i, i + BATCH_SIZE);
            try {
              const ir = await fetch(`${APP_URL}/api/contacts/import`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Cookie: cookie },
                body: JSON.stringify({
                  rows: batch,
                  mapping: { email: "email", firstName: "firstName", company: "company", tags: "tags" },
                  mode: "create_or_update",
                  fileName: `sync-${crmSlug}`,
                  fileType: "sheets",
                  source: `sheets:${crmSlug}:${segSlug}`
                })
              });
              const d = await ir.json();
              if (d.report) { created += d.report.created; updated += d.report.updated; }
            } catch (e) { /* retry silencioso */ }
            await sleep(BATCH_DELAY_MS);
          }

          totalCreated += created;
          totalUpdated += updated;
          console.log(`  📋 ${tab}: ${contacts.length} contactos -> +${created} act:${updated}`);
        } catch (e) {
          console.log(`  ❌ ${tab}: ${e.message}`);
        }
      }
    } catch (e) {
      console.log(`❌ Error hoja ${sheetId}: ${e.message}`);
    }
    await sleep(1000);
  }

  /* ─── BORRADO: eliminar contactos que ya no estan en las hojas ─── */
  console.log("\n🗑️  Limpiando contactos eliminados de las hojas...");
  try {
    const cleanupRes = await fetch(`${APP_URL}/api/contacts/cleanup`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        keepEmails: Array.from(allImportedEmails),
        sourcePrefix: "sheets:"
      })
    });
    const cleanup = await cleanupRes.json();
    console.log(`  Eliminados: ${cleanup.removed || 0} | Revisados: ${cleanup.checked || 0}`);
  } catch (e) {
    console.log("  Error en limpieza:", e.message);
  }

  /* ─── Resultado ─── */
  console.log("\n=== RESULTADO ===");
  console.log(`Creados: ${totalCreated}`);
  console.log(`Actualizados: ${totalUpdated}`);
  console.log(`Emails unicos en hojas: ${allImportedEmails.size}`);

  try {
    const health = await (await fetch(`${APP_URL}/health`)).json();
    console.log(`Total contactos en app: ${health.dashboard?.contacts?.total}`);
    const crms = (health.dashboard?.contacts?.tags || []).filter((t) => t.startsWith("crm"));
    console.log(`CRMs: ${crms.length}`);
  } catch (_) {}

  console.log("\n=== FIN ===");
}

main().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
