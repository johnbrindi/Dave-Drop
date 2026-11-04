// Visitor side of the live chat.
//   POST /api/chat  { id?, token?, name?, text }  -> sends a message (starts a chat if no id)
//   GET  /api/chat?id=&token=&after=              -> new messages since `after` (ms)
import { send, body, clientIp, cleanText, rateLimit, safeEqual, MAX_TEXT, MAX_NAME } from "../lib/util.js";
import { createConversation, getConversation, addMessage, getMessages } from "../lib/chat.js";
import { notifyAdmins } from "../lib/push.js";

async function authorize(id, token) {
  const conv = await getConversation(id);
  if (!conv || !token || !safeEqual(conv.token, token)) return null;
  return conv;
}

export default async function handler(req, res) {
  try {
    const ip = clientIp(req);

    if (req.method === "GET") {
      const { id, token } = req.query;
      const conv = await authorize(id, token);
      if (!conv) return send(res, 404, { error: "Chat not found. Start a new one." });
      if (!(await rateLimit(`poll:${ip}`, 120, 60))) return send(res, 429, { error: "Slow down." });
      const messages = await getMessages(id, Number(req.query.after) || 0);
      return send(res, 200, { messages });
    }

    if (req.method === "POST") {
      const data = body(req);
      const text = cleanText(data.text, MAX_TEXT);
      if (!text) return send(res, 400, { error: "Type a message first." });
      if (!(await rateLimit(`send:${ip}`, 20, 60))) {
        return send(res, 429, { error: "Too many messages. Wait a minute and try again." });
      }

      let { id, token } = data;
      let conv = id ? await authorize(id, token) : null;
      let started = false;

      if (!conv) {
        if (!(await rateLimit(`start:${ip}`, 6, 3600))) {
          return send(res, 429, { error: "Too many new chats from this connection. Try again later." });
        }
        const name = cleanText(data.name, MAX_NAME);
        ({ id, token } = await createConversation(name, ip));
        conv = { id, name };
        started = true;
      }

      const message = await addMessage(id, "visitor", text);
      await notifyAdmins({
        title: conv.name ? `${conv.name} · Dave Drop chat` : "New chat message",
        body: text.slice(0, 160),
        url: `/admin/#${id}`,
        tag: id,
      });

      return send(res, 200, { id, token, started, message });
    }

    res.setHeader("Allow", "GET, POST");
    return send(res, 405, { error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    return send(res, 500, { error: "Chat is unavailable right now. Use WhatsApp, Telegram or Signal." });
  }
}
