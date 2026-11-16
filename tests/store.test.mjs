import test from 'node:test';
import assert from 'node:assert/strict';
import { safeStorage, DEFAULT_SETTINGS, loadSettings, saveSettings, loadCache, saveCache } from '../lib/store.js';

function memStorage(initial = {}) {
  const m = new Map(Object.entries(initial));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
}
const throwing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };

test('loadSettings: 空なら既定値', () => {
  assert.deepEqual(loadSettings(memStorage()), DEFAULT_SETTINGS);
});

test('loadSettings: 壊れたJSONでも既定値', () => {
  assert.deepEqual(loadSettings(memStorage({ 'wo.settings': '{oops' })), DEFAULT_SETTINGS);
});

test('saveSettings→loadSettings で往復、不正なsensitivityはhotに補正', () => {
  const st = memStorage();
  const s = { ...DEFAULT_SETTINGS, sensitivity: 'cold', place: { name: '大阪', lat: 34.69, lon: 135.5 } };
  saveSettings(st, s);
  assert.deepEqual(loadSettings(st), s);
  const r = saveSettings(st, { ...s, sensitivity: 'xxx' });
  assert.equal(r.sensitivity, 'hot');
});

test('saveSettings: 開始>=終了の時間帯は既定値に戻る', () => {
  const r = saveSettings(memStorage(), { ...DEFAULT_SETTINGS, slots: { ...DEFAULT_SETTINGS.slots, 朝: [9, 7] } });
  assert.deepEqual(r.slots['朝'], [7, 9]);
});

test('storageが例外を投げても落ちない', () => {
  assert.doesNotThrow(() => saveSettings(throwing, DEFAULT_SETTINGS));
  assert.doesNotThrow(() => saveCache(throwing, [], DEFAULT_SETTINGS.place));
  assert.deepEqual(loadSettings(throwing), DEFAULT_SETTINGS);
  assert.equal(loadCache(throwing), null);
});

test('saveCache→loadCache、未保存はnull', () => {
  const st = memStorage();
  assert.equal(loadCache(st), null);
  const days = [{ date: '2026-11-17', weatherCode: 0, tMin: 8, tMax: 17, slots: [] }];
  saveCache(st, days, DEFAULT_SETTINGS.place, new Date('2026-11-16T09:00:00Z'));
  const c = loadCache(st);
  assert.deepEqual(c.days, days);
  assert.deepEqual(c.place, DEFAULT_SETTINGS.place);
  assert.equal(c.savedAt, '2026-11-16T09:00:00.000Z');
});

test('safeStorage: localStorageへのアクセス自体が例外でも動くメモリ代替を返す', () => {
  const win = { get localStorage() { throw new Error('SecurityError'); } };
  const st = safeStorage(win);
  st.setItem('a', '1');
  assert.equal(st.getItem('a'), '1');
  assert.equal(st.getItem('zzz'), null);
  const ok = { localStorage: memStorage() };
  assert.equal(safeStorage(ok), ok.localStorage);
});
