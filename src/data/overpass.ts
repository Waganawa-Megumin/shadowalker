// Overpass フェッチ（建物・覆い経路・街路樹）＋ IndexedDB キャッシュ（bbox単位・TTL7日）
import { get, set } from 'idb-keyval';
import type { Bbox, Building, CoveredWay, Tree, LatLng, CoveredKind } from '../types';
import { API, DEFAULT_H, TREE_TRANSMITTANCE, STUB } from '../config';
import { makeBuilding, parseLevels } from '../shade/buildings';
import { logWarn } from '../log';

const TTL = 7 * 24 * 3600 * 1000;

function bkey(kind: string, b: Bbox): string {
  const r = (n: number) => n.toFixed(3);
  return `op:${kind}:${r(b.s)},${r(b.w)},${r(b.n)},${r(b.e)}`;
}

async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  try {
    const hit = await get<{ t: number; v: T }>(key);
    if (hit && Date.now() - hit.t < TTL) return hit.v;
  } catch { /* IndexedDB 不可環境は素通り */ }
  const v = await fn();
  try { await set(key, { t: Date.now(), v }); } catch { /* noop */ }
  return v;
}

async function overpass(query: string): Promise<any> {
  const r = await fetch(API.overpass, { method: 'POST', body: 'data=' + encodeURIComponent(query) });
  if (!r.ok) throw new Error('overpass ' + r.status);
  return r.json();
}

// ---- 建物 ----
export async function fetchBuildings(bbox: Bbox): Promise<Building[]> {
  return cached(bkey('bld', bbox), async () => {
    try {
      const q = `[out:json][timeout:25];(way["building"](${bbox.s},${bbox.w},${bbox.n},${bbox.e}););out geom;`;
      const j = await overpass(q);
      return parseBuildings(j);
    } catch (err) {
      logWarn('overpass:buildings', err);
      // 本番では PLATEAU 建物（約320万棟）があるため、補助的な OSM 建物の取得失敗は致命にしない
      if (STUB || import.meta.env?.DEV) return loadSample<Building[]>('buildings-shinjuku', parseBuildings);
      return [];
    }
  });
}

function parseBuildings(j: any): Building[] {
  const out: Building[] = [];
  for (const el of j.elements || []) {
    if (!el.geometry || el.geometry.length < 3) continue;
    const poly: LatLng[] = el.geometry.map((g: any) => [g.lat, g.lon]);
    const tg = el.tags || {};
    let h = DEFAULT_H;
    if (tg.height) h = parseFloat(tg.height) || DEFAULT_H;
    else { const lv = parseLevels(tg['building:levels']); if (lv) h = lv * 3.2; }
    out.push(makeBuilding(poly, h, 'overpass'));
  }
  return out;
}

// ---- 覆い経路（アーケード・地下・屋内通路・高架下） ----
export async function fetchCoveredWays(bbox: Bbox): Promise<CoveredWay[]> {
  return cached(bkey('cov', bbox), async () => {
    const b = `(${bbox.s},${bbox.w},${bbox.n},${bbox.e})`;
    const q = `[out:json][timeout:25];(`
      + `way["highway"]["covered"]${b};`
      + `way["highway"]["tunnel"="yes"]${b};`
      + `way["highway"]["indoor"="yes"]${b};`
      + `way["highway"="corridor"]${b};`
      + `way["highway"]["layer"]${b};`
      + `);out geom;`;
    try {
      const j = await overpass(q);
      return parseCovered(j);
    } catch (err) {
      logWarn('overpass:covered', err);
      return []; // 覆い経路は curated.geojson が別途あるので空でも可
    }
  });
}

function parseCovered(j: any): CoveredWay[] {
  const out: CoveredWay[] = [];
  for (const el of j.elements || []) {
    if (!el.geometry || el.geometry.length < 2) continue;
    const tg = el.tags || {};
    const layer = parseInt(tg.layer ?? '0', 10);
    let kind: CoveredKind | null = null;
    let strength = 1.0;
    if (tg.covered === 'arcade') kind = 'arcade';
    else if (tg.covered && tg.covered !== 'no') kind = 'covered';
    else if (tg.tunnel === 'yes') kind = 'tunnel';
    else if (tg.indoor === 'yes' || tg.highway === 'corridor') kind = 'underground';
    else if (Number.isFinite(layer) && layer < 0) kind = 'underground';
    else if (tg.bridge === 'yes') { kind = 'bridge'; strength = 0.8; }
    if (!kind) continue;
    const line: LatLng[] = el.geometry.map((g: any) => [g.lat, g.lon]);
    out.push({ line, kind, strength });
  }
  return out;
}

// ---- 街路樹（OSM natural=tree / ランタイム二次ソース） ----
export async function fetchOsmTrees(bbox: Bbox): Promise<Tree[]> {
  return cached(bkey('tree', bbox), async () => {
    const q = `[out:json][timeout:25];(node["natural"="tree"](${bbox.s},${bbox.w},${bbox.n},${bbox.e}););out;`;
    try {
      const j = await overpass(q);
      return parseOsmTrees(j);
    } catch (err) {
      logWarn('overpass:trees', err);
      return [];
    }
  });
}

function parseOsmTrees(j: any): Tree[] {
  const out: Tree[] = [];
  for (const el of j.elements || []) {
    if (el.type !== 'node') continue;
    const tg = el.tags || {};
    const height = parseFloat(tg.height) || parseFloat(tg['height:m']) || 8;
    const crown = parseFloat(tg.diameter_crown) ? parseFloat(tg.diameter_crown) / 2 : height * 0.4;
    out.push(makeTree([el.lat, el.lon], crown, height, 'osm'));
  }
  return out;
}

export function makeTree(center: LatLng, radius: number, height: number, source: Tree['source']): Tree {
  const dLat = radius / 111320;
  const dLng = radius / (111320 * Math.cos(center[0] * Math.PI / 180));
  return {
    center, radius, height, transmittance: TREE_TRANSMITTANCE, source,
    minLat: center[0] - dLat, maxLat: center[0] + dLat,
    minLng: center[1] - dLng, maxLng: center[1] + dLng,
  };
}

// ---- オフラインサンプル ----
async function loadSample<T>(name: string, parse: (j: any) => T): Promise<T> {
  const r = await fetch(`${import.meta.env.BASE_URL}data/sample/${name}.json`);
  return parse(await r.json());
}
