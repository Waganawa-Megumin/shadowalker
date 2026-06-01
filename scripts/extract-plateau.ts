/**
 * PLATEAU / Flateau → 軽量GeoJSON 抽出（手動実行・CI非搭載）
 *
 * 目的: 区ごとに建物フットプリント＋高さだけを取り出し、public/data/plateau/<区コード>.geojson に保存。
 *
 * 入力（いずれか）:
 *   (推奨) Flateau の GeoPackage/GeoParquet（footprint+height, CC-BY 4.0）
 *          https://source.coop/pacificspatial/flateau
 *   (一次) PLATEAU CityGML（国交省 / G空間情報センター, CC-BY 4.0）
 *          https://www.geospatial.jp/ckan/dataset/plateau-tokyo23ku
 *          → GDAL の ogr2ogr で bldg:measuredHeight を含む GeoJSON 化してから本スクリプトへ。
 *
 * 依存（実行時に各自インストール）: tsx, （CityGML経路なら）GDAL/ogr2ogr, proj4。
 * 実行: npm run extract:plateau -- <input.geojson> <区コード>
 *
 * 出力プロパティは { height:number, lod:1|2, source:"plateau" } の3つに限定し、
 * ポリゴンは外周のみ・座標6桁丸めで ≤500KB gzip/区 を目標（密集区はサブタイル化を検討）。
 *
 * 注意: 平面直角座標系9系(EPSG:6677, JGD2011)のデータは WGS84 へ変換すること。
 *   proj4 def: "+proj=tmerc +lat_0=36 +lon_0=139.8333333333 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs"
 */
import { readFileSync, writeFileSync } from 'node:fs';
import proj4 from 'proj4';

const EPSG6677 = '+proj=tmerc +lat_0=36 +lon_0=139.8333333333 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs';

type Pos = [number, number];

function round6(n: number): number { return Math.round(n * 1e6) / 1e6; }

// 経度の絶対値が小さければ既にWGS84、大きければ平面直角(メートル)とみなして変換
function toWgs84(x: number, y: number): Pos {
  if (Math.abs(x) <= 180 && Math.abs(y) <= 90) return [round6(x), round6(y)];
  const [lng, lat] = proj4(EPSG6677, 'WGS84', [x, y]);
  return [round6(lng), round6(lat)];
}

function main() {
  const [input, ward] = process.argv.slice(2);
  if (!input || !ward) {
    console.error('usage: npm run extract:plateau -- <input.geojson> <wardCode e.g. 13104>');
    process.exit(1);
  }
  const src = JSON.parse(readFileSync(input, 'utf8'));
  const out = { type: 'FeatureCollection', features: [] as unknown[] };
  for (const f of src.features || []) {
    const g = f.geometry;
    if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) continue;
    const p = f.properties || {};
    const height = Number(p.measuredHeight ?? p.height ?? p.bldg_measuredHeight ?? 0);
    if (!height) continue;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    const coords = polys.map((poly: number[][][]) => [poly[0].map(([x, y]) => toWgs84(x, y))]); // 外周のみ
    out.features.push({
      type: 'Feature',
      properties: { height: Math.round(height * 10) / 10, lod: 1, source: 'plateau' },
      geometry: { type: 'MultiPolygon', coordinates: coords },
    });
  }
  const path = `public/data/plateau/${ward}.geojson`;
  writeFileSync(path, JSON.stringify(out));
  console.log(`wrote ${out.features.length} buildings → ${path}`);
}

main();
