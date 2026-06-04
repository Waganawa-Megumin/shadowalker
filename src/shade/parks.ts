// 公園・緑地ポリゴンの空間索引（rbush）と内外判定
import RBush from 'rbush';
import type { Park, ParkIndex } from '../types';
import { pointInPoly } from '../geo';

interface PItem { minX: number; minY: number; maxX: number; maxY: number; park: Park; }

export function buildParkIndex(parks: Park[]): ParkIndex {
  const rb = new RBush<PItem>();
  rb.load(parks.map(p => ({ minX: p.minLng, maxX: p.maxLng, minY: p.minLat, maxY: p.maxLat, park: p })));
  return {
    get size() { return parks.length; },
    inPark(lat: number, lng: number): boolean {
      const found = rb.search({ minX: lng, maxX: lng, minY: lat, maxY: lat });
      for (const it of found) {
        if (pointInPoly([lat, lng], it.park.ring)) return true;
      }
      return false;
    },
  };
}
