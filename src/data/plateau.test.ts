import { describe, it, expect } from 'vitest';
import proj4 from 'proj4';
import { mergeBuildings } from './plateau';
import { makeBuilding } from '../shade/buildings';
import type { LatLng } from '../types';

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

describe('proj4 EPSG:6677 往復', () => {
  it('WGS84→6677→WGS84 が元に戻る', () => {
    const lng = 139.7671, lat = 35.6812;
    const xy = proj4('WGS84', EPSG6677, [lng, lat]);
    const back = proj4(EPSG6677, 'WGS84', xy);
    expect(back[0]).toBeCloseTo(lng, 6);
    expect(back[1]).toBeCloseTo(lat, 6);
  });
});
