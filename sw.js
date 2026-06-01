// 影みち Service Worker
// アプリシェルは cache-first、地図タイルは上限付き cache-first、
// API（ルーティング/Overpass/Nominatim/天気）はネットワーク優先・キャッシュしない。
const VERSION = 'kagemichi-v1';
const SHELL = VERSION + '-shell';
const TILES = VERSION + '-tiles';
const TILE_MAX = 300;

// すべて SW 自身の位置からの相対URL（サブパスでも正しく解決される）
const SHELL_URLS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/config.js',
  './js/sun.js',
  './js/geo.js',
  './js/buildings.js',
  './js/routing.js',
  './js/shade.js',
  './js/weather.js',
  './js/geocode.js',
  './js/ui.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(SHELL).then(c => c.addAll(SHELL_URLS)).then(() => self.skipWaiting())
  );
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
  if (req.method !== 'GET') return; // POST(Overpass等)は触らない
  const url = new URL(req.url);

  // 地図タイル: cache-first（上限管理）
  if (/tile\.openstreetmap\.org/.test(url.hostname)) {
    e.respondWith(cacheFirstCapped(req));
    return;
  }

  // 外部API: ネットワーク優先・キャッシュしない（規約配慮）
  if (/brouter\.de|routing\.openstreetmap\.de|router\.project-osrm\.org|overpass-api\.de|nominatim\.openstreetmap\.org|api\.open-meteo\.com/.test(url.hostname)) {
    e.respondWith(fetch(req).catch(() => new Response('', { status: 504 })));
    return;
  }

  // それ以外（アプリシェル・フォント・Leaflet）: cache-first + 背景更新
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
  } catch (e) {
    return new Response('', { status: 504 });
  }
}
async function trimCache(cache, max) {
  const keys = await cache.keys();
  if (keys.length <= max) return;
  for (let i = 0; i < keys.length - max; i++) cache.delete(keys[i]);
}
