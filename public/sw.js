const CACHE = 'cube-puzzle-v1';
const SCOPE = self.registration.scope;
const CORE = ['./', './index.html', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// ページが読み込んだファイルを、オフライン用に保存する
self.addEventListener('message', (e) => {
  if (!e.data || e.data.type !== 'cache') return;
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(
    e.data.urls.filter((u) => u.startsWith(SCOPE)).map((u) => c.add(u).catch(() => {})),
  )));
});

// キャッシュ優先で即表示し、裏で最新版に更新する（更新は次回起動で反映）
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith(SCOPE)) return;
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const hit = await cache.match(req, { ignoreSearch: true });
    const net = fetch(req).then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    if (hit) return hit;
    const res = await net;
    return res || (req.mode === 'navigate' ? cache.match('./index.html') : Response.error());
  }));
});
