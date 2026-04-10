'use strict';

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));

    const registration = await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: 'window' });
    await Promise.all(
      clients.map((client) => {
        if (registration) {
          return client.navigate(client.url);
        }
        return Promise.resolve();
      })
    );

    self.clients.claim();
  })());
});
