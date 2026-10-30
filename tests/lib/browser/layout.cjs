// 布局几何断言：纯函数只吃快照，measure/assertAll 是唯一的浏览器入口。
// 这里不做像素基线，只判断溢出、压盖、比例、命中区、安全区与中心点可点性。
'use strict';

// 白名单里的 ['*', x] 表示该选择器是背景层，允许被任何 HUD 覆盖；
// HUD 之间的压盖仍然会报出来。遮罩造成的不可点由 occlusionFailures 判定。
const WHITELIST = [
  ['.map', '*'],
  ['.home-map', '*'],
];

const ZERO_SAFE_AREA = () => ({ top: 0, right: 0, bottom: 0, left: 0 });

function safeAreaOf(snapshot) {
  return snapshot.safeArea || ZERO_SAFE_AREA();
}

function isFiniteRect(rect) {
  return rect && Number.isFinite(rect.left) && Number.isFinite(rect.top) && Number.isFinite(rect.width) && Number.isFinite(rect.height);
}

function hasArea(rect) {
  return isFiniteRect(rect) && rect.width > 0 && rect.height > 0;
}

function pairKey(a, b) {
  return a < b ? a + '\u0000' + b : b + '\u0000' + a;
}

function expandWhitelist(entries) {
  const pairs = new Set();
  const wildcards = new Set();
  for (const entry of entries || []) {
    if (!Array.isArray(entry)) continue;
    const [a, b] = entry;
    if (!a || !b) continue;
    if (a === '*') wildcards.add(b);
    else if (b === '*') wildcards.add(a);
    else pairs.add(pairKey(a, b));
  }
  return { pairs, wildcards };
}

function isWhitelisted(a, b, expanded) {
  return expanded.pairs.has(pairKey(a, b)) || expanded.wildcards.has(a) || expanded.wildcards.has(b);
}

function isRelated(a, b) {
  const pathA = a.path;
  const pathB = b.path;
  if (Array.isArray(pathA) && Array.isArray(pathB) && pathA.length && pathB.length) {
    const [short, long] = pathA.length <= pathB.length ? [pathA, pathB] : [pathB, pathA];
    if (short.length < long.length && short.every((part, i) => part === long[i])) return true;
  }
  const ancestorsA = a.ancestors || [];
  const ancestorsB = b.ancestors || [];
  return ancestorsA.includes(b.selector) || ancestorsB.includes(a.selector);
}

function intersection(a, b) {
  if (!hasArea(a) || !hasArea(b)) return null;
  const left = Math.max(a.left, b.left);
  const right = Math.min(a.right, b.right);
  const top = Math.max(a.top, b.top);
  const bottom = Math.min(a.bottom, b.bottom);
  const x = right - left;
  const y = bottom - top;
  if (x <= 0 || y <= 0) return null;
  return { x, y, overlap: Math.min(x, y), axis: x < y ? 'x' : 'y' };
}

function noOverflow(snapshot) {
  const failures = [];
  const viewport = snapshot.viewport || {};
  if (viewport.scrollWidth > viewport.width + 1) {
    failures.push({
      selector: 'document',
      reason: `横向溢出：scrollWidth ${viewport.scrollWidth} > 视口宽度 ${viewport.width}`,
    });
  }
  for (const element of snapshot.elements || []) {
    const rect = element.rect;
    if (!isFiniteRect(rect)) {
      failures.push({ selector: element.selector, reason: '矩形坐标不是有限数值' });
      continue;
    }
    if (rect.width <= 0 || rect.height <= 0) {
      failures.push({
        selector: element.selector,
        reason: `元素尺寸为 0：${rect.width}×${rect.height}`,
      });
      continue;
    }
    if (rect.left < -1 || rect.top < -1 || rect.right > viewport.width + 1 || rect.bottom > viewport.height + 1) {
      failures.push({
        selector: element.selector,
        reason: `元素越出视口：left ${rect.left}, top ${rect.top}, right ${rect.right}, bottom ${rect.bottom}`,
      });
    }
  }
  return failures;
}

function noOverlap(snapshot, { whitelist, ignore, minOverlap = 1 } = {}) {
  const failures = [];
  const elements = (snapshot.elements || []).filter(element => element && element.selector);
  const ignored = new Set(ignore || []);
  const expanded = expandWhitelist([...WHITELIST, ...(whitelist || [])]);
  for (let i = 0; i < elements.length; i += 1) {
    for (let j = i + 1; j < elements.length; j += 1) {
      const a = elements[i];
      const b = elements[j];
      if (ignored.has(a.selector) || ignored.has(b.selector)) continue;
      if (isRelated(a, b)) continue;
      if (isWhitelisted(a.selector, b.selector, expanded)) continue;
      const hit = intersection(a.rect, b.rect);
      if (!hit || hit.x <= minOverlap || hit.y <= minOverlap) continue;
      failures.push({
        a: a.selector,
        b: b.selector,
        overlap: hit.overlap,
        axis: hit.axis,
        reason: `元素压盖：${a.selector} 与 ${b.selector} 相交 ${hit.overlap}px（${hit.axis} 轴）`,
      });
    }
  }
  return failures;
}

function aspectPreserved(snapshot, { tolerance = 0.02 } = {}) {
  const failures = [];
  for (const element of snapshot.elements || []) {
    const { naturalWidth, naturalHeight, rect } = element;
    if (!naturalWidth || !naturalHeight) continue;
    if (!hasArea(rect)) {
      failures.push({ selector: element.selector, reason: '图片渲染矩形无效' });
      continue;
    }
    const expected = naturalWidth / naturalHeight;
    const actual = rect.width / rect.height;
    const deviation = Math.abs(actual - expected) / expected;
    if (deviation > tolerance) {
      failures.push({
        selector: element.selector,
        reason: `图片比例变形：渲染 ${actual.toFixed(3)}，原图 ${expected.toFixed(3)}，偏差 ${(deviation * 100).toFixed(1)}%`,
        expected,
        actual,
      });
    }
  }
  return failures;
}

function hitTargets(snapshot, { min = 40 } = {}) {
  const failures = [];
  for (const element of snapshot.elements || []) {
    const rect = element.rect;
    if (!hasArea(rect)) continue;
    if (rect.width < min || rect.height < min) {
      failures.push({
        selector: element.selector,
        width: rect.width,
        height: rect.height,
        min,
        reason: `触摸目标过小：${rect.width}×${rect.height} < ${min}×${min}`,
      });
    }
  }
  return failures;
}

function safeAreaFailures(snapshot) {
  const failures = [];
  const viewport = snapshot.viewport || {};
  const safeArea = safeAreaOf(snapshot);
  const minLeft = safeArea.left || 0;
  const minTop = safeArea.top || 0;
  const maxRight = (viewport.width || 0) - (safeArea.right || 0);
  const maxBottom = (viewport.height || 0) - (safeArea.bottom || 0);
  for (const element of snapshot.elements || []) {
    const rect = element.rect;
    if (!hasArea(rect)) continue;
    if (rect.left < minLeft || rect.top < minTop || rect.right > maxRight || rect.bottom > maxBottom) {
      failures.push({
        selector: element.selector,
        rect,
        safeArea,
        reason: `元素进入安全区：left ${rect.left} (≥${minLeft}), top ${rect.top} (≥${minTop}), right ${rect.right} (≤${maxRight}), bottom ${rect.bottom} (≤${maxBottom})`,
      });
    }
  }
  return failures;
}

function occlusionFailures(snapshot) {
  const failures = [];
  for (const element of snapshot.elements || []) {
    if (!element.hitSelector) continue;
    const path = element.hitPath || [];
    if (element.hitSelector === element.selector || path.includes(element.selector)) continue;
    failures.push({
      selector: element.selector,
      hitSelector: element.hitSelector,
      reason: `中心点被 ${element.hitSelector} 遮挡，命中不到 ${element.selector}`,
    });
  }
  return failures;
}

function normalizeSafeArea(safeArea) {
  if (!safeArea) return ZERO_SAFE_AREA();
  return {
    top: safeArea.top ?? 0,
    right: safeArea.right ?? 0,
    bottom: safeArea.bottom ?? 0,
    left: safeArea.left ?? 0,
  };
}

// 浏览器侧入口 1：把 DOM 量成纯数据快照。缺失的选择器直接跳过。
async function measure(session, selectors = []) {
  const expression = `(() => {
    const selectors = ${JSON.stringify(selectors)};
    const ident = el => el.id ? '#' + el.id : (el.classList && el.classList.length ? '.' + el.classList[0] : el.tagName.toLowerCase());
    const pathOf = el => {
      const out = [];
      for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
        out.unshift(n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + (n.classList && n.classList.length ? '.' + [...n.classList].join('.') : ''));
      }
      return out;
    };
    const elements = [];
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      const own = !!hit && (el === hit || el.contains(hit));
      elements.push({
        selector,
        tag: el.tagName.toLowerCase(),
        path: pathOf(el),
        rect: { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height },
        naturalWidth: el.naturalWidth || 0,
        naturalHeight: el.naturalHeight || 0,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        hitSelector: hit ? (own ? selector : ident(hit)) : null,
        hitTag: hit ? hit.tagName.toLowerCase() : null,
        hitPath: hit ? pathOf(hit) : []
      });
    }
    return {
      viewport: {
        width: innerWidth,
        height: innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight
      },
      dpr: devicePixelRatio,
      elements
    };
  })()`;
  const snapshot = await session.ev(expression);
  snapshot.safeArea = normalizeSafeArea(
    (session.profile && session.profile.safeArea) || session.safeArea
  );
  return snapshot;
}

// 浏览器侧入口 2：组合所有断言，失败时带快照抛错。
async function assertAll(session, spec = {}) {
  const {
    selectors = [],
    whitelist,
    ignore,
    min = 40,
    tolerance = 0.02,
  } = spec;
  const snapshot = await measure(session, selectors);
  const failures = [
    ...noOverflow(snapshot).map(f => ({ check: 'overflow', ...f })),
    ...(spec.overlap === false ? [] : noOverlap(snapshot, { whitelist, ignore }).map(f => ({ check: 'overlap', ...f }))),
    ...(spec.aspect === false ? [] : aspectPreserved(snapshot, { tolerance }).map(f => ({ check: 'aspect', ...f }))),
    ...(spec.hit === false ? [] : hitTargets(snapshot, { min }).map(f => ({ check: 'hit', ...f }))),
    ...(spec.occlusion === false ? [] : occlusionFailures(snapshot).map(f => ({ check: 'occlusion', ...f }))),
    ...(spec.safeArea === false ? [] : safeAreaFailures(snapshot).map(f => ({ check: 'safeArea', ...f }))),
  ];
  if (failures.length) {
    const error = new Error('布局断言失败: ' + JSON.stringify(failures, null, 2));
    error.failures = failures;
    error.snapshot = snapshot;
    throw error;
  }
  return snapshot;
}

module.exports = {
  WHITELIST,
  noOverflow,
  noOverlap,
  aspectPreserved,
  hitTargets,
  safeAreaFailures,
  occlusionFailures,
  measure,
  assertAll,
};
