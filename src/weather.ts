// 天気（Open-Meteo / キー不要）＋ 暑さ指数(WBGT)の近似
import { API } from './config';

export interface Weather {
  temp: number; feel: number; humidity: number; wind: number;
  cloud: number; wbgt: number; wbgtLabel: string; wbgtCls: string; note: string;
}

// 屋外WBGT[℃]の近似（小野・登内 2014 の回帰式）。
// 気温Ta[℃], 相対湿度RH[%], 全天日射SR[kW/m²], 風速WS[m/s]。日射=0で日陰/夜相当。
export function computeWBGT(tempC: number, rh: number, solarKwm2 = 0, windMs = 0): number {
  const SR = Math.max(0, solarKwm2);
  const w = 0.735 * tempC + 0.0374 * rh + 0.00292 * tempC * rh
    + 7.619 * SR - 4.557 * SR * SR - 0.0572 * windMs - 4.064;
  return Math.round(w * 10) / 10;
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
  const u = `${API.openMeteo}?latitude=${lat}&longitude=${lng}&wind_speed_unit=ms`
    + `&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,shortwave_radiation,cloud_cover,weather_code`;
  const r = await fetch(u);
  const j = await r.json();
  const c = j.current;
  const temp = c.temperature_2m, feel = c.apparent_temperature;
  const humidity = c.relative_humidity_2m ?? 60, wind = c.wind_speed_10m ?? 0;
  const solar = c.shortwave_radiation ?? 0; // W/m²
  const wbgt = computeWBGT(temp, humidity, solar / 1000, wind);
  const lv = wbgtLevel(wbgt);
  const note = wbgt >= 28 ? '☀️ 日陰を強くおすすめ'
    : wbgt >= 25 ? '日陰がうれしい陽気'
    : '比較的すごしやすい';
  return { temp, feel, humidity, wind, cloud: c.cloud_cover, wbgt, wbgtLabel: lv.label, wbgtCls: lv.cls, note };
}
