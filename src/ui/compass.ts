// 太陽コンパスSVG と 方位/高度テキスト
import type { SolarPosition } from '../types';

const RAD = Math.PI / 180;

export function renderSunStats(el: HTMLElement, sp: SolarPosition): void {
  if (sp.altitude <= 0) {
    el.innerHTML = `<b>日の出ていない時間帯</b><br>この時刻は太陽が地平線の下です。<br>影の概念は適用されません。`;
    return;
  }
  const dirName = ['北', '北東', '東', '南東', '南', '南西', '西', '北西'][Math.round(sp.azimuth / 45) % 8];
  el.innerHTML = `方位 <b>${sp.azimuth.toFixed(0)}°</b>（${dirName}の空）<br>`
    + `高度 <b>${sp.altitude.toFixed(0)}°</b><br>`
    + `<span style="font-size:11px">影は<b style="font-size:11px">${dirName === '南' ? '北' : dirName}の反対側</b>に伸びます</span>`;
}

export function drawCompass(svgEl: SVGElement, sp: SolarPosition): void {
  const cx = 46, cy = 46, r = 36;
  let svg = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#FBF8F1" stroke="var(--line)"/>`;
  ([['N', 0], ['E', 90], ['S', 180], ['W', 270]] as [string, number][]).forEach(([t, a]) => {
    const p = polar(cx, cy, r - 9, a);
    svg += `<text x="${p.x}" y="${p.y + 3}" font-size="9" fill="var(--ink-soft)" text-anchor="middle" font-family="Zen Kaku Gothic New">${t}</text>`;
  });
  if (sp.altitude > 0) {
    const dot = polar(cx, cy, (r - 16) * (1 - sp.altitude / 90) + 6, sp.azimuth);
    svg += `<line x1="${cx}" y1="${cy}" x2="${dot.x}" y2="${dot.y}" stroke="var(--sun)" stroke-width="1.5" opacity=".5"/>`;
    svg += `<circle cx="${dot.x}" cy="${dot.y}" r="6" fill="var(--sun)"/><circle cx="${dot.x}" cy="${dot.y}" r="6" fill="none" stroke="var(--sun-soft)" stroke-width="3"/>`;
  } else {
    svg += `<text x="${cx}" y="${cy + 4}" font-size="9" fill="var(--ink-soft)" text-anchor="middle">夜</text>`;
  }
  svgEl.innerHTML = svg;
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const a = (deg - 90) * RAD;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}
