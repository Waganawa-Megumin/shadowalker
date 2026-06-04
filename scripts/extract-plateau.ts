/**
 * PLATEAU / Flateau 建物 → タイル化 JSON（手動実行・CI非搭載）
 *
 * 入力: Flateau の GeoPackage を ogr2ogr で GeoJSON 化したもの（複数可）。
 *   Flateau(CC-BY 4.0): https://source.coop/pacificspatial/flateau
 *   重要: gpkg には複数レイヤがあるため、必ず建物フットプリント層を指定して変換する:
 *     ogr2ogr -f GeoJSON -t_srs EPSG:4326 13104.geojson 13104_*.gpkg building_lod0
 *   （高さ属性は measured_height。本スクリプトが自動検出する）
 *   一次配布の PLATEAU CityGML(国交省/G空間, CC-BY 4.0) も ogr2ogr で GeoJSON 化すれば可。
 *
 * 実行: npm run extract:plateau -- <geojson1> [geojson2 ...]
 * 出力:
 *   public/data/plateau/t/<tx>_<ty>.json = [[height, [lng,lat,lng,lat,...]], ...]（0.01°グリッド・外周のみ）
 *   public/data/plateau/index.json       = { deg, tiles:[...] }
 *
 * 注意: 平面直角座標系9系(EPSG:6677, JGD2011)のデータは WGS84 へ自動変換。
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import proj4 from 'proj4';

const EPSG6677 = '+proj=tmerc +lat_0=36 +lon_0=139.8333333333 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs';
const DEG = 0.01;

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

function toWgs84(x: number, y: number): [number, number] {
  if (Math.abs(x) <= 180 && Math.abs(y) <= 90) return [round6(x), round6(y)];
  const [lng, lat] = proj4(EPSG6677, 'WGS84', [x, y]);
  return [round6(lng), round6(lat)];
}

// 高さ属性を寛容に検出（measured_height / measuredHeight / height / *height* 等）
function pickHeight(p: Record<string, unknown>): number {
  for (const k of ['measured_height', 'measuredHeight', 'height', 'bldg_measuredHeight']) {
    const v = Number(p?.[k]); if (v > 0) return v;
  }
  for (const k of Object.keys(p || {})) {
    if (/height|高さ/i.test(k)) { const v = Number((p as any)[k]); if (v > 0) return v; }
  }
  return 0;
}

function main() {
  const inputs = process.argv.slice(2);
  if (!inputs.length) { console.error('usage: npm run extract:plateau -- <geojson1> [geojson2 ...]'); process.exit(1); }

  const tiles = new Map<string, [number, number[]][]>();
  let total = 0, kept = 0;

  for (const input of inputs) {
    const src = JSON.parse(readFileSync(input, 'utf8'));
    for (const f of src.features || []) {
      total++;
      const g = f.geometry;
      if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) continue;
      const h = Math.round(pickHeight(f.properties || {}) * 10) / 10;
      if (!(h > 0)) continue;
      const polys: number[][][][] = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
      for (const poly of polys) {
        const ring = poly[0];
        if (!ring || ring.length < 3) continue;
        const flat: number[] = [];
        let cx = 0, cy = 0, n = 0;
        for (const [x, y] of ring) {
          const [lng, lat] = toWgs84(x, y);
          flat.push(lng, lat); cx += lng; cy += lat; n++;
        }
        const key = `${Math.floor((cx / n) / DEG)}_${Math.floor((cy / n) / DEG)}`;
        let arr = tiles.get(key); if (!arr) { arr = []; tiles.set(key, arr); }
        arr.push([h, flat]); kept++;
      }
    }
  }

  rmSync('public/data/plateau/t', { recursive: true, force: true });
  mkdirSync('public/data/plateau/t', { recursive: true });
  for (const [key, arr] of tiles) writeFileSync(`public/data/plateau/t/${key}.json`, JSON.stringify(arr));
  writeFileSync('public/data/plateau/index.json', JSON.stringify({ deg: DEG, tiles: [...tiles.keys()].sort() }));
  console.log(`total=${total} kept=${kept} tiles=${tiles.size}`);
}

main();
