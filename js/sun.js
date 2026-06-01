// 太陽位置（SunCalc 準拠の天文計算 / 外部データ不要）
// 返り値: { azimuth: 方位[度] 北0°時計回り, altitude: 高度[度] }

const RAD = Math.PI / 180;

export function solarPosition(date, lat, lng) {
  const dayMs = 86400000, J1970 = 2440588, J2000 = 2451545;
  const toDays = d => d.valueOf() / dayMs - 0.5 + J1970 - J2000;
  const e = RAD * 23.4397;
  const d = toDays(date);
  const M = RAD * (357.5291 + 0.98560028 * d);
  const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const L = M + C + RAD * 102.9372 + Math.PI;
  const dec = Math.asin(Math.sin(0) * Math.cos(e) + Math.cos(0) * Math.sin(e) * Math.sin(L));
  const ra  = Math.atan2(Math.sin(L) * Math.cos(e) - Math.tan(0) * Math.sin(e), Math.cos(L));
  const lw = RAD * -lng, phi = RAD * lat;
  const sidereal = RAD * (280.16 + 360.9856235 * d) - lw;
  const H = sidereal - ra;
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  return { azimuth: (az / RAD + 180 + 360) % 360, altitude: alt / RAD };
}
