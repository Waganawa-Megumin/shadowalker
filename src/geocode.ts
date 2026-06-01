// 地名・住所検索（Nominatim / キー不要）。呼び出し側で debounce・中断・キャッシュ。
import { API, TOKYO_VIEWBOX } from './config';

export interface Place { name: string; lat: number; lng: number; }

const cache = new Map<string, Place[]>();

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const hit = cache.get(q);
  if (hit) return hit;
  const [w, s, e, n] = TOKYO_VIEWBOX;
  const u = `${API.nominatim}?q=${encodeURIComponent(q)}&format=jsonv2&limit=6`
    + `&accept-language=ja&countrycodes=jp&viewbox=${w},${s},${e},${n}&bounded=1`;
  const r = await fetch(u, { signal });
  if (!r.ok) throw new Error('nominatim ' + r.status);
  const j = await r.json();
  const out: Place[] = j.map((it: any) => ({ name: it.display_name, lat: +it.lat, lng: +it.lon }));
  cache.set(q, out);
  return out;
}

// 前回呼び出しを AbortController で中断する debounce
export function makeDebouncedSearch(fn: typeof searchPlaces, wait = 600): (q: string) => Promise<Place[]> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let ctrl: AbortController | null = null;
  return (query: string) => new Promise((resolve, reject) => {
    if (timer) clearTimeout(timer);
    if (ctrl) ctrl.abort();
    ctrl = new AbortController();
    const signal = ctrl.signal;
    timer = setTimeout(async () => {
      try { resolve(await fn(query, signal)); }
      catch (e: any) { if (e?.name !== 'AbortError') reject(e); }
    }, wait);
  });
}
