# 浏览器测试平台与手机端 smoke 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 subagent-driven-development（推荐）或 executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 为「最强召唤师」建立分层浏览器测试底座（设备档案 / 几何断言 / 存档夹具），新增手机端全应用 smoke，并把 8 个既有浏览器脚本迁移到底座上，检查条数不降、名称不变。

**架构：** 纯函数层（`profiles` / `layout` 的计算部分 / `fixtures` 的读取）不接触浏览器，可直接单元测试；唯一持有 CDP 连接的是 `session`；`smoke-browser.cjs` 与迁移后的 8 个套件消费以上三层，行为断言留在各自脚本里。`tools/out/lib/cdp.js` 保持现状不动。

**技术栈：** Node 26（内置 `node:test`、WebSocket、fetch）、自研 CDP（`tools/out/lib/cdp.js`）、系统 Chrome。无新增依赖。

**规格：** [docs/superpowers/specs/2026-10-31-test-platform-design.md](../specs/2026-10-31-test-platform-design.md)（执行者两份都读）

## 全局约束

- 不新增任何依赖（`package.json` 的 `devDependencies` 保持 `esbuild` + `typescript`）。
- 不改产品代码：`src/**`、`史莱姆.html`、`史莱姆-参考.html`、`tests/baseline-original.html` 一律不动。
- 判定只做几何 / 布局断言，不做像素基线；截图仅存档。
- 所有运行产物写入 `tools/out/magic-ui/**`（已被 `.gitignore` 忽略），`git status` 必须保持干净。
- 迁移 8 个脚本的硬边界：检查条数不降、检查名称不变、报告路径不变；diff 只允许「删除本地助手」「改为底座 import」「视口循环改为遍历 `profiles`」三类。
- 手机优先：默认阈值触摸目标 ≥ 40×40 CSS px；桌面档案 ≥ 32。
- 时长目标：`npm run smoke` ≤ 90 秒（实测后写入 `TEST-HARNESS.md`）。
- 项目约定不自动提交：每个任务以「跑通验证 + 工作区可 diff」结束，提交由用户决定。

## 审查重点（Review Focus）

1. **21:9 超长竖屏（`fold` 1080×2520）**：底栏、工具条、地图控件必须仍在视口内且不互相压盖，否则长屏机型上按钮会被顶出屏幕。→ 钉在任务 6 的 `noOverflow` + `noOverlap` 断言。
2. **横屏刘海（`land-844`，左右各 47、下 21）**：工具条与相机按钮不得进入刘海区，否则横屏握持时按钮压在圆角下。→ 钉在任务 6 的 `safeAreaFailures` 断言。
3. **弹层打开时底栏被遮挡**：研究面板 / 植物面板展开后内容必须完整在视口与安全区内，底栏按钮要么仍可点要么明确不可达，不能出现“看得见点不到”。→ 钉在任务 7 的 `occlusionFailures` + `withinSafeArea` 断言。
4. **高 DPR（3）下的图片与文字**：图片渲染比例与 `naturalWidth/naturalHeight` 偏差 ≤ 2%，元素 `scrollHeight ≤ clientHeight + 1`，避免 DPR 取整造成的截断。→ 钉在任务 2 的 `aspectPreserved` 单元测试与任务 6 的截图样本。
5. **夹具存档版本漂移**：`legacy-v5.json` 读入后必须走迁移并留下 `slimeSummonerSave_v5_backup`，玩家进度不得丢失。→ 钉在任务 5 的夹具反向校验与任务 6 的迁移断言。

---

## 文件结构

**新建：**

| 文件 | 职责 |
| --- | --- |
| `tests/lib/browser/profiles.cjs` | 设备档案表、安全区、矩阵展开（纯数据） |
| `tests/lib/browser/layout.cjs` | 几何测量与断言：溢出 / 重叠 / 比例 / 遮挡 / 命中区 / 安全区（纯函数 + 少量浏览器测量入口） |
| `tests/lib/browser/fixtures.cjs` | 夹具列表、原文读取、导航前注入脚本生成（不启动浏览器） |
| `tests/lib/browser/session.cjs` | 唯一持有 CDP 连接：启动、指标、导航、交互、截图、错误收集、关闭 |
| `tests/lib/browser/profiles.test.cjs` | `profiles` 单元测试（无浏览器） |
| `tests/lib/browser/layout.test.cjs` | `layout` 纯函数单元测试（合成快照） |
| `tests/lib/browser/fixtures.test.cjs` | `fixtures` 单元测试（临时目录） |
| `tests/fixtures/build.cjs` | 夹具生成器：真实会话导出 → 规范化 → 反向校验 → 写盘 |
| `tests/fixtures/saves/*.json` | 五份存档夹具 |
| `tests/smoke-browser.cjs` | 手机端全应用 smoke |
| `docs/living-world/TEST-HARNESS.md` | 底座使用说明 |

**修改：**

| 文件 | 改动 |
| --- | --- |
| `package.json` | 新增 `smoke` 脚本；`test:browser` 末尾串联 `node tests/smoke-browser.cjs` |
| `tests/home-browser.cjs` 等 8 个套件 | 删除本地助手，改用底座；视口循环改为遍历 `profiles.matrix` |
| `CLAUDE.md` | 更新「验证入口」段 |

---

## 任务 1：`profiles.cjs` 设备档案与矩阵

**文件：**
- 创建：`tests/lib/browser/profiles.cjs`
- 测试：`tests/lib/browser/profiles.test.cjs`

- [ ] **步骤 1：编写失败的测试**

```js
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
```

- [ ] **步骤 2：运行测试验证失败**

运行：`node --test tests/lib/browser/profiles.test.cjs`
预期：FAIL，`Cannot find module './profiles.cjs'`

- [ ] **步骤 3：实现 `tests/lib/browser/profiles.cjs`**

导出 `{ devices, matrix, resolve }`。`devices` 为 13 个档案，字段 `{ width, height, dpr, ratio, touch, safeArea }`（`safeArea` 恒为四键对象）；`matrix({ group })` 返回档案名数组，顺序按 `devices` 声明顺序过滤；`resolve(nameOrObject)` 返回补齐 `name`、`mobile`（`width < 1000`）、`touch`（默认 true）与 `safeArea` 默认值的对象，未知名称 `throw new Error('未知设备档案: ' + name)`。

- [ ] **步骤 4：运行测试验证通过**

运行：`node --test tests/lib/browser/profiles.test.cjs`
预期：`# pass 5` / `# fail 0`

- [ ] **步骤 5：确认工作区只有新增文件**

运行：`git status --short`
预期：仅 `?? tests/lib/browser/`

---

## 任务 2：`layout.cjs` 几何断言原语

**文件：**
- 创建：`tests/lib/browser/layout.cjs`
- 测试：`tests/lib/browser/layout.test.cjs`

- [ ] **步骤 1：编写失败的测试**

```js
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

test('hitTargets 拦截小于阈值的触摸目标', () => {
  const s = snap([
    { selector: '.btn-ok', rect: rect(0, 0, 44, 44) },
    { selector: '.btn-tiny', rect: rect(0, 60, 28, 28) }
  ]);
  assert.deepEqual(L.hitTargets(s, { min: 40 }).map(f => f.selector), ['.btn-tiny']);
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
```

- [ ] **步骤 2：运行测试验证失败**

运行：`node --test tests/lib/browser/layout.test.cjs`
预期：FAIL，`Cannot find module './layout.cjs'`

- [ ] **步骤 3：实现 `tests/lib/browser/layout.cjs`**

纯函数：`noOverflow(snapshot)` 返回失败数组（每条 `{ selector|'document', reason }`）；`noOverlap(snapshot, { whitelist, minOverlap = 1 })` 返回 `{ a, b, overlap, axis }`；`aspectPreserved(snapshot, { tolerance = 0.02 })` 只检查带 `naturalWidth/naturalHeight` 的元素；`hitTargets(snapshot, { min })`；`safeAreaFailures(snapshot)`。浏览器侧仅两个入口：`measure(session, selectors)` 生成快照（含 `viewport`、`dpr`、`safeArea`、元素 `rect` / `naturalWidth` / `naturalHeight` / `scrollHeight` / `clientHeight` / `hitSelector`），`assertAll(session, spec)` 组合调用并在失败时抛错。白名单常量 `WHITELIST` 定义在本文件顶部。`hitSelector` 由 `measure` 通过 `document.elementFromPoint` 填中心点命中的选择器链首段。

- [ ] **步骤 4：运行测试验证通过**

运行：`node --test tests/lib/browser/layout.test.cjs`
预期：`# pass 6` / `# fail 0`

- [ ] **步骤 5：确认没有改动旧脚本**

运行：`git status --short`
预期：仅新增 `tests/lib/browser/layout.cjs` 与 `tests/lib/browser/layout.test.cjs`

---

## 任务 3：`fixtures.cjs` 读取与注入

**文件：**
- 创建：`tests/lib/browser/fixtures.cjs`
- 测试：`tests/lib/browser/fixtures.test.cjs`

- [ ] **步骤 1：编写失败的测试（用临时目录，不依赖真实夹具）**

```js
// tests/lib/browser/fixtures.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const F = require('./fixtures.cjs');

function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fixture-'));
  fs.writeFileSync(path.join(dir, 'mobile-baseline.json'), JSON.stringify({ saveVersion: 5, started: true, coins: 1 }));
  return dir;
}

test('list 按文件名排序，仅收 .json', () => {
  const dir = sandbox();
  fs.writeFileSync(path.join(dir, 'notes.txt'), 'x');
  assert.deepEqual(F.list({ dir }), ['mobile-baseline']);
});

test('raw 返回原文，seedSource 生成只写存档键的注入脚本', () => {
  const dir = sandbox();
  const raw = F.raw('mobile-baseline', { dir });
  assert.equal(JSON.parse(raw).saveVersion, 5);
  const src = F.seedSource('mobile-baseline', { dir });
  assert.match(src, /localStorage\.setItem\('slimeSummonerSave'/);
  assert.match(src, /__seedError/);
  assert.ok(!src.includes('slimeSummonerSave_v'), '注入脚本不得伪造迁移备份');
});

test('缺失夹具报中文错误并带可用清单', () => {
  const dir = sandbox();
  assert.throws(() => F.raw('nope', { dir }), /未知夹具: nope.*mobile-baseline/s);
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`node --test tests/lib/browser/fixtures.test.cjs`
预期：FAIL，`Cannot find module './fixtures.cjs'`

- [ ] **步骤 3：实现 `tests/lib/browser/fixtures.cjs`**

导出 `SAVE_KEY = 'slimeSummonerSave'`、`list({ dir } = {})`（默认目录 `tests/fixtures/saves`，按名排序，缺目录返回空数组）、`raw(name, { dir })`、`seedSource(name, { dir })`（返回 `try{ localStorage.setItem(SAVE_KEY, <JSON 字面量>); }catch(e){ window.__seedError = String(e); }` 形式的源码字符串，`SAVE_KEY` 用 `'slimeSummonerSave'` 字面量以匹配注入时机）。

- [ ] **步骤 4：运行测试验证通过**

运行：`node --test tests/lib/browser/fixtures.test.cjs`
预期：`# pass 3` / `# fail 0`

- [ ] **步骤 5：更新 `npm test` 的单元测试入口（可选但推荐）**

在 `package.json` 新增 `"test:harness": "node --test tests/lib/browser/"`。运行：`npm run test:harness`
预期：`# pass 14`（5 + 6 + 3），`# fail 0`

---

## 任务 4：`session.cjs` 与 smoke 骨架

**文件：**
- 创建：`tests/lib/browser/session.cjs`
- 创建：`tests/smoke-browser.cjs`
- 修改：`package.json`（新增 `smoke`）

- [ ] **步骤 1：编写会失败的 smoke 骨架（先写消费者）**

`tests/smoke-browser.cjs` 第一版只做启动自检：

```js
const { start } = require('./lib/browser/session.cjs');
const profiles = require('./lib/browser/profiles.cjs');
(async () => {
  const results = [];
  for (const name of profiles.matrix({ group: 'all' })) {
    const s = await start({ profile: name, url: '史莱姆.html?battle=ui', outDir: 'tools/out/magic-ui/smoke' });
    try {
      const shot = await s.ev('({ w: innerWidth, h: innerHeight, dpr: devicePixelRatio })');
      const ok = shot.w === s.profile.width && shot.h === s.profile.height && shot.dpr === s.profile.dpr && s.consoleErrors.length === 0;
      results.push({ name, ok, shot, errors: s.consoleErrors });
      console.log((ok ? 'PASS ' : 'FAIL ') + 'boot ' + name + '  ' + shot.w + '×' + shot.h + ' @' + shot.dpr);
    } finally { await s.close(); }
  }
  const failed = results.filter(r => !r.ok);
  console.log(`RESULT ${results.length - failed.length}/${results.length} smoke boot checks`);
  if (failed.length) { console.error(JSON.stringify(failed, null, 2)); process.exitCode = 1; }
})();
```

- [ ] **步骤 2：运行验证失败**

运行：`node tests/smoke-browser.cjs`
预期：FAIL，`Cannot find module './lib/browser/session.cjs'`

- [ ] **步骤 3：实现 `tests/lib/browser/session.cjs`**

`start({ profile, url, seed, gpu = true, outDir })` 内部调用 `tools/out/lib/cdp.js` 的 `launch`，应用 `profiles.resolve(profile)` 的尺寸 / DPR / 触摸 / 安全区（`Emulation.setSafeAreaInsetsOverride`，零安全区时传 `{ top: 0, right: 0, bottom: 0, left: 0 }`），若给了 `seed` 则先 `Page.addScriptToEvaluateOnNewDocument(fixtures.seedSource(seed))` 再导航，等待 `typeof S !== 'undefined'`。返回对象含 `profile`、`ev`、`frame`、`tap`、`tapPoint`、`touch`、`metrics(profileOrName)`、`visit(url, { seed })`、`shot(name)`、`consoleErrors`、`close()`。`close()` 幂等；`shot` 落盘到 `outDir/<name>.png`。

- [ ] **步骤 4：运行验证通过**

运行：`node tests/smoke-browser.cjs`
预期：13 行 `PASS boot <档案>  <宽>×<高> @<dpr>`，末行 `RESULT 13/13 smoke boot checks`，退出码 0。记录实测耗时（`Measure-Command` 或脚本内计时）。

- [ ] **步骤 5：接入 npm 脚本**

`package.json` 新增 `"smoke": "node tests/smoke-browser.cjs"`。运行：`npm run smoke`
预期：`RESULT 13/13`，退出码 0。

---

## 任务 5：夹具生成器与五份存档夹具

**文件：**
- 创建：`tests/fixtures/build.cjs`
- 创建：`tests/fixtures/saves/mobile-baseline.json`、`mobile-developed.json`、`mobile-orders.json`、`mobile-offline.json`、`legacy-v5.json`
- 修改：`tests/smoke-browser.cjs`（家园屏改用 `mobile-developed` 夹具）

- [ ] **步骤 1：编写生成器骨架并让它先失败**

`tests/fixtures/build.cjs` 接受 `node tests/fixtures/build.cjs [name...]`，缺省生成全部五个。每个夹具对应一个 `builders` 条目：`{ name, prepare(s) }`，`prepare` 内用 `session.ev` 执行游戏内命令（开场三连击 `#storyNext`、`LivingWorld.execute`、`S.world.estate.plots=...` 等）。

- [ ] **步骤 2：运行验证失败**

运行：`node tests/fixtures/build.cjs`
预期：FAIL，`Cannot find module '../lib/browser/session.cjs'`（若任务 4 未完成）或缺少 `builders` 实现

- [ ] **步骤 3：实现生成器**

流程：启动 `session`（`profile: 'iphone-14'`，`url: '史莱姆.html?battle=ui'`）→ `prepare` 构造状态 → `ev` 取 `localStorage.getItem(SAVE_KEY)` → 规范化（固定 `name`、`lastActive`、`planClock`，伙伴与设施 id 改递增序号）→ 反向校验（再次注入该 JSON 起新会话，断言 `S.started === true` 且 `coins`、`world.estate.plots.length` 与写入值一致）→ 写 `tests/fixtures/saves/<name>.json`。

五个夹具的 `prepare` 语义：

| 夹具 | prepare 要做的事 |
| --- | --- |
| `mobile-baseline` | 只走开场，不建设施 |
| `mobile-developed` | 全部地块开垦、全科技完成、放置 6 座设施并升到三档、种下 4 株在长作物 |
| `mobile-orders` | 在 developed 基础上开始 1 项研究、1 个委托、1 次集市出售 |
| `mobile-offline` | 在 baseline 基础上把 `lastActive` 置于 13 小时前 |
| `legacy-v5` | 手工构造 `form < level` 的旧放置与旧地块，`saveVersion: 5` |

- [ ] **步骤 4：运行验证通过并确认可重复生成**

运行：`node tests/fixtures/build.cjs` → 预期 `built 5 fixtures` 与各文件名、字节数
再运行：`node tests/fixtures/build.cjs` 第二次，随后比较哈希：
`Get-ChildItem tests/fixtures/saves/*.json | Get-FileHash | Format-Table`
预期：两次哈希一致（确定性生成）。

- [ ] **步骤 5：smoke 改用夹具并验证真实读档**

`tests/smoke-browser.cjs` 在 `start({ seed: 'mobile-developed' })` 后断言 `S.started === true` 且 `S.world.estate.plots.length` 等于夹具值。运行：`npm run smoke`
预期：`PASS seeded mobile-developed` + `RESULT 14/14`。

---

## 任务 6：smoke 覆盖全应用页面与四类断言

**文件：**
- 修改：`tests/smoke-browser.cjs`
- 使用：`tests/lib/browser/layout.cjs`

- [ ] **步骤 1：在 smoke 中加入页面清单与断言（先写会失败的检查）**

页面清单常量：`['companion', 'home', 'summon', 'travel', 'bag', 'status']`，每屏执行 `switchTab(name)` → `frame()` → `measure` 六组选择器（`.topbar`、`.home-season`、`.home-stock`、`.home-tools`、`.home-camera`、`.tabbar`，旧玩法页缺失的选择器跳过）→ 跑 `noOverflow`、`noOverlap`、`aspectPreserved`、`hitTargets`。手机档案追加 `safeAreaFailures`。

同一任务内追加一条夹具迁移检查：用 `seed: 'legacy-v5'` 启动一次（`profile: 'iphone-14'`），断言 `Object.keys(localStorage).some(k => k.startsWith('slimeSummonerSave_v5_backup'))` 为真，且 `S.world.estate.plots.length` 大于 0、`S.started === true`。

- [ ] **步骤 2：运行验证失败**

运行：`npm run smoke`
预期：FAIL 若干档案，输出具体失败元素对（此时期望至少能看到几个真实问题；若全绿则说明断言没生效，必须排查）

- [ ] **步骤 3：按失败结果修正断言口径或白名单**

只允许两种修正：补充 `WHITELIST`（需在计划执行记录里逐条说明理由），或修正选择器清单。**不得**通过放宽阈值掩盖真实重叠。

- [ ] **步骤 4：运行验证通过**

运行：`npm run smoke`
预期：全部 PASS，`RESULT n/n`，记录检查条数与耗时；截图按档案抽样（每个档案每个分组一屏，避免长屏档案拖慢时长），落在 `tools/out/magic-ui/smoke/<档案>/`；失败时额外落几何快照 JSON。

- [ ] **步骤 5：确认工作区干净**

运行：`git status --short`
预期：仅 `tests/` 下计划内的文件变更，无 `tools/out` 产物。

---

## 任务 7：smoke 覆盖家园弹层态与旧玩法

**文件：**
- 修改：`tests/smoke-browser.cjs`

- [ ] **步骤 1：加入弹层与旧玩法场景（先写断言）**

四个家园弹层态：建造栏（`[data-lw="edit"]`）、设施环形按钮（点击一座设施）、植物面板（`[data-lw="panel"][data-panel="plants"]`）、研究面板（`[data-lw="panel"][data-panel="tech"]`）；每个打开后跑 `occlusionFailures` + `withinSafeArea`，并断言弹层容器矩形完全在视口内。旧玩法五个交互：接球点击一次、堆叠切换一次、战斗手动一次、战斗自动一次、战斗撤退一次，各自断言无 `consoleErrors` 增长。

- [ ] **步骤 2：运行验证失败**

运行：`npm run smoke`
预期：至少一项 FAIL（弹层遮挡或选择器缺失），输出可定位

- [ ] **步骤 3：修正选择器与白名单，必要时修 smoke 的点击序列**

不允许改产品代码。若弹层确实存在真实遮挡问题，记录到计划执行记录并单独报告给用户，不在此任务里改产品。

- [ ] **步骤 4：运行验证通过**

运行：`npm run smoke`
预期：全部 PASS，末行 `RESULT n/n`；记录新增条数

- [ ] **步骤 5：记录时长**

运行：`Measure-Command { npm run smoke | Out-Host }`
预期：`TotalSeconds` ≤ 90

---

## 任务 8：迁移 `home-browser.cjs`

**文件：**
- 修改：`tests/home-browser.cjs`

- [ ] **步骤 1：固化迁移前基线**

运行：`node tests/home-browser.cjs | Select-String '^PASS ' | ForEach-Object { $_.Line.Substring(5) } | Sort-Object | Set-Content "$env:TEMP\base-home.txt"`
预期：文件约 54 行

- [ ] **步骤 2：改写脚本使用底座（先跑，预期失败或有差异）**

删除本地 `check`、`tap`、`frame`、`metrics`、几何测量与控制台收集，改用 `session` / `layout` / `profiles`；视口循环改为 `for (const name of profiles.matrix({ group: 'all' }))`。保留全部断言语义与名称原文。

- [ ] **步骤 3：运行验证**

运行：`node tests/home-browser.cjs`
预期：`RESULT 54/54 browser checks`，退出码 0

- [ ] **步骤 4：比对名称集合**

运行：`node tests/home-browser.cjs | Select-String '^PASS ' | ForEach-Object { $_.Line.Substring(5) } | Sort-Object | Set-Content "$env:TEMP\new-home.txt"; Compare-Object (Get-Content "$env:TEMP\base-home.txt") (Get-Content "$env:TEMP\new-home.txt")`
预期：无输出（名称集合完全一致）

- [ ] **步骤 5：确认报告路径未变**

运行：`git status --short; Get-ChildItem tools/out/magic-ui/home -ErrorAction SilentlyContinue`
预期：截图与 `results.json` 仍落在 `tools/out/magic-ui/home`，工作区无 `tools/out` 变更

---

## 任务 9：迁移 `theme-browser.cjs`

**文件：**
- 修改：`tests/theme-browser.cjs`

- [ ] **步骤 1：固化基线**

运行：`node tests/theme-browser.cjs | Select-String '^PASS ' | ForEach-Object { $_.Line.Substring(5) } | Sort-Object | Set-Content "$env:TEMP\base-theme.txt"`
预期：283 行

- [ ] **步骤 2：改写为遍历 `profiles.matrix({ group: 'phones' })` × 主题 × 安全区**

保留“五视口 × 三安全区 × 六主题”的语义时，用 `profiles` 中对应档案名替换硬编码尺寸，禁止新增或删除组合。

- [ ] **步骤 3：运行验证**

运行：`node tests/theme-browser.cjs`
预期：`RESULT 283/283 theme browser checks`

- [ ] **步骤 4：比对名称集合**

运行：`node tests/theme-browser.cjs | Select-String '^PASS ' | ForEach-Object { $_.Line.Substring(5) } | Sort-Object | Set-Content "$env:TEMP\new-theme.txt"; Compare-Object (Get-Content "$env:TEMP\base-theme.txt") (Get-Content "$env:TEMP\new-theme.txt")`
预期：无输出

- [ ] **步骤 5：跑前两个套件确认互不影响**

运行：`node tests/home-browser.cjs; node tests/theme-browser.cjs`
预期：`54/54` 与 `283/283`

---

## 任务 10：迁移 `mobile-home-browser.cjs` 与 `building-forms-browser.cjs`

**文件：**
- 修改：`tests/mobile-home-browser.cjs`、`tests/building-forms-browser.cjs`

- [ ] **步骤 1：固化两份基线**

运行：`node tests/mobile-home-browser.cjs | Select-String '^PASS ' | ForEach-Object { $_.Line.Substring(5) } | Sort-Object | Set-Content "$env:TEMP\base-mobile.txt"`，对 `building-forms-browser.cjs` 同样处理（`base-forms.txt`）
预期：43 行与 222 行

- [ ] **步骤 2：迁移 `mobile-home-browser.cjs`**

用 `profiles` 中的手机/横屏档案替换手写尺寸与安全区表，`clearHouse` 逻辑改用 `layout.measure` + `noOverflow` / `noOverlap`，保留原有断言名称。

尺寸映射（不得改变已有组合数量）：`320×568`→`se`、`390×844`→`iphone-14`、`844×390`→`land-844`、`1440×900`→`desktop-s`、`1920×1080`→`desktop-m`；设备安全区用例映射：`iphone-safari(390×700, 47/34)`→`iphone-14` + 自定义高度 700、`android-chrome(360×640)`→`android-s`、`small-landscape(568×320)`→`land-568`、`phone-landscape(844×390, 左右 47/下 21)`→`land-844`。

- [ ] **步骤 3：运行验证**

运行：`node tests/mobile-home-browser.cjs`
预期：`RESULT 43/43 mobile home checks`，名称集合并集比较无差异

- [ ] **步骤 4：迁移 `building-forms-browser.cjs`**

助手替换为底座；视口循环改为遍历 `profiles`（保持原有四个视口语义，用 `320×568`→`se`、`390×844`→`iphone-14`、`844×390`→`land-844`、`1920×1080`→`desktop-m` 映射）。

- [ ] **步骤 5：运行验证**

运行：`node tests/building-forms-browser.cjs`
预期：`RESULT 222/222 building form browser checks`，名称集合比较无差异

---

## 任务 11：迁移 `home-actions-browser.cjs` 与 `estate-browser.cjs`

**文件：**
- 修改：`tests/home-actions-browser.cjs`、`tests/estate-browser.cjs`

- [ ] **步骤 1：固化两份基线**

运行：对两个脚本分别执行 `node tests/<script> | Select-String '^PASS ' ... | Set-Content "$env:TEMP\base-<name>.txt"`
预期：60 行与 30 行

- [ ] **步骤 2：迁移 `home-actions-browser.cjs`**

助手替换为底座；五视口循环改为 `profiles.matrix({ group: 'all' })` 的子集（保持原有五个视口：`se`、`iphone-14`、`land-844`、`desktop-s`、`desktop-m`）。

- [ ] **步骤 3：运行验证**

运行：`node tests/home-actions-browser.cjs`
预期：`RESULT 60/60 home action checks`

- [ ] **步骤 4：迁移 `estate-browser.cjs`**

助手替换为底座；视口循环同样改为档案名映射；保留 FPS 与季节栏断言。

- [ ] **步骤 5：运行验证**

运行：`node tests/estate-browser.cjs`
预期：`RESULT 30/30 estate browser checks`

---

## 任务 12：迁移 `seasons-browser.cjs` 与 `reference-browser.cjs`

**文件：**
- 修改：`tests/seasons-browser.cjs`、`tests/reference-browser.cjs`

- [ ] **步骤 1：固化两份基线**

运行：对两个脚本分别执行名称集合导出
预期：87 行与 62 行

- [ ] **步骤 2：迁移 `seasons-browser.cjs`**

季节 × 时段矩阵保持不变，仅替换助手与视口来源；截图目录保持 `tools/out/magic-ui/seasonal`。

- [ ] **步骤 3：运行验证**

运行：`node tests/seasons-browser.cjs`
预期：`RESULT 87/87 seasonal browser checks`

- [ ] **步骤 4：迁移 `reference-browser.cjs`**

这是原版对照套件，必须保留“参考文件不可改写”的只读语义；只替换助手与视口来源，不改任何对比逻辑。

- [ ] **步骤 5：运行验证**

运行：`node tests/reference-browser.cjs`
预期：`RESULT 62/62 reference browser checks`

---

## 任务 13：全量验证与文档

**文件：**
- 修改：`package.json`（`test:browser` 末尾串联 smoke）
- 创建：`docs/living-world/TEST-HARNESS.md`
- 修改：`CLAUDE.md`（验证入口段）

- [ ] **步骤 1：串联入口**

`test:browser` 末尾追加 `&& node tests/smoke-browser.cjs`。

- [ ] **步骤 2：全量验证**

运行：`npm run test:browser`
预期：8 个套件分别 54/62/283/43/222/60/30/87，随后 smoke 全 PASS，总退出码 0

- [ ] **步骤 3：无头单测不受影响**

运行：`npm test`
预期：类型检查 + 构建通过，104 + 48 + 10 全过；`git status` 干净（构建产物与提交版本一致）

- [ ] **步骤 4：写 `docs/living-world/TEST-HARNESS.md`**

内容：底座四模块接口表、如何新增机型（改 `profiles.cjs` 一处）、夹具生成与更新流程（`node tests/fixtures/build.cjs`）、smoke 结构与四类断言口径、失败定位步骤（几何快照 + 截图位置）、白名单维护规则、实测时长（smoke 秒数与全量分钟数）。

- [ ] **步骤 5：更新 `CLAUDE.md`**

在「验证入口」段加入：`npm run smoke` 入口、`tests/lib/browser/` 底座、`tests/fixtures/saves/` 夹具、`tests/fixtures/build.cjs` 生成器，并把当前检查条数更新为实测值（原 841 项 + smoke 条数）。

- [ ] **步骤 6：最终确认**

运行：`git status --short --branch; npm run smoke`
预期：分支与远端一致，工作区只有计划内改动，smoke 全 PASS 且 ≤ 90 秒
