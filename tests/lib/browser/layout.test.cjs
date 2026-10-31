// tests/lib/browser/layout.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./layout.cjs');
const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });
const snap = (elements, over = {}) => ({
  viewport: { width: 390, height: 844, scrollWidth: 390, scrollHeight: 844, ...over },
  dpr: 3, safeArea: { top: 47, right: 0, bottom: 34, left: 0 }, elements
});

test('noOverflow 在存在横向滚动时报告', () => {
  assert.deepEqual(L.noOverflow(snap([])), []);
  assert.equal(L.noOverflow(snap([], { scrollWidth: 402 })).length, 1);
});

test('noOverlap 只报真正相交的元素对，忽略白名单与父子', () => {
  const s = snap([
    { selector: '.home-tools', rect: rect(0, 700, 390, 60) },
    { selector: '.tabbar', rect: rect(0, 740, 390, 54) },          // 与工具栏相交 20px
    { selector: '.map', rect: rect(0, 100, 390, 640) },
    { selector: '.overlay-scrim', rect: rect(0, 0, 390, 844) }     // 白名单：遮罩允许覆盖
  ]);
  const fails = L.noOverlap(s, { whitelist: [['.map', '.overlay-scrim'], ['.home-tools', '.overlay-scrim'], ['.tabbar', '.overlay-scrim']] });
  assert.deepEqual(fails.map(f => [f.a, f.b]), [['.home-tools', '.tabbar']]);
});

test('aspectPreserved 用 naturalSize 比对，容差 2%', () => {
  const good = snap([{ selector: 'img.house', rect: rect(0, 0, 120, 80), naturalWidth: 120, naturalHeight: 80 }]);
  const bad = snap([{ selector: 'img.house', rect: rect(0, 0, 90, 80), naturalWidth: 120, naturalHeight: 80 }]);
  assert.deepEqual(L.aspectPreserved(good), []);
  assert.equal(L.aspectPreserved(bad).length, 1);
});

test('artAspectFailures 覆盖 svg-viewbox 与 svg-image，变形用例单独报红', () => {
  const elements = [
    { selector: '.ui-icon[0]', kind: 'svg-viewbox', rect: rect(0, 0, 120, 80), naturalWidth: 300, naturalHeight: 200 },
    { selector: '.home-map image[0]', kind: 'svg-image', rect: rect(0, 100, 90, 60), naturalWidth: 120, naturalHeight: 80 },
    { selector: '.ui-icon[1]', kind: 'svg-viewbox', rect: rect(0, 200, 90, 80), naturalWidth: 300, naturalHeight: 200 },
  ];
  const failures = L.artAspectFailures(elements);
  assert.deepEqual(failures.map(f => f.selector), ['.ui-icon[1]']);
  assert.equal(failures[0].kind, 'svg-viewbox');
  assert.deepEqual(L.artAspectFailures(elements, { tolerance: 0.3 }), []);
});

test('hitTargets 拦截小于阈值与零面积的触摸目标', () => {
  const s = snap([
    { selector: '.btn-ok', rect: rect(0, 0, 44, 44) },
    { selector: '.btn-tiny', rect: rect(0, 60, 28, 28) },
    { selector: '.btn-zero', rect: rect(0, 120, 0, 0) }
  ]);
  assert.deepEqual(L.hitTargets(s, { min: 40 }).map(f => f.selector), ['.btn-tiny', '.btn-zero']);
});

test('safeAreaFailures 拦截进入刘海与 Home 条区域的控件', () => {
  const s = snap([
    { selector: '.topbar', rect: rect(0, 40, 390, 60) },     // top 40 < 47
    { selector: '.tabbar', rect: rect(0, 790, 390, 54) }     // bottom 844 > 810
  ]);
  assert.deepEqual(L.safeAreaFailures(s).map(f => f.selector).sort(), ['.tabbar', '.topbar']);
});

test('occlusionFailures 用中心命中判断可点性', () => {
  const s = snap([{ selector: '.collect', rect: rect(100, 500, 60, 40), hitSelector: '.overlay-scrim' }]);
  assert.deepEqual(L.occlusionFailures(s).map(f => f.selector), ['.collect']);
});
