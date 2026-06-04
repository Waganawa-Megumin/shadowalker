// 影みち 共通型定義（座標は一貫して [lat, lng]）

export type LatLng = [number, number];

export interface Bbox { s: number; w: number; n: number; e: number; }

export interface SolarPosition {
  azimuth: number;  // 方位[度] 北0°時計回り
  altitude: number; // 高度[度]
}

export interface Building {
  poly: LatLng[];
  h: number;
  minLat: number; maxLat: number; minLng: number; maxLng: number;
  source?: 'overpass' | 'plateau';
}

export interface BuildingGrid {
  map: Map<string, number[]>;
  lat0: number; lng0: number; dLat: number; dLng: number;
}

export type CoveredKind = 'arcade' | 'underground' | 'covered' | 'tunnel' | 'bridge';

export interface CoveredWay {
  line: LatLng[];
  kind: CoveredKind;
  strength: number; // 日陰強度 1.0（橋下は 0.8）
}

export interface Tree {
  center: LatLng;
  radius: number;        // 樹冠半径[m]
  height: number;        // 樹高[m]
  transmittance: number; // 透過率（既定 0.4）
  minLat: number; maxLat: number; minLng: number; maxLng: number;
  source: 'tokyo-od' | 'osm';
}

export interface Park {
  ring: LatLng[]; // 外周のみ
  minLat: number; maxLat: number; minLng: number; maxLng: number;
}

export interface RouteResult {
  coords: LatLng[];
  distance: number;
  source: string;
}

export interface RoutingProvider {
  name: string;
  route(start: LatLng, end: LatLng, signal?: AbortSignal): Promise<RouteResult[]>;
}

export interface SampleResult {
  a: LatLng;
  b: LatLng;
  shaded: boolean;   // 実効的に日陰か（しきい値超）
  strength: number;  // 0..1 の日陰強度
  covered: boolean;  // アーケード/地下/高架下に覆われているか
}

export interface ScoredRoute extends RouteResult {
  segs: SampleResult[];
  shadePct: number;
  coveredPct: number;
  name: string;
  combined?: number;
}

// 索引型（rbush ラッパは shade/covered.ts, shade/trees.ts で定義）
export interface CoveredIndex {
  hitAt(pt: LatLng, radiusM: number): { covered: boolean; strength: number };
}

export interface TreeIndex {
  near(lat: number, lng: number, radiusM: number): Tree[];
  readonly size: number;
}

export interface ParkIndex {
  inPark(lat: number, lng: number): boolean;
  readonly size: number;
}

export interface ShadeContext {
  sp: SolarPosition;
  grid: BuildingGrid;
  buildings: Building[];
  covered?: CoveredIndex;
  trees?: TreeIndex;
  parks?: ParkIndex;
}
