// アプリ本体のみをキャッシュする。予報データはlocalStorage側で保存する。
const CACHE = 'wo-shell-v1';
const SHELL = [
  './',
  './style.css',
  './app.js',
  './lib/outfit.js',
  './lib/forecast.js',
  './lib/store.js',
  './lib/render.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return; // 別オリジン(Open-Meteo)は触らない
  // stale-while-revalidate: 先にキャッシュを返し、裏で最新を取得して次回に反映する
  e.respondWith(
    caches.open(CACHE).then((c) => c.match(e.request, { ignoreSearch: true }).then((hit) => {
      const net = fetch(e.request).then((res) => {
        if (res.ok && !res.redirected) c.put(e.request, res.clone());
        return res;
      }).catch(() => hit);
      return hit || net;
    })),
  );
});
