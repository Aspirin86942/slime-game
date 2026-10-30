// 手机 smoke：13 档启动自检 + 全应用六页几何断言 + 页面侧安全区探针 + 夹具读档 + 断言活力自检。
// 页面清单用产品的 tab id（陪伴 = space）；每页只量容器级选择器，缺失的自动跳过。
// 结果、截图与失败几何快照全部落在被忽略的 tools/out 下。
'use strict';

const path = require('node:path');
const { start } = require('./lib/browser/session.cjs');
const fixtures = require('./lib/browser/fixtures.cjs');
const { report } = require('../tools/out/lib/cdp.js');
const profiles = require('./lib/browser/profiles.cjs');
const {
  noOverflow,
  noOverlap,
  aspectPreserved,
  hitTargets,
  safeAreaFailures,
  occlusionFailures,
  measure,
} = require('./lib/browser/layout.cjs');

const outDir = path.join(__dirname, '..', 'tools/out/magic-ui/smoke');
const checks = [];
const errors = [];
const startedAt = Date.now();
let activeSession = null;
let finalized = false;
let aborted = false;

// R3：陪伴页的 tab id 是 space，不是 companion。
const PAGES = ['space', 'home', 'summon', 'travel', 'bag', 'status'];
const PAGE_SELECTORS = ['.topbar', '.home-season', '.home-stock', '.home-tools', '.home-camera', '.tabbar'];
// 截图抽样：每档两屏（家园 + 一张旧玩法页），旧玩法页按档案轮换，六页都有出镜。
const LEGACY_PAGES = ['space', 'summon', 'travel', 'bag', 'status'];
// 手机/横屏档案才做安全区断言；fold 宽 1080 但属于 phones 组，不能按 session.profile.mobile 过滤。
const PHONE_PROFILES = new Set([
  ...profiles.matrix({ group: 'phones' }),
  ...profiles.matrix({ group: 'landscape' }),
]);
// 选择器口径：home-stock 是只读库存条（内部没有可点按钮），不参与触摸目标断言；
// topbar/tabbar 是铺满安全区的背景条，内容区自带内缩，安全区断言看页面 HUD 与内容元素。
const HIT_CHECK_EXCLUDED = new Set(['.home-stock']);
const SAFE_AREA_EXCLUDED = new Set(['.topbar', '.tabbar']);
const MIN_HIT = 40;

function check(name, ok, detail) {
  checks.push({ name, status: ok ? 'PASS' : 'FAIL', detail });
  if (!ok) {
    const message = detail && detail.mismatches
      ? detail.mismatches.join('；')
      : detail && detail.failures
        ? detail.failures.map(item => item.reason).join('；')
        : detail && detail.error;
    errors.push({ check: name, message });
  }
  return ok;
}

function writeFailure(name, detail) {
  report(outDir, `failure-${name}.json`, detail);
}

function withoutSelectors(snapshot, excluded) {
  return { ...snapshot, elements: (snapshot.elements || []).filter(element => !excluded.has(element.selector)) };
}

// 四类基础断言 + 手机档案追加安全区；每类失败都保留原始项，便于写几何快照。
function evaluate(snapshot, { safeArea = false } = {}) {
  const results = {
    overflow: noOverflow(snapshot),
    overlap: noOverlap(snapshot),
    aspect: aspectPreserved(snapshot),
    hit: hitTargets(withoutSelectors(snapshot, HIT_CHECK_EXCLUDED), { min: MIN_HIT }),
  };
  if (safeArea) results.safeArea = safeAreaFailures(withoutSelectors(snapshot, SAFE_AREA_EXCLUDED));
  return results;
}

function flattenFailures(results) {
  const out = [];
  for (const [kind, list] of Object.entries(results)) {
    for (const item of list || []) out.push({ check: kind, ...item });
  }
  return out;
}

function profileFailureFile(profile, failures) {
  writeFailure(profile, {
    profile,
    generatedAt: new Date().toISOString(),
    failures,
  });
}

// 页面侧安全区探针：env() 真的落到页面，才算 insets 生效；无内缩档案必须解析为 0。
const SAFE_AREA_PROBE = `(() => {
  const el = document.createElement('div');
  el.id = 'smokeSafeAreaProbe';
  el.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;pointer-events:none;'
    + 'padding-top:env(safe-area-inset-top);padding-right:env(safe-area-inset-right);'
    + 'padding-bottom:env(safe-area-inset-bottom);padding-left:env(safe-area-inset-left);';
  document.body.append(el);
  const style = getComputedStyle(el);
  const value = text => { const n = parseFloat(text); return Number.isFinite(n) ? n : 0; };
  const out = {
    top: value(style.paddingTop),
    right: value(style.paddingRight),
    bottom: value(style.paddingBottom),
    left: value(style.paddingLeft),
  };
  el.remove();
  return out;
})()`;

async function checkSafeAreaProbe(session, name, failures) {
  const expected = session.profile.safeArea;
  const actual = await session.ev(SAFE_AREA_PROBE);
  const mismatches = [];
  for (const key of ['top', 'right', 'bottom', 'left']) {
    if (actual[key] !== expected[key]) mismatches.push(`${key} ${actual[key]}px ≠ ${expected[key]}px`);
  }
  const ok = check(`safe area insets ${name}`, mismatches.length === 0, { profile: name, expected, actual, mismatches });
  console.log(
    (ok ? 'PASS ' : 'FAIL ') + `safe area insets ${name}  ${actual.top}/${actual.right}/${actual.bottom}/${actual.left}px`
  );
  if (!ok) failures.push({ kind: 'safeAreaProbe', expected, actual, mismatches });
  return ok;
}

async function checkPages(session, name, index, failures) {
  const phone = PHONE_PROFILES.has(name);
  const shotPage = LEGACY_PAGES[index % LEGACY_PAGES.length];
  for (const page of PAGES) {
    const consoleStart = session.consoleErrors.length;
    await session.ev(`switchTab(${JSON.stringify(page)})`);
    await session.frame();
    await session.frame();
    const snapshot = await measure(session, PAGE_SELECTORS);
    const results = evaluate(snapshot, { safeArea: phone });
    const pageFailures = flattenFailures(results);
    const newErrors = session.consoleErrors.slice(consoleStart);
    for (const message of newErrors) pageFailures.push({ check: 'console', reason: message });
    const ok = pageFailures.length === 0;
    const label = `page ${name}/${page}`;
    check(label, ok, {
      profile: name,
      page,
      selectors: snapshot.elements.map(element => element.selector),
      failures: pageFailures,
      results,
      consoleErrors: newErrors,
      snapshot,
    });
    console.log(
      (ok ? 'PASS ' : 'FAIL ') + label +
      `  elements=${snapshot.elements.map(element => element.selector).join(',')}` +
      (ok ? '' : `  failures=${pageFailures.length}`)
    );
    if (!ok) {
      for (const item of pageFailures) console.log('  ' + item.reason);
      failures.push({ kind: 'page', page, failures: pageFailures, results, snapshot, consoleErrors: newErrors });
      await session.shot(`failure-${name}-${page}.png`).catch(() => {});
    }
    if (page === 'home' || page === shotPage) {
      await session.shot(path.join(name, `${page}.png`)).catch(error => {
        console.log(`  (截图跳过 ${name}/${page}: ${error.message})`);
      });
    }
  }
}

// 单个档案：一次真实会话里完成启动自检、安全区探针、六页断言与抽样截图。
async function runProfile(name, index) {
  const failures = [];
  let session = null;
  try {
    session = await start({ profile: name, url: '史莱姆.html', seed: 'mobile-baseline', outDir });
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
    const bootDetail = {
      profile: name,
      expected: { width: expected.width, height: expected.height, dpr: expected.dpr, mobile: expected.mobile, safeArea: expected.safeArea },
      actual,
      mismatches,
      consoleErrors: session.consoleErrors.slice(),
    };
    const bootOk = check('boot ' + name, mismatches.length === 0, bootDetail);
    console.log((bootOk ? 'PASS ' : 'FAIL ') + 'boot ' + name + '  ' + actual.w + '×' + actual.h + ' @' + actual.dpr);
    if (!bootOk) {
      for (const line of mismatches) console.log('  ' + line);
      failures.push({ kind: 'boot', ...bootDetail });
      await session.shot(`failure-${name}.png`).catch(() => {});
    }

    // 页面侧安全区探针：13 档都验一次，零内缩档案必须解析为 0；安全区断言只在手机/横屏档案跑。
    await checkSafeAreaProbe(session, name, failures);
    await checkPages(session, name, index, failures);
  } catch (error) {
    const message = (error && (error.stack || error.message)) || String(error);
    check('profile ' + name, false, { profile: name, error: message, consoleErrors: session ? session.consoleErrors.slice() : [] });
    console.log('FAIL profile ' + name);
    console.log('  ' + message);
    failures.push({ kind: 'profile', error: message, consoleErrors: session ? session.consoleErrors.slice() : [] });
  } finally {
    if (failures.length) profileFailureFile(name, failures);
    if (session) {
      await session.close().catch(() => {});
      if (activeSession === session) activeSession = null;
    }
  }
}

// R15：legacy-v5 只在普通模式（不带 ?battle=ui）走真实读档，才会产生 _v5_backup。
async function checkLegacyMigration() {
  let session;
  const label = 'legacy v5 migration backup';
  try {
    session = await start({ profile: 'iphone-14', url: '史莱姆.html', seed: 'legacy-v5', outDir });
    activeSession = session;
    const actual = await session.ev(`(() => ({
      backup: Object.keys(localStorage).some(k => k.startsWith(${JSON.stringify(fixtures.SAVE_KEY + '_v5_backup')})),
      started: S.started,
      plots: S.world && S.world.estate ? S.world.estate.plots.length : null
    }))()`);
    const mismatches = [];
    if (actual.backup !== true) mismatches.push('缺少 _v5_backup 备份键');
    if (actual.started !== true) mismatches.push(`started=${actual.started}`);
    if (!(actual.plots > 0)) mismatches.push(`plots=${actual.plots}，应大于 0`);
    const detail = { fixture: 'legacy-v5', actual, mismatches, consoleErrors: session.consoleErrors.slice() };
    const ok = check(label, mismatches.length === 0, detail);
    console.log((ok ? 'PASS ' : 'FAIL ') + label + `  backup=${actual.backup} started=${actual.started} plots=${actual.plots}`);
    if (!ok) {
      for (const line of mismatches) console.log('  ' + line);
      writeFailure('legacy-v5', detail);
      await session.shot('failure-legacy-v5.png').catch(() => {});
    }
  } catch (error) {
    const message = (error && error.message) || String(error);
    check(label, false, { fixture: 'legacy-v5', error: message, consoleErrors: session ? session.consoleErrors.slice() : [] });
    console.log('FAIL ' + label);
    console.log('  ' + message);
    writeFailure('legacy-v5', { fixture: 'legacy-v5', error: message });
  } finally {
    if (session) {
      await session.close().catch(() => {});
      if (activeSession === session) activeSession = null;
    }
  }
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

// 断言活力证明：故意压住 .home-tools，noOverlap 与 occlusionFailures 必须报红；移除后必须恢复全绿。
async function checkAssertionLiveness() {
  let session;
  const label = 'assertion liveness home-tools';
  try {
    session = await start({ profile: 'iphone-14', url: '史莱姆.html', seed: 'mobile-baseline', outDir });
    activeSession = session;
    await session.ev(`switchTab('home')`);
    await session.frame();
    await session.frame();
    const selectors = [...PAGE_SELECTORS, '.smoke-occluder'];

    const before = await measure(session, PAGE_SELECTORS);
    const beforeOverlap = noOverlap(before);
    const beforeOcclusion = occlusionFailures(before);

    const blocked = await session.ev(`(() => {
      const target = document.querySelector('.home-tools');
      if (!target) return null;
      const rect = target.getBoundingClientRect();
      const el = document.createElement('div');
      el.className = 'smoke-occluder';
      el.style.cssText = 'position:fixed;z-index:999999;background:rgba(255,0,0,.35);pointer-events:auto;'
        + 'left:' + (rect.left - 4) + 'px;top:' + (rect.top - 4) + 'px;'
        + 'width:' + (rect.width + 8) + 'px;height:' + (rect.height + 8) + 'px;';
      document.body.append(el);
      return { left: rect.left - 4, top: rect.top - 4, width: rect.width + 8, height: rect.height + 8 };
    })()`);
    await session.frame();
    await session.frame();
    const redSnapshot = await measure(session, selectors);
    const redOverlap = noOverlap(redSnapshot);
    const redOcclusion = occlusionFailures(redSnapshot);

    await session.ev(`(() => { const el = document.querySelector('.smoke-occluder'); if (el) el.remove(); return true; })()`);
    await session.frame();
    await session.frame();
    const greenSnapshot = await measure(session, selectors);
    const greenOverlap = noOverlap(greenSnapshot);
    const greenOcclusion = occlusionFailures(greenSnapshot);

    const detail = {
      profile: 'iphone-14',
      occluder: blocked,
      before: { overlap: beforeOverlap, occlusion: beforeOcclusion },
      red: { overlap: redOverlap, occlusion: redOcclusion },
      green: { overlap: greenOverlap, occlusion: greenOcclusion },
    };
    const detected = redOverlap.length > 0 && redOcclusion.length > 0;
    const restored = greenOverlap.length === 0 && greenOcclusion.length === 0;
    const cleanStart = beforeOverlap.length === 0 && beforeOcclusion.length === 0;
    const ok = cleanStart && detected && restored;
    check(label, ok, detail);
    console.log(`LIVENESS before overlap=${beforeOverlap.length} occlusion=${beforeOcclusion.length}`);
    console.log(`LIVENESS red    overlap=${redOverlap.length} occlusion=${redOcclusion.length}  ` +
      redOverlap.map(item => `${item.a}×${item.b}`).join(','));
    console.log(`LIVENESS green  overlap=${greenOverlap.length} occlusion=${greenOcclusion.length}`);
    if (!ok) {
      const mismatches = [];
      if (!cleanStart) mismatches.push(`基线未全绿 overlap=${beforeOverlap.length} occlusion=${beforeOcclusion.length}`);
      if (!detected) mismatches.push(`遮挡未报红 overlap=${redOverlap.length} occlusion=${redOcclusion.length}`);
      if (!restored) mismatches.push(`移除后未恢复 overlap=${greenOverlap.length} occlusion=${greenOcclusion.length}`);
      detail.mismatches = mismatches;
      for (const line of mismatches) console.log('  ' + line);
      writeFailure('liveness', detail);
    }
  } catch (error) {
    const message = (error && error.message) || String(error);
    check(label, false, { error: message });
    console.log('FAIL ' + label);
    console.log('  ' + message);
  } finally {
    if (session) {
      await session.close().catch(() => {});
      if (activeSession === session) activeSession = null;
    }
  }
}

async function closeActive() {
  if (!activeSession) return;
  const session = activeSession;
  activeSession = null;
  await session.close().catch(() => {});
}

function writeResults() {
  const passed = checks.filter(item => item.status === 'PASS').length;
  report(outDir, 'results.json', {
    checks,
    errors,
    durationMs: Date.now() - startedAt,
    passed,
    total: checks.length,
  });
}

// 汇总至少打印一次；尾部异常（finalized 之后）再强制打印，绝不出现「results 全绿 + 退出码 1」。
function finish(force = false) {
  const passed = checks.filter(item => item.status === 'PASS').length;
  writeResults();
  if (!finalized || force) {
    finalized = true;
    console.log(`TIME  ${Date.now() - startedAt} ms`);
    console.log(`RESULT ${passed}/${checks.length} smoke checks`);
  }
  if (passed !== checks.length) process.exitCode = 1;
}

function fatal(name, error) {
  const message = (error && (error.stack || error.message)) || String(error);
  check(name, false, { error: message });
  console.error('FAIL ' + name + '\n  ' + message);
}

// R17：异常路径先重写结果，再关浏览器，最后退出；close 卡住由兜底定时器强制退出，
// 这样即使浏览器句柄异常，也不会留下「results 全绿 + 退出码 1」。
async function abort(name, error) {
  if (aborted) return;
  aborted = true;
  fatal(name, error);
  finish(true);
  const guard = setTimeout(() => process.exit(process.exitCode || 1), 5000);
  guard.unref();
  await closeActive();
  clearTimeout(guard);
  process.exit(process.exitCode || 1);
}

async function main() {
  try {
    const names = profiles.matrix({ group: 'all' });
    for (let index = 0; index < names.length; index += 1) {
      await runProfile(names[index], index);
    }
    await checkSeededFixture();
    await checkLegacyMigration();
    await checkTapAssist();
    await checkAssertionLiveness();
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

main().catch(error => abort('main rejected', error));
