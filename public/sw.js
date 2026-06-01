// 影みち Service Worker
// アプリシェル(安定エントリ)とハッシュ付き資産は cache-first（初回取得時に投入）、
// 地図タイルは上限付き cache、API はネットワーク優先・キャッシュしない。
const VERSION = 'kagemichi-v2';
const SHELL = VERSION + '-shell';
const TILES = VERSION + '-tiles';
const TILE_MAX = 300;

// ハッシュ付き dist 資産名はビルド毎に変わるため、安定エントリのみ事前キャッシュ。
const SHELL_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_URLS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== SHELL && k !== TILES).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (/tile\.openstreetmap\.org/.test(url.hostname)) { e.respondWith(cacheFirstCapped(req)); return; }

  // 外部API: ネットワーク優先・保存しない（規約配慮）
  if (/brouter\.de|routing\.openstreetmap\.de|valhalla.*\.openstreetmap\.de|router\.project-osrm\.org|overpass-api\.de|nominatim\.openstreetmap\.org|api\.open-meteo\.com/.test(url.hostname)) {
    e.respondWith(fetch(req).catch(() => new Response('', { status: 504 })));
    return;
  }

  // アプリシェル/資産/フォント: cache-first + 背景投入
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(SHELL).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});

async function cacheFirstCapped(req) {
  const cache = await caches.open(TILES);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    cache.put(req, res.clone());
    trimCache(cache, TILE_MAX);
    return res;
  } catch { return new Response('', { status: 504 }); }
}
async function trimCache(cache, max) {
  const keys = await cache.keys();
  if (keys.length <= max) return;
  for (let i = 0; i < keys.length - max; i++) cache.delete(keys[i]);
}
