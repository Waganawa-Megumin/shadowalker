// OSRM（FOSSGIS の foot プロファイル、最終手段に car）
import type { LatLng, RouteResult, RoutingProvider } from '../types';
import { API, CLIENT_ID } from '../config';

async function osrm(base: string, start: LatLng, end: LatLng, source: string, signal?: AbortSignal): Promise<RouteResult[]> {
  const u = `${base}/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson&alternatives=true`;
  const r = await fetch(u, { signal, headers: { 'X-Client-Id': CLIENT_ID } });
  const j = await r.json();
  if (j.code !== 'Ok' || !j.routes?.length) throw new Error('osrm: no route');
  return j.routes.map((rt: any) => ({
    coords: rt.geometry.coordinates.map((c: number[]) => [c[1], c[0]]) as LatLng[],
    distance: rt.distance,
    source,
  }));
}

export const osrmFootProvider: RoutingProvider = {
  name: 'osrm-foot',
  route: (s, e, sig) => osrm(API.osrmFoot, s, e, 'osrm-foot', sig),
};

export const osrmCarProvider: RoutingProvider = {
  name: 'osrm-car',
  route: (s, e, sig) => osrm(API.osrmCar, s, e, 'osrm-car', sig),
};
