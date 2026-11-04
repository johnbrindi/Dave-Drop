import { redis, pipeline, toObject } from "./redis.js";
import { HISTORY, randomHex } from "./util.js";

export const CONVS = "chat:convs"; // sorted set: id -> updatedAt
export const convKey = (id) => `chat:conv:${id}`;
export const msgsKey = (id) => `chat:msgs:${id}`;

export const isId = (id) => typeof id === "string" && /^[a-f0-9]{16}$/.test(id);

export async function createConversation(name, ip) {
  const id = randomHex(8);
  const token = randomHex(16);
  const now = Date.now();
  await redis(
    "HSET", convKey(id),
    "id", id, "token", token, "name", name || "", "createdAt", now,
    "updatedAt", now, "last", "", "unread", 0, "ip", ip
  );
  return { id, token };
}

export async function getConversation(id) {
  if (!isId(id)) return null;
  return toObject(await redis("HGETALL", convKey(id)));
}

export async function addMessage(id, from, text) {
  const msg = { id: randomHex(6), from, text, ts: Date.now() };
  const cmds = [
    ["RPUSH", msgsKey(id), JSON.stringify(msg)],
    ["LTRIM", msgsKey(id), -HISTORY, -1],
    ["HSET", convKey(id), "updatedAt", msg.ts, "last", text.slice(0, 140), "lastFrom", from],
    ["ZADD", CONVS, msg.ts, id],
  ];
  if (from === "visitor") cmds.push(["HINCRBY", convKey(id), "unread", 1]);
  await pipeline(cmds);
  return msg;
}

export async function getMessages(id, after = 0) {
  const raw = (await redis("LRANGE", msgsKey(id), 0, -1)) || [];
  return raw
    .map((r) => {
      try {
        return JSON.parse(r);
      } catch {
        return null;
      }
    })
    .filter((m) => m && m.ts > after);
}

export function publicConversation(c) {
  return {
    id: c.id,
    name: c.name || "",
    createdAt: Number(c.createdAt) || 0,
    updatedAt: Number(c.updatedAt) || 0,
    last: c.last || "",
    lastFrom: c.lastFrom || "",
    unread: Number(c.unread) || 0,
  };
}
