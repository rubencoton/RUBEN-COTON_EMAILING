
const state = {
  contacts: [],
  templates: [],
  segments: [],
  campaigns: [],
  workflows: []
};

const qs = (selector) => document.querySelector(selector);
const qsa = (selector) => Array.from(document.querySelectorAll(selector));
const esc = (s) => String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");

/* =========================================================
 * Modal de confirmación bonito (reemplaza window.confirm)
 * Uso: const ok = await rubenCotonConfirm({ title, body, confirmText, cancelText });
 * ========================================================= */
function rubenCotonConfirm({ title = "Confirmar", subtitle = "", body = "", icon = "⚠️", confirmText = "Aceptar", cancelText = "Cancelar" } = {}) {
  return new Promise((resolve) => {
    const existing = document.getElementById("abConfirmModal");
    if (existing) existing.remove();
    const overlay = document.createElement("div");
    overlay.id = "abConfirmModal";
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;z-index:10000;animation:abFadeIn 0.18s ease-out;backdrop-filter:blur(3px);padding:20px";
    overlay.innerHTML = `
      <style>
        @keyframes abFadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes abSlideUp { from { transform:translateY(30px);opacity:0 } to { transform:translateY(0);opacity:1 } }
        .ab-modal-btn:hover { transform:translateY(-1px); box-shadow:0 6px 14px rgba(230,81,0,0.3) !important; }
      </style>
      <div style="background:#fff;border-radius:14px;max-width:520px;width:100%;overflow:hidden;box-shadow:0 25px 60px rgba(0,0,0,0.45);animation:abSlideUp 0.22s ease-out;border-top:6px solid #FFB74D">
        <div style="background:linear-gradient(135deg,#E65100 0%,#FF6B00 100%);color:#fff;padding:24px 28px">
          <div style="font-size:44px;line-height:1;margin-bottom:8px">${esc(icon)}</div>
          <h2 style="margin:0;font-size:22px;font-weight:800;letter-spacing:0.3px">${esc(title)}</h2>
          ${subtitle ? `<div style="margin-top:6px;font-size:14px;color:#ffe7a8;font-weight:600">${esc(subtitle)}</div>` : ""}
        </div>
        <div style="padding:24px 28px;color:#333;font-size:15px;line-height:1.55">${body}</div>
        <div style="padding:0 28px 24px;display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap">
          <button type="button" id="abCancelBtn" class="ab-modal-btn" style="background:#fff;color:#666;border:2px solid #ddd;padding:12px 22px;border-radius:8px;font-weight:700;font-size:14px;cursor:pointer;transition:all 0.15s">${esc(cancelText)}</button>
          <button type="button" id="abConfirmBtn" class="ab-modal-btn" style="background:linear-gradient(135deg,#E65100,#FF6B00);color:#fff;border:0;padding:12px 26px;border-radius:8px;font-weight:800;font-size:14px;cursor:pointer;transition:all 0.15s;box-shadow:0 4px 10px rgba(230,81,0,0.25)">${esc(confirmText)}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const cleanup = (result) => { overlay.remove(); document.removeEventListener("keydown", onKey); resolve(result); };
    const onKey = (e) => { if (e.key === "Escape") cleanup(false); else if (e.key === "Enter") cleanup(true); };
    document.addEventListener("keydown", onKey);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) cleanup(false); });
    overlay.querySelector("#abCancelBtn").addEventListener("click", () => cleanup(false));
    overlay.querySelector("#abConfirmBtn").addEventListener("click", () => cleanup(true));
    setTimeout(() => overlay.querySelector("#abConfirmBtn")?.focus(), 50);
  });
}

/* =========================================================
 * Modal alert visual (reemplaza window.alert feo del navegador)
 * Usa el mismo estilo que rubenCotonConfirm pero solo 1 boton.
 * ========================================================= */
function rubenCotonAlert({ title = "Aviso", body = "", icon = "ℹ️", okText = "Entendido", tone = "info" } = {}) {
  return new Promise((resolve) => {
    const colors = {
      info:    { bar: "#FFB74D", grad1: "#E65100", grad2: "#FF6B00" },
      success: { bar: "#22c55e", grad1: "#16a34a", grad2: "#22c55e" },
      error:   { bar: "#fca5a5", grad1: "#dc2626", grad2: "#ef4444" },
      warn:    { bar: "#fcd34d", grad1: "#d97706", grad2: "#f59e0b" }
    };
    const c = colors[tone] || colors.info;
    const existing = document.getElementById("abAlertModal");
    if (existing) existing.remove();
    const overlay = document.createElement("div");
    overlay.id = "abAlertModal";
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;z-index:10000;animation:abFadeIn 0.18s ease-out;backdrop-filter:blur(3px);padding:20px";
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:14px;max-width:480px;width:100%;overflow:hidden;box-shadow:0 25px 60px rgba(0,0,0,0.45);animation:abSlideUp 0.22s ease-out;border-top:6px solid ${c.bar}">
        <div style="background:linear-gradient(135deg,${c.grad1} 0%,${c.grad2} 100%);color:#fff;padding:22px 28px">
          <div style="font-size:40px;line-height:1;margin-bottom:6px">${esc(icon)}</div>
          <h2 style="margin:0;font-size:20px;font-weight:800;letter-spacing:0.3px">${esc(title)}</h2>
        </div>
        <div style="padding:22px 28px;color:#333;font-size:15px;line-height:1.55">${body}</div>
        <div style="padding:0 28px 22px;display:flex;justify-content:flex-end">
          <button type="button" id="abOkBtn" style="background:linear-gradient(135deg,${c.grad1},${c.grad2});color:#fff;border:0;padding:11px 26px;border-radius:8px;font-weight:800;font-size:14px;cursor:pointer;box-shadow:0 4px 10px rgba(0,0,0,0.15)">${esc(okText)}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const cleanup = () => { overlay.remove(); document.removeEventListener("keydown", onKey); resolve(); };
    const onKey = (e) => { if (e.key === "Escape" || e.key === "Enter") cleanup(); };
    document.addEventListener("keydown", onKey);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) cleanup(); });
    overlay.querySelector("#abOkBtn").addEventListener("click", cleanup);
    setTimeout(() => overlay.querySelector("#abOkBtn")?.focus(), 50);
  });
}

/* =========================================================
 * humanizeError: convierte mensajes tecnicos crudos en
 * espanol humano legible para usuarios sin contexto tecnico.
 * ========================================================= */
function humanizeError(err) {
  const raw = (err && (err.message || err.error || err)) || "";
  const m = String(raw).toLowerCase();
  if (/401|no autorizado|unauth/.test(m)) return "Tu sesion ha caducado. Vuelve a entrar.";
  if (/403|forbidden|prohibid/.test(m)) return "No tienes permiso para hacer esto.";
  if (/404|no encontrad|not found/.test(m)) return "No se encontro lo que buscabas.";
  if (/410|deshabilitada|disabled/.test(m)) return "Esta funcion esta desactivada.";
  /* P1 FIX UX#10 (audit 2026-05-08): 413 Payload Too Large + 10 MB */
  if (/413|payload too large|10\s*mb|exceder|exced/.test(m)) return "Demasiado peso. Limite 10 MB por campana/plantilla. Quita o comprime archivos.";
  if (/429|rate|quota|limit/.test(m)) return "Has alcanzado el limite. Espera unos minutos.";
  if (/500|internal/.test(m)) return "Algo fallo en el servidor. Intenta de nuevo en un momento.";
  if (/503|unavailable/.test(m)) return "Servicio no disponible. Reintenta en 1 minuto.";
  if (/timeout|etimedout/.test(m)) return "Demasiado lento. Verifica tu conexion y reintenta.";
  if (/network|fetch failed|econnrefused/.test(m)) return "Sin conexion. Verifica tu Wi-Fi y reintenta.";
  if (/json|parse|unexpected token/.test(m)) return "Respuesta no esperada del servidor. Avisa al admin.";
  /* Si nada matchea: limpia el mensaje (sin codigos HTTP, sin stack) */
  const clean = String(raw).replace(/HTTP\s*\d+/gi, "").replace(/Error:\s*/i, "").trim();
  return clean || "Algo no salio bien. Intenta de nuevo.";
}

const appStatusEl = qs("#appStatus");
const dbStatusEl = qs("#dbStatus");
const kpiContactsEl = qs("#kpiContacts");
const kpiCampaignsEl = qs("#kpiCampaigns");

/* P0 PERF 2026-05-08 (peticion usuario "que no se quede pillada"):
   Skeleton loaders inmediatos al cargar la página. Sin esto el usuario ve
   "--" o vacío hasta que el primer fetch resuelve (~200-500ms). Con
   skeleton ve algo animándose y percibe que la app va rápido. */
(() => {
  const skeleton = '<span style="display:inline-block;width:32px;height:14px;background:linear-gradient(90deg,#e2e8f0 0%,#cbd5e1 50%,#e2e8f0 100%);background-size:200% 100%;animation:skeletonPulse 1.2s ease-in-out infinite;border-radius:4px;vertical-align:middle"></span>';
  if (kpiContactsEl && (kpiContactsEl.textContent === "--" || !kpiContactsEl.textContent.trim())) kpiContactsEl.innerHTML = skeleton;
  if (kpiCampaignsEl && (kpiCampaignsEl.textContent === "--" || !kpiCampaignsEl.textContent.trim())) kpiCampaignsEl.innerHTML = skeleton;
  /* Animación CSS si no está ya. */
  if (!document.getElementById("skeletonPulseStyle")) {
    const st = document.createElement("style");
    st.id = "skeletonPulseStyle";
    st.textContent = "@keyframes skeletonPulse { 0% { background-position: 200% 50% } 100% { background-position: -200% 50% } }";
    document.head.appendChild(st);
  }
})();
const engineStatusEl = qs("#engineStatus");
const engineQueueEl = qs("#engineQueue");
const dashboardJsonEl = qs("#dashboardJson");
/* P0 audit 2026-05-04: KPIs agregados eliminados — el dashboard ahora muestra
 * la tabla de campañas activas con stats individuales. Mantengo los `qs`
 * como const con null fallback para compat (si el HTML antiguo se sirve
 * desde cache antes del deploy nuevo). */
const dashSegments = qs("#dashSegments");
const dashSent = qs("#dashSent");
const dashOpenRate = qs("#dashOpenRate");
const dashClickRate = qs("#dashClickRate");
const dashBounces = qs("#dashBounces");
const dashActivity = qs("#dashActivity");

const logoutButton = qs("#logoutButton");

const contactSearch = qs("#contactSearch");
const refreshContactsBtn = qs("#refreshContactsBtn");
const contactsTableBody = qs("#contactsTable tbody");
const contactForm = qs("#contactForm");
const contactFormResult = qs("#contactFormResult");

const importDropzone = qs("#importDropzone");
const importFileInput = qs("#importFile");
const importPreview = qs("#importPreview");
const importFileBadge = qs("#importFileBadge");
const importMappingHead = qs("#importMappingHead");
const importMappingBody = qs("#importMappingBody");
const importMode = qs("#importMode");
const importConfirmBtn = qs("#importConfirmBtn");
const importCancelBtn = qs("#importCancelBtn");
const importCount = qs("#importCount");
const importResult = qs("#importResult");
const importReport = qs("#importReport");

let _importRows = [];
let _importMapping = {};

const templateForm = qs("#templateForm");
const templateResult = qs("#templateResult");
const templatesTableBody = qs("#templatesTable tbody");
const tplHtmlEditor = qs("#tplHtmlEditor");
const tplPreviewFrame = qs("#tplPreviewFrame");
const tplPreviewContainer = qs("#tplPreviewContainer");
const aiBuilderFrame = qs("#aiBuilderFrame");
const aiBuilderLoadBtn = qs("#aiBuilderLoadBtn");

const segmentForm = qs("#segmentForm");
const segmentResult = qs("#segmentResult");
const segmentsTableBody = qs("#segmentsTable tbody");

const campaignForm = qs("#campaignForm");
const campaignResult = qs("#campaignResult");
const campaignsTableBody = qs("#campaignsTable tbody");
const campaignTemplateSelect = qs("#campaignTemplateSelect");
const campaignSegmentSelect = qs("#campaignSegmentSelect");

const analyticsCampaignSelect = qs("#analyticsCampaignSelect");
const loadAnalyticsBtn = qs("#loadAnalyticsBtn");
const simulateOpenBtn = qs("#simulateOpenBtn");
const simulateClickBtn = qs("#simulateClickBtn");
const simulateUnsubBtn = qs("#simulateUnsubBtn");
const analyticsJson = qs("#analyticsJson");

const workflowForm = qs("#workflowForm");
const workflowResult = qs("#workflowResult");
const workflowsTableBody = qs("#workflowsTable tbody");
const workflowTemplateSelect = qs("#workflowTemplateSelect");
const runWorkflowsBtn = qs("#runWorkflowsBtn");
const workflowRunsJson = qs("#workflowRunsJson");

const setupChecklistJson = qs("#setupChecklistJson");
const refreshChecklistBtn = qs("#refreshChecklistBtn");
const testProviderBtn = qs("#testProviderBtn");
const pauseEngineBtn = qs("#pauseEngineBtn");
const resumeEngineBtn = qs("#resumeEngineBtn");
const settingsActionResult = qs("#settingsActionResult");

const quickSendForm = qs("#quickSendForm");
const quickSendTo = qs("#quickSendTo");
const quickSendSubject = qs("#quickSendSubject");
const quickSendText = qs("#quickSendText");
const quickSendResult = qs("#quickSendResult");

const sheetsSyncBtn = qs("#sheetsSyncBtn");
const sheetsStatusBtn = qs("#sheetsStatusBtn");
const sheetsSyncResult = qs("#sheetsSyncResult");
const sheetsSyncJson = qs("#sheetsSyncJson");

const aiStatusList = qs("#aiStatusList");
const aiRefreshBtn = qs("#aiRefreshBtn");
const aiTestBtn = qs("#aiTestBtn");
const aiTestResult = qs("#aiTestResult");
const aiTestJson = qs("#aiTestJson");

const foldersGrid = qs("#foldersGrid");
const foldersTitle = qs("#foldersTitle");
const foldersSubtitle = qs("#foldersSubtitle");
const foldersBreadcrumb = qs("#foldersBreadcrumb");

const tabs = qsa(".tab");
const tabPanels = qsa(".tab-panel");

const setStatusStyle = (element, status) => {
  element.classList.remove("ok", "warn", "error");
  if (status === "ok") {
    element.classList.add("ok");
  } else if (status === "warn") {
    element.classList.add("warn");
  } else {
    element.classList.add("error");
  }
};

const pretty = (value) => JSON.stringify(value, null, 2);

const checklistToText = (payload) => {
  const checks = Array.isArray(payload?.checks) ? payload.checks : [];
  const summary = payload?.summary || {};

  const lines = [
    `READY: ${summary.ready ? "SI" : "NO"}`,
    `TOTAL: ${summary.total || 0} | OK: ${summary.ok || 0} | ERROR: ${summary.error || 0} | WARN: ${summary.warn || 0}`,
    ""
  ];

  checks.forEach((item) => {
    const badge =
      item.status === "ok" ? "OK" : item.status === "error" ? "ERROR" : "WARN";
    lines.push(`[${badge}] ${item.label}`);
    if (item.detail) {
      lines.push(`  - ${item.detail}`);
    }
  });

  return lines.join("\n");
};

/* P0 UX 2026-05-05: retry automatico para cold start tras deploy.
 * Si fetch falla por network (cold start, container arrancando), reintenta
 * 3 veces con backoff exponencial (1s, 2s, 4s). El usuario no ve el error
 * - solo espera un poco en lugar de ver "Error de API". */
/* P1 BLINDAJE 2026-05-08: api() con retry automático + feedback visual.
 * Antes los reintentos eran silenciosos, el usuario veía la app "colgada".
 * Ahora muestra un banner discreto "Reconectando…" al primer reintento
 * y lo oculta al recuperar. Si los 3 intentos fallan, muestra error claro. */
const __apiBanner = (() => {
  let el = null;
  const ensure = () => {
    if (el) return el;
    el = document.createElement("div");
    el.id = "apiReconnectBanner";
    el.style.cssText = "position:fixed;top:12px;left:50%;transform:translateX(-50%);background:#fef3c7;border:1px solid #fcd34d;color:#92400e;padding:8px 16px;border-radius:8px;font-size:13px;font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:9999;display:none;animation:abFadeIn 0.18s ease-out";
    document.body.appendChild(el);
    return el;
  };
  return {
    show: (msg) => { try { const e = ensure(); e.textContent = msg; e.style.display = "block"; } catch(_){} },
    hide: () => { try { if (el) el.style.display = "none"; } catch(_){} }
  };
})();

/* P1 FEAT 2026-05-08 (peticion usuario "tarda mucho, pon que carga"):
   loadingHint flotante arriba derecha. Devuelve {hide()} para ocultar
   tras la operación. Inde de pantalla, siempre visible. */
const loadingHint = (msg) => {
  try {
    const id = "lh_" + Math.random().toString(36).slice(2, 9);
    const el = document.createElement("div");
    el.id = id;
    el.style.cssText = "position:fixed;top:12px;right:16px;background:#1a1a1a;color:#fff;padding:9px 16px;border-radius:8px;font-size:13px;font-weight:600;box-shadow:0 6px 16px rgba(0,0,0,0.25);z-index:9998;display:flex;align-items:center;gap:8px;animation:abFadeIn 0.15s ease-out";
    el.innerHTML = `<span style="width:14px;height:14px;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:lhSpin 0.7s linear infinite;display:inline-block"></span><span>${esc(msg)}</span>`;
    /* Animación spinner inyectada una sola vez */
    if (!document.getElementById("lhSpinStyle")) {
      const st = document.createElement("style");
      st.id = "lhSpinStyle";
      st.textContent = "@keyframes lhSpin { to { transform: rotate(360deg) } }";
      document.head.appendChild(st);
    }
    document.body.appendChild(el);
    return {
      hide: () => { try { el.remove(); } catch (_) {} }
    };
  } catch (_) { return { hide: () => {} }; }
};

const api = async (url, options = {}, retryCount = 0) => {
  const MAX_RETRIES = 3;
  let response;
  try {
    response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      ...options
    });
  } catch (networkErr) {
    /* P1 FIX 2026-05-08 (peticion usuario "sale mucho lo de servidor arrancando"):
       el banner ahora solo aparece A PARTIR DEL 2º RETRY (retryCount>=1).
       El 1er retry es silencioso y muy rápido (300ms en vez de 1s) → cubre
       blips invisibles sin que el usuario vea nada.
       Si aún falla en 2º retry → banner. Si recupera → se oculta inmediato. */
    if (retryCount < MAX_RETRIES) {
      if (retryCount >= 1) {
        __apiBanner.show(`🔄 Reconectando…`);
      }
      const delayMs = retryCount === 0 ? 300 : 1500 * Math.pow(2, retryCount - 1); /* 300ms, 1.5s, 3s */
      await new Promise((r) => setTimeout(r, delayMs));
      return api(url, options, retryCount + 1);
    }
    __apiBanner.show("⚠️ Sin conexión con el servidor. Revisa tu Wi-Fi.");
    setTimeout(() => __apiBanner.hide(), 5000);
    throw new Error("Sin conexion. Verifica tu Wi-Fi y reintenta.");
  }

  if (response.status === 401) {
    window.location.href = "/login";
    throw new Error("No autorizado");
  }

  /* Cold start del backend devuelve 502/503/504 mientras arranca. Reintentar. */
  if ([502, 503, 504].includes(response.status) && retryCount < MAX_RETRIES) {
    /* P1 FIX 2026-05-08: banner solo desde 2º intento (silencio en blips).
       Mensaje informativo: el cold start de Coolify puede tardar hasta 60s
       cuando el contenedor estaba dormido — antes el banner sugería problema. */
    if (retryCount >= 1) {
      __apiBanner.show(`🔄 Servidor arrancando (puede tardar hasta 1 min en cold start)…`);
    }
    const delayMs = retryCount === 0 ? 500 : 1500 * Math.pow(2, retryCount - 1);
    await new Promise((r) => setTimeout(r, delayMs));
    return api(url, options, retryCount + 1);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "Error de API");
  }

  /* Éxito tras reintento: ocultar banner inmediato. */
  if (retryCount > 0) __apiBanner.hide();

  return data;
};

const activateTab = (tabId) => {
  tabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.tab === tabId);
  });
  tabPanels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.panel === tabId);
  });
  /* P0 PERF 2026-05-08: dispara evento custom para que listeners (lazy
     loads, refrescos por sub-tab) reaccionen al cambio. Antes los 3
     addEventListener("rubencoton:tab") nunca se disparaban. */
  document.dispatchEvent(new CustomEvent("rubencoton:tab", { detail: { tab: tabId } }));
};

tabs.forEach((tab) => {
  tab.addEventListener("click", () => activateTab(tab.dataset.tab));
});

/* PETICION USUARIO 2026-05-05: clic en el logo del menú lateral
 * pliega/despliega el sidebar. Estado persiste en localStorage. */
const sideToggleBtn = qs("#sideToggle");
const appShellEl = qs(".app-shell");
const SIDE_KEY = "ui:sideCollapsed";
if (sideToggleBtn && appShellEl) {
  if (localStorage.getItem(SIDE_KEY) === "1") {
    appShellEl.classList.add("is-collapsed");
  }
  sideToggleBtn.addEventListener("click", () => {
    const collapsed = appShellEl.classList.toggle("is-collapsed");
    localStorage.setItem(SIDE_KEY, collapsed ? "1" : "0");
  });
}

const fillSelectOptions = (select, items, placeholder, getLabel) => {
  if (!select) return;
  const options = [
    `<option value="">${placeholder}</option>`,
    ...items.map((item) => `<option value="${item.id}">${getLabel(item)}</option>`)
  ];
  select.innerHTML = options.join("\n");
};

const CONTACT_STATUS_ES = {
  subscribed: "Suscrito",
  non_subscribed: "No suscrito",
  unsubscribed: "Dado de baja",
  bounced: "Rebotado",
  complained: "Queja spam",
  suppressed: "Suprimido"
};

const renderContacts = (contacts) => {
  contactsTableBody.innerHTML = contacts
    .map(
      (contact) => `
      <tr>
        <td>${esc(contact.email)}</td>
        <td>${esc([contact.firstName || "", contact.lastName || ""].join(" ").trim())}</td>
        <td><span class="status-badge status-${esc(contact.status)}">${esc(CONTACT_STATUS_ES[contact.status] || contact.status)}</span></td>
        <td>${(contact.tags || []).slice(0, 3).map(t => `<span class="seg-chip" style="font-size:10px;padding:2px 6px">${esc(t)}</span>`).join(" ")}${(contact.tags || []).length > 3 ? ` <span class="muted" style="font-size:10px">+${contact.tags.length - 3}</span>` : ""}</td>
      </tr>
    `
    )
    .join("");

  /* Paginacion */
  const paginationEl = document.getElementById("contactsPagination");
  if (paginationEl) {
    const total = state.contactsTotal || 0;
    const page = contactsPage + 1;
    const totalPages = Math.ceil(total / CONTACTS_PER_PAGE) || 1;
    paginationEl.innerHTML = `
      <button type="button" ${contactsPage === 0 ? "disabled" : ""} onclick="window.__contactsPrev()">← Anterior</button>
      <span class="muted" style="font-size:13px">Página ${page} de ${totalPages} (${total.toLocaleString("es-ES")} contactos)</span>
      <button type="button" ${!state.contactsHasMore ? "disabled" : ""} onclick="window.__contactsNext()">Siguiente →</button>
    `;
  }
};

window.__contactsPrev = () => { if (contactsPage > 0) { contactsPage--; refreshContacts(); } };
window.__contactsNext = () => { if (state.contactsHasMore) { contactsPage++; refreshContacts(); } };

/* P1 FEAT 2026-05-08 (peticion usuario): estado de ordenacion + filtro de
   busqueda para Mis plantillas. */
const __tplListState = { sortKey: "updated", sortDir: "desc", search: "" };

const renderTemplates = (templates) => {
  /* P1 REFACTOR 2026-05-08 (peticion usuario): eliminada la columna Estado.
     Todas las plantillas guardadas son operativas (no hay borrador/validado).
     Botón "Validar" eliminado. Solo quedan Ver / Editar / Eliminar.
     P1 FEAT 2026-05-08: aplicar busqueda + ordenacion en cliente. */
  let list = Array.isArray(templates) ? templates.slice() : [];

  /* Filtro por nombre o asunto (case-insensitive) */
  const q = __tplListState.search.trim().toLowerCase();
  if (q) {
    list = list.filter((t) => {
      const n = String(t.name || "").toLowerCase();
      const s = String(t.subject || "").toLowerCase();
      return n.includes(q) || s.includes(q);
    });
  }

  /* Ordenacion por nombre / asunto / fecha actualizada */
  const dir = __tplListState.sortDir === "asc" ? 1 : -1;
  list.sort((a, b) => {
    let va, vb;
    if (__tplListState.sortKey === "name") {
      va = String(a.name || "").toLowerCase();
      vb = String(b.name || "").toLowerCase();
    } else if (__tplListState.sortKey === "subject") {
      va = String(a.subject || "").toLowerCase();
      vb = String(b.subject || "").toLowerCase();
    } else { /* updated (default) */
      va = new Date(a.updatedAt || a.createdAt || 0).getTime();
      vb = new Date(b.updatedAt || b.createdAt || 0).getTime();
    }
    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return 0;
  });

  /* Indicadores visuales en headers */
  qsa(".tpl-sort").forEach((th) => {
    const k = th.dataset.tplSort;
    const arrow = th.querySelector(".tpl-sort-arrow");
    if (!arrow) return;
    if (k === __tplListState.sortKey) {
      arrow.textContent = __tplListState.sortDir === "asc" ? "▲" : "▼";
      th.style.color = "#FF6B00";
    } else {
      arrow.textContent = "⇅";
      th.style.color = "";
    }
  });

  /* Si la búsqueda no devuelve nada, mostrar mensaje claro. */
  if (q && list.length === 0) {
    templatesTableBody.innerHTML = `<tr><td colspan="4" class="muted" style="text-align:center;padding:30px">Sin resultados para "${esc(q)}". Prueba con otro nombre o asunto.</td></tr>`;
    return;
  }
  if (list.length === 0) {
    templatesTableBody.innerHTML = '<tr><td colspan="4" class="muted" style="text-align:center;padding:30px">Aún no tienes plantillas. Ve a "Crear plantilla" para empezar.</td></tr>';
    return;
  }

  templatesTableBody.innerHTML = list
    .map((template) => {
      const fechaBase = template.updatedAt || template.createdAt;
      const fecha = fechaBase ? new Date(fechaBase).toLocaleString("es-ES") : "-";
      const safeName = esc(template.name).replace(/'/g, "\\'");
      return `
      <tr>
        <td><a href="javascript:void(0)" class="tpl-name-link" onclick="tplPreview('${template.id}')" title="Ver cómo queda esta plantilla"><strong>${esc(template.name)}</strong></a></td>
        <td>${esc(template.subject)}</td>
        <td style="font-size:0.85rem;color:#666">${fecha}</td>
        <td class="tpl-actions">
          <button class="btn-sm" onclick="tplPreview('${template.id}')" title="Ver cómo queda">👁 Ver</button>
          <button class="btn-sm" onclick="tplEdit('${template.id}')" title="Editar contenido">✎ Editar</button>
          <button class="btn-sm btn-danger" onclick="tplDelete('${template.id}','${safeName}')" title="Mover a la papelera (30 días para restaurar)">🗑 Eliminar</button>
        </td>
      </tr>
    `;
    })
    .join("");

  /* P1 REFACTOR 2026-05-08: sin estados (todas las plantillas operativas).
     Selector campañas/workflows muestra solo nombre + asunto, sin prefijos. */
  const labelForSelect = (item) => `${item.name} · ${item.subject}`;

  fillSelectOptions(
    campaignTemplateSelect,
    templates,
    "Sin plantilla",
    labelForSelect
  );

  fillSelectOptions(
    workflowTemplateSelect,
    templates,
    "Sin plantilla",
    labelForSelect
  );
};

/* ── Helpers de borradores (expuestos en window para onclick inline) ── */
const refreshSyncAndRender = async () => {
  const data = await api("/api/templates");
  state.templates = data.templates;
  renderTemplates(state.templates);
};

window.tplValidate = async (id) => {
  try {
    await api(`/api/templates/${id}/validate`, { method: "PATCH" });
    await refreshSyncAndRender();
  } catch (e) { rubenCotonAlert({ title: "No se pudo validar", body: humanizeError(e), icon: "❌", tone: "error" }); }
};

window.tplUnvalidate = async (id) => {
  try {
    await api(`/api/templates/${id}/unvalidate`, { method: "PATCH" });
    await refreshSyncAndRender();
  } catch (e) { rubenCotonAlert({ title: "No se pudo desvalidar", body: humanizeError(e), icon: "❌", tone: "error" }); }
};

/* P2 FIX 2026-05-08 (peticion usuario "si me muevo se queda cargando bug"):
   estado global de la preview en curso para poder cancelarla cuando el
   usuario cambia de pestaña o invoca otra preview. Sin esto, dos clicks
   seguidos en "Ver" creaban dos loadingHint y solo uno se ocultaba. */
let __tplPreviewActive = null;

window.tplPreview = async (id) => {
  /* Cancelar preview anterior si seguía en vuelo (multi-click + cold start). */
  if (__tplPreviewActive) {
    try { __tplPreviewActive.cancel(); } catch (_) {}
  }
  const lh = loadingHint("Cargando vista previa…");
  const ctx = { cancelled: false, cancel() { this.cancelled = true; lh.hide(); } };
  __tplPreviewActive = ctx;
  try {
    const data = await api(`/api/templates/${id}`);
    if (ctx.cancelled) return; /* el usuario cambió de pestaña / pidió otra */
    const t = data.template;
    if (!t) throw new Error("Plantilla no encontrada");

    const modal = qs("#tplPreviewModal");
    const frame = qs("#tplPreviewModalFrame");
    const titleEl = qs("#tplPreviewModalTitle");
    const subjectEl = qs("#tplPreviewModalSubject");
    const statusEl = qs("#tplPreviewModalStatus");
    if (!modal || !frame) return;

    const status = t.status || "borrador";
    const statusLabel = status === "validado" ? "Validado" : "Borrador";
    if (titleEl) titleEl.textContent = t.name || "(sin nombre)";
    if (subjectEl) subjectEl.textContent = t.subject || "(sin asunto)";
    if (statusEl) {
      statusEl.textContent = statusLabel;
      statusEl.className = `status-pill status-${status}`;
    }

    /* Usar srcdoc para renderizar el HTML aislado del DOM actual */
    frame.srcdoc = t.html || "<p style='padding:40px;font-family:sans-serif;color:#999;text-align:center'>Este borrador no tiene HTML. Solo texto plano.</p>";
    modal.style.display = "flex";
  } catch (e) {
    if (!ctx.cancelled) {
      rubenCotonAlert({ title: "No se pudo previsualizar", body: humanizeError(e), icon: "❌", tone: "error" });
    }
  } finally {
    if (!ctx.cancelled) lh.hide();
    if (__tplPreviewActive === ctx) __tplPreviewActive = null;
  }
};

/* P2 FIX 2026-05-08: si el usuario cambia de pestaña con una preview
   en vuelo, abortarla para no dejar spinner huérfano ni abrir el modal
   en pestaña equivocada. */
document.addEventListener("rubencoton:tab", () => {
  if (__tplPreviewActive) {
    try { __tplPreviewActive.cancel(); } catch (_) {}
    __tplPreviewActive = null;
  }
});

/* Cerrar modal preview con ESC o clic fuera */
qs("#tplPreviewModalClose")?.addEventListener("click", () => {
  const modal = qs("#tplPreviewModal");
  if (modal) modal.style.display = "none";
});
qs("#tplPreviewModal")?.addEventListener("click", (e) => {
  if (e.target.id === "tplPreviewModal") {
    e.currentTarget.style.display = "none";
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const modal = qs("#tplPreviewModal");
    if (modal && modal.style.display === "flex") modal.style.display = "none";
  }
});

/* P1 FEAT 2026-05-08: tplDelete ahora MUEVE A PAPELERA (no borra real).
   Estilo Gmail: 30 días para restaurar antes de purga automática.
   Para borrar ya, ir a Papelera y eliminar permanentemente desde allí. */
window.tplDelete = async (id, name) => {
  const ok = await rubenCotonConfirm({
    title: "Mover a la papelera",
    icon: "🗑",
    subtitle: name,
    body: `Vas a mover <strong>"${esc(name)}"</strong> a la papelera.<br><br>` +
          `Tienes <strong>30 días</strong> para restaurarla antes de que se borre definitivamente.`,
    confirmText: "Mover a papelera"
  });
  if (!ok) return;
  try {
    const r = await api(`/api/templates/${id}`, { method: "DELETE" });
    toast(r.message || "Plantilla movida a la papelera");
    /* P1 FIX UX#4 (audit 2026-05-08): si la plantilla que mandamos a papelera
       coincide con la que está en edición, cancelar la edición en curso para
       evitar que la caja de adjuntos quede en estado fantasma. */
    const currentEditId = qs("#templateEditingId")?.value;
    if (currentEditId === id) {
      qs("#templateEditCancel")?.click();
    }
    await refreshSyncAndRender();
    await refreshTemplatesTrash();
  } catch (e) { rubenCotonAlert({ title: "No se pudo borrar", body: humanizeError(e), icon: "❌", tone: "error" }); }
};

/* P1 FEAT 2026-05-08: restaurar plantilla desde la papelera. */
window.tplRestore = async (id, name) => {
  try {
    await api(`/api/templates/${id}/restore`, { method: "POST" });
    toast(`✅ "${name}" restaurada`);
    await refreshSyncAndRender();
    await refreshTemplatesTrash();
  } catch (e) { rubenCotonAlert({ title: "No se pudo restaurar", body: humanizeError(e), icon: "❌", tone: "error" }); }
};

/* P1 FEAT 2026-05-08: borrado permanente desde la papelera. */
window.tplPurge = async (id, name) => {
  const ok = await rubenCotonConfirm({
    title: "Eliminar permanentemente",
    icon: "⚠️",
    subtitle: name,
    body: `Vas a eliminar <strong>"${esc(name)}"</strong> definitivamente.<br><br>` +
          `Esta acción <strong>no se puede deshacer</strong>.`,
    confirmText: "Eliminar para siempre"
  });
  if (!ok) return;
  try {
    await api(`/api/templates/${id}/permanent`, { method: "DELETE" });
    toast(`✓ "${name}" eliminada permanentemente`);
    await refreshTemplatesTrash();
  } catch (e) { rubenCotonAlert({ title: "No se pudo eliminar", body: humanizeError(e), icon: "❌", tone: "error" }); }
};

/* P1 FEAT 2026-05-08: render de la tabla de papelera. */
/* P1 FEAT 2026-05-08 (peticion usuario): seleccion multiple estilo Gmail
   en papelera. Checkbox por fila + cabecera con "select all" + barra
   contextual de acciones (restaurar X / eliminar X) que aparece cuando
   hay seleccion. */
const __tplTrashSelected = new Set();

const refreshTemplatesTrash = async () => {
  const tbody = qs("#templatesTrashTable tbody");
  const counter = qs("#tplTrashCount");
  if (!tbody) return;
  /* Loading row mientras carga */
  tbody.innerHTML = '<tr><td colspan="6" class="muted" style="text-align:center;padding:24px">⏳ Cargando papelera…</td></tr>';
  try {
    const r = await api("/api/templates?trashed=1");
    const trashed = r.templates || [];
    if (counter) counter.textContent = trashed.length ? `(${trashed.length})` : "";
    /* Limpiar selecciones de plantillas que ya no estén en la papelera */
    for (const id of Array.from(__tplTrashSelected)) {
      if (!trashed.find((t) => t.id === id)) __tplTrashSelected.delete(id);
    }
    if (!trashed.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="muted" style="text-align:center;padding:30px">Papelera vacía 🗑</td></tr>';
      __tplTrashUpdateBulkBar();
      return;
    }
    const now = Date.now();
    tbody.innerHTML = trashed.map((t) => {
      const trashedAt = t.trashedAt ? new Date(t.trashedAt) : null;
      const fechaTrash = trashedAt ? trashedAt.toLocaleString("es-ES") : "-";
      const elapsedDays = trashedAt ? Math.floor((now - trashedAt.getTime()) / (24*60*60*1000)) : 0;
      const remaining = Math.max(0, 30 - elapsedDays);
      const remainingColor = remaining <= 3 ? "#dc2626" : remaining <= 7 ? "#f59e0b" : "#6b7280";
      const safeName = esc(t.name).replace(/'/g, "\\'");
      const isChecked = __tplTrashSelected.has(t.id) ? "checked" : "";
      return `
      <tr>
        <td style="width:36px;text-align:center"><input type="checkbox" class="tpl-trash-cb" data-id="${t.id}" ${isChecked} style="cursor:pointer;width:16px;height:16px"></td>
        <td><strong>${esc(t.name)}</strong></td>
        <td>${esc(t.subject)}</td>
        <td style="font-size:0.85rem;color:#666">${fechaTrash}</td>
        <td style="font-weight:600;color:${remainingColor}">${remaining} día${remaining !== 1 ? "s" : ""}</td>
        <td class="tpl-actions">
          <button class="btn-sm btn-success" onclick="tplRestore('${t.id}','${safeName}')" title="Restaurar a Mis plantillas">↩ Restaurar</button>
          <button class="btn-sm btn-danger" onclick="tplPurge('${t.id}','${safeName}')" title="Eliminar para siempre">🗑 Eliminar ya</button>
        </td>
      </tr>`;
    }).join("");
    /* Wireup checkboxes */
    qsa(".tpl-trash-cb").forEach((cb) => {
      cb.addEventListener("change", () => {
        const id = cb.dataset.id;
        if (cb.checked) __tplTrashSelected.add(id);
        else __tplTrashSelected.delete(id);
        __tplTrashUpdateBulkBar();
        const all = qs("#tplTrashSelectAll");
        if (all) {
          all.checked = qsa(".tpl-trash-cb").every((c) => c.checked);
          all.indeterminate = !all.checked && qsa(".tpl-trash-cb").some((c) => c.checked);
        }
      });
    });
    __tplTrashUpdateBulkBar();
  } catch (e) {
    /* P1 FIX 2026-05-08 (peticion usuario "me sale Error de API"):
       mensaje mas claro que indica el endpoint que fallo. */
    const msg = humanizeError(e);
    tbody.innerHTML = `<tr><td colspan="6" class="muted" style="text-align:center;padding:30px;color:#dc2626"><div style="margin-bottom:8px">⚠️ No se pudo cargar la papelera</div><div style="font-size:12px;color:#991b1b">${esc(msg)}</div><button type="button" onclick="refreshTemplatesTrash()" style="margin-top:10px;background:#1a1a1a;color:#fff;border:0;padding:7px 14px;border-radius:6px;cursor:pointer;font-size:12px">🔄 Reintentar</button></td></tr>`;
    console.warn("[refreshTemplatesTrash]", e.message);
  }
};

/* Barra contextual de acciones en bulk para papelera. */
const __tplTrashUpdateBulkBar = () => {
  let bar = qs("#tplTrashBulkBar");
  const count = __tplTrashSelected.size;
  if (count === 0) {
    if (bar) bar.style.display = "none";
    return;
  }
  if (!bar) {
    /* Crear barra si no existe */
    const trashSection = qs("#tplSectionTrash");
    if (!trashSection) return;
    bar = document.createElement("div");
    bar.id = "tplTrashBulkBar";
    bar.style.cssText = "display:none;background:#1a1a1a;color:#fff;border-radius:8px;padding:10px 16px;margin-bottom:12px;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;box-shadow:0 4px 12px rgba(0,0,0,0.15)";
    bar.innerHTML = `
      <span id="tplTrashBulkCount" style="font-weight:700;font-size:14px"></span>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button type="button" id="tplTrashBulkRestore" style="background:#16a34a;color:#fff;border:0;padding:8px 14px;border-radius:6px;cursor:pointer;font-weight:700;font-size:13px">↩ Restaurar seleccionadas</button>
        <button type="button" id="tplTrashBulkPurge" style="background:#dc2626;color:#fff;border:0;padding:8px 14px;border-radius:6px;cursor:pointer;font-weight:700;font-size:13px">🗑 Eliminar seleccionadas</button>
        <button type="button" id="tplTrashBulkClear" style="background:transparent;color:#fff;border:1px solid #4b5563;padding:8px 12px;border-radius:6px;cursor:pointer;font-size:13px">Cancelar</button>
      </div>
    `;
    /* Insertar antes de la tabla */
    const tableWrap = trashSection.querySelector("table");
    if (tableWrap?.parentElement) {
      trashSection.insertBefore(bar, tableWrap.parentElement);
    } else {
      trashSection.prepend(bar);
    }
    /* Listeners de la barra */
    qs("#tplTrashBulkRestore").addEventListener("click", () => __tplTrashBulkAction("restore"));
    qs("#tplTrashBulkPurge").addEventListener("click", () => __tplTrashBulkAction("purge"));
    qs("#tplTrashBulkClear").addEventListener("click", () => {
      __tplTrashSelected.clear();
      qsa(".tpl-trash-cb").forEach((c) => { c.checked = false; });
      const all = qs("#tplTrashSelectAll");
      if (all) { all.checked = false; all.indeterminate = false; }
      __tplTrashUpdateBulkBar();
    });
  }
  qs("#tplTrashBulkCount").textContent = `${count} plantilla${count !== 1 ? "s" : ""} seleccionada${count !== 1 ? "s" : ""}`;
  bar.style.display = "flex";
};

/* Ejecuta acciones bulk: restore o purge para todas las seleccionadas. */
const __tplTrashBulkAction = async (action) => {
  const ids = Array.from(__tplTrashSelected);
  if (!ids.length) return;
  if (action === "purge") {
    const ok = await rubenCotonConfirm({
      title: "Eliminar permanentemente",
      icon: "⚠️",
      subtitle: `${ids.length} plantilla${ids.length !== 1 ? "s" : ""} seleccionada${ids.length !== 1 ? "s" : ""}`,
      body: `Vas a eliminar <strong>${ids.length}</strong> plantilla${ids.length !== 1 ? "s" : ""} <strong>permanentemente</strong>.<br><br>No se puede deshacer.`,
      confirmText: "Sí, eliminar todas"
    });
    if (!ok) return;
  }
  const lh = loadingHint(action === "restore" ? `Restaurando ${ids.length}…` : `Eliminando ${ids.length}…`);
  let ok = 0, fail = 0;
  for (const id of ids) {
    try {
      if (action === "restore") {
        await api(`/api/templates/${id}/restore`, { method: "POST" });
      } else {
        await api(`/api/templates/${id}/permanent`, { method: "DELETE" });
      }
      ok++;
    } catch (_) { fail++; }
  }
  lh.hide();
  __tplTrashSelected.clear();
  await refreshTemplatesTrash();
  if (action === "restore") await refreshTemplates();
  toast(`✅ ${ok} plantilla${ok !== 1 ? "s" : ""} ${action === "restore" ? "restaurada" + (ok !== 1 ? "s" : "") : "eliminada" + (ok !== 1 ? "s" : "")}${fail > 0 ? ` · ⚠️ ${fail} con error` : ""}`);
};

/* P1 REFACTOR 2026-05-08 (peticion usuario): 3 sub-tabs Crear/Mis/Papelera.
   Tab "Crear plantilla" tiene el form. "Mis plantillas" lista. "Papelera"
   con botón vaciar. Persiste sub-tab activa en localStorage. */
const TPL_SUBTAB_KEY = "ui:tplSubTab";
const __activateTplSubTab = (target) => {
  qsa(".tpl-section-tab").forEach((b) => {
    const isActive = b.dataset.tplSection === target;
    b.classList.toggle("is-active", isActive);
    b.style.color = isActive ? "#FF6B00" : "#6b7280";
    b.style.borderBottomColor = isActive ? "#FF6B00" : "transparent";
  });
  const createEl = qs("#tplSectionCreate");
  const activeEl = qs("#tplSectionActive");
  const trashEl = qs("#tplSectionTrash");
  if (createEl) createEl.style.display = target === "create" ? "" : "none";
  if (activeEl) activeEl.style.display = target === "active" ? "" : "none";
  if (trashEl) trashEl.style.display = target === "trash" ? "" : "none";
  try { localStorage.setItem(TPL_SUBTAB_KEY, target); } catch (_) {}
  if (target === "trash") refreshTemplatesTrash();
  if (target === "active") refreshTemplates(); /* refresca contador y tabla */
};
qsa(".tpl-section-tab").forEach((btn) => {
  btn.addEventListener("click", () => __activateTplSubTab(btn.dataset.tplSection));
});
/* Restaurar sub-tab al cargar (si hay valor guardado). */
try {
  const saved = localStorage.getItem(TPL_SUBTAB_KEY);
  if (saved === "active" || saved === "trash") __activateTplSubTab(saved);
  /* "create" es el default visual, no hace falta activar explícitamente. */
} catch (_) {}

/* P1 FEAT 2026-05-08: select all en cabecera de papelera (estilo Gmail). */
qs("#tplTrashSelectAll")?.addEventListener("change", (ev) => {
  const checked = ev.target.checked;
  qsa(".tpl-trash-cb").forEach((cb) => {
    cb.checked = checked;
    const id = cb.dataset.id;
    if (checked) __tplTrashSelected.add(id);
    else __tplTrashSelected.delete(id);
  });
  __tplTrashUpdateBulkBar();
});

/* P1 FEAT 2026-05-08: botón vaciar papelera completa. */
qs("#tplEmptyTrashBtn")?.addEventListener("click", async () => {
  const ok = await rubenCotonConfirm({
    title: "Vaciar papelera",
    icon: "⚠️",
    subtitle: "Eliminar TODAS las plantillas en papelera",
    body: "Esta acción <strong>elimina permanentemente</strong> todas las plantillas que están en la papelera (incluidos sus archivos adjuntos).<br><br>No se puede deshacer.",
    confirmText: "Sí, vaciar papelera"
  });
  if (!ok) return;
  try {
    const r = await api("/api/templates/trash", { method: "DELETE" });
    toast(`✅ ${r.message || "Papelera vaciada"}`);
    await refreshTemplatesTrash();
  } catch (e) {
    rubenCotonAlert({ title: "No se pudo vaciar", body: humanizeError(e), icon: "❌", tone: "error" });
  }
});

/* P1 FEAT 2026-05-08: ordenacion al click en header + busqueda en vivo.
   Reusan state.templates en memoria → no hace falta volver a la API. */
qsa(".tpl-sort").forEach((th) => {
  th.addEventListener("click", () => {
    const k = th.dataset.tplSort;
    if (__tplListState.sortKey === k) {
      __tplListState.sortDir = __tplListState.sortDir === "asc" ? "desc" : "asc";
    } else {
      __tplListState.sortKey = k;
      __tplListState.sortDir = k === "updated" ? "desc" : "asc";
    }
    if (Array.isArray(state.templates)) renderTemplates(state.templates);
  });
});

/* Busqueda con debounce 150ms para no re-renderizar en cada tecla. */
let __tplSearchTimer = null;
qs("#templatesSearch")?.addEventListener("input", (ev) => {
  __tplListState.search = ev.target.value || "";
  if (__tplSearchTimer) clearTimeout(__tplSearchTimer);
  __tplSearchTimer = setTimeout(() => {
    if (Array.isArray(state.templates)) renderTemplates(state.templates);
  }, 150);
});

/* Refrescar papelera al entrar en la pestaña Plantillas (nº actualizado en counter). */
document.addEventListener("rubencoton:tab", (ev) => {
  if (ev.detail?.tab === "templates") refreshTemplatesTrash();
});

window.tplEdit = async (id) => {
  /* P1 FEAT 2026-05-08: loadingHint inmediato visible mientras se carga
     la plantilla para edición (cambio de tab + populate form). */
  const lh = loadingHint("Cargando plantilla…");
  try {
    /* P1 FIX UX#5 (audit 2026-05-08): si hay otra edición en curso con
       cambios en el editor HTML, pedir confirmación antes de sobrescribir.
       Detecta cambios comparando id editando + contenido del editor. */
    const currentEditId = qs("#templateEditingId")?.value;
    const currentHtml = (qs("#tplHtmlEditor")?.value || "").trim();
    if (currentEditId && currentEditId !== id && currentHtml) {
      const ok = await rubenCotonConfirm({
        title: "¿Descartar cambios?",
        icon: "⚠️",
        subtitle: "Tienes cambios sin guardar",
        body: "Si abres otra plantilla, los cambios actuales se perderán.<br><br>¿Continuar?",
        confirmText: "Sí, descartar"
      });
      if (!ok) return;
    }
    const data = await api(`/api/templates/${id}`);
    const t = data.template;
    if (!t) throw new Error("Plantilla no encontrada");

    /* Cargar datos en el formulario */
    const editingIdEl = qs("#templateEditingId");
    const editBannerEl = qs("#templateEditBanner");
    const submitBtn = qs("#templateSubmitBtn");
    const nameInput = templateForm?.querySelector('input[name="name"]');
    const subjectInput = templateForm?.querySelector('input[name="subject"]');
    /* P1 FIX BUG #7 (audit 2026-05-08): cargar previewText (pre-header).
       Sin esto, al guardar la edición el input estaba vacío y se borraba
       el pre-header existente en BBDD. */
    const previewInput = templateForm?.querySelector('input[name="previewText"]');
    const textInput = templateForm?.querySelector('textarea[name="text"]');

    /* P1 REFACTOR 2026-05-08: al editar, ir a sub-tab "Crear plantilla"
       (donde está el formulario) para que el usuario vea el editor. */
    if (typeof __activateTplSubTab === "function") __activateTplSubTab("create");

    if (editingIdEl) editingIdEl.value = t.id;
    if (editBannerEl) editBannerEl.style.display = "flex";
    if (submitBtn) submitBtn.textContent = "💾 Actualizar plantilla";
    if (nameInput) nameInput.value = t.name || "";
    if (subjectInput) subjectInput.value = t.subject || "";
    if (previewInput) previewInput.value = t.previewText || "";
    if (tplHtmlEditor) tplHtmlEditor.value = t.html || "";
    if (textInput) textInput.value = t.text || "";

    /* P1 REFACTOR 2026-05-08: si la plantilla tiene HTML, también poblamos
       el editor Gmail (extraemos el <body> si lo hay) por si el usuario
       quiere editarlo en modo WYSIWYG. El click a codeTab está más abajo. */
    const tplGmailEditorEl = qs("#tplGmailEditor");
    if (tplGmailEditorEl) {
      if (t.html) {
        const bodyMatch = t.html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        tplGmailEditorEl.innerHTML = bodyMatch ? bodyMatch[1] : t.html;
      } else {
        tplGmailEditorEl.innerHTML = "<p>Escribe aquí tu email como si lo estuvieras redactando en Gmail…</p>";
      }
    }

    /* Disparar evento sintético para que el observer/polling detecte
       el cambio de editingId y muestre la caja de adjuntos. */
    if (editingIdEl) {
      editingIdEl.dispatchEvent(new Event("change", { bubbles: true }));
    }

    /* Cambiar a tab Código HTML para que el usuario vea qué está editando */
    const codeTab = qs('.tpl-tab[data-tpl-view="code"]');
    if (codeTab) codeTab.click();

    /* Scroll suave al formulario */
    templateForm?.scrollIntoView({ behavior: "smooth", block: "start" });

    /* Actualizar preview si hay cualquier binding */
    tplHtmlEditor?.dispatchEvent(new Event("input"));
  } catch (e) {
    rubenCotonAlert({ title: "No se pudo cargar el borrador", body: humanizeError(e), icon: "❌", tone: "error" });
  } finally {
    lh.hide();
  }
};

/* Subir archivo HTML y cargarlo en el editor */
qs("#tplHtmlFile")?.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  const infoEl = qs("#tplHtmlFileInfo");
  if (!file) {
    if (infoEl) infoEl.textContent = "";
    return;
  }
  /* Validacion basica: extension y tamano (max 2MB) */
  const nameLower = file.name.toLowerCase();
  if (!/\.(html?|htm)$/i.test(nameLower)) {
    if (infoEl) infoEl.textContent = "Error: solo archivos .html o .htm";
    event.target.value = "";
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    if (infoEl) infoEl.textContent = "Error: el archivo supera 2 MB";
    event.target.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const content = String(reader.result || "");
    if (tplHtmlEditor) {
      tplHtmlEditor.value = content;
      tplHtmlEditor.dispatchEvent(new Event("input"));
    }
    if (infoEl) {
      const kb = (file.size / 1024).toFixed(1);
      infoEl.textContent = `✓ ${file.name} (${kb} KB) cargado en el editor`;
    }
  };
  reader.onerror = () => {
    if (infoEl) infoEl.textContent = "Error al leer el archivo";
  };
  reader.readAsText(file, "UTF-8");
});

/* Subir archivo HTML en el modo "Pegar HTML" de Crear campaña */
qs("#campHtmlFile")?.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  const infoEl = qs("#campHtmlFileInfo");
  const editor = qs("#campHtmlEditor");
  if (!file) {
    if (infoEl) infoEl.textContent = "";
    return;
  }
  const nameLower = file.name.toLowerCase();
  if (!/\.(html?|htm)$/i.test(nameLower)) {
    if (infoEl) infoEl.textContent = "Error: solo archivos .html o .htm";
    event.target.value = "";
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    if (infoEl) infoEl.textContent = "Error: el archivo supera 2 MB";
    event.target.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const content = String(reader.result || "");
    if (editor) {
      editor.value = content;
      editor.dispatchEvent(new Event("input"));
    }
    if (infoEl) {
      const kb = (file.size / 1024).toFixed(1);
      infoEl.textContent = `✓ ${file.name} (${kb} KB) cargado. Pulsa "Vista previa" para ver cómo queda.`;
    }
  };
  reader.onerror = () => {
    if (infoEl) infoEl.textContent = "Error al leer el archivo";
  };
  reader.readAsText(file, "UTF-8");
});

/* Cancelar edición */
qs("#templateEditCancel")?.addEventListener("click", () => {
  const editingIdEl = qs("#templateEditingId");
  const editBannerEl = qs("#templateEditBanner");
  const submitBtn = qs("#templateSubmitBtn");
  if (editingIdEl) editingIdEl.value = "";
  if (editBannerEl) editBannerEl.style.display = "none";
  if (submitBtn) submitBtn.textContent = "💾 Guardar plantilla";
  templateForm?.reset();
  if (tplHtmlEditor) tplHtmlEditor.value = "";
  tplHtmlEditor?.dispatchEvent(new Event("input"));
  /* P1 FIX BUG #5 (audit 2026-05-08): disparar change para que la caja
     de adjuntos se oculte sin polling. */
  if (editingIdEl) editingIdEl.dispatchEvent(new Event("change", { bubbles: true }));
});

/* P1 REFACTOR 2026-05-08: alias funciones obsoletas de validar para no
   romper si alguna parte del código las invoca (ej. links internos). */
window.tplValidate = window.tplValidate || (() => {});
window.tplUnvalidate = window.tplUnvalidate || (() => {});

const renderSegments = (segments) => {
  segmentsTableBody.innerHTML = segments
    .map((segment) => {
      const firstRule = segment.rules?.[0] || {};
      return `
      <tr>
        <td>${segment.name}</td>
        <td>${firstRule.field || "-"} ${firstRule.op || "-"} ${firstRule.value || ""}</td>
        <td>${segment.count || 0}</td>
      </tr>
    `;
    })
    .join("");

  /* BUG FIX CRITICO (2026-04-22): NO poblar campaignSegmentSelect con
   * segmentos. Este select es "Lista" en Crear campaña y debe contener
   * SOLO las listas del CRM seleccionado (lo hace populateCampaignListSelector).
   * Mezclar segmentos del sistema aquí causaba que el usuario pudiera elegir
   * "Suscritos activos (51398)" creyendo que era una lista, y enviar a todos. */
};

/* Mostrar destinatarios al cambiar segmento */
const recipientCountEl = qs("#campaignRecipientCount");
campaignSegmentSelect?.addEventListener("change", () => {
  const id = campaignSegmentSelect.value;
  if (!id) {
    if (recipientCountEl) recipientCountEl.innerHTML = `<strong style="color:var(--brand-red)">${(state.contactsTotal || 35000).toLocaleString("es-ES")}</strong> contactos recibirán este email.`;
  } else {
    const seg = state.segments.find(s => s.id === id);
    if (seg && recipientCountEl) recipientCountEl.innerHTML = `<strong style="color:var(--brand-red)">${(seg.count || 0).toLocaleString("es-ES")}</strong> contactos en "${esc(seg.name)}" recibirán este email.`;
  }
});

const sendCampaign = async (campaignId, btn) => {
  /* BLINDAJE: deshabilitamos el botón ANTES del confirm() para que un doble
   * click no dispare dos envíos en paralelo antes de que el usuario acepte. */
  if (btn && btn.disabled) return;
  if (btn) { btn.disabled = true; btn.textContent = "Confirmando…"; }
  const confirmed = confirm("¿Enviar esta campaña ahora? Una vez en cola no se puede deshacer.");
  if (!confirmed) {
    if (btn) { btn.disabled = false; btn.textContent = "Enviar"; }
    return;
  }
  if (btn) { btn.textContent = "Enviando…"; }

  const resetBtn = () => {
    if (btn) { btn.disabled = false; btn.textContent = "Enviar"; }
  };

  const doSend = async (body) => {
    const options = { method: "POST" };
    if (body) {
      options.headers = { "Content-Type": "application/json" };
      options.body = JSON.stringify(body);
    }
    return api(`/api/campaigns/${campaignId}/send`, options);
  };

  try {
    let data;
    try {
      data = await doSend();
    } catch (err) {
      /* Si el servidor exige confirmSendAll (envio masivo sin segmento),
       * mostrar confirm explicito y reintentar. */
      const msg = String(err && err.message || "");
      if (/SIN segmento/i.test(msg) || /confirmSendAll/i.test(msg)) {
        if (!confirm(`${msg}\n\n¿Confirmas que quieres enviar a TODOS los contactos?`)) {
          campaignResult.textContent = "Envio cancelado.";
          resetBtn();
          return;
        }
        data = await doSend({ confirmSendAll: true });
      } else {
        throw err;
      }
    }

    const total = data && data.job && data.job.totals && data.job.totals.total;
    campaignResult.textContent = `OK: campaña en cola${total ? ` (${total} destinatarios)` : ""}`;
    await refreshCampaigns();
  } catch (error) {
    campaignResult.textContent = `Error: ${error.message}`;
    resetBtn();
  }
};

/* ── Modal: Enviar informe de campana por email ── */
let _sendReportCampaignId = null;
const openSendReportModal = (campaignId, campaignName) => {
  _sendReportCampaignId = campaignId;
  const modal = document.getElementById("sendReportModal");
  const nameInput = document.getElementById("srCampaignName");
  const recInput = document.getElementById("srRecipients");
  const subjInput = document.getElementById("srSubject");
  const msgInput = document.getElementById("srMessage");
  const status = document.getElementById("srStatus");
  if (!modal) return;
  if (nameInput) nameInput.value = campaignName || campaignId;
  if (recInput) recInput.value = "";
  if (subjInput) subjInput.value = "";
  if (msgInput) msgInput.value = "";
  if (status) { status.textContent = ""; status.className = "ai-gen-status"; }
  modal.setAttribute("aria-hidden", "false");
  modal.classList.add("is-open");
  setTimeout(() => recInput && recInput.focus(), 50);
};
const closeSendReportModal = () => {
  const modal = document.getElementById("sendReportModal");
  if (!modal) return;
  modal.setAttribute("aria-hidden", "true");
  modal.classList.remove("is-open");
  _sendReportCampaignId = null;
};
document.addEventListener("click", (e) => {
  if (e.target.matches("[data-sr-close]")) closeSendReportModal();
});
document.addEventListener("DOMContentLoaded", () => {
  const seedBtn = document.getElementById("seedDemoBtn");
  const clearBtn = document.getElementById("clearDemoBtn");
  const seedStatus = document.getElementById("seedDemoStatus");
  if (seedBtn) {
    seedBtn.addEventListener("click", async () => {
      seedBtn.disabled = true;
      if (seedStatus) seedStatus.textContent = "Creando campañas demo…";
      try {
        const data = await api("/api/dev/seed-demo-campaigns", { method: "POST" });
        if (seedStatus) seedStatus.textContent = `✅ ${data.created} campañas demo creadas`;
        await refreshCampaigns();
      } catch (e) {
        if (seedStatus) seedStatus.textContent = `Error: ${e.message}`;
      } finally {
        seedBtn.disabled = false;
      }
    });
  }
  if (clearBtn) {
    clearBtn.addEventListener("click", async () => {
      if (!confirm("¿Borrar todas las campañas y contactos marcados como demo?")) return;
      clearBtn.disabled = true;
      if (seedStatus) seedStatus.textContent = "Borrando demo…";
      try {
        const data = await api("/api/dev/seed-demo-campaigns", { method: "DELETE" });
        if (seedStatus) seedStatus.textContent = `🗑 ${data.removedCampaigns} campañas y ${data.removedContacts} contactos borrados`;
        await refreshCampaigns();
      } catch (e) {
        if (seedStatus) seedStatus.textContent = `Error: ${e.message}`;
      } finally {
        clearBtn.disabled = false;
      }
    });
  }

  const btn = document.getElementById("srSendBtn");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    if (!_sendReportCampaignId) return;
    const recipients = (document.getElementById("srRecipients").value || "").trim();
    const subject = (document.getElementById("srSubject").value || "").trim();
    const message = (document.getElementById("srMessage").value || "").trim();
    const status = document.getElementById("srStatus");
    if (!recipients) {
      if (status) { status.textContent = "Falta al menos un email destinatario."; status.className = "ai-gen-status is-error"; }
      return;
    }
    btn.disabled = true;
    if (status) { status.textContent = "Enviando informe..."; status.className = "ai-gen-status is-loading"; }
    try {
      const data = await api(`/api/campaigns/${_sendReportCampaignId}/send-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipients, subject, message })
      });
      if (status) {
        status.textContent = `OK · enviado a ${data.recipients.length} destinatario(s). Job ${data.jobId}`;
        status.className = "ai-gen-status is-ok";
      }
      setTimeout(closeSendReportModal, 1800);
    } catch (err) {
      if (status) { status.textContent = `Error: ${err.message}`; status.className = "ai-gen-status is-error"; }
    } finally {
      btn.disabled = false;
    }
  });
});

/* Estado de ordenación de la tabla "Estado campañas" — petición usuario 2026-05-05.
 * Sticky en HTML/CSS; aquí sólo sort. Persiste entre re-renders del polling. */
/* P0 UX 2026-05-09 (peticion usuario): orden por defecto = más antigua arriba
 * (número ASC), igual que el dashboard. El usuario puede cambiar pulsando
 * cualquier cabecera de la tabla. */
const campaignsSortState = window.__campaignsSortState || (window.__campaignsSortState = { key: "number", dir: "asc" });
const campaignSortValue = (c, key) => {
  const st = c.stats || {};
  const total = st.total || 0;
  const sent = st.sent || 0;
  const opens = st.openedUnique || st.opened || 0;
  const clicks = st.clickedUnique || st.clicked || 0;
  const replies = st.replied || 0;
  const bounces = st.bounced || 0;
  switch (key) {
    case "number": return Number(c.number) || 0;
    case "name": return String(c.name || "").toLowerCase();
    case "status": return String(c.status || "").toLowerCase();
    case "total": return total;
    case "sent": return total > 0 ? sent / total : 0;
    case "opens": return sent > 0 ? opens / sent : 0;
    case "clicks": return sent > 0 ? clicks / sent : 0;
    case "ctor": return opens > 0 ? clicks / opens : 0;
    case "replies": return sent > 0 ? replies / sent : 0;
    case "bounces": return sent > 0 ? bounces / sent : 0;
    default: return 0;
  }
};
/* Helper para formatear número de campaña: 1 -> "0001", 42 -> "0042". */
const fmtCampaignNumber = (n) => {
  const num = Number(n) || 0;
  if (num <= 0) return "—";
  return String(num).padStart(4, "0");
};
const initCampaignSortListener = () => {
  if (window.__campaignsSortInit) return;
  const thead = document.querySelector("#campaignsTable thead");
  if (!thead) return;
  window.__campaignsSortInit = true;
  thead.addEventListener("click", (ev) => {
    const th = ev.target.closest("th[data-sort-key]");
    if (!th) return;
    const key = th.dataset.sortKey;
    if (!key || key === "__none__") return;
    if (campaignsSortState.key === key) {
      campaignsSortState.dir = campaignsSortState.dir === "asc" ? "desc" : "asc";
    } else {
      campaignsSortState.key = key;
      campaignsSortState.dir = key === "name" ? "asc" : "desc";
    }
    if (Array.isArray(state.campaigns)) renderCampaigns(state.campaigns);
  });
};
const updateCampaignSortIndicators = () => {
  const ths = document.querySelectorAll("#campaignsTable thead th[data-sort-key]");
  ths.forEach((th) => {
    const k = th.dataset.sortKey;
    const active = k === campaignsSortState.key && k !== "__none__";
    th.dataset.sortActive = String(active);
    const arrow = th.querySelector(".sort-arrow");
    if (arrow) {
      if (k === "__none__") { arrow.style.display = "none"; return; }
      arrow.textContent = active ? (campaignsSortState.dir === "asc" ? "▲" : "▼") : "⇅";
    }
  });
};

/* P1 FEAT 2026-05-08 (peticion usuario): scorecard por campaña.
   P2 REFACTOR 2026-05-08 (peticion usuario "que aparezca durante el envío,
   no solo al completar"): ahora devuelve scorecard EN CUANTO hay envíos
   (sent > 0), independiente del status. Marca inProgress=true si la
   campaña aún está en sending/queued/paused para que la UI lo indique. */
const getCampaignScorecard = (c) => {
  if (!c) return null;
  const s = c.stats || {};
  const total = s.totalRecipients || s.total || 0;
  const sent = s.sent || 0;
  if (sent === 0) return null; /* sin datos aún → sin nota */
  const inProgress = ["sending", "queued", "paused"].includes(c.status);
  const opened = s.openedUnique || s.opened || 0;
  const clicked = s.clickedUnique || s.clicked || 0;
  const bounced = s.bounced || 0;
  const replied = s.replied || 0;
  const complained = s.complained || 0;

  /* Tasas */
  const openRate   = sent > 0 ? (opened / sent) * 100 : 0;
  const clickRate  = sent > 0 ? (clicked / sent) * 100 : 0;
  const ctor       = opened > 0 ? (clicked / opened) * 100 : 0;
  const replyRate  = sent > 0 ? (replied / sent) * 100 : 0;
  const bounceRate = sent > 0 ? (bounced / sent) * 100 : 0;
  const spamRate   = sent > 0 ? (complained / sent) * 100 : 0;

  /* Puntuación 0-100 ponderada por benchmarks de email marketing.
     Pesos: open 30, click 25, ctor 15, reply 10, anti-bounce 15, anti-spam 5. */
  const scoreOpen    = Math.min(100, openRate / 20 * 100);   /* 20% open = 100pt */
  const scoreClick   = Math.min(100, clickRate / 5 * 100);   /* 5% click = 100pt */
  const scoreCtor    = Math.min(100, ctor / 25 * 100);       /* 25% ctor = 100pt */
  const scoreReply   = Math.min(100, replyRate / 2 * 100);   /* 2% reply = 100pt */
  const scoreBounce  = bounceRate >= 8 ? 0 : Math.max(0, 100 - bounceRate * 12);
  const scoreSpam    = spamRate >= 0.5 ? 0 : Math.max(0, 100 - spamRate * 200);
  const score = Math.round(
    scoreOpen   * 0.30 +
    scoreClick  * 0.25 +
    scoreCtor   * 0.15 +
    scoreReply  * 0.10 +
    scoreBounce * 0.15 +
    scoreSpam   * 0.05
  );

  /* P1 REFACTOR 2026-05-08 (peticion usuario): escala 0-10 + etiqueta clara
     en español que cualquier persona entienda. Antes A/B/C/D/F = confuso.
     Score 0-100 se convierte a 0-10 con 1 decimal. */
  const score10 = Math.round(score / 10 * 10) / 10; /* 0.0 - 10.0 con 1 decimal */
  let grade, gradeColor, gradeBg;
  if (score >= 80)      { grade = "Excelente";        gradeColor = "#065f46"; gradeBg = "#d1fae5"; }
  else if (score >= 65) { grade = "Muy bien";         gradeColor = "#1e40af"; gradeBg = "#dbeafe"; }
  else if (score >= 50) { grade = "Bien";             gradeColor = "#92400e"; gradeBg = "#fef3c7"; }
  else if (score >= 35) { grade = "Regular";          gradeColor = "#9a3412"; gradeBg = "#ffedd5"; }
  else                   { grade = "Necesita mejorar"; gradeColor = "#991b1b"; gradeBg = "#fee2e2"; }

  /* P1 REFACTOR 2026-05-08 (peticion usuario "que cualquiera lo entienda
     aunque no sepa nada"): diagnósticos en español llano, sin tecnicismos
     (sin "A/B", sin "CTOR"), con acción concreta y tono conversacional. */
  const issues = [];
  if (spamRate > 0.1) {
    issues.push({ priority: 1, msg: `🚨 Marcaron el correo como spam (${spamRate.toFixed(2)}%). Suena demasiado a publicidad: quita palabras como GRATIS, OFERTA, !!!` });
  }
  if (bounceRate >= 5) {
    issues.push({ priority: 2, msg: `⚠️ Muchos rebotes (${bounceRate.toFixed(1)}%). Hay emails que ya no existen en tu lista — límpiala antes del próximo envío` });
  } else if (bounceRate >= 3) {
    issues.push({ priority: 3, msg: `Algunos emails inválidos (${bounceRate.toFixed(1)}% rebotes). Revisa la lista para próximas campañas` });
  }
  if (openRate < 10 && sent >= 50) {
    issues.push({ priority: 2, msg: `📭 Casi nadie abrió el correo (${openRate.toFixed(1)}% aperturas). El asunto no engancha — prueba uno más corto, personal y curioso` });
  } else if (openRate < 15 && sent >= 50) {
    issues.push({ priority: 4, msg: `Pocas aperturas (${openRate.toFixed(1)}%). El asunto se puede mejorar para llamar más la atención` });
  }
  if (opened >= 20 && ctor < 10) {
    issues.push({ priority: 3, msg: `🖱 Lo abren pero no hacen clic. Mejora el botón principal: más grande, color llamativo, texto claro como "Ver propuesta"` });
  }
  if (clicked >= 5 && replyRate === 0) {
    issues.push({ priority: 5, msg: `💬 Nadie respondió. Pídelo al final: "¿Qué te parece? Responde a este mismo correo"` });
  }
  /* P1 FIX BUG (peticion usuario "audita"): cuando hay pocos envios (sent<50)
     pero la lista es grande (total>=100), antes ningun issue se disparaba
     -> caia al mensaje "Bien hecho" aunque la nota fuera baja. CONTRADICTORIO.
     Ahora: detecto el caso "todavia se esta evaluando" y muestro mensaje
     neutro ANTES del fallback "all good". */
  const fewSends = sent < 50;
  if (fewSends && total >= 100) {
    issues.push({ priority: 7, msg: `⏳ Aún hay pocos envíos (${sent} de ${total}). La nota se actualizará según se envíen más correos` });
  } else if (sent < 50 && total < 100) {
    issues.push({ priority: 6, msg: `📊 Lista pequeña (${total} contactos). Con tan pocos envíos, los datos no son fiables todavía` });
  }

  issues.sort((a, b) => a.priority - b.priority);
  /* P1 FIX: solo mostrar "Bien hecho" si NO hay issues Y hay envíos
     suficientes (sent >= 50). Si hay pocos envíos sin issues graves,
     los issues que añadimos arriba ya cubren el mensaje. */
  const diagnostic = issues.length
    ? issues.slice(0, 2).map(i => i.msg).join(" · ")
    : (sent >= 50
        ? "✅ ¡Bien hecho! Esta campaña funciona muy bien — repite la fórmula"
        : `⏳ Aún hay pocos envíos (${sent}). La nota se actualizará según se envíen más correos`);

  return { score, score10, grade, gradeColor, gradeBg, diagnostic, inProgress, openRate, clickRate, ctor, replyRate, bounceRate, spamRate };
};

const renderCampaigns = (campaigns) => {
  initCampaignSortListener();
  if (Array.isArray(campaigns)) {
    /* P0 UX 2026-05-09: orden base SIEMPRE número ASC (más antigua arriba).
     * Si el usuario ha pulsado una cabecera, aplica su sort encima. */
    const sortKey = campaignsSortState.key || "number";
    const sortDir = campaignsSortState.key ? campaignsSortState.dir : "asc";
    const dir = sortDir === "desc" ? -1 : 1;
    campaigns = [...campaigns].sort((a, b) => {
      const va = campaignSortValue(a, sortKey);
      const vb = campaignSortValue(b, sortKey);
      if (typeof va === "string" || typeof vb === "string") {
        return String(va).localeCompare(String(vb)) * dir;
      }
      return ((va || 0) - (vb || 0)) * dir;
    });
  }
  const statusLabels = {
    draft: "Borrador",
    queued: "En cola",
    sending: "Enviando",
    sent: "Enviada",
    paused: "Pausada",
    failed: "Error",
    scheduled: "Programada",
    completed: "Completada",
  };
  const statusBadge = (s, qp) => {
    /* PETICION USUARIO 2026-05-06: diferenciar VISUALMENTE "ENVIANDO AHORA"
     * (campaña activa procesando) vs "EN COLA Pos. N" (esperando turno). */
    if (s === "sending" || (s === "queued" && qp === 0)) {
      return `<div style="display:inline-flex;flex-direction:column;align-items:center;gap:3px">
        <span style="background:#16a34a;color:#fff;padding:4px 12px;border-radius:14px;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:0.5px;display:inline-block;box-shadow:0 0 0 2px rgba(22,163,74,0.18)">▶ ENVIANDO AHORA</span>
        <span style="font-size:9.5px;color:#16a34a;font-weight:800">campaña activa</span>
      </div>`;
    }
    if (s === "queued" && typeof qp === "number" && qp >= 1) {
      /* PETICION USUARIO 2026-05-06: la siguiente que enviara cuando
       * termine la activa es Pos. 1 (no Pos. 2). qp=1 -> "Pos. 1". */
      return `<div style="display:inline-flex;flex-direction:column;align-items:center;gap:3px">
        <span style="background:#fef3c7;color:#92400e;padding:4px 12px;border-radius:14px;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:0.5px;display:inline-block;border:1px solid #fcd34d">⏳ EN COLA</span>
        <span style="font-size:9.5px;color:#92400e;font-weight:800">Pos. ${qp}${qp === 1 ? " (siguiente)" : ""}</span>
      </div>`;
    }
    if (s === "paused") {
      return `<div style="display:inline-flex;flex-direction:column;align-items:center;gap:3px">
        <span style="background:#e2e8f0;color:#475569;padding:4px 12px;border-radius:14px;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:0.5px;display:inline-block">⏸ PAUSADA</span>
      </div>`;
    }
    if (s === "sent") {
      return `<div style="display:inline-flex;flex-direction:column;align-items:center;gap:3px">
        <span style="background:#bbf7d0;color:#166534;padding:4px 12px;border-radius:14px;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:0.5px;display:inline-block">✓ COMPLETADA</span>
      </div>`;
    }
    if (s === "failed") {
      return `<div style="display:inline-flex;flex-direction:column;align-items:center;gap:3px">
        <span style="background:#fecaca;color:#991b1b;padding:4px 12px;border-radius:14px;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:0.5px;display:inline-block">⚠ FALLO</span>
      </div>`;
    }
    const label = statusLabels[s] || s;
    return `<span class="status-badge status-${esc(s)}">${esc(label)}</span>`;
  };
  /* PETICION USUARIO 2026-05-05: cada celda metrica con 3 lineas:
   * - Numero (arriba)
   * - Porcentaje (medio)
   * - Estado (abajo, con color: excelente/bueno/normal/por mejorar)
   *
   * Benchmarks ajustados a sector publico (concejalias). */
  const evalMetric = (kind, value, base, statusOverride) => {
    const pct = base > 0 ? (value / base) * 100 : 0;
    let label, cls;
    if (kind === "sent") {
      /* P1 FIX 2026-05-08 (peticion usuario): faltaba caso pct>=100.
         Antes mostraba "CASI HECHO" incluso al 100% de envíos. */
      /* P1 BLINDAJE 2026-05-08: si la campaña está marcada como "completed"
         o "sent" en BBDD, forzar COMPLETADO independientemente del cálculo
         (evita edge cases de redondeo o discrepancia entre value/base). */
      if (statusOverride === "completed" || statusOverride === "sent") {
        label = "COMPLETADO"; cls = "ok";
      }
      else if (pct >= 100) { label = "COMPLETADO"; cls = "ok"; }
      else if (pct >= 75) { label = "CASI HECHO"; cls = "ok"; }
      else if (pct >= 50) { label = "AVANZANDO"; cls = "ok"; }
      else if (pct >= 25) { label = "EN MARCHA"; cls = "warn"; }
      else { label = "INICIANDO"; cls = "warn"; }
    } else if (kind === "open") {
      if (pct >= 20) { label = "EXCELENTE"; cls = "ok"; }
      else if (pct >= 15) { label = "BUENO"; cls = "ok"; }
      else if (pct >= 10) { label = "NORMAL"; cls = "warn"; }
      else { label = "POR MEJORAR"; cls = "bad"; }
    } else if (kind === "click") {
      if (pct >= 5) { label = "EXCELENTE"; cls = "ok"; }
      else if (pct >= 3) { label = "BUENO"; cls = "ok"; }
      else if (pct >= 2) { label = "NORMAL"; cls = "warn"; }
      else { label = "POR MEJORAR"; cls = "bad"; }
    } else if (kind === "ctor") {
      /* CTOR (clic ÷ apertura): mide si quienes abren acaban interactuando.
       * Benchmarks de email marketing: 10-15% normal, >25% excepcional. */
      if (pct >= 25) { label = "EXCELENTE"; cls = "ok"; }
      else if (pct >= 15) { label = "BUENO"; cls = "ok"; }
      else if (pct >= 10) { label = "NORMAL"; cls = "warn"; }
      else { label = "POR MEJORAR"; cls = "bad"; }
    } else if (kind === "reply") {
      if (pct >= 2) { label = "EXCELENTE"; cls = "ok"; }
      else if (pct >= 1) { label = "BUENO"; cls = "ok"; }
      else if (pct >= 0.5) { label = "NORMAL"; cls = "warn"; }
      else { label = "POR MEJORAR"; cls = "bad"; }
    } else if (kind === "bounce") {
      if (pct < 2) { label = "EXCELENTE"; cls = "ok"; }
      else if (pct < 5) { label = "BUENO"; cls = "ok"; }
      else if (pct < 8) { label = "NORMAL"; cls = "warn"; }
      else { label = "POR MEJORAR"; cls = "bad"; }
    }
    return { pct: pct.toFixed(1), label, cls };
  };
  /* PETICION USUARIO 2026-05-05: porcentaje GRANDE como dato principal,
   * número pequeño arriba, etiqueta abajo. Alturas fijas en cada bloque
   * para que entre filas todos los números, porcentajes y etiquetas
   * queden a la misma altura horizontal (alineación columnar perfecta). */
  const cellMetric = (n, kind, value, base, statusOverride) => {
    const e = evalMetric(kind, value, base, statusOverride);
    const colors = {
      ok: "background:#d1fae5;color:#065f46",
      warn: "background:#fef3c7;color:#92400e",
      bad: "background:#fee2e2;color:#991b1b"
    };
    return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:flex-start;text-align:center;line-height:1.1;gap:4px">
      <div style="height:16px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;color:#64748b">${n.toLocaleString("es-ES")}</div>
      <div style="height:28px;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:900;color:#111;letter-spacing:-0.5px">${e.pct}%</div>
      <div style="height:20px;display:inline-flex;align-items:center;justify-content:center;font-size:8.5pt;font-weight:800;letter-spacing:0.4px;padding:0 8px;border-radius:10px;${colors[e.cls]}">${e.label}</div>
    </div>`;
  };

  campaignsTableBody.innerHTML = campaigns
    .map((c) => {
      const st = c.stats || {};
      const total = st.total || 0;
      const sent = st.sent || 0;
      const opens = st.openedUnique || st.opened || 0;
      const clicks = st.clickedUnique || st.clicked || 0;
      const replies = st.replied || 0;
      const bounces = st.bounced || 0;
      const canSend = c.status === "draft";
      const canPause = c.status === "sending" || c.status === "queued";
      const canResume = c.status === "paused";
      const canCancel = ["sending", "queued", "paused"].includes(c.status);
      /* P0 FEAT 2026-05-09 (peticion usuario "elegir orden en la cola"):
       * Solo se puede reordenar si está en cola (queued/paused), no si
       * está enviando activamente (la campaña activa siempre va primero). */
      const canReorder = c.status === "queued" || c.status === "paused";
      /* PETICION USUARIO 2026-05-05: numero + fecha inicio + fecha fin.
       * Inicio = sentAt (cuando se lanzo la campaña). Fin = completedAt (cuando
       * se acabo de enviar). Si aun esta sending, mostrar "en curso". */
      const numLabel = fmtCampaignNumber(c.number);
      const fmtFecha = (iso) => {
        if (!iso) return "—";
        try {
          const d = new Date(iso);
          if (isNaN(d.getTime())) return "—";
          const dia = d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit" });
          const hora = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", hour12: false });
          return `${dia} ${hora}`;
        } catch (_e) { return "—"; }
      };
      const inicioStr = fmtFecha(c.sentAt);
      let finStr;
      if (c.completedAt) finStr = fmtFecha(c.completedAt);
      else if (c.status === "sending" || c.status === "queued" || c.status === "paused") finStr = "<span style='color:#FF6B00;font-weight:700'>en curso</span>";
      else finStr = "—";
      /* P1 FEAT 2026-05-08 (peticion usuario): scorecard A-F + diagnóstico
         para campañas completadas. Aparece como pill al lado del nombre +
         diagnóstico en línea siguiente. */
      const scorecard = getCampaignScorecard(c);
      /* P2 REFACTOR 2026-05-08: si la campaña está en curso (sending/queued/
         paused), añadir " · en curso" al badge para indicar que la nota
         puede cambiar cuando termine. */
      const liveSuffix = scorecard?.inProgress
        ? ` <span style="opacity:0.65;font-weight:600;font-size:9.5px">· en curso</span>`
        : "";
      const scorecardBadge = scorecard
        ? `<span title="Nota global basada en aperturas, clics, conversión, respuestas, rebotes y spam${scorecard.inProgress ? '. Esta campaña aún está enviando, la nota se actualiza en vivo.' : '.'}" style="display:inline-block;background:${scorecard.gradeBg};color:${scorecard.gradeColor};padding:3px 11px;border-radius:11px;font-weight:900;font-size:11px;margin-left:6px;letter-spacing:0.2px;white-space:nowrap"><span style="font-size:13px">${scorecard.score10.toFixed(1)}</span><span style="opacity:0.7;font-weight:700">/10</span> · ${scorecard.grade}${liveSuffix}</span>`
        : "";
      const scorecardDiag = scorecard
        ? `<div style="font-size:10.5px;color:${scorecard.gradeColor};margin-top:3px;line-height:1.4;font-style:italic">${esc(scorecard.diagnostic)}</div>`
        : "";
      return `
      <tr>
        <td style="text-align:center;vertical-align:middle;font-weight:900;color:#FF6B00;letter-spacing:0.5px;font-size:13px">#${numLabel}</td>
        <td style="vertical-align:middle">
          <strong>${esc(c.name)}</strong>${scorecardBadge}
          <div style="font-size:10.5px;color:#64748b;margin-top:3px;line-height:1.4">
            <span title="Fecha y hora de lanzamiento">▶ ${inicioStr}</span>
            &nbsp;·&nbsp;
            <span title="Fecha y hora de finalizacion">■ ${finStr}</span>
          </div>
          ${scorecardDiag}
        </td>
        <td style="text-align:center;vertical-align:middle">${statusBadge(c.status, c.queuePosition)}</td>
        <td style="text-align:center;vertical-align:middle;font-size:22px;font-weight:900;color:#111;letter-spacing:-0.5px">${total.toLocaleString("es-ES")}</td>
        <td style="vertical-align:middle">${cellMetric(sent, "sent", sent, total, c.status)}</td>
        <td style="vertical-align:middle">${cellMetric(opens, "open", opens, sent)}</td>
        <td style="vertical-align:middle">${cellMetric(clicks, "click", clicks, sent)}</td>
        <td style="vertical-align:middle">${cellMetric(clicks, "ctor", clicks, opens)}</td>
        <td style="vertical-align:middle">${cellMetric(replies, "reply", replies, sent)}</td>
        <td style="vertical-align:middle">${cellMetric(bounces, "bounce", bounces, sent)}</td>
        <td class="td-acciones" style="vertical-align:middle">
          <div class="campaign-actions" style="display:flex;flex-direction:column;align-items:stretch;gap:6px">
            ${canSend ? `<button class="mini-btn act-btn act-send" data-send-campaign="${esc(c.id)}" type="button">🚀 Enviar</button>` : ""}
            ${canPause ? `<button class="mini-btn act-btn act-pause" data-pause-campaign="${esc(c.id)}" type="button" style="background:#f59e0b;color:#fff">⏸ Pausar</button>` : ""}
            ${canResume ? `<button class="mini-btn act-btn act-resume" data-resume-campaign="${esc(c.id)}" type="button" style="background:#10b981;color:#fff">▶ Reanudar</button>` : ""}
            ${canReorder ? `<div style="display:flex;gap:4px">
              <button class="mini-btn act-btn" data-queue-up="${esc(c.id)}" type="button" title="Subir en la cola" style="flex:1;background:#6366f1;color:#fff;font-size:15px;padding:4px 0">▲</button>
              <button class="mini-btn act-btn" data-queue-down="${esc(c.id)}" type="button" title="Bajar en la cola" style="flex:1;background:#6366f1;color:#fff;font-size:15px;padding:4px 0">▼</button>
            </div>` : ""}
            ${canCancel ? `<button class="mini-btn act-btn act-cancel" data-cancel-campaign="${esc(c.id)}" data-campaign-name="${esc(c.name || "")}" type="button" style="background:#dc2626;color:#fff">⛔ Cancelar</button>` : ""}
            <a class="mini-btn act-btn act-report" href="/campaigns/${esc(c.id)}/report" target="_blank" style="text-align:center">📄 Informe</a>
            <button class="mini-btn act-btn act-delete" data-delete-campaign="${esc(c.id)}" data-campaign-name="${esc(c.name || "")}" type="button">🗑 Eliminar</button>
          </div>
        </td>
      </tr>
    `;
    })
    .join("");

  updateCampaignSortIndicators();

  qsa("[data-send-campaign]").forEach((button) => {
    button.addEventListener("click", () => sendCampaign(button.dataset.sendCampaign, button));
  });

  qsa("[data-send-report]").forEach((button) => {
    button.addEventListener("click", () =>
      openSendReportModal(button.dataset.sendReport, button.dataset.campaignName || "")
    );
  });

  qsa("[data-delete-campaign]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = button.dataset.deleteCampaign;
      const name = button.dataset.campaignName || id;
      if (!confirm(`¿Eliminar "${name}" del histórico?\nEsta acción no se puede deshacer.`)) return;
      button.disabled = true;
      try {
        await api(`/api/campaigns/${id}`, { method: "DELETE" });
        await refreshCampaigns();
      } catch (e) {
        rubenCotonAlert({ title: "Algo salio mal", body: humanizeError(e), icon: "❌", tone: "error" });
        button.disabled = false;
      }
    });
  });

  /* P0 FEAT 2026-05-09: reordenar cola con botones ▲▼ */
  const reorderQueueMove = async (campaignId, direction) => {
    /* Obtener campañas en cola ordenadas por queuePosition real del motor */
    const inQueue = (state.campaigns || [])
      .filter(c => ["sending", "queued", "paused"].includes(c.status))
      .sort((a, b) => {
        const pa = a.queuePosition == null ? 999 : a.queuePosition;
        const pb = b.queuePosition == null ? 999 : b.queuePosition;
        return pa - pb;
      });
    const idx = inQueue.findIndex(c => c.id === campaignId);
    if (idx < 0) return;
    /* La campaña activa (sending, pos 0) no se puede desplazar */
    const minMovable = inQueue.findIndex(c => c.status !== "sending");
    if (minMovable < 0) return;
    if (direction === "up") {
      if (idx <= minMovable) return; /* ya es la primera en cola */
      [inQueue[idx], inQueue[idx - 1]] = [inQueue[idx - 1], inQueue[idx]];
    } else {
      if (idx >= inQueue.length - 1) return; /* ya es la última */
      [inQueue[idx], inQueue[idx + 1]] = [inQueue[idx + 1], inQueue[idx]];
    }
    const newOrder = inQueue.map(c => c.id);
    try {
      await api("/api/engine/queue/reorder", { method: "POST", body: JSON.stringify({ order: newOrder }) });
      await refreshCampaigns();
    } catch (e) {
      rubenCotonAlert({ title: "Error al reordenar", body: humanizeError(e), icon: "❌", tone: "error" });
    }
  };
  qsa("[data-queue-up]").forEach(btn => btn.addEventListener("click", () => reorderQueueMove(btn.dataset.queueUp, "up")));
  qsa("[data-queue-down]").forEach(btn => btn.addEventListener("click", () => reorderQueueMove(btn.dataset.queueDown, "down")));

  /* P0 feature 2026-05-04: pause/resume/cancel handlers */
  qsa("[data-pause-campaign]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = button.dataset.pauseCampaign;
      button.disabled = true;
      try {
        await api(`/api/campaigns/${id}/pause`, { method: "POST" });
        await refreshCampaigns();
      } catch (e) {
        rubenCotonAlert({ title: "No se pudo pausar", body: humanizeError(e), icon: "❌", tone: "error" });
        button.disabled = false;
      }
    });
  });

  qsa("[data-resume-campaign]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = button.dataset.resumeCampaign;
      button.disabled = true;
      try {
        await api(`/api/campaigns/${id}/resume`, { method: "POST" });
        await refreshCampaigns();
      } catch (e) {
        rubenCotonAlert({ title: "No se pudo reanudar", body: humanizeError(e), icon: "❌", tone: "error" });
        button.disabled = false;
      }
    });
  });

  qsa("[data-cancel-campaign]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = button.dataset.cancelCampaign;
      const name = button.dataset.campaignName || id;
      if (!confirm(`¿Cancelar el envío de "${name}"?\nLos pendientes en cola se descartarán. Los ya enviados permanecen.`)) return;
      button.disabled = true;
      try {
        const r = await api(`/api/campaigns/${id}/cancel`, { method: "POST" });
        rubenCotonAlert({ title: "Campaña cancelada", body: `Se quitaron de la cola <strong>${r.removedFromQueue || 0}</strong> envíos pendientes.`, icon: "✅", tone: "success" });
        await refreshCampaigns();
      } catch (e) {
        rubenCotonAlert({ title: "No se pudo cancelar", body: humanizeError(e), icon: "❌", tone: "error" });
        button.disabled = false;
      }
    });
  });

  fillSelectOptions(
    analyticsCampaignSelect,
    campaigns,
    "Selecciona campaña",
    (item) => `${item.name} (${item.status})`
  );
};

const renderWorkflows = (workflows) => {
  workflowsTableBody.innerHTML = workflows
    .map(
      (workflow) => `
      <tr>
        <td>${workflow.name}</td>
        <td>${workflow.type}</td>
        <td>${workflow.delayHours}h</td>
      </tr>
    `
    )
    .join("");
};

const refreshPanel = async () => {
  const data = await api("/api/panel", { method: "GET", cache: "no-store" });
  const normalizedDb = String(data.db || "")
    .trim()
    .toLowerCase();
  const dbIsFallbackMode =
    normalizedDb === "not_configured" ||
    normalizedDb === "warn" ||
    normalizedDb === "fallback" ||
    normalizedDb === "file_store" ||
    normalizedDb === "local" ||
    normalizedDb === "local_fallback";

  const dbVisualStatus =
    normalizedDb === "ok"
      ? "ok"
      : dbIsFallbackMode || data.status === "ok"
        ? "warn"
        : "error";

  appStatusEl.textContent = data.status === "ok" ? "OPERATIVA" : "REVISION";
  dbStatusEl.textContent =
    normalizedDb === "ok"
      ? "CONECTADA"
      : dbIsFallbackMode
        ? "EN VPS"
        : data.status === "ok"
          ? "REVISAR"
          : "ERROR";

  setStatusStyle(appStatusEl, data.status);
  /* PETICION USUARIO 2026-05-05: 'EN VPS' es buena cosa (VPS = servidor
   * funcionando, datos seguros). Pintar en verde en vez de naranja. */
  setStatusStyle(dbStatusEl, dbIsFallbackMode ? "ok" : dbVisualStatus);

  kpiContactsEl.textContent = data.dashboard?.contacts?.total ?? "--";
  kpiCampaignsEl.textContent = data.dashboard?.campaigns?.total ?? "--";

  const mode = String(data.massMail?.mode || "smtp").toLowerCase();
  /* P0 audit 2026-05-01: mapeo de mode incluía "gmail-api" en el ELSE → mostraba
   * "SMTP" aunque estuviera en modo Gmail API (caso producción). Bug visual
   * confundía al admin. Ahora se mapean los 4 modos reales. */
  const modeLabel =
    mode === "direct" ? "PROPIO"
      : mode === "botavia" ? "BOTAVIA"
      : mode === "gmail-api" || mode === "gmail" ? "GMAIL API"
      : "SMTP";

  if (data.massMail?.enabled) {
    /* Ventana horaria 8-20h: si esta fuera, motor pausa automaticamente
     * para parecer humano y no bot 24/7 (peticion usuario 2026-05-05). */
    const win = data.massMail.sendingWindow;
    const winOpen = win?.isOpen !== false;
    const winLabel = win
      ? (winOpen
          ? `Ventana ${win.startHour}-${win.endHour}h Madrid`
          : `Fuera ventana ${win.startHour}-${win.endHour}h`)
      : "";
    const stateLabel = data.massMail.paused
      ? "PAUSADO"
      : (winOpen ? "ACTIVO" : "EN HORARIO PAUSA");
    /* Armonia visual 2026-05-05: estado grande + tag canal pequena
     * (antes "ACTIVO (GMAIL API)" rompia en 2 lineas). */
    engineStatusEl.innerHTML = `
      <div style="font-weight:900;line-height:1.1">${stateLabel}</div>
      <div style="font-size:10px;color:#888;font-weight:700;margin-top:6px;letter-spacing:0.5px">${modeLabel}</div>
    `;
    /* PETICION USUARIO 2026-05-06: ritmo dinamico segun franja actual.
     * Soporta schedule multi-franja (8-13h:6, 13-14h:2, 14-18h:2, 18-20h:1).
     * El KPI muestra: rate actual + franja actual. Subtitulo: schedule completo. */
    const mm = data.massMail;
    const currentRate = mm.currentRatePerMinute || mm.ratePerMinute;
    const currentSlot = mm.currentSlot;
    const schedule = Array.isArray(mm.rateSchedule) ? mm.rateSchedule : null;
    let rateLabel = `${currentRate}/min`;
    let rateSubLabel = "";
    if (winOpen && currentSlot) {
      /* PETICION USUARIO 2026-05-06: etiquetas en castellano. */
      const isMaxRate = schedule ? currentRate === Math.max(...schedule.map(s => s.ratePerMinute)) : false;
      const tag = isMaxRate ? "PUNTA" : (currentRate >= 2 ? "MEDIO" : "GOTEO");
      rateLabel = `${currentRate}/min · ${tag}`;
      rateSubLabel = `Franja ${currentSlot.startHour}-${currentSlot.endHour}h`;
    } else if (winOpen && !currentSlot) {
      rateLabel = `${currentRate}/min`;
    } else {
      rateLabel = "PAUSADO (fuera de horario)";
    }
    /* Tooltip con schedule completo */
    const scheduleTooltip = schedule
      ? schedule.map(s => `${s.startHour}-${s.endHour}h: ${s.ratePerMinute}/min`).join(" · ")
      : (mm.peakStartHour ? `Peak ${mm.peakStartHour}-${mm.peakEndHour}h: ${mm.ratePeakPerMinute}/min · Off ${mm.rateOffPeakPerMinute}/min` : "");
    /* PETICION USUARIO 2026-05-06: mostrar tambien envios hoy / cap. */
    const dc = mm.dailyCap || {};
    const used = dc.used || 0;
    const cap = dc.limit || 1950;
    const usedPct = cap > 0 ? Math.round((used / cap) * 100) : 0;
    engineQueueEl.innerHTML = `
      <div style="font-weight:900" title="${esc(scheduleTooltip)}">${rateLabel}</div>
      ${rateSubLabel ? `<div style="font-size:9.5px;color:#94a3b8;font-weight:600;margin-top:2px" title="${esc(scheduleTooltip)}">${rateSubLabel}</div>` : ""}
      <div style="margin-top:4px;font-size:11px" title="El cap es rolling: cuenta los envios de las ULTIMAS 24h, no del dia calendario. Asi lo mide Gmail.">
        <b style="color:#FF6B00">${used}</b>/${cap} <span style="color:#94a3b8">últimas 24h</span> (${usedPct}%) · Cola ${mm.queueSize}
      </div>
      <div style="font-size:9.5px;color:#94a3b8;font-weight:600;margin-top:1px">${winOpen ? "●" : "○"} ${win ? `${win.startHour}-${win.endHour}h` : "—"}</div>
    `;
    setStatusStyle(engineStatusEl, mm.paused ? "error" : (winOpen ? "ok" : "warn"));
    setStatusStyle(engineQueueEl,
      currentRate < 1 ? "error" :
      (winOpen ? "ok" : "warn"));
  } else {
    engineStatusEl.textContent = "NO CONFIGURADO";
    engineQueueEl.textContent = "Configura canal de envío";
    setStatusStyle(engineStatusEl, "error");
  }

  if (dashboardJsonEl) dashboardJsonEl.textContent = pretty(data.dashboard || {});

  /* Dashboard visual */
  const dash = data.dashboard || {};
  const camps = dash.campaigns || {};
  /* P0 fix 2026-05-04 (bug usuario captura inicio): eliminados los KPIs
   * agregados (sent total, tasa apertura, tasa clics, rebotes totales)
   * porque el usuario los encontraba confusos. Ahora solo mostramos la
   * tabla de campañas activas con sus stats individuales. */

  /* PETICION USUARIO 2026-05-05: el dashboard de Inicio debe mostrar:
   *   1) Resumen agregado de campañas EN PROCESO (no eliminadas) con datos
   *      medios y etiqueta global de evaluación (EXCELENTE / BUENO / ...).
   *   2) Tabla individual con porcentajes y etiqueta por métrica.
   *
   * "EN PROCESO" = campañas que aparecen en `recentCampaigns` (el endpoint
   * `getOverview()` ya filtra archived/eliminadas).
   *
   * Benchmarks alineados con `renderCampaigns.evalMetric` para coherencia
   * entre Inicio y la pestaña Estado campañas. */
  const recentCamps = dash.recentCampaigns || [];
  if (dashActivity && recentCamps.length) {
    const statusLabel = (s) => ({
      draft: "Borrador", queued: "En cola", sending: "Enviando",
      sent: "Enviada", paused: "Pausada", failed: "Error",
      scheduled: "Programada", completed: "Completada"
    })[s] || s;
    const statusColor = (s) => ({
      sent: "#10b981", sending: "#FF6B00", queued: "#FF6B00",
      draft: "#94a3b8", failed: "#ef4444", paused: "#f59e0b",
      scheduled: "#3b82f6"
    })[s] || "#94a3b8";

    /* Evalúa una métrica → { label, cls } con cls ∈ {ok, warn, bad}.
     * Mismos benchmarks que renderCampaigns. */
    const evalRate = (kind, pct, statusOverride) => {
      if (kind === "sent") {
        /* P1 FIX 2026-05-08: caso 100% → COMPLETADO. */
        /* P1 BLINDAJE 2026-05-08: si status=completed/sent en BBDD, forzar
           COMPLETADO independientemente de redondeos del porcentaje. */
        if (statusOverride === "completed" || statusOverride === "sent") return { label: "COMPLETADO", cls: "ok" };
        if (pct >= 100) return { label: "COMPLETADO", cls: "ok" };
        if (pct >= 75) return { label: "CASI HECHO", cls: "ok" };
        if (pct >= 50) return { label: "AVANZANDO", cls: "ok" };
        if (pct >= 25) return { label: "EN MARCHA", cls: "warn" };
        return { label: "INICIANDO", cls: "warn" };
      }
      if (kind === "open") {
        if (pct >= 20) return { label: "EXCELENTE", cls: "ok" };
        if (pct >= 15) return { label: "BUENO", cls: "ok" };
        if (pct >= 10) return { label: "NORMAL", cls: "warn" };
        return { label: "POR MEJORAR", cls: "bad" };
      }
      if (kind === "click") {
        if (pct >= 5) return { label: "EXCELENTE", cls: "ok" };
        if (pct >= 3) return { label: "BUENO", cls: "ok" };
        if (pct >= 2) return { label: "NORMAL", cls: "warn" };
        return { label: "POR MEJORAR", cls: "bad" };
      }
      if (kind === "ctor") {
        /* CTOR (clic÷apertura): mide si quienes abren interactuan. */
        if (pct >= 25) return { label: "EXCELENTE", cls: "ok" };
        if (pct >= 15) return { label: "BUENO", cls: "ok" };
        if (pct >= 10) return { label: "NORMAL", cls: "warn" };
        return { label: "POR MEJORAR", cls: "bad" };
      }
      if (kind === "reply") {
        if (pct >= 2) return { label: "EXCELENTE", cls: "ok" };
        if (pct >= 1) return { label: "BUENO", cls: "ok" };
        if (pct >= 0.5) return { label: "NORMAL", cls: "warn" };
        return { label: "POR MEJORAR", cls: "bad" };
      }
      if (kind === "bounce") {
        if (pct < 2) return { label: "EXCELENTE", cls: "ok" };
        if (pct < 5) return { label: "BUENO", cls: "ok" };
        if (pct < 8) return { label: "NORMAL", cls: "warn" };
        return { label: "POR MEJORAR", cls: "bad" };
      }
      return { label: "—", cls: "warn" };
    };
    const badgeStyle = (cls) => ({
      ok:   "background:#d1fae5;color:#065f46",
      warn: "background:#fef3c7;color:#92400e",
      bad:  "background:#fee2e2;color:#991b1b"
    })[cls] || "background:#e2e8f0;color:#475569";
    const pctOf = (num, base) => (base > 0 ? (num / base) * 100 : 0);
    const fmt = (n) => Number(n).toLocaleString("es-ES");
    const fmtPct = (p) => `${p.toFixed(1)}%`;

    /* ---- 1) RESUMEN AGREGADO ---- */
    const totals = recentCamps.reduce((acc, c) => {
      const s = c.stats || {};
      acc.total   += s.total   || 0;
      acc.sent    += s.sent    || 0;
      acc.opened  += s.openedUnique  || s.opened  || 0;
      acc.clicked += s.clickedUnique || s.clicked || 0;
      acc.replied += s.replied || 0;
      acc.bounced += s.bounced || 0;
      return acc;
    }, { total: 0, sent: 0, opened: 0, clicked: 0, replied: 0, bounced: 0 });

    const summarySent    = pctOf(totals.sent,    totals.total);
    const summaryOpen    = pctOf(totals.opened,  totals.sent);
    const summaryClick   = pctOf(totals.clicked, totals.sent);
    /* P0 FIX 2026-05-05 (peticion usuario "anadir CTOR"): CTOR = clicks/opens
     * (no clicks/sent). Mide cuantos abridores ademas hicieron clic. */
    const summaryCtor    = pctOf(totals.clicked, totals.opened);
    const summaryReply   = pctOf(totals.replied, totals.sent);
    const summaryBounce  = pctOf(totals.bounced, totals.sent);

    const summaryCells = [
      { key: "sent",   title: "ENVIADOS",   num: totals.sent,    base: totals.total,  pct: summarySent,   eval: evalRate("sent",   summarySent)   },
      { key: "open",   title: "APERTURAS",  num: totals.opened,  base: totals.sent,   pct: summaryOpen,   eval: evalRate("open",   summaryOpen)   },
      { key: "click",  title: "CLICS",      num: totals.clicked, base: totals.sent,   pct: summaryClick,  eval: evalRate("click",  summaryClick)  },
      { key: "ctor",   title: "CTOR",       num: totals.clicked, base: totals.opened, pct: summaryCtor,   eval: evalRate("ctor",   summaryCtor)   },
      { key: "reply",  title: "RESPUESTAS", num: totals.replied, base: totals.sent,   pct: summaryReply,  eval: evalRate("reply",  summaryReply)  },
      { key: "bounce", title: "REBOTES",    num: totals.bounced, base: totals.sent,   pct: summaryBounce, eval: evalRate("bounce", summaryBounce) },
    ];

    const summaryBlock = `
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:18px 20px;margin-bottom:18px">
        <div style="display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:14px">
          <div style="font-size:13px;font-weight:800;letter-spacing:0.5px;color:#0f172a;text-transform:uppercase">
            Resumen de campañas en proceso
          </div>
          <div style="font-size:12px;color:#64748b">
            ${recentCamps.length} campaña${recentCamps.length === 1 ? "" : "s"} ·
            ${fmt(totals.total)} destinatarios totales
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(6, minmax(0, 1fr));gap:10px">
          ${summaryCells.map(c => `
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 10px;text-align:center">
              <div style="font-size:10.5px;font-weight:800;color:#64748b;letter-spacing:0.6px">${c.title}</div>
              <div style="font-size:22px;font-weight:900;color:#111;margin-top:4px;line-height:1.1">${fmt(c.num)}</div>
              <div style="font-size:12px;color:#475569;font-weight:700;margin-top:2px">${fmtPct(c.pct)}</div>
              <div style="display:inline-block;font-size:9px;font-weight:800;letter-spacing:0.4px;padding:3px 9px;border-radius:10px;margin-top:6px;${badgeStyle(c.eval.cls)}">${c.eval.label}</div>
            </div>
          `).join("")}
        </div>
      </div>
    `;

    /* P0 FEAT 2026-05-08 (peticion usuario "puntuacion + comentario IA en
       el resumen del dashboard"): bloque global con nota 0-10 ponderada
       sobre apertura/clic/CTOR/respuesta/rebote, y diagnostico operativo
       que destaca alertas (rebotes altos, apertura baja, etc.) y wins. */
    const computeGlobalScore = () => {
      if (totals.sent === 0) return null;
      const sOpen   = Math.min(10, (summaryOpen   / 20) * 10);
      const sClick  = Math.min(10, (summaryClick  / 5)  * 10);
      const sCtor   = totals.opened > 0 ? Math.min(10, (summaryCtor / 25) * 10) : 0;
      const sReply  = Math.min(10, (summaryReply  / 2)  * 10);
      const sBounce = Math.max(0, 10 - ((Math.max(0, summaryBounce - 2) / 8) * 10));
      const score = sOpen * 0.25 + sClick * 0.25 + sCtor * 0.25 + sReply * 0.15 + sBounce * 0.10;
      return Math.round(score * 10) / 10;
    };
    const globalScore = computeGlobalScore();
    const gradeOf = (s) => {
      if (s == null) return { lbl: "EN FORMACIÓN", bg: "#e2e8f0", fg: "#475569" };
      if (s >= 8)    return { lbl: "EXCELENTE",    bg: "#bbf7d0", fg: "#166534" };
      if (s >= 6.5)  return { lbl: "BIEN",         bg: "#d1fae5", fg: "#065f46" };
      if (s >= 5)    return { lbl: "REGULAR",      bg: "#fef3c7", fg: "#854d0e" };
      if (s >= 3)    return { lbl: "FLOJO",        bg: "#fed7aa", fg: "#9a3412" };
      return { lbl: "CRÍTICO", bg: "#fee2e2", fg: "#991b1b" };
    };
    const grade = gradeOf(globalScore);
    const diagnose = () => {
      if (totals.sent === 0) {
        return "Aún no hay envíos completados. La puntuación se generará cuando llegue el primer lote de stats.";
      }
      const issues = [];
      const wins = [];
      if (summaryBounce >= 10)      issues.push(`🚨 Rebotes críticos (${fmtPct(summaryBounce)}) — limpia listas YA antes del próximo envío para no quemar reputación`);
      else if (summaryBounce >= 5)  issues.push(`⚠️ Rebotes elevados (${fmtPct(summaryBounce)})`);
      if (summaryOpen >= 20)        wins.push(`✅ Apertura excelente (${fmtPct(summaryOpen)})`);
      else if (summaryOpen >= 15)   wins.push(`✅ Apertura buena (${fmtPct(summaryOpen)})`);
      else if (summaryOpen < 10 && totals.sent > 100) issues.push(`📭 Apertura baja (${fmtPct(summaryOpen)}) — revisa asunto y pre-header`);
      if (summaryClick >= 5)        wins.push(`🎯 Clics excelentes (${fmtPct(summaryClick)})`);
      else if (summaryClick < 2 && totals.opened > 100) issues.push(`🖱️ CTR bajo (${fmtPct(summaryClick)}) — revisa CTAs y enlaces`);
      if (summaryReply >= 1)        wins.push(`💬 Respuestas saludables (${fmtPct(summaryReply)})`);
      const totalCamps = recentCamps.length;
      const completed = recentCamps.filter(c => c.status === "completed" || c.status === "sent").length;
      const sending   = recentCamps.filter(c => c.status === "sending").length;
      const queued    = recentCamps.filter(c => c.status === "queued").length;
      const ctxParts = [];
      if (sending > 0)   ctxParts.push(`${sending} enviando ahora`);
      if (queued > 0)    ctxParts.push(`${queued} en cola`);
      if (completed > 0) ctxParts.push(`${completed} completada${completed === 1 ? "" : "s"}`);
      const ctx = ctxParts.length ? ` · Estado: ${ctxParts.join(", ")}` : "";
      if (issues.length === 0 && wins.length === 0) return `Datos en evaluación, aún pocos envíos para concluir.${ctx}`;
      if (issues.length === 0) return `${wins.join(" · ")}. Sigue así.${ctx}`;
      const winsStr = wins.length ? ` · 👍 ${wins.join(" · ")}` : "";
      return `${issues.join(" · ")}${winsStr}.${ctx}`;
    };
    const scoreDisplay = globalScore != null
      ? `<span style="font-size:32px;font-weight:900;color:#111;line-height:1">${globalScore.toFixed(1)}</span><span style="font-size:18px;color:#64748b;font-weight:700">/10</span>`
      : `<span style="font-size:24px;font-weight:900;color:#94a3b8;line-height:1">— —</span>`;
    const globalScoreBlock = `
      <div style="background:#fff;border:2px solid #FF6B00;border-radius:12px;padding:16px 20px;margin-bottom:18px;box-shadow:0 2px 8px rgba(255,107,0,0.08)">
        <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:8px">
          <div style="font-size:11px;font-weight:900;color:#FF6B00;letter-spacing:0.6px;text-transform:uppercase">📊 Puntuación global de la operación</div>
          <div>${scoreDisplay}</div>
          <div style="background:${grade.bg};color:${grade.fg};padding:5px 14px;border-radius:13px;font-weight:900;font-size:11px;letter-spacing:0.4px">${grade.lbl}</div>
        </div>
        <div style="font-size:13px;color:#475569;line-height:1.55">${esc(diagnose())}</div>
      </div>
    `;

    /* ---- 2) TABLA INDIVIDUAL CON PORCENTAJES + ETIQUETAS ----
     * PETICION USUARIO 2026-05-05 (segunda iteración): alturas fijas en
     * cada bloque (16/26/20px) para alinear horizontalmente entre filas
     * (igual patrón que en la pestaña "Estado campañas"). Aunque la celda
     * "Campaña" tenga texto multilínea, los números, porcentajes y
     * etiquetas siempre están a la misma altura. */
    const cellMetric = (kind, num, base, statusOverride) => {
      const pct = pctOf(num, base);
      const e = evalRate(kind, pct, statusOverride);
      return `
        <td style="padding:10px 6px;vertical-align:middle">
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:flex-start;text-align:center;line-height:1.1;gap:4px">
            <div style="height:16px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:#111">${fmt(num)}</div>
            <div style="height:18px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#475569">${fmtPct(pct)}</div>
            <div style="height:20px;display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;letter-spacing:0.4px;padding:0 8px;border-radius:10px;${badgeStyle(e.cls)}">${e.label}</div>
          </div>
        </td>`;
    };

    /* PETICION USUARIO 2026-05-06: cabeceros STICKY al hacer scroll para
     * que siempre se vea que es cada columna. position:sticky top:0 con
     * z-index alto y fondo blanco solido para que no se mezcle con
     * filas debajo. */
    const tableBlock = `
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead style="position:sticky;top:0;z-index:50;background:#fff;box-shadow:0 2px 4px rgba(0,0,0,0.06)">
          <tr style="color:#64748b;border-bottom:2px solid #e2e8f0;background:#fff">
            <th style="padding:10px 6px;text-align:center;background:#fff;font-weight:800;letter-spacing:0.4px;text-transform:uppercase;font-size:11px">#</th>
            <th style="padding:10px 6px;text-align:left;background:#fff;font-weight:800;letter-spacing:0.4px;text-transform:uppercase;font-size:11px">Campaña</th>
            <th style="padding:10px 6px;text-align:center;background:#fff;font-weight:800;letter-spacing:0.4px;text-transform:uppercase;font-size:11px">Estado</th>
            <th style="padding:10px 6px;text-align:center;background:#fff;font-weight:800;letter-spacing:0.4px;text-transform:uppercase;font-size:11px">Enviados</th>
            <th style="padding:10px 6px;text-align:center;background:#fff;font-weight:800;letter-spacing:0.4px;text-transform:uppercase;font-size:11px">Aperturas</th>
            <th style="padding:10px 6px;text-align:center;background:#fff;font-weight:800;letter-spacing:0.4px;text-transform:uppercase;font-size:11px">Clics</th>
            <th style="padding:10px 6px;text-align:center;background:#fff;font-weight:800;letter-spacing:0.4px;text-transform:uppercase;font-size:11px">CTOR</th>
            <th style="padding:10px 6px;text-align:center;background:#fff;font-weight:800;letter-spacing:0.4px;text-transform:uppercase;font-size:11px">Respuestas</th>
            <th style="padding:10px 6px;text-align:center;background:#fff;font-weight:800;letter-spacing:0.4px;text-transform:uppercase;font-size:11px">Rebotes</th>
          </tr>
        </thead>
        <tbody>
          ${recentCamps.map(c => {
            const s = c.stats || {};
            const total   = s.total   || 0;
            const sent    = s.sent    || 0;
            const opened  = s.openedUnique  || s.opened  || 0;
            const clicked = s.clickedUnique || s.clicked || 0;
            const replied = s.replied || 0;
            const bounced = s.bounced || 0;
            const numLabelI = fmtCampaignNumber(c.number);
            const fmtFechaI = (iso) => {
              if (!iso) return "—";
              try {
                const d = new Date(iso);
                if (isNaN(d.getTime())) return "—";
                return d.toLocaleDateString("es-ES", { day:"2-digit", month:"2-digit" }) + " " + d.toLocaleTimeString("es-ES", { hour:"2-digit", minute:"2-digit", hour12:false });
              } catch (_e) { return "—"; }
            };
            const inicioI = fmtFechaI(c.sentAt);
            const finI = c.completedAt ? fmtFechaI(c.completedAt) : (["sending","queued","paused"].includes(c.status) ? "en curso" : "—");
            /* P1 FEAT 2026-05-08: scorecard también en dashboard de inicio */
            const scI = getCampaignScorecard(c);
            const liveSuffixI = scI?.inProgress ? ` <span style="opacity:0.65;font-weight:600;font-size:9.5px">· en curso</span>` : "";
            const scBadgeI = scI ? `<span title="Nota global de esta campaña (0-10)${scI.inProgress ? ' · Actualizándose en vivo mientras envía' : ''}" style="display:inline-block;background:${scI.gradeBg};color:${scI.gradeColor};padding:3px 11px;border-radius:11px;font-weight:900;font-size:11px;margin-left:6px;letter-spacing:0.2px;white-space:nowrap"><span style="font-size:13px">${scI.score10.toFixed(1)}</span><span style="opacity:0.7;font-weight:700">/10</span> · ${scI.grade}${liveSuffixI}</span>` : "";
            const scDiagI = scI ? `<div style="font-size:10.5px;color:${scI.gradeColor};margin-top:3px;line-height:1.4;font-style:italic">${esc(scI.diagnostic)}</div>` : "";
            return `
              <tr style="border-bottom:1px solid #f1f5f9">
                <td style="padding:10px 6px;vertical-align:middle;text-align:center;font-weight:900;color:#FF6B00;font-size:13px;letter-spacing:0.5px">#${numLabelI}</td>
                <td style="padding:10px 6px;vertical-align:middle">
                  <strong>${esc(c.name || "(sin nombre)")}</strong>${scBadgeI}
                  <div class="muted" style="font-size:10.5px;margin-top:3px;line-height:1.4">▶ ${inicioI} · ■ ${finI}</div>
                  ${scDiagI}
                </td>
                <td style="padding:10px 6px;text-align:center;vertical-align:middle">
                  ${(() => {
                    /* PETICION USUARIO 2026-05-06: distinguir 3 estados visualmente:
                     * COMPLETADA / ENVIANDO AHORA / EN COLA pos N. */
                    const qp = c.queuePosition;
                    if (c.status === "sending" || (c.status === "queued" && qp === 0)) {
                      return `<span style="background:#16a34a;color:#fff;padding:4px 11px;border-radius:13px;font-size:10.5px;font-weight:900;letter-spacing:0.4px;display:inline-block;box-shadow:0 0 0 2px rgba(22,163,74,0.18)">▶ ENVIANDO AHORA</span>`;
                    }
                    if (c.status === "queued" && typeof qp === "number" && qp >= 1) {
                      /* PETICION USUARIO 2026-05-06: Pos. 1 = siguiente. */
                      const posLabel = `Pos. ${qp}${qp === 1 ? " (siguiente)" : ""}`;
                      return `<span style="background:#fef3c7;color:#92400e;padding:4px 11px;border-radius:13px;font-size:10.5px;font-weight:900;letter-spacing:0.4px;display:inline-block;border:1px solid #fcd34d">⏳ EN COLA · ${posLabel}</span>`;
                    }
                    if (c.status === "paused") {
                      return `<span style="background:#e2e8f0;color:#475569;padding:4px 11px;border-radius:13px;font-size:10.5px;font-weight:900;display:inline-block">⏸ PAUSADA</span>`;
                    }
                    if (c.status === "sent") {
                      return `<span style="background:#bbf7d0;color:#166534;padding:4px 11px;border-radius:13px;font-size:10.5px;font-weight:900;display:inline-block">✓ COMPLETADA</span>`;
                    }
                    if (c.status === "failed") {
                      return `<span style="background:#fecaca;color:#991b1b;padding:4px 11px;border-radius:13px;font-size:10.5px;font-weight:900;display:inline-block">⚠ FALLO</span>`;
                    }
                    return `<span style="background:${statusColor(c.status)};color:#fff;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;text-transform:uppercase;display:inline-block">${statusLabel(c.status)}</span>`;
                  })()}
                </td>
                ${cellMetric("sent",   sent,    total, c.status)}
                ${cellMetric("open",   opened,  sent)}
                ${cellMetric("click",  clicked, sent)}
                ${cellMetric("ctor",   clicked, opened)}
                ${cellMetric("reply",  replied, sent)}
                ${cellMetric("bounce", bounced, sent)}
              </tr>`;
          }).join("")}
        </tbody>
      </table>
    `;

    dashActivity.innerHTML = summaryBlock + globalScoreBlock + tableBlock;
  } else if (dashActivity) {
    dashActivity.innerHTML = '<p class="muted">Sin campañas activas. Pulsa "Crear campaña" en el menú lateral para empezar.</p>';
  }
};

let contactsPage = 0;
const CONTACTS_PER_PAGE = 50;

const refreshContacts = async () => {
  const query = encodeURIComponent((contactSearch?.value || "").trim());
  const offset = contactsPage * CONTACTS_PER_PAGE;
  const data = await api(`/api/contacts?q=${query}&limit=${CONTACTS_PER_PAGE}&offset=${offset}`);
  state.contacts = data.contacts || [];
  state.contactsTotal = data.total || 0;
  state.contactsHasMore = data.hasMore || false;
  renderContacts(state.contacts);
};

const refreshTemplates = async () => {
  const data = await api("/api/templates");
  state.templates = data.templates || [];
  renderTemplates(state.templates);
  /* P1 REFACTOR 2026-05-08: actualizar contador en sub-tab "Mis plantillas" */
  const counter = qs("#tplActiveCount");
  if (counter) counter.textContent = state.templates.length ? `(${state.templates.length})` : "";
};

const refreshSegments = async () => {
  const data = await api("/api/segments");
  state.segments = data.segments || [];
  renderSegments(state.segments);
};

const refreshCampaigns = async () => {
  const data = await api("/api/campaigns");
  state.campaigns = data.campaigns || [];
  renderCampaigns(state.campaigns);
};

const refreshWorkflows = async () => {
  const [workflowsData, runsData] = await Promise.all([
    api("/api/workflows"),
    api("/api/workflows/runs")
  ]);

  state.workflows = workflowsData.workflows || [];
  renderWorkflows(state.workflows);
  workflowRunsJson.textContent = pretty(runsData.runs || []);
};

const refreshSetupChecklist = async () => {
  if (!setupChecklistJson) {
    return;
  }

  try {
    const data = await api("/api/setup/checklist");
    setupChecklistJson.textContent = checklistToText(data);
  } catch (error) {
    setupChecklistJson.textContent = `Error checklist: ${error.message}`;
  }
};

const parseDelimitedText = (text) => {
  /* P0 audit 2026-05-01: Excel CSV exporta con BOM ﻿. Sin strip,
   * el primer header ('email') queda como '﻿email' → mapping no
   * encuentra columna email → import silenciosamente sin contactos. */
  const cleanText = String(text || "").replace(/^﻿/, "");
  const lines = cleanText
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) {
    return [];
  }

  const delimiter = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(delimiter).map((col) => col.trim());

  return lines.slice(1).map((line) => {
    const values = line.split(delimiter);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = String(values[index] || "").trim();
    });
    return row;
  });
};

const readFileRows = async (file) => {
  const extension = String(file.name.split(".").pop() || "").toLowerCase();

  if (["csv", "txt"].includes(extension)) {
    const text = await file.text();
    return parseDelimitedText(text);
  }

  if (extension === "xlsx") {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return [];
    }
    const sheet = workbook.Sheets[firstSheetName];
    return XLSX.utils.sheet_to_json(sheet, { defval: "" });
  }

  throw new Error("Formato no soportado. Usa CSV, TXT o XLSX.");
};

const autoMappingFromRow = (sampleRow) => {
  const keys = Object.keys(sampleRow || {});
  const lowerMap = keys.reduce((acc, key) => {
    acc[key.toLowerCase()] = key;
    return acc;
  }, {});

  return {
    email: lowerMap.email || lowerMap.correo || lowerMap["e-mail"] || "",
    firstName: lowerMap.firstname || lowerMap.nombre || "",
    lastName: lowerMap.lastname || lowerMap.apellidos || "",
    company: lowerMap.company || lowerMap.empresa || "",
    tags: lowerMap.tags || lowerMap.etiquetas || ""
  };
};

if (logoutButton) {
  logoutButton.addEventListener("click", async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  });
}

refreshContactsBtn?.addEventListener("click", refreshContacts);
contactSearch?.addEventListener("input", () => {
  clearTimeout(window.__contactTimer);
  window.__contactTimer = setTimeout(refreshContacts, 250);
});

/* Alta manual de contactos DESACTIVADA — se sincronizan desde Google Sheets */

/* ── Import: visual flow with column preview ── */
const IMPORT_FIELDS = [
  { value: "", label: "— Ignorar —" },
  { value: "email", label: "Email" },
  { value: "firstName", label: "Nombre" },
  { value: "lastName", label: "Apellidos" },
  { value: "company", label: "Empresa" },
  { value: "tags", label: "Etiquetas" },
  { value: "status", label: "Estado" }
];

const showImportPreview = (file, rows) => {
  _importRows = rows;
  const sample = rows[0] || {};
  const cols = Object.keys(sample);
  const autoMap = autoMappingFromRow(sample);
  const reverseMap = {};
  Object.entries(autoMap).forEach(([field, col]) => { if (col) reverseMap[col] = field; });

  importFileBadge.textContent = `📎 ${file.name} — ${rows.length} fila(s)`;
  importCount.textContent = `${rows.length} contacto(s) detectados`;

  /* Header: column name + mapping selector */
  let headHtml = "<tr>";
  cols.forEach((col) => {
    const mapped = reverseMap[col] || "";
    const opts = IMPORT_FIELDS.map(
      (f) => `<option value="${f.value}"${f.value === mapped ? " selected" : ""}>${f.label}</option>`
    ).join("");
    headHtml += `<th>${col}<br><select data-col="${col}">${opts}</select></th>`;
  });
  headHtml += "</tr>";
  importMappingHead.innerHTML = headHtml;

  /* Body: first 5 rows preview */
  const preview = rows.slice(0, 5);
  importMappingBody.innerHTML = preview
    .map((row) => "<tr>" + cols.map((c) => `<td>${String(row[c] ?? "").substring(0, 40)}</td>`).join("") + "</tr>")
    .join("");

  importDropzone.style.display = "none";
  importPreview.style.display = "block";
  importResult.textContent = "-";
};

const resetImport = () => {
  _importRows = [];
  _importMapping = {};
  importFileInput.value = "";
  importDropzone.style.display = "";
  importPreview.style.display = "none";
  importResult.textContent = "-";
};

/* Dropzone events */
if (importDropzone) {
  importDropzone.addEventListener("click", () => importFileInput.click());
  importDropzone.addEventListener("dragover", (e) => { e.preventDefault(); importDropzone.classList.add("dragover"); });
  importDropzone.addEventListener("dragleave", () => importDropzone.classList.remove("dragover"));
  importDropzone.addEventListener("drop", async (e) => {
    e.preventDefault();
    importDropzone.classList.remove("dragover");
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    try {
      const rows = await readFileRows(file);
      if (!rows.length) throw new Error("Archivo vacío");
      importFileInput._droppedFile = file;
      showImportPreview(file, rows);
    } catch (err) { importResult.textContent = `Error: ${err.message}`; }
  });
}

importFileInput?.addEventListener("change", async () => {
  const file = importFileInput.files?.[0];
  if (!file) return;
  try {
    const rows = await readFileRows(file);
    if (!rows.length) throw new Error("Archivo vacío");
    showImportPreview(file, rows);
  } catch (err) { importResult.textContent = `Error: ${err.message}`; }
});

importCancelBtn?.addEventListener("click", resetImport);

importConfirmBtn?.addEventListener("click", async () => {
  if (!_importRows.length) return;
  importResult.textContent = "Importando...";

  /* Build mapping from selectors */
  const selectors = importMappingHead.querySelectorAll("select[data-col]");
  const mapping = {};
  selectors.forEach((sel) => {
    if (sel.value) mapping[sel.value] = sel.dataset.col;
  });

  const file = importFileInput._droppedFile || importFileInput.files?.[0];
  try {
    const data = await api("/api/contacts/import", {
      method: "POST",
      body: JSON.stringify({
        rows: _importRows,
        mapping,
        mode: importMode.value,
        fileName: file?.name || "import",
        fileType: file?.name?.split(".").pop() || "csv",
        source: "import_panel"
      })
    });
    importResult.textContent = `OK: creados ${data.report.created} | actualizados ${data.report.updated}`;
    importReport.textContent = pretty(data.report);
    resetImport();
    await refreshContacts();
    await refreshPanel();
  } catch (error) {
    importResult.textContent = `Error: ${error.message}`;
  }
});

/* ============================================================ */
/* EDITOR DE CAMPAÑA MULTIMODO                                   */
/* ============================================================ */
(() => {
  const modeTabs = qsa(".mode-tab");
  const modes = {
    "gmail":    qs("#modeGmail"),
    "ai-form":  qs("#modeAiForm"),
    "ai-chat":  qs("#modeAiChat"),
    "html":     qs("#modeHtml"),
    "preview":  qs("#modePreview"),
  };
  const frame = qs("#campPreviewFrame");
  const htmlEditor = qs("#campHtmlEditor");
  const gmailEditor = qs("#gmailEditor");

  /* Sincroniza gmailEditor → htmlEditor (fuente de verdad).
   * IDENTICO al HTML que genera Gmail cuando tu redactas un correo normal:
   * fondo blanco, sin div envoltorio, sin padding propio (Gmail renderiza
   * con su propio margen). Font-family mantenida para que no canta como
   * "email automatizado". El destinatario ve exactamente lo mismo que si
   * lo hubieras escrito desde tu propio Gmail. */
  const syncFromGmail = () => {
    if (gmailEditor && htmlEditor) {
      const body = gmailEditor.innerHTML;
      htmlEditor.value = [
        '<div dir="ltr">',
        body,
        '</div>'
      ].join("");
    }
  };

  const updatePreview = () => {
    if (!frame) return;
    const html = (htmlEditor?.value) || '<p style="color:#999;text-align:center;padding:40px;font-family:sans-serif;">Sin contenido todavía. Usa uno de los modos de creación.</p>';
    const doc = frame.contentDocument || frame.contentWindow?.document;
    if (doc) { doc.open(); doc.write(html); doc.close(); }
  };

  /* Qué modo fue el último que edita contenido (gmail / html). Sirve para
     saber de dónde viene el usuario al cambiar a preview y evitar clobbers. */
  let lastEditMode = "gmail";

  const showMode = (mode) => {
    const prev = Array.from(modeTabs).find((x) => x.classList.contains("is-active"))?.dataset.mode;
    modeTabs.forEach((x) => x.classList.toggle("is-active", x.dataset.mode === mode));
    Object.entries(modes).forEach(([k, el]) => el?.classList.toggle("is-active", k === mode));
    if (prev === "gmail" || prev === "html") lastEditMode = prev;
    if (mode === "preview") {
      /* SOLO sincronizamos desde Gmail si el modo previo era Gmail.
         Si venimos de "html" (HTML pegado), NO tocar htmlEditor.value. */
      if (lastEditMode === "gmail") syncFromGmail();
      updatePreview();
    }
    if (mode === "ai-chat") { aiChatRefreshPreview(); }
  };

  modeTabs.forEach((t) => t.addEventListener("click", () => showMode(t.dataset.mode)));

  /* Dispositivo preview */
  qsa(".camp-device-btn").forEach((b) => b.addEventListener("click", () => {
    qsa(".camp-device-btn").forEach((x) => x.classList.remove("is-active"));
    b.classList.add("is-active");
    if (frame) frame.style.maxWidth = b.dataset.width;
  }));

  /* Si editan el HTML pegado → también actualiza preview */
  htmlEditor?.addEventListener("input", () => {
    if (modes.preview?.classList.contains("is-active")) updatePreview();
  });

  /* ---- GMAIL WYSIWYG ---- */
  qsa(".gmail-toolbar [data-cmd]").forEach((el) => {
    el.addEventListener("click", (e) => {
      const cmd = el.dataset.cmd;
      if (el.tagName === "SELECT") return;
      if (el.tagName === "INPUT" && el.type === "color") return;
      e.preventDefault();
      gmailEditor?.focus();
      document.execCommand(cmd, false, null);
      syncFromGmail();
    });
    if (el.tagName === "SELECT") {
      el.addEventListener("change", () => {
        gmailEditor?.focus();
        document.execCommand(el.dataset.cmd, false, el.value);
        syncFromGmail();
      });
    }
    if (el.tagName === "INPUT" && el.type === "color") {
      el.addEventListener("input", () => {
        gmailEditor?.focus();
        document.execCommand(el.dataset.cmd, false, el.value);
        syncFromGmail();
      });
    }
  });

  qs("#gmLinkBtn")?.addEventListener("click", () => {
    const url = prompt("URL del enlace:");
    if (url) { gmailEditor?.focus(); document.execCommand("createLink", false, url); syncFromGmail(); }
  });
  qs("#gmImageBtn")?.addEventListener("click", () => {
    const url = prompt("URL de la imagen (https://…):");
    if (url) { gmailEditor?.focus(); document.execCommand("insertImage", false, url); syncFromGmail(); }
  });

  gmailEditor?.addEventListener("input", syncFromGmail);
  gmailEditor?.addEventListener("blur", syncFromGmail);

  /* ---- IA CHAT ---- */
  const chatFrame = qs("#aiChatFrame");
  const chatInput = qs("#aiChatInput");
  const chatSend = qs("#aiChatSendBtn");
  const chatHistory = qs("#aiChatHistory");
  const chatSelected = qs("#aiChatSelected");
  const chatSelectedText = qs("#aiChatSelectedText");
  let currentSelection = null;

  const aiChatRefreshPreview = () => {
    if (!chatFrame) return;
    const html = (htmlEditor?.value) ||
      '<!DOCTYPE html><html><body style="font-family:Arial;padding:40px;color:#888;text-align:center"><p>Aún no hay email generado.</p><p>Pide a la IA que lo cree desde el chat.</p></body></html>';
    const doc = chatFrame.contentDocument || chatFrame.contentWindow?.document;
    if (doc) {
      doc.open(); doc.write(html); doc.close();
      /* Capturar selección dentro del iframe */
      doc.addEventListener("mouseup", () => {
        const sel = doc.getSelection();
        const txt = sel && sel.toString().trim();
        if (txt && txt.length > 3) {
          currentSelection = txt;
          chatSelected.style.display = "block";
          chatSelectedText.textContent = txt.slice(0, 120) + (txt.length > 120 ? "…" : "");
        } else {
          currentSelection = null;
          chatSelected.style.display = "none";
        }
      });
    }
  };
  window.aiChatRefreshPreview = aiChatRefreshPreview;

  const appendChatMsg = (role, html) => {
    const div = document.createElement("div");
    div.className = "ai-chat-msg " + (role === "user" ? "ai-chat-user" : "ai-chat-bot");
    div.innerHTML = `<strong>${role === "user" ? "👤 Tú" : "🤖 IA"}</strong>${html}`;
    chatHistory.appendChild(div);
    chatHistory.scrollTop = chatHistory.scrollHeight;
  };

  chatSend?.addEventListener("click", async () => {
    const msg = chatInput.value.trim();
    if (!msg) return;
    /* P0 FIX 2026-05-07: esc() en mensajes del chat IA. Antes interpolaba
     * msg/r.note/r.reply directamente en innerHTML → XSS si contenían
     * payload tipo <img onerror=...> o si la IA generaba HTML inseguro. */
    appendChatMsg("user", `<p>${esc(msg)}</p>${currentSelection ? `<small style="opacity:.75">📌 Sobre: "${esc(currentSelection.slice(0,80))}…"</small>` : ""}`);
    chatInput.value = "";
    chatSend.disabled = true;
    appendChatMsg("bot", `<p>⏳ Pensando con cascada IA…</p>`);

    try {
      const currentHtml = htmlEditor?.value || "";
      const payload = {
        message: msg,
        currentHtml,
        selection: currentSelection || null
      };
      const r = await api("/api/ai/chat-edit", { method: "POST", body: JSON.stringify(payload) });
      /* Quitar el "Pensando..." */
      chatHistory.removeChild(chatHistory.lastChild);
      if (r.html) {
        htmlEditor.value = r.html;
        aiChatRefreshPreview();
        appendChatMsg("bot", `<p>✅ Listo. He actualizado el email (<em>${esc(r.providerName || r.provider || "IA")}</em>).</p>${r.note ? `<p>${esc(r.note)}</p>` : ""}`);
      } else if (r.reply) {
        appendChatMsg("bot", `<p>${esc(r.reply)}</p>`);
      } else {
        appendChatMsg("bot", `<p>Hmm, no he conseguido respuesta. Prueba a reformular.</p>`);
      }
      currentSelection = null;
      chatSelected.style.display = "none";
    } catch (e) {
      chatHistory.removeChild(chatHistory.lastChild);
      appendChatMsg("bot", `<p style="color:#fee">❌ Error: ${esc(e.message)}</p>`);
    } finally {
      chatSend.disabled = false;
    }
  });
  chatInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); chatSend?.click(); }
  });
})();

/* Sincronizar Gmail editor al enviar campaña (fallback si no se tocó) */
document.addEventListener("submit", (e) => {
  if (e.target?.id === "campaignForm") {
    const g = qs("#gmailEditor");
    const h = qs("#campHtmlEditor");
    if (g && h && qs("#modeGmail")?.classList.contains("is-active") && !h.value) {
      const body = g.innerHTML;
      h.value = `<!DOCTYPE html><html><body style="margin:0;padding:20px;font-family:Arial,sans-serif;background:#f4f4f4"><div style="max-width:600px;margin:0 auto;background:#fff;padding:30px;border-radius:8px">${body}</div></body></html>`;
    }
    /* Generar también versión texto plano a partir del HTML */
    const txtArea = qs('#campaignForm textarea[name="text"]');
    if (txtArea && !txtArea.value && h?.value) {
      txtArea.value = h.value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    }
  }
}, true);

/* ── Template editor: tabs + live preview ──
   P1 REFACTOR 2026-05-08 (peticion usuario): mismas opciones que Crear
   campania: Editor Gmail / Pegar HTML / Vista previa. Sin IA, sin Texto. */
(() => {
  const tabs = qsa(".tpl-tab");
  const views = {
    gmail:   qs("#tplGmailView"),
    code:    qs("#tplCodeView"),
    preview: qs("#tplPreviewView")
  };

  /* Sincroniza tplGmailEditor → tplHtmlEditor (fuente de verdad).
     Idéntico patrón al de campañas: wrap en <div dir="ltr">. */
  const tplGmailEditor = qs("#tplGmailEditor");
  const tplSyncFromGmail = () => {
    if (tplGmailEditor && tplHtmlEditor) {
      const body = tplGmailEditor.innerHTML;
      tplHtmlEditor.value = `<div dir="ltr">${body}</div>`;
    }
  };

  /* Recordamos qué modo fue el último que editó contenido.
     Si el último era gmail, sincronizamos al ir a preview (y al guardar).
     Si era code (HTML pegado), NO sobreescribimos htmlEditor.value. */
  let tplLastEditMode = "gmail";

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const prev = Array.from(tabs).find((x) => x.classList.contains("is-active"))?.dataset.tplView;
      tabs.forEach((t) => t.classList.remove("is-active"));
      Object.values(views).forEach((v) => v?.classList.remove("is-active"));
      tab.classList.add("is-active");
      const target = tab.dataset.tplView;
      views[target]?.classList.add("is-active");
      if (prev === "gmail" || prev === "code") tplLastEditMode = prev;
      if (target === "preview") {
        if (tplLastEditMode === "gmail") tplSyncFromGmail();
        updateTplPreview();
      }
    });
  });

  /* Toolbar Editor Gmail (botones .tpl-gm con data-cmd) */
  qsa(".gmail-toolbar .tpl-gm[data-cmd]").forEach((el) => {
    el.addEventListener("click", (e) => {
      const cmd = el.dataset.cmd;
      if (el.tagName === "SELECT") return;
      if (el.tagName === "INPUT" && el.type === "color") return;
      e.preventDefault();
      tplGmailEditor?.focus();
      try { document.execCommand(cmd, false, null); } catch (_) {}
    });
  });
  qsa(".gmail-toolbar select.tpl-gm[data-cmd]").forEach((sel) => {
    sel.addEventListener("change", () => {
      tplGmailEditor?.focus();
      try { document.execCommand(sel.dataset.cmd, false, sel.value); } catch (_) {}
    });
  });
  qsa(".gmail-toolbar input.tpl-gm[type='color'][data-cmd]").forEach((c) => {
    c.addEventListener("input", () => {
      tplGmailEditor?.focus();
      try { document.execCommand(c.dataset.cmd, false, c.value); } catch (_) {}
    });
  });
  qs("#tplGmLinkBtn")?.addEventListener("click", () => {
    const url = window.prompt("URL del enlace:", "https://");
    if (!url) return;
    tplGmailEditor?.focus();
    try { document.execCommand("createLink", false, url); } catch (_) {}
  });
  qs("#tplGmImageBtn")?.addEventListener("click", () => {
    const url = window.prompt("URL de la imagen:", "https://");
    if (!url) return;
    tplGmailEditor?.focus();
    try { document.execCommand("insertImage", false, url); } catch (_) {}
  });

  /* Sincronización: cuando el usuario escribe en gmailEditor, actualizar
     htmlEditor (fuente de verdad para guardar y para preview). */
  tplGmailEditor?.addEventListener("input", () => {
    if (tplLastEditMode !== "code") tplSyncFromGmail();
  });

  const updateTplPreview = () => {
    if (!tplPreviewFrame || !tplHtmlEditor) return;
    const html = tplHtmlEditor.value || "<p style='color:#999;text-align:center;padding:40px;font-family:sans-serif;'>Escribe HTML en la pestaña de código para ver la vista previa aquí.</p>";
    const doc = tplPreviewFrame.contentDocument || tplPreviewFrame.contentWindow?.document;
    if (doc) { doc.open(); doc.write(html); doc.close(); }
  };

  /* Device buttons (desktop / mobile) */
  qsa(".tpl-device-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      qsa(".tpl-device-btn").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      if (tplPreviewFrame) tplPreviewFrame.style.maxWidth = btn.dataset.width;
    });
  });

  /* Live update on typing */
  tplHtmlEditor?.addEventListener("input", () => {
    const previewTab = qs('.tpl-tab[data-tpl-view="preview"]');
    if (previewTab?.classList.contains("is-active")) updateTplPreview();
  });

  /* AI Builder: check Ollama availability + load iframe */
  const AI_BUILDER_URL = "http://localhost:8090";
  const AI_STATUS_ID = "aiBuilderStatus";
  let aiAvailable = false;

  const checkAiAvailability = async () => {
    const statusEl = document.getElementById(AI_STATUS_ID);
    try {
      const r = await fetch(AI_BUILDER_URL, { mode: "no-cors", signal: AbortSignal.timeout(3000) });
      aiAvailable = true;
      if (statusEl) statusEl.innerHTML = '<span style="color:#10b981;font-weight:700">● IA local disponible</span> — Ollama detectado en localhost:8090';
      if (aiBuilderLoadBtn) {
        aiBuilderLoadBtn.textContent = "Cargar Email Builder";
        aiBuilderLoadBtn.disabled = false;
        aiBuilderLoadBtn.style.opacity = "1";
      }
    } catch (_) {
      aiAvailable = false;
      if (statusEl) statusEl.innerHTML = '<span style="color:#ef4444;font-weight:700">● IA local no disponible</span> — Arranca Ollama con Qwen 2.5 14B y el servidor en puerto 8090 para generar emails con IA. <button type="button" onclick="document.getElementById(\'aiRetryBtn\').click()" style="margin-left:8px;padding:4px 10px;border:1px solid #d1d5db;border-radius:6px;background:#fff;font-size:12px;cursor:pointer">Reintentar</button>';
      if (aiBuilderLoadBtn) {
        aiBuilderLoadBtn.textContent = "IA no disponible";
        aiBuilderLoadBtn.disabled = true;
        aiBuilderLoadBtn.style.opacity = "0.5";
      }
    }
  };

  /* Check on tab click */
  const aiTab = qs('.tpl-tab[data-tpl-view="ai"]');
  aiTab?.addEventListener("click", () => checkAiAvailability());

  /* Retry button */
  const retryBtn = document.createElement("button");
  retryBtn.id = "aiRetryBtn";
  retryBtn.style.display = "none";
  retryBtn.addEventListener("click", () => checkAiAvailability());
  document.body.appendChild(retryBtn);

  aiBuilderLoadBtn?.addEventListener("click", () => {
    if (!aiAvailable) { checkAiAvailability(); return; }
    if (aiBuilderFrame) {
      aiBuilderFrame.src = AI_BUILDER_URL;
      aiBuilderLoadBtn.textContent = "Cargando…";
      aiBuilderFrame.onload = () => { aiBuilderLoadBtn.textContent = "Recargar Email Builder"; };
      aiBuilderFrame.onerror = () => {
        aiBuilderLoadBtn.textContent = "Error al cargar";
        checkAiAvailability();
      };
    }
  });

  /* AI Builder: receive HTML via postMessage */
  window.addEventListener("message", (e) => {
    if (e.data?.type === "email-html" && e.data.html) {
      /* Rellenar editor con el HTML recibido */
      if (tplHtmlEditor) tplHtmlEditor.value = e.data.html;
      /* Rellenar asunto si viene */
      const subjectInput = templateForm?.querySelector('input[name="subject"]');
      if (subjectInput && e.data.subject) subjectInput.value = e.data.subject;
      /* Auto-generar nombre de plantilla */
      const nameInput = templateForm?.querySelector('input[name="name"]');
      if (nameInput && !nameInput.value) {
        nameInput.value = "IA — " + (e.data.subject || "Email generado " + new Date().toLocaleDateString("es-ES"));
      }
      /* Cambiar a tab Código HTML y actualizar preview */
      tabs.forEach((t) => t.classList.remove("is-active"));
      Object.values(views).forEach((v) => v?.classList.remove("is-active"));
      const codeTab = qs('.tpl-tab[data-tpl-view="code"]');
      codeTab?.classList.add("is-active");
      views.code?.classList.add("is-active");
      templateResult.textContent = "HTML recibido del Email Builder. Revisa y guarda la plantilla.";
    }
  });
})();

templateForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const editingId = qs("#templateEditingId")?.value || "";

  /* P1 REFACTOR 2026-05-08: si el modo activo es "Editor Gmail", sincronizar
     gmailEditor → htmlEditor antes de enviar. Si es "Pegar HTML" o "Vista
     previa", el htmlEditor ya tiene el contenido pegado por el usuario. */
  const activeTab = qs(".tpl-tab.is-active")?.dataset.tplView;
  const tplGmailEditorEl = qs("#tplGmailEditor");
  if (activeTab === "gmail" && tplGmailEditorEl && tplHtmlEditor) {
    const body = tplGmailEditorEl.innerHTML.trim();
    /* Solo sobreescribir si hay contenido real (no el placeholder por defecto). */
    if (body && !/^<p>Escribe aquí tu email/i.test(body)) {
      tplHtmlEditor.value = `<div dir="ltr">${body}</div>`;
    }
  }
  /* P1: auto-generar texto plano del HTML si está vacío. */
  const txtArea = templateForm.querySelector('textarea[name="text"]');
  if (txtArea && !txtArea.value && tplHtmlEditor?.value) {
    txtArea.value = tplHtmlEditor.value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  const formData = new FormData(templateForm);
  const payload = {
    name: String(formData.get("name") || "").trim(),
    subject: String(formData.get("subject") || "").trim(),
    previewText: String(formData.get("previewText") || "").trim(),
    html: String(formData.get("html") || "").trim(),
    text: String(formData.get("text") || "").trim()
  };

  /* P1 FIX UX#3 (audit 2026-05-08): validación frontend ANTES de enviar.
     Antes el backend rechazaba con error genérico; ahora el usuario ve
     qué campo falta sin esperar al roundtrip. */
  if (!payload.name) {
    templateResult.textContent = "❌ Falta el nombre de la plantilla";
    templateResult.style.color = "#dc2626";
    qs('#templateForm input[name="name"]')?.focus();
    return;
  }
  if (!payload.subject) {
    templateResult.textContent = "❌ Falta el asunto";
    templateResult.style.color = "#dc2626";
    qs('#templateForm input[name="subject"]')?.focus();
    return;
  }
  if (!payload.html && !payload.text) {
    templateResult.textContent = "❌ Falta contenido (HTML o texto plano)";
    templateResult.style.color = "#dc2626";
    return;
  }
  templateResult.style.color = "";
  templateResult.textContent = editingId ? "Actualizando plantilla…" : "Guardando plantilla…";

  try {
    let savedName = payload.name;
    if (editingId) {
      const r = await api(`/api/templates/${editingId}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      savedName = r.template?.name || savedName;
      templateResult.textContent = "✅ Plantilla actualizada.";
    } else {
      const r = await api("/api/templates", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      savedName = r.template?.name || savedName;
      templateResult.textContent = "✅ Plantilla guardada.";
    }

    /* Reset + salir de modo edición */
    qs("#templateEditCancel")?.click();
    await refreshTemplates();

    /* P1 FEAT 2026-05-08 (peticion usuario): modal de confirmación tras
       guardar y redirección automática a "Mis plantillas" para que el
       usuario vea inmediatamente que la plantilla está integrada. */
    await rubenCotonAlert({
      title: editingId ? "Plantilla actualizada" : "Plantilla guardada",
      body: `<strong>"${esc(savedName)}"</strong> ya está disponible en tus plantillas.<br><br>` +
            `Aparecerá en el desplegable cuando crees una campaña.`,
      icon: "✅",
      tone: "success",
      okText: "Ver mis plantillas"
    });
    __activateTplSubTab("active");
  } catch (error) {
    templateResult.textContent = `❌ Error: ${error.message}`;
    templateResult.style.color = "#dc2626";
  }
});

segmentForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  segmentResult.textContent = "Creando segmento…";
  const formData = new FormData(segmentForm);

  try {
    await api("/api/segments", {
      method: "POST",
      body: JSON.stringify({
        name: String(formData.get("name") || "").trim(),
        match: "all",
        rules: [
          {
            field: String(formData.get("field") || "status"),
            op: String(formData.get("op") || "equals"),
            value: String(formData.get("value") || "").trim()
          }
        ]
      })
    });

    segmentResult.textContent = "OK: segmento creado";
    segmentForm.reset();
    await refreshSegments();
  } catch (error) {
    segmentResult.textContent = `Error: ${error.message}`;
  }
});

/* Asegura que existe un segmento para un tag dado (crea si no existe). */
const ensureSegmentForTag = async (tagSlug, displayName) => {
  const segments = state.segments || [];
  const match = segments.find((s) =>
    (s.rules || []).some((r) => r.field === "tags" && r.op === "contains" && r.value === tagSlug)
  );
  if (match) return match.id;
  const r = await api("/api/segments", {
    method: "POST",
    body: JSON.stringify({
      name: `Auto: ${displayName}`,
      rules: [{ field: "tags", op: "contains", value: tagSlug }]
    })
  });
  await refreshSegments();
  return r.segment?.id || r.id;
};

/* P1 FEAT 2026-05-08: poblar el selector de plantilla del formulario campaña.
 * Cuando el usuario elige una, autorrellena asunto/preview/HTML/text. */
const populateCampaignTemplateSelect = async () => {
  const sel = qs("#campaignTemplateSelect");
  if (!sel) return;
  try {
    const r = await api("/api/templates");
    /* P1 REFACTOR 2026-05-08: sin estados, todas las plantillas son operativas. */
    const tpls = r.templates || [];
    const current = sel.value;
    sel.innerHTML = '<option value="">— Empezar desde cero —</option>';
    tpls.forEach(t => {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = `⭐ ${t.name}`;
      sel.appendChild(opt);
    });
    if (current) sel.value = current;
  } catch (e) {
    /* P1 FIX UX#9 (audit 2026-05-08): antes el catch era silent y el
       usuario no se enteraba si las plantillas no cargaban. Ahora dejamos
       una opción que indica el error para que sepa por qué no hay plantillas. */
    sel.innerHTML = `<option value="">— Error cargando plantillas: ${esc(e.message || "?")} —</option>`;
    console.warn("[populateCampaignTemplateSelect]", e.message);
  }
};
/* Helper: limpia los adjuntos heredados visuales del listado de campaña.
   P1 FIX UX#1+2 (audit 2026-05-08): cada `<li>` heredado se marca con
   data-inherited="1" para poder limpiar SOLO esos sin afectar pendientes. */
const __clearInheritedAttachUI = () => {
  const list = qs("#campAttachList");
  if (!list) return;
  list.querySelectorAll('[data-inherited="1"]').forEach((el) => el.remove());
  /* Si quedó vacío y no hay pendientes, restaurar mensaje neutral. */
  const totalEl = qs("#attachTotalSize");
  if (!list.children.length && !(window.__pendingAttachments || []).length) {
    if (totalEl) totalEl.textContent = "0 MB / 10 MB";
  }
};

qs("#campaignTemplateSelect")?.addEventListener("change", async (ev) => {
  const sel = ev.target;
  const tplId = sel.value;
  /* P1 FIX BUG #4 (audit 2026-05-08): si el usuario deselecciona la plantilla,
     resetear el flag de herencia + limpiar lista visual de heredados. */
  if (!tplId) {
    window.__inheritFromTemplate = null;
    __clearInheritedAttachUI();
    return;
  }
  /* P1 FIX UX#1: al cambiar de plantilla, limpiar heredados anteriores
     antes de añadir los nuevos. Sin esto, se acumulaban A+B+C visualmente. */
  __clearInheritedAttachUI();
  /* P0 FIX 2026-05-08 (peticion usuario "no carga nada, parece bug"):
     loadingHint flotante + disable select mientras carga la plantilla.
     Antes el usuario seleccionaba y no veía NADA hasta el toast final
     (~varios segundos en cold start) → percepción de bug. */
  const __lh = loadingHint("Cargando plantilla…");
  sel.disabled = true;
  sel.style.opacity = "0.6";
  try {
    const r = await api(`/api/templates/${tplId}`);
    const tpl = r.template;
    if (!tpl) return;

    /* P1 FEAT 2026-05-08 (revisado): IMPORTAR plantilla = sobrescribir todos
       los campos del email + cargar editor Gmail + saltar a Vista previa
       para que el usuario vea visualmente el resultado.
       Si quiere "empezar desde cero", debe elegir esa opción del select. */
    const subj      = qs('#campaignForm input[name="subject"]');
    const prev      = qs('#campaignForm input[name="previewText"]');
    const htmlInput = qs("#campHtmlEditor");          /* textarea pegar HTML */
    const textInput = qs('#campaignForm textarea[name="text"]');
    const gmailEd   = qs("#gmailEditor");             /* contenteditable WYSIWYG */

    if (subj)      subj.value      = tpl.subject     || "";
    if (prev)      prev.value      = tpl.previewText || "";
    if (htmlInput) htmlInput.value = tpl.html        || "";
    if (textInput) textInput.value = tpl.text        || "";
    /* Editor Gmail: si la plantilla trae HTML, intenta extraer body,
       si no, mete el HTML completo (el navegador limpia <html>/<head>).
       P1 FIX UX#6 (audit 2026-05-08): siempre limpiar gmailEditor PRIMERO,
       aunque la plantilla nueva no traiga HTML, para no mezclar contenido
       de plantillas anteriores. */
    if (gmailEd) {
      gmailEd.innerHTML = "";
      if (tpl.html) {
        const bodyMatch = tpl.html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        gmailEd.innerHTML = bodyMatch ? bodyMatch[1] : tpl.html;
      }
    }

    /* Saltar automáticamente al modo "Vista previa" para que el usuario
       vea CÓMO QUEDA visualmente el email importado.
       Truco: pasar primero por "html" para que la lógica interna de showMode
       fije lastEditMode="html" y NO sobrescriba htmlEditor.value desde Gmail
       (el HTML de la plantilla puede traer DOCTYPE/head/styles que se perderían). */
    qs('.mode-tab[data-mode="html"]')?.click();
    qs('.mode-tab[data-mode="preview"]')?.click();

    /* P1 FEAT 2026-05-08: marcar plantilla seleccionada para clonar
       sus adjuntos cuando se cree la campaña. Y mostrar info al usuario
       de los adjuntos que se heredarán. */
    window.__inheritFromTemplate = tplId;
    try {
      const att = await api(`/api/templates/${tplId}/attachments`);
      const files = att.files || [];
      const list = qs("#campAttachList");
      if (list && files.length) {
        const totalMB = (att.totalSize / 1024 / 1024).toFixed(2);
        const inheritHTML = files.map((f) => `
          <li data-inherited="1" style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #fde68a;background:#fffbeb">
            <span>⭐ <strong>${esc(f.name)}</strong> <small class="muted">(${(f.size/1024).toFixed(1)} KB) · de plantilla</small></span>
            <small style="color:#92400e;font-weight:600">se heredará</small>
          </li>`).join("");
        list.innerHTML = inheritHTML + (list.innerHTML || "");
        const totalEl = qs("#attachTotalSize");
        if (totalEl) totalEl.innerHTML = `<strong>${totalMB} MB</strong> heredados de plantilla / 10 MB`;
      }
    } catch (_e) { /* silent */ }

    toast(`✅ Plantilla "${esc(tpl.name)}" importada${tpl.previewText ? " + pre-header" : ""}. Vista previa cargada.`);
  } catch (e) {
    console.warn("Error cargando plantilla:", e.message);
    toast(`❌ Error cargando plantilla: ${esc(e.message)}`);
  } finally {
    /* P0 FIX 2026-05-08: siempre liberar UI aunque falle el fetch. */
    __lh.hide();
    sel.disabled = false;
    sel.style.opacity = "";
  }
});
/* Refrescar lista al cambiar a la pestaña campañas */
document.addEventListener("rubencoton:tab", (ev) => {
  if (ev.detail?.tab === "campaigns") populateCampaignTemplateSelect();
});
populateCampaignTemplateSelect(); /* primera carga */

campaignForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  /* P1 FEAT 2026-05-08: 3 acciones — draft, template (guardar como plantilla), send */
  const action = event.submitter?.value === "send" ? "send"
                : event.submitter?.value === "template" ? "template"
                : "draft";

  /* Acción "Guardar como plantilla": crea POST /api/templates con datos del form */
  if (action === "template") {
    const formData = new FormData(campaignForm);
    const name = String(formData.get("name") || "").trim();
    const subject = String(formData.get("subject") || "").trim();
    const previewText = String(formData.get("previewText") || "").trim();
    const html = String(formData.get("html") || "").trim();
    const text = String(formData.get("text") || "").trim();
    if (!name) { toast("Pon un nombre para la plantilla"); return; }
    if (!subject) { toast("Pon un asunto"); return; }
    if (!html && !text) { toast("Escribe el contenido (HTML o texto)"); return; }
    try {
      const r = await api("/api/templates", {
        method: "POST",
        body: JSON.stringify({ name, subject, previewText, html, text })
      });
      toast(`✅ Plantilla "${esc(name)}" guardada`);
      await populateCampaignTemplateSelect();
      const sel = qs("#campaignTemplateSelect");
      if (sel && r.template?.id) sel.value = r.template.id;
    } catch (e) {
      toast(`❌ Error: ${esc(e.message)}`);
    }
    return;
  }

  /* Si lanza ya, pedir confirmacion explicita con modal bonito integrado. */
  if (action === "send") {
    const nombre = String(new FormData(campaignForm).get("name") || "tu campana").trim() || "tu campana";
    const listCount = (qs("#campaignRecipientCount")?.textContent || "").trim();
    const ok = await rubenCotonConfirm({
      title: "Lanzar campaña",
      icon: "🚀",
      subtitle: nombre,
      body: `Vas a lanzar la campaña <strong>"${esc(nombre)}"</strong> ahora mismo.<br><br>` +
            `<strong style="color:#E65100">${esc(listCount) || "Comprobando destinatarios…"}</strong><br><br>` +
            `Los emails empezarán a enviarse inmediatamente.<br>` +
            `Esta acción <strong>no se puede deshacer</strong> una vez iniciada.`,
      confirmText: "🚀 Sí, LANZAR ahora",
      cancelText: "Cancelar"
    });
    if (!ok) {
      campaignResult.textContent = "Lanzamiento cancelado. Pulsa \"Guardar como borrador\" si quieres guardar sin enviar.";
      return;
    }
  }

  /* Helper: renderiza barra de progreso visual con porcentaje y mensaje. */
  const setProgress = (percent, message, ok) => {
    const color = ok === false ? "#dc2626" : "#FF6B00";
    const yellow = "#FFB74D";
    const barColor = percent >= 100 ? "linear-gradient(90deg,#16a34a,#22c55e)" : `linear-gradient(90deg,${color},${yellow})`;
    campaignResult.innerHTML = `
      <div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px;box-shadow:0 2px 8px rgba(0,0,0,0.05)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span style="font-weight:700;color:#333;font-size:14px">${esc(message)}</span>
          <span style="font-weight:800;color:${color};font-size:14px">${Math.min(100,Math.round(percent))}%</span>
        </div>
        <div style="background:#f3f4f6;border-radius:6px;height:10px;overflow:hidden">
          <div style="background:${barColor};height:100%;width:${Math.min(100,percent)}%;transition:width 0.4s ease-out;box-shadow:0 0 8px rgba(255,107,0,0.4)"></div>
        </div>
      </div>`;
  };
  setProgress(5, action === "send" ? "🚀 Creando campaña…" : "💾 Guardando borrador…");
  const formData = new FormData(campaignForm);

  try {
    /* Leemos value del select directamente para no depender de FormData cuando
     * el select fue poblado dinámicamente. */
    const raw = String((campaignSegmentSelect?.value || formData.get("segmentId") || "")).trim();
    let segmentId = null;
    let listFilter = null;
    const displayName = campaignSegmentSelect?.options?.[campaignSegmentSelect.selectedIndex]?.text || "";
    if (raw) {
      /* Normaliza: quita prefijo LIST:: si existe, si no usa raw tal cual. */
      const tagSlug = raw.startsWith("LIST::") ? raw.slice(6) : raw;
      /* Intenta crear segmento ad-hoc. Si falla, aún tenemos listFilter. */
      try {
        segmentId = await ensureSegmentForTag(tagSlug, displayName || tagSlug);
      } catch (_e) { segmentId = null; }
      listFilter = { tag: tagSlug, name: (displayName || tagSlug).slice(0, 120) };
    }

    /* BLINDAJE UI: solo bloqueamos si el usuario realmente NO eligió nada.
     * Si eligió cualquier opción con value, seguimos y el backend valida. */
    if (!segmentId && !listFilter) {
      campaignResult.innerHTML = '⚠ <strong>Selecciona una Lista</strong> en el desplegable antes de guardar. Revisa que no esté en "— Primero selecciona carpeta —".';
      return;
    }

    setProgress(25, "📝 Guardando datos de campaña…");
    const r = await api("/api/campaigns", {
      method: "POST",
      body: JSON.stringify({
        name: String(formData.get("name") || "").trim(),
        subject: String(formData.get("subject") || "").trim(),
        previewText: String(formData.get("previewText") || "").trim(),
        templateId: String(formData.get("templateId") || "").trim() || null,
        segmentId,
        listFilter,
        html: String(formData.get("html") || "").trim(),
        text: String(formData.get("text") || "").trim()
      })
    });
    const campaignId = r.campaign?.id;
    window.__lastCampaignId = campaignId;
    setProgress(50, "✓ Campaña guardada");

    /* Sube adjuntos pendientes a la campaña recién creada */
    let attachSummary = "";
    if (campaignId && (window.__pendingAttachments || []).length > 0) {
      setProgress(60, `📎 Subiendo ${window.__pendingAttachments.length} adjunto(s)…`);
      const { uploaded, errors } = await flushPendingAttachments(campaignId);
      if (uploaded > 0) attachSummary = ` 📎 ${uploaded} adjunto(s) subido(s).`;
      if (errors.length) attachSummary += ` ⚠ Errores: ${errors.join(" | ")}`;
      setProgress(70, "✓ Adjuntos subidos");
    } else {
      setProgress(60, "✓ Sin adjuntos");
    }

    /* P1 FEAT 2026-05-08: heredar adjuntos de la plantilla seleccionada
       (si la hubo). Se copian de tpl_xxx/ a cmp_yyy/ vía endpoint.
       Solo se ejecuta si el usuario eligió plantilla en el selector. */
    if (campaignId && window.__inheritFromTemplate) {
      try {
        const r = await api(`/api/campaigns/${campaignId}/attachments/inherit-from-template/${window.__inheritFromTemplate}`, { method: "POST" });
        if (r.copied > 0) attachSummary += ` ⭐ ${r.copied} adjunto(s) heredados de plantilla.`;
      } catch (e) {
        attachSummary += ` ⚠ No se heredaron adjuntos: ${e.message}`;
      }
      window.__inheritFromTemplate = null;
    }

    if (action === "send" && campaignId) {
      setProgress(85, "📨 Encolando envío en motor…");
      try {
        let sendR;
        try {
          sendR = await api(`/api/campaigns/${campaignId}/send`, { method: "POST" });
        } catch (err) {
          const msg = String(err && err.message || "");
          if (/SIN segmento/i.test(msg) || /confirmSendAll/i.test(msg) || /threshold/i.test(msg)) {
            /* UX 2026-05-05: reescrito modal con lenguaje claro para
             * usuario sin contexto tecnico. Antes mostraba mensaje crudo
             * del servidor con jerga ({"confirmSendAll":true}, "umbral").
             * Extraemos el numero de destinatarios y construimos un texto
             * humano que explique el proceso completo. */
            const numMatch = msg.match(/(\d+)\s*destinatarios/i);
            const totalEnvios = numMatch ? Number(numMatch[1]) : 0;
            const totalFmt = totalEnvios.toLocaleString("es-ES");
            const dias = Math.ceil(totalEnvios / 1950);
            const ok = await rubenCotonConfirm({
              title: "Vas a enviar una campaña grande",
              icon: "📨",
              body: `
                <div style="font-size:15px;line-height:1.55;color:#1f2937">
                  <p style="margin:0 0 14px"><strong>Total a enviar:</strong> <span style="color:#FF6B00;font-weight:800;font-size:18px">${totalFmt} personas</span></p>

                  <div style="background:#f3f4f6;border-left:4px solid #FF6B00;padding:12px 14px;border-radius:6px;margin:0 0 14px">
                    <strong style="display:block;margin-bottom:6px;color:#111">Cómo se enviarán:</strong>
                    <ul style="margin:0;padding-left:18px;color:#374151">
                      <li>Máximo <strong>1.950 al día</strong> (límite seguro Gmail)</li>
                      <li>Solo entre <strong>8:00 y 20:00</strong> (Madrid)</li>
                      <li>Ritmo lento: <strong>1 cada 15-25 segundos</strong> (parece humano)</li>
                      <li>El sistema pausa solo si llega al límite del día</li>
                    </ul>
                  </div>

                  <p style="margin:0 0 8px"><strong>Tiempo estimado total:</strong> ~${dias} ${dias === 1 ? "día" : "días"} repartidos automáticamente</p>

                  <p style="margin:0;color:#dc2626;font-weight:600">⚠ No se puede deshacer una vez lanzada (sí se puede pausar).</p>
                </div>
              `,
              confirmText: "Sí, lanzar la campaña",
              cancelText: "No, cancelar"
            });
            if (!ok) {
              campaignResult.innerHTML = `<div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:10px;padding:14px 16px;color:#78350f;font-weight:600">⚠ Campaña guardada pero NO lanzada. Lanzamiento cancelado.</div>`;
              throw new Error("cancelled-by-user");
            }
            sendR = await api(`/api/campaigns/${campaignId}/send`, {
              method: "POST",
              body: JSON.stringify({ confirmSendAll: true })
            });
          } else { throw err; }
        }
        setProgress(100, "🚀 ¡Campaña lanzada!");
        /* Mensaje de éxito con botón MANUAL de redirect (no auto). */
        setTimeout(() => {
          campaignResult.innerHTML = `
            <div style="background:linear-gradient(135deg,#16a34a,#22c55e);color:#fff;border-radius:12px;padding:20px 22px;box-shadow:0 8px 22px rgba(22,163,74,0.3)">
              <div style="font-size:30px;margin-bottom:8px">🚀✅</div>
              <div style="font-size:18px;font-weight:800;margin-bottom:4px">¡Campaña lanzada con éxito!</div>
              <div style="font-size:14px;opacity:0.95;margin-bottom:16px">Los emails están saliendo.${attachSummary}</div>
              <button type="button" id="goToStatusBtn" style="background:#fff;color:#16a34a;border:0;padding:12px 24px;border-radius:8px;font-weight:800;font-size:14px;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.15);display:inline-flex;align-items:center;gap:8px">
                📊 Ver en Estado campañas →
              </button>
              <button type="button" id="stayHereBtn" style="background:transparent;color:#fff;border:2px solid rgba(255,255,255,0.5);padding:12px 20px;border-radius:8px;font-weight:700;font-size:14px;cursor:pointer;margin-left:8px">
                Quedarme aquí
              </button>
            </div>`;
          const go = () => {
            qs('[data-tab="campaignStatus"]')?.click();
            window.scrollTo({ top: 0, behavior: "smooth" });
            if (typeof refreshCampaigns === "function") refreshCampaigns();
          };
          qs("#goToStatusBtn")?.addEventListener("click", go);
          qs("#stayHereBtn")?.addEventListener("click", () => {
            campaignResult.innerHTML = `<span style="color:#16a34a;font-weight:600">✓ Campaña lanzada. Puedes verla en Estado campañas cuando quieras.</span>`;
          });
        }, 400);
      } catch (sendErr) {
        if (sendErr.message !== "cancelled-by-user") {
          setProgress(100, "❌ Error", false);
          setTimeout(() => {
            campaignResult.innerHTML = `<div style="background:#fee2e2;border:1px solid #fca5a5;border-radius:10px;padding:14px 16px;color:#991b1b;font-weight:600">⚠ Campaña guardada pero no se pudo lanzar: ${esc(sendErr.message)}.${attachSummary}</div>`;
          }, 300);
        }
      }
    } else {
      campaignResult.innerHTML = `💾 <strong>Borrador guardado</strong> (${esc(campaignId || "?")}).${attachSummary} Puedes <strong>subir más adjuntos</strong> aquí abajo o ir a <strong>Estado campañas</strong> para lanzarla cuando quieras.`;
    }

    await refreshCampaigns();
    await refreshPanel();
    await refreshAttachList();
  } catch (error) {
    campaignResult.textContent = `Error: ${error.message}`;
  }
});

/* ── Adjuntos ── */
const fmtSize = (b) => b < 1024 ? `${b} B` : b < 1024*1024 ? `${(b/1024).toFixed(1)} KB` : `${(b/1024/1024).toFixed(2)} MB`;

const refreshAttachList = async () => {
  const list = qs("#campAttachList");
  const totalEl = qs("#attachTotalSize");
  if (!list) return;
  const id = window.__lastCampaignId;
  if (!id) {
    list.innerHTML = `<li class="muted" style="padding:8px">Guarda la campaña primero para añadir adjuntos.</li>`;
    if (totalEl) totalEl.textContent = "0 MB / 10 MB";
    return;
  }
  try {
    const data = await api(`/api/campaigns/${id}/attachments`);
    const files = data.files || [];
    list.innerHTML = files.length
      ? files.map((f) => `
          <li style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #e5e7eb">
            <span>📄 ${esc(f.name)} <small class="muted">(${fmtSize(f.size)})</small></span>
            <button type="button" class="mini-btn btn-secondary" style="font-size:11px;padding:2px 8px" data-delete-attach="${esc(f.name)}">Eliminar</button>
          </li>`).join("")
      : `<li class="muted" style="padding:6px 0">Sin adjuntos</li>`;
    if (totalEl) totalEl.innerHTML = `<strong>${fmtSize(data.totalSize || 0)}</strong> / ${fmtSize(data.limit || 10485760)}`;
    qsa("[data-delete-attach]").forEach((b) => b.addEventListener("click", async () => {
      await api(`/api/campaigns/${id}/attachments/${encodeURIComponent(b.dataset.deleteAttach)}`, { method: "DELETE" });
      refreshAttachList();
    }));
  } catch (_) {}
};

/* ============================================================ */
/* MODAL: Generar email con IA (replica RUBEN-COTON_HTML)         */
/* ============================================================ */
const AI_OBJETIVOS = {
  fiestas_patronales: "Que el ayuntamiento te contrate como DJ para sus fiestas patronales. La IA resalta experiencia en plazas, mashups y público amplio.",
  festival: "Ser contratado en un festival de música. La IA adapta el tono al perfil del promotor del festival.",
  boda: "Que te contraten para una boda o fiesta privada. La IA adopta un tono cálido, cercano y profesional.",
  corporativo: "Que una empresa te contrate para una cena, convención o gala. Tono ejecutivo.",
  discoteca: "Ser DJ residente en una sala o discoteca. Tono directo, urbano, con datos de rendimiento.",
  deportivo: "Animar eventos deportivos. Tono energético y competitivo.",
  entrevista: "Conseguir una reunión presencial. La IA pide una cita concreta.",
  presentacion: "Presentar tu propuesta en persona. Enfoque en beneficios para el receptor.",
  colaboracion: "Proponer una colaboración profesional. Tono de igual a igual.",
  radio: "Aparecer en la radio (entrevista o sesión). La IA destaca lo que aportas a sus oyentes.",
  prensa: "Salir en prensa escrita o digital. Enfocado en titulares y noticia.",
  tv: "Aparecer en televisión. Lenguaje visual, dinámico.",
  podcast: "Ser invitado a un podcast. Tono conversacional.",
  rrss_media: "Aparecer en RRSS de medios o influencers. Enfoque en engagement.",
  presentar_marca: "Presentación general de quién eres y qué haces. Tono introductorio.",
  nuevo_proyecto: "Anunciar un proyecto nuevo. Tono ilusionante con datos clave.",
  booking: "Ofrecer tus servicios de booking y management. Tono profesional B2B.",
  otro: "Escribe tu objetivo concreto abajo."
};

const aiModal = qs("#aiModal");
const openAiModal = () => {
  if (!aiModal) return;
  aiModal.classList.add("is-open");
  aiModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  setTimeout(() => qs("#aiAudiencia")?.focus(), 50);
};
const closeAiModal = () => {
  if (!aiModal) return;
  aiModal.classList.remove("is-open");
  aiModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
};

aiModal?.querySelectorAll("[data-ai-close]").forEach(el => el.addEventListener("click", closeAiModal));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && aiModal?.classList.contains("is-open")) closeAiModal();
});

/* Descripcion del objetivo */
qs("#aiObjetivo")?.addEventListener("change", (e) => {
  const val = e.target.value;
  const desc = qs("#aiObjetivoDesc");
  const texto = qs("#aiObjetivoTexto");
  if (val && AI_OBJETIVOS[val]) {
    desc.textContent = AI_OBJETIVOS[val];
    desc.style.display = "block";
  } else {
    desc.style.display = "none";
  }
  texto.style.display = (val === "otro") ? "block" : "none";
});

/* Parsers */
const parseYouTubeId = (url) => {
  if (!url) return "";
  const m = String(url).match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : "";
};
const parseDrivePhotoUrl = (url) => {
  if (!url) return "";
  const m = String(url).match(/\/file\/d\/([A-Za-z0-9_-]+)/) || String(url).match(/[?&]id=([A-Za-z0-9_-]+)/);
  if (!m) return url; // asume URL directa
  return `https://lh3.googleusercontent.com/d/${m[1]}=w600`;
};

/* Abrir modal al pulsar el boton */
qs("#aiBuildBtn")?.addEventListener("click", () => openAiModal());

/* P0 audit 2026-05-04: integración RUBEN-COTON_HTML como Email Builder.
 * Detección automática del server local antes de abrir. Si el PC tiene el
 * server.js corriendo (puerto 8090), abre allá. Si no, muestra modal con
 * instrucciones claras de cómo arrancarlo. */
const detectLocalServer = async (timeoutMs = 1500) => {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const resp = await fetch("http://localhost:8090/", {
      method: "HEAD",
      mode: "no-cors",
      cache: "no-store",
      signal: ctrl.signal
    });
    clearTimeout(timer);
    /* mode:no-cors devuelve `opaque` pero la conexión TCP/HTTP fue exitosa */
    return true;
  } catch (e) {
    return false;
  }
};

qs("#aiBuilderLocalBtn")?.addEventListener("click", async () => {
  const btn = qs("#aiBuilderLocalBtn");
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = "⏳ Detectando local...";
  const isUp = await detectLocalServer(1500);
  btn.innerHTML = original;
  btn.disabled = false;
  if (isUp) {
    window.open("http://localhost:8090/", "_blank", "noopener,noreferrer");
    return;
  }
  const ok = await rubenCotonConfirm({
    title: "Email Builder local NO está corriendo",
    icon: "🖥",
    body: `Para usar el Email Builder con Qwen 2.5 14B local necesitas:<br><br>
      <strong>1.</strong> Doble-clic en <code>RUBEN-COTON_HTML\\Iniciar-Server.bat</code><br>
      <strong>2.</strong> Verifica que aparece "Server escuchando en localhost:8090"<br>
      <strong>3.</strong> Vuelve aquí y pulsa de nuevo el botón<br><br>
      Si quieres usar la versión web (sin Ollama, limitada) pulsa "Ver web".`,
    confirmText: "Ver web limitada",
    cancelText: "Cancelar"
  });
  if (ok) {
    window.open("/ai-builder/index.html", "_blank", "noopener,noreferrer");
  }
});

qs("#aiBuilderWebBtn")?.addEventListener("click", () => {
  /* Versión web del proyecto HTML servida estáticamente desde
   * /ai-builder/. SIN Ollama local (mixed content), pero conserva el
   * diseño y plantillas para vista previa. */
  window.open("/ai-builder/index.html", "_blank", "noopener,noreferrer");
});

/* Generar email desde el modal */
qs("#aiGenerarBtn")?.addEventListener("click", async () => {
  const btn = qs("#aiGenerarBtn");
  const status = qs("#aiGenStatus");
  const audiencia = qs("#aiAudiencia").value.trim();
  const objetivoVal = qs("#aiObjetivo").value;
  const objetivoTxt = qs("#aiObjetivoTexto").value.trim();
  const queVendemos = qs("#aiQueVendemos").value.trim();
  const videoLink = qs("#aiVideoLink").value.trim();
  const fotoLink = qs("#aiFotoLink").value.trim();
  const tono = qs("#aiTono").value;

  if (!audiencia) { status.className = "ai-gen-status is-err"; status.textContent = "Falta la audiencia"; return; }
  if (!objetivoVal) { status.className = "ai-gen-status is-err"; status.textContent = "Elige un objetivo"; return; }
  if (!queVendemos) { status.className = "ai-gen-status is-err"; status.textContent = "Describe qué vendes"; return; }

  const objectiveText = objetivoVal === "otro"
    ? objetivoTxt
    : (AI_OBJETIVOS[objetivoVal] || objetivoVal);
  if (objetivoVal === "otro" && !objetivoTxt) {
    status.className = "ai-gen-status is-err"; status.textContent = "Describe el objetivo"; return;
  }

  btn.disabled = true;
  status.className = "ai-gen-status";
  status.textContent = "";

  /* Barra de progreso simulada por fases */
  const progWrap = qs("#aiProgressWrap");
  const progFill = qs("#aiProgressFill");
  const progPct = qs("#aiProgressPct");
  const progPhase = qs("#aiProgressPhase");
  const phases = [
    { until: 15, label: "🧠 Analizando audiencia y objetivo…" },
    { until: 40, label: "✍️ Redactando copy del email…" },
    { until: 72, label: "🎨 Generando diseño HTML…" },
    { until: 92, label: "✨ Ajustando tono y detalles…" }
  ];
  let pct = 0;
  const updateProgress = (value) => {
    pct = Math.min(95, Math.max(0, value));
    if (progFill) progFill.style.width = pct + "%";
    if (progPct) progPct.textContent = Math.round(pct) + "%";
    const phase = phases.find((p) => pct <= p.until) || phases[phases.length - 1];
    if (progPhase) progPhase.textContent = phase.label;
  };
  if (progWrap) progWrap.style.display = "";
  updateProgress(2);
  const tick = setInterval(() => {
    /* Avance decreciente: empuja fuerte al principio, va frenando */
    const remaining = 95 - pct;
    const delta = Math.max(0.4, remaining * 0.06);
    updateProgress(pct + delta);
  }, 650);

  try {
    const payload = {
      audience: audiencia,
      objective: objectiveText,
      offer: queVendemos,
      tone: tono,
      videoId: parseYouTubeId(videoLink),
      photoUrl: parseDrivePhotoUrl(fotoLink)
    };
    const r = await api("/api/ai/build-email", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    /* Rellenar editor */
    const subjInput = qs('#campaignForm input[name="subject"]');
    if (subjInput) subjInput.value = r.subject;
    const htmlEditor = qs("#campHtmlEditor");
    if (htmlEditor) htmlEditor.value = r.html;
    const textArea = qs('#campaignForm textarea[name="text"]');
    if (textArea) textArea.value = r.text;

    clearInterval(tick);
    if (progFill) progFill.style.width = "100%";
    if (progPct) progPct.textContent = "100%";
    if (progPhase) progPhase.textContent = "✅ Email generado";

    status.className = "ai-gen-status is-ok";
    status.textContent = `✅ Generado vía ${r.providerName || r.provider} (tier ${r.tier})`;
    qs('.mode-tab[data-mode="preview"]')?.click();
    setTimeout(() => {
      closeAiModal();
      status.textContent = "";
      if (progWrap) progWrap.style.display = "none";
      if (progFill) progFill.style.width = "0%";
      if (progPct) progPct.textContent = "0%";
    }, 1500);
  } catch (e) {
    clearInterval(tick);
    if (progPhase) progPhase.textContent = "❌ Error";
    status.className = "ai-gen-status is-err";
    status.textContent = "❌ Error: " + e.message;
    setTimeout(() => {
      if (progWrap) progWrap.style.display = "none";
      if (progFill) progFill.style.width = "0%";
    }, 2500);
  } finally {
    btn.disabled = false;
  }
});

/* Cola de adjuntos pendientes: archivos seleccionados antes de guardar
 * la campaña. Se subiran automaticamente en el submit handler. */
window.__pendingAttachments = window.__pendingAttachments || [];

const renderPendingAttachments = () => {
  const list = qs("#campAttachList");
  const totalEl = qs("#attachTotalSize");
  if (!list) return;
  const pending = window.__pendingAttachments || [];
  if (!pending.length) return; /* deja que refreshAttachList maneje lista real */
  const totalBytes = pending.reduce((s, f) => s + f.size, 0);
  list.innerHTML = pending.map((f, i) => `
    <li style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #e5e7eb">
      <span>⏳ <strong>${esc(f.name)}</strong> <small class="muted">(${(f.size/1024).toFixed(1)} KB) · pendiente</small></span>
      <button type="button" class="mini-btn btn-secondary" style="font-size:11px;padding:2px 8px" data-pending-remove="${i}">Quitar</button>
    </li>
  `).join("");
  if (totalEl) totalEl.innerHTML = `<strong>${(totalBytes/1024/1024).toFixed(2)} MB</strong> / 10 MB <small style="color:#E65100">(pendientes)</small>`;
  qsa("[data-pending-remove]").forEach((b) => b.addEventListener("click", () => {
    const idx = Number(b.dataset.pendingRemove);
    window.__pendingAttachments.splice(idx, 1);
    if (window.__pendingAttachments.length === 0) {
      list.innerHTML = `<li class="muted" style="padding:8px">Sin adjuntos. Puedes añadir ahora y se subirán al guardar.</li>`;
      if (totalEl) totalEl.textContent = "0 MB / 10 MB";
    } else {
      renderPendingAttachments();
    }
  }));
};

qs("#campAttachBtn")?.addEventListener("click", () => qs("#campAttachInput")?.click());
qs("#campAttachInput")?.addEventListener("change", async (e) => {
  const id = window.__lastCampaignId;
  const files = Array.from(e.target.files || []);
  e.target.value = "";

  /* Si NO hay campaña guardada: guardar en cola de pendientes */
  if (!id) {
    window.__pendingAttachments = window.__pendingAttachments || [];
    const totalBytes = window.__pendingAttachments.reduce((s, f) => s + f.size, 0) +
      files.reduce((s, f) => s + f.size, 0);
    if (totalBytes > 10 * 1024 * 1024) {
      rubenCotonAlert({ title: "Demasiado peso", body: `El total supera <strong>10 MB</strong> (${(totalBytes/1024/1024).toFixed(1)} MB). Quita algún archivo.`, icon: "⚠️", tone: "warn" });
      return;
    }
    for (const f of files) window.__pendingAttachments.push(f);
    renderPendingAttachments();
    campaignResult.innerHTML = `📎 ${files.length} archivo(s) en cola. Se subirán <strong>automáticamente</strong> al guardar o lanzar la campaña.`;
    return;
  }

  /* Hay campaña guardada: subir directo */
  for (const file of files) {
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch(`/api/campaigns/${id}/attachments`, { method: "POST", body: fd });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || "error");
    } catch (err) { rubenCotonAlert({ title: `No se pudo subir ${file.name}`, body: humanizeError(err), icon: "❌", tone: "error" }); break; }
  }
  refreshAttachList();
});

/* Sube todos los pendientes a la campaña recién creada. */
const flushPendingAttachments = async (campaignId) => {
  const pending = window.__pendingAttachments || [];
  if (!pending.length || !campaignId) return { uploaded: 0, errors: [] };
  let uploaded = 0;
  const errors = [];
  for (const file of pending) {
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/attachments`, { method: "POST", body: fd });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || "error");
      uploaded++;
    } catch (err) {
      errors.push(`${file.name}: ${err.message}`);
    }
  }
  window.__pendingAttachments = [];
  return { uploaded, errors };
};

/* ============================================================
   P1 FEAT 2026-05-08: ADJUNTOS PARA PLANTILLAS
   Mismo patrón que campañas pero contra /api/templates/:id/attachments.
   La caja se muestra solo al EDITAR una plantilla existente (necesita id).
   ============================================================ */
const refreshTplAttachList = async () => {
  const list = qs("#tplAttachList");
  const totalEl = qs("#tplAttachTotalSize");
  if (!list) return;
  const id = qs("#templateEditingId")?.value;
  if (!id) { list.innerHTML = ""; if (totalEl) totalEl.textContent = "0 MB / 10 MB"; return; }
  try {
    const data = await api(`/api/templates/${id}/attachments`);
    const files = data.files || [];
    const totalMB = (data.totalSize / 1024 / 1024).toFixed(2);
    if (totalEl) totalEl.textContent = `${totalMB} MB / 10 MB`;
    if (!files.length) {
      list.innerHTML = '<li class="muted" style="padding:8px">Sin adjuntos.</li>';
      return;
    }
    list.innerHTML = files.map((f) => `
      <li style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #e5e7eb">
        <span>📄 <strong>${esc(f.name)}</strong> <small class="muted">(${(f.size/1024).toFixed(1)} KB)</small></span>
        <button type="button" class="mini-btn btn-danger" style="font-size:11px;padding:2px 8px" data-tpl-delete-attach="${esc(f.name)}">Quitar</button>
      </li>
    `).join("");
    qsa("[data-tpl-delete-attach]").forEach((b) => b.addEventListener("click", async () => {
      const id2 = qs("#templateEditingId")?.value;
      if (!id2) return;
      try {
        await api(`/api/templates/${id2}/attachments/${encodeURIComponent(b.dataset.tplDeleteAttach)}`, { method: "DELETE" });
        refreshTplAttachList();
      } catch (e) { rubenCotonAlert({ title: "No se pudo borrar adjunto", body: humanizeError(e), icon: "❌", tone: "error" }); }
    }));
  } catch (e) { /* si no hay sesión, silent */ }
};

qs("#tplAttachBtn")?.addEventListener("click", () => qs("#tplAttachInput")?.click());
qs("#tplAttachInput")?.addEventListener("change", async (e) => {
  const id = qs("#templateEditingId")?.value;
  const files = Array.from(e.target.files || []);
  e.target.value = "";
  if (!id) {
    rubenCotonAlert({ title: "Guarda primero la plantilla", body: "Para añadir adjuntos, guarda la plantilla con un nombre y luego edítala.", icon: "ℹ️", tone: "info" });
    return;
  }
  for (const file of files) {
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch(`/api/templates/${id}/attachments`, { method: "POST", body: fd });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || "error");
    } catch (err) { rubenCotonAlert({ title: `No se pudo subir ${file.name}`, body: humanizeError(err), icon: "❌", tone: "error" }); break; }
  }
  refreshTplAttachList();
});

/* P1 FIX BUG #5 (audit 2026-05-08): reemplazado el polling 500ms eterno por
   listener directo + observer. Ahora el cambio de editingId se detecta vía:
   1) MutationObserver sobre attribute "value" (cuando se hace setAttribute).
   2) Event listener sobre evento "change" sintético que disparan tplEdit
      y el botón cancelar.
   No más setInterval consumiendo CPU para siempre. */
const __syncTplAttachBox = () => {
  const id = qs("#templateEditingId")?.value;
  const box = qs("#tplAttachBox");
  if (box) box.style.display = id ? "" : "none";
  if (id) refreshTplAttachList();
};
const editIdEl = qs("#templateEditingId");
if (editIdEl) {
  /* Observer para setAttribute("value", ...) */
  const observerTplEditing = new MutationObserver(__syncTplAttachBox);
  observerTplEditing.observe(editIdEl, { attributes: true, attributeFilter: ["value"] });
  /* Event listener para cambios programáticos (.value = ...) que disparen
     change manualmente. tplEdit ya lo dispara, también el botón cancelar. */
  editIdEl.addEventListener("change", __syncTplAttachBox);
  /* Estado inicial al cargar la página. */
  __syncTplAttachBox();
}

const loadAnalytics = async () => {
  const campaignId = analyticsCampaignSelect.value;
  if (!campaignId) {
    analyticsJson.textContent = "Selecciona una campaña";
    return;
  }

  try {
    const data = await api(`/api/campaigns/${campaignId}/analytics`);
    analyticsJson.textContent = pretty(data.analytics);
  } catch (error) {
    analyticsJson.textContent = `Error: ${error.message}`;
  }
};

loadAnalyticsBtn?.addEventListener("click", loadAnalytics);

const simulateEvent = async (type) => {
  const campaignId = analyticsCampaignSelect.value;
  if (!campaignId) {
    analyticsJson.textContent = "Selecciona una campaña";
    return;
  }

  try {
    await api(`/api/campaigns/${campaignId}/simulate`, {
      method: "POST",
      body: JSON.stringify({ type, percent: 40 })
    });
    await refreshCampaigns();
    await loadAnalytics();
    await refreshPanel();
  } catch (error) {
    analyticsJson.textContent = `Error: ${error.message}`;
  }
};

simulateOpenBtn?.addEventListener("click", () => simulateEvent("open"));
simulateClickBtn?.addEventListener("click", () => simulateEvent("click"));
simulateUnsubBtn?.addEventListener("click", () => simulateEvent("unsubscribe"));

workflowForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  workflowResult.textContent = "Creando workflow…";
  const formData = new FormData(workflowForm);

  try {
    await api("/api/workflows", {
      method: "POST",
      body: JSON.stringify({
        name: String(formData.get("name") || "").trim(),
        type: String(formData.get("type") || "").trim(),
        delayHours: Number(formData.get("delayHours") || 24),
        templateId: String(formData.get("templateId") || "").trim() || null,
        subjectOverride: String(formData.get("subjectOverride") || "").trim(),
        textOverride: String(formData.get("textOverride") || "").trim(),
        status: "published"
      })
    });

    workflowResult.textContent = "OK: workflow creado";
    workflowForm.reset();
    await refreshWorkflows();
  } catch (error) {
    workflowResult.textContent = `Error: ${error.message}`;
  }
});

runWorkflowsBtn?.addEventListener("click", async () => {
  workflowResult.textContent = "Ejecutando workflows…";
  try {
    const data = await api("/api/workflows/run", { method: "POST" });
    workflowResult.textContent = `OK: ejecuciones ${data.count}`;
    await refreshWorkflows();
    await refreshCampaigns();
  } catch (error) {
    workflowResult.textContent = `Error: ${error.message}`;
  }
});

refreshChecklistBtn?.addEventListener("click", refreshSetupChecklist);

testProviderBtn?.addEventListener("click", async () => {
  settingsActionResult.textContent = "Probando proveedor…";
  try {
    const data = await api("/api/mass-mail/test-provider", { method: "POST" });
    settingsActionResult.textContent = `OK: ${data.message || "Proveedor verificado"}`;
    await refreshPanel();
    await refreshSetupChecklist();
  } catch (error) {
    settingsActionResult.textContent = `Error: ${error.message}`;
  }
});

pauseEngineBtn?.addEventListener("click", async () => {
  settingsActionResult.textContent = "Pausando motor…";
  try {
    await api("/api/mass-mail/pause", { method: "POST" });
    settingsActionResult.textContent = "OK: motor pausado";
    await refreshPanel();
  } catch (error) {
    settingsActionResult.textContent = `Error: ${error.message}`;
  }
});

resumeEngineBtn?.addEventListener("click", async () => {
  settingsActionResult.textContent = "Reanudando motor…";
  try {
    await api("/api/mass-mail/resume", { method: "POST" });
    settingsActionResult.textContent = "OK: motor reanudado";
    await refreshPanel();
  } catch (error) {
    settingsActionResult.textContent = `Error: ${error.message}`;
  }
});

quickSendForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  quickSendResult.textContent = "Enviando prueba…";

  try {
    const to = String(quickSendTo?.value || "").trim();
    const subject = String(quickSendSubject?.value || "").trim();
    const text = String(quickSendText?.value || "").trim();

    const data = await api("/api/mass-mail/send-test", {
      method: "POST",
      body: JSON.stringify({
        to,
        subject,
        text
      })
    });

    quickSendResult.textContent = `OK: prueba en cola (${data.job?.id || "-"})`;
    await refreshPanel();
  } catch (error) {
    quickSendResult.textContent = `Error: ${error.message}`;
  }
});

const init = async () => {
  try {
    if (quickSendSubject) {
      quickSendSubject.value = "Prueba de envío | RUBEN COTON";
    }
    if (quickSendText) {
      quickSendText.value =
        "Hola, esta es una prueba técnica del sistema de mailing y envíos masivos.";
    }

    /* P0 PERF 2026-05-08 (peticion usuario "que cargue rapido y no se quede
       pillada"): TODA la inicialización en paralelo (antes refreshPanel
       bloqueaba). refreshContacts es lazy (solo se llama cuando se abre la
       pestaña contactos), ahorra una request inicial pesada con 56k contactos.
       Promise.allSettled para que un fallo individual no rompa el init.
       P1 DIAG 2026-05-08: timing per-request para identificar cuál de las 6
       es la lenta (sospecha cold start Coolify). Aparece en console. */
    const initStart = performance.now();
    const timed = (name, fn) => {
      const t0 = performance.now();
      return fn().then(
        (v) => { console.log(`[init] ${name}: ${Math.round(performance.now() - t0)}ms`); return v; },
        (e) => { console.warn(`[init] ${name}: FAIL en ${Math.round(performance.now() - t0)}ms — ${e?.message}`); throw e; }
      );
    };
    const results = await Promise.allSettled([
      timed("panel", refreshPanel),
      timed("templates", refreshTemplates),
      timed("segments", refreshSegments),
      timed("campaigns", refreshCampaigns),
      timed("workflows", refreshWorkflows),
      timed("setupChecklist", refreshSetupChecklist)
      /* refreshContacts() eliminado: lazy en activateTab('contacts') */
    ]);
    const failed = results.filter(r => r.status === "rejected");
    if (failed.length) {
      console.warn(`[init] ${failed.length}/${results.length} requests fallaron:`, failed.map(r => r.reason?.message));
    }
    console.log(`[init] carga inicial completa en ${Math.round(performance.now() - initStart)}ms`);
  } catch (error) {
    dashboardJsonEl.textContent = `Error inicial: ${error.message}`;
  }
};

/* P0 PERF 2026-05-08: lazy load de contactos. Se carga solo cuando el
   usuario abre la pestaña contactos por primera vez. Marca de cargado
   para no repetir el fetch innecesariamente. */
let __contactsLoadedOnce = false;
document.addEventListener("rubencoton:tab", (ev) => {
  if (ev.detail?.tab === "contacts" && !__contactsLoadedOnce) {
    __contactsLoadedOnce = true;
    refreshContacts().catch(() => { __contactsLoadedOnce = false; });
  }
});

/* ── AI cascade status ── */
const renderAiStatus = async () => {
  if (!aiStatusList) return;
  aiStatusList.innerHTML = "Cargando estado…";
  try {
    const s = await api("/api/ai/status");
    aiStatusList.innerHTML = (s.providers || []).map((p, i) => {
      const statusLabel = {
        up: "Disponible", down: "No disponible",
        not_configured: "No configurada", unknown: "Desconocido"
      }[p.status] || p.status;
      return `
        <div class="ai-status-row">
          <span class="ai-status-prio">${i + 1}</span>
          <span class="ai-status-dot ${p.status}"></span>
          <span class="ai-status-name">${esc(p.displayName)}</span>
          <span class="ai-status-badge ${p.status}">${statusLabel}</span>
        </div>
      `;
    }).join("");
  } catch (e) {
    aiStatusList.innerHTML = `<p class="muted">Error: ${esc(e.message)}</p>`;
  }
};

aiRefreshBtn?.addEventListener("click", renderAiStatus);

aiTestBtn?.addEventListener("click", async () => {
  aiTestResult.textContent = "Generando email con IA…";
  aiTestJson.style.display = "none";
  try {
    const r = await api("/api/ai/generate-email", {
      method: "POST",
      body: JSON.stringify({
        audience: "Concejales de festejos de ayuntamientos de Madrid",
        objective: "Contratar DJ para las fiestas patronales",
        offer: "DJ RUBEN COTON con experiencia en Palau Alameda Valencia"
      })
    });
    aiTestResult.textContent = `OK: via ${r.ai?.providerName || "?"}`;
    aiTestJson.textContent = pretty(r.email || r.raw);
    aiTestJson.style.display = "block";
  } catch (e) {
    aiTestResult.textContent = `Error: ${e.message}`;
  }
});

/* Cargar estado al abrir Configuración */
qs('[data-tab="settings"]')?.addEventListener("click", () => { renderAiStatus(); });

/* ── Folders view (CRMs / Listas) ── */
let _folders = null;
let _currentCrm = null;

const renderCrms = async () => {
  if (!foldersGrid) return;
  foldersGrid.innerHTML = "Cargando CRMs…";
  try {
    const data = await api("/api/folders");
    _folders = data.folders || [];
    foldersTitle.textContent = "Tus CRMs";
    foldersSubtitle.textContent = `${_folders.length} CRMs conectados. Haz clic en uno para ver sus listas.`;
    foldersBreadcrumb.innerHTML = `<span class="crumb-active">📂 CRMs</span>`;
    foldersGrid.innerHTML = _folders.map((f) => `
      <div class="folder-card" data-crm="${esc(f.slug)}">
        <span class="folder-icon">📂</span>
        <div class="folder-count">${f.total.toLocaleString("es-ES")}</div>
        <div class="folder-sub">contactos</div>
        <div class="folder-name" style="margin-top:10px">${esc(f.name)}</div>
        <div class="folder-sub" style="margin-top:4px">${f.lists.length} listas →</div>
      </div>
    `).join("");
    qsa(".folder-card[data-crm]").forEach((el) => {
      el.addEventListener("click", () => renderLists(el.dataset.crm));
    });
  } catch (e) {
    foldersGrid.innerHTML = `<p class="muted">Error: ${esc(e.message)}</p>`;
  }
};

const renderLists = (crmSlug) => {
  const crm = _folders?.find((f) => f.slug === crmSlug);
  if (!crm) return;
  _currentCrm = crm;
  foldersTitle.textContent = crm.name;
  foldersSubtitle.textContent = `${crm.total.toLocaleString("es-ES")} contactos en ${crm.lists.length} listas.`;
  foldersBreadcrumb.innerHTML = `
    <a data-action="back">📂 CRMs</a>
    <span class="sep">/</span>
    <span class="crumb-active">${esc(crm.name)}</span>
  `;
  foldersBreadcrumb.querySelector('[data-action="back"]').addEventListener("click", renderCrms);
  foldersGrid.innerHTML = crm.lists.map((l) => `
    <div class="folder-card" data-list="${esc(l.slug)}" data-list-name="${esc(l.name)}" data-crm-name="${esc(crm.name)}">
      <span class="folder-icon">📋</span>
      <div class="folder-count">${l.count.toLocaleString("es-ES")}</div>
      <div class="folder-sub">contactos</div>
      <div class="folder-name" style="margin-top:10px">${esc(l.name)}</div>
      <div style="display:flex;gap:6px;margin-top:10px">
        <button class="mini-btn btn-campana-lista" style="flex:1;font-size:11px;padding:6px 8px" data-list="${esc(l.slug)}" data-list-name="${esc(l.name)}" data-crm-name="${esc(crm.name)}">📨 Campaña</button>
        <button class="mini-btn btn-secondary btn-ver-lista" style="flex:1;font-size:11px;padding:6px 8px" data-list="${esc(l.slug)}">Ver</button>
      </div>
    </div>
  `).join("");

  /* Boton Ver → contactos filtrados */
  qsa(".btn-ver-lista").forEach((el) => el.addEventListener("click", (e) => {
    e.stopPropagation();
    const search = qs("#contactSearch");
    if (search) search.value = el.dataset.list;
    qs('[data-tab="contacts"]')?.click();
    refreshContacts();
  }));

  /* Boton Campana → Crear campana con esta lista preseleccionada */
  qsa(".btn-campana-lista").forEach((el) => el.addEventListener("click", (e) => {
    e.stopPropagation();
    const listSlug = el.dataset.list;
    const listName = el.dataset.listName;
    const crmName = el.dataset.crmName;
    /* Guardar seleccion para Crear campana */
    window.__pendingListCampaign = { listSlug, listName, crmName };
    qs('[data-tab="campaigns"]')?.click();
    /* Trigger refresh del selector */
    setTimeout(() => populateCampaignListSelector(), 100);
  }));
};

/* Pobla los 2 selectores: CRM y Lista (dependiente del CRM elegido) */
const populateCampaignListSelector = async () => {
  const crmSel = qs("#campaignCrmSelect");
  const listSel = qs("#campaignSegmentSelect");
  const hint = qs("#campaignRecipientCount");
  if (!crmSel || !listSel) return;

  /* Siempre refresca para no quedarse con cache vacio */
  try { _folders = (await api("/api/folders")).folders || []; }
  catch (e) {
    crmSel.innerHTML = `<option value="">⚠ Error cargando CRMs: ${esc(e.message)}</option>`;
    return;
  }
  if (!_folders.length) {
    crmSel.innerHTML = '<option value="">⚠ No hay CRMs — sincroniza primero desde Configuración</option>';
    if (hint) hint.innerHTML = '<span style="color:#E65100">Los contactos no tienen etiquetas <code>crm-*</code>. Ve a Configuración → "Sincronizar CRMs ahora".</span>';
    return;
  }

  /* Selector 1: CRMs */
  crmSel.innerHTML = '<option value="">— Selecciona carpeta —</option>' +
    '<option value="__ALL__">📂 Todos los contactos (' + _folders.reduce((s,f)=>s+f.total,0).toLocaleString("es-ES") + ')</option>' +
    _folders.map((f) => `<option value="${esc(f.slug)}">📂 ${esc(f.name)} (${f.total.toLocaleString("es-ES")})</option>`).join("");

  /* Handler CRM change → pobla listas */
  crmSel.onchange = () => {
    const slug = crmSel.value;
    if (!slug) {
      listSel.innerHTML = '<option value="">— Primero selecciona carpeta —</option>';
      listSel.disabled = true;
      hint.textContent = "Selecciona carpeta y lista para ver los destinatarios.";
      return;
    }
    if (slug === "__ALL__") {
      listSel.innerHTML = '<option value="">Todos los contactos</option>';
      listSel.disabled = true;
      hint.innerHTML = `<strong style="color:var(--brand-red)">${_folders.reduce((s,f)=>s+f.total,0).toLocaleString("es-ES")}</strong> contactos en total`;
      return;
    }
    const crm = _folders.find((f) => f.slug === slug);
    if (!crm) return;
    listSel.disabled = false;
    listSel.innerHTML = `<option value="LIST::${esc(crm.slug)}">— Toda la carpeta (${crm.total.toLocaleString("es-ES")}) —</option>` +
      crm.lists.map((l) => `<option value="LIST::${esc(l.slug)}">📋 ${esc(l.name)} (${l.count.toLocaleString("es-ES")})</option>`).join("");
    hint.innerHTML = `Selecciona una lista de <strong>${esc(crm.name)}</strong>`;
    listSel.onchange();
  };

  /* Handler Lista change → muestra count */
  listSel.onchange = () => {
    const raw = listSel.value;
    if (!raw) return;
    const slug = raw.replace(/^LIST::/, "");
    const crm = _folders.find((f) => f.slug === crmSel.value);
    let name = ""; let count = 0;
    if (crm) {
      if (slug === crm.slug) { name = "toda la carpeta " + crm.name; count = crm.total; }
      else {
        const l = crm.lists.find((x) => x.slug === slug);
        if (l) { name = l.name + " (" + crm.name + ")"; count = l.count; }
      }
    }
    hint.innerHTML = `<strong style="color:var(--brand-red)">${count.toLocaleString("es-ES")}</strong> contactos en <strong>${esc(name)}</strong>`;
  };

  /* Si viene de clic en una lista, preseleccionar */
  const pending = window.__pendingListCampaign;
  if (pending) {
    /* Buscar CRM que contiene esa lista */
    const crm = _folders.find((f) => f.lists.some((l) => l.slug === pending.listSlug));
    if (crm) {
      crmSel.value = crm.slug;
      crmSel.onchange();
      listSel.value = "LIST::" + pending.listSlug;
      listSel.onchange();
      const nameInput = qs('#campaignForm input[name="name"]');
      if (nameInput && !nameInput.value) nameInput.value = pending.crmName + " — " + pending.listName;
    }
    window.__pendingListCampaign = null;
  }
};

/* Cargar carpetas al hacer click en el tab */
const foldersTab = qs('[data-tab="folders"]');
foldersTab?.addEventListener("click", () => { renderCrms(); });

/* Refrescar campanas al entrar a Estado campanas */
qs('[data-tab="campaignStatus"]')?.addEventListener("click", () => { refreshCampaigns(); });

/* Pobla selector jerarquico al entrar a Crear campana */
qs('[data-tab="campaigns"]')?.addEventListener("click", () => { populateCampaignListSelector(); });

/* ── Sheets sync UI ── */
sheetsSyncBtn?.addEventListener("click", async () => {
  sheetsSyncResult.textContent = "Sincronizando CRMs… esto puede tardar unos minutos.";
  try {
    const data = await api("/api/sheets/sync", { method: "POST" });
    sheetsSyncResult.textContent = data.status === "ok"
      ? `OK: ${data.totalContacts} contactos sincronizados en ${data.elapsedSeconds}s`
      : `Aviso: ${data.message}`;
    sheetsSyncJson.textContent = pretty(data);
    await refreshContacts();
    await refreshPanel();
  } catch (error) {
    sheetsSyncResult.textContent = `Error: ${error.message}`;
  }
});

sheetsStatusBtn?.addEventListener("click", async () => {
  try {
    const data = await api("/api/sheets/status");
    sheetsSyncJson.textContent = pretty(data);
  } catch (error) {
    sheetsSyncJson.textContent = `Error: ${error.message}`;
  }
});

/* ── CRM list UI ── */
const refreshSheetsList = async () => {
  const list = document.getElementById("sheetsList");
  const hint = document.getElementById("syncIntervalHint");
  if (!list) return;
  try {
    const data = await api("/api/sheets/status");
    if (hint) hint.textContent = `${data.intervalHours || 2}h`;
    const all = data.sheetIds || [];
    const env = new Set(data.envIds || []);
    const builtin = new Set(data.builtinIds || []);
    const extra = new Set(data.extraIds || []);
    if (all.length === 0) {
      list.innerHTML = '<em class="muted">Ningún CRM configurado.</em>';
      return;
    }
    list.innerHTML = all.map((id) => {
      const origin = env.has(id) ? '<span style="background:#e5e7eb;padding:2px 6px;border-radius:4px;font-size:11px">ENV</span>'
        : builtin.has(id) ? '<span style="background:#FFB74D;padding:2px 6px;border-radius:4px;font-size:11px">FIJO</span>'
        : '<span style="background:#fff;border:1px solid #E65100;color:#E65100;padding:2px 6px;border-radius:4px;font-size:11px">UI</span>';
      const canDelete = extra.has(id);
      const delBtn = canDelete ? `<button data-del-sheet="${id}" style="background:none;border:none;cursor:pointer;color:#E65100;font-size:14px" title="Quitar">✕</button>` : "";
      return `<div style="display:flex;align-items:center;gap:8px;padding:4px 0"><code style="font-size:11px;color:#333">${id}</code> ${origin} ${delBtn}</div>`;
    }).join("");
    list.querySelectorAll("[data-del-sheet]").forEach((b) => {
      b.addEventListener("click", async () => {
        if (!confirm("¿Quitar este CRM de la sincronización?")) return;
        try {
          await api(`/api/sheets/ids/${encodeURIComponent(b.dataset.delSheet)}`, { method: "DELETE" });
          await refreshSheetsList();
        } catch (e) { rubenCotonAlert({ title: "Algo salio mal", body: humanizeError(e), icon: "❌", tone: "error" }); }
      });
    });
  } catch (e) {
    /* P1 FIX 2026-05-07: esc() en mensajes de error */
    list.innerHTML = `<span style="color:#E65100">Error: ${esc(e.message)}</span>`;
  }
};

document.getElementById("addSheetBtn")?.addEventListener("click", async () => {
  const inp = document.getElementById("newSheetUrl");
  const val = (inp?.value || "").trim();
  if (!val) return;
  try {
    await api("/api/sheets/ids", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: val })
    });
    if (inp) inp.value = "";
    await refreshSheetsList();
  } catch (e) { rubenCotonAlert({ title: "Algo salio mal", body: humanizeError(e), icon: "❌", tone: "error" }); }
});

/* Cargar lista al abrir configuración */
qs('[data-tab="settings"]')?.addEventListener("click", () => { refreshSheetsList(); });
refreshSheetsList();

/* BLINDAJE: guard de inicialización única para no duplicar listeners si el
 * script se carga dos veces (hot reload, SPA double init). */
if (!window.__rubencotonInitDone) {
  window.__rubencotonInitDone = true;
  init();
  /* P0 FIX 2026-05-06 (servidor se saturaba): bajar de 8s a 15s para
   * QUICK refresh. El endpoint /api/panel devuelve el dashboard completo
   * que es muy pesado. 8s saturaba CPU del container. 15s da balance
   * entre responsividad y carga. */
  const REFRESH_INTERVAL_MS = 15000;
  const QUICK_REFRESH_INTERVAL_MS = 15000;
  /* Refresh pesado (campañas + setup) — cada 60s suficiente */
  const HEAVY_REFRESH_INTERVAL_MS = 60000;
  let _heavyRefreshAt = 0;
  setInterval(async () => {
    /* BLINDAJE: no refrescar si la pestaña está oculta (ahorra red/CPU). */
    if (typeof document !== "undefined" && document.hidden) return;
    try {
      /* Quick refresh: KPIs (incluye cap.used, currentRate, queueSize, dashboard) */
      await refreshPanel();
      /* Heavy refresh solo cada 30s (lista campañas, setup) */
      const now = Date.now();
      if (now - _heavyRefreshAt >= HEAVY_REFRESH_INTERVAL_MS) {
        _heavyRefreshAt = now;
        await refreshCampaigns();
        await refreshSetupChecklist();
      }
    } catch (_error) {
      // no-op
    }
  }, QUICK_REFRESH_INTERVAL_MS);

  /* BLINDAJE: prevenir que el navegador navegue a file:// si el usuario
   * arrastra un archivo fuera del dropzone (destruiría el estado en memoria
   * de campañas en borrador, adjuntos pendientes, etc.). */
  window.addEventListener("dragover", (e) => { e.preventDefault(); }, false);
  window.addEventListener("drop", (e) => { e.preventDefault(); }, false);
}

/* =========================================================
 * DRAG & DROP de archivos HTML sobre los editores
 * Soporta tanto plantillas (tpl) como campañas (camp).
 * ========================================================= */
function setupHtmlDropzone(zone) {
  if (!zone || zone.__dropzoneBound) return;
  zone.__dropzoneBound = true;
  const which = zone.getAttribute("data-html-dropzone");
  const editor = document.getElementById(which === "camp" ? "campHtmlEditor" : "tplHtmlEditor");
  const info = document.getElementById(which === "camp" ? "campHtmlFileInfo" : "tplHtmlFileInfo");
  if (!editor) return;
  const loadHtmlFile = (file) => {
    if (!file) return;
    if (!/\.(html?|htm)$/i.test(file.name.toLowerCase())) {
      if (info) info.textContent = "Error: solo archivos .html o .htm";
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      if (info) info.textContent = "Error: el archivo supera 2 MB";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || "");
      editor.value = content;
      editor.dispatchEvent(new Event("input"));
      if (info) {
        const kb = (file.size / 1024).toFixed(1);
        info.textContent = `✓ ${file.name} (${kb} KB) cargado.`;
      }
    };
    reader.onerror = () => { if (info) info.textContent = "Error al leer el archivo"; };
    reader.readAsText(file, "UTF-8");
  };
  ["dragenter", "dragover"].forEach((ev) => {
    zone.addEventListener(ev, (e) => {
      if (!e.dataTransfer) return;
      if (Array.from(e.dataTransfer.types || []).includes("Files")) {
        e.preventDefault();
        e.stopPropagation();
        zone.classList.add("is-dragover");
      }
    });
  });
  ["dragleave", "drop"].forEach((ev) => {
    zone.addEventListener(ev, (e) => {
      if (ev === "dragleave" && e.target !== zone && zone.contains(e.target)) return;
      zone.classList.remove("is-dragover");
    });
  });
  zone.addEventListener("drop", (e) => {
    if (!e.dataTransfer) return;
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) loadHtmlFile(file);
  });
}
document.querySelectorAll(".html-dropzone").forEach(setupHtmlDropzone);

/* =========================================================
 * HANDLERS: subir a Drive / sincronizar / informes semanal-mensual
 * ========================================================= */
function toast(msg, type) {
  const host = qs("#campaignResult") || document.body;
  const color = type === "err" ? "#E65100" : type === "ok" ? "#0b7a3b" : "#BF360C";
  if (host.id === "campaignResult") {
    host.innerHTML = `<span style="color:${color}">${msg}</span>`;
  } else {
    console.log(msg);
  }
}

document.addEventListener("click", async (e) => {
  const btnDrive = e.target.closest && e.target.closest("[data-upload-drive]");
  if (btnDrive) {
    const id = btnDrive.getAttribute("data-upload-drive");
    const orig = btnDrive.textContent;
    btnDrive.disabled = true;
    btnDrive.textContent = "☁ Subiendo…";
    try {
      const r = await fetch(`/api/campaigns/${encodeURIComponent(id)}/upload-to-drive`, { method: "POST", credentials: "include" });
      const j = await r.json();
      if (!r.ok || j.status !== "ok") throw new Error(j.message || "Error");
      btnDrive.textContent = "✓ Subido";
      if (typeof refreshCampaigns === "function") setTimeout(refreshCampaigns, 600);
    } catch (err) {
      btnDrive.textContent = "❌ Error";
      rubenCotonAlert({ title: "No se pudo subir al Drive", body: humanizeError(err), icon: "❌", tone: "error" });
    } finally {
      setTimeout(() => { btnDrive.disabled = false; btnDrive.textContent = orig; }, 1800);
    }
    return;
  }
});

qs("#btn-sync-drive")?.addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  if (!confirm("¿Sincronizar TODAS las campañas al Drive de manager@rubencoton.com?\n\nPuede tardar varios segundos.")) return;
  const orig = btn.textContent;
  btn.disabled = true;
  btn.textContent = "☁ Sincronizando…";
  try {
    const r = await fetch("/api/campaigns/sync-all-to-drive", { method: "POST", credentials: "include" });
    const j = await r.json();
    if (!r.ok || j.status !== "ok") throw new Error(j.message || "Error");
    rubenCotonAlert({ title: "Sincronización completada", body: `Subidas: <strong>${j.uploaded || 0}</strong> de ${j.total || 0}.<br>Carpeta: ${j.rootFolderLink || "(ver Drive)"}`, icon: "✅", tone: "success" });
    if (typeof refreshCampaigns === "function") refreshCampaigns();
  } catch (err) {
    rubenCotonAlert({ title: "No se pudo sincronizar", body: humanizeError(err), icon: "❌", tone: "error" });
  } finally {
    btn.disabled = false;
    btn.textContent = orig;
  }
});

qs("#btn-report-weekly")?.addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  const orig = btn.textContent;
  btn.disabled = true;
  btn.textContent = "📅 Generando…";
  try {
    const r = await fetch("/api/reports/weekly/run-now", { method: "POST", credentials: "include" });
    const j = await r.json();
    if (!r.ok || j.status !== "ok") throw new Error(j.message || "Error");
    rubenCotonAlert({ title: "Informe semanal listo", body: j.drive ? `Subido al Drive:<br><a href="${j.drive.folderLink}" target="_blank" style="color:#FF6B00">Ver carpeta</a>` : "Guardado en el servidor.", icon: "📅", tone: "success" });
  } catch (err) {
    rubenCotonAlert({ title: "No se pudo generar el informe semanal", body: humanizeError(err), icon: "❌", tone: "error" });
  } finally {
    btn.disabled = false;
    btn.textContent = orig;
  }
});

qs("#btn-report-monthly")?.addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  const orig = btn.textContent;
  btn.disabled = true;
  btn.textContent = "🗓 Generando…";
  try {
    const r = await fetch("/api/reports/monthly/run-now", { method: "POST", credentials: "include" });
    const j = await r.json();
    if (!r.ok || j.status !== "ok") throw new Error(j.message || "Error");
    rubenCotonAlert({ title: "Informe mensual listo", body: j.drive ? `Subido al Drive:<br><a href="${j.drive.folderLink}" target="_blank" style="color:#FF6B00">Ver carpeta</a>` : "Guardado en el servidor.", icon: "🗓", tone: "success" });
  } catch (err) {
    rubenCotonAlert({ title: "No se pudo generar el informe mensual", body: humanizeError(err), icon: "❌", tone: "error" });
  } finally {
    btn.disabled = false;
    btn.textContent = orig;
  }
});

/* ─── Indicador PC LOCAL ON/OFF (refactor 3 capas 2026-04-25) ───
 * Pollea /api/local-agent/status cada 30s y actualiza el indicador
 * del sidebar (verde=online, rojo=offline, gris=desactivado). */
(function setupLocalAgentIndicator() {
  const el = document.getElementById("localAgentStatus");
  if (!el) return;
  const dot = el.querySelector(".side-agent-dot");
  const label = el.querySelector(".side-agent-label");

  /* P0 fix 2026-05-04 (UX): el usuario reportó confusión con "PC: desactivado".
   * Reescrito con texto más claro + tooltip explicando que la app FUNCIONA
   * sin el PC (cascada cloud 8 providers). */
  async function refresh() {
    try {
      const r = await fetch("/api/local-agent/status", { credentials: "include" });
      const j = await r.json();
      if (!j || j.status !== "ok") {
        el.dataset.state = "disabled";
        if (label) label.textContent = "IA cloud activa";
        el.title = "Aviso al consultar PC. La IA cloud (8 cerebros) funciona normal.";
        return;
      }
      if (!j.enabled) {
        el.dataset.state = "disabled";
        if (label) label.textContent = "IA: solo cloud";
        el.title = "PC local NO conectado. La aplicación usa cascada IA cloud:\n" +
          "SambaNova, NVIDIA, Cerebras, Mistral, OpenRouter, Groq, Gemini.\n\n" +
          "Para activar PC + Qwen 2.5 14B local (RTX 4070):\n" +
          "1. En tu PC: doble-clic en RUBEN-COTON_HTML\\Iniciar-Server.bat\n" +
          "2. Espera 1 min y refresca esta página.";
        return;
      }
      if (j.online) {
        el.dataset.state = "online";
        const m = j.meta || {};
        const ago = (j.secondsAgo == null) ? "?" : `${j.secondsAgo}s`;
        if (label) label.textContent = `IA: PC + cloud`;
        el.title = `IA local activa (Qwen 2.5 14B en RTX 4070).\n` +
          `Último ping hace ${ago} · ${m.hostname || "?"} · ${m.ollamaModel || ""}` +
          (m.ollamaReady === false ? "\n⚠ Ollama no listo todavía." : "");
      } else {
        el.dataset.state = "offline";
        if (label) label.textContent = "IA: solo cloud";
        el.title = "PC local apagado o sin red. La aplicación usa cascada IA cloud:\n" +
          "SambaNova, NVIDIA, Cerebras, Mistral, OpenRouter, Groq, Gemini.\n\n" +
          "Para arrancar PC: doble-clic en RUBEN-COTON_HTML\\Iniciar-Server.bat";
      }
    } catch (_e) {
      el.dataset.state = "disabled";
      if (label) label.textContent = "IA cloud activa";
    }
  }

  refresh();
  setInterval(refresh, 30_000);
})();
