/* Service worker for the Dave Drop admin app: push notifications + offline shell. */
const CACHE = "dd-admin-v1";
const SHELL = ["/admin/", "/admin/admin.css", "/admin/admin.js", "/admin/icons/icon-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first for the app shell, never cache the API.
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || !url.pathname.startsWith("/admin")) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match("/admin/")))
  );
});

self.addEventListener("push", (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { data = { body: e.data && e.data.text() }; }
  const title = data.title || "New chat message";
  e.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      tag: data.tag || "dd-chat",
      renotify: true,
      icon: "/admin/icons/icon-192.png",
      badge: "/admin/icons/badge-96.png",
      data: { url: data.url || "/admin/" },
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/admin/";
  const id = url.split("#")[1];
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if (new URL(c.url).pathname.startsWith("/admin")) {
          if (id) c.postMessage({ type: "open", id });
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
