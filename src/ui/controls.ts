// ボトムシート制御 と ルート一覧・検索結果の描画
import type { ScoredRoute, LatLng } from '../types';
import type { Place } from '../geocode';
import type { Weather } from '../weather';

const STATES = ['peek', 'half', 'full'] as const;
type SheetState = typeof STATES[number];

export interface SheetHandle {
  setState(s: SheetState): void;
  readonly state: SheetState;
  expand(): void;
}

export function initSheet(sheet: HTMLElement, grabber: HTMLElement, onChange?: () => void): SheetHandle {
  let state: SheetState = 'half';
  let dragged = false, dragging = false, startY = 0;

  const apply = (s: SheetState) => {
    state = s;
    sheet.classList.remove('sheet--peek', 'sheet--half', 'sheet--full');
    sheet.classList.add('sheet--' + s);
    if (onChange) requestAnimationFrame(onChange);
  };
  apply(state);

  grabber.addEventListener('click', () => {
    if (dragged) { dragged = false; return; }
    const i = STATES.indexOf(state);
    apply(STATES[(i + 1) % STATES.length]);
  });
  grabber.addEventListener('pointerdown', e => {
    dragging = true; dragged = false; startY = e.clientY;
    (grabber as HTMLElement).setPointerCapture(e.pointerId);
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

  return { setState: apply, get state() { return state; }, expand() { if (state === 'peek') apply('half'); } };
}

export function renderWeather(el: HTMLElement, w: Weather): void {
  el.innerHTML = `<span class="temp-chip">${w.temp.toFixed(0)}℃（体感${w.feel.toFixed(0)}℃）</span>雲量${w.cloud}% ・ ${w.note}`;
}

export function renderSearchResults(
  ul: HTMLElement, items: Place[], onPick: (p: Place) => void,
): void {
  ul.innerHTML = '';
  if (!items.length) {
    ul.innerHTML = '<li class="empty">該当する場所が見つかりませんでした</li>';
    ul.hidden = false; return;
  }
  for (const it of items) {
    const li = document.createElement('li');
    li.textContent = it.name;
    li.onclick = () => onPick(it);
    ul.appendChild(li);
  }
  ul.hidden = false;
}

// Google マップで開く（実ナビは Google に渡す補完方針）
export function googleMapsUrl(start: LatLng, end: LatLng, coords?: LatLng[]): string {
  let u = `https://www.google.com/maps/dir/?api=1`
    + `&origin=${start[0]},${start[1]}&destination=${end[0]},${end[1]}&travelmode=walking`;
  if (coords && coords.length > 4) {
    // 主要な経由点を最大3点間引いて付与（Google の上限と精度のバランス）
    const picks: LatLng[] = [];
    for (let k = 1; k <= 3; k++) picks.push(coords[Math.floor(coords.length * k / 4)]);
    u += `&waypoints=` + encodeURIComponent(picks.map(c => `${c[0]},${c[1]}`).join('|'));
  }
  return u;
}

export function renderRoutes(
  box: HTMLElement, routes: ScoredRoute[], bestIdx: number, hotWeather: boolean,
  start: LatLng, end: LatLng, onSelect: (i: number) => void,
): void {
  box.innerHTML = '';
  const order = [...routes.keys()].sort((a, b) => (routes[b].combined ?? 0) - (routes[a].combined ?? 0));
  order.forEach(i => {
    const r = routes[i];
    const card = document.createElement('div');
    card.className = 'route-card' + (i === bestIdx ? ' best' : '') + (i === bestIdx ? ' sel' : '');
    const mins = Math.round(r.distance / 80);
    const coveredStar = (hotWeather && r.coveredPct >= 0.25) ? '<span class="badge">日陰★★★</span>' : '';
    card.innerHTML = `
      <div class="rt-name">${r.name}${coveredStar}</div>
      <div class="bar"><i style="width:${(r.shadePct * 100).toFixed(0)}%"></i></div>
      <div class="rt-meta">
        <span class="shade-pct">日陰 ${(r.shadePct * 100).toFixed(0)}%</span>
        <span>うち覆い <b>${(r.coveredPct * 100).toFixed(0)}</b>%</span>
        <span><b>${(r.distance / 1000).toFixed(2)}</b> km</span>
        <span>徒歩約 <b>${mins}</b> 分</span>
      </div>
      <a class="gmap-btn" href="${googleMapsUrl(start, end, r.coords)}" target="_blank" rel="noopener">このルートをGoogleマップで開く ↗</a>`;
    card.querySelector('.gmap-btn')?.addEventListener('click', e => e.stopPropagation());
    card.onclick = () => { onSelect(i); [...box.children].forEach(c => c.classList.remove('sel')); card.classList.add('sel'); };
    box.appendChild(card);
  });
}
