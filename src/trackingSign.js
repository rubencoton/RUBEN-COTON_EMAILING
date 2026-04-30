/* ============================================================
 * trackingSign.js — HMAC para URLs de tracking (P0-A audit 2026-04-30)
 *
 * Problema: las URLs /t/o/:cid/:eb64.gif y /t/c/:cid/:eb64?u=X aceptaban
 * cualquier base64 sin firmar. Cualquier destinatario podía falsificar
 * aperturas/clicks de OTROS contactos iterando emails y recargando.
 *
 * Solución: HMAC-SHA256(`${cid}|${email}`, TRACKING_SECRET) truncado a 16
 * hex chars (8 bytes, 64 bits). Suficiente para anti-falsificación casual
 * sin alargar URLs. Verificación timing-safe.
 *
 * Compat: si TRACKING_SECRET no está set se autogenera en memoria al
 * primer uso (avisa por consola). En producción hay que persistirlo en
 * env para que sobreviva reinicios.
 *
 * Modo enforce: TRACKING_REQUIRE_HMAC=1 → URL sin firma o firma inválida
 * NO registra evento. TRACKING_REQUIRE_HMAC=0 (default) → si la URL no
 * trae firma se registra con flag `signed:false`, si trae firma inválida
 * se rechaza. Esto permite migración suave.
 * ============================================================ */

const crypto = require("crypto");

let _secret = null;

const getSecret = () => {
  if (_secret) return _secret;
  const fromEnv = String(process.env.TRACKING_SECRET || "").trim();
  if (fromEnv && fromEnv.length >= 16) {
    _secret = fromEnv;
    return _secret;
  }
  /* Autogenerate fallback: 32 random bytes hex.
   * NOTA: en cluster/multi-replica esto produce firmas inconsistentes.
   * Producción debe setear TRACKING_SECRET en env. */
  _secret = crypto.randomBytes(32).toString("hex");
  console.warn(
    "[trackingSign] WARNING: TRACKING_SECRET no definido en env. " +
    "Se autogeneró uno en memoria. Las URLs firmadas dejarán de validar " +
    "tras un restart. Define TRACKING_SECRET en variables de entorno."
  );
  return _secret;
};

const sign = (cid, email) => {
  const data = `${String(cid || "").toLowerCase()}|${String(email || "").toLowerCase()}`;
  return crypto
    .createHmac("sha256", getSecret())
    .update(data)
    .digest("hex")
    .slice(0, 16);
};

const verify = (cid, email, sig) => {
  if (!sig || typeof sig !== "string" || sig.length !== 16) return false;
  const expected = sign(cid, email);
  if (expected.length !== sig.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(sig, "hex"));
  } catch (_e) {
    return false;
  }
};

const isEnforce = () => String(process.env.TRACKING_REQUIRE_HMAC || "").trim() === "1";

module.exports = { sign, verify, isEnforce, getSecret };
