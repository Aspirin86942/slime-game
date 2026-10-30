// tests/lib/browser/profiles.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('./profiles.cjs');
const zero = { top: 0, right: 0, bottom: 0, left: 0 };

test('比例覆盖 16:9 / 19.5:9 / 20:9 / 21:9 / 4:3 / 16:10', () => {
  const ratios = new Set(Object.values(P.devices).map(d => d.ratio));
  for (const r of ['16:9', '19.5:9', '20:9', '21:9', '4:3', '16:10']) assert.ok(ratios.has(r), r);
});

test('关键档案尺寸、DPR 与安全区逐字段固定', () => {
  assert.deepEqual([P.devices['iphone-14'].width, P.devices['iphone-14'].height, P.devices['iphone-14'].dpr], [390, 844, 3]);
  assert.deepEqual(P.devices['iphone-14'].safeArea, { top: 47, right: 0, bottom: 34, left: 0 });
  assert.deepEqual(P.devices['land-844'].safeArea, { top: 0, right: 47, bottom: 21, left: 47 });
  assert.deepEqual(P.devices.fold.safeArea, zero);
  assert.deepEqual([P.devices.fold.width, P.devices.fold.height, P.devices.fold.ratio], [1080, 2520, '21:9']);
});

test('手机子组顺序稳定、无重复，全量为 13 档', () => {
  assert.deepEqual(P.matrix({ group: 'phones' }), ['se', 'android-s', 'iphone-se', 'iphone-14', 'pixel', 'iphone-max', 'fold']);
  assert.deepEqual(P.matrix({ group: 'landscape' }), ['land-568', 'land-844', 'land-932']);
  assert.deepEqual(P.matrix({ group: 'tablets' }), ['tablet']);
  assert.deepEqual(P.matrix({ group: 'desktop' }), ['desktop-s', 'desktop-m']);
  const all = P.matrix({ group: 'all' });
  assert.equal(all.length, 13);
  assert.equal(new Set(all).size, all.length);
});

test('resolve 接受档案名或现成对象，未知档案报中文错误', () => {
  assert.equal(P.resolve('se').width, 320);
  assert.equal(P.resolve({ width: 400, height: 800, dpr: 2 }).height, 800);
  assert.throws(() => P.resolve('nope'), /未知设备档案/);
});

test('mobile 标记沿用现有口径（宽度 < 1000）', () => {
  assert.equal(P.resolve('iphone-14').mobile, true);
  assert.equal(P.resolve('land-844').mobile, true);
  assert.equal(P.resolve('desktop-s').mobile, false);
});
