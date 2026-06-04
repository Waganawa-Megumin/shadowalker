import { describe, it, expect } from 'vitest';
import { computeWBGT, wbgtLevel } from './weather';

describe('WBGT 近似（小野・登内式）', () => {
  it('高温多湿＋強日射(30℃/60%/0.8kW/2m/s)は厳重警戒級', () => {
    const w = computeWBGT(30, 60, 0.8, 2);
    expect(w).toBeGreaterThan(27);
    expect(w).toBeLessThan(30);
    expect(wbgtLevel(w).label).toBe('厳重警戒');
  });
  it('日射が入ると日陰時より上がる', () => {
    expect(computeWBGT(30, 60, 0.8, 2)).toBeGreaterThan(computeWBGT(30, 60, 0, 2));
  });
  it('涼しい日(20℃/50%/日射なし)は注意未満', () => {
    expect(computeWBGT(20, 50, 0, 1)).toBeLessThan(21);
  });
  it('区分の境界', () => {
    expect(wbgtLevel(25).label).toBe('警戒');
    expect(wbgtLevel(28).label).toBe('厳重警戒');
    expect(wbgtLevel(31).label).toBe('危険');
  });
});
