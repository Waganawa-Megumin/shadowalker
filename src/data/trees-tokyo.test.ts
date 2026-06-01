import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';

// 同梱した街路樹タイルデータの健全性（実データのコミット崩れを検知）
describe('tokyo tree tiles data', () => {
  const idx = JSON.parse(readFileSync('public/data/trees/index.json', 'utf8'));
  it('index は deg と tiles[] を持つ', () => {
    expect(idx.deg).toBeGreaterThan(0);
    expect(Array.isArray(idx.tiles)).toBe(true);
    expect(idx.tiles.length).toBeGreaterThan(50);
  });
  it('各タイルファイルは [lng,lat,h,cr] の配列で、座標は東京近辺', () => {
    const k = idx.tiles[Math.floor(idx.tiles.length / 2)];
    const arr = JSON.parse(readFileSync(`public/data/trees/t/${k}.json`, 'utf8')) as number[][];
    expect(arr.length).toBeGreaterThan(0);
    const [lng, lat, h, cr] = arr[0];
    expect(lng).toBeGreaterThan(138); expect(lng).toBeLessThan(141);
    expect(lat).toBeGreaterThan(35); expect(lat).toBeLessThan(36.5);
    expect(h).toBeGreaterThan(0); expect(cr).toBeGreaterThan(0);
    // tile key とファイル名の整合
    const [tx, ty] = k.split('_').map(Number);
    expect(Math.floor(lng / idx.deg)).toBe(tx);
    expect(Math.floor(lat / idx.deg)).toBe(ty);
  });
  it('タイルファイル数が index と概ね一致', () => {
    const files = readdirSync('public/data/trees/t').filter(f => f.endsWith('.json'));
    expect(files.length).toBe(idx.tiles.length);
  });
});
