const { spawn } = require("child_process");
const fs = require("fs");
const http = require("http");
const path = require("path");

const APP_PASSWORD = process.env.APP_ACCESS_PASSWORD || "+artesbuho26";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const startServer = (port, extraEnv = {}) => {
  const isolatedStoreFile = path.join(
    process.cwd(),
    "data",
    `.audit-store-${port}-${Date.now()}.json`
  );

  const env = {
    ...process.env,
    PORT: String(port),
    DATA_STORE_FILE: isolatedStoreFile,
    ...extraEnv
  };

  const child = spawn(process.execPath, ["src/server.js"], {
    cwd: process.cwd(),
    env,
    stdio: ["ignore", "pipe", "pipe"]
  });

  child.stdout.on("data", (chunk) => {
    process.stdout.write(`[server:${port}] ${chunk.toString()}`);
  });

  child.stderr.on("data", (chunk) => {
    process.stdout.write(`[server:${port}:err] ${chunk.toString()}`);
  });

  return {
    child,
    isolatedStoreFile
  };
};

const stopServer = async (runtime) => {
  const child = runtime?.child;
  if (!child || child.killed) {
    if (runtime?.isolatedStoreFile && fs.existsSync(runtime.isolatedStoreFile)) {
      fs.unlinkSync(runtime.isolatedStoreFile);
    }
    return;
  }

  child.kill("SIGTERM");
  await sleep(450);
  if (!child.killed) {
    child.kill("SIGKILL");
  }

  if (runtime?.isolatedStoreFile && fs.existsSync(runtime.isolatedStoreFile)) {
    fs.unlinkSync(runtime.isolatedStoreFile);
  }
};

const request = (port, path, options = {}) =>
  new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path,
        method: options.method || "GET",
        headers: options.headers || {}
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk.toString();
        });
        res.on("end", () => {
          let json = null;
          try {
            json = JSON.parse(body);
          } catch (_error) {
            json = null;
          }
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body,
            json
          });
        });
      }
    );

    req.on("error", reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });

const waitReady = async (port, timeoutMs = 15000) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await request(port, "/health");
      if (response.status === 200 || response.status === 500) {
        return;
      }
    } catch (_error) {
      // Keep waiting until timeout.
    }
    await sleep(250);
  }
  throw new Error(`Servidor no responde en puerto ${port}`);
};

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const testAuthAndStatic = async () => {
  const port = 3190;
  const runtime = startServer(port, {
    NODE_ENV: "production",
    APP_AUTH_COOKIE_SECURE: "auto"
  });

  try {
    await waitReady(port);

    const css = await request(port, "/styles.css");
    assert(css.status === 200, "styles.css debe responder 200 sin login.");
    assert(
      String(css.headers["content-type"] || "").includes("text/css"),
      "styles.css debe responder content-type text/css."
    );

    const loginOk = await request(port, "/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: APP_PASSWORD })
    });
    assert(loginOk.status === 200, "Login con password correcta debe responder 200.");

    const rawSetCookie = Array.isArray(loginOk.headers["set-cookie"])
      ? loginOk.headers["set-cookie"].join(";")
      : String(loginOk.headers["set-cookie"] || "");

    assert(
      !/(?:^|;\s*)Secure(?:;|$)/i.test(rawSetCookie),
      "Cookie no debe llevar Secure cuando acceso es HTTP sin proxy HTTPS."
    );

    const malformedCookieResponse = await request(port, "/", {
      headers: { Cookie: "app_auth=%E0%A4%A" }
    });

    assert(
      malformedCookieResponse.status !== 500,
      "Cookie malformada no debe provocar error 500."
    );

    return {
      name: "auth_static_cookie_hardening",
      status: "ok"
    };
  } finally {
    await stopServer(runtime);
  }
};

const testBounceNoDuplication = async () => {
  const port = 3191;
  const runtime = startServer(port, {
    NODE_ENV: "development",
    MAIL_TRANSPORT_MODE: "smtp",
    SMTP_HOST: "127.0.0.1",
    SMTP_PORT: "9",
    SMTP_FROM_EMAIL: "booking@artesbuhomanagement.com",
    SMTP_REPLY_TO: "booking@artesbuhomanagement.com",
    MAIL_RATE_LIMIT_PER_MIN: "120",
    MAIL_MAX_RETRIES: "0"
  });

  try {
    await waitReady(port);

    const login = await request(port, "/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: APP_PASSWORD })
    });
    assert(login.status === 200, "Login de auditoría debe responder 200.");

    const cookie = Array.isArray(login.headers["set-cookie"])
      ? login.headers["set-cookie"][0].split(";")[0]
      : "";
    const headers = {
      "content-type": "application/json",
      cookie
    };

    const uniqueEmail = `audit_${Date.now()}@demo.com`;

    const contact = await request(port, "/api/contacts", {
      method: "POST",
      headers,
      body: JSON.stringify({
        email: uniqueEmail,
        firstName: "Audit",
        status: "subscribed"
      })
    });
    assert(contact.status === 201, "Creación de contacto de auditoría falló.");

    const segment = await request(port, "/api/segments", {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: `SEG_AUDIT_${Date.now()}`,
        match: "all",
        rules: [{ field: "email", op: "equals", value: uniqueEmail }]
      })
    });
    assert(segment.status === 201, "Creación de segmento de auditoría falló.");

    const campaign = await request(port, "/api/campaigns", {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: `CMP_AUDIT_${Date.now()}`,
        subject: "Audit failure path",
        segmentId: segment.json.segment.id,
        text: "test body"
      })
    });
    assert(campaign.status === 201, "Creación de campaña de auditoría falló.");

    const sendResponse = await request(
      port,
      `/api/campaigns/${campaign.json.campaign.id}/send`,
      {
        method: "POST",
        headers,
        body: "{}"
      }
    );
    assert(sendResponse.status === 200, "Envío de campaña de auditoría falló.");

    await sleep(2500);

    for (let i = 0; i < 6; i += 1) {
      await request(port, `/api/campaigns/${campaign.json.campaign.id}/analytics`, {
        headers: { cookie }
      });
      await sleep(150);
    }

    const analytics = await request(
      port,
      `/api/campaigns/${campaign.json.campaign.id}/analytics`,
      {
        headers: { cookie }
      }
    );
    assert(analytics.status === 200, "Consulta de analítica de auditoría falló.");

    const bounceEvents = (analytics.json.analytics.recentEvents || []).filter(
      (evt) => evt.type === "bounce" && evt.email === uniqueEmail
    );
    assert(
      bounceEvents.length <= 1,
      `Se detectaron rebotes duplicados (${bounceEvents.length}) para el mismo destinatario.`
    );

    return {
      name: "bounce_deduplication",
      status: "ok"
    };
  } finally {
    await stopServer(runtime);
  }
};

const testParallelReadStability = async () => {
  const port = 3192;
  const runtime = startServer(port, {
    NODE_ENV: "development"
  });

  try {
    await waitReady(port);

    const login = await request(port, "/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: APP_PASSWORD })
    });
    assert(login.status === 200, "Login para test paralelo falló.");

    const cookie = Array.isArray(login.headers["set-cookie"])
      ? login.headers["set-cookie"][0].split(";")[0]
      : "";

    const calls = Array.from({ length: 50 }).map(() =>
      request(port, "/api/dashboard", {
        headers: { cookie }
      })
    );

    const responses = await Promise.all(calls);
    const bad = responses.filter((response) => response.status !== 200);

    assert(
      bad.length === 0,
      `Lecturas paralelas inestables: ${bad.length} respuestas no-200.`
    );

    return {
      name: "parallel_read_stability",
      status: "ok"
    };
  } finally {
    await stopServer(runtime);
  }
};

const run = async () => {
  const tests = [testAuthAndStatic, testBounceNoDuplication, testParallelReadStability];
  const results = [];
  const failed = [];

  for (const test of tests) {
    const testName = test.name;
    process.stdout.write(`\n[deep-audit] Ejecutando ${testName}...\n`);
    try {
      const result = await test();
      results.push(result);
      process.stdout.write(`[deep-audit] OK -> ${result.name}\n`);
    } catch (error) {
      failed.push({
        name: testName,
        error: error.message || "error_desconocido"
      });
      process.stdout.write(`[deep-audit] ERROR -> ${testName}: ${error.message}\n`);
    }
  }

  process.stdout.write("\n=== RESUMEN AUDITORIA PROFUNDA ===\n");
  results.forEach((item) => {
    process.stdout.write(`OK: ${item.name}\n`);
  });
  failed.forEach((item) => {
    process.stdout.write(`FAIL: ${item.name} -> ${item.error}\n`);
  });

  if (failed.length > 0) {
    process.exitCode = 1;
  }
};

run().catch((error) => {
  process.stderr.write(`Fatal audit error: ${error.message}\n`);
  process.exit(1);
});
