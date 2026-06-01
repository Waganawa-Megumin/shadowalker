import { describe, it, expect } from 'vitest';
import { makeBuilding, buildGrid } from './buildings';
import { isShaded } from './ray';
import { destPoint } from '../geo';
import type { LatLng, Building } from '../types';

function setup(): { grid: ReturnType<typeof buildGrid>; buildings: Building[] } {
  const bn = destPoint([35.6810, 139.7675], 0, 25); // 経路点の25m北に高い建物
  const el = 0.0001, eg = 0.0006;
  const poly: LatLng[] = [[bn[0] - el, bn[1] - eg], [bn[0] + el, bn[1] - eg], [bn[0] + el, bn[1] + eg], [bn[0] - el, bn[1] + eg]];
  const buildings = [makeBuilding(poly, 30)];
  const grid = buildGrid(buildings, { s: 35.6805, w: 139.7665, n: 35.6820, e: 139.7685 });
  return { grid, buildings };
}

describe('isShaded', () => {
  const { grid, buildings } = setup();
  const pt: LatLng = [35.6810, 139.7675];
  it('太陽が北(影は南)→北の建物で日陰', () => {
    expect(isShaded(pt, { azimuth: 0, altitude: 45 }, grid, buildings)).toBe(true);
  });
  it('太陽が南→北の建物では日陰にならない', () => {
    expect(isShaded(pt, { azimuth: 180, altitude: 45 }, grid, buildings)).toBe(false);
  });
  it('夜(高度<=0.5)は常に日陰扱い', () => {
    expect(isShaded(pt, { azimuth: 180, altitude: 0.2 }, grid, buildings)).toBe(true);
  });
});
