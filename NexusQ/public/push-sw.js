self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function asObject(value) {
  return value && typeof value === "object" ? value : {};
}

function getNotificationPayload(event) {
  if (!event.data) return {};

  try {
    return asObject(event.data.json());
  } catch {
    const text = event.data.text();
    return text ? { body: text } : {};
  }
}

function buildNotificationOptions(payload) {
  const data = asObject(payload.data);
  const actions = Array.isArray(payload.actions)
    ? payload.actions
        .filter((action) => action && typeof action === "object")
        .map((action) => ({
          action: typeof action.action === "string" ? action.action : "",
          title: typeof action.title === "string" ? action.title : "Open",
        }))
        .filter((action) => action.action && action.title)
    : [];

  return {
    body: typeof payload.body === "string" ? payload.body : "You have a new NexusQ notification.",
    icon: typeof payload.icon === "string" ? payload.icon : "/vite.svg",
    badge: typeof payload.badge === "string" ? payload.badge : "/vite.svg",
    tag: typeof payload.tag === "string" ? payload.tag : undefined,
    renotify: Boolean(payload.renotify),
    requireInteraction: Boolean(payload.requireInteraction),
    data: {
      ...data,
      url:
        typeof data.url === "string"
          ? data.url
          : typeof payload.url === "string"
          ? payload.url
          : "/notifications",
    },
    actions,
  };
}

self.addEventListener("push", (event) => {
  const payload = getNotificationPayload(event);
  const title = typeof payload.title === "string" && payload.title.trim() ? payload.title.trim() : "NexusQ";
  const options = buildNotificationOptions(payload);

  event.waitUntil(self.registration.showNotification(title, options));
});

async function focusOrOpenClient(url) {
  const targetUrl = typeof url === "string" && url.trim() ? url.trim() : "/notifications";
  const clientList = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });

  for (const client of clientList) {
    if ("focus" in client) {
      try {
        await client.navigate(targetUrl);
      } catch {
        // Ignore navigation failures and still focus the window.
      }
      return client.focus();
    }
  }

  if (self.clients.openWindow) {
    return self.clients.openWindow(targetUrl);
  }

  return undefined;
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = asObject(event.notification.data).url;
  event.waitUntil(focusOrOpenClient(targetUrl));
});

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    self.clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then((clientList) =>
        Promise.all(
          clientList.map((client) =>
            client.postMessage({
              type: "nexusq:pushsubscriptionchange",
            })
          )
        )
      )
  );
});
