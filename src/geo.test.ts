import { describe, it, expect } from 'vitest';
import { dist, destPoint, bearing, pointInPoly, pointToSegmentM } from './geo';
import type { LatLng } from './types';

describe('geo', () => {
  it('dist: 緯度0.01°≈1.11km', () => {
    expect(Math.abs(dist([35.681, 139.767], [35.691, 139.767]) - 1112)).toBeLessThan(30);
  });
  it('destPoint→dist 往復', () => {
    const p: LatLng = [35.681, 139.767];
    const q = destPoint(p, 90, 100);
    expect(Math.abs(dist(p, q) - 100)).toBeLessThan(1);
    expect(Math.abs(bearing(p, q) - 90)).toBeLessThan(1);
  });
  it('pointInPoly 内外', () => {
    const sq: LatLng[] = [[0, 0], [0, 2], [2, 2], [2, 0]];
    expect(pointInPoly([1, 1], sq)).toBe(true);
    expect(pointInPoly([3, 1], sq)).toBe(false);
  });
  it('pointToSegmentM: 線分中点直上の距離', () => {
    const d = pointToSegmentM([35.6815, 139.767], [35.681, 139.766], [35.681, 139.768]);
    expect(Math.abs(d - dist([35.681, 139.767], [35.6815, 139.767]))).toBeLessThan(3);
  });
});
