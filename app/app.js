/* Signal Alert — статична версія (24.11.2026). Дані: ../data/alarm/app/state.json (файл сайту ~раз на 10 хв) або живе джерело з ПК раз на хвилину (live_api.json), зони й пошук — статичні файли.
   Рівні для всіх: 🟢 🟡 🟠 🔴 (розрахунок за відкритими даними, не офіційне повідомлення). Прогноз курсу цілі (⚫ 🩷) тут вимкнено навмисно. */
const $ = id => document.getElementById(id);
const ICON = { green: '🟢', yellow: '🟡', orange: '🟠', red: '🔴', grey: '⚪' };
const T = { green: 'Вільно', yellow: 'Тривога в районі', orange: 'Тривога, цілі поруч', red: 'Балістика поруч', grey: 'Немає свіжих даних' };
const RANK = ['green', 'yellow', 'orange', 'red'];
const NAMES = { shahed: 'Шахеди', jet: 'Реактивні БпЛА', cruise: 'Крилаті ракети', kab: 'КАБи', ballistic: 'Балістика', impact: 'Прильоти', unknown: 'Інше' };
const STALE_SEC = 1200;           // дані старші за 20 хв не показуємо як статус
const AGE_ANY_MAX = 30, NEAR_KM = 80, COMMUNITY_KM = 12;
const ls = (k, v) => { try { return v === undefined ? localStorage.getItem(k) : localStorage.setItem(k, v); } catch (e) { return null; } };
const jget = (k, d) => { try { return JSON.parse(ls(k)) ?? d; } catch (e) { return d; } };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let st = null, zones = null, placesIdx = null, pt = null, prev = null, shown = null, lowSince = null;
let place = jget('sa_place', { name: 'Київ', oblast: 'Київ (місто)', lat: 50.45, lon: 30.52, district: null });
let mine = jget('sa_mine', []);
function hold(lv) { const now = Date.now(); if (shown === null || lv === 'grey' || shown === 'grey' || RANK.indexOf(lv) >= RANK.indexOf(shown)) { shown = lv; lowSince = null; } else { lowSince = lowSince || now; if (now - lowSince >= 180000) { shown = lv; lowSince = null; } } return shown; }
$('snd').checked = ls('sa_snd') !== '0';
$('snd').onchange = () => ls('sa_snd', $('snd').checked ? '1' : '0');
function theme(t) { if (t) document.documentElement.dataset.theme = t; }
theme(ls('sa_theme'));
$('theme').onclick = () => {
  const cur = document.documentElement.dataset.theme;
  const dark = cur === 'dark' || (!cur && matchMedia('(prefers-color-scheme:dark)').matches);
  const n = dark ? 'light' : 'dark'; theme(n); ls('sa_theme', n);
};

/* ---------- геометрія (як у api/engine.py) ---------- */
const km = (a, b) => { const dy = (a[0] - b[0]) * 111, dx = (a[1] - b[1]) * 111 * Math.cos(((a[0] + b[0]) / 2) * Math.PI / 180); return Math.hypot(dx, dy); };
const canon = name => {
  const n = String(name).replace(/[’ʼ]/g, "'").trim();
  const m = n.match(/^(.+?) район(?: (.+?) область)?$/);
  if (!m) return [n, null];
  const ren = { 'Красноградський': 'Берестинський', 'Новомосковський': 'Самарівський' };
  return [(ren[m[1]] || m[1]) + ' район', m[2] || null];
};

/* ---------- статус точки (без VIP): рівні 🟢 🟡 🟠 🔴 ---------- */
function pointAlarm(s, p) {
  const reg = s.regions[p.oblast] || {};
  const pp = [p.lat, p.lon];
  for (const c of s.communities || []) if (km(pp, [c.lat, c.lon]) <= COMMUNITY_KM) return [true, c.name];
  if (!reg.alarm) return [false, null];
  if (reg.whole) return [true, reg.name];
  if (p.oblast === 'Київ (місто)') return [true, 'Київ'];
  if (p.district && (reg.districts || []).includes(canon(p.district)[0])) return [true, p.district];
  if (!p.district && (reg.districts || []).length) return [true, reg.name + ' (частково)'];
  return [false, null];
}
function pointLevel(s, p) {
  const [alarm, why] = pointAlarm(s, p);
  let lv = 'green';
  if (alarm) {
    lv = 'yellow';
    const extra = Math.max(0, (Date.now() / 1000 - s.now) / 60);           // скільки хвилин минуло від експорту
    const near = (s.objects || []).some(o => !o.impact && (o.age + extra) <= AGE_ANY_MAX && km([p.lat, p.lon], [o.plat, o.plon]) <= NEAR_KM);
    if (near) lv = 'orange';
    if ((s.regions[p.oblast] || {}).ballistic) lv = 'red';
  }
  return { level: lv, alarm, why };
}

/* ---------- карта ---------- */
const KX = Math.cos(48.5 * Math.PI / 180), LON0 = 22, LAT1 = 52.5, SC = 100 / ((40.5 - LON0) * KX);
const px = (lon, lat) => [((lon - LON0) * KX * SC).toFixed(2), ((LAT1 - lat) * SC).toFixed(2)];
async function loadZones() { try { zones = await (await fetch('../data/alarm/zones.json')).json(); } catch (e) { zones = null; } }
function drawMap() {
  if (!zones || !st || !st.ok) return;
  let s = '';
  for (const [k, z] of Object.entries(zones)) {
    const d = z.rings.map(r => 'M' + r.map(p => px(p[0], p[1]).join(',')).join('L') + 'Z').join('');
    const lv = st.regions[k] ? st.regions[k].level : 'green';
    s += '<path class="z ' + (lv === 'green' ? '' : lv) + (k === place.oblast ? ' sel' : '') + '" data-k="' + esc(k) + '" d="' + d + '"><title>' + esc(z.name) + '</title></path>';
  }
  for (const o of st.objects || []) {
    if (o.impact) continue;
    const [x, y] = px(o.lon, o.lat);
    s += '<circle class="o" cx="' + x + '" cy="' + y + '" r=".8"><title>' + esc((o.kind_ua || '') + ' ' + (o.label || '')) + '</title></circle>';
  }
  const [mx, my] = px(place.lon, place.lat);
  s += '<circle cx="' + mx + '" cy="' + my + '" r="1.3" fill="#38bdf8" stroke="#fff" stroke-width=".4"/>';
  $('map').innerHTML = s;
  $('map').querySelectorAll('.z').forEach(p => p.onclick = () => {
    const rings = zones[p.dataset.k].rings.flat();
    const lat = rings.reduce((a, q) => a + q[1], 0) / rings.length, lon = rings.reduce((a, q) => a + q[0], 0) / rings.length;
    setPlace({ name: zones[p.dataset.k].name, oblast: p.dataset.k, lat, lon, district: null });
  });
}

/* ---------- пошук місця ---------- */
const norm = s => String(s || '').toLowerCase().replace(/[’ʼ]/g, "'").replace(/\s+/g, ' ').trim();
const pretty = s => s.replace(/(^|[\s\-])([^\d\s_\-])/g, (m, a, b) => a + b.toUpperCase());
async function ensurePlaces() { if (!placesIdx) { try { placesIdx = await (await fetch('../data/alarm/app/places.json')).json(); } catch (e) { placesIdx = []; } } return placesIdx; }
function searchPlaces(q) {
  q = norm(q); if (q.length < 2) return [];
  const hits = [];
  for (const p of placesIdx) {
    for (const n of p[7]) { if (n.startsWith(q)) { hits.push([0, -p[5], p, n]); break; } if (n.includes(q)) { hits.push([1, -p[5], p, n]); break; } }
  }
  hits.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const out = [], seen = new Set();
  for (const [, , p, n] of hits) {
    const key = n + '|' + p[1] + '|' + p[3].toFixed(1) + '|' + p[4].toFixed(1);
    if (seen.has(key)) continue; seen.add(key);
    out.push({ name: pretty(n), oblast: p[1], district: p[2], lat: p[3], lon: p[4] });
    if (out.length >= 12) break;
  }
  return out;
}
let watchId = null;
function stopBeacon() { if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; } $('beacon').textContent = '📍 Маячок (де я)'; }
async function nearestAdmin(lat, lon) {          // область і район найближчого пункту (для статусу маячка)
  await ensurePlaces();
  let best = null, bd = 1e9;
  for (const p of placesIdx) { if (p[5] < 1500) continue; const d = (p[3] - lat) ** 2 + ((p[4] - lon) * .65) ** 2; if (d < bd) { bd = d; best = p; } }
  return best ? { oblast: best[1], district: best[2] } : { oblast: null, district: null };
}
function beaconFix(pos) {
  (async () => {
    const lat = pos.coords.latitude, lon = pos.coords.longitude;
    const moved = !place.beacon || km([place.lat, place.lon], [lat, lon]) > 2;
    const adm = moved || !place.oblast ? await nearestAdmin(lat, lon) : { oblast: place.oblast, district: place.district };
    place = { name: 'Я тут (маячок)', lat, lon, beacon: true, oblast: adm.oblast, district: adm.district };
    $('beacon').textContent = '📍 Маячок увімкнено · вимкнути';
    if (st && st.ok) { pt = pointLevel(st, place); render(); }
  })();
}
function pickMode(msg) {                       // браузер не дає GPS (Tesla, старі браузери): точку ставимо дотиком на карті
  window.saPick = true;
  $('pick').textContent = '🗺 Торкніться карти нижче…';
  $('placeName').textContent = msg || 'Торкніться карти «Цілі в зоні маячка», щоб поставити свою точку.';
  try { $('zmap').scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { }
}
window.saMapPick = async (lat, lon) => {
  window.saPick = false; $('pick').textContent = '🗺 Вказати на карті';
  const adm = await nearestAdmin(lat, lon);
  setPlace({ name: 'Точка на карті', lat, lon, oblast: adm.oblast, district: adm.district, manual: true });
};
$('pick').onclick = () => { if (window.saPick) { window.saPick = false; $('pick').textContent = '🗺 Вказати на карті'; render(); } else pickMode(); };
$('beacon').onclick = () => {
  if (watchId !== null) { stopBeacon(); return; }
  if (!navigator.geolocation) { pickMode('Цей браузер не дає геолокацію. Торкніться карти нижче, щоб поставити свою точку.'); return; }
  $('beacon').textContent = '📍 Шукаю вас…';
  let done = false;
  const fail = why => {
    if (done) return; done = true; stopBeacon();
    pickMode((why === 1 ? 'Немає дозволу на геолокацію. ' : 'Браузер не дав вашу геолокацію (так буває в Tesla). ') + 'Торкніться карти нижче, щоб поставити свою точку.');
  };
  const guard = setTimeout(() => fail(3), 12000);  // деякі браузери мовчать і не відповідають взагалі
  navigator.geolocation.getCurrentPosition(pos => {
    if (done) return; done = true; clearTimeout(guard); beaconFix(pos);
    watchId = navigator.geolocation.watchPosition(beaconFix, () => { }, { enableHighAccuracy: false, maximumAge: 30000 });
  }, err => { clearTimeout(guard); fail(err && err.code); }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 120000 });
};
function setPlace(p) {
  stopBeacon();
  place = p; ls('sa_place', JSON.stringify(p)); prev = null; shown = null; $('q').value = ''; $('res').hidden = true; refresh();
}
function renderMine() {
  $('mine').innerHTML = mine.map((m, i) => '<span class="chip' + (m.name === place.name && m.oblast === place.oblast ? ' on' : '') + '" data-i="' + i + '">' + esc(m.name) + ' <b data-x="' + i + '">×</b></span>').join('');
  $('mine').querySelectorAll('.chip').forEach(c => c.onclick = e => {
    if (e.target.dataset.x !== undefined) { mine.splice(+e.target.dataset.x, 1); ls('sa_mine', JSON.stringify(mine)); renderMine(); return; }
    setPlace(mine[+c.dataset.i]);
  });
}
$('save').onclick = () => { if (place.beacon) return; if (!mine.some(m => m.name === place.name && m.oblast === place.oblast)) { mine.push(place); ls('sa_mine', JSON.stringify(mine)); renderMine(); } };
let qt = null;
$('q').oninput = () => {
  clearTimeout(qt);
  const q = $('q').value.trim();
  if (q.length < 2) { $('res').hidden = true; return; }
  qt = setTimeout(async () => {
    await ensurePlaces();
    const r = searchPlaces(q);
    $('res').innerHTML = r.length ? r.map((p, i) => '<li data-i="' + i + '">' + esc(p.name) + ' <small>' + esc(p.district || p.oblast) + (p.district ? ', ' + esc(p.oblast) : '') + '</small></li>').join('') : '<li><small>Нічого не знайдено</small></li>';
    $('res').hidden = false;
    $('res').querySelectorAll('li[data-i]').forEach(li => li.onclick = () => setPlace(r[+li.dataset.i]));
  }, 200);
};

/* ---------- стан і звук ---------- */
async function liveState() {          // живе джерело з ПК (тунель), якщо сайт його оголосив і воно свіже; інакше — файл сайту
  try {
    const a = await (await fetch('../data/alarm/app/live_api.json?t=' + Math.floor(Date.now() / 60000), { cache: 'no-store' })).json();
    if (!a.url || Date.now() / 1000 - a.ts > 1800) return null;
    const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 8000);
    const s = await (await fetch(a.url + '/api/state', { cache: 'no-store', signal: ctl.signal })).json();
    clearTimeout(tm);
    if (s && s.ok && !s.stale) { s._live = true; return s; }
  } catch (e) { }
  return null;
}
async function refresh() {
  st = await liveState();
  if (!st) { try { st = await (await fetch('../data/alarm/app/state.json?t=' + Math.floor(Date.now() / 30000), { cache: 'no-store' })).json(); } catch (e) { st = null; } }
  pt = st && st.ok ? pointLevel(st, place) : null;
  render();
}
function alertLocal(lv, text) {
  if (!$('snd').checked) return;
  const pat = { yellow: [150], orange: [250, 100, 250], red: [600, 200, 600, 200, 600] }[lv] || [150];
  try { navigator.vibrate && navigator.vibrate(pat); } catch (e) { }
  try {
    const vol = { yellow: .08, orange: .2, red: .7 }[lv] || .1, ac = new (window.AudioContext || window.webkitAudioContext)();
    const n = { yellow: 1, orange: 2, red: 4 }[lv] || 1;
    for (let i = 0; i < n; i++) { const o = ac.createOscillator(), g = ac.createGain(); o.connect(g); g.connect(ac.destination); o.type = 'square'; o.frequency.value = 620; g.gain.value = vol * .3; o.start(ac.currentTime + i * .35); o.stop(ac.currentTime + i * .35 + .22); }
  } catch (e) { }
}
function render() {
  renderMine();
  const ageSec = st && st.ok ? Math.max(0, Date.now() / 1000 - (st.ts || st.now)) : null;
  if (!st || !st.ok || !pt) {
    $('dot').className = 'dot grey'; $('dotIcon').textContent = '?'; $('title').textContent = T.grey; $('sub').textContent = 'Не вдалося завантажити дані. Дивіться офіційні джерела.'; $('upd').textContent = ''; return;
  }
  const stale = ageSec > STALE_SEC;
  const lv = hold(stale ? 'grey' : pt.level);
  $('dot').className = 'dot ' + lv; $('dotIcon').textContent = { green: '✓', grey: '?' }[lv] || '!'; $('title').textContent = T[lv];
  $('placeName').textContent = (pt.why ? '🚨 ' + pt.why + ' · ' : '') + '📍 ' + place.name + (place.district ? ' · ' + place.district : '') + (place.oblast && place.oblast !== place.name ? ' · ' + place.oblast : '');
  $('sub').textContent = '';
  $('stale').hidden = !stale;
  $('upd').textContent = ageSec < 90 ? 'щойно оновлено' : 'оновлено ' + Math.round(ageSec / 60) + ' хв тому';
  const al = Object.values(st.regions).filter(v => v.alarm);
  $('aCount').textContent = al.length ? '· ' + al.length : '';
  $('alarms').innerHTML = al.length ? al.map(v => '<span class="chip ' + v.level + '">' + esc(v.name) + '</span>').join('') : '<span class="empty">Тривог немає</span>';
  const c = st.counts || {}, n = Object.values(c).reduce((a, b) => a + b, 0);
  $('tCount').textContent = n ? '· ' + n : '';
  $('threats').innerHTML = n ? Object.entries(c).map(([k, v]) => '<li>' + esc(NAMES[k] || k) + ' — <b>' + v + '</b></li>').join('') : '<li class="empty">Нічого не зафіксовано</li>';
  $('lines').innerHTML = (st.lines || []).slice(0, 8).map(l => '<li>' + esc(l) + '</li>').join('') || '<li class="empty">Порожньо</li>';
  document.title = (lv === 'green' || lv === 'grey' ? '' : ICON[lv] + ' ') + 'Signal Alert';
  if (prev !== null && prev !== lv && lv !== 'grey' && (RANK.indexOf(lv) >= 1 || lv === 'green')) alertLocal(lv, ICON[lv] + ' ' + place.name + ': ' + T[lv]);
  prev = lv; drawMap();
  if (window.saZoneUpdate) window.saZoneUpdate(st, place);
}
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
loadZones().then(refresh); setInterval(refresh, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
