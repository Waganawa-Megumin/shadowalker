// ルーティング抽象化：プロバイダを順に試し、最低3本になるよう擬似代替を補う
import type { LatLng, RouteResult, RoutingProvider } from '../types';
import { brouterProvider } from './brouter';
import { osrmFootProvider, osrmCarProvider } from './osrm-foot';
import { valhallaProvider } from './valhalla';
import { dedupe, lineLength } from './geom';
import { destPoint, bearing, dist } from '../geo';
import { STUB } from '../config';

export const providers: RoutingProvider[] = [
  brouterProvider, osrmFootProvider, valhallaProvider, osrmCarProvider,
];

export async function fetchRoutes(start: LatLng, end: LatLng, signal?: AbortSignal): Promise<RouteResult[]> {
  let primary: RoutingProvider | null = null;
  let routes: RouteResult[] = [];
  let lastErr: unknown;

  for (const p of providers) {
    try {
      const r = await p.route(start, end, signal);
      if (r.length) { routes = dedupe(r); primary = p; break; }
    } catch (e) { lastErr = e; }
  }

  if (!routes.length) {
    if (STUB || import.meta.env?.DEV) {
      const stub = await loadSampleRoutes();
      if (stub.length) return stub;
    }
    throw lastErr || new Error('ルートを取得できませんでした');
  }

  // 3本未満なら直交オフセット中継点で擬似代替を生成
  if (routes.length < 3 && primary) {
    const brg = bearing(start, end);
    const half = dist(start, end) / 2;
    const offset = Math.min(250, Math.max(80, half * 0.25));
    for (const sign of [1, -1]) {
      if (routes.length >= 3) break;
      try {
        const alt = await synthViaOffset(primary, start, end, brg + 90 * sign, offset, signal);
        if (alt) routes = dedupe([...routes, alt]);
      } catch { /* best-effort */ }
    }
  }
  return routes;
}

// start→via→end を2回ルーティングして連結（generic に via 経路を作る）
async function synthViaOffset(
  p: RoutingProvider, start: LatLng, end: LatLng, offsetBrg: number, offsetM: number, signal?: AbortSignal,
): Promise<RouteResult | null> {
  const mid: LatLng = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
  const via = destPoint(mid, offsetBrg, offsetM);
  const [leg1, leg2] = await Promise.all([p.route(start, via, signal), p.route(via, end, signal)]);
  if (!leg1[0] || !leg2[0]) return null;
  const coords = [...leg1[0].coords, ...leg2[0].coords.slice(1)];
  return { coords, distance: lineLength(coords), source: p.name + '-via' };
}

async function loadSampleRoutes(): Promise<RouteResult[]> {
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}data/sample/route-shinjuku.json`);
    const j = await r.json();
    return (j.features || []).map((f: any) => {
      const coords: LatLng[] = f.geometry.coordinates.map((c: number[]) => [c[1], c[0]]);
      return { coords, distance: parseFloat(f.properties?.['track-length']) || lineLength(coords), source: 'sample' };
    });
  } catch { return []; }
}
