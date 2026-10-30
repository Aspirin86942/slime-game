// 手机 smoke：13 个设备档案的启动自检 + 真实读档 + tap 前置行为。
// 断言实际视口 / DPR 与档案一致、页内无错误；结果与失败明细落在被忽略的 tools/out 下。
'use strict';

const path = require('node:path');
const { start } = require('./lib/browser/session.cjs');
const fixtures = require('./lib/browser/fixtures.cjs');
const { report } = require('../tools/out/lib/cdp.js');
const profiles = require('./lib/browser/profiles.cjs');

const outDir = path.join(__dirname, '..', 'tools/out/magic-ui/smoke');
const checks = [];
const errors = [];
const startedAt = Date.now();
let activeSession = null;
let finalized = false;

function check(name, ok, detail) {
  checks.push({ name, status: ok ? 'PASS' : 'FAIL', detail });
  if (!ok) errors.push({ check: name, message: detail.mismatches ? detail.mismatches.join('；') : detail.error });
  return ok;
}

function writeFailure(profileName, detail) {
  report(outDir, `failure-${profileName}.json`, detail);
}

// 顶层兜底：任何未捕获异常也要留下 results.json，并让退出码非零。
function fatal(name, error) {
  const message = (error && (error.stack || error.message)) || String(error);
  if (finalized) {
    console.error(message);
    process.exitCode = 1;
    return;
  }
  check(name, false, { error: message });
  console.error('FAIL ' + name + '\n  ' + message);
}

function finish() {
  if (finalized) return;
  finalized = true;
  const durationMs = Date.now() - startedAt;
  const passed = checks.filter(item => item.status === 'PASS').length;
  report(outDir, 'results.json', { checks, errors, durationMs });
  console.log(`TIME  ${durationMs} ms`);
  console.log(`RESULT ${passed}/${checks.length} smoke checks`);
  if (passed !== checks.length) process.exitCode = 1;
}

// 进程级异常：先落盘并结束汇总，再强制非零退出，避免未关闭的浏览器把进程拖住。
function abort(name, error) {
  fatal(name, error);
  finish();
  const timer = setTimeout(() => process.exit(process.exitCode || 1), 100);
  timer.unref();
}

async function closeActive() {
  if (!activeSession) return;
  const session = activeSession;
  activeSession = null;
  await session.close().catch(() => {});
}

async function checkSeededFixture() {
  let session;
  try {
    const fixture = JSON.parse(fixtures.raw('mobile-developed'));
    session = await start({ profile: 'iphone-14', url: '史莱姆.html', seed: 'mobile-developed', outDir });
    activeSession = session;
    const actual = await session.ev(`(() => ({
      started: S.started,
      plots: S.world && S.world.estate ? S.world.estate.plots.length : null,
      tech: S.world && S.world.estate ? S.world.estate.tech.length : null,
      coins: S.coins
    }))()`);
    const expected = {
      plots: fixture.world.estate.plots.length,
      tech: fixture.world.estate.tech.length,
      coins: fixture.coins,
    };
    const mismatches = [];
    if (actual.started !== true) mismatches.push(`started=${actual.started}`);
    if (actual.plots !== expected.plots) mismatches.push(`plots ${actual.plots} ≠ ${expected.plots}`);
    if (actual.coins !== expected.coins) mismatches.push(`coins ${actual.coins} ≠ ${expected.coins}`);
    if (session.consoleErrors.length) mismatches.push(`页内错误 ${session.consoleErrors.length} 条`);
    const detail = { fixture: 'mobile-developed', expected, actual, mismatches, consoleErrors: session.consoleErrors.slice() };
    const ok = check('seeded mobile-developed', mismatches.length === 0, detail);
    console.log((ok ? 'PASS ' : 'FAIL ') + 'seeded mobile-developed  plots=' + actual.plots + ' tech=' + actual.tech + ' started=' + actual.started);
    if (!ok) {
      for (const line of mismatches) console.log('  ' + line);
      writeFailure('mobile-developed', detail);
      await session.shot('failure-mobile-developed').catch(() => {});
    }
  } catch (error) {
    const message = (error && error.message) || String(error);
    const detail = { fixture: 'mobile-developed', error: message, consoleErrors: session ? session.consoleErrors.slice() : [] };
    check('seeded mobile-developed', false, detail);
    console.log('FAIL seeded mobile-developed');
    console.log('  ' + message);
    writeFailure('mobile-developed', detail);
    if (session) await session.shot('failure-mobile-developed').catch(() => {});
  } finally {
    if (session) {
      await session.close().catch(() => {});
      if (activeSession === session) activeSession = null;
    }
  }
}

// R10：tap 先展开祖先 <details> 并 scrollIntoView，否则折叠/离屏目标会点到 (0,0)。
async function checkTapAssist() {
  let session;
  try {
    session = await start({ profile: 'iphone-14', url: '史莱姆.html', outDir });
    activeSession = session;
    await session.ev(`(() => {
      const host = document.createElement('div');
      host.id = 'tapProbe';
      host.style.cssText = 'position:fixed;inset:0;z-index:99999;overflow:auto;background:#0b0b0f;';
      host.innerHTML = '<div style="height:1800px"></div><details id="tapProbeDetails"><summary>展开</summary><button id="tapProbeButton" style="margin:24px;padding:12px">tap target</button></details><div style="height:400px"></div>';
      document.body.append(host);
      window.__tapProbeClicked = false;
      host.querySelector('#tapProbeButton').addEventListener('click', () => { window.__tapProbeClicked = true; });
      return true;
    })()`);
    const before = await session.ev(`(() => ({
      scrollTop: document.getElementById('tapProbe').scrollTop,
      open: document.getElementById('tapProbeDetails').open
    }))()`);
    await session.tap('#tapProbeButton');
    const after = await session.ev(`(() => {
      const host = document.getElementById('tapProbe');
      const details = document.getElementById('tapProbeDetails');
      const button = document.getElementById('tapProbeButton');
      const rect = button.getBoundingClientRect();
      const result = {
        open: details.open,
        clicked: window.__tapProbeClicked === true,
        scrollTop: host.scrollTop,
        top: rect.top,
        bottom: rect.bottom,
        viewportHeight: innerHeight
      };
      host.remove();
      return result;
    })()`);
    const mismatches = [];
    if (after.open !== true) mismatches.push('祖先 details 未展开');
    if (after.clicked !== true) mismatches.push('目标按钮未收到点击');
    if (!(after.scrollTop > before.scrollTop)) mismatches.push(`未发生滚动 ${before.scrollTop}→${after.scrollTop}`);
    if (!(after.top >= 0 && after.bottom <= after.viewportHeight)) mismatches.push(`目标不在视口内 ${after.top}..${after.bottom}/${after.viewportHeight}`);
    const detail = { before, after, mismatches };
    const ok = check('tap expands details and scrolls into view', mismatches.length === 0, detail);
    console.log((ok ? 'PASS ' : 'FAIL ') + 'tap expands details and scrolls into view  open=' + after.open + ' clicked=' + after.clicked + ' scrollTop=' + after.scrollTop);
    if (!ok) writeFailure('tap-assist', detail);
  } catch (error) {
    const message = (error && error.message) || String(error);
    check('tap expands details and scrolls into view', false, { error: message });
    console.log('FAIL tap expands details and scrolls into view');
    console.log('  ' + message);
  } finally {
    if (session) {
      await session.close().catch(() => {});
      if (activeSession === session) activeSession = null;
    }
  }
}

async function main() {
  try {
    for (const name of profiles.matrix({ group: 'all' })) {
      let session;
      try {
        session = await start({ profile: name, url: '史莱姆.html?battle=ui', outDir });
        activeSession = session;
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
        if (session) {
          await session.close().catch(() => {});
          if (activeSession === session) activeSession = null;
        }
      }
    }

    await checkSeededFixture();
    await checkTapAssist();
  } catch (error) {
    fatal('uncaught error', error);
  } finally {
    await closeActive();
    finish();
  }
}

process.on('uncaughtException', error => {
  abort('uncaught exception', error);
});
process.on('unhandledRejection', reason => {
  abort('unhandled rejection', reason);
});

main();
