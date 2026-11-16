import test from 'node:test';
import assert from 'node:assert/strict';
import { renderTabs, renderDay, renderBanner, weatherIcon } from '../lib/render.js';

const slot = (o = {}) => ({
  label: '朝', tempC: 9, feelsLikeC: 8, precipProb: 10, windMs: 2, uv: 0, isPast: false, ...o,
});
const day = (i, o = {}) => ({
  date: `2026-11-${String(17 + i).padStart(2, '0')}`,
  weatherCode: 0, tMin: 8, tMax: 17,
  slots: [slot({ label: '朝' }), slot({ label: '昼', feelsLikeC: 17 }), slot({ label: '夜', feelsLikeC: 10 })],
  ...o,
});
const week = Array.from({ length: 7 }, (_, i) => day(i));

test('renderTabs: 7タブ、選択中だけaria-selected、気温幅とアイコン', () => {
  const html = renderTabs(week, 2);
  for (let i = 0; i < 7; i++) assert.ok(html.includes(`data-index="${i}"`));
  assert.equal(html.match(/aria-selected="true"/g).length, 1);
  assert.ok(html.includes('8〜17℃'));
  assert.ok(html.includes(weatherIcon(0)));
});

test('renderDay: 朝昼夜とまとめ、過去と欠測の表示', () => {
  const d = day(0, {
    slots: [
      slot({ label: '朝', isPast: true }),
      slot({ label: '昼', feelsLikeC: null, tempC: null }),
      slot({ label: '夜' }),
    ],
  });
  const html = renderDay(d, 'hot');
  for (const l of ['朝', '昼', '夜']) assert.ok(html.includes(l));
  assert.ok(html.includes('class="slot past"'));
  assert.ok(html.includes('データなし'));
  assert.ok(html.includes('−'));
});

test('renderDay: 日付の曜日表記', () => {
  assert.ok(renderDay(day(0), 'hot').includes('11/17'));
});

test('renderBanner', () => {
  assert.ok(renderBanner('cached', '2026-11-16T09:00:00.000Z').includes('保存した予報です'));
  assert.equal(renderBanner('none'), '');
  assert.ok(renderBanner('error', '通信に失敗しました').includes('通信に失敗しました'));
});

test('renderBanner: 情報文字列はHTMLエスケープ', () => {
  assert.ok(!renderBanner('error', '<script>x</script>').includes('<script>'));
});

test('weatherIcon', () => {
  assert.equal(weatherIcon(0), '☀');
  assert.equal(weatherIcon(61), '☂');
  assert.ok(weatherIcon(9999).length > 0);
});
