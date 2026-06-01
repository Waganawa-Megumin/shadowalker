import { describe, it, expect } from 'vitest';
import { scoreRoute } from './score';
import { buildGrid } from './buildings';
import { buildCoveredIndex } from './covered';
import type { LatLng, ShadeContext, CoveredWay } from '../types';

describe('scoreRoute', () => {
  it('覆い経路に沿う区間は覆い率・日陰率が高い（建物なし）', () => {
    const line: LatLng[] = [[35.6810, 139.7670], [35.6810, 139.7680]];
    const cov: CoveredWay = { line, kind: 'underground', strength: 1.0 };
    const ctx: ShadeContext = {
      sp: { azimuth: 180, altitude: 45 },
      grid: buildGrid([], { s: 35.6805, w: 139.7665, n: 35.6815, e: 139.7685 }),
      buildings: [],
      covered: buildCoveredIndex([cov]),
    };
    const { shadePct, coveredPct, segs } = scoreRoute(line, ctx);
    expect(coveredPct).toBeGreaterThan(0.8);
    expect(shadePct).toBeGreaterThan(0.8);
    expect(segs.every(s => s.covered)).toBe(true);
  });
});
