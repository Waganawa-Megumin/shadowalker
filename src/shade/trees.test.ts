import { describe, it, expect } from 'vitest';
import { buildTreeIndex, treeShadeStrength } from './trees';
import { makeTree } from '../data/overpass';
import type { SolarPosition } from '../types';

// 影は南へ伸びるので北の樹で遮蔽。高度45°では樹高ぶんの距離まで影が届く（高さ20m→約20m先まで）。
const sunNorth: SolarPosition = { azimuth: 0, altitude: 45 };
const north = (m: number) => 35.6810 + m / 111320;

describe('trees', () => {
  it('太陽方向の高い樹で部分日陰（透過0.4→強度0.6）', () => {
    const t = makeTree([north(8), 139.7675], 3, 20, 'osm');
    const idx = buildTreeIndex([t]);
    expect(treeShadeStrength([35.6810, 139.7675], sunNorth, idx)).toBeCloseTo(0.6, 5);
  });
  it('2本重なると 1-0.4^2 = 0.84', () => {
    const idx = buildTreeIndex([makeTree([north(8), 139.7675], 3, 20, 'osm'), makeTree([north(12), 139.7675], 3, 20, 'osm')]);
    expect(treeShadeStrength([35.6810, 139.7675], sunNorth, idx)).toBeCloseTo(0.84, 5);
  });
  it('夜は0', () => {
    const idx = buildTreeIndex([makeTree([north(8), 139.7675], 3, 20, 'osm')]);
    expect(treeShadeStrength([35.6810, 139.7675], { azimuth: 0, altitude: 0.2 }, idx)).toBe(0);
  });
});
