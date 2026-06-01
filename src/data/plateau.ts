// PLATEAU 建物（区ごと軽量GeoJSON）のランタイム読込と Overpass とのマージ
import type { Bbox, Building, LatLng } from '../types';
import { PLATEAU_WARDS } from '../config';
import { makeBuilding } from '../shade/buildings';
import { pointInPoly } from '../geo';

// bbox に重なる区の GeoJSON を動的取得。無ければ空配列（Overpass フォールバック）。
export async function loadPlateauForBbox(bbox: Bbox): Promise<Building[]> {
  const out: Building[] = [];
  const wards = PLATEAU_WARDS; // 簡易: 候補区を順に試し、存在ファイルのみ採用
  for (const code of wards) {
    try {
      const url = `${import.meta.env.BASE_URL}data/plateau/${code}.geojson`;
      const r = await fetch(url);
      if (!r.ok) continue;
      const j = await r.json();
      out.push(...parsePlateau(j, bbox));
    } catch { /* 区ファイル不在は無視 */ }
  }
  return out;
}

function parsePlateau(j: any, bbox: Bbox): Building[] {
  const out: Building[] = [];
  for (const f of j.features || []) {
    const g = f.geometry;
    if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) continue;
    const rings: number[][][] = g.type === 'Polygon' ? [g.coordinates[0]] : g.coordinates.map((p: number[][][]) => p[0]);
    const h = Number(f.properties?.height) || 0;
    for (const ring of rings) {
      const poly: LatLng[] = ring.map((c: number[]) => [c[1], c[0]]);
      if (poly.length < 3) continue;
      const b = makeBuilding(poly, h, 'plateau');
      if (b.maxLat < bbox.s || b.minLat > bbox.n || b.maxLng < bbox.w || b.minLng > bbox.e) continue;
      out.push(b);
    }
  }
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
