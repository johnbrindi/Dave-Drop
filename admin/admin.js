/* Dave Drop admin app: password login, live chat inbox, push notifications. */
(function () {
  const API = "/api/admin";
  const TOKEN_KEY = "dd-admin-token";
  const LIST_POLL = 4000;
  const CHAT_POLL = 2500;

  const $ = (id) => document.getElementById(id);
  const store = {
    get: () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
    set: (v) => { try { localStorage.setItem(TOKEN_KEY, v); } catch {} },
    clear: () => { try { localStorage.removeItem(TOKEN_KEY); } catch {} },
  };

  let token = store.get();
  let conversations = [];
  let currentId = null;
  let messages = [];
  let lastTs = 0;
  let listTimer = null;
  let chatTimer = null;
  let installPrompt = null;
  let toastTimer = null;

  // ---------- helpers ----------
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 2600);
  }

  async function api(action, { method = "GET", params = {}, data } = {}) {
    const q = new URLSearchParams({ action, ...params });
    const res = await fetch(`${API}?${q}`, {
      method,
      headers: {
        ...(data ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: data ? JSON.stringify(data) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (res.status === 401 && action !== "login") { logout(); throw new Error("Session expired. Log in again."); }
    if (!res.ok) throw new Error(json.error || "Something went wrong.");
    return json;
  }

  function setLive(ok) { $("live").classList.toggle("off", !ok); $("live").lastChild.textContent = ok ? "Live" : "Offline"; }

  const timeLabel = (ts) => {
    const d = new Date(ts), now = new Date();
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString([], { day: "numeric", month: "short" });
  };
  const displayName = (c) => c.name || `Visitor ${c.id.slice(0, 4).toUpperCase()}`;

  // ---------- views ----------
  function showLogin() {
    $("app-view").hidden = true;
    $("login-view").hidden = false;
    setTimeout(() => $("password").focus(), 50);
  }
  function showApp() {
    $("login-view").hidden = true;
    $("app-view").hidden = false;
    refreshNotifyUi();
    loadList();
    const fromHash = location.hash.slice(1);
    if (/^[a-f0-9]{16}$/.test(fromHash)) openChat(fromHash);
  }

  function logout() {
    token = null; store.clear();
    clearTimeout(listTimer); clearTimeout(chatTimer);
    currentId = null;
    showLogin();
  }

  // ---------- login ----------
  $("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const pw = $("password").value;
    const err = $("login-error");
    if (!pw) { err.textContent = "Enter the password."; err.hidden = false; return; }
    $("login-btn").disabled = true;
    try {
      const { token: t } = await api("login", { method: "POST", data: { password: pw } });
      token = t; store.set(t);
      $("password").value = ""; err.hidden = true;
      showApp();
    } catch (ex) {
      err.textContent = ex.message; err.hidden = false;
    } finally {
      $("login-btn").disabled = false;
    }
  });

  // ---------- conversation list ----------
  async function loadList() {
    clearTimeout(listTimer);
    if (!token) return;
    try {
      const data = await api("list");
      const before = new Map(conversations.map((c) => [c.id, c.updatedAt]));
      conversations = data.conversations;
      renderList();
      setLive(true);
      // Title badge with unread total
      const total = conversations.reduce((n, c) => n + (c.id === currentId ? 0 : c.unread), 0);
      document.title = total ? `(${total}) Dave Drop Admin` : "Dave Drop Admin";
      if (navigator.setAppBadge) total ? navigator.setAppBadge(total).catch(() => {}) : navigator.clearAppBadge().catch(() => {});
      // If the open chat changed, fetch it now
      const cur = conversations.find((c) => c.id === currentId);
      if (cur && before.get(cur.id) !== cur.updatedAt) loadChat();
    } catch {
      setLive(false);
    }
    if (!document.hidden) listTimer = setTimeout(loadList, LIST_POLL);
  }

  function renderList() {
    const ul = $("conv-list");
    ul.textContent = "";
    $("empty-list").hidden = conversations.length > 0;
    for (const c of conversations) {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.className = "conv" + (c.id === currentId ? " active" : "") + (c.unread && c.id !== currentId ? " unread" : "");
      const name = displayName(c);

      const av = document.createElement("span");
      av.className = "avatar"; av.textContent = name.charAt(0).toUpperCase();
      const main = document.createElement("span");
      main.className = "conv-main";
      const n = document.createElement("span"); n.className = "conv-name"; n.textContent = name;
      const l = document.createElement("span"); l.className = "conv-last";
      l.textContent = (c.lastFrom === "admin" ? "You: " : "") + (c.last || "");
      main.append(n, l);
      const side = document.createElement("span");
      side.className = "conv-side";
      side.append(document.createTextNode(timeLabel(c.updatedAt)));
      if (c.unread && c.id !== currentId) {
        const cnt = document.createElement("span"); cnt.className = "count"; cnt.textContent = c.unread > 99 ? "99+" : c.unread;
        side.append(cnt);
      }
      b.append(av, main, side);
      b.addEventListener("click", () => openChat(c.id));
      li.appendChild(b);
      ul.appendChild(li);
    }
  }

  // ---------- single chat ----------
  function openChat(id) {
    currentId = id;
    messages = []; lastTs = 0;
    $("placeholder").hidden = true;
    $("chat").hidden = false;
    $("app-view").classList.add("show-chat");
    $("log").textContent = "";
    $("reply-error").hidden = true;
    history.replaceState(null, "", `#${id}`);
    const c = conversations.find((x) => x.id === id);
    if (c) { c.unread = 0; setHeader(c); }
    renderList();
    loadChat();
    if (window.matchMedia("(min-width: 761px)").matches) $("reply").focus();
  }

  function closeChat() {
    currentId = null;
    clearTimeout(chatTimer);
    $("app-view").classList.remove("show-chat");
    $("chat").hidden = true;
    $("placeholder").hidden = false;
    history.replaceState(null, "", location.pathname);
    renderList();
  }

  function setHeader(c) {
    $("chat-name").textContent = displayName(c);
    $("chat-meta").textContent = `Started ${new Date(c.createdAt).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`;
  }

  async function loadChat() {
    clearTimeout(chatTimer);
    const id = currentId;
    if (!id || !token) return;
    try {
      const data = await api("messages", { params: { id, after: String(lastTs) } });
      if (id !== currentId) return;
      setHeader(data.conversation);
      let changed = false;
      for (const m of data.messages) {
        if (messages.some((x) => x.id === m.id)) continue;
        messages.push(m); lastTs = Math.max(lastTs, m.ts); changed = true;
      }
      if (changed) renderChat();
    } catch (ex) {
      if (/not found/i.test(ex.message)) { toast("That chat was deleted."); closeChat(); return; }
    }
    if (!document.hidden && currentId === id) chatTimer = setTimeout(loadChat, CHAT_POLL);
  }

  function renderChat() {
    const log = $("log");
    const nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 120;
    log.textContent = "";
    let lastDay = "";
    for (const m of messages) {
      const day = new Date(m.ts).toDateString();
      if (day !== lastDay) {
        const d = document.createElement("div");
        d.className = "day";
        d.textContent = new Date(m.ts).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
        log.appendChild(d);
        lastDay = day;
      }
      const el = document.createElement("div");
      el.className = `msg from-${m.from}`;
      el.textContent = m.text;
      const t = document.createElement("time");
      t.textContent = new Date(m.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      el.appendChild(t);
      log.appendChild(el);
    }
    if (nearBottom || messages.length < 12) log.scrollTop = log.scrollHeight;
  }

  $("back-btn").addEventListener("click", closeChat);

  const reply = $("reply");
  reply.addEventListener("input", () => { reply.style.height = "auto"; reply.style.height = Math.min(reply.scrollHeight, 140) + "px"; });
  reply.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(pointer: fine)").matches) { e.preventDefault(); $("composer").requestSubmit(); }
  });

  $("composer").addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = reply.value.trim();
    const err = $("reply-error");
    if (!text || !currentId) return;
    $("send-btn").disabled = true;
    try {
      const { message } = await api("reply", { method: "POST", data: { id: currentId, text } });
      reply.value = ""; reply.style.height = "auto"; err.hidden = true;
      messages.push(message); lastTs = Math.max(lastTs, message.ts);
      renderChat();
      $("log").scrollTop = $("log").scrollHeight;
      loadList();
    } catch (ex) {
      err.textContent = ex.message; err.hidden = false;
    } finally {
      $("send-btn").disabled = false;
      reply.focus();
    }
  });

  // ---------- delete ----------
  $("delete-btn").addEventListener("click", () => { $("confirm").hidden = false; $("confirm-no").focus(); });
  $("confirm-no").addEventListener("click", () => { $("confirm").hidden = true; });
  $("confirm-yes").addEventListener("click", async () => {
    $("confirm").hidden = true;
    try {
      await api("delete", { method: "POST", data: { id: currentId } });
      conversations = conversations.filter((c) => c.id !== currentId);
      closeChat();
      toast("Chat deleted");
    } catch (ex) { toast(ex.message); }
  });

  // ---------- menu ----------
  $("menu-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    const m = $("menu"); m.hidden = !m.hidden;
    $("menu-btn").setAttribute("aria-expanded", String(!m.hidden));
  });
  document.addEventListener("click", (e) => { if (!$("menu").contains(e.target)) $("menu").hidden = true; });
  $("logout-btn").addEventListener("click", logout);

  // ---------- install (PWA) ----------
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installPrompt = e; $("install-btn").hidden = false; });
  $("install-btn").addEventListener("click", async () => {
    $("menu").hidden = true;
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice.catch(() => {});
    installPrompt = null; $("install-btn").hidden = true;
  });

  // ---------- push notifications ----------
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const pushSupported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

  let swReg = null;
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/admin/sw.js", { scope: "/admin/" }).then((r) => { swReg = r; refreshNotifyUi(); }).catch(() => {});
    navigator.serviceWorker.addEventListener("message", (e) => { if (e.data && e.data.type === "open" && e.data.id) openChat(e.data.id); });
  }

  async function currentSubscription() {
    if (!swReg || !pushSupported) return null;
    return swReg.pushManager.getSubscription();
  }

  async function refreshNotifyUi() {
    const banner = $("notify-banner");
    const btn = $("notify-btn");
    $("ios-hint").hidden = !(isIos && !isStandalone);
    if (!pushSupported) { banner.hidden = true; btn.hidden = true; return; }
    const sub = await currentSubscription();
    const on = Boolean(sub) && Notification.permission === "granted";
    banner.hidden = on || Notification.permission === "denied" || !token;
    btn.hidden = false;
    btn.textContent = on ? "Turn off notifications" : Notification.permission === "denied" ? "Notifications blocked in browser settings" : "Turn on notifications";
    btn.disabled = Notification.permission === "denied";
    if (on) api("subscribe", { method: "POST", data: { subscription: sub.toJSON() } }).catch(() => {});
  }

  function b64ToUint8(b64) {
    const pad = "=".repeat((4 - (b64.length % 4)) % 4);
    const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
  }

  async function enablePush() {
    try {
      if (!swReg) swReg = await navigator.serviceWorker.ready;
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { toast("Notifications not allowed"); return refreshNotifyUi(); }
      const { publicKey } = await api("vapid");
      if (!publicKey) { toast("Push keys are missing on the server."); return; }
      const sub = await swReg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(publicKey) });
      await api("subscribe", { method: "POST", data: { subscription: sub.toJSON() } });
      toast("Notifications on for this device");
    } catch (ex) {
      toast(ex.message || "Could not turn on notifications");
    }
    refreshNotifyUi();
  }

  async function disablePush() {
    const sub = await currentSubscription();
    if (sub) {
      await api("unsubscribe", { method: "POST", data: { endpoint: sub.endpoint } }).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
    toast("Notifications off for this device");
    refreshNotifyUi();
  }

  $("notify-banner-btn").addEventListener("click", enablePush);
  $("notify-btn").addEventListener("click", async () => {
    $("menu").hidden = true;
    (await currentSubscription()) ? disablePush() : enablePush();
  });

  // ---------- lifecycle ----------
  document.addEventListener("visibilitychange", () => {
    if (document.hidden || !token) return;
    loadList();
    if (currentId) loadChat();
  });
  window.addEventListener("hashchange", () => {
    const id = location.hash.slice(1);
    if (token && /^[a-f0-9]{16}$/.test(id) && id !== currentId) openChat(id);
  });

  token ? showApp() : showLogin();
})();
