/* Signal Alert: карта повітряних цілей у зоні маячка (24.11.2026). Рахується в телефоні з того самого стану, що й статус
   (живий з ПК раз на хвилину або файл сайту). Координати маячка нікуди не надсилаються. Прогнозу ⚫/🩷 тут немає — лише позиції, курс і вік. */
(() => {
  const ZONE_KM = 20, VIEW_KM = 60, AGE_MAX = 30;
  const COL = { shahed: '#f59e0b', jet: '#ef4444', cruise: '#a855f7', kab: '#eab308', ballistic: '#dc2626', unknown: '#9ca3af' };
  const KINDS = { shahed: 'Шахед / БпЛА', jet: 'Реактивний БпЛА', cruise: 'Крилата ракета', kab: 'КАБ', ballistic: 'Балістика', impact: 'Прильот', unknown: 'Ціль' };
  let map = null, tiles = null, layer = null, lastKey = '', tileErr = 0;
  const e = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const km = (a, b) => { const dy = (a[0] - b[0]) * 111, dx = (a[1] - b[1]) * 111 * Math.cos(((a[0] + b[0]) / 2) * Math.PI / 180); return Math.hypot(dx, dy); };
  const brg = (a, b) => { const r = Math.PI / 180, y = Math.sin((b[1] - a[1]) * r) * Math.cos(b[0] * r), x = Math.cos(a[0] * r) * Math.sin(b[0] * r) - Math.sin(a[0] * r) * Math.cos(b[0] * r) * Math.cos((b[1] - a[1]) * r); return (Math.atan2(y, x) / r + 360) % 360; };
  const dark = () => { const t = document.documentElement.dataset.theme; return t === 'dark' || (!t && matchMedia('(prefers-color-scheme:dark)').matches); };

  function setTiles() {
    if (!map) return;
    if (tiles) map.removeLayer(tiles);
    const src = tileErr > 6 ? 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png' : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    tiles = L.tileLayer(src, { maxZoom: 16, subdomains: 'abc', attribution: '© OpenStreetMap', className: dark() ? 'tiles-dark' : '' }).addTo(map);
    tiles.on('tileerror', () => { tileErr++; if (tileErr === 7) setTiles(); });
  }
  function init() {
    if (map) return true;
    if (!window.L) return false;
    map = L.map('zmap', { scrollWheelZoom: false });
    setTiles();
    map.on('click', ev => { if (window.saPick && window.saMapPick) window.saMapPick(ev.latlng.lat, ev.latlng.lng); });
    layer = L.layerGroup().addTo(map);
    document.getElementById('theme').addEventListener('click', () => setTimeout(setTiles, 50));
    return true;
  }
  function objects(st, p) {
    const extra = Math.max(0, (Date.now() / 1000 - (st.now || st.ts)) / 60);
    const me = [p.lat, p.lon], out = [];
    for (const o of st.objects || []) {
      const pos = [o.plat ?? o.lat, o.plon ?? o.lon], d = km(me, pos), age = Math.round((o.age || 0) + extra);
      if (d > VIEW_KM || (!o.impact && age > AGE_MAX) || (o.impact && age > 60)) continue;
      const it = { kind: o.kind, label: o.label, no: o.no, lat: pos[0], lon: pos[1], area: !!o.area, impact: !!o.impact, age, km: Math.round(d * 10) / 10,
        heading: (o.area || o.impact || o.heading == null) ? null : Math.round(o.heading), pass: null };
      if (it.heading != null) {                       // найближчий прохід курсу повз точку (інформативно)
        const ang = ((brg(pos, me) - it.heading + 540) % 360 - 180) * Math.PI / 180;
        if (d * Math.cos(ang) > 0) it.pass = Math.round(Math.abs(d * Math.sin(ang)) * 10) / 10;
      }
      out.push(it);
    }
    return out.sort((a, b) => (a.impact - b.impact) || (a.km - b.km));
  }
  function icon(o) {
    if (o.impact) return L.divIcon({ className: '', html: '<div class="zimp">💥</div>', iconSize: [20, 20], iconAnchor: [10, 10] });
    const arrow = o.heading != null ? '<div class="a" style="transform:rotate(' + o.heading + 'deg)"></div>' : '';
    return L.divIcon({ className: '', iconSize: [30, 30], iconAnchor: [15, 15],
      html: '<div class="zt' + (o.area ? ' area' : '') + (o.pass != null && o.pass <= 6 ? ' toward' : '') + '">' + arrow + '<div class="c" style="background:' + (COL[o.kind] || COL.unknown) + '"></div></div>' });
  }
  function text(o) {
    if (o.impact) return '💥 Прильот: ' + e(o.label) + ' · ' + o.km + ' км';
    return '<b>' + e(KINDS[o.kind] || 'Ціль') + (o.no ? ' №' + o.no : '') + '</b><br>' + e(o.label || '') +
      (o.area ? '<br><i>точне місце не названо (лише область)</i>' : '<br>~' + o.km + ' км від вас') +
      (o.pass != null ? '<br>курс пройде за ~' + o.pass + ' км від вас' : '') + '<br>позиція ' + (o.age ? o.age + ' хв тому' : 'щойно');
  }
  function update(st, p, force) {
    if (!st || !st.ok || !p) return;
    const key = (st.ts || st.now) + '|' + p.lat.toFixed(4) + ',' + p.lon.toFixed(4);
    if (!force && key === lastKey) return;
    lastKey = key;
    const list = objects(st, p), inZone = list.filter(o => !o.impact && o.km <= ZONE_KM).length;
    if (!init()) document.getElementById('zUpd').textContent = 'Карта не завантажилась у цьому браузері — список цілей нижче.';
    else {
      layer.clearLayers();
      const me = [p.lat, p.lon];
      L.circle(me, { radius: ZONE_KM * 1000, color: '#38bdf8', weight: 1.5, fillOpacity: .06, dashArray: '6 6' }).addTo(layer);
      L.circle(me, { radius: 5000, color: '#ec4899', weight: 1.5, fillOpacity: .08 }).addTo(layer);
      L.marker(me, { icon: L.divIcon({ className: '', html: '<div class="zme"></div>', iconSize: [16, 16], iconAnchor: [8, 8] }), zIndexOffset: 1000 }).bindPopup(e(p.name || 'Ваша точка')).addTo(layer);
      for (const o of list) L.marker([o.lat, o.lon], { icon: icon(o) }).bindPopup(text(o)).addTo(layer);
      const far = list.filter(o => !o.impact && !o.area).reduce((m, o) => Math.max(m, o.km), 0);
      const bb = L.latLng(me).toBounds(Math.max(ZONE_KM + 3, Math.min(VIEW_KM, far + 5)) * 2000);
      map.fitBounds(bb, { animate: false });
      setTimeout(() => { map.invalidateSize(); map.fitBounds(bb, { animate: false }); }, 120);   // розмір блоку відомий лише після показу
    }
    document.getElementById('zInfo').textContent = inZone ? '· ' + inZone + ' у зоні ' + ZONE_KM + ' км' : '· у зоні ' + ZONE_KM + ' км чисто';
    const ageSec = Math.max(0, Date.now() / 1000 - (st.ts || st.now));
    document.getElementById('zUpd').textContent = (map ? '' : '⚠ Карта не завантажилась у цьому браузері — список цілей нижче. ') + 'Дані: ' + (ageSec < 90 ? 'щойно' : Math.round(ageSec / 60) + ' хв тому') + (st._live ? ' (живі, раз на хвилину)' : ' (з сайту, ~раз на 10 хв)') +
      ' · показано ' + VIEW_KM + ' км навколо · за постами відкритих каналів, не офіційне повідомлення';
    const rows = list.filter(o => !o.impact).slice(0, 6);
    document.getElementById('zList').innerHTML = rows.length ? rows.map(o => '<li><span>' + e(KINDS[o.kind] || 'Ціль') + (o.no ? ' №' + o.no : '') +
      (o.area ? ' <small>(область)</small>' : '') + ' <small>· ' + (o.age ? o.age + ' хв тому' : 'щойно') + '</small></span><b>' + (o.area ? '' : o.km + ' км') + '</b></li>').join('')
      : '<li class="empty">Повітряних цілей у радіусі ' + VIEW_KM + ' км немає</li>';
  }
  window.saZoneUpdate = update;
})();
