import webpush from "web-push";
import { redis, toObject } from "./redis.js";

const SUBS_KEY = "chat:subs";
let configured = false;

function configure() {
  if (configured) return true;
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "https://davedrop.online",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
  configured = true;
  return true;
}

export async function saveSubscription(sub) {
  if (!sub || typeof sub.endpoint !== "string" || !sub.keys) throw new Error("Invalid subscription");
  await redis("HSET", SUBS_KEY, sub.endpoint, JSON.stringify(sub));
}

export async function removeSubscription(endpoint) {
  if (endpoint) await redis("HDEL", SUBS_KEY, endpoint);
}

// Sends a notification to every installed admin device. Never throws.
export async function notifyAdmins(payload) {
  try {
    if (!configure()) return;
    const subs = toObject(await redis("HGETALL", SUBS_KEY)) || {};
    const data = JSON.stringify(payload);
    await Promise.all(
      Object.entries(subs).map(async ([endpoint, raw]) => {
        try {
          await webpush.sendNotification(JSON.parse(raw), data, { TTL: 3600, urgency: "high" });
        } catch (err) {
          if (err.statusCode === 404 || err.statusCode === 410) await removeSubscription(endpoint);
        }
      })
    );
  } catch (err) {
    console.error("push failed", err);
  }
}
