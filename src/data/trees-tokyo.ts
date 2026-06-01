// 東京都オープンデータ「街路樹」をタイル化したものを bbox 近傍だけ実行時に読む
// タイル: public/data/trees/t/<tx>_<ty>.json = [[lng,lat,height,crownRadius], ...]
// 索引:   public/data/trees/index.json = { deg, tiles:[ "<tx>_<ty>", ... ] }
import type { Bbox, Tree } from '../types';
import { makeTree } from './overpass';

let indexCache: { deg: number; tiles: Set<string> } | null = null;

async function loadIndex(): Promise<{ deg: number; tiles: Set<string> } | null> {
  if (indexCache) return indexCache;
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}data/trees/index.json`);
    if (!r.ok) return null;
    const j = await r.json();
    indexCache = { deg: j.deg, tiles: new Set<string>(j.tiles) };
    return indexCache;
  } catch { return null; }
}

export async function loadTokyoTrees(bbox: Bbox): Promise<Tree[]> {
  const idx = await loadIndex();
  if (!idx) return [];
  const { deg, tiles } = idx;
  const keys: string[] = [];
  for (let x = Math.floor(bbox.w / deg); x <= Math.floor(bbox.e / deg); x++) {
    for (let y = Math.floor(bbox.s / deg); y <= Math.floor(bbox.n / deg); y++) {
      const k = `${x}_${y}`;
      if (tiles.has(k)) keys.push(k);
    }
  }
  const out: Tree[] = [];
  await Promise.all(keys.map(async k => {
    try {
      const r = await fetch(`${import.meta.env.BASE_URL}data/trees/t/${k}.json`);
      if (!r.ok) return;
      const arr = await r.json() as number[][];
      for (const t of arr) out.push(makeTree([t[1], t[0]], t[3], t[2], 'tokyo-od'));
    } catch { /* タイル欠損は無視 */ }
  }));
  return out;
}
