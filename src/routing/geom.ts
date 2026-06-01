// ルーティング用の小さな幾何ヘルパ（依存を持たず単体テスト可能）
import type { LatLng, RouteResult } from '../types';

export function lineLength(coords: LatLng[]): number {
  let d = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i], b = coords[i + 1];
    const dx = (b[1] - a[1]) * Math.cos(a[0] * Math.PI / 180), dy = b[0] - a[0];
    d += Math.sqrt(dx * dx + dy * dy) * 111320;
  }
  return d;
}

function same(a: LatLng, b: LatLng): boolean {
  return Math.abs(a[0] - b[0]) < 1e-4 && Math.abs(a[1] - b[1]) < 1e-4;
}

// 端点・中点・総距離が近いルートを重複とみなす
export function dedupe(routes: RouteResult[]): RouteResult[] {
  const out: RouteResult[] = [];
  for (const r of routes) {
    const dup = out.some(o =>
      Math.abs(o.distance - r.distance) < 15 &&
      same(o.coords[0], r.coords[0]) &&
      same(o.coords[o.coords.length - 1], r.coords[r.coords.length - 1]) &&
      same(o.coords[Math.floor(o.coords.length / 2)], r.coords[Math.floor(r.coords.length / 2)]));
    if (!dup) out.push(r);
  }
  return out;
}

// Google polyline / Valhalla polyline6 デコード
export function decodePolyline(str: string, precision = 6): LatLng[] {
  let index = 0, lat = 0, lng = 0;
  const coords: LatLng[] = [];
  const factor = Math.pow(10, precision);
  while (index < str.length) {
    let result = 0, shift = 0, byte: number;
    do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    result = 0; shift = 0;
    do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    coords.push([lat / factor, lng / factor]);
  }
  return coords;
}
