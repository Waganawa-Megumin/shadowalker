// PLATEAU 建物（タイル化）のランタイム読込と Overpass とのマージ
// タイル: public/data/plateau/t/<tx>_<ty>.json = [[height, [lng,lat,lng,lat,...]], ...]
// 索引:   public/data/plateau/index.json = { deg, tiles:[ "<tx>_<ty>", ... ] }
import type { Bbox, Building, LatLng } from '../types';
import { makeBuilding } from '../shade/buildings';
import { pointInPoly } from '../geo';

let indexCache: { deg: number; tiles: Set<string> } | null = null;

async function loadIndex(): Promise<{ deg: number; tiles: Set<string> } | null> {
  if (indexCache) return indexCache;
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}data/plateau/index.json`);
    if (!r.ok) return null;
    const j = await r.json();
    indexCache = { deg: j.deg, tiles: new Set<string>(j.tiles) };
    return indexCache;
  } catch { return null; }
}

// タイル配列 [[h, flatRing], ...] を bbox 内の Building[] に変換（純関数・テスト対象）
export function parsePlateauTile(arr: [number, number[]][], bbox: Bbox): Building[] {
  const out: Building[] = [];
  for (const [h, flat] of arr) {
    const poly: LatLng[] = [];
    for (let i = 0; i + 1 < flat.length; i += 2) poly.push([flat[i + 1], flat[i]]);
    if (poly.length < 3) continue;
    const b = makeBuilding(poly, h, 'plateau');
    if (b.maxLat < bbox.s || b.minLat > bbox.n || b.maxLng < bbox.w || b.minLng > bbox.e) continue;
    out.push(b);
  }
  return out;
}

// bbox に重なるタイルだけを取得。索引が無ければ空配列（Overpass フォールバック）。
export async function loadPlateauForBbox(bbox: Bbox): Promise<Building[]> {
  const idx = await loadIndex();
  if (!idx) return [];
  const { deg, tiles } = idx;
  const keys: string[] = [];
  for (let x = Math.floor(bbox.w / deg); x <= Math.floor(bbox.e / deg); x++) {
    for (let y = Math.floor(bbox.s / deg); y <= Math.floor(bbox.n / deg); y++) {
      const k = `${x}_${y}`;
      if (tiles.has(k)) keys.push(k);
    }
  }
  const out: Building[] = [];
  await Promise.all(keys.map(async k => {
    try {
      const r = await fetch(`${import.meta.env.BASE_URL}data/plateau/t/${k}.json`);
      if (!r.ok) return;
      out.push(...parsePlateauTile(await r.json(), bbox));
    } catch { /* タイル欠損は無視 */ }
  }));
  return out;
}

function centroid(poly: LatLng[]): LatLng {
  let la = 0, ln = 0;
  for (const p of poly) { la += p[0]; ln += p[1]; }
  return [la / poly.length, ln / poly.length];
}

// PLATEAU 優先。Overpass 建物のうち PLATEAU の重心がポリゴン内にあるものは除外し、PLATEAU で置換。
export function mergeBuildings(overpass: Building[], plateau: Building[]): Building[] {
  if (!plateau.length) return overpass;
  const kept: Building[] = [];
  for (const o of overpass) {
    const covered = plateau.some(p => {
      const c = centroid(p.poly);
      return c[0] >= o.minLat && c[0] <= o.maxLat && c[1] >= o.minLng && c[1] <= o.maxLng && pointInPoly(c, o.poly);
    });
    if (!covered) kept.push(o);
  }
  return [...plateau, ...kept];
}
