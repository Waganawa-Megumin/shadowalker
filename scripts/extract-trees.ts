/**
 * 東京都オープンデータ「都道の街路樹」CSV → GeoJSON 抽出（手動実行・CI非搭載）
 *
 * 入力: 東京都オープンデータカタログ「都道の街路樹」CSV（建設局, CC-BY 4.0）
 *   https://catalog.data.metro.tokyo.lg.jp/dataset/t000014d2000000029
 *   （補完: OSM natural=tree はランタイムで取得）
 *
 * 実行: npm run extract:trees -- <input.csv> <outName>
 * 出力: public/data/trees/<outName>.geojson（Point, props {species,height,crown}）
 *
 * 注意: 列名はデータ更新で変わり得るため正規表現で寛容にマッチ。
 *   座標がメートル級（平面直角座標系）なら別途 proj4 変換が必要（CSVの座標系を確認のこと）。
 */
import { readFileSync, writeFileSync } from 'node:fs';

function splitCsvLine(line: string): string[] {
  // 簡易CSV（引用符内カンマに対応）
  const out: string[] = []; let cur = ''; let q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === ',' && !q) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

function findCol(headers: string[], patterns: RegExp[]): number {
  for (let i = 0; i < headers.length; i++) if (patterns.some(p => p.test(headers[i]))) return i;
  return -1;
}

function main() {
  const [input, outName] = process.argv.slice(2);
  if (!input || !outName) {
    console.error('usage: npm run extract:trees -- <input.csv> <outName>');
    process.exit(1);
  }
  const text = readFileSync(input, 'utf8').replace(/^﻿/, '');
  const lines = text.split(/\r?\n/).filter(Boolean);
  const headers = splitCsvLine(lines[0]);
  const iLat = findCol(headers, [/緯度/, /lat/i]);
  const iLng = findCol(headers, [/経度/, /lon/i, /lng/i]);
  const iH = findCol(headers, [/樹高/, /height/i]);
  const iSp = findCol(headers, [/樹種/, /species/i, /名称/]);
  const iCrown = findCol(headers, [/樹冠|枝張/, /crown/i]);
  if (iLat < 0 || iLng < 0) { console.error('緯度/経度の列が見つかりません:', headers); process.exit(1); }

  const features: unknown[] = [];
  for (let r = 1; r < lines.length; r++) {
    const c = splitCsvLine(lines[r]);
    const lat = parseFloat(c[iLat]), lng = parseFloat(c[iLng]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90) continue;
    const height = iH >= 0 ? parseFloat(c[iH]) || 8 : 8;
    const crown = iCrown >= 0 && parseFloat(c[iCrown]) ? parseFloat(c[iCrown]) / 2 : height * 0.4;
    features.push({
      type: 'Feature',
      properties: { species: iSp >= 0 ? c[iSp] : '', height: Math.round(height * 10) / 10, crown: Math.round(crown * 10) / 10 },
      geometry: { type: 'Point', coordinates: [Math.round(lng * 1e6) / 1e6, Math.round(lat * 1e6) / 1e6] },
    });
  }
  const path = `public/data/trees/${outName}.geojson`;
  writeFileSync(path, JSON.stringify({ type: 'FeatureCollection', features }));
  console.log(`wrote ${features.length} trees → ${path}`);
}

main();
