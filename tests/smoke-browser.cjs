// 手机 smoke：13 个设备档案的启动自检。
// 断言实际视口 / DPR 与档案一致、页内无错误；结果与失败明细落在被忽略的 tools/out 下。
'use strict';

const path = require('node:path');
const { start } = require('./lib/browser/session.cjs');
const { report } = require('../tools/out/lib/cdp.js');
const profiles = require('./lib/browser/profiles.cjs');

const outDir = path.join(__dirname, '..', 'tools/out/magic-ui/smoke');
const checks = [];
const errors = [];
const startedAt = Date.now();

function check(name, ok, detail) {
  checks.push({ name, status: ok ? 'PASS' : 'FAIL', detail });
  if (!ok) errors.push({ check: name, message: detail.mismatches ? detail.mismatches.join('；') : detail.error });
  return ok;
}

function writeFailure(profileName, detail) {
  report(outDir, `failure-${profileName}.json`, detail);
}

(async () => {
  for (const name of profiles.matrix({ group: 'all' })) {
    let session;
    try {
      session = await start({ profile: name, url: '史莱姆.html?battle=ui', outDir });
      const actual = await session.ev(`(() => ({
        w: innerWidth,
        h: innerHeight,
        dpr: devicePixelRatio,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight
      }))()`);
      const expected = session.profile;
      const mismatches = [];
      if (actual.w !== expected.width) mismatches.push(`宽 ${actual.w} ≠ ${expected.width}`);
      if (actual.h !== expected.height) mismatches.push(`高 ${actual.h} ≠ ${expected.height}`);
      if (actual.dpr !== expected.dpr) mismatches.push(`DPR ${actual.dpr} ≠ ${expected.dpr}`);
      if (session.consoleErrors.length) mismatches.push(`页内错误 ${session.consoleErrors.length} 条`);
      const detail = {
        profile: name,
        expected: { width: expected.width, height: expected.height, dpr: expected.dpr, mobile: expected.mobile, safeArea: expected.safeArea },
        actual,
        mismatches,
        consoleErrors: session.consoleErrors.slice(),
      };
      const ok = check('boot ' + name, mismatches.length === 0, detail);
      console.log((ok ? 'PASS ' : 'FAIL ') + 'boot ' + name + '  ' + actual.w + '×' + actual.h + ' @' + actual.dpr);
      if (!ok) {
        for (const line of mismatches) console.log('  ' + line);
        writeFailure(name, detail);
        await session.shot('failure-' + name).catch(() => {});
      }
    } catch (error) {
      const message = (error && error.message) || String(error);
      const detail = { profile: name, error: message, consoleErrors: session ? session.consoleErrors.slice() : [] };
      check('boot ' + name, false, detail);
      console.log('FAIL boot ' + name);
      console.log('  ' + message);
      writeFailure(name, detail);
      if (session) await session.shot('failure-' + name).catch(() => {});
    } finally {
      if (session) await session.close();
    }
  }

  const durationMs = Date.now() - startedAt;
  const passed = checks.filter(item => item.status === 'PASS').length;
  report(outDir, 'results.json', { checks, errors, durationMs });
  console.log(`TIME  ${durationMs} ms`);
  console.log(`RESULT ${passed}/${checks.length} smoke boot checks`);
  if (passed !== checks.length) process.exitCode = 1;
})();
