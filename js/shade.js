// 日陰判定（グリッド高速化）
import { RAD, destPoint, dist, pointInPoly } from './geo.js';
import { cellOf } from './buildings.js';
import { MAX_REACH, MAX_BLD_H, RAY_STEP, SAMPLE_M } from './config.js';

// pt が日陰か。grid/buildings を使い、レイ近傍のセルだけ判定する。
export function isShaded(pt, sp, grid, buildings) {
  if (sp.altitude <= 0.5) return true; // 夜・薄明は実質日射なし扱い
  const tanAlt = Math.tan(sp.altitude * RAD);
  const maxReach = Math.min(MAX_REACH, MAX_BLD_H / tanAlt + 5);
  const seen = new Set();
  for (let dd = RAY_STEP; dd <= maxReach; dd += RAY_STEP) {
    const probe = destPoint(pt, sp.azimuth, dd); // 太陽方向へ進む
    const needH = dd * tanAlt;                   // この距離で遮るのに必要な高さ
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

// 経路を区間サンプリングして日陰/日なたに分類。{segs, shadePct}
export function scoreRoute(coords, sp, grid, buildings) {
  const segs = [];
  let shadedLen = 0, total = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i], b = coords[i + 1];
    const segLen = dist(a, b);
    if (segLen < 1) continue;
    const steps = Math.max(1, Math.round(segLen / SAMPLE_M));
    for (let s = 0; s < steps; s++) {
      const t0 = s / steps, t1 = (s + 1) / steps;
      const pa = [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0];
      const pb = [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1];
      const mid = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2];
      const sh = isShaded(mid, sp, grid, buildings);
      const l = dist(pa, pb);
      segs.push({ a: pa, b: pb, shaded: sh });
      total += l;
      if (sh) shadedLen += l;
    }
  }
  return { segs, shadePct: total ? shadedLen / total : 0 };
}
