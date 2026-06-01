// リポジトリ同梱の静的データ（人手キュレーション覆い経路・街路樹GeoJSON）の読込
import type { Bbox, CoveredWay, Tree, LatLng, CoveredKind } from '../types';
import { makeTree } from './overpass';

function inBbox(coords: LatLng[], b: Bbox): boolean {
  return coords.some(([la, ln]) => la >= b.s && la <= b.n && ln >= b.w && ln <= b.e);
}

// public/data/arcades/curated.geojson（LineString, props.kind）
export async function loadCuratedArcades(bbox: Bbox): Promise<CoveredWay[]> {
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}data/arcades/curated.geojson`);
    if (!r.ok) return [];
    const j = await r.json();
    const out: CoveredWay[] = [];
    for (const f of j.features || []) {
      if (f.geometry?.type !== 'LineString') continue;
      const line: LatLng[] = f.geometry.coordinates.map((c: number[]) => [c[1], c[0]]);
      if (line.length < 2 || !inBbox(line, bbox)) continue;
      const kind = (f.properties?.kind || 'covered') as CoveredKind;
      out.push({ line, kind, strength: kind === 'bridge' ? 0.8 : 1.0 });
    }
    return out;
  } catch { return []; }
}

// public/data/trees/*.geojson（Point, props.height/crown/species）
export async function loadTreeGeojson(name: string, bbox: Bbox): Promise<Tree[]> {
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}data/trees/${name}.geojson`);
    if (!r.ok) return [];
    const j = await r.json();
    const out: Tree[] = [];
    for (const f of j.features || []) {
      if (f.geometry?.type !== 'Point') continue;
      const [ln, la] = f.geometry.coordinates;
      if (la < bbox.s || la > bbox.n || ln < bbox.w || ln > bbox.e) continue;
      const h = Number(f.properties?.height) || 8;
      const crown = Number(f.properties?.crown) || h * 0.4;
      out.push(makeTree([la, ln], crown, h, 'tokyo-od'));
    }
    return out;
  } catch { return []; }
}
