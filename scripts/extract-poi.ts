/**
 * 休憩スポット（給水・トイレ）GeoJSON → public/data/poi/poi.json（手動実行・CI非搭載）
 *
 * 入力（複数可・Point 推奨。Polygon は重心化）:
 *   OSM overpass で amenity=drinking_water / toilets を取得し GeoJSON 化したもの。
 *   overpass-turbo クエリ例:
 *     [out:json][timeout:120];
 *     ( node["amenity"~"drinking_water|toilets"](35.50,139.30,35.90,139.95); );
 *     out geom;
 *   （トイレを建物として持つ場合は way も追加し out center;）
 *
 * 実行: npm run extract:poi -- <geojson1> [geojson2 ...]
 * 出力: public/data/poi/poi.json = [[lng,lat,'w'|'t'], ...]（座標5桁）
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

function kindOf(props: Record<string, unknown>): 'w' | 't' | null {
  const a = String(props?.amenity ?? props?.amenity_1 ?? '').toLowerCase();
  if (a === 'drinking_water') return 'w';
  if (a === 'toilets') return 't';
  return null;
}

function centroid(coords: number[][]): [number, number] {
  let x = 0, y = 0;
  for (const [cx, cy] of coords) { x += cx; y += cy; }
  return [x / coords.length, y / coords.length];
}

function main() {
  const inputs = process.argv.slice(2);
  if (!inputs.length) { console.error('usage: npm run extract:poi -- <geojson1> [geojson2 ...]'); process.exit(1); }

  const out: [number, number, string][] = [];
  const seen = new Set<string>();
  let water = 0, toilet = 0;
  for (const input of inputs) {
    const src = JSON.parse(readFileSync(input, 'utf8'));
    for (const f of src.features || []) {
      const kind = kindOf(f.properties || {});
      if (!kind) continue;
      const g = f.geometry;
      if (!g) continue;
      let lng: number, lat: number;
      if (g.type === 'Point') { [lng, lat] = g.coordinates; }
      else if (g.type === 'Polygon') { [lng, lat] = centroid(g.coordinates[0]); }
      else if (g.type === 'MultiPolygon') { [lng, lat] = centroid(g.coordinates[0][0]); }
      else continue;
      if (!(Math.abs(lng) <= 180 && Math.abs(lat) <= 90)) continue;
      const r: [number, number, string] = [round5(lng), round5(lat), kind];
      const key = `${r[0]},${r[1]},${kind}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(r);
      if (kind === 'w') water++; else toilet++;
    }
  }

  mkdirSync('public/data/poi', { recursive: true });
  writeFileSync('public/data/poi/poi.json', JSON.stringify(out));
  console.log(`water=${water} toilet=${toilet} total=${out.length}`);
}

main();
