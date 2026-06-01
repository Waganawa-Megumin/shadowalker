// 建物の空間インデックス（一様グリッド）と高さ補助
import type { Building, BuildingGrid, Bbox, LatLng } from '../types';
import { CELL_M, DEFAULT_H } from '../config';

// "5-7" "G+4" "地上5" などの乱雑な building:levels から階数を取り出す。失敗時 null。
export function parseLevels(raw: string | undefined): number | null {
  if (!raw) return null;
  const m = raw.match(/\d+(?:\.\d+)?/);
  if (!m) return null;
  const v = parseFloat(m[0]);
  return Number.isFinite(v) && v > 0 ? v : null;
}

// poly から bbox を計算して Building を組み立てる
export function makeBuilding(poly: LatLng[], h: number, source: Building['source'] = 'overpass'): Building {
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const [la, ln] of poly) {
    if (la < minLat) minLat = la; if (la > maxLat) maxLat = la;
    if (ln < minLng) minLng = ln; if (ln > maxLng) maxLng = ln;
  }
  return { poly, h: h > 0 ? h : DEFAULT_H, minLat, maxLat, minLng, maxLng, source };
}

// 各建物を覆う全セルに index 登録
export function buildGrid(buildings: Building[], bbox: Bbox): BuildingGrid {
  const latC = (bbox.s + bbox.n) / 2;
  const dLat = CELL_M / 111320;
  const dLng = CELL_M / (111320 * Math.cos(latC * Math.PI / 180));
  const lat0 = bbox.s, lng0 = bbox.w;
  const map = new Map<string, number[]>();
  const cx = (lat: number) => Math.floor((lat - lat0) / dLat);
  const cy = (lng: number) => Math.floor((lng - lng0) / dLng);
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    for (let x = cx(b.minLat); x <= cx(b.maxLat); x++) {
      for (let y = cy(b.minLng); y <= cy(b.maxLng); y++) {
        const k = x + ',' + y;
        let arr = map.get(k);
        if (!arr) { arr = []; map.set(k, arr); }
        arr.push(i);
      }
    }
  }
  return { map, lat0, lng0, dLat, dLng };
}

export function cellOf(grid: BuildingGrid, lat: number, lng: number): number[] {
  const x = Math.floor((lat - grid.lat0) / grid.dLat);
  const y = Math.floor((lng - grid.lng0) / grid.dLng);
  return grid.map.get(x + ',' + y) || [];
}
