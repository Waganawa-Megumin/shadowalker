// 地名・住所検索（Nominatim / キー不要）
// 利用規約順守: 呼び出し側で debounce、新入力で signal により中断、結果をキャッシュ。
import { API, TOKYO_VIEWBOX } from './config.js';

const cache = new Map();

// 返り値 [{name, lat, lng}]
export async function searchPlaces(query, signal) {
  const q = query.trim();
  if (q.length < 2) return [];
  if (cache.has(q)) return cache.get(q);
  const [w, s, e, n] = TOKYO_VIEWBOX;
  const u = `${API.nominatim}?q=${encodeURIComponent(q)}&format=jsonv2&limit=6`
    + `&accept-language=ja&countrycodes=jp&viewbox=${w},${s},${e},${n}&bounded=1`;
  const r = await fetch(u, { signal });
  if (!r.ok) throw new Error('nominatim ' + r.status);
  const j = await r.json();
  const out = j.map(it => ({ name: it.display_name, lat: +it.lat, lng: +it.lon }));
  cache.set(q, out);
  return out;
}

// 簡易 debounce（前回呼び出しを AbortController で中断）
export function makeDebouncedSearch(fn, wait = 600) {
  let timer = null, ctrl = null;
  return (query) => new Promise((resolve, reject) => {
    if (timer) clearTimeout(timer);
    if (ctrl) ctrl.abort();
    ctrl = new AbortController();
    const signal = ctrl.signal;
    timer = setTimeout(async () => {
      try { resolve(await fn(query, signal)); }
      catch (e) { if (e.name !== 'AbortError') reject(e); }
    }, wait);
  });
}
