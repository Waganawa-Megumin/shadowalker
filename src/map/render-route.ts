import L from 'leaflet';
import type { ScoredRoute, LatLng } from '../types';
import { renderer } from './leaflet-setup';

const COL_SHADE = '#2E6E7E';
const COL_SUN = '#E07B2E';
const COL_COVERED = '#1F4F5C';

// ルート群を描画。選択ルートは区間色分け（覆い=濃ティール破線/日陰/日なた）、他は薄灰1本。
export function drawRoutes(
  map: L.Map, group: L.LayerGroup, routes: ScoredRoute[], sel: number, start: LatLng, end: LatLng,
): void {
  group.clearLayers();
  routes.forEach((r, idx) => {
    if (idx !== sel) {
      L.polyline(r.coords as L.LatLngTuple[], { color: '#9b9286', weight: 4, opacity: .5, renderer }).addTo(group);
    } else {
      for (const s of r.segs) {
        const opts: L.PolylineOptions = s.covered
          ? { color: COL_COVERED, weight: 7, opacity: .95, dashArray: '2 6', renderer }
          : { color: s.shaded ? COL_SHADE : COL_SUN, weight: 6, opacity: .92, renderer };
        L.polyline([s.a as L.LatLngTuple, s.b as L.LatLngTuple], opts).addTo(group);
      }
    }
  });
  const all = routes[sel].coords as L.LatLngTuple[];
  map.fitBounds(L.latLngBounds(all.concat([start as L.LatLngTuple, end as L.LatLngTuple])), { padding: [40, 40] });
}
