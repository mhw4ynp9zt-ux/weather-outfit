// 体感温度 → 段階(0〜5) → 服装。副作用なしの純関数。

const THRESHOLDS = [5, 10, 15, 20, 25]; // 未満で段階0〜4、以上で5
const SHIFT = { cold: -1, normal: 0, hot: 1 };

const BAND_ITEMS = [
  [{ icon: '🧥', text: '厚手のダウンコート' }, { icon: '🧶', text: '厚手ニット+保温インナー' }],
  [{ icon: '🧥', text: '冬用コート' }, { icon: '🧶', text: 'ニット' }],
  [{ icon: '🧥', text: '薄手のコート' }, { icon: '🧶', text: '薄手ニット' }],
  [{ icon: '🧥', text: '軽い羽織り(カーディガン等)' }, { icon: '👕', text: '長袖' }],
  [{ icon: '👔', text: '薄手の長袖シャツ' }],
  [{ icon: '👕', text: '半袖' }],
];

const BAND_LABEL = ['極寒', '寒い', '肌寒い', '涼しい', '快適', '暑い'];

export function bandFor(feelsLikeC, sensitivity) {
  let band = THRESHOLDS.findIndex((t) => feelsLikeC < t);
  if (band === -1) band = 5;
  band += SHIFT[sensitivity] ?? 0;
  return Math.max(0, Math.min(5, band));
}

export function suggest(slot, sensitivity) {
  if (slot.feelsLikeC == null) return { items: [], reason: 'データなし' };
  const band = bandFor(slot.feelsLikeC, sensitivity);
  const items = [...BAND_ITEMS[band]];
  const notes = [];
  if (slot.precipProb != null && slot.precipProb >= 50) {
    items.push({ icon: '☂', text: '傘' });
    notes.push(`降水確率${Math.round(slot.precipProb)}%`);
  }
  if (slot.windMs != null && slot.windMs >= 8) {
    items.push({ icon: '💨', text: '風よけ(ウインドブレーカー等)' });
    notes.push(`風${Math.round(slot.windMs)}m/s`);
  }
  if (slot.uv != null && slot.uv >= 6) {
    items.push({ icon: '🧢', text: '帽子・日焼け止め' });
    notes.push(`UV${Math.round(slot.uv)}`);
  }
  const base = `体感${Math.round(slot.feelsLikeC)}℃で${BAND_LABEL[band]}`;
  return { items, reason: notes.length ? `${base}、${notes.join('・')}` : base };
}

export function summarize(slots, sensitivity) {
  const valid = slots.filter((s) => s.feelsLikeC != null);
  if (valid.length === 0) return 'データなし';
  const bands = valid.map((s) => bandFor(s.feelsLikeC, sensitivity));
  const lo = Math.min(...bands);
  const hi = Math.max(...bands);
  const extras = [];
  if (valid.some((s) => s.precipProb != null && s.precipProb >= 50)) extras.push('傘');
  if (valid.some((s) => s.windMs != null && s.windMs >= 8)) extras.push('風よけ');
  if (valid.some((s) => s.uv != null && s.uv >= 6)) extras.push('帽子');
  const tail = extras.length ? `+${extras.join('・')}` : '';
  if (hi - lo >= 2) {
    const outer = BAND_ITEMS[lo][0].text;
    return `寒暖差が大きいので、脱ぎ着しやすい${outer}${tail}`;
  }
  const mid = bands[Math.floor(bands.length / 2)];
  return `一日を通して${BAND_ITEMS[mid].map((i) => i.text).join('+')}${tail}`;
}
