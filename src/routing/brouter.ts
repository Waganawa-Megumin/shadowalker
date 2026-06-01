// BRouter foot（キー不要・徒歩。1リクエスト=1ルートなので alternativeidx 0..3 を並列）
import type { LatLng, RouteResult, RoutingProvider } from '../types';
import { API } from '../config';
import { lineLength } from './geom';

export const brouterProvider: RoutingProvider = {
  name: 'brouter',
  async route(start: LatLng, end: LatLng, signal?: AbortSignal): Promise<RouteResult[]> {
    const lonlats = `${start[1]},${start[0]}|${end[1]},${end[0]}`;
    const reqs = [0, 1, 2, 3].map(idx => {
      const u = `${API.brouter}?lonlats=${encodeURIComponent(lonlats)}&profile=foot&alternativeidx=${idx}&format=geojson`;
      return fetch(u, { signal }).then(r => r.ok ? r.json() : Promise.reject(new Error('brouter ' + r.status)));
    });
    const settled = await Promise.allSettled(reqs);
    const out: RouteResult[] = [];
    for (const s of settled) {
      if (s.status !== 'fulfilled') continue;
      const feat = s.value.features?.[0];
      if (!feat?.geometry) continue;
      const coords: LatLng[] = feat.geometry.coordinates.map((c: number[]) => [c[1], c[0]]);
      if (coords.length < 2) continue;
      const distance = parseFloat(feat.properties?.['track-length']) || lineLength(coords);
      out.push({ coords, distance, source: 'brouter' });
    }
    if (!out.length) throw new Error('brouter: no route');
    return out;
  },
};
