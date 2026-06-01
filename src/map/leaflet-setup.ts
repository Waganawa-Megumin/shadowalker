import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { TILE_URL, TILE_ATTRIB } from '../config';
import type { LatLng } from '../types';

// 数百本の区間ポリライン描画に耐えるよう canvas レンダラを共有
export const renderer = L.canvas({ padding: 0.5 });

export function createMap(el: HTMLElement): L.Map {
  const map = L.map(el, { zoomControl: false, renderer }).setView([35.6812, 139.7671], 15);
  L.control.zoom({ position: 'topright' }).addTo(map);
  L.tileLayer(TILE_URL, { maxZoom: 19, attribution: TILE_ATTRIB }).addTo(map);
  return map;
}

export function pinIcon(cls: 's' | 'e'): L.DivIcon {
  return L.divIcon({ className: '', html: `<div class="pin ${cls}"></div>`, iconSize: [24, 24], iconAnchor: [12, 24] });
}

export function sunIcon(): L.DivIcon {
  return L.divIcon({ html: '<div class="sun-icon">☀️</div>', className: '', iconSize: [24, 24] });
}

export function toLatLng(ll: LatLng): L.LatLngTuple { return [ll[0], ll[1]]; }
