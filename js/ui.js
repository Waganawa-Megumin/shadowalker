// プレゼンテーション系UI: ボトムシート制御 と 太陽コンパス描画
import { RAD } from './geo.js';

const STATES = ['peek', 'half', 'full'];

// ボトムシートのセットアップ。grabber タップで状態サイクル＋ドラッグでスナップ。
// onChange は状態変化後に呼ばれる（map.invalidateSize 用）。
export function initSheet(sheet, grabber, onChange) {
  let state = 'half';
  const apply = s => {
    state = s;
    sheet.classList.remove('sheet--peek', 'sheet--half', 'sheet--full');
    sheet.classList.add('sheet--' + s);
    if (onChange) requestAnimationFrame(onChange);
  };
  apply(state);

  // タップで次状態へ
  grabber.addEventListener('click', e => {
    if (dragged) { dragged = false; return; }
    const i = STATES.indexOf(state);
    apply(STATES[(i + 1) % STATES.length]);
  });

  // ポインタドラッグ: 上方向で広げ、下方向で縮める
  let startY = 0, dragging = false, dragged = false;
  grabber.addEventListener('pointerdown', e => {
    dragging = true; dragged = false; startY = e.clientY;
    grabber.setPointerCapture(e.pointerId);
  });
  grabber.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dy = e.clientY - startY;
    if (Math.abs(dy) < 24) return;
    dragged = true;
    const i = STATES.indexOf(state);
    if (dy < 0 && i < 2) { apply(STATES[i + 1]); startY = e.clientY; }
    else if (dy > 0 && i > 0) { apply(STATES[i - 1]); startY = e.clientY; }
  });
  grabber.addEventListener('pointerup', () => { dragging = false; });

  return { setState: apply, get state() { return state; }, expand: () => { if (state === 'peek') apply('half'); } };
}

// 太陽の方位/高度テキスト
export function renderSunStats(el, sp) {
  if (sp.altitude <= 0) {
    el.innerHTML = `<b>日の出ていない時間帯</b><br>この時刻は太陽が地平線の下です。<br>影の概念は適用されません。`;
    return;
  }
  const dirName = ['北', '北東', '東', '南東', '南', '南西', '西', '北西'][Math.round(sp.azimuth / 45) % 8];
  el.innerHTML = `方位 <b>${sp.azimuth.toFixed(0)}°</b>（${dirName}の空）<br>`
    + `高度 <b>${sp.altitude.toFixed(0)}°</b><br>`
    + `<span style="font-size:11px">影は<b style="font-size:11px">${dirName == '南' ? '北' : dirName}の反対側</b>に伸びます</span>`;
}

export function drawCompass(svgEl, sp) {
  const cx = 46, cy = 46, r = 36;
  let svg = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#FBF8F1" stroke="var(--line)"/>`;
  [['N', 0], ['E', 90], ['S', 180], ['W', 270]].forEach(([t, a]) => {
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

function polar(cx, cy, r, deg) { const a = (deg - 90) * RAD; return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }; }
