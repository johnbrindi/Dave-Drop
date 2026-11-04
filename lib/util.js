import crypto from "node:crypto";
import { redis } from "./redis.js";

export const MAX_TEXT = 1000;
export const MAX_NAME = 60;
export const HISTORY = 300; // messages kept per conversation

export function send(res, status, body) {
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json(body);
}

export function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  return (Array.isArray(fwd) ? fwd[0] : fwd || "").split(",")[0].trim() || "unknown";
}

export function randomHex(bytes) {
  return crypto.randomBytes(bytes).toString("hex");
}

export function safeEqual(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function cleanText(value, max) {
  if (typeof value !== "string") return "";
  return value.replace(/\r\n/g, "\n").replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "").trim().slice(0, max);
}

// Fixed-window rate limit. Returns true when the call is allowed.
export async function rateLimit(key, limit, windowSec) {
  const k = `rl:${key}`;
  const count = await redis("INCR", k);
  if (count === 1) await redis("EXPIRE", k, windowSec);
  return count <= limit;
}

export function body(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try {
    return JSON.parse(req.body || "{}");
  } catch {
    return {};
  }
}

// ---- Admin session tokens (stateless, HMAC-signed) ----
function sessionKey() {
  return `${process.env.SESSION_SECRET || ""}:${process.env.ADMIN_PASSWORD || ""}`;
}

export function signSession(days = 30) {
  const exp = Date.now() + days * 86400000;
  const payload = Buffer.from(JSON.stringify({ exp })).toString("base64url");
  const sig = crypto.createHmac("sha256", sessionKey()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySession(req) {
  if (!process.env.ADMIN_PASSWORD) return false;
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = crypto.createHmac("sha256", sessionKey()).update(payload).digest("base64url");
  if (!safeEqual(sig, expected)) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof exp === "number" && exp > Date.now();
  } catch {
    return false;
  }
}
