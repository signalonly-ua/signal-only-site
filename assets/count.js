/* Лічильник відвідувань Signal Only (28.11.2026, власник: «Лічильник вмикай»).
   Лише числа: скільки переглядів за день, скільки відвідувачів, звідки прийшли (YouTube, TikTok, Instagram, Telegram, Google, інше).
   Без cookies і без персональних даних; у браузері зберігається лише дата останнього візиту (щоб людину рахувати раз на день).
   Сервіс підрахунку: abacus.jasoncameron.dev (безкоштовний, без реєстрації). Хто вмикає «Do Not Track» — не рахуємо. Див. privacy.html. */
(function () {
  try {
    if (navigator.doNotTrack === '1' || window.doNotTrack === '1' || !window.fetch) return;
    if (!/github\.io$/.test(location.hostname)) return;                 // локальні перегляди й копії сайту не рахуємо
    var NS = 'https://abacus.jasoncameron.dev/hit/signalonly-site/';
    var day;
    try { day = new Date().toLocaleDateString('sv-SE', {timeZone: 'Europe/Kyiv'}); } catch (e) { day = new Date().toISOString().slice(0, 10); }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) day = new Date().toISOString().slice(0, 10);
    var page = location.pathname.replace(/^\/signal-only-site\//, '').replace(/^\//, '');
    if (!page || /\/$/.test(page)) page += 'index.html';
    page = page.replace(/[^A-Za-z0-9_.-]/g, '_').slice(-60);
    var hit = function (key) { try { fetch(NS + key, {mode: 'cors', keepalive: true}).catch(function () {}); } catch (e) {} };
    hit('v-' + day);                                                     // перегляди сторінок за день
    hit('p-' + page);                                                    // перегляди цієї сторінки (усього)
    var first = true;
    try { first = localStorage.getItem('so_seen') !== day; if (first) localStorage.setItem('so_seen', day); } catch (e) {}
    if (!first) return;
    hit('u-' + day);                                                     // відвідувачі за день (раз на браузер)
    var host = '';
    try { host = document.referrer ? new URL(document.referrer).hostname : ''; } catch (e) {}
    var src = !host ? 'direct' : /youtube\.|youtu\.be/.test(host) ? 'youtube' : /tiktok\./.test(host) ? 'tiktok'
      : /instagram\./.test(host) ? 'instagram' : /(^|\.)t\.me$|telegram\./.test(host) ? 'telegram' : /google\./.test(host) ? 'google'
      : host === location.hostname ? 'internal' : 'other';
    hit('s-' + src + '-' + day);                                          // звідки прийшов (раз на день)
  } catch (e) {}
})();
