// localStorage 互換の storage を受け取る。壊れた値・書き込み失敗でも例外を出さない。
import { DEFAULT_SLOTS } from './forecast.js';

export const DEFAULT_SETTINGS = {
  place: { name: '東京', lat: 35.6895, lon: 139.6917 },
  sensitivity: 'hot',
  slots: DEFAULT_SLOTS,
};

const SETTINGS_KEY = 'wo.settings';
const CACHE_KEY = 'wo.cache';
const SENSITIVITIES = ['cold', 'normal', 'hot'];

function readJson(storage, key) {
  try {
    const raw = storage.getItem(key);
    return raw == null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeJson(storage, key, value) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    /* 保存できなくても動き続ける */
  }
}

function validSlot(v) {
  return Array.isArray(v) && v.length === 2 && Number.isInteger(v[0]) && Number.isInteger(v[1])
    && v[0] >= 0 && v[1] <= 23 && v[0] < v[1];
}

function validPlace(p) {
  return p && typeof p.name === 'string' && Number.isFinite(p.lat) && Number.isFinite(p.lon);
}

function normalize(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const slots = {};
  for (const label of Object.keys(DEFAULT_SLOTS)) {
    slots[label] = validSlot(s.slots?.[label]) ? s.slots[label] : [...DEFAULT_SLOTS[label]];
  }
  return {
    place: validPlace(s.place) ? s.place : { ...DEFAULT_SETTINGS.place },
    sensitivity: SENSITIVITIES.includes(s.sensitivity) ? s.sensitivity : DEFAULT_SETTINGS.sensitivity,
    slots,
  };
}

export function loadSettings(storage) {
  return normalize(readJson(storage, SETTINGS_KEY));
}

export function saveSettings(storage, settings) {
  const clean = normalize(settings);
  writeJson(storage, SETTINGS_KEY, clean);
  return clean;
}

export function loadCache(storage) {
  const c = readJson(storage, CACHE_KEY);
  if (!c || !Array.isArray(c.days) || typeof c.savedAt !== 'string' || !validPlace(c.place)) return null;
  return c;
}

export function saveCache(storage, days, place, now = new Date()) {
  writeJson(storage, CACHE_KEY, { days, place, savedAt: now.toISOString() });
}
