// 天気（Open-Meteo / キー不要）＋ 暑さ指数(WBGT)の近似
import { API } from './config';

export interface Weather {
  temp: number; feel: number; humidity: number; wind: number;
  cloud: number; wbgt: number; wbgtLabel: string; wbgtCls: string; note: string;
}

// 簡易WBGT[℃]（豪BoM近似: 気温T[℃]と相対湿度RH[%]から水蒸気圧e[hPa]を介して推定）
// 日射・風は未考慮のため屋外快晴時はやや控えめ。あくまで目安。
export function computeWBGT(tempC: number, rh: number): number {
  const e = (rh / 100) * 6.105 * Math.exp((17.27 * tempC) / (237.7 + tempC));
  return Math.round((0.567 * tempC + 0.393 * e + 3.94) * 10) / 10;
}

// 日本生気象学会「日常生活に関する指針」の区分
export function wbgtLevel(wbgt: number): { label: string; cls: string } {
  if (wbgt >= 31) return { label: '危険', cls: 'wbgt-5' };
  if (wbgt >= 28) return { label: '厳重警戒', cls: 'wbgt-4' };
  if (wbgt >= 25) return { label: '警戒', cls: 'wbgt-3' };
  if (wbgt >= 21) return { label: '注意', cls: 'wbgt-2' };
  return { label: 'ほぼ安全', cls: 'wbgt-1' };
}

export async function fetchWeather(lat: number, lng: number): Promise<Weather> {
  const u = `${API.openMeteo}?latitude=${lat}&longitude=${lng}`
    + `&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,cloud_cover,weather_code`;
  const r = await fetch(u);
  const j = await r.json();
  const c = j.current;
  const temp = c.temperature_2m, feel = c.apparent_temperature;
  const humidity = c.relative_humidity_2m ?? 60, wind = c.wind_speed_10m ?? 0;
  const wbgt = computeWBGT(temp, humidity);
  const lv = wbgtLevel(wbgt);
  const note = wbgt >= 28 ? '☀️ 日陰を強くおすすめ'
    : wbgt >= 25 ? '日陰がうれしい陽気'
    : '比較的すごしやすい';
  return { temp, feel, humidity, wind, cloud: c.cloud_cover, wbgt, wbgtLabel: lv.label, wbgtCls: lv.cls, note };
}
