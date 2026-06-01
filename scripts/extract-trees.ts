/**
 * 東京都オープンデータ「街路樹 / 都道の街路樹」CSV → タイル化 JSON（手動実行・CI非搭載）
 *
 * 入力: 東京都オープンデータカタログの街路樹CSV（建設局, CC-BY 4.0）
 *   https://catalog.data.metro.tokyo.lg.jp/dataset/t000014d2000000029
 *   （区部・多摩で別ファイルでも複数渡せます。文字コードは CP932/UTF-8 自動判定）
 *
 * 実行: npm run extract:trees -- <csv1> [csv2 ...]
 * 出力:
 *   public/data/trees/t/<tx>_<ty>.json  = [[lng,lat,height,crownRadius], ...]（0.02°グリッド）
 *   public/data/trees/index.json        = { deg, tiles:[...] }
 *
 * 列名はデータ更新で変わり得るため正規表現で寛容にマッチ（緯度/経度・樹高/height・枝張/width 等）。
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';

const DEG = 0.02;

function decode(buf: Buffer): string {
  // BOM付きUTF-8 or UTF-8 を優先、ダメなら CP932(Shift_JIS)
  const utf8 = buf.toString('utf8');
  if (!utf8.includes('�')) return utf8.replace(/^﻿/, '');
  return new TextDecoder('shift_jis').decode(buf);
}

function splitCsvLine(line: string): string[] {
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
  const inputs = process.argv.slice(2);
  if (!inputs.length) { console.error('usage: npm run extract:trees -- <csv1> [csv2 ...]'); process.exit(1); }

  const tiles = new Map<string, number[][]>();
  let total = 0, kept = 0;

  for (const path of inputs) {
    const text = decode(readFileSync(path));
    const lines = text.split(/\r?\n/).filter(Boolean);
    const hd = splitCsvLine(lines[0]);
    const iLat = findCol(hd, [/緯度/, /lat/i]);
    const iLng = findCol(hd, [/経度/, /lon/i, /lng/i]);
    const iH = findCol(hd, [/樹高/, /height/i]);
    const iW = findCol(hd, [/枝張/, /樹冠/, /crown/i, /width/i]);
    if (iLat < 0 || iLng < 0) { console.error('緯度/経度の列が見つかりません:', hd); continue; }
    for (let r = 1; r < lines.length; r++) {
      total++;
      const c = splitCsvLine(lines[r]);
      const lat = parseFloat(c[iLat]), lng = parseFloat(c[iLng]);
      if (!(lat > 24 && lat < 46 && lng > 122 && lng < 154)) continue;
      let h = iH >= 0 ? parseFloat(c[iH]) : NaN; if (!(h > 0)) h = 8;
      let cr = iW >= 0 ? parseFloat(c[iW]) / 2 : NaN; if (!(cr > 0)) cr = h * 0.4;
      const tx = Math.floor(lng / DEG), ty = Math.floor(lat / DEG);
      const key = `${tx}_${ty}`;
      let arr = tiles.get(key); if (!arr) { arr = []; tiles.set(key, arr); }
      arr.push([+lng.toFixed(5), +lat.toFixed(5), +h.toFixed(1), +cr.toFixed(1)]);
      kept++;
    }
  }

  rmSync('public/data/trees/t', { recursive: true, force: true });
  mkdirSync('public/data/trees/t', { recursive: true });
  for (const [key, arr] of tiles) writeFileSync(`public/data/trees/t/${key}.json`, JSON.stringify(arr));
  writeFileSync('public/data/trees/index.json', JSON.stringify({ deg: DEG, tiles: [...tiles.keys()].sort() }));
  console.log(`total=${total} kept=${kept} tiles=${tiles.size}`);
}

main();
