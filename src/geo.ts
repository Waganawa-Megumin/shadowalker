// 幾何ヘルパ + 現在地取得（座標は [lat, lng]）
import type { LatLng } from './types';

export const RAD = Math.PI / 180;
const R = 6371000; // 地球半径[m]

export function bearing(a: LatLng, b: LatLng): number {
  const φ1 = a[0] * RAD, φ2 = b[0] * RAD, Δλ = (b[1] - a[1]) * RAD;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}

export function dist(a: LatLng, b: LatLng): number {
  const φ1 = a[0] * RAD, φ2 = b[0] * RAD, Δφ = (b[0] - a[0]) * RAD, Δλ = (b[1] - a[1]) * RAD;
  const h = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function destPoint(p: LatLng, brngDeg: number, distM: number): LatLng {
  const δ = distM / R, θ = brngDeg * RAD, φ1 = p[0] * RAD, λ1 = p[1] * RAD;
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
  return [φ2 / RAD, λ2 / RAD];
}

export function pointInPoly(pt: LatLng, poly: LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const yi = poly[i][0], xi = poly[i][1], yj = poly[j][0], xj = poly[j][1];
    if (((yi > pt[0]) !== (yj > pt[0])) && (pt[1] < (xj - xi) * (pt[0] - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

// 点と線分の最短距離[m]（近似: 緯度経度を局所平面化）
export function pointToSegmentM(p: LatLng, a: LatLng, b: LatLng): number {
  const latRef = (a[0] + b[0]) / 2;
  const kx = 111320 * Math.cos(latRef * RAD), ky = 110540;
  const px = p[1] * kx, py = p[0] * ky;
  const ax = a[1] * kx, ay = a[0] * ky;
  const bx = b[1] * kx, by = b[0] * ky;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

export function getCurrentPosition(opts: PositionOptions = {}): Promise<{ lat: number; lng: number; accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('この端末は位置情報に対応していません'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      err => {
        const msg = err.code === err.PERMISSION_DENIED ? '位置情報の利用が許可されていません'
          : err.code === err.TIMEOUT ? '位置情報の取得がタイムアウトしました'
          : '現在地を取得できませんでした';
        reject(new Error(msg));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000, ...opts }
    );
  });
}
