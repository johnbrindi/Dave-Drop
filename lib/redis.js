// Minimal Upstash Redis REST client (no extra dependency).
const BASE = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

function ensureConfigured() {
  if (!BASE || !TOKEN) {
    throw new Error("Database is not connected (missing KV_REST_API_URL / KV_REST_API_TOKEN).");
  }
}

export async function redis(...command) {
  ensureConfigured();
  const res = await fetch(BASE, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

export async function pipeline(commands) {
  if (!commands.length) return [];
  ensureConfigured();
  const res = await fetch(`${BASE}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
  });
  const data = await res.json();
  return data.map((r) => {
    if (r.error) throw new Error(r.error);
    return r.result;
  });
}

// Upstash returns HGETALL as a flat [k, v, k, v] array.
export function toObject(flat) {
  if (!flat) return null;
  if (!Array.isArray(flat)) return flat;
  const out = {};
  for (let i = 0; i < flat.length; i += 2) out[flat[i]] = flat[i + 1];
  return Object.keys(out).length ? out : null;
}
