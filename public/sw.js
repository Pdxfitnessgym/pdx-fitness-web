let restTimerTimeout = null;

self.addEventListener("message", (event) => {
  const { type, delayMs, title, body } = event.data ?? {};
  if (type === "SCHEDULE_TIMER") {
    if (restTimerTimeout) clearTimeout(restTimerTimeout);
    restTimerTimeout = setTimeout(() => {
      self.registration.showNotification(title ?? "Rest Over!", {
        body: body ?? "Time for your next set!",
        icon: "/icon-192.png",
        badge: "/favicon-32.png",
        tag: "rest-timer",
        renotify: true,
        vibrate: [200, 150, 200, 150, 200, 150, 200],
      });
      restTimerTimeout = null;
    }, delayMs);
  } else if (type === "CANCEL_TIMER") {
    if (restTimerTimeout) { clearTimeout(restTimerTimeout); restTimerTimeout = null; }
  }
});

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => e.respondWith(fetch(e.request).catch(() => caches.match(e.request))));

self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? "PDX Fitness", {
      body: data.body ?? "",
      icon: "/icon-192.png",
      badge: "/favicon-32.png",
      data: { url: data.url ?? "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      const url = event.notification.data?.url ?? "/";
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
