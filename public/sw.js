const CACHE_NAME = "financial-planner-shell-v1";
const SAFE_SHELL = ["/offline.html", "/favicon.svg", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SAFE_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
    return;
  }

  if (!["script", "style", "font", "image"].includes(request.destination)) return;
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
    if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
    return response;
  })));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data && event.notification.data.url || "/";
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    const existing = clients.find((client) => "focus" in client);
    return existing ? existing.focus() : self.clients.openWindow(target);
  }));
});

self.addEventListener("push", (event) => {
  let payload = { title: "Financial Planner", body: "Ada reminder keuangan baru.", url: "/" };
  try { payload = Object.assign(payload, event.data && event.data.json()); } catch (_) {}
  event.waitUntil(self.registration.showNotification(payload.title, {
    body: payload.body,
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    tag: payload.tag || "finance-reminder",
    data: { url: payload.url || "/" },
  }));
});

self.addEventListener("periodicsync", (event) => {
  if (event.tag !== "finance-reminders") return;
  event.waitUntil((async () => {
    const now = new Date();
    const period = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
    const response = await fetch("/api/apps-script", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "notificationOverview", requestId: crypto.randomUUID(), payload: { period } }),
    });
    if (!response.ok) return;
    const result = await response.json();
    const notifications = result && result.ok && result.data && Array.isArray(result.data.notifications) ? result.data.notifications : [];
    const important = notifications.filter((item) => !item.read && !item.dismissed && item.severity !== "info").slice(0, 2);
    await Promise.all(important.map((item) => self.registration.showNotification(item.title, {
      body: item.message,
      icon: "/favicon.svg",
      badge: "/favicon.svg",
      tag: item.id,
      data: { url: "/", actionPage: item.actionPage },
    })));
  })().catch(() => undefined));
});
