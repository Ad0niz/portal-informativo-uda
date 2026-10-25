self.addEventListener('push', event => {
  let data = {};
  try { data = event.data?.json() || {}; } catch { data = {}; }
  const title = data.title || 'Nuevo aviso de Derecho UDA';
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || 'Hay nueva información en el panel.',
    tag: data.tag || 'derecho-uda',
    data: { url: data.url || '/' },
    icon: '/icon.svg',
    badge: '/icon.svg'
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin);
  if (url.origin !== self.location.origin) return;
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(client => new URL(client.url).origin === url.origin);
    if (existing) { await existing.navigate(url.href); return existing.focus(); }
    return clients.openWindow(url.href);
  })());
});
