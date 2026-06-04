// 公園・緑地（単一ファイル）のランタイム読込。初回に取得して bbox で絞る。
// public/data/parks/parks.json = [[lng,lat,lng,lat,...], ...]（外周のみ・度）
import type { Bbox, Park, LatLng } from '../types';

let cache: Park[] | null = null;

async function loadAll(): Promise<Park[]> {
  if (cache) return cache;
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}data/parks/parks.json`);
    if (!r.ok) { cache = []; return cache; }
    const arr = await r.json() as number[][];
    cache = arr.map(flat => {
      const ring: LatLng[] = [];
      let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
      for (let i = 0; i + 1 < flat.length; i += 2) {
        const lng = flat[i], lat = flat[i + 1];
        ring.push([lat, lng]);
        if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng; if (lng > maxLng) maxLng = lng;
      }
      return { ring, minLat, maxLat, minLng, maxLng };
    }).filter(p => p.ring.length >= 3);
    return cache;
  } catch { cache = []; return cache; }
}

export async function loadParksForBbox(bbox: Bbox): Promise<Park[]> {
  const all = await loadAll();
  return all.filter(p => !(p.maxLat < bbox.s || p.minLat > bbox.n || p.maxLng < bbox.w || p.minLng > bbox.e));
}
