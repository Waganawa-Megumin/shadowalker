// 天気（Open-Meteo / キー不要）
import { API } from './config.js';

// 返り値 { temp, feel, cloud, note } または null
export async function fetchWeather(lat, lng) {
  const u = `${API.openMeteo}?latitude=${lat}&longitude=${lng}&current=temperature_2m,cloud_cover,weather_code,apparent_temperature`;
  const r = await fetch(u);
  const j = await r.json();
  const c = j.current;
  const feel = c.apparent_temperature;
  const note = feel >= 30 ? '☀️ 日陰を強くおすすめ'
    : feel >= 26 ? '日陰がうれしい陽気'
    : '比較的すごしやすい';
  return { temp: c.temperature_2m, feel, cloud: c.cloud_cover, note };
}
