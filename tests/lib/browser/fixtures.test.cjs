// tests/lib/browser/fixtures.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const F = require('./fixtures.cjs');

function sandbox(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fixture-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'mobile-baseline.json'), JSON.stringify({ saveVersion: 5, started: true, coins: 1 }));
  return dir;
}

test('list 按文件名排序，仅收 .json', t => {
  const dir = sandbox(t);
  fs.writeFileSync(path.join(dir, 'notes.txt'), 'x');
  assert.deepEqual(F.list({ dir }), ['mobile-baseline']);
});

test('raw 返回原文，seedSource 生成只写存档键的注入脚本', t => {
  const dir = sandbox(t);
  const raw = F.raw('mobile-baseline', { dir });
  assert.equal(JSON.parse(raw).saveVersion, 5);
  const src = F.seedSource('mobile-baseline', { dir });
  assert.match(src, /localStorage\.setItem\('slimeSummonerSave'/);
  assert.match(src, /__seedError/);
  assert.ok(!src.includes('slimeSummonerSave_v'), '注入脚本不得伪造迁移备份');
});

test('缺失夹具报中文错误并带可用清单', t => {
  const dir = sandbox(t);
  assert.throws(() => F.raw('nope', { dir }), /未知夹具: nope.*mobile-baseline/s);
});
