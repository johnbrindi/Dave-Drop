/* Live chat widget (visitor side). Talks to /api/chat. */
(function () {
  const API = "/api/chat";
  const STORE = "davedrop-chat";
  const OPEN_POLL = 3000;
  const CLOSED_POLL = 20000;

  const load = () => {
    try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; }
  };
  const save = (s) => {
    try { localStorage.setItem(STORE, JSON.stringify(s)); } catch {}
  };

  let state = load(); // { id, token, name, seen }
  let messages = [];
  let lastTs = 0;
  let open = false;
  let timer = null;
  let unread = 0;

  // ---------- DOM ----------
  const icon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3C6.5 3 2 6.9 2 11.7c0 2.5 1.2 4.7 3.2 6.3L4.5 21.5l4-2a11 11 0 0 0 3.5.6c5.5 0 10-3.9 10-8.7S17.5 3 12 3zm-4 9.9a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6zm4 0a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6zm4 0a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6z"/></svg>';
  const drop = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5c-3.6 4.3-6.5 8-6.5 11.3a6.5 6.5 0 0 0 13 0C18.5 10.5 15.6 6.8 12 2.5z"/></svg>';
  const sendIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12 2-12 2z"/></svg>';

  const root = document.createElement("div");
  root.className = "lc";
  root.innerHTML = `
    <button class="lc-launch" id="lc-launch" type="button" aria-controls="lc-panel" aria-expanded="false">
      <span class="lc-launch-icon">${icon}</span>
      <span class="lc-launch-label">Live chat</span>
      <span class="lc-badge" id="lc-badge" hidden>0</span>
    </button>
    <section class="lc-panel" id="lc-panel" role="dialog" aria-label="Live chat with Dave Drop" hidden>
      <header class="lc-head">
        <span class="brand-mark">${drop}</span>
        <div class="lc-title"><strong>Dave Drop</strong><span>Online · active 24/7</span></div>
        <button class="lc-close" id="lc-close" type="button" aria-label="Close chat">×</button>
      </header>
      <div class="lc-log" id="lc-log" aria-live="polite"></div>
      <form class="lc-form" id="lc-form" novalidate>
        <input id="lc-name" type="text" maxlength="60" autocomplete="name" placeholder="Your name (optional)">
        <p class="lc-error" id="lc-error" role="alert" hidden></p>
        <div class="lc-row">
          <label class="visually-hidden" for="lc-text">Message</label>
          <textarea id="lc-text" rows="1" maxlength="1000" placeholder="Type your message…"></textarea>
          <button class="lc-send" id="lc-send" type="submit" aria-label="Send message">${sendIcon}</button>
        </div>
      </form>
    </section>`;
  document.body.appendChild(root);

  const $ = (id) => document.getElementById(id);
  const log = $("lc-log");
  const panel = $("lc-panel");
  const launch = $("lc-launch");
  const text = $("lc-text");
  const nameInput = $("lc-name");
  const err = $("lc-error");
  const badge = $("lc-badge");

  const fmt = (ts) => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  function render() {
    log.textContent = "";
    const hello = document.createElement("div");
    hello.className = "lc-msg from-admin";
    hello.textContent = "Hi! Send us a message and we'll reply right here.";
    log.appendChild(hello);
    if (!state.id) {
      const note = document.createElement("p");
      note.className = "lc-note";
      note.textContent = "Keep this page open to see our reply.";
      log.appendChild(note);
    }
    for (const m of messages) {
      const el = document.createElement("div");
      el.className = `lc-msg from-${m.from}${m.pending ? " pending" : ""}`;
      el.textContent = m.text;
      const t = document.createElement("time");
      t.textContent = m.pending ? "Sending…" : fmt(m.ts);
      el.appendChild(t);
      log.appendChild(el);
    }
    log.scrollTop = log.scrollHeight;
    nameInput.hidden = Boolean(state.id);
  }

  function setBadge() {
    badge.hidden = unread === 0;
    badge.textContent = unread > 9 ? "9+" : String(unread);
  }

  function showError(msg) {
    err.textContent = msg;
    err.hidden = !msg;
  }

  function merge(incoming) {
    let added = 0;
    for (const m of incoming) {
      if (messages.some((x) => x.id === m.id)) continue;
      messages.push(m);
      if (m.from === "admin" && m.ts > (state.seen || 0)) added++;
      lastTs = Math.max(lastTs, m.ts);
    }
    messages.sort((a, b) => a.ts - b.ts);
    return added;
  }

  async function poll() {
    if (!state.id) return;
    try {
      const q = new URLSearchParams({ id: state.id, token: state.token, after: String(lastTs) });
      const res = await fetch(`${API}?${q}`);
      if (res.status === 404) {
        state = {}; messages = []; lastTs = 0; save(state); render();
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      const added = merge(data.messages || []);
      if (added || data.messages.length) {
        if (open) {
          state.seen = lastTs; save(state);
        } else {
          unread += added; setBadge();
        }
        render();
      }
    } catch {}
  }

  function schedule() {
    clearTimeout(timer);
    if (!state.id || document.hidden) return;
    timer = setTimeout(async () => { await poll(); schedule(); }, open ? OPEN_POLL : CLOSED_POLL);
  }

  function setOpen(v) {
    open = v;
    panel.hidden = !v;
    launch.setAttribute("aria-expanded", String(v));
    root.classList.toggle("lc-open", v);
    document.documentElement.classList.toggle("lc-lock", v);
    if (v) {
      unread = 0; setBadge();
      state.seen = lastTs; save(state);
      render();
      setTimeout(() => text.focus(), 50);
      poll();
    } else {
      launch.focus();
    }
    schedule();
  }

  launch.addEventListener("click", () => setOpen(true));
  $("lc-close").addEventListener("click", () => setOpen(false));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && open) setOpen(false); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) poll(); schedule(); });

  text.addEventListener("input", () => {
    text.style.height = "auto";
    text.style.height = Math.min(text.scrollHeight, 120) + "px";
  });
  text.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("lc-form").requestSubmit(); }
  });

  $("lc-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const value = text.value.trim();
    if (!value) { showError("Type a message first."); return; }
    showError("");
    const temp = { id: "tmp" + Date.now(), from: "visitor", text: value, ts: Date.now(), pending: true };
    messages.push(temp);
    text.value = ""; text.style.height = "auto";
    render();
    $("lc-send").disabled = true;
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: state.id, token: state.token, name: nameInput.value.trim(), text: value }),
      });
      const data = await res.json();
      messages = messages.filter((m) => m !== temp);
      if (!res.ok) throw new Error(data.error || "Message not sent. Try again.");
      state.id = data.id; state.token = data.token; save(state);
      merge([data.message]);
      state.seen = lastTs; save(state);
      render();
      schedule();
    } catch (ex) {
      messages = messages.filter((m) => m !== temp);
      text.value = value;
      render();
      showError(ex.message || "Message not sent. Check your connection and try again.");
    } finally {
      $("lc-send").disabled = false;
    }
  });

  // Restore an earlier chat on this device
  if (state.id) { poll().then(schedule); }
  render();
})();
