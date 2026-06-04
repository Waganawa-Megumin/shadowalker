import { describe, it, expect } from 'vitest';
import { computeWBGT, wbgtLevel } from './weather';

describe('WBGT 近似', () => {
  it('高温多湿(30℃/60%)は厳重警戒級', () => {
    const w = computeWBGT(30, 60);
    expect(w).toBeGreaterThan(29);
    expect(w).toBeLessThan(33);
    expect(wbgtLevel(w).label).toBe('厳重警戒');
  });
  it('涼しい日(20℃/50%)は注意未満', () => {
    expect(computeWBGT(20, 50)).toBeLessThan(21);
    expect(wbgtLevel(20).label).toBe('ほぼ安全');
  });
  it('区分の境界', () => {
    expect(wbgtLevel(25).label).toBe('警戒');
    expect(wbgtLevel(28).label).toBe('厳重警戒');
    expect(wbgtLevel(31).label).toBe('危険');
  });
});
