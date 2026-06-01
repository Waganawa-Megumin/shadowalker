// 影みち — 定数・エンドポイント・環境非依存のベースパス
// すべて相対URL前提。GitHub Pages のサブパス（/shadowalker/）でも localhost でも動く。

export const BASE_PATH = (typeof location !== 'undefined') ? new URL('./', location).pathname : '/';

export const TOKYO = [35.681, 139.767];

// 日陰判定パラメータ
export const DEFAULT_H = 9;     // 高さ不明の建物の仮定[m]
export const MAX_REACH = 90;    // 影の到達上限[m]（低い太陽での暴走防止）
export const MAX_BLD_H = 60;    // 遮蔽を考慮する建物高さの上限[m]
export const RAY_STEP = 4;      // レイ判定の刻み[m]
export const SAMPLE_M = 25;     // 経路サンプリング間隔[m]
export const CELL_M = 30;       // 建物グリッドのセルサイズ[m]

// 東京近郊に検索をバイアスする viewbox: west,south,east,north
export const TOKYO_VIEWBOX = [139.55, 35.55, 139.95, 35.85];

// 外部サービス（すべてキー不要）
export const API = {
  brouter:  'https://brouter.de/brouter',
  osrmFoot: 'https://routing.openstreetmap.de/routed-foot/route/v1/foot',
  osrmCar:  'https://router.project-osrm.org/route/v1/driving',
  overpass: 'https://overpass-api.de/api/interpreter',
  openMeteo:'https://api.open-meteo.com/v1/forecast',
  nominatim:'https://nominatim.openstreetmap.org/search',
};

// 地図タイル
export const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_ATTRIB = '© OpenStreetMap';
