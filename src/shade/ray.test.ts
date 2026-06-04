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
  it('薄明・夜(高度<=SHADE_ALT_MIN)は常に日陰扱い', () => {
    expect(isShaded(pt, { azimuth: 180, altitude: 0.2 }, grid, buildings)).toBe(true);
  });
  it('高層(100m)の影は90m超でも届く（MAX_REACH=120）', () => {
    const c = destPoint([35.6810, 139.7675], 0, 110); // 110m 北の高層
    const el = 0.0002, eg = 0.0010;
    const poly: LatLng[] = [[c[0] - el, c[1] - eg], [c[0] + el, c[1] - eg], [c[0] + el, c[1] + eg], [c[0] - el, c[1] + eg]];
    const bs = [makeBuilding(poly, 100)];
    const g = buildGrid(bs, { s: 35.6800, w: 139.7660, n: 35.6830, e: 139.7690 });
    expect(isShaded([35.6810, 139.7675], { azimuth: 0, altitude: 30 }, g, bs)).toBe(true);
  });
});
