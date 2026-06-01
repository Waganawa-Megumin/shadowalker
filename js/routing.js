// 徒歩ルーティング：BRouter foot → OSRM-foot → OSRM-car のフォールバック連鎖
// すべてキー不要。返り値は [{coords:[[lat,lng]...], distance, source}]
import { API } from './config.js';

// start/end = [lat,lng]
export async function fetchRoutes(start, end) {
  let lastErr;
  for (const fn of [routeBRouter, routeOsrmFoot, routeOsrmCar]) {
    try {
      const routes = await fn(start, end);
      if (routes && routes.length) return routes;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('ルートを取得できませんでした');
}

// --- BRouter（徒歩。1リクエスト＝1ルートなので alternativeidx 0..3 を並列に） ---
async function routeBRouter(start, end) {
  const lonlats = `${start[1]},${start[0]}|${end[1]},${end[0]}`;
  const reqs = [0, 1, 2, 3].map(idx => {
    const u = `${API.brouter}?lonlats=${encodeURIComponent(lonlats)}&profile=foot&alternativeidx=${idx}&format=geojson`;
    return fetch(u).then(r => r.ok ? r.json() : Promise.reject(new Error('brouter ' + r.status)));
  });
  const settled = await Promise.allSettled(reqs);
  const out = [];
  for (const s of settled) {
    if (s.status !== 'fulfilled') continue;
    const feat = s.value.features && s.value.features[0];
    if (!feat || !feat.geometry) continue;
    const coords = feat.geometry.coordinates.map(c => [c[1], c[0]]);
    if (coords.length < 2) continue;
    const props = feat.properties || {};
    const distance = parseFloat(props['track-length']) || lineLength(coords);
    out.push({ coords, distance, source: 'brouter' });
  }
  return dedupe(out);
}

// --- OSRM foot（FOSSGIS） ---
async function routeOsrmFoot(start, end) {
  return osrm(API.osrmFoot, start, end, 'osrm-foot');
}
// --- OSRM car（最終手段。car専用デモサーバ） ---
async function routeOsrmCar(start, end) {
  return osrm(API.osrmCar, start, end, 'osrm-car');
}
async function osrm(base, start, end, source) {
  const u = `${base}/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson&alternatives=true`;
  const r = await fetch(u);
  const j = await r.json();
  if (j.code !== 'Ok' || !j.routes || !j.routes.length) throw new Error('no route');
  return j.routes.map(rt => ({
    coords: rt.geometry.coordinates.map(c => [c[1], c[0]]),
    distance: rt.distance,
    source,
  }));
}

// 端点・中点・総距離が近いルートを重複とみなす
function dedupe(routes) {
  const out = [];
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
function same(a, b) { return Math.abs(a[0] - b[0]) < 1e-4 && Math.abs(a[1] - b[1]) < 1e-4; }

function lineLength(coords) {
  let d = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i], b = coords[i + 1];
    const dx = (b[1] - a[1]) * Math.cos(a[0] * Math.PI / 180), dy = b[0] - a[0];
    d += Math.sqrt(dx * dx + dy * dy) * 111320;
  }
  return d;
}
