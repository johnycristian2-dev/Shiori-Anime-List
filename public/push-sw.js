/* Avisos de episódio novo (Web Push). Carregado pelo service worker do PWA (workbox importScripts). */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Shiori', body: event.data && event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Shiori', {
      body: data.body || '',
      icon: data.icon || '/pwa-192.png',
      badge: '/pwa-192.png',
      tag: data.tag,
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) {
          c.navigate(url).catch(() => null);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
