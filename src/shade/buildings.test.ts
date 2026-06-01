import { describe, it, expect } from 'vitest';
import { parseLevels, makeBuilding, buildGrid, cellOf } from './buildings';
import type { LatLng } from '../types';

describe('parseLevels', () => {
  it('乱雑な表記から階数を抽出', () => {
    expect(parseLevels('5')).toBe(5);
    expect(parseLevels('5-7')).toBe(5);
    expect(parseLevels('G+4')).toBe(4);
    expect(parseLevels('地上5')).toBe(5);
  });
  it('解釈不能は null', () => {
    expect(parseLevels(undefined)).toBeNull();
    expect(parseLevels('abc')).toBeNull();
  });
});

describe('buildGrid/cellOf', () => {
  it('建物が属するセルから index を引ける', () => {
    const poly: LatLng[] = [[35.6810, 139.7670], [35.6812, 139.7670], [35.6812, 139.7673], [35.6810, 139.7673]];
    const b = makeBuilding(poly, 30);
    const bbox = { s: 35.6805, w: 139.7665, n: 35.6820, e: 139.7685 };
    const grid = buildGrid([b], bbox);
    expect(cellOf(grid, 35.6811, 139.76715)).toContain(0);
    expect(cellOf(grid, 35.6818, 139.7684)).not.toContain(0);
  });
});
