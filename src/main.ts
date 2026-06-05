// 影みち — エントリ。地図・状態・イベント配線。
import L from 'leaflet';
import './styles.css';
import type { LatLng, ScoredRoute, Bbox } from './types';
import { TOKYO, setRayStep, STUB, SHADE_ALT_MIN } from './config';
import { logError, getDiagnostics } from './log';
import { solarPosition } from './sun/position';
import { destPoint, getCurrentPosition } from './geo';
import { fetchBuildings, fetchCoveredWays, fetchOsmTrees } from './data/overpass';
import { loadPlateauForBbox, mergeBuildings } from './data/plateau';
import { loadCuratedArcades, loadTreeGeojson } from './data/local';
import { loadTokyoTrees } from './data/trees-tokyo';
import { loadParksForBbox } from './data/parks';
import { fetchRoutes } from './routing/provider';
import { scoreRoutesAsync } from './shade/runner';
import { fetchWeather, type Weather } from './weather';
import { searchPlaces, makeDebouncedSearch } from './geocode';
import { createMap, pinIcon, sunIcon } from './map/leaflet-setup';
import { setupPoiLayer } from './map/poi-layer';
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
const poiLayer = setupPoiLayer(map);
($('poiToggle') as HTMLInputElement).onchange = (e) => {
  void poiLayer.setEnabled((e.target as HTMLInputElement).checked);
};
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

/* ===== ルートの選び方スライダー（意味を言葉で明示） ===== */
const prefSlider = $('prefSlider') as HTMLInputElement;
const prefText = $('prefText');
function prefLabel(v: number): string {
  if (v <= 15) return '最短を優先';
  if (v <= 40) return 'やや最短';
  if (v < 60) return 'バランス';
  if (v < 85) return '日陰を優先';
  return 'とにかく日陰';
}
function updatePref() { prefText.textContent = prefLabel(+prefSlider.value); }
prefSlider.oninput = updatePref;
updatePref();

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
  let stage = 'ルート取得';
  try {
    setStatus('<span class="spin"></span>徒歩ルートを計算中…');
    const raw = await fetchRoutes(startPt, endPt);
    stage = '周辺データ取得';

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
    let parks: Awaited<ReturnType<typeof loadParksForBbox>> = [];

    if (sp.altitude > SHADE_ALT_MIN) {
      setStatus('<span class="spin"></span>建物・覆い経路・街路樹・公園を取得中…');
      // 各取得は best-effort。1つ失敗しても全体を止めない（PLATEAU/同梱データで継続）
      const [op, plateau, curated, covOsm, osmTrees, tokyoTrees, parksData] = await Promise.all([
        fetchBuildings(bbox).catch(() => []), loadPlateauForBbox(bbox).catch(() => []),
        loadCuratedArcades(bbox).catch(() => []), fetchCoveredWays(bbox).catch(() => []),
        fetchOsmTrees(bbox).catch(() => []), loadTokyoTrees(bbox).catch(() => []),
        loadParksForBbox(bbox).catch(() => []),
      ]);
      buildings = mergeBuildings(op, plateau);
      setRayStep(plateau.length ? 3 : 4); // PLATEAU があれば刻みを細かく
      coveredWays = [...curated, ...covOsm];
      trees = [...tokyoTrees, ...osmTrees];
      parks = parksData;
      // 東京都データもOSMも取れない（オフライン/開発）時はサンプルで代替
      if (!trees.length && (STUB || import.meta.env.DEV)) trees = await loadTreeGeojson('sample', bbox);
    }

    stage = '日陰解析';
    setStatus(`<span class="spin"></span>日陰を解析中…（建物${buildings.length} / 覆い${coveredWays.length} / 樹${trees.length} / 公園${parks.length}）`);
    routes = await scoreRoutesAsync(raw, { sp, bbox, buildings, coveredWays, trees, parks });
    stage = '描画';

    const pref = +($('prefSlider') as HTMLInputElement).value / 100;
    // 距離項は「最短ルートからの%遠回り」（直感的・安定。2倍遠回りで0）
    const minD = Math.min(...routes.map(r => r.distance));
    routes.forEach(r => {
      const detour = minD > 0 ? (r.distance - minD) / minD : 0;
      const closeness = 1 - Math.min(1, detour);
      r.combined = pref * r.shadePct + (1 - pref) * closeness;
    });
    const bestIdx = routes.reduce((bi, r, i, a) => (r.combined ?? 0) > (a[bi].combined ?? 0) ? i : bi, 0);

    drawRoutes(map, routeGroup, routes, bestIdx, startPt, endPt);
    const warm = !!weather && weather.wbgt >= 25; // 暑さ指数25(警戒)以上で日陰★バッジを表示
    renderRoutes($('results'), routes, bestIdx, warm, startPt, endPt, i => drawRoutes(map, routeGroup, routes, i, startPt!, endPt!));
    $('resultCard').style.display = 'block';
    setStatus(sp.altitude <= SHADE_ALT_MIN ? '※ 日射が弱い時間帯のため、距離を重視して評価しています' : '');
    sheet.setState('half');
  } catch (e) {
    logError('findBtn:' + stage, e);
    const reason = e instanceof Error ? e.message : String(e);
    setStatus(`取得に失敗しました（${stage}：${reason}）。時間をおいて再度お試しください。 <button class="diag-btn" id="copyDiag">診断ログをコピー</button>`, true);
    const cb = document.getElementById('copyDiag') as HTMLButtonElement | null;
    if (cb) cb.onclick = async () => {
      try { await navigator.clipboard.writeText(getDiagnostics()); cb.textContent = '✓ コピーしました（貼り付けて共有できます）'; }
      catch { cb.textContent = 'コピー不可（コンソールに出力済み）'; console.log(getDiagnostics()); }
    };
  } finally { btn.disabled = false; }
};

/* ===== 初期化 ===== */
initNow();
loadWeather();
setEditing('start');

// デスクトップのコンソールから __kagemichi.diagnostics() で診断ログを取得できる
(window as unknown as { __kagemichi?: unknown }).__kagemichi = { diagnostics: getDiagnostics };

if ('serviceWorker' in navigator) {
  // 既にSW管理下のページで新SWが制御を奪ったら（=新版がデプロイされたら）一度だけ自動リロード
  if (navigator.serviceWorker.controller) {
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      location.reload();
    });
  }
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL });
      reg.update().catch(() => {});
      // 復帰時・定期的に更新確認（最新ビルドを取りこぼさない）
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
      setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
    } catch { /* SW未対応でも通常動作 */ }
  });
}
