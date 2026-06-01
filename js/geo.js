// 幾何ヘルパ + 現在地取得
// 座標は一貫して [lat, lng] 配列で扱う。

export const RAD = Math.PI / 180;
const R = 6371000; // 地球半径[m]

export function bearing(a, b) {
  const φ1 = a[0] * RAD, φ2 = b[0] * RAD, Δλ = (b[1] - a[1]) * RAD;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}

export function dist(a, b) {
  const φ1 = a[0] * RAD, φ2 = b[0] * RAD, Δφ = (b[0] - a[0]) * RAD, Δλ = (b[1] - a[1]) * RAD;
  const h = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function destPoint(p, brngDeg, distM) {
  const δ = distM / R, θ = brngDeg * RAD, φ1 = p[0] * RAD, λ1 = p[1] * RAD;
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
  return [φ2 / RAD, λ2 / RAD];
}

// pt=[lat,lng]; poly=[[lat,lng]...]
export function pointInPoly(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const yi = poly[i][0], xi = poly[i][1], yj = poly[j][0], xj = poly[j][1];
    if (((yi > pt[0]) !== (yj > pt[0])) && (pt[1] < (xj - xi) * (pt[0] - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

// navigator.geolocation を Promise 化。返り値 {lat,lng,accuracy}
export function getCurrentPosition(opts = {}) {
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
