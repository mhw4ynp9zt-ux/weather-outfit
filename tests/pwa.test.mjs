import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { readdirSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const exists = (p) => existsSync(new URL(`../${p}`, import.meta.url));

test('manifest: 必須項目とアイコン', () => {
  const m = JSON.parse(read('manifest.webmanifest'));
  for (const k of ['name', 'short_name', 'start_url', 'theme_color', 'background_color']) assert.ok(m[k], k);
  assert.equal(m.display, 'standalone');
  const sizes = m.icons.map((i) => i.sizes);
  assert.ok(sizes.includes('192x192') && sizes.includes('512x512'));
  for (const i of m.icons) { assert.equal(i.type, 'image/png'); assert.ok(exists(i.src.replace(/^\.?\//, '')), i.src); }
});

test('index.html: manifest と apple-touch-icon', () => {
  const html = read('index.html');
  assert.ok(html.includes('rel="manifest"'));
  assert.ok(html.includes('rel="apple-touch-icon"'));
});

test('sw.js: SHELLの全パスが実在し主要ファイルを含む', () => {
  const sw = read('sw.js');
  const body = sw.match(/const SHELL = \[([\s\S]*?)\];/)[1];
  const paths = [...body.matchAll(/'([^']+)'/g)].map((x) => x[1]);
  assert.ok(paths.length > 0);
  for (const p of paths) {
    const file = p === './' ? 'index.html' : p.replace(/^\.\//, '');
    assert.ok(exists(file), p);
  }
  const need = ['./index.html', './app.js', './style.css', ...readdirSync(new URL('../lib', import.meta.url)).map((f) => `./lib/${f}`)];
  for (const n of need) assert.ok(paths.includes(n), `missing ${n}`);
});
