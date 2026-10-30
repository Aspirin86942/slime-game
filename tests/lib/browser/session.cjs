// 浏览器会话：唯一持有 CDP 连接的模块。
// 只负责启动、设备指标、导航、交互、截图、错误收集与关闭；断言留在各套件里。
'use strict';

const path = require('node:path');
const { launch, waitFor, fileUrl } = require('../../../tools/out/lib/cdp.js');
const profiles = require('./profiles.cjs');
const fixtures = require('./fixtures.cjs');

// tests/lib/browser → 仓库根
const ROOT = path.resolve(__dirname, '..', '..', '..');
const DEFAULT_OUT = path.join(ROOT, 'tools/out/magic-ui/smoke');
const NAV_TIMEOUT = 15000;
const ZERO_SAFE_AREA = { top: 0, right: 0, bottom: 0, left: 0 };

function resolveOutDir(outDir) {
  return outDir ? path.resolve(ROOT, outDir) : DEFAULT_OUT;
}

// 相对地址按仓库根解析；带协议的地址（file:/http:/data:）原样使用，Windows 盘符不算协议。
function resolveUrl(url) {
  if (typeof url !== 'string' || !url) throw new Error('会话地址无效: ' + url);
  const cut = url.search(/[?#]/);
  const file = cut === -1 ? url : url.slice(0, cut);
  const query = cut === -1 ? '' : url.slice(cut);
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(file) || /^(file|data|about):/i.test(file)) return url;
  if (path.isAbsolute(file)) return fileUrl(file, query);
  return fileUrl(path.resolve(ROOT, file), query);
}

// layout.measure 会读 session.profile.safeArea，这里必须始终是四键对象。
function normalizeSafeArea(safeArea) {
  return { ...ZERO_SAFE_AREA, ...(safeArea || {}) };
}

function requireNumber(label, value) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`设备指标 ${label} 无效: ${value}`);
  return value;
}

async function start({ profile, url, seed, gpu = true, outDir } = {}) {
  if (!profile) throw new Error('缺少设备档案: start({ profile })');
  if (!url) throw new Error('缺少启动地址: start({ url })');

  const resolved = profiles.resolve(profile);
  const outDirAbs = resolveOutDir(outDir);
  const base = await launch({
    url: 'about:blank',
    width: resolved.width,
    height: resolved.height,
    dpr: resolved.dpr,
    touchEnabled: resolved.touch,
    gpu,
  });
  const { client } = base;
  const consoleErrors = [];
  let currentProfile = resolved;
  let closed = false;
  let visitSeq = 0;
  const injectedSeeds = new Set();

  try {
    client.on('Runtime.exceptionThrown', ({ exceptionDetails }) => {
      const description = exceptionDetails && exceptionDetails.exception && exceptionDetails.exception.description;
      consoleErrors.push(description || (exceptionDetails && exceptionDetails.text) || '未知页面异常');
    });
    client.on('Runtime.consoleAPICalled', ({ type, args }) => {
      if (type !== 'error' && type !== 'assert') return;
      consoleErrors.push((args || []).map(a => (a.value !== undefined ? a.value : a.description) ?? '').join(' '));
    });
    client.on('Log.entryAdded', ({ entry }) => {
      if (entry && entry.level === 'error') consoleErrors.push(entry.text);
    });
    await client.send('Log.enable');
  } catch (error) {
    await base.close().catch(() => {});
    throw error;
  }

  const frame = () => base.ev('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))');

  async function injectSeed(name) {
    if (injectedSeeds.has(name)) return;
    await client.send('Page.addScriptToEvaluateOnNewDocument', { source: fixtures.seedSource(name) });
    injectedSeeds.add(name);
  }

  async function visit(target, options = {}) {
    if (options.seed) await injectSeed(options.seed);
    const address = resolveUrl(target);
    // 同一个页面再次导航时，旧文档里的 S 会立刻让轮询通过；
    // 先注册一个只属于本次导航的标记，确认新文档真的开始执行。
    visitSeq += 1;
    const token = visitSeq;
    await client.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__sessionVisit=${token};` });
    const nav = await client.send('Page.navigate', { url: address });
    if (nav && nav.errorText) throw new Error('导航失败: ' + nav.errorText + ' ← ' + address);
    const ready = await waitFor(
      () => base.ev(`window.__sessionVisit === ${token} && typeof S !== 'undefined' && document.readyState !== 'loading'`),
      NAV_TIMEOUT,
      100
    );
    if (!ready) {
      const detail = consoleErrors.length ? '；页内错误: ' + consoleErrors.slice(0, 3).join(' | ') : '';
      throw new Error('等待页面就绪超时: ' + address + detail);
    }
    await frame();
    return address;
  }

  async function metrics(profileOrName, overrides = {}) {
    const source = profileOrName === undefined ? currentProfile : profiles.resolve(profileOrName);
    const width = requireNumber('width', overrides.width ?? source.width);
    const height = requireNumber('height', overrides.height ?? source.height);
    const dpr = requireNumber('dpr', overrides.dpr ?? source.dpr);
    const mobile = overrides.mobile ?? source.mobile;
    const safeArea = normalizeSafeArea({ ...source.safeArea, ...(overrides.safeArea || {}) });
    await client.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: dpr,
      mobile: !!mobile,
      screenWidth: width,
      screenHeight: height,
    });
    // 零安全区也要显式传四键，避免沿用上一个档案的内缩。
    await client.send('Emulation.setSafeAreaInsetsOverride', { insets: safeArea });
    currentProfile = { ...source, width, height, dpr, mobile: !!mobile, safeArea };
    await frame();
    return currentProfile;
  }

  async function tap(selector) {
    const point = await base.ev(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    if (!point) throw new Error('元素缺失: ' + selector);
    await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
    await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
    await frame();
  }

  const tapPoint = (point, holdMs) => base.touch.tap(point.x, point.y, holdMs);

  async function shot(name) {
    const file = path.isAbsolute(name) ? name : path.join(outDirAbs, name.endsWith('.png') ? name : name + '.png');
    return base.shot(file);
  }

  async function close() {
    if (closed) return;
    closed = true;
    await base.close().catch(() => {});
  }

  const session = {
    get profile() { return currentProfile; },
    ev: base.ev,
    frame,
    tap,
    tapPoint,
    touch: base.touch,
    metrics,
    visit,
    shot,
    consoleErrors,
    close,
    // 迁移阶段的逃生口：个别套件需要 setEmulatedMedia / Network / Page.reload 等原始命令。
    client,
    userDir: base.userDir,
    port: base.port,
  };

  try {
    await metrics();
    if (seed) await injectSeed(seed);
    await visit(url);
  } catch (error) {
    await close();
    throw error;
  }
  return session;
}

module.exports = { start };
