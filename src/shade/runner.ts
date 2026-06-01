// スコアリングの実行: 負荷が高い時のみ Worker へ。失敗時は同期計算にフォールバック。
import type { Bbox, Building, CoveredWay, Tree, SolarPosition, RouteResult, ScoredRoute } from '../types';
import { buildGrid } from './buildings';
import { buildCoveredIndex } from './covered';
import { buildTreeIndex } from './trees';
import { scoreRoute } from './score';
import type { WorkerInput } from './worker';

export interface ScoreParams {
  sp: SolarPosition;
  bbox: Bbox;
  buildings: Building[];
  coveredWays: CoveredWay[];
  trees: Tree[];
}

const HEAVY_SAMPLES = 1200; // この推定サンプル数を超えたら Worker 起動

function estimateSamples(routes: RouteResult[]): number {
  let n = 0;
  for (const r of routes) n += r.coords.length;
  return n;
}

export async function scoreRoutesAsync(routes: RouteResult[], p: ScoreParams): Promise<ScoredRoute[]> {
  const heavy = estimateSamples(routes) * Math.max(1, p.buildings.length / 500) > HEAVY_SAMPLES;
  if (heavy && typeof Worker !== 'undefined') {
    try {
      return await runInWorker(routes, p);
    } catch { /* フォールバック */ }
  }
  return scoreSync(routes, p);
}

function scoreSync(routes: RouteResult[], p: ScoreParams): ScoredRoute[] {
  const grid = buildGrid(p.buildings, p.bbox);
  const covered = p.coveredWays.length ? buildCoveredIndex(p.coveredWays) : undefined;
  const trees = p.trees.length ? buildTreeIndex(p.trees) : undefined;
  const ctx = { sp: p.sp, grid, buildings: p.buildings, covered, trees };
  return routes.map((r, i) => ({ ...r, ...scoreRoute(r.coords, ctx), name: i === 0 ? '最短経路' : '別ルート ' + i }));
}

function runInWorker(routes: RouteResult[], p: ScoreParams): Promise<ScoredRoute[]> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    const input: WorkerInput = {
      routes: routes.map(r => r.coords), sp: p.sp, bbox: p.bbox,
      buildings: p.buildings, coveredWays: p.coveredWays, trees: p.trees,
    };
    worker.onmessage = (e) => {
      const scored = e.data as { segs: any; shadePct: number; coveredPct: number }[];
      resolve(routes.map((r, i) => ({ ...r, ...scored[i], name: i === 0 ? '最短経路' : '別ルート ' + i })));
      worker.terminate();
    };
    worker.onerror = (err) => { worker.terminate(); reject(err); };
    worker.postMessage(input);
  });
}
