import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDays, fetchForecast, geocode, DEFAULT_SLOTS } from '../lib/forecast.js';

// 2日分(各日0〜23時)のOpen-Meteo形式フィクスチャ
function makeApi(overrides = {}) {
  const time = [];
  const mk = (fn) => [];
  const h = { temperature_2m: [], apparent_temperature: [], precipitation_probability: [], wind_speed_10m: [], uv_index: [] };
  for (const d of ['2026-11-17', '2026-11-18']) {
    for (let hr = 0; hr < 24; hr++) {
      time.push(`${d}T${String(hr).padStart(2, '0')}:00`);
      h.temperature_2m.push(hr); // 気温=時刻
      h.apparent_temperature.push(hr - 2);
      h.precipitation_probability.push(hr * 2);
      h.wind_speed_10m.push(3);
      h.uv_index.push(hr === 12 ? 6 : 0);
    }
  }
  return {
    hourly: { time, ...h, ...overrides.hourly },
    daily: {
      time: ['2026-11-17', '2026-11-18'],
      weather_code: [0, 61],
      temperature_2m_max: [17, 14],
      temperature_2m_min: [8, 9],
    },
  };
}

test('buildDays: 朝は7,8,9時の平均', () => {
  const days = buildDays(makeApi(), DEFAULT_SLOTS, new Date('2026-11-16T00:00:00'));
  assert.equal(days[0].slots[0].tempC, 8);
  assert.equal(days[0].slots[0].feelsLikeC, 6);
});

test('buildDays: ラベル順と日次値', () => {
  const days = buildDays(makeApi(), DEFAULT_SLOTS, new Date('2026-11-16T00:00:00'));
  assert.deepEqual(days[0].slots.map((s) => s.label), ['朝', '昼', '夜']);
  assert.equal(days[0].tMin, 8);
  assert.equal(days[0].tMax, 17);
  assert.equal(days[1].weatherCode, 61);
  assert.equal(days[0].date, '2026-11-17');
});

test('buildDays: nullを除いて平均、全部nullならnull', () => {
  const api = makeApi();
  api.hourly.precipitation_probability[7] = null; // 朝7時だけnull
  for (const i of [12, 13, 14, 15]) api.hourly.precipitation_probability[i] = null; // 昼は全null
  const days = buildDays(api, DEFAULT_SLOTS, new Date('2026-11-16T00:00:00'));
  assert.equal(days[0].slots[0].precipProb, (8 * 2 + 9 * 2) / 2);
  assert.equal(days[0].slots[1].precipProb, null);
});

test('buildDays: isPast', () => {
  const days = buildDays(makeApi(), DEFAULT_SLOTS, new Date('2026-11-17T10:00:00'));
  assert.equal(days[0].slots[0].isPast, true);
  assert.equal(days[0].slots[2].isPast, false);
  assert.equal(days[1].slots[0].isPast, false);
});

test('fetchForecast: URLパラメータとエラー', async () => {
  let url;
  const ok = async (u) => { url = u; return { ok: true, json: async () => makeApi() }; };
  const days = await fetchForecast(35.6, 139.7, ok);
  assert.equal(days.length, 2);
  assert.ok(url.includes('forecast_days=7'));
  assert.ok(url.includes('timezone=auto'));
  assert.ok(url.includes('wind_speed_unit=ms'));
  await assert.rejects(fetchForecast(0, 0, async () => ({ ok: false, status: 500 })));
});

test('geocode: 0件は[]、あれば変換', async () => {
  assert.deepEqual(await geocode('zzz', async () => ({ ok: true, json: async () => ({}) })), []);
  const r = await geocode('大阪', async () => ({
    ok: true,
    json: async () => ({ results: [{ name: '大阪市', latitude: 34.69, longitude: 135.5, admin1: '大阪府' }] }),
  }));
  assert.deepEqual(r, [{ name: '大阪市', lat: 34.69, lon: 135.5 }]);
  await assert.rejects(geocode('x', async () => ({ ok: false, status: 500 })));
});
