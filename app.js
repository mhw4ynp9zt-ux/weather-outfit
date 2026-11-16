// DOM接続のみ。ロジックは lib/ に置く。
import { fetchForecast, geocode } from './lib/forecast.js';
import { loadSettings, saveSettings, loadCache, saveCache } from './lib/store.js';
import { renderTabs, renderDay, renderBanner, esc } from './lib/render.js';

const $ = (id) => document.getElementById(id);
let settings = loadSettings(localStorage);
let days = [];
let selected = 0;
let banner = '';

function draw() {
  $('place-name').textContent = settings.place.name;
  $('banner').innerHTML = banner;
  if (!days.length) return;
  $('tabs').innerHTML = renderTabs(days, selected);
  $('day').innerHTML = renderDay(days[selected], settings.sensitivity);
}

async function refresh() {
  $('day').textContent = '読み込み中…';
  try {
    days = await fetchForecast(settings.place.lat, settings.place.lon, fetch, settings.slots);
    saveCache(localStorage, days, settings.place);
    banner = renderBanner('none');
    selected = 0;
  } catch {
    const cache = loadCache(localStorage);
    if (cache) {
      days = cache.days;
      banner = renderBanner('cached', cache.savedAt);
      selected = Math.min(selected, days.length - 1);
    } else {
      days = [];
      banner = renderBanner('error', '予報を取得できませんでした。通信状況を確認してください。');
      $('day').textContent = '';
    }
  }
  draw();
}

$('tabs').addEventListener('click', (e) => {
  const tab = e.target.closest('.tab');
  if (!tab) return;
  selected = Number(tab.dataset.index);
  draw();
});

// --- 設定ダイアログ ---
let pendingPlace = null;

function fillSettings() {
  pendingPlace = null;
  $('city-results').innerHTML = '';
  $('place-message').textContent = '';
  $('slot-message').textContent = '';
  $('city-input').value = '';
  document.querySelector(`input[name="sens"][value="${settings.sensitivity}"]`).checked = true;
  $('slot-inputs').innerHTML = Object.entries(settings.slots).map(([label, [s, e]]) =>
    `<label>${esc(label)} <input type="number" min="0" max="23" data-slot="${esc(label)}" data-pos="0" value="${s}">〜`
    + `<input type="number" min="0" max="23" data-slot="${esc(label)}" data-pos="1" value="${e}"></label>`).join('');
}

$('open-settings').addEventListener('click', () => { fillSettings(); $('settings').showModal(); });

$('city-search').addEventListener('click', async () => {
  const name = $('city-input').value.trim();
  if (!name) return;
  $('place-message').textContent = '検索中…';
  try {
    const found = await geocode(name);
    $('place-message').textContent = found.length ? '' : '見つかりませんでした';
    $('city-results').innerHTML = found.map((p, i) =>
      `<li><button type="button" data-i="${i}">${esc(p.name)}</button></li>`).join('');
    $('city-results').onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      pendingPlace = found[Number(b.dataset.i)];
      $('place-message').textContent = `${pendingPlace.name} を選択中(保存で反映)`;
    };
  } catch {
    $('place-message').textContent = '検索に失敗しました。通信状況を確認してください';
  }
});

$('use-location').addEventListener('click', () => {
  if (!navigator.geolocation) { $('place-message').textContent = '現在地を使えません'; return; }
  $('place-message').textContent = '取得中…';
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      pendingPlace = { name: '現在地', lat: pos.coords.latitude, lon: pos.coords.longitude };
      $('place-message').textContent = '現在地を選択中(保存で反映)';
    },
    () => { $('place-message').textContent = '現在地を取得できませんでした(許可を確認してください)'; },
    { timeout: 10000 },
  );
});

$('settings-form').addEventListener('submit', (e) => {
  if (e.submitter?.value !== 'ok') return;
  const slots = {};
  document.querySelectorAll('#slot-inputs input').forEach((inp) => {
    (slots[inp.dataset.slot] ??= [0, 0])[Number(inp.dataset.pos)] = Number(inp.value);
  });
  settings = saveSettings(localStorage, {
    place: pendingPlace ?? settings.place,
    sensitivity: document.querySelector('input[name="sens"]:checked').value,
    slots,
  });
  refresh();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

refresh();
