// データ → HTML文字列の純関数。ユーザー入力由来の文字列は必ずエスケープする。
import { suggest, summarize } from './outfit.js';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function weatherIcon(code) {
  if (code === 0) return '☀';
  if (code <= 2) return '🌤';
  if (code === 3) return '☁';
  if (code === 45 || code === 48) return '🌫';
  if (code >= 51 && code <= 67) return '☂';
  if (code >= 71 && code <= 77) return '❄';
  if (code >= 80 && code <= 82) return '☂';
  if (code >= 85 && code <= 86) return '❄';
  if (code >= 95) return '⛈';
  return '🌡';
}

function dateParts(date) {
  const [y, m, d] = date.split('-').map(Number);
  return { md: `${m}/${d}`, wd: WEEKDAYS[new Date(y, m - 1, d).getDay()] };
}

const fmt = (v) => (v == null ? '−' : String(Math.round(v)));

export function renderTabs(days, selectedIndex) {
  return days.map((d, i) => {
    const { md, wd } = dateParts(d.date);
    const sel = i === selectedIndex;
    return `<button class="tab" role="tab" data-index="${i}" aria-selected="${sel}">`
      + `<span class="tab-day">${wd}</span><span class="tab-md">${md}</span>`
      + `<span class="tab-icon">${weatherIcon(d.weatherCode)}</span>`
      + `<span class="tab-temp">${fmt(d.tMin)}〜${fmt(d.tMax)}℃</span></button>`;
  }).join('');
}

function renderSlot(slot, sensitivity) {
  const { items, reason } = suggest(slot, sensitivity);
  const cls = slot.isPast ? 'slot past' : 'slot';
  const list = items.length
    ? `<ul class="items">${items.map((i) => `<li>${i.icon} ${esc(i.text)}</li>`).join('')}</ul>`
    : '';
  return `<section class="${cls}"><h3>${esc(slot.label)}</h3>`
    + `<p class="metrics">${fmt(slot.tempC)}℃(体感${fmt(slot.feelsLikeC)}℃) 降水${fmt(slot.precipProb)}% 風${fmt(slot.windMs)}m/s</p>`
    + `${list}<p class="reason">${esc(reason)}</p></section>`;
}

export function renderDay(day, sensitivity) {
  const { md, wd } = dateParts(day.date);
  return `<h2>${md}(${wd}) ${weatherIcon(day.weatherCode)} ${fmt(day.tMin)}〜${fmt(day.tMax)}℃</h2>`
    + day.slots.map((s) => renderSlot(s, sensitivity)).join('')
    + `<p class="summary">👉 ${esc(summarize(day.slots, sensitivity))}</p>`;
}

export function renderBanner(kind, info = '') {
  if (kind === 'cached') {
    const when = info ? new Date(info).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
    return `<div class="banner cached">保存した予報です${when ? `(${esc(when)}時点)` : ''}</div>`;
  }
  if (kind === 'error') return `<div class="banner error">${esc(info || '予報を取得できませんでした')}</div>`;
  return '';
}
