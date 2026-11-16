// Open-Meteo の応答を Day[] に整形する。取得関数は fetch を差し替え可能。

export const DEFAULT_SLOTS = { 朝: [7, 9], 昼: [12, 15], 夜: [18, 22] };

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';

function avg(values) {
  const v = values.filter((x) => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

export function buildDays(api, slotsConfig = DEFAULT_SLOTS, now = new Date()) {
  const { hourly, daily } = api;
  return daily.time.map((date, di) => {
    const idx = [];
    hourly.time.forEach((t, i) => {
      if (t.startsWith(date)) idx.push({ i, hour: Number(t.slice(11, 13)) });
    });
    const slots = Object.entries(slotsConfig).map(([label, [start, end]]) => {
      const rows = idx.filter((r) => r.hour >= start && r.hour <= end).map((r) => r.i);
      const pick = (key) => avg(rows.map((i) => hourly[key]?.[i] ?? null));
      const endAt = new Date(`${date}T${String(end).padStart(2, '0')}:59:59`);
      return {
        label,
        tempC: pick('temperature_2m'),
        feelsLikeC: pick('apparent_temperature'),
        precipProb: pick('precipitation_probability'),
        windMs: pick('wind_speed_10m'),
        uv: pick('uv_index'),
        isPast: endAt < now,
      };
    });
    return {
      date,
      weatherCode: daily.weather_code[di],
      tMin: daily.temperature_2m_min[di],
      tMax: daily.temperature_2m_max[di],
      slots,
    };
  });
}

export async function fetchForecast(lat, lon, fetchFn = fetch, slotsConfig = DEFAULT_SLOTS) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly: 'temperature_2m,apparent_temperature,precipitation_probability,wind_speed_10m,uv_index',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min',
    timezone: 'auto',
    forecast_days: '7',
    wind_speed_unit: 'ms',
  });
  const res = await fetchFn(`${FORECAST_URL}?${params}`);
  if (!res.ok) throw new Error(`forecast failed: ${res.status}`);
  return buildDays(await res.json(), slotsConfig);
}

export async function geocode(name, fetchFn = fetch) {
  const params = new URLSearchParams({ name, count: '5', language: 'ja' });
  const res = await fetchFn(`${GEOCODE_URL}?${params}`);
  if (!res.ok) throw new Error(`geocode failed: ${res.status}`);
  const data = await res.json();
  return (data.results ?? []).map((r) => ({ name: r.name, lat: r.latitude, lon: r.longitude }));
}
