// 覆い経路（アーケード・地下・高架下）の rbush 索引
import RBush from 'rbush';
import type { CoveredWay, CoveredIndex, LatLng } from '../types';
import { pointToSegmentM } from '../geo';

interface Seg { minX: number; minY: number; maxX: number; maxY: number; a: LatLng; b: LatLng; strength: number; }

// 緯度経度をそのまま XY として rbush に載せ、近傍を bbox 拡張で引く
export function buildCoveredIndex(ways: CoveredWay[]): CoveredIndex {
  const tree = new RBush<Seg>();
  const items: Seg[] = [];
  for (const w of ways) {
    for (let i = 0; i < w.line.length - 1; i++) {
      const a = w.line[i], b = w.line[i + 1];
      items.push({
        minX: Math.min(a[1], b[1]), maxX: Math.max(a[1], b[1]),
        minY: Math.min(a[0], b[0]), maxY: Math.max(a[0], b[0]),
        a, b, strength: w.strength,
      });
    }
  }
  tree.load(items);

  return {
    hitAt(pt: LatLng, radiusM: number) {
      const dLat = radiusM / 111320;
      const dLng = radiusM / (111320 * Math.cos(pt[0] * Math.PI / 180));
      const found = tree.search({ minX: pt[1] - dLng, maxX: pt[1] + dLng, minY: pt[0] - dLat, maxY: pt[0] + dLat });
      let best = 0;
      for (const s of found) {
        if (pointToSegmentM(pt, s.a, s.b) <= radiusM) best = Math.max(best, s.strength);
      }
      return { covered: best > 0, strength: best };
    },
  };
}
