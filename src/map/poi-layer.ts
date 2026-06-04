// 休憩スポット（給水・トイレ）の地図オーバーレイ。
// ルート評価には影響せず、表示専用。クラッタ回避のため一定ズーム以上＋表示域のみ描画。
import L from 'leaflet';
import type { Poi } from '../types';
import { loadPoi } from '../data/poi';

const MIN_ZOOM = 16;     // これ未満では描画しない（密集回避）
const MAX_MARKERS = 500; // 1画面の上限

export interface PoiLayer {
  setEnabled(on: boolean): Promise<void>;
  enabled(): boolean;
}

export function setupPoiLayer(map: L.Map): PoiLayer {
  const group = L.layerGroup();
  let enabled = false;
  let pois: Poi[] = [];

  function render(): void {
    group.clearLayers();
    if (!enabled || map.getZoom() < MIN_ZOOM) return;
    const b = map.getBounds();
    let n = 0;
    for (const p of pois) {
      if (n >= MAX_MARKERS) break;
      if (!b.contains([p.lat, p.lng])) continue;
      const water = p.kind === 'water';
      L.circleMarker([p.lat, p.lng], {
        radius: 5, weight: 1.5, color: '#fff',
        fillColor: water ? '#2E6E7E' : '#8A7E6B', fillOpacity: 0.95,
      }).bindTooltip(water ? '💧 水飲み場' : '🚻 トイレ', { direction: 'top' }).addTo(group);
      n++;
    }
  }

  map.on('moveend zoomend', render);

  return {
    enabled: () => enabled,
    async setEnabled(on: boolean): Promise<void> {
      enabled = on;
      if (on) {
        if (!pois.length) pois = await loadPoi();
        group.addTo(map);
        render();
      } else {
        group.remove();
        group.clearLayers();
      }
    },
  };
}
