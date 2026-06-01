import { describe, it, expect } from 'vitest';
import { solarPosition } from './position';

describe('solarPosition', () => {
  it('東京・夏至正午(JST=03:00UTC)は高度が高く南寄り', () => {
    const sp = solarPosition(new Date(Date.UTC(2026, 5, 21, 3, 0)), 35.681, 139.767);
    expect(sp.altitude).toBeGreaterThan(70);
    expect(sp.azimuth).toBeGreaterThan(120);
    expect(sp.azimuth).toBeLessThan(240);
  });
  it('深夜は高度が負', () => {
    const sp = solarPosition(new Date(Date.UTC(2026, 5, 21, 15, 0)), 35.681, 139.767); // 00:00 JST
    expect(sp.altitude).toBeLessThan(0);
  });
});
