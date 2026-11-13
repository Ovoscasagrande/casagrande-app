const CACHE = 'cg-v147';
const ASSETS = ['./', './index.html', './logo-branca.png', './icon-192.png', './icon-512.png', './favicon.png', './manifest.json',
  'https://unpkg.com/lucide@latest',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap'];

self.addEventListener('install', e => {
  // tolerante a falha de CDN: um asset que falha NÃO mata o install
  e.waitUntil(
    caches.open(CACHE).then(c => Promise.allSettled(ASSETS.map(a =>
      fetch(a, {cache:'no-store'}).then(res => res.ok ? c.put(a, res) : Promise.reject(a))
    )))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // o próprio SW e o index nunca vêm do cache do SW (o app atualiza sempre que há rede)
  if (url.pathname.endsWith('sw.js')) return;
  if (url.host.includes('supabase')) return;
  // Lucide e Google Fonts: cache-first (funciona offline)
  if (url.host.includes('unpkg.com') || url.host.includes('fonts.g')) {
    e.respondWith(
      caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      }))
    );
    return;
  }
  if (url.host !== location.host) return;
  // HTML: NETWORK-FIRST (com rede, sempre a versão nova; cache só se offline)
  if (url.pathname.endsWith('index.html') || url.pathname === '/casagrande-app/' || url.pathname.endsWith('/casagrande-app')) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() => caches.match(e.request).then(hit => hit || caches.match('index.html')))
    );
    return;
  }
  // demais arquivos do app: cache primeiro, atualizando em segundo plano
  e.respondWith(
    caches.match(e.request).then(hit => {
      const fetchPromise = fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() => hit);
      return hit || fetchPromise;
    })
  );
});
