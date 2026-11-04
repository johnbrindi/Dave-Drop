// Admin side of the live chat. Every action except `login` needs a session token.
//   POST ?action=login        { password }          -> { token }
//   GET  ?action=list                                -> conversations
//   GET  ?action=messages&id=&after=                 -> messages (marks chat as read)
//   POST ?action=reply        { id, text }
//   POST ?action=delete       { id }
//   GET  ?action=vapid                               -> push public key
//   POST ?action=subscribe    { subscription }
//   POST ?action=unsubscribe  { endpoint }
import { send, body, clientIp, cleanText, safeEqual, signSession, verifySession, MAX_TEXT } from "../lib/util.js";
import { redis, pipeline, toObject } from "../lib/redis.js";
import { CONVS, convKey, msgsKey, isId, getConversation, addMessage, getMessages, publicConversation } from "../lib/chat.js";
import { saveSubscription, removeSubscription } from "../lib/push.js";

export default async function handler(req, res) {
  const action = req.query.action;
  try {
    if (action === "login" && req.method === "POST") {
      if (!process.env.ADMIN_PASSWORD) {
        return send(res, 500, { error: "Admin password is not set on the server yet." });
      }
      // Only wrong passwords count towards the lockout (8 per 15 minutes per connection).
      const failKey = `rl:loginfail:${clientIp(req)}`;
      if (Number(await redis("GET", failKey)) >= 8) {
        return send(res, 429, { error: "Too many wrong attempts. Wait 15 minutes and try again." });
      }
      const { password } = body(req);
      if (typeof password !== "string" || !safeEqual(password, process.env.ADMIN_PASSWORD)) {
        const fails = await redis("INCR", failKey);
        if (fails === 1) await redis("EXPIRE", failKey, 900);
        return send(res, 401, { error: "Wrong password." });
      }
      return send(res, 200, { token: signSession() });
    }

    if (!verifySession(req)) return send(res, 401, { error: "Session expired. Log in again." });

    if (action === "list" && req.method === "GET") {
      const ids = (await redis("ZREVRANGE", CONVS, 0, 199)) || [];
      const rows = await pipeline(ids.map((id) => ["HGETALL", convKey(id)]));
      const conversations = rows.map(toObject).filter(Boolean).map(publicConversation);
      return send(res, 200, { conversations });
    }

    if (action === "messages" && req.method === "GET") {
      const { id } = req.query;
      const conv = await getConversation(id);
      if (!conv) return send(res, 404, { error: "Chat not found." });
      const messages = await getMessages(id, Number(req.query.after) || 0);
      if (Number(conv.unread)) await redis("HSET", convKey(id), "unread", 0);
      return send(res, 200, { conversation: publicConversation({ ...conv, unread: 0 }), messages });
    }

    if (action === "reply" && req.method === "POST") {
      const { id } = body(req);
      const text = cleanText(body(req).text, MAX_TEXT);
      if (!text) return send(res, 400, { error: "Type a reply first." });
      if (!(await getConversation(id))) return send(res, 404, { error: "Chat not found." });
      const message = await addMessage(id, "admin", text);
      return send(res, 200, { message });
    }

    if (action === "delete" && req.method === "POST") {
      const { id } = body(req);
      if (!isId(id)) return send(res, 400, { error: "Bad chat id." });
      await pipeline([["DEL", convKey(id)], ["DEL", msgsKey(id)], ["ZREM", CONVS, id]]);
      return send(res, 200, { ok: true });
    }

    if (action === "vapid" && req.method === "GET") {
      return send(res, 200, { publicKey: process.env.VAPID_PUBLIC_KEY || null });
    }

    if (action === "subscribe" && req.method === "POST") {
      await saveSubscription(body(req).subscription);
      return send(res, 200, { ok: true });
    }

    if (action === "unsubscribe" && req.method === "POST") {
      await removeSubscription(body(req).endpoint);
      return send(res, 200, { ok: true });
    }

    return send(res, 404, { error: "Unknown action." });
  } catch (err) {
    console.error(err);
    return send(res, 500, { error: err.message || "Server error." });
  }
}
