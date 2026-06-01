// 影みち — エントリ。地図・状態・イベント配線。
import L from 'leaflet';
import './styles.css';
import type { LatLng, ScoredRoute, Bbox } from './types';
import { TOKYO, setRayStep, STUB } from './config';
import { solarPosition } from './sun/position';
import { destPoint, getCurrentPosition } from './geo';
import { fetchBuildings, fetchCoveredWays, fetchOsmTrees } from './data/overpass';
import { loadPlateauForBbox, mergeBuildings } from './data/plateau';
import { loadCuratedArcades, loadTreeGeojson } from './data/local';
import { fetchRoutes } from './routing/provider';
import { scoreRoutesAsync } from './shade/runner';
import { fetchWeather, type Weather } from './weather';
import { searchPlaces, makeDebouncedSearch } from './geocode';
import { createMap, pinIcon, sunIcon } from './map/leaflet-setup';
import { drawRoutes } from './map/render-route';
import { initSheet, renderWeather, renderSearchResults, renderRoutes } from './ui/controls';
import { drawCompass, renderSunStats } from './ui/compass';

const $ = (id: string) => document.getElementById(id)!;

/* ===== 状態 ===== */
let startPt: LatLng | null = null, endPt: LatLng | null = null, editing: 'start' | 'end' = 'start';
let routes: ScoredRoute[] = [];
let weather: Weather | null = null;

/* ===== 地図 ===== */
const map = createMap($('map'));
const routeGroup = L.layerGroup().addTo(map);
let startMarker: L.Marker | null = null, endMarker: L.Marker | null = null, sunMarker: L.Marker | null = null;
const sheet = initSheet($('sheet'), $('grabber'), () => map.invalidateSize());

map.on('click', e => {
  const ll: LatLng = [e.latlng.lat, e.latlng.lng];
  if (editing === 'start') setStart(ll); else setEnd(ll);
});

function setStart(ll: LatLng, recenter = false) {
  startPt = ll;
  if (startMarker) startMarker.setLatLng(ll as L.LatLngTuple);
  else startMarker = L.marker(ll as L.LatLngTuple, { icon: pinIcon('s'), draggable: true }).addTo(map)
    .on('dragend', ev => { const m = ev.target as L.Marker; startPt = [m.getLatLng().lat, m.getLatLng().lng]; afterPt(); });
  ($('startLabel')).textContent = `出発地 ${ll[0].toFixed(4)}, ${ll[1].toFixed(4)}`;
  setEditing('end'); afterPt();
  if (recenter) map.panTo(ll as L.LatLngTuple);
}
function setEnd(ll: LatLng, recenter = false) {
  endPt = ll;
  if (endMarker) endMarker.setLatLng(ll as L.LatLngTuple);
  else endMarker = L.marker(ll as L.LatLngTuple, { icon: pinIcon('e'), draggable: true }).addTo(map)
    .on('dragend', ev => { const m = ev.target as L.Marker; endPt = [m.getLatLng().lat, m.getLatLng().lng]; afterPt(); });
  ($('endLabel')).textContent = `目的地 ${ll[0].toFixed(4)}, ${ll[1].toFixed(4)}`;
  afterPt();
  if (recenter) map.panTo(ll as L.LatLngTuple);
}
function afterPt() { ($('findBtn') as HTMLButtonElement).disabled = !(startPt && endPt); updateSun(); }
function setEditing(w: 'start' | 'end') {
  editing = w;
  $('btnStart').classList.toggle('active', w === 'start');
  $('btnEnd').classList.toggle('active', w === 'end');
  document.querySelector('#btnStart small')!.textContent = w === 'start' ? '編集中' : '';
  document.querySelector('#btnEnd small')!.textContent = w === 'end' ? '編集中' : '';
}
$('btnStart').onclick = () => setEditing('start');
$('btnEnd').onclick = () => setEditing('end');
$('swapPts').onclick = () => {
  const a = startPt, b = endPt; startPt = endPt = null;
  if (b) setStart(b); if (a) setEnd(a);
};
$('useGps').onclick = async () => {
  const btn = $('useGps') as HTMLButtonElement;
  btn.disabled = true; const orig = btn.innerHTML; btn.innerHTML = '<span class="spin"></span>取得中…';
  try { const { lat, lng } = await getCurrentPosition(); setStart([lat, lng]); map.setView([lat, lng], 16); }
  catch (e) { setStatus((e as Error).message, true); }
  finally { btn.disabled = false; btn.innerHTML = orig; }
};
$('locateFab').onclick = async () => {
  const fab = $('locateFab') as HTMLButtonElement; fab.disabled = true;
  try { const { lat, lng } = await getCurrentPosition(); map.setView([lat, lng], 16); }
  catch (e) { setStatus((e as Error).message, true); sheet.expand(); }
  finally { fab.disabled = false; }
};

/* ===== 検索 ===== */
const debounced = makeDebouncedSearch(searchPlaces, 600);
const searchInput = $('searchInput') as HTMLInputElement;
const searchResults = $('searchResults');
const searchClear = $('searchClear');
searchInput.addEventListener('input', async () => {
  const q = searchInput.value;
  (searchClear as HTMLElement).hidden = !q;
  if (q.trim().length < 2) { searchResults.hidden = true; return; }
  try {
    const items = await debounced(q);
    renderSearchResults(searchResults, items, pick => {
      const ll: LatLng = [pick.lat, pick.lng];
      if (editing === 'start') setStart(ll, true); else setEnd(ll, true);
      map.setView(ll as L.LatLngTuple, 16);
      searchResults.hidden = true; searchInput.value = ''; (searchClear as HTMLElement).hidden = true;
      sheet.expand();
    });
  } catch { /* 中断等は無視 */ }
});
(searchClear as HTMLElement).onclick = () => { searchInput.value = ''; (searchClear as HTMLElement).hidden = true; searchResults.hidden = true; searchInput.focus(); };
document.addEventListener('click', e => { if (!(e.target as HTMLElement).closest('.search')) searchResults.hidden = true; });

/* ===== 時刻UI ===== */
const dateInput = $('dateInput') as HTMLInputElement;
const timeSlider = $('timeSlider') as HTMLInputElement;
const timeText = $('timeText');
const pad = (n: number) => String(n).padStart(2, '0');
function initNow() {
  const now = new Date();
  dateInput.value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  timeSlider.value = String(now.getHours() * 60 + now.getMinutes());
  updateTime();
}
function chosenDate(): Date {
  const [y, m, d] = dateInput.value.split('-').map(Number);
  const mins = +timeSlider.value;
  return new Date(y, m - 1, d, Math.floor(mins / 60), mins % 60);
}
function updateTime() {
  const mins = +timeSlider.value;
  timeText.textContent = `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
  updateSun();
}
timeSlider.oninput = updateTime;
dateInput.onchange = updateSun;
$('nowBtn').onclick = initNow;

/* ===== 太陽表示 ===== */
function updateSun() {
  const center = startPt || TOKYO;
  const sp = solarPosition(chosenDate(), center[0], center[1]);
  drawCompass($('compass') as unknown as SVGElement, sp);
  renderSunStats($('sunStats'), sp);
  if (startPt && sp.altitude > 0) {
    const sunLL = destPoint(startPt, sp.azimuth, 120);
    if (sunMarker) sunMarker.setLatLng(sunLL as L.LatLngTuple);
    else sunMarker = L.marker(sunLL as L.LatLngTuple, { icon: sunIcon() }).addTo(map);
  } else if (sunMarker) { map.removeLayer(sunMarker); sunMarker = null; }
}

/* ===== 天気 ===== */
async function loadWeather() {
  const c = startPt || TOKYO;
  try { weather = await fetchWeather(c[0], c[1]); renderWeather($('weatherLine'), weather); }
  catch { $('weatherLine').innerHTML = '天気情報を取得できませんでした'; }
}

/* ===== メイン ===== */
function setStatus(msg: string, err = false) { const el = $('status'); el.innerHTML = msg; el.classList.toggle('err', err); }

($('findBtn') as HTMLButtonElement).onclick = async () => {
  if (!startPt || !endPt) return;
  const btn = $('findBtn') as HTMLButtonElement;
  btn.disabled = true;
  routeGroup.clearLayers();
  $('resultCard').style.display = 'none';
  const sp = solarPosition(chosenDate(), startPt[0], startPt[1]);
  try {
    setStatus('<span class="spin"></span>徒歩ルートを計算中…');
    const raw = await fetchRoutes(startPt, endPt);

    let minLat = 90, maxLat = -90, minLng = 999, maxLng = -999;
    raw.forEach(r => r.coords.forEach(c => {
      minLat = Math.min(minLat, c[0]); maxLat = Math.max(maxLat, c[0]);
      minLng = Math.min(minLng, c[1]); maxLng = Math.max(maxLng, c[1]);
    }));
    const padDeg = 0.0012;
    const bbox: Bbox = { s: minLat - padDeg, w: minLng - padDeg, n: maxLat + padDeg, e: maxLng + padDeg };

    let buildings: Awaited<ReturnType<typeof fetchBuildings>> = [];
    let coveredWays: Awaited<ReturnType<typeof fetchCoveredWays>> = [];
    let trees: Awaited<ReturnType<typeof fetchOsmTrees>> = [];

    if (sp.altitude > 0.5) {
      setStatus('<span class="spin"></span>建物・覆い経路・街路樹を取得中…');
      const wantSample = STUB || import.meta.env.DEV;
      const [op, plateau, curated, covOsm, osmTrees, odTrees] = await Promise.all([
        fetchBuildings(bbox), loadPlateauForBbox(bbox), loadCuratedArcades(bbox),
        fetchCoveredWays(bbox), fetchOsmTrees(bbox),
        wantSample ? loadTreeGeojson('sample', bbox) : Promise.resolve([]),
      ]);
      buildings = mergeBuildings(op, plateau);
      setRayStep(plateau.length ? 3 : 4); // PLATEAU があれば刻みを細かく
      coveredWays = [...curated, ...covOsm];
      trees = [...odTrees, ...osmTrees];
    }

    setStatus(`<span class="spin"></span>日陰を解析中…（建物${buildings.length} / 覆い${coveredWays.length} / 樹${trees.length}）`);
    routes = await scoreRoutesAsync(raw, { sp, bbox, buildings, coveredWays, trees });

    const pref = +($('prefSlider') as HTMLInputElement).value / 100;
    const maxD = Math.max(...routes.map(r => r.distance));
    routes.forEach(r => { r.combined = pref * r.shadePct + (1 - pref) * (1 - r.distance / maxD); });
    const bestIdx = routes.reduce((bi, r, i, a) => (r.combined ?? 0) > (a[bi].combined ?? 0) ? i : bi, 0);

    drawRoutes(map, routeGroup, routes, bestIdx, startPt, endPt);
    const hot = !!weather && weather.feel >= 30;
    renderRoutes($('results'), routes, bestIdx, hot, startPt, endPt, i => drawRoutes(map, routeGroup, routes, i, startPt!, endPt!));
    $('resultCard').style.display = 'block';
    setStatus(sp.altitude <= 0.5 ? '※ 日射のない時間帯のため、距離のみで評価しています' : '');
    sheet.setState('half');
  } catch {
    setStatus('取得に失敗しました。時間をおいて再度お試しください（外部サービス混雑の可能性）。', true);
  } finally { btn.disabled = false; }
};

/* ===== 初期化 ===== */
initNow();
loadWeather();
setEditing('start');

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch(() => {});
  });
}
