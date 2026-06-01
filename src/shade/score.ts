// 経路の日陰スコアリング（建物・覆い経路・街路樹を合成）
import type { LatLng, ShadeContext, SampleResult, ScoredRoute, RouteResult } from '../types';
import { dist } from '../geo';
import { isShaded } from './ray';
import { treeShadeStrength } from './trees';
import { SAMPLE_M, COVERED_RADIUS_M } from '../config';

// 1サンプル点の実効日陰強度と覆い判定
export function sampleShade(mid: LatLng, ctx: ShadeContext): { strength: number; covered: boolean } {
  const building = isShaded(mid, ctx.sp, ctx.grid, ctx.buildings) ? 1 : 0;
  const cov = ctx.covered ? ctx.covered.hitAt(mid, COVERED_RADIUS_M) : { covered: false, strength: 0 };
  const tree = ctx.trees ? treeShadeStrength(mid, ctx.sp, ctx.trees) : 0;
  const strength = Math.max(building, cov.strength, tree);
  return { strength, covered: cov.covered };
}

export function scoreRoute(coords: LatLng[], ctx: ShadeContext): { segs: SampleResult[]; shadePct: number; coveredPct: number } {
  const segs: SampleResult[] = [];
  let shadedW = 0, coveredLen = 0, total = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i], b = coords[i + 1];
    const segLen = dist(a, b);
    if (segLen < 1) continue;
    const steps = Math.max(1, Math.round(segLen / SAMPLE_M));
    for (let s = 0; s < steps; s++) {
      const t0 = s / steps, t1 = (s + 1) / steps;
      const pa: LatLng = [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0];
      const pb: LatLng = [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1];
      const mid: LatLng = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2];
      const { strength, covered } = sampleShade(mid, ctx);
      const l = dist(pa, pb);
      segs.push({ a: pa, b: pb, shaded: strength >= 0.5, strength, covered });
      total += l;
      shadedW += l * strength;
      if (covered) coveredLen += l;
    }
  }
  return {
    segs,
    shadePct: total ? shadedW / total : 0,
    coveredPct: total ? coveredLen / total : 0,
  };
}

// RouteResult[] をスコア付きに（複合スコアは呼び出し側で付与）
export function scoreRoutes(routes: RouteResult[], ctx: ShadeContext): ScoredRoute[] {
  return routes.map((r, i) => {
    const sc = scoreRoute(r.coords, ctx);
    return { ...r, ...sc, name: i === 0 ? '最短経路' : '別ルート ' + i };
  });
}
