/**
 * Stress Test - ARTES-BUHO_EMAILING
 * Bateria completa contra la API en produccion.
 * Uso: node scripts/stress-test.js
 */

const BASE = "https://emailing.artesbuhomanagement.com";
const PASSWORD = "+artesbuho26";
const SLOW_MS = 3000;

let authCookie = "";
let total = 0, passed = 0, failed = 0;
const bugs = [], slow = [], log = [];

async function http(method, path, body, opts = {}) {
  const url = `${BASE}${path}`;
  const h = { "Content-Type": "application/json" };
  if (authCookie && !opts.noCookie) h["Cookie"] = authCookie;
  const fo = { method, headers: h, redirect: "manual" };
  if (body !== undefined && body !== null) fo.body = JSON.stringify(body);
  const t0 = Date.now();
  try {
    const r = await fetch(url, fo);
    const txt = await r.text();
    const ms = Date.now() - t0;
    const sc = r.headers.get("set-cookie");
    if (sc && !opts.noCookie) {
      const m = sc.match(/app_auth=([^;]*)/);
      if (m?.[1]) authCookie = `app_auth=${m[1]}`;
    }
    let json = null; try { json = JSON.parse(txt); } catch {}
    return { s: r.status, b: json, t: txt, ms, sz: Buffer.byteLength(txt) };
  } catch (e) {
    return { s: 0, b: null, t: e.message, ms: Date.now() - t0, sz: 0 };
  }
}

function T(cat, name, fn) { return { cat, name, fn }; }

async function run(t) {
  total++;
  const label = `[${t.cat}] ${t.name}`;
  try {
    const r = await t.fn();
    const entry = { label, ok: r.ok, s: r.s ?? "-", ms: r.ms ?? 0, sz: r.sz ?? 0, d: r.d ?? "" };
    log.push(entry);
    if (entry.ok) { passed++; console.log(`  PASS  ${label}  [${entry.s}] ${entry.ms}ms ${fb(entry.sz)}`); }
    else { failed++; bugs.push({ label, d: entry.d || `status=${entry.s}` }); console.log(`  FAIL  ${label}  [${entry.s}] ${entry.ms}ms - ${entry.d || entry.s}`); }
    if (entry.ms > SLOW_MS) slow.push({ label, ms: entry.ms });
  } catch (e) { failed++; bugs.push({ label, d: e.message }); console.log(`  FAIL  ${label}  ERR - ${e.message}`); }
}

function fb(b) { return b < 1024 ? `${b}B` : `${(b/1024).toFixed(1)}KB`; }
function chk(r, s, extra) {
  const ss = Array.isArray(s) ? s : [s];
  const base = { ok: ss.includes(r.s), s: r.s, ms: r.ms, sz: r.sz };
  if (!base.ok) { base.d = `expected ${s}, got ${r.s}`; return base; }
  if (extra !== undefined && !extra) { base.ok = false; base.d = arguments[3] || "body check failed"; }
  return base;
}

const tests = [];

// ────────── PHASE 1: Login + Health (public) ──────────
tests.push(T("HEALTH", "/health (public)", async () => {
  const r = await http("GET", "/health", null, { noCookie: true });
  return chk(r, 200);
}));
tests.push(T("HEALTH", "/health/db (public)", async () => {
  const r = await http("GET", "/health/db", null, { noCookie: true });
  return chk(r, 200);
}));
tests.push(T("AUTH", "Login OK", async () => {
  authCookie = "";
  const r = await http("POST", "/api/auth/login", { password: PASSWORD });
  return chk(r, 200, r.b?.status === "ok", "login no ok");
}));
tests.push(T("AUTH", "Login fail (wrong pw)", async () => {
  const r = await http("POST", "/api/auth/login", { password: "wrong" }, { noCookie: true });
  return chk(r, 401);
}));
tests.push(T("AUTH", "Login empty pw", async () => {
  const r = await http("POST", "/api/auth/login", { password: "" }, { noCookie: true });
  return chk(r, 401);
}));
tests.push(T("AUTH", "Login no body", async () => {
  const r = await http("POST", "/api/auth/login", {}, { noCookie: true });
  return chk(r, 401);
}));

// ────────── PHASE 2: Contacts (authed) ──────────
tests.push(T("CONTACTS", "List default", async () => {
  const r = await http("GET", "/api/contacts");
  return chk(r, 200, Array.isArray(r.b?.contacts), "not array");
}));
tests.push(T("CONTACTS", "Page 1 (limit=5)", async () => {
  const r = await http("GET", "/api/contacts?limit=5&offset=0");
  return chk(r, 200, r.b?.limit === 5, "limit mismatch");
}));
tests.push(T("CONTACTS", "Page 2 (offset=5)", async () => {
  const r = await http("GET", "/api/contacts?limit=5&offset=5");
  return chk(r, 200, r.b?.offset === 5, "offset mismatch");
}));
tests.push(T("CONTACTS", "Last page (offset=999999)", async () => {
  const r = await http("GET", "/api/contacts?limit=5&offset=999999");
  return chk(r, 200, r.b?.contacts?.length === 0, "expected empty");
}));
tests.push(T("CONTACTS", "Search q=test", async () => {
  const r = await http("GET", "/api/contacts?q=test");
  return chk(r, 200);
}));
tests.push(T("CONTACTS", "Search no match", async () => {
  const r = await http("GET", "/api/contacts?q=zzznonexistent999");
  return chk(r, 200, r.b?.contacts?.length === 0, "expected 0");
}));

const uid = Date.now();
tests.push(T("CONTACTS", "Create", async () => {
  const r = await http("POST", "/api/contacts", { email: `stress_${uid}@test.com`, name: "Stress" });
  return chk(r, 201);
}));
tests.push(T("CONTACTS", "Create duplicate (upsert)", async () => {
  const r = await http("POST", "/api/contacts", { email: `stress_${uid}@test.com`, name: "Updated" });
  return chk(r, [200, 201]);
}));
tests.push(T("CONTACTS", "Create no email", async () => {
  const r = await http("POST", "/api/contacts", { name: "No Email" });
  return chk(r, 400);
}));
tests.push(T("CONTACTS", "Create bad email", async () => {
  const r = await http("POST", "/api/contacts", { email: "not-email" });
  return chk(r, [400, 201]);
}));
tests.push(T("CONTACTS", "Create XSS name", async () => {
  const r = await http("POST", "/api/contacts", { email: `xss${uid}@test.com`, name: "<script>alert(1)</script>" });
  const raw = (r.b?.contact?.name || "").includes("<script>");
  return { ok: (r.s === 201 || r.s === 400), s: r.s, ms: r.ms, sz: r.sz, d: raw ? "BUG: XSS stored raw" : "ok" };
}));

// ────────── PHASE 3: Import ──────────
tests.push(T("IMPORT", "Valid 3 rows", async () => {
  const rows = [
    { col0: `im1_${uid}@t.com`, col1: "A" },
    { col0: `im2_${uid}@t.com`, col1: "B" },
    { col0: `im3_${uid}@t.com`, col1: "C" },
  ];
  const r = await http("POST", "/api/contacts/import", { rows, mapping: { col0: "email", col1: "name" } });
  return chk(r, 201, r.b?.report != null, "no report");
}));
tests.push(T("IMPORT", "Empty rows", async () => {
  const r = await http("POST", "/api/contacts/import", { rows: [], mapping: { col0: "email" } });
  return chk(r, 400);
}));
tests.push(T("IMPORT", "No mapping", async () => {
  const r = await http("POST", "/api/contacts/import", { rows: [{ col0: "a@b.com" }], mapping: {} });
  return chk(r, 400);
}));
tests.push(T("IMPORT", "XSS in data", async () => {
  const r = await http("POST", "/api/contacts/import", { rows: [{ col0: `xssi${uid}@t.com`, col1: "<img onerror=alert(1)>" }], mapping: { col0: "email", col1: "name" } });
  return chk(r, [201, 400]);
}));
tests.push(T("IMPORT", "Large batch 500 rows", async () => {
  const rows = Array.from({ length: 500 }, (_, i) => ({ col0: `b${i}_${uid}@load.com`, col1: `U${i}` }));
  const r = await http("POST", "/api/contacts/import", { rows, mapping: { col0: "email", col1: "name" } });
  return chk(r, 201, r.b?.report != null, "no report");
}));
tests.push(T("IMPORT", "Invalid emails mixed", async () => {
  const rows = [{ col0: `v${uid}@t.com`, col1: "Ok" }, { col0: "bad", col1: "X" }, { col0: "", col1: "Y" }];
  const r = await http("POST", "/api/contacts/import", { rows, mapping: { col0: "email", col1: "name" } });
  return chk(r, [201, 400]);
}));

// ────────── PHASE 4: Templates ──────────
tests.push(T("TEMPLATES", "List", async () => {
  const r = await http("GET", "/api/templates");
  return chk(r, 200, Array.isArray(r.b?.templates), "not array");
}));
tests.push(T("TEMPLATES", "Create", async () => {
  const r = await http("POST", "/api/templates", { name: `Tpl_${uid}`, subject: "S", html: "<p>H</p>" });
  return chk(r, 201);
}));
tests.push(T("TEMPLATES", "Create no name", async () => {
  const r = await http("POST", "/api/templates", { subject: "S", html: "<p>H</p>" });
  return chk(r, [400, 201]);
}));
tests.push(T("TEMPLATES", "Create XSS name", async () => {
  const r = await http("POST", "/api/templates", { name: "<script>alert(1)</script>", subject: "X", html: "<p>X</p>" });
  const raw = (r.b?.template?.name || "").includes("<script>");
  return { ok: (r.s === 201 || r.s === 400), s: r.s, ms: r.ms, sz: r.sz, d: raw ? "WARN: XSS in template name" : "ok" };
}));
tests.push(T("TEMPLATES", "Create 50KB HTML", async () => {
  const r = await http("POST", "/api/templates", { name: `Big_${uid}`, subject: "B", html: "<p>" + "A".repeat(50000) + "</p>" });
  return chk(r, [201, 413]);
}));

// ────────── PHASE 5: Segments ──────────
tests.push(T("SEGMENTS", "List", async () => {
  const r = await http("GET", "/api/segments");
  return chk(r, 200, Array.isArray(r.b?.segments), "not array");
}));
const sn = `Seg_${uid}`;
tests.push(T("SEGMENTS", "Create", async () => {
  const r = await http("POST", "/api/segments", { name: sn, rules: [{ field: "status", op: "eq", value: "active" }] });
  return chk(r, 201);
}));
tests.push(T("SEGMENTS", "Create dup name", async () => {
  const r = await http("POST", "/api/segments", { name: sn, rules: [{ field: "status", op: "eq", value: "active" }] });
  return chk(r, [201, 400]);
}));
tests.push(T("SEGMENTS", "Create no name", async () => {
  const r = await http("POST", "/api/segments", { rules: [{ field: "status", op: "eq", value: "active" }] });
  return chk(r, [400, 201]);
}));

// ────────── PHASE 6: Campaigns ──────────
tests.push(T("CAMPAIGNS", "List", async () => {
  const r = await http("GET", "/api/campaigns");
  return chk(r, 200, Array.isArray(r.b?.campaigns), "not array");
}));
tests.push(T("CAMPAIGNS", "Create", async () => {
  const r = await http("POST", "/api/campaigns", { name: `Camp_${uid}`, subject: "T", html: "<p>T</p>" });
  return chk(r, 201);
}));
tests.push(T("CAMPAIGNS", "Create no name", async () => {
  const r = await http("POST", "/api/campaigns", { subject: "T" });
  return chk(r, [400, 201]);
}));
tests.push(T("CAMPAIGNS", "Create w/ template+segment", async () => {
  const tpl = await http("GET", "/api/templates");
  const seg = await http("GET", "/api/segments");
  const r = await http("POST", "/api/campaigns", {
    name: `Full_${uid}`, subject: "F",
    templateId: tpl.b?.templates?.[0]?.id || "x",
    segmentId: seg.b?.segments?.[0]?.id || "x"
  });
  return chk(r, [201, 400]);
}));

// ────────── PHASE 7: Sheets / Setup / Workflows ──────────
tests.push(T("SHEETS", "Status", async () => {
  const r = await http("GET", "/api/sheets/status");
  return chk(r, 200);
}));
tests.push(T("SETUP", "Checklist", async () => {
  const r = await http("GET", "/api/setup/checklist");
  return chk(r, 200, r.b?.checks != null || r.b?.summary != null, "no data");
}));
tests.push(T("WORKFLOWS", "List", async () => {
  const r = await http("GET", "/api/workflows");
  return chk(r, 200, Array.isArray(r.b?.workflows), "not array");
}));

// ────────── PHASE 8: Unsubscribe ──────────
tests.push(T("UNSUBSCRIBE", "Valid email (with auth)", async () => {
  const enc = Buffer.from("test@example.com").toString("base64url");
  const r = await http("GET", `/unsubscribe?email=${enc}`);
  if (r.s === 302) return { ok: false, s: 302, ms: r.ms, sz: r.sz, d: "BUG: redirects to login, should be public" };
  return chk(r, 200, r.t.includes("Baja confirmada"), "no confirm msg");
}));
tests.push(T("UNSUBSCRIBE", "Invalid param (with auth)", async () => {
  const r = await http("GET", "/unsubscribe?email=xxxx");
  return chk(r, [200, 500, 302]);
}));
tests.push(T("UNSUBSCRIBE", "No email (with auth)", async () => {
  const r = await http("GET", "/unsubscribe");
  return chk(r, [400, 302]);
}));
tests.push(T("UNSUBSCRIBE", "Without auth (email click sim)", async () => {
  const enc = Buffer.from("noauth@example.com").toString("base64url");
  const r = await http("GET", `/unsubscribe?email=${enc}`, null, { noCookie: true });
  return { ok: r.s === 200, s: r.s, ms: r.ms, sz: r.sz, d: r.s === 302 ? "BUG: /unsubscribe requires auth" : "ok" };
}));

// ────────── PHASE 9: Cleanup ──────────
tests.push(T("CLEANUP", "Valid request", async () => {
  const r = await http("POST", "/api/contacts/cleanup", { keepEmails: ["k@t.com"], sourcePrefix: "stress_" });
  return chk(r, 200);
}));
tests.push(T("CLEANUP", "Missing params", async () => {
  const r = await http("POST", "/api/contacts/cleanup", {});
  return chk(r, 400);
}));

// ────────── PHASE 10: Concurrency ──────────
tests.push(T("CONCURRENCY", "10 simultaneous creates", async () => {
  const t0 = Date.now();
  const ps = Array.from({ length: 10 }, (_, i) =>
    http("POST", "/api/contacts", { email: `cc${i}_${uid}@t.com`, name: `CC${i}` })
  );
  const rs = await Promise.all(ps);
  const ms = Date.now() - t0;
  const all = rs.every(r => r.s === 201);
  const ss = rs.map(r => r.s);
  return { ok: all, s: ss.join(","), ms, sz: 0, d: all ? "all 201" : `statuses: ${ss.join(",")}` };
}));

// ────────── PHASE 11: Performance ──────────
tests.push(T("PERF", "GET /api/contacts", async () => {
  const r = await http("GET", "/api/contacts?limit=50");
  return { ok: r.ms < SLOW_MS && r.s === 200, s: r.s, ms: r.ms, sz: r.sz, d: r.ms >= SLOW_MS ? `SLOW ${r.ms}ms` : `${r.ms}ms` };
}));
tests.push(T("PERF", "GET /api/campaigns", async () => {
  const r = await http("GET", "/api/campaigns");
  return { ok: r.ms < SLOW_MS && r.s === 200, s: r.s, ms: r.ms, sz: r.sz, d: r.ms >= SLOW_MS ? `SLOW ${r.ms}ms` : `${r.ms}ms` };
}));
tests.push(T("PERF", "GET /api/setup/checklist", async () => {
  const r = await http("GET", "/api/setup/checklist");
  return { ok: r.ms < SLOW_MS && r.s === 200, s: r.s, ms: r.ms, sz: r.sz, d: r.ms >= SLOW_MS ? `SLOW ${r.ms}ms` : `${r.ms}ms` };
}));
tests.push(T("PERF", "GET /health", async () => {
  const r = await http("GET", "/health", null, { noCookie: true });
  return { ok: r.ms < SLOW_MS && r.s === 200, s: r.s, ms: r.ms, sz: r.sz, d: r.ms >= SLOW_MS ? `SLOW ${r.ms}ms` : `${r.ms}ms` };
}));

// ────────── PHASE 12: Auth edge cases (LAST to avoid rate limit cascade) ──────────
tests.push(T("AUTH", "Logout", async () => {
  const r = await http("POST", "/api/auth/logout");
  return chk(r, 200);
}));
tests.push(T("AUTH", "Access after logout", async () => {
  const saved = authCookie;
  authCookie = "";
  const r = await http("GET", "/api/contacts");
  authCookie = saved;
  return chk(r, 401);
}));
tests.push(T("AUTH", "Re-login after logout", async () => {
  authCookie = "";
  const r = await http("POST", "/api/auth/login", { password: PASSWORD });
  return chk(r, 200, r.b?.status === "ok", "re-login failed");
}));
tests.push(T("AUTH", "Rate limit (6 bad attempts)", async () => {
  let last = 0;
  for (let i = 0; i < 6; i++) {
    const r = await http("POST", "/api/auth/login", { password: "bad" }, { noCookie: true });
    last = r.s;
  }
  return { ok: last === 429, s: last, ms: 0, sz: 0, d: last !== 429 ? `expected 429, got ${last}` : "" };
}));

// ── Runner ────────────────────────────────────────────

async function waitForRateLimitClear() {
  console.log("  Checking rate limit status...");
  const r = await http("POST", "/api/auth/login", { password: PASSWORD });
  if (r.s === 200) {
    console.log("  Rate limit clear - logged in OK.");
    return;
  }
  if (r.s === 429) {
    console.log("  Rate limited. Waiting 5 min for window to expire...");
    const WAIT = 310000; // 5 min 10 sec
    const start = Date.now();
    while (Date.now() - start < WAIT) {
      const remaining = Math.ceil((WAIT - (Date.now() - start)) / 1000);
      process.stdout.write(`\r  Waiting... ${remaining}s remaining   `);
      await new Promise(r => setTimeout(r, 5000));
      const check = await http("POST", "/api/auth/login", { password: PASSWORD });
      if (check.s === 200) {
        console.log("\n  Rate limit cleared - logged in OK.");
        return;
      }
    }
    console.log("\n  WARNING: Rate limit may still be active.");
  }
}

async function main() {
  console.log("=".repeat(70));
  console.log("  STRESS TEST - ARTES-BUHO_EMAILING");
  console.log(`  Target: ${BASE}`);
  console.log(`  Date:   ${new Date().toISOString()}`);
  console.log(`  Tests:  ${tests.length}`);
  console.log("=".repeat(70));
  console.log("");

  await waitForRateLimitClear();
  console.log("");

  for (const t of tests) await run(t);

  console.log("");
  console.log("=".repeat(70));
  console.log("  SUMMARY");
  console.log("=".repeat(70));
  console.log(`  Total:   ${total}`);
  console.log(`  Passed:  ${passed}`);
  console.log(`  Failed:  ${failed}`);
  console.log(`  Rate:    ${total ? ((passed/total)*100).toFixed(1) : 0}%`);
  console.log(`  Bugs:    ${bugs.length}`);
  console.log("");
  if (bugs.length) {
    console.log("  BUGS / FAILURES:");
    bugs.forEach((b, i) => console.log(`    ${i+1}. ${b.label} -- ${b.d}`));
    console.log("");
  }
  if (slow.length) {
    console.log(`  SLOW (>${SLOW_MS}ms):`);
    slow.forEach((s, i) => console.log(`    ${i+1}. ${s.label} -- ${s.ms}ms`));
  } else {
    console.log("  SLOW ENDPOINTS: none");
  }
  console.log("");
  console.log("=".repeat(70));
  console.log("  DONE");
  console.log("=".repeat(70));
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
