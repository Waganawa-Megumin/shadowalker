// 影みち — エントリ。地図・状態・イベント配線。
import { TOKYO, TILE_URL, TILE_ATTRIB } from './config.js';
import { solarPosition } from './sun.js';
import { destPoint, getCurrentPosition } from './geo.js';
import { fetchBuildings, buildGrid } from './buildings.js';
import { fetchRoutes } from './routing.js';
import { scoreRoute } from './shade.js';
import { fetchWeather } from './weather.js';
import { searchPlaces, makeDebouncedSearch } from './geocode.js';
import { initSheet, renderSunStats, drawCompass } from './ui.js';

const $ = id => document.getElementById(id);

/* ===== 状態 ===== */
let startPt = null, endPt = null, editing = 'start';
let buildings = [], grid = null;
let routeLayers = [], routes = [];

/* ===== 地図 ===== */
const map = L.map('map', { zoomControl: false }).setView([35.6812, 139.7671], 15);
L.control.zoom({ position: 'topright' }).addTo(map);
L.tileLayer(TILE_URL, { maxZoom: 19, attribution: TILE_ATTRIB }).addTo(map);
let startMarker = null, endMarker = null, sunMarker = null;

const sheet = initSheet($('sheet'), $('grabber'), () => map.invalidateSize());

function pinIcon(cls) { return L.divIcon({ className: '', html: `<div class="pin ${cls}"></div>`, iconSize: [24, 24], iconAnchor: [12, 24] }); }

map.on('click', e => {
  const ll = [e.latlng.lat, e.latlng.lng];
  if (editing === 'start') setStart(ll); else setEnd(ll);
});

function setStart(ll, recenter) {
  startPt = ll;
  if (startMarker) startMarker.setLatLng(ll);
  else startMarker = L.marker(ll, { icon: pinIcon('s'), draggable: true }).addTo(map)
    .on('dragend', ev => { startPt = [ev.target.getLatLng().lat, ev.target.getLatLng().lng]; afterPt(); });
  $('startLabel').textContent = `出発地 ${ll[0].toFixed(4)}, ${ll[1].toFixed(4)}`;
  setEditing('end'); afterPt();
  if (recenter) map.panTo(ll);
}
function setEnd(ll, recenter) {
  endPt = ll;
  if (endMarker) endMarker.setLatLng(ll);
  else endMarker = L.marker(ll, { icon: pinIcon('e'), draggable: true }).addTo(map)
    .on('dragend', ev => { endPt = [ev.target.getLatLng().lat, ev.target.getLatLng().lng]; afterPt(); });
  $('endLabel').textContent = `目的地 ${ll[0].toFixed(4)}, ${ll[1].toFixed(4)}`;
  afterPt();
  if (recenter) map.panTo(ll);
}
function afterPt() { $('findBtn').disabled = !(startPt && endPt); updateSun(); }
function setEditing(w) {
  editing = w;
  $('btnStart').classList.toggle('active', w === 'start');
  $('btnEnd').classList.toggle('active', w === 'end');
  document.querySelector('#btnStart small').textContent = w === 'start' ? '編集中' : '';
  document.querySelector('#btnEnd small').textContent = w === 'end' ? '編集中' : '';
}
$('btnStart').onclick = () => setEditing('start');
$('btnEnd').onclick = () => setEditing('end');
$('swapPts').onclick = () => {
  if (!startPt && !endPt) return;
  const a = startPt, b = endPt;
  startPt = endPt = null;
  if (b) setStart(b); if (a) setEnd(a);
};
$('useGps').onclick = async () => {
  const btn = $('useGps');
  btn.disabled = true; const orig = btn.innerHTML; btn.innerHTML = '<span class="spin"></span>取得中…';
  try {
    const { lat, lng } = await getCurrentPosition();
    setStart([lat, lng], false);
    map.setView([lat, lng], 16);
  } catch (e) { setStatus(e.message, true); }
  finally { btn.disabled = false; btn.innerHTML = orig; }
};

// 右下FAB: 現在地へ地図を移動（出発地は変更しない）
$('locateFab').onclick = async () => {
  const fab = $('locateFab'); fab.disabled = true;
  try {
    const { lat, lng } = await getCurrentPosition();
    map.setView([lat, lng], 16);
  } catch (e) { setStatus(e.message, true); sheet.expand(); }
  finally { fab.disabled = false; }
};

/* ===== 検索（Nominatim） ===== */
const debouncedSearch = makeDebouncedSearch(searchPlaces, 600);
const searchInput = $('searchInput'), searchResults = $('searchResults'), searchClear = $('searchClear');
searchInput.addEventListener('input', async () => {
  const q = searchInput.value;
  searchClear.hidden = !q;
  if (q.trim().length < 2) { searchResults.hidden = true; return; }
  try {
    const items = await debouncedSearch(q);
    if (!items) return;
    showSearchResults(items);
  } catch (e) { /* 中断などは無視 */ }
});
searchClear.onclick = () => { searchInput.value = ''; searchClear.hidden = true; searchResults.hidden = true; searchInput.focus(); };
document.addEventListener('click', e => {
  if (!e.target.closest('.search')) searchResults.hidden = true;
});
function showSearchResults(items) {
  searchResults.innerHTML = '';
  if (!items.length) {
    searchResults.innerHTML = '<li class="empty">該当する場所が見つかりませんでした</li>';
    searchResults.hidden = false; return;
  }
  for (const it of items) {
    const li = document.createElement('li');
    li.textContent = it.name;
    li.onclick = () => {
      const ll = [it.lat, it.lng];
      if (editing === 'start') setStart(ll, true); else setEnd(ll, true);
      map.setView(ll, 16);
      searchResults.hidden = true;
      searchInput.value = '';
      searchClear.hidden = true;
      sheet.expand();
    };
    searchResults.appendChild(li);
  }
  searchResults.hidden = false;
}

/* ===== 時刻UI ===== */
const dateInput = $('dateInput'), timeSlider = $('timeSlider'), timeText = $('timeText');
function pad(n) { return String(n).padStart(2, '0'); }
function initNow() {
  const now = new Date();
  dateInput.value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  timeSlider.value = now.getHours() * 60 + now.getMinutes();
  updateTime();
}
function chosenDate() {
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
  drawCompass($('compass'), sp);
  renderSunStats($('sunStats'), sp);
  if (startPt && sp.altitude > 0) {
    const sunLL = destPoint(startPt, sp.azimuth, 120);
    if (sunMarker) sunMarker.setLatLng(sunLL);
    else sunMarker = L.marker(sunLL, { icon: L.divIcon({ html: '<div class="sun-icon">☀️</div>', className: '', iconSize: [24, 24] }) }).addTo(map);
  } else if (sunMarker) { map.removeLayer(sunMarker); sunMarker = null; }
}

/* ===== 天気 ===== */
async function loadWeather() {
  const c = startPt || TOKYO;
  try {
    const w = await fetchWeather(c[0], c[1]);
    $('weatherLine').innerHTML =
      `<span class="temp-chip">${w.temp.toFixed(0)}℃（体感${w.feel.toFixed(0)}℃）</span>雲量${w.cloud}% ・ ${w.note}`;
  } catch (e) {
    $('weatherLine').innerHTML = '天気情報を取得できませんでした';
  }
}

/* ===== メイン ===== */
const statusEl = $('status');
function setStatus(msg, err) { statusEl.innerHTML = msg; statusEl.classList.toggle('err', !!err); }

$('findBtn').onclick = async () => {
  $('findBtn').disabled = true;
  clearRoutes();
  $('resultCard').style.display = 'none';
  const sp = solarPosition(chosenDate(), startPt[0], startPt[1]);
  try {
    setStatus('<span class="spin"></span>経路を計算中…');
    const raw = await fetchRoutes(startPt, endPt);

    // 経路全体の bbox で建物取得
    let minLat = 90, maxLat = -90, minLng = 999, maxLng = -999;
    raw.forEach(r => r.coords.forEach(c => {
      minLat = Math.min(minLat, c[0]); maxLat = Math.max(maxLat, c[0]);
      minLng = Math.min(minLng, c[1]); maxLng = Math.max(maxLng, c[1]);
    }));
    const pad = 0.0012; // 約130m余白
    const bbox = { s: minLat - pad, w: minLng - pad, n: maxLat + pad, e: maxLng + pad };
    if (sp.altitude > 0.5) {
      setStatus('<span class="spin"></span>建物データを取得中…');
      buildings = await fetchBuildings(bbox);
      grid = buildGrid(buildings, bbox);
    } else { buildings = []; grid = buildGrid([], bbox); }

    setStatus('<span class="spin"></span>日陰を解析中…（建物 ' + buildings.length + ' 棟）');
    await new Promise(r => setTimeout(r, 30));

    routes = raw.map((r, i) => {
      const sc = scoreRoute(r.coords, sp, grid, buildings);
      return { ...r, ...sc, name: i === 0 ? '最短経路' : '別ルート ' + i };
    });

    // スコア付け: 日陰多い & 距離短いほど良い
    const pref = +$('prefSlider').value / 100;
    const maxD = Math.max(...routes.map(r => r.distance));
    routes.forEach(r => {
      const distScore = 1 - (r.distance / maxD);
      r.combined = pref * r.shadePct + (1 - pref) * distScore;
    });
    const bestIdx = routes.reduce((bi, r, i, a) => r.combined > a[bi].combined ? i : bi, 0);

    drawRoutes(bestIdx);
    renderResults(bestIdx);
    setStatus(sp.altitude <= 0.5 ? '※ 日射のない時間帯のため、距離のみで評価しています' : '');
    sheet.setState('half');
  } catch (e) {
    setStatus('取得に失敗しました。時間をおいて再度お試しください（外部サービス混雑の可能性）。', true);
  } finally { $('findBtn').disabled = false; }
};

function clearRoutes() {
  routeLayers.forEach(l => l.forEach(p => map.removeLayer(p)));
  routeLayers = [];
}
function drawRoutes(sel) {
  clearRoutes();
  routes.forEach((r, idx) => {
    const layer = [];
    if (idx !== sel) {
      layer.push(L.polyline(r.coords, { color: '#9b9286', weight: 4, opacity: .5 }).addTo(map));
    } else {
      r.segs.forEach(s => {
        layer.push(L.polyline([s.a, s.b], { color: s.shaded ? '#2E6E7E' : '#E07B2E', weight: 6, opacity: .92 }).addTo(map));
      });
    }
    routeLayers.push(layer);
  });
  const all = routes[sel].coords;
  map.fitBounds(L.latLngBounds(all.concat([startPt, endPt])), { padding: [40, 40] });
}

function renderResults(bestIdx) {
  const box = $('results'); box.innerHTML = '';
  $('resultCard').style.display = 'block';
  const order = [...routes.keys()].sort((a, b) => routes[b].combined - routes[a].combined);
  order.forEach(i => {
    const r = routes[i];
    const card = document.createElement('div');
    card.className = 'route-card' + (i === bestIdx ? ' best' : '') + (i === bestIdx ? ' sel' : '');
    const mins = Math.round(r.distance / 80); // 徒歩 約80m/分
    card.innerHTML = `
      <div class="rt-name">${r.name}</div>
      <div class="bar"><i style="width:${(r.shadePct * 100).toFixed(0)}%"></i></div>
      <div class="rt-meta">
        <span class="shade-pct">日陰 ${(r.shadePct * 100).toFixed(0)}%</span>
        <span><b>${(r.distance / 1000).toFixed(2)}</b> km</span>
        <span>徒歩約 <b>${mins}</b> 分</span>
      </div>`;
    card.onclick = () => { drawRoutes(i); [...box.children].forEach(c => c.classList.remove('sel')); card.classList.add('sel'); };
    box.appendChild(card);
  });
}

/* ===== 初期化 ===== */
initNow();
loadWeather();
setEditing('start');

/* ===== Service Worker 登録（相対パスでサブパス対応） ===== */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js', { scope: './' }).catch(() => {});
  });
}
