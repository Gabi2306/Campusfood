/* Café Campus — service worker (HU-04: notificaciones push) */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'Café Campus', body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'Café Campus'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      tag: data.tag || 'campusfood',
      renotify: true,
      vibrate: [120, 60, 120],
      data: { url: data.url || '/', orderId: data.orderId },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (new URL(client.url).origin === self.location.origin) {
          client.postMessage({ type: 'open-orders' })
          return client.focus()
        }
      }
      return self.clients.openWindow(target)
    })
  )
})
