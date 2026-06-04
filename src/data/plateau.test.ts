import { describe, it, expect } from 'vitest';
import proj4 from 'proj4';
import { mergeBuildings, parsePlateauTile } from './plateau';
import { makeBuilding } from '../shade/buildings';
import type { Bbox, LatLng } from '../types';

const EPSG6677 = '+proj=tmerc +lat_0=36 +lon_0=139.8333333333 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs';

describe('mergeBuildings', () => {
  it('重複する Overpass 建物は PLATEAU で置換、非重複は保持', () => {
    const sq = (la: number, ln: number, d: number): LatLng[] =>
      [[la, ln], [la + d, ln], [la + d, ln + d], [la, ln + d]];
    const overlapping = makeBuilding(sq(35.6810, 139.7670, 0.0003), 9, 'overpass');
    const elsewhere = makeBuilding(sq(35.6900, 139.7800, 0.0003), 9, 'overpass');
    const plateau = makeBuilding(sq(35.68105, 139.76705, 0.0002), 120, 'plateau');
    const merged = mergeBuildings([overlapping, elsewhere], [plateau]);
    expect(merged).toContain(plateau);
    expect(merged).toContain(elsewhere);
    expect(merged).not.toContain(overlapping);
  });
  it('PLATEAU 空ならそのまま', () => {
    const o = makeBuilding([[0, 0], [0, 1], [1, 1]], 9, 'overpass');
    expect(mergeBuildings([o], [])).toEqual([o]);
  });
});

describe('parsePlateauTile', () => {
  const bbox: Bbox = { s: 35.68, n: 35.70, w: 139.69, e: 139.71 };
  it('[h, flatRing] を bbox 内 Building に変換（flat は lng,lat 順）', () => {
    const tile: [number, number[]][] = [
      [120, [139.700, 35.690, 139.701, 35.690, 139.701, 35.691, 139.700, 35.691]],
    ];
    const out = parsePlateauTile(tile, bbox);
    expect(out).toHaveLength(1);
    expect(out[0].h).toBe(120);
    expect(out[0].source).toBe('plateau');
    expect(out[0].poly[0]).toEqual([35.690, 139.700]); // [lat,lng]
  });
  it('bbox 外や頂点不足は除外', () => {
    const tile: [number, number[]][] = [
      [30, [140.0, 36.0, 140.001, 36.0, 140.001, 36.001]], // bbox外
      [30, [139.700, 35.690, 139.701, 35.690]],            // 2点のみ
    ];
    expect(parsePlateauTile(tile, bbox)).toHaveLength(0);
  });
});

describe('proj4 EPSG:6677 往復', () => {
  it('WGS84→6677→WGS84 が元に戻る', () => {
    const lng = 139.7671, lat = 35.6812;
    const xy = proj4('WGS84', EPSG6677, [lng, lat]);
    const back = proj4(EPSG6677, 'WGS84', xy);
    expect(back[0]).toBeCloseTo(lng, 6);
    expect(back[1]).toBeCloseTo(lat, 6);
  });
});
