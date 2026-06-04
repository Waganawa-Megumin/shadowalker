/**
 * 公園・緑地 GeoJSON → 軽量ポリゴン集 public/data/parks/parks.json（手動実行・CI非搭載）
 *
 * 入力（複数可・Polygon/MultiPolygon）:
 *   国土数値情報「都市公園」P13  https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-P13.html
 *   東京都オープンデータ / OSM(leisure=park|garden) など。
 *   Shapefile等は ogr2ogr で GeoJSON 化（必要なら簡略化）:
 *     ogr2ogr -f GeoJSON -t_srs EPSG:4326 -simplify 0.00003 parks.geojson <input>
 *
 * 実行: npm run extract:parks -- <geojson1> [geojson2 ...]
 * 出力: public/data/parks/parks.json = [[lng,lat,lng,lat,...], ...]（外周のみ・座標5桁）
 *
 * 注意: 平面直角座標系9系(EPSG:6677)は WGS84 へ自動変換。極小ポリゴン（外周bbox<約20m）は除外。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import proj4 from 'proj4';

const EPSG6677 = '+proj=tmerc +lat_0=36 +lon_0=139.8333333333 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs';
const round5 = (n: number) => Math.round(n * 1e5) / 1e5;
const MIN_SPAN_DEG = 0.0002; // 約22m 未満の極小は除外

function toWgs84(x: number, y: number): [number, number] {
  if (Math.abs(x) <= 180 && Math.abs(y) <= 90) return [round5(x), round5(y)];
  const [lng, lat] = proj4(EPSG6677, 'WGS84', [x, y]);
  return [round5(lng), round5(lat)];
}

function main() {
  const inputs = process.argv.slice(2);
  if (!inputs.length) { console.error('usage: npm run extract:parks -- <geojson1> [geojson2 ...]'); process.exit(1); }

  const out: number[][] = [];
  let total = 0, kept = 0;
  for (const input of inputs) {
    const src = JSON.parse(readFileSync(input, 'utf8'));
    for (const f of src.features || []) {
      const g = f.geometry;
      if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) continue;
      const polys: number[][][][] = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
      for (const poly of polys) {
        total++;
        const ring = poly[0];
        if (!ring || ring.length < 4) continue;
        const flat: number[] = [];
        let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
        for (const [x, y] of ring) {
          const [lng, lat] = toWgs84(x, y);
          flat.push(lng, lat);
          if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
          if (lng < minLng) minLng = lng; if (lng > maxLng) maxLng = lng;
        }
        if (maxLat - minLat < MIN_SPAN_DEG && maxLng - minLng < MIN_SPAN_DEG) continue; // 極小除外
        out.push(flat);
        kept++;
      }
    }
  }

  mkdirSync('public/data/parks', { recursive: true });
  writeFileSync('public/data/parks/parks.json', JSON.stringify(out));
  console.log(`total=${total} kept=${kept}`);
}

main();
