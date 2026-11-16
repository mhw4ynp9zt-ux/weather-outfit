import test from 'node:test';
import assert from 'node:assert/strict';
import { bandFor, suggest, summarize } from '../lib/outfit.js';

const slot = (o = {}) => ({
  label: '朝', tempC: 10, feelsLikeC: 10, precipProb: 0, windMs: 2, uv: 0, isPast: false, ...o,
});

test('bandFor: normal thresholds', () => {
  assert.equal(bandFor(4.9, 'normal'), 0);
  assert.equal(bandFor(5, 'normal'), 1);
  assert.equal(bandFor(10, 'normal'), 2);
  assert.equal(bandFor(15, 'normal'), 3);
  assert.equal(bandFor(20, 'normal'), 4);
  assert.equal(bandFor(25, 'normal'), 5);
});

test('bandFor: sensitivity shifts and clamps', () => {
  assert.equal(bandFor(12, 'hot'), 3);
  assert.equal(bandFor(12, 'cold'), 1);
  assert.equal(bandFor(2, 'cold'), 0);
  assert.equal(bandFor(30, 'hot'), 5);
});

test('suggest: umbrella depends on precipProb', () => {
  const has = (s) => suggest(s, 'normal').items.some((i) => i.text.includes('傘'));
  assert.equal(has(slot({ precipProb: 60 })), true);
  assert.equal(has(slot({ precipProb: 20 })), false);
});

test('suggest: wind and uv accessories', () => {
  assert.ok(suggest(slot({ windMs: 9 }), 'normal').items.some((i) => i.text.includes('風よけ')));
  assert.ok(suggest(slot({ uv: 7 }), 'normal').items.some((i) => i.text.includes('帽子')));
});

test('suggest: missing feelsLike gives empty items', () => {
  const r = suggest(slot({ feelsLikeC: null }), 'normal');
  assert.deepEqual(r.items, []);
  assert.equal(r.reason, 'データなし');
});

test('suggest: null precip/wind/uv do not break or add accessories', () => {
  const r = suggest(slot({ precipProb: null, windMs: null, uv: null }), 'normal');
  assert.ok(r.items.length > 0);
  assert.equal(r.items.some((i) => /傘|風よけ|帽子/.test(i.text)), false);
});

test('summarize: layering when band spread >= 2', () => {
  const slots = [
    slot({ label: '朝', feelsLikeC: 8 }),
    slot({ label: '昼', feelsLikeC: 17 }),
    slot({ label: '夜', feelsLikeC: 10 }),
  ];
  assert.ok(summarize(slots, 'normal').includes('脱ぎ着'));
});

test('summarize: no layering when same band', () => {
  const slots = [
    slot({ label: '朝', feelsLikeC: 11 }),
    slot({ label: '昼', feelsLikeC: 13 }),
    slot({ label: '夜', feelsLikeC: 12 }),
  ];
  assert.equal(summarize(slots, 'normal').includes('脱ぎ着'), false);
});
