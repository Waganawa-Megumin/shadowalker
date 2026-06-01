// 街路樹のディスク状遮蔽（rbush 索引）
import RBush from 'rbush';
import type { Tree, TreeIndex, SolarPosition, LatLng } from '../types';
import { RAD, destPoint, dist } from '../geo';
import { MAX_REACH, MAX_BLD_H, RAY_STEP, SHADE_ALT_MIN } from '../config';

interface TItem { minX: number; minY: number; maxX: number; maxY: number; tree: Tree; }

export function buildTreeIndex(trees: Tree[]): TreeIndex {
  const rb = new RBush<TItem>();
  rb.load(trees.map(t => ({ minX: t.minLng, maxX: t.maxLng, minY: t.minLat, maxY: t.maxLat, tree: t })));
  return {
    get size() { return trees.length; },
    near(lat: number, lng: number, radiusM: number): Tree[] {
      const dLat = radiusM / 111320;
      const dLng = radiusM / (111320 * Math.cos(lat * RAD));
      return rb.search({ minX: lng - dLng, maxX: lng + dLng, minY: lat - dLat, maxY: lat + dLat }).map(i => i.tree);
    },
  };
}

// pt における樹冠遮蔽の強度 0..1。太陽方位レイ上で遮る樹を数え 1-(1-0.4)^n 相当で合成。
export function treeShadeStrength(pt: LatLng, sp: SolarPosition, index: TreeIndex): number {
  if (sp.altitude <= SHADE_ALT_MIN) return 0; // 夜は建物側で日陰扱い
  const tanAlt = Math.tan(sp.altitude * RAD);
  const maxReach = Math.min(MAX_REACH, MAX_BLD_H / tanAlt + 5);
  const cand = index.near(pt[0], pt[1], maxReach);
  if (!cand.length) return 0;
  let opacityProduct = 1; // Π transmittance（遮るほど小さく）
  const hit = new Set<Tree>();
  for (let dd = RAY_STEP; dd <= maxReach; dd += RAY_STEP) {
    const probe = destPoint(pt, sp.azimuth, dd);
    const needH = dd * tanAlt;
    for (const t of cand) {
      if (hit.has(t)) continue;
      if (t.height < needH) continue;
      if (dist(probe, t.center) <= t.radius) {
        opacityProduct *= t.transmittance;
        hit.add(t);
      }
    }
  }
  return 1 - opacityProduct; // n本で 1-(transmittance)^n
}
