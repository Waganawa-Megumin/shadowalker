// Valhalla（FOSSGIS, pedestrian costing, 代替ルート対応）
import type { LatLng, RouteResult, RoutingProvider } from '../types';
import { API, CLIENT_ID } from '../config';
import { decodePolyline } from './geom';

export const valhallaProvider: RoutingProvider = {
  name: 'valhalla',
  async route(start: LatLng, end: LatLng, signal?: AbortSignal): Promise<RouteResult[]> {
    const body = {
      locations: [{ lat: start[0], lon: start[1] }, { lat: end[0], lon: end[1] }],
      costing: 'pedestrian',
      alternates: 2,
      directions_options: { units: 'kilometers' },
    };
    const u = `${API.valhalla}?json=${encodeURIComponent(JSON.stringify(body))}`;
    const r = await fetch(u, { signal, headers: { 'X-Client-Id': CLIENT_ID } });
    const j = await r.json();
    const trips = [j.trip, ...(j.alternates || []).map((a: any) => a.trip)].filter(Boolean);
    const out: RouteResult[] = [];
    for (const trip of trips) {
      const coords: LatLng[] = [];
      for (const leg of trip.legs || []) coords.push(...decodePolyline(leg.shape, 6));
      if (coords.length < 2) continue;
      out.push({ coords, distance: (trip.summary?.length || 0) * 1000, source: 'valhalla' });
    }
    if (!out.length) throw new Error('valhalla: no route');
    return out;
  },
};
