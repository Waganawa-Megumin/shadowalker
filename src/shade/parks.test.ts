import { describe, it, expect } from 'vitest';
import { buildParkIndex } from './parks';
import type { Park, LatLng } from '../types';

function park(la: number, ln: number, d: number): Park {
  const ring: LatLng[] = [[la, ln], [la + d, ln], [la + d, ln + d], [la, ln + d], [la, ln]];
  return { ring, minLat: la, maxLat: la + d, minLng: ln, maxLng: ln + d };
}

describe('buildParkIndex.inPark', () => {
  const idx = buildParkIndex([park(35.690, 139.700, 0.004)]);
  it('公園内は true', () => {
    expect(idx.inPark(35.692, 139.702)).toBe(true);
  });
  it('公園外は false', () => {
    expect(idx.inPark(35.690, 139.710)).toBe(false);
    expect(idx.inPark(35.700, 139.702)).toBe(false);
  });
  it('size を返す', () => {
    expect(idx.size).toBe(1);
  });
});
