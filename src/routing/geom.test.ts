import { describe, it, expect } from 'vitest';
import { lineLength, dedupe, decodePolyline } from './geom';
import type { RouteResult, LatLng } from '../types';

describe('routing/geom', () => {
  it('lineLength ≈ haversine 概算', () => {
    const c: LatLng[] = [[35.681, 139.767], [35.691, 139.767]];
    expect(Math.abs(lineLength(c) - 1112)).toBeLessThan(40);
  });
  it('dedupe: 同一は1本、別物は2本', () => {
    const a: RouteResult = { coords: [[35.68, 139.76], [35.69, 139.77], [35.70, 139.78]], distance: 1000, source: 'x' };
    const b: RouteResult = { ...a };
    const c: RouteResult = { coords: [[35.68, 139.76], [35.685, 139.80], [35.70, 139.78]], distance: 1400, source: 'y' };
    expect(dedupe([a, b]).length).toBe(1);
    expect(dedupe([a, c]).length).toBe(2);
  });
  it('decodePolyline(precision5) 既知値', () => {
    const pts = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@', 5);
    expect(pts.length).toBe(3);
    expect(pts[0][0]).toBeCloseTo(38.5, 4);
    expect(pts[0][1]).toBeCloseTo(-120.2, 4);
    expect(pts[2][0]).toBeCloseTo(43.252, 3);
  });
});
