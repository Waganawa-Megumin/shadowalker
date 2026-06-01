// 日陰スコアリングを UI スレッドから逃がす Web Worker
import type { Bbox, Building, CoveredWay, Tree, SolarPosition, LatLng } from '../types';
import { buildGrid } from './buildings';
import { buildCoveredIndex } from './covered';
import { buildTreeIndex } from './trees';
import { scoreRoute } from './score';

export interface WorkerInput {
  routes: LatLng[][];
  sp: SolarPosition;
  bbox: Bbox;
  buildings: Building[];
  coveredWays: CoveredWay[];
  trees: Tree[];
}

self.onmessage = (e: MessageEvent<WorkerInput>) => {
  const { routes, sp, bbox, buildings, coveredWays, trees } = e.data;
  const grid = buildGrid(buildings, bbox);
  const covered = coveredWays.length ? buildCoveredIndex(coveredWays) : undefined;
  const treeIdx = trees.length ? buildTreeIndex(trees) : undefined;
  const ctx = { sp, grid, buildings, covered, trees: treeIdx };
  const scored = routes.map(coords => scoreRoute(coords, ctx));
  (self as unknown as Worker).postMessage(scored);
};
