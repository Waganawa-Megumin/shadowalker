// 影みち Service Worker
// HTML(ナビゲーション)は常にネットワーク優先で最新を取得（古いindex.html固着を防ぐ）。
// ハッシュ付き資産・データは stale-while-revalidate。地図タイルは上限付きキャッシュ。API は素通し。
// BUILD はビルド毎に置換され、これによりSWが必ず更新扱いになる（→自動リロード）。
const BUILD = '__BUILD_ID__';
self.__BUILD = BUILD; // 参照（バイト変化＝新SW検知のトリガ）
const VERSION = 'kagemichi-v4';
const SHELL = VERSION + '-shell';
const TILES = VERSION + '-tiles';
const DATA = VERSION + '-data';
const TILE_MAX = 300;
const DATA_MAX = 600; // 建物/街路樹タイル(同一オリジン /data/) の上限。広域巡回でもストレージ肥大を防ぐ

// ハッシュ付き dist 資産名はビルド毎に変わるため、安定エントリのみ事前キャッシュ（オフラインの最低限）。
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
      keys.filter(k => k !== SHELL && k !== TILES && k !== DATA).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // 地図タイル: 上限付き cache-first
  if (/tile\.openstreetmap\.org/.test(url.hostname)) { e.respondWith(cacheFirstCapped(req)); return; }

  // 外部API: ネットワークのみ（保存しない・規約配慮）
  if (/brouter\.de|routing\.openstreetmap\.de|valhalla.*\.openstreetmap\.de|router\.project-osrm\.org|overpass-api\.de|nominatim\.openstreetmap\.org|api\.open-meteo\.com/.test(url.hostname)) {
    e.respondWith(fetch(req).catch(() => new Response('', { status: 504 })));
    return;
  }

  // HTML(ナビゲーション): ネットワーク優先。失敗時のみキャッシュへフォールバック。
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(SHELL).then(c => c.put('./index.html', copy)).catch(() => {});
        return res;
      }).catch(() => caches.match('./index.html').then(h => h || caches.match('./')))
    );
    return;
  }

  // 建物/街路樹タイル等（同一オリジンの /data/）: 上限付き stale-while-revalidate
  if (url.origin === self.location.origin && url.pathname.includes('/data/')) {
    e.respondWith(cappedSWR(req, DATA, DATA_MAX));
    return;
  }

  // 資産/フォント（ハッシュ付き・有限）: stale-while-revalidate（即返し＋背景更新）
  e.respondWith((async () => {
    const cache = await caches.open(SHELL);
    const hit = await cache.match(req);
    const fetching = fetch(req).then(res => { cache.put(req, res.clone()).catch(() => {}); return res; }).catch(() => null);
    return hit || (await fetching) || new Response('', { status: 504 });
  })());
});

// 即返し＋背景更新で上限件数を超えた古いものから削除
async function cappedSWR(req, cacheName, max) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const fetching = fetch(req).then(res => {
    cache.put(req, res.clone()).then(() => trimCache(cache, max)).catch(() => {});
    return res;
  }).catch(() => null);
  return hit || (await fetching) || new Response('', { status: 504 });
}

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
