
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
    /* Fetch fallo por red (timeout, conexion rota, cold start). Reintentar. */
    if (retryCount < MAX_RETRIES) {
      const delayMs = 1000 * Math.pow(2, retryCount); /* 1s, 2s, 4s */
      await new Promise((r) => setTimeout(r, delayMs));
      return api(url, options, retryCount + 1);
    }
    throw new Error("Sin conexion. Verifica tu Wi-Fi y reintenta.");
  }

  if (response.status === 401) {
    window.location.href = "/login";
    throw new Error("No autorizado");
  }

  /* Cold start del backend devuelve 502/503/504 mientras arranca. Reintentar. */
  if ([502, 503, 504].includes(response.status) && retryCount < MAX_RETRIES) {
    const delayMs = 1500 * Math.pow(2, retryCount);
    await new Promise((r) => setTimeout(r, delayMs));
    return api(url, options, retryCount + 1);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "Error de API");
  }

  return data;
};

const activateTab = (tabId) => {
  tabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.tab === tabId);
  });
  tabPanels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.panel === tabId);
  });
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

const renderTemplates = (templates) => {
  const tplStatusLabels = { borrador: "Borrador", validado: "Validado" };

  templatesTableBody.innerHTML = templates
    .map((template) => {
      const status = template.status || "borrador";
      const label = tplStatusLabels[status] || status;
      const fechaBase = template.updatedAt || template.createdAt;
      const fecha = fechaBase ? new Date(fechaBase).toLocaleString("es-ES") : "-";
      const isValidado = status === "validado";
      const validateBtn = isValidado
        ? `<button class="btn-sm btn-warn" onclick="tplUnvalidate('${template.id}')" title="Volver a borrador">↩ Desvalidar</button>`
        : `<button class="btn-sm btn-success" onclick="tplValidate('${template.id}')" title="Marcar como listo para usar">✓ Validar</button>`;
      return `
      <tr>
        <td><a href="javascript:void(0)" class="tpl-name-link" onclick="tplPreview('${template.id}')" title="Ver cómo queda este borrador"><strong>${esc(template.name)}</strong></a></td>
        <td>${esc(template.subject)}</td>
        <td><span class="status-pill status-${esc(status)}">${esc(label)}</span></td>
        <td style="font-size:0.85rem;color:#666">${fecha}</td>
        <td class="tpl-actions">
          <button class="btn-sm" onclick="tplPreview('${template.id}')" title="Ver cómo queda">👁 Ver</button>
          <button class="btn-sm" onclick="tplEdit('${template.id}')" title="Editar contenido">✎ Editar</button>
          ${validateBtn}
          <button class="btn-sm btn-danger" onclick="tplDelete('${template.id}','${esc(template.name).replace(/'/g, "\\'")}')" title="Eliminar borrador">🗑</button>
        </td>
      </tr>
    `;
    })
    .join("");

  /* TODOS los borradores (validados y no validados) aparecen en los
   * selectores de campana y workflow. El estado se indica en la etiqueta
   * con un prefijo visual [✓ VALIDADO] o [✎ BORRADOR] para que el
   * usuario sepa cual esta revisada sin bloquear el uso de borradores. */
  const labelForSelect = (item) => {
    const status = item.status || "borrador";
    const mark = status === "validado" ? "✓ VALIDADO" : "✎ BORRADOR";
    return `[${mark}] ${item.name} | ${item.subject}`;
  };

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

window.tplPreview = async (id) => {
  try {
    const data = await api(`/api/templates/${id}`);
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
    rubenCotonAlert({ title: "No se pudo previsualizar", body: humanizeError(e), icon: "❌", tone: "error" });
  }
};

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

window.tplDelete = async (id, name) => {
  if (!confirm(`¿Borrar el borrador "${name}"? Esta acción no se puede deshacer.`)) return;
  try {
    await api(`/api/templates/${id}`, { method: "DELETE" });
    await refreshSyncAndRender();
  } catch (e) { rubenCotonAlert({ title: "No se pudo borrar", body: humanizeError(e), icon: "❌", tone: "error" }); }
};

window.tplEdit = async (id) => {
  try {
    const data = await api(`/api/templates/${id}`);
    const t = data.template;
    if (!t) throw new Error("Plantilla no encontrada");

    /* Cargar datos en el formulario */
    const editingIdEl = qs("#templateEditingId");
    const editBannerEl = qs("#templateEditBanner");
    const submitBtn = qs("#templateSubmitBtn");
    const nameInput = templateForm?.querySelector('input[name="name"]');
    const subjectInput = templateForm?.querySelector('input[name="subject"]');
    const textInput = templateForm?.querySelector('textarea[name="text"]');

    if (editingIdEl) editingIdEl.value = t.id;
    if (editBannerEl) editBannerEl.style.display = "flex";
    if (submitBtn) submitBtn.textContent = "Actualizar borrador";
    if (nameInput) nameInput.value = t.name || "";
    if (subjectInput) subjectInput.value = t.subject || "";
    if (tplHtmlEditor) tplHtmlEditor.value = t.html || "";
    if (textInput) textInput.value = t.text || "";

    /* Cambiar a tab Código HTML para que el usuario vea qué está editando */
    const codeTab = qs('.tpl-tab[data-tpl-view="code"]');
    if (codeTab) codeTab.click();

    /* Scroll suave al formulario */
    templateForm?.scrollIntoView({ behavior: "smooth", block: "start" });

    /* Actualizar preview si hay cualquier binding */
    tplHtmlEditor?.dispatchEvent(new Event("input"));
  } catch (e) {
    rubenCotonAlert({ title: "No se pudo cargar el borrador", body: humanizeError(e), icon: "❌", tone: "error" });
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
  if (submitBtn) submitBtn.textContent = "Guardar borrador";
  templateForm?.reset();
  if (tplHtmlEditor) tplHtmlEditor.value = "";
  tplHtmlEditor?.dispatchEvent(new Event("input"));
});

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
const campaignsSortState = window.__campaignsSortState || (window.__campaignsSortState = { key: null, dir: "desc" });
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

const renderCampaigns = (campaigns) => {
  initCampaignSortListener();
  if (campaignsSortState.key && Array.isArray(campaigns)) {
    const dir = campaignsSortState.dir === "desc" ? -1 : 1;
    campaigns = [...campaigns].sort((a, b) => {
      const va = campaignSortValue(a, campaignsSortState.key);
      const vb = campaignSortValue(b, campaignsSortState.key);
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
  const evalMetric = (kind, value, base) => {
    const pct = base > 0 ? (value / base) * 100 : 0;
    let label, cls;
    if (kind === "sent") {
      if (pct >= 75) { label = "CASI HECHO"; cls = "ok"; }
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
  const cellMetric = (n, kind, value, base) => {
    const e = evalMetric(kind, value, base);
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
      return `
      <tr>
        <td style="text-align:center;vertical-align:middle;font-weight:900;color:#FF6B00;letter-spacing:0.5px;font-size:13px">#${numLabel}</td>
        <td style="vertical-align:middle">
          <strong>${esc(c.name)}</strong>
          <div style="font-size:10.5px;color:#64748b;margin-top:3px;line-height:1.4">
            <span title="Fecha y hora de lanzamiento">▶ ${inicioStr}</span>
            &nbsp;·&nbsp;
            <span title="Fecha y hora de finalizacion">■ ${finStr}</span>
          </div>
        </td>
        <td style="text-align:center;vertical-align:middle">${statusBadge(c.status, c.queuePosition)}</td>
        <td style="text-align:center;vertical-align:middle;font-size:22px;font-weight:900;color:#111;letter-spacing:-0.5px">${total.toLocaleString("es-ES")}</td>
        <td style="vertical-align:middle">${cellMetric(sent, "sent", sent, total)}</td>
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
    const evalRate = (kind, pct) => {
      if (kind === "sent") {
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

    /* ---- 2) TABLA INDIVIDUAL CON PORCENTAJES + ETIQUETAS ----
     * PETICION USUARIO 2026-05-05 (segunda iteración): alturas fijas en
     * cada bloque (16/26/20px) para alinear horizontalmente entre filas
     * (igual patrón que en la pestaña "Estado campañas"). Aunque la celda
     * "Campaña" tenga texto multilínea, los números, porcentajes y
     * etiquetas siempre están a la misma altura. */
    const cellMetric = (kind, num, base) => {
      const pct = pctOf(num, base);
      const e = evalRate(kind, pct);
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
            return `
              <tr style="border-bottom:1px solid #f1f5f9">
                <td style="padding:10px 6px;vertical-align:middle;text-align:center;font-weight:900;color:#FF6B00;font-size:13px;letter-spacing:0.5px">#${numLabelI}</td>
                <td style="padding:10px 6px;vertical-align:middle">
                  <strong>${esc(c.name || "(sin nombre)")}</strong>
                  <div class="muted" style="font-size:10.5px;margin-top:3px;line-height:1.4">▶ ${inicioI} · ■ ${finI}</div>
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
                ${cellMetric("sent",   sent,    total)}
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

    dashActivity.innerHTML = summaryBlock + tableBlock;
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
    appendChatMsg("user", `<p>${msg}</p>${currentSelection ? `<small style="opacity:.75">📌 Sobre: "${currentSelection.slice(0,80)}…"</small>` : ""}`);
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
        appendChatMsg("bot", `<p>✅ Listo. He actualizado el email (<em>${r.providerName || r.provider || "IA"}</em>).</p>${r.note ? `<p>${r.note}</p>` : ""}`);
      } else if (r.reply) {
        appendChatMsg("bot", `<p>${r.reply}</p>`);
      } else {
        appendChatMsg("bot", `<p>Hmm, no he conseguido respuesta. Prueba a reformular.</p>`);
      }
      currentSelection = null;
      chatSelected.style.display = "none";
    } catch (e) {
      chatHistory.removeChild(chatHistory.lastChild);
      appendChatMsg("bot", `<p style="color:#fee">❌ Error: ${e.message}</p>`);
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

/* ── Template editor: tabs + live preview ── */
(() => {
  const tabs = qsa(".tpl-tab");
  const views = { code: qs("#tplCodeView"), preview: qs("#tplPreviewView"), text: qs("#tplTextView"), ai: qs("#tplAiView") };

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("is-active"));
      Object.values(views).forEach((v) => v?.classList.remove("is-active"));
      tab.classList.add("is-active");
      const target = tab.dataset.tplView;
      views[target]?.classList.add("is-active");
      if (target === "preview") updateTplPreview();
    });
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
  templateResult.textContent = editingId ? "Actualizando borrador…" : "Guardando borrador…";
  const formData = new FormData(templateForm);
  const payload = {
    name: String(formData.get("name") || "").trim(),
    subject: String(formData.get("subject") || "").trim(),
    html: String(formData.get("html") || "").trim(),
    text: String(formData.get("text") || "").trim()
  };

  try {
    if (editingId) {
      await api(`/api/templates/${editingId}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      templateResult.textContent = "OK: borrador actualizado (pasa a estado borrador para revalidar)";
    } else {
      await api("/api/templates", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      templateResult.textContent = "OK: borrador guardado. Revisa y pulsa 'Validar' para usarlo en campañas.";
    }

    /* Reset + salir de modo edición */
    qs("#templateEditCancel")?.click();
    await refreshTemplates();
  } catch (error) {
    templateResult.textContent = `Error: ${error.message}`;
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

campaignForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  /* Detectar accion: draft (guardar sin enviar) o send (guardar + lanzar) */
  const action = event.submitter?.value === "send" ? "send" : "draft";

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

    await refreshPanel();
    await Promise.all([
      refreshContacts(),
      refreshTemplates(),
      refreshSegments(),
      refreshCampaigns(),
      refreshWorkflows(),
      refreshSetupChecklist()
    ]);
  } catch (error) {
    dashboardJsonEl.textContent = `Error inicial: ${error.message}`;
  }
};

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
    list.innerHTML = `<span style="color:#E65100">Error: ${e.message}</span>`;
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
  const REFRESH_INTERVAL_MS = 30000;
  setInterval(async () => {
    /* BLINDAJE: no refrescar si la pestaña está oculta (ahorra red/CPU). */
    if (typeof document !== "undefined" && document.hidden) return;
    try {
      await refreshPanel();
      await refreshCampaigns();
      await refreshSetupChecklist();
    } catch (_error) {
      // no-op
    }
  }, REFRESH_INTERVAL_MS);

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
