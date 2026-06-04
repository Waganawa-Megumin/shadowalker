// 休憩スポット（給水・トイレ）の読込。初回に取得して以降キャッシュ。
// public/data/poi/poi.json = [[lng,lat,'w'|'t'], ...]
import type { Poi } from '../types';

let cache: Poi[] | null = null;

export async function loadPoi(): Promise<Poi[]> {
  if (cache) return cache;
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}data/poi/poi.json`);
    if (!r.ok) { cache = []; return cache; }
    const arr = await r.json() as [number, number, string][];
    cache = arr.map(([lng, lat, k]) => ({ lat, lng, kind: k === 'w' ? 'water' : 'toilet' } as Poi));
    return cache;
  } catch { cache = []; return cache; }
}
