import { describe, it, expect } from 'vitest';
import { buildCoveredIndex } from './covered';
import type { CoveredWay, LatLng } from '../types';

const way: CoveredWay = {
  kind: 'underground', strength: 1.0,
  line: [[35.6810, 139.7670], [35.6810, 139.7680]],
};
const bridge: CoveredWay = {
  kind: 'bridge', strength: 0.8,
  line: [[35.6830, 139.7670], [35.6830, 139.7680]],
};

describe('covered index', () => {
  const idx = buildCoveredIndex([way, bridge]);
  it('10m以内は命中', () => {
    const hit = idx.hitAt([35.68105, 139.7675] as LatLng, 10);
    expect(hit.covered).toBe(true);
    expect(hit.strength).toBe(1.0);
  });
  it('遠ければ非命中', () => {
    expect(idx.hitAt([35.6820, 139.7675], 10).covered).toBe(false);
  });
  it('橋下は強度0.8', () => {
    expect(idx.hitAt([35.68305, 139.7675], 10).strength).toBeCloseTo(0.8, 5);
  });
});
