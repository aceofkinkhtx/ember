// Ember's alerts (M7), loaded into the service worker. The text is always
// generic; tapping it opens Ember on Home, where the check-in or message waits.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const body = typeof data.body === 'string' ? data.body : 'Something is waiting in Ember.';
  event.waitUntil(
    self.registration.showNotification('Ember', {
      body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      tag: data.tag || 'ember',
      data: { url: data.url || '/' }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ('focus' in w) {
          w.navigate(url);
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
