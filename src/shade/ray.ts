// 建物による日陰のレイ判定（グリッド高速化）
import type { Building, BuildingGrid, SolarPosition, LatLng } from '../types';
import { RAD, destPoint, pointInPoly } from '../geo';
import { cellOf } from './buildings';
import { MAX_REACH, MAX_BLD_H, RAY_STEP, SHADE_ALT_MIN } from '../config';

// pt が建物の影に入っているか。夜・薄明（高度<=SHADE_ALT_MIN）は実質日射なしで true。
export function isShaded(pt: LatLng, sp: SolarPosition, grid: BuildingGrid, buildings: Building[]): boolean {
  if (sp.altitude <= SHADE_ALT_MIN) return true;
  const tanAlt = Math.tan(sp.altitude * RAD);
  const maxReach = Math.min(MAX_REACH, MAX_BLD_H / tanAlt + 5);
  const seen = new Set<number>();
  for (let dd = RAY_STEP; dd <= maxReach; dd += RAY_STEP) {
    const probe = destPoint(pt, sp.azimuth, dd);
    const needH = dd * tanAlt;
    const cand = cellOf(grid, probe[0], probe[1]);
    for (const idx of cand) {
      if (seen.has(idx)) continue;
      const b = buildings[idx];
      if (b.h < needH) { seen.add(idx); continue; }
      if (probe[0] < b.minLat || probe[0] > b.maxLat || probe[1] < b.minLng || probe[1] > b.maxLng) continue;
      if (pointInPoly(probe, b.poly)) return true;
      seen.add(idx);
    }
  }
  return false;
}
