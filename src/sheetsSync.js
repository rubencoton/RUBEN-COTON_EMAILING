/**
 * sheetsSync.js — Sincronizacion SOLO LECTURA de Google Sheets → dataStore
 *
 * Lee hojas de calculo CRM de Google Sheets y las importa como contactos.
 * NUNCA escribe en las hojas. Solo lectura.
 *
 * MODO MIRROR (SHEETS_MIRROR=true por defecto):
 *  - Sheets es la UNICA fuente de verdad.
 *  - Si eliminas una pestana de una hoja -> se eliminan sus contactos en la BD.
 *  - Si quitas un contacto de una pestana -> se elimina de la BD.
 *  - Si cambias datos de un contacto -> se actualizan en la BD.
 *  - Las hojas leidas con error NO purgan datos (seguridad).
 */

const { google } = require("googleapis");
const { getOAuthClient } = require("./googleHub");

/* ─── Config ─── */
const CREDENTIALS_JSON = process.env.GOOGLE_SHEETS_CREDENTIALS || "";
const API_KEY = process.env.GOOGLE_SHEETS_API_KEY || "";
const OAUTH_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || "";
const OAUTH_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET || "";
const OAUTH_REFRESH_TOKEN = process.env.GOOGLE_OAUTH_REFRESH_TOKEN || "";
const SHEET_IDS_FROM_ENV = (process.env.SHEETS_SYNC_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
/* Hojas hard-coded — vaciado 2026-04-30 (peticion usuario):
 * "los antiguos los desconectamos y te conectas a la nueva carpeta".
 * A partir de ahora SOLO se sincroniza lo que el usuario pone en la
 * carpeta SHEETS_SYNC_FOLDER_ID. Cada pestaña = una lista.
 *
 * Se mantiene la lista por si en el futuro se quiere fijar alguna hoja
 * fuera de la carpeta auto-detect. */
const SHEET_IDS_BUILTIN = [];

/* Carpeta Drive donde el usuario deja las hojas CRM. Cualquier spreadsheet
 * dentro de esta carpeta se sincroniza automaticamente — el usuario solo
 * tiene que arrastrar/crear la hoja alli y el sync la coge en el siguiente
 * tick (peticion 2026-04-30). */
const SHEETS_FOLDER_ID = process.env.SHEETS_SYNC_FOLDER_ID || "";

/* Cache para los IDs descubiertos en la carpeta. Se invalida cada N min
 * para que las hojas nuevas aparezcan automaticamente. */
let _folderCache = { ids: [], at: 0 };
const FOLDER_CACHE_MS = 5 * 60 * 1000; /* 5 min */

const discoverSheetsInFolder = async () => {
  if (!SHEETS_FOLDER_ID) return [];
  const now = Date.now();
  if (_folderCache.ids.length && now - _folderCache.at < FOLDER_CACHE_MS) {
    return _folderCache.ids;
  }
  try {
    const auth = getAuth();
    if (!auth) return _folderCache.ids;
    const drive = google.drive({ version: "v3", auth });
    const r = await drive.files.list({
      q: `'${SHEETS_FOLDER_ID}' in parents and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`,
      fields: "files(id,name,modifiedTime)",
      pageSize: 100,
      corpora: "allDrives",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      orderBy: "name"
    });
    const ids = (r.data.files || []).map((f) => f.id);
    _folderCache = { ids, at: now };
    if (ids.length > 0 && _folderCache.ids.length !== ids.length) {
      console.log(`[sheetsSync] auto-detect carpeta: ${ids.length} hojas encontradas`);
    }
    return ids;
  } catch (e) {
    console.warn("[sheetsSync] discoverSheetsInFolder error:", e.message);
    return _folderCache.ids;
  }
};
/* dataStore-managed (anadidas desde UI). Se resuelven en runtime. */
let _dataStoreRef = null;
const getExtraIdsFromDataStore = () => {
  try {
    if (!_dataStoreRef) return [];
    const store = _dataStoreRef.read();
    const arr = (store.settings && Array.isArray(store.settings.extraSheetIds)) ? store.settings.extraSheetIds : [];
    return arr.map((s) => String(s || "").trim()).filter(Boolean);
  } catch { return []; }
};
const getActiveSheetIds = () => {
  /* Sync: incluye los del cache de la carpeta (puede estar vacio si aun
   * no se hizo discover). El sync principal hace discoverSheetsInFolder
   * antes de llamar a esto, asi que el cache estara fresco. */
  const set = new Set([
    ...SHEET_IDS_FROM_ENV,
    ...SHEET_IDS_BUILTIN,
    ...getExtraIdsFromDataStore(),
    ..._folderCache.ids
  ]);
  return [...set];
};

/* Async: descubre hojas en la carpeta + devuelve lista completa. Usar
 * desde el sync principal para asegurar que tenemos la lista mas reciente. */
const getActiveSheetIdsFresh = async () => {
  await discoverSheetsInFolder();
  return getActiveSheetIds();
};

/* Back-compat: getter que siempre devuelve array dinamico. */
const getSheetIds = () => getActiveSheetIds();
const setDataStoreRef = (ds) => { _dataStoreRef = ds; };
const addExtraSheetId = (id) => {
  if (!_dataStoreRef) throw new Error("dataStore no inicializado");
  const clean = String(id || "").trim();
  if (!clean) throw new Error("ID vacio");
  _dataStoreRef.mutate((store) => {
    if (!store.settings) store.settings = {};
    if (!Array.isArray(store.settings.extraSheetIds)) store.settings.extraSheetIds = [];
    if (!store.settings.extraSheetIds.includes(clean)) store.settings.extraSheetIds.push(clean);
  });
  return getActiveSheetIds();
};
const removeExtraSheetId = (id) => {
  if (!_dataStoreRef) throw new Error("dataStore no inicializado");
  _dataStoreRef.mutate((store) => {
    if (!store.settings || !Array.isArray(store.settings.extraSheetIds)) return;
    store.settings.extraSheetIds = store.settings.extraSheetIds.filter((s) => s !== id);
  });
  return getActiveSheetIds();
};
const SYNC_INTERVAL_HOURS = Number(process.env.SHEETS_SYNC_INTERVAL_HOURS) || 2;
const MIRROR_MODE = String(process.env.SHEETS_MIRROR || "true").toLowerCase() !== "false";

/* ─── State ─── */
const syncState = {
  lastSync: null,
  running: false,
  results: [],
  totalContacts: 0,
  errors: []
};

/* ─── Email column detection (case-insensitive) ─── */
const EMAIL_HEADERS = ["email", "correo", "correo electrónico", "correo electronico", "e-mail", "correo electrónico"];
const NAME_HEADERS = ["nombre contacto", "nombre completo", "nombre de contacto"];
const COMPANY_HEADERS = ["nombre", "nombre festival", "nombre discografica", "nombre discográfica", "medio o empresa", "nombre influencer", "nombre grupo", "nombre discoteca"];
const PHONE_HEADERS = ["telefono", "teléfono"];
const PROVINCE_HEADERS = ["provincia"];
const CCAA_HEADERS = ["ccaa", "c.c.a.", "comunidad autónoma", "comunidad autonoma"];
const CITY_HEADERS = ["municipio", "ubicacion", "ubicación"];
const POPULATION_HEADERS = ["poblacion", "población"];
const MERGE_STATUS_HEADERS = ["merge status", "estado", "estado envio", "estado envío"];

const findHeader = (headers, candidates) => {
  const lower = headers.map((h) => (h || "").toLowerCase().trim());
  for (const candidate of candidates) {
    const idx = lower.indexOf(candidate);
    if (idx !== -1) return idx;
  }
  return -1;
};

/* ─── Skip reference tabs ─── */
const SKIP_TABS = ["ccaa"];

/* ─── Skip CRMs completos (sheets enteros) ───
 * PETICION USUARIO 2026-05-05: la carpeta "PRUEBA HOJA DE TESTEO CRM" es
 * una hoja de pruebas y NO debe cargarse en el sistema (no aparece en
 * Inicio, no aparece en Crear campaña, no se sincroniza, no se hace
 * writeback). Match por slug normalizado del título del spreadsheet.
 *
 * Refactor 2026-05-05: ahora SKIP_CRM_SLUGS combina hardcoded + env var
 * SKIP_CRM_SLUGS (CSV de slugs) para añadir CRMs de prueba sin redeploy. */
const SKIP_CRM_SLUGS = (() => {
  const set = new Set(["prueba-hoja-de-testeo-crm"]);
  const fromEnv = String(process.env.SKIP_CRM_SLUGS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  for (const s of fromEnv) set.add(s);
  return set;
})();

/* ─── Auth: soporta OAuth (recomendado), API Key, o Service Account ─── */
/* P0-J refactor 2026-05-04: el modo OAuth usa el SINGLETON de googleHub.js
 * para evitar 4 instancias paralelas refrescando token simultaneamente
 * (Google revoca uno y el modulo muere hasta restart). API Key y Service
 * Account siguen creando su propio cliente porque tienen credenciales/scopes
 * distintos al singleton. */
const getAuth = () => {
  /* Modo 1 (RECOMENDADO): OAuth con refresh token de manager@rubencoton.com */
  if (OAUTH_CLIENT_ID && OAUTH_CLIENT_SECRET && OAUTH_REFRESH_TOKEN) {
    const singleton = getOAuthClient();
    if (singleton) return singleton;
    /* Fallback defensivo: si el singleton fallo (raro), construir uno propio */
    const oauth2 = new google.auth.OAuth2(OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET);
    oauth2.setCredentials({ refresh_token: OAUTH_REFRESH_TOKEN });
    return oauth2;
  }

  /* Modo 2: API Key — requiere hojas publicas */
  if (API_KEY) return API_KEY;

  /* Modo 3: Service Account JSON */
  if (!CREDENTIALS_JSON) return null;
  try {
    const creds = JSON.parse(CREDENTIALS_JSON);
    return new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
    });
  } catch (err) {
    console.error("[sheetsSync] Error parsing credentials:", err.message);
    return null;
  }
};

/* ─── Slug helper ─── */
const slugify = (str) =>
  (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 40);

/* ─── Read one sheet (all tabs) ─── */
const readSheet = async (sheets, spreadsheetId) => {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const title = meta.data.properties?.title || spreadsheetId;
  const crmSlug = slugify(title.replace(/^🚀\s*CRM:\s*/i, ""));
  /* Skip CRMs marcados como hoja de pruebas (ver SKIP_CRM_SLUGS arriba). */
  if (SKIP_CRM_SLUGS.has(crmSlug)) {
    console.log(`[sheets-sync] skip CRM "${title}" (en SKIP_CRM_SLUGS)`);
    return { sheetId: spreadsheetId, title, crmSlug, tabs: [], skipped: true };
  }
  /* Mapeo nombre pestaña -> sheetId numérico (gid). Necesario para
   * sheetsWriteback: la API batchUpdate exige gid, no nombre. */
  const sheetsByName = {};
  for (const s of (meta.data.sheets || [])) {
    sheetsByName[s.properties.title] = s.properties.sheetId;
  }
  const tabNames = Object.keys(sheetsByName);

  const tabResults = [];

  for (const tabName of tabNames) {
    if (SKIP_TABS.includes(tabName.toLowerCase())) continue;

    try {
      const range = `'${tabName}'!A1:Z`;
      const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
      const rows = res.data.values || [];
      if (rows.length < 2) continue;

      const headers = rows[0];
      const emailIdx = findHeader(headers, EMAIL_HEADERS);
      if (emailIdx === -1) continue; // no email column = skip

      const nameIdx = findHeader(headers, NAME_HEADERS);
      const companyIdx = findHeader(headers, COMPANY_HEADERS);
      const phoneIdx = findHeader(headers, PHONE_HEADERS);
      const provinceIdx = findHeader(headers, PROVINCE_HEADERS);
      const ccaaIdx = findHeader(headers, CCAA_HEADERS);
      const cityIdx = findHeader(headers, CITY_HEADERS);
      const populationIdx = findHeader(headers, POPULATION_HEADERS);
      /* Columna 'Merge status' donde el writeback escribe el estado
       * del envio. Si la pestaña no la tiene, _sheetMeta queda sin col
       * y el writeback la ignora silenciosamente. */
      const mergeStatusIdx = findHeader(headers, MERGE_STATUS_HEADERS);

      const segSlug = slugify(tabName);
      const dataRows = rows.slice(1);
      const tabGid = sheetsByName[tabName];
      const contacts = [];

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const email = (row[emailIdx] || "").trim();
        if (!email || !email.includes("@")) continue;

        const sheetMeta = {
          sheetId: spreadsheetId,
          gid: tabGid,
          tabName,
          /* row 0 es header, así que data row i corresponde a fila i+1 */
          row: i + 1,
          col: mergeStatusIdx >= 0 ? mergeStatusIdx : null
        };

        contacts.push({
          email,
          firstName: nameIdx !== -1 ? (row[nameIdx] || "").trim() : "",
          company: companyIdx !== -1 ? (row[companyIdx] || "").trim() : "",
          tags: [`crm-${crmSlug}`, `seg-${segSlug}`],
          custom: {
            telefono: phoneIdx !== -1 ? (row[phoneIdx] || "").trim() : "",
            provincia: provinceIdx !== -1 ? (row[provinceIdx] || "").trim() : "",
            ccaa: ccaaIdx !== -1 ? (row[ccaaIdx] || "").trim() : "",
            municipio: cityIdx !== -1 ? (row[cityIdx] || "").trim() : "",
            poblacion: populationIdx !== -1 ? (row[populationIdx] || "").trim() : "",
            _sheetMeta: sheetMeta
          }
        });
      }

      tabResults.push({ tab: tabName, contacts: contacts.length });

      // Yield contacts for import
      if (contacts.length > 0) {
        tabResults[tabResults.length - 1]._contacts = contacts;
      }
    } catch (err) {
      tabResults.push({ tab: tabName, contacts: 0, error: err.message });
    }
  }

  return { sheetId: spreadsheetId, title, crmSlug, tabs: tabResults };
};

/* ─── Full sync ─── */
const runSync = async (dataStore) => {
  if (syncState.running) {
    return { status: "already_running", message: "Sync en curso, espera a que termine" };
  }

  const auth = getAuth();
  if (!auth) {
    return { status: "error", message: "Configura GOOGLE_SHEETS_API_KEY o GOOGLE_SHEETS_CREDENTIALS" };
  }

  /* Refresca cache de la carpeta CRM SHEETS antes de calcular activos:
   * asi cualquier hoja añadida/quitada por el usuario en Drive entra en
   * el sync siguiente sin reiniciar la app. */
  await discoverSheetsInFolder();
  const activeIds = getActiveSheetIds();
  if (!activeIds.length) {
    return { status: "error", message: "SHEETS_SYNC_IDS vacio — no hay hojas configuradas" };
  }

  syncState.running = true;
  syncState.errors = [];
  const startTime = Date.now();

  /* API Key mode: pass as key param. OAuth/SA mode: pass as auth */
  const sheetsOpts = typeof auth === "string"
    ? { version: "v4", key: auth }
    : { version: "v4", auth };
  const sheets = google.sheets(sheetsOpts);
  const results = [];
  let totalContacts = 0;

  /* MIRROR: por cada crmSlug vamos a recolectar {source -> Set(email)} de lo que HAY en Sheets ahora.
     Al final, todo lo que este en BD con source "sheets:<crm>:<tab>" y NO aparezca aqui, se borra. */
  const mirrorSnapshot = {}; /* crmSlug -> { sourceKey -> Set<email> } */
  let mirrorDeleted = 0;
  let mirrorTabsRemoved = 0;

  for (const sheetId of activeIds) {
    try {
      console.log(`[sheetsSync] Leyendo hoja: ${sheetId}`);
      const sheetResult = await readSheet(sheets, sheetId);

      let sheetContacts = 0;
      const BATCH_SIZE = 300; /* Importar en lotes para no crashear con 35K+ contactos */
      const mapping = {
        email: "email", firstName: "firstName", company: "company", tags: "tags",
        "custom:telefono": "custom:telefono", "custom:provincia": "custom:provincia",
        "custom:ccaa": "custom:ccaa", "custom:municipio": "custom:municipio",
        "custom:_sheetMeta": "custom:_sheetMeta"
      };

      /* Marcar esta hoja como "leida OK" en el snapshot (aunque no tenga contactos).
         Si una hoja fallo al leer, NO aparecera aqui y NO se purgaran sus datos. */
      if (!mirrorSnapshot[sheetResult.crmSlug]) {
        mirrorSnapshot[sheetResult.crmSlug] = {};
      }

      for (const tab of sheetResult.tabs) {
        /* Registrar tab visto (incluso vacio) para que su source sobreviva a la purga */
        if (!tab.error) {
          const tabSourceKey = `sheets:${sheetResult.crmSlug}:${slugify(tab.tab)}`;
          if (!mirrorSnapshot[sheetResult.crmSlug][tabSourceKey]) {
            mirrorSnapshot[sheetResult.crmSlug][tabSourceKey] = new Set();
          }
          if (tab._contacts) {
            tab._contacts.forEach((c) => {
              mirrorSnapshot[sheetResult.crmSlug][tabSourceKey].add(
                String(c.email || "").trim().toLowerCase()
              );
            });
          }
        }

        if (tab._contacts && tab._contacts.length > 0) {
          const allRows = tab._contacts.map((c) => ({
            email: c.email, firstName: c.firstName, company: c.company,
            tags: c.tags.join(","),
            "custom:telefono": c.custom.telefono, "custom:provincia": c.custom.provincia,
            "custom:ccaa": c.custom.ccaa, "custom:municipio": c.custom.municipio,
            /* JSON-stringify para que importContacts lo guarde como string
             * que luego parseamos al leer en sheetsWriteback. */
            "custom:_sheetMeta": c.custom._sheetMeta ? JSON.stringify(c.custom._sheetMeta) : ""
          }));

          /* Importar en lotes de BATCH_SIZE */
          let tabCreated = 0, tabUpdated = 0;
          for (let i = 0; i < allRows.length; i += BATCH_SIZE) {
            const batch = allRows.slice(i, i + BATCH_SIZE);
            const report = dataStore.importContacts({
              rows: batch,
            mapping,
            mode: "create_or_update",
            fileName: `sheets-sync-${sheetResult.crmSlug}`,
              fileType: "google-sheets",
              source: `sheets:${sheetResult.crmSlug}:${slugify(tab.tab)}`
            });
            tabCreated += report.created;
            tabUpdated += report.updated;
            /* Liberar memoria entre batches */
            if (typeof global.gc === "function") global.gc();
          }

          sheetContacts += tabCreated + tabUpdated;
          tab.imported = { created: tabCreated, updated: tabUpdated };
          delete tab._contacts; // free memory
          console.log(`[sheetsSync]   ${tab.tab}: ${tabCreated} creados, ${tabUpdated} actualizados`);
        }
      }
      /* Pausa entre hojas para liberar memoria */
      await new Promise((r) => setTimeout(r, 1000));

      totalContacts += sheetContacts;
      results.push({
        sheetId,
        title: sheetResult.title,
        tabs: sheetResult.tabs.map((t) => ({
          tab: t.tab,
          contacts: t.contacts,
          imported: t.imported || null,
          error: t.error || null
        })),
        totalContacts: sheetContacts
      });
    } catch (err) {
      console.error(`[sheetsSync] Error en hoja ${sheetId}:`, err.message);
      syncState.errors.push({ sheetId, error: err.message });
      results.push({ sheetId, title: "?", error: err.message, tabs: [], totalContacts: 0 });
    }
  }

  /* ─── MIRROR PURGE ─── Elimina de BD todo lo que ya no este en Sheets ─── */
  if (MIRROR_MODE && Object.keys(mirrorSnapshot).length > 0) {
    try {
      dataStore.mutate((store) => {
        const contactsBefore = store.contacts.length;
        const tabsSeen = new Set();
        Object.values(mirrorSnapshot).forEach((tabs) => {
          Object.keys(tabs).forEach((sourceKey) => tabsSeen.add(sourceKey));
        });

        /* BLINDAJE (2026-04-22): calcular cuántos se van a borrar ANTES
         * de aplicar. Si supera umbral (5% de contactos o 500), ABORTAR la
         * purga. Un bug temporal de Sheets (0 filas devueltas) borraría
         * miles de contactos válidos. Mejor pecar de cauto. */
        const toDelete = [];
        store.contacts.forEach((contact) => {
          const src = String(contact.source || "");
          if (!src.startsWith("sheets:")) return;
          const parts = src.split(":");
          if (parts.length < 3) return;
          const crmSlug = parts[1];
          if (!mirrorSnapshot[crmSlug]) return;
          if (!tabsSeen.has(src)) { toDelete.push(contact.id); return; }
          const emailSet = mirrorSnapshot[crmSlug][src];
          if (emailSet && !emailSet.has(String(contact.email || "").trim().toLowerCase())) {
            toDelete.push(contact.id);
          }
        });
        const PURGE_CAP_ABS = Number(process.env.MIRROR_PURGE_CAP_ABS) || 500;
        const PURGE_CAP_PCT = Number(process.env.MIRROR_PURGE_CAP_PCT) || 5;
        const pctOfTotal = (toDelete.length * 100) / Math.max(1, contactsBefore);
        if (toDelete.length > PURGE_CAP_ABS || pctOfTotal > PURGE_CAP_PCT) {
          console.error(
            `[sheetsSync][MIRROR] ABORTADA purga: ${toDelete.length} contactos (${pctOfTotal.toFixed(1)}%) ` +
            `supera cap ${PURGE_CAP_ABS} o ${PURGE_CAP_PCT}%. ` +
            `Revisa manualmente por si es fallo temporal de Sheets.`
          );
          mirrorDeleted = 0;
          return;
        }
        const toDeleteSet = new Set(toDelete);
        store.contacts = store.contacts.filter((c) => !toDeleteSet.has(c.id));
        mirrorDeleted = toDelete.length;

        const after = store.contacts.length;
        console.log(`[sheetsSync][MIRROR] Purga: ${contactsBefore} -> ${after} contactos (${mirrorDeleted} eliminados, ${pctOfTotal.toFixed(1)}% del total)`);
      });
    } catch (err) {
      console.error("[sheetsSync][MIRROR] Error purgando:", err.message);
      syncState.errors.push({ mirror: true, error: err.message });
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  syncState.running = false;
  syncState.lastSync = new Date().toISOString();
  syncState.results = results;
  syncState.totalContacts = totalContacts;
  syncState.mirrorDeleted = mirrorDeleted;

  console.log(`[sheetsSync] Sync completo: ${totalContacts} contactos en ${elapsed}s (mirror eliminados: ${mirrorDeleted})`);

  return {
    status: "ok",
    lastSync: syncState.lastSync,
    totalContacts,
    mirrorDeleted,
    mirrorMode: MIRROR_MODE,
    elapsedSeconds: Number(elapsed),
    sheets: results,
    errors: syncState.errors
  };
};

/* ─── Exports ─── */
module.exports = {
  runSync,
  getStatus: () => {
    const ids = getActiveSheetIds();
    return {
      configured: (Boolean(OAUTH_REFRESH_TOKEN) || Boolean(API_KEY) || Boolean(CREDENTIALS_JSON)) && ids.length > 0,
      authMode: OAUTH_REFRESH_TOKEN ? "oauth" : API_KEY ? "api_key" : CREDENTIALS_JSON ? "service_account" : "none",
      sheetsCount: ids.length,
      sheetIds: ids,
      builtinIds: SHEET_IDS_BUILTIN,
      envIds: SHEET_IDS_FROM_ENV,
      extraIds: getExtraIdsFromDataStore(),
      folderId: SHEETS_FOLDER_ID,
      folderDiscovered: _folderCache.ids,
      folderCacheAt: _folderCache.at ? new Date(_folderCache.at).toISOString() : null,
      intervalHours: SYNC_INTERVAL_HOURS,
      mirrorMode: MIRROR_MODE,
      ...syncState
    };
  },
  SYNC_INTERVAL_HOURS,
  get SHEET_IDS() { return getActiveSheetIds(); },
  getSheetIds,
  getActiveSheetIdsFresh,
  discoverSheetsInFolder,
  setDataStoreRef,
  addExtraSheetId,
  removeExtraSheetId,
  SHEETS_FOLDER_ID
};
