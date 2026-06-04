// 定数・エンドポイント・環境非依存のベースパス
import type { LatLng } from './types';

export const BASE_PATH = (typeof location !== 'undefined') ? new URL('./', location.href).pathname : '/';

export const TOKYO: LatLng = [35.681, 139.767];

// 日陰判定パラメータ
export const DEFAULT_H = 9;       // 高さ不明の建物の仮定[m]
export const MAX_REACH = 120;     // 影の到達上限[m]（PLATEAU実高さで高層の影も拾う）
export const MAX_BLD_H = 100;     // 遮蔽を考慮する建物高さの上限[m]
export let RAY_STEP = 4;          // レイ判定の刻み[m]（PLATEAUあり時 3 に）
export const SAMPLE_M = 25;       // 経路サンプリング間隔[m]
export const CELL_M = 30;         // 建物グリッドのセルサイズ[m]
export const SHADE_ALT_MIN = 3.0; // この高度[度]以下は実質日陰扱い（直達日射が激減）
export const TREE_TRANSMITTANCE = 0.4; // 樹冠の透過率（1本で日陰強度0.6）
export const COVERED_RADIUS_M = 10;    // 覆い経路と判定する近傍半径[m]
export const PARK_SHADE = 0.5;         // 公園・緑地内の日陰相当強度（緑陰・蒸散で涼しい）

// Phase B で 3m に切替えるためのミュータブル設定
export function setRayStep(v: number): void { RAY_STEP = v; }

// 東京近郊に検索をバイアスする viewbox: west,south,east,north
export const TOKYO_VIEWBOX: [number, number, number, number] = [139.55, 35.55, 139.95, 35.85];

// PLATEAU 対象6区（区コード）
export const PLATEAU_WARDS = ['13101', '13102', '13103', '13104', '13113', '13116'];

// 外部サービス（すべてキー不要）
export const API = {
  brouter:  'https://brouter.de/brouter',
  osrmFoot: 'https://routing.openstreetmap.de/routed-foot/route/v1/foot',
  valhalla: 'https://valhalla1.openstreetmap.de/route',
  osrmCar:  'https://router.project-osrm.org/route/v1/driving',
  overpass: 'https://overpass-api.de/api/interpreter',
  openMeteo:'https://api.open-meteo.com/v1/forecast',
  nominatim:'https://nominatim.openstreetmap.org/search',
};

export const CLIENT_ID = 'shadowalker'; // FOSSGIS フェアユース用 X-Client-Id

// 地図タイル
export const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_ATTRIB = '© OpenStreetMap';

// 開発時オフラインスタブ（?stub=1 もしくは DEV かつ fetch 失敗時）
export const STUB = (typeof location !== 'undefined') && new URLSearchParams(location.search).has('stub');
