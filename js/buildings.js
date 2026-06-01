// 建物取得（Overpass）＋ 一様グリッドによる空間インデックス
import { API, DEFAULT_H, CELL_M } from './config.js';

// bbox = {s,w,n,e} → [{poly,h,minLat,maxLat,minLng,maxLng}]
export async function fetchBuildings(bbox) {
  const q = `[out:json][timeout:25];(way["building"](${bbox.s},${bbox.w},${bbox.n},${bbox.e}););out geom;`;
  const r = await fetch(API.overpass, { method: 'POST', body: 'data=' + encodeURIComponent(q) });
  if (!r.ok) throw new Error('overpass');
  const j = await r.json();
  const out = [];
  for (const el of j.elements) {
    if (!el.geometry || el.geometry.length < 3) continue;
    const poly = el.geometry.map(g => [g.lat, g.lon]);
    let h = DEFAULT_H;
    const tg = el.tags || {};
    if (tg.height) h = parseFloat(tg.height) || DEFAULT_H;
    else if (tg['building:levels']) h = (parseFloat(tg['building:levels']) || 3) * 3.2;
    const lats = poly.map(p => p[0]), lngs = poly.map(p => p[1]);
    out.push({
      poly, h,
      minLat: Math.min(...lats), maxLat: Math.max(...lats),
      minLng: Math.min(...lngs), maxLng: Math.max(...lngs),
    });
  }
  return out;
}

// 一様グリッドを構築。各建物は覆う全セルに index 登録。
// 返り値 {map:Map<"cx,cy",number[]>, lat0,lng0, dLat,dLng}
export function buildGrid(buildings, bbox) {
  const latC = (bbox.s + bbox.n) / 2;
  const dLat = CELL_M / 111320;
  const dLng = CELL_M / (111320 * Math.cos(latC * Math.PI / 180));
  const lat0 = bbox.s, lng0 = bbox.w;
  const map = new Map();
  const cx = lat => Math.floor((lat - lat0) / dLat);
  const cy = lng => Math.floor((lng - lng0) / dLng);
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    for (let x = cx(b.minLat); x <= cx(b.maxLat); x++) {
      for (let y = cy(b.minLng); y <= cy(b.maxLng); y++) {
        const k = x + ',' + y;
        let arr = map.get(k);
        if (!arr) { arr = []; map.set(k, arr); }
        arr.push(i);
      }
    }
  }
  return { map, lat0, lng0, dLat, dLng };
}

// 指定座標が属するセル候補の建物 index 配列（無ければ空配列）
export function cellOf(grid, lat, lng) {
  const x = Math.floor((lat - grid.lat0) / grid.dLat);
  const y = Math.floor((lng - grid.lng0) / grid.dLng);
  return grid.map.get(x + ',' + y) || [];
}
