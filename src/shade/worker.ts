// 日陰スコアリングを UI スレッドから逃がす Web Worker
import type { Bbox, Building, CoveredWay, Tree, Park, SolarPosition, LatLng } from '../types';
import { buildGrid } from './buildings';
import { buildCoveredIndex } from './covered';
import { buildTreeIndex } from './trees';
import { buildParkIndex } from './parks';
import { scoreRoute } from './score';

export interface WorkerInput {
  routes: LatLng[][];
  sp: SolarPosition;
  bbox: Bbox;
  buildings: Building[];
  coveredWays: CoveredWay[];
  trees: Tree[];
  parks: Park[];
}

self.onmessage = (e: MessageEvent<WorkerInput>) => {
  const { routes, sp, bbox, buildings, coveredWays, trees, parks } = e.data;
  const grid = buildGrid(buildings, bbox);
  const covered = coveredWays.length ? buildCoveredIndex(coveredWays) : undefined;
  const treeIdx = trees.length ? buildTreeIndex(trees) : undefined;
  const parkIdx = parks.length ? buildParkIndex(parks) : undefined;
  const ctx = { sp, grid, buildings, covered, trees: treeIdx, parks: parkIdx };
  const scored = routes.map(coords => scoreRoute(coords, ctx));
  (self as unknown as Worker).postMessage(scored);
};
