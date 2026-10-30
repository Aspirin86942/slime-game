// 手机 smoke：13 档启动自检 + 全应用六页几何断言 + 页面侧安全区探针 + 夹具读档 + 断言活力自检。
// 页面清单用产品的 tab id（陪伴 = space）。每页声明 required selectors 与元素数下限：
// measure 会静默跳过缺失选择器，所以这里再用页面侧计数核对，缺一个就判红，并核对活动页标记。
// 页面内容分两层：固定 HUD 参与四类断言；滚动内容只查横向溢出与兄弟压盖（纵向滚动是正常行为）。
// 旧玩法页没有 <img>，aspect 的输入取自内联 SVG 的 viewBox 与 home 的 <svg><image> 固有尺寸。
// 任务 7 追加：9 档家园四个弹层态（遮挡/安全区/容器视口）与每档一次旧玩法五交互（无 console 增量）。
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
// 截图抽样：每档两屏（家园 + 一张旧玩法页），旧玩法页按档案轮换，六页都有出镜。
const LEGACY_PAGES = ['space', 'summon', 'travel', 'bag', 'status'];
// 弹层态只在七个手机竖屏档 + land-844 + desktop-m 上跑。
const OVERLAY_PROFILES = new Set([...profiles.matrix({ group: 'phones' }), 'land-844', 'desktop-m']);
// 每页的固定 HUD、滚动内容与 required selectors（数字是 querySelectorAll 的元素数下限）。
// 固定 HUD 参与溢出/压盖/比例/命中/安全区；滚动内容只做横向溢出与兄弟压盖，
// 因为 .content 纵向滚动时子元素本来就允许越过视口底部。
const PAGE_SPEC = {
  space: {
    hud: ['.topbar', '.tabbar'],
    content: ['.panel', '.space-header', '.feed-trough', '.toy-bar', '.space-playground', '.slime'],
    required: {
      '.topbar': 1, '.tabbar': 1, '.panel': 1, '.space-header': 1, '.feed-trough': 1,
      '.toy-bar': 1, '.space-playground': 1, '.slime': 1, '.minigrid': 1,
    },
    artMin: 6,
  },
  home: {
    hud: ['.topbar', '.home-season', '.home-stock', '.home-tools', '.home-camera', '.tabbar'],
    content: ['.home-world', '.home-scene', '.home-map'],
    required: {
      '.topbar': 1, '.tabbar': 1, '.home-world': 1, '.home-scene': 1, '.home-season': 1,
      '.home-stock': 1, '.home-tools': 1, '.home-camera': 1, '.home-map': 1,
    },
    artMin: 20,
  },
  summon: {
    hud: ['.topbar', '.tabbar'],
    content: ['.panel', '.panel + .panel', '.summon-count', '.boost-grid', '.boost-btn'],
    required: {
      '.topbar': 1, '.tabbar': 1, '.panel': 2, '.summon-count': 1, '.boost-grid': 1, '.boost-btn': 12,
    },
    artMin: 6,
  },
  travel: {
    hud: ['.topbar', '.tabbar'],
    content: ['.panel', '.btn'],
    required: { '.topbar': 1, '.tabbar': 1, '.panel': 1, '.btn': 1 },
    artMin: 6,
  },
  bag: {
    hud: ['.topbar', '.tabbar'],
    content: ['.item-row', '.item-icon', '.btn', '.panel:last-child'],
    required: { '.topbar': 1, '.tabbar': 1, '.item-row': 4, '.item-icon': 4, '.btn': 8 },
    artMin: 6,
  },
  status: {
    hud: ['.topbar', '.tabbar'],
    content: ['.panel', '.panel + .panel', '.profile', '.task-row'],
    required: { '.topbar': 1, '.tabbar': 1, '.panel': 5, '.profile': 1, '.task-row': 12 },
    artMin: 6,
  },
};
// 容器本身铺满安全区，继续豁免；子元素纳入安全区断言，让手机档案每页都有实质输入。
const SAFE_AREA_CONTAINERS = new Set(['.topbar', '.tabbar']);
const SAFE_AREA_CHILD_SELECTORS = [
  '.topbar .cur:nth-of-type(1)',
  '.topbar .cur:nth-of-type(2)',
  '#lvCur',
  '.topbar .settings-trigger',
  ...PAGES.map(page => `.tabbar button[data-tab="${page}"]`),
];
// aspect 的真实输入：内联 UI 图标（viewBox）、家园绘本图标、家园 <svg><image>；旧玩法页没有 <img>。
const ART_SELECTORS = ['.ui-icon', '.home-art-icon', '.home-map image', '#content img'];
// 手机/横屏档案才做安全区断言；fold 宽 1080 但属于 phones 组，不能按 session.profile.mobile 过滤。
const PHONE_PROFILES = new Set([
  ...profiles.matrix({ group: 'phones' }),
  ...profiles.matrix({ group: 'landscape' }),
]);
// 全局约束：手机 40×40、桌面 32×32；平板按手机口径。
const DESKTOP_PROFILES = new Set(profiles.matrix({ group: 'desktop' }));
const MIN_HIT_PHONE = 40;
const MIN_HIT_DESKTOP = 32;
// home-stock 是只读库存条（内部没有可点按钮），不参与触摸目标断言；其余阈值不放宽。
const HIT_CHECK_EXCLUDED = new Set(['.home-stock']);

function requiredFor(page) {
  return {
    ...PAGE_SPEC[page].required,
    ...Object.fromEntries(SAFE_AREA_CHILD_SELECTORS.map(selector => [selector, 1])),
  };
}

function measuredSelectorsFor(page) {
  const spec = PAGE_SPEC[page];
  return [...spec.hud, ...SAFE_AREA_CHILD_SELECTORS, ...spec.content];
}

const EXPECTED_TOTAL_ELEMENTS = PAGES.reduce((total, page) => total + measuredSelectorsFor(page).length, 0);
const EXPECTED_TOTAL_REQUIRED = PAGES.reduce((total, page) => total + Object.keys(requiredFor(page)).length, 0);


function check(name, ok, detail) {
  checks.push({ name, status: ok ? 'PASS' : 'FAIL', detail });
  if (!ok) {
    // R20：page coverage 与弹层/旧玩法失败都写 detail.problems，错误摘要能读到具体问题。
    const message = detail && detail.mismatches
      ? detail.mismatches.join('；')
      : detail && detail.problems
        ? detail.problems.join('；')
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

function pick(snapshot, selectors) {
  const wanted = selectors instanceof Set ? selectors : new Set(selectors);
  return { ...snapshot, elements: (snapshot.elements || []).filter(element => wanted.has(element.selector)) };
}

// 滚动内容的子元素允许纵向越过视口（.content 自己滚动）；横向越界仍然是布局错误。
function noHorizontalOverflow(snapshot) {
  const failures = [];
  const viewport = snapshot.viewport || {};
  for (const element of snapshot.elements || []) {
    const rect = element.rect;
    if (!rect || !Number.isFinite(rect.left) || !Number.isFinite(rect.width) || !Number.isFinite(rect.height)) {
      failures.push({ selector: element.selector, reason: '矩形坐标不是有限数值' });
      continue;
    }
    if (rect.width <= 0 || rect.height <= 0) {
      failures.push({ selector: element.selector, reason: `元素尺寸为 0：${rect.width}×${rect.height}` });
      continue;
    }
    if (rect.left < -1 || rect.right > (viewport.width || 0) + 1) {
      failures.push({
        selector: element.selector,
        reason: `横向越出视口：left ${rect.left}, right ${rect.right}, 视口宽 ${viewport.width}`,
      });
    }
  }
  return failures;
}

// 四类基础断言 + 手机档案追加安全区；HUD 与滚动内容分开喂，避免把正常纵向滚动误判成溢出。
function evaluate(snapshot, artSnapshot, spec, { safeArea = false, minHit = MIN_HIT_PHONE } = {}) {
  const hud = pick(snapshot, spec.hud);
  const content = pick(snapshot, spec.content);
  const safe = withoutSelectors(pick(snapshot, [...spec.hud, ...SAFE_AREA_CHILD_SELECTORS]), SAFE_AREA_CONTAINERS);
  const results = {
    overflow: [...noOverflow(hud), ...noHorizontalOverflow(content)],
    overlap: [...noOverlap(hud), ...noOverlap(content)],
    aspect: aspectPreserved(artSnapshot),
    hit: hitTargets(withoutSelectors(hud, HIT_CHECK_EXCLUDED), { min: minHit }),
  };
  if (safeArea) results.safeArea = safeAreaFailures(safe);
  return results;
}

// 页面侧最低证据：活动页标记 + 每个 required selector 的真实匹配数（不依赖 measure）。
function pageStateExpression(required) {
  return `(() => {
    const required = ${JSON.stringify(required)};
    const counts = {};
    for (const selector of Object.keys(required)) counts[selector] = document.querySelectorAll(selector).length;
    const active = [...document.querySelectorAll('.tabbar button.active')];
    const content = document.querySelector('#content');
    return {
      activeTabs: active.map(button => button.dataset.tab || ''),
      activeText: active.map(button => button.textContent.trim()),
      counts,
      contentScroll: content
        ? { scrollTop: content.scrollTop, scrollHeight: content.scrollHeight, clientHeight: content.clientHeight }
        : null,
    };
  })()`;
}

// aspect 的真实输入：<img> 用 naturalWidth；<svg image> 用 width/height 固有尺寸；
// 内联 <svg> 用 viewBox。旧玩法页没有 <img>，图标 viewBox 是它们唯一的图片式输入。
async function measureArt(session, selectors) {
  const expression = `(() => {
    const selectors = ${JSON.stringify(selectors)};
    const elements = [];
    for (const selector of selectors) {
      [...document.querySelectorAll(selector)].forEach((el, index) => {
        const rect = el.getBoundingClientRect();
        if (!(rect.width > 0 && rect.height > 0)) return;
        const tag = el.tagName.toLowerCase();
        let naturalWidth = 0;
        let naturalHeight = 0;
        let kind = '';
        if (tag === 'img') {
          naturalWidth = el.naturalWidth;
          naturalHeight = el.naturalHeight;
          kind = 'img';
        } else if (tag === 'image') {
          naturalWidth = el.width && el.width.baseVal ? el.width.baseVal.value : 0;
          naturalHeight = el.height && el.height.baseVal ? el.height.baseVal.value : 0;
          kind = 'svg-image';
        } else if (tag === 'svg') {
          const box = el.viewBox && el.viewBox.baseVal;
          if (box && box.width > 0 && box.height > 0) {
            naturalWidth = box.width;
            naturalHeight = box.height;
            kind = 'svg-viewbox';
          }
        }
        if (!naturalWidth || !naturalHeight) return;
        elements.push({
          selector: selector + '[' + index + ']',
          tag,
          kind,
          rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height },
          naturalWidth,
          naturalHeight,
        });
      });
    }
    return { viewport: { width: innerWidth, height: innerHeight }, elements };
  })()`;
  return session.ev(expression);
}

function summarizeKinds(elements) {
  const counts = {};
  for (const element of elements) counts[element.kind] = (counts[element.kind] || 0) + 1;
  return counts;
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
  const minHit = DESKTOP_PROFILES.has(name) ? MIN_HIT_DESKTOP : MIN_HIT_PHONE;
  const shotPage = LEGACY_PAGES[index % LEGACY_PAGES.length];
  const coverage = {
    profile: name,
    pages: [],
    pageChecks: 0,
    expectedPages: PAGES.length,
    totalMeasured: 0,
    expectedTotal: EXPECTED_TOTAL_ELEMENTS,
    totalRequired: 0,
    expectedRequired: EXPECTED_TOTAL_REQUIRED,
  };
  for (const page of PAGES) {
    const spec = PAGE_SPEC[page];
    const required = requiredFor(page);
    const selectors = measuredSelectorsFor(page);
    const consoleStart = session.consoleErrors.length;
    await session.ev(`switchTab(${JSON.stringify(page)})`);
    await session.frame();
    await session.frame();
    // 页面侧最低证据：活动页真的切过去了、required selector 真的有元素。
    const state = await session.ev(pageStateExpression(required));
    const snapshot = await measure(session, selectors);
    const art = await measureArt(session, ART_SELECTORS);
    const evidence = [];
    if (state.activeTabs.length !== 1 || state.activeTabs[0] !== page) {
      evidence.push({ check: 'activeTab', reason: `活动页标记 ${JSON.stringify(state.activeTabs)} ≠ ${page}` });
    }
    const missing = [];
    const underMin = [];
    for (const [selector, min] of Object.entries(required)) {
      const count = state.counts[selector] || 0;
      if (count === 0) missing.push(selector);
      else if (count < min) underMin.push(`${selector} ${count} < ${min}`);
    }
    if (missing.length) evidence.push({ check: 'required', reason: `缺少 required selector：${missing.join(', ')}` });
    if (underMin.length) evidence.push({ check: 'minCount', reason: `元素数低于下限：${underMin.join('；')}` });
    const measured = new Set(snapshot.elements.map(element => element.selector));
    const skipped = selectors.filter(selector => !measured.has(selector));
    if (skipped.length) evidence.push({ check: 'measure', reason: `measure 静默跳过：${skipped.join(', ')}` });
    if (snapshot.elements.length !== selectors.length) {
      evidence.push({ check: 'elements', reason: `本页测量元素 ${snapshot.elements.length} ≠ 期望 ${selectors.length}` });
    }
    if (art.elements.length < spec.artMin) {
      evidence.push({ check: 'artInput', reason: `aspect 输入 ${art.elements.length} < 下限 ${spec.artMin}` });
    }
    const results = evaluate(snapshot, art, spec, { safeArea: phone, minHit });
    const pageFailures = [...evidence, ...flattenFailures(results)];
    const newErrors = session.consoleErrors.slice(consoleStart);
    for (const message of newErrors) pageFailures.push({ check: 'console', reason: message });
    const ok = pageFailures.length === 0;
    const label = `page ${name}/${page}`;
    check(label, ok, {
      profile: name,
      page,
      required,
      activeTabs: state.activeTabs,
      counts: state.counts,
      contentScroll: state.contentScroll,
      measured: snapshot.elements.map(element => element.selector),
      expectedMeasured: selectors.length,
      art: { count: art.elements.length, min: spec.artMin, kinds: summarizeKinds(art.elements) },
      failures: pageFailures,
      evidence,
      results,
      consoleErrors: newErrors,
      snapshot,
      artSnapshot: art,
    });
    console.log(
      (ok ? 'PASS ' : 'FAIL ') + label +
      `  elements=${snapshot.elements.length}/${selectors.length}` +
      ` active=${state.activeTabs.join('|') || 'none'}` +
      ` required=${Object.keys(required).length}` +
      ` art=${art.elements.length}` +
      (ok ? '' : `  failures=${pageFailures.length}`)
    );
    if (!ok) {
      for (const item of pageFailures) console.log('  ' + item.reason);
      failures.push({ kind: 'page', page, failures: pageFailures, evidence, results, snapshot, artSnapshot: art, consoleErrors: newErrors });
      await session.shot(`failure-${name}-${page}.png`).catch(() => {});
    }
    coverage.pages.push({
      page,
      ok: evidence.length === 0,
      measured: snapshot.elements.length,
      expectedMeasured: selectors.length,
      required: Object.keys(required).length,
      art: art.elements.length,
      active: state.activeTabs,
      problems: evidence.map(item => item.reason),
    });
    coverage.pageChecks += 1;
    coverage.totalMeasured += snapshot.elements.length;
    coverage.totalRequired += Object.keys(required).length;
    // 抽样截图与任务 6 口径一致：每档「家园 + 一张旧玩法页」，两屏。
    if (page === 'home' || page === shotPage) {
      await session.shot(path.join(name, `${page}.png`)).catch(error => {
        console.log(`  (截图跳过 ${name}/${page}: ${error.message})`);
      });
    }
  }
  return coverage;
}

// 每档检查总数：6 页、每页固定 required 数与测量元素数；漏页/漏选择器必须报红。
function checkCoverage(name, coverage) {
  const problems = [];
  if (coverage.pageChecks !== PAGES.length) problems.push(`页面检查 ${coverage.pageChecks} ≠ ${PAGES.length}`);
  if (coverage.pages.length !== PAGES.length) problems.push(`覆盖页数 ${coverage.pages.length} ≠ ${PAGES.length}`);
  if (coverage.totalMeasured !== coverage.expectedTotal) {
    problems.push(`测量元素总数 ${coverage.totalMeasured} ≠ ${coverage.expectedTotal}`);
  }
  if (coverage.totalRequired !== coverage.expectedRequired) {
    problems.push(`required 总数 ${coverage.totalRequired} ≠ ${coverage.expectedRequired}`);
  }
  for (const page of coverage.pages) {
    if (!page.ok) problems.push(`${page.page}: ${page.problems.join('；')}`);
  }
  const ok = problems.length === 0;
  check(`page coverage ${name}`, ok, { ...coverage, problems });
  console.log(
    (ok ? 'PASS ' : 'FAIL ') + `page coverage ${name}` +
    `  pages=${coverage.pages.length}/${PAGES.length}` +
    ` elements=${coverage.totalMeasured}/${coverage.expectedTotal}` +
    ` required=${coverage.totalRequired}/${coverage.expectedRequired}`
  );
  if (!ok) for (const line of problems) console.log('  ' + line);
  return ok;
}

// ---------------------------------------------------------------------------
// 任务 7：家园四个弹层态 + 旧玩法五交互。
// 选择器全部来自 2026-10-31 的真实 DOM 探针（记录见 task-7-report.md）：
//   建造栏   .home-tools [data-lw="panel"][data-panel="build"] → .home-panel.home-build-panel
//   设施环形 [data-home-object]（可点中自身的已放置设施）      → .home-orbit
//   植物面板 .home-tools [data-lw="panel"][data-panel="plants"] → .home-panel[aria-label="种子与育种"]
//   研究面板 .home-tools [data-lw="panel"][data-panel="tech"]  → .home-panel.home-tech-panel
// 滚动面板只把「容器 / header / 滚动容器 / 关闭按钮」纳入安全区与视口断言：
// 货架和长列表本来就会在滚动容器内延伸，不能把正常滚动当成越界。
// ---------------------------------------------------------------------------

function overlaySelectors(spec) {
  return [...new Set([spec.container, ...(spec.safe || []), ...(spec.controls || []), ...(spec.scroll || [])])];
}

const BUILD_OVERLAY = {
  key: 'build',
  open: '.home-tools [data-lw="panel"][data-panel="build"]',
  container: '.home-panel.home-build-panel',
  close: '.home-panel.home-build-panel [data-lw="close"]',
  controls: [
    '.home-panel.home-build-panel [data-lw="close"]',
    '.home-panel.home-build-panel [data-lw="category"]',
  ],
  scroll: ['.home-panel.home-build-panel .home-panel-body'],
};
BUILD_OVERLAY.safe = [
  BUILD_OVERLAY.container,
  `${BUILD_OVERLAY.container} header`,
  `${BUILD_OVERLAY.container} .home-panel-body`,
  BUILD_OVERLAY.close,
];

const PLANTS_OVERLAY = {
  key: 'plants',
  open: '.home-tools [data-lw="panel"][data-panel="plants"]',
  container: '.home-panel[aria-label="种子与育种"]',
  close: '.home-panel[aria-label="种子与育种"] [data-lw="close"]',
  controls: [
    '.home-panel[aria-label="种子与育种"] [data-lw="close"]',
    '.home-panel[aria-label="种子与育种"] [data-lw="family"]',
  ],
  scroll: ['.home-panel[aria-label="种子与育种"] .home-panel-body'],
};
PLANTS_OVERLAY.safe = [
  PLANTS_OVERLAY.container,
  `${PLANTS_OVERLAY.container} header`,
  `${PLANTS_OVERLAY.container} .home-panel-body`,
  PLANTS_OVERLAY.close,
];

const TECH_OVERLAY = {
  key: 'research',
  open: '.home-tools [data-lw="panel"][data-panel="tech"]',
  container: '.home-panel.home-tech-panel',
  close: '.home-panel.home-tech-panel [data-lw="close"]',
  controls: [
    '.home-panel.home-tech-panel [data-lw="close"]',
    '.home-panel.home-tech-panel [data-lw="branch"]',
  ],
  scroll: ['.home-panel.home-tech-panel .home-panel-body'],
};
TECH_OVERLAY.safe = [
  TECH_OVERLAY.container,
  `${TECH_OVERLAY.container} header`,
  `${TECH_OVERLAY.container} .home-panel-body`,
  TECH_OVERLAY.close,
];

const ORBIT_OVERLAY = {
  key: 'facility',
  pickFacility: true,
  container: '.home-orbit',
  close: '.home-selection-close [data-lw="close"]',
  controls: [
    '.home-orbit [data-lw="use"]',
    '.home-orbit [data-lw="upgrade-view"]',
    '.home-orbit [data-lw="move"]',
    '.home-orbit [data-lw="manage-open"]',
    '.home-selection-close [data-lw="close"]',
  ],
  scroll: [],
};
ORBIT_OVERLAY.safe = [
  ORBIT_OVERLAY.container,
  '.home-orbit .home-selection-label',
  ...ORBIT_OVERLAY.controls,
];

function formatRect(rect) {
  return `${Math.round(rect.left)},${Math.round(rect.top)} ${Math.round(rect.width)}×${Math.round(rect.height)}`;
}

function outsideViewport(rect, viewport) {
  return rect.left < -0.5 || rect.top < -0.5
    || rect.right > viewport.width + 0.5 || rect.bottom > viewport.height + 0.5;
}

// measure 对缺失选择器直接跳过，safeAreaFailures 对零面积元素也跳过；
// 所以 spec.safe 也要像 spec.controls 一样显式检查「存在 + 有面积」，缺一即 FAIL。
function presenceProblems(bySelector, selectors, label) {
  const missing = [];
  const zero = [];
  let present = 0;
  for (const selector of selectors) {
    const element = bySelector.get(selector);
    if (!element) {
      missing.push(selector);
      continue;
    }
    const rect = element.rect;
    if (!(rect.width > 0 && rect.height > 0)) {
      zero.push(`${selector} ${rect.width}×${rect.height}`);
      continue;
    }
    present += 1;
  }
  const problems = [];
  if (missing.length) problems.push(`缺少${label}：${missing.join(', ')}`);
  if (zero.length) problems.push(`${label}尺寸为 0：${zero.join(', ')}`);
  return { problems, present };
}

// 必须可点的控件：存在、有面积之外，矩形要在视口内，中心点要有真实命中证据。
// occlusionFailures 对 hitSelector=null 直接跳过，这里把「不可命中」补成显式失败。
function clickabilityProblems(bySelector, selectors, viewport) {
  const { problems } = presenceProblems(bySelector, selectors, '可点控件');
  const outside = [];
  const unhittable = [];
  let checked = 0;
  for (const selector of selectors) {
    const element = bySelector.get(selector);
    if (!element) continue;
    const rect = element.rect;
    if (!(rect.width > 0 && rect.height > 0)) continue;
    if (outsideViewport(rect, viewport)) outside.push(`${selector} ${formatRect(rect)}`);
    if (!element.hitSelector) {
      unhittable.push(`${selector} 中心点没有命中任何元素`);
    } else {
      checked += 1;
    }
  }
  if (outside.length) problems.push(`可点控件越出视口：${outside.join(', ')}`);
  if (unhittable.length) problems.push(`可点控件中心点不可命中：${unhittable.join(', ')}`);
  return { problems, checked };
}

// 已放置设施：中心点确实命中它自己（不选被顶栏、底栏或另一个 SVG 物件盖住的目标）。
async function pickFacility(session) {
  return session.ev(`(() => {
    for (const el of document.querySelectorAll('[data-home-object]')) {
      const r = el.getBoundingClientRect();
      if (!(r.width > 40 && r.height > 40)) continue;
      if (r.left < 8 || r.top < 8 || r.right > innerWidth - 8 || r.bottom > innerHeight - 8) continue;
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (!hit || !el.contains(hit)) continue;
      return { id: el.dataset.homeObject, name: el.getAttribute('aria-label') || '', rect: { left: r.left, top: r.top, width: r.width, height: r.height } };
    }
    return null;
  })()`);
}

// 单个弹层态：打开 → 遮挡 / 安全区 / 容器视口 / 滚动容器 → 关闭 → console 增量。
async function checkHomeOverlay(session, name, spec, target, failures) {
  const label = `overlay ${name}/${spec.key}`;
  const startErrors = session.consoleErrors.length;
  const problems = [];
  let snapshot = null;
  let containerRect = null;
  let detailCounts = null;
  try {
    if (spec.pickFacility) {
      if (!target) problems.push('没有可点击的已放置设施');
      else await session.tap(`[data-home-object="${target.id}"]`);
    } else {
      await session.tap(spec.open);
    }
    if (!spec.pickFacility || target) {
      snapshot = await measure(session, overlaySelectors(spec));
      const bySelector = new Map(snapshot.elements.map(element => [element.selector, element]));
      const container = bySelector.get(spec.container);
      if (!container) {
        problems.push(`缺少弹层容器 ${spec.container}`);
      } else {
        containerRect = container.rect;
        if (!(containerRect.width > 0 && containerRect.height > 0)) {
          problems.push(`弹层尺寸无效 ${containerRect.width}×${containerRect.height}`);
        }
        if (outsideViewport(containerRect, snapshot.viewport)) {
          problems.push(`弹层越出视口 ${formatRect(containerRect)} / ${snapshot.viewport.width}×${snapshot.viewport.height}`);
        }
      }
      for (const selector of spec.scroll) {
        const element = bySelector.get(selector);
        if (!element) {
          problems.push(`缺少滚动容器 ${selector}`);
          continue;
        }
        if (outsideViewport(element.rect, snapshot.viewport)) {
          problems.push(`滚动容器越界 ${formatRect(element.rect)}`);
        }
        if (!(element.clientHeight > 0)) problems.push('滚动容器高度为 0');
      }
      for (const failure of safeAreaFailures(pick(snapshot, spec.safe))) problems.push(`安全区：${failure.reason}`);
      const safePresence = presenceProblems(bySelector, spec.safe, '安全区元素');
      problems.push(...safePresence.problems);
      const controlCheck = clickabilityProblems(bySelector, spec.controls, snapshot.viewport);
      problems.push(...controlCheck.problems);
      const controls = pick(snapshot, spec.controls);
      for (const failure of occlusionFailures(controls)) problems.push(`遮挡：${failure.reason}`);
      detailCounts = {
        safePresent: safePresence.present,
        safeExpected: spec.safe.length,
        controlChecked: controlCheck.checked,
        controlExpected: spec.controls.length,
      };
    }
  } catch (error) {
    problems.push(`打开或测量失败：${(error && error.message) || String(error)}`);
  }
  const wasOpen = !!snapshot && snapshot.elements.some(element => element.selector === spec.container);
  if (wasOpen) {
    try {
      await session.tap(spec.close);
    } catch (error) {
      problems.push(`关闭失败：${(error && error.message) || String(error)}`);
    }
    let after = null;
    try {
      after = await session.ev(`(() => ({
        container: !!document.querySelector(${JSON.stringify(spec.container)}),
        panels: document.querySelectorAll('.home-panel').length,
        orbits: document.querySelectorAll('.home-orbit').length,
        world: !!document.querySelector('.home-world'),
      }))()`);
    } catch (error) {
      problems.push(`关闭后读取失败：${(error && error.message) || String(error)}`);
    }
    if (!after) {
      problems.push('关闭后无法读取家园状态');
    } else {
      if (after.container || after.panels || after.orbits) {
        problems.push(`关闭后弹层仍然存在：panel=${after.panels} orbit=${after.orbits}`);
      }
      if (!after.world) problems.push('关闭后家园界面消失');
    }
    if (!after || after.container) {
      await session.ev(`(() => { const el = document.querySelector(${JSON.stringify(spec.close)}); if (el) el.click(); return true; })()`).catch(() => {});
    }
  }
  const newErrors = session.consoleErrors.slice(startErrors);
  for (const message of newErrors) problems.push(`console：${message}`);
  const ok = problems.length === 0;
  const detail = {
    profile: name,
    overlay: spec.key,
    target: target ? { id: target.id, name: target.name } : null,
    container: spec.container,
    containerRect,
    controls: spec.controls,
    safe: spec.safe,
    measured: snapshot ? snapshot.elements.map(element => element.selector) : [],
    counts: detailCounts,
    snapshot,
    problems,
    consoleErrors: newErrors,
  };
  check(label, ok, detail);
  console.log(
    (ok ? 'PASS ' : 'FAIL ') + label +
    `  container=${containerRect ? formatRect(containerRect) : 'none'}` +
    ` controls=${detailCounts ? `${detailCounts.controlChecked}/${detailCounts.controlExpected}` : `0/${spec.controls.length}`}` +
    ` safe=${detailCounts ? `${detailCounts.safePresent}/${detailCounts.safeExpected}` : `0/${spec.safe.length}`}` +
    ` errors=${newErrors.length}` +
    (ok ? '' : `  problems=${problems.length}`)
  );
  if (!ok) {
    for (const line of problems) console.log('  ' + line);
    failures.push({ kind: 'overlay', profile: name, ...detail });
    writeFailure(`${name}-overlay-${spec.key}`, detail);
    await session.shot(`failure-${name}-overlay-${spec.key}.png`).catch(() => {});
  }
  return ok;
}

async function checkHomeOverlays(session, name, failures) {
  await session.ev(`switchTab('home')`);
  await session.frame();
  const target = await pickFacility(session);
  await checkHomeOverlay(session, name, BUILD_OVERLAY, null, failures);
  await checkHomeOverlay(session, name, ORBIT_OVERLAY, target, failures);
  await checkHomeOverlay(session, name, PLANTS_OVERLAY, null, failures);
  await checkHomeOverlay(session, name, TECH_OVERLAY, null, failures);
}

// 旧玩法：在真实点击坐标上发鼠标事件，绕开 SVG/战斗单位被容器裁剪后「几何中心不可点」的情况。
async function tapClientPoint(session, point) {
  await session.client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await session.client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await session.frame();
}

// 空间里的真实史莱姆：先滚入视口，再在元素矩形内找一个真正命中它的点。
// 系统史莱姆会盖在真实史莱姆上方，按中心点点击会错误地落到系统史莱姆（无法开局）。
async function pickPlaygroundSlime(session) {
  return session.ev(`(() => {
    const candidates = [...document.querySelectorAll('.pl-slime')].filter(el => el.dataset.id && el.dataset.id !== '__sys__');
    for (const el of candidates) {
      el.scrollIntoView({ block: 'center', inline: 'nearest' });
      const r = el.getBoundingClientRect();
      for (let fy = 0.85; fy >= 0.15; fy -= 0.1) {
        for (let fx = 0.85; fx >= 0.15; fx -= 0.1) {
          const x = r.left + r.width * fx;
          const y = r.top + r.height * fy;
          if (x < 1 || y < 1 || x > innerWidth - 1 || y > innerHeight - 1) continue;
          const hit = document.elementFromPoint(x, y);
          if (hit && (hit === el || el.contains(hit))) return { id: el.dataset.id, x, y };
        }
      }
    }
    return null;
  })()`);
}

// 战斗敌方单位：横屏时战斗行较短，单位上半部被 .battle-field 裁剪，中心点命中不到。
async function pickBattleEnemyPoint(session) {
  return session.ev(`(() => {
    const unit = document.querySelector('.battle-row.enemy .battle-unit');
    if (!unit) return null;
    const r = unit.getBoundingClientRect();
    for (let fy = 0.9; fy >= 0.15; fy -= 0.05) {
      const x = r.left + r.width / 2;
      const y = r.top + r.height * fy;
      if (x < 1 || y < 1 || x > innerWidth - 1 || y > innerHeight - 1) continue;
      const hit = document.elementFromPoint(x, y);
      if (hit && (hit === unit || unit.contains(hit))) return { x, y };
    }
    return null;
  })()`);
}

async function forceCloseGameOverlay(session) {
  await session.ev(`(() => { const button = document.getElementById('gClose') || document.getElementById('bClose'); if (button) button.click(); return !document.getElementById('gameOverlay'); })()`).catch(() => {});
}

function pushConsoleProblems(problems, session, startErrors) {
  const list = session.consoleErrors.slice(startErrors);
  for (const message of list) problems.push(`console：${message}`);
  return list;
}

async function checkBallInteraction(session, name, setup, failures) {
  const label = `legacy ${name}/ball click`;
  const startErrors = session.consoleErrors.length;
  const problems = [];
  const detail = { profile: name, setup };
  try {
    if (!(setup.slimes > 0)) problems.push('空间中没有可用史莱姆');
    await session.tap('.toy-btn[data-toy="ball"]');
    detail.selected = await session.ev(`(() => {
      const button = document.querySelector('.toy-btn[data-toy="ball"]');
      return { on: !!button && button.classList.contains('on'), hint: (document.querySelector('.toy-hint') || {}).textContent || '' };
    })()`);
    if (!detail.selected.on) problems.push('选择扔皮球后按钮没有进入选中态');
    if (!problems.length) {
      detail.target = await pickPlaygroundSlime(session);
      if (!detail.target) {
        problems.push('空间里没有可点击的真实史莱姆');
      } else {
        await tapClientPoint(session, detail.target);
        detail.opened = await session.ev(`(() => {
          const overlay = document.getElementById('gameOverlay');
          const ball = document.getElementById('gameBall');
          return {
            overlay: !!overlay,
            field: !!(overlay && overlay.querySelector('.game-field')),
            ball: ball ? { left: ball.style.left, top: ball.style.top } : null,
            close: !!document.getElementById('gClose'),
          };
        })()`);
        if (!detail.opened.overlay || !detail.opened.field || !detail.opened.ball || !detail.opened.close) {
          problems.push('点击史莱姆后接球浮层不完整');
        } else {
          await session.tap('#gameBall');
          detail.thrown = await session.ev(`(() => {
            const ball = document.getElementById('gameBall');
            return ball ? { left: ball.style.left, top: ball.style.top } : null;
          })()`);
          const moved = !!detail.thrown
            && (detail.thrown.left !== detail.opened.ball.left || detail.thrown.top !== detail.opened.ball.top);
          if (!moved) problems.push('点击皮球后位置没有变化');
          await session.tap('#gClose');
          detail.closed = await session.ev(`!document.getElementById('gameOverlay')`);
          if (!detail.closed) problems.push('退出后接球浮层仍然存在');
        }
      }
    }
  } catch (error) {
    problems.push(`接球交互失败：${(error && error.message) || String(error)}`);
  }
  if (await session.ev(`!!document.getElementById('gameOverlay')`).catch(() => false)) await forceCloseGameOverlay(session);
  detail.consoleErrors = pushConsoleProblems(problems, session, startErrors);
  const ok = problems.length === 0;
  detail.problems = problems;
  check(label, ok, detail);
  console.log(
    (ok ? 'PASS ' : 'FAIL ') + label +
    `  target=${detail.target ? detail.target.id : 'none'}` +
    ` moved=${detail.thrown ? `${detail.thrown.left}/${detail.thrown.top}` : 'none'}` +
    ` closed=${detail.closed === true}` +
    ` errors=${detail.consoleErrors.length}` +
    (ok ? '' : `  problems=${problems.length}`)
  );
  if (!ok) {
    for (const line of problems) console.log('  ' + line);
    failures.push({ kind: 'legacy-ball', profile: name, ...detail });
    writeFailure(`${name}-legacy-ball`, detail);
    await session.shot(`failure-${name}-legacy-ball.png`).catch(() => {});
  }
}

async function checkStackInteraction(session, name, failures) {
  const label = `legacy ${name}/stack switch`;
  const startErrors = session.consoleErrors.length;
  const problems = [];
  const detail = { profile: name };
  try {
    await session.tap('.toy-btn[data-toy="stack"]');
    detail.opened = await session.ev(`(() => {
      const overlay = document.getElementById('gameOverlay');
      const field = document.getElementById('gameField');
      return {
        overlay: !!overlay,
        field: !!field,
        close: !!document.getElementById('gClose'),
        count: (document.getElementById('gCount') || {}).textContent,
      };
    })()`);
    if (!detail.opened.overlay || !detail.opened.field || !detail.opened.close) {
      problems.push('点击叠叠乐后没有打开堆叠玩法');
    } else {
      detail.spawn = await session.ev(`new Promise(resolve => {
        const start = performance.now();
        const read = () => {
          const field = document.getElementById('gameField');
          if (!field) return resolve({ count: 0, tops: [] });
          const list = [...field.querySelectorAll(':scope > div')].filter(el => el.style && /px$/.test(el.style.top || ''));
          if (list.length) return resolve({ count: list.length, tops: list.map(el => el.style.top) });
          if (performance.now() - start > 1500) return resolve({ count: 0, tops: [] });
          setTimeout(read, 40);
        };
        read();
      })`);
      if (!detail.spawn.count) {
        problems.push('叠叠乐没有生成下落块');
      } else {
        await session.tap('#gameField');
        detail.after = await session.ev(`(() => {
          const field = document.getElementById('gameField');
          return [...field.querySelectorAll(':scope > div')]
            .filter(el => el.style && /px$/.test(el.style.top || ''))
            .map(el => el.style.top);
        })()`);
        const before = detail.spawn.tops.map(parseFloat);
        const after = detail.after.map(parseFloat);
        const dropped = before.some((value, index) => Number.isFinite(value) && Number.isFinite(after[index]) && after[index] > value + 0.5);
        if (!dropped) problems.push('点击游戏区域后叠叠乐没有下落');
        await session.tap('#gClose');
        detail.closed = await session.ev(`!document.getElementById('gameOverlay')`);
        if (!detail.closed) problems.push('退出后堆叠浮层仍然存在');
      }
    }
  } catch (error) {
    problems.push(`叠叠乐交互失败：${(error && error.message) || String(error)}`);
  }
  if (await session.ev(`!!document.getElementById('gameOverlay')`).catch(() => false)) await forceCloseGameOverlay(session);
  detail.consoleErrors = pushConsoleProblems(problems, session, startErrors);
  const ok = problems.length === 0;
  detail.problems = problems;
  check(label, ok, detail);
  console.log(
    (ok ? 'PASS ' : 'FAIL ') + label +
    `  blocks=${detail.spawn ? detail.spawn.count : 0}` +
    ` dropped=${(detail.spawn && detail.after) ? detail.after.join('→') : 'none'}` +
    ` closed=${detail.closed === true}` +
    ` errors=${detail.consoleErrors.length}` +
    (ok ? '' : `  problems=${problems.length}`)
  );
  if (!ok) {
    for (const line of problems) console.log('  ' + line);
    failures.push({ kind: 'legacy-stack', profile: name, ...detail });
    writeFailure(`${name}-legacy-stack`, detail);
    await session.shot(`failure-${name}-legacy-stack.png`).catch(() => {});
  }
}

// 战斗：手动一次普攻 → 切换自动 → 撤退（结束态）→ 关闭浮层。
// 三个交互分别计 console 增量；打开失败时三条都判红，避免只有入口失败却伪装通过。
async function checkBattleInteractions(session, name, failures) {
  const manualLabel = `legacy ${name}/battle manual`;
  const manualErrors = session.consoleErrors.length;
  const manualProblems = [];
  const manualDetail = { profile: name };
  let opened = null;
  try {
    await session.ev(`switchTab('status')`);
    await session.frame();
    const collapsed = await session.ev(`(() => { const body = document.getElementById('challengeBody'); return !!body && body.classList.contains('hidden'); })()`);
    if (collapsed) await session.tap('[data-act="toggleCollapse"][data-target="challengeBody"]');
    await session.tap('[data-act="challengeStart"][data-id="shield"]');
    opened = await session.ev(`(() => {
      const overlay = document.getElementById('gameOverlay');
      return {
        overlay: !!overlay,
        field: !!(overlay && overlay.querySelector('.battle-field')),
        mode: (overlay && overlay.querySelector('.sk-mode')) ? overlay.querySelector('.sk-mode').textContent : null,
        close: !!document.getElementById('bClose'),
        enemies: overlay ? overlay.querySelectorAll('.battle-row.enemy .battle-unit').length : 0,
        allies: overlay ? overlay.querySelectorAll('.battle-row.ally .battle-unit').length : 0,
      };
    })()`);
    manualDetail.opened = opened;
    if (!opened.overlay) manualProblems.push('点击战斗课堂练习后没有打开战斗浮层');
    else if (!opened.field || opened.enemies < 1 || opened.allies < 1) manualProblems.push('战斗浮层缺少战斗区或单位');
    else if (opened.mode !== '手动') manualProblems.push(`战斗初始模式是 ${opened.mode}，应为手动`);
    if (!manualProblems.length) {
      manualDetail.ready = await session.ev(`new Promise(resolve => {
        const start = performance.now();
        const read = () => {
          const bar = document.getElementById('skillBar');
          if (bar && bar.querySelector('.sk-act')) {
            return resolve({ ok: true, log: (document.getElementById('battleLog') || {}).textContent });
          }
          if (performance.now() - start > 6000) {
            return resolve({ ok: false, log: (document.getElementById('battleLog') || {}).textContent });
          }
          setTimeout(read, 50);
        };
        read();
      })`);
      if (!manualDetail.ready.ok) {
        manualProblems.push('6 秒内没有进入手动操作回合');
      } else {
        manualDetail.point = await pickBattleEnemyPoint(session);
        if (!manualDetail.point) {
          manualProblems.push('敌方单位没有可点击的可见区域');
        } else {
          await tapClientPoint(session, manualDetail.point);
          manualDetail.result = await session.ev(`new Promise(resolve => {
            const start = performance.now();
            const read = () => {
              const log = (document.getElementById('battleLog') || {}).textContent || '';
              if (/伤害|护盾|闪避/.test(log) && !/轮到/.test(log)) return resolve({ ok: true, log });
              if (performance.now() - start > 3000) return resolve({ ok: false, log });
              setTimeout(read, 50);
            };
            read();
          })`);
          if (!manualDetail.result.ok) manualProblems.push(`手动普攻没有产生战斗日志：${manualDetail.result.log}`);
        }
      }
    }
  } catch (error) {
    manualProblems.push(`手动战斗交互失败：${(error && error.message) || String(error)}`);
  }
  manualDetail.consoleErrors = pushConsoleProblems(manualProblems, session, manualErrors);
  const manualOk = manualProblems.length === 0;
  manualDetail.problems = manualProblems;
  check(manualLabel, manualOk, manualDetail);
  console.log(
    (manualOk ? 'PASS ' : 'FAIL ') + manualLabel +
    `  mode=${opened ? opened.mode : 'none'}` +
    ` ready=${manualDetail.ready ? manualDetail.ready.ok : false}` +
    ` log=${manualDetail.result ? manualDetail.result.log : 'none'}` +
    ` errors=${manualDetail.consoleErrors.length}` +
    (manualOk ? '' : `  problems=${manualProblems.length}`)
  );
  if (!manualOk) {
    for (const line of manualProblems) console.log('  ' + line);
    failures.push({ kind: 'legacy-battle-manual', profile: name, ...manualDetail });
    writeFailure(`${name}-legacy-battle-manual`, manualDetail);
    await session.shot(`failure-${name}-legacy-battle-manual.png`).catch(() => {});
  }

  // 自动
  const autoLabel = `legacy ${name}/battle auto`;
  const autoErrors = session.consoleErrors.length;
  const autoProblems = [];
  const autoDetail = { profile: name };
  try {
    if (!opened || !opened.overlay) {
      autoProblems.push('战斗没有打开，无法切换自动');
    } else {
      await session.tap('.sk-mode');
      autoDetail.state = await session.ev(`({
        mode: (document.querySelector('.sk-mode') || {}).textContent,
        log: (document.getElementById('battleLog') || {}).textContent,
      })`);
      if (autoDetail.state.mode !== '自动') autoProblems.push(`切换后模式是 ${autoDetail.state.mode}，应为自动`);
      if (manualOk && !/切换为「自动」/.test(autoDetail.state.log || '')) autoProblems.push('切换自动后没有战斗日志');
    }
  } catch (error) {
    autoProblems.push(`自动战斗交互失败：${(error && error.message) || String(error)}`);
  }
  autoDetail.consoleErrors = pushConsoleProblems(autoProblems, session, autoErrors);
  const autoOk = autoProblems.length === 0;
  autoDetail.problems = autoProblems;
  check(autoLabel, autoOk, autoDetail);
  console.log(
    (autoOk ? 'PASS ' : 'FAIL ') + autoLabel +
    `  mode=${autoDetail.state ? autoDetail.state.mode : 'none'}` +
    ` errors=${autoDetail.consoleErrors.length}` +
    (autoOk ? '' : `  problems=${autoProblems.length}`)
  );
  if (!autoOk) {
    for (const line of autoProblems) console.log('  ' + line);
    failures.push({ kind: 'legacy-battle-auto', profile: name, ...autoDetail });
    writeFailure(`${name}-legacy-battle-auto`, autoDetail);
    await session.shot(`failure-${name}-legacy-battle-auto.png`).catch(() => {});
  }

  // 撤退
  const retreatLabel = `legacy ${name}/battle retreat`;
  const retreatErrors = session.consoleErrors.length;
  const retreatProblems = [];
  const retreatDetail = { profile: name };
  try {
    if (!opened || !opened.overlay) {
      retreatProblems.push('战斗没有打开，无法撤退');
    } else {
      await session.tap('#bClose');
      retreatDetail.ended = await session.ev(`(() => {
        const overlay = document.getElementById('gameOverlay');
        const button = document.getElementById('bClose');
        return {
          overlay: !!overlay,
          closeText: button ? button.textContent : null,
          log: (document.getElementById('battleLog') || {}).textContent,
        };
      })()`);
      if (!retreatDetail.ended.overlay) {
        retreatProblems.push('撤退后战斗浮层立即消失，未经过结束态');
      } else {
        if (retreatDetail.ended.closeText !== '关 闭') {
          retreatProblems.push(`撤退后按钮文本是 ${retreatDetail.ended.closeText}，应为关闭`);
        }
        if (!/战斗结束/.test(retreatDetail.ended.log || '')) retreatProblems.push('撤退后没有战斗结束日志');
        await session.tap('#bClose');
        retreatDetail.closed = await session.ev(`!document.getElementById('gameOverlay')`);
        if (!retreatDetail.closed) retreatProblems.push('点击关闭后战斗浮层仍然存在');
      }
    }
  } catch (error) {
    retreatProblems.push(`撤退交互失败：${(error && error.message) || String(error)}`);
  }
  if (await session.ev(`!!document.getElementById('gameOverlay')`).catch(() => false)) await forceCloseGameOverlay(session);
  retreatDetail.consoleErrors = pushConsoleProblems(retreatProblems, session, retreatErrors);
  const retreatOk = retreatProblems.length === 0;
  retreatDetail.problems = retreatProblems;
  check(retreatLabel, retreatOk, retreatDetail);
  console.log(
    (retreatOk ? 'PASS ' : 'FAIL ') + retreatLabel +
    `  ended=${retreatDetail.ended ? retreatDetail.ended.closeText : 'none'}` +
    ` closed=${retreatDetail.closed === true}` +
    ` errors=${retreatDetail.consoleErrors.length}` +
    (retreatOk ? '' : `  problems=${retreatProblems.length}`)
  );
  if (!retreatOk) {
    for (const line of retreatProblems) console.log('  ' + line);
    failures.push({ kind: 'legacy-battle-retreat', profile: name, ...retreatDetail });
    writeFailure(`${name}-legacy-battle-retreat`, retreatDetail);
    await session.shot(`failure-${name}-legacy-battle-retreat.png`).catch(() => {});
  }
}

async function checkLegacyInteractions(session, name, failures) {
  const setup = await session.ev(`(() => {
    if (S.slimes.length === 0 && typeof createSlime === 'function') {
      S.slimes.push(createSlime(false));
      save();
    }
    switchTab('space');
    return { slimes: S.slimes.length, tab: typeof activeTab === 'string' ? activeTab : '' };
  })()`).catch(error => ({ slimes: 0, tab: '', error: (error && error.message) || String(error) }));
  await session.frame();
  await checkBallInteraction(session, name, setup, failures);
  await checkStackInteraction(session, name, failures);
  await checkBattleInteractions(session, name, failures);
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
    const coverage = await checkPages(session, name, index, failures);
    if (!checkCoverage(name, coverage)) failures.push({ kind: 'coverage', profile: name, ...coverage });
    if (OVERLAY_PROFILES.has(name)) await checkHomeOverlays(session, name, failures);
    await checkLegacyInteractions(session, name, failures);
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
    const hudSelectors = PAGE_SPEC.home.hud;
    const selectors = [...hudSelectors, '.smoke-occluder'];

    const before = await measure(session, hudSelectors);
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

    const detected = redOverlap.length > 0 && redOcclusion.length > 0;
    const restored = greenOverlap.length === 0 && greenOcclusion.length === 0;
    const cleanStart = beforeOverlap.length === 0 && beforeOcclusion.length === 0;
    const ok = cleanStart && detected && restored;
    const mismatches = [];
    if (!cleanStart) mismatches.push(`基线未全绿 overlap=${beforeOverlap.length} occlusion=${beforeOcclusion.length}`);
    if (!detected) mismatches.push(`遮挡未报红 overlap=${redOverlap.length} occlusion=${redOcclusion.length}`);
    if (!restored) mismatches.push(`移除后未恢复 overlap=${greenOverlap.length} occlusion=${greenOcclusion.length}`);
    const detail = {
      profile: 'iphone-14',
      occluder: blocked,
      before: { overlap: beforeOverlap, occlusion: beforeOcclusion },
      red: { overlap: redOverlap, occlusion: redOcclusion },
      green: { overlap: greenOverlap, occlusion: greenOcclusion },
      mismatches,
    };
    check(label, ok, detail);
    console.log(`LIVENESS before overlap=${beforeOverlap.length} occlusion=${beforeOcclusion.length}`);
    console.log(`LIVENESS red    overlap=${redOverlap.length} occlusion=${redOcclusion.length}  ` +
      redOverlap.map(item => `${item.a}×${item.b}`).join(','));
    console.log(`LIVENESS green  overlap=${greenOverlap.length} occlusion=${greenOcclusion.length}`);
    if (!ok) {
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
