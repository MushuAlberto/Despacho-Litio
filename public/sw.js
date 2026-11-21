// Service Worker Kill-Switch: purga caches obsoletos y desregistra versiones previas (Workbox / PWA)
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      } catch {
        // Ignorar errores al limpiar caches
      }

      try {
        await self.registration.unregister();
      } catch {
        // Ignorar errores al desregistrar
      }

      try {
        await self.clients.claim();
      } catch {
        // Ignorar errores de claim
      }
    })()
  );
});
